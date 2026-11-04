import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validSettlementDate,
  validSettlementMonth,
  settlementAmountCents,
  normalizeSettlement,
  normalizeSettlementList,
  upsertSettlement,
  removeSettlement,
  findSettlement,
  settlementForCollectorPeriod,
  settlementsForCollector,
  settlementFigures,
  settlementDifferenceLabel,
  verifySettlement,
  signSettlement,
  formatSettlementCents,
  settlementSummaryText,
  settlementHtml,
  settlementCsv,
  settlementFilename,
} from '../collector-settlements.js';

const rec = (over = {}) => ({
  id: 'CS-1',
  collector: 'Saad',
  collectorName: 'Saad',
  period: '2026-10',
  statementDate: '2026-10-31',
  collected: 50000,
  handedOver: 40000,
  pending: 2000,
  cashInHand: 8000,
  preparedBy: 'Owner',
  note: 'October settlement',
  ...over,
});

test('strict dates and months: real values pass, impossible values refused', () => {
  assert.equal(validSettlementDate('2026-10-31'), '2026-10-31');
  assert.equal(validSettlementDate('2026-08-31'), '2026-08-31');
  assert.equal(validSettlementDate('2026-12-31'), '2026-12-31');
  assert.equal(validSettlementDate('2026-04-31'), null);
  assert.equal(validSettlementDate('2024-02-29'), '2024-02-29');
  assert.equal(validSettlementDate('2026-02-30'), null);
  assert.equal(validSettlementDate('2026-13-01'), null);
  assert.equal(validSettlementDate('31-10-2026'), null);
  assert.equal(validSettlementDate(''), null);
  assert.equal(validSettlementDate(null), null);
  assert.equal(validSettlementMonth('2026-10'), '2026-10');
  assert.equal(validSettlementMonth('2026-13'), null);
  assert.equal(validSettlementMonth('2026-1'), null);
  assert.equal(validSettlementMonth('Oct 2026'), null);
  assert.equal(validSettlementMonth(''), null);
});

test('rupees convert once, *Cents pass through as-is, unusable refused', () => {
  assert.equal(settlementAmountCents({ amount: 1500 }), 150000);
  assert.equal(settlementAmountCents({ amount: 1500.55 }), 150055);
  assert.equal(settlementAmountCents({ amountCents: 150000 }), 150000);
  assert.equal(settlementAmountCents({ amountCents: 150000, amount: 9999 }), 150000);
  assert.equal(settlementAmountCents({ amount: 'abc' }), null);
  assert.equal(settlementAmountCents({}), null);
  assert.equal(settlementAmountCents(null), null);
});

test('half-formed records refused, unknown fields dropped', () => {
  assert.equal(normalizeSettlement(rec({ id: '' })), null);
  assert.equal(normalizeSettlement(rec({ collector: '' })), null);
  assert.equal(normalizeSettlement(rec({ period: '2026-13' })), null);
  assert.equal(normalizeSettlement(rec({ statementDate: '2026-02-30' })), null);
  assert.equal(normalizeSettlement(rec({ collected: -5 })), null);
  assert.equal(normalizeSettlement(rec({ handedOver: 'lots' })), null);
  assert.equal(normalizeSettlement(rec({ pending: undefined })), null);
  assert.equal(normalizeSettlement(rec({ cashInHand: null })), null);
  assert.equal(normalizeSettlement(null), null);
  const kept = normalizeSettlement(rec({ paymentId: 'PAY-9', billTotal: 123, signedBy: '', signedDate: '' }));
  assert.deepEqual(Object.keys(kept).sort(), ['cashInHandCents', 'collectedCents', 'collector', 'collectorName', 'handedOverCents', 'id', 'note', 'pendingCents', 'period', 'preparedBy', 'signedBy', 'signedDate', 'statementDate']);
  // A signer without a date, or a date without a signer, is half a signature.
  assert.equal(normalizeSettlement(rec({ signedBy: 'Saad', signedDate: '' })), null);
  assert.equal(normalizeSettlement(rec({ signedBy: '', signedDate: '2026-10-31' })), null);
  assert.equal(normalizeSettlement(rec({ signedBy: 'Saad', signedDate: '2026-02-30' })), null);
  assert.ok(normalizeSettlement(rec({ signedBy: 'Saad', signedDate: '2026-10-31' })));
});

