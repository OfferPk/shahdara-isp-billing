/**
 * plan82-vacation-holds.test.js — Plan 82: customer-requested
 * vacation and seasonal hold (dated, with billing treatment).
 * Pins:
 * - each hold carries exactly one customer, start date, expected
 *   return date, reason, and billing treatment; half-formed
 *   records are refused outright, never stored half-formed;
 * - no full monthly bill is raised for a month fully inside a
 *   no-bill hold, and a hold month with a retention charge shows
 *   that charge and nothing else; a partly-inside month is
 *   ordinary, never an invented pro-rata split;
 * - ending a hold early restores ordinary billing from the next
 *   cycle onward and never rewrites a month already given hold
 *   treatment;
 * - the hold creates no bill by itself and past bills are never
 *   rewritten, so the module holds no bill, payment, or package
 *   field, and the SISP-8 flat hold fields are neither read nor
 *   written here;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, or customer record is
 * ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOLD_REASONS,
  HOLD_REASON_LABELS,
  HOLD_TREATMENTS,
  HOLD_TREATMENT_LABELS,
  HOLD_STATUSES,
  validHoldDate,
  holdMohallaKey,
  normalizeHold,
  normalizeHoldList,
  findHold,
  upsertHold,
  removeHold,
  holdMonthTreatment,
  holdMonthTreatmentText,
  endHold,
  reopenHold,
  holdsFiltered,
  activeHolds,
  buildHoldSummary,
  holdSummaryText,
  holdHtml,
  holdCsv,
  holdFilename,
} from '../vacation-holds.js';

function noBillHold(overrides = {}) {
  return {
    id: 'H-001',
    customerId: 'c1',
    customerName: 'Ayesha',
    startDate: '2026-01-01',
    expectedReturnDate: '2026-03-31',
    reason: 'away',
    treatment: 'no_bill',
    status: 'active',
    mohalla: 'Bani',
    ...overrides,
  };
}

function retentionHold(overrides = {}) {
  return {
    id: 'H-002',
    customerId: 'c2',
    customerName: 'Bilal',
    startDate: '2026-01-01',
    expectedReturnDate: '2026-02-28',
    reason: 'seasonal_residence',
    treatment: 'retention',
    retentionAmount: 500,
    status: 'active',
    mohalla: 'Kishti',
    ...overrides,
  };
}

test('strict dates: impossible dates are refused, real dates kept', () => {
  assert.equal(validHoldDate('2026-02-30'), null);
  assert.equal(validHoldDate('2026-01-20'), '2026-01-20');
  assert.equal(validHoldDate('not a date'), null);
  assert.equal(validHoldDate(''), null);
});

test('catalogues are fixed: three reasons, two treatments, two statuses', () => {
  assert.deepEqual(HOLD_REASONS, ['away', 'seasonal_residence', 'other']);
  assert.deepEqual(HOLD_TREATMENTS, ['no_bill', 'retention']);
  assert.deepEqual(HOLD_STATUSES, ['active', 'ended']);
  assert.equal(HOLD_REASON_LABELS.seasonal_residence, 'Seasonal residence');
  assert.equal(HOLD_TREATMENT_LABELS.no_bill, 'No bill raised');
});

test('half-formed holds are refused outright', () => {
  assert.equal(normalizeHold(null), null);
  assert.equal(normalizeHold(noBillHold({ id: '' })), null);
  assert.equal(normalizeHold(noBillHold({ customerId: '' })), null);
  assert.equal(normalizeHold(noBillHold({ startDate: '2026-02-30' })), null);
  assert.equal(normalizeHold(noBillHold({ reason: 'holiday' })), null);
  assert.equal(normalizeHold(noBillHold({ treatment: 'half_price' })), null);
  assert.equal(normalizeHold(noBillHold({ status: 'paused' })), null);
  // Expected return must be after the start date, never on it.
  assert.equal(normalizeHold(noBillHold({ expectedReturnDate: '2026-01-01' })), null);
  assert.equal(normalizeHold(noBillHold({ expectedReturnDate: '2025-12-31' })), null);
  // A retention hold without a positive charge is half-formed.
  assert.equal(normalizeHold(retentionHold({ retentionAmount: 0 })), null);
  assert.equal(normalizeHold(retentionHold({ retentionAmount: -50 })), null);
  assert.equal(normalizeHold(retentionHold({ retentionAmount: undefined, retentionCents: undefined })), null);
  // An ended hold needs a real return date on or after the start.
  assert.equal(normalizeHold(noBillHold({ status: 'ended' })), null);
  assert.equal(normalizeHold(noBillHold({ status: 'ended', actualReturnDate: '2025-12-31' })), null);
});

test('a no-bill hold carries no retention charge, even if one was typed', () => {
  const entry = normalizeHold(noBillHold({ retentionAmount: 500 }));
  assert.equal(entry.retentionCents, null);
  assert.equal(entry.treatment, 'no_bill');
});

test('retention charge: rupees convert once, cents fields are used as-is on re-read', () => {
  const fromRupees = normalizeHold(retentionHold({ retentionAmount: 500 }));
  assert.equal(fromRupees.retentionCents, 50000);
  const reread = normalizeHold(fromRupees);
  assert.equal(reread.retentionCents, 50000);
  const fromCents = normalizeHold(retentionHold({ retentionAmount: undefined, retentionCents: 33333 }));
  assert.equal(fromCents.retentionCents, 33333);
});

test('month treatment: a month fully inside a no-bill hold raises no bill', () => {
  const hold = noBillHold();
  assert.deepEqual(holdMonthTreatment(hold, '2026-01'), { month: '2026-01', treatment: 'no_bill', chargeCents: 0, fullyInside: true });
  assert.deepEqual(holdMonthTreatment(hold, '2026-02'), { month: '2026-02', treatment: 'no_bill', chargeCents: 0, fullyInside: true });
  assert.deepEqual(holdMonthTreatment(hold, '2026-03'), { month: '2026-03', treatment: 'no_bill', chargeCents: 0, fullyInside: true });
  assert.deepEqual(holdMonthTreatment(hold, '2026-04'), { month: '2026-04', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  assert.deepEqual(holdMonthTreatment(hold, '2025-12'), { month: '2025-12', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  assert.equal(holdMonthTreatment(hold, '2026-13'), null);
  assert.equal(holdMonthTreatment(null, '2026-01'), null);
  assert.match(holdMonthTreatmentText(holdMonthTreatment(hold, '2026-01')), /no bill raised/);
  assert.match(holdMonthTreatmentText(holdMonthTreatment(hold, '2026-04')), /ordinary billing/);
});

test('month treatment: a partly-inside month is ordinary, never a pro-rata split', () => {
  const hold = noBillHold({ startDate: '2026-01-15' });
  assert.deepEqual(holdMonthTreatment(hold, '2026-01'), { month: '2026-01', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  assert.deepEqual(holdMonthTreatment(hold, '2026-02'), { month: '2026-02', treatment: 'no_bill', chargeCents: 0, fullyInside: true });
});

test('month treatment: a retention month shows that charge and nothing else', () => {
  const hold = retentionHold();
  assert.deepEqual(holdMonthTreatment(hold, '2026-01'), { month: '2026-01', treatment: 'retention', chargeCents: 50000, fullyInside: true });
  // February 2026 has 28 days and the hold ends on the 28th, so
  // February is fully inside too.
  assert.deepEqual(holdMonthTreatment(hold, '2026-02'), { month: '2026-02', treatment: 'retention', chargeCents: 50000, fullyInside: true });
  assert.deepEqual(holdMonthTreatment(hold, '2026-03'), { month: '2026-03', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  assert.match(holdMonthTreatmentText(holdMonthTreatment(hold, '2026-01')), /Rs\. 500\.00/);
});

test('ending a hold early: later months go ordinary, treated months are never rewritten', () => {
  const ended = endHold([noBillHold()], 'H-001', '2026-02-15');
  assert.equal(ended[0].status, 'ended');
  assert.equal(ended[0].actualReturnDate, '2026-02-15');
  // January was fully inside before the early end: it keeps its
  // no-bill treatment. February contains the return date
  // mid-month, so it is ordinary; March is ordinary too.
  assert.equal(holdMonthTreatment(ended[0], '2026-01').treatment, 'no_bill');
  assert.equal(holdMonthTreatment(ended[0], '2026-02').treatment, 'ordinary');
  assert.equal(holdMonthTreatment(ended[0], '2026-03').treatment, 'ordinary');
  // Returning on a month's last day keeps that month treated.
  const monthEnd = endHold([noBillHold()], 'H-001', '2026-02-28');
  assert.equal(holdMonthTreatment(monthEnd[0], '2026-02').treatment, 'no_bill');
  assert.equal(holdMonthTreatment(monthEnd[0], '2026-03').treatment, 'ordinary');
});

test('endHold only ends an active hold, and only with a real return date', () => {
  const list = [noBillHold()];
  const normalized = normalizeHoldList(list);
  assert.deepEqual(endHold(list, 'H-001', '2026-02-30'), normalized);
  assert.deepEqual(endHold(list, 'H-001', '2025-12-31'), normalized);
  assert.deepEqual(endHold(list, 'H-999', '2026-02-15'), normalized);
  const ended = endHold(list, 'H-001', '2026-02-15');
  assert.deepEqual(endHold(ended, 'H-001', '2026-02-20'), ended);
});

test('reopenHold clears the return date and restores the expected span', () => {
  const ended = endHold([noBillHold()], 'H-001', '2026-02-15');
  const reopened = reopenHold(ended, 'H-001');
  assert.equal(reopened[0].status, 'active');
  assert.equal(reopened[0].actualReturnDate, '');
  assert.equal(holdMonthTreatment(reopened[0], '2026-03').treatment, 'no_bill');
  assert.deepEqual(reopenHold(reopened, 'H-001'), reopened);
});

test('upsert, find, remove, and non-mutation', () => {
  const first = upsertHold([], noBillHold());
  assert.equal(first.length, 1);
  assert.equal(findHold(first, 'H-001').customerId, 'c1');
  const replaced = upsertHold(first, noBillHold({ reason: 'other' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].reason, 'other');
  assert.equal(first[0].reason, 'away');
  assert.equal(removeHold(replaced, 'H-001').length, 0);
  assert.equal(findHold(first, 'H-999'), null);
  assert.equal(upsertHold(first, noBillHold({ id: '' })).length, 1);
});

test('filters: status, reason, treatment, and mohalla with the Plan T rule', () => {
  const list = [
    noBillHold(),
    retentionHold(),
    noBillHold({ id: 'H-003', customerId: 'c3', customerName: 'Chand', mohalla: '', reason: 'other', startDate: '2026-02-01', expectedReturnDate: '2026-02-28' }),
  ];
  assert.equal(holdsFiltered(list, { status: 'active' }).length, 3);
  assert.equal(holdsFiltered(list, { reason: 'away' }).length, 1);
  assert.equal(holdsFiltered(list, { treatment: 'retention' }).length, 1);
  assert.equal(holdsFiltered(list, { mohalla: 'bani' }).length, 1);
  assert.equal(holdsFiltered(list, { mohalla: 'BANII' }).length, 1);
  assert.equal(holdsFiltered(list, { mohalla: '__unassigned__' }).length, 1);
  assert.equal(holdsFiltered(list, { mohalla: 'Mohalla Bani' }).length, 1);
  assert.equal(holdMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(holdMohallaKey(''), null);
  // Start-date order, then id.
  assert.deepEqual(holdsFiltered(list).map((entry) => entry.id), ['H-001', 'H-002', 'H-003']);
  assert.deepEqual(activeHolds(list).map((entry) => entry.id), ['H-001', 'H-002', 'H-003']);
});

test('summary totals are exact, in integer cents', () => {
  const summary = buildHoldSummary([noBillHold(), retentionHold()]);
  assert.equal(summary.total, 2);
  assert.equal(summary.active, 2);
  assert.equal(summary.ended, 0);
  assert.equal(summary.byReason.away, 1);
  assert.equal(summary.byReason.seasonal_residence, 1);
  assert.equal(summary.byTreatment.retention, 1);
  assert.equal(summary.retentionTotalCents, 50000);
  assert.match(holdSummaryText(summary), /2 holds recorded — 2 active, 0 ended/);
  assert.match(holdSummaryText(summary), /Rs\. 500\.00/);
});

test('no bill, payment, or package field is held, and SISP-8 fields are untouched', () => {
  const entry = normalizeHold(noBillHold({ requestId: 'REQ-9' }));
  for (const key of Object.keys(entry)) {
    assert.doesNotMatch(key, /bill|payment|package/i);
  }
  assert.equal(entry.requestId, 'REQ-9');
  // The SISP-8 flat hold fields live on the customer record, not
  // here: normalising a hold never produces them.
  assert.equal(entry.paused, undefined);
  assert.equal(entry.pauseStartDate, undefined);
  assert.equal(entry.autoResumeDate, undefined);
  assert.equal(entry.pauseSkippedMonths, undefined);
});

test('HTML escaping, CSV quoting, and filename', () => {
  const nasty = noBillHold({ customerName: '<b>Ayesha & Co</b>', mohalla: 'Bani, "Old"' });
  const html = holdHtml([nasty]);
  assert.doesNotMatch(html, /<b>Ayesha/);
  assert.match(html, /&lt;b&gt;Ayesha &amp; Co&lt;\/b&gt;/);
  const csv = holdCsv([nasty]);
  assert.match(csv, /"Bani, ""Old"""/);
  assert.equal(holdFilename(), 'vacation-holds.csv');
  assert.equal(holdHtml([]), '<p class="empty-state">No holds recorded.</p>');
});
