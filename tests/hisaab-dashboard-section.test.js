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
import { TRANSLATIONS, t } from '../nav-language.js';

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

test('hisaab G4: the widget order has 12 sections with Hisaab directly after Today\'s Summary (index 5, 6th)', () => {
  // Home Tab M3 polish (user decision 2026-11-22): 13 -> 12 — the
  // System Health section left the reorderable list (it lives in the
  // More menu now). Hisaab's own position is unchanged: still index 5,
  // directly after Today's Summary, before Recent Payments.
  assert.equal(DASHBOARD_WIDGET_SECTIONS.length, 12, '11 + Hisaab');
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
  // values never wrap (polish reversal — see the note below) — in
  // dashboard.css, never styles.css (which H3 must not touch).
  assert.ok(/\.hisaab-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*8px/s.test(dashboardCss), 'the Hisaab grid is 3-across with an 8px gap');
  assert.ok(/\.hisaab-metric-grid \.ds-stat\s*\{[^}]*min-width:\s*0/s.test(dashboardCss), 'the metric cards can shrink to their column');
  // Hisaab-home polish — NAMED REVERSAL of the H3 D4(a) "values wrap"
  // pin above: the user reported a 6-digit figure WRAPPING (final digit
  // on a new line) as the defect, so the value rule now forbids wrapping
  // outright — 14px/800, nowrap, tabular-nums, overflow-wrap normal.
  // The "never clip" half survives as an ellipsis: an over-long figure
  // (8 digits at 360px) shows '…' instead of wrapping or clipping
  // invisibly. Bare numbers + px-2 make 6-digit figures fit both
  // 360px (80px content) and 320px (66.7px content).
  assert.ok(/\.hisaab-metric \.home-kpi-val\s*\{[^}]*white-space:\s*nowrap/s.test(dashboardCss), 'values never wrap (polish reversal of the H3 wrap pin)');
  assert.ok(/\.hisaab-metric \.home-kpi-val\s*\{[^}]*overflow-wrap:\s*normal/s.test(dashboardCss), 'the old anywhere wrap is neutralised');
  assert.ok(!/\.hisaab-metric \.home-kpi-val\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(dashboardCss), 'no anywhere wrap left on the hisaab value');
});

/* ---------------- G5 — Navigation + i18n steady (D5(a), D8(a)) ---------------- */

