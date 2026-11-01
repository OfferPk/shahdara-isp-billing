// SISP-132: Splitter-Wide vs. Single-Port Optical Loss (dBm)
// Classifier. Pure-function tests on synthetic data only.
//
// Rule under test (house weak line from SISP-24 splitter-map.js:
// weak = lastRxDbm strictly below -26.0 dBm):
//   - exactly 1 active weak port on the box  -> 'isolated'
//   - 2+ active weak ports on the same box   -> 'splitter-wide'
//   - healthy / missing reading / no box / archived -> never classified.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ISOLATED_DROP_FAULT,
  OPTICAL_DEGRADED_THRESHOLD_DBM,
  SPLITTER_WIDE_FAULT,
  activeBoxMembers,
  classifyCustomerOpticalFault,
  classifySplitterBoxFault,
  opticalFaultBadgeHtml,
  opticalFaultHintText,
  opticalFaultLabel,
  opticalFaultLineHtml
} from '../optical-anomaly-detector.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const cust = (overrides = {}) => ({
  id: 'c1',
  name: 'Test Customer 01',
  archived: false,
  splitterBoxId: 'DB-01',
  splitterPort: 1,
  lastRxDbm: -20,
  ...overrides
});

test('threshold reuses the SISP-24 house weak line (-26.0 dBm)', () => {
  assert.equal(OPTICAL_DEGRADED_THRESHOLD_DBM, -26.0);
});

test('spec pin: single bad port among healthy siblings -> Isolated Drop Fault', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -20 }),
    cust({ id: 'c3', name: 'Test Customer 03', splitterPort: 3, lastRxDbm: -22 })
  ];
  const fault = classifyCustomerOpticalFault(customers, 'c1');
  assert.equal(fault.kind, ISOLATED_DROP_FAULT);
  assert.equal(fault.boxId, 'DB-01');
  assert.equal(fault.degradedCount, 1);
  assert.deepEqual(fault.degradedPeers, []);
  assert.equal(fault.readingsCount, 3);
});

test('spec pin: multi-port degraded splitter box -> Splitter-Wide Feeder Fault', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -27.5 }),
    cust({ id: 'c3', name: 'Test Customer 03', splitterPort: 3, lastRxDbm: -20 })
  ];
  for (const id of ['c1', 'c2']) {
    const fault = classifyCustomerOpticalFault(customers, id);
    assert.equal(fault.kind, SPLITTER_WIDE_FAULT);
    assert.equal(fault.degradedCount, 2);
    assert.equal(fault.degradedPeers.length, 1);
  }
  const box = classifySplitterBoxFault(customers, 'DB-01');
  assert.equal(box.kind, SPLITTER_WIDE_FAULT);
  assert.equal(box.degradedCount, 2);
  assert.equal(box.memberCount, 3);
  // The healthy sibling is never classified.
  assert.equal(classifyCustomerOpticalFault(customers, 'c3'), null);
});

test('edge: customer without a reading is never classified', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: null }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -28.5 })
  ];
  assert.equal(classifyCustomerOpticalFault(customers, 'c1'), null);
});

test('edge: healthy and boundary readings are never classified', () => {
  // Exactly -26.0 is healthy per the house rule (weak is strictly below).
  assert.equal(classifyCustomerOpticalFault([cust({ lastRxDbm: -26.0 })], 'c1'), null);
  assert.equal(classifyCustomerOpticalFault([cust({ lastRxDbm: -19.4 })], 'c1'), null);
  // Just below the line, alone on the box -> isolated.
  const fault = classifyCustomerOpticalFault([cust({ lastRxDbm: -26.1 })], 'c1');
  assert.equal(fault.kind, ISOLATED_DROP_FAULT);
});

test('edge: a box with a single active port can only classify isolated', () => {
  const customers = [cust({ id: 'c1', splitterBoxId: 'DB-09', splitterPort: 1, lastRxDbm: -29 })];
  const fault = classifyCustomerOpticalFault(customers, 'c1');
  assert.equal(fault.kind, ISOLATED_DROP_FAULT);
  assert.equal(fault.memberCount, 1);
  assert.equal(fault.degradedCount, 1);
});

test('edge: archived sibling readings are ignored; archived self is unclassified', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -28.5, archived: true })
  ];
  const fault = classifyCustomerOpticalFault(customers, 'c1');
  assert.equal(fault.kind, ISOLATED_DROP_FAULT);
  assert.equal(fault.degradedCount, 1);
  assert.equal(activeBoxMembers(customers, 'DB-01').length, 1);
  assert.equal(classifyCustomerOpticalFault(customers, 'c2'), null);
});

