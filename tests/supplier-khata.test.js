// SISP-107: Wholesale Hardware Supplier Credit / Payable Khata.
// Pure-function tests on synthetic data only. Spec test criterion
// (verbatim): logging a Rs. 25,000 router batch purchase with
// Rs. 15,000 paid upfront records +10 routers in sisp_inventory_v1 and
// Rs. 10,000 supplier payable in sisp_supplier_khata_v1.
//
// Also pins the house money rules for this register:
//  - the payable is DERIVED (bill minus recorded payments), never stored;
//  - stock enters ONLY through the shipped SISP-18 stock-in path
//    (inventory-book.js addMovement -> sisp_inventory_v1);
//  - cash-outs mirror into Monthly Expenses exactly once each via the
//    convergent syncSupplierKhataExpenses (upfront + payouts total
//    exactly the bill over the purchase's life; re-running is a no-op);
//  - overpayment beyond the payable is refused;
//  - expense categories are existing EXPENSE_CATEGORIES values, so the
//    dashboard P&L buckets the rows with no new category string;
//  - the backup settings.supplierKhata safe-merge round-trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { EXPENSE_CATEGORIES } from '../phase3.js';
import {
  INVENTORY_KEY, addMovement, computeStock, loadInventory, saveInventory
} from '../inventory-book.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  SUPPLIER_KHATA_KEY,
  SUPPLIER_EXPENSE_CATEGORY_BY_ITEM,
  addSupplierPayout,
  addSupplierPurchase,
  buildSupplierExpenseNote,
  buildSupplierPurchaseFields,
  loadSupplierKhata,
  sanitizeSupplierKhata,
  saveSupplierKhata,
  stampStockMovement,
  supplierExpenseCategory,
  supplierExpenseId,
  supplierKhataSummary,
  supplierPaidTotal,
  supplierPayable,
  syncSupplierKhataExpenses
} from '../supplier-khata.js';

function fakeStore() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    _map: map
  };
}

const purchaseInput = (overrides = {}) => ({
  supplierName: 'Fixture Wholesale Traders',
  itemId: 'router',
  qty: 10,
  totalBillPKR: 25000,
  amountPaidNowPKR: 15000,
  date: '2026-10-05',
  note: 'October router batch',
  ...overrides
});

/** Mirrors the app.js onLogPurchase flow: khata add -> SISP-18 stock-in -> stamp -> save both. */
function logPurchaseLikeApp(khataStore, inventoryStore, input) {
  const { records, purchase } = addSupplierPurchase(loadSupplierKhata(khataStore), input);
  const movements = addMovement(loadInventory(inventoryStore), {
    itemId: purchase.itemId,
    kind: 'in',
    qty: purchase.qty,
    date: purchase.date,
    customerName: purchase.supplierName,
    note: `Supplier khata ${purchase.purchaseId}`
  });
  const movement = movements[movements.length - 1];
  const stamped = stampStockMovement(records, purchase.purchaseId, movement?.id ?? '');
  saveSupplierKhata(stamped, khataStore);
  saveInventory(movements, inventoryStore);
  return stamped.find((r) => r.purchaseId === purchase.purchaseId);
}

test('spec criterion verbatim: Rs. 25,000 router batch, Rs. 15,000 upfront => +10 routers in sisp_inventory_v1 and Rs. 10,000 payable in sisp_supplier_khata_v1', () => {
  const khataStore = fakeStore();
  const inventoryStore = fakeStore();
  const purchase = logPurchaseLikeApp(khataStore, inventoryStore, purchaseInput());

  // Khata side: raw storage lives under the spec key, payable derived = 10,000.
  assert.equal(SUPPLIER_KHATA_KEY, 'sisp_supplier_khata_v1');
  const rawKhata = JSON.parse(khataStore._map.get(SUPPLIER_KHATA_KEY));
  assert.equal(rawKhata.length, 1);
  assert.equal(rawKhata[0].purchaseId, 'SUP-101');
  assert.equal(rawKhata[0].supplierName, 'Fixture Wholesale Traders');
  assert.equal(rawKhata[0].totalBillPKR, 25000);
  assert.equal(rawKhata[0].payments.length, 1);
  assert.equal(rawKhata[0].payments[0].kind, 'upfront');
  assert.equal(rawKhata[0].payments[0].amountPKR, 15000);
  // The payable is derived, never a stored free-typed field.
  assert.equal(Object.hasOwn(rawKhata[0], 'pendingSupplierPayablePKR'), false);
  assert.equal(supplierPayable(purchase), 10000);
  assert.equal(supplierPaidTotal(purchase), 15000);

  // Inventory side: the stock-in went through the shipped SISP-18 path.
  const rawInventory = JSON.parse(inventoryStore._map.get(INVENTORY_KEY));
  assert.equal(rawInventory.length, 1);
  assert.equal(rawInventory[0].itemId, 'router');
  assert.equal(rawInventory[0].kind, 'in');
  assert.equal(rawInventory[0].qty, 10);
  const stock = computeStock(loadInventory(inventoryStore));
  assert.equal(stock.find((row) => row.id === 'router').available, 10);
  // The khata record links to the very movement that stocked the routers.
  assert.equal(purchase.stockMovementId, rawInventory[0].id);
});

