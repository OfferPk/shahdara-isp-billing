// Plan 439 — Quick Collect end-of-round totals on screen: one live
// round total on the Quick Collect screen (payments taken this
// round: count and total amount, updated after each save). It totals
// only and it settles nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isFiniteRoundInstant,
  roundStampMs,
  formatRoundTotalsAmount,
  quickCollectRoundTotals,
  quickCollectRoundTotalsText,
} from '../quick-collect-round-totals.js';

const moduleSrc = readFileSync(new URL('../quick-collect-round-totals.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The round starts when the sheet opens: 2026-11-07 13:00 Pakistan
// time, as the epoch instant the wiring stamps at open.
const ROUND_START = Date.parse('2026-11-07T08:00:00.000Z');
const BEFORE = '2026-11-07T07:59:59.000Z';
const AT_START = '2026-11-07T08:00:00.000Z';
const AFTER = '2026-11-07T08:30:00.000Z';
const LATER = '2026-11-07T09:15:00.000Z';

function row(amount, recordedAt, extra = {}) {
  return { date: '2026-11-07', amount, recordedAt, voided: false, ...extra };
}

// --- Amount formatting ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatRoundTotalsAmount(3000), 'PKR 3,000');
  assert.equal(formatRoundTotalsAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatRoundTotalsAmount(0), 'PKR 0');
  assert.equal(formatRoundTotalsAmount(-3000), 'PKR -3,000');
});

test('amount: a missing figure is "not a number", never PKR 0', () => {
  for (const bad of [null, undefined, '', true, false, Number.NaN, 'abc']) {
    assert.equal(formatRoundTotalsAmount(bad), 'Not set', `expected Not set for ${String(bad)}`);
  }
});

// --- Stamp parsing ---

test('stamp: a UTC ISO stamp parses to its instant', () => {
  assert.equal(roundStampMs(AT_START), ROUND_START);
  assert.equal(roundStampMs('2026-11-07T08:00:00.000Z'), Date.parse('2026-11-07T08:00:00.000Z'));
});

test('stamp: a missing or unparseable stamp gives no instant, never a guess', () => {
  for (const bad of [null, undefined, 0, true, '', 'not a date', 'round two']) {
    assert.equal(roundStampMs(bad), null, `expected null for ${String(bad)}`);
  }
});

test('instant: only a finite number counts as a round start', () => {
  assert.equal(isFiniteRoundInstant(ROUND_START), true);
  assert.equal(isFiniteRoundInstant(0), true);
  for (const bad of [null, undefined, '', true, false, Number.NaN, Number.POSITIVE_INFINITY, 'abc']) {
    assert.equal(isFiniteRoundInstant(bad), false, `expected false for ${String(bad)}`);
  }
});

// --- Round totals ---

test('totals: only payments recorded at or after the round start count', () => {
  const rows = [
    row(1000, BEFORE),
    row(2000, AT_START),
    row(3000, AFTER),
    row(4000, LATER),
  ];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 3, total: 9000, startedAtMs: ROUND_START });
});

test('totals: a payment from an earlier round today never counts', () => {
  const rows = [row(1500, '2026-11-07T06:00:00.000Z'), row(2500, '2026-11-06T20:00:00.000Z')];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 0, total: 0, startedAtMs: ROUND_START });
});

test('totals: a voided row is history, not a taking', () => {
  const rows = [row(3000, AFTER), row(2000, AFTER, { voided: true })];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 1, total: 3000, startedAtMs: ROUND_START });
});

test('totals: a reversal in this round counts and nets into the total', () => {
  const rows = [row(3000, AFTER), row(-3000, LATER)];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 2, total: 0, startedAtMs: ROUND_START });
});

test('totals: a split collection counts each leg recorded in this round', () => {
  const rows = [row(1500, AFTER), row(1500, AFTER)];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 2, total: 3000, startedAtMs: ROUND_START });
});

test('totals: a row with no usable stamp is never guessed into the round', () => {
  const rows = [row(3000, AFTER), row(5000, ''), row(5000, null), row(5000, 'not a stamp')];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 1, total: 3000, startedAtMs: ROUND_START });
});

test('totals: a row with a missing amount still counts, but adds nothing', () => {
  const rows = [row(3000, AFTER), row(null, AFTER), row(undefined, AFTER)];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 3, total: 3000, startedAtMs: ROUND_START });
});

test('totals: non-rows are skipped, and a non-finite start totals nothing', () => {
  const rows = [null, undefined, 'x', row(3000, AFTER)];
  assert.deepEqual(quickCollectRoundTotals(rows, ROUND_START), { count: 1, total: 3000, startedAtMs: ROUND_START });
  assert.deepEqual(quickCollectRoundTotals(rows, null), { count: 0, total: 0, startedAtMs: null });
  assert.deepEqual(quickCollectRoundTotals(rows, 'soon'), { count: 0, total: 0, startedAtMs: null });
  assert.deepEqual(quickCollectRoundTotals(null, ROUND_START), { count: 0, total: 0, startedAtMs: ROUND_START });
  assert.deepEqual(quickCollectRoundTotals('rows', ROUND_START), { count: 0, total: 0, startedAtMs: ROUND_START });
});

