// Plan 387 — Transaction underpayment warning with remaining dues
// shown: while the operator types a part-payment on the transaction
// entry form, the warning says in plain words what the typed amount
// pays, what the dues total, and what remains after this payment —
// so a customer who pays half leaves knowing they paid half. It
// warns only and blocks nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  underpaymentRemainingCents,
  underpaymentWarning,
  underpaymentWarningLineText,
  underpaymentWarningMarkup,
} from '../underpayment-warning.js';
import {
  addPayment,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../underpayment-warning.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan387-underpayment-warning.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';
const DUES_9000 = 900000;

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDuesCents(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues;
}

function pay(state, month, amount, date, referenceDate) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash' }, referenceDate);
}

// ---- Module units: the remaining figure ----

test('Plan 387: the remaining is the dues minus the entered amount', () => {
  assert.equal(underpaymentRemainingCents(300000, 150000), 150000);
  assert.equal(underpaymentRemainingCents(900000, 150000), 750000);
  assert.equal(underpaymentRemainingCents(900000, 899999), 1);
  assert.equal(underpaymentRemainingCents('900000', '150000'), 750000);
  // Fractional cents round to whole cents, like the rest of the app.
  assert.equal(underpaymentRemainingCents(900000, 150000.4), 750000);
  assert.equal(underpaymentRemainingCents(900000, 150000.6), 749999);
});

test('Plan 387: the remaining is 0 when the amount covers the dues, or there are no dues', () => {
  assert.equal(underpaymentRemainingCents(900000, 900000), 0);
  assert.equal(underpaymentRemainingCents(900000, 950000), 0);
  assert.equal(underpaymentRemainingCents(900000, 0), 0);
  assert.equal(underpaymentRemainingCents(0, 150000), 0);
  assert.equal(underpaymentRemainingCents(0, 0), 0);
  assert.equal(underpaymentRemainingCents(-500000, 150000), 0);
  assert.equal(underpaymentRemainingCents(900000, -150000), 0);
});

test('Plan 387: the remaining ignores unusable figures instead of inventing a warning', () => {
  assert.equal(underpaymentRemainingCents(null, 150000), 0);
  assert.equal(underpaymentRemainingCents(undefined, 150000), 0);
  assert.equal(underpaymentRemainingCents(900000, null), 0);
  assert.equal(underpaymentRemainingCents(900000, undefined), 0);
  assert.equal(underpaymentRemainingCents(900000, ''), 0);
  assert.equal(underpaymentRemainingCents(900000, true), 0);
  assert.equal(underpaymentRemainingCents(900000, 'not a number'), 0);
  assert.equal(underpaymentRemainingCents(NaN, 150000), 0);
  assert.equal(underpaymentRemainingCents(900000, NaN), 0);
});

// ---- Module units: the warning record ----

test('Plan 387: the warning carries the amount, the dues, and the remaining', () => {
  assert.deepEqual(underpaymentWarning(900000, 150000), {
    amountCents: 150000, duesCents: 900000, remainingCents: 750000,
  });
  assert.deepEqual(underpaymentWarning(300000, 150000), {
    amountCents: 150000, duesCents: 300000, remainingCents: 150000,
  });
  assert.deepEqual(underpaymentWarning('900000', '150000'), {
    amountCents: 150000, duesCents: 900000, remainingCents: 750000,
  });
});

test('Plan 387: the warning is null whenever there is nothing to warn about', () => {
  assert.equal(underpaymentWarning(900000, 900000), null);
  assert.equal(underpaymentWarning(900000, 950000), null);
  assert.equal(underpaymentWarning(900000, 0), null);
  assert.equal(underpaymentWarning(0, 150000), null);
  assert.equal(underpaymentWarning(0, 0), null);
  assert.equal(underpaymentWarning(null, 150000), null);
  assert.equal(underpaymentWarning(900000, null), null);
  assert.equal(underpaymentWarning(900000, ''), null);
  assert.equal(underpaymentWarning(900000, true), null);
  assert.equal(underpaymentWarning(900000, 'not a number'), null);
  assert.equal(underpaymentWarning(-500000, 150000), null);
  assert.equal(underpaymentWarning(900000, -150000), null);
});

