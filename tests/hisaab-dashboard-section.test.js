// Hisaab H3 — Dashboard section "Hisaab — Kya khoya, kya paya".
// This month's row from the P&L engine + the lifetime row from the new
// pure derivation + one line per active upstream provider + the seed
// honesty line + the two buttons. No jsdom in the repo, so DOM assertions
// are runtime tests over the real pure modules + source-scan pins over
// the real app.js / index.html / dashboard.css — the established pattern.
// Synthetic data only; the Nayatel seed figures (502,820 / 2025-05-05 /
// 60,575) are the published design facts. No customer names, no phone
// numbers, no account IDs anywhere in this file.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculatePnlAnalytics,
  calculateLifetimePnl,
  formatHisaabDuration,
  formatHisaabDate,
} from '../dashboard-pnl.js';
import {
  loadUpstreamProviders,
  summarizeProvider,
  providerBillTotals,
  SEED_TOTAL_PAID,
  SEED_SINCE,
} from '../upstream-providers.js';
import { DASHBOARD_WIDGET_SECTIONS } from '../dashboard-widget-order.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const dashboardCss = readFileSync(join(dir, '..', 'dashboard.css'), 'utf8');
const navJs = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// The H1 module seeds on first read when the key is absent — same stub
// as tests/upstream-providers.test.js.
class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
let mockStorage;
test.beforeEach(() => {
  mockStorage = new MockLocalStorage();
  globalThis.localStorage = mockStorage;
});
test.afterEach(() => {
  delete globalThis.localStorage;
});

// The repro state (repro-h3.mjs): Nov 2026 activity + Jun 2025 activity
// (outside any 6- or 12-month window ending Nov 2026) + one voided Nov
// payment. Pattern-fake names only.
const REPRO_STATE = {
  customers: [{
    id: 'cust-test-1', name: 'Test Customer 1',
    bills: [
      { month: '2026-11', payments: [
        { date: '2026-11-05', amount: 3000 },
        { date: '2026-11-06', amount: 9999, voided: true },
      ] },
      { month: '2025-06', payments: [{ date: '2025-06-10', amount: 5000 }] },
    ],
  }],
  expenses: [
    { date: '2026-11-07', amount: 1000, category: 'Other expenses' },
    { date: '2025-06-15', amount: 2000, category: 'Other expenses' },
  ],
};
const REF = new Date('2026-11-18T00:00:00Z');

/* ---------------- G1 — Lifetime derivation (D2(a)) ---------------- */

test('hisaab G1: lifetime on the repro state is 8000 / 3000 / 5000, margin 62.5, earliest 2025-06-10 (voided 9999 excluded)', () => {
  const life = calculateLifetimePnl(REPRO_STATE, { referenceDate: REF });
  assert.equal(life.income, 8000, 'income counts the Jun 2025 payment too, never the voided one');
  assert.equal(life.expenses, 3000, 'expenses count both months');
  assert.equal(life.profit, 5000);
  assert.equal(life.margin, 62.5, '5000 / 8000 * 100');
  assert.equal(life.earliest, '2025-06-10', 'first payment date, before the first expense 2025-06-15');
  assert.equal(life.hasRecords, true);
  assert.equal(life.incomeCount, 2, 'two non-voided payments');
  assert.equal(life.expenseCount, 2);
});

test('hisaab G1: on window-contained data the lifetime agrees with the engine summary (3000 / 1000)', () => {
  const windowState = {
    customers: [{ id: 'cust-test-2', name: 'Test Customer 2',
      bills: [{ month: '2026-11', payments: [{ date: '2026-11-05', amount: 3000 }] }] }],
    expenses: [{ date: '2026-11-07', amount: 1000, category: 'Other expenses' }],
  };
  const life = calculateLifetimePnl(windowState, { referenceDate: REF });
  const pnl = calculatePnlAnalytics(windowState, { selectedMonth: '2026-11', windowMonths: 6, referenceDate: REF });
  assert.equal(life.income, pnl.summary.totalIncome);
  assert.equal(life.expenses, pnl.summary.totalExpenses);
  assert.equal(life.income, 3000);
  assert.equal(life.expenses, 1000);
});

test('hisaab G1: empty ledger has no records and no earliest — the card reads "Abhi koi record nahi", never Rs. 0', () => {
  const life = calculateLifetimePnl({ customers: [], expenses: [] }, { referenceDate: REF });
  assert.equal(life.hasRecords, false);
  assert.equal(life.earliest, null);
  assert.equal(life.income, 0);
  assert.equal(life.expenses, 0);
  assert.equal(life.profit, 0);
  assert.equal(life.margin, 0, 'no income and no expenses: margin 0, never -100');
});

