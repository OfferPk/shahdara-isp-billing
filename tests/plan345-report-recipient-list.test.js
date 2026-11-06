import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as reportRecipientListModule from '../report-recipient-list.js';
import {
  validReportRecipientListDay,
  foldReportRecipientDeliveryMethod,
  normalizeReportRecipients,
  normalizeReportRecipientList,
  normalizeReportRecipientListList,
  recordReportRecipientList,
  setReportRecipients,
  reportRecipientListFor,
  reportRecipientListsWithoutRecipients,
  reportRecipientListCounts,
  reportRecipientListSummaryText,
  reportRecipientListText,
  reportRecipientListsText,
  reportRecipientListHtml,
  reportRecipientListsHtml,
  reportRecipientListCsv,
  reportRecipientListFilename,
} from '../report-recipient-list.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'report-recipient-list.js'), 'utf8');

const LIST_A = {
  id: 'RRL-1', reportName: 'Monthly collections', recipients: ['Owner', 'Accountant'],
  deliveryMethod: 'in person', dateSet: '2026-11-06',
};
const LIST_B = {
  id: 'RRL-2', reportName: 'Overdue list', recipients: 'Collector, Owner',
  deliveryMethod: 'paper kept at shop', dateSet: '2026-11-05',
};
const LIST_C = {
  id: 'RRL-3', reportName: 'Shop diary summary', recipients: [],
  deliveryMethod: 'in person', dateSet: '2026-11-04',
};

test('strict date: real calendar dates only', () => {
  assert.equal(validReportRecipientListDay('2026-11-06'), true);
  assert.equal(validReportRecipientListDay('2028-02-29'), true);
  assert.equal(validReportRecipientListDay('2026-02-29'), false);
  assert.equal(validReportRecipientListDay('2026-11-31'), false);
  assert.equal(validReportRecipientListDay('2026-13-01'), false);
  assert.equal(validReportRecipientListDay('6 Nov 2026'), false);
  assert.equal(validReportRecipientListDay(''), false);
  assert.equal(validReportRecipientListDay(null), false);
});

test('delivery method folds to in person or paper kept at shop', () => {
  assert.equal(foldReportRecipientDeliveryMethod('paper kept at shop'), 'paper kept at shop');
  assert.equal(foldReportRecipientDeliveryMethod('paper'), 'paper kept at shop');
  assert.equal(foldReportRecipientDeliveryMethod('shop'), 'paper kept at shop');
  assert.equal(foldReportRecipientDeliveryMethod('in person'), 'in person');
  assert.equal(foldReportRecipientDeliveryMethod('carrier pigeon'), 'in person');
  assert.equal(foldReportRecipientDeliveryMethod(''), 'in person');
});

test('recipients normalize from array or comma string, trimmed and deduped', () => {
  assert.deepEqual(normalizeReportRecipients(['Owner', ' owner ', 'Accountant', '']), ['Owner', 'Accountant']);
  assert.deepEqual(normalizeReportRecipients('Collector, Owner, collector'), ['Collector', 'Owner']);
  assert.deepEqual(normalizeReportRecipients(''), []);
  assert.deepEqual(normalizeReportRecipients(null), []);
  assert.deepEqual(normalizeReportRecipients(42), []);
});

test('normalize keeps a well-formed list and drops unknown fields', () => {
  const clean = normalizeReportRecipientList({ ...LIST_A, billId: 'B-1', amount: 3000 });
  assert.deepEqual(clean, LIST_A);
  assert.equal('billId' in clean, false);
  assert.equal('amount' in clean, false);
});

test('normalize refuses a list with no id or no report name', () => {
  assert.equal(normalizeReportRecipientList({ ...LIST_A, id: '' }), null);
  assert.equal(normalizeReportRecipientList({ ...LIST_A, id: '   ' }), null);
  assert.equal(normalizeReportRecipientList({ ...LIST_A, reportName: '' }), null);
  assert.equal(normalizeReportRecipientList({ reportName: 'Monthly collections', dateSet: '2026-11-06' }), null);
});

test('normalize refuses a list with a bad date set', () => {
  assert.equal(normalizeReportRecipientList({ ...LIST_A, dateSet: '2026-02-29' }), null);
  assert.equal(normalizeReportRecipientList({ ...LIST_A, dateSet: 'tomorrow' }), null);
  assert.equal(normalizeReportRecipientList({ ...LIST_A, dateSet: '' }), null);
});

test('record appends a list and leaves the input list alone', () => {
  const before = [];
  const after = recordReportRecipientList(before, LIST_A);
  assert.equal(after.length, 1);
  assert.equal(before.length, 0);
  assert.deepEqual(after[0], LIST_A);
});

test('record refuses a duplicate id', () => {
  const after = recordReportRecipientList([LIST_A], { ...LIST_A, reportName: 'Other report' });
  assert.equal(after.length, 1);
  assert.equal(after[0].reportName, 'Monthly collections');
});

test('record refuses a second list for the same report, any spelling', () => {
  const after = recordReportRecipientList([LIST_A], { ...LIST_B, id: 'RRL-9', reportName: 'monthly COLLECTIONS' });
  assert.equal(after.length, 1);
});

test('record allows a list with no recipients — it is flagged, not refused', () => {
  const after = recordReportRecipientList([], LIST_C);
  assert.equal(after.length, 1);
  assert.deepEqual(after[0].recipients, []);
});

test('set recipients changes only that report', () => {
  const list = [LIST_A, LIST_B];
  const after = setReportRecipients(list, 'monthly collections', ['Owner', 'Saad']);
  assert.deepEqual(after[0].recipients, ['Owner', 'Saad']);
  assert.deepEqual(after[1].recipients, ['Collector', 'Owner']);
  assert.equal(after[0].dateSet, '2026-11-06');
});

