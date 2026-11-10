// Plan 441 — Quick Collect search by last four digits of phone:
// four typed digits are enough to find the customer at a busy
// counter. The lookup lists every customer whose number ends with
// the typed digits, in name order, with name and mohalla, or says
// plainly that none matches. It searches only and changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LAST_FOUR_DIGITS_COUNT,
  LAST_FOUR_DIGITS_UNASSIGNED_TEXT,
  lastFourDigitsOf,
  lastFourDigitsQuery,
  lastFourDigitsMohalla,
  lastFourDigitsMatches,
  findCustomersByLastFourDigits,
  lastFourDigitsLineText,
  lastFourDigitsSummaryText,
  lastFourDigitsHtml,
} from '../last-four-digits-search.js';

function customers() {
  return [
    { id: 'CUST-1', name: 'Raja One', customerNumber: 1, phone: '03012345678', mohalla: 'Mohalla Bani' },
    { id: 'CUST-2', name: 'Rani Two', customerNumber: 2, phone: '03123456789', mohalla: 'Mohalla Bani' },
    { id: 'CUST-3', name: 'Kiran Three', customerNumber: 3, phone: '+92 301 2345678', mohalla: 'Mohalla Dhok' },
    { id: 'CUST-4', name: 'Sara Four', customerNumber: 4, phone: '0301-2345678', area: 'Mohalla Old' },
    { id: 'CUST-5', name: 'Raja Five', customerNumber: 5, phone: '03012345670' },
    { id: 'CUST-6', name: 'Ali Six', customerNumber: 6, customerPhone: '03012345678', mohalla: 'Mohalla Bani' },
    { id: 'CUST-7', name: 'Bilal Seven', customerNumber: 7, mohalla: 'Mohalla Bani' },
  ];
}

test('exactly four digits is the lookup', () => {
  assert.equal(LAST_FOUR_DIGITS_COUNT, 4);
  assert.equal(lastFourDigitsQuery('5678'), '5678');
  assert.equal(lastFourDigitsQuery('567'), '');
  assert.equal(lastFourDigitsQuery('56789'), '');
  assert.equal(lastFourDigitsQuery('03012345678'), '');
  assert.equal(lastFourDigitsQuery(''), '');
  assert.equal(lastFourDigitsQuery('abcd'), '');
  assert.equal(lastFourDigitsQuery(null), '');
  assert.equal(lastFourDigitsQuery(undefined), '');
});

test('four digits list every customer whose number ends with them', () => {
  const matches = findCustomersByLastFourDigits(customers(), '5678');
  assert.deepEqual(matches.map((m) => m.id), ['CUST-6', 'CUST-3', 'CUST-1', 'CUST-4']);
});

test('the lookup matches the ending only, never a substring', () => {
  // '03012345678' contains '4567' in the middle but does not end with it.
  assert.deepEqual(findCustomersByLastFourDigits(customers(), '4567'), []);
  // '1234' is inside the number too, but it is not the ending.
  assert.deepEqual(findCustomersByLastFourDigits(customers(), '1234'), []);
  // A different ending finds its own customer only.
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), '6789').map((m) => m.id),
    ['CUST-2'],
  );
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), '5670').map((m) => m.id),
    ['CUST-5'],
  );
});

test('fewer or more than four digits is not a lookup at all', () => {
  assert.deepEqual(findCustomersByLastFourDigits(customers(), ''), []);
  assert.deepEqual(findCustomersByLastFourDigits(customers(), '567'), []);
  assert.deepEqual(findCustomersByLastFourDigits(customers(), '56789'), []);
  assert.deepEqual(findCustomersByLastFourDigits(customers(), '03012345678'), []);
});

test('dashes, spaces and plus in the stored number never hide a match', () => {
  // CUST-4 stores its number dashed, CUST-3 with a country code.
  const matches = findCustomersByLastFourDigits(customers(), '5678');
  assert.ok(matches.some((m) => m.id === 'CUST-4'));
  assert.ok(matches.some((m) => m.id === 'CUST-3'));
});

