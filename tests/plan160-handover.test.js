import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeHandover,
  normalizeHandoverList,
  normalizeHandoverJob,
  findHandover,
  upsertHandover,
  removeHandover,
  handoverJobs,
  handoverOpenJobs,
  handoversForPerson,
  handoverPeople,
  handoverSummaryText,
  handoverAllHtml,
  handoverPersonHtml,
  handoverCsv,
  handoverFilename,
} from '../handover.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'HO-1',
  date: '2026-11-03',
  from: 'Saad',
  to: 'Bilal',
  jobs: [
    { description: 'Fix drop cable, Mohalla A', status: 'open' },
    { description: 'Collect from shop 12', status: 'done' },
  ],
  warnings: 'Aggressive dog at lane 3',
  ...over,
});

test('half-formed refusal: no from, no to, no date, or no id refused', () => {
  assert.equal(normalizeHandover(note({ from: '' })), null);
  assert.equal(normalizeHandover(note({ from: '   ' })), null);
  assert.equal(normalizeHandover(note({ to: '' })), null);
  assert.equal(normalizeHandover(note({ date: '' })), null);
  assert.equal(normalizeHandover(note({ id: '' })), null);
  assert.equal(normalizeHandover(null), null);
  assert.equal(normalizeHandover('nope'), null);
});

test('strict dates: impossible dates refused, real 31-day months and leap days pass', () => {
  assert.equal(normalizeHandover(note({ date: '2026-02-30' })), null);
  assert.equal(normalizeHandover(note({ date: '2026-04-31' })), null);
  assert.equal(normalizeHandover(note({ date: '2026-13-01' })), null);
  assert.equal(normalizeHandover(note({ date: '2026-02-29' })), null);
  assert.ok(normalizeHandover(note({ date: '2026-08-31' })));
  assert.ok(normalizeHandover(note({ date: '2026-10-31' })));
  assert.ok(normalizeHandover(note({ date: '2026-12-31' })));
  assert.ok(normalizeHandover(note({ date: '2024-02-29' })));
});

test('job normalization: strings become open jobs, missing status defaults to open', () => {
  assert.deepEqual(normalizeHandoverJob('Check ONU'), { description: 'Check ONU', status: 'open' });
  assert.equal(normalizeHandoverJob('   '), null);
  assert.deepEqual(
    normalizeHandoverJob({ description: '  Fix pole ', status: ' In-Progress ' }),
    { description: 'Fix pole', status: 'in-progress' },
  );
  assert.deepEqual(
    normalizeHandoverJob({ description: 'Collect dues' }),
    { description: 'Collect dues', status: 'open' },
  );
  assert.equal(normalizeHandoverJob({ status: 'open' }), null);
  assert.equal(normalizeHandoverJob(42), null);
  assert.deepEqual(normalizeHandover(note({ jobs: 'not a list' })).jobs, []);
  assert.deepEqual(normalizeHandover(note({ jobs: ['A', { description: '' }, { description: 'B', status: 'done' }] })).jobs, [
    { description: 'A', status: 'open' },
    { description: 'B', status: 'done' },
  ]);
});

test('warnings are optional and whitespace is trimmed', () => {
  const noWarnings = normalizeHandover(note({ warnings: undefined }));
  assert.equal(noWarnings.warnings, '');
  const trimmed = normalizeHandover(note({ from: '  Saad ', to: ' Bilal ' }));
  assert.equal(trimmed.from, 'Saad');
  assert.equal(trimmed.to, 'Bilal');
});

