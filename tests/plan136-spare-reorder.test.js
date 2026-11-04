import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSpareReorder,
  normalizeSpareReorderList,
  findSpareReorder,
  upsertSpareReorder,
  removeSpareReorder,
  spareReorderStatus,
  lowSpareReorders,
  markSpareOrdered,
  spareReorderCounts,
  spareReorderSummaryText,
  spareReorderHtml,
  spareReorderCsv,
  spareReorderFilename,
} from '../spare-reorder.js';

const rule = (over = {}) => ({
  id: 'SR-1',
  part: 'SC Connector',
  minimumLevel: 10,
  reorderQuantity: 50,
  onHand: 25,
  ...over,
});

test('a rule with no id or no part is refused', () => {
  assert.equal(normalizeSpareReorder(rule({ id: '' })), null);
  assert.equal(normalizeSpareReorder(rule({ id: '   ' })), null);
  assert.equal(normalizeSpareReorder(rule({ part: '' })), null);
  assert.equal(normalizeSpareReorder(rule({ part: '   ' })), null);
  assert.equal(normalizeSpareReorder(rule({ part: null })), null);
  assert.equal(normalizeSpareReorder(null), null);
  assert.equal(normalizeSpareReorder('nope'), null);
});

test('level rules: negative minimum, bad reorder quantity, negative on-hand refused', () => {
  assert.equal(normalizeSpareReorder(rule({ minimumLevel: -1 })), null);
  assert.equal(normalizeSpareReorder(rule({ minimumLevel: 2.5 })), null);
  assert.equal(normalizeSpareReorder(rule({ minimumLevel: 'abc' })), null);
  assert.equal(normalizeSpareReorder(rule({ reorderQuantity: 0 })), null);
  assert.equal(normalizeSpareReorder(rule({ reorderQuantity: -5 })), null);
  assert.equal(normalizeSpareReorder(rule({ reorderQuantity: 1.5 })), null);
  assert.equal(normalizeSpareReorder(rule({ onHand: -1 })), null);
  assert.equal(normalizeSpareReorder(rule({ onHand: 2.5 })), null);
  assert.equal(normalizeSpareReorder(rule({ onHand: null })), null);
});

test('zero minimum and zero on-hand are valid; numeric strings are coerced', () => {
  const clean = normalizeSpareReorder(rule({ minimumLevel: 0, onHand: 0 }));
  assert.equal(clean.minimumLevel, 0);
  assert.equal(clean.onHand, 0);
  assert.equal(spareReorderStatus(clean), 'low');
  const coerced = normalizeSpareReorder(rule({ minimumLevel: '10', reorderQuantity: '50', onHand: '25' }));
  assert.equal(coerced.minimumLevel, 10);
  assert.equal(coerced.reorderQuantity, 50);
  assert.equal(coerced.onHand, 25);
});

test('unknown fields are dropped', () => {
  const clean = normalizeSpareReorder(rule({ orderId: 'PO-9', vendor: 'Shop X', stockCount: 99, bill: 500 }));
  assert.deepEqual(Object.keys(clean).sort(), ['id', 'minimumLevel', 'onHand', 'ordered', 'part', 'reorderQuantity']);
  assert.equal(clean.ordered, false);
});

test('a duplicate id is never rewritten', () => {
  const base = upsertSpareReorder([], rule());
  const identical = upsertSpareReorder(base, rule());
  assert.deepEqual(identical, base);
  const changed = upsertSpareReorder(base, rule({ onHand: 3 }));
  assert.deepEqual(changed, base);
  assert.equal(changed.length, 1);
});

test('one rule per part: a second rule for the same part is refused', () => {
  const base = upsertSpareReorder([], rule());
  assert.equal(upsertSpareReorder(base, rule({ id: 'SR-2' })).length, 1);
  assert.equal(upsertSpareReorder(base, rule({ id: 'SR-2', part: 'sc connector' })).length, 1);
  assert.equal(upsertSpareReorder(base, rule({ id: 'SR-2', part: '  SC Connector  ' })).length, 1);
  assert.equal(upsertSpareReorder(base, rule({ id: 'SR-2', part: 'Splitter 1:8' })).length, 2);
});

test('status: above minimum is ok, at or below minimum is low, ordered wins over low', () => {
  assert.equal(spareReorderStatus(rule({ onHand: 11 })), 'ok');
  assert.equal(spareReorderStatus(rule({ onHand: 10 })), 'low');
  assert.equal(spareReorderStatus(rule({ onHand: 0 })), 'low');
  assert.equal(spareReorderStatus(rule({ onHand: 0, ordered: true })), 'ordered');
  assert.equal(spareReorderStatus(rule({ onHand: 25, ordered: true })), 'ordered');
  assert.equal(spareReorderStatus(rule({ onHand: 25, ordered: 'yes' })), 'ok');
  assert.equal(spareReorderStatus({}), null);
});

