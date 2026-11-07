// Plan 448 — Quick Collect end-of-day summary from the payment screen:
// one summary reachable from the Quick Collect screen — today's
// payments count and total, by method, with the cash total shown
// separately. It summarises only and it settles nothing: the day
// closes at the counter from figures already seen, and no bill,
// payment, digest, or settlement record ever changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  END_OF_DAY_SUMMARY_UNRECORDED_METHOD,
  formatEndOfDaySummaryAmount,
  isStrictEndOfDaySummaryDate,
  isEndOfDayCashMethod,
  quickCollectEndOfDaySummary,
  quickCollectEndOfDaySummaryText,
  quickCollectEndOfDaySummaryHtml,
} from '../quick-collect-end-of-day-summary.js';
import { dailyEntrySummary } from '../daily-entry-summary.js';

const moduleSrc = readFileSync(new URL('../quick-collect-end-of-day-summary.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const TODAY = '2026-11-07';

// Seven counted rows: two Cash, one JazzCash, one Easypaisa, one
// blank method, one JazzCash reversal, one Cash row with no usable
// amount. One voided Cash row and one yesterday Cash row sit in the
// same fixture and must never count.
function todayRows() {
  return [
    { date: TODAY, amount: 2000, method: 'Cash' },
    { date: TODAY, amount: 1500.5, method: 'Cash' },
    { date: TODAY, amount: 1000, method: 'JazzCash' },
    { date: TODAY, amount: 500, method: 'Easypaisa' },
    { date: TODAY, amount: 300, method: '' },
    { date: TODAY, amount: 9999, method: 'Cash', voided: true },
    { date: '2026-11-06', amount: 777, method: 'Cash' },
    { date: TODAY, amount: -200, method: 'JazzCash' },
    { date: TODAY, amount: 'abc', method: 'Cash' },
  ];
}

// --- Amount formatting ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatEndOfDaySummaryAmount(3000), 'PKR 3,000');
  assert.equal(formatEndOfDaySummaryAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatEndOfDaySummaryAmount(0), 'PKR 0');
  assert.equal(formatEndOfDaySummaryAmount(4100.5), 'PKR 4,100.5');
});

test('amount: a missing figure is "not a number", never zero', () => {
  assert.equal(formatEndOfDaySummaryAmount(null), 'Not set');
  assert.equal(formatEndOfDaySummaryAmount(undefined), 'Not set');
  assert.equal(formatEndOfDaySummaryAmount(''), 'Not set');
  assert.equal(formatEndOfDaySummaryAmount(true), 'Not set');
  assert.equal(formatEndOfDaySummaryAmount('abc'), 'Not set');
  assert.equal(formatEndOfDaySummaryAmount(NaN), 'Not set');
});

// --- Strict date ---

test('date: a strict YYYY-MM-DD calendar date only', () => {
  assert.equal(isStrictEndOfDaySummaryDate('2026-11-07'), true);
  assert.equal(isStrictEndOfDaySummaryDate('2024-02-29'), true);
  assert.equal(isStrictEndOfDaySummaryDate('2026-02-29'), false);
  assert.equal(isStrictEndOfDaySummaryDate('2026-04-31'), false);
  assert.equal(isStrictEndOfDaySummaryDate('2026-13-01'), false);
  assert.equal(isStrictEndOfDaySummaryDate('2026-11-7'), false);
  assert.equal(isStrictEndOfDaySummaryDate('07-11-2026'), false);
  assert.equal(isStrictEndOfDaySummaryDate(''), false);
  assert.equal(isStrictEndOfDaySummaryDate(null), false);
  assert.equal(isStrictEndOfDaySummaryDate(20261107), false);
});

// --- Cash rule ---

test('cash: cash methods count as cash, digital methods do not', () => {
  assert.equal(isEndOfDayCashMethod('Cash'), true);
  assert.equal(isEndOfDayCashMethod('Cash at Waseem Abbasi shop'), true);
  assert.equal(isEndOfDayCashMethod('Cash at Hassan shop'), true);
  assert.equal(isEndOfDayCashMethod('JazzCash'), false);
  assert.equal(isEndOfDayCashMethod('Easypaisa'), false);
  assert.equal(isEndOfDayCashMethod('NayaPay'), false);
  assert.equal(isEndOfDayCashMethod('Bank Transfer'), false);
  assert.equal(isEndOfDayCashMethod('Raast'), false);
  assert.equal(isEndOfDayCashMethod('Online payment'), false);
});

