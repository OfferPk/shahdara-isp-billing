// SISP-64: Churned Customer Bad-Debt Write-Off & Reconnection Guard.
// Pure-function + core-integration tests on synthetic data only.
// Spec test criterion (verbatim): "Writing off Rs. 6,000 on an archived
// customer removes Rs. 6,000 from active collectible arrears into
// sisp_bad_debts_v1, and un-archiving restores the Rs. 6,000 due
// balance."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BAD_DEBTS_KEY,
  activeBadDebtFor,
  badDebtSummary,
  loadBadDebts,
  restoreBadDebt,
  sanitizeBadDebts,
  saveBadDebts,
  writeOffBadDebt
} from '../bad-debt-ledger.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { buildCollectionForecast } from '../collection-forecaster.js';
import { buildOwnerKhataReport, buildOwnerKhataWhatsAppText } from '../owner-khata.js';
import { badDebtPresentation } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const WRITE_OFF_DATE = '2026-10-29';

// Engine arrears for one synthetic customer, exactly as app.js computes
// them at render/click time (canonical allocation balances).
function engineArrears(customer) {
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  let cents = 0;
  const billBalances = [];
  for (const bill of customer.bills ?? []) {
    const summary = allocations.forMonth(customer.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      cents += summary.balanceDueCents;
      billBalances.push({ month: bill.month, balanceDue: summary.balanceDueCents / 100 });
    }
  }
  return { arrears: cents / 100, billBalances };
}

const churned = (overrides = {}) => ({
  id: 'cust-bd-1',
  customerNumber: 64,
  name: 'Test Customer 64',
  archived: true,
  archivedAt: '2026-10-05T10:00',
  bills: [
    { id: 'bill-aug', month: '2026-08', dueAmount: 2500, status: 'pending', payments: [] },
    { id: 'bill-sep', month: '2026-09', dueAmount: 3500, status: 'pending', payments: [] }
  ],
  ...overrides
});

test('PIN: writing off Rs 6,000 removes it from collectible arrears; restore brings it back', () => {
  const customer = churned();
  const before = engineArrears(customer);
  assert.equal(before.arrears, 6000);
  assert.equal(computeLedgerBalance(customer).balanceCents, 600000);

  const result = writeOffBadDebt([], customer, before.billBalances, { date: WRITE_OFF_DATE, reason: 'Left the area without paying' });
  // The register entry carries the full audited record.
  assert.equal(result.entry.badDebtId, 'BD-101');
  assert.equal(result.entry.customerId, 'cust-bd-1');
  assert.equal(result.entry.customerNumber, 64);
  assert.equal(result.entry.amount, 6000);
  assert.deepEqual(result.entry.bills, [
    { month: '2026-08', amount: 2500 },
    { month: '2026-09', amount: 3500 }
  ]);
  assert.equal(result.entry.writeOffDate, WRITE_OFF_DATE);
  assert.equal(result.entry.writeOffReason, 'Left the area without paying');
  assert.equal(result.entry.status, 'written-off');
  assert.equal(result.entries.length, 1);
  assert.equal(activeBadDebtFor(result.entries, 'cust-bd-1')?.badDebtId, 'BD-101');

  // Bills are stamped, auditable, and the input was never mutated.
  assert.equal(customer.bills[0].badDebtWriteOffAmount, undefined);
  for (const bill of result.customer.bills) {
    assert.equal(bill.badDebtWriteOffReason, 'Left the area without paying');
    assert.equal(bill.badDebtWriteOffAt, WRITE_OFF_DATE);
    assert.equal(bill.amountHistory.at(-1).type, 'bad_debt_write_off');
    assert.equal(bill.amountHistory.at(-1).badDebtId, 'BD-101');
  }
  assert.equal(result.customer.bills[0].badDebtWriteOffAmount, 2500);
  assert.equal(result.customer.bills[1].badDebtWriteOffAmount, 3500);

  // Collectible arrears are gone everywhere the engine speaks.
  assert.equal(engineArrears(result.customer).arrears, 0);
  const doctor = computeLedgerBalance(result.customer);
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.badDebtWriteOffsCents, 600000);

  // Un-archiving restores the Rs 6,000 due balance, exactly once.
  const restored = restoreBadDebt(result.entries, { ...result.customer, archived: false }, { date: '2026-11-02' });
  assert.equal(restored.restoredAmount, 6000);
  assert.equal(restored.entry.status, 'restored');
  assert.equal(restored.entry.restoredAt, '2026-11-02');
  assert.equal(activeBadDebtFor(restored.entries, 'cust-bd-1'), null);
  assert.equal(engineArrears(restored.customer).arrears, 6000);
  assert.equal(computeLedgerBalance(restored.customer).balanceCents, 600000);
  for (const bill of restored.customer.bills) {
    assert.equal(bill.badDebtWriteOffAmount, 0);
    assert.equal(bill.amountHistory.at(-1).type, 'bad_debt_restored');
  }
  // Never double-restores.
  assert.throws(() => restoreBadDebt(restored.entries, restored.customer, { date: '2026-11-03' }), /no active bad-debt write-off/);
});

