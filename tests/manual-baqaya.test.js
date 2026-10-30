// Owner feature (2026-10-29, voice note): Manual Loan / Baqaya on the
// customer profile. The owner's words: a customer paid this month in
// full but last month's money is still owed off-book — the owner writes
// it by hand (amount + date + note), it shows WITH THE NAME everywhere
// dues show, collections settle it, and a void brings it back.
//
// Design pinned here: entries ride the customer record
// (`customer.manualBaqaya`); settlements are stamped on the paying
// receipt (`payment.manualBaqayaSettlements`) inside
// executeQuickCollection, AFTER all bill dues, FIFO by entry date,
// part-settling the last entry reached. Remaining amounts are always
// DERIVED (entry amount − non-voided stamps), so a SISP-34 void
// restores the baqaya exactly and no figure can drift. The allocation
// engine's bill math is untouched — core only keeps the stamped
// portion out of bill allocation, exactly like SISP-43 ticket charges.
//
// The five owner pins:
//  1. Bill 3,000 paid in full + hand-written baqaya 1,500 (last month)
//     → profile + Customers card show 1,500 next to the name; engine
//     bill arrears unchanged (no double count).
//  2. Next payment 1,500 → baqaya settles to 0, receipt consistent.
//  3. Part payment 500 → remaining exactly 1,000.
//  4. Voiding the settling payment restores the pre-payment remainder.
//  5. FREE customer: adding an entry is refused.
//
// Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addManualBaqayaEntry,
  addPayment,
  calculatePaymentAllocations,
  correctPayment,
  createJsonBackup,
  manualBaqayaEntriesWithRemaining,
  manualBaqayaOutstanding,
  persistState,
  planManualBaqayaSettlement,
  previewJsonBackupMerge,
  readState,
  removeManualBaqayaEntry,
  saveBillMonth,
  updateManualBaqayaEntry,
  validatePayment
} from '../core.js';
import { arrearsAndAdvance } from '../billing-cycle.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  getCustomerPaymentDefaults,
  getPendingCollectionCustomers,
  renderQuickCollectReceiptCardHtml
} from '../nav-quick-collect.js';
import { fieldModeCustomerStatus } from '../field-mode.js';
import {
  manualBaqayaCardBadgeMarkup,
  manualBaqayaSectionMarkup,
  manualBaqayaStatMarkup,
  totalOutstandingFigures
} from '../manual-baqaya.js';
import { buildPaymentReceipt } from '../receipt.js';
import { voidPayment } from '../payment-void-audit.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

function baseCustomer(overrides = {}) {
  return {
    id: 'cust-1',
    customerNumber: 101,
    name: 'Synthetic Subscriber',
    phone: '03001234567',
    area: 'Test Area',
    archived: false,
    isFreeConnection: false,
    monthlyPriceSchedule: [],
    relocationLog: [],
    pauseSkippedMonths: [],
    bills: [],
    incidents: [],
    installmentPlans: [],
    ...overrides
  };
}

/** Customer whose October bill (3,000) is already paid in full. */
function stateWithPaidBill() {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-05', amount: 3000, method: 'Cash' }, REF);
  return state;
}

function withBaqaya(state, amount = 1500, date = '2026-09-10', note = 'Last month balance') {
  return addManualBaqayaEntry(state, 'cust-1', { amount, date, note }, REF);
}

function collect(state, amount, month = MONTH) {
  return executeQuickCollection(state, {
    customerId: 'cust-1', month, amount, date: '2026-10-15', method: 'Cash'
  }, REF);
}

test('pin 1: paid bill + hand-written baqaya 1,500 shows with the name; engine arrears unchanged', () => {
  const state = withBaqaya(stateWithPaidBill());
  const customer = state.customers[0];

  assert.equal(manualBaqayaOutstanding(customer), 1500);
  // Engine bill figures are exactly as before the entry existed.
  const allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  assert.equal(arrearsAndAdvance(customer, '2026-11').previousArrears, 0);

  // The shared helper joins the two without double counting.
  const figures = totalOutstandingFigures(customer, allocations);
  assert.equal(figures.billDues, 0);
  assert.equal(figures.manualBaqaya, 1500);
  assert.equal(figures.total, 1500);

  // Customers card badge + profile stat + profile section all carry it.
  assert.match(manualBaqayaCardBadgeMarkup(customer), /PKR 1,500/);
  assert.match(manualBaqayaStatMarkup(customer), /PKR 1,500/);
  const section = manualBaqayaSectionMarkup(customer, { archived: false });
  assert.match(section, /PKR 1,500/);
  assert.match(section, /MBQ-101/);
  assert.match(section, /data-add-baqaya/);
  assert.match(section, /data-edit-baqaya="MBQ-101"/);
  assert.match(section, /data-remove-baqaya="MBQ-101"/);
});

