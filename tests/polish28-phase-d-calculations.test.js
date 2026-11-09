/**
 * polish28-phase-d-calculations.test.js — Polish #28 Phase D of the
 * profile seven-sections programme (calculations).
 *
 * The profile's figures are now honest arithmetic, not copied labels:
 *  - "Monthly package profit" is renamed "Monthly gross profit"
 *    (gross = monthly selling amount − monthly provider purchase cost);
 *  - net = gross − concession this month − payment discounts this month
 *    (sales tax is a pass-through and is NEVER subtracted);
 *  - the installation investment is an itemised breakdown (router +
 *    fiber + labor + other) reusing calculateInstallationCost, with a
 *    new optional field otherInstallCost;
 *  - the recovery period is ceil(investment ÷ monthly gross profit)
 *    when both are positive, and an honest dash + missing note
 *    otherwise; a "Recovered" state appears once cumulative gross
 *    profit since the connection date has covered the investment;
 *  - the 69-key field map gains one key (otherInstallCost), so the
 *    displayed counter moves 67 → 68 (prefersSms + paused excluded,
 *    Plan 513);
 *  - the view and the form preview share ONE implementation
 *    (profile-profit.js) — they can no longer drift apart.
 *
 * The pure module is imported dynamically so the pre-fix check fails
 * per test instead of failing the whole file at load. Synthetic data
 * only — no real customer names, no realistic phone numbers
 * (pattern-fake digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, calculatePaymentAllocations
} from '../core.js';
import { calculateInstallationCost } from '../installation-cost.js';
import { PROFILE_FIELD_SAVE_MAP } from '../profile-field-save.js';
import { countProfileCompletion } from '../profile-completion.js';

const MONTH = '2026-11';

const loadProfitModule = () => import('../profile-profit.js');

const appJs = () => readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navLanguageJs = () => readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const indexHtml = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const profileUiJs = () => readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
const coreJs = () => readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const installationCostJs = () => readFileSync(new URL('../installation-cost.js', import.meta.url), 'utf8');
const profileFieldSaveJs = () => readFileSync(new URL('../profile-field-save.js', import.meta.url), 'utf8');

/** One synthetic customer with the given money fields and bills. */
const customerOf = (overrides = {}) => ({
  id: 'phase-d-001',
  name: 'PhaseD Tester',
  monthlySellingAmount: 3000,
  monthlyPurchaseCost: 1000,
  bills: [],
  ...overrides,
});

const stateOf = (customer) => ({ customers: [customer] });

// ---------------------------------------------------------------- gross

test('gross profit is monthly selling amount minus provider purchase cost', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  assert.equal(profileGrossProfit(customerOf()), 2000);
});

test('gross profit is null when the provider cost is missing (null, undefined, empty)', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  assert.equal(profileGrossProfit(customerOf({ monthlyPurchaseCost: null })), null);
  assert.equal(profileGrossProfit(customerOf({ monthlyPurchaseCost: undefined })), null);
  assert.equal(profileGrossProfit(customerOf({ monthlyPurchaseCost: '' })), null);
});

test('gross profit is null when the selling amount is missing (null, undefined, empty)', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  assert.equal(profileGrossProfit(customerOf({ monthlySellingAmount: null })), null);
  assert.equal(profileGrossProfit(customerOf({ monthlySellingAmount: undefined })), null);
  assert.equal(profileGrossProfit(customerOf({ monthlySellingAmount: '' })), null);
});

test('gross profit is null for a non-numeric figure, never a guessed number', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  assert.equal(profileGrossProfit(customerOf({ monthlySellingAmount: 'abc' })), null);
  assert.equal(profileGrossProfit(customerOf({ monthlyPurchaseCost: 'abc' })), null);
});

test('gross profit may be negative — a loss is a figure, not a missing value', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  assert.equal(profileGrossProfit(customerOf({ monthlySellingAmount: 1000, monthlyPurchaseCost: 1500 })), -500);
});

test('gross profit agrees with the existing customerPackageProfit formula', async () => {
  const { profileGrossProfit } = await loadProfitModule();
  const { customerPackageProfit } = await import('../core.js');
  for (const [selling, cost] of [[3000, 1000], [1500, 0], [2000, 2000], [1000, 1500]]) {
    assert.equal(
      profileGrossProfit(customerOf({ monthlySellingAmount: selling, monthlyPurchaseCost: cost })),
      customerPackageProfit(customerOf({ monthlySellingAmount: selling, monthlyPurchaseCost: cost })),
      `selling ${selling}, cost ${cost}`,
    );
  }
});

