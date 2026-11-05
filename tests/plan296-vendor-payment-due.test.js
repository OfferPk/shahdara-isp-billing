import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validVendorPaymentDueDate,
  foldVendorPaymentDueStatus,
  normalizeVendorPaymentDue,
  normalizeVendorPaymentDueList,
  findVendorPaymentDue,
  recordVendorPaymentDue,
  removeVendorPaymentDue,
  markVendorPaymentDueSeen,
  markVendorPaymentDueSettled,
  vendorPaymentDuesSorted,
  vendorPaymentDueNext,
  vendorPaymentDuesForVendor,
  vendorPaymentDueVendors,
  vendorPaymentDuesOverdue,
  vendorPaymentDueSummaryText,
  vendorPaymentDueEntryText,
  vendorPaymentDueEntryHtml,
  vendorPaymentDueAllHtml,
  vendorPaymentDuesOverdueHtml,
  vendorPaymentDuesForVendorHtml,
  vendorPaymentDueCsv,
  vendorPaymentDueFilename,
} from '../vendor-payment-due.js';

const first = {
  id: 'VD-1',
  vendor: 'Fibre House Lahore',
  amount: 12500,
  dueDate: '2026-11-10',
  scheduleRef: 'VB-2026-11',
  status: 'due',
};
const second = {
  id: 'VD-2',
  vendor: 'ONU Traders',
  amount: 8000,
  dueDate: '2026-11-05',
  scheduleRef: 'VB-2026-10',
  status: 'seen',
};
const third = {
  id: 'VD-3',
  vendor: 'fibre house lahore',
  amount: 42000,
  dueDate: '2026-10-28',
  scheduleRef: '',
  status: 'settled',
};
const fixture = [second, first, third];

test('half-formed due notes are refused', () => {
  assert.equal(normalizeVendorPaymentDue(null), null);
  assert.equal(normalizeVendorPaymentDue([]), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, id: '  ' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, vendor: '' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, amount: '' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, amount: 0 }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, amount: -100 }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, amount: 12500.5 }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, amount: '12,500' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, dueDate: '' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, dueDate: '2026-13-10' }), null);
  assert.equal(normalizeVendorPaymentDue({ ...first, dueDate: '10-11-2026' }), null);
  assert.deepEqual(normalizeVendorPaymentDue(first), first);
  assert.deepEqual(normalizeVendorPaymentDue({ ...first, amount: '12500' }).amount, 12500);
  assert.deepEqual(normalizeVendorPaymentDue({ ...first, vendor: '  Fibre House Lahore  ' }).vendor, 'Fibre House Lahore');
  const { scheduleRef, ...noRef } = first;
  assert.equal(normalizeVendorPaymentDue(noRef).scheduleRef, '');
  assert.equal(normalizeVendorPaymentDue(third).scheduleRef, '');
});

test('status folds from plain spellings and defaults to due', () => {
  assert.equal(foldVendorPaymentDueStatus('due'), 'due');
  assert.equal(foldVendorPaymentDueStatus('Pending'), 'due');
  assert.equal(foldVendorPaymentDueStatus('UNPAID'), 'due');
  assert.equal(foldVendorPaymentDueStatus('awaiting'), 'due');
  assert.equal(foldVendorPaymentDueStatus('seen'), 'seen');
  assert.equal(foldVendorPaymentDueStatus('Noted'), 'seen');
  assert.equal(foldVendorPaymentDueStatus('ACKNOWLEDGED'), 'seen');
  assert.equal(foldVendorPaymentDueStatus('settled'), 'settled');
  assert.equal(foldVendorPaymentDueStatus('Paid'), 'settled');
  assert.equal(foldVendorPaymentDueStatus('done'), 'settled');
  assert.equal(foldVendorPaymentDueStatus(''), 'due');
  assert.equal(foldVendorPaymentDueStatus('maybe'), 'due');
  assert.equal(foldVendorPaymentDueStatus(undefined), 'due');
  assert.equal(normalizeVendorPaymentDue({ ...first, status: undefined }).status, 'due');
  assert.equal(normalizeVendorPaymentDue({ ...first, status: 'PAID' }).status, 'settled');
});

