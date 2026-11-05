import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPreferenceChangeDate,
  normalizePreferenceChangeList,
  recordPreferenceChange,
  removePreferenceChange,
  findPreferenceChange,
  addPreferenceChangeNote,
  preferenceChangeSorted,
  preferenceChangesForCustomer,
  preferenceChangeCustomers,
  preferenceChangeSummaryText,
  preferenceChangeText,
  preferenceChangeHtml,
  preferenceChangeAllHtml,
  preferenceChangeCsv,
  preferenceChangeFilename,
} from '../preference-change.js';

const first = { id: 'PC-1', customer: 'Ahmed Raza', preference: 'WhatsApp number', oldValue: '03001234567', newValue: '03007654321', date: '2026-11-02', operator: 'Saad', note: 'Customer asked at the door.' };
const second = { id: 'PC-2', customer: 'Bilal Ahmed', preference: 'Message language', oldValue: 'Roman Urdu', newValue: 'Urdu script', date: '2026-10-20', operator: 'Owner', note: '' };
const third = { id: 'PC-3', customer: 'Ahmed Raza', preference: 'Do-not-message', oldValue: 'no', newValue: 'yes', date: '2026-11-05', operator: 'Saad', note: 'Customer said not to call.' };

test('half-formed preference change entries are refused', () => {
  assert.deepEqual(recordPreferenceChange([], { ...first, id: '' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, preference: '' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, oldValue: '' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, newValue: '   ' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, date: '' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, date: '2026-02-30' }), []);
  assert.deepEqual(recordPreferenceChange([], { ...first, operator: '' }), []);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validPreferenceChangeDate('2026-08-31'), true);
  assert.equal(validPreferenceChangeDate('2026-10-31'), true);
  assert.equal(validPreferenceChangeDate('2026-12-31'), true);
  assert.equal(validPreferenceChangeDate('2026-02-29'), false);
  assert.equal(validPreferenceChangeDate('2028-02-29'), true);
  assert.equal(validPreferenceChangeDate('2026-04-31'), false);
  assert.equal(validPreferenceChangeDate('2026-13-01'), false);
  assert.equal(validPreferenceChangeDate('10-11-2026'), false);
  assert.equal(validPreferenceChangeDate(''), false);
  assert.equal(validPreferenceChangeDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 500, paymentId: 'P-1', customerStatus: 'changed' };
  const recorded = recordPreferenceChange([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('paymentId' in recorded[0], false);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal(recorded[0].oldValue, '03001234567');
  assert.equal(recorded[0].newValue, '03007654321');
  assert.deepEqual(recorded[0].followups, []);
  const before = JSON.stringify(first);
  recordPreferenceChange([], first);
  assert.equal(JSON.stringify(first), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordPreferenceChange([], first);
  assert.deepEqual(recordPreferenceChange(list, { ...first, date: '2026-11-09' }), list);
  assert.deepEqual(recordPreferenceChange(list, { ...second, id: 'PC-1' }), list);
  const later = recordPreferenceChange(list, third);
  assert.equal(later.length, 2);
});

test('find and remove work by id', () => {
  const list = [first, second].reduce((acc, item) => recordPreferenceChange(acc, item), []);
  assert.equal(findPreferenceChange(list, 'PC-2').customer, 'Bilal Ahmed');
  assert.equal(findPreferenceChange(list, 'PC-9'), null);
  assert.equal(findPreferenceChange(list, ''), null);
  assert.deepEqual(removePreferenceChange(list, 'PC-1').map((item) => item.id), ['PC-2']);
  assert.deepEqual(removePreferenceChange(list, 'PC-9'), list);
});

test('a customer page lists changes newest first', () => {
  const list = [first, third, second].reduce((acc, item) => recordPreferenceChange(acc, item), []);
  assert.deepEqual(preferenceChangeSorted(list).map((item) => item.id), ['PC-3', 'PC-1', 'PC-2']);
  assert.deepEqual(preferenceChangesForCustomer(list, 'AHMED RAZA').map((item) => item.id), ['PC-3', 'PC-1']);
  assert.deepEqual(preferenceChangesForCustomer(list, ''), []);
  assert.deepEqual(preferenceChangeCustomers(list), ['Ahmed Raza', 'Bilal Ahmed']);
});

test('a change entry is never edited, only annotated with dated follow-ups', () => {
  const list = recordPreferenceChange([], first);
  const noted = addPreferenceChangeNote(list, 'PC-1', '2026-11-08', 'Customer confirmed the new number works.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].followups[0].date, '2026-11-08');
  assert.equal(noted[0].customer, 'Ahmed Raza');
  assert.equal(noted[0].preference, 'WhatsApp number');
  assert.equal(noted[0].oldValue, '03001234567');
  assert.equal(noted[0].newValue, '03007654321');
  assert.equal(noted[0].date, '2026-11-02');
  assert.equal(noted[0].operator, 'Saad');
  assert.equal(noted[0].note, 'Customer asked at the door.');
  assert.deepEqual(addPreferenceChangeNote(list, 'PC-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addPreferenceChangeNote(list, 'PC-1', '2026-11-08', ''), list);
  assert.deepEqual(addPreferenceChangeNote(list, 'PC-9', '2026-11-08', 'Unknown entry.'), list);
});

test('summary and entry text name old and new values', () => {
  assert.equal(preferenceChangeSummaryText([]), 'No preference changes recorded.');
  const list = [first, second].reduce((acc, item) => recordPreferenceChange(acc, item), []);
  assert.equal(preferenceChangeSummaryText(list), '2 preference changes for 2 customers.');
  const text = preferenceChangeText(first);
  assert.equal(text.includes('Ahmed Raza — WhatsApp number changed from 03001234567 to 03007654321 on 2026-11-02, recorded by Saad.'), true);
  assert.equal(text.includes('Note: Customer asked at the door.'), true);
  assert.equal(preferenceChangeText(second).includes('Bilal Ahmed — Message language changed from Roman Urdu to Urdu script on 2026-10-20, recorded by Owner.'), true);
  assert.equal(preferenceChangeText(null), 'No preference change recorded.');
  const noted = addPreferenceChangeNote(list, 'PC-1', '2026-11-08', 'Customer confirmed the new number works.');
  assert.equal(preferenceChangeText(noted[0]).includes('Follow-ups: 2026-11-08: Customer confirmed the new number works.'), true);
});

test('HTML escapes markup and the all-list renders newest first', () => {
  const nasty = { ...first, id: 'PC-9', customer: 'Bad <script> Customer', preference: 'Message language', oldValue: 'Roman Urdu', newValue: 'Urdu script', date: '2026-11-03', operator: 'Saad', note: 'Fixed & tested' };
  const html = preferenceChangeHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Fixed &amp; tested'), true);
  assert.equal(preferenceChangeHtml(null), '<p>No preference change recorded.</p>');
  assert.equal(preferenceChangeAllHtml([]), '<p>No preference changes recorded.</p>');
  const all = preferenceChangeAllHtml([first, second]);
  assert.equal(all.indexOf('Ahmed Raza') < all.indexOf('Bilal Ahmed'), true);
});

test('CSV export has the change columns in order', () => {
  const list = [first, second, third].reduce((acc, item) => recordPreferenceChange(acc, item), []);
  const csv = preferenceChangeCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","preference","old value","new value","date","operator","note","follow-ups"');
  assert.equal(lines[1].includes('"Ahmed Raza"'), true);
  assert.equal(lines[1].includes('"Do-not-message"'), true);
  assert.equal(lines[2].includes('"03001234567"'), true);
  assert.equal(lines[2].includes('"03007654321"'), true);
  assert.equal(lines[3].includes('"Bilal Ahmed"'), true);
  assert.equal(preferenceChangeFilename(), 'preference-changes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, date: '2026-11-09' }, { id: 'PC-9' }, null, 'nope', second];
  assert.deepEqual(normalizePreferenceChangeList(messy).map((item) => item.id), ['PC-1', 'PC-2']);
  assert.deepEqual(normalizePreferenceChangeList('not a list'), []);
  assert.deepEqual(normalizePreferenceChangeList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../preference-change.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the preference records are untouched', () => {
  const source = readFileSync(new URL('../preference-change.js', import.meta.url), 'utf8');
  assert.equal(source.includes('contact-preferences'), false, 'module must not reference the contact preferences record module');
  assert.equal(source.includes('draft-language'), false, 'module must not reference the language preference per draft type module');
  assert.equal(existsSync(new URL('../contact-preferences.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../draft-language.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'pcHeading', 'pcSummary', 'pcList', 'pcExportBtn',
    'pcCustomer', 'pcPreference', 'pcOldValue', 'pcNewValue', 'pcDate', 'pcOperator', 'pcNote', 'pcRecordBtn',
    'pcAnnotateId', 'pcAnnotateDate', 'pcAnnotateNote', 'pcAnnotateBtn',
    'pcRemoveId', 'pcRemoveBtn',
    'pcFilterCustomer', 'pcFilterBtn', 'pcFilterBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the customer preference change log panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './preference-change.js'"), true);
  assert.equal(source.includes('renderPreferenceChanges()'), true);
  assert.equal(source.includes('PREFERENCE_CHANGE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
