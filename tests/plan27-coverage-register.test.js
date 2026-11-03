import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVERAGE_UNASSIGNED_KEY,
  canonicalCoverageMohalla,
  normalizeCoverageDate,
  normalizeCoverageEstimate,
  normalizeCoverageEstimates,
  findCoverageEstimate,
  upsertCoverageEstimate,
  buildCoverageRegister,
  coverageRegisterSummaryText,
  coverageRegisterHtml,
  coverageRegisterCsv,
  coverageRegisterFilename,
} from '../coverage-register.js';

const customer = (id, mohalla, archived) => ({ id, name: id, mohalla, archived: archived ?? false });
const estimate = (mohalla, premises, date, basis) => ({ mohalla, premises, date, basis });

test('canonical mohalla: Plan T rule mirrored (prefix stripped, aliases collapse, unknown kept)', () => {
  assert.equal(canonicalCoverageMohalla('MOHALLA BANI').key, canonicalCoverageMohalla('Bani').key);
  assert.equal(canonicalCoverageMohalla('BANII').key, canonicalCoverageMohalla('Bani').key);
  assert.equal(canonicalCoverageMohalla('kishti').stored, 'KISHTII');
  assert.equal(canonicalCoverageMohalla('chamyaa').stored, 'CHAMYAAA');
  assert.equal(canonicalCoverageMohalla('  '), null);
  assert.equal(canonicalCoverageMohalla(''), null);
  assert.equal(canonicalCoverageMohalla('New Town').label, 'New Town');
  assert.equal(canonicalCoverageMohalla('New Town').key, 'new town');
});

test('date validation: real dates kept, 2026-02-30 and bad formats rejected', () => {
  assert.equal(normalizeCoverageDate('2026-03-05'), '2026-03-05');
  assert.equal(normalizeCoverageDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeCoverageDate('2026-02-30'), null);
  assert.equal(normalizeCoverageDate('2026-13-01'), null);
  assert.equal(normalizeCoverageDate('05-03-2026'), null);
  assert.equal(normalizeCoverageDate(undefined), null);
  assert.equal(normalizeCoverageDate(''), null);
});

test('estimate normalisation: bad premises rejected, missing date/basis never guessed', () => {
  assert.equal(normalizeCoverageEstimate(null), null);
  assert.equal(normalizeCoverageEstimate(estimate('', 100)), null);
  for (const bad of [0, -5, 12.5, NaN, 'many', undefined]) {
    assert.equal(normalizeCoverageEstimate(estimate('Bani', bad)), null);
  }
  assert.deepEqual(normalizeCoverageEstimate(estimate('Bani', '120', '2026-03-01', ' door count ')), {
    key: 'banii', label: 'Banii', stored: 'BANII', premises: 120, date: '2026-03-01', basis: 'door count', history: [],
  });
  const noDate = normalizeCoverageEstimate(estimate('Bani', 120));
  assert.equal(noDate.date, null);
  assert.equal(noDate.basis, '');
  assert.equal(normalizeCoverageEstimate(estimate('Bani', 120, '2026-02-30')).date, null);
});

test('estimates: last row per mohalla wins, sorted label A–Z, inputs never mutated', () => {
  const input = [estimate('Bani', 100), estimate('bani', 120, '2026-03-01', 'walk'), estimate('Malla', 50)];
  const snapshot = JSON.stringify(input);
  const out = normalizeCoverageEstimates(input);
  assert.deepEqual(out.map((row) => row.label), ['Banii', 'Malla']);
  assert.equal(out[0].premises, 120);
  assert.equal(JSON.stringify(input), snapshot);
});

test('find: canonical match only, blank never matches', () => {
  const list = [estimate('Bani', 100)];
  assert.equal(findCoverageEstimate(list, 'MOHALLA BANI').premises, 100);
  assert.equal(findCoverageEstimate(list, 'Malla'), null);
  assert.equal(findCoverageEstimate(list, ''), null);
});

