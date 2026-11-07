// Plan 445 — Quick Collect daily target progress bar: one live
// progress bar on the Quick Collect screen — today's collected
// total against today's target, in plain words and figures. It
// shows progress only and it sets no target; a day with no target
// shows the collected total without a bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatDailyTargetProgressAmount,
  normalizeDailyTargetProgressTarget,
  dailyTargetProgress,
  dailyTargetProgressText,
  dailyTargetProgressHtml,
} from '../daily-target-progress.js';
import { dailyEntrySummary } from '../daily-entry-summary.js';
import { getDayTarget } from '../day-target.js';

const moduleSrc = readFileSync(new URL('../daily-target-progress.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const TODAY = '2026-11-07';

function row(amount, date = TODAY, extra = {}) {
  return { date, amount, voided: false, ...extra };
}

// A fake storage holding the operator-set day target for today,
// in the shape the field day target stores it.
function targetStore(amount, date = TODAY) {
  return {
    getItem() {
      return JSON.stringify({ date, amount });
    },
  };
}

// --- Amount formatting ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatDailyTargetProgressAmount(3000), 'PKR 3,000');
  assert.equal(formatDailyTargetProgressAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatDailyTargetProgressAmount(0), 'PKR 0');
  assert.equal(formatDailyTargetProgressAmount(-3000), 'PKR -3,000');
});

test('amount: a missing figure is "not a number", never PKR 0', () => {
  for (const bad of [null, undefined, '', true, false, Number.NaN, 'abc']) {
    assert.equal(formatDailyTargetProgressAmount(bad), 'Not set', `expected Not set for ${String(bad)}`);
  }
});

// --- Target normalising ---

test('target: a positive finite target is kept, rounded to whole rupees', () => {
  assert.equal(normalizeDailyTargetProgressTarget(50000), 50000);
  assert.equal(normalizeDailyTargetProgressTarget(50000.6), 50001);
  assert.equal(normalizeDailyTargetProgressTarget('50000'), 50000);
});

test('target: zero, negative, missing, or unusable figures mean no target set', () => {
  for (const bad of [0, -5000, null, undefined, '', true, Number.NaN, 'abc']) {
    assert.equal(normalizeDailyTargetProgressTarget(bad), null, `expected null for ${String(bad)}`);
  }
});

// --- Progress ---

test('progress: collected, target, percentage, and remainder on one fixture', () => {
  assert.deepEqual(dailyTargetProgress(12000, 50000), {
    collected: 12000,
    target: 50000,
    targetSet: true,
    progressPct: 24,
    remaining: 38000,
    overTarget: 0,
    targetReached: false,
  });
});

test('progress: the percentage rounds to the nearest whole percent', () => {
  assert.equal(dailyTargetProgress(1, 3).progressPct, 33);
  assert.equal(dailyTargetProgress(2, 3).progressPct, 67);
});

test('progress: reaching the target exactly reads as reached, with nothing left to go', () => {
  const p = dailyTargetProgress(50000, 50000);
  assert.equal(p.progressPct, 100);
  assert.equal(p.remaining, 0);
  assert.equal(p.overTarget, 0);
  assert.equal(p.targetReached, true);
});

test('progress: collecting past the target caps the bar at 100 and keeps the excess', () => {
  const p = dailyTargetProgress(60000, 50000);
  assert.equal(p.progressPct, 100);
  assert.equal(p.remaining, 0);
  assert.equal(p.overTarget, 10000);
  assert.equal(p.targetReached, true);
});

test('progress: a day with no target shows the total with no percentage and no remainder', () => {
  assert.deepEqual(dailyTargetProgress(12000, null), {
    collected: 12000,
    target: 0,
    targetSet: false,
    progressPct: 0,
    remaining: 0,
    overTarget: 0,
    targetReached: false,
  });
  for (const bad of [0, -5000, undefined, '', 'abc']) {
    const p = dailyTargetProgress(12000, bad);
    assert.equal(p.targetSet, false, `expected no target for ${String(bad)}`);
    assert.equal(p.progressPct, 0);
  }
});

test('progress: a missing collected figure is no taking, never a guessed total', () => {
  for (const bad of [null, undefined, '', true, Number.NaN, 'abc']) {
    const p = dailyTargetProgress(bad, 50000);
    assert.equal(p.collected, 0, `expected 0 collected for ${String(bad)}`);
    assert.equal(p.progressPct, 0);
    assert.equal(p.remaining, 50000);
  }
});

