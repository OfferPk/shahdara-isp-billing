import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeMaintenanceNotice,
  normalizeMaintenanceNoticeList,
  findMaintenanceNotice,
  upsertMaintenanceNotice,
  buildMaintenanceCopy,
  copyMaintenanceNotice,
  removeMaintenanceNotice,
  markMaintenanceSent,
  markMaintenanceUnsent,
  maintenanceNoticesForMohalla,
  maintenanceNoticesForWork,
  maintenanceNoticeMohallas,
  maintenanceNoticeWorks,
  maintenanceNoticeSentList,
  maintenanceNoticeUnsentList,
  maintenanceNoticeText,
  maintenanceNoticeSummaryText,
  maintenanceNoticeHtml,
  maintenanceNoticeAllHtml,
  maintenanceNoticeMohallaHtml,
  maintenanceNoticeCsv,
  maintenanceNoticeFilename,
} from '../maintenance-notice.js';

const dir = dirname(fileURLToPath(import.meta.url));

const notice = (over = {}) => ({
  id: 'MN-1',
  workItem: 'Replace the street cabinet battery',
  expectedDate: '2026-11-10',
  timeWindow: '9am-12pm',
  mohalla: 'Main Bazar',
  sent: false,
  sentDate: '',
  ...over,
});

test('half-formed notices are refused outright', () => {
  assert.equal(normalizeMaintenanceNotice(null), null);
  assert.equal(normalizeMaintenanceNotice({}), null);
  assert.equal(normalizeMaintenanceNotice(notice({ id: '' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ workItem: '   ' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ expectedDate: '' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ timeWindow: '' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ mohalla: '' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ sentDate: '2026-13-01' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ sent: true, sentDate: '10-11-2026' })), null);
});

test('strict dates: 31-day months pass, February rules hold', () => {
  assert.ok(normalizeMaintenanceNotice(notice({ expectedDate: '2026-08-31' })));
  assert.ok(normalizeMaintenanceNotice(notice({ expectedDate: '2026-10-31' })));
  assert.ok(normalizeMaintenanceNotice(notice({ expectedDate: '2026-12-31' })));
  assert.equal(normalizeMaintenanceNotice(notice({ expectedDate: '2026-11-31' })), null);
  assert.equal(normalizeMaintenanceNotice(notice({ expectedDate: '2026-02-29' })), null);
  assert.ok(normalizeMaintenanceNotice(notice({ expectedDate: '2024-02-29' })));
  assert.equal(normalizeMaintenanceNotice(notice({ expectedDate: '2026-02-30' })), null);
});

test('unknown fields are dropped, never stored', () => {
  const record = normalizeMaintenanceNotice(notice({
    billId: 'B-9', paymentId: 'P-9', maintenanceId: 'M-9', sendNow: true,
  }));
  assert.deepEqual(Object.keys(record).sort(), ['expectedDate', 'id', 'mohalla', 'sent', 'sentDate', 'timeWindow', 'workItem']);
});

