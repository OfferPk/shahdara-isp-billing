/**
 * credit-transfer.js — SISP-111: Cross-Customer Advance Credit Transfer.
 *
 * A customer who overpaid holds ADVANCE CREDIT in this app, but that
 * credit is not a stored balance — the allocation engine
 * (core.js calculatePaymentAllocations) DERIVES it from the customer's
 * own payment records: whatever a receipt did not settle on its own
 * bills rides forward as pending credit, and the leftover is the
 * payment ledger's `unappliedCreditCents`. This module moves part of
 * that derived credit to a SECOND customer whose bill is still pending
 * — a family member paying for a relative, a shopkeeper covering a
 * neighbour — without any cash moving.
 *
 * The mechanism uses only records the existing engine already honours
 * (the SISP-50 deposit-offset seam, extended symmetrically):
 *
 *  - TARGET side: the amount is distributed over the target's pending
 *    bills, oldest month first, and stamped on each bill as
 *    `creditTransferInAmount` (+ reason / applied-at + an amountHistory
 *    audit entry per transfer). The engine subtracts it from the bill
 *    due right after the deposit offset, the Khata Doctor mirrors the
 *    same clamped subtraction, and receipt.js prints it as its own
 *    "Advance Credit Transfer" line. It is NOT a payment record, so
 *    cash collection, method totals, revenue aggregates and the
 *    roznamcha drawer never see it.
 *  - SOURCE side: the consumed credit is stamped on the source bills
 *    that generated it, as a `creditTransferOut` list of
 *    { transferId, paymentId, amount, date, toCustomerId } items —
 *    one item per source payment the transfer actually drew from
 *    (allocations name the exact payments holding unapplied credit).
 *    While deriving, the engine deducts each stamped item from that
 *    payment's pending-credit entry, so the transferred value can
 *    never be spent twice: later bills of the source only ever see
 *    what is left. The source's payment records themselves are never
 *    touched, and no charge is fabricated on the source.
 *
 * Every transfer is one register record (TRF-101+) in this module's
 * own store (localStorage key sisp_credit_transfers_v1; travels in
 * JSON backups as `settings.creditTransfers` under the house
 * safe-merge rule). Records are NEVER deleted: a reversal flips
 * `status` to 'reversed', stamps reversedAt, and removes exactly the
 * bill stamps the transfer wrote (the SISP-34 never-delete
 * discipline) — restoring both customers precisely.
 *
 * Guards (all refuse with a plain error, nothing half-written):
 * source ≠ target; both customers exist and are not archived; FREE
 * connections are refused on both sides (no credit / no dues by the
 * owner rule); amount must be > 0, no more than the source's LIVE
 * available credit (derived at transfer time, EXCLUDING credit still
 * reserved for a future month by advance month targeting — that
 * money is spoken for), and no more than the target's total pending
 * due (excess is refused, never clamped, so the register always
 * matches the stamps rupee for rupee).
 *
 * Reversal guards: only an 'active' transfer held by two still-live
 * customers can reverse, and only while every stamp it wrote is
 * still on the bills exactly as recorded — if the ledger changed
 * underneath (bill removed, stamp altered, source payment voided and
 * its stamp orphaned), the reversal refuses instead of guessing.
 *
 * This module imports only the language engine; customers,
 * allocations and persistence are passed in by callers (app.js
 * computes allocations over the live state), so every money rule
 * stays testable without the app. The modal controller at the bottom
 * needs a DOM and is inspection-verified, like the other modal
 * controllers.
 */

import { t } from './nav-language.js';

export const CREDIT_TRANSFERS_KEY = 'sisp_credit_transfers_v1';

/** Reason prefix stamped on target bills (the transfer id follows). */
export const CREDIT_TRANSFER_REASON = 'Advance credit transfer';

