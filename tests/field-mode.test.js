// SISP-5: 1-Thumb Mobile "Field Collection Mode". Pure-function tests on
// synthetic data only. Spec test criteria (verbatim):
//   - Field mode renders with ZERO horizontal scroll at 360px viewport width
//     (asserted structurally here via the single-column, border-box CSS rules
//     and in full by tests/e2e/field-mode.spec.mjs at a real 360px viewport).
//   - A search-to-receipt workflow completes in 2 taps: tap 1 selects a
//     customer card, tap 2 hits Cash Full and the receipt card (with the WA
//     Receipt link) appears. The tap-2 half is asserted here at the seam
//     (one collect call -> receipt + WhatsApp draft); the full 2-tap flow is
//     asserted by tests/e2e/field-mode.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { calculatePaymentAllocations } from '../core.js';
import { resolveShopCollector } from '../shop-settlement.js';
import {
  FIELD_MODE_ALL_ZONES,
  isFieldModeHash,
  fieldModeZoneOf,
  groupFieldModeZones,
  fieldModeZoneSummary,
  fieldModeShopMethods,
  fieldModeFullPaymentArgs,
  collectFieldModePayment,
  applyFieldModeWaadaChip,
  clearFieldModeWaada
} from '../field-mode.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Fixed "today": 2026-10-28 PKT. Bills are priced for 2026-09 / 2026-10,
// so the earliest unpaid month (and current month) logic stays stable.
const REF_DATE = new Date('2026-10-28T05:00:00.000Z');

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], ...overrides
});
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, bills: [], ...overrides
});

function stateWith(customers) {
  return { customers };
}

function pendingFor(state) {
  return getPendingCollectionCustomers(state, '', 'all-dues', REF_DATE);
}

test('SISP-5 zones: grouping derives from customer area/mohalla, never a hardcoded list', () => {
  const state = stateWith([
    customer('c1', 11, 'FIELD ALI', {
      mohalla: 'Barrian', zone: 'Barrian', phone: '+923001234567',
      bills: [bill('2026-09'), bill('2026-10')]
    }),
    customer('c2', 12, 'FIELD BILAL', {
      mohalla: 'Shahdara Town', bills: [bill('2026-10')]
    }),
    // Same area, different casing/spacing: canonicalizes into Barrian.
    customer('c3', 13, 'FIELD DINA', {
      mohalla: ' barrian ', bills: [bill('2026-10', { dueAmount: 2000 })]
    }),
    // No area/mohalla at all: Unassigned fallback.
    customer('c4', 14, 'FIELD CARL', { bills: [bill('2026-10', { dueAmount: 1500 })] }),
    // Settled customer: excluded from the pending list entirely.
    customer('c5', 15, 'FIELD SETTLED', {
      mohalla: 'Barrian',
      bills: [bill('2026-10', {
        payments: [{ id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' }]
      })]
    })
  ]);
  const pending = pendingFor(state);
  assert.equal(pending.length, 4);
  assert.equal(pending.find(e => e.id === 'c5'), undefined);

  const groups = groupFieldModeZones(state, pending);
  assert.equal(groups.length, 3);
  // Biggest remaining target first.
  assert.equal(groups[0].label, 'Barrian');
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].totalDues, 8000);
  assert.equal(groups[1].label, 'Shahdara Town');
  assert.equal(groups[1].totalDues, 3000);
  assert.equal(groups[2].label, 'Unassigned');
  assert.equal(groups[2].totalDues, 1500);

  // Explicit area wins over mohalla (Area Analytics rule).
  assert.equal(fieldModeZoneOf({ area: 'Palaliya', mohalla: 'Barrian' }).label, 'Palaliya');
  assert.equal(fieldModeZoneOf({ mohalla: 'Chandall' }).label, 'Chandall');
  assert.equal(fieldModeZoneOf({}).label, 'Unassigned');
});

