import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validMonthlyAuditSummaryDay,
  validMonthlyAuditSummaryMonth,
  monthlyAuditSummaryMonthLabel,
  monthlyAuditSummaryActionLabel,
  monthlyAuditMonths,
  monthlyAuditSummary,
  monthlyAuditSummaries,
  monthlyAuditSummaryReconciles,
  monthlyAuditSummaryText,
  monthlyAuditSummaryHtml,
  monthlyAuditSummaryCsv,
  monthlyAuditSummaryFilename,
} from '../monthly-audit-summary.js';
import { AUDIT_ACTIONS, auditActionLabel } from '../audit-log.js';

function entry(id, date, action, by, extra = {}) {
  return {
    id,
    timestamp: `${date}T09:15:00`,
    date,
    time: '09:15',
    action,
    recordRef: `PAY-${id}`,
    customerId: 'CUST-1',
    customerName: 'Test Customer',
    detail: `Secret detail for ${id}`,
    by,
    ...extra,
  };
}

const novemberLog = [
  entry('A-1', '2026-11-02', 'payment_recorded', 'Saad'),
  entry('A-2', '2026-11-03', 'payment_recorded', 'Saad'),
  entry('A-3', '2026-11-05', 'payment_voided', 'Owner'),
  entry('A-4', '2026-11-07', 'waada_set', 'Saad'),
  entry('A-5', '2026-11-10', 'payment_recorded', ''),
  entry('A-6', '2026-10-28', 'payment_recorded', 'Saad'),
  entry('A-7', '2026-12-01', 'concession_applied', 'Owner'),
];

test('month accepts YYYY-MM with a real month and refuses bad months', () => {
  assert.equal(validMonthlyAuditSummaryMonth('2026-11'), true);
  assert.equal(validMonthlyAuditSummaryMonth('2026-01'), true);
  assert.equal(validMonthlyAuditSummaryMonth('2026-12'), true);
  assert.equal(validMonthlyAuditSummaryMonth('2026-13'), false);
  assert.equal(validMonthlyAuditSummaryMonth('2026-00'), false);
  assert.equal(validMonthlyAuditSummaryMonth('2026-1'), false);
  assert.equal(validMonthlyAuditSummaryMonth('Nov 2026'), false);
  assert.equal(validMonthlyAuditSummaryMonth(''), false);
  assert.equal(validMonthlyAuditSummaryMonth(null), false);
});

test('day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validMonthlyAuditSummaryDay('2026-11-04'), true);
  assert.equal(validMonthlyAuditSummaryDay('2028-02-29'), true);
  assert.equal(validMonthlyAuditSummaryDay('2027-02-29'), false);
  assert.equal(validMonthlyAuditSummaryDay('2026-11-31'), false);
  assert.equal(validMonthlyAuditSummaryDay('2026-02-30'), false);
  assert.equal(validMonthlyAuditSummaryDay('04-11-2026'), false);
  assert.equal(validMonthlyAuditSummaryDay(''), false);
  assert.equal(validMonthlyAuditSummaryDay(null), false);
});

test('month label names the month in plain words and is empty for a bad month', () => {
  assert.equal(monthlyAuditSummaryMonthLabel('2026-11'), 'November 2026');
  assert.equal(monthlyAuditSummaryMonthLabel('2026-01'), 'January 2026');
  assert.equal(monthlyAuditSummaryMonthLabel('2026-13'), '');
  assert.equal(monthlyAuditSummaryMonthLabel(''), '');
});

test('summary counts only the requested month, by action type and by operator', () => {
  const summary = monthlyAuditSummary(novemberLog, '2026-11');
  assert.equal(summary.month, '2026-11');
  assert.equal(summary.total, 5);
  assert.deepEqual(summary.byAction, { payment_recorded: 3, payment_voided: 1, waada_set: 1 });
  assert.deepEqual(summary.byOperator, { Owner: 1, Saad: 3, 'Not recorded': 1 });
});

