// SISP-56: Saad Visit Log ↔ Lineman Tickets & Salary/Commission P&L Sync.
// Pure-function tests on synthetic data only. Spec test criterion:
// recording a Rs. 5,000 commission payout to Saad updates Saad's monthly
// summary and deducts Rs. 5,000 from monthly net profit (Rs. 2,500 per
// partner) without duplication.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAAD_DRAWER_ROZNAMCHA_CATEGORY,
  SAAD_EXPENSE_CATEGORY,
  addSaadPayment,
  addSaadVisit,
  buildMonthlySaadSummary,
  buildSaadPaymentExpenseNotes,
  deleteSaadPayment,
  sanitizeSaadPayments,
  syncSaadPaymentLedgers,
  syncedSaadDrawerOutflowId,
  syncedSaadExpenseId,
  updateSaadPayment
} from '../saad-visits.js';
import {
  buildRoznamchaDay,
  syncRoznamchaExpenses
} from '../roznamcha.js';
import {
  buildVisitPrefillFromTicket,
  isSaadTechnician,
  visitTypeForTicket
} from '../complaint-tickets.js';
import { buildPartnerShareReport } from '../phase3.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-28T12:00:00Z');

function revenueState(expenses = []) {
  // October 2026 revenue Rs. 250,000 (same shape as roznamcha-expense-sync.test.js).
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Test Customer A', bills: [
        { month: '2026-10', payments: [
          { id: 'p1', date: '2026-10-05', amount: 120000, method: 'Cash' },
          { id: 'p2', date: '2026-10-20', amount: 80000, method: 'Cash' }
        ] }
      ] },
      { id: 'c2', customerNumber: 2, name: 'Test Customer B', bills: [
        { month: '2026-10', payments: [
          { id: 'p4', date: '2026-10-07', amount: 50000, method: 'Cash' }
        ] }
      ] }
    ],
    expenses
  };
}

function pnlMonth(state, month = '2026-10') {
  const pnl = calculatePnlAnalytics(state, { selectedMonth: month, referenceDate: REF });
  return pnl.monthlyData.find((m) => m.month === month);
}

test('spec criterion: Rs. 5,000 commission payout → Saad summary +5,000, net profit −5,000, each partner share −2,500, no duplication', () => {
  const manual = [{ id: 'e1', date: '2026-10-03', amount: 15000, category: 'Nayatel bill', notes: '', area: '' }];
  const state = revenueState(manual);
  const before = buildPartnerShareReport(state, '2026-10', REF);
  assert.equal(before.summary.expenses, 15000);
  assert.equal(before.summary.share, 117500);
  const pnlBefore = pnlMonth(state);
  assert.equal(pnlBefore.expenses, 15000);
  assert.equal(pnlBefore.netProfit, 235000);

  // Record the payout in the Saad Visit Log (the operator's own record).
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'commission', amount: 5000, note: 'Splicing commission' });
  const summary = buildMonthlySaadSummary([], payments, '2026-10');
  assert.equal(summary.commissionTotal, 5000);
  assert.equal(summary.grandTotal, 5000);

  // Sync: exactly one expense mirror appears.
  const result = syncSaadPaymentLedgers(state.expenses, [], payments, REF);
  assert.equal(result.changed, true);
  assert.equal(result.added, 1);
  const mirror = result.expenses.find((e) => e.saadPaymentId === payments[0].id);
  assert.ok(mirror, 'a mirrored expense exists');
  assert.equal(mirror.id, syncedSaadExpenseId(payments[0].id));
  assert.equal(mirror.amount, 5000);
  assert.equal(mirror.date, '2026-10-12');
  assert.equal(mirror.category, SAAD_EXPENSE_CATEGORY);
  assert.equal(mirror.category, 'Salary — Saad');
  assert.equal(mirror.saadPaymentType, 'commission');
  assert.equal(mirror.source, 'saad-visits');
  assert.match(mirror.notes, /Commission/);
  assert.match(mirror.notes, /Splicing commission/);

  const after = buildPartnerShareReport({ ...state, expenses: result.expenses }, '2026-10', REF);
  assert.equal(after.summary.expenses, 20000);
  assert.equal(after.summary.profit, before.summary.profit - 5000);
  assert.equal(after.summary.share, before.summary.share - 2500);
  // P&L (dashboard-pnl.js) deducts it too, under the Saad category.
  const pnlAfter = pnlMonth({ ...state, expenses: result.expenses });
  assert.equal(pnlAfter.expenses, 20000);
  assert.equal(pnlAfter.netProfit, pnlBefore.netProfit - 5000);
  const breakdown = calculatePnlAnalytics({ ...state, expenses: result.expenses }, { selectedMonth: '2026-10', referenceDate: REF });
  const saadCat = breakdown.selectedMonthCategoryBreakdown.categories.find((c) => c.category === 'Salary — Saad');
  assert.equal(saadCat.amount, 5000);

  // Without duplication: re-running both syncs changes nothing.
  const again = syncSaadPaymentLedgers(result.expenses, result.days, payments, REF);
  assert.equal(again.changed, false);
  assert.equal(again.expenses, result.expenses);
  assert.equal(again.expenses.filter((e) => e.saadPaymentId === payments[0].id).length, 1);
  const roz = syncRoznamchaExpenses(again.expenses, again.days, REF);
  assert.equal(roz.changed, false);
});

