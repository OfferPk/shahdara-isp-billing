// SISP-173: Per-Lineman Attribution — field plumbing for
// installedByLineman (customer record) and resolvedByLineman (SISP-15
// register entries). Pure-function tests on synthetic data only.
// Pins: the customer field flows through addCustomer /
// updateCustomerProfile / readState / JSON backup round-trip with
// junk sanitizing to empty; the register field is stamped at resolve
// time, editable inline, preserved by nameless (ticket-sync) resolves,
// and cleared on reopen. No real person's name appears anywhere —
// fixtures use "Lineman A" / "Lineman B" only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  addCustomer,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile
} from '../core.js';
import {
  createComplaint,
  sanitizeComplaints,
  setComplaintStatus,
  updateComplaint
} from '../complaint-register.js';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    raw: () => data.get(STORAGE_KEY)
  };
}

test('addCustomer stores installedByLineman trimmed; missing or blank stays empty', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Install Test One', new Date('2026-10-01'), { installedByLineman: '  Lineman A  ' });
  state = addCustomer(state, 'Install Test Two', new Date('2026-10-01'));
  state = addCustomer(state, 'Install Test Three', new Date('2026-10-01'), { installedByLineman: '   ' });
  assert.equal(state.customers.find((c) => c.name === 'Install Test One').installedByLineman, 'Lineman A');
  assert.equal(state.customers.find((c) => c.name === 'Install Test Two').installedByLineman, '');
  assert.equal(state.customers.find((c) => c.name === 'Install Test Three').installedByLineman, '');
});

test('updateCustomerProfile edits installedByLineman and enforces the 100-char cap', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Profile Test', new Date('2026-10-01'), { installedByLineman: 'Lineman A' });
  const cust = state.customers.find((c) => c.name === 'Profile Test');
  state = updateCustomerProfile(state, cust.id, { installedByLineman: 'Lineman B' });
  assert.equal(state.customers.find((c) => c.id === cust.id).installedByLineman, 'Lineman B');
  state = updateCustomerProfile(state, cust.id, { installedByLineman: '   ' });
  assert.equal(state.customers.find((c) => c.id === cust.id).installedByLineman, '', 'blanking the field un-records it');
  assert.throws(() => updateCustomerProfile(state, cust.id, { installedByLineman: 'x'.repeat(101) }), /100 characters or fewer/);
});

test('readState trims the stored value, junk loads as empty, missing loads as empty', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Load Test', new Date('2026-10-01'), { installedByLineman: 'Lineman A' });
  const store = memoryStore();
  persistState(state, store);

  const tampered = JSON.parse(store.raw());
  tampered.customers.find((c) => c.name === 'Load Test').installedByLineman = 42;
  store.setItem(STORAGE_KEY, JSON.stringify(tampered));
  assert.equal(readState(store).customers.find((c) => c.name === 'Load Test').installedByLineman, '', 'non-string junk never poses as a name');

  const missing = JSON.parse(store.raw());
  delete missing.customers.find((c) => c.name === 'Load Test').installedByLineman;
  store.setItem(STORAGE_KEY, JSON.stringify(missing));
  assert.equal(readState(store).customers.find((c) => c.name === 'Load Test').installedByLineman, '', 'old saves load as not recorded');

  persistState(state, store);
  assert.equal(readState(store).customers.find((c) => c.name === 'Load Test').installedByLineman, 'Lineman A');
});

test('installedByLineman survives a JSON backup export and merge (pinned criterion)', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Backup Install Customer', new Date('2026-10-01'), { installedByLineman: 'Lineman A' });
  const backupJson = createJsonBackup(state, new Date('2026-10-28T00:00:00Z'));
  const exported = JSON.parse(backupJson).state.customers.find((c) => c.name === 'Backup Install Customer');
  assert.equal(exported.installedByLineman, 'Lineman A');

  const localState = JSON.parse(JSON.stringify(state));
  localState.customers.find((c) => c.name === 'Backup Install Customer').installedByLineman = '';
  const preview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(preview.canApply, true);
  assert.equal(preview.state.customers.find((c) => c.name === 'Backup Install Customer').installedByLineman, 'Lineman A');
});

