import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 496 — the edit form's field order matches the view's section
// order. Field markup, ids and save paths are unchanged — only
// positions moved.
//
// Polish #28 Phase C (2026-11-10) regrouped the form AGAIN, and this
// file was rewritten with it — the old structure it pinned is gone, and
// the why is recorded here so nobody "fixes" it back:
// - The old form had FOUR groups (Contact / Location / Service /
//   Connection, prof_group_* keys) with 11 fields sitting OUTSIDE any
//   group (the identity block, the feed/occupancy/staff tail runs).
// - Phase C needs one scroll target per VIEW section, so the form now
//   has SIX groups (S1–S6, prof_sec_* keys — the same headings the
//   profile view sections carry), and EVERY one of the 70 fields sits
//   under a heading. The old prof_group_* headings appear nowhere in
//   the form (the keys still exist — the view info groups use them).
// - Polish #28 Phase D (2026-11-10) added the 70th field:
//   otherInstallCost in S4 (Connection), after linemanInstallFee —
//   an optional install cost that fits none of the named components.
//   The counts below moved 69 → 70 for exactly that one field.
// - Within each section the Plan 496 relative order is preserved: the
//   only moves are the tail runs joining their sections (residence +
//   landlord into S1, expiry/cancellation + staff name into S2,
//   security deposit + feeder credit into S3, install-fee fields into
//   S4, router/ownership/serial into S6) and the money fields
//   (purchase cost, selling amount) joining S3.
// - Two old pins are now FALSE and are deliberately gone: "staff name
//   stays the last field" (the serial number in S6 is last now) and
//   "ungrouped runs follow the groups" (there are no ungrouped fields
//   left). "Expiry/cancellation end Connection" moved with the fields:
//   they end S2 now.

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function parseSections(form) {
  const sections = [...form.matchAll(/<section class="profile-form-group profile-info-group" data-profile-form-section="([^"]+)"><h4 data-i18n="([^"]+)">[^<]*<\/h4><div class="profile-grid">([\s\S]*?)<\/div><\/section>/g)];
  return sections.map(([, key, headingKey, body]) => ({
    key,
    headingKey,
    fields: [...body.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]),
  }));
}

function fieldOrder(form) {
  return [...form.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]);
}

// The view-pinned field sequences, in the view's relative order, one
// list per view section. A field's form position must match its view
// position: every earlier view field must come before every later one
// in the form.
const VIEW_PINNED = {
  customer: [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
    'phoneInput', 'cnicInput', 'fatherOrReferenceNameInput', 'searchAliasesInput',
    'whatsappPhoneInput', 'alternatePhoneInput', 'prefersSmsCheckbox',
    'preferredReceiptLangSelect', 'preferredReceiptChannelSelect',
    'addressInput', 'customerNotesInput',
    'residenceTypeInput', 'landlordOrGuarantorNameInput', 'landlordPhoneInput',
  ],
  service: [
    'ispProviderInput', 'serviceStatusInput', 'preferredVisitWindowInput', 'connectionTypeInput',
    'pauseBillingCheckbox', 'pauseStartDateInput', 'autoResumeDateInput',
    'doNotSuspendUntilInput', 'doNotSuspendReasonInput',
    'seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput',
    'packageSpeedInput', 'expiryDateInput', 'cancellationDateInput',
    'packageChangeStaffNameInput',
  ],
  financial: [
    'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
    'securityDepositInput', 'feederHostCreditInput',
  ],
  connection: [
    'connectionDateInput', 'connectionFeeInput', 'fiberMetersInput',
    'linemanInstallFeeInput', 'otherInstallCostInput', 'installedByLinemanInput', 'fiberPerMeterRateInput',
  ],
  network: [
    'splitterBoxIdInput', 'splitterPortInput', 'oltPonPortInput', 'lastRxDbmInput',
    'onuConnectorTypeInput', 'converterSideInput', 'poleNumberInput', 'boxLocationNoteInput',
    'dropWireCoreColorInput', 'pppoeUsernameInput', 'pppoePasswordInput', 'staticIpInput',
    'macAddressInput', 'wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput',
    'routerAdminPasswordInput', 'upstreamCustomerInput', 'fiberZoneInput',
  ],
  hardware: [
    'routerModelInput', 'routerPriceInput', 'mediaConverterCostInput',
    'routerOwnershipInput', 'mediaConverterOwnershipInput', 'serialNumberInput',
  ],
};