// ---- Module units: plain words and markup ----

test('Plan 387: the warning in plain words names the amount, the dues, and what remains', () => {
  assert.equal(
    underpaymentWarningLineText({ amountCents: 150000, duesCents: 300000, remainingCents: 150000 }),
    'Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due',
  );
  assert.equal(
    underpaymentWarningLineText({ amountCents: 750000, duesCents: 900000, remainingCents: 150000 }),
    'Paid PKR 7,500 of PKR 9,000 dues — PKR 1,500 still due',
  );
  assert.equal(
    underpaymentWarningLineText({ amountCents: 50, duesCents: 300000, remainingCents: 299950 }),
    'Paid PKR 0.5 of PKR 3,000 dues — PKR 2,999.5 still due',
  );
});

test('Plan 387: the line text recomputes the remaining from the two figures, never trusting a stored one', () => {
  // A damaged record whose stored remaining disagrees with dues
  // minus amount still prints the true remaining.
  assert.equal(
    underpaymentWarningLineText({ amountCents: 150000, duesCents: 300000, remainingCents: 999999 }),
    'Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due',
  );
  // No stored remaining at all still works: it is dues minus amount.
  assert.equal(
    underpaymentWarningLineText({ amountCents: 150000, duesCents: 300000 }),
    'Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due',
  );
});

test('Plan 387: the line text returns nothing for a damaged or no-warning record', () => {
  assert.equal(underpaymentWarningLineText(null), '');
  assert.equal(underpaymentWarningLineText({}), '');
  assert.equal(underpaymentWarningLineText({ amountCents: null, duesCents: 300000 }), '');
  assert.equal(underpaymentWarningLineText({ amountCents: 150000 }), '');
  assert.equal(underpaymentWarningLineText({ amountCents: 300000, duesCents: 300000, remainingCents: 0 }), '');
  assert.equal(underpaymentWarningLineText({ amountCents: 350000, duesCents: 300000, remainingCents: -50000 }), '');
});

test('Plan 387: the line text takes labels for another language', () => {
  assert.equal(
    underpaymentWarningLineText(
      { amountCents: 150000, duesCents: 300000, remainingCents: 150000 },
      { paid: 'ادا', of: 'از', dues: 'واجبات', stillDue: 'باقی' },
    ),
    'ادا PKR 1,500 از PKR 3,000 واجبات — PKR 1,500 باقی',
  );
  // A missing label falls back to the English word, never to blank.
  assert.equal(
    underpaymentWarningLineText(
      { amountCents: 150000, duesCents: 300000, remainingCents: 150000 },
      { stillDue: 'باقی' },
    ),
    'Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 باقی',
  );
});

test('Plan 387: the markup is the escaped line, or nothing when there is no warning', () => {
  assert.equal(
    underpaymentWarningMarkup({ amountCents: 150000, duesCents: 300000, remainingCents: 150000 }),
    'Paid PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due',
  );
  assert.equal(underpaymentWarningMarkup(null), '');
  assert.equal(underpaymentWarningMarkup({}), '');
  assert.equal(underpaymentWarningMarkup({ amountCents: 300000, duesCents: 300000, remainingCents: 0 }), '');
  assert.equal(
    underpaymentWarningMarkup(
      { amountCents: 150000, duesCents: 300000, remainingCents: 150000 },
      { paid: '<Paid>', of: 'of', dues: 'dues', stillDue: 'still due' },
    ),
    '&lt;Paid&gt; PKR 1,500 of PKR 3,000 dues — PKR 1,500 still due',
  );
});

test('Plan 387: warning twice returns the same line — the warning is deterministic', () => {
  const warning = underpaymentWarning(900000, 150000);
  assert.equal(underpaymentWarningLineText(warning), underpaymentWarningLineText(warning));
  assert.equal(underpaymentWarningLineText(warning), 'Paid PKR 1,500 of PKR 9,000 dues — PKR 7,500 still due');
});

