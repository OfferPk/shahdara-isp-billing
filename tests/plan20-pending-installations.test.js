import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnboardingEntry,
  pendingOnboardingList,
  tickOnboardingStep,
  buildOnboardingChecklist,
} from '../onboarding-checklist.js';
import {
  validPendingDate,
  wholeDaysBetweenPending,
  daysWaiting,
  isActivationCompleted,
  enquiryStepDate,
  buildPendingInstallationRow,
  buildPendingInstallationQueue,
  findPromisedInstallDate,
  upsertPromisedInstallDate,
  removePromisedInstallDate,
  pendingInstallationSummaryText,
  pendingInstallationHtml,
  pendingInstallationCsv,
  pendingInstallationFilename,
} from '../pending-installations.js';

const TODAY = '2026-11-10';

function entry(id, name, ticks, extra = {}) {
  return { ...buildOnboardingEntry({ id, name }, ticks), ...extra };
}

const enquiryOnly = [{ stepId: 'enquiry', completed: true, date: '2026-11-01', by: 'Saad' }];
const activatedOpen = [
  { stepId: 'enquiry', completed: true, date: '2026-11-01' },
  { stepId: 'survey', completed: true, date: '2026-11-02' },
  { stepId: 'cable', completed: true, date: '2026-11-03' },
  { stepId: 'device', completed: true, date: '2026-11-04' },
  { stepId: 'credentials', completed: true, date: '2026-11-05' },
  { stepId: 'activation', completed: true, date: '2026-11-06' },
];

test('dates: real calendar dates only, 2026-02-30 rejected, blank rejected', () => {
  assert.equal(validPendingDate('2026-11-01'), '2026-11-01');
  assert.equal(validPendingDate('2026-02-30'), null);
  assert.equal(validPendingDate('soon'), null);
  assert.equal(validPendingDate(''), null);
  assert.equal(validPendingDate(null), null);
  assert.equal(validPendingDate(' 2026-11-01 '), '2026-11-01');
});

test('wholeDaysBetween: same day 0, month and year boundaries, invalid null', () => {
  assert.equal(wholeDaysBetweenPending('2026-11-01', '2026-11-01'), 0);
  assert.equal(wholeDaysBetweenPending('2026-10-31', '2026-11-01'), 1);
  assert.equal(wholeDaysBetweenPending('2025-12-31', '2026-01-01'), 1);
  assert.equal(wholeDaysBetweenPending('2026-02-28', '2026-03-01'), 1);
  assert.equal(wholeDaysBetweenPending('2026-11-01', 'bad'), null);
  assert.equal(wholeDaysBetweenPending('bad', '2026-11-01'), null);
});

test('daysWaiting: counts from enquiry date, future clamped to 0, missing null', () => {
  assert.equal(daysWaiting('2026-11-01', TODAY), 9);
  assert.equal(daysWaiting('2026-11-10', TODAY), 0);
  assert.equal(daysWaiting('2026-11-12', TODAY), 0);
  assert.equal(daysWaiting(null, TODAY), null);
  assert.equal(daysWaiting('2026-11-01', null), null);
  assert.equal(daysWaiting('2026-02-30', TODAY), null);
});

test('activation: ticked activation is activated, unticked or missing is not', () => {
  assert.equal(isActivationCompleted(entry('c1', 'A', activatedOpen)), true);
  assert.equal(isActivationCompleted(entry('c2', 'B', enquiryOnly)), false);
  assert.equal(isActivationCompleted({ customerId: 'c3' }), false);
  assert.equal(isActivationCompleted(entry('c4', 'D', [{ stepId: 'activation', completed: false }])), false);
});

test('enquiryStepDate: tick date carried, unticked or bad date is null', () => {
  assert.equal(enquiryStepDate(entry('c1', 'A', enquiryOnly)), '2026-11-01');
  assert.equal(enquiryStepDate(entry('c2', 'B', [])), null);
  assert.equal(enquiryStepDate(entry('c3', 'C', [{ stepId: 'enquiry', completed: true, date: '2026-02-30' }])), null);
  assert.equal(enquiryStepDate({ customerId: 'c4' }), null);
});

