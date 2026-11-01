// SISP-149: Shop Handover Cash + Shop Deduction/Expense Split.
// Pure-function tests on synthetic data only. Spec criteria pinned here:
//   netCash + deduction === grossTotal invariant (valid split records,
//   broken split refused with nothing recorded); all selected receipts
//   settle (unsettled -> 0); the deduction posts as ONE Expenses-ledger
//   expense (deterministic id, replay-safe); the Roznamcha shows the
//   dual entries (net cash inflow + deduction memo) from its real
//   builder; P&L and Daily Closing count the expense through the
//   ordinary expense path; deduction 0 keeps the legacy handover
//   byte-identical.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildShopSummaries,
  pendingShopReceipts,
  sanitizeShopSettlements,
  applySettlement,
  generateShopSettlementReceiptText,
  settlementDeduction,
  settlementNetCash,
  shopDeductionExpenseId,
  buildShopDeductionExpense,
  SHOP_DEDUCTION_EXPENSE_CATEGORY
} from '../shop-settlement.js';
import {
  buildRoznamchaDay,
  collectShopHandovers,
  closeRoznamchaDay,
  generateRoznamchaSummaryText
} from '../roznamcha.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { calculateDailyClosingSummary } from '../dashboard-daily-closing.js';
import { EXPENSE_CATEGORIES, validatePhase3State } from '../phase3.js';
import { buildWalletReconciliation } from '../wallet-reconciliation.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const HANDOVER_DATE = '2026-10-27';

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
      ])
    ],
    expenses: []
  };
}

test('valid split: netCash + deduction === gross settles every receipt and stamps the split', () => {
  const state = fixture();
  const { state: next, settlement, leftover } = applySettlement(
    state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 }
  );
  assert.equal(leftover, 0);
  assert.equal(settlement.amount, 4500, 'settlement amount stays the settled gross');
  assert.equal(settlement.netCash, 4000);
  assert.equal(settlement.deduction, 500);
  assert.equal(settlementDeduction(settlement), 500);
  assert.equal(settlementNetCash(settlement), 4000);
  assert.equal(pendingShopReceipts(next, 'Waseem Abbasi Shop').length, 0, 'all selected receipts settled');
  const summaries = buildShopSummaries(next, [settlement], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(summaries.find((s) => s.shop === 'Waseem Abbasi Shop').unsettled, 0);
  // Per-shop separation still holds with a split. (Re-pinned at the
  // SISP-149 reconciliation: on current main the legacy 'Cash at Hassan
  // shop' method derives to the ONE canonical collector from
  // OWNER-CASH-SHOP, 'Hassan Balla Shop'.)
  assert.equal(summaries.find((s) => s.shop === 'Hassan Balla Shop').unsettled, 2000);
});

test('broken split is refused and records nothing', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  // Sum does not add up to the gross.
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 400 }), /must equal/);
  // Negative figures.
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: -100, deduction: 4600 }), /cannot be negative/);
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4600, deduction: -100 }), /cannot be negative/);
  // Deduction larger than the gross (net would go negative).
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 0, deduction: 5000 }), /must equal/);
  // Split against an amount beyond the unsettled total (leftover) is refused.
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 5000, HANDOVER_DATE, '', { netCash: 4500, deduction: 500 }), /exactly equal/);
  // Non-numeric split figures.
  assert.throws(() => applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 'x', deduction: 500 }), /cannot be negative/);
  assert.equal(JSON.stringify(state), before, 'input state untouched by every refusal');
  assert.equal(state.expenses.length, 0, 'no expense escaped a refused split');
});

