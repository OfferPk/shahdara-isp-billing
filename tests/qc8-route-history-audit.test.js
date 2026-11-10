// QC-8 — Route history + audit (append-only visit log + stop-based progress).
//
// Pins:
// - Append-only visit log: every non-pending route outcome (route-sheet
//   buttons and QC-1 Field Mode marks alike) appends one log entry with
//   date, customer, outcome, note and timestamp. Re-marking a stop
//   APPENDS a second entry — the earlier entry is never overwritten or
//   erased. The single-slot outcome store still holds only the latest
//   mark (that is the round's current state, unchanged); the log is
//   the history beside it.
// - Multi-day history: the log survives past midnight (kept 90 days).
//   Yesterday's entries are still loadable and viewable by day, while
//   today's round still starts clean (the date-scoped outcome/note/
//   progress stores keep their midnight reset — that is the working
//   list, not the history).
// - Field outcomes in the audit log: every field outcome writes one
//   `field_visit` audit entry (action added by QC-8 as the 11th audit
//   action). Clearing a mark ('pending') writes neither a log entry
//   nor an audit entry — a clear is not a visit.
// - Stop-based route progress: calculateFieldCollectionRoutes returns
//   visitedStops / markedStops / pendingVisitStops / visitedRate
//   (visited = any non-pending outcome today; marked = visited but
//   not collected; a marked stop counts as visited, never as pending).
//   The money-based figures (completionRate, roundStatus,
//   collectedStops) are UNCHANGED by marks — a not_home mark never
//   moves the money progress. Sector/area breakdowns carry the same
//   stop counts.
// - The log never changes a payment record, bill or dues figure: the
//   only storage keys a mark writes are the outcome/progress stores
//   (pre-existing), the visit-log key and the audit-log key; route
//   totals are identical before and after marking.
// - Field Mode payments (markFieldVisitPaid) append a 'paid' log
//   entry; an unmarked customer pays nothing into the log.
//
// Synthetic data only. No customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_ROUTE_VISIT_LOG_KEY,
  VISIT_LOG_RETENTION_DAYS,
  VISIT_LOG_OUTCOME_LABELS,
  normalizeVisitLogEntry,
  normalizeVisitLog,
  appendVisitLogEntry,
  dateStringDaysAgo,
  pruneVisitLogEntries,
  loadVisitLog,
  saveVisitLog,
  recordVisitLogEntry,
  visitLogDates,
  visitLogEntriesForDate,
  visitHistoryDayHtml,
  visitHistoryDateOptionsHtml,
} from '../route-visit-history.js';
import {
  AUDIT_ACTIONS,
  AUDIT_LOG_STORAGE_KEY,
  auditActionLabel,
  normalizeAuditLog,
  normalizeAuditEntry,
} from '../audit-log.js';
import {
  FIELD_ROUTE_OUTCOMES_KEY,
  FIELD_ROUTE_PROGRESS_KEY,
  saveFieldRouteOutcome,
  getFieldRouteOutcomes,
  calculateFieldCollectionRoutes,
  routeVisitProgressText,
} from '../nav-collection-rounds.js';
import {
  saveFieldNotAvailableMark,
  clearFieldNotAvailableMark,
  markFieldVisitPaid,
} from '../field-mode.js';

const mockStorage = () => ({
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
});

const entry = (overrides = {}) => ({
  id: 'visit-20261109T120000-c1-0',
  date: '2026-11-09',
  customerId: 'c1',
  customerNumber: '12',
  customerName: 'Test Customer A',
  outcome: 'not_home',
  note: 'House locked',
  timestamp: '2026-11-09T12:00:00.000Z',
  source: 'field-mode',
  ...overrides,
});

const auditEntries = (storage) => {
  const raw = storage.getItem(AUDIT_LOG_STORAGE_KEY);
  return raw ? normalizeAuditLog(JSON.parse(raw)) : [];
};

const logEntries = (storage) => loadVisitLog(storage);

// ---- visit-log module: normalisation ----

