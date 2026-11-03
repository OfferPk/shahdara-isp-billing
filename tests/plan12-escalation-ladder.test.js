import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESCALATION_STEPS,
  ESCALATION_STEP_LABELS,
  DEFAULT_ESCALATION_THRESHOLDS,
  isValidEscalationDate,
  normalizeEscalationThresholds,
  escalationDaysBetween,
  stepForDaysOverdue,
  buildEscalationLadder,
  buildEscalationDraft,
  logEscalationSent,
  lastEscalationSent,
  escalationSummaryText,
  escalationFilename,
  escalationHtml,
  escalationCsv,
} from '../escalation-ladder.js';

const TODAY = '2026-11-03';

const bill = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ahmed',
  mohalla: 'Bani',
  billMonth: '2026-10',
  dueDate: '2026-11-01',
  balanceDue: 1500,
  ...overrides,
});

// ---- date validation ----

test('valid calendar dates pass and impossible dates fail', () => {
  assert.equal(isValidEscalationDate('2026-11-03'), true);
  assert.equal(isValidEscalationDate('2024-02-29'), true);
  assert.equal(isValidEscalationDate('2026-02-29'), false);
  assert.equal(isValidEscalationDate('2026-13-01'), false);
  assert.equal(isValidEscalationDate('03-11-2026'), false);
  assert.equal(isValidEscalationDate(''), false);
  assert.equal(isValidEscalationDate(null), false);
});

test('day arithmetic crosses a month boundary', () => {
  assert.equal(escalationDaysBetween('2026-10-30', '2026-11-03'), 4);
  assert.equal(escalationDaysBetween('2026-11-03', '2026-11-03'), 0);
  assert.equal(escalationDaysBetween('not-a-date', '2026-11-03'), null);
});

// ---- threshold normalisation ----

test('default thresholds are gentle 1, firm 8, final 21', () => {
  assert.deepEqual(DEFAULT_ESCALATION_THRESHOLDS, { gentleDays: 1, firmDays: 8, finalDays: 21 });
});

test('a strictly increasing custom triple is kept', () => {
  assert.deepEqual(
    normalizeEscalationThresholds({ gentleDays: 3, firmDays: 10, finalDays: 30 }),
    { gentleDays: 3, firmDays: 10, finalDays: 30 },
  );
});

test('a non-increasing triple falls back to the defaults as a whole', () => {
  assert.deepEqual(
    normalizeEscalationThresholds({ gentleDays: 10, firmDays: 8, finalDays: 21 }),
    { ...DEFAULT_ESCALATION_THRESHOLDS },
  );
  assert.deepEqual(
    normalizeEscalationThresholds({ gentleDays: 8, firmDays: 8, finalDays: 21 }),
    { ...DEFAULT_ESCALATION_THRESHOLDS },
  );
});

test('zero, negative, fractional and non-numeric thresholds fall back per field', () => {
  assert.deepEqual(
    normalizeEscalationThresholds({ gentleDays: 0, firmDays: 10, finalDays: 30 }),
    { gentleDays: 1, firmDays: 10, finalDays: 30 },
  );
  assert.deepEqual(
    normalizeEscalationThresholds({ gentleDays: -5, firmDays: 'abc', finalDays: 30.9 }),
    { gentleDays: 1, firmDays: 8, finalDays: 30 },
  );
  assert.deepEqual(normalizeEscalationThresholds(null), { ...DEFAULT_ESCALATION_THRESHOLDS });
  assert.deepEqual(normalizeEscalationThresholds(undefined), { ...DEFAULT_ESCALATION_THRESHOLDS });
});

// ---- step boundaries ----

test('step boundaries are exact: 1 gentle, 8 firm, 21 final', () => {
  assert.equal(stepForDaysOverdue(0, undefined), null);
  assert.equal(stepForDaysOverdue(1, undefined), 'gentle');
  assert.equal(stepForDaysOverdue(7, undefined), 'gentle');
  assert.equal(stepForDaysOverdue(8, undefined), 'firm');
  assert.equal(stepForDaysOverdue(20, undefined), 'firm');
  assert.equal(stepForDaysOverdue(21, undefined), 'final');
  assert.equal(stepForDaysOverdue(90, undefined), 'final');
  assert.equal(stepForDaysOverdue(-1, undefined), null);
  assert.equal(stepForDaysOverdue('abc', undefined), null);
});

