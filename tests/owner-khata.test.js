// SISP-20: Monthly Owner Khata Closing Report. Every figure is reused from
// an existing computation (partner share report, month-end outstanding,
// SISP-1 settlements, downtime analytics) — the tests pin the reuse by
// asserting the report equals those computations' outputs on the same
// synthetic ledger. Pure computation, synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerKhataReport,
  buildOwnerKhataPrintHtml,
  buildOwnerKhataWhatsAppText
} from '../owner-khata.js';
import {
  MONTHLY_CLOSING_NOTES_KEY,
  getMonthlyClosingNote,
  loadMonthlyClosingNotes,
  saveMonthlyClosingNotes,
  sanitizeMonthlyClosingNotes,
  setMonthlyClosingNote
} from '../monthly-closing-notes.js';
import { buildPartnerShareReport, outstandingAtMonthEnd } from '../phase3.js';
import { buildMonthlyDowntimeAnalytics } from '../downtime-analytics.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

const REF = new Date('2026-10-27T12:00:00Z');

function baseState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-09', dueAmount: 3000, payments: [] },
        { month: '2026-10', dueAmount: 3000, payments: [
          { id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' },
        ] },
      ] },
      { id: 'c2', customerNumber: 2, name: 'Bilal', bills: [
        { month: '2026-10', dueAmount: 2000, payments: [
          { id: 'p2', date: '2026-10-07', amount: 2000, method: 'Cash' },
        ] },
      ] },
    ],
    expenses: [
      { id: 'e1', date: '2026-10-03', amount: 1000, category: 'NayaPay Bandwidth' },
      { id: 'e2', date: '2026-10-10', amount: 500, category: 'Field Visit' },
      { id: 'e3', date: '2026-10-12', amount: 500, category: 'Electricity' },
      { id: 'e4', date: '2026-09-05', amount: 900, category: 'Electricity' },
    ],
  };
}

function baseComplaints() {
  return [
    { id: 'CMP-101', customerId: 'c1', customerName: 'Ali', issueCategory: 'Fiber Cut', reportedAt: '2026-10-03T10:00', downtimeHours: 4 },
    { id: 'CMP-102', customerId: 'c2', customerName: 'Bilal', issueCategory: 'Media Converter / Charger Off', reportedAt: '2026-10-10T09:00', downtimeHours: 2.5 },
    { id: 'CMP-103', customerId: 'AREA_OUTAGE', customerName: 'AREA_OUTAGE', issueCategory: 'WAPDA / Power Outage', reportedAt: '2026-10-12T08:00', downtimeHours: 6 },
    { id: 'CMP-104', customerId: 'c1', customerName: 'Ali', issueCategory: 'Fiber Cut', reportedAt: '2026-09-20T10:00', downtimeHours: 9 },
  ];
}

function baseSettlements() {
  return [
    { id: 's1', shop: 'Waseem', amount: 4000, date: '2026-10-15' },
    { id: 's2', shop: 'Hassan', amount: 1000, date: '2026-10-20' },
    { id: 's3', shop: 'Waseem', amount: 9999, date: '2026-09-30' },
  ];
}

function baseNotes() {
  return { '2026-10': { note: 'Test closing note', savedAt: '2026-10-27T00:00:00.000Z' } };
}

function baseSnapshot() {
  return { month: '2026-10', savedAt: '2026-10-27T10:00', collection: 5000, pending: 3000, profit: 3000 };
}

function build(state = baseState(), overrides = {}) {
  return buildOwnerKhataReport(state, '2026-10', {
    complaints: baseComplaints(),
    settlements: baseSettlements(),
    notes: baseNotes(),
    savedSnapshot: baseSnapshot(),
    referenceDate: REF,
    ...overrides
  });
}

