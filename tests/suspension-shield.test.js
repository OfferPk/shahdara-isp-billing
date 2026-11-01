// SISP-148: Do-Not-Suspend Exam / Emergency Shield. Pure-function and
// wiring tests on synthetic data only — no real customer names.
// Spec test criteria (verbatim): "Unit tests verifying active shield
// exclusion and expired shield inclusion in MikroTik suspension lists"
// plus the brief's pins: until == today boundary, missing-reason inert,
// invalid date sanitized away, backup round-trip, badge conditions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUSPENSION_SHIELD_REASONS,
  sanitizeDoNotSuspendUntil,
  sanitizeDoNotSuspendReason,
  sanitizeShieldFields,
  isShielded
} from '../suspension-shield.js';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  persistState,
  createJsonBackup,
  previewJsonBackupMerge,
  saveBillMonth,
  STORAGE_KEY
} from '../core.js';
import {
  buildDefaulterLockScript,
  buildLockDueSuspensionScript
} from '../mikrotik-generator.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { suspensionShieldSummary, suspensionShieldBadgeHtml } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const TODAY = '2026-10-30';
const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const shieldedCustomer = (overrides = {}) => ({
  id: 'cust-shield',
  customerNumber: 9,
  name: 'Shielded Student',
  packageSpeed: '5Mbps / 150GB',
  pppoeUsername: 'shielduser9',
  doNotSuspendUntil: '2026-11-15',
  doNotSuspendReason: 'student_exams',
  ...overrides
});
const plainCustomer = (overrides = {}) => ({
  id: 'cust-plain',
  customerNumber: 7,
  name: 'Plain Defaulter',
  packageSpeed: '5Mbps / 150GB',
  pppoeUsername: 'plainuser',
  ...overrides
});

test('sanitizers: a real date and enum keys survive; everything else is absent', () => {
  assert.equal(sanitizeDoNotSuspendUntil('2026-11-15'), '2026-11-15');
  assert.equal(sanitizeDoNotSuspendUntil(' 2026-11-15 '), '2026-11-15');
  assert.equal(sanitizeDoNotSuspendUntil('2024-02-29'), '2024-02-29'); // leap day is real
  assert.equal(sanitizeDoNotSuspendUntil('2026-02-29'), null); // 2026 is not a leap year
  assert.equal(sanitizeDoNotSuspendUntil('2026-02-30'), null);
  assert.equal(sanitizeDoNotSuspendUntil('2026-13-01'), null);
  assert.equal(sanitizeDoNotSuspendUntil('15-11-2026'), null);
  assert.equal(sanitizeDoNotSuspendUntil(''), null);
  assert.equal(sanitizeDoNotSuspendUntil(null), null);
  assert.equal(sanitizeDoNotSuspendUntil(undefined), null);
  assert.equal(sanitizeDoNotSuspendUntil(20261115), null);
  for (const reason of SUSPENSION_SHIELD_REASONS) {
    assert.equal(sanitizeDoNotSuspendReason(reason), reason);
  }
  // The spec's display phrases are labels, never stored free text.
  assert.equal(sanitizeDoNotSuspendReason('Student Exams'), '');
  assert.equal(sanitizeDoNotSuspendReason('Medical / Family Emergency'), '');
  assert.equal(sanitizeDoNotSuspendReason('exams'), '');
  assert.equal(sanitizeDoNotSuspendReason(''), '');
  assert.equal(sanitizeDoNotSuspendReason(null), '');
  assert.deepEqual(sanitizeShieldFields(null), { doNotSuspendUntil: null, doNotSuspendReason: '' });
  assert.deepEqual(sanitizeShieldFields('junk'), { doNotSuspendUntil: null, doNotSuspendReason: '' });
});

