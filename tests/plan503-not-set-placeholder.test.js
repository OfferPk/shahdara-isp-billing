import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 503 — "Not set" stops posing as placeholder text:
// data-i18n-placeholder="prof_not_set" put the literal words "Not
// set" inside editable profile-form inputs, where grey placeholder
// text looks like a value — worst on number inputs, where "Not set"
// sits where a figure belongs. The fix: every profile-form field
// gets either an example placeholder ("e.g. …", wired through a
// dedicated *_ph i18n key, EN + UR together) or no placeholder at
// all, so an empty field looks empty. "Not set" stays exactly where
// it belongs: the view's empty-state text (prof_not_set).
//
// Boundaries, stated plainly:
// - The monthly selling amount keeps its own placeholder
//   ("Not set — excluded from dues", prof_form_selling_ph): it is
//   an instruction about dues exclusion, not the bare empty-state
//   text, and tests/deployment.test.js pins the string. Plan 503's
//   Problem names only data-i18n-placeholder="prof_not_set".
// - The incident note (incidentNoteInput) lives in the separate
//   incident form, and the inventory unit cost (inventoryUnitCost)
//   lives in the inventory form — neither is the profile form, so
//   neither is touched here. A future plan can take those two.
// - Password fields (PPPoE, Wi-Fi, router admin) are left with no
//   placeholder on purpose: a password must never carry an example.

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function fieldTag(form, id) {
  const re = new RegExp(`<(?:input|textarea)[^>]*id="${id}"[^>]*>`);
  const match = form.match(re);
  assert.ok(match, `field ${id} must exist in the profile form`);
  return match[0];
}

// Fields that get an example placeholder: id, i18n key, EN value, UR value.
const EXAMPLES = [
  { id: 'seasonalRateInput', key: 'prof_form_seasonal_rate_ph', en: 'e.g. 800', ur: 'مثلاً: 800' },
  { id: 'seasonalRestoreRateInput', key: 'prof_form_seasonal_restore_ph', en: 'e.g. 1500', ur: 'مثلاً: 1500' },
  { id: 'monthlyPurchaseCostInput', key: 'prof_form_purchase_cost_ph', en: 'e.g. 1200', ur: 'مثلاً: 1200' },
  { id: 'connectionFeeInput', key: 'prof_form_conn_fee_ph', en: 'e.g. 5000', ur: 'مثلاً: 5000' },
  { id: 'routerModelInput', key: 'prof_form_router_ph', en: 'e.g. TP-Link Archer C6', ur: 'مثلاً: TP-Link Archer C6' },
  { id: 'routerPriceInput', key: 'prof_form_router_price_ph', en: 'e.g. 3500', ur: 'مثلاً: 3500' },
  { id: 'fiberMetersInput', key: 'prof_form_fiber_meters_ph', en: 'e.g. 10', ur: 'مثلاً: 10' },
  { id: 'splitterBoxIdInput', key: 'prof_form_splitter_box_ph', en: 'e.g. SPL-Barrian-02', ur: 'مثلاً: SPL-Barrian-02' },
  { id: 'splitterPortInput', key: 'prof_form_splitter_port_ph', en: 'e.g. 3', ur: 'مثلاً: 3' },
  { id: 'oltPonPortInput', key: 'prof_form_pon_port_ph', en: 'e.g. PON 1/2/3', ur: 'مثلاً: PON 1/2/3' },
  { id: 'lastRxDbmInput', key: 'prof_form_rx_ph', en: 'e.g. -19.4', ur: 'مثلاً: -19.4' },
  { id: 'poleNumberInput', key: 'prof_form_pole_ph', en: 'e.g. Pole #14 near Masjid Bilal', ur: 'مثلاً: مسجد بلال کے قریب کھمبا #14' },
  { id: 'boxLocationNoteInput', key: 'prof_form_box_location_ph', en: 'e.g. 2nd Floor White Gate', ur: 'مثلاً: دوسری منزل سفید گیٹ' },
  { id: 'dropWireCoreColorInput', key: 'prof_form_drop_wire_ph', en: 'e.g. Blue/Orange', ur: 'مثلاً: نیلا / نارنجی' },
  { id: 'mediaConverterCostInput', key: 'prof_form_mc_cost_ph', en: 'e.g. 1500', ur: 'مثلاً: 1500' },
  { id: 'linemanInstallFeeInput', key: 'prof_form_lineman_fee_ph', en: 'e.g. 500', ur: 'مثلاً: 500' },
  { id: 'fiberPerMeterRateInput', key: 'prof_form_fiber_rate_ph', en: 'e.g. 25', ur: 'مثلاً: 25' },
  { id: 'pppoeUsernameInput', key: 'prof_form_pppoe_user_ph', en: 'e.g. shahdara-042', ur: 'مثلاً: shahdara-042' },
  { id: 'staticIpInput', key: 'prof_form_static_ip_ph', en: 'e.g. 192.168.1.10', ur: 'مثلاً: 192.168.1.10' },
  { id: 'macAddressInput', key: 'prof_form_mac_ph', en: 'e.g. AA:BB:CC:11:22:33', ur: 'مثلاً: AA:BB:CC:11:22:33' },
  { id: 'wifiSsidInput', key: 'rcred_form_ssid_ph', en: 'e.g. ShahdaraFiber-5G', ur: 'مثلاً: ShahdaraFiber-5G' },
  { id: 'routerAdminPortInput', key: 'rcred_form_admin_port_ph', en: 'e.g. 8080', ur: 'مثلاً: 8080' },
  { id: 'serialNumberInput', key: 'prof_form_serial_ph', en: 'e.g. SN-2026-0042', ur: 'مثلاً: SN-2026-0042' },
  { id: 'securityDepositInput', key: 'prof_form_deposit_ph', en: 'e.g. 2000', ur: 'مثلاً: 2000' },
];

