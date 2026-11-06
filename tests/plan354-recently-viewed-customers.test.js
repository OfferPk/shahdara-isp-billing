import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECENTLY_VIEWED_STORE_KEY,
  RECENTLY_VIEWED_MAX,
  normalizeRecentlyViewed,
  normalizeRecentlyViewedList,
  recentlyViewedEntry,
  recordRecentlyViewed,
  recentlyViewedRows,
  recentlyViewedDuesText,
  recentlyViewedRowText,
  recentlyViewedSummaryText,
  recentlyViewedHtml,
  recentlyViewedCsv,
  recentlyViewedFilename,
} from '../recently-viewed-customers.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'recently-viewed-customers.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function entry(id, overrides = {}) {
  return {
    id,
    name: `Customer ${id}`,
    mohalla: 'MOHALLA-A',
    duesCents: 150000,
    viewedAt: '2026-11-06T10:00:00.000Z',
    ...overrides,
  };
}

function customer(id, overrides = {}) {
  return {
    id,
    name: `Customer ${id}`,
    mohalla: 'MOHALLA-A',
    area: '',
    archived: false,
    ...overrides,
  };
}

// --- normalize ---

test('normalize: a valid entry keeps id, name, mohalla, dues, and viewed time', () => {
  assert.deepEqual(normalizeRecentlyViewed(entry('CUST-1')), {
    id: 'CUST-1',
    name: 'Customer CUST-1',
    mohalla: 'MOHALLA-A',
    duesCents: 150000,
    viewedAt: '2026-11-06T10:00:00.000Z',
  });
});

test('normalize: an entry without an id is refused, as is a non-object', () => {
  assert.equal(normalizeRecentlyViewed({ name: 'No Id' }), null);
  assert.equal(normalizeRecentlyViewed({ id: '   ' }), null);
  assert.equal(normalizeRecentlyViewed(null), null);
  assert.equal(normalizeRecentlyViewed('CUST-1'), null);
});

test('normalize: the older cache shape (area, no mohalla) still reads, with mohalla from area', () => {
  const legacy = { id: 'CUST-1', customerNumber: 7, name: 'Customer CUST-1', phone: '', area: 'MOHALLA-B', viewedAt: '2026-11-06T10:00:00.000Z' };
  const out = normalizeRecentlyViewed(legacy);
  assert.equal(out.mohalla, 'MOHALLA-B');
  assert.equal(out.duesCents, null);
});

test('normalize: no mohalla and no area reads as Unassigned', () => {
  assert.equal(normalizeRecentlyViewed({ id: 'CUST-1', name: 'Customer CUST-1' }).mohalla, 'Unassigned');
  assert.equal(normalizeRecentlyViewed({ id: 'CUST-1', name: 'Customer CUST-1', mohalla: '  ', area: '' }).mohalla, 'Unassigned');
});

test('normalize: dues must be whole non-negative cents or they read as not recorded', () => {
  assert.equal(normalizeRecentlyViewed(entry('CUST-1', { duesCents: -5 })).duesCents, null);
  assert.equal(normalizeRecentlyViewed(entry('CUST-1', { duesCents: '1500' })).duesCents, null);
  assert.equal(normalizeRecentlyViewed(entry('CUST-1', { duesCents: Number.NaN })).duesCents, null);
  assert.equal(normalizeRecentlyViewed(entry('CUST-1', { duesCents: 100.6 })).duesCents, 101);
  assert.equal(normalizeRecentlyViewed(entry('CUST-1', { duesCents: 0 })).duesCents, 0);
});

test('normalize list: duplicates keep the first (newest), the list caps at twelve, non-lists give an empty list', () => {
  assert.equal(RECENTLY_VIEWED_MAX, 12);
  const list = normalizeRecentlyViewedList([entry('CUST-1'), entry('CUST-2'), entry('CUST-1', { name: 'Stale' })]);
  assert.deepEqual(list.map(e => e.id), ['CUST-1', 'CUST-2']);
  assert.equal(list[0].name, 'Customer CUST-1');
  const many = Array.from({ length: 14 }, (_, i) => entry(`CUST-${String(i + 1).padStart(2, '0')}`));
  assert.equal(normalizeRecentlyViewedList(many).length, 12);
  assert.deepEqual(normalizeRecentlyViewedList(null), []);
  assert.deepEqual(normalizeRecentlyViewedList('nope'), []);
});

