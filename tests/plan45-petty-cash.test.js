/**
 * plan45-petty-cash.test.js — Plan 45: petty cash and field advance log.
 * Pins:
 * - each advance shows amount given, spends against it, and a
 *   remaining balance that sums correctly on the same fixture;
 * - a spend can only be recorded against an open advance;
 * - closing an advance requires its spends accounted for: zero
 *   remaining, the remaining cash returned, or an operator-recorded
 *   reason for the shortfall — anything else leaves it open;
 * - impossible dates (2026-02-30) and non-positive amounts are
 *   refused, never stored half-formed; a blank mohalla stays
 *   unrecorded, never guessed;
 * - the log never touches a customer payment, bill, or the daily
 *   drawer: it holds no payment, bill, denomination, or drawer
 *   field, and inputs are never mutated.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPettyDate,
  normalizeAdvance,
  normalizeSpend,
  upsertAdvance,
  recordSpend,
  buildAdvanceSummaries,
  closeAdvance,
  pettyCashSummaryText,
  pettyCashHtml,
  pettyCashCsv,
  pettyCashFilename,
} from '../petty-cash.js';

const ADV = { id: 'adv-1', holder: 'Saad', amountGiven: 5000, dateGiven: '2026-11-01', note: 'field week' };

test('advance validation: blank holder, bad amount, impossible date rejected', () => {
  assert.equal(normalizeAdvance({ ...ADV, holder: '  ' }), null);
  assert.equal(normalizeAdvance({ ...ADV, amountGiven: 0 }), null);
  assert.equal(normalizeAdvance({ ...ADV, amountGiven: -100 }), null);
  assert.equal(normalizeAdvance({ ...ADV, amountGiven: 'abc' }), null);
  assert.equal(normalizeAdvance({ ...ADV, dateGiven: '2026-02-30' }), null);
  assert.equal(normalizeAdvance({ ...ADV, id: '' }), null);
  assert.equal(normalizeAdvance({ ...ADV, amountGiven: 5000.50 }).amountGiven, 5000.50);
  assert.equal(isValidPettyDate('2026-02-30'), false);
  assert.equal(isValidPettyDate('2026-11-01'), true);
});

test('spend validation: blank purpose, bad date, non-positive amount rejected', () => {
  assert.notEqual(normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 800 }), null);
  assert.equal(normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: '  ', amount: 800 }), null);
  assert.equal(normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-02-30', purpose: 'cable', amount: 800 }), null);
  assert.equal(normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 0 }), null);
  assert.equal(normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: -50 }), null);
  assert.equal(normalizeSpend({ id: 's1', advanceId: '', date: '2026-11-02', purpose: 'cable', amount: 800 }), null);
});

test('blank mohalla stays null, never guessed', () => {
  const spend = normalizeSpend({ id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 800 });
  assert.equal(spend.mohalla, null);
  const named = normalizeSpend({ id: 's2', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', mohalla: 'Bani', amount: 800 });
  assert.equal(named.mohalla, 'Bani');
});

test('given, spent, remaining sum exactly on one fixture (cents, no float drift)', () => {
  let advances = upsertAdvance([], ADV);
  let spends = [];
  let r = recordSpend(advances, spends, { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable roll', mohalla: 'Bani', amount: 1200.10 });
  assert.equal(r.accepted, true);
  spends = r.spends;
  r = recordSpend(advances, spends, { id: 's2', advanceId: 'adv-1', date: '2026-11-03', purpose: 'connectors', amount: 349.90 });
  spends = r.spends;
  const [summary] = buildAdvanceSummaries(advances, spends);
  assert.equal(summary.amountGiven, 5000);
  assert.equal(summary.spent, 1550);
  assert.equal(summary.remaining, 3450);
  assert.equal(summary.spendCount, 2);
});

test('spend against unknown advance refused, lists unchanged', () => {
  const advances = upsertAdvance([], ADV);
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'nope', date: '2026-11-02', purpose: 'cable', amount: 100 });
  assert.equal(r.accepted, false);
  assert.deepEqual(r.spends, []);
});

test('spend against a closed advance refused', () => {
  let advances = upsertAdvance([], ADV);
  const closed = closeAdvance(advances, [], 'adv-1', { reason: 'all spent, no cash left to return' });
  assert.equal(closed.closed, true);
  advances = closed.advances;
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 100 });
  assert.equal(r.accepted, false);
});

test('spend against an advance with zero remaining but still open is allowed and goes negative honestly', () => {
  const advances = upsertAdvance([], { ...ADV, amountGiven: 500 });
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 700 });
  assert.equal(r.accepted, true);
  const [summary] = buildAdvanceSummaries(advances, r.spends);
  assert.equal(summary.remaining, -200);
  assert.equal(summary.overspent, true);
});

test('closing with zero remaining closes clean', () => {
  const advances = upsertAdvance([], { ...ADV, amountGiven: 1000 });
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 1000 });
  const closed = closeAdvance(advances, r.spends, 'adv-1', {});
  assert.equal(closed.closed, true);
  assert.equal(closed.advances[0].status, 'closed');
  assert.equal(closed.advances[0].closeReason, null);
});

test('closing with unaccounted remaining and no reason refused, list unchanged', () => {
  const advances = upsertAdvance([], ADV);
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 1200 });
  const attempt = closeAdvance(advances, r.spends, 'adv-1', {});
  assert.equal(attempt.closed, false);
  assert.match(attempt.reason, /unaccounted/);
  assert.equal(attempt.advances[0].status, 'open');
});

test('closing with the remaining cash returned closes and records the return', () => {
  const advances = upsertAdvance([], ADV);
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 1200 });
  const closed = closeAdvance(advances, r.spends, 'adv-1', { returnedAmount: 3800, closedDate: '2026-11-05' });
  assert.equal(closed.closed, true);
  assert.equal(closed.advances[0].returnedAmount, 3800);
  assert.equal(closed.advances[0].closedDate, '2026-11-05');
});

test('closing with a recorded reason for the shortfall closes', () => {
  const advances = upsertAdvance([], ADV);
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 1200 });
  const closed = closeAdvance(advances, r.spends, 'adv-1', { reason: 'Rs. 3800 bus fare receipts lost, owner accepted' });
  assert.equal(closed.closed, true);
  assert.equal(closed.advances[0].closeReason, 'Rs. 3800 bus fare receipts lost, owner accepted');
});

test('returned amount above remaining, negative, or non-numeric refused', () => {
  const advances = upsertAdvance([], ADV);
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 1200 });
  assert.equal(closeAdvance(advances, r.spends, 'adv-1', { returnedAmount: 3801 }).closed, false);
  assert.equal(closeAdvance(advances, r.spends, 'adv-1', { returnedAmount: -10 }).closed, false);
  assert.equal(closeAdvance(advances, r.spends, 'adv-1', { returnedAmount: 'abc' }).closed, false);
});

test('overspend can only close with a reason', () => {
  const advances = upsertAdvance([], { ...ADV, amountGiven: 500 });
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 700 });
  assert.equal(closeAdvance(advances, r.spends, 'adv-1', {}).closed, false);
  assert.equal(closeAdvance(advances, r.spends, 'adv-1', { reason: 'emergency splice, owner approved extra' }).closed, true);
});

test('closing an unknown or already-closed advance refused', () => {
  const advances = upsertAdvance([], ADV);
  assert.equal(closeAdvance(advances, [], 'missing', {}).closed, false);
  const closed = closeAdvance(advances, [], 'adv-1', { reason: 'done' });
  assert.equal(closeAdvance(closed.advances, [], 'adv-1', { reason: 'again' }).closed, false);
});

test('upsert last wins per advance id; bad upsert leaves list unchanged', () => {
  let list = upsertAdvance([], ADV);
  list = upsertAdvance(list, { ...ADV, amountGiven: 6000 });
  assert.equal(list.length, 1);
  assert.equal(list[0].amountGiven, 6000);
  assert.equal(upsertAdvance(list, { ...ADV, amountGiven: 0 }).length, 1);
  assert.equal(upsertAdvance(list, { ...ADV, amountGiven: 0 })[0].amountGiven, 6000);
});

test('summaries sort open first, then most recent given date, then holder', () => {
  let list = upsertAdvance([], { ...ADV, id: 'a-old', dateGiven: '2026-10-01' });
  list = upsertAdvance(list, { ...ADV, id: 'a-new', holder: 'Aqib', dateGiven: '2026-11-01' });
  const closed = closeAdvance(list, [], 'a-new', { reason: 'done' });
  const summaries = buildAdvanceSummaries(closed.advances, []);
  assert.deepEqual(summaries.map((s) => s.id), ['a-old', 'a-new']);
});

test('inputs are never mutated', () => {
  const advances = upsertAdvance([], ADV);
  const spends = [];
  const before = JSON.stringify(advances);
  recordSpend(advances, spends, { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable', amount: 100 });
  closeAdvance(advances, spends, 'adv-1', { reason: 'done' });
  buildAdvanceSummaries(advances, spends);
  assert.equal(JSON.stringify(advances), before);
});

test('module holds no payment, bill, drawer, or denomination field', () => {
  const summaries = buildAdvanceSummaries(upsertAdvance([], ADV), []);
  const keys = Object.keys(summaries[0]).join(' ');
  assert.doesNotMatch(keys, /payment|bill|drawer|denomination|waada/i);
  assert.equal('payment' in summaries[0], false);
});

test('summary text, HTML escaping, CSV quoting, filename', () => {
  const advances = upsertAdvance([], { ...ADV, holder: 'Saad <b>& "co"' });
  const r = recordSpend(advances, [], { id: 's1', advanceId: 'adv-1', date: '2026-11-02', purpose: 'cable, "premium"', amount: 1200 });
  const summaries = buildAdvanceSummaries(advances, r.spends);
  assert.match(pettyCashSummaryText(summaries), /1 open/);
  assert.match(pettyCashSummaryText(summaries), /remaining/);
  const html = pettyCashHtml(summaries);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /mohalla not recorded/);
  const csv = pettyCashCsv(summaries);
  assert.doesNotMatch(csv, /cable/); // spends live in the panel view, not in the advance CSV rows
  assert.match(csv, /adv-1/);
  assert.equal(pettyCashFilename(), 'petty-cash-advances.csv');
  assert.match(pettyCashHtml([]), /No advances recorded yet/);
});
