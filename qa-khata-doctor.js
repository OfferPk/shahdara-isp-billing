// SISP-36: Offline Data Integrity Doctor & Cross-Ledger Reconciliation Check
// ("Khata Doctor" — ڈیٹا ڈاکٹر اور کھاتہ آڈٹ ٹول).
//
// Problem: the ledger lives only in this browser. Balances are always
// derived, never stored, so a silently corrupted record (a bill amount
// edited outside the audited flows, a kist plan counter out of range, a
// payment pointing at a settlement that no longer exists, a NaN that
// slipped into a money field) changes what a customer "owes" with no
// warning anywhere. The Khata Doctor is the offline audit that catches
// that: one click recomputes every customer's pending balance from the
// raw ledger entries and cross-checks the independent records that are
// supposed to agree with each other.
//
// The ledger-derived balance follows the spec formula per customer,
// applied bill by bill in month order with the app's own semantics:
//   pendingBalance = Sum(Bills + Kists) - Sum(Valid Payments) - Sum(Concessions) - Sum(Deposit Offsets)
// where a bill's charge is dueAmount (which already includes its kist
// lines) + lateFee + shiftingFee, concessions reduce that bill's charge,
// and a SISP-50 disconnection deposit offset (bill.depositOffsetAmount)
// reduces it the same way,
// payment discounts count as payment-side reductions, excess payment on
// one bill carries forward as credit to later bills only, and VOIDED
// payments (SISP-34) are never valid payments — they are excluded from
// every sum here, exactly like core.js recordedAmount / allocations do.
//
// Cross-checks (each against an INDEPENDENT record, never the same
// number compared with itself):
//   * Cached balance: Auto-Repair stores the last verified balance per
//     customer in sisp_khata_doctor_v1 (see backup-store.js) together
//     with a fingerprint of the ledger it was derived from. While the
//     fingerprint still matches, a cached balance that differs from the
//     ledger-derived balance is a warning — something rewrote the cache
//     or the derivation inputs without touching the ledger. When the
//     fingerprint differs, the ledger legitimately moved since the last
//     verification and the cache is simply stale (repaired by re-running
//     Auto-Repair, which re-baselines it — never a warning).
//   * Bill provenance: a priced bill with a priceSnapshot must satisfy
//     dueAmount === priceSnapshot + manual-correction deltas + kistTotal.
//     The audited flows (cycle, saveBillMonth, kist adoption) preserve
//     this identity; a silent edit breaks it.
//   * Settlement references: every payment.settlementIds entry must
//     exist in sisp_shop_settlements_v1, and a payment's settled amount
//     can never exceed the payment itself.
//   * Kist plans: 0 <= monthsPaid <= monthsBilled <= totalMonths on the
//     RAW stored plan, and every billed kist line must reference a plan
//     that exists on the customer.
//   * Void log: every voided payment must have its record in
//     sisp_voided_payments_v1, and every void record must point at a
//     payment that is actually voided.
//   * NaN scan: no money/count field the doctor reads may be NaN or
//     non-finite (an empty/null dueAmount is the legitimate "unpriced"
//     marker, not a NaN).
//
// READ-ONLY: runKhataDoctor never mutates its input. The only writes in
// this feature happen inside repairKhataDoctor, which the UI calls ONLY
// from the explicit Auto-Repair button and ONLY after a storage-safety
// snapshot (PR #459 Layer A) has been saved. Repair fixes only what is
// deterministic: NaN money fields are zeroed (a NaN dueAmount becomes
// the unpriced marker null), out-of-range plan counters are clamped via
// installment-plan.js's own sanitizer, and the cached balances are
// rewritten from the exact ledger-derived values. Anything the doctor
// cannot prove (a broken bill provenance, a dangling settlement
// reference) is reported, never guessed at or rewritten.
//
// Tests use synthetic data only; no customer, bill or payment data is
// ever fabricated here.

