/**
 * payment-void-audit.js — SISP-34: Wrong / Duplicate Payment Reversal
 * (Void Receipt) & Cross-Ledger Rollback.
 *
 * Problem: a wrong or duplicate payment was recorded (wrong amount, wrong
 * customer, entered twice). Deleting it would erase history; editing it
 * cannot undo the cross-ledger effects it already caused (balance settled,
 * shop cash counted, Waada promise auto-cleared). So voiding keeps the
 * original payment row forever and rolls every leg back:
 *
 *   1. The payment is marked voided: true + voidedAt + voidReason — it is
 *      NEVER deleted. All money derivations in the app skip voided
 *      payments (see the SISP-34 notes in core.js, shop-settlement.js,
 *      dashboard.js, roznamcha.js, profile-ui.js, owner-insights.js,
 *      payments-inbox.js, qa-discounts-late-fee.js and
 *      form-validation.js), so the customer's unpaid balance is restored
 *      and the voided amount stops counting as collected cash.
 *   2. Shop cash: voided payments are excluded from collectShopPayments,
 *      so a voided shop receipt drops out of that shop's unsettled cash.
 *      A payment whose cash was ALREADY handed over to the owner
 *      (shopSettledAmount > 0 or shopSettled) can NOT be voided — handed
 *      cash cannot be silently un-handed by voiding a receipt. The void
 *      refuses with a clear message instead of a partial rollback.
 *   3. Waada promise: when a full payment auto-clears a promise, core.js
 *      addPayment stamps the cleared promise onto that payment
 *      (payment.clearedWaada). Voiding that payment restores the stamped
 *      promise — but ONLY when the customer has no newer promise now, so
 *      a void never clobbers a promise the operator set afterwards.
 *      Payments recorded before SISP-34 carry no stamp, so their cleared
 *      promises cannot be recovered by a void; the operator re-sets those
 *      manually (the void record says promiseRestored: false).
 *   4. The void itself is logged in localStorage under VOIDED_PAYMENTS_KEY
 *      (sisp_voided_payments_v1) and travels in JSON backups via the
 *      `settings.voidPayments` section (see core.js createJsonBackup).
 *
 * ATOMICITY: voidPayment is a pure function. It validates EVERYTHING
 * first (payment exists, not already voided, non-empty reason, no shop
 * settlement), then builds the whole next state from a deep clone. If any
 * leg throws, the input state is untouched and the caller persists
 * nothing — a void can never half-apply in memory. Persistence is two
 * localStorage keys (ledger + void log); the app caller writes the ledger
 * first and the log second, and if the log write fails it writes the
 * previous ledger back and reports failure, so a failed void leaves no
 * half-applied state behind. A double failure (both writes failing) is
 * surfaced by toast, never silent.
 *
 * This module imports nothing on purpose, so core.js can import
 * sanitizeVoidPayments for backup restore without a module cycle.
 * Tests use synthetic data only.
 */

export const VOIDED_PAYMENTS_KEY = 'sisp_voided_payments_v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

/** True only for payments voided by SISP-34 (never for legacy rows). */
export function isVoidedPayment(payment) {
  return !!payment && typeof payment === 'object' && payment.voided === true;
}

/**
 * Shop-settled amount on a payment, mirroring shop-settlement.js
 * settledAmountOf (kept local so this module stays dependency-free).
 */
function shopSettledAmountOf(payment) {
  if (!payment || typeof payment !== 'object') return 0;
  const explicit = Number(payment.shopSettledAmount);
  if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, moneyValue(payment.amount));
  if (payment.shopSettled) return moneyValue(payment.amount);
  return 0;
}

function voidId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `void-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `void-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads void records; [] on missing/corrupt storage. */
export function loadVoidPayments(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(VOIDED_PAYMENTS_KEY);
    if (!raw) return [];
    return sanitizeVoidPayments(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Persists void records; never throws. Returns false on failure. */
export function saveVoidPayments(records, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(VOIDED_PAYMENTS_KEY, JSON.stringify(Array.isArray(records) ? records : []));
    return true;
  } catch {
    return false;
  }
}

/** Drops malformed void records; keeps only known fields. */
export function sanitizeVoidPayments(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.paymentId !== 'string' || !entry.paymentId) continue;
    if (typeof entry.voidReason !== 'string' || !entry.voidReason.trim()) continue;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({
      id: typeof entry.id === 'string' && entry.id ? entry.id : voidId(),
      customerId: entry.customerId ?? null,
      customerNumber: entry.customerNumber ?? null,
      customerName: typeof entry.customerName === 'string' ? entry.customerName : '',
      billMonth: typeof entry.billMonth === 'string' ? entry.billMonth : '',
      paymentId: entry.paymentId,
      paymentDate: typeof entry.paymentDate === 'string' ? entry.paymentDate : '',
      amount,
      method: typeof entry.method === 'string' ? entry.method : '',
      shop: typeof entry.shop === 'string' ? entry.shop : '',
      voidReason: entry.voidReason.trim(),
      voidedAt: typeof entry.voidedAt === 'string' ? entry.voidedAt : '',
      promiseRestored: entry.promiseRestored === true,
      restoredPromiseDate: typeof entry.restoredPromiseDate === 'string' ? entry.restoredPromiseDate : '',
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : ''
    });
  }
  return out;
}