const ID_RE = /^TRF-(\d+)$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whole rupees grouped, e.g. 6500 -> "Rs. 6,500"; paise shown only when nonzero. */
export function formatTransferPKR(rupees) {
  const value = Number(rupees) || 0;
  return `Rs. ${value.toLocaleString('en-PK', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function rupeesOf(amount) {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function centsOf(rupees) {
  const n = Number(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidMonthKey(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/** Next register id: one above the highest TRF-N already stored (starts at 101). */
export function nextCreditTransferId(entries) {
  let max = 100;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const match = ID_RE.exec(String(entry?.transferId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `TRF-${max + 1}`;
}

function sanitizeShares(value, withPayment) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const share of value) {
    if (!share || typeof share !== 'object') continue;
    const amount = rupeesOf(share.amount);
    if (!(amount > 0) || !isValidMonthKey(share.month)) continue;
    if (withPayment) {
      const paymentId = cleanText(share.paymentId);
      if (!paymentId) continue;
      out.push({ paymentId, month: share.month, amount });
    } else {
      out.push({ month: share.month, amount });
    }
  }
  return out;
}

/** Drops malformed rows; keeps clean entries in stored order. */
export function sanitizeCreditTransfers(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const amount = rupeesOf(entry.amount);
    if (!(amount > 0)) continue;
    if (!isValidDateKey(entry.date)) continue;
    const fromCustomerId = cleanText(entry.fromCustomerId);
    const toCustomerId = cleanText(entry.toCustomerId);
    if (!fromCustomerId || !toCustomerId || fromCustomerId === toCustomerId) continue;
    const consumedFrom = sanitizeShares(entry.consumedFrom, true);
    const appliedTo = sanitizeShares(entry.appliedTo, false);
    if (!consumedFrom.length || !appliedTo.length) continue;
    out.push({
      transferId: ID_RE.test(String(entry.transferId || '')) ? String(entry.transferId) : '',
      fromCustomerId,
      fromCustomerNumber: Number.isSafeInteger(Number(entry.fromCustomerNumber)) && Number(entry.fromCustomerNumber) > 0 ? Number(entry.fromCustomerNumber) : null,
      fromCustomerName: cleanText(entry.fromCustomerName).slice(0, 100),
      toCustomerId,
      toCustomerNumber: Number.isSafeInteger(Number(entry.toCustomerNumber)) && Number(entry.toCustomerNumber) > 0 ? Number(entry.toCustomerNumber) : null,
      toCustomerName: cleanText(entry.toCustomerName).slice(0, 100),
      amount,
      date: entry.date,
      note: cleanText(entry.note).slice(0, 200),
      status: entry.status === 'reversed' ? 'reversed' : 'active',
      consumedFrom,
      appliedTo,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
      reversedAt: typeof entry.reversedAt === 'string' ? entry.reversedAt : '',
      reversalNote: cleanText(entry.reversalNote).slice(0, 200)
    });
  }
  // Fill in ids for rows that arrived without one, in stored order.
  let next = 101;
  const used = new Set(out.map((e) => e.transferId).filter(Boolean));
  for (const entry of out) {
    if (!entry.transferId) {
      while (used.has(`TRF-${next}`)) next++;
      entry.transferId = `TRF-${next}`;
      used.add(entry.transferId);
      next++;
    }
  }
  return out;
}

export function loadCreditTransfers(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(CREDIT_TRANSFERS_KEY);
    if (!raw) return [];
    return sanitizeCreditTransfers(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCreditTransfers(entries, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(CREDIT_TRANSFERS_KEY, JSON.stringify(sanitizeCreditTransfers(entries)));
    return true;
  } catch {
    return false;
  }
}

/** All transfers touching one customer (as source or target), newest first. */
export function transfersForCustomer(entries, customerId) {
  const id = String(customerId ?? '');
  return sanitizeCreditTransfers(entries)
    .filter((entry) => entry.fromCustomerId === id || entry.toCustomerId === id)
    .slice()
    .reverse();
}

/**
 * The source payments a transfer may draw from, read off a
 * calculatePaymentAllocations result: payment ledgers of this
 * customer still holding unapplied credit, EXCLUDING credit whose
 * advance-target reservation is still in the future at
 * `throughMonth` (the transfer month) — the same rule
 * billing-cycle.js arrearsAndAdvance applies for a cycle. Returned
 * in allocation order (bill month, then payment order = oldest
 * first). Amounts in cents.
 */
export function availableCreditSources(allocations, customerId, throughMonth) {
  const out = [];
  if (!allocations || typeof allocations.byPaymentId?.values !== 'function') return out;
  for (const ledger of allocations.byPaymentId.values()) {
    if (!ledger || String(ledger.customerId) !== String(customerId)) continue;
    if (!(ledger.unappliedCreditCents > 0)) continue;
    if (ledger.targetMonth && throughMonth && ledger.targetMonth > throughMonth) continue;
    out.push({
      paymentId: ledger.paymentId,
      month: ledger.originMonth,
      amountCents: ledger.unappliedCreditCents,
      targetMonth: ledger.targetMonth ?? null
    });
  }
  return out;
}

export function availableCreditCents(allocations, customerId, throughMonth) {
  return availableCreditSources(allocations, customerId, throughMonth)
    .reduce((sum, source) => sum + source.amountCents, 0);
}

/** The target's pending bills from an allocations result, oldest month first. */
export function pendingBillBalances(allocations, customer) {
  const out = [];
  if (!allocations || typeof allocations.forMonth !== 'function') return out;
  const bills = [...(Array.isArray(customer?.bills) ? customer.bills : [])]
    .filter((bill) => bill && isValidMonthKey(bill.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const bill of bills) {
    const summary = allocations.forMonth(customer.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      out.push({ month: bill.month, balanceDueCents: summary.balanceDueCents });
    }
  }
  return out;
}

function billHistoryEntry(date, fields) {
  return { changedAt: `${date}T00:00`, ...fields };
}

/**
 * Executes one cross-customer credit transfer. PURE: the customers
 * and the allocations snapshot are inputs; the caller (app.js)
 * persists the returned customers + register. The allocations
 * snapshot must be current (computed over the live state) — the
 * guards below are only as honest as that snapshot, so app.js
 * computes it in the same click that calls this.
 *
 * Returns { fromCustomer, toCustomer, transfers, transfer } with
 * both customers NEW objects (inputs never mutated). Throws a plain
 * Error on every refusal; on a throw nothing is returned and no
 * stamp has been written anywhere.
 */
export function executeCreditTransfer({ fromCustomer, toCustomer, allocations, transfers = [], amount, date, note = '', createdAt = '' } = {}) {
  if (!fromCustomer || !toCustomer) throw new Error('Both the source and the target customer are required.');
  if (String(fromCustomer.id) === String(toCustomer.id)) throw new Error('Source and target must be different customers.');
  if (fromCustomer.archived) throw new Error('Archived customers hold no transferable credit. Unarchive the customer first.');
  if (toCustomer.archived) throw new Error('Archived customers cannot receive a credit transfer. Unarchive the customer first.');
  if (fromCustomer.isFreeConnection) throw new Error('Free connections hold no advance credit to transfer.');
  if (toCustomer.isFreeConnection) throw new Error('Free connections never carry a pending bill to settle.');
  if (!isValidDateKey(date)) throw new Error('Enter a valid transfer date.');
  const amountRupees = rupeesOf(amount);
  if (!(amountRupees > 0)) throw new Error('Amount must be greater than zero.');
  const amountCents = centsOf(amountRupees);
  const transferMonth = date.slice(0, 7);

  const sources = availableCreditSources(allocations, fromCustomer.id, transferMonth);
  const availableCents = sources.reduce((sum, s) => sum + s.amountCents, 0);
  if (amountCents > availableCents) {
    throw new Error(`Amount exceeds the available advance credit (${formatTransferPKR(availableCents / 100)}). Credit reserved for a future month cannot be transferred.`);
  }
  const targets = pendingBillBalances(allocations, toCustomer);
  const dueCents = targets.reduce((sum, b) => sum + b.balanceDueCents, 0);
  if (dueCents <= 0) throw new Error('The target customer has no pending bill to settle.');
  if (amountCents > dueCents) {
    throw new Error(`Amount exceeds the target's pending due (${formatTransferPKR(dueCents / 100)}). Transfer a smaller amount.`);
  }

  const clean = sanitizeCreditTransfers(transfers);
  const transferId = nextCreditTransferId(clean);

  // Draw the amount from the source payments, oldest first.
  let remaining = amountCents;
  const consumedFrom = [];
  for (const source of sources) {
    if (remaining <= 0) break;
    const take = Math.min(source.amountCents, remaining);
    if (take <= 0) continue;
    consumedFrom.push({ paymentId: source.paymentId, month: source.month, amount: take / 100 });
    remaining -= take;
  }
  // Satisfy the target's pending bills, oldest month first.
  remaining = amountCents;
  const appliedTo = [];
  for (const target of targets) {
    if (remaining <= 0) break;
    const share = Math.min(target.balanceDueCents, remaining);
    if (share <= 0) continue;
    appliedTo.push({ month: target.month, amount: share / 100 });
    remaining -= share;
  }

  const reason = `${CREDIT_TRANSFER_REASON} ${transferId} — #${fromCustomer.customerNumber ?? ''} ${fromCustomer.name ?? ''} → #${toCustomer.customerNumber ?? ''} ${toCustomer.name ?? ''}`.slice(0, 200);

  const consumedByMonth = new Map();
  for (const share of consumedFrom) {
    if (!consumedByMonth.has(share.month)) consumedByMonth.set(share.month, []);
    consumedByMonth.get(share.month).push(share);
  }
  const updatedFrom = {
    ...fromCustomer,
    bills: (Array.isArray(fromCustomer.bills) ? fromCustomer.bills : []).map((bill) => {
      const shares = bill ? consumedByMonth.get(bill.month) : null;
      if (!shares || !shares.length) return bill;
      const total = shares.reduce((sum, s) => sum + centsOf(s.amount), 0) / 100;
      return {
        ...bill,
        creditTransferOut: [
          ...(Array.isArray(bill.creditTransferOut) ? bill.creditTransferOut : []),
          ...shares.map((s) => ({
            transferId,
            paymentId: s.paymentId,
            amount: s.amount,
            date,
            toCustomerId: String(toCustomer.id)
          }))
        ],
        amountHistory: [
          ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
          billHistoryEntry(date, {
            type: 'credit_transfer_out',
            transferId,
            amount: total,
            toCustomerId: String(toCustomer.id),
            toCustomerNumber: toCustomer.customerNumber ?? null,
            note: reason
          })
        ]
      };
    })
  };

  const appliedByMonth = new Map(appliedTo.map((share) => [share.month, share.amount]));
  const updatedTo = {
    ...toCustomer,
    bills: (Array.isArray(toCustomer.bills) ? toCustomer.bills : []).map((bill) => {
      if (!bill || !appliedByMonth.has(bill.month)) return bill;
      const share = appliedByMonth.get(bill.month);
      const previous = rupeesOf(bill.creditTransferInAmount || 0);
      const next = rupeesOf(previous + share);
      return {
        ...bill,
        creditTransferInAmount: next,
        creditTransferInReason: reason,
        creditTransferInAppliedAt: date,
        amountHistory: [
          ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
          billHistoryEntry(date, {
            type: 'credit_transfer_in',
            transferId,
            amount: share,
            previousCreditTransferIn: previous,
            creditTransferIn: next,
            fromCustomerId: String(fromCustomer.id),
            fromCustomerNumber: fromCustomer.customerNumber ?? null,
            note: reason
          })
        ]
      };
    })
  };

  const record = {
    transferId,
    fromCustomerId: String(fromCustomer.id),
    fromCustomerNumber: fromCustomer.customerNumber ?? null,
    fromCustomerName: String(fromCustomer.name || ''),
    toCustomerId: String(toCustomer.id),
    toCustomerNumber: toCustomer.customerNumber ?? null,
    toCustomerName: String(toCustomer.name || ''),
    amount: amountRupees,
    date,
    note: cleanText(note).slice(0, 200),
    status: 'active',
    consumedFrom,
    appliedTo,
    createdAt: typeof createdAt === 'string' && createdAt ? createdAt : new Date().toISOString(),
    reversedAt: '',
    reversalNote: ''
  };
  return { fromCustomer: updatedFrom, toCustomer: updatedTo, transfers: [...clean, record], transfer: record };
}

