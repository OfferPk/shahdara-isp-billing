import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NUMBER_CHANGE_STORE_KEY,
  NUMBER_CHANGE_NUMBER_MAX_LENGTH,
  NUMBER_CHANGE_RECORDED_BY_MAX_LENGTH,
  NUMBER_CHANGE_ANNOTATION_MAX_LENGTH,
  isStrictNumberChangeDate,
  numberChangeDigits,
  normalizeNumberChangeEntry,
  normalizeNumberChangeList,
  recordNumberChangeEntry,
  annotateNumberChangeEntry,
  numberChangesForCustomer,
  currentNumberForCustomer,
  numberForCustomerOnDate,
  numberChangeRowText,
  numberChangeSummaryText,
  numberChangeLogSectionHtml,
} from '../number-change-log.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'number-change-log.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
// Numbers are pattern-fake only (the 03012345678 ascending-digit
// family): the old number ends 678, the new number ends 679.
const OLD_NUMBER = '03012345678';
const NEW_NUMBER = '03012345679';
const OLD_NUMBER_2 = '03012345671';
const NEW_NUMBER_2 = '03012345672';

function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    phone: OLD_NUMBER,
    ...overrides,
  };
}

function entry(overrides = {}) {
  return {
    id: 'NCL-1',
    customerId: 'CUST-1',
    oldNumber: OLD_NUMBER,
    newNumber: NEW_NUMBER,
    changeDate: '2026-11-06',
    recordedBy: 'Saad',
    annotations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('strict dates: a real calendar date passes, a leap day passes in a leap year', () => {
  assert.equal(isStrictNumberChangeDate('2026-11-06'), true);
  assert.equal(isStrictNumberChangeDate('2024-02-29'), true);
  assert.equal(isStrictNumberChangeDate('2026-02-28'), true);
});

test('strict dates: 29 February in a non-leap year, 31 April and month 13 are refused', () => {
  assert.equal(isStrictNumberChangeDate('2025-02-29'), false);
  assert.equal(isStrictNumberChangeDate('2026-04-31'), false);
  assert.equal(isStrictNumberChangeDate('2026-13-01'), false);
  assert.equal(isStrictNumberChangeDate('2026-00-10'), false);
  assert.equal(isStrictNumberChangeDate('2026-11-00'), false);
});

test('strict dates: wrong shape and non-strings are refused', () => {
  assert.equal(isStrictNumberChangeDate('06-11-2026'), false);
  assert.equal(isStrictNumberChangeDate('2026/11/06'), false);
  assert.equal(isStrictNumberChangeDate('2026-11-6'), false);
  assert.equal(isStrictNumberChangeDate(''), false);
  assert.equal(isStrictNumberChangeDate(null), false);
  assert.equal(isStrictNumberChangeDate(20261106), false);
});

// ---------------------------------------------------------------------------
// Digit core: the same number in 0 and +92 writing counts as one number
// ---------------------------------------------------------------------------

test('digit core: a leading 0 and a +92 code collapse to the same 10 digits', () => {
  assert.equal(numberChangeDigits('03012345678'), '3012345678');
  assert.equal(numberChangeDigits('+92 301 234 5678'), '3012345678');
  assert.equal(numberChangeDigits('0301 2345678'), '3012345678');
  assert.equal(numberChangeDigits('03012345679'), '3012345679');
});

test('digit core: a short or empty value has no mobile core', () => {
  assert.equal(numberChangeDigits('555'), '');
  assert.equal(numberChangeDigits(''), '');
  assert.equal(numberChangeDigits(null), '');
});

// ---------------------------------------------------------------------------
// Normalizing one entry
// ---------------------------------------------------------------------------

test('normalize entry: a complete entry is kept, trimmed, with annotations defaulting to empty', () => {
  const kept = normalizeNumberChangeEntry(entry({ oldNumber: ' 03012345678 ', recordedBy: '  Saad  ' }));
  assert.equal(kept.oldNumber, OLD_NUMBER);
  assert.equal(kept.newNumber, NEW_NUMBER);
  assert.equal(kept.recordedBy, 'Saad');
  assert.deepEqual(kept.annotations, []);
});

test('normalize entry: missing id, customer, old number or new number is refused', () => {
  assert.equal(normalizeNumberChangeEntry(entry({ id: '  ' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ customerId: '' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ oldNumber: '' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ newNumber: '   ' })), null);
  assert.equal(normalizeNumberChangeEntry(null), null);
  assert.equal(normalizeNumberChangeEntry('not an entry'), null);
});

test('normalize entry: a bad change date is refused', () => {
  assert.equal(normalizeNumberChangeEntry(entry({ changeDate: '2025-02-29' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ changeDate: '06-11-2026' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ changeDate: '' })), null);
});

test('normalize entry: the same number twice is not a change', () => {
  assert.equal(normalizeNumberChangeEntry(entry({ newNumber: OLD_NUMBER })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ newNumber: ' 03012345678 ' })), null);
});

