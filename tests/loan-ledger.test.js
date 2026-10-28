import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOAN_KEY, addLoanEntry, deleteLoanEntry, sanitizeLoanEntries,
  loanPersonSummaries, loanGrandTotals, filterLoanPersons,
  loadLoans, saveLoans,
} from '../loan-ledger.js';
import { STORAGE_KEY } from '../core.js';

// Loan ledger: the owner's own lending/borrowing, kept apart from the ISP
// business. Direction is always from the owner's side: "Dena hai" = the
// owner owes them, "Lena hai" = they owe the owner. Balances are derived
// from the log (loans minus repayments), never stored twice.

const loan = (person, direction, amount, overrides = {}) => ({
  person, direction, kind: 'loan', amount, date: '2026-10-01', ...overrides,
});
const repayment = (person, direction, amount, overrides = {}) => ({
  person, direction, kind: 'repayment', amount, date: '2026-10-05', ...overrides,
});

test('per-person dena and lena balances derive from loans minus repayments', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 10000));
  entries = addLoanEntry(entries, loan('Ali', 'dena', 4000));
  entries = addLoanEntry(entries, repayment('Ali', 'lena', 3000));
  const [ali] = loanPersonSummaries(entries);
  assert.equal(ali.name, 'Ali');
  assert.equal(ali.lena, 7000);
  assert.equal(ali.dena, 4000);
  assert.equal(ali.net, 3000, 'net to receive: lena minus dena');
  assert.equal(ali.outstanding, 11000);
  assert.equal(ali.settled, false);
});

test('repayment that settles a direction leaves a zero balance and a settled person', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Bilal', 'dena', 5000));
  entries = addLoanEntry(entries, repayment('Bilal', 'dena', 5000));
  const [bilal] = loanPersonSummaries(entries);
  assert.equal(bilal.dena, 0);
  assert.equal(bilal.settled, true);
});

test('repayment above the outstanding balance is refused', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 2000));
  assert.throws(() => addLoanEntry(entries, repayment('Ali', 'lena', 2001)), /exceeds the outstanding/);
  assert.equal(loanPersonSummaries(entries)[0].lena, 2000, 'refused repayment changes nothing');
  assert.throws(() => addLoanEntry(entries, repayment('Ali', 'dena', 100)), /exceeds the outstanding/);
});

test('name spelling variants of one person merge into a single account', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 1000));
  entries = addLoanEntry(entries, loan('  ali ', 'lena', 2000));
  entries = addLoanEntry(entries, loan('ALI', 'dena', 500));
  const summaries = loanPersonSummaries(entries);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].lena, 3000);
  assert.equal(summaries[0].dena, 500);
});

test('grand totals sum every person and net to receive minus to pay', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 10000));
  entries = addLoanEntry(entries, loan('Bilal', 'dena', 4000));
  entries = addLoanEntry(entries, loan('Bilal', 'lena', 1000));
  const totals = loanGrandTotals(entries);
  assert.equal(totals.lena, 11000);
  assert.equal(totals.dena, 4000);
  assert.equal(totals.net, 7000);
  assert.equal(totals.personCount, 2);
  assert.equal(totals.outstandingPersonCount, 2);
  assert.equal(totals.entryCount, 3);
});

test('person list sorts by outstanding balance descending, then name', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Zain', 'lena', 1000));
  entries = addLoanEntry(entries, loan('Ali', 'lena', 9000));
  entries = addLoanEntry(entries, loan('Bilal', 'dena', 9000));
  assert.deepEqual(loanPersonSummaries(entries).map(p => p.name), ['Ali', 'Bilal', 'Zain']);
});

test('filters narrow by direction balance and by name or phone search', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 5000, { phone: '03001234567' }));
  entries = addLoanEntry(entries, loan('Bilal', 'dena', 3000));
  const summaries = loanPersonSummaries(entries);
  assert.deepEqual(filterLoanPersons(summaries, { direction: 'lena' }).map(p => p.name), ['Ali']);
  assert.deepEqual(filterLoanPersons(summaries, { direction: 'dena' }).map(p => p.name), ['Bilal']);
  assert.deepEqual(filterLoanPersons(summaries, { query: '0300' }).map(p => p.name), ['Ali']);
  assert.deepEqual(filterLoanPersons(summaries, { query: 'bil' }).map(p => p.name), ['Bilal']);
  assert.deepEqual(filterLoanPersons(summaries, { query: 'nobody' }), []);
});

test('deleting an entry removes it and recomputes balances', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 5000));
  entries = addLoanEntry(entries, repayment('Ali', 'lena', 2000));
  assert.equal(loanPersonSummaries(entries)[0].lena, 3000);
  const repaymentId = entries[1].id;
  entries = deleteLoanEntry(entries, repaymentId);
  assert.equal(entries.length, 1);
  assert.equal(loanPersonSummaries(entries)[0].lena, 5000, 'balance returns to the full loan once the repayment is removed');
});

test('delete of an unknown id throws and sanitize drops malformed rows', () => {
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 5000));
  assert.throws(() => deleteLoanEntry(entries, 'LN-999'), /not found/);
  const cleaned = sanitizeLoanEntries([
    { person: 'Ali', direction: 'lena', kind: 'loan', amount: 100, date: '2026-10-01' },
    { person: '', direction: 'lena', kind: 'loan', amount: 100 },
    { person: 'Bilal', direction: 'sideways', kind: 'loan', amount: 100 },
    { person: 'Bilal', direction: 'lena', kind: 'loan', amount: -50 },
    null,
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].person, 'Ali');
});

test('entry validation rejects blank names, bad directions, non-positive amounts and missing dates', () => {
  assert.throws(() => addLoanEntry([], loan('', 'lena', 100)), /name/);
  assert.throws(() => addLoanEntry([], loan('Ali', 'sideways', 100)), /Dena hai or Lena hai/);
  assert.throws(() => addLoanEntry([], loan('Ali', 'lena', 0)), /positive/);
  assert.throws(() => addLoanEntry([], { person: 'Ali', direction: 'lena', kind: 'loan', amount: 100, date: '' }), /date/);
});

test('load and save round-trip through an isolated storage key', () => {
  assert.notEqual(LOAN_KEY, STORAGE_KEY, 'loan money never shares the business ledger key');
  const store = new Map();
  const storage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, value); },
  };
  assert.deepEqual(loadLoans(storage), []);
  let entries = [];
  entries = addLoanEntry(entries, loan('Ali', 'lena', 5000, { phone: '0300' }));
  assert.equal(saveLoans(entries, storage), true);
  assert.deepEqual([...store.keys()], [LOAN_KEY], 'nothing else is written');
  const loaded = loadLoans(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].person, 'Ali');
  assert.equal(loanPersonSummaries(loaded)[0].lena, 5000);
});
