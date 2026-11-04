import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validSuggestionDate,
  SUGGESTION_CATEGORIES,
  SUGGESTION_CATEGORY_LABELS,
  SUGGESTION_STATUSES,
  SUGGESTION_STATUS_LABELS,
  OPEN_SUGGESTION_STATUSES,
  suggestionCategoryLabel,
  suggestionStatusLabel,
  canonicalSuggestionMohalla,
  normalizeSuggestion,
  normalizeSuggestionList,
  upsertSuggestion,
  removeSuggestion,
  findSuggestion,
  openSuggestions,
  filterSuggestions,
  moveSuggestion,
  suggestionSummaryText,
  suggestionHtml,
  suggestionCsv,
  suggestionFilename,
} from '../suggestion-log.js';

const suggestion = (overrides = {}) => ({
  id: 'SG-1',
  customer: 'C-1',
  customerName: 'Ahmed',
  mohalla: 'Bani',
  text: 'A cheaper evening package for students.',
  category: 'package',
  date: '2026-11-01',
  status: 'noted',
  ...overrides,
});

test('strict dates: real dates pass, impossible and malformed dates fail', () => {
  assert.equal(validSuggestionDate('2026-11-01'), '2026-11-01');
  assert.equal(validSuggestionDate('2024-02-29'), '2024-02-29');
  assert.equal(validSuggestionDate('2026-02-30'), null);
  assert.equal(validSuggestionDate('2026-13-01'), null);
  assert.equal(validSuggestionDate('01-11-2026'), null);
  assert.equal(validSuggestionDate(''), null);
  assert.equal(validSuggestionDate(null), null);
});

test('catalogues: five categories and four statuses with plain labels', () => {
  assert.deepEqual([...SUGGESTION_CATEGORIES], ['package', 'payment', 'service-hours', 'coverage', 'other']);
  assert.deepEqual([...SUGGESTION_STATUSES], ['noted', 'under-consideration', 'adopted', 'declined']);
  assert.deepEqual([...OPEN_SUGGESTION_STATUSES], ['noted', 'under-consideration']);
  assert.equal(suggestionCategoryLabel('service-hours'), 'Service hours');
  assert.equal(suggestionStatusLabel('under-consideration'), 'Under consideration');
  assert.equal(suggestionCategoryLabel('bogus'), 'Not recorded');
  assert.equal(suggestionStatusLabel('bogus'), 'Not recorded');
  assert.equal(Object.keys(SUGGESTION_CATEGORY_LABELS).length, 5);
  assert.equal(Object.keys(SUGGESTION_STATUS_LABELS).length, 4);
});

test('half-formed refusal: no id, no customer, blank text, unknown category/status, impossible date', () => {
  assert.equal(normalizeSuggestion(suggestion({ id: '' })), null);
  assert.equal(normalizeSuggestion(suggestion({ customer: '  ' })), null);
  assert.equal(normalizeSuggestion(suggestion({ text: '' })), null);
  assert.equal(normalizeSuggestion(suggestion({ category: 'fault' })), null);
  assert.equal(normalizeSuggestion(suggestion({ status: 'open' })), null);
  assert.equal(normalizeSuggestion(suggestion({ date: '2026-02-30' })), null);
  assert.equal(normalizeSuggestion(null), null);
  assert.equal(normalizeSuggestion('nope'), null);
});

test('adopted needs a note, declined needs a reason — otherwise refused outright', () => {
  assert.equal(normalizeSuggestion(suggestion({ status: 'adopted' })), null);
  assert.equal(normalizeSuggestion(suggestion({ status: 'adopted', adoptedNote: '  ' })), null);
  assert.equal(normalizeSuggestion(suggestion({ status: 'declined' })), null);
  assert.equal(normalizeSuggestion(suggestion({ status: 'declined', declineReason: '' })), null);
  const adopted = normalizeSuggestion(suggestion({ status: 'adopted', adoptedNote: 'New 5 Mbps package launched.', fulfilledLink: 'PKG-5' }));
  assert.equal(adopted.adoptedNote, 'New 5 Mbps package launched.');
  assert.equal(adopted.fulfilledLink, 'PKG-5');
  const declined = normalizeSuggestion(suggestion({ status: 'declined', declineReason: 'No spare ports on that splitter.' }));
  assert.equal(declined.declineReason, 'No spare ports on that splitter.');
});

