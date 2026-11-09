/**
 * plan546-tid-sender-digits-ask-what-they-use.test.js — Plan 546
 *
 * The TID label invited the exact input that defeats the duplicate guard:
 * it read "Transaction ID / Ref (Last 6+ digits)" while duplicate
 * detection is an EXACT normalized equality (core.js
 * findDuplicatePaymentReference), so a last-6 entry never matches a full
 * TID already recorded. And the sender-digits label reads "Sender Account
 * Last 4 Digits" while both Quick Collect inputs allowed 19 characters,
 * inviting a full account number — even though core keeps only the last 4
 * (.slice(-4)).
 *
 * Pins:
 *  - the leg-1 TID label no longer says "Last 6+ digits" and asks for the
 *    full ID; its placeholder names the full ID too;
 *  - both Quick Collect sender-digits inputs (leg 1 and leg 2) refuse a
 *    5th digit (maxlength="4"); no other input's maxlength changes;
 *  - a full TID still duplicate-detects, while its last 6 digits do not
 *    (exact equality — the behaviour the new label now matches);
 *  - a >4-digit senderDigits value arriving another way is still stored
 *    as the last 4 only (the pre-existing .slice(-4) safety, unchanged).
 *
 * Scope note: the profile payment form and the correction form in app.js
 * still carry maxlength="19" on their sender-digits inputs — Plan 546
 * covers the Quick Collect legs only; those two forms are a future plan's
 * job, not a silent fix here.
 *
 * Synthetic data only — the TID is the UI's own placeholder example and
 * the digits are an invented 19-digit account string, never a real
 * customer's reference or account number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addCustomer,
  saveBillMonth,
  addPayment,
  findDuplicatePaymentReference,
} from '../core.js';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function labelFor(inputId) {
  const match = indexHtml.match(
    new RegExp(`<label for="${inputId}"[^>]*>([\\s\\S]*?)<\\/label>`)
  );
  assert.ok(match, `label for ${inputId} exists in index.html`);
  return stripTags(match[1]);
}

function inputTag(inputId) {
  const match = indexHtml.match(
    new RegExp(`<input id="${inputId}"[^>]*>`)
  );
  assert.ok(match, `input #${inputId} exists in index.html`);
  return match[0];
}

function maxlengthOf(inputId) {
  const tag = inputTag(inputId);
  const match = tag.match(/maxlength="(\d+)"/);
  assert.ok(match, `#${inputId} carries a maxlength`);
  return match[1];
}

function placeholderOf(inputId) {
  const tag = inputTag(inputId);
  const match = tag.match(/placeholder="([^"]*)"/);
  assert.ok(match, `#${inputId} carries a placeholder`);
  return match[1];
}

const MONTH = '2026-10';
const REF = new Date('2026-10-20');
const FULL_TID = '12345678901';

function setupWithFullTid() {
  let state = { customers: [] };
  state = addCustomer(state, 'Plan 546 Alpha', REF, { phone: '03001111111', area: 'Main Bazaar' });
  const a = state.customers[0];
  state = saveBillMonth(state, a.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  state = addPayment(state, a.id, MONTH, {
    date: '2026-10-15', amount: 2000, method: 'JazzCash', transactionId: FULL_TID,
  }, REF);
  return { state, a };
}

test('Plan 546 REPRO: TID label asks for the full ID, never "Last 6+ digits"', () => {
  const label = labelFor('quickCollectTransactionIdInput');
  assert.doesNotMatch(label, /Last 6\+ digits/, 'label no longer invites a last-6 entry');
  assert.match(label, /full ID/, 'label asks for the full reference');
  assert.match(label, /Transaction ID \/ Ref/, 'label still names the field');
});

test('Plan 546 REPRO: TID placeholder names the full ID', () => {
  const placeholder = placeholderOf('quickCollectTransactionIdInput');
  assert.match(placeholder, /full ID/, 'placeholder says the full ID is wanted');
  assert.match(placeholder, /12345678901/, 'placeholder still shows a full 11-digit example');
});

test('Plan 546 REPRO: leg-1 sender-digits input refuses a 5th digit', () => {
  assert.equal(maxlengthOf('quickCollectSenderDigitsInput'), '4');
  const label = labelFor('quickCollectSenderDigitsInput');
  assert.match(label, /Last 4 Digits/, 'label still says last 4 digits');
});

test('Plan 546 REPRO: leg-2 sender-digits input refuses a 5th digit', () => {
  assert.equal(maxlengthOf('quickCollectSplitSenderDigitsInput'), '4');
  const label = labelFor('quickCollectSplitSenderDigitsInput');
  assert.match(label, /Last 4 Digits/, 'leg-2 label still says last 4 digits');
});

test('Plan 546: a full TID still duplicate-detects; its last 6 digits do not', () => {
  const { state, a } = setupWithFullTid();
  const dup = findDuplicatePaymentReference(state, FULL_TID);
  assert.ok(dup, 'the full TID is found');
  assert.equal(dup.customerId, a.id);
  // The exact-equality rule: only the last 6 digits never match the full
  // TID already recorded — which is why the label must ask for the full ID.
  assert.equal(findDuplicatePaymentReference(state, FULL_TID.slice(-6)), null);
  // Normalisation still works for the full reference.
  assert.ok(findDuplicatePaymentReference(state, `  ${FULL_TID}  `));
});

test('Plan 546: a >4-digit senderDigits value is still stored as the last 4 only', () => {
  let state = { customers: [] };
  state = addCustomer(state, 'Plan 546 Beta', REF, { phone: '03002222222', area: 'Main Bazaar' });
  const b = state.customers[0];
  state = saveBillMonth(state, b.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  state = addPayment(state, b.id, MONTH, {
    date: '2026-10-15', amount: 2000, method: 'JazzCash', transactionId: 'TXN-546-TEST-001',
    senderTitle: 'Test Sender', senderDigits: '1234567890123456789',
  }, REF);
  const bill = state.customers.find((c) => c.id === b.id).bills.find((x) => x.month === MONTH);
  const payment = bill.payments[bill.payments.length - 1];
  assert.equal(payment.senderDigits, '6789', 'only the last 4 digits survive, even past maxlength');
});

test('Plan 546 wiring: only the two QC sender-digits inputs changed; nothing else moved', () => {
  // No maxlength="19" left anywhere in the Quick Collect markup.
  assert.equal((indexHtml.match(/maxlength="19"/g) || []).length, 0);
  // The neighbouring inputs keep their limits.
  assert.equal(maxlengthOf('quickCollectTransactionIdInput'), '64');
  assert.equal(maxlengthOf('quickCollectSenderNameInput'), '100');
  assert.equal(maxlengthOf('quickCollectSplitTransactionIdInput'), '64');
  assert.equal(maxlengthOf('quickCollectSplitSenderNameInput'), '100');
  // "Last 6+ digits" appears nowhere in the page any more.
  assert.doesNotMatch(indexHtml, /Last 6\+ digits/);
  // The leg-2 TID label never said "Last 6+" and still does not.
  assert.doesNotMatch(labelFor('quickCollectSplitTransactionIdInput'), /Last 6/);
});
