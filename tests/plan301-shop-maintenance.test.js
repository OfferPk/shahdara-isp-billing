import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validShopMaintenanceDay,
  normalizeShopMaintenanceNote,
  normalizeShopMaintenanceNoteList,
  findShopMaintenanceNote,
  recordShopMaintenanceNote,
  removeShopMaintenanceNote,
  shopMaintenanceNotesSorted,
  shopMaintenanceNotesForItem,
  shopMaintenanceItems,
  shopMaintenanceNoteSummaryText,
  shopMaintenanceNoteEntryText,
  shopMaintenanceNoteEntryHtml,
  shopMaintenanceNoteAllHtml,
  shopMaintenanceNotesForItemHtml,
  shopMaintenanceNoteCsv,
  shopMaintenanceNoteFilename,
} from '../shop-maintenance.js';

const first = {
  id: 'SMN-1',
  date: '2026-11-02',
  item: 'Ceiling fan',
  fault: 'Fan wobbles and makes a loud noise',
  action: 'Tightened the mounting and replaced the capacitor',
  cost: 'Rs 450',
  doneBy: 'Saad',
};
const second = {
  id: 'SMN-2',
  date: '2026-10-28',
  item: 'Ceiling fan',
  fault: 'Fan stopped spinning',
  action: 'Replaced the burnt winding wire',
  cost: 'Rs 800',
  doneBy: 'Electrician',
};
const third = {
  id: 'SMN-3',
  date: '2026-11-04',
  item: 'Shop shutter',
  fault: 'Shutter sticks halfway while closing',
  action: 'Oiled the tracks and tightened the spring',
  cost: '',
  doneBy: 'Owner',
};
const fixture = [first, second, third];

test('strict dates: real calendar days only', () => {
  assert.equal(validShopMaintenanceDay('2026-11-05'), true);
  assert.equal(validShopMaintenanceDay('2024-02-29'), true);
  assert.equal(validShopMaintenanceDay('2025-02-29'), false);
  assert.equal(validShopMaintenanceDay('2026-02-30'), false);
  assert.equal(validShopMaintenanceDay('2026-04-31'), false);
  assert.equal(validShopMaintenanceDay('2026-13-01'), false);
  assert.equal(validShopMaintenanceDay('2026-00-10'), false);
  assert.equal(validShopMaintenanceDay('2026-11-00'), false);
  assert.equal(validShopMaintenanceDay('2026-11-5'), false);
  assert.equal(validShopMaintenanceDay('05-11-2026'), false);
  assert.equal(validShopMaintenanceDay(''), false);
  assert.equal(validShopMaintenanceDay(null), false);
  assert.equal(validShopMaintenanceDay(20261105), false);
});

test('half-formed notes are refused', () => {
  assert.equal(normalizeShopMaintenanceNote(null), null);
  assert.equal(normalizeShopMaintenanceNote({}), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, id: '' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, date: '' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, date: '2025-02-29' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, date: '2026-11-5' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, item: '' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, fault: '' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, action: '' }), null);
  assert.equal(normalizeShopMaintenanceNote({ ...first, doneBy: '' }), null);
  // The cost note is plain words and optional.
  assert.deepEqual(normalizeShopMaintenanceNote({ ...first, cost: '' }), { ...first, cost: '' });
  const noCost = { ...first };
  delete noCost.cost;
  assert.deepEqual(normalizeShopMaintenanceNote(noCost), { ...first, cost: '' });
  assert.deepEqual(normalizeShopMaintenanceNote({ ...first, item: '  Ceiling fan  ' }), first);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 5000, paymentId: 'P-1', stockCount: 12, customer: 'Ali', extra: 'x' };
  const clean = normalizeShopMaintenanceNote(raw);
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.stockCount, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, billAmount: 5000, paymentId: 'P-1', stockCount: 12, customer: 'Ali', extra: 'x' });
  const list = [{ ...first, billAmount: 1 }];
  const out = normalizeShopMaintenanceNoteList(list);
  assert.equal(out[0].billAmount, undefined);
  assert.deepEqual(list, [{ ...first, billAmount: 1 }]);
});

test('duplicate ids are never rewritten', () => {
  const next = recordShopMaintenanceNote(fixture, { ...second, id: 'SMN-1', date: '2026-11-01', fault: 'Other' });
  assert.deepEqual(next, normalizeShopMaintenanceNoteList(fixture));
  assert.equal(findShopMaintenanceNote(fixture, 'SMN-1').fault, 'Fan wobbles and makes a loud noise');
});

test('find and remove', () => {
  assert.deepEqual(findShopMaintenanceNote(fixture, 'SMN-2'), second);
  assert.equal(findShopMaintenanceNote(fixture, 'SMN-9'), null);
  assert.equal(findShopMaintenanceNote(fixture, ''), null);
  assert.equal(removeShopMaintenanceNote(fixture, 'SMN-2').length, 2);
  assert.equal(removeShopMaintenanceNote(fixture, 'SMN-9').length, 3);
});

