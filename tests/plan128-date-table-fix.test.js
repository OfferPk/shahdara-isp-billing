import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validBalanceConfirmationDate,
  normalizeBalanceConfirmation,
} from '../balance-confirmations.js';

// Plan 130 carried-forward fix: Plan 128's days-in-month table had
// 13 entries, shifting every month from August onward by one, so
// real 31st dates in August, October, and December were wrongly
// rejected (and Sep 31 / Nov 31 wrongly accepted). These tests pin
// the corrected 12-entry calendar table.

test('31st dates in 31-day months are valid, including Aug 31, Oct 31, Dec 31', () => {
  for (const date of ['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-08-31', '2026-10-31', '2026-12-31']) {
    assert.equal(validBalanceConfirmationDate(date), date, `${date} must be valid`);
  }
});

test('31st dates in 30-day months are still refused', () => {
  for (const date of ['2026-04-31', '2026-06-31', '2026-09-31', '2026-11-31']) {
    assert.equal(validBalanceConfirmationDate(date), null, `${date} must be refused`);
  }
});

test('February still follows the leap-year rule', () => {
  assert.equal(validBalanceConfirmationDate('2024-02-29'), '2024-02-29');
  assert.equal(validBalanceConfirmationDate('2026-02-29'), null);
  assert.equal(validBalanceConfirmationDate('2026-02-30'), null);
});

test('a full confirmation record dated 2026-08-31 normalizes end to end', () => {
  const record = normalizeBalanceConfirmation({
    id: 'BC-31',
    customer: 'CUST-1',
    customerName: 'Ahmed',
    balance: 1500,
    date: '2026-08-31',
    method: 'in-person',
    recordedBy: 'Saad',
    note: 'Agreed at shop',
  });
  assert.ok(record);
  assert.equal(record.date, '2026-08-31');
  assert.equal(record.balanceCents, 150000);
});
