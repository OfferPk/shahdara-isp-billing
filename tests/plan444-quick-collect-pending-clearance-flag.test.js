// Plan 444 — Quick Collect pending clearance flag at entry for transfer
// and cheque: one plain line on the Quick Collect screen while the
// chosen method is a bank transfer or a cheque, saying the bill
// settles only when the money clears. The flag shows before the save
// on the entry form and after the save on the success screen; it
// flags only and clears nothing, and the payment still records
// normally as pending.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PENDING_CLEARANCE_FLAG_TEXT,
  pendingClearanceFlagForMethod,
  pendingClearanceFlagForReceipt,
} from '../pending-clearance-flag.js';

const moduleSrc = readFileSync(new URL('../pending-clearance-flag.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Generic fixture receipt: one ordinary single payment, November 2026.
function receipt(extra = {}) {
  return {
    id: 'rcpt-1',
    receiptNumber: 'RCPT-41-202611-01',
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 3000,
    method: 'Cash',
    date: '2026-11-07',
    month: '2026-11',
    phone: '03012345678',
    ...extra,
  };
}

// Generic fixture split receipt: two legs, one combined total.
function splitReceipt() {
  return {
    id: 'rcpt-2',
    receiptNumber: 'RCPT-41-202611-02',
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 5000,
    method: 'Cash + JazzCash',
    date: '2026-11-07',
    month: '2026-11',
    phone: '03012345678',
    splitTender: {
      legs: [
        { leg: 1, receiptNumber: 'RCPT-41-202611-01', method: 'Cash', amount: 3000 },
        { leg: 2, receiptNumber: 'RCPT-41-202611-02', method: 'JazzCash', amount: 2000 },
      ],
      totalReceivedCents: 500000,
      totalReceived: 5000,
      date: '2026-11-07',
      month: '2026-11',
    },
  };
}

// --- The flag text ---

test('constants: the flag text is the plan wording, plain words', () => {
  assert.equal(PENDING_CLEARANCE_FLAG_TEXT, 'pending clearance — bill settles when cleared');
});

// --- One method: transfer flags ---

test('method: every bank-transfer spelling flags', () => {
  for (const method of [
    'Bank Transfer',
    'bank transfer',
    'bank_transfer',
    'BANK_TRANSFER',
    'Bank_Transfer',
    '  Bank Transfer  ',
    'bank  transfer',
  ]) {
    assert.equal(pendingClearanceFlagForMethod(method), PENDING_CLEARANCE_FLAG_TEXT, `expected a flag for ${JSON.stringify(method)}`);
  }
});

// --- One method: cheque flags ---

test('method: every cheque spelling flags', () => {
  for (const method of ['Cheque', 'cheque', 'CHEQUE', ' cheque ', 'Cheque ']) {
    assert.equal(pendingClearanceFlagForMethod(method), PENDING_CLEARANCE_FLAG_TEXT, `expected a flag for ${JSON.stringify(method)}`);
  }
});

// --- One method: nothing else flags ---

test('method: cash, wallet, Raast and shop methods never flag', () => {
  for (const method of [
    'Cash',
    'JazzCash',
    'Easypaisa',
    'NayaPay',
    'Raast',
    'Cash at Waseem Abbasi shop',
    'Cash at Hassan shop',
    'Cash at Balla shop',
  ]) {
    assert.equal(pendingClearanceFlagForMethod(method), '', `expected no flag for ${JSON.stringify(method)}`);
  }
});

test('method: a blank, damaged, or unknown method never flags — never a guess', () => {
  for (const method of ['', '   ', null, undefined, 123, true, false, {}, [], 'BankTransfer', 'bank-transfer', 'transfer', 'online', 'Bank']) {
    assert.equal(pendingClearanceFlagForMethod(method), '', `expected no flag for ${String(method)}`);
  }
});

// --- A saved receipt: single payment ---

test('receipt: a single transfer or cheque payment flags', () => {
  assert.equal(pendingClearanceFlagForReceipt(receipt({ method: 'Bank Transfer' })), PENDING_CLEARANCE_FLAG_TEXT);
  assert.equal(pendingClearanceFlagForReceipt(receipt({ method: 'bank_transfer' })), PENDING_CLEARANCE_FLAG_TEXT);
  assert.equal(pendingClearanceFlagForReceipt(receipt({ method: 'Cheque' })), PENDING_CLEARANCE_FLAG_TEXT);
});

test('receipt: a single cash, wallet, or Raast payment never flags', () => {
  for (const method of ['Cash', 'JazzCash', 'Easypaisa', 'NayaPay', 'Raast', 'Cash at Waseem Abbasi shop']) {
    assert.equal(pendingClearanceFlagForReceipt(receipt({ method })), '', `expected no flag for ${method}`);
  }
});

test('receipt: no receipt, or a receipt with no usable method, never flags', () => {
  assert.equal(pendingClearanceFlagForReceipt(null), '');
  assert.equal(pendingClearanceFlagForReceipt(undefined), '');
  assert.equal(pendingClearanceFlagForReceipt([]), '');
  assert.equal(pendingClearanceFlagForReceipt({}), '');
  assert.equal(pendingClearanceFlagForReceipt(receipt({ method: '' })), '');
  assert.equal(pendingClearanceFlagForReceipt(receipt({ method: null })), '');
});

// --- A saved receipt: split collection ---

test('receipt: a split flags when any one leg is a transfer or a cheque', () => {
  const transferLeg = splitReceipt();
  transferLeg.splitTender.legs[1].method = 'Bank Transfer';
  assert.equal(pendingClearanceFlagForReceipt(transferLeg), PENDING_CLEARANCE_FLAG_TEXT);
  const chequeLeg = splitReceipt();
  chequeLeg.splitTender.legs[0].method = 'Cheque';
  assert.equal(pendingClearanceFlagForReceipt(chequeLeg), PENDING_CLEARANCE_FLAG_TEXT);
});

test('receipt: a split with no transfer or cheque leg never flags', () => {
  assert.equal(pendingClearanceFlagForReceipt(splitReceipt()), '');
});

test('receipt: a split combined method names both legs, so the legs decide — never the joined words', () => {
  // 'Cash + JazzCash' as one string is no method at all; the legs
  // below it are Cash and JazzCash, so nothing flags.
  assert.equal(pendingClearanceFlagForReceipt(splitReceipt()), '');
  const joined = splitReceipt();
  joined.method = 'Cash + Bank Transfer';
  joined.splitTender.legs[0].method = 'Cash';
  joined.splitTender.legs[1].method = 'JazzCash';
  assert.equal(pendingClearanceFlagForReceipt(joined), '');
});

test('receipt: a split with no leg list never flags', () => {
  const noLegs = splitReceipt();
  delete noLegs.splitTender.legs;
  noLegs.method = 'Cash';
  assert.equal(pendingClearanceFlagForReceipt(noLegs), '');
});

test('receipt: the input receipt is never mutated', () => {
  const input = splitReceipt();
  input.splitTender.legs[1].method = 'Bank Transfer';
  const before = JSON.stringify(input);
  pendingClearanceFlagForReceipt(input);
  assert.equal(JSON.stringify(input), before);
});

// --- Purity and fences ---

test('purity: the module reads no storage, clock, or page and takes no other module', () => {
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /sessionStorage/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /^import /m);
  assert.doesNotMatch(moduleSrc, /window\./);
});

test('fences: the header names no fenced module file literally', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('export const PENDING_CLEARANCE_FLAG_TEXT'));
  for (const fenced of [
    'payment-clearance.js',
    'big-wallet-method-buttons.js',
    'remembered-method.js',
    'receipt-preview.js',
    'success-next-steps.js',
    'receipt-share-draft.js',
    'quick-collect-amount-keypad.js',
    'last-four-digits-search.js',
    'quick-collect-still-owes.js',
    'quick-collect-round-totals.js',
    'double-tap-save-guard.js',
    'offline-saved-badge.js',
    'quick-collect-reversal-undo.js',
    'cash-change-calculator.js',
    'dues-amount-default.js',
    'quick-collect-one-screen.js',
    'name-prefix-lookup.js',
    'recent-quick-pick.js',
    'one-screen-quick-amounts.js',
    'daily-entry-summary.js',
  ]) {
    assert.ok(!header.includes(fenced), `header must not name ${fenced}`);
  }
});

