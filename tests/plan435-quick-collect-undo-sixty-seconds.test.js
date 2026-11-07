// Plan 435 — Quick Collect undo within sixty seconds.
// One undo action on the success screen, available for sixty
// seconds after saving, which reverses that payment through the
// reversal link and returns to the entry form. It undoes only
// that one payment and only within the window; it never deletes
// any bill, payment, or customer record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS,
  QUICK_COLLECT_REVERSAL_UNDO_REASON,
  quickCollectReversalUndoIsStrictDate,
  quickCollectReversalUndoAllowed,
  quickCollectReversalUndoSecondsLeft,
  quickCollectReversalUndoButtonText,
  quickCollectReversalUndoIsPlainPayment,
  quickCollectReversalUndoFields,
} from '../quick-collect-reversal-undo.js';
import { addPayment } from '../core.js';
import {
  reversalLinkOf,
  isReversalEntry,
  reversalEntryOf,
  reversalLinkMarkup,
  reversalPairNetCents,
  reversalNetsToZero,
} from '../reversal-link.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'quick-collect-reversal-undo.js'), 'utf8');
const wiringSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const pageSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const REF = new Date('2026-11-07T10:00:00Z');
const PAYMENT_DATE = '2026-11-07';
const SAVED_AT = 1000000;

function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

// Generic fixtures only — clearly made-up names, never a real person.
function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

function paymentsOf(state, month = '2026-11') {
  return state.customers[0].bills.find((b) => b.month === month).payments;
}

function stateWithOriginal() {
  let state = stateWith(customerWithBills([bill('2026-11', 3000), bill('2026-10', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
  }, REF);
  const original = paymentsOf(state)[0];
  return { state, original };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('strict date: leap-aware, YYYY-MM-DD only', () => {
  assert.equal(quickCollectReversalUndoIsStrictDate('2024-02-29'), true);
  assert.equal(quickCollectReversalUndoIsStrictDate('2023-02-29'), false);
  assert.equal(quickCollectReversalUndoIsStrictDate('2026-11-31'), false);
  assert.equal(quickCollectReversalUndoIsStrictDate('2026-13-01'), false);
  assert.equal(quickCollectReversalUndoIsStrictDate('2026-11-7'), false);
  assert.equal(quickCollectReversalUndoIsStrictDate(null), false);
  assert.equal(quickCollectReversalUndoIsStrictDate(20261107), false);
});

// ---------------------------------------------------------------------------
// Sixty-second window
// ---------------------------------------------------------------------------

test('window: undo allowed within sixty seconds of saving', () => {
  assert.equal(QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS, 60000);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT), true);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 1000), true);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 59999), true);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 60000), true);
});

test('window: refused after sixty seconds, before the save, or on unusable instants', () => {
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 60001), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 120000), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT - 1), false);
  assert.equal(quickCollectReversalUndoAllowed(NaN, SAVED_AT), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, Infinity), false);
  assert.equal(quickCollectReversalUndoAllowed('1000000', SAVED_AT + 1000), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, null), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, true), false);
  assert.equal(quickCollectReversalUndoAllowed(undefined, SAVED_AT), false);
});

test('seconds left: counts down 60 to 0, never negative, never a guess', () => {
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT), 60);
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT + 30000), 30);
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT + 59999), 1);
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT + 60000), 0);
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT + 60001), 0);
  assert.equal(quickCollectReversalUndoSecondsLeft(SAVED_AT, SAVED_AT - 1), 0);
  assert.equal(quickCollectReversalUndoSecondsLeft(null, SAVED_AT), 0);
});

test('button text: plain words with the seconds left, never a guess', () => {
  assert.equal(quickCollectReversalUndoButtonText(60), '↩ Undo by reversal (60s)');
  assert.equal(quickCollectReversalUndoButtonText(1), '↩ Undo by reversal (1s)');
  assert.equal(quickCollectReversalUndoButtonText(59.5), '↩ Undo by reversal (59s)');
  assert.equal(quickCollectReversalUndoButtonText(0), '↩ Undo by reversal');
  assert.equal(quickCollectReversalUndoButtonText(61), '↩ Undo by reversal');
  assert.equal(quickCollectReversalUndoButtonText(NaN), '↩ Undo by reversal');
});

// ---------------------------------------------------------------------------
// Plain-payment eligibility
// ---------------------------------------------------------------------------

test('plain payment: a payment that only moved money is offered the undo', () => {
  assert.equal(quickCollectReversalUndoIsPlainPayment({}), true);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: [], addonCharges: [] }), true);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: null, addonCharges: undefined }), true);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ hasWaiver: false, hasWaadaStamp: false }), true);
});