test('QC-8: visit-log entry normalisation rejects bad date, blank customer and unknown outcome', () => {
  assert.equal(normalizeVisitLogEntry(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeVisitLogEntry(entry({ date: 'not-a-date' })), null);
  assert.equal(normalizeVisitLogEntry(entry({ customerId: '  ' })), null);
  assert.equal(normalizeVisitLogEntry(entry({ outcome: 'pending' })), null);
  assert.equal(normalizeVisitLogEntry(entry({ outcome: 'something else' })), null);
  assert.equal(normalizeVisitLogEntry(null), null);
  assert.equal(normalizeVisitLogEntry('nope'), null);
  const ok = normalizeVisitLogEntry(entry({ note: '  padded note  ' }));
  assert.equal(ok.note, 'padded note');
  assert.equal(ok.customerName, 'Test Customer A');
  assert.equal(ok.timestamp, '2026-11-09T12:00:00.000Z');
  // A missing timestamp is tolerated (display falls back), never invented.
  assert.equal(normalizeVisitLogEntry(entry({ timestamp: '' })).timestamp, '');
});

test('QC-8: normalizeVisitLog drops invalid rows and keeps order', () => {
  assert.deepEqual(normalizeVisitLog(null), []);
  assert.deepEqual(normalizeVisitLog('nope'), []);
  const rows = normalizeVisitLog([entry(), entry({ outcome: 'nope' }), entry({ customerId: 'c2', outcome: 'paid' })]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].customerId, 'c1');
  assert.equal(rows[1].customerId, 'c2');
});

// ---- visit-log module: append-only + retention ----

test('QC-8: append is append-only — a second entry never touches the first, input untouched', () => {
  const base = [entry()];
  const next = appendVisitLogEntry(base, entry({ customerId: 'c2', outcome: 'refused', id: 'visit-2' }));
  assert.equal(base.length, 1);
  assert.equal(next.length, 2);
  assert.equal(next[0].outcome, 'not_home');
  assert.equal(next[0].note, 'House locked');
  assert.equal(next[1].outcome, 'refused');
  // An invalid entry leaves the list unchanged (same array back).
  assert.equal(appendVisitLogEntry(next, entry({ outcome: 'nope' })), next);
});

test('QC-8: the log is kept 90 days — boundary kept, day before pruned', () => {
  assert.equal(VISIT_LOG_RETENTION_DAYS, 90);
  const today = '2026-11-10';
  const cutoff = dateStringDaysAgo(today, VISIT_LOG_RETENTION_DAYS - 1);
  const before = dateStringDaysAgo(today, VISIT_LOG_RETENTION_DAYS);
  const rows = pruneVisitLogEntries([
    entry({ date: before, id: 'old' }),
    entry({ date: cutoff, id: 'edge' }),
    entry({ date: today, id: 'now' }),
  ], today);
  assert.deepEqual(rows.map((r) => r.id), ['edge', 'now']);
  assert.equal(dateStringDaysAgo('2026-03-01', 1), '2026-02-28');
  assert.equal(dateStringDaysAgo('2024-03-01', 1), '2024-02-29');
});

test('QC-8: recordVisitLogEntry persists, generates an id and prunes on write', () => {
  const storage = mockStorage();
  const first = recordVisitLogEntry(storage, {
    date: '2026-11-09', customerId: 'c1', outcome: 'not_home', note: 'House locked',
    timestamp: '2026-11-09T12:00:00.000Z',
  }, '2026-11-09');
  assert.ok(first);
  assert.ok(first.id.startsWith('visit-'));
  assert.equal(loadVisitLog(storage).length, 1);
  assert.equal(loadVisitLog(storage)[0].outcome, 'not_home');
  // A stale entry (older than 90 days before the new visit) is pruned by the write.
  saveVisitLog(storage, [entry({ date: '2026-07-01', id: 'stale' }), entry({ date: '2026-11-09', id: 'kept' })]);
  recordVisitLogEntry(storage, {
    date: '2026-11-09', customerId: 'c2', outcome: 'paid', note: '',
    timestamp: '2026-11-09T13:00:00.000Z',
  }, '2026-11-09');
  assert.deepEqual(loadVisitLog(storage).map((r) => r.id), ['kept', 'visit-2026-11-09-c2-1']);
  // Invalid entry writes nothing.
  assert.equal(recordVisitLogEntry(storage, { date: '2026-11-09', customerId: '', outcome: 'paid' }, '2026-11-09'), null);
  assert.equal(loadVisitLog(storage).length, 2);
});