test('custom thresholds move the boundaries', () => {
  const t = { gentleDays: 3, firmDays: 10, finalDays: 30 };
  assert.equal(stepForDaysOverdue(2, t), null);
  assert.equal(stepForDaysOverdue(3, t), 'gentle');
  assert.equal(stepForDaysOverdue(9, t), 'gentle');
  assert.equal(stepForDaysOverdue(10, t), 'firm');
  assert.equal(stepForDaysOverdue(30, t), 'final');
});

test('step labels exist for all three steps', () => {
  assert.equal(ESCALATION_STEP_LABELS.gentle, 'Gentle reminder');
  assert.equal(ESCALATION_STEP_LABELS.firm, 'Firm reminder');
  assert.equal(ESCALATION_STEP_LABELS.final, 'Final notice');
  assert.equal(ESCALATION_STEPS.GENTLE, 'gentle');
  assert.equal(ESCALATION_STEPS.FIRM, 'firm');
  assert.equal(ESCALATION_STEPS.FINAL, 'final');
});

// ---- ladder build: overdue only ----

test('only past-due bills appear; due today and future bills are excluded, never counted as overdue', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ customerId: 'c1', dueDate: '2026-11-02' }),
      bill({ customerId: 'c2', dueDate: '2026-11-03' }),
      bill({ customerId: 'c3', dueDate: '2026-11-05' }),
    ],
  });
  assert.equal(ladder.valid, true);
  assert.equal(ladder.rows.length, 1);
  assert.equal(ladder.rows[0].customerId, 'c1');
  assert.equal(ladder.rows[0].daysOverdue, 1);
  assert.equal(ladder.counts.excludedNotOverdue, 2);
});

test('zero-balance customers never appear', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [bill({ balanceDue: 0 }), bill({ customerId: 'c2', balanceDue: -100 })],
  });
  assert.equal(ladder.rows.length, 0);
  assert.equal(ladder.counts.excludedZeroBalance, 2);
});

test('undated, unparseable and customer-less bills are excluded and counted, never invented', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ customerId: 'c1', dueDate: null }),
      bill({ customerId: 'c2', dueDate: '2026-02-30' }),
      bill({ customerId: '', dueDate: '2026-10-01' }),
    ],
  });
  assert.equal(ladder.rows.length, 0);
  assert.equal(ladder.counts.excludedUndated, 1);
  assert.equal(ladder.counts.excludedUnparseable, 1);
  assert.equal(ladder.counts.excludedInvalid, 1);
});

test('an invalid today date makes the ladder invalid, never a guessed date', () => {
  const ladder = buildEscalationLadder({ today: '2026-02-30', bills: [bill()] });
  assert.equal(ladder.valid, false);
  assert.equal(ladder.rows.length, 0);
});

// ---- one row per customer ----

test('one row per customer: amounts sum, earliest due date and largest days overdue win', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ dueDate: '2026-11-01', balanceDue: 1000 }),
      bill({ dueDate: '2026-10-20', balanceDue: 500, billMonth: '2026-09' }),
      bill({ customerId: 'c2', customerName: 'Bilal', dueDate: '2026-10-25', balanceDue: 2000 }),
    ],
  });
  assert.equal(ladder.rows.length, 2);
  const c1 = ladder.rows.find((r) => r.customerId === 'c1');
  assert.equal(c1.amount, 1500);
  assert.equal(c1.dueDate, '2026-10-20');
  assert.equal(c1.daysOverdue, 14);
  assert.equal(c1.billCount, 2);
  assert.equal(c1.bills.length, 2);
  // 14 days overdue is the firm step, not the gentle step of the newer bill.
  assert.equal(c1.step, 'firm');
});

test('a customer sits on exactly one step, from the most overdue bill', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ dueDate: '2026-11-02', balanceDue: 100 }),
      bill({ dueDate: '2026-10-01', balanceDue: 100, billMonth: '2026-09' }),
    ],
  });
  assert.equal(ladder.rows.length, 1);
  assert.equal(ladder.rows[0].step, 'final');
  assert.equal(ladder.stepCounts.final, 1);
  assert.equal(ladder.stepCounts.gentle, 0);
});

