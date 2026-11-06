import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validReportSchedulingNoteDay,
  foldReportSchedulingNoteCycle,
  normalizeReportSchedulingNote,
  normalizeReportSchedulingNoteList,
  recordReportSchedulingNote,
  reportSchedulingNoteForReport,
  reportSchedulingNoteOverdue,
  reportSchedulingNoteDueList,
  markReportSchedulingNoteProduced,
  reportSchedulingNoteCounts,
  reportSchedulingNoteSummaryText,
  reportSchedulingNoteText,
  reportSchedulingNoteDueText,
  reportSchedulingNoteHtml,
  reportSchedulingNotesHtml,
  reportSchedulingNoteDueHtml,
  reportSchedulingNoteCsv,
  reportSchedulingNoteFilename,
} from '../report-scheduling-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'report-scheduling-note.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const NOTE_A = { id: 'RSN-1', reportName: 'Monthly collections summary', cycle: 'monthly', nextDueDate: '2026-11-15', recipients: 'Owner + accountant', owner: 'Saad' };
const NOTE_B = { id: 'RSN-2', reportName: 'Quarterly mohalla review', cycle: 'quarterly', nextDueDate: '2026-11-05', recipients: 'Owner', owner: 'Bike', lastProducedDate: '2026-08-05' };
const NOTE_C = { id: 'RSN-3', reportName: 'Weekly field expenses', cycle: 'weekly', nextDueDate: '2026-11-10', recipients: '', owner: 'Saad' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validReportSchedulingNoteDay('2026-11-05'), true);
  assert.equal(validReportSchedulingNoteDay('2028-02-29'), true);
  assert.equal(validReportSchedulingNoteDay('2026-02-29'), false);
  assert.equal(validReportSchedulingNoteDay('2026-04-31'), false);
  assert.equal(validReportSchedulingNoteDay('2026-13-01'), false);
  assert.equal(validReportSchedulingNoteDay('2026-00-10'), false);
  assert.equal(validReportSchedulingNoteDay('2026-11-5'), false);
  assert.equal(validReportSchedulingNoteDay('05-11-2026'), false);
  assert.equal(validReportSchedulingNoteDay(''), false);
  assert.equal(validReportSchedulingNoteDay(null), false);
  assert.equal(validReportSchedulingNoteDay(20261105), false);
});

test('cycle folds weekly, monthly, quarterly, yearly; unknown reads null', () => {
  assert.equal(foldReportSchedulingNoteCycle('monthly'), 'monthly');
  assert.equal(foldReportSchedulingNoteCycle('MONTHLY'), 'monthly');
  assert.equal(foldReportSchedulingNoteCycle('  Quarterly '), 'quarterly');
  assert.equal(foldReportSchedulingNoteCycle('weekly'), 'weekly');
  assert.equal(foldReportSchedulingNoteCycle('yearly'), 'yearly');
  assert.equal(foldReportSchedulingNoteCycle('daily'), null);
  assert.equal(foldReportSchedulingNoteCycle('every month'), null);
  assert.equal(foldReportSchedulingNoteCycle(''), null);
  assert.equal(foldReportSchedulingNoteCycle(null), null);
});

test('normalize trims fields and drops unknown fields', () => {
  const note = normalizeReportSchedulingNote({ ...NOTE_A, extra: 'ignored', owner: '  Saad  ', recipients: ' Owner + accountant ' });
  assert.deepEqual(note, { ...NOTE_A, lastProducedDate: '' });
});

test('normalize refuses half-formed notes', () => {
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, id: '' }), null);
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, reportName: '   ' }), null);
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, cycle: 'daily' }), null);
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, nextDueDate: '2026-02-29' }), null);
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, owner: '' }), null);
  assert.equal(normalizeReportSchedulingNote({ ...NOTE_A, lastProducedDate: 'not a date' }), null);
  assert.equal(normalizeReportSchedulingNote(null), null);
  assert.equal(normalizeReportSchedulingNote('Monthly collections summary'), null);
});

test('record adds a note and a duplicate id never rewrites it', () => {
  const added = recordReportSchedulingNote([], NOTE_A);
  assert.deepEqual(added, [{ ...NOTE_A, lastProducedDate: '' }]);
  const again = recordReportSchedulingNote(added, { ...NOTE_A, nextDueDate: '2026-12-15' });
  assert.equal(again.length, 1);
  assert.equal(again[0].nextDueDate, '2026-11-15');
});