test('zero figures are real figures, and the identity is exact', () => {
  const figures = settlementFigures(rec());
  assert.equal(figures.expectedInHandCents, 800000);
  assert.equal(figures.differenceCents, 0);
  assert.equal(figures.status, 'balanced');
  const zero = settlementFigures(rec({ collected: 0, handedOver: 0, pending: 0, cashInHand: 0 }));
  assert.equal(zero.status, 'balanced');
  assert.equal(zero.expectedInHandCents, 0);
});

test('shortfall and excess are named plainly with their amounts', () => {
  const short = settlementFigures(rec({ cashInHand: 7000 }));
  assert.equal(short.status, 'shortfall');
  assert.equal(short.differenceCents, -100000);
  assert.match(settlementDifferenceLabel(short), /Shortfall of Rs\. 1000\.00/);
  const excess = settlementFigures(rec({ cashInHand: 9500 }));
  assert.equal(excess.status, 'excess');
  assert.equal(excess.differenceCents, 150000);
  assert.match(settlementDifferenceLabel(excess), /Excess of Rs\. 1500\.00/);
  assert.match(settlementDifferenceLabel(settlementFigures(rec())), /Balanced/);
  assert.equal(settlementDifferenceLabel(null), 'Not checkable');
});

test('one statement per collector per period, duplicate ids never rewritten', () => {
  const first = upsertSettlement([], rec());
  assert.equal(first.length, 1);
  // Same id, different figures: refused, original untouched.
  assert.deepEqual(upsertSettlement(first, rec({ cashInHand: 1 })), first);
  // Identical re-save: unchanged.
  assert.deepEqual(upsertSettlement(first, rec()), first);
  // Different id, same collector and period: refused outright.
  assert.deepEqual(upsertSettlement(first, rec({ id: 'CS-2' })), first);
  // A different collector, or a different period, is a new statement.
  assert.equal(upsertSettlement(first, rec({ id: 'CS-2', collector: 'Second' })).length, 2);
  assert.equal(upsertSettlement(first, rec({ id: 'CS-3', period: '2026-11' })).length, 2);
  // Normalising a list keeps the first statement per collector and period.
  const normalised = normalizeSettlementList([rec(), rec({ id: 'CS-9', cashInHand: 1 })]);
  assert.equal(normalised.length, 1);
  assert.equal(normalised[0].id, 'CS-1');
});

test('verify against source totals: matched, mismatched, and unchecked fields', () => {
  const all = verifySettlement(rec(), { collected: 50000, handedOver: 40000, pending: 2000, cashInHand: 8000 });
  assert.equal(all.matches, true);
  assert.deepEqual(all.mismatches, []);
  assert.deepEqual(all.unchecked, []);
  const some = verifySettlement(rec(), { collected: 50000, handedOver: 39000, pending: 2000, cashInHand: 8000 });
  assert.equal(some.matches, false);
  assert.equal(some.mismatches.length, 1);
  assert.equal(some.mismatches[0].field, 'handedOver');
  assert.equal(some.mismatches[0].statement, 4000000);
  assert.equal(some.mismatches[0].source, 3900000);
  // An unusable source figure is unchecked, never a guessed match or mismatch.
  const partial = verifySettlement(rec(), { collected: 50000 });
  assert.equal(partial.matches, false);
  assert.equal(partial.unchecked.length, 3);
  assert.equal(partial.results.find((r) => r.field === 'collected').result, 'matched');
  assert.equal(verifySettlement(rec({ id: '' }), {}), null);
  assert.equal(verifySettlement(rec(), { collectedCents: 5000000, handedOverCents: 4000000, pendingCents: 200000, cashInHandCents: 800000 }).matches, true);
});

test('signing once, and only once, with a real date', () => {
  const list = upsertSettlement([], rec());
  const signed = signSettlement(list, 'CS-1', 'Saad', '2026-11-01');
  assert.equal(signed[0].signedBy, 'Saad');
  assert.equal(signed[0].signedDate, '2026-11-01');
  // Re-signing is refused: the first signature stands.
  assert.deepEqual(signSettlement(signed, 'CS-1', 'Owner', '2026-11-02'), signed);
  // Blank signer, unreal date, and unknown id leave the list unchanged.
  assert.deepEqual(signSettlement(list, 'CS-1', '', '2026-11-01'), list);
  assert.deepEqual(signSettlement(list, 'CS-1', 'Saad', '2026-02-30'), list);
  assert.deepEqual(signSettlement(list, 'CS-9', 'Saad', '2026-11-01'), list);
});

