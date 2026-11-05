import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPartnershipNoteDate,
  normalizePartnershipNote,
  normalizePartnershipNoteList,
  findPartnershipNote,
  recordPartnershipNote,
  removePartnershipNote,
  partnershipNotesSorted,
  partnershipNotesForPartner,
  partnershipPartners,
  partnershipNoteSummaryText,
  partnershipNoteEntryText,
  partnershipNoteEntryHtml,
  partnershipNoteAllHtml,
  partnershipNotesForPartnerHtml,
  partnershipNoteCsv,
  partnershipNoteFilename,
} from '../partnership-note.js';

const first = {
  id: 'PN-1',
  partner: 'Corner Shop',
  type: 'Payment collection point',
  terms: 'Takes cash payments and hands over a daily slip',
  startDate: '2026-10-01',
  contact: '03001234567',
  recordedBy: 'Owner',
};
const second = {
  id: 'PN-2',
  partner: 'Raja Mobile',
  type: 'Referral agent',
  terms: 'Refers new customers from his street',
  startDate: '2026-10-15',
  contact: '03007654321',
  recordedBy: 'Owner',
};
const third = {
  id: 'PN-3',
  partner: 'corner shop',
  type: 'Payment collection point',
  terms: 'Second counter in the same shop',
  startDate: '2026-11-02',
  contact: '03001234567',
  recordedBy: 'Saad',
};
const fourth = {
  id: 'PN-4',
  partner: 'Bilal Store',
  type: 'Payment collection point',
  terms: 'Takes cash on Sundays only',
  startDate: '2026-10-15',
  contact: '03001112222',
  recordedBy: 'Owner',
};

test('strict dates: real calendar days only', () => {
  assert.equal(validPartnershipNoteDate('2026-10-01'), true);
  assert.equal(validPartnershipNoteDate('2024-02-29'), true);
  assert.equal(validPartnershipNoteDate('2026-02-29'), false);
  assert.equal(validPartnershipNoteDate('2026-04-31'), false);
  assert.equal(validPartnershipNoteDate('2026-13-01'), false);
  assert.equal(validPartnershipNoteDate('2026-10-1'), false);
  assert.equal(validPartnershipNoteDate('01-10-2026'), false);
  assert.equal(validPartnershipNoteDate(''), false);
  assert.equal(validPartnershipNoteDate(null), false);
  assert.equal(validPartnershipNoteDate(20261001), false);
});

test('half-formed refusal: every field is needed', () => {
  assert.equal(normalizePartnershipNote(null), null);
  assert.equal(normalizePartnershipNote('not an object'), null);
  assert.equal(normalizePartnershipNote([]), null);
  assert.equal(normalizePartnershipNote({ ...first, id: '' }), null);
  assert.equal(normalizePartnershipNote({ ...first, partner: '   ' }), null);
  assert.equal(normalizePartnershipNote({ ...first, type: '' }), null);
  assert.equal(normalizePartnershipNote({ ...first, terms: '' }), null);
  assert.equal(normalizePartnershipNote({ ...first, startDate: '2026-02-29' }), null);
  assert.equal(normalizePartnershipNote({ ...first, contact: '' }), null);
  assert.equal(normalizePartnershipNote({ ...first, recordedBy: '' }), null);
  assert.deepEqual(normalizePartnershipNote(first), first);
});

