// SISP-166: Active Customer Security Deposit → Monthly Bill Offset.
//
// Lets the operator apply part (or all) of an ACTIVE customer's held
// securityDeposit against their pending balance as a non-cash internal
// adjustment — the connection stays live, the deposit simply goes down
// and the bill due goes down by the same amount.
//
// MECHANISM — this phase MIRRORS SISP-50 (hardware-custody.js
// applyDepositSettlement), it does not invent a second one. SISP-50's
// own design note is decisive: the offset rides as audited BILL fields
// (depositOffsetAmount + depositOffsetReason + depositOffsetAppliedAt
// plus an amountHistory entry per bill, distributed oldest month
// first), and the allocation engine subtracts it from the bill's due.
// A "payment" record with method "Security Deposit Offset" was
// rejected by SISP-50 on evidence and is rejected here for the same
// reasons: no payment exists, so no cash total can move (Roznamcha
// drawer, shop trays, wallet totals and P&L income — which counts
// payment records only — are all untouched BY CONSTRUCTION), and a
// zero/fake payment would corrupt backup validation. The spec's
// "paymentMethod: Security Deposit Offset" wording is therefore
// surfaced as the LABEL on the bill stamp's reason + the receipt,
// exactly as SISP-50's clearance surfaces its reason — one
// representation, so every report (engine, Khata Doctor, receipts,
// forecaster) treats an active offset and a clearance offset
// identically: both reduce dues, neither is income or cash.
//
// DIFFERENCES FROM CLEARANCE (deliberate, and guarded):
//  * Clearance is one-shot and terminal: it zeroes the deposit,
//    covers hardware charges, pays a refund and stamps
//    customer.depositSettlement. An active offset is PARTIAL and
//    repeatable: the deposit is reduced by exactly the offset, the
//    remainder stays held, NO depositSettlement is stamped (so a
//    later disconnection can still clear the remainder through
//    SISP-50), and no hardware charge or refund is involved.
//  * Each application is recorded on the customer as an append-only
//    entry in customer.depositOffsets ({ id 'DOF-101+', date, amount,
//    bills: [{ month, amount }], depositBefore, depositAfter,
//    reversedAt }) — the audit trail and the reversal handle.
//  * REVERSAL: clearance has none (it is terminal). An active offset
//    can be reversed exactly while the customer is still active and
//    unsettled: reverseActiveDepositOffset subtracts each bill share
//    back off the bill's depositOffsetAmount, appends an
//    amountHistory reversal entry per bill, restores the deposit and
//    stamps the entry reversedAt. Once the customer is archived (or
//    clearance has run), reversal here is refused — the deposit story
//    belongs to clearance then, and the two flows can never both move
//    the same deposit.
//
// Money inputs (pendingBalance, billBalances) come from the caller
// (app.js) computed from the canonical engine — exactly how app.js
// feeds SISP-50 — so this module stays free of billing imports.

import { isDisconnected, normalizeCustodyFields, sanitizeDepositSettlement } from './hardware-custody.js';

export const ACTIVE_DEPOSIT_OFFSET_REASON = 'Security deposit offset — applied against bill (connection active)';
export const DEPOSIT_OFFSET_METHOD_LABEL = 'Security Deposit Offset';

const depCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const depRupees = (centsValue) => Math.round(centsValue) / 100;
const sanitizeMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
};
const sanitizeMoneyOrZero = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0;
};
const isValidMonthKey = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// The stored per-application record, normalized. Entries too malformed
// to trust (no valid id/date, non-positive amount) are dropped — a
// corrupt entry must never pose as a real offset or be reversible.
export function sanitizeDepositOffsets(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' ? entry.id.trim().slice(0, 32) : '';
    if (!id || seen.has(id)) continue;
    if (!isValidDateString(entry.date)) continue;
    const amount = sanitizeMoney(entry.amount);
    if (!(amount > 0)) continue;
    const bills = (Array.isArray(entry.bills) ? entry.bills : [])
      .filter((row) => row && isValidMonthKey(row.month) && Number.isFinite(Number(row.amount)) && Number(row.amount) > 0)
      .map((row) => ({ month: row.month, amount: Math.round(Number(row.amount) * 100) / 100 }));
    seen.add(id);
    out.push({
      id,
      date: entry.date,
      amount,
      bills,
      depositBefore: sanitizeMoneyOrZero(entry.depositBefore),
      depositAfter: sanitizeMoneyOrZero(entry.depositAfter),
      reversedAt: isValidDateString(entry.reversedAt) ? entry.reversedAt : null
    });
  }
  return out;
}

