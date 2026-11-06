// Plan 398 — Transaction category tag for filtering: transactions
// of different kinds — collection, advance, refund, adjustment —
// sit in one undifferentiated list, so the operator cannot filter
// to just the kind they are looking for. One category tag on each
// transaction, in plain words, set at entry and used only for
// filtering. It tags only: it never changes any amount, type, bill,
// payment total, method reconciliation, or customer record by
// itself. A transaction without a tag reads as 'other' — in the
// filter, in the counts, and in the reader — so the counts over the
// full list always sum to the full list total. The tag rides the
// payment record itself (like the overpayment choice, the
// Urdu-script note, and the excess cash note before it), so it needs
// no store of its own: the record is the tag. A payment with no tag
// shows nothing extra on its row.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRANSACTION_CATEGORY_TAGS,
  TRANSACTION_CATEGORY_TAG_LABELS,
  isTransactionCategoryTag,
  normalizeTransactionCategoryTag,
  transactionCategoryTagOf,
  transactionCategoryTagLabel,
  filterTransactionsByCategoryTag,
  transactionCategoryTagCounts,
  transactionCategoryTagSelectOptions,
  categoryTagLineText,
  categoryTagMarkup,
} from '../transaction-category-tag.js';
import {
  validatePayment,
  addPayment,
  correctPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../transaction-category-tag.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, '../core.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const langSrc = fs.readFileSync(path.join(ROOT, '../nav-language.js'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan398-category-tag.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

function recordedPayment(state, month) {
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === month);
  return bill.payments[bill.payments.length - 1];
}

// ---- Module units: the five tags ----

test('Plan 398: the tag list is exactly collection, advance, refund, adjustment, other', () => {
  assert.deepEqual(TRANSACTION_CATEGORY_TAGS, ['collection', 'advance', 'refund', 'adjustment', 'other']);
  assert.deepEqual(TRANSACTION_CATEGORY_TAG_LABELS, {
    collection: 'Collection',
    advance: 'Advance',
    refund: 'Refund',
    adjustment: 'Adjustment',
    other: 'Other',
  });
  assert.equal(isTransactionCategoryTag('collection'), true);
  assert.equal(isTransactionCategoryTag('advance'), true);
  assert.equal(isTransactionCategoryTag('refund'), true);
  assert.equal(isTransactionCategoryTag('adjustment'), true);
  assert.equal(isTransactionCategoryTag('other'), true);
  assert.equal(isTransactionCategoryTag(' Refund '), true);
  assert.equal(isTransactionCategoryTag('ADJUSTMENT'), true);
  assert.equal(isTransactionCategoryTag('all'), false);
  assert.equal(isTransactionCategoryTag('cash'), false);
  assert.equal(isTransactionCategoryTag(''), false);
  assert.equal(isTransactionCategoryTag(null), false);
  assert.equal(isTransactionCategoryTag(undefined), false);
});

test('Plan 398: normalize stores only the four meaningful tags', () => {
  assert.equal(normalizeTransactionCategoryTag('collection'), 'collection');
  assert.equal(normalizeTransactionCategoryTag('advance'), 'advance');
  assert.equal(normalizeTransactionCategoryTag('refund'), 'refund');
  assert.equal(normalizeTransactionCategoryTag('adjustment'), 'adjustment');
  assert.equal(normalizeTransactionCategoryTag(' Refund '), 'refund');
  assert.equal(normalizeTransactionCategoryTag('ADVANCE'), 'advance');
  // 'other', a missing tag, and anything unknown store nothing — a
  // payment without a stored tag reads as 'other' anyway.
  assert.equal(normalizeTransactionCategoryTag('other'), null);
  assert.equal(normalizeTransactionCategoryTag(' Other '), null);
  assert.equal(normalizeTransactionCategoryTag('cash'), null);
  assert.equal(normalizeTransactionCategoryTag(''), null);
  assert.equal(normalizeTransactionCategoryTag(null), null);
  assert.equal(normalizeTransactionCategoryTag(undefined), null);
  assert.equal(normalizeTransactionCategoryTag(42), null);
});

