// SISP-103: OLT PON Port Capacity & Split Ratio Saturation Alert.
// Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): "Assigning 58 active customers to
// PON-1 triggers the >87.5% PON port saturation warning."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GPON_DOWNSTREAM_MBPS,
  PON_PORT_CAPACITY_ONUS,
  PON_SATURATION_ONUS,
  buildPonCapacityReport,
  parsePonPortNumber,
  ponPortLabel,
  ponSaturationLevel,
  renderPonCapacityRows
} from '../olt-pon-capacity.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const onu = (id, overrides = {}) => ({
  id: `c${id}`,
  name: `Synthetic ONU ${id}`,
  archived: false,
  oltPonPort: 'PON-1',
  splitterBoxId: 'SPL-Test-01',
  splitterPort: (id % 16) + 1,
  packageSpeed: '15Mbps Unlimited',
  ...overrides
});

const onuBatch = (count, overrides = {}) =>
  Array.from({ length: count }, (_, i) => onu(i + 1, overrides));

const tr = (key, params) => t(key, 'en', params);

test('spec constants: 64 ONU capacity, 56 ONU (87.5%) saturation line, GPON 2488 Mbps', () => {
  assert.equal(PON_PORT_CAPACITY_ONUS, 64);
  assert.equal(PON_SATURATION_ONUS, 56);
  assert.equal(PON_SATURATION_ONUS / PON_PORT_CAPACITY_ONUS, 0.875);
  assert.equal(GPON_DOWNSTREAM_MBPS, 2488);
});

test('SPEC PIN: 58 active customers on PON-1 trigger the >87.5% saturation warning', () => {
  const report = buildPonCapacityReport(onuBatch(58));
  assert.equal(report.ports.length, 1);
  const row = report.ports[0];
  assert.equal(row.portNumber, 1);
  assert.equal(row.label, 'PON-1');
  assert.equal(row.activeOnus, 58);
  assert.equal(row.capacityOnus, 64);
  assert.equal(row.freeOnus, 6);
  assert.equal(row.fillPercent, 90.6);
  assert.equal(row.level, 'amber');
  // Sold Mbps: 58 x 15 Mbps (catalogue "15Mbps Unlimited") = 870.
  assert.equal(row.soldMbps, 870);
  // Oversubscription ratio = sold / GPON downstream line rate.
  assert.equal(row.oversubscriptionRatio, 0.35);
  assert.equal(row.unpricedCount, 0);
  assert.deepEqual(row.boxes, ['SPL-Test-01']);
  assert.deepEqual(report.totals.saturatedPorts, ['PON-1']);
  assert.deepEqual(report.totals.fullPorts, []);
  const html = renderPonCapacityRows(report, tr);
  assert.match(html, /PON-1/);
  assert.match(html, /58 \/ 64 ONUs/);
  assert.match(html, /870 Mbps sold/);
  assert.match(html, /Saturation warning/);
});

test('below-threshold port shows no flag; a full port is red; over capacity stays red', () => {
  const customers = [
    ...onuBatch(10, { oltPonPort: 'PON 2' }),
    ...onuBatch(64, { oltPonPort: 'PON-3' }).map((c, i) => ({ ...c, id: `f${i}` })),
    ...onuBatch(65, { oltPonPort: 'PON-4' }).map((c, i) => ({ ...c, id: `o${i}` }))
  ];
  const report = buildPonCapacityReport(customers);
  const byLabel = Object.fromEntries(report.ports.map((row) => [row.label, row]));
  assert.equal(byLabel['PON-2'].level, 'ok');
  assert.equal(byLabel['PON-2'].activeOnus, 10);
  assert.equal(byLabel['PON-3'].level, 'red');
  assert.equal(byLabel['PON-3'].freeOnus, 0);
  assert.equal(byLabel['PON-4'].level, 'red');
  assert.equal(byLabel['PON-4'].freeOnus, -1);
  assert.deepEqual(report.totals.fullPorts, ['PON-3', 'PON-4']);
  assert.deepEqual(report.totals.saturatedPorts, ['PON-3', 'PON-4']);
  const html = renderPonCapacityRows(report, tr);
  assert.match(html, /PON port full/);
  assert.match(html, /1 over capacity/);
  // The healthy port row carries no flag paragraph.
  const pon2Row = html.split('pon-cap-row').find((chunk) => chunk.includes('PON-2'));
  assert.ok(pon2Row && !pon2Row.includes('pon-cap-flag'), 'PON-2 row has no saturation flag');
});