test('the deduction posts exactly one expense with a deterministic id', () => {
  const state = fixture();
  const { state: next, settlement } = applySettlement(
    state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 }
  );
  assert.equal(next.expenses.length, 1);
  const expense = next.expenses[0];
  assert.equal(expense.id, shopDeductionExpenseId(settlement.id));
  assert.equal(expense.id, `shopded-${settlement.id}`);
  assert.equal(expense.amount, 500);
  assert.equal(expense.date, HANDOVER_DATE, 'expense is dated the handover date');
  assert.equal(expense.category, SHOP_DEDUCTION_EXPENSE_CATEGORY);
  assert.ok(EXPENSE_CATEGORIES.includes(expense.category), 'category comes from the real frozen list');
  assert.equal(expense.shopSettlementId, settlement.id);
  assert.match(expense.notes, /Waseem Abbasi Shop/, 'note names the shop');
  assert.match(expense.notes, new RegExp(settlement.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'note names the settlement');
  // Deterministic derivation: rebuilding from the same settlement yields the same row.
  assert.deepEqual(buildShopDeductionExpense(settlement), expense);
  assert.equal(buildShopDeductionExpense(settlement).id, buildShopDeductionExpense(settlement).id);
  // The row passes the Expenses ledger's own state validation (phase3).
  assert.doesNotThrow(() => validatePhase3State(next));
  // Replay of the same handover attempt: receipts are already settled,
  // so it throws and no second expense can appear.
  assert.throws(() => applySettlement(next, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 }));
  assert.equal(next.expenses.length, 1);
});

test('two split handovers post two distinct expenses, one per settlement', () => {
  const state = fixture();
  const first = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const second = applySettlement(first.state, 'Hassan Shop', 2000, HANDOVER_DATE, '', { netCash: 1500, deduction: 500 });
  assert.equal(second.state.expenses.length, 2);
  assert.notEqual(second.state.expenses[0].id, second.state.expenses[1].id);
  assert.deepEqual(
    second.state.expenses.map((e) => e.shopSettlementId).sort(),
    [first.settlement.id, second.settlement.id].sort()
  );
});

test('deduction 0 (or no split) keeps the legacy handover byte-identical', () => {
  const state = fixture();
  for (const split of [null, undefined, { netCash: 4500, deduction: 0 }]) {
    const { state: next, settlement } = split === undefined
      ? applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '')
      : applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', split);
    assert.deepEqual(
      Object.keys(settlement).sort(),
      ['allocations', 'amount', 'createdAt', 'date', 'id', 'note', 'shop'],
      'legacy settlement record carries no split fields'
    );
    assert.deepEqual(next.expenses, [], 'no expense posted without a deduction');
    assert.equal(settlementDeduction(settlement), 0);
    assert.equal(settlementNetCash(settlement), 4500);
  }
});

test('sanitizer keeps only a consistent split pair, and backups carry it', () => {
  const cleaned = sanitizeShopSettlements([
    { id: 'ok-split', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, netCash: 1500, deduction: 500, allocations: [] },
    { id: 'bad-split', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, netCash: 1500, deduction: 400, allocations: [] },
    { id: 'zero-split', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, netCash: 2000, deduction: 0, allocations: [] },
    { id: 'half-split', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, deduction: 500, allocations: [] }
  ]);
  const byId = Object.fromEntries(cleaned.map((s) => [s.id, s]));
  assert.equal(byId['ok-split'].netCash, 1500);
  assert.equal(byId['ok-split'].deduction, 500);
  for (const id of ['bad-split', 'zero-split', 'half-split']) {
    assert.equal('netCash' in byId[id], false, `${id}: split fields dropped`);
    assert.equal('deduction' in byId[id], false, `${id}: split fields dropped`);
  }
  // Readers agree with the sanitizer on inconsistent data: no split.
  assert.equal(settlementDeduction({ amount: 2000, deduction: 500 }), 0);
  assert.equal(settlementNetCash({ amount: 2000, deduction: 500 }), 2000);

  // JSON backup round-trip: the split survives create + safe-merge adopt.
  const settlements = [byId['ok-split']];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00'), { shopSettlements: settlements });
  const adopted = previewJsonBackupMerge(createInitialState(), backupText, { currentShopSettlements: [], currentShopSettlementsStored: false });
  assert.equal(adopted.counts.shopSettlementsRestored, 1);
  assert.equal(adopted.shopSettlements[0].netCash, 1500);
  assert.equal(adopted.shopSettlements[0].deduction, 500);
});

