import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validExportVerificationDay,
  foldExportVerificationResult,
  normalizeExportVerificationChecklist,
  normalizeExportVerificationChecklistList,
  findExportVerificationChecklist,
  recordExportVerificationChecklist,
  removeExportVerificationChecklist,
  exportVerificationVerdict,
  exportVerificationMismatchText,
  exportVerificationChecklistsSorted,
  exportVerificationChecklistsForExport,
  uncheckedExportVerificationChecklists,
  mismatchedExportVerificationChecklists,
  exportVerificationExportRefs,
  exportVerificationSummaryText,
  exportVerificationChecklistText,
  exportVerificationChecklistHtml,
  exportVerificationAllHtml,
  exportVerificationChecklistsForExportHtml,
  uncheckedExportVerificationChecklistsHtml,
  exportVerificationCsv,
  exportVerificationFilename,
} from '../export-verification.js';

const matchedFirst = {
  id: 'EVC-1', exportRef: 'EXP-2026-11-01', expectedCount: 100, foundCount: 100,
  dateFrom: '2026-11-01', dateTo: '2026-11-05', checker: 'Owner', result: 'match',
};
const mismatchedSecond = {
  id: 'EVC-2', exportRef: 'EXP-2026-10-01', expectedCount: 100, foundCount: 97,
  dateFrom: '2026-10-01', dateTo: '2026-10-31', checker: 'Saad', result: 'mismatch',
};
const uncheckedThird = {
  id: 'EVC-3', exportRef: 'EXP-2026-11-01', expectedCount: 50, foundCount: 50,
  dateFrom: '2026-11-01', dateTo: '2026-11-05', checker: 'Owner',
};

test('strict day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validExportVerificationDay('2026-11-04'), true);
  assert.equal(validExportVerificationDay('2028-02-29'), true);
  assert.equal(validExportVerificationDay('2027-02-29'), false);
  assert.equal(validExportVerificationDay('2026-11-31'), false);
  assert.equal(validExportVerificationDay('04-11-2026'), false);
  assert.equal(validExportVerificationDay(''), false);
  assert.equal(validExportVerificationDay(null), false);
});

test('result folds from plain spellings and a missing result reads as unchecked', () => {
  assert.equal(foldExportVerificationResult('matched'), 'match');
  assert.equal(foldExportVerificationResult('OK'), 'match');
  assert.equal(foldExportVerificationResult('mismatched'), 'mismatch');
  assert.equal(foldExportVerificationResult('different'), 'mismatch');
  assert.equal(foldExportVerificationResult('not checked'), 'unchecked');
  assert.equal(foldExportVerificationResult(''), 'unchecked');
  assert.equal(foldExportVerificationResult(undefined), 'unchecked');
  assert.equal(foldExportVerificationResult('something else'), 'unchecked');
});

test('normalising trims fields, accepts digit-string counts, and drops unknown fields', () => {
  const checklist = normalizeExportVerificationChecklist({
    ...matchedFirst, exportRef: '  EXP-2026-11-01  ', expectedCount: '100', billId: 'B-1', customerId: 'C-1',
  });
  assert.deepEqual(checklist, matchedFirst);
});

test('normalising refuses a checklist missing any required field', () => {
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, id: '' }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, exportRef: '   ' }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, expectedCount: -1 }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, expectedCount: 'one hundred' }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, foundCount: 99.5 }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, dateFrom: '2026-11-31' }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, dateTo: '2026-10-31' }), null);
  assert.equal(normalizeExportVerificationChecklist({ ...matchedFirst, checker: '' }), null);
  assert.equal(normalizeExportVerificationChecklist(null), null);
  assert.equal(normalizeExportVerificationChecklist([matchedFirst]), null);
});

test('an end date before its start date is refused', () => {
  assert.equal(normalizeExportVerificationChecklist({
    ...matchedFirst, dateFrom: '2026-11-05', dateTo: '2026-11-01',
  }), null);
  assert.notEqual(normalizeExportVerificationChecklist({
    ...matchedFirst, dateFrom: '2026-11-05', dateTo: '2026-11-05',
  }), null);
});

test('recording adds a checklist and refuses a duplicate id or a bad checklist', () => {
  const after = recordExportVerificationChecklist([matchedFirst], mismatchedSecond);
  assert.equal(after.length, 2);
  assert.equal(recordExportVerificationChecklist(after, { ...mismatchedSecond, checker: 'Owner' }).length, 2);
  assert.equal(recordExportVerificationChecklist([matchedFirst], { ...mismatchedSecond, dateFrom: 'not a date' }).length, 1);
});

