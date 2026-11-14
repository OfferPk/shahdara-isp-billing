import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { profileDetailSectionHtml } from '../profile-sections.js';
import { countProfileCompletion } from '../profile-completion.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// Polish #28 Phase C — per-section Edit + copy buttons on the profile.
//
// What changes: every view section except History carries its own Edit
// button that opens the SAME full edit form scrolled to that section's
// form group (the form is regrouped into the same six groups so the
// scroll target exists — fields, order within each group and the save
// path are unchanged); Plan 499 becomes the single dirty source of
// truth (the ui-feedback.js second dirty system is retired); and the
// PPPoE username, static IP and MAC rows carry a copy button that
// copies the exact record value.
//
// History (S7) deliberately has NO Edit button: Table A gives it zero
// form fields — history is recorded by the app, never typed in — so an
// Edit button would be a dead control with no group to scroll to.

// ---------------------------------------------------------------------------
// Per-section Edit — the section shell (profile-sections.js)
// ---------------------------------------------------------------------------

test('phase C: a section with an edit label renders an Edit button in its summary', () => {
  const html = profileDetailSectionHtml({
    key: 'service',
    heading: 'Service & Package',
    summary: '5 Mbps · Active',
    body: '<p>body</p>',
    open: true,
    editLabel: 'Edit',
  });
  assert.ok(
    html.includes('<button type="button" class="profile-section-edit secondary-button" data-profile-section-edit="service">Edit</button>'),
    'the Edit button must sit in the summary with the section key on a data attribute',
  );
  assert.ok(
    html.indexOf('data-profile-section-edit="service"') > html.indexOf('<summary>'),
    'the button must be inside the summary, not the body',
  );
  assert.ok(
    html.indexOf('data-profile-section-edit="service"') < html.indexOf('</summary>'),
    'the button must be inside the summary, not the body',
  );
});

test('phase C: a section without an edit label renders no button — Phase A output is byte-identical', () => {
  // The exact string Phase A pins for a section with no edit control.
  const html = profileDetailSectionHtml({
    key: 'financial',
    heading: 'Financial Details',
    summary: 'Dues PKR 1,000 · Monthly gross profit PKR 1,800',
    body: 'x',
    open: true,
  });
  assert.ok(
    html.includes('<summary><h3>Financial Details</h3><span class="profile-section-summary">Dues PKR 1,000 · Monthly gross profit PKR 1,800</span></summary>'),
    'omitting editLabel must leave the Phase A summary output untouched',
  );
  assert.ok(!html.includes('profile-section-edit'), 'no Edit button without an edit label');
});

test('phase C: the edit label is escaped, never raw HTML', () => {
  const html = profileDetailSectionHtml({
    key: 'customer', heading: 'Customer Information', summary: '', body: 'x', open: true,
    editLabel: '<img src=x>',
  });
  assert.ok(!html.includes('<img src=x>'), 'the label must be escaped');
  assert.ok(html.includes('&lt;img src=x&gt;'), 'the escaped label must render as text');
});

// ---------------------------------------------------------------------------
// Per-section Edit — the wiring (app.js)
// ---------------------------------------------------------------------------

test('phase C: sections S1–S6 pass an edit label, S7 History does not', () => {
  const app = read('app.js');
  for (const key of ['customer', 'service', 'financial', 'connection', 'network', 'hardware']) {
    const call = app.match(new RegExp(`profileDetailSectionHtml\\(\\{ key: '${key}'[\\s\\S]*?\\}\\);`));
    assert.ok(call, `the ${key} section call must exist`);
    assert.ok(
      call[0].includes("editLabel: t('prof_view_edit')"),
      `${key} must pass the existing Edit label — the button text is the existing i18n key, not a new string`,
    );
  }
  const historyCall = app.match(/profileDetailSectionHtml\(\{ key: 'history'[\s\S]*?\}\);/);
  assert.ok(historyCall, 'the history section call must exist');
  assert.ok(
    !historyCall[0].includes('editLabel'),
    'History has zero form fields (Table A), so it must carry no Edit button — an Edit with no group to scroll to would be a dead control',
  );
});

