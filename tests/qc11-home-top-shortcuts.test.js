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

test('top shortcuts section exists with three buttons, one per flow', () => {
  assert.ok(html.includes('class="home-top-shortcuts"'), 'missing .home-top-shortcuts section');
  for (const kind of ['quick-collect', 'bulk-collect', 'record-payment']) {
    assert.ok(html.includes(`data-shortcut="${kind}"`), `missing shortcut button ${kind}`);
  }
  const kinds = [...html.matchAll(/data-shortcut="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ['quick-collect', 'bulk-collect', 'record-payment']);
});

test('top shortcuts sit below the search and above the KPI strip and the old tiles', () => {
  const section = html.indexOf('home-top-shortcuts');
  assert.ok(section > html.indexOf('global-search-region'), 'shortcuts must sit below the global search');
  assert.ok(section > html.indexOf('dashboard-heading'), 'shortcuts must sit inside the dashboard, after its heading');
  assert.ok(section < html.indexOf('homeKpiStrip'), 'shortcuts must sit above the KPI strip');
  assert.ok(section < html.indexOf('homePrimaryActions'), 'shortcuts must sit above the existing primary-actions tiles');
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
  const lastMedia = css.lastIndexOf('@media (max-width: 620px)');
  assert.ok(lastMedia >= 0, 'missing <= 620 px media query for the top shortcuts');
  const tail = css.slice(lastMedia);
  assert.ok(tail.includes('.home-top-shortcut'), 'mobile rules must target .home-top-shortcut');
  assert.ok(tail.includes('min-height: 64px'), 'mobile shortcut must be at least 44 px tall (64 px)');
  assert.ok(tail.includes('flex-direction: column'), 'mobile shortcut stacks icon above label');
  assert.ok(tail.includes('.home-top-shortcut .home-primary-subtitle'), 'mobile rules must cover the subtitle');
  assert.ok(tail.includes('display: none'), 'mobile shortcut hides the subtitle so the label never truncates');
});

test('the QC-11 CSS block introduces no new hex colour', () => {
  const start = css.indexOf('/* QC-11');
  assert.ok(start >= 0, 'missing QC-11 CSS block marker');
  const block = css.slice(start);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'QC-11 CSS must reuse tokens only, no new hex');
});

// --- Pins: nothing existing moves, nothing is duplicated ---

test('pin: the 5 existing home tiles stay, in the same order', () => {
  const ids = [
    'quickActionReceivePayment',
    'quickActionAddCustomer',
    'homeActionDuesList',
    'quickActionDailyClosing',
    'quickActionInstallationDashboard',
  ];
  const positions = ids.map((id) => html.indexOf(`id="${id}"`));
  for (let i = 0; i < ids.length; i++) {
    assert.ok(positions[i] >= 0, `missing existing tile ${ids[i]}`);
    if (i > 0) assert.ok(positions[i] > positions[i - 1], `existing tile order changed at ${ids[i]}`);
  }
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
