// Sharafat 69 — a negative promise amount is refused, never silently
// clamped to Rs 0.
//
// setCustomerWaada used to compute Math.max(0, Number(promiseAmount)),
// so a typed -500 became a stored Rs 0 promise — meaningless, and it
// snoozed the customer out of collection (getWaadaTier reads only the
// promise date). The setter now throws on any finite amount <= 0,
// exactly like the invalid-date path, and the chip / undo paths
// normalize a STORED legacy 0 to amount-less instead of throwing on a
// date-only change. Tests on synthetic data only: no real customer
// names, no phone numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  setCustomerWaada,
  remainderWaadaPreviousOf,
  computeRemainderWaada,
  stampRemainderWaada
} from '../waada-queue.js';
import { setLiveWaada } from '../waada-write.js';
import { applyFieldModeWaadaChip } from '../field-mode.js';

const DATE = '2026-11-20';
const customer = (extra = {}) => ({ id: 'c1', customerNumber: 101, name: 'Synthetic Tester', bills: [], ...extra });

// --- The setter: non-positive amounts throw ---

test('setCustomerWaada throws on a negative amount instead of clamping to Rs 0', () => {
  assert.throws(
    () => setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: -500 }),
    /Promise amount must be more than Rs 0/
  );
  assert.throws(
    () => setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: '-500' }),
    /Promise amount must be more than Rs 0/
  );
});

test('setCustomerWaada throws on exactly Rs 0', () => {
  assert.throws(
    () => setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 0 }),
    /Promise amount must be more than Rs 0/
  );
  assert.throws(
    () => setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 0.0 }),
    /Promise amount must be more than Rs 0/
  );
});

test('setCustomerWaada still keeps null / empty / non-numeric amounts amount-less', () => {
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: null }).promiseAmount, null);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: undefined }).promiseAmount, null);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: '' }).promiseAmount, null);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 'abc' }).promiseAmount, null);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE }).promiseAmount, null);
});

test('setCustomerWaada still stores positive and fractional-positive amounts', () => {
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 3000 }).promiseAmount, 3000);
  // D3(a): refusal is on the RAW amount, before whole-rupee rounding —
  // Rs 0.40 stays a live promise (its mirror still refuses, rounded 0).
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 0.4 }).promiseAmount, 0.4);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: 1500.5 }).promiseAmount, 1500.5);
  assert.equal(setCustomerWaada(customer(), { promiseDate: DATE, promiseAmount: '2000' }).promiseAmount, 2000);
});

test('setCustomerWaada throws on the amount before writing anything, and the input is untouched', () => {
  const original = customer();
  assert.throws(() => setCustomerWaada(original, { promiseDate: DATE, promiseAmount: -1 }));
  assert.equal('promiseDate' in original, false);
  assert.equal('promiseAmount' in original, false);
});

// --- The writer: the throw propagates through setLiveWaada ---

test('setLiveWaada with 0 or a negative amount throws and the records list is untouched', () => {
  const before = [{ id: 'WD-1', customer: 'c1', promisedDate: DATE, amountPromised: 2000, note: '', status: 'pending', closedDate: '' }];
  assert.throws(() => setLiveWaada(customer(), before, { promiseDate: DATE, promiseAmount: 0, promiseNote: '' }), /more than Rs 0/);
  assert.throws(() => setLiveWaada(customer(), before, { promiseDate: DATE, promiseAmount: -500, promiseNote: '' }), /more than Rs 0/);
  assert.equal(before.length, 1);
  assert.equal(before[0].amountPromised, 2000);
});

test('setLiveWaada with a positive amount still writes the mirror as before', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: DATE, promiseAmount: 3000, promiseNote: '' });
  assert.equal(written.mirrorStatus, 'written');
  assert.equal(written.customer.promiseAmount, 3000);
  assert.equal(written.records[0].amountPromised, 3000);
});

// --- The chip paths: a stored legacy 0 heals to amount-less ---

