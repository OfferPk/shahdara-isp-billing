/**
 * collection-velocity.js — SISP-144: Dashboard "Collection Velocity"
 * card (4-bucket monthly collection curve).
 *
 * Groups one month's collected cash into four day-of-month buckets
 * (Days 1–5, 6–10, 11–20, 21–31) and compares each bucket against the
 * same bucket of the previous calendar month. The card answers "when
 * did this month's money actually arrive, and is it arriving earlier
 * or later than last month?"
 *
 * This module is PURE derivation + rendering: it reads the ledger and
 * returns figures / HTML strings. It writes nothing, mutates nothing,
 * adds no storage keys, and changes NO money logic.
 *
 * Definitions (pinned by tests/collection-velocity.test.js):
 *   1. COLLECTIONS source set — exactly the payment set the app's
 *      financial reports enumerate: phase3.js `paymentEntries(state)`
 *      (every bill's payments across the de-duplicated customer/bill
 *      rows — the same enumeration the partner-share report and the
 *      Owner Khata channel split consume). A payment counts in the
 *      month of its own `date` (cash basis, the P&L rule), never in
 *      its bill's month.
 *   2. VOIDED payments (SISP-34, payment.voided === true) NEVER count
 *      as collected — the app-wide rule is that voided payments are
 *      skipped everywhere (isVoidedPayment from payment-void-audit.js).
 *   3. AMOUNT = the payment's recorded `amount` only. A payment's
 *      `discount` portion is NOT cash and is never added — this is
 *      exactly dashboard-pnl.js's income treatment (income sums
 *      payment.amount; discounts settle dues but are not receipts).
 *      Advance/prepay and every other recorded payment kind counts the
 *      same way the P&L counts it: by its amount, in its date's month.
 *   4. BUCKETS by the payment date's day-of-month: 1–5, 6–10, 11–20,
 *      21–end-of-month. The fourth bucket's NAME stays "21–31" (the
 *      spec's label) but membership is day >= 21, so a February
 *      payment on day 28 (or 29) lands in bucket 4. Malformed dates
 *      never enter any bucket (never guessed).
 *   5. pct = bucket ÷ month total × 100, rounded to 1 decimal. When
 *      the month total is 0 every pct is null and renders "—" (never
 *      NaN / Infinity).
 *   6. COMPARISON — the previous calendar month is computed by the
 *      SAME builder (addMonths(month, -1)). Per bucket: deltaCents =
 *      this month − previous month (always a real figure, shown even
 *      when the previous month collected nothing); shareDeltaPp =
 *      this pct − previous pct in percentage points, computed ONLY
 *      when BOTH months have a non-zero total (both pcts exist) —
 *      otherwise null and rendered "—". No figure is ever estimated,
 *      carried over, or interpolated.
 *
 * Tests use synthetic data only.
 */

import { paymentEntries, addMonths } from './phase3.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const centsOf = value => Math.round(Number(value || 0) * 100);
const rupeesOf = cents => Number((cents / 100).toFixed(2));

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The four day-of-month buckets, in display order. `labelKey` is the
 * nav-language.js key for the bucket's name; the day range in the key
 * name is the bucket's identity, not a promise about short months. */
export const COLLECTION_VELOCITY_BUCKETS = Object.freeze([
  Object.freeze({ key: 'd1_5', fromDay: 1, toDay: 5, labelKey: 'vel_bucket_1_5' }),
  Object.freeze({ key: 'd6_10', fromDay: 6, toDay: 10, labelKey: 'vel_bucket_6_10' }),
  Object.freeze({ key: 'd11_20', fromDay: 11, toDay: 20, labelKey: 'vel_bucket_11_20' }),
  Object.freeze({ key: 'd21_31', fromDay: 21, toDay: 31, labelKey: 'vel_bucket_21_31' })
]);

function bucketIndexForDay(day) {
  for (let i = 0; i < COLLECTION_VELOCITY_BUCKETS.length; i += 1) {
    const bucket = COLLECTION_VELOCITY_BUCKETS[i];
    if (day >= bucket.fromDay && day <= bucket.toDay) return i;
  }
  return -1;
}

const pctOf = (partCents, totalCents) => (totalCents > 0
  ? Number(((partCents / totalCents) * 100).toFixed(1))
  : null);

/**
 * Build the 4-bucket collection velocity for one month.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {string} month - 'YYYY-MM'. A malformed month never guesses a
 *   figure: it returns the zero model with month echoed as given.
 * @returns {{month: string, totalCents: number, buckets: Array<{
 *   key: string, fromDay: number, toDay: number, labelKey: string,
 *   amountCents: number, pct: number|null }>}}
 */
