import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeInstalmentDefault,
  normalizeInstalmentDefaultList,
  findInstalmentDefault,
  recordInstalmentDefault,
  removeInstalmentDefault,
  markInstalmentPaidLate,
  instalmentDefaultsSorted,
  instalmentDefaultsOpen,
  instalmentDefaultsForSchedule,
  instalmentDefaultSummaryText,
  instalmentDefaultText,
  instalmentDefaultHtml,
  instalmentDefaultAllHtml,
  instalmentDefaultCsv,
  instalmentDefaultFilename,
} from '../instalment-default.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'instalment-default.js'), 'utf8');

const first = {
  id: 'ID-1', scheduleRef: 'SCH-1', customer: 'Ahmed', dueDate: '2026-10-05',
  amountMissed: 1500, dateNoted: '2026-10-06', nextStep: 'Visit and agree a catch-up date.',
};
const second = {
  id: 'ID-2', scheduleRef: 'SCH-2', customer: 'Bilal', dueDate: '2026-09-05',
  amountMissed: 800, dateNoted: '2026-09-06', nextStep: 'Call the customer.',
};

test('a note with no schedule reference, no due date, no amount, no date noted, or no next step is refused', () => {
  assert.equal(normalizeInstalmentDefault({ ...first, scheduleRef: '' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, dueDate: '' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, amountMissed: 0 }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, amountMissed: -50 }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, dateNoted: '' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, nextStep: '' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, id: '' }), null);
});

test('strict dates refuse impossible dates and accept a leap-day date', () => {
  assert.equal(normalizeInstalmentDefault({ ...first, dueDate: '2026-02-30' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, dateNoted: '2024-02-29' })?.dateNoted, '2024-02-29');
  assert.equal(normalizeInstalmentDefault({ ...first, dueDate: '2026-02-29' }), null);
  assert.equal(normalizeInstalmentDefault({ ...first, dueDate: '2026-13-01' }), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billTotal: 99999, penalty: 500 };
  const clean = normalizeInstalmentDefault(raw);
  assert.equal('billTotal' in clean, false);
  assert.equal('penalty' in clean, false);
  assert.equal(raw.billTotal, 99999);
  const list = [first];
  recordInstalmentDefault(list, second);
  assert.equal(list.length, 1);
});

test('duplicate ids are never rewritten and there is no edit path', () => {
  const list = recordInstalmentDefault([first], { ...first, nextStep: 'Changed step.' });
  assert.equal(list.length, 1);
  assert.equal(list[0].nextStep, first.nextStep);
  assert.equal(normalizeInstalmentDefaultList([first, { ...first, nextStep: 'Other.' }]).length, 1);
});

test('find and remove work by id', () => {
  const list = [first, second];
  assert.equal(findInstalmentDefault(list, 'ID-2')?.scheduleRef, 'SCH-2');
  assert.equal(findInstalmentDefault(list, 'ID-9'), null);
  assert.deepEqual(removeInstalmentDefault(list, 'ID-1').map((n) => n.id), ['ID-2']);
});

test('the default list is ordered by due date, then schedule reference, then id', () => {
  const later = { ...first, id: 'ID-3', scheduleRef: 'SCH-1', dueDate: '2026-10-05' };
  const sorted = instalmentDefaultsSorted([first, second, later]);
  assert.deepEqual(sorted.map((n) => n.id), ['ID-2', 'ID-1', 'ID-3']);
});

test('a paid-late instalment leaves the open list but its note is kept', () => {
  const list = markInstalmentPaidLate([first, second], 'ID-1', '2026-10-20');
  assert.deepEqual(instalmentDefaultsOpen(list).map((n) => n.id), ['ID-2']);
  assert.equal(findInstalmentDefault(list, 'ID-1')?.status, 'paid late');
  assert.equal(findInstalmentDefault(list, 'ID-1')?.paidDate, '2026-10-20');
  assert.equal(instalmentDefaultsSorted(list).length, 2);
  assert.equal(findInstalmentDefault(list, 'ID-1')?.nextStep, first.nextStep);
});

