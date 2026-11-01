// SISP-134: Monthly Expense Category Budget Caps & Over-Spend Alert.
// Caps live in their own store (sisp_expense_budgets_v1) keyed by the
// frozen EXPENSE_CATEGORIES; spend is aggregated with the exact
// inclusion rules of the P&L engine (dashboard-pnl.js
// calculatePnlAnalytics) and pinned against its own output. Caps are
// informational only — nothing here ever blocks an expense.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXPENSE_BUDGETS_KEY,
  BUDGET_WARN_RATIO,
  BUDGET_OVER_RATIO,
  sanitizeExpenseBudgets,
  loadExpenseBudgets,
  saveExpenseBudgets,
  setExpenseBudgetCap,
  aggregateMonthlyCategorySpend,
  buildCategoryBudgetStatus,
  renderBudgetSectionHtml,
  renderBudgetAlertsHtml,
  renderBudgetEditorHtml,
  collectBudgetCapsFromEditor,
} from '../expense-budget-caps.js';
import { EXPENSE_CATEGORIES } from '../phase3.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import { ENTRY_FILES } from '../build.mjs';

const REF = new Date('2026-10-27T12:00:00Z');

function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

function expense(id, date, category, amount, extra = {}) {
  return { id, date, category, amount, notes: '', ...extra };
}

// Two months x two categories, a blank-category row (P&L fallback) and a
// whitespace-padded category (P&L trims) — all synthetic.
function fixtureState() {
  return {
    customers: [],
    expenses: [
      expense('e1', '2026-10-03', 'Cable', 1000),
      expense('e2', '2026-10-20', 'Cable', 500.5),
      expense('e3', '2026-10-09', ' Cable ', 200),
      expense('e4', '2026-10-05', 'Routers', 2500),
      expense('e5', '2026-10-07', '', 300),
      expense('e6', '2026-09-15', 'Cable', 9999),
      expense('e7', '2026-09-16', 'Routers', 1111),
      expense('e8', '2026-10-11', 'Electricity', 700, { roznamchaEntryId: 'roz-1' }),
    ],
  };
}

test('storage key, empty start, sanitizer keeps only real categories with positive whole-rupee caps', () => {
  assert.equal(EXPENSE_BUDGETS_KEY, 'sisp_expense_budgets_v1');
  assert.deepEqual(sanitizeExpenseBudgets(null), {});
  assert.deepEqual(sanitizeExpenseBudgets(undefined), {});
  assert.deepEqual(sanitizeExpenseBudgets([1, 2]), {});
  assert.deepEqual(sanitizeExpenseBudgets('nope'), {});
  assert.deepEqual(loadExpenseBudgets(fakeStorage()), {}, 'store starts empty');
  assert.deepEqual(
    sanitizeExpenseBudgets({ Cable: 5000, Routers: '2500.6', Electricity: 0, ONU: -10, Tools: 'abc', 'Made Up Category': 9000 }),
    { Cable: 5000, Routers: 2501 },
    'unknown categories, zero/negative/non-numeric caps are dropped; fractional caps round to whole rupees'
  );
  // Canonical EXPENSE_CATEGORIES key order (backup safe-merge compares JSON).
  assert.deepEqual(
    Object.keys(sanitizeExpenseBudgets({ Routers: 100, Cable: 200 })),
    EXPENSE_CATEGORIES.filter(c => c === 'Cable' || c === 'Routers')
  );
});

test('load/save round-trip through storage; save sanitizes and never throws on a broken store', () => {
  const storage = fakeStorage();
  const saved = saveExpenseBudgets({ Cable: 5000, Bogus: 1, Routers: 2500 }, storage);
  assert.deepEqual(saved, { Cable: 5000, Routers: 2500 });
  assert.deepEqual(loadExpenseBudgets(storage), { Cable: 5000, Routers: 2500 });
  storage.setItem(EXPENSE_BUDGETS_KEY, '{not json');
  assert.deepEqual(loadExpenseBudgets(storage), {}, 'corrupt JSON reads as no caps');
  assert.deepEqual(loadExpenseBudgets(null), loadExpenseBudgets(null) && loadExpenseBudgets(undefined) !== undefined ? loadExpenseBudgets(undefined) : {});
});

