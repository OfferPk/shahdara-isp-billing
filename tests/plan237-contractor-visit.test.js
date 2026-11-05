import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validContractorVisitDate,
  normalizeContractorVisitList,
  recordContractorVisit,
  removeContractorVisit,
  findContractorVisit,
  contractorVisitsSorted,
  contractorVisitsForContractor,
  contractorVisitsOnDate,
  contractorVisitContractors,
  addContractorVisitCorrection,
  contractorVisitSummaryText,
  contractorVisitText,
  contractorVisitHtml,
  contractorVisitCsv,
  contractorVisitFilename,
} from '../contractor-visit.js';
import fs from 'node:fs';

const visitA = { id: 'c1', contractor: 'Ali Technicians', date: '2026-07-12', job: 'Splice repair', customer: 'Ahmed', segment: '', workDone: 'Re-spliced the drop cable joint', chargeCents: 150000 };
const visitB = { id: 'c2', contractor: 'Bilal Services', date: '2026-07-12', job: 'Pole replacement', customer: '', segment: 'Mohalla A trunk', workDone: 'Replaced a leaning pole', charge: 5000 };
const visitC = { id: 'c3', contractor: 'ali technicians', date: '2026-08-01', job: 'OTDR testing', customer: 'Fatima', segment: 'Mohalla B', workDone: 'Tested the segment and reported loss', chargeCents: null };