test('outcome fields belong only to their status; unknown fields are dropped', () => {
  const noted = normalizeSuggestion(suggestion({ adoptedNote: 'stale', declineReason: 'stale', fulfilledLink: 'PKG-5', billId: 'B-1', ticketId: 'T-1' }));
  assert.equal(noted.adoptedNote, '');
  assert.equal(noted.declineReason, '');
  assert.equal(noted.fulfilledLink, '');
  assert.deepEqual(Object.keys(noted).sort(), ['adoptedNote', 'category', 'customer', 'customerName', 'date', 'declineReason', 'fulfilledLink', 'id', 'mohalla', 'status', 'text']);
});

test('undated suggestions are kept and sort last, never given an invented date', () => {
  const dated = normalizeSuggestion(suggestion({ id: 'SG-1', date: '2026-11-01' }));
  const undated = normalizeSuggestion(suggestion({ id: 'SG-2', date: '' }));
  assert.equal(undated.date, null);
  const open = openSuggestions([undated, dated]);
  assert.deepEqual(open.map((item) => item.id), ['SG-1', 'SG-2']);
});

test('upsert, find, and remove keep one record per id', () => {
  let list = upsertSuggestion([], suggestion());
  list = upsertSuggestion(list, suggestion({ text: 'Updated wording.' }));
  assert.equal(list.length, 1);
  assert.equal(findSuggestion(list, 'SG-1').text, 'Updated wording.');
  assert.equal(findSuggestion(list, 'SG-9'), null);
  list = upsertSuggestion(list, suggestion({ id: 'SG-2' }));
  assert.equal(list.length, 2);
  assert.equal(removeSuggestion(list, 'SG-1').length, 1);
  assert.equal(removeSuggestion(list, 'SG-9').length, 2);
});

test('half-formed upsert leaves the list unchanged', () => {
  const list = upsertSuggestion([], suggestion());
  assert.equal(upsertSuggestion(list, suggestion({ id: 'SG-2', text: '' })).length, 1);
  assert.equal(upsertSuggestion(list, suggestion({ id: 'SG-2', status: 'adopted' })).length, 1);
});

test('inputs are never mutated', () => {
  const input = suggestion();
  const snapshot = JSON.stringify(input);
  normalizeSuggestion(input);
  upsertSuggestion([input], suggestion({ id: 'SG-2' }));
  moveSuggestion([input], 'SG-1', 'under-consideration');
  assert.equal(JSON.stringify(input), snapshot);
});

test('open list: noted and under-consideration only, oldest first', () => {
  const list = [
    suggestion({ id: 'SG-3', date: '2026-11-03', status: 'adopted', adoptedNote: 'Done.' }),
    suggestion({ id: 'SG-1', date: '2026-11-01', status: 'noted' }),
    suggestion({ id: 'SG-4', date: '2026-11-04', status: 'declined', declineReason: 'No.' }),
    suggestion({ id: 'SG-2', date: '2026-11-02', status: 'under-consideration' }),
  ];
  assert.deepEqual(openSuggestions(list).map((item) => item.id), ['SG-1', 'SG-2']);
  // The full filtered list still carries decided suggestions as history.
  assert.deepEqual(filterSuggestions(list).map((item) => item.id), ['SG-1', 'SG-2', 'SG-3', 'SG-4']);
  assert.deepEqual(filterSuggestions(list, { status: 'adopted' }).map((item) => item.id), ['SG-3']);
});

test('open list filters by category and mohalla, with Plan T aliases and __unassigned__', () => {
  const list = [
    suggestion({ id: 'SG-1', category: 'package', mohalla: 'Mohalla Bani' }),
    suggestion({ id: 'SG-2', category: 'payment', mohalla: 'bani' }),
    suggestion({ id: 'SG-3', category: 'package', mohalla: 'Kishti' }),
    suggestion({ id: 'SG-4', category: 'package', mohalla: '' }),
  ];
  assert.deepEqual(openSuggestions(list, { category: 'package' }).map((item) => item.id), ['SG-1', 'SG-3', 'SG-4']);
  // "Bani" and "Mohalla Bani" collapse to the same canonical key.
  assert.deepEqual(openSuggestions(list, { mohalla: 'BANII' }).map((item) => item.id), ['SG-1', 'SG-2']);
  assert.deepEqual(openSuggestions(list, { mohalla: '__unassigned__' }).map((item) => item.id), ['SG-4']);
  assert.deepEqual(openSuggestions(list, { mohalla: 'kishti' }).map((item) => item.id), ['SG-3']);
});

