import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validToolKitDate,
  normalizeToolKitRecord,
  normalizeToolKitList,
  findToolKitRecord,
  isToolKitOutstanding,
  upsertToolKitIssue,
  returnToolKitIssue,
  removeToolKitIssue,
  toolKitAgeDays,
  outstandingToolKitList,
  toolKitSummaryText,
  toolKitOutstandingHtml,
  toolKitCsv,
  toolKitFilename,
} from '../tool-kit-log.js';

const dir = dirname(fileURLToPath(import.meta.url));
const base = { id: 'KIT-1', tool: 'Fusion splicer', issuedTo: 'Saad', issueDate: '2026-11-01' };

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validToolKitDate('2026-08-31'), '2026-08-31');
  assert.equal(validToolKitDate('2026-10-31'), '2026-10-31');
  assert.equal(validToolKitDate('2026-12-31'), '2026-12-31');
  assert.equal(validToolKitDate('2024-02-29'), '2024-02-29');
  assert.equal(validToolKitDate('2026-02-29'), null);
  assert.equal(validToolKitDate('2026-02-30'), null);
  assert.equal(validToolKitDate('2026-04-31'), null);
  assert.equal(validToolKitDate('2026-09-31'), null);
  assert.equal(validToolKitDate('2026-11-31'), null);
  assert.equal(validToolKitDate('2026-13-01'), null);
  assert.equal(validToolKitDate('01-11-2026'), null);
  assert.equal(validToolKitDate(''), null);
  assert.equal(validToolKitDate(null), null);
});

test('half-formed records refused: no tool, no holder, no date', () => {
  assert.equal(normalizeToolKitRecord({ ...base, tool: '' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, tool: '   ' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, issuedTo: '' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, issueDate: '' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, issueDate: '2026-02-30' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, id: '' }), null);
  assert.equal(normalizeToolKitRecord(null), null);
  assert.equal(normalizeToolKitRecord('nope'), null);
});

test('return date before issue date refused; valid return date kept; empty means outstanding', () => {
  assert.equal(normalizeToolKitRecord({ ...base, returnDate: '2026-10-31' }), null);
  assert.equal(normalizeToolKitRecord({ ...base, returnDate: '2026-02-30' }), null);
  assert.deepEqual(normalizeToolKitRecord({ ...base, returnDate: '2026-11-01' }).returnDate, '2026-11-01');
  assert.deepEqual(normalizeToolKitRecord({ ...base, returnDate: '2026-11-05' }).returnDate, '2026-11-05');
  const open = normalizeToolKitRecord(base);
  assert.equal(open.returnDate, '');
  assert.equal(isToolKitOutstanding(open), true);
  assert.equal(isToolKitOutstanding({ ...open, returnDate: '2026-11-05' }), false);
});

test('unknown fields dropped', () => {
  const record = normalizeToolKitRecord({ ...base, stockCount: 5, paymentId: 'P-1', warranty: 'yes' });
  assert.deepEqual(Object.keys(record).sort(), ['id', 'issueDate', 'issuedTo', 'note', 'returnDate', 'tool']);
});