import { canonicalize, crc32Hex } from './backup-health.js';
import { billKistTotal, sanitizeInstallmentPlan } from './installment-plan.js';
import { paymentTicketChargeCents, prepayTermsOf } from './core.js';

export const KHATA_DOCTOR_VERSION = 1;

const cents = (value) => Math.round(Number(value || 0) * 100);
const rupees = (value) => Math.round((Number(value) || 0) * 100) / 100;

// A stored money field is "corrupt" when it carries a value that is
// neither empty (the legitimate unset marker) nor a finite number.
function isCorruptMoney(value) {
  if (value === null || value === undefined || value === '') return false;
  return !Number.isFinite(Number(value));
}

function isPricedBill(bill) {
  const amount = bill?.dueAmount;
  return !(amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0);
}

const validPaymentsOf = (bill) => [...(bill?.payments ?? [])]
  .filter((payment) => payment && payment.voided !== true)
  .sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? '')) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')));

/**
 * Ledger-derived pending balance for one customer, in cents, following
 * the spec formula with the app's allocation semantics (see header).
 * Also returns the component sums so the report can show its working.
 */
export function computeLedgerBalance(customer) {
  const bills = [...(customer?.bills ?? [])].filter(Boolean).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  let balanceCents = 0;
  let chargesCents = 0;
  let paymentsCents = 0;
  let discountsCents = 0;
  let concessionsCents = 0;
  let depositOffsetsCents = 0;
  let creditCents = 0;
  for (const bill of bills) {
    const payments = validPaymentsOf(bill);
    if (!isPricedBill(bill)) {
      // Unpriced bill: nothing can be applied yet, so every valid receipt
      // is unused credit carried forward (core.js allocation rule) —
      // except a receipt's SISP-43 ticket-charge portion, which the
      // tickets consumed and which never becomes credit.
      // SISP-61: a prepay's upfront discount is coverage, not a
      // discount on any bill — on an unpriced bill it is unused credit
      // in full, exactly like the engine's rule.
      creditCents += payments.reduce((sum, payment) => sum + Math.max(0, cents(payment.amount) - paymentTicketChargeCents(payment)) + (prepayTermsOf(payment) ? cents(payment.discount || 0) : 0), 0);
      continue;
    }
    const chargeCents = cents(bill.dueAmount) + cents(bill.lateFee || 0) + cents(bill.shiftingFee || 0);
    const concessionCents = cents(bill.concessionAmount || 0);
    chargesCents += chargeCents;
    concessionsCents += concessionCents;
    let dueCents = Math.max(0, chargeCents - concessionCents);
    // SISP-50: a disconnection deposit offset waives part of the bill
    // exactly like a concession (clamped so it can never take the bill
    // below zero after the concession).
    const depositOffsetCents = Math.min(cents(bill.depositOffsetAmount || 0), dueCents);
    depositOffsetsCents += depositOffsetCents;
    dueCents -= depositOffsetCents;
    const appliedCreditCents = Math.min(creditCents, dueCents);
    creditCents -= appliedCreditCents;
    dueCents -= appliedCreditCents;
    for (const payment of payments) {
      // SISP-61: a prepay's upfront discount never reduces this bill
      // and is never counted as a bill discount — the engine converts
      // it into advance coverage, so here it joins the carried credit
      // in full (after the cash below, mirroring the engine's order;
      // totals are identical either way).
      const isPrepay = prepayTermsOf(payment) !== null;
      const discountCents = isPrepay ? 0 : Math.min(cents(payment.discount || 0), dueCents);
      if (discountCents > 0) { discountsCents += discountCents; dueCents -= discountCents; }
      // SISP-43: only the bill portion of a receipt applies to the bill
      // or becomes credit — the ticket-charge portion settled field
      // work. paymentsCents still reports the full valid cash received.
      const billPortionCents = Math.max(0, cents(payment.amount) - paymentTicketChargeCents(payment));
      const appliedCents = Math.min(billPortionCents, dueCents);
      paymentsCents += cents(payment.amount);
      dueCents -= appliedCents;
      const excessCents = billPortionCents - appliedCents;
      if (excessCents > 0) creditCents += excessCents;
      if (isPrepay) creditCents += cents(payment.discount || 0);
    }
    balanceCents += dueCents;
  }
  return { balanceCents, chargesCents, paymentsCents, discountsCents, concessionsCents, depositOffsetsCents, creditCents };
}

