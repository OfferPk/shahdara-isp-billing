// tests/home-tab-polish.test.js — Home Tab M3 polish (user decision 2026-11-22).
// Analytics cards, Pending Works + System Health, Backup card, footer spacing.
// C checks assert the FIXED state; S checks are holds (PASS on base, must
// keep passing); B checks are budgets. No figure from the user's screenshots
// appears here: all fixtures are synthetic (counts, labels and channel names
// come from the code itself).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const read = (n) => readFileSync(join(root, n), 'utf8');
const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const indexHtml = read('index.html');
const stylesCss = read('styles.css');
const dashboardCss = read('dashboard.css');
const componentsCss = read('components.css');
const navCss = read('nav.css');
const darkCss = read('dark-contrast.css');
const tokensCss = read('tokens.css');
const chartsJs = read('dashboard-charts.js');
const widgetOrderJs = read('dashboard-widget-order.js');
const appJs = read('app.js');
const dashboardJs = read('dashboard.js');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const distinctHex = (s) => new Set(stripComments(s).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
const ruleBodies = (css, sel) => {
  const out = [];
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(css)) !== null) out.push(m[1]);
  return out;
};
const fnBody = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = endMarker ? src.indexOf(endMarker, a + 1) : src.length;
  return a === -1 ? '' : src.slice(a, b === -1 ? src.length : b);
};

// ---------- C1: the duplicate inner analytics heading is gone ----------
test('C1: no duplicate inner "Performance & Collection Analytics" h3 inside the charts region', () => {
  assert.ok(!indexHtml.includes('<h3 id="dashboardChartsHeading"'),
    'inner h3 still present (summary already carries the title)');
  assert.ok(indexHtml.includes('aria-labelledby="dashboardChartsTitle"'),
    'charts region must retarget its label at the summary span, not dangle');
  assert.ok(indexHtml.includes('id="dashboardChartsTitle"'),
    'summary span carries the retargeted id');
});

// ---------- C2: pill-tab scrollbar hidden ----------
test('C2: .dashboard-charts-tabs hides its scrollbar (both engines)', () => {
  const bodies = ruleBodies(dashboardCss, '.dashboard-charts-tabs');
  assert.ok(bodies.length > 0, 'tabs rule missing');
  assert.ok(bodies.some((b) => b.includes('scrollbar-width: none') || b.includes('scrollbar-width:none')),
    'tabs rule has no scrollbar-width: none');
  assert.ok(/\.dashboard-charts-tabs::-webkit-scrollbar\s*\{[^}]*display:\s*none/.test(dashboardCss),
    'no ::-webkit-scrollbar companion rule for the tabs');
});

// ---------- C3: phone chart headers keep the toggle inline ----------
test('C3: phone .chart-card-header-flex does NOT stack to a column', () => {
  const bodies = ruleBodies(componentsCss, '.chart-card-header-flex');
  assert.ok(bodies.length > 0, 'header-flex rule missing');
  assert.ok(bodies.every((b) => !/flex-direction:\s*column/.test(b)),
    'phone rule still stacks title above toggle (the vertical gap)');
});

