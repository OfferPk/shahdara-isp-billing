// SISP-114: Optional Partner Profit Charity / Sadqah & Emergency
// Reserve Calculator. Pure-function tests on synthetic data only.
//
// Spec criterion (verbatim): with Rs. 100,000 net profit and
// charityReservePct 5%, Rs. 5,000 goes to reserve and Nasir and Aqib
// each receive Rs. 47,500. The reserve is a DERIVED figure (like the
// shares themselves) — no stored money record exists. At 0% / absent
// the settlement report, the Owner Khata report, the slips and the
// WhatsApp texts must stay byte-identical to the pre-SISP-114 output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARITY_RESERVE_KEY,
  sanitizeCharityReservePct,
  sanitizeCharityReserveSettings,
  loadCharityReserveSettings,
  saveCharityReserveSettings,
  computeCharityReserve
} from '../charity-reserve.js';
import {
  buildPartnerSettlementReport,
  sanitizePartnerSettlements,
  createPartnerSettlement,
  generatePartnerSettlementWhatsAppText
} from '../partner-settlement.js';
import {
  buildOwnerKhataReport,
  buildOwnerKhataPrintHtml,
  buildOwnerKhataWhatsAppText
} from '../owner-khata.js';
import { createJsonBackup, previewJsonBackupMerge, createInitialState } from '../core.js';
import { t } from '../nav-language.js';
import { readFileSync } from 'node:fs';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    _map: map
  };
}

// Revenue 150,000 (receipts by payment date) − expenses 50,000
// = Rs. 100,000 net profit (the SISP-22 fixture shape).
function profitState() {
  return {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', dueAmount: 150000, payments: [
        { id: 'p1', date: '2026-10-05', amount: 150000, method: 'Cash' }
      ] }
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 50000, category: 'Electricity' }]
  };
}

function lossState() {
  return {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', dueAmount: 5000, payments: [
        { id: 'p1', date: '2026-10-05', amount: 5000, method: 'Cash' }
      ] }
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 9000, category: 'Electricity' }]
  };
}

const REF = new Date('2026-10-27T12:00:00Z');
const ENTRIES = [
  { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' },
  { id: 'l2', partner: 'Aqib', type: 'capital', amount: 10000, date: '2026-10-12', note: 'ONU purchase' }
];

test('storage key and percentage sanitizer: clamp into [0, 100], junk -> 0', () => {
  assert.equal(CHARITY_RESERVE_KEY, 'sisp_charity_reserve_v1');
  assert.equal(sanitizeCharityReservePct(5), 5);
  assert.equal(sanitizeCharityReservePct(2.5), 2.5);
  assert.equal(sanitizeCharityReservePct('7'), 7);
  assert.equal(sanitizeCharityReservePct(-5), 0);
  assert.equal(sanitizeCharityReservePct(150), 100);
  assert.equal(sanitizeCharityReservePct(100), 100);
  assert.equal(sanitizeCharityReservePct(0), 0);
  assert.equal(sanitizeCharityReservePct('abc'), 0);
  assert.equal(sanitizeCharityReservePct(NaN), 0);
  assert.equal(sanitizeCharityReservePct(undefined), 0);
  assert.equal(sanitizeCharityReservePct(null), 0);
});

test('settings sanitizer: only the known field survives, always an object', () => {
  assert.deepEqual(sanitizeCharityReserveSettings({ charityReservePct: 5, bogus: 1 }), { charityReservePct: 5 });
  assert.deepEqual(sanitizeCharityReserveSettings({ charityReservePct: 250 }), { charityReservePct: 100 });
  assert.deepEqual(sanitizeCharityReserveSettings({}), { charityReservePct: 0 });
  assert.deepEqual(sanitizeCharityReserveSettings(null), { charityReservePct: 0 });
  assert.deepEqual(sanitizeCharityReserveSettings([]), { charityReservePct: 0 });
  assert.deepEqual(sanitizeCharityReserveSettings('x'), { charityReservePct: 0 });
  assert.deepEqual(sanitizeCharityReserveSettings(7), { charityReservePct: 7 });
});

test('load/save round-trip; corrupt storage reads as 0; save sanitizes', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadCharityReserveSettings(storage), { charityReservePct: 0 });
  assert.equal(saveCharityReserveSettings({ charityReservePct: 5 }, storage), true);
  assert.deepEqual(loadCharityReserveSettings(storage), { charityReservePct: 5 });
  assert.equal(saveCharityReserveSettings({ charityReservePct: 150 }, storage), true);
  assert.deepEqual(loadCharityReserveSettings(storage), { charityReservePct: 100 });
  storage.setItem(CHARITY_RESERVE_KEY, '{not json');
  assert.deepEqual(loadCharityReserveSettings(storage), { charityReservePct: 0 });
});

