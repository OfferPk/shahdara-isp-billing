/**
 * receipt-preferences.test.js — SISP-91: Per-Customer Receipt Language
 * & Channel Preference.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: preferredReceiptLang 'urdu' on a customer renders their
 *    receipt in Urdu script even when the UI language is English (the
 *    app's UI language defaults to 'en'; the saved preference wins).
 *  - Sanitizers: only the enumerated lang/channel values survive;
 *    anything else (junk, wrong case, non-string) becomes null.
 *  - SISP-76 composition — ONE mapping in receipt-preferences.js:
 *    an explicit channel always wins; with no channel, the legacy
 *    prefersSms === true implies channel 'sms'; setting an explicit
 *    channel via addCustomer/updateCustomerProfile keeps prefersSms
 *    in sync ('sms' -> true, any other channel -> false); a legacy
 *    { prefersSms }-only save is untouched by the composition.
 *  - Backup round trip: persistState -> readState keeps both fields
 *    (backup export embeds the same customer records and restore goes
 *    through readState), and junk values are dropped on load.
 *  - Quick Collect formatter: no preference -> the bilingual draft is
 *    byte-identical to the pre-SISP-91 text; urdu/roman/english render
 *    single-language drafts.
 *  - PNG slip model: saved 'urdu'/'english' collapse the bilingual
 *    labels to that segment; unset keeps the bilingual slip.
 *  - Field Mode markup: 'wa_png' leads with the PNG button, every
 *    other case keeps the pre-SISP-91 order.
 *  - i18n: every prof_form_receipt_* / prof_rcpt_* key exists in en+ur.
 *  - Wiring: index.html carries both selects; app.js loads + saves them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_LANGS,
  RECEIPT_CHANNELS,
  sanitizeReceiptLang,
  sanitizeReceiptChannel,
  receiptLangPreference,
  receiptChannelPreference,
  prefersSmsForChannel
} from '../receipt-preferences.js';
import { customerPrefersSms } from '../sms-fallback.js';
import { createInitialState, addCustomer, updateCustomerProfile, readState, persistState, saveBillMonth } from '../core.js';
import { executeQuickCollection, formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { buildPaymentReceipt } from '../receipt.js';
import { resolveReceiptWhatsAppAction } from '../profile-ui.js';
import { buildPngReceiptModel, localizePngLabel } from '../png-receipt.js';
import { fieldModeReceiptActionMarkup } from '../field-mode.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-19T10:00:00Z');

function stateWithCustomer(name, options = {}) {
  let state = createInitialState();
  state = addCustomer(state, name, REF, { phone: '+923001234567', ...options });
  return { state, customer: state.customers[state.customers.length - 1] };
}

/* ---------------- sanitizers + the one shared mapping ---------------- */

test('sanitizers accept only the enumerated values', () => {
  for (const lang of RECEIPT_LANGS) assert.equal(sanitizeReceiptLang(lang), lang);
  for (const channel of RECEIPT_CHANNELS) assert.equal(sanitizeReceiptChannel(channel), channel);
  for (const junk of ['URDU', 'Urdu', 'roman-urdu', '', ' ', 0, 1, true, null, undefined, {}, []]) {
    assert.equal(sanitizeReceiptLang(junk), null, String(junk));
    assert.equal(sanitizeReceiptChannel(junk), null, String(junk));
  }
});

test('the one mapping: explicit channel wins; legacy prefersSms implies sms', () => {
  assert.equal(receiptChannelPreference({ preferredReceiptChannel: 'sms' }), 'sms');
  assert.equal(receiptChannelPreference({ prefersSms: true }), 'sms');
  assert.equal(receiptChannelPreference({ preferredReceiptChannel: 'wa_png', prefersSms: true }), 'wa_png');
  assert.equal(receiptChannelPreference({ preferredReceiptChannel: 'thermal_58', prefersSms: true }), 'thermal_58');
  assert.equal(receiptChannelPreference({ preferredReceiptChannel: 'junk', prefersSms: true }), 'sms');
  assert.equal(receiptChannelPreference({}), null);
  assert.equal(receiptChannelPreference(null), null);
  assert.equal(receiptChannelPreference(undefined), null);
  assert.equal(receiptLangPreference({ preferredReceiptLang: 'roman' }), 'roman');
  assert.equal(receiptLangPreference({ preferredReceiptLang: 'junk' }), null);
  assert.equal(receiptLangPreference({}), null);
});

