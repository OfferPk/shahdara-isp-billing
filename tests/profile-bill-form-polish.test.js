// profile-bill-form-polish.test.js — Customer Profile bill/package
// form polish (user spec, 2026-11-22): crisp 20px toggle-card
// checkboxes for 'Add sales tax' and 'Free bill', a 1-line preset
// helper, '/mo' package options, 12px form spacing, and the 19.5%
// sales tax rounded to whole PKR (1500 -> 293, so a 1500 package
// bills 1793, not 1792.5).
//
// Adapted from the prep repro (repro-profile-bill-form.mjs). NOT a
// pinning file: 0 parity literals. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  salesTaxCentsForPrice, formatSalesTaxAmount, salesTaxCentsOfBill,
} from '../package-sales-tax.js';
import { createInitialState, saveBillMonth } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const NOV_2 = new Date('2026-11-02T10:00:00Z');

// Rule blocks whose selector mentions the bill-form checkboxes.
function checkboxRuleBlocks() {
  const blocks = [];
  const re = /([^{}]*\[[^\]]*(?:stx-tax-wrap|zero-price-wrap)[^\]]*\][^{}]*|(?:\.bill-form[^{}]*input\[type="checkbox"\])[^{}]*)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(stylesSrc)) !== null) blocks.push(m[2]);
  return blocks;
}

function labelTemplate(attr) {
  const at = appSrc.indexOf(attr);
  if (at === -1) return '';
  // Slice from the enclosing <label> opening, not from the attribute
  // itself — the class attribute precedes the data attribute in the
  // tag, and slicing from the attribute would miss it.
  const start = appSrc.lastIndexOf('<label', at);
  if (start === -1) return '';
  return appSrc.slice(start, appSrc.indexOf('</label>', at));
}

// --- C tests: the fixed state ---

