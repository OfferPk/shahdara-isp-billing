/**
 * sms-fallback.test.js — SISP-76: 1-Tap Native SIM SMS Slip for
 * non-WhatsApp / keypad customers.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: phone 0300-1234567 + Rs 3,000 paid generates a valid
 *    sms:+923001234567?body=... URI whose body is under 160 chars.
 *  - Phone normalization reuses the house normalizer: 03xx, +92,
 *    92 and 0092 forms all land on the same +923xx number; landlines,
 *    junk and non-Pakistani numbers yield NO url (never malformed).
 *  - Bodies are pure and length-pinned: even a huge name + receipt
 *    number stays <= 160 chars while the amount paid and the balance
 *    are always preserved verbatim.
 *  - prefersSms: sanitized in the customer validator (only === true
 *    survives a save/load round trip), settable via addCustomer
 *    options and updateCustomerProfile, defaults false.
 *  - i18n: every sms_* / prof_form_prefers_sms / prof_view_sms key
 *    exists in en + ur.
 *  - Wiring: app.js imports sms-fallback (receipts + reminder modal
 *    + field-mode host callback + profile form), field-mode renders
 *    the SMS button, index.html carries the checkbox + modal button.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SMS_BODY_MAX_LENGTH,
  normalizeSmsPhone,
  buildSmsReceiptBody,
  buildSmsReminderBody,
  buildSmsUrl,
  buildSmsReceiptUrl,
  buildSmsReminderUrl,
  customerPrefersSms
} from '../sms-fallback.js';
import { createInitialState, addCustomer, updateCustomerProfile, readState, persistState } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const bodyOf = (url) => decodeURIComponent(url.split('?body=')[1] ?? '');

test('SPEC PIN: 0300-1234567 + Rs 3,000 paid -> valid sms:+923001234567 URI under 160 chars', () => {
  const sms = buildSmsReceiptUrl({ phone: '0300-1234567', customerName: 'Hamza', amount: 3000, balanceDue: 0 });
  assert.equal(sms.valid, true);
  assert.equal(sms.intlDigits, '923001234567');
  assert.ok(sms.url.startsWith('sms:+923001234567?body='), sms.url);
  const body = bodyOf(sms.url);
  assert.equal(body, sms.body);
  assert.ok(body.length <= SMS_BODY_MAX_LENGTH, `body ${body.length} chars: ${body}`);
  assert.ok(body.length < 160);
  assert.ok(body.includes('Rs 3,000'), body);
  assert.ok(body.includes('Baqaya: Rs 0'), body);
});

test('phone normalization: every house format lands on the same number', () => {
  for (const phone of ['0300-1234567', '0300 1234567', '03001234567', '+923001234567', '923001234567', '00923001234567', '3001234567']) {
    const norm = normalizeSmsPhone(phone);
    assert.equal(norm.valid, true, phone);
    assert.equal(norm.intlDigits, '923001234567', phone);
  }
});

test('invalid or non-mobile phones yield no URL, never a malformed link', () => {
  for (const phone of ['', '12345', '0213456789', '030012345', '030012345678', '+14155552671', 'not-a-phone', null, undefined]) {
    const sms = buildSmsReceiptUrl({ phone, customerName: 'X', amount: 1000, balanceDue: 0 });
    assert.equal(sms.valid, false, String(phone));
    assert.equal(sms.url, '', String(phone));
  }
  assert.equal(buildSmsUrl('0300-1234567', 'hello').url.startsWith('sms:+923001234567?body='), true);
  assert.equal(buildSmsUrl('', 'hello').url, '');
});

test('receipt body: amount + balance always preserved, even with a huge name', () => {
  const hugeName = 'Muhammad '.repeat(30).trim();
  const body = buildSmsReceiptBody({ customerName: hugeName, amount: 3000, balanceDue: 1500, receiptNumber: 'REC-2610-0042-AB12' });
  assert.ok(body.length <= SMS_BODY_MAX_LENGTH, `body ${body.length} chars: ${body}`);
  assert.ok(body.includes('Rs 3,000 wasool'), body);
  assert.ok(body.includes('Baqaya: Rs 1,500'), body);
  // Extreme amounts still fit with both figures intact.
  const big = buildSmsReceiptBody({ customerName: hugeName, amount: 125000, balanceDue: 987654, receiptNumber: 'REC-2610-0042-AB12' });
  assert.ok(big.length <= SMS_BODY_MAX_LENGTH, `body ${big.length} chars: ${big}`);
  assert.ok(big.includes('Rs 125,000'), big);
  assert.ok(big.includes('Rs 987,654'), big);
});

test('receipt body: null balance omits the balance segment entirely', () => {
  const body = buildSmsReceiptBody({ customerName: 'Ali', amount: 2000, balanceDue: null });
  assert.ok(body.length <= SMS_BODY_MAX_LENGTH);
  assert.ok(body.includes('Rs 2,000'), body);
  assert.ok(!body.includes('Baqaya'), body);
});

test('reminder body: balance preserved and within budget; generic form without a balance', () => {
  const body = buildSmsReminderBody({ customerName: 'Muhammad Aslam Khan Chaudhry Sahib', balanceDue: 4500, dueText: '5th of month' });
  assert.ok(body.length <= SMS_BODY_MAX_LENGTH, `body ${body.length} chars: ${body}`);
  assert.ok(body.includes('Rs 4,500'), body);
  const generic = buildSmsReminderBody({ customerName: 'Ali', balanceDue: null });
  assert.ok(generic.length <= SMS_BODY_MAX_LENGTH);
  assert.ok(!generic.includes('Rs'), generic);
  const url = buildSmsReminderUrl({ phone: '0321-7654321', customerName: 'Ali', balanceDue: 4500 });
  assert.ok(url.url.startsWith('sms:+923217654321?body='));
  assert.ok(bodyOf(url.url).includes('Rs 4,500'));
});

test('prefersSms: defaults false, sanitized on load, editable via profile update', () => {
  const ref = new Date('2026-10-29T00:00:00Z');
  let state = createInitialState([]);
  state = addCustomer(state, 'Synthetic Keypad', ref, { phone: '03001234567' });
  const plain = state.customers[0];
  assert.equal(plain.prefersSms, false);
  assert.equal(customerPrefersSms(plain), false);

  state = addCustomer(state, 'Synthetic Sms Fan', ref, { phone: '03001234567', prefersSms: true });
  const fan = state.customers.find(c => c.name === 'Synthetic Sms Fan');
  assert.equal(fan.prefersSms, true);
  assert.equal(customerPrefersSms(fan), true);

  // Save/load round trip keeps the true flag; a corrupt value loads false.
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  persistState(state, storage);
  const loaded = readState(storage);
  assert.equal(loaded.customers.find(c => c.id === fan.id).prefersSms, true);
  const corrupt = JSON.parse(storage.data[Object.keys(storage.data)[0]]);
  corrupt.customers.find(c => c.id === fan.id).prefersSms = 'yes';
  storage.setItem(Object.keys(storage.data)[0], JSON.stringify(corrupt));
  assert.equal(readState(storage).customers.find(c => c.id === fan.id).prefersSms, false);

  // Profile update path toggles it both ways.
  const on = updateCustomerProfile(state, plain.id, { prefersSms: true }, ref);
  assert.equal(on.customers.find(c => c.id === plain.id).prefersSms, true);
  const off = updateCustomerProfile(on, plain.id, { prefersSms: false }, ref);
  assert.equal(off.customers.find(c => c.id === plain.id).prefersSms, false);
});

test('i18n: sms keys exist in en + ur and never resolve to the raw key', () => {
  for (const key of ['sms_slip_btn', 'sms_slip_aria', 'prof_form_prefers_sms', 'prof_form_prefers_sms_note', 'prof_view_sms']) {
    for (const lang of ['en', 'ur']) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${lang}.${key}`);
      assert.ok(TRANSLATIONS[lang][key].length > 0, `${lang}.${key}`);
      assert.notEqual(TRANSLATIONS[lang][key], key, `${lang}.${key}`);
    }
  }
});

test('wiring: app.js, field-mode.js, index.html and core.js carry the SISP-76 surfaces', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const fieldMode = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './sms-fallback.js'"), 'app.js imports sms-fallback');
  assert.ok(app.includes('receiptSmsSlipMarkup'), 'receipt SMS markup in app.js');
  assert.ok(app.includes('sendSmsReminderBtn'), 'reminder modal SMS button wired');
  assert.ok(app.includes('onSmsSlipUrl'), 'field-mode host callback passed');
  assert.ok(app.includes('prefersSmsCheckbox'), 'profile form checkbox wired');
  assert.ok(fieldMode.includes('field-mode-sms-btn'), 'field-mode renders the SMS button');
  assert.ok(fieldMode.includes('onSmsSlipUrl'), 'field-mode accepts the host callback');
  assert.ok(html.includes('id="prefersSmsCheckbox"'), 'index.html has the preference checkbox');
  assert.ok(html.includes('id="sendSmsReminderBtn"'), 'index.html has the modal SMS button');
  assert.ok(core.includes('prefersSms:customer.prefersSms === true'), 'core sanitizes prefersSms');
  const smsModule = readFileSync(new URL('../sms-fallback.js', import.meta.url), 'utf8');
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(smsModule), 'sms-fallback.js carries no hardcoded colours');
});
