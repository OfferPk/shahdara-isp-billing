// Plan 256 — Repeat-visit customer note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validRepeatVisitDate,
  normalizeRepeatVisitList,
  recordRepeatVisitNote,
  removeRepeatVisitNote,
  findRepeatVisitNote,
  addRepeatVisitFollowup,
  repeatVisitSorted,
  repeatVisitNotesForCustomer,
  repeatVisitCustomers,
  repeatVisitCountsForPeriod,
  flaggedRepeatVisitCustomers,
  repeatVisitSummaryText,
  repeatVisitText,
  repeatVisitHtml,
  repeatVisitCsv,
  repeatVisitFilename,
} from '../repeat-visit.js';

const first = {
  id: 'RV-1',
  customer: 'Ahmed Raza',
  periodFrom: '2026-10-01',
  periodTo: '2026-10-31',
  visitsCounted: 3,
  reasons: ['Weak signal after rain', 'ONU keeps restarting'],
  nextStep: 'Replace the drop cable and check the splitter port.',
  dateNoted: '2026-11-01',
};

const second = {
  id: 'RV-2',
  customer: 'Bilal Ahmed',
  periodFrom: '2026-10-01',
  periodTo: '2026-10-31',
  visitsCounted: 2,
  reasons: ['Bill confusion'],
  nextStep: 'Sit with the customer and walk through one bill.',
  dateNoted: '2026-11-02',
};

const sameCustomerLaterPeriod = {
  id: 'RV-3',
  customer: 'ahmed raza',
  periodFrom: '2026-11-01',
  periodTo: '2026-11-30',
  visitsCounted: 2,
  reasons: ['Slow speed in the evening'],
  nextStep: 'Check the shared segment load at peak hours.',
  dateNoted: '2026-12-01',
};

const visits = [
  { customer: 'Ahmed Raza', date: '2026-10-03' },
  { customer: 'Ahmed Raza', date: '2026-10-12' },
  { customer: 'ahmed raza', date: '2026-10-20' },
  { customer: 'Bilal Ahmed', date: '2026-10-05' },
  { customer: 'Bilal Ahmed', date: '2026-10-28' },
  { customer: 'Chaudhry Sahib', date: '2026-10-07' },
  { customer: 'Ahmed Raza', date: '2026-09-30' },
  { customer: 'Bilal Ahmed', date: '2026-11-02' },
];

test('half-formed notes are refused', () => {
  assert.deepEqual(recordRepeatVisitNote([], { ...first, id: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, customer: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, nextStep: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, dateNoted: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, periodFrom: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, periodTo: '' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, reasons: [] }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, reasons: ['  '] }), []);
  // One visit is not a repeat visit.
  assert.deepEqual(recordRepeatVisitNote([], { ...first, visitsCounted: 1 }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, visitsCounted: 0 }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, visitsCounted: 2.5 }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, visitsCounted: '3' }), []);
  // A period that runs backwards is refused.
  assert.deepEqual(recordRepeatVisitNote([], { ...first, periodFrom: '2026-10-31', periodTo: '2026-10-01' }), []);
  assert.equal(recordRepeatVisitNote([], { ...first, extraField: 'dropped' }).length, 1);
  assert.equal(recordRepeatVisitNote([], { ...first, extraField: 'dropped' })[0].extraField, undefined);
});

test('strict dates: bad dates and leap-year rules are refused', () => {
  assert.equal(validRepeatVisitDate('2026-02-29'), false);
  assert.equal(validRepeatVisitDate('2024-02-29'), true);
  assert.equal(validRepeatVisitDate('2026-11-31'), false);
  assert.equal(validRepeatVisitDate('2026-13-01'), false);
  assert.equal(validRepeatVisitDate('2026-11-01'), true);
  assert.equal(validRepeatVisitDate('2026/11/01'), false);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, periodFrom: '2026-02-30' }), []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, dateNoted: '2024-02-29' }).length, 1);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, unknown: 'x', followups: [{ date: '2026-11-02', note: 'Checked again.' }] };
  const frozen = JSON.parse(JSON.stringify(raw));
  const recorded = recordRepeatVisitNote([], raw);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].unknown, undefined);
  assert.deepEqual(raw, frozen);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, followups: [{ date: '2026-02-30', note: 'bad date' }] })[0].followups, []);
  assert.deepEqual(recordRepeatVisitNote([], { ...first, reasons: ['  Weak signal  ', '', 'ONU fault'] })[0].reasons, ['Weak signal', 'ONU fault']);
});