test('progress: an empty day against a target is zero percent with the whole target left', () => {
  assert.deepEqual(dailyTargetProgress(0, 50000), {
    collected: 0,
    target: 50000,
    targetSet: true,
    progressPct: 0,
    remaining: 50000,
    overTarget: 0,
    targetReached: false,
  });
});

test('progress: the input figures are never mutated', () => {
  const progress = dailyTargetProgress(12000, 50000);
  const before = JSON.stringify(progress);
  dailyTargetProgressText(progress);
  dailyTargetProgressHtml(progress);
  assert.equal(JSON.stringify(progress), before);
});

// --- Acceptance on one shared fixture: collected matches today's
// recorded payments and the target matches the day target ---

test('acceptance: collected matches today\'s recorded payments and target matches the day target', () => {
  const rows = [
    row(3000),
    row(2000),
    row(5000, TODAY, { voided: true }),
    row(9000, '2026-11-06'),
  ];
  const collected = dailyEntrySummary(rows, TODAY).total;
  assert.equal(collected, 5000);
  const target = getDayTarget(targetStore(50000), TODAY).amount;
  assert.equal(target, 50000);
  assert.deepEqual(dailyTargetProgress(collected, target), {
    collected: 5000,
    target: 50000,
    targetSet: true,
    progressPct: 10,
    remaining: 45000,
    overTarget: 0,
    targetReached: false,
  });
});

test('acceptance: a reversal today nets into the collected figure the bar shows', () => {
  const rows = [row(3000), row(-3000)];
  const collected = dailyEntrySummary(rows, TODAY).total;
  assert.equal(collected, 0);
  assert.equal(dailyTargetProgress(collected, 50000).progressPct, 0);
});

test('acceptance: with no target stored, the same fixture shows the total with no bar basis', () => {
  const rows = [row(3000), row(2000)];
  const collected = dailyEntrySummary(rows, TODAY).total;
  const target = getDayTarget({ getItem() { return null; } }, TODAY).amount;
  assert.equal(target, null);
  const p = dailyTargetProgress(collected, target);
  assert.equal(p.collected, 5000);
  assert.equal(p.targetSet, false);
});

// --- Line text ---

test('text: a target day reads target, collected, remainder, and percent in plain words', () => {
  assert.equal(
    dailyTargetProgressText(dailyTargetProgress(12000, 50000)),
    'Day target PKR 50,000 · collected PKR 12,000 · PKR 38,000 to go (24%)',
  );
});

test('text: a reached target says so plainly', () => {
  assert.equal(
    dailyTargetProgressText(dailyTargetProgress(50000, 50000)),
    'Day target PKR 50,000 · collected PKR 50,000 · target reached (100%)',
  );
});

test('text: a day with no target shows the total and says no target is set', () => {
  assert.equal(
    dailyTargetProgressText(dailyTargetProgress(12000, null)),
    'Today collected: PKR 12,000 · no day target set',
  );
  assert.equal(
    dailyTargetProgressText(dailyTargetProgress(0, null)),
    'Today collected: PKR 0 · no day target set',
  );
});

test('text: a missing progress object never reads as a blank', () => {
  assert.equal(dailyTargetProgressText(null), 'Today collected: PKR 0 · no day target set');
  assert.equal(dailyTargetProgressText({}), 'Today collected: PKR 0 · no day target set');
});

// --- Bar markup ---

test('html: a target day renders the bar at the right width with the plain-words line', () => {
  const html = dailyTargetProgressHtml(dailyTargetProgress(12000, 50000));
  assert.ok(html.includes('Day target PKR 50,000 · collected PKR 12,000 · PKR 38,000 to go (24%)'), 'missing plain-words line');
  assert.ok(html.includes('class="route-progress-track"'), 'missing bar track');
  assert.ok(html.includes('class="route-progress-fill"'), 'missing bar fill');
  assert.ok(html.includes('style="width: 24%;"'), 'bar width must match the progress percentage');
  assert.ok(html.includes('role="region"'), 'bar must be a labelled region');
});

