import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeStaffLeave,
  normalizeStaffLeaveList,
  recordStaffLeave,
} from '../staff-leave.js';
import {
  normalizeStaffTraining,
  normalizeStaffTrainingList,
  recordStaffTraining,
} from '../staff-training.js';
import { paymentSaveErrorMessage } from '../form-validation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');

const leaveEntry = {
  id: 'LV-1',
  staffMember: 'Saad',
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  leaveType: 'Annual leave',
  approver: 'Aqib',
  status: 'approved',
};
const trainingEntry = {
  id: 'TN-1',
  staffMember: 'Saad',
  topic: 'Fiber splicing',
  date: '2026-11-03',
  trainer: 'Aqib',
  outcome: 'Passed',
};

// Polish #16, Req 1 — the "Payment not saved" crash. loadStaffLeave /
// saveStaffLeave (and the training pair) passed the stored LIST to the
// singular per-entry normalizer, which returns null for every array, so
// the loaders returned null and renderStaffLeave / renderStaffTraining
// threw on `all.length`. The payment itself was already persisted —
// save() calls renderPhase3() AFTER persistState() — so the toast lied.
// The fix is the LIST normalizer at all four call sites. These source
// assertions fail on the pre-fix code (verified against the pristine
// Plan 494 head in /tmp) and pass on the fixed code.
test('Polish #16: staff leave loader and saver use the list normalizer', () => {
  assert.match(app, /return normalizeStaffLeaveList\(JSON\.parse\(localStorage\.getItem\(STAFF_LEAVE_KEY\)/);
  assert.match(app, /localStorage\.setItem\(STAFF_LEAVE_KEY, JSON\.stringify\(normalizeStaffLeaveList\(list\)\)\)/);
  assert.doesNotMatch(app, /normalizeStaffLeave\(/);
});

test('Polish #16: staff training loader and saver use the list normalizer', () => {
  assert.match(app, /return normalizeStaffTrainingList\(JSON\.parse\(localStorage\.getItem\(STAFF_TRAINING_KEY\)/);
  assert.match(app, /localStorage\.setItem\(STAFF_TRAINING_KEY, JSON\.stringify\(normalizeStaffTrainingList\(list\)\)\)/);
  assert.doesNotMatch(app, /normalizeStaffTraining\(/);
});

// Characterization of the trap itself: the singular normalizer returns
// null for arrays by design (it normalizes ONE entry). This pins why the
// old call sites crashed; the per-entry behaviour is correct as-is and
// the Plan 291/292 tests are untouched.
test('Polish #16: the singular normalizers return null for arrays (the trap)', () => {
  assert.equal(normalizeStaffLeave([]), null);
  assert.equal(normalizeStaffLeave([{ ...leaveEntry }]), null);
  assert.equal(normalizeStaffTraining([]), null);
  assert.equal(normalizeStaffTraining([{ ...trainingEntry }]), null);
});

// The loader contract, exactly as loadStaffLeave / loadStaffTraining
// evaluate it: parse the stored value, then list-normalize. Empty
// storage, a valid list, and the literal "null" string the broken saver
// wrote (JSON.stringify(null)) must all load as a list — never null —
// so `all.length` in the renderers cannot throw.
test('Polish #16: staff leave loads as a list for every app-produced store state', () => {
  const load = stored => normalizeStaffLeaveList(JSON.parse(stored || '[]'));
  assert.deepEqual(load('[]'), []);
  assert.deepEqual(load('"null"'), []);
  assert.deepEqual(load(JSON.stringify([leaveEntry])), [leaveEntry]);
  const loaded = load(JSON.stringify([leaveEntry]));
  assert.equal(loaded.length, 1);
});

test('Polish #16: staff training loads as a list for every app-produced store state', () => {
  const load = stored => normalizeStaffTrainingList(JSON.parse(stored || '[]'));
  assert.deepEqual(load('[]'), []);
  assert.deepEqual(load('"null"'), []);
  assert.deepEqual(load(JSON.stringify([trainingEntry])), [trainingEntry]);
  const loaded = load(JSON.stringify([trainingEntry]));
  assert.equal(loaded.length, 1);
});

// The saver contract: the list normalizer round-trips a list, and it
// never serializes to the literal "null" string the old saver stored.
test('Polish #16: staff leave and training save round-trips a list', () => {
  const leaveSaved = JSON.stringify(normalizeStaffLeaveList(recordStaffLeave([], leaveEntry)));
  assert.notEqual(leaveSaved, '"null"');
  assert.deepEqual(normalizeStaffLeaveList(JSON.parse(leaveSaved)), [leaveEntry]);
  const trainingSaved = JSON.stringify(normalizeStaffTrainingList(recordStaffTraining([], trainingEntry)));
  assert.notEqual(trainingSaved, '"null"');
  assert.deepEqual(normalizeStaffTrainingList(JSON.parse(trainingSaved)), [trainingEntry]);
});

// Polish #16, Req 1b — the catch must never toast a raw engine error
// again. Validation errors keep their clean message verbatim; a code
// bug (TypeError) becomes one generic line.
test('Polish #16: a TypeError becomes the generic save message, never the engine text', () => {
  const message = paymentSaveErrorMessage(new TypeError("Cannot read properties of null (reading 'length')"));
  assert.equal(message, 'Something went wrong while saving — please check the history; your payment may already be recorded.');
  assert.doesNotMatch(message, /Cannot read properties/);
});

test('Polish #16: a validation error keeps its clean message verbatim', () => {
  assert.equal(paymentSaveErrorMessage(new Error('Enter a valid payment date.')), 'Enter a valid payment date.');
  assert.equal(paymentSaveErrorMessage('Custom failure text'), 'Custom failure text');
  assert.equal(paymentSaveErrorMessage(null), '');
  assert.equal(paymentSaveErrorMessage(undefined), '');
});

test('Polish #16: onPaymentSubmit catches through the guard, not error.message', () => {
  assert.match(app, /catch \(error\) \{ toast\(paymentSaveErrorMessage\(error\), \{ type:'error', title:'Payment not saved' \}\); \}/);
  assert.doesNotMatch(app, /catch \(error\) \{ toast\(error\.message, \{ type:'error', title:'Payment not saved' \}\); \}/);
});