test('QC-8: loadVisitLog tolerates a missing key and corrupt JSON', () => {
  const storage = mockStorage();
  assert.deepEqual(loadVisitLog(storage), []);
  storage.setItem(FIELD_ROUTE_VISIT_LOG_KEY, '{not json');
  assert.deepEqual(loadVisitLog(storage), []);
  storage.setItem(FIELD_ROUTE_VISIT_LOG_KEY, JSON.stringify({ not: 'a list' }));
  assert.deepEqual(loadVisitLog(storage), []);
});

// ---- visit-log module: dates + rendering ----

test('QC-8: visitLogDates lists unique dates newest first; entriesForDate keeps recorded order', () => {
  const rows = [
    entry({ date: '2026-11-08', id: 'a' }),
    entry({ date: '2026-11-09', id: 'b' }),
    entry({ date: '2026-11-08', id: 'c' }),
    entry({ date: '2026-11-10', id: 'd' }),
  ];
  assert.deepEqual(visitLogDates(rows), ['2026-11-10', '2026-11-09', '2026-11-08']);
  assert.deepEqual(visitLogEntriesForDate(rows, '2026-11-08').map((r) => r.id), ['a', 'c']);
  assert.deepEqual(visitLogEntriesForDate(rows, '2026-11-07'), []);
});

test('QC-8: history day HTML escapes user text, shows time + label + note, empty day states honestly', () => {
  const html = visitHistoryDayHtml([
    entry({ note: 'House locked <script>alert(1)</script>', customerName: 'Test <b>Bold</b>' }),
    entry({ customerId: 'c2', customerName: '', customerNumber: '', outcome: 'paid', note: '', timestamp: '2026-11-09T14:05:00.000Z', id: 'x2' }),
  ], '2026-11-09');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;Bold&lt;/b&gt;'));
  assert.ok(html.includes('12:00'));
  assert.ok(html.includes('14:05'));
  assert.equal(html.includes('Not home'), true);
  assert.equal(html.includes('Paid'), true);
  assert.equal(html.includes('House locked'), true);
  // No name stored: the customer id is shown, never a blank row.
  assert.ok(html.includes('c2'));
  const empty = visitHistoryDayHtml([], '2026-11-09');
  assert.ok(empty.includes('No visits recorded'));
  assert.ok(empty.includes('2026-11-09'));
});

test('QC-8: history date options mark the selected date and fall back to today when empty', () => {
  const html = visitHistoryDateOptionsHtml(['2026-11-10', '2026-11-09'], '2026-11-09');
  assert.ok(html.includes('<option value="2026-11-09" selected>2026-11-09</option>'));
  assert.ok(html.includes('<option value="2026-11-10">2026-11-10</option>'));
  assert.ok(!html.includes('<option value="2026-11-10" selected>'));
  assert.equal(
    visitHistoryDateOptionsHtml([], '2026-11-10'),
    '<option value="2026-11-10" selected>2026-11-10</option>',
  );
});

test('QC-8: every route outcome has a display label', () => {
  assert.deepEqual(Object.keys(VISIT_LOG_OUTCOME_LABELS).sort(), [
    'call_later', 'dispute', 'no_answer', 'not_home', 'paid', 'partial', 'promised', 'refused',
  ]);
  assert.equal(VISIT_LOG_OUTCOME_LABELS.not_home, 'Not home');
  assert.equal(VISIT_LOG_OUTCOME_LABELS.call_later, 'Call later');
  assert.equal(VISIT_LOG_OUTCOME_LABELS.partial, 'Partial payment');
});

// ---- audit action ----