test('normalize entry: the same number in +92 writing is not a change', () => {
  assert.equal(normalizeNumberChangeEntry(entry({ newNumber: '+92 301 234 5678' })), null);
  assert.equal(normalizeNumberChangeEntry(entry({ oldNumber: '+92 301 234 5678', newNumber: OLD_NUMBER })), null);
});

test('normalize entry: a genuinely different number is a change', () => {
  assert.ok(normalizeNumberChangeEntry(entry({ newNumber: NEW_NUMBER_2 })));
  assert.ok(normalizeNumberChangeEntry(entry({ oldNumber: OLD_NUMBER_2, newNumber: NEW_NUMBER_2 })));
});

test('normalize entry: over-long text is sliced, never kept whole', () => {
  const kept = normalizeNumberChangeEntry(entry({
    oldNumber: '0'.repeat(40),
    newNumber: '1'.repeat(40),
    recordedBy: 'S'.repeat(80),
  }));
  assert.equal(kept.oldNumber.length, NUMBER_CHANGE_NUMBER_MAX_LENGTH);
  assert.equal(kept.newNumber.length, NUMBER_CHANGE_NUMBER_MAX_LENGTH);
  assert.equal(kept.recordedBy.length, NUMBER_CHANGE_RECORDED_BY_MAX_LENGTH);
});

test('normalize entry: bad annotations are dropped, good ones are kept', () => {
  const kept = normalizeNumberChangeEntry(entry({
    annotations: [
      { text: 'Customer confirmed on call', date: '2026-11-07' },
      { text: '   ', date: '2026-11-07' },
      { text: 'Bad date note', date: '2025-02-29' },
      null,
    ],
  }));
  assert.equal(kept.annotations.length, 1);
  assert.equal(kept.annotations[0].text, 'Customer confirmed on call');
});

// ---------------------------------------------------------------------------
// Normalizing a list
// ---------------------------------------------------------------------------

test('normalize list: a non-array becomes an empty list', () => {
  assert.deepEqual(normalizeNumberChangeList(null), []);
  assert.deepEqual(normalizeNumberChangeList({}), []);
  assert.deepEqual(normalizeNumberChangeList('nope'), []);
});

test('normalize list: invalid entries are dropped and duplicate ids are kept once', () => {
  const kept = normalizeNumberChangeList([
    entry(),
    entry({ id: 'ncl-1', newNumber: NEW_NUMBER_2 }),
    entry({ id: 'NCL-2', changeDate: '2025-02-29' }),
    entry({ id: 'NCL-3', oldNumber: OLD_NUMBER_2, newNumber: NEW_NUMBER_2, changeDate: '2026-11-05' }),
  ]);
  assert.deepEqual(kept.map(e => e.id), ['NCL-1', 'NCL-3']);
});

// ---------------------------------------------------------------------------
// Recording a change
// ---------------------------------------------------------------------------

test('record: a valid change is appended and the input list is never mutated', () => {
  const before = Object.freeze([entry()]);
  const after = recordNumberChangeEntry(before, entry({ id: 'NCL-2', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }));
  assert.equal(after.length, 2);
  assert.equal(before.length, 1);
  assert.equal(after[1].id, 'NCL-2');
});

test('record: a duplicate id or an invalid entry leaves the list unchanged', () => {
  const before = [entry()];
  assert.equal(recordNumberChangeEntry(before, entry({ newNumber: NEW_NUMBER_2 })).length, 1);
  assert.equal(recordNumberChangeEntry(before, entry({ id: 'NCL-9', changeDate: '2025-02-29' })).length, 1);
  assert.equal(recordNumberChangeEntry(before, entry({ id: 'NCL-9', newNumber: OLD_NUMBER })).length, 1);
});

// ---------------------------------------------------------------------------
// Annotating a change (never editing it)
// ---------------------------------------------------------------------------

test('annotate: a note is appended and the entry fields stay exactly as recorded', () => {
  const after = annotateNumberChangeEntry([entry()], 'NCL-1', 'Customer confirmed on call', '2026-11-07');
  assert.equal(after[0].annotations.length, 1);
  assert.equal(after[0].annotations[0].text, 'Customer confirmed on call');
  assert.equal(after[0].oldNumber, OLD_NUMBER);
  assert.equal(after[0].newNumber, NEW_NUMBER);
  assert.equal(after[0].changeDate, '2026-11-06');
  assert.equal(after[0].recordedBy, 'Saad');
});

