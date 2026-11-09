import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { TRANSLATIONS } from '../nav-language.js';
import { customerPackageProfit, formatPKR } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 515 — Profit figure reads the same in form and view.
//
// The design's cited view line (app.js:6743, prof_view_profit) is stale:
// Plan 506 already moved the view's profit into the Service group as a
// row — [t('prof_field_profit'), profit === null ? t('prof_not_set') :
// formatAmount(profit)] — and removed the prof_view_profit sentence key.
// What still disagreed at the Plan 514 head was the FORM preview
// (renderProfileMarginPreview): it rendered its own sentences
// (prof_margin_ok / prof_margin_unset — "Expected monthly package
// profit: ...") and hand-computed selling - cost on raw typed numbers,
// while the view used the prof_field_profit label, the shared
// customerPackageProfit cents computation, and the plain Not set
// fallback. The fix unifies the preview onto the view's rendering:
// same label key, same figure function, same fallback. The old
// sentence keys are removed from EN + UR (Plan 506/507 precedent);
// prof_margin_invalid stays — it is form validation, not the
// profit line. The dashboard card (dash_card_exp_profit) and the
// history text export (core.js) are different surfaces and are
// untouched.

function previewFunctionSource() {
  const app = read('app.js');
  const start = app.indexOf('function renderProfileMarginPreview() {');
  assert.notEqual(start, -1, 'renderProfileMarginPreview must exist');
  const end = app.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'renderProfileMarginPreview must end cleanly');
  return app.slice(start, end + 3);
}

function runPreview(sellingText, costText) {
  const preview = { textContent: '' };
  const inputs = {
    '#monthlySellingAmountInput': { value: sellingText },
    '#monthlyPurchaseCostInput': { value: costText },
    '#customerProfitPreview': preview,
  };
  const t = (key, _ctx, params) => {
    const value = TRANSLATIONS.en[key];
    assert.notEqual(value, undefined, `preview must only use keys that exist in EN (missing: ${key})`);
    if (!params) return value;
    return Object.entries(params).reduce((text, [name, param]) => text.replace(`{${name}}`, String(param)), value);
  };
  runInNewContext(`${previewFunctionSource()}\nrenderProfileMarginPreview();`, {
    $: (selector) => inputs[selector],
    t,
    formatAmount: formatPKR,
    customerPackageProfit,
  });
  return preview.textContent;
}

function viewProfitLine(customer) {
  const profit = customerPackageProfit(customer);
  return `${TRANSLATIONS.en.prof_field_profit}: ${profit === null ? TRANSLATIONS.en.prof_not_set : formatPKR(profit)}`;
}

// ------------------------------------------------------------ the rule itself

test('Plan 515: the unification is written down as a code comment at the preview', () => {
  const app = read('app.js');
  assert.ok(app.includes('Plan 515 — the form profit preview reads exactly like the view\'s'), 'rule comment must sit at renderProfileMarginPreview');
  assert.ok(app.includes('same label key (prof_field_profit), same'), 'rule must name the shared label key');
  assert.ok(app.includes('same Not set fallback'), 'rule must name the shared fallback');
});

test('Plan 515: the preview uses the view label key, the shared figure function and the Not set fallback', () => {
  const src = previewFunctionSource();
  assert.ok(src.includes("customerPackageProfit({ monthlySellingAmount: selling, monthlyPurchaseCost: cost })"), 'preview must compute the figure with the shared customerPackageProfit, not hand-rolled subtraction');
  assert.ok(src.includes("`${t('prof_field_profit')}: ${profit === null ? t('prof_not_set') : formatAmount(profit)}`"), 'preview must render label + figure exactly like the view row');
  assert.ok(src.includes("`${t('prof_field_profit')}: ${t('prof_not_set')}`"), 'preview unset must read label + Not set, like the view');
  assert.ok(!src.includes('prof_margin_ok'), 'the old ok sentence key must be gone from the preview');
  assert.ok(!src.includes('prof_margin_unset'), 'the old unset sentence key must be gone from the preview');
  assert.ok(src.includes("t('prof_margin_invalid')"), 'the invalid-amounts hint stays — it is validation, not the profit line');
});

test('Plan 515: no profit sentence key is referenced anywhere in app.js', () => {
  const app = read('app.js');
  assert.ok(!app.includes('prof_margin_ok'), 'prof_margin_ok must not be referenced');
  assert.ok(!app.includes('prof_margin_unset'), 'prof_margin_unset must not be referenced');
  assert.ok(!app.includes('prof_view_profit'), 'the removed Plan 506 sentence key must stay gone');
});

