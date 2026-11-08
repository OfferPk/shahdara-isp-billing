// Polish #18 (Phase 1 only) — Installation dashboard at the top:
// a 5th home tile opens the Analytics installation panel in one tap,
// and the panel gains a join-month breakdown of installation money
// taken. No fee-payment recording: the dashboard shows recorded fees
// only — never a payment date, never qist/full (the user declined
// Phase 2 on 2026-11-08). Generic fixtures only — never real customer
// names or amounts from the user's own data (the polish #5 rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as installationDashboard from '../installation-dashboard.js';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS } = await import('../nav-language.js');
const { setupDashboardQuickActions } = await import('../dashboard.js');

const {
  installationFeeHtml,
  installationFeeTotals,
  installationFeeRows,
  installationFeeMonthlyHtml,
} = installationDashboard;

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const dashboardJs = readFileSync(join(dir, '..', 'dashboard.js'), 'utf8');
const dashboardCss = readFileSync(join(dir, '..', 'dashboard.css'), 'utf8');
const navSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'installation-dashboard.js'), 'utf8');

const URDU = /[\u0600-\u06FF]/;

// Generic fixtures only — never real customer names or amounts
// from the user's own data (the polish #5 rule).
const CUSTOMERS = [
  { id: 'CUST-1', name: 'Customer One', connectionFee: 20000 },
  { id: 'CUST-2', name: 'Customer Two', connectionFee: 15000 },
  { id: 'CUST-3', name: 'Customer Three', connectionFee: 10000 },
];

const MONTHLY = {
  heading: 'Installation fees by join month',
  rows: [
    { label: 'November 2026', count: 2, totalFees: 35000 },
    { label: 'October 2026', count: 1, totalFees: 15000 },
  ],
  undatedCount: 0,
  undatedNote: '',
};

const MONTHLY_UNDATED = {
  heading: 'Installation fees by join month',
  rows: [{ label: 'November 2026', count: 1, totalFees: 20000 }],
  undatedCount: 2,
  undatedNote: '2 customers have no join date and are not counted in any month.',
};

test('monthly: the month-breakdown export exists', () => {
  assert.equal(typeof installationFeeMonthlyHtml, 'function', 'installationFeeMonthlyHtml must be exported');
});

test('monthly: no monthly data renders no month section (backwards compatible)', () => {
  const rows = installationFeeRows(CUSTOMERS);
  const totals = installationFeeTotals(rows);
  assert.ok(!installationFeeHtml(totals, rows).includes('join month'), 'two-arg call has no month section');
  assert.ok(!installationFeeHtml(totals, rows, null).includes('join month'), 'null monthly has no month section');
  assert.ok(!installationFeeHtml(totals, rows, { heading: 'Installation fees by join month', rows: [], undatedCount: 0 }).includes('join month'), 'empty rows have no month section');
});

test('monthly: one row per join month, newest first, with count and fee total', () => {
  const html = installationFeeMonthlyHtml(MONTHLY);
  assert.ok(html.includes('Installation fees by join month'), 'heading present');
  assert.ok(html.indexOf('November 2026') < html.indexOf('October 2026'), 'newest month first');
  assert.ok(html.includes('2 customers'), 'November customer count present');
  assert.ok(html.includes('Rs 35,000'), 'November fee total present');
  assert.ok(html.includes('1 customers'), 'October customer count present');
  assert.ok(html.includes('Rs 15,000'), 'October fee total present');
  const rows = installationFeeRows(CUSTOMERS);
  const full = installationFeeHtml(installationFeeTotals(rows), rows, MONTHLY);
  assert.ok(full.includes('Installation fees by join month'), 'month section rides in the dashboard html');
  assert.ok(full.indexOf('Customers by installation fee') < full.indexOf('Installation fees by join month'), 'month section follows the per-customer list');
});

test('monthly: undated customers are noted, never forced into a month', () => {
  const html = installationFeeMonthlyHtml(MONTHLY_UNDATED);
  assert.ok(html.includes('2 customers have no join date'), 'undated note present');
  assert.ok(!html.includes('Undated —'), 'no invented undated month row');
});

test('monthly: month labels are escaped', () => {
  const html = installationFeeMonthlyHtml({
    heading: 'Installation fees by join month',
    rows: [{ label: '<b>November</b>', count: 1, totalFees: 5000 }],
    undatedCount: 0,
  });
  assert.ok(html.includes('&lt;b&gt;November&lt;/b&gt;'), 'label escaped');
  assert.ok(!html.includes('<b>November</b>'), 'raw label absent');
});

