import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREFERRED_COLLECTION_DAY_STORE_KEY,
  PREFERRED_COLLECTION_DAY_REASON_MAX_LENGTH,
  PREFERRED_COLLECTION_DAY_BY_MAX_LENGTH,
  PREFERRED_COLLECTION_DAY_KIND_WEEKDAY,
  PREFERRED_COLLECTION_DAY_KIND_DAY_OF_MONTH,
  PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES,
  isStrictPreferredCollectionDayDate,
  preferredCollectionDayOrdinal,
  normalizePreferredCollectionDay,
  normalizePreferredCollectionDayList,
  loadPreferredCollectionDayList,
  recordPreferredCollectionDay,
  removePreferredCollectionDay,
  preferredCollectionDayForCustomer,
  hasPreferredCollectionDay,
  preferredCollectionDaySummaryText,
  preferredCollectionDayText,
  preferredCollectionDaySectionHtml,
  preferredCollectionDayLineHtml,
} from '../preferred-collection-day.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'preferred-collection-day.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan365-preferred-collection-day.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const roundsSrc = readFileSync(join(dir, '..', 'nav-collection-rounds.js'), 'utf8');

const weekdayNote = {
  id: 'PCD-1', customerId: 'CUST-1', kind: 'weekday', weekday: 6, dayOfMonth: null,
  reason: 'Salary day', notedBy: 'Saad', notedDate: '2026-11-06',
};
const monthNote = {
  id: 'PCD-2', customerId: 'CUST-2', kind: 'dayOfMonth', weekday: null, dayOfMonth: 7,
  reason: 'Pension day', notedBy: '', notedDate: '',
};

test('Plan 365: the store key is short and names the note, not the schedule', () => {
  assert.equal(PREFERRED_COLLECTION_DAY_STORE_KEY, 'shahdara_pcd_notes_v1');
});

test('Plan 365: a weekday note normalizes with its weekday kept', () => {
  const note = normalizePreferredCollectionDay(weekdayNote);
  assert.deepEqual(note, weekdayNote);
});

test('Plan 365: a date-of-month note normalizes with its date kept', () => {
  const note = normalizePreferredCollectionDay(monthNote);
  assert.deepEqual(note, monthNote);
});

test('Plan 365: normalize refuses a note with no id, no customer, or no reason', () => {
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, id: '' }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, customerId: '  ' }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, reason: '   ' }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, kind: 'anytime' }), null);
  assert.equal(normalizePreferredCollectionDay(null), null);
  assert.equal(normalizePreferredCollectionDay('Saturday'), null);
});

test('Plan 365: normalize refuses a weekday outside 0-6 and a date outside 1-31', () => {
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, weekday: 7 }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, weekday: -1 }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, weekday: 'Saturday' }), null);
  assert.equal(normalizePreferredCollectionDay({ ...monthNote, dayOfMonth: 0 }), null);
  assert.equal(normalizePreferredCollectionDay({ ...monthNote, dayOfMonth: 32 }), null);
  assert.equal(normalizePreferredCollectionDay({ ...monthNote, dayOfMonth: 7.5 }), null);
  assert.equal(normalizePreferredCollectionDay({ ...monthNote, dayOfMonth: '7th' }), null);
});

test('Plan 365: strict dates are leap-aware', () => {
  assert.equal(isStrictPreferredCollectionDayDate('2024-02-29'), true);
  assert.equal(isStrictPreferredCollectionDayDate('2026-02-29'), false);
  assert.equal(isStrictPreferredCollectionDayDate('2026-02-30'), false);
  assert.equal(isStrictPreferredCollectionDayDate('2026-11-06'), true);
  assert.equal(isStrictPreferredCollectionDayDate('2026-13-01'), false);
  assert.equal(isStrictPreferredCollectionDayDate('06-11-2026'), false);
  assert.equal(isStrictPreferredCollectionDayDate(''), false);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, notedDate: '2026-02-30' }), null);
  assert.equal(normalizePreferredCollectionDay({ ...weekdayNote, notedDate: '' }).notedDate, '');
});

