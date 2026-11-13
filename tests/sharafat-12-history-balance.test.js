// Sharafat 12 — History running balance omits late fees, concessions,
// ticket/addon charges and baqaya — and drops zero-amount bills and
// credits. The history's final balance must equal the dues figure
// for a customer with a late fee + baqaya, a fully-concessed month
// must still appear, a credit of any recorded source must appear
// with its source shown, zero entries must stay visible, and any
// residual mismatch must be labelled by the wired matches-dues
// check, never silent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FULL_HISTORY_TYPES,
  FULL_HISTORY_TYPE_LABELS,
  fullHistoryEntries,
  fullHistoryEntryLineText,
  fullHistoryListHtml,
} from '../full-history-list.js';
import {
  HISTORY_RUNNING_BALANCE_TYPE_LABELS,
  historyRunningBalanceExpectedDelta,
  historyRunningBalanceFinal,
  historyRunningBalanceMatchesDues,
} from '../history-running-balance.js';
import { calculatePaymentAllocations, manualBaqayaEntriesWithRemaining } from '../core.js';
import { totalOutstandingFigures } from '../manual-baqaya.js';

function bill(overrides = {}) {
  return {
    id: 'BILL-1',
    month: '2026-11',
    dueDate: '2026-11-05',
    dueAmount: 3000,
    payments: [],
    ...overrides,
  };
}

function payment(overrides = {}) {
  return { id: 'PAY-1', amount: 1000, date: '2026-11-06', method: 'Cash', ...overrides };
}

function creditEntry(overrides = {}) {
  return {
    id: 'CR-1',
    customerId: 'CUST-1',
    source: 'overpayment',
    amountCents: 50000,
    date: '2026-11-06',
    note: '',
    ...overrides,
  };
}

function customer(overrides = {}) {
  return { id: 'CUST-1', customerNumber: 25, bills: [], manualBaqaya: [], ...overrides };
}

// The dues figure the profile shows: the engine's bill dues plus
// unpaid manual baqaya, from the same helpers the profile uses.
function duesFor(cust) {
  const allocations = calculatePaymentAllocations({ customers: [cust] });
  return totalOutstandingFigures(cust, allocations).totalCents;
}

function historyFor(cust, extra = {}) {
  return fullHistoryEntries({
    customerId: cust.id,
    bills: cust.bills ?? [],
    manualBaqayaEntries: manualBaqayaEntriesWithRemaining(cust),
    creditEntries: [],
    refundRecords: [],
    ...extra,
  });
}

const CUSTOMER = 'CUST-1';

// --- Acceptance: late fee + baqaya ---

test('Sharafat 12: bill + late fee + baqaya — the history final equals the dues figure', () => {
  const cust = customer({
    bills: [bill({ lateFee: 200, payments: [payment({ amount: 1000 })] })],
    manualBaqaya: [{ id: 'MBQ-101', amount: 1500, date: '2026-10-05', note: 'Old loan' }],
  });
  const entries = historyFor(cust);
  // Engine: bill 3000 + late fee 200, less payment 1000 = 2200;
  // baqaya 1500 unpaid — dues 3700.
  assert.equal(duesFor(cust), 370000);
  assert.equal(historyRunningBalanceFinal(entries), 370000);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}`),
    ['charge:150000', 'charge:300000', 'charge:20000', 'payment:100000'],
  );
  const baqaya = entries.find((entry) => entry.ref === 'MBQ-101');
  assert.equal(baqaya.note, 'Manual baqaya — Old loan');
  const lateFee = entries.find((entry) => entry.note === 'Late fee');
  assert.equal(lateFee.amountCents, 20000);
  const match = historyRunningBalanceMatchesDues(entries, duesFor(cust));
  assert.equal(match.matches, true);
  assert.ok(match.text.includes('matches current dues'));
});

test('Sharafat 12: a baqaya settlement stamp settles from the payment cash, never twice', () => {
  const cust = customer({
    bills: [bill({
      lateFee: 200,
      payments: [payment({ amount: 1000, manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 500 }] })],
    })],
    manualBaqaya: [{ id: 'MBQ-101', amount: 1500, date: '2026-10-05' }],
  });
  const entries = historyFor(cust);
  // Engine: the payment's bill portion is 1000 − 500 (baqaya) = 500,
  // so the bill owes 3200 − 500 = 2700 and the baqaya 1500 − 500 =
  // 1000 — dues 3700. History counts the full 1000 cash once:
  // +1500 +3000 +200 −1000 = 3700.
  assert.equal(duesFor(cust), 370000);
  assert.equal(historyRunningBalanceFinal(entries), 370000);
  assert.equal(historyRunningBalanceMatchesDues(entries, duesFor(cust)).matches, true);
});

test('Sharafat 12: an owner adjustment on a baqaya entry is its own adjustment line', () => {
  const cust = customer({
    manualBaqaya: [{
      id: 'MBQ-101',
      amount: 1500,
      date: '2026-10-05',
      adjustments: [{ amount: 200, date: '2026-10-20', note: 'Goodwill' }],
    }],
  });
  const entries = historyFor(cust);
  // Engine: remaining 1500 − 200 = 1300 — dues 1300.
  assert.equal(duesFor(cust), 130000);
  assert.equal(historyRunningBalanceFinal(entries), 130000);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}`),
    ['charge:150000', 'adjustment:20000'],
  );
  assert.equal(entries[1].note, 'Manual baqaya adjustment — Goodwill');
  assert.equal(historyRunningBalanceMatchesDues(entries, duesFor(cust)).matches, true);
});