test('strict dates: real calendar only', () => {
  assert.equal(validVendorPaymentDueDate('2026-02-29'), false);
  assert.equal(validVendorPaymentDueDate('2024-02-29'), true);
  assert.equal(validVendorPaymentDueDate('2026-04-31'), false);
  assert.equal(validVendorPaymentDueDate('2026-11-05'), true);
  assert.equal(validVendorPaymentDueDate('2026-00-10'), false);
  assert.equal(validVendorPaymentDueDate('2026-11-00'), false);
  assert.equal(validVendorPaymentDueDate(20261105), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = {
    ...first,
    billId: 'B-1',
    paymentId: 'P-1',
    scheduleId: 'S-1',
    extra: 'drop me',
  };
  const clean = normalizeVendorPaymentDue(raw);
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.scheduleId, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['amount', 'dueDate', 'id', 'scheduleRef', 'status', 'vendor']);
  const before = JSON.stringify(raw);
  normalizeVendorPaymentDue(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordVendorPaymentDue([first], { ...first, amount: 1 });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordVendorPaymentDue([first], { ...first, id: 'VD-9', dueDate: '2026-11-11' }), [first, {
    id: 'VD-9', vendor: 'Fibre House Lahore', amount: 12500, dueDate: '2026-11-11', scheduleRef: 'VB-2026-11', status: 'due',
  }]);
});

test('find and remove', () => {
  assert.deepEqual(findVendorPaymentDue(fixture, 'VD-2'), second);
  assert.equal(findVendorPaymentDue(fixture, 'VD-9'), null);
  assert.equal(findVendorPaymentDue(fixture, ''), null);
  assert.deepEqual(removeVendorPaymentDue(fixture, 'VD-2'), [first, third]);
  assert.deepEqual(removeVendorPaymentDue(fixture, 'VD-9'), fixture);
});

test('marking seen or settled changes only the note, never any other record', () => {
  const seen = markVendorPaymentDueSeen(fixture, 'VD-1');
  assert.equal(findVendorPaymentDue(seen, 'VD-1').status, 'seen');
  assert.equal(findVendorPaymentDue(seen, 'VD-2').status, 'seen');
  assert.equal(findVendorPaymentDue(seen, 'VD-3').status, 'settled');
  // A settled note stays settled when marked seen.
  assert.equal(findVendorPaymentDue(markVendorPaymentDueSeen(fixture, 'VD-3'), 'VD-3').status, 'settled');
  const settled = markVendorPaymentDueSettled(fixture, 'VD-2');
  assert.equal(findVendorPaymentDue(settled, 'VD-2').status, 'settled');
  assert.equal(findVendorPaymentDue(settled, 'VD-1').status, 'due');
  // The original list is untouched.
  assert.equal(findVendorPaymentDue(fixture, 'VD-1').status, 'due');
  assert.equal(markVendorPaymentDueSeen(fixture, 'VD-9').length, 3);
  assert.equal(markVendorPaymentDueSettled(fixture, '').length, 3);
});

test('sorting is by due date then vendor then id', () => {
  assert.deepEqual(vendorPaymentDuesSorted(fixture).map((note) => note.id), ['VD-3', 'VD-2', 'VD-1']);
  assert.deepEqual(vendorPaymentDuesSorted([{ ...first, id: 'VD-0', dueDate: '2026-11-10' }, first]).map((note) => note.id), ['VD-0', 'VD-1']);
  assert.deepEqual(vendorPaymentDueNext(fixture), second);
  assert.equal(vendorPaymentDueNext([third]), null);
  assert.equal(vendorPaymentDueNext([]), null);
});

test('due notes list per vendor with the first spelling kept', () => {
  assert.deepEqual(vendorPaymentDuesForVendor(fixture, 'FIBRE HOUSE LAHORE').map((note) => note.id), ['VD-3', 'VD-1']);
  assert.deepEqual(vendorPaymentDuesForVendor(fixture, 'ONU Traders').map((note) => note.id), ['VD-2']);
  assert.deepEqual(vendorPaymentDuesForVendor(fixture, 'No such vendor'), []);
  assert.deepEqual(vendorPaymentDuesForVendor(fixture, ''), []);
  assert.deepEqual(vendorPaymentDueVendors(fixture), ['Fibre House Lahore', 'ONU Traders']);
  assert.deepEqual(vendorPaymentDueVendors([]), []);
});

test('overdue notes are visible against a caller-supplied as-of date', () => {
  assert.deepEqual(vendorPaymentDuesOverdue(fixture, '2026-11-06').map((note) => note.id), ['VD-2']);
  // A note due on the as-of day itself is not overdue yet.
  assert.deepEqual(vendorPaymentDuesOverdue(fixture, '2026-11-05').map((note) => note.id), []);
  // A settled note is never overdue, however old it is.
  assert.deepEqual(vendorPaymentDuesOverdue(fixture, '2026-12-01').map((note) => note.id), ['VD-2', 'VD-1']);
  assert.deepEqual(vendorPaymentDuesOverdue(fixture, 'not-a-date'), []);
  assert.deepEqual(vendorPaymentDuesOverdue(fixture, ''), []);
  assert.deepEqual(vendorPaymentDuesOverdue([], '2026-11-06'), []);
});

