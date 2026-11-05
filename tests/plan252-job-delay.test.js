// Plan 252 — Job delay reason log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validJobDelayDate,
  daysBetweenJobDelayDates,
  normalizeJobDelayList,
  recordJobDelay,
  removeJobDelay,
  findJobDelay,
  annotateJobDelay,
  jobDelaySorted,
  jobDelaysForReason,
  jobDelayReasons,
  jobDelaysInPeriod,
  jobDelayReasonCounts,
  jobDelaySummaryText,
  jobDelayText,
  jobDelayHtml,
  jobDelayCsv,
  jobDelayFilename,
} from '../job-delay.js';

const first = {
  id: 'JD-1',
  jobRef: 'JOB-101',
  plannedDate: '2026-11-01',
  actualDate: '2026-11-04',
  reason: 'Waiting for material',
};

const second = {
  id: 'JD-2',
  jobRef: 'JOB-102',
  plannedDate: '2026-11-02',
  actualDate: '2026-11-03',
  reason: 'Customer unavailable',
};

const third = {
  id: 'JD-3',
  jobRef: 'JOB-103',
  plannedDate: '2026-11-05',
  actualDate: '2026-11-07',
  reason: 'waiting for MATERIAL',
};

test('half-formed entries are refused', () => {
  assert.equal(recordJobDelay([], { ...first, id: '' }), null);
  assert.equal(recordJobDelay([], { ...first, jobRef: '  ' }), null);
  assert.equal(recordJobDelay([], { ...first, plannedDate: '2026-11-32' }), null);
  assert.equal(recordJobDelay([], { ...first, actualDate: '2026-13-01' }), null);
  assert.equal(recordJobDelay([], { ...first, reason: '' }), null);
  assert.equal(recordJobDelay([], null), null);
  assert.equal(recordJobDelay([], 'nope'), null);
});

test('strict dates: leap years and month lengths', () => {
  assert.equal(validJobDelayDate('2024-02-29'), true);
  assert.equal(validJobDelayDate('2025-02-29'), false);
  assert.equal(validJobDelayDate('2026-04-31'), false);
  assert.equal(validJobDelayDate('2026-11-05'), true);
  assert.equal(validJobDelayDate('2026-11-5'), false);
  assert.equal(validJobDelayDate(20261105), false);
  assert.equal(validJobDelayDate(''), false);
});