test('setExpenseBudgetCap sets, clears, validates and never mutates its input', () => {
  const before = Object.freeze({ Cable: 5000 });
  assert.deepEqual(setExpenseBudgetCap(before, 'Routers', 3000), { Cable: 5000, Routers: 3000 });
  assert.deepEqual(setExpenseBudgetCap(before, 'Cable', null), {});
  assert.deepEqual(setExpenseBudgetCap(before, 'Cable', ''), {});
  assert.deepEqual(setExpenseBudgetCap(before, 'Cable', 0), {});
  assert.deepEqual(before, { Cable: 5000 }, 'input untouched');
  assert.throws(() => setExpenseBudgetCap(before, 'Not A Category', 100), /not a valid expense category/);
  assert.throws(() => setExpenseBudgetCap(before, 'Cable', -50), /greater than zero|positive/);
  assert.throws(() => setExpenseBudgetCap(before, 'Cable', 'abc'), /positive whole number/);
});

test('monthly category aggregation matches the P&L engine figures exactly', () => {
  const state = fixtureState();
  const pnl = calculatePnlAnalytics(state, { selectedMonth: '2026-10', referenceDate: REF });
  const pnlByCategory = Object.fromEntries(
    pnl.selectedMonthCategoryBreakdown.categories.map(row => [row.category, row.amount])
  );
  assert.deepEqual(pnlByCategory, { Cable: 1700.5, Routers: 2500, 'Other expenses': 300, Electricity: 700 });

  const status = buildCategoryBudgetStatus(state, {}, '2026-10');
  const mineByCategory = Object.fromEntries(status.categories.map(row => [row.category, row.spent]));
  assert.deepEqual(mineByCategory, pnlByCategory, 'builder spend == P&L breakdown for the same month');

  const september = buildCategoryBudgetStatus(state, {}, '2026-09');
  assert.deepEqual(
    Object.fromEntries(september.categories.map(row => [row.category, row.spent])),
    { Cable: 9999, Routers: 1111 },
    'the other month aggregates separately'
  );
  assert.deepEqual(aggregateMonthlyCategorySpend(state.expenses, '2026-13'), {}, 'invalid month yields no spend');
  assert.deepEqual(aggregateMonthlyCategorySpend(null, '2026-10'), {});
});

test('threshold alert states: 79% ok, 80% warn, 99% warn, 100% over, 150% over', () => {
  assert.equal(BUDGET_WARN_RATIO, 0.8);
  assert.equal(BUDGET_OVER_RATIO, 1);
  const caps = { Cable: 1000 };
  const levelFor = (spent) => buildCategoryBudgetStatus(
    { customers: [], expenses: [expense('x', '2026-10-02', 'Cable', spent)] }, caps, '2026-10'
  ).categories.find(row => row.category === 'Cable');

  assert.equal(levelFor(790).level, 'ok');
  assert.equal(levelFor(790).pct, 79);
  assert.equal(levelFor(800).level, 'warn');
  assert.equal(levelFor(800).pct, 80);
  assert.equal(levelFor(990).level, 'warn');
  assert.equal(levelFor(990).pct, 99);
  assert.equal(levelFor(1000).level, 'over');
  assert.equal(levelFor(1000).pct, 100);
  assert.equal(levelFor(1500).level, 'over');
  assert.equal(levelFor(1500).pct, 150);

  const zeroSpend = levelFor(0);
  assert.equal(zeroSpend.level, 'ok', 'cap with zero spend is ok');
  assert.equal(zeroSpend.pct, 0);
});

test('uncapped categories report level none with null cap/pct and never alert', () => {
  const state = { customers: [], expenses: [expense('x', '2026-10-02', 'Routers', 999999)] };
  const status = buildCategoryBudgetStatus(state, { Cable: 1000 }, '2026-10');
  const routers = status.categories.find(row => row.category === 'Routers');
  assert.equal(routers.cap, null);
  assert.equal(routers.pct, null, 'no cap -> no percentage, never Infinity/NaN');
  assert.equal(routers.level, 'none');
  assert.equal(routers.spent, 999999);
  assert.deepEqual(status.alerts, [], 'an uncapped category can never alert, however large the spend');
  assert.deepEqual(status.capped.map(row => row.category), ['Cable']);
  assert.equal(status.hasCaps, true);
  assert.equal(buildCategoryBudgetStatus(state, {}, '2026-10').hasCaps, false);
});

