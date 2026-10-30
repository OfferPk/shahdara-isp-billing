/**
 * collection-forecaster.js — SISP-54 [P1]: Monthly Collection Target
 * Thermometer & Area-Wise Daily Run-Rate Forecaster
 * ("ماہانہ ریکوری ٹارگٹ اور رفتار").
 *
 * Spec (read-latest.txt, SISP-54 block): "Show a live Monthly
 * Collection Thermometer on the dashboard (Collected So Far vs Total
 * Billed + Arrears), required daily collection run-rate for the
 * remaining days of the month, and area-by-area progress bars…"
 * Test criterion: "With Rs. 150,000 collected out of Rs. 210,000
 * billed and 10 days remaining in the month, the forecaster reports
 * 71.4% progress and Rs. 6,000/day required run-rate."
 *
 * This module is a PURE builder in the advance-dashboard.js mould: it
 * reads the ledger and returns figures. It writes nothing, mutates
 * nothing, adds no storage keys, and changes NO money logic. It does
 * NOT use the owner-set target of dashboard-collection-target.js
 * (a separate, manually configured goal stored on the device) — the
 * SISP-54 thermometer's target is derived from the ledger itself, as
 * the spec text states: Total Billed + Arrears.
 *
 * Definitions (pinned by tests/collection-forecaster.test.js):
 *   1. billedCents — the month's billed total: the sum, over every
 *      customer, of the allocation engine's billAmountCents for the
 *      selected month (calculatePaymentAllocations: a priced bill's
 *      dueAmount + lateFee + shiftingFee). Unpriced bills (amount not
 *      set) contribute nothing — there is no priced obligation yet.
 *   2. arrearsCents — arrears carried INTO the month: for every bill
 *      of an earlier month, billAmountCents minus the SISP-50 deposit
 *      offset stamped on that bill minus the SISP-64 bad-debt
 *      write-off stamped on that bill minus everything the engine had
 *      already applied to that bill from payments DATED BEFORE the
 *      selected month (same-month, carry-forward and discount
 *      allocations recorded on each payment's ledger). Measuring
 *      arrears at the START of the month keeps the target fixed while
 *      the month runs: recovering an old due never shrinks the target
 *      mid-month.
 *   3. targetCents = billedCents + arrearsCents — the month's
 *      collection pool: everything the month is expected to recover.
 *      Never hard-coded, never read from a settings field: it is the
 *      month's own ledger truth.
 *   4. outstandingCents — what the pool still owes RIGHT NOW: the
 *      sum of the engine's balanceDueCents over every bill of the
 *      selected and earlier months. The engine excludes voided
 *      payments before allocating, so a voided receipt never reduces
 *      the outstanding figure.
 *   5. collectedCents = targetCents − outstandingCents (floored at
 *      0): the part of the pool already recovered — by this month's
 *      cash receipts, by earlier receipts the engine carries forward
 *      as credit onto this month's bills, or by an applied discount.
 *      Deliberately NOT the same figure as the Home KPI card's
 *      cash-by-date month collection: an advance paid last month and
 *      consumed by this month's generated bill counts HERE (the bill
 *      is recovered), while unapplied advance cash does not (it
 *      belongs to a future month's pool). "Credit is not a second
 *      payment" — it is counted once, in the month whose bill it
 *      settles.
 *   6. progressPercent = collected / target × 100, one decimal
 *      (150000 / 210000 → 71.4). Null when the target is 0 (nothing
 *      billed yet — no honest percentage exists). By construction it
 *      never exceeds 100: the thermometer measures pool recovery.
 *   7. remainingCents = outstandingCents — exactly the money still
 *      owed on the pool (so target − collected = remaining always).
 *   8. requiredDailyRunRateCents — what must be collected per
 *      remaining day: ceil(remaining / daysRemaining) so the rate is
 *      always sufficient. On the month's LAST day (daysRemaining 0)
 *      the whole remainder is due today, so the rate is the remainder
 *      itself; for a PAST month the run is over and the rate is 0.
 *      Spec check: (210000 − 150000) / 10 days = Rs. 6,000/day.
 *   9. Days are Pakistan Time (Asia/Karachi), matching core.js and
 *      dashboard-collection-target.js: daysRemaining =
 *      daysInMonth − currentDay for the current month (today counts
 *      as an elapsed collection day in the pace, not as a remaining
 *      day — the shipped target module's convention). Partial
 *      months: a past month reports daysRemaining 0 and its final
 *      progress; a future month reports the full month ahead.
 *  10. actualDailyPaceCents = collected / daysElapsed (elapsed =
 *      currentDay in the current month, daysInMonth for a past
 *      month, 0 for a future month), and projectedMonthEndCents =
 *      collected + pace × daysRemaining — the run-rate FORECAST.
 *  11. areas — the same billed/arrears/outstanding trio computed per
 *      area, grouped by canonicalMohalla (phase3.js — the Mohalla
 *      Dashboard's grouping, so "Mohalla Bani" and "BANII" are one
 *      area, and a non-canonical stored name keeps its own label).
 *      An area appears only when it has a target or a recovery in
 *      the month (no-activity areas stay hidden, the owner's Mohalla
 *      Dashboard rule); customers with no mohalla set count toward
 *      the totals but have no area bar. Areas sort by remaining
 *      descending (most still to collect first), ties by label.
 *  12. Every customer counts, archived included — the same basis as
 *      core.js monthlyClosingMetrics and the SISP-51 owner khata:
 *      an archived customer's unsettled bill is still money owed
 *      (a SISP-50 deposit offset reduces it through definition 2, and
 *      a SISP-64 bad-debt write-off removes it the same way — money
 *      declared uncollectible is no longer a collection target).
 *      FREE connections simply have no bills and contribute nothing.
 *
 * Tests use synthetic data only.
 */