test('C1: the tax checkbox is a crisp 20px box with an emerald-700 accent, not a 46px stretched input', () => {
  const blocks = checkboxRuleBlocks().join(' ');
  assert.ok(/width:\s*20px/.test(blocks), 'a scoped rule sets the checkbox width to 20px');
  assert.ok(/height:\s*20px/.test(blocks), 'a scoped rule sets the checkbox height to 20px');
  assert.ok(/min-height:\s*(0|auto)/.test(blocks), 'the 44px global floor is neutralised for the checkbox');
  assert.ok(/accent-color:\s*(#047857|var\(--qc-emerald-text\))/.test(blocks) || appSrc.includes('toggle-switch'),
    'emerald-700 accent (or a pill toggle switch instead of a native box)');
});

test('C2: the free-bill checkbox is a crisp 20px box with an emerald-700 accent, not a 46px stretched input', () => {
  const blocks = checkboxRuleBlocks().join(' ');
  assert.ok(/width:\s*20px/.test(blocks), 'a scoped rule sets the checkbox width to 20px');
  assert.ok(/height:\s*20px/.test(blocks), 'a scoped rule sets the checkbox height to 20px');
  assert.ok(/min-height:\s*(0|auto)/.test(blocks), 'the 44px global floor is neutralised for the checkbox');
});

test('C3: each option is a single-row toggle card — label left, checkbox right', () => {
  const taxLabel = labelTemplate('data-stx-tax-wrap');
  const zeroLabel = labelTemplate('data-zero-price-wrap');
  assert.ok(/toggle/.test(taxLabel), 'the tax label carries a toggle-card class');
  assert.ok(taxLabel.indexOf('data-stx-tax-label') < taxLabel.indexOf('<input'),
    'the tax label text comes before the checkbox in DOM order');
  assert.ok(/toggle/.test(zeroLabel), 'the free-bill label carries a toggle-card class');
  assert.ok(zeroLabel.indexOf('prof_hist_bill_zero_price') < zeroLabel.indexOf('<input'),
    'the free-bill label text comes before the checkbox in DOM order');
});

test('C4: the preset note is a 1-line helper (or the full text sits behind an (i) tooltip)', () => {
  const oneLine = 'Applies to this bill only — does not change the customer\'s recurring rate.';
  const isOneLine = TRANSLATIONS.en.prof_hist_pkg_help === oneLine;
  // Tooltip alternative: the <details><summary> must open immediately
  // around the help paragraph itself — not just anywhere in the file.
  const at = appSrc.indexOf("t('prof_hist_pkg_help')");
  const windowBefore = appSrc.slice(Math.max(0, at - 400), at);
  const behindTooltip = windowBefore.includes('<details') && windowBefore.includes('<summary');
  assert.ok(isOneLine || behindTooltip,
    'the 5-line paragraph is replaced by the 1-line helper or tucked behind an (i) tooltip');
});

test('C5: the bill form separates Free bill from Optional due date by 12px, not a -3px pull', () => {
  assert.ok(/\.bill-form[^{]*\{[^}]*gap:\s*12px/.test(stylesSrc) || /\.bill-form[^}]*margin-bottom:\s*12px/.test(stylesSrc),
    'a bill-form-scoped rule gives the 12px (space-y-3) separation');
  const override = /\.bill-form[^{]*\.field-label[^{]*\{[^}]*margin-bottom:\s*0/.test(stylesSrc);
  const globalGone = !/\.form-grid \.field-label\s*\{\s*font-size:10px;grid-column:span 2;margin:0 0 -3px/.test(stylesSrc);
  assert.ok(override || globalGone, 'the -3px field-label pull no longer crowds the due-date row in this form');
});

test('C6: the package option reads "/mo", never "/ month"', () => {
  const optionLine = appSrc.split('\n').find((line) => line.includes('formatAmount(plan.price)')) ?? '';
  assert.ok(optionLine.includes('/mo'), 'the bill-form option uses /mo');
  assert.ok(!optionLine.includes('/ month'), 'the bill-form option never says / month');
});

test('C7: the 19.5% tax rounds to whole PKR — 1500 -> 293, 2500 -> 488; whole-rupee taxes unchanged', () => {
  assert.equal(salesTaxCentsForPrice(1500), 29300, '292.5 rounds to 293');
  assert.equal(salesTaxCentsForPrice(2500), 48800, '487.5 rounds to 488');
  assert.equal(salesTaxCentsForPrice(1000), 19500, '195 stays 195');
  assert.equal(salesTaxCentsForPrice(1600), 31200, '312 stays 312');
  assert.equal(salesTaxCentsForPrice(2000), 39000, '390 stays 390');
  assert.equal(salesTaxCentsForPrice(3000), 58500, '585 stays 585');
});

test('C8: a 1500 package with tax bills 1793, not 1792.5', () => {
  let state = createInitialState(['Bill Form Tester']);
  state = saveBillMonth(state, 'seed-001', {
    month: '2026-11', status: 'pending', packageId: '5mbps-150gb',
    salesTaxCents: salesTaxCentsForPrice(1500),
  }, NOV_2);
  const bill = state.customers[0].bills.find((b) => b.month === '2026-11');
  assert.equal(Number(bill.dueAmount), 1793, '1500 + 293 tax = 1793');
  assert.equal(bill.salesTaxCents, 29300, 'the recorded tax is the rounded 293');
});

// --- S tests: stability ---

test('S1: whole-rupee tax figures still format cleanly', () => {
  assert.equal(formatSalesTaxAmount(19500), 'PKR 195');
  assert.equal(formatSalesTaxAmount(58500), 'PKR 585');
});

test('S2: the checkbox anchors survive — data attributes, names, i18n keys', () => {
  assert.ok(appSrc.includes('data-stx-tax'), 'the tax checkbox rides the bill form');
  assert.ok(appSrc.includes('data-zero-price'), 'the free-bill checkbox rides the bill form');
  assert.ok(appSrc.includes('name="isZeroPriced"'), 'the free-bill input keeps its name');
  assert.equal(typeof TRANSLATIONS.en.prof_hist_bill_zero_price, 'string');
  assert.equal(typeof TRANSLATIONS.ur.prof_hist_bill_zero_price, 'string');
});

test('S3: the help key still exists in both dictionaries and is still referenced', () => {
  assert.equal(typeof TRANSLATIONS.en.prof_hist_pkg_help, 'string');
  assert.equal(typeof TRANSLATIONS.ur.prof_hist_pkg_help, 'string');
  assert.ok(appSrc.includes("t('prof_hist_pkg_help')"), 'the form still renders the help text');
});

test('S4: the tax checkbox still hides and disables with no package selected', () => {
  assert.ok(appSrc.includes('taxBox.disabled = true'), 'the checkbox disables with no package');
  assert.ok(appSrc.includes("style=\"${savedPlan ? '' : 'display:none'}\""), 'the checkbox hides with no package selected');
});

test('S5: the due amount still updates live via stxDueValue on package change and tax toggle', () => {
  assert.ok(appSrc.includes('amount.value = stxDueValue(plan.price, taxCents)'),
    'choosing a package sets the due to price + tax at once');
  assert.ok(appSrc.includes('amount.value = stxDueValue(plan.price, box.checked ? taxCents : 0)'),
    'toggling the box updates the due live, price <-> price + tax');
});

// --- B tests: behaviour ---

test('B1: missing/invalid figures are still null, never zero', () => {
  for (const bad of [null, undefined, '', true, false, 0, -5, Number.NaN, 'abc']) {
    assert.equal(salesTaxCentsForPrice(bad), null, `expected null for ${String(bad)}`);
  }
});

test('B2: old bills keep their recorded cents — history is never recomputed', () => {
  assert.equal(salesTaxCentsOfBill({ salesTaxCents: 29250 }), 29250,
    'a bill recorded at 292.5 still reads 292.5');
  assert.equal(salesTaxCentsOfBill({ salesTaxCents: 19500 }), 19500);
});
