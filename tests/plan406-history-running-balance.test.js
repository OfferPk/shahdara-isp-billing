// Plan 406 — History running balance after each transaction: a
// history list shows amounts but never the balance after each one,
// so a customer cannot see the moment their dues became zero — or
// the moment they went behind. One running-balance column on the
// customer history (balance after each transaction, computed from
// the same entries in order). It is a view only: it recomputes
// nothing stored, and it never changes any bill, payment,
// roll-forward, or customer record by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_RUNNING_BALANCE_EMPTY_TEXT,
  historyRunningBalanceExpectedDelta,
  historyRunningBalanceRows,
  historyRunningBalanceChainCheck,
  formatRunningBalanceAmount,
  historyRunningBalanceNote,
  historyRunningBalanceFinal,
  historyRunningBalanceMatchesDues,
  historyRunningBalanceLineText,
  historyRunningBalanceSummaryText,
  historyRunningBalanceColumnHtml,
} from '../history-running-balance.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-09-15', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash', ...overrides };
}

// A full chain, balances hand-computed step by step:
// charge 300000 -> 300000; pay 150000 -> 150000; pay 150000 -> 0;
// charge 300000 -> 300000; advance 50000 -> 250000; credit
// (overpayment) 50000 -> 250000; credit (adjustment) 20000 -> 230000;
// refund 20000 -> 250000; adjustment 30000 -> 220000; voided pay
// 300000 -> 220000.
function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 300000, runningBalanceCents: 300000, method: '', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash', ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-09-20', amountCents: 150000, runningBalanceCents: 0, method: 'JazzCash', ref: 'PAY-2' }),
    entry({ type: 'charge', date: '2026-10-01', amountCents: 300000, runningBalanceCents: 300000, method: '', ref: 'BILL-2' }),
    entry({ type: 'advance', date: '2026-10-05', amountCents: 50000, runningBalanceCents: 250000, method: 'Easypaisa', ref: 'PAY-3' }),
    entry({ type: 'credit', date: '2026-10-06', amountCents: 50000, runningBalanceCents: 250000, method: '', ref: 'CR-1', source: 'overpayment' }),
    entry({ type: 'credit', date: '2026-10-07', amountCents: 20000, runningBalanceCents: 230000, method: '', ref: 'CR-2', source: 'adjustment' }),
    entry({ type: 'refund', date: '2026-10-20', amountCents: 20000, runningBalanceCents: 250000, method: 'Raast', ref: 'RF-1' }),
    entry({ type: 'adjustment', date: '2026-10-25', amountCents: 30000, runningBalanceCents: 220000, method: '', ref: 'ADJ-1' }),
    entry({ type: 'payment', date: '2026-11-03', amountCents: 300000, runningBalanceCents: 220000, method: 'Cash', ref: 'PAY-4', voided: true }),
  ];
}

// --- Signed movement ---

test('Plan 406: charges and refunds add to what is owed', () => {
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'charge', amountCents: 300000 })), 300000);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'refund', amountCents: 20000 })), 20000);
});

test('Plan 406: payments, advances and adjustments reduce what is owed', () => {
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: 150000 })), -150000);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'advance', amountCents: 50000 })), -50000);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'adjustment', amountCents: 30000 })), -30000);
});

test('Plan 406: an overpayment credit moves nothing, an adjustment credit reduces what is owed', () => {
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'credit', amountCents: 50000, source: 'overpayment' })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'credit', amountCents: 20000, source: 'adjustment' })), -20000);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'credit', amountCents: 20000 })), 0);
});

test('Plan 406: a voided entry is listed but moves nothing', () => {
  for (const type of ['charge', 'payment', 'advance', 'credit', 'refund', 'adjustment']) {
    assert.equal(historyRunningBalanceExpectedDelta(entry({ type, amountCents: 100000, voided: true })), 0, type);
  }
});

test('Plan 406: unknown types and missing or non-finite amounts move nothing, never zero-filled', () => {
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'mystery', amountCents: 100000 })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: null })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: undefined })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: '' })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: true })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(entry({ type: 'payment', amountCents: 'abc' })), 0);
  assert.equal(historyRunningBalanceExpectedDelta(null), 0);
  assert.equal(historyRunningBalanceExpectedDelta('payment'), 0);
});

// --- Column rows ---

test('Plan 406: every row checks out from the line above it — previous plus movement equals balance after', () => {
  const rows = historyRunningBalanceRows(mixedEntries());
  assert.equal(rows.length, 10);
  for (const row of rows) {
    assert.equal(row.previousBalanceCents + row.deltaCents, row.balanceAfterCents, `row ${row.index}`);
  }
});