test('edge: no splitter box or unknown customer -> unclassified', () => {
  assert.equal(classifyCustomerOpticalFault([cust({ splitterBoxId: '', lastRxDbm: -30 })], 'c1'), null);
  assert.equal(classifyCustomerOpticalFault([cust({ lastRxDbm: -30 })], 'missing-id'), null);
  assert.equal(classifyCustomerOpticalFault([], 'c1'), null);
  assert.equal(classifySplitterBoxFault([], 'DB-01').kind, null);
});

test('box summary: a fully healthy box has no classification', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -20 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: null })
  ];
  const box = classifySplitterBoxFault(customers, 'DB-01');
  assert.equal(box.kind, null);
  assert.equal(box.degradedCount, 0);
  assert.equal(box.readingsCount, 1);
});

test('read-only: classifying and rendering mutate nothing', () => {
  const customers = [
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -27.5 })
  ];
  const before = JSON.stringify(customers);
  const fault = classifyCustomerOpticalFault(customers, 'c1');
  classifySplitterBoxFault(customers, 'DB-01');
  opticalFaultBadgeHtml(fault);
  opticalFaultLineHtml(fault);
  opticalFaultHintText(fault);
  assert.equal(JSON.stringify(customers), before);
});

test('badges: isolated renders amber warning badge, splitter-wide renders danger badge', () => {
  const isolated = classifyCustomerOpticalFault([cust({ lastRxDbm: -28.5 })], 'c1');
  const isolatedHtml = opticalFaultBadgeHtml(isolated);
  assert.match(isolatedHtml, /badge-warning/);
  assert.match(isolatedHtml, /Isolated drop fault/);

  const wide = classifyCustomerOpticalFault([
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -28 })
  ], 'c1');
  const wideHtml = opticalFaultBadgeHtml(wide);
  assert.match(wideHtml, /badge-danger/);
  assert.match(wideHtml, /Splitter-wide fault/);

  assert.equal(opticalFaultBadgeHtml(null), '');
  assert.equal(opticalFaultLabel(null), '');
  assert.equal(opticalFaultLineHtml(null), '');
});

test('hints name the box and the degraded port count', () => {
  const isolated = classifyCustomerOpticalFault([cust({ lastRxDbm: -28.5 })], 'c1');
  assert.match(opticalFaultHintText(isolated), /DB-01/);
  const wide = classifyCustomerOpticalFault([
    cust({ id: 'c1', splitterPort: 1, lastRxDbm: -28.5 }),
    cust({ id: 'c2', name: 'Test Customer 02', splitterPort: 2, lastRxDbm: -28 })
  ], 'c1');
  const wideHint = opticalFaultHintText(wide);
  assert.match(wideHint, /DB-01/);
  assert.match(wideHint, /2 ports/);
});

test('i18n: every optcls_* key used by the module exists in en + ur and never renders raw', () => {
  const source = readFileSync(new URL('../optical-anomaly-detector.js', import.meta.url), 'utf8');
  const usedKeys = [...new Set([...source.matchAll(/t\('(optcls_[a-z_]+)'/g)].map((m) => m[1]))];
  assert.ok(usedKeys.length >= 4, `expected >= 4 optcls keys, found ${usedKeys.join(',')}`);
  for (const key of usedKeys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.notEqual(t(key, 'en', { box: 'DB-01', count: 2 }), key);
    assert.notEqual(t(key, 'ur', { box: 'DB-01', count: 2 }), key);
  }
  assert.equal(t('optcls_wide_badge', 'ur'), 'پورے اسپلٹر کی خرابی');
});

test('wiring: app.js imports the detector; modals consume it via host callbacks only', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/optical-anomaly-detector\.js'/);
  assert.match(app, /classifyCustomerOpticalFault\(state\.customers, customer\.id\)/);
  const splitter = readFileSync(new URL('../splitter-map.js', import.meta.url), 'utf8');
  assert.match(splitter, /getBoxOpticalBadge/);
  assert.match(splitter, /getOpticalBadge/);
  // No import cycle: splitter-map and complaint-tickets never import the detector.
  assert.doesNotMatch(splitter, /from '\.\/optical-anomaly-detector\.js'/);
  const tickets = readFileSync(new URL('../complaint-tickets.js', import.meta.url), 'utf8');
  assert.match(tickets, /getOpticalBadge/);
  assert.doesNotMatch(tickets, /from '\.\/optical-anomaly-detector\.js'/);
});

test('css: the SISP-132 components.css block is token-only (no hex)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('SISP-132');
  assert.ok(start > -1);
  const block = css.slice(start, start + 400);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/);
});