test('isShielded truth table: both halves required, active through the until date', () => {
  assert.equal(isShielded(shieldedCustomer(), TODAY), true);
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendUntil: TODAY }), TODAY), true); // until == today: still shielded
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendUntil: '2026-10-29' }), TODAY), false); // expired yesterday
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendReason: '' }), TODAY), false); // date alone is inert
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendReason: 'Student Exams' }), TODAY), false); // free text is not the enum
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendUntil: null }), TODAY), false); // reason alone is inert
  assert.equal(isShielded(shieldedCustomer({ doNotSuspendUntil: '2026-02-30' }), TODAY), false); // impossible date
  assert.equal(isShielded({}, TODAY), false); // legacy record, no fields
  assert.equal(isShielded(null, TODAY), false);
  assert.equal(isShielded(shieldedCustomer(), 'not-a-date'), false); // broken clock input fails open
  assert.equal(isShielded(shieldedCustomer(), ''), false);
});

test('MikroTik lock script: an actively shielded defaulter is excluded, with the skip surfaced', () => {
  const { script, locked, skippedShielded, skippedWaada, skippedPaused } =
    buildDefaulterLockScript([shieldedCustomer(), plainCustomer()], { todayStr: TODAY });
  assert.deepEqual(locked.map((c) => c.id), ['cust-plain']);
  assert.deepEqual(skippedShielded.map((c) => c.id), ['cust-shield']);
  assert.equal(skippedWaada.length, 0);
  assert.equal(skippedPaused.length, 0);
  assert.match(script, /# Excluded \(do-not-suspend shield/);
  assert.match(script, /Shielded Student \(customerId: cust-shield Shielded Student #9\) until 2026-11-15/);
  assert.ok(!script.includes('/ppp secret set [find name="shielduser9"]'), 'shielded secret must not be locked');
  assert.ok(script.includes('/ppp secret set [find name="plainuser"]'), 'plain defaulter is still locked');
});

test('MikroTik lock script: an expired shield no longer excludes (spec criterion)', () => {
  const expired = shieldedCustomer({ doNotSuspendUntil: '2026-10-29' });
  const { script, locked, skippedShielded } = buildDefaulterLockScript([expired], { todayStr: TODAY });
  assert.deepEqual(locked.map((c) => c.id), ['cust-shield']);
  assert.equal(skippedShielded.length, 0);
  assert.ok(script.includes('/ppp secret set [find name="shielduser9"]'));
  assert.ok(!script.includes('do-not-suspend shield'));
});

test('MikroTik lock script: boundary until == today excludes; missing reason does not', () => {
  const boundary = shieldedCustomer({ doNotSuspendUntil: TODAY });
  const noReason = shieldedCustomer({ id: 'cust-noreason', customerNumber: 11, name: 'No Reason', pppoeUsername: 'noreason11', doNotSuspendReason: '' });
  const { locked, skippedShielded } = buildDefaulterLockScript([boundary, noReason], { todayStr: TODAY });
  assert.deepEqual(skippedShielded.map((c) => c.id), ['cust-shield']);
  assert.deepEqual(locked.map((c) => c.id), ['cust-noreason']);
});

test('MikroTik lock script: all-shielded set yields the shield empty-message', () => {
  const { script, locked } = buildDefaulterLockScript([shieldedCustomer()], { todayStr: TODAY });
  assert.equal(locked.length, 0);
  assert.equal(script, [
    '# MikroTik RouterOS — Defaulter lock / walled-garden script',
    '# Generated by Shahdara ISP billing from the visible Top Defaulters list.',
    '# Review before pasting into WinBox Terminal. Customers with an active future Waada or a vacation hold are excluded below.',
    '# Excluded (do-not-suspend shield — exams / emergency / owner approved, never this lock script): Shielded Student (customerId: cust-shield Shielded Student #9) until 2026-11-15',
    '# No customers to lock — every visible defaulter is protected by a do-not-suspend shield.'
  ].join('\n'));
});

test('MikroTik Lock Due (15th+) script: the shield guard rides along (defense in depth)', () => {
  const { script, locked, skippedShielded } =
    buildLockDueSuspensionScript([shieldedCustomer(), plainCustomer()], { todayStr: TODAY });
  assert.deepEqual(locked.map((c) => c.id), ['cust-plain']);
  assert.deepEqual(skippedShielded.map((c) => c.id), ['cust-shield']);
  assert.match(script, /Lock Due \(15th\+\) suspension script/);
  assert.ok(!script.includes('/ppp secret set [find name="shielduser9"]'));
});

test('MikroTik lock script: non-shielded output is byte-identical to the pre-shield generator', () => {
  const { script, skippedShielded } = buildDefaulterLockScript([plainCustomer()], { todayStr: TODAY });
  assert.equal(skippedShielded.length, 0);
  assert.equal(script, [
    '# MikroTik RouterOS — Defaulter lock / walled-garden script',
    '# Generated by Shahdara ISP billing from the visible Top Defaulters list.',
    '# Review before pasting into WinBox Terminal. Customers with an active future Waada or a vacation hold are excluded below.',
    '# Lock: Plain Defaulter (customerId: cust-plain Plain Defaulter #7)',
    '/ppp secret set [find name="plainuser"] profile=payment-reminder-pool comment="customerId: cust-plain Plain Defaulter #7 locked"',
    '/queue simple set [find name="q-plainuser"] max-limit=128k/128k comment="customerId: cust-plain Plain Defaulter #7 locked"'
  ].join('\n'));
});

test('core choke points: addCustomer stores the pair sanitized and defaults to no shield', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Shield Via Options', new Date('2026-10-01T00:00:00Z'), {
    doNotSuspendUntil: '2026-11-15', doNotSuspendReason: 'medical_emergency'
  });
  const withShield = state.customers.find((c) => c.name === 'Shield Via Options');
  assert.equal(withShield.doNotSuspendUntil, '2026-11-15');
  assert.equal(withShield.doNotSuspendReason, 'medical_emergency');

  state = addCustomer(state, 'No Shield Default', new Date('2026-10-01T00:00:00Z'));
  const plain = state.customers.find((c) => c.name === 'No Shield Default');
  assert.equal(plain.doNotSuspendUntil, null);
  assert.equal(plain.doNotSuspendReason, '');

  state = addCustomer(state, 'Junk Shield', new Date('2026-10-01T00:00:00Z'), {
    doNotSuspendUntil: '2026-02-30', doNotSuspendReason: 'Student Exams'
  });
  const junk = state.customers.find((c) => c.name === 'Junk Shield');
  assert.equal(junk.doNotSuspendUntil, null);
  assert.equal(junk.doNotSuspendReason, '');
});