// Fields left with no placeholder at all: names, free text with a
// datalist, and passwords (which must never carry an example).
const EMPTY_IDS = [
  'mohallaInput',
  'zoneInput',
  'fatherOrReferenceNameInput',
  'addressInput',
  'customerNotesInput',
  'ispProviderInput',
  'packageSpeedInput',
  'installedByLinemanInput',
  'pppoePasswordInput',
  'wifiPasswordInput',
  'routerAdminPasswordInput',
  'landlordOrGuarantorNameInput',
  'landlordPhoneInput',
  'packageChangeStaffNameInput',
];

// ------------------------------------------------------------ the rule itself

test('Plan 503: the rule is written down as a comment inside the profile form', () => {
  const form = formHtml();
  assert.ok(form.includes('Plan 503'), 'rule comment must sit inside the profile form');
  assert.ok(form.includes('never a placeholder'), 'rule must say Not set is never a placeholder');
});

// ------------------------------------------------------------ no "Not set" placeholder left

test('Plan 503: no profile-form field uses prof_not_set as its placeholder', () => {
  const form = formHtml();
  assert.ok(!form.includes('data-i18n-placeholder="prof_not_set"'), 'prof_not_set must not wire any form placeholder');
});

test('Plan 503: no profile-form field shows the bare words "Not set" as placeholder', () => {
  const form = formHtml();
  assert.ok(!form.includes('placeholder="Not set"'), 'no field may carry the bare "Not set" placeholder');
});

// ------------------------------------------------------------ example placeholders

test('Plan 503: every example placeholder key exists in English and Urdu', () => {
  for (const { key, en, ur } of EXAMPLES) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.equal(TRANSLATIONS.en[key], en, `en value wrong for ${key}`);
    assert.equal(TRANSLATIONS.ur[key], ur, `ur value wrong for ${key}`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur value for ${key} must carry Urdu script`);
  }
});

test('Plan 503: every example field is wired to its key with the English fallback', () => {
  const form = formHtml();
  for (const { id, key, en } of EXAMPLES) {
    const tag = fieldTag(form, id);
    assert.ok(tag.includes(`data-i18n-placeholder="${key}"`), `${id} must wire ${key}`);
    assert.ok(tag.includes(`placeholder="${en}"`), `${id} must fall back to "${en}"`);
  }
});

// ------------------------------------------------------------ empty placeholders

test('Plan 503: name, free-text and password fields carry no placeholder at all', () => {
  const form = formHtml();
  for (const id of EMPTY_IDS) {
    const tag = fieldTag(form, id);
    assert.ok(!tag.includes('placeholder'), `${id} must have no placeholder attribute`);
  }
});

// ------------------------------------------------------------ the view is untouched
//
// Polish #28 Phase B (Req 3) — the view's empty-state text is now
// the em dash, not "Not set": the three rows below pin the dash
// instead. The key itself stays (the print card, the header strip
// and the form still read it), and no form field may use it as a
// placeholder — that is what this plan guards.

test('Plan 503: the view still shows the dash for the same fields', () => {
  assert.equal(TRANSLATIONS.en.prof_not_set, 'Not set');
  const app = read('app.js');
  // Polish #28 Phase A — the four-groups literal became the eight
  // fragments object (profileInfoGroupFragments); the view pin follows
  // the new name, rows verbatim.
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  const groups = app.slice(start, app.indexOf('\n', start));
  assert.ok(groups.includes("profileEmptyText(customer.routerModel)"), 'router model must still read the dash in the view');
  assert.ok(groups.includes("customer.fiberMeters === null || customer.fiberMeters === undefined || customer.fiberMeters === '' ? PROFILE_EMPTY_DASH"), 'fiber meters must still read the dash in the view');
  assert.ok(groups.includes("customer.fiberPerMeterRate === null || customer.fiberPerMeterRate === undefined || customer.fiberPerMeterRate === '' ? PROFILE_EMPTY_DASH"), 'fiber rate must still read the dash in the view');
});

test('Plan 503: the selling-amount placeholder keeps its dues-exclusion instruction', () => {
  // Pinned by tests/deployment.test.js too: "Not set — excluded from
  // dues" is an instruction about what a blank amount means, not the
  // bare empty-state text this plan removes.
  assert.equal(TRANSLATIONS.en.prof_form_selling_ph, 'Not set — excluded from dues');
  const form = formHtml();
  const tag = fieldTag(form, 'monthlySellingAmountInput');
  assert.ok(tag.includes('data-i18n-placeholder="prof_form_selling_ph"'), 'selling amount must keep its own placeholder key');
});
