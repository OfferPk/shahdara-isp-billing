// QC-11 — Home dashboard top shortcuts: Quick Collect, Bulk Collect,
// Record Payment at the top of the app, below the search. The home
// dashboard today has 5 primary tiles (Payment lo, Customer add, Dues
// list, Aaj ka hisaab, Installation) and no Bulk Collect entry from home
// (reachable only inside the QC picker / deep link #/bulk-collect); there
// is no separate Quick Collect or Record Payment tile. "Payment lo" opens
// Quick Collect (app.js onReceivePayment -> quickCollectModalController
// .open(), fallback openPaymentEntry()). Verified at the QC-10 head
// 41b6a702: openAddPayment() also routes to the Quick Collect modal
// (qc.open()) with a profile-form fallback, so Record Payment reuses that
// existing opener — no duplicate flow is built here.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read the
// HTML/CSS/JS as text and assert the values; no browser needed.
// Fixture data only. No customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const appSrc = read('app.js');
const css = read('dashboard.css');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

const URDU = /[\u0600-\u06FF]/;

function ruleBlock(source, selectorWithBrace) {
  const start = source.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

function qc11Block() {
  const start = appSrc.indexOf('// QC-11: home top shortcuts');
  const end = appSrc.indexOf('// QC-11: end home top shortcuts');
  assert.ok(start >= 0, 'missing QC-11 wiring block in app.js');
  assert.ok(end > start, 'missing QC-11 wiring block end marker in app.js');
  return appSrc.slice(start, end);
}

// --- Behaviour: the three shortcuts exist and sit at the top of home ---

test('top shortcuts: the "Most used" row is gone — Quick Collect alone leads the primary actions', () => {
  // Home Dashboard overhaul: the .home-top-shortcuts section is
  // DELETED. Quick Collect (data-shortcut="quick-collect") now
  // leads #homePrimaryActions; Bulk Collect stays reachable from
  // inside the QC sheet and Record Payment was the same flow as
  // Quick Collect, so neither shortcut button survives on Home.
  assert.ok(!html.includes('class="home-top-shortcuts"'), 'the Most-used row is gone');
  assert.ok(html.includes('data-shortcut="quick-collect"'), 'Quick Collect shortcut survives');
  const kinds = [...html.matchAll(/data-shortcut="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['quick-collect']);
  assert.ok(html.indexOf('data-shortcut="quick-collect"') > html.indexOf('id="homePrimaryActions"'), 'Quick Collect sits inside the primary actions');
});

test('Quick Collect tile sits below the search and the KPI strip, first in the primary actions', () => {
  const tile = html.indexOf('data-shortcut="quick-collect"');
  assert.ok(tile > html.indexOf('global-search-region'), 'Quick Collect must sit below the global search');
  assert.ok(tile > html.indexOf('dashboard-heading'), 'Quick Collect must sit inside the dashboard, after its heading');
  assert.ok(tile > html.indexOf('homeKpiStrip'), 'Quick Collect must sit below the KPI strip');
  assert.ok(tile > html.indexOf('id="homePrimaryActions"'), 'Quick Collect must sit inside the primary-actions region');
  assert.ok(tile < html.indexOf('id="quickActionAddCustomer"'), 'Quick Collect must lead the primary actions');
});

test('Quick Collect shortcut opens the existing Quick Collect modal', () => {
  const block = qc11Block();
  assert.ok(block.includes('quickCollectModalController'), 'QC wiring must call the Quick Collect controller');
  assert.ok(block.includes('quickCollectModalController?.open'), 'QC wiring must call controller.open()');
});

test('Bulk Collect shortcut opens the existing Bulk Collect modal', () => {
  const block = qc11Block();
  assert.ok(block.includes('bulkCollect'), 'bulk wiring must reference the Bulk Collect controller');
  assert.ok(block.includes('bulkCollect?.open') || block.includes('bulkCollect.open'), 'bulk wiring must call bulkCollect.open()');
});

test('Record Payment shortcut reuses the existing record-payment opener', () => {
  const block = qc11Block();
  assert.ok(block.includes('openAddPayment()'), 'record-payment wiring must call openAddPayment()');
});

// --- Behaviour: labels, i18n and 360 px rules ---

test('shortcut labels ship in EN + UR together, UR in Urdu script', () => {
  const keys = [
    'qc11_quick_collect', 'qc11_quick_collect_sub',
    'qc11_bulk_collect', 'qc11_bulk_collect_sub',
    'qc11_record_payment', 'qc11_record_payment_sub',
    'qc11_top_label',
  ];
  for (const key of keys) {
    assert.ok(typeof en[key] === 'string' && en[key].length > 0, `missing EN key ${key}`);
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR key ${key}`);
    assert.ok(URDU.test(ur[key]), `UR key ${key} must carry Urdu script`);
  }
  assert.equal(en.qc11_quick_collect, 'Quick Collect');
  assert.equal(en.qc11_bulk_collect, 'Bulk Collect');
  assert.equal(en.qc11_record_payment, 'Record Payment');
});

test('top shortcuts are a 3-column grid on desktop', () => {
  const block = ruleBlock(css, '.home-top-shortcuts {');
  assert.ok(block.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'desktop grid must be 3 columns');
  assert.ok(block.includes('display: grid'), 'top shortcuts must be a grid');
});

test('at <= 620 px the shortcuts stay readable: 44 px+ targets, no truncation', () => {
  // Home Dashboard polish (A2): the QC-11 column stack is SUPERSEDED —
  // the spec deliberately reverses a measured QC-11 decision (vertical
  // stack + hidden subtitle) for visual uniformity: all four
  // Quick-Action cards share ONE horizontal row (56px, padding 0 14px,
  // gap 10px) with visible subtitles. The .home-top-shortcut CLASS
  // stays on the Quick Collect button (the QC-11 JS hook); only its
  // CSS column rule is deleted. The old slice-from-the-last-620px-block
  // no longer works after the deletion, so the new contract is asserted
  // on the unified rule itself.
  assert.ok(!css.includes('.home-top-shortcut {'), 'the column override rule is gone');
  assert.ok(!css.includes('.home-top-shortcut .home-primary-subtitle'), 'no rule hides the subtitle any more');
  const block = ruleBlock(css, '.home-primary-actions .home-primary-btn {');
  assert.ok(block.includes('flex-direction: row'), 'all four cards share one horizontal row');
  assert.ok(block.includes('height: 56px'), 'unified row height is 56px');
  assert.ok(block.includes('min-height: 56px'), 'unified row target is 56px (>= 44px)');
  assert.ok(block.includes('padding: 0 14px'), 'unified row padding is 0 14px');
  assert.ok(block.includes('gap: 10px'), 'unified row gap is 10px');
  assert.ok(html.includes('home-top-shortcut'), 'the QC-11 hook class stays on the Quick Collect button');
});

test('the QC-11 CSS block introduces no new hex colour', () => {
  const start = css.indexOf('/* QC-11');
  assert.ok(start >= 0, 'missing QC-11 CSS block marker');
  const block = css.slice(start);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'QC-11 CSS must reuse tokens only, no new hex');
});

// --- Pins: nothing existing moves, nothing is duplicated ---

test('pin: Home keeps exactly 4 quick actions, in order — Quick Collect, Add Customer, Dues List, Installation', () => {
  // Home Dashboard overhaul: the 5-tile pin is SUPERSEDED — the
  // "Most used" row is gone, Receive Payment (same flow as Quick
  // Collect) and Daily Closing (already in the More menu) are
  // deleted, and Quick Collect now leads the primary actions.
  const markers = [
    'data-shortcut="quick-collect"',
    'id="quickActionAddCustomer"',
    'id="homeActionDuesList"',
    'id="quickActionInstallationDashboard"',
  ];
  const positions = markers.map((m) => html.indexOf(m));
  for (let i = 0; i < markers.length; i++) {
    assert.ok(positions[i] >= 0, `missing quick action ${markers[i]}`);
    if (i > 0) assert.ok(positions[i] > positions[i - 1], `quick action order changed at ${markers[i]}`);
  }
  assert.ok(!html.includes('id="quickActionReceivePayment"'), 'Receive Payment tile is gone');
  assert.ok(!html.includes('id="quickActionDailyClosing"'), 'Daily Closing tile is gone');
});

test('pin: Payment lo still opens Quick Collect (onReceivePayment unchanged)', () => {
  const start = appSrc.indexOf('setupDashboardQuickActions({');
  assert.ok(start >= 0, 'missing setupDashboardQuickActions call');
  const call = appSrc.slice(start, start + 800);
  assert.ok(call.includes('onReceivePayment'), 'onReceivePayment handler must stay');
  assert.ok(call.includes('quickCollectModalController'), 'onReceivePayment must still open the Quick Collect modal');
});

test('pin: the global search still sits above the dashboard', () => {
  // NB: the bare word billingDashboard also appears in an HTML comment
  // above the search region; the section id is the real anchor.
  assert.ok(html.indexOf('global-search-region') < html.indexOf('id="billingDashboard"'));
});

test('pin: no new element id and no new store key for QC-11', () => {
  assert.ok(!html.includes('id="qc11'), 'QC-11 must use class-found wiring, no new element id');
  assert.ok(!appSrc.includes('shahdara_qc11'), 'QC-11 must not introduce a new store key');
  assert.ok(!html.includes('data-shortcut="payment-lo"'), 'no fourth shortcut duplicating Payment lo');
});

// Dues-list tile live fix (2026-11-12): tapping the Home "Dues list"
// tile must land the user on the CUSTOMER dues list — the Top
// Defaulters modal (who owes, how much) — and a second tap must not
// throw. The tile has ONE path: setupDashboardQuickActions wires
// homeActionDuesList to onDuesList, which opens the Top Defaulters
// controller; the controller's open() guards showModal() and renders
// the list.
test('Dues list tile opens the customer dues list (Top Defaulters modal)', () => {
  const dashboardSrc = read('dashboard.js');
  assert.ok(dashboardSrc.includes("wire('homeActionDuesList', onDuesList)"), 'tile must be wired to onDuesList');

  const onDuesListStart = appSrc.indexOf('onDuesList: () => {');
  assert.ok(onDuesListStart >= 0, 'missing onDuesList handler in app.js');
  const onDuesList = appSrc.slice(onDuesListStart, appSrc.indexOf('onDailyClosing:', onDuesListStart));
  assert.ok(onDuesList.includes('topDefaultersModalController'), 'onDuesList must use the Top Defaulters controller');
  assert.ok(onDuesList.includes('topDefaultersModalController.open()'), 'onDuesList must open the modal');

  const ctrlSrc = read('dashboard-top-defaulters.js');
  assert.ok(ctrlSrc.includes('showModalOnce()'), 'controller open must guard showModal against an already-open dialog');
  const openBlock = ctrlSrc.slice(ctrlSrc.indexOf('open: () => {'), ctrlSrc.indexOf('open: () => {') + 120);
  assert.ok(openBlock.includes('showModalOnce()'), 'controller open() must use the guard');
  assert.ok(openBlock.includes('renderContent()'), 'controller open() must render the dues list');
});
