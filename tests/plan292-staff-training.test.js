import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validStaffTrainingDate,
  normalizeStaffTraining,
  normalizeStaffTrainingList,
  findStaffTraining,
  recordStaffTraining,
  removeStaffTraining,
  staffTrainingSorted,
  staffTrainingForStaff,
  staffTrainingStaffList,
  staffTrainingForTopic,
  staffTrainingSummaryText,
  staffTrainingEntryText,
  staffTrainingEntryHtml,
  staffTrainingStaffHtml,
  staffTrainingAllHtml,
  staffTrainingCsv,
  staffTrainingFilename,
} from '../staff-training.js';

const first = {
  id: 'TR-1',
  staffMember: 'Saad',
  topic: 'New ONU setup',
  date: '2026-11-03',
  trainer: 'Aqib',
  outcome: 'Completed',
};
const second = {
  id: 'TR-2',
  staffMember: 'Saad',
  topic: 'Billing steps',
  date: '2026-11-10',
  trainer: 'Aqib',
  outcome: 'Needs practice',
};
const third = {
  id: 'TR-3',
  staffMember: 'Bilal',
  topic: 'Safety steps',
  date: '2026-10-28',
  trainer: 'Aqib',
  outcome: '',
};
const fourth = {
  id: 'TR-4',
  staffMember: 'saad',
  topic: 'New ONU setup',
  date: '2026-11-03',
  trainer: 'Aqib',
  outcome: 'Completed',
};
const fixture = [third, first, fourth, second];

test('half-formed records are refused', () => {
  assert.equal(normalizeStaffTraining(null), null);
  assert.equal(normalizeStaffTraining([]), null);
  assert.equal(normalizeStaffTraining({ ...first, id: '  ' }), null);
  assert.equal(normalizeStaffTraining({ ...first, staffMember: '' }), null);
  assert.equal(normalizeStaffTraining({ ...first, topic: '' }), null);
  assert.equal(normalizeStaffTraining({ ...first, date: '' }), null);
  assert.equal(normalizeStaffTraining({ ...first, date: '2026-13-01' }), null);
  assert.equal(normalizeStaffTraining({ ...first, date: '03-11-2026' }), null);
  assert.equal(normalizeStaffTraining({ ...first, trainer: '' }), null);
  assert.deepEqual(normalizeStaffTraining(first), first);
});

test('strict dates: only real calendar dates pass', () => {
  assert.equal(validStaffTrainingDate('2024-02-29'), true);
  assert.equal(validStaffTrainingDate('2025-02-29'), false);
  assert.equal(validStaffTrainingDate('2026-04-31'), false);
  assert.equal(validStaffTrainingDate('2026-04-30'), true);
  assert.equal(validStaffTrainingDate('2026-00-10'), false);
  assert.equal(validStaffTrainingDate('2026-11-00'), false);
  assert.equal(validStaffTrainingDate('2026-11-32'), false);
  assert.equal(validStaffTrainingDate(20261103), false);
  assert.equal(validStaffTrainingDate('2026-11-3'), false);
});

test('outcome is plain words and optional', () => {
  const { outcome, ...noOutcome } = first;
  const clean = normalizeStaffTraining(noOutcome);
  assert.equal(clean.outcome, '');
  assert.equal(staffTrainingEntryText(clean), 'Saad — New ONU setup — 2026-11-03 — trainer Aqib');
  assert.equal(staffTrainingEntryText(first), 'Saad — New ONU setup — 2026-11-03 — trainer Aqib — Completed');
  assert.equal(normalizeStaffTraining({ ...first, outcome: '  Passed with help  ' }).outcome, 'Passed with help');
});

test('unknown fields are dropped and the input is never mutated', () => {
  const raw = { ...first, bill: 1000, payment: 'cash', customer: 'Ali', extra: true };
  const before = JSON.stringify(raw);
  const clean = normalizeStaffTraining(raw);
  assert.deepEqual(Object.keys(clean).sort(), ['date', 'id', 'outcome', 'staffMember', 'topic', 'trainer']);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordStaffTraining([first], { ...first, topic: 'Different topic' });
  assert.equal(list.length, 1);
  assert.equal(list[0].topic, 'New ONU setup');
  assert.deepEqual(normalizeStaffTrainingList([first, { ...first, topic: 'Other' }]).length, 1);
});

test('find and remove', () => {
  assert.deepEqual(findStaffTraining(fixture, 'TR-2'), second);
  assert.equal(findStaffTraining(fixture, 'TR-9'), null);
  assert.equal(findStaffTraining(fixture, ''), null);
  assert.deepEqual(removeStaffTraining(fixture, 'TR-1').map((entry) => entry.id), ['TR-3', 'TR-4', 'TR-2']);
  assert.deepEqual(removeStaffTraining(fixture, 'TR-9').map((entry) => entry.id), ['TR-3', 'TR-1', 'TR-4', 'TR-2']);
});