test('canonical mohalla keys mirror the Plan T rule', () => {
  assert.equal(canonicalSuggestionMohalla('Mohalla Bani').key, 'banii');
  assert.equal(canonicalSuggestionMohalla('bani').key, 'banii');
  assert.equal(canonicalSuggestionMohalla('Kishti').key, 'kishtii');
  assert.equal(canonicalSuggestionMohalla('Chamyaa').key, 'chamyaaa');
  assert.equal(canonicalSuggestionMohalla(''), null);
  assert.equal(canonicalSuggestionMohalla('New Street').label, 'New Street');
});

test('move gates: adopted needs a note, declined needs a reason, anything less leaves it unmoved', () => {
  const list = [suggestion()];
  assert.equal(moveSuggestion(list, 'SG-1', 'adopted')[0].status, 'noted');
  assert.equal(moveSuggestion(list, 'SG-1', 'declined')[0].status, 'noted');
  assert.equal(moveSuggestion(list, 'SG-1', 'bogus')[0].status, 'noted');
  assert.equal(moveSuggestion(list, 'SG-9', 'adopted', { adoptedNote: 'Done.' }).length, 1);
  const adopted = moveSuggestion(list, 'SG-1', 'adopted', { adoptedNote: 'New package launched.', fulfilledLink: 'PKG-5' })[0];
  assert.equal(adopted.status, 'adopted');
  assert.equal(adopted.adoptedNote, 'New package launched.');
  assert.equal(adopted.fulfilledLink, 'PKG-5');
  const declined = moveSuggestion(list, 'SG-1', 'declined', { declineReason: 'Not feasible yet.' })[0];
  assert.equal(declined.declineReason, 'Not feasible yet.');
  assert.equal(declined.adoptedNote, '');
});

test('reopen clears the outcome fields and returns the suggestion to the open list', () => {
  const list = [suggestion({ status: 'adopted', adoptedNote: 'Done.', fulfilledLink: 'PKG-5' })];
  assert.deepEqual(openSuggestions(list), []);
  const reopened = moveSuggestion(list, 'SG-1', 'noted')[0];
  assert.equal(reopened.status, 'noted');
  assert.equal(reopened.adoptedNote, '');
  assert.equal(reopened.fulfilledLink, '');
  assert.equal(openSuggestions([reopened]).length, 1);
});

test('summary counts open, adopted, and declined separately', () => {
  const list = [
    suggestion({ id: 'SG-1', status: 'noted' }),
    suggestion({ id: 'SG-2', status: 'under-consideration' }),
    suggestion({ id: 'SG-3', status: 'adopted', adoptedNote: 'Done.' }),
    suggestion({ id: 'SG-4', status: 'declined', declineReason: 'No.' }),
  ];
  assert.equal(suggestionSummaryText(list), '4 suggestions logged · 2 open · 1 adopted · 1 declined');
  assert.equal(suggestionSummaryText([]), '0 suggestions logged · 0 open · 0 adopted · 0 declined');
});

test('HTML escaping, CSV quoting, and filename', () => {
  const tricky = suggestion({ text: 'A <b>bold</b> & "quoted" idea, with a comma.' });
  const html = suggestionHtml([tricky]);
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
  assert.ok(!html.includes('<b>bold</b>'));
  const csv = suggestionCsv([tricky]);
  assert.ok(csv.startsWith('id,customer,customerName,mohalla,text,category,date,status,adoptedNote,declineReason,fulfilledLink'));
  assert.ok(csv.includes('"A <b>bold</b> & ""quoted"" idea, with a comma."'));
  assert.equal(suggestionFilename('2026-11-04'), 'suggestion-log-2026-11-04.csv');
  assert.equal(suggestionFilename('2026-02-30'), 'suggestion-log-undated.csv');
  assert.equal(suggestionHtml([]), '<p class="chart-caption">No suggestions logged yet.</p>');
});

test('module purity fence: no bill, payment, ticket, or package field is named', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'suggestion-log.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('state.customers'));
  assert.ok(!source.includes('import '));
  for (const forbidden of ['billId', 'paymentId', 'ticketId', 'dueAmount', 'outstanding', 'packageSpeed']) {
    assert.ok(!source.includes(forbidden), `module must not name ${forbidden}`);
  }
});
