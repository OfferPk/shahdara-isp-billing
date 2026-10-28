// SISP-22: Nasir & Aqib 50/50 Partner Drawings, Capital Outlay & Monthly
// Settlement Ledger. Pure-function tests on synthetic data only.
// Spec criterion (verbatim): Rs. 100,000 net profit (50,000 each);
// Nasir took 15,000 drawing → Nasir net payout 35,000; Aqib paid 10,000
// out-of-pocket → Aqib net payout 60,000. Profit, revenue and expenses
// are reused from buildPartnerShareReport (PR #395) — never recomputed
// here in parallel. A negative net payout is a Receivable, never hidden
// or silently clamped to zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTNER_LEDGER_KEY,
  PARTNER_SETTLEMENTS_KEY,
  PARTNERS,
  sanitizePartnerLedgerEntries,
  loadPartnerLedgerEntries,
  savePartnerLedgerEntries,
  cleanPartnerLedgerEntry,
  upsertPartnerLedgerEntry,
  deletePartnerLedgerEntry,
  entriesForMonth,
  totalsForPartner,
  buildPartnerSettlementReport,
  sanitizePartnerSettlements,
  loadPartnerSettlements,
  savePartnerSettlements,
  settlementForMonth,
  createPartnerSettlement,
  upsertPartnerSettlement,
  reopenPartnerSettlement,
  generatePartnerSettlementWhatsAppText,
  partnerSettlementWhatsAppUrl
} from '../partner-settlement.js';
import { createJsonBackup, previewJsonBackupMerge, createInitialState } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

// Revenue 150,000 (receipts by payment date) − expenses 50,000
// = Rs. 100,000 net profit, so 50,000 share each.
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

const REF = new Date('2026-10-27T12:00:00Z');

test('partner names and storage keys are the spec-given ones', () => {
  assert.deepEqual([...PARTNERS], ['Nasir', 'Aqib']);
  assert.equal(PARTNER_LEDGER_KEY, 'sisp_partner_ledger_v1');
  assert.equal(PARTNER_SETTLEMENTS_KEY, 'sisp_partner_settlements_v1');
});

test('spec criterion verbatim: 100,000 profit, Nasir 35,000, Aqib 60,000', () => {
  const entries = [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' },
    { id: 'l2', partner: 'Aqib', type: 'capital', amount: 10000, date: '2026-10-12', note: 'ONU purchase' }
  ];
  const report = buildPartnerSettlementReport(profitState(), '2026-10', entries, REF);
  assert.equal(report.month, '2026-10');
  assert.equal(report.revenue, 150000);
  assert.equal(report.expenses, 50000);
  assert.equal(report.profit, 100000);
  assert.equal(report.share, 50000);
  const nasir = report.perPartner.find((row) => row.partner === 'Nasir');
  const aqib = report.perPartner.find((row) => row.partner === 'Aqib');
  assert.equal(nasir.share, 50000);
  assert.equal(nasir.drawings, 15000);
  assert.equal(nasir.capital, 0);
  assert.equal(nasir.netPayout, 35000);
  assert.equal(nasir.isReceivable, false);
  assert.equal(aqib.share, 50000);
  assert.equal(aqib.drawings, 0);
  assert.equal(aqib.capital, 10000);
  assert.equal(aqib.netPayout, 60000);
  assert.equal(aqib.isReceivable, false);
});

test('reconciliation reuses the partner-share report: loss month share is 0', () => {
  const state = {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 5000, method: 'Cash' }] }
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 20000, category: 'Electricity' }]
  };
  const report = buildPartnerSettlementReport(state, '2026-10', [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-10', note: '' }
  ], REF);
  assert.equal(report.profit, -15000);
  assert.equal(report.isLoss, true);
  assert.equal(report.share, 0);
  const nasir = report.perPartner.find((row) => row.partner === 'Nasir');
  assert.equal(nasir.netPayout, -3000);
  assert.equal(nasir.isReceivable, true);
  assert.equal(nasir.receivableAmount, 3000);
  assert.equal(nasir.payableAmount, 0);
});

test('negative net payout is a receivable, never silently clamped to zero', () => {
  const entries = [
    { id: 'l1', partner: 'Aqib', type: 'drawing', amount: 60000, date: '2026-10-10', note: '' }
  ];
  const report = buildPartnerSettlementReport(profitState(), '2026-10', entries, REF);
  const aqib = report.perPartner.find((row) => row.partner === 'Aqib');
  assert.equal(aqib.netPayout, -10000);
  assert.equal(aqib.isReceivable, true);
  assert.equal(aqib.receivableAmount, 10000);
  const text = generatePartnerSettlementWhatsAppText(report);
  assert.match(text, /Receivable/);
  assert.match(text, /10,000/);
});

