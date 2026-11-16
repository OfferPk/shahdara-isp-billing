// Sharafat 64 — one write path for live Waada promises.
//
// Setting a live waada (chip dialog, remainder waada, banner) records
// the same promise in the wada-record store, and marking it kept in the
// banner clears the live promise — the dashboard/history and the queues
// finally agree. Integration-style tests on synthetic data only: no
// real customer names, no phone numbers anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';

import { setLiveWaada, clearLiveWaadaIfMatched } from '../waada-write.js';
import {
  setCustomerWaada,
  getWaadaTier,
  WAADA_TIERS,
  REMAINDER_WAADA_NOTE
} from '../waada-queue.js';
import {
  markWadaRecordKept,
  markWadaRecordBroken,
  wadaBannerHtml,
  activeWadaRecordsForCustomer
} from '../wada-record.js';
import { wadaDashboardTotals } from '../wada-dashboard.js';
import { executeQuickCollection, getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { collectFieldModeAdvance } from '../field-mode.js';
import { saveBillMonth } from '../core.js';

// Fixed "today": 2026-10-20 PKT. The bill is priced for 2026-10, so the
// collection math stays stable (same fixture shape as the SISP-126
// remainder-waada tests).
const REF = new Date('2026-10-20T05:00:00.000Z');
const CHIP_DATE = '2026-10-27'; // the +7 chip for a 2026-10-20 payment

const customer = (extra = {}) => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Tester',
  bills: [],
  ...extra
});

function stateWithDue(due = 3000, customerExtra = {}) {
  let state = { customers: [customer(customerExtra)] };
  state = saveBillMonth(state, 'c1', { month: '2026-10', dueAmount: due, dueDate: '2026-10-05', status: 'pending' }, REF);
  return state;
}

const customerOf = (state) => state.customers.find((c) => c.id === 'c1');

// --- The writer: one live promise, one mirrored record ---------------------

test('chip-set waada appears in the dashboard and the banner (acceptance, first half)', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  assert.equal(written.mirrorStatus, 'written');
  assert.equal(written.mirrorWritten, true);
  // The live promise is set, exactly as the chip dialog sets it.
  assert.equal(written.customer.promiseDate, CHIP_DATE);
  assert.equal(written.customer.promiseAmount, 2000);
  // The dashboard — which reads records only — now counts it.
  const totals = wadaDashboardTotals(written.records);
  assert.deepEqual(
    { customers: totals.customers, total: totals.total, pending: totals.pending },
    { customers: 1, total: 1, pending: 1 }
  );
  // The banner shows the still-open wada for this customer.
  const banner = wadaBannerHtml(written.records, '2026-10-20');
  assert.ok(banner.includes('Poora hua'));
  assert.ok(banner.includes(`data-wada-kept="${written.records[0].id}"`));
});

test('banner-set waada becomes the live promise and the queue tier (acceptance, second direction)', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  assert.equal(getWaadaTier(written.customer, 2000, '2026-10-21'), WAADA_TIERS.PROMISED);
});

test('marking kept clears the live promise when the record matches it (acceptance, second half)', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const record = written.records[0];
  // The banner kept-handler flow: close the record, then clear the
  // live promise only when it matches the closed record.
  const closed = markWadaRecordKept(written.records, record.id, '2026-10-21');
  assert.equal(closed.find((r) => r.id === record.id).status, 'kept');
  const cleared = clearLiveWaadaIfMatched(written.customer, record);
  assert.equal(cleared.promiseDate, undefined);
  assert.equal(cleared.promiseAmount, undefined);
});

test('marking kept leaves a NEWER live promise alone', () => {
  const first = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const record = first.records[0];
  // The operator re-promises before closing the old record.
  const newer = setCustomerWaada(first.customer, { promiseDate: '2026-11-05', promiseAmount: 1500, promiseNote: '' });
  const closed = markWadaRecordKept(first.records, record.id, '2026-10-21');
  assert.equal(closed.find((r) => r.id === record.id).status, 'kept');
  const kept = clearLiveWaadaIfMatched(newer, record);
  assert.equal(kept.promiseDate, '2026-11-05');
  assert.equal(kept.promiseAmount, 1500);
});