test('marking paid late needs a strict paid date and never rewrites a first paid date', () => {
  assert.deepEqual(markInstalmentPaidLate([first], 'ID-1', '2026-02-30'), [normalizeInstalmentDefault(first)]);
  const once = markInstalmentPaidLate([first], 'ID-1', '2026-10-20');
  const twice = markInstalmentPaidLate(once, 'ID-1', '2026-10-25');
  assert.equal(findInstalmentDefault(twice, 'ID-1')?.paidDate, '2026-10-20');
  assert.deepEqual(markInstalmentPaidLate([first], 'ID-9', '2026-10-20'), [normalizeInstalmentDefault(first)]);
});

test('defaults filter by exact schedule reference', () => {
  assert.deepEqual(instalmentDefaultsForSchedule([first, second], 'SCH-1').map((n) => n.id), ['ID-1']);
  assert.deepEqual(instalmentDefaultsForSchedule([first, second], ''), []);
});

test('summary text counts open, paid late, and total notes', () => {
  assert.equal(instalmentDefaultSummaryText([first, second]), '2 open instalment default(s), 0 paid late, 2 note(s) in total.');
  const paid = markInstalmentPaidLate([first, second], 'ID-1', '2026-10-20');
  assert.equal(instalmentDefaultSummaryText(paid), '1 open instalment default(s), 1 paid late, 2 note(s) in total.');
});

test('note text names the schedule, due date, amount, and next step', () => {
  assert.match(instalmentDefaultText(normalizeInstalmentDefault(first)), /SCH-1/);
  assert.match(instalmentDefaultText(normalizeInstalmentDefault(first)), /2026-10-05/);
  assert.match(instalmentDefaultText(normalizeInstalmentDefault(first)), /1500/);
  assert.match(instalmentDefaultText(normalizeInstalmentDefault(first)), /Visit and agree a catch-up date\./);
  assert.equal(instalmentDefaultText(null), 'No instalment default note.');
  const paid = markInstalmentPaidLate([first], 'ID-1', '2026-10-20')[0];
  assert.match(instalmentDefaultText(paid), /Paid late on 2026-10-20\./);
});

test('HTML rendering escapes markup in the next step', () => {
  const nasty = normalizeInstalmentDefault({ ...first, nextStep: '<script>alert(1)</script>' });
  assert.equal(instalmentDefaultHtml(nasty).includes('<script>'), false);
  assert.match(instalmentDefaultAllHtml([first]), /SCH-1/);
  assert.match(instalmentDefaultAllHtml([]), /No instalment default notes yet\./);
});

test('CSV export uses the instalment-defaults filename and sorted order', () => {
  assert.equal(instalmentDefaultFilename(), 'instalment-defaults.csv');
  const csv = instalmentDefaultCsv([first, second]);
  assert.match(csv, /^Schedule,Customer,Due date,Amount missed,Date noted,Next step,Status,Paid date\n/);
  assert.ok(csv.indexOf('SCH-2') < csv.indexOf('SCH-1'));
});

test('a note carries no bill, payment, or schedule-mutation field', () => {
  const clean = normalizeInstalmentDefault(first);
  assert.deepEqual(Object.keys(clean).sort(), ['amountMissed', 'customer', 'dateNoted', 'dueDate', 'id', 'nextStep', 'paidDate', 'scheduleRef', 'status']);
});

test('the module never reads storage, the clock, or the network', () => {
  assert.equal(/localStorage|Date\(\)|new Date|fetch\(/.test(moduleSrc), false);
});

test('the module never reads or rewrites the arrears-plan or charge-schedule modules', () => {
  assert.equal(/from '\.\//.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('charge-instalments.js'), false);
  assert.equal(moduleSrc.includes('installment-plan.js'), false);
});

test('app.js wires the instalment-default panel', () => {
  assert.match(appJs, /from '\.\/instalment-default\.js'/);
  assert.match(appJs, /renderInstalmentDefaults\(\)/);
  assert.match(appJs, /INSTALMENT_DEFAULT_KEY/);
});

test('index.html carries the instalment-default panel element ids', () => {
  for (const id of ['idBody', 'idSummary', 'idExportBtn', 'idSaveBtn', 'idRemoveBtn', 'idRemoveId',
    'idScheduleRef', 'idCustomer', 'idDueDate', 'idAmount', 'idDateNoted', 'idNextStep',
    'idPaidLateId', 'idPaidLateDate', 'idPaidLateBtn', 'idScheduleFilter']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.equal(/\bOLT\b/.test(appJs), false);
});