test('fences: the closest modules never carry a pending-clearance-flag name', () => {
  for (const file of [
    'payment-clearance.js',
    'big-wallet-method-buttons.js',
    'receipt-preview.js',
    'success-next-steps.js',
    'receipt-share-draft.js',
  ]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('pendingClearanceFlag'), `${file} must not reference the flag`);
    assert.ok(!src.includes('pcfPendingClearanceFlag'), `${file} must not reference the form host`);
    assert.ok(!src.includes('pcfSuccessPendingClearanceFlag'), `${file} must not reference the success host`);
  }
});

// --- Wiring: the entry form ---

test('wiring: the Quick Collect controller imports the flag', () => {
  assert.ok(wiringSrc.includes("from './pending-clearance-flag.js'"), 'missing module import');
  assert.ok(wiringSrc.includes('pendingClearanceFlagForMethod, pendingClearanceFlagForReceipt'), 'missing flag imports');
});

test('wiring: the form host is read under the method picker', () => {
  assert.ok(wiringSrc.includes("getElementById('pcfPendingClearanceFlag')"), 'missing form host lookup');
});

test('wiring: the form render reads the select and flags by the module rule', () => {
  assert.ok(wiringSrc.includes('function renderPendingClearanceFlag()'), 'missing form render function');
  const fn = wiringSrc.slice(wiringSrc.indexOf('function renderPendingClearanceFlag()'));
  assert.ok(fn.includes("methodSelect ? String(methodSelect.value || '') : ''"), 'render must read the select value');
  assert.ok(fn.includes('pendingClearanceFlagForMethod(method)'), 'render must flag by the module rule');
  assert.ok(fn.includes('pendingClearanceFlagEl.textContent = flag;'), 'render must write the flag as plain text');
  assert.ok(fn.includes("pendingClearanceFlagEl.hidden = flag === '';"), 'render must hide when there is no flag');
});

