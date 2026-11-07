// Plan 464 — No-result help with nearest names: a search with no
// match offers the closest names (by spelling closeness) plus plain
// advice, and tapping one opens that customer — instead of the
// search simply dying on "nothing found".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NO_RESULT_HELP_MIN_SIMILARITY,
  NO_RESULT_HELP_MAX_SUGGESTIONS,
  NO_RESULT_HELP_ADVICE,
  noResultSpellingDistance,
  nearestCustomerNames,
  noResultHelpPanelHtml,
} from '../no-result-help.js';
import {
  searchFastCustomers,
  renderFastCustomerSearchResultsHtml,
} from '../nav-customer-search.js';

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data.
function candidates() {
  return [
    { id: 'seed-464-01', name: 'Faisal Ahmed', customerNumber: 301, phone: '03012345678' },
    { id: 'seed-464-02', name: 'Ahmad Raza', customerNumber: 302, phone: '03012345679' },
    { id: 'seed-464-03', name: 'Waseem Khan', customerNumber: 303, phone: '03012345670' },
    { id: 'seed-464-04', name: 'Bilal Hussain', customerNumber: 304, phone: '03012345671' },
    { id: 'seed-464-05', name: 'Raza Ali', customerNumber: 305, phone: '03012345672' },
    // Archived on purpose: close in spelling, never suggested.
    { id: 'seed-464-06', name: 'Faisal Archived', customerNumber: 306, phone: '03012345673', archived: true },
    // Known by his father's name and by a landmark alias.
    { id: 'seed-464-07', name: 'Haji Sahab', customerNumber: 307, phone: '03012345674', fatherOrReferenceName: 'Muhammad Aslam', searchAliases: ['Corner Store'] },
    { id: 'seed-464-08', name: 'احمد رضا', customerNumber: 308, phone: '03012345675', nameUrdu: 'احمد رضا' },
    { id: 'seed-464-09', name: 'Ali Raza', customerNumber: 309, phone: '03012345676' },
    { id: 'seed-464-10', name: 'Ali Raza', customerNumber: 310, phone: '03012345677' },
  ];
}

function sheetState() {
  return {
    customers: candidates().map((customer) => ({ ...customer, area: 'Unassigned', bills: [] })),
  };
}

test('spelling distance: a swapped pair of letters costs one, not two', () => {
  assert.equal(noResultSpellingDistance('fiasal', 'faisal'), 1);
  assert.equal(noResultSpellingDistance('faisal', 'faisal'), 0);
  assert.equal(noResultSpellingDistance('faisal', 'fasil'), 2);
  assert.equal(noResultSpellingDistance('kitten', 'sitting'), 3);
  assert.equal(noResultSpellingDistance('', 'abc'), 3);
  assert.equal(noResultSpellingDistance('', ''), 0);
  assert.equal(noResultSpellingDistance(null, 'abc'), 3);
});

test('a mistyped name suggests its customer, closest first', () => {
  const list = candidates();
  // "Fasil" is one fold away from "Faisal" on the phonetic key,
  // and the archived look-alike never appears.
  const fasil = nearestCustomerNames(list, 'Fasil');
  assert.equal(fasil[0].id, 'seed-464-01');
  assert.equal(fasil[0].name, 'Faisal Ahmed');
  assert.equal(fasil[0].customerNumber, 301);
  assert.equal(fasil.some((s) => s.id === 'seed-464-06'), false);

  // "Ahmad" is the first name of #302 and the surname of #301 —
  // the exact token wins, the one-letter-off token follows.
  const ahmad = nearestCustomerNames(list, 'Ahmad');
  assert.equal(ahmad[0].id, 'seed-464-02');
  assert.equal(ahmad[1].id, 'seed-464-01');

  // A mistyped surname still finds its customer through the
  // first name, and a transposed pair still finds its customer.
  assert.equal(nearestCustomerNames(list, 'Waseen')[0].id, 'seed-464-03');
  // "Rzaa" is one swap away from "Raza" in #302, #305, #309, and
  // #310 — the tie breaks in name order, so "Ahmad Raza" comes
  // first, then the two "Ali Raza" rows; the cap of three leaves
  // "Raza Ali" out.
  const rzaa = nearestCustomerNames(list, 'Rzaa');
  assert.equal(rzaa[0].id, 'seed-464-02');
  assert.equal(rzaa[1].id, 'seed-464-09');
  assert.equal(rzaa[2].id, 'seed-464-10');
});