test('closing report reuses partner share figures (collected, expenses, profit, shares)', () => {
  const state = baseState();
  const partner = buildPartnerShareReport(state, '2026-10', REF);
  const report = build(state);
  assert.equal(report.collected, partner.summary.revenue);
  assert.equal(report.collected, 5000);
  assert.equal(report.receiptCount, 2);
  assert.equal(report.expenses, partner.summary.expenses);
  assert.equal(report.expenses, 2000);
  assert.equal(report.expenseCount, 3);
  assert.equal(report.profit, partner.summary.profit);
  assert.equal(report.profit, 3000);
  assert.equal(report.isLoss, false);
  assert.equal(report.nasirShare, partner.summary.share);
  assert.equal(report.aqibShare, partner.summary.share);
  assert.equal(report.nasirShare, 1500);
  assert.equal(report.aqibShare, 1500);
});

test('loss month pays zero partner shares', () => {
  const state = baseState();
  state.expenses.push({ id: 'e9', date: '2026-10-20', amount: 8000, category: 'Salary' });
  const report = build(state);
  assert.equal(report.profit, -5000);
  assert.equal(report.isLoss, true);
  assert.equal(report.nasirShare, 0);
  assert.equal(report.aqibShare, 0);
});

test('pending arrears reuses month-end outstanding (FIFO, cutoff-aware)', () => {
  const state = baseState();
  const arrears = outstandingAtMonthEnd(state, '2026-10', REF);
  const report = build(state);
  assert.equal(report.pendingArrears, arrears.total);
  assert.equal(report.pendingArrears, 3000);
  assert.equal(report.arrearsBillCount, 3);
  assert.equal(report.arrearsCutoff, '2026-10-27');
});

test('shop cash settled sums only this month’s settlements, by shop', () => {
  const report = build();
  assert.equal(report.shopSettled, 5000);
  assert.equal(report.shopSettledCount, 2);
  assert.deepEqual(
    report.shopSettledByShop.map((row) => [row.shop, row.amount, row.count]),
    [['Waseem', 4000, 1], ['Hassan', 1000, 1]]
  );
});

test('bandwidth + field subtotal is keyword-matched over the category breakdown', () => {
  const report = build();
  assert.equal(report.bandwidthFieldExpenses, 1500);
  assert.deepEqual(
    report.expenseCategories.map((row) => [row.category, row.amount]),
    [['NayaPay Bandwidth', 1000], ['Electricity', 500], ['Field Visit', 500]]
  );
  assert.equal(
    report.expenseCategories.reduce((sum, row) => sum + row.amount, 0),
    report.expenses
  );
});

test('network totals reuse downtime analytics (area outages count to network, not customers)', () => {
  const complaints = baseComplaints();
  const network = buildMonthlyDowntimeAnalytics(complaints, '2026-10');
  const report = build();
  assert.equal(report.totalComplaints, network.totalComplaints);
  assert.equal(report.totalComplaints, 3);
  assert.equal(report.totalDowntime, network.totalDowntime);
  assert.equal(report.totalDowntime, 12.5);
  assert.equal(report.areaOutageComplaints, 1);
  assert.equal(report.areaOutageDowntime, 6);
  assert.deepEqual(
    report.topCauses.map((row) => [row.category, row.incidents, row.totalDowntime]),
    [['WAPDA / Power Outage', 1, 6], ['Fiber Cut', 1, 4], ['Media Converter / Charger Off', 1, 2.5]]
  );
});

test('saved snapshot and owner note ride along, other months excluded', () => {
  const report = build();
  assert.deepEqual(report.savedSnapshot, { savedAt: '2026-10-27T10:00', collection: 5000, pending: 3000, profit: 3000 });
  assert.equal(report.note, 'Test closing note');
  const september = buildOwnerKhataReport(baseState(), '2026-09', {
    complaints: baseComplaints(), settlements: baseSettlements(), notes: baseNotes(),
    savedSnapshot: baseSnapshot(), referenceDate: REF
  });
  assert.equal(september.savedSnapshot, null);
  assert.equal(september.note, '');
});