// ---------------------------------------------------------------- tax

test('tax is the 19.5% sales tax on the selling amount, in rupees', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const result = profileMonthlyProfit(customerOf(), stateOf(customerOf()), MONTH);
  assert.equal(result.tax, 585);
});

test('tax is null when there is no package price to tax', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const result = profileMonthlyProfit(
    customerOf({ monthlySellingAmount: null, monthlyPurchaseCost: null }),
    stateOf(customerOf({ monthlySellingAmount: null, monthlyPurchaseCost: null })),
    MONTH,
  );
  assert.equal(result.tax, null);
});

// ------------------------------------------------- concession / discounts

const billOf = (overrides = {}) => ({
  month: MONTH,
  dueAmount: 1000,
  concessionAmount: 0,
  payments: [],
  ...overrides,
});

test('concession this month reads the current bill concessionAmount', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({ bills: [billOf({ concessionAmount: 100 })] });
  assert.equal(profileMonthlyProfit(customer, stateOf(customer), MONTH).concession, 100);
});

test('concession is PKR 0 when a bill exists with no concession', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({ bills: [billOf()] });
  assert.equal(profileMonthlyProfit(customer, stateOf(customer), MONTH).concession, 0);
});

test('concession is null — never assumed zero — when no bill exists this month', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const result = profileMonthlyProfit(customerOf(), stateOf(customerOf()), MONTH);
  assert.equal(result.concession, null);
  assert.ok(result.missing.includes('bill'));
});

test('payment discounts this month sum the discounts applied to this month bill', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({
    bills: [billOf({
      payments: [{ id: 'p1', date: '2026-11-02', amount: 900, discount: 100, method: 'Cash' }],
    })],
  });
  // The allocation engine must see the same discount, so the figure is
  // the engine's, not a hand sum.
  assert.equal(
    calculatePaymentAllocations(stateOf(customer)).forMonth('phase-d-001', MONTH)?.discountAppliedCents,
    10000,
    'precondition: engine applies PKR 100 of discount',
  );
  assert.equal(profileMonthlyProfit(customer, stateOf(customer), MONTH).discounts, 100);
});

test('discounts are PKR 0 when a bill exists and no payment carried a discount', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({
    bills: [billOf({ payments: [{ id: 'p1', date: '2026-11-02', amount: 1000, method: 'Cash' }] })],
  });
  assert.equal(profileMonthlyProfit(customer, stateOf(customer), MONTH).discounts, 0);
});

test('discounts are null — never assumed zero — when no bill exists this month', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const result = profileMonthlyProfit(customerOf(), stateOf(customerOf()), MONTH);
  assert.equal(result.discounts, null);
  assert.ok(result.missing.includes('bill'));
});

// ------------------------------------------------------------------ net

test('net is gross minus concession minus payment discounts', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({
    bills: [billOf({
      concessionAmount: 100,
      payments: [{ id: 'p1', date: '2026-11-02', amount: 900, discount: 100, method: 'Cash' }],
    })],
  });
  assert.equal(profileMonthlyProfit(customer, stateOf(customer), MONTH).net, 1800);
});

test('net does NOT subtract sales tax — tax is a pass-through', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({ bills: [billOf({ concessionAmount: 100 })] });
  const result = profileMonthlyProfit(customer, stateOf(customer), MONTH);
  assert.equal(result.tax, 585, 'precondition: tax exists on this customer');
  assert.equal(result.net, 1900, '2000 gross − 100 concession; the 585 tax stays out');
});

test('net is null when there is no bill this month, with the bill named as missing', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const result = profileMonthlyProfit(customerOf(), stateOf(customerOf()), MONTH);
  assert.equal(result.net, null);
  assert.ok(result.missing.includes('bill'));
});

test('net is null when the gross is missing, with the missing part named', async () => {
  const { profileMonthlyProfit } = await loadProfitModule();
  const customer = customerOf({ monthlyPurchaseCost: null, bills: [billOf()] });
  const result = profileMonthlyProfit(customer, stateOf(customer), MONTH);
  assert.equal(result.net, null);
  assert.ok(result.missing.includes('providerCost'));
});

// --------------------------------------------------- investment breakdown

