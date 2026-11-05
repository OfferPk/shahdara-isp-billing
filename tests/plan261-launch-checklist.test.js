import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validLaunchChecklistDate,
  normalizeLaunchChecklistList,
  recordLaunchChecklist,
  removeLaunchChecklist,
  findLaunchChecklist,
  addLaunchChecklistNote,
  tickLaunchChecklistStep,
  completeLaunchChecklist,
  launchChecklistSorted,
  launchesForMohalla,
  launchChecklistMohallas,
  launchChecklistUntickedSteps,
  launchChecklistProgress,
  launchChecklistStatus,
  launchChecklistSummaryText,
  launchChecklistText,
  launchChecklistHtml,
  launchChecklistAllHtml,
  launchChecklistCsv,
  launchChecklistFilename,
} from '../launch-checklist.js';

const first = { id: 'LC-1', mohalla: 'Shahdara Village', approvedDate: '2026-11-01', steps: [{ step: 'First connections', owner: 'Saad', doneDate: '2026-11-05' }, { step: 'Collector route', owner: 'Saad', doneDate: '' }, { step: 'Announcements', owner: 'Owner', doneDate: '2026-11-06' }] };
const second = { id: 'LC-2', mohalla: 'Chak Shahzad', approvedDate: '2026-11-02', steps: [{ step: 'First connections', owner: 'Saad', doneDate: '2026-11-07' }, { step: 'Collector route', owner: 'Saad', doneDate: '2026-11-08' }] };
const third = { id: 'LC-3', mohalla: 'Bani Gala', approvedDate: '2026-10-28', steps: [{ step: 'First connections', owner: 'Saad', doneDate: '' }] };