test('sorting by date, then item A-Z, then id', () => {
  const sorted = shopMaintenanceNotesSorted([third, first, second]);
  assert.deepEqual(sorted.map((n) => n.id), ['SMN-2', 'SMN-1', 'SMN-3']);
  const sameDay = [
    { ...first, id: 'SMN-9', date: '2026-11-02', item: 'Wiring' },
    { ...first, id: 'SMN-8', date: '2026-11-02', item: 'ceiling fan' },
  ];
  assert.deepEqual(shopMaintenanceNotesSorted(sameDay).map((n) => n.id), ['SMN-8', 'SMN-9']);
});

test('notes for one item, in date order, first spelling kept', () => {
  assert.deepEqual(shopMaintenanceNotesForItem(fixture, 'ceiling fan').map((n) => n.id), ['SMN-2', 'SMN-1']);
  assert.deepEqual(shopMaintenanceNotesForItem(fixture, 'Shop shutter').map((n) => n.id), ['SMN-3']);
  assert.deepEqual(shopMaintenanceNotesForItem(fixture, 'Nobody'), []);
  assert.deepEqual(shopMaintenanceNotesForItem(fixture, ''), []);
  const mixed = [{ ...first, id: 'SMN-4', date: '2026-11-01', item: 'CEILING FAN' }];
  assert.deepEqual(shopMaintenanceItems([...fixture, ...mixed]), ['Ceiling fan', 'Shop shutter']);
});

test('entry text names fault, action taken, done-by, and cost when given', () => {
  assert.equal(
    shopMaintenanceNoteEntryText(first),
    '2026-11-02 — Ceiling fan: Fault: Fan wobbles and makes a loud noise. Action taken: Tightened the mounting and replaced the capacitor. Done by Saad. Cost: Rs 450.',
  );
  assert.equal(
    shopMaintenanceNoteEntryText(third),
    '2026-11-04 — Shop shutter: Fault: Shutter sticks halfway while closing. Action taken: Oiled the tracks and tightened the spring. Done by Owner.',
  );
  assert.equal(shopMaintenanceNoteEntryText(null), 'No shop maintenance note recorded.');
});

test('summary text names the latest note', () => {
  assert.equal(shopMaintenanceNoteSummaryText([]), 'No shop maintenance notes recorded.');
  assert.equal(
    shopMaintenanceNoteSummaryText(fixture),
    '3 shop maintenance notes recorded. Latest: Shop shutter, 2026-11-04, Oiled the tracks and tightened the spring.',
  );
  assert.equal(
    shopMaintenanceNoteSummaryText([first]),
    '1 shop maintenance note recorded. Latest: Ceiling fan, 2026-11-02, Tightened the mounting and replaced the capacitor.',
  );
});

test('HTML is escaped', () => {
  const nasty = { ...first, item: '<b>Fan</b>', fault: 'Noisy & loose "bracket"' };
  const html = shopMaintenanceNoteEntryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;Fan&lt;/b&gt;'), true);
  assert.equal(html.includes('Noisy &amp; loose &quot;bracket&quot;'), true);
  assert.equal(shopMaintenanceNoteEntryHtml(null), '<p>No shop maintenance note recorded.</p>');
  assert.equal(shopMaintenanceNoteAllHtml([]), '<p>No shop maintenance notes recorded.</p>');
  assert.equal(shopMaintenanceNotesForItemHtml([], 'Fan'), '<p>No shop maintenance notes recorded for this item.</p>');
  assert.equal(shopMaintenanceNoteAllHtml(fixture).includes('<li>'), true);
});

test('CSV export and filename', () => {
  const csv = shopMaintenanceNoteCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","date","item","fault","action taken","cost","done by"');
  assert.equal(csv.includes('"SMN-2","2026-10-28","Ceiling fan","Fan stopped spinning","Replaced the burnt winding wire","Rs 800","Electrician"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"SMN-2"'), true);
  assert.equal(shopMaintenanceNoteFilename(), 'shop-maintenance-notes.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeShopMaintenanceNoteList(null), []);
  assert.deepEqual(normalizeShopMaintenanceNoteList('nope'), []);
  assert.deepEqual(normalizeShopMaintenanceNoteList([first, null, { ...first, id: '' }]).length, 1);
  assert.deepEqual(normalizeShopMaintenanceNoteList([first, { ...second, id: 'SMN-1' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../shop-maintenance.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the shop inventory audit cycle is untouched', () => {
  const source = readFileSync(new URL('../shop-maintenance.js', import.meta.url), 'utf8');
  assert.equal(source.includes('inventory-audit.js'), false, 'module must not reference the shop inventory audit cycle');
  assert.equal(existsSync(new URL('../inventory-audit.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'smnHeading', 'smnSummary', 'smnExportBtn', 'smnDate', 'smnItem',
    'smnFault', 'smnAction', 'smnCost', 'smnDoneBy', 'smnRecordBtn',
    'smnRemoveId', 'smnRemoveBtn', 'smnItemInput', 'smnItemBtn',
    'smnItemBody', 'smnBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the shop maintenance note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './shop-maintenance.js'"), true);
  assert.equal(source.includes('renderShopMaintenanceNotes()'), true);
  assert.equal(source.includes('loadShopMaintenanceNotes()'), true);
  assert.equal(source.includes('shahdara_shop_maintenance_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