test('monthly: the section never presents a payment date', () => {
  // Phase 1 honesty rule: months are JOIN months, never payment
  // months — the module must not invent "Paid on", a payment date,
  // or a qist/full split (the user declined Phase 2).
  const html = installationFeeMonthlyHtml(MONTHLY);
  assert.ok(!/paid on/i.test(html), 'no "Paid on" in the month section');
  assert.ok(!/payment date/i.test(html), 'no payment date in the month section');
  assert.ok(!/qist/i.test(html), 'no qist in the month section');
  assert.ok(!/paid on/i.test(moduleSrc), 'module source never says "Paid on"');
  assert.ok(!/qist/i.test(moduleSrc), 'module source never mentions qist');
});

test('monthly: money is PKR only, never another currency', () => {
  const html = installationFeeMonthlyHtml(MONTHLY);
  assert.ok(html.includes('Rs 35,000'), 'PKR total present');
  assert.ok(!html.includes('$'), 'no dollar sign');
  assert.ok(!html.includes('USD'), 'no USD code');
  assert.ok(!html.includes('EUR'), 'no EUR code');
});

test('tile: the 5th tile lives inside #homePrimaryActions with the other four', () => {
  const region = indexHtml.slice(
    indexHtml.indexOf('id="homePrimaryActions"'),
    indexHtml.indexOf('id="homePrimaryActions"') + 6000,
  );
  for (const id of ['quickActionReceivePayment', 'quickActionAddCustomer', 'homeActionDuesList', 'quickActionDailyClosing', 'quickActionInstallationDashboard']) {
    assert.ok(region.includes(`id="${id}"`), `${id} must sit in the home primary actions region`);
  }
  const tile = region.slice(region.indexOf('id="quickActionInstallationDashboard"'), region.indexOf('id="quickActionInstallationDashboard"') + 1200);
  assert.ok(tile.includes('home-primary-btn quick-action-tile'), 'tile uses the shared tile classes');
  assert.ok(tile.includes('data-i18n="dash_tile_installation_title"'), 'tile title is i18n');
  assert.ok(tile.includes('data-i18n="dash_tile_installation_sub"'), 'tile subtitle is i18n');
  assert.ok(tile.includes('data-i18n-aria-label="dash_tile_installation_aria"'), 'tile aria label is i18n');
  assert.ok(tile.includes('>Installation<'), 'tile title reads Installation');
  assert.ok(tile.includes('>Fees collected &amp; pending<') || tile.includes('>Fees collected & pending<'), 'tile subtitle reads Fees collected & pending');
});

test('tile: the tile id appears exactly once in index.html', () => {
  assert.equal(indexHtml.split('quickActionInstallationDashboard').length - 1, 1, 'tile id must appear exactly once');
});

