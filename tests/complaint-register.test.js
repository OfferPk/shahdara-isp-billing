// SISP-15: Centralized Monthly Complaint Register + Resolution Timeline.
// Pure-function tests on synthetic data only. Spec test criterion (verbatim):
// creating a complaint at 10:00 and marking it resolved at 14:30
// automatically computes downtimeHours = 4.5 and persists across page reloads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  COMPLAINTS_KEY,
  buildComplaintSummary,
  collectComplaintZones,
  complaintCustomerLabel,
  computeDowntimeHours,
  createComplaint,
  filterComplaints,
  formatDowntimeHours,
  loadComplaints,
  nextComplaintId,
  sanitizeComplaints,
  saveComplaints,
  setComplaintStatus,
  updateComplaint
} from '../complaint-register.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const base = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  zone: 'Shahdara Town',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-28T10:00',
  resolvedAt: '',
  downtimeHours: null,
  downtimeManual: false,
  status: 'Open',
  resolutionNote: '',
  createdAt: '',
  ...overrides
});

test('spec criterion: 10:00 reported, 14:30 resolved => downtimeHours 4.5, persists across reloads', () => {
  const storage = memoryStorage();
  const created = createComplaint({
    customerId: 'c1',
    customerName: 'Test Customer 11',
    zone: 'Shahdara Town',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-28T10:00'
  }, [], new Date('2026-10-28T10:00:00'));
  assert.equal(created.id, 'CMP-101');
  assert.equal(created.status, 'Open');
  assert.equal(created.downtimeHours, null);
  assert.equal(saveComplaints([created], storage), true);
  // "Page reload": fresh load from the same storage.
  const reloaded = loadComplaints(storage);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, 'CMP-101');
  const resolved = setComplaintStatus(reloaded, 'CMP-101', 'Resolved', { resolvedAt: '2026-10-28T14:30' });
  assert.equal(resolved[0].status, 'Resolved');
  assert.equal(resolved[0].resolvedAt, '2026-10-28T14:30');
  assert.equal(resolved[0].downtimeHours, 4.5);
  assert.equal(saveComplaints(resolved, storage), true);
  // Reload again: the computed downtime survives.
  const reloadedAgain = loadComplaints(storage);
  assert.equal(reloadedAgain[0].downtimeHours, 4.5);
  assert.equal(reloadedAgain[0].status, 'Resolved');
});

test('resolve without an explicit time auto-fills resolvedAt and computes downtime', () => {
  const created = createComplaint({
    customerId: 'c1', customerName: 'Test Customer 11', zone: 'Barrian',
    issueCategory: 'Router / Wi-Fi Config', reportedAt: '2026-10-28T08:00'
  }, []);
  const resolved = setComplaintStatus([created], 'CMP-101', 'Resolved', { referenceDate: new Date('2026-10-28T11:30:00+05:00') });
  assert.equal(resolved[0].status, 'Resolved');
  assert.equal(resolved[0].downtimeHours, 3.5);
});

test('status toggle: start moves Open to In Progress, reopen clears the timeline', () => {
  const started = setComplaintStatus([base()], 'CMP-101', 'In Progress');
  assert.equal(started[0].status, 'In Progress');
  const resolved = setComplaintStatus(started, 'CMP-101', 'Resolved', { resolvedAt: '2026-10-28T12:00' });
  assert.equal(resolved[0].downtimeHours, 2);
  const reopened = setComplaintStatus(resolved, 'CMP-101', 'Open');
  assert.equal(reopened[0].status, 'Open');
  assert.equal(reopened[0].resolvedAt, '');
  assert.equal(reopened[0].downtimeHours, null);
  assert.throws(() => setComplaintStatus([base()], 'CMP-101', 'Closed'), /Unknown complaint status/);
  assert.throws(() => setComplaintStatus([base()], 'CMP-999', 'Resolved'), /Complaint not found/);
});

test('manual downtime override survives later time edits', () => {
  const resolved = setComplaintStatus([base()], 'CMP-101', 'Resolved', { resolvedAt: '2026-10-28T14:30' });
  assert.equal(resolved[0].downtimeHours, 4.5);
  const manual = updateComplaint(resolved, 'CMP-101', { downtimeHours: '6' });
  assert.equal(manual[0].downtimeHours, 6);
  assert.equal(manual[0].downtimeManual, true);
  const edited = updateComplaint(manual, 'CMP-101', { resolvedAt: '2026-10-28T16:00' });
  assert.equal(edited[0].downtimeHours, 6);
  // Without an override, a time edit recomputes.
  const auto = updateComplaint(resolved, 'CMP-101', { resolvedAt: '2026-10-28T16:00' });
  assert.equal(auto[0].downtimeHours, 6);
});

