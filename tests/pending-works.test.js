// Pending Works: owner notes & reminders with customer-count thresholds.
// Pure-function tests on synthetic data only. Pins the owner's exact
// examples: 95/100 → 5 more to go (not due); 100/100 → DUE; archived
// customers never count; plain notes never auto-due; done/pending toggle
// round-trip; edit + delete; backup safe-merge. The list starts empty —
// no example notes are seeded anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  PENDING_WORKS_KEY,
  addPendingWork,
  countActiveCustomers,
  deletePendingWork,
  filterPendingWorks,
  isDue,
  loadPendingWorks,
  parseThreshold,
  pendingWorksSummary,
  progressFor,
  progressLabel,
  sanitizePendingWorks,
  savePendingWorks,
  sortedPendingWorks,
  togglePendingWorkStatus,
  updatePendingWork
} from '../pending-works.js';

const CUSTOMERS_95 = Array.from({ length: 95 }, (_, i) => ({
  id: `c-${i}`, name: `Customer ${i}`, customerNumber: i + 1, archived: false
}));
const CUSTOMERS_100 = [...CUSTOMERS_95, ...Array.from({ length: 5 }, (_, i) => ({
  id: `c-9${i}`, name: `Customer 9${i}`, customerNumber: 96 + i, archived: false
}))];
const CUSTOMERS_WITH_ARCHIVED = [
  ...CUSTOMERS_95,
  { id: 'a-1', name: 'Archived 1', customerNumber: 96, archived: true },
  { id: 'a-2', name: 'Archived 2', customerNumber: 97, archived: true },
  { id: 'a-3', name: 'Archived 3', customerNumber: 98, archived: true },
  { id: 'a-4', name: 'Archived 4', customerNumber: 99, archived: true },
  { id: 'a-5', name: 'Archived 5', customerNumber: 100, archived: true }
];

function note(overrides = {}) {
  return { note: 'Nasir se splicing machine mangwani hai', source: 'Nasir', threshold: '100', ...overrides };
}

test('threshold math, owner example: 95/100 → 5 more to go, NOT due', () => {
  const items = addPendingWork([], note());
  assert.equal(countActiveCustomers(CUSTOMERS_95), 95);
  assert.deepEqual(progressFor(items[0], 95), { current: 95, threshold: 100, remaining: 5, due: false });
  assert.equal(progressLabel(items[0], 95), '95/100 — 5 more to go');
  assert.equal(isDue(items[0], 95), false);
});

test('threshold math: 100/100 → DUE, and 101/100 → DUE', () => {
  const items = addPendingWork([], note());
  assert.equal(isDue(items[0], 100), true);
  assert.equal(progressLabel(items[0], 100), '100/100 — due now');
  assert.equal(isDue(items[0], 101), true);
  assert.equal(progressLabel(items[0], 101), '101/100 — due now');
});

test('archived customers never count: 95 active + 5 archived is still 95, not due', () => {
  assert.equal(countActiveCustomers(CUSTOMERS_WITH_ARCHIVED), 95);
  const items = addPendingWork([], note());
  assert.equal(isDue(items[0], countActiveCustomers(CUSTOMERS_WITH_ARCHIVED)), false);
});

test('plain note (no threshold) is NEVER auto-due, even at 500 customers', () => {
  const items = addPendingWork([], note({ threshold: '' }));
  assert.equal(items[0].threshold, null);
  assert.equal(isDue(items[0], 500), false);
  assert.equal(progressLabel(items[0], 500), '');
});

test('dashboard summary: due count, pending count, nearest threshold', () => {
  let items = [];
  items = addPendingWork(items, note({ note: 'Splicing machine', threshold: '100' }));
  items = addPendingWork(items, note({ note: 'OLT pull side', threshold: '100' }));
  items = addPendingWork(items, note({ note: 'Plain reminder', threshold: '' }));
  const summary = pendingWorksSummary(items, 95);
  assert.equal(summary.pendingCount, 3);
  assert.equal(summary.dueCount, 0);
  assert.equal(summary.nearestLabel, '95/100 — 5 more to go');
  const dueSummary = pendingWorksSummary(items, 100);
  assert.equal(dueSummary.dueCount, 2);
  assert.equal(dueSummary.dueItems.length, 2);
});

