// Billing & Ledger redesign (2026-11-11) — presentation helpers +
// structural pins for the renderers. Pure-module behaviour is tested
// directly; app.js / index.html / styles.css are pinned by source
// text (the established CSS/contract style) because node has no DOM
// and no CSS engine — the harness measures the true computed layout
// at 360/480/320px and records the numbers in the PR body.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  paymentMethodGroup,
  paymentFormCrossPayerChosen,
  filterPaymentFormFieldsForMethod,
  historyOwedText,
  filteredHistorySummaryText,
  historyTypeLegendText,
  historyEntryShortRef,
  historyEntryRunningNoteText,
  historyEntryTypeClass,
} from '../billing-ledger-presentation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const index = read('index.html');
const styles = read('styles.css');
const components = read('components.css');
const language = read('nav-language.js');
const presentation = read('billing-ledger-presentation.js');

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-10-05', amountCents: 100000, runningBalanceCents: 0, method: 'Cash', ...overrides };
}

// --- Method groups (§3) ---

test('billing & ledger: Cash, blank and Other are the cash group; wallets and banks are digital', () => {
  assert.equal(paymentMethodGroup('Cash'), 'cash');
  assert.equal(paymentMethodGroup(''), 'cash');
  assert.equal(paymentMethodGroup(undefined), 'cash');
  assert.equal(paymentMethodGroup('Other'), 'cash');
  for (const method of ['JazzCash', 'Easypaisa', 'Nayapay', 'Bank Transfer', 'Raast', 'Online']) {
    assert.equal(paymentMethodGroup(method), 'digital', method);
  }
});

test('billing & ledger: a cross-payer is chosen only by a picked customer or a typed name', () => {
  assert.equal(paymentFormCrossPayerChosen({ payerCustomerId: 'CUST-9' }), true);
  assert.equal(paymentFormCrossPayerChosen({ payerName: 'Ali' }), true);
  assert.equal(paymentFormCrossPayerChosen({ payerCustomerId: '', payerName: '' }), false);
  assert.equal(paymentFormCrossPayerChosen({ payerName: '   ' }), false);
  assert.equal(paymentFormCrossPayerChosen({}), false);
  assert.equal(paymentFormCrossPayerChosen(null), false);
  assert.equal(paymentFormCrossPayerChosen(undefined), false);
});

test('billing & ledger: the submit filter drops the mismatched group and an unchosen cross-payer', () => {
  const input = {
    date: '2026-10-05', amount: 1000, method: 'Cash',
    paidBy: 'Ali', collectedBy: 'Saad', collectionPlace: 'field', collectionMohalla: 'Barrian',
    largeCashApproval: 'Owner', transactionId: 'TX1', senderTitle: 'Hamza',
    senderDigits: '3310', screenshot: 'proof.png',
    crossPayment: { payerName: '', payerCustomerId: '' },
    urduNote: 'نوٹ', categoryTag: 'collection',
  };
  const cash = filterPaymentFormFieldsForMethod('Cash', input);
  assert.equal(cash.paidBy, 'Ali');
  assert.equal(cash.collectedBy, 'Saad');
  assert.equal(cash.transactionId, undefined);
  assert.equal(cash.senderTitle, undefined);
  assert.equal(cash.senderDigits, undefined);
  assert.equal(cash.screenshot, undefined);
  assert.equal(cash.crossPayment, undefined);
  assert.equal(cash.urduNote, 'نوٹ');
  const digital = filterPaymentFormFieldsForMethod('JazzCash', input);
  assert.equal(digital.transactionId, 'TX1');
  assert.equal(digital.senderTitle, 'Hamza');
  assert.equal(digital.paidBy, undefined);
  assert.equal(digital.collectedBy, undefined);
  assert.equal(digital.collectionPlace, undefined);
  assert.equal(digital.collectionMohalla, undefined);
  assert.equal(digital.largeCashApproval, undefined);
  assert.equal(digital.crossPayment, undefined);
  // A chosen cross-payer survives on either method.
  const chosen = { ...input, crossPayment: { payerName: 'Ahmed' } };
  assert.deepEqual(filterPaymentFormFieldsForMethod('Cash', chosen).crossPayment, { payerName: 'Ahmed' });
  assert.deepEqual(filterPaymentFormFieldsForMethod('JazzCash', chosen).crossPayment, { payerName: 'Ahmed' });
  // The input object is never mutated.
  assert.equal(input.transactionId, 'TX1');
  assert.equal(input.paidBy, 'Ali');
  assert.deepEqual(input.crossPayment, { payerName: '', payerCustomerId: '' });
});

// --- Filtered summary + legend (§1.4/§1.5) ---

