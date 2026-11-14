// Sharafat 32 — "Dues / Balance" sort label doesn't say it sorts one month only.
//
// The two balance options read "Dues / Balance (High → Low)" / "(Low → High)"
// with no month qualifier, but the sort key is getCustomerMonthBalance for
// the selected billing month — an operator sorting in November sees November
// balances while thinking in total dues. Parent decision: shape (a) — LABEL
// the options with the month via displayMonthName() (long form, UR-aware,
// the same helper the adjacent month dropdown uses); switch-sort (b) is
// REJECTED. Sharafat 27 picked (a) too (Balance column 'Balance Due ·
// {month}', merged #1416), so column and sort now agree in approach.
//
// The fix is two template keys in both dicts + a 6-line refresh inside
// renderCustomers(), right after the sort-select value assignment, targeting
// the options BY VALUE (Sharafat 29 inserted four options into this select;
// index targeting would break). The refresh runs on every renderCustomers()
// call, so the label follows month changes, sort changes, and language
// switches (the shahdara:language-change listener re-runs renderCustomers
// after the static rewrite). The static option text stays as the pre-JS
// fallback, and the new keys are never referenced by data-i18n in markup
// (a param-less t() call would leak the literal {month}).
//
// Tests are source-scan tests in the established pattern
// (plan-f-runtime-performance.test.js `extractFunction`, Sharafat 29/30/31
// precedents): renderCustomers is unexported inside the app.js bundle and
// there is no jsdom anywhere in the repo, so the refresh is asserted over
// the extracted source; the template values are asserted through the real
// TRANSLATIONS dict. No customer fixtures — no numbers here are customer
// data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Mock localStorage BEFORE any language call (module evaluation itself does
// not read it; getAppLanguage/setAppLanguage read it lazily at call time).
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { TRANSLATIONS, t } = await import('../nav-language.js');

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const index = read('index.html');
const formValidation = read('form-validation.js');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in app.js`);
  const next = source.indexOf('\nfunction ', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

const renderCustomers = extractFunction(app, 'renderCustomers');
const URDU = /[\u0600-\u06FF]/;

test('month template keys exist in the EN dict with {month} in each value', () => {
  const desc = TRANSLATIONS.en.cust_sort_balance_desc_month;
  const asc = TRANSLATIONS.en.cust_sort_balance_asc_month;
  assert.equal(desc, 'Dues · {month}, High → Low');
  assert.equal(asc, 'Dues · {month}, Low → High');
  assert.ok(desc.includes('{month}'), 'desc template must carry {month}');
  assert.ok(asc.includes('{month}'), 'asc template must carry {month}');
});

test('month template keys exist in the UR dict with {month} and Urdu script', () => {
  const desc = TRANSLATIONS.ur.cust_sort_balance_desc_month;
  const asc = TRANSLATIONS.ur.cust_sort_balance_asc_month;
  assert.equal(desc, 'واجب الادا · {month} (زیادہ سے کم)');
  assert.equal(asc, 'واجب الادا · {month} (کم سے زیادہ)');
  assert.ok(desc.includes('{month}'), 'desc template must carry {month}');
  assert.ok(asc.includes('{month}'), 'asc template must carry {month}');
  assert.ok(URDU.test(desc), 'desc UR value must contain Urdu script');
  assert.ok(URDU.test(asc), 'asc UR value must contain Urdu script');
});

test('t() interpolates the month into both templates, EN and UR', () => {
  assert.equal(
    t('cust_sort_balance_desc_month', 'en', { month: 'November 2026' }),
    'Dues · November 2026, High → Low',
  );
  assert.equal(
    t('cust_sort_balance_asc_month', 'en', { month: 'November 2026' }),
    'Dues · November 2026, Low → High',
  );
  assert.equal(
    t('cust_sort_balance_desc_month', 'ur', { month: 'نومبر 2026' }),
    'واجب الادا · نومبر 2026 (زیادہ سے کم)',
  );
  assert.equal(
    t('cust_sort_balance_asc_month', 'ur', { month: 'نومبر 2026' }),
    'واجب الادا · نومبر 2026 (کم سے زیادہ)',
  );
});

test('renderCustomers refreshes both balance options by value with displayMonthName', () => {
  assert.ok(
    renderCustomers.includes('option[value="balance-desc"]'),
    'refresh must target the desc option by value',
  );
  assert.ok(
    renderCustomers.includes('option[value="balance-asc"]'),
    'refresh must target the asc option by value',
  );
  assert.ok(
    renderCustomers.includes('displayMonthName(selectedBillingMonth)'),
    'refresh must label with displayMonthName(selectedBillingMonth)',
  );
  assert.ok(
    renderCustomers.includes("t('cust_sort_balance_desc_month'"),
    'refresh must use the desc template key',
  );
  assert.ok(
    renderCustomers.includes("t('cust_sort_balance_asc_month'"),
    'refresh must use the asc template key',
  );
  assert.ok(
    renderCustomers.includes('{ month: balanceMonthLabel }'),
    'refresh must pass the month as the {month} param',
  );
});

test('refresh targets options by value, never by index', () => {
  assert.ok(
    !renderCustomers.includes('sortSelect.options['),
    'index targeting would break — Sharafat 29 inserted four options into this select',
  );
});

test('refresh sits inside the sort-select guard, after the value assignment', () => {
  const guard = renderCustomers.indexOf("if (sortSelect) {");
  const assignment = renderCustomers.indexOf('sortSelect.value = customerSortBy;');
  const refresh = renderCustomers.indexOf('option[value="balance-desc"]');
  assert.ok(guard >= 0, 'sort-select guard block not found in renderCustomers');
  assert.ok(assignment > guard, 'value assignment must sit inside the guard');
  assert.ok(refresh > assignment, 'refresh must run after the value assignment');
});

test('language-change listener re-runs renderCustomers (month label survives a switch)', () => {
  const start = app.indexOf("shahdara:language-change");
  assert.ok(start >= 0, 'language-change listener not found in app.js');
  const slice = app.slice(start, app.indexOf('});', start));
  assert.ok(
    slice.includes('renderCustomers()'),
    'the listener must call renderCustomers() so the refresh re-applies the month label after the static rewrite',
  );
});

test('static fallback stays: options keep the old keys and unqualified text', () => {
  assert.ok(
    index.includes('<option value="balance-desc" data-i18n="cust_sort_balance_desc">Dues / Balance (High → Low)</option>'),
    'desc option keeps its static fallback text and key',
  );
  assert.ok(
    index.includes('<option value="balance-asc" data-i18n="cust_sort_balance_asc">Dues / Balance (Low → High)</option>'),
    'asc option keeps its static fallback text and key',
  );
});

test('new template keys are never referenced by data-i18n in markup', () => {
  assert.ok(
    !index.includes('cust_sort_balance_desc_month'),
    'a param-less t() rewrite from markup would leak the literal {month}',
  );
  assert.ok(
    !index.includes('cust_sort_balance_asc_month'),
    'a param-less t() rewrite from markup would leak the literal {month}',
  );
});

test('sort semantics unchanged: balance cases still key on the billing month', () => {
  assert.ok(
    formValidation.includes('getCustomerMonthBalance(a, billingMonth'),
    'balance-desc must still sort by the billing month',
  );
  assert.ok(
    formValidation.includes('getCustomerMonthBalance(b, billingMonth'),
    'balance-asc must still sort by the billing month',
  );
});