// ---------- C4: top-bar + SVG stack vertically (wrapper column) ----------
test('C4: top-bar + SVG stack vertically in the chart container (wrapper column)', () => {
  // Prep-repro resolution (parent-verified): the prep's C4 expects a column
  // rule on .chart-svg-container (or a :has rule), but §4.8 fixes the clip
  // with a .chart-with-topbar wrapper div. Both halves are asserted here:
  // the wrapper is a column flex, the container gets a :has-scoped column
  // rule for these two cards, and both renderers return the wrapper — the
  // top bar genuinely sits ABOVE its SVG at full width.
  const css = `${dashboardCss}\n${stylesCss}`;
  assert.ok(/\.chart-with-topbar\s*\{[^}]*flex-direction:\s*column/.test(css),
    'wrapper is not a column flex');
  assert.ok(/\.chart-svg-container:has\(\.chart-with-topbar\)[^{]*\{[^}]*flex-direction:\s*column/.test(css),
    'no :has-scoped column rule for the wrapper cards');
  for (const fn of ['renderDelinquencyPipelineSvg', 'renderFiberDistributionSvg']) {
    const body = fnBody(chartsJs, `export function ${fn}`, 'export function ');
    assert.ok(body.includes('chart-with-topbar'), `${fn} does not return the wrapper`);
  }
});

// ---------- C5/C6: delinquency + fiber top bars become 3-cell metric strips ----------
test('C5: delinquency top bar is a 3-cell .chart-metric-strip', () => {
  const body = fnBody(chartsJs, 'export function renderDelinquencyPipelineSvg', 'export function renderCpeAssetLifecycleSvg');
  assert.ok(body.includes('chart-metric-strip'), 'delinquency renderer has no metric strip');
  assert.equal((body.match(/chart-metric-cell/g) || []).length, 3, 'delinquency strip must have exactly 3 cells');
});

test('C6: fiber top bar is a 3-cell .chart-metric-strip', () => {
  const body = fnBody(chartsJs, 'export function renderFiberDistributionSvg', 'export function generateMarginSimulationReportText');
  assert.ok(body.includes('chart-metric-strip'), 'fiber renderer has no metric strip');
  assert.equal((body.match(/chart-metric-cell/g) || []).length, 3, 'fiber strip must have exactly 3 cells');
});

// ---------- C7: the 3 delinquency buttons ride one scrollable row ----------
test('C7: Recovery Pipeline / Dues Aging / Top Defaulters share one no-scrollbar scroll row', () => {
  const at = indexHtml.indexOf('dashboardOpenDelinquencyModalBtn');
  assert.ok(at > 0, 'delinquency button missing');
  const before = indexHtml.slice(Math.max(0, at - 400), at);
  assert.ok(before.includes('class="chart-actions-scroll"'),
    'buttons still sit in a plain wrapping div (they spill onto 2 rows at 360px)');
  assert.ok(!before.includes('margin-left: 8px'), 'inline margin-left styles still space the buttons (the row gap owns spacing now)');
});

// ---------- C8: acquisition channel labels cannot clip (HTML rows) ----------
test('C8: longest acquisition channel label fits — the ROI chart is HTML rows, not SVG', () => {
  // Rebase-only rewrite (ROI #1603 overlap, same pattern as N's C2/C3/S4
  // and P/Q/R's S7): S was authored against the SVG ROI chart, where the
  // channel label was end-anchored at labelX — but ROI #1603 converted
  // the chart to wrapping HTML rows AFTER S was written, so there is no
  // labelX left to pin. The intent survives in the new reality: HTML
  // rows wrap on their own line and read at full size, so no label can
  // clip off-viewBox. Assert the HTML-rows shape instead.
  const body = fnBody(chartsJs, 'export function renderAcquisitionRoiSvg', 'export function renderBandwidthShapingSvg');
  assert.ok(body.includes('acquisition-roi-rows'), 'ROI renderer no longer returns the HTML rows');
  assert.ok(!/const labelX/.test(body), 'stale SVG label geometry survives in the ROI renderer');
  assert.ok(!body.includes('viewBox'), 'ROI renderer still builds an SVG viewBox');
});

// ---------- C9: Pending Works is one grouped list row ----------
test('C9: Pending Works renders as a single tappable list row (no title-in-button duplicate)', () => {
  // Prep-repro correction (parent-verified): the prep's C9 asserted the
  // section contains NO openPendingWorksModalBtn id — but §4.5 makes the
  // row ITSELF that button and S2 requires the id kept (pending-works.js
  // binds by it), so the prep's C9 cannot pass as written. The real
  // intent is one row with no separate title element duplicating the
  // button label — asserted here instead.
  const at = indexHtml.indexOf('id="pendingWorksSection"');
  assert.ok(at > 0, 'pendingWorksSection missing');
  const card = indexHtml.slice(at, at + 2000);
  assert.ok(card.includes('<button id="openPendingWorksModalBtn"'),
    'the row itself is the Pending Works button');
  assert.ok(card.includes('›'), 'row has no right chevron');
  assert.equal((card.match(/data-i18n="dash_card_pending"/g) || []).length, 1,
    'the Pending Works label appears exactly once in the row (no title-in-button duplicate)');
  assert.ok(!card.includes('summary-value'),
    'no big metric value — the subtitle is the live value text only (parent Q1)');
  assert.ok(!card.includes('ops-card'),
    'the row left the ops-card set (re-pins more-tab-saad-visit-wallet-inbox-polish)');
});

// ---------- C10: System Health + backup card live in More, not Home ----------
test('C10: systemHealthSection and dataSafetyBanner sit inside the More menu', () => {
  const menuAt = indexHtml.indexOf('id="mobileMoreMenu"');
  assert.ok(menuAt > 0, 'mobileMoreMenu missing');
  assert.ok(indexHtml.indexOf('id="systemHealthSection"') > menuAt,
    'System Health card is still on Home');
  assert.ok(indexHtml.indexOf('id="dataSafetyBanner"') > menuAt,
    'backup card is still on Home');
});

// ---------- C11: critical-only slim dismissible chip on Home ----------
test('C11: a critical-only backup chip exists on Home with a session dismiss key', () => {
  assert.ok(indexHtml.includes('homeBackupCriticalChip'), 'no backup chip mount on Home');
  assert.ok(appJs.includes('shahdara_backup_chip_dismissed'),
    'no sessionStorage dismiss key for the chip (nav.js offline-banner precedent)');
  assert.ok(appJs.includes('renderHomeBackupCriticalChip'),
    'no chip renderer wired into updateDataSafetyUi');
});

// ---------- C12: backup (i) is 28px via a NAMED scoped exception ----------
test('C12: backup (i) is exactly 28px via a named .data-safety-banner scope', () => {
  const base = /\.help-icon\{([^}]*)\}/.exec(stripComments(stylesCss))?.[1];
  assert.ok(base && base.includes('width:40px'), 'base .help-icon must stay 40px');
  const scoped = /\.data-safety-banner\s+\.help-icon\s*\{([^}]*)\}/.exec(stripComments(stylesCss))?.[1]
    || /\.data-loss-warning\s+\.help-icon\s*\{([^}]*)\}/.exec(stripComments(stylesCss))?.[1];
  assert.ok(scoped, 'no named 28px scope for the backup (i)');
  const sizes = [...scoped.matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 0 && sizes.every((v) => v === 28), `scoped backup (i) must be exactly 28px, got ${sizes}`);
});

