// SISP-23: New Connection Installation Cost & First-Month Profitability
// Tracker. Pure cost math plus the core.js wiring for the three new
// optional customer fields (mediaConverterCost, linemanInstallFee,
// fiberPerMeterRate). All data here is synthetic; no real customer,
// bill or expense record is touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateInstallationCost } from '../installation-cost.js';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';

const OCT = new Date('2026-10-15T00:00:00Z');

test('verbatim spec criterion: fee 2500, router 2200, 100 m at Rs. 12/m = cost 3400, subsidy 900', () => {
  const result = calculateInstallationCost({
    connectionFee: 2500, routerPrice: 2200, fiberMeters: 100, fiberPerMeterRate: 12
  });
  assert.equal(result.fiberCost, 1200);
  assert.equal(result.totalCost, 3400);
  assert.equal(result.net, -900);
  assert.equal(result.subsidy, 900);
  assert.equal(result.status, 'subsidy');
  assert.equal(result.fiberCostUnknown, false);
  assert.equal(result.totalIsPartial, false);
});

test('surplus case: fee above total cost', () => {
  const result = calculateInstallationCost({
    connectionFee: 5000, routerPrice: 2200, mediaConverterCost: 800,
    fiberMeters: 50, fiberPerMeterRate: 12, linemanInstallFee: 500
  });
  // 2200 + 800 + 600 + 500 = 4100; fee 5000 leaves a 900 surplus.
  assert.equal(result.totalCost, 4100);
  assert.equal(result.net, 900);
  assert.equal(result.subsidy, 0);
  assert.equal(result.status, 'surplus');
  assert.equal(result.breakEvenMonths, null);
});

test('break-even at exactly the fee and zero/missing fields', () => {
  const even = calculateInstallationCost({ connectionFee: 3400, routerPrice: 2200, fiberMeters: 100, fiberPerMeterRate: 12 });
  assert.equal(even.status, 'break-even');
  assert.equal(even.net, 0);
  const empty = calculateInstallationCost({});
  assert.equal(empty.status, 'not-recorded');
  assert.equal(empty.totalCost, 0);
  assert.equal(empty.hasAnyCost, false);
  assert.equal(empty.net, null);
  assert.equal(empty.breakEvenMonths, null);
});

test('unknown fiber rate flags a partial total instead of silently pricing fiber at 0', () => {
  const result = calculateInstallationCost({ connectionFee: 2500, routerPrice: 2200, fiberMeters: 100 });
  assert.equal(result.fiberCost, null);
  assert.equal(result.fiberCostUnknown, true);
  assert.equal(result.totalIsPartial, true);
  assert.equal(result.totalCost, 2200);
  // Zero meters never flag unknown: no fiber was used.
  const noFiber = calculateInstallationCost({ connectionFee: 2500, routerPrice: 2200, fiberMeters: 0 });
  assert.equal(noFiber.fiberCostUnknown, false);
  assert.equal(noFiber.totalCost, 2200);
});

test('break-even months: 900 subsidy over 1000 = 1 month, over 500 = 2 months, unknown monthly = null', () => {
  const base = { connectionFee: 2500, routerPrice: 2200, fiberMeters: 100, fiberPerMeterRate: 12 };
  assert.equal(calculateInstallationCost({ ...base, monthlySellingAmount: 1000 }).breakEvenMonths, 1);
  assert.equal(calculateInstallationCost({ ...base, monthlySellingAmount: 500 }).breakEvenMonths, 2);
  assert.equal(calculateInstallationCost({ ...base, monthlySellingAmount: 901 }).breakEvenMonths, 1);
  assert.equal(calculateInstallationCost(base).breakEvenMonths, null);
  assert.equal(calculateInstallationCost({ ...base, monthlySellingAmount: 0 }).breakEvenMonths, null);
});