test('unknown fields are dropped and the input is never mutated', () => {
  const raw = { ...first, bill: 3000, payment: 'cash', customer: 'Someone', staff: 'Saad', extra: 'nope' };
  const before = JSON.stringify(raw);
  const clean = normalizePartnershipNote(raw);
  assert.deepEqual(clean, first);
  assert.equal(JSON.stringify(raw), before);
  assert.equal('bill' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('customer' in clean, false);
  assert.equal('staff' in clean, false);
});

test('duplicate id is never rewritten: the first note stays', () => {
  const list = recordPartnershipNote([], first);
  const again = recordPartnershipNote(list, { ...first, terms: 'Changed terms' });
  assert.equal(again.length, 1);
  assert.equal(again[0].terms, first.terms);
  assert.deepEqual(normalizePartnershipNoteList([first, { ...first, terms: 'Changed terms' }]), [first]);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.deepEqual(findPartnershipNote(list, 'PN-2'), second);
  assert.equal(findPartnershipNote(list, 'PN-9'), null);
  assert.equal(findPartnershipNote(list, ''), null);
  assert.deepEqual(removePartnershipNote(list, 'PN-2'), [first, third]);
  assert.deepEqual(removePartnershipNote(list, 'PN-9'), [first, second, third]);
  assert.deepEqual(removePartnershipNote(list, ''), [first, second, third]);
});

test('sorting: start date, then partner, then id', () => {
  const sorted = partnershipNotesSorted([third, second, fourth, first]);
  assert.deepEqual(sorted.map((note) => note.id), ['PN-1', 'PN-4', 'PN-2', 'PN-3']);
});

test('per-partner listing and first-spelling list', () => {
  const list = [first, second, third, fourth];
  assert.deepEqual(partnershipNotesForPartner(list, 'CORNER SHOP').map((note) => note.id), ['PN-1', 'PN-3']);
  assert.deepEqual(partnershipNotesForPartner(list, 'No Such Partner'), []);
  assert.deepEqual(partnershipNotesForPartner(list, ''), []);
  assert.deepEqual(partnershipPartners(list), ['Bilal Store', 'Corner Shop', 'Raja Mobile']);
  assert.deepEqual(partnershipPartners([]), []);
});

test('entry text names the partner, type, terms, date, contact and recorder', () => {
  assert.equal(
    partnershipNoteEntryText(first),
    'Corner Shop (Payment collection point) — from 2026-10-01; terms: Takes cash payments and hands over a daily slip; contact 03001234567; recorded by Owner.',
  );
  assert.equal(partnershipNoteEntryText({ ...first, terms: '' }), '');
});

test('summary text names the count, the partners, and the latest note', () => {
  assert.equal(partnershipNoteSummaryText([]), 'No partnership notes recorded.');
  assert.equal(
    partnershipNoteSummaryText([first]),
    '1 partnership with 1 partner. Latest: Corner Shop (Payment collection point) from 2026-10-01.',
  );
  assert.equal(
    partnershipNoteSummaryText([first, second, third, fourth]),
    '4 partnerships with 3 partners. Latest: corner shop (Payment collection point) from 2026-11-02.',
  );
});

test('HTML is escaped so user-entered text cannot break the page', () => {
  const nasty = { ...first, partner: '<b>Shop</b> & Sons', terms: 'Pay "on time" <always>' };
  const html = partnershipNoteEntryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;Shop&lt;/b&gt; &amp; Sons'), true);
  assert.equal(html.includes('&quot;on time&quot; &lt;always&gt;'), true);
  assert.equal(partnershipNoteEntryHtml({ ...first, partner: '' }), '');
  assert.equal(partnershipNoteAllHtml([]), '<p>No partnership notes recorded.</p>');
  assert.equal(partnershipNoteAllHtml([first]).startsWith('<ul>'), true);
  assert.equal(partnershipNotesForPartnerHtml([first], 'No Such Partner'), '<p>No partnership notes for that partner.</p>');
  assert.equal(partnershipNotesForPartnerHtml([first], 'Corner Shop').startsWith('<ul>'), true);
});

test('CSV export: header, rows in order, and filename', () => {
  const csv = partnershipNoteCsv([third, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,partner,type,terms,start_date,contact,recorded_by');
  assert.equal(lines[1], 'PN-1,Corner Shop,Payment collection point,Takes cash payments and hands over a daily slip,2026-10-01,03001234567,Owner');
  assert.equal(lines[2], 'PN-3,corner shop,Payment collection point,Second counter in the same shop,2026-11-02,03001234567,Saad');
  const quoted = partnershipNoteCsv([{ ...first, terms: 'Pays, on time' }]);
  assert.equal(quoted.split('\n')[1].includes('"Pays, on time"'), true);
  assert.equal(partnershipNoteFilename(), 'partnership-notes.csv');
});

test('list normalisation drops half-formed rows and non-lists', () => {
  assert.deepEqual(normalizePartnershipNoteList(null), []);
  assert.deepEqual(normalizePartnershipNoteList('nope'), []);
  assert.deepEqual(normalizePartnershipNoteList([first, { ...second, startDate: 'bad' }, second]), [first, second]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../partnership-note.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: settlement, commission, digest and referral records are untouched', () => {
  const source = readFileSync(new URL('../partnership-note.js', import.meta.url), 'utf8');
  assert.equal(source.includes('partner-settlement.js'), false, 'module must not reference the partner settlement file');
  assert.equal(source.includes('collector-commission.js'), false, 'module must not reference the collector commission file');
  assert.equal(source.includes('daily-partner-digest.js'), false, 'module must not reference the daily partner digest file');
  assert.equal(source.includes('referral-tracking.js'), false, 'module must not reference the referral tracking file');
  assert.equal(existsSync(new URL('../partner-settlement.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../collector-commission.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../daily-partner-digest.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../referral-tracking.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'ptnHeading', 'ptnSummary', 'ptnExportBtn', 'ptnPartner', 'ptnType',
    'ptnTerms', 'ptnStartDate', 'ptnContact', 'ptnRecordedBy', 'ptnRecordBtn',
    'ptnRemoveId', 'ptnRemoveBtn', 'ptnPartnerSelect', 'ptnPartnerBody', 'ptnBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the partnership note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './partnership-note.js'"), true);
  assert.equal(source.includes('renderPartnershipNotes();'), true);
  assert.equal(source.includes('shahdara_partnership_notes_v1'), true);
  assert.equal(source.includes('loadPartnershipNotes'), true);
  assert.equal(source.includes('savePartnershipNotes'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
