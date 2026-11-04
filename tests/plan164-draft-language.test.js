import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAFT_LANGUAGES,
  normalizeDraftLanguage,
  normalizeDraftLanguageList,
  findDraftLanguage,
  upsertDraftLanguage,
  removeDraftLanguage,
  changeDraftLanguage,
  preferenceFor,
  applyDraftLanguage,
  draftLanguageForCustomer,
  draftLanguageCustomers,
  draftLanguageSummaryText,
  draftLanguageAllHtml,
  draftLanguageCustomerHtml,
  draftLanguageCsv,
  draftLanguageFilename,
} from '../draft-language.js';

const dir = dirname(fileURLToPath(import.meta.url));

const pref = (over = {}) => ({
  id: 'DL-1',
  customer: 'Ahmed',
  draftType: 'greeting',
  language: 'urdu',
  ...over,
});

test('plan164: half-formed preference refused (no customer, type, id, or language)', () => {
  assert.equal(normalizeDraftLanguage(pref({ customer: '  ' })), null);
  assert.equal(normalizeDraftLanguage(pref({ draftType: '' })), null);
  assert.equal(normalizeDraftLanguage(pref({ id: '' })), null);
  assert.equal(normalizeDraftLanguage(pref({ language: '' })), null);
  assert.equal(normalizeDraftLanguage(pref({ language: 'english' })), null);
  assert.equal(normalizeDraftLanguage(null), null);
  assert.equal(normalizeDraftLanguage('nope'), null);
});

test('plan164: language and draft type normalize case-insensitively', () => {
  const record = normalizeDraftLanguage(pref({ language: 'URDU', draftType: ' Greeting ' }));
  assert.equal(record.language, 'urdu');
  assert.equal(record.draftType, 'greeting');
  assert.equal(normalizeDraftLanguage(pref({ language: 'Roman' })).language, 'roman');
});

test('plan164: unknown fields dropped, record keeps exactly four fields', () => {
  const record = normalizeDraftLanguage(pref({ billId: 'B-9', amount: 500, sends: true }));
  assert.deepEqual(Object.keys(record).sort(), ['customer', 'draftType', 'id', 'language']);
});

test('plan164: duplicate id never rewritten', () => {
  const base = upsertDraftLanguage([], pref());
  assert.equal(upsertDraftLanguage(base, pref()).length, 1);
  assert.equal(upsertDraftLanguage(base, pref({ language: 'roman' })).length, 1);
  assert.equal(findDraftLanguage(base, 'DL-1').language, 'urdu');
});

test('plan164: one preference per customer per draft type; other types unaffected', () => {
  const base = upsertDraftLanguage([], pref());
  assert.equal(upsertDraftLanguage(base, pref({ id: 'DL-2', language: 'roman' })).length, 1);
  const grown = upsertDraftLanguage(base, pref({ id: 'DL-2', draftType: 'announcement', language: 'roman' }));
  assert.equal(grown.length, 2);
  assert.equal(preferenceFor(grown, 'Ahmed', 'greeting'), 'urdu');
  assert.equal(preferenceFor(grown, 'Ahmed', 'announcement'), 'roman');
});

test('plan164: find and remove', () => {
  const base = upsertDraftLanguage([], pref());
  assert.equal(findDraftLanguage(base, 'DL-1').customer, 'Ahmed');
  assert.equal(findDraftLanguage(base, 'NOPE'), null);
  assert.equal(removeDraftLanguage(base, 'DL-1').length, 0);
  assert.equal(removeDraftLanguage(base, 'NOPE').length, 1);
});

test('plan164: missing preference falls back to Roman Urdu and never blocks a draft', () => {
  assert.equal(preferenceFor([], 'Ahmed', 'greeting'), 'roman');
  assert.equal(preferenceFor([pref()], 'Ahmed', 'announcement'), 'roman');
  assert.equal(preferenceFor([pref()], 'Bilal', 'greeting'), 'roman');
  assert.equal(preferenceFor([pref()], '', 'greeting'), 'roman');
  assert.equal(preferenceFor([pref()], 'Ahmed', ''), 'roman');
});

test('plan164: preference lookup matches customer and type case-insensitively', () => {
  const base = upsertDraftLanguage([], pref());
  assert.equal(preferenceFor(base, 'AHMED', 'GREETING'), 'urdu');
  assert.equal(preferenceFor(base, 'ahmed', 'greeting'), 'urdu');
});

test('plan164: changing one type leaves all other types unchanged', () => {
  const base = upsertDraftLanguage(
    upsertDraftLanguage([], pref()),
    pref({ id: 'DL-2', draftType: 'announcement', language: 'roman' }),
  );
  const changed = changeDraftLanguage(base, pref({ id: 'DL-3', draftType: 'greeting', language: 'roman' }));
  assert.equal(preferenceFor(changed, 'Ahmed', 'greeting'), 'roman');
  assert.equal(preferenceFor(changed, 'Ahmed', 'announcement'), 'roman');
  assert.equal(changed.length, 2);
  const changedBack = changeDraftLanguage(changed, pref({ id: 'DL-4', draftType: 'greeting', language: 'urdu' }));
  assert.equal(preferenceFor(changedBack, 'Ahmed', 'greeting'), 'urdu');
  assert.equal(preferenceFor(changedBack, 'Ahmed', 'announcement'), 'roman');
});

