import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validOltPortPlanDate,
  normalizeOltPortPlanList,
  recordOltPortPlan,
  removeOltPortPlan,
  findOltPortPlan,
  convertOltPortPlanToUsed,
  oltPortPlansSorted,
  oltPortPlansForUnit,
  plannedOltPortPlans,
  usedOltPortPlans,
  oltPortPlanUnits,
  oltPortPlanSummaryText,
  oltPortPlanText,
  oltPortPlanHtml,
  oltPortPlanCsv,
  oltPortPlanFilename,
} from '../port-plan.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'port-plan.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const p1 = { id: 'PP-1', unit: 'OLT-1', port: '12', status: 'planned', plannedFor: 'Ahmed, Mohalla A', datePlanned: '2026-03-02', customerConnected: '' };
const p2 = { id: 'PP-2', unit: 'OLT-1', port: '13', status: 'planned', plannedFor: 'Mohalla B', datePlanned: '2026-03-05', customerConnected: '' };
const p3 = { id: 'PP-3', unit: 'OLT-2', port: '4', status: 'used', plannedFor: 'Fatima', datePlanned: '2026-02-10', customerConnected: 'Fatima' };

test('half-formed refusal, including no unit, no port, and no date planned', () => {
  assert.equal(recordOltPortPlan([], { unit: 'OLT-1', port: '12', datePlanned: '2026-03-01' }), null);
  assert.equal(recordOltPortPlan([], { id: 'PP-x', port: '12', datePlanned: '2026-03-01' }), null);
  assert.equal(recordOltPortPlan([], { id: 'PP-x', unit: 'OLT-1', datePlanned: '2026-03-01' }), null);
  assert.equal(recordOltPortPlan([], { id: 'PP-x', unit: 'OLT-1', port: '12' }), null);
  assert.notEqual(recordOltPortPlan([], { id: 'PP-x', unit: 'OLT-1', port: '12', datePlanned: '2026-03-01', plannedFor: '' }), null);
});

