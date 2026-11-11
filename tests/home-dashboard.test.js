// Home Dashboard overhaul: the strict-tab rebuild — Home keeps only
// the topbar, 4 quick actions, 5 KPIs, the briefing and a Top 3
// overdue preview; everything else lives in its real bottom-nav tab
// (Collect / Reports / More). Synthetic markup and CSS assertions
// only; no customer data anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const dashboardCss = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
const componentsCss = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
const navCss = readFileSync(new URL('../nav.css', import.meta.url), 'utf8');
const navLang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const pendingClearance = readFileSync(new URL('../dashboard-pending-clearance.js', import.meta.url), 'utf8');
const refunds = readFileSync(new URL('../dashboard-refunds.js', import.meta.url), 'utf8');

// View boundaries, located dynamically so the pins survive line shifts.
const homeStart = page.indexOf('id="billingDashboard"');
const moreStart = page.indexOf('id="mobileMoreMenu"');
const collectStart = page.indexOf('id="transactionsView"');
const reportsStart = page.indexOf('id="billingReportsView"');
const homeEnd = moreStart;
const collectEnd = reportsStart;

function inside(marker, start, end, label) {
  const at = page.indexOf(marker);
  assert.ok(at >= 0, `${label} exists`);
  assert.ok(at > start && at < end, `${label} sits inside its tab (at ${at}, tab ${start}–${end})`);
}

test('home topbar keeps only Menu, Brand, Search, Notifications, Field Mode', () => {
  const header = page.slice(page.indexOf('<header class="topbar">'), page.indexOf('</header>'));
  for (const id of ['navDrawerToggle', 'mobileCustomerSearchTrigger', 'topbarPendingActionsBtn', 'fieldModeToggleBtn']) {
    assert.ok(header.includes(`id="${id}"`), `topbar keeps ${id}`);
  }
  assert.ok(header.includes('brand-mark') || header.includes('brand-copy'), 'topbar keeps the brand');
  // Everything else moved to the drawer footer/header.
  for (const id of ['languageToggleBtn', 'themeToggle', 'commandPaletteTrigger', 'shortcutsHelpButton', 'handbookButton', 'qrScanTopbarBtn', 'operatorModeToggleBtn']) {
    assert.ok(!header.includes(`id="${id}"`), `topbar no longer carries ${id}`);
  }
  assert.ok(page.includes('id="drawerLanguageToggleBtn"'), 'language toggle lives in the drawer');
  assert.ok(page.includes('id="drawerThemeToggleBtn"'), 'theme toggle lives in the drawer');
  assert.ok(page.includes('id="operatorModeToggleBtn"'), 'operator toggle lives in the drawer');
});