test('record refuses a half-formed note and leaves the list unchanged', () => {
  const before = [NOTE_A];
  const after = recordReportSchedulingNote(before, { ...NOTE_B, cycle: 'daily' });
  assert.equal(after.length, 1);
  assert.deepEqual(after, before);
});

test('forReport finds a note case-insensitively and returns null when missing', () => {
  const list = [NOTE_A, NOTE_B];
  assert.deepEqual(reportSchedulingNoteForReport(list, 'monthly COLLECTIONS summary'), { ...NOTE_A, lastProducedDate: '' });
  assert.equal(reportSchedulingNoteForReport(list, 'No such report'), null);
  assert.equal(reportSchedulingNoteForReport(list, ''), null);
});

test('overdue lists oldest due first and excludes notes due on the as-of date', () => {
  const dueToday = { id: 'RSN-4', reportName: 'Due today report', cycle: 'monthly', nextDueDate: '2026-11-12', recipients: '', owner: 'Saad' };
  const overdue = reportSchedulingNoteOverdue([NOTE_A, NOTE_B, NOTE_C, dueToday], '2026-11-12');
  assert.deepEqual(overdue.map((note) => note.id), ['RSN-2', 'RSN-3']);
});

test('overdue returns empty for a bad as-of date', () => {
  assert.deepEqual(reportSchedulingNoteOverdue([NOTE_A, NOTE_B], 'not a date'), []);
  assert.deepEqual(reportSchedulingNoteOverdue([NOTE_A, NOTE_B], ''), []);
});

test('due list sorts by next due then name and flags overdue', () => {
  const entries = reportSchedulingNoteDueList([NOTE_A, NOTE_B, NOTE_C], '2026-11-12');
  assert.deepEqual(entries.map((entry) => entry.note.id), ['RSN-2', 'RSN-3', 'RSN-1']);
  assert.deepEqual(entries.map((entry) => entry.overdue), [true, true, false]);
  const sameDay = reportSchedulingNoteDueList([
    { id: 'RSN-9', reportName: 'Zebra report', cycle: 'monthly', nextDueDate: '2026-11-20', recipients: '', owner: 'Saad' },
    { id: 'RSN-8', reportName: 'Alpha report', cycle: 'monthly', nextDueDate: '2026-11-20', recipients: '', owner: 'Saad' },
  ], '2026-11-01');
  assert.deepEqual(sameDay.map((entry) => entry.note.id), ['RSN-8', 'RSN-9']);
});

test('markProduced advances a monthly note by one calendar month', () => {
  const jan = [{ id: 'RSN-M', reportName: 'Month-end pack', cycle: 'monthly', nextDueDate: '2026-01-31', recipients: '', owner: 'Saad' }];
  const feb = markReportSchedulingNoteProduced(jan, 'RSN-M', '2026-01-31');
  assert.equal(feb[0].nextDueDate, '2026-02-28');
  assert.equal(feb[0].lastProducedDate, '2026-01-31');
  const leapJan = [{ id: 'RSN-L', reportName: 'Month-end pack', cycle: 'monthly', nextDueDate: '2028-01-31', recipients: '', owner: 'Saad' }];
  const leapFeb = markReportSchedulingNoteProduced(leapJan, 'RSN-L', '2028-01-31');
  assert.equal(leapFeb[0].nextDueDate, '2028-02-29');
});

test('markProduced advances weekly, quarterly, and yearly cycles', () => {
  const weekly = markReportSchedulingNoteProduced([NOTE_C], 'RSN-3', '2026-11-10');
  assert.equal(weekly[0].nextDueDate, '2026-11-17');
  const quarterly = markReportSchedulingNoteProduced([NOTE_B], 'RSN-2', '2026-11-05');
  assert.equal(quarterly[0].nextDueDate, '2027-02-05');
  const quarterlyClamp = markReportSchedulingNoteProduced(
    [{ id: 'RSN-Q', reportName: 'Quarter pack', cycle: 'quarterly', nextDueDate: '2026-11-30', recipients: '', owner: 'Saad' }],
    'RSN-Q', '2026-11-30',
  );
  assert.equal(quarterlyClamp[0].nextDueDate, '2027-02-28');
  const yearly = markReportSchedulingNoteProduced(
    [{ id: 'RSN-Y', reportName: 'Year pack', cycle: 'yearly', nextDueDate: '2026-11-15', recipients: '', owner: 'Saad' }],
    'RSN-Y', '2026-11-15',
  );
  assert.equal(yearly[0].nextDueDate, '2027-11-15');
});

