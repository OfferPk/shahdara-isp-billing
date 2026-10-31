// SISP-106: Temporary Bandwidth Boost / Add-On Micro-Billing.
//
// A boost is a paid, time-boxed speed upgrade sold on top of the
// customer's existing package: the operator logs it (boostMbps,
// durationDays, addonFeePKR, startDate -> expiryDate) and the customer
// keeps their base package — packagePrice / monthlySellingAmount and
// the package label are NEVER changed by a boost.
//
// Storage: the log rides the customer record as `speedBoosts: [...]`
// (sanitized by core.js sanitizeSpeedBoosts on every load), so it
// travels with the ledger state and its JSON backups with no new
// store. Legacy records carry no log and read as "no boosts".
//
// Money: the add-on fee is a ONE-TIME charge settled exactly like a
// SISP-43 billed ticket charge. The pending fee joins the Quick
// Collect payable; when a collection covers it, the settled lines ride
// the payment as `addonCharges: [{ boostId, amount }]` and core's
// allocation engine keeps that portion out of bill money, advance
// credit and the auto-package fee follow — the fee is add-on revenue,
// never package revenue. Void (SISP-34) / undo reopens exactly the
// boosts the voided payment's stamp settled. Charges settle whole,
// oldest first, only from the amount left after ALL bill dues (and
// after ticket charges) — the SISP-43 planner rule — and only on the
// Quick Collect surface, the same surface that settles ticket charges
// (Field Mode and bulk collect pass no ticket list and stay bill-only
// for charges, exactly as with SISP-43).
//
// Expiry is DERIVED live (expiryDate < today), never a stored flag, so
// it can never go stale. The MikroTik queue snippets live in
// mikrotik-generator.js (buildSpeedBoostSnippet /
// buildSpeedBoostRestoreSnippet), next to the other router text.
//
// Standing rules: a FREE connection (isFreeConnection) is never billed
// anything, so a paid boost is refused for one; a boost whose start
// falls inside an ACTIVE vacation hold (SISP-8/47) is refused — adding
// one must never unpause or bill around a hold. Tests use synthetic
// data only.
import { sanitizeSpeedBoosts } from './core.js';
import { vacationHoldState } from './pause-billing.js';

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Strict YYYY-MM-DD calendar validation (leap-aware), no Date parsing. */
export function isValidBoostDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const daysInMonth = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 30, 31, 30, 31][m - 1];
  return d <= daysInMonth;
}

/** Add whole days to a YYYY-MM-DD date (UTC math, DST-proof). */
export function addBoostDays(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 'YYYY-MM-DD' for a Date in local time (the app's date-key shape). */
export function boostDateKey(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** The customer's sanitized boost log ([] when none recorded). */
export function speedBoostsOf(customer) {
  return sanitizeSpeedBoosts(customer?.speedBoosts);
}

/** Next boost id for one customer: one above the highest BST-N, from BST-101. */
export function nextBoostId(customer) {
  let max = 100;
  for (const boost of speedBoostsOf(customer)) {
    const n = Number(String(boost.boostId).slice(4));
    if (Number.isSafeInteger(n) && n > max) max = n;
  }
  return `BST-${max + 1}`;
}

/**
 * Validate boost fields and build the record (throws on bad input).
 * expiryDate = startDate + durationDays: the boost runs through its
 * expiry date and is flagged expired only once expiryDate < today.
 */
export function createSpeedBoost(customer, fields = {}, referenceDate = new Date()) {
  const boostMbps = Number(fields.boostMbps);
  if (!Number.isFinite(boostMbps) || boostMbps <= 0 || boostMbps > 10000) {
    throw new Error('Enter a valid boost speed in Mbps (greater than zero).');
  }
  const durationDays = Number(fields.durationDays);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) {
    throw new Error('Boost duration must be a whole number of days between 1 and 365.');
  }
  const addonFeePKR = Number(fields.addonFeePKR);
  if (!Number.isFinite(addonFeePKR) || addonFeePKR <= 0) {
    throw new Error('Enter a valid add-on fee greater than zero.');
  }
  const startDate = typeof fields.startDate === 'string' && fields.startDate.trim()
    ? fields.startDate.trim()
    : boostDateKey(referenceDate);
  if (!isValidBoostDate(startDate)) throw new Error('Enter a valid boost start date.');
  return {
    boostId: nextBoostId(customer),
    boostMbps: round2(boostMbps),
    durationDays,
    addonFeePKR: round2(addonFeePKR),
    startDate,
    expiryDate: addBoostDays(startDate, durationDays),
    chargePaid: false,
    chargePaidAt: '',
    chargePaymentId: ''
  };
}

/**
 * Append a boost to a customer's log (pure state transform; the caller
 * persists). Guards: archived customers take no boosts; FREE
 * connections are never billed, so a paid add-on is refused; a boost
 * starting inside an ACTIVE vacation hold is refused (it must never
 * unpause billing — sell it when the customer resumes, or with a start
 * date after the hold).
 */
export function addSpeedBoost(state, customerId, fields = {}, referenceDate = new Date()) {
  const customer = state?.customers?.find((c) => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  if (customer.archived) throw new Error('Archived customers cannot receive speed boosts. Unarchive the customer first.');
  if (customer.isFreeConnection === true) {
    throw new Error('FREE connections are never billed — a paid speed boost cannot be added to this customer.');
  }
  const boost = createSpeedBoost(customer, fields, referenceDate);
  if (vacationHoldState(customer, boost.startDate) === 'active') {
    throw new Error('This customer is on a vacation hold — a speed boost cannot start during the hold. Resume the customer first, or pick a start date after the hold.');
  }
  const speedBoosts = [...speedBoostsOf(customer), boost];
  return {
    state: {
      ...state,
      customers: state.customers.map((c) => (c.id === customerId ? { ...c, speedBoosts } : c))
    },
    boost
  };
}

/** Derived lifecycle of one boost on a given day — never stored. */
export function speedBoostStatus(boost, todayStr) {
  const today = isValidBoostDate(todayStr) ? todayStr : boostDateKey();
  if (boost.expiryDate < today) return 'expired';
  if (boost.startDate > today) return 'upcoming';
  return 'active';
}

/** True once the boost's expiry date has passed (expiryDate < today). */
export function isSpeedBoostExpired(boost, todayStr) {
  return speedBoostStatus(boost, todayStr) === 'expired';
}

/** Unpaid add-on fee lines for one customer, oldest boost first. */
export function pendingAddonChargeLines(customer) {
  return speedBoostsOf(customer)
    .filter((boost) => !boost.chargePaid && boost.addonFeePKR > 0)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))
      || (Number(String(a.boostId).slice(4)) - Number(String(b.boostId).slice(4))))
    .map((boost) => ({ boostId: boost.boostId, amount: round2(boost.addonFeePKR) }));
}

