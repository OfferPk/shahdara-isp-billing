// SISP-68: Shop Cash Handover → Partner Pickup Attribution.
// Pure-function tests on synthetic data only. Spec PIN: settling
// Rs. 15,000 from Hassan Shop with Received Into "Kept by Nasir"
// reduces that shop's unsettled cash by Rs. 15,000 AND adds a
// Rs. 15,000 drawing for Nasir in the SISP-22 partner ledger, counted
// exactly once in the partner reconciliation no matter how often the
// convergent sync runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopSummaries,
  applySettlement,
  sanitizeShopSettlements,
  loadShopSettlements,
  saveShopSettlements,
  generateShopSettlementReceiptText,
  normalizeReceivedInto,
  partnerForReceivedInto,
  receivedIntoLabel
} from '../shop-settlement.js';
import {
  syncShopPickupDrawings,
  isShopPickupEntry,
  shopPickupDrawingId,
  totalsForPartner,
  buildPartnerSettlementReport,
  loadPartnerLedgerEntries,
  savePartnerLedgerEntries
} from '../partner-settlement.js';
import { collectShopHandovers, buildRoznamchaDay } from '../roznamcha.js';
import { createInitialState, createJsonBackup } from '../core.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-10', amount: 0, method: 'Cash', ...overrides });

function hassanFixture() {
  return {
    customers: [
      customer('c1', 21, 'Synthetic Customer 21', [
        bill('2026-10', [
          payment('p1', { date: '2026-10-10', amount: 15000, method: 'Cash at Hassan shop' })
        ])
      ])
    ]
  };
}

test('receivedInto helpers: drawer is the default, partners resolve by name', () => {
  assert.equal(normalizeReceivedInto(undefined), 'drawer');
  assert.equal(normalizeReceivedInto(''), 'drawer');
  assert.equal(normalizeReceivedInto('moon'), 'drawer');
  assert.equal(normalizeReceivedInto(' NASIR '), 'nasir');
  assert.equal(normalizeReceivedInto('Aqib'), 'aqib');
  assert.equal(partnerForReceivedInto('nasir'), 'Nasir');
  assert.equal(partnerForReceivedInto('aqib'), 'Aqib');
  assert.equal(partnerForReceivedInto('drawer'), null);
  assert.equal(partnerForReceivedInto(undefined), null);
  assert.equal(receivedIntoLabel('nasir'), 'Kept by Nasir (Partner Drawing)');
  assert.equal(receivedIntoLabel('drawer'), 'ISP Roznamcha Drawer');
});

