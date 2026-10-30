/**
 * bulk-tariff-updater.test.js — SISP-81: Bulk Package Tariff Updater &
 * Rate-Lock Protection Wizard.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: bulk-updating 5 customers from Rs 2,000 to Rs 2,200
 *    updates their future package price while every existing
 *    rate-locked bill stays at Rs 2,000 — byte for byte.
 *  - The new rate prices FUTURE cycles only: the price schedule
 *    gains the new amount effective the month after the current
 *    (already billed) month, applicablePriceForMonth proves
 *    Oct = 2,000 / Nov = 2,200, and the real bill generator then
 *    creates November's bill at 2,200 without moving October's.
 *  - Filter honesty: catalogue match only (custom labels never
 *    match), active + non-archived only, optional current-fee pin,
 *    FREE connections excluded and counted as skipped.
 *  - Audit: each update appends a packageHistory entry via core
 *    updateCustomerProfile with the wizard's staff name.
 *  - Notices: Roman Urdu text with old/new fee + effective month +
 *    the rate-lock promise; wa.me URL via formatWhatsAppUrl; an
 *    invalid phone yields no URL.
 *  - Preview is read-only; a second identical apply is a no-op.
 *  - i18n: every tariff_* key exists in en + ur; wiring: dialog,
 *    open button, app.js controller, token-only CSS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TARIFF_STAFF_NAME, applyBulkTariffUpdate, buildTariffNoticeQueue,
  buildTariffNoticeText, buildTariffPreview, listTariffMatches,
  nextTariffMonth, tariffEffectiveMonth, tariffMonthLabel,
  tariffNoticeCopyText, validateTariffNewRate
} from '../bulk-tariff-updater.js';
import { applicablePriceForMonth } from '../billing-cycle.js';
import { generateMonthlyBillsThroughCurrentMonth } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T12:00:00+05:00'); // PKT month 2026-10
const PKG = '5mbps-200gb'; // '5Mbps / 200GB' @ Rs 2,000

function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Test Customer', phone: '03001234567',
    mohalla: 'BARRIAN', serviceStatus: 'active', archived: false,
    isFreeConnection: false, packageSpeed: '5Mbps / 200GB',
    monthlySellingAmount: 2000,
    monthlyPriceSchedule: [{ amount: 2000, effectiveMonth: '2026-06', recordedAt: '2026-06-01 10:00' }],
    billingStartMonth: '2026-10', packageHistory: [],
    bills: [], incidents: [], ...overrides
  };
}
function octBill(dueAmount = 2000) {
  return { id: 'b-2026-10', month: '2026-10', dueAmount, dueDate: '2026-10-05', status: 'pending', payments: [], generated: true, priceSnapshot: dueAmount, amountHistory: [] };
}
const stateOf = (customers) => ({ customers });

test('SPEC PIN: 5 customers 2,000 -> 2,200; future price moves, locked bills stay 2,000', () => {
  const customers = [1, 2, 3, 4, 5].map(n => customer({
    id: `c${n}`, customerNumber: n, name: `Test Customer ${n}`, bills: [octBill()]
  }));
  const before = stateOf(customers);
  const billsBefore = customers.map(c => JSON.stringify(c.bills));

  const result = applyBulkTariffUpdate(before, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);

  assert.equal(result.failed.length, 0);
  assert.equal(result.applied.length, 5);
  assert.equal(result.freeSkipped, 0);
  for (const [i, updated] of result.nextState.customers.entries()) {
    assert.equal(updated.monthlySellingAmount, 2200, `customer ${i + 1} future rate`);
    // RATE LOCK: the issued October bill is byte-identical.
    assert.equal(JSON.stringify(updated.bills), billsBefore[i], `customer ${i + 1} bills untouched`);
    assert.equal(updated.bills[0].dueAmount, 2000);
    // Schedule: new rate effective the month AFTER the billed month.
    const entry = updated.monthlyPriceSchedule.find(e => e.amount === 2200);
    assert.equal(entry?.effectiveMonth, '2026-11');
    assert.equal(applicablePriceForMonth(updated, '2026-10'), 2000);
    assert.equal(applicablePriceForMonth(updated, '2026-11'), 2200);
    // Audit trail via the house plan path.
    const history = updated.packageHistory.at(-1);
    assert.equal(history.oldMonthlyRate, 2000);
    assert.equal(history.newMonthlyRate, 2200);
    assert.equal(history.monthlyRecurringPriceDelta, 200);
    assert.equal(history.staffName, TARIFF_STAFF_NAME);
    assert.equal(history.newPackage, '5Mbps / 200GB', 'package label never changes in a tariff pass');
  }
});

test('future cycle end-to-end: the real generator prices November at 2,200, October stays 2,000', () => {
  const before = stateOf([customer({ bills: [octBill()] })]);
  const { nextState } = applyBulkTariffUpdate(before, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, new Date('2026-11-03T12:00:00+05:00'));
  const updated = november.customers[0];
  assert.equal(updated.bills.find(b => b.month === '2026-10').dueAmount, 2000);
  assert.equal(updated.bills.find(b => b.month === '2026-11').dueAmount, 2200);
});

test('filter: only active, non-archived, catalogue-matched customers at the pinned fee', () => {
  const state = stateOf([
    customer({ id: 'ok', customerNumber: 1 }),
    customer({ id: 'archived', customerNumber: 2, archived: true }),
    customer({ id: 'suspended', customerNumber: 3, serviceStatus: 'suspended' }),
    customer({ id: 'other-pkg', customerNumber: 4, packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 }),
    customer({ id: 'custom-label', customerNumber: 5, packageSpeed: 'Home Fiber Special', monthlySellingAmount: 2000 }),
    customer({ id: 'custom-fee', customerNumber: 6, monthlySellingAmount: 1800 }),
    customer({ id: 'free', customerNumber: 7, isFreeConnection: true }),
    customer({ id: 'no-fee', customerNumber: 8, monthlySellingAmount: null, monthlyPriceSchedule: [] })
  ]);
  const { rows, freeSkipped } = listTariffMatches(state, { packageId: PKG, currentRate: 2000 });
  // 'no-fee' has fee = catalogue price (2,000) via the house fallback, so it matches.
  assert.deepEqual(rows.map(r => r.customerId), ['ok', 'no-fee']);
  assert.equal(freeSkipped, 1, 'FREE connection counted as skipped, never a row');

  // Open fee filter catches the custom-fee customer on the same label.
  const open = listTariffMatches(state, { packageId: PKG, currentRate: null });
  assert.deepEqual(open.rows.map(r => r.customerId), ['ok', 'custom-fee', 'no-fee']);
  assert.equal(open.freeSkipped, 1);

  // Unknown package: no plan, no rows.
  const none = listTariffMatches(state, { packageId: 'nope', currentRate: 2000 });
  assert.equal(none.plan, null);
  assert.equal(none.rows.length, 0);
});

test('preview: deltas, total, effective months; read-only', () => {
  const state = stateOf([
    customer({ id: 'billed', customerNumber: 1, bills: [octBill()] }),
    customer({ id: 'unbilled', customerNumber: 2, bills: [] })
  ]);
  const snapshot = JSON.stringify(state);
  const preview = buildTariffPreview(state, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.totalDelta, 400);
  assert.equal(preview.rows.find(r => r.customerId === 'billed').effectiveMonth, '2026-11',
    'current month already billed -> new rate from next month');
  assert.equal(preview.rows.find(r => r.customerId === 'unbilled').effectiveMonth, '2026-10',
    'no bill issued yet -> current (unissued) cycle is the first at the new rate');
  assert.equal(tariffEffectiveMonth(state.customers[0], REF), '2026-11');
  assert.equal(JSON.stringify(state), snapshot, 'preview mutates nothing');
});

test('validation: bad rates and packages are refused before any write', () => {
  const state = stateOf([customer({})]);
  assert.throws(() => validateTariffNewRate(0), /greater than zero/);
  assert.throws(() => validateTariffNewRate(''), /greater than zero/);
  assert.throws(() => validateTariffNewRate(2000, 2000), /same as the current fee/);
  assert.equal(validateTariffNewRate('2200', 2000), 2200);
  assert.throws(() => buildTariffPreview(state, { packageId: 'nope', newRate: 2200 }, REF), /available packages/);
  assert.throws(() => applyBulkTariffUpdate(state, { packageId: PKG, currentRate: 2000, newRate: 2000 }, REF), /same as the current fee/);
});

test('apply: untouched customers keep object identity; a repeat apply is a no-op', () => {
  const other = customer({ id: 'other', customerNumber: 9, packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 });
  const state = stateOf([customer({ id: 'hit', bills: [octBill()] }), other]);
  const first = applyBulkTariffUpdate(state, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);
  assert.equal(first.applied.length, 1);
  assert.equal(first.nextState.customers.find(c => c.id === 'other'), other, 'non-matching record untouched');
  const second = applyBulkTariffUpdate(first.nextState, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);
  assert.equal(second.applied.length, 0, 'nobody is at the old fee any more');
  assert.equal(second.nextState, first.nextState, 'no-op returns the same state reference');
});

test('notices: Roman Urdu text, wa.me URL via the house helper, invalid phone -> no URL', () => {
  const state = stateOf([
    customer({ id: 'good', customerNumber: 3, name: 'Ali Khan', phone: '03001234567', bills: [octBill()] }),
    customer({ id: 'bad', customerNumber: 4, name: 'No Phone', phone: '123', bills: [octBill()] })
  ]);
  const { applied } = applyBulkTariffUpdate(state, { packageId: PKG, currentRate: 2000, newRate: 2200 }, REF);
  const queue = buildTariffNoticeQueue(applied);
  assert.equal(queue.length, 2);
  const good = queue.find(q => q.customerId === 'good');
  assert.ok(good.whatsappUrl.startsWith('https://wa.me/923001234567?text='));
  const text = decodeURIComponent(good.whatsappUrl.split('?text=')[1]);
  assert.ok(text.includes('Ali Khan'));
  assert.ok(text.includes('PKR 2,000'));
  assert.ok(text.includes('PKR 2,200'));
  assert.ok(text.includes('November 2026'), 'effective month named in the notice');
  assert.ok(text.includes('koi tabdeeli nahi'), 'rate-lock promise is in the notice');
  const bad = queue.find(q => q.customerId === 'bad');
  assert.equal(bad.whatsappUrl, null, 'invalid phone never fabricates a link');

  const copy = tariffNoticeCopyText(queue);
  assert.ok(copy.includes('#3 Ali Khan:'));
  assert.ok(copy.includes('#4 No Phone:'));
  assert.ok(buildTariffNoticeText({ name: '', packageLabel: '5Mbps / 200GB', oldRate: 2000, newRate: 2200, effectiveMonth: '2026-11' }).startsWith('Assalam o Alaikum!'), 'nameless greeting stays clean');
});

test('month helpers: next month + labels across the year boundary', () => {
  assert.equal(nextTariffMonth('2026-10'), '2026-11');
  assert.equal(nextTariffMonth('2026-12'), '2027-01');
  assert.equal(tariffMonthLabel('2026-11'), 'November 2026');
  assert.equal(tariffMonthLabel('2027-01'), 'January 2027');
});

test('i18n: every tariff_* key used by the module, dialog and button exists in en + ur', () => {
  const moduleSource = readFileSync(new URL('../bulk-tariff-updater.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set([
    ...[...moduleSource.matchAll(/t\('(tariff_[a-z_]+)'/g)].map(m => m[1]),
    ...[...html.matchAll(/data-i18n="(tariff_[a-z_]+)"/g)].map(m => m[1])
  ]);
  assert.ok(keys.size >= 20, `expected 20+ tariff keys, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0 && TRANSLATIONS.en[key] !== key, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0 && TRANSLATIONS.ur[key] !== key, `ur empty ${key}`);
  }
});

test('wiring: dialog + open button in index.html, controller in app.js, token-only CSS', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="bulkTariffDialog"'));
  assert.ok(html.includes('class="billing-modal bulk-tariff-modal"'), 'dialog rides the shared billing-modal shell (var(--modal-surface))');
  assert.ok(html.includes('id="bulkTariffOpenBtn"'));
  assert.ok(html.includes('id="tariffPackageSelect"') && html.includes('id="tariffApplyBtn"') && html.includes('id="tariffNoticeList"'));
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { setupBulkTariffDialog } from './bulk-tariff-updater.js';"));
  assert.ok(app.includes('setupBulkTariffDialog(() => state'));
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-81: Bulk Tariff Update'));
  const blockEnd = block.indexOf('\n/*', 10);
  const tariffCss = blockEnd > 0 ? block.slice(0, blockEnd) : block;
  assert.ok(tariffCss.includes('.bulk-tariff-row'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(tariffCss), 'tariff CSS uses theme tokens only, no hex');
});
