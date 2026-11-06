import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as printQueueLogModule from '../print-queue-log.js';
import {
  validPrintQueueJobDay,
  foldPrintQueueJobStatus,
  normalizePrintQueueJob,
  normalizePrintQueueJobList,
  recordPrintQueueJob,
  markPrintQueueJobPrinted,
  markPrintQueueJobFailed,
  printQueueOpenJobs,
  printQueueJobCounts,
  printQueueJobSummaryText,
  printQueueJobText,
  printQueueJobsText,
  printQueueJobHtml,
  printQueueJobsHtml,
  printQueueOpenJobsHtml,
  printQueueJobCsv,
  printQueueJobFilename,
} from '../print-queue-log.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'print-queue-log.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const JOB_A = {
  id: 'PQ-1', documentRef: 'RCPT-41-202611-01', templateRef: 'RCPT-T1',
  queuedDate: '2026-11-05', status: 'queued', printedDate: '', retryNote: '',
};
const JOB_B = {
  id: 'PQ-2', documentRef: 'RCPT-42-202611-01', templateRef: 'RCPT-T1',
  queuedDate: '2026-11-06', status: 'printed', printedDate: '2026-11-06', retryNote: '',
};
const JOB_C = {
  id: 'PQ-3', documentRef: 'SHEET-NOV-01', templateRef: 'LEDGER-T1',
  queuedDate: '2026-11-04', status: 'failed', printedDate: '', retryNote: 'printer jammed',
};

test('valid day: strict calendar dates only', () => {
  assert.equal(validPrintQueueJobDay('2026-11-05'), true);
  assert.equal(validPrintQueueJobDay('2028-02-29'), true);
  assert.equal(validPrintQueueJobDay('2026-02-29'), false);
  assert.equal(validPrintQueueJobDay('2026-02-30'), false);
  assert.equal(validPrintQueueJobDay('2026-13-01'), false);
  assert.equal(validPrintQueueJobDay('2026-11-31'), false);
  assert.equal(validPrintQueueJobDay('tomorrow'), false);
  assert.equal(validPrintQueueJobDay('05-11-2026'), false);
  assert.equal(validPrintQueueJobDay(''), false);
  assert.equal(validPrintQueueJobDay(null), false);
  assert.equal(validPrintQueueJobDay(20261105), false);
});

test('status folds plain spellings, unknown reads queued', () => {
  assert.equal(foldPrintQueueJobStatus('queued'), 'queued');
  assert.equal(foldPrintQueueJobStatus('PRINTED'), 'printed');
  assert.equal(foldPrintQueueJobStatus('Done'), 'printed');
  assert.equal(foldPrintQueueJobStatus('Failed'), 'failed');
  assert.equal(foldPrintQueueJobStatus('error'), 'failed');
  assert.equal(foldPrintQueueJobStatus('something else'), 'queued');
  assert.equal(foldPrintQueueJobStatus(''), 'queued');
  assert.equal(foldPrintQueueJobStatus(null), 'queued');
});

test('normalize keeps a valid job with every field', () => {
  assert.deepEqual(normalizePrintQueueJob(JOB_B), JOB_B);
  assert.deepEqual(normalizePrintQueueJob({ ...JOB_A, status: 'QUEUED' }), JOB_A);
  assert.deepEqual(normalizePrintQueueJob({ ...JOB_C, extra: 'dropped' }), JOB_C);
});

test('normalize refuses a half-formed job', () => {
  assert.equal(normalizePrintQueueJob({ ...JOB_A, id: '' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, id: '   ' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, documentRef: '' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, queuedDate: '2026-02-30' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, queuedDate: 'next week' }), null);
  assert.equal(normalizePrintQueueJob(null), null);
  assert.equal(normalizePrintQueueJob('PQ-1'), null);
});

test('normalize refuses a printed job with no printed date or an early printed date', () => {
  assert.equal(normalizePrintQueueJob({ ...JOB_A, status: 'printed' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, status: 'printed', printedDate: '2026-11-04' }), null);
  assert.equal(normalizePrintQueueJob({ ...JOB_A, status: 'printed', printedDate: 'not a date' }), null);
  assert.deepEqual(
    normalizePrintQueueJob({ ...JOB_A, status: 'printed', printedDate: '2026-11-05' }),
    { ...JOB_A, status: 'printed', printedDate: '2026-11-05' },
  );
});