// ---- Acceptance: the remaining figure matches the saved allocation ----

test('Plan 387: acceptance — the remaining figure matches the dues minus the entered amount on the same fixture', () => {
  const state = stateWithBills(NOV_6);
  assert.equal(totalDuesCents(state), DUES_9000);
  // Before saving, the warning says PKR 7,500 remains on PKR 9,000 dues.
  assert.equal(underpaymentRemainingCents(totalDuesCents(state), 150000), 750000);
  assert.equal(
    underpaymentWarningLineText(underpaymentWarning(totalDuesCents(state), 150000)),
    'Paid PKR 1,500 of PKR 9,000 dues — PKR 7,500 still due',
  );
  // After the payment is saved, the dues left are exactly the warned figure.
  const next = pay(state, '2026-10', '1500', PAYMENT_DATE, NOV_6);
  assert.equal(totalDuesCents(next), 750000);
  const allocations = calculatePaymentAllocations(next);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 150000);
  assert.equal(allocations.forMonth('seed-001', '2026-09').balanceDueCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
});

test('Plan 387: acceptance — changing the amount updates the warning', () => {
  assert.equal(underpaymentRemainingCents(DUES_9000, 150000), 750000);
  assert.equal(underpaymentRemainingCents(DUES_9000, 300000), 600000);
  assert.equal(underpaymentRemainingCents(DUES_9000, 899999), 1);
  assert.equal(underpaymentWarning(DUES_9000, 900000), null);
  assert.equal(underpaymentWarning(DUES_9000, 950000), null);
  assert.equal(
    underpaymentWarningLineText(underpaymentWarning(DUES_9000, 300000)),
    'Paid PKR 3,000 of PKR 9,000 dues — PKR 6,000 still due',
  );
});

test('Plan 387: acceptance — the warning never changes any bill, payment, or customer record by itself', () => {
  const state = stateWithBills(NOV_6);
  const before = JSON.stringify(state.customers);
  const balancesBefore = ['2026-09', '2026-10', '2026-11'].map(
    (month) => calculatePaymentAllocations(state).forMonth('seed-001', month).balanceDueCents,
  );
  // Warning about the fixture's dues, several times over.
  for (const amount of [150000, 300000, 899999]) {
    underpaymentWarning(totalDuesCents(state), amount);
    underpaymentWarningLineText(underpaymentWarning(totalDuesCents(state), amount));
    underpaymentWarningMarkup(underpaymentWarning(totalDuesCents(state), amount));
  }
  assert.equal(JSON.stringify(state.customers), before, 'the records must be byte-identical after warning');
  const balancesAfter = ['2026-09', '2026-10', '2026-11'].map(
    (month) => calculatePaymentAllocations(state).forMonth('seed-001', month).balanceDueCents,
  );
  assert.deepEqual(balancesAfter, balancesBefore, 'no balance may move because a warning was shown');
});

// ---- Wiring: the entry form warns as the amount is typed ----

test('Plan 387: the entry form imports the warning and renders it', () => {
  assert.ok(navSrc.includes("import { underpaymentWarning, underpaymentWarningLineText } from './underpayment-warning.js';"));
  assert.ok(navSrc.includes('function renderUnderpaymentWarning()'));
  assert.ok(navSrc.includes("document.getElementById('quickCollectUnderpaymentWarning')"));
  assert.ok(navSrc.includes('underpaymentWarningLine.textContent = line;'));
  assert.ok(navSrc.includes('underpaymentWarningLine.hidden = line === \'\';'));
});

test('Plan 387: the warning reads the same live dues the settlement preview reads', () => {
  const fn = navSrc.slice(navSrc.indexOf('function renderUnderpaymentWarning()'));
  assert.ok(fn.includes('calculatePaymentAllocations(state)'));
  assert.ok(fn.includes("allocations.forMonth(customer.id, bill.month)?.balanceDueCents"));
  assert.ok(fn.includes('underpaymentWarning(duesCents, amountCents)'));
  assert.ok(fn.includes('underpaymentWarningLineText(warning)'));
});

