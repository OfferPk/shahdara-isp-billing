import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validComplaintFollowupDate,
  normalizeComplaintFollowupList,
  recordComplaintFollowup,
  removeComplaintFollowup,
  findComplaintFollowup,
  addComplaintFollowupNote,
  completeComplaintFollowup,
  complaintFollowupSorted,
  followupsForComplaint,
  complaintFollowupComplaints,
  complaintFollowupDue,
  openComplaintFollowups,
  complaintFollowupSummaryText,
  complaintFollowupText,
  complaintFollowupHtml,
  complaintFollowupAllHtml,
  complaintFollowupCsv,
  complaintFollowupFilename,
} from '../complaint-followup.js';

const first = { id: 'CF-1', complaintRef: 'C-101', dueDate: '2026-11-10', stillSatisfied: null, note: 'Check the line is still working.' };
const second = { id: 'CF-2', complaintRef: 'C-102', dueDate: '2026-11-08', stillSatisfied: true, note: 'Customer happy after the fix.', followups: [{ date: '2026-11-08', note: 'Called, still satisfied.' }] };
const third = { id: 'CF-3', complaintRef: 'C-103', dueDate: '2026-11-09', stillSatisfied: false, note: 'Fix failed again.', followups: [{ date: '2026-11-09', note: 'Customer says the fault came back.' }] };