test('Plan 398: the defensive reader returns the stored tag, or other when there is none', () => {
  assert.equal(transactionCategoryTagOf({ categoryTag: 'refund' }), 'refund');
  assert.equal(transactionCategoryTagOf({ categoryTag: ' Adjustment ' }), 'adjustment');
  assert.equal(transactionCategoryTagOf({ categoryTag: 'other' }), 'other');
  assert.equal(transactionCategoryTagOf({}), 'other');
  assert.equal(transactionCategoryTagOf({ categoryTag: 'cash' }), 'other');
  assert.equal(transactionCategoryTagOf({ categoryTag: '' }), 'other');
  assert.equal(transactionCategoryTagOf({ categoryTag: null }), 'other');
  assert.equal(transactionCategoryTagOf(null), 'other');
  assert.equal(transactionCategoryTagOf(undefined), 'other');
});

test('Plan 398: the label is the tag in plain words, Other when there is none', () => {
  assert.equal(transactionCategoryTagLabel('collection'), 'Collection');
  assert.equal(transactionCategoryTagLabel('advance'), 'Advance');
  assert.equal(transactionCategoryTagLabel('refund'), 'Refund');
  assert.equal(transactionCategoryTagLabel('adjustment'), 'Adjustment');
  assert.equal(transactionCategoryTagLabel('other'), 'Other');
  assert.equal(transactionCategoryTagLabel('cash'), 'Other');
  assert.equal(transactionCategoryTagLabel(undefined), 'Other');
});

test('Plan 398: the entry-form options list the five tags with collection selected by default', () => {
  const options = transactionCategoryTagSelectOptions();
  assert.equal((options.match(/<option /g) || []).length, 5);
  assert.ok(options.includes('<option value="collection" selected>Collection</option>'));
  assert.ok(options.includes('<option value="advance">Advance</option>'));
  assert.ok(options.includes('<option value="refund">Refund</option>'));
  assert.ok(options.includes('<option value="adjustment">Adjustment</option>'));
  assert.ok(options.includes('<option value="other">Other</option>'));
  const refundOptions = transactionCategoryTagSelectOptions('refund');
  assert.ok(refundOptions.includes('<option value="refund" selected>Refund</option>'));
  assert.equal(refundOptions.includes('<option value="collection" selected>'), false);
  const otherOptions = transactionCategoryTagSelectOptions('other');
  assert.equal(otherOptions.includes('<option value="other" selected>'), false, 'other is never stored, so it is never the selected option');
  assert.ok(otherOptions.includes('<option value="collection" selected>Collection</option>'), 'an unusable selection falls back to collection');
});

// ---- Module units: filter and counts ----

const MIXED_ROWS = [
  { categoryTag: 'collection' },
  { categoryTag: 'collection' },
  { categoryTag: 'advance' },
  { categoryTag: 'refund' },
  { categoryTag: 'adjustment' },
  {},
  { categoryTag: 'cash' },
];

test('Plan 398: filtering by tag keeps exactly the rows that read as that tag', () => {
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'collection').length, 2);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'advance').length, 1);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'refund').length, 1);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'adjustment').length, 1);
  // A transaction without a stored tag reads as 'other' — the
  // damaged 'cash' row reads as 'other' too, never dropped.
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'other').length, 2);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'all').length, MIXED_ROWS.length);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, '').length, MIXED_ROWS.length);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, null).length, MIXED_ROWS.length);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, undefined).length, MIXED_ROWS.length);
  assert.equal(filterTransactionsByCategoryTag(MIXED_ROWS, 'cash').length, 0);
  assert.deepEqual(filterTransactionsByCategoryTag(null, 'collection'), []);
  assert.deepEqual(filterTransactionsByCategoryTag(undefined, 'collection'), []);
  assert.deepEqual(filterTransactionsByCategoryTag([], 'refund'), []);
});

test('Plan 398: the counts always sum to the full list, with every tag key present', () => {
  const counts = transactionCategoryTagCounts(MIXED_ROWS);
  assert.deepEqual(counts, {
    collection: 2, advance: 1, refund: 1, adjustment: 1, other: 2, total: 7,
  });
  assert.equal(
    counts.collection + counts.advance + counts.refund + counts.adjustment + counts.other,
    counts.total,
    'the five tag counts must sum to the total',
  );
  assert.deepEqual(transactionCategoryTagCounts([]), {
    collection: 0, advance: 0, refund: 0, adjustment: 0, other: 0, total: 0,
  });
});

