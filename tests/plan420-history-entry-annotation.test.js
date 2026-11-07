import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_ENTRY_ANNOTATION_STORE_KEY,
  HISTORY_ENTRY_ANNOTATION_MAX_TEXT,
  HISTORY_ENTRY_ANNOTATION_MAX_BY,
  isStrictHistoryEntryAnnotationDate,
  historyEntryAnnotationKey,
  normalizeHistoryEntryAnnotations,
  historyEntryAnnotationForEntry,
  historyEntryAnnotationsForCustomer,
  historyEntriesHaveAnnotations,
  recordHistoryEntryAnnotation,
  removeHistoryEntryAnnotation,
  historyEntryAnnotationLineText,
  formatHistoryEntryAnnotationAmount,
  historyEntryAnnotationRunningNote,
  historyEntryAnnotationOptionText,
  historyAnnotatedListHtml,
  historyEntryAnnotationFormHtml,
} from '../history-entry-annotation.js';
import {
  fullHistoryEntries,
  fullHistoryListHtml,
  formatHistoryAmount,
  fullHistoryRunningNote,
} from '../full-history-list.js';
import { historyDisputedFlagListHtml } from '../history-disputed-flag.js';

function entriesFixture() {
  return [
    { type: 'charge', date: '2026-09-05', month: '2026-09', amountCents: 100000, runningBalanceCents: 100000, note: '', method: '', ref: 'BILL-1', voided: false },
    { type: 'payment', date: '2026-09-06', month: '2026-09', amountCents: 100000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-1', voided: false },
    { type: 'charge', date: '2026-10-05', month: '2026-10', amountCents: 150000, runningBalanceCents: 150000, note: '', method: '', ref: 'BILL-2', voided: false },
    { type: 'payment', date: '2026-10-06', month: '2026-10', amountCents: 150000, runningBalanceCents: 0, note: '', method: 'JazzCash', ref: 'PAY-2', voided: false },
    { type: 'payment', date: '2026-10-07', month: '2026-10', amountCents: 50000, runningBalanceCents: -50000, note: '', method: 'Cash', ref: 'PAY-3', voided: true },
  ];
}

function annotationFixture() {
  return {
    id: 'hea-1',
    customerId: 'CUST-1',
    entryKey: 'payment:PAY-2',
    entryType: 'payment',
    entryRef: 'PAY-2',
    text: 'customer says this was for his brother',
    date: '2026-11-07',
    by: 'Operator',
  };
}

function billsFixture() {
  return [
    { id: 'BILL-1', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-05', payments: [{ id: 'PAY-1', amount: 1000, date: '2026-09-06', method: 'Cash' }] },
    { id: 'BILL-2', month: '2026-10', dueAmount: 1500, dueDate: '2026-10-05', payments: [{ id: 'PAY-2', amount: 1500, date: '2026-10-06', method: 'JazzCash' }] },
  ];
}

test('date: accepts a strict YYYY-MM-DD date', () => {
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-11-07'), true);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-01-01'), true);
});

test('date: leap-aware February', () => {
  assert.equal(isStrictHistoryEntryAnnotationDate('2024-02-29'), true);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-02-29'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-02-30'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2000-02-29'), true);
  assert.equal(isStrictHistoryEntryAnnotationDate('1900-02-29'), false);
});

test('date: rejects bad months, days and shapes', () => {
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-13-01'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-00-10'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-11-00'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-11-7'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('07-11-2026'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate('2026-11'), false);
  assert.equal(isStrictHistoryEntryAnnotationDate(''), false);
});

test('date: rejects non-strings', () => {
  assert.equal(isStrictHistoryEntryAnnotationDate(null), false);
  assert.equal(isStrictHistoryEntryAnnotationDate(undefined), false);
  assert.equal(isStrictHistoryEntryAnnotationDate(20261107), false);
  assert.equal(isStrictHistoryEntryAnnotationDate(true), false);
});

test('key: type and record reference', () => {
  assert.equal(historyEntryAnnotationKey({ type: 'payment', ref: 'PAY-2' }), 'payment:PAY-2');
  assert.equal(historyEntryAnnotationKey({ type: 'CHARGE', ref: '  BILL-1 ' }), 'charge:BILL-1');
});

