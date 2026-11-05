// Plan 244 — Site revisit authorisation note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validRevisitAuthorisationDate,
  normalizeRevisitAuthorisationList,
  recordRevisitAuthorisation,
  removeRevisitAuthorisation,
  findRevisitAuthorisation,
  supersedeRevisitAuthorisation,
  revisitAuthorisationSorted,
  revisitAuthorisationsInPeriod,
  revisitAuthorisationsForJob,
  revisitAuthorisationJobs,
  currentRevisitAuthorisationForJob,
  unauthorisedRevisits,
  revisitAuthorisationSummaryText,
  unauthorisedRevisitSummaryText,
  revisitAuthorisationText,
  revisitAuthorisationHtml,
  revisitAuthorisationCsv,
  revisitAuthorisationFilename,
} from '../revisit-authorisation.js';

const first = {
  id: 'RA-1',
  jobRef: 'JOB-101',
  reason: 'Signal still dropping after the first fix',
  authorisedBy: 'Owner',
  dateAuthorised: '2026-11-05',
  workAllowed: 'Replace the drop cable and re-test the signal',
};

const second = {
  id: 'RA-2',
  jobRef: 'job-102',
  reason: 'Customer reports the same fault again',
  authorisedBy: 'Saad',
  dateAuthorised: '2026-11-04',
  workAllowed: 'Re-check the joint and the splitter port',
};

test('half-formed authorisation notes are refused', () => {
  assert.equal(recordRevisitAuthorisation([], { ...first, id: '' }), null);
  assert.equal(recordRevisitAuthorisation([], { ...first, jobRef: '' }), null);
  assert.equal(
    recordRevisitAuthorisation([], { ...first, reason: '  ' }),
    null,
  );
  assert.equal(
    recordRevisitAuthorisation([], { ...first, authorisedBy: '' }),
    null,
  );
  assert.equal(
    recordRevisitAuthorisation([], { ...first, dateAuthorised: '2026-02-30' }),
    null,
  );
  assert.equal(
    recordRevisitAuthorisation([], { ...first, workAllowed: '' }),
    null,
  );
});

test('strict dates: leap days and month lengths', () => {
  assert.equal(validRevisitAuthorisationDate('2024-02-29'), true);
  assert.equal(validRevisitAuthorisationDate('2025-02-29'), false);
  assert.equal(validRevisitAuthorisationDate('2026-04-31'), false);
  assert.equal(validRevisitAuthorisationDate('2026-08-31'), true);
  assert.equal(validRevisitAuthorisationDate('2026-13-01'), false);
  assert.equal(validRevisitAuthorisationDate('05-11-2026'), false);
  assert.equal(validRevisitAuthorisationDate(''), false);
  assert.equal(validRevisitAuthorisationDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = {
    ...first,
    payment: 500,
    discount: '10%',
    extra: 'no',
    supersededBy: '',
    supersededDate: '',
  };
  const frozen = { ...input };
  const out = recordRevisitAuthorisation([], input);
  assert.equal(out.length, 1);
  assert.deepEqual(Object.keys(out[0]).sort(), [
    'authorisedBy',
    'dateAuthorised',
    'id',
    'jobRef',
    'reason',
    'supersededBy',
    'supersededDate',
    'workAllowed',
  ]);
  assert.deepEqual(input, frozen);
  const list = normalizeRevisitAuthorisationList([input, input]);
  assert.equal(list.length, 1);
});

test('duplicate ids are never rewritten', () => {
  const base = recordRevisitAuthorisation([], first);
  const again = recordRevisitAuthorisation(base, {
    ...first,
    reason: 'A different reason',
  });
  assert.equal(again.length, 1);
  assert.equal(again[0].reason, first.reason);
});

test('find and remove', () => {
  const base = recordRevisitAuthorisation(
    recordRevisitAuthorisation([], first),
    second,
  );
  assert.equal(findRevisitAuthorisation(base, 'RA-2').jobRef, 'job-102');
  assert.equal(findRevisitAuthorisation(base, 'RA-9'), null);
  assert.equal(removeRevisitAuthorisation(base, 'RA-1').length, 1);
  assert.equal(removeRevisitAuthorisation(base, 'RA-9').length, 2);
});

test('sorting is by date, then job, then id', () => {
  const base = normalizeRevisitAuthorisationList([
    second,
    first,
    { ...first, id: 'RA-3', dateAuthorised: '2026-11-05' },
  ]);
  const sorted = revisitAuthorisationSorted(base);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['RA-2', 'RA-1', 'RA-3'],
  );
});

