// Urdu auto-translation phase 1: Customers page via t() + dictionary.
// (a) Every cust_ dictionary key exists in BOTH en and ur, and every ur
// value contains Urdu script.
// (b) The REAL table renderers (form-validation.js, pure functions) render
// Urdu strings — and none of the English originals — when the language is
// 'ur', and the exact English originals when it is 'en'. The panel renderer
// in app.js needs a DOM + full app state, so its strings are proven through
// the same t() path: exact-English pins below (taken from the pre-change
// code) plus Urdu-script assertions for every panel key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Mock localStorage BEFORE any language call (module evaluation itself does
// not read it; getAppLanguage/setAppLanguage read it lazily at call time).
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t, setAppLanguage, URDU_SCRIPT_PATTERN } = await import('../nav-language.js');
const { renderCustomerTableRowMarkup, renderCustomerTableEmptyMarkup } = await import('../form-validation.js');

const URDU = /[\u0600-\u06FF]/;
assert.ok(URDU_SCRIPT_PATTERN, 'nav-language exports URDU_SCRIPT_PATTERN');

test('phase 1 dictionary: every cust_ key exists in en and ur, ur values carry Urdu script', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('cust_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('cust_'));
  assert.ok(enKeys.length > 100, `expected 100+ cust_ keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys.sort(), enKeys.sort(), 'ur dict must carry exactly the en cust_ keys');
  for (const key of enKeys) {
    const ur = TRANSLATIONS.ur[key];
    assert.equal(typeof ur, 'string', `${key}: ur value must be a string`);
    assert.ok(URDU.test(ur), `${key}: ur value must contain Urdu script, got ${JSON.stringify(ur)}`);
    assert.ok(URDU_SCRIPT_PATTERN.test(ur), `${key}: ur value must match URDU_SCRIPT_PATTERN`);
  }
});

test('phase 1 dictionary: English pins are byte-identical to the pre-change strings', () => {
  const pins = {
    cust_new_customers_eyebrow: 'NEW CUSTOMERS',
    cust_new_customers_by_month: 'New customers by month',
    cust_newcust_this_month: 'This month',
    cust_newcust_last_month: 'Last month',
    cust_newcust_last_3_months: 'Last 3 months',
    cust_newcust_last_6_months: 'Last 6 months',
    cust_newcust_month_label: 'Month',
    cust_newcust_choose_month: 'Choose a month…',
    cust_newcust_connection_fees: 'Connection fees',
    cust_newcust_empty: 'No new customers in this view.',
    cust_newcust_note: 'Join counts include customers archived later.',
    cust_newcust_area_not_set: 'Area not set',
    cust_newcust_onboarding_none: 'Onboarding details not recorded',
    cust_newcust_quick_views_aria: 'New-customer quick views',
    cust_all_areas: 'All areas',
    cust_no_matching: 'No matching customers.',
    cust_no_match_filters: 'No customers match these service and billing filters.',
    cust_card_actually_received: 'Actually received',
    cust_card_time_with_isp: 'Time with ISP',
    cust_card_no_receipts: 'No receipts',
    cust_card_no_payment_entries: 'No payment entries',
    cust_card_package_not_set: 'Package not set',
    cust_card_open_hint: 'Open full profile and monthly billing history',
    cust_card_health_reasons: 'Health reasons',
    cust_card_health_none: 'Not enough completed priced months for an automatic score.',
    cust_bill_not_set: 'Bill not set',
    cust_bill_paid: 'Paid',
    cust_bill_pending: 'Pending',
    cust_bill_partial: 'Partial',
    cust_not_set: 'Not set',
    cust_service_active: 'Active',
    cust_service_offline: 'Offline',
    cust_card_unarchive: 'Unarchive',
    cust_table_open: 'Open →',
    cust_table_empty: 'No customers found.',
    cust_table_reset: 'Reset Filters & Search',
    cust_density_compact: '▤ Compact list',
    cust_density_detailed: '☰ Show details',
    cust_search_list_label: 'Search this list',
    cust_search_placeholder: 'Name, phone, customer # or ID',
    cust_search_clear: 'Clear',
    cust_th_customer: 'Customer',
    cust_th_balance: 'Balance Due',
    cust_th_action: 'Action',
    cust_prev: '← Previous',
    cust_next: 'Next →',
    cust_archived: 'Archived customers',
    cust_footer: 'Billing entries never leave this browser.',
  };
  for (const [key, english] of Object.entries(pins)) {
    assert.equal(t(key, 'en'), english, `${key}: English must stay ${JSON.stringify(english)}`);
    assert.notEqual(t(key, 'ur'), english, `${key}: Urdu must differ from English`);
    assert.ok(URDU.test(t(key, 'ur')), `${key}: Urdu must contain Urdu script`);
  }
});

test('phase 1 dictionary: interpolated keys keep their params in both languages', () => {
  assert.equal(t('cust_newcust_count', 'en', { count: 9 }), '9 new customers');
  assert.equal(t('cust_newcust_count', 'ur', { count: 9 }), '9 نئے گاہک');
  assert.equal(t('cust_page_info', 'en', { page: 2, totalPages: 5, total: 98 }), 'Page 2 of 5 (98 total)');
  assert.equal(t('cust_page_info', 'ur', { page: 2, totalPages: 5, total: 98 }), 'صفحہ 2 از 5 (98 کل)');
  assert.equal(t('cust_newcust_joined', 'en', { month: '2026-10' }), 'joined 2026-10');
  assert.equal(t('cust_newcust_joined', 'ur', { month: '2026-10' }), '2026-10 کو شامل ہوئے');
  assert.equal(t('cust_table_empty_query_area', 'en', { query: 'Ali', area: 'Barrian' }), 'No customers matching "Ali" in Barrian.');
  assert.equal(t('cust_table_empty_query_area', 'ur', { query: 'Ali', area: 'Barrian' }), 'کوئی گاہک "Ali" سے Barrian میں مماثل نہیں ملا۔');
});

const customer = {
  id: 'c1',
  customerNumber: '34',
  name: 'RAJA ALI',
  phone: '03001234567',
  mohalla: 'Barrian',
  packageSpeed: '10MB',
  serviceStatus: 'active',
  bills: [{ month: '2026-10', dueAmount: 3000, nominalPrice: 3000, payments: [{ amount: 3000 }] }],
};

test('phase 1 render: table row in Urdu mode shows Urdu, never the English originals', () => {
  setAppLanguage('ur');
  const html = renderCustomerTableRowMarkup(customer, { selectedBillingMonth: '2026-10' });
  for (const urdu of ['ادا شدہ', 'فعال', 'کھولیں ←']) assert.ok(html.includes(urdu), `row must contain ${urdu}`);
  for (const english of ['>Paid<', '>Active<', 'Open →']) assert.ok(!html.includes(english), `row must not contain ${english}`);
  const archived = renderCustomerTableRowMarkup({ ...customer, packageSpeed: '' }, { selectedBillingMonth: '2026-10', archived: true });
  assert.ok(archived.includes('(آرکائیو شدہ)'), 'archived row must show the Urdu archived marker');
  assert.ok(!archived.includes('(Archived)'), 'archived row must not show the English marker');
  assert.ok(archived.includes('منتخب نہیں'), 'missing package must show the Urdu not-set word');
  assert.ok(!archived.includes('>Not set<'), 'missing package must not show the English not-set word');
  const empty = renderCustomerTableEmptyMarkup('Ali', 'Barrian');
  assert.ok(empty.includes('مماثل'), 'empty state must be Urdu');
  assert.ok(empty.includes('فلٹرز اور تلاش صاف کریں'), 'reset button must be Urdu');
  assert.ok(!empty.includes('No customers matching'), 'empty state must not be English');
});

test('phase 1 render: table row in English mode is byte-identical to the old strings', () => {
  setAppLanguage('en');
  const html = renderCustomerTableRowMarkup(customer, { selectedBillingMonth: '2026-10' });
  for (const english of ['>Paid<', '>Active<', 'Open →']) assert.ok(html.includes(english), `row must contain ${english}`);
  // Params must actually interpolate (this caught t(key, {params}) being read as lang).
  assert.ok(html.includes('Open profile for #34 RAJA ALI'), 'row title params must interpolate');
  assert.ok(!html.includes('{number}') && !html.includes('{name}'), 'row title must not leak raw placeholders');
  const empty = renderCustomerTableEmptyMarkup('Ali', 'Barrian');
  // Quotes are HTML-escaped by the renderer (same as before the change).
  assert.ok(empty.includes('No customers matching &quot;Ali&quot; in Barrian.'), 'empty state must be the old English sentence');
  assert.ok(empty.includes('Reset Filters & Search'), 'reset button must be the old English label');
});

test('phase 1: markUnset hides the translated not-set chip too', () => {
  const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
  const feedback = readFileSync(path.join(root, 'ui-feedback.js'), 'utf8');
  const chip = t('cust_service_status_chip', 'ur', { status: t('cust_not_set', 'ur') });
  assert.ok(chip.includes('منتخب نہیں'), `Urdu not-set chip must contain منتخب نہیں, got ${chip}`);
  assert.ok(feedback.includes('منتخب نہیں'), 'ui-feedback markUnset must match the Urdu not-set wording');
  assert.ok(/\/not set\|منتخب نہیں\/i\.test\(el\.textContent\)/.test(feedback), 'markUnset regex must cover both wordings');
});