test('roznamcha: net cash inflow line plus the deduction memo, from the real builder', () => {
  const state = fixture();
  const { settlement } = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const handovers = collectShopHandovers([settlement], HANDOVER_DATE);
  assert.deepEqual(handovers, [{ shop: 'Waseem Abbasi Shop', amount: 4000, gross: 4500, deduction: 500 }]);
  const view = buildRoznamchaDay(state, [], HANDOVER_DATE, [settlement]);
  assert.equal(view.shopIn, 4000, 'drawer receives only the net cash');
  assert.equal(view.totalIn, 4000);
  assert.equal(view.outTotal, 0, 'the deduction is not a drawer outflow');
  assert.equal(view.expectedClosing, 4000);
  const text = generateRoznamchaSummaryText(view);
  assert.match(text, /Shop handover — Waseem Abbasi Shop: PKR 4,000/);
  assert.match(text, /Shop deduction — Waseem Abbasi Shop: PKR 500/);
  assert.match(text, /PKR 4,500/, 'gross is shown on the deduction memo line');
  // Month-end cash-in-hand rides the same collector, so it counts net too.
});

test('roznamcha: legacy handover entry is exactly the pre-split shape', () => {
  const legacy = { id: 's-legacy', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, note: '', allocations: [], createdAt: '' };
  // Shape is exactly the pre-split shape (no gross/deduction memo keys);
  // the name reads under the canonical 'Hassan Balla Shop' per
  // OWNER-CASH-SHOP on current main — the stored record is not rewritten.
  assert.deepEqual(collectShopHandovers([legacy], HANDOVER_DATE), [{ shop: 'Hassan Balla Shop', amount: 2000 }]);
  const view = buildRoznamchaDay(fixture(), [], HANDOVER_DATE, [legacy]);
  assert.equal(view.shopIn, 2000);
  assert.doesNotMatch(generateRoznamchaSummaryText(view), /Shop deduction/);
});

test('roznamcha: a fully deducted handover still shows its deduction memo on a closed day', () => {
  const state = fixture();
  const { settlement } = applySettlement(state, 'Hassan Shop', 2000, HANDOVER_DATE, '', { netCash: 0, deduction: 2000 });
  assert.equal(settlementNetCash(settlement), 0);
  const view = buildRoznamchaDay(state, [], HANDOVER_DATE, [settlement]);
  assert.equal(view.shopIn, 0, 'no cash reached the drawer');
  // Recorded under the canonical name (applySettlement canonicalizes the
  // legacy 'Hassan Shop' argument, OWNER-CASH-SHOP on current main).
  assert.deepEqual(view.handovers, [{ shop: 'Hassan Balla Shop', amount: 0, gross: 2000, deduction: 2000 }]);
  const closedDays = closeRoznamchaDay([], view, null);
  const closedView = buildRoznamchaDay(state, closedDays, HANDOVER_DATE, [settlement]);
  assert.equal(closedView.closed, true);
  assert.deepEqual(closedView.handovers, [{ shop: 'Hassan Balla Shop', amount: 0, gross: 2000, deduction: 2000 }],
    'the frozen snapshot keeps the split memo');
});

test('P&L counts the deduction as an expense through the real engine, income untouched', () => {
  const state = fixture();
  const options = { selectedMonth: '2026-10', windowMonths: 6, referenceDate: new Date('2026-10-27T12:00:00Z') };
  const before = calculatePnlAnalytics(state, options).monthlyData.find((m) => m.month === '2026-10');
  const { state: next } = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const after = calculatePnlAnalytics(next, options).monthlyData.find((m) => m.month === '2026-10');
  assert.equal(after.income, before.income, 'a handover split never changes collected income');
  assert.equal(before.expenses, 0);
  assert.equal(after.expenses, 500);
  assert.equal(after.expenseCount, before.expenseCount + 1);
  assert.equal(after.netProfit, before.netProfit - 500);
});

