import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERT_TYPES,
  DEFAULT_ALERT_THRESHOLDS,
  isValidAlertDate,
  alertWaadaOverdueDays,
  normalizeAlertThresholds,
  buildAlertsInbox,
  alertsInboxSummaryText,
  alertsInboxHtml,
} from '../alerts-inbox.js';

const TODAY = '2026-11-03';

const waada = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ayesha',
  promiseDate: '2026-10-27',
  amount: 9000,
  ...overrides,
});
const suspense = (overrides = {}) => ({
  suspenseId: 'S-1',
  amount: 4000,
  ageDays: 40,
  ...overrides,
});
const outstanding = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ayesha',
  amount: 15000,
  ...overrides,
});
const inbox = (overrides = {}) => buildAlertsInbox({
  today: TODAY,
  waadaItems: [],
  suspenseItems: [],
  outstandingItems: [],
  ...overrides,
});

// ---- dates ----

test('alert dates: YYYY-MM-DD only, no calendar rollover', () => {
  assert.equal(isValidAlertDate('2026-11-03'), true);
  assert.equal(isValidAlertDate('2026-02-30'), false);
  assert.equal(isValidAlertDate('2026-13-01'), false);
  assert.equal(isValidAlertDate('2026-11-3'), false);
  assert.equal(isValidAlertDate(''), false);
  assert.equal(isValidAlertDate(null), false);
  assert.equal(isValidAlertDate('2026-11-03T00:00'), false);
});

test('waada overdue days: exact count, today and future are 0, invalid is null', () => {
  assert.equal(alertWaadaOverdueDays('2026-10-27', TODAY), 7);
  assert.equal(alertWaadaOverdueDays('2026-11-03', TODAY), 0);
  assert.equal(alertWaadaOverdueDays('2026-11-10', TODAY), 0);
  assert.equal(alertWaadaOverdueDays('not-a-date', TODAY), null);
  assert.equal(alertWaadaOverdueDays('2026-10-27', 'bad'), null);
});

// ---- thresholds ----

test('threshold defaults apply when input is missing or empty', () => {
  assert.deepEqual(normalizeAlertThresholds(), DEFAULT_ALERT_THRESHOLDS);
  assert.deepEqual(normalizeAlertThresholds({}), DEFAULT_ALERT_THRESHOLDS);
  assert.deepEqual(normalizeAlertThresholds(null), DEFAULT_ALERT_THRESHOLDS);
});

test('thresholds: valid custom values are kept', () => {
  assert.deepEqual(normalizeAlertThresholds({
    waadaOverdueDays: 14,
    suspenseUnclaimedDays: 60,
    largeOutstandingAmount: 25000,
  }), { waadaOverdueDays: 14, suspenseUnclaimedDays: 60, largeOutstandingAmount: 25000 });
});

test('thresholds: zero, negative and non-numeric values fall back to defaults, never to zero', () => {
  const out = normalizeAlertThresholds({
    waadaOverdueDays: 0,
    suspenseUnclaimedDays: -5,
    largeOutstandingAmount: 'abc',
  });
  assert.deepEqual(out, DEFAULT_ALERT_THRESHOLDS);
});

test('thresholds: fractional day counts floor, amounts round', () => {
  const out = normalizeAlertThresholds({
    waadaOverdueDays: 7.9,
    suspenseUnclaimedDays: 30.2,
    largeOutstandingAmount: 10000.6,
  });
  assert.equal(out.waadaOverdueDays, 7);
  assert.equal(out.suspenseUnclaimedDays, 30);
  assert.equal(out.largeOutstandingAmount, 10001);
});

test('threshold normalisation returns a fresh object and does not mutate input', () => {
  const input = { waadaOverdueDays: 3 };
  const out = normalizeAlertThresholds(input);
  out.waadaOverdueDays = 99;
  assert.equal(input.waadaOverdueDays, 3);
  assert.notEqual(out, input);
});

// ---- waada alerts ----

test('waada alert: below threshold excluded, exactly at threshold included', () => {
  const below = inbox({ waadaItems: [waada({ promiseDate: '2026-10-28' })] }); // 6 days
  assert.equal(below.alerts.length, 0);
  const at = inbox({ waadaItems: [waada({ promiseDate: '2026-10-27' })] }); // 7 days
  assert.equal(at.alerts.length, 1);
  assert.equal(at.alerts[0].type, ALERT_TYPES.WAADA_OVERDUE);
});