/* ---------------- G2 — Month row (D2(a), D3(a)) ---------------- */

test('hisaab G2: the engine month row is the month slice (Nov 2026: 3000 / 1000 / 2000, margin 66.7)', () => {
  const pnl = calculatePnlAnalytics(REPRO_STATE, { selectedMonth: '2026-11', windowMonths: 6, referenceDate: REF });
  const novRow = pnl.monthlyData.find((m) => m.month === '2026-11');
  assert.ok(novRow, 'the window ending Nov 2026 contains the Nov row');
  assert.equal(novRow.income, 3000);
  assert.equal(novRow.expenses, 1000);
  assert.equal(novRow.netProfit, 2000);
  assert.equal(novRow.profitMargin, 66.7);
});

test('hisaab G2: month-empty but lifetime-full — Nov row is NO_ACTIVITY with 0s while the lifetime income still stands at 5000', () => {
  const oldOnly = { customers: [{ id: 'cust-test-3', name: 'Test Customer 3', bills: [
    { month: '2025-06', payments: [{ date: '2025-06-10', amount: 5000 }] }] }], expenses: [] };
  const pnl = calculatePnlAnalytics(oldOnly, { selectedMonth: '2026-11', windowMonths: 6, referenceDate: REF });
  const novRow = pnl.monthlyData.find((m) => m.month === '2026-11');
  assert.equal(novRow.status, 'NO_ACTIVITY');
  assert.equal(novRow.income, 0);
  assert.equal(novRow.expenses, 0);
  const life = calculateLifetimePnl(oldOnly, { referenceDate: REF });
  assert.equal(life.income, 5000, 'the lifetime keeps the Jun 2025 record');
  assert.equal(life.hasRecords, true);
});

/* ---------------- G3 — Nayatel line + duration (D6(a), D7(a), D9(a)) ---------------- */

test('hisaab G3: Nayatel seed summary — total 502,820, since 2025-05-05, last bill 2026-10-31 60,575, pending Nov 2026 60,575, 21 known + 1 unknown of 22 rows', () => {
  const providers = loadUpstreamProviders();
  const nayatel = providers.providers.find((p) => p.name === 'Nayatel');
  assert.ok(nayatel, 'the seed provider exists');
  const summary = summarizeProvider(nayatel);
  assert.equal(summary.total, 502820);
  assert.equal(summary.since, '2025-05-05');
  assert.equal(summary.lastBill.date, '2026-10-31');
  assert.equal(summary.lastBill.amount, 60575);
  assert.equal(summary.lastBill.date.slice(0, 7), '2026-10', 'the Haali-bill month comes from the PAYMENT date (cash basis), not billMonth');
  assert.equal(summary.pendingBill.month, '2026-11');
  assert.equal(summary.pendingBill.amount, 60575);
  const totals = providerBillTotals(nayatel);
  assert.equal(totals.knownCount, 21);
  assert.equal(totals.unknownCount, 1);
  assert.equal(totals.billCount, 22);
  assert.equal(SEED_TOTAL_PAID, 502820);
  assert.equal(SEED_SINCE, '2025-05-05');
});

test('hisaab G3: duration is a calendar walk — "1 saal 6 mahine 13 din", same-day "0 din" — and the Since date renders "05 May 2025"', () => {
  assert.equal(formatHisaabDuration('2025-05-05', '2026-11-18'), '1 saal 6 mahine 13 din');
  assert.equal(formatHisaabDuration('2025-05-05', '2026-11-01'), '1 saal 5 mahine 27 din');
  assert.equal(formatHisaabDuration('2026-11-18', '2026-11-18'), '0 din');
  assert.equal(formatHisaabDuration('', '2026-11-18'), '', 'a missing since never renders a duration');
  assert.equal(formatHisaabDuration('2026-11-18', '2025-05-05'), '', 'a today before the since never renders a negative duration');
  assert.equal(formatHisaabDate('2025-05-05'), '05 May 2025', 'humanDate() renders "May 5, 2025" in this runtime — the Hisaab Since line uses this local format instead');
  assert.equal(formatHisaabDate('2026-10-31'), '31 Oct 2026');
  assert.equal(formatHisaabDate('not-a-date'), '');
});

/* ---------------- G4 — Section + order (D1(a), D4(a), D10(a)) ---------------- */

