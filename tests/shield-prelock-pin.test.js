// M2: Suspension Shield Clause Test Pin (SISP-148 × SISP-180 clause 4).
//
// Since SISP-180 merged, isPrelockNoticeEligible (reminder-queue.js)
// clause 4 suppresses the final 24h pre-suspension WhatsApp notice for
// a customer shielded by the SISP-148 do-not-suspend shield. That
// composition shipped on a merge-time clause slot and was only ever
// probe-verified — the SISP-180 test file pins clauses 1–3 and never
// mentions the shield. This file pins clause 4 END-TO-END through
// isPrelockNoticeEligible, plus the isShielded unit contract it rests
// on (suspension-shield.js). Test-only: zero shipped files change.
//
// Contract extracted from the shipped code (reminder-queue.js:646,
// suspension-shield.js isShielded/sanitizeShieldFields):
//   Eligibility clauses, in order — 1: exact SISP-38 Lock Due set
//   (outstanding > 0, on/after the 15th, not FREE, no active Waada);
//   2: no strictly-future promiseDate; 3: vacationHoldState === 'none';
//   4: NOT isShielded(customer, todayStr). Every fixture below is a
//   plain Lock Due defaulter (mirrors the SISP-180 test fixture), so
//   clauses 1–3 pass and clause 4 is the only deciding factor.
//   isShielded is true iff BOTH halves survive sanitizing AND
//   until >= today (inclusive): until must be a real YYYY-MM-DD
//   calendar date (leap-aware; impossible dates sanitize to null) and
//   the reason must be one of SUSPENSION_SHIELD_REASONS
//   (student_exams / medical_emergency / owner_approved) — free text,
//   including the spec's display phrases, sanitizes to '' and leaves
//   the shield inert. A half-recorded shield is inert.
//
// BRIEF-VS-CODE NOTE (unparseable today): isShielded itself FAILS
// OPEN on an unparseable todayStr (returns false — clause 4 goes
// inert). But isPrelockNoticeEligible with an unparseable todayStr
// is NOT "eligible": clause 1 (getEscalationStage → parseDateParts)
// returns no stage for an unparseable date, so eligibility is false
// for a clause-1 reason. Both facts are pinned below, labelled.
import test from 'node:test';
import assert from 'node:assert/strict';

import { isPrelockNoticeEligible } from '../reminder-queue.js';
import {
  isShielded,
  SUSPENSION_SHIELD_REASONS
} from '../suspension-shield.js';

const TODAY = '2026-10-16'; // a 16th: inside the Lock Due window
const OUTSTANDING = 3000;

// Plain Lock Due defaulter — the SISP-180 test fixture shape: no
// promiseDate (clauses 1–2 pass), no hold fields (clause 3 passes).
const unpaid = (overrides = {}) => ({ id: 'c1', name: 'Test Defaulter', ...overrides });
const shielded = (overrides = {}) => unpaid({
  doNotSuspendUntil: '2026-10-20',
  doNotSuspendReason: 'student_exams',
  ...overrides
});

// --- Control: clause isolation ---------------------------------------------

test('control: the identical defaulter WITHOUT a shield is eligible', () => {
  assert.equal(isPrelockNoticeEligible(unpaid(), OUTSTANDING, TODAY), true, 'no shield fields at all');
  assert.equal(
    isPrelockNoticeEligible(unpaid({ doNotSuspendUntil: null, doNotSuspendReason: '' }), OUTSTANDING, TODAY),
    true,
    'explicit absent shield values (the sanitized defaults)'
  );
});

// --- Clause 4 end-to-end through isPrelockNoticeEligible -------------------

test('clause 4: an active shield spares the notice for EACH enum reason', () => {
  assert.deepEqual(SUSPENSION_SHIELD_REASONS, ['student_exams', 'medical_emergency', 'owner_approved']);
  for (const reason of SUSPENSION_SHIELD_REASONS) {
    assert.equal(
      isPrelockNoticeEligible(shielded({ doNotSuspendReason: reason }), OUTSTANDING, TODAY),
      false,
      `reason ${reason}`
    );
  }
});

