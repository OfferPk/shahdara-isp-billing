import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Polish #28 Phase B — em dash for empty optional values + service
// status indicator (Req 3 + Req 4).
//
// Req 3: in the PROFILE VIEW only, an empty OPTIONAL value renders the
// language-neutral em dash "—" (U+2014) instead of "Not set" / "Not
// recorded" / a blank. REQUIRED fields keep their existing wording,
// and rows that carry a STATE (service status, vacation hold, shield,
// usual pay day) keep their labels — a state is not an empty value.
// The dash is applied at the profile render site through profile-scoped
// helpers in profile-ui.js — never by changing the shared prof_not_set
// / prof_not_recorded dictionary values (router-credentials.js and
// welcome-agreement-slip.js read them too) and never by changing the
// shared money formatters (formatPKR / formatSalesTaxAmount keep their
// literal 'Not set' fallback for callers outside the profile view).
//
// Req 4: a DERIVED service-status pill (Suspended > Expired > Vacation
// > Offline > Active > Not chosen) sits first in the profile heading
// badges. The pill is the derived indicator; the Service-group row
// keeps the STORED status label exactly as today, and the detail-head
// #profileServiceStatusBadge (stored status) is untouched.
//
// Scope boundary, pinned below: the prose sections (optical, pole,
// feeder, custody) keep their sentence wording; the print card and the
// header strip keep "Not set" / "Not recorded" (they are not the view,
// and the header strip is polish #22's); the current-bill summary
// keeps its computed-figure wording (Req 7 / Phase D territory); the
// edit FORM profit preview keeps "Not set" (the form is not the view).
//
// This file follows the Phase A pattern: the new helpers are imported
// dynamically so the pre-fix check fails per test instead of failing
// the whole file at load, and the wiring is pinned by source text.

async function loadProfileUi() {
  return import('../profile-ui.js');
}

function groupFragments() {
  const app = read('app.js');
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  const end = app.indexOf('\n', start);
  assert.notEqual(end, -1, 'fragments object must end on its line');
  return app.slice(start, end);
}

function fragmentSlice(frags, from, to) {
  const start = frags.indexOf(`${from}: profileInfoGroupMarkup(`);
  assert.notEqual(start, -1, `${from} fragment must exist`);
  const end = to ? frags.indexOf(`${to}: profileInfoGroupMarkup(`, start) : frags.length;
  return frags.slice(start, end);
}

function sectionSummaryLine(key) {
  // The seven summaries are inline in the profileSection*Html consts
  // (one line each), not a summaries object — extract the one line for
  // the named section.
  const app = read('app.js');
  const start = app.indexOf(`const profileSection${key}Html = profileDetailSectionHtml(`);
  assert.notEqual(start, -1, `${key} section line must exist`);
  const end = app.indexOf('\n', start);
  assert.notEqual(end, -1, `${key} section line must end on its line`);
  return app.slice(start, end);
}

function headingBadgesLine() {
  const app = read('app.js');
  const start = app.indexOf('const headingBadgesHtml =');
  assert.notEqual(start, -1, 'headingBadgesHtml must exist');
  const end = app.indexOf('\n', start);
  assert.notEqual(end, -1, 'headingBadgesHtml must end on its line');
  return app.slice(start, end);
}

function installCostLine() {
  const app = read('app.js');
  const start = app.indexOf('function installationCostProfileLine(');
  assert.notEqual(start, -1, 'installationCostProfileLine must exist');
  const end = app.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'installationCostProfileLine must end cleanly');
  return app.slice(start, end + 3);
}

// ------------------------------------------------------------ the dash helpers

test('phase B: the dash is the literal em dash (U+2014)', async () => {
  const { PROFILE_EMPTY_DASH } = await loadProfileUi();
  assert.equal(PROFILE_EMPTY_DASH, '—');
  assert.equal(PROFILE_EMPTY_DASH.codePointAt(0), 0x2014, 'must be U+2014, not a hyphen or en dash');
  assert.equal(PROFILE_EMPTY_DASH.length, 1);
});