test('prefersSmsForChannel: explicit channel decides, unset defers to the fallback', () => {
  assert.equal(prefersSmsForChannel('sms', false), true);
  assert.equal(prefersSmsForChannel('sms', true), true);
  assert.equal(prefersSmsForChannel('wa_text', true), false);
  assert.equal(prefersSmsForChannel('wa_png', true), false);
  assert.equal(prefersSmsForChannel('thermal_58', true), false);
  assert.equal(prefersSmsForChannel(null, true), true);
  assert.equal(prefersSmsForChannel(undefined, false), false);
  assert.equal(prefersSmsForChannel('junk', true), true);
});

/* ---------------- storage on the customer record ---------------- */

test('addCustomer stores sanitized preferences; junk becomes null', () => {
  const { customer } = stateWithCustomer('Synthetic Pref Fan', { preferredReceiptLang: 'urdu', preferredReceiptChannel: 'wa_png' });
  assert.equal(customer.preferredReceiptLang, 'urdu');
  assert.equal(customer.preferredReceiptChannel, 'wa_png');
  const { customer: junk } = stateWithCustomer('Synthetic Junk Pref', { preferredReceiptLang: 'URDU', preferredReceiptChannel: 'pigeon' });
  assert.equal(junk.preferredReceiptLang, null);
  assert.equal(junk.preferredReceiptChannel, null);
  const { customer: plain } = stateWithCustomer('Synthetic No Pref', {});
  assert.equal(plain.preferredReceiptLang, null);
  assert.equal(plain.preferredReceiptChannel, null);
});

test('addCustomer: an explicit channel syncs prefersSms at creation', () => {
  const { customer: smsFan } = stateWithCustomer('Synthetic Add Sms', { preferredReceiptChannel: 'sms' });
  assert.equal(smsFan.prefersSms, true);
  assert.equal(customerPrefersSms(smsFan), true);
  // Explicit non-SMS channel wins over a stray prefersSms: true.
  const { customer: pngFan } = stateWithCustomer('Synthetic Add Png', { preferredReceiptChannel: 'wa_png', prefersSms: true });
  assert.equal(pngFan.prefersSms, false);
  assert.equal(customerPrefersSms(pngFan), false);
  // No channel: the legacy flag rules, exactly as SISP-76 built it.
  const { customer: legacy } = stateWithCustomer('Synthetic Add Legacy', { prefersSms: true });
  assert.equal(legacy.prefersSms, true);
  assert.equal(receiptChannelPreference(legacy), 'sms');
});

test('updateCustomerProfile: setting a channel keeps prefersSms in sync', () => {
  const { state, customer } = stateWithCustomer('Synthetic Sync', {});
  let next = updateCustomerProfile(state, customer.id, { preferredReceiptChannel: 'sms' }, REF);
  let saved = next.customers.find(c => c.id === customer.id);
  assert.equal(saved.preferredReceiptChannel, 'sms');
  assert.equal(saved.prefersSms, true);

  next = updateCustomerProfile(next, customer.id, { preferredReceiptChannel: 'wa_text' }, REF);
  saved = next.customers.find(c => c.id === customer.id);
  assert.equal(saved.preferredReceiptChannel, 'wa_text');
  assert.equal(saved.prefersSms, false);

  // Clearing the channel hands the decision back to the checkbox value
  // carried by the same save.
  next = updateCustomerProfile(next, customer.id, { preferredReceiptChannel: '', prefersSms: true }, REF);
  saved = next.customers.find(c => c.id === customer.id);
  assert.equal(saved.preferredReceiptChannel, null);
  assert.equal(saved.prefersSms, true);
  assert.equal(receiptChannelPreference(saved), 'sms');
});

test('updateCustomerProfile: a legacy prefersSms-only save is untouched by the composition', () => {
  const { state, customer } = stateWithCustomer('Synthetic Legacy Save', { preferredReceiptChannel: 'wa_png' });
  const next = updateCustomerProfile(state, customer.id, { prefersSms: true }, REF);
  const saved = next.customers.find(c => c.id === customer.id);
  assert.equal(saved.prefersSms, true);
  // The stored channel is preserved, and the explicit channel still
  // wins in the ONE mapping (the SISP-76 checkbox stays a fallback).
  assert.equal(saved.preferredReceiptChannel, 'wa_png');
  assert.equal(receiptChannelPreference(saved), 'wa_png');
  // An unrelated save changes neither field.
  const renamed = updateCustomerProfile(next, customer.id, { name: 'Synthetic Legacy Renamed' }, REF);
  const after = renamed.customers.find(c => c.id === customer.id);
  assert.equal(after.prefersSms, true);
  assert.equal(after.preferredReceiptChannel, 'wa_png');
});

