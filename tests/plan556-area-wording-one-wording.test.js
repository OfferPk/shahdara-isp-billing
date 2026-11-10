/**
 * plan556-area-wording-one-wording.test.js — Plan 556: area wording is
 * one wording on Quick Collect and PNG.
 *
 * The problem: three Quick Collect builders fell back to 'Unassigned'
 * while polish #12 fixed the canonical fallback to 'Not recorded' on
 * the main receipt, the PNG slip value and the profile WhatsApp draft —
 * so the QC WhatsApp draft printed "📍 *Area:* Unassigned" for a
 * customer whose printed receipt said "Area: Not recorded". The PNG
 * slip added a second drift: its area sub-label was 'Area / Zone'
 * while polish #12 put "Area / علاقہ" on the HTML layouts.
 *
 * The fix, per site:
 * - Picker list (getPendingCollectionCustomers): RENDER-SIDE, not the
 *   builder. The entry's `area` is the QC-4 mohalla filter's key input
 *   (entryMohalla reads mohalla || area, so a mohalla-less entry keys
 *   as 'unassigned' and folds into the Unassigned row) and the Field
 *   Mode zone grouping's input (fieldModeZoneOf treats 'Unassigned'
 *   as empty). Changing the builder would break both, and both live
 *   outside this plan's scope — so the entry keeps 'Unassigned' and
 *   the QC card translates it at render, the polish #14 pattern
 *   (splitAreaDisplay). Pinned here: the entry keeps 'Unassigned',
 *   the card shows 'Not recorded', the filter fold and the zone
 *   grouping are unchanged.
 * - Collection defaults + saved receipt: BUILDER change to
 *   'Not recorded' — both consumers are display-only (save
 *   confirmation, sheet header, WhatsApp draft, image receipt).
 * - Success-screen area select: 'Not recorded' is treated like
 *   'unassigned' — no 'Not recorded' option is ever added, so it
 *   can never be saved back as a mohalla.
 * - PNG sub-label: 'Area / Zone' -> 'Area / علاقہ' through the
 *   existing L()/localizePngLabel path (roman keeps the bilingual
 *   pair, urdu collapses to 'علاقہ', english to 'Area'), including
 *   the draw fallback.
 *
 * Synthetic data only. No real customer names or phone numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import {
  getPendingCollectionCustomers, getCustomerPaymentDefaults, executeQuickCollection,
  renderQuickCollectCustomerListHtml, formatQuickCollectWhatsAppReceipt,
  quickCollectAreaSelectHtml,
} from '../nav-quick-collect.js';
import { buildPngReceiptModel, localizePngLabel } from '../png-receipt.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import {
  quickCollectMohallaFilterMatches, quickCollectMohallaPendingCounts,
} from '../quick-collect-mohalla-filter.js';
import { fieldModeZoneOf } from '../field-mode.js';

const OCT_29 = new Date(2026, 9, 29, 12);

/** One synthetic customer, PKR 3,000/month, October 2026 bill unpaid. */
function stateWithCustomer(name, patch = {}) {
  let state = createInitialState([name]);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000', ...patch }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}

function collectReceipt(state) {
  return executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash',
  }, OCT_29).receipt;
}

test('picker entry keeps Unassigned as its stored area (the QC-4 filter key input)', () => {
  // Plan 556, site 1 is render-side ON PURPOSE: entryMohalla reads
  // mohalla || area, so this entry must still key as 'unassigned' —
  // see the filter-fold test below. The card translates at render.
  const entries = getPendingCollectionCustomers(stateWithCustomer('No Area Tester'));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].mohalla, '');
  assert.equal(entries[0].area, 'Unassigned');
  const withMohalla = getPendingCollectionCustomers(stateWithCustomer('Bani Tester', { mohalla: 'Bani' }));
  assert.equal(withMohalla[0].area, 'BANII'); // canonicalMohalla: 'Bani' -> 'BANII'
});

test('QC card shows Not recorded for a mohalla-less customer, never Unassigned', () => {
  const entries = getPendingCollectionCustomers(stateWithCustomer('No Area Tester'));
  const html = renderQuickCollectCustomerListHtml(entries);
  assert.ok(html.includes('Not recorded'), 'card shows the receipt convention');
  assert.ok(!html.includes('Unassigned'), 'no Unassigned as an area value on the card');
  const baniHtml = renderQuickCollectCustomerListHtml(
    getPendingCollectionCustomers(stateWithCustomer('Bani Tester', { mohalla: 'Bani' })),
  );
  assert.ok(baniHtml.includes('BANII'), 'a real mohalla still shows as itself');
  assert.ok(!baniHtml.includes('Not recorded'), 'a recorded mohalla is not replaced');
});

test('collection defaults carry Not recorded for a mohalla-less customer', () => {
  const defaults = getCustomerPaymentDefaults(stateWithCustomer('No Area Tester'), 'seed-001', OCT_29);
  assert.equal(defaults.area, 'Not recorded');
  const bani = getCustomerPaymentDefaults(stateWithCustomer('Bani Tester', { mohalla: 'Bani' }), 'seed-001', OCT_29);
  assert.equal(bani.area, 'BANII');
});

