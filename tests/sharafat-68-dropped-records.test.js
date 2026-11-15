// Sharafat 68 — malformed tickets/complaints are silently dropped on load.
// A reporting load per ledger (loadTicketsWithReport /
// loadComplaintsWithReport) names what the sanitizer skipped, and a
// quarantine key per ledger (sisp_tickets_dropped_v1 /
// sisp_complaints_dropped_v1), written at load time, preserves the raw
// dropped rows past the first save — which otherwise deletes them from
// storage forever. The modal surface (banner + view + clear) is DOM
// work, so these tests pin the storage contract it renders from:
// the report, the quarantine's survival, the write guard, and the
// corrupt-vs-empty distinction the empty state used to lie about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKETS_KEY,
  TICKETS_DROPPED_KEY,
  clearTicketQuarantine,
  loadTickets,
  loadTicketsWithReport,
  readTicketQuarantine,
  sanitizeTickets,
  sanitizeTicketsWithReport,
  saveTickets,
  writeTicketQuarantine
} from '../complaint-tickets.js';
import {
  COMPLAINTS_KEY,
  COMPLAINTS_DROPPED_KEY,
  clearComplaintQuarantine,
  loadComplaints,
  loadComplaintsWithReport,
  readComplaintQuarantine,
  sanitizeComplaints,
  sanitizeComplaintsWithReport,
  saveComplaints,
  writeComplaintQuarantine
} from '../complaint-register.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

function countingStorage() {
  const inner = memoryStorage();
  let sets = 0;
  return {
    storage: inner,
    sets: () => sets,
    getItem: (key) => inner.getItem(key),
    setItem: (key, value) => { sets++; inner.setItem(key, value); },
    removeItem: (key) => inner.removeItem(key)
  };
}

const goodTicket = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  customFault: '',
  technician: 'Saad',
  priority: 'Normal',
  status: 'Open',
  createdAt: '2026-10-28T10:00',
  resolvedAt: '',
  note: '',
  materialsUsed: [],
  billingType: 'free',
  billedAmount: 0,
  chargePaid: false,
  chargePaidAt: '',
  stockDeductions: [],
  stockDeducted: false,
  ...overrides
});

const goodComplaint = (overrides = {}) => ({
  id: 'CMP-201',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  zone: '',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-28T10:00',
  resolvedAt: '',
  downtimeHours: null,
  downtimeManual: false,
  priority: 'Normal',
  status: 'Open',
  resolutionNote: '',
  resolvedByLineman: '',
  resolvedViaTicketId: '',
  syncReopenGuard: '',
  followUpSentAt: null,
  createdAt: '2026-10-28T10:00:00.000Z',
  ...overrides
});

// ---- Tickets ----

test('tickets: malformed rows load the good rows and report the dropped rows with reasons', () => {
  const storage = memoryStorage();
  const junk = { id: 'junk', customerId: 'c1' };
  const noCustomer = { id: 'TKT-102' };
  storage.setItem(TICKETS_KEY, JSON.stringify([
    goodTicket(),
    junk,
    null,
    noCustomer,
    goodTicket({ id: 'TKT-103', customerId: 'c2' })
  ]));
  const report = loadTicketsWithReport(storage);
  assert.equal(report.list.length, 2);
  assert.deepEqual(report.list.map((t) => t.id), ['TKT-101', 'TKT-103']);
  assert.equal(report.corrupt, false);
  assert.equal(report.dropped.length, 3);
  assert.deepEqual(report.dropped.map((d) => d.reason), ['invalid ticket id', 'not a record', 'missing customer']);
  assert.deepEqual(report.dropped[0].raw, junk);
  assert.equal(report.dropped[1].raw, null);
  assert.deepEqual(report.dropped[2].raw, noCustomer);
  // The old loader is unchanged: same good rows, no report.
  assert.equal(loadTickets(storage).length, 2);
  assert.equal(sanitizeTickets(JSON.parse(storage.getItem(TICKETS_KEY))).length, 2);
  assert.equal(readTicketQuarantine(storage), null);
});

test('tickets: corrupt JSON is reported, not silently []', () => {
  const storage = memoryStorage();
  storage.setItem(TICKETS_KEY, '{not json');
  assert.deepEqual(loadTickets(storage), []);
  const report = loadTicketsWithReport(storage);
  assert.equal(report.corrupt, true);
  assert.deepEqual(report.list, []);
  assert.deepEqual(report.dropped, []);
  // The loader never writes the quarantine itself — the modal does.
  assert.equal(readTicketQuarantine(storage), null);
});

