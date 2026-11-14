// Unpaid Cards (user spec 2026-11-12 ~13:38 PKT, parts (1)–(4)):
// (1) a green Clear dues button on each card under the "Unpaid This
// Month" pill, running the profile's own clearDues machinery;
// (2) a Recent receipts finder on the Transactions screen — search
// by name, phone, or customer ID, reopen (print) or re-send
// (WhatsApp text / PNG screenshot); (3) card colours — Actually
// received green, Time with ISP blue, Outstanding red in the Due
// badge style, + Additional green with black bold text, health by
// score band; (4) the ID pill cycles colours by customer number and
// the header badge reads "[#N]" (the old "Customer N" pill was
// retired by the Customers Cards Compact item — the badge keeps the
// rotation).
//
// Fixtures are generic placeholders only ("Customer A", pattern-fake
// phone 03012345678 family) — no real customer data from any
// screenshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { customerIdPillClass, healthScoreBandClass, CUSTOMER_ID_PILL_CLASS_COUNT } from '../customer-card-style.js';
import { normalizeReceiptFinderQuery, receiptFinderMatches, findReceipts, RECEIPT_FINDER_MIN_CHARS, RECEIPT_FINDER_RECENT_LIMIT, RECEIPT_FINDER_SEARCH_LIMIT } from '../receipt-finder.js';
import { generateReceiptNumber } from '../receipt.js';
import { TRANSLATIONS } from '../nav-language.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFileSync(path.join(__dirname, '..', file), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const components = read('components.css');
const html = read('index.html');

// --- (4) ID pill rotation -------------------------------------------

test('unpaid cards: ID pill cycles colours by customer number (1 black, 2 yellow, 3 green, then the rest)', () => {
  assert.equal(CUSTOMER_ID_PILL_CLASS_COUNT, 8);
  assert.equal(customerIdPillClass(1), 'customer-id-pill-0');
  assert.equal(customerIdPillClass(2), 'customer-id-pill-1');
  assert.equal(customerIdPillClass(3), 'customer-id-pill-2');
  assert.equal(customerIdPillClass(4), 'customer-id-pill-3');
  assert.equal(customerIdPillClass(5), 'customer-id-pill-4');
  assert.equal(customerIdPillClass(6), 'customer-id-pill-5');
  assert.equal(customerIdPillClass(7), 'customer-id-pill-6');
  assert.equal(customerIdPillClass(8), 'customer-id-pill-7');
  assert.equal(customerIdPillClass(9), 'customer-id-pill-0', 'rotation wraps back to black');
  assert.equal(customerIdPillClass(16), 'customer-id-pill-7');
  assert.equal(customerIdPillClass(17), 'customer-id-pill-0');
  assert.equal(customerIdPillClass('25'), 'customer-id-pill-0', 'a numeric string counts the same');
  assert.equal(customerIdPillClass(0), '', 'no number, no class');
  assert.equal(customerIdPillClass(-3), '', 'negative is not a customer number');
  assert.equal(customerIdPillClass(undefined), '');
  assert.equal(customerIdPillClass(null), '');
  assert.equal(customerIdPillClass('abc'), '');
});

test('unpaid cards: header badge reads "[#N]" — the Customer N pill is retired', () => {
  // Customers Cards Compact retired the `Customer N` pill (and its key):
  // the header badge is [#N] with the same ID-pill rotation. The "#"
  // lives inside the badge now — the old no-"#" wording is gone with
  // the pill, not restyled.
  assert.equal(TRANSLATIONS.en.cust_card_customer_number, undefined, 'Customer N key deleted from the English dict');
  assert.equal(TRANSLATIONS.ur.cust_card_customer_number, undefined, 'Customer N key deleted from the Urdu dict');
  assert.ok(app.includes('#${escapeHtml(String(customer.customerNumber))}'), 'header badge renders [#N]');
});

test('unpaid cards: pill rotation classes exist in CSS with the documented colours, no new hex', () => {
  const expected = [
    ['.customer-id-pill-0', '#000', '#fff'],
    ['.customer-id-pill-1', '#fef3c7', '#704600'],
    ['.customer-id-pill-2', '#dcfce7', '#145b38'],
    ['.customer-id-pill-3', '#e5efff', '#174b87'],
    ['.customer-id-pill-4', '#334155', '#fff'],
    ['.customer-id-pill-5', '#fee2e2', '#b91c1c'],
    ['.customer-id-pill-6', '#e7f2ec', '#0e5b4d'],
    ['.customer-id-pill-7', '#fff0e8', '#8a2b12']
  ];
  for (const [cls, bg, color] of expected) {
    const rule = new RegExp(`${cls.replace(/\./g, '\\.')} \\{[^}]*background: ${bg.replace('#', '\\#')};[^}]*color: ${color.replace('#', '\\#')};`, 's');
    assert.match(styles, rule, `${cls} is ${bg} / ${color}`);
  }
  assert.ok(app.includes('customerIdPillClass(customer.customerNumber)'), 'card uses the pill helper');
});