/**
 * Reverses one active transfer by removing exactly the bill stamps
 * it wrote and flipping its register status (the record itself is
 * kept forever, SISP-34 style). PURE — same input/output discipline
 * as executeCreditTransfer. Refuses when the transfer is not
 * active, either customer is archived, or any recorded stamp is no
 * longer on the bills exactly as written (bill removed, stamp
 * altered, or the source payment was voided so the derivation no
 * longer lines up) — in that case a human must reconcile by hand
 * rather than the app guessing.
 */
export function reverseCreditTransfer({ transfers = [], transferId, fromCustomer, toCustomer, date, note = '' } = {}) {
  const clean = sanitizeCreditTransfers(transfers);
  const record = clean.find((entry) => entry.transferId === String(transferId));
  if (!record) throw new Error('Credit transfer not found.');
  if (record.status !== 'active') throw new Error(`Transfer ${record.transferId} is already reversed.`);
  if (!fromCustomer || String(fromCustomer.id) !== record.fromCustomerId) throw new Error('The source customer record is missing or does not match the transfer.');
  if (!toCustomer || String(toCustomer.id) !== record.toCustomerId) throw new Error('The target customer record is missing or does not match the transfer.');
  if (fromCustomer.archived || toCustomer.archived) throw new Error('A transfer involving an archived customer cannot be reversed here. Unarchive the customer first.');
  if (!isValidDateKey(date)) throw new Error('Enter a valid reversal date.');

  const fromBills = Array.isArray(fromCustomer.bills) ? fromCustomer.bills : [];
  for (const share of record.consumedFrom) {
    const bill = fromBills.find((b) => b && b.month === share.month);
    const item = (Array.isArray(bill?.creditTransferOut) ? bill.creditTransferOut : [])
      .find((i) => i && i.transferId === record.transferId && String(i.paymentId) === String(share.paymentId) && centsOf(i.amount) === centsOf(share.amount));
    if (!item) throw new Error(`The source stamp of ${record.transferId} on bill ${share.month} is no longer recorded exactly — reversal refused so nothing is half-restored.`);
  }
  const toBills = Array.isArray(toCustomer.bills) ? toCustomer.bills : [];
  for (const share of record.appliedTo) {
    const bill = toBills.find((b) => b && b.month === share.month);
    if (!bill || centsOf(bill.creditTransferInAmount || 0) < centsOf(share.amount)) {
      throw new Error(`The target stamp of ${record.transferId} on bill ${share.month} no longer covers the recorded share — reversal refused so nothing is half-restored.`);
    }
  }

  const consumedMonths = new Set(record.consumedFrom.map((s) => s.month));
  const updatedFrom = {
    ...fromCustomer,
    bills: fromBills.map((bill) => {
      if (!bill || !consumedMonths.has(bill.month)) return bill;
      const kept = (Array.isArray(bill.creditTransferOut) ? bill.creditTransferOut : [])
        .filter((i) => !(i && i.transferId === record.transferId));
      const next = {
        ...bill,
        amountHistory: [
          ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
          billHistoryEntry(date, {
            type: 'credit_transfer_reversed_out',
            transferId: record.transferId,
            amount: record.consumedFrom.filter((s) => s.month === bill.month).reduce((sum, s) => sum + centsOf(s.amount), 0) / 100,
            note: `Reversal of ${record.transferId}`
          })
        ]
      };
      if (kept.length) next.creditTransferOut = kept;
      else delete next.creditTransferOut;
      return next;
    })
  };

  const appliedByMonth = new Map(record.appliedTo.map((share) => [share.month, share.amount]));
  const updatedTo = {
    ...toCustomer,
    bills: toBills.map((bill) => {
      if (!bill || !appliedByMonth.has(bill.month)) return bill;
      const share = appliedByMonth.get(bill.month);
      const nextAmount = rupeesOf(rupeesOf(bill.creditTransferInAmount || 0) - share);
      const next = {
        ...bill,
        amountHistory: [
          ...(Array.isArray(bill.amountHistory) ? bill.amountHistory : []),
          billHistoryEntry(date, {
            type: 'credit_transfer_reversed_in',
            transferId: record.transferId,
            amount: share,
            note: `Reversal of ${record.transferId}`
          })
        ]
      };
      if (nextAmount > 0) {
        next.creditTransferInAmount = nextAmount;
      } else {
        delete next.creditTransferInAmount;
        delete next.creditTransferInReason;
        delete next.creditTransferInAppliedAt;
      }
      return next;
    })
  };

  const updatedRecord = {
    ...record,
    status: 'reversed',
    reversedAt: date,
    reversalNote: cleanText(note).slice(0, 200)
  };
  return {
    fromCustomer: updatedFrom,
    toCustomer: updatedTo,
    transfers: clean.map((entry) => (entry.transferId === record.transferId ? updatedRecord : entry)),
    transfer: updatedRecord
  };
}