test('tickets: non-array JSON is reported as corrupt', () => {
  const storage = memoryStorage();
  for (const raw of ['"just a string"', '{}', '42']) {
    storage.setItem(TICKETS_KEY, raw);
    const report = loadTicketsWithReport(storage);
    assert.equal(report.corrupt, true, raw);
    assert.deepEqual(report.list, []);
  }
});

test('tickets: quarantine survives the next save and the reload after it', () => {
  const storage = memoryStorage();
  storage.setItem(TICKETS_KEY, JSON.stringify([
    goodTicket(),
    { id: 'junk', customerId: 'c1' },
    goodTicket({ id: 'TKT-102', customerId: 'c2' }),
    null
  ]));
  const report = loadTicketsWithReport(storage);
  assert.equal(report.dropped.length, 2);
  writeTicketQuarantine(storage, report);
  // The first save after the load deletes the dropped rows from the
  // live store — that is the bug's sharp edge, and the quarantine is
  // what keeps the evidence.
  saveTickets(report.list, storage);
  assert.equal(JSON.parse(storage.getItem(TICKETS_KEY)).length, 2);
  const afterSave = loadTicketsWithReport(storage);
  assert.equal(afterSave.dropped.length, 0);
  assert.equal(afterSave.corrupt, false);
  const quarantine = readTicketQuarantine(storage);
  assert.equal(quarantine.corrupt, false);
  assert.equal(quarantine.dropped.length, 2);
  assert.deepEqual(quarantine.dropped[0].raw, { id: 'junk', customerId: 'c1' });
  assert.equal(quarantine.dropped[1].raw, null);
});

test('tickets: a fresh load with new drops overwrites the old quarantine', () => {
  const storage = memoryStorage();
  writeTicketQuarantine(storage, { corrupt: false, dropped: [{ raw: { id: 'old' }, reason: 'invalid ticket id' }] });
  assert.equal(readTicketQuarantine(storage).dropped.length, 1);
  storage.setItem(TICKETS_KEY, JSON.stringify([goodTicket(), { id: 'new-junk' }]));
  const report = loadTicketsWithReport(storage);
  writeTicketQuarantine(storage, report);
  const quarantine = readTicketQuarantine(storage);
  assert.equal(quarantine.dropped.length, 1);
  assert.deepEqual(quarantine.dropped[0].raw, { id: 'new-junk' });
  // A corrupt store overwrites the per-row set the same way.
  writeTicketQuarantine(storage, { corrupt: true, dropped: [] });
  assert.equal(readTicketQuarantine(storage).corrupt, true);
  assert.deepEqual(readTicketQuarantine(storage).dropped, []);
});

test('tickets: clearing the quarantine removes the evidence, and only an explicit clear does', () => {
  const storage = memoryStorage();
  storage.setItem(TICKETS_KEY, JSON.stringify([goodTicket(), { id: 'junk' }]));
  writeTicketQuarantine(storage, loadTicketsWithReport(storage));
  assert.equal(readTicketQuarantine(storage).dropped.length, 1);
  assert.equal(clearTicketQuarantine(storage), true);
  assert.equal(readTicketQuarantine(storage), null);
  // A clean load after the clear does not recreate it.
  assert.equal(loadTicketsWithReport(storage).dropped.length, 1);
  assert.equal(readTicketQuarantine(storage), null);
  assert.equal(clearTicketQuarantine(null), false);
});

test('tickets: quarantine write is guarded — a repeat report does not rewrite the key', () => {
  const counted = countingStorage();
  const report = { corrupt: false, dropped: [{ raw: { id: 'junk' }, reason: 'invalid ticket id' }] };
  writeTicketQuarantine(counted, report);
  assert.equal(counted.sets(), 1);
  writeTicketQuarantine(counted, report);
  assert.equal(counted.sets(), 1);
  writeTicketQuarantine(counted, { corrupt: false, dropped: [{ raw: { id: 'other' }, reason: 'invalid ticket id' }] });
  assert.equal(counted.sets(), 2);
  assert.equal(counted.storage.getItem(TICKETS_DROPPED_KEY), JSON.stringify({ corrupt: false, dropped: [{ raw: { id: 'other' }, reason: 'invalid ticket id' }] }));
});

