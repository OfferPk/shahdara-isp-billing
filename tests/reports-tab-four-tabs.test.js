// tests/reports-tab-four-tabs.test.js — Reports tab 4 sub-tabs + alignment
// & color fixes. Generic fixtures only: no real customer names, amounts or
// counts. This file asserts NO parity total and contains no bare literal of
// any parity total (the plan591 G5a sweep forbids it outside pinning files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import { shortBarMonthLabel } from '../owner-ui.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(rootDir, f), 'utf8');

test('tab bar: 4 buttons, keyed labels, Status is the default pressed tab', () => {
  const html = read('index.html');
  assert.ok(html.includes('class="reports-tabs"'));
  const buttons = [...html.matchAll(/<button[^>]*class="[^"]*reports-tab[^"]*"[^>]*>/g)];
  assert.equal(buttons.length, 4);
  for (const tab of ['Status', 'Register', 'Compare', 'Closing']) {
    assert.ok(html.includes(`aria-controls="reportsTab${tab}"`), tab);
    assert.ok(html.includes(`id="reportsTab${tab}"`), `wrapper ${tab}`);
  }
  const statusBtn = html.match(/<button[^>]*aria-controls="reportsTabStatus"[^>]*>/)[0];
  assert.ok(statusBtn.includes('aria-pressed="true"'));
  for (const key of ['bill_tab_status', 'bill_tab_register', 'bill_tab_compare', 'bill_tab_closing']) {
    assert.ok(html.includes(`data-i18n="${key}"`), key);
    assert.ok(TRANSLATIONS.en[key], `EN ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `UR ${key}`);
  }
});

test('tab bar: sticky below the topbar at every breakpoint', () => {
  const css = read('styles.css');
  const bar = css.match(/\.reports-tabs\{[^}]*\}/);
  assert.ok(bar, 'reports-tabs rule exists');
  assert.ok(bar[0].includes('position:sticky'));
  assert.ok(bar[0].includes('top:78px'));
  assert.ok(bar[0].includes('z-index:2'));
  assert.ok(css.includes('.reports-tabs{top:58px}'), '<=620px follows the 58px topbar');
  assert.ok(css.includes('.reports-tabs.reports-tabs { top: 56px; }'), '<=380px follows the 56px topbar');
});

test('regroup map: every Reports panel in exactly one tab', () => {
  const appJs = read('app.js');
  const i = appJs.indexOf('setupReportsTabs');
  assert.ok(i >= 0);
  const region = appJs.slice(i, i + 6000);
  const expected = {
    status: ['.report-heading', '#billsActionsBar', '.report-filters', '.report-search-bar', '#monthlyReportSummaryBar', '#monthlyReportCount', '.mohalla-analytics', '#reportAreaFilterChip', '#monthlyReportList', '#monthlyReportPagination', '#monthlyReportEmpty', '.report-not-set-note', '#duesRecoveryPanel', '#smartAlertsPanel', '#targetGaugeSection', 'h3[data-i18n="ops_section_billing"]', '.summary-billing-cycle', '.summary-complaint-register', '.summary-field-tickets', '.summary-monthly-complaint-report', '.summary-group-billing', 'h3[data-i18n="ops_section_workers"]', '.summary-saad-visits', '.summary-lineman-scorecard'],
    register: ['#stxTaxDashboard', '#billingRegisterSection'],
    compare: ['#monthComparisonSection', '#customerRankingsSection', '#multiMonthMatrixSection', '#annualOwnerSummarySection', '#collectionVelocitySection', '#packageUpgradeSection', '#fuelCostSection', '#winBackSection', '#atRiskLoyalSection', '#revenueLeakSection', '#hardwareAuditSection'],
    closing: ['#savedClosingsSection', '#dailyRoznamchaSection', '#ownerKhataSection', '#newCustomersSection', '#monthCompareSection', '#printSummarySection'],
  };
  const all = Object.values(expected).flat();
  assert.equal(all.length, 43);
  assert.equal(new Set(all).size, 43, 'no selector in two tabs');
  for (const sel of all) assert.ok(region.includes(sel), `map names ${sel}`);
  assert.ok(region.includes('.hidden ='), 'sync hides panels, it does not skip rendering');
});

test('Archived checkbox: scoped inline-flex rule keeps box and label on one row', () => {
  const css = read('styles.css');
  const m = css.match(/\.report-filter-archived\s*\{[^}]*\}/);
  assert.ok(m, 'rule exists');
  assert.ok(m[0].includes('display: inline-flex'));
  assert.ok(m[0].includes('white-space: nowrap'));
  assert.ok(m[0].includes('flex: 0 0 auto'));
});

test('search placeholder is short in both dicts and in the static fallback', () => {
  assert.equal(TRANSLATIONS.en.bill_search_placeholder, 'Search customer...');
  assert.ok(TRANSLATIONS.ur.bill_search_placeholder.length <= 40, 'UR value is short too');
  assert.ok(read('index.html').includes('placeholder="Search customer..."'));
  assert.ok(!read('index.html').includes("placeholder=\"Search customer in this month's report"));
});

test("bar labels use the Oct '26 format while selects keep Oct 2026", () => {
  assert.equal(shortBarMonthLabel('2026-10'), "Oct '26");
  assert.equal(shortBarMonthLabel('2026-11'), "Nov '26");
  assert.equal(shortBarMonthLabel('2026-01'), "Jan '26");
  const ownerUi = read('owner-ui.js');
  assert.ok(ownerUi.includes('shortBarMonthLabel(a)'));
  assert.ok(ownerUi.includes('shortBarMonthLabel(b)'));
  assert.ok(!ownerUi.includes('${monthName(a)}'), 'long label gone from the bars');
  assert.ok(!ownerUi.includes('${monthName(b)}'), 'long label gone from the bars');
  const ensure = ownerUi.slice(ownerUi.indexOf('const ensureMonthOptions'), ownerUi.indexOf('const ensureMonthOptions') + 800);
  assert.ok(!ensure.includes('shortBarMonthLabel'), 'selects do not use the bar format');
});

test('negative Khata profit gets the rose class; positive stays emerald', () => {
  const css = read('styles.css');
  const m = css.match(/\.summary-value--negative\s*\{[^}]*\}/);
  assert.ok(m, 'scoped rule exists');
  assert.ok(m[0].includes('var(--qc-rose-strong-text)'), 'rose token, no new hex');
  const appJs = read('app.js');
  assert.ok(appJs.includes("classList.toggle('summary-value--negative'"));
  assert.ok(appJs.includes('khata.profit < 0'));
  const base = css.match(/\.summary-value, \.phase3-metric strong \{[^}]*\}/);
  assert.ok(base && base[0].includes('color: var(--green)'), 'base stays emerald');
});

test('monthly cards left-align values at phone widths; register rows untouched', () => {
  const css = read('styles.css');
  const start700 = css.indexOf('@media (max-width: 700px)');
  const block700 = css.slice(start700, css.indexOf('@media (max-width: 620px)', start700));
  for (const n of [2, 3, 5, 6]) {
    assert.ok(block700.includes(`.monthly-report-list .report-row > .report-cell:nth-of-type(${n}) .report-cell-value`), `nth-of-type(${n})`);
  }
  assert.ok(block700.includes('text-align: left'));
  assert.ok(!css.includes('.register-row .report-cell-value'), 'no override touches register rows');
});

test('Not-set Service/Provider pills are not rendered; Package pill stays', () => {
  const appJs = read('app.js');
  assert.ok(appJs.includes("serviceLabel === t('bill_not_set') ? ''"));
  assert.ok(appJs.includes("provider === t('bill_not_set') ? ''"));
  assert.ok(!appJs.includes("speed === t('bill_not_set') ? ''"), 'Package pill is not guarded');
  const reg = appJs.slice(appJs.indexOf('function renderBillingRegister'), appJs.indexOf('function renderBillingRegister') + 4000);
  assert.ok(!reg.includes('report-tags'), 'register rows carry no pills');
});

test('screen isolation: Issue-287 rules key off the tab wrappers, not .report-pane children', () => {
  const css = read('styles.css');
  // The old direct-child rules would double-hide on recovery/alerts and
  // leak on bills once the panels sit inside the tab wrappers.
  assert.ok(!css.includes('.report-pane > :not(#duesRecoveryPanel)'), 'old recovery rule gone');
  assert.ok(!css.includes('.report-pane > :not(#smartAlertsPanel)'), 'old alerts rule gone');
  assert.ok(!css.includes('.report-pane > section.owner-report-panel'), 'old bills rule gone');
  for (const sel of [
    '#billingReportsView[data-report-screen="recovery"] .reports-tabs',
    '#billingReportsView[data-report-screen="recovery"] .reports-tab-panel:not(#reportsTabStatus)',
    '#billingReportsView[data-report-screen="recovery"] #reportsTabStatus > :not(#duesRecoveryPanel)',
    '#billingReportsView[data-report-screen="alerts"] .reports-tabs',
    '#billingReportsView[data-report-screen="alerts"] .reports-tab-panel:not(#reportsTabStatus)',
    '#billingReportsView[data-report-screen="alerts"] #reportsTabStatus > :not(#smartAlertsPanel)',
    '#billingReportsView[data-report-screen="bills"] .reports-tabs',
    '#billingReportsView[data-report-screen="bills"] .reports-tab-panel:not(#reportsTabStatus)',
    '#billingReportsView[data-report-screen="bills"] #reportsTabStatus > #duesRecoveryPanel',
    '#billingReportsView[data-report-screen="bills"] #reportsTabStatus > #smartAlertsPanel',
  ]) assert.ok(css.includes(sel), `wrapper-aware rule: ${sel}`);
});

test('router: bills / recovery / alerts force the Status tab', () => {
  const router = read('screen-router.js');
  for (const screen of ['bills', 'recovery', 'alerts']) {
    const spec = router.match(new RegExp(`${screen}: \\{[^}]*\\}`))[0];
    assert.ok(spec.includes("reportsTab: 'status'"), `${screen} carries reportsTab: 'status'`);
  }
  const reportsSpec = router.match(/reports: \{[^}]*\}/)[0];
  assert.ok(!reportsSpec.includes('reportsTab'), 'the reports screen keeps session state, it does not force a tab');
  assert.ok(router.includes('win.setReportsTab(screenSpec.reportsTab)'), 'apply() activates it');
  const appJs = read('app.js');
  assert.ok(appJs.includes('window.setReportsTab'), 'app exposes the global');
  assert.ok(appJs.includes('function setReportsTab(tab)'), 'setter exists');
});

test('Smart Alerts panel has a visible heading reusing drawer_alerts (no new key)', () => {
  const html = read('index.html');
  const panel = html.slice(html.indexOf('id="smartAlertsPanel"'), html.indexOf('id="smartAlertsPanel"') + 600);
  assert.ok(panel.includes('<h3'), 'heading exists in the panel');
  assert.ok(panel.includes('data-i18n="drawer_alerts"'), 'heading reuses drawer_alerts');
  assert.equal(TRANSLATIONS.en.drawer_alerts, 'Smart Alerts');
  assert.ok(TRANSLATIONS.ur.drawer_alerts, 'UR drawer_alerts');
  assert.ok(panel.indexOf('<h3') < panel.indexOf('id="smartAlertsSummary"'), 'heading sits before the summary');
});
