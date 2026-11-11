/* Clear All Record — pure payment wipe (Mohalla Seed item, Option A).
 *
 * Scope (owner decision, Option A): wipe payments + payment-derived
 * records ONLY. Bills become unpaid again; everything else stays.
 *
 * What is wiped:
 *   - Every `customer.bills[].payments` entry, all customers, all
 *     months. Advance/prepay payments live inside bills too (kind
 *     ADVANCE_PAYMENT_KIND) and go with them. There is no bare
 *     `shahdara_advance` key in this codebase — the separate advance
 *     stores are the allocations + expiry lists below.
 *   - `manualBaqaya` settlement lines ride the payment itself
 *     (core.js: a payment carries `manualBaqayaSettlements`), so
 *     they disappear with the payment. The manualBaqaya DUES stay
 *     outstanding — they are dues, not payments.
 *   - The satellite array stores in CLEAR_PAYMENT_RECORD_STORES
 *     (queued / orphan / in-flight payments, receipt artefacts of
 *     wiped payments, advance allocations + expiry, wallet-inbox
 *     items). Each is cleared to an empty array.
 *
 * What is NEVER touched:
 *   - Customers, bills, Waada/promises, complaints/tickets,
 *     settings (including the `defaultCustomersImport` marker),
 *     coverage estimates, inventory, expenses, monthly closings,
 *     collector settlements + daily cash handovers, receipt books /
 *     series + numbering, bill reissues — and ALL audit trails.
 *   - Void payments: the void audit trail lives in
 *     `sisp_voided_payments_v1` (VOIDED_PAYMENTS_KEY) and in the
 *     audit log — neither is in the wipe list, so the trail
 *     survives. The voided STUBS inside bill.payments arrays ARE
 *     wiped with the bill's array (they are payment records), but
 *     the counter never counts them: a voided payment is history,
 *     not live money (payment-void-audit.js: voided payments are
 *     NEVER live money, and all money derivations skip them). So
 *     the preview's payments / customers / total / bills-becoming-
 *     unpaid are all live (non-voided) only — a bill whose only
 *     payment is a voided stub is already unpaid, never "becoming"
 *     unpaid.
 *   - `localStorage.clear()` is never used: this is an in-app state
 *     transformation, persisted through the normal save path.
 *
 * Shape rules (mirrors customer-history-purge.js): a store whose
 * value is not an array is left exactly as it was — the wipe never
 * guesses. `billsBecomingUnpaid` counts bills with at least one
 * LIVE payment AND a positive due (an unpriced bill has no due to
 * become unpaid). `totalCents` is the NET sum of LIVE payments
 * only (reversal payments are negative and reduce the total
 * honestly).
 *
 * This module is pure and import-free by design: no DOM, no
 * storage, no clock, no mutation of its inputs. The storage
 * wrappers at the bottom do the localStorage IO for the dialog
 * glue in app.js.
 */

export const CLEAR_PAYMENT_RECORD_STORES = Object.freeze([
  // Queued / orphan / in-flight payments.
  'shahdara_offline_payment_queue',
  'shahdara_orphan_payments_v1',
  'shahdara_payment_claims_v1',
  'shahdara_payment_clearance_v1',
  'shahdara_part_payment_allocations_v1',
  'shahdara_part_payment_receipt_notes_v1',
  // Receipt artefacts of wiped payments (books/series/numbering kept).
  'shahdara_receipts_shared_v1',
  'shahdara_receipt_reprints_v1',
  'shahdara_split_receipts_v1',
  'shahdara_document_receipts_v1',
  'shahdara_receipt_gap_explanations_v1',
  // Advance / prepay derived from payments (no bare shahdara_advance key).
  'shahdara_advance_allocations_v1',
  'shahdara_advance_expiry_v1',
  // Wallet inbox items (inbox settings live under their own key: kept).
  'easypaisaInbox.items'
]);

const moneyCents = value => Math.round(Number(value || 0) * 100);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function billsOf(customer) {
  return Array.isArray(customer?.bills) ? customer.bills : [];
}

function paymentsOf(bill) {
  return Array.isArray(bill?.payments) ? bill.payments : [];
}