test('salary and commission both mirror under Salary — Saad with the verbatim type kept', () => {
  let payments = addSaadPayment([], { date: '2026-10-01', type: 'salary', amount: 15000 });
  payments = addSaadPayment(payments, { date: '2026-10-15', type: 'commission', amount: 2000 });
  const result = syncSaadPaymentLedgers([], [], payments, REF);
  assert.equal(result.added, 2);
  const byType = Object.fromEntries(result.expenses.map((e) => [e.saadPaymentType, e]));
  assert.equal(byType.salary.category, 'Salary — Saad');
  assert.equal(byType.commission.category, 'Salary — Saad');
  assert.equal(byType.salary.amount, 15000);
  assert.equal(byType.commission.amount, 2000);
  assert.equal(buildSaadPaymentExpenseNotes(payments[0]), 'Saad Visit Log · Salary');
});

test('drawer-paid payout lands as exactly one roznamcha outflow and is never mirrored twice', () => {
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'commission', amount: 5000, note: 'Drawer se diya', paidFromDrawer: true });
  const result = syncSaadPaymentLedgers([], [], payments, REF);
  assert.equal(result.drawerAdded, 1);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].date, '2026-10-12');
  assert.equal(result.days[0].closed, false);
  const outflow = result.days[0].outflows[0];
  assert.equal(outflow.id, syncedSaadDrawerOutflowId(payments[0].id));
  assert.equal(outflow.category, SAAD_DRAWER_ROZNAMCHA_CATEGORY);
  assert.equal(outflow.category, 'Lineman Allowance');
  assert.equal(outflow.lineman, 'Saad');
  assert.equal(outflow.amount, 5000);
  assert.match(outflow.note, /SP-1/);

  // The drawer day view charges the payout against the day's closing.
  const view = buildRoznamchaDay(revenueState([]), result.days, '2026-10-12', []);
  assert.equal(view.outTotal, 5000);
  assert.equal(view.outflows.length, 1);

  // The roznamcha sync must NOT create a second (roz-) expense for it.
  const roz = syncRoznamchaExpenses(result.expenses, result.days, REF);
  assert.equal(roz.changed, false);
  assert.equal(result.expenses.filter((e) => e.amount === 5000).length, 1);

  // A manual outflow on the same day still mirrors the SISP-45 way.
  const manualDay = [{ date: '2026-10-12', closed: false, outflows: [...result.days[0].outflows, { id: 'out-manual-1', category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Saad', note: 'Petrol' }] }];
  const roz2 = syncRoznamchaExpenses(result.expenses, manualDay, REF);
  assert.equal(roz2.added, 1);
  assert.equal(roz2.expenses.find((e) => e.roznamchaEntryId === 'out-manual-1').amount, 600);
});

test('non-drawer payout creates no roznamcha outflow', () => {
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'salary', amount: 9000 });
  const result = syncSaadPaymentLedgers([], [], payments, REF);
  assert.equal(result.drawerAdded, 0);
  assert.equal(result.daysChanged, false);
  assert.equal(result.days.length, 0);
});

test('editing a payment updates both mirrors; un-flagging drawer removes only the outflow', () => {
  let payments = addSaadPayment([], { date: '2026-10-12', type: 'commission', amount: 5000, paidFromDrawer: true });
  const first = syncSaadPaymentLedgers([], [], payments, REF);
  payments = updateSaadPayment(payments, payments[0].id, { date: '2026-10-12', type: 'commission', amount: 6500, paidFromDrawer: true });
  const second = syncSaadPaymentLedgers(first.expenses, first.days, payments, REF);
  assert.equal(second.updated, 1);
  assert.equal(second.drawerUpdated, 1);
  assert.equal(second.expenses.find((e) => e.saadPaymentId === payments[0].id).amount, 6500);
  assert.equal(second.days[0].outflows[0].amount, 6500);

  payments = updateSaadPayment(payments, payments[0].id, { date: '2026-10-12', type: 'commission', amount: 6500, paidFromDrawer: false });
  const third = syncSaadPaymentLedgers(second.expenses, second.days, payments, REF);
  assert.equal(third.drawerRemoved, 1);
  assert.equal(third.days[0].outflows.length, 0);
  assert.equal(third.expenses.filter((e) => e.saadPaymentId === payments[0].id).length, 1);
});

