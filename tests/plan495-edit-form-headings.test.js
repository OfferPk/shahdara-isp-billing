import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 495 — the edit form groups its fields under the view's section
// headings, using the view's own i18n keys and heading level. Save paths
// unchanged.
// Plan 496 reordered the fields into the view's group order — the exact
// order pinned below is the Plan 496 order, not the Plan 495 order.
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
//   under a heading. There are no ungrouped fields left, and the old
//   prof_group_* headings appear nowhere in the form (the keys still
//   exist in the dictionaries — the view info groups still use them).
// - Polish #28 Phase D (2026-11-10) added the 70th field:
//   otherInstallCost in S4 (Connection), after linemanInstallFee.
// - Within each section the Plan 496 relative order is preserved: the
//   only moves are the tail runs joining their sections (residence +
//   landlord into S1, expiry/cancellation + staff name into S2,
//   security deposit + feeder credit into S3, install-fee fields into
//   S4, router/ownership/serial into S6) and the money fields
//   (purchase cost, selling amount) joining S3.

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

// The view's section order (app.js profileDetailSectionHtml calls):
// Customer, Service, Financial, Connection, Network, Hardware. History
// (S7) has no form group — Table A gives it zero fields.
test('plan 495: form shows the six view headings, first in view order', () => {
  const sections = parseSections(formHtml());
  assert.equal(sections.length, 6, 'six sections: one per editable view section S1–S6');
  assert.deepEqual(
    sections.map((s) => s.key),
    ['customer', 'service', 'financial', 'connection', 'network', 'hardware'],
    'first occurrences must follow the view order Customer, Service, Financial, Connection, Network, Hardware',
  );
  assert.deepEqual(
    sections.map((s) => s.headingKey),
    ['prof_sec_customer', 'prof_sec_service', 'prof_sec_financial', 'prof_sec_connection', 'prof_sec_network', 'prof_sec_hardware'],
    'each section must reuse its view section heading key',
  );
});

