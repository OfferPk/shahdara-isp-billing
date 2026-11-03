import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeConnectionRecord,
  normalizeConnectionRecords,
  normalizeOnuHistoryEntry,
  buildConnectionRegister,
  findPortClash,
  findPortClashes,
  upsertConnectionRecord,
  swapOnu,
  buildConnectionEntry,
  buildPortRegister,
  connectionSummaryText,
  connectionRegisterHtml,
  connectionRegisterCsv,
} from '../connection-register.js';

const a = {
  customerId: 'c1', customerName: 'Ahmed', oltId: 'OLT-1', ponPort: '3',
  splitter: 'SP-12', onuSerial: 'ONU001', installDate: '2026-11-01',
};
const b = {
  customerId: 'c2', customerName: 'Bilal', oltId: 'OLT-1', ponPort: '5',
  splitter: 'SP-13', onuSerial: 'ONU002', installDate: '2026-11-02',
};

test('normalise: trims, upper-cases port and serial, keeps valid install date', () => {
  const r = normalizeConnectionRecord({
    customerId: ' c9 ', customerName: '  Zara ', oltId: ' olt-1 ',
    ponPort: ' pon-3 ', splitter: ' SP-9 ', onuSerial: ' onu99 ',
    installDate: '2026-11-03',
  });
  assert.equal(r.customerId, 'c9');
  assert.equal(r.customerName, 'Zara');
  assert.equal(r.oltId, 'olt-1');
  assert.equal(r.ponPort, 'PON-3');
  assert.equal(r.splitter, 'SP-9');
  assert.equal(r.onuSerial, 'ONU99');
  assert.equal(r.installDate, '2026-11-03');
  assert.deepEqual(r.onuHistory, []);
});

test('normalise: no customer id means no record, never an anonymous row', () => {
  assert.equal(normalizeConnectionRecord({ oltId: 'OLT-1', ponPort: '3' }), null);
  assert.equal(normalizeConnectionRecord(null), null);
  assert.equal(normalizeConnectionRecord('c1'), null);
});

test('normalise: invalid install date becomes null, never a guessed date', () => {
  assert.equal(normalizeConnectionRecord({ ...a, installDate: '2026-02-30' }).installDate, null);
  assert.equal(normalizeConnectionRecord({ ...a, installDate: '03-11-2026' }).installDate, null);
  assert.equal(normalizeConnectionRecord({ ...a, installDate: '' }).installDate, null);
});

test('normalise: empty OLT stays empty (unassigned), never silently OLT-1', () => {
  const r = normalizeConnectionRecord({ customerId: 'c1', ponPort: '3' });
  assert.equal(r.oltId, '');
  assert.equal(r.ponPort, '3');
});

test('history: entries without a serial are dropped, bad swap dates become null', () => {
  assert.equal(normalizeOnuHistoryEntry({ serial: '' }), null);
  assert.equal(normalizeOnuHistoryEntry(null), null);
  const r = normalizeConnectionRecord({
    ...a,
    onuHistory: [
      { serial: 'old1', replacedAt: '2026-10-01', note: 'Faulty' },
      { serial: '', replacedAt: '2026-10-02' },
      { serial: 'old2', replacedAt: 'not-a-date' },
    ],
  });
  assert.deepEqual(r.onuHistory, [
    { serial: 'OLD1', replacedAt: '2026-10-01', note: 'Faulty' },
    { serial: 'OLD2', replacedAt: null, note: '' },
  ]);
});