test('pin 1b: real bill arrears and manual baqaya add up once, never twice', () => {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: '2026-09', dueAmount: 3000, status: 'pending' }, REF);
  state = withBaqaya(state);
  const customer = state.customers[0];
  const figures = totalOutstandingFigures(customer);
  assert.equal(figures.billDues, 3000);
  assert.equal(figures.manualBaqaya, 1500);
  assert.equal(figures.total, 4500);
  // Collecting the whole 4,500 settles the bill AND stamps 1,500 baqaya.
  const { nextState, receipt } = collect(state, 4500, '2026-09');
  assert.equal(receipt.manualBaqayaSettledTotal, 1500);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 0);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('cust-1', '2026-09').balanceDueCents, 0);
});

test('pin 2: a 1,500 collection settles the baqaya to zero and the receipt agrees', () => {
  const state = withBaqaya(stateWithPaidBill());
  const { nextState, receipt } = collect(state, 1500);

  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 0);
  assert.deepEqual(receipt.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);
  assert.equal(receipt.manualBaqayaSettledTotal, 1500);
  assert.equal(receipt.manualBaqayaPending, 0);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(receipt.isSettled, true);

  // The stamp rides the payment itself.
  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);

  // The full receipt chain sees the settled line.
  const bill = nextState.customers[0].bills.find(b => b.month === MONTH);
  const built = buildPaymentReceipt(nextState.customers[0], bill, payment);
  assert.equal(built.manualBaqayaTotal, 1500);
  assert.deepEqual(built.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);
  assert.match(formatQuickCollectWhatsAppReceipt(receipt).text, /MBQ-101/);
  assert.match(renderQuickCollectReceiptCardHtml(receipt), /MBQ-101/);
});

test('pin 3: a part payment of 500 leaves exactly 1,000 of baqaya', () => {
  const state = withBaqaya(stateWithPaidBill());
  const { nextState, receipt } = collect(state, 500);
  assert.equal(receipt.manualBaqayaSettledTotal, 500);
  assert.equal(receipt.manualBaqayaPending, 1000);
  assert.equal(receipt.isSettled, false);
  const [entry] = manualBaqayaEntriesWithRemaining(nextState.customers[0]);
  assert.equal(entry.settledCents, 50000);
  assert.equal(entry.remainingCents, 100000);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 1000);
});

test('pin 4: voiding the settling payment restores the baqaya exactly', () => {
  const state = withBaqaya(stateWithPaidBill());
  const { nextState } = collect(state, 500);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 1000);
  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Wrong amount recorded' });
  assert.equal(manualBaqayaOutstanding(voidedState.customers[0]), 1500);
  const [entry] = manualBaqayaEntriesWithRemaining(voidedState.customers[0]);
  assert.equal(entry.settledCents, 0);
  assert.equal(entry.remainingCents, 150000);
});

test('pin 5: a FREE connection refuses a manual baqaya entry', () => {
  const state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer({ isFreeConnection: true })] };
  assert.throws(
    () => addManualBaqayaEntry(state, 'cust-1', { amount: 1500, date: '2026-09-10' }, REF),
    /Free connections never owe/
  );
});

test('archived customers refuse new entries but keep existing ones readable', () => {
  let state = withBaqaya(stateWithPaidBill());
  state = { ...state, customers: state.customers.map(c => ({ ...c, archived: true, archivedAt: '2026-10-14T00:00:00.000Z' })) };
  assert.throws(
    () => addManualBaqayaEntry(state, 'cust-1', { amount: 100, date: '2026-09-01' }, REF),
    /Archived customers cannot take a new manual baqaya entry/
  );
  const [entry] = manualBaqayaEntriesWithRemaining(state.customers[0]);
  assert.equal(entry.remainingCents, 150000);
  const section = manualBaqayaSectionMarkup(state.customers[0], { archived: true });
  assert.match(section, /PKR 1,500/);
  assert.doesNotMatch(section, /data-add-baqaya/);
  assert.doesNotMatch(section, /data-edit-baqaya/);
});