// --- entry builder ---

test('entry: a customer record builds an entry with mohalla, dues, and viewed time', () => {
  const out = recentlyViewedEntry(customer('CUST-1'), 200000, '2026-11-06T11:00:00.000Z');
  assert.deepEqual(out, {
    id: 'CUST-1',
    name: 'Customer CUST-1',
    mohalla: 'MOHALLA-A',
    duesCents: 200000,
    viewedAt: '2026-11-06T11:00:00.000Z',
  });
});

test('entry: mohalla falls back to area, then to Unassigned', () => {
  assert.equal(recentlyViewedEntry(customer('CUST-1', { mohalla: '', area: 'MOHALLA-B' }), null, '').mohalla, 'MOHALLA-B');
  assert.equal(recentlyViewedEntry(customer('CUST-1', { mohalla: '', area: '' }), null, '').mohalla, 'Unassigned');
});

test('entry: no customer or no id gives no entry', () => {
  assert.equal(recentlyViewedEntry(null, 0, ''), null);
  assert.equal(recentlyViewedEntry({ name: 'No Id' }, 0, ''), null);
});

// --- record ---

test('record: a fresh view goes on top of an empty list', () => {
  assert.deepEqual(recordRecentlyViewed([], entry('CUST-1')).map(e => e.id), ['CUST-1']);
});

test('record: opening a profile again moves it to the top with no duplicates', () => {
  const before = [entry('CUST-1'), entry('CUST-2'), entry('CUST-3')];
  const after = recordRecentlyViewed(before, entry('CUST-3', { name: 'Customer CUST-3', viewedAt: '2026-11-06T12:00:00.000Z' }));
  assert.deepEqual(after.map(e => e.id), ['CUST-3', 'CUST-1', 'CUST-2']);
  assert.equal(after[0].viewedAt, '2026-11-06T12:00:00.000Z');
});

test('record: the list caps at twelve and drops the oldest views', () => {
  const before = Array.from({ length: 13 }, (_, i) => entry(`CUST-${String(i + 1).padStart(2, '0')}`));
  const after = recordRecentlyViewed(before, entry('CUST-99'));
  assert.equal(after.length, 12);
  assert.equal(after[0].id, 'CUST-99');
  assert.equal(after.some(e => e.id === 'CUST-12'), false);
  assert.equal(after.some(e => e.id === 'CUST-13'), false);
});

test('record: an invalid entry leaves the list unchanged, and inputs are never mutated', () => {
  const before = deepFreeze([entry('CUST-1'), entry('CUST-2')]);
  const fresh = deepFreeze(entry('CUST-3'));
  assert.deepEqual(recordRecentlyViewed(before, null).map(e => e.id), ['CUST-1', 'CUST-2']);
  assert.deepEqual(recordRecentlyViewed(before, fresh).map(e => e.id), ['CUST-3', 'CUST-1', 'CUST-2']);
  assert.deepEqual(before.map(e => e.id), ['CUST-1', 'CUST-2']);
});

// --- display rows ---

test('rows: name and mohalla refresh from the live record, never from a stale snapshot', () => {
  const stored = [entry('CUST-1', { name: 'Old Name', mohalla: 'OLD-MOHALLA' })];
  const live = [customer('CUST-1', { name: 'New Name', mohalla: 'MOHALLA-B' })];
  const rows = recentlyViewedRows(stored, live, {});
  assert.equal(rows[0].name, 'New Name');
  assert.equal(rows[0].mohalla, 'MOHALLA-B');
});

test('rows: missing customers and archived customers leave the list', () => {
  const stored = [entry('CUST-1'), entry('CUST-2'), entry('CUST-3')];
  const live = [customer('CUST-1'), customer('CUST-2', { archived: true })];
  assert.deepEqual(recentlyViewedRows(stored, live, {}).map(r => r.id), ['CUST-1']);
});

