import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validVehicleFuelDate,
  normalizeVehicleFuelList,
  recordVehicleFuel,
  removeVehicleFuel,
  findVehicleFuel,
  vehicleFuelSorted,
  vehicleFuelForVehicle,
  vehicleFuelVehicles,
  vehicleFuelMonthlyEntries,
  vehicleFuelMonthlyTotal,
  vehicleFuelMonthlySummaryText,
  addVehicleFuelFollowUp,
  vehicleFuelSummaryText,
  vehicleFuelText,
  vehicleFuelHtml,
  vehicleFuelCsv,
  vehicleFuelFilename,
} from '../vehicle-fuel.js';
import fs from 'node:fs';

const entryA = { id: 'f1', vehicle: 'Bike', date: '2026-10-03', fuelLitres: 5, cost: 1400, odometer: 12000, visits: ['Mohalla A', 'Mohalla B'] };
const entryB = { id: 'f2', vehicle: 'Bike', date: '2026-10-20', fuelLitres: 4, cost: 1120, visits: 'Mohalla C' };
const entryC = { id: 'f3', vehicle: 'Van', date: '2026-11-02', fuelLitres: 10, costCents: 280000, visits: ['Mohalla A'] };

test('half-formed entries are refused', () => {
  assert.equal(recordVehicleFuel([], { vehicle: 'Bike', date: '2026-10-03', fuelLitres: 5, cost: 1400, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', date: '2026-10-03', fuelLitres: 5, cost: 1400, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', fuelLitres: 5, cost: 1400, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', date: '2026-10-03', cost: 1400, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', date: '2026-10-03', fuelLitres: 0, cost: 1400, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', date: '2026-10-03', fuelLitres: 5, visits: ['X'] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', date: '2026-10-03', fuelLitres: 5, cost: 1400, visits: [] }).length, 0);
  assert.equal(recordVehicleFuel([], { id: 'x', vehicle: 'Bike', date: '2026-10-03', fuelLitres: 5, cost: 1400, odometer: -1, visits: ['X'] }).length, 0);
});

test('strict dates: leap day accepted, impossible dates refused', () => {
  assert.equal(validVehicleFuelDate('2024-02-29'), true);
  assert.equal(validVehicleFuelDate('2026-02-29'), false);
  assert.equal(validVehicleFuelDate('2026-02-30'), false);
  assert.equal(validVehicleFuelDate('2026-13-01'), false);
  assert.equal(validVehicleFuelDate('2026-10-3'), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...entryA, surprise: 'nope', followUps: [{ date: '2026-10-04', note: 'Meter checked.', junk: 1 }] };
  const frozen = JSON.parse(JSON.stringify(input));
  const list = recordVehicleFuel([], input);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.deepEqual(list[0].followUps, [{ date: '2026-10-04', note: 'Meter checked.' }]);
  assert.deepEqual(input, frozen);
});

test('duplicate ids are never rewritten', () => {
  const list = recordVehicleFuel(recordVehicleFuel([], entryA), { ...entryA, fuelLitres: 99 });
  assert.equal(list.length, 1);
  assert.equal(list[0].fuelLitres, 5);
});

test('find and remove', () => {
  const list = [entryA, entryB].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  assert.equal(findVehicleFuel(list, 'f2').vehicle, 'Bike');
  assert.equal(findVehicleFuel(list, 'missing'), null);
  assert.equal(removeVehicleFuel(list, 'f1').length, 1);
  assert.equal(removeVehicleFuel(list, 'missing').length, 2);
});

test('sorting is date, then vehicle, then id', () => {
  const sorted = vehicleFuelSorted([entryC, entryB, entryA]);
  assert.deepEqual(sorted.map((item) => item.id), ['f1', 'f2', 'f3']);
});

test('vehicle filter is case-insensitive substring', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  assert.deepEqual(vehicleFuelForVehicle(list, 'bike').map((item) => item.id), ['f1', 'f2']);
  assert.deepEqual(vehicleFuelForVehicle(list, 'VAN').map((item) => item.id), ['f3']);
  assert.deepEqual(vehicleFuelVehicles(list), ['Bike', 'Van']);
});

test('monthly entries and monthly total match exactly', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  const entries = vehicleFuelMonthlyEntries(list, 'Bike', '2026-10');
  assert.deepEqual(entries.map((item) => item.id), ['f1', 'f2']);
  const total = vehicleFuelMonthlyTotal(list, 'Bike', '2026-10');
  assert.equal(total.count, 2);
  assert.equal(total.fuelLitres, 9);
  assert.equal(total.costCents, 252000);
  const listedFuel = entries.reduce((sum, item) => sum + item.fuelLitres, 0);
  const listedCost = entries.reduce((sum, item) => sum + item.costCents, 0);
  assert.equal(listedFuel, total.fuelLitres);
  assert.equal(listedCost, total.costCents);
});