test('QC-8: audit catalogue gains field_visit as the 11th action', () => {
  assert.equal(AUDIT_ACTIONS.length, 11);
  assert.equal(AUDIT_ACTIONS[AUDIT_ACTIONS.length - 1].value, 'field_visit');
  assert.equal(auditActionLabel('field_visit'), 'Field visit recorded');
  assert.equal(AUDIT_LOG_STORAGE_KEY, 'shahdara_operator_audit_log_v1');
  const ok = normalizeAuditEntry({
    id: 'a1', timestamp: '2026-11-09T12:00:00.000Z', action: 'field_visit',
    recordRef: 'c1', customerId: 'c1', detail: 'Not home · House locked',
  });
  assert.equal(ok.action, 'field_visit');
  assert.equal(ok.recordRef, 'c1');
  assert.equal(normalizeAuditEntry({ ...ok, action: 'nope' }), null);
});

// ---- choke point: saveFieldRouteOutcome ----

test('QC-8: a route-sheet mark appends one log entry and one audit entry', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09', {
    customer: { customerNumber: 12, name: 'Test Customer A' },
  });
  const log = logEntries(storage);
  assert.equal(log.length, 1);
  assert.equal(log[0].date, '2026-11-09');
  assert.equal(log[0].customerId, 'c1');
  assert.equal(log[0].customerNumber, '12');
  assert.equal(log[0].customerName, 'Test Customer A');
  assert.equal(log[0].outcome, 'not_home');
  assert.equal(log[0].note, 'House locked');
  assert.ok(log[0].timestamp.length > 10);
  const audit = auditEntries(storage);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'field_visit');
  assert.equal(audit[0].recordRef, 'c1');
  assert.equal(audit[0].customerId, 'c1');
  assert.equal(audit[0].customerName, 'Test Customer A');
  assert.ok(audit[0].detail.includes('Not home'));
  assert.ok(audit[0].detail.includes('House locked'));
  // The single-slot outcome store is unchanged by QC-8.
  assert.equal(getFieldRouteOutcomes(storage, '2026-11-09').c1.outcome, 'not_home');
});

test('QC-8: re-marking appends — the earlier log entry survives, the single slot shows only the latest', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c1', { outcome: 'refused', note: 'Said no' }, storage, '2026-11-09');
  const log = logEntries(storage);
  assert.equal(log.length, 2);
  assert.equal(log[0].outcome, 'not_home');
  assert.equal(log[0].note, 'House locked');
  assert.equal(log[1].outcome, 'refused');
  assert.equal(log[1].note, 'Said no');
  // The round's current state is still single-slot (latest wins).
  const outcomes = getFieldRouteOutcomes(storage, '2026-11-09');
  assert.equal(Object.keys(outcomes).length, 1);
  assert.equal(outcomes.c1.outcome, 'refused');
  // Both marks are audited, in order.
  assert.deepEqual(auditEntries(storage).map((a) => a.action), ['field_visit', 'field_visit']);
  assert.ok(auditEntries(storage)[0].detail.includes('Not home'));
  assert.ok(auditEntries(storage)[1].detail.includes('Refused'));
});

test('QC-8: clearing a mark writes neither a log entry nor an audit entry', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c1', 'pending', storage, '2026-11-09');
  assert.equal(logEntries(storage).length, 1);
  assert.equal(auditEntries(storage).length, 1);
  assert.deepEqual(getFieldRouteOutcomes(storage, '2026-11-09'), {});
});

test('QC-8: a promised mark appends log + audit and keeps its promise-register sync', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', {
    outcome: 'promised', promiseDate: '2026-11-12', promiseAmount: 1500, note: 'Will pay Friday',
  }, storage, '2026-11-09', { customer: { customerNumber: 12, name: 'Test Customer A', totalDue: 1500 } });
  assert.equal(logEntries(storage).length, 1);
  assert.equal(logEntries(storage)[0].outcome, 'promised');
  assert.equal(auditEntries(storage).length, 1);
  assert.ok(auditEntries(storage)[0].detail.includes('Payment promised'));
  const promises = JSON.parse(storage.getItem('shahdara_collection_promises_v1') || '[]');
  assert.equal(promises.length, 1);
  assert.equal(promises[0].promisedDate, '2026-11-12');
});

