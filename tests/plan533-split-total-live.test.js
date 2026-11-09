// Plan 533 — Split total is live on the form and on the confirm step.
//
// Leg 2's amount input had no input/change listener at all: typing
// the leg-2 amount updated nothing live, and the confirm summary
// listed "Leg 2 amount" and "Leg 2 method" with no total row, so the
// operator added leg 1 + leg 2 in their head to check the split
// against the dues. This plan adds a live "Split total: PKR X
// (leg 1 + leg 2)" line under the leg-2 fields that updates as
// either leg is typed, and a matching "Split total" row in the
// confirm summary. No change to leg recording, validation, or
// allocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatSplitTotalAmount,
  splitTotalLegAmount,
  splitTotalAmount,
  splitTotalLineText,
} from '../split-total.js';
import {
  normalizeSaveConfirmationSummary,
  saveConfirmationSummaryLines,
  saveConfirmationSummaryHtml,
} from '../save-confirmation-summary.js';

const moduleSrc = readFileSync(new URL('../split-total.js', import.meta.url), 'utf8');
const summarySrc = readFileSync(new URL('../save-confirmation-summary.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The acceptance fixture: leg 1 Rs 2,000, leg 2 typed Rs 1,000.
function entry(overrides = {}) {
  return {
    customerId: 'CUST-1',
    customerName: 'Customer One',
    mohalla: 'Mohalla A',
    amount: 2000,
    amountWords: 'Two thousand',
    method: 'Cash',
    billMonth: '2026-11',
    advance: false,
    advanceTargetMonth: '',
    legs: [{ amount: 1000, amountWords: 'One thousand', method: 'Easypaisa' }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure module — split-total.js
// ---------------------------------------------------------------------------

test('acceptance: leg 1 Rs 2,000 + leg 2 Rs 1,000 reads PKR 3,000 live', () => {
  assert.equal(splitTotalAmount(2000, 1000), 3000);
  assert.equal(splitTotalLineText(2000, 1000), 'Split total: PKR 3,000 (leg 1 + leg 2)');
});

test('formatting: PKR uses the app min-0 decimals, whole rupees print bare', () => {
  assert.equal(formatSplitTotalAmount(3000), 'PKR 3,000');
  assert.equal(formatSplitTotalAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatSplitTotalAmount(NaN), '');
  assert.equal(splitTotalLineText(1500.5, 0), 'Split total: PKR 1,500.5 (leg 1 + leg 2)');
});

test('figures: a leg not yet typed contributes nothing — never a negative, never a free payment', () => {
  assert.equal(splitTotalLegAmount(''), 0);
  assert.equal(splitTotalLegAmount(null), 0);
  assert.equal(splitTotalLegAmount(undefined), 0);
  assert.equal(splitTotalLegAmount(true), 0);
  assert.equal(splitTotalLegAmount('abc'), 0);
  assert.equal(splitTotalAmount('', 1000), 1000);
  assert.equal(splitTotalAmount(null, undefined), 0);
  assert.equal(splitTotalAmount('2,000', '1,000'), 3000);
});

test('figures: a negative leg contributes nothing, so a mistyped minus never shrinks the total', () => {
  assert.equal(splitTotalLegAmount(-500), 0);
  assert.equal(splitTotalAmount(2000, -500), 2000);
});

test('line: nothing typed yet means no line at all — never a "PKR 0" line', () => {
  assert.equal(splitTotalLineText('', ''), '');
  assert.equal(splitTotalLineText(0, 0), '');
  assert.equal(splitTotalLineText(null, null), '');
  assert.equal(splitTotalLineText(0, 'abc'), '');
});

test('line: one leg typed is already a total worth showing', () => {
  assert.equal(splitTotalLineText(2000, ''), 'Split total: PKR 2,000 (leg 1 + leg 2)');
  assert.equal(splitTotalLineText('', 1000), 'Split total: PKR 1,000 (leg 1 + leg 2)');
});

test('purity: the pure module touches no document, no storage, no clock', () => {
  assert.ok(!moduleSrc.includes('document.'), 'no document reads');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock');
});

test('purity: PKR only — no other currency symbol or code anywhere', () => {
  // '$' alone is the template-literal marker, so a dollar amount is
  // pinned as '$' followed by a digit instead.
  assert.ok(!/\$\d/.test(moduleSrc), 'no dollar amount in the module');
  for (const banned of ['€', '£', '¥', 'USD', 'EUR', 'GBP']) {
    assert.ok(!moduleSrc.includes(banned), `no ${banned} in the module`);
  }
});

// ---------------------------------------------------------------------------
// Confirm summary — the same total on the review step
// ---------------------------------------------------------------------------

test('confirm: the split total row shows the same PKR 3,000 as the live line', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry()));
  assert.deepEqual(lines.map((line) => line.label), [
    'Customer', 'Mohalla', 'Amount', 'Amount in words', 'Method',
    'Leg 2 amount', 'Leg 2 amount in words', 'Leg 2 method', 'Split total', 'Settles',
  ]);
  assert.equal(lines.find((line) => line.label === 'Split total').value, 'PKR 3,000');
});

test('confirm: no legs means no Split total row — a single payment keeps exactly its old lines', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry({ legs: [] })));
  assert.deepEqual(lines.map((line) => line.label), [
    'Customer', 'Mohalla', 'Amount', 'Amount in words', 'Method', 'Settles',
  ]);
});

test('confirm: every extra leg joins the total — leg 1 + leg 2 + leg 3', () => {
  const lines = saveConfirmationSummaryLines(normalizeSaveConfirmationSummary(entry({
    legs: [
      { amount: 1000, method: 'Easypaisa' },
      { amount: 500, method: 'JazzCash' },
    ],
  })));
  assert.equal(lines.find((line) => line.label === 'Split total').value, 'PKR 3,500');
  assert.equal(lines.find((line) => line.label === 'Leg 3 amount').value, 'PKR 500');
});