test('hisaab G5: "Kharch dekhein" is bound once, with a guard flag, to the ledger landing — the P&L button is NOT bound yet (H4) and parity stays 5,162/5,162', () => {
  const listeners = (appJs.match(/\$\('#hisaabShowExpensesBtn'\)\?\.addEventListener\('click'/g) || []).length;
  assert.equal(listeners, 1, '"Kharch dekhein" is bound exactly once');
  assert.ok(appJs.includes('let hisaabShowExpensesBound = false;'), 'the once-only guard flag exists');
  assert.ok(appJs.includes("if (!hisaabShowExpensesBound) {"), 'the guard is checked before binding');
  const binding = appJs.slice(appJs.indexOf("$('#hisaabShowExpensesBtn')"));
  assert.ok(binding.includes("expenseActiveTab='ledger';switchView('expenses');renderExpenses();"), 'the landing is the expenses ledger tab, exactly like the Show Expenses button');
  assert.ok(appJs.includes('renderHisaabSection(state, referenceDate);'), 'renderDashboard fills the section next to the Owner Khata block');
  assert.ok(!/pnlModalController\.open\(/.test(appJs), 'no caller of the P&L modal exists yet — C4 stays FAIL until H4 wires the button');
  // Hisaab H5: the hisaab_* keys exist (30, ×2 dicts) + the one exp_*
  // refusal hint (D2(b)). The !/pnlModalController\.open\(/ line above
  // is H4's — it still passes because H4's call is the guarded
  // `pnlModalController?.open()`, which the unguarded-call regex does
  // not match; H5 does not touch H4's line.
  const hisaabKeyDefs = (navJs.match(/^    hisaab_[a-z_]+:/gm) || []).length;
  assert.equal(hisaabKeyDefs, 60, '30 hisaab_* keys × 2 dicts');
  assert.ok(navJs.includes("exp_upstream_synced_hint: 'This expense is synced from the Upstream tab."), 'the D2(b) refusal hint key exists');
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds
  // exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR.
  // The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5234, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5234, 'UR key count moved');
});

/* ---------------- G6 — H5 i18n + parity + munafa (D1(a)–D10(a)) ---------------- */

const HISAAB_KEYS = [
  'hisaab_section_title', 'hisaab_section_subtitle', 'hisaab_toggle_month',
  'hisaab_label_income', 'hisaab_label_expenses', 'hisaab_label_profit',
  'hisaab_label_paid', 'hisaab_section_lifetime', 'hisaab_month_empty',
  'hisaab_lifetime_empty', 'hisaab_open_pnl', 'hisaab_show_expenses',
  'hisaab_month_label', 'hisaab_month_margin', 'hisaab_since',
  'hisaab_provider_no_bills', 'hisaab_provider_paid_total',
  'hisaab_provider_paid_unknown', 'hisaab_amount_unknown',
  'hisaab_provider_since', 'hisaab_provider_last_bill',
  'hisaab_provider_pending', 'hisaab_provider_unknown_one',
  'hisaab_provider_unknown_many', 'hisaab_provider_none', 'hisaab_honesty',
  'hisaab_duration_year', 'hisaab_duration_month_one',
  'hisaab_duration_month_many', 'hisaab_duration_day',
  'hisaab_business_days', 'hisaab_avg_bill',
  'hisaab_expense_per_customer', 'hisaab_profit_per_customer',
];

test('hisaab G6a: all 30 hisaab_* keys + exp_upstream_synced_hint exist in both dicts; parity is 5,222/5,222', () => {
  for (const key of HISAAB_KEYS) {
    assert.ok(key in TRANSLATIONS.en, `EN has ${key}`);
    assert.ok(key in TRANSLATIONS.ur, `UR has ${key}`);
  }
  assert.ok('exp_upstream_synced_hint' in TRANSLATIONS.en, 'EN has the D2(b) refusal hint');
  assert.ok('exp_upstream_synced_hint' in TRANSLATIONS.ur, 'UR has the D2(b) refusal hint');
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds
  // exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR.
  // The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5234, 'EN parity 5,234');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5234, 'UR parity 5,234');
  // UR sentences end with ۔, fragments do not (591 bar).
  for (const key of ['hisaab_month_empty', 'hisaab_lifetime_empty', 'hisaab_provider_none', 'hisaab_honesty']) {
    assert.ok(TRANSLATIONS.ur[key].endsWith('۔'), `UR ${key} ends with ۔`);
  }
  assert.ok(TRANSLATIONS.ur.exp_upstream_synced_hint.endsWith('۔'), 'UR refusal hint ends with ۔');
  for (const key of ['hisaab_section_title', 'hisaab_label_income', 'hisaab_label_expenses', 'hisaab_label_profit', 'hisaab_label_paid', 'hisaab_section_lifetime', 'hisaab_amount_unknown', 'hisaab_provider_since']) {
    assert.ok(!TRANSLATIONS.ur[key].endsWith('۔'), `UR ${key} is a fragment, no ۔`);
  }
  // Param keys render with their params supplied (spot checks).
  assert.equal(t('hisaab_month_label', 'en', { month: 'November 2026' }), 'Is mahine · November 2026');
  assert.equal(t('hisaab_month_label', 'ur', { month: 'نومبر 2026' }), 'اس مہینے · نومبر 2026');
  assert.equal(t('hisaab_month_margin', 'ur', { margin: 62.5 }), 'مارجن 62.5٪');
});

test('hisaab G6b: the EN provider line composes byte-identical to H3\'s literal line (real seed summary, REF 2026-11-18)', () => {
  const providers = loadUpstreamProviders();
  const nayatel = providers.providers.find((p) => p.name === 'Nayatel');
  const summary = summarizeProvider(nayatel);
  const duration = formatHisaabDuration(summary.since, '2026-11-18');
  const bits = [
    t('hisaab_provider_paid_total', 'en', { amount: 'PKR 502,820' }),
    `${t('hisaab_provider_since', 'en', { date: formatHisaabDate(summary.since) })} (${duration})`,
    t('hisaab_provider_last_bill', 'en', { amount: 'PKR 60,575', month: 'October 2026' }),
    t('hisaab_provider_pending', 'en', { month: 'November 2026', amount: 'PKR 60,575' }),
    t('hisaab_provider_unknown_one', 'en', { count: 1 }),
  ];
  assert.equal(`Nayatel — ${bits.join(' · ')}`,
    'Nayatel — Kul ada PKR 502,820 · 05 May 2025 se (1 saal 6 mahine 13 din) · Haali bill PKR 60,575 (October 2026) · November 2026 bill PKR 60,575 — abhi baqi · 1 bill raqam maloom nahi');
  // The static title + honesty line are byte-identical to their keys.
  const titleMatch = indexHtml.match(/<h3 id="hisaabHeading"[^>]*>([^<]*)</);
  assert.ok(titleMatch, 'the section h3 exists');
  assert.equal(t('hisaab_section_title', 'en'), titleMatch[1]);
  const honestyMatch = indexHtml.match(/<p class="phase3-note" id="hisaabHonestyLine"[^>]*>([^<]*)</);
  assert.ok(honestyMatch, 'the honesty line exists');
  assert.equal(t('hisaab_honesty', 'en'), honestyMatch[1]);
});

test('hisaab G6c: the UR provider line composes with the same structure (real seed summary, UR labels + UR months)', () => {
  const providers = loadUpstreamProviders();
  const nayatel = providers.providers.find((p) => p.name === 'Nayatel');
  const summary = summarizeProvider(nayatel);
  const urLabels = {
    year: t('hisaab_duration_year', 'ur'),
    monthOne: t('hisaab_duration_month_one', 'ur'),
    monthMany: t('hisaab_duration_month_many', 'ur'),
    day: t('hisaab_duration_day', 'ur'),
  };
  const duration = formatHisaabDuration(summary.since, '2026-11-18', urLabels);
  const bits = [
    t('hisaab_provider_paid_total', 'ur', { amount: 'PKR 502,820' }),
    `${t('hisaab_provider_since', 'ur', { date: formatHisaabDate(summary.since) })} (${duration})`,
    t('hisaab_provider_last_bill', 'ur', { amount: 'PKR 60,575', month: 'اکتوبر 2026' }),
    t('hisaab_provider_pending', 'ur', { month: 'نومبر 2026', amount: 'PKR 60,575' }),
    t('hisaab_provider_unknown_one', 'ur', { count: 1 }),
  ];
  assert.equal(`Nayatel — ${bits.join(' · ')}`,
    'Nayatel — کل ادا PKR 502,820 · 05 May 2025 سے (1 سال 6 مہینے 13 دن) · حالی بل PKR 60,575 (اکتوبر 2026) · نومبر 2026 بل PKR 60,575 — ابھی باقی · 1 بل رقم معلوم نہیں');
  assert.ok(t('hisaab_honesty', 'ur').endsWith('۔'), 'UR honesty ends with ۔');
  assert.ok(t('hisaab_honesty', 'ur').includes('Nayatel'), 'UR honesty keeps Nayatel Latin');
  assert.ok(t('hisaab_honesty', 'ur').includes('PKR 502,820'), 'UR honesty keeps PKR 502,820 Latin (Sharafat 85: no Rs. token in nav-language.js)');
  // The no-bills provider composes in UR with and without a pending bill.
  assert.equal(`Nayatel — ${t('hisaab_provider_no_bills', 'ur')} · ${t('hisaab_provider_pending', 'ur', { month: 'نومبر 2026', amount: 'PKR 60,575' })}`,
    'Nayatel — ابھی کوئی بل نہیں · نومبر 2026 بل PKR 60,575 — ابھی باقی');
  assert.equal(`Nayatel — ${t('hisaab_provider_no_bills', 'ur')}`, 'Nayatel — ابھی کوئی بل نہیں');
});

test('hisaab G6d: duration labels + singular — defaults unchanged, UR labels render, 1-month span is "1 mahina" / "1 مہینہ"', () => {
  assert.equal(formatHisaabDuration('2025-05-05', '2026-11-19'), '1 saal 6 mahine 14 din', 'no labels argument: defaults unchanged (H3 G3 still passes)');
  assert.equal(formatHisaabDuration('2026-10-05', '2026-11-05'), '1 mahina', 'the singular fix — was "1 mahine"');
  const urLabels = {
    year: t('hisaab_duration_year', 'ur'),
    monthOne: t('hisaab_duration_month_one', 'ur'),
    monthMany: t('hisaab_duration_month_many', 'ur'),
    day: t('hisaab_duration_day', 'ur'),
  };
  assert.equal(formatHisaabDuration('2025-05-05', '2026-11-19', urLabels), '1 سال 6 مہینے 14 دن');
  assert.equal(formatHisaabDuration('2026-10-05', '2026-11-05', urLabels), '1 مہینہ');
  assert.equal(formatHisaabDuration('2026-11-18', '2026-11-18', urLabels), '0 دن');
  assert.equal(formatHisaabDuration('2026-11-18', '2026-11-18'), '0 din');
  assert.equal(formatHisaabDuration('', '2026-11-18'), '');
  assert.equal(formatHisaabDuration('2026-11-18', '2025-05-05'), '');
  // A partial labels object falls back to the defaults for the rest.
  assert.equal(formatHisaabDuration('2026-10-05', '2026-11-05', { monthOne: '{n} mahina' }), '1 mahina');
});

test('hisaab G6e: munafa colour + wiring pins — brand-500/danger pass 4.5:1 in both themes, paid/overdue fail in dark, statics keyed, params unkeyed', () => {
  // WCAG relative-luminance contrast (the plan590 math, verbatim).
  const hexLum = (hex) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [l1, l2] = [hexLum(a), hexLum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const LIGHT_CARD = '#ffffff';
  const DARK_CARD = '#14241f';
  assert.equal(contrast('#145b4b', LIGHT_CARD).toFixed(2), '7.99', 'brand-500 light');
  assert.equal(contrast('#29b88f', DARK_CARD).toFixed(2), '6.41', 'brand-500 dark');
  assert.equal(contrast('#b42318', LIGHT_CARD).toFixed(2), '6.57', 'danger light');
  assert.equal(contrast('#ffb4a8', DARK_CARD).toFixed(2), '9.48', 'danger dark');
  // The tempting pair fails in dark (no dark values) — pinned so a
  // future "helpful" swap to paid-green/overdue-red fails loudly.
  assert.equal(contrast('#19704e', DARK_CARD).toFixed(2), '2.66', 'paid in dark');
  assert.equal(contrast('#b33c33', DARK_CARD).toFixed(2), '2.77', 'overdue in dark');
  assert.ok(contrast('#19704e', DARK_CARD) < 4.5, 'paid must never colour munafa');
  assert.ok(contrast('#b33c33', DARK_CARD) < 4.5, 'overdue must never colour munafa');
  // The two token-only rules in dashboard.css, no hex, no paid/overdue.
  assert.ok(/\.home-kpi-val\.hisaab-metric--profit\s*\{[^}]*color:\s*var\(--color-brand-500\)/.test(dashboardCss), 'profit rule uses --color-brand-500');
  assert.ok(/\.home-kpi-val\.hisaab-metric--loss\s*\{[^}]*color:\s*var\(--color-danger\)/.test(dashboardCss), 'loss rule uses --color-danger');
  assert.ok(!/\.hisaab-metric--(profit|loss)\s*\{[^}]*#[0-9a-fA-F]/.test(dashboardCss), 'no hex in the munafa rules');
  assert.ok(!/\.hisaab-metric--(profit|loss)\s*\{[^}]*--color-(paid|overdue)/.test(dashboardCss), 'no paid/overdue in the munafa rules');
  const darkCss = readFileSync(join(dir, '..', 'dark-contrast.css'), 'utf8');
  assert.ok(!/hisaab-metric--/.test(darkCss), 'dark-contrast.css carries no munafa rule (the tokens already carry dark values)');
  // The render toggles both classes on both profit values, by sign
  // (zero counts as profit).
  assert.ok(appJs.includes("classList.toggle('hisaab-metric--profit'"), 'the profit class is toggled');
  assert.ok(appJs.includes("classList.toggle('hisaab-metric--loss'"), 'the loss class is toggled');
  assert.ok(appJs.includes('monthRow.netProfit >= 0'), 'month munafa: ≥ 0 is profit');
  assert.ok(appJs.includes('life.profit >= 0'), 'lifetime munafa: ≥ 0 is profit');
  // The section: all 13 static strings keyed (19 attributes) — and the
  // 6 money-value elements + the 5 param elements carry NO data-i18n
  // (D10: the toggle walk would write {month} literally on the params).
  // The values were keyed prof_not_set in the first H5 draft and the
  // 360px sample caught it: at boot the walk overwrote render's money
  // with "Not set" (values only recovered after a language toggle
  // re-rendered). Render-written elements must never carry data-i18n —
  // the "Not set" text stays as pre-JS paint only, like the param
  // initials. The profile <option> prof_not_set uses elsewhere are
  // static options, not render-written, and are untouched.
  // Hisaab-home polish: the overline eyebrow is gone (its key deleted);
  // the toggle carries hisaab_toggle_month + hisaab_section_lifetime,
  // and the Kul Munafa subtitle is the render-written #hisaabLifeMargin
  // (no data-i18n) — so paid ×5 → ×4 and attributes 20 → 19.
  const secMatch = indexHtml.match(/<section[^>]*id="hisaabSection"[\s\S]*?<\/section>/);
  assert.ok(secMatch, 'the Hisaab section exists');
  const sec = secMatch[0];
  // The 13 static keys are data-i18n'd; the 21 param keys are NOT
  // (they render through t() in renderHisaabSection — D10).
  const STATIC_KEYS = ['hisaab_section_title', 'hisaab_section_subtitle', 'hisaab_toggle_month', 'hisaab_label_income', 'hisaab_label_expenses', 'hisaab_label_profit', 'hisaab_label_paid', 'hisaab_section_lifetime', 'hisaab_month_empty', 'hisaab_lifetime_empty', 'hisaab_open_pnl', 'hisaab_show_expenses', 'hisaab_honesty'];
  for (const key of STATIC_KEYS) {
    assert.ok(sec.includes(`data-i18n="${key}"`), `the section keys ${key}`);
  }
  const PARAM_KEYS = HISAAB_KEYS.filter((k) => !STATIC_KEYS.includes(k));
  assert.equal(PARAM_KEYS.length, 21, '34 keys − 13 statics = 21 param keys');
  for (const key of PARAM_KEYS) {
    assert.ok(!sec.includes(`data-i18n="${key}"`), `param key ${key} is never a data-i18n attribute`);
  }
  assert.equal((sec.match(/data-i18n="hisaab_/g) || []).length, 19, '13 keys → 19 attributes (labels ×2, paid ×4, toggle ×2)');
  assert.equal((sec.match(/data-i18n="prof_not_set"/g) || []).length, 0, 'no prof_not_set in the section — the 6 money values are render-written, never walked');
  for (const id of ['hisaabMonthIncome', 'hisaabMonthExpenses', 'hisaabMonthProfit', 'hisaabLifeIncome', 'hisaabLifeExpenses', 'hisaabLifeProfit']) {
    const tag = sec.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];
    assert.ok(!tag.includes('data-i18n'), `#${id} carries no data-i18n (render-written value)`);
  }
  for (const id of ['hisaabMonthLabel', 'hisaabMonthMargin', 'hisaabLifeMargin', 'hisaabLifeSince']) {
    const tag = sec.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))[0];
    assert.ok(!tag.includes('data-i18n'), `#${id} carries no data-i18n (param key)`);
  }
  const providerLinesTag = sec.match(/<[^>]*id="hisaabProviderLines"[^>]*>/)[0];
  assert.ok(!providerLinesTag.includes('data-i18n'), '#hisaabProviderLines carries no data-i18n (param lines)');
});