test('queue: activated customers are out even when later steps are still open', () => {
  const queue = buildPendingInstallationQueue([
    entry('c1', 'Activated But Unbilled', activatedOpen),
    entry('c2', 'Still Waiting', enquiryOnly),
  ], { today: TODAY });
  assert.deepEqual(queue.map((row) => row.customerId), ['c2']);
});

test('queue: fully complete checklists are out, and entries without a checklist are skipped', () => {
  const full = [
    'enquiry', 'survey', 'cable', 'device', 'credentials', 'activation', 'first_bill',
  ].map((stepId) => ({ stepId, completed: true, date: '2026-11-01' }));
  const queue = buildPendingInstallationQueue([
    entry('c1', 'Done', full),
    { customerId: 'c9', customerName: 'No Checklist' },
    entry('c2', 'Waiting', enquiryOnly),
  ], { today: TODAY });
  assert.deepEqual(queue.map((row) => row.customerId), ['c2']);
});

test('queue: ordered by enquiry date oldest first, undated last, ties by name then id', () => {
  const queue = buildPendingInstallationQueue([
    entry('c3', 'Zara', [{ stepId: 'enquiry', completed: true, date: '2026-11-05' }]),
    entry('c1', 'Bilal', []),
    entry('c2', 'Ahmed', [{ stepId: 'enquiry', completed: true, date: '2026-11-01' }]),
    entry('c4', 'Ahmed', [{ stepId: 'enquiry', completed: true, date: '2026-11-01' }]),
    entry('c5', 'Ahmed', [{ stepId: 'enquiry', completed: true, date: '2026-11-01' }]),
  ], { today: TODAY });
  assert.deepEqual(queue.map((row) => row.customerId), ['c2', 'c4', 'c5', 'c3', 'c1']);
});

test('row: explicit enquiry date wins over the enquiry step tick date', () => {
  const row = buildPendingInstallationRow(
    entry('c1', 'A', enquiryOnly, { enquiryDate: '2026-10-28' }), TODAY,
  );
  assert.equal(row.enquiryDate, '2026-10-28');
  assert.equal(row.daysWaiting, 13);
});

test('row: invalid explicit enquiry date falls back to the step tick date', () => {
  const row = buildPendingInstallationRow(
    entry('c1', 'A', enquiryOnly, { enquiryDate: 'not a date' }), TODAY,
  );
  assert.equal(row.enquiryDate, '2026-11-01');
  assert.equal(row.daysWaiting, 9);
});

test('row: no enquiry date anywhere gives null date and null waiting, never a guess', () => {
  const row = buildPendingInstallationRow(entry('c1', 'A', []), TODAY);
  assert.equal(row.enquiryDate, null);
  assert.equal(row.daysWaiting, null);
});

test('row: current step is Plan 16 next step, carried verbatim with done/total', () => {
  const row = buildPendingInstallationRow(entry('c1', 'A', enquiryOnly), TODAY);
  assert.equal(row.currentStepId, 'survey');
  assert.equal(row.currentStepLabel, 'Survey / feasibility');
  assert.equal(row.stepsDone, 1);
  assert.equal(row.stepsTotal, 7);
  assert.equal(row.progressPercent, 14);
});

test('row: mohalla carried, blank mohalla stays blank and is never dropped', () => {
  const withMohalla = buildPendingInstallationRow(
    { ...entry('c1', 'A', enquiryOnly), mohalla: 'Mohalla Bani' }, TODAY,
  );
  assert.equal(withMohalla.mohalla, 'Mohalla Bani');
  const without = buildPendingInstallationRow(entry('c2', 'B', enquiryOnly), TODAY);
  assert.equal(without.mohalla, '');
  assert.equal(buildPendingInstallationQueue([entry('c2', 'B', enquiryOnly)], { today: TODAY }).length, 1);
});

