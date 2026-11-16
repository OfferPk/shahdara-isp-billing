// Sharafat 83: memoise the derived bill/payment lists by ledger version.
// Pure-function + core-integration tests on synthetic data only.
//
// Counting method: recomputation is observed through referential
// identity — a memoised builder returns the SAME object when it reuses
// and a NEW object when it recomputes. Counting invocations cannot
// prove the memo (a render calls the builders the same number of times
// either way); identity is the only observable that changes.
// Fixtures use generic placeholders only — no customer names, no
// realistic phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDashboard,
  buildMonthlyClosingSnapshot,
  deriveDashboardBillRows,
  calculatePaymentAllocations,
  listTransactions,
  filterCustomersByStatus,
  searchCustomers,
  addPayment,
  getLedgerVersion,
  persistState
} from '../core.js';
import { calculateDashboardKpis } from '../dashboard.js';
import {
  applyActiveDepositOffset,
  reverseActiveDepositOffset
} from '../deposit-to-bill-offset.js';
import { applyDepositSettlement } from '../hardware-custody.js';
import { writeOffBadDebt } from '../bad-debt-ledger.js';
import { syncRoznamchaExpenses } from '../roznamcha.js';

const REF = new Date(2026, 10, 16, 12, 0, 0); // local noon, 16 Nov 2026
const REF_NEXT_DAY = new Date(2026, 10, 17, 12, 0, 0);

function payment(id, date, amount, payer = 'Ahmed', method = 'Cash') {
  return { id, date, amount, method, paidBy: payer, status: 'paid' };
}
function bill(month, dueAmount, payments, overrides = {}) {
  return { month, dueAmount, dueDate: `${month}-05`, payments, ...overrides };
}
// Generic placeholders only.
function customer(id, number, name, overrides = {}) {
  return {
    id, customerNumber: number, name, serviceStatus: 'active', archived: false,
    phone: '03012345678', address: 'Mohalla Charyaa',
    bills: [
      bill('2026-10', 1000, [payment(`${id}-p1`, '2026-10-05', 1000, name)]),
      bill('2026-11', 2000, [
        payment(`${id}-p2`, '2026-11-05', 1000, name),
        payment(`${id}-p3`, '2026-11-10', 500, name),
        payment(`${id}-p4`, '2026-11-16', 250, name)
      ])
    ],
    ...overrides
  };
}
function makeState(customers = null) {
  return {
    customers: customers ?? [customer('c1', '1', 'Ahmed'), customer('c2', '2', 'Bilal'), customer('c3', '3', 'Usman')],
    expenses: [],
    monthlyClosings: []
  };
}
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k)
  };
}

// Engine pending balance + per-bill balances for one synthetic
// customer, exactly as app.js computes them at render/click time.
function engineBalances(cust) {
  const allocations = calculatePaymentAllocations({ customers: [cust] });
  let cents = 0;
  const billBalances = [];
  for (const b of cust.bills ?? []) {
    const summary = allocations.forMonth(cust.id, b.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      cents += summary.balanceDueCents;
      billBalances.push({ month: b.month, balanceDue: summary.balanceDueCents / 100 });
    }
  }
  return { pending: cents / 100, billBalances };
}