test('investment breakdown sums router + fiber + labor + other', async () => {
  const { profileInvestmentBreakdown } = await loadProfitModule();
  const breakdown = profileInvestmentBreakdown(customerOf({
    routerPrice: 2000,
    mediaConverterCost: 500,
    linemanInstallFee: 1000,
    fiberMeters: 100,
    fiberPerMeterRate: 25,
    otherInstallCost: 300,
  }));
  assert.equal(breakdown.router, 2000);
  assert.equal(breakdown.mediaConverter, 500);
  assert.equal(breakdown.lineman, 1000);
  assert.equal(breakdown.fiber, 2500);
  assert.equal(breakdown.other, 300);
  assert.equal(breakdown.total, 6300);
  assert.deepEqual(breakdown.missing, []);
});

test('investment breakdown names every missing component — never a silent zero', async () => {
  const { profileInvestmentBreakdown } = await loadProfitModule();
  const breakdown = profileInvestmentBreakdown(customerOf({ routerPrice: 2000 }));
  assert.equal(breakdown.router, 2000);
  assert.equal(breakdown.mediaConverter, null);
  assert.equal(breakdown.lineman, null);
  assert.equal(breakdown.fiber, null);
  assert.equal(breakdown.other, null);
  assert.equal(breakdown.total, 2000, 'the total is the recorded part only');
  assert.ok(breakdown.missing.includes('mediaConverterCost'));
  assert.ok(breakdown.missing.includes('linemanInstallFee'));
  assert.ok(breakdown.missing.includes('fiber'));
  assert.ok(breakdown.missing.includes('otherInstallCost'));
});

test('investment breakdown is null when nothing at all is recorded', async () => {
  const { profileInvestmentBreakdown } = await loadProfitModule();
  const breakdown = profileInvestmentBreakdown(customerOf());
  assert.equal(breakdown.total, null);
  assert.equal(breakdown.hasAnyCost, false);
});

test('fiber is missing when meters exist but no rate is recorded', async () => {
  const { profileInvestmentBreakdown } = await loadProfitModule();
  const breakdown = profileInvestmentBreakdown(customerOf({ fiberMeters: 100 }));
  assert.equal(breakdown.fiber, null);
  assert.ok(breakdown.missing.includes('fiber'));
});

test('fiber is PKR 0 — not missing — when zero meters were used', async () => {
  const { profileInvestmentBreakdown } = await loadProfitModule();
  const breakdown = profileInvestmentBreakdown(customerOf({ fiberMeters: 0, routerPrice: 1000 }));
  assert.equal(breakdown.fiber, 0);
  assert.ok(!breakdown.missing.includes('fiber'));
});

test('calculateInstallationCost now includes otherInstallCost in its total', () => {
  const result = calculateInstallationCost({ routerPrice: 1000, otherInstallCost: 300 });
  assert.equal(result.otherInstallCost, 300);
  assert.equal(result.totalCost, 1300);
  assert.equal(
    calculateInstallationCost({ routerPrice: 1000 }).totalCost,
    1000,
    'records without the new field are unchanged',
  );
});

// ------------------------------------------------------------- recovery

test('recovery period is ceil(investment ÷ monthly gross profit)', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf({
    routerPrice: 6300,
    connectionDate: '2026-10-15',
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'forward');
  assert.equal(result.months, 4, '6300 ÷ 2000 = 3.15, rounded up to whole months');
  assert.equal(result.investment, 6300);
  assert.equal(result.gross, 2000);
});

test('recovery period is exact when the investment divides evenly', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf({
    routerPrice: 6000,
    connectionDate: '2026-10-15',
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'forward');
  assert.equal(result.months, 3);
});

test('no recovery period when gross profit is zero or negative', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const zero = profileInvestmentRecovery(customerOf({
    monthlySellingAmount: 1000, monthlyPurchaseCost: 1000, routerPrice: 5000,
  }), { today: '2026-11-10' });
  assert.equal(zero.kind, 'gross-not-positive');
  assert.equal(zero.months, null);
  const loss = profileInvestmentRecovery(customerOf({
    monthlySellingAmount: 1000, monthlyPurchaseCost: 1500, routerPrice: 5000,
  }), { today: '2026-11-10' });
  assert.equal(loss.kind, 'gross-not-positive');
  assert.equal(loss.gross, -500, 'the negative figure is reported, not hidden');
});