test('Plan 398: the markup is a dot suffix, and empty when there is no stored tag', () => {
  assert.equal(categoryTagLineText({ categoryTag: 'refund' }), 'Refund');
  assert.equal(categoryTagLineText({ categoryTag: 'collection' }), 'Collection');
  assert.equal(categoryTagLineText({}), '');
  assert.equal(categoryTagLineText({ categoryTag: 'other' }), '');
  assert.equal(categoryTagLineText({ categoryTag: 'cash' }), '');
  assert.equal(categoryTagLineText(null), '');
  assert.equal(categoryTagMarkup({ categoryTag: 'refund' }), ' · Refund');
  assert.equal(categoryTagMarkup({ categoryTag: 'advance' }), ' · Advance');
  assert.equal(categoryTagMarkup({}), '');
  assert.equal(categoryTagMarkup({ categoryTag: 'other' }), '');
  assert.equal(categoryTagMarkup(null), '');
});

// ---- Validator and recording ----

test('Plan 398: validatePayment stores the tag on the payment', () => {
  const payment = validatePayment({
    date: PAYMENT_DATE, amount: 3000, method: 'Cash', categoryTag: 'refund',
  }, NOV_6);
  assert.equal(payment.categoryTag, 'refund');
  assert.equal(payment.amount, 3000);
  const folded = validatePayment({
    date: PAYMENT_DATE, amount: 3000, method: 'Cash', categoryTag: ' Adjustment ',
  }, NOV_6);
  assert.equal(folded.categoryTag, 'adjustment');
});

test('Plan 398: validatePayment stores nothing for other, unknown, or missing tags', () => {
  for (const tag of ['other', 'cash', '', null, undefined]) {
    const payment = validatePayment({
      date: PAYMENT_DATE, amount: 3000, method: 'Cash', categoryTag: tag,
    }, NOV_6);
    assert.equal('categoryTag' in payment, false, `tag ${String(tag)} must record no field`);
  }
});

test('Plan 398: addPayment records the tag with the transaction', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'advance' });
  const recorded = recordedPayment(next, '2026-10');
  assert.equal(recorded.categoryTag, 'advance');
  assert.equal(recorded.amount, 3000);
  assert.equal(recorded.method, 'Cash');
  assert.equal(recorded.date, PAYMENT_DATE);
});

test('Plan 398: addPayment without a tag records no tag field', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6);
  assert.equal('categoryTag' in recordedPayment(next, '2026-10'), false);
});

test('Plan 398: the tag rides the transaction row via listTransactions', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'refund' });
  const rows = listTransactions(next, {}, NOV_6);
  const row = rows.find((entry) => entry.paymentId === recordedPayment(next, '2026-10').id);
  assert.equal(row.categoryTag, 'refund');
  const plain = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6);
  const plainRow = listTransactions(plain, {}, NOV_6).find((entry) => entry.paymentId === recordedPayment(plain, '2026-10').id);
  assert.equal(plainRow.categoryTag, 'other');
});

// ---- Correction carry-over ----

test('Plan 398: correctPayment keeps the tag when the correction says nothing about it', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'adjustment' });
  const payment = recordedPayment(next, '2026-10');
  const corrected = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 3000, method: 'Cash',
  }, NOV_6);
  assert.equal(recordedPayment(corrected, '2026-10').categoryTag, 'adjustment');
});

test('Plan 398: correctPayment replaces the tag explicitly and clears it on null', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'refund' });
  const payment = recordedPayment(next, '2026-10');
  const replaced = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 3000, method: 'Cash', categoryTag: 'collection',
  }, NOV_6);
  assert.equal(recordedPayment(replaced, '2026-10').categoryTag, 'collection');
  const cleared = correctPayment(next, 'seed-001', '2026-10', payment.id, {
    date: PAYMENT_DATE, amount: 3000, method: 'Cash', categoryTag: null,
  }, NOV_6);
  assert.equal('categoryTag' in recordedPayment(cleared, '2026-10'), false);
});

// ---- Acceptance: the tag changes nothing by itself ----