test('period filter is inclusive on both ends', () => {
  const base = normalizeRevisitAuthorisationList([first, second]);
  const shown = revisitAuthorisationsInPeriod(
    base,
    '2026-11-04',
    '2026-11-04',
  );
  assert.deepEqual(
    shown.map((item) => item.id),
    ['RA-2'],
  );
  assert.equal(
    revisitAuthorisationsInPeriod(base, 'bad', 'also-bad').length,
    2,
  );
});

test('per-job listing is case-insensitive, jobs list keeps first spelling', () => {
  const base = normalizeRevisitAuthorisationList([
    first,
    { ...first, id: 'RA-3', jobRef: 'job-101' },
    second,
  ]);
  assert.equal(revisitAuthorisationsForJob(base, 'JOB-101').length, 2);
  assert.equal(revisitAuthorisationsForJob(base, '').length, 0);
  assert.deepEqual(revisitAuthorisationJobs(base), ['JOB-101', 'job-102']);
});

test('supersede records a dated newer note and never rewrites the old one', () => {
  const base = normalizeRevisitAuthorisationList([first]);
  const newer = {
    id: 'RA-9',
    jobRef: 'JOB-101',
    reason: 'Cable still failing, wider work needed',
    authorisedBy: 'Owner',
    dateAuthorised: '2026-11-06',
    workAllowed: 'Replace the drop cable and the fitting',
  };
  const out = supersedeRevisitAuthorisation(base, 'RA-1', newer, '2026-11-06');
  assert.notEqual(out, base);
  assert.equal(out.length, 2);
  const old = out.find((item) => item.id === 'RA-1');
  assert.equal(old.supersededBy, 'RA-9');
  assert.equal(old.supersededDate, '2026-11-06');
  assert.equal(old.reason, first.reason);
  assert.equal(old.workAllowed, first.workAllowed);
  const added = out.find((item) => item.id === 'RA-9');
  assert.equal(added.reason, newer.reason);
});

test('supersede refuses a wrong job, a bad date, an already-superseded note, and a duplicate new id', () => {
  const base = normalizeRevisitAuthorisationList([first]);
  const newer = {
    id: 'RA-9',
    jobRef: 'JOB-101',
    reason: 'Wider work needed',
    authorisedBy: 'Owner',
    dateAuthorised: '2026-11-06',
    workAllowed: 'Replace the fitting',
  };
  assert.equal(
    supersedeRevisitAuthorisation(base, 'RA-1', { ...newer, jobRef: 'JOB-999' }, '2026-11-06'),
    base,
  );
  assert.equal(
    supersedeRevisitAuthorisation(base, 'RA-1', newer, '2026-02-30'),
    base,
  );
  assert.equal(
    supersedeRevisitAuthorisation(base, 'RA-1', { ...newer, id: '' }, '2026-11-06'),
    base,
  );
  assert.equal(
    supersedeRevisitAuthorisation(base, 'RA-9', newer, '2026-11-06'),
    base,
  );
  const superseded = supersedeRevisitAuthorisation(
    base,
    'RA-1',
    newer,
    '2026-11-06',
  );
  assert.equal(
    supersedeRevisitAuthorisation(
      superseded,
      'RA-1',
      { ...newer, id: 'RA-10' },
      '2026-11-07',
    ),
    superseded,
  );
});

test('current authorisation is the latest note not yet superseded', () => {
  const base = normalizeRevisitAuthorisationList([first]);
  assert.equal(
    currentRevisitAuthorisationForJob(base, 'job-101').id,
    'RA-1',
  );
  const newer = {
    id: 'RA-9',
    jobRef: 'JOB-101',
    reason: 'Wider work needed',
    authorisedBy: 'Owner',
    dateAuthorised: '2026-11-06',
    workAllowed: 'Replace the fitting',
  };
  const superseded = supersedeRevisitAuthorisation(
    base,
    'RA-1',
    newer,
    '2026-11-06',
  );
  assert.equal(
    currentRevisitAuthorisationForJob(superseded, 'JOB-101').id,
    'RA-9',
  );
  assert.equal(currentRevisitAuthorisationForJob(base, 'JOB-999'), null);
});