test('lifecycle pin: 25,000 bill -> 15,000 now + 10,000 payout -> expenses total exactly 25,000, payable 0, sync idempotent', () => {
  const khataStore = fakeStore();
  const inventoryStore = fakeStore();
  logPurchaseLikeApp(khataStore, inventoryStore, purchaseInput());

  // Upfront cash-out mirrors into Expenses exactly once.
  let expenses = [];
  let sync = syncSupplierKhataExpenses(expenses, loadSupplierKhata(khataStore));
  assert.equal(sync.changed, true);
  assert.equal(sync.added, 1);
  expenses = sync.expenses;
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amount, 15000);
  assert.equal(expenses[0].category, 'Routers');
  assert.equal(expenses[0].id, supplierExpenseId('SUP-101-P1'));
  assert.equal(expenses[0].supplierKhataId, 'SUP-101');
  assert.equal(expenses[0].supplierPayoutId, 'SUP-101-P1');
  assert.equal(expenses[0].date, '2026-10-05');

  // Re-running the sync (startup / restore pass) changes nothing.
  const again = syncSupplierKhataExpenses(expenses, loadSupplierKhata(khataStore));
  assert.equal(again.changed, false);
  assert.equal(again.expenses, expenses);

  // Pay the balance: payable hits exactly 0 and expenses total the bill.
  const { records, purchase, payout } = addSupplierPayout(loadSupplierKhata(khataStore), 'SUP-101', { amountPKR: 10000, date: '2026-10-20' });
  saveSupplierKhata(records, khataStore);
  assert.equal(payout.payoutId, 'SUP-101-P2');
  assert.equal(supplierPayable(purchase), 0);
  sync = syncSupplierKhataExpenses(expenses, loadSupplierKhata(khataStore));
  assert.equal(sync.added, 1);
  expenses = sync.expenses;
  assert.equal(expenses.length, 2);
  assert.equal(expenses.reduce((sum, e) => sum + e.amount, 0), 25000);

  // A second payout click on the settled purchase is refused outright,
  // and the sync stays a no-op — the same rupee can never post twice.
  assert.throws(() => addSupplierPayout(loadSupplierKhata(khataStore), 'SUP-101', { amountPKR: 1, date: '2026-10-21' }), /fully paid/);
  const settled = syncSupplierKhataExpenses(expenses, loadSupplierKhata(khataStore));
  assert.equal(settled.changed, false);
  assert.equal(settled.expenses.reduce((sum, e) => sum + e.amount, 0), 25000);
});

test('overpayment beyond the payable is refused; partial payouts stay exact', () => {
  const { records, purchase } = addSupplierPurchase([], purchaseInput({ amountPaidNowPKR: 0 }));
  assert.equal(purchase.payments.length, 0);
  assert.equal(supplierPayable(purchase), 25000);
  assert.throws(() => addSupplierPayout(records, 'SUP-101', { amountPKR: 25001, date: '2026-10-06' }), /exceeds the balance owed/);
  assert.throws(() => addSupplierPayout(records, 'SUP-101', { amountPKR: 0, date: '2026-10-06' }), /greater than zero/);
  const step1 = addSupplierPayout(records, 'SUP-101', { amountPKR: 5000, date: '2026-10-06' });
  assert.equal(supplierPayable(step1.purchase), 20000);
  const step2 = addSupplierPayout(step1.records, 'SUP-101', { amountPKR: 20000, date: '2026-10-07' });
  assert.equal(supplierPayable(step2.purchase), 0);
  const sync = syncSupplierKhataExpenses([], step2.records);
  assert.equal(sync.expenses.reduce((sum, e) => sum + e.amount, 0), 25000);
});

