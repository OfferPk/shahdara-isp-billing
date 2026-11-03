// Issue #361 (continuous tracker, Part of #361 — this PR does not close it):
// the Analytics Business Health Score used to report 0–5 of 6 factors in
// realistic ledgers for two structural reasons, not because the data was
// absent:
//  1. Documented churn was unavailable whenever no one had left in the
//     window, so even a perfect ledger could never reach 6/6.
//  2. Growth and churn were all-or-nothing on added-on dates: a single
//     undated (e.g. imported legacy) profile knocked both factors out,
//     even when every other profile was dated.
// This file pins the fix: dated-subset growth/churn with the undated
// count disclosed, documented-zero churn for a known dated population,
// and a coverage line that explains a partial/empty result instead of
// leaving the user with a bare "0 of 6".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addPayment, createInitialState, saveBillMonth } from '../core.js';
import { addExpense } from '../phase3.js';
import { buildBusinessHealthScore } from '../owner-insights.js';

const today = new Date('2026-11-03T12:00:00+05:00'); // health window = 2026-08..2026-10
const customerId = 'seed-001';
const bill = (state, month, amount = 1000) => saveBillMonth(state, customerId, { month, dueAmount: String(amount), status: 'pending' }, today);
const payment = (state, month, date, amount) => addPayment(state, customerId, month, { date, amount: String(amount), method: 'Cash' }, today);

