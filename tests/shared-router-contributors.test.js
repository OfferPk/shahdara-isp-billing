// SISP-158: Shared-Router 2-Neighbor Split Bill Contributor Tracker.
// Pure-function, core round-trip and receipt tests on SYNTHETIC data only.
//
// Pinned spec criteria:
//  - fixture: package price 3,000; contributors A 1,000 / B 1,000; the main
//    customer's implicit share is the unallocated remainder (1,000).
//  - A pays 1,000 tagged -> A remaining 0, B 1,000, main 1,000.
//  - an untagged 500 -> main remaining 500.
//  - a voided tagged payment never counts.
//  - cycle reset is derived: the next month starts everyone at 0 paid
//    with the shares unchanged (nothing is stored per month).
//  - contributors are an attribution layer only: one normal bill, the
//    engine/dues never split (split status is a read-only derivation).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, updateCustomerProfile, addPayment, correctPayment,
  saveBillMonth, readState, createJsonBackup, previewJsonBackupMerge, STORAGE_KEY
} from '../core.js';
import {
  sanitizeSubContributors, subContributorsOf, sanitizePaidByContributorStamp,
  contributorSnapshotFor, contributorSplitStatus, MAX_SUB_CONTRIBUTORS
} from '../shared-router-contributors.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import {
  contributorSplitSectionHtml, contributorEditorHtml, contributorSharesWarningText,
  createReceiptWhatsAppDraft
} from '../profile-ui.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T12:00:00+05:00');
const MONTH = '2026-10';
const NEXT_MONTH = '2026-11';

const pay = (id, overrides = {}) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });
const billOf = (month, payments = []) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments, generated: true, priceSnapshot: 3000, createdAt: '2026-10-01T00:00:00.000Z', amountHistory: []
});
const splitCustomer = (payments = [], month = MONTH) => ({
  id: 'cust-1', customerNumber: 9, name: 'Main Holder', archived: false, billingStartMonth: null,
  monthlySellingAmount: 3000,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  subContributors: [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1000, phone: '0300-1112223' }
  ],
  bills: [billOf(month, payments)]
});

// ---------------------------------------------------------------- sanitizer
test('sanitizer: valid rows survive with stable ids; name trimmed, phone as typed', () => {
  const rows = sanitizeSubContributors([
    { name: '  Hamsaya A  ', sharePKR: 1000, phone: ' 0300-111 2223 ' },
    { id: 'SC-7', name: 'Hamsaya B', sharePKR: '1500.5' }
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000, phone: '0300-111 2223' });
  assert.deepEqual(rows[1], { id: 'SC-7', name: 'Hamsaya B', sharePKR: 1500.5, phone: '' });
});

test('sanitizer: unusable rows drop, never throw; non-array reads as empty', () => {
  assert.deepEqual(sanitizeSubContributors(undefined), []);
  assert.deepEqual(sanitizeSubContributors('nope'), []);
  assert.deepEqual(sanitizeSubContributors([
    null, 42, 'x', {},
    { name: '', sharePKR: 100 },
    { name: '   ', sharePKR: 100 },
    { name: 'Zero Share', sharePKR: 0 },
    { name: 'Negative Share', sharePKR: -50 },
    { name: 'NaN Share', sharePKR: 'abc' },
    { name: 'Ok', sharePKR: 500 }
  ]), [{ id: 'SC-1', name: 'Ok', sharePKR: 500, phone: '' }]);
});

