/**
 * referral-credits.js — SISP-40: Customer Neighbor Referral ("ہمسایہ ریفرل")
 * Credit & Promotional Discount Engine.
 *
 * A happy customer brings a neighbour. The neighbour's customer record
 * carries `referredByCustomerId` (set on the Add Customer form, validated
 * by core.js addCustomer). Once the referred customer makes their FIRST
 * real payment, a referral credit (default Rs. 500, configurable at the
 * engine level and frozen onto the entry) is QUEUED for the referrer.
 * The next SISP-2 billing cycle auto-deducts the queued credit from the
 * referrer's bill for that month: billing-cycle.js writes it onto the
 * bill as audited fields (referralCreditAmount + referralCreditReason +
 * referralCreditAppliedAt + an amountHistory entry), mirroring the
 * SISP-30 outage-concession shape, and receipts subtract it next to the
 * concession so the customer sees exactly why the bill dropped.
 *
 * Money honesty rules (the dispute guard):
 *  - A credit exists ONLY as a queue entry that traces to two real
 *    records: the referred customer's stored referredByCustomerId link
 *    AND that customer's first non-voided payment (its id + bill month
 *    are stamped on the entry). Nothing here invents a balance.
 *  - One credit per referred customer, ever. A second payment never
 *    queues a second credit.
 *  - A QUEUED (not yet applied) entry follows the referred customer's
 *    current first valid payment: if that payment is voided (SISP-34)
 *    and no other valid payment remains, the entry is cancelled with
 *    reason 'trigger-payment-voided'. If the customer later pays again,
 *    a fresh entry may queue. An entry that was already APPLIED to a
 *    bill is final — reversing a settled bill is the operator's manual
 *    call, never an automatic rewrite.
 *  - Self-referral never earns. A deleted referrer or referred customer
 *    cancels a still-queued entry (audit kept, status 'cancelled').
 *  - Application is capped at the bill's gross for the cycle month, so a
 *    credit can never push a bill below Rs. 0; any remainder stays
 *    queued for the following cycle.
 *
 * Storage: entries live in localStorage under REFERRAL_CREDITS_KEY
 * (sisp_referral_credits_v1), a flat array. Backup: entries travel in the
 * JSON backup `settings.referralCredits` section (see core.js), under
 * the same safe-merge rule as suspense payments: adopted only when this
 * device has none stored yet.
 *
 * This module imports nothing: customers, state and storage are passed
 * in by callers, so the pure helpers stay testable without the app and
 * core.js can import the sanitizer without a module cycle.
 */

export const REFERRAL_CREDITS_KEY = 'sisp_referral_credits_v1';

/** Default referral credit (Rs.) queued per referred customer. The amount
 * actually used is frozen onto each entry at queue time, so changing this
 * default never rewrites history. */
export const DEFAULT_REFERRAL_CREDIT_AMOUNT = 500;

/** Audit reason stamped on bills when a referral credit is applied. */
export const REFERRAL_CREDIT_REASON = 'Hamsaya Referral Credit';

const ID_RE = /^REF-(\d+)$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const STATUSES = new Set(['queued', 'applied', 'cancelled']);

const cents = (value) => Math.round(Number(value) * 100);
const rupees = (centsValue) => centsValue / 100;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return rupees(cents(n));
}

