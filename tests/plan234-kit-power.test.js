import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validKitPowerDate,
  normalizeKitPowerList,
  recordKitPower,
  removeKitPower,
  findKitPower,
  kitPowerSorted,
  kitPowerForItem,
  kitPowerItems,
  kitPowerLastCharge,
  kitPowerVisits,
  kitPowerStale,
  kitPowerSummaryText,
  kitPowerText,
  kitPowerItemText,
  kitPowerHtml,
  kitPowerCsv,
  kitPowerFilename,
} from '../kit-power.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'kit-power.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const e1 = { id: 'KP-1', item: 'Power Bank A', kit: 'Kit 1', dateCharged: '2026-03-01', visit: 'Mohalla A visit', condition: 'Full charge' };
const e2 = { id: 'KP-2', item: 'Power Bank A', kit: 'Kit 1', dateCharged: '2026-03-05', visit: 'Mohalla B visit', condition: 'Good' };
const e3 = { id: 'KP-3', item: 'Charger B', kit: 'Kit 2', dateCharged: '2026-02-20', visit: 'Mohalla A visit', condition: '' };

test('half-formed refusal, including no item, no kit, and no date charged', () => {
  assert.equal(recordKitPower([], { item: 'Power Bank A', kit: 'Kit 1', dateCharged: '2026-03-01' }), null);
  assert.equal(recordKitPower([], { id: 'KP-x', kit: 'Kit 1', dateCharged: '2026-03-01' }), null);
  assert.equal(recordKitPower([], { id: 'KP-x', item: 'Power Bank A', dateCharged: '2026-03-01' }), null);
  assert.equal(recordKitPower([], { id: 'KP-x', item: 'Power Bank A', kit: 'Kit 1' }), null);
  assert.notEqual(recordKitPower([], { id: 'KP-x', item: 'Power Bank A', kit: 'Kit 1', dateCharged: '2026-03-01', visit: '', condition: '' }), null);
});

test('strict dates, including the leap-day rule', () => {
  assert.equal(validKitPowerDate('2026-02-30'), false);
  assert.equal(validKitPowerDate('2024-02-29'), true);
  assert.equal(validKitPowerDate('2026-02-29'), false);
  assert.equal(validKitPowerDate('2026-13-01'), false);
  assert.equal(recordKitPower([], { ...e1, dateCharged: '2026-02-30' }), null);
  assert.notEqual(recordKitPower([], { ...e1, dateCharged: '2024-02-29' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...e1, billTotal: 5000, customerName: 'Ahmed' };
  const next = recordKitPower([], input);
  assert.equal(next.length, 1);
  assert.equal('billTotal' in next[0], false);
  assert.equal('customerName' in next[0], false);
  assert.equal(input.billTotal, 5000);
  assert.deepEqual(normalizeKitPowerList([e1, { ...e2, id: 'KP-1' }]).length, 1);
});

test('duplicate-id rule, find, and remove', () => {
  assert.equal(recordKitPower([e1], { ...e2, id: 'KP-1' }), null);
  assert.equal(findKitPower([e1, e2], 'KP-2').item, 'Power Bank A');
  assert.equal(findKitPower([e1], 'KP-9'), null);
  assert.deepEqual(removeKitPower([e1, e2], 'KP-1').map((item) => item.id), ['KP-2']);
  assert.deepEqual(removeKitPower([e1], 'KP-9').map((item) => item.id), ['KP-1']);
});

test('sorting by item, then date, then id', () => {
  assert.deepEqual(kitPowerSorted([e2, e3, e1]).map((item) => item.id), ['KP-3', 'KP-1', 'KP-2']);
});

test('per-item listing, case-insensitive', () => {
  assert.deepEqual(kitPowerForItem([e1, e2, e3], 'power bank').map((item) => item.id), ['KP-1', 'KP-2']);
  assert.deepEqual(kitPowerForItem([e1, e2, e3], 'CHARGER').map((item) => item.id), ['KP-3']);
  assert.deepEqual(kitPowerForItem([e1], ''), []);
  assert.deepEqual(kitPowerItems([e2, e3, e1]), ['Charger B', 'Power Bank A']);
});

test('last charge date and visits carried on', () => {
  assert.equal(kitPowerLastCharge([e1, e2, e3], 'Power Bank A').dateCharged, '2026-03-05');
  assert.equal(kitPowerLastCharge([e1], 'Charger B'), null);
  assert.deepEqual(kitPowerVisits([e1, e2, e3], 'Power Bank A'), ['Mohalla A visit', 'Mohalla B visit']);
  assert.deepEqual(kitPowerVisits([e1, { ...e2, visit: 'Mohalla A visit' }], 'Power Bank A'), ['Mohalla A visit']);
});

test('stale flag: over the interval flagged, exactly the interval not flagged', () => {
  // Last charges: Power Bank A 2026-03-05, Charger B 2026-02-20.
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-10', 7), ['Charger B']);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-12', 7), ['Charger B']);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-12', 5), ['Charger B', 'Power Bank A']);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-12', 20), []);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-02-30', 7), []);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-12', -1), []);
  assert.deepEqual(kitPowerStale([e1, e2, e3], '2026-03-12', 'seven'), []);
});