test('hisaab G4: the widget order has 13 sections with Hisaab directly after Today\'s Summary (index 5, 6th)', () => {
  assert.equal(DASHBOARD_WIDGET_SECTIONS.length, 13, '12 + Hisaab');
  assert.equal(DASHBOARD_WIDGET_SECTIONS[5].id, 'hisaabSection');
  assert.equal(DASHBOARD_WIDGET_SECTIONS[5].name, 'Hisaab — Kya khoya, kya paya');
  assert.equal(DASHBOARD_WIDGET_SECTIONS[4].id, 'homeTodaySection');
  assert.equal(DASHBOARD_WIDGET_SECTIONS[6].id, 'recentPaymentsSection');
  assert.ok(Object.isFrozen(DASHBOARD_WIDGET_SECTIONS), 'the section list stays frozen');
});

test('hisaab G4: the section sits directly after Today\'s Summary and before Recent Payments, both button ids exist, the honesty text exists, the grid stays 3-across at 360px', () => {
  // The Hisaab section is the NEXT section after Today's Summary at the
  // same level: between the Today close and the Hisaab open there is only
  // the H3 comment — no other section or div opens.
  const todayClose = indexHtml.indexOf('</section>', indexHtml.indexOf('id="homeTodaySection"'));
  const hisaabAt = indexHtml.indexOf('id="hisaabSection"');
  assert.ok(todayClose >= 0 && hisaabAt > todayClose, 'the Hisaab section follows Today\'s Summary');
  // Slice up to the Hisaab section's own opening tag (its id sits inside
  // that tag, so slicing to the id would include the tag itself).
  const hisaabTagAt = indexHtml.lastIndexOf('<section', hisaabAt);
  const between = indexHtml.slice(todayClose, hisaabTagAt);
  assert.ok(!between.includes('<section'), 'no section opens between Today and Hisaab');
  assert.ok(!between.includes('<div'), 'no div opens between Today and Hisaab — the section is a direct dashboard child at the same level');
  const recentAt = indexHtml.indexOf('id="recentPaymentsSection"');
  assert.ok(recentAt > hisaabAt, 'Recent Payments follows Hisaab');
  assert.ok(/<section class="home-today-section" id="hisaabSection" aria-labelledby="hisaabHeading">/.test(indexHtml), 'the section carries the Today-section shell pattern');
  assert.ok(/id="hisaabOpenPnlBtn"/.test(indexHtml), 'the P&L button id exists');
  assert.ok(/id="hisaabShowExpensesBtn"/.test(indexHtml), 'the Kharch button id exists');
  assert.ok(/is register se pehle diye gaye/.test(indexHtml), 'the verbatim honesty-line text exists in the section');
  assert.ok(indexHtml.includes('Hisaab — Kya khoya, kya paya'), 'the widget-order placeholder names the Hisaab section');
  // The 3-across grid rule (D4(a)): repeat(3, minmax(0,1fr)), 8px gap,
  // values wrap — in dashboard.css, never styles.css (which H3 must not touch).
  assert.ok(/\.hisaab-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*8px/s.test(dashboardCss), 'the Hisaab grid is 3-across with an 8px gap');
  assert.ok(/\.hisaab-metric-grid \.ds-stat\s*\{[^}]*min-width:\s*0/s.test(dashboardCss), 'the metric cards can shrink to their column');
  assert.ok(/\.hisaab-metric \.home-kpi-val\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(dashboardCss), 'values wrap, never clip');
});

/* ---------------- G5 — Navigation + i18n steady (D5(a), D8(a)) ---------------- */

test('hisaab G5: "Kharch dekhein" is bound once, with a guard flag, to the ledger landing — the P&L button is NOT bound yet (H4) and parity stays 4,735/4,735', () => {
  const listeners = (appJs.match(/\$\('#hisaabShowExpensesBtn'\)\?\.addEventListener\('click'/g) || []).length;
  assert.equal(listeners, 1, '"Kharch dekhein" is bound exactly once');
  assert.ok(appJs.includes('let hisaabShowExpensesBound = false;'), 'the once-only guard flag exists');
  assert.ok(appJs.includes("if (!hisaabShowExpensesBound) {"), 'the guard is checked before binding');
  const binding = appJs.slice(appJs.indexOf("$('#hisaabShowExpensesBtn')"));
  assert.ok(binding.includes("expenseActiveTab='ledger';switchView('expenses');renderExpenses();"), 'the landing is the expenses ledger tab, exactly like the Show Expenses button');
  assert.ok(appJs.includes('renderHisaabSection(state, referenceDate);'), 'renderDashboard fills the section next to the Owner Khata block');
  assert.ok(!/pnlModalController\.open\(/.test(appJs), 'no caller of the P&L modal exists yet — C4 stays FAIL until H4 wires the button');
  assert.ok(!/hisaab_/.test(navJs), 'no hisaab_ keys in nav-language.js — H5 owns them');
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4735, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4735, 'UR key count moved');
});