test('PIN: Rs. 15,000 Hassan handover kept by Nasir settles the shop and records one Nasir drawing', () => {
  const state = hassanFixture();
  const before = buildShopSummaries(state, [], new Date(Date.UTC(2026, 9, 27, 7)));
  // OWNER-CASH-SHOP: the Hassan-method receipts sit under the ONE
  // canonical collector "Hassan Balla Shop"; the legacy call below keeps
  // working because applySettlement canonicalizes its shop argument.
  assert.equal(before.find((s) => s.shop === 'Hassan Balla Shop').unsettled, 15000);

  const { state: next, settlement, leftover } = applySettlement(
    state, 'Hassan Shop', 15000, '2026-10-27', '', { receivedInto: 'nasir' }
  );
  assert.equal(leftover, 0);
  assert.equal(settlement.amount, 15000);
  assert.equal(settlement.shop, 'Hassan Balla Shop', 'new handovers record the canonical shop name');
  assert.equal(settlement.receivedInto, 'nasir');

  const after = buildShopSummaries(next, [settlement], new Date(Date.UTC(2026, 9, 27, 7)));
  assert.equal(after.find((s) => s.shop === 'Hassan Balla Shop').unsettled, 0, 'shop unsettled drops by the full Rs. 15,000');

  const mirror = syncShopPickupDrawings([], [settlement]);
  assert.equal(mirror.changed, true);
  assert.equal(mirror.added, 1);
  assert.equal(mirror.entries.length, 1);
  const entry = mirror.entries[0];
  assert.equal(entry.partner, 'Nasir');
  assert.equal(entry.type, 'drawing');
  assert.equal(entry.amount, 15000);
  assert.equal(entry.date, '2026-10-27');
  assert.equal(entry.month, '2026-10');
  assert.equal(entry.id, shopPickupDrawingId(settlement.id));
  assert.equal(entry.settlementId, settlement.id);
  assert.equal(entry.source, 'shop-settlement');
  assert.ok(isShopPickupEntry(entry));

  // Partner reconciliation reflects the drawing exactly once: the
  // month's only revenue is the Rs. 15,000 receipt itself, so profit is
  // 15,000, each share is 7,500, and Nasir's 15,000 drawing turns his
  // net payout into a 7,500 receivable.
  const report = buildPartnerSettlementReport(next, '2026-10', mirror.entries, new Date(Date.UTC(2026, 9, 27, 7)));
  const nasir = report.perPartner.find((row) => row.partner === 'Nasir');
  const aqib = report.perPartner.find((row) => row.partner === 'Aqib');
  assert.equal(nasir.drawings, 15000);
  assert.equal(nasir.drawingCount, 1);
  assert.equal(nasir.share, 7500);
  assert.equal(nasir.netPayout, -7500);
  assert.equal(nasir.isReceivable, true);
  assert.equal(nasir.receivableAmount, 7500);
  assert.equal(aqib.drawings, 0);
  assert.equal(aqib.netPayout, 7500);
  assert.equal(report.totalDrawings, 15000);
});

test('idempotency: re-running the sync never double-records, even after a storage round-trip', () => {
  const { settlement } = applySettlement(hassanFixture(), 'Hassan Shop', 15000, '2026-10-27', '', { receivedInto: 'nasir' });
  const first = syncShopPickupDrawings([], [settlement]);
  const second = syncShopPickupDrawings(first.entries, [settlement]);
  assert.equal(second.changed, false);
  assert.deepEqual(second.entries, first.entries);

  const storage = memoryStorage();
  assert.ok(savePartnerLedgerEntries(first.entries, storage));
  const reloaded = loadPartnerLedgerEntries(storage);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].source, 'shop-settlement', 'link fields survive the ledger sanitizer');
  assert.equal(reloaded[0].settlementId, settlement.id);
  const third = syncShopPickupDrawings(reloaded, [settlement]);
  assert.equal(third.changed, false);
  assert.equal(third.entries.length, 1);
});

test('Aqib pickup mirrors as an Aqib drawing; partial pickups mirror the covered amount only', () => {
  const state = {
    customers: [
      customer('c1', 21, 'Synthetic Customer 21', [
        bill('2026-10', [
          payment('p1', { date: '2026-10-10', amount: 15000, method: 'Cash at Hassan shop' }),
          payment('p2', { date: '2026-10-11', amount: 4000, method: 'Cash at Hassan shop' })
        ])
      ])
    ]
  };
  const { settlement } = applySettlement(state, 'Hassan Shop', 6000, '2026-10-27', '', { receivedInto: 'aqib' });
  assert.equal(settlement.amount, 6000, 'FIFO covers 6,000 of the pending receipts');
  const mirror = syncShopPickupDrawings([], [settlement]);
  assert.equal(mirror.entries.length, 1);
  assert.equal(mirror.entries[0].partner, 'Aqib');
  assert.equal(mirror.entries[0].amount, 6000);
  assert.equal(totalsForPartner(mirror.entries, '2026-10', 'Aqib').drawings, 6000);
  assert.equal(totalsForPartner(mirror.entries, '2026-10', 'Nasir').drawings, 0);
});