test('an old backup without installedByLineman merges as empty (backward compatible)', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Old Backup Customer', new Date('2026-10-01'), { installedByLineman: 'Lineman A' });
  const doc = JSON.parse(createJsonBackup(state, new Date('2026-10-28T00:00:00Z')));
  delete doc.state.customers.find((c) => c.name === 'Old Backup Customer').installedByLineman;
  const preview = previewJsonBackupMerge(createInitialState(), JSON.stringify(doc));
  assert.equal(preview.state.customers.find((c) => c.name === 'Old Backup Customer').installedByLineman, '');
});

test('sanitizeComplaints keeps a trimmed resolvedByLineman and drops junk', () => {
  const cleaned = sanitizeComplaints([
    { id: 'CMP-401', customerId: 'c1', customerName: 'X', status: 'Resolved', issueCategory: 'Other', reportedAt: '2026-10-01T09:00', resolvedAt: '2026-10-01T12:00', resolvedByLineman: '  Lineman A  ' },
    { id: 'CMP-402', customerId: 'c1', customerName: 'Y', status: 'Resolved', issueCategory: 'Other', reportedAt: '2026-10-01T09:00', resolvedAt: '2026-10-01T12:00', resolvedByLineman: 42 },
    { id: 'CMP-403', customerId: 'c1', customerName: 'Z', status: 'Open', issueCategory: 'Other', reportedAt: '2026-10-01T09:00' }
  ]);
  assert.equal(cleaned.length, 3);
  assert.equal(cleaned[0].resolvedByLineman, 'Lineman A');
  assert.equal(cleaned[1].resolvedByLineman, '');
  assert.equal(cleaned[2].resolvedByLineman, '');
});

test('createComplaint starts resolver-less; resolve stamps the name; reopen clears it', () => {
  const created = createComplaint(
    { customerId: 'c1', customerName: 'X', zone: 'Z', issueCategory: 'Fiber Cut' },
    [],
    new Date('2026-10-05T09:00:00Z')
  );
  assert.equal(created.resolvedByLineman, '');
  let list = setComplaintStatus([created], created.id, 'Resolved', {
    resolvedByLineman: ' Lineman A ',
    referenceDate: new Date('2026-10-05T12:00:00Z')
  });
  assert.equal(list[0].status, 'Resolved');
  assert.equal(list[0].resolvedByLineman, 'Lineman A');
  list = setComplaintStatus(list, created.id, 'Open');
  assert.equal(list[0].resolvedByLineman, '', 'reopening undoes the resolution, resolver included');
  assert.equal(list[0].resolvedAt, '');
});

test('a nameless resolve (ticket-sync style) preserves the recorded resolver; inline edit can set it', () => {
  const created = createComplaint(
    { customerId: 'c1', customerName: 'X', zone: 'Z', issueCategory: 'Other' },
    [],
    new Date('2026-10-05T09:00:00Z')
  );
  let list = updateComplaint([created], created.id, { resolvedByLineman: 'Lineman B' });
  assert.equal(list[0].resolvedByLineman, 'Lineman B');
  list = setComplaintStatus(list, created.id, 'Resolved', { resolvedAt: '2026-10-05T18:00' });
  assert.equal(list[0].resolvedByLineman, 'Lineman B', 'sync resolves pass no name, so the field is left as recorded');
  assert.equal(list[0].status, 'Resolved');
});

test('complaints travel in JSON backups with resolvedByLineman intact', () => {
  const entry = {
    id: 'CMP-410', customerId: 'c1', customerName: 'X', zone: 'Z', issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-01T09:00', resolvedAt: '2026-10-01T12:00', downtimeHours: 3,
    downtimeManual: false, status: 'Resolved', resolutionNote: 'Fixed', resolvedByLineman: 'Lineman A',
    resolvedViaTicketId: '', syncReopenGuard: '', createdAt: '2026-10-01T04:00:00.000Z'
  };
  const state = createInitialState();
  const backupJson = createJsonBackup(state, new Date('2026-10-28T00:00:00Z'), { complaints: [entry] });
  const section = JSON.parse(backupJson).settings.complaints;
  assert.equal(section.length, 1);
  assert.equal(section[0].resolvedByLineman, 'Lineman A', 'the backup complaints section runs through sanitizeComplaints');
});