/** Next entry id: one above the highest REF-N already stored (starts at 101). */
export function nextReferralId(entries) {
  let max = 100;
  for (const entry of Array.isArray(entries) ? entries : []) {
    const match = ID_RE.exec(String(entry?.referralId || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `REF-${max + 1}`;
}

function sanitizeApplications(value, capCents) {
  if (!Array.isArray(value)) return [];
  const out = [];
  let usedCents = 0;
  for (const row of value) {
    if (!row || typeof row !== 'object' || !MONTH_RE.test(String(row.month ?? ''))) continue;
    const amount = cleanAmount(row.amount);
    if (!(amount > 0)) continue;
    const appliedCents = Math.min(cents(amount), Math.max(0, capCents - usedCents));
    if (appliedCents <= 0) continue;
    usedCents += appliedCents;
    out.push({ month: String(row.month), amount: rupees(appliedCents) });
  }
  return out;
}

/**
 * Drops malformed rows; keeps clean entries in stored order. appliedAmount
 * is recomputed from the applications list (capped at the entry amount)
 * so a stored total can never drift from its parts; status is derived
 * from it unless the entry was cancelled. Duplicate entries for the same
 * referred customer keep the first and drop the rest — the queue is
 * one-credit-per-referred-customer by construction.
 */
export function sanitizeReferralCredits(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seenReferred = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const referralId = cleanText(entry.referralId);
    if (!ID_RE.test(referralId)) continue;
    const referrerCustomerId = cleanText(entry.referrerCustomerId);
    const referredCustomerId = cleanText(entry.referredCustomerId);
    if (!referrerCustomerId || !referredCustomerId || referrerCustomerId === referredCustomerId) continue;
    if (seenReferred.has(referredCustomerId)) continue;
    const amount = cleanAmount(entry.amount);
    if (!(amount > 0)) continue;
    const applications = sanitizeApplications(entry.applications, cents(amount));
    const appliedAmount = rupees(applications.reduce((sum, row) => sum + cents(row.amount), 0));
    const storedStatus = STATUSES.has(entry.status) ? entry.status : null;
    const status = storedStatus === 'cancelled'
      ? 'cancelled'
      : (appliedAmount >= amount ? 'applied' : 'queued');
    seenReferred.add(referredCustomerId);
    out.push({
      referralId,
      referrerCustomerId,
      referredCustomerId,
      amount,
      appliedAmount,
      applications,
      status,
      triggerPaymentId: cleanText(entry.triggerPaymentId),
      triggerMonth: MONTH_RE.test(String(entry.triggerMonth ?? '')) ? String(entry.triggerMonth) : '',
      queuedAt: cleanText(entry.queuedAt),
      cancelledReason: status === 'cancelled' ? cleanText(entry.cancelledReason) : ''
    });
  }
  return out;
}

export function loadReferralCredits(storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(REFERRAL_CREDITS_KEY);
    if (!raw) return [];
    return sanitizeReferralCredits(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveReferralCredits(credits, storage) {
  const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return;
  store.setItem(REFERRAL_CREDITS_KEY, JSON.stringify(sanitizeReferralCredits(credits)));
}

// ---------------------------------------------------------------- earning
/**
 * The referred customer's first REAL payment: earliest non-voided payment
 * across their bills (bills by month, payments by date then id — the same
 * deterministic order the allocation engine uses). Voided payments
 * (SISP-34) are not receipts and never trigger a credit.
 */
export function firstValidPayment(customer) {
  const bills = [...(Array.isArray(customer?.bills) ? customer.bills : [])]
    .filter((bill) => bill && typeof bill.month === 'string')
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const bill of bills) {
    const payments = [...(Array.isArray(bill.payments) ? bill.payments : [])]
      .filter((payment) => payment && payment.voided !== true && payment.id)
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || String(a.id).localeCompare(String(b.id)));
    if (payments.length) {
      return { paymentId: payments[0].id, month: bill.month, date: String(payments[0].date ?? '') };
    }
  }
  return null;
}

/** A cancelled entry blocks a fresh queue for the same referred customer
 * unless it was cancelled because its trigger payment was voided — in
 * that case a later real payment is a new first payment and may earn. */
function blocksRequeue(entry) {
  if (entry.status === 'queued' || entry.status === 'applied') return true;
  return entry.cancelledReason !== 'trigger-payment-voided';
}

/**
 * Reconcile the queue against the ledger. Pure: returns the next queue
 * plus what changed. Idempotent — reconciling twice changes nothing the
 * second time. Called by app.js on every save and by the billing-cycle
 * modal before it plans a cycle, so the queue is never stale.
 *
 * @param state   ledger state ({ customers: [...] })
 * @param credits stored queue entries (any shape; sanitized first)
 * @param options { amount } credit to queue for newly earned referrals
 *                (defaults to DEFAULT_REFERRAL_CREDIT_AMOUNT), { now }
 *                clock for the queuedAt stamp.
 */
export function reconcileReferralCredits(state, credits, { amount = DEFAULT_REFERRAL_CREDIT_AMOUNT, now = new Date() } = {}) {
  const queueAmount = cleanAmount(amount) || DEFAULT_REFERRAL_CREDIT_AMOUNT;
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const byId = new Map(customers.filter((c) => c && c.id).map((c) => [c.id, c]));
  const next = sanitizeReferralCredits(credits).map((entry) => ({ ...entry, applications: [...entry.applications] }));
  const created = [];
  const cancelled = [];
  let changed = JSON.stringify(sanitizeReferralCredits(credits)) !== JSON.stringify(next);

  // 1) Still-queued, never-applied entries follow reality: a removed
  //    customer, a changed link or a voided trigger payment cancels them.
  for (const entry of next) {
    if (entry.status !== 'queued' || entry.appliedAmount > 0) continue;
    const referred = byId.get(entry.referredCustomerId);
    const referrer = byId.get(entry.referrerCustomerId);
    let reason = '';
    if (!referred) reason = 'referred-customer-removed';
    else if (!referrer) reason = 'referrer-removed';
    else if (cleanText(referred.referredByCustomerId) !== entry.referrerCustomerId) reason = 'referral-link-changed';
    else {
      const first = firstValidPayment(referred);
      if (!first) reason = 'trigger-payment-voided';
      else if (first.paymentId !== entry.triggerPaymentId || first.month !== entry.triggerMonth) {
        // The original first payment was voided and a later real payment
        // is now the first one — retarget the audit stamp, keep the queue.
        entry.triggerPaymentId = first.paymentId;
        entry.triggerMonth = first.month;
        changed = true;
      }
    }
    if (reason) {
      entry.status = 'cancelled';
      entry.cancelledReason = reason;
      cancelled.push(entry);
      changed = true;
    }
  }

  // 2) Newly earned credits: a linked referred customer with a first
  //    valid payment and no blocking entry queues exactly one credit.
  const queuedAt = (now instanceof Date ? now : new Date()).toISOString();
  for (const referred of customers) {
    if (!referred || !referred.id) continue;
    const referrerId = cleanText(referred.referredByCustomerId);
    if (!referrerId || referrerId === referred.id) continue; // no link / self-referral
    if (!byId.has(referrerId)) continue; // referrer record is gone
    if (next.some((entry) => entry.referredCustomerId === referred.id && blocksRequeue(entry))) continue;
    const first = firstValidPayment(referred);
    if (!first) continue; // has not paid yet — no credit
    const entry = {
      referralId: nextReferralId(next),
      referrerCustomerId: referrerId,
      referredCustomerId: referred.id,
      amount: queueAmount,
      appliedAmount: 0,
      applications: [],
      status: 'queued',
      triggerPaymentId: first.paymentId,
      triggerMonth: first.month,
      queuedAt,
      cancelledReason: ''
    };
    next.push(entry);
    created.push(entry);
    changed = true;
  }

  return { credits: next, created, cancelled, changed };
}

// ---------------------------------------------------------------- applying
/** Rupees of one entry not yet applied to any bill. */
export function referralRemaining(entry) {
  if (!entry || entry.status !== 'queued') return 0;
  return Math.max(0, rupees(cents(entry.amount) - cents(entry.appliedAmount)));
}

/** Total queued (unapplied) referral credit waiting for one referrer. */
export function queuedReferralTotalFor(credits, referrerCustomerId) {
  return rupees((Array.isArray(credits) ? credits : [])
    .filter((entry) => entry?.referrerCustomerId === referrerCustomerId)
    .reduce((sum, entry) => sum + cents(referralRemaining(entry)), 0));
}

/**
 * Plan how a capacity (one bill's gross, in rupees) is filled from a
 * referrer's queue, oldest entry first. Returns [{ referralId, amount }]
 * with positive amounts only; the total never exceeds the capacity, so
 * applying a plan can never push a bill below Rs. 0.
 */
export function planReferralApplications(credits, referrerCustomerId, capacity) {
  let capacityCents = Math.max(0, cents(Number.isFinite(Number(capacity)) ? Number(capacity) : 0));
  const plan = [];
  for (const entry of Array.isArray(credits) ? credits : []) {
    if (capacityCents <= 0) break;
    if (!entry || entry.referrerCustomerId !== referrerCustomerId) continue;
    const remainingCents = cents(referralRemaining(entry));
    if (remainingCents <= 0) continue;
    const appliedCents = Math.min(remainingCents, capacityCents);
    capacityCents -= appliedCents;
    plan.push({ referralId: entry.referralId, amount: rupees(appliedCents) });
  }
  return plan;
}

/**
 * Record a plan's applications against a bill month. Pure: returns the
 * next queue. An entry whose amount is fully applied becomes 'applied';
 * a partially applied entry stays 'queued' with its remainder.
 */
export function applyReferralApplications(credits, applications, month) {
  const byId = new Map((Array.isArray(applications) ? applications : [])
    .filter((row) => row && row.referralId && cleanAmount(row.amount) > 0)
    .map((row) => [row.referralId, cleanAmount(row.amount)]));
  if (!byId.size || !MONTH_RE.test(String(month ?? ''))) return sanitizeReferralCredits(credits);
  return sanitizeReferralCredits(credits).map((entry) => {
    const applied = byId.get(entry.referralId);
    if (!applied || entry.status !== 'queued') return entry;
    const applicationsNext = [...entry.applications, { month: String(month), amount: applied }];
    const appliedAmount = Math.min(entry.amount, rupees(applicationsNext.reduce((sum, row) => sum + cents(row.amount), 0)));
    return {
      ...entry,
      applications: applicationsNext,
      appliedAmount,
      status: appliedAmount >= entry.amount ? 'applied' : 'queued'
    };
  });
}

// ---------------------------------------------------------------- profile
/** Queue entries earned BY this customer (they are the referrer). */
export function referralEntriesForReferrer(credits, customerId) {
  return (Array.isArray(credits) ? credits : []).filter((entry) => entry?.referrerCustomerId === customerId);
}

/** Totals for one referrer: credit still queued vs already deducted. */
export function referralTotalsForReferrer(credits, customerId) {
  let queuedCents = 0;
  let appliedCents = 0;
  for (const entry of referralEntriesForReferrer(credits, customerId)) {
    if (entry.status === 'cancelled') continue;
    queuedCents += cents(referralRemaining(entry));
    appliedCents += cents(entry.appliedAmount);
  }
  return { queuedTotal: rupees(queuedCents), appliedTotal: rupees(appliedCents) };
}
