// Plan 384 — Transaction reversal link to the original transaction.
// One reversal link record (original transaction, reversing entry,
// reason, date, operator), where the reversing entry is a normal
// negative entry linked by reference. It reverses through the link
// only and it never deletes the original: the original transaction
// stays visible and unchanged, the pair together nets to zero, and
// no other bill, payment, or past total changes because a link was
// recorded. A transaction without a link either way shows the
// customer only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REVERSAL_LINK_REASON_MAX_LENGTH,
  REVERSAL_LINK_OPERATOR_MAX_LENGTH,
  isStrictReversalLinkDate,
  normalizeReversalLink,
  reversalLinkOf,
  isReversalEntry,
  reversalEntryOf,
  originalEntryOf,
  reversalReceiptRef,
  reversalLinkLineText,
  reversalLinkMarkup,
  reversalPairNetCents,
  reversalNetsToZero,
} from '../reversal-link.js';
import { validatePayment, addPayment, correctPayment, listTransactions, calculatePaymentAllocations, recordedAmount } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'reversal-link.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-11-06T10:00:00Z');
const PAYMENT_DATE = '2026-11-06';

// Generic fixtures only — clearly made-up names, never a real person.
const OPERATOR_ONE = 'Operator One';
const OPERATOR_TWO = 'Operator Two';
const REASON = 'Wrong method recorded';

function link(overrides = {}) {
  return {
    reversesPaymentId: 'P-ORIG',
    reason: REASON,
    operator: OPERATOR_ONE,
    date: PAYMENT_DATE,
    ...overrides,
  };
}

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

function paymentOf(state, month, paymentId) {
  const customer = state.customers.find(c => c.id === 'CUST-1');
  const found = (customer.bills ?? []).find(b => b.month === month);
  return (found.payments ?? []).find(p => p.id === paymentId);
}