test('entries are filtered by month; other months never leak in', () => {
  const entries = [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' },
    { id: 'l2', partner: 'Nasir', type: 'drawing', amount: 9000, date: '2026-09-10', note: '' }
  ];
  assert.deepEqual(entriesForMonth(entries, '2026-10').map((row) => row.id), ['l1']);
  assert.equal(totalsForPartner(entries, '2026-10', 'Nasir').drawings, 15000);
  assert.equal(totalsForPartner(entries, '2026-09', 'Nasir').drawings, 9000);
});

test('sanitize drops malformed entries and keeps only known fields', () => {
  const cleaned = sanitizePartnerLedgerEntries([
    { id: 'ok', partner: 'nasir', type: 'DRAWING', amount: 5000, date: '2026-10-10', note: 'x', junk: 1 },
    { partner: 'Someone', type: 'drawing', amount: 5000, date: '2026-10-10' },
    { partner: 'Nasir', type: 'gift', amount: 5000, date: '2026-10-10' },
    { partner: 'Nasir', type: 'drawing', amount: 0, date: '2026-10-10' },
    { partner: 'Nasir', type: 'drawing', amount: 5000, date: '2026-13-10' },
    null,
    'nope'
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].partner, 'Nasir');
  assert.equal(cleaned[0].type, 'drawing');
  assert.equal(cleaned[0].month, '2026-10');
  assert.equal(cleaned[0].junk, undefined);
});

test('clean validates partner, type, amount and date', () => {
  assert.throws(() => cleanPartnerLedgerEntry({ partner: 'X', type: 'drawing', amount: 100, date: '2026-10-10' }), /partner/);
  assert.throws(() => cleanPartnerLedgerEntry({ partner: 'Nasir', type: 'gift', amount: 100, date: '2026-10-10' }), /type/);
  assert.throws(() => cleanPartnerLedgerEntry({ partner: 'Nasir', type: 'drawing', amount: 0, date: '2026-10-10' }), /amount/);
  assert.throws(() => cleanPartnerLedgerEntry({ partner: 'Nasir', type: 'drawing', amount: 100, date: 'bogus' }), /date/);
  const entry = cleanPartnerLedgerEntry({ partner: 'aqib', type: 'capital', amount: 1000.6, date: '2026-10-10', note: '  ONU  ' });
  assert.equal(entry.partner, 'Aqib');
  assert.equal(entry.amount, 1001);
  assert.equal(entry.note, 'ONU');
});

test('upsert replaces an edit, delete removes only that entry, input not mutated', () => {
  const entries = [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 5000, date: '2026-10-10', note: '' },
    { id: 'l2', partner: 'Aqib', type: 'capital', amount: 2000, date: '2026-10-11', note: '' }
  ];
  const before = JSON.stringify(entries);
  const edited = upsertPartnerLedgerEntry(entries, { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 7000, date: '2026-10-10', note: '' });
  assert.equal(edited.find((row) => row.id === 'l1').amount, 7000);
  assert.equal(edited.length, 2);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(deletePartnerLedgerEntry(edited, 'l1').map((row) => row.id), ['l2']);
});

test('load/save round-trip through memory storage; corrupt storage reads as []', () => {
  const store = memoryStorage();
  assert.deepEqual(loadPartnerLedgerEntries(store), []);
  const entries = [{ id: 'l1', partner: 'Nasir', type: 'capital', amount: 3000, date: '2026-10-10', note: '' }];
  assert.equal(savePartnerLedgerEntries(entries, store), true);
  assert.deepEqual(loadPartnerLedgerEntries(store), [{ ...entries[0], month: '2026-10', createdAt: '' }]);
  store.setItem(PARTNER_LEDGER_KEY, 'not json{');
  assert.deepEqual(loadPartnerLedgerEntries(store), []);
});

