import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDelegationNoteDate,
  normalizeDelegationNote,
  normalizeDelegationNoteList,
  findDelegationNote,
  recordDelegationNote,
  removeDelegationNote,
  markDelegationNoteAcknowledged,
  delegationNoteSorted,
  delegationNotesForStaff,
  delegationNoteStaff,
  delegationNotesOverdue,
  delegationNoteNextDue,
  delegationNoteSummaryText,
  delegationNoteEntryText,
  delegationNoteEntryHtml,
  delegationNoteAllHtml,
  delegationNotesForStaffHtml,
  delegationNotesOverdueHtml,
  delegationNoteCsv,
  delegationNoteFilename,
} from '../delegation-note.js';

const first = {
  id: 'DG-1',
  task: 'Collect Rs 5,000 from Mohalla A',
  delegatedTo: 'Saad',
  delegatedBy: 'Owner',
  date: '2026-11-04',
  dueDate: '2026-11-07',
  acknowledged: false,
};
const second = {
  id: 'DG-2',
  task: 'Visit the new customer in Mohalla B',
  delegatedTo: 'Saad',
  delegatedBy: 'Owner',
  date: '2026-11-05',
  dueDate: '2026-11-06',
  acknowledged: true,
};
const third = {
  id: 'DG-3',
  task: 'Buy fibre connectors from the market',
  delegatedTo: 'Bilal',
  delegatedBy: 'Owner',
  date: '2026-11-05',
  dueDate: '2026-11-08',
  acknowledged: false,
};
const fixture = [third, first, second];

test('half-formed delegations are refused', () => {
  assert.equal(normalizeDelegationNote(null), null);
  assert.equal(normalizeDelegationNote([]), null);
  assert.equal(normalizeDelegationNote({ ...first, id: '  ' }), null);
  assert.equal(normalizeDelegationNote({ ...first, task: '' }), null);
  assert.equal(normalizeDelegationNote({ ...first, delegatedTo: '   ' }), null);
  assert.equal(normalizeDelegationNote({ ...first, delegatedBy: '' }), null);
  assert.equal(normalizeDelegationNote({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeDelegationNote({ ...first, date: '2026-13-01' }), null);
  assert.equal(normalizeDelegationNote({ ...first, dueDate: '2026-11-31' }), null);
  // A due date before the delegation date is refused.
  assert.equal(normalizeDelegationNote({ ...first, dueDate: '2026-11-03' }), null);
  // A due date on the same day is fine.
  assert.deepEqual(normalizeDelegationNote({ ...first, dueDate: '2026-11-04' }), {
    ...first,
    dueDate: '2026-11-04',
  });
});

test('strict dates', () => {
  assert.equal(validDelegationNoteDate('2024-02-29'), true);
  assert.equal(validDelegationNoteDate('2025-02-29'), false);
  assert.equal(validDelegationNoteDate('2026-11-31'), false);
  assert.equal(validDelegationNoteDate('2026-11-05'), true);
  assert.equal(validDelegationNoteDate('05-11-2026'), false);
  assert.equal(validDelegationNoteDate(''), false);
});

test('acknowledgement folds from plain spellings and defaults to not yet acknowledged', () => {
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 'yes' }).acknowledged, true);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 'acknowledged' }).acknowledged, true);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 'ack' }).acknowledged, true);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: true }).acknowledged, true);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 1 }).acknowledged, true);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 'no' }).acknowledged, false);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: 'maybe' }).acknowledged, false);
  assert.equal(normalizeDelegationNote({ ...first, acknowledged: undefined }).acknowledged, false);
  const { acknowledged, ...noAck } = first;
  assert.equal(normalizeDelegationNote(noAck).acknowledged, false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 500, customer: 'C-1', taskStatus: 'closed', extra: 'x' };
  const clean = normalizeDelegationNote(raw);
  assert.equal(clean.bill, undefined);
  assert.equal(clean.payment, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.taskStatus, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, bill: 'B-1', payment: 500, customer: 'C-1', taskStatus: 'closed', extra: 'x' });
});