test('confirm: the HTML panel carries the Split total row', () => {
  const html = saveConfirmationSummaryHtml(normalizeSaveConfirmationSummary(entry()));
  assert.ok(html.includes('<dt>Split total</dt><dd>PKR 3,000</dd>'));
});

// ---------------------------------------------------------------------------
// Wiring — the live line on the form
// ---------------------------------------------------------------------------

test('page: the line sits inside the split fields, under the leg-2 row, hidden by default', () => {
  const splitAt = pageSrc.indexOf('id="quickCollectSplitFields"');
  assert.ok(splitAt > 0, 'split fields block exists');
  const block = pageSrc.slice(splitAt, splitAt + 2500);
  assert.ok(block.includes('id="quickCollectSplitAmountInput"'), 'leg-2 amount input is in the block');
  const lineAt = block.indexOf('qc-split-total-line');
  assert.ok(lineAt > 0, 'the line is in the split fields block');
  assert.ok(lineAt > block.indexOf('quickCollectSplitAmountInput'), 'the line sits under the leg-2 fields');
  assert.ok(lineAt < block.indexOf('id="quickCollectSplitDigitalFields"'), 'the line sits above the digital fields');
  assert.ok(block.includes('<p class="field-help qc-split-total-line" hidden>'), 'field-help line, hidden by default');
});

test('page: the line carries no id — the class hook is the only hook, so no new prefix is consumed', () => {
  assert.ok(!pageSrc.includes('id="qc-split-total'), 'no split-total id in the page');
  assert.ok(!pageSrc.match(/id="[^"]*split-total[^"]*"/), 'no split-total id anywhere');
});

test('wiring: the wiring imports the pure line text and renders it through the split fields block', () => {
  assert.ok(
    wiringSrc.includes("import { splitTotalLineText } from './split-total.js';"),
    'pure line text imported',
  );
  assert.ok(
    wiringSrc.includes("splitFields.querySelector('.qc-split-total-line')"),
    'line found through the split fields block, never the bare document',
  );
  assert.ok(
    wiringSrc.includes("typeof splitFields.querySelector === 'function'"),
    'lookup guarded for stub documents without querySelector (polish #13 harness)',
  );
  assert.ok(
    wiringSrc.includes('function renderSplitTotal() {'),
    'renderSplitTotal defined',
  );
  assert.ok(
    wiringSrc.includes("const line = splitToggle?.checked ? splitTotalLineText(amountInput?.value, splitAmountInput?.value) : '';"),
    'split off means no line at all',
  );
});

test('wiring: the total follows every keystroke in either leg', () => {
  assert.ok(
    wiringSrc.includes("amountInput?.addEventListener('input', () => renderSplitTotal());"),
    'leg 1 (amount field) typing re-renders the total',
  );
  assert.ok(
    wiringSrc.includes("splitAmountInput?.addEventListener('input', () => renderSplitTotal());"),
    'leg 2 (split amount field) typing re-renders the total',
  );
});

test('wiring: toggling the split — or reopening the sheet, which resets it — re-renders the total', () => {
  const visAt = wiringSrc.indexOf('function updateSplitVisibility()');
  assert.ok(visAt > 0, 'updateSplitVisibility exists');
  const body = wiringSrc.slice(visAt, visAt + 600);
  assert.ok(body.includes('renderSplitTotal();'), 'visibility change re-renders the total');
});

test('wiring: the four programmatic leg-1 setters re-render the total the same way a typed amount does', () => {
  const calls = (wiringSrc.match(/renderSplitTotal\(\);/g) || []).length;
  assert.equal(calls, 5, `five statement calls (visibility + dues buttons + chips + keypad + loose change), found ${calls}`);
  for (const note of [
    'Plan 533: a button-set amount',
    'Plan 533: a chip-set amount',
    'Plan 533: a keypad-set amount',
    'Plan 533: a loose-change tap',
  ]) {
    assert.ok(wiringSrc.includes(note), `setter note present: ${note}`);
  }
});

test('wiring: the Plan 527 pins still hold — no sixth split change listener, no extra next-receipt call', () => {
  const splitListeners = (wiringSrc.match(/splitToggle\?\.addEventListener\('change'/g) || []).length;
  assert.equal(splitListeners, 5, `five split change listeners, found ${splitListeners}`);
  const receiptCalls = (wiringSrc.match(/renderNextReceiptLine\(\);/g) || []).length;
  assert.equal(receiptCalls, 3, `three next-receipt calls, found ${receiptCalls}`);
});

// ---------------------------------------------------------------------------
// Boundaries — leg recording, validation, allocation, and the neighbours
// ---------------------------------------------------------------------------

test('boundary: the submit still reads leg 2 exactly as before — recording untouched', () => {
  assert.ok(
    wiringSrc.includes('const leg2Amount = Number(splitAmountInput?.value);'),
    'submit read unchanged',
  );
  assert.ok(
    summarySrc.includes("const splitTotal = summary.amount + summary.legs.reduce((sum, leg) => sum + leg.amount, 0);"),
    'confirm total is a read-only sum, not a recording change',
  );
});

test('boundary: the polish #19 undo capture still stands — splitLegs captured before nulling', () => {
  assert.ok(
    wiringSrc.includes('splitLegs: undoSplitLegs'),
    'executeUndo still captures the legs before nulling the context',
  );
});

test('boundary: no new element-id prefix, no store key, no new hex', () => {
  assert.ok(!moduleSrc.includes('localStorage'), 'no store key in the pure module');
  assert.ok(!wiringSrc.includes('qc-split-total-line" hidden id='), 'no id on the line element');
});