test('rows sort most overdue first, then largest amount, then name A-Z', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ customerId: 'c1', customerName: 'Zain', dueDate: '2026-11-01', balanceDue: 100 }),
      bill({ customerId: 'c2', customerName: 'Bilal', dueDate: '2026-10-01', balanceDue: 100 }),
      bill({ customerId: 'c3', customerName: 'Ahmed', dueDate: '2026-10-01', balanceDue: 900 }),
    ],
  });
  assert.deepEqual(ladder.rows.map((r) => r.customerId), ['c3', 'c2', 'c1']);
});

test('step counts and total amount sum exactly over the rows', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ customerId: 'c1', dueDate: '2026-11-02', balanceDue: 100 }),
      bill({ customerId: 'c2', dueDate: '2026-10-26', balanceDue: 200 }),
      bill({ customerId: 'c3', dueDate: '2026-10-01', balanceDue: 300 }),
    ],
  });
  assert.deepEqual(ladder.stepCounts, { gentle: 1, firm: 1, final: 1 });
  assert.equal(ladder.totalAmount, 600);
  assert.equal(ladder.counts.includedBills, 3);
});

test('an operator gentle threshold above 1 keeps early slips off the ladder', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    thresholds: { gentleDays: 3, firmDays: 10, finalDays: 30 },
    bills: [bill({ dueDate: '2026-11-02' }), bill({ customerId: 'c2', dueDate: '2026-10-30' })],
  });
  assert.equal(ladder.rows.length, 1);
  assert.equal(ladder.rows[0].customerId, 'c2');
  assert.equal(ladder.rows[0].step, 'gentle');
});

// ---- non-mutation ----

test('inputs are not mutated: bills and thresholds come back unchanged', () => {
  const bills = [bill({ dueDate: '2026-11-01' }), bill({ dueDate: '2026-10-20', billMonth: '2026-09' })];
  const snapshot = JSON.stringify(bills);
  const thresholds = { gentleDays: 2, firmDays: 9, finalDays: 20 };
  buildEscalationLadder({ today: TODAY, thresholds, bills });
  assert.equal(JSON.stringify(bills), snapshot);
  assert.deepEqual(thresholds, { gentleDays: 2, firmDays: 9, finalDays: 20 });
});

// ---- drafts ----

test('the three step drafts differ in wording', () => {
  const gentle = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 2, step: 'gentle' });
  const firm = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 10, step: 'firm' });
  const final = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 30, step: 'final' });
  assert.notEqual(gentle.text, firm.text);
  assert.notEqual(firm.text, final.text);
  assert.notEqual(gentle.text, final.text);
  assert.equal(final.text.includes('FINAL NOTICE'), true);
});

test('each draft carries the name, amount, days overdue and due date', () => {
  const row = { ...bill(), amount: 1500, daysOverdue: 14, step: 'firm' };
  const draft = buildEscalationDraft(row);
  assert.equal(draft.step, 'firm');
  assert.equal(draft.text.includes('Ahmed'), true);
  assert.equal(draft.text.includes('PKR 1,500'), true);
  assert.equal(draft.text.includes('14 din'), true);
  assert.equal(draft.text.includes('1 Nov 2026'), true);
});

test('the final draft asks for payment or a conversation, never a disconnection promise', () => {
  const draft = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 40, step: 'final' });
  assert.equal(draft.text.toLowerCase().includes('disconnect'), false);
  assert.equal(draft.text.includes('owner se rabta karein'), true);
});

test('Urdu drafts differ by step and carry the same figures', () => {
  const gentle = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 2, step: 'gentle' }, 'urdu');
  const final = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 30, step: 'final' }, 'urdu');
  assert.notEqual(gentle.text, final.text);
  assert.equal(final.text.includes('آخری نوٹس'), true);
  assert.equal(final.text.includes('Ahmed'), true);
  assert.equal(final.text.includes('30 din'), true);
});

test('a draft without a step falls back to the step for its days overdue', () => {
  const draft = buildEscalationDraft({ ...bill(), amount: 1500, daysOverdue: 25 });
  assert.equal(draft.step, 'final');
});

// ---- send log ----

