import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePakistanPhone, validatePositiveAmount } from '../form-validation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');

test('validatePakistanPhone accepts valid international Pakistani mobile format', () => {
  const res1 = validatePakistanPhone('+923001234567');
  assert.equal(res1.valid, true);
  assert.equal(res1.type, 'pk-international');
  assert.match(res1.message, /Valid Pakistani mobile/);

  const res2 = validatePakistanPhone('+92 300 1234567');
  assert.equal(res2.valid, true);
  assert.equal(res2.type, 'pk-international');

  const res3 = validatePakistanPhone('00923219876543');
  assert.equal(res3.valid, true);
  assert.equal(res3.type, 'pk-international');
});

test('validatePakistanPhone accepts local Pakistani 03xx mobile and gives WhatsApp international tip', () => {
  const res = validatePakistanPhone('03001234567');
  assert.equal(res.valid, true);
  assert.equal(res.type, 'pk-local');
  assert.equal(res.tip, true);
  assert.match(res.message, /\+923001234567/);
});

test('validatePakistanPhone rejects incomplete numbers or non-numeric characters', () => {
  const res1 = validatePakistanPhone('0300123');
  assert.equal(res1.valid, false);
  assert.equal(res1.tip, true);
  assert.match(res1.message, /Incomplete local number/);

  const res2 = validatePakistanPhone('0300-abc-def');
  assert.equal(res2.valid, false);
  assert.match(res2.message, /Only numbers, spaces, dashes/);

  const res3 = validatePakistanPhone('');
  assert.equal(res3.valid, true);
  assert.equal(res3.empty, true);
});

test('validatePositiveAmount accepts valid positive numbers and handles constraints', () => {
  assert.equal(validatePositiveAmount(1500).valid, true);
  assert.equal(validatePositiveAmount('2500.50').valid, true);
  assert.equal(validatePositiveAmount('0').valid, true);
  assert.equal(validatePositiveAmount('0', { allowZero: false }).valid, false);
  assert.equal(validatePositiveAmount(-50).valid, false);
  assert.equal(validatePositiveAmount('-10').message, 'Amount cannot be negative.');
  assert.equal(validatePositiveAmount('abc').valid, false);
  assert.equal(validatePositiveAmount('', { required: true }).valid, false);
  assert.equal(validatePositiveAmount('', { required: false }).valid, true);
});

test('index.html contains phoneValidationHint elements and styles.css provides hint styles', () => {
  assert.match(index, /id="phoneValidationHint"/);
  assert.match(index, /id="newCustomerPhoneHint"/);
  assert.match(styles, /\.phone-validation-hint/);
  assert.match(styles, /\.phone-validation-hint\.valid/);
  assert.match(styles, /\.phone-validation-hint\.tip/);
  assert.match(styles, /\.phone-validation-hint\.invalid/);
});

test('app.js wires phone validation helper and negative amount guards', () => {
  assert.match(app, /wirePhoneValidationHelper\('#phoneInput',\s*'#phoneValidationHint'\)/);
  assert.match(app, /wirePhoneValidationHelper\('#newCustomerPhone',\s*'#newCustomerPhoneHint'\)/);
  assert.match(app, /#monthlySellingAmountInput/);
  assert.match(app, /Number\(val\)\s*<\s*0/);
});
