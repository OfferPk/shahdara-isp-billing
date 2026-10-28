// SISP-32: Street Pole, Landmark & Fiber Drop Wire Color Directory.
// Pure-function tests on synthetic data only. Pins: pole fields save via
// addCustomer/updateCustomerProfile, survive a JSON backup round-trip
// (export + merge into a local state with blank fields), and the Zone
// Lineman Cheat-Sheet groups customers accurately by zone and landmark
// (zone groups, pole-then-name order, archived excluded, upstream house
// resolved, converter status labeled). Nothing is seeded anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  updateCustomerProfile
} from '../core.js';
import {
  ZONE_NOT_RECORDED,
  buildCheatSheet,
  cheatSheetText,
  cheatSheetZones,
  converterStatus,
  normalizePoleFields,
  poleDirectorySummary,
  poleLandmarkDisplay,
  setupPoleLandmarkModal,
  upstreamHouseName
} from '../pole-landmark-book.js';

function customer(overrides = {}) {
  return {
    id: 'c-1',
    customerNumber: 1,
    name: 'Ahmed',
    phone: '03411234567',
    zone: 'Barrian',
    mohalla: 'Barrian',
    archived: false,
    upstreamCustomerId: '',
    mediaConverterOwnership: '',
    hardwareRecovered: { router: null, mediaConverter: null },
    poleNumber: '',
    boxLocationNote: '',
    dropWireCoreColor: '',
    ...overrides
  };
}

test('normalizePoleFields trims and defaults old records to empty', () => {
  assert.deepEqual(normalizePoleFields({}), { poleNumber: '', boxLocationNote: '', dropWireCoreColor: '' });
  assert.deepEqual(normalizePoleFields(customer({ poleNumber: '  Pole #14 near Masjid Bilal ', boxLocationNote: ' 2nd Floor White Gate ', dropWireCoreColor: ' Blue/Orange ' })), { poleNumber: 'Pole #14 near Masjid Bilal', boxLocationNote: '2nd Floor White Gate', dropWireCoreColor: 'Blue/Orange' });
  assert.equal(poleLandmarkDisplay(customer({})), 'Not recorded');
  assert.equal(poleLandmarkDisplay(customer({ boxLocationNote: '2nd Floor White Gate' })), '2nd Floor White Gate');
});

test('addCustomer stores the three pole fields and updateCustomerProfile edits them', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Pole Test Customer', new Date('2026-10-01'), {
    poleNumber: 'Pole #14 near Masjid Bilal',
    boxLocationNote: '2nd Floor White Gate',
    dropWireCoreColor: 'Blue/Orange'
  });
  const cust = state.customers.find((c) => c.name === 'Pole Test Customer');
  assert.equal(cust.poleNumber, 'Pole #14 near Masjid Bilal');
  assert.equal(cust.boxLocationNote, '2nd Floor White Gate');
  assert.equal(cust.dropWireCoreColor, 'Blue/Orange');
  state = updateCustomerProfile(state, cust.id, { poleNumber: 'Pole #15 near Park', dropWireCoreColor: 'Green/Red' });
  const updated = state.customers.find((c) => c.id === cust.id);
  assert.equal(updated.poleNumber, 'Pole #15 near Park');
  assert.equal(updated.boxLocationNote, '2nd Floor White Gate');
  assert.equal(updated.dropWireCoreColor, 'Green/Red');
  assert.equal(updated.name, 'Pole Test Customer');
  assert.throws(() => updateCustomerProfile(state, cust.id, { poleNumber: 'x'.repeat(101) }), /100 characters or fewer/);
  assert.throws(() => updateCustomerProfile(state, cust.id, { boxLocationNote: 'x'.repeat(201) }), /200 characters or fewer/);
});

test('pole fields survive a JSON backup export and merge (pinned criterion)', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Backup Pole Customer', new Date('2026-10-01'), {
    poleNumber: 'Pole #14 near Masjid Bilal',
    boxLocationNote: '2nd Floor White Gate',
    dropWireCoreColor: 'Blue/Orange'
  });
  const backupJson = createJsonBackup(state, new Date('2026-10-28T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  const exported = parsed.state.customers.find((c) => c.name === 'Backup Pole Customer');
  assert.equal(exported.poleNumber, 'Pole #14 near Masjid Bilal');
  assert.equal(exported.boxLocationNote, '2nd Floor White Gate');
  assert.equal(exported.dropWireCoreColor, 'Blue/Orange');

  const localState = JSON.parse(JSON.stringify(state));
  const local = localState.customers.find((c) => c.name === 'Backup Pole Customer');
  local.poleNumber = '';
  local.boxLocationNote = '';
  local.dropWireCoreColor = '';
  const preview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(preview.canApply, true);
  const merged = preview.state.customers.find((c) => c.name === 'Backup Pole Customer');
  assert.equal(merged.poleNumber, 'Pole #14 near Masjid Bilal');
  assert.equal(merged.boxLocationNote, '2nd Floor White Gate');
  assert.equal(merged.dropWireCoreColor, 'Blue/Orange');
});

test('an old backup without pole fields merges as empty (backward compatible)', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Old Backup Customer', new Date('2026-10-01'));
  const backupJson = createJsonBackup(state, new Date('2026-10-28T00:00:00Z'));
  const doc = JSON.parse(backupJson);
  const exported = doc.state.customers.find((c) => c.name === 'Old Backup Customer');
  delete exported.poleNumber;
  delete exported.boxLocationNote;
  delete exported.dropWireCoreColor;
  const preview = previewJsonBackupMerge(createInitialState(), JSON.stringify(doc));
  const merged = preview.state.customers.find((c) => c.name === 'Old Backup Customer');
  assert.equal(merged.poleNumber, '');
  assert.equal(merged.boxLocationNote, '');
  assert.equal(merged.dropWireCoreColor, '');
});

