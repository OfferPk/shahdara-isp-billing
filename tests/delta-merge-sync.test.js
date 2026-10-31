/**
 * SISP-102 — Multi-Device Phone-to-PC Incremental Delta Merge.
 *
 * Pins: the CRC gate (verified only), the spec scenario (Device A's
 * receipt RCP-501 + Device B's complaint CMP-201 both preserved with
 * balances recalculated by the engine from the merged records), union
 * by record ID for every sibling family a backup carries, conflicts
 * (default keep-local, explicit per-record incoming resolution),
 * unkeyed/duplicate records never silently added, idempotent re-merge,
 * void records travelling with their audit state, and the app wiring
 * (snapshot-before-apply hard gate). Synthetic fixtures only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, saveBillMonth, addPayment,
  createJsonBackup, previewJsonBackupMerge, calculatePaymentAllocations
} from '../core.js';
import {
  DELTA_MERGE_FAMILIES, verifyDeltaMergeBackup, planDeltaMergeSections,
  applyDeltaMergeSections, findIncomingVoidNotices
} from '../delta-merge-sync.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T12:00:00+05:00');
const clone = (value) => JSON.parse(JSON.stringify(value));

function baseState() {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 01', REF);
  const customerId = state.customers[0].id;
  state = saveBillMonth(state, customerId, { month: '2026-10', dueAmount: 3000, status: 'pending' }, REF);
  return { state, customerId };
}

function withPayment(state, customerId, { id, amount, date = '2026-10-10', voided = false }) {
  const next = addPayment(state, customerId, '2026-10', { date, amount: String(amount), method: 'Cash' }, REF);
  const bill = next.customers[0].bills.find((row) => row.month === '2026-10');
  const payment = bill.payments[bill.payments.length - 1];
  payment.id = id;
  if (voided) payment.voided = true;
  return next;
}

const complaint = (overrides = {}) => ({
  id: 'CMP-201', customerId: null, customerName: 'Test Customer 01', zone: '',
  issueCategory: 'Other', reportedAt: '2026-10-12T09:30', resolvedAt: '',
  downtimeHours: null, downtimeManual: false, status: 'Open', resolutionNote: '',
  resolvedViaTicketId: '', syncReopenGuard: '', createdAt: '2026-10-12T09:30',
  ...overrides
});

const voidRecord = (customerId, overrides = {}) => ({
  id: 'void-fixture-1', customerId, customerNumber: 1, customerName: 'Test Customer 01',
  billMonth: '2026-10', paymentId: 'RCP-501', paymentDate: '2026-10-10', amount: 1000,
  method: 'Cash', shop: '', voidReason: 'Duplicate entry on PC', voidedAt: '2026-10-14T09:00',
  promiseRestored: false, restoredPromiseDate: '', createdAt: '2026-10-14T09:00',
  ...overrides
});

test('SISP-102 gate: only CRC-verified backups may delta-merge', () => {
  const { state } = baseState();
  const good = createJsonBackup(state, REF, { complaints: [complaint()] });
  assert.equal(verifyDeltaMergeBackup(good).ok, true);
  assert.equal(verifyDeltaMergeBackup(good).status, 'verified');

  const tampered = good.replace('CMP-201', 'CMP-202');
  assert.equal(verifyDeltaMergeBackup(tampered).status, 'mismatch');
  const tamperedPlan = planDeltaMergeSections({ backupText: tampered, currentSections: {} });
  assert.equal(tamperedPlan.ok, false);
  assert.deepEqual(tamperedPlan.families, {});
  assert.throws(() => applyDeltaMergeSections({ currentSections: {}, plan: tamperedPlan }), /not applicable/);

  const legacy = JSON.parse(good);
  delete legacy.checksum;
  assert.equal(verifyDeltaMergeBackup(JSON.stringify(legacy)).status, 'unverified');
  assert.equal(planDeltaMergeSections({ backupText: JSON.stringify(legacy), currentSections: {} }).ok, false);

  assert.equal(verifyDeltaMergeBackup('{not json').status, 'invalid');
  assert.equal(verifyDeltaMergeBackup(JSON.stringify({ format: 'other', formatVersion: 1 })).status, 'invalid');
  assert.equal(verifyDeltaMergeBackup(42).status, 'invalid');
});

test('SISP-102 PIN: merging Device A (RCP-501) with Device B (CMP-201) preserves both, balances recalculated', () => {
  const { state: base, customerId } = baseState();
  // Device A (this device): recorded receipt RCP-501, Rs 1,000 of the Rs 3,000 bill.
  const localState = withPayment(base, customerId, { id: 'RCP-501', amount: 1000 });
  const localSections = { complaints: [] };
  // Device B: same ledger without that receipt, but it logged complaint CMP-201.
  const backupText = createJsonBackup(base, REF, { complaints: [complaint()] });

  // Composed exactly as the app does: shipped preview for state, delta plan for sections.
  const statePreview = previewJsonBackupMerge(localState, backupText);
  const plan = planDeltaMergeSections({ backupText, currentSections: localSections });
  assert.equal(plan.ok, true);
  assert.equal(plan.totals.added, 1);
  const { sections } = applyDeltaMergeSections({ currentSections: localSections, plan });

  const mergedBill = statePreview.state.customers[0].bills.find((row) => row.month === '2026-10');
  assert.ok(mergedBill.payments.some((payment) => payment.id === 'RCP-501'), 'receipt RCP-501 preserved');
  assert.ok(sections.complaints.some((entry) => entry.id === 'CMP-201'), 'complaint CMP-201 preserved');

  // Balances are recalculated by the engine from the merged records —
  // never copied from either device: Rs 3,000 billed, Rs 1,000 paid.
  const allocations = calculatePaymentAllocations(statePreview.state);
  assert.equal(allocations.forMonth(customerId, '2026-10').balanceDueCents, 200000);
  assert.equal(allocations.byPaymentId.get('RCP-501').amount, 1000);
});

test('SISP-102: a receipt recorded only on the other device joins the union and moves the recalculated balance', () => {
  const { state: base, customerId } = baseState();
  const localState = withPayment(base, customerId, { id: 'RCP-501', amount: 1000 });
  const deviceB = withPayment(base, customerId, { id: 'RCP-502', amount: 700, date: '2026-10-11' });
  const backupText = createJsonBackup(deviceB, REF, {});

  const statePreview = previewJsonBackupMerge(localState, backupText);
  assert.equal(statePreview.counts.addedPayments, 1);
  const ids = statePreview.state.customers[0].bills[0].payments.map((payment) => payment.id).sort();
  assert.deepEqual(ids, ['RCP-501', 'RCP-502']);
  assert.equal(calculatePaymentAllocations(statePreview.state).forMonth(customerId, '2026-10').balanceDueCents, 130000);
});

test('SISP-102 conflicts: same ID with different details keeps local by default, incoming only by explicit choice', () => {
  const localSections = { complaints: [complaint()] };
  const incoming = complaint({ status: 'Resolved', resolvedAt: '2026-10-13T10:00', resolutionNote: 'Fixed on the PC' });
  const { state } = baseState();
  const backupText = createJsonBackup(state, REF, { complaints: [incoming] });

  const before = clone(localSections);
  const plan = planDeltaMergeSections({ backupText, currentSections: localSections });
  assert.equal(plan.totals.added, 0);
  assert.equal(plan.totals.conflicts, 1);
  assert.equal(plan.families.complaints.conflicts[0].key, 'complaints:CMP-201');
  assert.deepEqual(localSections, before, 'planning never mutates the local sections');

  const kept = applyDeltaMergeSections({ currentSections: localSections, plan });
  assert.equal(kept.sections.complaints[0].status, 'Open');
  assert.equal(kept.applied.keptLocal, 1);

  const resolved = applyDeltaMergeSections({
    currentSections: localSections, plan, resolutions: { 'complaints:CMP-201': 'incoming' }
  });
  assert.equal(resolved.sections.complaints[0].status, 'Resolved');
  assert.equal(resolved.sections.complaints[0].resolutionNote, 'Fixed on the PC');
  assert.equal(resolved.applied.resolvedIncoming, 1);
  assert.deepEqual(localSections, before, 'applying never mutates the input sections');
});

test('SISP-102: only-local records survive, only-incoming records append, unkeyed and duplicate records are never silently added', () => {
  const { state } = baseState();
  const ticket = {
    id: 'TKT-101', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut',
    status: 'Open', createdAt: '2026-10-12T09:00'
  };
  const localSections = {
    tickets: [ticket],
    loans: [{ id: '', person: 'Local Person', direction: 'dena', kind: 'loan', amount: 250, date: '2026-10-01' }]
  };
  const backupText = createJsonBackup(state, REF, {
    complaints: [complaint(), complaint()],
    loans: [{ id: '', person: 'Other Person', direction: 'lena', kind: 'loan', amount: 500, date: '2026-10-02' }]
  });
  const plan = planDeltaMergeSections({ backupText, currentSections: localSections });
  assert.equal(plan.families.complaints.added.length, 1, 'identical duplicate inside the backup is added once');
  assert.equal(plan.families.complaints.skippedDuplicates, 1);
  assert.equal(plan.families.loans.skippedUnkeyed, 1, 'an unkeyed incoming record cannot be unioned safely');
  assert.equal(plan.families.tickets, undefined, 'families absent from the backup are not part of the merge');

  const { sections } = applyDeltaMergeSections({ currentSections: localSections, plan });
  assert.equal(sections.tickets.length, 1, 'local-only family passes through untouched');
  assert.equal(sections.tickets[0].id, 'TKT-101');
  assert.equal(sections.loans.length, 1, 'the local unkeyed record is never deleted by a merge');
  assert.equal(sections.loans[0].person, 'Local Person');
  assert.equal(sections.complaints.length, 1);
});

test('SISP-102: re-merging the same backup is a no-op (idempotent union)', () => {
  const { state } = baseState();
  const backupText = createJsonBackup(state, REF, {
    complaints: [complaint()],
    tickets: [{ id: 'TKT-101', customerId: 'cust-x', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' }]
  });
  const first = applyDeltaMergeSections({ currentSections: {}, plan: planDeltaMergeSections({ backupText, currentSections: {} }) });
  const secondPlan = planDeltaMergeSections({ backupText, currentSections: first.sections });
  assert.equal(secondPlan.totals.added, 0);
  assert.equal(secondPlan.totals.unchanged, 2);
  const second = applyDeltaMergeSections({ currentSections: first.sections, plan: secondPlan });
  assert.deepEqual(second.sections, first.sections);
});

test('SISP-102: void records travel with their audit state and surface as notices, never silently applied', () => {
  const { state: base, customerId } = baseState();
  const localState = withPayment(base, customerId, { id: 'RCP-501', amount: 1000 });
  // Device B voided RCP-501: its state copy carries voided:true and its
  // backup carries the SISP-34 void audit record.
  const deviceB = withPayment(base, customerId, { id: 'RCP-501', amount: 1000, voided: true });
  const backupText = createJsonBackup(deviceB, REF, { voidPayments: [voidRecord(customerId)] });

  const statePreview = previewJsonBackupMerge(localState, backupText);
  assert.ok(
    statePreview.conflicts.some((conflict) => conflict.field === 'payment RCP-501'),
    'the shipped state preview surfaces the voided-payment difference as a conflict'
  );
  const mergedPayment = statePreview.state.customers[0].bills[0].payments.find((payment) => payment.id === 'RCP-501');
  assert.notEqual(mergedPayment.voided, true, 'the local live copy is kept — a merge never flips void state silently');

  const plan = planDeltaMergeSections({ backupText, currentSections: {} });
  assert.equal(plan.families.voidPayments.added.length, 1);
  const { sections } = applyDeltaMergeSections({ currentSections: {}, plan });
  assert.equal(sections.voidPayments[0].paymentId, 'RCP-501');
  assert.equal(sections.voidPayments[0].voidReason, 'Duplicate entry on PC');

  const notices = findIncomingVoidNotices(sections, statePreview.state);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].paymentId, 'RCP-501');
  assert.equal(notices[0].amount, 1000);
});

test('SISP-102: object-shaped families (closing notes, overheads) and day-keyed roznamcha union by their natural keys', () => {
  const { state } = baseState();
  const localSections = {
    monthlyClosingNotes: { '2026-09': { note: 'My note', savedAt: '2026-10-01T09:00' } },
    overheads: { templates: [{ id: 'upstream-bandwidth', defaultAmount: 30000 }], postings: [] },
    roznamchaDays: [{ date: '2026-10-05', outflows: [], closed: false }]
  };
  const backupText = createJsonBackup(state, REF, {
    monthlyClosingNotes: {
      '2026-09': { note: 'Their note', savedAt: '2026-10-02T09:00' },
      '2026-08': { note: 'Older month', savedAt: '2026-09-01T09:00' }
    },
    overheads: {
      templates: [{ id: 'upstream-bandwidth', defaultAmount: 35000 }],
      postings: [{ id: 'oh-1', templateId: 'upstream-bandwidth', month: '2026-10', expenseId: '', amount: 35000, date: '2026-10-01', note: '' }]
    },
    roznamchaDays: [
      { date: '2026-10-05', outflows: [{ id: 'out-1', category: 'Petrol / Bike Fuel', amount: 200, lineman: '', note: '' }], closed: false },
      { date: '2026-10-06', outflows: [], closed: false }
    ]
  });
  const plan = planDeltaMergeSections({ backupText, currentSections: localSections });
  assert.equal(plan.families.monthlyClosingNotes.added.length, 1);
  assert.equal(plan.families.monthlyClosingNotes.conflicts.length, 1);
  assert.equal(plan.families.overheads.added.length, 1, 'the new posting is added');
  assert.equal(plan.families.overheads.conflicts.length, 1, 'the changed template amount conflicts');
  assert.equal(plan.families.roznamchaDays.added.length, 1, 'the new day is added');
  assert.equal(plan.families.roznamchaDays.conflicts.length, 1, 'a differing same-date day conflicts whole, never merges partially');

  const { sections } = applyDeltaMergeSections({ currentSections: localSections, plan });
  assert.equal(sections.monthlyClosingNotes['2026-09'].note, 'My note');
  assert.equal(sections.monthlyClosingNotes['2026-08'].note, 'Older month');
  assert.equal(sections.overheads.templates[0].defaultAmount, 30000);
  assert.equal(sections.overheads.postings.length, 1);
  assert.equal(sections.roznamchaDays.length, 2);
  assert.equal(sections.roznamchaDays.find((day) => day.date === '2026-10-05').outflows.length, 0);
});

test('SISP-102: every record family a backup can carry is covered by the delta registry', () => {
  const { state, customerId } = baseState();
  const allSections = {
    shopSettlements: [{ id: 'shop-settle-1', shop: 'Test Shop', amount: 500, date: '2026-10-05', note: '', allocations: [], createdAt: '' }],
    complaints: [complaint()],
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
    voidPayments: [voidRecord(customerId)],
    monthlyClosingNotes: { '2026-09': { note: 'Test closing note', savedAt: '2026-10-01T10:00' } },
    overheads: { templates: [{ id: 'upstream-bandwidth', defaultAmount: 35000 }], postings: [{ id: 'oh-1', templateId: 'upstream-bandwidth', month: '2026-10', expenseId: '', amount: 35000, date: '2026-10-01', note: '' }] }
  };
  const backupText = createJsonBackup(state, REF, allSections);
  const emitted = Object.keys(JSON.parse(backupText).settings ?? {});
  const plan = planDeltaMergeSections({ backupText, currentSections: {} });
  assert.equal(plan.ok, true);
  for (const key of emitted) {
    assert.ok(plan.families[key], `delta plan covers backup section ${key}`);
  }
  assert.deepEqual(
    Object.keys(plan.families).sort(),
    DELTA_MERGE_FAMILIES.map((family) => family.key).sort(),
    'the registry covers exactly the families the backup emits here'
  );
  const { sections, applied } = applyDeltaMergeSections({ currentSections: {}, plan });
  assert.equal(applied.added, plan.totals.added);
  assert.ok(plan.totals.added >= 21, 'every fixture record was added');
  assert.equal(sections.complaints[0].id, 'CMP-201');
  assert.equal(sections.suspensePayments[0].suspenseId, 'SUS-101');
  assert.equal(sections.referralCredits[0].referralId, 'REF-101');
  assert.equal(sections.billingGroups[0].billingGroupId, 'GRP-101');
  assert.equal(sections.voidPayments[0].paymentId, 'RCP-501');
});

test('SISP-102 wiring: app composes gate + shipped preview + delta plan, snapshot hard-gates the apply, dialog + i18n exist', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/delta-merge-sync\.js'/);
  assert.ok(htmlSource.includes('id="deltaMergeDialog"'));
  assert.ok(htmlSource.includes('id="deltaMergeFileInput"'));
  assert.ok(htmlSource.includes('id="applyDeltaMergeButton"'));

  const applyStart = appSource.indexOf("$('#applyDeltaMergeButton')");
  assert.ok(applyStart > 0, 'delta apply handler exists');
  const applyBlock = appSource.slice(applyStart, applyStart + 2600);
  const snapshotAt = applyBlock.indexOf('createSafetySnapshot()');
  const persistAt = applyBlock.indexOf('persistState(');
  assert.ok(snapshotAt > 0 && persistAt > snapshotAt, 'the pre-merge snapshot is taken before any persist');
  assert.match(applyBlock, /if \(!snapshot\)/, 'a failed snapshot aborts the apply');
  assert.ok(applyBlock.indexOf('applyDeltaMergeSections') > 0, 'apply routes through the delta module');

  const enKeys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('dmerge_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((key) => key.startsWith('dmerge_')).sort();
  assert.ok(enKeys.length >= 30, 'delta merge keys exist in English');
  assert.deepEqual(enKeys, urKeys, 'every dmerge_ key exists in both en and ur');
  for (const key of enKeys) {
    assert.ok(!TRANSLATIONS.en[key].includes(key) && TRANSLATIONS.en[key].length > 0, `en ${key} resolves`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur ${key} resolves`);
  }
  // Every t('dmerge_…') call in app.js resolves in both dictionaries.
  for (const match of appSource.matchAll(/t\('(dmerge_[a-z_]+)'/g)) {
    assert.ok(TRANSLATIONS.en[match[1]] && TRANSLATIONS.ur[match[1]], `t('${match[1]}') resolves in en+ur`);
  }
});
