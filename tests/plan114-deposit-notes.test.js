import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validDepositNoteDate,
  validDepositNotePeriod,
  depositNoteAmountCents,
  normalizeDepositNote,
  normalizeDepositNoteList,
  findDepositNote,
  isDepositNoteActive,
  activeDepositNotes,
  supersededDepositNotes,
  notesForDeposit,
  notesForCustomer,
  upsertDepositNote,
  supersedeDepositNote,
  depositBalance,
  depositNoteSummaryText,
  depositBalanceText,
  depositNoteHtml,
  depositNoteCsv,
  depositNoteFilename,
} from '../deposit-notes.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'deposit-notes.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const note = (overrides = {}) => ({
  id: 'DN-1',
  depositId: 'DEP-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  kind: 'interest',
  period: '2026-01',
  basis: 'Yearly interest at agreed rate',
  amountCents: 5000,
  noteDate: '2026-01-31',
  ...overrides,
});

test('plan114: strict dates and periods', () => {
  assert.equal(validDepositNoteDate('2026-01-31'), true);
  assert.equal(validDepositNoteDate('2026-02-30'), false);
  assert.equal(validDepositNoteDate('2026-13-01'), false);
  assert.equal(validDepositNoteDate('31-01-2026'), false);
  assert.equal(validDepositNotePeriod('2026-01'), true);
  assert.equal(validDepositNotePeriod('2026-13'), false);
  assert.equal(validDepositNotePeriod('2026-1'), false);
  assert.equal(normalizeDepositNote(note({ noteDate: '2026-02-30' })), null);
  assert.equal(normalizeDepositNote(note({ period: '2026-13' })), null);
  assert.notEqual(normalizeDepositNote(note({ period: '' })), null);
});

test('plan114: half-formed notes refused, unknown fields dropped', () => {
  assert.equal(normalizeDepositNote(note({ depositId: '' })), null);
  assert.equal(normalizeDepositNote(note({ customerId: '' })), null);
  assert.equal(normalizeDepositNote(note({ basis: '   ' })), null);
  assert.equal(normalizeDepositNote(note({ kind: 'bonus' })), null);
  assert.equal(normalizeDepositNote(note({ noteDate: '' })), null);
  const cleaned = normalizeDepositNote(note({ paymentId: 'PAY-9', billTotal: 999 }));
  assert.equal(cleaned.paymentId, undefined);
  assert.equal(cleaned.billTotal, undefined);
  assert.equal(cleaned.basis, 'Yearly interest at agreed rate');
});

test('plan114: rupees convert once, cents pass through, zero refused', () => {
  assert.equal(depositNoteAmountCents({ amount: 250 }, 'amountCents', 'amount'), 25000);
  assert.equal(depositNoteAmountCents({ amount: '250' }, 'amountCents', 'amount'), 25000);
  assert.equal(depositNoteAmountCents({ amount: -200 }, 'amountCents', 'amount'), -20000);
  assert.equal(depositNoteAmountCents({ amountCents: 5000, amount: 999 }, 'amountCents', 'amount'), 5000);
  assert.equal(depositNoteAmountCents({ amount: 'not a number' }, 'amountCents', 'amount'), null);
  assert.equal(normalizeDepositNote(note({ amountCents: 0 })), null);
  assert.equal(normalizeDepositNote(note({ amountCents: undefined, amount: 0 })), null);
  // A stored record re-read through the normaliser never inflates.
  const stored = normalizeDepositNote(note());
  assert.equal(normalizeDepositNote(stored).amountCents, 5000);
});

test('plan114: duplicate id never rewritten', () => {
  const list = upsertDepositNote([], note());
  assert.equal(list.length, 1);
  assert.equal(upsertDepositNote(list, note()).length, 1);
  const changed = upsertDepositNote(list, note({ amountCents: 6000 }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].amountCents, 5000);
  assert.equal(upsertDepositNote(list, note({ id: 'DN-2', kind: 'bonus' })).length, 1);
});

test('plan114: one active note per deposit, period, and kind', () => {
  let list = upsertDepositNote([], note());
  assert.equal(upsertDepositNote(list, note({ id: 'DN-2' })).length, 1);
  assert.equal(upsertDepositNote(list, note({ id: 'DN-2', kind: 'adjustment' })).length, 2);
  assert.equal(upsertDepositNote(list, note({ id: 'DN-2', period: '2026-02' })).length, 2);
  assert.equal(upsertDepositNote(list, note({ id: 'DN-2', depositId: 'DEP-2' })).length, 2);
  // No period recorded: the rule does not apply.
  const noPeriod = upsertDepositNote([], note({ period: '' }));
  assert.equal(upsertDepositNote(noPeriod, note({ id: 'DN-2', period: '' })).length, 2);
});

test('plan114: supersede keeps history, counts only the follow-up', () => {
  const list = upsertDepositNote([], note());
  const after = supersedeDepositNote(list, 'DN-1', note({
    id: 'DN-2', amountCents: 7000, noteDate: '2026-02-15', basis: 'Corrected interest figure',
  }));
  assert.equal(after.length, 2);
  const original = findDepositNote(after, 'DN-1');
  assert.equal(original.supersededBy, 'DN-2');
  assert.equal(original.supersededDate, '2026-02-15');
  assert.equal(isDepositNoteActive(original), false);
  assert.equal(activeDepositNotes(after).length, 1);
  assert.equal(supersededDepositNotes(after).length, 1);
  // Superseding frees the period+kind slot for the follow-up itself.
  assert.equal(findDepositNote(after, 'DN-2').amountCents, 7000);
  const balance = depositBalance(after, 'DEP-1', 100000);
  assert.equal(balance.notesCents, 7000);
  assert.equal(balance.balanceCents, 107000);
  assert.equal(balance.supersededCount, 1);
});

