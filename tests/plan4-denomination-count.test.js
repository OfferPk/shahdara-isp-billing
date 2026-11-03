import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PKR_DENOMINATIONS,
  denominationById,
  normalizeDenominationCounts,
  buildDenominationCount,
  compareDenominationCount,
  denominationCountMatchesCounted,
  attachDenominationCountToHandover,
  denominationCountSummaryText,
  denominationCountHtml,
} from '../denomination-count.js';

import {
  recordCashHandover,
  getDailyCashHandovers,
  generateHandoverSlipText,
} from '../dashboard-daily-closing.js';

const mockStorage = () => ({
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
});

// ---- denomination catalogue ----

test('PKR catalogue lists notes and coins, with Rs. 10 note and Rs. 10 coin as distinct rows', () => {
  assert.equal(denominationById('note-10').kind, 'note');
  assert.equal(denominationById('coin-10').kind, 'coin');
  assert.notEqual(denominationById('note-10'), denominationById('coin-10'));
  assert.equal(denominationById('note-5000').value, 5000);
  assert.equal(denominationById('coin-1').value, 1);
  assert.equal(denominationById('nope'), null);
  assert.equal(PKR_DENOMINATIONS.length, 11);
});

test('catalogue is largest-to-smallest', () => {
  const values = PKR_DENOMINATIONS.map((d) => d.value);
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
});

// ---- count sheet ----

test('build sums mixed notes and coins, largest first, with piece count', () => {
  const sheet = buildDenominationCount({ 'note-1000': 3, 'note-100': 5, 'coin-5': 4, 'note-5000': 0 });
  assert.equal(sheet.total, 3520);
  assert.equal(sheet.pieces, 12);
  assert.equal(sheet.denominationsUsed, 3);
  assert.equal(sheet.isEmpty, false);
  assert.deepEqual(sheet.rows.map((r) => r.id), ['note-1000', 'note-100', 'coin-5']);
  assert.deepEqual(sheet.rows.map((r) => r.amount), [3000, 500, 20]);
  assert.deepEqual(sheet.invalid, []);
});

test('empty and missing input give an empty sheet, never a total', () => {
  for (const input of [undefined, null, {}, { 'note-1000': 0 }]) {
    const sheet = buildDenominationCount(input);
    assert.equal(sheet.total, 0);
    assert.equal(sheet.isEmpty, true);
    assert.deepEqual(sheet.rows, []);
  }
});

test('negative, fractional, NaN and text counts are rejected and reported, not coerced', () => {
  const sheet = buildDenominationCount({
    'note-1000': -2,
    'note-500': 1.5,
    'note-100': 'abc',
    'note-50': 2,
  });
  assert.equal(sheet.total, 100);
  assert.deepEqual(sheet.rows.map((r) => r.id), ['note-50']);
  assert.deepEqual([...sheet.invalid].sort(), ['note-100', 'note-1000', 'note-500']);
});

test('unknown denomination ids are ignored and reported, never added to the total', () => {
  const sheet = buildDenominationCount({ 'note-1000': 1, 'note-2000': 5, 'bill-100': 3 });
  assert.equal(sheet.total, 1000);
  assert.deepEqual([...sheet.invalid].sort(), ['bill-100', 'note-2000']);
});

test('string counts that are whole numbers are accepted', () => {
  const sheet = buildDenominationCount({ 'note-1000': '2' });
  assert.equal(sheet.total, 2000);
  assert.deepEqual(sheet.invalid, []);
});

test('array rows and a previously built sheet re-read to the same total', () => {
  const fromRows = buildDenominationCount([{ id: 'note-500', count: 2 }, { id: 'coin-2', count: 3 }]);
  assert.equal(fromRows.total, 1006);
  const reread = buildDenominationCount(fromRows);
  assert.equal(reread.total, 1006);
  assert.deepEqual(reread.rows.map((r) => r.id), ['note-500', 'coin-2']);
});

test('normalize exposes a count for every denomination, defaulting to zero', () => {
  const { counts } = normalizeDenominationCounts({ 'note-100': 4 });
  assert.equal(counts['note-100'], 4);
  assert.equal(counts['note-5000'], 0);
  assert.equal(counts['coin-1'], 0);
});

