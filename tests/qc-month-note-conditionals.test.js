// QC Month & Note Details — the optional section shows only the fields
// that apply right now (QC month-note task, D1–D8).
//
// What it pins:
// - The five conditional groups exist with ids in index.html and the
//   wiring toggles them from the right control (D1/D2/D4/D5/D8).
// - The per-payment threshold input is gone from the QC form; the
//   submit reads the standing module default instead (D3). The profile
//   form keeps its own threshold input — untouched by this task.
// - The cross-payment note records only while another payer is picked:
//   a stale typed name under 'Account holder paid' records nothing (D1).
// - The approver shows exactly when the submit gate requires it: cash
//   AND amount strictly above the threshold (D4 — the spec's ">=" is
//   wrong; at the threshold exactly no approval is needed).
// - The excess-purpose select hides only while a positive amount within
//   the dues is typed and nothing is picked yet (D5 — not the literal
//   spec, which would show it only in its disabled state and kill
//   'Change to return').
// - Hidden values are preserved in the DOM; the submit and core's
//   validator drop what does not apply (D6).
// - Exactly five splitToggle change listeners (Plan 527 pin — the split
//   leg is covered through updateSplitVisibility, never a new listener).
// - The two bottom CTAs are untouched (item 4 belongs to the Step 2
//   task).
//
// This file pins visibility, not parity: it asserts no parity total and
// carries no parity literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LARGE_CASH_DEFAULT_THRESHOLD_CENTS,
  requiresLargeCashApproval,
  normalizeLargeCashApproval,
} from '../large-cash-approval.js';
import {
  normalizeExcessCashNote,
  excessCashExtraCents,
} from '../excess-cash-note.js';
import { overpaymentExtraCents } from '../overpayment-choice.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');

const THRESHOLD = LARGE_CASH_DEFAULT_THRESHOLD_CENTS;
const DUES_CENTS = 100000; // PKR 1,000 — the fixture dues in the prep's §9.

test('QC month-note C1: payer name + relationship groups have ids and the wiring toggles them from the payer pick', () => {
  assert.equal(indexSrc.includes('id="quickCollectCrossPayerNameField"'), true);
  assert.equal(indexSrc.includes('id="quickCollectCrossRelationshipField"'), true);
  assert.equal(navSrc.includes("document.getElementById('quickCollectCrossPayerNameField')"), true);
  assert.equal(navSrc.includes("document.getElementById('quickCollectCrossRelationshipField')"), true);
  assert.equal(navSrc.includes('function renderMonthNoteConditionals()'), true);
  assert.equal(navSrc.includes("crossPayerSelect?.addEventListener('change', () => renderMonthNoteConditionals());"), true);
  const renderFn = navSrc.slice(navSrc.indexOf('function renderMonthNoteConditionals()'));
  assert.ok(renderFn.includes("if (crossPayerNameField) crossPayerNameField.hidden = !payerOther;"), 'payer name hides under account-holder paid');
  assert.ok(renderFn.includes("if (crossRelationshipField) crossRelationshipField.hidden = !payerOther;"), 'relationship hides under account-holder paid');
});

test('QC month-note C2: advance-target group has an id and the wiring toggles it from the Advance checkbox', () => {
  assert.equal(indexSrc.includes('id="quickCollectAdvanceTargetField"'), true);
  assert.equal(navSrc.includes("document.getElementById('quickCollectAdvanceTargetField')"), true);
  assert.equal(navSrc.includes("advanceCheckbox?.addEventListener('change', () => renderMonthNoteConditionals());"), true);
  const renderFn = navSrc.slice(navSrc.indexOf('function renderMonthNoteConditionals()'));
  assert.ok(renderFn.includes('if (advanceTargetField) advanceTargetField.hidden = !advanceCheckbox?.checked;'), 'target hides unless Advance is ticked');
});

test('QC month-note C3: the per-payment threshold input is gone from the QC form; the approver input remains; the profile form is untouched', () => {
  assert.equal(indexSrc.includes('id="quickCollectLargeCashThreshold"'), false);
  assert.equal(indexSrc.includes('id="quickCollectLargeCashApprover"'), true);
  assert.equal(appSrc.includes('name="largeCashThreshold"'), true, 'profile form keeps its own threshold input');
});

test('QC month-note C4: approver group has an id and the wiring shows it exactly when the large-cash rule requires one', () => {
  assert.equal(indexSrc.includes('id="quickCollectLargeCashApproverField"'), true);
  assert.equal(navSrc.includes("document.getElementById('quickCollectLargeCashApproverField')"), true);
  // Leg-1 cents only, mirroring the submit gate — leg 2 gets no own
  // large-cash check (verified: requiresLargeCashApproval is called
  // once in the submit path, on leg 1's amount).
  assert.equal(navSrc.includes('requiresLargeCashApproval(isCashPaymentMethod(methodVal), leg1Cents, LARGE_CASH_DEFAULT_THRESHOLD_CENTS)'), true);
  const renderFn = navSrc.slice(navSrc.indexOf('function renderMonthNoteConditionals()'));
  assert.ok(renderFn.includes('if (largeCashApproverField) largeCashApproverField.hidden = !needsApproval;'), 'approver hides unless approval is required');
});