test('a genuinely different name suggests nobody', () => {
  assert.deepEqual(nearestCustomerNames(candidates(), 'Zebrax'), []);
  assert.deepEqual(nearestCustomerNames(candidates(), 'Qwerty'), []);
});

test('at most three suggestions, ties in name order then customer number', () => {
  const list = candidates();
  // Only two names are close enough to "Ahmed" — the surname of
  // #301 and one letter off the first name of #302.
  const ahmed = nearestCustomerNames(list, 'Ahmed');
  assert.equal(ahmed.length, 2);
  assert.equal(ahmed[0].id, 'seed-464-01');
  assert.equal(ahmed[1].id, 'seed-464-02');
  assert.equal(nearestCustomerNames(list, 'Ahmed', 1).length, 1);

  // "Ali" is an exact token in three names, so the cap of three
  // binds — and the tie breaks in name order, then number.
  const ali = nearestCustomerNames(list, 'Ali');
  assert.equal(ali.length, 3);
  assert.equal(ali[0].customerNumber, 309);
  assert.equal(ali[1].customerNumber, 310);
  assert.equal(ali[2].id, 'seed-464-05');

  // "Al Raza" matches the "Raza" token exactly in #302, #309,
  // and #310 — all three score the same, so the tie breaks in
  // name order, then customer number.
  const alRaza = nearestCustomerNames(list, 'Al Raza');
  assert.equal(alRaza[0].customerNumber, 302);
  assert.equal(alRaza[1].customerNumber, 309);
  assert.equal(alRaza[2].customerNumber, 310);
});

test('a name close to the father name or an alias suggests that customer', () => {
  const list = candidates();
  assert.equal(nearestCustomerNames(list, 'Aslm')[0].id, 'seed-464-07');
  assert.equal(nearestCustomerNames(list, 'Cornr')[0].id, 'seed-464-07');
});

test('an Urdu name close in spelling suggests its customer', () => {
  const list = candidates();
  const found = nearestCustomerNames(list, 'احمر');
  assert.equal(found[0].id, 'seed-464-08');
});

test('a too-short or blank query never suggests a name, and the input is never mutated', () => {
  const list = candidates();
  const before = JSON.parse(JSON.stringify(list));
  assert.deepEqual(nearestCustomerNames(list, 'A'), []);
  assert.deepEqual(nearestCustomerNames(list, ''), []);
  assert.deepEqual(nearestCustomerNames(list, '   '), []);
  assert.deepEqual(nearestCustomerNames(list, null), []);
  assert.deepEqual(nearestCustomerNames(null, 'Fasil'), []);
  assert.deepEqual(nearestCustomerNames('not a list', 'Fasil'), []);
  assert.deepEqual(list, before);
});

test('the panel offers the nearest names as tappable chips, then the advice', () => {
  const html = noResultHelpPanelHtml([
    { id: 'seed-464-01', customerNumber: 301, name: 'Faisal Ahmed' },
    { id: 'seed-464-02', customerNumber: 302, name: 'Ahmad Raza' },
  ]);
  assert.ok(html.includes('Did you mean:'), 'the panel asks plainly');
  assert.ok(html.includes('#301 Faisal Ahmed'), 'the first suggestion reads with its number');
  assert.ok(html.includes('#302 Ahmad Raza'), 'the second suggestion reads too');
  assert.ok(html.includes('data-fcs-action="profile"'), 'a chip opens the profile, like a result row');
  assert.ok(html.includes('data-customer-id="seed-464-01"'), 'a chip carries the customer id');
  assert.ok(html.includes(NO_RESULT_HELP_ADVICE), 'the advice rides with the names');
  assert.ok(html.includes('class="fcs-filter-row"'), 'the chips reuse the sheet filter-row styling');
});