test('moving a drawer payment to another date moves the outflow with it', () => {
  let payments = addSaadPayment([], { date: '2026-10-12', type: 'salary', amount: 3000, paidFromDrawer: true });
  const first = syncSaadPaymentLedgers([], [], payments, REF);
  payments = updateSaadPayment(payments, payments[0].id, { date: '2026-10-20', type: 'salary', amount: 3000, paidFromDrawer: true });
  const second = syncSaadPaymentLedgers(first.expenses, first.days, payments, REF);
  assert.equal(second.days.find((d) => d.date === '2026-10-12').outflows.length, 0);
  const moved = second.days.find((d) => d.date === '2026-10-20');
  assert.equal(moved.outflows.length, 1);
  assert.equal(moved.outflows[0].amount, 3000);
  assert.equal(second.expenses.find((e) => e.saadPaymentId === payments[0].id).date, '2026-10-20');
});

test('deleting a payment removes both mirrors; manual rows are never touched', () => {
  const manualExpense = { id: 'e-manual', date: '2026-10-02', amount: 700, category: 'Repairs', notes: 'Manual', area: '' };
  const manualDay = { date: '2026-10-12', closed: false, outflows: [{ id: 'out-manual', category: 'Other', amount: 250, lineman: '', note: 'Tea' }] };
  let payments = addSaadPayment([], { date: '2026-10-12', type: 'commission', amount: 5000, paidFromDrawer: true });
  const first = syncSaadPaymentLedgers([manualExpense], [manualDay], payments, REF);
  assert.equal(first.expenses.length, 2);
  assert.equal(first.days[0].outflows.length, 2);

  payments = deleteSaadPayment(payments, payments[0].id);
  const second = syncSaadPaymentLedgers(first.expenses, first.days, payments, REF);
  assert.equal(second.removed, 1);
  assert.equal(second.drawerRemoved, 1);
  assert.deepEqual(second.expenses, [manualExpense]);
  assert.deepEqual(second.days[0].outflows, manualDay.outflows);
});

test('a closed roznamcha day is never mutated: drawer payout mirrors to Expenses only and is reported skipped', () => {
  const closedDay = {
    date: '2026-10-12', closed: true, outflows: [],
    openingBalance: 1000, cashIn: 0, shopIn: 0, cashPayments: [], handovers: [],
    expectedClosing: 1000, closingBalance: 1000, countedCash: 1000, discrepancy: 0
  };
  const days = [closedDay];
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'commission', amount: 5000, paidFromDrawer: true });
  const result = syncSaadPaymentLedgers([], days, payments, REF);
  assert.equal(result.added, 1);
  assert.equal(result.drawerAdded, 0);
  assert.equal(result.drawerSkippedClosed, 1);
  assert.equal(result.daysChanged, false);
  assert.equal(result.days, days);
  assert.deepEqual(result.days[0], closedDay);
});

test('an outflow already frozen into a closed day stays frozen even after the payment is deleted', () => {
  const frozenOutflow = { id: 'saad-SP-9', category: 'Lineman Allowance', amount: 4000, lineman: 'Saad', note: 'Saad commission · SP-9' };
  const closedDay = {
    date: '2026-10-12', closed: true, outflows: [frozenOutflow],
    openingBalance: 5000, cashIn: 0, shopIn: 0, cashPayments: [], handovers: [],
    expectedClosing: 1000, closingBalance: 1000, countedCash: 1000, discrepancy: 0
  };
  const mirrorExpense = { id: 'saad-SP-9', date: '2026-10-12', amount: 4000, category: 'Salary — Saad', notes: 'Saad Visit Log · Commission', area: '', saadPaymentId: 'SP-9', saadPaymentType: 'commission', source: 'saad-visits' };
  const result = syncSaadPaymentLedgers([mirrorExpense], [closedDay], [], REF);
  assert.equal(result.removed, 1);
  assert.equal(result.expenses.length, 0);
  assert.equal(result.daysChanged, false);
  assert.deepEqual(result.days[0].outflows, [frozenOutflow]);
});