test('compute pin: 100,000 at 5% -> reserve 5,000, distributable 95,000, share 47,500 each', () => {
  const result = computeCharityReserve(100000, 5);
  assert.equal(result.charityReservePct, 5);
  assert.equal(result.charityReserve, 5000);
  assert.equal(result.distributableProfit, 95000);
  assert.equal(result.shareEach, 47500);
});

test('compute: 0% and loss months stay inert and equal the legacy share math', () => {
  const off = computeCharityReserve(100000, 0);
  assert.equal(off.charityReserve, 0);
  assert.equal(off.distributableProfit, 100000);
  assert.equal(off.shareEach, 50000); // == Math.round(100000 * 0.5), the legacy share
  const loss = computeCharityReserve(-5000, 5);
  assert.equal(loss.charityReserve, 0);
  assert.equal(loss.distributableProfit, 0);
  assert.equal(loss.shareEach, 0);
  const zero = computeCharityReserve(0, 5);
  assert.equal(zero.charityReserve, 0);
  assert.equal(zero.shareEach, 0);
  // Whole-rupee rounding follows the settlement: reserve rounds first.
  const odd = computeCharityReserve(99999, 5);
  assert.equal(odd.charityReserve, 5000);
  assert.equal(odd.distributableProfit, 94999);
  assert.equal(odd.shareEach, 47500);
});

test('SPEC PIN (settlement): 100,000 profit at 5% -> 5,000 reserve, 47,500 share each', () => {
  const report = buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF, 5);
  assert.equal(report.profit, 100000);
  assert.equal(report.charityReservePct, 5);
  assert.equal(report.charityReserve, 5000);
  assert.equal(report.distributableProfit, 95000);
  assert.equal(report.share, 47500);
  const nasir = report.perPartner.find((row) => row.partner === 'Nasir');
  const aqib = report.perPartner.find((row) => row.partner === 'Aqib');
  assert.equal(nasir.share, 47500);
  assert.equal(aqib.share, 47500);
  // Net payout still = share + capital − drawings, on the reduced share.
  assert.equal(nasir.netPayout, 47500 - 15000);
  assert.equal(aqib.netPayout, 47500 + 10000);
  assert.match(report.basis, /Charity \/ Sadqah & Emergency Reserve/);
});

test('settlement at 0% / omitted is byte-identical to the legacy report', () => {
  const legacy = buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF);
  const explicitZero = buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF, 0);
  assert.equal(JSON.stringify(explicitZero), JSON.stringify(legacy));
  assert.equal('charityReserve' in legacy, false);
  assert.equal('charityReservePct' in legacy, false);
  // Merge composition (SISP-114 reconciled onto a main where SISP-73
  // had already landed): distributableProfit is a PERMANENT SISP-73
  // report field, so the pre-merge pin "'distributableProfit' in
  // legacy === false" cannot hold on the merged tree. The intent —
  // no charity-driven change at 0% — is pinned instead by the field
  // keeping its SISP-73 value (toggle off, no recorded installs in
  // this fixture -> equal to the raw profit) and by the byte-equality
  // assertion above.
  assert.equal(legacy.distributableProfit, 100000);
  assert.doesNotMatch(legacy.basis, /Charity/);
  assert.equal(legacy.share, 50000);
});

test('settlement on a loss month: pct changes nothing, shares stay 0', () => {
  const report = buildPartnerSettlementReport(lossState(), '2026-10', [], REF, 5);
  assert.equal(report.profit, -4000);
  assert.equal(report.isLoss, true);
  assert.equal(report.share, 0);
  assert.equal('charityReserve' in report, false);
});

test('slip records the reserve for audit; legacy slips gain no new keys', () => {
  const reserveReport = buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF, 5);
  const slip = createPartnerSettlement(reserveReport, { confirmedAt: '2026-10-31T00:00:00.000Z' });
  assert.equal(slip.charityReserve, 5000);
  assert.equal(slip.charityReservePct, 5);
  const roundTripped = sanitizePartnerSettlements([slip]);
  assert.equal(roundTripped.length, 1);
  assert.equal(roundTripped[0].charityReserve, 5000);
  assert.equal(roundTripped[0].charityReservePct, 5);

  const legacySlip = createPartnerSettlement(
    buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF),
    { confirmedAt: '2026-10-31T00:00:00.000Z' }
  );
  assert.equal('charityReserve' in legacySlip, false);
  const cleanedLegacy = sanitizePartnerSettlements([legacySlip]);
  assert.equal('charityReserve' in cleanedLegacy[0], false);
  // A pct with a zero reserve amount is not a real reserve — dropped.
  const fake = sanitizePartnerSettlements([{ ...legacySlip, charityReservePct: 5, charityReserve: 0 }]);
  assert.equal('charityReserve' in fake[0], false);
});