test('audit rule: entries edit/remove only while fully unsettled; a void unlocks them', () => {
  let state = withBaqaya(stateWithPaidBill());
  state = updateManualBaqayaEntry(state, 'cust-1', 'MBQ-101', { amount: 1800, date: '2026-09-12', note: 'Corrected' }, REF);
  assert.equal(state.customers[0].manualBaqaya[0].amount, 1800);

  const { nextState } = collect(state, 500);
  assert.throws(
    () => updateManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101', { amount: 100, date: '2026-09-12' }, REF),
    /Void the payment first/
  );
  assert.throws(() => removeManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101'), /Void the payment first/);

  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Recorded twice' });
  const afterRemove = removeManualBaqayaEntry(voidedState, 'cust-1', 'MBQ-101');
  assert.equal(afterRemove.customers[0].manualBaqaya.length, 0);
  assert.equal(manualBaqayaOutstanding(afterRemove.customers[0]), 0);
});

test('FIFO: collections settle the oldest entry first and part-settle the next', () => {
  let state = stateWithPaidBill();
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 1000, date: '2026-09-05', note: 'September' }, REF);
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 800, date: '2026-08-05', note: 'August' }, REF);
  const plan = planManualBaqayaSettlement(state.customers[0], 100000);
  assert.deepEqual(plan.lines, [
    { entryId: 'MBQ-102', amount: 800 },
    { entryId: 'MBQ-101', amount: 200 }
  ]);
  assert.equal(plan.totalCents, 100000);
  const { nextState } = collect(state, 1000);
  const entries = manualBaqayaEntriesWithRemaining(nextState.customers[0]);
  assert.equal(entries.find(e => e.id === 'MBQ-102').remainingCents, 0);
  assert.equal(entries.find(e => e.id === 'MBQ-101').remainingCents, 80000);
});

test('Quick Collect defaults, pending list and Field Mode all carry the baqaya', () => {
  const state = withBaqaya(stateWithPaidBill());
  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF);
  assert.equal(defaults.manualBaqayaPending, 1500);
  assert.equal(defaults.payableTotal, 1500);
  assert.equal(defaults.suggestedAmount, 1500);

  const [pending] = getPendingCollectionCustomers(state, '', 'all-dues', REF);
  assert.equal(pending.totalDues, 1500);
  assert.equal(pending.billDues, 0);
  assert.equal(pending.manualBaqayaDue, 1500);

  const status = fieldModeCustomerStatus(state, 'cust-1');
  assert.equal(status.key, 'due');
  assert.equal(status.totalDues, 1500);
});

test('advance-tagged collections never settle baqaya', () => {
  const state = withBaqaya(stateWithPaidBill());
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 1500, date: '2026-10-15', method: 'Cash', kind: 'advance'
  }, REF);
  assert.deepEqual(receipt.manualBaqayaSettlements, []);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 1500);
});

test('storage: entries + stamps travel in JSON backups, merges and state round-trips', () => {
  let state = withBaqaya(stateWithPaidBill());
  const { nextState } = collect(state, 500);
  state = nextState;

  // persist/read round-trip through the storage sanitizer.
  const storage = memoryStorage();
  persistState(state, storage);
  const reloaded = readState(storage);
  assert.equal(manualBaqayaOutstanding(reloaded.customers[0]), 1000);
  assert.equal(reloaded.customers[0].manualBaqaya[0].id, 'MBQ-101');

  // JSON backup carries the entry; a device without it adopts it.
  const backupJson = createJsonBackup(state, REF);
  assert.equal(JSON.parse(backupJson).state.customers[0].manualBaqaya[0].amount, 1500);
  const localOnly = stateWithPaidBill();
  const preview = previewJsonBackupMerge(localOnly, backupJson);
  assert.equal(preview.canApply, true);
  const adopted = preview.state.customers[0];
  assert.equal(adopted.manualBaqaya.length, 1);
  assert.equal(adopted.manualBaqaya[0].id, 'MBQ-101');
});

