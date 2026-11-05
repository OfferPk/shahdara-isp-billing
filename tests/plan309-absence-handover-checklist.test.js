import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validAbsenceHandoverChecklistDay,
  normalizeAbsenceHandoverChecklistStep,
  normalizeAbsenceHandoverChecklist,
  normalizeAbsenceHandoverChecklistList,
  findAbsenceHandoverChecklist,
  recordAbsenceHandoverChecklist,
  removeAbsenceHandoverChecklist,
  setAbsenceHandoverChecklistStepDone,
  absenceHandoverChecklistStepCounts,
  absenceHandoverChecklistSorted,
  absenceHandoverChecklistsForPerson,
  absenceHandoverChecklistCoveringPeople,
  absenceHandoverChecklistSummaryText,
  absenceHandoverChecklistEntryText,
  absenceHandoverChecklistEntryHtml,
  absenceHandoverChecklistAllHtml,
  absenceHandoverChecklistsForPersonHtml,
  absenceHandoverChecklistCsv,
  absenceHandoverChecklistFilename,
} from '../absence-handover-checklist.js';

const first = {
  id: 'AHC-1',
  coverFrom: '2026-11-07',
  coverTo: '2026-11-09',
  coveringPerson: 'Saad',
  steps: [
    { label: 'Collect pending bills', done: true },
    { label: 'Open shop on time', done: false },
    { label: 'Note faults in diary', done: false, note: 'Call owner if major' },
  ],
  notes: 'Owner away for a family visit.',
};
const second = {
  id: 'AHC-2',
  coverFrom: '2026-11-14',
  coverTo: '2026-11-15',
  coveringPerson: 'Owner',
  steps: [{ label: 'Collect pending bills', done: true }],
};
const third = {
  id: 'AHC-3',
  coverFrom: '2026-11-07',
  coverTo: '2026-11-08',
  coveringPerson: 'Saad',
  steps: [
    { label: 'Lock shop at night', done: true },
    { label: 'Hand cash to owner', done: false },
  ],
};
const fourth = {
  id: 'AHC-4',
  coverFrom: '2026-11-20',
  coverTo: '2026-11-21',
  coveringPerson: 'saad',
  steps: [{ label: 'Check generator fuel', done: false }],
};

test('strict dates: real calendar days only', () => {
  assert.equal(validAbsenceHandoverChecklistDay('2026-11-07'), true);
  assert.equal(validAbsenceHandoverChecklistDay('2024-02-29'), true);
  assert.equal(validAbsenceHandoverChecklistDay('2026-02-29'), false);
  assert.equal(validAbsenceHandoverChecklistDay('2026-04-31'), false);
  assert.equal(validAbsenceHandoverChecklistDay('2026-13-01'), false);
  assert.equal(validAbsenceHandoverChecklistDay('2026-11-7'), false);
});

test('half-formed checklists are refused', () => {
  assert.equal(normalizeAbsenceHandoverChecklist(null), null);
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, id: '' }), null);
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, coverFrom: '2026-02-30' }), null);
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, coverTo: '2026-11-06' }), null);
  assert.deepEqual(
    normalizeAbsenceHandoverChecklist({ ...first, coverTo: '2026-11-07' }),
    { ...first, coverTo: '2026-11-07' },
  );
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, coveringPerson: '  ' }), null);
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, steps: [] }), null);
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, steps: 'Collect bills' }), null);
  assert.deepEqual(normalizeAbsenceHandoverChecklist(first), first);
});

test('steps are refused without a label, and done defaults to not done', () => {
  assert.equal(normalizeAbsenceHandoverChecklistStep({ label: '', done: true }), null);
  assert.equal(normalizeAbsenceHandoverChecklistStep({ done: true }), null);
  assert.equal(normalizeAbsenceHandoverChecklistStep(null), null);
  assert.deepEqual(normalizeAbsenceHandoverChecklistStep({ label: ' Open shop ' }), { label: 'Open shop', done: false });
  assert.deepEqual(normalizeAbsenceHandoverChecklistStep({ label: 'Open shop', done: true, note: '  On time  ' }), { label: 'Open shop', done: true, note: 'On time' });
  assert.deepEqual(normalizeAbsenceHandoverChecklistStep({ label: 'Open shop', done: 'yes' }), { label: 'Open shop', done: false });
  assert.equal(normalizeAbsenceHandoverChecklist({ ...first, steps: [{ label: '' }] }), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 5000, customer: 'Someone', extra: true };
  const clean = normalizeAbsenceHandoverChecklist(raw);
  assert.deepEqual(clean, first);
  assert.equal('bill' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('customer' in clean, false);
  const before = JSON.stringify(raw);
  normalizeAbsenceHandoverChecklist(raw);
  assert.equal(JSON.stringify(raw), before);
  const withExtraStep = { ...first, steps: [{ label: 'Open shop', bill: 'B-1' }] };
  assert.deepEqual(normalizeAbsenceHandoverChecklist(withExtraStep).steps, [{ label: 'Open shop', done: false }]);
});

test('duplicate ids are never rewritten', () => {
  const list = recordAbsenceHandoverChecklist([first], { ...first, coveringPerson: 'Someone else' });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordAbsenceHandoverChecklist([first], second), [first, second]);
  assert.deepEqual(recordAbsenceHandoverChecklist([], 'nope'), []);
});

