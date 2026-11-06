import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as monthlyKpiTargetModule from '../monthly-kpi-target.js';
import {
  validMonthlyKpiTargetDay,
  validMonthlyKpiTargetMonth,
  monthlyKpiTargetMonthEnd,
  normalizeMonthlyKpiTargetFigure,
  normalizeMonthlyKpiTarget,
  normalizeMonthlyKpiTargetList,
  recordMonthlyKpiTarget,
  monthlyKpiTargetFor,
  monthlyKpiTargetIsLate,
  monthlyKpiTargetLate,
  monthlyKpiTargetComparison,
  monthlyKpiTargetDifferenceText,
  monthlyKpiTargetCounts,
  monthlyKpiTargetSummaryText,
  monthlyKpiTargetText,
  monthlyKpiTargetComparisonText,
  monthlyKpiTargetHtml,
  monthlyKpiTargetsHtml,
  monthlyKpiTargetLateHtml,
  monthlyKpiTargetComparisonHtml,
  monthlyKpiTargetCsv,
  monthlyKpiTargetFilename,
} from '../monthly-kpi-target.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'monthly-kpi-target.js'), 'utf8');

const TARGET_A = {
  id: 'MKT-1', kpiName: 'Collections', targetFigure: 180000, month: '2026-11',
  setBy: 'Owner', dateSet: '2026-11-01',
};
const TARGET_B = {
  id: 'MKT-2', kpiName: 'New customers', targetFigure: 5, month: '2026-11',
  setBy: 'Owner', dateSet: '2026-11-02',
};
const TARGET_C = {
  id: 'MKT-3', kpiName: 'Open faults', targetFigure: 10, month: '2026-10',
  setBy: 'Saad', dateSet: '2026-11-05',
};
const TARGET_D = {
  id: 'MKT-4', kpiName: 'Collections', targetFigure: 200000, month: '2026-12',
  setBy: 'Owner', dateSet: '2026-11-20',
};

test('strict date: real calendar dates only', () => {
  assert.equal(validMonthlyKpiTargetDay('2026-11-06'), true);
  assert.equal(validMonthlyKpiTargetDay('2028-02-29'), true);
  assert.equal(validMonthlyKpiTargetDay('2026-02-29'), false);
  assert.equal(validMonthlyKpiTargetDay('2026-11-31'), false);
  assert.equal(validMonthlyKpiTargetDay('2026-13-01'), false);
  assert.equal(validMonthlyKpiTargetDay('6 Nov 2026'), false);
  assert.equal(validMonthlyKpiTargetDay(''), false);
  assert.equal(validMonthlyKpiTargetDay(null), false);
});

test('month: YYYY-MM only, months 01 to 12', () => {
  assert.equal(validMonthlyKpiTargetMonth('2026-11'), true);
  assert.equal(validMonthlyKpiTargetMonth('2026-01'), true);
  assert.equal(validMonthlyKpiTargetMonth('2026-12'), true);
  assert.equal(validMonthlyKpiTargetMonth('2026-13'), false);
  assert.equal(validMonthlyKpiTargetMonth('2026-00'), false);
  assert.equal(validMonthlyKpiTargetMonth('2026-1'), false);
  assert.equal(validMonthlyKpiTargetMonth('Nov 2026'), false);
  assert.equal(validMonthlyKpiTargetMonth('2026-11-01'), false);
  assert.equal(validMonthlyKpiTargetMonth(''), false);
  assert.equal(validMonthlyKpiTargetMonth(null), false);
});

test('month end is the last calendar day of the month', () => {
  assert.equal(monthlyKpiTargetMonthEnd('2026-11'), '2026-11-30');
  assert.equal(monthlyKpiTargetMonthEnd('2026-10'), '2026-10-31');
  assert.equal(monthlyKpiTargetMonthEnd('2028-02'), '2028-02-29');
  assert.equal(monthlyKpiTargetMonthEnd('2027-02'), '2027-02-28');
  assert.equal(monthlyKpiTargetMonthEnd('2026-13'), null);
  assert.equal(monthlyKpiTargetMonthEnd('Nov 2026'), null);
});

