/**
 * plan56-at-risk-signals.test.js — Plan 56: at-risk customer signals
 * list (read-only, operator thresholds).
 * Pins:
 * - date validation and threshold normalisation (invalid falls back
 *   to defaults, never to a zero threshold that flags everyone);
 * - a customer appears exactly when at least one threshold is met,
 *   with the triggering signals shown;
 * - payment-lateness drift (average over the recent window plus a
 *   minimum late-month count), and clearing when a payment is made
 *   on time;
 * - repeat-fault, unhappy, and contact-gap signals, and gap honesty
 *   (invalid or missing dates never signal);
 * - sorting (most signals first, then name A–Z), non-mutation, and
 *   the fence: no bill, payment, Waada, ticket, or customer-status
 *   field on any row, and nothing is written.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AT_RISK_SIGNAL_TYPES,
  DEFAULT_AT_RISK_THRESHOLDS,
  validAtRiskDate,
  normalizeAtRiskThresholds,
  buildAtRiskList,
  atRiskSummaryText,
  atRiskHtml,
  atRiskCsv,
  atRiskFilename,
} from '../at-risk-signals.js';

const customers = [
  { id: 'C1', name: 'Ahmed', mohalla: 'Bani' },
  { id: 'C2', name: 'Bilal', mohalla: 'Kishti' },
  { id: 'C3', name: 'Chaudhry', mohalla: '' },
  { id: 'C4', name: 'Danish', mohalla: 'Chamyaa' },
];

const TODAY = '2026-11-04';

test('date validation rejects impossible dates', () => {
  assert.equal(validAtRiskDate('2026-11-04'), true);
  assert.equal(validAtRiskDate('2024-02-29'), true);
  assert.equal(validAtRiskDate('2026-02-30'), false);
  assert.equal(validAtRiskDate('2026-13-01'), false);
  assert.equal(validAtRiskDate('04-11-2026'), false);
  assert.equal(validAtRiskDate(null), false);
});

test('threshold normalisation falls back to defaults, never to zero', () => {
  assert.deepEqual(normalizeAtRiskThresholds(), { ...DEFAULT_AT_RISK_THRESHOLDS });
  assert.deepEqual(normalizeAtRiskThresholds({ lateDays: 0, recentMonths: -2, minLateMonths: 1.5, gapDays: 'abc' }), {
    ...DEFAULT_AT_RISK_THRESHOLDS,
    minLateMonths: DEFAULT_AT_RISK_THRESHOLDS.minLateMonths,
  });
  assert.deepEqual(normalizeAtRiskThresholds({ lateDays: 10, gapDays: 30 }), {
    ...DEFAULT_AT_RISK_THRESHOLDS,
    lateDays: 10,
    gapDays: 30,
  });
});

test('empty inputs list nobody', () => {
  const view = buildAtRiskList({ customers, today: TODAY });
  assert.deepEqual(view.rows, []);
  assert.equal(atRiskSummaryText(view), 'No customer meets an at-risk threshold right now.');
});

test('payment lateness drift signals on average plus late-month count', () => {
  const view = buildAtRiskList({
    customers,
    paymentLateness: [
      { customerId: 'C1', latenessDays: [10, 12, 14] },
      // Average below the 7-day threshold: no signal, even with late months.
      { customerId: 'C2', latenessDays: [2, 3, 1] },
      // Only one late month: below the minLateMonths count, no signal.
      { customerId: 'C3', latenessDays: [0, 0, 20] },
    ],
    today: TODAY,
  });
  assert.deepEqual(view.rows.map((r) => r.customerId), ['C1']);
  assert.deepEqual(view.rows[0].signals.map((s) => s.type), [AT_RISK_SIGNAL_TYPES.PAYMENT_LATE_DRIFT]);
  assert.match(view.rows[0].signals[0].detail, /12\.0 days late/);
});

test('a payment made on time clears the lateness signal', () => {
  const before = buildAtRiskList({
    customers,
    paymentLateness: [{ customerId: 'C1', latenessDays: [10, 12, 14] }],
    today: TODAY,
  });
  assert.equal(before.rows.length, 1);
  // The newest month is paid early, pulling the window average down.
  const after = buildAtRiskList({
    customers,
    paymentLateness: [{ customerId: 'C1', latenessDays: [12, 14, -10] }],
    today: TODAY,
  });
  assert.deepEqual(after.rows, []);
});

test('only the recent window counts for lateness', () => {
  const view = buildAtRiskList({
    customers,
    paymentLateness: [{ customerId: 'C1', latenessDays: [30, 30, 30, 0, 0] }],
    today: TODAY,
  });
  assert.deepEqual(view.rows, []);
});

test('repeat-fault, unhappy, and gap signals each flag a customer', () => {
  const view = buildAtRiskList({
    customers,
    repeatFaults: [{ customerId: 'C2', count: 3 }],
    satisfactionNotes: [{ customerId: 'C3', rating: 'unhappy' }],
    lastActivity: [{ customerId: 'C4', lastDate: '2026-08-01' }],
    today: TODAY,
  });
  assert.deepEqual(view.rows.map((r) => r.customerId), ['C2', 'C3', 'C4']);
  assert.deepEqual(view.rows[0].signals.map((s) => s.type), [AT_RISK_SIGNAL_TYPES.REPEAT_FAULTS]);
  assert.match(view.rows[0].signals[0].detail, /3 tickets/);
  assert.deepEqual(view.rows[1].signals.map((s) => s.type), [AT_RISK_SIGNAL_TYPES.UNHAPPY]);
  assert.deepEqual(view.rows[2].signals.map((s) => s.type), [AT_RISK_SIGNAL_TYPES.CONTACT_GAP]);
  assert.match(view.rows[2].signals[0].detail, /95 days/);
});

test('repeat faults accept bare customer ids; satisfied notes never signal', () => {
  const view = buildAtRiskList({
    customers,
    repeatFaults: ['C1'],
    satisfactionNotes: [
      { customerId: 'C2', rating: 'satisfied' },
      { customerId: 'C3', rating: 'neutral' },
    ],
    today: TODAY,
  });
  assert.deepEqual(view.rows.map((r) => r.customerId), ['C1']);
});

test('gap honesty: invalid, future, and recent dates never signal', () => {
  const view = buildAtRiskList({
    customers,
    lastActivity: [
      { customerId: 'C1', lastDate: '2026-02-30' },
      { customerId: 'C2', lastDate: '2026-11-04' },
      { customerId: 'C3', lastDate: '2026-12-01' },
      { customerId: 'C4', lastDate: '2026-09-05' },
    ],
    today: TODAY,
  });
  // C4 is exactly 60 days back: the threshold is inclusive.
  assert.deepEqual(view.rows.map((r) => r.customerId), ['C4']);
});

test('most signals first, then name A–Z; unknown customers never listed', () => {
  const view = buildAtRiskList({
    customers,
    paymentLateness: [{ customerId: 'C2', latenessDays: [10, 11, 12] }],
    repeatFaults: [{ customerId: 'C2', count: 4 }],
    satisfactionNotes: [{ customerId: 'C1', rating: 'unhappy' }],
    lastActivity: [
      { customerId: 'C9', lastDate: '2020-01-01' },
      { customerId: 'C4', lastDate: '2026-01-01' },
    ],
    today: TODAY,
  });
  assert.deepEqual(view.rows.map((r) => r.customerId), ['C2', 'C1', 'C4']);
  assert.equal(view.rows[0].signalCount, 2);
});

test('inputs are never mutated and rows carry no record field', () => {
  const input = {
    customers,
    paymentLateness: [{ customerId: 'C1', latenessDays: [10, 12, 14] }],
    repeatFaults: [{ customerId: 'C1', count: 3 }],
    today: TODAY,
  };
  const snapshot = JSON.stringify(input);
  const view = buildAtRiskList(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(view.rows.length, 1);
  for (const key of Object.keys(view.rows[0])) {
    assert.ok(!['bill', 'payment', 'waada', 'ticket', 'status', 'archived'].includes(key), key);
  }
  assert.equal(atRiskSummaryText(view), '1 at-risk customer, 2 signals in total.');
});

test('HTML escapes names and CSV quotes fields; filename is stable', () => {
  const view = buildAtRiskList({
    customers: [{ id: 'C1', name: 'A<b>&"X"', mohalla: 'Bani' }],
    repeatFaults: ['C1'],
    today: TODAY,
  });
  const html = atRiskHtml(view);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(html.includes('data-at-risk-customer-id="C1"'));
  const csv = atRiskCsv(view);
  assert.ok(csv.startsWith('customerId,customerName,mohalla,signalCount,signals'));
  assert.ok(csv.includes('"A<b>&""X"""'));
  assert.equal(atRiskFilename(), 'at-risk-signals.csv');
});
