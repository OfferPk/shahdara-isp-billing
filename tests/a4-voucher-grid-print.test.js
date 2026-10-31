/**
 * a4-voucher-grid-print.test.js — SISP-115 [P2]: Printable A4 4-Up
 * Tear-Off Monthly Bill Vouchers by Zone.
 *
 * Spec criterion (read-latest.txt, SISP-115): "Generating the A4 4-Up
 * view for 9 unpaid customers in Barrian renders 3 pages (4 + 4 + 1
 * vouchers) with accurate totals."
 *
 * Pins:
 *  - the spec scenario exactly: 9 unpaid Barrian customers (mohalla
 *    spelling variants folding into one canonical zone) → 9 vouchers,
 *    pages [4, 4, 1], print HTML with exactly 3 .bv-page sections;
 *  - figures come from the engine only: a voucher's Arrears equals
 *    buildArrearsBreakdown's previousArrears, its Total Due equals
 *    the allocation engine's outstanding through the month, and the
 *    Package / Kist split is the bill's own composition;
 *  - inclusion rule: paid-in-full, FREE, archived, cancelled,
 *    other-zone, no-bill-this-month and unpriced-bill customers never
 *    appear; a partial payer appears with the remaining balance; a
 *    VOIDED payment never counts as paid (SISP-34), so the customer
 *    reappears owing the full amount;
 *  - bilingual names via bilingualCustomerName (stored Urdu override
 *    wins, Roman always kept);
 *  - QR is the SISP-14 payload unchanged: the voucher deep link is
 *    exactly qr-card.js's buildKhataDeepLink (?customer=<id>&
 *    action=pay), round-trips through parseCustomerDeepLink, and the
 *    shops line is qr-card.js's single KHATA_PAYMENT_SHOPS export;
 *  - print document: @page A4, @media print page breaks, dashed cut
 *    lines, per-page sections, grand totals that are plain sums of
 *    the printed vouchers;
 *  - read-only: state is byte-for-byte identical after building and
 *    rendering, and two builds are deep-equal;
 *  - i18n: every bvouch_* key used by the module or the dialog markup
 *    exists in BOTH dictionaries (params included);
 *  - wiring: dialog + button markup, app.js controller setup, token-
 *    only CSS (no hex), and the module is reachable in the runtime
 *    graph (collectRuntimeFiles) so the bundle stays closed.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, saveBillMonth, addPayment,
  calculatePaymentAllocations
} from '../core.js';
import { voidPayment } from '../payment-void-audit.js';
import { buildArrearsBreakdown } from '../billing-cycle.js';
import {
  KHATA_PAYMENT_SHOPS, buildKhataDeepLink, parseCustomerDeepLink
} from '../qr-card.js';
import {
  VOUCHERS_PER_PAGE,
  buildBillVouchers,
  listBillVoucherZones,
  paginateVouchers,
  generateVoucherGridPrintHtml,
  qrSvgForDeepLink
} from '../a4-voucher-grid-print.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-20T12:00:00Z');
const ADD_REF = new Date('2026-10-01T12:00:00Z');
const MONTH = '2026-10';

function makeBuilder() {
  let state = createInitialState([]);
  const add = (name, options = {}) => {
    state = addCustomer(state, name, ADD_REF, options);
    return state.customers[state.customers.length - 1];
  };
  const bill = (cust, month, dueAmount, extra = {}) => {
    state = saveBillMonth(state, cust.id, { month, dueAmount, status: 'pending', ...extra }, ADD_REF);
    return state.customers.find((c) => c.id === cust.id).bills.find((b) => b.month === month);
  };
  const pay = (cust, month, amount, date = '2026-10-10') => {
    state = addPayment(state, cust.id, month, { amount, date, method: 'Cash' }, REF);
    const record = state.customers.find((c) => c.id === cust.id);
    return record.bills.find((b) => b.month === month).payments.at(-1);
  };
  const stored = (cust) => state.customers.find((c) => c.id === cust.id);
  return { get state() { return state; }, set state(v) { state = v; }, add, bill, pay, stored };
}

// ---------------------------------------------------------------- spec pin

test('spec pin: 9 unpaid Barrian customers render 3 pages (4 + 4 + 1) with accurate totals', () => {
  const b = makeBuilder();
  const variants = ['BARRIAN', 'Barrian', 'Mohalla Barrian'];
  for (let i = 1; i <= 9; i += 1) {
    const cust = b.add(`Voucher Tester ${i}`, { mohalla: variants[i % 3] });
    b.bill(cust, MONTH, 3000);
  }

  const model = buildBillVouchers(b.state, { zone: 'Barrian', month: MONTH, referenceDate: REF });
  assert.equal(model.month, MONTH);
  assert.equal(model.vouchers.length, 9);
  assert.deepEqual(model.pages.map((p) => p.length), [4, 4, 1]);
  assert.equal(model.totals.count, 9);
  assert.equal(model.totals.totalDue, 27000);
  assert.equal(model.totals.arrears, 0);
  for (const voucher of model.vouchers) {
    assert.equal(voucher.packageAmount, 3000);
    assert.equal(voucher.kistAmount, 0);
    assert.equal(voucher.arrears, 0);
    assert.equal(voucher.totalDue, 3000);
    assert.equal(voucher.zoneLabel, 'Barrian');
  }
  // Zone argument is canonicalized too: 'BARRIAN' finds the same run.
  const again = buildBillVouchers(b.state, { zone: 'BARRIAN', month: MONTH, referenceDate: REF });
  assert.deepEqual(again.vouchers.map((v) => v.customerId), model.vouchers.map((v) => v.customerId));

  const html = generateVoucherGridPrintHtml({ model, lang: 'en' });
  assert.equal((html.match(/class="bv-page"/g) || []).length, 3);
  assert.ok(html.includes('@page { size: A4 portrait;'));
  assert.ok(html.includes('@media print'));
  assert.ok(html.includes('break-after: page'));
  assert.ok(html.includes('dashed'), 'tear-off cut lines are dashed');
  assert.equal((html.match(/class="bv-voucher"/g) || []).length, 9);
  assert.ok(html.includes('27,000'), 'grand total printed');
});

test('paginateVouchers chunks by VOUCHERS_PER_PAGE', () => {
  assert.equal(VOUCHERS_PER_PAGE, 4);
  assert.deepEqual(paginateVouchers([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((p) => p.length), [4, 4, 1]);
  assert.deepEqual(paginateVouchers([1, 2, 3, 4, 5, 6, 7, 8]).map((p) => p.length), [4, 4]);
  assert.deepEqual(paginateVouchers([]), []);
  assert.deepEqual(paginateVouchers(null), []);
});

// ------------------------------------------------------------- engine figures

test('figures: arrears, package and kist split, and total due all match the engine', () => {
  const b = makeBuilder();
  const cust = b.add('Arrears Tester', { mohalla: 'BARRIAN' });
  b.bill(cust, '2026-09', 3000); // September never paid
  const octBill = b.bill(cust, MONTH, 3500);
  // Stamp the SISP-4 kist line the October bill carries (3000 package
  // + 500 kist = 3500 dueAmount, the stored-bill shape).
  const storedCust = b.stored(cust);
  const storedBill = storedCust.bills.find((x) => x.month === MONTH);
  storedBill.kistLines = [{ planId: 'plan-test-1', installmentNumber: 1, totalMonths: 3, amount: 500, itemTitle: 'Test Router' }];
  assert.equal(octBill.month, MONTH);

  const model = buildBillVouchers(b.state, { zone: 'BARRIAN', month: MONTH, referenceDate: REF });
  assert.equal(model.vouchers.length, 1);
  const voucher = model.vouchers[0];
  assert.equal(voucher.packageAmount, 3000);
  assert.equal(voucher.kistAmount, 500);
  assert.equal(voucher.arrears, 3000);
  assert.equal(voucher.monthBalance, 3500);
  assert.equal(voucher.totalDue, 6500);

  // Cross-check against the engines themselves (no second math):
  const breakdown = buildArrearsBreakdown(b.stored(cust), b.stored(cust).bills.find((x) => x.month === MONTH));
  assert.equal(voucher.arrears, breakdown.previousArrears);
  assert.equal(voucher.packageAmount, breakdown.packageAmount);
  assert.equal(voucher.kistAmount, breakdown.kistAmount);
  const allocations = calculatePaymentAllocations(b.state);
  let engineOutstandingCents = 0;
  for (const bill of b.stored(cust).bills) {
    if (bill.month <= MONTH) engineOutstandingCents += allocations.forMonth(cust.id, bill.month)?.balanceDueCents ?? 0;
  }
  assert.equal(voucher.totalDue, engineOutstandingCents / 100);
});

// -------------------------------------------------------------- inclusion rule

test('inclusion: paid, FREE, archived, cancelled, other-zone, no-bill and unpriced customers are excluded; partial and voided are in', () => {
  const b = makeBuilder();

  const partial = b.add('Partial Tester', { mohalla: 'BARRIAN' });
  b.bill(partial, MONTH, 3000);
  b.pay(partial, MONTH, 1000);

  const voided = b.add('Voided Tester', { mohalla: 'BARRIAN' });
  b.bill(voided, MONTH, 3000);
  const voidedPayment = b.pay(voided, MONTH, 3000);
  b.state = voidPayment(b.state, voided.id, MONTH, voidedPayment.id, { voidReason: 'Wrong entry (test)' }).state;

  const paid = b.add('Paid Tester', { mohalla: 'BARRIAN' });
  b.bill(paid, MONTH, 3000);
  b.pay(paid, MONTH, 3000);

  const free = b.add('Free Tester', { mohalla: 'BARRIAN', isFreeConnection: true });
  b.bill(free, MONTH, 3000);

  const archived = b.add('Archived Tester', { mohalla: 'BARRIAN' });
  b.bill(archived, MONTH, 3000);
  b.stored(archived).archived = true;

  const cancelled = b.add('Cancelled Tester', { mohalla: 'BARRIAN' });
  b.bill(cancelled, MONTH, 3000);
  b.stored(cancelled).cancellationDate = '2026-10-15';

  const noBill = b.add('Arrears Only Tester', { mohalla: 'BARRIAN' });
  b.bill(noBill, '2026-09', 3000);

  const unpriced = b.add('Unpriced Tester', { mohalla: 'BARRIAN' });
  b.bill(unpriced, MONTH, 3000);
  // An unpriced ("not set") bill record, as the generator leaves one
  // when no price applies: the amount is stamped off at record level.
  b.stored(unpriced).bills.find((x) => x.month === MONTH).dueAmount = null;

  const otherZone = b.add('Other Zone Tester', { mohalla: 'PALALIYAA' });
  b.bill(otherZone, MONTH, 2500);

  const model = buildBillVouchers(b.state, { zone: 'BARRIAN', month: MONTH, referenceDate: REF });
  const byId = new Map(model.vouchers.map((v) => [v.customerId, v]));
  assert.equal(byId.get(partial.id)?.totalDue, 2000, 'partial payer owes the remaining balance');
  assert.equal(byId.get(voided.id)?.totalDue, 3000, 'a voided payment never counts as paid');
  for (const excluded of [paid, free, archived, cancelled, noBill, unpriced, otherZone]) {
    assert.ok(!byId.has(excluded.id), `${excluded.name} must not get a Barrian voucher`);
  }
  assert.equal(model.vouchers.length, 2);

  const all = buildBillVouchers(b.state, { zone: 'all', month: MONTH, referenceDate: REF });
  assert.equal(all.vouchers.length, 3, 'the other-zone customer joins the all-zones run');
  assert.equal(all.vouchers.find((v) => v.customerId === otherZone.id)?.totalDue, 2500);

  const zones = listBillVoucherZones(b.state, { month: MONTH, referenceDate: REF });
  assert.deepEqual(zones.map((z) => [z.label, z.count]), [['Barrian', 2], ['Palaliyaa', 1]]);
});

// ------------------------------------------------------------------ QR + shops

test('QR payload is the unchanged SISP-14 deep link and the shops line is the shared KHATA_PAYMENT_SHOPS', () => {
  const b = makeBuilder();
  const cust = b.add('Qr Tester', { mohalla: 'BARRIAN', nameUrdu: 'کیو آر ٹیسٹر' });
  b.bill(cust, MONTH, 3000);

  const model = buildBillVouchers(b.state, { zone: 'BARRIAN', month: MONTH, referenceDate: REF });
  const voucher = model.vouchers[0];
  assert.equal(voucher.deepLink, buildKhataDeepLink(cust.id));
  const parsed = parseCustomerDeepLink(`?${voucher.deepLink.split('?')[1]}`);
  assert.deepEqual(parsed, { customerId: cust.id, action: 'pay' });
  assert.deepEqual(voucher.shops, KHATA_PAYMENT_SHOPS);
  assert.deepEqual(model.shops, KHATA_PAYMENT_SHOPS);

  // Bilingual name: stored Urdu override wins, Roman always kept.
  assert.equal(voucher.bilingualName, `کیو آر ٹیسٹر (Qr Tester)`);
  assert.equal(voucher.customerNumber, cust.customerNumber);

  const svg = qrSvgForDeepLink(voucher.deepLink);
  assert.ok(svg.startsWith('<svg class="bv-qr"'), 'QR renders as inline SVG');
  assert.equal(qrSvgForDeepLink(''), '');
  assert.equal(qrSvgForDeepLink('x'.repeat(500)), '', 'overlong payload falls back, never throws');

  const html = generateVoucherGridPrintHtml({ model, lang: 'en' });
  assert.ok(html.includes('<svg class="bv-qr"'));
  assert.ok(html.includes(KHATA_PAYMENT_SHOPS.join(' • ')), 'shops line printed from the shared list');
  assert.ok(html.includes('کیو آر ٹیسٹر (Qr Tester)'));
  assert.ok(html.includes(`#${cust.customerNumber}`), 'connection ID printed');
});

// ------------------------------------------------------------------- read-only

test('read-only: building and rendering mutate nothing and repeat builds agree', () => {
  const b = makeBuilder();
  const cust = b.add('Readonly Tester', { mohalla: 'BARRIAN' });
  b.bill(cust, '2026-09', 3000);
  b.bill(cust, MONTH, 3000);

  const before = JSON.stringify(b.state);
  const first = buildBillVouchers(b.state, { zone: 'all', month: MONTH, referenceDate: REF });
  const html = generateVoucherGridPrintHtml({ model: first, lang: 'ur' });
  assert.ok(html.includes('واؤچر'), 'Urdu print labels render');
  const second = buildBillVouchers(b.state, { zone: 'all', month: MONTH, referenceDate: REF });
  assert.equal(JSON.stringify(b.state), before, 'state byte-for-byte unchanged');
  assert.deepEqual(second, first, 'nothing is consumed or persisted between runs');
});

test('empty selection renders an honest empty sheet', () => {
  const b = makeBuilder();
  const model = buildBillVouchers(b.state, { zone: 'BARRIAN', month: MONTH, referenceDate: REF });
  assert.equal(model.vouchers.length, 0);
  assert.deepEqual(model.pages, []);
  const html = generateVoucherGridPrintHtml({ model, lang: 'en' });
  assert.ok(html.includes('No unpaid subscribers in this selection.'));
});

// ------------------------------------------------------------------------ i18n

test('i18n: every bvouch_* key used by the module or dialog exists in both dictionaries with matching params', () => {
  const moduleSource = readFileSync(new URL('../a4-voucher-grid-print.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const match of moduleSource.matchAll(/t\('(bvouch_[a-z_]+)'/g)) keys.add(match[1]);
  for (const match of indexHtml.matchAll(/data-i18n="(bvouch_[a-z_]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 15, `expected a real key set, got ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    const enParams = (TRANSLATIONS.en[key].match(/\{\w+\}/g) || []).sort();
    const urParams = (TRANSLATIONS.ur[key].match(/\{\w+\}/g) || []).sort();
    assert.deepEqual(urParams, enParams, `params differ for ${key}`);
  }
  // Full bvouch_* parity across the dictionaries (no one-sided keys).
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('bvouch_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('bvouch_')).sort();
  assert.deepEqual(urKeys, enKeys);
});

// ---------------------------------------------------------------------- wiring

test('wiring: dialog markup, app.js controller, token-only CSS, runtime graph reachability', async () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['billVouchersBtn', 'billVoucherDialog', 'billVoucherCloseBtn', 'billVoucherZoneSelect', 'billVoucherMonthInput', 'billVoucherPreview', 'billVoucherPrintBtn', 'billVoucherCloseBtn2']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  assert.ok(indexHtml.includes('id="billVouchersBtn"'), 'open button in the Monthly Billing actions bar');
  const dialogStart = indexHtml.indexOf('id="billVoucherDialog"');
  const dialogChunk = indexHtml.slice(dialogStart, dialogStart + 400);
  assert.ok(dialogChunk.includes('billing-modal'), 'dialog uses the shared billing-modal shell (var(--modal-surface))');

  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes("from './a4-voucher-grid-print.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('setupBillVoucherDialog'), 'app.js sets up the dialog controller');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const blockStart = css.indexOf('SISP-115: Bill Vouchers dialog');
  assert.ok(blockStart >= 0, 'components.css carries the SISP-115 block');
  const block = css.slice(blockStart, css.indexOf('.bill-voucher-preview', blockStart) + 200);
  assert.ok(block.includes('var(--'), 'dialog CSS uses theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'dialog CSS has no hardcoded hex colours');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('a4-voucher-grid-print.js'), 'module is reachable in the runtime graph (app.js-only import, inlined at build)');
});