test('builder is pure: frozen inputs pass through byte-identical', () => {
  const state = fixtureState();
  const caps = { Cable: 2000, Routers: 2000 };
  const stateJson = JSON.stringify(state);
  const capsJson = JSON.stringify(caps);
  const status = buildCategoryBudgetStatus(Object.freeze(state), Object.freeze(caps), '2026-10');
  assert.equal(JSON.stringify(state), stateJson);
  assert.equal(JSON.stringify(caps), capsJson);
  assert.equal(status.month, '2026-10');
  const cable = status.categories.find(row => row.category === 'Cable');
  assert.equal(cable.spent, 1700.5);
  assert.equal(cable.level, 'warn', '1700.5 / 2000 = 85% -> warn');
});

test('section HTML renders bars only for capped categories, width capped at 100%', () => {
  const state = {
    customers: [],
    expenses: [
      expense('a', '2026-10-02', 'Cable', 1500),
      expense('b', '2026-10-03', 'Routers', 500),
    ],
  };
  const status = buildCategoryBudgetStatus(state, { Cable: 1000 }, '2026-10');
  const html = renderBudgetSectionHtml(status);
  assert.match(html, /expense-budget-fill--over/);
  assert.match(html, /width: 100%;/, 'a 150% bar is drawn full, not overflowing');
  assert.match(html, /150%/, 'the true percentage is still shown as a figure');
  assert.ok(!html.includes('Routers'), 'uncapped categories get no bar in the P&L section');
  assert.match(renderBudgetSectionHtml(buildCategoryBudgetStatus(state, {}, '2026-10')), /expense-budget-empty/);
});

test('alerts HTML lists only warn/over categories; empty when nothing needs attention', () => {
  const state = {
    customers: [],
    expenses: [
      expense('a', '2026-10-02', 'Cable', 900),
      expense('b', '2026-10-03', 'Routers', 100),
      expense('c', '2026-10-04', 'Electricity', 5000),
    ],
  };
  const status = buildCategoryBudgetStatus(state, { Cable: 1000, Routers: 1000, Electricity: 4000 }, '2026-10');
  const html = renderBudgetAlertsHtml(status);
  assert.match(html, /Cable/, 'warn category listed');
  assert.match(html, /Electricity/, 'over category listed');
  assert.ok(!html.includes('Routers'), 'ok category not listed');
  const calm = buildCategoryBudgetStatus(state, { Cable: 100000 }, '2026-10');
  assert.equal(renderBudgetAlertsHtml(calm), '');
  assert.equal(renderBudgetAlertsHtml(buildCategoryBudgetStatus(state, {}, '2026-10')), '');
});

test('editor HTML has one input per real expense category and collect reads them back', () => {
  const html = renderBudgetEditorHtml({ Cable: 5000 });
  for (const category of EXPENSE_CATEGORIES) {
    assert.ok(html.includes(`data-budget-cap="${category}"`), `editor input for ${category}`);
  }
  assert.match(html, /data-budget-cap="Cable" value="5000"/);
  assert.ok(html.includes('id="pnlBudgetSaveBtn"'));

  const inputs = [
    { value: '7000', getAttribute: () => 'Cable' },
    { value: '', getAttribute: () => 'Routers' },
    { value: '-5', getAttribute: () => 'Electricity' },
    { value: 'abc', getAttribute: () => 'Tools' },
    { value: '123', getAttribute: () => 'Not A Category' },
  ];
  const root = { querySelectorAll: (selector) => (selector === '[data-budget-cap]' ? inputs : []) };
  assert.deepEqual(collectBudgetCapsFromEditor(root), { Cable: 7000 }, 'blank/invalid inputs mean no cap; unknown categories ignored');
});