test('SISP-5 zone target: live remaining-cash summary for the selected zone', () => {
  const state = stateWith([
    customer('c1', 11, 'FIELD ALI', {
      mohalla: 'Barrian', bills: [bill('2026-09'), bill('2026-10')]
    }),
    customer('c2', 12, 'FIELD BILAL', {
      mohalla: 'Barrian', bills: [bill('2026-10', { dueAmount: 2000 })]
    })
  ]);
  const groups = groupFieldModeZones(state, pendingFor(state));
  assert.equal(groups.length, 1);
  const summary = fieldModeZoneSummary(groups[0].entries);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalDues, 8000);
  assert.equal(fieldModeZoneSummary([]).count, 0);
  assert.equal(fieldModeZoneSummary([]).totalDues, 0);
});

test('SISP-5 shop methods: derived from PAYMENT_METHODS, Waseem + Hassan present', () => {
  const shops = fieldModeShopMethods();
  const methods = shops.map(s => s.method);
  assert.ok(methods.includes('Cash at Waseem Abbasi shop'));
  // OWNER-CASH-SHOP: ONE button per distinct canonical collector — the
  // old Hassan/Balla pair collapses into the single unified shop, whose
  // button records the canonical method.
  assert.deepEqual(methods, ['Cash at Waseem Abbasi shop', 'Cash at Hassan Balla shop']);
  assert.ok(shops.find(s => s.method === 'Cash at Waseem Abbasi shop').short.includes('Waseem'));
  assert.ok(shops.find(s => s.method === 'Cash at Hassan Balla shop').short.includes('Hassan Balla'));
});

test('SISP-5 Cash Full (tap 2): one payment of total dues settles every priced bill via the existing flow', () => {
  const state = stateWith([
    customer('c1', 11, 'FIELD ALI', {
      mohalla: 'Barrian', phone: '+923001234567',
      promiseDate: '2026-10-20', promiseAmount: 6000, promiseNote: '',
      bills: [bill('2026-09'), bill('2026-10')]
    })
  ]);
  const entry = pendingFor(state).find(e => e.id === 'c1');
  assert.equal(entry.totalDues, 6000);
  assert.equal(entry.targetMonth, '2026-09');

  const args = fieldModeFullPaymentArgs(entry, 'Cash', '2026-10-28');
  assert.deepEqual(args, {
    customerId: 'c1', month: '2026-09', amount: 6000, date: '2026-10-28', method: 'Cash'
  });

  const { nextState, receipt, whatsapp } = collectFieldModePayment(state, entry, 'Cash', REF_DATE);
  assert.equal(receipt.amount, 6000);
  assert.equal(receipt.method, 'Cash');
  assert.equal(receipt.newTotalDues, 0);
  assert.equal(receipt.isSettled, true);
  // Allocation forwards the excess month by month: both bills balance to 0.
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('c1', '2026-09').balanceDueCents, 0);
  assert.equal(allocations.forMonth('c1', '2026-10').balanceDueCents, 0);
  // SISP-3 rule, through the existing flow: full payment clears the Waada.
  const updated = nextState.customers.find(c => c.id === 'c1');
  assert.equal(updated.promiseDate, undefined);
  assert.equal(updated.promiseAmount, undefined);
  // WA Receipt draft reuses the Quick Collect Urdu/English draft.
  assert.ok(whatsapp.url.startsWith('https://wa.me/923001234567?text='));
  assert.ok(whatsapp.text.includes('FIELD ALI'));
  assert.ok(whatsapp.text.includes('6,000'));
});

test('SISP-5 shop tap: payment recorded with the shop method feeds SISP-1 settlement derivation', () => {
  const state = stateWith([
    customer('c2', 12, 'FIELD BILAL', {
      mohalla: 'Shahdara Town', bills: [bill('2026-10')]
    })
  ]);
  const entry = pendingFor(state).find(e => e.id === 'c2');
  const { nextState, receipt } = collectFieldModePayment(state, entry, 'Cash at Waseem Abbasi shop', REF_DATE);
  assert.equal(receipt.method, 'Cash at Waseem Abbasi shop');
  const recorded = nextState.customers
    .find(c => c.id === 'c2').bills
    .flatMap(b => b.payments)
    .at(-1);
  assert.equal(recorded.method, 'Cash at Waseem Abbasi shop');
  const shop = resolveShopCollector(recorded.method, recorded.paidBy);
  assert.ok(shop && shop.includes('Waseem'));
});