test('duplicate ids are never rewritten', () => {
  const list = recordDelegationNote([first], { ...first, task: 'Changed task' });
  assert.equal(list.length, 1);
  assert.equal(list[0].task, 'Collect Rs 5,000 from Mohalla A');
  assert.equal(recordDelegationNote([first], { ...first, id: '' }).length, 1);
});

test('find and remove', () => {
  assert.deepEqual(findDelegationNote(fixture, 'DG-2'), second);
  assert.equal(findDelegationNote(fixture, 'DG-9'), null);
  assert.equal(findDelegationNote(fixture, ''), null);
  assert.deepEqual(removeDelegationNote(fixture, 'DG-1').map((note) => note.id), ['DG-3', 'DG-2']);
  assert.equal(removeDelegationNote(fixture, 'DG-9').length, 3);
});

test('marking acknowledged changes only that note', () => {
  const marked = markDelegationNoteAcknowledged(fixture, 'DG-1');
  assert.equal(marked.find((note) => note.id === 'DG-1').acknowledged, true);
  assert.equal(marked.find((note) => note.id === 'DG-3').acknowledged, false);
  assert.equal(marked.find((note) => note.id === 'DG-2').acknowledged, true);
  // The original list is untouched.
  assert.equal(fixture.find((note) => note.id === 'DG-1').acknowledged, false);
  assert.deepEqual(markDelegationNoteAcknowledged(fixture, 'DG-9'), fixture);
  assert.deepEqual(markDelegationNoteAcknowledged(fixture, ''), fixture);
});

test('delegations sort by due date, then delegated-to person', () => {
  assert.deepEqual(delegationNoteSorted(fixture).map((note) => note.id), ['DG-2', 'DG-1', 'DG-3']);
  assert.deepEqual(delegationNoteSorted([third, first]).map((note) => note.id), ['DG-1', 'DG-3']);
});

test('delegations per staff member show due dates and acknowledgement', () => {
  assert.deepEqual(delegationNotesForStaff(fixture, 'Saad').map((note) => note.id), ['DG-2', 'DG-1']);
  assert.deepEqual(delegationNotesForStaff(fixture, 'saad').map((note) => note.id), ['DG-2', 'DG-1']);
  assert.deepEqual(delegationNotesForStaff(fixture, 'Bilal').map((note) => note.id), ['DG-3']);
  assert.deepEqual(delegationNotesForStaff(fixture, 'Nobody'), []);
  assert.deepEqual(delegationNotesForStaff(fixture, ''), []);
  assert.deepEqual(delegationNoteStaff(fixture), ['Bilal', 'Saad']);
  assert.deepEqual(delegationNoteStaff([]), []);
  // First spelling is kept.
  assert.deepEqual(delegationNoteStaff([{ ...first, delegatedTo: 'saad' }, second]), ['saad']);
});

test('overdue delegations are visible against a caller-supplied date', () => {
  assert.deepEqual(delegationNotesOverdue(fixture, '2026-11-08').map((note) => note.id), ['DG-1']);
  assert.deepEqual(delegationNotesOverdue(fixture, '2026-11-07'), []);
  // A note due on the as-of day itself is not overdue yet.
  assert.deepEqual(delegationNotesOverdue(fixture, '2026-11-09').map((note) => note.id), ['DG-1', 'DG-3']);
  assert.deepEqual(delegationNotesOverdue(fixture, 'not-a-date'), []);
  assert.deepEqual(delegationNoteNextDue(fixture), first);
  assert.deepEqual(delegationNoteNextDue([second]), null);
  assert.equal(delegationNoteNextDue([]), null);
});

test('summary text names the count, the open count, and the next due note', () => {
  assert.equal(delegationNoteSummaryText([]), 'No delegation notes recorded.');
  assert.equal(
    delegationNoteSummaryText([first]),
    '1 delegation note recorded. 1 not yet acknowledged. Next due on 2026-11-07: Collect Rs 5,000 from Mohalla A, delegated to Saad.',
  );
  assert.equal(
    delegationNoteSummaryText(fixture),
    '3 delegation notes recorded. 2 not yet acknowledged. Next due on 2026-11-07: Collect Rs 5,000 from Mohalla A, delegated to Saad.',
  );
  assert.equal(
    delegationNoteSummaryText([second]),
    '1 delegation note recorded. 0 not yet acknowledged. Nothing outstanding.',
  );
});

