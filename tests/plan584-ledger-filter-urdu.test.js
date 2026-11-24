// Plan 584 — the ledger filter row speaks Urdu too.
//
// The filter form #txAdvancedFilters (Collect tab) carried 13 labels,
// 24 static options, 5 placeholders and the long help paragraph with
// ZERO data-i18n attributes anywhere in it — in Urdu mode the whole
// row stayed English. The spec named the wrong range (:7617–7670 is
// the already-translated billing register in Reports) and claimed no
// keys existed; 7 strings already had byte-identical keys, and 8 of
// the 24 options are JS-rewritten on every render, so static wiring
// alone leaves them English (the sims prove B6 stays FAIL).
//
// What this file owns (the i18n wiring; behaviour stays with the
// plan460–467 files):
//   G1 — the 13 labels are span-wrapped, and switch to Urdu and back.
//   G2 — the 16 static options carry data-i18n; option VALUES are the
//        filter contract and are byte-identical to the base list.
//   G3 — the help paragraph + the 5 placeholders, in both languages.
//   G4 — the JS-owned options: category / collector / book compose
//        through t() at the three app.js rewrite sites, label + count.
//   G5 — guards + completeness: parity 4,707/4,707, every referenced
//        ledger_filter_* key exists in both dicts, PKR-only, and the
//        category-tag module stays import-free.
//
// Synthetic data only: the filter row's own strings, read off
// index.html at test time — no customer names, no phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS, t, updateDocumentTranslations } from '../nav-language.js';

const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const tagModuleSource = readFileSync(new URL('../transaction-category-tag.js', import.meta.url), 'utf8');

// The filter form only — everything below is scoped to this slice, so
// a data-i18n elsewhere in the page can never satisfy these pins.
const formSource = indexSource.slice(
  indexSource.indexOf('id="txAdvancedFilters"'),
  indexSource.indexOf('id="transactionsList"'),
);

// The 13 labels, keyed by the control they name. 10 take new
// ledger_filter_* keys; 3 reuse byte-identical keys (Payment method /
// Bill month / Sort by).
const LABEL_KEYS = {
  transactionRefineSearch: 'ledger_filter_refine_label',
  transactionReferenceSearch: 'ledger_filter_reference_label',
  transactionRecencyFilter: 'ledger_filter_recency_label',
  transactionMethodFilter: 'adv_method_label',
  transactionCategoryFilter: 'ledger_filter_category_label',
  transactionCollectorFilter: 'ledger_filter_collector_label',
  transactionReceiptBookFilter: 'ledger_filter_book_label',
  transactionDateFilter: 'ledger_filter_date_label',
  transactionBillMonth: 'bvouch_month_label',
  transactionAmountMin: 'ledger_filter_amount_min_label',
  transactionAmountMax: 'ledger_filter_amount_max_label',
  transactionSortSelect: 'qc2_sort_label',
  rnsReceiptInput: 'ledger_filter_receipt_label',
};

// The 16 static options (recency 4 + method 7 + sort 5) and their keys.
// The other 8 options are JS-owned: the category rewrite, the
// collector rebuild and the book rebuild (G4) — they carry no
// data-i18n in the static markup, by design (D8(c)/T3).
const STATIC_OPTION_KEYS = {
  'All history': 'ledger_filter_recency_all',
  'Last 7 days': 'ledger_filter_recency_7',
  'Last 30 days': 'ledger_filter_recency_30',
  'Last 90 days': 'ledger_filter_recency_90',
  'All methods': 'ledger_filter_method_all',
  Cash: 'bill_method_cash',
  EasyPaisa: 'ledger_filter_method_easypaisa',
  JazzCash: 'bill_method_jazzcash',
  NayaPay: 'ledger_filter_method_nayapay',
  'Bank Transfer': 'ledger_filter_method_bank_transfer',
  Other: 'bill_method_other',
  'Date (Newest first)': 'ledger_filter_sort_date_desc',
  'Date (Oldest first)': 'ledger_filter_sort_date_asc',
  'Amount (Highest first)': 'ledger_filter_sort_amount_desc',
  'Amount (Lowest first)': 'ledger_filter_sort_amount_asc',
  'Customer # (Ascending)': 'ledger_filter_sort_number_asc',
};