test('summary counts reconcile to the underlying log entries of the month', () => {
  const summary = monthlyAuditSummary(novemberLog, '2026-11');
  const byActionTotal = Object.values(summary.byAction).reduce((sum, count) => sum + count, 0);
  const byOperatorTotal = Object.values(summary.byOperator).reduce((sum, count) => sum + count, 0);
  assert.equal(byActionTotal, summary.total);
  assert.equal(byOperatorTotal, summary.total);
  assert.equal(byActionTotal, 5);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, summary), true);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, monthlyAuditSummary(novemberLog, '2026-10')), true);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, monthlyAuditSummary(novemberLog, '2026-12')), true);
});

test('a tampered summary does not reconcile', () => {
  const summary = monthlyAuditSummary(novemberLog, '2026-11');
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, { ...summary, total: 99 }), false);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, { ...summary, byAction: { payment_recorded: 1 } }), false);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, null), false);
  assert.equal(monthlyAuditSummaryReconciles(novemberLog, { month: '2026-13', total: 0, byAction: {}, byOperator: {} }), false);
});

test('entries with no action or no real date are left out, never guessed', () => {
  const log = [
    entry('B-1', '2026-11-02', 'payment_recorded', 'Saad'),
    entry('B-2', '2026-11-31', 'payment_recorded', 'Saad'),
    { ...entry('B-3', '2026-11-04', 'payment_recorded', 'Saad'), action: '' },
    { ...entry('B-4', '2026-11-04', 'payment_recorded', 'Saad'), date: 'not-a-date', timestamp: 'not-a-date' },
    entry('B-5', '2026-11-04', 'payment_recorded', 'Saad'),
  ];
  const summary = monthlyAuditSummary(log, '2026-11');
  assert.equal(summary.total, 2);
  assert.equal(monthlyAuditSummaryReconciles(log, summary), true);
});

test('an entry with no usable date still counts when its timestamp carries a real date', () => {
  const log = [
    { id: 'C-1', timestamp: '2026-11-06T10:00:00', action: 'payment_recorded', recordRef: 'PAY-C-1', by: 'Saad' },
    { id: 'C-2', timestamp: '2026-11-06T10:00:00', date: '2026-11-06', action: 'payment_recorded', recordRef: 'PAY-C-2', by: 'Saad' },
  ];
  assert.equal(monthlyAuditSummary(log, '2026-11').total, 2);
});

test('a blank operator reads as Not recorded, never as an invented name', () => {
  const log = [entry('D-1', '2026-11-02', 'payment_recorded', ''), entry('D-2', '2026-11-02', 'payment_recorded', '   ')];
  assert.deepEqual(monthlyAuditSummary(log, '2026-11').byOperator, { 'Not recorded': 2 });
});

test('an unknown action is counted and shown as written', () => {
  const log = [entry('E-1', '2026-11-02', 'refund_issued', 'Saad')];
  const summary = monthlyAuditSummary(log, '2026-11');
  assert.equal(summary.total, 1);
  assert.deepEqual(summary.byAction, { refund_issued: 1 });
  assert.equal(monthlyAuditSummaryActionLabel('refund_issued'), 'refund_issued');
});

test('composing a summary never changes any log entry', () => {
  const before = JSON.stringify(novemberLog);
  monthlyAuditSummary(novemberLog, '2026-11');
  monthlyAuditSummaries(novemberLog);
  monthlyAuditMonths(novemberLog);
  assert.equal(JSON.stringify(novemberLog), before);
  const frozen = novemberLog.map((row) => Object.freeze({ ...row }));
  Object.freeze(frozen);
  assert.equal(monthlyAuditSummary(frozen, '2026-11').total, 5);
});