// ---------- C13: Home footer gap — main 74px bottom padding dropped on Home ----------
test('C13: home screen drops main’s 74px bottom padding (customers precedent shape)', () => {
  assert.ok(stylesCss.includes('body[data-screen="home"] main { padding-bottom: 0; }'),
    'no home-scoped main padding override (74px + banner margin + footer padding = the empty gap)');
});

// ---------- C14/C15: SVG axis/legend fonts legible ----------
test('C14: seasonal axis/legend/peak text is >= 11 units', () => {
  const body = fnBody(chartsJs, 'export function renderSeasonalCashflowSvg', 'export function calculatePackageMarginBreakdown');
  const sizes = [...body.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 0, 'no font sizes found in seasonal renderer');
  assert.ok(Math.min(...sizes) >= 11, `seasonal still has ${Math.min(...sizes)}-unit text`);
});

test('C15: margin axis/legend/footer text is >= 11 units', () => {
  const body = fnBody(chartsJs, 'export function renderPackageMarginSvg', 'export function renderCustomerLtvCohortsSvg');
  const sizes = [...body.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 0, 'no font sizes found in margin renderer');
  assert.ok(Math.min(...sizes) >= 11, `margin still has ${Math.min(...sizes)}-unit text`);
});

// ---------- C16/C17: SVG-internal footers move to wrapping HTML ----------
test('C16: delinquency pacing/sector footer leaves the SVG for wrapping HTML', () => {
  const body = fnBody(chartsJs, 'export function renderDelinquencyPipelineSvg', 'export function renderCpeAssetLifecycleSvg');
  assert.ok(!body.includes('Highest Dues Sector') || !body.includes('translate(${width / 2}, ${height - 10})'),
    'pacing/sector footer is still a single centred SVG line (clips on long area names)');
});

test('C17: fiber legend leaves the SVG for wrapping HTML', () => {
  const body = fnBody(chartsJs, 'export function renderFiberDistributionSvg', 'export function generateMarginSimulationReportText');
  assert.ok(!body.includes('Dark Headroom (Spare)') || !body.includes('translate(${width / 2}, ${height - 10})'),
    'fiber legend is still a single centred SVG line');
});

// ---------- S holds ----------
test('S1: chart tab map intact (Revenue 7 / Customers 5 / Network 7 / Forecast 2)', () => {
  const m = /revenue: \[([^\]]*)\],\s*customers: \[([^\]]*)\],\s*network: \[([^\]]*)\],\s*forecast: \[([^\]]*)\]/.exec(chartsJs);
  assert.ok(m, 'DASHBOARD_CHARTS_TABS map missing');
  assert.deepEqual([1, 2, 3, 4].map((i) => m[i].split(',').length), [7, 5, 7, 2]);
});