test('phase C: section Edit clicks open the form at the section without toggling the disclosure', () => {
  const app = read('app.js');
  const wiring = app.match(/querySelectorAll\('\[data-profile-section-edit\]'\)[\s\S]*?openProfileFormAtSection\([\s\S]*?;/);
  assert.ok(wiring, 'the section Edit buttons must be wired by data attribute');
  assert.match(wiring[0], /preventDefault\(\)/, 'the click must not follow the summary toggle');
  assert.match(wiring[0], /stopPropagation\(\)/, 'the click must not reach the <details> toggle');
  assert.match(
    wiring[0],
    /openProfileFormAtSection\(btn\.getAttribute\('data-profile-section-edit'\)\)/,
    'the click must open the form at the clicked section',
  );
});

test('phase C: openProfileFormAtSection opens the same form at the section group and focuses its first field', () => {
  const app = read('app.js');
  const fn = app.match(/function openProfileFormAtSection\(sectionKey\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'openProfileFormAtSection must exist');
  assert.match(fn[0], /profileEditMode = true;/, 'it opens the same edit mode as the top Edit button');
  assert.match(fn[0], /\$\('#customerProfileView'\)\.hidden = true;/, 'it hides the view, like the top Edit button');
  assert.match(fn[0], /form\.hidden = false;/, 'it shows the same inline form, not a new dialog');
  assert.match(
    fn[0],
    /form\.querySelector\(`\[data-profile-form-section="\$\{sectionKey\}"\]`\)/,
    'it finds the section group by the same data attribute the form carries',
  );
  assert.match(fn[0], /group\.scrollIntoView\(\{ block: 'start' \}\)/, 'it scrolls the group to the top');
  assert.match(
    fn[0],
    /group\?\.querySelector\('input, select, textarea'\)/,
    'it focuses the first field of the group',
  );
  assert.match(fn[0], /firstField\.focus\(\{ preventScroll: true \}\)/, 'focusing must not undo the scroll');
});

// ---------------------------------------------------------------------------
// The regrouped edit form (index.html)
// ---------------------------------------------------------------------------

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function parseFormSections(form) {
  const sections = [...form.matchAll(/<section class="profile-form-group profile-info-group" data-profile-form-section="([^"]+)"><h4 data-i18n="([^"]+)">[^<]*<\/h4><div class="profile-grid">([\s\S]*?)<\/div><\/section>/g)];
  return sections.map(([, key, headingKey, body]) => ({
    key,
    headingKey,
    fields: [...body.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]),
  }));
}

const EXPECTED_FORM_SECTIONS = {
  customer: {
    headingKey: 'prof_sec_customer',
    fields: [
      'profileNameInput', 'mohallaInput', 'zoneInput', 'nameUrduInput',
      // Profile Number Field at Top (item C) — the phone field MOVED out
      // of the form to #profileTopPhoneRow, directly under the title row
      // (D-C1/D-C2). It is deliberately NOT in this list any more; the
      // top-row placement is pinned by tests/profile-number-field-top.test.js.
      'cnicInput', 'fatherOrReferenceNameInput', 'searchAliasesInput',
      'whatsappPhoneInput', 'alternatePhoneInput', 'prefersSmsCheckbox',
      'preferredReceiptLangSelect', 'preferredReceiptChannelSelect',
      'addressInput', 'customerNotesInput',
      'residenceTypeInput', 'landlordOrGuarantorNameInput', 'landlordPhoneInput',
    ],
  },
  service: {
    headingKey: 'prof_sec_service',
    fields: [
      'ispProviderInput', 'serviceStatusInput', 'preferredVisitWindowInput', 'connectionTypeInput',
      'pauseBillingCheckbox', 'pauseStartDateInput', 'autoResumeDateInput',
      'doNotSuspendUntilInput', 'doNotSuspendReasonInput',
      'seasonalRateInput', 'seasonalUntilMonthInput', 'seasonalRestoreRateInput',
      'packageSpeedInput', 'expiryDateInput', 'cancellationDateInput',
      'packageChangeStaffNameInput',
    ],
  },
  financial: {
    headingKey: 'prof_sec_financial',
    fields: [
      'monthlyPurchaseCostInput', 'monthlySellingAmountInput',
      'securityDepositInput', 'feederHostCreditInput',
    ],
  },
  connection: {
    headingKey: 'prof_sec_connection',
    fields: [
      'connectionDateInput', 'connectionFeeInput', 'fiberMetersInput',
      'linemanInstallFeeInput', 'otherInstallCostInput', 'installedByLinemanInput', 'fiberPerMeterRateInput',
    ],
  },
  network: {
    headingKey: 'prof_sec_network',
    fields: [
      'splitterBoxIdInput', 'splitterPortInput', 'oltPonPortInput', 'lastRxDbmInput',
      'onuConnectorTypeInput', 'converterSideInput', 'poleNumberInput', 'boxLocationNoteInput',
      'dropWireCoreColorInput', 'pppoeUsernameInput', 'pppoePasswordInput', 'staticIpInput',
      'macAddressInput', 'wifiSsidInput', 'wifiPasswordInput', 'routerAdminPortInput',
      'routerAdminPasswordInput', 'upstreamCustomerInput', 'fiberZoneInput',
    ],
  },
  hardware: {
    headingKey: 'prof_sec_hardware',
    fields: [
      'routerModelInput', 'routerPriceInput', 'mediaConverterCostInput',
      'routerOwnershipInput', 'mediaConverterOwnershipInput', 'serialNumberInput',
    ],
  },
};

test('phase C: the form is regrouped into the six view sections, in view order', () => {
  const sections = parseFormSections(formHtml());
  assert.deepEqual(
    sections.map((s) => s.key),
    ['customer', 'service', 'financial', 'connection', 'network', 'hardware'],
    'six form groups, one per editable view section, in view order — History has no form group',
  );
  for (const s of sections) {
    assert.equal(s.headingKey, EXPECTED_FORM_SECTIONS[s.key].headingKey, `${s.key} must reuse its view section heading key`);
    assert.deepEqual(s.fields, EXPECTED_FORM_SECTIONS[s.key].fields, `${s.key} must hold its Table A fields in current relative order`);
  }
});

test('phase C: every one of the 69 fields sits under a group heading — no ungrouped fields remain', () => {
  const sections = parseFormSections(formHtml());
  const grouped = sections.flatMap((s) => s.fields);
  assert.equal(grouped.length, 69, 'all 69 fields grouped (item C moved phone out of the form to the top row)');
  assert.equal(new Set(grouped).size, 69, 'no field grouped twice');
  const all = [...formHtml().matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...all].sort(), [...grouped].sort(), 'no field sits outside a group');
});