test('duplicate ids and a second note for the same customer in the same period are never rewritten', () => {
  const one = recordRepeatVisitNote([], first);
  assert.deepEqual(recordRepeatVisitNote(one, { ...first, nextStep: 'Changed.' }), one);
  assert.deepEqual(recordRepeatVisitNote(one, { ...first, id: 'RV-9' }), one);
  // The same customer in a later period gets its own note.
  assert.equal(recordRepeatVisitNote(one, sameCustomerLaterPeriod).length, 2);
  assert.deepEqual(
    normalizeRepeatVisitList([first, { ...first, id: 'RV-9' }, second]).map((item) => item.id),
    ['RV-1', 'RV-2'],
  );
});

test('find and remove', () => {
  const list = normalizeRepeatVisitList([first, second]);
  assert.equal(findRepeatVisitNote(list, 'RV-2').customer, 'Bilal Ahmed');
  assert.equal(findRepeatVisitNote(list, 'RV-9'), null);
  assert.equal(findRepeatVisitNote(list, ''), null);
  assert.deepEqual(removeRepeatVisitNote(list, 'RV-1').map((item) => item.id), ['RV-2']);
  assert.deepEqual(removeRepeatVisitNote(list, 'RV-9'), list);
});

test('sorting is by date noted, then customer, then id', () => {
  const list = normalizeRepeatVisitList([second, first]);
  assert.deepEqual(repeatVisitSorted(list).map((item) => item.id), ['RV-1', 'RV-2']);
  const sameDate = normalizeRepeatVisitList([
    { ...second, id: 'RV-9', customer: 'Aamir', dateNoted: '2026-11-01' },
    first,
  ]);
  assert.deepEqual(repeatVisitSorted(sameDate).map((item) => item.id), ['RV-9', 'RV-1']);
});

test('per-customer listing is case-insensitive and the customer list keeps the first spelling', () => {
  const list = normalizeRepeatVisitList([first, second, sameCustomerLaterPeriod]);
  assert.deepEqual(repeatVisitNotesForCustomer(list, 'AHMED RAZA').map((item) => item.id), ['RV-1', 'RV-3']);
  assert.deepEqual(repeatVisitNotesForCustomer(list, ''), []);
  assert.deepEqual(repeatVisitCustomers(list), ['Ahmed Raza', 'Bilal Ahmed']);
});

test('flagged customers list counts visits from the same records for the same period', () => {
  const flagged = flaggedRepeatVisitCustomers(visits, '2026-10-01', '2026-10-31');
  // Ahmed Raza has 3 visits in October (the 30 September and 2 November rows are outside).
  // Bilal Ahmed has 2. Chaudhry Sahib has 1 and is not flagged.
  assert.deepEqual(flagged, [
    { customer: 'Ahmed Raza', count: 3 },
    { customer: 'Bilal Ahmed', count: 2 },
  ]);
  // The count matches a direct count of the same rows.
  const counted = repeatVisitCountsForPeriod(visits, '2026-10-01', '2026-10-31');
  assert.deepEqual(counted.find((item) => item.customer === 'Ahmed Raza').count, 3);
  assert.deepEqual(counted.find((item) => item.customer === 'Chaudhry Sahib').count, 1);
  // A higher threshold flags fewer customers.
  assert.deepEqual(flaggedRepeatVisitCustomers(visits, '2026-10-01', '2026-10-31', 3), [
    { customer: 'Ahmed Raza', count: 3 },
  ]);
  // Bad rows and bad periods never produce a guess.
  assert.deepEqual(flaggedRepeatVisitCustomers([...visits, null, { customer: '', date: '2026-10-10' }, { customer: 'Ghost', date: '2026-02-30' }], '2026-10-01', '2026-10-31'), flagged);
  assert.deepEqual(flaggedRepeatVisitCustomers(visits, '2026-10-31', '2026-10-01'), []);
  assert.deepEqual(flaggedRepeatVisitCustomers(visits, '2026-02-30', '2026-10-31'), []);
  assert.deepEqual(flaggedRepeatVisitCustomers('not a list', '2026-10-01', '2026-10-31'), []);
  assert.deepEqual(flaggedRepeatVisitCustomers([], '2026-10-01', '2026-10-31'), []);
  // A period with no repeat visits flags nobody.
  assert.deepEqual(flaggedRepeatVisitCustomers(visits, '2026-09-01', '2026-09-30'), []);
});