test('Plan 365: reason and noted-by are trimmed and capped', () => {
  assert.equal(PREFERRED_COLLECTION_DAY_REASON_MAX_LENGTH, 120);
  assert.equal(PREFERRED_COLLECTION_DAY_BY_MAX_LENGTH, 60);
  const note = normalizePreferredCollectionDay({ ...weekdayNote, reason: `  ${'r'.repeat(200)}  `, notedBy: `  ${'b'.repeat(90)}  ` });
  assert.equal(note.reason.length, 120);
  assert.equal(note.notedBy.length, 60);
});

test('Plan 365: ordinals read like plain words', () => {
  assert.equal(preferredCollectionDayOrdinal(1), '1st');
  assert.equal(preferredCollectionDayOrdinal(2), '2nd');
  assert.equal(preferredCollectionDayOrdinal(3), '3rd');
  assert.equal(preferredCollectionDayOrdinal(4), '4th');
  assert.equal(preferredCollectionDayOrdinal(11), '11th');
  assert.equal(preferredCollectionDayOrdinal(12), '12th');
  assert.equal(preferredCollectionDayOrdinal(13), '13th');
  assert.equal(preferredCollectionDayOrdinal(21), '21st');
  assert.equal(preferredCollectionDayOrdinal(22), '22nd');
  assert.equal(preferredCollectionDayOrdinal(23), '23rd');
  assert.equal(preferredCollectionDayOrdinal(31), '31st');
  assert.equal(preferredCollectionDayOrdinal(0), '');
  assert.equal(preferredCollectionDayOrdinal(32), '');
});

test('Plan 365: the list keeps one note per customer, case-insensitively', () => {
  const list = normalizePreferredCollectionDayList([
    weekdayNote,
    { ...weekdayNote, id: 'PCD-9', reason: 'Later note wins' },
    { ...weekdayNote, id: 'pcd-1' },
    { ...monthNote, customerId: 'cust-1' },
    { ...monthNote, id: '' },
    null,
  ]);
  // Normalize keeps the FIRST valid entry per customer and per id;
  // replacement is recordPreferredCollectionDay's job (tested below).
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'PCD-1');
  assert.equal(list[0].reason, 'Salary day');
});

test('Plan 365: recording replaces in place for the same customer', () => {
  const after = recordPreferredCollectionDay([weekdayNote], { ...weekdayNote, id: 'PCD-3', reason: 'Moved to Saturday' });
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'PCD-3');
  assert.equal(after[0].reason, 'Moved to Saturday');
  const other = recordPreferredCollectionDay([weekdayNote], monthNote);
  assert.equal(other.length, 2);
  const refused = recordPreferredCollectionDay([weekdayNote], { ...weekdayNote, reason: '' });
  assert.deepEqual(refused, [weekdayNote]);
});

test('Plan 365: removing takes only that customer', () => {
  const list = [weekdayNote, monthNote];
  assert.deepEqual(removePreferredCollectionDay(list, 'cust-1'), [monthNote]);
  assert.deepEqual(removePreferredCollectionDay(list, 'CUST-9'), list);
  assert.deepEqual(removePreferredCollectionDay(list, ''), list);
});

test('Plan 365: lookup is case-insensitive and empty for a customer without a note', () => {
  assert.deepEqual(preferredCollectionDayForCustomer([weekdayNote], 'cust-1'), weekdayNote);
  assert.equal(preferredCollectionDayForCustomer([weekdayNote], 'CUST-9'), null);
  assert.equal(preferredCollectionDayForCustomer([weekdayNote], ''), null);
  assert.equal(hasPreferredCollectionDay([weekdayNote], 'CUST-1'), true);
  assert.equal(hasPreferredCollectionDay([], 'CUST-1'), false);
});