test('plan 496: identity block first, Area+Zone directly after Customer name', () => {
  const order = fieldOrder(formHtml());
  assert.deepEqual(order.slice(0, 4), [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
  ], 'name, Area, Zone, Urdu name stay first (polish #12)');
});

test('plan 496: one section per view section, in the view order', () => {
  const sections = parseSections(formHtml());
  assert.deepEqual(
    sections.map((s) => s.key),
    ['customer', 'service', 'financial', 'connection', 'network', 'hardware'],
    'exactly one section per editable view section S1–S6, in view order — History (S7) has no form group',
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

test('plan 496: each section holds all its fields, nothing split', () => {
  const sections = parseSections(formHtml());
  const byKey = new Map(sections.map((s) => [s.key, s.fields]));
  // The old Contact/Connection runs are split across the new sections
  // now (Contact across S1, Connection across S4/S5/S6); each section
  // holds its whole Table A list in one run.
  assert.equal(byKey.get('customer').length, 18, 'all 18 Customer fields in one section');
  assert.equal(byKey.get('service').length, 16, 'all 16 Service fields in one section');
  assert.equal(byKey.get('financial').length, 4, 'all 4 Financial fields in one section');
  assert.equal(byKey.get('connection').length, 7, 'all 7 Connection fields in one section (Phase D added otherInstallCost)');
  assert.equal(byKey.get('network').length, 19, 'all 19 Network fields in one section');
  assert.equal(byKey.get('hardware').length, 6, 'all 6 Hardware fields in one section');
});

test('plan 496: seasonal sits before package, expiry/cancellation end S2', () => {
  const order = fieldOrder(formHtml());
  const at = (id) => order.indexOf(id);
  assert.ok(at('seasonalRestoreRateInput') < at('packageSpeedInput'), 'seasonal run must precede the package field');
  assert.ok(at('packageSpeedInput') < at('monthlyPurchaseCostInput'), 'package must precede the purchase cost');
  assert.ok(at('monthlyPurchaseCostInput') < at('monthlySellingAmountInput'), 'purchase cost must precede the selling amount');
  const service = parseSections(formHtml()).find((s) => s.key === 'service').fields;
  assert.deepEqual(service.slice(-2), ['cancellationDateInput', 'packageChangeStaffNameInput'], 'cancellation + staff name close the Service section');
  assert.deepEqual(service.slice(-3, -1), ['expiryDateInput', 'cancellationDateInput'], 'expiry/cancellation close the lifecycle run at the end of S2');
});

// Phase C: the old "ungrouped runs follow the groups" test is gone —
// the feeder, occupancy and staff runs now sit INSIDE their sections,
// so no field may sit outside a heading at all. The serial number in
// S6 is the last field overall (the old "staff name stays last" pin
// is false under Phase C: staff name ends S2).
test('plan 496: no ungrouped fields remain — the serial number is last', () => {
  const order = fieldOrder(formHtml());
  const at = (id) => order.indexOf(id);
  const grouped = parseSections(formHtml()).flatMap((s) => s.fields);
  assert.equal(grouped.length, 70, 'all 70 fields grouped (Phase D added otherInstallCost)');
  for (const f of order) {
    assert.ok(grouped.includes(f), `${f} must sit under a section heading`);
  }
  assert.equal(at('serialNumberInput'), order.length - 1, 'serial number (S6) is the last field overall');
  assert.ok(at('packageChangeStaffNameInput') < at('monthlyPurchaseCostInput'), 'staff name ends S2, before the Financial section');
});

test('plan 496: no field lost, duplicated or re-marked up', () => {
  const order = fieldOrder(formHtml());
  assert.equal(order.length, 70, 'still 70 fields (Phase D added otherInstallCost)');
  assert.equal(new Set(order).size, 70, 'no duplicate field ids');
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