test('find and remove', () => {
  assert.deepEqual(findAbsenceHandoverChecklist([first, second], 'AHC-2'), second);
  assert.equal(findAbsenceHandoverChecklist([first], 'AHC-9'), null);
  assert.equal(findAbsenceHandoverChecklist([first], ''), null);
  assert.deepEqual(removeAbsenceHandoverChecklist([first, second], 'AHC-1'), [second]);
  assert.deepEqual(removeAbsenceHandoverChecklist([first], 'AHC-9'), [first]);
});

test('marking a step done or not done changes only that one step', () => {
  const marked = setAbsenceHandoverChecklistStepDone([first, second], 'AHC-1', 1, true);
  assert.deepEqual(absenceHandoverChecklistStepCounts(marked[0]), { done: 2, missed: 1, total: 3 });
  assert.deepEqual(marked[1], second);
  const unmarked = setAbsenceHandoverChecklistStepDone(marked, 'AHC-1', 0, false);
  assert.deepEqual(absenceHandoverChecklistStepCounts(unmarked[0]), { done: 1, missed: 2, total: 3 });
  assert.deepEqual(setAbsenceHandoverChecklistStepDone([first], 'AHC-9', 0, true), [first]);
  assert.deepEqual(setAbsenceHandoverChecklistStepDone([first], 'AHC-1', 5, true), [first]);
  assert.deepEqual(setAbsenceHandoverChecklistStepDone([first], 'AHC-1', -1, true), [first]);
  assert.deepEqual(setAbsenceHandoverChecklistStepDone([first], 'AHC-1', 0, 'yes'), [first]);
  const before = JSON.stringify([first, second]);
  setAbsenceHandoverChecklistStepDone([first, second], 'AHC-1', 1, true);
  assert.equal(JSON.stringify([first, second]), before);
});

test('step counts show done and missed steps', () => {
  assert.deepEqual(absenceHandoverChecklistStepCounts(first), { done: 1, missed: 2, total: 3 });
  assert.deepEqual(absenceHandoverChecklistStepCounts(second), { done: 1, missed: 0, total: 1 });
  assert.deepEqual(absenceHandoverChecklistStepCounts(third), { done: 1, missed: 1, total: 2 });
  assert.equal(absenceHandoverChecklistStepCounts(null), null);
});

test('sorting is by cover-from date, then cover-to date, then id', () => {
  assert.deepEqual(
    absenceHandoverChecklistSorted([third, first, fourth, second]).map((checklist) => checklist.id),
    ['AHC-3', 'AHC-1', 'AHC-2', 'AHC-4'],
  );
});

test('checklists for one covering person, in cover-date order, and people list keeps the first spelling', () => {
  assert.deepEqual(absenceHandoverChecklistsForPerson([third, first, fourth, second], 'SAAD').map((checklist) => checklist.id), ['AHC-3', 'AHC-1', 'AHC-4']);
  assert.deepEqual(absenceHandoverChecklistsForPerson([first], 'Nope'), []);
  assert.deepEqual(absenceHandoverChecklistsForPerson([first], ''), []);
  assert.deepEqual(absenceHandoverChecklistCoveringPeople([second, first, fourth]), ['Owner', 'Saad']);
});

test('summary text names the count, the steps done and still to do, and the next cover', () => {
  assert.equal(absenceHandoverChecklistSummaryText([]), 'No owner absence handover checklists recorded.');
  assert.equal(
    absenceHandoverChecklistSummaryText([third, first, second]),
    '3 handover checklists, 3 of 6 steps done, 3 steps still to do. Next cover: 2026-11-07 to 2026-11-08 by Saad.',
  );
  assert.equal(
    absenceHandoverChecklistSummaryText([first]),
    '1 handover checklist, 1 of 3 steps done, 2 steps still to do. Next cover: 2026-11-07 to 2026-11-09 by Saad.',
  );
});

test('entry text names the cover period, its done and missed steps, and its notes', () => {
  assert.equal(
    absenceHandoverChecklistEntryText(first),
    '2026-11-07 to 2026-11-09 — cover by Saad: 1 of 3 steps done, 2 still to do. Steps: Collect pending bills (done); Open shop on time (to do); Note faults in diary (to do — Call owner if major). Notes: Owner away for a family visit.',
  );
  assert.equal(
    absenceHandoverChecklistEntryText(second),
    '2026-11-14 to 2026-11-15 — cover by Owner: 1 of 1 steps done, 0 still to do. Steps: Collect pending bills (done).',
  );
  assert.equal(absenceHandoverChecklistEntryText(null), '');
});

