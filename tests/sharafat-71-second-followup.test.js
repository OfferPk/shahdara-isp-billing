// Sharafat 71 — one follow-up per complaint, forever, is fixed: the rule
// is one OPEN follow-up per complaint. A completed follow-up stays as
// history and a new one may be recorded once the previous is completed,
// so a re-resolved complaint can be checked again.
//
// Before the fix, normalizeComplaintFollowupList dropped any second
// record for the same complaint and recordComplaintFollowup refused a
// duplicate complaintRef — the code enforced at most one EVER, even
// though the module's own rule is at most one open. Tests on synthetic
// data only: no real customer names, no phone numbers anywhere in
// this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeComplaintFollowupList,
  recordComplaintFollowup,
  completeComplaintFollowup,
  complaintFollowupDue,
  openComplaintFollowups,
  followupsForComplaint,
  complaintFollowupSummaryText,
  complaintFollowupCsv,
  complaintFollowupSorted,
} from '../complaint-followup.js';

const first = { id: 'CF-1', complaintRef: 'CMP-101', dueDate: '2026-11-10', stillSatisfied: null, note: 'Check the line is still working.' };
const satisfied = { id: 'CF-2', complaintRef: 'CMP-102', dueDate: '2026-11-08', stillSatisfied: true, note: 'Customer happy after the fix.', followups: [{ date: '2026-11-08', note: 'Called, still satisfied.' }] };

test('record after a satisfied completion: a second follow-up is allowed', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  assert.equal(done[0].stillSatisfied, true);
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again after the second fix.' });
  assert.equal(again.length, 2);
  // The first record is untouched history; the second is its own open record.
  assert.equal(again[0].id, 'CF-1');
  assert.equal(again[0].stillSatisfied, true);
  assert.equal(again[1].id, 'CF-4');
  assert.equal(again[1].complaintRef, 'CMP-101');
  assert.equal(again[1].dueDate, '2026-11-20');
  assert.equal(again[1].stillSatisfied, null);
});

test('record after a not-satisfied completion: a second follow-up is allowed', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', false, '2026-11-10', 'Fault came back.');
  assert.equal(done[0].stillSatisfied, false);
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again after the second fix.' });
  assert.equal(again.length, 2);
  assert.equal(again[1].id, 'CF-4');
  assert.equal(again[1].stillSatisfied, null);
});

test('two open follow-ups for one complaint are still refused at record', () => {
  const list = recordComplaintFollowup([], first);
  assert.deepEqual(
    recordComplaintFollowup(list, { id: 'CF-4', complaintRef: 'cmp-101', dueDate: '2026-11-12', note: 'Second check.' }),
    list,
  );
});

test('the normalizer keeps only the first of two open records', () => {
  const messy = [first, { ...first, id: 'CF-4', dueDate: '2026-11-12', note: 'Second check.' }];
  assert.deepEqual(normalizeComplaintFollowupList(messy).map((item) => item.id), ['CF-1']);
});

test('the normalizer keeps a completed record and a new open one', () => {
  const second = { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', stillSatisfied: null, note: 'Check again.' };
  assert.deepEqual(normalizeComplaintFollowupList([satisfied, second]).map((item) => item.id), ['CF-2', 'CF-4']);
});

test('the normalizer keeps two completed records', () => {
  const secondDone = { id: 'CF-4', complaintRef: 'CMP-102', dueDate: '2026-11-20', stillSatisfied: false, note: 'Failed again.', followups: [{ date: '2026-11-20', note: 'Called, not satisfied.' }] };
  assert.deepEqual(normalizeComplaintFollowupList([satisfied, secondDone]).map((item) => item.id), ['CF-2', 'CF-4']);
});

test('the normalizer keeps both records whatever their order', () => {
  const second = { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', stillSatisfied: null, note: 'Check again.' };
  const completedFirst = { ...first, stillSatisfied: true, followups: [{ date: '2026-11-10', note: 'Still happy.' }] };
  assert.deepEqual(normalizeComplaintFollowupList([second, completedFirst]).map((item) => item.id), ['CF-4', 'CF-1']);
});

test('complaint refs dedupe case-insensitively', () => {
  // An open record blocks a second open even when the ref differs by case;
  // a completed record does not block a new open one under either spelling.
  const open = recordComplaintFollowup([], first);
  assert.deepEqual(recordComplaintFollowup(open, { id: 'CF-4', complaintRef: 'cmp-101', dueDate: '2026-11-12', note: 'Second check.' }), open);
  const done = completeComplaintFollowup(open, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'cmp-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.equal(again.length, 2);
  assert.equal(again[1].id, 'CF-4');
});

test('due returns the new open follow-up after complete and record', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.equal(complaintFollowupDue(again, 'CMP-101').id, 'CF-4');
  assert.equal(complaintFollowupDue(again, 'cmp-101').id, 'CF-4');
});

test('due returns null when no open follow-up exists', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  assert.equal(complaintFollowupDue(done, 'CMP-101'), null);
  assert.equal(complaintFollowupDue(done, 'CMP-999'), null);
});

test('completing the second follow-up by id works while the first is present', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  const finished = completeComplaintFollowup(again, 'CF-4', false, '2026-11-20', 'Fault came back again.');
  assert.equal(finished.length, 2);
  assert.equal(finished[0].stillSatisfied, true);
  assert.equal(finished[1].stillSatisfied, false);
  // And completing the first again is still refused.
  assert.deepEqual(completeComplaintFollowup(finished, 'CF-1', false, '2026-11-21', 'Changed.'), finished);
});