test('report is deterministic and read-only', () => {
  const state = baseState();
  const complaints = baseComplaints();
  const settlements = baseSettlements();
  const before = JSON.stringify({ state, complaints, settlements });
  const first = buildOwnerKhataReport(state, '2026-10', {
    complaints, settlements, notes: baseNotes(), savedSnapshot: baseSnapshot(), referenceDate: REF
  });
  const second = buildOwnerKhataReport(state, '2026-10', {
    complaints, settlements, notes: baseNotes(), savedSnapshot: baseSnapshot(), referenceDate: REF
  });
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ state, complaints, settlements }), before);
});

test('invalid month yields a zeroed report', () => {
  const report = buildOwnerKhataReport(baseState(), 'bogus', { referenceDate: REF });
  assert.equal(report.validMonth, false);
  assert.equal(report.month, '');
  assert.equal(report.collected, 0);
  assert.equal(report.pendingArrears, 0);
  assert.equal(report.totalComplaints, 0);
  assert.equal(report.totalDowntime, 0);
});

test('WhatsApp summary and print HTML carry the key figures and the note', () => {
  const report = build();
  const text = buildOwnerKhataWhatsAppText(report);
  assert.match(text, /Owner Khata Closing/);
  assert.match(text, /Rs\. 5,000/);
  assert.match(text, /Rs\. 3,000/);
  assert.match(text, /Test closing note/);
  const html = buildOwnerKhataPrintHtml(report);
  assert.match(html, /Monthly Business &amp; Network Health Report/);
  assert.match(html, /Rs\. 5,000/);
  assert.match(html, /Test closing note/);
  assert.match(html, /Waseem/);
});

test('closing notes: sanitize, set, delete, and fake-storage round-trip', () => {
  assert.deepEqual(sanitizeMonthlyClosingNotes({
    '2026-10': { note: '  kept  ', savedAt: '2026-10-27T00:00:00.000Z' },
    bogus: { note: 'dropped' },
    '2026-11': { note: '   ' },
    '2026-12': { note: 'no stamp', savedAt: 42 }
  }), {
    '2026-10': { note: 'kept', savedAt: '2026-10-27T00:00:00.000Z' },
    '2026-12': { note: 'no stamp', savedAt: '' }
  });
  const original = { '2026-10': { note: 'old', savedAt: 'x' } };
  const updated = setMonthlyClosingNote(original, '2026-11', 'new', new Date('2026-11-01T00:00:00Z'));
  assert.equal(updated['2026-11'].note, 'new');
  assert.equal(original['2026-11'], undefined);
  assert.deepEqual(setMonthlyClosingNote(updated, '2026-11', '   ')['2026-11'], undefined);
  assert.equal(getMonthlyClosingNote(updated, '2026-11'), 'new');
  assert.equal(getMonthlyClosingNote(updated, '2026-09'), '');

  const store = new Map();
  const fakeStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, value); }
  };
  assert.equal(saveMonthlyClosingNotes({ '2026-10': { note: 'hi', savedAt: 's' } }, fakeStorage), true);
  assert.equal(store.get(MONTHLY_CLOSING_NOTES_KEY).includes('hi'), true);
  assert.deepEqual(loadMonthlyClosingNotes(fakeStorage), { '2026-10': { note: 'hi', savedAt: 's' } });
  assert.deepEqual(loadMonthlyClosingNotes({ getItem: () => { throw new Error('blocked'); } }), {});
});

// ---------------------------------------------------------------------------
// SISP-176: the SISP-43 ticket-charge breakdown. Settled ticket charges
// ride INSIDE normal payments (ticketCharges stamp), so the split breaks
// the month's collections into bill money vs ticket money without ever
// adding a rupee. Pending charges are a month-end receivable rebuilt
// from the ticket records — never income.
// ---------------------------------------------------------------------------
function ticketState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', dueAmount: 3000, payments: [
          { id: 'p1', date: '2026-10-06', amount: 3500, method: 'Cash', ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] }
        ] }
      ] },
      { id: 'c2', customerNumber: 2, name: 'Bilal', bills: [
        { month: '2026-10', dueAmount: 2000, payments: [
          { id: 'p2', date: '2026-10-07', amount: 2000, method: 'Cash' }
        ] }
      ] }
    ],
    expenses: []
  };
}