test('plain payment: settled charges, a waiver, or a touched promise keep the five-second undo', () => {
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: [{ amount: 500 }] }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ addonCharges: [{ amount: 200 }] }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ hasWaiver: true }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ hasWaadaStamp: true }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ ticketCharges: 'not-a-list' }), false);
  assert.equal(quickCollectReversalUndoIsPlainPayment({ addonCharges: 42 }), false);
});

// ---------------------------------------------------------------------------
// Reversing-entry fields
// ---------------------------------------------------------------------------

test('fields: the reversing entry is the negative of the original, linked by reference', () => {
  const fields = quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash' },
    { date: PAYMENT_DATE, reason: 'Wrong amount entered' },
  );
  assert.deepEqual(fields, {
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: {
      reversesPaymentId: 'P-ORIG',
      reason: 'Wrong amount entered',
      date: PAYMENT_DATE,
    },
  });
  assert.equal(QUICK_COLLECT_REVERSAL_UNDO_REASON, 'Undone within sixty seconds');
});

test('fields: a missing reason reads as the plain default, an over-long one is cut', () => {
  const blank = quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash' },
    { date: PAYMENT_DATE, reason: '   ' },
  );
  assert.equal(blank.reversalLink.reason, 'Undone within sixty seconds');
  const long = quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash' },
    { date: PAYMENT_DATE, reason: `line one\nline two ${'x'.repeat(300)}` },
  );
  assert.equal(long.reversalLink.reason.length, 200);
  assert.equal(long.reversalLink.reason.includes('\n'), false);
  assert.equal(long.reversalLink.reason.startsWith('line one line two'), true);
});

test('fields: null when the original cannot be reversed', () => {
  const base = { id: 'P-ORIG', amount: 3000, method: 'Cash' };
  const options = { date: PAYMENT_DATE, reason: 'Wrong amount entered' };
  assert.equal(quickCollectReversalUndoFields(null, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, id: '  ' }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, id: undefined }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: 0 }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: -3000 }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: '3000' }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: null }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: true }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: NaN }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, amount: 3000.005 }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, method: '' }, options), null);
  assert.equal(quickCollectReversalUndoFields({ ...base, method: undefined }, options), null);
  assert.equal(quickCollectReversalUndoFields(base, { ...options, date: '2026-11-31' }), null);
  assert.equal(quickCollectReversalUndoFields(base, { ...options, date: undefined }), null);
});

test('fields: paisa amounts reverse exactly, never rounded away', () => {
  const fields = quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 1500.5, method: 'JazzCash' },
    { date: PAYMENT_DATE },
  );
  assert.equal(fields.amount, -1500.5);
  assert.equal(fields.method, 'JazzCash');
});

// ---------------------------------------------------------------------------
// Acceptance: the undo reverses through the link, never deletes
// ---------------------------------------------------------------------------

test('acceptance: undo within sixty seconds reverses exactly that payment', () => {
  const { state, original } = stateWithOriginal();
  const originalSnapshot = JSON.parse(JSON.stringify(original));
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 45000), true);
  const fields = quickCollectReversalUndoFields(original, { date: PAYMENT_DATE });
  assert.ok(fields);
  const nextState = addPayment(state, 'CUST-1', '2026-11', fields, REF);
  const payments = paymentsOf(nextState);
  assert.equal(payments.length, 2);
  const kept = payments.find((p) => p.id === original.id);
  assert.deepEqual(kept, originalSnapshot);
  const reversal = payments.find((p) => p.id !== original.id);
  assert.equal(reversal.amount, -3000);
  assert.equal(reversal.method, 'Cash');
  assert.equal(reversalLinkOf(reversal)?.reversesPaymentId, original.id);
  assert.equal(isReversalEntry(reversal), true);
  assert.equal(reversalEntryOf(original, payments)?.id, reversal.id);
});

test('acceptance: the original stays visible with its reversal, and the pair nets to zero', () => {
  const { state, original } = stateWithOriginal();
  const fields = quickCollectReversalUndoFields(original, { date: PAYMENT_DATE });
  const nextState = addPayment(state, 'CUST-1', '2026-11', fields, REF);
  const payments = paymentsOf(nextState);
  const reversal = payments.find((p) => p.id !== original.id);
  assert.equal(reversalPairNetCents(original, reversal), 0);
  assert.equal(reversalNetsToZero(original, reversal), true);
  const markup = reversalLinkMarkup(original, payments);
  assert.match(markup, /Reversed/);
  assert.doesNotMatch(markup, /deleted/i);
});

test('acceptance: undo after sixty seconds is refused by the window, not by the recorder', () => {
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 60001), false);
  assert.equal(quickCollectReversalUndoAllowed(SAVED_AT, SAVED_AT + 3600000), false);
});