test('logging a send returns a new array and records customer, step, time and channel', () => {
  const log = [];
  const next = logEscalationSent(log, { customerId: 'c1', step: 'firm', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' });
  assert.equal(log.length, 0);
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { customerId: 'c1', step: 'firm', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' });
});

test('log entries without a customer, a valid step, or a time are not recorded', () => {
  const log = logEscalationSent([], { customerId: 'c1', step: 'firm', sentAt: '2026-11-03T10:00:00.000Z' });
  assert.equal(logEscalationSent(log, { customerId: '', step: 'firm', sentAt: '2026-11-03T10:00:00.000Z' }).length, 1);
  assert.equal(logEscalationSent(log, { customerId: 'c1', step: 'waada', sentAt: '2026-11-03T10:00:00.000Z' }).length, 1);
  assert.equal(logEscalationSent(log, { customerId: 'c1', step: 'firm', sentAt: '' }).length, 1);
});

test('the last sent entry for a customer wins, and other customers are untouched', () => {
  const log = [
    { customerId: 'c1', step: 'gentle', sentAt: '2026-11-01T10:00:00.000Z', channel: 'whatsapp' },
    { customerId: 'c2', step: 'firm', sentAt: '2026-11-02T10:00:00.000Z', channel: 'whatsapp' },
    { customerId: 'c1', step: 'firm', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' },
  ];
  assert.equal(lastEscalationSent(log, 'c1').step, 'firm');
  assert.equal(lastEscalationSent(log, 'c2').step, 'firm');
  assert.equal(lastEscalationSent(log, 'c9'), null);
});

test('sending a step advances only the log: the ladder rows are unchanged', () => {
  const ladder = buildEscalationLadder({ today: TODAY, bills: [bill()] });
  const before = JSON.stringify(ladder.rows);
  logEscalationSent([], { customerId: 'c1', step: 'gentle', sentAt: '2026-11-03T10:00:00.000Z' });
  assert.equal(JSON.stringify(ladder.rows), before);
});

// ---- summary, filename, HTML, CSV ----

test('summary text names the row count, total and step split', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [
      bill({ customerId: 'c1', dueDate: '2026-11-02', balanceDue: 100 }),
      bill({ customerId: 'c2', dueDate: '2026-10-01', balanceDue: 200 }),
    ],
  });
  const summary = escalationSummaryText(ladder);
  assert.equal(summary.includes('2 overdue customers'), true);
  assert.equal(summary.includes('PKR 300'), true);
  assert.equal(summary.includes('1 gentle'), true);
  assert.equal(summary.includes('1 final notice'), true);
  assert.equal(escalationSummaryText({ valid: false }), 'Overdue escalation ladder unavailable — the ladder needs a valid today date.');
  assert.equal(escalationSummaryText(buildEscalationLadder({ today: TODAY, bills: [] })), 'No overdue bills on the ladder.');
});

test('filename carries the today date', () => {
  assert.equal(escalationFilename({ today: TODAY }), 'escalation-ladder-2026-11-03.csv');
  assert.equal(escalationFilename({ today: 'bad' }), 'escalation-ladder-unknown-date.csv');
});

test('HTML shows the step label, figures and last sent step, and escapes names', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [bill({ customerName: '<Ahmed & Sons>', dueDate: '2026-10-01' })],
  });
  const sentLog = [{ customerId: 'c1', step: 'firm', sentAt: '2026-11-02T09:30:00.000Z', channel: 'whatsapp' }];
  const html = escalationHtml(ladder, sentLog);
  assert.equal(html.includes('&lt;Ahmed &amp; Sons&gt;'), true);
  assert.equal(html.includes('Final notice'), true);
  assert.equal(html.includes('33 days overdue'), true);
  assert.equal(html.includes('Firm reminder'), true);
  assert.equal(html.includes('escalation-send-btn'), true);
  assert.equal(html.includes('<Ahmed'), false);
});

test('CSV carries one row per customer with step, days and last sent info, quoted safely', () => {
  const ladder = buildEscalationLadder({
    today: TODAY,
    bills: [bill({ customerName: 'Ahmed, Jr', dueDate: '2026-10-01' })],
  });
  const csv = escalationCsv(ladder, [{ customerId: 'c1', step: 'gentle', sentAt: '2026-11-01T10:00:00.000Z', channel: 'whatsapp' }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Customer, Mohalla, Step, Amount due (PKR), Due date, Days overdue, Bills, Last sent step, Last sent at, Channel');
  assert.equal(lines[1].includes('"Ahmed, Jr"'), true);
  assert.equal(lines[1].includes('final'), true);
  assert.equal(lines[1].includes('33'), true);
  assert.equal(lines[1].includes('gentle'), true);
});