test('QC-8: a paid outcome appends log + audit (the Field Mode payment path)', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'paid', note: '' }, storage, '2026-11-09');
  assert.equal(logEntries(storage).length, 1);
  assert.equal(logEntries(storage)[0].outcome, 'paid');
  assert.equal(auditEntries(storage).length, 1);
  assert.ok(auditEntries(storage)[0].detail.includes('Paid'));
  // The collected stop still lands in the progress store.
  assert.deepEqual(JSON.parse(storage.getItem(FIELD_ROUTE_PROGRESS_KEY)).collectedIds, ['c1']);
});

test('QC-8: a mark writes only the outcome/progress/log/audit keys — no ledger key is touched', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  const keys = Object.keys(storage.store).sort();
  assert.deepEqual(keys, [
    AUDIT_LOG_STORAGE_KEY,
    FIELD_ROUTE_OUTCOMES_KEY,
    FIELD_ROUTE_PROGRESS_KEY,
    FIELD_ROUTE_VISIT_LOG_KEY,
  ].sort());
});

// ---- QC-1 marks through the same choke point ----

test('QC-8: a Field Mode Not Available mark appends log + audit; clearing it appends nothing', () => {
  const storage = mockStorage();
  const record = saveFieldNotAvailableMark('c1', 'not_home', 'House locked', storage, '2026-11-09');
  assert.ok(record);
  assert.equal(logEntries(storage).length, 1);
  assert.equal(logEntries(storage)[0].outcome, 'not_home');
  assert.equal(auditEntries(storage).length, 1);
  assert.ok(auditEntries(storage)[0].detail.includes('Not home'));
  clearFieldNotAvailableMark('c1', storage, '2026-11-09');
  assert.equal(logEntries(storage).length, 1);
  assert.equal(auditEntries(storage).length, 1);
  assert.deepEqual(getFieldRouteOutcomes(storage, '2026-11-09'), {});
});

test('QC-8: markFieldVisitPaid appends a paid log entry; an unmarked customer appends nothing', () => {
  const storage = mockStorage();
  assert.equal(markFieldVisitPaid('c9', storage, '2026-11-09'), null);
  assert.equal(logEntries(storage).length, 0);
  assert.equal(auditEntries(storage).length, 0);
  saveFieldNotAvailableMark('c1', 'refused', 'Said no', storage, '2026-11-09');
  markFieldVisitPaid('c1', storage, '2026-11-09');
  assert.equal(logEntries(storage).length, 2);
  assert.equal(logEntries(storage)[1].outcome, 'paid');
  assert.equal(auditEntries(storage).length, 2);
  assert.equal(getFieldRouteOutcomes(storage, '2026-11-09').c1.outcome, 'paid');
});

// ---- multi-day history ----

test('QC-8: the log survives midnight while the round still resets for the working list', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c2', { outcome: 'refused', note: 'Said no' }, storage, '2026-11-09');
  // Yesterday's entries are still in the log, viewable by day.
  assert.equal(visitLogEntriesForDate(loadVisitLog(storage), '2026-11-09').length, 2);
  assert.deepEqual(visitLogDates(loadVisitLog(storage)), ['2026-11-09']);
  // But the round's working stores reset: today shows nothing.
  assert.deepEqual(getFieldRouteOutcomes(storage, '2026-11-10'), {});
  assert.deepEqual(visitLogEntriesForDate(loadVisitLog(storage), '2026-11-10'), []);
  // A mark today does not disturb yesterday's history.
  saveFieldRouteOutcome('c1', { outcome: 'paid', note: '' }, storage, '2026-11-10');
  assert.equal(visitLogEntriesForDate(loadVisitLog(storage), '2026-11-09').length, 2);
  assert.equal(visitLogEntriesForDate(loadVisitLog(storage), '2026-11-10').length, 1);
  assert.deepEqual(visitLogDates(loadVisitLog(storage)), ['2026-11-10', '2026-11-09']);
});

// ---- stop-based progress ----

