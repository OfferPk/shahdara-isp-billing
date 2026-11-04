import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isStrictDate,
  normalizeLicence,
  normalizeLicenceList,
  findLicence,
  recordLicence,
  removeLicence,
  markLicenceRenewed,
  licencesSorted,
  activeLicences,
  renewedLicences,
  overdueLicences,
  isLicenceOverdue,
  licenceStatus,
  licenceText,
  licenceSummaryText,
  licenceHtml,
  licenceAllHtml,
  licenceCsv,
  licenceFilename,
} from '../licence-tracker.js';

const dir = dirname(fileURLToPath(import.meta.url));

const licence = (over = {}) => ({
  id: 'LC-1',
  toolName: 'Billing app',
  provider: 'Vendor A',
  renewalDate: '2026-06-01',
  cost: 'Rs 5000/year',
  renewalNote: 'Pay before June',
  status: 'active',
  renewedDate: '',
  ...over,
});

test('half-formed licences are refused', () => {
  assert.equal(normalizeLicence(null), null);
  assert.equal(normalizeLicence({ toolName: 'X', renewalDate: '2026-06-01' }), null);
  assert.equal(normalizeLicence(licence({ toolName: '' })), null);
  assert.equal(normalizeLicence(licence({ renewalDate: '' })), null);
  assert.equal(normalizeLicence(licence({ renewalDate: '2026-13-01' })), null);
});

test('strict dates: bad months, bad days, leap years', () => {
  assert.equal(isStrictDate('2026-02-29'), false);
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-04-31'), false);
  assert.equal(isStrictDate('2026-08-31'), true);
  assert.equal(isStrictDate('2026-12-31'), true);
  assert.equal(isStrictDate('01-06-2026'), false);
  assert.equal(normalizeLicence(licence({ renewalDate: '2026-02-30' })), null);
});

test('unknown status falls back to active, never hidden', () => {
  assert.equal(normalizeLicence(licence({ status: 'expired' })).status, 'active');
  assert.equal(normalizeLicence(licence({ status: 'PENDING' })).status, 'active');
  assert.equal(normalizeLicence(licence({ status: 'renewed' })).status, 'renewed');
});

test('unknown fields are dropped', () => {
  const entry = normalizeLicence(licence({ billId: 'B-1', paymentId: 'P-1', expenseId: 'E-1', sendTo: 'x' }));
  assert.equal(entry.billId, undefined);
  assert.equal(entry.paymentId, undefined);
  assert.equal(entry.expenseId, undefined);
  assert.equal(entry.sendTo, undefined);
});

test('duplicate ids are never rewritten', () => {
  const first = recordLicence([], licence());
  const second = recordLicence(first, licence({ toolName: 'Other tool' }));
  assert.equal(second.length, 1);
  assert.equal(second[0].toolName, 'Billing app');
});

test('find and remove', () => {
  const list = recordLicence([], licence());
  assert.equal(findLicence(list, 'LC-1').toolName, 'Billing app');
  assert.equal(findLicence(list, 'LC-9'), null);
  assert.deepEqual(removeLicence(list, 'LC-1'), []);
  assert.equal(removeLicence(list, 'LC-9').length, 1);
});

test('renewals list soonest first, then tool name, then id', () => {
  const list = [
    licence({ id: 'LC-3', toolName: 'Zeta', renewalDate: '2026-06-01' }),
    licence({ id: 'LC-1', toolName: 'Alpha', renewalDate: '2026-09-01' }),
    licence({ id: 'LC-2', toolName: 'Beta', renewalDate: '2026-06-01' }),
  ];
  assert.deepEqual(licencesSorted(list).map((item) => item.id), ['LC-2', 'LC-3', 'LC-1']);
});

test('overdue is strict: due today is not overdue, yesterday is', () => {
  const list = [
    licence({ id: 'LC-1', renewalDate: '2026-06-01' }),
    licence({ id: 'LC-2', renewalDate: '2026-05-31' }),
    licence({ id: 'LC-3', renewalDate: '2026-06-02' }),
  ];
  assert.deepEqual(overdueLicences(list, '2026-06-01').map((item) => item.id), ['LC-2']);
  assert.equal(isLicenceOverdue(licence({ renewalDate: '2026-06-01' }), '2026-06-01'), false);
  assert.equal(isLicenceOverdue(licence({ renewalDate: '2026-05-31' }), '2026-06-01'), true);
  assert.equal(licenceStatus(licence({ renewalDate: '2026-05-31' }), '2026-06-01'), 'overdue');
  assert.equal(licenceStatus(licence({ renewalDate: '2026-06-01' }), '2026-06-01'), 'active');
});

test('renewed licences are never overdue and stay in history', () => {
  const list = [licence({ renewalDate: '2025-01-01', status: 'renewed', renewedDate: '2025-01-01' })];
  assert.deepEqual(overdueLicences(list, '2026-06-01'), []);
  assert.deepEqual(renewedLicences(list).map((item) => item.id), ['LC-1']);
  assert.equal(licenceStatus(list[0], '2026-06-01'), 'renewed');
});

