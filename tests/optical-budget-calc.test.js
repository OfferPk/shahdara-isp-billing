// SISP-142: Passive Optical Link Budget & Excess Bend-Loss Calculator.
// Pure-function tests on synthetic data only.
// Spec pins: link-budget math for a full fixture, each splitter ratio's
// loss, the excess-loss flag boundary (3.1 flags, exactly 3.0 does not,
// 2.9 does not, better-than-budget never flags), and invalid-input
// behaviour. The calculator is passive: nothing it computes is stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONNECTOR_LOSS_DB,
  DEFAULT_TX_POWER_DBM,
  EXCESS_LOSS_THRESHOLD_DB,
  FIBER_LOSS_DB_PER_KM,
  SPLICE_LOSS_DB,
  SPLITTER_LOSS_DB,
  SPLITTER_RATIOS,
  buildOpticalBudgetResultHtml,
  computeOpticalBudget,
  evaluateExcessLoss,
  listRecordedOpticalPorts,
  recordedPortForCustomer
} from '../optical-budget-calc.js';
import { TRANSLATIONS } from '../nav-language.js';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('constants are the documented engineering reference values', () => {
  assert.deepEqual({ ...SPLITTER_LOSS_DB }, { '1:2': 3.8, '1:4': 7.2, '1:8': 10.5, '1:16': 13.8 });
  assert.deepEqual([...SPLITTER_RATIOS], ['1:2', '1:4', '1:8', '1:16']);
  assert.equal(FIBER_LOSS_DB_PER_KM, 0.35);
  assert.equal(SPLICE_LOSS_DB, 0.1);
  assert.equal(CONNECTOR_LOSS_DB, 0.5);
  assert.equal(EXCESS_LOSS_THRESHOLD_DB, 3.0);
  assert.equal(DEFAULT_TX_POWER_DBM, 5);
});

test('each splitter ratio contributes exactly its table loss', () => {
  for (const [ratio, loss] of Object.entries(SPLITTER_LOSS_DB)) {
    const budget = computeOpticalBudget({ txPowerDbm: 20, ratio, spliceCount: 0, couplerCount: 0, distanceKm: 0 });
    assert.equal(budget.valid, true);
    assert.equal(budget.splitterLossDb, loss, ratio);
    assert.equal(budget.totalLossDb, loss, ratio);
    assert.equal(budget.expectedRxDbm, Math.round((20 - loss) * 10) / 10, ratio);
  }
});

test('spec fixture: TX +5, 1:8, 4 splices, 2 couplers, 2 km → expected RX −7.6 dBm', () => {
  const budget = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:8', spliceCount: 4, couplerCount: 2, distanceKm: 2, safetyMarginDb: 0 });
  assert.equal(budget.valid, true);
  assert.equal(budget.splitterLossDb, 10.5);
  assert.equal(budget.spliceLossDb, 0.4);
  assert.equal(budget.couplerLossDb, 1.0);
  assert.equal(budget.fiberLossDb, 0.7);
  assert.equal(budget.safetyMarginDb, 0);
  assert.equal(budget.totalLossDb, 12.6);
  assert.equal(budget.expectedRxDbm, -7.6);
});

test('safety margin is optional, defaults to 0, and subtracts when given', () => {
  const base = { txPowerDbm: 5, ratio: '1:8', spliceCount: 4, couplerCount: 2, distanceKm: 2 };
  assert.equal(computeOpticalBudget(base).expectedRxDbm, -7.6);
  const withMargin = computeOpticalBudget({ ...base, safetyMarginDb: 3 });
  assert.equal(withMargin.safetyMarginDb, 3);
  assert.equal(withMargin.totalLossDb, 15.6);
  assert.equal(withMargin.expectedRxDbm, -10.6);
});

test('missing TX power falls back to the labelled default; any finite TX is honoured', () => {
  assert.equal(computeOpticalBudget({ ratio: '1:2' }).txPowerDbm, DEFAULT_TX_POWER_DBM);
  assert.equal(computeOpticalBudget({ txPowerDbm: '', ratio: '1:2' }).txPowerDbm, DEFAULT_TX_POWER_DBM);
  assert.equal(computeOpticalBudget({ txPowerDbm: -2, ratio: '1:2' }).expectedRxDbm, -5.8);
});