/**
 * Stable fingerprint of one customer's ledger (bills, payments, plans).
 * The cached-balance check only trusts the cache while this fingerprint
 * is unchanged — any legitimate ledger movement re-baselines instead of
 * warning. Key order is canonicalized; bills/payments are sorted first
 * so storage order alone never changes the fingerprint.
 */
export function ledgerFingerprint(customer) {
  const bills = [...(customer?.bills ?? [])].filter(Boolean)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)))
    .map((bill) => ({
      ...bill,
      payments: [...(bill?.payments ?? [])].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
    }));
  const plans = [...(customer?.installmentPlans ?? [])].sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')));
  return crc32Hex(canonicalize({ bills, plans }));
}

/** Build the cache object Auto-Repair persists (exact ledger-derived values). */
export function buildKhataDoctorCache(state, now = new Date()) {
  const balances = {};
  for (const customer of state?.customers ?? []) {
    if (!customer?.id) continue;
    balances[customer.id] = {
      balanceCents: computeLedgerBalance(customer).balanceCents,
      fingerprint: ledgerFingerprint(customer)
    };
  }
  return {
    version: KHATA_DOCTOR_VERSION,
    updatedAt: (now instanceof Date ? now : new Date(now)).toISOString(),
    balances
  };
}

function issue(code, severity, message, repairable, details = {}) {
  return { code, severity, message, repairable, ...details };
}

