// Plan 427 — Quick Collect customer lookup by name prefix as you type:
// two letters are enough to find the customer at a busy counter.
// The lookup lists every customer whose name starts with the typed
// letters, in name order, with name and mohalla; clearing the field
// clears the list. It looks up only and changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NAME_PREFIX_LOOKUP_MIN_LETTERS,
  NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT,
  namePrefixLookupMohalla,
  namePrefixLookupMatches,
  namePrefixLookupLineText,
  namePrefixLookupHtml,
} from '../name-prefix-lookup.js';

function customers() {
  return [
    { id: 'CUST-5', name: 'Rani Two', customerNumber: 5, mohalla: 'Mohalla Bani' },
    { id: 'CUST-2', name: 'Raja One', customerNumber: 2, mohalla: 'Mohalla Bani' },
    { id: 'CUST-4', name: 'Kiran Three', customerNumber: 4, mohalla: 'Mohalla Dhok' },
    { id: 'CUST-1', name: 'raja Four', customerNumber: 1, mohalla: 'Mohalla Bani' },
    { id: 'CUST-3', name: 'Raja Three', customerNumber: 3, area: 'Mohalla Old' },
    { id: 'CUST-6', name: 'Sara Five', customerNumber: 6 },
  ];
}

test('fewer than two letters is not a lookup at all', () => {
  assert.equal(NAME_PREFIX_LOOKUP_MIN_LETTERS, 2);
  assert.deepEqual(namePrefixLookupMatches(customers(), ''), []);
  assert.deepEqual(namePrefixLookupMatches(customers(), 'r'), []);
  assert.deepEqual(namePrefixLookupMatches(customers(), '   '), []);
  assert.deepEqual(namePrefixLookupMatches(customers(), null), []);
  assert.deepEqual(namePrefixLookupMatches(customers(), undefined), []);
});

test('two letters list every matching customer', () => {
  const matches = namePrefixLookupMatches(customers(), 'ra');
  assert.deepEqual(matches.map((m) => m.id), ['CUST-1', 'CUST-2', 'CUST-3', 'CUST-5']);
});

test('the lookup matches a name prefix, never a substring', () => {
  // 'Kiran' contains 'an' but does not start with it, so it is not a match.
  assert.deepEqual(namePrefixLookupMatches(customers(), 'an'), []);
  // 'Kiran' does start with 'ki'.
  assert.deepEqual(namePrefixLookupMatches(customers(), 'ki').map((m) => m.id), ['CUST-4']);
  // 'Sara' starts with 'sa', not 'ar'.
  assert.deepEqual(namePrefixLookupMatches(customers(), 'ar'), []);
  assert.deepEqual(namePrefixLookupMatches(customers(), 'sa').map((m) => m.id), ['CUST-6']);
});

test('matching is case-insensitive and trims the typed prefix', () => {
  assert.deepEqual(
    namePrefixLookupMatches(customers(), 'RA').map((m) => m.id),
    ['CUST-1', 'CUST-2', 'CUST-3', 'CUST-5'],
  );
  assert.deepEqual(
    namePrefixLookupMatches(customers(), '  Ra  ').map((m) => m.id),
    ['CUST-1', 'CUST-2', 'CUST-3', 'CUST-5'],
  );
});

test('matches are in name order, same name twice by customer number', () => {
  const list = [
    { id: 'CUST-9', name: 'Raja Nine', customerNumber: 9, mohalla: 'Mohalla Bani' },
    { id: 'CUST-7', name: 'Rani Seven', customerNumber: 7, mohalla: 'Mohalla Bani' },
    { id: 'CUST-8', name: 'Raja Nine', customerNumber: 8, mohalla: 'Mohalla Bani' },
  ];
  assert.deepEqual(
    namePrefixLookupMatches(list, 'ra').map((m) => m.id),
    ['CUST-8', 'CUST-9', 'CUST-7'],
  );
});

test('archived customers never appear', () => {
  const list = customers();
  list.push({ id: 'CUST-7', name: 'Raja Archived', customerNumber: 7, mohalla: 'Mohalla Bani', archived: true });
  assert.deepEqual(
    namePrefixLookupMatches(list, 'ra').map((m) => m.id),
    ['CUST-1', 'CUST-2', 'CUST-3', 'CUST-5'],
  );
});