test('matched clear refuses a date mismatch, an amount mismatch and a customer mismatch', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const record = written.records[0];
  const otherDate = { ...record, promisedDate: '2026-10-28' };
  assert.equal(clearLiveWaadaIfMatched(written.customer, otherDate).promiseDate, CHIP_DATE);
  const otherAmount = { ...record, amountPromised: 1500 };
  assert.equal(clearLiveWaadaIfMatched(written.customer, otherAmount).promiseDate, CHIP_DATE);
  const otherCustomer = { ...record, customer: 'c2' };
  assert.equal(clearLiveWaadaIfMatched(written.customer, otherCustomer).promiseDate, CHIP_DATE);
  // No live promise at all: a no-op, not a crash.
  assert.equal(clearLiveWaadaIfMatched(customer(), record).promiseDate, undefined);
});

test('marking broken leaves the live promise alone — the broken tier IS the follow-up signal', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: '2026-10-15', promiseAmount: 2000, promiseNote: '' });
  const record = written.records[0];
  const closed = markWadaRecordBroken(written.records, record.id, '2026-10-20');
  assert.equal(closed.find((r) => r.id === record.id).status, 'broken');
  // The broken handler never calls the matched clear: the promise
  // stays, so the customer stays in the broken queue.
  assert.equal(getWaadaTier(written.customer, 2000, '2026-10-20'), WAADA_TIERS.BROKEN);
  assert.equal(written.customer.promiseDate, '2026-10-15');
});

test('setting the same promise twice writes one pending record, never a duplicate', () => {
  const first = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const second = setLiveWaada(first.customer, first.records, { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  assert.equal(second.mirrorStatus, 'duplicate');
  assert.equal(second.mirrorWritten, false);
  assert.equal(activeWadaRecordsForCustomer(second.records, 'c1').length, 1);
  // The live promise was still (re-)set.
  assert.equal(second.customer.promiseDate, CHIP_DATE);
});

test('re-setting with a different amount is a different promise — a second record', () => {
  const first = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const second = setLiveWaada(first.customer, first.records, { promiseDate: CHIP_DATE, promiseAmount: 1500, promiseNote: '' });
  assert.equal(second.mirrorStatus, 'written');
  assert.equal(activeWadaRecordsForCustomer(second.records, 'c1').length, 2);
});

test('a non-whole amount is rounded for the mirror, never silently dropped (R3)', () => {
  // Remainder amounts are rounded to cents, not whole rupees — the
  // mirror must still happen, rounded, and the matched clear must
  // still match through the same rounding.
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 1500.5, promiseNote: '' });
  assert.equal(written.mirrorStatus, 'written');
  assert.equal(written.records[0].amountPromised, 1501);
  assert.equal(written.customer.promiseAmount, 1500.5);
  const cleared = clearLiveWaadaIfMatched(written.customer, written.records[0]);
  assert.equal(cleared.promiseDate, undefined);
});

test('a null amount mirrors as a null-amount record, and null matches null on kept', () => {
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: null, promiseNote: '' });
  assert.equal(written.mirrorStatus, 'written');
  assert.equal(written.records[0].amountPromised, null);
  const cleared = clearLiveWaadaIfMatched(written.customer, written.records[0]);
  assert.equal(cleared.promiseDate, undefined);
});

test('a zero amount is refused outright by the setter (Sharafat 69) — the live promise is never set', () => {
  // Sharafat 69 rewrote this test: the old contract was "a zero amount
  // refuses the mirror (surfaced) while the live promise is still set" —
  // setLiveWaada carried Rs 0 on the customer while the mirror refused
  // it, so a Rs 0 promise snoozed the customer out of collection. The
  // setter now throws on any non-positive amount, exactly like the
  // invalid-date path, so nothing is written at all.
  const before = [{ id: 'WD-1', customer: 'c1', promisedDate: CHIP_DATE, amountPromised: 2000, note: '', status: 'pending', closedDate: '' }];
  assert.throws(() => setLiveWaada(customer(), before, { promiseDate: CHIP_DATE, promiseAmount: 0, promiseNote: '' }), /more than Rs 0/);
  assert.equal(before.length, 1);
  assert.throws(() => setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: -500, promiseNote: '' }), /more than Rs 0/);
});

test('an invalid date throws and the records list is untouched', () => {
  const before = [{ id: 'WD-1', customer: 'c1', promisedDate: CHIP_DATE, amountPromised: 2000, note: '', status: 'pending', closedDate: '' }];
  assert.throws(() => setLiveWaada(customer(), before, { promiseDate: 'not-a-date', promiseAmount: 2000 }));
  assert.equal(before.length, 1);
});