test('entry text shows date, task, people, due date, and acknowledgement', () => {
  assert.equal(delegationNoteEntryText(null), 'No delegation note recorded.');
  assert.equal(
    delegationNoteEntryText(first),
    '2026-11-04 — Collect Rs 5,000 from Mohalla A, delegated to Saad by Owner, due 2026-11-07, not yet acknowledged.',
  );
  assert.equal(
    delegationNoteEntryText(second),
    '2026-11-05 — Visit the new customer in Mohalla B, delegated to Saad by Owner, due 2026-11-06, acknowledged.',
  );
});

test('HTML escapes input', () => {
  const nasty = { ...second, task: 'Call <b>everyone</b> & report' };
  assert.equal(delegationNoteEntryHtml(nasty).includes('<b>'), false);
  assert.equal(delegationNoteEntryHtml(nasty).includes('Call &lt;b&gt;everyone&lt;/b&gt; &amp; report'), true);
  assert.equal(delegationNoteEntryHtml(null), '<p>No delegation note recorded.</p>');
  const html = delegationNoteAllHtml(fixture);
  assert.equal(html.includes('2026-11-07'), true);
  assert.equal(html.includes('Saad'), true);
  assert.equal(delegationNoteAllHtml([]), '<p>No delegation notes recorded.</p>');
  assert.equal(delegationNotesForStaffHtml(fixture, 'Saad').includes('Collect Rs 5,000'), true);
  assert.equal(delegationNotesForStaffHtml(fixture, 'Nobody'), '<p>No delegations for that staff member.</p>');
  assert.equal(delegationNotesForStaffHtml(fixture, ''), '<p>Type a staff member name to see their delegations.</p>');
  assert.equal(delegationNotesOverdueHtml(fixture, '2026-11-08').includes('Collect Rs 5,000'), true);
  assert.equal(delegationNotesOverdueHtml(fixture, '2026-11-07'), '<p>No overdue delegations.</p>');
  assert.equal(delegationNotesOverdueHtml(fixture, 'not-a-date'), '<p>Give a real date to see overdue delegations.</p>');
});

test('CSV export and filename', () => {
  const csv = delegationNoteCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","date","task","delegated to","delegated by","due date","acknowledged"');
  assert.equal(csv.includes('"DG-2","2026-11-05","Visit the new customer in Mohalla B","Saad","Owner","2026-11-06","yes"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"DG-2"'), true);
  assert.equal(delegationNoteFilename(), 'delegation-notes.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeDelegationNoteList(null), []);
  assert.deepEqual(normalizeDelegationNoteList('nope'), []);
  assert.deepEqual(normalizeDelegationNoteList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../delegation-note.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: staff and field handover records are untouched', () => {
  const source = readFileSync(new URL('../delegation-note.js', import.meta.url), 'utf8');
  assert.equal(source.includes('staff-handover.js'), false, 'module must not reference the staff handover record');
  assert.equal(source.includes('handover.js'), false, 'module must not reference the field handover record');
  assert.equal(existsSync(new URL('../staff-handover.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../handover.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'dgHeading', 'dgSummary', 'dgExportBtn', 'dgDate', 'dgTask',
    'dgDelegatedTo', 'dgDelegatedBy', 'dgDueDate', 'dgRecordBtn',
    'dgRemoveId', 'dgRemoveBtn', 'dgAckId', 'dgAckBtn',
    'dgStaffInput', 'dgStaffBtn', 'dgStaffBody',
    'dgOverdueInput', 'dgOverdueBtn', 'dgOverdueBody', 'dgBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the owner task delegation note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './delegation-note.js'"), true);
  assert.equal(source.includes('renderDelegationNote()'), true);
  assert.equal(source.includes('loadDelegationNotes()'), true);
  assert.equal(source.includes('shahdara_delegation_notes_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
