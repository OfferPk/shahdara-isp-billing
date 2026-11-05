// Plan 251 — Field training note per technician.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validFieldTrainingDate,
  normalizeFieldTrainingList,
  recordFieldTraining,
  removeFieldTraining,
  findFieldTraining,
  annotateFieldTraining,
  fieldTrainingSorted,
  fieldTrainingForTechnician,
  fieldTrainingTechnicians,
  fieldTrainingSkillsForTechnician,
  technicianSkillStatus,
  unrecordedFieldSkills,
  fieldTrainingSummaryText,
  fieldTrainingText,
  fieldTrainingHtml,
  fieldTrainingCsv,
  fieldTrainingFilename,
} from '../field-training.js';

const first = {
  id: 'FT-1',
  technician: 'Saad',
  skill: 'Fibre splicing',
  date: '2026-11-05',
  observedBy: 'Owner',
  note: 'Practised a clean splice on a spare length.',
};

const second = {
  id: 'FT-2',
  technician: 'Saad',
  skill: 'ONU setup',
  date: '2026-11-03',
  observedBy: 'Owner',
  note: 'Set up an ONU end to end without help.',
};

const otherTech = {
  id: 'FT-3',
  technician: 'Bilal',
  skill: 'Fibre splicing',
  date: '2026-11-04',
  observedBy: 'Saad',
  note: 'Observed a splice and checked the loss reading.',
};

test('half-formed notes are refused', () => {
  assert.equal(recordFieldTraining([], { ...first, id: '' }), null);
  assert.equal(recordFieldTraining([], { ...first, technician: '  ' }), null);
  assert.equal(recordFieldTraining([], { ...first, skill: '' }), null);
  assert.equal(recordFieldTraining([], { ...first, date: '2026-11-32' }), null);
  assert.equal(recordFieldTraining([], { ...first, observedBy: '' }), null);
  assert.equal(recordFieldTraining([], { ...first, note: '' }), null);
  assert.equal(recordFieldTraining([], null), null);
  assert.equal(recordFieldTraining([], 'nope'), null);
});

test('strict dates: leap years and month lengths', () => {
  assert.equal(validFieldTrainingDate('2024-02-29'), true);
  assert.equal(validFieldTrainingDate('2025-02-29'), false);
  assert.equal(validFieldTrainingDate('2026-04-31'), false);
  assert.equal(validFieldTrainingDate('2026-11-05'), true);
  assert.equal(validFieldTrainingDate('2026-11-5'), false);
  assert.equal(validFieldTrainingDate(20261105), false);
  assert.equal(validFieldTrainingDate(''), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, billAmount: 500, customer: 'Someone', extra: 'x' };
  const frozen = JSON.parse(JSON.stringify(input));
  const out = recordFieldTraining([], input);
  assert.equal(out.length, 1);
  assert.equal('billAmount' in out[0], false);
  assert.equal('customer' in out[0], false);
  assert.equal('extra' in out[0], false);
  assert.deepEqual(input, frozen);
  assert.deepEqual(out[0].followUps, []);
});

test('duplicate ids are never rewritten', () => {
  const base = recordFieldTraining([], first);
  const again = recordFieldTraining(base, { ...second, id: 'FT-1' });
  assert.deepEqual(again, base);
});

test('one note per technician per skill', () => {
  const base = recordFieldTraining([], first);
  const repeat = recordFieldTraining(base, {
    id: 'FT-9',
    technician: 'saad',
    skill: 'fibre SPLICING',
    date: '2026-11-06',
    observedBy: 'Owner',
    note: 'A second splice session.',
  });
  assert.deepEqual(repeat, base);
  const otherSkill = recordFieldTraining(base, second);
  assert.equal(otherSkill.length, 2);
  const otherPerson = recordFieldTraining(base, otherTech);
  assert.equal(otherPerson.length, 2);
});