test('acceptance: a reversing entry cannot itself be reversed', () => {
  const { state, original } = stateWithOriginal();
  const fields = quickCollectReversalUndoFields(original, { date: PAYMENT_DATE });
  const nextState = addPayment(state, 'CUST-1', '2026-11', fields, REF);
  const reversal = paymentsOf(nextState).find((p) => p.id !== original.id);
  assert.equal(quickCollectReversalUndoFields(reversal, { date: PAYMENT_DATE }), null);
});

// ---------------------------------------------------------------------------
// Guards: purity, fences, no new styles
// ---------------------------------------------------------------------------

test('guards: the module never reads the clock, storage, the page, or the network', () => {
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('sessionStorage'), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('XMLHttpRequest'), false);
});

test('guards: the module header never names a fenced module file', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('export const QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS'));
  assert.ok(header.length > 0, 'header found');
  const fenced = [
    'reversal-' + 'link.js',
    'success-' + 'next-steps.js',
    'save-' + 'confirmation-summary.js',
    'receipt-' + 'preview.js',
    'cash-' + 'change-calculator.js',
    'remembered-' + 'method.js',
    'dues-' + 'amount-default.js',
    'quick-' + 'collect-one-screen.js',
    'name-' + 'prefix-lookup.js',
    'recent-' + 'quick-pick.js',
    'one-' + 'screen-quick-amounts.js',
    'full-' + 'history-list.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    assert.equal(header.includes(name), false, `header must not name ${name}`);
  }
});

test('guards: the button reuses the existing undo styling — no new styles rule', () => {
  assert.equal(stylesSrc.includes('reversal-undo'), false);
  assert.equal(stylesSrc.includes('quickCollectReversalUndoBtn'), false);
  const buttonLine = pageSrc.slice(pageSrc.indexOf('id="quickCollectReversalUndoBtn"') - 200, pageSrc.indexOf('id="quickCollectReversalUndoBtn"') + 200);
  assert.match(buttonLine, /qc-undo-btn/);
});

// ---------------------------------------------------------------------------
// Wiring: the controller
// ---------------------------------------------------------------------------

test('wiring: the controller imports the reversal undo module', () => {
  assert.match(wiringSrc, /quick-collect-reversal-undo\.js/);
  assert.match(wiringSrc, /quickCollectReversalUndoAllowed/);
  assert.match(wiringSrc, /quickCollectReversalUndoFields/);
  assert.match(wiringSrc, /quickCollectReversalUndoIsPlainPayment/);
  assert.match(wiringSrc, /quickCollectReversalUndoButtonText/);
  assert.match(wiringSrc, /quickCollectReversalUndoSecondsLeft/);
  assert.match(wiringSrc, /QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS/);
  assert.match(wiringSrc, /QUICK_COLLECT_REVERSAL_UNDO_REASON/);
});

test('wiring: the reversal undo button is grabbed beside the five-second undo button', () => {
  assert.match(wiringSrc, /const undoBtn = document\.getElementById\('quickCollectUndoBtn'\)/);
  assert.match(wiringSrc, /const reversalUndoBtn = document\.getElementById\('quickCollectReversalUndoBtn'\)/);
});

test('wiring: the single-payment save arms the reversal undo from the saved payment', () => {
  const receiptAt = wiringSrc.indexOf('activeReceipt = receipt;');
  assert.ok(receiptAt > 0, 'single-payment save found');
  const armAt = wiringSrc.indexOf('armReversalUndo({', receiptAt);
  assert.ok(armAt > receiptAt, 'single-payment save arms the reversal undo');
  const packageAt = wiringSrc.indexOf('applyPackageSuccessMessage(receipt.amount)', armAt);
  assert.ok(packageAt > armAt, 'arming happens before the package message is applied');
  const slice = wiringSrc.slice(armAt, armAt + 800);
  assert.match(slice, /savedPayment/);
  assert.match(slice, /ticketCharges: receipt\.ticketCharges/);
  assert.match(slice, /addonCharges: receipt\.addonCharges/);
  const defAt = wiringSrc.indexOf('function armReversalUndo(');
  assert.ok(defAt > 0, 'arm function found');
  const defSlice = wiringSrc.slice(defAt, defAt + 1400);
  assert.match(defSlice, /quickCollectReversalUndoIsPlainPayment/);
  assert.match(defSlice, /lateFeeWaiverOf\(savedPayment\)/);
  assert.match(defSlice, /remainderWaadaOf\(savedPayment\)/);
  assert.match(defSlice, /QUICK_COLLECT_REVERSAL_UNDO_WINDOW_MS/);
  assert.match(defSlice, /startReversalUndoCountdown\(\)/);
});