test('days delayed is counted from the two dates', () => {
  assert.equal(daysBetweenJobDelayDates('2026-11-01', '2026-11-04'), 3);
  assert.equal(daysBetweenJobDelayDates('2026-11-01', '2026-11-02'), 1);
  assert.equal(daysBetweenJobDelayDates('2026-10-30', '2026-11-02'), 3);
  assert.equal(daysBetweenJobDelayDates('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetweenJobDelayDates('2026-11-04', '2026-11-01'), -3);
  assert.equal(daysBetweenJobDelayDates('2026-11-32', '2026-11-04'), null);
  const list = recordJobDelay([], first);
  assert.equal(list[0].daysDelayed, 3);
});

test('a job done on time is not a delay and cannot be recorded', () => {
  assert.equal(
    recordJobDelay([], { ...first, actualDate: '2026-11-01' }),
    null,
  );
  assert.equal(
    recordJobDelay([], { ...first, actualDate: '2026-10-31' }),
    null,
  );
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, billAmount: 500, customer: 'Someone', extra: 'x' };
  const frozen = JSON.parse(JSON.stringify(input));
  const out = recordJobDelay([], input);
  assert.equal(out.length, 1);
  assert.equal('billAmount' in out[0], false);
  assert.equal('customer' in out[0], false);
  assert.equal('extra' in out[0], false);
  assert.deepEqual(input, frozen);
  assert.deepEqual(out[0].followUps, []);
});

test('duplicate ids are never rewritten', () => {
  const base = recordJobDelay([], first);
  const again = recordJobDelay(base, { ...second, id: 'JD-1' });
  assert.deepEqual(again, base);
});

test('find and remove', () => {
  const base = recordJobDelay(recordJobDelay([], first), second);
  assert.deepEqual(findJobDelay(base, 'JD-2'), {
    ...second,
    daysDelayed: 1,
    followUps: [],
  });
  assert.equal(findJobDelay(base, 'JD-99'), null);
  assert.equal(removeJobDelay(base, 'JD-1').length, 1);
  assert.equal(removeJobDelay(base, 'JD-99').length, 2);
});

test('sorting: planned date, then job reference, then id', () => {
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  assert.deepEqual(jobDelaySorted(list).map((item) => item.id), [
    'JD-1',
    'JD-2',
    'JD-3',
  ]);
});

test('delayed jobs list by reason is case-insensitive', () => {
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  assert.deepEqual(
    jobDelaysForReason(list, 'WAITING FOR MATERIAL').map((item) => item.id),
    ['JD-1', 'JD-3'],
  );
  assert.deepEqual(jobDelaysForReason(list, 'Weather'), []);
});

test('reason list keeps the first spelling', () => {
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  assert.deepEqual(jobDelayReasons(list), [
    'Customer unavailable',
    'waiting for MATERIAL',
  ]);
});

test('reason counts sum to the total delayed jobs in the same period', () => {
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  const all = jobDelayReasonCounts(list);
  assert.deepEqual(all.rows, [
    { reason: 'waiting for MATERIAL', count: 2 },
    { reason: 'Customer unavailable', count: 1 },
  ]);
  assert.equal(all.total, 3);
  assert.equal(
    all.rows.reduce((sum, row) => sum + row.count, 0),
    all.total,
  );
  const november = jobDelayReasonCounts(list, '2026-11-01', '2026-11-03');
  assert.deepEqual(november.rows, [
    { reason: 'Customer unavailable', count: 1 },
    { reason: 'Waiting for material', count: 1 },
  ]);
  assert.equal(november.total, 2);
  assert.equal(
    november.rows.reduce((sum, row) => sum + row.count, 0),
    november.total,
  );
  const empty = jobDelayReasonCounts(list, '2026-12-01', '2026-12-31');
  assert.deepEqual(empty, { rows: [], total: 0 });
  assert.equal(jobDelayReasonCounts(list, 'bad', '2026-11-30'), null);
  assert.equal(jobDelayReasonCounts(list, '2026-11-01', 'bad'), null);
});

test('period filter is inclusive on both ends', () => {
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  assert.deepEqual(
    jobDelaysInPeriod(list, '2026-11-02', '2026-11-05').map((item) => item.id),
    ['JD-2', 'JD-3'],
  );
  assert.deepEqual(jobDelaysInPeriod(list, '2026-12-01', '2026-12-31'), []);
  assert.equal(jobDelaysInPeriod(list, 'bad', '2026-11-30'), null);
});

test('an entry is never edited, only corrected by a dated follow-up note', () => {
  const base = recordJobDelay([], first);
  const withFollowUp = annotateJobDelay(base, 'JD-1', {
    date: '2026-11-05',
    note: 'Material arrived late from the supplier, job done the next day.',
  });
  assert.equal(withFollowUp[0].jobRef, 'JOB-101');
  assert.equal(withFollowUp[0].plannedDate, '2026-11-01');
  assert.equal(withFollowUp[0].actualDate, '2026-11-04');
  assert.equal(withFollowUp[0].reason, 'Waiting for material');
  assert.equal(withFollowUp[0].daysDelayed, 3);
  assert.deepEqual(withFollowUp[0].followUps, [
    {
      date: '2026-11-05',
      note: 'Material arrived late from the supplier, job done the next day.',
    },
  ]);
  assert.equal(annotateJobDelay(base, 'JD-1', { date: 'bad', note: 'x' }), base);
  assert.equal(annotateJobDelay(base, 'JD-1', { date: '2026-11-05', note: '' }), base);
  assert.equal(annotateJobDelay(base, 'JD-99', { date: '2026-11-05', note: 'x' }), base);
  assert.equal(annotateJobDelay(base, 'JD-1', null), base);
});

test('summary text', () => {
  assert.equal(jobDelaySummaryText([]), 'No delayed jobs recorded.');
  const list = recordJobDelay(
    recordJobDelay(recordJobDelay([], third), first),
    second,
  );
  assert.equal(
    jobDelaySummaryText(list),
    '3 delayed jobs logged across 2 reasons. Reason counts sum to the total delayed jobs in the same period.',
  );
});

test('entry text with follow-up state', () => {
  assert.equal(
    jobDelayText(first),
    'Job JOB-101 was planned for 2026-11-01 and done on 2026-11-04, 3 days late. Reason: Waiting for material. No dated follow-up notes yet.',
  );
  const withFollowUp = annotateJobDelay(recordJobDelay([], first), 'JD-1', {
    date: '2026-11-05',
    note: 'Material arrived late from the supplier.',
  });
  assert.equal(
    jobDelayText(withFollowUp[0]),
    'Job JOB-101 was planned for 2026-11-01 and done on 2026-11-04, 3 days late. Reason: Waiting for material. 1 dated follow-up note, latest 2026-11-05.',
  );
  assert.equal(jobDelayText({ ...first, reason: '' }), '');
});

test('HTML escaping', () => {
  const tricky = recordJobDelay([], {
    ...first,
    jobRef: 'JOB-<b>',
    reason: 'Waiting <script> for material.',
  });
  const html = jobDelayHtml(tricky);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(jobDelayHtml([]), '<p>No delayed jobs recorded.</p>');
});

test('CSV and filename', () => {
  const list = recordJobDelay(recordJobDelay([], first), second);
  const csv = jobDelayCsv(list);
  assert.equal(
    csv.split('\n')[0],
    '"id","job reference","planned date","actual date","delay reason","days delayed","dated follow-up notes"',
  );
  assert.equal(csv.split('\n').length, 3);
  assert.equal(csv.includes('JD-1'), true);
  assert.equal(jobDelayFilename(), 'job-delay-reasons.csv');
});

test('list normalisation', () => {
  assert.deepEqual(normalizeJobDelayList('nope'), []);
  assert.deepEqual(normalizeJobDelayList(null), []);
  assert.deepEqual(
    normalizeJobDelayList([first, { ...first }, { ...first, id: 'JD-2', reason: '' }]),
    [{ ...first, daysDelayed: 3, followUps: [] }],
  );
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../job-delay.js', import.meta.url), 'utf8');
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('document.'), false);
});