test('remove, find, per-collector period lookup, and newest-first listing', () => {
  const list = upsertSettlement(upsertSettlement([], rec()), rec({ id: 'CS-2', period: '2026-11', statementDate: '2026-11-30' }));
  assert.equal(findSettlement(list, 'CS-2').period, '2026-11');
  assert.equal(findSettlement(list, 'CS-9'), null);
  assert.equal(settlementForCollectorPeriod(list, 'Saad', '2026-10').id, 'CS-1');
  assert.equal(settlementForCollectorPeriod(list, 'Saad', '2026-12'), null);
  assert.deepEqual(settlementsForCollector(list, 'Saad').map((r) => r.id), ['CS-2', 'CS-1']);
  assert.deepEqual(settlementsForCollector(list, 'NOBODY'), []);
  assert.equal(removeSettlement(list, 'CS-1').length, 1);
  assert.deepEqual(removeSettlement(list, 'CS-9'), list);
  assert.deepEqual(removeSettlement(list, ''), list);
});

test('recording a statement changes no source figure (non-mutation)', () => {
  const first = upsertSettlement([], rec());
  const frozen = JSON.parse(JSON.stringify(first));
  const second = upsertSettlement(first, rec({ id: 'CS-2', period: '2026-11', collected: 100 }));
  assert.deepEqual(first, frozen);
  assert.equal(second.find((r) => r.id === 'CS-1').collectedCents, 5000000);
  assert.equal(second.find((r) => r.id === 'CS-2').collectedCents, 10000);
});

test('format, summary, HTML escaping, CSV quoting', () => {
  assert.equal(formatSettlementCents(150000), 'Rs. 1500.00');
  assert.equal(formatSettlementCents(-25000), '-Rs. 250.00');
  assert.equal(formatSettlementCents('x'), '—');
  const list = upsertSettlement([], rec());
  assert.match(settlementSummaryText(list, 'Saad'), /1 settlement statement; latest Saad 2026-10: Balanced/);
  assert.equal(settlementSummaryText([], 'Saad'), 'No settlement statement recorded.');
  const html = settlementHtml([rec({ collectorName: '<b>Saad</b>', note: 'x' })]);
  assert.doesNotMatch(html, /<b>Saad<\/b>/);
  assert.match(html, /&lt;b&gt;Saad&lt;\/b&gt;/);
  assert.match(html, /Expected in hand = collected/);
  assert.match(html, /Not yet signed/);
  const signedHtml = settlementHtml([rec({ signedBy: 'Saad', signedDate: '2026-11-01' })]);
  assert.match(signedHtml, /Signed by Saad on 2026-11-01/);
  const csv = settlementCsv([rec({ note: 'has, comma' })]);
  assert.match(csv, /^id,collector,collector_name,period,statement_date,collected_cents,handed_over_cents,pending_cents,cash_in_hand_cents,expected_in_hand_cents,difference_cents,status,prepared_by,signed_by,signed_date,note\n/);
  assert.match(csv, /"has, comma"/);
  assert.equal(settlementFilename(), 'collector-settlements.csv');
});

test('purity fence: module is import-free and names no other record module', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(dir, '..', 'collector-settlements.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /balanceConfirmation|paymentClearance|bankCredit|closedPeriod|dueDateShift|combinedDues|receiptSeries|depositSlip|cashRecon|methodRecon/);
});

test('panel ids present in index.html', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['settleBody', 'settleCollector', 'settlePeriod', 'settleDate', 'settleCollected', 'settleHandedOver', 'settlePending', 'settleInHand', 'settlePreparedBy', 'settleNote', 'settleSaveBtn', 'settleFilter', 'settleSignId', 'settleSignedBy', 'settleSignedDate', 'settleSignBtn', 'settleRemoveId', 'settleRemoveBtn', 'settleExportBtn', 'settleSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