test('core choke points: updateCustomerProfile sets, preserves, clears and sanitizes the shield', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Profile Shield', new Date('2026-10-01T00:00:00Z'));
  const id = state.customers[0].id;

  state = updateCustomerProfile(state, id, { doNotSuspendUntil: '2026-12-10', doNotSuspendReason: 'owner_approved' });
  assert.equal(state.customers[0].doNotSuspendUntil, '2026-12-10');
  assert.equal(state.customers[0].doNotSuspendReason, 'owner_approved');

  // An unrelated save leaves the shield untouched (valueOrCurrent).
  state = updateCustomerProfile(state, id, { phone: '03001234567' });
  assert.equal(state.customers[0].doNotSuspendUntil, '2026-12-10');
  assert.equal(state.customers[0].doNotSuspendReason, 'owner_approved');

  // A junk date sanitizes away instead of throwing or storing garbage.
  state = updateCustomerProfile(state, id, { doNotSuspendUntil: '10/12/2026' });
  assert.equal(state.customers[0].doNotSuspendUntil, null);
  assert.equal(state.customers[0].doNotSuspendReason, 'owner_approved');

  // Clearing both halves clears the shield.
  state = updateCustomerProfile(state, id, { doNotSuspendUntil: '', doNotSuspendReason: '' });
  assert.equal(state.customers[0].doNotSuspendUntil, null);
  assert.equal(state.customers[0].doNotSuspendReason, '');
});

