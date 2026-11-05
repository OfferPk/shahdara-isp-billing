import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validComplaintReopenDate,
  normalizeComplaintReopenList,
  recordComplaintReopen,
  removeComplaintReopen,
  findComplaintReopen,
  addComplaintReopenNote,
  complaintReopenSorted,
  reopenNotesForComplaint,
  complaintReopenComplaints,
  complaintReopenSummaryText,
  complaintReopenText,
  complaintReopenHtml,
  complaintReopenAllHtml,
  complaintReopenCsv,
  complaintReopenFilename,
} from '../complaint-reopen.js';

const first = { id: 'CR-1', complaintRef: 'C-101', reopenDate: '2026-11-10', reason: 'The line went down again.', previousOutcome: 'Line replaced, customer confirmed working.' };
const second = { id: 'CR-2', complaintRef: 'C-102', reopenDate: '2026-11-08', reason: 'Bill still shows the old amount.', previousOutcome: 'Bill corrected once.', followups: [{ date: '2026-11-09', note: 'Customer called again.' }] };
const third = { id: 'CR-3', complaintRef: 'C-101', reopenDate: '2026-11-12', reason: 'Same fault came back a third time.', previousOutcome: 'Second visit done.' };

test('half-formed reopen notes are refused', () => {
  assert.deepEqual(recordComplaintReopen([], { id: '', complaintRef: 'C-101', reopenDate: '2026-11-10', reason: 'Down again.' }), []);
  assert.deepEqual(recordComplaintReopen([], { id: 'CR-1', complaintRef: '', reopenDate: '2026-11-10', reason: 'Down again.' }), []);
  assert.deepEqual(recordComplaintReopen([], { id: 'CR-1', complaintRef: 'C-101', reopenDate: '2026-11-10', reason: '' }), []);
  assert.deepEqual(recordComplaintReopen([], { id: 'CR-1', complaintRef: 'C-101', reopenDate: '2026-11-10', reason: '   ' }), []);
  assert.deepEqual(recordComplaintReopen([], { id: 'CR-1', complaintRef: 'C-101', reopenDate: 'not-a-date', reason: 'Down again.' }), []);
  assert.deepEqual(recordComplaintReopen([], { id: 'CR-1', complaintRef: 'C-101', reason: 'Down again.' }), []);
  assert.equal(recordComplaintReopen([], first).length, 1);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validComplaintReopenDate('2026-01-31'), true);
  assert.equal(validComplaintReopenDate('2026-04-31'), false);
  assert.equal(validComplaintReopenDate('2026-02-29'), false);
  assert.equal(validComplaintReopenDate('2024-02-29'), true);
  assert.equal(validComplaintReopenDate('2026-11-10'), true);
  assert.equal(validComplaintReopenDate('2026-13-01'), false);
  assert.equal(validComplaintReopenDate('2026-11-00'), false);
  assert.equal(validComplaintReopenDate('10-11-2026'), false);
  assert.equal(validComplaintReopenDate(''), false);
  assert.equal(validComplaintReopenDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, complaintStatus: 'open', billAmount: 1500, extra: 'x' };
  const before = JSON.stringify(raw);
  const recorded = recordComplaintReopen([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('complaintStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('extra' in recorded[0], false);
  assert.equal(JSON.stringify(raw), before);
  const list = [first];
  const listBefore = JSON.stringify(list);
  recordComplaintReopen(list, second);
  assert.equal(JSON.stringify(list), listBefore);
});

test('duplicate ids are never rewritten', () => {
  const changed = { ...second, id: 'CR-1', reason: 'Different reason.' };
  const out = recordComplaintReopen([first], changed);
  assert.equal(out.length, 1);
  assert.equal(out[0].reason, first.reason);
});

test('one complaint may reopen more than once', () => {
  const out = recordComplaintReopen(recordComplaintReopen([], first), third);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((item) => item.id), ['CR-1', 'CR-3']);
});

test('find and remove work by id', () => {
  const list = [first, second];
  assert.equal(findComplaintReopen(list, 'CR-2').complaintRef, 'C-102');
  assert.equal(findComplaintReopen(list, 'CR-9'), null);
  assert.equal(findComplaintReopen(list, ''), null);
  assert.deepEqual(removeComplaintReopen(list, 'CR-1').map((item) => item.id), ['CR-2']);
  assert.equal(removeComplaintReopen(list, 'CR-9').length, 2);
});

test('sorting is by reopen date, then complaint, then id', () => {
  const out = complaintReopenSorted([third, first, second]);
  assert.deepEqual(out.map((item) => item.id), ['CR-2', 'CR-1', 'CR-3']);
});

test('reopen notes for one complaint are in date order and case-insensitive', () => {
  const out = reopenNotesForComplaint([third, first, second], 'c-101');
  assert.deepEqual(out.map((item) => item.id), ['CR-1', 'CR-3']);
  assert.deepEqual(reopenNotesForComplaint([first], ''), []);
  assert.deepEqual(reopenNotesForComplaint([first], 'C-999'), []);
});

test('reopened complaints list keeps the first spelling', () => {
  const lower = { ...third, id: 'CR-4', complaintRef: 'c-101', reopenDate: '2026-11-13', reason: 'Again.' };
  assert.deepEqual(complaintReopenComplaints([second, first, lower]), ['C-102', 'C-101']);
});

test('dated follow-up notes never rewrite the record', () => {
  const list = [first];
  const noted = addComplaintReopenNote(list, 'CR-1', '2026-11-11', 'Visited, line stable for now.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].complaintRef, 'C-101');
  assert.equal(noted[0].reopenDate, '2026-11-10');
  assert.equal(noted[0].reason, first.reason);
  assert.equal(noted[0].previousOutcome, first.previousOutcome);
  const unchanged = [{ ...first, followups: [] }];
  assert.deepEqual(addComplaintReopenNote(list, 'CR-1', 'bad-date', 'Nope'), unchanged);
  assert.deepEqual(addComplaintReopenNote(list, 'CR-1', '2026-11-11', ''), unchanged);
  assert.deepEqual(addComplaintReopenNote(list, 'CR-9', '2026-11-11', 'Nope'), unchanged);
});

test('summary and entry text name the reason and previous outcome plainly', () => {
  assert.equal(complaintReopenSummaryText([]), 'No complaint reopen notes recorded.');
  assert.equal(complaintReopenSummaryText([first, second]), '2 complaint reopen notes across 2 complaints.');
  assert.equal(complaintReopenSummaryText([first, third]), '2 complaint reopen notes across 1 complaint.');
  const text = complaintReopenText(first);
  assert.equal(text.includes('C-101'), true);
  assert.equal(text.includes('2026-11-10'), true);
  assert.equal(text.includes('The line went down again'), true);
  assert.equal(text.includes('Line replaced, customer confirmed working'), true);
  assert.equal(complaintReopenText(null), 'No complaint reopen note recorded.');
  assert.equal(complaintReopenText({ ...first, previousOutcome: '' }).includes('Previous outcome'), false);
});

test('html escapes input', () => {
  const evil = { ...first, reason: '<script>alert(1)</script>' };
  const html = complaintReopenHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(complaintReopenHtml(null), '<p>No complaint reopen note recorded.</p>');
  assert.equal(complaintReopenAllHtml([]), '<p>No complaint reopen notes recorded.</p>');
  assert.equal(complaintReopenAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = complaintReopenCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","complaint reference","reopen date","reason","previous outcome","follow-ups"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('CR-2'), true);
  assert.equal(lines[1].includes('2026-11-09: Customer called again.'), true);
  assert.equal(complaintReopenFilename(), 'complaint-reopen-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'CR-9', complaintRef: '', reopenDate: '2026-11-10', reason: 'No link.' };
  const out = normalizeComplaintReopenList([bad, first, { ...first, reason: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['CR-1', 'CR-2']);
  assert.equal(out[0].reason, first.reason);
  assert.deepEqual(normalizeComplaintReopenList('nope'), []);
  assert.deepEqual(normalizeComplaintReopenList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../complaint-reopen.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the closure note and the reopen window rule are untouched', () => {
  const source = readFileSync(new URL('../complaint-reopen.js', import.meta.url), 'utf8');
  assert.equal(source.includes('resolution-confirmation'), false, 'module must not reference the reopen window rule module');
  assert.equal(source.includes('satisfaction'), false, 'module must not reference the closure note module');
  assert.equal(source.includes('complaint-followup'), false, 'module must not reference the follow-up after closure module');
  assert.equal(existsSync(new URL('../resolution-confirmation.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../satisfaction.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../complaint-followup.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'crHeading', 'crSummary', 'crList', 'crExportBtn',
    'crComplaintRef', 'crReopenDate', 'crReason', 'crPreviousOutcome', 'crRecordBtn',
    'crAnnotateId', 'crAnnotateDate', 'crAnnotateNote', 'crAnnotateBtn',
    'crRemoveId', 'crRemoveBtn',
    'crFilterComplaint', 'crFilterBtn', 'crFilterBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the complaint reopen panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './complaint-reopen.js'"), true);
  assert.equal(source.includes('renderComplaintReopens()'), true);
  assert.equal(source.includes('COMPLAINT_REOPEN_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