// ---- render sequences (same call order as the three renders) ----
// calculateDashboardKpis has no memo of its own — its inner work is
// the three memoised builders it calls, so its site is probed by the
// allocations call that follows it (a recompute inside the KPIs would
// leave a new object in the single-entry slot).
function dashboardRound(state, refDate) {
  const totals = calculateDashboard(state, refDate);
  const cash = buildMonthlyClosingSnapshot(state, totals.currentMonth, refDate);
  const rows = deriveDashboardBillRows(state, refDate);
  const alloc1 = calculatePaymentAllocations(state); // mohalla cards
  const alloc2 = calculatePaymentAllocations(state); // billing groups
  const kpis = calculateDashboardKpis(state, refDate);
  const allocAfterKpis = calculatePaymentAllocations(state); // probes the KPI site
  const alloc3 = calculatePaymentAllocations(state); // KPI defaulters count
  return { totals, cash, rows, alloc1, alloc2, kpis, allocAfterKpis, alloc3 };
}
function transactionsRound(state, refDate, options = {}) {
  const main = listTransactions(state, options, refDate);
  const a = listTransactions(state, {}, refDate);
  const b = listTransactions(state, {}, refDate);
  const c = listTransactions(state, {}, refDate);
  const d = listTransactions(state, {}, refDate);
  return { main, a, b, c, d };
}
function customersRound(state, query = '') {
  const alloc = calculatePaymentAllocations(state);
  const filtered = filterCustomersByStatus(state, { serviceStatus: 'all', billingStatus: 'all', month: '2026-11', customerQuery: query }, REF);
  const searched = query ? searchCustomers(state, query) : null;
  return { alloc, filtered, searched };
}

// ---- 1. Dashboard: two identical rounds, no save -> 0 recomputation ----
test('dashboard round 2 recomputes nothing: totals, closing, bill rows, allocations all reused', () => {
  const state = makeState();
  const first = dashboardRound(state, REF);
  const second = dashboardRound(state, REF);
  assert.equal(second.totals, first.totals);
  assert.equal(second.cash, first.cash);
  assert.equal(second.rows, first.rows);
  assert.equal(second.alloc1, first.alloc1);
  assert.equal(second.alloc2, first.alloc1);
  assert.equal(second.allocAfterKpis, first.alloc1);
  assert.equal(second.alloc3, first.alloc1);
});

test('dashboard round 2: the six flatMap/filter derivations ride one reused bundle', () => {
  const state = makeState();
  const first = dashboardRound(state, REF);
  const second = dashboardRound(state, REF);
  assert.equal(second.rows, first.rows);
  assert.equal(second.rows.todayPayments, 3);
  assert.equal(second.rows.allPayments.length, 12);
  assert.equal(second.rows.retainedBills.length, 6);
});

test('dashboard figures are identical across rounds', () => {
  const state = makeState();
  const first = dashboardRound(state, REF);
  const second = dashboardRound(state, REF);
  assert.equal(JSON.stringify(second.totals), JSON.stringify(first.totals));
  assert.equal(JSON.stringify(second.cash), JSON.stringify(first.cash));
  assert.equal(JSON.stringify(second.kpis), JSON.stringify(first.kpis));
});

// ---- 2. Transactions: 0 walks round 2; 1 walk common / 2 filtered ----
test('transactions round 2 recomputes nothing in the common case (all five calls reuse one walk)', () => {
  const state = makeState();
  const first = transactionsRound(state, REF);
  const second = transactionsRound(state, REF);
  for (const row of [second.main, second.a, second.b, second.c, second.d]) {
    assert.equal(row, first.a);
  }
  assert.equal(first.main.length, 12);
});

test('transactions: exactly 1 ledger walk per render in the common case', () => {
  const state = makeState();
  const round = transactionsRound(state, REF);
  assert.equal(new Set([round.main, round.a, round.b, round.c, round.d]).size, 1);
});

test('transactions: empty filters fold to the unfiltered key (explicit empty options reuse the same walk)', () => {
  const state = makeState();
  const folded = listTransactions(state, { customerQuery: '', date: '', recencyDays: null }, REF);
  const bare = listTransactions(state, {}, REF);
  assert.equal(folded, bare);
});

test('transactions: exactly 2 ledger walks per render when a filter is active (filtered + unfiltered)', () => {
  const state = makeState();
  const round = transactionsRound(state, REF, { customerQuery: 'ahmed' });
  assert.equal(new Set([round.main, round.a, round.b, round.c, round.d]).size, 2);
  assert.equal(round.main.length, 4);
  assert.equal(round.a.length, 12);
});