test('backup round trip: persistState -> readState keeps both preference fields', () => {
  const { state, customer } = stateWithCustomer('Synthetic Round Trip', {
    preferredReceiptLang: 'roman',
    preferredReceiptChannel: 'sms'
  });
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  persistState(state, storage);
  const loaded = readState(storage);
  const back = loaded.customers.find(c => c.id === customer.id);
  assert.equal(back.preferredReceiptLang, 'roman');
  assert.equal(back.preferredReceiptChannel, 'sms');
  assert.equal(back.prefersSms, true);
  // Junk in a restored file is sanitized away, never trusted.
  const corrupt = JSON.parse(storage.data[Object.keys(storage.data)[0]]);
  corrupt.customers.find(c => c.id === customer.id).preferredReceiptLang = 'klingon';
  corrupt.customers.find(c => c.id === customer.id).preferredReceiptChannel = 'pigeon';
  storage.setItem(Object.keys(storage.data)[0], JSON.stringify(corrupt));
  const reloaded = readState(storage).customers.find(c => c.id === customer.id);
  assert.equal(reloaded.preferredReceiptLang, null);
  assert.equal(reloaded.preferredReceiptChannel, null);
});

/* ---------------- receipt rendering: the spec pin ---------------- */

function collectFor(customerName, options = {}) {
  let { state, customer } = stateWithCustomer(customerName, options);
  state = saveBillMonth(state, customer.id, { month: '2026-10', dueAmount: 3000, status: 'pending' }, REF);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: customer.id, month: '2026-10', amount: 3000, date: '2026-10-19', method: 'Cash'
  }, REF);
  const savedCustomer = nextState.customers.find(c => c.id === customer.id);
  const bill = savedCustomer.bills.find(b => b.month === '2026-10');
  const payment = bill.payments[bill.payments.length - 1];
  return { state: nextState, customer: savedCustomer, bill, payment, qcReceipt: receipt };
}

test('SPEC PIN: preferredReceiptLang urdu renders the profile receipt in Urdu script (UI language English)', () => {
  const { customer } = stateWithCustomer('Synthetic Urdu Fan', { preferredReceiptLang: 'urdu' });
  // House fixture shape (see customer-profile-ui.test.js): the profile
  // receipt action is keyed by the owning customer's id.
  const receipt = {
    customerId: customer.id, paymentId: 'synthetic-payment-91', receiptNumber: 'RCPT-101',
    amount: 3000, paidAmount: 3000, date: '2026-10-19', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 3000, balanceDueCents: 0
  };
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  assert.equal(action.type, 'draft');
  const text = action.draft.message;
  assert.ok(text.includes('ادائیگی کی رسید'), text);
  assert.ok(text.includes('رقم ادا شدہ'), text);
  assert.ok(!text.includes('Payment Receipt'), text);
  assert.ok(!text.includes('PAYMENT RECEIPT'), text);
});

test('profile receipt without a preference keeps the English draft under an English UI (control)', () => {
  const { customer } = stateWithCustomer('Synthetic Default Fan', {});
  const receipt = {
    customerId: customer.id, paymentId: 'synthetic-payment-92', receiptNumber: 'RCPT-102',
    amount: 3000, paidAmount: 3000, date: '2026-10-19', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 3000, balanceDueCents: 0
  };
  const action = resolveReceiptWhatsAppAction(customer, receipt);
  assert.equal(action.type, 'draft');
  const text = action.draft.message;
  assert.ok(text.includes('PAYMENT RECEIPT'), text);
  assert.ok(text.includes('Amount Paid'), text);
  assert.ok(!text.includes('ادائیگی'), text);
});

test('profile receipt honours roman + english preferences too', () => {
  const receiptFor = (customer, n) => ({
    customerId: customer.id, paymentId: `synthetic-payment-9${n}`, receiptNumber: `RCPT-10${n}`,
    amount: 3000, paidAmount: 3000, date: '2026-10-19', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 3000, balanceDueCents: 0
  });
  const { customer: romanFan } = stateWithCustomer('Synthetic Roman Fan', { preferredReceiptLang: 'roman' });
  const romanText = resolveReceiptWhatsAppAction(romanFan, receiptFor(romanFan, 3)).draft.message;
  assert.ok(romanText.includes('ADAIGI KI RASEED'), romanText);
  assert.ok(romanText.includes('Raqam Ada'), romanText);
  assert.ok(!romanText.includes('ادائیگی'), romanText);

  const { customer: englishFan } = stateWithCustomer('Synthetic English Fan', { preferredReceiptLang: 'english' });
  const englishText = resolveReceiptWhatsAppAction(englishFan, receiptFor(englishFan, 4)).draft.message;
  assert.ok(englishText.includes('PAYMENT RECEIPT'), englishText);
  assert.ok(!englishText.includes('ادائیگی'), englishText);
});