test('neighbour-module fence: visit time, job checklist and job cost records are untouched', () => {
  const source = readFileSync(new URL('../job-delay.js', import.meta.url), 'utf8');
  assert.equal(source.includes('visit-times'), false);
  assert.equal(source.includes('job-checklist'), false);
  assert.equal(source.includes('job-cost'), false);
  assert.equal(existsSync(new URL('../visit-times.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../job-checklist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../job-cost.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'jdList',
    'jdSummary',
    'jdJobRef',
    'jdPlannedDate',
    'jdActualDate',
    'jdReason',
    'jdRecordBtn',
    'jdAnnotateId',
    'jdAnnotateDate',
    'jdAnnotateNote',
    'jdAnnotateBtn',
    'jdRemoveId',
    'jdRemoveBtn',
    'jdFilterReason',
    'jdReasonBtn',
    'jdReasonBody',
    'jdCountsBody',
    'jdPeriodFrom',
    'jdPeriodTo',
    'jdPeriodBtn',
    'jdPeriodBody',
    'jdExportBtn',
  ]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wires the job delay panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './job-delay.js'"), true);
  assert.equal(source.includes('renderJobDelays()'), true);
  assert.equal(source.includes('JOB_DELAY_KEY'), true);
  assert.equal(source.includes('jobDelaySorted'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