test('cash: a cheque is cash, a missing method is cash — the shop rule', () => {
  assert.equal(isEndOfDayCashMethod('Cheque'), true);
  assert.equal(isEndOfDayCashMethod(null), true);
  assert.equal(isEndOfDayCashMethod(undefined), true);
  assert.equal(isEndOfDayCashMethod(''), true);
  assert.equal(isEndOfDayCashMethod('   '), true);
});

// --- Summary ---

test('summary: count and total match today’s recorded payments', () => {
  const s = quickCollectEndOfDaySummary(todayRows(), TODAY);
  assert.equal(s.date, TODAY);
  assert.equal(s.count, 7);
  assert.equal(s.total, 5100.5);
});

test('summary: figures match the daily entry summary on the same fixture', () => {
  const mine = quickCollectEndOfDaySummary(todayRows(), TODAY);
  const entry = dailyEntrySummary(todayRows(), TODAY);
  assert.equal(mine.count, entry.count);
  assert.equal(mine.total, entry.total);
});

test('summary: a voided row is history, not a taking', () => {
  const rows = [
    { date: TODAY, amount: 9999, method: 'Cash', voided: true },
    { date: TODAY, amount: 100, method: 'Cash' },
  ];
  const s = quickCollectEndOfDaySummary(rows, TODAY);
  assert.equal(s.count, 1);
  assert.equal(s.total, 100);
  assert.equal(s.methods.length, 1);
  assert.equal(s.methods[0].total, 100);
});

test('summary: yesterday’s payments never count', () => {
  const rows = [
    { date: '2026-11-06', amount: 777, method: 'Cash' },
    { date: TODAY, amount: 100, method: 'Cash' },
  ];
  const s = quickCollectEndOfDaySummary(rows, TODAY);
  assert.equal(s.count, 1);
  assert.equal(s.total, 100);
});

test('summary: a reversal counts and nets into the total', () => {
  const rows = [
    { date: TODAY, amount: 1000, method: 'JazzCash' },
    { date: TODAY, amount: -200, method: 'JazzCash' },
  ];
  const s = quickCollectEndOfDaySummary(rows, TODAY);
  assert.equal(s.count, 2);
  assert.equal(s.total, 800);
  assert.equal(s.methods.length, 1);
  assert.equal(s.methods[0].total, 800);
});

test('summary: a row with no usable amount still counts, but adds nothing', () => {
  const rows = [
    { date: TODAY, amount: 'abc', method: 'Cash' },
    { date: TODAY, amount: 100, method: 'Cash' },
  ];
  const s = quickCollectEndOfDaySummary(rows, TODAY);
  assert.equal(s.count, 2);
  assert.equal(s.total, 100);
  assert.equal(s.methods[0].count, 2);
  assert.equal(s.methods[0].total, 100);
});

test('summary: method parts sum exactly to the day total', () => {
  const s = quickCollectEndOfDaySummary(todayRows(), TODAY);
  const parts = s.methods.reduce((sum, part) => sum + part.total, 0);
  assert.equal(parts, s.total);
  const partCounts = s.methods.reduce((sum, part) => sum + part.count, 0);
  assert.equal(partCounts, s.count);
});

test('summary: methods break down by recorded method, biggest first', () => {
  const s = quickCollectEndOfDaySummary(todayRows(), TODAY);
  assert.deepEqual(
    s.methods.map((part) => [part.method, part.count, part.total]),
    [
      ['Cash', 3, 3500.5],
      ['JazzCash', 2, 800],
      ['Easypaisa', 1, 500],
      [END_OF_DAY_SUMMARY_UNRECORDED_METHOD, 1, 300],
    ],
  );
});

test('summary: ties in method totals break by method name', () => {
  const rows = [
    { date: TODAY, amount: 500, method: 'JazzCash' },
    { date: TODAY, amount: 500, method: 'Easypaisa' },
    { date: TODAY, amount: 500, method: 'Cash' },
  ];
  const s = quickCollectEndOfDaySummary(rows, TODAY);
  assert.deepEqual(
    s.methods.map((part) => part.method),
    ['Cash', 'Easypaisa', 'JazzCash'],
  );
});

test('summary: a missing method is labelled, never invented', () => {
  const s = quickCollectEndOfDaySummary(
    [
      { date: TODAY, amount: 300, method: '' },
      { date: TODAY, amount: 400, method: null },
    ],
    TODAY,
  );
  assert.equal(s.methods.length, 1);
  assert.equal(s.methods[0].method, 'Method not recorded');
  assert.equal(s.methods[0].count, 2);
  assert.equal(s.methods[0].total, 700);
});