// Live payments only: a voided stub (voided: true) is history, not
// live money — the counter never counts it (see the header). The
// wiper still removes the stub with the bill's array.
function livePaymentsOf(bill) {
  return paymentsOf(bill).filter((payment) => payment && payment.voided !== true);
}

/**
 * Count what a wipe would remove, from the live state + the parsed
 * satellite stores. Pure: nothing is changed.
 * @returns {{ payments: number, customers: number, totalCents: number,
 *   billsBecomingUnpaid: number, satelliteCounts: Object }}
 */
export function countPaymentRecords(state, stores = {}) {
  const source = isObject(stores) ? stores : {};
  let payments = 0;
  let totalCents = 0;
  let billsBecomingUnpaid = 0;
  const customersWithPayments = new Set();
  const list = Array.isArray(state?.customers) ? state.customers : [];
  for (const customer of list) {
    for (const bill of billsOf(customer)) {
      const entries = livePaymentsOf(bill);
      if (!entries.length) continue;
      payments += entries.length;
      customersWithPayments.add(customer?.id ?? '');
      for (const payment of entries) totalCents += moneyCents(payment?.amount);
      if (Number(bill?.dueAmount) > 0) billsBecomingUnpaid += 1;
    }
  }
  const satelliteCounts = {};
  for (const key of CLEAR_PAYMENT_RECORD_STORES) {
    if (!(key in source)) continue;
    const value = source[key];
    satelliteCounts[key] = Array.isArray(value) ? value.length : 0;
  }
  return {
    payments,
    customers: customersWithPayments.size,
    totalCents,
    billsBecomingUnpaid,
    satelliteCounts
  };
}

/**
 * Wipe payments + payment-derived records. Returns the next state
 * (bills present but with empty payments; everything else
 * byte-identical), the next satellite stores (array stores cleared
 * to []; absent keys stay absent; non-array values pass through
 * untouched), and the `result` counts measured on the BEFORE state
 * so the dialog can report exactly what was removed. Pure: inputs
 * are never mutated.
 */
export function clearPaymentRecords(state, stores = {}) {
  const source = isObject(stores) ? stores : {};
  const result = countPaymentRecords(state, source);
  const nextStores = { ...source };
  for (const key of CLEAR_PAYMENT_RECORD_STORES) {
    if (!(key in source)) continue;
    if (Array.isArray(source[key])) nextStores[key] = [];
  }
  if (!state || typeof state !== 'object' || !Array.isArray(state.customers)) {
    return { nextState: state, nextStores, result };
  }
  const nextState = {
    ...state,
    customers: state.customers.map(customer => ({
      ...customer,
      bills: billsOf(customer).map(bill => (
        paymentsOf(bill).length ? { ...bill, payments: [] } : bill
      ))
    }))
  };
  return { nextState, nextStores, result };
}

function readStore(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (raw === null || raw === undefined) return { present: false, value: undefined };
    return { present: true, value: JSON.parse(raw) };
  } catch {
    return { present: false, value: undefined };
  }
}

function writeStore(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch { /* a failed write leaves the previous value in place */ }
}

/**
 * Storage wrapper for the dialog glue: read the registry stores
 * from a storage-like object ({ getItem, setItem }). Never throws —
 * unreadable storage simply reads as absent.
 */
export function readPaymentRecordStores(storage) {
  const parsed = {};
  if (!storage || typeof storage.getItem !== 'function') return parsed;
  for (const key of CLEAR_PAYMENT_RECORD_STORES) {
    const { present, value } = readStore(storage, key);
    if (present) parsed[key] = value;
  }
  return parsed;
}

/**
 * Storage wrapper for the dialog glue: write back only the stores
 * the wipe actually emptied (non-empty arrays become []). Never
 * throws — a failed write leaves the previous value in place.
 * Returns the list of keys written.
 */
export function writePaymentRecordStores(storage, beforeStores, nextStores) {
  if (!storage || typeof storage.setItem !== 'function') return [];
  const written = [];
  for (const key of CLEAR_PAYMENT_RECORD_STORES) {
    if (!Array.isArray(beforeStores?.[key]) || beforeStores[key].length === 0) continue;
    if (!Array.isArray(nextStores?.[key])) continue;
    writeStore(storage, key, nextStores[key]);
    written.push(key);
  }
  return written;
}