test('sanitizer: duplicate explicit ids are re-assigned, list is capped', () => {
  const rows = sanitizeSubContributors([
    { id: 'SC-1', name: 'First', sharePKR: 100 },
    { id: 'SC-1', name: 'Second', sharePKR: 200 },
    { id: 'bogus', name: 'Third', sharePKR: 300 }
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['SC-1', 'SC-2', 'SC-3']);
  const many = sanitizeSubContributors(Array.from({ length: 15 }, (_, i) => ({ name: `N${i}`, sharePKR: 10 })));
  assert.equal(many.length, MAX_SUB_CONTRIBUTORS);
});

test('stamp sanitizer: only an exact { SC-n id, non-empty name } pair survives', () => {
  assert.deepEqual(sanitizePaidByContributorStamp({ id: 'SC-2', name: ' Hamsaya B ' }), { id: 'SC-2', name: 'Hamsaya B' });
  assert.equal(sanitizePaidByContributorStamp({ id: 'XX-2', name: 'Hamsaya B' }), null);
  assert.equal(sanitizePaidByContributorStamp({ id: 'SC-2', name: '  ' }), null);
  assert.equal(sanitizePaidByContributorStamp({ id: 'SC-2' }), null);
  assert.equal(sanitizePaidByContributorStamp('SC-2'), null);
  assert.equal(sanitizePaidByContributorStamp(null), null);
});

// ------------------------------------------------------- split derivation
test('split: spec fixture — A pays own share tagged; B and main untouched', () => {
  const customer = splitCustomer([pay('p1', { amount: 1000, paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } })]);
  const split = contributorSplitStatus(customer, customer.bills[0], { price: 3000 });
  const [a, b] = split.rows;
  assert.deepEqual({ share: a.share, paid: a.paid, remaining: a.remaining }, { share: 1000, paid: 1000, remaining: 0 });
  assert.deepEqual({ share: b.share, paid: b.paid, remaining: b.remaining }, { share: 1000, paid: 0, remaining: 1000 });
  // The main customer's implicit share is the unallocated remainder.
  assert.deepEqual({ share: split.main.share, paid: split.main.paid, remaining: split.main.remaining }, { share: 1000, paid: 0, remaining: 1000 });
  assert.equal(split.sharesSum, 2000);
  assert.equal(split.sharesMismatch, true);
});

test('split: untagged money attributes to the main customer', () => {
  const customer = splitCustomer([
    pay('p1', { amount: 1000, paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } }),
    pay('p2', { amount: 500 })
  ]);
  const split = contributorSplitStatus(customer, customer.bills[0], { price: 3000 });
  assert.equal(split.main.paid, 500);
  assert.equal(split.main.remaining, 500);
});

test('split: voided tagged payment is excluded entirely', () => {
  const customer = splitCustomer([
    pay('p1', { amount: 1000, paidByContributor: { id: 'SC-2', name: 'Hamsaya B' }, voided: true, voidReason: 'duplicate' })
  ]);
  const split = contributorSplitStatus(customer, customer.bills[0], { price: 3000 });
  assert.equal(split.rows[1].paid, 0);
  assert.equal(split.rows[1].remaining, 1000);
});

test('split: overpay shows 0 remaining and never a per-contributor credit', () => {
  const customer = splitCustomer([pay('p1', { amount: 1250, paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } })]);
  const split = contributorSplitStatus(customer, customer.bills[0], { price: 3000 });
  assert.equal(split.rows[0].paid, 1250);
  assert.equal(split.rows[0].remaining, 0);
});

test('split: cycle reset is derived — next month starts at zero, shares unchanged', () => {
  const october = splitCustomer([pay('p1', { amount: 1000, paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } })]);
  const novemberBill = billOf(NEXT_MONTH, []);
  const split = contributorSplitStatus(october, novemberBill, { price: 3000 });
  assert.equal(split.month, NEXT_MONTH);
  for (const row of [...split.rows, split.main]) {
    assert.equal(row.paid, 0);
    assert.equal(row.remaining, row.share);
  }
  assert.equal(split.rows[0].share, 1000);
});

test('split: shares above the price floor the main share at 0; equal shares = no mismatch', () => {
  const over = splitCustomer([]);
  over.subContributors = [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 2000, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1500, phone: '' }
  ];
  const overSplit = contributorSplitStatus(over, over.bills[0], { price: 3000 });
  assert.equal(overSplit.main.share, 0);
  assert.equal(overSplit.sharesMismatch, true);

  const exact = splitCustomer([]);
  exact.subContributors = [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1500, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1500, phone: '' }
  ];
  const exactSplit = contributorSplitStatus(exact, exact.bills[0], { price: 3000 });
  assert.equal(exactSplit.main.share, 0);
  assert.equal(exactSplit.sharesMismatch, false);
});

test('split: no contributors -> null (ordinary customers untouched)', () => {
  const plain = splitCustomer([]);
  delete plain.subContributors;
  assert.equal(contributorSplitStatus(plain, plain.bills[0], { price: 3000 }), null);
  assert.deepEqual(subContributorsOf(plain), []);
});