/**
 * Voids one payment with a full cross-ledger rollback. Pure: the input
 * state is never mutated; on any failure it throws and nothing changes.
 *
 * @param {object} state ledger state ({ customers: [...] })
 * @param {string} customerId
 * @param {string} month bill month (YYYY-MM)
 * @param {string} paymentId
 * @param {object} options { voidReason (REQUIRED, non-empty), voidedAt? }
 * @returns {{ state: object, voidRecord: object }}
 * @throws on missing customer/bill/payment, already-voided payment,
 *   empty reason, or a shop-settled payment.
 */
export function voidPayment(state, customerId, month, paymentId, options = {}) {
  const voidReason = typeof options.voidReason === 'string' ? options.voidReason.trim() : '';
  if (!voidReason) throw new Error('A void reason is required. Void was not applied.');
  const customer = (state && Array.isArray(state.customers) ? state.customers : [])
    .find((c) => c && typeof c === 'object' && c.id === customerId);
  if (!customer) throw new Error('Customer not found. Void was not applied.');
  const bill = (Array.isArray(customer.bills) ? customer.bills : [])
    .find((b) => b && typeof b === 'object' && b.month === month);
  if (!bill) throw new Error('Bill not found. Void was not applied.');
  const payment = (Array.isArray(bill.payments) ? bill.payments : [])
    .find((p) => p && typeof p === 'object' && p.id === paymentId);
  if (!payment) throw new Error('Payment not found. Void was not applied.');
  if (payment.voided === true) throw new Error('This payment is already voided.');
  if (shopSettledAmountOf(payment) > 0) {
    throw new Error('This payment was already handed over from the shop and cannot be voided. Reverse the shop handover first, then void.');
  }

  const voidedAt = typeof options.voidedAt === 'string' && options.voidedAt
    ? options.voidedAt
    : new Date().toISOString();
  const stamp = payment.clearedWaada && typeof payment.clearedWaada === 'object'
    ? payment.clearedWaada
    : null;
  const hasCurrentPromise = typeof customer.promiseDate === 'string' && customer.promiseDate.trim() !== '';
  const restorePromise = !!stamp
    && typeof stamp.promiseDate === 'string' && DATE_RE.test(stamp.promiseDate.trim())
    && !hasCurrentPromise;

  // Shop name for the log (same "Cash at X shop" derivation as
  // shop-settlement.js resolveShopCollector, kept local + dependency-free).
  let shop = '';
  const methodLower = String(payment.method || '').toLowerCase();
  const paidByLower = String(payment.paidBy || '').toLowerCase();
  if (methodLower.includes('waseem') || paidByLower.includes('waseem')) shop = 'Waseem Abbasi Shop';
  // OWNER-CASH-SHOP: hassan/balla are the ONE shop "Hassan Balla Shop",
  // mirroring the unified resolveShopCollector derivation.
  else if (methodLower.includes('hassan') || paidByLower.includes('hassan') || methodLower.includes('balla') || paidByLower.includes('balla')) shop = 'Hassan Balla Shop';
  else {
    const custom = String(payment.method || '').match(/cash\s+at\s+(.+?)\s+shop/i);
    if (custom && custom[1].trim()) shop = `${custom[1].trim()} Shop`;
  }

  const voidRecord = {
    id: voidId(),
    customerId: customer.id ?? null,
    customerNumber: customer.customerNumber ?? null,
    customerName: customer.name ?? '',
    billMonth: bill.month ?? '',
    paymentId: payment.id ?? null,
    paymentDate: payment.date ?? '',
    amount: moneyValue(payment.amount),
    method: payment.method ?? '',
    shop,
    voidReason,
    voidedAt,
    promiseRestored: restorePromise,
    restoredPromiseDate: restorePromise ? stamp.promiseDate.trim() : '',
    createdAt: voidedAt
  };

  const next = clone(state || { customers: [] });
  const nextCustomer = (Array.isArray(next.customers) ? next.customers : [])
    .find((c) => c && typeof c === 'object' && c.id === customerId);
  const nextBill = (Array.isArray(nextCustomer.bills) ? nextCustomer.bills : [])
    .find((b) => b && typeof b === 'object' && b.month === month);
  const nextPayment = (Array.isArray(nextBill.payments) ? nextBill.payments : [])
    .find((p) => p && typeof p === 'object' && p.id === paymentId);
  nextPayment.voided = true;
  nextPayment.voidedAt = voidedAt;
  nextPayment.voidReason = voidReason;
  if (restorePromise) {
    nextCustomer.promiseDate = stamp.promiseDate.trim();
    if (stamp.promiseAmount !== null && stamp.promiseAmount !== undefined && stamp.promiseAmount !== '') {
      nextCustomer.promiseAmount = stamp.promiseAmount;
    }
    if (typeof stamp.promiseNote === 'string' && stamp.promiseNote !== '') {
      nextCustomer.promiseNote = stamp.promiseNote;
    }
  }
  return { state: next, voidRecord };
}

/** HTML for the VOID badge + reason shown on a voided payment row. */
export function voidBadgeMarkup(payment) {
  if (!isVoidedPayment(payment)) return '';
  const reason = typeof payment.voidReason === 'string' && payment.voidReason.trim()
    ? payment.voidReason.trim()
    : 'No reason recorded';
  return `<span class="void-badge">VOID</span><span class="payment-meta">Voided: ${escapeHtml(reason)}</span>`;
}
