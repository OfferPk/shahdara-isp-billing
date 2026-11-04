import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isStrictDate,
  normalizeBusinessDevice,
  normalizeBusinessDeviceList,
  findBusinessDevice,
  recordBusinessDevice,
  removeBusinessDevice,
  markBusinessDeviceReturned,
  businessDevicesSorted,
  devicesByHolder,
  deviceHolders,
  issuedBusinessDevices,
  returnedBusinessDevices,
  businessDeviceStatus,
  businessDeviceText,
  businessDeviceSummaryText,
  businessDeviceHtml,
  businessDeviceAllHtml,
  businessDeviceCsv,
  businessDeviceFilename,
} from '../business-device.js';

const dir = dirname(fileURLToPath(import.meta.url));

const device = (over = {}) => ({
  id: 'BD-1',
  kind: 'Phone',
  makeModel: 'Infinix Hot 40',
  serial: 'SN-1001',
  holder: 'Saad',
  dateIssued: '2026-01-05',
  conditionNote: 'Good screen',
  dateReturned: '',
  ...over,
});

test('half-formed devices are refused', () => {
  assert.equal(normalizeBusinessDevice(null), null);
  assert.equal(normalizeBusinessDevice({ kind: 'Phone', holder: 'Saad', dateIssued: '2026-01-05' }), null);
  assert.equal(normalizeBusinessDevice(device({ kind: '' })), null);
  assert.equal(normalizeBusinessDevice(device({ holder: '' })), null);
  assert.equal(normalizeBusinessDevice(device({ dateIssued: '' })), null);
});

test('strict dates: bad months, bad days, leap years', () => {
  assert.equal(isStrictDate('2026-02-29'), false);
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-04-31'), false);
  assert.equal(isStrictDate('2026-08-31'), true);
  assert.equal(isStrictDate('2026-13-01'), false);
  assert.equal(isStrictDate('05-01-2026'), false);
  assert.equal(normalizeBusinessDevice(device({ dateIssued: '2026-02-30' })), null);
});

test('a return date before the issue date is refused', () => {
  assert.equal(normalizeBusinessDevice(device({ dateIssued: '2026-01-05', dateReturned: '2026-01-04' })), null);
  assert.notEqual(normalizeBusinessDevice(device({ dateIssued: '2026-01-05', dateReturned: '2026-01-05' })), null);
});

test('unknown fields are dropped', () => {
  const entry = normalizeBusinessDevice(device({ billId: 'B-9', payment: 500, customerId: 'C-1', sendNow: true }));
  assert.equal(entry.billId, undefined);
  assert.equal(entry.payment, undefined);
  assert.equal(entry.customerId, undefined);
  assert.equal(entry.sendNow, undefined);
});

test('serial is optional, make/model stored as entered', () => {
  const entry = normalizeBusinessDevice(device({ serial: '', makeModel: 'Dell Latitude 3420' }));
  assert.equal(entry.serial, '');
  assert.equal(entry.makeModel, 'Dell Latitude 3420');
});

test('duplicate ids are never rewritten', () => {
  const list = [device()];
  const kept = recordBusinessDevice(list, device({ kind: 'Laptop', holder: 'Ali' }));
  assert.equal(kept.length, 1);
  assert.equal(kept[0].kind, 'Phone');
  assert.equal(kept[0].holder, 'Saad');
});

test('find and remove', () => {
  const list = [device(), device({ id: 'BD-2', kind: 'Laptop', holder: 'Ali' })];
  assert.equal(findBusinessDevice(list, 'BD-2').kind, 'Laptop');
  assert.equal(findBusinessDevice(list, 'BD-9'), null);
  assert.equal(removeBusinessDevice(list, 'BD-1').length, 1);
  assert.equal(removeBusinessDevice(list, 'BD-9').length, 2);
});

test('mark returned: only unreturned, only a strict date, never before issue', () => {
  const list = [device()];
  const marked = markBusinessDeviceReturned(list, 'BD-1', '2026-03-01');
  assert.equal(marked[0].dateReturned, '2026-03-01');
  assert.equal(businessDeviceStatus(marked[0]), 'returned');
  assert.equal(markBusinessDeviceReturned(marked, 'BD-1', '2026-04-01')[0].dateReturned, '2026-03-01');
  assert.equal(markBusinessDeviceReturned(list, 'BD-1', 'not-a-date')[0].dateReturned, '');
  assert.equal(markBusinessDeviceReturned(list, 'BD-1', '2025-12-31')[0].dateReturned, '');
});