test('find and remove', () => {
  const base = recordFieldTraining(recordFieldTraining([], first), second);
  assert.deepEqual(findFieldTraining(base, 'FT-2'), {
    ...second,
    followUps: [],
  });
  assert.equal(findFieldTraining(base, 'FT-99'), null);
  assert.equal(removeFieldTraining(base, 'FT-1').length, 1);
  assert.equal(removeFieldTraining(base, 'FT-99').length, 2);
});

test('sorting: date, then technician, then skill, then id', () => {
  const list = recordFieldTraining(
    recordFieldTraining(recordFieldTraining([], otherTech), first),
    second,
  );
  assert.deepEqual(fieldTrainingSorted(list).map((item) => item.id), [
    'FT-2',
    'FT-3',
    'FT-1',
  ]);
});

test('per-technician listing is case-insensitive', () => {
  const list = recordFieldTraining(
    recordFieldTraining(recordFieldTraining([], otherTech), first),
    second,
  );
  assert.deepEqual(
    fieldTrainingForTechnician(list, 'SAAD').map((item) => item.id),
    ['FT-2', 'FT-1'],
  );
  assert.deepEqual(fieldTrainingForTechnician(list, 'Nobody'), []);
});

test('technician list keeps the first spelling', () => {
  const list = recordFieldTraining(
    recordFieldTraining(recordFieldTraining([], otherTech), first),
    second,
  );
  assert.deepEqual(fieldTrainingTechnicians(list), ['Bilal', 'Saad']);
});

test('skills list per technician with dates', () => {
  const list = recordFieldTraining(
    recordFieldTraining(recordFieldTraining([], otherTech), first),
    second,
  );
  assert.deepEqual(fieldTrainingSkillsForTechnician(list, 'Saad'), [
    {
      skill: 'Fibre splicing',
      date: '2026-11-05',
      observedBy: 'Owner',
      noteId: 'FT-1',
    },
    {
      skill: 'ONU setup',
      date: '2026-11-03',
      observedBy: 'Owner',
      noteId: 'FT-2',
    },
  ]);
  assert.deepEqual(fieldTrainingSkillsForTechnician(list, 'Nobody'), []);
});

test('a skill with no note is unrecorded, never trained', () => {
  const list = recordFieldTraining([], first);
  assert.deepEqual(technicianSkillStatus(list, 'Saad', 'Fibre splicing'), {
    status: 'recorded',
    date: '2026-11-05',
    observedBy: 'Owner',
    noteId: 'FT-1',
  });
  assert.deepEqual(technicianSkillStatus(list, 'Saad', 'Pole work'), {
    status: 'unrecorded',
    date: null,
    observedBy: null,
    noteId: null,
  });
  assert.deepEqual(technicianSkillStatus(list, 'Bilal', 'Fibre splicing'), {
    status: 'unrecorded',
    date: null,
    observedBy: null,
    noteId: null,
  });
  assert.deepEqual(
    unrecordedFieldSkills(list, 'Saad', [
      'Fibre splicing',
      'Pole work',
      'ONU setup',
    ]),
    ['Pole work', 'ONU setup'],
  );
  assert.deepEqual(unrecordedFieldSkills(list, 'Saad', 'nope'), []);
});

test('a note is never edited, only followed by a newer note', () => {
  const base = recordFieldTraining([], first);
  const withFollowUp = annotateFieldTraining(base, 'FT-1', {
    date: '2026-11-06',
    note: 'Repeated the splice on a live drop and it held.',
  });
  assert.equal(withFollowUp[0].technician, 'Saad');
  assert.equal(withFollowUp[0].skill, 'Fibre splicing');
  assert.equal(withFollowUp[0].date, '2026-11-05');
  assert.equal(withFollowUp[0].observedBy, 'Owner');
  assert.equal(withFollowUp[0].note, first.note);
  assert.deepEqual(withFollowUp[0].followUps, [
    { date: '2026-11-06', note: 'Repeated the splice on a live drop and it held.' },
  ]);
  assert.equal(annotateFieldTraining(base, 'FT-1', { date: 'bad', note: 'x' }), base);
  assert.equal(annotateFieldTraining(base, 'FT-1', { date: '2026-11-06', note: '' }), base);
  assert.equal(annotateFieldTraining(base, 'FT-99', { date: '2026-11-06', note: 'x' }), base);
  assert.equal(annotateFieldTraining(base, 'FT-1', null), base);
});

