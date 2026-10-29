// Field Mode search fix (owner report 2026-10-29): "Yhaa py name search
// kro tu ni ataa" — Field Mode search for a fully-paid customer returned
// nothing. Proven cause (A): the controller built its list ONLY from
// getPendingCollectionCustomers(state, '', 'all-dues'), which drops every
// zero-dues customer before the SISP-31 bilingual matcher ever runs; the
// matcher itself is sound (cause B disproven below — on the 'all' list it
// finds the same customer by partial/lowercase query).
//
// Owner-locked behaviour pinned here:
//   - DEFAULT (no query): zero-dues customers stay HIDDEN (unchanged).
//   - SEARCH: a matching customer MUST show, even with zero dues.
//   - The collect sheet for a zero-due searched customer exposes the
//     ADVANCE option in the Field Mode flow itself; recording stores the
//     payment with kind 'advance' and the advance balance reflects it.
//   - Result cards are colour-coded: RED = dues pending, YELLOW = unused
//     advance credit waiting, GREEN = fully paid. Precedence is pinned
//     from the engine's real figures: dues > 0 -> RED (money owed is the
//     actionable truth), else advance credit > 0 -> YELLOW, else GREEN.
//     A customer CAN hold both at once (a later month overpaid while an
//     earlier month is unpaid — the engine never flows credit backward);
//     the card is RED then, with the credit still shown as text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import {
  isAdvancePayment,
  advanceBalance,
  advanceBalanceCents,
  recordAdvancePayment
} from '../advance-payment.js';
import {
  filterFieldModeEntries,
  fieldModeCustomerStatus,
  searchFieldModeEntries,
  collectFieldModeAdvance
} from '../field-mode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Fixed "today": 2026-10-29 PKT (the owner's report date).
const REF_DATE = new Date('2026-10-29T05:00:00.000Z');

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], ...overrides
});
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, bills: [], ...overrides
});
const paidBill = (month, amount = 3000) => bill(month, {
  payments: [{ id: `pay-${month}`, date: '2026-10-05', amount, method: 'Cash' }]
});

const paidQasim = () => customer('c-paid', 82, 'MUHAMMAD QASIM', {
  mohalla: 'Gangall', phone: '+923001112222',
  bills: [paidBill('2026-10')]
});
const duesQasim = () => customer('c-dues', 90, 'QASIM RAZA', {
  mohalla: 'Barrian',
  bills: [bill('2026-10')]
});

test('owner reproduction: paid Qasim is invisible on the old dues-only seam, found by searchFieldModeEntries', () => {
  const state = { customers: [paidQasim(), customer('c-other', 7, 'FULLY PAID PAL', { bills: [paidBill('2026-10')] })] };

  // The whole ledger has zero dues (the owner's dashboard that day).
  assert.equal(getPendingCollectionCustomers(state, '', 'all-dues', REF_DATE).length, 0);
  // The OLD controller seam: bilingual filter over the dues-only list.
  const oldSeam = filterFieldModeEntries(
    getPendingCollectionCustomers(state, '', 'all-dues', REF_DATE),
    state.customers,
    'Qasim'
  );
  assert.deepEqual(oldSeam, [], 'the defect: the paid customer is dropped before the matcher runs');

  // The NEW search seam: the customer MUST show.
  const found = searchFieldModeEntries(state, 'Qasim', REF_DATE);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, 'c-paid');
  assert.equal(found[0].totalDues, 0);

  // No query -> no search list (default view stays the dues list).
  assert.deepEqual(searchFieldModeEntries(state, '', REF_DATE), []);
  assert.deepEqual(searchFieldModeEntries(state, '   ', REF_DATE), []);
});

test('matcher semantics (cause B disproven): partial + case-insensitive finds dues and paid alike', () => {
  const state = { customers: [paidQasim(), duesQasim()] };
  for (const q of ['qasim', 'QASIM', 'Qas']) {
    const ids = searchFieldModeEntries(state, q, REF_DATE).map(e => e.id).sort();
    assert.deepEqual(ids, ['c-dues', 'c-paid'], `query ${q} finds both`);
  }
  // Substring semantics, identical to the Quick Collect matcher: a
  // fuller name query matches only the customer whose name contains it.
  assert.deepEqual(
    searchFieldModeEntries(state, 'muhammad qasim', REF_DATE).map(e => e.id),
    ['c-paid']
  );
  // Archived customers never surface, even on search.
  const archived = { customers: [customer('c-arch', 99, 'QASIM ARCHIVED', { archived: true, bills: [bill('2026-10')] })] };
  assert.deepEqual(searchFieldModeEntries(archived, 'Qasim', REF_DATE), []);
});