// ------------------------------------------------------- core round-trips
function coreStateWithContributors() {
  let state = createInitialState();
  state = addCustomer(state, 'Main Holder', REF, {
    subContributors: [
      { name: 'Hamsaya A', sharePKR: 1000 },
      { name: 'Hamsaya B', sharePKR: 1000, phone: '0300-1112223' }
    ]
  });
  const customer = state.customers.at(-1);
  state = updateCustomerProfile(state, customer.id, { monthlySellingAmount: 3000 }, REF);
  state = saveBillMonth(state, customer.id, { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  return { state, customerId: customer.id };
}

test('core: addCustomer sanitizes + stores contributors; update replaces; omission keeps', () => {
  const { state, customerId } = coreStateWithContributors();
  const stored = state.customers.find((c) => c.id === customerId);
  assert.deepEqual(stored.subContributors, [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1000, phone: '0300-1112223' }
  ]);
  const renamed = updateCustomerProfile(state, customerId, { phone: '0300-9998887' }, REF);
  assert.equal(renamed.customers.find((c) => c.id === customerId).subContributors.length, 2);
  const replaced = updateCustomerProfile(state, customerId, { subContributors: [{ name: 'Only Neighbour', sharePKR: 3000 }] }, REF);
  assert.deepEqual(replaced.customers.find((c) => c.id === customerId).subContributors, [
    { id: 'SC-1', name: 'Only Neighbour', sharePKR: 3000, phone: '' }
  ]);
});

test('core: readState round-trips contributors unchanged', () => {
  const { state, customerId } = coreStateWithContributors();
  const storage = { getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(state) : null) };
  const loaded = readState(storage);
  assert.deepEqual(loaded.customers.find((c) => c.id === customerId).subContributors, [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1000, phone: '0300-1112223' }
  ]);
});

test('core: payment stamp stored when valid, dropped when malformed, carried by correction', () => {
  const { state, customerId } = coreStateWithContributors();
  let next = addPayment(state, customerId, MONTH, { date: '2026-10-06', amount: 1000, method: 'Cash', paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } }, REF);
  const bill = () => next.customers.find((c) => c.id === customerId).bills.find((b) => b.month === MONTH);
  const stamped = bill().payments.at(-1);
  assert.deepEqual(stamped.paidByContributor, { id: 'SC-1', name: 'Hamsaya A' });

  next = addPayment(next, customerId, MONTH, { date: '2026-10-07', amount: 100, method: 'Cash', paidByContributor: { id: 'XX', name: 'Nobody' } }, REF);
  const malformed = bill().payments.at(-1);
  assert.equal('paidByContributor' in malformed, false);

  // A correction that never mentions the stamp must not strip it.
  const corrected = correctPayment(next, customerId, MONTH, stamped.id, { date: stamped.date, amount: 900, method: 'Cash' }, REF);
  const after = corrected.customers.find((c) => c.id === customerId).bills.find((b) => b.month === MONTH).payments.find((p) => p.id === stamped.id);
  assert.equal(after.amount, 900);
  assert.deepEqual(after.paidByContributor, { id: 'SC-1', name: 'Hamsaya A' });
});

test('snapshot survives contributor removal: payment keeps its stamp; split shows an orphan row', () => {
  const { state, customerId } = coreStateWithContributors();
  let next = addPayment(state, customerId, MONTH, { date: '2026-10-06', amount: 1000, method: 'Cash', paidByContributor: { id: 'SC-2', name: 'Hamsaya B' } }, REF);
  next = updateCustomerProfile(next, customerId, { subContributors: [{ id: 'SC-1', name: 'Hamsaya A', sharePKR: 1000 }] }, REF);
  const customer = next.customers.find((c) => c.id === customerId);
  const bill = customer.bills.find((b) => b.month === MONTH);
  // The saved payment still carries the snapshot — history is not rewritten.
  assert.deepEqual(bill.payments.at(-1).paidByContributor, { id: 'SC-2', name: 'Hamsaya B' });
  // And the derivation keeps the removed neighbour visible under the
  // snapshot name instead of folding the money into the main row.
  const split = contributorSplitStatus(customer, bill, { price: 3000 });
  const orphan = split.rows.find((row) => row.id === 'SC-2');
  assert.equal(orphan.name, 'Hamsaya B');
  assert.equal(orphan.removed, true);
  assert.equal(orphan.paid, 1000);
  assert.equal(split.main.paid, 0);
});

