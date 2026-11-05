import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validCompetitorPriceDay,
  normalizeCompetitorPriceNote,
  normalizeCompetitorPriceNoteList,
  findCompetitorPriceNote,
  recordCompetitorPriceNote,
  removeCompetitorPriceNote,
  competitorPriceNotesSorted,
  competitorPriceNotesForCompetitor,
  competitorPriceCompetitors,
  competitorPriceNoteSummaryText,
  competitorPriceNoteEntryText,
  competitorPriceNoteEntryHtml,
  competitorPriceNoteAllHtml,
  competitorPriceNotesForCompetitorHtml,
  competitorPriceNoteCsv,
  competitorPriceNoteFilename,
} from '../competitor-price.js';

const first = {
  id: 'CPN-1',
  competitor: 'CityNet',
  package: '10 Mbps, 200 GB',
  price: 1800,
  dateSeen: '2026-11-02',
  source: 'Poster at the bazaar',
  recordedBy: 'Saad',
};
const second = {
  id: 'CPN-2',
  competitor: 'CityNet',
  package: '5 Mbps, 100 GB',
  price: 1200,
  dateSeen: '2026-10-28',
  source: 'Customer mention',
  recordedBy: 'Owner',
};
const third = {
  id: 'CPN-3',
  competitor: 'FastLink',
  package: '15 Mbps, 500 GB',
  price: 2800,
  dateSeen: '2026-11-04',
  source: 'Shop visit',
  recordedBy: 'Saad',
};
const fixture = [first, second, third];

test('strict dates: real calendar days only', () => {
  assert.equal(validCompetitorPriceDay('2026-11-05'), true);
  assert.equal(validCompetitorPriceDay('2024-02-29'), true);
  assert.equal(validCompetitorPriceDay('2025-02-29'), false);
  assert.equal(validCompetitorPriceDay('2026-02-30'), false);
  assert.equal(validCompetitorPriceDay('2026-04-31'), false);
  assert.equal(validCompetitorPriceDay('2026-13-01'), false);
  assert.equal(validCompetitorPriceDay('2026-00-10'), false);
  assert.equal(validCompetitorPriceDay('2026-11-00'), false);
  assert.equal(validCompetitorPriceDay('2026-11-5'), false);
  assert.equal(validCompetitorPriceDay('05-11-2026'), false);
  assert.equal(validCompetitorPriceDay(''), false);
  assert.equal(validCompetitorPriceDay(null), false);
  assert.equal(validCompetitorPriceDay(20261105), false);
});

test('half-formed notes are refused', () => {
  assert.equal(normalizeCompetitorPriceNote(null), null);
  assert.equal(normalizeCompetitorPriceNote({}), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, id: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, competitor: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, package: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, dateSeen: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, dateSeen: '2025-02-29' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, dateSeen: '2026-11-5' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, source: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, recordedBy: '' }), null);
  assert.deepEqual(normalizeCompetitorPriceNote({ ...first, competitor: '  CityNet  ' }), first);
});

test('price must be whole rupees of at least one rupee', () => {
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: 0 }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: -5 }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: 12.5 }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: '' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: 'Rs 1800' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: '1800.5' }), null);
  assert.equal(normalizeCompetitorPriceNote({ ...first, price: null }), null);
  // A digit string is accepted and stored as a number.
  assert.deepEqual(normalizeCompetitorPriceNote({ ...first, price: '1800' }), first);
  assert.deepEqual(normalizeCompetitorPriceNote({ ...first, price: 1 }), { ...first, price: 1 });
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', packagePrice: 1500, extra: 'x' };
  const clean = normalizeCompetitorPriceNote(raw);
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.packagePrice, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', packagePrice: 1500, extra: 'x' });
  const list = [{ ...first, billAmount: 1 }];
  const out = normalizeCompetitorPriceNoteList(list);
  assert.equal(out[0].billAmount, undefined);
  assert.deepEqual(list, [{ ...first, billAmount: 1 }]);
});

test('duplicate ids are never rewritten', () => {
  const next = recordCompetitorPriceNote(fixture, { ...second, id: 'CPN-1', dateSeen: '2026-11-01', package: 'Other' });
  assert.deepEqual(next, normalizeCompetitorPriceNoteList(fixture));
  assert.equal(findCompetitorPriceNote(fixture, 'CPN-1').package, '10 Mbps, 200 GB');
});

test('find and remove', () => {
  assert.deepEqual(findCompetitorPriceNote(fixture, 'CPN-2'), second);
  assert.equal(findCompetitorPriceNote(fixture, 'CPN-9'), null);
  assert.equal(findCompetitorPriceNote(fixture, ''), null);
  assert.equal(removeCompetitorPriceNote(fixture, 'CPN-2').length, 2);
  assert.equal(removeCompetitorPriceNote(fixture, 'CPN-9').length, 3);
});

test('sorting newest first, then competitor A-Z, then id', () => {
  const sorted = competitorPriceNotesSorted([second, third, first]);
  assert.deepEqual(sorted.map((n) => n.id), ['CPN-3', 'CPN-1', 'CPN-2']);
  const sameDay = [
    { ...first, id: 'CPN-9', dateSeen: '2026-11-02', competitor: 'ZetaNet' },
    { ...first, id: 'CPN-8', dateSeen: '2026-11-02', competitor: 'citynet' },
  ];
  assert.deepEqual(competitorPriceNotesSorted(sameDay).map((n) => n.id), ['CPN-8', 'CPN-9']);
});