test('entries without a usable id or name are skipped, never guessed', () => {
  const list = [
    { id: '', name: 'Raja NoId', customerNumber: 1 },
    { name: 'Raja NoIdField', customerNumber: 2 },
    { id: 'CUST-3', name: '   ', customerNumber: 3 },
    { id: 'CUST-4', name: null, customerNumber: 4 },
    { id: 'CUST-5', name: 'Raja Kept', customerNumber: 5 },
  ];
  assert.deepEqual(namePrefixLookupMatches(list, 'ra').map((m) => m.id), ['CUST-5']);
});

test('a non-array customer list matches nothing', () => {
  assert.deepEqual(namePrefixLookupMatches(null, 'ra'), []);
  assert.deepEqual(namePrefixLookupMatches(undefined, 'ra'), []);
  assert.deepEqual(namePrefixLookupMatches('ra', 'ra'), []);
});

test('the lookup never mutates the input list', () => {
  const list = customers();
  const before = JSON.stringify(list);
  const matches = namePrefixLookupMatches(list, 'ra');
  assert.equal(JSON.stringify(list), before);
  assert.notEqual(matches[0], list.find((c) => c.id === matches[0].id));
  matches[0].name = 'Changed';
  assert.equal(JSON.stringify(list), before);
});

test('the lookup is not a dues filter: customers with no dues still appear', () => {
  const list = [
    { id: 'CUST-1', name: 'Raja NoDues', customerNumber: 1, mohalla: 'Mohalla Bani' },
  ];
  assert.deepEqual(namePrefixLookupMatches(list, 'ra').map((m) => m.id), ['CUST-1']);
});

test('mohalla comes from mohalla first, then area, then the placeholder', () => {
  assert.equal(namePrefixLookupMohalla({ mohalla: 'Mohalla Bani', area: 'Mohalla Old' }), 'Mohalla Bani');
  assert.equal(namePrefixLookupMohalla({ area: 'Mohalla Old' }), 'Mohalla Old');
  assert.equal(namePrefixLookupMohalla({}), NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT);
  assert.equal(namePrefixLookupMohalla({ mohalla: '   ', area: '  ' }), NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT);
  assert.equal(namePrefixLookupMohalla(null), NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT);
});

test('matches carry the mohalla on each entry', () => {
  const matches = namePrefixLookupMatches(customers(), 'ra');
  assert.deepEqual(
    matches.map((m) => [m.id, m.mohalla]),
    [
      ['CUST-1', 'Mohalla Bani'],
      ['CUST-2', 'Mohalla Bani'],
      ['CUST-3', 'Mohalla Old'],
      ['CUST-5', 'Mohalla Bani'],
    ],
  );
  const sara = namePrefixLookupMatches(customers(), 'sa');
  assert.equal(sara[0].mohalla, NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT);
});

test('the line text is name, then mohalla', () => {
  assert.equal(
    namePrefixLookupLineText({ name: 'Raja One', mohalla: 'Mohalla Bani' }),
    'Raja One — Mohalla Bani',
  );
  assert.equal(
    namePrefixLookupLineText({ name: 'Sara Five', mohalla: '' }),
    `Sara Five — ${NAME_PREFIX_LOOKUP_UNASSIGNED_TEXT}`,
  );
});

test('the list markup has one row per match with name and mohalla', () => {
  const html = namePrefixLookupHtml(namePrefixLookupMatches(customers(), 'ra'));
  assert.match(html, /data-customer-id="CUST-1"/);
  assert.match(html, /data-customer-id="CUST-2"/);
  assert.match(html, /data-customer-id="CUST-3"/);
  assert.match(html, /data-customer-id="CUST-5"/);
  assert.match(html, /Raja One/);
  assert.match(html, /Mohalla Bani/);
  assert.match(html, /Mohalla Old/);
  assert.equal((html.match(/npl-row/g) || []).length, 4);
});

test('the list markup escapes user text', () => {
  const list = [
    { id: 'CUST-1', name: 'Ali <b>Bold</b>', customerNumber: 1, mohalla: 'Mohalla <i>X</i>' },
  ];
  const html = namePrefixLookupHtml(namePrefixLookupMatches(list, 'al'));
  assert.match(html, /Ali &lt;b&gt;Bold&lt;\/b&gt;/);
  assert.match(html, /Mohalla &lt;i&gt;X&lt;\/i&gt;/);
  assert.doesNotMatch(html, /<b>Bold<\/b>/);
  assert.doesNotMatch(html, /<i>X<\/i>/);
});

