// Plan 440 — Quick Collect still-owes line immediately after payment:
// one plain line on the success screen saying how much the customer
// still owes after this payment, or "Fully paid" when nothing is
// left. The figure is the customer's dues from the post-save record,
// not the receipt's payable remainder (which also folds in pending
// ticket and boost charges — those are not dues).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STILL_OWES_FULLY_PAID_TEXT,
  stillOwesIsStrictMonth,
  stillOwesFigureCents,
  formatStillOwesAmount,
  stillOwesCents,
  stillOwesLine,
  stillOwesLineText,
  stillOwesLineHtml,
} from '../quick-collect-still-owes.js';

const moduleSrc = readFileSync(new URL('../quick-collect-still-owes.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Generic fixture customer: two open bills, September and October.
function customer(bills, extra = {}) {
  return { id: 'cust-1', bills, ...extra };
}

function bill(month) {
  return { month };
}

// Allocation stub: balanceDueCents per month, 0 when unlisted.
function allocationsFor(balances) {
  return {
    forMonth: (_customerId, month) => ({ balanceDueCents: balances[month] ?? 0 }),
  };
}

// --- Amount formatting ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatStillOwesAmount(3000), '3,000');
  assert.equal(formatStillOwesAmount(1500.5), '1,500.5');
  assert.equal(formatStillOwesAmount(0), '0');
});

test('figure cents: a missing figure is "not a number", never zero', () => {
  for (const bad of [null, undefined, '', true, false, Number.NaN, 'abc']) {
    assert.equal(stillOwesFigureCents(bad), null, `expected null for ${String(bad)}`);
  }
  assert.equal(stillOwesFigureCents(150050), 150050);
  assert.equal(stillOwesFigureCents(150050.4), 150050);
});

// --- Strict month ---

test('month: strict YYYY-MM only', () => {
  assert.equal(stillOwesIsStrictMonth('2026-09'), true);
  assert.equal(stillOwesIsStrictMonth('2026-13'), false);
  assert.equal(stillOwesIsStrictMonth('2026-9'), false);
  assert.equal(stillOwesIsStrictMonth('Sep 2026'), false);
  assert.equal(stillOwesIsStrictMonth(null), false);
});

// --- Dues after the payment ---

test('dues: two open bills sum to the full dues left', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 150000, '2026-10': 300000 }),
    0,
  );
  assert.equal(cents, 450000);
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 150000, '2026-10': 300000 }),
    0,
  );
  assert.equal(line.stillOwed, 4500);
  assert.equal(line.fullyPaid, false);
  assert.equal(stillOwesLineText(line), 'Still owed PKR 4,500');
});

test('dues: a settled bill counts for nothing, an open bill counts in full', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 0, '2026-10': 300000 }),
    0,
  );
  assert.equal(cents, 300000);
});

test('dues: fully paid bills read fully paid', () => {
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 0, '2026-10': 0 }),
    0,
  );
  assert.equal(line.stillOwedCents, 0);
  assert.equal(line.stillOwed, 0);
  assert.equal(line.fullyPaid, true);
  assert.equal(stillOwesLineText(line), STILL_OWES_FULLY_PAID_TEXT);
  assert.equal(stillOwesLineText(line), 'Fully paid');
});

test('dues: unpaid manual baqaya counts as dues', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09')]),
    allocationsFor({ '2026-09': 0 }),
    100000,
  );
  assert.equal(cents, 100000);
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 150000, '2026-10': 0 }),
    100000,
  );
  assert.equal(line.stillOwed, 2500);
  assert.equal(stillOwesLineText(line), 'Still owed PKR 2,500');
});

test('dues: a zero or negative balance is not an open bill', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09'), bill('2026-10'), bill('2026-11')]),
    allocationsFor({ '2026-09': -5000, '2026-10': 0, '2026-11': 200000 }),
    0,
  );
  assert.equal(cents, 200000);
});

test('dues: a bill with no usable month is skipped, never guessed in', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09'), { month: 'Sep 2026' }, { month: null }]),
    allocationsFor({ '2026-09': 150000 }),
    0,
  );
  assert.equal(cents, 150000);
});

test('dues: a non-numeric balance is not a number, never zero', () => {
  const cents = stillOwesCents(
    customer([bill('2026-09'), bill('2026-10')]),
    { forMonth: (_id, month) => ({ balanceDueCents: month === '2026-09' ? '150000' : 300000 }) },
    0,
  );
  assert.equal(cents, 300000);
});

test('dues: a pending repair charge is not dues — the bill is fully paid', () => {
  // The fixture carries a 500 repair charge still pending after the
  // payment, while both bills are settled. The receipt's payable
  // remainder would still read 500 here because it folds pending
  // repair and boost charges in — but this line reads dues only, so
  // a customer whose bills are settled reads fully paid.
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')], { ticketChargesPending: 500 }),
    allocationsFor({ '2026-09': 0, '2026-10': 0 }),
    0,
  );
  assert.equal(line.stillOwedCents, 0);
  assert.equal(line.fullyPaid, true);
  assert.equal(stillOwesLineText(line), 'Fully paid');
});