test('unknown fields are dropped, never stored', () => {
  const clean = normalizeHandover(note({ ticketId: 'T-9', billId: 'B-9', payment: 500, visitId: 'V-1' }));
  assert.equal('ticketId' in clean, false);
  assert.equal('billId' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('visitId' in clean, false);
  assert.deepEqual(Object.keys(clean).sort(), ['date', 'from', 'id', 'jobs', 'to', 'warnings']);
});

test('duplicate ids never rewritten', () => {
  const list = [note()];
  assert.deepEqual(upsertHandover(list, note()), list);
  assert.deepEqual(upsertHandover(list, note({ warnings: 'Different warning' })), list);
  assert.equal(upsertHandover(list, note({ id: 'HO-2' })).length, 2);
});

test('find and remove by id', () => {
  const list = [note(), note({ id: 'HO-2', from: 'Bilal', to: 'Saad' })];
  assert.equal(findHandover(list, 'HO-2').to, 'Saad');
  assert.equal(findHandover(list, 'HO-9'), null);
  assert.deepEqual(removeHandover(list, 'HO-1').map((item) => item.id), ['HO-2']);
  assert.deepEqual(removeHandover(list, 'HO-9'), normalizeHandoverList(list));
});

test('handover jobs keep recorded order; unknown handover gives empty list', () => {
  const list = [note()];
  assert.deepEqual(handoverJobs(list, 'HO-1').map((job) => job.description), [
    'Fix drop cable, Mohalla A',
    'Collect from shop 12',
  ]);
  assert.deepEqual(handoverJobs(list, 'HO-9'), []);
  assert.deepEqual(handoverJobs([], 'HO-1'), []);
});

test('open jobs filter: only status open, in recorded order', () => {
  const list = [note()];
  assert.deepEqual(handoverOpenJobs(list, 'HO-1').map((job) => job.description), ['Fix drop cable, Mohalla A']);
  const allDone = [note({ jobs: [{ description: 'Done job', status: 'done' }] })];
  assert.deepEqual(handoverOpenJobs(allDone, 'HO-1'), []);
});

test('handovers for a person: from or to, case-insensitive, newest first', () => {
  const list = [
    note({ id: 'HO-1', date: '2026-11-01' }),
    note({ id: 'HO-2', date: '2026-11-03', from: 'Bilal', to: 'Saad' }),
    note({ id: 'HO-3', date: '2026-11-02', from: 'Usman', to: 'Ali' }),
  ];
  assert.deepEqual(handoversForPerson(list, 'saad').map((item) => item.id), ['HO-2', 'HO-1']);
  assert.deepEqual(handoversForPerson(list, 'Bilal').map((item) => item.id), ['HO-2', 'HO-1']);
  assert.deepEqual(handoversForPerson(list, ''), []);
  assert.deepEqual(handoversForPerson(list, 'Nobody'), []);
});

test('people list: A-Z by lowercase, first spelling kept', () => {
  const list = [
    note({ from: 'saad', to: 'Bilal' }),
    note({ id: 'HO-2', from: 'Saad', to: 'Ali' }),
  ];
  assert.deepEqual(handoverPeople(list), ['Ali', 'Bilal', 'saad']);
});

test('summary text counts notes, people, and open jobs', () => {
  assert.equal(
    handoverSummaryText([note()]),
    '1 field handover note across 2 persons, 1 open job listed.',
  );
  assert.equal(handoverSummaryText([]), '0 field handover notes across 0 persons, 0 open jobs listed.');
});

test('all HTML newest first with jobs, status, and warnings', () => {
  const list = [note({ id: 'HO-1', date: '2026-11-01' }), note({ id: 'HO-2', date: '2026-11-03' })];
  const html = handoverAllHtml(list);
  assert.ok(html.indexOf('HO-2') < html.indexOf('HO-1'));
  assert.ok(html.includes('Fix drop cable, Mohalla A'));
  assert.ok(html.includes('Aggressive dog at lane 3'));
  assert.equal(handoverAllHtml([]), '<p>No field handover notes recorded yet.</p>');
});

test('person HTML shows only that person’s handovers', () => {
  const list = [note(), note({ id: 'HO-2', from: 'Bilal', to: 'Saad' })];
  const html = handoverPersonHtml(list, 'Saad');
  assert.ok(html.includes('HO-1') && html.includes('HO-2'));
  assert.equal(handoverPersonHtml(list, 'Nobody'), '<p>No handovers recorded for this person yet.</p>');
});

test('HTML escaping: names, jobs, and warnings are escaped', () => {
  const evil = note({ from: '<script>alert(1)</script>', warnings: 'A & B <b>bold</b>' });
  const html = handoverAllHtml([evil]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('CSV export and filename', () => {
  const csv = handoverCsv([note()]);
  assert.ok(csv.startsWith('id,date,from,to,jobs,warnings'));
  assert.ok(csv.includes('HO-1,2026-11-03,Saad,Bilal'));
  assert.ok(csv.includes('Fix drop cable, Mohalla A [open]; Collect from shop 12 [done]'));
  assert.equal(handoverFilename(), 'field-handovers.csv');
});

test('non-mutation: upsert and remove leave the input list untouched', () => {
  const list = [note()];
  const snapshot = JSON.stringify(list);
  upsertHandover(list, note({ id: 'HO-2' }));
  removeHandover(list, 'HO-1');
  assert.equal(JSON.stringify(list), snapshot);
});

test('purity fence: module imports nothing and reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'handover.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('Date.now'));
  assert.ok(!source.includes('new Date('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['handoverDate', 'handoverFrom', 'handoverTo', 'handoverJobs', 'handoverWarnings', 'handoverSaveBtn', 'handoverRemoveId', 'handoverRemoveBtn', 'handoverFilter', 'handoverPersonBody', 'handoverBody', 'handoverSummary', 'handoverExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