test('low-stock list holds only low rules, part A-Z, ordered rules excluded', () => {
  let list = [];
  list = upsertSpareReorder(list, rule({ id: 'SR-1', part: 'Splitter', onHand: 2 }));
  list = upsertSpareReorder(list, rule({ id: 'SR-2', part: 'Connector', onHand: 10, minimumLevel: 10 }));
  list = upsertSpareReorder(list, rule({ id: 'SR-3', part: 'Cable', onHand: 40 }));
  list = upsertSpareReorder(list, rule({ id: 'SR-4', part: 'Adapter', onHand: 0, ordered: true }));
  assert.deepEqual(lowSpareReorders(list).map((item) => item.part), ['Connector', 'Splitter']);
});

test('marking ordered clears the flag without changing the level on hand', () => {
  const before = upsertSpareReorder([], rule({ onHand: 2 }));
  const after = markSpareOrdered(before, 'SR-1');
  assert.equal(after[0].ordered, true);
  assert.equal(after[0].onHand, 2);
  assert.equal(spareReorderStatus(after[0]), 'ordered');
  assert.deepEqual(lowSpareReorders(after), []);
  assert.equal(before[0].ordered, false);
  assert.deepEqual(markSpareOrdered(before, 'SR-9'), before);
  assert.deepEqual(markSpareOrdered(before, ''), before);
});

test('marking ordered never places an order or moves a count: only the flag changes', () => {
  const before = upsertSpareReorder([], rule({ onHand: 2 }));
  const after = markSpareOrdered(before, 'SR-1');
  assert.deepEqual({ ...after[0], ordered: false }, before[0]);
});

test('remove works; an unknown id leaves the list unchanged', () => {
  const list = upsertSpareReorder([], rule());
  assert.deepEqual(removeSpareReorder(list, 'SR-1'), []);
  assert.deepEqual(removeSpareReorder(list, 'SR-9'), list);
  assert.deepEqual(removeSpareReorder(list, ''), list);
});

test('find and list normalisation drop invalid entries and non-lists', () => {
  assert.deepEqual(normalizeSpareReorderList(null), []);
  assert.deepEqual(normalizeSpareReorderList([rule(), rule({ part: '' }), 'junk']), [normalizeSpareReorder(rule())]);
  const list = upsertSpareReorder([], rule());
  assert.equal(findSpareReorder(list, 'SR-1').part, 'SC Connector');
  assert.equal(findSpareReorder(list, 'SR-9'), null);
  assert.equal(findSpareReorder(list, ''), null);
});

test('inputs are never mutated', () => {
  const input = rule({ onHand: 2 });
  const snapshot = { ...input };
  markSpareOrdered([input], 'SR-1');
  upsertSpareReorder([input], rule({ id: 'SR-2', part: 'Other' }));
  assert.deepEqual(input, snapshot);
});

test('summary text counts rules by status', () => {
  assert.equal(spareReorderSummaryText([]), 'No spare reorder rule recorded yet.');
  let list = [];
  list = upsertSpareReorder(list, rule({ id: 'SR-1', onHand: 2 }));
  list = upsertSpareReorder(list, rule({ id: 'SR-2', part: 'Other', onHand: 40 }));
  assert.equal(spareReorderSummaryText(list), '2 reorder rules: 1 low, 0 ordered, 1 ok.');
  assert.deepEqual(spareReorderCounts(list), { rules: 2, ok: 1, low: 1, ordered: 0 });
});

test('html shows the low list, says plainly when nothing is low, and escapes part names', () => {
  assert.match(spareReorderHtml([]), /No spare reorder rule/);
  const okOnly = upsertSpareReorder([], rule());
  assert.match(spareReorderHtml(okOnly), /No part is at or below its minimum/);
  const low = upsertSpareReorder([], rule({ part: '<Splitter & Sons>', onHand: 1 }));
  const html = spareReorderHtml(low);
  assert.match(html, /Low stock/);
  assert.match(html, /&lt;Splitter &amp; Sons&gt;/);
  assert.doesNotMatch(html, /<Splitter/);
});

test('csv rows carry the derived status and the filename is stable', () => {
  const list = upsertSpareReorder([], rule({ onHand: 2 }));
  const csv = spareReorderCsv(list);
  assert.equal(csv.split('\n')[0], 'id,part,on_hand,minimum_level,reorder_quantity,status');
  assert.match(csv, /SR-1,SC Connector,2,10,50,low/);
  assert.equal(spareReorderFilename(), 'spare-reorder.csv');
});
