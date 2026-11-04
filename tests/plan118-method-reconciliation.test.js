import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validReconMonth,
  validReconDate,
  amountToCents,
  methodGroupKey,
  methodGroupLabel,
  normalizePaymentRow,
  normalizeConfirmedTotal,
  buildMethodReconciliation,
  reconciliationSummaryText,
  methodReconciliationHtml,
  methodReconciliationCsv,
  methodReconciliationFilename,
  normalizeMethodNote,
  normalizeMethodNoteList,
  addMethodNote,
  notesForMethod,
  methodNoteHtml,
  methodNoteCsv,
  methodNoteFilename,
} from '../method-reconciliation.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'method-reconciliation.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const payment = (overrides = {}) => ({
  id: 'PAY-1',
  method: 'Cash',
  amount: 1500,
  date: '2026-10-05',
  ...overrides,
});

test('plan118: strict months and dates — real values pass, impossible values refused', () => {
  assert.equal(validReconMonth('2026-10'), '2026-10');
  assert.equal(validReconMonth('2026-13'), null);
  assert.equal(validReconMonth('2026-1'), null);
  assert.equal(validReconMonth('10-2026'), null);
  assert.equal(validReconDate('2026-10-31'), '2026-10-31');
  assert.equal(validReconDate('2024-02-29'), '2024-02-29');
  assert.equal(validReconDate('2026-02-30'), null);
  assert.equal(validReconDate('2026-11-31'), null);
  assert.equal(buildMethodReconciliation([], [], '2026-13'), null);
});

test('plan118: rupees convert once, cents pass through, bad amounts are unusable', () => {
  assert.equal(amountToCents(1500), 150000);
  assert.equal(amountToCents(10.55), 1055);
  assert.equal(amountToCents(null, 150000), 150000);
  assert.equal(amountToCents(999, 150000), 150000);
  assert.equal(amountToCents(-5), null);
  assert.equal(amountToCents('abc'), null);
  assert.equal(amountToCents(''), null);
  assert.equal(amountToCents(null, 10.5), null);
  assert.equal(amountToCents(null, -100), null);
});

test('plan118: method grouping — cash variants, bank, wallet; unknown keeps its own label', () => {
  assert.equal(methodGroupKey('Cash'), 'cash');
  assert.equal(methodGroupKey('Cash at Waseem Abbasi shop'), 'cash');
  assert.equal(methodGroupKey('Cash at Hassan shop'), 'cash');
  assert.equal(methodGroupKey('Bank Transfer'), 'bank_transfer');
  assert.equal(methodGroupKey('Raast'), 'bank_transfer');
  assert.equal(methodGroupKey('JazzCash'), 'mobile_wallet');
  assert.equal(methodGroupKey('Easypaisa'), 'mobile_wallet');
  assert.equal(methodGroupKey('NayaPay'), 'mobile_wallet');
  assert.equal(methodGroupKey('Cheque'), 'cheque');
  assert.equal(methodGroupLabel('cheque'), 'cheque');
  assert.equal(methodGroupLabel('cash'), 'Cash');
  assert.equal(methodGroupKey(''), null);
  assert.equal(methodGroupKey(null), null);
});

test('plan118: half-formed rows land in the unusable list, never in the totals', () => {
  const recon = buildMethodReconciliation([
    payment({ id: 'PAY-1' }),
    payment({ id: 'PAY-2', method: '' }),
    payment({ id: 'PAY-3', amount: 'abc' }),
    payment({ id: 'PAY-4', date: '2026-02-30' }),
    null,
  ], [], '2026-10');
  assert.equal(recon.ledgerTotalCents, 150000);
  assert.equal(recon.unusable.length, 4);
  assert.deepEqual(recon.unusable.map((row) => row.id), ['PAY-2', 'PAY-3', 'PAY-4', '']);
  assert.ok(recon.unusable.every((row) => row.reason));
});

test('plan118: period filter — rows outside the month never enter the totals', () => {
  const recon = buildMethodReconciliation([
    payment({ id: 'PAY-1', date: '2026-10-05' }),
    payment({ id: 'PAY-2', date: '2026-09-30' }),
    payment({ id: 'PAY-3', date: '2026-11-01' }),
  ], [], '2026-10');
  assert.equal(recon.ledgerTotalCents, 150000);
  assert.equal(recon.rows.length, 1);
  assert.equal(recon.rows[0].paymentCount, 1);
});