/** Register totals for summaries (active value moved / reversed count). */
export function creditTransferSummary(entries) {
  const clean = sanitizeCreditTransfers(entries);
  const sum = (list) => Math.round(list.reduce((s, e) => s + e.amount, 0) * 100) / 100;
  const active = clean.filter((e) => e.status === 'active');
  const reversed = clean.filter((e) => e.status === 'reversed');
  return {
    totalCount: clean.length,
    activeCount: active.length,
    activeAmount: sum(active),
    reversedCount: reversed.length,
    reversedAmount: sum(reversed)
  };
}

/**
 * Transfer dialog controller (DOM; inspection-verified like the
 * other modal controllers). Deps injected by app.js:
 *   getState() -> the live app state
 *   allocationsFor(state) -> a fresh calculatePaymentAllocations result
 *   getTransfers() -> the register (sanitized)
 *   executeTransfer({ fromId, toId, amount, date, note }) -> record (throws; app persists + rerenders + toasts)
 *   executeReversal(transferId) -> record (throws; app persists + rerenders + toasts)
 *   confirmAction({ title, message, confirmLabel }) -> Promise<boolean>
 *   today() -> 'YYYY-MM-DD'
 * open(customerId) opens the dialog with that customer as the source.
 */
export function setupCreditTransferModal(getState, deps = {}) {
  const dialog = document.getElementById('creditTransferModal');
  if (!dialog) return null;
  const els = {
    sourceNote: document.getElementById('creditTransferSourceNote'),
    availableNote: document.getElementById('creditTransferAvailableNote'),
    target: document.getElementById('creditTransferTarget'),
    targetDue: document.getElementById('creditTransferTargetDue'),
    amount: document.getElementById('creditTransferAmount'),
    date: document.getElementById('creditTransferDate'),
    note: document.getElementById('creditTransferNote'),
    error: document.getElementById('creditTransferError'),
    form: document.getElementById('creditTransferForm'),
    history: document.getElementById('creditTransferHistory'),
    closeBtn: document.getElementById('creditTransferCloseBtn')
  };
  let sourceId = null;

  const stateCustomers = () => (Array.isArray(getState()?.customers) ? getState().customers : []);
  const source = () => stateCustomers().find((c) => String(c.id) === String(sourceId)) || null;

  function availability() {
    const allocations = deps.allocationsFor(getState());
    const month = String(els.date?.value || deps.today()).slice(0, 7);
    return { allocations, cents: availableCreditCents(allocations, sourceId, month) };
  }

  function targetOptions(allocations) {
    return stateCustomers()
      .filter((c) => c && String(c.id) !== String(sourceId) && !c.archived && !c.isFreeConnection)
      .map((customer) => ({ customer, dueCents: pendingBillBalances(allocations, customer).reduce((s, b) => s + b.balanceDueCents, 0) }))
      .filter((row) => row.dueCents > 0)
      .sort((a, b) => (a.customer.customerNumber ?? 0) - (b.customer.customerNumber ?? 0));
  }

  function refresh() {
    const from = source();
    if (!from) return;
    const { allocations, cents } = availability();
    if (els.sourceNote) els.sourceNote.textContent = t('trf_source_label', null, { name: from.name || '', number: from.customerNumber ?? '' });
    if (els.availableNote) els.availableNote.textContent = t('trf_available', null, { amount: formatTransferPKR(cents / 100) });
    const options = targetOptions(allocations);
    if (els.target) {
      const previous = els.target.value;
      els.target.innerHTML = `<option value="">${escapeHtml(t('trf_pick_target'))}</option>` + options.map((row) =>
        `<option value="${escapeHtml(String(row.customer.id))}">#${row.customer.customerNumber ?? ''} ${escapeHtml(row.customer.name || '')} — ${escapeHtml(t('trf_due_label', null, { amount: formatTransferPKR(row.dueCents / 100) }))}</option>`).join('');
      if (options.some((row) => String(row.customer.id) === previous)) els.target.value = previous;
      els.target.disabled = options.length === 0;
    }
    if (els.targetDue) {
      els.targetDue.textContent = options.length === 0 ? t('trf_no_targets') : '';
    }
    renderHistory();
  }

  function renderHistory() {
    if (!els.history) return;
    const rows = transfersForCustomer(deps.getTransfers(), sourceId);
    if (!rows.length) {
      els.history.innerHTML = `<p class="credit-transfer-empty">${escapeHtml(t('trf_none'))}</p>`;
      return;
    }
    els.history.innerHTML = rows.map((entry) => {
      const outgoing = entry.fromCustomerId === String(sourceId);
      const label = outgoing
        ? t('trf_out_label', null, { name: entry.toCustomerName, number: entry.toCustomerNumber ?? '' })
        : t('trf_in_label', null, { name: entry.fromCustomerName, number: entry.fromCustomerNumber ?? '' });
      const status = entry.status === 'reversed' ? ` · ${t('trf_reversed_badge')}` : '';
      const reverseBtn = entry.status === 'active'
        ? `<button type="button" class="secondary-button" data-trf-reverse="${escapeHtml(entry.transferId)}">${escapeHtml(t('trf_reverse_btn'))}</button>`
        : '';
      return `<div class="credit-transfer-row"><span>${escapeHtml(entry.transferId)} · ${escapeHtml(label)} · <strong>${escapeHtml(formatTransferPKR(entry.amount))}</strong> · ${escapeHtml(entry.date)}${escapeHtml(status)}</span>${reverseBtn}</div>`;
    }).join('');
    els.history.querySelectorAll('[data-trf-reverse]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const transferId = btn.getAttribute('data-trf-reverse');
        const ok = await deps.confirmAction({
          title: t('trf_reverse_btn'),
          message: t('trf_reverse_confirm', null, { id: transferId }),
          confirmLabel: t('trf_reverse_btn')
        });
        if (!ok) return;
        try {
          await deps.executeReversal(transferId);
          refresh();
        } catch (err) {
          if (els.error) els.error.textContent = err?.message || String(err);
        }
      });
    });
  }

  function open(customerId) {
    sourceId = customerId;
    if (els.date && !els.date.value) els.date.value = deps.today();
    if (els.amount) els.amount.value = '';
    if (els.note) els.note.value = '';
    if (els.error) els.error.textContent = '';
    refresh();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  if (els.closeBtn) els.closeBtn.addEventListener('click', () => dialog.close());
  if (els.date) els.date.addEventListener('change', refresh);
  if (els.form) {
    els.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (els.error) els.error.textContent = '';
      try {
        await deps.executeTransfer({
          fromId: sourceId,
          toId: els.target?.value || '',
          amount: Number(els.amount?.value),
          date: els.date?.value || deps.today(),
          note: els.note?.value || ''
        });
        dialog.close();
      } catch (err) {
        if (els.error) els.error.textContent = err?.message || String(err);
      }
    });
  }

  return { open, refresh };
}