test('digits in the query may sit beside other text', () => {
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), 'call 5678').map((m) => m.id),
    ['CUST-6', 'CUST-3', 'CUST-1', 'CUST-4'],
  );
});

test('Arabic-Indic digits in the query fold to the same digits', () => {
  assert.equal(lastFourDigitsQuery('۵۶۷۸'), '5678');
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), '۵۶۷۸').map((m) => m.id),
    ['CUST-6', 'CUST-3', 'CUST-1', 'CUST-4'],
  );
});

test('the legacy customerPhone field is checked too', () => {
  // CUST-6 carries its number only under customerPhone.
  assert.equal(lastFourDigitsMatches({ phone: undefined, customerPhone: '03012345678' }, '5678'), true);
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), '5678').map((m) => m.id).includes('CUST-6'),
    true,
  );
});

test('a missing number never matches', () => {
  assert.equal(lastFourDigitsMatches({ name: 'Bilal Seven' }, '5678'), false);
  assert.equal(lastFourDigitsMatches(null, '5678'), false);
  assert.equal(lastFourDigitsMatches({ phone: '' }, '5678'), false);
  assert.deepEqual(
    findCustomersByLastFourDigits(customers(), '5678').map((m) => m.id).includes('CUST-7'),
    false,
  );
});

test('matches are in name order, same name twice by customer number', () => {
  const list = [
    { id: 'CUST-9', name: 'Raja Nine', customerNumber: 9, phone: '03012345678' },
    { id: 'CUST-7', name: 'Rani Seven', customerNumber: 7, phone: '03012345678' },
    { id: 'CUST-8', name: 'Raja Nine', customerNumber: 8, phone: '03012345678' },
  ];
  assert.deepEqual(
    findCustomersByLastFourDigits(list, '5678').map((m) => m.id),
    ['CUST-8', 'CUST-9', 'CUST-7'],
  );
});

test('archived customers never appear', () => {
  const list = customers();
  list.push({ id: 'CUST-8', name: 'Raja Archived', customerNumber: 8, phone: '03012345678', archived: true });
  assert.deepEqual(
    findCustomersByLastFourDigits(list, '5678').map((m) => m.id),
    ['CUST-6', 'CUST-3', 'CUST-1', 'CUST-4'],
  );
});

test('entries without a usable id or name are skipped, never guessed', () => {
  const list = [
    { id: '', name: 'Raja NoId', customerNumber: 1, phone: '03012345678' },
    { name: 'Raja NoIdField', customerNumber: 2, phone: '03012345678' },
    { id: 'CUST-3', name: '   ', customerNumber: 3, phone: '03012345678' },
    { id: 'CUST-4', name: null, customerNumber: 4, phone: '03012345678' },
    { id: 'CUST-5', name: 'Raja Kept', customerNumber: 5, phone: '03012345678' },
  ];
  assert.deepEqual(findCustomersByLastFourDigits(list, '5678').map((m) => m.id), ['CUST-5']);
});

test('a non-array customer list matches nothing', () => {
  assert.deepEqual(findCustomersByLastFourDigits(null, '5678'), []);
  assert.deepEqual(findCustomersByLastFourDigits(undefined, '5678'), []);
  assert.deepEqual(findCustomersByLastFourDigits('5678', '5678'), []);
});

test('the lookup never mutates the input list', () => {
  const list = customers();
  const before = JSON.stringify(list);
  const matches = findCustomersByLastFourDigits(list, '5678');
  assert.equal(JSON.stringify(list), before);
  assert.notEqual(matches[0], list.find((c) => c.id === matches[0].id));
  matches[0].name = 'Changed';
  assert.equal(JSON.stringify(list), before);
});