test('promised: valid date kept, invalid becomes null, never stored as a bad date', () => {
  const ok = buildPendingInstallationRow(entry('c1', 'A', enquiryOnly, { promisedInstallDate: '2026-11-12' }), TODAY);
  assert.equal(ok.promisedInstallDate, '2026-11-12');
  assert.equal(ok.promisedOverdue, false);
  const bad = buildPendingInstallationRow(entry('c2', 'B', enquiryOnly, { promisedInstallDate: '2026-02-30' }), TODAY);
  assert.equal(bad.promisedInstallDate, null);
  assert.equal(bad.promisedOverdue, false);
  const none = buildPendingInstallationRow(entry('c3', 'C', enquiryOnly), TODAY);
  assert.equal(none.promisedInstallDate, null);
  assert.equal(none.promisedOverdue, false);
});

test('promised: past promised date is overdue, today and future are not', () => {
  const past = buildPendingInstallationRow(entry('c1', 'A', enquiryOnly, { promisedInstallDate: '2026-11-09' }), TODAY);
  assert.equal(past.promisedOverdue, true);
  const todayRow = buildPendingInstallationRow(entry('c2', 'B', enquiryOnly, { promisedInstallDate: TODAY }), TODAY);
  assert.equal(todayRow.promisedOverdue, false);
  const future = buildPendingInstallationRow(entry('c3', 'C', enquiryOnly, { promisedInstallDate: '2026-11-11' }), TODAY);
  assert.equal(future.promisedOverdue, false);
  const noToday = buildPendingInstallationRow(entry('c4', 'D', enquiryOnly, { promisedInstallDate: '2026-11-09' }), null);
  assert.equal(noToday.promisedOverdue, false);
});

test('promised store: find, upsert, replace, remove, invalid upsert clears', () => {
  let list = upsertPromisedInstallDate([], 'c1', '2026-11-12');
  assert.equal(findPromisedInstallDate(list, 'c1'), '2026-11-12');
  list = upsertPromisedInstallDate(list, 'c1', '2026-11-15');
  assert.equal(list.length, 1);
  assert.equal(findPromisedInstallDate(list, 'c1'), '2026-11-15');
  list = upsertPromisedInstallDate(list, 'c1', 'bad date');
  assert.equal(findPromisedInstallDate(list, 'c1'), null);
  assert.equal(list.length, 0);
  list = upsertPromisedInstallDate(list, 'c2', '2026-11-12');
  list = removePromisedInstallDate(list, 'c2');
  assert.deepEqual(list, []);
  assert.equal(findPromisedInstallDate(list, 'missing'), null);
  assert.equal(findPromisedInstallDate([], ''), null);
});

test('promised store: upsert and remove never mutate the input list', () => {
  const before = [{ customerId: 'c1', promisedInstallDate: '2026-11-12' }];
  const snapshot = JSON.stringify(before);
  upsertPromisedInstallDate(before, 'c2', '2026-11-13');
  removePromisedInstallDate(before, 'c1');
  assert.equal(JSON.stringify(before), snapshot);
});

test('queue: inputs are never mutated by building the queue', () => {
  const entries = [
    entry('c2', 'B', [{ stepId: 'enquiry', completed: true, date: '2026-11-03' }]),
    entry('c1', 'A', [{ stepId: 'enquiry', completed: true, date: '2026-11-01' }]),
  ];
  const snapshot = JSON.stringify(entries);
  const queue = buildPendingInstallationQueue(entries, { today: TODAY });
  assert.deepEqual(queue.map((row) => row.customerId), ['c1', 'c2']);
  assert.equal(JSON.stringify(entries), snapshot);
  queue[0].daysWaiting = 999;
  assert.equal(JSON.stringify(entries), snapshot);
});