test('Plan 398: acceptance — the tag never changes any bill, payment total, or method total by itself', () => {
  const base = stateWithBills(NOV_6);
  const withTag = pay(base, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'refund' });
  const withoutTag = pay(base, '2026-10', '3000', PAYMENT_DATE, NOV_6);
  // Every month's remaining balance is identical with and without it.
  for (const month of ['2026-09', '2026-10', '2026-11']) {
    assert.equal(
      calculatePaymentAllocations(withTag).forMonth('seed-001', month).balanceDueCents,
      calculatePaymentAllocations(withoutTag).forMonth('seed-001', month).balanceDueCents,
      `${month} balance must not move because a tag was recorded`,
    );
  }
  // The recorded payment is identical except for the tag itself
  // (and the random id every payment carries).
  const tagged = recordedPayment(withTag, '2026-10');
  const plain = recordedPayment(withoutTag, '2026-10');
  const { categoryTag: _tagged, id: _taggedId, ...taggedRest } = tagged;
  const { categoryTag: _plain, id: _plainId, ...plainRest } = plain;
  assert.deepEqual(taggedRest, plainRest);
  // The per-method totals — the inputs the method reconciliation
  // reads — are identical with and without the tag.
  const totalsByMethod = (state) => listTransactions(state, {}, NOV_6)
    .reduce((totals, row) => ({ ...totals, [row.method]: (totals[row.method] ?? 0) + row.amount }), {});
  assert.deepEqual(totalsByMethod(withTag), totalsByMethod(withoutTag));
});

test('Plan 398: the tag and the advance kind are independent — a tag never mints a kind', () => {
  const state = stateWithBills(NOV_6);
  const tagged = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { categoryTag: 'advance' });
  assert.equal(recordedPayment(tagged, '2026-10').categoryTag, 'advance');
  assert.equal(recordedPayment(tagged, '2026-10').kind, undefined);
  const advanced = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, { kind: 'advance' });
  assert.equal(recordedPayment(advanced, '2026-10').kind, 'advance');
  assert.equal('categoryTag' in recordedPayment(advanced, '2026-10'), false);
});

test('Plan 398: the tag and the overpayment choice are independent notes on one payment', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'advance', overpaymentDuesCents: 900000,
    categoryTag: 'collection',
  });
  const recorded = recordedPayment(next, '2026-10');
  assert.deepEqual(recorded.overpaymentChoice, { choice: 'advance', extraCents: 50000 });
  assert.equal(recorded.categoryTag, 'collection');
});

// ---- Quick Collect end to end ----

test('Plan 398: executeQuickCollection records the tag on the payment it saves', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
    categoryTag: 'refund',
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal(payment.categoryTag, 'refund');
  assert.equal(payment.amount, 3000);
});

test('Plan 398: executeQuickCollection without a tag records no tag field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('categoryTag' in payment, false);
});

// ---- Wiring: the tag appears on the transaction ----

test('Plan 398: app.js imports the tag helpers and shows the tag on both profile history rows and the Transactions card', () => {
  assert.equal(appSrc.includes("from './transaction-category-tag.js'"), true);
  assert.equal(appSrc.includes('categoryTagMarkup'), true);
  const rowCount = appSrc.split('${profileLargeCashApprovalMarkup(payment)}${profileCategoryTagMarkup(payment)}').length - 1;
  assert.equal(rowCount, 2, 'the tag must sit beside the large-cash approval on both profile history rows');
  assert.equal(appSrc.includes('${transactionLargeCashApprovalMarkup(transaction)}${transactionCategoryTagMarkup(transaction)}'), true);
});

test('Plan 398: core.js validates, carries, and projects the tag', () => {
  assert.equal(coreSrc.includes("from './transaction-category-tag.js'"), true);
  assert.equal(coreSrc.includes('normalizeTransactionCategoryTag(categoryTag)'), true);
  assert.equal(coreSrc.includes('categoryTag: fields.categoryTag !== undefined ? fields.categoryTag : existingPayment.categoryTag'), true);
  assert.equal(coreSrc.includes('categoryTag: transactionCategoryTagOf(payment)'), true);
});

