// Plan 490 — Add payment: record another payment for the same
// customer, one tap after saving. The success screen offers a
// repeat action that opens a fresh Add payment form with the same
// customer already chosen and an empty amount — nothing else
// carried over. The tap records nothing by itself; the second
// payment is recorded only when the operator saves the fresh form,
// and leaving without saving records nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPEAT_PAYMENT_BUTTON_TEXT,
  repeatPaymentFormTarget,
  repeatPaymentHtml,
} from '../repeat-payment.js';

const moduleSrc = readFileSync(new URL('../repeat-payment.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('target: the same customer is kept, the amount is empty, nothing else is carried over', () => {
  const target = repeatPaymentFormTarget('seed-001');
  assert.deepEqual(target, { customerId: 'seed-001', amount: '' });
  assert.deepEqual(Object.keys(target).sort(), ['amount', 'customerId']);
  assert.equal(repeatPaymentFormTarget('  seed-001  ').customerId, 'seed-001');
});

test('target: no usable customer id means no repeat target', () => {
  assert.equal(repeatPaymentFormTarget(null), null);
  assert.equal(repeatPaymentFormTarget(undefined), null);
  assert.equal(repeatPaymentFormTarget(''), null);
  assert.equal(repeatPaymentFormTarget('   '), null);
  assert.equal(repeatPaymentFormTarget(41), null);
  assert.equal(repeatPaymentFormTarget({ id: 'seed-001' }), null);
});

test('html: one button that asks for the form and posts nothing by itself', () => {
  assert.equal(REPEAT_PAYMENT_BUTTON_TEXT, 'Record another payment');
  const html = repeatPaymentHtml(repeatPaymentFormTarget('seed-001'));
  assert.match(html, /<button type="button"[^>]*data-rpt-repeat-payment/);
  assert.match(html, /data-rpt-customer-id="seed-001"/);
  assert.match(html, /Record another payment/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('html: no button without a usable target, and never with an amount carried over', () => {
  assert.equal(repeatPaymentHtml(null), '');
  assert.equal(repeatPaymentHtml({}), '');
  assert.equal(repeatPaymentHtml({ customerId: '' }), '');
  assert.equal(repeatPaymentHtml({ customerId: 'seed-001' }), '');
  assert.equal(repeatPaymentHtml({ customerId: 'seed-001', amount: '2000' }), '');
  assert.equal(repeatPaymentHtml({ customerId: 'seed-001', amount: 0 }), '');
});

test('html: the customer id is escaped, and no money figure ever appears', () => {
  const html = repeatPaymentHtml(repeatPaymentFormTarget('cust-"1"<x>'));
  assert.doesNotMatch(html, /cust-"1"<x>/);
  assert.match(html, /cust-&quot;1&quot;&lt;x&gt;/);
  const clean = repeatPaymentHtml(repeatPaymentFormTarget('seed-001'));
  assert.doesNotMatch(clean, /Rs|PKR|\$|€|£|USD|¥/);
});

test('purity: the module is pure and standalone, with no store and no live handles', () => {
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /sessionStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /import /);
  assert.doesNotMatch(moduleSrc, /shahdara_[a-z_]+_v1/);
});

test('fences: the module header never names a fenced module literally', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('export const REPEAT_PAYMENT_BUTTON_TEXT'));
  for (const name of ['success-next-steps.js', 'add-payment-dues-buttons.js', 'quick-collect-second-connection.js', 'receipt-preview.js', 'cash-change-calculator.js', 'remembered-method.js', 'dues-amount-default.js', 'quick-collect-one-screen.js', 'name-prefix-lookup.js', 'recent-quick-pick.js', 'one-screen-quick-amounts.js', 'package-success-message.js', 'save-confirmation-summary.js', 'full-history-list.js']) {
    assert.ok(!header.includes(name), `header names fenced module ${name}`);
  }
});

test('styles: the button reuses the secondary-button look, so no new style enters', () => {
  assert.ok(!stylesSrc.includes('rpt-'), 'no rpt- rule in styles.css');
  const html = repeatPaymentHtml(repeatPaymentFormTarget('seed-001'));
  assert.match(html, /class="secondary-button rpt-repeat-payment"/);
});