test('end to end: a real collection for an urdu-preference customer drafts in Urdu via the QC/modal path', () => {
  const { customer, qcReceipt } = collectFor('Synthetic E2E Urdu', { preferredReceiptLang: 'urdu' });
  assert.equal(customer.preferredReceiptLang, 'urdu');
  // The Quick Collect modal + Field Mode resolve the language exactly
  // this way from the saved customer record.
  const draft = formatQuickCollectWhatsAppReceipt(qcReceipt, { lang: receiptLangPreference(customer) });
  assert.ok(draft.text.includes('*ادائیگی کی رسید*'), draft.text);
  assert.ok(!draft.text.includes('PAYMENT RECEIPT'), draft.text);
  // Control: the same receipt with no preference stays bilingual.
  const control = formatQuickCollectWhatsAppReceipt(qcReceipt);
  assert.ok(control.text.includes('*PAYMENT RECEIPT / ادائیگی کی رسید*'), control.text);
});

/* ---------------- Quick Collect formatter ---------------- */

const QC_RECEIPT = {
  receiptNumber: 'RCPT-101', date: '2026-10-19', customerName: 'Synthetic Qc', customerNumber: 7,
  phone: '03001234567', area: 'Test Area', month: 'October 2026', amount: 3000, method: 'Cash',
  newTotalDues: 0
};

test('Quick Collect formatter: no preference is byte-identical to the bilingual draft', () => {
  const plain = formatQuickCollectWhatsAppReceipt(QC_RECEIPT);
  const explicitNull = formatQuickCollectWhatsAppReceipt(QC_RECEIPT, { lang: null });
  const junk = formatQuickCollectWhatsAppReceipt(QC_RECEIPT, { lang: 'klingon' });
  assert.equal(explicitNull.text, plain.text);
  assert.equal(junk.text, plain.text);
  assert.ok(plain.text.includes('*PAYMENT RECEIPT / ادائیگی کی رسید*'), plain.text);
  assert.ok(plain.text.includes('💵 *Amount Received:* PKR 3,000'), plain.text);
  assert.ok(plain.text.includes('📌 *Status:* مکمل ادا شدہ (PAID IN FULL)'), plain.text);
});

test('Quick Collect formatter: urdu / roman / english single-language drafts', () => {
  const urdu = formatQuickCollectWhatsAppReceipt(QC_RECEIPT, { lang: 'urdu' });
  assert.ok(urdu.text.includes('*ادائیگی کی رسید*'), urdu.text);
  assert.ok(urdu.text.includes('💵 *موصولہ رقم:* PKR 3,000'), urdu.text);
  assert.ok(!urdu.text.includes('PAYMENT RECEIPT'), urdu.text);
  const roman = formatQuickCollectWhatsAppReceipt(QC_RECEIPT, { lang: 'roman' });
  assert.ok(roman.text.includes('*ADAIGI KI RASEED*'), roman.text);
  assert.ok(roman.text.includes('💵 *Wasool shuda raqam:* PKR 3,000'), roman.text);
  const english = formatQuickCollectWhatsAppReceipt(QC_RECEIPT, { lang: 'english' });
  assert.ok(english.text.includes('*PAYMENT RECEIPT*'), english.text);
  assert.ok(english.text.includes('💵 *Amount Received:* PKR 3,000'), english.text);
  assert.ok(!english.text.includes('ادائیگی'), english.text);
  // The receipt's own stamped language (receipt.receiptLang) works too.
  const stamped = formatQuickCollectWhatsAppReceipt({ ...QC_RECEIPT, receiptLang: 'urdu' });
  assert.equal(stamped.text, urdu.text);
});

/* ---------------- PNG slip model ---------------- */

const PNG_RECEIPT = {
  receiptNumber: 'RCPT-101', billMonth: '2026-10', monthLabel: 'October 2026',
  paidAmount: 3000, newBalanceDue: 0, method: 'Cash',
  breakdown: { previousArrears: 0, packageAmount: 3000, kistAmount: 0 }
};
const PNG_CUSTOMER = { name: 'Synthetic Png', customerNumber: 7, area: 'Test Area', bills: [] };

