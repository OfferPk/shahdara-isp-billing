import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validEvidenceDate,
  normalizeDisputeEvidenceList,
  disputeEvidenceSorted,
  evidenceForCase,
  evidenceForType,
  evidenceForCases,
  findDisputeEvidence,
  recordDisputeEvidence,
  removeDisputeEvidence,
  buildDisputeEvidenceSummary,
  disputeEvidenceSummaryText,
  disputeEvidenceNoteText,
  disputeEvidenceEntryHtml,
  disputeEvidenceCsv,
  disputeEvidenceFilename,
} from '../dispute-evidence.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'dispute-evidence.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const base = { id: 'DE-1', caseRef: 'CASE-7', evidenceType: 'receipt', reference: 'R-101', dateChecked: '2026-11-03', finding: 'Receipt matches the bill.' };

test('half-formed evidence note is refused', () => {
  assert.equal(recordDisputeEvidence([], { ...base, caseRef: '' }), null);
  assert.equal(recordDisputeEvidence([], { ...base, reference: '' }), null);
  assert.equal(recordDisputeEvidence([], { ...base, id: '' }), null);
  assert.equal(recordDisputeEvidence([], { ...base, dateChecked: '' }), null);
  assert.equal(recordDisputeEvidence([], { ...base, dateChecked: '2026-02-30' }), null);
  assert.equal(recordDisputeEvidence([], { ...base, dateChecked: '2024-02-29' }) !== null, true);
  assert.equal(recordDisputeEvidence([], { ...base, evidenceType: 'phone-call' }), null);
});

test('strict dates accept leap day only in leap years', () => {
  assert.equal(validEvidenceDate('2024-02-29'), true);
  assert.equal(validEvidenceDate('2026-02-29'), false);
  assert.equal(validEvidenceDate('2026-13-01'), false);
  assert.equal(validEvidenceDate('2026-11-31'), false);
  assert.equal(validEvidenceDate('2026/11/03'), false);
});

test('unknown fields are dropped and inputs are not mutated', () => {
  const raw = { ...base, outcome: 'resolved', amount: 5000 };
  const frozen = JSON.parse(JSON.stringify(raw));
  const list = recordDisputeEvidence([], raw);
  assert.equal(list.length, 1);
  assert.equal('outcome' in list[0], false);
  assert.equal('amount' in list[0], false);
  assert.deepEqual(raw, frozen);
});

test('duplicate ids are never rewritten', () => {
  const first = recordDisputeEvidence([], base);
  const second = recordDisputeEvidence(first, { ...base, finding: 'Different finding.' });
  assert.equal(second, null);
  assert.equal(first[0].finding, 'Receipt matches the bill.');
});

test('find and remove work by id', () => {
  const list = recordDisputeEvidence([], base);
  assert.equal(findDisputeEvidence(list, 'DE-1').reference, 'R-101');
  assert.equal(findDisputeEvidence(list, 'DE-9'), null);
  assert.equal(removeDisputeEvidence(list, 'DE-1').length, 0);
  assert.equal(removeDisputeEvidence(list, 'DE-9').length, 1);
  assert.equal(removeDisputeEvidence(list, '').length, 1);
});

test('notes sort by date, then case, then id', () => {
  const notes = [
    { ...base, id: 'DE-3', caseRef: 'CASE-9', dateChecked: '2026-11-03' },
    { ...base, id: 'DE-2', caseRef: 'CASE-7', dateChecked: '2026-11-01' },
    { ...base, id: 'DE-1', caseRef: 'CASE-7', dateChecked: '2026-11-03' },
  ];
  const sorted = disputeEvidenceSorted(notes);
  assert.deepEqual(sorted.map((note) => note.id), ['DE-2', 'DE-1', 'DE-3']);
});

test('each case lists its own evidence notes', () => {
  const notes = [
    base,
    { ...base, id: 'DE-2', evidenceType: 'slip', reference: 'S-44' },
    { ...base, id: 'DE-3', caseRef: 'CASE-8', evidenceType: 'message', reference: 'M-12' },
  ];
  assert.deepEqual(evidenceForCase(notes, 'CASE-7').map((note) => note.id), ['DE-1', 'DE-2']);
  assert.deepEqual(evidenceForCase(notes, 'CASE-8').map((note) => note.id), ['DE-3']);
  assert.deepEqual(evidenceForCase(notes, ''), []);
});

test('each open case supplied by the caller lists its notes', () => {
  const notes = [base, { ...base, id: 'DE-2', caseRef: 'CASE-8' }];
  const grouped = evidenceForCases(notes, ['CASE-7', 'CASE-8', 'CASE-99']);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[0].notes.length, 1);
  assert.equal(grouped[1].notes.length, 1);
  assert.equal(grouped[2].notes.length, 0);
  assert.deepEqual(evidenceForCases(notes, 'CASE-7'), []);
});