test('strict dates, including the leap-day rule', () => {
  assert.equal(validOltPortPlanDate('2026-02-30'), false);
  assert.equal(validOltPortPlanDate('2024-02-29'), true);
  assert.equal(validOltPortPlanDate('2026-02-29'), false);
  assert.equal(validOltPortPlanDate('2026-13-01'), false);
  assert.equal(recordOltPortPlan([], { ...p1, datePlanned: '2026-02-30' }), null);
  assert.notEqual(recordOltPortPlan([], { ...p1, datePlanned: '2024-02-29' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...p1, billTotal: 5000, assignmentRef: 'A-9' };
  const next = recordOltPortPlan([], input);
  assert.equal(next.length, 1);
  assert.equal('billTotal' in next[0], false);
  assert.equal('assignmentRef' in next[0], false);
  assert.equal(input.billTotal, 5000);
  assert.deepEqual(normalizeOltPortPlanList([p1, { ...p2, id: 'PP-1' }]).length, 1);
});

test('one record per unit and port, never double-counted', () => {
  assert.equal(recordOltPortPlan([p1], { ...p2, port: '12' }), null);
  assert.equal(recordOltPortPlan([p1], { ...p2, unit: 'olt-1', port: '12' }), null);
  assert.notEqual(recordOltPortPlan([p1], { ...p2, port: '14' }), null);
  assert.deepEqual(normalizeOltPortPlanList([p1, { ...p2, port: '12' }]).map((item) => item.id), ['PP-1']);
});

test('planned and used listed separately per unit', () => {
  const list = [p3, p1, p2];
  assert.deepEqual(plannedOltPortPlans(list, 'OLT-1').map((item) => item.id), ['PP-1', 'PP-2']);
  assert.deepEqual(usedOltPortPlans(list, 'OLT-1').map((item) => item.id), []);
  assert.deepEqual(usedOltPortPlans(list, 'OLT-2').map((item) => item.id), ['PP-3']);
  assert.deepEqual(plannedOltPortPlans(list).map((item) => item.id), ['PP-1', 'PP-2']);
  assert.deepEqual(usedOltPortPlans(list).map((item) => item.id), ['PP-3']);
});

test('sorting by unit then numeric port', () => {
  const list = [p2, p3, p1, { id: 'PP-4', unit: 'OLT-1', port: '3', status: 'planned', plannedFor: '', datePlanned: '2026-03-01', customerConnected: '' }];
  assert.deepEqual(oltPortPlansSorted(list).map((item) => item.id), ['PP-4', 'PP-1', 'PP-2', 'PP-3']);
  assert.deepEqual(oltPortPlansForUnit(list, 'olt-1').map((item) => item.id), ['PP-4', 'PP-1', 'PP-2']);
  assert.deepEqual(oltPortPlanUnits(list), ['OLT-1', 'OLT-2']);
});

test('converting a planned port to used names the customer connected', () => {
  const converted = convertOltPortPlanToUsed([p1, p2], 'PP-1', 'Ahmed');
  assert.equal(converted.find((item) => item.id === 'PP-1').status, 'used');
  assert.equal(converted.find((item) => item.id === 'PP-1').customerConnected, 'Ahmed');
  assert.equal(converted.find((item) => item.id === 'PP-1').port, '12');
  assert.equal(converted.find((item) => item.id === 'PP-1').datePlanned, '2026-03-02');
  assert.equal(converted.find((item) => item.id === 'PP-1').plannedFor, 'Ahmed, Mohalla A');
  assert.deepEqual(plannedOltPortPlans(converted, 'OLT-1').map((item) => item.id), ['PP-2']);
  assert.deepEqual(usedOltPortPlans(converted, 'OLT-1').map((item) => item.id), ['PP-1']);
});

test('conversion guards: unknown id, already used, and no customer named', () => {
  assert.equal(convertOltPortPlanToUsed([p1], 'PP-9', 'Ahmed'), null);
  assert.equal(convertOltPortPlanToUsed([p3], 'PP-3', 'Fatima'), null);
  assert.equal(convertOltPortPlanToUsed([p1], 'PP-1', ''), null);
  assert.equal(convertOltPortPlanToUsed([p1], 'PP-1', '   '), null);
});

test('find and remove', () => {
  assert.equal(findOltPortPlan([p1, p2], 'PP-2').port, '13');
  assert.equal(findOltPortPlan([p1], 'PP-9'), null);
  assert.deepEqual(removeOltPortPlan([p1, p2], 'PP-1').map((item) => item.id), ['PP-2']);
  assert.deepEqual(removeOltPortPlan([p1], '').map((item) => item.id), ['PP-1']);
});

test('summary and plan text, planned and used', () => {
  assert.equal(oltPortPlanSummaryText([]), 'No port plans recorded.');
  assert.equal(oltPortPlanSummaryText([p1, p2, p3]), '3 port plans across 2 units: 2 planned, 1 used.');
  assert.equal(oltPortPlanText(p1), 'OLT-1 port 12 — planned for Ahmed, Mohalla A on 2026-03-02.');
  assert.equal(oltPortPlanText(p3), 'OLT-2 port 4 — used, connected to Fatima (planned for Fatima on 2026-02-10).');
  assert.equal(oltPortPlanText({ ...p1, plannedFor: '' }), 'OLT-1 port 12 — planned for No one noted on 2026-03-02.');
  assert.equal(oltPortPlanText(null), '');
});

test('HTML escaping, CSV, and filename', () => {
  const tricky = { ...p1, plannedFor: '<b>Ahmed & Co</b>' };
  assert.ok(!oltPortPlanHtml(tricky).includes('<b>'));
  assert.ok(oltPortPlanHtml(tricky).includes('&lt;b&gt;'));
  const csv = oltPortPlanCsv([p2, p1]);
  assert.ok(csv.startsWith('id,unit,port,status,plannedFor,datePlanned,customerConnected'));
  assert.ok(csv.includes('PP-1,OLT-1,12,planned,'));
  assert.equal(oltPortPlanFilename(), 'olt-port-plans.csv');
});

test('list normalisation: non-lists and junk rows', () => {
  assert.deepEqual(normalizeOltPortPlanList('not a list'), []);
  assert.deepEqual(normalizeOltPortPlanList([p1, null, { ...p2, datePlanned: '2026-02-30' }, 'junk', p1]).map((item) => item.id), ['PP-1']);
});

test('purity fence: no clock, storage, or network access', () => {
  assert.ok(!/new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(moduleSrc));
});

test('neighbour-module fence: the assignment register, capacity forecast, and migration log are neither read nor rewritten', () => {
  assert.ok(!moduleSrc.includes('capacity-forecast'));
  assert.ok(!moduleSrc.includes('migration-checklist'));
  assert.ok(!moduleSrc.includes('buildPortRegister'));
  assert.ok(!moduleSrc.includes('loadOltOnuPortTotals'));
  assert.ok(!moduleSrc.includes("from './"));
});

test('never-changes fence: no bill, payment, customer, or assignment object is touched', () => {
  assert.ok(!/billTotal|paymentId|customerId|assignmentId/.test(moduleSrc));
  const before = [p1];
  const after = recordOltPortPlan(before, p2);
  assert.deepEqual(before, [p1]);
  assert.equal(after.length, 2);
});

test('panel ids present in index.html', () => {
  for (const id of ['ppHeading', 'ppSummary', 'ppExportBtn', 'ppUnit', 'ppPort', 'ppPlannedFor', 'ppDate', 'ppSaveBtn', 'ppRemoveId', 'ppRemoveBtn', 'ppFilter', 'ppConvertId', 'ppConvertCustomer', 'ppConvertBtn', 'ppPlannedBody', 'ppUsedBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './port-plan.js'"));
  assert.ok(appJs.includes('renderOltPortPlans()'));
  assert.ok(appJs.includes('PORT_PLAN_KEY'));
  assert.ok(appJs.includes('shahdara_port_plans_v1'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const standalone = appJs.match(/\b(?:suspendService|restoreService|RouterOS|RADIUS|OLT)\b/gi) || [];
  assert.equal(standalone.length, 0);
});
