/**
 * plan516-prorata-only-when-dirty.test.js — Plan 516: the pro-rata
 * preview appears only when money changes.
 *
 * The "Mid-Month Package Pro-Rata Preview" block
 * (#packageChangeProrataPreview) sits in the edit form between the
 * last field and Save, with its three save-option checkboxes (voucher,
 * round-to-Rs-50, rounding mode) inside it. Its visibility used to be
 * decided by a stored-vs-typed comparison alone, which disagreed with
 * the form's own dirty rule (Plan 499: differs from BOTH the stored
 * record AND the value the form opened with — the rule the per-field
 * Save buttons use):
 * - a whitespace-padded stored package ("10 Mbps ") reads as changed
 *   against the trimmed input, so the block showed on an untouched form;
 * - a package/rate reverted to its open value after a per-field save
 *   still differs from the stored record, so the block showed although
 *   the field reads clean by the form's own rule;
 * - a per-field save of the package/rate never re-ran the preview at
 *   all (the per-field save deliberately does not re-render the form),
 *   so a just-saved change kept reading as a bill about to be paid.
 * The fix gates the preview on the Plan 499 dirty check for the two
 * money keys, keeps the maths preconditions (a real plan/rate change,
 * both rates above zero), and re-syncs the preview after a per-field
 * save. The pro-rata maths itself is untouched.
 * Synthetic data only; no bill, payment, package-history, or lifecycle
 * record is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { dirtyProfileFieldKeys } from '../profile-field-save.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

function previewFunctionSource() {
  const app = read('app.js');
  const start = app.indexOf('function renderProfileProrataPreview() {');
  assert.notEqual(start, -1, 'renderProfileProrataPreview must exist');
  const end = app.indexOf('\nasync function restoreCustomer', start);
  assert.notEqual(end, -1, 'renderProfileProrataPreview must end cleanly');
  return app.slice(start, end);
}

const ctrl = (id, type, value, checked = false) => ({ id, type, value, checked });
const openFrom = (controls) => Object.fromEntries(
  controls.map((c) => [c.id, { type: c.type, value: c.value, checked: c.checked }]),
);

// Runs the extracted preview function against a stubbed form: the
// customer record, the three inputs the preview reads, and the
// open-time snapshot the Plan 499 dirty check compares against.
// The maths is stubbed (it is untouched by this plan — Plan 46 pins
// it); only visibility and the rendered PKR figures are asserted.
function runPreview({ customer, inputs, snapshot }) {
  const container = { hidden: true };
  const badge = { textContent: '', className: '' };
  const breakdown = { innerHTML: '' };
  const calcBill = { textContent: '' };
  const netAdj = { textContent: '', style: {} };
  const controls = [
    ctrl('packageSpeedInput', 'text', inputs.packageSpeed),
    ctrl('monthlySellingAmountInput', 'number', inputs.selling),
    ctrl('phoneInput', 'tel', inputs.phone ?? '03012345678'),
  ];
  const form = { querySelectorAll: () => controls };
  const elements = {
    '#packageChangeProrataPreview': container,
    '#packageSpeedInput': { value: inputs.packageSpeed },
    '#monthlySellingAmountInput': { value: inputs.selling },
    '#roundProrataCreditCheckbox': { checked: false },
    '#roundProrataModeSelect': { value: 'nearest' },
    '#prorataPreviewDeltaBadge': badge,
    '#prorataPreviewDaysBreakdown': breakdown,
    '#prorataCalculatedBill': calcBill,
    '#prorataNetAdjustment': netAdj,
    '#customerProfileForm': form,
  };
  const context = {
    $: (selector) => elements[selector] ?? null,
    selectedCustomer: () => customer,
    calculatePlanMigrationProration: () => ({
      effectiveDay: 15, daysInMonth: 30, daysElapsed: 14,
      oldPlanCostElapsed: 1000, oldPlanCredit: 0, daysRemaining: 16,
      newPlanCharge: 1250, netAdjustment: 250, proRatedCurrentBill: 2250,
    }),
    dateKey: () => '2026-11-15',
    t: (key, _ctx, params) => (params ? `${key}(${JSON.stringify(params)})` : key),
    roundToNearest50: (n) => n,
    dirtyProfileFieldKeys,
    profileCancelOpenValues: snapshot,
  };
  runInNewContext(`${previewFunctionSource()}\nrenderProfileProrataPreview();`, context);
  return { hidden: container.hidden, bill: calcBill.textContent, adj: netAdj.textContent, badge: badge.textContent };
}

const BASE_CUSTOMER = { packageSpeed: '10 Mbps', monthlySellingAmount: 2000 };
const OPEN_CONTROLS = [
  ctrl('packageSpeedInput', 'text', '10 Mbps'),
  ctrl('monthlySellingAmountInput', 'number', '2000'),
  ctrl('phoneInput', 'tel', '03012345678'),
];
const OPEN_SNAPSHOT = openFrom(OPEN_CONTROLS);

// ------------------------------------------------------------ the rule itself

test('Plan 516: the dirty gate is written down as a code comment at the preview', () => {
  const src = previewFunctionSource();
  assert.ok(src.includes('Plan 516 — the preview is a money preview'), 'rule comment must sit at renderProfileProrataPreview');
  assert.ok(src.includes('Plan 499 dirty rule'), 'rule must name the Plan 499 dirty rule it reuses');
  assert.ok(src.includes('per-field Save'), 'rule must name the per-field Save buttons that share the rule');
});

test('Plan 516: the preview gates on the Plan 499 dirty check for the two money keys', () => {
  const src = previewFunctionSource();
  assert.ok(src.includes('dirtyProfileFieldKeys(customer, [...form.querySelectorAll(\'input, select, textarea\')], profileCancelOpenValues)'), 'preview must use the shared dirty check over the form controls and the open-time snapshot');
  assert.ok(src.includes("dirtyMoneyKeys.has('packageSpeed') || dirtyMoneyKeys.has('monthlySellingAmount')"), 'preview must show only when the package or the selling amount is dirty');
  assert.ok(src.includes('if (moneyDirty && (planChanged || rateChanged) && currentRate > 0 && newRate > 0) {'), 'show must need money-dirty AND a real plan/rate change AND both rates above zero');
});

test('Plan 516: the pro-rata maths branch is untouched', () => {
  const src = previewFunctionSource();
  assert.ok(src.includes('calculatePlanMigrationProration(currentRate, newRate, todayStr)'), 'preview must still compute from the stored and typed rates');
  assert.ok(src.includes("badge.textContent = t('prof_prorata_badge'"), 'badge must still render');
  assert.ok(src.includes("breakdown.innerHTML = `"), 'days breakdown must still render');
  assert.ok(src.includes('calcBill.textContent = `PKR ${proration.proRatedCurrentBill.toLocaleString()}`'), 'calculated bill must still render in PKR');
  assert.ok(src.includes('netAdj.textContent = `${sign}PKR ${effectiveAdjustment.toLocaleString()}'), 'net adjustment must still render in PKR');
  assert.ok(src.includes('roundToNearest50(Math.abs(proration.netAdjustment), roundMode)'), 'the SISP-131 round-to-Rs-50 credit path must stay');
});

test('Plan 516: a per-field save re-syncs the preview (the full save hides it via renderDetail)', () => {
  const app = read('app.js');
  const saveStart = app.indexOf('async function saveProfileField(');
  assert.notEqual(saveStart, -1, 'saveProfileField must exist');
  const saveEnd = app.indexOf('\nfunction bindProfileFieldSaveButtons()', saveStart);
  assert.notEqual(saveEnd, -1, 'saveProfileField must end cleanly');
  const saveFn = app.slice(saveStart, saveEnd);
  assert.ok(saveFn.includes('renderCustomers();'), 'per-field save must refresh the customer list');
  assert.ok(saveFn.includes('renderProfileProrataPreview();'), 'per-field save must re-sync the preview so a just-saved money change hides it');
  assert.ok(saveFn.indexOf('renderProfileProrataPreview();') > saveFn.indexOf('renderCustomers();'), 'the preview re-sync must run after the stored record is updated');
  assert.ok(saveFn.includes('Plan 516 — the pro-rata preview is a money preview'), 'the re-sync must carry the Plan 516 comment');
});

test('Plan 516: the three save-option checkboxes live inside the preview block, so they hide with it', () => {
  const html = read('index.html');
  const blockStart = html.indexOf('id="packageChangeProrataPreview"');
  assert.notEqual(blockStart, -1, 'the preview block must exist in the form');
  const blockEnd = html.indexOf('profile-form-actions', blockStart);
  assert.notEqual(blockEnd, -1, 'the Save row must follow the preview block');
  const block = html.slice(blockStart, blockEnd);
  assert.ok(block.includes('id="saveProrataVoucherCheckbox"'), 'voucher checkbox must sit inside the preview block');
  assert.ok(block.includes('id="roundProrataCreditCheckbox"'), 'round-to-Rs-50 checkbox must sit inside the preview block');
  assert.ok(block.includes('id="roundProrataModeSelect"'), 'rounding-mode select must sit inside the preview block');
});

// ------------------------------------------------------------ visibility behaviour

test('Plan 516: opening the form for a phone-number fix shows no pro-rata block', () => {
  const result = runPreview({
    customer: { ...BASE_CUSTOMER, phone: '03012345678' },
    inputs: { packageSpeed: '10 Mbps', selling: '2000', phone: '03012345679' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, true, 'a phone-only fix must not show the money preview');
});

test('Plan 516: an untouched form shows no block, even when the stored package is whitespace-padded', () => {
  const paddedSnapshot = openFrom([
    ctrl('packageSpeedInput', 'text', '10 Mbps '),
    ctrl('monthlySellingAmountInput', 'number', '2000'),
    ctrl('phoneInput', 'tel', '03012345678'),
  ]);
  const result = runPreview({
    customer: { packageSpeed: '10 Mbps ', monthlySellingAmount: 2000 },
    inputs: { packageSpeed: '10 Mbps ', selling: '2000' },
    snapshot: paddedSnapshot,
  });
  assert.equal(result.hidden, true, 'a stored package that only differs by whitespace is not a money change');
});

test('Plan 516: changing the package reveals the block with the correct preview', () => {
  const result = runPreview({
    customer: { ...BASE_CUSTOMER },
    inputs: { packageSpeed: '20 Mbps', selling: '2000' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, false, 'a package change must reveal the preview');
  assert.equal(result.bill, 'PKR 2,250', 'calculated bill must be the pro-rated figure in PKR');
  assert.equal(result.adj, '+PKR 250', 'net adjustment must carry its sign in PKR');
  assert.ok(result.badge.includes('+PKR 250'), 'badge must carry the signed PKR adjustment');
});

test('Plan 516: changing the selling amount reveals the block with the correct preview', () => {
  const result = runPreview({
    customer: { ...BASE_CUSTOMER },
    inputs: { packageSpeed: '10 Mbps', selling: '2500' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, false, 'a selling-amount change must reveal the preview');
  assert.equal(result.bill, 'PKR 2,250');
  assert.equal(result.adj, '+PKR 250');
});

test('Plan 516: a no-op rate retype shows no block', () => {
  const result = runPreview({
    customer: { ...BASE_CUSTOMER },
    inputs: { packageSpeed: '10 Mbps', selling: '2000.0' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, true, '2000 -> 2000.0 changes no money, so no preview');
});

test('Plan 516: reverting the package to its open value after a per-field save hides the block', () => {
  const result = runPreview({
    customer: { packageSpeed: '20 Mbps', monthlySellingAmount: 2000 },
    inputs: { packageSpeed: '10 Mbps', selling: '2000' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, true, 'back to the open value reads clean by the form\'s own dirty rule, although it still differs from the stored record');
});

test('Plan 516: reverting the selling amount to its open value after a per-field save hides the block', () => {
  const result = runPreview({
    customer: { packageSpeed: '10 Mbps', monthlySellingAmount: 2500 },
    inputs: { packageSpeed: '10 Mbps', selling: '2000' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, true, 'back to the open value reads clean by the form\'s own dirty rule');
});

test('Plan 516: saving hides the block again — the stored record now matches the form', () => {
  const result = runPreview({
    customer: { packageSpeed: '20 Mbps', monthlySellingAmount: 2500 },
    inputs: { packageSpeed: '20 Mbps', selling: '2500' },
    snapshot: OPEN_SNAPSHOT,
  });
  assert.equal(result.hidden, true, 'once the money change is saved, a re-run of the preview must hide it');
});