test('Plan 406: rows carry the hand-computed balances, opening from zero', () => {
  const rows = historyRunningBalanceRows(mixedEntries());
  assert.deepEqual(rows.map((row) => row.balanceAfterCents), [300000, 150000, 0, 300000, 250000, 250000, 230000, 250000, 220000, 220000]);
  assert.deepEqual(rows.map((row) => row.previousBalanceCents), [0, 300000, 150000, 0, 300000, 250000, 250000, 230000, 250000, 220000]);
  assert.equal(rows[0].previousBalanceCents, 0);
  assert.equal(rows[2].balanceAfterCents, 0);
});

test('Plan 406: a voided row keeps the balance of the row above it', () => {
  const rows = historyRunningBalanceRows(mixedEntries());
  assert.equal(rows[9].voided, true);
  assert.equal(rows[9].deltaCents, 0);
  assert.equal(rows[9].balanceAfterCents, rows[8].balanceAfterCents);
  assert.equal(rows[9].previousBalanceCents, rows[8].balanceAfterCents);
});

test('Plan 406: a filtered view still shows the true balance before each shown row', () => {
  const entries = mixedEntries();
  const shown = [entries[2]];
  const rows = historyRunningBalanceRows(shown);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].balanceAfterCents, 0);
  assert.equal(rows[0].deltaCents, -150000);
  assert.equal(rows[0].previousBalanceCents, 150000);
});

test('Plan 406: building rows never mutates the entries given', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  historyRunningBalanceRows(entries);
  historyRunningBalanceColumnHtml(entries, entries);
  historyRunningBalanceChainCheck(entries);
  assert.equal(JSON.stringify(entries), before);
  const frozen = Object.freeze(mixedEntries().map((row) => Object.freeze(row)));
  assert.equal(historyRunningBalanceRows(frozen).length, 10);
});

test('Plan 406: non-array or empty input builds no rows', () => {
  assert.deepEqual(historyRunningBalanceRows([]), []);
  assert.deepEqual(historyRunningBalanceRows(null), []);
  assert.deepEqual(historyRunningBalanceRows('history'), []);
});

// --- Chain check ---

test('Plan 406: the chain check passes on a correct chain and names the step count', () => {
  const check = historyRunningBalanceChainCheck(mixedEntries());
  assert.equal(check.ok, true);
  assert.equal(check.badIndex, -1);
  assert.equal(check.expectedCents, 220000);
  assert.equal(check.actualCents, 220000);
  assert.ok(check.message.includes('10'));
});

test('Plan 406: the chain check names the first row whose balance does not follow the row above it', () => {
  const entries = mixedEntries();
  entries[4].runningBalanceCents = 240000;
  const check = historyRunningBalanceChainCheck(entries);
  assert.equal(check.ok, false);
  assert.equal(check.badIndex, 4);
  assert.equal(check.expectedCents, 250000);
  assert.equal(check.actualCents, 240000);
  assert.ok(check.message.includes('PKR 2,500'));
});

test('Plan 406: the chain check passes on an empty history', () => {
  const check = historyRunningBalanceChainCheck([]);
  assert.equal(check.ok, true);
  assert.equal(check.badIndex, -1);
});

// --- Formatting and notes ---

test('Plan 406: amounts print with no decimals for whole rupees and one decimal for paisa', () => {
  assert.equal(formatRunningBalanceAmount(150000), 'PKR 1,500');
  assert.equal(formatRunningBalanceAmount(150050), 'PKR 1,500.5');
  assert.equal(formatRunningBalanceAmount(0), 'PKR 0');
  assert.equal(formatRunningBalanceAmount(-220000), '-PKR 2,200');
  // Sharafat 13: a figure the list cannot read used to print 'PKR 0',
  // inventing money out of nothing. The repo money rule is
  // null/undefined/empty/boolean = "not a number", never zero — so it
  // prints the bare dash, the same rendering receipt-money.js uses.
  // A real zero still prints 'PKR 0'.
  assert.equal(formatRunningBalanceAmount(null), '—');
  assert.equal(formatRunningBalanceAmount('abc'), '—');
});

test('Plan 406: the balance note says settled, still owed, or credit in plain words', () => {
  assert.equal(historyRunningBalanceNote(0), 'Settled');
  assert.equal(historyRunningBalanceNote(220000), 'Still owed PKR 2,200');
  assert.equal(historyRunningBalanceNote(-50000), 'Credit PKR 500');
  assert.equal(historyRunningBalanceNote(null), 'Settled');
});

// --- Final balance matches current dues ---

test('Plan 406: the final running balance is the balance after the last entry, zero when empty', () => {
  assert.equal(historyRunningBalanceFinal(mixedEntries()), 220000);
  assert.equal(historyRunningBalanceFinal([]), 0);
  assert.equal(historyRunningBalanceFinal(null), 0);
});