function checkCustomer(customer, { settlementIds, cacheEntry }) {
  const issues = [];
  const bills = (customer?.bills ?? []).filter(Boolean);
  const plans = Array.isArray(customer?.installmentPlans) ? customer.installmentPlans : [];
  const planIds = new Set(plans.map((plan) => plan?.id).filter(Boolean));

  // Duplicate bill months / payment ids corrupt every derivation.
  const seenMonths = new Set();
  for (const bill of bills) {
    if (seenMonths.has(bill.month)) issues.push(issue('duplicate-bill-month', 'error', `Two bills stored for ${bill.month}.`, false, { month: bill.month }));
    seenMonths.add(bill.month);
    const seenPaymentIds = new Set();
    for (const payment of bill.payments ?? []) {
      if (payment?.id && seenPaymentIds.has(payment.id)) issues.push(issue('duplicate-payment-id', 'error', `Payment ${payment.id} appears twice in ${bill.month}.`, false, { month: bill.month, paymentId: payment.id }));
      if (payment?.id) seenPaymentIds.add(payment.id);
    }
  }

  for (const bill of bills) {
    // NaN scan over the money fields the doctor (and the app) reads.
    for (const field of ['dueAmount', 'lateFee', 'shiftingFee', 'concessionAmount', 'depositOffsetAmount']) {
      if (isCorruptMoney(bill?.[field])) {
        issues.push(issue('nan-value', 'error', `Bill ${bill.month} has an unreadable ${field} value.`, true, { month: bill.month, field }));
      }
    }
    for (const payment of bill.payments ?? []) {
      for (const field of ['amount', 'discount']) {
        if (isCorruptMoney(payment?.[field])) {
          issues.push(issue('nan-value', 'error', `Payment ${payment?.id ?? ''} in ${bill.month} has an unreadable ${field} value.`, true, { month: bill.month, paymentId: payment?.id ?? null, field }));
        }
      }
      // Settlement references must resolve against the settlement book.
      const refs = Array.isArray(payment?.settlementIds) ? payment.settlementIds : [];
      for (const ref of refs) {
        if (!settlementIds.has(ref)) {
          issues.push(issue('settlement-ref-missing', 'error', `Payment ${payment?.id ?? ''} in ${bill.month} references settlement ${ref}, which is not in the settlement book.`, false, { month: bill.month, paymentId: payment?.id ?? null, settlementId: ref }));
        }
      }
      const settled = Number(payment?.shopSettledAmount || 0);
      if (Number.isFinite(settled) && Number.isFinite(Number(payment?.amount)) && settled > Number(payment.amount)) {
        issues.push(issue('settlement-over-amount', 'error', `Payment ${payment?.id ?? ''} in ${bill.month} shows more cash settled than the payment itself.`, false, { month: bill.month, paymentId: payment?.id ?? null }));
      }
    }
    // Bill provenance: priceSnapshot + manual corrections + kist must
    // reproduce dueAmount exactly for priced, snapshot-carrying bills.
    if (isPricedBill(bill) && Number.isFinite(Number(bill.priceSnapshot)) && Number(bill.priceSnapshot) > 0) {
      const deltas = (bill.amountHistory ?? [])
        .filter((entry) => entry?.source === 'manual correction' && Number.isFinite(Number(entry.previousAmount)) && Number.isFinite(Number(entry.newAmount)))
        .reduce((sum, entry) => sum + (cents(entry.newAmount) - cents(entry.previousAmount)), 0);
      const expectedCents = cents(bill.priceSnapshot) + deltas + cents(billKistTotal(bill));
      if (expectedCents !== cents(bill.dueAmount)) {
        issues.push(issue('bill-amount-mismatch', 'error', `Bill ${bill.month} amount Rs. ${rupees(cents(bill.dueAmount))} does not match its price snapshot + corrections + kist (Rs. ${rupees(expectedCents)}). It may have been edited outside the audited flows.`, false, { month: bill.month, expectedCents, actualCents: cents(bill.dueAmount) }));
      }
    }
    // Kist lines must reference a plan that exists on this customer.
    for (const line of bill.kistLines ?? []) {
      if (line?.planId && !planIds.has(line.planId)) {
        issues.push(issue('kist-line-orphan', 'error', `Bill ${bill.month} carries a kist line for plan ${line.planId}, which is not on this customer.`, false, { month: bill.month, planId: line.planId }));
      }
    }
  }

  // Kist plan counters: 0 <= monthsPaid <= monthsBilled <= totalMonths.
  for (const plan of plans) {
    const totalMonths = Number(plan?.totalMonths);
    const monthsBilled = Number(plan?.monthsBilled);
    const monthsPaid = Number(plan?.monthsPaid);
    const rangeBroken = !Number.isFinite(totalMonths) || totalMonths < 1
      || !Number.isFinite(monthsBilled) || !Number.isFinite(monthsPaid)
      || monthsPaid < 0 || monthsBilled < 0 || monthsPaid > monthsBilled || monthsBilled > totalMonths;
    if (rangeBroken) {
      const repairable = sanitizeInstallmentPlan(plan) !== null;
      issues.push(issue('plan-range', 'error', `Kist plan "${plan?.itemTitle ?? plan?.id ?? ''}" has counters outside 0 <= paid <= billed <= total (paid ${plan?.monthsPaid}, billed ${plan?.monthsBilled}, total ${plan?.totalMonths}).`, repairable, { planId: plan?.id ?? null }));
    }
  }

  // Cached balance vs ledger-derived balance (fingerprint-gated).
  const ledger = computeLedgerBalance(customer);
  const fingerprint = ledgerFingerprint(customer);
  let cachedBalanceCents = null;
  let cacheStale = false;
  if (!cacheEntry) {
    cacheStale = true;
    issues.push(issue('balance-unverified', 'info', 'No verified balance on record yet — Auto-Repair baselines it from the ledger.', true));
  } else if (cacheEntry.fingerprint !== fingerprint) {
    cacheStale = true;
    issues.push(issue('balance-stale', 'info', 'Ledger changed since the last verified balance — Auto-Repair re-baselines it.', true));
  } else {
    cachedBalanceCents = cacheEntry.balanceCents;
    if (cacheEntry.balanceCents !== ledger.balanceCents) {
      issues.push(issue('balance-mismatch', 'warning', `Cached balance Rs. ${rupees(cacheEntry.balanceCents)} does not match the ledger-derived balance Rs. ${rupees(ledger.balanceCents)}.`, true, { cachedBalanceCents: cacheEntry.balanceCents, ledgerBalanceCents: ledger.balanceCents }));
    }
  }

  return {
    customerId: customer?.id ?? null,
    customerNumber: customer?.customerNumber ?? null,
    name: customer?.name ?? '',
    ledgerBalanceCents: ledger.balanceCents,
    cachedBalanceCents,
    cacheStale,
    issues
  };
}