test('normalize drops a printed date on a queued or failed job', () => {
  assert.deepEqual(
    normalizePrintQueueJob({ ...JOB_A, printedDate: '2026-11-05' }),
    JOB_A,
  );
  assert.deepEqual(
    normalizePrintQueueJob({ ...JOB_C, printedDate: '2026-11-05' }),
    JOB_C,
  );
});

test('normalize list keeps only valid jobs', () => {
  assert.deepEqual(normalizePrintQueueJobList([JOB_A, { ...JOB_B, id: '' }, JOB_C, null]), [JOB_A, JOB_C]);
  assert.deepEqual(normalizePrintQueueJobList('not a list'), []);
  assert.deepEqual(normalizePrintQueueJobList(null), []);
});

test('record adds a job and never rewrites a duplicate id', () => {
  const after = recordPrintQueueJob([], JOB_A);
  assert.deepEqual(after, [JOB_A]);
  const again = recordPrintQueueJob(after, { ...JOB_A, documentRef: 'RCPT-99-202611-01' });
  assert.deepEqual(again, [JOB_A]);
  assert.equal(recordPrintQueueJob(after, { ...JOB_A, id: 'PQ-9', queuedDate: 'bad' }), after);
});

test('mark printed sets the date on only that job', () => {
  const list = [JOB_A, JOB_B, JOB_C];
  const after = markPrintQueueJobPrinted(list, 'PQ-1', '2026-11-06');
  assert.equal(after[0].status, 'printed');
  assert.equal(after[0].printedDate, '2026-11-06');
  assert.deepEqual(after[1], JOB_B);
  assert.deepEqual(after[2], JOB_C);
  assert.equal(list[0].status, 'queued');
});

test('mark printed refuses a missing job, a bad date, an early date, or an already printed job', () => {
  const list = [JOB_A, JOB_B, JOB_C];
  assert.equal(markPrintQueueJobPrinted(list, 'PQ-9', '2026-11-06'), list);
  assert.equal(markPrintQueueJobPrinted(list, 'PQ-1', 'not a date'), list);
  assert.equal(markPrintQueueJobPrinted(list, 'PQ-1', '2026-11-04'), list);
  assert.equal(markPrintQueueJobPrinted(list, 'PQ-2', '2026-11-07'), list);
});

test('mark failed sets the retry note on only that job', () => {
  const list = [JOB_A, JOB_B];
  const after = markPrintQueueJobFailed(list, 'PQ-1', 'printer out of paper');
  assert.equal(after[0].status, 'failed');
  assert.equal(after[0].retryNote, 'printer out of paper');
  assert.deepEqual(after[1], JOB_B);
});

test('mark failed refuses a missing job or an already printed job', () => {
  const list = [JOB_A, JOB_B];
  assert.equal(markPrintQueueJobFailed(list, 'PQ-9', 'jammed'), list);
  assert.equal(markPrintQueueJobFailed(list, 'PQ-2', 'jammed'), list);
});

test('open jobs are queued and failed only, oldest queued first', () => {
  const open = printQueueOpenJobs([JOB_B, JOB_A, JOB_C]);
  assert.deepEqual(open.map((job) => job.id), ['PQ-3', 'PQ-1']);
  assert.deepEqual(printQueueOpenJobs([JOB_B]), []);
  assert.deepEqual(printQueueOpenJobs([]), []);
});

test('counts reconcile to the total', () => {
  const counts = printQueueJobCounts([JOB_A, JOB_B, JOB_C]);
  assert.deepEqual(counts, { total: 3, queued: 1, printed: 1, failed: 1 });
  assert.equal(counts.total, counts.queued + counts.printed + counts.failed);
  assert.deepEqual(printQueueJobCounts([]), { total: 0, queued: 0, printed: 0, failed: 0 });
});

test('summary text names the counts in plain words', () => {
  assert.equal(printQueueJobSummaryText([]), 'No print jobs logged.');
  assert.equal(printQueueJobSummaryText([JOB_A]), '1 print job: 1 queued, 0 printed, 0 failed.');
  assert.equal(
    printQueueJobSummaryText([JOB_A, JOB_B, JOB_C]),
    '3 print jobs: 1 queued, 1 printed, 1 failed.',
  );
});