test('Plan 365: summary counts in plain words', () => {
  assert.equal(preferredCollectionDaySummaryText([]), 'No preferred collection day recorded.');
  assert.equal(preferredCollectionDaySummaryText([weekdayNote]), '1 customer has a preferred collection day.');
  assert.equal(preferredCollectionDaySummaryText([weekdayNote, monthNote]), '2 customers have a preferred collection day.');
});

test('Plan 365: the note reads in plain words', () => {
  assert.equal(preferredCollectionDayText(weekdayNote), 'Every Saturday — Salary day');
  assert.equal(preferredCollectionDayText(monthNote), 'On the 7th of each month — Pension day');
  assert.equal(preferredCollectionDayText({ ...monthNote, dayOfMonth: 1 }), 'On the 1st of each month — Pension day');
  assert.equal(preferredCollectionDayText({ ...monthNote, dayOfMonth: 22 }), 'On the 22nd of each month — Pension day');
  assert.equal(preferredCollectionDayText(null), '');
  assert.equal(preferredCollectionDayText({ ...weekdayNote, weekday: 9 }), '');
});

test('Plan 365: weekday names can be overridden, seven names Sunday first', () => {
  const urdu = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
  assert.equal(preferredCollectionDayText(weekdayNote, urdu), 'Every ہفتہ — Salary day');
  assert.equal(preferredCollectionDayText(weekdayNote, ['Only']), 'Every Saturday — Salary day');
  assert.equal(PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES.length, 7);
  assert.equal(PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES[0], 'Sunday');
  assert.equal(PREFERRED_COLLECTION_DAY_WEEKDAY_NAMES[6], 'Saturday');
});

test('Plan 365: the section shows the note and the edit form', () => {
  const html = preferredCollectionDaySectionHtml({ id: 'CUST-1' }, [weekdayNote], {});
  assert.ok(html.includes('Every Saturday — Salary day'));
  assert.ok(html.includes('id="pcdForm"'));
  assert.ok(html.includes('id="pcdKind"'));
  assert.ok(html.includes('id="pcdWeekday"'));
  assert.ok(html.includes('id="pcdDayOfMonth"'));
  assert.ok(html.includes('id="pcdReason"'));
  assert.ok(html.includes('id="pcdRemoveBtn"'));
  assert.ok(html.includes('<option value="6" selected>Saturday</option>'));
  const empty = preferredCollectionDaySectionHtml({ id: 'CUST-9' }, [weekdayNote], {});
  assert.ok(empty.includes('No preferred collection day recorded for this customer.'));
  assert.ok(!empty.includes('id="pcdRemoveBtn"'));
  assert.equal(preferredCollectionDaySectionHtml(null, []), '');
});

test('Plan 365: the section escapes user-entered text', () => {
  const evil = { ...weekdayNote, reason: '<script>alert(1)</script>', notedBy: 'A & B' };
  const html = preferredCollectionDaySectionHtml({ id: 'CUST-1' }, [evil], {});
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('Plan 365: the round-list line shows the note and nothing when there is none', () => {
  const line = preferredCollectionDayLineHtml(weekdayNote);
  assert.ok(line.includes('pcd-route-line'));
  assert.ok(line.includes('Prefers: Every Saturday — Salary day'));
  assert.equal(preferredCollectionDayLineHtml(null), '');
  assert.equal(preferredCollectionDayLineHtml({ ...weekdayNote, reason: '' }), '');
  const escaped = preferredCollectionDayLineHtml({ ...weekdayNote, reason: '<b>bold</b>' });
  assert.ok(!escaped.includes('<b>bold</b>'));
});

test('Plan 365: loading reads a storage-like object and never throws', () => {
  const storage = { getItem: (key) => (key === PREFERRED_COLLECTION_DAY_STORE_KEY ? JSON.stringify([weekdayNote]) : null) };
  assert.deepEqual(loadPreferredCollectionDayList(storage), [weekdayNote]);
  assert.deepEqual(loadPreferredCollectionDayList(null), []);
  assert.deepEqual(loadPreferredCollectionDayList(undefined), []);
  assert.deepEqual(loadPreferredCollectionDayList({ getItem: () => '{bad json' }), []);
  assert.deepEqual(loadPreferredCollectionDayList({ getItem: () => { throw new Error('no store'); } }), []);
});

test('Plan 365: the module is pure — no page, clock, network, or storage reads', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!moduleSrc.includes('dueDate'), 'the note sets no due date');
  assert.ok(!moduleSrc.includes('preferredVisitWindow'), 'the note sets no visit time window');
});