test('waada alert: names the customer, the days overdue, the threshold and the action screen', () => {
  const view = inbox({ waadaItems: [waada()] });
  const alert = view.alerts[0];
  assert.equal(alert.title, 'Ayesha');
  assert.match(alert.detail, /7 days overdue/);
  assert.match(alert.detail, /Rs\. 9,000/);
  assert.match(alert.thresholdText, /7 days or more/);
  assert.equal(alert.actionScreen, 'Customer profile (Waada promise)');
});

test('waada severity: 15+ days is high, below that is medium', () => {
  const medium = inbox({ waadaItems: [waada({ promiseDate: '2026-10-20' })] }); // 14 days
  assert.equal(medium.alerts[0].severity, 'medium');
  const high = inbox({ waadaItems: [waada({ promiseDate: '2026-10-19' })] }); // 15 days
  assert.equal(high.alerts[0].severity, 'high');
});

test('waada alert: invalid promise date and due-today promises never alert', () => {
  const view = inbox({ waadaItems: [
    waada({ customerId: 'c9', promiseDate: 'bad-date' }),
    waada({ customerId: 'c8', promiseDate: TODAY }),
    waada({ customerId: 'c7', promiseDate: '2026-11-20' }),
  ] });
  assert.equal(view.alerts.length, 0);
});

test('waada alert: missing amount still alerts, without a promised figure', () => {
  const view = inbox({ waadaItems: [waada({ amount: null })] });
  assert.equal(view.alerts.length, 1);
  assert.doesNotMatch(view.alerts[0].detail, /promised/);
});

// ---- suspense alerts ----

test('suspense alert: below threshold excluded, at threshold included', () => {
  const below = inbox({ suspenseItems: [suspense({ ageDays: 29 })] });
  assert.equal(below.alerts.length, 0);
  const at = inbox({ suspenseItems: [suspense({ ageDays: 30 })] });
  assert.equal(at.alerts.length, 1);
  assert.equal(at.alerts[0].type, ALERT_TYPES.SUSPENSE_UNCLAIMED);
  assert.equal(at.alerts[0].actionScreen, 'Suspense register');
  assert.match(at.alerts[0].detail, /30 days/);
});

test('suspense severity: 90+ days is high, below that is medium', () => {
  assert.equal(inbox({ suspenseItems: [suspense({ ageDays: 89 })] }).alerts[0].severity, 'medium');
  assert.equal(inbox({ suspenseItems: [suspense({ ageDays: 90 })] }).alerts[0].severity, 'high');
});

// ---- outstanding alerts ----

test('outstanding alert: below threshold excluded, at threshold included', () => {
  assert.equal(inbox({ outstandingItems: [outstanding({ amount: 9999 })] }).alerts.length, 0);
  const at = inbox({ outstandingItems: [outstanding({ amount: 10000 })] });
  assert.equal(at.alerts.length, 1);
  assert.equal(at.alerts[0].actionScreen, 'Customers (Top Defaulters)');
});

test('outstanding severity: twice the threshold or more is high', () => {
  assert.equal(inbox({ outstandingItems: [outstanding({ amount: 19999 })] }).alerts[0].severity, 'medium');
  assert.equal(inbox({ outstandingItems: [outstanding({ amount: 20000 })] }).alerts[0].severity, 'high');
});

// ---- sorting, clearing, summary ----

test('alerts sort: high first, then larger metric, then name', () => {
  const view = inbox({
    waadaItems: [waada({ customerId: 'c1', customerName: 'Zara', promiseDate: '2026-10-27' })],
    suspenseItems: [suspense({ suspenseId: 'S-9', ageDays: 100 })],
    outstandingItems: [outstanding({ customerId: 'c2', customerName: 'Bilal', amount: 50000 })],
  });
  assert.deepEqual(view.alerts.map((a) => a.type), [
    ALERT_TYPES.LARGE_OUTSTANDING,
    ALERT_TYPES.SUSPENSE_UNCLAIMED,
    ALERT_TYPES.WAADA_OVERDUE,
  ]);
});

test('alerts sort: same severity orders by metric descending, then name A-Z', () => {
  const view = inbox({
    outstandingItems: [
      outstanding({ customerId: 'c1', customerName: 'Zara', amount: 12000 }),
      outstanding({ customerId: 'c2', customerName: 'Bilal', amount: 12000 }),
      outstanding({ customerId: 'c3', customerName: 'Ayesha', amount: 30000 }),
    ],
  });
  assert.deepEqual(view.alerts.map((a) => a.title), ['Ayesha', 'Bilal', 'Zara']);
});

