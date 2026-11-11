// Billing & Ledger redesign (2026-11-11) — the Record Actual
// Payment form: progressive disclosure by method (§3), the
// submit-time group filter (§3.3), the large-cash pair (§3.4) and
// the double-submit guard extended from Quick Collect (§9).
// Pure-module behaviour is tested directly; the form wiring is
// pinned by source text (the established CSS/contract style) — the
// harness measures the true computed layout at 360/480/320px and
// records the numbers in the PR body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  paymentMethodGroup,
  filterPaymentFormFieldsForMethod,
} from '../billing-ledger-presentation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const styles = read('styles.css');

// --- Method-group matrix (§3.1/§3.2) ---

test('profile payment form: the form opens on the Cash group until a method is picked', () => {
  assert.equal(paymentMethodGroup(''), 'cash');
  assert.equal(paymentMethodGroup('Cash'), 'cash');
  assert.equal(paymentMethodGroup('JazzCash'), 'digital');
  assert.equal(paymentMethodGroup('Easypaisa'), 'digital');
});

test('profile payment form: Cash shows the payer + collection notes, Digital shows TID + sender + proof', () => {
  // The template tags every cell with its group; the visibility
  // function reads exactly those tags.
  assert.ok(app.includes('data-pay-group="cash">${paidByFieldMarkup'), 'paid-by is Cash-group');
  assert.ok(app.includes('data-pay-group="digital"'), 'digital cells exist');
  assert.ok(app.includes("for=\"txnid-${month}\""), 'TID cell exists');
  assert.ok(app.includes("for=\"sender-name-${month}\""), 'sender name cell exists');
  assert.ok(app.includes("for=\"sender-digits-${month}\""), 'sender digits cell exists');
  assert.ok(app.includes("for=\"proof-${month}\""), 'proof cell exists');
  assert.ok(app.includes("updatePaymentMethodGroups(form)"), 'groups applied on load');
  assert.ok(app.includes("methodSelect.addEventListener('change', () => updatePaymentMethodGroups(form))"), 'groups re-applied on method change');
});

test('profile payment form: the remainder-Waada row carries no pay group', () => {
  // The row manages its own visibility via renderRemRow (hidden
  // unless a partial payment exists). A data-pay-group="always"
  // would let updatePaymentMethodGroups un-hide it on every
  // method/threshold change, even with no partial payment.
  assert.ok(app.includes('<div class="profile-remwaada-row full" id="profile-remwaada-${month}" hidden></div>'), 'remwaada row has no group');
  assert.doesNotMatch(app, /profile-remwaada-row[^>]*data-pay-group/);
});

test('profile payment form: amount, method, bill month and date are always visible', () => {
  assert.ok(app.includes('data-pay-group="always"><label class="field-label full" for="amount-${month}"'), 'amount always');
  assert.ok(app.includes('data-pay-group="always"><label class="field-label full" for="method-${month}"'), 'method always');
  assert.ok(app.includes("billMonthSelectorFieldMarkup(`bms-${month}`, monthsForHistory(), month, 'always')"), 'bill month always');
  assert.ok(app.includes('data-pay-group="always"><label class="field-label full" for="date-${month}"'), 'date always');
});

test('profile payment form: the optional section holds third-party, collection, large-cash and category', () => {
  assert.ok(app.includes('<details class="pay-optional-details" data-pay-optional>'), 'optional details disclosure');
  assert.ok(app.includes("<summary>${t('pay_optional_details')}</summary>"), 'optional details summary');
  assert.ok(app.includes("crossPaymentNoteFieldsMarkup(`xpn-${month}`, customer.id, state.customers, 'thirdparty')"), 'third-party inside the section');
  assert.ok(app.includes("collectionPlaceNoteFieldsMarkup(`cpl-${month}`, undefined, 'cash')"), 'collection notes inside the section');
  assert.ok(app.includes("largeCashApprovalFieldsMarkup(`lca-${month}`, 'cash')"), 'large-cash inside the section');
  assert.ok(app.includes("categoryTagFieldMarkup(`ctg-${month}`, 'always')"), 'category inside the section');
  assert.ok(app.includes("urduNoteFieldMarkup(`urn-${month}`, undefined, 'always')"), 'Urdu note always visible');
});

test('profile payment form: the large-cash pair carries its own marker', () => {
  assert.ok(app.includes('data-pay-large-cash'), 'large-cash marker on the builder');
  assert.ok(app.includes("cell.hasAttribute('data-pay-large-cash')"), 'visibility reads the marker');
});

// --- Submit-time group filter (§3.3) ---

test('profile payment form: a cash save never stores a stale TID, sender or screenshot', () => {
  const input = {
    date: '2026-10-05', amount: 1000, method: 'Cash',
    transactionId: 'TX123', senderTitle: 'Hamza', senderDigits: '3310',
    screenshot: 'proof.png', paidBy: 'Ali',
  };
  const saved = filterPaymentFormFieldsForMethod('Cash', input);
  assert.equal(saved.transactionId, undefined);
  assert.equal(saved.senderTitle, undefined);
  assert.equal(saved.senderDigits, undefined);
  assert.equal(saved.screenshot, undefined);
  assert.equal(saved.paidBy, 'Ali');
  assert.equal(saved.amount, 1000);
  assert.equal(input.transactionId, 'TX123');
});