test('collection forecaster stops counting the written-off arrears (archived included)', () => {
  const customer = churned();
  const ref = new Date('2026-10-15T12:00:00+05:00');
  const beforeForecast = buildCollectionForecast({ customers: [customer] }, '2026-10', ref);
  assert.equal(beforeForecast.arrearsCents, 600000);

  const { billBalances } = engineArrears(customer);
  const result = writeOffBadDebt([], customer, billBalances, { date: WRITE_OFF_DATE, reason: '' });
  // A blank reason falls back to the audited default.
  assert.equal(result.entry.writeOffReason, 'Uncollectible — customer churned');

  const afterForecast = buildCollectionForecast({ customers: [result.customer] }, '2026-10', ref);
  assert.equal(afterForecast.arrearsCents, 0);
  assert.equal(afterForecast.outstandingCents, beforeForecast.outstandingCents - 600000);
});

test('guards: only archived customers with a real balance, only once', () => {
  const active = churned({ archived: false, archivedAt: null });
  assert.throws(
    () => writeOffBadDebt([], active, engineArrears(active).billBalances, { date: WRITE_OFF_DATE, reason: 'x' }),
    /Only an archived/
  );

  const paidUp = churned({
    bills: [{ id: 'bill-aug', month: '2026-08', dueAmount: 2500, status: 'paid', payments: [{ id: 'pay-1', amount: 2500, date: '2026-08-10', method: 'Cash' }] }]
  });
  assert.throws(
    () => writeOffBadDebt([], paidUp, engineArrears(paidUp).billBalances, { date: WRITE_OFF_DATE, reason: 'x' }),
    /no unpaid balance/
  );

  const customer = churned();
  const first = writeOffBadDebt([], customer, engineArrears(customer).billBalances, { date: WRITE_OFF_DATE, reason: 'x' });
  assert.throws(
    () => writeOffBadDebt(first.entries, first.customer, [{ month: '2026-09', balanceDue: 100 }], { date: WRITE_OFF_DATE, reason: 'x' }),
    /already has an active bad-debt write-off/
  );
  assert.throws(
    () => writeOffBadDebt([], customer, engineArrears(customer).billBalances, { date: '29-10-2026', reason: 'x' }),
    /valid write-off date/
  );
  // After a restore the customer may churn again: a fresh write-off is
  // a NEW entry, never a resurrection of the restored one.
  const restored = restoreBadDebt(first.entries, first.customer, { date: '2026-11-02' });
  const second = writeOffBadDebt(restored.entries, restored.customer, engineArrears(restored.customer).billBalances, { date: '2026-12-01', reason: 'Left again' });
  assert.equal(second.entry.badDebtId, 'BD-102');
  assert.equal(second.entries.length, 2);
  assert.equal(badDebtSummary(second.entries).activeTotal, 6000);
});

test('voided payments never reduce the write-off; valid payments do', () => {
  const voidedOnly = churned({
    bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 6000, status: 'pending', payments: [{ id: 'pay-v', amount: 6000, date: '2026-09-10', method: 'Cash', voided: true }] }]
  });
  assert.equal(engineArrears(voidedOnly).arrears, 6000);

  const partial = churned({
    bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 6000, status: 'partial', payments: [
      { id: 'pay-ok', amount: 2000, date: '2026-09-10', method: 'Cash' },
      { id: 'pay-void', amount: 1000, date: '2026-09-11', method: 'Cash', voided: true }
    ] }]
  });
  const { arrears, billBalances } = engineArrears(partial);
  assert.equal(arrears, 4000);
  const result = writeOffBadDebt([], partial, billBalances, { date: WRITE_OFF_DATE, reason: 'Churned' });
  assert.equal(result.entry.amount, 4000);
  // The receipts themselves are untouched by the write-off.
  assert.equal(result.customer.bills[0].payments.length, 2);
  assert.equal(result.customer.bills[0].payments[0].amount, 2000);
});

test('sanitize: malformed rows dropped, one active entry per customer, totals recomputed from shares', () => {
  const cleaned = sanitizeBadDebts([
    { badDebtId: 'BD-101', customerId: 'c1', customerNumber: 7, amount: 9999, bills: [{ month: '2026-08', amount: 2500 }, { month: '2026-09', amount: 3500 }], writeOffDate: '2026-10-29', writeOffReason: 'Gone', status: 'written-off' },
    { badDebtId: 'BD-102', customerId: 'c1', amount: 500, bills: [{ month: '2026-09', amount: 500 }], writeOffDate: '2026-10-30', status: 'written-off' },
    { badDebtId: 'BD-101', customerId: 'c2', amount: 100, status: 'written-off' },
    { badDebtId: 'XX-1', customerId: 'c3', amount: 100, status: 'written-off' },
    { badDebtId: 'BD-103', customerId: '', amount: 100, status: 'written-off' },
    { badDebtId: 'BD-104', customerId: 'c4', amount: -5, status: 'written-off' },
    null,
    'junk'
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].amount, 6000); // recomputed from shares, not the stored 9999
  const summary = badDebtSummary(cleaned);
  assert.equal(summary.activeTotal, 6000);
  assert.equal(summary.activeCount, 1);
  assert.equal(summary.restoredTotal, 0);
});