function windowHistory() {
  let state = createInitialState(['Ali']);
  state = { ...state, customers: state.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
  for (const month of ['2026-08', '2026-09', '2026-10']) {
    state = bill(state, month, 1000); state = payment(state, month, `${month}-08`, 900);
    state = addExpense(state, { date: `${month}-10`, amount: '100', category: 'Cable', notes: '' }, today);
  }
  return state;
}

test('361 health: a dated population with no leavers scores all 6 factors, churn at 0%', () => {
  const state = windowHistory();
  const before = JSON.stringify(state);
  const result = buildBusinessHealthScore(state, today);
  assert.equal(result.availableFactorCount, 6);
  assert.equal(result.unavailableFactors.length, 0);
  assert.equal(result.renormalized, false);
  const churn = result.factors.find(row => row.id === 'documentedChurn');
  assert.equal(churn.value, 0);
  assert.equal(churn.quality, 100);
  assert.equal(churn.polarity, 'positive');
  assert.ok(Math.abs(result.factors.reduce((sum, row) => sum + row.contribution, 0) - result.score) <= 0.1);
  assert.equal(JSON.stringify(state), before, 'the score must not mutate saved records');
});

test('361 health: one undated profile no longer blocks growth/churn — they use the dated subset, disclosed', () => {
  const base = windowHistory();
  const state = { ...base, customers: [...base.customers, { ...base.customers[0], id: 'legacy', customerNumber: 99, name: 'Legacy', addedOn: null }] };
  const before = JSON.stringify(state);
  const result = buildBusinessHealthScore(state, today);
  assert.equal(result.coverage.totalProfiles, 2);
  assert.equal(result.coverage.datedProfiles, 1);
  assert.equal(result.coverage.undatedProfiles, 1);
  assert.equal(result.coverage.datedSubsetUsed, true);
  assert.equal(result.availableFactorCount, 6);
  const growth = result.factors.find(row => row.id === 'customerGrowth');
  const churn = result.factors.find(row => row.id === 'documentedChurn');
  assert.equal(growth.value, 0);
  assert.equal(churn.value, 0);
  assert.match(growth.basis, /1 undated profile\(s\) excluded/);
  assert.match(churn.basis, /1 undated profile\(s\) excluded/);
  assert.equal(JSON.stringify(state), before, 'the score must not mutate saved records');
});

test('361 health: a dated churn event still scores churn from the dated population only', () => {
  const base = windowHistory();
  const state = {
    ...base,
    customers: [
      { ...base.customers[0], cancellationDate: '2026-09-10' },
      { ...base.customers[0], id: 'second', customerNumber: 2, name: 'Second', addedOn: '2026-01-01' },
      { ...base.customers[0], id: 'legacy', customerNumber: 3, name: 'Legacy', addedOn: null, cancellationDate: '2026-09-11' },
    ],
  };
  const result = buildBusinessHealthScore(state, today);
  const churn = result.factors.find(row => row.id === 'documentedChurn');
  // Dated population: 2 opening (Ali + Second) + 0 new = 2; only Ali's
  // dated event counts, so the rate is 1/2 = 50% — the undated leaver
  // is excluded from both numerator and denominator, not 2/3.
  assert.equal(churn.value, 50);
  assert.equal(churn.quality, 0);
  assert.equal(churn.polarity, 'negative');
});

test('361 health: no dated profiles at all keeps growth/churn unavailable (never guessed)', () => {
  const state = createInitialState(['Ali']); // seed profiles carry no addedOn
  const result = buildBusinessHealthScore(state, today);
  assert.equal(result.coverage.datedProfiles, 0);
  assert.equal(result.coverage.undatedProfiles, 1);
  assert.equal(result.coverage.datedSubsetUsed, false);
  assert.equal(result.factors.some(row => row.id === 'customerGrowth'), false);
  assert.equal(result.factors.some(row => row.id === 'documentedChurn'), false);
  assert.match(result.unavailableFactors.find(row => row.id === 'customerGrowth').unavailableReason, /no profile has a saved added-on date/);
  assert.match(result.unavailableFactors.find(row => row.id === 'documentedChurn').unavailableReason, /no profile has a saved added-on date/);
});

test('361 health: coverage counts explain a 0-of-6-style result — current-month bills do not count in the window', () => {
  let state = createInitialState(['Ali']);
  state = { ...state, customers: state.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
  state = bill(state, '2026-11', 1000); state = payment(state, '2026-11', '2026-11-02', 1000);
  const result = buildBusinessHealthScore(state, today);
  assert.equal(result.coverage.pricedBillCount, 0);
  assert.equal(result.coverage.receiptCount, 0);
  assert.deepEqual(result.coverage.windowMonths, ['2026-08', '2026-09', '2026-10']);
  assert.equal(result.availableFactorCount, 2, 'only the two demographic factors are available; every financial factor stays unavailable with its own next step');
  for (const id of ['collectionRate', 'outstandingRatio', 'cashProfitMargin', 'expenseRatio']) {
    const factor = result.unavailableFactors.find(row => row.id === id);
    assert.ok(factor.nextStep && factor.nextStep.startsWith('What unlocks this:'), `${id} must explain what unlocks it`);
  }
});

test('361 health UI: coverage line renders and the churn formula states the dated-population rule', () => {
  const ui = readFileSync(new URL('../owner-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /Window data:/);
  assert.match(ui, /excluded from dated growth\/churn, not counted as zero/);
  assert.match(ui, /a window with no dated cancellation\/archive event among dated profiles is 0%/);
});

test('361 health CSS: coverage line reuses existing availability styling (light + dark) and the panel stacks at phone widths', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const dark = readFileSync(new URL('../dark-contrast.css', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../owner-ui.js', import.meta.url), 'utf8');
  // The coverage line deliberately reuses .business-health-availability
  // instead of adding a new class, so it inherits the existing light
  // colour and the dark-contrast lift for that class — no new stylesheet
  // rules, and no new hard-coded light background to leak into dark mode.
  assert.match(ui, /<p class="business-health-availability" role="status">\$\{escapeHtml\(coverageText\)\}<\/p>/);
  assert.match(styles, /\.business-health-availability/);
  assert.match(dark, /business-health-availability/);
  assert.match(styles, /@media\(max-width:620px\)\{\.business-health-panel[\s\S]*?\.business-health-factor-grid\{grid-template-columns:1fr\}/);
});