test('rows: live dues override the stored snapshot', () => {
  const stored = [entry('CUST-1', { duesCents: 150000 })];
  const live = [customer('CUST-1')];
  assert.equal(recentlyViewedRows(stored, live, { 'CUST-1': 200000 })[0].duesCents, 200000);
});

test('rows: without live dues the stored snapshot stands, and without either the dues read as not recorded', () => {
  const stored = [entry('CUST-1', { duesCents: 150000 }), entry('CUST-2', { duesCents: null })];
  const live = [customer('CUST-1'), customer('CUST-2')];
  const rows = recentlyViewedRows(stored, live, {});
  assert.equal(rows[0].duesCents, 150000);
  assert.equal(rows[1].duesCents, null);
});

test('rows: list order is kept newest first, and a non-array customer list gives no rows', () => {
  const stored = [entry('CUST-2'), entry('CUST-1')];
  const live = [customer('CUST-1'), customer('CUST-2')];
  assert.deepEqual(recentlyViewedRows(stored, live, {}).map(r => r.id), ['CUST-2', 'CUST-1']);
  assert.deepEqual(recentlyViewedRows(stored, null, {}), []);
});

// --- summary and row text ---

test('summary: zero, one, and many customers read in plain words', () => {
  assert.equal(recentlyViewedSummaryText([]), 'No recently viewed customers yet.');
  assert.equal(recentlyViewedSummaryText([entry('CUST-1')]), '1 recently viewed customer.');
  assert.equal(recentlyViewedSummaryText([entry('CUST-1'), entry('CUST-2')]), '2 recently viewed customers.');
});

test('row text: name, mohalla, and dues read in plain words', () => {
  assert.equal(recentlyViewedRowText({ id: 'CUST-1', name: 'Customer One', mohalla: 'MOHALLA-A', duesCents: 150000 }), 'Customer One — MOHALLA-A — PKR 1,500 due');
});

test('row text: zero dues read as no amount due', () => {
  assert.equal(recentlyViewedDuesText({ duesCents: 0 }), 'No amount due');
  assert.equal(recentlyViewedRowText({ id: 'CUST-1', name: 'Customer One', mohalla: 'MOHALLA-A', duesCents: 0 }), 'Customer One — MOHALLA-A — No amount due');
});

test('row text: missing dues read as not recorded, and a missing name reads as unnamed', () => {
  assert.equal(recentlyViewedDuesText({ duesCents: null }), 'Dues not recorded');
  assert.equal(recentlyViewedRowText({ id: 'CUST-1', name: '', mohalla: '', duesCents: null }), 'Unnamed customer — Unassigned — Dues not recorded');
});

// --- html and csv ---

test('html: rows carry name, mohalla, and dues, and each row reopens its profile', () => {
  const html = recentlyViewedHtml([{ id: 'CUST-1', name: 'Customer One', mohalla: 'MOHALLA-A', duesCents: 150000, viewedAt: '' }]);
  assert.ok(html.includes('Customer One'), 'row shows the name');
  assert.ok(html.includes('MOHALLA-A'), 'row shows the mohalla');
  assert.ok(html.includes('PKR 1,500 due'), 'row shows the dues');
  assert.ok(html.includes('data-rvc-customer-id="CUST-1"'), 'row reopens the profile');
});

test('html: markup in a name is escaped, never rendered', () => {
  const html = recentlyViewedHtml([{ id: 'CUST-1', name: 'Customer <script>alert(1)</script>', mohalla: 'MOHALLA-A', duesCents: 0, viewedAt: '' }]);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'), 'script tag is escaped');
});

test('html: an empty list reads as no recently viewed customers yet', () => {
  assert.equal(recentlyViewedHtml([]), '<p>No recently viewed customers yet.</p>');
  assert.equal(recentlyViewedHtml(null), '<p>No recently viewed customers yet.</p>');
});

test('csv: header plus one row per customer, dues in rupees', () => {
  const csv = recentlyViewedCsv([
    { id: 'CUST-1', name: 'Customer One', mohalla: 'MOHALLA-A', duesCents: 150000 },
    { id: 'CUST-2', name: 'Customer Two', mohalla: 'MOHALLA-B', duesCents: 0 },
  ]);
  assert.equal(csv, 'id,name,mohalla,dues_pkr\nCUST-1,Customer One,MOHALLA-A,1500\nCUST-2,Customer Two,MOHALLA-B,0');
});