test('mohalla comes from mohalla first, then area, then the placeholder', () => {
  assert.equal(lastFourDigitsMohalla({ mohalla: 'Mohalla Bani', area: 'Mohalla Old' }), 'Mohalla Bani');
  assert.equal(lastFourDigitsMohalla({ area: 'Mohalla Old' }), 'Mohalla Old');
  assert.equal(lastFourDigitsMohalla({}), LAST_FOUR_DIGITS_UNASSIGNED_TEXT);
  assert.equal(lastFourDigitsMohalla({ mohalla: '   ', area: '  ' }), LAST_FOUR_DIGITS_UNASSIGNED_TEXT);
  assert.equal(lastFourDigitsMohalla(null), LAST_FOUR_DIGITS_UNASSIGNED_TEXT);
});

test('matches carry the mohalla on each entry', () => {
  const matches = findCustomersByLastFourDigits(customers(), '5678');
  assert.deepEqual(
    matches.map((m) => [m.id, m.mohalla]),
    [
      ['CUST-6', 'Mohalla Bani'],
      ['CUST-3', 'Mohalla Dhok'],
      ['CUST-1', 'Mohalla Bani'],
      ['CUST-4', 'Mohalla Old'],
    ],
  );
  const rajaFive = findCustomersByLastFourDigits(customers(), '5670');
  assert.equal(rajaFive[0].mohalla, LAST_FOUR_DIGITS_UNASSIGNED_TEXT);
});

test('the line text is name, then mohalla', () => {
  assert.equal(
    lastFourDigitsLineText({ name: 'Raja One', mohalla: 'Mohalla Bani' }),
    'Raja One — Mohalla Bani',
  );
  assert.equal(
    lastFourDigitsLineText({ name: 'Raja Five', mohalla: '' }),
    `Raja Five — ${LAST_FOUR_DIGITS_UNASSIGNED_TEXT}`,
  );
});

test('the summary text is plain words for every case', () => {
  assert.equal(lastFourDigitsSummaryText([], '56'), 'Type the last 4 digits of the phone number.');
  assert.equal(lastFourDigitsSummaryText([], '5678'), 'No customer phone ends with 5678.');
  assert.equal(lastFourDigitsSummaryText([{}], '5678'), '1 customer phone ends with 5678.');
  assert.equal(lastFourDigitsSummaryText([{}, {}], '5678'), '2 customer phones end with 5678.');
});

test('the list markup has one row per match with name and mohalla', () => {
  const html = lastFourDigitsHtml(findCustomersByLastFourDigits(customers(), '5678'), '5678');
  assert.match(html, /data-customer-id="CUST-6"/);
  assert.match(html, /data-customer-id="CUST-3"/);
  assert.match(html, /data-customer-id="CUST-1"/);
  assert.match(html, /data-customer-id="CUST-4"/);
  assert.match(html, /Ali Six/);
  assert.match(html, /Kiran Three/);
  assert.match(html, /Mohalla Dhok/);
  assert.match(html, /Mohalla Old/);
  assert.equal((html.match(/lfd-row/g) || []).length, 4);
});

test('the list markup escapes user text', () => {
  const list = [
    { id: 'CUST-1', name: 'Ali <b>Bold</b>', customerNumber: 1, phone: '03012345678', mohalla: 'Mohalla <i>X</i>' },
  ];
  const html = lastFourDigitsHtml(findCustomersByLastFourDigits(list, '5678'), '5678');
  assert.match(html, /Ali &lt;b&gt;Bold&lt;\/b&gt;/);
  assert.match(html, /Mohalla &lt;i&gt;X&lt;\/i&gt;/);
  assert.doesNotMatch(html, /<b>Bold<\/b>/);
  assert.doesNotMatch(html, /<i>X<\/i>/);
});

test('the list markup carries a pick label per row', () => {
  const html = lastFourDigitsHtml(findCustomersByLastFourDigits(customers(), '5670'), '5670');
  assert.match(html, /aria-label="Pick Raja Five — Unassigned"/);
});

test('four digits with no match say so plainly, anything else renders nothing', () => {
  const html = lastFourDigitsHtml([], '5678');
  assert.match(html, /No customer phone ends with 5678\./);
  assert.match(html, /lfd-empty/);
  assert.equal(lastFourDigitsHtml([], '567'), '');
  assert.equal(lastFourDigitsHtml([], '56789'), '');
  assert.equal(lastFourDigitsHtml([], ''), '');
  assert.equal(lastFourDigitsHtml(null, '567'), '');
});

