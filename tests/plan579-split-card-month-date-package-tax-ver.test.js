// Plan 579 — Split success card shows month, date, package, tax and VER.
//
// The split card (renderSplitReceiptCardHtml) showed the total received,
// the customer, the area, the remaining balance and the leg rows — but
// no billing month, no payment date, no package, no tax and no VER
// reference, although the combined object already carries month, date,
// package and salesTaxCents and each leg carries a receipt number.
// The single-payment card beside it already showed all four.
//
// FIX (parent decisions D1–D9, 2026-11-18; see
// ~/workspace/plan-579-prep.md):
// - D1(b) VER = per-leg stamps on the leg rows, reusing
//   splitLegVerificationStamp (the Plan 560 pattern) — there is
//   deliberately no combined receipt number to bind a combined code to.
// - D2(a) month NAME via monthName ('October') — the single card's
//   form, so the two cards beside each other read alike.
// - D3(a) date RAW '2026-10-29' — the sheet/draft form; the DD/MM/YYYY
//   helper cannot be imported (cycle).
// - D4(a) sheet order, grid-economical: Month + Date half-width after
//   Area, Package half-width, Tax full-width before the legs.
// - D5(a) tax row in the single-card form (full-width, SALES_TAX_
//   RECEIPT_LABEL, PKR figure, no '+' prefix) — the distinct-bill tax,
//   never a per-leg sum (a naive sum prints double).
// - D7(b) the raw Number(remaining) formula is FIXED (566's R11
//   hand-off): a finite-cents guard + formatReceiptMoneyFigure at the
//   render site, mirroring 566's single-card guard.
// - D8(a) 'Still owed' stays as-is. D9(a) visual/fit proof required.
//
// Fixtures (synthetic data only; pattern-fake EP99887766): the Plan 557
// taxed split (1,000 package + 195 tax, legs 1,000 Cash + 195 Easypaisa)
// and untaxed split (3,000 due, 2,000 + 1,000) via the REAL
// executeSplitTenderCollection; the qc-success-card-polish baseSplit
// hand-built combined (no month/date/package/salesTaxCents).
//
// Groups: G1 card rows (7), G2 VER stamps (3), G3 conditional
// rendering (3), G4 guards (6), G5 D7(b) finite-cents guard (2) =
// 21 tests. Expected suite: 20,500 + 21 = 20,521/0. Build dist 23.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection,
  formatSplitTenderWhatsAppText, generateSplitTenderReceiptHtml,
  renderSplitReceiptCardHtml
} from '../split-tender-collect.js';
import { verifyReceiptCode } from '../receipt-verifier.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const navCss = read('nav.css');
const components = read('components.css');

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

// A taxed 1,000-package split: 1,000 package + 195 tax = 1,195 due,
// settled 1,000 Cash + 195 Easypaisa (Plan 557 fixture, verbatim).
function taxedFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const { combinedReceipt: taxed } = executeSplitTenderCollection(taxedFixture(), {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
}, { execute: executeQuickCollection, referenceDate: NOW });

// An untaxed, unpackaged split: 3,000 due, settled 2,000 Cash + 1,000 Easypaisa.
function untaxedFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 3000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, NOW);
  return s;
}
const { combinedReceipt: untaxed } = executeSplitTenderCollection(untaxedFixture(), {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
}, { execute: executeQuickCollection, referenceDate: NOW });

// Hand-built combined (qc-success-card-polish baseSplit, verbatim) —
// no month/date/package/salesTaxCents, so the new rows must stay out.
function baseSplit(overrides = {}) {
  return {
    customerName: 'Test Customer',
    customerNumber: 37,
    area: 'Sodaa',
    totalReceived: 3000,
    balanceDueCents: 0,
    payableRemainingCents: 0,
    legs: [
      { leg: 1, method: 'Cash', amount: 2000, receiptNumber: 'RCPT-12-202611-01' },
      { leg: 2, method: 'Easypaisa', amount: 1000, receiptNumber: 'RCPT-12-202611-02' },
    ],
    ...overrides,
  };
}

// The labelled row for a label's exact cell text, or '' when absent.
function rowOf(html, label) {
  const at = html.indexOf(`>${label}<`);
  if (at < 0) return '';
  const rowStart = html.lastIndexOf('<div class="qc-receipt-item', at);
  const rowEnd = html.indexOf('</div>', at);
  return html.slice(rowStart, rowEnd);
}

// All VER codes stamped on the card, in row order.
function verCodesOf(html) {
  return [...html.matchAll(/VER: ([A-Z0-9]{4}-[A-Z0-9]{2})/g)].map((m) => m[1]);
}

/* ---------------- G1 — the card rows (7) ---------------- */

test('plan579 G1: taxed card shows the billing month NAME (October), not the raw YYYY-MM', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const row = rowOf(html, 'Month');
  assert.ok(row, 'card must carry a Month row');
  assert.ok(row.includes('October'), 'Month row must read the name October');
  assert.ok(!html.includes('>2026-10<'), 'no raw YYYY-MM cell may appear on the card');
});