test('excess flag: 3.1 dB flags, exactly 3.0 does not, 2.9 does not, better-than-budget never flags', () => {
  assert.deepEqual(evaluateExcessLoss(-7.6, -10.7), { comparable: true, excessLossDb: 3.1, flagged: true });
  assert.deepEqual(evaluateExcessLoss(-7.6, -10.6), { comparable: true, excessLossDb: 3.0, flagged: false });
  assert.deepEqual(evaluateExcessLoss(-7.6, -10.5), { comparable: true, excessLossDb: 2.9, flagged: false });
  assert.deepEqual(evaluateExcessLoss(-7.6, -5.0), { comparable: true, excessLossDb: -2.6, flagged: false });
  assert.deepEqual(evaluateExcessLoss(-20.0, -23.1), { comparable: true, excessLossDb: 3.1, flagged: true });
  assert.deepEqual(evaluateExcessLoss(-20.0, -23.0), { comparable: true, excessLossDb: 3.0, flagged: false });
});

test('a missing or unreadable measured reading is never comparable and never flagged', () => {
  for (const bad of [null, undefined, '', 'abc', NaN]) {
    assert.deepEqual(evaluateExcessLoss(-7.6, bad), { comparable: false, excessLossDb: null, flagged: false });
  }
  assert.deepEqual(evaluateExcessLoss(null, -20), { comparable: false, excessLossDb: null, flagged: false });
});

test('invalid inputs: negative counts / distance / margin clamp to zero contribution', () => {
  const budget = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:4', spliceCount: -3, couplerCount: -1, distanceKm: -2, safetyMarginDb: -1 });
  assert.equal(budget.valid, true);
  assert.equal(budget.spliceLossDb, 0);
  assert.equal(budget.couplerLossDb, 0);
  assert.equal(budget.fiberLossDb, 0);
  assert.equal(budget.safetyMarginDb, 0);
  assert.equal(budget.expectedRxDbm, -2.2);
  const junk = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:4', spliceCount: 'x', couplerCount: NaN, distanceKm: 'far' });
  assert.equal(junk.totalLossDb, 7.2);
  const fractional = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:4', spliceCount: 2.9, couplerCount: 1.5 });
  assert.equal(fractional.spliceLossDb, 0.2);
  assert.equal(fractional.couplerLossDb, 0.5);
});

test('an unknown splitter ratio is refused, never guessed', () => {
  for (const bad of ['1:32', '1:64', '', '8', null, undefined, 8]) {
    const budget = computeOpticalBudget({ txPowerDbm: 5, ratio: bad });
    assert.equal(budget.valid, false, String(bad));
    assert.equal(budget.reason, 'unknown-ratio');
    assert.equal(budget.expectedRxDbm, null);
  }
});

const portCustomer = (overrides = {}) => ({
  id: 'c-port-1',
  name: 'Synthetic Port Customer',
  splitterBoxId: 'SPL-Test-01',
  splitterPort: 3,
  lastRxDbm: -19.4,
  ...overrides
});

test('recorded ports come from splitter-map data with the box derived ratio', () => {
  const customers = [
    portCustomer(),
    portCustomer({ id: 'c-port-2', name: 'Synthetic No Reading', splitterPort: 5, lastRxDbm: '' }),
    portCustomer({ id: 'c-port-3', name: 'Synthetic Big Box', splitterBoxId: 'SPL-Test-02', splitterPort: 12, lastRxDbm: -28.0 }),
    portCustomer({ id: 'c-port-4', name: 'Synthetic No Box', splitterBoxId: '', splitterPort: null, lastRxDbm: -20.0 })
  ];
  const ports = listRecordedOpticalPorts(customers);
  assert.equal(ports.length, 3);
  const first = ports.find((entry) => entry.customerId === 'c-port-1');
  assert.deepEqual(first, {
    customerId: 'c-port-1',
    customerName: 'Synthetic Port Customer',
    boxId: 'SPL-Test-01',
    port: 3,
    boxRatio: '1:8',
    lastRxDbm: -19.4
  });
  const noReading = ports.find((entry) => entry.customerId === 'c-port-2');
  assert.equal(noReading.lastRxDbm, null);
  const bigBox = ports.find((entry) => entry.customerId === 'c-port-3');
  assert.equal(bigBox.boxRatio, '1:16');
  assert.equal(recordedPortForCustomer(customers, 'c-port-3')?.boxId, 'SPL-Test-02');
  assert.equal(recordedPortForCustomer(customers, 'c-port-4'), null);
  assert.equal(recordedPortForCustomer(customers, 'nobody'), null);
  assert.equal(recordedPortForCustomer(customers, ''), null);
});