test('phase B: profileEmptyText dashes empty values and passes real values through', async () => {
  const { profileEmptyText } = await loadProfileUi();
  for (const empty of [null, undefined, '', '   ']) {
    assert.equal(profileEmptyText(empty), '—', `must dash ${String(empty)}`);
  }
  assert.equal(profileEmptyText('03012345678'), '03012345678', 'a real phone number is not dashed');
  assert.equal(profileEmptyText('Shahdara'), 'Shahdara', 'a real value passes through unchanged');
});

test('phase B: profileEmptyMoney dashes non-money and formats real rupees', async () => {
  const { profileEmptyMoney } = await loadProfileUi();
  for (const empty of [null, undefined, '', true, 'abc', NaN]) {
    assert.equal(profileEmptyMoney(empty), '—', `must dash ${String(empty)}`);
  }
  assert.equal(profileEmptyMoney(0), 'PKR 0', 'a real zero is a figure, not an empty value');
  assert.equal(profileEmptyMoney(1500), 'PKR 1,500');
  assert.equal(profileEmptyMoney(1500.5), 'PKR 1,500.50', 'the shared formatter pads fractional rupees to two decimals');
});

test('phase B: profileEmptyTax dashes non-money cents and formats real tax', async () => {
  const { profileEmptyTax } = await loadProfileUi();
  for (const empty of [null, undefined, '', true, 'abc', NaN]) {
    assert.equal(profileEmptyTax(empty), '—', `must dash ${String(empty)}`);
  }
  assert.equal(profileEmptyTax(0), 'PKR 0', 'zero tax is a figure, not an empty value');
  assert.equal(profileEmptyTax(19500), 'PKR 195', '19.5% of PKR 1,000 in cents');
});

test('phase B: profileProfitDisplay shows the figure when profit exists', async () => {
  const { profileProfitDisplay } = await loadProfileUi();
  assert.equal(profileProfitDisplay({ monthlyPurchaseCost: 1000, monthlySellingAmount: 2800 }, 1800), 'PKR 1,800');
  assert.equal(profileProfitDisplay({ monthlyPurchaseCost: 3000, monthlySellingAmount: 3000 }, 0), 'PKR 0', 'a zero profit is a real figure');
});

test('phase B: profileProfitDisplay names the missing components when profit is null', async () => {
  const { profileProfitDisplay } = await loadProfileUi();
  assert.equal(
    profileProfitDisplay({ monthlyPurchaseCost: null, monthlySellingAmount: null }, null),
    '— (missing: Monthly provider purchase cost / Monthly selling amount)',
    'both missing components are named, in field order',
  );
  assert.equal(
    profileProfitDisplay({ monthlyPurchaseCost: null, monthlySellingAmount: 2000 }, null),
    '— (missing: Monthly provider purchase cost)',
    'only the missing cost is named',
  );
  assert.equal(
    profileProfitDisplay({ monthlyPurchaseCost: 1000, monthlySellingAmount: null }, null),
    '— (missing: Monthly selling amount)',
    'only the missing selling amount is named',
  );
});

// ------------------------------------------------------------ status derivation

const baseCustomer = (overrides = {}) => ({ serviceStatus: 'active', ...overrides });
const openSuspension = (overrides = {}) => ({ status: 'open', suspensionDate: '2026-10-12', ...overrides });
const TODAY = '2026-11-09';

