import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeExpectedLife,
  normalizeAgeingItem,
  normalizeAgeingList,
  findAgeingItem,
  recordAgeingItem,
  removeAgeingItem,
  replacementDueDate,
  isPastExpectedLife,
  ageingSorted,
  pastLifeItems,
  ageingForItem,
  ageingSummaryText,
  ageingText,
  ageingHtml,
  ageingAllHtml,
  equipmentAgeingCsv,
  equipmentAgeingFilename,
} from '../equipment-ageing.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'equipment-ageing.js'), 'utf8');

function item(overrides = {}) {
  return {
    id: 'EA-1',
    item: 'Spare router',
    purchaseDate: '2022-03-10',
    expectedLifeYears: 5,
    conditionNote: 'Working fine.',
    reserveNote: 'Set money aside in spring.',
    ...overrides,
  };
}

test('half-formed items are refused', () => {
  assert.equal(normalizeAgeingItem(null), null);
  assert.equal(normalizeAgeingItem(item({ id: '' })), null);
  assert.equal(normalizeAgeingItem(item({ item: '   ' })), null);
  assert.equal(normalizeAgeingItem(item({ purchaseDate: '' })), null);
  assert.equal(normalizeAgeingItem(item({ purchaseDate: '2022-13-01' })), null);
  assert.equal(normalizeAgeingItem(item({ purchaseDate: '10-03-2022' })), null);
});

test('strict calendar dates: 31-day months and Feb 29 leap/non-leap', () => {
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2023-02-29'), null);
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2026-11-31'), null);
});

test('expected life: missing is allowed, bad values are refused', () => {
  assert.equal(normalizeExpectedLife(undefined), null);
  assert.equal(normalizeExpectedLife(''), null);
  assert.equal(normalizeExpectedLife('   '), null);
  assert.equal(normalizeExpectedLife(5), 5);
  assert.equal(normalizeExpectedLife('3'), 3);
  assert.equal(normalizeExpectedLife(0), null);
  assert.equal(normalizeExpectedLife(-2), null);
  assert.equal(normalizeExpectedLife(2.5), null);
  assert.equal(normalizeExpectedLife('soon'), null);
  assert.ok(normalizeAgeingItem(item({ expectedLifeYears: undefined })));
  assert.equal(normalizeAgeingItem(item({ expectedLifeYears: 0 })), null);
  assert.equal(normalizeAgeingItem(item({ expectedLifeYears: 'soon' })), null);
});

