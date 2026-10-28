// Urdu auto-translation phase 4: standalone Billing screens via t() + source pins.
// (a) Every bill_ dictionary key exists in BOTH en and ur, and every ur value
//     contains Urdu script except three brand names that stay Latin by design.
// (b) Parametrised keys resolve without leftover {…}, and English values equal
//     the pre-phase originals (English mode stays byte-identical).
// (c) Source pins: app.js renderMonthlyReport + helpers call t('bill_…') and the
//     renderMonthlyReport body no longer carries the old English literals.
//     app.js cannot be imported in Node (it executes DOM code at import time;
//     no repo test imports it), so its templates are pinned by source
//     assertions, the same technique tests/customer-profile-ui.test.js uses.
// (d) Guard: no bill_ data-i18n key appears inside any <dialog> in index.html
//     (modal contents stay a later phase), and the Reports panels inside the
//     shared billingReportsView carry no bill_ keys (Reports is a later phase).
// (e) screen-router.js renders the Bills screen header via t() and re-applies
//     it on language change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t, URDU_SCRIPT_PATTERN } = await import('../nav-language.js');

const URDU = /[\u0600-\u06FF]/;
assert.ok(URDU_SCRIPT_PATTERN, 'nav-language exports URDU_SCRIPT_PATTERN');

// Brand / system names stay Latin by design, matching earlier phases keeping
// brand words (e.g. WhatsApp) untranslated.
const BRAND_EXEMPTIONS = {
  bill_method_jazzcash: 'JazzCash is a brand name',
  bill_method_easypaisa: 'Easypaisa is a brand name',
  bill_method_raast: 'Raast is a payment-system name',
};