test('wiring: a split collection never arms the reversal undo — it disarms it', () => {
  const splitAt = wiringSrc.indexOf('const [legReceipt1, legReceipt2] = splitResult.receipts;');
  assert.ok(splitAt > 0, 'split save found');
  const slice = wiringSrc.slice(splitAt, splitAt + 3000);
  assert.match(slice, /disarmReversalUndo\(\);/);
  assert.doesNotMatch(slice, /armReversalUndo\(\{/);
});

test('wiring: the undo reverses through the recorder and returns to the entry form', () => {
  const start = wiringSrc.indexOf('function executeReversalUndo()');
  assert.ok(start > 0, 'execute function found');
  const slice = wiringSrc.slice(start, start + 2600);
  assert.match(slice, /quickCollectReversalUndoAllowed\(ctx\.savedAtMs, Date\.now\(\)\)/);
  assert.match(slice, /quickCollectReversalUndoFields\(original,/);
  assert.match(slice, /addPayment\(state, ctx\.customerId, ctx\.month, fields, new Date\(\)\)/);
  assert.match(slice, /openCustomerCollectionForm\(ctx\.customerId\)/);
  assert.match(slice, /disarmReversalUndo\(\)/);
  assert.doesNotMatch(slice, /deletePayment/);
  assert.doesNotMatch(slice, /executeQuickCollection/);
  const listenAt = wiringSrc.indexOf("reversalUndoBtn?.addEventListener('click'");
  assert.ok(listenAt > 0, 'reversal button listener found');
  assert.match(wiringSrc.slice(listenAt, listenAt + 200), /executeReversalUndo\(\)/);
});

test('wiring: undo after sixty seconds is refused with a plain message', () => {
  const start = wiringSrc.indexOf('function executeReversalUndo()');
  const slice = wiringSrc.slice(start, start + 2600);
  assert.match(slice, /sixty-second undo window has passed/);
  assert.match(slice, /Use the correction flow/);
});

test('wiring: the five-second delete-undo clears the reversal undo, and is itself untouched', () => {
  assert.match(wiringSrc, /const UNDO_WINDOW_MS = 5000;/);
  const start = wiringSrc.indexOf('function executeUndo()');
  assert.ok(start > 0, 'delete-undo function found');
  const slice = wiringSrc.slice(start, start + 6000);
  assert.match(slice, /disarmReversalUndo\(\);/);
  assert.match(slice, /deletePayment\(/);
  assert.ok(slice.indexOf('disarmReversalUndo();') < slice.indexOf('deletePayment('), 'reversal undo is cleared before anything is deleted');
});

test('wiring: closing and Collect Another both clear the reversal undo', () => {
  const closeAt = wiringSrc.indexOf('function handleDialogClosed()');
  assert.ok(closeAt > 0, 'close cleanup found');
  assert.match(wiringSrc.slice(closeAt, closeAt + 1200), /disarmReversalUndo\(\);/);
  const anotherAt = wiringSrc.indexOf("anotherBtn?.addEventListener('click'");
  assert.ok(anotherAt > 0, 'collect-another handler found');
  assert.match(wiringSrc.slice(anotherAt, anotherAt + 900), /disarmReversalUndo\(\);/);
});

test('wiring: the countdown renders from the pure window check', () => {
  const start = wiringSrc.indexOf('function startReversalUndoCountdown()');
  assert.ok(start > 0, 'countdown function found');
  const slice = wiringSrc.slice(start, start + 800);
  assert.match(slice, /quickCollectReversalUndoSecondsLeft\(activeReversalUndo\.savedAtMs, Date\.now\(\)\)/);
  assert.match(slice, /quickCollectReversalUndoButtonText\(/);
  assert.match(slice, /setInterval\(render, 250\)/);
});

test('wiring: the reversal undo button sits on the success step after the five-second undo button', () => {
  assert.ok(pageSrc.includes('id="quickCollectReversalUndoBtn"'));
  const stepAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  const oldAt = pageSrc.indexOf('id="quickCollectUndoBtn"');
  const newAt = pageSrc.indexOf('id="quickCollectReversalUndoBtn"');
  assert.ok(stepAt > 0 && oldAt > stepAt && newAt > oldAt, 'new button follows the old undo button inside the success step');
  const buttonAt = pageSrc.indexOf('id="quickCollectReversalUndoBtn"');
  const tag = pageSrc.slice(buttonAt - 120, buttonAt + 220);
  assert.match(tag, /hidden/);
  assert.match(tag, /Undo by reversal \(60s\)/);
});
