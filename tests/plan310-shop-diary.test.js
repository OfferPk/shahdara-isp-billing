import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validShopDiaryDay,
  normalizeShopDiaryEntryLine,
  normalizeShopDiaryEntry,
  normalizeShopDiaryEntryList,
  findShopDiaryEntry,
  findShopDiaryEntryByDate,
  recordShopDiaryEntry,
  removeShopDiaryEntry,
  shopDiaryEntriesSorted,
  shopDiaryEntriesForPerson,
  shopDiaryEnteredByPeople,
  shopDiarySummaryText,
  shopDiaryEntryText,
  shopDiaryEntryHtml,
  shopDiaryAllHtml,
  shopDiaryEntriesForPersonHtml,
  shopDiaryCsv,
  shopDiaryFilename,
} from '../shop-diary.js';

const first = {
  id: 'SD-1',
  date: '2026-11-05',
  entries: ['Two visitors asked about the 3000 package.', 'Generator fuel topped up.'],
  enteredBy: 'Saad',
};
const second = {
  id: 'SD-2',
  date: '2026-11-04',
  entries: ['Collected pending bills in the main street.'],
  enteredBy: 'Owner',
};
const third = {
  id: 'SD-3',
  date: '2026-11-03',
  entries: ['Fault on the north segment fixed.', 'Cash counted with a witness.'],
  enteredBy: 'saad',
};

test('strict dates: real calendar days only', () => {
  assert.equal(validShopDiaryDay('2026-11-05'), true);
  assert.equal(validShopDiaryDay('2024-02-29'), true);
  assert.equal(validShopDiaryDay('2026-02-29'), false);
  assert.equal(validShopDiaryDay('2026-04-31'), false);
  assert.equal(validShopDiaryDay('2026-13-01'), false);
  assert.equal(validShopDiaryDay('2026-11-5'), false);
});

test('half-formed entries are refused', () => {
  assert.equal(normalizeShopDiaryEntry(null), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, id: '' }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, enteredBy: '  ' }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, entries: [] }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, entries: 'One line' }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, entries: ['Good line', '   '] }), null);
  assert.equal(normalizeShopDiaryEntry({ ...first, entries: ['Good line', 42] }), null);
  assert.deepEqual(normalizeShopDiaryEntry(first), first);
});

