/**
 * bad-debt-ledger.js — SISP-64: Churned Customer Bad-Debt Write-Off &
 * Reconnection Guard ("ناقابلِ وصول بقایا معافی اور بحالی گارڈ").
 *
 * A customer who leaves for good (archived) often leaves an unpaid
 * balance behind. Until now that balance stayed in the collectible
 * arrears pool forever, inflating collection targets, the collection
 * forecaster and defaulter follow-ups with money nobody will ever pay.
 * The 1-click "Write Off as Uncollectible Bad Debt" on an ARCHIVED
 * customer's profile moves the whole unpaid balance into this register:
 *
 *  - Each affected bill is stamped with audited fields
 *    (badDebtWriteOffAmount + badDebtWriteOffReason + badDebtWriteOffAt
 *    plus an amountHistory entry), mirroring the SISP-50 deposit-offset
 *    shape. core.js calculatePaymentAllocations subtracts the stamp
 *    before advance credit and receipts apply, so the engine balance —
 *    and with it the forecaster target, defaulter lists and the Khata
 *    Doctor — stops counting the written-off money. The customer's
 *    receipts are NEVER touched: a write-off waives a due, it does not
 *    pretend a payment happened.
 *  - One register entry per write-off lives here (localStorage key
 *    sisp_bad_debts_v1): { badDebtId, customerId, customerNumber,
 *    amount, bills: [{ month, amount }], writeOffDate, writeOffReason,
 *    status, restoredAt }. Its amount is exactly the sum of its bill
 *    shares, which is exactly what was stamped — the record always
 *    reconciles with the ledger.
 *  - Reconnection guard: un-archiving the customer finds the still
 *    active entry and offers the one-shot restore, which removes the
 *    stamps by exactly the recorded shares and flips the entry to
 *    status 'restored' (audit kept). A restored entry can never be
 *    restored again, and a customer with an active write-off can never
 *    be written off twice.
 *
 * Backup: entries travel in the JSON backup `settings.badDebts`
 * section (see core.js), under the same safe-merge rule as suspense
 * payments and referral credits: adopted only when this device has
 * none stored yet.
 *
 * This module imports nothing: customers, entries and storage are
 * passed in by callers, so the pure helpers stay testable without the
 * app and core.js can import the sanitizer without a module cycle.
 */

export const BAD_DEBTS_KEY = 'sisp_bad_debts_v1';

/** Reason stamped when the operator leaves the reason field blank. */
export const DEFAULT_BAD_DEBT_REASON = 'Uncollectible — customer churned';

const ID_RE = /^BD-(\d+)$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['written-off', 'restored']);

const cents = (value) => Math.round(Number(value) * 100);
const rupees = (centsValue) => centsValue / 100;