test('upsert: first save, edit moves old figure to history with date, identical re-save is a no-op', () => {
  const first = upsertCoverageEstimate([], estimate('Bani', 100, '2026-01-10', 'walk'));
  assert.equal(first.length, 1);
  assert.deepEqual(first[0].history, []);
  const edited = upsertCoverageEstimate(first, estimate('bani', 140, '2026-03-01', 'recount'));
  assert.equal(edited.length, 1);
  assert.equal(edited[0].premises, 140);
  assert.deepEqual(edited[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
  const again = upsertCoverageEstimate(edited, estimate('Bani', 140, '2026-03-01', 'recount'));
  assert.deepEqual(again[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
  const rejected = upsertCoverageEstimate(edited, estimate('Bani', 0));
  assert.equal(rejected[0].premises, 140);
  assert.equal(JSON.stringify(first), JSON.stringify(upsertCoverageEstimate([], estimate('Bani', 100, '2026-01-10', 'walk'))));
});

test('register: take-up computes exactly from recorded figures on the same fixture', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani'), customer('c3', 'Malla')],
    estimates: [estimate('Bani', 100, '2026-03-01', 'walk'), estimate('Malla', 40)],
  });
  const bani = reg.rows.find((row) => row.key === 'banii');
  assert.equal(bani.activeCount, 2);
  assert.equal(bani.takeUpPercent, 2);
  assert.equal(bani.remainingPremises, 98);
  const malla = reg.rows.find((row) => row.key === 'malla');
  assert.equal(malla.takeUpPercent, 2.5);
  assert.equal(reg.totalActive, 3);
  assert.equal(reg.totalPremises, 140);
  assert.equal(reg.overallTakeUpPercent, 2.1);
});

test('register: unsurveyed mohalla shows not surveyed, never zero take-up', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani')],
    estimates: [],
  });
  const row = reg.rows[0];
  assert.equal(row.surveyed, false);
  assert.equal(row.premises, null);
  assert.equal(row.takeUpPercent, null);
  assert.equal(row.remainingPremises, null);
  assert.equal(reg.overallTakeUpPercent, null);
  assert.equal(reg.notSurveyedCount, 1);
});

test('register: surveyed mohalla with no customers still appears at 0% take-up', () => {
  const reg = buildCoverageRegister({
    customers: [],
    estimates: [estimate('Bani', 80, '2026-02-01', 'walk')],
  });
  assert.equal(reg.rows.length, 1);
  assert.equal(reg.rows[0].activeCount, 0);
  assert.equal(reg.rows[0].takeUpPercent, 0);
  assert.equal(reg.rows[0].remainingPremises, 80);
});

test('register: archived customers excluded, blank-mohalla customers kept in Unassigned, never dropped', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani', true), customer('c3', ''), customer('c4', null)],
    estimates: [estimate('Bani', 100)],
  });
  assert.equal(reg.totalActive, 3);
  const unassigned = reg.rows.find((row) => row.key === COVERAGE_UNASSIGNED_KEY);
  assert.equal(unassigned.activeCount, 2);
  assert.equal(unassigned.label, 'Unassigned');
  assert.equal(reg.rows[reg.rows.length - 1].key, COVERAGE_UNASSIGNED_KEY);
});

test('register: area field counts when mohalla blank, canonical grouping merges spellings', () => {
  const reg = buildCoverageRegister({
    customers: [{ id: 'c1', name: 'A', area: 'MOHALLA BANI' }, { id: 'c2', name: 'B', mohalla: 'Bani' }],
    estimates: [estimate('Bani', 200)],
  });
  assert.equal(reg.rows.length, 1);
  assert.equal(reg.rows[0].activeCount, 2);
});

test('register: active count above the estimate gives a negative remaining figure, honestly', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Bani'), customer('c3', 'Bani')],
    estimates: [estimate('Bani', 2)],
  });
  assert.equal(reg.rows[0].remainingPremises, -1);
  assert.equal(reg.rows[0].takeUpPercent, 150);
});

test('summary text: surveyed/not-surveyed counts and overall take-up', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', 'Malla')],
    estimates: [estimate('Bani', 100)],
  });
  assert.match(coverageRegisterSummaryText(reg), /2 mohallas/);
  assert.match(coverageRegisterSummaryText(reg), /1 surveyed, 1 not surveyed/);
  assert.match(coverageRegisterSummaryText(reg), /overall take-up 1%/);
  assert.equal(coverageRegisterSummaryText({ rows: [] }), 'No mohallas recorded yet.');
});

test('HTML: escaping, not-surveyed wording, history shown', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani'), customer('c2', '<b>Malla</b>')],
    estimates: [estimate('Bani', 100, '2026-03-01', 'walk')],
  });
  const edited = buildCoverageRegister({
    customers: [customer('c1', 'Bani')],
    estimates: upsertCoverageEstimate([estimate('Bani', 100, '2026-01-10', 'walk')], estimate('Bani', 140, '2026-03-01', 'recount')),
  });
  const html = coverageRegisterHtml(reg);
  assert.match(html, /Not surveyed/);
  assert.doesNotMatch(html, /<b>Malla<\/b>/);
  assert.match(coverageRegisterHtml(edited), /100 \(2026-01-10, walk\)/);
  assert.match(coverageRegisterHtml({ rows: [] }), /No mohallas recorded yet/);
});

test('CSV: header, rows, quoting, filename', () => {
  const reg = buildCoverageRegister({
    customers: [customer('c1', 'Bani')],
    estimates: [estimate('Bani', 100, '2026-03-01', 'walk, count')],
  });
  const csv = coverageRegisterCsv(reg);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Mohalla,Active customers,Premises passed,Take-up (%),Remaining premises,Survey date,Basis,Previous estimates');
  assert.match(lines[1], /"walk, count"/);
  assert.equal(coverageRegisterFilename(), 'mohalla-coverage-register.csv');
});
