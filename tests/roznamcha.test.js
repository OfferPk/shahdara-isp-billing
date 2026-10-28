// SISP-11: Daily Cash Roznamcha (Cash Drawer and Lineman Petty Cash Register).
// Pure-function tests on synthetic data only. Spec test criterion:
// collecting Rs. 6,000 in Cash bills and logging Rs. 500 for lineman
// petrol accurately calculates Net Today Cash as Rs. 5,500 and updates
// the closing drawer balance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROZNAMCHA_KEY,
  ROZNAMCHA_CATEGORIES,
  addRoznamchaOutflow,
  buildRoznamchaDay,
  closeRoznamchaDay,
  collectDirectCashPayments,
  collectShopHandovers,
  deleteRoznamchaOutflow,
  generateRoznamchaSummaryText,
  loadRoznamchaDays,
  openingBalanceFor,
  reopenRoznamchaDay,
  saveRoznamchaDays,
  sanitizeRoznamchaDays
} from '../roznamcha.js';

const DAY = '2026-10-28';

function stateWith(payments) {
  // payments: [{ customer, number, date, method, amount }]
  const byCustomer = new Map();
  for (const p of payments) {
    if (!byCustomer.has(p.customer)) byCustomer.set(p.customer, []);
    byCustomer.get(p.customer).push({ date: p.date, method: p.method, amount: p.amount });
  }
  return {
    customers: [...byCustomer.entries()].map(([name, list]) => ({
      name,
      customerNumber: `C-${name}`,
      bills: [{ month: '2026-10', payments: list }]
    }))
  };
}

function settlements(list) {
  return list.map((s) => ({ shop: s.shop, amount: s.amount, date: s.date }));
}

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, v); }
  };
}

test('spec criterion: Rs. 6,000 cash in + Rs. 500 petrol = Net Today Cash Rs. 5,500', () => {
  const state = stateWith([
    { customer: 'A', date: DAY, method: 'Cash', amount: 4000 },
    { customer: 'B', date: DAY, method: 'Cash', amount: 2000 }
  ]);
  let days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 500, lineman: 'Saad', note: 'Bike petrol' });
  const view = buildRoznamchaDay(state, days, DAY, []);
  assert.equal(view.cashIn, 6000);
  assert.equal(view.outTotal, 500);
  assert.equal(view.netToday, 5500);
  assert.equal(view.expectedClosing, 5500);
  const closed = closeRoznamchaDay(days, view, null);
  const closedView = buildRoznamchaDay(state, closed, DAY, []);
  assert.equal(closedView.closed, true);
  assert.equal(closedView.closingBalance, 5500);
  assert.equal(closedView.discrepancy, 0);
});

test('shop-method bill payments are not direct drawer cash; shop handovers are', () => {
  const state = stateWith([
    { customer: 'A', date: DAY, method: 'Cash at Waseem Abbasi shop', amount: 3000 },
    { customer: 'B', date: DAY, method: 'JazzCash', amount: 1000 },
    { customer: 'C', date: DAY, method: 'Cash', amount: 500 }
  ]);
  assert.equal(collectDirectCashPayments(state, DAY).length, 1);
  const view = buildRoznamchaDay(state, [], DAY, settlements([
    { shop: 'Waseem Abbasi Shop', amount: 3000, date: DAY },
    { shop: 'Hassan Shop', amount: 700, date: '2026-10-27' }
  ]));
  assert.equal(view.cashIn, 500);
  assert.equal(view.shopIn, 3000);
  assert.equal(view.totalIn, 3500);
});

test('opening balance carries from the latest closed day only', () => {
  const yesterday = '2026-10-27';
  const older = '2026-10-25';
  const days = [
    { date: older, outflows: [], closed: true, openingBalance: 0, cashIn: 2000, shopIn: 0, cashPayments: [], handovers: [], expectedClosing: 2000, closingBalance: 2000, countedCash: 2000, discrepancy: 0 },
    { date: yesterday, outflows: [], closed: true, openingBalance: 2000, cashIn: 500, shopIn: 0, cashPayments: [], handovers: [], expectedClosing: 2500, closingBalance: 2500, countedCash: 2500, discrepancy: 0 }
  ];
  assert.equal(openingBalanceFor(days, DAY), 2500);
  assert.equal(openingBalanceFor([], DAY), 0);
  // An unclosed previous day does not carry.
  const unclosed = [{ date: yesterday, outflows: [], closed: false }];
  assert.equal(openingBalanceFor(unclosed, DAY), 0);
});

test('close day records short/extra discrepancy; counted empty means expected', () => {
  const state = stateWith([{ customer: 'A', date: DAY, method: 'Cash', amount: 5500 }]);
  const view = buildRoznamchaDay(state, [], DAY, []);
  assert.equal(view.expectedClosing, 5500);
  const short = closeRoznamchaDay([], view, 5400);
  const shortView = buildRoznamchaDay(state, short, DAY, []);
  assert.equal(shortView.closingBalance, 5400);
  assert.equal(shortView.discrepancy, -100);
  const extra = closeRoznamchaDay([], view, 5600);
  assert.equal(buildRoznamchaDay(state, extra, DAY, []).discrepancy, 100);
  const even = closeRoznamchaDay([], view, null);
  assert.equal(buildRoznamchaDay(state, even, DAY, []).discrepancy, 0);
});