test('with nothing close the panel says so plainly and still shows the advice', () => {
  const html = noResultHelpPanelHtml([]);
  assert.ok(html.includes('No close matches.'), 'nothing close reads plainly');
  assert.ok(html.includes(NO_RESULT_HELP_ADVICE), 'the advice still shows');
  assert.equal(html.includes('Did you mean:'), false);
  assert.equal(noResultHelpPanelHtml(null), '');
  assert.equal(noResultHelpPanelHtml(undefined), '');
});

test('the panel escapes markup in a name', () => {
  const html = noResultHelpPanelHtml([
    { id: 'seed-464-01', customerNumber: 301, name: '<b>Faisal</b>' },
  ]);
  assert.ok(html.includes('&lt;b&gt;Faisal&lt;/b&gt;'), 'a name is escaped, never raw HTML');
  assert.equal(html.includes('<b>Faisal</b>'), false);
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../no-result-help.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // The clock check is `new Date(` / `Date.now` — a bare `Date(`
  // also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

test('wiring: a mistyped search finds nobody, and the empty state offers the nearest name', () => {
  const state = sheetState();
  // The search itself finds nobody for the typo — that is the
  // panel's whole reason to exist.
  assert.deepEqual(searchFastCustomers(state, { query: 'Fasil' }), []);
  assert.deepEqual(searchFastCustomers(state, { query: 'Zebrax' }), []);

  const nearest = nearestCustomerNames(
    state.customers.filter((c) => !c.archived),
    'Fasil'
  );
  const html = renderFastCustomerSearchResultsHtml([], { nearestNames: nearest });
  assert.ok(html.includes('No matching customers found'), 'the empty heading stands');
  assert.ok(html.includes('Did you mean:'), 'the panel shows');
  assert.ok(html.includes('#301 Faisal Ahmed'), 'the nearest name is offered');
  assert.ok(html.includes('data-fcs-action="profile"'), 'tapping it opens that customer');
  assert.ok(html.includes(NO_RESULT_HELP_ADVICE), 'the advice shows');

  const nothingClose = renderFastCustomerSearchResultsHtml([], { nearestNames: [] });
  assert.ok(nothingClose.includes('No close matches.'), 'nothing close reads plainly');
  assert.ok(nothingClose.includes(NO_RESULT_HELP_ADVICE), 'the advice still shows');
});

test('wiring: without nearest names the empty state keeps its old text', () => {
  const generic = renderFastCustomerSearchResultsHtml([]);
  assert.ok(generic.includes('Try searching with a shorter name, phone digits, or area.'), 'the generic hint stands');
  assert.equal(generic.includes('Did you mean:'), false);
  assert.equal(generic.includes(NO_RESULT_HELP_ADVICE), false);

  // An unknown ID keeps its own plain message, never the panel.
  const idText = 'No customer with ID #999 found. Check the ID and try again.';
  const idHtml = renderFastCustomerSearchResultsHtml([], { emptyText: idText });
  assert.ok(idHtml.includes(idText), 'the ID message stands');
  assert.equal(idHtml.includes('Did you mean:'), false);

  // A search with results never shows the panel.
  const rows = searchFastCustomers(sheetState(), { query: 'Faisal' });
  assert.ok(rows.length > 0);
  const withResults = renderFastCustomerSearchResultsHtml(rows);
  assert.equal(withResults.includes('Did you mean:'), false);
  assert.equal(withResults.includes(NO_RESULT_HELP_ADVICE), false);
});

test('wiring: the sheet imports the module and computes the panel; the list is untouched', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './no-result-help.js'"), 'the sheet imports the no-result module');
  assert.ok(sheet.includes('nearestCustomerNames('), 'the sheet computes the nearest names');
  assert.ok(sheet.includes('mohallaNameMatches(c, mohallaValue)'), 'the candidates are the customers the search could have shown');
  assert.ok(sheet.includes('noResultHelpPanelHtml(nearestNames)'), 'the empty state renders the panel');
  // Plan 464 wires the fast customer search sheet only — the
  // Customers list is a different surface and is untouched.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('no-result-help'), false, 'the list does not import the no-result module');
  assert.equal(NO_RESULT_HELP_MIN_SIMILARITY, 0.6, 'the closeness bar is pinned');
  assert.equal(NO_RESULT_HELP_MAX_SUGGESTIONS, 3, 'at most three names are offered');
});