// --- (3) health score bands ------------------------------------------

test('unpaid cards: health value is coloured by score band (70+ green, 40–70 yellow, below 40 red)', () => {
  assert.equal(healthScoreBandClass(100), 'health-score-high');
  assert.equal(healthScoreBandClass(70), 'health-score-high');
  assert.equal(healthScoreBandClass(69), 'health-score-mid');
  assert.equal(healthScoreBandClass(40), 'health-score-mid');
  assert.equal(healthScoreBandClass(39), 'health-score-low');
  assert.equal(healthScoreBandClass(0), 'health-score-low');
  assert.equal(healthScoreBandClass(null), '', 'no score, no band colour');
  assert.equal(healthScoreBandClass(undefined), '');
  assert.equal(healthScoreBandClass('abc'), '');
  assert.ok(app.includes('healthScoreBandClass(health?.score)'), 'card uses the band helper');
  assert.match(styles, /\.health-score-high \{[^}]*background: #e8f5ed;[^}]*color: #19704e;/s, 'high band reuses the health-good palette');
  assert.match(styles, /\.health-score-mid \{[^}]*background: #fff5df;[^}]*color: #9a5e06;/s, 'mid band reuses the health-risk palette');
  assert.match(styles, /\.health-score-low \{[^}]*background: #ffebea;[^}]*color: #a3342d;/s, 'low band reuses the health-critical palette');
});

// --- (3) card colours --------------------------------------------------

test('unpaid cards: lifetime + tenure pills are coloured — Lifetime green, tenure blue', () => {
  // Customers Cards Compact replaced the two stat boxes with TWO
  // condensed pills in one row, keeping the same palettes (the
  // health-good green for Lifetime, the status-partial blue for
  // tenure). The pill rules use the border shorthand, not
  // border-color — the regexes below match the shorthand.
  assert.ok(app.includes('customer-card-lifetime-pill'), 'lifetime pill carries its class');
  assert.ok(app.includes('customer-card-tenure-pill'), 'tenure pill carries its class');
  assert.match(styles, /\.customer-card-lifetime-pill \{[^}]*border: 1px solid #a8d6ba;[^}]*background: #e8f5ed;[^}]*color: #19704e;/s, 'lifetime pill is the health-good green');
  assert.match(styles, /\.customer-card-tenure-pill \{[^}]*border: 1px solid #adc9f1;[^}]*background: #e5efff;[^}]*color: #174b87;/s, 'tenure pill is the status-partial blue');
});

test('unpaid cards: Outstanding amount uses the Due badge style, + Additional is green with black bold text', () => {
  assert.ok(app.includes('<span class="customer-billing-badge status-pending">${escapeHtml(formatAmount(outstanding.total))}</span>'), 'outstanding amount is a Due badge');
  assert.match(components, /\.additional-pending-btn \{[^}]*background: var\(--ds-success-bg\);[^}]*color: var\(--ink\);[^}]*font-weight: 800;/s, '+ Additional is green with black bold text (tokens only — components.css stays hex-free)');
});

// --- (1) card Clear dues button ----------------------------------------

test('unpaid cards: card Clear dues sits in the header pill seat, where the Due badge sits', () => {
  // Customers Cards Compact (D-B1): the Payment label is dropped, so
  // the header pill IS the payment state — Clear dues moves into the
  // header pill's seat, replacing the Due badge under the "Unpaid This
  // Month" pill. It is a <span role="button">, not a <button>: a real
  // button cannot nest inside the whole-card <button>.
  assert.ok(app.includes("customerRosterPill === 'unpaid'"), 'button is gated on the unpaid pill');
  assert.ok(app.includes("billing.value === 'pending'"), 'button is gated on the Due state');
  assert.ok(app.includes('data-clear-dues-card="${escapeHtml(customer.id)}"'), 'button carries the customer id');
  assert.ok(app.includes('class="customer-card-clear-dues" role="button"'), 'Clear-dues is a span with the button role, in the header seat');
  assert.ok(app.includes("t('prof_action_clear_dues')"), 'button reuses the profile Clear dues label');
  assert.match(styles, /\.customer-card-clear-dues \{[^}]*background: var\(--green\);[^}]*color: #fff;[^}]*font-weight: 800;/s, 'button is green like the profile Clear dues button');
  assert.ok(app.includes("list.querySelectorAll('[data-clear-dues-card]')"), 'renderCustomers wires the button');
  assert.ok(app.includes('event.stopPropagation(); clearCustomerDues(button.dataset.clearDuesCard, { button })'), 'tap stops propagation and clears for that customer');
  assert.ok(app.includes("event.key !== 'Enter' && event.key !== ' '"), 'the span also takes the keyboard half of the button contract');
});

test('unpaid cards: card clear reuses the profile clearDues machinery — one collection path, two buttons', () => {
  assert.ok(app.includes('async function clearCustomerDues(customerId, { button = null } = {})'), 'shared clear helper exists');
  assert.ok(app.includes('return clearCustomerDues(customer.id, { button: $(\'#clearDuesButton\') })'), 'profile clearDues delegates to it');
  assert.ok(app.includes('getCustomerPaymentDefaults(state, customer.id, new Date(), tickets)'), 'payableTotal comes from the same defaults');
  assert.ok(app.includes('buildClearDuesConfirm(defaults,'), 'same confirm dialog with the breakdown');
  assert.ok(app.includes('requiresLargeCashApproval(true, Math.round(payableTotal * 100), LARGE_CASH_DEFAULT_THRESHOLD_CENTS)'), 'same large-cash approval over PKR 10,000');
  assert.ok(app.includes('findRecentDuplicate(state, { customerId: customer.id, amount: payableTotal, method: \'Cash\' })'), 'same 5-minute duplicate detector');
  assert.ok(app.includes('executeQuickCollection(state, {'), 'same executeQuickCollection record');
  assert.ok(app.includes('doubleTapSaveGuardTryStart(clearDuesSaveGuard, guardKey)'), 'same Plan 437 double-submit guard');
  // After a clear the list, the dashboard and (when open) the profile
  // all refresh, so the card leaves the unpaid list and the
  // dashboard shows paid without a navigation round-trip.
  assert.ok(app.includes('renderCustomers();\n    renderDashboard();'), 'clear refreshes the roster and the dashboard');
});

// --- (2) Recent receipts finder -----------------------------------------

const finderEntry = (overrides = {}) => ({
  paymentId: 'pay-1',
  customerId: 'cust-25',
  customerNumber: 25,
  customerName: 'Customer A',
  customerPhone: '03012345678',
  paidBy: '',
  amount: 1000,
  method: 'Cash',
  date: '2026-11-10',
  recordedAt: '10:00',
  month: '2026-11',
  receiptNumber: 'RCPT-25-202611-01',
  ...overrides
});

test('unpaid cards: finder search goes live at two characters (a 2-digit customer number is a full ID)', () => {
  assert.equal(RECEIPT_FINDER_MIN_CHARS, 2);
  assert.deepEqual(normalizeReceiptFinderQuery(''), { query: '', active: false });
  assert.deepEqual(normalizeReceiptFinderQuery('2'), { query: '', active: false });
  assert.deepEqual(normalizeReceiptFinderQuery('25'), { query: '25', active: true });
  assert.deepEqual(normalizeReceiptFinderQuery('  Ali  '), { query: 'Ali', active: true });
  assert.deepEqual(normalizeReceiptFinderQuery(null), { query: '', active: false });
});

test('unpaid cards: finder matches by name, phone, customer number, customer ID, and receipt number', () => {
  const entry = finderEntry();
  assert.ok(receiptFinderMatches(entry, 'Customer A'), 'name fragment');
  assert.ok(receiptFinderMatches(entry, 'customer a'), 'name is case-insensitive');
  assert.ok(receiptFinderMatches(entry, '5678'), 'phone digits');
  assert.ok(receiptFinderMatches(entry, '0301-234'), 'phone with dashes');
  assert.ok(receiptFinderMatches(entry, '25'), 'customer number');
  assert.ok(receiptFinderMatches(entry, '#25'), 'customer number with #');
  assert.ok(receiptFinderMatches(entry, 'cust-25'), 'stored customer ID');
  assert.ok(receiptFinderMatches(entry, 'RCPT-25'), 'receipt number fragment');
  assert.ok(!receiptFinderMatches(entry, 'zzz'), 'no match');
  assert.ok(!receiptFinderMatches(entry, '99'), 'a different number does not match');
  assert.ok(receiptFinderMatches(entry, ''), 'inactive search matches everything');
  assert.ok(!receiptFinderMatches(null, '25'), 'no entry, no match');
});

test('unpaid cards: finder matches a derived receipt number exactly, like the ledger search', () => {
  const entry = finderEntry({ receiptNumber: '', paymentId: 'pay-1', date: '2026-11-10', month: '2026-11' });
  const derived = generateReceiptNumber({ customerNumber: 25, paymentDate: '2026-11-10', paymentId: 'pay-1', billMonth: '2026-11' });
  assert.ok(receiptFinderMatches(entry, derived, { deriveReceiptNumber: generateReceiptNumber }), 'full derived number matches');
  assert.ok(!receiptFinderMatches(entry, 'REC-2611', { deriveReceiptNumber: generateReceiptNumber }), 'a derived prefix does not match (exact, like the ledger search)');
});

test('unpaid cards: finder shows the most recent receipts blank, and caps search results newest first', () => {
  const entries = [
    finderEntry({ paymentId: 'pay-1', date: '2026-11-08', recordedAt: '09:00' }),
    finderEntry({ paymentId: 'pay-2', date: '2026-11-10', recordedAt: '11:00' }),
    finderEntry({ paymentId: 'pay-3', date: '2026-11-10', recordedAt: '09:00' }),
    finderEntry({ paymentId: 'pay-4', customerName: 'Customer B', customerNumber: 26, customerId: 'cust-26', receiptNumber: 'RCPT-26-202611-01', date: '2026-11-09' })
  ];
  const recent = findReceipts(entries, '');
  assert.equal(recent.mode, 'recent');
  assert.deepEqual(recent.rows.map(row => row.paymentId), ['pay-2', 'pay-3', 'pay-4', 'pay-1'], 'newest first, same-day by recorded time');
  assert.equal(recent.total, 4);
  const searched = findReceipts(entries, 'Customer A');
  assert.equal(searched.mode, 'search');
  assert.equal(searched.total, 3);
  assert.deepEqual(searched.rows.map(row => row.paymentId), ['pay-2', 'pay-3', 'pay-1']);
  const capped = findReceipts(Array.from({ length: 25 }, (_, i) => finderEntry({ paymentId: `pay-${i}`, date: '2026-11-10', recordedAt: `10:${String(i).padStart(2, '0')}` })), 'Customer A', { searchLimit: 3 });
  assert.equal(capped.rows.length, 3, 'search results are capped');
  assert.equal(capped.total, 25, 'total still counts every match');
  const none = findReceipts(entries, 'zzz');
  assert.equal(none.mode, 'search');
  assert.equal(none.rows.length, 0);
  assert.equal(findReceipts([], '').rows.length, 0, 'empty ledger, empty finder');
  assert.equal(RECEIPT_FINDER_RECENT_LIMIT, 10);
  assert.equal(RECEIPT_FINDER_SEARCH_LIMIT, 20);
});

test('unpaid cards: finder panel exists on the Transactions screen and reuses the receipt actions', () => {
  // Transactions & Recent Receipts Polish §2: the finder search input
  // is deleted — the unified bar feeds the finder — so the input,
  // its translated placeholder attribute, and its listener pins are
  // replaced by pins on the unified input feeding the finder query.
  assert.ok(!html.includes('id="receiptFinderSearch"'), 'finder search input is deleted');
  assert.ok(html.includes('id="transactionLiveSearch"'), 'unified search bar feeds the finder');
  assert.ok(html.includes('id="receiptFinderResults"'), 'finder results list exists');
  assert.ok(html.includes('id="receiptFinderCount"'), 'finder count line exists');
  assert.ok(html.includes('id="receiptFinderShowMore"'), 'finder Show More button exists');
  assert.ok(app.includes("receiptFinderQuery = event.currentTarget.value;"), 'unified listener feeds the finder query');
  assert.ok(app.includes('function renderReceiptFinder(filteredList)'), 'finder render takes the filtered list');
  assert.ok(app.includes('function receiptFinderRowHtml(transaction, customerIndex)'), 'finder row builder exists');
  assert.ok(app.includes('renderReceiptFinder(transactions);'), 'finder renders with the filtered Transactions list');
  assert.ok(app.includes('receiptFinderQuery = \'\';'), 'clear-filters resets the finder');
  assert.ok(app.includes('data-receipt-finder-open'), 'finder rows reopen the receipt');
  assert.ok(app.includes("pngReceiptButtonMarkup(transaction.customerId, transaction.month, pid, transaction.customerNumber)"), 'finder rows re-send the PNG screenshot');
  assert.ok(app.includes("receiptWhatsAppActionMarkup(customer, { ...transaction,"), 'finder rows re-send the WhatsApp text');
  for (const key of ['receipt_finder_heading', 'receipt_finder_note', 'receipt_finder_search_placeholder', 'receipt_finder_search_aria', 'receipt_finder_recent', 'receipt_finder_match', 'receipt_finder_more', 'receipt_finder_none', 'receipt_finder_empty', 'receipt_finder_open', 'receipt_finder_show_more', 'receipt_finder_open_short', 'receipt_finder_whatsapp_short', 'receipt_finder_png_short']) {
    assert.ok(TRANSLATIONS.en[key], `English finder key exists: ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `Urdu finder key exists: ${key}`);
  }
});
