/**
 * plan86-hold-guard.test.js — Plan 86: hold history and fair-use
 * guard (limits, visible, operator-set).
 * Pins:
 * - one history entry per Plan 82 hold and Plan 85 move pause,
 *   in date order, with its reason and billing treatment;
 * - three operator-set limits (maximum hold length, maximum
 *   holds per customer per year, minimum active period between
 *   holds); unset, zero, negative, and non-numeric limits are
 *   unset, never zero;
 * - a new hold over a limit shows the limit and cannot be
 *   saved until an operator-recorded reason exists; with a
 *   reason recorded it may proceed;
 * - guardrail settings and history views never alter any bill,
 *   payment, or hold record, so the module holds no such field;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, or hold record is ever
 * changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validGuardDate,
  guardMohallaKey,
  buildHoldHistory,
  historyForCustomer,
  normalizeGuardSettings,
  guardSettingsText,
  checkNewHold,
  guardCheckText,
  normalizeOverride,
  upsertOverride,
  removeOverride,
  holdHistoryHtml,
  holdHistoryCsv,
  holdHistoryFilename,
  overrideHtml,
} from '../hold-guard.js';

function hold(overrides = {}) {
  return {
    id: 'H1',
    customerId: 'C1',
    customerName: 'Ayesha',
    startDate: '2026-01-05',
    expectedReturnDate: '2026-02-05',
    reason: 'away',
    treatment: 'no_bill',
    status: 'ended',
    actualReturnDate: '2026-02-05',
    mohalla: 'Bani',
    ...overrides,
  };
}

function move(overrides = {}) {
  return {
    id: 'M1',
    customerId: 'C1',
    customerName: 'Ayesha',
    oldMohalla: 'Bani',
    oldAddress: 'Gali 1',
    newMohalla: 'Kishti',
    newAddress: 'Gali 9',
    pauseStartDate: '2026-03-01',
    expectedReconnectDate: '2026-03-20',
    treatment: 'no_bill',
    status: 'reconnected',
    actualReconnectDate: '2026-03-18',
    ...overrides,
  };
}

test('strict dates: impossible dates are not dates', () => {
  assert.equal(validGuardDate('2026-02-30'), null);
  assert.equal(validGuardDate('not-a-date'), null);
  assert.equal(validGuardDate('2026-01-05'), '2026-01-05');
});

test('history merges holds and moves in date order with reason and treatment', () => {
  const history = buildHoldHistory(
    [hold({ id: 'H2', startDate: '2026-04-01', expectedReturnDate: '2026-04-10', status: 'active', actualReturnDate: '' })],
    [move()],
  );
  assert.equal(history.length, 2);
  assert.equal(history[0].kind, 'move');
  assert.equal(history[0].reason, 'move');
  assert.equal(history[1].kind, 'hold');
  assert.equal(history[1].reason, 'away');
  assert.equal(history[1].treatment, 'no_bill');
});

test('history drops half-formed records and keeps ended history', () => {
  const history = buildHoldHistory(
    [
      hold(),
      hold({ id: 'BAD', startDate: '2026-02-30', expectedReturnDate: '2026-03-01' }),
      hold({ id: 'BAD2', startDate: '2026-01-01', expectedReturnDate: '2026-01-01' }),
    ],
    [],
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].id, 'H1');
  assert.equal(history[0].endDate, '2026-02-05');
});

test('history is per customer only', () => {
  const history = buildHoldHistory([hold(), hold({ id: 'H9', customerId: 'C2' })], []);
  const mine = historyForCustomer(history, 'C1');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, 'H1');
  assert.deepEqual(historyForCustomer(history, 'C9'), []);
});

test('settings: positive limits kept, zero/negative/non-numeric unset', () => {
  assert.deepEqual(normalizeGuardSettings({ maxHoldDays: 30, maxHoldsPerYear: 2, minActiveDays: 14 }), {
    maxHoldDays: 30,
    maxHoldsPerYear: 2,
    minActiveDays: 14,
  });
  assert.deepEqual(normalizeGuardSettings({ maxHoldDays: 0, maxHoldsPerYear: -1, minActiveDays: 'soon' }), {
    maxHoldDays: null,
    maxHoldsPerYear: null,
    minActiveDays: null,
  });
  assert.deepEqual(normalizeGuardSettings(null), { maxHoldDays: null, maxHoldsPerYear: null, minActiveDays: null });
  assert.match(guardSettingsText({ maxHoldDays: 30 }), /maximum hold length 30 days/);
});

test('maximum hold length: exactly at the limit passes, one day over is exceeded', () => {
  const settings = { maxHoldDays: 30, maxHoldsPerYear: null, minActiveDays: null };
  const atLimit = checkNewHold({ history: [], startDate: '2026-01-01', expectedReturnDate: '2026-01-31', settings, overrideReason: '' });
  assert.equal(atLimit.allowed, true);
  assert.equal(atLimit.exceeded.length, 0);
  const over = checkNewHold({ history: [], startDate: '2026-01-01', expectedReturnDate: '2026-02-01', settings, overrideReason: '' });
  assert.equal(over.allowed, false);
  assert.equal(over.exceeded[0].limit, 'maxHoldDays');
  assert.match(over.message, /maximum of 30 days/);
});

test('maximum holds per year: only the same year counts', () => {
  const history = buildHoldHistory(
    [hold({ id: 'H2025', startDate: '2025-01-05', expectedReturnDate: '2025-02-05', actualReturnDate: '2025-02-05' }), hold({ id: 'H2026', startDate: '2026-01-05', expectedReturnDate: '2026-02-05' })],
    [],
  );
  const settings = { maxHoldDays: null, maxHoldsPerYear: 2, minActiveDays: null };
  const check = checkNewHold({ history: historyForCustomer(history, 'C1'), startDate: '2026-06-01', expectedReturnDate: '2026-06-10', settings, overrideReason: '' });
  assert.equal(check.allowed, true);
  const third = checkNewHold({
    history: buildHoldHistory([hold(), hold({ id: 'H2', startDate: '2026-03-01', expectedReturnDate: '2026-03-10', actualReturnDate: '2026-03-10' })], []),
    startDate: '2026-06-01', expectedReturnDate: '2026-06-10', settings, overrideReason: '',
  });
  assert.equal(third.allowed, false);
  assert.equal(third.exceeded[0].limit, 'maxHoldsPerYear');
});

test('minimum active period: exactly the gap passes, one day short is exceeded', () => {
  const history = buildHoldHistory([hold()], []);
  const settings = { maxHoldDays: null, maxHoldsPerYear: null, minActiveDays: 14 };
  const ok = checkNewHold({ history, startDate: '2026-02-19', expectedReturnDate: '2026-02-25', settings, overrideReason: '' });
  assert.equal(ok.allowed, true);
  const short = checkNewHold({ history, startDate: '2026-02-18', expectedReturnDate: '2026-02-25', settings, overrideReason: '' });
  assert.equal(short.allowed, false);
  assert.equal(short.exceeded[0].limit, 'minActiveDays');
  assert.match(short.message, /13 active days/);
});

test('overlapping hold is caught by the active-period rule', () => {
  const history = buildHoldHistory([hold({ status: 'active', actualReturnDate: '' })], []);
  const settings = { maxHoldDays: null, maxHoldsPerYear: null, minActiveDays: 7 };
  const check = checkNewHold({ history, startDate: '2026-01-20', expectedReturnDate: '2026-01-30', settings, overrideReason: '' });
  assert.equal(check.allowed, false);
  assert.ok(check.exceeded.some((item) => item.limit === 'minActiveDays'));
});

test('exceeding a limit without a recorded reason is not possible; with a reason it may proceed', () => {
  const settings = { maxHoldDays: 10, maxHoldsPerYear: null, minActiveDays: null };
  const blocked = checkNewHold({ history: [], startDate: '2026-01-01', expectedReturnDate: '2026-02-01', settings, overrideReason: '' });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.needsOverrideReason, true);
  assert.match(blocked.message, /cannot be saved until an override reason is recorded/);
  const allowed = checkNewHold({ history: [], startDate: '2026-01-01', expectedReturnDate: '2026-02-01', settings, overrideReason: 'Family wedding abroad, owner approved' });
  assert.equal(allowed.allowed, true);
  assert.match(allowed.message, /override reason is recorded/);
});

test('invalid proposed hold cannot be checked', () => {
  const check = checkNewHold({ history: [], startDate: '2026-02-30', expectedReturnDate: '2026-03-01', settings: {}, overrideReason: '' });
  assert.equal(check.valid, false);
  assert.equal(check.allowed, false);
  assert.equal(guardCheckText(check), 'A hold needs a start date and an expected return date after it before the guardrails can be checked.');
});

test('override log: half-formed overrides refused, upsert and remove work', () => {
  const good = normalizeOverride({
    id: 'O1', customerId: 'C1', startDate: '2026-01-01', expectedReturnDate: '2026-02-01',
    reason: 'Family wedding abroad, owner approved', limits: ['maxHoldDays'], recordedDate: '2026-01-01',
  });
  assert.ok(good);
  assert.equal(normalizeOverride({ ...good, reason: '' }), null);
  assert.equal(normalizeOverride({ ...good, startDate: '2026-02-30' }), null);
  const list = upsertOverride([], good);
  assert.equal(list.length, 1);
  assert.equal(upsertOverride(list, { ...good, reason: 'Updated reason' })[0].reason, 'Updated reason');
  assert.deepEqual(removeOverride(list, 'O1'), []);
  assert.ok(overrideHtml(list).includes('Family wedding abroad'));
});

test('inputs are never mutated', () => {
  const history = buildHoldHistory([hold()], []);
  const before = JSON.stringify(history);
  checkNewHold({ history, startDate: '2026-06-01', expectedReturnDate: '2026-06-10', settings: { maxHoldDays: 30 }, overrideReason: '' });
  assert.equal(JSON.stringify(history), before);
});

test('mohalla canonical keys mirror Plan 82', () => {
  assert.equal(guardMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(guardMohallaKey('bani'), 'BANII');
});

test('no ledger fields: history entries carry no bill, payment, package, or deposit field', () => {
  const entry = buildHoldHistory([hold()], [move()])[0];
  for (const key of Object.keys(entry)) {
    assert.ok(!/bill|payment|package|deposit/i.test(key), `unexpected ledger field ${key}`);
  }
  const source = readFileSync(new URL('../hold-guard.js', import.meta.url), 'utf8');
  assert.ok(!/createBill|createPayment|deleteHold|rewriteHold|alterHold/.test(source));
});

test('html escaping, csv quoting, and filename', () => {
  const row = buildHoldHistory([hold({ id: 'H<b>&"Q"' })], [])[0];
  assert.ok(!holdHistoryHtml([row]).includes('<b>'));
  assert.ok(holdHistoryHtml([row]).includes('&lt;b&gt;'));
  const csv = holdHistoryCsv([buildHoldHistory([hold({ customerName: 'Gali "9", Kishti' })], [])[0]]);
  assert.ok(csv.includes('"Gali ""9"", Kishti"'));
  assert.equal(holdHistoryFilename(), 'hold-history.csv');
});
