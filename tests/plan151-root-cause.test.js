import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cleanRootCauseCategory,
  normalizeRootCauseCode,
  normalizeRootCauseCodeList,
  findRootCauseCode,
  upsertRootCauseCode,
  removeRootCauseCode,
  normalizeRootCauseLink,
  normalizeRootCauseLinkList,
  upsertRootCauseLink,
  removeRootCauseLink,
  faultsForRootCauseCode,
  rootCauseCounts,
  rootCauseSummaryText,
  rootCauseCodeHtml,
  rootCauseCountHtml,
  rootCauseCsv,
  rootCauseFilename,
} from '../root-cause.js';

const dir = dirname(fileURLToPath(import.meta.url));

const code = (over = {}) => ({
  code: 'CUT',
  meaning: 'Fiber cut on the road span',
  category: 'cable',
  ...over,
});

const link = (over = {}) => ({
  id: 'L-1',
  ticketId: 'T-101',
  code: 'CUT',
  ...over,
});

test('category normalization: known categories kept, unknown becomes other', () => {
  assert.equal(cleanRootCauseCategory('cable'), 'cable');
  assert.equal(cleanRootCauseCategory('power'), 'power');
  assert.equal(cleanRootCauseCategory('equipment'), 'equipment');
  assert.equal(cleanRootCauseCategory('customer-side'), 'customer-side');
  assert.equal(cleanRootCauseCategory('other'), 'other');
  assert.equal(cleanRootCauseCategory('weather'), 'other');
  assert.equal(cleanRootCauseCategory(''), 'other');
  assert.equal(cleanRootCauseCategory(' Cable '), 'cable');
});

test('half-formed code refusal: no code or no meaning is refused', () => {
  assert.equal(normalizeRootCauseCode(code({ code: '' })), null);
  assert.equal(normalizeRootCauseCode(code({ code: '   ' })), null);
  assert.equal(normalizeRootCauseCode(code({ meaning: '' })), null);
  assert.equal(normalizeRootCauseCode(code({ meaning: '   ' })), null);
  assert.equal(normalizeRootCauseCode(null), null);
  assert.equal(normalizeRootCauseCode('CUT'), null);
});

test('code normalization: code uppercased, meaning trimmed, unknown fields dropped', () => {
  const clean = normalizeRootCauseCode(code({ code: ' cut ', meaning: '  Fiber cut  ', ticketId: 'T-1', billId: 'B-9' }));
  assert.deepEqual(clean, { code: 'CUT', meaning: 'Fiber cut', category: 'cable' });
});

test('duplicate code rules: identical re-save unchanged, different figures refused', () => {
  const one = upsertRootCauseCode([], code());
  assert.equal(one.length, 1);
  assert.deepEqual(upsertRootCauseCode(one, code()), one);
  assert.deepEqual(upsertRootCauseCode(one, code({ meaning: 'Something else' })), one);
  assert.deepEqual(upsertRootCauseCode(one, code({ category: 'power' })), one);
});

test('code lookup is case-insensitive', () => {
  const list = upsertRootCauseCode([], code());
  assert.equal(findRootCauseCode(list, 'cut').code, 'CUT');
  assert.equal(findRootCauseCode(list, 'CUT').code, 'CUT');
  assert.equal(findRootCauseCode(list, 'NOPE'), null);
  assert.equal(findRootCauseCode(list, ''), null);
});

test('catalogue normalization drops half-formed codes and duplicate codes (first wins)', () => {
  const list = normalizeRootCauseCodeList([code(), code({ meaning: 'Other meaning' }), code({ meaning: '' }), code({ code: 'PWR', meaning: 'No power', category: 'power' })]);
  assert.equal(list.length, 2);
  assert.equal(list[0].meaning, 'Fiber cut on the road span');
  assert.equal(list[1].code, 'PWR');
});

test('half-formed link refusal: no id, no ticket, or no code is refused', () => {
  assert.equal(normalizeRootCauseLink(link({ id: '' })), null);
  assert.equal(normalizeRootCauseLink(link({ ticketId: '' })), null);
  assert.equal(normalizeRootCauseLink(link({ code: '' })), null);
  assert.equal(normalizeRootCauseLink(null), null);
});

test('link normalization: code uppercased, unknown fields dropped', () => {
  const clean = normalizeRootCauseLink(link({ code: ' cut ', note: 'do not keep', billId: 'B-1' }));
  assert.deepEqual(clean, { id: 'L-1', ticketId: 'T-101', code: 'CUT' });
});

test('one link per ticket: identical re-link unchanged, different code refused', () => {
  const one = upsertRootCauseLink([], link());
  assert.equal(one.length, 1);
  assert.deepEqual(upsertRootCauseLink(one, link()), one);
  assert.deepEqual(upsertRootCauseLink(one, link({ id: 'L-2', code: 'PWR' })), one);
  const other = upsertRootCauseLink(one, link({ id: 'L-2', ticketId: 'T-102', code: 'PWR' }));
  assert.equal(other.length, 2);
});

test('remove link by id; unknown id leaves the list unchanged', () => {
  const list = upsertRootCauseLink(upsertRootCauseLink([], link()), link({ id: 'L-2', ticketId: 'T-102', code: 'PWR' }));
  assert.equal(removeRootCauseLink(list, 'L-1').length, 1);
  assert.deepEqual(removeRootCauseLink(list, 'NOPE'), list);
});