test('phase C: the form headings carry no new element id', () => {
  const form = formHtml();
  const headings = [...form.matchAll(/<h4[^>]*data-i18n="(prof_sec_[a-z]+)"[^>]*>/g)];
  assert.equal(headings.length, 6, 'six h4 headings, one per group');
  for (const [tag] of headings) {
    assert.ok(!tag.includes('id='), 'headings carry no new element id');
  }
});

// ---------------------------------------------------------------------------
// Single dirty source of truth — Plan 499 wins, ui-feedback.js retires
// ---------------------------------------------------------------------------

test('phase C: the ui-feedback second dirty system is gone', () => {
  // Strip comments first: the retirement note itself names the removed
  // function, so a raw substring search would trip on the explanation.
  const code = read('ui-feedback.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.ok(!code.includes('setupProfileSaveState'), 'setupProfileSaveState must be retired — Plan 499 is the single dirty source');
  assert.ok(!code.includes('fieldValues'), 'its fieldValues helper goes with it (it had no other caller)');
  assert.ok(!code.includes('profileSaveHint'), 'ui-feedback must no longer create or touch the hint element');
});

test('phase C: the hint is static markup in the form, not created at runtime', () => {
  const html = read('index.html');
  const save = html.indexOf('id="saveMohallaButton"');
  assert.notEqual(save, -1, 'the save button must exist');
  const hint = html.indexOf('id="profileSaveHint"', save);
  assert.notEqual(hint, -1, '#profileSaveHint must be static markup after the save button');
  const hintTag = html.slice(hint - 10, html.indexOf('>', hint) + 1);
  assert.ok(hintTag.includes('class="profile-save-hint"'), 'the static hint keeps its class');
  assert.ok(hintTag.includes('aria-live="polite"'), 'the static hint keeps its live region');
  const saveTag = html.slice(html.lastIndexOf('<button', save), html.indexOf('>', save) + 1);
  assert.ok(saveTag.includes('aria-describedby="profileSaveHint"'), 'the save button keeps its describedby link to the hint');
});

test('phase C: app.js drives the hint and the save button from the Plan 499 dirty rule', () => {
  const app = read('app.js');
  const fn = app.match(/function syncProfileSaveHint\(\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'syncProfileSaveHint must exist in app.js');
  assert.match(fn[0], /profileCancelHasUnsavedEdits\(\)/, 'the hint must read the Plan 499 dirty check, not a second baseline');
  assert.match(fn[0], /hint\.textContent = dirty \? 'Unsaved changes' : 'No changes yet'/, 'the hint text keeps the Plan 498 strings');
  assert.match(fn[0], /hint\.dataset\.state = dirty \? 'dirty' : 'clean'/, 'the hint state keeps the Plan 498 values');
  assert.match(fn[0], /save\.disabled = !dirty/, 'the save button is disabled from the same dirty check');
  assert.match(fn[0], /save\.classList\.toggle\('is-dirty', dirty\)/, 'the is-dirty class follows the same dirty check');
  assert.match(fn[0], /hint\.textContent = '';/, 'closing the form must clear the hint text, as Plan 498 required');
});

test('phase C: the hint sync runs wherever the other Plan 499 syncs run', () => {
  const app = read('app.js');
  const visibility = app.match(/function onProfileFormVisibilityChange\(\) \{[\s\S]*?\n\}/);
  assert.ok(visibility, 'onProfileFormVisibilityChange must exist');
  assert.ok(visibility[0].includes('syncProfileSaveHint()'), 'the hint must sync when the form opens or closes');
  const listeners = app.match(/profileFormEl\?\.addEventListener\('input'[\s\S]*?profileFormEl\?\.addEventListener\('change'[\s\S]*?\}\);/);
  assert.ok(listeners, 'the form input/change listeners must exist');
  assert.ok(listeners[0].includes('syncProfileSaveHint()'), 'the hint must sync on every keystroke and change');
  const fieldSave = app.match(/function saveProfileField\(control, button, labelText\) \{[\s\S]*?syncProfileCancelButton\(\);\n  \}/);
  assert.ok(fieldSave, 'saveProfileField must exist');
  assert.ok(fieldSave[0].includes('syncProfileSaveHint()'), 'a per-field save must re-sync the hint — the stored record changed, so the hint must read clean');
});

test('phase C: the sticky bar still reads the hint — its source did not move', () => {
  const app = read('app.js');
  const sync = app.match(/function syncProfileStickySaveBar\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(sync, /\$\('#profileSaveHint'\)/, 'the sticky bar still reads #profileSaveHint');
  assert.match(sync, /\$\('#profileStickySaveHint'\)/, 'the sticky bar still writes #profileStickySaveHint');
  assert.match(sync, /barHint\.textContent = hint\.dataset\.state === 'dirty' \? hint\.textContent : ''/,
    'the sticky hint stays gated on the dirty state');
});

// ---------------------------------------------------------------------------
// Copy buttons — PPPoE username, static IP, MAC (app.js)
// ---------------------------------------------------------------------------

test('phase C: the network rows carry a copy button for PPPoE username, static IP and MAC — and nothing else', () => {
  const app = read('app.js');
  const network = app.match(/network: profileInfoGroupMarkup\(t\('prof_group_connection'\), \[\[[\s\S]*?\]\]\)/);
  assert.ok(network, 'the network fragment must exist');
  assert.ok(network[0].includes("'pppoeUsername'"), 'the PPPoE row must carry its copy field');
  assert.ok(network[0].includes("'staticIp'"), 'the static IP row must carry its copy field');
  assert.ok(network[0].includes("'macAddress'"), 'the MAC row must carry its copy field');
  assert.ok(!network[0].includes("'pppoePassword'"), 'the PPPoE password row must never carry a copy button — passwords are masked, never copied');
});

test('phase C: a copy field renders a small button in the value row, disabled when the value is missing', () => {
  const app = read('app.js');
  // Profile Polish D (16) — profileReadonlyField takes a fifth
  // parameter now (editTarget, the tap-to-edit control id); the copy
  // field behaviour — the pinned intent — is unchanged.
  const fn = app.match(/function profileReadonlyField\(label, value, wide = false, copyField = '', editTarget = ''\) \{[\s\S]*?\n\}/);
  assert.ok(fn, 'profileReadonlyField must take the copy field');
  assert.match(
    fn[0],
    /data-profile-copy-field="\$\{copyField\}"/,
    'the button carries the record key on a data attribute',
  );
  assert.match(fn[0], /value === PROFILE_EMPTY_DASH \? ' disabled' : ''/, 'the button is disabled, not hidden, when the value is missing');
  assert.match(fn[0], /aria-label="\$\{escapeHtml\(t\('rcred_copy'\)\)\}"/, 'the button reuses the existing Copy label');
  // Profile Polish D (16) — profileInfoGroupMarkup takes a fourth
  // parameter now (extraClass, the pill class), and the row tuple a
  // fifth element (editTarget). The copy-field passthrough — the
  // pinned intent — is unchanged.
  const group = app.match(/function profileInfoGroupMarkup\(heading, rows, afterFirstRowHtml = '', extraClass = ''\) \{[\s\S]*?\n\}/);
  assert.ok(group, 'profileInfoGroupMarkup must exist');
  assert.match(group[0], /\[label, value, wide, copyField, editTarget\]/, 'the row tuple passes the copy field through');
});

test('phase C: the copy wiring reads the value from the customer record, never the displayed text', () => {
  const app = read('app.js');
  const wiring = app.match(/querySelectorAll\('\[data-profile-copy-field\]'\)[\s\S]*?toast\(t\('rcred_copy_failed'\)\)[\s\S]*?\}\);/);
  assert.ok(wiring, 'the copy buttons must be wired by data attribute');
  assert.match(
    wiring[0],
    /const value = customer\[field\];/,
    'the copied value comes from the record — so the MAC copies raw, without its display suffix',
  );
  assert.match(wiring[0], /if \(!value\) return;/, 'an empty value copies nothing');
  assert.match(wiring[0], /navigator\.clipboard\.writeText\(value\)/, 'the clipboard API is tried first');
  assert.match(wiring[0], /document\.execCommand\('copy'\)/, 'the textarea fallback covers browsers without the clipboard API');
  assert.match(wiring[0], /toast\(t\('rcred_copied'\)\)/, 'success reuses the existing Copied toast');
  assert.match(wiring[0], /toast\(t\('rcred_copy_failed'\)\)/, 'failure reuses the existing copy-failed toast');
});

test('phase C: no copy button exists for any password anywhere in the profile view', () => {
  const app = read('app.js');
  assert.ok(!app.includes("data-profile-copy-field=\"pppoePassword\""), 'PPPoE password must never be copyable');
  assert.ok(!app.includes("data-profile-copy-field=\"wifiPassword\""), 'WiFi password must never be copyable');
  assert.ok(!app.includes("data-profile-copy-field=\"routerAdminPassword\""), 'router admin password must never be copyable');
  // The copy values flow through the copyField variable, not a literal
  // attribute, so the enforcement point is the wiring whitelist: it
  // must list exactly the three Phase C fields — a button carrying any
  // other field is ignored there, so a future password copy cannot
  // slip in unnoticed.
  const wiring = app.match(/querySelectorAll\('\[data-profile-copy-field\]'\)[\s\S]*?if \(\!\[([^\]]+)\]\.includes\(field\)\) return;/);
  assert.ok(wiring, 'the copy wiring must whitelist its fields');
  assert.deepEqual(
    wiring[1].replace(/['\s]/g, '').split(',').sort(),
    ['macAddress', 'pppoeUsername', 'staticIp'],
    'the profile value copy buttons are exactly PPPoE username, static IP and MAC',
  );
});

// ---------------------------------------------------------------------------
// Pins — what Phase C must not change
// ---------------------------------------------------------------------------

test('phase C pin: the form still holds all 69 fields and the save path is unchanged', () => {
  const form = formHtml();
  const fields = [...form.matchAll(/<label class="profile-field" for="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(fields.length, 69, 'regrouping moves fields, it never adds or drops one — item C moved phone out of the form to the top row (was 70, Phase D added otherInstallCost, the 70th)');
  assert.equal(new Set(fields).size, 69, 'no duplicate field ids');
  const app = read('app.js');
  assert.ok(app.includes("$('#saveMohallaButton').addEventListener('click'"), 'the full-save click handler must stay');
  assert.ok(app.includes('updateCustomerProfile(state, selectedCustomerId, {'), 'the full save must still go through updateCustomerProfile');
});

test('phase C pin: the profile completion counter still reads 68', () => {
  // The counter total is derived, not a literal: 70 keys in
  // PROFILE_FIELD_SAVE_MAP minus the two pure opt-in flags Plan 513
  // excludes (prefersSms, paused). Regrouping the form must not change
  // what it counts — the map and the exclusion list are untouched.
  // (Polish #28 Phase D added the 70th key, otherInstallCost, so the
  // total moved 67 → 68.)
  assert.equal(countProfileCompletion({}).total, 68, 'the counter total stays 68');
  assert.equal(
    countProfileCompletion({}).text,
    '0/68 fields filled',
    'the counter label keeps its total',
  );
});