test('monthly total for all vehicles and bad months', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  assert.equal(vehicleFuelMonthlyTotal(list, '', '2026-10').count, 2);
  assert.equal(vehicleFuelMonthlyTotal(list, 'Bike', '2026-13'), null);
  assert.equal(vehicleFuelMonthlyTotal(list, 'Bike', 'not-a-month'), null);
  assert.deepEqual(vehicleFuelMonthlyEntries(list, 'Bike', '2026-13'), []);
});

test('follow-up corrects without rewriting the entry', () => {
  const list = [entryA].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  const next = addVehicleFuelFollowUp(list, 'f1', '2026-10-05', 'Odometer rechecked: 12050.');
  assert.equal(next[0].fuelLitres, 5);
  assert.equal(next[0].costCents, 140000);
  assert.equal(next[0].odometer, 12000);
  assert.deepEqual(next[0].visits, ['Mohalla A', 'Mohalla B']);
  assert.deepEqual(next[0].followUps, [{ date: '2026-10-05', note: 'Odometer rechecked: 12050.' }]);
  assert.deepEqual(addVehicleFuelFollowUp(list, 'missing', '2026-10-05', 'Note.'), list);
  assert.deepEqual(addVehicleFuelFollowUp(list, 'f1', '2026-02-30', 'Note.'), list);
  assert.deepEqual(addVehicleFuelFollowUp(list, 'f1', '2026-10-05', '   '), list);
});

test('rupees convert to cents exactly once, cents pass through as-is', () => {
  const list = recordVehicleFuel(recordVehicleFuel([], entryA), entryC);
  assert.equal(findVehicleFuel(list, 'f1').costCents, 140000);
  assert.equal(findVehicleFuel(list, 'f3').costCents, 280000);
  const reread = normalizeVehicleFuelList(list);
  assert.equal(findVehicleFuel(reread, 'f1').costCents, 140000);
});

test('summary, monthly summary and entry text', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  assert.equal(vehicleFuelSummaryText(list), '3 fuel entries across 2 vehicles: 19 litres, Rs. 5320.00 in total.');
  assert.equal(vehicleFuelMonthlySummaryText(list, 'Bike', '2026-10'), 'Bike, 2026-10: 2 entries, 9 litres, Rs. 2520.00.');
  assert.equal(vehicleFuelMonthlySummaryText(list, 'Bike', '2026-13'), 'No monthly total: the month must be YYYY-MM.');
  assert.equal(
    vehicleFuelText(entryB),
    'Bike on 2026-10-20: 4 litres, Rs. 1120.00. Odometer not noted. Visits covered: Mohalla C.'
  );
});

test('HTML escapes markup and CSV has the right filename', () => {
  const nasty = { id: 'f9', vehicle: '<Bike & Co>', date: '2026-10-03', fuelLitres: 5, cost: 1400, visits: ['<Mohalla>'] };
  const html = vehicleFuelHtml(nasty);
  assert.equal(html.includes('<Bike'), false);
  assert.equal(html.includes('&lt;Bike &amp; Co&gt;'), true);
  const list = [entryA, entryB].reduce((acc, item) => recordVehicleFuel(acc, item), []);
  const csv = vehicleFuelCsv(list);
  assert.equal(csv.split('\n')[0], '"id","vehicle","date","fuel litres","cost Rs","odometer","visits covered","follow-ups"');
  assert.equal(csv.includes('f1'), true);
  assert.equal(vehicleFuelFilename(), 'vehicle-fuel-log.csv');
});

test('purity fence: no storage, clock, or network access', () => {
  const source = fs.readFileSync(new URL('../vehicle-fuel.js', import.meta.url), 'utf8');
  assert.equal(/localStorage|sessionStorage|new Date\(|Date\.now\(|fetch\(|XMLHttpRequest/.test(source), false);
});

test('neighbour-module fence: visit-time and generator-fuel modules are never imported', () => {
  const source = fs.readFileSync(new URL('../vehicle-fuel.js', import.meta.url), 'utf8');
  assert.equal(/import\s/.test(source), false);
  assert.equal(source.includes('visit-times'), false);
  assert.equal(source.includes('generator-fuel'), false);
});

test('panel ids are present in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['vfHeading', 'vfSummary', 'vfExportBtn', 'vfVehicle', 'vfDate', 'vfFuel', 'vfCost', 'vfOdometer', 'vfVisits', 'vfSaveBtn', 'vfRemoveId', 'vfRemoveBtn', 'vfFilter', 'vfFollowId', 'vfFollowDate', 'vfFollowNote', 'vfFollowBtn', 'vfMonth', 'vfMonthVehicle', 'vfMonthBtn', 'vfMonthOut', 'vfBody']) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wiring imports the vehicle fuel module', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './vehicle-fuel.js'"), true);
  assert.equal(source.includes('renderVehicleFuel'), true);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const matches = source.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(matches.length, 0);
});
