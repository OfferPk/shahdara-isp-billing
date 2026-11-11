/**
 * clear-payment-records.js — "Clear All Record" (Mohalla Seed item).
 *
 * Pure, import-free by design: no DOM, no storage, no clock. The dialog
 * in app.js owns the backup gate, the typed CLEAR confirm, the safety
 * snapshot and the satellite-key removal; this module only counts and
 * wipes, so every behaviour below is pinned by unit tests.
 *
 * SCOPE (Option A, owner-delegated 2026-11-11): payments + payment-
 * derived records ONLY.
 *  - WIPED from the ledger: every `customer.bills[].payments` entry,
 *    all customers, all months — live entries and voided stubs alike
 *    (a voided entry is a payment record; the void audit log itself
 *    is KEPT, see below). Bills stay: with their payments gone a bill
 *    honestly becomes unpaid again — bill status is DERIVED
 *    (core derivedBillStatus, from the remaining payments), so no
 *    stored status needs rewriting.
 *  - DERIVED, never stored: manual-baqaya settled amounts come from
 *    the payment stamps (core manualBaqayaSettledCentsByEntry), so
 *    wiping the payments resets the derived settlement to zero while
 *    the baqaya entries themselves (dues, not payments) stay.
 *  - WIPED wholesale (separate localStorage keys, removed by the
 *    app.js wiring — not by this module): advance/prepay records,
 *    queued/orphan/in-flight payments, receipt artefacts of wiped
 *    payments, and the wallet inbox items. See PAYMENT_RECORD_WIPE_KEYS.
 *  - KEPT: customers, bills, waada/promises, complaints, settings
 *    (including the defaultCustomersImport marker), coverage
 *    estimates, inventory, expenses, monthly closings, collector
 *    settlements + daily cash handovers, receipt books/series +
 *    numbering, and ALL audit trails. Never localStorage.clear().
 */

const moneyCents = value => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * Every satellite localStorage key the wipe removes wholesale. The
 * ledger state itself is wiped by clearPaymentRecords below; these
 * keys hold payment-derived records that live outside the ledger key.
 * Receipt books/series + numbering are deliberately NOT here — receipt
 * numbers must never be reused.
 */
export const PAYMENT_RECORD_WIPE_KEYS = Object.freeze([
  // Advance / prepay — credit with no source payment would be dishonest.
  'shahdara_advance',
  'shahdara_advance_allocations_v1',
  'shahdara_advance_expiry_v1',
  // Queued / orphan / in-flight payments.
  'shahdara_offline_payment_queue',
  'shahdara_orphan_payments_v1',
  'shahdara_payment_claims_v1',
  'shahdara_payment_clearance_v1',
  'shahdara_part_payment_allocations_v1',
  'shahdara_part_payment_receipt_notes_v1',
  // Receipt artefacts of wiped payments (share/reprint/split/document
  // receipts + gap explanations). Books/series stay — see header.
  'shahdara_receipts_shared_v1',
  'shahdara_receipt_reprints_v1',
  'shahdara_split_receipts_v1',
  'shahdara_document_receipts_v1',
  'shahdara_receipt_gap_explanations_v1',
  // Wallet inbox items — unverified wallet transactions are payment
  // records by another name; inbox SETTINGS stay (QR/till config).
  'easypaisaInbox.items'
]);

/** How many records a parsed satellite store holds: an array counts its
 *  rows, a plain object counts its keys, anything else (missing key,
 *  null, a scalar) counts 0. Never throws. */
export function countSatelliteRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

/**
 * Count what the wipe would remove, BEFORE anything is deleted — the
 * preview the dialog shows. `satellites` maps each wipe key to its
 * parsed stored value (missing keys count 0).
 * @returns {{ payments: number, customers: number, totalCents: number,
 *   billsBecomingUnpaid: number, satelliteCounts: Object, satelliteTotal: number }}
 *  - payments: every payments-array entry removed (live + voided stubs).
 *  - customers: customers with at least one payment entry.
 *  - totalCents: sum of the removed payments' amounts, in cents.
 *  - billsBecomingUnpaid: bills with a priced amount (dueAmount > 0)
 *    that carry at least one NON-voided payment — those are the bills
 *    whose derived status actually flips to unpaid. A bill with only
 *    voided payments was already unpaid; a bill with no priced amount
 *    derives 'not-set', never 'unpaid'.
 */
export function countPaymentRecords(state, satellites = {}) {
  let payments = 0;
  let totalCents = 0;
  let billsBecomingUnpaid = 0;
  const customersWithPayments = new Set();
  for (const customer of state?.customers ?? []) {
    if (!customer || !Array.isArray(customer.bills)) continue;
    let customerHasPayment = false;
    for (const bill of customer.bills) {
      const entries = Array.isArray(bill?.payments) ? bill.payments : [];
      if (!entries.length) continue;
      customerHasPayment = true;
      payments += entries.length;
      for (const payment of entries) totalCents += moneyCents(payment?.amount);
      const hasLivePayment = entries.some(payment => payment?.voided !== true);
      if (hasLivePayment && Number(bill?.dueAmount) > 0) billsBecomingUnpaid += 1;
    }
    if (customerHasPayment) customersWithPayments.add(customer.id);
  }
  const satelliteCounts = {};
  let satelliteTotal = 0;
  for (const key of PAYMENT_RECORD_WIPE_KEYS) {
    const count = countSatelliteRecords(satellites?.[key]);
    satelliteCounts[key] = count;
    satelliteTotal += count;
  }
  return {
    payments,
    customers: customersWithPayments.size,
    totalCents,
    billsBecomingUnpaid,
    satelliteCounts,
    satelliteTotal
  };
}

/**
 * The wipe itself: returns the next state with every payments array
 * emptied and everything else untouched — customers, bills, waada,
 * settings and the defaultCustomersImport marker are carried over
 * unchanged, and a customer whose bills hold no payments keeps the
 * SAME object reference (nothing to rewrite). The input state is
 * never mutated. Returns the SAME state reference when there is
 * nothing to wipe.
 */
export function clearPaymentRecords(state) {
  if (!state || !Array.isArray(state.customers)) return state;
  let changed = false;
  const customers = state.customers.map(customer => {
    if (!customer || !Array.isArray(customer.bills)) return customer;
    let billsChanged = false;
    const bills = customer.bills.map(bill => {
      if (!bill || !Array.isArray(bill.payments) || bill.payments.length === 0) return bill;
      billsChanged = true;
      return { ...bill, payments: [] };
    });
    if (!billsChanged) return customer;
    changed = true;
    return { ...customer, bills };
  });
  return changed ? { ...state, customers } : state;
}