test('ponSaturationLevel boundaries: 55 ok, 56 amber, 63 amber, 64 red', () => {
  assert.equal(ponSaturationLevel(0), 'ok');
  assert.equal(ponSaturationLevel(55), 'ok');
  assert.equal(ponSaturationLevel(56), 'amber');
  assert.equal(ponSaturationLevel(63), 'amber');
  assert.equal(ponSaturationLevel(64), 'red');
  assert.equal(ponSaturationLevel(80), 'red');
});

test('parsePonPortNumber reads the recorded shapes and refuses the rest', () => {
  assert.equal(parsePonPortNumber('PON 1/2/3'), 1);
  assert.equal(parsePonPortNumber('PON-1'), 1);
  assert.equal(parsePonPortNumber('PON 2'), 2);
  assert.equal(parsePonPortNumber('pon 3'), 3);
  assert.equal(parsePonPortNumber('PON-08'), 8);
  assert.equal(parsePonPortNumber('1/2/3'), 1);
  assert.equal(parsePonPortNumber(''), null);
  assert.equal(parsePonPortNumber('   '), null);
  assert.equal(parsePonPortNumber(null), null);
  assert.equal(parsePonPortNumber(undefined), null);
  assert.equal(parsePonPortNumber('feeder A'), null);
  assert.equal(parsePonPortNumber('PON 0'), null);
  assert.equal(ponPortLabel(1), 'PON-1');
  assert.equal(ponPortLabel(8), 'PON-8');
});

test('cascade recording "PON 1/2/3" aggregates onto PON-1; boxes join from customer records', () => {
  const customers = [
    onu(1, { oltPonPort: 'PON 1/2/3', splitterBoxId: 'SPL-Barrian-02' }),
    onu(2, { oltPonPort: 'PON 1/4/1', splitterBoxId: 'SPL-Barrian-03' }),
    onu(3, { oltPonPort: 'PON 1/2/3', splitterBoxId: 'SPL-Barrian-02' })
  ];
  const report = buildPonCapacityReport(customers);
  assert.equal(report.ports.length, 1);
  assert.equal(report.ports[0].activeOnus, 3);
  assert.deepEqual(report.ports[0].boxes, ['SPL-Barrian-02', 'SPL-Barrian-03']);
  assert.deepEqual(report.ports[0].recordedLabels, ['PON 1/2/3', 'PON 1/4/1']);
});

test('unassigned bucket is honest: no port, no capacity, unreadable labels surfaced', () => {
  const customers = [
    onu(1, { oltPonPort: '' }),
    onu(2, { oltPonPort: 'feeder A' }),
    onu(3, { oltPonPort: 'PON-5' })
  ];
  const report = buildPonCapacityReport(customers);
  assert.equal(report.ports.length, 1);
  assert.equal(report.ports[0].label, 'PON-5');
  assert.equal(report.unassigned.activeOnus, 2);
  assert.deepEqual(report.unassigned.unreadableLabels, ['feeder A']);
  assert.equal(report.totals.activeOnus, 3);
  assert.equal(report.totals.assignedOnus, 1);
  const html = renderPonCapacityRows(report, tr);
  assert.match(html, /Unassigned/);
  assert.match(html, /feeder A/);
  // The unassigned row never claims a /64 capacity.
  const unassignedRow = html.split('pon-cap-row').find((chunk) => chunk.includes('Unassigned'));
  assert.ok(unassignedRow && !unassignedRow.includes('/ 64'), 'unassigned row has no invented capacity');
});