import { calculatePaymentAllocations } from './core.js';
import { canonicalMohalla } from './phase3.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const cents = value => Math.round(Number(value || 0) * 100);

function pktMonthAndDay(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: 'numeric'
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const day = Number(parts.find(p => p.type === 'day')?.value || 1);
  return { month: `${year}-${month}`, day };
}

function daysInMonthOf(month) {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).getUTCDate();
}

function blankBucket() {
  return { billedCents: 0, arrearsCents: 0, outstandingCents: 0 };
}

function finishBucket(bucket) {
  const targetCents = bucket.billedCents + bucket.arrearsCents;
  const outstandingCents = bucket.outstandingCents;
  const collectedCents = Math.max(0, targetCents - outstandingCents);
  const progressPercent = targetCents > 0
    ? Number(((collectedCents / targetCents) * 100).toFixed(1))
    : null;
  return {
    billedCents: bucket.billedCents,
    arrearsCents: bucket.arrearsCents,
    targetCents,
    outstandingCents,
    collectedCents,
    remainingCents: outstandingCents,
    progressPercent
  };
}

/**
 * Build the collection thermometer + run-rate forecast for one month.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {string} month - 'YYYY-MM'; anything else falls back to the
 *   reference date's Pakistan-Time month (never a guessed figure).
 * @param {Date} [referenceDate=new Date()] - "today" for day metrics.
 * @returns {object} Forecast figures (see header definitions), with an
 *   `areas` array of the same per-area figures.
 */
