import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../core.js';
import { calculateDashboardKpis } from '../dashboard.js';
import {
  calculateNewCustomers,
  newCustomersSectionHtml,
  renderNewCustomers
} from '../dashboard-new-customers.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const MONTH = '2026-11';

function buildFixture() {
  let state = createInitialState([
    'New Conn A',
    'New Added B & Sons',
    'Old Conn C',
    'Old Added D',
    'New Backdated E',
    'New Archived F',
    'New Free G',
    'New No Fee H',
    'New Paisa I',
    'New Bad Date J'
  ]);
  const set = (index, fields) => {
    Object.assign(state.customers[index], fields);
  };
  // A: connected this month, with a package and a fee — listed.
  set(0, { connectionDate: '2026-11-02', addedOn: '2026-11-02', mohalla: 'CHARYAA', packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 });
  // B: no connection date, added this month — listed.
  set(1, { connectionDate: null, addedOn: '2026-11-05', mohalla: 'GANGALL', packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000 });
  // C: connected last month, added this month — the connection
  // date wins, so NOT new this month.
  set(2, { connectionDate: '2026-10-28', addedOn: '2026-11-01', mohalla: 'CHARYAA', packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 });
  // D: added last month, no connection date — NOT new.
  set(3, { connectionDate: null, addedOn: '2026-10-30', mohalla: 'GANGALL', packageSpeed: '5Mbps / 150GB', monthlySellingAmount: 1500 });
  // E: connected this month, added last month — the connection
  // date is this month, so listed; the earliest join, so first.
  set(4, { connectionDate: '2026-11-01', addedOn: '2026-10-15', mohalla: 'KISHTII', packageSpeed: '3Mbps / 300GB', monthlySellingAmount: 1600 });
  // F: connected this month, then archived — never appears.
  set(5, { connectionDate: '2026-11-03', addedOn: '2026-11-03', mohalla: 'CHARYAA', packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000, archived: true });
  // G: a free connection added this month — listed, and it owes
  // PKR 0, with no package recorded.
  set(6, { connectionDate: '2026-11-04', addedOn: '2026-11-04', mohalla: 'GANGALL', packageSpeed: '', monthlySellingAmount: null, isFreeConnection: true });
  // H: added this month with a package but no selling amount —
  // listed, with no usable dues figure, and no mohalla recorded.
  set(7, { connectionDate: '2026-11-06', addedOn: '2026-11-06', mohalla: '', packageSpeed: '3Mbps / 100GB', monthlySellingAmount: null });
  // I: added this month with a paisa-exact fee — listed.
  set(8, { connectionDate: '2026-11-07', addedOn: '2026-11-07', mohalla: 'KISHTII', packageSpeed: '5Mbps / 150GB', monthlySellingAmount: 1500.5 });
  // J: a connection date that is not a date at all, added this
  // month — the connection date is present, so the added date
  // never rescues it, and it is NOT new this month.
  set(9, { connectionDate: 'not-a-date', addedOn: '2026-11-08', mohalla: 'CHARYAA', packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 });
  return state;
}