test('drawer choice behaves exactly as SISP-1: no field stamped, no drawing, drawer counts the cash', () => {
  const state = hassanFixture();
  for (const options of [undefined, {}, { receivedInto: 'drawer' }, { receivedInto: 'moon' }]) {
    const { settlement } = options === undefined
      ? applySettlement(state, 'Hassan Shop', 15000, '2026-10-27', '')
      : applySettlement(state, 'Hassan Shop', 15000, '2026-10-27', '', options);
    assert.equal('receivedInto' in settlement, false, 'drawer settlements keep the legacy record shape');
    const mirror = syncShopPickupDrawings([], [settlement]);
    assert.equal(mirror.entries.length, 0);
    assert.equal(mirror.changed, false);
    assert.deepEqual(collectShopHandovers([settlement], '2026-10-27'), [{ shop: 'Hassan Balla Shop', amount: 15000 }]);
  }
});

test('partner-kept cash never enters the Roznamcha drawer; legacy records still do', () => {
  const nasirKept = { id: 's-nasir', shop: 'Hassan Shop', amount: 15000, date: '2026-10-27', note: '', receivedInto: 'nasir', allocations: [], createdAt: '' };
  const drawer = { id: 's-drawer', shop: 'Hassan Shop', amount: 5000, date: '2026-10-27', note: '', allocations: [], createdAt: '' };
  const legacy = { id: 's-legacy', shop: 'Waseem Abbasi Shop', amount: 2000, date: '2026-10-27', note: '', allocations: [], createdAt: '' };
  const handovers = collectShopHandovers([nasirKept, drawer, legacy], '2026-10-27');
  // OWNER-CASH-SHOP: the stored records above keep their legacy
  // shop:'Hassan Shop' bytes; the Roznamcha derivation reads them under
  // the ONE canonical name.
  assert.deepEqual(handovers, [
    { shop: 'Hassan Balla Shop', amount: 5000 },
    { shop: 'Waseem Abbasi Shop', amount: 2000 }
  ]);
  const day = buildRoznamchaDay({ customers: [] }, [], '2026-10-27', [nasirKept, drawer, legacy]);
  assert.equal(day.shopIn, 7000, 'only drawer handovers reach the drawer');
  const dayOnlyPickup = buildRoznamchaDay({ customers: [] }, [], '2026-10-27', [nasirKept]);
  assert.equal(dayOnlyPickup.shopIn, 0);
  assert.deepEqual(dayOnlyPickup.handovers, []);
});

test('settlement storage round-trip keeps receivedInto for pickups and the legacy shape for drawer', () => {
  const cleaned = sanitizeShopSettlements([
    { id: 'a', shop: 'Hassan Shop', amount: 100, date: '2026-10-27', receivedInto: 'nasir' },
    { id: 'b', shop: 'Hassan Shop', amount: 100, date: '2026-10-27', receivedInto: 'aqib' },
    { id: 'c', shop: 'Hassan Shop', amount: 100, date: '2026-10-27', receivedInto: 'drawer' },
    { id: 'd', shop: 'Hassan Shop', amount: 100, date: '2026-10-27', receivedInto: 'bogus' },
    { id: 'e', shop: 'Hassan Shop', amount: 100, date: '2026-10-27' }
  ]);
  assert.equal(cleaned.find((s) => s.id === 'a').receivedInto, 'nasir');
  assert.equal(cleaned.find((s) => s.id === 'b').receivedInto, 'aqib');
  for (const id of ['c', 'd', 'e']) {
    assert.equal('receivedInto' in cleaned.find((s) => s.id === id), false, `${id} normalizes to drawer = field absent`);
  }
  const storage = memoryStorage();
  assert.ok(saveShopSettlements(cleaned, storage));
  const stored = loadShopSettlements(storage);
  assert.equal(stored.find((s) => s.id === 'a').receivedInto, 'nasir');
});