export function buildCollectionForecast(state, month, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  const pkt = pktMonthAndDay(ref);
  const selected = typeof month === 'string' && MONTH_RE.test(month) ? month : pkt.month;

  const daysInMonth = daysInMonthOf(selected);
  const isCurrentMonth = selected === pkt.month;
  const isPastMonth = selected < pkt.month;
  const isFutureMonth = selected > pkt.month;
  const currentDay = isCurrentMonth ? pkt.day : isPastMonth ? daysInMonth : 0;
  const daysElapsed = currentDay;
  const daysRemaining = Math.max(0, daysInMonth - currentDay);
  const firstOfMonth = `${selected}-01`;

  const customers = (Array.isArray(state?.customers) ? state.customers : [])
    .filter(customer => customer && typeof customer === 'object');
  const allocations = calculatePaymentAllocations({ customers });

  // Allocations the engine applied to pre-month bills from payments
  // dated BEFORE the selected month — the "already settled" part of
  // the arrears pool at the month's start (definition 2).
  const appliedBeforeMonth = new Map();
  for (const ledger of allocations.byPaymentId.values()) {
    const date = typeof ledger?.date === 'string' ? ledger.date : '';
    if (!DATE_RE.test(date) || date >= firstOfMonth) continue;
    for (const allocation of (Array.isArray(ledger.allocations) ? ledger.allocations : [])) {
      if (!allocation || typeof allocation.month !== 'string' || allocation.month >= selected) continue;
      const key = `${ledger.customerId}|${allocation.month}`;
      appliedBeforeMonth.set(key, (appliedBeforeMonth.get(key) ?? 0) + (Number(allocation.amountCents) || 0));
    }
  }

  const totals = blankBucket();
  const areaBuckets = new Map();
  const areaBucketFor = customer => {
    const canonical = canonicalMohalla(customer.mohalla || customer.area || '');
    if (!canonical) return null;
    if (!areaBuckets.has(canonical.key)) {
      areaBuckets.set(canonical.key, { key: canonical.key, label: canonical.label, ...blankBucket() });
    }
    return areaBuckets.get(canonical.key);
  };

  for (const customer of customers) {
    const area = areaBucketFor(customer);
    const add = (field, amountCents) => {
      if (!(amountCents > 0)) return;
      totals[field] += amountCents;
      if (area) area[field] += amountCents;
    };

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (!bill || typeof bill !== 'object' || typeof bill.month !== 'string') continue;
      if (bill.month > selected) continue;
      const summary = allocations.forMonth(customer.id, bill.month);
      if (!summary || summary.billAmountCents === null || summary.billAmountCents === undefined) continue;
      if (bill.month === selected) {
        // Billed: this month's priced bill total (definition 1).
        add('billedCents', summary.billAmountCents);
      } else {
        // Arrears: earlier bills, net of what was already applied
        // before this month began (definition 2).
        const settledBefore = (appliedBeforeMonth.get(`${customer.id}|${bill.month}`) ?? 0)
          + cents(bill.depositOffsetAmount || 0)
          + cents(bill.badDebtWriteOffAmount || 0);
        add('arrearsCents', Math.max(0, summary.billAmountCents - settledBefore));
      }
      // Outstanding: the engine's live balance on every pool bill
      // (definition 4). Unpriced bills carry a null balance and are
      // skipped — nothing priced is owed on them yet.
      if (summary.balanceDueCents !== null && summary.balanceDueCents !== undefined) {
        add('outstandingCents', summary.balanceDueCents);
      }
    }
  }

  const finished = finishBucket(totals);

  let requiredDailyRunRateCents = 0;
  if (!isPastMonth) {
    if (daysRemaining > 0) {
      requiredDailyRunRateCents = Math.ceil(finished.remainingCents / daysRemaining);
    } else if (isCurrentMonth) {
      requiredDailyRunRateCents = finished.remainingCents;
    }
  }
  const actualDailyPaceCents = daysElapsed > 0 ? Math.round(finished.collectedCents / daysElapsed) : 0;
  const projectedMonthEndCents = finished.collectedCents + actualDailyPaceCents * daysRemaining;

  const areas = [...areaBuckets.values()]
    .map(bucket => {
      const done = finishBucket(bucket);
      return {
        key: bucket.key,
        label: bucket.label,
        billedCents: done.billedCents,
        arrearsCents: done.arrearsCents,
        targetCents: done.targetCents,
        collectedCents: done.collectedCents,
        remainingCents: done.remainingCents,
        progressPercent: done.progressPercent
      };
    })
    .filter(area => area.targetCents > 0 || area.collectedCents > 0)
    .sort((a, b) => b.remainingCents - a.remainingCents || a.label.localeCompare(b.label));

  return {
    month: selected,
    billedCents: finished.billedCents,
    arrearsCents: finished.arrearsCents,
    targetCents: finished.targetCents,
    outstandingCents: finished.outstandingCents,
    collectedCents: finished.collectedCents,
    remainingCents: finished.remainingCents,
    progressPercent: finished.progressPercent,
    hasTarget: finished.targetCents > 0,
    daysInMonth,
    currentDay,
    daysElapsed,
    daysRemaining,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    requiredDailyRunRateCents,
    actualDailyPaceCents,
    projectedMonthEndCents,
    areas
  };
}