test('localizePngLabel collapses bilingual pairs per language only', () => {
  assert.equal(localizePngLabel('Customer / صارف', 'urdu'), 'صارف');
  assert.equal(localizePngLabel('Customer / صارف', 'english'), 'Customer');
  assert.equal(localizePngLabel('Customer / صارف', 'roman'), 'Customer / صارف');
  assert.equal(localizePngLabel('Customer / صارف', null), 'Customer / صارف');
  assert.equal(localizePngLabel('Late Fee Surcharge', 'urdu'), 'Late Fee Surcharge');
  assert.equal(localizePngLabel('Amount Paid / Wusool Paya', 'english'), 'Amount Paid');
  assert.equal(localizePngLabel('Amount Paid / Wusool Paya', 'urdu'), 'Amount Paid / Wusool Paya');
});

test('PNG model: saved urdu/english collapse the slip labels; unset keeps the bilingual slip', () => {
  const base = buildPngReceiptModel(PNG_RECEIPT, PNG_CUSTOMER, {});
  assert.equal(base.lang, null);
  assert.equal(base.title, 'Payment Receipt / رسید ادائیگی');
  assert.equal(base.subLabels.customer, 'Customer / صارف');
  assert.ok(base.financial.some(row => row.label === 'Amount Paid / Wusool Paya'));

  const urdu = buildPngReceiptModel(PNG_RECEIPT, { ...PNG_CUSTOMER, preferredReceiptLang: 'urdu' }, {});
  assert.equal(urdu.lang, 'urdu');
  assert.equal(urdu.title, 'رسید ادائیگی');
  assert.equal(urdu.detailsTitle, 'رقم کی تفصیل');
  assert.equal(urdu.subLabels.customer, 'صارف');
  assert.ok(urdu.financial.some(row => row.label === 'طریقہ'));

  const english = buildPngReceiptModel(PNG_RECEIPT, { ...PNG_CUSTOMER, preferredReceiptLang: 'english' }, {});
  assert.equal(english.title, 'Payment Receipt');
  assert.equal(english.subLabels.customer, 'Customer');
  assert.ok(english.financial.some(row => row.label === 'Amount Paid'));
  // An explicit options.lang beats the stored preference.
  const override = buildPngReceiptModel(PNG_RECEIPT, { ...PNG_CUSTOMER, preferredReceiptLang: 'urdu' }, { lang: 'english' });
  assert.equal(override.lang, 'english');
});

/* ---------------- Field Mode channel ordering ---------------- */

test('fieldModeReceiptActionMarkup: wa_png leads, everything else keeps the house order', () => {
  const pngFirst = fieldModeReceiptActionMarkup({ hasPrint58: true, hasPngReceipt: true, preferredChannel: 'wa_png' });
  assert.ok(pngFirst.indexOf('pngReceipt') < pngFirst.indexOf('print58'), pngFirst);
  for (const channel of [null, undefined, 'wa_text', 'sms', 'thermal_58']) {
    const markup = fieldModeReceiptActionMarkup({ hasPrint58: true, hasPngReceipt: true, preferredChannel: channel });
    assert.ok(markup.indexOf('print58') < markup.indexOf('pngReceipt'), `${channel}: ${markup}`);
  }
});

/* ---------------- i18n + wiring ---------------- */

test('i18n: every SISP-91 key exists in en + ur', () => {
  const keys = [
    'prof_form_receipt_lang', 'prof_form_receipt_lang_note',
    'prof_form_receipt_channel', 'prof_form_receipt_channel_note',
    'prof_rcpt_default', 'prof_rcpt_lang_urdu', 'prof_rcpt_lang_roman', 'prof_rcpt_lang_english',
    'prof_rcpt_ch_wa_text', 'prof_rcpt_ch_wa_png', 'prof_rcpt_ch_sms', 'prof_rcpt_ch_thermal58'
  ];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
  }
});

test('wiring: profile form carries both selects and app.js loads + saves them', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="preferredReceiptLangSelect"'));
  assert.ok(html.includes('id="preferredReceiptChannelSelect"'));
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("$('#preferredReceiptLangSelect').value = customer.preferredReceiptLang ?? ''"));
  assert.ok(app.includes("$('#preferredReceiptChannelSelect').value = customer.preferredReceiptChannel ?? ''"));
  assert.ok(app.includes("preferredReceiptLang: $('#preferredReceiptLangSelect')?.value || ''"));
  assert.ok(app.includes("preferredReceiptChannel: $('#preferredReceiptChannelSelect')?.value || ''"));
  // Dark mode: the selects reuse the house .profile-field pattern (no
  // new CSS, no hardcoded colours in the added markup).
  assert.ok(!/preferredReceipt( Lang|Channel)Select[^>]*style=/.test(html));
});