test('followupsForComplaint returns both records in due-date order', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.deepEqual(followupsForComplaint(again, 'CMP-101').map((item) => item.id), ['CF-1', 'CF-4']);
  assert.deepEqual(followupsForComplaint(again, 'CMP-999'), []);
});

test('the open list shows the old not-satisfied record and the new open one', () => {
  // Sharafat 71 R5: the open list shows ENTRIES, so a completed
  // not-satisfied record stays on it and the new open record joins it
  // — the same complaint appears twice until the new one is completed.
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', false, '2026-11-10', 'Fault came back.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.deepEqual(openComplaintFollowups(again).map((item) => item.id), ['CF-1', 'CF-4']);
});

test('the summary counts both entries and the CSV exports both rows', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.equal(complaintFollowupSummaryText(again), '2 complaint follow-ups: 1 open, 1 still satisfied, 0 not satisfied.');
  const csv = complaintFollowupCsv(again);
  assert.equal(csv.split('\n').length, 3);
  assert.ok(csv.includes('"CF-1"'));
  assert.ok(csv.includes('"CF-4"'));
});

test('round-trip: the save path must not eat the second record', () => {
  // Sharafat 71 R2: saveComplaintFollowups normalizes on save, so the
  // normalizer is the live path — record, normalize (as a save does),
  // complete, record again: the whole cycle must hold.
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  const saved = normalizeComplaintFollowupList(again);
  assert.deepEqual(saved.map((item) => item.id), ['CF-1', 'CF-4']);
  const doneAgain = completeComplaintFollowup(saved, 'CF-4', true, '2026-11-20', 'Still happy.');
  const third = recordComplaintFollowup(doneAgain, { id: 'CF-5', complaintRef: 'CMP-101', dueDate: '2026-11-30', note: 'Third check.' });
  assert.equal(third.length, 3);
  assert.deepEqual(normalizeComplaintFollowupList(third).map((item) => item.id), ['CF-1', 'CF-4', 'CF-5']);
});

test('sort order follows due date, not history', () => {
  // Sharafat 71 R12: the successor can sort BEFORE the completed
  // record when its due date is earlier — that is correct, the list
  // is sorted by due date.
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const again = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-101', dueDate: '2026-11-05', note: 'Earlier check.' });
  assert.deepEqual(complaintFollowupSorted(again).map((item) => item.id), ['CF-4', 'CF-1']);
  assert.deepEqual(followupsForComplaint(again, 'CMP-101').map((item) => item.id), ['CF-4', 'CF-1']);
});

test('guards still hold: duplicate id, half-formed, bad dates, unknown id', () => {
  const list = recordComplaintFollowup([], first);
  assert.deepEqual(recordComplaintFollowup(list, { ...first, note: 'Changed.' }), list);
  assert.deepEqual(recordComplaintFollowup([], { ...first, dueDate: '' }), []);
  assert.deepEqual(recordComplaintFollowup([], { ...first, dueDate: '2026-02-30' }), []);
  assert.deepEqual(completeComplaintFollowup(list, 'CF-9', true, '2026-11-10', 'Nope.'), list);
  // Completing twice is still refused.
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  assert.deepEqual(completeComplaintFollowup(done, 'CF-1', false, '2026-11-11', 'Changed.'), done);
});

test('a different complaint is unaffected by the new rule', () => {
  const list = recordComplaintFollowup([], first);
  const done = completeComplaintFollowup(list, 'CF-1', true, '2026-11-10', 'Still happy.');
  const other = recordComplaintFollowup(done, { id: 'CF-4', complaintRef: 'CMP-102', dueDate: '2026-11-12', note: 'Other complaint.' });
  assert.equal(other.length, 2);
  assert.equal(complaintFollowupDue(other, 'CMP-102').id, 'CF-4');
  // And the first complaint can still get its own second check.
  const again = recordComplaintFollowup(other, { id: 'CF-5', complaintRef: 'CMP-101', dueDate: '2026-11-20', note: 'Check again.' });
  assert.equal(again.length, 3);
});