test('convergence: corrected, re-attributed or vanished settlements update or remove the mirror exactly once', () => {
  const base = { id: 'shop-settle-x', shop: 'Hassan Shop', amount: 15000, date: '2026-10-27', note: '', receivedInto: 'nasir', allocations: [], createdAt: '2026-10-27T05:00:00.000Z' };
  const first = syncShopPickupDrawings([], [base]);
  assert.equal(first.entries.length, 1);

  // Amount corrected on the settlement → drawing updated in place.
  const corrected = syncShopPickupDrawings(first.entries, [{ ...base, amount: 12000 }]);
  assert.equal(corrected.updated, 1);
  assert.equal(corrected.entries.length, 1);
  assert.equal(corrected.entries[0].amount, 12000);
  assert.equal(corrected.entries[0].id, first.entries[0].id);

  // Kept by the other partner → same single drawing, re-attributed.
  const flipped = syncShopPickupDrawings(corrected.entries, [{ ...base, amount: 12000, receivedInto: 'aqib' }]);
  assert.equal(flipped.entries.length, 1);
  assert.equal(flipped.entries[0].partner, 'Aqib');
  assert.equal(flipped.entries[0].amount, 12000);

  // Returned to the drawer → drawing removed.
  const drawerAgain = syncShopPickupDrawings(flipped.entries, [{ ...base, receivedInto: 'drawer' }]);
  assert.equal(drawerAgain.removed, 1);
  assert.equal(drawerAgain.entries.length, 0);

  // Settlement gone entirely → drawing removed.
  const vanished = syncShopPickupDrawings(first.entries, []);
  assert.equal(vanished.removed, 1);
  assert.equal(vanished.entries.length, 0);

  // Duplicate mirror rows left by an older build collapse to one.
  const duplicated = syncShopPickupDrawings([first.entries[0], { ...first.entries[0] }], [base]);
  assert.equal(duplicated.entries.length, 1);
  assert.equal(duplicated.entries[0].amount, 15000);
});

test('manual partner entries are never touched by the pickup sync', () => {
  const manual = [{
    id: 'partner-ledger-manual-1', partner: 'Nasir', type: 'drawing',
    amount: 3000, date: '2026-10-05', month: '2026-10', note: 'Personal cash taken', createdAt: ''
  }];
  const { settlement } = applySettlement(hassanFixture(), 'Hassan Shop', 15000, '2026-10-27', '', { receivedInto: 'nasir' });
  const mirror = syncShopPickupDrawings(manual, [settlement]);
  assert.equal(mirror.entries.length, 2);
  const manualAfter = mirror.entries.find((row) => row.id === 'partner-ledger-manual-1');
  assert.deepEqual(manualAfter, manual[0]);
  assert.equal(isShopPickupEntry(manualAfter), false);
  assert.equal(totalsForPartner(mirror.entries, '2026-10', 'Nasir').drawings, 18000, 'manual 3,000 + pickup 15,000, each once');
});

test('receipt text names the partner pickup and stays legacy for drawer handovers', () => {
  const pickup = { id: 'shop-settle-9', shop: 'Hassan Shop', amount: 15000, date: '2026-10-27', note: '', receivedInto: 'nasir', allocations: [] };
  const pickupText = generateShopSettlementReceiptText({ shop: 'Hassan Shop', settlement: pickup, remainingUnsettled: 0 });
  assert.match(pickupText, /Received into: Kept by Nasir \(Partner Drawing\)/);
  const drawer = { id: 'shop-settle-10', shop: 'Hassan Shop', amount: 15000, date: '2026-10-27', note: '', allocations: [] };
  const drawerText = generateShopSettlementReceiptText({ shop: 'Hassan Shop', settlement: drawer, remainingUnsettled: 0 });
  assert.doesNotMatch(drawerText, /Received into/);
});

test('JSON backup carries the receivedInto stamp on pickup settlements', () => {
  const settlements = [{ id: 's1', shop: 'Hassan Shop', amount: 15000, date: '2026-10-27', note: '', receivedInto: 'nasir', allocations: [], createdAt: '' }];
  const doc = JSON.parse(createJsonBackup(createInitialState(), new Date('2026-10-27T10:00:00+05:00'), { shopSettlements: settlements }));
  assert.equal(doc.settings.shopSettlements[0].receivedInto, 'nasir');
});