test('annotate: an unknown entry id returns the very list passed in', () => {
  const before = [entry()];
  assert.equal(annotateNumberChangeEntry(before, 'NCL-9', 'Note', '2026-11-07'), before);
});

test('annotate: an empty note or a bad note date returns the very list passed in', () => {
  const before = [entry()];
  assert.equal(annotateNumberChangeEntry(before, 'NCL-1', '   ', '2026-11-07'), before);
  assert.equal(annotateNumberChangeEntry(before, 'NCL-1', 'Note', '2025-02-29'), before);
});

test('annotate: a note on one entry leaves the other entries untouched', () => {
  const list = [
    entry(),
    entry({ id: 'NCL-2', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
  ];
  const after = annotateNumberChangeEntry(list, 'NCL-2', 'Second number confirmed', '2026-11-08');
  assert.equal(after[0].annotations.length, 0);
  assert.equal(after[1].annotations.length, 1);
});

// ---------------------------------------------------------------------------
// Per-customer views
// ---------------------------------------------------------------------------

test('changes for a customer: newest first, other customers excluded, id match is case-insensitive', () => {
  const list = [
    entry({ id: 'NCL-1', changeDate: '2026-11-05' }),
    entry({ id: 'NCL-2', customerId: 'CUST-2', oldNumber: OLD_NUMBER_2, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
    entry({ id: 'NCL-3', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
  ];
  assert.deepEqual(numberChangesForCustomer(list, 'cust-1').map(e => e.id), ['NCL-3', 'NCL-1']);
  assert.deepEqual(numberChangesForCustomer(list, ''), []);
  assert.deepEqual(numberChangesForCustomer(list, null), []);
});

test('current number: the latest entry wins; empty when nothing is recorded', () => {
  const list = [
    entry({ id: 'NCL-1', changeDate: '2026-11-05' }),
    entry({ id: 'NCL-3', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
  ];
  assert.equal(currentNumberForCustomer(list, 'CUST-1'), NEW_NUMBER_2);
  assert.equal(currentNumberForCustomer([], 'CUST-1'), '');
  assert.equal(currentNumberForCustomer(list, 'CUST-9'), '');
});

test('number on a date: the latest change on or before that date; empty before the first change', () => {
  const list = [
    entry({ id: 'NCL-1', changeDate: '2026-11-05' }),
    entry({ id: 'NCL-3', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
  ];
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', '2026-11-06'), NEW_NUMBER);
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', '2026-11-07'), NEW_NUMBER_2);
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', '2026-11-30'), NEW_NUMBER_2);
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', '2026-11-04'), '');
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', '2025-02-29'), '');
  assert.equal(numberForCustomerOnDate(list, 'CUST-1', 'not a date'), '');
});

// ---------------------------------------------------------------------------
// Plain-words text
// ---------------------------------------------------------------------------

test('row text: new number, date and old number, with recorded-by when present', () => {
  assert.equal(numberChangeRowText(entry()), `${NEW_NUMBER} — changed 2026-11-06 — from ${OLD_NUMBER} — recorded by Saad`);
  assert.equal(numberChangeRowText(entry({ recordedBy: '' })), `${NEW_NUMBER} — changed 2026-11-06 — from ${OLD_NUMBER}`);
  assert.equal(numberChangeRowText(null), '');
});

test('summary text: none, one, many', () => {
  assert.equal(numberChangeSummaryText([]), 'No number change recorded yet.');
  assert.equal(numberChangeSummaryText([entry()]), '1 number change recorded.');
  assert.equal(numberChangeSummaryText([entry(), entry({ id: 'NCL-2' })]), '2 number changes recorded.');
});

// ---------------------------------------------------------------------------
// Section HTML
// ---------------------------------------------------------------------------

test('section html: the add form carries the old number, new number, date and recorded-by fields', () => {
  const html = numberChangeLogSectionHtml(customer(), []);
  assert.ok(html.includes('id="nclForm"'));
  assert.ok(html.includes('id="nclOldNumber"'));
  assert.ok(html.includes('id="nclNewNumber"'));
  assert.ok(html.includes('id="nclDate"'));
  assert.ok(html.includes('id="nclRecordedBy"'));
  assert.ok(html.includes('No number change recorded yet'));
});

test('section html: the current number comes from the latest change, list newest first', () => {
  const list = [
    entry({ id: 'NCL-1', changeDate: '2026-11-05' }),
    entry({ id: 'NCL-3', oldNumber: NEW_NUMBER, newNumber: NEW_NUMBER_2, changeDate: '2026-11-07' }),
  ];
  const html = numberChangeLogSectionHtml(customer(), list);
  assert.ok(html.includes(`Current number: ${NEW_NUMBER_2}`));
  assert.ok(html.includes('from the latest change on 2026-11-07'));
  assert.ok(html.indexOf(NEW_NUMBER_2) < html.indexOf(NEW_NUMBER));
});

test('section html: recorded-by text is escaped, never raw html', () => {
  const html = numberChangeLogSectionHtml(customer(), [entry({ recordedBy: '<script>alert(1)</script>' })]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('section html: each entry carries an annotate form keyed by its id', () => {
  const html = numberChangeLogSectionHtml(customer(), [entry()]);
  assert.ok(html.includes('data-number-change-annotate="NCL-1"'));
  assert.ok(html.includes('class="ncl-annotate-date"'));
});

test('section html: no customer means no section', () => {
  assert.equal(numberChangeLogSectionHtml(null, []), '');
  assert.equal(numberChangeLogSectionHtml('not a customer', []), '');
});

// ---------------------------------------------------------------------------
// Purity, fences, wiring
// ---------------------------------------------------------------------------

test('purity: the module never touches the page, storage, the clock or the network', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('fences: the module never names the neighbouring preference, move and shift modules', () => {
  // The neighbouring modules were checked by filename first and are
  // neither read nor rewritten here, so this module never names them —
  // each name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const neighbours = [
    'contact' + '-preferences',
    'preference' + '-change',
    'move' + '-transfers',
    'relocation' + '-log',
    'billing' + '-address',
  ];
  for (const name of neighbours) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!readFileSync(fileURLToPath(import.meta.url), 'utf8').includes(name + '.js'), `test must not name ${name}.js`);
  }
});

test('store key: short and in the established style', () => {
  assert.equal(NUMBER_CHANGE_STORE_KEY, 'shahdara_ncl_logs_v1');
});

test('wiring: app.js imports the module, loads and saves the log, and shows the section after the move-history section', () => {
  assert.ok(appSrc.includes("from './number-change-log.js'"));
  assert.ok(appSrc.includes('function loadNumberChangeLog()'));
  assert.ok(appSrc.includes('function saveNumberChangeLog('));
  assert.ok(appSrc.includes('${moveHouseHistorySectionMarkup}${numberChangeLogSectionMarkup}'));
  assert.ok(appSrc.includes("querySelector('#nclForm')"));
  assert.ok(appSrc.includes("querySelector('#nclOldNumber')"));
  assert.ok(appSrc.includes('currentNumberForCustomer(loadNumberChangeLog(), customer.id)'));
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  // Polish #28 Phase A — the profile renders as 7 <details> sections:
  // the strip sits in the assembly above every section, the wada banner
  // opens the Financial section, and the field groups are fragments
  // inside the section bodies. The old flat order (banner → strip →
  // groups) no longer exists; the preserved intent is strip above the
  // sections, banner first in Financial, and each item inside its
  // section — here the number-change log inside History, after the
  // move-house history and before the mohalla record.
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const historyAt = appSrc.indexOf('${profileSectionHistoryHtml}', stripAt);
  assert.ok(stripAt > 0, 'strip is in the profile assembly');
  assert.ok(historyAt > stripAt, 'History section sits after the strip');
  const historyBodyAt = appSrc.indexOf('const profileSectionHistoryBody = ');
  const historyBody = appSrc.slice(historyBodyAt, appSrc.indexOf('\n', historyBodyAt));
  const moveAt = historyBody.indexOf('${moveHouseHistorySectionMarkup}');
  const logAt = historyBody.indexOf('${numberChangeLogSectionMarkup}');
  const mohallaAt = historyBody.indexOf('${mohallaChangeRecordSectionMarkup}');
  assert.ok(moveAt > 0 && logAt > moveAt && mohallaAt > logAt, 'number change log sits after the move-house history and before the mohalla record, inside History');
});

test('styles: the log rules exist and reuse an existing colour only', () => {
  for (const cls of ['.ncl-list', '.ncl-change', '.ncl-form', '.ncl-annotate', '.ncl-current']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const nclLines = stylesSrc.split('\n').filter(line => line.includes('.ncl-'));
  for (const line of nclLines) {
    for (const hex of line.match(/#[0-9a-fA-F]{3,8}/g) ?? []) {
      assert.equal(hex.toLowerCase(), '#5c6e66', `ncl rule must reuse an existing colour, found ${hex}`);
    }
  }
});