test('clause 4: boundary — a shield expiring TODAY still spares the notice (until is inclusive)', () => {
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: TODAY }), OUTSTANDING, TODAY),
    false
  );
});

test('clause 4: an expired shield (until before today) leaves the customer eligible', () => {
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: '2026-10-15' }), OUTSTANDING, TODAY),
    true,
    'expired yesterday'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: '2026-09-30' }), OUTSTANDING, TODAY),
    true,
    'expired last month'
  );
});

test('clause 4: half-recorded shield — valid date, missing reason — is inert', () => {
  assert.equal(
    isPrelockNoticeEligible(unpaid({ doNotSuspendUntil: '2026-10-20' }), OUTSTANDING, TODAY),
    true,
    'reason field absent'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendReason: '' }), OUTSTANDING, TODAY),
    true,
    'reason empty string'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendReason: null }), OUTSTANDING, TODAY),
    true,
    'reason null'
  );
});

test('clause 4: free-text reasons sanitize away and leave the shield inert', () => {
  // The spec's own display phrases are labels, never stored values —
  // typed as free text they must NOT shield anyone.
  for (const freeText of ['Student Exams', 'Medical / Family Emergency', 'Owner Approved', 'family emergency', 'exams']) {
    assert.equal(
      isPrelockNoticeEligible(shielded({ doNotSuspendReason: freeText }), OUTSTANDING, TODAY),
      true,
      `free-text reason ${JSON.stringify(freeText)}`
    );
  }
});

test('clause 4: half-recorded shield — valid reason, missing date — is inert', () => {
  assert.equal(
    isPrelockNoticeEligible(unpaid({ doNotSuspendReason: 'owner_approved' }), OUTSTANDING, TODAY),
    true,
    'date field absent'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: null }), OUTSTANDING, TODAY),
    true,
    'date null'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: '' }), OUTSTANDING, TODAY),
    true,
    'date empty string'
  );
});

test('clause 4: a corrupt until date sanitizes to absent and leaves the shield inert', () => {
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: '2026-02-30' }), OUTSTANDING, TODAY),
    true,
    'impossible calendar date (Feb 30)'
  );
  assert.equal(
    isPrelockNoticeEligible(shielded({ doNotSuspendUntil: '20-10-2026' }), OUTSTANDING, TODAY),
    true,
    'malformed date string'
  );
});

// --- isShielded unit contract (the layer clause 4 rests on) ----------------

test('isShielded: both halves valid and until >= today (inclusive) is the whole rule', () => {
  const c = { doNotSuspendUntil: '2026-10-20', doNotSuspendReason: 'medical_emergency' };
  assert.equal(isShielded(c, TODAY), true, 'until in the future');
  assert.equal(isShielded(c, '2026-10-20'), true, 'until == today still shields');
  assert.equal(isShielded(c, '2026-10-21'), false, 'the day after until, the shield has expired');
  assert.equal(isShielded(null, TODAY), false, 'no customer record');
  assert.equal(isShielded({}, TODAY), false, 'empty record');
});

test('isShielded: an unparseable today fails OPEN (not shielded) at the shield layer', () => {
  const c = { doNotSuspendUntil: '2026-10-20', doNotSuspendReason: 'student_exams' };
  for (const bad of ['not-a-date', '', '2026-02-30', '16/10/2026', null, undefined]) {
    assert.equal(isShielded(c, bad), false, `todayStr ${JSON.stringify(bad)}`);
  }
});

test('unparseable today end-to-end: eligibility is false at CLAUSE 1, not clause 4', () => {
  // Certifies the real composition honestly: the shield layer fails
  // open (previous test), but getEscalationStage cannot compute a
  // stage for an unparseable reference date, so the predicate returns
  // false before clause 4 is ever reached. Nobody gets a notice on a
  // broken clock input — and nobody is shield-spared by it either.
  assert.equal(isPrelockNoticeEligible(shielded(), OUTSTANDING, 'not-a-date'), false);
  assert.equal(isPrelockNoticeEligible(unpaid(), OUTSTANDING, 'not-a-date'), false, 'even unshielded: clause 1 decides');
});