export function depositOffsetsOf(customer = {}) {
  return sanitizeDepositOffsets(customer?.depositOffsets);
}

export function depositOffsetEntryOf(customer = {}, offsetId = '') {
  return depositOffsetsOf(customer).find((entry) => entry.id === offsetId) ?? null;
}

// Sequential ids DOF-101, DOF-102, ... continuing past the highest id
// already recorded (reversed entries keep their ids — never reused).
export function nextDepositOffsetId(customer = {}) {
  let max = 100;
  for (const entry of depositOffsetsOf(customer)) {
    const match = /^DOF-(\d+)$/.exec(entry.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `DOF-${max + 1}`;
}

// The eligibility quote. pendingBalance is the caller's engine total
// (rupees); non-finite or negative input counts as 0.
export function activeDepositOffsetQuote(customer = {}, pendingBalance = 0) {
  const fields = normalizeCustodyFields(customer);
  const securityDeposit = fields.securityDeposit ?? 0;
  const pending = sanitizeMoney(pendingBalance);
  const alreadySettled = sanitizeDepositSettlement(customer?.depositSettlement) !== null;
  const reason = isDisconnected(customer) ? 'archived'
    : customer?.isFreeConnection === true ? 'free-connection'
      : alreadySettled ? 'already-settled'
        : !(securityDeposit > 0) ? 'no-deposit'
          : !(pending > 0) ? 'no-dues'
            : null;
  return {
    eligible: reason === null,
    reason,
    securityDeposit,
    pendingBalance: pending,
    maxOffset: depRupees(Math.min(depCents(securityDeposit), depCents(pending)))
  };
}

// Apply an offset of `amount` rupees against the customer's pending
// balance. billBalances = [{ month, balanceDue }] from the caller's
// fresh engine snapshot; the amount is distributed oldest month first
// and each bill's share is clamped to that bill's balance (the SISP-50
// distribution, verbatim discipline). The recorded entry is recomputed
// from what was ACTUALLY written, so it always reconciles with the
// ledger even if the snapshot was stale. Pure: returns a NEW customer;
// the input is never mutated. Throws on every guard so the UI can
// never record a meaningless offset.
export function applyActiveDepositOffset(customer = {}, pendingBalance = 0, { date, amount, billBalances = [] } = {}) {
  if (!isValidDateString(date)) throw new Error('Enter a valid offset date.');
  const quote = activeDepositOffsetQuote(customer, pendingBalance);
  if (!quote.eligible) {
    throw new Error(quote.reason === 'archived'
      ? 'This customer is archived — the disconnection clearance settles their deposit, not the active offset.'
      : quote.reason === 'free-connection'
        ? 'Free connections have no bills — their deposit is never offset here.'
        : quote.reason === 'already-settled'
          ? 'This security deposit was already settled at disconnection.'
          : quote.reason === 'no-deposit'
            ? 'No security deposit is recorded for this customer.'
            : 'This customer has no pending balance to offset.');
  }
  const requestedC = depCents(amount);
  if (!(requestedC > 0)) throw new Error('Enter an offset amount greater than zero.');
  if (requestedC > depCents(quote.securityDeposit)) {
    throw new Error('The offset cannot exceed the security deposit held.');
  }
  if (requestedC > depCents(quote.pendingBalance)) {
    throw new Error('The offset cannot exceed the pending balance — the remainder stays as deposit.');
  }
  let remainingC = requestedC;
  const offsets = [];
  const bills = (Array.isArray(customer?.bills) ? customer.bills : []).map((bill) => ({ ...bill }));
  const ordered = [...(Array.isArray(billBalances) ? billBalances : [])]
    .filter((row) => row && isValidMonthKey(row.month) && Number.isFinite(Number(row.balanceDue)) && Number(row.balanceDue) > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
  const offsetId = nextDepositOffsetId(customer);
  for (const row of ordered) {
    if (remainingC <= 0) break;
    const index = bills.findIndex((bill) => bill && bill.month === row.month);
    if (index < 0) continue;
    const shareC = Math.min(remainingC, depCents(row.balanceDue));
    if (shareC <= 0) continue;
    const share = depRupees(shareC);
    const bill = bills[index];
    const previousOffset = sanitizeMoney(bill.depositOffsetAmount);
    const newOffset = Math.round((previousOffset + share) * 100) / 100;
    bills[index] = {
      ...bill,
      depositOffsetAmount: newOffset,
      depositOffsetReason: ACTIVE_DEPOSIT_OFFSET_REASON,
      depositOffsetAppliedAt: date,
      amountHistory: [
        ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
        {
          changedAt: `${date}T00:00`,
          type: 'deposit_offset_active_applied',
          offsetId,
          previousDepositOffset: previousOffset,
          depositOffset: newOffset,
          note: ACTIVE_DEPOSIT_OFFSET_REASON
        }
      ]
    };
    offsets.push({ month: row.month, amount: share });
    remainingC -= shareC;
  }
  const appliedC = requestedC - remainingC;
  if (appliedC <= 0) throw new Error('Nothing could be applied — the bill balances changed. Reload and try again.');
  const depositBefore = quote.securityDeposit;
  const entry = {
    id: offsetId,
    date,
    amount: depRupees(appliedC),
    bills: offsets,
    depositBefore,
    depositAfter: depRupees(depCents(depositBefore) - appliedC),
    reversedAt: null
  };
  return {
    ...customer,
    securityDeposit: entry.depositAfter,
    bills,
    depositOffsets: [...depositOffsetsOf(customer), entry]
  };
}

// Reverse one active offset exactly: every bill share comes back off
// the bill's depositOffsetAmount, the deposit is restored by the full
// entry amount, and the entry is stamped reversedAt (it stays in the
// log as audit — it is never deleted). Refused once the customer is
// archived or clearance has run: from then on the deposit story is
// closed by SISP-50 and this flow must not reach into it.
export function reverseActiveDepositOffset(customer = {}, offsetId = '', { date } = {}) {
  if (!isValidDateString(date)) throw new Error('Enter a valid reversal date.');
  if (isDisconnected(customer)) {
    throw new Error('This customer is archived — their deposit is closed by the disconnection clearance and cannot be reversed here.');
  }
  if (sanitizeDepositSettlement(customer?.depositSettlement) !== null) {
    throw new Error('This security deposit was already settled at disconnection.');
  }
  const entries = depositOffsetsOf(customer);
  const entry = entries.find((row) => row.id === offsetId);
  if (!entry) throw new Error('That deposit offset record was not found.');
  if (entry.reversedAt) throw new Error('That deposit offset was already reversed.');
  const bills = (Array.isArray(customer?.bills) ? customer.bills : []).map((bill) => ({ ...bill }));
  for (const share of entry.bills) {
    const index = bills.findIndex((bill) => bill && bill.month === share.month);
    if (index < 0) continue; // bill no longer exists: nothing stamped to restore; the deposit still returns in full below.
    const bill = bills[index];
    const previousOffset = sanitizeMoney(bill.depositOffsetAmount);
    const newOffset = depRupees(Math.max(0, depCents(previousOffset) - depCents(share.amount)));
    bills[index] = {
      ...bill,
      depositOffsetAmount: newOffset,
      amountHistory: [
        ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
        {
          changedAt: `${date}T00:00`,
          type: 'deposit_offset_active_reversed',
          offsetId: entry.id,
          previousDepositOffset: previousOffset,
          depositOffset: newOffset,
          note: ACTIVE_DEPOSIT_OFFSET_REASON
        }
      ]
    };
  }
  const depositNow = normalizeCustodyFields(customer).securityDeposit ?? 0;
  return {
    ...customer,
    securityDeposit: depRupees(depCents(depositNow) + depCents(entry.amount)),
    bills,
    depositOffsets: entries.map((row) => (row.id === entry.id ? { ...row, reversedAt: date } : row))
  };
}