test('html: a day with no target renders the total with no bar at all', () => {
  const html = dailyTargetProgressHtml(dailyTargetProgress(12000, null));
  assert.ok(html.includes('Today collected: PKR 12,000 · no day target set'), 'missing collected-total line');
  assert.ok(!html.includes('route-progress-track'), 'no-target day must not render a bar track');
  assert.ok(!html.includes('route-progress-fill'), 'no-target day must not render a bar fill');
  assert.ok(!html.includes('width:'), 'no-target day must not set a bar width');
});

test('html: a past-target day fills the bar without overflowing it', () => {
  const html = dailyTargetProgressHtml(dailyTargetProgress(60000, 50000));
  assert.ok(html.includes('style="width: 100%;"'), 'bar width must cap at 100%');
});

// --- Wiring ---

test('wiring: the controller imports the progress view and the stored day target', () => {
  assert.ok(wiringSrc.includes("import { dailyTargetProgress, dailyTargetProgressHtml } from './daily-target-progress.js';"), 'missing progress import');
  assert.ok(wiringSrc.includes("import { getDayTarget } from './day-target.js';"), 'missing day-target import');
  assert.ok(wiringSrc.includes('function refreshDailyTargetProgress()'), 'missing refreshDailyTargetProgress');
  assert.ok(wiringSrc.includes("document.getElementById('dtpDailyTargetProgress')"), 'missing progress bar host element lookup');
});

test('wiring: the refresh reads today\'s recorded total and the stored day target, and writes the bar', () => {
  const refresh = wiringSrc.match(/function refreshDailyTargetProgress\(\) \{[\s\S]*?\n  \}/);
  assert.ok(refresh, 'refreshDailyTargetProgress not found');
  assert.ok(refresh[0].includes('dailyEntrySummary(listTransactions(state), today).total'), 'collected must be today\'s recorded total');
  assert.ok(refresh[0].includes('getDayTarget(storage, today).amount'), 'target must be the stored day target for today');
  assert.ok(refresh[0].includes('dailyTargetProgressEl.innerHTML = dailyTargetProgressHtml(dailyTargetProgress(collected, target));'), 'refresh must write the bar markup');
});

test('wiring: updateCounts refreshes the bar on every open and after each save', () => {
  const updateCounts = wiringSrc.match(/function updateCounts\(\) \{[\s\S]*?\n  \}/);
  assert.ok(updateCounts, 'updateCounts not found');
  assert.ok(updateCounts[0].includes('refreshDailyTargetProgress();'), 'updateCounts must refresh the bar');
  assert.ok(wiringSrc.includes("showStep('success');\n      updateCounts();"), 'updateCounts must run on the success path after a save');
});

test('wiring: the picker screen carries the bar host, after the round total and before the customer list', () => {
  assert.ok(pageSrc.includes('<div id="dtpDailyTargetProgress"'), 'missing progress bar host element');
  const pickStep = pageSrc.indexOf('id="quickCollectStepPick"');
  const roundTotalsEl = pageSrc.indexOf('id="rttRoundTotals"');
  const barEl = pageSrc.indexOf('id="dtpDailyTargetProgress"');
  const listEl = pageSrc.indexOf('id="quickCollectCustomerList"');
  assert.ok(pickStep !== -1 && roundTotalsEl !== -1 && barEl !== -1 && listEl !== -1, 'anchors missing');
  assert.ok(pickStep < roundTotalsEl && roundTotalsEl < barEl && barEl < listEl, 'bar host must sit inside the picker step, after the round total and before the customer list');
});

// --- Fences ---

test('fences: the progress module is pure — no clock, no storage, no store key', () => {
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
    'quick-collect-round-' + 'totals.js',
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
    'pending-clearance-' + 'flag.js',
    'receipt-share-' + 'draft.js',
    'quick-collect-amount-' + 'keypad.js',
    'last-four-digits-' + 'search.js',
    'quick-collect-still-' + 'owes.js',
    'monthly-kpi-' + 'target.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the daily target progress bar', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'quick-collect-round-' + 'totals.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'dashboard-' + 'daily-closing.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'monthly-kpi-' + 'target.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('dailyTargetProgress'), `${file} must not reference the daily target progress`);
    assert.ok(!src.includes('dtpDailyTargetProgress'), `${file} must not reference the progress bar host`);
  }
});

// --- Styles ---

test('styles: the progress rules reuse existing colours only — no new hex', () => {
  const rules = stylesSrc.match(/\.dtp-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'missing .dtp-daily-target-progress rule');
  const baseline = stylesSrc.replace(/\.dtp-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