test('remove code drops its ticket links too', () => {
  const codes = upsertRootCauseCode(upsertRootCauseCode([], code()), code({ code: 'PWR', meaning: 'No power', category: 'power' }));
  const links = upsertRootCauseLink(upsertRootCauseLink([], link()), link({ id: 'L-2', ticketId: 'T-102', code: 'PWR' }));
  const next = removeRootCauseCode(codes, links, 'cut');
  assert.equal(next.codes.length, 1);
  assert.equal(next.codes[0].code, 'PWR');
  assert.equal(next.links.length, 1);
  assert.equal(next.links[0].code, 'PWR');
});

test('faults filter by code: ticket ids A-Z, unknown code returns none', () => {
  const codes = upsertRootCauseCode([], code());
  const links = upsertRootCauseLink(upsertRootCauseLink([], link({ ticketId: 'T-102' })), link({ id: 'L-2', ticketId: 'T-101' }));
  assert.deepEqual(faultsForRootCauseCode(links, codes, 'cut'), ['T-101', 'T-102']);
  assert.deepEqual(faultsForRootCauseCode(links, codes, 'NOPE'), []);
  assert.deepEqual(faultsForRootCauseCode(links, [], 'CUT'), []);
});

test('counts count only links to catalogue codes, most faults first then code A-Z', () => {
  const codes = normalizeRootCauseCodeList([
    code(),
    code({ code: 'PWR', meaning: 'No power', category: 'power' }),
    code({ code: 'ONT', meaning: 'ONU fault', category: 'equipment' }),
  ]);
  const links = normalizeRootCauseLinkList([
    link({ id: 'L-1', ticketId: 'T-1', code: 'CUT' }),
    link({ id: 'L-2', ticketId: 'T-2', code: 'CUT' }),
    link({ id: 'L-3', ticketId: 'T-3', code: 'PWR' }),
    link({ id: 'L-4', ticketId: 'T-4', code: 'GHOST' }),
  ]);
  const rows = rootCauseCounts(links, codes);
  assert.deepEqual(rows.map((row) => [row.code, row.count]), [['CUT', 2], ['PWR', 1], ['ONT', 0]]);
});

test('summary text: empty catalogue says so plainly, otherwise codes and linked faults', () => {
  assert.equal(rootCauseSummaryText([], []), 'No root-cause code recorded yet.');
  const codes = upsertRootCauseCode([], code());
  const links = upsertRootCauseLink([], link());
  assert.equal(rootCauseSummaryText(links, codes), '1 root-cause code in the catalogue; 1 fault linked to a code.');
});

test('code HTML lists every code with meaning and category; empty says so plainly', () => {
  assert.match(rootCauseCodeHtml([]), /No root-cause code/);
  const html = rootCauseCodeHtml([code(), code({ code: 'PWR', meaning: 'No power', category: 'power' })]);
  assert.match(html, /CUT/);
  assert.match(html, /Fiber cut on the road span/);
  assert.match(html, /PWR/);
});

test('count HTML shows counts most faults first', () => {
  const codes = normalizeRootCauseCodeList([code(), code({ code: 'PWR', meaning: 'No power', category: 'power' })]);
  const links = normalizeRootCauseLinkList([link(), link({ id: 'L-2', ticketId: 'T-2', code: 'CUT' })]);
  const html = rootCauseCountHtml(links, codes);
  assert.ok(html.indexOf('CUT') < html.indexOf('PWR'));
  assert.match(html, /<td>2<\/td>/);
});

test('HTML escaping: meaning with markup renders escaped, never raw', () => {
  const html = rootCauseCodeHtml([code({ meaning: '<script>alert(1)</script>' })]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('CSV and filename: header plus one row per code with its count', () => {
  const codes = upsertRootCauseCode([], code());
  const links = upsertRootCauseLink([], link());
  const csv = rootCauseCsv(links, codes);
  assert.ok(csv.startsWith('code,meaning,category,faultCount'));
  assert.match(csv, /CUT,Fiber cut on the road span,cable,1/);
  assert.equal(rootCauseFilename(), 'root-cause-codes.csv');
});

test('non-mutation: inputs are never mutated by upsert or remove', () => {
  const codes = [code()];
  const links = [link()];
  const beforeCodes = JSON.stringify(codes);
  const beforeLinks = JSON.stringify(links);
  upsertRootCauseCode(codes, code({ code: 'PWR', meaning: 'No power', category: 'power' }));
  upsertRootCauseLink(links, link({ id: 'L-2', ticketId: 'T-2', code: 'PWR' }));
  removeRootCauseCode(codes, links, 'CUT');
  assert.equal(JSON.stringify(codes), beforeCodes);
  assert.equal(JSON.stringify(links), beforeLinks);
});

test('purity fence: the module imports nothing and touches no storage, network, or other module', () => {
  const source = readFileSync(join(dir, '..', 'root-cause.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|fetch\(|from '\.\//);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'rootCauseCode', 'rootCauseMeaning', 'rootCauseCategory', 'rootCauseSaveBtn',
    'rootCauseTicketId', 'rootCauseLinkCode', 'rootCauseLinkBtn',
    'rootCauseRemoveId', 'rootCauseRemoveBtn', 'rootCauseExportBtn',
    'rootCauseBody', 'rootCauseCountBody', 'rootCauseSummary',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
