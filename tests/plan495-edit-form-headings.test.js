import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

// Plan 495 — the edit form groups its fields under the view's four section
// headings (Contact / Location / Service / Connection), using the view's
// own i18n keys and heading level. No field order or save-path change.

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

// The view's group order (app.js profileInfoGroupsHtml): Contact, Location,
// Service, Connection. The form's field order interleaves the groups (the
// name + Area/Zone block sits first by polish #12, the phone run comes
// after the address run), so a group may appear as more than one run —
// but the four heading names must first appear in the view's order.
test('plan 495: form shows the four view headings, first in view order', () => {
  const sections = parseSections(formHtml());
  assert.equal(sections.length, 6, 'six group runs: Contact x2, Location, Service, Connection x2');
  const firstSeen = [...new Set(sections.map((s) => s.key))];
  assert.deepEqual(
    firstSeen,
    ['prof_group_contact', 'prof_group_location', 'prof_group_service', 'prof_group_connection'],
    'first occurrences must follow the view order Contact, Location, Service, Connection',
  );
});

test('plan 495: every view-grouped field sits under its own group heading', () => {
  const sections = parseSections(formHtml());
  const byField = new Map();
  for (const s of sections) for (const f of s.fields) byField.set(f, s.key);
  const expected = {
    prof_group_contact: [
      'fatherOrReferenceNameInput', 'searchAliasesInput',
      'phoneInput', 'whatsappPhoneInput', 'alternatePhoneInput', 'prefersSmsCheckbox',
      'preferredReceiptLangSelect', 'preferredReceiptChannelSelect', 'cnicInput',
    ],
    prof_group_location: ['addressInput', 'customerNotesInput'],
    prof_group_service: [
      'ispProviderInput', 'serviceStatusInput', 'preferredVisitWindowInput', 'connectionTypeInput',
      'pauseBillingCheckbox', 'pauseStartDateInput', 'autoResumeDateInput',
      'doNotSuspendUntilInput', 'doNotSuspendReasonInput', 'packageSpeedInput',
      'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
      'seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput',
    ],
    prof_group_connection: [
      'connectionDateInput', 'connectionFeeInput', 'routerModelInput', 'routerPriceInput',
      'fiberMetersInput', 'splitterBoxIdInput', 'splitterPortInput', 'oltPonPortInput',
      'lastRxDbmInput', 'onuConnectorTypeInput', 'converterSideInput', 'poleNumberInput',
      'boxLocationNoteInput', 'dropWireCoreColorInput', 'mediaConverterCostInput',
      'linemanInstallFeeInput', 'installedByLinemanInput', 'fiberPerMeterRateInput',
      'pppoeUsernameInput', 'pppoePasswordInput', 'staticIpInput', 'macAddressInput',
      'wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput', 'routerAdminPasswordInput',
      'routerOwnershipInput', 'mediaConverterOwnershipInput', 'serialNumberInput',
      'securityDepositInput', 'expiryDateInput', 'cancellationDateInput',
    ],
  };
  for (const [group, fields] of Object.entries(expected)) {
    for (const f of fields) {
      assert.equal(byField.get(f), group, `${f} must sit under the ${group} heading`);
    }
  }
});

// Fields with no view group are never mislabelled: the identity block
// (name + Area/Zone, placed first by polish #12 for fast filling) and the
// feed / occupancy / staff runs stay outside every section.
test('plan 495: ungrouped fields stay outside every section', () => {
  const sections = parseSections(formHtml());
  const grouped = new Set(sections.flatMap((s) => s.fields));
  const ungrouped = [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
    'upstreamCustomerInput', 'fiberZoneInput', 'feederHostCreditInput',
    'residenceTypeInput', 'landlordOrGuarantorNameInput', 'landlordPhoneInput',
    'packageChangeStaffNameInput',
  ];
  for (const f of ungrouped) {
    assert.ok(!grouped.has(f), `${f} has no view group and must not sit under a heading`);
    assert.ok(fieldOrder(formHtml()).includes(f), `${f} must still be in the form`);
  }
  assert.equal(grouped.size + ungrouped.length, 69, 'grouped + ungrouped must cover all 69 fields');
});

test('plan 495: no field order or save-path change', () => {
  assert.deepEqual(fieldOrder(formHtml()), [
    'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
    'fatherOrReferenceNameInput', 'searchAliasesInput',
    'upstreamCustomerInput', 'fiberZoneInput', 'feederHostCreditInput',
    'addressInput', 'customerNotesInput',
    'phoneInput', 'whatsappPhoneInput', 'alternatePhoneInput', 'prefersSmsCheckbox',
    'preferredReceiptLangSelect', 'preferredReceiptChannelSelect', 'cnicInput',
    'ispProviderInput', 'serviceStatusInput', 'preferredVisitWindowInput', 'connectionTypeInput',
    'pauseBillingCheckbox', 'pauseStartDateInput', 'autoResumeDateInput',
    'doNotSuspendUntilInput', 'doNotSuspendReasonInput', 'packageSpeedInput',
    'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
    'seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput',
    'connectionDateInput', 'connectionFeeInput', 'routerModelInput', 'routerPriceInput',
    'fiberMetersInput', 'splitterBoxIdInput', 'splitterPortInput', 'oltPonPortInput',
    'lastRxDbmInput', 'onuConnectorTypeInput', 'converterSideInput', 'poleNumberInput',
    'boxLocationNoteInput', 'dropWireCoreColorInput', 'mediaConverterCostInput',
    'linemanInstallFeeInput', 'installedByLinemanInput', 'fiberPerMeterRateInput',
    'pppoeUsernameInput', 'pppoePasswordInput', 'staticIpInput', 'macAddressInput',
    'wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput', 'routerAdminPasswordInput',
    'routerOwnershipInput', 'mediaConverterOwnershipInput', 'serialNumberInput',
    'securityDepositInput', 'residenceTypeInput', 'landlordOrGuarantorNameInput',
    'landlordPhoneInput', 'expiryDateInput', 'cancellationDateInput',
    'packageChangeStaffNameInput',
  ]);
});

test('plan 495: headings reuse the view heading level, keys and styling', () => {
  const form = formHtml();
  const headingTags = [...form.matchAll(/<h4[^>]*data-i18n="(prof_group_[a-z]+)"[^>]*>([^<]+)<\/h4>/g)];
  assert.equal(headingTags.length, 6, 'six h4 headings, one per group run');
  for (const [tag, key] of headingTags) {
    assert.ok(
      ['prof_group_contact', 'prof_group_location', 'prof_group_service', 'prof_group_connection'].includes(key),
      `heading must reuse a view group key, got ${key}`,
    );
    assert.ok(!tag.includes('id='), 'headings carry no new element id');
  }
  // The keys already exist with English + Urdu values (no new i18n keys).
  const lang = read('nav-language.js');
  for (const [key, en, ur] of [
    ['prof_group_contact', 'Contact', 'رابطہ'],
    ['prof_group_location', 'Location', 'مقام'],
    ['prof_group_service', 'Service', 'سروس'],
    ['prof_group_connection', 'Connection', 'کنکشن'],
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
    form.includes('<section class="profile-form-group profile-info-group">'),
    'form sections must carry the view group class',
  );
  const css = read('profile-ui.css');
  assert.ok(css.includes('.profile-form-group{grid-column:1/-1'), 'group sections must span the full form grid');
  const plan495Rule = css.slice(css.indexOf('/* Plan 495'));
  assert.ok(plan495Rule.length > 0, 'Plan 495 CSS must be present');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(plan495Rule), 'Plan 495 CSS must introduce no hex colour');
});
