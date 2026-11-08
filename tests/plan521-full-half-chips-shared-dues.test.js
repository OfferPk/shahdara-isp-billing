// Plan 521 — Full and Half chips use the shared dues rule: the entry
// form's "Full" and "50%" chips, the Plan 489 Full/Half dues buttons
// and the one screen's Full/Half dues buttons all fill from the same
// figure — the Plan 429 full-dues default (activeDefaults
// .suggestedAmount) — half of it rounded to whole rupees, filling
// nothing when it works out to nothing. The old chip base (the
// oldest open bill only) and the invented Rs 500 half fallback are
// gone; the one-screen comment that claimed a difference from the
// entry chip is fixed, and the dues-buttons header no longer
// describes the old chip base. The Monthly chip is untouched: it
// still falls back to the oldest-bill / total-dues figure when
// neither the current month nor the full dues offer anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getCustomerPaymentDefaults,
} from '../nav-quick-collect.js';
import {
  addPaymentDuesFigures,
} from '../add-payment-dues-buttons.js';
import {
  oneScreenQuickAmountFigures,
} from '../one-screen-quick-amounts.js';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const oneScreenSrc = readFileSync(new URL('../one-screen-quick-amounts.js', import.meta.url), 'utf8');
const duesButtonsSrc = readFileSync(new URL('../add-payment-dues-buttons.js', import.meta.url), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);

// Dues split across bills: three Rs 1,000 monthly bills (Sep, Oct,
// Nov 2026) — the oldest open bill is Rs 1,000, the full dues are
// Rs 3,000. The fixture discriminates the old chip base (oldest
// bill only) from the shared rule (full dues), with the design's
// example figures (dues Rs 3,000, oldest bill Rs 1,000, half
// Rs 1,500).
function stateWithSplitDues(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '1000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

// A customer with no bills at all: no dues, no prefill, no default.
function stateWithNoDues() {
  return createInitialState(['Customer One']);
}

function chipRefreshBlock() {
  const start = wiringSrc.indexOf('// Update quick amount chips dynamic amounts (#281)');
  assert.ok(start >= 0, 'chip refresh block must exist');
  const end = wiringSrc.indexOf("// Plan 489: the form step's full-dues / half-dues buttons", start);
  assert.ok(end > start, 'chip refresh block must end at the Plan 489 buttons');
  return wiringSrc.slice(start, end);
}

function chipClickBlock() {
  const start = wiringSrc.indexOf('// Wire quick amount helper chips');
  assert.ok(start >= 0, 'chip click wiring must exist');
  const end = wiringSrc.indexOf('// Plan 442: the on-screen numeric keypad host', start);
  assert.ok(end > start, 'chip click wiring must end at the keypad host');
  return wiringSrc.slice(start, end);
}

test('acceptance: the fixture splits Rs 3,000 of dues across bills while the oldest bill is Rs 1,000', () => {
  const state = stateWithSplitDues(NOV_6);
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', NOV_6);
  assert.equal(defaults.balanceDue, 1000, 'oldest open bill only — the old chip base');
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.suggestedAmount, 3000, 'Plan 429 full-dues default — the shared chip base');
});

test('acceptance: every half control fills Rs 1,500 on the same fixture', () => {
  const state = stateWithSplitDues(NOV_6);
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', NOV_6);
  const fullDues = defaults.suggestedAmount;
  assert.equal(fullDues, 3000);
  // Plan 489 Half dues button.
  assert.deepEqual(addPaymentDuesFigures({ fullDues }), { full: 3000, half: 1500 });
  // One-screen Half dues button.
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues }),
    { full: 3000, half: 1500, package: null },
  );
  // Entry-form 50% chip: its click handler fills from the same
  // figures function, on the same figure — not from the oldest
  // bill, and never from the invented Rs 500 fallback.
  const click = chipClickBlock();
  assert.ok(
    click.includes('addPaymentDuesFigures({ fullDues: activeDefaults.suggestedAmount })'),
    'entry chip must fill from the shared figures on suggestedAmount',
  );
  assert.ok(click.includes('if (chipFigures.half !== null) amountInput.value = chipFigures.half.toFixed(2);'));
  assert.ok(!click.includes('(half > 0 ? half : 500)'), 'the invented Rs 500 fallback must be gone');
});