test('readState: the shield survives a save/load round-trip; corrupt values sanitize away', () => {
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = String(v); } };
  let state = createInitialState();
  state = addCustomer(state, 'Round Trip Shield', new Date('2026-10-01T00:00:00Z'), {
    doNotSuspendUntil: '2026-11-15', doNotSuspendReason: 'student_exams'
  });
  persistState(state, storage);
  const loaded = readState(storage);
  assert.equal(loaded.customers[0].doNotSuspendUntil, '2026-11-15');
  assert.equal(loaded.customers[0].doNotSuspendReason, 'student_exams');

  const corrupt = {
    version: 1, nextCustomerNumber: 2,
    customers: [{ id: 'x1', customerNumber: 1, name: 'Corrupt Shield', doNotSuspendUntil: '2026-02-30', doNotSuspendReason: 'bogus-reason', bills: [] }]
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(corrupt));
  const cleaned = readState(storage);
  assert.equal(cleaned.customers[0].doNotSuspendUntil, null);
  assert.equal(cleaned.customers[0].doNotSuspendReason, '');
});

test('backup round-trip: the shield travels in JSON backups and merges into an empty local profile', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Backup Shield', new Date('2026-10-01T00:00:00Z'), {
    doNotSuspendUntil: '2026-11-15', doNotSuspendReason: 'student_exams'
  });
  const backupJson = createJsonBackup(state, new Date('2026-10-20T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers[0].doNotSuspendUntil, '2026-11-15');
  assert.equal(parsed.state.customers[0].doNotSuspendReason, 'student_exams');

  // Local copy of the same customer has no shield: the merge fills it.
  const local = JSON.parse(JSON.stringify(state));
  local.customers[0].doNotSuspendUntil = null;
  local.customers[0].doNotSuspendReason = '';
  const preview = previewJsonBackupMerge(local, backupJson);
  assert.equal(preview.canApply, true);
  const merged = preview.state.customers.find((c) => c.name === 'Backup Shield');
  assert.equal(merged.doNotSuspendUntil, '2026-11-15');
  assert.equal(merged.doNotSuspendReason, 'student_exams');

  // Both sides shielded with different dates: a conflict is reported
  // and the local value wins (never silently overwritten).
  const localShielded = JSON.parse(JSON.stringify(state));
  localShielded.customers[0].doNotSuspendUntil = '2026-11-01';
  const conflictPreview = previewJsonBackupMerge(localShielded, backupJson);
  assert.ok(conflictPreview.conflicts.some((c) => c.field === 'doNotSuspendUntil'));
  const kept = conflictPreview.state.customers.find((c) => c.name === 'Backup Shield');
  assert.equal(kept.doNotSuspendUntil, '2026-11-01');
});

test('Top Defaulters: a shielded defaulter stays listed and owing, badged; an expired shield is not badged', () => {
  const refDate = new Date('2026-10-01T12:00:00Z');
  let state = createInitialState([]);
  state = addCustomer(state, 'Shielded Defaulter', refDate, {});
  const c1 = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, c1.id, { month: '2026-09', dueAmount: 3000, status: 'pending' }, refDate);
  state = updateCustomerProfile(state, c1.id, { doNotSuspendUntil: '2026-11-15', doNotSuspendReason: 'student_exams' });
  state = addCustomer(state, 'Expired Shield Defaulter', refDate, {});
  const c2 = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, c2.id, { month: '2026-09', dueAmount: 2000, status: 'pending' }, refDate);
  state = updateCustomerProfile(state, c2.id, { doNotSuspendUntil: '2026-10-15', doNotSuspendReason: 'owner_approved' });

  const data = calculateTopDefaulters(state, { referenceDate: new Date('2026-10-30T12:00:00Z'), limit: null });
  const shieldedRow = data.accounts.find((a) => a.name === 'Shielded Defaulter');
  assert.ok(shieldedRow, 'shielded defaulter still appears in the list — the debt is real');
  assert.equal(shieldedRow.totalOutstanding, 3000);
  assert.deepEqual(shieldedRow.suspensionShield, { until: '2026-11-15', reason: 'student_exams' });
  const expiredRow = data.accounts.find((a) => a.name === 'Expired Shield Defaulter');
  assert.ok(expiredRow);
  assert.equal(expiredRow.suspensionShield, null);
});

