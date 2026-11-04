import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeYear,
  normalizeStatus,
  normalizeAnnualGoal,
  normalizeAnnualGoalList,
  findAnnualGoal,
  recordAnnualGoal,
  removeAnnualGoal,
  setAnnualGoalStatus,
  addAnnualGoalNote,
  annualGoalsSorted,
  annualGoalsForYear,
  annualGoalsByStatus,
  annualGoalSummaryText,
  annualGoalText,
  annualGoalHtml,
  annualGoalsAllHtml,
  annualGoalsCsv,
  annualGoalsFilename,
} from '../annual-goals.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'annual-goals.js'), 'utf8');

function goal(overrides = {}) {
  return {
    id: 'AG-1',
    year: 2026,
    goal: 'Grow the customer base',
    target: '150 customers',
    status: 'in-progress',
    reviewNote: 'On track after the spring push.',
    progressNotes: [{ date: '2026-06-30', note: 'Reached 120 customers.' }],
    ...overrides,
  };
}

test('half-formed goals are refused, never stored as a neighbouring year', () => {
  assert.equal(normalizeAnnualGoal(null), null);
  assert.equal(normalizeAnnualGoal({ year: 2026, goal: 'Grow' }), null);
  assert.equal(normalizeAnnualGoal({ id: 'AG-1', goal: 'Grow' }), null);
  assert.equal(normalizeAnnualGoal({ id: 'AG-1', year: 2026 }), null);
  assert.equal(normalizeAnnualGoal(goal({ year: 1899 })), null);
  assert.equal(normalizeAnnualGoal(goal({ year: 2101 })), null);
  assert.equal(normalizeAnnualGoal(goal({ year: '26' })), null);
  assert.equal(normalizeAnnualGoal(goal({ year: '2026' })).year, 2026);
});

test('strict dates for progress notes: 31-day months, Feb 29 leap/non-leap', () => {
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-13-01'), null);
  assert.equal(normalizeDate('30-06-2026'), null);
});

test('unknown status falls back to not-started, never hidden', () => {
  assert.equal(normalizeStatus('done'), 'done');
  assert.equal(normalizeStatus('DONE'), 'done');
  assert.equal(normalizeStatus('finished'), 'not-started');
  assert.equal(normalizeStatus(''), 'not-started');
  assert.equal(normalizeAnnualGoal(goal({ status: 'almost' })).status, 'not-started');
});

test('unknown fields are dropped, so no bill, payment, customer, route, or sending field can creep in', () => {
  const entry = normalizeAnnualGoal(goal({
    billId: 'B-1', payment: 500, customer: 'C-1', route: 'R-1', sendTo: '0300',
  }));
  assert.equal('billId' in entry, false);
  assert.equal('payment' in entry, false);
  assert.equal('customer' in entry, false);
  assert.equal('route' in entry, false);
  assert.equal('sendTo' in entry, false);
});

test('duplicate ids are never rewritten', () => {
  const list = recordAnnualGoal([], goal());
  const again = recordAnnualGoal(list, goal({ goal: 'A different goal' }));
  assert.equal(again.length, 1);
  assert.equal(again[0].goal, 'Grow the customer base');
});

