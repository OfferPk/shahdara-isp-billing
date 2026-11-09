// Plan 531 — The three "again" actions say where they go: the success
// screen offers three ways back that behave differently — next-steps
// "Collect again" reopens the form with the full-dues prefill, the
// repeat action reopens the same customer with an empty amount (Plan
// 490), and "Collect Another Customer" goes back to the picker with
// no customer. Wording only: the first two buttons now name what
// they open; the third stays exactly as is. No behaviour change to
// any of the three.
// Pattern-fake data only: Customer One (#41).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT,
  successNextStepsFromReceipt,
  successNextStepsHtml,
} from '../success-next-steps.js';
import {
  REPEAT_PAYMENT_BUTTON_TEXT,
  repeatPaymentFormTarget,
  repeatPaymentHtml,
} from '../repeat-payment.js';

const nextStepsSrc = readFileSync(new URL('../success-next-steps.js', import.meta.url), 'utf8');
const repeatSrc = readFileSync(new URL('../repeat-payment.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Same fixture as Plan 434: Customer One (#41) pays PKR 2,000 in
// cash, leaving PKR 1,000 still owed, due 2026-10-05.
const receipt = () => ({
  customerName: 'Customer One',
  customerNumber: 41,
  amount: 2000,
  payableRemaining: 1000,
  newTotalDues: 1000,
  date: '2026-11-07',
  method: 'Cash',
});

function buttonText(html, hook) {
  const match = html.match(new RegExp(`<button[^>]*${hook}[^>]*>([^<]*)</button>`));
  assert.ok(match, `expected a button carrying ${hook}`);
  return match[1];
}

test('labels: the collect-again button names the full-dues prefill', () => {
  assert.equal(SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT, 'Collect again — full dues');
  const html = successNextStepsHtml(successNextStepsFromReceipt(receipt(), '2026-10-05'));
  assert.equal(buttonText(html, 'data-sns-collect-again'), 'Collect again — full dues');
  assert.match(html, /<button type="button"[^>]*data-sns-collect-again/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('labels: the repeat button names the empty amount', () => {
  assert.equal(REPEAT_PAYMENT_BUTTON_TEXT, 'Record another — empty amount');
  const html = repeatPaymentHtml(repeatPaymentFormTarget('c1'));
  assert.equal(buttonText(html, 'data-rpt-repeat-payment'), 'Record another — empty amount');
  assert.match(html, /<button type="button"[^>]*data-rpt-repeat-payment/);
  assert.match(html, /data-rpt-customer-id="c1"/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('labels: the third action keeps its picker wording', () => {
  assert.ok(pageSrc.includes('id="quickCollectAnotherBtn"'), 'picker action missing from the page');
  assert.ok(pageSrc.includes('➕ Collect Another Customer'), 'picker action wording changed');
});

test('screen: all three again actions sit on the success step', () => {
  const stepAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(stepAt > 0, 'success step missing');
  const nextAt = pageSrc.indexOf('id="snsSuccessNextSteps"', stepAt);
  const repeatAt = pageSrc.indexOf('id="rptRepeatPayment"', stepAt);
  const anotherAt = pageSrc.indexOf('id="quickCollectAnotherBtn"', stepAt);
  assert.ok(nextAt > stepAt, 'next-steps panel missing from the success step');
  assert.ok(repeatAt > nextAt, 'repeat host must follow the next-steps panel');
  assert.ok(anotherAt > repeatAt, 'picker action must follow the repeat host');
});

test('behaviour: collect-again still reopens the form with the full-dues prefill', () => {
  const start = wiringSrc.indexOf('data-sns-collect-again');
  assert.ok(start > 0, 'wiring still listens for the collect-again hook');
  const slice = wiringSrc.slice(start, start + 400);
  assert.match(slice, /openCustomerCollectionForm\(activeCustomerId\)/);
  assert.doesNotMatch(slice, /emptyAmount/);
});

test('behaviour: repeat still opens a fresh form for the same customer with an empty amount', () => {
  const start = wiringSrc.indexOf('data-rpt-repeat-payment');
  assert.ok(start > 0, 'wiring still listens for the repeat hook');
  const slice = wiringSrc.slice(start, start + 600);
  assert.match(slice, /openCustomerCollectionForm\(customerId, \{ emptyAmount: true \}\)/);
  assert.doesNotMatch(slice, /addPayment|executeQuickCollection/);
});

test('labels: neither renamed button carries a money figure', () => {
  for (const label of [SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT, REPEAT_PAYMENT_BUTTON_TEXT]) {
    assert.doesNotMatch(label, /Rs|PKR|\$|€|£|USD|¥/);
    assert.doesNotMatch(label, /\d/);
  }
});

test('purity: no new element id, no new store key, no new module', () => {
  for (const src of [nextStepsSrc, repeatSrc]) {
    assert.doesNotMatch(src, / id="/);
    assert.doesNotMatch(src, /shahdara_[a-z_]+_v1/);
    assert.doesNotMatch(src, /localStorage|sessionStorage/);
    assert.doesNotMatch(src, /document\./);
  }
});