test('profile-ui: shield summary and badge render only while the shield is active', () => {
  const summary = suspensionShieldSummary(shieldedCustomer(), TODAY);
  assert.equal(summary.active, true);
  assert.equal(summary.reasonLabel, 'Student Exams');
  assert.equal(summary.label, '🛡️ Do Not Suspend · Student Exams · until 2026-11-15');
  assert.match(summary.detail, /do not suspend until 2026-11-15/);
  const badge = suspensionShieldBadgeHtml(shieldedCustomer(), TODAY);
  assert.ok(badge.includes('suspension-shield-badge'));
  assert.ok(badge.includes('🛡️ Do Not Suspend · Student Exams · until 2026-11-15'));

  const expired = suspensionShieldSummary(shieldedCustomer({ doNotSuspendUntil: '2026-10-29' }), TODAY);
  assert.equal(expired.active, false);
  assert.equal(expired.detail, 'No shield');
  assert.equal(suspensionShieldBadgeHtml(shieldedCustomer({ doNotSuspendUntil: '2026-10-29' }), TODAY), '');
  assert.equal(suspensionShieldBadgeHtml({}, TODAY), '');
  assert.equal(suspensionShieldSummary({}, TODAY).detail, 'No shield');
});

test('i18n audit: every shield key used by the new t() calls exists in en AND ur with matching placeholders', () => {
  const keys = [
    'prof_field_shield',
    'shield_reason_student_exams', 'shield_reason_medical_emergency', 'shield_reason_owner_approved', 'shield_reason_none',
    'shield_badge', 'shield_detail_active', 'shield_detail_none',
    'prof_form_shield_until', 'prof_form_shield_until_note', 'prof_form_shield_reason', 'prof_form_shield_reason_note'
  ];
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch for ${key}`);
  }
  // The dynamic reason keys (shield_reason_${reason}) resolve for every enum value in both languages.
  for (const reason of SUSPENSION_SHIELD_REASONS) {
    assert.ok(t(`shield_reason_${reason}`, 'en').length > 0);
    assert.ok(t(`shield_reason_${reason}`, 'ur').length > 0);
  }
  assert.ok(t('shield_badge', 'ur', { reason: t('shield_reason_student_exams', 'ur'), date: '2026-11-15' }).includes('2026-11-15'));
  // Source scan: the literal shield t() keys in the touched modules are all audited above.
  for (const rel of ['profile-ui.js', 'dashboard-top-defaulters.js']) {
    const src = read(rel);
    for (const m of src.matchAll(/t\('(shield_[a-z_]+)'/g)) {
      assert.ok(keys.includes(m[1]), `${rel} uses unaudited key ${m[1]}`);
    }
    assert.ok(!src.includes('shield_reason_student_exams\''), `${rel} must not hardcode reason labels`);
  }
});

test('wiring: form fields, header badge, save mapping and token-only badge CSS are in place', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="doNotSuspendUntilInput"'));
  assert.ok(html.includes('id="doNotSuspendReasonInput"'));
  assert.ok(html.includes('id="shieldStateBadge"'));
  for (const reason of SUSPENSION_SHIELD_REASONS) {
    assert.ok(html.includes(`<option value="${reason}"`), `form is missing the ${reason} option`);
  }
  const app = read('app.js');
  assert.ok(app.includes("doNotSuspendUntil: $('#doNotSuspendUntilInput')?.value || ''"));
  assert.ok(app.includes("doNotSuspendReason: $('#doNotSuspendReasonInput')?.value || ''"));
  assert.ok(app.includes("$('#shieldStateBadge')"));
  assert.ok(app.includes('suspensionShieldBadgeHtml(customer, localDate())'));
  const css = read('components.css');
  const rule = css.match(/\.suspension-shield-badge \{[^}]*\}/);
  assert.ok(rule, 'components.css is missing the .suspension-shield-badge rule');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule[0]), 'shield badge CSS must use theme tokens only, no hex');
});