test('SISP-5 Waada chips: +2 / +5 / 10th / custom / clear reuse the SISP-3 flow', () => {
  const base = customer('c1', 11, 'FIELD ALI', {});
  assert.equal(applyFieldModeWaadaChip(base, 'plus2', '2026-10-28').promiseDate, '2026-10-30');
  assert.equal(applyFieldModeWaadaChip(base, 'plus5', '2026-10-28').promiseDate, '2026-11-02');
  // 28th > 10th, so the 10th chip lands on next month's 10th.
  assert.equal(applyFieldModeWaadaChip(base, 'tenth', '2026-10-28').promiseDate, '2026-11-10');
  // On/before the 10th it lands on this month's 10th.
  assert.equal(applyFieldModeWaadaChip(base, 'tenth', '2026-10-05').promiseDate, '2026-10-10');
  assert.equal(applyFieldModeWaadaChip(base, 'custom', '2026-10-28', '2026-12-01').promiseDate, '2026-12-01');
  assert.throws(() => applyFieldModeWaadaChip(base, 'custom', '2026-10-28', 'not-a-date'));
  assert.throws(() => applyFieldModeWaadaChip(base, 'bogus', '2026-10-28'));
  const withPromise = applyFieldModeWaadaChip(base, 'plus2', '2026-10-28');
  const cleared = clearFieldModeWaada(withPromise);
  assert.equal(cleared.promiseDate, undefined);
  assert.equal(cleared.promiseAmount, undefined);
  assert.equal(cleared.promiseNote, undefined);
  // Inputs are never mutated.
  assert.equal(base.promiseDate, undefined);
});

test('SISP-5 hash route + wiring: deep link, toggle, view and action panel ids exist', () => {
  assert.equal(isFieldModeHash('#/field-mode'), true);
  assert.equal(isFieldModeHash('#field-mode'), true);
  assert.equal(isFieldModeHash('#/bulk-collect'), false);
  assert.equal(isFieldModeHash(''), false);
  const html = read('index.html');
  for (const id of [
    'fieldModeToggleBtn', 'fieldModeView', 'fieldModeCloseBtn',
    'fieldModeSearchInput', 'fieldModeSearchClearBtn', 'fieldModeZoneFilters',
    'fieldModeZoneTarget', 'fieldModeCustomerList', 'fieldModeActionPanel'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `index.html must contain #${id}`);
  }
  const appJs = read('app.js');
  assert.ok(appJs.includes("from './field-mode.js"), 'app.js must import field-mode.js');
  assert.ok(appJs.includes('window.fieldModeController = setupFieldMode('), 'app.js must wire setupFieldMode');
});

test('SISP-5 CSS: 48px action buttons, single-column 100vw overlay, tokens only', () => {
  const css = read('components.css');
  const block = css.slice(css.indexOf('/* SISP-5'));
  assert.ok(block.length > 0, 'components.css must contain the SISP-5 block');
  assert.ok(/\.field-mode-action-btn\s*\{[^}]*min-height:\s*48px/.test(block), 'action buttons must be min-height 48px');
  assert.ok(/\.field-mode-view\s*\{[^}]*width:\s*100%/.test(block), 'overlay must be width 100%');
  assert.ok(/\.field-mode-view\s*\{[^}]*max-width:\s*100vw/.test(block), 'overlay must be max-width 100vw');
  assert.ok(/\.field-mode-view\s*\{[^}]*overflow-x:\s*hidden/.test(block), 'overlay must hide horizontal overflow');
  assert.ok(/\.field-mode-action-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(block), 'action grid must be single-column with minmax(0, 1fr)');
  // Tokens only: no hex colours anywhere in the SISP-5 block (comments stripped).
  const stripped = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const hexes = stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  assert.deepEqual(hexes, [], `SISP-5 CSS must use tokens only, found: ${[...new Set(hexes)].join(', ')}`);
  assert.equal(FIELD_MODE_ALL_ZONES, 'all');
});