test('billing & ledger: the owed wording never prints a negative "Still owed"', () => {
  assert.equal(historyOwedText(50000), 'Still owed PKR 500');
  assert.equal(historyOwedText(0), 'Still owed PKR 0');
  assert.equal(historyOwedText(-100000), 'Credit PKR 1,000');
  // A non-finite figure reads as zero in the summary wording, never
  // as NaN on the screen.
  assert.equal(historyOwedText(NaN), 'Still owed PKR 0');
  assert.equal(historyOwedText(null), 'Still owed PKR 0');
});

test('billing & ledger: the filtered summary totals the shown rows only', () => {
  const shown = [
    entry({ type: 'charge', amountCents: 300000, runningBalanceCents: 300000, method: '' }),
    entry({ type: 'payment', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash' }),
    entry({ type: 'payment', amountCents: 50000, runningBalanceCents: 100000, method: 'JazzCash', voided: true }),
    entry({ type: 'advance', amountCents: 50000, runningBalanceCents: 50000, method: 'Easypaisa' }),
  ];
  // The voided payment moves nothing: paid is 150,000 + 50,000.
  assert.equal(
    filteredHistorySummaryText(shown),
    '4 entries · Billed PKR 3,000 · Paid PKR 2,000 · Still owed PKR 1,000',
  );
  assert.equal(
    filteredHistorySummaryText(shown.slice(0, 1)),
    '1 entry · Billed PKR 3,000 · Paid PKR 0 · Still owed PKR 3,000',
  );
  assert.equal(
    filteredHistorySummaryText([]),
    '0 entries · Billed PKR 0 · Paid PKR 0 · Still owed PKR 0',
  );
  assert.equal(
    filteredHistorySummaryText([entry({ type: 'charge', amountCents: 100000, method: '' }), entry({ type: 'payment', amountCents: 200000 })]),
    '2 entries · Billed PKR 1,000 · Paid PKR 2,000 · Credit PKR 1,000',
  );
});

test('billing & ledger: the legend counts all six types and appends the voided line only when > 0', () => {
  const shown = [
    entry({ type: 'charge', amountCents: 300000, method: '' }),
    entry({ type: 'payment', amountCents: 150000, method: 'Cash' }),
    entry({ type: 'payment', amountCents: 50000, method: 'JazzCash', voided: true }),
    entry({ type: 'advance', amountCents: 50000, method: 'Easypaisa' }),
  ];
  assert.equal(
    historyTypeLegendText(shown),
    'Charge 1 · Payment 2 · Advance 1 · Credit 0 · Refund 0 · Adjustment 0 · Voided: 1 — shown struck-through, moves nothing',
  );
  assert.equal(
    historyTypeLegendText([]),
    'Charge 0 · Payment 0 · Advance 0 · Credit 0 · Refund 0 · Adjustment 0',
  );
});

// --- Short reference + running note + type class (§2) ---

test('billing & ledger: a receipt-shaped ref prints whole, an internal id prints nothing', () => {
  assert.equal(historyEntryShortRef({ ref: 'RCPT-37-202611-01' }), 'RCPT-37-202611-01');
  assert.equal(historyEntryShortRef({ ref: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }), '');
  assert.equal(historyEntryShortRef({ ref: 'BILL-1' }), '');
  assert.equal(historyEntryShortRef({ ref: '' }), '');
  assert.equal(historyEntryShortRef({}), '');
  assert.equal(historyEntryShortRef(null), '');
});

test('billing & ledger: the running note is the entry\'s own settlement, never the final balance', () => {
  assert.equal(historyEntryRunningNoteText(entry({ runningBalanceCents: 250000 })), 'Still owed PKR 2,500');
  assert.equal(historyEntryRunningNoteText(entry({ runningBalanceCents: -100000 })), 'Credit PKR 1,000');
  assert.equal(historyEntryRunningNoteText(entry({ runningBalanceCents: 0 })), 'Settled');
});

test('billing & ledger: the type class follows the entry type; unknown reads as payment', () => {
  for (const type of ['charge', 'payment', 'advance', 'credit', 'refund', 'adjustment']) {
    assert.equal(historyEntryTypeClass(entry({ type })), `hist-type-${type}`, type);
  }
  assert.equal(historyEntryTypeClass(entry({ type: 'mystery' })), 'hist-type-payment');
  assert.equal(historyEntryTypeClass(entry({})), 'hist-type-payment');
  assert.equal(historyEntryTypeClass(null), 'hist-type-payment');
});

test('billing & ledger: the presentation module does no network work (offline-first)', () => {
  assert.doesNotMatch(presentation, /\bfetch\s*\(/);
  assert.doesNotMatch(presentation, /XMLHttpRequest/);
});

// --- Structural pins: index.html (§1.1/§1.3/§1.4/§1.5) ---

test('billing & ledger: the filter bar, Reset All Filters, summary and legend exist in the markup', () => {
  assert.ok(index.includes('id="fhlClearAllFilters"'), 'Reset All Filters button');
  assert.ok(index.includes('data-i18n="fhl_clear_all_filters"'), 'Reset All Filters i18n key');
  assert.ok(index.includes('id="fhlFilteredSummary"'), 'filtered summary line');
  assert.ok(index.includes('id="fhlHistoryLegend"'), 'type legend line');
  assert.ok(index.includes('<details class="fhl-advanced-filters">'), 'Advanced Filters disclosure');
  assert.ok(index.includes('data-i18n="fhl_advanced_filters"'), 'Advanced Filters i18n key');
  // Type and date-range stay visible above the bar; method, amount
  // and disputed ride inside the disclosure. The connection filter
  // stays visible too, after the bar — Plan 419 pins it after the
  // disputed host, and it is a view switch like type/date, so it is
  // not hidden inside Advanced Filters.
  const barAt = index.indexOf('class="fhl-filter-bar"');
  assert.ok(barAt > 0);
  for (const host of ['htfHistoryTypeFilterHost', 'hdrHistoryDateRangeHost']) {
    assert.ok(index.indexOf(host) > 0 && index.indexOf(host) < barAt, `${host} is above the filter bar`);
  }
  assert.ok(index.indexOf('hcfHistoryConnectionFilterHost') > index.indexOf('class="fhl-filter-bar"'), 'connection host is after the filter bar');
  assert.ok(index.indexOf('hcfHistoryConnectionFilterHost') > index.indexOf('hdfHistoryDisputedFlagHost'), 'connection host is after the disputed host (Plan 419)');
  assert.ok(index.indexOf('hcfHistoryConnectionFilterHost') < index.indexOf('id="fhlFullHistoryList"'), 'connection host is before the list');
  const detailsAt = index.indexOf('<details class="fhl-advanced-filters">');
  for (const host of ['hmfHistoryMethodFilterHost', 'amtHistoryAmountSearchHost', 'hdfHistoryDisputedFlagHost']) {
    assert.ok(index.indexOf(host) > detailsAt, `${host} is inside Advanced Filters`);
  }
});

// --- Structural pins: app.js renderFullHistory (§1.3/§1.4/§1.5/§1.6/§2/§6.5/§7.2) ---

test('billing & ledger: renderFullHistory resets filters on customer change', () => {
  assert.ok(app.includes('lastFullHistoryCustomerId'), 'remembers the last customer');
  assert.ok(app.includes("lastFullHistoryCustomerId !== undefined && lastFullHistoryCustomerId !== customer.id"), 'reset guard');
  assert.ok(app.includes("fullHistoryTypeFilter = 'all';"), 'type filter resets');
  assert.ok(app.includes("fullHistoryConnectionFilter = 'all';"), 'connection filter resets');
});

test('billing & ledger: Reset All Filters is wired once and disables while no filter is active', () => {
  assert.ok(app.includes("$('#fhlClearAllFilters')"), 'button looked up');
  assert.ok(app.includes("clearAllFiltersButton.dataset.wired"), 'wired once');
  assert.ok(app.includes("clearAllFiltersButton.disabled = !(fullHistoryTypeFilter !== 'all'"), 'disabled while unfiltered');
  assert.ok(app.includes("renderFullHistory(currentCustomer)"), 're-renders after clearing');
});

test('billing & ledger: the filtered summary and legend are written from the shown rows', () => {
  assert.ok(app.includes("filteredSummary.textContent = filteredHistorySummaryText(shown)"), 'summary from shown');
  assert.ok(app.includes("historyLegend.textContent = historyTypeLegendText(shown)"), 'legend from shown');
  assert.ok(app.includes("filteredSummary.hidden = entries.length === 0"), 'summary hidden on empty history');
});

test('billing & ledger: history rows get a type class, a prominent amount and a short Ref', () => {
  assert.ok(app.includes('row.classList.add(historyEntryTypeClass(entry))'), 'type class');
  assert.ok(app.includes('class="hist-amount"'), 'prominent amount span');
  assert.ok(app.includes("refSpan.className = 'hist-ref'"), 'short Ref span');
  assert.ok(app.includes('historyEntryShortRef(entry)'), 'short Ref from the helper');
});

test('billing & ledger: both history tables ride in a scroll card with a footer highlight', () => {
  assert.ok(app.includes('historyTableCardHtml(historyRunningBalanceColumnHtml(shown, entries)'), 'running-balance table wrapped');
  assert.ok(app.includes('historyTableCardHtml(historyMonthlyGroupingHtml(shown, entries)'), 'monthly table wrapped');
  assert.ok(app.includes('markHistoryTableFooter(balanceHost)'), 'balance footer marked');
  assert.ok(app.includes('markHistoryTableFooter(groupingHost)'), 'grouping footer marked');
});

test('billing & ledger: annotation options carry their entry\'s running note', () => {
  assert.ok(app.includes('historyEntryRunningNoteText(entry)'), 'running note on the option');
  assert.ok(app.includes("$('#heaHistoryEntryAnnotationEntry')"), 'entry select looked up');
});

// --- Structural pins: styles.css (§2/§3.1/§5.1/§6.5/§7) ---

test('billing & ledger: no month-forms 2-column override survives in styles.css', () => {
  assert.doesNotMatch(styles, /\.month-forms \.form-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test('billing & ledger: the redesign CSS block exists', () => {
  assert.ok(styles.includes('.form-grid .pay-optional-details'), 'optional details section');
  assert.ok(styles.includes('.fhl-filter-bar'), 'filter bar');
  assert.ok(styles.includes('#fhlFullHistoryList .payment-row.hist-type-charge'), 'type left border');
  assert.ok(styles.includes('#fhlFullHistoryList .hist-amount'), 'prominent amount');
  assert.ok(styles.includes('.receipt-more-actions summary'), 'More disclosure');
  assert.ok(styles.includes('.fhl-table-card'), 'table card');
  assert.ok(styles.includes('.hea-annotation-form { display: grid; grid-template-columns: 1fr 1fr;'), 'annotation card grid');
  assert.ok(styles.includes('.hea-annotation-form > button'), 'full-width Add Note button');
  assert.ok(styles.includes('.form-grid [hidden] { display: none !important; }'), 'hidden cells really hide');
});

// --- Structural pins: nav-language.js + components.css ---

test('billing & ledger: the three new keys exist in English and Urdu', () => {
  assert.ok(language.includes("fhl_clear_all_filters: 'Reset All Filters'"), 'EN Reset All Filters');
  assert.ok(language.includes("fhl_clear_all_filters: 'تمام فلٹرز صاف کریں'"), 'UR Reset All Filters');
  assert.ok(language.includes("fhl_advanced_filters: 'Advanced Filters'"), 'EN Advanced Filters');
  assert.ok(language.includes("fhl_advanced_filters: 'ایڈوانسڈ فلٹرز'"), 'UR Advanced Filters');
  assert.ok(language.includes("pay_optional_details: 'Optional & Third-Party Payer Details'"), 'EN optional details');
  assert.ok(language.includes("pay_optional_details: 'اختیاری اور تیسرے فریق کی ادائیگی کی تفصیلات'"), 'UR optional details');
});

test('billing & ledger: the TID placeholder is shortened in both languages', () => {
  // The old "(Raast / JazzCash / Easypaisa)" tail clipped 43.9px at
  // 360px in the Digital state; the label already says the field is
  // for digital payments.
  assert.ok(language.includes("prof_hist_pay_txn_ph: 'e.g. 1234567890'"), 'EN TID placeholder');
  assert.ok(language.includes("prof_hist_pay_txn_ph: 'مثلاً 1234567890'"), 'UR TID placeholder');
  assert.doesNotMatch(language, /Raast \/ JazzCash \/ Easypaisa/);
});

test('billing & ledger: the discount-reason placeholder is shortened in both languages', () => {
  // The old ", Outage credit" tail clipped 26.5px at 320px; the
  // label already says what the field is for.
  assert.ok(language.includes("prof_hist_pay_discount_reason_ph: 'e.g. Loyalty concession'"), 'EN discount-reason placeholder');
  assert.ok(language.includes("prof_hist_pay_discount_reason_ph: 'مثلاً وفاداری رعایت'"), 'UR discount-reason placeholder');
  assert.doesNotMatch(language, /Outage credit/);
});

test('billing & ledger: the long placeholders are shortened in both languages', () => {
  assert.doesNotMatch(language, /Leave blank if not specified/);
  assert.doesNotMatch(language, /اگر متعین نہ ہو تو خالی چھوڑیں/);
  assert.ok(language.includes("adv_paidby_ph: 'Leave blank'"), 'EN paid-by placeholder');
  assert.ok(language.includes("adv_paidby_ph: 'خالی چھوڑیں'"), 'UR paid-by placeholder');
});

test('billing & ledger: the components.css Plan D comment no longer claims 44px/16px inputs', () => {
  assert.doesNotMatch(components, /profile payment form-grid at one column with 44px\/16px inputs/);
  assert.ok(components.includes('the billing & ledger redesign'), 'comment names the redesign');
});