test('new customers strip: lists exactly the customers who joined this month, with their own package price', () => {
  const summary = calculateNewCustomers(buildFixture(), REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.equal(summary.customerCount, 6);
  assert.deepEqual(summary.customers, [
    { name: 'New Backdated E', mohalla: 'Kishtii', package: '3Mbps / 300GB', duesCents: 160000, joinedDate: '2026-11-01' },
    // Owner 5-part fix: stored 'CHARYAA' is its own mohalla —
    // it reads as the 'Charyaa' label, never folded into Chamyaaa.
    { name: 'New Conn A', mohalla: 'Charyaa', package: '15Mbps Unlimited', duesCents: 300000, joinedDate: '2026-11-02' },
    { name: 'New Free G', mohalla: 'Gangall', package: '', duesCents: 0, joinedDate: '2026-11-04' },
    { name: 'New Added B & Sons', mohalla: 'Gangall', package: '5Mbps / 200GB', duesCents: 200000, joinedDate: '2026-11-05' },
    { name: 'New No Fee H', mohalla: 'Unassigned', package: '3Mbps / 100GB', duesCents: null, joinedDate: '2026-11-06' },
    { name: 'New Paisa I', mohalla: 'Kishtii', package: '5Mbps / 150GB', duesCents: 150050, joinedDate: '2026-11-07' }
  ]);
});

test('new customers strip: the count always agrees with the dashboard new-connections figure', () => {
  const state = buildFixture();
  const summary = calculateNewCustomers(state, REF_DATE);
  assert.equal(summary.customerCount, calculateDashboardKpis(state, REF_DATE).newConnectionsCount);
});

test('new customers strip: rows are ordered by join date, earliest first, then name A–Z', () => {
  const summary = calculateNewCustomers(buildFixture(), REF_DATE);
  assert.deepEqual(
    summary.customers.map((row) => row.name),
    ['New Backdated E', 'New Conn A', 'New Free G', 'New Added B & Sons', 'New No Fee H', 'New Paisa I']
  );
});

test('new customers strip: a business with no customers shows no one, at zero', () => {
  const summary = calculateNewCustomers({ customers: [] }, REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.deepEqual(summary.customers, []);
  assert.equal(summary.customerCount, 0);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderNewCustomers(doc, summary);
  assert.equal(els.ncmNewTotal.textContent, '0');
  assert.equal(els.ncmNewLine.textContent, '0 new customers this month');
  assert.equal(els.ncmNewRows.innerHTML, '');
  assert.equal(els.ncmNewEmpty.hidden, false, 'empty state shows');
});

test('new customers strip render: PKR figures, line, and rows land in the view', () => {
  const summary = calculateNewCustomers(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderNewCustomers(doc, summary);
  assert.equal(els.ncmNewTotal.textContent, '6');
  assert.equal(els.ncmNewLine.textContent, '6 new customers this month');
  assert.equal(els.ncmNewEmpty.hidden, true, 'empty state hides while new customers exist');
  const html = els.ncmNewRows.innerHTML;
  assert.ok(html.includes('New Conn A'), 'A row lands');
  assert.ok(html.includes('PKR 3,000'), 'A dues figure lands');
  // Stored 'CHARYAA' renders under its own 'Charyaa' label
  // (Owner 5-part fix — no fold into Chamyaaa).
  assert.ok(html.includes('Charyaa · 15Mbps Unlimited'), 'A mohalla and package land');
  assert.ok(html.includes('New Added B &amp; Sons'), 'names are escaped');
  assert.ok(html.includes('PKR 2,000'), 'B dues figure lands');
  assert.ok(html.includes('New Free G'), 'free connection row lands');
  assert.ok(html.includes('PKR 0'), 'free connection owes PKR 0');
  assert.ok(html.includes('No package'), 'free connection has no package');
  assert.ok(html.includes('New No Fee H'), 'no-fee row lands');
  assert.ok(html.includes('Dues not recorded'), 'no usable selling amount reads plainly, never a guessed zero');
  assert.ok(html.includes('Unassigned'), 'no mohalla reads Unassigned');
  assert.ok(html.includes('New Paisa I'), 'paisa row lands');
  assert.ok(html.includes('PKR 1,500.50'), 'paisa-exact dues keep their paisa');
  // Rows sit earliest join first.
  assert.ok(html.indexOf('New Backdated E') < html.indexOf('New Conn A'), 'E before A');
  assert.ok(html.indexOf('New Conn A') < html.indexOf('New Free G'), 'A before G');
  assert.ok(html.indexOf('New Free G') < html.indexOf('New Added B'), 'G before B');
  assert.ok(html.indexOf('New Added B') < html.indexOf('New No Fee H'), 'B before H');
  assert.ok(html.indexOf('New No Fee H') < html.indexOf('New Paisa I'), 'H before I');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
});

test('new customers strip render: one new customer reads the singular line', () => {
  const state = buildFixture();
  state.customers = [state.customers[0]];
  const summary = calculateNewCustomers(state, REF_DATE);
  assert.equal(summary.customerCount, 1);
  const els = {};
  renderNewCustomers(
    { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) },
    summary
  );
  assert.equal(els.ncmNewTotal.textContent, '1');
  assert.equal(els.ncmNewLine.textContent, '1 new customer this month');
  assert.equal(els.ncmNewEmpty.hidden, true);
});

test('new customers strip: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateNewCustomers(state, REF_DATE);
  newCustomersSectionHtml(summary);
  const els = {};
  renderNewCustomers({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('new customers strip wiring: the strip sits on the billing dashboard after the collector card, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="newCustomersSection"'), 'new customers section exists');
  assert.ok(page.indexOf('id="newCustomersSection"') > page.indexOf('id="collectorCardSection"'), 'strip follows the collector card');
  assert.ok(page.indexOf('id="newCustomersSection"') < page.indexOf('id="collectionForecastSection"'), 'strip sits before the forecast section');
  assert.ok(page.includes('id="ncmNewTotal"'), 'count element exists');
  assert.ok(page.includes('id="ncmNewLine"'), 'count line exists');
  assert.ok(page.includes('id="ncmNewRows"'), 'rows element exists');
  assert.ok(page.includes('id="ncmNewEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_newcustomers_title"'), 'strip title is translated');
  assert.ok(page.includes('data-i18n="dash_newcustomers_sub"'), 'strip subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_newcustomers_empty"'), 'empty state is translated');
  assert.ok(page.includes('New customers this month'), 'strip title reads New customers this month');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-new-customers.js?v=1.11.0'"), 'dashboard imports the new-customers module at the pinned version');
  assert.ok(app.includes('renderNewCustomers(document, calculateNewCustomers(state, referenceDate))'), 'renderDashboard fills the strip from the state');
});

test('i18n: every dash_newcustomers_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-new-customers.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_newcustomers_[a-z_]+)"/g)) used.add(match[1]);
  // The count, no-package, and dues keys sit inside t() calls in
  // the module, not directly after t(' — so the module scan
  // takes every quoted key.
  for (const match of module.matchAll(/'(dash_newcustomers_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 7, `expected at least 7 new-customers keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-new-customers.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
});