test('saved receipt carries Not recorded for a mohalla-less customer', () => {
  assert.equal(collectReceipt(stateWithCustomer('No Area Tester')).area, 'Not recorded');
  assert.equal(collectReceipt(stateWithCustomer('Bani Tester', { mohalla: 'Bani' })).area, 'BANII');
});

test('QC WhatsApp draft prints Area: Not recorded, never Unassigned', () => {
  const draft = formatQuickCollectWhatsAppReceipt(collectReceipt(stateWithCustomer('No Area Tester'))).text;
  const areaLine = draft.split('\n').find((line) => line.startsWith('📍'));
  assert.equal(areaLine, '📍 *Area:* Not recorded');
  assert.ok(!draft.includes('Unassigned'), 'no Unassigned anywhere in the draft');
  const baniDraft = formatQuickCollectWhatsAppReceipt(collectReceipt(stateWithCustomer('Bani Tester', { mohalla: 'Bani' }))).text;
  assert.ok(baniDraft.includes('📍 *Area:* BANII'));
});

test('area select treats Not recorded like Unassigned (placeholder, never an option)', () => {
  // Without this guard the select would offer 'Not recorded' as a
  // saveable area (canonicalMohalla keeps unknown names as-is), and
  // picking it would store mohalla 'Not recorded' on the profile.
  const html = quickCollectAreaSelectHtml('Not recorded');
  assert.ok(!html.includes('value="Not recorded"'), 'no Not recorded option is added');
  assert.ok(html.includes('<option value="" selected>Unassigned</option>'), 'placeholder stays selected');
  const unassignedHtml = quickCollectAreaSelectHtml('Unassigned');
  assert.ok(unassignedHtml.includes('<option value="" selected>Unassigned</option>'), 'Unassigned behaves as before');
  const baniHtml = quickCollectAreaSelectHtml('Bani');
  assert.ok(baniHtml.includes('value="Bani" selected') || baniHtml.includes('value="BANII" selected'), 'a real mohalla is offered and selected');
});

test('PNG slip labels the area Area / علاقہ in every language', () => {
  const state = stateWithCustomer('No Area Tester');
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === '2026-10');
  const receipt = buildPaymentReceipt(customer, bill, { id: 'pay-1', amount: 3000, date: '2026-10-29', method: 'Cash' });
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.subLabels.area, 'Area / علاقہ');
  assert.equal(model.areaZone, 'Not recorded');
  assert.equal(buildPngReceiptModel(receipt, customer, { lang: 'urdu' }).subLabels.area, 'علاقہ');
  assert.equal(buildPngReceiptModel(receipt, customer, { lang: 'english' }).subLabels.area, 'Area');
  // The localiser itself collapses the new bilingual label the same way.
  assert.equal(localizePngLabel('Area / علاقہ', 'urdu'), 'علاقہ');
  assert.equal(localizePngLabel('Area / علاقہ', 'english'), 'Area');
  assert.equal(localizePngLabel('Area / علاقہ', 'roman'), 'Area / علاقہ');
});

test('PNG slip has no Area / Zone label left, including the draw fallback', () => {
  const source = readFileSync(new URL('../png-receipt.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('Area / Zone'), 'the old label is gone everywhere');
  assert.ok(source.includes("?? 'Area / علاقہ'"), 'the draw fallback uses the polish #12 label');
});

test('QC-4 Unassigned fold still works for a mohalla-less picker entry', () => {
  const entries = getPendingCollectionCustomers(stateWithCustomer('No Area Tester'));
  assert.equal(quickCollectMohallaFilterMatches(entries[0], 'Unassigned'), true);
  assert.equal(quickCollectMohallaFilterMatches(entries[0], 'Bani'), false);
  const counts = quickCollectMohallaPendingCounts(entries, ['Bani']);
  const unassigned = counts.rows.find((row) => row.key === 'unassigned');
  assert.equal(unassigned.count, 1);
  assert.equal(unassigned.mohalla, 'Unassigned');
});

test('Field Mode zone grouping still calls a mohalla-less entry Unassigned', () => {
  const entries = getPendingCollectionCustomers(stateWithCustomer('No Area Tester'));
  assert.deepEqual(fieldModeZoneOf(entries[0]), { key: '__unassigned__', label: 'Unassigned' });
});

test('HTML receipt labels the area Area / علاقہ and shows Not recorded', () => {
  const state = stateWithCustomer('No Area Tester');
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === '2026-10');
  const receipt = buildPaymentReceipt(customer, bill, { id: 'pay-1', amount: 3000, date: '2026-10-29', method: 'Cash' });
  const html = generatePaymentReceiptHtml(receipt);
  assert.ok(html.includes('Area / علاقہ'), 'HTML receipt and PNG slip share the label');
  assert.ok(html.includes('Not recorded'), 'HTML receipt and QC draft share the fallback');
});