test('key: empty when the entry has no usable reference', () => {
  assert.equal(historyEntryAnnotationKey({ type: 'payment', ref: '' }), '');
  assert.equal(historyEntryAnnotationKey({ type: 'payment', ref: '   ' }), '');
  assert.equal(historyEntryAnnotationKey({ type: 'payment' }), '');
});

test('key: empty for an unknown type or a non-object', () => {
  assert.equal(historyEntryAnnotationKey({ type: 'note', ref: 'PAY-2' }), '');
  assert.equal(historyEntryAnnotationKey(null), '');
  assert.equal(historyEntryAnnotationKey('payment:PAY-2'), '');
});

test('normalize: keeps a valid annotation and caps text and by', () => {
  const list = normalizeHistoryEntryAnnotations([{
    ...annotationFixture(),
    text: ` ${'x'.repeat(400)} `,
    by: ` ${'y'.repeat(80)} `,
  }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].text.length, HISTORY_ENTRY_ANNOTATION_MAX_TEXT);
  assert.equal(list[0].by.length, HISTORY_ENTRY_ANNOTATION_MAX_BY);
  assert.equal(list[0].date, '2026-11-07');
});

test('normalize: drops annotations with no customer, no text, a bad date, a bad type, or no reference', () => {
  const base = annotationFixture();
  const list = normalizeHistoryEntryAnnotations([
    { ...base, customerId: '' },
    { ...base, id: 'hea-2', text: '   ' },
    { ...base, id: 'hea-3', date: '2026-02-29' },
    { ...base, id: 'hea-4', entryType: 'note', entryKey: 'note:PAY-2' },
    { ...base, id: 'hea-5', entryRef: '', entryKey: 'payment:' },
    null,
    'not an annotation',
  ]);
  assert.deepEqual(list, []);
});

test('normalize: first valid annotation wins per customer and entry', () => {
  const first = annotationFixture();
  const second = { ...annotationFixture(), id: 'hea-2', text: 'a later note' };
  const list = normalizeHistoryEntryAnnotations([first, second]);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'hea-1');
  assert.equal(list[0].text, first.text);
});

test('normalize: assigns hea ids where missing, skipping collisions', () => {
  const base = annotationFixture();
  const list = normalizeHistoryEntryAnnotations([
    { ...base, id: '' },
    { ...base, id: 'hea-1', entryRef: 'PAY-1', entryKey: 'payment:PAY-1' },
    { ...base, id: '', entryRef: 'PAY-3', entryKey: 'payment:PAY-3' },
  ]);
  assert.deepEqual(list.map((item) => item.id), ['hea-1', 'hea-2', 'hea-3']);
});

test('normalize: non-array is empty, and the input list is never mutated', () => {
  assert.deepEqual(normalizeHistoryEntryAnnotations(null), []);
  assert.deepEqual(normalizeHistoryEntryAnnotations('nope'), []);
  const input = [annotationFixture()];
  const before = JSON.stringify(input);
  normalizeHistoryEntryAnnotations(input);
  assert.equal(JSON.stringify(input), before);
});

test('lookup: finds the annotation for its entry', () => {
  const entries = entriesFixture();
  const found = historyEntryAnnotationForEntry([annotationFixture()], 'CUST-1', entries[3]);
  assert.equal(found?.id, 'hea-1');
  assert.equal(found?.text, 'customer says this was for his brother');
});

test('lookup: null for another customer, another entry, or a reference-less entry', () => {
  const entries = entriesFixture();
  assert.equal(historyEntryAnnotationForEntry([annotationFixture()], 'CUST-2', entries[3]), null);
  assert.equal(historyEntryAnnotationForEntry([annotationFixture()], 'CUST-1', entries[1]), null);
  assert.equal(historyEntryAnnotationForEntry([annotationFixture()], 'CUST-1', { type: 'payment', ref: '' }), null);
  assert.equal(historyEntryAnnotationForEntry([annotationFixture()], '', entries[3]), null);
});