// Sanitized-shape SISP-12 records (billedAmount is derived from
// materialsUsed by the sanitizer, which buildOwnerKhataReport applies).
function ticketRecords() {
  const line = (amount) => [{ key: 'patch-cord', label: 'Patch Cord', qty: 1, amount }];
  return [
    // Settled in October by p1 — not pending at any month end from Oct on.
    { id: 'TKT-101', customerId: 'c1', status: 'Resolved', billingType: 'billed', resolvedAt: '2026-10-04T10:00', materialsUsed: line(500), chargePaid: true, chargePaidAt: '2026-10-06T11:00', chargePaymentId: 'p1' },
    // Billed in October, still unpaid — pending at October month end.
    { id: 'TKT-103', customerId: 'c2', status: 'Resolved', billingType: 'billed', resolvedAt: '2026-10-20T10:00', materialsUsed: line(700), chargePaid: false },
    // Billed in September, paid in November — pending at BOTH the
    // September and October month ends, settled by November's.
    { id: 'TKT-104', customerId: 'c1', status: 'Resolved', billingType: 'billed', resolvedAt: '2026-09-15T10:00', materialsUsed: line(400), chargePaid: true, chargePaidAt: '2026-11-02T09:00', chargePaymentId: 'p-later' },
    // Billed and paid inside October — never pending.
    { id: 'TKT-105', customerId: 'c2', status: 'Resolved', billingType: 'billed', resolvedAt: '2026-10-10T10:00', materialsUsed: line(300), chargePaid: true, chargePaidAt: '2026-10-12T09:00', chargePaymentId: 'p2x' },
    // Resolved in November — invisible to October's month end.
    { id: 'TKT-106', customerId: 'c2', status: 'Resolved', billingType: 'billed', resolvedAt: '2026-11-05T10:00', materialsUsed: line(900), chargePaid: false },
    // Free ticket and still-open ticket — never a billed receivable.
    { id: 'TKT-107', customerId: 'c2', status: 'Resolved', billingType: 'free', resolvedAt: '2026-10-11T10:00', materialsUsed: line(600), chargePaid: false },
    { id: 'TKT-108', customerId: 'c2', status: 'Open', billingType: 'billed', resolvedAt: '', materialsUsed: line(800), chargePaid: false }
  ];
}

