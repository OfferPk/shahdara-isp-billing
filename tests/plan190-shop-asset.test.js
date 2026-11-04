import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isStrictDate,
  normalizeShopAsset,
  normalizeShopAssetList,
  findShopAsset,
  recordShopAsset,
  removeShopAsset,
  markShopAssetDisposed,
  shopAssetsSorted,
  activeShopAssets,
  disposedShopAssets,
  shopAssetsInLocation,
  shopAssetsByLocation,
  shopAssetLocations,
  shopAssetCoverText,
  shopAssetText,
  shopAssetSummaryText,
  shopAssetHtml,
  shopAssetAllHtml,
  shopAssetCsv,
  shopAssetFilename,
} from '../shop-asset.js';

const dir = dirname(fileURLToPath(import.meta.url));

const asset = (over = {}) => ({
  id: 'SA-1',
  item: 'Shop desk',
  purchaseDate: '2025-03-10',
  cost: 'Rs 12000',
  location: 'Front room',
  insurer: 'Insurer A',
  coverNote: 'Covered against fire',
  status: 'active',
  disposedDate: '',
  ...over,
});

test('half-formed assets are refused', () => {
  assert.equal(normalizeShopAsset(null), null);
  assert.equal(normalizeShopAsset({ item: 'X', purchaseDate: '2025-03-10' }), null);
  assert.equal(normalizeShopAsset(asset({ item: '' })), null);
  assert.equal(normalizeShopAsset(asset({ purchaseDate: '' })), null);
  assert.equal(normalizeShopAsset(asset({ purchaseDate: '2025-13-10' })), null);
  assert.equal(normalizeShopAsset(asset({ disposedDate: '2025-02-30' })), null);
});

test('strict dates: bad months, bad days, leap years', () => {
  assert.equal(isStrictDate('2026-02-29'), false);
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-04-31'), false);
  assert.equal(isStrictDate('2026-08-31'), true);
  assert.equal(isStrictDate('2026-12-31'), true);
  assert.equal(isStrictDate('10-03-2025'), false);
  assert.equal(normalizeShopAsset(asset({ purchaseDate: '2025-02-30' })), null);
});

test('unknown status falls back to active, never hidden', () => {
  assert.equal(normalizeShopAsset(asset({ status: 'lost' })).status, 'active');
  assert.equal(normalizeShopAsset(asset({ status: 'SOLD' })).status, 'active');
  assert.equal(normalizeShopAsset(asset({ status: 'disposed' })).status, 'disposed');
});

test('active assets carry no disposed date', () => {
  assert.equal(normalizeShopAsset(asset({ disposedDate: '2025-06-01' })).disposedDate, '');
  assert.equal(normalizeShopAsset(asset({ status: 'disposed', disposedDate: '2025-06-01' })).disposedDate, '2025-06-01');
});

test('unknown fields are dropped', () => {
  const entry = normalizeShopAsset(asset({ billId: 'B-1', paymentId: 'P-1', expenseId: 'E-1', stockId: 'S-1', claimId: 'C-1', sendTo: 'x' }));
  assert.equal(entry.billId, undefined);
  assert.equal(entry.paymentId, undefined);
  assert.equal(entry.expenseId, undefined);
  assert.equal(entry.stockId, undefined);
  assert.equal(entry.claimId, undefined);
  assert.equal(entry.sendTo, undefined);
});

test('duplicate ids are never rewritten', () => {
  const first = recordShopAsset([], asset());
  const second = recordShopAsset(first, asset({ item: 'Other item' }));
  assert.equal(second.length, 1);
  assert.equal(second[0].item, 'Shop desk');
});

test('find and remove work by id', () => {
  const list = recordShopAsset([], asset());
  assert.equal(findShopAsset(list, 'SA-1').item, 'Shop desk');
  assert.equal(findShopAsset(list, 'SA-9'), null);
  assert.equal(removeShopAsset(list, 'SA-1').length, 0);
  assert.equal(removeShopAsset(list, 'SA-9').length, 1);
});

test('mark disposed keeps history and never rewrites', () => {
  const list = recordShopAsset([], asset());
  const disposed = markShopAssetDisposed(list, 'SA-1', '2026-01-05');
  assert.equal(disposed[0].status, 'disposed');
  assert.equal(disposed[0].disposedDate, '2026-01-05');
  assert.equal(disposed.length, 1);
  const again = markShopAssetDisposed(disposed, 'SA-1', '2026-02-01');
  assert.equal(again[0].disposedDate, '2026-01-05');
  const bad = markShopAssetDisposed(list, 'SA-1', '2026-02-30');
  assert.equal(bad[0].status, 'active');
  assert.equal(bad[0].disposedDate, '');
});