test('clearing an alert hides it from alerts but reports it in cleared, never deleting the record', () => {
  const view = inbox({
    waadaItems: [waada()],
    outstandingItems: [outstanding()],
    clearedIds: ['waada:c1'],
  });
  assert.deepEqual(view.alerts.map((a) => a.id), ['outstanding:c1']);
  assert.deepEqual(view.cleared.map((a) => a.id), ['waada:c1']);
  assert.equal(view.summary.clearedCount, 1);
  assert.equal(view.summary.total, 1);
  // Building again without the cleared id restores the alert: the
  // record itself was never touched.
  const restored = inbox({ waadaItems: [waada()], outstandingItems: [outstanding()] });
  assert.equal(restored.alerts.length, 2);
});

test('one customer can raise both a waada and an outstanding alert under distinct ids', () => {
  const view = inbox({ waadaItems: [waada()], outstandingItems: [outstanding()] });
  assert.equal(view.alerts.length, 2);
  assert.notEqual(view.alerts[0].id, view.alerts[1].id);
});

test('summary counts totals, severities and per-type counts', () => {
  const view = inbox({
    waadaItems: [waada({ promiseDate: '2026-10-19' })],
    suspenseItems: [suspense()],
    outstandingItems: [outstanding()],
  });
  assert.equal(view.summary.total, 3);
  assert.equal(view.summary.high, 1);
  assert.equal(view.summary.medium, 2);
  assert.equal(view.summary.byType[ALERT_TYPES.WAADA_OVERDUE], 1);
  assert.equal(view.summary.byType[ALERT_TYPES.SUSPENSE_UNCLAIMED], 1);
  assert.equal(view.summary.byType[ALERT_TYPES.LARGE_OUTSTANDING], 1);
});

test('invalid today makes the whole view invalid, never a partial list', () => {
  const view = inbox({ today: 'not-a-date', waadaItems: [waada()] });
  assert.equal(view.valid, false);
  assert.equal(view.alerts.length, 0);
  assert.equal(alertsInboxSummaryText(view), 'Alerts unavailable');
});

test('invalid items are skipped, never invented as alerts', () => {
  const view = inbox({
    waadaItems: [null, 'x', waada({ amount: -50 })],
    suspenseItems: [suspense({ ageDays: 'abc' })],
    outstandingItems: [outstanding({ amount: 0 })],
  });
  // The waada entry with a negative amount still alerts (the promise
  // itself is overdue); the others carry no usable figure.
  assert.equal(view.alerts.length, 1);
  assert.equal(view.alerts[0].type, ALERT_TYPES.WAADA_OVERDUE);
});

test('inputs are never mutated', () => {
  const waadaItems = [waada()];
  const thresholds = { waadaOverdueDays: 7 };
  const before = JSON.stringify({ waadaItems, thresholds });
  inbox({ waadaItems, thresholds });
  assert.equal(JSON.stringify({ waadaItems, thresholds }), before);
});

// ---- summary text and HTML ----

test('summary text covers empty, cleared-only and high cases', () => {
  assert.equal(alertsInboxSummaryText(inbox({})), 'No open alerts');
  assert.equal(
    alertsInboxSummaryText(inbox({ waadaItems: [waada()], clearedIds: ['waada:c1'] })),
    'No open alerts · 1 cleared',
  );
  assert.match(
    alertsInboxSummaryText(inbox({ waadaItems: [waada({ promiseDate: '2026-10-19' })] })),
    /1 alert · 1 high/,
  );
});

test('HTML lists each alert with threshold, action screen and a clear button, escaped', () => {
  const view = inbox({
    waadaItems: [waada({ customerName: '<b>Ayesha</b>' })],
    thresholds: { waadaOverdueDays: 5 },
  });
  const html = alertsInboxHtml(view);
  assert.doesNotMatch(html, /<b>Ayesha<\/b>/);
  assert.match(html, /&lt;b&gt;Ayesha&lt;\/b&gt;/);
  assert.match(html, /Threshold: Waada overdue 5 days or more/);
  assert.match(html, /Action screen: Customer profile \(Waada promise\)/);
  assert.match(html, /Clear alert/);
  assert.match(html, /data-alert-id="waada:c1"/);
});

test('HTML for an empty inbox says clearing never clears the record', () => {
  const html = alertsInboxHtml(inbox({}));
  assert.match(html, /No open alerts/);
  assert.match(html, /never clears its record/);
});

test('custom thresholds change which alerts fire and what the threshold text says', () => {
  const view = inbox({
    waadaItems: [waada()],
    thresholds: { waadaOverdueDays: 14 },
  });
  assert.equal(view.alerts.length, 0);
  const fired = inbox({
    waadaItems: [waada({ promiseDate: '2026-10-19' })],
    thresholds: { waadaOverdueDays: 14 },
  });
  assert.equal(fired.alerts.length, 1);
  assert.match(fired.alerts[0].thresholdText, /14 days or more/);
});