test('markProduced advances from the current next due date, not the produced date', () => {
  const late = markReportSchedulingNoteProduced([NOTE_A], 'RSN-1', '2026-11-20');
  assert.equal(late[0].nextDueDate, '2026-12-15');
  assert.equal(late[0].lastProducedDate, '2026-11-20');
  assert.equal(late[0].reportName, 'Monthly collections summary');
});

test('markProduced refuses a bad produced date or a missing id', () => {
  const before = [NOTE_A, NOTE_B];
  assert.deepEqual(markReportSchedulingNoteProduced(before, 'RSN-1', 'not a date'), before);
  assert.deepEqual(markReportSchedulingNoteProduced(before, 'RSN-9', '2026-11-15'), before);
  assert.deepEqual(markReportSchedulingNoteProduced(before, '', '2026-11-15'), before);
});

test('markProduced records the last produced date and changes only that note', () => {
  const after = markReportSchedulingNoteProduced([NOTE_A, NOTE_B], 'RSN-2', '2026-11-05');
  assert.equal(after[1].lastProducedDate, '2026-11-05');
  assert.equal(after[1].nextDueDate, '2027-02-05');
  assert.equal(after[0].nextDueDate, '2026-11-15');
  assert.equal(after[0].lastProducedDate, '');
});

test('counts and summary text', () => {
  assert.deepEqual(reportSchedulingNoteCounts([NOTE_A, NOTE_B, NOTE_C], '2026-11-12'), { total: 3, overdue: 2 });
  assert.deepEqual(reportSchedulingNoteCounts([], '2026-11-12'), { total: 0, overdue: 0 });
  assert.equal(reportSchedulingNoteSummaryText([NOTE_A, NOTE_B, NOTE_C], '2026-11-12'), '3 scheduled reports, 2 overdue.');
  assert.equal(reportSchedulingNoteSummaryText([NOTE_A], '2026-11-01'), '1 scheduled report.');
  assert.equal(reportSchedulingNoteSummaryText([], '2026-11-01'), 'No scheduled reports.');
});

test('summary with no notes', () => {
  assert.equal(reportSchedulingNoteSummaryText([], ''), 'No scheduled reports.');
});