test('no recovery period when gross profit cannot be computed', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf({
    monthlyPurchaseCost: null, routerPrice: 5000,
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'gross-missing');
  assert.equal(result.months, null);
  assert.ok(result.missing.includes('providerCost'));
});

test('no recovery period when no investment is recorded', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf(), { today: '2026-11-10' });
  assert.equal(result.kind, 'no-investment');
  assert.equal(result.months, null);
});

test('zero investment means nothing to recover', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf({
    fiberMeters: 0, routerPrice: 0,
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'nothing-to-recover');
});

test('Recovered when cumulative gross profit since connection covers the investment', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  // Connected 2026-08-15, today 2026-11-10: 2 full months × PKR 2,000
  // = PKR 4,000 of gross profit, which covers a PKR 3,000 investment.
  const result = profileInvestmentRecovery(customerOf({
    routerPrice: 3000,
    connectionDate: '2026-08-15',
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'recovered');
  assert.equal(result.months, 2);
  assert.equal(result.cumulativeGross, 4000);
});

test('not yet Recovered when cumulative gross profit is still short', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  // 2 full months × PKR 2,000 = PKR 4,000 — short of a PKR 6,300 investment.
  const result = profileInvestmentRecovery(customerOf({
    routerPrice: 6300,
    connectionDate: '2026-08-15',
  }), { today: '2026-11-10' });
  assert.equal(result.kind, 'forward');
  assert.equal(result.months, 4);
  assert.equal(result.cumulativeGross, 4000);
});

test('without a connection date the forward period stands and the gap is flagged', async () => {
  const { profileInvestmentRecovery } = await loadProfitModule();
  const result = profileInvestmentRecovery(customerOf({ routerPrice: 6300 }), { today: '2026-11-10' });
  assert.equal(result.kind, 'forward');
  assert.equal(result.months, 4);
  assert.equal(result.connectionDateMissing, true);
});

test('full months since connection count completed calendar months only', async () => {
  const { fullMonthsSinceConnection } = await loadProfitModule();
  assert.equal(fullMonthsSinceConnection('2026-08-15', '2026-11-10'), 2);
  assert.equal(fullMonthsSinceConnection('2026-08-10', '2026-11-10'), 3);
  assert.equal(fullMonthsSinceConnection('2026-11-10', '2026-11-10'), 0);
  assert.equal(fullMonthsSinceConnection('2026-12-01', '2026-11-10'), 0, 'a future date is never negative');
  assert.equal(fullMonthsSinceConnection(null, '2026-11-10'), null);
  assert.equal(fullMonthsSinceConnection('not-a-date', '2026-11-10'), null);
});

// ------------------------------------------------- rename + wiring pins

test('the profile label is now Monthly gross profit (EN)', () => {
  assert.match(navLanguageJs(), /prof_field_profit:\s*'Monthly gross profit'/);
});

test('the profile label is now ماہانہ مجموعی منافع (UR)', () => {
  assert.match(navLanguageJs(), /prof_field_profit:\s*'ماہانہ مجموعی منافع'/);
});

test('the old Monthly package profit label is gone from profile surfaces', () => {
  assert.ok(!appJs().includes('Monthly package profit'), 'app.js keeps no old label');
  assert.ok(!indexHtml().includes('Monthly package profit'), 'index.html keeps no old label');
  assert.ok(!navLanguageJs().includes("'Monthly package profit'"), 'nav-language.js keeps no old label');
  assert.match(
    navLanguageJs(),
    /dash_card_exp_profit:\s*'Expected monthly package profit'/,
    'the dashboard figure is a different key and keeps its own label',
  );
});

test('the view uses the shared profileMonthlyProfit for the current month', () => {
  assert.match(appJs(), /from '\.\/profile-profit\.js(\?v=[^']+)?'/);
  assert.match(appJs(), /profileMonthlyProfit\(customer, state, pakistanMonthNow\(\)\)/);
  assert.match(appJs(), /t\('prof_field_concession_month'\)/);
  assert.match(appJs(), /t\('prof_field_discounts_month'\)/);
  assert.match(appJs(), /t\('prof_field_net_profit'\)/);
});

test('the view shows the investment breakdown and recovery rows', () => {
  assert.match(appJs(), /t\('prof_field_fiber_cost'\)/);
  assert.match(appJs(), /t\('prof_field_install_other'\)/);
  assert.match(appJs(), /t\('prof_field_install_total'\)/);
  assert.match(appJs(), /t\('prof_field_install_recovery'\)/);
});