test('S2: modal wiring ids kept (Pending / Health / Delinquency / Aging / Defaulters)', () => {
  for (const id of ['openPendingWorksModalBtn', 'openSystemHealthModalBtn', 'dashboardOpenDelinquencyModalBtn', 'dashboardOpenDuesAgingBtn', 'dashboardOpenTopDefaultersBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `${id} missing from index.html`);
  }
});

test('S3: live value updaters kept (Pending + Health value/period)', () => {
  for (const id of ['dashboardPendingWorksValue', 'dashboardPendingWorksPeriod', 'dashboardSystemHealthValue', 'dashboardSystemHealthPeriod']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `${id} missing from index.html`);
  }
  assert.ok(appJs.includes("$('#dashboardSystemHealthValue')"), 'health value updater gone from app.js');
  assert.ok(appJs.includes("$('#dashboardPendingWorksValue')"), 'pending value updater gone from app.js');
});

test('S4: Pending Works stays in the widget-order list AND the reorder survives the move', () => {
  // The prep repro's S4 only asserted Pending stays listed — it does NOT
  // cover the reorder trap, which is the single most bug-prone line in
  // this item: applyDashboardWidgetOrder re-inserts each section with
  // db.insertBefore(el, aside), and that THROWS (NotFoundError) once the
  // aside is no longer a child of #billingDashboard. Asserted here: the
  // health entry is out of the list, the anchor is guarded, and the aside
  // lives in the menu.
  assert.ok(widgetOrderJs.includes("id: 'pendingWorksSection'"), 'pendingWorksSection dropped from the order list');
  assert.ok(!widgetOrderJs.includes("id: 'systemHealthSection'"), 'systemHealthSection still in the order list (it left the dashboard)');
  assert.ok(appJs.includes('aside.parentNode === db'), 'reorder anchor is not guarded — insertBefore throws once the aside moves to the menu');
  const menuAt = indexHtml.indexOf('id="mobileMoreMenu"');
  assert.ok(indexHtml.indexOf('id="dataSafetyBanner"') > menuAt, 'aside is not inside the More menu');
});

test('S5: Monthly Provider Cost Breakdown accordion untouched', () => {
  assert.ok(indexHtml.includes('id="homeProviderCostDetails"'), 'provider cost details gone');
  assert.ok(indexHtml.includes('data-i18n="dash_prov_heading"'), 'provider cost heading gone');
});

test('S6: chart data functions still exported (layout only, no data change)', () => {
  // The calculators live across two modules: seasonal + margin in
  // dashboard-charts.js, acquisition + fiber + delinquency in dashboard.js.
  for (const fn of ['calculateDelinquencyRecoveryPipeline', 'calculateFiberDistributionMetrics', 'calculateAcquisitionRoiMetrics', 'calculateSeasonalCashflowComparison', 'calculatePackageMarginBreakdown']) {
    assert.ok(chartsJs.includes(`export function ${fn}`) || dashboardJs.includes(`export function ${fn}`), `${fn} missing`);
  }
});

// ---------- B budgets ----------
// Re-pinned at rebase (2026-11-23): the ratchets moved with the
// intervening items — styles 608 -> 610 (Customers List Cards name
// colour), tokens 117 -> 121, dashboard 85 -> 84 — while S itself adds
// zero hex (verified: no hex literal in S's CSS diff). The intent is
// unchanged: the polish must be token-only.
test('B1: hex ratchets unchanged (styles 610 / nav 163 / dark 19 / comp 0 / tokens 121 / dashboard 84)', () => {
  assert.deepEqual(
    { styles: distinctHex(stylesCss), nav: distinctHex(navCss), dark: distinctHex(darkCss), comp: distinctHex(componentsCss), tokens: distinctHex(tokensCss), dashboard: distinctHex(dashboardCss) },
    { styles: 610, nav: 163, dark: 19, comp: 0, tokens: 121, dashboard: 84 },
    'a hex ratchet moved — the polish must be token-only');
});

test('B2: APP_VERSION frozen (footer still shows the frozen version)', () => {
  assert.ok(appJs.includes('1.11.0'), 'version string gone from app.js');
  assert.ok(indexHtml.includes('Version 1.11.0'), 'footer version label gone');
});

test('B3: this test file carries no parity-total literal', () => {
  // Re-pinned at rebase (2026-11-23): parity 5,222 -> 5,234 with the
  // intervening items (L +2 keys, M +3 keys); S adds no keys. The guard
  // tracks the current total and the previous one, in split form.
  // Re-pin (Recovery Pipeline redesign 2026-11-24): parity 5,234 → 5,235 — the item adds exactly one i18n key, dash_pending_manual_empty, EN + UR.
  assert.ok(!selfSrc.includes('52' + '35'), 'test file contains the current parity total as a bare literal');
  assert.ok(!selfSrc.includes('52' + '34'), 'test file contains the previous parity total as a bare literal');
});