test('transactions figures are identical across rounds', () => {
  const state = makeState();
  const first = transactionsRound(state, REF);
  const second = transactionsRound(state, REF);
  assert.equal(JSON.stringify(second.a), JSON.stringify(first.a));
});

// ---- 3. Roster: page change with no ledger change -> 0 allocations ----
test('roster page change (empty query): allocation, filter and search all reused', () => {
  const state = makeState();
  const first = customersRound(state, '');
  const second = customersRound(state, '');
  assert.equal(second.alloc, first.alloc);
  assert.equal(second.filtered, first.filtered);
  assert.equal(second.searched, first.searched);
});

test('roster page change (query "ahmed"): allocation, filter and search all reused', () => {
  const state = makeState();
  const first = customersRound(state, 'ahmed');
  const second = customersRound(state, 'ahmed');
  assert.equal(second.alloc, first.alloc);
  assert.equal(second.filtered, first.filtered);
  assert.equal(second.searched, first.searched);
  assert.equal(second.searched.length, 1);
  assert.equal(second.searched[0].id, 'c1');
});

test('roster figures are identical across rounds', () => {
  const state = makeState();
  const first = customersRound(state, '');
  const second = customersRound(state, '');
  assert.deepEqual(second.filtered.map((c) => c.id), first.filtered.map((c) => c.id));
});

