// Plan 592 — Print card shows the sales-tax row, the zone, and a
// human print date.
//
// Decided (parent, all §9 (a) options):
//   D1(a) tax = the CURRENT month's bill through salesTaxReceiptLine
//         (the spec's words, the plan580 pattern); the REJECTED
//         source is the derived figure (monthlyProfit.tax /
//         customerSalesTaxCents) — it shows PKR 195 on a bill the
//         operator deliberately untaxed, contradicting the receipt
//         for the same customer.
//   D2(a) salesTaxCents — integer cents, null when absent.
//   D3(a) zone separator ' · ' — the acceptance's literal and the
//         card's own separator; REJECTED ', ' (receipt parity) —
//         disclosed: ' · ' matches neither the receipts nor the view.
//   D4(a) label SALES_TAX_RECEIPT_LABEL ('Sales tax / سیلز ٹیکس
//         (19.5%)'), passed by the caller.
//   D5(a) caller passes printDateDisplay: humanDate(localDate());
//         the module falls back to the ISO printDate; plan362's
//         three footer asserts hold unchanged.
//   D6(a) footer only — the last-payment line keeps its raw ISO date.
//   D7(a) tax row immediately after Package (receipt order).
//   D8(a) this new file. D9(a) live browser/print sample (separate).
//   D10(a) plain 'PKR 195' — no '+' prefix (REJECTED '+PKR 195').
//
// Spec corrections recorded here (see the prep): the function runs
// :121–160 (not :121–142); the caller is app.js:8914–8930 on this
// base (not :6831–6850); the package price is EX-tax — the taxed
// bill due is 1195 = 1000 + 195; 'Mohalla · Zone matching the view'
// is not literally satisfiable (receipts join with ', ', the view
// shows Area and Zone as separate rows).
//
// Fixtures reuse the plan362 generic shape (Customer One, Charyaa,
// pattern-fake 03012345678) — no new customer data, no real names,
// no real phones. The tax cents are always derived through the real
// salesTaxReceiptLine on a fixture bill, never hardcoded in the
// assertion's premise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildProfilePrintCardHtml } from '../profile-print-card.js';
import { SALES_TAX_RECEIPT_LABEL, salesTaxReceiptLine } from '../package-sales-tax.js';
import { formatPKR } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-print-card.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');

// Money is formatted exactly as the plan362 tests format it: PKR
// rupees, no conversion. The live caller passes formatPKR; the
// 29250c case below pins the real formatPKR rendering instead.
const format = (value) => `PKR ${value}`;

// The caller's human date, computed the way app.js:1493 computes it
// (dateStyle 'medium', PKT timezone) — asserted by shape, never by a
// hardcoded month string, because the output is locale-shaped.
const humanDateShape = (iso) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'Asia/Karachi',
}).format(new Date(`${iso}T00:00:00Z`));

const fullFixture = () => ({
  customerId: 'CUST-1',
  customerName: 'Customer One',
  customerNumber: '36',
  businessName: 'Shahdara ISP',
  knownAs: 'Shuna',
  mohalla: 'Charyaa',
  zone: 'Side 1',
  packageLabel: '15 Mbps',
  packagePrice: 1000,
  outstanding: 1195,
  lastPayment: { amount: 1000, date: '2026-10-05' },
  contactNumber: '03012345678',
  handlingNote: 'Collect only from the father.',
  printDate: '2026-11-06',
});

// The <td> value of the row whose <th> is `label`, or null when the
// row is absent. Plain string matching — the bilingual label carries
// regex-special characters, so no regex is used here.
const rowValue = (card, label) => {
  const marker = `<th>${label}</th><td>`;
  const at = card.indexOf(marker);
  if (at < 0) return null;
  const rest = card.slice(at + marker.length);
  return rest.slice(0, rest.indexOf('</td>'));
};

const rowLabels = (card) => [...card.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);

// G1 — Inventory: the base card shape, the taxed shape, the wiring.

test('Plan 592: base card (no new input) keeps 7 rows, mohalla only, ISO footer', () => {
  const { zone, ...base } = fullFixture();
  const card = buildProfilePrintCardHtml(base, format);
  assert.ok(card);
  assert.deepEqual(rowLabels(card), [
    'Known as', 'Mohalla', 'Package', 'Current dues', 'Last payment', 'Contact number', 'Handling note',
  ]);
  assert.equal(rowValue(card, 'Mohalla'), 'Charyaa', 'no zone input means the mohalla alone');
  assert.ok(!card.includes('Sales tax'), 'no tax row without a tax figure');
  assert.ok(card.includes('Printed on 2026-11-06'), 'no display string means the ISO footer');
});