test('unknown fields are dropped, never stored', () => {
  const clean = normalizeAgeingItem(item({ billId: 'B-1', payment: 500, stock: 3, sendTo: 'x' }));
  assert.deepEqual(Object.keys(clean).sort(), ['conditionNote', 'expectedLifeYears', 'id', 'item', 'purchaseDate', 'reserveNote']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordAgeingItem([], item());
  assert.equal(recordAgeingItem(list, item({ item: 'Other box' })).length, 1);
  assert.equal(recordAgeingItem(list, item({ item: 'Other box' }))[0].item, 'Spare router');
});

test('find and remove', () => {
  const list = recordAgeingItem([], item());
  assert.equal(findAgeingItem(list, 'EA-1').item, 'Spare router');
  assert.equal(findAgeingItem(list, 'nope'), null);
  assert.equal(removeAgeingItem(list, 'EA-1').length, 0);
  assert.equal(removeAgeingItem(list, 'nope').length, 1);
});

test('replacement due date is purchase plus whole years', () => {
  assert.equal(replacementDueDate(item()), '2027-03-10');
  assert.equal(replacementDueDate(item({ purchaseDate: '2020-02-29', expectedLifeYears: 1 })), '2021-02-28');
  assert.equal(replacementDueDate(item({ purchaseDate: '2020-02-29', expectedLifeYears: 4 })), '2024-02-29');
  assert.equal(replacementDueDate(item({ expectedLifeYears: undefined })), null);
});

test('past expected life is strict: due today is not past', () => {
  assert.equal(isPastExpectedLife(item(), '2027-03-09'), false);
  assert.equal(isPastExpectedLife(item(), '2027-03-10'), false);
  assert.equal(isPastExpectedLife(item(), '2027-03-11'), true);
  assert.equal(isPastExpectedLife(item({ expectedLifeYears: undefined }), '2030-01-01'), false);
});

test('sorting: nearest replacement first, no-due-date last, then oldest purchase', () => {
  const list = normalizeAgeingList([
    item({ id: 'EA-3', item: 'Old fan', purchaseDate: '2019-01-01', expectedLifeYears: undefined }),
    item({ id: 'EA-2', item: 'New switch', purchaseDate: '2024-01-01', expectedLifeYears: 2 }),
    item({ id: 'EA-1', item: 'Spare router', purchaseDate: '2022-03-10', expectedLifeYears: 5 }),
  ]);
  assert.deepEqual(ageingSorted(list).map((entry) => entry.id), ['EA-2', 'EA-1', 'EA-3']);
});

test('past-life view and item filter', () => {
  const list = [item(), item({ id: 'EA-2', item: 'New switch', purchaseDate: '2024-01-01', expectedLifeYears: 2 })];
  assert.deepEqual(pastLifeItems(list, '2027-03-11').map((entry) => entry.id), ['EA-2', 'EA-1']);
  assert.deepEqual(pastLifeItems(list, '2025-01-01').map((entry) => entry.id), []);
  assert.deepEqual(ageingForItem(list, 'ROUTER').map((entry) => entry.id), ['EA-1']);
  assert.deepEqual(ageingForItem(list, '').map((entry) => entry.id), ['EA-2', 'EA-1']);
});

test('summary text names past-life count plainly', () => {
  assert.equal(ageingSummaryText([], '2027-01-01'), 'No equipment items recorded.');
  assert.equal(ageingSummaryText([item()], '2026-01-01'), '1 equipment items recorded, none past expected life.');
  assert.equal(ageingSummaryText([item()], '2027-03-11'), '1 equipment items recorded, 1 past expected life.');
});

test('text rendering states due date or its absence, and the flag', () => {
  const textOut = ageingText(item(), '2027-03-11');
  assert.ok(textOut.includes('Replacement due: 2027-03-10'));
  assert.ok(textOut.includes('PAST EXPECTED LIFE'));
  assert.ok(ageingText(item({ expectedLifeYears: undefined }), '2027-01-01').includes('no expected life entered.'));
  assert.equal(ageingText(null), '');
});

test('HTML escapes user text', () => {
  const html = ageingHtml(item({ conditionNote: '<script>alert(1)</script>' }), '2026-01-01');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('CSV columns and filename', () => {
  const csv = equipmentAgeingCsv([item()], '2027-03-11');
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","item","purchaseDate","expectedLifeYears","replacementDue","pastExpectedLife","conditionNote","reserveNote"');
  assert.ok(lines[1].includes('"2027-03-10"'));
  assert.ok(lines[1].includes('"yes"'));
  assert.equal(equipmentAgeingFilename(), 'equipment-ageing.csv');
  assert.ok(ageingAllHtml([item()], '2026-01-01').includes('Spare router'));
});

test('inputs are never mutated', () => {
  const raw = item();
  const before = JSON.stringify(raw);
  recordAgeingItem([], raw);
  ageingSorted([raw]);
  equipmentAgeingCsv([raw], '2027-01-01');
  assert.equal(JSON.stringify(raw), before);
});

test('list normalization drops bad and duplicate entries', () => {
  const list = normalizeAgeingList([item(), item({ item: 'Copy' }), null, item({ purchaseDate: 'bad' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].item, 'Spare router');
});

test('purity fence: no import, no storage, no other record type', () => {
  assert.ok(!/^import /m.test(moduleSrc));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes("from './shop-asset"));
  assert.ok(!moduleSrc.includes("from './equipment-cycle"));
  assert.ok(!moduleSrc.includes('shahdara_shop_assets'));
  assert.ok(!moduleSrc.includes('shahdara_equipment_cycle'));
});

test('panel ids are present in index.html', () => {
  for (const id of ['eaHeading', 'eaSummary', 'eaExportBtn', 'eaItem', 'eaPurchaseDate', 'eaExpectedLife', 'eaConditionNote', 'eaReserveNote', 'eaSaveBtn', 'eaRemoveId', 'eaRemoveBtn', 'eaFilter', 'eaBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wiring: import, store key, render function, render-loop call', () => {
  assert.ok(appJs.includes("from './equipment-ageing.js'"));
  assert.ok(appJs.includes('shahdara_equipment_ageing_v1'));
  assert.ok(appJs.includes('function renderEquipmentAgeing'));
  assert.ok(appJs.includes('renderEquipmentAgeing();'));
});