test('tickets: material-line drops are not counted as dropped records', () => {
  const withBadLine = goodTicket({
    status: 'Resolved',
    billingType: 'billed',
    resolvedAt: '2026-10-28T14:30',
    materialsUsed: [
      { key: 'patch-cord', qty: 1, amount: 500 },
      { key: 'nope', qty: 1, amount: 100 }
    ]
  });
  const { list, dropped } = sanitizeTicketsWithReport([withBadLine]);
  assert.equal(list.length, 1);
  assert.equal(dropped.length, 0);
  assert.equal(list[0].materialsUsed.length, 1);
  assert.equal(list[0].billedAmount, 500);
  // A ticket that loses its ONLY material line still loads — with a
  // billed amount of 0. The row is readable, so it is not counted;
  // the money effect is disclosed, not hidden.
  const onlyBadLine = goodTicket({
    status: 'Resolved',
    billingType: 'billed',
    resolvedAt: '2026-10-28T14:30',
    materialsUsed: [{ key: 'nope', qty: 1, amount: 500 }]
  });
  const second = sanitizeTicketsWithReport([onlyBadLine]);
  assert.equal(second.list.length, 1);
  assert.equal(second.dropped.length, 0);
  assert.equal(second.list[0].billedAmount, 0);
});

test('tickets: repairs are not counted as drops', () => {
  const { list, dropped } = sanitizeTicketsWithReport([
    goodTicket({ status: 'Closed', faultPreset: 'Nope' })
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'Open');
  assert.equal(list[0].faultPreset, '');
  assert.equal(dropped.length, 0);
});

test('tickets: controls — empty store and all-good store report nothing', () => {
  const empty = memoryStorage();
  assert.deepEqual(loadTicketsWithReport(empty), { list: [], dropped: [], corrupt: false });
  assert.equal(readTicketQuarantine(empty), null);
  const good = memoryStorage();
  good.setItem(TICKETS_KEY, JSON.stringify([goodTicket(), goodTicket({ id: 'TKT-102' })]));
  const report = loadTicketsWithReport(good);
  assert.equal(report.list.length, 2);
  assert.equal(report.dropped.length, 0);
  assert.equal(report.corrupt, false);
  assert.equal(readTicketQuarantine(good), null);
});

// ---- Complaints ----

test('complaints: 2 malformed rows among 4 load the good rows and report the dropped rows with reasons', () => {
  const storage = memoryStorage();
  const noId = { id: '', customerId: 'c1' };
  storage.setItem(COMPLAINTS_KEY, JSON.stringify([
    goodComplaint(),
    null,
    noId,
    goodComplaint({ id: 'CMP-202', customerId: 'c2' })
  ]));
  const report = loadComplaintsWithReport(storage);
  assert.equal(report.list.length, 2);
  assert.deepEqual(report.list.map((c) => c.id), ['CMP-201', 'CMP-202']);
  assert.equal(report.corrupt, false);
  assert.equal(report.dropped.length, 2);
  assert.deepEqual(report.dropped.map((d) => d.reason), ['not a record', 'missing complaint id']);
  assert.equal(report.dropped[0].raw, null);
  assert.deepEqual(report.dropped[1].raw, noId);
  assert.equal(loadComplaints(storage).length, 2);
  assert.equal(readComplaintQuarantine(storage), null);
});

test('complaints: corrupt JSON is reported, not silently []', () => {
  const storage = memoryStorage();
  storage.setItem(COMPLAINTS_KEY, '[{broken');
  assert.deepEqual(loadComplaints(storage), []);
  const report = loadComplaintsWithReport(storage);
  assert.equal(report.corrupt, true);
  assert.deepEqual(report.list, []);
  assert.equal(readComplaintQuarantine(storage), null);
});

test('complaints: non-array JSON is reported as corrupt', () => {
  const storage = memoryStorage();
  storage.setItem(COMPLAINTS_KEY, '{}');
  assert.equal(loadComplaintsWithReport(storage).corrupt, true);
});

test('complaints: quarantine survives the next save and the reload after it', () => {
  const storage = memoryStorage();
  storage.setItem(COMPLAINTS_KEY, JSON.stringify([
    goodComplaint(),
    { id: '', customerId: 'c1' },
    goodComplaint({ id: 'CMP-202', customerId: 'c2' }),
    null
  ]));
  const report = loadComplaintsWithReport(storage);
  assert.equal(report.dropped.length, 2);
  writeComplaintQuarantine(storage, report);
  // saveComplaints does not sanitize, but every caller persists an
  // already-sanitized list — so the dropped rows are gone from the
  // live store after this save, exactly like tickets.
  saveComplaints(report.list, storage);
  assert.equal(JSON.parse(storage.getItem(COMPLAINTS_KEY)).length, 2);
  assert.equal(loadComplaintsWithReport(storage).dropped.length, 0);
  const quarantine = readComplaintQuarantine(storage);
  assert.equal(quarantine.dropped.length, 2);
  assert.deepEqual(quarantine.dropped[0].raw, { id: '', customerId: 'c1' });
  assert.equal(quarantine.dropped[1].raw, null);
});

test('complaints: clearing the quarantine removes the evidence', () => {
  const storage = memoryStorage();
  storage.setItem(COMPLAINTS_KEY, JSON.stringify([goodComplaint(), null]));
  writeComplaintQuarantine(storage, loadComplaintsWithReport(storage));
  assert.equal(readComplaintQuarantine(storage).dropped.length, 1);
  assert.equal(clearComplaintQuarantine(storage), true);
  assert.equal(readComplaintQuarantine(storage), null);
  assert.equal(storage.getItem(COMPLAINTS_DROPPED_KEY), null);
  assert.equal(clearComplaintQuarantine(null), false);
});

test('complaints: repairs are not counted as drops', () => {
  const { list, dropped } = sanitizeComplaintsWithReport([
    goodComplaint({ status: 'Closed', issueCategory: 'Nope', reportedAt: 'bad', downtimeHours: -3 })
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'Open');
  assert.equal(list[0].issueCategory, 'Other');
  assert.equal(list[0].reportedAt, '');
  assert.equal(list[0].downtimeHours, null);
  assert.equal(dropped.length, 0);
});

test('complaints: controls — empty store and all-good store report nothing', () => {
  const empty = memoryStorage();
  assert.deepEqual(loadComplaintsWithReport(empty), { list: [], dropped: [], corrupt: false });
  assert.equal(readComplaintQuarantine(empty), null);
  const good = memoryStorage();
  good.setItem(COMPLAINTS_KEY, JSON.stringify([goodComplaint(), goodComplaint({ id: 'CMP-202' })]));
  const report = loadComplaintsWithReport(good);
  assert.equal(report.list.length, 2);
  assert.equal(report.dropped.length, 0);
  assert.equal(report.corrupt, false);
  assert.equal(readComplaintQuarantine(good), null);
});

// ---- Asymmetry + the empty-state lie ----

test('asymmetry: a legacy id loads as a complaint but is dropped + counted as a ticket', () => {
  const ticketStore = memoryStorage();
  ticketStore.setItem(TICKETS_KEY, JSON.stringify([{ id: 'legacy-99', customerId: 'c1' }]));
  const ticketReport = loadTicketsWithReport(ticketStore);
  assert.equal(ticketReport.list.length, 0);
  assert.equal(ticketReport.dropped.length, 1);
  assert.equal(ticketReport.dropped[0].reason, 'invalid ticket id');
  const complaintStore = memoryStorage();
  complaintStore.setItem(COMPLAINTS_KEY, JSON.stringify([{ id: 'legacy-99', customerId: 'c1' }]));
  const complaintReport = loadComplaintsWithReport(complaintStore);
  assert.equal(complaintReport.list.length, 1);
  assert.equal(complaintReport.list[0].id, 'legacy-99');
  assert.equal(complaintReport.dropped.length, 0);
});

test('corrupt store is distinguishable from an empty store (the empty-state lie)', () => {
  // Both used to load as [] — the modal then said "No … recorded yet"
  // for a store whose history was actually damaged. The report flag
  // is what the banner (and the replaced empty state) renders from.
  const emptyTickets = memoryStorage();
  assert.deepEqual(loadTickets(emptyTickets), []);
  assert.equal(loadTicketsWithReport(emptyTickets).corrupt, false);
  const corruptTickets = memoryStorage();
  corruptTickets.setItem(TICKETS_KEY, '{damaged');
  assert.deepEqual(loadTickets(corruptTickets), []);
  assert.equal(loadTicketsWithReport(corruptTickets).corrupt, true);
  const emptyComplaints = memoryStorage();
  assert.deepEqual(loadComplaints(emptyComplaints), []);
  assert.equal(loadComplaintsWithReport(emptyComplaints).corrupt, false);
  const corruptComplaints = memoryStorage();
  corruptComplaints.setItem(COMPLAINTS_KEY, '{damaged');
  assert.deepEqual(loadComplaints(corruptComplaints), []);
  assert.equal(loadComplaintsWithReport(corruptComplaints).corrupt, true);
});