test('acceptance: tapping Full fills total dues, the same figure as the prefill and the Full dues button', () => {
  const state = stateWithSplitDues(NOV_6);
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', NOV_6);
  assert.equal(defaults.suggestedAmount, 3000, 'the field prefill (Plan 429) is the full dues');
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: defaults.suggestedAmount }).full,
    3000,
    'the Plan 489 Full dues button fills the full dues',
  );
  const click = chipClickBlock();
  assert.ok(click.includes('if (chipFigures.full !== null) amountInput.value = chipFigures.full.toFixed(2);'));
});

test('acceptance: a zero-dues customer gets no fill from any half control (never Rs 500)', () => {
  const state = stateWithNoDues();
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', NOV_6);
  assert.equal(defaults.suggestedAmount, 0);
  assert.deepEqual(addPaymentDuesFigures({ fullDues: 0 }), { full: null, half: null });
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 0 }),
    { full: null, half: null, package: null },
  );
  // The entry chip fills nothing when the figure works out to
  // nothing — its Full and 50% fills are guarded, and no Rs 500
  // fallback survives anywhere in the wiring file.
  const click = chipClickBlock();
  assert.ok(click.includes('if (chipFigures.full !== null) amountInput.value = chipFigures.full.toFixed(2);'));
  assert.ok(click.includes('if (chipFigures.half !== null) amountInput.value = chipFigures.half.toFixed(2);'));
  assert.ok(!wiringSrc.includes('(half > 0 ? half : 500)'), 'no Rs 500 fallback anywhere in the wiring');
});

test('wiring: the chip refresh labels Full and 50% from the shared figures', () => {
  const refresh = chipRefreshBlock();
  assert.ok(
    refresh.includes('addPaymentDuesFigures({ fullDues: activeDefaults.suggestedAmount })'),
    'refresh must label from the shared figures on suggestedAmount',
  );
  assert.ok(refresh.includes("chip.textContent = `Full (Rs ${fullBal > 0 ? fullBal.toLocaleString('en-PK') : '0'})`;"));
  assert.ok(refresh.includes("chip.textContent = `50% (Rs ${halfBal > 0 ? halfBal.toLocaleString('en-PK') : '0'})`;"));
  assert.ok(!refresh.includes('const baseBal = (activeDefaults.ticketChargesPending'), 'the oldest-bill base must not drive Full/50% any more');
});

test('wiring: the Monthly chip still falls back to the oldest-bill / total-dues figure', () => {
  const refresh = chipRefreshBlock();
  assert.ok(refresh.includes('monthlyFallbackBal'), 'Monthly keeps its own fallback figure');
  assert.ok(refresh.includes("chip.textContent = `Monthly (Rs ${curBal > 0 ? curBal.toLocaleString('en-PK') : (monthlyFallbackBal > 0 ? monthlyFallbackBal.toLocaleString('en-PK') : '0')})`;"));
  const click = chipClickBlock();
  assert.ok(click.includes("amountInput.value = (cur > 0 ? cur : baseBalance).toFixed(2);"));
});

test('comments: the one-screen comment states the shared rule, not a difference from the entry chip', () => {
  assert.ok(!oneScreenSrc.includes('One deliberate difference from that chip'), 'the claimed difference is gone — all three surfaces share the rule now');
  assert.ok(oneScreenSrc.includes('Plan 521'), 'the one-screen comment names the plan that unified the rule');
});

test('comments: the dues-buttons header no longer describes the old chip base', () => {
  assert.ok(!duesButtonsSrc.includes("fill the oldest bill's balance"), 'the header must not describe the retired chip base');
  assert.ok(duesButtonsSrc.includes('Plan 521'), 'the dues-buttons header names the plan that unified the rule');
});