test('Plan 406: the final running balance matches the customer current dues on the same fixture', () => {
  // Same fixture, dues worked out by hand from the bills and
  // payments: charges 3000 + 3000, less payments 1500 + 1500, less
  // advance 500, less adjustment credit 200, plus refund 200, less
  // adjustment 300 — dues 2200. The voided payment and the
  // overpayment credit move nothing.
  const duesCents = (300000 + 300000) - (150000 + 150000) - 50000 - 20000 + 20000 - 30000;
  assert.equal(duesCents, 220000);
  const match = historyRunningBalanceMatchesDues(mixedEntries(), duesCents);
  assert.equal(match.finalCents, 220000);
  assert.equal(match.duesCents, 220000);
  assert.equal(match.matches, true);
  assert.ok(match.text.includes('matches current dues'));
});

test('Plan 406: a final balance that does not match the dues says so plainly', () => {
  const match = historyRunningBalanceMatchesDues(mixedEntries(), 230000);
  assert.equal(match.matches, false);
  assert.ok(match.text.includes('does not match'));
  assert.ok(match.text.includes('PKR 2,200'));
  assert.ok(match.text.includes('PKR 2,300'));
  const missing = historyRunningBalanceMatchesDues(mixedEntries(), null);
  assert.equal(missing.matches, false);
  assert.ok(missing.text.includes('not recorded'));
});

// --- Line and summary text ---

test('Plan 406: each row reads as one checkable line — date, transaction, amount, balance after, balance before', () => {
  const rows = historyRunningBalanceRows(mixedEntries());
  assert.equal(
    historyRunningBalanceLineText(rows[1]),
    '2026-09-15 · Payment · PKR 1,500 · Balance after PKR 1,500 (was PKR 3,000)',
  );
  assert.equal(
    historyRunningBalanceLineText(rows[2]),
    '2026-09-20 · Payment · PKR 1,500 · Balance after PKR 0 (was PKR 1,500)',
  );
  assert.ok(historyRunningBalanceLineText(rows[9]).includes(' · VOID'));
  assert.ok(historyRunningBalanceLineText({ ...rows[0], date: '' }).includes('date not recorded'));
  assert.equal(historyRunningBalanceLineText(null), '');
});

test('Plan 406: the summary counts the steps and names the final balance in plain words', () => {
  assert.equal(
    historyRunningBalanceSummaryText(mixedEntries()),
    '10 steps · Final balance PKR 2,200 · Still owed PKR 2,200',
  );
  assert.equal(
    historyRunningBalanceSummaryText([entry({ type: 'charge', amountCents: 300000, runningBalanceCents: 0 })]),
    '1 step · Final balance PKR 0 · Settled',
  );
  assert.equal(historyRunningBalanceSummaryText([]), HISTORY_RUNNING_BALANCE_EMPTY_TEXT);
});

// --- Column HTML ---

test('Plan 406: the column has a header and one row per shown entry, in the same order', () => {
  const html = historyRunningBalanceColumnHtml(mixedEntries(), mixedEntries());
  assert.ok(html.includes('<th>Date</th>'));
  assert.ok(html.includes('<th>Transaction</th>'));
  assert.ok(html.includes('Amount</th>'));
  assert.ok(html.includes('Balance after</th>'));
  assert.ok(html.includes('2026-09-01'));
  assert.ok(html.includes('2026-11-03'));
  assert.ok(html.indexOf('2026-09-01') < html.indexOf('2026-09-15'));
  assert.ok(html.indexOf('2026-10-25') < html.indexOf('2026-11-03'));
  assert.ok(html.includes('PKR 2,200'));
  assert.ok(html.includes(' · VOID'));
  assert.ok(html.includes('Final balance'));
});

test('Plan 406: the footer carries the full-history final balance even when the view is filtered', () => {
  const entries = mixedEntries();
  const shown = [entries[0], entries[1]];
  const html = historyRunningBalanceColumnHtml(shown, entries);
  assert.ok(html.includes('Final balance (full history)'));
  assert.ok(html.includes('PKR 2,200'));
  const unfiltered = historyRunningBalanceColumnHtml(entries, entries);
  assert.ok(unfiltered.includes('Final balance</strong>'));
  assert.equal(unfiltered.includes('(full history)'), false);
});

test('Plan 406: the column marks an owed balance due and a settled balance settled', () => {
  const owed = historyRunningBalanceColumnHtml([entry({ type: 'charge', amountCents: 300000, runningBalanceCents: 300000 })]);
  assert.ok(owed.includes('balance-num is-due'));
  const settled = historyRunningBalanceColumnHtml([entry({ type: 'payment', amountCents: 150000, runningBalanceCents: 0 })]);
  assert.ok(settled.includes('balance-num is-settled'));
});