test('garbage and negative inputs sanitize to null, never to 0 or an error', () => {
  const result = calculateInstallationCost({
    connectionFee: 'bad', routerPrice: -50, mediaConverterCost: 'nope',
    linemanInstallFee: -1, fiberMeters: -10, fiberPerMeterRate: 'x'
  });
  assert.equal(result.connectionFee, null);
  assert.equal(result.routerPrice, null);
  assert.equal(result.mediaConverterCost, null);
  assert.equal(result.linemanInstallFee, null);
  assert.equal(result.fiberMeters, null);
  assert.equal(result.fiberPerMeterRate, null);
  assert.equal(result.status, 'not-recorded');
  // Fee present but costs garbage: costs count as unrecorded, fee is a surplus.
  const feeOnly = calculateInstallationCost({ connectionFee: 1000, routerPrice: 'bad' });
  assert.equal(feeOnly.totalCost, 0);
  assert.equal(feeOnly.status, 'surplus');
});

test('explicit perMeterRate override wins over the stored rate', () => {
  const result = calculateInstallationCost(
    { connectionFee: 2500, routerPrice: 2200, fiberMeters: 100, fiberPerMeterRate: 10 },
    { perMeterRate: 12 }
  );
  assert.equal(result.fiberPerMeterRate, 12);
  assert.equal(result.totalCost, 3400);
});

test('core wiring: add, edit, normalize and backup merge carry the three new fields', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Install Cost Customer', OCT, {
    connectionFee: 2500, routerPrice: 2200, fiberMeters: 100,
    mediaConverterCost: 800, linemanInstallFee: 500, fiberPerMeterRate: 12
  });
  const added = state.customers[0];
  assert.equal(added.mediaConverterCost, 800);
  assert.equal(added.linemanInstallFee, 500);
  assert.equal(added.fiberPerMeterRate, 12);
  // Old records without the fields load as null, never as invented values.
  const legacy = readState({ getItem: () => JSON.stringify({ ...state, customers: [{ ...added, mediaConverterCost: undefined, linemanInstallFee: undefined, fiberPerMeterRate: undefined }] }), setItem: () => {} });
  assert.equal(legacy.customers[0].mediaConverterCost, null);
  assert.equal(legacy.customers[0].linemanInstallFee, null);
  assert.equal(legacy.customers[0].fiberPerMeterRate, null);
  // Corrupt saved values normalize to null.
  const corrupt = readState({ getItem: () => JSON.stringify({ ...state, customers: [{ ...added, mediaConverterCost: -5, linemanInstallFee: 'bad', fiberPerMeterRate: -2 }] }), setItem: () => {} });
  assert.equal(corrupt.customers[0].mediaConverterCost, null);
  assert.equal(corrupt.customers[0].linemanInstallFee, null);
  assert.equal(corrupt.customers[0].fiberPerMeterRate, null);
  // Edit path updates them.
  state = updateCustomerProfile(state, added.id, { mediaConverterCost: 900, linemanInstallFee: 600, fiberPerMeterRate: 15 }, OCT);
  assert.equal(state.customers[0].mediaConverterCost, 900);
  assert.equal(state.customers[0].linemanInstallFee, 600);
  assert.equal(state.customers[0].fiberPerMeterRate, 15);
  // Backup export + merge carry them to a device whose copy lacks them.
  const backupJson = createJsonBackup(state, new Date('2026-10-18T00:00:00Z'));
  const local = JSON.parse(JSON.stringify(state));
  local.customers[0].mediaConverterCost = null;
  local.customers[0].linemanInstallFee = null;
  local.customers[0].fiberPerMeterRate = null;
  const preview = previewJsonBackupMerge(local, backupJson);
  assert.equal(preview.canApply, true);
  assert.equal(preview.state.customers[0].mediaConverterCost, 900);
  assert.equal(preview.state.customers[0].linemanInstallFee, 600);
  assert.equal(preview.state.customers[0].fiberPerMeterRate, 15);
});