test('summary text names the counts, the overdue notes, and the next due note', () => {
  assert.equal(vendorPaymentDueSummaryText([]), 'No vendor payment due notes recorded.');
  assert.equal(
    vendorPaymentDueSummaryText([first], '2026-11-06'),
    '1 vendor payment due note recorded: 1 due, 0 seen, 0 settled, 0 overdue. Next due: Fibre House Lahore, Rs 12500, due 2026-11-10.',
  );
  assert.equal(
    vendorPaymentDueSummaryText(fixture, '2026-11-06'),
    '3 vendor payment due notes recorded: 1 due, 1 seen, 1 settled, 1 overdue. Next due: ONU Traders, Rs 8000, due 2026-11-05.',
  );
  assert.equal(
    vendorPaymentDueSummaryText([third], '2026-11-06'),
    '1 vendor payment due note recorded: 0 due, 0 seen, 1 settled, 0 overdue. Nothing outstanding.',
  );
});

test('entry text shows vendor, amount, due date, schedule reference, and status', () => {
  assert.equal(vendorPaymentDueEntryText(null), 'No vendor payment due note recorded.');
  assert.equal(
    vendorPaymentDueEntryText(first),
    '2026-11-10 — Fibre House Lahore, Rs 12500, schedule VB-2026-11, due.',
  );
  assert.equal(
    vendorPaymentDueEntryText(third),
    '2026-10-28 — fibre house lahore, Rs 42000, settled.',
  );
});

test('HTML escapes input', () => {
  const nasty = { ...second, vendor: 'ONU & Traders <b>bold</b>' };
  assert.equal(vendorPaymentDueEntryHtml(nasty).includes('<b>'), false);
  assert.equal(vendorPaymentDueEntryHtml(nasty).includes('ONU &amp; Traders &lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(vendorPaymentDueEntryHtml(null), '<p>No vendor payment due note recorded.</p>');
  const html = vendorPaymentDueAllHtml(fixture);
  assert.equal(html.includes('2026-11-10'), true);
  assert.equal(html.includes('ONU Traders'), true);
  assert.equal(vendorPaymentDueAllHtml([]), '<p>No vendor payment due notes recorded.</p>');
  assert.equal(vendorPaymentDuesOverdueHtml(fixture, '2026-11-06').includes('ONU Traders'), true);
  assert.equal(vendorPaymentDuesOverdueHtml(fixture, '2026-11-01'), '<p>No overdue vendor payments.</p>');
  assert.equal(vendorPaymentDuesForVendorHtml(fixture, 'ONU Traders').includes('ONU Traders'), true);
  assert.equal(vendorPaymentDuesForVendorHtml(fixture, 'No such vendor'), '<p>No vendor payment due notes for this vendor.</p>');
});

test('CSV export and filename', () => {
  const csv = vendorPaymentDueCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","vendor","amount","due date","schedule reference","status"');
  assert.equal(csv.includes('"VD-2","ONU Traders","8000","2026-11-05","VB-2026-10","seen"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"VD-3"'), true);
  assert.equal(vendorPaymentDueFilename(), 'vendor-payment-dues.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeVendorPaymentDueList(null), []);
  assert.deepEqual(normalizeVendorPaymentDueList('nope'), []);
  assert.deepEqual(normalizeVendorPaymentDueList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../vendor-payment-due.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the recurring vendor bill schedule record is untouched', () => {
  const source = readFileSync(new URL('../vendor-payment-due.js', import.meta.url), 'utf8');
  assert.equal(source.includes('vendor-bills.js'), false, 'module must not reference the vendor bill schedule module');
  assert.equal(existsSync(new URL('../vendor-bills.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'vpdHeading', 'vpdSummary', 'vpdExportBtn', 'vpdVendor', 'vpdAmount',
    'vpdDueDate', 'vpdScheduleRef', 'vpdStatus', 'vpdRecordBtn',
    'vpdRemoveId', 'vpdRemoveBtn', 'vpdMarkSeenId', 'vpdMarkSeenBtn',
    'vpdMarkSettledId', 'vpdMarkSettledBtn', 'vpdOverdueBody', 'vpdVendorSelect',
    'vpdVendorBody', 'vpdBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the vendor payment due panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './vendor-payment-due.js'"), true);
  assert.equal(source.includes('renderVendorPaymentDue()'), true);
  assert.equal(source.includes('loadVendorPaymentDues()'), true);
  assert.equal(source.includes('shahdara_vendor_payment_dues_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
