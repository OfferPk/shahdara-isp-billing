// SISP-86: "Cash at Balla Shop" (PR #452) Full Parity — originally Balla
// Shop as a first-class shop collector alongside Waseem Abbasi Shop and
// Hassan Shop across Shop Settlement (SISP-1), Field Mode (SISP-5),
// printed QR Khata Cards (SISP-14) and Owner Khata (SISP-20/51), with
// the handover settling cleanly into Roznamcha (SISP-11).
//
// OWNER-CASH-SHOP (2026-10-31) SUPERSEDES the split: the owner clarified
// the person is Hassan and his famous shop is "Balla" — ONE shop,
// written "Hassan Balla Shop". The parity intent is unchanged (every
// surface derives the SAME shop list from the one source; no card before
// the first payment; a Balla-method payment settles cleanly through
// roznamcha and owner-khata) — only the canonical name unified. Legacy
// method strings stay on stored payments byte-identically.
// Pure-function tests on synthetic data only. Spec pin: recording
// Rs. 2,500 via "Cash at Balla shop" increments the unified shop's
// unsettled cash in shop-settlement and settles cleanly into roznamcha
// and owner-khata totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PAYMENT_METHODS } from '../core.js';
import {
  resolveShopCollector,
  buildShopSummaries,
  applySettlement
} from '../shop-settlement.js';
import { fieldModeShopMethods } from '../field-mode.js';
import { KHATA_PAYMENT_SHOPS, buildKhataCardModel, buildKhataCardPrintHtml } from '../qr-card.js';
import { buildRoznamchaDay } from '../roznamcha.js';
import { buildOwnerKhataReport } from '../owner-khata.js';

const here = dirname(fileURLToPath(import.meta.url));
const REF = new Date(Date.UTC(2026, 9, 27, 7)); // 2026-10-27 PKT-ish

const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments) => ({ month, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });

/** The one canonical shop list: PAYMENT_METHODS through the settlement
 *  module's own resolver, in PAYMENT_METHODS order, deduped. */
function canonicalShops() {
  return [...new Set(PAYMENT_METHODS.map((m) => resolveShopCollector(m)).filter(Boolean))];
}

test('parity: every surface derives the SAME shop list from the one source', () => {
  const canonical = canonicalShops();
  assert.deepEqual(canonical, ['Waseem Abbasi Shop', 'Hassan Balla Shop']);
  // (c) QR Khata card shop list is the canonical list — derived, not a
  // second hardcoded copy that can drift from the settlement module.
  assert.deepEqual([...KHATA_PAYMENT_SHOPS], canonical);
  // (b) Field Mode quick shop buttons resolve to the same collectors in
  // the same order — one button for the unified shop, recording its
  // canonical method.
  assert.deepEqual(fieldModeShopMethods().map((s) => resolveShopCollector(s.method)), canonical);
  assert.ok(fieldModeShopMethods().some((s) => s.method === 'Cash at Hassan Balla shop'));
});

test('parity: printed QR Khata card shows Waseem · Hassan Balla Shop', () => {
  const model = buildKhataCardModel({ id: 'c1', customerNumber: 1, name: 'Test Customer 01' });
  assert.deepEqual(model.shops, ['Waseem Abbasi Shop', 'Hassan Balla Shop']);
  const html = buildKhataCardPrintHtml(model, null);
  assert.ok(html.includes('Pay at: Waseem Abbasi Shop · Hassan Balla Shop'));
});

test('PR #452 rule: no unified-shop settlement card before its first shop payment', () => {
  const withoutBalla = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop' })])
    ])],
    expenses: []
  };
  const before = buildShopSummaries(withoutBalla, [], REF);
  assert.deepEqual(before.map((s) => s.shop), ['Waseem Abbasi Shop']);

  const withBalla = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [
        payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop' }),
        payment('p2', { amount: 2500, method: 'Cash at Balla shop' })
      ])
    ])],
    expenses: []
  };
  const after = buildShopSummaries(withBalla, [], REF);
  assert.equal(after.find((s) => s.shop === 'Hassan Balla Shop')?.unsettled, 2500);
});

test('SPEC PIN: Rs. 2,500 Balla payment -> unsettled -> roznamcha -> owner khata', () => {
  const state = {
    customers: [customer('c1', 11, 'Test Customer 11', [
      bill('2026-10', [payment('p1', { date: '2026-10-06', amount: 2500, method: 'Cash at Balla shop' })])
    ])],
    expenses: []
  };
  // (a) Shop Settlement: unsettled cash at the unified shop rises by Rs. 2,500.
  const summaries = buildShopSummaries(state, [], REF);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].shop, 'Hassan Balla Shop');
  assert.equal(summaries[0].unsettled, 2500);

  // Handover of the full Rs. 2,500 on 2026-10-07 (called with the legacy
  // shop name, as an older screen would — it records canonically).
  const { state: settledState, settlement, leftover } = applySettlement(state, 'Balla Shop', 2500, '2026-10-07');
  assert.equal(leftover, 0);
  assert.equal(settlement.shop, 'Hassan Balla Shop');
  assert.equal(settlement.amount, 2500);
  assert.equal(buildShopSummaries(settledState, [settlement], REF)[0].unsettled, 0);

  // Roznamcha: the handover enters the drawer as shop cash-in on its date;
  // the shop-method bill payment itself is NOT direct drawer cash.
  const day = buildRoznamchaDay(settledState, [], '2026-10-07', [settlement]);
  assert.equal(day.shopIn, 2500);
  assert.deepEqual(day.handovers, [{ shop: 'Hassan Balla Shop', amount: 2500 }]);
  const payDay = buildRoznamchaDay(settledState, [], '2026-10-06', [settlement]);
  assert.equal(payDay.shopIn, 0);
  assert.equal(payDay.cashIn, 0);

  // (d) Owner Khata: unified-shop collected channel + settled-by-shop totals.
  const report = buildOwnerKhataReport(settledState, '2026-10', { settlements: [settlement], referenceDate: REF });
  assert.deepEqual(
    report.collectionChannels.find((row) => row.channel === 'Hassan Balla Shop'),
    { channel: 'Hassan Balla Shop', kind: 'shop', amount: 2500, count: 1 }
  );
  assert.equal(report.shopSettled, 2500);
  assert.equal(report.shopSettledCount, 1);
  assert.deepEqual(report.shopSettledByShop, [{ shop: 'Hassan Balla Shop', amount: 2500, count: 1 }]);
});

test('parity: kist down-payment method select offers Balla alongside the other shops', () => {
  const appSource = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const kistSelect = appSource.match(/profileKistDownPaymentMethod[\s\S]{0,400}/)?.[0] || '';
  assert.ok(kistSelect.includes("'Cash at Waseem Abbasi shop'"));
  assert.ok(kistSelect.includes("'Cash at Hassan shop'"));
  assert.ok(kistSelect.includes("'Cash at Balla shop'"));
  // OWNER-CASH-SHOP: the unified shop's own method is offered too.
  assert.ok(kistSelect.includes("'Cash at Hassan Balla shop'"));
});