// ---- comparison against expected cash ----

test('compare flags balanced exactly, shortage below, surplus above, with signed difference', () => {
  const balanced = compareDenominationCount({ 'note-1000': 5 }, 5000);
  assert.equal(balanced.status, 'balanced');
  assert.equal(balanced.difference, 0);
  assert.equal(balanced.countedTotal, 5000);

  const short = compareDenominationCount({ 'note-1000': 4 }, 5000);
  assert.equal(short.status, 'shortage');
  assert.equal(short.difference, -1000);

  const over = compareDenominationCount({ 'note-1000': 6 }, 5000);
  assert.equal(over.status, 'surplus');
  assert.equal(over.difference, 1000);
  assert.equal(over.statusLabel, 'Surplus');
});

test('compare uses the same status words as the handover record', () => {
  for (const [counts, expected, status] of [
    [{ 'note-100': 1 }, 100, 'balanced'],
    [{ 'note-100': 1 }, 200, 'shortage'],
    [{ 'note-100': 3 }, 200, 'surplus'],
  ]) {
    assert.equal(compareDenominationCount(counts, expected).status, status);
  }
});

test('compare against zero expected when no receipts exist', () => {
  const result = compareDenominationCount({ 'note-100': 1 }, 0);
  assert.equal(result.status, 'surplus');
  assert.equal(result.difference, 100);
});

// ---- counted-total agreement (never auto-fixed) ----

test('matchesCounted is true only on exact agreement', () => {
  assert.equal(denominationCountMatchesCounted({ 'note-1000': 2 }, 2000), true);
  assert.equal(denominationCountMatchesCounted({ 'note-1000': 2 }, 2001), false);
  assert.equal(denominationCountMatchesCounted({ 'note-1000': 2 }, 1999), false);
});

test('attach returns a new record with every other field untouched', () => {
  const handover = { date: '2026-11-03', countedCash: 2000, expectedCash: 2500, variance: -500, status: 'shortage', notes: 'keep' };
  const attached = attachDenominationCountToHandover(handover, { 'note-1000': 2 });
  assert.notEqual(attached, handover);
  assert.equal(attached.countedCash, 2000);
  assert.equal(attached.expectedCash, 2500);
  assert.equal(attached.variance, -500);
  assert.equal(attached.status, 'shortage');
  assert.equal(attached.notes, 'keep');
  assert.equal(attached.denominationCount.total, 2000);
  assert.equal(handover.denominationCount, undefined);
});

test('attach with no count returns the record unchanged', () => {
  const handover = { date: '2026-11-03', countedCash: 100 };
  assert.equal(attachDenominationCountToHandover(handover, null), handover);
  assert.equal(attachDenominationCountToHandover(handover, undefined), handover);
  assert.equal(attachDenominationCountToHandover(null, { 'note-100': 1 }), null);
});

test('attach does not overwrite a disagreeing countedCash', () => {
  const attached = attachDenominationCountToHandover(
    { countedCash: 5000, expectedCash: 5000, variance: 0, status: 'balanced' },
    { 'note-1000': 2 },
  );
  assert.equal(attached.countedCash, 5000);
  assert.equal(attached.denominationCount.total, 2000);
  assert.equal(denominationCountMatchesCounted(attached.denominationCount, attached.countedCash), false);
});

// ---- summary text and html ----

test('summary text lists rows, total, pieces, and the signed difference', () => {
  const text = denominationCountSummaryText({ 'note-1000': 2, 'coin-5': 2 }, 2500);
  assert.match(text, /Rs\. 1,000 note x 2 = Rs\. 2,000/);
  assert.match(text, /Rs\. 5 coin x 2 = Rs\. 10/);
  assert.match(text, /Counted total: Rs\. 2,010 \(4 pieces\)/);
  assert.match(text, /difference: Rs\. -490 \[SHORTAGE\]/);
});

test('summary text without an expected figure shows no difference line', () => {
  const text = denominationCountSummaryText({ 'note-100': 1 });
  assert.match(text, /Counted total: Rs\. 100/);
  assert.equal(text.includes('difference'), false);
});