test('QC month-note C5: excess-purpose group has an id and hides only while a positive amount within the dues is typed and nothing is picked', () => {
  assert.equal(indexSrc.includes('id="quickCollectExcessCashField"'), true);
  assert.equal(navSrc.includes("document.getElementById('quickCollectExcessCashField')"), true);
  const renderFn = navSrc.slice(navSrc.indexOf('function renderMonthNoteConditionals()'));
  // The tender is both legs when split is on — the same combined
  // figure renderOverpaymentChoice uses.
  assert.ok(renderFn.includes("const tenderCents = leg1Cents + (splitToggle?.checked ? Math.round(Number(splitAmountInput?.value || 0) * 100) : 0);"), 'tender combines both split legs');
  assert.ok(renderFn.includes('if (excessCashField) excessCashField.hidden = tenderCents > 0 && tenderCents <= payableCents && !excessPurposePicked;'), 'hides only in the within-dues, nothing-picked window');
});

test('QC month-note C6: the submit gates the cross-payment note on another payer being picked', () => {
  assert.equal(navSrc.includes('crossPayerIdVal && crossPayerName ?'), true);
  // The gate's semantics: a stale typed name under 'Account holder
  // paid' (empty payer id) records nothing, even with a name typed.
  const gated = (id, name) => (id && name ? { payerName: name, payerCustomerId: id || undefined } : undefined);
  assert.equal(gated('', 'Test Name'), undefined);
  assert.equal(gated('seed-002', 'Test Name')?.payerName, 'Test Name');
  assert.equal(gated('seed-002', ''), undefined);
});

test('QC month-note C7: the submit reads the threshold from the module default', () => {
  assert.equal(navSrc.includes('const largeCashThresholdCents = LARGE_CASH_DEFAULT_THRESHOLD_CENTS;'), true);
  assert.equal(THRESHOLD, 1000000, 'the standing default is PKR 10,000 in cents');
});

test('QC month-note C8: no reference to the removed threshold input remains in the wiring', () => {
  assert.equal(navSrc.includes('largeCashThresholdInput'), false);
  assert.equal(navSrc.includes('quickCollectLargeCashThreshold'), false);
});

test('QC month-note C9 (no-touch guard): both bottom CTAs are still present — item 4 belongs to the Step 2 task', () => {
  assert.equal(indexSrc.includes('id="quickCollectDirectSaveBtn"'), true);
  assert.equal(indexSrc.includes('id="quickCollectConfirmBtn"'), true);
});

test('QC month-note D8: the render runs from every control its conditions read — payer, Advance, amount, split amount, method, split toggle, form open', () => {
  assert.equal(navSrc.includes("crossPayerSelect?.addEventListener('change', () => renderMonthNoteConditionals());"), true);
  assert.equal(navSrc.includes("advanceCheckbox?.addEventListener('change', () => renderMonthNoteConditionals());"), true);
  assert.equal(navSrc.includes("amountInput?.addEventListener('input', () => renderMonthNoteConditionals());"), true);
  assert.equal(navSrc.includes("splitAmountInput?.addEventListener('input', () => renderMonthNoteConditionals());"), true);
  // One definition + seven call sites (method change, the four
  // listeners above, updateSplitVisibility, form open).
  assert.equal(navSrc.split('renderMonthNoteConditionals()').length - 1, 8);
});

test('QC month-note D8: exactly five splitToggle change listeners (Plan 527 pin holds)', () => {
  assert.equal(navSrc.split("splitToggle?.addEventListener('change'").length - 1, 5);
});

test('QC month-note boundaries: at the threshold exactly no approval is needed; one paisa above it, cash needs one; non-cash never does', () => {
  assert.equal(requiresLargeCashApproval(true, THRESHOLD, THRESHOLD), false, 'amount == threshold: no approval (the spec >= is wrong)');
  assert.equal(requiresLargeCashApproval(true, THRESHOLD + 1, THRESHOLD), true, 'one paisa above: approval required');
  assert.equal(requiresLargeCashApproval(true, THRESHOLD + 500000, THRESHOLD), true);
  assert.equal(requiresLargeCashApproval(false, THRESHOLD + 500000, THRESHOLD), false, 'non-cash never needs approval, however large');
  // The validator self-cleans a hidden approver value: kept only when
  // approval is actually required.
  assert.equal(normalizeLargeCashApproval('AB', { isCash: true, amountCents: THRESHOLD, thresholdCents: THRESHOLD }), null);
  assert.deepEqual(normalizeLargeCashApproval('AB', { isCash: true, amountCents: THRESHOLD + 1, thresholdCents: THRESHOLD }), { by: 'AB' });
  // The excess note drops at amount == dues and is kept above; the
  // overpayment extra is 0 at the dues and positive above.
  assert.equal(normalizeExcessCashNote({ purpose: 'change' }, DUES_CENTS, DUES_CENTS), null);
  assert.deepEqual(normalizeExcessCashNote({ purpose: 'change' }, DUES_CENTS, DUES_CENTS + 50000), { purpose: 'change', extraCents: 50000 });
  assert.equal(excessCashExtraCents(DUES_CENTS, DUES_CENTS), 0);
  assert.equal(excessCashExtraCents(DUES_CENTS, DUES_CENTS + 50000), 50000);
  assert.equal(overpaymentExtraCents(DUES_CENTS, DUES_CENTS), 0);
  assert.equal(overpaymentExtraCents(DUES_CENTS, DUES_CENTS + 50000), 50000);
});