// The 5 placeholders and their keys.
const PLACEHOLDER_KEYS = {
  transactionRefineSearch: 'ledger_filter_refine_ph',
  transactionReferenceSearch: 'ledger_filter_reference_ph',
  transactionAmountMin: 'ledger_filter_amount_min_ph',
  transactionAmountMax: 'ledger_filter_amount_max_ph',
  rnsReceiptInput: 'ledger_filter_receipt_ph',
};

// The 24 option values, in form order — the filter contract. 21 are
// distinct: 'all' repeats (recency / method / category) and '' repeats
// (collector / book). 'Other' (method) vs 'other' (category) are
// distinct filter values and must stay exactly as they are.
const OPTION_VALUES = [
  'all', '7', '30', '90',
  'all', 'Cash', 'EasyPaisa', 'JazzCash', 'NayaPay', 'Bank Transfer', 'Other',
  'all', 'collection', 'advance', 'refund', 'adjustment', 'other',
  '', '',
  'date-desc', 'date-asc', 'amount-desc', 'amount-asc', 'number-asc',
];

// Minimal stand-in for a DOM element (the polish20 pattern): the
// applier only reads getAttribute / hasAttribute / textContent and
// writes textContent or setAttribute.
class StubEl {
  constructor(attrs = {}, text = '') {
    this._attrs = { ...attrs };
    this._textContent = text;
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  getAttribute(name) {
    return this._attrs[name] ?? null;
  }

  setAttribute(name, value) {
    this._attrs[name] = String(value);
  }

  hasAttribute(name) {
    return name in this._attrs;
  }

  querySelectorAll() {
    return [...this.children];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

// The applier's later sections (bottom nav, drawer, QC titles) look up
// elements by id/class; returning null/[] for everything skips them,
// which is exactly what a container without those surfaces does.
function mockContainer({ text = [], placeholder = [] } = {}) {
  return {
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return text;
      if (selector === '[data-i18n-placeholder]') return placeholder;
      return [];
    },
    querySelector() {
      return null;
    },
  };
}

function labelMatches() {
  return [...formSource.matchAll(/<label for="([^"]+)">([\s\S]*?)<\/label>/g)];
}

// ---- G1 — Labels ----

test('Plan 584 G1: all 13 labels are span-wrapped — never data-i18n on the <label> itself', () => {
  const labels = labelMatches();
  assert.equal(labels.length, 13, 'the form has exactly 13 labels');
  for (const [, forId, inner] of labels) {
    const span = inner.match(/<span data-i18n="([^"]+)">([^<]*)<\/span>/);
    assert.ok(span, `${forId}: label text is wrapped in a <span data-i18n>`);
    assert.equal(span[1], LABEL_KEYS[forId], `${forId}: span carries the expected key`);
    assert.ok(
      inner.includes('<input') || inner.includes('<select'),
      `${forId}: the label still contains its input/select (the span-wrap must not delete the control)`,
    );
  }
  // And no <label> tag in the form carries data-i18n at all.
  assert.doesNotMatch(formSource, /<label[^>]*data-i18n=/);
});

test('Plan 584 G1: every label key exists in both dicts with non-empty values', () => {
  for (const [forId, key] of Object.entries(LABEL_KEYS)) {
    assert.ok(TRANSLATIONS.en[key], `${forId}: ${key} exists in EN`);
    assert.ok(TRANSLATIONS.ur[key], `${forId}: ${key} exists in UR`);
    assert.notEqual(TRANSLATIONS.en[key], key, `${key}: EN is a translation, not the raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `${key}: UR is a translation, not the raw key`);
  }
  // The reused keys really are the filter strings, byte-identical.
  assert.equal(TRANSLATIONS.en.adv_method_label, 'Payment method');
  assert.equal(TRANSLATIONS.en.bvouch_month_label, 'Bill month');
  assert.equal(TRANSLATIONS.en.qc2_sort_label, 'Sort by');
});

test('Plan 584 G1: switching to Urdu replaces the label spans, switching back restores English', () => {
  const spans = Object.entries(LABEL_KEYS).map(([forId, key]) => (
    new StubEl({ 'data-i18n': key }, TRANSLATIONS.en[key])
  ));
  updateDocumentTranslations('ur', mockContainer({ text: spans }));
  for (const [i, [, key]] of Object.entries(LABEL_KEYS).entries()) {
    assert.equal(spans[i].textContent, TRANSLATIONS.ur[key], `${key}: Urdu text applied`);
  }
  // A reused key switches too — 'Payment method' becomes 'ادائیگی کا طریقہ'.
  assert.equal(spans[3].textContent, 'ادائیگی کا طریقہ');
  updateDocumentTranslations('en', mockContainer({ text: spans }));
  for (const [i, [, key]] of Object.entries(LABEL_KEYS).entries()) {
    assert.equal(spans[i].textContent, TRANSLATIONS.en[key], `${key}: English text restored`);
  }
});

test("Plan 584 G1: 'EasyPaisa' keeps its spelling — the new key, not bill_method_easypaisa", () => {
  // D2(b) trap: bill_method_easypaisa reads 'Easypaisa'; the option
  // (and the stored value) spells it 'EasyPaisa'. Reusing it would
  // silently change the shipped English label.
  assert.equal(TRANSLATIONS.en.bill_method_easypaisa, 'Easypaisa');
  assert.equal(TRANSLATIONS.en.ledger_filter_method_easypaisa, 'EasyPaisa');
  assert.ok(formSource.includes('<option value="EasyPaisa" data-i18n="ledger_filter_method_easypaisa">EasyPaisa</option>'));
});

// ---- G2 — Static options ----

test('Plan 584 G2: all 16 static options carry data-i18n with keys in both dicts', () => {
  const options = [...formSource.matchAll(/<option [^>]*data-i18n="([^"]+)"[^>]*>([^<]*)<\/option>/g)];
  assert.equal(options.length, 16, 'exactly 16 static options are wired');
  for (const [, key, text] of options) {
    assert.equal(STATIC_OPTION_KEYS[text], key, `"${text}": wired with its expected key`);
    assert.ok(TRANSLATIONS.en[key], `${key} exists in EN`);
    assert.ok(TRANSLATIONS.ur[key], `${key} exists in UR`);
    // The static text is the EN value byte-identical, so English mode
    // is a visual no-op for these options.
    assert.equal(TRANSLATIONS.en[key], text, `${key}: EN value matches the static text`);
  }
});

test('Plan 584 G2: option VALUES are byte-identical to the base list (the filter contract)', () => {
  const values = [...formSource.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(values, OPTION_VALUES, '24 option values in form order, none changed');
  assert.equal(new Set(values).size, 21, '21 distinct values');
  // 'Other' vs 'other' are distinct filter values — the casing is the contract.
  assert.ok(values.includes('Other'), 'method Other (capital O)');
  assert.ok(values.includes('other'), 'category other (lowercase o)');
});

test('Plan 584 G2: the JS-owned first options carry NO data-i18n in the static markup', () => {
  // D8(c)/T3: the category/collector/book first options are rewritten
  // by renderTransactions on every render, so a static attr would be
  // dead code on arrival — and on the category option it would break
  // the plan398:403 pin, which asserts the exact static string.
  assert.ok(formSource.includes('<option value="all" selected>All categories</option>'));
  assert.ok(formSource.includes('<option value="" selected>All collectors</option>'));
  assert.ok(formSource.includes('<option value="" selected>All receipt books</option>'));
  // The remaining 5 category options are JS-owned too (no attrs).
  for (const value of ['collection', 'advance', 'refund', 'adjustment', 'other']) {
    assert.doesNotMatch(formSource, new RegExp(`<option value="${value}" data-i18n=`));
  }
});

// ---- G3 — Help + placeholders ----

test('Plan 584 G3: the help paragraph is fully wired, EN byte-identical to the <p> text', () => {
  assert.ok(formSource.includes('<p id="transactionFilterHelp" class="transaction-filter-help" data-i18n="ledger_filter_help">'));
  const pText = formSource.match(/<p id="transactionFilterHelp"[^>]*>([\s\S]*?)<\/p>/)[1];
  assert.equal(TRANSLATIONS.en.ledger_filter_help, pText, 'EN value is the full paragraph, byte-identical');
  assert.ok(TRANSLATIONS.en.ledger_filter_help.length > 1000, 'the whole paragraph, not a summary');
  const ur = TRANSLATIONS.ur.ledger_filter_help;
  assert.ok(ur.length > 1000, 'the UR translation covers the whole paragraph');
  assert.notEqual(ur, TRANSLATIONS.en.ledger_filter_help, 'UR differs from EN');
  assert.ok(ur.endsWith('۔'), 'UR paragraph ends with a Urdu full stop');
  assert.doesNotMatch(ur, /Customer search|receipt number|Pakistan local time/, 'no English sentence left in the UR paragraph');
});

test('Plan 584 G3: all 5 placeholders are wired with keys in both dicts', () => {
  const inputs = [...formSource.matchAll(/<input id="([^"]+)"[^>]*placeholder="([^"]*)"[^>]*data-i18n-placeholder="([^"]+)"/g)];
  assert.equal(inputs.length, 5, 'exactly 5 inputs carry a translated placeholder');
  for (const [, id, text, key] of inputs) {
    assert.equal(PLACEHOLDER_KEYS[id], key, `${id}: wired with its expected key`);
    assert.equal(TRANSLATIONS.en[key], text, `${key}: EN value matches the static placeholder`);
    assert.ok(TRANSLATIONS.ur[key], `${key} exists in UR`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `${key}: UR is a translation, not the raw key (T8)`);
  }
  // The three e.g. examples are translated too (D4(a)).
  assert.equal(TRANSLATIONS.ur.ledger_filter_amount_min_ph, 'مثلاً 1000');
  assert.equal(TRANSLATIONS.ur.ledger_filter_amount_max_ph, 'مثلاً 2000');
  assert.equal(TRANSLATIONS.ur.ledger_filter_receipt_ph, 'مثلاً RCPT-41-202611-01');
});

test('Plan 584 G3: switching to Urdu applies the help text and placeholders, back restores English', () => {
  const help = new StubEl({ 'data-i18n': 'ledger_filter_help' }, TRANSLATIONS.en.ledger_filter_help);
  const inputs = Object.entries(PLACEHOLDER_KEYS).map(([id, key]) => (
    new StubEl({ 'data-i18n-placeholder': key, placeholder: TRANSLATIONS.en[key] }, '')
  ));
  updateDocumentTranslations('ur', mockContainer({ text: [help], placeholder: inputs }));
  assert.equal(help.textContent, TRANSLATIONS.ur.ledger_filter_help);
  for (const [i, [, key]] of Object.entries(PLACEHOLDER_KEYS).entries()) {
    assert.equal(inputs[i].getAttribute('placeholder'), TRANSLATIONS.ur[key], `${key}: UR placeholder applied`);
  }
  updateDocumentTranslations('en', mockContainer({ text: [help], placeholder: inputs }));
  assert.equal(help.textContent, TRANSLATIONS.en.ledger_filter_help);
  for (const [i, [, key]] of Object.entries(PLACEHOLDER_KEYS).entries()) {
    assert.equal(inputs[i].getAttribute('placeholder'), TRANSLATIONS.en[key], `${key}: EN placeholder restored`);
  }
});

// ---- G4 — The JS-owned options ----

test('Plan 584 G4: the category rewrite composes label + count through t()', () => {
  assert.ok(appSource.includes("t('ledger_filter_category_all')"), 'All-categories label goes through t()');
  // Each tag label is a literal t('ledger_filter_cat_*') call in the
  // rewrite (the prep's G4 shape) — no key-map indirection, so the
  // four keys are visible to a source scan of app.js.
  for (const key of [
    'ledger_filter_cat_collection',
    'ledger_filter_cat_advance',
    'ledger_filter_cat_refund',
    'ledger_filter_cat_adjustment',
  ]) {
    assert.ok(appSource.includes(`t('${key}')`), `${key} is composed through a literal t() call`);
  }
  // 'other' reuses bill_method_other — the same word as the method option.
  assert.ok(appSource.includes("t('bill_method_other')"), "'other' maps to the reused bill_method_other key");
  // A value with no key falls back to the tag module's English label.
  assert.ok(appSource.includes('transactionCategoryTagLabel(option.value)'), 'unknown values fall back to the tag module');
  // The composed string keeps the count: label + ' (N)', never a bare label (T9).
  assert.ok(appSource.includes(' (${count})'), 'the rewrite composes label + count');
  // UR composition shape: the label translates, the count stays a Latin digit.
  assert.equal(`${t('ledger_filter_cat_collection', 'ur')} (3)`, 'وصولی (3)');
  assert.equal(`${t('ledger_filter_cat_advance', 'ur')} (0)`, 'پیشگی (0)');
});

test('Plan 584 G4: collector and book rebuilds translate the first option only — names stay raw data', () => {
  assert.ok(appSource.includes("new Option(t('ledger_filter_collector_all'), '')"), 'collector first option goes through t()');
  assert.ok(appSource.includes("new Option(t('ledger_filter_book_all'), '')"), 'book first option goes through t()');
  // T10: collector/book NAMES are data, never translated.
  assert.ok(appSource.includes('...collectors.map((name) => new Option(name, name))'), 'collector names ride as raw ledger values');
  assert.ok(appSource.includes('...bookOptions.map((option) => new Option(option.label, option.id))'), 'book labels ride as raw recorded values');
  assert.doesNotMatch(appSource, /new Option\(t\([^)]*\), name\)/, 'no t() around a collector name');
  assert.doesNotMatch(appSource, /new Option\(t\(option\.label\)/, 'no t() around a book label');
});

test('Plan 584 G4: the three filter-row buttons are wired (D1(b))', () => {
  assert.ok(formSource.includes('data-i18n="ledger_filter_clear">Clear filters</button>'), "'Clear filters' is wired");
  assert.ok(formSource.includes('data-i18n="ledger_filter_find_receipt">Find receipt</button>'), "'Find receipt' is wired");
  assert.ok(formSource.includes('data-i18n="cust_search_clear">Clear</button>'), "'Clear' reuses cust_search_clear");
  assert.equal(TRANSLATIONS.en.ledger_filter_clear, 'Clear filters');
  assert.equal(TRANSLATIONS.en.ledger_filter_find_receipt, 'Find receipt');
  assert.equal(TRANSLATIONS.ur.ledger_filter_clear, 'فلٹر صاف کریں');
  assert.equal(TRANSLATIONS.ur.ledger_filter_find_receipt, 'رسید تلاش کریں');
});

// ---- G5 — Guards + completeness ----

test('Plan 584 G5: parity holds at 4,722/4,722 with identical key sets', () => {
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  // (Test title re-pinned with the asserts by Plan 586 — the 585 merge had
  // left the 584-era number in the title with disclosure; titles and
  // asserts move together from here on.)
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR. The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  // Re-pin (Recovery Pipeline redesign 2026-11-24): parity 5,234 → 5,235 — the item adds exactly one i18n key, dash_pending_manual_empty, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5235, 'EN count');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5235, 'UR count');
  assert.deepEqual(
    Object.keys(TRANSLATIONS.en).sort(),
    Object.keys(TRANSLATIONS.ur).sort(),
    'the EN and UR key sets are identical (the urdu-mode-228 shape)',
  );
  assert.equal(
    Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('ledger_filter_')).length,
    38,
    'exactly 38 new ledger_filter_* keys (36 + 2 buttons)',
  );
});

test('Plan 584 G5: every ledger_filter_* key referenced in index.html/app.js exists in both dicts', () => {
  const referenced = new Set([
    ...formSource.matchAll(/data-i18n="(ledger_filter_[^"]+)"/g),
    ...formSource.matchAll(/data-i18n-placeholder="(ledger_filter_[^"]+)"/g),
    // app.js: the t('…') calls AND the category value→key map values
    // (the map keys are composed through t(labelKey), not t('…')).
    ...appSource.matchAll(/'(ledger_filter_[a-z_0-9]+)'/g),
  ].map((m) => m[1]));
  assert.ok(referenced.size > 0, 'the form + app.js reference ledger_filter_* keys');
  for (const key of [...referenced].sort()) {
    assert.ok(TRANSLATIONS.en[key], `${key} exists in EN`);
    assert.ok(TRANSLATIONS.ur[key], `${key} exists in UR`);
  }
  // Every new key is actually referenced somewhere — no dead keys.
  const defined = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('ledger_filter_'));
  for (const key of defined) {
    assert.ok(referenced.has(key), `${key} is referenced in index.html or app.js`);
  }
});

test('Plan 584 G5: PKR-only values, and the category-tag module stays import-free', () => {
  for (const key of Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('ledger_filter_'))) {
    for (const dict of ['en', 'ur']) {
      assert.doesNotMatch(TRANSLATIONS[dict][key], /[$€]/, `${key} (${dict}): no $/€ — PKR only`);
    }
  }
  // The translation happens at the app.js call site, never by adding
  // a nav-language import to the pure category-tag module.
  assert.doesNotMatch(tagModuleSource, /^import\s/m, 'transaction-category-tag.js has no import statement');
});