test('phase 4 dictionary: every bill_ key exists in en and ur, ur values carry Urdu script', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('bill_'));
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('bill_'));
  assert.ok(enKeys.length > 80, `expected 80+ bill_ keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys.sort(), enKeys.sort(), 'ur dict must carry exactly the en bill_ keys');
  for (const key of enKeys) {
    const en = TRANSLATIONS.en[key];
    const ur = TRANSLATIONS.ur[key];
    assert.equal(typeof en, 'string', `${key}: en value must be a string`);
    assert.ok(en.length > 0, `${key}: en value must not be empty`);
    assert.equal(typeof ur, 'string', `${key}: ur value must be a string`);
    if (key in BRAND_EXEMPTIONS) {
      assert.ok(!URDU.test(ur), `${key}: brand exemption must stay Latin, got ${JSON.stringify(ur)}`);
      continue;
    }
    assert.ok(URDU.test(ur), `${key}: ur value must contain Urdu script, got ${JSON.stringify(ur)}`);
    assert.ok(URDU_SCRIPT_PATTERN.test(ur), `${key}: ur value must match URDU_SCRIPT_PATTERN`);
  }
});

test('phase 4 dictionary: templates resolve without leftover placeholders, English originals intact', () => {
  assert.equal(t('bill_count_sing', 'ur', { count: 1, month: 'اکتوبر 2026' }), '1 گاہک · اکتوبر 2026');
  assert.equal(t('bill_count_plur', 'ur', { count: 5, month: 'اکتوبر 2026' }), '5 گاہک · اکتوبر 2026');
  assert.equal(t('bill_page_info', 'ur', { page: 2, totalPages: 4, total: 50 }), 'صفحہ 2 از 4 (کل 50)');
  const applied = t('bill_credit_applied', 'ur', { month: 'اکتوبر 2026', date: '10-10-2026', method: 'Cash', receipt: 'PKR 3,000', amount: 'PKR 500' });
  assert.ok(!applied.includes('{'), `credit template must resolve fully, got ${applied}`);
  assert.ok(applied.includes('اپلائی'), `credit template must carry Urdu, got ${applied}`);
  assert.equal(
    t('bill_generate_note', 'en', { month: 'October 2026', key: '2026-10', count: 3 }),
    'Bills for October 2026 (2026-10) are generated and up to date for 3 customer(s). New bills use each customer\'s saved package price; nothing is guessed.',
  );
  assert.equal(t('bill_row_month_bill', 'en', { month: 'October 2026' }), 'October 2026 bill (PKR)');
  assert.equal(t('bill_heading_title', 'en'), 'Monthly payment status');
  assert.equal(t('bill_empty', 'en'), 'No customers match this status and search.');
  assert.equal(t('bill_row_monthly_sale', 'en'), 'Monthly sale (PKR)');
  assert.equal(t('bill_method_title', 'en'), 'By method:');
});

test('phase 4 source pins: renderMonthlyReport renders via t(), old literals gone', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderMonthlyReport() {');
  const end = app.indexOf('function populateReportMonths()', start);
  assert.ok(start > 0 && end > start, 'renderMonthlyReport body must be extractable');
  const body = app.slice(start, end);
  for (const pin of [
    "t(rows.length === 1 ? 'bill_count_sing' : 'bill_count_plur'",
    "t('bill_method_title')",
    "t('bill_page_info'",
    "t('bill_not_set')",
    "t('bill_due_notset')",
    "t('bill_credit_summary'",
    "t('bill_credit_applied'",
    "t('bill_credit_waiting'",
    "t('bill_row_monthly_sale')",
    "t('bill_row_month_bill'",
    "t('bill_row_due_date')",
    "t('bill_row_received')",
    "t('bill_row_balance')",
    "t('bill_row_credit')",
    "t('bill_row_status')",
    'billStatusLabel(row.status)',
  ]) {
    assert.ok(body.includes(pin), `renderMonthlyReport must call ${pin}`);
  }
  for (const gone of [
    'Monthly sale (PKR)',
    'Balance due (PKR)',
    'Auto-credit (PKR, not cash)',
    'By method:',
    'Page ${paged.page}',
    "'Not set'",
    'Applied to bill ${',
    'reportStatusLabel(row.status)',
  ]) {
    assert.ok(!body.includes(gone), `renderMonthlyReport must no longer carry literal ${gone}`);
  }
  assert.ok(
    /shahdara:language-change[\s\S]{0,300}renderMonthlyReport\(\)/.test(app),
    'language-change listener must re-render the monthly report',
  );
  assert.ok(app.includes("t('bill_generate_note'"), 'generate handler must use t()');
  assert.ok(app.includes("t('bill_generate_toast'"), 'generate toast must use t()');
  assert.ok(app.includes("t('bill_remind_toast')"), 'reminder toast must use t()');
  assert.ok(app.includes('displayMonthName(month)'), 'billing month names must use displayMonthName');
});

test('phase 4 source pins: screen router renders the Bills header via t()', () => {
  const router = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
  assert.ok(router.includes("import { t } from './nav.js?v=1.11.0';"), 'router must import t from nav.js');
  assert.ok(router.includes("t('bill_screen_title')"), 'router must render the Bills title via t()');
  assert.ok(router.includes("t('bill_screen_subtitle')"), 'router must render the Bills subtitle via t()');
  assert.ok(router.includes("t('bill_screen_action')"), 'router must render the Bills action via t()');
  assert.ok(router.includes("if (current !== 'bills') return;"), 'router must re-apply only the Bills header on language change');
});

test('phase 4 statics: Bills screen HTML carries bill_ i18n attributes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const pin of [
    'data-i18n="bill_nav_monthly"',
    'data-i18n="bill_nav_bills"',
    'data-i18n="bill_heading_title"',
    'data-i18n="bill_generate"',
    'data-i18n="bill_unbilled"',
    'data-i18n="bill_filter_all"',
    'data-i18n-placeholder="bill_search_placeholder"',
    'data-i18n="bill_sort_number_asc"',
    'data-i18n="bill_export_csv"',
    'data-i18n="bill_print_slips"',
    'data-i18n="bill_remind_pending"',
    'data-i18n="bill_sum_billed"',
    'data-i18n="bill_empty"',
    'data-i18n="bill_notset_note"',
    '<span data-i18n="bill_month_label">Billing month</span>',
  ]) {
    assert.ok(html.includes(pin), `index.html must carry ${pin}`);
  }
  // Reports panels inside the shared view stay untouched (later phase).
  assert.ok(html.includes('<h3 id="monthlyClosingHeading">Saved monthly closings</h3>'), 'closings panel must stay untranslated');
  assert.ok(html.includes('<h3 id="monthComparisonHeading">Compare two months</h3>'), 'compare panel must stay untranslated');
  assert.ok(html.includes('<h3 id="customerRankingHeading">Customer rankings</h3>'), 'rankings panel must stay untranslated');
});

test('phase 4 guard: no bill_ data-i18n key appears inside any <dialog>', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogs = html.match(/<dialog[\s\S]*?<\/dialog>/g) || [];
  assert.ok(dialogs.length > 0, 'expected at least one <dialog> in index.html');
  for (const dialog of dialogs) {
    assert.ok(!/data-i18n(?:-placeholder|-title|-aria-label)?="bill_/.test(dialog), `dialog must not carry bill_ i18n keys: ${dialog.slice(0, 120)}`);
  }
});