test('dues: an unworkable figure gives no line, never a guess', () => {
  assert.equal(stillOwesCents(null, allocationsFor({}), 0), null);
  assert.equal(stillOwesCents({}, allocationsFor({}), 0), null);
  assert.equal(stillOwesCents({ id: '  ' }, allocationsFor({}), 0), null);
  assert.equal(stillOwesCents(customer([bill('2026-09')]), null, 0), null);
  assert.equal(stillOwesCents(customer([bill('2026-09')]), {}, 0), null);
  assert.equal(
    stillOwesCents(customer([bill('2026-09')]), { forMonth: () => { throw new Error('boom'); } }, 0),
    null,
  );
  assert.equal(stillOwesLine(null, allocationsFor({}), 0), null);
  assert.equal(stillOwesLine(customer([bill('2026-09')]), null, 0), null);
});

// --- Line text and markup ---

test('line text: an unusable line reads empty, never a guessed figure', () => {
  assert.equal(stillOwesLineText(null), '');
  assert.equal(stillOwesLineText({}), '');
  assert.equal(stillOwesLineText({ stillOwed: '1500' }), '');
  assert.equal(stillOwesLineText({ stillOwed: Number.NaN }), '');
});

test('line html: an owed line carries the owed class and the figure', () => {
  const html = stillOwesLineHtml({ stillOwedCents: 300000, stillOwed: 3000, fullyPaid: false });
  assert.ok(html.includes('has-balance'), 'owed line must carry has-balance');
  assert.ok(html.includes('Still owed PKR 3,000'), 'owed line must carry the figure');
  assert.ok(!html.includes('zero-balance'), 'owed line must not carry zero-balance');
});

test('line html: a fully paid line carries the settled class and the plain words', () => {
  const html = stillOwesLineHtml({ stillOwedCents: 0, stillOwed: 0, fullyPaid: true });
  assert.ok(html.includes('zero-balance'), 'fully paid line must carry zero-balance');
  assert.ok(html.includes('Fully paid'), 'fully paid line must carry the plain words');
  assert.ok(!html.includes('has-balance'), 'fully paid line must not carry has-balance');
});

test('line html: an unusable line renders nothing', () => {
  assert.equal(stillOwesLineHtml(null), '');
  assert.equal(stillOwesLineHtml({}), '');
  assert.equal(stillOwesLineHtml({ stillOwed: '1500' }), '');
});

// --- Wiring ---

test('wiring: the Quick Collect controller imports the still-owes line', () => {
  assert.ok(wiringSrc.includes("from './quick-collect-still-owes.js'"), 'missing module import');
  assert.ok(wiringSrc.includes('stillOwesLine, stillOwesLineHtml'), 'missing line imports');
});

test('wiring: the still-owes host is read on the success step', () => {
  assert.ok(wiringSrc.includes("getElementById('sowStillOwesLine')"), 'missing host lookup');
});

test('wiring: the render reads the post-save record through the allocation engine', () => {
  assert.ok(wiringSrc.includes('function renderStillOwesLine()'), 'missing render function');
  assert.ok(
    wiringSrc.includes('stillOwesLine(postSaveCustomer, calculatePaymentAllocations(postSaveState), baqayaCents)'),
    'render must read the post-save customer through the allocation engine',
  );
  assert.ok(
    wiringSrc.includes('manualBaqayaOutstandingCents(postSaveCustomer)'),
    'render must add unpaid manual baqaya from the post-save customer',
  );
});

test('wiring: the line renders on both success paths — split and single', () => {
  const calls = wiringSrc.match(/renderStillOwesLine\(\);/g) || [];
  assert.equal(calls.length, 2, `expected 2 render calls (split + single), found ${calls.length}`);
});

test('page: the still-owes host sits at the top of the success step', () => {
  assert.ok(pageSrc.includes('<p id="sowStillOwesLine"'), 'missing still-owes host');
  assert.ok(pageSrc.includes('class="sow-still-owes"'), 'missing still-owes class');
  assert.ok(pageSrc.includes('aria-live="polite"'), 'missing live region on the line');
  const bannerAt = pageSrc.indexOf('qc-success-banner');
  const lineAt = pageSrc.indexOf('sowStillOwesLine');
  const badgeAt = pageSrc.indexOf('osbOfflineSavedBadge');
  assert.ok(bannerAt !== -1 && lineAt !== -1 && badgeAt !== -1, 'success step hosts missing');
  assert.ok(lineAt > bannerAt, 'line must sit after the success banner');
  assert.ok(lineAt < badgeAt, 'line must sit before the saved badge and receipt card');
});

// --- Fences ---

test('fences: the still-owes module is pure — no clock, no storage, no store key', () => {
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
    'big-wallet-method-' + 'buttons.js',
    'double-tap-save-' + 'guard.js',
    'offline-saved-' + 'badge.js',
    'quick-collect-reversal-' + 'undo.js',
    'success-next-' + 'steps.js',
    'receipt-' + 'preview.js',
    'cash-change-' + 'calculator.js',
    'remembered-' + 'method.js',
    'dues-amount-' + 'default.js',
    'quick-collect-round-' + 'totals.js',
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

test('fences: the fenced modules never reference the still-owes line', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'dashboard-' + 'daily-closing.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'dues-amount-' + 'default.js',
    'success-next-' + 'steps.js',
    'quick-collect-round-' + 'totals.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('stillOwes'), `${file} must not reference the still-owes line`);
    assert.ok(!src.includes('sowStillOwesLine'), `${file} must not reference the still-owes host`);
  }
});

// --- Styles ---

test('styles: the still-owes rule reuses existing colours only — no new hex', () => {
  const rules = stylesSrc.match(/\.sow-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'missing .sow-still-owes rule');
  const baseline = stylesSrc.replace(/\.sow-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
