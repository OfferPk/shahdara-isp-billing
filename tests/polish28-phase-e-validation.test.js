/**
 * polish28-phase-e-validation.test.js — Polish #28 Phase E of the
 * profile seven-sections programme (validation, Req 8).
 *
 * updateCustomerProfile is the single source of truth, so the format
 * checks live there (core.js) and both save paths (full save,
 * per-field save) inherit them. Covered here:
 *  - MAC: 12 hex digits with : - . space separators (reuses
 *    normalizeMacHex + isFullMacAddress); stored as entered.
 *  - Static IP: strict IPv4 (four octets 0–255, no leading zeros).
 *  - Speed: a value is valid when it carries a usable speed (the
 *    design's derivation pattern, or a bare number read as Mbps) or
 *    when it is a digit-free custom label; a digit-bearing value with
 *    no usable speed — or a bare "Mbps" claim with no number — is a
 *    typo and blocks the save.
 *  - Date ordering: expiry / cancellation must not precede the
 *    connection date (same day is valid); the check fires only when
 *    the later date changed.
 *  - Validate-on-change: a pre-existing invalid value the operator
 *    did NOT touch never blocks an unrelated save (legacy records
 *    saved fine under cleanText-only).
 *  - Field-targeted errors: every new error (and the existing
 *    currency / date-format errors) carries error.fieldId, and the
 *    full-save catch threads it to the banner, so the banner jumps
 *    to the field in both save paths (polish #3 behaviour).
 *  - Live hints (never blocking): the MAC OUI hint gains an
 *    invalid-format warning; the static IP gains a hint on the same
 *    phone/CNIC pattern. PPPoE stays unvalidated by design.
 *
 * Two documented deviations from the design's test plan, both forced
 * by code the design missed (see the PR body for the full evidence):
 *  (1) Speed: the design lists "fast" as invalid, but "fast" is
 *      format-identical to "Gold Plan", which the pinned phase3
 *      custom-label test saves through updateCustomerProfile as a
 *      legitimate package label — and production code writes the
 *      catalog labels "5Mbps / 200GB" / "15Mbps Unlimited" through
 *      this same function. A format rule cannot reject "fast" without
 *      rejecting "Gold Plan" and breaking the payment follow, so
 *      digit-free values read as custom labels and only digit-bearing
 *      values without a usable speed are rejected.
 *  (2) Date ordering: the check fires only when expiryDate or
 *      cancellationDate changed. A save that only moves the
 *      connection date (markCustomerReconnected, install-plan
 *      completion) legitimately sets connectionDate=today against a
 *      possibly-past stored expiry date, so that direction is not
 *      checked.
 *
 * The ipv4 module is imported dynamically so the pre-fix check fails
 * per test instead of failing the whole file at load (the Phase D
 * precedent). Synthetic data only — no real customer names, no
 * realistic phone numbers (pattern-fake digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInitialState, updateCustomerProfile } from '../core.js';
import { isFullMacAddress, normalizeMacHex } from '../mac-oui-lookup.js';
import { resolveProfileErrorTarget } from '../profile-error-jump.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { TRANSLATIONS, t } = await import('../nav-language.js');
const { macOuiHintHtml } = await import('../profile-ui.js');

// The new pure module does not exist until Phase E lands; load it per
// test so the pre-fix run fails per test instead of at file load.
const loadIpv4 = () => import('../ipv4-validation.js');

const REF = new Date('2026-11-10T12:00:00+05:00');
const fresh = () => createInitialState(['PhaseE Tester']);
const customer = (state, id = 'seed-001') => state.customers.find((c) => c.id === id);
const save = (state, id, values) => updateCustomerProfile(state, id, values, REF);
// A record as it looks when it was saved BEFORE Phase E: written
// straight onto the record, bypassing updateCustomerProfile, exactly
// like a legacy row already in storage.
const withStored = (state, id, patch) => ({
  ...state,
  customers: state.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});
// Assert a save throws with the message AND the field id the banner
// must jump to (plus the dictionary key that translates it).
const throwsWithField = (fn, pattern, fieldId, i18nKey) => {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert.ok(error, 'expected the save to throw');
  assert.match(error.message, pattern);
  assert.equal(error.fieldId, fieldId);
  if (i18nKey !== undefined) assert.equal(error.i18nKey, i18nKey);
  return error;
};

// --- MAC ---------------------------------------------------------------

test('MAC valid: colon, hyphen, dot, bare, spaced and lowercase shapes save as entered', () => {
  for (const value of [
    'AA:BB:CC:DD:EE:FF', 'aa:bb:cc:dd:ee:ff', 'AA-BB-CC-DD-EE-FF',
    'AABB.CCDD.EEFF', 'AABBCCDDEEFF', 'AA BB CC DD EE FF',
    'C8:3A:35:11:22:33', '02:11:22:33:44:55',
  ]) {
    const next = save(fresh(), 'seed-001', { macAddress: value });
    assert.equal(customer(next).macAddress, value.trim(), value);
  }
});

test('MAC empty means not recorded and saves', () => {
  const next = save(fresh(), 'seed-001', { macAddress: '' });
  assert.equal(customer(next).macAddress, '');
});

test('MAC invalid: short, long, non-hex and wrong separators block the save and name the field', () => {
  for (const value of [
    'AA:BB:CC:DD:EE', 'AA:BB:CC:DD:EE:F', 'AA:BB:CC:DD:EE:FF:00',
    'GG:BB:CC:DD:EE:FF', 'AA:BB:CC:DD:EE:FG', 'AA/BB/CC/DD/EE/FF',
    'not a mac',
  ]) {
    const error = throwsWithField(
      () => save(fresh(), 'seed-001', { macAddress: value }),
      /MAC address must be 12 hex digits/, 'macAddressInput', 'prof_mac_invalid',
    );
    assert.equal(error.message, t('prof_mac_invalid', 'en'));
  }
});

test('MAC validate-on-change: a pre-existing invalid MAC never blocks an unrelated save', () => {
  const legacy = withStored(fresh(), 'seed-001', { macAddress: 'ZZZ' });
  // An unrelated edit sails through with the legacy garbage untouched.
  const edited = save(legacy, 'seed-001', { mohalla: 'North' });
  assert.equal(customer(edited).macAddress, 'ZZZ');
  assert.equal(customer(edited).mohalla, 'North');
  // Re-saving the same value is not an edit, so it is not re-checked.
  const resaved = save(legacy, 'seed-001', { macAddress: 'ZZZ' });
  assert.equal(customer(resaved).macAddress, 'ZZZ');
  // Changing it to a different invalid value DOES block.
  throwsWithField(
    () => save(legacy, 'seed-001', { macAddress: 'QQQ' }),
    /MAC address must be 12 hex digits/, 'macAddressInput', 'prof_mac_invalid',
  );
  // And fixing it saves.
  const fixed = save(legacy, 'seed-001', { macAddress: 'AA:BB:CC:DD:EE:FF' });
  assert.equal(customer(fixed).macAddress, 'AA:BB:CC:DD:EE:FF');
});

test('MAC helpers pinned: isFullMacAddress / normalizeMacHex contract', () => {
  assert.equal(isFullMacAddress('AA:BB:CC:DD:EE:FF'), true);
  assert.equal(isFullMacAddress('aabb.ccdd.eeff'), true);
  assert.equal(isFullMacAddress('AA:BB'), false);
  assert.equal(isFullMacAddress(''), false);
  assert.equal(normalizeMacHex('AA/BB'), null);
  assert.equal(normalizeMacHex('aa-bb-cc-dd-ee-ff'), 'AABBCCDDEEFF');
});

// --- IPv4 --------------------------------------------------------------

test('IPv4 valid matrix', async () => {
  const { isValidIpv4 } = await loadIpv4();
  for (const value of ['192.168.1.10', '10.0.0.1', '0.0.0.0', '255.255.255.255', '1.2.3.4', ' 192.168.1.10 ']) {
    assert.equal(isValidIpv4(value), true, value);
  }
  assert.equal(isValidIpv4(''), false);
});

test('IPv4 invalid matrix: out of range, leading zeros, wrong part count, letters, CIDR', async () => {
  const { isValidIpv4 } = await loadIpv4();
  for (const value of [
    '999.999.999.999', '256.1.1.1', '1.2.3.400', 'abc', '192.168.1',
    '192.168.1.1.1', '192.168.01.1', '192.168.1.01', '01.2.3.4',
    '192.168.1.-1', '192.168.1.1/24',
  ]) {
    assert.equal(isValidIpv4(value), false, value);
  }
});

test('IPv4 save: valid addresses save as entered; invalid block the save and name the field', () => {
  for (const value of ['192.168.1.10', '10.0.0.1', '0.0.0.0', '255.255.255.255']) {
    const next = save(fresh(), 'seed-001', { staticIp: value });
    assert.equal(customer(next).staticIp, value);
  }
  const cleared = save(fresh(), 'seed-001', { staticIp: '' });
  assert.equal(customer(cleared).staticIp, '');
  for (const value of ['999.999.999.999', 'abc', '192.168.1', '192.168.01.1', '192.168.1.1.1']) {
    const error = throwsWithField(
      () => save(fresh(), 'seed-001', { staticIp: value }),
      /Enter a valid IPv4 address/, 'staticIpInput', 'prof_ip_invalid',
    );
    assert.equal(error.message, t('prof_ip_invalid', 'en'));
  }
});

test('IPv4 validate-on-change: a pre-existing invalid IP never blocks an unrelated save', () => {
  const legacy = withStored(fresh(), 'seed-001', { staticIp: '999.1.1.1' });
  const edited = save(legacy, 'seed-001', { mohalla: 'North' });
  assert.equal(customer(edited).staticIp, '999.1.1.1');
  const resaved = save(legacy, 'seed-001', { staticIp: '999.1.1.1' });
  assert.equal(customer(resaved).staticIp, '999.1.1.1');
  throwsWithField(
    () => save(legacy, 'seed-001', { staticIp: '888.1.1.1' }),
    /Enter a valid IPv4 address/, 'staticIpInput', 'prof_ip_invalid',
  );
  const fixed = save(legacy, 'seed-001', { staticIp: '10.0.0.1' });
  assert.equal(customer(fixed).staticIp, '10.0.0.1');
});

test('IPv4 hint state: empty / valid / partial tip / malformed invalid', async () => {
  const { ipv4HintState } = await loadIpv4();
  assert.deepEqual(ipv4HintState(''), { empty: true, valid: false, tip: false });
  assert.deepEqual(ipv4HintState('192.168.1.10'), { empty: false, valid: true, tip: false });
  assert.deepEqual(ipv4HintState('192.168.1'), { empty: false, valid: false, tip: true });
  assert.deepEqual(ipv4HintState('192.168.1.'), { empty: false, valid: false, tip: true });
  assert.deepEqual(ipv4HintState('999.1.1.1'), { empty: false, valid: false, tip: false });
  assert.deepEqual(ipv4HintState('abc'), { empty: false, valid: false, tip: false });
  assert.deepEqual(ipv4HintState('192.168.01.1'), { empty: false, valid: false, tip: false });
  assert.deepEqual(ipv4HintState('192.168.1.1.1'), { empty: false, valid: false, tip: false });
});

// --- Speed -------------------------------------------------------------

test('speed valid: catalog labels, bare numbers and custom labels save as entered', () => {
  for (const value of [
    '15 Mbps', '15mbps', '15', '5Mbps / 200GB', '15Mbps Unlimited',
    '3Mbps / 100GB', '15 Mbps Turbo', '50', '25 Mbps Ultra',
    '5mbps-200gb', '',
    // Digit-free custom labels are legitimate package labels (pinned by
    // the phase3 custom-label test): "fast" is format-identical to
    // "Gold Plan", so it reads as a label too — see the file header.
    'Gold Plan', 'Standard', 'fast', '  Gold   Plan ',
  ]) {
    const next = save(fresh(), 'seed-001', { packageSpeed: value });
    assert.equal(customer(next).packageSpeed, value.trim(), value);
  }
});

test('speed invalid: a digit-bearing value with no usable speed, or a bare Mbps claim, blocks the save', () => {
  for (const value of ['Mbps', 'abc Mbps', 'Mbps 15', '15 Turbo', '100GB', 'abc123', 'Plan 2']) {
    const error = throwsWithField(
      () => save(fresh(), 'seed-001', { packageSpeed: value }),
      /Enter the speed as a number followed by Mbps/, 'packageSpeedInput', 'prof_speed_invalid',
    );
    assert.equal(error.message, t('prof_speed_invalid', 'en'));
  }
});

test('speed validate-on-change: production labels keep saving; a pre-existing odd label never blocks an unrelated save', () => {
  // What autoPackageFromPayment and plan migration write through this
  // same function must keep working.
  const followed = save(fresh(), 'seed-001', { packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000 });
  assert.equal(customer(followed).packageSpeed, '5Mbps / 200GB');
  const waived = save(fresh(), 'seed-001', { packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 });
  assert.equal(customer(waived).packageSpeed, '15Mbps Unlimited');
  // A legacy odd label blocks nothing it does not touch.
  const legacy = withStored(fresh(), 'seed-001', { packageSpeed: '15 Turbo' });
  const edited = save(legacy, 'seed-001', { mohalla: 'North' });
  assert.equal(customer(edited).packageSpeed, '15 Turbo');
  const resaved = save(legacy, 'seed-001', { packageSpeed: '15 Turbo' });
  assert.equal(customer(resaved).packageSpeed, '15 Turbo');
  throwsWithField(
    () => save(legacy, 'seed-001', { packageSpeed: '20 Turbo' }),
    /Enter the speed as a number followed by Mbps/, 'packageSpeedInput', 'prof_speed_invalid',
  );
});

// --- Date ordering -----------------------------------------------------

test('date ordering: expiry before connection blocks, same day passes', () => {
  let state = save(fresh(), 'seed-001', { connectionDate: '2026-09-01' });
  throwsWithField(
    () => save(state, 'seed-001', { expiryDate: '2026-08-31' }),
    /Expiry date cannot be before the connection date/, 'expiryDateInput', 'prof_expiry_before_connection',
  );
  const sameDay = save(state, 'seed-001', { expiryDate: '2026-09-01' });
  assert.equal(customer(sameDay).expiryDate, '2026-09-01');
  const after = save(state, 'seed-001', { expiryDate: '2026-09-02' });
  assert.equal(customer(after).expiryDate, '2026-09-02');
});

test('date ordering: cancellation before connection blocks, same day passes', () => {
  let state = save(fresh(), 'seed-001', { connectionDate: '2026-09-01' });
  throwsWithField(
    () => save(state, 'seed-001', { cancellationDate: '2026-08-31' }),
    /Cancellation date cannot be before the connection date/, 'cancellationDateInput', 'prof_cancellation_before_connection',
  );
  const sameDay = save(state, 'seed-001', { cancellationDate: '2026-09-01' });
  assert.equal(customer(sameDay).cancellationDate, '2026-09-01');
});

test('date ordering: no connection date, no ordering to break', () => {
  const withExpiry = save(fresh(), 'seed-001', { expiryDate: '2026-08-01' });
  assert.equal(customer(withExpiry).expiryDate, '2026-08-01');
  const withCancellation = save(fresh(), 'seed-001', { cancellationDate: '2026-08-01' });
  assert.equal(customer(withCancellation).cancellationDate, '2026-08-01');
});

test('date ordering validate-on-change: a pre-existing inverted pair never blocks an unrelated save', () => {
  const legacy = withStored(fresh(), 'seed-001', { connectionDate: '2026-09-01', expiryDate: '2026-08-01' });
  const edited = save(legacy, 'seed-001', { mohalla: 'North' });
  assert.equal(customer(edited).expiryDate, '2026-08-01');
  const resaved = save(legacy, 'seed-001', { expiryDate: '2026-08-01' });
  assert.equal(customer(resaved).expiryDate, '2026-08-01');
  throwsWithField(
    () => save(legacy, 'seed-001', { expiryDate: '2026-08-15' }),
    /Expiry date cannot be before the connection date/, 'expiryDateInput', 'prof_expiry_before_connection',
  );
  // Moving ONLY the connection date never trips the check: the
  // reconnect and install-completion flows legitimately set
  // connectionDate=today against a possibly-past stored expiry date.
  const reconnected = save(legacy, 'seed-001', { connectionDate: '2026-10-01' });
  assert.equal(customer(reconnected).connectionDate, '2026-10-01');
  assert.equal(customer(reconnected).expiryDate, '2026-08-01');
});

test('date format errors carry the field id', () => {
  throwsWithField(
    () => save(fresh(), 'seed-001', { expiryDate: '2026-02-30' }),
    /Enter a valid expiry date/, 'expiryDateInput',
  );
  throwsWithField(
    () => save(fresh(), 'seed-001', { expiryDate: 'not-a-date' }),
    /Enter a valid expiry date/, 'expiryDateInput',
  );
  throwsWithField(
    () => save(fresh(), 'seed-001', { connectionDate: '2026-13-01' }),
    /Enter a valid connection date/, 'connectionDateInput',
  );
  throwsWithField(
    () => save(fresh(), 'seed-001', { cancellationDate: '2026-02-30' }),
    /Enter a valid cancellation date/, 'cancellationDateInput',
  );
});

// --- Currency (field-targeted errors only; messages unchanged) ----------

test('currency errors carry the field id', () => {
  throwsWithField(
    () => save(fresh(), 'seed-001', { monthlySellingAmount: '0' }),
    /Amount must be greater than zero/, 'monthlySellingAmountInput',
  );
  throwsWithField(
    () => save(fresh(), 'seed-001', { monthlySellingAmount: '-5' }),
    /Amount must be greater than zero/, 'monthlySellingAmountInput',
  );
  const cleared = save(fresh(), 'seed-001', { monthlySellingAmount: '' });
  assert.equal(customer(cleared).monthlySellingAmount, null);
  for (const [key, fieldId] of [
    ['monthlyPurchaseCost', 'monthlyPurchaseCostInput'],
    ['connectionFee', 'connectionFeeInput'],
    ['routerPrice', 'routerPriceInput'],
    ['otherInstallCost', 'otherInstallCostInput'],
    ['securityDeposit', 'securityDepositInput'],
    ['mediaConverterCost', 'mediaConverterCostInput'],
    ['linemanInstallFee', 'linemanInstallFeeInput'],
    ['fiberPerMeterRate', 'fiberPerMeterRateInput'],
  ]) {
    throwsWithField(
      () => save(fresh(), 'seed-001', { [key]: '-1' }),
      /Monthly purchase cost cannot be negative/, fieldId,
    );
  }
});

// --- Error jump + i18n + wiring ----------------------------------------

test('error jump: the six Phase E controls resolve to their fields', () => {
  for (const id of ['macAddressInput', 'staticIpInput', 'packageSpeedInput', 'connectionDateInput', 'expiryDateInput', 'cancellationDateInput']) {
    assert.deepEqual(resolveProfileErrorTarget(id), { kind: 'field', id });
  }
});

test('i18n: the six Phase E keys exist in en and ur, ur carries Urdu script', () => {
  const expectedEn = {
    prof_mac_invalid: 'MAC address must be 12 hex digits, e.g. AA:BB:CC:DD:EE:FF.',
    prof_ip_invalid: 'Enter a valid IPv4 address, e.g. 192.168.1.10.',
    prof_ip_valid: '✓ Valid IPv4 address',
    prof_speed_invalid: 'Enter the speed as a number followed by Mbps, e.g. 15 Mbps.',
    prof_expiry_before_connection: 'Expiry date cannot be before the connection date.',
    prof_cancellation_before_connection: 'Cancellation date cannot be before the connection date.',
  };
  for (const [key, en] of Object.entries(expectedEn)) {
    assert.equal(t(key, 'en'), en, key);
    assert.ok(key in TRANSLATIONS.en, `${key} missing from en`);
    assert.ok(key in TRANSLATIONS.ur, `${key} missing from ur`);
    assert.match(t(key, 'ur'), /[\u0600-\u06FF]/, `${key}: ur must carry Urdu script`);
  }
});

test('app.js: the full-save catch threads the error field id, the per-field catch translates a keyed error', () => {
  const app = read('app.js');
  assert.match(app, /showProfileFormError\(error\?\.i18nKey \? t\(error\.i18nKey\) : error\.message, error\?\.fieldId \?\? null\)/);
  assert.match(app, /showProfileFormError\(error\?\.i18nKey \? t\(error\.i18nKey\) : error\.message, control\.id\)/);
});

test('static IP live hint: markup exists, app.js wires it on the phone/CNIC pattern, styles cover it', () => {
  const html = read('index.html');
  assert.match(html, /<small class="static-ip-hint" data-static-ip-hint role="status" hidden><\/small>/);
  const app = read('app.js');
  assert.match(app, /ipv4HintState/);
  assert.match(app, /refreshStaticIpHint/);
  assert.match(app, /data-static-ip-hint/);
  const css = read('styles.css');
  assert.match(css, /\.static-ip-hint\.valid/);
  assert.match(css, /\.static-ip-hint\.tip/);
  assert.match(css, /\.static-ip-hint\.invalid/);
  const components = read('components.css');
  assert.match(components, /\.mac-oui-invalid/);
});

test('MAC live hint: invalid and partial warnings show live, valid MACs keep the OUI behaviour', () => {
  assert.equal(macOuiHintHtml(''), '');
  const vendor = macOuiHintHtml('C8:3A:35:11:22:33');
  assert.match(vendor, /mac-oui-badge/);
  assert.doesNotMatch(vendor, /mac-oui-invalid/);
  const randomized = macOuiHintHtml('02:11:22:33:44:55');
  assert.match(randomized, /mac-oui-warning/);
  assert.doesNotMatch(randomized, /mac-oui-invalid/);
  // Partial (all hex, fewer than 12 digits, not randomized): amber tip.
  const partial = macOuiHintHtml('AB:CD');
  assert.match(partial, /mac-oui-warning/);
  assert.match(partial, /12 hex digits/);
  // Malformed (non-hex, or more than 12 digits): red invalid note.
  for (const value of ['AB:CD:EF:GH', 'AA:BB:CC:DD:EE:FF:00', 'GG:BB:CC:DD:EE:FF']) {
    const hint = macOuiHintHtml(value);
    assert.match(hint, /mac-oui-invalid/, value);
    assert.match(hint, /12 hex digits/, value);
  }
});

// --- Non-goals + end to end --------------------------------------------

test('PPPoE stays unvalidated by design (provider-assigned free-form strings)', () => {
  const next = save(fresh(), 'seed-001', { pppoeUsername: 'anything goes!@#', pppoePassword: 's3cret w1th spaces' });
  assert.equal(customer(next).pppoeUsername, 'anything goes!@#');
  assert.equal(customer(next).pppoePassword, 's3cret w1th spaces');
});

test('all-valid save works end to end and a refused save leaves the stored record untouched', () => {
  const state = fresh();
  const next = save(state, 'seed-001', {
    macAddress: 'AA:BB:CC:DD:EE:FF', staticIp: '192.168.1.10', packageSpeed: '15 Mbps',
    connectionDate: '2026-09-01', expiryDate: '2027-09-01', cancellationDate: '',
    monthlySellingAmount: '1500',
  });
  const saved = customer(next);
  assert.equal(saved.macAddress, 'AA:BB:CC:DD:EE:FF');
  assert.equal(saved.staticIp, '192.168.1.10');
  assert.equal(saved.packageSpeed, '15 Mbps');
  assert.equal(saved.connectionDate, '2026-09-01');
  assert.equal(saved.expiryDate, '2027-09-01');
  assert.equal(saved.cancellationDate, null);
  assert.equal(saved.monthlySellingAmount, 1500);
  assert.throws(() => save(state, 'seed-001', { macAddress: 'ZZZ' }), /MAC address must be 12 hex digits/);
  // The seed record carries no macAddress key until the first save —
  // the refused save left it exactly as it was.
  assert.equal(customer(state).macAddress, undefined);
});
