// SISP-1: Shop Collector Cash Handover & Settlement Ledger.
// Pure-function tests on synthetic data only. Spec test criteria:
// a Rs. 3,000 payment via Cash at Waseem Abbasi shop raises that shop's
// unsettled balance by Rs. 3,000; settling Rs. 3,000 drops it to 0 and logs
// a permanent entry in sisp_shop_settlements_v1 (which JSON backups carry).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHOP_SETTLEMENTS_KEY,
  resolveShopCollector,
  collectShopPayments,
  buildShopSummaries,
  pendingShopReceipts,
  loadShopSettlements,
  saveShopSettlements,
  sanitizeShopSettlements,
  allocateSettlement,
  applySettlement,
  generateShopSettlementReceiptText
} from '../shop-settlement.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });

function fixture() {
  return {
    customers: [
      customer('c1', 11, 'Test Customer 11', [
        bill('2026-10', [
          payment('p1', { date: '2026-10-06', amount: 3000, method: 'Cash at Waseem Abbasi shop' }),
          payment('p2', { date: '2026-10-07', amount: 1500, method: 'Cash at Waseem Abbasi shop' })
        ])
      ]),
      customer('c2', 9, 'Test Customer 09', [
        bill('2026-10', [
          payment('p3', { date: '2026-10-08', amount: 2000, method: 'Cash at Hassan shop' })
        ])
      ]),
      customer('c3', 73, 'Test Customer 73', [
        bill('2026-10', [
          payment('p4', { date: '2026-10-09', amount: 5000, method: 'Cash' }),
          payment('p5', { date: '2026-10-10', amount: 4000, method: 'JazzCash' })
        ])
      ])
    ]
  };
}

test('shop collector detection: known shops, custom shops, non-shop methods', () => {
  assert.equal(resolveShopCollector('Cash at Waseem Abbasi shop'), 'Waseem Abbasi Shop');
  assert.equal(resolveShopCollector('Cash at Hassan shop'), 'Hassan Shop');
  assert.equal(resolveShopCollector('Cash at Balla shop'), 'Balla Shop');
  assert.equal(resolveShopCollector('Cash', 'Balla'), 'Balla Shop');
  assert.equal(resolveShopCollector('Cash at New Town shop'), 'New Town Shop');
  assert.equal(resolveShopCollector('Cash', 'Waseem'), 'Waseem Abbasi Shop');
  assert.equal(resolveShopCollector('Cash'), null);
  assert.equal(resolveShopCollector('JazzCash'), null);
  assert.equal(resolveShopCollector('Bank Transfer'), null);
  assert.equal(resolveShopCollector(''), null);
  assert.equal(resolveShopCollector(null), null);
});

test('spec criteria: Rs. 3,000 Waseem payment raises unsettled by Rs. 3,000', () => {
  const state = { customers: [customer('c1', 11, 'Test Customer 11', [
    bill('2026-10', [payment('p1', { date: '2026-10-06', amount: 3000, method: 'Cash at Waseem Abbasi shop' })])
  ])] };
  const summaries = buildShopSummaries(state, [], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].shop, 'Waseem Abbasi Shop');
  assert.equal(summaries[0].unsettled, 3000);
  assert.equal(summaries[0].totalCollected, 3000);
  assert.equal(summaries[0].collectedThisMonth, 3000);
  assert.equal(summaries[0].receiptsSinceLastSettlement, 1);
  assert.equal(summaries[0].lastHandoverDate, null);
});