test('Plan 365: fences — the module and this test never name the fenced modules literally', () => {
  const fenced = [
    'due-date-shift' + '.js',
    'visit-window' + '.js',
    'visit-time-window' + '.js',
    'payment-day-advisor' + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('wiring: app.js imports the module and wires load/save plus the profile section', () => {
  assert.ok(appSrc.includes("from './preferred-collection-day.js'"));
  assert.ok(appSrc.includes('PREFERRED_COLLECTION_DAY_STORE_KEY'));
  assert.ok(appSrc.includes('function loadPreferredCollectionDayNotes()'));
  assert.ok(appSrc.includes('function savePreferredCollectionDayNotes('));
  assert.ok(appSrc.includes('preferredCollectionDaySectionHtml('));
  // Polish #28 Phase A — the collection-day note appends last inside
  // the Customer section; the old anchor chained off the history list,
  // which now lives in History.
  assert.ok(appSrc.includes("querySelector('[data-profile-section=\"customer\"] .profile-section-body')?.insertAdjacentHTML('beforeend', preferredCollectionDaySectionHtml("), 'collection day appends into the Customer section body');
  assert.ok(!appSrc.includes("querySelector('.profile-field-change-history')"), 'collection day no longer anchors on the history list');
  assert.ok(appSrc.includes("querySelector('.profile-preferred-collection-day')"));
  assert.ok(appSrc.includes("querySelector('#pcdForm')"));
  assert.ok(appSrc.includes("querySelector('#pcdRemoveBtn')"));
  assert.ok(appSrc.includes('recordPreferredCollectionDay('));
  assert.ok(appSrc.includes('removePreferredCollectionDay('));
});

test('wiring: the round list shows the note beside the customer', () => {
  assert.ok(roundsSrc.includes("from './preferred-collection-day.js'"));
  assert.ok(roundsSrc.includes('loadPreferredCollectionDayList('));
  assert.ok(roundsSrc.includes('preferredCollectionDayLineHtml('));
  assert.ok(roundsSrc.includes('preferredCollectionDayForCustomer('));
  assert.ok(roundsSrc.includes('preferredDayInfo'));
});

test('wiring: language keys exist in both tables', () => {
  for (const key of [
    'prof_pcd_heading', 'prof_pcd_intro', 'prof_pcd_none', 'prof_pcd_kind',
    'prof_pcd_kind_weekday', 'prof_pcd_kind_day_of_month', 'prof_pcd_weekday',
    'prof_pcd_day_of_month', 'prof_pcd_reason', 'prof_pcd_reason_placeholder',
    'prof_pcd_noted_by', 'prof_pcd_date', 'prof_pcd_remove',
  ]) {
    assert.ok(langSrc.includes(key), `${key} is present`);
  }
});

test('styles: the preferred-day rules reuse existing colours only — no new hex colour', () => {
  const baselineHex = new Set((stylesSrc.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((hex) => hex.toLowerCase()));
  const stripped = stylesSrc.replace(/\.pcd-[^{]+\{[^}]*\}|\.profile-preferred-collection-day[^{]*\{[^}]*\}/g, '');
  const strippedHex = new Set((stripped.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((hex) => hex.toLowerCase()));
  assert.ok(stylesSrc.includes('.pcd-section'));
  assert.ok(stylesSrc.includes('.pcd-route-line'));
  assert.ok(stylesSrc.includes('.pcd-form'));
  const newHex = [...baselineHex].filter((hex) => !strippedHex.has(hex));
  assert.deepEqual(newHex, []);
});