test('plan164: applyDraftLanguage picks the preferred form, falls back when Urdu text missing', () => {
  const base = upsertDraftLanguage([], pref());
  assert.equal(applyDraftLanguage(base, 'Ahmed', 'greeting', 'Salam Ahmed', 'سلام احمد'), 'سلام احمد');
  assert.equal(applyDraftLanguage([], 'Ahmed', 'greeting', 'Salam Ahmed', 'سلام احمد'), 'Salam Ahmed');
  assert.equal(applyDraftLanguage(base, 'Ahmed', 'greeting', 'Salam Ahmed', ''), 'Salam Ahmed');
  assert.equal(applyDraftLanguage(base, 'Ahmed', 'announcement', 'Nayi package', 'نیا پیکیج'), 'Nayi package');
});

test('plan164: customer view orders types A-Z and matches case-insensitively', () => {
  const base = upsertDraftLanguage(
    upsertDraftLanguage([], pref({ draftType: 'service-change', language: 'roman' })),
    pref({ id: 'DL-2', draftType: 'announcement', language: 'urdu' }),
  );
  const rows = draftLanguageForCustomer(base, 'AHMED');
  assert.deepEqual(rows.map((row) => row.draftType), ['announcement', 'service-change']);
  assert.deepEqual(draftLanguageForCustomer(base, 'Bilal'), []);
});

test('plan164: customers list A-Z keeps first spelling', () => {
  const base = upsertDraftLanguage(
    upsertDraftLanguage([], pref({ customer: 'bilal' })),
    pref({ id: 'DL-2', customer: 'Ahmed', draftType: 'announcement' }),
  );
  assert.deepEqual(draftLanguageCustomers(base), ['Ahmed', 'bilal']);
  const dup = upsertDraftLanguage(base, pref({ id: 'DL-3', customer: 'AHMED', draftType: 'service-change' }));
  assert.deepEqual(draftLanguageCustomers(dup), ['Ahmed', 'bilal']);
});

test('plan164: summary text counts preferences and customers', () => {
  assert.equal(draftLanguageSummaryText([]), '0 draft language preferences for 0 customers');
  const one = upsertDraftLanguage([], pref());
  assert.equal(draftLanguageSummaryText(one), '1 draft language preference for 1 customer');
  const two = upsertDraftLanguage(one, pref({ id: 'DL-2', draftType: 'announcement' }));
  assert.equal(draftLanguageSummaryText(two), '2 draft language preferences for 1 customer');
});

test('plan164: HTML escapes customer and type text', () => {
  const base = upsertDraftLanguage([], pref({ customer: '<b>Ahmed</b>' }));
  const html = draftLanguageAllHtml(base);
  assert.ok(!html.includes('<b>Ahmed</b>'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
  assert.ok(html.includes('Urdu script'));
  assert.ok(draftLanguageAllHtml([]).includes('No draft language preferences'));
  assert.ok(draftLanguageCustomerHtml(base, 'Nobody').includes('fall back to Roman Urdu'));
});

test('plan164: CSV and filename', () => {
  const base = upsertDraftLanguage([], pref({ customer: 'Ahmed, Jr' }));
  const csv = draftLanguageCsv(base);
  assert.ok(csv.startsWith('customer,draft_type,language,id'));
  assert.ok(csv.includes('"Ahmed, Jr",greeting,urdu,DL-1'));
  assert.equal(draftLanguageFilename(), 'draft-language-preferences.csv');
});

test('plan164: inputs never mutated', () => {
  const raw = pref();
  const snapshot = JSON.stringify(raw);
  upsertDraftLanguage([], raw);
  normalizeDraftLanguageList([raw]);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('plan164: normalize list drops invalid, duplicate-id, and pair-clash entries', () => {
  const list = normalizeDraftLanguageList([
    pref(),
    pref({ id: 'DL-1', language: 'roman' }),
    pref({ id: 'DL-2', language: 'roman' }),
    pref({ id: 'DL-3', language: 'bogus' }),
    null,
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].language, 'urdu');
  assert.deepEqual(normalizeDraftLanguageList('nope'), []);
  assert.equal(DRAFT_LANGUAGES.join(','), 'roman,urdu');
});

test('plan164: panel element ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['dlCustomer', 'dlType', 'dlLanguage', 'dlSaveBtn', 'dlRemoveId', 'dlRemoveBtn',
    'dlFilter', 'dlBody', 'dlSummary', 'dlExportBtn', 'dlPreviewCustomer', 'dlPreviewType',
    'dlPreviewRoman', 'dlPreviewUrdu', 'dlPreviewBtn', 'dlPreviewBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