/** Total unpaid add-on fees for one customer (PKR rupees). */
export function addonChargesPending(customer) {
  return round2(pendingAddonChargeLines(customer).reduce((sum, line) => sum + line.amount, 0));
}

/**
 * Plan which pending boost charges a collection remainder settles.
 * Whole charges only, oldest first — a boost fee is never split across
 * receipts (the SISP-43 planner rule for ticket charges).
 */
export function planAddonChargeSettlement(customer, availableCents) {
  const budget = Math.max(0, Math.floor(Number(availableCents) || 0));
  const lines = [];
  let totalCents = 0;
  for (const line of pendingAddonChargeLines(customer)) {
    const lineCents = Math.round(line.amount * 100);
    if (totalCents + lineCents > budget) break;
    lines.push(line);
    totalCents += lineCents;
  }
  return { lines, totalCents };
}

/**
 * Mark the planned boost charges paid by one recorded payment (pure
 * customer transform). The payment id is stamped on each boost so a
 * later void/undo of exactly that payment reopens exactly these
 * charges. A boost whose fee no longer matches the planned line, or
 * that is already paid, is skipped — a fee is never settled twice.
 */
export function settleAddonCharges(customer, lines, paymentId, paidDate = '') {
  const boosts = speedBoostsOf(customer);
  const wanted = new Map((Array.isArray(lines) ? lines : [])
    .map((line) => [String(line?.boostId || ''), line])
    .filter(([boostId]) => boostId));
  if (wanted.size === 0) return { ...customer, speedBoosts: boosts };
  const next = boosts.map((boost) => {
    const line = wanted.get(boost.boostId);
    if (!line || boost.chargePaid) return boost;
    if (Math.round(Number(line.amount) * 100) !== Math.round(boost.addonFeePKR * 100)) return boost;
    return {
      ...boost,
      chargePaid: true,
      chargePaidAt: typeof paidDate === 'string' ? paidDate : '',
      chargePaymentId: typeof paymentId === 'string' ? paymentId : ''
    };
  });
  return { ...customer, speedBoosts: next };
}

/**
 * Reopen the boost charges one payment settled (the void / undo
 * rollback). Only boosts whose settlement still belongs to that
 * payment are touched: a boost re-settled by a different payment is
 * left exactly as it is.
 */
export function unsettleAddonChargesForPayment(customer, payment) {
  const lines = Array.isArray(payment?.addonCharges) ? payment.addonCharges : [];
  const ids = new Set(lines.map((line) => String(line?.boostId || '')).filter(Boolean));
  const paymentId = typeof payment?.id === 'string' ? payment.id : '';
  const reopened = [];
  const next = speedBoostsOf(customer).map((boost) => {
    if (!ids.has(boost.boostId) || !boost.chargePaid) return boost;
    if (paymentId && boost.chargePaymentId && boost.chargePaymentId !== paymentId) return boost;
    reopened.push(boost.boostId);
    return { ...boost, chargePaid: false, chargePaidAt: '', chargePaymentId: '' };
  });
  return { customer: { ...customer, speedBoosts: next }, reopened };
}