test('a newer entry never rewrites an earlier entry', () => {
  const list = recordKitPower(recordKitPower([], e1), e2);
  assert.equal(findKitPower(list, 'KP-1').dateCharged, '2026-03-01');
  assert.equal(findKitPower(list, 'KP-1').condition, 'Full charge');
  assert.equal(list.length, 2);
});

test('summary, item, and entry text with plain fallbacks', () => {
  assert.equal(kitPowerSummaryText([]), 'No kit power entries recorded.');
  assert.equal(kitPowerSummaryText([e1]), '1 charge entry across 1 kit item.');
  assert.equal(kitPowerSummaryText([e1, e2, e3]), '3 charge entries across 2 kit items.');
  assert.equal(kitPowerItemText([e1, e2], 'Power Bank A'), 'Power Bank A (Kit 1) last charged on 2026-03-05. Carried on: Mohalla A visit, Mohalla B visit.');
  assert.equal(kitPowerItemText([e1], 'Charger B'), 'No charge recorded for Charger B.');
  assert.equal(kitPowerText(e3), 'Charger B (Kit 2) charged on 2026-02-20, carried on Mohalla A visit. Condition: No condition noted.');
  assert.equal(kitPowerText(null), 'No kit power entry.');
});

test('HTML escaping', () => {
  const html = kitPowerHtml({ ...e1, item: 'Bank <A> & "Co"' });
  assert.ok(html.includes('Bank &lt;A&gt; &amp; &quot;Co&quot;'));
  assert.ok(!html.includes('<A>'));
});

test('CSV and filename', () => {
  const csv = kitPowerCsv([e2, e1]);
  assert.ok(csv.startsWith('id,item,kit,date charged,visit,condition'));
  assert.ok(csv.includes('KP-1,Power Bank A,Kit 1,2026-03-01,Mohalla A visit,Full charge'));
  assert.equal(kitPowerFilename(), 'kit-power-log.csv');
});

test('list normalisation drops bad rows', () => {
  assert.deepEqual(normalizeKitPowerList(null), []);
  assert.deepEqual(normalizeKitPowerList([e1, null, { ...e2, dateCharged: 'bad' }]).map((item) => item.id), ['KP-1']);
});

test('purity fence: no clock, storage, or network in the module', () => {
  assert.doesNotMatch(moduleSrc, /new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(moduleSrc, /^import /m);
});

test('neighbour-module fence: field kit only, never site power, site battery, or tool issue', () => {
  assert.doesNotMatch(moduleSrc, /battery-runtime|power-status-log|tool-kit-log|generator-fuel-log/);
});

test('never-changes fence: the module takes no bill, payment, customer, visit, or staff object in', () => {
  assert.doesNotMatch(moduleSrc, /billTotal|customerName|paymentAmount|staffId/);
});

test('panel-id presence in index.html', () => {
  for (const id of ['kpHeading', 'kpSummary', 'kpExportBtn', 'kpItem', 'kpKit', 'kpDate', 'kpVisit', 'kpCondition', 'kpSaveBtn', 'kpRemoveId', 'kpRemoveBtn', 'kpFilter', 'kpCheckItem', 'kpCheckBtn', 'kpCheckOut', 'kpAsOf', 'kpInterval', 'kpStaleBtn', 'kpStaleOut', 'kpBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes(`from './kit-power.js'`));
  assert.ok(appJs.includes('function renderKitPower()'));
  assert.ok(appJs.includes('renderKitPower();'));
  assert.ok(appJs.includes(`localStorage.getItem(KIT_POWER_KEY`));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.doesNotMatch(appJs, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