test('storage round-trip through the sisp_bad_debts_v1 key', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
  const customer = churned();
  const result = writeOffBadDebt([], customer, engineArrears(customer).billBalances, { date: WRITE_OFF_DATE, reason: 'Gone' });
  saveBadDebts(result.entries, storage);
  assert.ok(store.has(BAD_DEBTS_KEY));
  assert.deepEqual(loadBadDebts(storage), result.entries);
});

test('backup round-trip: settings.badDebts travels, safe-merge adopts or conflicts', () => {
  const customer = churned();
  const { entries } = writeOffBadDebt([], customer, engineArrears(customer).billBalances, { date: WRITE_OFF_DATE, reason: 'Gone' });
  const backupText = createJsonBackup(createInitialState([]), new Date('2026-10-29T12:00:00+05:00'), { badDebts: entries });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.badDebts.length, 1);
  assert.equal(parsed.settings.badDebts[0].badDebtId, 'BD-101');
  assert.equal(parsed.settings.badDebts[0].amount, 6000);

  // Adopted when this device has none stored yet.
  const preview = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(preview.badDebts.length, 1);
  assert.equal(preview.badDebts[0].amount, 6000);

  // Identical on both sides: no conflict.
  const identical = previewJsonBackupMerge(createInitialState([]), backupText, { currentBadDebts: entries, currentBadDebtsStored: true });
  assert.equal(identical.badDebts, null);
  assert.equal(identical.conflicts.some((row) => /Bad debt/.test(row.field)), false);

  // Different real entries on both sides: keep existing + conflict.
  const other = [{ badDebtId: 'BD-101', customerId: 'cust-other', customerNumber: 9, amount: 100, bills: [{ month: '2026-09', amount: 100 }], writeOffDate: '2026-10-01', writeOffReason: 'Other', status: 'written-off', restoredAt: '' }];
  const clash = previewJsonBackupMerge(createInitialState([]), backupText, { currentBadDebts: other, currentBadDebtsStored: true });
  assert.equal(clash.badDebts, null);
  assert.equal(clash.conflicts.some((row) => /Bad debt records differ/.test(row.field)), true);
});

test('profile presentation: write-off offered only to archived customers who owe', () => {
  const customer = churned();
  const pres = badDebtPresentation(customer, [], 6000);
  assert.equal(pres.visible, true);
  assert.equal(pres.canWriteOff, true);
  assert.equal(pres.writtenOff, false);
  assert.match(pres.arrearsLabel, /6,000/);

  const result = writeOffBadDebt([], customer, engineArrears(customer).billBalances, { date: WRITE_OFF_DATE, reason: 'Gone' });
  const donePres = badDebtPresentation(result.customer, result.entries, 0);
  assert.equal(donePres.visible, true);
  assert.equal(donePres.writtenOff, true);
  assert.match(donePres.writtenOffLabel, /6,000/);

  assert.equal(badDebtPresentation(churned({ archived: false, archivedAt: null }), [], 6000).visible, false);
  assert.equal(badDebtPresentation(churned({ bills: [] }), [], 0).visible, false);
});

test('owner khata carries the active written-off total (and stays silent at zero)', () => {
  const month = '2026-10';
  const clean = buildOwnerKhataReport(createInitialState([]), month, {});
  assert.equal(clean.badDebtWrittenOff, 0);
  assert.equal(buildOwnerKhataWhatsAppText(clean).includes('Bad Debt'), false);

  const withDebt = buildOwnerKhataReport(createInitialState([]), month, { badDebt: { activeTotal: 6000, activeCount: 1 } });
  assert.equal(withDebt.badDebtWrittenOff, 6000);
  assert.equal(withDebt.badDebtCustomerCount, 1);
  assert.match(buildOwnerKhataWhatsAppText(withDebt), /Bad Debt Written Off: .*6,000 \(1 customer\)/);
});

test('i18n audit: every bd_ key exists in en + ur and no t() call resolves to a raw key', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('bd_') || key === 'dash_khata_baddebt');
  assert.ok(enKeys.length >= 15);
  for (const key of enKeys) {
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur translation for ${key}`);
    assert.notEqual(t(key, 'en'), key, `en t() returned raw key ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur t() returned raw key ${key}`);
  }
  // Mechanical audit: every bad-debt t() key referenced in the app
  // sources exists in BOTH dictionaries.
  const referenced = new Set();
  for (const file of ['app.js', 'profile-ui.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/t\('((?:bd_|dash_khata_baddebt)[a-z_]*)'/g)) referenced.add(match[1]);
  }
  assert.ok(referenced.size >= 10);
  for (const key of referenced) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `missing en translation for referenced ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur translation for referenced ${key}`);
  }
});