test('HTML escapes user-entered text', () => {
  const tricky = { ...first, coveringPerson: '<b>Saad</b>', steps: [{ label: '<script>', done: true }] };
  const html = absenceHandoverChecklistEntryHtml(tricky);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;b&gt;Saad&lt;/b&gt;'), true);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(absenceHandoverChecklistEntryHtml(null), '');
  assert.equal(
    absenceHandoverChecklistAllHtml([second, first]),
    '<ul><li>2026-11-07 to 2026-11-09 — cover by Saad: 1 of 3 steps done, 2 still to do. Steps: Collect pending bills (done); Open shop on time (to do); Note faults in diary (to do — Call owner if major). Notes: Owner away for a family visit.</li><li>2026-11-14 to 2026-11-15 — cover by Owner: 1 of 1 steps done, 0 still to do. Steps: Collect pending bills (done).</li></ul>',
  );
  assert.equal(absenceHandoverChecklistAllHtml([]), '<p>No owner absence handover checklists recorded.</p>');
  assert.equal(
    absenceHandoverChecklistsForPersonHtml([third, first, second], 'saad'),
    '<ul><li>2026-11-07 to 2026-11-08 — cover by Saad: 1 of 2 steps done, 1 still to do. Steps: Lock shop at night (done); Hand cash to owner (to do).</li><li>2026-11-07 to 2026-11-09 — cover by Saad: 1 of 3 steps done, 2 still to do. Steps: Collect pending bills (done); Open shop on time (to do); Note faults in diary (to do — Call owner if major). Notes: Owner away for a family visit.</li></ul>',
  );
  assert.equal(absenceHandoverChecklistsForPersonHtml([first], 'Nope'), '<p>No handover checklists for that covering person.</p>');
});

test('CSV export and filename', () => {
  const lines = absenceHandoverChecklistCsv([third, first, second]).split('\n');
  assert.equal(lines[0], 'id,coverFrom,coverTo,coveringPerson,steps,notes');
  assert.equal(lines[1], 'AHC-3,2026-11-07,2026-11-08,Saad,Lock shop at night:done; Hand cash to owner:to do,');
  assert.equal(lines[2], 'AHC-1,2026-11-07,2026-11-09,Saad,Collect pending bills:done; Open shop on time:to do; Note faults in diary:to do,Owner away for a family visit.');
  assert.equal(lines[3], 'AHC-2,2026-11-14,2026-11-15,Owner,Collect pending bills:done,');
  assert.equal(lines.length, 4);
  assert.equal(absenceHandoverChecklistCsv([]), 'id,coverFrom,coverTo,coveringPerson,steps,notes');
  assert.equal(absenceHandoverChecklistFilename(), 'absence-handover-checklists.csv');
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  assert.deepEqual(normalizeAbsenceHandoverChecklistList(null), []);
  assert.deepEqual(normalizeAbsenceHandoverChecklistList('nope'), []);
  assert.deepEqual(normalizeAbsenceHandoverChecklistList([first, null, { ...second, id: '' }, first]), [first]);
  assert.deepEqual(normalizeAbsenceHandoverChecklistList([second, first, second]), [second, first]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../absence-handover-checklist.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: cover roster, decision log, staff and field handover notes and delegation note are untouched', () => {
  const source = readFileSync(new URL('../absence-handover-checklist.js', import.meta.url), 'utf8');
  assert.equal(source.includes('absence-cover.js'), false, 'module must not reference the cover roster file');
  assert.equal(source.includes('decision-log.js'), false, 'module must not reference the decision log file');
  assert.equal(source.includes('staff-handover.js'), false, 'module must not reference the staff handover file');
  assert.equal(source.includes('handover.js'), false, 'module must not reference the field handover file');
  assert.equal(source.includes('delegation-note.js'), false, 'module must not reference the delegation note file');
  assert.equal(existsSync(new URL('../absence-cover.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../decision-log.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../staff-handover.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../handover.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../delegation-note.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'ahcHeading', 'ahcSummary', 'ahcExportBtn', 'ahcId', 'ahcCoverFrom',
    'ahcCoverTo', 'ahcCoveringPerson', 'ahcSteps', 'ahcNotes', 'ahcRecordBtn',
    'ahcRemoveId', 'ahcRemoveBtn', 'ahcMarkId', 'ahcMarkStep', 'ahcMarkDoneBtn',
    'ahcMarkTodoBtn', 'ahcPersonSelect', 'ahcPersonBody', 'ahcBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the absence handover checklist panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './absence-handover-checklist.js'"), true);
  assert.equal(source.includes('renderAbsenceHandoverChecklist();'), true);
  assert.equal(source.includes('shahdara_absence_handover_checklists_v1'), true);
  assert.equal(source.includes('loadAbsenceHandoverChecklists'), true);
  assert.equal(source.includes('saveAbsenceHandoverChecklists'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