test('totals: the input rows are never mutated', () => {
  const rows = [row(3000, AFTER), row(2000, LATER)];
  const before = JSON.stringify(rows);
  quickCollectRoundTotals(rows, ROUND_START);
  assert.equal(JSON.stringify(rows), before);
});

// --- Line text ---

test('text: an empty round says so plainly, never a blank', () => {
  assert.equal(quickCollectRoundTotalsText({ count: 0, total: 0 }), 'This round: no payments yet');
  assert.equal(quickCollectRoundTotalsText({ count: 0, total: 5000 }), 'This round: no payments yet');
  assert.equal(quickCollectRoundTotalsText(null), 'This round: no payments yet');
  assert.equal(quickCollectRoundTotalsText({}), 'This round: no payments yet');
});

test('text: one payment reads singular, several read plural', () => {
  assert.equal(quickCollectRoundTotalsText({ count: 1, total: 3000 }), 'This round: 1 payment · PKR 3,000');
  assert.equal(quickCollectRoundTotalsText({ count: 3, total: 9000 }), 'This round: 3 payments · PKR 9,000');
  assert.equal(quickCollectRoundTotalsText({ count: 2, total: 0 }), 'This round: 2 payments · PKR 0');
});

// --- Wiring ---

test('wiring: the controller imports the round totals and refreshes them', () => {
  assert.ok(wiringSrc.includes("import { quickCollectRoundTotals, quickCollectRoundTotalsText } from './quick-collect-round-totals.js';"), 'missing round-totals import');
  assert.ok(wiringSrc.includes('function refreshRoundTotals()'), 'missing refreshRoundTotals');
  assert.ok(wiringSrc.includes('quickCollectRoundTotals(listTransactions(state), roundStartMs)'), 'refresh must read the rows and the round start');
  assert.ok(wiringSrc.includes('roundTotalsEl.textContent = quickCollectRoundTotalsText(totals);'), 'refresh must write the line text');
});

test('wiring: updateCounts refreshes the round total on every open and after each save', () => {
  const updateCounts = wiringSrc.match(/function updateCounts\(\) \{[\s\S]*?\n  \}/);
  assert.ok(updateCounts, 'updateCounts not found');
  assert.ok(updateCounts[0].includes('refreshRoundTotals();'), 'updateCounts must refresh the round total');
  assert.ok(wiringSrc.includes("showStep('success');\n      updateCounts();"), 'updateCounts must run on the success path after a save');
});

test('wiring: opening the sheet starts a new round before the counts refresh', () => {
  const openModal = wiringSrc.match(/function openModal\(defaultCustomerId = null\) \{[\s\S]*?\n  \}/);
  assert.ok(openModal, 'openModal not found');
  const startAt = openModal[0].indexOf('roundStartMs = Date.now();');
  const countsAt = openModal[0].indexOf('updateCounts();');
  assert.ok(startAt !== -1, 'openModal must stamp the round start');
  assert.ok(countsAt !== -1 && startAt < countsAt, 'the round must start before the counts refresh');
});

test('wiring: the picker screen carries the round-total line, before the customer list', () => {
  assert.ok(pageSrc.includes('<p id="rttRoundTotals" class="rtt-round-totals"'), 'missing round-total line element');
  const pickStep = pageSrc.indexOf('id="quickCollectStepPick"');
  const totalsEl = pageSrc.indexOf('id="rttRoundTotals"');
  const listEl = pageSrc.indexOf('id="quickCollectCustomerList"');
  assert.ok(pickStep !== -1 && totalsEl !== -1 && listEl !== -1, 'anchors missing');
  assert.ok(pickStep < totalsEl && totalsEl < listEl, 'round-total line must sit inside the picker step, before the customer list');
});

// --- Fences ---

test('fences: the round-total module is pure — no clock, no storage, no store key', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('sessionStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('shahdara_'), 'module must not hold a store key');
  assert.ok(!moduleSrc.includes('import '), 'module must be import-free');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not name the OLT word');
});

test('fences: the module header never names a fenced file literally', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenced = [
    'daily-entry-' + 'summary.js',
    'big-wallet-method-' + 'buttons.js',
    'double-tap-save-' + 'guard.js',
    'offline-saved-' + 'badge.js',
    'quick-collect-reversal-' + 'undo.js',
    'success-next-' + 'steps.js',
    'receipt-' + 'preview.js',
    'cash-change-' + 'calculator.js',
    'remembered-' + 'method.js',
    'dues-amount-' + 'default.js',
    'quick-collect-one-' + 'screen.js',
    'name-prefix-' + 'lookup.js',
    'recent-quick-' + 'pick.js',
    'one-screen-quick-' + 'amounts.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the round total', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'dashboard-' + 'daily-closing.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('quickCollectRoundTotals'), `${file} must not reference the round total`);
    assert.ok(!src.includes('rttRoundTotals'), `${file} must not reference the round-total line`);
  }
});

// --- Styles ---

test('styles: the round-total rule reuses existing colours only — no new hex', () => {
  const rules = stylesSrc.match(/\.rtt-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'missing .rtt-round-totals rule');
  const baseline = stylesSrc.replace(/\.rtt-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