test('phase B status: each state in isolation', async () => {
  const { profileServiceState } = await loadProfileUi();
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'active' }), { today: TODAY, openSuspension: null }),
    { state: 'active', label: 'Active', modifier: 'active' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'offline' }), { today: TODAY, openSuspension: null }),
    { state: 'offline', label: 'Offline', modifier: 'offline' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'not-set' }), { today: TODAY, openSuspension: null }),
    { state: 'not-chosen', label: 'Not chosen', modifier: 'not-set' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'active', cancellationDate: '2026-11-01' }), { today: TODAY, openSuspension: null }),
    { state: 'expired', label: 'Expired', modifier: 'not-set' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'active', expiryDate: '2026-11-08' }), { today: TODAY, openSuspension: null }),
    { state: 'expired', label: 'Expired', modifier: 'not-set' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'active', paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: null }),
    { state: 'vacation', label: 'Vacation · since Nov 3 2026', modifier: 'vacation' },
  );
  assert.deepEqual(
    profileServiceState(baseCustomer({ serviceStatus: 'active' }), { today: TODAY, openSuspension: openSuspension() }),
    { state: 'suspended', label: 'Suspended · Oct 12 2026', modifier: 'offline' },
  );
});

test('phase B status: Suspended beats Expired, Expired beats Vacation, Vacation beats Offline', async () => {
  const { profileServiceState } = await loadProfileUi();
  // Suspended beats Expired (cancelled + open suspension).
  assert.equal(
    profileServiceState(baseCustomer({ cancellationDate: '2026-11-01' }), { today: TODAY, openSuspension: openSuspension() }).state,
    'suspended',
  );
  // Suspended beats Vacation (paused + open suspension).
  assert.equal(
    profileServiceState(baseCustomer({ paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: openSuspension() }).state,
    'suspended',
  );
  // Expired beats Vacation (cancelled + paused).
  assert.equal(
    profileServiceState(baseCustomer({ paused: true, pauseStartDate: '2026-11-03', cancellationDate: '2026-11-01' }), { today: TODAY, openSuspension: null }).state,
    'expired',
  );
  // Expired beats Offline (past expiry + stored offline).
  assert.equal(
    profileServiceState(baseCustomer({ serviceStatus: 'offline', expiryDate: '2026-11-08' }), { today: TODAY, openSuspension: null }).state,
    'expired',
  );
  // Vacation beats Offline (paused + stored offline).
  assert.equal(
    profileServiceState(baseCustomer({ serviceStatus: 'offline', paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: null }).state,
    'vacation',
  );
  // Vacation beats Active (paused + stored active).
  assert.equal(
    profileServiceState(baseCustomer({ serviceStatus: 'active', paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: null }).state,
    'vacation',
  );
});

test('phase B status: expiry today is not expired; a closed suspension does not suspend; unknown status falls to Not chosen', async () => {
  const { profileServiceState } = await loadProfileUi();
  assert.equal(
    profileServiceState(baseCustomer({ expiryDate: '2026-11-09' }), { today: TODAY, openSuspension: null }).state,
    'active',
    'expiry on the current day is not expired yet',
  );
  assert.equal(
    profileServiceState(baseCustomer({ expiryDate: '2026-12-01' }), { today: TODAY, openSuspension: null }).state,
    'active',
    'a future expiry is not expired',
  );
  assert.equal(
    profileServiceState(baseCustomer({ expiryDate: 'not-a-date' }), { today: TODAY, openSuspension: null }).state,
    'active',
    'a malformed expiry string must never false-expire a customer',
  );
  assert.equal(
    profileServiceState(baseCustomer(), { today: TODAY, openSuspension: openSuspension({ status: 'closed' }) }).state,
    'active',
    'a closed suspension record is not a suspension',
  );
  assert.equal(
    profileServiceState(baseCustomer({ serviceStatus: 'bogus' }), { today: TODAY, openSuspension: null }).state,
    'not-chosen',
    'an unknown stored status falls to Not chosen, never to Active',
  );
  assert.equal(
    profileServiceState(baseCustomer({ paused: true, pauseStartDate: null }), { today: TODAY, openSuspension: null }).state,
    'active',
    'a pause flag with no start date is not an active vacation',
  );
  assert.equal(
    profileServiceState(baseCustomer(), { today: TODAY, openSuspension: openSuspension({ suspensionDate: '' }) }).state,
    'active',
    'an open suspension with no date does not suspend (records always carry one)',
  );
});

test('phase B pill: the pill html carries the modifier class and escapes the label', async () => {
  const { profileServiceStatusPillHtml } = await loadProfileUi();
  assert.equal(
    profileServiceStatusPillHtml({ state: 'vacation', label: 'Vacation · since Nov 3 2026', modifier: 'vacation' }),
    '<span class="profile-service-status profile-service-status-vacation">Vacation · since Nov 3 2026</span>',
  );
  assert.equal(
    profileServiceStatusPillHtml({ state: 'active', label: 'A <B> & "C"', modifier: 'active' }),
    '<span class="profile-service-status profile-service-status-active">A &lt;B&gt; &amp; &quot;C&quot;</span>',
    'labels are escaped before they reach the page',
  );
});

// ------------------------------------------------------------ Req 3: the fragments

test('phase B Req 3: contact and location rows dash empty values', () => {
  const frags = groupFragments();
  const contact = fragmentSlice(frags, 'contact', 'location');
  assert.ok(contact.includes("[t('prof_field_phone'), profileEmptyText(phone)]"), 'phone must dash when empty');
  assert.ok(contact.includes("[t('prof_field_cnic'), cnic ? formatCnicDisplay(cnic) : PROFILE_EMPTY_DASH]"), 'cnic must dash when empty');
  const location = fragmentSlice(frags, 'location', 'service');
  for (const row of [
    "[t('prof_field_area'), profileEmptyText(customer.mohalla)]",
    "[t('prof_field_zone'), profileEmptyText(customer.zone)]",
    "[t('prof_field_address'), profileEmptyText(customer.address), true]",
    "[t('prof_field_notes'), profileEmptyText(customer.notes), true]",
  ]) {
    assert.ok(location.includes(row), `location must dash when empty: ${row}`);
  }
});

test('phase B Req 3: service package dashes; the state rows keep their stored labels', () => {
  const frags = groupFragments();
  const service = fragmentSlice(frags, 'service', 'money');
  // Profile Polish D (16) — the service rows carry a fifth tuple
  // element now (the tap target: the edit-form control id). The value
  // expressions — the pinned intent — are unchanged.
  assert.ok(service.includes("[t('prof_field_isp'), profileEmptyText(customer.ispProvider), false, '', 'ispProviderInput']"), 'isp must dash when empty');
  assert.ok(service.includes("[t('prof_field_package'), profileEmptyText(customer.packageSpeed), false, '', 'packageSpeedInput']"), 'package must dash when empty');
  assert.ok(service.includes('manualServiceStatusLabel(customer.serviceStatus)'), 'service status row keeps the STORED label, not the derived pill');
  assert.ok(service.includes('pauseSummary.detail'), 'vacation hold row keeps its state label');
  assert.ok(service.includes('shieldSummary.detail'), 'do-not-suspend shield row keeps its state label');
  assert.ok(service.includes('paydaySummary.label'), 'usual pay day row keeps its state label');
});

test('phase B Req 3: money rows dash empty values; profit names the missing components', () => {
  const frags = groupFragments();
  const money = fragmentSlice(frags, 'money', 'lifecycle');
  // Polish #28 Phase D: the tax label appends the pass-through note
  // ("collected on top, not a business cost") to the same key — the
  // value still dashes through profileEmptyTax when it has no figure.
  assert.ok(money.includes("[`${t('prof_field_sales_tax')} — ${t('prof_field_tax_passthrough')}`, profileEmptyTax(customerSalesTaxCents(customer))]"), 'sales tax must dash when it has no figure');
  assert.ok(money.includes("[t('prof_field_purchase_cost'), profileEmptyMoney(customer.monthlyPurchaseCost)]"), 'purchase cost must dash when empty');
  assert.ok(money.includes("[t('prof_field_selling'), profileEmptyMoney(customer.monthlySellingAmount)]"), 'selling amount must dash when empty');
  assert.ok(money.includes("[t('prof_field_profit'), profileProfitDisplay(customer, profit)]"), 'profit must dash with the missing-component note when null');
});

test('phase B Req 3: lifecycle and install rows dash empty values', () => {
  const frags = groupFragments();
  const lifecycle = fragmentSlice(frags, 'lifecycle', 'install');
  // Profile Polish D (16) — the lifecycle rows carry a fifth tuple
  // element now (the tap target: the edit-form control id). The value
  // expressions — the pinned intent — are unchanged.
  assert.ok(lifecycle.includes("[t('prof_field_expiry'), customer.expiryDate ? humanDate(customer.expiryDate) : PROFILE_EMPTY_DASH, false, '', 'expiryDateInput']"), 'expiry must dash when empty');
  assert.ok(lifecycle.includes("[t('prof_field_cancel_date'), customer.cancellationDate ? humanDate(customer.cancellationDate) : PROFILE_EMPTY_DASH, false, '', 'cancellationDateInput']"), 'cancellation date must dash when empty');
  const install = fragmentSlice(frags, 'install', 'network');
  assert.ok(install.includes("[t('prof_field_conn_start'), customer.connectionDate ? humanDate(customer.connectionDate) : PROFILE_EMPTY_DASH]"), 'connection start must dash when empty');
  assert.ok(install.includes("[t('prof_field_conn_fee'), profileEmptyMoney(customer.connectionFee)]"), 'connection fee must dash when empty');
  assert.ok(install.includes("[t('prof_field_fiber'), customer.fiberMeters === null || customer.fiberMeters === undefined || customer.fiberMeters === '' ? PROFILE_EMPTY_DASH : t('prof_fiber_meters', null, { meters: customer.fiberMeters })]"), 'fiber meters must dash when empty');
  assert.ok(install.includes("[t('prof_field_lineman_fee'), profileEmptyMoney(customer.linemanInstallFee)]"), 'lineman fee must dash when empty');
  assert.ok(install.includes("[t('prof_field_fiber_rate'), customer.fiberPerMeterRate === null || customer.fiberPerMeterRate === undefined || customer.fiberPerMeterRate === '' ? PROFILE_EMPTY_DASH : t('prof_fiber_rate_unit', null, { amount: formatAmount(customer.fiberPerMeterRate) })]"), 'fiber rate must dash when empty');
  assert.ok(install.includes("[t('prof_field_install'), installationCostProfileLine(customer)]"), 'install line still renders through its own line helper');
});

// Polish #28 Phase C — the three network rows carry a fourth tuple
// element now (the copy field: 'pppoeUsername' / 'staticIp' /
// 'macAddress'). The VALUE expressions are untouched, so the dash
// behaviour this test pins is unchanged — only the pinned strings
// grew by the trailing copy field.
test('phase B Req 3: network and hardware rows dash empty values', () => {
  const frags = groupFragments();
  const network = fragmentSlice(frags, 'network', 'hardware');
  assert.ok(network.includes("[t('prof_field_pppoe'), profileEmptyText(customer.pppoeUsername), false, 'pppoeUsername']"), 'pppoe must dash when empty');
  assert.ok(network.includes("[t('prof_field_static_ip'), profileEmptyText(customer.staticIp), false, 'staticIp']"), 'static ip must dash when empty');
  assert.ok(network.includes("[t('prof_field_mac'), customer.macAddress ? customer.macAddress + macAddressDisplaySuffix(customer.macAddress) : PROFILE_EMPTY_DASH, false, 'macAddress']"), 'mac must dash when empty');
  const hardware = fragmentSlice(frags, 'hardware', null);
  assert.ok(hardware.includes("[t('prof_field_router'), profileEmptyText(customer.routerModel)]"), 'router model must dash when empty');
  assert.ok(hardware.includes("[t('prof_field_router_price'), profileEmptyMoney(customer.routerPrice)]"), 'router price must dash when empty');
  assert.ok(hardware.includes("[t('prof_field_mc_cost'), profileEmptyMoney(customer.mediaConverterCost)]"), 'media-converter cost must dash when empty');
});

test('phase B Req 3: no info-group row reads Not set or Not recorded any more', () => {
  const frags = groupFragments();
  assert.equal((frags.match(/t\('prof_not_set'\)/g) || []).length, 0, 'the fragments must not render Not set anywhere');
  assert.equal((frags.match(/t\('prof_not_recorded'\)/g) || []).length, 0, 'the fragments must not render Not recorded anywhere');
});

test('phase B Req 3: the bare dash renders as a subtle empty-value span', () => {
  const app = read('app.js');
  const start = app.indexOf('function profileReadonlyField(');
  assert.notEqual(start, -1, 'profileReadonlyField must exist');
  const end = app.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'profileReadonlyField must end cleanly');
  const fn = app.slice(start, end + 3);
  assert.ok(fn.includes("value === PROFILE_EMPTY_DASH"), 'only the bare dash is wrapped');
  assert.ok(fn.includes('<span class="profile-empty-value">'), 'the dash renders in the muted empty-value span');
  assert.ok(fn.includes('escapeHtml(value)'), 'other values still escape exactly as today');
});

test('phase B Req 3: the install-cost line reads the dash for not-recorded but keeps its other statuses', () => {
  const line = installCostLine();
  assert.ok(line.includes("if (cost.status === 'not-recorded') return PROFILE_EMPTY_DASH;"), 'an unrecorded install cost reads the dash');
  for (const key of ['prof_install_cost_partial', 'prof_install_surplus', 'prof_install_breakeven', 'prof_install_subsidy']) {
    assert.ok(line.includes(key), `install-cost status ${key} must keep its wording`);
  }
  assert.ok(!line.includes("t('prof_not_recorded')"), 'the install-cost line must not render Not recorded any more');
});

// ------------------------------------------------------------ Req 3: the summaries

test('phase B summaries: S1 phone dashes, the name keeps its Not set fallback', () => {
  const customer = sectionSummaryLine('Customer');
  assert.ok(customer.includes('profileEmptyText(phone)'), 'S1 summary must dash an empty phone');
  assert.ok(customer.includes("customer.name || customer.customerName || t('prof_not_set')"), 'S1 name is a required field — its fallback is not dashed');
});

test('phase B summaries: S2 carries the derived status as a word-only pill (Polish C supersedes the text summary)', () => {
  // Profile Polish C (15) supersedes this Phase B Req 3 decision for
  // S2 only: the user asked the section header to show a SMALL pill
  // with just the status word, so the Service summary is the word-only
  // status pill via summaryHtml — no package speed, no "·" separator,
  // no dated label. The escaped-text rule stands for the other six
  // sections (pinned by the phase-A summaries test).
  const service = sectionSummaryLine('Service');
  assert.ok(service.includes('summaryHtml: profileServiceStatusPillHtml(serviceState, { wordOnly: true })'), 'S2 summary must be the word-only status pill');
  assert.ok(!service.includes('summary: `'), 'S2 no longer carries a text summary');
  assert.ok(!service.includes('serviceState.label'), 'S2 no longer reads the dated label');
  assert.ok(!service.includes('profileEmptyText(customer.packageSpeed)'), 'S2 no longer shows the package speed in the header');
  assert.ok(!service.includes('manualServiceStatusLabel'), 'S2 summary no longer reads the stored label');
});

test('phase B summaries: S3 profit is a bare dash when null', () => {
  const financial = sectionSummaryLine('Financial');
  assert.ok(financial.includes('profit === null ? PROFILE_EMPTY_DASH : formatAmount(profit)'), 'S3 summary profit is a bare dash, without the missing-component note');
});

test('phase B summaries: S4, S5 and S6 dash their empty values', () => {
  const connection = sectionSummaryLine('Connection');
  assert.ok(connection.includes('customer.connectionDate ? humanDate(customer.connectionDate) : PROFILE_EMPTY_DASH'), 'S4 summary must dash an empty connection date');
  assert.ok(connection.includes('profileEmptyMoney(customer.connectionFee)'), 'S4 summary must dash an empty connection fee');
  const network = sectionSummaryLine('Network');
  assert.ok(network.includes('profileEmptyText(customer.pppoeUsername)'), 'S5 summary must dash an empty PPPoE username');
  assert.ok(network.includes('profileEmptyText(customer.macAddress)'), 'S5 summary must dash an empty MAC');
  const hardware = sectionSummaryLine('Hardware');
  assert.ok(hardware.includes('profileEmptyText(customer.routerModel)'), 'S6 summary must dash an empty router model');
  assert.ok(hardware.includes('profileEmptyText(custodyFields.serialNumber)'), 'S6 summary must dash an empty custody serial');
});

// ------------------------------------------------------------ Req 4: the pill wiring

test('phase B pill: the derived status pill is the FIRST badge in the heading badges row', () => {
  const badges = headingBadgesLine();
  assert.ok(badges.startsWith('const headingBadgesHtml = `${profileServiceStatusPillHtml(serviceState)}'), 'the pill must lead the badges row');
  assert.ok(badges.includes('${suspensionShieldBadgeHtml(customer, localDate())}'), 'the suspension shield still follows the pill');
  assert.ok(badges.includes('${prepaidUntilBadgeHtml(state, customer)}'), 'the other badges still follow the pill');
  assert.ok(badges.indexOf('profileServiceStatusPillHtml') < badges.indexOf('suspensionShieldBadgeHtml'), 'the pill comes before every other badge');
});

test('phase B pill: the badges row still omits itself when nothing applies (Plan 510)', () => {
  const app = read('app.js');
  const start = app.indexOf("$('#customerProfileView').innerHTML =");
  assert.notEqual(start, -1, 'the profile view assembly must exist');
  const assembly = app.slice(start, app.indexOf('\n', start));
  assert.ok(assembly.includes('headingBadgesHtml ? `<div class="profile-heading-badges">${headingBadgesHtml}</div>` : '), 'the row stays conditional on there being a badge at all');
});

test('phase B pill: the render computes the derived state next to the pause summary', () => {
  const app = read('app.js');
  assert.ok(app.includes("const openSuspension = loadSuspensions().find((entry) => entry.customerId === customer.id && entry.status === 'open') ?? null"), 'an open suspension record is found by customer id');
  assert.ok(app.includes('const serviceState = profileServiceState(customer, { today: localDate(), openSuspension })'), 'the derived state is computed from the stored fields, not a new store');
});

// ------------------------------------------------------------ i18n

test('phase B i18n: the six new keys exist in EN + UR with the exact values and Urdu script', () => {
  const expected = {
    prof_status_suspended: ['Suspended', 'معطل'],
    prof_status_suspended_date: ['Suspended · {date}', 'معطل · {date}'],
    prof_status_vacation: ['Vacation', 'چھٹی'],
    prof_status_vacation_since: ['Vacation · since {date}', 'چھٹی · {date} سے'],
    prof_status_expired: ['Expired', 'ختم شدہ'],
    prof_missing_note: ['missing: {items}', 'نامکمل: {items}'],
  };
  for (const [key, [en, ur]] of Object.entries(expected)) {
    assert.equal(TRANSLATIONS.en[key], en, `en ${key} must read ${en}`);
    assert.equal(TRANSLATIONS.ur[key], ur, `ur ${key} must read ${ur}`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur ${key} must carry Urdu script`);
  }
});

test('phase B i18n: the old status labels are reused, not duplicated', () => {
  assert.equal(TRANSLATIONS.en.prof_service_active, 'Active');
  assert.equal(TRANSLATIONS.en.prof_service_offline, 'Offline');
  assert.equal(TRANSLATIONS.en.prof_service_not_chosen, 'Not chosen');
  assert.ok(!('prof_status_active' in TRANSLATIONS.en), 'Active must reuse prof_service_active, not gain a duplicate key');
  assert.ok(!('prof_status_offline' in TRANSLATIONS.en), 'Offline must reuse prof_service_offline, not gain a duplicate key');
  assert.ok(!('prof_status_not_chosen' in TRANSLATIONS.en), 'Not chosen must reuse prof_service_not_chosen, not gain a duplicate key');
});

// ------------------------------------------------------------ styles

test('phase B styles: vacation pill uses amber tokens only, empty value uses the muted token, no new hex', () => {
  const styles = read('styles.css');
  const rules = styles.match(/\.profile-service-status-vacation[^{]*\{[^}]*\}|\.profile-empty-value\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 3, 'the vacation pill, its dot and the empty-value rules must exist');
  const vacation = rules.filter((rule) => rule.startsWith('.profile-service-status-vacation'));
  assert.ok(vacation.some((rule) => rule.includes('var(--amber-bg)') && rule.includes('var(--amber)')), 'the vacation pill must read the amber tokens');
  const empty = rules.find((rule) => rule.startsWith('.profile-empty-value'));
  assert.ok(empty && empty.includes('var(--muted)'), 'the empty-value dash must read the muted token');
  // No new hex: every hex in the new rules already exists elsewhere
  // in the sheet (the Phase A pattern).
  const stripped = styles.replace(/\.profile-service-status-vacation[^{]*\{[^}]*\}|\.profile-empty-value\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((hex) => hex.toLowerCase()));
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex ${hex} in ${rule.slice(0, 60)}`);
    }
  }
});

// ------------------------------------------------------------ pins (true on the pristine base too)

// The prose sections render "Not recorded" inside sentence templates,
// not info-group rows — Req 3 does not cover them, and Phase B does
// not rewrite them. The boundary is pinned so a later phase cannot
// silently change sentence wording while dashing the rows.

test('pin: prose sections keep their sentence wording (optical / pole / feeder / custody)', () => {
  const app = read('app.js');
  assert.ok(app.includes("t('prof_optical_box'"), 'optical section keeps its sentence template');
  assert.ok(app.includes("t('prof_pole_number'"), 'pole section keeps its sentence template');
  assert.ok(app.includes("t('prof_feeder_fed_by'"), 'feeder section keeps its sentence template');
  assert.ok(app.includes("t('prof_custody_router'"), 'custody section keeps its sentence template');
  for (const template of ['prof_optical_box', 'prof_pole_number', 'prof_feeder_fed_by', 'prof_custody_router']) {
    assert.ok(app.includes(`t('${template}'`), `${template} must still render through its sentence key`);
  }
});

test('pin: the current-bill summary keeps its computed-figure wording (Phase D territory)', () => {
  const app = read('app.js');
  const start = app.indexOf('customerCurrentBillSummary');
  assert.notEqual(start, -1, 'the current-bill summary must exist');
  const summary = app.slice(start, start + 800);
  assert.ok(summary.includes("t('prof_not_set')"), 'billAmount / net-due are computed figures — they keep Not set in Phase B');
});

test('pin: the edit-form profit preview keeps Not set (the form is not the view)', () => {
  const app = read('app.js');
  const start = app.indexOf('function renderProfileMarginPreview() {');
  assert.notEqual(start, -1, 'renderProfileMarginPreview must exist');
  const end = app.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'renderProfileMarginPreview must end cleanly');
  const fn = app.slice(start, end + 3);
  assert.ok(fn.includes("t('prof_not_set')"), 'the form preview keeps Not set — Req 3 dashes the view only');
});

test('pin: the print card and the header strip keep their wording (they are not the view)', () => {
  assert.ok(read('profile-print-card.js').includes('Not set'), 'the print card keeps Not set');
  assert.ok(read('profile-header-strip.js').includes('Not set'), 'the header strip keeps Not set');
  assert.ok(read('profile-header-strip.js').includes('Not recorded'), 'the header strip keeps Not recorded');
});

test('pin: the shared money formatters keep their literal Not set fallback', () => {
  assert.ok(read('core.js').includes("return 'Not set'"), 'formatPKR keeps its literal fallback for callers outside the profile view');
  assert.ok(read('package-sales-tax.js').includes("return 'Not set'"), 'formatSalesTaxAmount keeps its literal fallback for callers outside the profile view');
});