/**
 * Run the full diagnostic. READ-ONLY: the input state, settlements,
 * void log and cache are never mutated.
 *
 * @param state       the app ledger state ({ customers: [...] })
 * @param settlements sisp_shop_settlements_v1 records (array)
 * @param voidPayments sisp_voided_payments_v1 records (array)
 * @param cache       sanitized doctor cache from backup-store.js (or null)
 */
export function runKhataDoctor(state, { settlements = [], voidPayments = [], cache = null } = {}) {
  const settlementIds = new Set((settlements ?? []).map((record) => record?.id).filter(Boolean));
  const cacheBalances = cache?.balances && typeof cache.balances === 'object' ? cache.balances : {};
  const customers = [];
  const globalIssues = [];

  const voidedPaymentIds = new Set();
  for (const customer of state?.customers ?? []) {
    customers.push(checkCustomer(customer, { settlementIds, cacheEntry: cacheBalances[customer?.id] ?? null }));
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        if (payment?.voided === true && payment?.id) voidedPaymentIds.add(payment.id);
      }
    }
  }

  // Void log cross-check, both directions.
  const loggedVoidIds = new Set((voidPayments ?? []).map((record) => record?.paymentId).filter(Boolean));
  for (const paymentId of voidedPaymentIds) {
    if (!loggedVoidIds.has(paymentId)) {
      globalIssues.push(issue('void-log-missing', 'warning', `Payment ${paymentId} is marked voided but has no record in the void log.`, false, { paymentId }));
    }
  }
  for (const record of voidPayments ?? []) {
    if (record?.paymentId && !voidedPaymentIds.has(record.paymentId)) {
      globalIssues.push(issue('void-log-orphan', 'warning', `Void log record for payment ${record.paymentId} does not match any voided payment.`, false, { paymentId: record.paymentId }));
    }
  }

  const allIssues = [...globalIssues, ...customers.flatMap((row) => row.issues)];
  const count = (severity) => allIssues.filter((entry) => entry.severity === severity).length;
  return {
    version: KHATA_DOCTOR_VERSION,
    healthy: count('error') === 0 && count('warning') === 0,
    summary: {
      customersChecked: customers.length,
      errors: count('error'),
      warnings: count('warning'),
      infos: count('info'),
      repairable: allIssues.filter((entry) => entry.repairable).length,
      totalLedgerBalanceCents: customers.reduce((sum, row) => sum + row.ledgerBalanceCents, 0)
    },
    customers,
    issues: globalIssues
  };
}

const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

