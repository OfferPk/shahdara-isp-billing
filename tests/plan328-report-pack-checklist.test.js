import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validReportPackMonth,
  validReportPackDay,
  foldReportPackStatus,
  normalizeReportPackReport,
  normalizeReportPackChecklist,
  normalizeReportPackChecklistList,
  findReportPackChecklist,
  findReportPackChecklistByMonth,
  recordReportPackChecklist,
  removeReportPackChecklist,
  markReportPackReport,
  completeReportPackChecklist,
  reportPackChecklistStatus,
  reportPackChecklistStatusText,
  reportPackChecklistsSorted,
  incompleteReportPackChecklists,
  reportPackChecklistSummaryText,
  reportPackChecklistText,
  reportPackChecklistHtml,
  reportPackChecklistsHtml,
  incompleteReportPackChecklistsHtml,
  reportPackChecklistCsv,
  reportPackChecklistFilename,
} from '../report-pack-checklist.js';

const first = {
  id: 'RPC-1',
  month: '2026-11',
  reports: [
    { name: 'Annual summary', status: 'included' },
    { name: 'Business review', status: 'included' },
    { name: 'Tax figures pack', status: 'missing' },
  ],
  assembler: 'Saad',
  dateCompleted: '',
};
const second = {
  id: 'RPC-2',
  month: '2026-10',
  reports: [
    { name: 'Annual summary', status: 'included' },
    { name: 'Business review', status: 'included' },
    { name: 'Tax figures pack', status: 'included' },
  ],
  assembler: 'Saad',
  dateCompleted: '2026-10-31',
};
const third = {
  id: 'RPC-3',
  month: '2026-09',
  reports: [{ name: 'Annual summary', status: 'missing' }],
  assembler: 'Aqib',
  dateCompleted: '',
};

test('strict months: YYYY-MM with a real month passes, anything else fails', () => {
  assert.equal(validReportPackMonth('2026-11'), true);
  assert.equal(validReportPackMonth('2026-01'), true);
  assert.equal(validReportPackMonth('2026-12'), true);
  assert.equal(validReportPackMonth('2026-00'), false);
  assert.equal(validReportPackMonth('2026-13'), false);
  assert.equal(validReportPackMonth('2026-1'), false);
  assert.equal(validReportPackMonth('2026/11'), false);
  assert.equal(validReportPackMonth('11-2026'), false);
  assert.equal(validReportPackMonth(''), false);
  assert.equal(validReportPackMonth(202611), false);
});

test('strict dates: real calendar dates pass, impossible ones fail', () => {
  assert.equal(validReportPackDay('2026-11-05'), true);
  assert.equal(validReportPackDay('2028-02-29'), true);
  assert.equal(validReportPackDay('2026-02-29'), false);
  assert.equal(validReportPackDay('2026-02-30'), false);
  assert.equal(validReportPackDay('2026-08-31'), true);
  assert.equal(validReportPackDay('2026-10-31'), true);
  assert.equal(validReportPackDay('2026-12-31'), true);
  assert.equal(validReportPackDay('2026-04-31'), false);
  assert.equal(validReportPackDay('2026-13-01'), false);
  assert.equal(validReportPackDay('2026-11-00'), false);
  assert.equal(validReportPackDay('05-11-2026'), false);
  assert.equal(validReportPackDay('2026/11/05'), false);
  assert.equal(validReportPackDay(''), false);
  assert.equal(validReportPackDay(20261105), false);
});

test('report status folds to included or missing, unknown reads as missing', () => {
  assert.equal(foldReportPackStatus('included'), 'included');
  assert.equal(foldReportPackStatus('Included'), 'included');
  assert.equal(foldReportPackStatus('  included  '), 'included');
  assert.equal(foldReportPackStatus('missing'), 'missing');
  assert.equal(foldReportPackStatus('pending'), 'missing');
  assert.equal(foldReportPackStatus(''), 'missing');
  assert.equal(foldReportPackStatus(null), 'missing');
});

test('normalise refuses a half-formed checklist', () => {
  assert.equal(normalizeReportPackChecklist({ ...first, id: '' }), null);
  assert.equal(normalizeReportPackChecklist({ ...first, month: '2026-13' }), null);
  assert.equal(normalizeReportPackChecklist({ ...first, month: 'Nov 2026' }), null);
  assert.equal(normalizeReportPackChecklist({ ...first, reports: [] }), null);
  assert.equal(normalizeReportPackChecklist({ ...first, reports: [{ name: '', status: 'included' }] }), null);
  assert.equal(normalizeReportPackChecklist({ ...first, assembler: '   ' }), null);
  assert.equal(normalizeReportPackChecklist(null), null);
  assert.equal(normalizeReportPackChecklist([]), null);
});