test('sync reconciles corrections: drifted row repaired in place, vanished payment row removed, manual rows untouched', () => {
  const { records } = addSupplierPurchase([], purchaseInput());
  let { expenses } = syncSupplierKhataExpenses([], records);
  const manual = { id: 'manual-1', date: '2026-10-05', amount: 700, category: 'Tools', notes: 'Hand drill', area: '' };
  expenses = [...expenses, manual];

  // Simulate an owner-side drift of the mirrored row (e.g. stale amount).
  const drifted = expenses.map((row) => (row.supplierPayoutId ? { ...row, amount: 1 } : row));
  const repaired = syncSupplierKhataExpenses(drifted, records);
  assert.equal(repaired.updated, 1);
  assert.equal(repaired.expenses.find((row) => row.supplierPayoutId).amount, 15000);
  assert.equal(repaired.expenses.find((row) => row.id === 'manual-1').amount, 700);

  // If the khata payment vanishes (record rebuilt without it), its
  // expense row is removed — the manual row still survives.
  const removed = syncSupplierKhataExpenses(repaired.expenses, []);
  assert.equal(removed.removed, 1);
  assert.deepEqual(removed.expenses.map((row) => row.id), ['manual-1']);
});

test('purchase validation: paid-now above the bill, unknown item, bad qty and bad date are refused', () => {
  assert.throws(() => buildSupplierPurchaseFields(purchaseInput({ amountPaidNowPKR: 25001 })), /cannot exceed the total bill/);
  assert.throws(() => buildSupplierPurchaseFields(purchaseInput({ itemId: 'hoverboard' })), /stock item/);
  assert.throws(() => buildSupplierPurchaseFields(purchaseInput({ qty: 2.5 })), /whole units/);
  assert.throws(() => buildSupplierPurchaseFields(purchaseInput({ supplierName: '  ' })), /Supplier name/);
  assert.throws(() => buildSupplierPurchaseFields(purchaseInput({ date: '2026-02-30' })), /Purchase date/);
  // A fully-paid purchase (paid now = bill) is valid and owes nothing.
  const { purchase } = addSupplierPurchase([], purchaseInput({ amountPaidNowPKR: 25000 }));
  assert.equal(supplierPayable(purchase), 0);
});

test('sanitizer: malformed rows dropped, ids filled from SUP-101, stored payments can never exceed the bill', () => {
  const clean = sanitizeSupplierKhata([
    { supplierName: '', itemId: 'router', qty: 1, totalBillPKR: 100, date: '2026-10-01' },
    { supplierName: 'X', itemId: 'nope', qty: 1, totalBillPKR: 100, date: '2026-10-01' },
    { supplierName: 'X', itemId: 'router', qty: 1, totalBillPKR: -5, date: '2026-10-01' },
    {
      supplierName: 'Fixture', itemId: 'router', qty: 3, totalBillPKR: 1000, date: '2026-10-01',
      payments: [
        { payoutId: 'bogus-id', kind: 'upfront', date: '2026-10-01', amountPKR: 700 },
        { payoutId: 'also-bogus', kind: 'payout', date: '2026-10-02', amountPKR: 700 }
      ]
    }
  ]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].purchaseId, 'SUP-101');
  // Second payment would push the total past the bill — dropped, so the
  // derived payable can never go negative even on hand-edited storage.
  assert.equal(clean[0].payments.length, 1);
  assert.equal(clean[0].payments[0].payoutId, 'SUP-101-P1');
  assert.equal(supplierPayable(clean[0]), 300);
});

test('expense categories: every mapped value is an existing EXPENSE_CATEGORIES member (P&L buckets it)', () => {
  for (const [itemId, category] of Object.entries(SUPPLIER_EXPENSE_CATEGORY_BY_ITEM)) {
    assert.ok(EXPENSE_CATEGORIES.includes(category), `${itemId} -> ${category} must be a real expense category`);
    assert.equal(supplierExpenseCategory(itemId), category);
  }
  assert.equal(supplierExpenseCategory('router'), 'Routers');
  assert.equal(supplierExpenseCategory('fiber-2core'), 'Cable');
  assert.equal(supplierExpenseCategory('media-converter'), 'ONU');
});