test('sorting is by date, then staff member A-Z, then id', () => {
  assert.deepEqual(staffTrainingSorted(fixture).map((entry) => entry.id), ['TR-3', 'TR-1', 'TR-4', 'TR-2']);
  assert.deepEqual(staffTrainingSorted([second, first]).map((entry) => entry.id), ['TR-1', 'TR-2']);
});

test('training for one staff member, in date order, case-insensitive', () => {
  assert.deepEqual(staffTrainingForStaff(fixture, 'SAAD').map((entry) => entry.id), ['TR-1', 'TR-4', 'TR-2']);
  assert.deepEqual(staffTrainingForStaff(fixture, 'Bilal').map((entry) => entry.id), ['TR-3']);
  assert.deepEqual(staffTrainingForStaff(fixture, ''), []);
  assert.deepEqual(staffTrainingForStaff(fixture, 'Nobody'), []);
});

test('staff list keeps the first spelling, A-Z', () => {
  assert.deepEqual(staffTrainingStaffList(fixture), ['Bilal', 'Saad']);
  assert.deepEqual(staffTrainingStaffList([]), []);
});

test('training on one topic, in date order, case-insensitive', () => {
  assert.deepEqual(staffTrainingForTopic(fixture, 'new onu setup').map((entry) => entry.id), ['TR-1', 'TR-4']);
  assert.deepEqual(staffTrainingForTopic(fixture, 'Safety steps').map((entry) => entry.id), ['TR-3']);
  assert.deepEqual(staffTrainingForTopic(fixture, ''), []);
});

test('summary text names the latest training date', () => {
  assert.equal(staffTrainingSummaryText([]), 'No staff training recorded.');
  assert.equal(staffTrainingSummaryText([first]), '1 staff training record recorded. Latest training on 2026-11-03.');
  assert.equal(staffTrainingSummaryText(fixture), '4 staff training records recorded. Latest training on 2026-11-10.');
});

test('entry text for a half-formed record', () => {
  assert.equal(staffTrainingEntryText(null), 'No staff training recorded.');
  assert.equal(staffTrainingEntryText(third), 'Bilal — Safety steps — 2026-10-28 — trainer Aqib');
});

test('HTML escapes input and names the staff member', () => {
  const nasty = { ...first, staffMember: '<b>Saad</b>', topic: 'A & B' };
  assert.equal(staffTrainingEntryHtml(nasty).includes('<b>'), false);
  assert.equal(staffTrainingEntryHtml(nasty).includes('&lt;b&gt;Saad&lt;/b&gt;'), true);
  assert.equal(staffTrainingEntryHtml(nasty).includes('A &amp; B'), true);
  assert.equal(staffTrainingEntryHtml(null), '<p>No staff training recorded.</p>');
  const html = staffTrainingStaffHtml(fixture, 'Saad');
  assert.equal(html.includes('Saad — 3 training sessions recorded.'), true);
  assert.equal(html.includes('Billing steps'), true);
  assert.equal(staffTrainingStaffHtml(fixture, 'Nobody'), '<p>No training recorded for Nobody.</p>');
  assert.equal(staffTrainingAllHtml([]), '<p>No staff training recorded.</p>');
  assert.equal(staffTrainingAllHtml([first]).includes('New ONU setup'), true);
});

test('CSV export and filename', () => {
  const csv = staffTrainingCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","staff member","topic","date","trainer","outcome"');
  assert.equal(csv.includes('"TR-1","Saad","New ONU setup","2026-11-03","Aqib","Completed"'), true);
  assert.equal(csv.split('\n').length, 5);
  assert.equal(staffTrainingFilename(), 'staff-training.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeStaffTrainingList(null), []);
  assert.deepEqual(normalizeStaffTrainingList('nope'), []);
  assert.deepEqual(normalizeStaffTrainingList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../staff-training.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: field-skills training and onboarding records are untouched', () => {
  const source = readFileSync(new URL('../staff-training.js', import.meta.url), 'utf8');
  assert.equal(source.includes('field-training.js'), false, 'module must not reference the field-skills training module');
  assert.equal(source.includes('onboarding-checklist.js'), false, 'module must not reference the onboarding checklist module');
  assert.equal(source.includes('collector-onboarding.js'), false, 'module must not reference the collector onboarding module');
  assert.equal(existsSync(new URL('../field-training.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../onboarding-checklist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../collector-onboarding.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'tnHeading', 'tnSummary', 'tnExportBtn', 'tnStaffMember', 'tnTopic',
    'tnDate', 'tnTrainer', 'tnOutcome', 'tnRecordBtn', 'tnRemoveId',
    'tnRemoveBtn', 'tnStaffFilter', 'tnStaffBtn', 'tnStaffBody', 'tnBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the staff training panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './staff-training.js'"), true);
  assert.equal(source.includes('renderStaffTraining()'), true);
  assert.equal(source.includes('loadStaffTraining()'), true);
  assert.equal(source.includes('shahdara_staff_training_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