test('normalise keeps a valid checklist, drops unknown fields, and reads a bad completion date as null', () => {
  const clean = normalizeReportPackChecklist({
    ...first,
    billId: 'BILL-9',
    paymentId: 'PAY-9',
    customerId: 'CUST-9',
    dateCompleted: '2026-02-30',
  });
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.customerId, undefined);
  assert.equal(clean.dateCompleted, null);
  assert.equal(clean.month, '2026-11');
  assert.equal(clean.reports.length, 3);
  assert.equal(clean.reports[2].status, 'missing');
});

test('normalise dedupes report names case-insensitively, first spelling stays', () => {
  const clean = normalizeReportPackChecklist({
    ...first,
    reports: [
      { name: 'Annual summary', status: 'included' },
      { name: 'annual summary', status: 'missing' },
      { name: 'Business review', status: 'missing' },
    ],
  });
  assert.equal(clean.reports.length, 2);
  assert.equal(clean.reports[0].name, 'Annual summary');
  assert.equal(clean.reports[0].status, 'included');
});

test('list normalise keeps the first checklist for an id and for a month', () => {
  const clean = normalizeReportPackChecklistList([
    first,
    { ...second, id: 'RPC-1' },
    { ...second, month: '2026-11' },
    third,
  ]);
  assert.deepEqual(clean.map((item) => item.id), ['RPC-1', 'RPC-3']);
});

test('find by id and by month, or null when missing', () => {
  assert.equal(findReportPackChecklist([first, second], 'RPC-2').month, '2026-10');
  assert.equal(findReportPackChecklist([first, second], 'RPC-9'), null);
  assert.equal(findReportPackChecklistByMonth([first, second], '2026-11').id, 'RPC-1');
  assert.equal(findReportPackChecklistByMonth([first, second], '2026-08'), null);
});

test('record adds a checklist and refuses a duplicate id, a duplicate month, or a half-formed one', () => {
  const list = recordReportPackChecklist([], first);
  assert.equal(list.length, 1);
  assert.equal(recordReportPackChecklist(list, { ...second, id: 'RPC-1' }).length, 1);
  assert.equal(recordReportPackChecklist(list, { ...second, month: '2026-11' }).length, 1);
  assert.equal(recordReportPackChecklist(list, { ...second, month: 'bad' }).length, 1);
  assert.equal(recordReportPackChecklist(list, second).length, 2);
});

test('remove drops only the named checklist, a missing id leaves the list unchanged', () => {
  const list = [first, second, third];
  assert.deepEqual(removeReportPackChecklist(list, 'RPC-2').map((item) => item.id), ['RPC-1', 'RPC-3']);
  assert.equal(removeReportPackChecklist(list, 'RPC-9').length, 3);
  assert.equal(JSON.stringify(removeReportPackChecklist(list, 'RPC-9')), JSON.stringify(normalizeReportPackChecklistList(list)));
});

test('marking one report changes only that report', () => {
  const next = markReportPackReport([first, second], 'RPC-1', 'Tax figures pack', 'included');
  assert.equal(next[0].reports[2].status, 'included');
  assert.equal(next[0].reports[0].status, 'included');
  assert.equal(next[1].reports[2].status, 'included');
});

test('marking a report missing clears the completion date', () => {
  const next = markReportPackReport([second], 'RPC-2', 'Tax figures pack', 'missing');
  assert.equal(next[0].reports[2].status, 'missing');
  assert.equal(next[0].dateCompleted, null);
});

test('marking refuses a missing checklist, a missing report, or an unknown status', () => {
  const before = JSON.stringify(normalizeReportPackChecklistList([first, second]));
  assert.equal(JSON.stringify(markReportPackReport([first, second], 'RPC-9', 'Tax figures pack', 'included')), before);
  assert.equal(JSON.stringify(markReportPackReport([first, second], 'RPC-1', 'No such report', 'included')), before);
  assert.equal(JSON.stringify(markReportPackReport([first, second], 'RPC-1', 'Tax figures pack', 'pending')), before);
  assert.equal(JSON.stringify(markReportPackReport([first, second], 'RPC-1', 'TAX FIGURES PACK', 'included')) !== before, true);
});

test('completing needs every report included and a real completion date', () => {
  assert.equal(completeReportPackChecklist([first], 'RPC-1', '2026-11-30')[0].dateCompleted, null);
  const done = markReportPackReport([first], 'RPC-1', 'Tax figures pack', 'included');
  assert.equal(completeReportPackChecklist(done, 'RPC-1', '2026-11-30')[0].dateCompleted, '2026-11-30');
  assert.equal(completeReportPackChecklist(done, 'RPC-1', '2026-02-30')[0].dateCompleted, null);
  assert.equal(completeReportPackChecklist(done, 'RPC-9', '2026-11-30')[0].dateCompleted, null);
});

