import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';
import { isProfileFieldFilled, countProfileCompletion, countProfileCompletionFromControls, PROFILE_COMPLETION_EXCLUDED_KEYS } from '../profile-completion.js';
import { missingProfileFields } from '../missing-fields-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const completionSrc = readFileSync(join(dir, '..', 'profile-completion.js'), 'utf8');

// The counted field list, built exactly the way app.js builds the
// checklist list: the per-field-save map minus the opt-in flags.
const COUNTED_FIELDS = Object.entries(PROFILE_FIELD_SAVE_MAP)
  .filter(([, fieldKey]) => !PROFILE_COMPLETION_EXCLUDED_KEYS.includes(fieldKey))
  .map(([controlId, fieldKey]) => ({ controlId, fieldKey }));

test('plan513: exactly the two pure opt-in flags are excluded from the counted total', () => {
  assert.deepEqual([...PROFILE_COMPLETION_EXCLUDED_KEYS], ['prefersSms', 'paused']);
  assert.ok(Object.isFrozen(PROFILE_COMPLETION_EXCLUDED_KEYS), 'the excluded list is frozen');
});

test('plan513: the per-field-save map is unchanged — exclusion is counting-only', () => {
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 70, 'the map holds all 70 fields (Phase D added otherInstallCost)');
  assert.equal(PROFILE_FIELD_SAVE_MAP.prefersSmsCheckbox, 'prefersSms', 'Prefers SMS still saves per-field');
  assert.equal(PROFILE_FIELD_SAVE_MAP.pauseBillingCheckbox, 'paused', 'Pause billing still saves per-field');
});

test('plan513: a profile with every applicable field filled shows full marks', () => {
  const record = {};
  for (const { fieldKey } of COUNTED_FIELDS) record[fieldKey] = 'x';
  // Both opt-in flags legitimately false — and the profile still
  // reaches full marks, which was impossible before (67/69 forever).
  // Polish #28 Phase D added otherInstallCost, so full marks are
  // 68/70 now.
  record.prefersSms = false;
  record.paused = false;
  const counted = countProfileCompletion(record);
  assert.equal(counted.total, 68);
  assert.equal(counted.filled, 68);
  assert.equal(counted.text, '68/68 fields filled');
});

test('plan513: an unchecked opt-in flag is never listed as missing', () => {
  const record = {};
  for (const { fieldKey } of COUNTED_FIELDS) record[fieldKey] = 'x';
  record.prefersSms = false;
  record.paused = false;
  // Counter and checklist agree at full marks: nothing missing.
  assert.deepEqual(missingProfileFields(record, COUNTED_FIELDS), []);
  assert.equal(countProfileCompletion(record).filled, 68);
  // One counted field left empty: only that field is listed — the
  // unchecked flags never join the list.
  record.cnic = '';
  assert.deepEqual(missingProfileFields(record, COUNTED_FIELDS), [{ controlId: 'cnicInput', fieldKey: 'cnic' }]);
  const counted = countProfileCompletion(record);
  assert.equal(counted.filled, 67);
  assert.equal(counted.total, 68);
});

test('plan513: the live form counter agrees — unchecked flags add nothing', () => {
  const controls = [
    { id: 'phoneInput', type: 'tel', value: '03012345678' },
    { id: 'prefersSmsCheckbox', type: 'checkbox', checked: false },
    { id: 'pauseBillingCheckbox', type: 'checkbox', checked: false },
  ];
  const counted = countProfileCompletionFromControls(controls);
  assert.equal(counted.filled, 1, 'only the phone counts');
  assert.equal(counted.total, 68);
  assert.equal(counted.text, '1/68 fields filled');
});

test('plan513: the value rule is unchanged — a boolean still counts only when true', () => {
  assert.equal(isProfileFieldFilled(false), false);
  assert.equal(isProfileFieldFilled(true), true);
  assert.equal(isProfileFieldFilled(0), true, 'a zero figure still counts as filled');
});

test('plan513 wiring: app.js builds the checklist from the counter counted list', () => {
  assert.ok(appSrc.includes("PROFILE_COMPLETION_EXCLUDED_KEYS } from './profile-completion.js"), 'app imports the excluded-keys constant');
  const call = appSrc.split('\n').find((line) => line.includes('missingProfileFields(customer,'));
  assert.ok(call, 'app builds the checklist field list inline');
  assert.ok(call.includes('PROFILE_COMPLETION_EXCLUDED_KEYS'), 'the checklist list excludes the opt-in flags');
  assert.ok(completionSrc.includes('PROFILE_COMPLETION_EXCLUDED_KEYS'), 'the constant lives in the counter module');
});