test('inline edits: reportedAt, resolvedAt, note, zone, category', () => {
  const edited = updateComplaint([base()], 'CMP-101', {
    reportedAt: '2026-10-28T09:00',
    resolutionNote: 'Spliced at the pole',
    zone: 'Palaliya',
    issueCategory: 'Fiber Splice Loss'
  });
  assert.equal(edited[0].reportedAt, '2026-10-28T09:00');
  assert.equal(edited[0].resolutionNote, 'Spliced at the pole');
  assert.equal(edited[0].zone, 'Palaliya');
  assert.equal(edited[0].issueCategory, 'Fiber Splice Loss');
  const invalid = updateComplaint([base()], 'CMP-101', { reportedAt: 'not-a-date', issueCategory: 'Nope' });
  assert.equal(invalid[0].reportedAt, '2026-10-28T10:00');
  assert.equal(invalid[0].issueCategory, 'Fiber Cut');
});

test('filters: month, status, customer, zone, category', () => {
  const list = [
    base(),
    base({ id: 'CMP-102', customerId: 'c2', customerName: 'Test Customer 09', zone: 'Barrian', issueCategory: 'WAPDA / Power Outage', reportedAt: '2026-09-15T08:00', status: 'Resolved', resolvedAt: '2026-09-15T10:00', downtimeHours: 2 }),
    base({ id: 'CMP-103', customerId: AREA_OUTAGE_CUSTOMER_ID, customerName: AREA_OUTAGE_CUSTOMER_ID, zone: 'Chandall', issueCategory: 'Main Uplink / NayaPay Down', reportedAt: '2026-10-02T07:00', status: 'In Progress' })
  ];
  assert.deepEqual(filterComplaints(list, { month: '2026-10' }).map((c) => c.id), ['CMP-101', 'CMP-103']);
  assert.deepEqual(filterComplaints(list, { status: 'Resolved' }).map((c) => c.id), ['CMP-102']);
  assert.deepEqual(filterComplaints(list, { customer: 'c2' }).map((c) => c.id), ['CMP-102']);
  assert.deepEqual(filterComplaints(list, { customer: 'Test Customer 09' }).map((c) => c.id), ['CMP-102']);
  assert.deepEqual(filterComplaints(list, { zone: 'Barrian' }).map((c) => c.id), ['CMP-102']);
  assert.deepEqual(filterComplaints(list, { category: 'Main Uplink / NayaPay Down' }).map((c) => c.id), ['CMP-103']);
  assert.deepEqual(filterComplaints(list, { month: '2026-10', status: 'Open' }).map((c) => c.id), ['CMP-101']);
  assert.equal(filterComplaints(list, {}).length, 3);
});

test('AREA_OUTAGE: needs a zone, stores the sentinel, renders as area outage', () => {
  assert.throws(() => createComplaint({ customerId: AREA_OUTAGE_CUSTOMER_ID, issueCategory: 'Fiber Cut', zone: '' }, []), /needs a zone/);
  const outage = createComplaint({ customerId: AREA_OUTAGE_CUSTOMER_ID, issueCategory: 'Main Uplink / NayaPay Down', zone: 'Banii', reportedAt: '2026-10-28T06:00' }, []);
  assert.equal(outage.customerId, AREA_OUTAGE_CUSTOMER_ID);
  assert.equal(outage.customerName, AREA_OUTAGE_CUSTOMER_ID);
  assert.equal(complaintCustomerLabel(outage), 'Area outage · Banii');
  assert.equal(complaintCustomerLabel(base()), 'Test Customer 11');
});

test('ticket ids increment from the highest existing CMP-N, starting at CMP-101', () => {
  assert.equal(nextComplaintId([]), 'CMP-101');
  assert.equal(nextComplaintId([{ id: 'CMP-101' }, { id: 'CMP-107' }, { id: 'other' }]), 'CMP-108');
  const second = createComplaint({ customerId: 'c1', customerName: 'X', zone: 'Z', issueCategory: 'Other' }, [{ id: 'CMP-101' }]);
  assert.equal(second.id, 'CMP-102');
});