test('spec criteria: settling Rs. 3,000 drops unsettled to 0 and logs a permanent entry', () => {
  const state = fixture();
  const storage = memoryStorage();
  const { state: next, settlement, leftover } = applySettlement(state, 'Waseem Abbasi Shop', 3000, '2026-10-27', 'Handover');
  assert.equal(leftover, 0);
  assert.equal(settlement.shop, 'Waseem Abbasi Shop');
  assert.equal(settlement.amount, 3000);
  assert.equal(settlement.allocations.length, 1);
  assert.equal(settlement.allocations[0].paymentId, 'p1');
  assert.ok(saveShopSettlements([...loadShopSettlements(storage), settlement], storage));
  const stored = loadShopSettlements(storage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, settlement.id);
  assert.equal(stored[0].amount, 3000);
  const summaries = buildShopSummaries(next, stored, new Date(Date.UTC(2026, 9, 27, 7)));
  const waseem = summaries.find((s) => s.shop === 'Waseem Abbasi Shop');
  assert.equal(waseem.unsettled, 1500, 'only the second receipt (1500) remains unsettled');
  assert.equal(waseem.lastHandoverDate, '2026-10-27');
  // Settle the rest: unsettled reaches exactly 0.
  const second = applySettlement(next, 'Waseem Abbasi Shop', 1500, '2026-10-28', '');
  const summaries2 = buildShopSummaries(second.state, [...stored, second.settlement], new Date(Date.UTC(2026, 9, 28, 7)));
  assert.equal(summaries2.find((s) => s.shop === 'Waseem Abbasi Shop').unsettled, 0);
  assert.equal(pendingShopReceipts(second.state, 'Waseem Abbasi Shop').length, 0);
});

test('partial settlement: FIFO oldest first, remainder stays unsettled', () => {
  const state = fixture();
  const { state: next, settlement, leftover } = applySettlement(state, 'Waseem Abbasi Shop', 4000, '2026-10-27', 'Partial');
  assert.equal(leftover, 0);
  assert.equal(settlement.amount, 4000);
  assert.deepEqual(settlement.allocations.map((a) => a.paymentId), ['p1', 'p2']);
  assert.deepEqual(settlement.allocations.map((a) => a.amount), [3000, 1000]);
  const summaries = buildShopSummaries(next, [settlement], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries.find((s) => s.shop === 'Waseem Abbasi Shop').unsettled, 500);
  const pending = pendingShopReceipts(next, 'Waseem Abbasi Shop');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].paymentId, 'p2');
  assert.equal(pending[0].settledAmount, 1000);
  assert.equal(pending[0].remaining, 500);
  assert.equal(pending[0].shopSettled, false);
});

test('per-shop separation: settling one shop never touches the other', () => {
  const state = fixture();
  const { state: next } = applySettlement(state, 'Waseem Abbasi Shop', 4500, '2026-10-27', '');
  const summaries = buildShopSummaries(next, [], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries.find((s) => s.shop === 'Waseem Abbasi Shop').unsettled, 0);
  assert.equal(summaries.find((s) => s.shop === 'Hassan Shop').unsettled, 2000);
  assert.equal(collectShopPayments(next).filter((p) => p.shop === 'Hassan Shop' && p.shopSettled).length, 0);
});

test('allocation caps at the unsettled total and reports the leftover', () => {
  const pending = pendingShopReceipts(fixture(), 'Hassan Shop');
  const { allocations, covered, leftover } = allocateSettlement(pending, 5000);
  assert.equal(covered, 2000);
  assert.equal(leftover, 3000);
  assert.equal(allocations.length, 1);
});

test('applySettlement rejects bad input and never mutates the input state', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 0, '2026-10-27', ''));
  assert.throws(() => applySettlement(state, 'No Such Shop', 100, '2026-10-27', ''));
  assert.equal(JSON.stringify(state), before, 'input state untouched');
  const { state: next } = applySettlement(state, 'Hassan Shop', 500, '2026-10-27', '');
  assert.equal(JSON.stringify(state), before, 'input state untouched after success');
  assert.notEqual(JSON.stringify(next), before);
});

test('shop summaries: this-month totals, last handover, receipts since settlement', () => {
  const state = fixture();
  const old = { id: 's-old', shop: 'Waseem Abbasi Shop', amount: 1000, date: '2026-10-07', note: '', allocations: [], createdAt: '' };
  const summaries = buildShopSummaries(state, [old], new Date(Date.UTC(2026, 9, 27, 7)));
  const waseem = summaries.find((s) => s.shop === 'Waseem Abbasi Shop');
  assert.equal(waseem.totalCollected, 4500);
  assert.equal(waseem.collectedThisMonth, 4500);
  assert.equal(waseem.lastHandoverDate, '2026-10-07');
  assert.equal(waseem.receiptsSinceLastSettlement, 0, 'both receipts are dated on/before the handover');
  // A receipt dated after the handover counts.
  state.customers[0].bills[0].payments.push(
    payment('p6', { date: '2026-10-20', amount: 700, method: 'Cash at Waseem Abbasi shop' })
  );
  const summaries2 = buildShopSummaries(state, [old], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries2.find((s) => s.shop === 'Waseem Abbasi Shop').receiptsSinceLastSettlement, 1);
});