test('Plan 515: the old sentence keys are removed from English and Urdu; the invalid hint and the label stay', () => {
  assert.equal(TRANSLATIONS.en.prof_margin_ok, undefined, 'old ok sentence key must be gone from EN');
  assert.equal(TRANSLATIONS.ur.prof_margin_ok, undefined, 'old ok sentence key must be gone from UR');
  assert.equal(TRANSLATIONS.en.prof_margin_unset, undefined, 'old unset sentence key must be gone from EN');
  assert.equal(TRANSLATIONS.ur.prof_margin_unset, undefined, 'old unset sentence key must be gone from UR');
  assert.equal(TRANSLATIONS.en.prof_margin_invalid, 'Enter a selling amount above zero and a provider cost of zero or more.');
  assert.equal(TRANSLATIONS.ur.prof_margin_invalid, 'صفر سے زیادہ فروخت رقم اور صفر یا زیادہ فراہم کنندہ لاگت درج کریں۔');
  assert.equal(TRANSLATIONS.en.prof_field_profit, 'Monthly package profit');
  assert.equal(TRANSLATIONS.ur.prof_field_profit, 'ماہانہ پیکیج منافع');
});

test('Plan 515: the preview reads Not set until both monthly amounts are entered', () => {
  assert.equal(runPreview('', ''), 'Monthly package profit: Not set');
  assert.equal(runPreview('2000', ''), 'Monthly package profit: Not set');
  assert.equal(runPreview('', '1500'), 'Monthly package profit: Not set');
  assert.equal(runPreview('   ', '1500'), 'Monthly package profit: Not set');
});

test('Plan 515: the preview figure is the same PKR figure the view shows for the same amounts', () => {
  assert.equal(runPreview('2000', '1500'), 'Monthly package profit: PKR 500');
  assert.equal(runPreview('3000', '3000'), 'Monthly package profit: PKR 0');
  // The shared cents computation, not raw float subtraction: 1500.5 - 1000.1
  // is 500.39999999999998 as a raw double, but the cents path reads 500.40.
  assert.equal(runPreview('1500.5', '1000.1'), 'Monthly package profit: PKR 500.40');
  assert.equal(
    runPreview('2000', '1500'),
    viewProfitLine({ monthlySellingAmount: 2000, monthlyPurchaseCost: 1500 }),
    'preview and view must read identically for the same customer',
  );
  assert.equal(
    runPreview('', '1500'),
    viewProfitLine({ monthlySellingAmount: undefined, monthlyPurchaseCost: 1500 }),
    'preview and view must both read Not set when an amount is missing',
  );
});

test('Plan 515: invalid typed amounts still get the validation hint, not a figure', () => {
  const hint = 'Enter a selling amount above zero and a provider cost of zero or more.';
  assert.equal(runPreview('0', '1500'), hint);
  assert.equal(runPreview('-100', '1500'), hint);
  assert.equal(runPreview('abc', '1500'), hint);
  assert.equal(runPreview('2000', '-5'), hint);
  assert.equal(runPreview('2000', 'xyz'), hint);
});

test('Plan 515: the static preview text in the form reads the same unset line', () => {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfitPreview"');
  assert.notEqual(start, -1, 'the preview element must exist in the form');
  const line = html.slice(html.lastIndexOf('<p', start), html.indexOf('</p>', start));
  assert.ok(line.includes('Monthly package profit: Not set'), 'static preview text must be the unified unset line');
  assert.ok(!line.includes('Not set until both monthly amounts are entered.'), 'the old unset sentence must be gone from the form');
  assert.ok(!html.includes('Expected monthly package profit: Not set until both monthly amounts are entered.'), 'the old unset sentence must be gone from the page');
});

test('Plan 515: the view profit row (Plan 506) is untouched', () => {
  const app = read('app.js');
  // Polish #28 Phase A — the four-groups literal became the eight
  // fragments object (profileInfoGroupFragments); the view pin follows
  // the new name, rows verbatim.
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  const groups = app.slice(start, app.indexOf('\n', start));
  assert.ok(groups.includes("[t('prof_field_profit'), profit === null ? t('prof_not_set') : formatAmount(profit)]"), 'view row must keep the label + Not set + PKR figure pattern');
  const selling = "[t('prof_field_selling'), formatAmount(customer.monthlySellingAmount)]";
  assert.ok(groups.indexOf(selling) !== -1, 'selling row must still exist');
  assert.ok(groups.indexOf("[t('prof_field_profit'), profit === null ? t('prof_not_set') : formatAmount(profit)]") > groups.indexOf(selling), 'profit row must still follow the selling row');
});