test('profile payment form: a digital save never stores a stale payer or collection note', () => {
  const input = {
    date: '2026-10-05', amount: 1000, method: 'JazzCash',
    paidBy: 'Ali', collectedBy: 'Saad', collectionPlace: 'field',
    collectionMohalla: 'Barrian', largeCashApproval: 'Owner',
    transactionId: 'TX123',
  };
  const saved = filterPaymentFormFieldsForMethod('JazzCash', input);
  assert.equal(saved.paidBy, undefined);
  assert.equal(saved.collectedBy, undefined);
  assert.equal(saved.collectionPlace, undefined);
  assert.equal(saved.collectionMohalla, undefined);
  assert.equal(saved.largeCashApproval, undefined);
  assert.equal(saved.transactionId, 'TX123');
  assert.equal(input.paidBy, 'Ali');
});

test('profile payment form: the submit passes the filtered fields to addPayment', () => {
  assert.ok(app.includes('filterPaymentFormFieldsForMethod(payMethod, {'), 'filter wraps the addPayment literal');
  assert.ok(app.includes("const payMethod = String(data.get('method') || '');"), 'method read once');
  assert.ok(app.includes("const payIsDigital = paymentMethodGroup(payMethod) === 'digital';"), 'digital flag from the group');
  // A TID duplicate check and a proof compression only run for a
  // digital method now — a cash save with a stale TID skips both.
  assert.ok(app.includes('if (payIsDigital && txnId) {'), 'TID check is digital-only');
  assert.ok(app.includes('if (payIsDigital && proofFile &&'), 'proof compression is digital-only');
});

// --- Large cash (§3.4) ---

test('profile payment form: the large-cash pair shows only while the typed amount exceeds the threshold', () => {
  assert.ok(app.includes("const showLargeCash = group === 'cash' && requiresLargeCashApproval(true, amountCents, thresholdCents);"), 'threshold rule');
  assert.ok(app.includes("if (cell.hasAttribute('data-pay-large-cash')) show = show && showLargeCash;"), 'pair gated on the threshold');
  assert.ok(app.includes("thresholdField.addEventListener('input', () => updatePaymentMethodGroups(form))"), 're-applied on threshold change');
  assert.ok(app.includes("amountField.addEventListener('input', () => updatePaymentMethodGroups(form))"), 're-applied on amount change');
});

test('profile payment form: the submit still refuses an unapproved large cash payment', () => {
  assert.ok(app.includes("requiresLargeCashApproval(isCashPaymentMethod(data.get('method')), Math.round(Number(data.get('amount')) * 100), profileLargeCashThresholdCents)"), 'large-cash check at submit');
});

// --- Double-submit guard (§9) ---

test('profile payment form: the Plan 437 guard instance guards this form too', () => {
  assert.ok(app.includes('const profilePaymentSaveGuard = createDoubleTapSaveGuard();'), 'guard instance');
  // Profile "Clear dues" (2026-11-11): the guard import gains
  // doubleTapSaveGuardSetDisabled — Clear dues disables its button
  // while the save is in flight, the same helper the guard module
  // already exported. The profile form's own guard use is unchanged.
  assert.ok(app.includes("import { createDoubleTapSaveGuard, doubleTapSaveGuardKey, doubleTapSaveGuardTryStart, doubleTapSaveGuardFinish, doubleTapSaveGuardSetDisabled } from './double-tap-save-guard.js';"), 'guard imported');
});

test('profile payment form: the guard starts before try and finishes in the finally', () => {
  assert.ok(app.includes('doubleTapSaveGuardTryStart(profilePaymentSaveGuard, profileSaveGuardKey)'), 'TryStart called');
  assert.ok(app.includes('doubleTapSaveGuardFinish(profilePaymentSaveGuard); if (submitBtn'), 'Finish in the finally');
  // The key names the payment — a second tap for the same payment is
  // ignored, a different payment still saves.
  assert.ok(app.includes('const profileSaveGuardKey = doubleTapSaveGuardKey({'), 'key built per submit');
  const keyBlock = app.slice(app.indexOf('const profileSaveGuardKey = doubleTapSaveGuardKey({'));
  for (const part of ['customerId,', "amount: data.get('amount'),", "method: data.get('method'),", 'month: payMonth,', "date: data.get('date'),"]) {
    assert.ok(keyBlock.includes(part), `key carries ${part}`);
  }
  // The three existing guards stay: button disable + aria-busy,
  // the SISP-146 detector and the TID confirm.
  assert.ok(app.includes("submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true');"), 'button guard stays');
  assert.ok(app.includes('findRecentDuplicate(state,'), 'SISP-146 detector stays');
  assert.ok(app.includes('duplicateTxnConfirm(txnId, dup)'), 'TID confirm stays');
});

// --- Form CSS (§3.2/DS §9.2) ---

test('profile payment form: inputs are 46px with the DS border and focus ring', () => {
  assert.ok(styles.includes('.payment-form input, .payment-form select, .bill-form input, .bill-form select { height: 46px; border: 1px solid var(--ds-input-border); border-radius: var(--radius-sm); }'), '46px inputs');
  assert.ok(styles.includes('.payment-form input:focus, .payment-form select:focus, .bill-form input:focus, .bill-form select:focus { border: 1.5px solid var(--ds-brand); box-shadow: 0 0 0 3px var(--ds-focus-ring); outline: none; }'), 'DS focus ring');
  assert.ok(styles.includes('.pay-optional-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }'), 'optional body is one column at phone widths');
});