test('result HTML shows the budget, breakdown and the excess flag verdict', () => {
  const budget = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:8', spliceCount: 4, couplerCount: 2, distanceKm: 2 });
  const flaggedHtml = buildOpticalBudgetResultHtml(budget, evaluateExcessLoss(budget.expectedRxDbm, -10.7), -10.7);
  assert.ok(flaggedHtml.includes('-7.6 dBm'));
  assert.ok(flaggedHtml.includes('12.6 dB'));
  assert.ok(flaggedHtml.includes('badge-warning'));
  assert.ok(flaggedHtml.includes(TRANSLATIONS.en.obcalc_excess_flag));
  const okHtml = buildOpticalBudgetResultHtml(budget, evaluateExcessLoss(budget.expectedRxDbm, -8.0), -8.0);
  assert.ok(okHtml.includes('badge-healthy'));
  assert.ok(!okHtml.includes('badge-warning'));
  const noMeasured = buildOpticalBudgetResultHtml(budget, null, null);
  assert.ok(noMeasured.includes(TRANSLATIONS.en.obcalc_no_measured));
  assert.ok(!noMeasured.includes('badge-warning'));
  const invalid = buildOpticalBudgetResultHtml(computeOpticalBudget({ ratio: '1:32' }), null, null);
  assert.ok(invalid.includes(TRANSLATIONS.en.obcalc_no_budget));
});

test('the calculator is passive: computing and rendering mutate nothing', () => {
  const state = {
    customers: [
      portCustomer(),
      portCustomer({ id: 'c-port-2', splitterPort: 5, lastRxDbm: -30.2 })
    ]
  };
  const before = JSON.stringify(state);
  const frozen = JSON.parse(before);
  const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
      for (const child of Object.values(value)) deepFreeze(child);
      Object.freeze(value);
    }
    return value;
  };
  deepFreeze(frozen);
  const budget = computeOpticalBudget({ txPowerDbm: 5, ratio: '1:8', spliceCount: 4, couplerCount: 2, distanceKm: 2 });
  evaluateExcessLoss(budget.expectedRxDbm, frozen.customers[0].lastRxDbm);
  listRecordedOpticalPorts(frozen.customers);
  buildOpticalBudgetResultHtml(budget, evaluateExcessLoss(budget.expectedRxDbm, -30.2), -30.2);
  assert.equal(JSON.stringify(frozen), before);
  assert.equal(JSON.stringify(state), before);
});

test('i18n: every t() key the module uses resolves in en and ur; obcalc dict parity holds', () => {
  const moduleSource = src('../optical-budget-calc.js');
  const usedKeys = [...new Set([...moduleSource.matchAll(/\bt\('([a-z0-9_]+)'\)/g)].map((m) => m[1]))];
  assert.ok(usedKeys.length >= 10, `expected the module to translate its strings, got ${usedKeys.length}`);
  for (const key of usedKeys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur missing ${key}`);
  }
  const enKeys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('obcalc_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((key) => key.startsWith('obcalc_')).sort();
  assert.deepEqual(urKeys, enKeys);
  // The spec's flag wording survives verbatim in the English dictionary.
  assert.equal(TRANSLATIONS.en.obcalc_excess_flag, '⚠️ Excess Bend / Dirty Connector Loss');
});

test('i18n: every obcalc data-i18n key in index.html resolves in en and ur', () => {
  const html = src('../index.html');
  const keys = [...new Set([...html.matchAll(/data-i18n="(obcalc_[a-z0-9_]+)"/g)].map((m) => m[1]))];
  assert.ok(keys.length >= 10, `expected dialog labels to be translated, got ${keys.length}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur missing ${key}`);
  }
});

test('wiring: app.js imports the module inside the existing graph; index.html carries the dialog; build entries unchanged', () => {
  const appSource = src('../app.js');
  assert.ok(appSource.includes("from './optical-budget-calc.js'"));
  assert.ok(appSource.includes('setupOpticalBudgetModal(() => state'));
  const html = src('../index.html');
  assert.ok(html.includes('id="opticalBudgetModal"'));
  assert.ok(html.includes('id="openOpticalBudgetCalcBtn"'));
  assert.ok(html.includes('id="opticalBudgetCloseBtn"'));
  assert.ok(html.includes('class="modal-close"'));
  const buildSource = src('../build.mjs');
  const entryLine = buildSource.split('\n').find((line) => line.includes('ENTRY_FILES'));
  assert.ok(entryLine && !entryLine.includes('optical-budget-calc.js'), 'the module must not become a build entry (dist budget)');
});

test('dark mode: the optical-budget CSS block uses theme tokens only, no hex colours', () => {
  const css = src('../components.css');
  const blockLines = css.split('\n').filter((line) => line.includes('.optical-budget'));
  assert.ok(blockLines.length >= 5, 'expected an .optical-budget-* CSS block');
  for (const line of blockLines) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(line), `hex colour in: ${line}`);
  }
  assert.ok(blockLines.some((line) => line.includes('var(--surface)')));
  assert.ok(blockLines.some((line) => line.includes('var(--line)')));
});