test('mark renewed records only the renewed state, never rewrites a past renewal', () => {
  const list = recordLicence([], licence());
  const renewed = markLicenceRenewed(list, 'LC-1', '2026-05-20');
  assert.equal(renewed[0].status, 'renewed');
  assert.equal(renewed[0].renewedDate, '2026-05-20');
  assert.equal(renewed[0].toolName, 'Billing app');
  const again = markLicenceRenewed(renewed, 'LC-1', '2026-06-01');
  assert.equal(again[0].renewedDate, '2026-05-20');
  const badDate = markLicenceRenewed(list, 'LC-1', 'not-a-date');
  assert.equal(badDate[0].status, 'active');
  const noDate = markLicenceRenewed(list, 'LC-1', '');
  assert.equal(noDate[0].status, 'renewed');
  assert.equal(noDate[0].renewedDate, '');
});

test('active and renewed views', () => {
  const list = [
    licence({ id: 'LC-1' }),
    licence({ id: 'LC-2', status: 'renewed', renewedDate: '2026-01-01' }),
  ];
  assert.deepEqual(activeLicences(list).map((item) => item.id), ['LC-1']);
  assert.deepEqual(renewedLicences(list).map((item) => item.id), ['LC-2']);
});

test('list normalization drops bad rows and duplicate ids', () => {
  const list = normalizeLicenceList([licence(), licence({ toolName: 'Other' }), null, licence({ renewalDate: 'bad' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].toolName, 'Billing app');
});

test('summary text names counts plainly', () => {
  const list = [
    licence({ id: 'LC-1', renewalDate: '2026-05-01' }),
    licence({ id: 'LC-2', status: 'renewed', renewedDate: '2026-01-01' }),
  ];
  assert.equal(licenceSummaryText(list, '2026-06-01'), '2 licences recorded: 1 active, 1 renewed, 1 overdue');
  assert.equal(licenceSummaryText([], '2026-06-01'), '0 licences recorded: 0 active, 0 renewed, 0 overdue');
});

test('licence text flags overdue and never invents a total', () => {
  const text = licenceText(licence({ renewalDate: '2026-05-01' }), '2026-06-01');
  assert.ok(text.includes('OVERDUE'));
  assert.ok(text.includes('Rs 5000/year'));
  assert.ok(!text.includes('total'));
  const renewed = licenceText(licence({ status: 'renewed', renewedDate: '2026-05-20' }), '2026-06-01');
  assert.ok(renewed.includes('renewed 2026-05-20'));
  assert.ok(!renewed.includes('OVERDUE'));
});

test('HTML escapes and flags overdue', () => {
  const html = licenceHtml(licence({ toolName: '<b>Tool</b>', renewalDate: '2026-05-01' }), '2026-06-01');
  assert.ok(!html.includes('<b>Tool</b>'));
  assert.ok(html.includes('&lt;b&gt;Tool&lt;/b&gt;'));
  assert.ok(html.includes('OVERDUE'));
  assert.equal(licenceHtml(null, '2026-06-01'), '');
  assert.ok(licenceAllHtml([licence()], '2026-06-01').includes('Billing app'));
});

test('CSV keeps cost exactly as entered and marks overdue', () => {
  const csv = licenceCsv([licence({ renewalDate: '2026-05-01' })], '2026-06-01');
  assert.ok(csv.startsWith('"id","toolName","provider","renewalDate","cost","renewalNote","status","renewedDate","overdue"'));
  assert.ok(csv.includes('"Rs 5000/year"'));
  assert.ok(csv.endsWith('"yes"'));
  assert.equal(licenceFilename(), 'licences.csv');
});

test('inputs are never mutated', () => {
  const raw = licence({ status: 'expired' });
  const before = JSON.stringify(raw);
  normalizeLicence(raw);
  recordLicence([], raw);
  assert.equal(JSON.stringify(raw), before);
});

test('purity fence: no storage, clock, network, or other record type in the module', () => {
  const source = readFileSync(join(dir, '..', 'licence-tracker.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('billId'));
  assert.ok(!source.includes('paymentId'));
  assert.ok(!source.includes('expenseId'));
  assert.ok(!source.includes('sendTo'));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['lcHeading', 'lcSummary', 'lcExportBtn', 'lcTool', 'lcProvider', 'lcRenewal', 'lcCost', 'lcNote', 'lcSaveBtn', 'lcRenewId', 'lcRenewDate', 'lcRenewBtn', 'lcRemoveId', 'lcRemoveBtn', 'lcFilter', 'lcBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the licence tracker module and render function', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './licence-tracker.js'"));
  assert.ok(app.includes('renderLicences()'));
  assert.ok(app.includes('shahdara_licences_v1'));
});