test('summary: the cash total is shown separately and counts the unrecorded row', () => {
  const s = quickCollectEndOfDaySummary(todayRows(), TODAY);
  assert.equal(s.cashTotal, 3800.5);
  assert.equal(s.cashCount, 4);
});

test('summary: an all-digital day has no cash in hand', () => {
  const s = quickCollectEndOfDaySummary(
    [
      { date: TODAY, amount: 1000, method: 'JazzCash' },
      { date: TODAY, amount: 500, method: 'Easypaisa' },
    ],
    TODAY,
  );
  assert.equal(s.count, 2);
  assert.equal(s.total, 1500);
  assert.equal(s.cashTotal, 0);
  assert.equal(s.cashCount, 0);
});

test('summary: an empty day, a bad day key, and bad rows read as nothing', () => {
  assert.deepEqual(quickCollectEndOfDaySummary([], TODAY), {
    date: TODAY, count: 0, total: 0, cashTotal: 0, cashCount: 0, methods: [],
  });
  assert.deepEqual(quickCollectEndOfDaySummary(todayRows(), '2026-02-30'), {
    date: '', count: 0, total: 0, cashTotal: 0, cashCount: 0, methods: [],
  });
  assert.deepEqual(quickCollectEndOfDaySummary(null, TODAY), {
    date: TODAY, count: 0, total: 0, cashTotal: 0, cashCount: 0, methods: [],
  });
  assert.deepEqual(quickCollectEndOfDaySummary([null, 'x', 42], TODAY), {
    date: TODAY, count: 0, total: 0, cashTotal: 0, cashCount: 0, methods: [],
  });
});

// --- Text ---

test('text: the headline names the count and the total', () => {
  assert.equal(
    quickCollectEndOfDaySummaryText({ count: 3, total: 9000 }),
    'End of day — today: 3 payments · PKR 9,000',
  );
  assert.equal(
    quickCollectEndOfDaySummaryText({ count: 1, total: 1500.5 }),
    'End of day — today: 1 payment · PKR 1,500.5',
  );
});

test('text: an empty day says so plainly', () => {
  assert.equal(
    quickCollectEndOfDaySummaryText({ count: 0, total: 0 }),
    'End of day — today: no payments yet',
  );
  assert.equal(quickCollectEndOfDaySummaryText(null), 'End of day — today: no payments yet');
  assert.equal(quickCollectEndOfDaySummaryText({}), 'End of day — today: no payments yet');
});

// --- HTML ---

test('html: the panel shows the headline, the method rows, and the cash line', () => {
  const html = quickCollectEndOfDaySummaryHtml(quickCollectEndOfDaySummary(todayRows(), TODAY));
  assert.ok(html.includes('End of day — today: 7 payments · PKR 5,100.5'), 'headline must show count and total');
  assert.ok(html.includes('Cash'), 'Cash row must show');
  assert.ok(html.includes('3 payments · PKR 3,500.5'), 'Cash row must show its count and total');
  assert.ok(html.includes('JazzCash'), 'JazzCash row must show');
  assert.ok(html.includes('2 payments · PKR 800'), 'JazzCash row must show its count and total');
  assert.ok(html.includes('Method not recorded'), 'unrecorded row must show');
  assert.ok(html.includes('Cash in hand: PKR 3,800.5'), 'cash total must show on its own line');
  assert.ok(html.includes('id="edsEndOfDaySummaryClose"'), 'panel must carry its Close button');
});

test('html: method names from recorded data are escaped', () => {
  const html = quickCollectEndOfDaySummaryHtml(quickCollectEndOfDaySummary(
    [{ date: TODAY, amount: 100, method: '<script>alert(1)</script>' }],
    TODAY,
  ));
  assert.ok(!html.includes('<script>'), 'method markup must be escaped');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped method must be present');
});

test('html: an empty day shows the headline and Close only', () => {
  const html = quickCollectEndOfDaySummaryHtml(quickCollectEndOfDaySummary([], TODAY));
  assert.ok(html.includes('End of day — today: no payments yet'), 'empty headline must show');
  assert.ok(!html.includes('<ul'), 'empty day must have no method list');
  assert.ok(!html.includes('Cash in hand'), 'empty day must have no cash line');
  assert.ok(html.includes('id="edsEndOfDaySummaryClose"'), 'empty panel must still close');
});

// --- Wiring ---