function stateWithReversedPair() {
  let state = stateWith(customerWithBills([bill('2026-11', 3000), bill('2026-10', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
  }, REF);
  const original = state.customers[0].bills.find(b => b.month === '2026-11').payments[0];
  const originalSnapshot = JSON.parse(JSON.stringify(original));
  state = addPayment(state, 'CUST-1', '2026-11', {
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: link({ reversesPaymentId: original.id }),
  }, REF);
  const reversal = state.customers[0].bills.find(b => b.month === '2026-11').payments
    .find(p => p.id !== original.id);
  return { state, original, originalSnapshot, reversal };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('strict date: leap-aware, YYYY-MM-DD only', () => {
  assert.equal(isStrictReversalLinkDate('2024-02-29'), true);
  assert.equal(isStrictReversalLinkDate('2023-02-29'), false);
  assert.equal(isStrictReversalLinkDate('2026-11-31'), false);
  assert.equal(isStrictReversalLinkDate('2026-13-01'), false);
  assert.equal(isStrictReversalLinkDate('2026-11-6'), false);
  assert.equal(isStrictReversalLinkDate('2026-11-06'), true);
  assert.equal(isStrictReversalLinkDate(null), false);
  assert.equal(isStrictReversalLinkDate(''), false);
  assert.equal(isStrictReversalLinkDate(20261106), false);
});

// ---------------------------------------------------------------------------
// Normalizing the link
// ---------------------------------------------------------------------------

test('normalize: a plain link keeps endpoints, reason, operator, and date', () => {
  assert.deepEqual(
    normalizeReversalLink(link(), PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeReversalLink(link({ operator: OPERATOR_TWO }), PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: REASON, operator: OPERATOR_TWO, date: PAYMENT_DATE },
  );
});

test('normalize: reason and operator are optional — endpoints plus date is still a link', () => {
  assert.deepEqual(
    normalizeReversalLink({ reversesPaymentId: 'P-ORIG', date: PAYMENT_DATE }, PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeReversalLink({ reversesPaymentId: 'P-ORIG', reason: REASON, date: PAYMENT_DATE }, PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: REASON, date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeReversalLink({ reversesPaymentId: 'P-ORIG', operator: OPERATOR_ONE, date: PAYMENT_DATE }, PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
});

test('normalize: no original is not a link', () => {
  assert.equal(normalizeReversalLink({}, PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink({ reason: REASON, date: PAYMENT_DATE }, PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink({ reversesPaymentId: '   ', reason: REASON, date: PAYMENT_DATE }, PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink(null, PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink(undefined, PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink('P-ORIG', PAYMENT_DATE), null);
  assert.equal(normalizeReversalLink(42, PAYMENT_DATE), null);
});

test('normalize: a missing link date falls back to the payment day; a bad link date falls back too', () => {
  assert.deepEqual(
    normalizeReversalLink({ reversesPaymentId: 'P-ORIG', reason: REASON, operator: OPERATOR_ONE }, PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
  assert.deepEqual(
    normalizeReversalLink(link({ date: '2026-11-31' }), PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
});

test('normalize: a link with no usable date at all is refused', () => {
  assert.equal(normalizeReversalLink(link({ date: '2026-11-31' }), undefined), null);
  assert.equal(normalizeReversalLink(link({ date: '2026-11-31' }), '2026-13-01'), null);
  assert.equal(normalizeReversalLink({ reversesPaymentId: 'P-ORIG', reason: REASON }, undefined), null);
});

test('normalize: line breaks fold to spaces, blanks are dropped', () => {
  assert.deepEqual(
    normalizeReversalLink({ reversesPaymentId: 'P-ORIG', reason: 'Wrong\nmethod', operator: OPERATOR_ONE, date: PAYMENT_DATE }, PAYMENT_DATE),
    { reversesPaymentId: 'P-ORIG', reason: 'Wrong method', operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
  assert.equal(normalizeReversalLink({ reversesPaymentId: 'P-ORIG', reason: '   ', operator: '', date: PAYMENT_DATE }, PAYMENT_DATE).reason, undefined);
  assert.equal(normalizeReversalLink({ reversesPaymentId: '  P-ORIG  ', date: PAYMENT_DATE }, PAYMENT_DATE).reversesPaymentId, 'P-ORIG');
});

test('normalize: reason caps at 200 chars, operator at 60', () => {
  assert.equal(REVERSAL_LINK_REASON_MAX_LENGTH, 200);
  assert.equal(REVERSAL_LINK_OPERATOR_MAX_LENGTH, 60);
  const normalized = normalizeReversalLink({
    reversesPaymentId: 'P-ORIG',
    reason: 'R'.repeat(240),
    operator: 'O'.repeat(90),
    date: PAYMENT_DATE,
  }, PAYMENT_DATE);
  assert.equal(normalized.reason.length, 200);
  assert.equal(normalized.operator.length, 60);
  assert.equal(normalized.date, PAYMENT_DATE);
});

test('normalize: the input is never mutated', () => {
  const raw = link({ reason: 'Wrong\nmethod' });
  normalizeReversalLink(raw, PAYMENT_DATE);
  assert.deepEqual(raw, link({ reason: 'Wrong\nmethod' }));
});

// ---------------------------------------------------------------------------
// Reading the link off a payment record
// ---------------------------------------------------------------------------

test('reversalLinkOf: reads the field the validator keeps', () => {
  assert.deepEqual(
    reversalLinkOf({ id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', reversalLink: link() }),
    link(),
  );
});

test('reversalLinkOf: a positive amount reads as no link (damaged record)', () => {
  assert.equal(reversalLinkOf({ id: 'P-REV', date: PAYMENT_DATE, amount: 3000, method: 'Cash', reversalLink: link() }), null);
  assert.equal(reversalLinkOf({ id: 'P-REV', date: PAYMENT_DATE, amount: 0, method: 'Cash', reversalLink: link() }), null);
});

test('reversalLinkOf: a link that points at the payment itself is refused', () => {
  assert.equal(
    reversalLinkOf({ id: 'P-ORIG', date: PAYMENT_DATE, amount: -3000, method: 'Cash', reversalLink: link({ reversesPaymentId: 'P-ORIG' }) }),
    null,
  );
});

test('reversalLinkOf: a payment without a link reads as null', () => {
  assert.equal(reversalLinkOf({ id: 'P-1', date: PAYMENT_DATE, amount: 1500, method: 'Cash' }), null);
  assert.equal(reversalLinkOf({ id: 'P-1', date: PAYMENT_DATE, amount: -1500, method: 'Cash' }), null);
  assert.equal(reversalLinkOf(null), null);
  assert.equal(reversalLinkOf(undefined), null);
});

test('isReversalEntry: true only for a genuine reversing entry', () => {
  assert.equal(isReversalEntry({ id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', reversalLink: link() }), true);
  assert.equal(isReversalEntry({ id: 'P-1', date: PAYMENT_DATE, amount: 3000, method: 'Cash', reversalLink: link() }), false);
  assert.equal(isReversalEntry({ id: 'P-1', date: PAYMENT_DATE, amount: 3000, method: 'Cash' }), false);
  assert.equal(isReversalEntry(null), false);
});

// ---------------------------------------------------------------------------
// Finding the pair
// ---------------------------------------------------------------------------

test('reversalEntryOf: finds the reversal across months; null when none', () => {
  const original = { id: 'P-ORIG', date: PAYMENT_DATE, amount: 3000, method: 'Cash', receiptNumber: 'RCPT-41-202611-01' };
  const reversal = { id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', reversalLink: link() };
  const other = { id: 'P-OTHER', date: PAYMENT_DATE, amount: 1500, method: 'Cash' };
  // The reversal may sit on another month's bill and still be found.
  assert.equal(reversalEntryOf(original, [other, reversal]), reversal);
  assert.equal(reversalEntryOf(original, [original, other]), null);
  assert.equal(reversalEntryOf(original, []), null);
  assert.equal(reversalEntryOf(original, null), null);
  assert.equal(reversalEntryOf(null, [reversal]), null);
  assert.equal(reversalEntryOf({ date: PAYMENT_DATE, amount: 3000 }, [reversal]), null);
});

test('originalEntryOf: finds the original; null when it is not among them', () => {
  const original = { id: 'P-ORIG', date: PAYMENT_DATE, amount: 3000, method: 'Cash', receiptNumber: 'RCPT-41-202611-01' };
  const reversal = { id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', reversalLink: link() };
  assert.equal(originalEntryOf(reversal, [reversal, original]), original);
  assert.equal(originalEntryOf(reversal, [reversal]), null);
  assert.equal(originalEntryOf(original, [original, reversal]), null);
  assert.equal(originalEntryOf(null, [original]), null);
});

test('reversalReceiptRef: receipt number, permanent fallback, empty when neither', () => {
  assert.equal(reversalReceiptRef({ receiptNumber: 'RCPT-41-202611-01' }), 'RCPT-41-202611-01');
  assert.equal(reversalReceiptRef({ permanentReceiptNumber: 'RCPT-41-202611-01' }), 'RCPT-41-202611-01');
  assert.equal(reversalReceiptRef({ receiptNumber: 'RCPT-41-202611-03', permanentReceiptNumber: 'RCPT-41-202611-01' }), 'RCPT-41-202611-03');
  assert.equal(reversalReceiptRef({}), '');
  assert.equal(reversalReceiptRef(null), '');
});

// ---------------------------------------------------------------------------
// The link in plain words
// ---------------------------------------------------------------------------

test('line text: the original names its reversal, with reason, operator, and date', () => {
  assert.equal(
    reversalLinkLineText(link(), 'RCPT-41-202611-03', 'reversedBy'),
    'Reversed by RCPT-41-202611-03 · Wrong method recorded — by Operator One, 2026-11-06',
  );
});

test('line text: the reversal names its original', () => {
  assert.equal(
    reversalLinkLineText(link(), 'RCPT-41-202611-01', 'reverses'),
    'Reverses RCPT-41-202611-01 · Wrong method recorded — by Operator One, 2026-11-06',
  );
});

test('line text: unknown refs fall back to plain words', () => {
  assert.equal(
    reversalLinkLineText(link(), '', 'reversedBy'),
    'Reversed · Wrong method recorded — by Operator One, 2026-11-06',
  );
  assert.equal(
    reversalLinkLineText(link(), '', 'reverses'),
    'Reverses an earlier payment · Wrong method recorded — by Operator One, 2026-11-06',
  );
});

test('line text: each part shows only when given; an empty link says nothing', () => {
  assert.equal(
    reversalLinkLineText({ reversesPaymentId: 'P-ORIG', operator: OPERATOR_ONE, date: PAYMENT_DATE }, 'RCPT-41-202611-03', 'reversedBy'),
    'Reversed by RCPT-41-202611-03 — by Operator One, 2026-11-06',
  );
  assert.equal(
    reversalLinkLineText({ reversesPaymentId: 'P-ORIG', reason: REASON, date: PAYMENT_DATE }, 'RCPT-41-202611-03', 'reversedBy'),
    'Reversed by RCPT-41-202611-03 · Wrong method recorded — 2026-11-06',
  );
  assert.equal(reversalLinkLineText({}, 'RCPT-41-202611-03', 'reversedBy'), '');
  assert.equal(reversalLinkLineText(null, 'RCPT-41-202611-03', 'reversedBy'), '');
});

test('line text: caller-supplied labels are used', () => {
  assert.equal(
    reversalLinkLineText(link(), 'RCPT-41-202611-03', 'reversedBy', { reversedBy: 'Undone by {ref}', by: 'via' }),
    'Undone by RCPT-41-202611-03 · Wrong method recorded — via Operator One, 2026-11-06',
  );
});

test('markup: the original shows its reversal, escaped; the reversal shows its original; empty without a link', () => {
  const original = { id: 'P-ORIG', date: PAYMENT_DATE, amount: 3000, method: 'Cash', receiptNumber: 'RCPT-41-202611-01' };
  const reversal = { id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', receiptNumber: 'RCPT-41-202611-03', reversalLink: link() };
  assert.equal(
    reversalLinkMarkup(original, [original, reversal]),
    ' · Reversed by RCPT-41-202611-03 · Wrong method recorded — by Operator One, 2026-11-06',
  );
  assert.equal(
    reversalLinkMarkup(reversal, [original, reversal]),
    ' · Reverses RCPT-41-202611-01 · Wrong method recorded — by Operator One, 2026-11-06',
  );
  assert.equal(
    reversalLinkMarkup({ ...original, receiptNumber: 'RCPT-41-202611-01' }, [original, { ...reversal, reversalLink: link({ reason: '<script>alert(1)</script>' }) }]),
    ' · Reversed by RCPT-41-202611-03 · &lt;script&gt;alert(1)&lt;/script&gt; — by Operator One, 2026-11-06',
  );
  assert.equal(reversalLinkMarkup(original, [original]), '');
  assert.equal(reversalLinkMarkup(null, [original, reversal]), '');
});

test('markup: a damaged record shows its link without the original’s ref', () => {
  const reversal = { id: 'P-REV', date: PAYMENT_DATE, amount: -3000, method: 'Cash', receiptNumber: 'RCPT-41-202611-03', reversalLink: link() };
  assert.equal(
    reversalLinkMarkup(reversal, [reversal]),
    ' · Reverses an earlier payment · Wrong method recorded — by Operator One, 2026-11-06',
  );
});

// ---------------------------------------------------------------------------
// Netting to zero
// ---------------------------------------------------------------------------

test('reversalPairNetCents: exact zero, partial, and non-pair', () => {
  const original = { id: 'P-ORIG', amount: 3000 };
  const full = { id: 'P-REV', amount: -3000, reversalLink: link() };
  const partial = { id: 'P-REV', amount: -1500, reversalLink: link() };
  const other = { id: 'P-REV', amount: -3000, reversalLink: link({ reversesPaymentId: 'P-OTHER' }) };
  assert.equal(reversalPairNetCents(original, full), 0);
  assert.equal(reversalNetsToZero(original, full), true);
  assert.equal(reversalPairNetCents(original, partial), 150000);
  assert.equal(reversalNetsToZero(original, partial), false);
  assert.equal(reversalPairNetCents(original, other), null);
  assert.equal(reversalNetsToZero(original, other), false);
  assert.equal(reversalPairNetCents(null, full), null);
  assert.equal(reversalNetsToZero(null, full), false);
  assert.equal(
    reversalPairNetCents({ id: 'P-ORIG', amount: 3000.50 }, { id: 'P-REV', amount: -3000.50, reversalLink: link() }),
    0,
  );
});

// ---------------------------------------------------------------------------
// Recording the reversal with the payment
// ---------------------------------------------------------------------------

test('validatePayment: the link and the negative amount are kept', () => {
  const validated = validatePayment({
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: link(),
  }, REF);
  assert.deepEqual(validated.reversalLink, link());
  assert.equal(validated.amount, -3000);
  assert.equal(validated.method, 'Cash');
});

test('validatePayment: a link with a positive amount is refused', () => {
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
    reversalLink: link(),
  }, REF), /A reversal entry must be a negative amount/);
});

test('validatePayment: a negative amount without a link is refused', () => {
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
  }, REF), /Amount must be greater than zero/);
});

test('validatePayment: a link with words but no original is refused loudly', () => {
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: { reason: REASON, date: PAYMENT_DATE },
  }, REF), /A reversal link needs the original payment and a valid date/);
  assert.throws(() => validatePayment({
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: { reversesPaymentId: '   ', reason: REASON, date: PAYMENT_DATE },
  }, REF), /A reversal link needs the original payment and a valid date/);
});

test('validatePayment: a payment without a link records no reversalLink field', () => {
  const validated = validatePayment({
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
  }, REF);
  assert.equal('reversalLink' in validated, false);
});

test('addPayment: the reversal is recorded with the payment and the original is untouched', () => {
  const { state, original, originalSnapshot, reversal } = stateWithReversedPair();
  assert.deepEqual(
    reversal.reversalLink,
    { reversesPaymentId: original.id, reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
  assert.equal(reversal.amount, -3000);
  assert.deepEqual(paymentOf(state, '2026-11', original.id), originalSnapshot);
});

test('addPayment acceptance: the pair nets to zero on the same fixture and no other bill changes', () => {
  const { state, original, reversal } = stateWithReversedPair();
  const novemberBill = state.customers[0].bills.find(b => b.month === '2026-11');
  const octoberBill = state.customers[0].bills.find(b => b.month === '2026-10');
  // The two entries together net to exactly zero.
  assert.equal(reversalNetsToZero(original, reversal), true);
  assert.equal(recordedAmount(novemberBill), 0);
  assert.equal(calculatePaymentAllocations(state).forMonth('CUST-1', '2026-11')?.actualReceiptsCents, 0);
  // The bill reopens: the money is back with the customer.
  assert.equal(novemberBill.status, 'pending');
  // The other bill is untouched — same due, same balance.
  assert.equal(octoberBill.dueAmount, 3000);
  assert.equal(calculatePaymentAllocations(state).forMonth('CUST-1', '2026-10')?.balanceDueCents, 300000);
});

test('correctPayment: a correction that says nothing about the link keeps it', () => {
  const { state, original, reversal } = stateWithReversedPair();
  const next = correctPayment(state, 'CUST-1', '2026-11', reversal.id, {
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
  }, REF);
  const corrected = paymentOf(next, '2026-11', reversal.id);
  assert.deepEqual(
    corrected.reversalLink,
    { reversesPaymentId: original.id, reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
});

test('correctPayment: a correction that supplies the link replaces it', () => {
  const { state, original, reversal } = stateWithReversedPair();
  const next = correctPayment(state, 'CUST-1', '2026-11', reversal.id, {
    date: PAYMENT_DATE,
    amount: -3000,
    method: 'Cash',
    reversalLink: link({ reversesPaymentId: original.id, reason: 'Amount was wrong', operator: OPERATOR_TWO }),
  }, REF);
  const corrected = paymentOf(next, '2026-11', reversal.id);
  assert.deepEqual(
    corrected.reversalLink,
    { reversesPaymentId: original.id, reason: 'Amount was wrong', operator: OPERATOR_TWO, date: PAYMENT_DATE },
  );
});

test('correctPayment: a correction that empties the link and restores a positive amount records a normal payment', () => {
  const { state, reversal } = stateWithReversedPair();
  const next = correctPayment(state, 'CUST-1', '2026-11', reversal.id, {
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
    reversalLink: null,
  }, REF);
  const corrected = paymentOf(next, '2026-11', reversal.id);
  assert.equal('reversalLink' in corrected, false);
  assert.equal(corrected.amount, 3000);
});

test('correctPayment: turning a reversal positive while keeping its link is refused', () => {
  const { state, reversal } = stateWithReversedPair();
  assert.throws(() => correctPayment(state, 'CUST-1', '2026-11', reversal.id, {
    date: PAYMENT_DATE,
    amount: 3000,
    method: 'Cash',
  }, REF), /A reversal entry must be a negative amount/);
});

test('listTransactions: the reversal row carries the normalized link; a plain row carries null', () => {
  const { state, original, reversal } = stateWithReversedPair();
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 2);
  const originalRow = rows.find(r => r.paymentId === original.id);
  const reversalRow = rows.find(r => r.paymentId === reversal.id);
  assert.equal(originalRow.reversalLink, null);
  assert.equal(originalRow.amount, 3000);
  assert.deepEqual(
    reversalRow.reversalLink,
    { reversesPaymentId: original.id, reason: REASON, operator: OPERATOR_ONE, date: PAYMENT_DATE },
  );
  assert.equal(reversalRow.amount, -3000);
});

// ---------------------------------------------------------------------------
// Wiring — the rows show the link
// ---------------------------------------------------------------------------

test('wiring: app and core import the module; both profile rows and the card show the link', () => {
  assert.ok(appSrc.includes("from './reversal-link.js'"), 'app imports the module');
  assert.ok(coreSrc.includes("from './reversal-link.js'"), 'core imports the module');
  const profileRows = appSrc.split('profileReversalLinkMarkup(payment, customer)').length - 1;
  assert.ok(profileRows >= 2, `expected the link on both profile history rows, found ${profileRows}`);
  assert.ok(appSrc.includes('transactionReversalLinkMarkup(transaction, customer)'), 'Transactions card shows the link');
  // Plan 435: the broad "no 'reversal' anywhere in index.html" pin
  // is narrowed to this plan's own prefix — the sixty-second
  // reversal undo button (Plan 435) legitimately carries the word
  // "reversal" in its label. This plan still consumed no element
  // id: its prefix stays free in the page and the styles.
  assert.ok(!indexSrc.includes('rvl'), 'no new element id in index.html for this plan');
  assert.ok(!stylesSrc.includes('rvl'), 'no styles change for this plan');
});

test('wiring: the labels exist in both language tables', () => {
  for (const key of [
    'prof_rvl_hist_reversed_by',
    'prof_rvl_hist_reversed_unknown',
    'prof_rvl_hist_reverses',
    'prof_rvl_hist_reverses_unknown',
    'prof_rvl_hist_by',
  ]) {
    const count = langSrc.split(`${key}:`).length - 1;
    assert.ok(count >= 2, `language key ${key} must exist in both tables, found ${count}`);
  }
  assert.ok(langSrc.includes('Reversed by {ref}'), 'reversed-by label in English');
  assert.ok(langSrc.includes('{ref} سے واپس کیا گیا'), 'reversed-by label in Urdu');
  assert.ok(langSrc.includes('پہلی ادائیگی کی واپسی'), 'reverses-unknown label in Urdu');
});

// ---------------------------------------------------------------------------
// Guards — purity, fences, no real names
// ---------------------------------------------------------------------------

test('guard: the module is pure — no store, no DOM, no clock, no network', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('import '), 'no imports — pure module');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('guard: the module never names a fenced neighbour module', () => {
  // Neighbour modules are checked by filename only and left untouched:
  // the bill correction workflow, its approval trail, the quick undo
  // that deletes a just-made payment, and the void audit that freezes
  // a settled receipt. This plan is a link between two transactions,
  // not an edit, a delete, or a void, and must not re-implement any
  // of them. Filenames are built from fragments so this very test
  // never contains them literally either.
  const fenced = [
    'billing-' + 'corrections.js',
    'correction-' + 'approval.js',
    'quick-' + 'undo-toast.js',
    'payment-' + 'void-audit.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('guard: no real person or customer name anywhere in this file', () => {
  // Names are built from fragments so the list itself never contains
  // one literally.
  const forbidden = [
    'Sa' + 'ad',
    'Ki' + 'ran',
    'Hai' + 'der',
    'Shu' + 'naid',
    'Kha' + 'zer',
    'Mo' + 'hsin',
    'Shar' + 'jell',
    'No' + 'mi',
    'Aq' + 'ib',
    'Ej' + 'az',
  ];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});