const routeState = () => ({
  customers: [
    { id: 'c1', name: 'Test Customer A', area: 'Bazaar', balance: 2000 },
    { id: 'c2', name: 'Test Customer B', area: 'Bazaar', balance: 1500 },
    { id: 'c3', name: 'Test Customer C', area: 'Bazaar', balance: 3000 },
  ],
  packages: [],
  billing: [],
});

test('QC-8: stop progress — all pending reads visited 0, marked 0, pending = total', () => {
  const route = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage: mockStorage() });
  assert.equal(route.totalStops, 3);
  assert.equal(route.visitedStops, 0);
  assert.equal(route.markedStops, 0);
  assert.equal(route.collectedStops, 0);
  assert.equal(route.pendingVisitStops, 3);
  assert.equal(route.visitedRate, 0);
  assert.equal(route.completionRate, 0);
  assert.equal(routeVisitProgressText(route), 'Visited 0 of 3 stops · 0 collected · 0 marked · 3 pending');
});

test('QC-8: stop progress — a marked stop counts as visited, never as pending; money figures do not move', () => {
  const storage = mockStorage();
  const before = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage });
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c2', { outcome: 'promised', promiseDate: '2026-11-12', note: 'Friday' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c3', { outcome: 'paid', note: '' }, storage, '2026-11-09');
  const after = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage });
  assert.equal(after.totalStops, 3);
  assert.equal(after.visitedStops, 3);
  assert.equal(after.markedStops, 2);
  assert.equal(after.collectedStops, 1);
  assert.equal(after.pendingVisitStops, 0);
  assert.equal(after.visitedRate, 100);
  assert.equal(routeVisitProgressText(after), 'Visited 3 of 3 stops · 1 collected · 2 marked · 0 pending');
  // Money-based progress moves ONLY for the paid stop — the two marks
  // change no money figure (same totals as the pre-mark run, except
  // the one collected stop).
  assert.equal(after.completionRate, 33);
  assert.equal(after.roundStatus, 'IN_PROGRESS');
  assert.equal(after.totalDue, before.totalDue);
  assert.equal(after.pendingAmount, before.totalDue - 3000);
  // Per-mohalla breakdowns carry the same stop counts.
  const area = after.areas.find((a) => a.area === 'Bazaar');
  assert.equal(area.totalStops, 3);
  assert.equal(area.visitedStops, 3);
  assert.equal(area.markedStops, 2);
  assert.equal(area.collectedStops, 1);
  const sector = after.sectors.find((s) => s.sector === 'Bazaar');
  assert.equal(sector.visitedStops, 3);
  assert.equal(sector.markedStops, 2);
});

test('QC-8: stop progress — visited rate rounds; a dispute / no-answer / call-later mark is visited too', () => {
  const storage = mockStorage();
  saveFieldRouteOutcome('c1', { outcome: 'dispute', note: 'Bill double' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c2', { outcome: 'call_later', note: 'Ring later' }, storage, '2026-11-09');
  const route = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage });
  assert.equal(route.visitedStops, 2);
  assert.equal(route.markedStops, 2);
  assert.equal(route.collectedStops, 0);
  assert.equal(route.pendingVisitStops, 1);
  assert.equal(route.visitedRate, 67);
  assert.equal(route.completionRate, 0);
  assert.equal(route.roundStatus, 'NOT_STARTED');
  assert.equal(routeVisitProgressText(route), 'Visited 2 of 3 stops · 0 collected · 2 marked · 1 pending');
});

test('QC-8: marking never changes a dues figure — route totals identical before and after marks', () => {
  const storage = mockStorage();
  const before = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage });
  saveFieldRouteOutcome('c1', { outcome: 'not_home', note: 'House locked' }, storage, '2026-11-09');
  saveFieldRouteOutcome('c2', { outcome: 'refused', note: 'Said no' }, storage, '2026-11-09');
  const after = calculateFieldCollectionRoutes(routeState(), { dateStr: '2026-11-09', storage });
  assert.equal(after.totalDue, before.totalDue);
  assert.equal(after.pendingAmount, before.pendingAmount);
  assert.equal(after.collectedAmount, before.collectedAmount);
  assert.deepEqual(after.stops.map((s) => s.totalDue), before.stops.map((s) => s.totalDue));
});