test('summary text reports ignored entries instead of hiding them', () => {
  const text = denominationCountSummaryText({ 'note-100': 1, 'note-2000': 2 });
  assert.match(text, /Ignored entries: note-2000/);
});

test('html sheet shows rows, total, and status, and escapes labels', () => {
  const html = denominationCountHtml({ 'note-500': 2 }, 1500);
  assert.match(html, /Rs\. 500 note/);
  assert.match(html, /Rs\. 1,000/);
  assert.match(html, /Shortage/);
  assert.match(html, /denomination-count-sheet/);
});

test('html for an empty sheet says no denominations were counted', () => {
  assert.match(denominationCountHtml({}), /No denominations counted/);
});

// ---- wiring: recordCashHandover audit note ----

test('handover recorded with a count stores the sheet and keeps totals, variance, and status', () => {
  const store = mockStorage();
  const res = recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 5000,
    countedCash: 4500,
    denominationCount: { 'note-1000': 4, 'note-500': 1 },
  }, store);
  assert.equal(res.success, true);
  assert.equal(res.record.countedCash, 4500);
  assert.equal(res.record.expectedCash, 5000);
  assert.equal(res.record.variance, -500);
  assert.equal(res.record.status, 'shortage');
  assert.equal(res.record.denominationCount.total, 4500);
  assert.deepEqual(res.record.denominationCount.rows.map((r) => r.id), ['note-1000', 'note-500']);

  const stored = getDailyCashHandovers(store, '2026-11-03');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].denominationCount.total, 4500);
  assert.equal(stored[0].countedCash, 4500);
});

test('handover recorded without a count has no denominationCount field at all', () => {
  const store = mockStorage();
  const res = recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 1000,
    countedCash: 1000,
  }, store);
  assert.equal(res.success, true);
  assert.equal('denominationCount' in res.record, false);
});

test('a count total that disagrees with countedCash is stored as-is, neither figure rewritten', () => {
  const store = mockStorage();
  const res = recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 5000,
    countedCash: 5000,
    denominationCount: { 'note-1000': 2 },
  }, store);
  assert.equal(res.success, true);
  assert.equal(res.record.countedCash, 5000);
  assert.equal(res.record.variance, 0);
  assert.equal(res.record.status, 'balanced');
  assert.equal(res.record.denominationCount.total, 2000);
});

test('correction without a new count keeps the old audit note; with one it replaces it', () => {
  const store = mockStorage();
  recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 2000,
    countedCash: 2000,
    denominationCount: { 'note-1000': 2 },
  }, store);

  const kept = recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 2000,
    countedCash: 2100,
    correctionReason: 'Recount',
  }, store);
  assert.equal(kept.success, true);
  assert.equal(kept.isCorrection, true);
  assert.equal(kept.record.denominationCount.total, 2000);
  assert.equal(kept.record.countedCash, 2100);

  const replaced = recordCashHandover({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 2000,
    countedCash: 2000,
    correctionReason: 'Recount with denominations',
    denominationCount: { 'note-500': 4 },
  }, store);
  assert.equal(replaced.record.denominationCount.total, 2000);
  assert.deepEqual(replaced.record.denominationCount.rows.map((r) => r.id), ['note-500']);
});

test('handover slip shows the denomination section only when a count is attached', () => {
  const withCount = generateHandoverSlipText({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 5000,
    countedCash: 4500,
    variance: -500,
    status: 'shortage',
    denominationCount: buildDenominationCount({ 'note-1000': 4, 'note-500': 1 }),
  });
  assert.match(withCount, /DENOMINATION COUNT/);
  assert.match(withCount, /Rs\. 1,000 note x 4 = Rs\. 4,000/);
  assert.match(withCount, /Counted total: Rs\. 4,500/);
  assert.match(withCount, /Physical Counted: PKR 4,500/);

  const withoutCount = generateHandoverSlipText({
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 5000,
    countedCash: 5000,
    variance: 0,
    status: 'balanced',
  });
  assert.equal(withoutCount.includes('DENOMINATION COUNT'), false);
});
