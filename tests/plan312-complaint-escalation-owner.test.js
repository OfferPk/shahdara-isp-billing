import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLAINT_ESCALATION_OWNER_OUTCOMES,
  validComplaintEscalationOwnerDay,
  foldComplaintEscalationOwnerOutcome,
  normalizeComplaintEscalationOwnerNote,
  normalizeComplaintEscalationOwnerNoteList,
  findComplaintEscalationOwnerNote,
  recordComplaintEscalationOwnerNote,
  removeComplaintEscalationOwnerNote,
  answerComplaintEscalationOwnerNote,
  complaintEscalationOwnerNotesSorted,
  complaintEscalationOwnerNotesForComplaint,
  complaintEscalationOwnerOpenNotes,
  complaintEscalationOwnerComplaintRefs,
  complaintEscalationOwnerSummaryText,
  complaintEscalationOwnerNoteText,
  complaintEscalationOwnerNoteHtml,
  complaintEscalationOwnerAllHtml,
  complaintEscalationOwnerNotesForComplaintHtml,
  complaintEscalationOwnerCsv,
  complaintEscalationOwnerFilename,
} from '../complaint-escalation-owner.js';

const first = {
  id: 'CE-1', complaintRef: 'CMP-41', escalatedBy: 'Saad', date: '2026-11-05',
  reason: 'Customer says the line drops every evening and field visits did not fix it',
};
const second = {
  id: 'CE-2', complaintRef: 'CMP-52', escalatedBy: 'Saad', date: '2026-11-04',
  reason: 'Bill was charged twice and the customer wants the owner to confirm the correction',
  ownerResponse: 'Checked with the ledger, the second charge will be adjusted in the next bill.',
  outcome: 'resolved',
};

test('strict day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validComplaintEscalationOwnerDay('2026-11-05'), true);
  assert.equal(validComplaintEscalationOwnerDay('2024-02-29'), true);
  assert.equal(validComplaintEscalationOwnerDay('2026-02-29'), false);
  assert.equal(validComplaintEscalationOwnerDay('2026-11-31'), false);
  assert.equal(validComplaintEscalationOwnerDay('05-11-2026'), false);
  assert.equal(validComplaintEscalationOwnerDay(''), false);
  assert.equal(validComplaintEscalationOwnerDay(null), false);
});

test('outcome folds known spellings and missing reads as open', () => {
  assert.equal(foldComplaintEscalationOwnerOutcome(''), 'open');
  assert.equal(foldComplaintEscalationOwnerOutcome(undefined), 'open');
  assert.equal(foldComplaintEscalationOwnerOutcome('Resolved'), 'resolved');
  assert.equal(foldComplaintEscalationOwnerOutcome('referred-back'), 'referred back');
  assert.equal(foldComplaintEscalationOwnerOutcome('settled'), 'resolved');
  assert.equal(foldComplaintEscalationOwnerOutcome('ignored'), null);
  assert.deepEqual(COMPLAINT_ESCALATION_OWNER_OUTCOMES, ['open', 'resolved', 'closed', 'referred back']);
});

test('normalize keeps a full note and starts the owner response empty and the outcome open', () => {
  assert.deepEqual(normalizeComplaintEscalationOwnerNote(first), {
    ...first, ownerResponse: '', outcome: 'open',
  });
  assert.deepEqual(normalizeComplaintEscalationOwnerNote(second), second);
});

test('normalize refuses a note missing any required field', () => {
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, id: '' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, complaintRef: '  ' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, escalatedBy: '' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, date: '2026-11-31' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, reason: '' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote({ ...first, outcome: 'ignored' }), null);
  assert.equal(normalizeComplaintEscalationOwnerNote(null), null);
  assert.equal(normalizeComplaintEscalationOwnerNote([]), null);
});

test('normalize drops unknown fields and never mutates the input', () => {
  const raw = { ...first, billAmount: 3000, ticketId: 'TKT-9', customerName: 'Test' };
  const frozen = { ...raw };
  const clean = normalizeComplaintEscalationOwnerNote(raw);
  assert.equal('billAmount' in clean, false);
  assert.equal('ticketId' in clean, false);
  assert.equal('customerName' in clean, false);
  assert.deepEqual(raw, frozen);
});

test('list normalize drops half-formed notes and keeps the first note for a duplicate id', () => {
  const list = normalizeComplaintEscalationOwnerNoteList([first, { ...first, reason: 'Changed reason' }, { ...first, id: 'CE-9' }, null]);
  assert.equal(list.length, 2);
  assert.equal(list[0].reason, first.reason);
  assert.equal(list[1].id, 'CE-9');
  assert.deepEqual(normalizeComplaintEscalationOwnerNoteList('nope'), []);
});

test('find returns the note by id or null', () => {
  assert.equal(findComplaintEscalationOwnerNote([first, second], 'CE-2').complaintRef, 'CMP-52');
  assert.equal(findComplaintEscalationOwnerNote([first], 'CE-9'), null);
  assert.equal(findComplaintEscalationOwnerNote([first], ''), null);
});

test('record refuses half-formed notes and duplicate ids', () => {
  const one = recordComplaintEscalationOwnerNote([], first);
  assert.equal(one.length, 1);
  assert.equal(recordComplaintEscalationOwnerNote(one, { ...first, reason: 'Other reason' }).length, 1);
  assert.equal(recordComplaintEscalationOwnerNote(one, { ...first, id: 'CE-3', date: '2026-13-01' }).length, 1);
  assert.equal(recordComplaintEscalationOwnerNote(one, { ...first, id: 'CE-3' }).length, 2);
});