test('settlement storage: corrupt or missing data degrades to []', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadShopSettlements(storage), []);
  storage.setItem(SHOP_SETTLEMENTS_KEY, 'not json{{{');
  assert.deepEqual(loadShopSettlements(storage), []);
  storage.setItem(SHOP_SETTLEMENTS_KEY, JSON.stringify({ not: 'an array' }));
  assert.deepEqual(loadShopSettlements(storage), []);
  const cleaned = sanitizeShopSettlements([
    { id: 'ok', shop: 'Waseem Abbasi Shop', amount: 100, date: '2026-10-27', note: '', allocations: [] },
    { id: 'bad-amount', shop: 'Hassan Shop', amount: -5, date: '2026-10-27' },
    { id: 'bad-date', shop: 'Hassan Shop', amount: 100, date: 'tomorrow' },
    { shop: 'Hassan Shop', amount: 100, date: '2026-10-27' },
    null
  ]);
  assert.equal(cleaned.length, 2, 'bad amount, bad date and null are dropped');
  assert.equal(cleaned[0].id, 'ok');
  assert.match(cleaned[1].id, /^shop-settle-/, 'an entry without an id is kept with a generated id');
});

test('settlement receipt text lists shop, amount, allocations and remainder', () => {
  const settlement = {
    id: 'shop-settle-1', shop: 'Waseem Abbasi Shop', amount: 3000, date: '2026-10-27', note: 'Cash received',
    allocations: [{ customerNumber: 11, customerName: 'Test Customer 11', date: '2026-10-06', amount: 3000 }]
  };
  const text = generateShopSettlementReceiptText({ shop: 'Waseem Abbasi Shop', settlement, remainingUnsettled: 1500 });
  assert.match(text, /Waseem Abbasi Shop/);
  assert.match(text, /2026-10-27/);
  assert.match(text, /PKR 3,000/);
  assert.match(text, /Test Customer 11/);
  assert.match(text, /PKR 1,500/);
  assert.match(text, /shop-settle-1/);
});

test('JSON backup carries shop settlements and restores them under safe-merge rules', () => {
  const settlements = [{ id: 's1', shop: 'Waseem Abbasi Shop', amount: 3000, date: '2026-10-27', note: '', allocations: [], createdAt: '' }];
  const doc = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00'), { shopSettlements: settlements }));
  assert.deepEqual(doc.settings.shopSettlements, settlements);
  const empty = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00'), { shopSettlements: [] }));
  assert.equal(empty.settings, undefined);
  const legacy = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00')));
  assert.equal(legacy.settings, undefined);

  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00'), { shopSettlements: settlements });
  const adopted = previewJsonBackupMerge(createInitialState(), backupText, { currentShopSettlements: [], currentShopSettlementsStored: false });
  assert.equal(adopted.counts.shopSettlementsRestored, 1);
  assert.deepEqual(adopted.shopSettlements, settlements);
  const kept = previewJsonBackupMerge(createInitialState(), backupText, {
    currentShopSettlements: [{ id: 'other', shop: 'Hassan Shop', amount: 500, date: '2026-10-20', note: '', allocations: [], createdAt: '' }],
    currentShopSettlementsStored: true
  });
  assert.equal(kept.counts.shopSettlementsRestored, 0);
  assert.equal(kept.shopSettlements, null);
  assert.ok(kept.conflicts.some((c) => c.field === 'Shop settlement records differ from this device'));
});

test('Balla Shop: a Rs. 2,000 Cash at Balla shop payment raises Balla unsettled by Rs. 2,000', () => {
  const state = { customers: [customer('c1', 11, 'Test Customer 11', [
    bill('2026-10', [payment('p1', { date: '2026-10-06', amount: 2000, method: 'Cash at Balla shop' })])
  ])] };
  const summaries = buildShopSummaries(state, [], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].shop, 'Balla Shop');
  assert.equal(summaries[0].unsettled, 2000);
  assert.equal(summaries[0].totalCollected, 2000);
  assert.equal(summaries[0].collectedThisMonth, 2000);
  assert.equal(summaries[0].receiptsSinceLastSettlement, 1);
  assert.equal(summaries[0].lastHandoverDate, null);
});
