import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validVisitLanguageDate,
  normalizeVisitLanguage,
  normalizeVisitLanguageList,
  recordVisitLanguage,
  removeVisitLanguage,
  findVisitLanguage,
  visitLanguageSorted,
  visitLanguagesForCustomer,
  latestVisitLanguage,
  visitLanguageCustomers,
  visitLanguagesObserved,
  visitLanguageSummaryText,
  visitLanguageText,
  visitLanguageHtml,
  visitLanguageAllHtml,
  visitLanguageCsv,
  visitLanguageFilename,
} from '../visit-language.js';

const first = { id: 'VL-1', customer: 'Ahmed Raza', visitDate: '2026-11-08', language: 'Punjabi', note: 'Speaks Punjabi at the door, understands Urdu.' };
const second = { id: 'VL-2', customer: 'Ahmed Raza', visitDate: '2026-11-10', language: 'Urdu', note: '' };
const third = { id: 'VL-3', customer: 'Bilal Khan', visitDate: '2026-11-09', language: 'Saraiki', note: 'Prefers Saraiki, slow Urdu.' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordVisitLanguage([], { ...first, id: '' }), []);
  assert.deepEqual(recordVisitLanguage([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordVisitLanguage([], { ...first, visitDate: '' }), []);
  assert.deepEqual(recordVisitLanguage([], { ...first, language: '' }), []);
  assert.deepEqual(recordVisitLanguage([], { ...first, language: '   ' }), []);
  const recorded = recordVisitLanguage([], { ...first, note: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].note, '');
  const recordedNoNote = recordVisitLanguage([], { id: 'VL-9', customer: 'Sara Bibi', visitDate: '2026-11-11', language: 'Punjabi' });
  assert.equal(recordedNoNote.length, 1);
  assert.equal(recordedNoNote[0].note, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validVisitLanguageDate('2026-08-31'), true);
  assert.equal(validVisitLanguageDate('2026-10-31'), true);
  assert.equal(validVisitLanguageDate('2026-12-31'), true);
  assert.equal(validVisitLanguageDate('2026-02-29'), false);
  assert.equal(validVisitLanguageDate('2028-02-29'), true);
  assert.equal(validVisitLanguageDate('2026-04-31'), false);
  assert.equal(validVisitLanguageDate('2026-13-01'), false);
  assert.equal(validVisitLanguageDate('10-11-2026'), false);
  assert.equal(validVisitLanguageDate(''), false);
  assert.equal(validVisitLanguageDate(null), false);
  assert.deepEqual(recordVisitLanguage([], { ...first, visitDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, draftPreference: 'Urdu script', billAmount: 1500, surprise: 'x' };
  const recorded = recordVisitLanguage([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('draftPreference' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.draftPreference, 'Urdu script');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'draftPreference', 'id', 'language', 'note', 'surprise', 'visitDate']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordVisitLanguage([], first);
  assert.deepEqual(recordVisitLanguage(list, { ...first, language: 'Changed.' }), list);
  assert.deepEqual(recordVisitLanguage(list, { ...second, id: 'VL-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordVisitLanguage(acc, item), []);
  assert.equal(findVisitLanguage(list, 'VL-2').customer, 'Ahmed Raza');
  assert.equal(findVisitLanguage(list, 'VL-9'), null);
  assert.equal(findVisitLanguage(list, ''), null);
  assert.deepEqual(removeVisitLanguage(list, 'VL-2').map((item) => item.id), ['VL-1', 'VL-3']);
  assert.deepEqual(removeVisitLanguage(list, ''), list);
});

test('a customer page shows language notes newest first', () => {
  const list = [second, first, third].reduce((acc, item) => recordVisitLanguage(acc, item), []);
  assert.deepEqual(visitLanguagesForCustomer(list, 'ahmed raza').map((item) => item.id), ['VL-2', 'VL-1']);
  assert.deepEqual(visitLanguagesForCustomer(list, 'Bilal Khan').map((item) => item.id), ['VL-3']);
  assert.deepEqual(visitLanguagesForCustomer(list, ''), []);
  assert.deepEqual(visitLanguagesForCustomer(list, 'Nobody'), []);
  assert.deepEqual(visitLanguageSorted(list).map((item) => item.id), ['VL-1', 'VL-3', 'VL-2']);
});

test('the latest note is surfaced for the visit view', () => {
  const list = [first, second, third].reduce((acc, item) => recordVisitLanguage(acc, item), []);
  assert.equal(latestVisitLanguage(list, 'Ahmed Raza').id, 'VL-2');
  assert.equal(latestVisitLanguage(list, 'Ahmed Raza').language, 'Urdu');
  assert.equal(latestVisitLanguage(list, 'Bilal Khan').id, 'VL-3');
  assert.equal(latestVisitLanguage(list, 'Sara Bibi'), null);
  assert.equal(latestVisitLanguage(list, ''), null);
});

test('customer and language lists keep the first spelling', () => {
  const list = [
    { id: 'VL-1', customer: 'Ahmed Raza', visitDate: '2026-11-08', language: 'Punjabi' },
    { id: 'VL-2', customer: 'AHMED RAZA', visitDate: '2026-11-09', language: 'punjabi' },
    { id: 'VL-3', customer: 'Bilal Khan', visitDate: '2026-11-09', language: 'Saraiki' },
  ].reduce((acc, item) => recordVisitLanguage(acc, item), []);
  assert.deepEqual(visitLanguageCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
  assert.deepEqual(visitLanguagesObserved(list), ['Punjabi', 'Saraiki']);
});

test('summary and entry text name the customer, date, and language plainly', () => {
  assert.equal(visitLanguageSummaryText([]), 'No visit language notes recorded.');
  assert.equal(visitLanguageSummaryText([first, second]), '2 visit language notes recorded, covering 2 languages observed.');
  assert.equal(visitLanguageSummaryText([first]), '1 visit language note recorded, covering 1 language observed.');
  const text = visitLanguageText(first);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('Punjabi'), true);
  assert.equal(text.includes('Speaks Punjabi at the door'), true);
  assert.equal(visitLanguageText(second).includes('Speaks Punjabi'), false);
  assert.equal(visitLanguageText(null), 'No visit language note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, language: '<script>alert(1)</script>' };
  const html = visitLanguageHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(visitLanguageHtml(null), '<p>No visit language note recorded.</p>');
  assert.equal(visitLanguageAllHtml([]), '<p>No visit language notes recorded.</p>');
  assert.equal(visitLanguageAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = visitLanguageCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","visit date","language","note"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('VL-1'), true);
  assert.equal(lines[1].includes('Punjabi'), true);
  assert.equal(visitLanguageFilename(), 'visit-language-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'VL-9', customer: '', visitDate: '2026-11-10', language: 'No customer.' };
  const out = normalizeVisitLanguageList([bad, first, { ...first, language: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['VL-1', 'VL-2']);
  assert.equal(out[0].language, first.language);
  assert.deepEqual(normalizeVisitLanguageList('nope'), []);
  assert.deepEqual(normalizeVisitLanguageList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../visit-language.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the draft-type language preference record is untouched', () => {
  const source = readFileSync(new URL('../visit-language.js', import.meta.url), 'utf8');
  assert.equal(source.includes('draft-language.js'), false, 'module must not reference the draft-type language preference module');
  assert.equal(existsSync(new URL('../draft-language.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'vgHeading', 'vgSummary', 'vgList', 'vgExportBtn',
    'vgCustomer', 'vgDate', 'vgLanguage', 'vgNote', 'vgRecordBtn',
    'vgRemoveId', 'vgRemoveBtn',
    'vgFilterCustomer', 'vgFilterBtn', 'vgCustomerBody',
    'vgLatestCustomer', 'vgLatestBtn', 'vgLatestBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the visit language panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './visit-language.js'"), true);
  assert.equal(source.includes('renderVisitLanguages()'), true);
  assert.equal(source.includes('VISIT_LANGUAGE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