test('applyFieldModeWaadaChip re-stamps a stored Rs 0 as amount-less instead of throwing', () => {
  // Legacy data: a customer whose stored promise amount is Rs 0. A
  // date-only chip change must heal it, not refuse the change.
  const storedZero = customer({ promiseDate: DATE, promiseAmount: 0, promiseNote: 'Old promise' });
  const healed = applyFieldModeWaadaChip(storedZero, 'plus2', '2026-11-16');
  assert.equal(healed.promiseDate, '2026-11-18');
  assert.equal(healed.promiseAmount, null);
  assert.equal(healed.promiseNote, 'Old promise');
  // ... and the healed, amount-less promise can be written through the
  // single writer, mirroring as a null-amount record.
  const written = setLiveWaada(healed, [], { promiseDate: healed.promiseDate, promiseAmount: healed.promiseAmount, promiseNote: healed.promiseNote });
  assert.equal(written.mirrorStatus, 'written');
  assert.equal(written.records[0].amountPromised, null);
});

test('applyFieldModeWaadaChip re-stamps a stored negative amount as amount-less too', () => {
  const storedNegative = customer({ promiseDate: DATE, promiseAmount: -250, promiseNote: '' });
  const healed = applyFieldModeWaadaChip(storedNegative, 'tenth', '2026-11-16');
  assert.equal(healed.promiseAmount, null);
});

test('applyFieldModeWaadaChip still keeps a stored positive amount on re-stamp', () => {
  const stored = customer({ promiseDate: DATE, promiseAmount: 3000, promiseNote: '' });
  const restamped = applyFieldModeWaadaChip(stored, 'plus2', '2026-11-16');
  assert.equal(restamped.promiseAmount, 3000);
  assert.equal(restamped.promiseDate, '2026-11-18');
});

// --- The undo reader: a stamped legacy 0 restores as amount-less ---

test('remainderWaadaPreviousOf normalizes a stamped Rs 0 previous waada to amount-less', () => {
  const payment = {
    remainderWaada: {
      promiseDate: '2026-11-20',
      promiseAmount: 2000,
      previousWaada: { promiseDate: '2026-11-10', promiseAmount: 0, promiseNote: 'Old promise' }
    }
  };
  assert.deepEqual(remainderWaadaPreviousOf(payment), {
    promiseDate: '2026-11-10',
    promiseAmount: null,
    promiseNote: 'Old promise'
  });
  // ... so the undo can restore it through the setter without throwing.
  const restored = setCustomerWaada(customer(), remainderWaadaPreviousOf(payment));
  assert.equal(restored.promiseAmount, null);
  assert.equal(restored.promiseDate, '2026-11-10');
});

test('remainderWaadaPreviousOf normalizes a stamped negative previous waada to amount-less', () => {
  const payment = {
    remainderWaada: {
      promiseDate: '2026-11-20',
      promiseAmount: 2000,
      previousWaada: { promiseDate: '2026-11-10', promiseAmount: -100, promiseNote: '' }
    }
  };
  assert.equal(remainderWaadaPreviousOf(payment).promiseAmount, null);
});

test('remainderWaadaPreviousOf still passes a stamped positive previous waada through', () => {
  const payment = {
    remainderWaada: {
      promiseDate: '2026-11-20',
      promiseAmount: 2000,
      previousWaada: { promiseDate: '2026-11-10', promiseAmount: 3000, promiseNote: 'Salary day' }
    }
  };
  assert.deepEqual(remainderWaadaPreviousOf(payment), {
    promiseDate: '2026-11-10',
    promiseAmount: 3000,
    promiseNote: 'Salary day'
  });
});

// --- The remainder writers: a 0 remainder still cannot reach the setter ---

test('the remainder writers still guard a 0 remainder before the setter (D4)', () => {
  assert.equal(computeRemainderWaada(3000, 3000), null);
  assert.equal(computeRemainderWaada(3000, 0), null);
  const withBill = customer({ bills: [{ month: '2026-10', payments: [{ id: 'pay-1', amount: 1000 }] }] });
  assert.equal(stampRemainderWaada(withBill, '2026-10', 'pay-1', { promiseDate: DATE, promiseAmount: 0 }), null);
  assert.equal(stampRemainderWaada(withBill, '2026-10', 'pay-1', { promiseDate: DATE, promiseAmount: -50 }), null);
});