test('backup: contributors round-trip through createJsonBackup + preview merge (adopt by id, local wins)', () => {
  const { state, customerId } = coreStateWithContributors();
  const backupText = createJsonBackup(state, REF);
  // Local device holds the same customer with only SC-1 (edited share).
  let local = createInitialState();
  local = addCustomer(local, 'Main Holder', REF, { subContributors: [{ name: 'Hamsaya A', sharePKR: 1200 }] });
  const localCustomer = local.customers.at(-1);
  // Align identity so the merge matches the same profile.
  local = { ...local, customers: local.customers.map((c) => ({ ...c, id: customerId, customerNumber: state.customers.find((x) => x.id === customerId).customerNumber })) };
  void localCustomer;
  const preview = previewJsonBackupMerge(local, backupText);
  const merged = preview.state.customers.find((c) => c.id === customerId);
  assert.deepEqual(merged.subContributors, [
    { id: 'SC-1', name: 'Hamsaya A', sharePKR: 1200, phone: '' },
    { id: 'SC-2', name: 'Hamsaya B', sharePKR: 1000, phone: '0300-1112223' }
  ]);
});

// ----------------------------------------------------------------- receipts
test('receipt: split block honours through-this-payment semantics', () => {
  const p1 = pay('p1', { amount: 400, date: '2026-10-06', paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } });
  const p2 = pay('p2', { amount: 300, date: '2026-10-07', paidByContributor: { id: 'SC-2', name: 'Hamsaya B' } });
  const customer = splitCustomer([p1, p2]);
  const bill = customer.bills[0];

  const first = buildPaymentReceipt(customer, bill, p1);
  assert.equal(first.contributorSplit.rows[0].paid, 400);
  assert.equal(first.contributorSplit.rows[0].remaining, 600);
  assert.equal(first.contributorSplit.rows[1].paid, 0); // later payment does not count yet
  assert.equal(first.contributorSplit.main.paid, 0);

  const second = buildPaymentReceipt(customer, bill, p2);
  assert.equal(second.contributorSplit.rows[0].paid, 400);
  assert.equal(second.contributorSplit.rows[1].paid, 300);
  assert.equal(second.contributorSplit.rows[1].remaining, 700);
});

test('receipt: ordinary customer -> null split and no split markup in any layout', () => {
  const p1 = pay('p1', { amount: 500, date: '2026-10-06' });
  const customer = splitCustomer([p1]);
  delete customer.subContributors;
  const receipt = buildPaymentReceipt(customer, customer.bills[0], p1);
  assert.equal(receipt.contributorSplit, null);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.equal(html.includes('Hamsaya Hissa'), false, `${format} must not print a split block`);
  }
});

test('receipt: contributor customer -> split rows print on A4 + both thermals', () => {
  const p1 = pay('p1', { amount: 1000, date: '2026-10-06', paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } });
  const customer = splitCustomer([p1]);
  const receipt = buildPaymentReceipt(customer, customer.bills[0], p1);
  assert.ok(receipt.contributorSplit);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('Hamsaya — Hamsaya A'), `${format} missing contributor row`);
    assert.ok(html.includes('Hamsaya — Hamsaya B'), `${format} missing second contributor row`);
    assert.ok(html.includes('Asal Customer — Main Holder'), `${format} missing main row`);
  }
});

// --------------------------------------------------------------- profile UI
test('profile card: empty for ordinary customers; rows + soft warning when shares mismatch', () => {
  const plain = splitCustomer([]);
  delete plain.subContributors;
  assert.equal(contributorSplitSectionHtml(plain, { month: MONTH, price: 3000 }), '');

  const customer = splitCustomer([pay('p1', { amount: 1000, paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } })]);
  const html = contributorSplitSectionHtml(customer, { month: MONTH, price: 3000 });
  assert.ok(html.includes('Hamsaya A'));
  assert.ok(html.includes('contrib-warn')); // 2,000 of shares vs 3,000 price -> soft warning
  assert.equal(contributorSharesWarningText(2000, 3000).length > 0, true);
  assert.equal(contributorSharesWarningText(3000, 3000), '');
  assert.equal(contributorSharesWarningText(2000, null), '');

  const editor = contributorEditorHtml(customer, 3000);
  assert.ok(editor.includes('data-contrib-add'));
  assert.ok(editor.includes('data-contrib-remove'));
  assert.ok(editor.includes('Hamsaya B'));
});

