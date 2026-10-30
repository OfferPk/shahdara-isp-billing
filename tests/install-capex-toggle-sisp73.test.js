// SISP-73: Installation Subsidy (SISP-23) ↔ Partner 50/50 CapEx Toggle.
// Pure-function tests on synthetic data only.
//
// The spec names connection-profitability.js, but the SISP-58 audit
// proved that file never existed on main — the real SISP-23 source is
// installation-cost.js, and buildMonthlyInstallationSummary there is the
// one aggregation the toggle reads (never a parallel computation).
//
// PIN (verbatim from the spec): toggling ON with Rs. 1,800 net monthly
// installation subsidy reduces distributable partner profit by Rs. 1,800
// (Rs. 900 per partner); toggling OFF tracks CapEx separately and leaves
// the split untouched. The PR #395 rule stays intact throughout: share =
// 50% of positive (distributable) profit, 0 on a loss month.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNER_SETTINGS_KEY,
  sanitizePartnerSettings,
  loadPartnerSettings,
  savePartnerSettings,
  buildPartnerSettlementReport,
  createPartnerSettlement,
  sanitizePartnerSettlements,
  generatePartnerSettlementWhatsAppText
} from '../partner-settlement.js';
import {
  buildMonthlyInstallationSummary,
  installationJoinMonth
} from '../installation-cost.js';
import { buildOwnerKhataReport } from '../owner-khata.js';
import { createJsonBackup, previewJsonBackupMerge, createInitialState } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const REF = new Date('2026-10-27T12:00:00Z');

// Revenue 150,000 (receipt by payment date) − expenses 50,000
// = Rs. 100,000 net profit → Rs. 50,000 share each (PR #395).
function profitState() {
  return {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', payments: [
        { id: 'p1', date: '2026-10-05', amount: 150000, method: 'Cash' }
      ] }
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 50000, category: 'Electricity' }]
  };
}

// The PIN install: joined October 2026, connection fee Rs. 1,200 against
// a Rs. 3,000 router → per-install net −1,800 → net monthly subsidy 1,800.
function pinState() {
  const state = profitState();
  state.customers.push({
    id: 'n1', customerNumber: 91, name: 'Synthetic Install',
    connectionDate: '2026-10-14', connectionFee: 1200, routerPrice: 3000, bills: []
  });
  return state;
}

test('monthly installation summary aggregates SISP-23 per-install nets by join month', () => {
  const summary = buildMonthlyInstallationSummary(pinState().customers, '2026-10');
  // 'Ali' joined in October too (earliest bill month) but recorded
  // nothing, so he counts as a joiner and never enters the money sums.
  assert.equal(summary.installCount, 2);
  assert.equal(summary.recordedCount, 1);
  assert.equal(summary.connectionFees, 1200);
  assert.equal(summary.totalCost, 3000);
  assert.equal(summary.net, -1800);
  assert.equal(summary.subsidy, 1800);
  assert.equal(summary.surplus, 0);
  assert.equal(summary.hasPartial, false);
  const september = buildMonthlyInstallationSummary(pinState().customers, '2026-09');
  assert.equal(september.installCount, 0);
  assert.equal(september.net, 0);
  assert.equal(september.subsidy, 0);
  const invalid = buildMonthlyInstallationSummary(pinState().customers, 'Oct 2026');
  assert.equal(invalid.month, '');
  assert.equal(invalid.installCount, 0);
});

test('installation join month mirrors the core customerJoinMonth fallback order', () => {
  assert.equal(installationJoinMonth({ addedOn: '2026-09-02', connectionDate: '2026-10-14' }), '2026-09');
  assert.equal(installationJoinMonth({ connectionDate: '2026-10-14' }), '2026-10');
  assert.equal(installationJoinMonth({ billingStartMonth: '2026-08' }), '2026-08');
  assert.equal(installationJoinMonth({ bills: [{ month: '2026-11' }, { month: '2026-10' }] }), '2026-10');
  assert.equal(installationJoinMonth({}), null);
  assert.equal(installationJoinMonth(null), null);
});

test('PIN: toggle OFF tracks the Rs. 1,800 subsidy separately, split untouched', () => {
  const report = buildPartnerSettlementReport(pinState(), '2026-10', [], REF);
  assert.equal(report.profit, 100000);
  assert.equal(report.installationCapex.included, false);
  assert.equal(report.installationCapex.subsidy, 1800);
  assert.equal(report.installationCapex.net, -1800);
  assert.equal(report.distributableProfit, 100000);
  assert.equal(report.share, 50000);
  for (const row of report.perPartner) {
    assert.equal(row.share, 50000);
    assert.equal(row.netPayout, 50000);
  }
});