test('status counts included and missing and names the missing reports', () => {
  const status = reportPackChecklistStatus(first);
  assert.equal(status.total, 3);
  assert.equal(status.includedCount, 2);
  assert.equal(status.missingCount, 1);
  assert.deepEqual(status.missingNames, ['Tax figures pack']);
  assert.equal(status.complete, false);
  assert.equal(reportPackChecklistStatus(second).complete, true);
  assert.equal(reportPackChecklistStatus(null), null);
  assert.equal(reportPackChecklistStatus({ ...first, month: 'bad' }), null);
});

test('status text says complete or names what is missing', () => {
  assert.equal(reportPackChecklistStatusText(second), 'Complete: all 3 reports included.');
  assert.equal(reportPackChecklistStatusText(first), 'Incomplete: missing Tax figures pack.');
  assert.equal(reportPackChecklistStatusText(null), '');
});

test('sorting is newest month first, then id A-Z', () => {
  assert.deepEqual(reportPackChecklistsSorted([third, first, second]).map((item) => item.id), ['RPC-1', 'RPC-2', 'RPC-3']);
});

test('incomplete packs list only the packs still missing a report', () => {
  assert.deepEqual(incompleteReportPackChecklists([first, second, third]).map((item) => item.id), ['RPC-1', 'RPC-3']);
  assert.deepEqual(incompleteReportPackChecklists([second]), []);
});

test('summary text counts tracked, complete, and incomplete packs', () => {
  assert.equal(reportPackChecklistSummaryText([]), 'No monthly report packs tracked.');
  assert.equal(reportPackChecklistSummaryText([first, second, third]), '3 monthly packs tracked, 1 complete, 2 incomplete.');
  assert.equal(reportPackChecklistSummaryText([second]), '1 monthly pack tracked, 1 complete, 0 incomplete.');
});

test('plain-words line names the month, the counts, the assembler, and the completion date', () => {
  assert.equal(
    reportPackChecklistText(first),
    '2026-11: 2 of 3 reports included (missing Tax figures pack), assembled by Saad, not completed yet.',
  );
  assert.equal(
    reportPackChecklistText(second),
    '2026-10: 3 of 3 reports included, assembled by Saad, completed 2026-10-31.',
  );
  assert.equal(reportPackChecklistText(null), '');
});

test('HTML escapes user text and lists newest first', () => {
  const nasty = normalizeReportPackChecklist({
    ...first,
    assembler: '<b>Saad</b> & co',
    reports: [{ name: 'Report <script>', status: 'missing' }],
  });
  const html = reportPackChecklistHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;Saad&lt;/b&gt; &amp; co'), true);
  assert.equal(reportPackChecklistsHtml([]), '<p>No monthly report packs tracked.</p>');
  assert.equal(incompleteReportPackChecklistsHtml([second]), '<p>Every tracked pack is complete.</p>');
  const all = reportPackChecklistsHtml([third, first]);
  assert.equal(all.indexOf('2026-11') < all.indexOf('2026-09'), true);
});

test('CSV has one row per required report, quoted when a field holds a comma', () => {
  const csv = reportPackChecklistCsv([
    { ...first, reports: [{ name: 'Annual, summary', status: 'included' }] },
    second,
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'month,checklist id,report,status,assembler,date completed');
  assert.equal(lines[1], '2026-11,RPC-1,"Annual, summary",included,Saad,');
  assert.equal(lines[2], '2026-10,RPC-2,Annual summary,included,Saad,2026-10-31');
  assert.equal(lines.length, 5);
  assert.equal(reportPackChecklistFilename(), 'report-pack-checklists.csv');
});

test('inputs are never mutated', () => {
  const before = JSON.stringify([first, second]);
  const list = [first, second];
  recordReportPackChecklist(list, third);
  markReportPackReport(list, 'RPC-1', 'Tax figures pack', 'included');
  completeReportPackChecklist(list, 'RPC-2', '2026-10-31');
  removeReportPackChecklist(list, 'RPC-1');
  assert.equal(JSON.stringify(list), before);
  assert.equal(JSON.stringify(first), JSON.stringify({
    id: 'RPC-1',
    month: '2026-11',
    reports: [
      { name: 'Annual summary', status: 'included' },
      { name: 'Business review', status: 'included' },
      { name: 'Tax figures pack', status: 'missing' },
    ],
    assembler: 'Saad',
    dateCompleted: '',
  }));
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../report-pack-checklist.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
});

test('the module keeps its fences: no fenced file, no clock, no OLT', () => {
  const source = readFileSync(new URL('../report-pack-checklist.js', import.meta.url), 'utf8');
  for (const fenced of ['annual-summary', 'review-template', 'tax-figures', 'customer-completeness']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});