test('list order: DUE first, then pending, then done dimmed', () => {
  let items = [];
  items = addPendingWork(items, note({ note: 'Plain', threshold: '' }));
  items = addPendingWork(items, note({ note: 'Due item', threshold: '100' }));
  items = addPendingWork(items, note({ note: 'Done item', threshold: '' }));
  items = togglePendingWorkStatus(items, items[2].id);
  const sorted = sortedPendingWorks(items, 100);
  assert.deepEqual(sorted.map((item) => item.note), ['Due item', 'Plain', 'Done item']);
  assert.deepEqual(filterPendingWorks(items, 100, 'due').map((item) => item.note), ['Due item']);
  assert.deepEqual(filterPendingWorks(items, 100, 'done').map((item) => item.note), ['Done item']);
});

test('done/pending toggle round-trip never deletes', () => {
  let items = addPendingWork([], note());
  const id = items[0].id;
  items = togglePendingWorkStatus(items, id);
  assert.equal(items[0].status, 'done');
  assert.equal(items.length, 1);
  items = togglePendingWorkStatus(items, id);
  assert.equal(items[0].status, 'pending');
  assert.equal(items.length, 1);
});

test('edit changes text/source/threshold and preserves id, status, createdAt', () => {
  let items = addPendingWork([], note());
  const id = items[0].id;
  const createdAt = items[0].createdAt;
  items = togglePendingWorkStatus(items, id);
  items = updatePendingWork(items, id, { note: 'OLT lagwani hai pull side', source: 'Owner', threshold: '120' });
  assert.equal(items[0].note, 'OLT lagwani hai pull side');
  assert.equal(items[0].source, 'Owner');
  assert.equal(items[0].threshold, 120);
  assert.equal(items[0].id, id);
  assert.equal(items[0].status, 'done');
  assert.equal(items[0].createdAt, createdAt);
});

test('edit to a plain note clears the threshold', () => {
  let items = addPendingWork([], note());
  items = updatePendingWork(items, items[0].id, { note: 'Same note', source: '', threshold: '' });
  assert.equal(items[0].threshold, null);
});

test('delete removes only that item', () => {
  let items = [];
  items = addPendingWork(items, note({ note: 'First' }));
  items = addPendingWork(items, note({ note: 'Second' }));
  items = deletePendingWork(items, items[0].id);
  assert.deepEqual(items.map((item) => item.note), ['Second']);
});

test('validation: empty note throws; bad threshold throws; blank threshold is null', () => {
  assert.throws(() => addPendingWork([], note({ note: '   ' })), /needs its text/);
  assert.throws(() => addPendingWork([], note({ threshold: '0' })), /positive whole number/);
  assert.throws(() => addPendingWork([], note({ threshold: '-5' })), /positive whole number/);
  assert.throws(() => addPendingWork([], note({ threshold: '2.5' })), /positive whole number/);
  assert.equal(parseThreshold(''), null);
  assert.equal(parseThreshold('100'), 100);
  assert.throws(() => updatePendingWork(addPendingWork([], note()), 'PW-999', note()), /not found/);
  assert.throws(() => togglePendingWorkStatus([], 'PW-1'), /not found/);
  assert.throws(() => deletePendingWork([], 'PW-1'), /not found/);
});

test('sanitize drops malformed rows and normalizes threshold/status', () => {
  const cleaned = sanitizePendingWorks([
    null,
    { note: '  ', threshold: '100' },
    { note: 'Good', threshold: 'abc', status: 'weird' },
    { note: 'With threshold', threshold: '100.9', status: 'done' }
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].threshold, null);
  assert.equal(cleaned[0].status, 'pending');
  assert.equal(cleaned[1].threshold, 100);
  assert.equal(cleaned[1].status, 'done');
});

test('storage round-trip via a fake store; corrupt storage reads as []', () => {
  const store = new Map();
  const fake = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value)
  };
  assert.deepEqual(loadPendingWorks(fake), []);
  const items = addPendingWork([], note());
  assert.equal(savePendingWorks(items, fake), true);
  assert.equal(loadPendingWorks(fake).length, 1);
  assert.equal(loadPendingWorks(fake)[0].note, 'Nasir se splicing machine mangwani hai');
  store.set(PENDING_WORKS_KEY, '{not json');
  assert.deepEqual(loadPendingWorks(fake), []);
});

test('backup: adopt when this device has none; conflict when both differ', () => {
  const requests = addPendingWork([], note());
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { pendingWorks: requests });
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.pendingWorks.length, 1);
  assert.equal(preview.pendingWorks[0].note, 'Nasir se splicing machine mangwani hai');
  const other = addPendingWork([], note({ note: 'Different note' }));
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentPendingWorks: other, currentPendingWorksStored: true });
  assert.equal(clash.pendingWorks, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Pending work records differ from this device'));
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentPendingWorks: requests, currentPendingWorksStored: true });
  assert.equal(identical.pendingWorks, null);
  assert.equal(identical.conflicts.length, 0);
});