test('summary text', () => {
  assert.equal(fieldTrainingSummaryText([]), 'No field training notes recorded.');
  const list = recordFieldTraining(
    recordFieldTraining(recordFieldTraining([], otherTech), first),
    second,
  );
  assert.equal(
    fieldTrainingSummaryText(list),
    '3 training notes for 2 technicians. A skill with no note is unrecorded, never trained.',
  );
});

test('note text with follow-up state', () => {
  assert.equal(
    fieldTrainingText(first),
    'Saad practised Fibre splicing on 2026-11-05, observed by Owner. Practised a clean splice on a spare length. No dated follow-up notes yet.',
  );
  const withFollowUp = annotateFieldTraining(recordFieldTraining([], first), 'FT-1', {
    date: '2026-11-06',
    note: 'Repeated the splice on a live drop and it held.',
  });
  assert.equal(
    fieldTrainingText(withFollowUp[0]),
    'Saad practised Fibre splicing on 2026-11-05, observed by Owner. Practised a clean splice on a spare length. 1 dated follow-up note, latest 2026-11-06.',
  );
  assert.equal(fieldTrainingText({ ...first, skill: '' }), '');
});

test('HTML escaping', () => {
  const tricky = recordFieldTraining([], {
    ...first,
    technician: 'Saad <b>',
    note: 'Splice <script> checked.',
  });
  const html = fieldTrainingHtml(tricky);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(fieldTrainingHtml([]), '<p>No field training notes recorded.</p>');
});

test('CSV and filename', () => {
  const list = recordFieldTraining(
    recordFieldTraining([], first),
    second,
  );
  const csv = fieldTrainingCsv(list);
  assert.equal(
    csv.split('\n')[0],
    '"id","technician","skill","date","observed by","note","dated follow-up notes"',
  );
  assert.equal(csv.split('\n').length, 3);
  assert.equal(csv.includes('FT-1'), true);
  assert.equal(fieldTrainingFilename(), 'field-training-notes.csv');
});

test('list normalisation', () => {
  assert.deepEqual(normalizeFieldTrainingList('nope'), []);
  assert.deepEqual(normalizeFieldTrainingList(null), []);
  assert.deepEqual(
    normalizeFieldTrainingList([first, { ...first }, { ...first, id: 'FT-2', skill: '' }]),
    [{ ...first, followUps: [] }],
  );
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(
    new URL('../field-training.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('document.'), false);
});

test('neighbour-module fence: collector onboarding checklist is untouched', () => {
  const source = readFileSync(
    new URL('../field-training.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('collector-onboarding'), false);
  assert.equal(source.includes('onboarding-checklist'), false);
  assert.equal(existsSync(new URL('../collector-onboarding.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'ftList',
    'ftSummary',
    'ftTechnician',
    'ftSkill',
    'ftDate',
    'ftObservedBy',
    'ftNote',
    'ftRecordBtn',
    'ftAnnotateId',
    'ftAnnotateDate',
    'ftAnnotateNote',
    'ftAnnotateBtn',
    'ftRemoveId',
    'ftRemoveBtn',
    'ftFilterTechnician',
    'ftTechBtn',
    'ftTechBody',
    'ftSkillCheckTechnician',
    'ftSkillCheckSkill',
    'ftSkillCheckBtn',
    'ftSkillCheckBody',
    'ftExportBtn',
  ]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wires the field training panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './field-training.js'"), true);
  assert.equal(source.includes('renderFieldTraining()'), true);
  assert.equal(source.includes('FIELD_TRAINING_KEY'), true);
  assert.equal(source.includes('fieldTrainingSorted'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