test('the list markup carries a pick label per row', () => {
  const html = namePrefixLookupHtml(namePrefixLookupMatches(customers(), 'sa'));
  assert.match(html, /aria-label="Pick Sara Five — Unassigned"/);
});

test('no matches renders nothing at all', () => {
  assert.equal(namePrefixLookupHtml([]), '');
  assert.equal(namePrefixLookupHtml(null), '');
  assert.equal(namePrefixLookupHtml(undefined), '');
  assert.equal(namePrefixLookupHtml(namePrefixLookupMatches(customers(), 'zz')), '');
});

test('a prefix with doubled spaces still matches the name', () => {
  const list = [
    { id: 'CUST-1', name: 'Raja  Shunaid', customerNumber: 1, mohalla: 'Mohalla Bani' },
  ];
  assert.deepEqual(namePrefixLookupMatches(list, 'raja  sh').map((m) => m.id), ['CUST-1']);
  assert.deepEqual(namePrefixLookupMatches(list, 'raja sh').map((m) => m.id), ['CUST-1']);
});

// The module is pure: no document, no store, no clock, no network.
test('the module is pure and keeps no store', () => {
  const source = readFileSync(new URL('../name-prefix-lookup.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /window\./);
  assert.doesNotMatch(source, /shahdara_/);
  assert.doesNotMatch(source, /^import /m);
});

// The module header never names a fenced module's filename literally
// (each name below is built from fragments so the test itself does
// not carry the literal either).
test('the module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../name-prefix-lookup.js', import.meta.url), 'utf8');
  const fenced = [
    ['nav', '-', 'quick', '-', 'collect', '.', 'js'].join(''),
    ['quick', '-', 'collect', '-', 'one', '-', 'screen', '.', 'js'].join(''),
    ['partial', '-', 'phone', '-', 'search', '.', 'js'].join(''),
    ['mohalla', '-', 'name', '-', 'filter', '.', 'js'].join(''),
    ['full', '-', 'history', '-', 'list', '.', 'js'].join(''),
    ['transaction', '-', 'prefill', '.', 'js'].join(''),
  ];
  for (const name of fenced) {
    assert.doesNotMatch(source, new RegExp(name.replace('.', '\\.')));
  }
});

// Wiring: the lookup lives on the Quick Collect pick step, driven by
// the same search field, and picking a row opens the payment form
// exactly the way a picker card does.
test('wiring: the controller imports the lookup module', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /name-prefix-lookup\.js/);
  assert.match(wiring, /namePrefixLookupMatches/);
  assert.match(wiring, /namePrefixLookupHtml/);
});

test('wiring: the pick step renders the lookup list on every list render', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /nplNamePrefixList/);
  assert.match(wiring, /renderNamePrefixList/);
  const start = wiring.indexOf('function renderList()');
  assert.notEqual(start, -1);
  // QC-4 lengthened renderList with the mohalla-counts refresh, so
  // the window is 1200 — the intent is unchanged: the lookup list
  // still renders on every list render.
  const block = wiring.slice(start, start + 1200);
  assert.match(block, /renderNamePrefixList\(\)/);
});

test('wiring: tapping a lookup row opens the customer payment form', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf("namePrefixList?.addEventListener('click'");
  assert.notEqual(start, -1);
  const block = wiring.slice(start, start + 800);
  assert.match(block, /npl-row/);
  assert.match(block, /openCustomerCollectionForm\(/);
});

test('wiring: the lookup host sits on the pick step, after the search box', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pickStep = page.indexOf('id="quickCollectStepPick"');
  const host = page.indexOf('id="nplNamePrefixList"');
  const list = page.indexOf('id="quickCollectCustomerList"');
  assert.notEqual(pickStep, -1);
  assert.notEqual(host, -1);
  assert.notEqual(list, -1);
  assert.ok(pickStep < host && host < list);
});

test('the npl element-id prefix is used by this plan only', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((page.match(/id="npl/g) || []).length, 1);
});