test('plan579 G1: taxed card shows the payment date raw (2026-10-29)', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const row = rowOf(html, 'Date');
  assert.ok(row, 'card must carry a Date row');
  assert.ok(row.includes('2026-10-29'), 'Date row must read the raw payment date');
});

test('plan579 G1: taxed card shows the package (3Mbps / 100GB)', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const row = rowOf(html, 'Package');
  assert.ok(row, 'card must carry a Package row');
  assert.ok(row.includes('3Mbps / 100GB'), 'Package row must read the settled package');
});

test('plan579 G1: taxed card shows the tax figure once (PKR 195), never doubled', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  assert.ok(html.includes(SALES_TAX_RECEIPT_LABEL), 'tax row must carry the bilingual tax label');
  assert.ok(html.includes('PKR 195'), 'tax row must read the distinct-bill tax, PKR 195');
  assert.ok(!html.includes('PKR 390'), 'a per-leg sum would print double — never PKR 390');
});

test('plan579 G1: row order is Month, Date, Package, Tax, then the leg rows', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const monthAt = html.indexOf('>Month<');
  const dateAt = html.indexOf('>Date<');
  const packageAt = html.indexOf('>Package<');
  const taxAt = html.indexOf(SALES_TAX_RECEIPT_LABEL);
  const verAt = html.indexOf('VER: ');
  assert.ok(monthAt > 0 && dateAt > 0 && packageAt > 0 && taxAt > 0 && verAt > 0, 'all five rows must exist');
  assert.ok(monthAt < dateAt, 'Month must sit before Date');
  assert.ok(dateAt < packageAt, 'Date must sit before Package');
  assert.ok(packageAt < taxAt, 'Package must sit before Tax');
  assert.ok(taxAt < verAt, 'Tax must sit before the leg rows');
});

test('plan579 G1: untaxed card shows NO tax row and NO tax label', () => {
  const html = renderSplitReceiptCardHtml(untaxed);
  assert.ok(!html.includes(SALES_TAX_RECEIPT_LABEL), 'untaxed card must not carry the tax label');
  assert.ok(!html.includes('>Sales tax<'), 'untaxed card must not carry a tax row');
});

test('plan579 G1: unpackaged split shows no Package row', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({ month: '2026-11', date: '2026-11-08', package: '' }));
  assert.ok(rowOf(html, 'Month').includes('November'), 'Month row still shows for a dated split');
  assert.ok(rowOf(html, 'Date').includes('2026-11-08'), 'Date row still shows for a dated split');
  assert.equal(rowOf(html, 'Package'), '', 'no Package row when the bill carries no package');
});

/* ---------------- G2 — the per-leg VER stamps (3) ---------------- */

test('plan579 G2: each leg row carries its own VER stamp in XXXX-XX form', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const codes = verCodesOf(html);
  assert.equal(codes.length, 2, 'one stamp per leg, two legs');
  for (const code of codes) {
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{2}$/, 'stamp must read VER: XXXX-XX');
  }
});

test('plan579 G2: each stamp verifies for its own leg facts, never for the other leg', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  const codes = verCodesOf(html);
  assert.equal(codes.length, 2, 'one stamp per leg, two legs');
  const [leg1, leg2] = taxed.legs;
  const factsOf = (leg) => ({
    receiptId: leg.receiptNumber,
    customerId: taxed.customerId,
    amountPaid: leg.amount,
    date: leg.date
  });
  assert.ok(verifyReceiptCode(codes[0], factsOf(leg1)), 'leg 1 stamp must verify for leg 1 facts');
  assert.ok(verifyReceiptCode(codes[1], factsOf(leg2)), 'leg 2 stamp must verify for leg 2 facts');
  assert.ok(!verifyReceiptCode(codes[0], factsOf(leg2)), 'leg 1 stamp must NOT verify for leg 2 facts');
  assert.ok(!verifyReceiptCode(codes[1], factsOf(leg1)), 'leg 2 stamp must NOT verify for leg 1 facts');
});

test('plan579 G2: a leg without a receipt number shows no VER stamp', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({
    legs: [
      { leg: 1, method: 'Cash', amount: 2000 },
      { leg: 2, method: 'Easypaisa', amount: 1000, receiptNumber: 'RCPT-12-202611-02' }
    ]
  }));
  const codes = verCodesOf(html);
  assert.equal(codes.length, 1, 'only the leg with a receipt number carries a stamp');
  assert.ok(verifyReceiptCode(codes[0], {
    receiptId: 'RCPT-12-202611-02',
    customerId: undefined,
    amountPaid: 1000,
    date: undefined
  }), 'the one stamp belongs to leg 2 and verifies for its facts');
});

/* ---------------- G3 — conditional rendering (3) ---------------- */

