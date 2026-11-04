import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeOutcome,
  normalizeDrill,
  normalizeDrillList,
  findDrill,
  recordDrill,
  removeDrill,
  noteDrillFollowUp,
  drillsSorted,
  drillsByOutcome,
  failedDrillsOpen,
  drillsForBackup,
  drillSummaryText,
  drillText,
  drillHtml,
  drillAllHtml,
  drillCsv,
  drillFilename,
} from '../restore-drill.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'restore-drill.js'), 'utf8');

function drill(overrides = {}) {
  return {
    id: 'RD-1',
    drillDate: '2026-10-05',
    backupRef: 'backup-2026-10-05.json',
    practisedBy: 'Saad',
    outcome: 'success',
    issuesFound: '',
    followUpNote: '',
    ...overrides,
  };
}

test('half-formed drills are refused', () => {
  assert.equal(normalizeDrill(null), null);
  assert.equal(normalizeDrill(drill({ id: '' })), null);
  assert.equal(normalizeDrill(drill({ drillDate: '' })), null);
  assert.equal(normalizeDrill(drill({ backupRef: '' })), null);
  assert.equal(normalizeDrill(drill({ practisedBy: '' })), null);
  assert.equal(normalizeDrill(drill({ drillDate: 'not-a-date' })), null);
});

test('strict calendar dates: 31-day months and Feb 29 leap/non-leap', () => {
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-10-31'), '2026-10-31');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2026-13-01'), null);
  assert.equal(normalizeDate('2026-00-10'), null);
  assert.equal(normalizeDate('2026-1-5'), null);
});

test('unknown outcome falls back to failed, never to success', () => {
  assert.equal(normalizeOutcome('success'), 'success');
  assert.equal(normalizeOutcome('partial'), 'partial');
  assert.equal(normalizeOutcome('SUCCESS'), 'success');
  assert.equal(normalizeOutcome('done'), 'failed');
  assert.equal(normalizeOutcome(''), 'failed');
  assert.equal(normalizeOutcome(undefined), 'failed');
  assert.equal(normalizeDrill(drill({ outcome: 'done' })).outcome, 'failed');
});

test('unknown fields are dropped, so no backup content or payment field can creep in', () => {
  const clean = normalizeDrill(drill({
    backupContent: '{ "customers": [] }',
    billId: 'B-9',
    paymentId: 'P-9',
    customerId: 'C-9',
    sendTo: 'someone',
  }));
  assert.deepEqual(Object.keys(clean).sort(), [
    'backupRef', 'drillDate', 'followUpNote', 'id', 'issuesFound', 'outcome', 'practisedBy',
  ]);
});

test('duplicate ids are never rewritten', () => {
  const first = recordDrill([], drill());
  const again = recordDrill(first, drill({ practisedBy: 'Other' }));
  assert.equal(again.length, 1);
  assert.equal(again[0].practisedBy, 'Saad');
});

test('find and remove', () => {
  const list = recordDrill(recordDrill([], drill()), drill({ id: 'RD-2', drillDate: '2026-10-06' }));
  assert.equal(findDrill(list, 'RD-2').backupRef, 'backup-2026-10-05.json');
  assert.equal(findDrill(list, 'RD-9'), null);
  assert.equal(findDrill(list, ''), null);
  assert.deepEqual(removeDrill(list, 'RD-1').map((d) => d.id), ['RD-2']);
  assert.equal(removeDrill(list, 'RD-9').length, 2);
});

test('note follow-up records only the note; an empty note leaves the record unchanged', () => {
  const list = recordDrill([], drill({ outcome: 'failed', issuesFound: 'Restore stopped halfway' }));
  const noted = noteDrillFollowUp(list, 'RD-1', 'Retry with the next backup');
  assert.equal(noted[0].followUpNote, 'Retry with the next backup');
  assert.equal(noted[0].outcome, 'failed');
  assert.equal(noted[0].issuesFound, 'Restore stopped halfway');
  assert.deepEqual(noteDrillFollowUp(list, 'RD-1', '   '), list);
  assert.deepEqual(noteDrillFollowUp(list, 'RD-9', 'Note'), list);
});

test('failed drills stay in history after a follow-up is noted', () => {
  const list = recordDrill([], drill({ outcome: 'failed' }));
  const noted = noteDrillFollowUp(list, 'RD-1', 'Checked the file, retry planned');
  assert.equal(noted.length, 1);
  assert.equal(failedDrillsOpen(noted).length, 0);
});

test('drills sort newest first, then id A-Z', () => {
  const list = [
    drill({ id: 'RD-2', drillDate: '2026-10-05' }),
    drill({ id: 'RD-1', drillDate: '2026-10-05' }),
    drill({ id: 'RD-3', drillDate: '2026-09-01' }),
  ];
  assert.deepEqual(drillsSorted(list).map((d) => d.id), ['RD-1', 'RD-2', 'RD-3']);
});