// --- Concessions and the seven adjustment fields ---

test('Sharafat 12: a fully-concessed month appears in history, net zero', () => {
  const cust = customer({ bills: [bill({ concessionAmount: 3000 })] });
  const entries = historyFor(cust);
  assert.equal(duesFor(cust), 0);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}`),
    ['charge:300000', 'adjustment:300000'],
  );
  assert.equal(entries[1].note, 'Concession');
  assert.equal(historyRunningBalanceFinal(entries), 0);
  assert.equal(historyRunningBalanceMatchesDues(entries, duesFor(cust)).matches, true);
});

test('Sharafat 12: a concession larger than the bill clamps to what is left', () => {
  const cust = customer({ bills: [bill({ concessionAmount: 5000 })] });
  const entries = historyFor(cust);
  // The engine clamps the concession to the bill amount, so the
  // history must too — otherwise the final would go negative while
  // the dues stay at zero.
  assert.equal(duesFor(cust), 0);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}`),
    ['charge:300000', 'adjustment:300000'],
  );
  assert.equal(historyRunningBalanceFinal(entries), 0);
});

test('Sharafat 12: stacked adjustments clamp in the engine order', () => {
  const cust = customer({
    bills: [bill({ depositOffsetAmount: 2000, concessionAmount: 2000 })],
  });
  const entries = historyFor(cust);
  // Deposit first (2000 of 3000), then the concession clamps to the
  // 1000 that is left — the engine's order, or a stacked waiver
  // over-reduces the history against the engine.
  assert.equal(duesFor(cust), 0);
  const adjustments = entries.filter((entry) => entry.type === 'adjustment');
  assert.deepEqual(adjustments.map((entry) => entry.amountCents), [200000, 100000]);
  assert.deepEqual(adjustments.map((entry) => entry.note), ['Deposit offset', 'Concession']);
  assert.equal(historyRunningBalanceFinal(entries), 0);
});