test('text keeps plain words and html escapes markup', () => {
  const tricky = { id: 'RSN-X', reportName: '<script>alert(1)</script>', cycle: 'monthly', nextDueDate: '2026-11-15', recipients: 'A & B', owner: 'Saad' };
  assert.equal(reportSchedulingNoteText(tricky), '<script>alert(1)</script> — due 2026-11-15, cycle monthly, owner Saad, recipients A & B');
  assert.ok(reportSchedulingNoteHtml(tricky).includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(reportSchedulingNoteHtml(tricky).includes('A &amp; B'));
  assert.equal(reportSchedulingNoteText(null), '');
  assert.equal(reportSchedulingNoteHtml(null), '');
});

test('notes html lists in due order and shows the empty message', () => {
  const html = reportSchedulingNotesHtml([NOTE_A, NOTE_B, NOTE_C]);
  assert.ok(html.indexOf('Quarterly mohalla review') < html.indexOf('Weekly field expenses'));
  assert.ok(html.indexOf('Weekly field expenses') < html.indexOf('Monthly collections summary'));
  assert.equal(reportSchedulingNotesHtml([]), '<p>No scheduled reports yet.</p>');
});

test('due html marks overdue entries', () => {
  const html = reportSchedulingNoteDueHtml([NOTE_A, NOTE_B], '2026-11-12');
  assert.ok(html.includes('Quarterly mohalla review'));
  assert.ok(html.includes('<strong>overdue</strong>'));
  assert.equal((html.match(/<strong>overdue<\/strong>/g) || []).length, 1);
  assert.equal(reportSchedulingNoteDueHtml([], '2026-11-12'), '<p>No scheduled reports yet.</p>');
});

test('due text marks overdue entries', () => {
  const text = reportSchedulingNoteDueText([NOTE_A, NOTE_B], '2026-11-12');
  assert.ok(text.includes('Quarterly mohalla review — due 2026-11-05, cycle quarterly, owner Bike, recipients Owner, last produced 2026-08-05 — overdue'));
  assert.ok(!text.includes('Monthly collections summary — due 2026-11-15, cycle monthly, owner Saad, recipients Owner + accountant — overdue'));
  assert.equal(reportSchedulingNoteDueText([], '2026-11-12'), 'No scheduled reports.');
});

test('csv header, rows, and quoting', () => {
  const csv = reportSchedulingNoteCsv([NOTE_A, NOTE_B]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,reportName,cycle,nextDueDate,recipients,owner,lastProducedDate');
  assert.equal(lines[1], 'RSN-1,Monthly collections summary,monthly,2026-11-15,Owner + accountant,Saad,');
  assert.equal(lines[2], 'RSN-2,Quarterly mohalla review,quarterly,2026-11-05,Owner,Bike,2026-08-05');
  const quoted = reportSchedulingNoteCsv([{ id: 'RSN-Q', reportName: 'A "quoted", B', cycle: 'monthly', nextDueDate: '2026-11-15', recipients: '', owner: 'Saad' }]);
  assert.ok(quoted.split('\n')[1].includes('"A ""quoted"", B"'));
  assert.equal(reportSchedulingNoteCsv([]), 'id,reportName,cycle,nextDueDate,recipients,owner,lastProducedDate');
});

test('filename is the scheduling notes csv name', () => {
  assert.equal(reportSchedulingNoteFilename(), 'report-scheduling-notes.csv');
});

test('recipients optional — blank reads not recorded in text', () => {
  assert.ok(reportSchedulingNoteText(NOTE_C).includes('recipients not recorded'));
  assert.ok(reportSchedulingNoteText(NOTE_A).includes('recipients Owner + accountant'));
});

test('normalize list drops bad entries', () => {
  const clean = normalizeReportSchedulingNoteList([NOTE_A, { ...NOTE_B, cycle: 'daily' }, null, 'junk', NOTE_C]);
  assert.deepEqual(clean.map((note) => note.id), ['RSN-1', 'RSN-3']);
  assert.deepEqual(normalizeReportSchedulingNoteList(null), []);
  assert.deepEqual(normalizeReportSchedulingNoteList('junk'), []);
});

test('inputs are never mutated, even when deep frozen', () => {
  const frozen = deepFreeze([{ ...NOTE_A }, { ...NOTE_B }, { ...NOTE_C }]);
  const snapshot = JSON.stringify(frozen);
  recordReportSchedulingNote(frozen, { id: 'RSN-4', reportName: 'New report', cycle: 'monthly', nextDueDate: '2026-12-01', recipients: '', owner: 'Saad' });
  reportSchedulingNoteForReport(frozen, 'Monthly collections summary');
  reportSchedulingNoteOverdue(frozen, '2026-11-12');
  reportSchedulingNoteDueList(frozen, '2026-11-12');
  markReportSchedulingNoteProduced(frozen, 'RSN-1', '2026-11-15');
  reportSchedulingNoteCounts(frozen, '2026-11-12');
  reportSchedulingNoteSummaryText(frozen, '2026-11-12');
  reportSchedulingNotesHtml(frozen);
  reportSchedulingNoteDueHtml(frozen, '2026-11-12');
  reportSchedulingNoteCsv(frozen);
  assert.equal(JSON.stringify(frozen), snapshot);
});

test('pure module reads no storage, clock, network, or page', () => {
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /window\./);
  assert.doesNotMatch(moduleSrc, /import /);
});

test('app.js wires the scheduling note panel and index.html carries it', () => {
  assert.ok(appJs.includes("from './report-scheduling-note.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderReportSchedulingNotes();'), 'render call is wired');
  assert.ok(appJs.includes('shahdara_rsn_notes_v1'), 'store key is wired');
  assert.ok(indexHtml.includes('id="rsnHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="rsnBody"'), 'notes body present');
  assert.ok(indexHtml.includes('id="rsnDueBody"'), 'due list body present');
  assert.ok(indexHtml.includes('id="rsnSaveBtn"'), 'save button present');
  assert.ok(indexHtml.includes('id="rsnProducedBtn"'), 'mark produced button present');
  assert.ok(indexHtml.includes('id="rsnExportBtn"'), 'export button present');
});