test('type filter accepts only the four plan types', () => {
  const notes = [
    base,
    { ...base, id: 'DE-2', evidenceType: 'ledger_entry', reference: 'L-5' },
    { ...base, id: 'DE-3', evidenceType: 'message', reference: 'M-1' },
  ];
  assert.deepEqual(evidenceForType(notes, 'ledger_entry').map((note) => note.id), ['DE-2']);
  assert.deepEqual(evidenceForType(notes, 'phone-call'), []);
});

test('summary counts notes, cases, and types', () => {
  const notes = [
    base,
    { ...base, id: 'DE-2', evidenceType: 'slip', reference: 'S-1' },
    { ...base, id: 'DE-3', caseRef: 'CASE-8', evidenceType: 'receipt', reference: 'R-2' },
  ];
  const summary = buildDisputeEvidenceSummary(notes);
  assert.equal(summary.total, 3);
  assert.equal(summary.cases, 2);
  assert.equal(summary.byType.receipt, 2);
  assert.equal(summary.byType.slip, 1);
  assert.equal(summary.byType.message, 0);
  assert.equal(disputeEvidenceSummaryText(notes), '3 evidence notes across 2 cases (2 receipt, 1 slip, 0 message, 0 ledger entry).');
});

test('note text carries case, type, reference, date, and finding', () => {
  assert.equal(
    disputeEvidenceNoteText(base),
    'Case CASE-7 — Receipt R-101 checked on 2026-11-03: Receipt matches the bill.',
  );
  assert.equal(
    disputeEvidenceNoteText({ ...base, finding: '' }),
    'Case CASE-7 — Receipt R-101 checked on 2026-11-03: No finding noted.',
  );
  assert.equal(disputeEvidenceNoteText({ ...base, caseRef: '' }), '');
});

test('HTML escapes the finding', () => {
  const html = disputeEvidenceEntryHtml({ ...base, finding: '<b>bold</b> & "quoted"' });
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;'), true);
  assert.equal(html.includes('&amp;'), true);
});

test('CSV and filename', () => {
  const csv = disputeEvidenceCsv([base]);
  assert.equal(csv.split('\n')[0], 'id,caseRef,evidenceType,reference,dateChecked,finding');
  assert.equal(csv.includes('DE-1,CASE-7,receipt,R-101,2026-11-03,Receipt matches the bill.'), true);
  assert.equal(disputeEvidenceFilename(), 'dispute-evidence.csv');
});

test('normalising a list drops bad notes and later duplicates', () => {
  const list = normalizeDisputeEvidenceList([
    base,
    { ...base, caseRef: '' },
    { ...base, finding: 'Second copy.' },
    'not-an-object',
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].finding, 'Receipt matches the bill.');
  assert.deepEqual(normalizeDisputeEvidenceList('nope'), []);
});

test('purity fence: no storage, clock, or network access', () => {
  assert.equal(/localStorage|sessionStorage|new Date\(|Date\.now\(|fetch\(|XMLHttpRequest/.test(moduleSrc), false);
});

test('neighbour-module fence: dispute case modules are neither read nor rewritten', () => {
  assert.equal(/dispute-cases|dispute-followups|dispute-resolutions|dispute-letters|disputed-balance/.test(moduleSrc), false);
  assert.equal(/from '\.\/dispute/.test(moduleSrc), false);
});

test('never-changes fence: no outcome, status, bill, or payment field is held', () => {
  const list = recordDisputeEvidence([], base);
  assert.equal('outcome' in list[0], false);
  assert.equal('status' in list[0], false);
  assert.equal('billTotal' in list[0], false);
  assert.equal('payment' in list[0], false);
});

test('panel ids are present in index.html', () => {
  for (const id of ['deCase', 'deType', 'deReference', 'deDateChecked', 'deFinding', 'deSaveBtn', 'deRemoveId', 'deRemoveBtn', 'deCaseFilter', 'deTypeFilter', 'deBody', 'deSummary', 'deExportBtn']) {
    assert.equal(indexHtml.includes(`id="${id}"`), true, `missing panel id ${id}`);
  }
});

test('app.js wires the dispute evidence panel', () => {
  assert.equal(appJs.includes("from './dispute-evidence.js'"), true);
  assert.equal(appJs.includes('renderDisputeEvidence'), true);
  assert.equal(appJs.includes('shahdara_dispute_evidence_v1'), true);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.equal(/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(appJs), false);
});