test('Plan 387: the warning refreshes on every keystroke, month, Advance, split, open, chip, and keypad tap', () => {
  const calls = navSrc.match(/renderUnderpaymentWarning\(\)/g) || [];
  // Definition plus nine refresh sites: month change, amount input,
  // Advance toggle, split toggle, form open, quick-amount chip,
  // loose-change chip, amount keypad, Add payment dues buttons.
  // Plan 442: the amount keypad is the eighth refresh site — a
  // keypad tap sets the amount, so the warning re-shows like
  // every other programmatic amount set.
  // Plan 489: the Add payment dues buttons are the ninth refresh
  // site — a button tap fills the amount, so the warning re-shows
  // like every other programmatic amount set. The count moves from
  // 9 to 10 for that one new call site only; the intent (the warning
  // refreshes on every programmatic amount set) is unchanged.
  assert.equal(calls.length, 10, `expected 10 renderUnderpaymentWarning() sites, found ${calls.length}`);
});

test('Plan 387: the warning hides while Advance is ticked and on a split payment', () => {
  const fn = navSrc.slice(
    navSrc.indexOf('function renderUnderpaymentWarning()'),
    navSrc.indexOf('function buildSaveConfirmationSummary()'),
  );
  assert.ok(fn.includes('!advanceCheckbox?.checked'), 'an advance-tagged payment is not a dues payment');
  assert.ok(fn.includes('!splitToggle?.checked'), 'a split leg alone must not warn');
});

test('Plan 387: the warning line sits on the entry form after the overpayment choice', () => {
  const choiceAt = indexSrc.indexOf('id="quickCollectOverpaymentChoice"');
  const warningAt = indexSrc.indexOf('id="quickCollectUnderpaymentWarning"');
  assert.ok(choiceAt > 0 && warningAt > choiceAt, 'the warning line must follow the overpayment choice box');
  assert.ok(indexSrc.includes('<p id="quickCollectUnderpaymentWarning" class="upw-warning" hidden></p>'));
  const chipsAt = indexSrc.indexOf('qc-quick-amount-chips');
  assert.ok(warningAt < chipsAt, 'the warning line must sit above the quick-amount chips');
});

test('Plan 387: the warning style reuses the amber tokens and introduces no new hex', () => {
  const rules = stylesSrc.match(/\.upw-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, `expected warning rules, found ${rules.length}`);
  assert.ok(rules.join(' ').includes('var(--amber-bg)'), 'the warning must reuse the amber background token');
  assert.ok(rules.join(' ').includes('var(--amber)'), 'the warning must reuse the amber text token');
  const baseline = stylesSrc.replace(/\.upw-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

// ---- Guards ----

test('Plan 387: the module is pure — no page, storage, clock, network, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'import ', 'shahdara_', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
  // Exactly the four intended exports, no more.
  const exports = moduleSrc.match(/^export function \w+/gm) || [];
  assert.deepEqual(exports, [
    'export function underpaymentRemainingCents',
    'export function underpaymentWarning',
    'export function underpaymentWarningLineText',
    'export function underpaymentWarningMarkup',
  ]);
});

test('Plan 387: the module never names a fenced neighbour', () => {
  // Fragment-built so this test itself never spells the fenced names.
  const fenced = [
    'partial-settlement-' + 'preview.js',
    'overpayment-' + 'choice.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 387: no real customer names in the module or this test', () => {
  // Fragment-built so this test itself never spells the real names.
  const names = ['Sa' + 'ad', 'Kir' + 'an', 'Hai' + 'der', 'Shun' + 'aid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi'];
  for (const name of names) {
    assert.ok(!moduleSrc.includes(name), `module must not contain ${name}`);
    assert.ok(!testSrc.includes(name), `test must not contain ${name}`);
  }
});