test('duplicate ids are never rewritten', () => {
  const base = upsertMaintenanceNotice([], notice());
  assert.equal(upsertMaintenanceNotice(base, notice()).length, 1);
  const changed = upsertMaintenanceNotice(base, notice({ timeWindow: '2pm-4pm' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].timeWindow, '9am-12pm');
});

test('one notice per work item per mohalla, case-insensitive', () => {
  const base = upsertMaintenanceNotice([], notice());
  assert.equal(upsertMaintenanceNotice(base, notice({ id: 'MN-2', workItem: 'replace the STREET cabinet battery', mohalla: 'main bazar' })).length, 1);
  assert.equal(upsertMaintenanceNotice(base, notice({ id: 'MN-2', mohalla: 'Old Town' })).length, 2);
  assert.equal(upsertMaintenanceNotice(base, notice({ id: 'MN-3', workItem: 'Clean the splitter box' })).length, 2);
});

test('copy changes only the mohalla and id, and resets the sent mark', () => {
  const sent = markMaintenanceSent(upsertMaintenanceNotice([], notice()), 'MN-1', '2026-11-09');
  const copy = buildMaintenanceCopy(sent[0], 'Old Town', 'MN-9');
  assert.equal(copy.mohalla, 'Old Town');
  assert.equal(copy.id, 'MN-9');
  assert.equal(copy.sent, false);
  assert.equal(copy.sentDate, '');
  assert.equal(copy.workItem, 'Replace the street cabinet battery');
  assert.equal(copy.expectedDate, '2026-11-10');
  assert.equal(copy.timeWindow, '9am-12pm');
  const withCopy = copyMaintenanceNotice(sent, 'MN-1', 'Old Town', 'MN-9');
  assert.equal(withCopy.length, 2);
  assert.equal(copyMaintenanceNotice(sent, 'MN-404', 'Old Town', 'MN-9').length, 1);
  assert.equal(copyMaintenanceNotice(sent, 'MN-1', '', 'MN-9').length, 1);
});

test('sent mark on one mohalla copy leaves other copies untouched', () => {
  const base = copyMaintenanceNotice(upsertMaintenanceNotice([], notice()), 'MN-1', 'Old Town', 'MN-2');
  const marked = markMaintenanceSent(base, 'MN-2', '2026-11-09');
  assert.equal(findMaintenanceNotice(marked, 'MN-2').sent, true);
  assert.equal(findMaintenanceNotice(marked, 'MN-2').sentDate, '2026-11-09');
  assert.equal(findMaintenanceNotice(marked, 'MN-1').sent, false);
  const unmarked = markMaintenanceUnsent(marked, 'MN-2');
  assert.equal(findMaintenanceNotice(unmarked, 'MN-2').sent, false);
  assert.equal(findMaintenanceNotice(unmarked, 'MN-2').sentDate, '');
  assert.equal(markMaintenanceSent(base, 'MN-2', 'not-a-date')[1].sent, false);
  assert.equal(markMaintenanceSent(base, 'MN-404', '2026-11-09').length, 2);
});

test('find and remove by id', () => {
  const base = upsertMaintenanceNotice([], notice());
  assert.equal(findMaintenanceNotice(base, 'MN-1').workItem, 'Replace the street cabinet battery');
  assert.equal(findMaintenanceNotice(base, 'MN-404'), null);
  assert.equal(findMaintenanceNotice(base, ''), null);
  assert.equal(removeMaintenanceNotice(base, 'MN-1').length, 0);
  assert.equal(removeMaintenanceNotice(base, 'MN-404').length, 1);
});

test('mohalla view is date order, work view is mohalla order', () => {
  let list = [];
  list = upsertMaintenanceNotice(list, notice({ id: 'MN-1', expectedDate: '2026-11-12' }));
  list = upsertMaintenanceNotice(list, notice({ id: 'MN-2', expectedDate: '2026-11-10', workItem: 'A later job' }));
  list = upsertMaintenanceNotice(list, notice({ id: 'MN-3', mohalla: 'Old Town' }));
  assert.deepEqual(maintenanceNoticesForMohalla(list, 'main bazar').map((item) => item.id), ['MN-2', 'MN-1']);
  assert.deepEqual(maintenanceNoticesForWork(list, 'replace the street cabinet battery').map((item) => item.id), ['MN-1', 'MN-3']);
  assert.deepEqual(maintenanceNoticesForMohalla(list, 'Nowhere'), []);
});

test('mohalla and work lists keep first spelling, sorted A-Z', () => {
  let list = [];
  list = upsertMaintenanceNotice(list, notice({ mohalla: 'main bazar' }));
  list = upsertMaintenanceNotice(list, notice({ id: 'MN-2', mohalla: 'Old Town', workItem: 'Clean the splitter box' }));
  assert.deepEqual(maintenanceNoticeMohallas(list), ['Old Town', 'main bazar']);
  assert.deepEqual(maintenanceNoticeWorks(list), ['Clean the splitter box', 'Replace the street cabinet battery']);
});

test('sent and unsent lists split cleanly', () => {
  let list = [];
  list = upsertMaintenanceNotice(list, notice());
  list = upsertMaintenanceNotice(list, notice({ id: 'MN-2', mohalla: 'Old Town', sent: true, sentDate: '2026-11-09' }));
  assert.deepEqual(maintenanceNoticeSentList(list).map((item) => item.id), ['MN-2']);
  assert.deepEqual(maintenanceNoticeUnsentList(list).map((item) => item.id), ['MN-1']);
});

test('notice text states work, date, window, mohalla, and the confirmation promise', () => {
  const text = maintenanceNoticeText(notice());
  assert.match(text, /Main Bazar/);
  assert.match(text, /2026-11-10/);
  assert.match(text, /9am-12pm/);
  assert.match(text, /Replace the street cabinet battery/);
  assert.match(text, /operator will confirm when the work is done/);
  assert.equal(maintenanceNoticeText(null), '');
  assert.match(maintenanceNoticeSummaryText([notice(), notice({ id: 'MN-2', mohalla: 'Old Town', sent: true })]), /2 maintenance notices · 2 mohallas · 1 sent/);
});

test('HTML escapes input and labels sent state', () => {
  const html = maintenanceNoticeHtml(notice({ workItem: '<b>Fix</b> & "cable"', sent: true, sentDate: '2026-11-09' }));
  assert.doesNotMatch(html, /<b>Fix<\/b>/);
  assert.match(html, /&lt;b&gt;Fix&lt;\/b&gt;/);
  assert.match(html, /Sent on 2026-11-09/);
  assert.match(maintenanceNoticeHtml(notice()), /Not sent/);
  assert.equal(maintenanceNoticeHtml(null), '');
  assert.match(maintenanceNoticeAllHtml([]), /No maintenance notices/);
  assert.match(maintenanceNoticeMohallaHtml([notice()], 'Nowhere'), /No maintenance notices for this mohalla/);
});

test('CSV export and filename', () => {
  const csv = maintenanceNoticeCsv([notice({ workItem: 'Fix, "cable"' })]);
  assert.match(csv, /^id,workItem,expectedDate,timeWindow,mohalla,sent,sentDate\n/);
  assert.match(csv, /"Fix, ""cable"""/);
  assert.equal(maintenanceNoticeFilename(), 'maintenance-notices.csv');
});

test('inputs are never mutated, list normalization drops bad rows', () => {
  const input = notice({ extra: 'x' });
  const snapshot = JSON.stringify(input);
  normalizeMaintenanceNotice(input);
  assert.equal(JSON.stringify(input), snapshot);
  const list = normalizeMaintenanceNoticeList([notice(), notice({ id: '' }), notice({ id: 'MN-1', timeWindow: '2pm-4pm' }), null, 'junk']);
  assert.equal(list.length, 1);
  assert.equal(list[0].timeWindow, '9am-12pm');
});

test('purity fence: module never touches storage, network, or the clock', () => {
  const source = readFileSync(join(dir, '..', 'maintenance-notice.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|fetch\(|XMLHttpRequest|new Date|Date\.now/);
});

test('panel wiring: all panel element ids exist in index.html, no standalone OLT in app.js', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['mnHeading', 'mnSummary', 'mnExportBtn', 'mnWork', 'mnDate', 'mnTimeWindow', 'mnMohalla', 'mnSaveBtn', 'mnCopyId', 'mnCopyMohalla', 'mnCopyNewId', 'mnCopyBtn', 'mnSentId', 'mnSentDate', 'mnSentBtn', 'mnUnsentId', 'mnUnsentBtn', 'mnRemoveId', 'mnRemoveBtn', 'mnFilter', 'mnBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