test('half-formed visits are refused', () => {
  assert.equal(recordContractorVisit([], { contractor: 'X', date: '2026-07-12', job: 'J', customer: 'C', workDone: 'W' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', date: '2026-07-12', job: 'J', customer: 'C', workDone: 'W' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', contractor: 'X', job: 'J', customer: 'C', workDone: 'W' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', contractor: 'X', date: '2026-07-12', customer: 'C', workDone: 'W' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', contractor: 'X', date: '2026-07-12', job: 'J', workDone: 'W' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', contractor: 'X', date: '2026-07-12', job: 'J', customer: 'C' }).length, 0);
  assert.equal(recordContractorVisit([], { id: 'x', contractor: 'X', date: '2026-07-12', job: 'J', customer: '', segment: '', workDone: 'W' }).length, 0);
});

test('strict dates: leap day accepted, impossible dates refused', () => {
  assert.equal(validContractorVisitDate('2024-02-29'), true);
  assert.equal(validContractorVisitDate('2026-02-29'), false);
  assert.equal(validContractorVisitDate('2026-02-30'), false);
  assert.equal(validContractorVisitDate('2026-13-01'), false);
  assert.equal(validContractorVisitDate('2026-10-3'), false);
  assert.equal(validContractorVisitDate('2026-08-31'), true);
  assert.equal(validContractorVisitDate('2026-04-31'), false);
});

test('unknown fields are dropped and inputs are not mutated', () => {
  const raw = { ...visitA, surprise: 'extra', chargeCents: 150000 };
  const list = recordContractorVisit([], raw);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.equal('surprise' in raw, true);
  const before = JSON.stringify(raw);
  normalizeContractorVisitList([raw]);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordContractorVisit([visitA], { ...visitA, job: 'Different job' });
  assert.equal(list.length, 1);
  assert.equal(list[0].job, 'Splice repair');
});

test('find and remove', () => {
  const list = [visitA, visitB];
  assert.equal(findContractorVisit(list, 'c2').job, 'Pole replacement');
  assert.equal(findContractorVisit(list, 'nope'), null);
  assert.equal(removeContractorVisit(list, 'c1').length, 1);
  assert.equal(removeContractorVisit(list, '').length, 2);
});

test('visits sort by date, then contractor, then id', () => {
  const sorted = contractorVisitsSorted([visitC, visitB, visitA]);
  assert.deepEqual(sorted.map((item) => item.id), ['c1', 'c2', 'c3']);
});

test('list by contractor is case-insensitive substring', () => {
  const list = [visitA, visitB, visitC];
  assert.deepEqual(contractorVisitsForContractor(list, 'ali').map((item) => item.id), ['c1', 'c3']);
  assert.deepEqual(contractorVisitsForContractor(list, '').map((item) => item.id), ['c1', 'c2', 'c3']);
});

test('list by date is exact, bad dates give nothing', () => {
  const list = [visitA, visitB, visitC];
  assert.deepEqual(contractorVisitsOnDate(list, '2026-07-12').map((item) => item.id), ['c1', 'c2']);
  assert.deepEqual(contractorVisitsOnDate(list, '2026-02-30'), []);
  assert.deepEqual(contractorVisitsOnDate(list, '2026-07-13'), []);
});

test('contractor list is unique and case-insensitive', () => {
  assert.deepEqual(contractorVisitContractors([visitA, visitB, visitC]), ['Ali Technicians', 'Bilal Services']);
});

test('each visit names its job and its customer or segment', () => {
  assert.match(contractorVisitText(visitA), /job Splice repair for customer Ahmed/);
  assert.match(contractorVisitText(visitB), /job Pole replacement for segment Mohalla A trunk/);
  assert.match(contractorVisitText(visitC), /job OTDR testing for customer Fatima, segment Mohalla B/);
});

test('charge shown in rupees once, missing charge said plainly', () => {
  assert.match(contractorVisitText(visitA), /Charge Rs\. 1500\.00/);
  assert.match(contractorVisitText(visitB), /Charge Rs\. 5000\.00/);
  assert.match(contractorVisitText(visitC), /No charge noted\./);
  const again = normalizeContractorVisitList([visitB]);
  assert.equal(again[0].chargeCents, 500000);
});

test('correction only, never a silent edit', () => {
  const list = [visitA];
  const corrected = addContractorVisitCorrection(list, 'c1', '2026-07-13', 'Charge corrected after invoice check');
  assert.equal(corrected[0].job, 'Splice repair');
  assert.equal(corrected[0].chargeCents, 150000);
  assert.equal(corrected[0].corrections.length, 1);
  assert.match(contractorVisitText(corrected[0]), /Corrections: 2026-07-13: Charge corrected after invoice check/);
  assert.deepEqual(addContractorVisitCorrection(list, 'c1', '2026-02-30', 'Bad date'), normalizeContractorVisitList(list));
  assert.deepEqual(addContractorVisitCorrection(list, 'c1', '2026-07-13', ''), normalizeContractorVisitList(list));
  assert.deepEqual(addContractorVisitCorrection(list, 'nope', '2026-07-13', 'Unknown'), normalizeContractorVisitList(list));
});

test('summary text counts visits and contractors', () => {
  assert.equal(contractorVisitSummaryText([visitA, visitB, visitC]), '3 contractor visits from 2 contractors.');
  assert.equal(contractorVisitSummaryText([visitA]), '1 contractor visit from 1 contractor.');
  assert.equal(contractorVisitSummaryText([]), '0 contractor visits from 0 contractors.');
});

test('HTML escapes user text', () => {
  const html = contractorVisitHtml({ ...visitA, workDone: '<b>bold</b> & "quoted"' });
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
});

test('CSV rows and filename', () => {
  const csv = contractorVisitCsv([visitB, visitA]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","contractor","date","job","customer","segment","work done","charge Rs","corrections"');
  assert.match(lines[1], /"c1","Ali Technicians","2026-07-12"/);
  assert.equal(contractorVisitFilename(), 'contractor-visits.csv');
});

test('list normalisation drops bad rows and duplicate ids', () => {
  const list = normalizeContractorVisitList([visitA, { id: 'bad' }, visitA, visitB]);
  assert.deepEqual(list.map((item) => item.id), ['c1', 'c2']);
  assert.deepEqual(normalizeContractorVisitList('not a list'), []);
});

test('module is pure: no clock, storage, or network', () => {
  const source = fs.readFileSync(new URL('../contractor-visit.js', import.meta.url), 'utf8');
  assert.equal(/new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(source), false);
});

test('neighbour modules are neither read nor rewritten', () => {
  const source = fs.readFileSync(new URL('../contractor-visit.js', import.meta.url), 'utf8');
  assert.equal(/from '\.\/(safety-note|oncall-rota|handover|staff-handover)\.js'/.test(source), false);
  assert.equal(/import /.test(source), false);
});

test('panel ids are present in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['cvSaveBtn', 'cvRemoveBtn', 'cvFilter', 'cvDateBtn', 'cvCorrectBtn', 'cvExportBtn', 'cvBody', 'cvSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the contractor visit panel', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(source.includes("from './contractor-visit.js'"));
  assert.ok(source.includes('renderContractorVisits()'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source), false);
});