test('half-formed follow-ups are refused', () => {
  assert.deepEqual(recordComplaintFollowup([], { ...first, id: '' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, complaintRef: '  ' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, dueDate: '' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, note: '' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, stillSatisfied: 'maybe' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, stillSatisfied: 'perhaps' }), []);
  const recorded = recordComplaintFollowup([], { ...first, stillSatisfied: 'yes' });
  assert.equal(recorded[0].stillSatisfied, true);
  const recordedNo = recordComplaintFollowup([], { ...first, id: 'CF-9', stillSatisfied: 'NO' });
  assert.equal(recordedNo[0].stillSatisfied, false);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validComplaintFollowupDate('2026-08-31'), true);
  assert.equal(validComplaintFollowupDate('2026-10-31'), true);
  assert.equal(validComplaintFollowupDate('2026-12-31'), true);
  assert.equal(validComplaintFollowupDate('2026-02-29'), false);
  assert.equal(validComplaintFollowupDate('2028-02-29'), true);
  assert.equal(validComplaintFollowupDate('2026-04-31'), false);
  assert.equal(validComplaintFollowupDate('2026-13-01'), false);
  assert.equal(validComplaintFollowupDate('10-11-2026'), false);
  assert.equal(validComplaintFollowupDate(''), false);
  assert.equal(validComplaintFollowupDate(null), false);
  assert.deepEqual(recordComplaintFollowup([], { ...first, dueDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, complaintStatus: 'reopened', billAmount: 500, surprise: 'x' };
  const recorded = recordComplaintFollowup([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('complaintStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.complaintStatus, 'reopened');
  assert.deepEqual(Object.keys(recorded[0]).sort(), ['complaintRef', 'dueDate', 'followups', 'id', 'note', 'stillSatisfied']);
});

test('duplicate ids and duplicate complaints are never rewritten', () => {
  const list = recordComplaintFollowup([], first);
  assert.deepEqual(recordComplaintFollowup(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordComplaintFollowup(list, { id: 'CF-9', complaintRef: 'c-101', dueDate: '2026-11-12', note: 'Second check.' }), list);
  const done = recordComplaintFollowup([], second);
  assert.deepEqual(recordComplaintFollowup(done, { id: 'CF-8', complaintRef: 'C-102', dueDate: '2026-11-20', note: 'Another.' }), done);
});

test('find and remove work by id', () => {
  const list = [first, second].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.equal(findComplaintFollowup(list, 'CF-2').complaintRef, 'C-102');
  assert.equal(findComplaintFollowup(list, 'CF-9'), null);
  assert.equal(findComplaintFollowup(list, ''), null);
  assert.deepEqual(removeComplaintFollowup(list, 'CF-1').map((item) => item.id), ['CF-2']);
  assert.deepEqual(removeComplaintFollowup(list, 'CF-9'), list);
});

test('sorting is by due date, then complaint, then id', () => {
  const list = [first, second, third].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.deepEqual(complaintFollowupSorted(list).map((item) => item.id), ['CF-2', 'CF-3', 'CF-1']);
});

test('follow-ups for one complaint are case-insensitive', () => {
  const list = [first, second, third].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.deepEqual(followupsForComplaint(list, 'c-101').map((item) => item.id), ['CF-1']);
  assert.deepEqual(followupsForComplaint(list, ''), []);
  assert.deepEqual(complaintFollowupComplaints(list), ['C-102', 'C-103', 'C-101']);
});

test('at most one open follow-up due date per closed complaint', () => {
  const list = [first, second, third].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.equal(complaintFollowupDue(list, 'C-101').id, 'CF-1');
  assert.equal(complaintFollowupDue(list, 'c-101').id, 'CF-1');
  assert.equal(complaintFollowupDue(list, 'C-102'), null);
  assert.equal(complaintFollowupDue(list, 'C-103'), null);
  assert.equal(complaintFollowupDue(list, 'C-999'), null);
  assert.equal(complaintFollowupDue(list, ''), null);
});

test('not satisfied reopens the follow-up list, never the complaint', () => {
  const list = [first, second, third].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  const open = openComplaintFollowups(list);
  assert.deepEqual(open.map((item) => item.id), ['CF-3', 'CF-1']);
  // The still-satisfied follow-up is off the list; the not-satisfied
  // one is back on it — and the module holds no complaint status
  // field at all, so nothing here can reopen a complaint.
  assert.equal(open.some((item) => item.id === 'CF-2'), false);
  assert.equal('status' in third, false);
  const recorded = recordComplaintFollowup([], third);
  assert.equal('status' in recorded[0], false);
});

test('completing records the outcome once and never rewrites the record', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', 'no', '2026-11-10', 'Customer says the fault came back.');
  assert.equal(done[0].stillSatisfied, false);
  assert.deepEqual(done[0].followups, [{ date: '2026-11-10', note: 'Customer says the fault came back.' }]);
  assert.equal(done[0].complaintRef, 'C-101');
  assert.equal(done[0].dueDate, '2026-11-10');
  assert.equal(done[0].note, 'Check the line is still working.');
  // Already completed: refused.
  assert.deepEqual(completeComplaintFollowup(done, 'CF-1', 'yes', '2026-11-11', 'Changed mind.'), done);
  // Unclear answer, bad date, missing note, unknown id: refused.
  assert.deepEqual(completeComplaintFollowup(list, 'CF-1', 'maybe', '2026-11-10', 'Note.'), list);
  assert.deepEqual(completeComplaintFollowup(list, 'CF-1', 'yes', '2026-02-30', 'Note.'), list);
  assert.deepEqual(completeComplaintFollowup(list, 'CF-1', 'yes', '2026-11-10', ''), list);
  assert.deepEqual(completeComplaintFollowup(list, 'CF-9', 'yes', '2026-11-10', 'Note.'), list);
  // A completed follow-up leaves the open list only when satisfied.
  const satisfied = completeComplaintFollowup(list, 'CF-1', 'yes', '2026-11-10', 'Still happy.');
  assert.deepEqual(openComplaintFollowups(satisfied), []);
  const unhappy = completeComplaintFollowup(list, 'CF-1', 'no', '2026-11-10', 'Fault came back.');
  assert.deepEqual(openComplaintFollowups(unhappy).map((item) => item.id), ['CF-1']);
});

test('dated follow-up notes never rewrite the record', () => {
  const list = [first, second].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  const noted = addComplaintFollowupNote(list, 'CF-1', '2026-11-11', 'Called again, no answer.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].complaintRef, 'C-101');
  assert.equal(noted[0].dueDate, '2026-11-10');
  assert.equal(noted[0].note, 'Check the line is still working.');
  assert.equal(noted[0].stillSatisfied, null);
  assert.deepEqual(addComplaintFollowupNote(list, 'CF-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addComplaintFollowupNote(list, 'CF-1', '2026-11-11', ''), list);
  assert.deepEqual(addComplaintFollowupNote(list, 'CF-9', '2026-11-11', 'Unknown.'), list);
});

test('summary and entry text name the outcome plainly', () => {
  assert.equal(complaintFollowupSummaryText([]), 'No complaint follow-ups recorded.');
  const list = [first, second, third].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.equal(complaintFollowupSummaryText(list), '3 complaint follow-ups: 1 open, 1 still satisfied, 1 not satisfied.');
  assert.equal(complaintFollowupText(first), 'Complaint C-101 (due 2026-11-10): open, due — Check the line is still working.');
  assert.equal(complaintFollowupText(second), 'Complaint C-102 (due 2026-11-08): still satisfied — Customer happy after the fix. Follow-ups: 2026-11-08: Called, still satisfied.');
  assert.equal(complaintFollowupText(third), 'Complaint C-103 (due 2026-11-09): not satisfied — Fix failed again. Follow-ups: 2026-11-09: Customer says the fault came back.');
  assert.equal(complaintFollowupText(null), 'No complaint follow-up recorded.');
});

test('html escapes input', () => {
  const nasty = { ...first, note: '<script>alert(1)</script> & "quoted"' };
  const html = complaintFollowupHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&amp;'), true);
  assert.equal(complaintFollowupHtml(null), '<p>No complaint follow-up recorded.</p>');
  const list = [first, second].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  assert.equal(complaintFollowupAllHtml(list).startsWith('<ul>'), true);
  assert.equal(complaintFollowupAllHtml([]), '<p>No complaint follow-ups recorded.</p>');
});

test('csv export and filename', () => {
  const list = [first, second].reduce((acc, item) => recordComplaintFollowup(acc, item), []);
  const csv = complaintFollowupCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","complaint reference","due date","still satisfied","note","follow-ups"');
  assert.equal(lines[1].includes('"C-102"'), true);
  assert.equal(lines[1].includes('"yes"'), true);
  assert.equal(lines[2].includes('"C-101"'), true);
  assert.equal(lines[2].includes('"open"'), true);
  assert.equal(complaintFollowupFilename(), 'complaint-followups.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, note: 'Changed.' }, { id: 'CF-9' }, null, 'nope', second];
  assert.deepEqual(normalizeComplaintFollowupList(messy).map((item) => item.id), ['CF-1', 'CF-2']);
  assert.deepEqual(normalizeComplaintFollowupList('not a list'), []);
  assert.deepEqual(normalizeComplaintFollowupList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../complaint-followup.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the closure satisfaction note and visit feedback are untouched', () => {
  const source = readFileSync(new URL('../complaint-followup.js', import.meta.url), 'utf8');
  assert.equal(source.includes('satisfaction.js'), false, 'module must not reference the closure satisfaction note module');
  assert.equal(source.includes('visit-feedback'), false, 'module must not reference the visit feedback module');
  assert.equal(existsSync(new URL('../satisfaction.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../visit-feedback.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cfHeading', 'cfSummary', 'cfList', 'cfExportBtn',
    'cfComplaintRef', 'cfDueDate', 'cfNote', 'cfRecordBtn',
    'cfCompleteId', 'cfCompleteAnswer', 'cfCompleteDate', 'cfCompleteNote', 'cfCompleteBtn',
    'cfAnnotateId', 'cfAnnotateDate', 'cfAnnotateNote', 'cfAnnotateBtn',
    'cfRemoveId', 'cfRemoveBtn',
    'cfDueRef', 'cfDueBtn', 'cfDueBody',
    'cfOpenBtn', 'cfOpenBody',
    'cfFilterComplaint', 'cfFilterBtn', 'cfFilterBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the complaint follow-up panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './complaint-followup.js'"), true);
  assert.equal(source.includes('renderComplaintFollowups()'), true);
  assert.equal(source.includes('COMPLAINT_FOLLOWUP_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