test('Plan 398: the profile payment form offers the tag and the submit carries it', () => {
  assert.equal(appSrc.includes('categoryTagFieldMarkup'), true);
  assert.equal(appSrc.includes('ctg-${month}'), true);
  assert.equal(appSrc.includes('name="categoryTag"'), true);
  assert.equal(appSrc.includes("categoryTag: data.get('categoryTag'),"), true);
});

test('Plan 398: the Quick Collect form offers the tag and the submit carries it', () => {
  assert.equal(indexSrc.includes('id="quickCollectCategoryTagSelect"'), true);
  assert.equal(indexSrc.includes('<option value="collection" selected>Collection</option>'), true);
  assert.equal(indexSrc.includes('<option value="advance">Advance</option>'), true);
  assert.equal(indexSrc.includes('<option value="refund">Refund</option>'), true);
  assert.equal(indexSrc.includes('<option value="adjustment">Adjustment</option>'), true);
  assert.equal(indexSrc.includes('<option value="other">Other</option>'), true);
  assert.equal(navSrc.includes('categoryTagSelect?.value'), true);
  assert.equal(navSrc.includes('categoryTag: categoryTagVal || undefined,'), true);
  assert.equal(navSrc.includes('categoryTag: categoryTag || undefined,'), true);
  assert.equal(navSrc.includes("if (categoryTagSelect) categoryTagSelect.value = 'collection';"), true);
});

test('Plan 398: the Transactions view filters by tag, with counts over the full list', () => {
  assert.equal(indexSrc.includes('id="transactionCategoryFilter"'), true);
  assert.equal(indexSrc.includes('<option value="all" selected>All categories</option>'), true);
  assert.equal(appSrc.includes("let transactionCategoryFilter = 'all';"), true);
  assert.equal(appSrc.includes("$('#transactionCategoryFilter').addEventListener('change'"), true);
  assert.equal(appSrc.includes('filterTransactionsByCategoryTag(transactions, transactionCategoryFilter)'), true);
  assert.equal(appSrc.includes('transactionCategoryTagCounts(listTransactions(state))'), true);
  assert.equal(appSrc.includes('filterTransactionsByCategoryTag(txs, transactionCategoryFilter)'), true);
  assert.equal(appSrc.includes("categoryFilterSelect.value = 'all';"), true, 'clearing the filters must reset the category select');
});

// ---- Fences: method reconciliation, neighbours, receipts ----

test('Plan 398: the module header never names a fenced filename literally', () => {
  const reconModule = 'method-' + 'reconciliation.js';
  const choiceModule = 'overpayment-' + 'choice.js';
  const receiptSearchModule = 'receipt-number-' + 'search.js';
  const queueModule = 'offline-queue-' + 'status.js';
  for (const fenced of [reconModule, choiceModule, receiptSearchModule, queueModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 398: the method reconciliation module never reads the tag — untouched', () => {
  const reconModule = 'method-' + 'reconciliation.js';
  const src = fs.readFileSync(path.join(ROOT, '..', reconModule), 'utf8');
  assert.equal(src.includes('categoryTag'), false, reconModule);
  assert.equal(src.includes('transactionCategoryTag'), false, reconModule);
});

test('Plan 398: the receipt never reads the tag — receipts are untouched', () => {
  const receiptModule = 'receipt-' + 'script.js';
  for (const file of ['receipt.js', receiptModule, 'png-receipt.js']) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.equal(src.includes('transactionCategoryTagOf'), false, file);
    assert.equal(src.includes('normalizeTransactionCategoryTag'), false, file);
  }
});

test('Plan 398: no new store — the tag rides the payment record', () => {
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(coreSrc.includes('shahdara_category'), false);
});

test('Plan 398: no new styling and no new language keys', () => {
  assert.equal(stylesSrc.includes('.ctg-'), false);
  assert.equal(stylesSrc.includes('category-tag'), false);
  assert.equal(langSrc.includes('categoryTag'), false);
  assert.equal(indexSrc.includes('quickCollectCategoryTagSelect'), true);
  assert.equal(indexSrc.includes('transactionCategoryFilter'), true);
});

test('Plan 398: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.ok(!testSrc.includes(name), `test carries a real customer name: ${name}`);
  }
});