/**
 * Auto-Repair. Pure: returns the repaired state plus the rebuilt cache.
 * The caller MUST have saved a storage-safety snapshot before calling
 * this (the UI enforces it) and persists both results itself.
 *
 * Deterministic fixes only:
 *   - corrupt money fields zeroed (a corrupt dueAmount becomes null,
 *     the unpriced marker — the bill keeps its payments as credit);
 *   - out-of-range kist plan counters clamped via the plan sanitizer
 *     (only when the sanitizer can rebuild the plan);
 *   - the cached balances rewritten from the exact ledger-derived
 *     balances of the REPAIRED state.
 * Everything else is reported back in `remaining` for a human to fix.
 */
export function repairKhataDoctor(state, { settlements = [], voidPayments = [], cache = null, now = new Date() } = {}) {
  const next = clone(state ?? { customers: [] });
  const fixes = [];
  for (const customer of next.customers ?? []) {
    for (const bill of customer?.bills ?? []) {
      if (!bill) continue;
      for (const field of ['lateFee', 'shiftingFee', 'concessionAmount', 'depositOffsetAmount']) {
        if (isCorruptMoney(bill[field])) { bill[field] = 0; fixes.push(`Zeroed unreadable ${field} on ${customer.name ?? customer.id} bill ${bill.month}.`); }
      }
      if (isCorruptMoney(bill.dueAmount)) { bill.dueAmount = null; fixes.push(`Marked ${customer.name ?? customer.id} bill ${bill.month} unpriced — its amount was unreadable.`); }
      for (const payment of bill.payments ?? []) {
        if (!payment) continue;
        if (isCorruptMoney(payment.amount)) { payment.amount = 0; fixes.push(`Zeroed unreadable amount on payment ${payment.id ?? ''} (${customer.name ?? customer.id}, ${bill.month}).`); }
        if (isCorruptMoney(payment.discount)) { payment.discount = 0; fixes.push(`Zeroed unreadable discount on payment ${payment.id ?? ''} (${customer.name ?? customer.id}, ${bill.month}).`); }
      }
    }
    if (Array.isArray(customer?.installmentPlans)) {
      customer.installmentPlans = customer.installmentPlans.map((plan) => {
        const totalMonths = Number(plan?.totalMonths);
        const monthsBilled = Number(plan?.monthsBilled);
        const monthsPaid = Number(plan?.monthsPaid);
        const rangeBroken = !Number.isFinite(totalMonths) || totalMonths < 1
          || !Number.isFinite(monthsBilled) || !Number.isFinite(monthsPaid)
          || monthsPaid < 0 || monthsBilled < 0 || monthsPaid > monthsBilled || monthsBilled > totalMonths;
        if (!rangeBroken) return plan;
        const sanitized = sanitizeInstallmentPlan(plan);
        if (!sanitized) return plan;
        fixes.push(`Clamped kist counters for "${plan.itemTitle ?? plan.id}" to paid ${sanitized.monthsPaid} / billed ${sanitized.monthsBilled} / total ${sanitized.totalMonths}.`);
        return { ...plan, monthsBilled: sanitized.monthsBilled, monthsPaid: sanitized.monthsPaid, totalMonths: sanitized.totalMonths };
      });
    }
  }
  const rebuiltCache = buildKhataDoctorCache(next, now);
  const previousBalances = cache?.balances ?? {};
  let baselined = 0;
  for (const customer of next.customers ?? []) {
    const entry = rebuiltCache.balances[customer?.id];
    const previous = previousBalances[customer?.id];
    if (entry && (!previous || previous.balanceCents !== entry.balanceCents || previous.fingerprint !== entry.fingerprint)) baselined += 1;
  }
  if (baselined > 0) fixes.push(`Restored ${baselined} cached balance(s) to the exact ledger-derived values.`);
  const remainingReport = runKhataDoctor(next, { settlements, voidPayments, cache: rebuiltCache });
  const remaining = [...remainingReport.issues, ...remainingReport.customers.flatMap((row) => row.issues)]
    .filter((entry) => entry.severity === 'error' || entry.severity === 'warning');
  return { state: next, cache: rebuiltCache, fixes, remaining };
}