test('closed day is frozen when later payments change', () => {
  const state = stateWith([{ customer: 'A', date: DAY, method: 'Cash', amount: 1000 }]);
  const view = buildRoznamchaDay(state, [], DAY, []);
  const closed = closeRoznamchaDay([], view, null);
  const richer = stateWith([
    { customer: 'A', date: DAY, method: 'Cash', amount: 1000 },
    { customer: 'B', date: DAY, method: 'Cash', amount: 9000 }
  ]);
  const frozen = buildRoznamchaDay(richer, closed, DAY, []);
  assert.equal(frozen.cashIn, 1000);
  assert.equal(frozen.closingBalance, 1000);
});

test('closed day blocks outflow add/delete; reopen restores live day', () => {
  const state = stateWith([{ customer: 'A', date: DAY, method: 'Cash', amount: 1000 }]);
  const view = buildRoznamchaDay(state, [], DAY, []);
  const closed = closeRoznamchaDay([], view, null);
  assert.throws(() => addRoznamchaOutflow(closed, DAY, { category: 'Other', amount: 10 }), /closed/);
  assert.throws(() => deleteRoznamchaOutflow(closed, DAY, 'out-x'), /closed/);
  const reopened = reopenRoznamchaDay(closed, DAY);
  const live = buildRoznamchaDay(state, reopened, DAY, []);
  assert.equal(live.closed, false);
  assert.equal(live.cashIn, 1000);
});

test('outflow add/delete on an open day; invalid rows rejected', () => {
  let days = addRoznamchaOutflow([], DAY, { category: 'RJ45 / Patch Cord', amount: 250, lineman: 'Saad', note: '' });
  assert.equal(days.length, 1);
  assert.equal(days[0].outflows.length, 1);
  const id = days[0].outflows[0].id;
  assert.throws(() => addRoznamchaOutflow(days, DAY, { category: 'Nope', amount: 10 }), /valid/);
  assert.throws(() => addRoznamchaOutflow(days, DAY, { category: 'Other', amount: 0 }), /valid/);
  assert.throws(() => addRoznamchaOutflow(days, DAY, { category: 'Other', amount: -5 }), /valid/);
  days = deleteRoznamchaOutflow(days, DAY, id);
  assert.equal(days[0].outflows.length, 0);
  assert.ok(ROZNAMCHA_CATEGORIES.includes('Petrol / Bike Fuel'));
});

test('sanitize drops bad days and bad outflows, keeps good snapshots', () => {
  const cleaned = sanitizeRoznamchaDays([
    null,
    { date: 'not-a-date', outflows: [], closed: false },
    { date: DAY, outflows: [{ category: 'Other', amount: 100 }, { category: 'Bogus', amount: 50 }, { category: 'Other', amount: -5 }], closed: false },
    { date: '2026-10-27', outflows: [], closed: true, openingBalance: 100, cashIn: 100, shopIn: 0, cashPayments: [], handovers: [], expectedClosing: 100, closingBalance: 100, countedCash: 100, discrepancy: 0 }
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].date, '2026-10-27');
  assert.equal(cleaned[1].outflows.length, 1);
  assert.equal(cleaned[1].outflows[0].amount, 100);
});

test('load/save round-trip through a fake storage object', () => {
  const storage = fakeStorage();
  assert.deepEqual(loadRoznamchaDays(storage), []);
  const days = [{ date: DAY, outflows: [{ category: 'Other', amount: 10, lineman: '', note: '' }], closed: false }];
  saveRoznamchaDays(days, storage);
  assert.equal(storage.getItem(ROZNAMCHA_KEY) !== null, true);
  const loaded = loadRoznamchaDays(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].outflows[0].amount, 10);
});

test('summary text carries opening, inflows, outflows, net, expected and farq', () => {
  const state = stateWith([{ customer: 'A', date: DAY, method: 'Cash', amount: 6000 }]);
  let days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 500, lineman: 'Saad', note: '' });
  const view = buildRoznamchaDay(state, days, DAY, []);
  const closed = closeRoznamchaDay(days, view, 5400);
  const text = generateRoznamchaSummaryText(buildRoznamchaDay(state, closed, DAY, []));
  assert.match(text, /Opening: PKR 0/);
  assert.match(text, /Total cash in: PKR 6,000/);
  assert.match(text, /Petrol \/ Bike Fuel: PKR 500/);
  assert.match(text, /Net today cash: PKR 5,500/);
  assert.match(text, /Expected closing: PKR 5,500/);
  assert.match(text, /Counted cash: PKR 5,400/);
  assert.match(text, /SHORT/);
  assert.match(text, /Closing balance: PKR 5,400/);
});
