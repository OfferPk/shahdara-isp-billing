import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validTargetMonth,
  normalizeMohallaCollectionTargetList,
  mohallaCollectionTargetsSorted,
  findMohallaCollectionTarget,
  recordMohallaCollectionTarget,
  removeMohallaCollectionTarget,
  targetsForMonth,
  targetsForMohalla,
  targetDifferenceCents,
  targetStatus,
  businessTargetCents,
  businessActualCents,
  businessDifferenceCents,
  missingTargetMohallas,
  missingTargetText,
  checkActualAgainstLedger,
  mohallaCollectionTargetText,
  mohallaCollectionTargetHtml,
  mohallaCollectionTargetAllHtml,
  mohallaCollectionTargetSummaryText,
  mohallaCollectionTargetCsv,
  mohallaCollectionTargetFilename,
} from '../mohalla-collection-target.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'mohalla-collection-target.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const base = { id: 'MCT-1', mohalla: 'Shahdara', month: '2026-10', targetCents: 100000, actualCents: 90000 };

test('half-formed target is refused', () => {
  assert.equal(recordMohallaCollectionTarget([], { ...base, mohalla: '' }), null);
  assert.equal(recordMohallaCollectionTarget([], { ...base, month: '' }), null);
  assert.equal(recordMohallaCollectionTarget([], { ...base, targetCents: undefined, target: undefined }), null);
  assert.equal(recordMohallaCollectionTarget([], { id: '' }), null);
});

test('strict months: bad month refused, valid month accepted', () => {
  assert.equal(validTargetMonth('2026-13'), false);
  assert.equal(validTargetMonth('2026-00'), false);
  assert.equal(validTargetMonth('2026-10'), true);
  assert.equal(validTargetMonth('2026-1'), false);
  assert.equal(recordMohallaCollectionTarget([], { ...base, month: '2026-13' }), null);
  assert.notEqual(recordMohallaCollectionTarget([], { ...base, month: '2026-10' }), null);
});

test('unknown fields dropped and inputs never mutated', () => {
  const input = { ...base, penalty: 5000, ledgerId: 'L-9' };
  const frozen = JSON.parse(JSON.stringify(input));
  const next = recordMohallaCollectionTarget([], input);
  assert.deepEqual(next, [base]);
  assert.deepEqual(input, frozen);
});

test('duplicate id and duplicate mohalla-month never rewritten', () => {
  const first = recordMohallaCollectionTarget([], base);
  assert.equal(recordMohallaCollectionTarget(first, { ...base, targetCents: 200000 }), null);
  assert.equal(recordMohallaCollectionTarget(first, { id: 'MCT-2', mohalla: 'shahdara', month: '2026-10', targetCents: 200000 }), null);
  assert.deepEqual(first, [base]);
});

test('find and remove', () => {
  const list = recordMohallaCollectionTarget([], base);
  assert.deepEqual(findMohallaCollectionTarget(list, 'MCT-1'), base);
  assert.equal(findMohallaCollectionTarget(list, 'MCT-9'), null);
  assert.deepEqual(removeMohallaCollectionTarget(list, 'MCT-1'), []);
  assert.deepEqual(removeMohallaCollectionTarget(list, ''), [base]);
});

test('sorting by mohalla A-Z then month', () => {
  const list = normalizeMohallaCollectionTargetList([
    { id: 'B', mohalla: 'Ziarat', month: '2026-10', targetCents: 1000 },
    { id: 'A', mohalla: 'Shahdara', month: '2026-11', targetCents: 1000 },
    { id: 'C', mohalla: 'Shahdara', month: '2026-10', targetCents: 1000 },
  ]);
  assert.deepEqual(mohallaCollectionTargetsSorted(list).map((row) => row.id), ['C', 'A', 'B']);
});

test('month and mohalla filters', () => {
  const list = normalizeMohallaCollectionTargetList([
    base,
    { id: 'MCT-2', mohalla: 'Shahdara', month: '2026-11', targetCents: 1000 },
    { id: 'MCT-3', mohalla: 'Ziarat', month: '2026-10', targetCents: 1000 },
  ]);
  assert.deepEqual(targetsForMonth(list, '2026-10').map((row) => row.id), ['MCT-1', 'MCT-3']);
  assert.deepEqual(targetsForMonth(list, '2026-13'), []);
  assert.deepEqual(targetsForMohalla(list, 'shah').map((row) => row.id), ['MCT-1', 'MCT-2']);
});

test('difference and status: hit at equality, missed below', () => {
  assert.equal(targetDifferenceCents(base), -10000);
  assert.equal(targetStatus(base), 'missed');
  assert.equal(targetStatus({ ...base, actualCents: 100000 }), 'hit');
  assert.equal(targetStatus({ ...base, actualCents: 120000 }), 'hit');
  assert.equal(targetDifferenceCents({ ...base, actualCents: 120000 }), 20000);
});

test('business totals sum exactly for the month', () => {
  const list = normalizeMohallaCollectionTargetList([
    base,
    { id: 'MCT-2', mohalla: 'Ziarat', month: '2026-10', targetCents: 50000, actualCents: 60000 },
    { id: 'MCT-3', mohalla: 'Ziarat', month: '2026-11', targetCents: 999999 },
  ]);
  assert.equal(businessTargetCents(list, '2026-10'), 150000);
  assert.equal(businessActualCents(list, '2026-10'), 150000);
  assert.equal(businessDifferenceCents(list, '2026-10'), 0);
});