test('plan 495: every field sits under its own section heading', () => {
  const sections = parseSections(formHtml());
  const byField = new Map();
  for (const s of sections) for (const f of s.fields) byField.set(f, s.key);
  const expected = {
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
  for (const [group, fields] of Object.entries(expected)) {
    for (const f of fields) {
      assert.equal(byField.get(f), group, `${f} must sit under the ${group} heading`);
    }
  }
});

// Phase C: the old "ungrouped fields stay outside every section" test
// is inverted — the identity block and the tail runs now sit INSIDE
// their sections, so no field may sit outside a heading at all.
test('plan 495: no field sits outside a section heading any more', () => {
  const sections = parseSections(formHtml());
  const grouped = new Set(sections.flatMap((s) => s.fields));
  assert.equal(grouped.size, 70, 'all 70 fields grouped, none twice (Phase D added otherInstallCost)');
  const all = fieldOrder(formHtml());
  assert.equal(all.length, 70, 'the form still holds exactly 70 fields');
  for (const f of all) {
    assert.ok(grouped.has(f), `${f} must sit under a section heading`);
  }
});

// Plan 496 reordered the fields into the view's section order: the
// view-pinned fields sit in the view's relative order inside each
// section (phone before CNIC before father before aliases; seasonal
// before package; expiry/cancellation at the end of S2), the identity
// block stays first (polish #12), and the last field overall is now
// the serial number in S6 — the old "staff name stays the last field"
// pin is false under Phase C (staff name ends S2). Save paths
// unchanged — only positions moved, no field markup, id or save
// mapping changed.
test('plan 496: field order matches the view order', () => {
  assert.deepEqual(fieldOrder(formHtml()), [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
    'phoneInput', 'cnicInput', 'fatherOrReferenceNameInput', 'searchAliasesInput',
    'whatsappPhoneInput', 'alternatePhoneInput', 'prefersSmsCheckbox',
    'preferredReceiptLangSelect', 'preferredReceiptChannelSelect',
    'addressInput', 'customerNotesInput',
    'residenceTypeInput', 'landlordOrGuarantorNameInput', 'landlordPhoneInput',
    'ispProviderInput', 'serviceStatusInput', 'preferredVisitWindowInput', 'connectionTypeInput',
    'pauseBillingCheckbox', 'pauseStartDateInput', 'autoResumeDateInput',
    'doNotSuspendUntilInput', 'doNotSuspendReasonInput',
    'seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput',
    'packageSpeedInput', 'expiryDateInput', 'cancellationDateInput',
    'packageChangeStaffNameInput',
    'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
    'securityDepositInput', 'feederHostCreditInput',
    'connectionDateInput', 'connectionFeeInput', 'fiberMetersInput',
    'linemanInstallFeeInput', 'otherInstallCostInput', 'installedByLinemanInput', 'fiberPerMeterRateInput',
    'splitterBoxIdInput', 'splitterPortInput', 'oltPonPortInput', 'lastRxDbmInput',
    'onuConnectorTypeInput', 'converterSideInput', 'poleNumberInput', 'boxLocationNoteInput',
    'dropWireCoreColorInput', 'pppoeUsernameInput', 'pppoePasswordInput', 'staticIpInput',
    'macAddressInput', 'wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput',
    'routerAdminPasswordInput', 'upstreamCustomerInput', 'fiberZoneInput',
    'routerModelInput', 'routerPriceInput', 'mediaConverterCostInput',
    'routerOwnershipInput', 'mediaConverterOwnershipInput', 'serialNumberInput',
  ]);
});

test('plan 495: headings reuse the view heading level, keys and styling', () => {
  const form = formHtml();
  const headingTags = [...form.matchAll(/<h4[^>]*data-i18n="(prof_sec_[a-z]+)"[^>]*>([^<]+)<\/h4>/g)];
  assert.equal(headingTags.length, 6, 'six h4 headings, one per section');
  for (const [tag, key] of headingTags) {
    assert.ok(
      ['prof_sec_customer', 'prof_sec_service', 'prof_sec_financial', 'prof_sec_connection', 'prof_sec_network', 'prof_sec_hardware'].includes(key),
      `heading must reuse a view section key, got ${key}`,
    );
    assert.ok(!tag.includes('id='), 'headings carry no new element id');
  }
  // The keys already exist with English + Urdu values (no new i18n keys).
  const lang = read('nav-language.js');
  for (const [key, en, ur] of [
    ['prof_sec_customer', 'Customer Information', 'کسٹمر کی معلومات'],
    ['prof_sec_service', 'Service & Package', 'سروس اور پیکج'],
    ['prof_sec_financial', 'Financial Details', 'مالی تفصیلات'],
    ['prof_sec_connection', 'Connection & Installation', 'کنکشن اور انسٹالیشن'],
    ['prof_sec_network', 'Network Configuration', 'نیٹ ورک کنفیگریشن'],
    ['prof_sec_hardware', 'Hardware & Equipment', 'ہارڈویئر اور آلات'],
  ]) {
    assert.ok(lang.includes(`${key}: '${en}'`), `${key} must keep its English value`);
    assert.ok(lang.includes(`${key}: '${ur}'`), `${key} must keep its Urdu value`);
  }
  // The view renders its group headings as h4 inside .profile-info-group
  // (app.js profileInfoGroupMarkup); the form sections reuse that class,
  // so the heading treatment is identical and no new colour is introduced.
  const appJs = read('app.js');
  assert.ok(
    appJs.includes('<section class="profile-info-group"><h4>'),
    'view group markup must stay section + h4',
  );
  const styles = read('styles.css');
  assert.ok(styles.includes('.profile-info-group h4'), 'view group h4 rule must exist for reuse');
  assert.ok(
    form.includes('<section class="profile-form-group profile-info-group" data-profile-form-section="'),
    'form sections must carry the view group class plus their section key',
  );
  const css = read('profile-ui.css');
  assert.ok(css.includes('.profile-form-group{grid-column:1/-1'), 'group sections must span the full form grid');
  const plan495Rule = css.slice(css.indexOf('/* Plan 495'));
  assert.ok(plan495Rule.length > 0, 'Plan 495 CSS must be present');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(plan495Rule), 'Plan 495 CSS must introduce no hex colour');
});