test('lines are plain words only, trimmed, and blank lines are refused', () => {
  assert.equal(normalizeShopDiaryEntryLine('  Two visitors came.  '), 'Two visitors came.');
  assert.equal(normalizeShopDiaryEntryLine('   '), null);
  assert.equal(normalizeShopDiaryEntryLine(42), null);
  assert.equal(normalizeShopDiaryEntryLine(null), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 5000, customer: 'Someone', extra: true };
  const clean = normalizeShopDiaryEntry(raw);
  assert.deepEqual(clean, first);
  assert.equal('bill' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('customer' in clean, false);
  const before = JSON.stringify(raw);
  normalizeShopDiaryEntry(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordShopDiaryEntry([first], { ...first, enteredBy: 'Someone else' });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordShopDiaryEntry([first], second), [first, second]);
  assert.deepEqual(recordShopDiaryEntry([], 'nope'), []);
});

test('one entry per date: a second entry for the same date never replaces the first', () => {
  const sameDay = { id: 'SD-9', date: '2026-11-05', entries: ['A different note.'], enteredBy: 'Owner' };
  assert.deepEqual(recordShopDiaryEntry([first], sameDay), [first]);
  assert.deepEqual(findShopDiaryEntryByDate([first, second], '2026-11-05'), first);
  assert.equal(findShopDiaryEntryByDate([first, second], '2026-11-06'), null);
  assert.equal(findShopDiaryEntryByDate([first], ''), null);
});

test('find and remove', () => {
  assert.deepEqual(findShopDiaryEntry([first, second], 'SD-2'), second);
  assert.equal(findShopDiaryEntry([first], 'SD-9'), null);
  assert.deepEqual(removeShopDiaryEntry([first, second], 'SD-1'), [second]);
  assert.deepEqual(removeShopDiaryEntry([first], 'SD-9'), [first]);
  assert.deepEqual(removeShopDiaryEntry([first], ''), [first]);
});

test('entries list newest first', () => {
  assert.deepEqual(shopDiaryEntriesSorted([second, third, first]), [first, second, third]);
  assert.deepEqual(shopDiaryEntriesSorted([]), []);
  const sameDayLater = { id: 'SD-4', date: '2026-11-05', entries: ['Later note.'], enteredBy: 'Owner' };
  assert.deepEqual(shopDiaryEntriesSorted([first, sameDayLater]), [first, sameDayLater]);
});

test('entries for one person, case-insensitive, newest first', () => {
  assert.deepEqual(shopDiaryEntriesForPerson([first, second, third], 'SAAD'), [first, third]);
  assert.deepEqual(shopDiaryEntriesForPerson([first, second], 'Nobody'), []);
  assert.deepEqual(shopDiaryEntriesForPerson([first], ''), []);
});

test('entered-by people in A-Z order, first spelling kept', () => {
  assert.deepEqual(shopDiaryEnteredByPeople([first, second, third]), ['Owner', 'Saad']);
  assert.deepEqual(shopDiaryEnteredByPeople([]), []);
});

test('summary text names the count, the span, and the latest day', () => {
  assert.equal(shopDiarySummaryText([]), 'No daily shop diary entries recorded.');
  assert.equal(
    shopDiarySummaryText([first]),
    '1 diary entry for 2026-11-05. Latest day: 2026-11-05, entered by Saad.',
  );
  assert.equal(
    shopDiarySummaryText([first, second, third]),
    '3 diary entries from 2026-11-03 to 2026-11-05. Latest day: 2026-11-05, entered by Saad.',
  );
});

test('entry text joins the day lines in plain words', () => {
  assert.equal(
    shopDiaryEntryText(first),
    '2026-11-05 — entered by Saad: Two visitors asked about the 3000 package.; Generator fuel topped up..',
  );
  assert.equal(shopDiaryEntryText(null), '');
  assert.equal(shopDiaryEntryText({ ...first, date: '2026-02-30' }), '');
});

test('entry HTML escapes user text', () => {
  const nasty = { id: 'SD-7', date: '2026-11-02', entries: ['Note <script>alert(1)</script> & more.'], enteredBy: 'Saad' };
  const html = shopDiaryEntryHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(shopDiaryEntryHtml(null), '');
});

test('all HTML lists newest first and says so plainly when empty', () => {
  assert.equal(shopDiaryAllHtml([]), '<p>No daily shop diary entries recorded.</p>');
  const html = shopDiaryAllHtml([second, first]);
  assert.equal(html.startsWith('<ul>'), true);
  assert.equal(html.indexOf('2026-11-05') < html.indexOf('2026-11-04'), true);
});

test('person HTML lists only that person and says so plainly when empty', () => {
  assert.equal(shopDiaryEntriesForPersonHtml([first], 'Nobody'), '<p>No diary entries by that person.</p>');
  const html = shopDiaryEntriesForPersonHtml([first, second, third], 'saad');
  assert.equal(html.includes('2026-11-05'), true);
  assert.equal(html.includes('2026-11-03'), true);
  assert.equal(html.includes('2026-11-04'), false);
});

test('CSV is newest first with a fixed header and a fixed filename', () => {
  assert.equal(shopDiaryFilename(), 'shop-diary.csv');
  const csv = shopDiaryCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,date,entries,enteredBy');
  assert.equal(lines[1].startsWith('SD-1,2026-11-05,'), true);
  assert.equal(lines[2].startsWith('SD-2,2026-11-04,'), true);
  assert.equal(shopDiaryCsv([]), 'id,date,entries,enteredBy');
});

test('CSV quotes cells holding commas or quotes', () => {
  const tricky = { id: 'SD-8', date: '2026-11-01', entries: ['Said "hello", then left.'], enteredBy: 'Saad' };
  const csv = shopDiaryCsv([tricky]);
  assert.equal(csv.includes('"Said ""hello"", then left."'), true);
});

test('recording an entry changes nothing else: the list only grows by that entry', () => {
  const before = [second];
  const after = recordShopDiaryEntry(before, first);
  assert.deepEqual(after, [second, first]);
  assert.deepEqual(before, [second]);
  assert.deepEqual(normalizeShopDiaryEntryList([first, { ...first, id: 'SD-1' }]), [first]);
});