test('remove drops only the named note', () => {
  const list = [first, second];
  assert.equal(removeComplaintEscalationOwnerNote(list, 'CE-1').length, 1);
  assert.equal(removeComplaintEscalationOwnerNote(list, 'CE-1')[0].id, 'CE-2');
  assert.equal(removeComplaintEscalationOwnerNote(list, 'CE-9').length, 2);
  assert.equal(removeComplaintEscalationOwnerNote(list, '').length, 2);
});

test('owner answer sets the response and outcome on only that note', () => {
  const answered = answerComplaintEscalationOwnerNote([first, second], 'CE-1', 'Will visit the customer myself tomorrow.', 'referred back');
  assert.equal(answered[0].ownerResponse, 'Will visit the customer myself tomorrow.');
  assert.equal(answered[0].outcome, 'referred back');
  assert.equal(answered[1].outcome, 'resolved');
  assert.equal(answered[1].ownerResponse, second.ownerResponse);
});

test('owner answer is refused for a missing note, an empty response, or an unknown outcome', () => {
  const list = [first];
  assert.deepEqual(answerComplaintEscalationOwnerNote(list, 'CE-9', 'Answer.', 'resolved'), [normalizeComplaintEscalationOwnerNote(first)]);
  assert.deepEqual(answerComplaintEscalationOwnerNote(list, 'CE-1', '   ', 'resolved'), [normalizeComplaintEscalationOwnerNote(first)]);
  assert.deepEqual(answerComplaintEscalationOwnerNote(list, 'CE-1', 'Answer.', 'ignored'), [normalizeComplaintEscalationOwnerNote(first)]);
});

test('sorted lists earliest first and notes for one complaint match case-insensitively', () => {
  const sorted = complaintEscalationOwnerNotesSorted([first, second]);
  assert.deepEqual(sorted.map((note) => note.id), ['CE-2', 'CE-1']);
  const forComplaint = complaintEscalationOwnerNotesForComplaint([first, second, { ...first, id: 'CE-3', date: '2026-11-06' }], 'cmp-41');
  assert.deepEqual(forComplaint.map((note) => note.id), ['CE-1', 'CE-3']);
  assert.deepEqual(complaintEscalationOwnerNotesForComplaint([first], ''), []);
});

test('open notes are only the ones still waiting on the owner', () => {
  assert.deepEqual(complaintEscalationOwnerOpenNotes([first, second]).map((note) => note.id), ['CE-1']);
  assert.deepEqual(complaintEscalationOwnerOpenNotes([second]), []);
});

test('complaint references list in A-Z order keeping the first spelling seen', () => {
  assert.deepEqual(
    complaintEscalationOwnerComplaintRefs([second, first, { ...first, id: 'CE-3', complaintRef: 'cmp-41' }]),
    ['CMP-41', 'CMP-52'],
  );
});

test('summary names the count, the open count, and the oldest open escalation', () => {
  assert.equal(complaintEscalationOwnerSummaryText([]), 'No complaint escalations to the owner recorded.');
  assert.equal(complaintEscalationOwnerSummaryText([second]), '1 escalation, all answered.');
  const summary = complaintEscalationOwnerSummaryText([first, second]);
  assert.match(summary, /2 escalations, 1 still open/);
  assert.match(summary, /Oldest open: CMP-41 from 2026-11-05/);
  assert.match(summary, /line drops every evening/);
});

test('note text shows reason, owner response, and outcome', () => {
  assert.match(complaintEscalationOwnerNoteText(first), /CMP-41 escalated by Saad/);
  assert.match(complaintEscalationOwnerNoteText(first), /No owner response yet/);
  assert.match(complaintEscalationOwnerNoteText(first), /Outcome: open/);
  assert.match(complaintEscalationOwnerNoteText(second), /Checked with the ledger/);
  assert.match(complaintEscalationOwnerNoteText(second), /Outcome: resolved/);
  assert.equal(complaintEscalationOwnerNoteText({ ...first, reason: '' }), '');
});

test('html escapes user text and the all-list shows every note', () => {
  const tricky = { ...first, id: 'CE-9', reason: 'Line <b>broken</b> & "noisy"' };
  const html = complaintEscalationOwnerNoteHtml(tricky);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /&lt;b&gt;broken&lt;\/b&gt;/);
  assert.match(complaintEscalationOwnerAllHtml([first, second]), /CMP-41/);
  assert.match(complaintEscalationOwnerAllHtml([first, second]), /CMP-52/);
  assert.equal(complaintEscalationOwnerAllHtml([]), '<p>No complaint escalations to the owner recorded.</p>');
  assert.match(complaintEscalationOwnerNotesForComplaintHtml([first, second], 'CMP-52'), /CMP-52/);
  assert.equal(complaintEscalationOwnerNotesForComplaintHtml([first], 'CMP-99'), '<p>No escalations for that complaint reference.</p>');
});

test('csv lists notes earliest first with a header and the fixed filename', () => {
  const csv = complaintEscalationOwnerCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,complaintRef,escalatedBy,date,reason,ownerResponse,outcome');
  assert.match(lines[1], /^CE-2,CMP-52/);
  assert.match(lines[2], /^CE-1,CMP-41/);
  assert.equal(complaintEscalationOwnerFilename(), 'complaint-escalations-to-owner.csv');
});

test('csv quotes a reason that contains a comma', () => {
  const csv = complaintEscalationOwnerCsv([{ ...first, reason: 'Slow, noisy, and dropping' }]);
  assert.match(csv, /"Slow, noisy, and dropping"/);
});

test('recording an escalation leaves the input list untouched', () => {
  const before = [first];
  const after = recordComplaintEscalationOwnerNote(before, second);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
});