test('Plan 406: an empty shown list renders nothing, and entry text is escaped', () => {
  assert.equal(historyRunningBalanceColumnHtml([], mixedEntries()), '');
  assert.equal(historyRunningBalanceColumnHtml(null), '');
  const hostile = historyRunningBalanceColumnHtml([
    entry({ type: 'payment', date: '2026-09-15<script>', amountCents: 150000, runningBalanceCents: 0 }),
  ]);
  assert.equal(hostile.includes('<script>'), false);
  assert.ok(hostile.includes('&lt;script&gt;'));
});

// --- Fences and guards ---

test('Plan 406: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../history-running-balance.js', import.meta.url), 'utf8');
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  const rollForwardModule = 'balance-roll' + 'forward.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const methodFilterModule = 'history-method-' + 'filter.js';
  const amountSearchModule = 'history-amount-' + 'search.js';
  for (const fenced of [rollForwardModule, fullHistoryModule, typeFilterModule, rangeFilterModule, methodFilterModule, amountSearchModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 406: the module imports nothing, keeps no store, and touches no live state', () => {
  const moduleSrc = readFileSync(new URL('../history-running-balance.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 406: the fenced neighbours contain no running-balance column references', () => {
  const rollForwardModule = 'balance-roll' + 'forward.js';
  const fullHistoryModule = 'full-history-' + 'list.js';
  const typeFilterModule = 'history-type-' + 'filter.js';
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const methodFilterModule = 'history-method-' + 'filter.js';
  const amountSearchModule = 'history-amount-' + 'search.js';
  for (const fenced of [rollForwardModule, fullHistoryModule, typeFilterModule, rangeFilterModule, methodFilterModule, amountSearchModule]) {
    const src = readFileSync(new URL(`../${fenced}`, import.meta.url), 'utf8');
    assert.equal(src.includes('historyRunningBalance'), false, fenced);
    assert.equal(src.includes('runningBalanceColumn'), false, fenced);
  }
});

test('Plan 406: the monthly roll-forward proof view still exists and is still wired, untouched', () => {
  const rollForwardModule = 'balance-roll' + 'forward.js';
  const rollSrc = readFileSync(new URL(`../${rollForwardModule}`, import.meta.url), 'utf8');
  assert.ok(rollSrc.includes('buildCustomerRollForward'));
  assert.ok(rollSrc.includes('buildRollForwardTotals'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${rollForwardModule}'`));
  assert.ok(appSrc.includes('buildCustomerRollForward'));
});

test('Plan 406: the full history list and its filters still exist and are still wired, untouched', () => {
  const fullHistoryModule = 'full-history-' + 'list.js';
  const historySrc = readFileSync(new URL(`../${fullHistoryModule}`, import.meta.url), 'utf8');
  assert.ok(historySrc.includes('FULL_HISTORY_TYPES'));
  assert.ok(historySrc.includes('fullHistoryEntries'));
  assert.ok(historySrc.includes('fullHistoryListHtml'));
  const typeFilterModule = 'history-type-' + 'filter.js';
  assert.ok(readFileSync(new URL(`../${typeFilterModule}`, import.meta.url), 'utf8').includes('filterHistoryEntriesByType'));
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  assert.ok(readFileSync(new URL(`../${rangeFilterModule}`, import.meta.url), 'utf8').includes('filterHistoryEntriesByDateRange'));
  const methodFilterModule = 'history-method-' + 'filter.js';
  assert.ok(readFileSync(new URL(`../${methodFilterModule}`, import.meta.url), 'utf8').includes('filterHistoryEntriesByMethod'));
  const amountSearchModule = 'history-amount-' + 'search.js';
  assert.ok(readFileSync(new URL(`../${amountSearchModule}`, import.meta.url), 'utf8').includes('searchHistoryEntriesByAmount'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${fullHistoryModule}'`));
  assert.ok(appSrc.includes(`from './${typeFilterModule}'`));
  assert.ok(appSrc.includes(`from './${rangeFilterModule}'`));
  assert.ok(appSrc.includes(`from './${methodFilterModule}'`));
  assert.ok(appSrc.includes(`from './${amountSearchModule}'`));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
});

test('Plan 406: the profile wires the running-balance column into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-running-balance.js'"));
  assert.ok(appSrc.includes('historyRunningBalanceColumnHtml'));
  assert.ok(appSrc.includes('hrbHistoryRunningBalance'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="hrbHistoryRunningBalance"'));
  assert.ok(indexSrc.indexOf('id="fhlFullHistoryList"') < indexSrc.indexOf('id="hrbHistoryRunningBalance"'));
});

test('Plan 406: no new styles are added — the column reuses the statement table classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('hrb'), false);
  const moduleSrc = readFileSync(new URL('../history-running-balance.js', import.meta.url), 'utf8');
  assert.ok(moduleSrc.includes('statement-table'));
});

test('Plan 406: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