test('settlement WhatsApp text names the reserve only when one was set aside', () => {
  const reserveReport = buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF, 5);
  const text = generatePartnerSettlementWhatsAppText(reserveReport);
  assert.match(text, /Charity \/ Sadqah & Emergency Reserve \(5%\)/);
  assert.match(text, /Rs\. 5,000/);
  const legacyText = generatePartnerSettlementWhatsAppText(
    buildPartnerSettlementReport(profitState(), '2026-10', ENTRIES, REF)
  );
  assert.doesNotMatch(legacyText, /Sadqah/);
});

test('SPEC PIN (owner khata): 100,000 profit at 5% -> shares 47,500 + reserve fields', () => {
  const report = buildOwnerKhataReport(profitState(), '2026-10', { referenceDate: REF, charityReservePct: 5 });
  assert.equal(report.profit, 100000);
  assert.equal(report.charityReserve, 5000);
  assert.equal(report.charityReservePct, 5);
  assert.equal(report.distributableProfit, 95000);
  assert.equal(report.nasirShare, 47500);
  assert.equal(report.aqibShare, 47500);
});

test('owner khata at 0% / absent is byte-identical to the legacy report', () => {
  const legacy = buildOwnerKhataReport(profitState(), '2026-10', { referenceDate: REF });
  const explicitZero = buildOwnerKhataReport(profitState(), '2026-10', { referenceDate: REF, charityReservePct: 0 });
  assert.equal(JSON.stringify(explicitZero), JSON.stringify(legacy));
  assert.equal('charityReserve' in legacy, false);
  assert.equal(legacy.nasirShare, 50000);
  assert.equal(legacy.aqibShare, 50000);
});

test('owner khata WhatsApp + print show the reserve only when set aside', () => {
  const reserveReport = buildOwnerKhataReport(profitState(), '2026-10', { referenceDate: REF, charityReservePct: 5 });
  assert.match(buildOwnerKhataWhatsAppText(reserveReport), /Charity \/ Sadqah & Emergency Reserve \(5%\)/);
  assert.match(buildOwnerKhataPrintHtml(reserveReport), /Charity \/ Sadqah &amp; Emergency Reserve/);
  const legacy = buildOwnerKhataReport(profitState(), '2026-10', { referenceDate: REF });
  assert.doesNotMatch(buildOwnerKhataWhatsAppText(legacy), /Sadqah/);
  assert.doesNotMatch(buildOwnerKhataPrintHtml(legacy), /Sadqah/);
});

test('backup carries the setting only when pct > 0', () => {
  const state = createInitialState();
  const withReserve = JSON.parse(createJsonBackup(state, new Date(), { charityReserve: { charityReservePct: 5 } }));
  assert.deepEqual(withReserve.settings.charityReserve, { charityReservePct: 5 });
  const atZero = JSON.parse(createJsonBackup(state, new Date(), { charityReserve: { charityReservePct: 0 } }));
  assert.equal(atZero.settings?.charityReserve, undefined);
  const junk = JSON.parse(createJsonBackup(state, new Date(), { charityReserve: { charityReservePct: 'x' } }));
  assert.equal(junk.settings?.charityReserve, undefined);
  const absent = JSON.parse(createJsonBackup(state, new Date(), {}));
  assert.equal(absent.settings?.charityReserve, undefined);
});

test('backup restore: strict safe-merge — adopt only when nothing stored locally', () => {
  const backup = createJsonBackup(createInitialState(), new Date(), { charityReserve: { charityReservePct: 5 } });
  // Fresh device: nothing stored -> adopted.
  const adopted = previewJsonBackupMerge(createInitialState(), backup, {
    currentCharityReserve: { charityReservePct: 0 }, currentCharityReserveStored: false
  });
  assert.deepEqual(adopted.charityReserve, { charityReservePct: 5 });
  assert.equal(adopted.counts.charityReserveRestored, 1);
  // Device already has a stored setting (even 0): kept, conflict shown.
  const kept = previewJsonBackupMerge(createInitialState(), backup, {
    currentCharityReserve: { charityReservePct: 0 }, currentCharityReserveStored: true
  });
  assert.equal(kept.charityReserve, null);
  assert.ok(kept.conflicts.some((row) => /Charity/.test(row.field)));
  // Identical on both sides: no restore, no conflict.
  const same = previewJsonBackupMerge(createInitialState(), backup, {
    currentCharityReserve: { charityReservePct: 5 }, currentCharityReserveStored: true
  });
  assert.equal(same.charityReserve, null);
  assert.equal(same.counts.charityReserveRestored, 0);
  assert.ok(!same.conflicts.some((row) => /Charity/.test(row.field)));
});