test('months present in the log are listed earliest first, with no repeats', () => {
  assert.deepEqual(monthlyAuditMonths(novemberLog), ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual(monthlyAuditMonths([]), []);
  assert.deepEqual(monthlyAuditMonths(null), []);
  assert.deepEqual(monthlyAuditMonths([entry('F-1', '2026-11-31', 'payment_recorded', 'Saad')]), []);
});

test('one summary per month present, earliest month first', () => {
  const summaries = monthlyAuditSummaries(novemberLog);
  assert.deepEqual(summaries.map((summary) => summary.month), ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual(summaries.map((summary) => summary.total), [1, 5, 1]);
  assert.deepEqual(monthlyAuditSummaries([]), []);
});

test('an invalid month returns no summary', () => {
  assert.equal(monthlyAuditSummary(novemberLog, '2026-13'), null);
  assert.equal(monthlyAuditSummary(novemberLog, ''), null);
  assert.equal(monthlyAuditSummary(novemberLog, null), null);
});

test('a non-array log composes as an empty month, never throws', () => {
  assert.deepEqual(monthlyAuditSummary(null, '2026-11'), { month: '2026-11', total: 0, byAction: {}, byOperator: {} });
  assert.deepEqual(monthlyAuditSummary('not-a-list', '2026-11').byAction, {});
});

test('summary text names the month, the total, and the counts in plain words', () => {
  const summary = monthlyAuditSummary(novemberLog, '2026-11');
  assert.equal(
    monthlyAuditSummaryText(summary),
    'November 2026 — 5 actions: Payment recorded: 3 · Payment voided: 1 · Waada set: 1 — By operator: Not recorded: 1 · Owner: 1 · Saad: 3',
  );
  assert.equal(monthlyAuditSummaryText(monthlyAuditSummary(novemberLog, '2026-10')), 'October 2026 — 1 action: Payment recorded: 1 — By operator: Saad: 1');
  assert.equal(monthlyAuditSummaryText(monthlyAuditSummary([], '2026-11')), 'November 2026 — no operator actions logged.');
  assert.equal(monthlyAuditSummaryText(null), 'Choose a month to see its audit summary.');
});

test('summary html shows counts only, never any action detail', () => {
  const html = monthlyAuditSummaryHtml(monthlyAuditSummary(novemberLog, '2026-11'));
  assert.match(html, /Payment recorded<\/td><td>3<\/td>/);
  assert.match(html, /Saad — 3 actions/);
  assert.match(html, /November 2026 — 5 actions/);
  assert.doesNotMatch(html, /Secret detail/);
  assert.doesNotMatch(html, /PAY-A-1/);
  assert.doesNotMatch(html, /Test Customer/);
  assert.doesNotMatch(html, /2026-11-02/);
  assert.equal(monthlyAuditSummaryHtml(monthlyAuditSummary([], '2026-11')), '<p>November 2026 — no operator actions logged.</p>');
  assert.equal(monthlyAuditSummaryHtml(null), '<p>Choose a month to see its audit summary.</p>');
});

test('summary html escapes operator names', () => {
  const log = [entry('G-1', '2026-11-02', 'payment_recorded', '<b>Saad</b>')];
  const html = monthlyAuditSummaryHtml(monthlyAuditSummary(log, '2026-11'));
  assert.match(html, /&lt;b&gt;Saad&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Saad<\/b>/);
});

test('summary csv has one count row per action and per operator', () => {
  const csv = monthlyAuditSummaryCsv(monthlyAuditSummary(novemberLog, '2026-11'));
  assert.equal(
    csv,
    [
      'month,section,name,count',
      '2026-11,action,Payment recorded,3',
      '2026-11,action,Payment voided,1',
      '2026-11,action,Waada set,1',
      '2026-11,operator,Not recorded,1',
      '2026-11,operator,Owner,1',
      '2026-11,operator,Saad,3',
    ].join('\n'),
  );
  assert.equal(monthlyAuditSummaryCsv(null), 'month,section,name,count');
});

test('summary filename is fixed per month and empty for a bad month', () => {
  assert.equal(monthlyAuditSummaryFilename('2026-11'), 'monthly-audit-summary-2026-11.csv');
  assert.equal(monthlyAuditSummaryFilename('2026-13'), '');
  assert.equal(monthlyAuditSummaryFilename(''), '');
});

test('known action labels match the audit log module, so the two cannot drift apart', () => {
  // QC-8 why-comment: the catalogue grows to 11 with 'field_visit'
  // (every field visit outcome leaves an audit trace). Mohalla Seed
  // why-comment: it grows to 12 with 'payment_records_cleared' (the
  // Clear All payment-records wipe leaves an audit trace). The loop
  // below already pins the new action's label too, so the intent —
  // the summary's labels cannot drift from the log's — is unchanged.
  assert.equal(AUDIT_ACTIONS.length, 12);
  for (const action of AUDIT_ACTIONS) {
    assert.equal(monthlyAuditSummaryActionLabel(action.value), action.label);
    assert.equal(monthlyAuditSummaryActionLabel(action.value), auditActionLabel(action.value));
  }
});