test('sanitize drops malformed rows and repairs unknown status/category', () => {
  const cleaned = sanitizeComplaints([
    null,
    { id: '', customerId: 'c1' },
    { id: 'CMP-201', customerId: 'c1', customerName: '  A  ', status: 'Closed', issueCategory: 'Nope', reportedAt: 'bad', downtimeHours: -3 },
    { id: 'CMP-202', customerId: 'c1', customerName: 'B', status: 'Resolved', issueCategory: 'Fiber Cut', reportedAt: '2026-10-28T10:00', resolvedAt: '2026-10-28T11:00', downtimeHours: 1 }
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].status, 'Open');
  assert.equal(cleaned[0].issueCategory, 'Other');
  assert.equal(cleaned[0].reportedAt, '');
  assert.equal(cleaned[0].downtimeHours, null);
  assert.equal(cleaned[1].downtimeHours, 1);
  assert.deepEqual(loadComplaints(memoryStorage()), []);
  assert.equal(COMPLAINTS_KEY, 'sisp_complaints_ledger_v1');
});

test('downtime math edge cases', () => {
  assert.equal(computeDowntimeHours('2026-10-28T10:00', '2026-10-28T14:30'), 4.5);
  assert.equal(computeDowntimeHours('2026-10-28T10:00', '2026-10-28T10:15'), 0.25);
  assert.equal(computeDowntimeHours('2026-10-28T14:30', '2026-10-28T10:00'), 0);
  assert.equal(computeDowntimeHours('', '2026-10-28T10:00'), null);
  assert.equal(computeDowntimeHours('2026-10-28T10:00', ''), null);
  assert.equal(formatDowntimeHours(4.5), '4.5 h');
  assert.equal(formatDowntimeHours(null), 'Not resolved yet');
});

test('dashboard summary counts and downtime totals', () => {
  const list = [
    base(),
    base({ id: 'CMP-102', status: 'In Progress' }),
    base({ id: 'CMP-103', status: 'Resolved', resolvedAt: '2026-10-28T12:00', downtimeHours: 2 }),
    base({ id: 'CMP-104', reportedAt: '2026-09-01T09:00', status: 'Resolved', resolvedAt: '2026-09-01T10:00', downtimeHours: 1 })
  ];
  const summary = buildComplaintSummary(list, new Date('2026-10-28T12:00:00'));
  assert.equal(summary.total, 4);
  assert.equal(summary.open, 1);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.resolved, 2);
  assert.equal(summary.thisMonthCount, 3);
  assert.equal(summary.thisMonthDowntime, 2);
  assert.equal(summary.totalDowntime, 3);
});

test('zones combine customer zones with known Shahdara zones', () => {
  const zones = collectComplaintZones({ customers: [{ zone: 'Custom Zone' }, { zone: '' }, { zone: 'Barrian' }] });
  assert.ok(zones.includes('Custom Zone'));
  assert.ok(zones.includes('Shahdara Town'));
  assert.ok(zones.includes('Barrian'));
  assert.equal(zones.filter((z) => z === 'Barrian').length, 1);
});

test('backup round-trip: complaints travel in settings.complaints under safe-merge rules', () => {
  const state = createInitialState();
  const complaints = [base({ reportedAt: '2026-10-28T10:00' })];
  const when = new Date('2026-10-28T12:00:00');
  const backup = createJsonBackup(state, when, { complaints });
  const document = JSON.parse(backup);
  assert.equal(document.settings.complaints.length, 1);
  assert.equal(document.settings.complaints[0].id, 'CMP-101');
  // Device with no complaints adopts the backup's records.
  const preview = previewJsonBackupMerge(state, backup, { currentComplaints: [], currentComplaintsStored: false });
  assert.equal(preview.complaints.length, 1);
  assert.equal(preview.counts.complaintsRestored, 1);
  // Device with different records keeps its own + reports a conflict.
  const different = [base({ id: 'CMP-900' })];
  const conflict = previewJsonBackupMerge(state, backup, { currentComplaints: different, currentComplaintsStored: true });
  assert.equal(conflict.complaints, null);
  assert.ok(conflict.conflicts.some((c) => /Complaint register/.test(c.field)));
  // No complaints section when the ledger is empty.
  const empty = JSON.parse(createJsonBackup(state, when, { complaints: [] }));
  assert.equal(empty.settings?.complaints, undefined);
});