test('assets sort by location, then item, then id; unlocated last', () => {
  const list = normalizeShopAssetList([
    asset({ id: 'SA-3', item: 'Zebra chair', location: 'Back room' }),
    asset({ id: 'SA-1', item: 'Apple shelf', location: 'Front room' }),
    asset({ id: 'SA-2', item: 'Banana shelf', location: 'Front room' }),
    asset({ id: 'SA-4', item: 'Spare cable', location: '' }),
  ]);
  assert.deepEqual(shopAssetsSorted(list).map((a) => a.id), ['SA-3', 'SA-1', 'SA-2', 'SA-4']);
});

test('active and disposed views split the register', () => {
  const list = recordShopAsset(recordShopAsset([], asset()), asset({ id: 'SA-2', status: 'disposed', disposedDate: '2026-01-05' }));
  assert.deepEqual(activeShopAssets(list).map((a) => a.id), ['SA-1']);
  assert.deepEqual(disposedShopAssets(list).map((a) => a.id), ['SA-2']);
});

test('location views match case-insensitively', () => {
  const list = normalizeShopAssetList([
    asset({ id: 'SA-1', location: 'Front Room' }),
    asset({ id: 'SA-2', location: 'Back room' }),
  ]);
  assert.deepEqual(shopAssetsInLocation(list, 'front room').map((a) => a.id), ['SA-1']);
  assert.deepEqual(shopAssetsInLocation(list, '').map((a) => a.id), ['SA-2', 'SA-1']);
  assert.deepEqual(shopAssetLocations(list), ['Back room', 'Front Room']);
  const grouped = shopAssetsByLocation(list);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].location, 'Back room');
  assert.deepEqual(grouped[0].assets.map((a) => a.id), ['SA-2']);
});

test('cover note or a plain no-cover statement, never silence', () => {
  assert.equal(shopAssetCoverText(asset()), 'cover: Covered against fire');
  assert.equal(shopAssetCoverText(asset({ coverNote: '' })), 'No insurance cover noted.');
  assert.ok(shopAssetText(asset({ coverNote: '' })).includes('No insurance cover noted.'));
  assert.ok(shopAssetText(asset()).includes('cover: Covered against fire'));
});

test('summary names active, disposed, and no-cover counts', () => {
  const list = normalizeShopAssetList([
    asset({ id: 'SA-1' }),
    asset({ id: 'SA-2', coverNote: '', status: 'disposed', disposedDate: '2026-01-05' }),
  ]);
  assert.equal(shopAssetSummaryText(list), '2 shop assets recorded: 1 active, 1 disposed, 1 with no insurance cover noted');
  assert.equal(shopAssetSummaryText([]), '0 shop assets recorded: 0 active, 0 disposed, 0 with no insurance cover noted');
});

test('asset text states disposed state and date', () => {
  assert.ok(shopAssetText(asset()).includes('active'));
  assert.ok(shopAssetText(asset({ status: 'disposed', disposedDate: '2026-01-05' })).includes('disposed 2026-01-05'));
  assert.equal(shopAssetText(null), '');
});

test('html escapes user text and csv has no total column', () => {
  const html = shopAssetHtml(asset({ item: '<Desk & chair>' }));
  assert.ok(html.includes('&lt;Desk &amp; chair&gt;'));
  assert.ok(!html.includes('<Desk'));
  const csv = shopAssetCsv([asset()]);
  assert.ok(csv.startsWith('"id","item","purchaseDate","cost","location","insurer","coverNote","status","disposedDate"'));
  assert.ok(csv.includes('"SA-1","Shop desk","2025-03-10","Rs 12000","Front room","Insurer A","Covered against fire","active",""'));
  assert.ok(!csv.includes('total'));
  assert.equal(shopAssetFilename(), 'shop-assets.csv');
  assert.equal(shopAssetAllHtml([]), '');
});

test('inputs are never mutated', () => {
  const raw = asset();
  const before = JSON.stringify(raw);
  recordShopAsset([], raw);
  markShopAssetDisposed([raw], 'SA-1', '2026-01-05');
  assert.equal(JSON.stringify(raw), before);
  const list = [asset({ id: 'SA-2' }), asset()];
  shopAssetsSorted(list);
  assert.equal(list[0].id, 'SA-2');
});

test('list normalization drops bad rows and duplicate ids', () => {
  const list = normalizeShopAssetList([asset(), asset({ item: 'Other' }), null, asset({ id: 'SA-9', purchaseDate: 'bad' })]);
  assert.equal(list.length, 1);
  assert.equal(normalizeShopAssetList('nope').length, 0);
});

test('module is pure: no storage, network, or other record access', () => {
  const source = readFileSync(join(dir, '..', 'shop-asset.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['saBody', 'saSummary', 'saExportBtn', 'saItem', 'saPurchase', 'saCost', 'saLocation', 'saInsurer', 'saCover', 'saSaveBtn', 'saDisposeId', 'saDisposeDate', 'saDisposeBtn', 'saRemoveId', 'saRemoveBtn', 'saFilter']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the shop asset module and render function', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './shop-asset.js'"));
  assert.ok(app.includes('renderShopAssets()'));
  assert.ok(app.includes('shahdara_shop_assets_v1'));
});
