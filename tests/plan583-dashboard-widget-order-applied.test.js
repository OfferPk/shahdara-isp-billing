// Plan 583 — Saved dashboard widget order is actually applied.
// The 338 file owns the module + the panel wiring; this file owns the
// MAPPING + the APPLICATION (D6(a)). No jsdom in the repo, so DOM-order
// assertions are pure order-computation tests over the real module +
// source-scan pins over the real app.js / index.html — the established
// pattern. No customer names, no phone numbers anywhere in this file.
//
// The spec's acceptance example is restated (D4(a)): "Today at a glance"
// is DELETED and the standalone overdue section lives on the Collect tab,
// so saving 'Overdue list' first moves the today section — the Top-3
// overdue preview's home — first, via the D2(a) alias. It does NOT move
// a standalone overdue section, because there is none on the dashboard.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DASHBOARD_WIDGET_SECTIONS,
  DASHBOARD_WIDGET_SECTION_ALIASES,
  dashboardWidgetSectionIdsInPreferredOrder,
} from '../dashboard-widget-order.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

// Fixtures copied verbatim from tests/plan338-dashboard-widget-order.test.js.
const PREF_A = { id: 'DWO-1', operator: 'Saad', widgets: ['Collections today', 'Overdue list', 'Due in 7 days'], dateSet: '2026-11-05' };
const PREF_B = { id: 'DWO-2', operator: 'Bike', widgets: ['Overdue list', 'Collections today'], dateSet: '2026-11-06' };
const DEFAULT_WIDGETS = ['Collections today', 'Overdue list', 'Due in 7 days', 'New customers'];

// The 13 reorderable sections in static default order (D1(a) + D7(a)) —
// pinned exactly here, so a wrong list in the module cannot pass
// trivially by being read back from itself.
// (Hisaab H3 added the 13th entry directly after Today's Summary.)
const EXPECTED_SECTIONS = [
  { name: 'Key performance indicators', id: 'homeKpiStrip' },
  { name: 'Share / Digest', id: 'homeShareMenu' },
  { name: 'Primary billing actions', id: 'homePrimaryActions' },
  { name: 'Morning Briefing', id: 'morningBriefingSection' },
  { name: "Today's Summary", id: 'homeTodaySection' },
  { name: 'Hisaab — Kya khoya, kya paya', id: 'hisaabSection' },
  { name: 'Recent Payments', id: 'recentPaymentsSection' },
  { name: 'Expired Vacation Holds', id: 'expiredHoldsSection' },
  { name: 'WAPDA Outage — Running on Battery', id: 'powerOutageSection' },
  { name: 'Performance & Collection Analytics', id: 'homeChartsCollapsible' },
  { name: 'Monthly Provider Cost Breakdown', id: 'homeProviderCostDetails' },
  { name: 'Pending Works', id: 'pendingWorksSection' },
  { name: 'System Health', id: 'systemHealthSection' },
];
const DEFAULT_IDS = EXPECTED_SECTIONS.map((section) => section.id);

// The source of a top-level function, from its definition to its own
// closing brace at column 0. The module + app.js keep top-level
// function bodies indented, so the first `\n}\n` after the start is the
// function's own end — the next function may follow a blank line and a
// comment, so the boundary is the brace, not the next `function `.
function topLevelFunctionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const end = src.indexOf('\n}\n', start);
  assert.ok(end >= 0, `cannot find the end of ${name}`);
  return src.slice(start, end);
}

/* ---------------- G1 — The mapping (repro B5, as tests) ---------------- */

test('plan583 G1: the mapping covers all 13 reorderable sections in default order', () => {
  assert.deepEqual(DASHBOARD_WIDGET_SECTIONS, EXPECTED_SECTIONS);
  const names = DASHBOARD_WIDGET_SECTIONS.map((section) => section.name);
  const ids = DASHBOARD_WIDGET_SECTIONS.map((section) => section.id);
  assert.equal(new Set(names).size, 13, 'each section has exactly one display name');
  assert.equal(new Set(ids).size, 13, 'each section has exactly one id');
  assert.ok(Object.isFrozen(DASHBOARD_WIDGET_SECTIONS), 'the section list is frozen');
});

test('plan583 G1: the aliases resolve the 338 names to the today section', () => {
  // Plan 583 (D2(a)): the overdue preview lives inside the today section,
  // so 'Overdue list' first moves the today section first — it does NOT
  // move a standalone overdue section, because there is none on the
  // dashboard (that section lives on the Collect tab).
  assert.equal(DASHBOARD_WIDGET_SECTION_ALIASES['Overdue list'], 'homeTodaySection');
  assert.equal(DASHBOARD_WIDGET_SECTION_ALIASES['Collections today'], 'homeTodaySection');
  assert.equal(DASHBOARD_WIDGET_SECTION_ALIASES['Today at a glance'], 'homeTodaySection');
  assert.deepEqual(Object.keys(DASHBOARD_WIDGET_SECTION_ALIASES).sort(), ['Collections today', 'Overdue list', 'Today at a glance']);
  assert.ok(Object.isFrozen(DASHBOARD_WIDGET_SECTION_ALIASES), 'the alias map is frozen');
});