test('wiring: every method change refreshes the flag through the method sync', () => {
  const sync = wiringSrc.slice(wiringSrc.indexOf('function syncMethodChips(val)'), wiringSrc.indexOf('function syncMethodChips(val)') + 1200);
  assert.ok(sync.includes('renderPendingClearanceFlag();'), 'method sync must refresh the flag');
  const calls = wiringSrc.match(/renderPendingClearanceFlag\(\);/g) || [];
  assert.equal(calls.length, 1, `expected 1 form render call (inside the method sync), got ${calls.length}`);
});

// --- Wiring: the success screen ---

test('wiring: the success host is read on the success step', () => {
  assert.ok(wiringSrc.includes("getElementById('pcfSuccessPendingClearanceFlag')"), 'missing success host lookup');
});

test('wiring: the success render flags from the saved receipt and clears with no receipt', () => {
  assert.ok(wiringSrc.includes('function renderSuccessPendingClearanceFlag()'), 'missing success render function');
  const fn = wiringSrc.slice(wiringSrc.indexOf('function renderSuccessPendingClearanceFlag()'));
  assert.ok(fn.includes('pendingClearanceFlagForReceipt(activeReceipt)'), 'render must flag from the saved receipt');
  assert.ok(fn.includes('if (!activeReceipt)'), 'render must clear when nothing is saved yet');
  assert.ok(fn.includes('successPendingClearanceFlagEl.textContent = flag;'), 'render must write the flag as plain text');
});

test('wiring: the flag renders on both success paths and refreshes with the receipt card', () => {
  const calls = wiringSrc.match(/renderSuccessPendingClearanceFlag\(\);/g) || [];
  assert.equal(calls.length, 3, `expected 3 success render calls (split save, single save, card re-render), got ${calls.length}`);
  const cardFn = wiringSrc.slice(
    wiringSrc.indexOf('function renderActiveReceiptCard()'),
    wiringSrc.indexOf('function renderSuccessNextSteps()'),
  );
  assert.ok(cardFn.includes('renderSuccessPendingClearanceFlag();'), 'card re-render must refresh the flag');
});

// --- Page and styles ---

test('page: the form host sits in the method group, after the shop row, and starts hidden', () => {
  const stepAt = pageSrc.indexOf('id="quickCollectStepForm"');
  const hostAt = pageSrc.indexOf('id="pcfPendingClearanceFlag"');
  const selectAt = pageSrc.indexOf('id="quickCollectMethodSelect"');
  const shopAt = pageSrc.indexOf('id="quickCollectShopRow"');
  assert.ok(stepAt !== -1 && hostAt > stepAt, 'host must be inside the form step');
  assert.ok(hostAt > selectAt, 'host must sit after the method select');
  assert.ok(hostAt > shopAt, 'host must sit after the shop row');
  assert.ok(pageSrc.includes('id="pcfPendingClearanceFlag" class="upw-warning"'), 'host reuses the warning style');
  assert.ok(pageSrc.includes('id="pcfPendingClearanceFlag" class="upw-warning" aria-live="polite" hidden'), 'host starts hidden');
});

test('page: the success host sits on the success step, after the still-owes line, and starts hidden', () => {
  const stepAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  const hostAt = pageSrc.indexOf('id="pcfSuccessPendingClearanceFlag"');
  const owesAt = pageSrc.indexOf('id="sowStillOwesLine"');
  const badgeAt = pageSrc.indexOf('id="osbOfflineSavedBadge"');
  assert.ok(stepAt !== -1 && hostAt > stepAt, 'host must be inside the success step');
  assert.ok(hostAt > owesAt, 'host must sit after the still-owes line');
  assert.ok(hostAt < badgeAt, 'host must sit before the saved badge');
  assert.ok(pageSrc.includes('id="pcfSuccessPendingClearanceFlag" class="upw-warning"'), 'host reuses the warning style');
  assert.ok(pageSrc.includes('id="pcfSuccessPendingClearanceFlag" class="upw-warning" aria-live="polite" hidden'), 'host starts hidden');
});

test('styles: the flag reuses an existing warning class — no new rule, no new colour', () => {
  assert.ok(!stylesSrc.includes('pcf-'), 'no pending-clearance rule belongs in styles.css');
});

test('constants: the flag text is plain words', () => {
  assert.equal(PENDING_CLEARANCE_FLAG_TEXT, 'pending clearance — bill settles when cleared');
});