test('revisits without an authorisation note are listed as exceptions', () => {
  const notes = normalizeRevisitAuthorisationList([first, second]);
  const revisits = [
    { jobRef: 'JOB-101', date: '2026-11-06' },
    { jobRef: 'JOB-102', date: '2026-11-05' },
    { jobRef: 'JOB-103', date: '2026-11-05' },
    { jobRef: 'job-103', date: '2026-11-05' },
    { jobRef: 'JOB-104', date: '2026-11-03' },
    { jobRef: '', date: '2026-11-05' },
    { jobRef: 'JOB-105', date: '2026-02-30' },
  ];
  const missing = unauthorisedRevisits(revisits, notes, '', '');
  assert.deepEqual(
    missing.map((row) => `${row.jobRef}@${row.date}`),
    ['JOB-104@2026-11-03', 'JOB-103@2026-11-05'],
  );
  // A note authorised after the revisit date does not cover it.
  const late = unauthorisedRevisits(
    [{ jobRef: 'JOB-101', date: '2026-11-04' }],
    notes,
    '',
    '',
  );
  assert.equal(late.length, 1);
  assert.equal(
    unauthorisedRevisits(revisits, notes, '2026-11-05', '2026-11-06').length,
    1,
  );
});

test('summary and note text name the job, authoriser, and work allowed', () => {
  const base = normalizeRevisitAuthorisationList([first, second]);
  assert.equal(
    revisitAuthorisationSummaryText(base),
    '2 site revisit authorisation notes for 2 jobs. 0 superseded by a newer note.',
  );
  assert.equal(
    revisitAuthorisationText(first),
    'Revisit JOB-101 — authorised 2026-11-05 by Owner — reason: Signal still dropping after the first fix — work allowed: Replace the drop cable and re-test the signal.',
  );
  assert.equal(revisitAuthorisationText({ ...first, jobRef: '' }), '');
  assert.equal(
    unauthorisedRevisitSummaryText([], base, '', ''),
    'No revisits without an authorisation note in the period.',
  );
  assert.match(
    unauthorisedRevisitSummaryText(
      [{ jobRef: 'JOB-103', date: '2026-11-05' }],
      base,
      '',
      '',
    ),
    /1 revisit without an authorisation note/,
  );
});

test('html escapes markup and csv exports one row per note', () => {
  const tricky = {
    ...first,
    reason: '<script>alert(1)</script>',
    workAllowed: 'Fix "the" joint & re-test',
  };
  const html = revisitAuthorisationHtml([tricky]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  assert.equal(revisitAuthorisationHtml([]), '<p>No site revisit authorisation notes.</p>');
  const csv = revisitAuthorisationCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(
    lines[0],
    '"id","job reference","reason","authorised by","date authorised","work allowed","superseded by","superseded date"',
  );
  assert.match(lines[1], /"RA-2","job-102"/);
  assert.equal(revisitAuthorisationFilename(), 'revisit-authorisations.csv');
});

test('list normalisation drops bad rows and keeps the first id', () => {
  const out = normalizeRevisitAuthorisationList([
    first,
    null,
    'nope',
    { ...first, id: 'RA-1', reason: 'Changed' },
    { ...second, dateAuthorised: '2026-02-30' },
    { ...second, supersededDate: 'not-a-date' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].reason, first.reason);
  assert.equal(out[1].supersededDate, '');
  assert.equal(normalizeRevisitAuthorisationList('nope').length, 0);
});

test('purity fence: no storage, clock, network, page, or imports', () => {
  const source = readFileSync(
    new URL('../revisit-authorisation.js', import.meta.url),
    'utf8',
  );
  for (const banned of [
    'localStorage',
    'sessionStorage',
    'new Date(',
    'Date.now(',
    'fetch(',
    'XMLHttpRequest',
    'document.',
  ]) {
    assert.doesNotMatch(source, new RegExp(banned.replace(/[().]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /import\s/);
});

test('neighbour-module fence: second-visit rule and fault revisit view are untouched', () => {
  const source = readFileSync(
    new URL('../revisit-authorisation.js', import.meta.url),
    'utf8',
  );
  for (const name of ['second-visit', 'fault-revisit']) {
    assert.doesNotMatch(source, new RegExp(name));
  }
  assert.equal(existsSync(new URL('../second-visit.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../fault-revisit.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'sraHeading',
    'sraSummary',
    'sraExceptions',
    'sraJobRef',
    'sraReason',
    'sraAuthorisedBy',
    'sraDateAuthorised',
    'sraWorkAllowed',
    'sraRecordBtn',
    'sraSupersedeId',
    'sraNewId',
    'sraNewJobRef',
    'sraNewReason',
    'sraNewAuthorisedBy',
    'sraNewDate',
    'sraNewWorkAllowed',
    'sraSupersedeBtn',
    'sraRemoveId',
    'sraRemoveBtn',
    'sraFilterJob',
    'sraFilterBtn',
    'sraPeriodFrom',
    'sraPeriodTo',
    'sraExceptionsBtn',
    'sraList',
    'sraRevisitList',
    'sraExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the site revisit authorisation panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /revisit-authorisation\.js/);
  assert.match(source, /renderRevisitAuthorisations/);
  assert.match(source, /sraRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