test('whatsapp draft: split lines print only when a split is attached', () => {
  const p1 = pay('p1', { amount: 1000, date: '2026-10-06', paidByContributor: { id: 'SC-1', name: 'Hamsaya A' } });
  const customer = splitCustomer([p1]);
  const receipt = buildPaymentReceipt(customer, customer.bills[0], p1);
  const base = {
    customerId: customer.id, customerName: customer.name, customerNumber: customer.customerNumber,
    date: p1.date, amount: p1.amount, method: 'Cash', month: MONTH,
    paymentId: p1.id, billStatus: null, billAmount: null, balanceDueCents: null
  };
  const withSplit = createReceiptWhatsAppDraft('+923001234567', { ...base, contributorSplit: receipt.contributorSplit });
  assert.ok(withSplit.message.includes('Hamsaya A'));
  const without = createReceiptWhatsAppDraft('+923001234567', base);
  assert.equal(without.message.includes('Hissa taqseem'), false);
});

// ------------------------------------------------------------ quick collect
test('quick collect: picker id stamps a snapshot; no pick / unknown id stays untagged', () => {
  const { state, customerId } = coreStateWithContributors();
  const customer = state.customers.find((c) => c.id === customerId);
  assert.deepEqual(contributorSnapshotFor(customer, 'SC-2'), { id: 'SC-2', name: 'Hamsaya B' });
  assert.equal(contributorSnapshotFor(customer, 'SC-99'), null);

  const tagged = executeQuickCollection(state, {
    customerId, month: MONTH, amount: 1000, date: '2026-10-06', method: 'Cash', paidByContributorId: 'SC-1'
  }, REF);
  const taggedPayment = tagged.nextState.customers.find((c) => c.id === customerId)
    .bills.find((b) => b.month === MONTH).payments.at(-1);
  assert.deepEqual(taggedPayment.paidByContributor, { id: 'SC-1', name: 'Hamsaya A' });
  assert.deepEqual(tagged.receipt.paidByContributor, { id: 'SC-1', name: 'Hamsaya A' });

  const untagged = executeQuickCollection(state, {
    customerId, month: MONTH, amount: 1000, date: '2026-10-06', method: 'Cash'
  }, REF);
  const plainPayment = untagged.nextState.customers.find((c) => c.id === customerId)
    .bills.find((b) => b.month === MONTH).payments.at(-1);
  assert.equal('paidByContributor' in plainPayment, false);
});

// --------------------------------------------------------------------- i18n
test('i18n: every contrib_* key exists in both dictionaries; every t() call resolves', () => {
  const keys = [
    'contrib_heading', 'contrib_aria', 'contrib_note', 'contrib_row', 'contrib_main_row',
    'contrib_warn_sum', 'contrib_name_label', 'contrib_share_label', 'contrib_phone_label',
    'contrib_add', 'contrib_remove', 'contrib_empty', 'contrib_invalid_row', 'contrib_qc_label',
    'contrib_qc_main', 'contrib_hist_tag', 'contrib_wa_heading', 'contrib_wa_row'
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
  }
  // Mechanical audit: scan every source that renders contributor UI for
  // t('contrib_…') calls and data-i18n attributes — zero raw keys allowed.
  const found = new Set();
  for (const file of ['app.js', 'profile-ui.js', 'nav-quick-collect.js', 'index.html']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/t\('(contrib_[a-z0-9_]+)'\)/g)) found.add(match[1]);
    for (const match of source.matchAll(/data-i18n="(contrib_[a-z0-9_]+)"/g)) found.add(match[1]);
  }
  assert.ok(found.size >= 10, 'expected the audit to find the wired keys');
  for (const key of found) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing wired key ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing wired key ${key}`);
  }
});