test('target figure: whole numbers zero or more only', () => {
  assert.equal(normalizeMonthlyKpiTargetFigure(180000), 180000);
  assert.equal(normalizeMonthlyKpiTargetFigure(0), 0);
  assert.equal(normalizeMonthlyKpiTargetFigure('180000'), 180000);
  assert.equal(normalizeMonthlyKpiTargetFigure('  5  '), 5);
  assert.equal(normalizeMonthlyKpiTargetFigure('Rs 1800'), null);
  assert.equal(normalizeMonthlyKpiTargetFigure(-5), null);
  assert.equal(normalizeMonthlyKpiTargetFigure('-5'), null);
  assert.equal(normalizeMonthlyKpiTargetFigure(12.5), null);
  assert.equal(normalizeMonthlyKpiTargetFigure('12.5'), null);
  assert.equal(normalizeMonthlyKpiTargetFigure(''), null);
  assert.equal(normalizeMonthlyKpiTargetFigure(null), null);
});

test('normalize keeps a well-formed target and drops unknown fields', () => {
  const clean = normalizeMonthlyKpiTarget({ ...TARGET_A, billId: 'B-1', amount: 3000 });
  assert.deepEqual(clean, TARGET_A);
  assert.equal('billId' in clean, false);
  assert.equal('amount' in clean, false);
});

test('normalize refuses a target with no id, no KPI name, or no setter', () => {
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, id: '' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, id: '   ' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, kpiName: '' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, setBy: '' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ kpiName: 'Collections', month: '2026-11' }), null);
});

test('normalize refuses a target with a bad figure, month, or date set', () => {
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, targetFigure: 'Rs 1800' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, targetFigure: -5 }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, month: '2026-13' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, month: 'Nov 2026' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, dateSet: '2026-02-29' }), null);
  assert.equal(normalizeMonthlyKpiTarget({ ...TARGET_A, dateSet: 'tomorrow' }), null);
});

test('record appends a target and leaves the input list alone', () => {
  const before = [];
  const after = recordMonthlyKpiTarget(before, TARGET_A);
  assert.equal(after.length, 1);
  assert.equal(before.length, 0);
  assert.deepEqual(after[0], TARGET_A);
});

test('record refuses a duplicate id', () => {
  const after = recordMonthlyKpiTarget([TARGET_A], { ...TARGET_A, kpiName: 'Other KPI' });
  assert.equal(after.length, 1);
  assert.equal(after[0].kpiName, 'Collections');
});

test('record refuses a second target for the same KPI and month, any spelling', () => {
  const after = recordMonthlyKpiTarget([TARGET_A], { ...TARGET_B, id: 'MKT-9', kpiName: 'collections' });
  assert.equal(after.length, 1);
});

test('record allows the same KPI in another month and another KPI in the same month', () => {
  const after = recordMonthlyKpiTarget([TARGET_A], TARGET_D);
  assert.equal(after.length, 2);
  const afterB = recordMonthlyKpiTarget([TARGET_A], TARGET_B);
  assert.equal(afterB.length, 2);
});

test('lookup finds a target case-insensitively and returns null when missing', () => {
  const list = [TARGET_A, TARGET_B];
  assert.equal(monthlyKpiTargetFor(list, 'COLLECTIONS', '2026-11').id, 'MKT-1');
  assert.equal(monthlyKpiTargetFor(list, 'Collections', '2026-12'), null);
  assert.equal(monthlyKpiTargetFor(list, 'No such KPI', '2026-11'), null);
  assert.equal(monthlyKpiTargetFor([], 'Collections', '2026-11'), null);
});

test('late: a target set after the month ends is late, on the last day it is not', () => {
  assert.equal(monthlyKpiTargetIsLate(TARGET_C), true);
  assert.equal(monthlyKpiTargetIsLate(TARGET_A), false);
  assert.equal(monthlyKpiTargetIsLate({ ...TARGET_A, dateSet: '2026-11-30' }), false);
  assert.equal(monthlyKpiTargetIsLate({ ...TARGET_A, dateSet: '2026-12-01' }), true);
  assert.equal(monthlyKpiTargetIsLate({ ...TARGET_A, month: '2028-02', dateSet: '2028-02-29' }), false);
  assert.equal(monthlyKpiTargetIsLate({ ...TARGET_A, month: '2028-02', dateSet: '2028-03-01' }), true);
  assert.equal(monthlyKpiTargetIsLate({ ...TARGET_A, month: '2027-02', dateSet: '2027-02-28' }), false);
  assert.equal(monthlyKpiTargetIsLate(null), false);
});