test('PIN: toggle ON deducts the Rs. 1,800 subsidy — Rs. 900 less per partner', () => {
  const report = buildPartnerSettlementReport(pinState(), '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.equal(report.profit, 100000);
  assert.equal(report.installationCapex.included, true);
  assert.equal(report.installationCapex.subsidy, 1800);
  assert.equal(report.distributableProfit, 98200);
  assert.equal(report.share, 49100);
  for (const row of report.perPartner) {
    assert.equal(row.share, 49100);
    assert.equal(row.netPayout, 49100);
  }
  // The adjusted share still flows through drawings/capital as before.
  const withMovements = buildPartnerSettlementReport(pinState(), '2026-10', [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' }
  ], REF, { includeInstallationCapexInSplit: true });
  assert.equal(withMovements.perPartner.find((row) => row.partner === 'Nasir').netPayout, 34100);
  assert.equal(withMovements.perPartner.find((row) => row.partner === 'Aqib').netPayout, 49100);
});

test('a surplus month deducts nothing even with the toggle ON', () => {
  const state = profitState();
  state.customers.push({
    id: 'n2', customerNumber: 92, name: 'Synthetic Surplus',
    connectionDate: '2026-10-03', connectionFee: 5000, routerPrice: 3000, bills: []
  });
  const summary = buildMonthlyInstallationSummary(state.customers, '2026-10');
  assert.equal(summary.net, 2000);
  assert.equal(summary.surplus, 2000);
  assert.equal(summary.subsidy, 0);
  const report = buildPartnerSettlementReport(state, '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.equal(report.distributableProfit, 100000);
  assert.equal(report.share, 50000);
});

test('PR #395 rule intact: loss month pays 0 with the toggle ON, subsidy or not', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 5000, method: 'Cash' }] }
      ] },
      { id: 'n1', customerNumber: 91, name: 'Synthetic Install', connectionDate: '2026-10-14', connectionFee: 1200, routerPrice: 3000, bills: [] }
    ],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 20000, category: 'Electricity' }]
  };
  const report = buildPartnerSettlementReport(state, '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.equal(report.profit, -15000);
  assert.equal(report.isLoss, true);
  assert.equal(report.distributableProfit, -16800);
  assert.equal(report.share, 0);
});

test('a subsidy larger than the profit zeroes the share, never makes it negative', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 51000, method: 'Cash' }] }
      ] },
      { id: 'n1', customerNumber: 91, name: 'Synthetic Install', connectionDate: '2026-10-14', connectionFee: 1200, routerPrice: 3000, bills: [] }
    ],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 50000, category: 'Electricity' }]
  };
  const report = buildPartnerSettlementReport(state, '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.equal(report.profit, 1000);
  assert.equal(report.distributableProfit, -800);
  assert.equal(report.share, 0);
});