test('a follow-up corrects only by a dated note and never rewrites the note', () => {
  const list = normalizeRepeatVisitList([first]);
  const noted = addRepeatVisitFollowup(list, 'RV-1', '2026-11-03', 'Drop cable replaced; watching for a week.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].customer, 'Ahmed Raza');
  assert.equal(noted[0].visitsCounted, 3);
  assert.deepEqual(noted[0].reasons, ['Weak signal after rain', 'ONU keeps restarting']);
  assert.equal(noted[0].nextStep, 'Replace the drop cable and check the splitter port.');
  assert.equal(noted[0].dateNoted, '2026-11-01');
  assert.deepEqual(addRepeatVisitFollowup(list, 'RV-1', '2026-02-30', 'bad date'), list);
  assert.deepEqual(addRepeatVisitFollowup(list, 'RV-9', '2026-11-03', 'unknown id'), list);
  assert.deepEqual(addRepeatVisitFollowup(list, 'RV-1', '2026-11-03', ''), list);
});

test('summary and entry text name the customer, the count, the period, and the next step', () => {
  assert.equal(repeatVisitSummaryText([]), 'No repeat-visit customer notes recorded.');
  assert.equal(repeatVisitSummaryText([first]), '1 repeat-visit note across 1 customer.');
  assert.equal(repeatVisitSummaryText([first, second]), '2 repeat-visit notes across 2 customers.');
  assert.equal(
    repeatVisitText(first),
    'Customer Ahmed Raza: 3 visits from 2026-10-01 to 2026-10-31. Reasons seen: Weak signal after rain; ONU keeps restarting. Suggested next step: Replace the drop cable and check the splitter port. Noted 2026-11-01.',
  );
  assert.equal(repeatVisitText({ ...first, customer: '' }), 'No repeat-visit customer note recorded.');
});

test('HTML is escaped', () => {
  const nasty = { ...first, customer: 'A & B', nextStep: '<script>alert(1)</script>' };
  const html = repeatVisitHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(repeatVisitHtml({ ...first, customer: '' }), '<p>No repeat-visit customer note recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = repeatVisitCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"id","customer","period from","period to","visits counted","reasons seen","suggested next step","date noted","follow-ups"');
  assert.equal(lines[1].includes('"Ahmed Raza"'), true);
  assert.equal(lines[1].includes('"3"'), true);
  assert.equal(lines[2].includes('"2"'), true);
  assert.equal(repeatVisitCsv([]), '"id","customer","period from","period to","visits counted","reasons seen","suggested next step","date noted","follow-ups"');
  assert.equal(repeatVisitFilename(), 'repeat-visit-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, nextStep: 'Changed.' }, { id: 'RV-9' }, null, 'nope', second];
  assert.deepEqual(normalizeRepeatVisitList(messy).map((item) => item.id), ['RV-1', 'RV-2']);
  assert.deepEqual(normalizeRepeatVisitList('not a list'), []);
  assert.deepEqual(normalizeRepeatVisitList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../repeat-visit.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the unresolved-ticket rule and the segment pattern view are untouched', () => {
  const source = readFileSync(new URL('../repeat-visit.js', import.meta.url), 'utf8');
  assert.equal(source.includes('second-visit'), false, 'module must not reference the unresolved-ticket rule module');
  assert.equal(source.includes('fault-revisit'), false, 'module must not reference the segment pattern view module');
  assert.equal(existsSync(new URL('../second-visit.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../fault-revisit.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'rvHeading', 'rvSummary', 'rvList', 'rvExportBtn',
    'rvCustomer', 'rvPeriodFrom', 'rvPeriodTo', 'rvVisitsCounted', 'rvReasons', 'rvNextStep', 'rvDateNoted', 'rvRecordBtn',
    'rvAnnotateId', 'rvAnnotateDate', 'rvAnnotateNote', 'rvAnnotateBtn',
    'rvRemoveId', 'rvRemoveBtn',
    'rvFilterCustomer', 'rvCustomerBtn', 'rvCustomerBody',
    'rvFlaggedFrom', 'rvFlaggedTo', 'rvFlaggedInput', 'rvFlaggedBtn', 'rvFlaggedBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the repeat-visit panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './repeat-visit.js'"), true);
  assert.equal(source.includes('renderRepeatVisitNotes()'), true);
  assert.equal(source.includes('REPEAT_VISIT_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