test('home KPI strip holds exactly the 5 core KPIs, each once', () => {
  const stripStart = page.indexOf('id="homeKpiStrip"');
  const stripEnd = page.indexOf('id="homePrimaryActions"');
  const strip = page.slice(stripStart, stripEnd);
  const cards = strip.match(/class="home-kpi-card/g) || [];
  assert.equal(cards.length, 5, `KPI strip holds exactly 5 cards, found ${cards.length}`);
  for (const id of ['kpiCardToday', 'kpiCardMonth', 'kpiCardDues']) {
    assert.ok(strip.includes(`id="${id}"`), `strip keeps ${id}`);
  }
  assert.ok(strip.includes('id="cihCashTotal"'), 'Cash in Hand lives in the strip');
  assert.ok(strip.includes('id="cihCashLine"'), 'Cash in Hand line lives in the strip');
  assert.ok(strip.includes('id="dashboardActiveCustomers"'), 'Active Subscribers lives in the strip');
  // The deleted Customers-with-Dues card survives only as the Total
  // Dues sub-line (same id, reused — not a new element id).
  assert.ok(strip.includes('id="kpiCustomersWithDues"'), 'dues sub-line lives in the strip');
  // The month card carries the progress-bar hook.
  assert.ok(strip.includes('home-kpi-progress'), 'month card carries the progress bar');
  assert.ok(app.includes("document.querySelector('#kpiCardMonth .home-kpi-progress-fill')"), 'dashboard fills the month progress bar');
  // The dues sub-line is the ENGINE-based count (derivedBillStatus),
  // not the raw due-minus-paid figure — the 39-vs-57 reconciliation.
  assert.ok(app.includes("t('dash_today_dues_count', null, { count: defaultersCount })"), 'dues sub-line uses the accounts-with-dues key');
});

test('home quick actions are exactly 4, in order, and the Most-used row is gone', () => {
  assert.ok(!page.includes('class="home-top-shortcuts"'), 'Most-used row is gone');
  const regionStart = page.indexOf('id="homePrimaryActions"');
  const region = page.slice(regionStart, regionStart + 6000);
  const tiles = region.match(/class="home-primary-btn/g) || [];
  assert.equal(tiles.length, 4, `exactly 4 quick-action tiles, found ${tiles.length}`);
  const markers = ['data-shortcut="quick-collect"', 'id="quickActionAddCustomer"', 'id="homeActionDuesList"', 'id="quickActionInstallationDashboard"'];
  const positions = markers.map((m) => region.indexOf(m));
  for (let i = 0; i < markers.length; i++) {
    assert.ok(positions[i] >= 0, `missing quick action ${markers[i]}`);
    if (i > 0) assert.ok(positions[i] > positions[i - 1], `quick action order changed at ${markers[i]}`);
  }
  assert.ok(!page.includes('id="quickActionReceivePayment"'), 'Receive Payment tile is gone');
  assert.ok(!page.includes('id="quickActionDailyClosing"'), 'Daily Closing tile is gone from Home (already in the More menu)');
});

test('home share menu unifies the three share buttons at the top of Home', () => {
  // This SUPERSEDES the standalone Morning Briefing buttons
  // restyle queue item (2-col tile grid) — one tap-to-expand menu
  // instead. The three buttons keep their ids and wiring.
  const menuStart = page.indexOf('id="homeShareMenu"');
  assert.ok(menuStart >= 0, 'share menu exists');
  assert.ok(menuStart > homeStart && menuStart < homeEnd, 'share menu sits on Home');
  const menu = page.slice(menuStart, menuStart + 2000);
  for (const id of ['copyMorningBriefingBtn', 'sendDailySummaryWhatsAppBtn', 'copyPartnerDigestBtn']) {
    assert.ok(menu.includes(`id="${id}"`), `share menu holds ${id}`);
    assert.equal(page.split(`id="${id}"`).length - 1, 1, `${id} appears exactly once`);
  }
  assert.ok(page.includes('data-i18n="dash_share_menu_title"'), 'share menu title is translated');
});

test('collect tab holds the recovery, dues and ledger sections', () => {
  for (const id of [
    'upcomingDuesSection', 'overdueListSection', 'methodStripSection',
    'mohallaBarsSection', 'collectorCardSection', 'noPaymentSection',
    'pendingClearanceSection', 'creditBalancesSection', 'refundsSection',
    'mohallaDashboardSection', 'worklistsSummaryCard', 'kpiCardAdvance'
  ]) {
    inside(`id="${id}"`, collectStart, collectEnd, id);
  }
  // Sections without their own id are pinned by heading id.
  inside('id="fieldDispatchHeading"', collectStart, collectEnd, 'field dispatch board');
  // The Top 3 preview links here, not to the old recovery hash.
  assert.ok(page.includes('href="#/transactions"'), 'Top 3 preview links to Collect');
  assert.ok(!page.includes('href="#/recovery"'), 'old recovery link is gone');
});

test('reports tab holds the thermometer, comparison, matrix and audits', () => {
  for (const id of [
    'newCustomersSection', 'monthCompareSection', 'printSummarySection',
    'collectionForecastSection', 'expansionEstimatorSection',
    'multiMonthMatrixSection', 'ownerKhataSummary', 'dashboardTargetChart',
    'auditsClearPill'
  ]) {
    inside(`id="${id}"`, reportsStart, page.length, id);
  }
  // Run D audit sections carry no section id — pinned by heading.
  for (const id of [
    'collectionVelocityHeading', 'fuelEfficiencyHeading', 'upsellHeading',
    'winbackHeading', 'loyaltyHeading', 'revenueLeakHeading', 'hwauditHeading'
  ]) {
    inside(`id="${id}"`, reportsStart, page.length, id);
  }
});

test('more tab holds the registries and operations tools', () => {
  for (const key of [
    'dash_card_splitter', 'dash_card_poncap', 'dash_card_stock',
    'dash_drum_card', 'dash_card_health', 'dash_card_tools',
    'dash_card_lineman', 'pwr_card_label', 'upt_fleet_title'
  ]) {
    inside(`data-i18n="${key}"`, moreStart, collectStart, key);
  }
  assert.ok(page.includes('id="mobileMoreDailyClosingBtn"'), 'Daily Closing tile lives in the More menu');
});

test('home is slim: no duplicate grid, no gauge, no full lists', () => {
  assert.ok(!page.includes('class="summary-grid"'), 'duplicate bottom KPI grid is gone');
  assert.ok(!page.includes('id="monthTargetSection"'), 'Monthly Collection vs Target gauge is gone');
  assert.ok(!page.includes('id="cashInHandSection"'), 'standalone Cash in Hand section is gone');
  assert.ok(!page.includes('id="dashboardPreviousCollection"'), 'live previous-collection card is gone (snapshot compare card owns it)');
  assert.ok(!page.includes('id="dashboardCustomerCount"'), 'total-profiles count card is gone');
  assert.ok(!page.includes('id="dashboardExcludedAmounts"'), 'raw unstyled exclusions paragraph is gone');
  // Full lists are not on Home any more.
  const home = page.slice(homeStart, homeEnd);
  for (const id of ['overdueListSection', 'methodStripSection', 'mohallaBarsSection', 'collectorCardSection']) {
    assert.ok(!home.includes(`id="${id}"`), `${id} is not on Home`);
  }
  // The Supabase banner is untouched — the app is offline-first by
  // the user's own decision, so the banner stays true as-is.
  assert.ok(page.includes('Stored on this device only'), 'offline banner is untouched');
});

test('moved ids appear exactly once; the two new ids are disclosed', () => {
  for (const id of ['dashboardActiveCustomers', 'cihCashTotal', 'kpiAdvanceHeld', 'upcomingDuesSection', 'mohallaDashboardSection', 'collectionForecastSection', 'ownerKhataSummary']) {
    assert.equal(page.split(`id="${id}"`).length - 1, 1, `${id} appears exactly once`);
  }
  // New element ids in this PR (fence disclosure): the share menu
  // and the audits-clear pill. No new store key, no new hex.
  assert.equal(page.split('id="homeShareMenu"').length - 1, 1, 'homeShareMenu appears exactly once');
  assert.equal(page.split('id="auditsClearPill"').length - 1, 1, 'auditsClearPill appears exactly once');
});

test('audits-clear pill: markup, toggle logic and i18n', () => {
  assert.ok(page.includes('<p id="auditsClearPill" class="audits-clear-pill" data-i18n="audits_clear_pill" hidden>'), 'pill markup is hidden by default');
  // The toggle waits for all five audit counts, then shows the
  // pill only when every count is zero and hides the five sections.
  for (const name of ['auditsUpsellCount', 'auditsWinbackCount', 'auditsLoyaltyCount', 'auditsRevleakCount', 'auditsHwauditCount']) {
    assert.ok(app.includes(name), `dashboard tracks ${name}`);
  }
  assert.ok(app.includes("auditsPillEl.hidden = !auditsAllClear"), 'pill visibility follows the all-clear sum');
  assert.ok(app.includes(".closest('section')"), 'audit sections hide as whole sections');
  assert.ok(dashboardCss.includes('.audits-clear-pill'), 'pill has its token-only rule');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(dashboardCss.slice(dashboardCss.indexOf('.audits-clear-pill'), dashboardCss.indexOf('.audits-clear-pill') + 300)), 'pill rule uses tokens, no hex');
  // i18n key exists in both languages, Urdu value carries Urdu script.
  assert.ok(navLang.includes("audits_clear_pill: '✅ All 5 Audits Clear'"), 'English pill label exists');
  assert.ok(navLang.includes("audits_clear_pill: '✅ تمام 5 آڈٹ صاف ہیں'"), 'Urdu pill label exists');
  assert.ok(navLang.includes("dash_recent_actions: 'Receipt actions'"), 'English recent-actions label exists');
  assert.ok(navLang.includes("dash_recent_actions: 'رسید کے اقدامات'"), 'Urdu recent-actions label exists');
});

test('zero-value sections hide instead of reading PKR 0', () => {
  // Method-strip zero hiding is pinned in plan474; here the two
  // empty zero-cards hide at the section level.
  assert.ok(pendingClearance.includes("if (sectionEl) sectionEl.hidden = (summary.count ?? 0) === 0;"), 'pending clearance hides at zero');
  assert.ok(refunds.includes("if (sectionEl) sectionEl.hidden = (summary.count ?? 0) === 0;"), 'refunds hide at zero');
});

test('glued text: the CSS separator puts a colon between label and value', () => {
  // The 36 <p><span>LABEL</span><strong>VALUE</strong> builders in
  // app.js are untouched — one CSS rule separates them everywhere
  // ("EasypaisaPKR 81,700" becomes "Easypaisa: PKR 81,700").
  assert.ok(dashboardCss.includes('.summary-card p:has(> strong) > span:first-child::after'), 'separator rule exists');
  assert.ok(dashboardCss.includes("content: ': ';"), 'separator is a colon plus space');
});

test('small fixes: help-info 28px, fuel month width, FAB safe area, header stack', () => {
  const helpBtn = componentsCss.slice(componentsCss.indexOf('.help-info-btn {'), componentsCss.indexOf('.help-info-btn {') + 900);
  assert.ok(helpBtn.includes('min-height: 28px'), 'help-info button escapes the 44px global floor');
  assert.ok(helpBtn.includes('width: 28px'), 'help-info button stays 28px wide');
  const fuel = dashboardCss.slice(dashboardCss.indexOf('.fuel-efficiency-month input {'), dashboardCss.indexOf('.fuel-efficiency-month input {') + 600);
  assert.ok(fuel.includes('width: 170px'), 'fuel month input fits "November 2026"');
  assert.ok(navCss.includes('env(safe-area-inset-bottom'), 'FAB clears the device safe area');
  assert.ok(navCss.includes('var(--bottom-nav-height, 60px)'), 'FAB sits above the bottom nav');
  assert.ok(componentsCss.includes('.collection-forecast-header { flex-direction: column;'), 'card header stacks title above amount on mobile');
});