test('records: last row per customer wins, sorted by name A–Z case-insensitively', () => {
  const rows = normalizeConnectionRecords([
    { ...b, customerName: 'bilal' },
    { ...a, customerName: 'ahmed' },
    { ...a, ponPort: '9', onuSerial: 'ONU009' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].customerName, 'Ahmed');
  assert.equal(rows[0].ponPort, '9');
  assert.equal(rows[0].onuSerial, 'ONU009');
  assert.equal(rows[1].customerName, 'bilal');
});

test('records: inputs are never mutated', () => {
  const input = [{ ...a, onuHistory: [{ serial: 'OLD', replacedAt: '2026-10-01' }] }];
  const before = JSON.stringify(input);
  normalizeConnectionRecords(input);
  swapOnu(input[0], 'ONU777', { replacedAt: '2026-11-03' });
  assert.equal(JSON.stringify(input), before);
});

test('clash: same OLT and port held by another customer warns with the holder', () => {
  const clash = findPortClash([a, b], { customerId: 'c3', customerName: 'Usman', oltId: 'OLT-1', ponPort: '3' });
  assert.equal(clash.customerId, 'c1');
  assert.equal(clash.customerName, 'Ahmed');
});

test('clash: same port on a different OLT is no clash', () => {
  assert.equal(findPortClash([a], { customerId: 'c3', oltId: 'OLT-2', ponPort: '3' }), null);
});

test('clash: a record never clashes with itself, and an empty port never clashes', () => {
  assert.equal(findPortClash([a, b], a), null);
  assert.equal(findPortClash([a, b], { customerId: 'c3', oltId: 'OLT-1', ponPort: '' }), null);
});

test('clash: port comparison is case-insensitive', () => {
  const holder = { ...a, ponPort: 'PON-3' };
  assert.equal(findPortClash([holder], { customerId: 'c3', oltId: 'OLT-1', ponPort: 'pon-3' }).customerId, 'c1');
});

test('clash: unassigned-OLT rows with the same port clash, because the port is ambiguous', () => {
  const holder = { customerId: 'c1', customerName: 'Ahmed', ponPort: '7' };
  assert.equal(findPortClash([holder], { customerId: 'c2', ponPort: '7' }).customerId, 'c1');
});

test('upsert: a new record is added and the clash warning is returned with it', () => {
  const { records, clash, saved } = upsertConnectionRecord([a, b], {
    customerId: 'c3', customerName: 'Usman', oltId: 'OLT-1', ponPort: '3', onuSerial: 'ONU003',
  });
  assert.equal(records.length, 3);
  assert.equal(clash.customerName, 'Ahmed');
  assert.equal(saved.customerId, 'c3');
  // The holder's own record is untouched.
  assert.equal(records.find((r) => r.customerId === 'c1').onuSerial, 'ONU001');
});

test('upsert: re-saving a customer updates in place, still one record per customer', () => {
  const { records, clash } = upsertConnectionRecord([a, b], { ...a, splitter: 'SP-99' });
  assert.equal(records.length, 2);
  assert.equal(clash, null);
  assert.equal(records.find((r) => r.customerId === 'c1').splitter, 'SP-99');
});

test('upsert: a record without a customer is not saved', () => {
  const { records, saved } = upsertConnectionRecord([a], { oltId: 'OLT-1', ponPort: '3' });
  assert.equal(records.length, 1);
  assert.equal(saved, null);
});

test('swap: old serial is kept in history with date and note', () => {
  const next = swapOnu(a, 'ONU777', { replacedAt: '2026-11-03', note: 'Faulty device' });
  assert.equal(next.onuSerial, 'ONU777');
  assert.deepEqual(next.onuHistory, [{ serial: 'ONU001', replacedAt: '2026-11-03', note: 'Faulty device' }]);
  assert.equal(a.onuSerial, 'ONU001');
  assert.deepEqual(a.onuHistory ?? [], []);
});

test('swap: no old serial means no history entry, and same serial changes nothing', () => {
  const noOld = { ...a, onuSerial: '' };
  const next = swapOnu(noOld, 'ONU777', { replacedAt: '2026-11-03' });
  assert.equal(next.onuSerial, 'ONU777');
  assert.deepEqual(next.onuHistory, []);
  const same = swapOnu(a, 'onu001', {});
  assert.equal(same.onuSerial, 'ONU001');
  assert.deepEqual(same.onuHistory, []);
});

test('swap: an empty new serial changes nothing, and a bad swap date becomes null', () => {
  assert.equal(swapOnu(a, '', {}).onuSerial, 'ONU001');
  const next = swapOnu(a, 'ONU777', { replacedAt: '2026-02-30' });
  assert.equal(next.onuHistory[0].replacedAt, null);
});

test('swap: a second swap keeps both old serials, oldest first', () => {
  const first = swapOnu(a, 'ONU777', { replacedAt: '2026-11-03' });
  const second = swapOnu(first, 'ONU888', { replacedAt: '2026-11-10', note: 'Upgrade' });
  assert.deepEqual(second.onuHistory.map((h) => h.serial), ['ONU001', 'ONU777']);
  assert.equal(second.onuHistory[1].note, 'Upgrade');
});

test('register: rows for non-active customers are excluded from ports and clashes', () => {
  const archived = { ...a, customerId: 'c9', customerName: 'Old', ponPort: '3' };
  const reg = buildConnectionRegister([a, archived], ['c1']);
  assert.equal(reg.records.length, 1);
  assert.equal(reg.excluded.length, 1);
  assert.equal(reg.excluded[0].customerId, 'c9');
  assert.deepEqual(reg.clashes, []);
});

test('register: without an active list, every row counts', () => {
  const reg = buildConnectionRegister([a, b]);
  assert.equal(reg.records.length, 2);
  assert.deepEqual(reg.excluded, []);
});

test('port register: free versus used per OLT with a stated total', () => {
  const reg = buildPortRegister([a, b], { 'OLT-1': 8 });
  assert.equal(reg.olts.length, 1);
  assert.deepEqual(reg.olts[0].usedPorts, ['3', '5']);
  assert.deepEqual(reg.olts[0].freePorts, ['1', '2', '4', '6', '7', '8']);
  assert.equal(reg.olts[0].freeCount, 6);
  assert.equal(reg.totalUsed, 2);
});

test('port register: without a stated total, free is unknown, never guessed', () => {
  const reg = buildPortRegister([a, b], null);
  assert.equal(reg.olts[0].totalPorts, null);
  assert.equal(reg.olts[0].freePorts, null);
  assert.equal(reg.olts[0].freeCount, null);
  assert.deepEqual(reg.olts[0].usedPorts, ['3', '5']);
});

test('port register: an OLT with no records still lists all its ports free', () => {
  const reg = buildPortRegister([a], { 'OLT-1': 4, 'OLT-2': 4 });
  assert.equal(reg.olts.length, 2);
  const second = reg.olts.find((o) => o.oltId === 'OLT-2');
  assert.deepEqual(second.usedPorts, []);
  assert.deepEqual(second.freePorts, ['1', '2', '3', '4']);
});

test('port register: records without a port are listed, never dropped', () => {
  const reg = buildPortRegister([{ ...a, ponPort: '' }], { 'OLT-1': 4 });
  assert.equal(reg.olts[0].unassignedCustomers.length, 1);
  assert.deepEqual(reg.olts[0].usedPorts, []);
  assert.deepEqual(reg.olts[0].freePorts, ['1', '2', '3', '4']);
});

test('port register: records without an OLT group under Unassigned OLT', () => {
  const reg = buildPortRegister([{ customerId: 'c1', customerName: 'Ahmed', ponPort: '2' }], null);
  assert.equal(reg.olts[0].label, 'Unassigned OLT');
  assert.deepEqual(reg.olts[0].usedPorts, ['2']);
});

test('port register: non-numeric used ports make free unknown', () => {
  const reg = buildPortRegister([{ ...a, ponPort: 'PON-A' }], { 'OLT-1': 8 });
  assert.deepEqual(reg.olts[0].usedPorts, ['PON-A']);
  assert.equal(reg.olts[0].freePorts, null);
});

test('port register: clash groups name every holder of the same port', () => {
  const reg = buildPortRegister([a, { ...b, ponPort: '3' }], { 'OLT-1': 8 });
  assert.equal(reg.clashCount, 1);
  assert.equal(reg.clashes[0].ponPort, '3');
  assert.deepEqual(reg.clashes[0].holders.map((h) => h.customerName), ['Ahmed', 'Bilal']);
  assert.equal(reg.olts[0].clashes.length, 1);
  assert.equal(reg.totalUsed, 1);
});

test('entry: profile name fills a record without a name', () => {
  const entry = buildConnectionEntry({ id: 'c1', customerName: 'Ahmed' }, { customerId: 'c1', oltId: 'OLT-1', ponPort: '3' });
  assert.equal(entry.customerName, 'Ahmed');
  assert.equal(entry.record.ponPort, '3');
  const empty = buildConnectionEntry({ id: 'c1', customerName: 'Ahmed' }, null);
  assert.equal(empty.record, null);
  assert.equal(empty.customerName, 'Ahmed');
});

test('summary: counts records, assigned ports, and clashes', () => {
  const reg = buildPortRegister([a, { ...b, ponPort: '3' }], null);
  assert.equal(connectionSummaryText([a, b], reg), '2 connection records · 2 ports assigned · 1 port clash needs attention');
  assert.equal(connectionSummaryText([], null), '0 connection records · 0 ports assigned');
});

test('html: names and serials are escaped, clash warning names the holders', () => {
  const evil = { ...a, customerName: '<script>alert(1)</script>' };
  const html = connectionRegisterHtml(buildPortRegister([evil, { ...b, ponPort: '3' }], null), [evil, b]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('is held by'));
});

test('csv: header plus one row per record, commas quoted', () => {
  const csv = connectionRegisterCsv([{ ...a, customerName: 'Ahmed, Jr', onuHistory: [{ serial: 'OLD1', replacedAt: null, note: '' }] }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Customer ID,Customer Name,OLT,PON Port,Splitter,ONU Serial,Install Date,Previous ONU Serials');
  assert.ok(lines[1].includes('"Ahmed, Jr"'));
  assert.ok(lines[1].includes('OLD1'));
});