test('i18n: every charity_* key resolves in English and Urdu (no raw keys)', () => {
  const keys = [
    'charity_reserve_label', 'charity_reserve_pct_label', 'charity_reserve_hint',
    'charity_reserve_save', 'charity_reserve_saved', 'charity_reserve_metric',
    'charity_reserve_metric_sub', 'charity_reserve_share_note'
  ];
  for (const key of keys) {
    assert.notEqual(t(key, 'en'), key, `en missing ${key}`);
    assert.notEqual(t(key, 'ur'), key, `ur missing ${key}`);
  }
  assert.equal(t('charity_reserve_saved', 'en', { pct: 5 }), 'Charity / Sadqah reserve set to 5%.');
  assert.match(t('charity_reserve_metric', 'ur', { pct: 5 }), /5%/);
});

// --- Merge composition pins (SISP-114 × SISP-73), added at
// reconciliation onto the SISP-112 main: SISP-73 was not in the
// build's base, so the build applied the reserve to raw profit. The
// composed rule (per the reconciliation brief): the reserve
// percentage applies to the SISP-73 DISTRIBUTABLE profit — profit
// minus the installation subsidy when the CapEx toggle is ON — and
// at 0% the figures are exactly SISP-73's. Fixture: the SISP-73 pin
// install (fee 1,200 vs router 3,000) makes the subsidy Rs. 1,800 on
// the Rs. 100,000 profit fixture.
function subsidyState() {
  const state = profitState();
  state.customers.push({
    id: 'n1', customerNumber: 91, name: 'Synthetic Install',
    connectionDate: '2026-10-14', connectionFee: 1200, routerPrice: 3000, bills: []
  });
  return state;
}

test('COMPOSITION (settlement): toggle ON + 5% -> reserve on the 98,200 distributable, not raw profit', () => {
  const report = buildPartnerSettlementReport(subsidyState(), '2026-10', [], REF, { includeInstallationCapexInSplit: true, charityReservePct: 5 });
  assert.equal(report.profit, 100000);
  assert.equal(report.installationCapex.included, true);
  assert.equal(report.installationCapex.subsidy, 1800);
  assert.equal(report.charityReserve, 4910); // round(98,200 * 5%) — NOT 5,000
  assert.equal(report.distributableProfit, 93290);
  assert.equal(report.share, 46645);
  for (const row of report.perPartner) assert.equal(row.share, 46645);
});

test('COMPOSITION (settlement): bare-number fifth argument keeps the original SISP-114 convention', () => {
  const report = buildPartnerSettlementReport(subsidyState(), '2026-10', [], REF, 5);
  assert.equal(report.installationCapex.included, false);
  assert.equal(report.charityReserve, 5000);
  assert.equal(report.distributableProfit, 95000);
  assert.equal(report.share, 47500);
});

test('COMPOSITION (owner khata): toggle ON + 5% -> shares from the post-subsidy, post-reserve remainder', () => {
  const report = buildOwnerKhataReport(subsidyState(), '2026-10', { referenceDate: REF, charityReservePct: 5, includeInstallationCapexInSplit: true });
  assert.equal(report.profit, 100000);
  assert.equal(report.charityReserve, 4910);
  assert.equal(report.charityReservePct, 5);
  assert.equal(report.distributableProfit, 93290);
  assert.equal(report.nasirShare, 46645);
  assert.equal(report.aqibShare, 46645);
});

test('wiring: app.js passes the stored pct to settlement + owner khata; panel controls exist', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/charity-reserve\.js'/);
  // Merge composition: on the merged tree the settlement call carries
  // BOTH options in one object — SISP-73's includeInstallationCapexInSplit
  // and SISP-114's charityReservePct (the build's bare-number call was
  // superseded by the composed options object; the module still
  // accepts a bare number, pinned by the composition tests below).
  assert.match(appSource, /buildPartnerSettlementReport\(state, partnerSettlementMonth, entries, new Date\(\), \{ includeInstallationCapexInSplit: loadPartnerSettings\(\)\.includeInstallationCapexInSplit, charityReservePct: charityPct \}\)/);
  assert.match(appSource, /charityReservePct: loadCharityReserveSettings\(\)\.charityReservePct/);
  assert.match(appSource, /charityReserve: loadCharityReserveSettings\(\)/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="charityReservePctInput"/);
  assert.match(html, /id="charityReserveSaveBtn"/);
  assert.match(html, /id="charityReserveHint"/);
});