test('normalize list drops half-formed records and duplicate ids (first wins)', () => {
  const rows = normalizeToolKitList([
    base,
    { ...base, tool: '' },
    { ...base, tool: 'OTDR' },
    { id: 'KIT-2', tool: 'OTDR', issuedTo: 'Saad', issueDate: '2026-11-02' },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ['KIT-1', 'KIT-2']);
  assert.equal(rows[0].tool, 'Fusion splicer');
  assert.deepEqual(normalizeToolKitList(null), []);
  assert.deepEqual(normalizeToolKitList('nope'), []);
});

test('duplicate ids never rewritten', () => {
  const before = [base];
  assert.deepEqual(upsertToolKitIssue(before, base), [normalizeToolKitRecord(base)]);
  assert.deepEqual(upsertToolKitIssue(before, { ...base, tool: 'OTDR' }), [normalizeToolKitRecord(base)]);
});

test('one outstanding issue per tool, case-insensitive; fresh issue allowed after return', () => {
  const first = upsertToolKitIssue([], base);
  assert.equal(first.length, 1);
  const clash = upsertToolKitIssue(first, { id: 'KIT-2', tool: 'fusion SPLICER', issuedTo: 'Ali', issueDate: '2026-11-02' });
  assert.equal(clash.length, 1);
  const returned = returnToolKitIssue(first, 'KIT-1', '2026-11-03');
  const again = upsertToolKitIssue(returned, { id: 'KIT-2', tool: 'Fusion splicer', issuedTo: 'Ali', issueDate: '2026-11-04' });
  assert.equal(again.length, 2);
});

test('upsert with a return date already set is allowed and does not clash', () => {
  const rows = upsertToolKitIssue([], { ...base, returnDate: '2026-11-02' });
  assert.equal(rows.length, 1);
  const next = upsertToolKitIssue(rows, { id: 'KIT-2', tool: 'Fusion splicer', issuedTo: 'Ali', issueDate: '2026-11-03' });
  assert.equal(next.length, 2);
});

test('returning clears the record from outstanding; bad returns refused', () => {
  const rows = upsertToolKitIssue([], base);
  const returned = returnToolKitIssue(rows, 'KIT-1', '2026-11-04');
  assert.equal(returned[0].returnDate, '2026-11-04');
  assert.equal(outstandingToolKitList(returned, '2026-11-10').length, 0);
  assert.deepEqual(returnToolKitIssue(returned, 'KIT-1', '2026-11-05'), returned);
  assert.deepEqual(returnToolKitIssue(rows, 'KIT-1', '2026-10-31'), rows);
  assert.deepEqual(returnToolKitIssue(rows, 'KIT-1', '2026-02-30'), rows);
  assert.deepEqual(returnToolKitIssue(rows, 'KIT-9', '2026-11-04'), rows);
  assert.deepEqual(returnToolKitIssue(rows, 'KIT-1', ''), rows);
});

test('find and remove', () => {
  const rows = upsertToolKitIssue([], base);
  assert.equal(findToolKitRecord(rows, 'KIT-1').tool, 'Fusion splicer');
  assert.equal(findToolKitRecord(rows, 'KIT-9'), null);
  assert.equal(findToolKitRecord(rows, ''), null);
  assert.deepEqual(removeToolKitIssue(rows, 'KIT-1'), []);
  assert.deepEqual(removeToolKitIssue(rows, ''), rows);
});

test('age days: whole days, never negative, null on bad dates', () => {
  assert.equal(toolKitAgeDays('2026-11-01', '2026-11-04'), 3);
  assert.equal(toolKitAgeDays('2026-11-01', '2026-11-01'), 0);
  assert.equal(toolKitAgeDays('2026-11-04', '2026-11-01'), 0);
  assert.equal(toolKitAgeDays('2026-02-30', '2026-11-04'), null);
  assert.equal(toolKitAgeDays('2026-11-01', 'bad'), null);
});

test('outstanding list: holder A-Z, then age descending, then id A-Z', () => {
  const rows = [
    { id: 'K1', tool: 'Ladder', issuedTo: 'Saad', issueDate: '2026-11-02' },
    { id: 'K2', tool: 'OTDR', issuedTo: 'Ali', issueDate: '2026-11-01' },
    { id: 'K3', tool: 'VFL', issuedTo: 'Saad', issueDate: '2026-10-20' },
    { id: 'K4', tool: 'Cleaver', issuedTo: 'Saad', issueDate: '2026-11-03', returnDate: '2026-11-04' },
  ];
  const out = outstandingToolKitList(rows, '2026-11-10');
  assert.deepEqual(out.map((row) => row.id), ['K2', 'K3', 'K1']);
});

test('outstanding list: holder filter and invalid reference date', () => {
  const rows = [
    { id: 'K1', tool: 'Ladder', issuedTo: 'Saad', issueDate: '2026-11-02' },
    { id: 'K2', tool: 'OTDR', issuedTo: 'Ali', issueDate: '2026-11-01' },
  ];
  assert.deepEqual(outstandingToolKitList(rows, '2026-11-10', 'saad').map((row) => row.id), ['K1']);
  assert.deepEqual(outstandingToolKitList(rows, 'bad'), []);
  assert.deepEqual(outstandingToolKitList(rows, ''), []);
});

test('inputs never mutated', () => {
  const input = [{ ...base }];
  const snapshot = JSON.stringify(input);
  upsertToolKitIssue(input, { id: 'K2', tool: 'OTDR', issuedTo: 'Ali', issueDate: '2026-11-02' });
  returnToolKitIssue(input, 'KIT-1', '2026-11-04');
  removeToolKitIssue(input, 'KIT-1');
  outstandingToolKitList(input, '2026-11-10');
  assert.equal(JSON.stringify(input), snapshot);
});

test('summary text', () => {
  assert.equal(toolKitSummaryText([]), 'No tool kit issue record yet.');
  const rows = [
    { ...base },
    { id: 'K2', tool: 'OTDR', issuedTo: 'Saad', issueDate: '2026-11-02', returnDate: '2026-11-03' },
    { id: 'K3', tool: 'Ladder', issuedTo: 'Ali', issueDate: '2026-11-02' },
  ];
  assert.equal(toolKitSummaryText(rows), '3 issue records across 2 holders; 2 still outstanding.');
  assert.equal(toolKitSummaryText([base]), '1 issue record across 1 holder; 1 still outstanding.');
});

test('outstanding HTML: rows with age, empty and missing-date messages', () => {
  const html = toolKitOutstandingHtml([base], '2026-11-04');
  assert.match(html, /Fusion splicer/);
  assert.match(html, /Saad/);
  assert.match(html, /3 days/);
  assert.equal(toolKitOutstandingHtml([], '2026-11-04'), '<p>No outstanding tools.</p>');
  assert.equal(
    toolKitOutstandingHtml([base], 'bad'),
    '<p>Give a valid reference date to list outstanding tools.</p>',
  );
});

test('HTML escaping in outstanding list', () => {
  const rows = [{ id: 'K1', tool: '<script>alert(1)</script>', issuedTo: 'Saad & Ali', issueDate: '2026-11-01', note: '"quoted"' }];
  const html = toolKitOutstandingHtml(rows, '2026-11-04');
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Saad &amp; Ali/);
});

test('CSV and filename', () => {
  const rows = [{ ...base, note: 'with, comma' }];
  const csv = toolKitCsv(rows);
  assert.match(csv, /^id,tool,issuedTo,issueDate,returnDate,note\n/);
  assert.match(csv, /"with, comma"/);
  assert.equal(toolKitFilename(), 'tool-kit-log.csv');
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'tool-kit-log.js'), 'utf8');
  assert.doesNotMatch(src, /^import /m);
  assert.doesNotMatch(src, /localStorage|fetch\(|Date\.now\(\)/);
});

test('panel element ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = [
    'toolKitTool', 'toolKitHolder', 'toolKitIssueDate', 'toolKitNote', 'toolKitSaveBtn',
    'toolKitReturnId', 'toolKitReturnDate', 'toolKitReturnBtn',
    'toolKitRemoveId', 'toolKitRemoveBtn', 'toolKitExportBtn',
    'toolKitRefDate', 'toolKitHolderFilter', 'toolKitBody', 'toolKitSummary',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
});