test('duplicate ids in a list keep only the first', () => {
  const list = normalizeAnnualGoalList([goal(), goal({ goal: 'Second' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].goal, 'Grow the customer base');
});

test('find and remove', () => {
  const list = recordAnnualGoal([], goal());
  assert.equal(findAnnualGoal(list, 'AG-1').goal, 'Grow the customer base');
  assert.equal(findAnnualGoal(list, 'AG-9'), null);
  assert.equal(removeAnnualGoal(list, 'AG-1').length, 0);
  assert.equal(removeAnnualGoal(list, 'AG-9').length, 1);
});

test('set-status changes only the status marker; unknown status leaves the list unchanged', () => {
  const list = recordAnnualGoal([], goal({ status: 'not-started' }));
  const done = setAnnualGoalStatus(list, 'AG-1', 'done');
  assert.equal(done[0].status, 'done');
  assert.equal(done[0].goal, 'Grow the customer base');
  assert.equal(done[0].target, '150 customers');
  const untouched = setAnnualGoalStatus(list, 'AG-1', 'finished');
  assert.equal(untouched[0].status, 'not-started');
  assert.equal(setAnnualGoalStatus(list, 'AG-9', 'done')[0].status, 'not-started');
});

test('add-note needs a strict date and a note, or the record is unchanged', () => {
  const list = recordAnnualGoal([], goal({ progressNotes: [] }));
  const noted = addAnnualGoalNote(list, 'AG-1', '2026-09-30', 'Reached 140 customers.');
  assert.equal(noted[0].progressNotes.length, 1);
  assert.deepEqual(noted[0].progressNotes[0], { date: '2026-09-30', note: 'Reached 140 customers.' });
  assert.equal(addAnnualGoalNote(list, 'AG-1', '2026-02-29', 'Bad date.')[0].progressNotes.length, 0);
  assert.equal(addAnnualGoalNote(list, 'AG-1', '2026-09-30', '   ')[0].progressNotes.length, 0);
  assert.equal(addAnnualGoalNote(list, 'AG-9', '2026-09-30', 'Nope.')[0].progressNotes.length, 0);
});

test('goals are listed by year, newest first, then goal A-Z, then id A-Z', () => {
  const list = [
    goal({ id: 'AG-3', year: 2025, goal: 'Tidy the shop' }),
    goal({ id: 'AG-2', year: 2026, goal: 'Open a new mohalla' }),
    goal({ id: 'AG-1', year: 2026, goal: 'Grow the customer base' }),
  ];
  assert.deepEqual(annualGoalsSorted(list).map((item) => item.id), ['AG-1', 'AG-2', 'AG-3']);
});

test('past years stay as history and filter by year', () => {
  const list = [
    goal({ id: 'AG-1', year: 2026 }),
    goal({ id: 'AG-2', year: 2025, goal: 'Tidy the shop' }),
  ];
  assert.equal(annualGoalsForYear(list, 2025).length, 1);
  assert.equal(annualGoalsForYear(list, 2025)[0].id, 'AG-2');
  assert.equal(annualGoalsForYear(list, 2024).length, 0);
  assert.equal(annualGoalsForYear(list, 'bogus').length, 0);
});

test('status views', () => {
  const list = [
    goal({ id: 'AG-1', status: 'done' }),
    goal({ id: 'AG-2', status: 'in-progress', goal: 'Open a new mohalla' }),
    goal({ id: 'AG-3', status: 'not-started', goal: 'Tidy the shop' }),
  ];
  assert.deepEqual(annualGoalsByStatus(list, 'done').map((item) => item.id), ['AG-1']);
  assert.deepEqual(annualGoalsByStatus(list, 'in-progress').map((item) => item.id), ['AG-2']);
  assert.deepEqual(annualGoalsByStatus(list, 'bogus'), []);
});

test('summary text counts goals, years, and statuses', () => {
  assert.equal(annualGoalSummaryText([]), 'No annual goals recorded.');
  const list = [
    goal({ id: 'AG-1', status: 'done' }),
    goal({ id: 'AG-2', status: 'in-progress', goal: 'Open a new mohalla' }),
    goal({ id: 'AG-3', status: 'not-started', year: 2025, goal: 'Tidy the shop' }),
  ];
  assert.equal(
    annualGoalSummaryText(list),
    '3 annual goals across 2 years: 1 done, 1 in progress, 1 not started.',
  );
});

test('target is kept exactly as entered: no percentage, no score, no total', () => {
  const text = annualGoalText(goal());
  assert.match(text, /Target: 150 customers/);
  assert.doesNotMatch(text, /%/);
  const csv = annualGoalsCsv([goal()]);
  assert.doesNotMatch(csv, /total|percent|score/i);
  assert.match(csv, /150 customers/);
  assert.match(annualGoalText(goal({ target: '' })), /No target entered\./);
});

test('text, HTML escaping, and dated progress notes', () => {
  const entry = goal({ goal: '<b>Grow</b> & expand', progressNotes: [
    { date: '2026-06-30', note: 'Reached <120> customers & counting.' },
  ] });
  assert.match(annualGoalText(entry), /2026-06-30: Reached <120> customers & counting\./);
  const html = annualGoalHtml(entry);
  assert.doesNotMatch(html, /<b>Grow<\/b>/);
  assert.match(html, /&lt;b&gt;Grow&lt;\/b&gt;/);
  assert.match(html, /2026-06-30: Reached &lt;120&gt; customers &amp; counting\./);
  assert.match(annualGoalsAllHtml([entry]), /Grow/);
});

test('CSV columns and filename', () => {
  const csv = annualGoalsCsv([goal()]);
  const header = csv.split('\n')[0];
  assert.equal(header, '"id","year","goal","target","status","reviewNote","progressNotes"');
  assert.match(csv, /2026-06-30: Reached 120 customers\./);
  assert.equal(annualGoalsFilename(), 'annual-goals.csv');
});

test('inputs are never mutated', () => {
  const entry = goal();
  const before = JSON.stringify(entry);
  recordAnnualGoal([], entry);
  setAnnualGoalStatus([entry], 'AG-1', 'done');
  addAnnualGoalNote([entry], 'AG-1', '2026-09-30', 'Noted.');
  annualGoalsSorted([entry]);
  assert.equal(JSON.stringify(entry), before);
});

test('list normalization drops half-formed entries', () => {
  const list = normalizeAnnualGoalList([goal(), null, { id: 'AG-9' }, 'junk']);
  assert.equal(list.length, 1);
  assert.equal(normalizeAnnualGoalList('junk').length, 0);
});

test('purity fence: no imports, no storage, no clock, no fenced module', () => {
  assert.doesNotMatch(moduleSrc, /^\s*import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
  assert.doesNotMatch(moduleSrc, /from '\.\/(dashboard-collection-target|collection-forecaster)\.js'/);
  assert.match(moduleSrc, /shahdara_annual_goals_v1|annual goals tracker/i);
});

test('panel ids are present in index.html', () => {
  const ids = ['agBody', 'agSummary', 'agExportBtn', 'agYear', 'agGoal', 'agTarget',
    'agReviewNote', 'agSaveBtn', 'agRemoveId', 'agRemoveBtn', 'agYearFilter',
    'agStatusId', 'agStatus', 'agStatusBtn', 'agNoteId', 'agNoteDate', 'agNoteText', 'agNoteBtn'];
  for (const id of ids) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: store key, import, and render-loop call', () => {
  assert.ok(appJs.includes("shahdara_annual_goals_v1"), 'store key missing');
  assert.ok(appJs.includes("from './annual-goals.js'"), 'import missing');
  assert.ok(appJs.includes('renderAnnualGoals()'), 'render-loop call missing');
  assert.ok(appJs.includes('annualGoalsSorted'), 'sorted render missing');
  assert.ok(appJs.includes('annualGoalsCsv'), 'csv wiring missing');
});