test('mohalla with no target says so plainly', () => {
  const list = normalizeMohallaCollectionTargetList([base]);
  assert.deepEqual(missingTargetMohallas(['Shahdara', 'Ziarat', 'Mohalla 3'], list, '2026-10'), ['Ziarat', 'Mohalla 3']);
  assert.equal(missingTargetText(['Shahdara', 'Ziarat'], list, '2026-10'), 'No target set for Ziarat.');
  assert.equal(missingTargetText(['Shahdara'], list, '2026-10'), 'Every listed mohalla has a target for this month.');
});

test('actual matches ledger collections on the same fixture', () => {
  const list = normalizeMohallaCollectionTargetList([
    base,
    { id: 'MCT-2', mohalla: 'Ziarat', month: '2026-10', targetCents: 50000, actualCents: 60000 },
  ]);
  const ledger = [
    { mohalla: 'Shahdara', month: '2026-10', amountCents: 90000 },
    { mohalla: 'Ziarat', month: '2026-10', amountCents: 40000 },
    { mohalla: 'Ziarat', month: '2026-10', amountCents: 10000 },
  ];
  const check = checkActualAgainstLedger(list, ledger, '2026-10');
  assert.equal(check.matched.length, 1);
  assert.equal(check.mismatched.length, 1);
  assert.equal(check.mismatched[0].mohalla, 'Ziarat');
  assert.equal(check.mismatched[0].differenceCents, 10000);
  const badLedger = checkActualAgainstLedger(list, [{ mohalla: 'Shahdara', month: '2026-10', amountCents: 50000 }], '2026-10');
  assert.equal(badLedger.mismatched.length, 2);
});

test('plain rupees convert once, cents pass through, no hundredfold inflation', () => {
  const fromRupees = recordMohallaCollectionTarget([], { id: 'R-1', mohalla: 'Shahdara', month: '2026-10', target: 1000, actual: 900 });
  assert.equal(fromRupees[0].targetCents, 100000);
  assert.equal(fromRupees[0].actualCents, 90000);
  const reRead = normalizeMohallaCollectionTargetList(fromRupees);
  assert.equal(reRead[0].targetCents, 100000);
});

test('summary text, note text, HTML escaping', () => {
  const list = normalizeMohallaCollectionTargetList([
    base,
    { id: 'MCT-2', mohalla: 'Ziarat', month: '2026-10', targetCents: 50000, actualCents: 60000 },
  ]);
  assert.match(mohallaCollectionTargetSummaryText(list, '2026-10'), /2 mohalla target\(s\) for 2026-10/);
  assert.match(mohallaCollectionTargetSummaryText(list, '2026-10'), /1 hit, 1 missed/);
  assert.match(mohallaCollectionTargetText(base), /target missed/);
  const evil = { ...base, mohalla: '<script>alert(1)</script>' };
  assert.doesNotMatch(mohallaCollectionTargetHtml(evil), /<script>/);
  assert.match(mohallaCollectionTargetAllHtml([]), /No mohalla collection targets recorded/);
});

test('CSV and filename', () => {
  const list = normalizeMohallaCollectionTargetList([base]);
  const csv = mohallaCollectionTargetCsv(list);
  assert.match(csv, /^id,mohalla,month,target_cents,actual_cents,difference_cents,status\n/);
  assert.match(csv, /MCT-1,Shahdara,2026-10,100000,90000,-10000,missed/);
  assert.equal(mohallaCollectionTargetFilename(), 'mohalla-collection-targets.csv');
});

test('purity fence: no clock, storage, or network access', () => {
  assert.doesNotMatch(moduleSrc, /new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});

test('neighbour-module fence: day and dashboard targets untouched', () => {
  assert.doesNotMatch(moduleSrc, /from '\.\/(day-target|dashboard-collection-target)/);
  assert.doesNotMatch(moduleSrc, /DAY_TARGET_STORAGE_KEY|renderCollectionTargetGaugeSvg|buildMonthlyClosingSnapshot/);
  assert.doesNotMatch(moduleSrc, /import\s/);
});

test('panel ids present in index.html', () => {
  for (const id of ['mctHeading', 'mctSummary', 'mctExportBtn', 'mctMohalla', 'mctMonth', 'mctTarget', 'mctActual', 'mctSaveBtn', 'mctRemoveId', 'mctRemoveBtn', 'mctMonthFilter', 'mctKnownMohallas', 'mctBody', 'mctMissingBody', 'mctCheckMonth', 'mctLedger', 'mctCheckBtn', 'mctCheckBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring present', () => {
  assert.ok(appJs.includes("from './mohalla-collection-target.js'"));
  assert.ok(appJs.includes('renderMohallaCollectionTargets()'));
  assert.ok(appJs.includes('MOHALLA_COLLECTION_TARGET_KEY'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const matches = appJs.match(/\bOLT\b/g) || [];
  assert.equal(matches.length, 0);
});