test('tile: dashboard.js wires the tile to onInstallationDashboard', () => {
  assert.ok(dashboardJs.includes("wire('quickActionInstallationDashboard', onInstallationDashboard)"), 'tile wired to its callback');
  // The callback is the last destructured option, so it carries no
  // trailing comma — match the option block, not a comma suffix.
  assert.ok(/export function setupDashboardQuickActions\(\{[^}]*onInstallationDashboard/s.test(dashboardJs), 'callback is a setupDashboardQuickActions option');
});

test('tile: the wiring calls the callback when the tile is tapped', () => {
  const mockElements = new Map();
  const listeners = new Map();
  const fakeDoc = {
    getElementById(id) {
      if (!mockElements.has(id)) {
        mockElements.set(id, {
          id,
          dataset: {},
          addEventListener(event, fn) { listeners.set(`${id}:${event}`, fn); },
        });
      }
      return mockElements.get(id);
    },
  };
  const originalDoc = globalThis.document;
  globalThis.document = fakeDoc;
  try {
    let called = false;
    setupDashboardQuickActions({ onInstallationDashboard: () => { called = true; } });
    listeners.get('quickActionInstallationDashboard:click')();
    assert.ok(called, 'tapping the tile calls onInstallationDashboard');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('tile: app.js opens Analytics and scrolls to the installation panel', () => {
  const call = appJs.slice(appJs.indexOf('onInstallationDashboard:'));
  assert.ok(call.startsWith('onInstallationDashboard: () => {'), 'app.js passes the callback');
  const body = call.slice(0, 400);
  assert.ok(body.includes("switchView('analytics')"), 'callback opens the Analytics view');
  assert.ok(body.includes('renderAnalytics()'), 'callback renders Analytics');
  assert.ok(body.includes('idaHeading'), 'callback targets the installation heading');
  assert.ok(body.includes('scrollIntoView'), 'callback scrolls the panel into view');
});

test('i18n: panel heading and eyebrow carry data-i18n', () => {
  assert.ok(indexHtml.includes('data-i18n="ida_eyebrow"'), 'panel eyebrow is i18n');
  assert.ok(indexHtml.includes('data-i18n="ida_heading"'), 'panel heading is i18n');
});

test('i18n: tile + panel keys exist once in en and ur, ur carries Urdu script', () => {
  for (const key of [
    'dash_tile_installation_aria', 'dash_tile_installation_title', 'dash_tile_installation_sub',
    'ida_eyebrow', 'ida_heading', 'ida_month_heading', 'ida_month_undated',
  ]) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `${key}: en value must exist`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `${key}: en value must not be empty`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `${key}: ur value must exist`);
    assert.ok(URDU.test(TRANSLATIONS.ur[key]), `${key}: ur value must contain Urdu script, got ${JSON.stringify(TRANSLATIONS.ur[key])}`);
    const occurrences = (navSrc.match(new RegExp(`^\\s*${key}:`, 'gm')) || []).length;
    assert.equal(occurrences, 2, `${key}: must be defined exactly once per dict block (en + ur)`);
  }
  assert.equal(TRANSLATIONS.en.dash_tile_installation_title, 'Installation');
  assert.equal(TRANSLATIONS.en.dash_tile_installation_sub, 'Fees collected & pending');
  assert.equal(TRANSLATIONS.en.ida_heading, 'Customer installation dashboard');
  assert.equal(TRANSLATIONS.en.ida_month_heading, 'Installation fees by join month');
});

test('wiring: renderInstallationDashboard builds the month breakdown from the join-month report', () => {
  const fn = appJs.slice(appJs.indexOf('function renderInstallationDashboard()'));
  const body = fn.slice(0, 1500);
  assert.ok(body.includes('buildNewCustomerReport(state.customers'), 'month breakdown comes from the join-month report');
  assert.ok(body.includes('displayMonthName('), 'month labels use the shared month-name helper');
  assert.ok(body.includes('installationFeeHtml(totals, rows, monthly)'), 'monthly breakdown is passed to the dashboard html');
  assert.ok(body.includes("t('ida_month_heading')"), 'month heading is translated');
  assert.ok(body.includes("t('ida_month_undated'"), 'undated note is translated');
});

test('boundary: the Complaints & Installs pill still opens complaints', () => {
  // Out of scope to rewire (the pill's label trap stays): pin that the
  // polish did not silently change where it goes.
  const pill = indexHtml.slice(indexHtml.indexOf('id="briefPillWork"'), indexHtml.indexOf('id="briefPillWork"') + 300);
  assert.ok(pill.includes('data-brief-nav="complaints"'), 'pill still navigates to complaints');
});

test('css: the installation tile has its own accent, light and dark, with no new hex', () => {
  assert.ok(dashboardCss.includes('.primary-action-installation'), 'installation accent rules exist');
  assert.ok(dashboardCss.includes('[data-theme="dark"] .primary-action-installation'), 'dark accent rules exist');
  assert.ok(dashboardCss.includes('.primary-action-installation .home-primary-icon'), 'installation icon accent exists');
  // The accent reuses the dashboard's own pie teal as rgb() triples plus
  // hex values already in this file, so the legacy hex ratchet must not
  // grow: dashboard.css stays at its current 85 distinct hex colours.
  const stripped = dashboardCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 85, `dashboard.css must stay at 85 distinct hex colours, got ${distinct.size}`);
});

test('css: the home tile grid stays four columns — the 5th tile wraps inside the same region', () => {
  // Deliberate: the grid is NOT widened to five columns (a 5th column
  // would crush every tile on desktop, and the user's phone is a
  // two-column layout either way). The 5th tile wraps to the next row
  // of the same #homePrimaryActions region and stays visible without
  // scrolling; this test pins that the grid was not silently changed.
  const grid = dashboardCss.slice(dashboardCss.indexOf('.home-primary-actions {'));
  assert.ok(grid.includes('grid-template-columns: repeat(4, minmax(0, 1fr))'), 'desktop grid stays four columns');
});