test('the writer never mutates its inputs', () => {
  const input = customer();
  const records = [];
  const written = setLiveWaada(input, records, { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  assert.equal(input.promiseDate, undefined);
  assert.equal(records.length, 0);
  assert.notEqual(written.customer, input);
  assert.notEqual(written.records, records);
});

test('a void/undo restore writes NO record — restoring is not a new promise (R5)', () => {
  // The void path restores the stamped promise through setCustomerWaada
  // directly, never through this writer: the history must not gain a
  // second record for a promise that already has one.
  const written = setLiveWaada(customer(), [], { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  const before = JSON.stringify(written.records);
  const restored = setCustomerWaada(customer(), { promiseDate: CHIP_DATE, promiseAmount: 2000, promiseNote: '' });
  // The restore touched the live promise only — the record list is
  // byte-for-byte the same list the writer returned.
  assert.equal(JSON.stringify(written.records), before);
  assert.equal(activeWadaRecordsForCustomer(written.records, 'c1').length, 1);
  assert.equal(restored.promiseDate, CHIP_DATE);
});

// --- The remainder path: the mirror travels back for the caller to save --

function collectPartial(extra = {}) {
  const state = stateWithDue(3000);
  const { nextState, receipt, wadaRecords, wadaMirrorStatus } = executeQuickCollection(state, {
    customerId: 'c1',
    month: '2026-10',
    amount: 1000,
    date: '2026-10-20',
    method: 'Cash',
    ...extra,
    repriceBill: false
  }, REF);
  return { state, nextState, receipt, wadaRecords, wadaMirrorStatus };
}

test('Quick Collect remainder waada is mirrored into the returned wada-record list (R6)', () => {
  const { nextState, receipt, wadaRecords, wadaMirrorStatus } = collectPartial({ remainderWaadaDate: CHIP_DATE, wadaRecords: [] });
  assert.equal(wadaMirrorStatus, 'written');
  assert.equal(wadaRecords.length, 1);
  assert.equal(wadaRecords[0].customer, 'c1');
  assert.equal(wadaRecords[0].promisedDate, CHIP_DATE);
  assert.equal(wadaRecords[0].amountPromised, 2000);
  assert.equal(wadaRecords[0].note, REMAINDER_WAADA_NOTE);
  assert.equal(wadaRecords[0].status, 'pending');
  // The live promise and the receipt are exactly as before.
  assert.equal(customerOf(nextState).promiseDate, CHIP_DATE);
  assert.equal(customerOf(nextState).promiseAmount, 2000);
  assert.deepEqual(receipt.remainderWaada, { promiseDate: CHIP_DATE, promiseAmount: 2000 });
});

test('without a wada-record list the recorder returns no mirror — and still sets the live promise', () => {
  const { nextState, wadaRecords, wadaMirrorStatus } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  assert.equal(wadaRecords, null);
  assert.equal(wadaMirrorStatus, null);
  assert.equal(customerOf(nextState).promiseDate, CHIP_DATE);
});

test('Field Mode advance remainder waada is mirrored through the same writer', () => {
  const state = stateWithDue(3000);
  const entry = getPendingCollectionCustomers(state, '', 'all').find((e) => e.id === 'c1');
  const { nextState, receipt, wadaRecords, wadaMirrorStatus } = collectFieldModeAdvance(state, entry, {
    amount: 1000, method: 'Cash', remainderWaadaDate: CHIP_DATE, wadaRecords: []
  }, REF);
  assert.equal(wadaMirrorStatus, 'written');
  assert.equal(wadaRecords.length, 1);
  assert.equal(wadaRecords[0].amountPromised, 2000);
  assert.equal(customerOf(nextState).promiseDate, CHIP_DATE);
  assert.deepEqual(receipt.remainderWaada, { promiseDate: CHIP_DATE, promiseAmount: 2000 });

  const noChip = collectFieldModeAdvance(state, entry, { amount: 1000, method: 'Cash', wadaRecords: [] }, REF);
  assert.equal(noChip.wadaMirrorStatus, null);
  assert.equal(noChip.wadaRecords, null);
  assert.equal(customerOf(noChip.nextState).promiseDate, undefined);
});
