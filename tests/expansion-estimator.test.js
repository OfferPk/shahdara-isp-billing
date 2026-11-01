/**
 * expansion-estimator.test.js — SISP-135 [P2]: New Street / Mohalla
 * Fiber Expansion ROI & Break-Even Calculator.
 *
 * Spec (read-latest.txt, SISP-135): "Calculate Total Capex PKR
 * (drop/feeder cable, splitter box, poles/clamps, splicing labor), Net
 * Upfront Investment after connection fees, Break-Even Months, and
 * 50/50 Partner Capital Contribution (Rs. X each)."
 *
 * Pins:
 *  - Capex: a full five-component fixture sums line by line;
 *  - upfront fee offset: netUpfront = capex − connection fees,
 *    including the fees-exceed-capex case (net 0, surplus shown,
 *    break-even 0 — never a negative investment);
 *  - break-even: exact division, a ceil case, monthlyNet ≤ 0 → null
 *    (never Infinity), subscribers 0 → revenue 0 → null;
 *  - partner contribution: half of net upfront per recorded partner
 *    label (PARTNERS from partner-settlement.js), settlement rounding;
 *  - validation: junk / negative / non-numeric inputs clamp to 0,
 *    counts round whole, meters keep decimals, inputs never mutated;
 *  - zero ledger contact: defaults + compute leave a state object
 *    byte-identical; defaults come only from recorded figures of
 *    non-archived customers (mode, ties to the smaller value) and
 *    report honestly when no recorded source exists;
 *  - i18n: every xest_* key exists in BOTH dictionaries with the same
 *    placeholders, and every t() call / data-i18n hook resolves;
 *  - wiring: dashboard section + dialog markup, app.js import + setup,
 *    token-only CSS, module reachable in the build graph but NOT an
 *    entry file (perf budget #219: dist stays at 25 bundled files).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  computeExpansionEstimate,
  normalizeExpansionInputs,
  expansionDefaultsFromState
} from '../expansion-estimator.js';
import { PARTNERS } from '../partner-settlement.js';
import { collectRuntimeFiles, ENTRY_FILES } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

// Full plant fixture: 40,000 + 20,000 + 48,000 + 30,000 + 12,000.
const PLANT = {
  dropMeters: 1000, dropPricePerMeter: 40,
  feederMeters: 500, feederPricePerMeter: 40,
  splitterBoxes: 4, splitterBoxPrice: 12000,
  polesClamps: 10, poleClampPrice: 3000,
  splicingJobs: 8, splicingPricePerJob: 1500
};
// 20 subscribers × Rs. 2,500 fee = 50,000 offset → net upfront 100,000.
// 20 × Rs. 3,000 = 60,000 monthly revenue.
const BASE = { ...PLANT, subscribers: 20, connectionFeePerSubscriber: 2500, monthlyFeePerSubscriber: 3000, monthlyOpex: 0 };

test('capex: all five components sum line by line', () => {
  const est = computeExpansionEstimate(PLANT);
  assert.equal(est.dropCableCost, 40000);
  assert.equal(est.feederCableCost, 20000);
  assert.equal(est.splitterBoxesCost, 48000);
  assert.equal(est.polesClampsCost, 30000);
  assert.equal(est.splicingCost, 12000);
  assert.equal(est.totalCapex, 150000);
});

test('upfront fee offset: net upfront = capex − connection fees', () => {
  const est = computeExpansionEstimate(BASE);
  assert.equal(est.connectionFeeIncome, 50000);
  assert.equal(est.netUpfront, 100000);
  assert.equal(est.feeSurplus, 0);
  assert.equal(est.coveredByFees, false);
  assert.equal(est.monthlyRevenue, 60000);
  assert.equal(est.monthlyNet, 60000);
});

test('fees exceed capex: net upfront 0, surplus reported, break-even 0, no partner capital', () => {
  const est = computeExpansionEstimate({
    dropMeters: 100, dropPricePerMeter: 40,
    subscribers: 10, connectionFeePerSubscriber: 2500, monthlyFeePerSubscriber: 3000, monthlyOpex: 90000
  });
  assert.equal(est.totalCapex, 4000);
  assert.equal(est.connectionFeeIncome, 25000);
  assert.equal(est.netUpfront, 0);
  assert.equal(est.feeSurplus, 21000);
  assert.equal(est.coveredByFees, true);
  assert.equal(est.breakEvenMonths, 0, 'nothing to recover — 0, not null, even when monthly net is negative');
  assert.equal(est.partnerEach, 0);
});

test('break-even: exact division', () => {
  const est = computeExpansionEstimate({ ...BASE, monthlyOpex: 50000 });
  assert.equal(est.monthlyNet, 10000);
  assert.equal(est.breakEvenMonths, 10);
});

test('break-even: partial month rounds up (ceil)', () => {
  const est = computeExpansionEstimate({ ...BASE, monthlyOpex: 30000 });
  assert.equal(est.monthlyNet, 30000);
  assert.equal(est.breakEvenMonths, 4, 'ceil(100000 / 30000)');
});

test('break-even: monthly net at or below zero is null, never Infinity', () => {
  assert.equal(computeExpansionEstimate({ ...BASE, monthlyOpex: 60000 }).breakEvenMonths, null);
  assert.equal(computeExpansionEstimate({ ...BASE, monthlyOpex: 75000 }).breakEvenMonths, null);
  assert.equal(computeExpansionEstimate({ ...BASE, monthlyOpex: 75000 }).monthlyNet, -15000);
});

test('break-even: zero subscribers means zero revenue and no break-even', () => {
  const est = computeExpansionEstimate({ ...PLANT, subscribers: 0, connectionFeePerSubscriber: 2500, monthlyFeePerSubscriber: 3000 });
  assert.equal(est.monthlyRevenue, 0);
  assert.equal(est.connectionFeeIncome, 0);
  assert.equal(est.netUpfront, 150000);
  assert.equal(est.breakEvenMonths, null);
});

test('partner contribution: half of net upfront each, on the recorded partner labels', () => {
  const est = computeExpansionEstimate(BASE);
  assert.equal(est.partnerEach, 50000);
  assert.deepEqual(est.partners, PARTNERS.map(name => ({ name, amount: 50000 })));
});

test('partner contribution: odd net upfront rounds like the settlement engine', () => {
  // capex 150,000 − fees (20 × 2,499 = 49,980) = 100,020 → 50,010 each.
  const even = computeExpansionEstimate({ ...BASE, connectionFeePerSubscriber: 2499 });
  assert.equal(even.netUpfront, 100020);
  assert.equal(even.partnerEach, 50010);
  // A one-rupee splicing price rise: capex 150,008 − fees 50,000 = 100,008.
  const odd = computeExpansionEstimate({ ...BASE, splicingPricePerJob: 1501 });
  assert.equal(odd.totalCapex, 150008);
  assert.equal(odd.netUpfront, 100008);
  const half = computeExpansionEstimate({ dropMeters: 1, dropPricePerMeter: 101, subscribers: 0 });
  assert.equal(half.netUpfront, 101);
  assert.equal(half.partnerEach, 51, 'Math.round(101 × 0.5) — the phase3 settlement rounding');
});

test('validation: junk clamps to zero, counts round whole, meters keep decimals', () => {
  const n = normalizeExpansionInputs({
    subscribers: '20.6', dropMeters: '250.5', feederMeters: -10,
    splitterBoxes: 'abc', polesClamps: NaN, splicingJobs: Infinity,
    dropPricePerMeter: -40, monthlyFeePerSubscriber: '3000', monthlyOpex: null
  });
  assert.equal(n.subscribers, 21);
  assert.equal(n.dropMeters, 250.5);
  assert.equal(n.feederMeters, 0);
  assert.equal(n.splitterBoxes, 0);
  assert.equal(n.polesClamps, 0);
  assert.equal(n.splicingJobs, 0);
  assert.equal(n.dropPricePerMeter, 0);
  assert.equal(n.monthlyFeePerSubscriber, 3000);
  assert.equal(n.monthlyOpex, 0);
  assert.deepEqual(normalizeExpansionInputs(null), normalizeExpansionInputs({}));
  assert.deepEqual(normalizeExpansionInputs('junk'), normalizeExpansionInputs({}));
});

test('purity: the inputs object is never mutated', () => {
  const inputs = { ...BASE };
  const snapshot = JSON.stringify(inputs);
  Object.freeze(inputs);
  const est = computeExpansionEstimate(inputs);
  assert.equal(JSON.stringify(inputs), snapshot);
  assert.equal(est.totalCapex, 150000);
});

const cust = (extra = {}) => ({ archived: false, connectionFee: null, monthlySellingAmount: null, fiberPerMeterRate: null, ...extra });

test('defaults: most frequent recorded figures of active customers prefill, with sources flagged', () => {
  const state = {
    customers: [
      cust({ connectionFee: 2500, monthlySellingAmount: 3000, fiberPerMeterRate: 40 }),
      cust({ connectionFee: 2500, monthlySellingAmount: 3000, fiberPerMeterRate: 40 }),
      cust({ connectionFee: 3000, monthlySellingAmount: 2000, fiberPerMeterRate: 45 }),
      cust({ connectionFee: 9999, monthlySellingAmount: 9999, fiberPerMeterRate: 9999, archived: true }),
      cust({})
    ]
  };
  const { defaults, sources } = expansionDefaultsFromState(state);
  assert.deepEqual(defaults, {
    connectionFeePerSubscriber: 2500,
    monthlyFeePerSubscriber: 3000,
    dropPricePerMeter: 40,
    feederPricePerMeter: 40
  });
  assert.deepEqual(sources, {
    connectionFeePerSubscriber: true,
    monthlyFeePerSubscriber: true,
    dropPricePerMeter: true,
    feederPricePerMeter: true
  });
});

test('defaults: frequency ties go to the smaller recorded value', () => {
  const state = { customers: [cust({ connectionFee: 3000 }), cust({ connectionFee: 3000 }), cust({ connectionFee: 2000 }), cust({ connectionFee: 2000 })] };
  assert.equal(expansionDefaultsFromState(state).defaults.connectionFeePerSubscriber, 2000);
});

test('defaults: no recorded figures → zeros with every source flag false (nothing invented)', () => {
  for (const state of [null, {}, { customers: [] }, { customers: [cust({})] }]) {
    const { defaults, sources } = expansionDefaultsFromState(state);
    assert.deepEqual(defaults, { connectionFeePerSubscriber: 0, monthlyFeePerSubscriber: 0, dropPricePerMeter: 0, feederPricePerMeter: 0 });
    assert.ok(Object.values(sources).every(v => v === false));
  }
});

test('zero ledger contact: defaults + compute leave the state byte-identical', () => {
  const state = {
    customers: [cust({ connectionFee: 2500, monthlySellingAmount: 3000, fiberPerMeterRate: 40 })],
    expenses: [{ id: 'e1', amount: 500 }],
    settings: {}
  };
  const snapshot = JSON.stringify(state);
  Object.freeze(state);
  expansionDefaultsFromState(state);
  computeExpansionEstimate(BASE);
  assert.equal(JSON.stringify(state), snapshot);
});

test('i18n: every xest_* key exists in both dictionaries with the same placeholders', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('xest_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('xest_')).sort();
  assert.ok(enKeys.length >= 30, `expected the SISP-135 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  const placeholders = value => [...String(value).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const key of enKeys) {
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
    assert.notEqual(TRANSLATIONS.en[key], key, `${key} must not render as its own raw key`);
  }
});

test('i18n audit: every t() call in the module and every xest data-i18n hook in index.html resolves', () => {
  const moduleSrc = readFileSync(new URL('../expansion-estimator.js', import.meta.url), 'utf8');
  const called = [...moduleSrc.matchAll(/\bt\('([a-z0-9_]+)'/g)].map(m => m[1]);
  assert.ok(called.length >= 2, 'the controller translates its dynamic lines');
  for (const key of called) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
  }
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const hooks = [...index.matchAll(/data-i18n="(xest_[a-z0-9_]+)"/g)].map(m => m[1]);
  assert.ok(hooks.length >= 25, `expected the dialog labels hooked, got ${hooks.length}`);
  for (const key of new Set(hooks)) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
  }
});

test('wiring: dashboard section, dialog, app.js setup, token-only CSS, build-graph seam', async () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'expansionEstimatorSection', 'expansionEstimatorOpenBtn', 'expansionEstimatorModal',
    'expansionEstimatorCloseBtn', 'xestSubscribersInput', 'xestDropMetersInput',
    'xestFeederMetersInput', 'xestBoxesInput', 'xestPolesInput', 'xestSplicingJobsInput',
    'xestDropPriceInput', 'xestFeederPriceInput', 'xestBoxPriceInput', 'xestPolePriceInput',
    'xestSplicingPriceInput', 'xestMonthlyFeeInput', 'xestConnectionFeeInput', 'xestMonthlyOpexInput',
    'xestResCapex', 'xestResFees', 'xestResNetUpfront', 'xestResMonthlyRevenue', 'xestResMonthlyNet',
    'xestResBreakEven', 'xestPartnerName0', 'xestPartnerAmount0', 'xestPartnerName1', 'xestPartnerAmount1',
    'xestCoveredNote', 'xestBreakEvenNote'
  ]) {
    assert.ok(index.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  assert.ok(index.includes('class="icon-button modal-close-btn"'), 'shared close-button design');
  assert.ok(index.includes('aria-controls="expansionEstimatorModal"'), 'open button controls the dialog');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './expansion-estimator.js'"), 'app.js imports the estimator');
  assert.ok(app.includes('setupExpansionEstimatorModal(() => state)'), 'app.js sets the dialog up');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-135'));
  assert.ok(block.includes('.xest-grid'), 'estimator styles shipped');
  assert.ok(block.includes('var(--modal-surface)'), 'dialog card uses the modal surface token');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-135 styles use theme tokens only, no hex');

  assert.ok(!ENTRY_FILES.includes('expansion-estimator.js'), 'not an entry file — the 25-file budget seam');
  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('expansion-estimator.js'), 'estimator is in the runtime graph via app.js');
});