test('P&L flow: synced supplier expenses land in the monthly totals and the Routers category bucket', () => {
  const { records } = addSupplierPurchase([], purchaseInput());
  const { expenses } = syncSupplierKhataExpenses([], records);
  const state = { ...createInitialState(), expenses };
  const pnl = calculatePnlAnalytics(state, { selectedMonth: '2026-10', referenceDate: new Date('2026-10-31T00:00:00Z') });
  assert.equal(pnl.selectedMonthCategoryBreakdown.totalExpenses, 15000);
  const routers = pnl.selectedMonthCategoryBreakdown.categories.find((c) => c.category === 'Routers');
  assert.ok(routers, 'expected a Routers bucket in the P&L category breakdown');
  assert.equal(routers.amount, 15000);
  assert.equal(routers.count, 1);
});

test('summary: totals across purchases with open/settled split', () => {
  const a = addSupplierPurchase([], purchaseInput()).records;
  const b = addSupplierPurchase(a, purchaseInput({ supplierName: 'Fiber Fixture Co', itemId: 'fiber-2core', qty: 500, totalBillPKR: 40000, amountPaidNowPKR: 40000, date: '2026-10-07' })).records;
  const summary = supplierKhataSummary(b);
  assert.equal(summary.purchaseCount, 2);
  assert.equal(summary.openCount, 1);
  assert.equal(summary.totalBilledPKR, 65000);
  assert.equal(summary.totalPaidPKR, 55000);
  assert.equal(summary.totalPayablePKR, 10000);
  assert.deepEqual(supplierKhataSummary([]), { purchaseCount: 0, openCount: 0, totalBilledPKR: 0, totalPaidPKR: 0, totalPayablePKR: 0 });
});

test('storage round-trip: save/load through the spec key; corrupt storage loads empty', () => {
  const store = fakeStore();
  const { records } = addSupplierPurchase([], purchaseInput());
  assert.equal(saveSupplierKhata(records, store), true);
  assert.deepEqual(loadSupplierKhata(store), sanitizeSupplierKhata(records));
  store.setItem(SUPPLIER_KHATA_KEY, '{broken json');
  assert.deepEqual(loadSupplierKhata(store), []);
});

test('backup round-trip: settings.supplierKhata adopted only onto an empty device, conflicts otherwise', () => {
  const { records } = addSupplierPurchase([], purchaseInput());
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { supplierKhata: records });
  const doc = JSON.parse(backupText);
  assert.deepEqual(doc.settings.supplierKhata, sanitizeSupplierKhata(records));

  const fresh = previewJsonBackupMerge(createInitialState(), backupText);
  assert.deepEqual(fresh.supplierKhata, sanitizeSupplierKhata(records));
  assert.equal(fresh.counts.supplierKhataRestored, 1);

  const other = addSupplierPurchase([], purchaseInput({ supplierName: 'Other Fixture' })).records;
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentSupplierKhata: other, currentSupplierKhataStored: true });
  assert.equal(clash.supplierKhata, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Supplier khata records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentSupplierKhata: records, currentSupplierKhataStored: true });
  assert.equal(identical.supplierKhata, null);
  assert.ok(!identical.conflicts.some((c) => c.field === 'Supplier khata records differ from this device'));
});

test('expense note names the purchase, supplier, item and payment kind', () => {
  const { purchase } = addSupplierPurchase([], purchaseInput());
  const note = buildSupplierExpenseNote(purchase, purchase.payments[0]);
  assert.match(note, /SUP-101/);
  assert.match(note, /Fixture Wholesale Traders/);
  assert.match(note, /upfront payment/);
});

test('i18n audit: every supkhata_/exp_supplier_ key used by the module, modal and expense table exists in en + ur', () => {
  const moduleSource = readFileSync(new URL('../supplier-khata.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const keys = new Set();
  for (const match of moduleSource.matchAll(/t\('((?:supkhata|exp_supplier)_[a-z_]+)'/g)) keys.add(match[1]);
  for (const match of html.matchAll(/data-i18n="((?:supkhata|exp_supplier)_[a-z_]+)"/g)) keys.add(match[1]);
  for (const match of appSource.matchAll(/t\('((?:supkhata|exp_supplier)_[a-z_]+)'/g)) keys.add(match[1]);
  assert.ok(keys.size >= 25, `expected at least 25 audited keys, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en resolves to the raw key ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur resolves to the raw key ${key}`);
  }
});

test('dark mode: supplier-khata CSS uses theme tokens only (no hardcoded hex)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-107: Supplier Khata');
  assert.ok(start >= 0, 'SISP-107 CSS block present');
  const block = css.slice(start, css.indexOf('/* SISP-48', start));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the supplier-khata CSS block');
  assert.match(block, /var\(--surface\)/);
  assert.match(block, /var\(--line\)/);
});