test('status colours: precedence pinned from engine figures (due > advance > paid)', () => {
  const state = { customers: [paidQasim(), duesQasim()] };
  assert.deepEqual(fieldModeCustomerStatus(state, 'c-paid'),
    { key: 'paid', totalDues: 0, advanceCredit: 0 });
  assert.deepEqual(fieldModeCustomerStatus(state, 'c-dues'),
    { key: 'due', totalDues: 3000, advanceCredit: 0 });

  // Advance holder: October overpaid by 2,000 -> credit waits, no dues.
  const advState = { customers: [customer('c-adv', 55, 'ADVANCE HOLDER', { bills: [paidBill('2026-10', 5000)] })] };
  assert.deepEqual(fieldModeCustomerStatus(advState, 'c-adv'),
    { key: 'advance', totalDues: 0, advanceCredit: 2000 });

  // BOTH at once: October unpaid, November overpaid. The engine never
  // flows credit backward, so dues AND waiting credit genuinely coexist;
  // the card is RED (money is owed) and the credit stays visible as text.
  const bothState = { customers: [customer('c-both', 56, 'BOTH CASE', {
    bills: [bill('2026-10'), paidBill('2026-11', 5000)]
  })] };
  const both = fieldModeCustomerStatus(bothState, 'c-both');
  assert.equal(both.key, 'due');
  assert.equal(both.totalDues, 3000);
  assert.equal(both.advanceCredit, 2000);
});

test('owner flow pin: search paid customer -> advance record -> stored kind advance + balance reflects it', () => {
  const state = { customers: [paidQasim()] };
  const entry = searchFieldModeEntries(state, 'Qasim', REF_DATE)[0];
  assert.ok(entry, 'searched customer opens a sheet entry');

  const { nextState, receipt } = collectFieldModeAdvance(
    state, entry, { amount: 3000, method: 'Cash' }, REF_DATE
  );
  assert.equal(receipt.amount, 3000);
  assert.equal(receipt.customerId, 'c-paid');

  const october = nextState.customers[0].bills.find(b => b.month === '2026-10');
  const stored = october.payments[october.payments.length - 1];
  assert.equal(stored.amount, 3000);
  assert.ok(isAdvancePayment(stored), 'payment stored with the advance tag');
  assert.equal(advanceBalanceCents(nextState, 'c-paid'), 300000);
  assert.equal(advanceBalance(nextState, 'c-paid'), 3000);
  assert.equal(fieldModeCustomerStatus(nextState, 'c-paid').key, 'advance');

  // Same machinery as the profile path (PR #488): recordAdvancePayment on
  // the same fixture yields the same advance balance.
  const viaProfile = recordAdvancePayment(state, 'c-paid',
    { amount: 3000, date: '2026-10-29', method: 'Cash' }, REF_DATE);
  assert.equal(advanceBalance(viaProfile.nextState, 'c-paid'), 3000);
});

test('advance from Field Mode settles existing dues first, remainder waits as credit', () => {
  const state = { customers: [duesQasim()] };
  const entry = searchFieldModeEntries(state, 'Qasim', REF_DATE)[0];
  const { nextState } = collectFieldModeAdvance(
    state, entry, { amount: 5000, method: 'Cash' }, REF_DATE
  );
  const status = fieldModeCustomerStatus(nextState, 'c-dues');
  assert.equal(status.totalDues, 0);
  assert.equal(status.advanceCredit, 2000);
  assert.equal(status.key, 'advance');
  assert.throws(
    () => collectFieldModeAdvance(state, entry, { amount: 0, method: 'Cash' }, REF_DATE),
    /greater than zero/
  );
});

test('structure pins: colour strips use theme tokens only; advance sheet controls exist', () => {
  const js = read('field-mode.js');
  for (const needle of [
    'fieldModeAdvanceAmount',
    'fieldModeAdvanceCheckbox',
    'data-field-advance-method',
    "kind: 'advance'",
    'field-mode-status--${status.key}',
    '🔴 Due',
    '🟡 Advance',
    '🟢 Paid'
  ]) {
    assert.ok(js.includes(needle), `field-mode.js contains ${needle}`);
  }
  const css = read('components.css');
  // Permanent brace-balance guard (the topbar lesson): the file must stay balanced.
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length,
    'components.css braces balanced');
  for (const [cls, token] of [
    ['.field-mode-status--due .field-mode-status-strip', 'var(--color-overdue)'],
    ['.field-mode-status--advance .field-mode-status-strip', 'var(--amber)'],
    ['.field-mode-status--paid .field-mode-status-strip', 'var(--color-paid)']
  ]) {
    const at = css.indexOf(cls);
    assert.ok(at >= 0, `${cls} rule exists`);
    const block = css.slice(at, css.indexOf('}', at));
    assert.ok(block.includes(token), `${cls} uses ${token}`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), `${cls} has no hardcoded hex`);
  }
});