test('duplicated expense mirrors collapse to one row; drifted mirrors are restored', () => {
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'salary', amount: 8000 });
  const good = syncSaadPaymentLedgers([], [], payments, REF).expenses[0];
  const drifted = { ...good, amount: 1, category: 'Other expenses' };
  const duplicate = { ...good, id: 'saad-SP-1-copy' };
  const result = syncSaadPaymentLedgers([drifted, duplicate], [], payments, REF);
  const rows = result.expenses.filter((e) => e.saadPaymentId === payments[0].id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 8000);
  assert.equal(rows[0].category, 'Salary — Saad');
});

test('paidFromDrawer survives payment sanitize round-trips (backup shape)', () => {
  const payments = addSaadPayment([], { date: '2026-10-12', type: 'salary', amount: 1000, paidFromDrawer: true });
  const roundTripped = sanitizeSaadPayments(JSON.parse(JSON.stringify(payments)));
  assert.equal(roundTripped[0].paidFromDrawer, true);
  const plain = sanitizeSaadPayments([{ id: 'SP-7', date: '2026-10-01', type: 'salary', amount: 5 }]);
  assert.equal(plain[0].paidFromDrawer, false);
});

test('isSaadTechnician matches Saad by whole word only', () => {
  assert.equal(isSaadTechnician('Saad'), true);
  assert.equal(isSaadTechnician('SAAD'), true);
  assert.equal(isSaadTechnician('Muhammad Saad'), true);
  assert.equal(isSaadTechnician('Saad (splicing)'), true);
  assert.equal(isSaadTechnician('Saadullah'), false);
  assert.equal(isSaadTechnician('Umair'), false);
  assert.equal(isSaadTechnician(''), false);
  assert.equal(isSaadTechnician(null), false);
});

test('visitTypeForTicket maps every preset to a Saad visit type', () => {
  assert.equal(visitTypeForTicket({ faultPreset: 'Fiber Cut / Splice Loss' }), 'splicing');
  assert.equal(visitTypeForTicket({ faultPreset: 'Media Converter Power/Charger' }), 'other');
  assert.equal(visitTypeForTicket({ faultPreset: 'Router / IP Conflict' }), 'other');
  assert.equal(visitTypeForTicket({ faultPreset: 'Slow Speed / High Attenuation' }), 'other');
  assert.equal(visitTypeForTicket({ faultPreset: 'CAT6 / RJ45 Fault' }), 'other');
  assert.equal(visitTypeForTicket({ faultPreset: '', customFault: 'New connection shifting' }), 'install');
  assert.equal(visitTypeForTicket({ faultPreset: '', customFault: 'Fiber damage at pole' }), 'fiber-fix');
  assert.equal(visitTypeForTicket({ faultPreset: '', customFault: '' }), 'other');
});

test('buildVisitPrefillFromTicket carries only facts the ticket records', () => {
  const customers = [{ id: 'c1', name: 'Test Customer A', customerNumber: 7, mohalla: 'BARRIAN', zone: '' }];
  const ticket = {
    id: 'TKT-101', customerId: 'c1', technician: 'Saad', status: 'Resolved',
    faultPreset: 'Fiber Cut / Splice Loss', customFault: '',
    createdAt: '2026-10-10T09:00', resolvedAt: '2026-10-10T13:30',
    materialsUsed: [{ key: 'fiber', qty: 25, amount: 0 }, { key: 'rj45', qty: 2, amount: 0 }]
  };
  const prefill = buildVisitPrefillFromTicket(ticket, customers);
  assert.equal(prefill.date, '2026-10-10');
  assert.equal(prefill.type, 'splicing');
  assert.equal(prefill.customerId, 'c1');
  assert.equal(prefill.area, 'BARRIAN');
  assert.equal(prefill.fiberMeters, 25);
  assert.equal(prefill.ticketId, 'TKT-101');
  assert.match(prefill.note, /TKT-101/);
  assert.equal('hoursWorked' in prefill, false);
  assert.equal(buildVisitPrefillFromTicket(null, customers), null);

  // End to end: the prefilled form saves as a visit linked to the ticket,
  // which is exactly what the ticket card's logged state reads back.
  const visits = addSaadVisit([], { ...prefill, hoursWorked: 3 }, { customers, ticketIds: ['TKT-101'] });
  assert.equal(visits[0].ticketId, 'TKT-101');
  assert.equal(visits[0].fiberMeters, 25);
  const summary = buildMonthlySaadSummary(visits, [], '2026-10');
  assert.equal(summary.splicingCount, 1);
  assert.equal(summary.totalHours, 3);
});

test('the three exp_saad_* strings exist in both dictionaries', () => {
  for (const key of ['exp_saad_badge', 'exp_saad_synced_hint', 'exp_saad_edit_blocked_toast']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});