test('settlement slip: create, upsert replaces only its month, reopen keeps figures', () => {
  const report = buildPartnerSettlementReport(profitState(), '2026-10', [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' },
    { id: 'l2', partner: 'Aqib', type: 'capital', amount: 10000, date: '2026-10-12', note: '' }
  ], REF);
  const slip = createPartnerSettlement(report, { note: 'October settled' });
  assert.equal(slip.month, '2026-10');
  assert.equal(slip.status, 'confirmed');
  assert.equal(slip.perPartner.find((row) => row.partner === 'Nasir').netPayout, 35000);
  assert.equal(slip.perPartner.find((row) => row.partner === 'Aqib').netPayout, 60000);
  const store = memoryStorage();
  savePartnerSettlements(upsertPartnerSettlement(loadPartnerSettlements(store), slip), store);
  assert.equal(settlementForMonth(loadPartnerSettlements(store), '2026-10').status, 'confirmed');
  const reopened = reopenPartnerSettlement(loadPartnerSettlements(store), '2026-10');
  assert.equal(settlementForMonth(reopened, '2026-10').status, 'reopened');
  assert.equal(settlementForMonth(reopened, '2026-10').perPartner[0].netPayout, 35000);
  assert.throws(() => reopenPartnerSettlement([], '2026-09'), /No saved settlement/);
  assert.throws(() => createPartnerSettlement({ month: 'bogus' }), /valid month/);
});

test('settlement slip never alters bills, receipts or expenses', () => {
  const state = profitState();
  const before = JSON.stringify(state);
  const report = buildPartnerSettlementReport(state, '2026-10', [], REF);
  createPartnerSettlement(report);
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(report.entries), '[]');
});

test('WhatsApp text is Urdu + Roman-English with both partners and the figures', () => {
  const report = buildPartnerSettlementReport(profitState(), '2026-10', [
    { id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' },
    { id: 'l2', partner: 'Aqib', type: 'capital', amount: 10000, date: '2026-10-12', note: '' }
  ], REF);
  const text = generatePartnerSettlementWhatsAppText(report, createPartnerSettlement(report));
  assert.match(text, /Nasir/);
  assert.match(text, /Aqib/);
  assert.match(text, /35,000/);
  assert.match(text, /60,000/);
  assert.match(text, /پارٹنر/);
  assert.match(text, /2026-10/);
  const url = partnerSettlementWhatsAppUrl(text);
  assert.ok(url.startsWith('https://wa.me/?text='));
  assert.ok(url.includes(encodeURIComponent('35,000').replace(/%2C/g, '%2C')) || url.includes('35'));
});

test('empty month: zeros, no crash, both partners listed', () => {
  const report = buildPartnerSettlementReport(profitState(), '2026-08', [], REF);
  assert.equal(report.month, '2026-08');
  assert.equal(report.revenue, 0);
  assert.equal(report.profit, 0);
  assert.equal(report.share, 0);
  assert.equal(report.perPartner.length, 2);
  assert.ok(report.perPartner.every((row) => row.netPayout === 0 && row.isReceivable === false));
});

test('ledger and slips ride in the JSON backup and restore under the safe-merge rule', () => {
  const state = createInitialState();
  const entries = [{ id: 'l1', partner: 'Nasir', type: 'drawing', amount: 15000, date: '2026-10-10', note: '' }];
  const slip = createPartnerSettlement(
    buildPartnerSettlementReport(profitState(), '2026-10', entries, REF)
  );
  const backup = createJsonBackup(state, new Date(), { partnerLedger: entries, partnerSettlements: [slip] });
  const parsed = JSON.parse(backup);
  assert.equal(parsed.settings.partnerLedger[0].partner, 'Nasir');
  assert.equal(parsed.settings.partnerSettlements[0].month, '2026-10');
  // Adopted when this device has nothing stored yet.
  const preview = previewJsonBackupMerge(createInitialState(), backup, {
    currentPartnerLedger: [], currentPartnerLedgerStored: false,
    currentPartnerSettlements: [], currentPartnerSettlementsStored: false
  });
  assert.equal(preview.partnerLedger[0].partner, 'Nasir');
  assert.equal(preview.partnerSettlements[0].month, '2026-10');
  assert.equal(preview.counts.partnerLedgerRestored, 1);
  assert.equal(preview.counts.partnerSettlementsRestored, 1);
  // Differing records on both sides: existing kept, conflict reported.
  const conflict = previewJsonBackupMerge(createInitialState(), backup, {
    currentPartnerLedger: [{ id: 'other', partner: 'Aqib', type: 'capital', amount: 999, date: '2026-10-05', note: '' }],
    currentPartnerLedgerStored: true,
    currentPartnerSettlements: [], currentPartnerSettlementsStored: false
  });
  assert.equal(conflict.partnerLedger, null);
  assert.ok(conflict.conflicts.some((c) => /Partner ledger/.test(c.field)));
});
