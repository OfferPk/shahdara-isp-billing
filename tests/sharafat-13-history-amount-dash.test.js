// Sharafat 13 — History amount formatters print "PKR 0" for a figure
// that is not a number (repo money rule violated). A history row with
// a missing or corrupt amount must show a bare dash, never PKR 0 —
// the repo rule is null/undefined/empty/boolean = "not a number",
// never zero, the same rendering receipt-money.js uses. A real zero
// still prints 'PKR 0', and whole-rupee formatting is unchanged.
// The printed-statement formatter changes in the same PR (parent
// decision): the paper must match the screen, and plan410's mirror
// test pins the two formatters as mirrors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHistoryAmount } from '../full-history-list.js';
import { formatRunningBalanceAmount } from '../history-running-balance.js';
import { formatPrintedStatementAmount } from '../history-printed-statement.js';

const NOT_A_NUMBER = [null, undefined, Number.NaN, true, ''];

test('Sharafat 13: the on-screen history amount prints a dash for a figure that is not a number', () => {
  for (const value of NOT_A_NUMBER) {
    assert.equal(formatHistoryAmount(value), '—');
  }
});

test('Sharafat 13: the running-balance amount prints a dash for a figure that is not a number', () => {
  for (const value of NOT_A_NUMBER) {
    assert.equal(formatRunningBalanceAmount(value), '—');
  }
});

test('Sharafat 13: the printed-statement amount prints a dash for a figure that is not a number', () => {
  for (const value of NOT_A_NUMBER) {
    assert.equal(formatPrintedStatementAmount(value), '—');
  }
});

test('Sharafat 13: a real zero still prints PKR 0 and whole rupees are unchanged', () => {
  assert.equal(formatHistoryAmount(0), 'PKR 0');
  assert.equal(formatRunningBalanceAmount(0), 'PKR 0');
  assert.equal(formatPrintedStatementAmount(0), 'PKR 0');
  assert.equal(formatHistoryAmount(150000), 'PKR 1,500');
  assert.equal(formatRunningBalanceAmount(150000), 'PKR 1,500');
  assert.equal(formatPrintedStatementAmount(150000), 'PKR 1,500');
  assert.equal(formatHistoryAmount(150050), 'PKR 1,500.5');
  assert.equal(formatRunningBalanceAmount(150050), 'PKR 1,500.5');
  assert.equal(formatPrintedStatementAmount(150050), 'PKR 1,500.5');
});

test('Sharafat 13: the three formatters still agree on every input', () => {
  for (const value of [...NOT_A_NUMBER, 0, 150000, 150050, -50000, '2000']) {
    assert.equal(formatPrintedStatementAmount(value), formatHistoryAmount(value));
    assert.equal(formatRunningBalanceAmount(value), formatHistoryAmount(value));
  }
});