test('returned devices stay in history', () => {
  const list = [device({ dateReturned: '2026-03-01' })];
  assert.equal(returnedBusinessDevices(list).length, 1);
  assert.equal(issuedBusinessDevices(list).length, 0);
  assert.equal(businessDevicesSorted(list).length, 1);
});

test('list normalization drops bad and duplicate entries', () => {
  const list = normalizeBusinessDeviceList([device(), device(), null, device({ id: 'BD-2', holder: '' })]);
  assert.equal(list.length, 1);
});

test('devices sort by holder A-Z then kind A-Z then id', () => {
  const list = [
    device({ id: 'BD-3', kind: 'Phone', holder: 'Saad' }),
    device({ id: 'BD-1', kind: 'Laptop', holder: 'Ali' }),
    device({ id: 'BD-2', kind: 'Phone', holder: 'Ali' }),
  ];
  const sorted = businessDevicesSorted(list);
  assert.deepEqual(sorted.map((item) => item.id), ['BD-1', 'BD-2', 'BD-3']);
});

test('devices by holder are case-insensitive', () => {
  const list = [device(), device({ id: 'BD-2', holder: 'Ali' })];
  assert.equal(devicesByHolder(list, 'saad').length, 1);
  assert.equal(devicesByHolder(list, 'SAAD')[0].id, 'BD-1');
  assert.deepEqual(deviceHolders(list), ['Ali', 'Saad']);
});

test('issued and returned views split the list', () => {
  const list = [device(), device({ id: 'BD-2', dateReturned: '2026-02-01' })];
  assert.equal(issuedBusinessDevices(list).length, 1);
  assert.equal(returnedBusinessDevices(list).length, 1);
  assert.equal(businessDeviceStatus(device()), 'issued');
});

test('summary text names issued and returned counts', () => {
  const list = [device(), device({ id: 'BD-2', dateReturned: '2026-02-01' })];
  assert.equal(businessDeviceSummaryText(list), '2 business devices recorded: 1 issued, 1 returned');
  assert.equal(businessDeviceSummaryText([device()]), '1 business device recorded: 1 issued, 0 returned');
});

test('device text states holder, dates, and status plainly', () => {
  assert.match(businessDeviceText(device()), /held by Saad/);
  assert.match(businessDeviceText(device()), /currently issued/);
  assert.match(businessDeviceText(device({ dateReturned: '2026-03-01' })), /returned 2026-03-01/);
  assert.equal(businessDeviceText(null), '');
});

test('HTML escapes user text', () => {
  const html = businessDeviceHtml(device({ kind: '<b>Phone</b>', holder: 'Saad & Ali' }));
  assert.ok(!html.includes('<b>Phone</b>'));
  assert.ok(html.includes('Saad &amp; Ali'));
  assert.equal(businessDeviceAllHtml([device()]).includes('Infinix Hot 40'), true);
});

test('CSV has one row per device plus a header and a stable filename', () => {
  const csv = businessDeviceCsv([device(), device({ id: 'BD-2', dateReturned: '2026-02-01' })]);
  const rows = csv.split('\n');
  assert.equal(rows[0], '"id","kind","makeModel","serial","holder","dateIssued","conditionNote","dateReturned","status"');
  assert.equal(rows.length, 3);
  assert.ok(rows[1].includes('"issued"'));
  assert.ok(rows[2].includes('"returned"'));
  assert.equal(businessDeviceFilename(), 'business-devices.csv');
});

test('inputs are never mutated', () => {
  const list = [device()];
  const listSnapshot = JSON.stringify(list);
  recordBusinessDevice(list, device({ id: 'BD-2' }));
  removeBusinessDevice(list, 'BD-1');
  markBusinessDeviceReturned(list, 'BD-1', '2026-03-01');
  assert.equal(JSON.stringify(list), listSnapshot);
});

test('purity fence: no storage, clock, network, or other record type in the module', () => {
  const source = readFileSync(join(dir, '..', 'business-device.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('customerEquipment'));
  assert.ok(!source.includes('stockRegister'));
  assert.ok(!source.includes('toolKit'));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['bdHeading', 'bdSummary', 'bdExportBtn', 'bdKind', 'bdMake', 'bdSerial', 'bdHolder', 'bdIssued', 'bdNote', 'bdSaveBtn', 'bdReturnId', 'bdReturnDate', 'bdReturnBtn', 'bdRemoveId', 'bdRemoveBtn', 'bdFilter', 'bdBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the business device module and render function', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './business-device.js'"));
  assert.ok(app.includes('renderBusinessDevices()'));
  assert.ok(app.includes('shahdara_business_devices_v1'));
});