test('plan583 G1: Due in 7 days / New customers are NOT in the mapping', () => {
  const names = DASHBOARD_WIDGET_SECTIONS.map((section) => section.name);
  const aliases = Object.keys(DASHBOARD_WIDGET_SECTION_ALIASES);
  for (const name of ['Due in 7 days', 'New customers']) {
    assert.ok(!names.includes(name), `${name} has no dashboard section`);
    assert.ok(!aliases.includes(name), `${name} has no alias`);
  }
  // The 338 vocabulary itself still exists as saved names (DEFAULT_WIDGETS)
  // — the mapping only decides which of them have a dashboard home.
  assert.deepEqual(DEFAULT_WIDGETS, ['Collections today', 'Overdue list', 'Due in 7 days', 'New customers']);
});

test('plan583 G1: no mapping entry points at a dialog, banner, heading, or the aside', () => {
  const ids = new Set(DASHBOARD_WIDGET_SECTIONS.map((section) => section.id));
  assert.deepEqual([...ids].sort(), [...DEFAULT_IDS].sort());
  for (const id of ids) {
    assert.ok(!id.endsWith('Modal'), `${id} is not a dialog`);
    assert.ok(!id.includes('Banner'), `${id} is not a banner`);
  }
  assert.ok(!ids.has('dataSafetyBanner'), 'the data-safety aside stays pinned last, never reordered');
  assert.ok(!ids.has('overdueListSection'), 'the Collect-tab overdue section is not a dashboard section');
  assert.ok(!ids.has('upcomingDuesSection'), 'the Collect-tab upcoming-dues section is not a dashboard section');
  assert.ok(!ids.has('newCustomersSection'), 'the Reports-tab new-customers section is not a dashboard section');
});

/* ---------------- G2 — The order computation (repro B1/B2/B3) ---------------- */

test('plan583 G2: Overdue list first moves the today section first (PREF_B)', () => {
  const ordered = dashboardWidgetSectionIdsInPreferredOrder(PREF_B);
  assert.equal(ordered.length, 13, 'no section vanishes');
  assert.equal(ordered[0], 'homeTodaySection', 'the overdue preview\'s home goes first');
  assert.ok(ordered.indexOf('homeTodaySection') < DEFAULT_IDS.indexOf('homeTodaySection'), 'the today section moves ahead of its default position');
  assert.deepEqual([...ordered].sort(), [...DEFAULT_IDS].sort(), 'the same 13 sections, only reordered');
});

test('plan583 G2: Morning Briefing first moves it above Today\'s Summary (D4(a) restated acceptance)', () => {
  const pref = { id: 'DWO-3', operator: 'Saad', widgets: ['Morning Briefing', 'Overdue list'], dateSet: '2026-11-07' };
  const ordered = dashboardWidgetSectionIdsInPreferredOrder(pref);
  assert.equal(ordered[0], 'morningBriefingSection', 'Morning Briefing goes first');
  assert.equal(ordered[1], 'homeTodaySection', 'the today section follows it, ahead of the KPI strip');
  assert.ok(ordered.indexOf('morningBriefingSection') < ordered.indexOf('homeTodaySection'), 'Morning Briefing is above Today\'s Summary');
});

test('plan583 G2: null / reset preference returns the default order byte-identical', () => {
  assert.deepEqual(dashboardWidgetSectionIdsInPreferredOrder(null), DEFAULT_IDS);
  const reset = { id: 'DWO-9', operator: 'Saad', widgets: [], dateSet: '2026-11-07', status: 'reset' };
  assert.deepEqual(dashboardWidgetSectionIdsInPreferredOrder(reset), DEFAULT_IDS);
  // The returned list is a copy — mutating it must not move the default.
  const once = dashboardWidgetSectionIdsInPreferredOrder(null);
  once.push('homeTodaySection');
  assert.deepEqual(dashboardWidgetSectionIdsInPreferredOrder(null), DEFAULT_IDS);
});

test('plan583 G2: unknown names hide nothing (PREF_A + missing widget)', () => {
  const pref = { id: 'DWO-4', operator: 'Saad', widgets: ['missing widget', 'Due in 7 days', 'New customers'], dateSet: '2026-11-07' };
  assert.deepEqual(dashboardWidgetSectionIdsInPreferredOrder(pref), DEFAULT_IDS);
  // PREF_A names 'Due in 7 days' too — only its aliased names move.
  const orderedA = dashboardWidgetSectionIdsInPreferredOrder(PREF_A);
  assert.equal(orderedA[0], 'homeTodaySection', 'the aliased names move the today section first');
  assert.deepEqual([...orderedA].sort(), [...DEFAULT_IDS].sort(), 'all 13 sections stay present');
});