test('cheat-sheet groups by zone and sorts by pole then name (pinned criterion)', () => {
  const customers = [
    customer({ id: 'c-2', customerNumber: 2, name: 'Bilal', zone: 'Barrian', poleNumber: 'Pole #9 near Park' }),
    customer({ id: 'c-1', customerNumber: 1, name: 'Ahmed', zone: 'Barrian', poleNumber: 'Pole #14 near Masjid Bilal' }),
    customer({ id: 'c-3', customerNumber: 3, name: 'Usman', zone: 'Barrian', poleNumber: '' }),
    customer({ id: 'c-4', customerNumber: 4, name: 'Zain', zone: 'Barrian', poleNumber: 'Pole #14 near Masjid Bilal' }),
    customer({ id: 'c-5', customerNumber: 5, name: 'Omar', zone: 'Gangall', poleNumber: 'Pole #2' }),
    customer({ id: 'c-6', customerNumber: 6, name: 'Archived One', zone: 'Barrian', poleNumber: 'Pole #1', archived: true }),
    customer({ id: 'c-7', customerNumber: 7, name: 'No Zone', zone: '', poleNumber: 'Pole #3' })
  ];
  const groups = buildCheatSheet(customers);
  assert.deepEqual(groups.map((g) => g.zone), ['Barrian', 'Gangall', ZONE_NOT_RECORDED]);
  assert.deepEqual(groups[0].rows.map((r) => r.name), ['Bilal', 'Ahmed', 'Zain', 'Usman']);
  assert.deepEqual(groups[1].rows.map((r) => r.name), ['Omar']);
  assert.deepEqual(groups[2].rows.map((r) => r.name), ['No Zone']);
  assert.equal(groups.flatMap((g) => g.rows).some((r) => r.name === 'Archived One'), false);
  const barrianOnly = buildCheatSheet(customers, 'Barrian');
  assert.deepEqual(barrianOnly.map((g) => g.zone), ['Barrian']);
  assert.deepEqual(buildCheatSheet(customers, 'No such zone'), []);
});

test('cheat-sheet rows carry the spec columns with upstream house and converter status', () => {
  const upstream = customer({ id: 'up-1', customerNumber: 10, name: 'Upstream House Owner', zone: 'Barrian' });
  const leaf = customer({
    id: 'c-1', customerNumber: 1, name: 'Ahmed', phone: '03411234567', zone: 'Barrian',
    poleNumber: 'Pole #14 near Masjid Bilal', boxLocationNote: '2nd Floor White Gate',
    dropWireCoreColor: 'Blue/Orange', upstreamCustomerId: 'up-1',
    mediaConverterOwnership: 'isp-owned', hardwareRecovered: { router: null, mediaConverter: '2026-10-20' }
  });
  const direct = customer({ id: 'c-2', customerNumber: 2, name: 'Bilal', zone: 'Barrian' });
  const rows = buildCheatSheet([upstream, leaf, direct])[0].rows;
  const ahmed = rows.find((r) => r.name === 'Ahmed');
  assert.equal(ahmed.phone, '03411234567');
  assert.equal(ahmed.upstreamHouse, 'Upstream House Owner');
  assert.equal(ahmed.poleLandmark, 'Pole #14 near Masjid Bilal');
  assert.equal(ahmed.boxLocationNote, '2nd Floor White Gate');
  assert.equal(ahmed.dropWireCoreColor, 'Blue/Orange');
  assert.equal(ahmed.converterStatus, 'ISP Owned — Returnable · Recovered 2026-10-20');
  assert.equal(rows.find((r) => r.name === 'Bilal').upstreamHouse, 'Direct feed');
  assert.equal(upstreamHouseName([upstream, leaf], customer({ upstreamCustomerId: 'missing-id' })), 'Direct feed');
  assert.equal(converterStatus(customer({ mediaConverterOwnership: 'customer-owned' })), 'Customer Purchased');
  assert.equal(converterStatus(customer({})), 'Not recorded');
});

test('cheat-sheet zones, summary counts and export text', () => {
  const customers = [
    customer({ id: 'c-1', customerNumber: 1, name: 'Ahmed', zone: 'Barrian', poleNumber: 'Pole #14' }),
    customer({ id: 'c-2', customerNumber: 2, name: 'Bilal', zone: 'Gangall', boxLocationNote: 'White Gate' }),
    customer({ id: 'c-3', customerNumber: 3, name: 'Usman', zone: 'Barrian' }),
    customer({ id: 'c-4', customerNumber: 4, name: 'Archived One', zone: 'Barrian', poleNumber: 'Pole #1', archived: true })
  ];
  assert.deepEqual(cheatSheetZones(customers), ['Barrian', 'Gangall']);
  assert.deepEqual(poleDirectorySummary(customers), { totalCustomers: 3, mappedCount: 2 });
  const text = cheatSheetText(buildCheatSheet(customers));
  assert.match(text, /Zone: Barrian/);
  assert.match(text, /Ahmed \(#1\) — Phone: 03411234567 — Upstream house: Direct feed — Pole\/Landmark: Pole #14/);
  assert.match(text, /Converter: Not recorded/);
  assert.doesNotMatch(text, /Archived One/);
  assert.equal(cheatSheetText([]), 'Shahdara ISP — Zone Lineman Cheat-Sheet\n\nNo customers in this zone.');
});

test('modal setup returns null without a document (Node tests)', () => {
  assert.equal(setupPoleLandmarkModal(() => ({ customers: [] })), null);
});