test('SISP-176 PINNED: Rs 3,000 bill + Rs 500 ticket charge splits collected into 3,000 + 500', () => {
  const report = buildOwnerKhataReport(ticketState(), '2026-10', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(report.ticketChargesCollected, 500);
  assert.equal(report.billCollections, 5000);
  assert.equal(report.ticketChargeReceiptCount, 1);
  // Identity: Bill Collections + Ticket Charges == total collections
  // (this fixture has no voided receipts, so the split total is exactly
  // the report's collected figure — the split never adds on top).
  assert.equal(report.billCollections + report.ticketChargesCollected, report.collected);
  assert.equal(report.collected, 5500);
});

test('SISP-176: voiding the carrying payment removes its ticket portion from BOTH split lines', () => {
  const state = ticketState();
  state.customers.push({ id: 'c3', customerNumber: 3, name: 'Voided', bills: [
    { month: '2026-10', dueAmount: 3000, payments: [
      { id: 'p3', date: '2026-10-08', amount: 3500, method: 'Cash',
        ticketCharges: [{ ticketId: 'TKT-109', amount: 500 }],
        voided: true, voidedAt: '2026-10-09T10:00:00', voidReason: 'Wrong entry' }
    ] }
  ] });
  const report = buildOwnerKhataReport(state, '2026-10', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(report.ticketChargesCollected, 500, 'the voided stamp settles nothing');
  assert.equal(report.billCollections, 5000, 'the voided bill money leaves the split too');
  assert.equal(report.ticketChargeReceiptCount, 1);
  // The identity total is the month's NON-VOIDED collections.
  assert.equal(report.billCollections + report.ticketChargesCollected, 5500);
});

test('SISP-176: pending ticket charges are a month-end receivable, never income', () => {
  const october = buildOwnerKhataReport(ticketState(), '2026-10', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(october.ticketChargesPending, 1100, 'TKT-103 (700, unpaid) + TKT-104 (400, paid only in November)');
  assert.equal(october.ticketChargesPendingCount, 2);
  const september = buildOwnerKhataReport(ticketState(), '2026-09', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(september.ticketChargesPending, 400, 'only TKT-104 existed and was unpaid at September end');
  assert.equal(september.ticketChargesPendingCount, 1);
  const august = buildOwnerKhataReport(ticketState(), '2026-08', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(august.ticketChargesPending, 0);
  const noTickets = buildOwnerKhataReport(ticketState(), '2026-10', { referenceDate: REF });
  assert.equal(noTickets.ticketChargesPending, 0);
  assert.equal(noTickets.ticketChargesPendingCount, 0);
});

test('SISP-176: WhatsApp text and print HTML carry the ticket lines', () => {
  const report = buildOwnerKhataReport(ticketState(), '2026-10', { referenceDate: REF, tickets: ticketRecords() });
  const text = buildOwnerKhataWhatsAppText(report);
  assert.match(text, /Ticket Charges Collected: Rs\. 500/);
  assert.match(text, /Ticket Charges Pending: Rs\. 1,100/);
  const html = buildOwnerKhataPrintHtml(report);
  assert.match(html, /Ticket Charges Collected/);
  assert.match(html, /Ticket Charges Pending \(month end, 2 tickets\)/);
  // A month with no ticket activity keeps the WhatsApp summary lean.
  const quiet = buildOwnerKhataWhatsAppText(buildOwnerKhataReport(baseState(), '2026-10', { referenceDate: REF }));
  assert.doesNotMatch(quiet, /Ticket Charges/);
});

test('SISP-176: invalid month zeroes the ticket figures too', () => {
  const report = buildOwnerKhataReport(ticketState(), 'bogus', { referenceDate: REF, tickets: ticketRecords() });
  assert.equal(report.billCollections, 0);
  assert.equal(report.ticketChargesCollected, 0);
  assert.equal(report.ticketChargeReceiptCount, 0);
  assert.equal(report.ticketChargesPending, 0);
  assert.equal(report.ticketChargesPendingCount, 0);
});

test('closing notes travel in JSON backup under the safe-merge rule', () => {
  const state = createInitialState([]);
  const notes = { '2026-10': { note: 'backup note', savedAt: '2026-10-27T00:00:00.000Z' } };
  const backupJson = createJsonBackup(state, new Date('2026-10-27T00:00:00Z'), { monthlyClosingNotes: notes });
  const parsed = JSON.parse(backupJson);
  assert.deepEqual(parsed.settings.monthlyClosingNotes, notes);

  const localState = createInitialState([]);
  const adopted = previewJsonBackupMerge(localState, backupJson, {});
  assert.equal(adopted.counts.monthlyClosingNotesRestored, 1);
  assert.deepEqual(adopted.monthlyClosingNotes, notes);

  const conflicting = previewJsonBackupMerge(localState, backupJson, {
    currentMonthlyClosingNotes: { '2026-10': { note: 'different', savedAt: 's' } },
    currentMonthlyClosingNotesStored: true
  });
  assert.equal(conflicting.monthlyClosingNotes, null);
  assert.equal(conflicting.conflicts.some((c) => c.field === 'Monthly closing notes differ from this device'), true);
});