test('half-formed launch checklists are refused', () => {
  assert.deepEqual(recordLaunchChecklist([], { ...first, id: '' }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, mohalla: '  ' }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, approvedDate: '' }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, steps: [] }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, steps: [{ step: '', owner: 'Saad', doneDate: '' }] }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, steps: [{ step: 'First connections', owner: '', doneDate: '' }] }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, steps: [{ step: 'First connections', owner: 'Saad', doneDate: '2026-02-30' }] }), []);
  assert.deepEqual(recordLaunchChecklist([], { ...first, steps: [{ step: 'First connections', owner: 'Saad', doneDate: '2026-11-05' }, { step: 'first connections', owner: 'Saad', doneDate: '' }] }), []);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validLaunchChecklistDate('2026-08-31'), true);
  assert.equal(validLaunchChecklistDate('2026-10-31'), true);
  assert.equal(validLaunchChecklistDate('2026-12-31'), true);
  assert.equal(validLaunchChecklistDate('2026-02-29'), false);
  assert.equal(validLaunchChecklistDate('2028-02-29'), true);
  assert.equal(validLaunchChecklistDate('2026-04-31'), false);
  assert.equal(validLaunchChecklistDate('2026-13-01'), false);
  assert.equal(validLaunchChecklistDate('10-11-2026'), false);
  assert.equal(validLaunchChecklistDate(''), false);
  assert.equal(validLaunchChecklistDate(null), false);
  assert.deepEqual(recordLaunchChecklist([], { ...first, approvedDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, coverageRegister: 'changed', billAmount: 500, sendSms: true };
  const recorded = recordLaunchChecklist([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('coverageRegister' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('sendSms' in recorded[0], false);
  assert.equal(recorded[0].complete, false);
  assert.equal(recorded[0].incompleteReason, '');
  assert.deepEqual(recorded[0].followups, []);
  const before = JSON.stringify(first);
  recordLaunchChecklist([], first);
  assert.equal(JSON.stringify(first), before);
  const withUnknownStep = { ...first, id: 'LC-9', steps: [{ step: 'First connections', owner: 'Saad', doneDate: '', extra: 'drop me' }] };
  assert.equal('extra' in recordLaunchChecklist([], withUnknownStep)[0].steps[0], false);
});

test('duplicate ids and a second launch for the same mohalla are refused', () => {
  const list = recordLaunchChecklist([], first);
  assert.deepEqual(recordLaunchChecklist(list, { ...first, steps: [{ step: 'Other step', owner: 'Saad', doneDate: '' }] }), list);
  assert.deepEqual(recordLaunchChecklist(list, { ...second, id: 'LC-9', mohalla: 'shahdara village' }), list);
  const other = recordLaunchChecklist(list, second);
  assert.equal(other.length, 2);
});

test('find and remove work by id', () => {
  const list = [first, second].reduce((acc, item) => recordLaunchChecklist(acc, item), []);
  assert.equal(findLaunchChecklist(list, 'LC-2').mohalla, 'Chak Shahzad');
  assert.equal(findLaunchChecklist(list, 'LC-9'), null);
  assert.equal(findLaunchChecklist(list, ''), null);
  assert.deepEqual(removeLaunchChecklist(list, 'LC-1').map((item) => item.id), ['LC-2']);
  assert.deepEqual(removeLaunchChecklist(list, 'LC-9'), list);
});

test('sorting is by approved date, then mohalla, then id', () => {
  const list = [second, third, first].reduce((acc, item) => recordLaunchChecklist(acc, item), []);
  assert.deepEqual(launchChecklistSorted(list).map((item) => item.id), ['LC-3', 'LC-1', 'LC-2']);
  assert.deepEqual(launchesForMohalla(list, 'shahdara village').map((item) => item.id), ['LC-1']);
  assert.deepEqual(launchesForMohalla(list, ''), []);
  assert.deepEqual(launchChecklistMohallas(list), ['Bani Gala', 'Shahdara Village', 'Chak Shahzad']);
});

test('unticked steps, progress, and status follow the steps in order', () => {
  assert.deepEqual(launchChecklistUntickedSteps(first).map((step) => step.step), ['Collector route']);
  assert.deepEqual(launchChecklistUntickedSteps(second), []);
  assert.deepEqual(launchChecklistProgress(first), { done: 2, total: 3 });
  assert.deepEqual(launchChecklistProgress(second), { done: 2, total: 2 });
  assert.equal(launchChecklistStatus(first), 'in progress — 2/3 steps done');
  assert.equal(launchChecklistStatus(second), 'in progress — 2/2 steps done');
  assert.equal(launchChecklistStatus(null), 'no launch checklist recorded');
});

test('ticking a step records its done date and refuses bad ticks', () => {
  const list = recordLaunchChecklist([], first);
  const ticked = tickLaunchChecklistStep(list, 'LC-1', 'collector route', '2026-11-07');
  assert.equal(ticked[0].steps[1].doneDate, '2026-11-07');
  assert.equal(ticked[0].steps[0].doneDate, '2026-11-05');
  assert.equal(launchChecklistStatus(ticked[0]), 'in progress — 3/3 steps done');
  assert.deepEqual(tickLaunchChecklistStep(list, 'LC-1', 'No such step', '2026-11-07'), list);
  assert.deepEqual(tickLaunchChecklistStep(list, 'LC-1', 'Collector route', '2026-02-30'), list);
  assert.deepEqual(tickLaunchChecklistStep(list, 'LC-1', 'First connections', '2026-11-07'), list);
  assert.deepEqual(tickLaunchChecklistStep(list, 'LC-9', 'Collector route', '2026-11-07'), list);
});

test('a launch with every step ticked completes plainly', () => {
  const list = recordLaunchChecklist([], second);
  const done = completeLaunchChecklist(list, 'LC-2');
  assert.equal(done[0].complete, true);
  assert.equal(done[0].incompleteReason, '');
  assert.equal(launchChecklistStatus(done[0]), 'complete');
  assert.deepEqual(completeLaunchChecklist(done, 'LC-2'), done);
});

test('a launch with unticked steps completes only when a reason is recorded', () => {
  const list = recordLaunchChecklist([], first);
  assert.deepEqual(completeLaunchChecklist(list, 'LC-1'), list);
  assert.deepEqual(completeLaunchChecklist(list, 'LC-1', '  '), list);
  const done = completeLaunchChecklist(list, 'LC-1', 'Collector route delayed by rain.');
  assert.equal(done[0].complete, true);
  assert.equal(done[0].incompleteReason, 'Collector route delayed by rain.');
  assert.equal(launchChecklistStatus(done[0]), 'complete — 1 step unticked, reason recorded');
  assert.deepEqual(completeLaunchChecklist(list, 'LC-9', 'Some reason.'), list);
});

test('a launch is never edited, only annotated with dated follow-ups', () => {
  const list = recordLaunchChecklist([], first);
  const noted = addLaunchChecklistNote(list, 'LC-1', '2026-11-08', 'Route walk done, poles checked.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].followups[0].date, '2026-11-08');
  assert.equal(noted[0].mohalla, 'Shahdara Village');
  assert.equal(noted[0].steps[1].doneDate, '');
  assert.deepEqual(addLaunchChecklistNote(list, 'LC-1', '2026-02-30', 'Bad date.'), list);
  assert.deepEqual(addLaunchChecklistNote(list, 'LC-1', '2026-11-08', ''), list);
  assert.deepEqual(addLaunchChecklistNote(list, 'LC-9', '2026-11-08', 'Unknown launch.'), list);
});

test('summary and entry text show ticked and unticked steps in order', () => {
  assert.equal(launchChecklistSummaryText([]), 'No launch checklists recorded.');
  const list = [first, second].reduce((acc, item) => recordLaunchChecklist(acc, item), []);
  assert.equal(launchChecklistSummaryText(list), '2 launch checklists: 0 complete, 2 in progress.');
  const done = completeLaunchChecklist(list, 'LC-2');
  assert.equal(launchChecklistSummaryText(done), '2 launch checklists: 1 complete, 1 in progress.');
  const text = launchChecklistText(first);
  assert.equal(text.includes('Launch for Shahdara Village (approved 2026-11-01)'), true);
  assert.equal(text.includes('2/3 steps done'), true);
  assert.equal(text.indexOf('First connections') < text.indexOf('Collector route'), true);
  assert.equal(text.indexOf('Collector route') < text.indexOf('Announcements'), true);
  assert.equal(text.includes('not done'), true);
  assert.equal(launchChecklistText(null), 'No launch checklist recorded.');
  const withReason = completeLaunchChecklist(list, 'LC-1', 'Collector route delayed by rain.');
  assert.equal(launchChecklistText(withReason[0]).includes('Reason for unticked steps: Collector route delayed by rain.'), true);
});

test('HTML escapes markup and the all-list renders in approved-date order', () => {
  const nasty = { ...first, id: 'LC-9', mohalla: 'Bad <script> Mohalla', steps: [{ step: 'Fixed & tested', owner: 'Saad', doneDate: '' }] };
  const html = launchChecklistHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Fixed &amp; tested'), true);
  assert.equal(launchChecklistHtml(null), '<p>No launch checklist recorded.</p>');
  assert.equal(launchChecklistAllHtml([]), '<p>No launch checklists recorded.</p>');
  const all = launchChecklistAllHtml([second, first]);
  assert.equal(all.indexOf('Shahdara Village') < all.indexOf('Chak Shahzad'), true);
});

test('CSV export has the launch columns in order', () => {
  const list = [first, second, third].reduce((acc, item) => recordLaunchChecklist(acc, item), []);
  const csv = launchChecklistCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","mohalla","approved date","steps","complete","incomplete reason","follow-ups"');
  assert.equal(lines[1].includes('"Bani Gala"'), true);
  assert.equal(lines[2].includes('"Shahdara Village"'), true);
  assert.equal(lines[2].includes('Collector route | Saad | not done'), true);
  assert.equal(launchChecklistFilename(), 'launch-checklists.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, approvedDate: '2026-11-09' }, { id: 'LC-9' }, null, 'nope', second];
  assert.deepEqual(normalizeLaunchChecklistList(messy).map((item) => item.id), ['LC-1', 'LC-2']);
  assert.deepEqual(normalizeLaunchChecklistList('not a list'), []);
  assert.deepEqual(normalizeLaunchChecklistList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../launch-checklist.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the expansion readiness checklist is untouched', () => {
  const source = readFileSync(new URL('../launch-checklist.js', import.meta.url), 'utf8');
  assert.equal(source.includes('expansion-checklist'), false, 'module must not reference the expansion readiness checklist module');
  assert.equal(existsSync(new URL('../expansion-checklist.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'lcHeading', 'lcSummary', 'lcList', 'lcExportBtn',
    'lcMohalla', 'lcApprovedDate', 'lcSteps', 'lcRecordBtn',
    'lcAnnotateId', 'lcAnnotateDate', 'lcAnnotateNote', 'lcAnnotateBtn',
    'lcRemoveId', 'lcRemoveBtn',
    'lcTickId', 'lcTickStep', 'lcTickDate', 'lcTickBtn',
    'lcCompleteId', 'lcCompleteReason', 'lcCompleteBtn',
    'lcFilterMohalla', 'lcFilterBtn', 'lcFilterBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the new-mohalla launch checklist panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './launch-checklist.js'"), true);
  assert.equal(source.includes('renderLaunchChecklists()'), true);
  assert.equal(source.includes('LAUNCH_CHECKLIST_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