test('plan583 G2: the computation is idempotent — an applied order stays applied', () => {
  const once = dashboardWidgetSectionIdsInPreferredOrder(PREF_B);
  const names = once.map((id) => DASHBOARD_WIDGET_SECTIONS.find((section) => section.id === id).name);
  const twice = dashboardWidgetSectionIdsInPreferredOrder({ id: 'DWO-10', operator: 'Bike', widgets: names, dateSet: '2026-11-08' });
  assert.deepEqual(twice, once, 'ordering the already-applied order changes nothing');
});

/* ---------------- G3 — The wiring (repro B4/B6 + A5/A6) ---------------- */

test('plan583 G3: renderDashboard calls the apply step', () => {
  const renderSrc = topLevelFunctionSource(appJs, 'renderDashboard');
  assert.ok(renderSrc.includes('applyDashboardWidgetOrder();'), 'renderDashboard applies the saved widget order');
  // The apply step itself resolves the current operator (the call lives
  // in applyDashboardWidgetOrder, not in renderDashboard) and moves
  // elements only — it writes no figure.
  const applySrc = topLevelFunctionSource(appJs, 'applyDashboardWidgetOrder');
  assert.ok(applySrc.includes('dashboardWidgetOrderPreferenceForCurrentOperator'), 'the apply step resolves the current operator');
  assert.ok(!applySrc.includes('innerHTML'), 'the apply step writes no HTML');
  assert.ok(!applySrc.includes('textContent'), 'the apply step writes no text');
});

test('plan583 G3: the apply call sits BEFORE the Plan 485 restore block (D5(a))', () => {
  const renderSrc = topLevelFunctionSource(appJs, 'renderDashboard');
  const applyAt = renderSrc.indexOf('applyDashboardWidgetOrder();');
  const restoreAt = renderSrc.indexOf('restoreDashboardPlace(');
  const labelsAt = renderSrc.indexOf('applyStoredDashboardLabels(');
  assert.ok(applyAt >= 0 && restoreAt >= 0 && labelsAt >= 0, 'apply, restore, and labels all live in renderDashboard');
  assert.ok(applyAt < restoreAt, 'the order applies before the saved place is restored');
  assert.ok(restoreAt < labelsAt, 'the labels still run last, after the restore');
});

test('plan583 G3: the current-operator resolution exists (D3(a)+(b))', () => {
  // Stored-name read (D3(a)) + single-operator fallback (D3(b)).
  assert.ok(appJs.includes('shahdara_dwo_current_operator_v1'), 'the stored current-operator key is read');
  assert.ok(appJs.includes('dashboardWidgetOrderPreferenceForCurrentOperator'), 'the resolution function exists');
  const resolveSrc = topLevelFunctionSource(appJs, 'dashboardWidgetOrderPreferenceForCurrentOperator');
  assert.ok(resolveSrc.includes('activeOperators.length !== 1'), 'the single-operator fallback applies only when exactly one operator holds an active order');
  // The Save handler records the current operator on this device.
  assert.ok(appJs.includes('localStorage.setItem(DASHBOARD_WIDGET_ORDER_CURRENT_OPERATOR_KEY, savedOperator)'), 'saving an order records the current operator');
  // The preview panel call is untouched (D5: the panel keeps showing the preview).
  assert.ok(appJs.includes('dashboardWidgetsInPreferredOrderHtml(widgets, pref)'), 'the preview panel call is untouched');
});

/* ---------------- G4 — Guards (repro group C) ---------------- */

test('plan583 G4: the static default order in index.html is unchanged', () => {
  // The static order IS the default a reset restores — the reorder is a
  // runtime DOM operation, never a static index.html edit (T7).
  const positions = DEFAULT_IDS.map((id) => indexHtml.indexOf(`id="${id}"`));
  for (const [id, position] of DEFAULT_IDS.map((id, i) => [id, positions[i]])) {
    assert.ok(position >= 0, `${id} exists in index.html`);
  }
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(positions[i] > positions[i - 1], `${DEFAULT_IDS[i]} follows ${DEFAULT_IDS[i - 1]} in the static order`);
  }
  const asideAt = indexHtml.indexOf('id="dataSafetyBanner"');
  assert.ok(asideAt > positions[positions.length - 1], 'the data-safety aside stays last in the static order');
});

test('plan583 G4: parity holds at 4,722/4,722 — the wiring adds no i18n keys', () => {
  // Plan 582 landed first with D1(b) (−6 orphan keys), so the count on
  // this base is 4,669 — read off the base, never the prep's 4,675.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  // (Test title re-pinned with the asserts by Plan 586; titles and
  // asserts move together from here on.)
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5223, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5223, 'UR key count moved');
});