test('late targets list in month order, then KPI name A to Z', () => {
  const list = [TARGET_C, TARGET_A, { ...TARGET_B, id: 'MKT-5', dateSet: '2026-12-02' }];
  const late = monthlyKpiTargetLate(list);
  assert.deepEqual(late.map((item) => item.id), ['MKT-3', 'MKT-5']);
  assert.deepEqual(monthlyKpiTargetLate([TARGET_A, TARGET_B]), []);
});

test('comparison puts each target beside its actual figure with the difference', () => {
  const actuals = [
    { kpiName: 'Collections', month: '2026-11', figure: 175000 },
    { kpiName: 'New customers', month: '2026-11', figure: 5 },
  ];
  const entries = monthlyKpiTargetComparison([TARGET_A, TARGET_B, TARGET_C], actuals);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].target.id, 'MKT-3');
  assert.equal(entries[0].actualFigure, null);
  assert.equal(entries[0].difference, null);
  assert.equal(entries[0].late, true);
  assert.equal(entries[1].target.id, 'MKT-1');
  assert.equal(entries[1].actualFigure, 175000);
  assert.equal(entries[1].difference, -5000);
  assert.equal(entries[2].target.id, 'MKT-2');
  assert.equal(entries[2].actualFigure, 5);
  assert.equal(entries[2].difference, 0);
  assert.equal(monthlyKpiTargetComparison([TARGET_A], []).length, 1);
  assert.deepEqual(monthlyKpiTargetComparison([TARGET_A], [])[0].difference, null);
});

test('difference text reads in plain words', () => {
  assert.equal(monthlyKpiTargetDifferenceText(null), 'No actual figure yet');
  assert.equal(monthlyKpiTargetDifferenceText(0), 'On target');
  assert.equal(monthlyKpiTargetDifferenceText(5000), '5000 above target');
  assert.equal(monthlyKpiTargetDifferenceText(-5000), '5000 below target');
});

test('counts reconcile: total equals late plus on time', () => {
  const counts = monthlyKpiTargetCounts([TARGET_A, TARGET_B, TARGET_C]);
  assert.deepEqual(counts, { total: 3, late: 1, onTime: 2 });
  assert.equal(counts.late + counts.onTime, counts.total);
  assert.deepEqual(monthlyKpiTargetCounts([]), { total: 0, late: 0, onTime: 0 });
});

test('summary text names the late count in plain words', () => {
  assert.equal(monthlyKpiTargetSummaryText([]), 'No monthly KPI targets recorded.');
  assert.equal(monthlyKpiTargetSummaryText([TARGET_A]), '1 monthly KPI target recorded, all set on time.');
  assert.equal(monthlyKpiTargetSummaryText([TARGET_A, TARGET_B]), '2 monthly KPI targets recorded, all set on time.');
  assert.equal(
    monthlyKpiTargetSummaryText([TARGET_A, TARGET_C]),
    '2 monthly KPI targets recorded, 1 set late — flagged below.',
  );
});

test('plain text names the KPI, target, setter, and late marker', () => {
  assert.equal(
    monthlyKpiTargetText(TARGET_A),
    'Collections (2026-11): target 180000, set by Owner on 2026-11-01',
  );
  assert.equal(
    monthlyKpiTargetText(TARGET_C),
    'Open faults (2026-10): target 10, set by Saad on 2026-11-05 — set late',
  );
  const entry = monthlyKpiTargetComparison([TARGET_A], [{ kpiName: 'Collections', month: '2026-11', figure: 175000 }])[0];
  assert.equal(
    monthlyKpiTargetComparisonText(entry),
    'Collections (2026-11): target 180000, set by Owner on 2026-11-01 — actual 175000, 5000 below target',
  );
  const missing = monthlyKpiTargetComparison([TARGET_A], [])[0];
  assert.equal(
    monthlyKpiTargetComparisonText(missing),
    'Collections (2026-11): target 180000, set by Owner on 2026-11-01 — actual not recorded, No actual figure yet',
  );
});