export function buildCollectionVelocity(state, month) {
  const validMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : '';
  const amounts = COLLECTION_VELOCITY_BUCKETS.map(() => 0);
  if (validMonth) {
    for (const { payment } of paymentEntries(state ?? {})) {
      if (!payment || typeof payment !== 'object') continue;
      if (isVoidedPayment(payment)) continue;
      const date = typeof payment.date === 'string' ? payment.date : '';
      if (!DATE_RE.test(date) || date.slice(0, 7) !== validMonth) continue;
      const day = Number(date.slice(8, 10));
      const index = bucketIndexForDay(day);
      if (index < 0) continue;
      const amountCents = centsOf(payment.amount);
      if (Number.isFinite(amountCents)) amounts[index] += amountCents;
    }
  }
  const totalCents = amounts.reduce((sum, value) => sum + value, 0);
  return {
    month: typeof month === 'string' ? month : '',
    totalCents,
    buckets: COLLECTION_VELOCITY_BUCKETS.map((bucket, index) => ({
      ...bucket,
      amountCents: amounts[index],
      pct: pctOf(amounts[index], totalCents)
    }))
  };
}

/**
 * Build the velocity for a month plus its previous-month comparison.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {string} month - 'YYYY-MM'.
 * @returns {{month: string, previousMonth: string, totalCents: number,
 *   previousTotalCents: number, totalDeltaCents: number, buckets:
 *   Array<object>}} each bucket additionally carries prevAmountCents,
 *   deltaCents and shareDeltaPp (null when either month's total is 0).
 */
export function buildCollectionVelocityComparison(state, month) {
  const current = buildCollectionVelocity(state, month);
  const validMonth = typeof month === 'string' && MONTH_RE.test(month) ? month : '';
  const previousMonth = validMonth ? addMonths(validMonth, -1) : '';
  const previous = buildCollectionVelocity(state, previousMonth);
  return {
    month: current.month,
    previousMonth,
    totalCents: current.totalCents,
    previousTotalCents: previous.totalCents,
    totalDeltaCents: current.totalCents - previous.totalCents,
    buckets: current.buckets.map((bucket, index) => {
      const prev = previous.buckets[index];
      return {
        ...bucket,
        prevAmountCents: prev.amountCents,
        deltaCents: bucket.amountCents - prev.amountCents,
        shareDeltaPp: bucket.pct !== null && prev.pct !== null
          ? Number((bucket.pct - prev.pct).toFixed(1))
          : null
      };
    })
  };
}

const signedMoney = cents => {
  const value = rupeesOf(cents);
  return `${value > 0 ? '+' : ''}${formatPKR(value)}`;
};

const signedPp = pp => `${pp > 0 ? '+' : ''}${pp.toFixed(1)} pp`;

const deltaClass = cents => (cents > 0 ? 'vel-delta-up' : cents < 0 ? 'vel-delta-down' : 'vel-delta-flat');

/**
 * Render the card body rows (one per bucket) for the Dashboard
 * Collection Velocity card. Pure string building — no DOM access, no
 * mutation. Amounts via formatPKR; pct/days stay Latin digits; a null
 * pct or share delta renders "—".
 *
 * @param {object} comparison - buildCollectionVelocityComparison output.
 * @param {string} [lang] - 'en' | 'ur' (defaults to the app language).
 * @returns {string} HTML for the rows container.
 */
export function renderCollectionVelocityRowsHtml(comparison, lang = null) {
  const buckets = Array.isArray(comparison?.buckets) ? comparison.buckets : [];
  const rows = buckets.map(bucket => {
    const pctText = bucket.pct === null || bucket.pct === undefined ? '—' : `${bucket.pct.toFixed(1)}%`;
    const barWidth = bucket.pct === null || bucket.pct === undefined ? 0 : Math.min(100, Math.max(0, bucket.pct));
    const deltaText = `${signedMoney(bucket.deltaCents ?? 0)} · ${bucket.shareDeltaPp === null || bucket.shareDeltaPp === undefined ? '—' : signedPp(bucket.shareDeltaPp)}`;
    return `<div class="vel-row">
      <span class="vel-row-label">${escapeHtml(t(bucket.labelKey, lang))}</span>
      <span class="vel-row-bar" aria-hidden="true"><span class="vel-row-bar-fill" style="width:${barWidth.toFixed(1)}%"></span></span>
      <strong class="vel-row-amount">${escapeHtml(formatPKR(rupeesOf(bucket.amountCents ?? 0)))}</strong>
      <span class="vel-row-pct">${escapeHtml(pctText)}</span>
      <span class="vel-row-delta ${deltaClass(bucket.deltaCents ?? 0)}" title="${escapeHtml(t('vel_vs_prev', lang))}">${escapeHtml(deltaText)}</span>
    </div>`;
  }).join('');
  return `<div class="vel-rows">${rows}</div>`;
}
