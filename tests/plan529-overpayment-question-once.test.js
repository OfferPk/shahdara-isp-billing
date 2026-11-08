// Plan 529 — Overpayment question is asked once: when the typed
// amount exceeds the dues, two controls ask what the extra is for —
// the overpayment radios under the amount field ("Keep as advance" /
// "Hold as credit balance") and the "Extra cash is for" select inside
// More Options (Advance / Credit / Change to return) — and the submit
// path stores both, so an operator who picks "credit" in the radios
// and "advance" in the select records a self-contradictory payment.
// While the overpayment choice box is shown the select is disabled
// (with a note) and the radios own the question; when the box hides
// the select works exactly as before. No change to what either
// control records when used alone, and no change to the "Change to
// return" option, which the radios lack.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const componentsSrc = fs.readFileSync(path.join(ROOT, '../components.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan529-overpayment-question-once.test.js'), 'utf8');

const SEP_5 = new Date(2026, 8, 5, 12);

// One open bill at PKR 3,000: total dues PKR 3,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDuesCents(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues;
}

function recordedPayment(nextState, receipt) {
  const customer = nextState.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === '2026-09');
  return bill.payments.find((entry) => entry.id === receipt.paymentId);
}

// ---- The note in the page ----

test('Plan 529: the note sits directly after the excess-purpose select, hidden, and names the overpayment choice', () => {
  const selectAt = indexSrc.indexOf('id="quickCollectExcessCashPurposeSelect"');
  const noteAt = indexSrc.indexOf('qc-excess-purpose-note');
  const nextSectionAt = indexSrc.indexOf('<!-- Plan 397', selectAt);
  assert.ok(selectAt > 0, 'the excess-purpose select must exist');
  assert.ok(noteAt > selectAt, 'the note must follow the select');
  assert.ok(noteAt < nextSectionAt, 'the note must sit inside the same field group, before the next section');
  assert.ok(indexSrc.includes('<p class="field-help qc-excess-purpose-note" hidden>Covered by the overpayment choice above.</p>'),
    'the note must start hidden and say the overpayment choice covers the extra');
  // The note names no figure and no currency — it is a pointer, not a second amount.
  const noteText = 'Covered by the overpayment choice above.';
  assert.ok(!/PKR|Rs|\\d/.test(noteText), 'the note must carry no figure');
});

test('Plan 529: the select keeps all three purposes, including Change to return', () => {
  assert.ok(indexSrc.includes('<option value="advance">Advance — toward future bills</option>'));
  assert.ok(indexSrc.includes('<option value="credit">Credit — hold as credit balance</option>'));
  assert.ok(indexSrc.includes('<option value="change">Change to return</option>'));
});

// ---- The wiring in the render ----

test('Plan 529: the render disables the select exactly while the choice box is shown', () => {
  const renderAt = navSrc.indexOf('function renderOverpaymentChoice()');
  const nextFnAt = navSrc.indexOf('function renderUnderpaymentWarning()', renderAt);
  const body = navSrc.slice(renderAt, nextFnAt);
  assert.ok(body.includes('overpaymentChoiceBox.hidden = extraCents <= 0;'), 'the box still hides on no extra');
  assert.ok(body.includes('excessCashPurposeSelect.disabled = !overpaymentChoiceBox.hidden;'),
    'the select must be disabled exactly while the box is shown, enabled when it hides');
});

test('Plan 529: the note shows and hides with the choice box', () => {
  const renderAt = navSrc.indexOf('function renderOverpaymentChoice()');
  const nextFnAt = navSrc.indexOf('function renderUnderpaymentWarning()', renderAt);
  const body = navSrc.slice(renderAt, nextFnAt);
  assert.ok(body.includes('excessPurposeNote.hidden = overpaymentChoiceBox.hidden;'),
    'the note must show exactly while the box is shown, hide when it hides');
});

test('Plan 529: the note is found through the select\'s own field group — no new element id', () => {
  assert.ok(navSrc.includes("excessCashPurposeSelect.parentElement.querySelector('.qc-excess-purpose-note')"),
    'the note must be found through the select\'s own field group, never through the bare document');
  assert.ok(navSrc.includes("typeof excessCashPurposeSelect.parentElement.querySelector === 'function'"),
    'the lookup must be guarded for stub documents without querySelector');
  assert.ok(!indexSrc.includes('qcExcessPurposeNote'), 'the note must carry no id');
  assert.ok(!navSrc.includes("getElementById('qcExcessPurposeNote')"), 'the wiring must not fetch the note by id');
  assert.equal((indexSrc.match(/qc-excess-purpose-note/g) || []).length, 1, 'the hook class appears once, on the note itself');
});

// ---- Acceptance: one question, one answer ----

test('Plan 529: acceptance — choosing a radio records exactly one disposition', () => {
  const state = stateWithBills(SEP_5);
  assert.equal(totalDuesCents(state), 300000);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3500, date: '2026-09-05', method: 'Cash',
    overpaymentChoice: 'credit', overpaymentDuesCents: 300000,
  }, SEP_5);
  const payment = recordedPayment(nextState, receipt);
  assert.deepEqual(payment.overpaymentChoice, { choice: 'credit', extraCents: 50000 });
  assert.equal('excessCashNote' in payment, false, 'a radio choice alone must record no excess note');
});

test('Plan 529: acceptance — the select used alone records exactly as before', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3500, date: '2026-09-05', method: 'Cash',
    excessCashNote: 'change', excessCashDuesCents: 300000,
  }, SEP_5);
  const payment = recordedPayment(nextState, receipt);
  assert.deepEqual(payment.excessCashNote, { purpose: 'change', extraCents: 50000 });
  assert.equal('overpaymentChoice' in payment, false, 'a select purpose alone must record no overpayment choice');
});

test('Plan 529: acceptance — at the dues the select works as before', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
    excessCashNote: 'advance', excessCashDuesCents: 300000,
  }, SEP_5);
  const payment = recordedPayment(nextState, receipt);
  assert.equal('excessCashNote' in payment, false, 'with no excess the validator still drops the note, as before');
  assert.equal(payment.amount, 3000);
});

// ---- Guards ----

test('Plan 529: the note reuses the existing helper style — no new rule, no new hex, no new id prefix', () => {
  assert.ok(indexSrc.includes('class="field-help qc-excess-purpose-note"'), 'the note reuses the existing field-help style');
  assert.ok(!stylesSrc.includes('.qc-excess-purpose-note'), 'no new rule in styles.css');
  assert.ok(!componentsSrc.includes('.qc-excess-purpose-note'), 'no new rule in components.css');
  assert.ok(!/\.qc-excess-purpose-note\s*\{[^}]*#[0-9a-fA-F]{3,8}/.test(stylesSrc + componentsSrc), 'no new hex anywhere for the note');
});

test('Plan 529: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.ok(!testSrc.includes(name), `test carries a real customer name: ${name}`);
  }
});