test('removing takes out only that checklist and an unknown id changes nothing', () => {
  assert.deepEqual(removeExportVerificationChecklist([matchedFirst, mismatchedSecond], 'EVC-1'), [mismatchedSecond]);
  assert.deepEqual(removeExportVerificationChecklist([matchedFirst], 'EVC-9'), [matchedFirst]);
});

test('finding returns the checklist or null', () => {
  assert.deepEqual(findExportVerificationChecklist([matchedFirst, mismatchedSecond], 'EVC-2'), mismatchedSecond);
  assert.equal(findExportVerificationChecklist([matchedFirst], 'EVC-9'), null);
});

test('a claimed match whose counts differ is a mismatch, and the gap is named in plain words', () => {
  assert.equal(exportVerificationVerdict({ ...matchedFirst, foundCount: 99 }), 'mismatch');
  assert.equal(exportVerificationVerdict(matchedFirst), 'match');
  assert.equal(exportVerificationVerdict(mismatchedSecond), 'mismatch');
  assert.equal(exportVerificationVerdict(uncheckedThird), 'unchecked');
  assert.equal(exportVerificationMismatchText({ ...matchedFirst, foundCount: 99 }), 'expected 100 records, found 99 records — 1 missing');
  assert.equal(exportVerificationMismatchText({ ...matchedFirst, foundCount: 103 }), 'expected 100 records, found 103 records — 3 extra');
  assert.equal(exportVerificationMismatchText(matchedFirst), '');
});

test('checklists sort by earliest covered start date first', () => {
  assert.deepEqual(
    exportVerificationChecklistsSorted([mismatchedSecond, uncheckedThird, matchedFirst]).map((item) => item.id),
    ['EVC-2', 'EVC-1', 'EVC-3'],
  );
});

test('checklists for one export list by date and match regardless of capital letters', () => {
  assert.deepEqual(
    exportVerificationChecklistsForExport([mismatchedSecond, uncheckedThird, matchedFirst], 'exp-2026-11-01').map((item) => item.id),
    ['EVC-1', 'EVC-3'],
  );
  assert.deepEqual(exportVerificationChecklistsForExport([matchedFirst], 'EXP-2026-10-01'), []);
  assert.deepEqual(exportVerificationChecklistsForExport([matchedFirst], ''), []);
});

test('unchecked and mismatched lists pick out only their own verdicts', () => {
  const all = [matchedFirst, mismatchedSecond, uncheckedThird];
  assert.deepEqual(uncheckedExportVerificationChecklists(all).map((item) => item.id), ['EVC-3']);
  assert.deepEqual(mismatchedExportVerificationChecklists(all).map((item) => item.id), ['EVC-2']);
  assert.deepEqual(uncheckedExportVerificationChecklists([matchedFirst]), []);
  assert.deepEqual(mismatchedExportVerificationChecklists([matchedFirst]), []);
});

test('export references list is distinct in first-recorded order', () => {
  assert.deepEqual(
    exportVerificationExportRefs([matchedFirst, mismatchedSecond, uncheckedThird]),
    ['EXP-2026-11-01', 'EXP-2026-10-01'],
  );
  assert.deepEqual(exportVerificationExportRefs([]), []);
});

test('summary text counts checklists by verdict in plain words', () => {
  assert.equal(exportVerificationSummaryText([]), 'No export verification checklists recorded.');
  assert.equal(exportVerificationSummaryText([matchedFirst]), '1 verification checklist: 1 matched, 0 mismatched, 0 unchecked.');
  assert.equal(
    exportVerificationSummaryText([matchedFirst, mismatchedSecond, uncheckedThird]),
    '3 verification checklists: 1 matched, 1 mismatched, 1 unchecked.',
  );
});

test('one checklist reads as a plain-words line with counts, verdict, and checker visible', () => {
  assert.equal(
    exportVerificationChecklistText(matchedFirst),
    'EXP-2026-11-01 — 2026-11-01 to 2026-11-05 — expected 100 records, found 100 records — match — checked by Owner.',
  );
  assert.equal(
    exportVerificationChecklistText(mismatchedSecond),
    'EXP-2026-10-01 — 2026-10-01 to 2026-10-31 — expected 100 records, found 97 records — mismatch — checked by Saad. — expected 100 records, found 97 records — 3 missing',
  );
  assert.equal(exportVerificationChecklistText({ ...matchedFirst, dateFrom: 'bad' }), '');
});

test('html escapes user text so a checklist cannot break the page', () => {
  const html = exportVerificationChecklistHtml({ ...matchedFirst, checker: 'Owner <b>boss</b> & Saad' });
  assert.match(html, /checked by Owner &lt;b&gt;boss&lt;\/b&gt; &amp; Saad/);
  assert.equal(html.includes('<b>'), false);
});