test('wiring: the controller imports the repeat-payment module', () => {
  assert.match(wiringSrc, /repeat-payment\.js/);
  assert.match(wiringSrc, /repeatPaymentFormTarget/);
  assert.match(wiringSrc, /repeatPaymentHtml/);
});

test('wiring: the success screen renders the repeat action beside the next-steps panel', () => {
  assert.match(wiringSrc, /const repeatPaymentBox = /);
  assert.match(wiringSrc, /document\.getElementById\('rptRepeatPayment'\)/);
  assert.match(wiringSrc, /function renderRepeatPayment\(\)/);
  const start = wiringSrc.indexOf('function renderRepeatPayment()');
  const slice = wiringSrc.slice(start, start + 1200);
  assert.match(slice, /repeatPaymentFormTarget\(activeCustomerId\)/);
  assert.match(slice, /repeatPaymentHtml\(target\)/);
  assert.match(slice, /repeatPaymentBox\.hidden = /);
  assert.match(slice, /if \(!activeReceipt\)/);
});

test('wiring: the repeat action renders on every success path, single, split, and second connection', () => {
  const occurrences = wiringSrc.match(/renderRepeatPayment\(\);/g) || [];
  assert.ok(occurrences.length >= 3, `expected at least 3 render calls, found ${occurrences.length}`);
  for (const marker of ['renderSuccessNextSteps();']) {
    let at = -1;
    let count = 0;
    while ((at = wiringSrc.indexOf(marker, at + 1)) !== -1) {
      count += 1;
      assert.ok(wiringSrc.indexOf('renderRepeatPayment();', at) > at, 'repeat renders right after the next-steps panel');
      assert.ok(wiringSrc.indexOf('renderRepeatPayment();', at) - at < 80, 'repeat renders immediately after the next-steps panel');
    }
    assert.ok(count >= 3, `expected at least 3 next-steps renders, found ${count}`);
  }
});

test('wiring: the repeat tap opens a fresh form for the same customer with an empty amount', () => {
  const start = wiringSrc.indexOf('data-rpt-repeat-payment');
  assert.ok(start > 0, 'wiring listens for the repeat hook');
  const slice = wiringSrc.slice(start, start + 600);
  assert.match(slice, /openCustomerCollectionForm\(customerId, \{ emptyAmount: true \}\)/);
  assert.doesNotMatch(slice, /addPayment|executeQuickCollection/);
});

test('wiring: the form open honours the empty-amount repeat and hides the prefill line', () => {
  assert.match(wiringSrc, /function openCustomerCollectionForm\(customerId, options = \{\}\)/);
  const start = wiringSrc.indexOf('if (options && options.emptyAmount === true) {');
  assert.ok(start > 0, 'form open reads the empty-amount option');
  const slice = wiringSrc.slice(start, start + 500);
  assert.match(slice, /amountInput\.value = '';/);
  assert.match(slice, /prefillLine\.innerHTML = '';/);
  assert.match(slice, /prefillLine\.hidden = true;/);
});

test('wiring: Plan 434 collect-again still reopens the form with its usual prefill', () => {
  const start = wiringSrc.indexOf('data-sns-collect-again');
  assert.ok(start > 0, 'wiring still listens for the collect-again hook');
  const slice = wiringSrc.slice(start, start + 400);
  assert.match(slice, /openCustomerCollectionForm\(activeCustomerId\)/);
  assert.doesNotMatch(slice, /emptyAmount/);
});

test('wiring: the repeat host sits on the success step after the next-steps panel', () => {
  assert.ok(pageSrc.includes('id="rptRepeatPayment"'));
  const stepsAt = pageSrc.indexOf('id="snsSuccessNextSteps"');
  const hostAt = pageSrc.indexOf('id="rptRepeatPayment"');
  const actionsAt = pageSrc.indexOf('qc-success-actions');
  assert.ok(stepsAt > 0 && hostAt > stepsAt, 'repeat host follows the next-steps panel');
  assert.ok(actionsAt > hostAt, 'success actions follow the repeat host');
  const successAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(successAt > 0 && hostAt > successAt, 'repeat host sits inside the success step');
});