test('archived customers never count as active ONUs', () => {
  const customers = [
    ...onuBatch(58),
    ...onuBatch(10, { archived: true }).map((c, i) => ({ ...c, id: `a${i}` }))
  ];
  const report = buildPonCapacityReport(customers);
  assert.equal(report.ports[0].activeOnus, 58);
  assert.equal(report.totals.activeOnus, 58);
});

test('unresolvable speed counts the ONU, sells 0 Mbps, and is counted unpriced', () => {
  const customers = [
    onu(1, { packageSpeed: 'Standard' }),
    onu(2, { packageSpeed: '' }),
    onu(3, { packageSpeed: '10 Mbps' })
  ];
  const report = buildPonCapacityReport(customers);
  const row = report.ports[0];
  assert.equal(row.activeOnus, 3);
  assert.equal(row.soldMbps, 10);
  assert.equal(row.unpricedCount, 2);
  const html = renderPonCapacityRows(report, tr);
  assert.match(html, /2 unpriced/);
});

test('read-only: building the report and rendering never mutate the input records', () => {
  const customers = [
    ...onuBatch(58),
    onu(99, { oltPonPort: '', splitterBoxId: '' })
  ];
  const before = JSON.stringify(customers);
  const report = buildPonCapacityReport(customers);
  renderPonCapacityRows(report, tr);
  assert.equal(JSON.stringify(customers), before);
});

test('empty and malformed input produce an empty report, never a crash', () => {
  for (const input of [[], null, undefined, 'junk']) {
    const report = buildPonCapacityReport(input);
    assert.deepEqual(report.ports, []);
    assert.equal(report.unassigned.activeOnus, 0);
    assert.equal(report.totals.activeOnus, 0);
    assert.equal(renderPonCapacityRows(report, tr), '');
  }
});

test('i18n: every poncap_* / dash_card_poncap key exists in en + ur and t() never returns a raw key', () => {
  const keys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('poncap_') || key === 'dash_card_poncap');
  assert.ok(keys.length >= 15, `expected the SISP-103 key set, got ${keys.length}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.notEqual(t(key, 'en', { ports: 2, onus: 3, count: 1, mbps: '5', ratio: '0.10', labels: 'x', max: 64 }), key, `en t() raw key ${key}`);
    assert.notEqual(t(key, 'ur', { ports: 2, onus: 3, count: 1, mbps: '5', ratio: '0.10', labels: 'x', max: 64 }), key, `ur t() raw key ${key}`);
  }
});

test('wiring: app.js consumes the module via the dashboard.js re-export bridge, index.html carries the card, CSS is token-only', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  // The deployment terminology guard (tests/deployment.test.js) forbids
  // the module's own name in app.js source, so app.js must consume the
  // builders through dashboard.js — never a direct specifier.
  assert.doesNotMatch(appSource, /olt-pon-capacity/);
  assert.match(appSource, /buildPonCapacityReport, renderPonCapacityRows \} from '\.\/dashboard\.js\?v=/);
  assert.match(appSource, /buildPonCapacityReport\(state\.customers\)/);
  const dashboardSource = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboardSource, /export \{ buildPonCapacityReport, renderPonCapacityRows \} from '\.\/olt-pon-capacity\.js';/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="ponCapacitySummary"/);
  assert.match(html, /id="dashboardPonCapacityValue"/);
  assert.match(html, /data-i18n="dash_card_poncap"/);
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-103: PON port capacity'), css.indexOf('.splitter-map-summary p'));
  assert.ok(block.includes('.pon-cap-row-amber'), 'amber row style present');
  assert.ok(block.includes('var(--color-pending-bg)'), 'amber uses the pending token');
  assert.ok(block.includes('var(--color-overdue)'), 'red uses the overdue token');
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, 'no hardcoded hex in the SISP-103 CSS block');
});