test('the form preview shares the gross helper with the view', () => {
  assert.match(appJs(), /profileGrossProfit\(\{\s*monthlySellingAmount: selling, monthlyPurchaseCost: cost\s*\}\)/);
  const previewFn = appJs().split('function renderProfileMarginPreview()')[1]
    .split('\nfunction ')[0];
  assert.ok(
    !previewFn.includes('customerPackageProfit'),
    'the preview body no longer calls customerPackageProfit directly',
  );
});

test('the empty-string edge is missing in the profit display, not zero', () => {
  assert.match(
    profileUiJs(),
    /profileProfitMissingLabels[\s\S]*?=== ''/,
    'profileProfitMissingLabels treats an empty figure as missing',
  );
});

test('the month label helper is exported for the no-bill note', () => {
  assert.match(profileUiJs(), /export const formatReceiptMonth/);
  assert.match(appJs(), /formatReceiptMonth/);
});

// ---------------------------------------------- otherInstallCost field

test('otherInstallCost is in the per-field save map', () => {
  assert.equal(PROFILE_FIELD_SAVE_MAP.otherInstallCostInput, 'otherInstallCost');
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 70);
});

test('the counter is 68 after adding otherInstallCost', () => {
  const record = {};
  for (const key of Object.values(PROFILE_FIELD_SAVE_MAP)) record[key] = 1;
  record.prefersSms = true;
  record.paused = false;
  const counted = countProfileCompletion(record);
  assert.equal(counted.total, 68);
  assert.equal(counted.filled, 68);
  assert.equal(counted.text, '68/68 fields filled');
});

test('otherInstallCost is an optional form field in the S4 connection group', () => {
  const html = indexHtml();
  const group = html.slice(
    html.indexOf('data-profile-form-section="connection"'),
    html.indexOf('data-profile-form-section="network"'),
  );
  assert.ok(group.includes('id="otherInstallCostInput"'), 'input sits in the S4 group');
  assert.ok(group.includes('prof_form_install_other'), 'label key sits in the S4 group');
  assert.ok(group.includes('type="number"'), 'numeric input');
  assert.ok(group.includes('min="0"'), 'never negative');
});

test('the form populates and saves otherInstallCost', () => {
  const js = appJs();
  assert.ok(js.includes("$('#otherInstallCostInput')"), 'populate and save both read the input');
  assert.match(js, /otherInstallCost: \$\('#otherInstallCostInput'\)\.value/);
});

test('updateCustomerProfile saves otherInstallCost and treats blank as missing', () => {
  let state = createInitialState(['PhaseD Tester']);
  state = updateCustomerProfile(state, 'seed-001', { otherInstallCost: 2500 }, '2026-11-10T00:00:00+05:00');
  assert.equal(state.customers[0].otherInstallCost, 2500);
  state = updateCustomerProfile(state, 'seed-001', { otherInstallCost: '' }, '2026-11-10T00:00:00+05:00');
  assert.equal(state.customers[0].otherInstallCost, null);
  assert.throws(
    () => updateCustomerProfile(state, 'seed-001', { otherInstallCost: -1 }, '2026-11-10T00:00:00+05:00'),
    /cannot be negative/i,
  );
});

test('a new customer starts with otherInstallCost missing, not zero', () => {
  const state = createInitialState(['PhaseD Tester']);
  assert.equal(state.customers[0].otherInstallCost, null);
});

test('core wires otherInstallCost through create, update, load-sanitize and backup', () => {
  const js = coreJs();
  assert.match(js, /const otherInstallCost = checkCost\(options\.otherInstallCost\)/);
  assert.match(js, /otherInstallCost: checkCost\(valueOrCurrent\('otherInstallCost'\)\)/);
  assert.match(js, /otherInstallCost: ?normalizeMoneyOrNull\(customer\.otherInstallCost\)/);
  assert.match(js, /otherInstallCost:customer\.otherInstallCost \?\? null/);
  assert.ok(js.includes("'otherInstallCost'"), 'backup merge carries the field');
});

test('calculateInstallationCost documents the other-cost component', () => {
  assert.match(installationCostJs(), /otherInstallCost/);
  assert.ok(installationCostJs().includes('otherInstallCost'), 'header comment names the new component');
});

test('the save map change is the only map change — no other field added or dropped', () => {
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 70);
  assert.ok(profileFieldSaveJs().includes("otherInstallCostInput: 'otherInstallCost'"));
});