test('plain text names the document and the status', () => {
  assert.equal(printQueueJobText(JOB_A), 'RCPT-41-202611-01 — queued on 2026-11-05; template RCPT-T1');
  assert.equal(printQueueJobText(JOB_B), 'RCPT-42-202611-01 — printed on 2026-11-06; queued 2026-11-06; template RCPT-T1');
  assert.equal(printQueueJobText(JOB_C), 'SHEET-NOV-01 — failed; queued 2026-11-04; template LEDGER-T1 — retry: printer jammed');
  assert.equal(printQueueJobText({ ...JOB_A, id: '' }), '');
  const text = printQueueJobsText([JOB_B, JOB_A]);
  assert.equal(text, `${printQueueJobText(JOB_A)}\n${printQueueJobText(JOB_B)}`);
  assert.equal(printQueueJobsText([]), 'No print jobs logged.');
});

test('html escapes user text and the open list shows queued and failed jobs only', () => {
  const nasty = { ...JOB_A, documentRef: '<script>alert(1)</script>' };
  const html = printQueueJobHtml(nasty);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(printQueueJobHtml({ ...JOB_A, id: '' }), '');
  assert.ok(printQueueJobsHtml([]).includes('No print jobs logged yet.'));
  const openHtml = printQueueOpenJobsHtml([JOB_A, JOB_B, JOB_C]);
  assert.ok(openHtml.includes('RCPT-41-202611-01'));
  assert.ok(openHtml.includes('SHEET-NOV-01'));
  assert.ok(!openHtml.includes('RCPT-42-202611-01'));
  assert.ok(printQueueOpenJobsHtml([JOB_B]).includes('No queued or failed print jobs.'));
});

test('csv carries the header and one row per job, filename is fixed', () => {
  const csv = printQueueJobCsv([JOB_A, JOB_B]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,documentRef,templateRef,queuedDate,status,printedDate,retryNote');
  assert.equal(lines[1], 'PQ-1,RCPT-41-202611-01,RCPT-T1,2026-11-05,queued,,');
  assert.equal(lines[2], 'PQ-2,RCPT-42-202611-01,RCPT-T1,2026-11-06,printed,2026-11-06,');
  assert.equal(printQueueJobFilename(), 'print-queue-log.csv');
});

test('inputs are never mutated, even on a deep-frozen fixture', () => {
  const frozen = deepFreeze([JOB_A, JOB_B, JOB_C]);
  const before = JSON.stringify(frozen);
  recordPrintQueueJob(frozen, { id: 'PQ-4', documentRef: 'RCPT-43', templateRef: '', queuedDate: '2026-11-07', status: 'queued' });
  markPrintQueueJobPrinted(frozen, 'PQ-1', '2026-11-06');
  markPrintQueueJobFailed(frozen, 'PQ-1', 'jammed');
  printQueueOpenJobs(frozen);
  printQueueJobCounts(frozen);
  printQueueJobSummaryText(frozen);
  printQueueJobsText(frozen);
  printQueueJobsHtml(frozen);
  printQueueOpenJobsHtml(frozen);
  printQueueJobCsv(frozen);
  assert.equal(JSON.stringify(frozen), before);
});

test('module is pure: no page, storage, clock, network, or behaviour change', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(printQueueLogModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change/i.test(name)));
});

test('fence: module never names the existing print template file', () => {
  assert.ok(!moduleSrc.includes('print-template-register'));
});

test('wiring: app.js imports the module, renders it, and stores it under the pql key', () => {
  assert.ok(appJs.includes("from './print-queue-log.js'"));
  assert.ok(appJs.includes('renderPrintQueueLog()'));
  assert.ok(appJs.includes('shahdara_pql_jobs_v1'));
  assert.ok(appJs.includes('printQueueJobSummaryText'));
  assert.ok(!/renderPrintQueueLog\(\)\s*;\s*renderPrintQueueLog\(\)/.test(appJs));
});

test('wiring: index.html carries the pql panel after the Plan 343 panel', () => {
  assert.ok(indexHtml.includes('id="pqlHeading"'));
  assert.ok(indexHtml.includes('id="pqlBody"'));
  assert.ok(indexHtml.includes('id="pqlSummary"'));
  assert.ok(indexHtml.includes('id="pqlSaveBtn"'));
  assert.ok(indexHtml.includes('id="pqlPrintedBtn"'));
  assert.ok(indexHtml.includes('id="pqlFailedBtn"'));
  assert.ok(indexHtml.indexOf('id="dcnHeading"') < indexHtml.indexOf('id="pqlHeading"'));
});