test('plan118: voided rows are excluded from totals and counted apart', () => {
  const recon = buildMethodReconciliation([
    payment({ id: 'PAY-1' }),
    payment({ id: 'PAY-2', voided: true }),
    payment({ id: 'PAY-3', status: 'void' }),
  ], [], '2026-10');
  assert.equal(recon.ledgerTotalCents, 150000);
  assert.equal(recon.voidedSkipped, 2);
  assert.equal(recon.rows[0].paymentCount, 1);
});

test('plan118: acceptance — method totals sum exactly to the period collection total', () => {
  const recon = buildMethodReconciliation([
    payment({ id: 'PAY-1', method: 'Cash', amount: 1500 }),
    payment({ id: 'PAY-2', method: 'Cash at Hassan shop', amount: 500 }),
    payment({ id: 'PAY-3', method: 'Easypaisa', amount: 2000 }),
    payment({ id: 'PAY-4', method: 'Bank Transfer', amount: 1000 }),
  ], [], '2026-10');
  assert.equal(recon.ledgerTotalCents, 500000);
  assert.equal(recon.rows.reduce((sum, row) => sum + row.ledgerCents, 0), recon.ledgerTotalCents);
  const byKey = Object.fromEntries(recon.rows.map((row) => [row.methodKey, row]));
  assert.equal(byKey.cash.ledgerCents, 200000);
  assert.equal(byKey.mobile_wallet.ledgerCents, 200000);
  assert.equal(byKey.bank_transfer.ledgerCents, 100000);
});

test('plan118: differences — every nonzero difference listed with method and amount', () => {
  const recon = buildMethodReconciliation([
    payment({ id: 'PAY-1', method: 'Cash', amount: 1500 }),
    payment({ id: 'PAY-2', method: 'Easypaisa', amount: 2000 }),
  ], [
    { method: 'Cash', amount: 1400 },
    { method: 'Easypaisa', amount: 2200 },
  ], '2026-10');
  assert.equal(recon.differences.length, 2);
  const cash = recon.differences.find((row) => row.methodKey === 'cash');
  const wallet = recon.differences.find((row) => row.methodKey === 'mobile_wallet');
  assert.equal(cash.differenceCents, -10000);
  assert.equal(wallet.differenceCents, 20000);
  assert.equal(recon.confirmedTotalCents, 360000);
  const matched = buildMethodReconciliation([payment()], [{ method: 'Cash', amount: 1500 }], '2026-10');
  assert.equal(matched.differences.length, 0);
  assert.equal(matched.rows[0].differenceCents, 0);
});

test('plan118: unconfirmed method is never zero-filled — null confirmed, null difference', () => {
  const recon = buildMethodReconciliation([payment()], [], '2026-10');
  assert.equal(recon.rows[0].confirmedCents, null);
  assert.equal(recon.rows[0].differenceCents, null);
  assert.equal(recon.differences.length, 0);
});

test('plan118: confirmed-only method appears with ledger zero and its full difference', () => {
  const recon = buildMethodReconciliation([], [{ method: 'Bank Transfer', amount: 5000 }], '2026-10');
  assert.equal(recon.rows.length, 1);
  assert.equal(recon.rows[0].ledgerCents, 0);
  assert.equal(recon.rows[0].confirmedCents, 500000);
  assert.equal(recon.rows[0].differenceCents, 500000);
  assert.equal(recon.ledgerTotalCents, 0);
});

test('plan118: explanation notes — half-formed refused, duplicate id never rewritten', () => {
  const note = {
    id: 'MRN-1', period: '2026-10', method: 'cash',
    differenceCents: -10000, note: 'Wallet payout delayed to next day', date: '2026-10-31',
  };
  assert.ok(normalizeMethodNote(note));
  assert.equal(normalizeMethodNote({ ...note, note: '  ' }), null);
  assert.equal(normalizeMethodNote({ ...note, date: '2026-02-30' }), null);
  assert.equal(normalizeMethodNote({ ...note, differenceCents: 0 }), null);
  assert.equal(normalizeMethodNote({ ...note, period: '2026-13' }), null);
  const added = addMethodNote([], note);
  assert.equal(added.length, 1);
  assert.equal(addMethodNote(added, note).length, 1);
  assert.deepEqual(addMethodNote(added, note), added);
  const changed = addMethodNote(added, { ...note, note: 'Different note' });
  assert.equal(changed.length, 1);
  assert.equal(changed[0].note, 'Wallet payout delayed to next day');
  assert.equal(addMethodNote(added, { ...note, id: 'MRN-2', note: '' }).length, 1);
});