test('csv: a name with a comma is quoted, and missing dues leave an empty cell', () => {
  const csv = recentlyViewedCsv([{ id: 'CUST-1', name: 'Customer, One', mohalla: 'MOHALLA-A', duesCents: null }]);
  assert.equal(csv, 'id,name,mohalla,dues_pkr\nCUST-1,"Customer, One",MOHALLA-A,');
});

// --- store key, filename, purity, fence ---

test('store key: the list shares the fast search sheet recents key — one list, not a second one', () => {
  assert.equal(RECENTLY_VIEWED_STORE_KEY, 'shahdara_recent_customers_v1');
});

test('filename: the export file is named for the list', () => {
  assert.equal(recentlyViewedFilename(), 'recently-viewed-customers.csv');
});

test('purity: the module is pure and import-free — no storage, clock, network, or neighbour names', () => {
  for (const forbidden of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.equal(moduleSrc.includes(forbidden), false, `module must not contain ${forbidden}`);
  }
  // The sheet module that owns the recents cache was checked by filename
  // first and is neither read nor rewritten here, so this module never
  // names it — the name is built from fragments so the literal
  // filename appears nowhere in this file either.
  const sheetModule = 'nav-customer-' + 'search';
  const ownSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.equal(moduleSrc.includes(`${sheetModule}.js`), false, 'module must not name the sheet module file');
  assert.equal(ownSrc.includes(`${sheetModule}.js`), false, 'test must not name the sheet module file');
});

// --- wiring into the app ---

test('wiring: the app imports the module and records every profile opening from selectCustomer', () => {
  assert.ok(appSrc.includes("from './recently-viewed-customers.js'"), 'app imports the recently viewed module');
  assert.ok(appSrc.includes('RECENTLY_VIEWED_STORE_KEY'), 'app uses the shared store key');
  assert.ok(appSrc.includes('recordRecentlyViewed(loadRecentlyViewed()'), 'app records the view from the stored list');
  assert.ok(appSrc.includes('recentlyViewedEntry(currentCust'), 'app builds the entry from the opened profile');
  const selectStart = appSrc.indexOf('function selectCustomer(');
  const selectEnd = appSrc.indexOf('function downloadTxt(', selectStart);
  const selectBody = appSrc.slice(selectStart, selectEnd);
  assert.ok(selectBody.includes('recordRecentlyViewed'), 'recording sits inside selectCustomer, so every opening counts');
});

test('wiring: the app loads and saves the list through the shared key and renders it in the analytics view', () => {
  assert.ok(appSrc.includes('localStorage.getItem(RECENTLY_VIEWED_STORE_KEY)'), 'load reads the shared key');
  assert.ok(appSrc.includes('localStorage.setItem(RECENTLY_VIEWED_STORE_KEY, JSON.stringify(normalizeRecentlyViewedList(list)))'), 'save writes the shared key');
  assert.ok(appSrc.includes('function renderRecentlyViewedCustomers()'), 'app renders the list');
  assert.ok(appSrc.includes('renderRecentlyViewedCustomers();'), 'analytics calls the render');
  assert.ok(appSrc.includes("$('#rvcClearBtn')"), 'clear button is wired');
  assert.ok(appSrc.includes("data-rvc-customer-id"), 'rows reopen the profile');
});

test('wiring: the page carries the recently viewed panel after the installation dashboard panel', () => {
  for (const id of ['rvcHeading', 'rvcSummary', 'rvcBody', 'rvcClearBtn', 'rvcExportBtn']) {
    assert.ok(indexSrc.includes(`id="${id}"`), `panel carries ${id}`);
  }
  assert.ok(indexSrc.indexOf('id="idaBody"') < indexSrc.indexOf('id="rvcBody"'), 'panel sits after the installation dashboard panel');
  assert.ok(indexSrc.includes('Recently viewed customers'), 'panel is titled for the operator');
});