test('lookup: forCustomer returns only that customer, in order', () => {
  const other = { ...annotationFixture(), id: 'hea-9', customerId: 'CUST-2', entryRef: 'PAY-9', entryKey: 'payment:PAY-9' };
  const list = historyEntryAnnotationsForCustomer([annotationFixture(), other], 'CUST-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'hea-1');
  assert.deepEqual(historyEntryAnnotationsForCustomer([annotationFixture()], ''), []);
});

test('record: appends a new annotation with a hea id', () => {
  const entries = entriesFixture();
  const list = recordHistoryEntryAnnotation([], {
    customerId: 'CUST-1', entry: entries[3],
    text: 'customer says this was for his brother', date: '2026-11-07', by: 'Operator',
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'hea-1');
  assert.equal(list[0].entryKey, 'payment:PAY-2');
  assert.equal(list[0].by, 'Operator');
});

test('record: a second note on the same entry replaces the first and keeps its id', () => {
  const entries = entriesFixture();
  const first = recordHistoryEntryAnnotation([], {
    customerId: 'CUST-1', entry: entries[3], text: 'first note', date: '2026-11-07', by: 'Operator',
  });
  const second = recordHistoryEntryAnnotation(first, {
    customerId: 'CUST-1', entry: entries[3], text: 'better note', date: '2026-11-08', by: '',
  });
  assert.equal(second.length, 1);
  assert.equal(second[0].id, 'hea-1');
  assert.equal(second[0].text, 'better note');
  assert.equal(second[0].date, '2026-11-08');
});

test('record: refuses an empty note and returns the very list passed in', () => {
  const entries = entriesFixture();
  const before = [annotationFixture()];
  assert.equal(recordHistoryEntryAnnotation(before, {
    customerId: 'CUST-1', entry: entries[1], text: '   ', date: '2026-11-07', by: '',
  }), before);
});

test('record: refuses a bad date and returns the very list passed in', () => {
  const entries = entriesFixture();
  const before = [annotationFixture()];
  assert.equal(recordHistoryEntryAnnotation(before, {
    customerId: 'CUST-1', entry: entries[1], text: 'a note', date: '2026-02-29', by: '',
  }), before);
});

test('record: refuses a reference-less entry and returns the very list passed in', () => {
  const before = [annotationFixture()];
  assert.equal(recordHistoryEntryAnnotation(before, {
    customerId: 'CUST-1', entry: { type: 'payment', ref: '' }, text: 'a note', date: '2026-11-07', by: '',
  }), before);
});

test('record: refuses a missing customer and returns the very list passed in', () => {
  const entries = entriesFixture();
  const before = [annotationFixture()];
  assert.equal(recordHistoryEntryAnnotation(before, {
    customerId: ' ', entry: entries[1], text: 'a note', date: '2026-11-07', by: '',
  }), before);
});

test('record: the customer match is case-insensitive', () => {
  const entries = entriesFixture();
  const list = recordHistoryEntryAnnotation([annotationFixture()], {
    customerId: 'cust-1', entry: entries[3], text: 'replacement note', date: '2026-11-08', by: '',
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'hea-1');
});

test('remove: removes only that annotation', () => {
  const other = { ...annotationFixture(), id: 'hea-2', entryRef: 'PAY-1', entryKey: 'payment:PAY-1', text: 'other note' };
  const list = removeHistoryEntryAnnotation([annotationFixture(), other], 'hea-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'hea-2');
});

test('remove: an unknown or empty id returns the very list passed in', () => {
  const before = [annotationFixture()];
  assert.equal(removeHistoryEntryAnnotation(before, 'hea-99'), before);
  assert.equal(removeHistoryEntryAnnotation(before, ''), before);
});

test('record and remove never mutate the input list', () => {
  const entries = entriesFixture();
  const before = [annotationFixture()];
  const snapshot = JSON.stringify(before);
  recordHistoryEntryAnnotation(before, {
    customerId: 'CUST-1', entry: entries[1], text: 'new note', date: '2026-11-07', by: '',
  });
  removeHistoryEntryAnnotation(before, 'hea-1');
  assert.equal(JSON.stringify(before), snapshot);
});

test('line text: note, date and who wrote it', () => {
  assert.equal(
    historyEntryAnnotationLineText(annotationFixture()),
    'Note: customer says this was for his brother · 2026-11-07 · by Operator',
  );
});

test('line text: no by part when nobody is recorded', () => {
  assert.equal(
    historyEntryAnnotationLineText({ ...annotationFixture(), by: '' }),
    'Note: customer says this was for his brother · 2026-11-07',
  );
});

test('line text: empty for an invalid annotation', () => {
  assert.equal(historyEntryAnnotationLineText(null), '');
  assert.equal(historyEntryAnnotationLineText({ ...annotationFixture(), text: '' }), '');
  assert.equal(historyEntryAnnotationLineText({ ...annotationFixture(), date: '2026-02-29' }), '');
});

test('formatter: whole rupees and paisa, and not-a-number is never zero', () => {
  assert.equal(formatHistoryEntryAnnotationAmount(150000), 'PKR 1,500');
  assert.equal(formatHistoryEntryAnnotationAmount(150050), 'PKR 1,500.5');
  assert.equal(formatHistoryEntryAnnotationAmount(0), 'PKR 0');
  assert.equal(formatHistoryEntryAnnotationAmount(-250000), '-PKR 2,500');
  assert.equal(formatHistoryEntryAnnotationAmount(null), 'PKR 0');
  assert.equal(formatHistoryEntryAnnotationAmount(undefined), 'PKR 0');
  assert.equal(formatHistoryEntryAnnotationAmount(true), 'PKR 0');
  assert.equal(formatHistoryEntryAnnotationAmount(''), 'PKR 0');
  assert.equal(formatHistoryEntryAnnotationAmount(NaN), 'PKR 0');
});

test('formatter: matches the full history amount on the same values', () => {
  for (const cents of [0, 5000, 100000, 150050, -250000, 250000]) {
    assert.equal(formatHistoryEntryAnnotationAmount(cents), formatHistoryAmount(cents));
  }
});

test('running note: Settled, Still owed, Credit, and not-a-number settles', () => {
  assert.equal(historyEntryAnnotationRunningNote(0), 'Settled');
  assert.equal(historyEntryAnnotationRunningNote(150000), 'Still owed PKR 1,500');
  assert.equal(historyEntryAnnotationRunningNote(-50000), 'Credit PKR 500');
  assert.equal(historyEntryAnnotationRunningNote(null), 'Settled');
  assert.equal(historyEntryAnnotationRunningNote(true), 'Settled');
});

test('running note: matches the full history running note on the same values', () => {
  for (const cents of [0, 150000, -50000, 250000, -1]) {
    assert.equal(historyEntryAnnotationRunningNote(cents), fullHistoryRunningNote(cents));
  }
});

test('list: byte-identical to the full history list when nothing is annotated', () => {
  const entries = entriesFixture();
  assert.equal(historyAnnotatedListHtml(entries, [], 'CUST-1'), fullHistoryListHtml(entries));
  assert.equal(historyAnnotatedListHtml(entries, [annotationFixture()], 'CUST-2'), fullHistoryListHtml(entries));
});

test('list: byte-identical to the disputed flag list when nothing is annotated', () => {
  const entries = entriesFixture().map((entry) => entry.ref === 'PAY-2'
    ? { ...entry, disputedCaseRef: 'CASE-7' }
    : entry);
  assert.equal(historyAnnotatedListHtml(entries, [], 'CUST-1'), historyDisputedFlagListHtml(entries));
});

test('list: the annotation sits inside its own entry row, with date, by and a Remove button', () => {
  const entries = entriesFixture();
  const html = historyAnnotatedListHtml(entries, [annotationFixture()], 'CUST-1');
  const rows = html.split('<li class="payment-row">').slice(1);
  assert.equal(rows.length, 5);
  const pay2 = rows.find((row) => row.includes('2026-10-06'));
  assert.ok(pay2.includes('JazzCash'));
  assert.ok(pay2.includes('Note: customer says this was for his brother · 2026-11-07 · by Operator'));
  assert.ok(pay2.includes('data-hea-remove="hea-1"'));
  assert.ok(pay2.includes('>Remove</button>'));
  const pay1 = rows.find((row) => row.includes('2026-09-06'));
  assert.ok(!pay1.includes('hea-annotation'));
  assert.ok(!pay1.includes('data-hea-remove'));
});

test('list: an annotated disputed row keeps its flag and its annotation', () => {
  const entries = entriesFixture().map((entry) => entry.ref === 'PAY-2'
    ? { ...entry, disputedCaseRef: 'CASE-7' }
    : entry);
  const html = historyAnnotatedListHtml(entries, [annotationFixture()], 'CUST-1');
  const rows = html.split('<li class="payment-row">').slice(1);
  const pay2 = rows.find((row) => row.includes('2026-10-06'));
  assert.ok(pay2.includes('· Disputed · CASE-7'));
  assert.ok(pay2.includes('Note: customer says this was for his brother · 2026-11-07 · by Operator'));
});

test('list: empty entries render nothing', () => {
  assert.equal(historyAnnotatedListHtml([], [annotationFixture()], 'CUST-1'), '');
  assert.equal(historyAnnotatedListHtml(null, [], 'CUST-1'), '');
});

test('list: annotation text is escaped, never raw markup', () => {
  const entries = entriesFixture();
  const evil = { ...annotationFixture(), text: '<script>alert(1)</script>' };
  const html = historyAnnotatedListHtml(entries, [evil], 'CUST-1');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('list: another customer’s annotation never appears', () => {
  const entries = entriesFixture();
  const other = { ...annotationFixture(), customerId: 'CUST-2' };
  assert.equal(historyAnnotatedListHtml(entries, [other], 'CUST-1'), fullHistoryListHtml(entries));
});

test('hasAnnotations: true only when a shown entry carries one', () => {
  const entries = entriesFixture();
  assert.equal(historyEntriesHaveAnnotations(entries, [annotationFixture()], 'CUST-1'), true);
  assert.equal(historyEntriesHaveAnnotations(entries, [], 'CUST-1'), false);
  assert.equal(historyEntriesHaveAnnotations(entries, [annotationFixture()], 'CUST-2'), false);
  assert.equal(historyEntriesHaveAnnotations([], [annotationFixture()], 'CUST-1'), false);
});

test('form: offers only entries that can take a note, with entry-key values', () => {
  const entries = entriesFixture();
  const html = historyEntryAnnotationFormHtml(entries, [annotationFixture()], 'CUST-1', '2026-11-07');
  assert.ok(html.includes('id="heaHistoryEntryAnnotationEntry"'));
  assert.ok(html.includes('value="charge:BILL-1"'));
  assert.ok(html.includes('value="payment:PAY-1"'));
  assert.ok(!html.includes('value="payment:PAY-2"'));
  assert.ok(html.includes('2026-09-05 · Charge · PKR 1,000'));
  assert.ok(html.includes('id="heaHistoryEntryAnnotationText"'));
  assert.ok(html.includes('id="heaHistoryEntryAnnotationBy"'));
  assert.ok(html.includes('id="heaHistoryEntryAnnotationDate"'));
  assert.ok(html.includes('value="2026-11-07"'));
  assert.ok(html.includes('id="heaHistoryEntryAnnotationAdd"'));
});

test('form: no form when every shown entry already carries a note', () => {
  const entries = entriesFixture();
  const all = entries.map((entry, i) => ({
    ...annotationFixture(),
    id: `hea-${i + 1}`,
    entryKey: historyEntryAnnotationKey(entry),
    entryType: entry.type,
    entryRef: entry.ref,
    text: `note ${i + 1}`,
  }));
  assert.equal(historyEntryAnnotationFormHtml(entries, all, 'CUST-1', '2026-11-07'), '');
});

test('form: no form for an empty shown list, and a bad today leaves the date blank', () => {
  assert.equal(historyEntryAnnotationFormHtml([], [], 'CUST-1', '2026-11-07'), '');
  const html = historyEntryAnnotationFormHtml(entriesFixture(), [], 'CUST-1', 'not a date');
  assert.ok(html.includes('id="heaHistoryEntryAnnotationDate"'));
  assert.ok(!html.includes('value="not a date"'));
});

test('option text: date, label and amount in plain words', () => {
  const entries = entriesFixture();
  assert.equal(historyEntryAnnotationOptionText(entries[3]), '2026-10-06 · Payment · PKR 1,500');
  assert.equal(historyEntryAnnotationOptionText(entries[4]), '2026-10-07 · Payment · VOID · PKR 500');
  assert.equal(historyEntryAnnotationOptionText({ type: 'charge', date: '', amountCents: 100000, ref: 'BILL-9' }), 'date not recorded · Charge · PKR 1,000');
  assert.equal(historyEntryAnnotationOptionText(null), '');
});

test('acceptance: the note appears beside its entry, the entry stays unchanged, removal restores the plain list', () => {
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills: billsFixture(), creditEntries: [], refundRecords: [] });
  assert.equal(entries.length, 4);
  const octoberPayment = entries.find((entry) => entry.ref === 'PAY-2');
  const annotated = recordHistoryEntryAnnotation([], {
    customerId: 'CUST-1', entry: octoberPayment,
    text: 'customer says this was for his brother', date: '2026-11-07', by: 'Operator',
  });
  const html = historyAnnotatedListHtml(entries, annotated, 'CUST-1');
  const rows = html.split('<li class="payment-row">').slice(1);
  const pay2 = rows.find((row) => row.includes('2026-10-06'));
  assert.ok(pay2.includes('JazzCash'));
  assert.ok(pay2.includes('PKR 1,500'));
  assert.ok(pay2.includes('Note: customer says this was for his brother · 2026-11-07 · by Operator'));
  const plain = historyAnnotatedListHtml(entries, removeHistoryEntryAnnotation(annotated, annotated[0].id), 'CUST-1');
  assert.equal(plain, fullHistoryListHtml(entries));
});

test('store key: the annotation store is the short hea key', () => {
  assert.equal(HISTORY_ENTRY_ANNOTATION_STORE_KEY, 'shahdara_hea_notes_v1');
});

test('module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../history-entry-annotation.js', import.meta.url), 'utf8');
  const fenced = [
    'full-' + 'history-list.js',
    'billing-' + 'corrections.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'disputed-flag.js',
    'history-' + 'refunds-inline.js',
    'history-' + 'credit-inline.js',
    'history-' + 'adjustments-inline.js',
    'history-' + 'month-comparison.js',
    'history-' + 'connection-filter.js',
  ];
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

test('module is pure: no clock, storage, network, or page access', () => {
  const source = readFileSync(new URL('../history-entry-annotation.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('window.'));
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('OLT'));
});

test('wiring: app.js imports the module, loads the notes, and renders the annotated list and form', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { HISTORY_ENTRY_ANNOTATION_STORE_KEY, historyEntryAnnotationKey, normalizeHistoryEntryAnnotations, recordHistoryEntryAnnotation, removeHistoryEntryAnnotation, historyEntryAnnotationForEntry, historyEntriesHaveAnnotations, historyAnnotatedListHtml, historyEntryAnnotationFormHtml } from './history-entry-annotation.js';"));
  assert.ok(app.includes('loadHistoryEntryAnnotations()'));
  assert.ok(app.includes('saveHistoryEntryAnnotations('));
  assert.ok(app.includes("$('#heaHistoryEntryAnnotation')"));
  assert.ok(app.includes('historyAnnotatedListHtml(shown, entryAnnotations, customer.id)'));
  assert.ok(app.includes('historyEntryAnnotationFormHtml(shown, entryAnnotations, customer.id, localDate())'));
  assert.ok(app.includes('data-hea-remove'));
});

test('wiring: index.html carries the annotation host right after the list host', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const listAt = html.indexOf('id="fhlFullHistoryList"');
  const annotationAt = html.indexOf('id="heaHistoryEntryAnnotation"');
  assert.ok(listAt !== -1);
  assert.ok(annotationAt !== -1);
  assert.ok(annotationAt > listAt);
});
