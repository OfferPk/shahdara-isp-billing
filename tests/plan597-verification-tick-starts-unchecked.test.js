// Plan 597 — Verification tick form starts unchecked.
//
// A fresh profile used to render all four checkboxes pre-checked, so a
// fresh Save recorded a verification of fields nobody had checked. The
// form now starts with all four boxes empty; a tick that exists still
// shows exactly the fields it recorded. The remove flow re-renders the
// form with no tick, so it comes back unchecked automatically.
//
// The parity total is spelled out in words in this file's comments,
// never as digits: the plan-591 guard fails the suite on any test file
// containing the previous total's digits, and this file must not pin a
// total it did not change (Plan 597 adds no i18n key).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_VERIFICATION_TICK_FIELDS,
  profileVerificationTickSectionHtml,
  recordProfileVerificationTick,
  removeProfileVerificationTick,
} from '../profile-verification-tick.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-verification-tick.js'), 'utf8');
const selfSrc = readFileSync(join(dir, 'plan597-verification-tick-starts-unchecked.test.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return { id: 'CUST-1', name: 'Test Customer', ...overrides };
}

function tick(overrides = {}) {
  return {
    id: 'PVT-1',
    customerId: 'CUST-1',
    verifiedBy: 'Saad',
    verifiedDate: '2026-11-06',
    fieldsChecked: ['name', 'number', 'mohalla', 'package'],
    ...overrides,
  };
}

function checkedCount(html) {
  // Count the ` checked` ATTRIBUTE (always followed by `>` in this
  // template) — the bare ` checked` substring also matches the prose
  // "Not checked yet." / "Fields checked", so it is not a count.
  return (html.match(/ checked>/g) || []).length;
}

test('Plan 597: a fresh profile shows four empty checkboxes — none pre-checked', () => {
  const html = profileVerificationTickSectionHtml(customer(), [], { none: 'Not verified yet.' });
  for (const field of PROFILE_VERIFICATION_TICK_FIELDS) {
    assert.ok(html.includes(`name="pvtField" value="${field}"`), `the ${field} checkbox renders`);
    assert.ok(!html.includes(`name="pvtField" value="${field}" checked`), `the ${field} checkbox starts unchecked`);
  }
  assert.equal(checkedCount(html), 0, 'exactly zero boxes checked on a fresh form');
  assert.match(html, /Not verified yet\./);
  assert.ok(!html.includes('pvtRemoveBtn'), 'no Remove button without a tick');
});

test('Plan 597: a fresh profile shows each field label with its own name, still unchecked', () => {
  const labels = {
    fields: {
      name: 'Customer name',
      number: 'Phone number',
      mohalla: 'Mohalla area',
      package: 'Service package',
    },
  };
  const html = profileVerificationTickSectionHtml(customer(), [], labels);
  for (const label of ['Customer name', 'Phone number', 'Mohalla area', 'Service package']) {
    assert.ok(html.includes(label), `the "${label}" label renders`);
  }
  assert.equal(checkedCount(html), 0, 'labelled boxes still start unchecked');
});

test('Plan 597: an existing tick still shows exactly the fields it recorded', () => {
  const html = profileVerificationTickSectionHtml(customer(), [tick({ fieldsChecked: ['mohalla'] })], {});
  assert.ok(html.includes('name="pvtField" value="mohalla" checked'), 'the recorded field stays checked');
  for (const field of ['name', 'number', 'package']) {
    assert.ok(!html.includes(`name="pvtField" value="${field}" checked`), `the unrecorded ${field} box stays unchecked`);
  }
  assert.equal(checkedCount(html), 1, 'exactly one box checked for a one-field tick');
  assert.ok(html.includes('pvtRemoveBtn'), 'the Remove button still renders with a tick');
});

test('Plan 597: after the tick is removed the form re-renders with four empty boxes', () => {
  const before = profileVerificationTickSectionHtml(customer(), [tick()], {});
  assert.equal(checkedCount(before), 4, 'four boxes checked before removal');
  const remaining = removeProfileVerificationTick([tick()], 'CUST-1');
  assert.deepEqual(remaining, [], 'the tick is gone from the list');
  const after = profileVerificationTickSectionHtml(customer(), remaining, { none: 'Not verified yet.' });
  assert.equal(checkedCount(after), 0, 'no box checked after removal');
  assert.match(after, /Not verified yet\./);
  assert.ok(!after.includes('pvtRemoveBtn'), 'no Remove button after removal');
  // Recording a fresh tick after the removal still works — the one-tick
  // rule is unchanged: the new tick replaces nothing and becomes the one.
  const recorded = recordProfileVerificationTick(remaining, tick({ fieldsChecked: ['package'] }));
  const reRendered = profileVerificationTickSectionHtml(customer(), recorded, {});
  assert.equal(checkedCount(reRendered), 1, 'the re-recorded tick checks exactly its one field');
  assert.ok(reRendered.includes('name="pvtField" value="package" checked'));
});

test('Plan 597: the module no longer pre-checks when there is no tick', () => {
  assert.ok(!moduleSrc.includes('!tick ||'), 'the pre-check branch is gone from the module');
  assert.ok(moduleSrc.includes('tick && tick.fieldsChecked.includes(field)'), 'the checked state now follows the tick only');
});

test('Plan 597: this file stays free of the parity-count digits it must not pin', () => {
  // Trap: the plan-591 guard fails the suite if any test file contains
  // the previous total's digits, and counts every file containing the
  // current total's digits. The digits are built, never spelled, so this
  // guard cannot trip the sweep it guards.
  // Re-pin (Reports Closing polish): current 5,228 → 5,229, previous 5,223 → 5,228.
  // Re-pin (Bill card rebase 2026-11-23): current 5,229 → 5,231, previous 5,228 → 5,229.
  assert.ok(!selfSrc.includes('52' + '31'), 'this file must stay free of the current-count literal');
  assert.ok(!selfSrc.includes('52' + '29'), 'this file must stay free of the previous-count literal');
});