test('Plan 592: taxed 1000-package card shows tax PKR 195 and package PKR 1000, no total', () => {
  const taxedBill = { month: '2026-11', salesTaxCents: 19500 };
  const fixture = {
    ...fullFixture(),
    salesTaxCents: salesTaxReceiptLine(taxedBill)?.taxCents ?? null,
    salesTaxLabel: SALES_TAX_RECEIPT_LABEL,
  };
  const card = buildProfilePrintCardHtml(fixture, format);
  assert.ok(card);
  assert.deepEqual(rowLabels(card), [
    'Known as', 'Mohalla', 'Package', SALES_TAX_RECEIPT_LABEL, 'Current dues', 'Last payment', 'Contact number', 'Handling note',
  ], 'the tax row sits immediately after Package — receipt order');
  assert.equal(rowValue(card, SALES_TAX_RECEIPT_LABEL), 'PKR 195', 'the acceptance, verbatim');
  assert.equal(rowValue(card, 'Package'), '15 Mbps · PKR 1000/month', 'the package stays the ex-tax price — never 1195');
  assert.ok(!card.includes('Total'), 'the card gains no total row');
  assert.ok(!card.includes('+PKR'), 'no receipt-style + prefix on this card');
  assert.equal(rowValue(card, 'Mohalla'), 'Charyaa · Side 1');
});