test('plan118: notes filter by method and render as html/csv', () => {
  const notes = normalizeMethodNoteList([
    { id: 'MRN-1', period: '2026-10', method: 'cash', differenceCents: -10000, note: 'Short', date: '2026-10-31' },
    { id: 'MRN-2', period: '2026-10', method: 'Easypaisa', differenceCents: 5000, note: 'Extra', date: '2026-10-31' },
  ]);
  assert.equal(notesForMethod(notes, 'cash').length, 1);
  assert.equal(notesForMethod(notes, 'mobile_wallet').length, 1);
  assert.equal(notesForMethod(notes, 'bank_transfer').length, 0);
  assert.ok(methodNoteHtml(notes[0]).includes('shortfall'));
  assert.ok(methodNoteHtml(notes[1]).includes('surplus'));
  assert.ok(methodNoteCsv(notes).startsWith('id,period,method,difference_cents,note,date'));
  assert.equal(methodNoteFilename(), 'method-reconciliation-notes.csv');
});

test('plan118: inputs are never mutated', () => {
  const payments = [payment(), payment({ id: 'PAY-2', method: 'Easypaisa', amount: 2000 })];
  const confirmed = [{ method: 'Cash', amount: 1400 }];
  const beforePayments = JSON.stringify(payments);
  const beforeConfirmed = JSON.stringify(confirmed);
  buildMethodReconciliation(payments, confirmed, '2026-10');
  assert.equal(JSON.stringify(payments), beforePayments);
  assert.equal(JSON.stringify(confirmed), beforeConfirmed);
  const notes = [{ id: 'MRN-1', period: '2026-10', method: 'cash', differenceCents: -10000, note: 'Short', date: '2026-10-31' }];
  const beforeNotes = JSON.stringify(notes);
  addMethodNote(notes, { id: 'MRN-2', period: '2026-10', method: 'cash', differenceCents: 5000, note: 'Extra', date: '2026-10-31' });
  assert.equal(JSON.stringify(notes), beforeNotes);
});

test('plan118: summary, html, csv, filename', () => {
  const recon = buildMethodReconciliation([
    payment({ method: 'Cash', amount: 1500 }),
    payment({ id: 'PAY-2', method: 'Easypaisa', amount: 2000 }),
  ], [{ method: 'Cash', amount: 1400 }], '2026-10');
  const summary = reconciliationSummaryText(recon);
  assert.ok(summary.includes('2026-10'));
  assert.ok(summary.includes('1 difference(s)'));
  const out = methodReconciliationHtml(recon);
  assert.ok(out.includes('Cash'));
  assert.ok(out.includes('Shortfall'));
  assert.ok(out.includes('Not confirmed'));
  const csv = methodReconciliationCsv(recon);
  assert.ok(csv.startsWith('period,method,ledger_cents,confirmed_cents,difference_cents,payment_count'));
  assert.ok(csv.includes('2026-10,Cash,150000,140000,-10000,1'));
  assert.equal(methodReconciliationFilename('2026-10'), 'method-reconciliation-2026-10.csv');
  assert.equal(methodReconciliationFilename('2026-13'), 'method-reconciliation.csv');
  assert.equal(reconciliationSummaryText(null), 'No reconciliation built: pick a real month.');
});

test('plan118: purity fence — no imports, storage, DOM, network, or preferred-channel module reference', () => {
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('payment-channel'));
  assert.ok(!source.includes('paymentChannel'));
  assert.ok(!source.includes('shahdara_payment_channels'));
});

test('plan118: panel ids present in index.html', () => {
  for (const id of [
    'methodReconMonth', 'methodReconConfirmed', 'methodReconBody', 'methodReconSummary',
    'methodReconNotesBody', 'methodReconNoteMethod', 'methodReconNoteDifference',
    'methodReconNoteText', 'methodReconNoteDate', 'methodReconSaveNoteBtn',
    'methodReconRefreshBtn', 'methodReconExportBtn', 'methodReconExportNotesBtn',
  ]) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
});