test('daily closing lists the deduction expense on the handover date', () => {
  const state = fixture();
  const { state: next, settlement } = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const summary = calculateDailyClosingSummary(next, new Date('2026-10-27T12:00:00+05:00'));
  const row = summary.expensesList.find((e) => e.id === shopDeductionExpenseId(settlement.id));
  assert.ok(row, 'daily closing expense list carries the auto-expense');
  assert.equal(row.amount, 500);
  assert.equal(row.category, 'Other expenses');
  assert.equal(summary.todayExpenses, 500);
});

test('settlement receipt prints gross, deduction and net only for split handovers', () => {
  const state = fixture();
  const { settlement } = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const text = generateShopSettlementReceiptText({ shop: 'Waseem Abbasi Shop', settlement, remainingUnsettled: 0 });
  assert.match(text, /Gross receipts settled: PKR 4,500/);
  assert.match(text, /Shop deduction \/ expense: -PKR 500/);
  assert.match(text, /Net cash received: PKR 4,000/);
  const legacy = applySettlement(state, 'Hassan Shop', 2000, HANDOVER_DATE, '').settlement;
  const legacyText = generateShopSettlementReceiptText({ shop: 'Hassan Shop', settlement: legacy, remainingUnsettled: 0 });
  assert.match(legacyText, /Amount received: PKR 2,000/);
  assert.doesNotMatch(legacyText, /Shop deduction/);
});

test('wallet reconciliation counts a split handover at net and reports the deduction apart', () => {
  const state = fixture();
  const { settlement } = applySettlement(state, 'Waseem Abbasi Shop', 4500, HANDOVER_DATE, '', { netCash: 4000, deduction: 500 });
  const report = buildWalletReconciliation(state.customers, '2026-10', [settlement]);
  assert.equal(report.shopHandovers.amount, 4000, 'handovers received = net cash, never the gross');
  assert.equal(report.shopHandovers.deduction, 500);
  assert.equal(report.shopHandovers.count, 1);
  assert.equal(report.shopHandovers.perShop['Waseem Abbasi Shop'].amount, 4000);
  assert.equal(report.shopHandovers.perShop['Waseem Abbasi Shop'].deduction, 500);
  const legacy = buildWalletReconciliation(state.customers, '2026-10', [
    { id: 's-legacy', shop: 'Hassan Shop', amount: 2000, date: HANDOVER_DATE, note: '', allocations: [], createdAt: '' }
  ]);
  assert.equal(legacy.shopHandovers.amount, 2000);
  assert.equal(legacy.shopHandovers.deduction, 0);
});

test('i18n: every shopded_* key exists in both dictionaries with matching placeholders', () => {
  const placeholders = (value) => [...String(value).matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('shopded_'));
  assert.ok(enKeys.length >= 7, 'the phase adds its key set');
  for (const key of enKeys) {
    assert.ok(key in TRANSLATIONS.ur, `${key} missing from the Urdu dictionary`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
  for (const key of Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('shopded_'))) {
    assert.ok(key in TRANSLATIONS.en, `${key} missing from the English dictionary`);
  }
  // Mechanical audit: every t('shopded_…') call in the module and every
  // data-i18n="shopded_…" label in the markup resolves in both dicts.
  const moduleSource = readFileSync(new URL('../shop-settlement.js', import.meta.url), 'utf8');
  const markup = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const referenced = new Set([
    ...[...moduleSource.matchAll(/t\('(shopded_[a-z_]+)'/g)].map((m) => m[1]),
    ...[...markup.matchAll(/data-i18n="(shopded_[a-z_]+)"/g)].map((m) => m[1])
  ]);
  assert.ok(referenced.size >= 7, 'module + markup reference the key set');
  for (const key of referenced) {
    assert.ok(key in TRANSLATIONS.en && key in TRANSLATIONS.ur, `${key} referenced but missing from a dictionary`);
  }
  // And a rendered toast carries no leftover placeholders or raw keys.
  const rendered = t('shopded_recorded_toast', 'en', { net: 'PKR 4,000', deduction: 'PKR 500', shop: 'Hassan Shop' });
  assert.match(rendered, /PKR 4,000/);
  assert.doesNotMatch(rendered, /\{|shopded_/);
});