test('all html groups checklists by verdict with matched first and unchecked last', () => {
  const html = exportVerificationAllHtml([uncheckedThird, mismatchedSecond, matchedFirst]);
  assert.match(html, /<h4>Matched<\/h4>/);
  assert.match(html, /<h4>Mismatched<\/h4>/);
  assert.match(html, /<h4>Unchecked<\/h4>/);
  assert.ok(html.indexOf('<h4>Matched</h4>') < html.indexOf('<h4>Mismatched</h4>'));
  assert.ok(html.indexOf('<h4>Mismatched</h4>') < html.indexOf('<h4>Unchecked</h4>'));
  assert.ok(html.indexOf('EVC-1') === -1, 'ids stay out of the display html');
  assert.equal(exportVerificationAllHtml([]), '<p>No export verification checklists recorded.</p>');
});

test('per-export html lists that export only and says so when there is nothing', () => {
  const html = exportVerificationChecklistsForExportHtml([matchedFirst, mismatchedSecond, uncheckedThird], 'EXP-2026-11-01');
  assert.match(html, /expected 100 records, found 100 records/);
  assert.match(html, /expected 50 records, found 50 records/);
  assert.equal(html.includes('expected 100 records, found 97 records'), false);
  assert.equal(
    exportVerificationChecklistsForExportHtml([matchedFirst], 'EXP-2026-10-01'),
    '<p>No verification checklists for that export.</p>',
  );
});

test('unchecked html lists only unchecked checklists and says so when there are none', () => {
  const html = uncheckedExportVerificationChecklistsHtml([matchedFirst, mismatchedSecond, uncheckedThird]);
  assert.match(html, /expected 50 records, found 50 records/);
  assert.equal(html.includes('expected 100 records, found 100 records'), false);
  assert.equal(
    uncheckedExportVerificationChecklistsHtml([matchedFirst]),
    '<p>No unchecked exports.</p>',
  );
});

test('csv lists checklists earliest covered start date first with a header and the fixed filename', () => {
  const csv = exportVerificationCsv([uncheckedThird, matchedFirst, mismatchedSecond]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,exportRef,expectedCount,foundCount,dateFrom,dateTo,checker,result');
  assert.match(lines[1], /^EVC-2,EXP-2026-10-01,100,97,2026-10-01,2026-10-31,Saad,mismatch$/);
  assert.match(lines[2], /^EVC-1,EXP-2026-11-01,100,100,2026-11-01,2026-11-05,Owner,match$/);
  assert.match(lines[3], /^EVC-3,EXP-2026-11-01,50,50,2026-11-01,2026-11-05,Owner,unchecked$/);
  assert.equal(exportVerificationFilename(), 'export-verification-checklists.csv');
});

test('csv quotes a checker name that contains a comma', () => {
  const csv = exportVerificationCsv([{ ...matchedFirst, checker: 'Owner, Shahdara' }]);
  assert.match(csv, /"Owner, Shahdara"/);
});

test('recording a checklist leaves the input list untouched', () => {
  const before = [matchedFirst];
  const after = recordExportVerificationChecklist(before, mismatchedSecond);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
});

test('a checklist changes nothing else: no amount, bill, payment, customer, or staff field survives', () => {
  const checklist = normalizeExportVerificationChecklist({
    ...matchedFirst, amount: 5000, billId: 'B-1', paymentId: 'P-1', customerId: 'C-1', staffId: 'S-1',
  });
  assert.deepEqual(Object.keys(checklist).sort(), ['checker', 'dateFrom', 'dateTo', 'expectedCount', 'exportRef', 'foundCount', 'id', 'result']);
});

test('module is pure and import-free', () => {
  const source = readFileSync(new URL('../export-verification.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: export pack, custody log, archive index, restore drill, and backup verification are untouched', () => {
  const source = readFileSync(new URL('../export-verification.js', import.meta.url), 'utf8');
  assert.equal(source.includes('export-pack'), false, 'module must not reference the export pack module');
  assert.equal(source.includes('export-custody'), false, 'module must not reference the export custody log module');
  assert.equal(source.includes('archive-index'), false, 'module must not reference the year-end archive index module');
  assert.equal(source.includes('restore-drill'), false, 'module must not reference the restore drill record module');
  assert.equal(source.includes('backup-verification'), false, 'module must not reference the backup verification module');
  assert.equal(existsSync(new URL('../export-pack.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../export-custody.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../archive-index.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../restore-drill.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../backup-verification.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'evcHeading', 'evcSummary', 'evcBody', 'evcExportBtn',
    'evcId', 'evcExportRef', 'evcExpected', 'evcFound', 'evcDateFrom', 'evcDateTo',
    'evcChecker', 'evcResult', 'evcRecordBtn',
    'evcRemoveId', 'evcRemoveBtn',
    'evcRefSelect', 'evcRefBody', 'evcUncheckedBody',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html is missing ${id}`);
});