test('HTML escapes KPI name and setter text', () => {
  const nasty = { ...TARGET_A, kpiName: '<script>alert(1)</script>', setBy: '<b>Owner</b>' };
  const html = monthlyKpiTargetHtml(nasty);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;Owner&lt;/b&gt;'));
  const listHtml = monthlyKpiTargetsHtml([TARGET_A, TARGET_C]);
  assert.ok(listHtml.startsWith('<ul>'));
  assert.ok(listHtml.includes('set late'));
  const lateHtml = monthlyKpiTargetLateHtml([TARGET_A, TARGET_C]);
  assert.ok(lateHtml.includes('Open faults'));
  assert.ok(!lateHtml.includes('Collections (2026-11)'));
  const compareHtml = monthlyKpiTargetComparisonHtml([TARGET_A], [{ kpiName: 'Collections', month: '2026-11', figure: 175000 }]);
  assert.ok(compareHtml.includes('5000 below target'));
});

test('CSV has a header row, one row per target, and quotes commas', () => {
  const csv = monthlyKpiTargetCsv([TARGET_B, TARGET_A]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,kpiName,targetFigure,month,setBy,dateSet,late');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('MKT-1,Collections,180000,2026-11,Owner,2026-11-01,no'));
  const quoted = monthlyKpiTargetCsv([{ ...TARGET_A, kpiName: 'New, collections' }]);
  assert.ok(quoted.includes('"New, collections"'));
  assert.equal(monthlyKpiTargetFilename(), 'monthly-kpi-target.csv');
});

test('inputs are never mutated, even deep-frozen', () => {
  const frozen = Object.freeze([
    Object.freeze({ ...TARGET_A }),
    Object.freeze({ ...TARGET_C }),
  ]);
  const frozenActuals = Object.freeze([
    Object.freeze({ kpiName: 'Collections', month: '2026-11', figure: 175000 }),
  ]);
  const before = JSON.stringify(frozen);
  recordMonthlyKpiTarget(frozen, { ...TARGET_B });
  monthlyKpiTargetComparison(frozen, frozenActuals);
  monthlyKpiTargetLate(frozen);
  monthlyKpiTargetCounts(frozen);
  monthlyKpiTargetSummaryText(frozen);
  monthlyKpiTargetsHtml(frozen);
  monthlyKpiTargetCsv(frozen);
  assert.equal(JSON.stringify(frozen), before);
  assert.equal(JSON.stringify(frozenActuals), '[{"kpiName":"Collections","month":"2026-11","figure":175000}]');
});

test('module is pure: no page, storage, clock, network, or behaviour change', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(monthlyKpiTargetModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change|send/i.test(name)));
});

test('fence: module never names the existing monthly KPI sheet or annual goals files', () => {
  assert.ok(!moduleSrc.includes('monthly-kpi-sheet'));
  assert.ok(!moduleSrc.includes('annual-goals'));
});

test('wiring: app.js imports the module, renders it, and stores it under the mkt key', () => {
  assert.ok(appJs.includes("from './monthly-kpi-target.js'"));
  assert.ok(appJs.includes('renderMonthlyKpiTargets()'));
  assert.ok(appJs.includes('shahdara_mkt_targets_v1'));
  assert.ok(appJs.includes('monthlyKpiTargetSummaryText'));
  assert.ok(!/renderMonthlyKpiTargets\(\)\s*;\s*renderMonthlyKpiTargets\(\)/.test(appJs));
});

test('wiring: index.html carries the mkt panel after the Plan 345 panel', () => {
  assert.ok(indexHtml.includes('id="mktHeading"'));
  assert.ok(indexHtml.includes('id="mktBody"'));
  assert.ok(indexHtml.includes('id="mktSummary"'));
  assert.ok(indexHtml.includes('id="mktSaveBtn"'));
  assert.ok(indexHtml.includes('id="mktCompareBtn"'));
  assert.ok(indexHtml.indexOf('id="rclHeading"') < indexHtml.indexOf('id="mktHeading"'));
});