test('plan114: supersede gates', () => {
  const list = upsertDepositNote([], note());
  assert.deepEqual(supersedeDepositNote(list, 'DN-9', note({ id: 'DN-2' })), list);
  assert.deepEqual(supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', noteDate: '2026-01-01' })), list);
  assert.deepEqual(supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', depositId: 'DEP-9' })), list);
  assert.deepEqual(supersedeDepositNote(list, 'DN-1', note({ id: 'DN-1' })), list);
  assert.deepEqual(supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', kind: 'bonus' })), list);
  const once = supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', noteDate: '2026-02-01' }));
  assert.deepEqual(supersedeDepositNote(once, 'DN-1', note({ id: 'DN-3', noteDate: '2026-03-01' })), once);
  // Same-day follow-up is dated, not early: allowed.
  assert.equal(supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', noteDate: '2026-01-31' })).length, 2);
});

test('plan114: balance sums active notes only, unusable opening refuses', () => {
  const list = upsertDepositNote([], note());
  const withReturn = upsertDepositNote(list, note({
    id: 'DN-2', kind: 'partial_return', period: '2026-02', amountCents: -20000, noteDate: '2026-02-10', basis: 'Partial return on exit',
  }));
  const balance = depositBalance(withReturn, 'DEP-1', 100000);
  assert.equal(balance.openingCents, 100000);
  assert.equal(balance.notesCents, -15000);
  assert.equal(balance.balanceCents, 85000);
  assert.equal(balance.activeCount, 2);
  assert.equal(depositBalance(withReturn, 'DEP-1', 'lots'), null);
  assert.equal(depositBalance(withReturn, 'DEP-1', 100.5), null);
  assert.deepEqual(depositBalance([], 'DEP-1', 100000), {
    depositId: 'DEP-1', openingCents: 100000, notesCents: 0, balanceCents: 100000, activeCount: 0, supersededCount: 0,
  });
  assert.equal(depositBalance(withReturn, 'DEP-9', 100000).balanceCents, 100000);
});

test('plan114: filters by deposit and customer', () => {
  let list = upsertDepositNote([], note());
  list = upsertDepositNote(list, note({ id: 'DN-2', depositId: 'DEP-2', period: '2026-02' }));
  list = upsertDepositNote(list, note({ id: 'DN-3', customerId: 'CUST-9', depositId: 'DEP-3', period: '2026-02' }));
  assert.equal(notesForDeposit(list, 'DEP-1').length, 1);
  assert.equal(notesForDeposit(list, '').length, 0);
  assert.equal(notesForCustomer(list, 'CUST-76').length, 2);
  assert.equal(notesForCustomer(list, 'CUST-9').length, 1);
});

test('plan114: no input list is ever mutated', () => {
  const list = upsertDepositNote([], note());
  const snapshot = JSON.stringify(list);
  upsertDepositNote(list, note({ id: 'DN-2', period: '2026-02' }));
  supersedeDepositNote(list, 'DN-1', note({ id: 'DN-2', noteDate: '2026-02-01' }));
  assert.equal(JSON.stringify(list), snapshot);
});

test('plan114: summary, balance text, html escaping, csv quoting', () => {
  assert.equal(depositNoteSummaryText([]), 'No deposit notes recorded yet.');
  const list = upsertDepositNote([], note());
  assert.match(depositNoteSummaryText(list), /1 deposit note \(1 active, 0 superseded\)/);
  assert.match(depositBalanceText(depositBalance(list, 'DEP-1', 100000)), /Rs\. 1000\.00 \+ active notes Rs\. 50\.00 = balance Rs\. 1050\.00/);
  assert.equal(depositBalanceText(null), 'Balance not stated: the opening amount held is unusable.');
  const htmlOut = depositNoteHtml(note({ basis: '<script>alert(1)</script>' }));
  assert.doesNotMatch(htmlOut, /<script>/);
  assert.match(htmlOut, /Interest/);
  const csv = depositNoteCsv([note({ basis: 'Rate, "agreed"' })]);
  assert.match(csv, /id,deposit id,customer,kind,period,basis,amount \(Rs\),date,superseded by,superseded date/);
  assert.match(csv, /"Rate, ""agreed"""/);
  assert.equal(depositNoteFilename(), 'deposit-notes.csv');
  assert.equal(depositNoteHtml(null), '<p>Deposit note not recorded: its inputs are incomplete.</p>');
});

test('plan114: purity fence — deposit record never opened, nothing created', () => {
  assert.doesNotMatch(source, /from\s+['"]/);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /deposit-register|depositRegister/);
  assert.doesNotMatch(source, /credit-balance|creditBalance/);
});

test('plan114: panel ids present in index.html', () => {
  const ids = ['depositNoteCustomer', 'depositNoteDeposit', 'depositNoteKind', 'depositNotePeriod',
    'depositNoteBasis', 'depositNoteAmount', 'depositNoteDate', 'depositNoteSaveBtn',
    'depositNoteFilterCustomer', 'depositNoteBody', 'depositNoteSummary',
    'depositNoteBalanceDeposit', 'depositNoteBalanceOpening', 'depositNoteBalanceBtn',
    'depositNoteBalanceResult', 'depositNoteSupersedeNote', 'depositNoteSupersedeKind',
    'depositNoteSupersedePeriod', 'depositNoteSupersedeBasis', 'depositNoteSupersedeAmount',
    'depositNoteSupersedeDate', 'depositNoteSupersedeBtn', 'depositNoteExportBtn'];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
});