test('integration: Plan 16 pending list feeds the queue, and ticking activation removes a row', () => {
  const stored = [
    buildOnboardingEntry({ id: 'c1', name: 'Bilal' }, enquiryOnly),
    buildOnboardingEntry({ id: 'c2', name: 'Ahmed' }, activatedOpen),
    buildOnboardingEntry({ id: 'c3', name: 'Zara' }, [{ stepId: 'enquiry', completed: true, date: '2026-10-30' }]),
  ];
  const pending = pendingOnboardingList(stored);
  // Plan 16's pending list still holds the activated-but-unbilled
  // customer (its first-bill step is open); the Plan 20 queue drops it.
  assert.deepEqual(pending.map((e) => e.customerId), ['c2', 'c1', 'c3']);
  const queue = buildPendingInstallationQueue(pending, { today: TODAY });
  assert.deepEqual(queue.map((row) => row.customerId), ['c3', 'c1']);
  const activated = tickOnboardingStep(buildOnboardingChecklist('c3', [{ stepId: 'enquiry', completed: true, date: '2026-10-30' }]), 'activation', { date: TODAY, by: 'Saad' });
  const after = buildPendingInstallationQueue(
    pendingOnboardingList([
      buildOnboardingEntry({ id: 'c1', name: 'Bilal' }, enquiryOnly),
      buildOnboardingEntry({ id: 'c3', name: 'Zara' }, activated.steps),
    ]),
    { today: TODAY },
  );
  assert.deepEqual(after.map((row) => row.customerId), ['c1']);
  assert.equal(activated.steps.find((s) => s.stepId === 'activation').completed, true);
});

test('summary: empty, single, overdue and longest wait', () => {
  assert.equal(pendingInstallationSummaryText([]), 'No pending installations');
  const queue = buildPendingInstallationQueue([
    entry('c1', 'A', enquiryOnly, { promisedInstallDate: '2026-11-09' }),
    entry('c2', 'B', [{ stepId: 'enquiry', completed: true, date: '2026-11-05' }]),
  ], { today: TODAY });
  assert.equal(pendingInstallationSummaryText(queue), '2 pending installations · 1 promised date passed · longest wait 9 days');
  assert.equal(pendingInstallationSummaryText(queue.slice(1)), '1 pending installation · longest wait 5 days');
});

test('summary: undated rows do not invent a longest wait', () => {
  const queue = buildPendingInstallationQueue([entry('c1', 'A', [])], { today: TODAY });
  assert.equal(pendingInstallationSummaryText(queue), '1 pending installation');
});

test('html: rows show enquiry, waiting, step, promised and the activate button', () => {
  const queue = buildPendingInstallationQueue([
    entry('c1', 'A', enquiryOnly, { promisedInstallDate: '2026-11-09' }),
  ], { today: TODAY });
  const html = pendingInstallationHtml(queue);
  assert.ok(html.includes('enquired 2026-11-01'));
  assert.ok(html.includes('9 days waiting'));
  assert.ok(html.includes('next: Survey / feasibility'));
  assert.ok(html.includes('promised 2026-11-09 — promised date passed'));
  assert.ok(html.includes('data-pending-install-customer-id="c1"'));
  assert.ok(html.includes('Mark activated'));
  assert.ok(html.includes('never changes a bill'));
});

test('html: empty state, missing dates, and escaping', () => {
  assert.equal(pendingInstallationHtml([]), '<p class="empty-state">No pending installations</p>');
  const queue = buildPendingInstallationQueue([
    entry('c1', 'A <b>&amp;</b>', []),
  ], { today: TODAY });
  const html = pendingInstallationHtml(queue);
  assert.ok(html.includes('Not recorded'));
  assert.ok(html.includes('waiting time unknown'));
  assert.ok(html.includes('no promised date set'));
  assert.ok(!html.includes('<b>&amp;</b>'));
});

test('csv: header, rows, overdue flag, and quoting of commas and quotes', () => {
  const queue = buildPendingInstallationQueue([
    entry('c1', 'A, "Quoted"', enquiryOnly, { promisedInstallDate: '2026-11-09' }),
    entry('c2', 'B', []),
  ], { today: TODAY });
  const csv = pendingInstallationCsv(queue);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'customerId,customerName,mohalla,enquiryDate,daysWaiting,currentStep,promisedInstallDate,promisedOverdue');
  assert.ok(lines[1].includes('"A, ""Quoted"""'));
  assert.ok(lines[1].endsWith('2026-11-09,yes'));
  assert.equal(lines[2], 'c2,B,,,,Enquiry,,no');
  assert.equal(pendingInstallationCsv([]), lines[0]);
});

test('filename: pending installations csv name', () => {
  assert.equal(pendingInstallationFilename(), 'pending-installations.csv');
});