test('sanitizers: malformed entries drop out; legacy customers load with zero baqaya', () => {
  const storage = memoryStorage();
  const dirty = {
    version: 1, nextCustomerNumber: 102,
    customers: [baseCustomer({
      manualBaqaya: [
        { id: 'MBQ-101', amount: 1500, date: '2026-09-10', note: 'ok', createdAt: '2026-10-15T00:00:00' },
        { id: 'MBQ-101', amount: 999, date: '2026-09-11' },
        { id: 'BAD-1', amount: 500, date: '2026-09-10' },
        { id: 'MBQ-102', amount: -5, date: '2026-09-10' },
        { id: 'MBQ-103', amount: 500, date: 'not-a-date' },
        'garbage'
      ]
    })]
  };
  persistState(dirty, storage);
  const loaded = readState(storage);
  assert.deepEqual(loaded.customers[0].manualBaqaya.map(e => e.id), ['MBQ-101']);

  const legacyStorage = memoryStorage();
  persistState({ version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] }, legacyStorage);
  const legacy = readState(legacyStorage);
  assert.deepEqual(legacy.customers[0].manualBaqaya, []);
  assert.equal(manualBaqayaOutstanding(legacy.customers[0]), 0);
  assert.equal(manualBaqayaCardBadgeMarkup(legacy.customers[0]), '');
});

test('payment stamps are capped by the cash collected; legacy payments stay byte-identical', () => {
  assert.throws(
    () => validatePayment({ date: '2026-10-15', amount: 100, method: 'Cash', manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 150 }] }, REF),
    /cannot exceed the amount collected/
  );
  const legacy = validatePayment({ date: '2026-10-15', amount: 100, method: 'Cash' }, REF);
  assert.equal('manualBaqayaSettlements' in legacy, false);
  const stamped = validatePayment({ date: '2026-10-15', amount: 1500, method: 'Cash', manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 1500 }] }, REF);
  assert.deepEqual(stamped.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);
});

test('correctPayment carries the baqaya stamp; shrinking cash to/below it is refused', () => {
  // A payment that settled a bill portion AND baqaya can be corrected
  // (method/restated receipt) with the stamp carried verbatim — the
  // SISP-43 ticket rule mirrored exactly: the corrected amount must
  // stay ABOVE the settled non-bill total, so a baqaya-only payment is
  // void-and-re-record, never corrected.
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  state = withBaqaya(state);
  const { nextState } = collect(state, 4500);
  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const corrected = correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-15', amount: 4500, method: 'JazzCash' }, REF);
  const fixed = corrected.customers[0].bills.find(b => b.month === MONTH).payments.find(p => p.id === payment.id);
  assert.deepEqual(fixed.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);
  assert.equal(manualBaqayaOutstanding(corrected.customers[0]), 0);
  assert.throws(
    () => correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-15', amount: 1500, method: 'Cash' }, REF),
    /settled manual baqaya/
  );
  assert.throws(
    () => correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-15', amount: 400, method: 'Cash' }, REF),
    /settled manual baqaya/
  );
});

test('validation: bad amounts, missing and future dates are refused', () => {
  const state = stateWithPaidBill();
  assert.throws(() => addManualBaqayaEntry(state, 'cust-1', { amount: 0, date: '2026-09-10' }, REF), /greater than zero/);
  assert.throws(() => addManualBaqayaEntry(state, 'cust-1', { amount: 100, date: '' }, REF), /Enter the date/);
  assert.throws(() => addManualBaqayaEntry(state, 'cust-1', { amount: 100, date: '2026-12-01' }, REF), /cannot be in the future/);
});

test('i18n: every baqaya_* key used in the UI exists in both dictionaries', () => {
  const sources = ['../manual-baqaya.js', '../app.js', '../nav-quick-collect.js', '../index.html']
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
  const keys = new Set([...sources.matchAll(/baqaya_[a-z_]+/g)].map(m => m[0]));
  assert.ok(keys.size >= 20, `expected a real key set, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `missing en key ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
});
