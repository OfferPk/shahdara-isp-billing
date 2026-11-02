/**
 * M15 — Full Backup Round-Trip Drill: All 44 Sections (test-only).
 *
 * M5's completeness pin proves every section a backup can emit is
 * registered (38 DELTA_MERGE_FAMILIES record families) or a documented
 * single-object exclusion (digitalPayments, partnerSettings,
 * charityReserve, receiptFooter, emergencyRunbook, branchGuard). This
 * drill proves the whole journey loses nothing:
 *
 *   kitchen-sink state + all 44 settings sections
 *     -> createJsonBackup (core.js, the app's real export)
 *     -> JSON text (serialize -> parse, exactly as a file transfer)
 *     -> previewJsonBackupMerge into a FRESH state (core.js — the
 *        deepest importable seam of the app's real restore path; app.js
 *        backupRestoreOptions() feeds it the device's current sections,
 *        and on a fresh device every current section is empty and every
 *        *Stored flag is false, which is exactly the option shape used
 *        here: no current sections supplied, plus a real branch-guard
 *        record so the lineage classification runs as the app runs it)
 *     -> every one of the 44 sections deep-equals the section the
 *        backup file actually carries, and the restored ledger state
 *        deep-equals the original state (modulo the restore-side
 *        default fills the SISP-200 certification documents).
 *
 * Sections are enumerated FROM the backup document itself, with the
 * count pinned at 44: a future section added to createJsonBackup
 * without drill coverage fails this file loudly. Each fixture carries
 * a distinctive marker value, and every emitted section is asserted
 * non-empty, so a section silently restoring empty/default is caught.
 * All data is synthetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, saveBillMonth, addPayment,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { DELTA_MERGE_FAMILIES } from '../delta-merge-sync.js';
import {
  createBranchGuard, createBranchGuardStamp, recordBranchGuardExport
} from '../branch-guard.js';

const REF = new Date('2026-10-15T12:00:00+05:00');
const clone = (value) => JSON.parse(JSON.stringify(value));

// The six single-object sections: deliberately NOT delta-merged record
// families (the shipped safe-merge rule governs five of them; the
// branchGuard stamp is never merged — it classifies the restore).
const SINGLE_OBJECT_SECTIONS = [
  'branchGuard', 'charityReserve', 'digitalPayments',
  'emergencyRunbook', 'partnerSettings', 'receiptFooter'
];

// ---------------------------------------------------------------------------
// Fixtures. Record shapes are copied from the shipped M5 kitchen-sink in
// tests/delta-merge-sync.test.js (each family's real shape, proven to
// survive the family's own sanitizer onto the backup). Synthetic only.
// ---------------------------------------------------------------------------

const complaintRow = (overrides = {}) => ({
  id: 'CMP-201', customerId: null, customerName: 'M15 Drill Customer', zone: '',
  issueCategory: 'Other', reportedAt: '2026-10-12T09:30', resolvedAt: '',
  downtimeHours: null, downtimeManual: false, status: 'Open', resolutionNote: '',
  resolvedViaTicketId: '', syncReopenGuard: '', createdAt: '2026-10-12T09:30',
  ...overrides
});

const voidRow = (customerId, overrides = {}) => ({
  id: 'void-m15-1', customerId, customerNumber: 1, customerName: 'M15 Drill Customer',
  billMonth: '2026-10', paymentId: 'RCP-M15-501', paymentDate: '2026-10-10', amount: 1000,
  method: 'Cash', shop: '', voidReason: 'M15 drill void', voidedAt: '2026-10-14T09:00',
  promiseRestored: false, restoredPromiseDate: '', createdAt: '2026-10-14T09:00',
  ...overrides
});

// The 18 record families added after SISP-102's build base — verbatim
// shapes from the M5 fixtures in tests/delta-merge-sync.test.js.
const m5FamilySections = () => ({
  converterSides: [{ id: 'WDM-101', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' }],
  linemanPayouts: [{ linemanName: 'Test Lineman', month: '2026-09', baseSalary: 15000, paidDate: '2026-09-30', note: '', createdAt: '2026-09-30T10:00' }],
  deadPorts: [{ boxId: 'BOX-101', port: 3, lockedAt: '2026-10-01T09:00', note: 'Burnt port' }],
  fieldBagMovements: [{ id: 'BAG-101', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' }],
  polesRegistry: [{ poleId: 'POLE-101', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' }],
  fiberDrums: [{ label: 'Test drum', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' }],
  stormInspections: { runs: [{ date: '2026-10-14', startedAt: '2026-10-14T08:00', checks: {} }] },
  supplierKhata: [{ supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' }],
  commissionRules: [{ kind: 'field', label: 'Test Collector', mode: 'perReceipt', perReceiptFixed: 50, percentageOfCollection: 0 }],
  upsNodes: [{ nodeId: 'UPS-101', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' }],
  feederCables: [{ cableId: 'FC-101', label: 'Test feeder', coreCount: 12, cores: [], history: [] }],
  creditTransfers: [{ fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' }],
  fieldTools: [{ type: 'fusion-splicer', name: 'Test Splicer', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' }],
  spliceClosures: [{ closureId: 'JC-01', name: 'Test closure', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' }],
  badDebts: [{ badDebtId: 'BD-101', customerId: 'cust-x', customerNumber: 7, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' }],
  splitterPolish: { 'BOX-101': 'APC' },
  splitterBoxGps: { 'BOX-101': { lat: 33.7, lng: 73.1 } },
  expenseBudgets: { Cable: 5000, Electricity: 20000 }
});

function kitchenSink() {
  let state = createInitialState([]);
  state = addCustomer(state, 'M15 Drill Customer', REF);
  const customerId = state.customers[0].id;
  state = saveBillMonth(state, customerId, { month: '2026-10', dueAmount: 3000, status: 'pending' }, REF);
  state = addPayment(state, customerId, '2026-10', { date: '2026-10-10', amount: '1000', method: 'Cash' }, REF);

  // A real lineage stamp over the fixture state, built with the shipped
  // branch-guard helpers exactly as app.js builds it at export time.
  let seq = 0;
  const guard = createBranchGuard({ idFactory: () => `guard-m15-${++seq}`, now: REF });
  const stamp = createBranchGuardStamp(guard, state, REF);
  const guardAfter = recordBranchGuardExport(guard, stamp, REF);

  const options = {
    shopSettlements: [{ id: 'shop-settle-1', shop: 'Test Shop', amount: 500, date: '2026-10-05', note: '', allocations: [], createdAt: '' }],
    complaints: [complaintRow()],
    tickets: [{ id: 'TKT-101', customerId: 'cust-x', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' }],
    roznamchaDays: [{ date: '2026-10-05', outflows: [], closed: false }],
    inventory: [{ id: 'STK-101', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' }],
    homeBudget: [{ id: 'HB-1', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' }],
    loans: [{ id: 'loan-1', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' }],
    waTemplates: [{ id: 'billGenerated', roman: 'Test roman template', urdu: 'Test urdu template' }],
    saadVisits: [{ id: 'visit-1', date: '2026-10-03', type: 'splicing', hoursWorked: 2 }],
    saadPayments: [{ id: 'saad-pay-1', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' }],
    installRequests: [{ id: 'inst-1', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' }],
    pendingWorks: [{ id: 'work-1', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' }],
    billingGroups: [{ billingGroupId: 'GRP-101', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' }],
    suspensePayments: [{ suspenseId: 'SUS-101', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-1', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' }],
    referralCredits: [{ referralId: 'REF-101', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-b', amount: 500, applications: [] }],
    partnerLedger: [{ id: 'pl-1', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' }],
    partnerSettlements: [{ id: 'partner-settle-2026-09', month: '2026-09', revenue: 10000, expenses: 4000, profit: 6000, perPartner: [{ partner: 'Nasir', share: 3000, drawings: 0, capital: 0, netPayout: 3000 }], note: '', status: 'confirmed', confirmedAt: '', reopenedAt: '', createdAt: '' }],
    voidPayments: [voidRow(customerId)],
    monthlyClosingNotes: { '2026-09': { note: 'Test closing note', savedAt: '2026-10-01T10:00' } },
    overheads: { templates: [{ id: 'upstream-bandwidth', defaultAmount: 35000 }], postings: [{ id: 'oh-1', templateId: 'upstream-bandwidth', month: '2026-10', expenseId: '', amount: 35000, date: '2026-10-01', note: '' }] },
    ...m5FamilySections(),
    digitalPaymentsSettings: { ownerRaastId: 'TEST-RAAST-1' },
    receiptFooter: { footerText: 'Test footer' },
    partnerSettings: { includeInstallationCapexInSplit: true },
    charityReserve: { charityReservePct: 5 },
    emergencyRunbook: { upstreamNoc: { label: 'Test NOC', phone: '0300-0000000' } },
    branchGuard: stamp
  };
  const backupText = createJsonBackup(state, REF, options);
  return { state, customerId, guardAfter, backupText };
}

// The value the restore hands back for a backup settings key: every
// record family returns under its own name; digitalPayments returns as
// digitalPaymentsSettings; the branchGuard stamp returns classified
// under preview.branchGuard.stamp (it is never merged as data).
function restoredSection(preview, key) {
  if (key === 'digitalPayments') return preview.digitalPaymentsSettings;
  if (key === 'branchGuard') return preview.branchGuard?.stamp;
  return preview[key];
}

// The restore-side default fills: restore runs every record through
// the shipped sanitizers, which fill fields the write paths never set
// with their explicit defaults. Probe-verified for this drill's state
// (a leaf-by-leaf diff of original vs restored): exactly FIVE fills
// and nothing else — customer lastContactedAt/lastContactChannel ->
// null and signalReadings -> [] (the SISP-200-documented fills), and
// bill kistLines -> [] / kistTotal -> 0 for a bill carrying no kist
// plan. Absent and explicit-default are the same record, so exactly
// those fields are dropped on BOTH sides when they hold a default
// value; everything else must match exactly.
const normalizeRestoreDefaults = (s) => {
  const copy = clone(s);
  for (const c of copy.customers ?? []) {
    if (c.lastContactedAt == null) delete c.lastContactedAt;
    if (c.lastContactChannel == null) delete c.lastContactChannel;
    if (Array.isArray(c.signalReadings) && c.signalReadings.length === 0) delete c.signalReadings;
    for (const b of c.bills ?? []) {
      if (Array.isArray(b.kistLines) && b.kistLines.length === 0) delete b.kistLines;
      if (b.kistTotal === 0) delete b.kistTotal;
    }
  }
  return copy;
};

const sectionIsNonEmpty = (value) => (Array.isArray(value)
  ? value.length > 0
  : (value && typeof value === 'object' ? Object.keys(value).length > 0 : Boolean(value)));

test('M15: the kitchen-sink backup emits exactly the 44 sections, enumerated from the document itself', () => {
  const { backupText } = kitchenSink();
  const document = JSON.parse(backupText);
  const emitted = Object.keys(document.settings ?? {}).sort();
  assert.equal(emitted.length, 44, 'the backup carries exactly 44 settings sections');
  assert.deepEqual(emitted, [
    'badDebts', 'billingGroups', 'branchGuard', 'charityReserve', 'commissionRules',
    'complaints', 'converterSides', 'creditTransfers', 'deadPorts', 'digitalPayments',
    'emergencyRunbook', 'expenseBudgets', 'feederCables', 'fiberDrums', 'fieldBagMovements',
    'fieldTools', 'homeBudget', 'installRequests', 'inventory', 'linemanPayouts',
    'loans', 'monthlyClosingNotes', 'overheads', 'partnerLedger', 'partnerSettings',
    'partnerSettlements', 'pendingWorks', 'polesRegistry', 'receiptFooter', 'referralCredits',
    'roznamchaDays', 'saadPayments', 'saadVisits', 'shopSettlements', 'spliceClosures',
    'splitterBoxGps', 'splitterPolish', 'stormInspections', 'supplierKhata', 'suspensePayments',
    'tickets', 'upsNodes', 'voidPayments', 'waTemplates'
  ], 'the emission surface is the known 44 (38 families + 6 single-object sections)');
  // Every emitted section is either a registered record family or one
  // of the six documented single-object sections — no third category.
  const registered = DELTA_MERGE_FAMILIES.map((family) => family.key);
  assert.equal(registered.length, 38, 'the delta registry holds 38 record families');
  for (const key of emitted) {
    assert.ok(registered.includes(key) || SINGLE_OBJECT_SECTIONS.includes(key),
      `emitted section ${key} is registered or a documented single-object section`);
    assert.ok(sectionIsNonEmpty(document.settings[key]), `emitted section ${key} is non-empty (fixture actually travelled)`);
  }
  for (const key of registered) {
    assert.ok(emitted.includes(key), `registered family ${key} is present in the kitchen-sink backup`);
  }
});

test('M15: full round-trip — all 44 sections restore deep-identical onto a fresh device', () => {
  const { backupText, guardAfter } = kitchenSink();
  const document = JSON.parse(backupText);
  const emitted = document.settings ?? {};
  // Serialize -> parse is the file journey; the restore consumes the
  // text itself, exactly as the app's file-input restore does.
  const preview = previewJsonBackupMerge(createInitialState(), backupText, { currentBranchGuard: guardAfter });
  assert.equal(preview.checksumStatus, 'verified', 'the drill backup passes its own checksum gate');
  assert.deepEqual(preview.conflicts, [], 'a fresh-device restore of a complete backup has no conflicts');
  assert.equal(preview.canApply, true, 'the fresh-device restore is applicable');
  assert.equal(preview.branchGuard.status, 'adopt', 'the fresh device adopts the backup lineage');
  assert.equal(preview.branchGuard.blocked, false);

  const keys = Object.keys(emitted).sort();
  assert.equal(keys.length, 44, 'the drill asserts all 44 sections individually');
  for (const key of keys) {
    const restored = restoredSection(preview, key);
    assert.ok(restored !== null && restored !== undefined,
      `section ${key}: the restore adopted a value (not silently dropped)`);
    assert.ok(sectionIsNonEmpty(restored), `section ${key}: restored value is non-empty (not defaulted)`);
    assert.deepEqual(restored, emitted[key], `section ${key}: restored deep-equals the backup section`);
  }

  // Distinctive markers survive the whole journey (a section restored
  // to a plausible-but-wrong default would fail these).
  assert.equal(preview.complaints[0].id, 'CMP-201');
  assert.equal(preview.upsNodes[0].nodeId, 'UPS-101');
  assert.equal(preview.feederCables[0].cableId, 'FC-101');
  assert.equal(preview.badDebts[0].badDebtId, 'BD-101');
  assert.equal(preview.referralCredits[0].referralId, 'REF-101');
  assert.equal(preview.suspensePayments[0].suspenseId, 'SUS-101');
  assert.equal(preview.billingGroups[0].billingGroupId, 'GRP-101');
  assert.equal(preview.digitalPaymentsSettings.ownerRaastId, 'TEST-RAAST-1');
  assert.equal(preview.receiptFooter.footerText, 'Test footer');
  assert.equal(preview.charityReserve.charityReservePct, 5);
  assert.equal(preview.partnerSettings.includeInstallationCapexInSplit, true);
  assert.equal(preview.branchGuard.stamp.lineageId, emitted.branchGuard.lineageId);
});

test('M15: the ledger state itself round-trips — restored state deep-equals the original', () => {
  const { state, backupText, guardAfter } = kitchenSink();
  const preview = previewJsonBackupMerge(createInitialState(), backupText, { currentBranchGuard: guardAfter });
  assert.equal(preview.counts.addedCustomers, 1, 'the one fixture customer is restored as an addition');
  assert.equal(preview.counts.addedBills, 1, 'the one fixture bill is restored');
  assert.equal(preview.counts.addedPayments, 1, 'the one fixture payment is restored');
  assert.deepEqual(
    normalizeRestoreDefaults(preview.state),
    normalizeRestoreDefaults(state),
    'restored ledger state deep-equals the original (restore default fills aside)'
  );
});

test('M15: the restored device re-exports an identical backup (the journey is stable)', () => {
  const { backupText, guardAfter } = kitchenSink();
  const first = JSON.parse(backupText);
  const preview = previewJsonBackupMerge(createInitialState(), backupText, { currentBranchGuard: guardAfter });
  // Rebuild the export options from the restored sections, the same
  // mapping backupExtras() applies in app.js, and export again from
  // the restored state.
  const options = {};
  for (const key of Object.keys(first.settings ?? {})) {
    if (key === 'digitalPayments') options.digitalPaymentsSettings = preview.digitalPaymentsSettings;
    else if (key === 'branchGuard') options.branchGuard = preview.branchGuard.stamp;
    else options[key] = preview[key];
  }
  const secondText = createJsonBackup(preview.state, REF, options);
  const second = JSON.parse(secondText);
  assert.deepEqual(Object.keys(second.settings ?? {}).sort(), Object.keys(first.settings ?? {}).sort(),
    'the re-export carries the same 44 sections');
  assert.deepEqual(second.settings, first.settings,
    'every section is byte-stable across export -> restore -> export');
  assert.deepEqual(
    normalizeRestoreDefaults(second.state),
    normalizeRestoreDefaults(first.state),
    'the ledger state is stable across export -> restore -> export'
  );
  const secondPreview = previewJsonBackupMerge(createInitialState(), secondText, { currentBranchGuard: guardAfter });
  assert.equal(secondPreview.checksumStatus, 'verified');
  assert.deepEqual(secondPreview.conflicts, [], 'the re-exported backup also restores conflict-free');
});