test('wiring: the Quick Collect controller imports the end-of-day summary', () => {
  assert.ok(wiringSrc.includes("from './quick-collect-end-of-day-summary.js'"), 'missing module import');
  assert.ok(wiringSrc.includes('quickCollectEndOfDaySummary, quickCollectEndOfDaySummaryHtml'), 'missing summary imports');
});

test('wiring: the summary panel and its button are read on the picker screen', () => {
  assert.ok(wiringSrc.includes("getElementById('edsEndOfDaySummary')"), 'missing panel lookup');
  assert.ok(wiringSrc.includes("getElementById('edsEndOfDaySummaryButton')"), 'missing button lookup');
});

test('wiring: the panel refreshes from fresh state on every open and after each save', () => {
  assert.ok(wiringSrc.includes('function refreshEndOfDaySummary()'), 'missing refresh function');
  assert.ok(
    wiringSrc.includes('quickCollectEndOfDaySummary(listTransactions(state), getPakistanLocalDate())'),
    'refresh must read today’s recorded payments',
  );
  const updateAt = wiringSrc.indexOf('function updateCounts()');
  const refreshAt = wiringSrc.indexOf('refreshEndOfDaySummary();', updateAt);
  assert.ok(updateAt !== -1 && refreshAt !== -1 && refreshAt > updateAt, 'refresh must run inside updateCounts');
});

test('wiring: the button toggles the panel and the Close button hides it', () => {
  assert.ok(wiringSrc.includes('function toggleEndOfDaySummary()'), 'missing toggle function');
  assert.ok(wiringSrc.includes("endOfDaySummaryBtn?.addEventListener('click'"), 'missing button listener');
  assert.ok(wiringSrc.includes("event?.target?.id === 'edsEndOfDaySummaryClose'"), 'missing Close delegation');
});

test('page: the button and the hidden panel sit on the picker screen', () => {
  assert.ok(pageSrc.includes('<button id="edsEndOfDaySummaryButton"'), 'missing summary button');
  assert.ok(pageSrc.includes('aria-expanded="false"'), 'button must start collapsed');
  assert.ok(pageSrc.includes('aria-controls="edsEndOfDaySummary"'), 'button must control the panel');
  assert.ok(pageSrc.includes('<div id="edsEndOfDaySummary"'), 'missing summary panel');
  assert.ok(pageSrc.includes('aria-label="End-of-day summary"'), 'panel must be labelled');
  const targetAt = pageSrc.indexOf('dtpDailyTargetProgress');
  const buttonAt = pageSrc.indexOf('edsEndOfDaySummaryButton');
  const panelAt = pageSrc.indexOf('<div id="edsEndOfDaySummary"');
  const listAt = pageSrc.indexOf('quickCollectCustomerList');
  assert.ok(targetAt !== -1 && buttonAt !== -1 && panelAt !== -1 && listAt !== -1, 'picker hosts missing');
  assert.ok(buttonAt > targetAt, 'button must sit after the daily target progress');
  assert.ok(panelAt > buttonAt, 'panel must sit after its button');
  assert.ok(panelAt < listAt, 'panel must sit before the customer list');
});

// --- Fences ---

test('fences: the end-of-day module is pure — no clock, no storage, no store key', () => {
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!/new Date\(/.test(moduleSrc), 'module must not read the clock');
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
    'daily-target-' + 'progress.js',
    'quick-collect-round-' + 'totals.js',
    'dashboard-' + 'daily-closing.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'shop-' + 'settlement.js',
    'partner-' + 'settlement.js',
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
    'quick-collect-still-' + 'owes.js',
    'quick-collect-mohalla-' + 'filter.js',
    'quick-collect-big-name-' + 'confirm.js',
    'name-prefix-' + 'lookup.js',
    'recent-quick-' + 'pick.js',
    'one-screen-quick-' + 'amounts.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the end-of-day summary', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'daily-target-' + 'progress.js',
    'quick-collect-round-' + 'totals.js',
    'dashboard-' + 'daily-closing.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'dues-amount-' + 'default.js',
    'success-next-' + 'steps.js',
    'quick-collect-still-' + 'owes.js',
    'quick-collect-big-name-' + 'confirm.js',
    'quick-collect-mohalla-' + 'filter.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('EndOfDaySummary'), `${file} must not reference the end-of-day summary`);
    assert.ok(!src.includes('edsEndOfDaySummary'), `${file} must not reference the summary panel`);
  }
});

// --- Styles ---

test('styles: the end-of-day rules lay out only — no new hex', () => {
  const rules = stylesSrc.match(/\.eds-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'missing .eds-summary rule');
  const baseline = stylesSrc.replace(/\.eds-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