function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return rupees(cents(n));
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Next entry id: one above the highest BD-N already stored (starts at 101). */
export function nextBadDebtId(entries) {
  let max = 100;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const match = ID_RE.exec(String(entry?.badDebtId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `BD-${max + 1}`;
}

function sanitizeBillShares(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seenMonths = new Set();
  for (const row of value) {
    if (!row || typeof row !== 'object' || !MONTH_RE.test(String(row.month ?? ''))) continue;
    const month = String(row.month);
    if (seenMonths.has(month)) continue;
    const amount = cleanAmount(row.amount);
    if (!(amount > 0)) continue;
    seenMonths.add(month);
    out.push({ month, amount });
  }
  return out.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Drops malformed rows; keeps clean entries in stored order. The entry
 * amount is recomputed from its bill shares whenever shares exist, so
 * a stored total can never drift from its parts. At most ONE active
 * ('written-off') entry per customer survives — the first one wins,
 * exactly like the one-shot guard the write-off itself enforces.
 */
export function sanitizeBadDebts(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seenIds = new Set();
  const activeCustomers = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const badDebtId = cleanText(entry.badDebtId, 32);
    if (!ID_RE.test(badDebtId) || seenIds.has(badDebtId)) continue;
    const customerId = cleanText(entry.customerId, 128);
    if (!customerId) continue;
    const bills = sanitizeBillShares(entry.bills);
    const amount = bills.length
      ? rupees(bills.reduce((sum, row) => sum + cents(row.amount), 0))
      : cleanAmount(entry.amount);
    if (!(amount > 0)) continue;
    const status = STATUSES.has(entry.status) ? entry.status : 'written-off';
    if (status === 'written-off') {
      if (activeCustomers.has(customerId)) continue;
      activeCustomers.add(customerId);
    }
    seenIds.add(badDebtId);
    out.push({
      badDebtId,
      customerId,
      customerNumber: Number.isSafeInteger(Number(entry.customerNumber)) && Number(entry.customerNumber) > 0 ? Number(entry.customerNumber) : null,
      amount,
      bills,
      writeOffDate: isValidDateString(entry.writeOffDate) ? entry.writeOffDate : '',
      writeOffReason: cleanText(entry.writeOffReason),
      status,
      restoredAt: status === 'restored' && isValidDateString(entry.restoredAt) ? entry.restoredAt : ''
    });
  }
  return out;
}

export function loadBadDebts(storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(BAD_DEBTS_KEY);
    if (!raw) return [];
    return sanitizeBadDebts(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveBadDebts(entries, storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return;
  store.setItem(BAD_DEBTS_KEY, JSON.stringify(sanitizeBadDebts(entries)));
}

// ---------------------------------------------------------------- lookups
/** The still-active (unrestored) write-off for one customer, or null. */
export function activeBadDebtFor(entries, customerId) {
  return (Array.isArray(entries) ? entries : [])
    .find((entry) => entry?.customerId === customerId && entry.status === 'written-off') ?? null;
}

/** Every register entry for one customer (active + restored history). */
export function badDebtEntriesForCustomer(entries, customerId) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => entry?.customerId === customerId);
}

/** Register totals for the Owner Khata: money still written off vs
 * money that came back through a reconnection restore. */
export function badDebtSummary(entries) {
  let activeCents = 0;
  let activeCount = 0;
  let restoredCents = 0;
  let restoredCount = 0;
  for (const entry of sanitizeBadDebts(entries)) {
    if (entry.status === 'written-off') {
      activeCents += cents(entry.amount);
      activeCount++;
    } else {
      restoredCents += cents(entry.amount);
      restoredCount++;
    }
  }
  return {
    activeTotal: rupees(activeCents),
    activeCount,
    restoredTotal: rupees(restoredCents),
    restoredCount
  };
}

// ---------------------------------------------------------------- write-off
/**
 * Eligibility for the 1-click write-off. Pure: the money itself is
 * decided by the caller's engine snapshot (unpaidArrears), exactly
 * like the SISP-50 deposit quote — this only judges the record.
 */
export function badDebtWriteOffQuote(customer, entries, unpaidArrears = 0) {
  const arrears = cleanAmount(unpaidArrears);
  const active = customer ? activeBadDebtFor(entries, customer.id) : null;
  const reason = !customer || typeof customer !== 'object' ? 'no-customer'
    : customer.archived !== true ? 'not-archived'
      : active ? 'already-written-off'
        : !(arrears > 0) ? 'no-balance'
          : null;
  return {
    eligible: reason === null,
    reason,
    activeEntry: active,
    amount: reason === null ? arrears : 0
  };
}

/**
 * Write off an archived customer's whole unpaid balance. billBalances
 * = [{ month, balanceDue }] from the caller's FRESH allocation-engine
 * snapshot (the same snapshot the profile renders); the total is
 * distributed oldest month first and each bill's share is clamped to
 * that bill's balance, so the recorded write-off is exactly what was
 * stamped even if the snapshot was stale. Pure: returns the next
 * register + the next customer; inputs are never mutated. Throws on
 * an ineligible customer so the UI can never record a meaningless or
 * duplicate write-off.
 */
export function writeOffBadDebt(entries, customer, billBalances, { date, reason = '' } = {}) {
  if (!isValidDateString(date)) throw new Error('Enter a valid write-off date.');
  const ordered = [...(Array.isArray(billBalances) ? billBalances : [])]
    .filter((row) => row && MONTH_RE.test(String(row.month ?? '')) && cleanAmount(row.balanceDue) > 0)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const totalCents = ordered.reduce((sum, row) => sum + cents(row.balanceDue), 0);
  const quote = badDebtWriteOffQuote(customer, entries, rupees(totalCents));
  if (!quote.eligible) {
    throw new Error(quote.reason === 'already-written-off'
      ? 'This customer already has an active bad-debt write-off.'
      : quote.reason === 'not-archived'
        ? 'Only an archived (churned) customer can be written off as bad debt.'
        : quote.reason === 'no-balance'
          ? 'This customer has no unpaid balance to write off.'
          : 'Customer not found.');
  }
  const cleanReason = cleanText(reason) || DEFAULT_BAD_DEBT_REASON;
  const badDebtId = nextBadDebtId(entries);
  let remainingC = totalCents;
  const shares = [];
  const bills = (Array.isArray(customer.bills) ? customer.bills : []).map((bill) => ({ ...bill }));
  for (const row of ordered) {
    if (remainingC <= 0) break;
    const index = bills.findIndex((bill) => bill && bill.month === row.month);
    if (index < 0) continue;
    const shareC = Math.min(remainingC, cents(row.balanceDue));
    if (shareC <= 0) continue;
    const share = rupees(shareC);
    const bill = bills[index];
    const previousWriteOff = cleanAmount(bill.badDebtWriteOffAmount);
    const newWriteOff = rupees(cents(previousWriteOff) + shareC);
    bills[index] = {
      ...bill,
      badDebtWriteOffAmount: newWriteOff,
      badDebtWriteOffReason: cleanReason,
      badDebtWriteOffAt: date,
      amountHistory: [
        ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
        {
          changedAt: `${date}T00:00`,
          type: 'bad_debt_write_off',
          badDebtId,
          previousBadDebtWriteOff: previousWriteOff,
          badDebtWriteOff: newWriteOff,
          note: cleanReason
        }
      ]
    };
    shares.push({ month: String(row.month), amount: share });
    remainingC -= shareC;
  }
  const appliedCents = totalCents - remainingC;
  if (appliedCents <= 0) throw new Error('This customer has no unpaid balance to write off.');
  const entry = {
    badDebtId,
    customerId: customer.id,
    customerNumber: Number.isSafeInteger(Number(customer.customerNumber)) && Number(customer.customerNumber) > 0 ? Number(customer.customerNumber) : null,
    amount: rupees(appliedCents),
    bills: shares,
    writeOffDate: date,
    writeOffReason: cleanReason,
    status: 'written-off',
    restoredAt: ''
  };
  return {
    entries: sanitizeBadDebts([...(Array.isArray(entries) ? entries : []), entry]),
    customer: { ...customer, bills },
    entry
  };
}

// ---------------------------------------------------------------- restore
/**
 * The reconnection guard's restore: remove one customer's active
 * write-off stamps by exactly the recorded shares (each clamped to
 * what is actually stamped, so a tampered bill can never resurrect
 * more than was waived) and flip the entry to 'restored' with the
 * restore date. Pure. One-shot by construction: with no active entry
 * it throws, so a balance can never be restored twice.
 */
export function restoreBadDebt(entries, customer, { date } = {}) {
  if (!isValidDateString(date)) throw new Error('Enter a valid restore date.');
  if (!customer || typeof customer !== 'object') throw new Error('Customer not found.');
  const active = activeBadDebtFor(entries, customer.id);
  if (!active) throw new Error('This customer has no active bad-debt write-off to restore.');
  const shareByMonth = new Map(active.bills.map((row) => [row.month, cents(row.amount)]));
  let restoredCents = 0;
  const bills = (Array.isArray(customer.bills) ? customer.bills : []).map((bill) => {
    if (!bill || !shareByMonth.has(bill.month)) return bill;
    const stampedC = cents(cleanAmount(bill.badDebtWriteOffAmount));
    const restoreC = Math.min(shareByMonth.get(bill.month), stampedC);
    if (restoreC <= 0) return bill;
    restoredCents += restoreC;
    const remaining = rupees(stampedC - restoreC);
    return {
      ...bill,
      badDebtWriteOffAmount: remaining,
      amountHistory: [
        ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
        {
          changedAt: `${date}T00:00`,
          type: 'bad_debt_restored',
          badDebtId: active.badDebtId,
          previousBadDebtWriteOff: rupees(stampedC),
          badDebtWriteOff: remaining,
          note: active.writeOffReason
        }
      ]
    };
  });
  const nextEntries = sanitizeBadDebts((Array.isArray(entries) ? entries : []).map((entry) =>
    entry.badDebtId === active.badDebtId ? { ...entry, status: 'restored', restoredAt: date } : entry));
  return {
    entries: nextEntries,
    customer: { ...customer, bills },
    entry: nextEntries.find((entry) => entry.badDebtId === active.badDebtId) ?? null,
    restoredAmount: rupees(restoredCents)
  };
}