test('set recipients refuses a missing report', () => {
  const list = [LIST_A];
  assert.equal(setReportRecipients(list, 'No such report', ['Owner']), list);
});

test('lookup finds a report case-insensitively and returns null when missing', () => {
  const list = [LIST_A, LIST_B];
  assert.equal(reportRecipientListFor(list, 'OVERDUE LIST').id, 'RRL-2');
  assert.equal(reportRecipientListFor(list, 'No such report'), null);
  assert.equal(reportRecipientListFor([], 'Monthly collections'), null);
});

test('reports with no recipients are flagged, A to Z', () => {
  const list = [LIST_A, LIST_C, { ...LIST_B, id: 'RRL-4', reportName: 'Annual summary', recipients: [] }];
  const flagged = reportRecipientListsWithoutRecipients(list);
  assert.deepEqual(flagged.map((item) => item.reportName), ['Annual summary', 'Shop diary summary']);
  assert.deepEqual(reportRecipientListsWithoutRecipients([LIST_A, LIST_B]), []);
});

test('counts reconcile: total equals with plus without recipients', () => {
  const counts = reportRecipientListCounts([LIST_A, LIST_B, LIST_C]);
  assert.deepEqual(counts, { total: 3, withRecipients: 2, withoutRecipients: 1 });
  assert.equal(counts.withRecipients + counts.withoutRecipients, counts.total);
  assert.deepEqual(reportRecipientListCounts([]), { total: 0, withRecipients: 0, withoutRecipients: 0 });
});

test('summary text names the flagged count in plain words', () => {
  assert.equal(reportRecipientListSummaryText([]), 'No report recipient lists recorded.');
  assert.equal(reportRecipientListSummaryText([LIST_A]), '1 report with recipients listed.');
  assert.equal(reportRecipientListSummaryText([LIST_A, LIST_B]), '2 reports with recipients listed.');
  assert.equal(
    reportRecipientListSummaryText([LIST_A, LIST_C]),
    '2 reports with recipients listed, 1 with no recipients — flagged below.',
  );
});

test('plain text names the report, its recipients, and flags a missing list', () => {
  assert.equal(
    reportRecipientListText(LIST_A),
    'Monthly collections: Owner, Accountant (in person, set 2026-11-06)',
  );
  assert.equal(
    reportRecipientListText(LIST_C),
    'Shop diary summary: No recipients — flagged (in person, set 2026-11-04)',
  );
  assert.deepEqual(reportRecipientListsText([LIST_B, LIST_A]), [
    'Monthly collections: Owner, Accountant (in person, set 2026-11-06)',
    'Overdue list: Collector, Owner (paper kept at shop, set 2026-11-05)',
  ]);
});

test('HTML escapes recipient and report text', () => {
  const nasty = { ...LIST_A, reportName: '<script>alert(1)</script>', recipients: ['<b>Owner</b>'] };
  const html = reportRecipientListHtml(nasty);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;Owner&lt;/b&gt;'));
  const listHtml = reportRecipientListsHtml([LIST_A, LIST_C]);
  assert.ok(listHtml.startsWith('<ul>'));
  assert.ok(listHtml.includes('No recipients — flagged'));
});

test('CSV has a header row, one row per list, and quotes commas', () => {
  const csv = reportRecipientListCsv([LIST_B, LIST_A]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,reportName,recipients,deliveryMethod,dateSet');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('RRL-1,Monthly collections,'));
  const quoted = reportRecipientListCsv([{ ...LIST_A, reportName: 'Monthly, collections' }]);
  assert.ok(quoted.includes('"Monthly, collections"'));
  assert.equal(reportRecipientListFilename(), 'report-recipient-list.csv');
});

test('inputs are never mutated, even deep-frozen', () => {
  const frozen = Object.freeze([
    Object.freeze({ ...LIST_A, recipients: Object.freeze([...LIST_A.recipients]) }),
    Object.freeze({ ...LIST_C, recipients: Object.freeze([]) }),
  ]);
  const before = JSON.stringify(frozen);
  recordReportRecipientList(frozen, { ...LIST_B });
  setReportRecipients(frozen, 'Monthly collections', ['Owner']);
  reportRecipientListsWithoutRecipients(frozen);
  reportRecipientListSummaryText(frozen);
  reportRecipientListsText(frozen);
  reportRecipientListsHtml(frozen);
  reportRecipientListCsv(frozen);
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
  const exported = Object.keys(reportRecipientListModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change|send/i.test(name)));
});

test('fence: module never names the existing export custody file', () => {
  assert.ok(!moduleSrc.includes('export-custody'));
});

test('wiring: app.js imports the module, renders it, and stores it under the rcl key', () => {
  assert.ok(appJs.includes("from './report-recipient-list.js'"));
  assert.ok(appJs.includes('renderReportRecipientLists()'));
  assert.ok(appJs.includes('shahdara_rcl_lists_v1'));
  assert.ok(appJs.includes('reportRecipientListSummaryText'));
  assert.ok(!/renderReportRecipientLists\(\)\s*;\s*renderReportRecipientLists\(\)/.test(appJs));
});

test('wiring: index.html carries the rcl panel after the Plan 344 panel', () => {
  assert.ok(indexHtml.includes('id="rclHeading"'));
  assert.ok(indexHtml.includes('id="rclBody"'));
  assert.ok(indexHtml.includes('id="rclSummary"'));
  assert.ok(indexHtml.includes('id="rclSaveBtn"'));
  assert.ok(indexHtml.includes('id="rclSetBtn"'));
  assert.ok(indexHtml.indexOf('id="pqlHeading"') < indexHtml.indexOf('id="rclHeading"'));
});