test('plan579 G3: bare combined renders no new rows and no undefined/NaN', () => {
  const html = renderSplitReceiptCardHtml(baseSplit());
  assert.equal(rowOf(html, 'Month'), '', 'no Month row without a month');
  assert.equal(rowOf(html, 'Date'), '', 'no Date row without a date');
  assert.equal(rowOf(html, 'Package'), '', 'no Package row without a package');
  assert.ok(!html.includes(SALES_TAX_RECEIPT_LABEL), 'no tax row without a tax');
  assert.ok(!html.includes('undefined'), 'no undefined text on a bare card');
  assert.ok(!html.includes('NaN'), 'no NaN text on a bare card');
});

test('plan579 G3: combined with month but no package shows Month, no Package', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({ month: '2026-11' }));
  assert.ok(rowOf(html, 'Month').includes('November'), 'Month row shows the name');
  assert.equal(rowOf(html, 'Package'), '', 'no Package row without a package');
  assert.equal(rowOf(html, 'Date'), '', 'no Date row without a date');
});

test('plan579 G3: invalid month shows no Month row (monthName returns empty)', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({ month: '2026-13' }));
  assert.equal(rowOf(html, 'Month'), '', 'month 13 has no name, so no Month row');
  const html2 = renderSplitReceiptCardHtml(baseSplit({ month: 'not-a-month' }));
  assert.equal(rowOf(html2, 'Month'), '', 'a non-YYYY-MM month has no name, so no Month row');
});

/* ---------------- G4 — guards (6) ---------------- */

test('plan579 G4: leg rows unchanged — receipt numbers, TIDs and methods still present', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  assert.ok(html.includes('REC-2610-0001'), 'leg receipt numbers still show');
  assert.ok(html.includes('TID EP99887766'), 'leg TID still shows');
  assert.ok(html.includes('Cash'), 'leg 1 method still shows');
  assert.ok(html.includes('Easypaisa'), 'leg 2 method still shows');
});

test('plan579 G4: fully-paid card still hides Still-owed', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  assert.ok(!html.includes('Still owed'), 'fully-paid split card must not carry a Still owed row');
});

test('plan579 G4: terms block still inside the card with Nastaliq + gradient classes', () => {
  const html = renderSplitReceiptCardHtml(taxed);
  assert.ok(html.includes('qc-urdu-nastaliq'), 'terms block keeps the Nastaliq class');
  assert.ok(html.includes('qc-urdu-gradient'), 'terms block keeps the gradient class');
  assert.ok(html.includes('receipt-urdu-notice'), 'terms block still inside the card');
});

test('plan579 G4: combined HTML sheet + WhatsApp text unchanged (557 precedent)', () => {
  const sheet = generateSplitTenderReceiptHtml(taxed);
  assert.ok(sheet.includes('2026-10'), 'sheet still shows the billing month');
  assert.ok(sheet.includes('2026-10-29'), 'sheet still shows the payment date');
  assert.ok(sheet.includes('3Mbps / 100GB'), 'sheet still shows the package');
  assert.ok(sheet.includes(SALES_TAX_RECEIPT_LABEL), 'sheet still shows the tax label');
  const draft = formatSplitTenderWhatsAppText(taxed);
  assert.ok(draft.includes('2026-10'), 'draft still shows the billing month');
  assert.ok(draft.includes('2026-10-29'), 'draft still shows the payment date');
  assert.ok(draft.includes('3Mbps / 100GB'), 'draft still shows the package');
});

test('plan579 G4: EN/UR parity stays 4,669/4,669 — the rows use hardcoded labels, no new keys', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4722, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4722, 'UR key count moved');
});

test('plan579 G4: hex pins hold, and the taxed fully-paid card has 9 grid items (D4(a) placement)', () => {
  assert.equal(hexCount(styles), 613, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(navCss), 164, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
  // D4(a) placement, counted: 6 half-width (Customer, Area, Month,
  // Date, Package, Next due date) + 1 tax full-width + 2 leg rows.
  // Still-owed is hidden (fully paid); no waada/waived rows here.
  const html = renderSplitReceiptCardHtml(taxed);
  const items = (html.match(/<div class="qc-receipt-item/g) || []).length;
  assert.equal(items, 9, `taxed fully-paid card must carry 9 grid items, found ${items}`);
});

/* ---------------- G5 — D7(b) finite-cents guard (2) ---------------- */

test('plan579 G5: Infinity cents never reach the row — no PKR ∞, no NaN, row hidden', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({
    payableRemainingCents: Infinity, balanceDueCents: Infinity
  }));
  assert.ok(!html.includes('∞'), 'no infinity glyph on the card');
  assert.ok(!html.includes('PKR ∞'), 'never PKR ∞ on the card');
  assert.ok(!html.includes('NaN'), 'no NaN text on the card');
  assert.ok(!html.includes('Still owed'), 'an unguarded remainder hides the row, never prints');
});

test('plan579 G5: Infinity first field falls through to the next finite field', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({
    payableRemainingCents: Infinity, balanceDueCents: 50000
  }));
  assert.ok(html.includes('Still owed'), 'the finite fallback still shows the row');
  assert.ok(html.includes('PKR 500'), 'the figure reads the finite fallback, PKR 500');
});