test('backup: caps travel in settings.expenseBudgets, sanitized, only when at least one cap exists', () => {
  const withCaps = JSON.parse(createJsonBackup(createInitialState(), REF, { expenseBudgets: { Cable: 5000, Bogus: 9, Routers: -1 } }));
  assert.deepEqual(withCaps.settings.expenseBudgets, { Cable: 5000 });
  const without = JSON.parse(createJsonBackup(createInitialState(), REF, {}));
  assert.equal(without.settings?.expenseBudgets, undefined, 'no caps -> no section written');
  const empty = JSON.parse(createJsonBackup(createInitialState(), REF, { expenseBudgets: {} }));
  assert.equal(empty.settings?.expenseBudgets, undefined);
});

test('backup safe-merge: adopt onto empty, identical is a no-op, differing caps conflict and are never overwritten', () => {
  const backup = createJsonBackup(createInitialState(), REF, { expenseBudgets: { Cable: 5000 } });

  const adopt = previewJsonBackupMerge(createInitialState(), backup, {
    currentExpenseBudgets: {}, currentExpenseBudgetsStored: false,
  });
  assert.deepEqual(adopt.expenseBudgets, { Cable: 5000 });
  assert.equal(adopt.counts.expenseBudgetsRestored, 1);
  assert.equal(adopt.canApply, true, 'a caps-only restore is applicable');

  const identical = previewJsonBackupMerge(createInitialState(), backup, {
    currentExpenseBudgets: { Cable: 5000 }, currentExpenseBudgetsStored: true,
  });
  assert.equal(identical.expenseBudgets, null);
  assert.equal(identical.counts.expenseBudgetsRestored ?? 0, 0);
  assert.ok(!identical.conflicts.some(c => /budget/i.test(c.field)));

  const differ = previewJsonBackupMerge(createInitialState(), backup, {
    currentExpenseBudgets: { Cable: 9000 }, currentExpenseBudgetsStored: true,
  });
  assert.equal(differ.expenseBudgets, null, 'existing caps kept, never overwritten');
  assert.ok(differ.conflicts.some(c => /Expense budget caps differ/.test(c.field)));

  const legacy = JSON.stringify({
    format: 'shahdara-isp-billing-backup', formatVersion: 1,
    exportedAt: '2026-10-01T10:00', state: createInitialState(),
  });
  const legacyPreview = previewJsonBackupMerge(createInitialState(), legacy, {
    currentExpenseBudgets: {}, currentExpenseBudgetsStored: false,
  });
  assert.equal(legacyPreview.expenseBudgets, null, 'old backups without the section restore as before');
});

test('i18n: every ebud_* key used in code and markup resolves in en AND ur (no raw keys)', () => {
  const sources = [
    readFileSync(new URL('../expense-budget-caps.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../dashboard-pnl.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
  ].join('\n');
  const keys = new Set();
  for (const match of sources.matchAll(/ebud_[a-z_]+/g)) keys.add(match[0]);
  assert.ok(keys.size >= 10, `expected the ebud_* key family, found ${keys.size}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key] !== key, `en resolves ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key] !== key, `ur resolves ${key}`);
  }
});

test('wiring + perf budget: module is inside the existing graph, never an entry file; hosts exist in markup', () => {
  assert.ok(!ENTRY_FILES.includes('expense-budget-caps.js'), 'dist stays at the 25-file budget: module joins the import graph only');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['pnlBudgetSection', 'pnlBudgetEditor', 'roznamchaBudgetAlerts']) {
    assert.ok(html.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  const pnl = readFileSync(new URL('../dashboard-pnl.js', import.meta.url), 'utf8');
  assert.match(pnl, /from '\.\/expense-budget-caps\.js'/);
  const roznamcha = readFileSync(new URL('../roznamcha.js', import.meta.url), 'utf8');
  assert.match(roznamcha, /from '\.\/expense-budget-caps\.js'/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /expenseBudgets: loadExpenseBudgets\(\)/);
  assert.match(app, /saveExpenseBudgets\(pendingBackupPreview\.expenseBudgets\)/);
});

test('CSS: the SISP-134 block in components.css is token-only (no hex)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-134:');
  const end = css.indexOf('/* /SISP-134 */');
  assert.ok(start >= 0 && end > start, 'SISP-134 CSS block present');
  const block = css.slice(start, end);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the budget styles');
  for (const token of ['var(--color-paid)', 'var(--amber)', 'var(--color-overdue)', 'var(--line)']) {
    assert.ok(block.includes(token), `budget styles use ${token}`);
  }
});