test('outcome views and the failed-awaiting-follow-up view', () => {
  const list = [
    drill({ id: 'RD-1', outcome: 'success' }),
    drill({ id: 'RD-2', outcome: 'partial', drillDate: '2026-10-06' }),
    drill({ id: 'RD-3', outcome: 'failed', drillDate: '2026-10-07' }),
    drill({ id: 'RD-4', outcome: 'failed', drillDate: '2026-10-08', followUpNote: 'Retried ok' }),
  ];
  assert.deepEqual(drillsByOutcome(list, 'failed').map((d) => d.id), ['RD-4', 'RD-3']);
  assert.deepEqual(drillsByOutcome(list, 'success').map((d) => d.id), ['RD-1']);
  assert.deepEqual(failedDrillsOpen(list).map((d) => d.id), ['RD-3']);
});

test('backup filter matches case-insensitively, empty query lists all', () => {
  const list = [
    drill({ id: 'RD-1', backupRef: 'October-Backup.json' }),
    drill({ id: 'RD-2', backupRef: 'september.json', drillDate: '2026-09-01' }),
  ];
  assert.deepEqual(drillsForBackup(list, 'october').map((d) => d.id), ['RD-1']);
  assert.equal(drillsForBackup(list, '').length, 2);
});

test('summary text names the recorded count and the open failed count', () => {
  const list = [
    drill({ id: 'RD-1', outcome: 'failed' }),
    drill({ id: 'RD-2', outcome: 'success', drillDate: '2026-10-06' }),
  ];
  assert.equal(drillSummaryText(list), '2 restore drills recorded, 1 failed awaiting follow-up');
  assert.equal(drillSummaryText([]), '0 restore drills recorded, 0 failed awaiting follow-up');
});

test('drill text states date, outcome, backup reference, and practiser', () => {
  const out = drillText(drill({ issuesFound: 'Slow import', followUpNote: 'Check again' }));
  assert.match(out, /2026-10-05 \[success\] backup: backup-2026-10-05\.json, practised by Saad/);
  assert.match(out, /Issues found: Slow import/);
  assert.match(out, /Follow-up: Check again/);
  assert.equal(drillText(null), '');
  assert.equal(drillText(drill({ issuesFound: '', followUpNote: '' })).split('\n').length, 1);
});

test('HTML escapes user text', () => {
  const html = drillHtml(drill({ backupRef: '<b>evil</b>', issuesFound: '<script>' }));
  assert.doesNotMatch(html, /<b>evil<\/b>/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;b&gt;evil&lt;\/b&gt;/);
  assert.equal(drillHtml(null), '');
  assert.match(drillAllHtml([drill()]), /backup-2026-10-05\.json/);
});

test('CSV columns and filename', () => {
  const csv = drillCsv([drill({ outcome: 'partial', issuesFound: 'a "quoted" note' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","drillDate","backupRef","practisedBy","outcome","issuesFound","followUpNote"');
  assert.match(lines[1], /"a ""quoted"" note"/);
  assert.equal(drillFilename(), 'restore-drills.csv');
});

test('inputs are never mutated', () => {
  const raw = drill({ outcome: 'bogus' });
  const before = JSON.stringify(raw);
  normalizeDrill(raw);
  recordDrill([], raw);
  noteDrillFollowUp([raw], 'RD-1', 'Note');
  assert.equal(JSON.stringify(raw), before);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const list = normalizeDrillList([
    drill(),
    drill({ practisedBy: '' }),
    drill({ backupRef: 'other.json' }),
    'not an object',
  ]);
  assert.deepEqual(list.map((d) => d.id), ['RD-1']);
  assert.equal(normalizeDrillList('nope').length, 0);
});

test('purity fence: the module imports nothing and reads no other record', () => {
  const code = moduleSrc.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /^import\s/m);
  assert.doesNotMatch(code, /localStorage|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(code, /backup-verification|backup-health|backup-store/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['rdBody', 'rdSummary', 'rdDate', 'rdBackup', 'rdBy', 'rdOutcome', 'rdIssues', 'rdSaveBtn', 'rdFollowId', 'rdFollowNote', 'rdFollowBtn', 'rdRemoveId', 'rdRemoveBtn', 'rdFilter', 'rdExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the restore-drill store and panel', () => {
  assert.ok(appJs.includes("from './restore-drill.js'"));
  assert.ok(appJs.includes('shahdara_restore_drills_v1'));
  assert.ok(appJs.includes('renderRestoreDrills()'));
});