test('notes for one competitor, newest first, first spelling kept', () => {
  assert.deepEqual(competitorPriceNotesForCompetitor(fixture, 'citynet').map((n) => n.id), ['CPN-1', 'CPN-2']);
  assert.deepEqual(competitorPriceNotesForCompetitor(fixture, 'FastLink').map((n) => n.id), ['CPN-3']);
  assert.deepEqual(competitorPriceNotesForCompetitor(fixture, 'Nobody'), []);
  assert.deepEqual(competitorPriceNotesForCompetitor(fixture, ''), []);
  const mixed = [{ ...first, id: 'CPN-4', dateSeen: '2026-11-01', competitor: 'CITYNET' }];
  assert.deepEqual(competitorPriceCompetitors([...fixture, ...mixed]), ['CityNet', 'FastLink']);
});

test('entry text names competitor, package, price, and date seen', () => {
  assert.equal(
    competitorPriceNoteEntryText(first),
    '2026-11-02 — CityNet: 10 Mbps, 200 GB, Rs 1800. Source: Poster at the bazaar. Recorded by Saad.',
  );
  assert.equal(
    competitorPriceNoteEntryText(third),
    '2026-11-04 — FastLink: 15 Mbps, 500 GB, Rs 2800. Source: Shop visit. Recorded by Saad.',
  );
  assert.equal(competitorPriceNoteEntryText(null), 'No competitor price note recorded.');
});

test('summary text names the latest note', () => {
  assert.equal(competitorPriceNoteSummaryText([]), 'No competitor price notes recorded.');
  assert.equal(
    competitorPriceNoteSummaryText(fixture),
    '3 competitor price notes recorded. Latest: FastLink, 15 Mbps, 500 GB, Rs 2800, seen 2026-11-04.',
  );
  assert.equal(
    competitorPriceNoteSummaryText([first]),
    '1 competitor price note recorded. Latest: CityNet, 10 Mbps, 200 GB, Rs 1800, seen 2026-11-02.',
  );
});

test('HTML is escaped', () => {
  const nasty = { ...first, competitor: '<b>CityNet</b>', source: 'Noisy & loose "poster"' };
  const html = competitorPriceNoteEntryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;CityNet&lt;/b&gt;'), true);
  assert.equal(html.includes('Noisy &amp; loose &quot;poster&quot;'), true);
  assert.equal(competitorPriceNoteEntryHtml(null), '<p>No competitor price note recorded.</p>');
  assert.equal(competitorPriceNoteAllHtml([]), '<p>No competitor price notes recorded.</p>');
  assert.equal(competitorPriceNotesForCompetitorHtml([], 'CityNet'), '<p>No competitor price notes recorded for this competitor.</p>');
  assert.equal(competitorPriceNoteAllHtml(fixture).includes('<li>'), true);
});

test('CSV export and filename', () => {
  const csv = competitorPriceNoteCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","competitor","package","price","date seen","source","recorded by"');
  assert.equal(csv.includes('"CPN-3","FastLink","15 Mbps, 500 GB","2800","2026-11-04","Shop visit","Saad"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"CPN-3"'), true);
  assert.equal(competitorPriceNoteFilename(), 'competitor-price-notes.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeCompetitorPriceNoteList(null), []);
  assert.deepEqual(normalizeCompetitorPriceNoteList('nope'), []);
  assert.deepEqual(normalizeCompetitorPriceNoteList([first, null, { ...first, id: '' }]).length, 1);
  assert.deepEqual(normalizeCompetitorPriceNoteList([first, { ...second, id: 'CPN-1' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../competitor-price.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: Shahdara price records are untouched', () => {
  const source = readFileSync(new URL('../competitor-price.js', import.meta.url), 'utf8');
  assert.equal(source.includes('package-price-history.js'), false, 'module must not reference the Shahdara package price history record');
  assert.equal(source.includes('price-notices.js'), false, 'module must not reference the price notices record');
  assert.equal(source.includes('price-review.js'), false, 'module must not reference the price review worksheet');
  assert.equal(source.includes('applied-price.js'), false, 'module must not reference the applied price record');
  assert.equal(existsSync(new URL('../package-price-history.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../price-notices.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../price-review.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../applied-price.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cpnHeading', 'cpnSummary', 'cpnExportBtn', 'cpnDate', 'cpnCompetitor',
    'cpnPackage', 'cpnPrice', 'cpnSource', 'cpnRecordedBy', 'cpnRecordBtn',
    'cpnRemoveId', 'cpnRemoveBtn', 'cpnCompetitorInput', 'cpnCompetitorBtn',
    'cpnCompetitorBody', 'cpnBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the competitor price note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './competitor-price.js'"), true);
  assert.equal(source.includes('renderCompetitorPriceNotes()'), true);
  assert.equal(source.includes('loadCompetitorPriceNotes()'), true);
  assert.equal(source.includes('shahdara_competitor_price_notes_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
