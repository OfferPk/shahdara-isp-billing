import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS, t } from '../nav-language.js';
import { customerSalesTaxCents, formatSalesTaxAmount } from '../package-sales-tax.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');

test('Plan 504: EN sales-tax row reads exactly as before', () => {
  assert.equal(TRANSLATIONS.en.prof_field_sales_tax, 'Sales tax (19.5%)');
  assert.equal(t('prof_field_sales_tax', 'en'), 'Sales tax (19.5%)');
});

test('Plan 504: UR sales-tax row reads in Urdu script', () => {
  assert.equal(TRANSLATIONS.ur.prof_field_sales_tax, 'سیلز ٹیکس (19.5%)');
  assert.equal(t('prof_field_sales_tax', 'ur'), 'سیلز ٹیکس (19.5%)');
  // Urdu script, not a params-only or Latin value (Plan 472 rule).
  assert.match(TRANSLATIONS.ur.prof_field_sales_tax, /[\u0600-\u06FF]/);
});

test('Plan 504: the key exists in EN and UR, defined once each', () => {
  assert.ok(TRANSLATIONS.en.prof_field_sales_tax);
  assert.ok(TRANSLATIONS.ur.prof_field_sales_tax);
  assert.notEqual(
    TRANSLATIONS.ur.prof_field_sales_tax,
    TRANSLATIONS.en.prof_field_sales_tax,
    'the Urdu label must differ from the English one'
  );
  assert.equal(
    (navSrc.match(/prof_field_sales_tax:/g) || []).length,
    2,
    'exactly one definition per language dictionary'
  );
});

test('Plan 504: the Service group row uses the i18n key, not a literal', () => {
  assert.ok(
    appSrc.includes("[t('prof_field_sales_tax'), formatSalesTaxAmount(customerSalesTaxCents(customer))]"),
    'the Service group row renders through t()'
  );
  assert.ok(
    !appSrc.includes("['Sales tax (19.5%)', formatSalesTaxAmount(customerSalesTaxCents(customer))]"),
    'the Service group row no longer carries the literal English label'
  );
});

test('Plan 504: the 19.5% figure is unchanged', () => {
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 1000 })), 'PKR 195');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 2000 })), 'PKR 390');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 3000 })), 'PKR 585');
  assert.ok(TRANSLATIONS.en.prof_field_sales_tax.includes('19.5%'));
  assert.ok(TRANSLATIONS.ur.prof_field_sales_tax.includes('19.5%'));
});

test('Plan 504: the amount stays PKR only (Rs)', () => {
  for (const price of [1000, 1500, 1600, 2000, 2500, 3000]) {
    const amount = formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: price }));
    assert.match(amount, /^PKR /, `PKR ${price} tax must read in PKR only, got ${amount}`);
    assert.ok(!/[€$£]/.test(amount), 'no other currency symbol');
  }
});

test('Plan 504: sibling Service-group keys still resolve (no dict damage)', () => {
  assert.equal(t('prof_field_package', 'en'), 'Package / speed');
  assert.equal(t('prof_field_package', 'ur'), 'پیکیج / رفتار');
  assert.equal(t('prof_field_selling', 'en'), 'Monthly selling amount');
  assert.equal(t('prof_field_selling', 'ur'), 'ماہانہ فروخت رقم');
});