test('the digit form strips separators and folds Arabic-Indic digits', () => {
  assert.equal(lastFourDigitsOf('03012345678'), '03012345678');
  assert.equal(lastFourDigitsOf('+92 301 2345678'), '923012345678');
  assert.equal(lastFourDigitsOf('0301-2345678'), '03012345678');
  assert.equal(lastFourDigitsOf(null), '');
  assert.equal(lastFourDigitsOf(''), '');
});

// The module is pure: no document, no store, no clock, no network.
test('the module is pure and keeps no store', () => {
  const source = readFileSync(new URL('../last-four-digits-search.js', import.meta.url), 'utf8');
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
  const source = readFileSync(new URL('../last-four-digits-search.js', import.meta.url), 'utf8');
  const fenced = [
    ['nav', '-', 'quick', '-', 'collect', '.', 'js'].join(''),
    ['quick', '-', 'collect', '-', 'one', '-', 'screen', '.', 'js'].join(''),
    ['partial', '-', 'phone', '-', 'search', '.', 'js'].join(''),
    ['name', '-', 'prefix', '-', 'lookup', '.', 'js'].join(''),
    ['mohalla', '-', 'name', '-', 'filter', '.', 'js'].join(''),
    ['full', '-', 'history', '-', 'list', '.', 'js'].join(''),
    ['transaction', '-', 'prefill', '.', 'js'].join(''),
  ];
  for (const name of fenced) {
    assert.doesNotMatch(source, new RegExp(name.replace('.', '\\.')));
  }
});

// The partial-phone search never references the last-four lookup:
// the two searches stay separate, and this plan never rewrites it.
test('the partial-phone search module never references the last-four lookup', () => {
  const partial = readFileSync(new URL('../partial-phone-search.js', import.meta.url), 'utf8');
  assert.doesNotMatch(partial, /lastFourDigits/);
  assert.doesNotMatch(partial, /findCustomersByLastFourDigits/);
  assert.doesNotMatch(partial, /LAST_FOUR_DIGITS/);
});

// Wiring: the lookup lives on the Quick Collect pick step, driven by
// the same search field, and picking a row opens the payment form
// exactly the way a picker card does.
test('wiring: the controller imports the lookup module', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /last-four-digits-search\.js/);
  assert.match(wiring, /findCustomersByLastFourDigits/);
  assert.match(wiring, /lastFourDigitsHtml/);
});

test('wiring: the pick step renders the lookup list on every list render', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /lfdLastFourList/);
  assert.match(wiring, /renderLastFourList/);
  const start = wiring.indexOf('function renderList()');
  assert.notEqual(start, -1);
  // QC-4 lengthened renderList with the mohalla-counts refresh, so
  // the window is 1200 — the intent is unchanged: the lookup list
  // still renders on every list render.
  const block = wiring.slice(start, start + 1200);
  assert.match(block, /renderLastFourList\(\)/);
});

test('wiring: tapping a lookup row opens the customer payment form', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf("lastFourList?.addEventListener('click'");
  assert.notEqual(start, -1);
  const block = wiring.slice(start, start + 800);
  assert.match(block, /lfd-row/);
  assert.match(block, /openCustomerCollectionForm\(/);
});

test('wiring: the lookup host sits on the pick step, after the search box', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pickStep = page.indexOf('id="quickCollectStepPick"');
  const host = page.indexOf('id="lfdLastFourList"');
  const list = page.indexOf('id="quickCollectCustomerList"');
  assert.notEqual(pickStep, -1);
  assert.notEqual(host, -1);
  assert.notEqual(list, -1);
  assert.ok(pickStep < host && host < list);
});

test('the lfd element-id prefix is used by this plan only', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((page.match(/id="lfd/g) || []).length, 1);
});