test('Owner Khata shows the same figures and the same adjusted split', () => {
  const off = buildOwnerKhataReport(pinState(), '2026-10', { referenceDate: REF });
  assert.equal(off.installationSubsidy, 1800);
  assert.equal(off.installationNet, -1800);
  assert.equal(off.installationCount, 2);
  assert.equal(off.installationCapexIncluded, false);
  assert.equal(off.distributableProfit, 100000);
  assert.equal(off.nasirShare, 50000);
  assert.equal(off.aqibShare, 50000);
  const on = buildOwnerKhataReport(pinState(), '2026-10', { referenceDate: REF, includeInstallationCapexInSplit: true });
  assert.equal(on.installationCapexIncluded, true);
  assert.equal(on.distributableProfit, 98200);
  assert.equal(on.nasirShare, 49100);
  assert.equal(on.aqibShare, 49100);
  // Settlement and Khata can never disagree on the adjusted share.
  const settlement = buildPartnerSettlementReport(pinState(), '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.equal(on.nasirShare, settlement.share);
  const invalid = buildOwnerKhataReport(pinState(), 'not-a-month', { referenceDate: REF });
  assert.equal(invalid.installationSubsidy, 0);
  assert.equal(invalid.installationCapexIncluded, false);
});

test('partner settings persist sanitized, default OFF, corrupt storage never flips the split', () => {
  assert.equal(PARTNER_SETTINGS_KEY, 'sisp_partner_settings_v1');
  assert.deepEqual(sanitizePartnerSettings(null), { includeInstallationCapexInSplit: false });
  assert.deepEqual(sanitizePartnerSettings({ includeInstallationCapexInSplit: 'yes' }), { includeInstallationCapexInSplit: false });
  assert.deepEqual(sanitizePartnerSettings({ includeInstallationCapexInSplit: true }), { includeInstallationCapexInSplit: true });
  const store = memoryStorage();
  assert.deepEqual(loadPartnerSettings(store), { includeInstallationCapexInSplit: false });
  assert.equal(savePartnerSettings({ includeInstallationCapexInSplit: true }, store), true);
  assert.deepEqual(loadPartnerSettings(store), { includeInstallationCapexInSplit: true });
  assert.equal(savePartnerSettings({}, store), true);
  assert.deepEqual(loadPartnerSettings(store), { includeInstallationCapexInSplit: false });
  const corrupt = { getItem: () => '{broken', setItem: () => {} };
  assert.deepEqual(loadPartnerSettings(corrupt), { includeInstallationCapexInSplit: false });
});

test('settlement slips record the subsidy and toggle state for audit', () => {
  const report = buildPartnerSettlementReport(pinState(), '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  const slip = createPartnerSettlement(report, { confirmedAt: '2026-10-31T00:00:00.000Z' });
  assert.equal(slip.installationSubsidy, 1800);
  assert.equal(slip.installationCapexIncluded, true);
  assert.equal(slip.perPartner[0].share, 49100);
  const cleaned = sanitizePartnerSettlements([slip]);
  assert.equal(cleaned[0].installationSubsidy, 1800);
  assert.equal(cleaned[0].installationCapexIncluded, true);
  // A pre-SISP-73 slip shape sanitizes to 0 / false, figures untouched.
  const legacy = sanitizePartnerSettlements([{
    month: '2026-09', revenue: 100, expenses: 40, profit: 60,
    perPartner: [{ partner: 'Nasir', share: 30, drawings: 0, capital: 0, netPayout: 30 }]
  }]);
  assert.equal(legacy[0].installationSubsidy, 0);
  assert.equal(legacy[0].installationCapexIncluded, false);
});

test('WhatsApp settlement text names the subsidy and distributable profit only when relevant', () => {
  const on = buildPartnerSettlementReport(pinState(), '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  const onText = generatePartnerSettlementWhatsAppText(on);
  assert.match(onText, /Installation subsidy \/ انسٹالیشن سبسڈی: Rs\. 1,800/);
  assert.match(onText, /Distributable profit \(after installation subsidy\) \/ قابلِ تقسیم منافع: Rs\. 98,200/);
  const off = buildPartnerSettlementReport(pinState(), '2026-10', [], REF);
  const offText = generatePartnerSettlementWhatsAppText(off);
  assert.match(offText, /Installation subsidy \/ انسٹالیشن سبسڈی: Rs\. 1,800/);
  assert.doesNotMatch(offText, /Distributable profit/);
  // No installations at all → no installation lines (pre-SISP-73 text).
  const plain = buildPartnerSettlementReport({ customers: [], expenses: [] }, '2026-10', [], REF, { includeInstallationCapexInSplit: true });
  assert.doesNotMatch(generatePartnerSettlementWhatsAppText(plain), /Installation/);
});

test('the toggle travels in backups and restores under the safe-merge rule', () => {
  const backup = createJsonBackup(createInitialState(), new Date(), { partnerSettings: { includeInstallationCapexInSplit: true } });
  const parsed = JSON.parse(backup);
  assert.deepEqual(parsed.settings.partnerSettings, { includeInstallationCapexInSplit: true });
  // Fresh device (nothing stored) adopts the backup's toggle.
  const adopted = previewJsonBackupMerge(createInitialState(), backup, {
    currentPartnerSettings: { includeInstallationCapexInSplit: false },
    currentPartnerSettingsStored: false
  });
  assert.deepEqual(adopted.partnerSettings, { includeInstallationCapexInSplit: true });
  assert.equal(adopted.counts.partnerSettingsRestored, 1);
  // A device that already stored a different choice keeps it + conflict.
  const conflict = previewJsonBackupMerge(createInitialState(), backup, {
    currentPartnerSettings: { includeInstallationCapexInSplit: false },
    currentPartnerSettingsStored: true
  });
  assert.equal(conflict.partnerSettings, null);
  assert.ok(conflict.conflicts.some((row) => row.field === 'Partner settings differ from this device'));
  // Identical on both sides: no restore, no conflict.
  const same = previewJsonBackupMerge(createInitialState(), backup, {
    currentPartnerSettings: { includeInstallationCapexInSplit: true },
    currentPartnerSettingsStored: true
  });
  assert.equal(same.partnerSettings, null);
  assert.equal(same.counts.partnerSettingsRestored, 0);
  assert.ok(!same.conflicts.some((row) => row.field === 'Partner settings differ from this device'));
});