test('Sharafat 12: a shifting fee is its own charge line', () => {
  const cust = customer({ bills: [bill({ shiftingFee: 150 })] });
  const entries = historyFor(cust);
  assert.equal(duesFor(cust), 315000);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}:${entry.note}`),
    ['charge:300000:', 'charge:15000:Shifting fee'],
  );
  assert.equal(historyRunningBalanceFinal(entries), 315000);
  assert.equal(historyRunningBalanceMatchesDues(entries, duesFor(cust)).matches, true);
});

// --- Credits of any source, zero entries ---

test('Sharafat 12: a credit with an unfamiliar source stays, with its source shown', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill()],
    creditEntries: [creditEntry({ source: 'gift', amountCents: 100000 })],
  });
  assert.equal(entries.length, 2);
  const credit = entries[1];
  assert.equal(credit.type, 'credit');
  assert.equal(credit.source, 'gift');
  assert.equal(credit.amountCents, 100000);
  // A non-adjustment credit moves nothing: its amount is already
  // inside its source payment.
  assert.equal(credit.runningBalanceCents, 300000);
  assert.ok(fullHistoryEntryLineText(credit).includes('Source: gift'));
  assert.ok(fullHistoryListHtml(entries).includes('Source: gift'));
});

test('Sharafat 12: a priced zero bill keeps a visible PKR 0 charge entry', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ dueAmount: 0 })],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'charge');
  assert.equal(entries[0].amountCents, 0);
  assert.equal(entries[0].runningBalanceCents, 0);
});

test('Sharafat 12: a zero-amount payment stays visible and moves nothing', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ amount: 0 })] })],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].type, 'payment');
  assert.equal(entries[1].amountCents, 0);
  assert.equal(entries[1].runningBalanceCents, 300000);
});

test('Sharafat 12: a zero-amount credit stays visible and moves nothing', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill()],
    creditEntries: [creditEntry({ source: 'other', amountCents: 0 })],
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[1].type, 'credit');
  assert.equal(entries[1].amountCents, 0);
  assert.equal(entries[1].runningBalanceCents, 300000);
});

test('Sharafat 12: an unpriced bill carries no charge but its payments still appear', () => {
  const cust = customer({
    bills: [
      bill({
        id: 'BILL-0',
        month: '2026-10',
        dueDate: '2026-10-05',
        dueAmount: null,
        payments: [payment({ id: 'PAY-0', amount: 2000, date: '2026-10-06' })],
      }),
      bill(),
    ],
  });
  const entries = historyFor(cust);
  // Engine: the October payment becomes pending credit (2000) and
  // settles November's bill — dues 1000. History shows the cash:
  // −2000 then +3000 = 1000.
  assert.equal(duesFor(cust), 100000);
  assert.deepEqual(
    entries.map((entry) => `${entry.type}:${entry.amountCents}`),
    ['payment:200000', 'charge:300000'],
  );
  assert.equal(historyRunningBalanceFinal(entries), 100000);
  assert.equal(historyRunningBalanceMatchesDues(entries, duesFor(cust)).matches, true);
});

// --- Ticket/add-on informational lines ---

test('Sharafat 12: ticket and add-on charges appear as informational lines that move nothing', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({
      payments: [payment({
        amount: 3500,
        ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
        addonCharges: [{ boostId: 'BST-101', amount: 300 }],
      })],
    })],
  });
  const infos = entries.filter((entry) => entry.type === 'info');
  assert.equal(infos.length, 2);
  assert.deepEqual(infos.map((entry) => entry.amountCents), [50000, 30000]);
  assert.deepEqual(
    infos.map((entry) => entry.note),
    ['Ticket charges — included in payment', 'Add-on charges — included in payment'],
  );
  // The info lines move nothing: the balance after each one is the
  // balance after the payment itself.
  assert.equal(entries[1].runningBalanceCents, -50000);
  assert.equal(entries[2].runningBalanceCents, -50000);
  assert.equal(entries[3].runningBalanceCents, -50000);
  assert.equal(FULL_HISTORY_TYPE_LABELS.info, 'Info');
  assert.equal(HISTORY_RUNNING_BALANCE_TYPE_LABELS.info, 'Info');
  assert.equal(historyRunningBalanceExpectedDelta(infos[0]), 0);
  assert.equal(historyRunningBalanceExpectedDelta(infos[1]), 0);
});

test('Sharafat 12: a ticket payment leaves a labelled residual mismatch, never a silent one', () => {
  // The ticket/add-on portions are inside the payment cash but never
  // settle a bill, so the history counts the full cash while the dues
  // count only the bill portion — the final sits below the dues by
  // exactly the ticket/add-on amount. The parent decision keeps these
  // lines informational (a charge entry would claim a charge the
  // history cannot date — the stamp rides the payment), so the wired
  // check must label the gap, never hide it.
  const cust = customer({
    bills: [bill({
      payments: [payment({
        amount: 3500,
        ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
        addonCharges: [{ boostId: 'BST-101', amount: 300 }],
      })],
    })],
  });
  const entries = historyFor(cust);
  assert.equal(duesFor(cust), 30000);
  assert.equal(historyRunningBalanceFinal(entries), -50000);
  const match = historyRunningBalanceMatchesDues(entries, duesFor(cust));
  assert.equal(match.matches, false);
  assert.ok(match.text.includes('does not match'));
  assert.ok(match.text.includes('PKR 300'));
});

test('Sharafat 12: a voided payment carries no informational lines', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({
      payments: [payment({
        voided: true,
        amount: 3500,
        ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
      })],
    })],
  });
  assert.equal(entries.filter((entry) => entry.type === 'info').length, 0);
  assert.equal(entries[1].voided, true);
  assert.equal(entries[1].runningBalanceCents, 300000);
});

// --- The wired matches-dues check ---

test('Sharafat 12: an overpaid final clamps to zero and reads as a match, never a false mismatch', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ amount: 3500 })] })],
  });
  // History final −500 (real credit); the engine clamps each bill's
  // due at zero, so the dues are 0 — the check compares the clamped
  // final, the same clamp as the engine.
  assert.equal(historyRunningBalanceFinal(entries), -50000);
  const match = historyRunningBalanceMatchesDues(entries, 0);
  assert.equal(match.finalCents, -50000);
  assert.equal(match.matches, true);
  assert.ok(match.text.includes('matches current dues'));
  assert.ok(match.text.includes('overpaid'));
});

test('Sharafat 12: a final that does not match the dues still says so plainly', () => {
  const entries = fullHistoryEntries({
    customerId: CUSTOMER,
    bills: [bill({ payments: [payment({ amount: 1000 })] })],
  });
  const match = historyRunningBalanceMatchesDues(entries, 230000);
  assert.equal(match.matches, false);
  assert.ok(match.text.includes('does not match'));
  assert.ok(match.text.includes('PKR 2,000'));
  assert.ok(match.text.includes('PKR 2,300'));
});

test('Sharafat 12: the profile wires the matches-dues check and the baqaya entries', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes('historyRunningBalanceMatchesDues'));
  assert.ok(appSrc.includes('manualBaqayaEntriesWithRemaining(customer)'));
  assert.ok(appSrc.includes('totalOutstandingFigures(customer, calculatePaymentAllocations({ customers: [customer] }))'));
  assert.ok(appSrc.includes('duesCheck.text'));
});

test('Sharafat 12: the new info type is a real history type, covered by labels', () => {
  assert.ok(FULL_HISTORY_TYPES.includes('info'));
  assert.equal(FULL_HISTORY_TYPE_LABELS.info, 'Info');
  for (const type of FULL_HISTORY_TYPES) {
    assert.ok(FULL_HISTORY_TYPE_LABELS[type], `missing label for ${type}`);
  }
});

test('Sharafat 12: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