test('Plan 592: caller passes zone, bill tax cents, label and human print date', () => {
  const start = appSrc.indexOf("querySelector('#profilePrintCardButton')");
  assert.ok(start > 0, 'the print-card click handler exists');
  const slice = appSrc.slice(start, start + 2200);
  assert.ok(slice.includes("zone: customer.zone || '',"), 'the zone rides in the call object');
  assert.ok(
    slice.includes('salesTaxCents: salesTaxReceiptLine(customer?.bills?.find((bill) => bill.month === pakistanMonthNow()))?.taxCents ?? null,'),
    'the tax is the current month bill through the receipt helper',
  );
  assert.ok(slice.includes('salesTaxLabel: SALES_TAX_RECEIPT_LABEL,'), 'the receipt label rides in the call object');
  assert.ok(slice.includes('printDateDisplay: humanDate(localDate()),'), 'the human print date rides in the call object');
  assert.ok(!slice.includes('monthlyProfit.tax'), 'never the derived figure (it taxes operator-untaxed bills)');
  assert.ok(!slice.includes('salesTaxCentsOfBill'), 'never the raw per-bill figure (it taxes waived months)');
  assert.match(
    appSrc,
    /import \{ SALES_TAX_RATE_PERCENT, SALES_TAX_RECEIPT_LABEL, customerSalesTaxCents, formatSalesTaxAmount, salesTaxCentsForPrice, salesTaxDashboardRows, salesTaxDashboardTotals, salesTaxReceiptLine, salesTaxTable \} from '\.\/package-sales-tax\.js\?v=1\.11\.0';/,
    'both new names join the one existing import line',
  );
  assert.equal(
    (appSrc.match(/from '\.\/package-sales-tax\.js/g) || []).length,
    1,
    'one import line, no new import edge',
  );
});

// G2 — The tax row: untaxed, waived, old bill, invalid shapes.

test('Plan 592: untaxed bill and waived first month carry no tax row', () => {
  const untaxedBill = { month: '2026-11' };
  const waivedBill = { month: '2026-11', salesTaxCents: 19500, firstMonthWaivedAmount: 1000 };
  for (const bill of [untaxedBill, waivedBill]) {
    const card = buildProfilePrintCardHtml({
      ...fullFixture(),
      salesTaxCents: salesTaxReceiptLine(bill)?.taxCents ?? null,
      salesTaxLabel: SALES_TAX_RECEIPT_LABEL,
    }, format);
    assert.ok(card);
    assert.equal(rowLabels(card).length, 7, 'no tax row on an untaxed or waived bill');
    assert.ok(!card.includes('Sales tax'), 'an untaxed card shows no tax row');
  }
});

test('Plan 592: an old bill keeps its own tax figure — 29250c renders PKR 292.50 via formatPKR', () => {
  const oldBill = { month: '2026-10', salesTaxCents: 29250 };
  const card = buildProfilePrintCardHtml({
    ...fullFixture(),
    packagePrice: 1500,
    salesTaxCents: salesTaxReceiptLine(oldBill)?.taxCents ?? null,
    salesTaxLabel: SALES_TAX_RECEIPT_LABEL,
  }, formatPKR);
  assert.ok(card);
  // Exact-cell match, not includes: 'PKR 292.50' contains 'PKR 292.5'
  // as a substring, and the receipts pin the two-decimal form.
  assert.equal(rowValue(card, SALES_TAX_RECEIPT_LABEL), 'PKR 292.50', 'never PKR 292.5 on this card');
  assert.equal(rowValue(card, 'Package'), '15 Mbps · PKR 1,500/month');
});

test('Plan 592: 0, negative, string, float, NaN and missing tax never render a row', () => {
  for (const salesTaxCents of [0, -100, '19500', 195.5, Number.NaN, null, undefined]) {
    const card = buildProfilePrintCardHtml({
      ...fullFixture(), salesTaxCents, salesTaxLabel: SALES_TAX_RECEIPT_LABEL,
    }, format);
    assert.ok(card);
    assert.ok(!card.includes('Sales tax'), `salesTaxCents ${String(salesTaxCents)} must not render a row`);
    assert.equal(rowLabels(card).length, 7);
  }
});

// G3 — The zone: the decided separator, filtered empties.

test('Plan 592: mohalla + zone join with the card separator — Charyaa · Side 1', () => {
  const card = buildProfilePrintCardHtml(fullFixture(), format);
  assert.equal(rowValue(card, 'Mohalla'), 'Charyaa · Side 1');
  // The rejected separator is named, not silently dropped: the
  // receipts join with ', ' and the view shows separate rows, so
  // neither surface matches ' · ' — the acceptance's literal wins.
  assert.ok(!card.includes('Charyaa, Side 1'), "the receipt separator ', ' is not used on this card");
});

test('Plan 592: zone join filters empties — zone alone, mohalla alone, neither reads Not set', () => {
  const zoneOnly = buildProfilePrintCardHtml({ ...fullFixture(), mohalla: '' }, format);
  assert.equal(rowValue(zoneOnly, 'Mohalla'), 'Side 1', 'no leading separator when the mohalla is missing');
  const mohallaOnly = buildProfilePrintCardHtml({ ...fullFixture(), zone: '' }, format);
  assert.equal(rowValue(mohallaOnly, 'Mohalla'), 'Charyaa', 'exactly as today — no trailing separator');
  const neither = buildProfilePrintCardHtml({
    ...fullFixture(), knownAs: '', mohalla: '', zone: '', contactNumber: '',
  }, format);
  assert.equal(rowValue(neither, 'Mohalla'), 'Not set');
  assert.equal((neither.match(/Not set/g) || []).length, 3, 'one Not set per missing field — the plan362 exactly-3 pin holds');
});

// G4 — The human date: footer display, ISO fallback, refusal, last payment.

test('Plan 592: footer reads the human date when the caller passes the display string', () => {
  const human = humanDateShape('2026-11-06');
  assert.notEqual(human, '2026-11-06', 'the display form is not the ISO form');
  assert.ok(human.includes('2026'), 'the human date carries the year');
  const card = buildProfilePrintCardHtml({ ...fullFixture(), printDateDisplay: human }, format);
  assert.ok(card);
  assert.ok(card.includes(`Printed on ${human}`), 'the footer reads as a human date');
  assert.ok(!card.includes('Printed on 2026-11-06'), 'the ISO date never shows once a display string is passed');
});

test('Plan 592: no display string falls back to the ISO print date', () => {
  const card = buildProfilePrintCardHtml(fullFixture(), format);
  assert.ok(card.includes('Printed on 2026-11-06'), 'the plan362 footer pins hold under the fallback');
});

test('Plan 592: a bad ISO print date still refuses the card even with a display string', () => {
  assert.equal(
    buildProfilePrintCardHtml({ ...fullFixture(), printDate: '2026-02-30', printDateDisplay: 'Feb 30, 2026' }, format),
    null,
    'the refusal rule keys to the ISO field alone',
  );
});

test('Plan 592: the last-payment line keeps its raw ISO date — footer only', () => {
  const card = buildProfilePrintCardHtml({
    ...fullFixture(), printDateDisplay: humanDateShape('2026-11-06'),
  }, format);
  assert.ok(card);
  assert.ok(card.includes('2026-10-05'), 'the last payment still reads its raw ISO date');
  assert.ok(card.includes('PKR 1000 · 2026-10-05'), 'the last-payment line is unchanged');
});

// G5 — Guards + completeness: purity, hex, parity, unchanged pins.

test('Plan 592: module stays pure and reuses only the two print-card colours', () => {
  assert.ok(!moduleSrc.includes('import '), 'the module never imports — the date and label arrive via caller params');
  assert.ok(!moduleSrc.includes('new Date('));
  const hexes = new Set(moduleSrc.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  for (const hex of hexes) {
    assert.ok(hex === '#111' || hex === '#444', `new hex colour ${hex} must not appear`);
  }
});

test('Plan 592: parity does not move — 592 adds no i18n key', () => {
  // The count is read off THIS base (the H5 merge): 4,906/4,906.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4906);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4906);
});

test('Plan 592: the plan502 wording on the card is unchanged', () => {
  const card = buildProfilePrintCardHtml({
    ...fullFixture(),
    customerName: '', knownAs: '', mohalla: '', zone: '', contactNumber: '',
  }, format);
  assert.ok(card);
  // Five, not four: the name reads "Not set" twice — once in the
  // page <title> and once in the card heading — plus known-as,
  // mohalla and contact number once each.
  assert.equal((card.match(/Not set/g) || []).length, 5, 'one Not set per missing field, name twice (title + heading)');
  const noDues = buildProfilePrintCardHtml({ ...fullFixture(), outstanding: null }, format);
  assert.ok(noDues.includes('Not recorded'), 'dues with no record behind them stay Not recorded');
  const noPayment = buildProfilePrintCardHtml({ ...fullFixture(), lastPayment: null, handlingNote: '' }, format);
  assert.ok(noPayment.includes('No payment yet'));
  assert.ok(noPayment.includes('No handling note recorded'));
});
