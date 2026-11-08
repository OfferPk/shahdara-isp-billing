import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 496 — the edit form's field order matches the view's group order
// (app.js:6243 profileInfoGroupsHtml): Contact (phone, CNIC, father,
// aliases) → Location (area, zone, address, notes) → Service (ISP, service
// status, hold, shield, seasonal, package, purchase cost, selling) →
// Connection (start, fee, router, router price, fiber, media-converter
// cost, lineman fee, fiber rate, PPPoE, static IP, MAC, expiry,
// cancellation). Area+Zone stay directly after Customer name (polish #12).
// Field markup, ids and save paths are unchanged — only positions moved.

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function parseSections(form) {
  const sections = [...form.matchAll(/<section class="profile-form-group profile-info-group"><h4 data-i18n="([^"]+)">[^<]*<\/h4><div class="profile-grid">([\s\S]*?)<\/div><\/section>/g)];
  return sections.map(([, key, body]) => ({
    key,
    fields: [...body.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]),
  }));
}

function fieldOrder(form) {
  return [...form.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]);
}

// The view-pinned field sequences, in the view's relative order
// (app.js:6243). A field's form position must match its view position:
// every earlier view field must come before every later one in the form.
const VIEW_PINNED = {
  prof_group_contact: ['phoneInput', 'cnicInput', 'fatherOrReferenceNameInput', 'searchAliasesInput'],
  prof_group_location: ['addressInput', 'customerNotesInput'],
  prof_group_service: [
    'ispProviderInput', 'serviceStatusInput',
    'pauseBillingCheckbox', 'doNotSuspendUntilInput',
    'seasonalRateInput', 'packageSpeedInput',
    'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
  ],
  prof_group_connection: [
    'connectionDateInput', 'connectionFeeInput', 'routerModelInput', 'routerPriceInput',
    'fiberMetersInput', 'mediaConverterCostInput', 'linemanInstallFeeInput',
    'fiberPerMeterRateInput', 'pppoeUsernameInput', 'staticIpInput', 'macAddressInput',
    'expiryDateInput', 'cancellationDateInput',
  ],
};

test('plan 496: identity block first, Area+Zone directly after Customer name', () => {
  const order = fieldOrder(formHtml());
  assert.deepEqual(order.slice(0, 4), [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
  ], 'name, Area, Zone, Urdu name stay first (polish #12)');
});

test('plan 496: one section per view group, in the view order', () => {
  const sections = parseSections(formHtml());
  assert.deepEqual(
    sections.map((s) => s.key),
    ['prof_group_contact', 'prof_group_location', 'prof_group_service', 'prof_group_connection'],
    'exactly one Contact, Location, Service and Connection section, in view order',
  );
});

test('plan 496: every view-pinned field keeps the view relative order', () => {
  const order = fieldOrder(formHtml());
  const at = (id) => order.indexOf(id);
  for (const [group, fields] of Object.entries(VIEW_PINNED)) {
    for (let i = 0; i < fields.length; i++) {
      assert.notEqual(at(fields[i]), -1, `${fields[i]} must be in the form`);
      for (let j = i + 1; j < fields.length; j++) {
        assert.ok(
          at(fields[i]) < at(fields[j]),
          `${group}: ${fields[i]} must come before ${fields[j]} (view order)`,
        );
      }
    }
  }
});

test('plan 496: merged runs hold all their group fields, nothing split', () => {
  const sections = parseSections(formHtml());
  const byKey = new Map(sections.map((s) => [s.key, s.fields]));
  // Contact was two runs (father/aliases, then the phone run); Connection
  // was two runs (install run, then expiry/cancellation). Both are one run now.
  assert.equal(byKey.get('prof_group_contact').length, 9, 'all 9 Contact fields in one section');
  assert.equal(byKey.get('prof_group_location').length, 2, 'both Location fields in one section');
  assert.equal(byKey.get('prof_group_service').length, 15, 'all 15 Service fields in one section');
  assert.equal(byKey.get('prof_group_connection').length, 32, 'all 32 Connection fields in one section');
});

test('plan 496: seasonal sits before package, expiry/cancellation end Connection', () => {
  const order = fieldOrder(formHtml());
  const at = (id) => order.indexOf(id);
  assert.ok(at('seasonalRestoreRateInput') < at('packageSpeedInput'), 'seasonal run must precede the package field');
  assert.ok(at('packageSpeedInput') < at('monthlyPurchaseCostInput'), 'package must precede the purchase cost');
  assert.ok(at('monthlyPurchaseCostInput') < at('monthlySellingAmountInput'), 'purchase cost must precede the selling amount');
  const connection = parseSections(formHtml()).find((s) => s.key === 'prof_group_connection').fields;
  assert.deepEqual(connection.slice(-2), ['expiryDateInput', 'cancellationDateInput'], 'expiry/cancellation close the Connection section');
});

test('plan 496: ungrouped runs follow the groups in the view relative order', () => {
  const order = fieldOrder(formHtml());
  const at = (id) => order.indexOf(id);
  const lastGrouped = Math.max(
    ...parseSections(formHtml()).flatMap((s) => s.fields).map(at),
  );
  // In the view the feeder section and the occupancy line (inside the
  // custody section) both render after the info groups, feeder first;
  // the package-change staff name feeds the package-change section last.
  assert.ok(at('upstreamCustomerInput') > lastGrouped, 'feeder run must follow the four groups');
  assert.ok(at('feederHostCreditInput') < at('residenceTypeInput'), 'feeder run must precede the occupancy run');
  assert.ok(at('landlordPhoneInput') < at('packageChangeStaffNameInput'), 'occupancy run must precede the staff name');
  assert.equal(at('packageChangeStaffNameInput'), order.length - 1, 'staff name stays the last field');
});

test('plan 496: no field lost, duplicated or re-marked up', () => {
  const order = fieldOrder(formHtml());
  assert.equal(order.length, 69, 'still 69 fields');
  assert.equal(new Set(order).size, 69, 'no duplicate field ids');
  const form = formHtml();
  // Every field keeps its input/select/textarea and its label markup.
  for (const id of order) {
    assert.ok(form.includes(`id="${id}"`), `${id} must keep its control id`);
  }
  // Save paths are untouched: app.js still reads every field by id.
  const appJs = read('app.js');
  for (const id of order) {
    assert.ok(appJs.includes(`$('#${id}')`), `app.js must still read ${id}`);
  }
});