// ---- 4. D5: invalidation through every direct-persist path ----
test('D5 deposit offset apply: same state object, slot write + persist -> recompute and figures change', () => {
  const offsetCustomer = customer('c-off', '51', 'Ahmed', {
    securityDeposit: 5000,
    bills: [bill('2026-10', 3000, [], { id: 'bill-oct', status: 'pending' })]
  });
  const state = makeState([offsetCustomer, customer('c2', '2', 'Bilal'), customer('c3', '3', 'Usman')]);
  const before = dashboardRound(state, REF);
  assert.equal(engineBalances(offsetCustomer).pending, 3000);
  const { pending, billBalances } = engineBalances(offsetCustomer);
  const updated = applyActiveDepositOffset(offsetCustomer, pending, { date: '2026-10-15', amount: 3000, billBalances });
  assert.equal(updated.securityDeposit, 2000);
  assert.equal(engineBalances(updated).pending, 0);
  // Exactly what app.js does: slot-write the updated customer into the
  // SAME state object, then persist — identity alone would serve stale.
  state.customers[0] = updated;
  const versionBefore = getLedgerVersion();
  persistState(state, memoryStorage());
  assert.equal(getLedgerVersion(), versionBefore + 1);
  const after = dashboardRound(state, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(after.rows, before.rows);
  assert.notEqual(after.alloc1, before.alloc1);
  assert.notEqual(JSON.stringify(after.totals), JSON.stringify(before.totals));
  assert.equal(calculatePaymentAllocations(state).forMonth('c-off', '2026-10').balanceDueCents, 0);
});

test('D5 deposit settlement: archived customer, slot write + persist -> recompute and figures change', () => {
  const disconnectedCustomer = customer('c-dep', '41', 'Bilal', {
    archived: true,
    archivedAt: '2026-10-05T10:00',
    securityDeposit: 2000,
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'isp-owned',
    routerPrice: 1500,
    mediaConverterCost: 800,
    hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-06' },
    bills: [bill('2026-09', 1200, [], { id: 'bill-sep', status: 'pending' })]
  });
  const state = makeState([disconnectedCustomer, customer('c1', '1', 'Ahmed'), customer('c3', '3', 'Usman')]);
  const before = dashboardRound(state, REF);
  const { pending: arrears, billBalances } = engineBalances(disconnectedCustomer);
  assert.equal(arrears, 1200);
  const settled = applyDepositSettlement(disconnectedCustomer, arrears, { date: '2026-10-29', billBalances });
  assert.equal(settled.depositSettlement.refundAmount, 800);
  state.customers[0] = settled;
  persistState(state, memoryStorage());
  const after = dashboardRound(state, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(after.alloc1, before.alloc1);
  assert.notEqual(JSON.stringify(after.totals), JSON.stringify(before.totals));
  assert.equal(calculatePaymentAllocations(state).forMonth('c-dep', '2026-09').balanceDueCents, 0);
});

test('D5 deposit offset reverse: slot write + persist -> recompute and figures change back', () => {
  const offsetCustomer = customer('c-off', '51', 'Ahmed', {
    securityDeposit: 5000,
    bills: [bill('2026-10', 3000, [], { id: 'bill-oct', status: 'pending' })]
  });
  const state = makeState([offsetCustomer, customer('c2', '2', 'Bilal'), customer('c3', '3', 'Usman')]);
  const { pending, billBalances } = engineBalances(offsetCustomer);
  const applied = applyActiveDepositOffset(offsetCustomer, pending, { date: '2026-10-15', amount: 3000, billBalances });
  state.customers[0] = applied;
  persistState(state, memoryStorage());
  const before = dashboardRound(state, REF);
  assert.equal(engineBalances(applied).pending, 0);
  const reversed = reverseActiveDepositOffset(applied, 'DOF-101', { date: '2026-10-20' });
  assert.equal(reversed.securityDeposit, 5000);
  assert.equal(engineBalances(reversed).pending, 3000);
  state.customers[0] = reversed;
  persistState(state, memoryStorage());
  const after = dashboardRound(state, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(after.alloc1, before.alloc1);
  assert.notEqual(JSON.stringify(after.totals), JSON.stringify(before.totals));
});

test('D5 bad-debt write-off: slot write + persist -> recompute and figures change', () => {
  const churnedCustomer = customer('c-bd', '64', 'Usman', {
    archived: true,
    archivedAt: '2026-10-05T10:00',
    bills: [
      bill('2026-08', 2500, [], { id: 'bill-aug', status: 'pending' }),
      bill('2026-09', 3500, [], { id: 'bill-sep', status: 'pending' })
    ]
  });
  const state = makeState([churnedCustomer, customer('c1', '1', 'Ahmed'), customer('c2', '2', 'Bilal')]);
  const before = dashboardRound(state, REF);
  const { pending: arrears, billBalances } = engineBalances(churnedCustomer);
  assert.equal(arrears, 6000);
  const result = writeOffBadDebt([], churnedCustomer, billBalances, { date: '2026-10-29', reason: 'Uncollectible — customer churned' });
  assert.equal(result.entry.amount, 6000);
  state.customers[0] = result.customer;
  state.badDebts = result.entries;
  persistState(state, memoryStorage());
  const after = dashboardRound(state, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(after.alloc1, before.alloc1);
  assert.notEqual(JSON.stringify(after.totals), JSON.stringify(before.totals));
});

test('D5 Roznamcha expense sync: expenses replaced + persist -> closing snapshot recomputes and figures change', () => {
  const state = makeState();
  const before = buildMonthlyClosingSnapshot(state, '2026-11', REF);
  assert.equal(before.expenses, 0);
  const days = [{
    date: '2026-11-16',
    outflows: [{ id: 'rz-1', amount: 500, category: 'Petrol / Bike Fuel', note: 'Generator fuel' }]
  }];
  const synced = syncRoznamchaExpenses(state.expenses, days, REF);
  assert.equal(synced.changed, true);
  assert.equal(synced.expenses.length, 1);
  assert.equal(synced.expenses[0].amount, 500);
  state.expenses = synced.expenses;
  persistState(state, memoryStorage());
  const after = buildMonthlyClosingSnapshot(state, '2026-11', REF);
  assert.notEqual(after, before);
  assert.equal(after.expenses, 500);
  assert.notEqual(JSON.stringify(after), JSON.stringify(before));
});

// ---- 5. R2: save() with no bill change (identity unchanged) -> recompute ----
test('R2 persist with no ledger change still invalidates: same state object, version bumped, recompute', () => {
  const state = makeState();
  const before = dashboardRound(state, REF);
  const versionBefore = getLedgerVersion();
  // save() persists this exact state object — nothing about the ledger
  // changed, so only the version bump can invalidate the memo.
  persistState(state, memoryStorage());
  assert.equal(getLedgerVersion(), versionBefore + 1);
  const after = dashboardRound(state, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(after.cash, before.cash);
  assert.notEqual(after.rows, before.rows);
  assert.notEqual(after.alloc1, before.alloc1);
  // ...but the figures are unchanged: the recompute is wasted work, not a bug.
  assert.equal(JSON.stringify(after.totals), JSON.stringify(before.totals));
});

test('R2 a real payment via addPayment + persist recomputes and moves the figures', () => {
  const state = makeState();
  const before = dashboardRound(state, REF);
  const state2 = addPayment(state, 'c1', '2026-11', { amount: 500, date: '2026-11-16', method: 'Cash' }, REF);
  persistState(state2, memoryStorage());
  const after = dashboardRound(state2, REF);
  assert.notEqual(after.totals, before.totals);
  assert.notEqual(JSON.stringify(after.totals), JSON.stringify(before.totals));
});

// ---- 6. R4/M4: midnight rollover ----
test('R4 next day recomputes the dashboard (today changed) and today figures move', () => {
  const state = makeState();
  const today = dashboardRound(state, REF);
  const tomorrow = dashboardRound(state, REF_NEXT_DAY);
  assert.notEqual(tomorrow.totals, today.totals);
  assert.notEqual(tomorrow.rows, today.rows);
  assert.equal(today.rows.todayPayments, 3);
  assert.equal(tomorrow.rows.todayPayments, 0);
  assert.notEqual(tomorrow.totals.today, today.totals.today);
});

test('R4 the unfiltered transaction list is day-independent: same object across midnight', () => {
  const state = makeState();
  const today = listTransactions(state, {}, REF);
  const tomorrow = listTransactions(state, {}, REF_NEXT_DAY);
  assert.equal(tomorrow, today);
});

test('R4 the closing snapshot recomputes across days (its stamp is clock-derived)', () => {
  const state = makeState();
  const totals = calculateDashboard(state, REF);
  const today = buildMonthlyClosingSnapshot(state, totals.currentMonth, REF);
  const tomorrow = buildMonthlyClosingSnapshot(state, totals.currentMonth, REF_NEXT_DAY);
  assert.notEqual(tomorrow, today);
});

// ---- 7. R5: recency window ----
test('R5 recencyDays 7 across two dates recomputes and the window slides (boundary payment drops out)', () => {
  const state = makeState();
  const today = listTransactions(state, { recencyDays: 7 }, REF);
  assert.equal(listTransactions(state, { recencyDays: 7 }, REF), today);
  assert.equal(today.length, 6); // 2026-11-10 + 2026-11-16 payments, three customers each
  const tomorrow = listTransactions(state, { recencyDays: 7 }, REF_NEXT_DAY);
  assert.notEqual(tomorrow, today);
  assert.equal(tomorrow.length, 3); // only the 2026-11-16 payments
});

test('R5 recencyDays "all" folds to the unfiltered key', () => {
  const state = makeState();
  const all = listTransactions(state, { recencyDays: 'all' }, REF);
  assert.equal(all, listTransactions(state, {}, REF));
});

// ---- 8. R3: derived-state safety ----
test('R3 a derived state ({...state, customers: subset}) does NOT get the ledger memoised result', () => {
  const state = makeState();
  const ledgerAlloc = calculatePaymentAllocations(state);
  const subset = { ...state, customers: state.customers.slice(0, 1) };
  const derivedAlloc = calculatePaymentAllocations(subset);
  assert.notEqual(derivedAlloc, ledgerAlloc);
  assert.equal(derivedAlloc.forMonth('c1', '2026-11').balanceDueCents, ledgerAlloc.forMonth('c1', '2026-11').balanceDueCents);
  assert.ok(!derivedAlloc.forMonth('c2', '2026-11'));
  // The memo is single-entry (D4): the derived call took the slot, so
  // the next ledger call recomputes — that is correct, not stale: the
  // figures are identical to the ledger result, just a fresh object.
  const ledgerAgain = calculatePaymentAllocations(state);
  assert.notEqual(ledgerAgain, ledgerAlloc);
  assert.deepEqual(ledgerAgain.forMonth('c1', '2026-11'), ledgerAlloc.forMonth('c1', '2026-11'));
  assert.deepEqual(ledgerAgain.forMonth('c2', '2026-11'), ledgerAlloc.forMonth('c2', '2026-11'));
});

test('R3 the derived state has its own memo slot: repeated derived calls reuse, ledger calls stay separate', () => {
  const state = makeState();
  const subset = { ...state, customers: state.customers.slice(0, 1) };
  const first = calculatePaymentAllocations(subset);
  assert.equal(calculatePaymentAllocations(subset), first);
  assert.notEqual(calculatePaymentAllocations(state), first);
});

// ---- 9. R11: figure identity with/without the memo ----
test('R11 figures from a fresh identical state match the memoised figures exactly', () => {
  const stateA = makeState();
  const stateB = makeState();
  assert.equal(JSON.stringify(calculateDashboard(stateA, REF)), JSON.stringify(calculateDashboard(stateB, REF)));
  assert.equal(JSON.stringify(listTransactions(stateA, {}, REF)), JSON.stringify(listTransactions(stateB, {}, REF)));
  assert.deepEqual(
    filterCustomersByStatus(stateA, { serviceStatus: 'all', billingStatus: 'all', month: '2026-11', customerQuery: '' }, REF).map((c) => c.id),
    filterCustomersByStatus(stateB, { serviceStatus: 'all', billingStatus: 'all', month: '2026-11', customerQuery: '' }, REF).map((c) => c.id)
  );
  assert.deepEqual(searchCustomers(stateA, 'ahmed').map((c) => c.id), searchCustomers(stateB, 'ahmed').map((c) => c.id));
});

// ---- 10. R8: no-mutation ----
test('R8 sorting a copy of the returned rows cannot corrupt the memo', () => {
  const state = makeState();
  const rows1 = listTransactions(state, {}, REF);
  const sortedCopy = [...rows1].sort((a, b) => JSON.stringify(b).localeCompare(JSON.stringify(a)));
  assert.notDeepEqual(sortedCopy, rows1);
  assert.equal(listTransactions(state, {}, REF), rows1);
  assert.deepEqual(listTransactions(state, {}, REF), rows1);
});

test('R8 sorting copies of search/filter results cannot corrupt the memo', () => {
  const state = makeState();
  const searched1 = searchCustomers(state, 'a');
  [...searched1].sort((a, b) => b.name.localeCompare(a.name));
  assert.equal(searchCustomers(state, 'a'), searched1);
  const filtered1 = filterCustomersByStatus(state, { serviceStatus: 'all', billingStatus: 'all', month: '2026-11', customerQuery: '' }, REF);
  [...filtered1].sort((a, b) => b.name.localeCompare(a.name));
  assert.equal(filterCustomersByStatus(state, { serviceStatus: 'all', billingStatus: 'all', month: '2026-11', customerQuery: '' }, REF), filtered1);
});

test('R8 the dashboard bundle rows are the same bill objects (read-only consumers share them safely)', () => {
  const state = makeState();
  const rows = deriveDashboardBillRows(state, REF);
  assert.equal(rows.allBillRows[0].bill, state.customers[0].bills[0]);
  assert.equal(deriveDashboardBillRows(state, REF), rows);
});
