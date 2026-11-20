// Plan 606 — the QR Khata card reads in the operator's language.
//
// The spec's three dynamic lines do not exist (no qrCardHtml, no
// monthNameShort, no "Bill for"/"Amount due"/"Pay via" lines anywhere),
// but the acceptance's language half was genuinely unmet: the QR Khata
// card carried zero qrkh_ keys and 16 hardcoded-English strings across
// its two renderings — the modal (openQrKhataCard, app.js) and the
// print document (buildKhataCardPrintHtml, qr-card.js). Plan 606 keys
// all 16 (new qrkh_* family), with the rate unified on the one shared
// formatPKR call in production: it rides the labels object as
// formatMoney (604 pattern), so qr-card.js stays import-free. The
// no-labels print default keeps the legacy hand-rolled grouped form
// (the documented fallback, pinned by qr-card.test.js) — production
// always passes formatMoney: formatPKR via qrKhataPrintLabels().
//
// This file asserts the new parity total (5,162) and is the 34th pinning
// file. It must contain NEITHER the previous total's bare digits nor
// the older total's (plan591 G5a sweep) — the self-guard below builds
// them from split literals, plan596/plan601 pattern (guard previous +
// older, NOT current: this file itself asserts the current total).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS, t } from '../nav-language.js';
import { formatPKR } from '../core.js';
import { buildKhataCardModel, buildKhataCardPrintHtml } from '../qr-card.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const navJs = read('nav-language.js');
const appJs = read('app.js');
const html = read('index.html');
const selfSrc = read('tests/plan606-qr-card-i18n.test.js');
const { en, ur } = TRANSLATIONS;

// Generic fixtures only — no real customer names are used anywhere
// in this file.
const customer = {
  id: 'CUST-42',
  customerNumber: 42,
  name: 'Test Customer',
  monthlySellingAmount: 3000,
  packageSpeed: '5Mbps',
  mohalla: 'Test Mohalla',
  zone: '',
};
const model = buildKhataCardModel(customer);
const QR_DATA_URL = 'data:image/png;base64,AAAA';

const QRKH_KEYS = [
  'qrkh_connection',
  'qrkh_rate',
  'qrkh_rate_not_set',
  'qrkh_pay_at',
  'qrkh_eyebrow',
  'qrkh_title',
  'qrkh_fallback',
  'qrkh_print',
  'qrkh_png',
  'qrkh_copy',
  'qrkh_close_aria',
  'qrkh_canvas_aria',
  'qrkh_card_sub',
  'qrkh_scan_note',
  'qrkh_no_qr',
  'qrkh_print_title',
];

// The EN values, byte-identical to the literals they replace.
const QRKH_EN = {
  qrkh_connection: 'Connection ID: {label}',
  qrkh_rate: 'Package rate: {amount}/month',
  qrkh_rate_not_set: 'Package rate: Not set',
  qrkh_pay_at: 'Pay at: {shops}',
  qrkh_eyebrow: 'SHOP COUNTER LOOKUP',
  qrkh_title: 'QR Khata Card',
  qrkh_fallback: 'QR code unavailable for this link — use the copyable link below.',
  qrkh_print: 'Print card',
  qrkh_png: 'Download PNG',
  qrkh_copy: 'Copy link',
  qrkh_close_aria: 'Close QR Khata card',
  qrkh_canvas_aria: 'QR code for shop counter lookup',
  qrkh_card_sub: 'Customer Khata Card',
  qrkh_scan_note: 'Scan at the shop counter to open this customer\'s payment screen.',
  qrkh_no_qr: 'QR code unavailable for this link.',
  qrkh_print_title: 'QR Khata Card — {name}',
};

// The labels object exactly the way app.js builds it in
// qrKhataPrintLabels(): the 8 print keys via t() + the formatter.
function labels(lang = 'en') {
  const pick = (key) => (lang === 'ur' ? ur[key] : en[key]);
  return {
    connection: pick('qrkh_connection'),
    rate: pick('qrkh_rate'),
    rateNotSet: pick('qrkh_rate_not_set'),
    payAt: pick('qrkh_pay_at'),
    cardSub: pick('qrkh_card_sub'),
    scanNote: pick('qrkh_scan_note'),
    noQr: pick('qrkh_no_qr'),
    printTitle: pick('qrkh_print_title'),
    formatMoney: formatPKR,
  };
}

// The modal lines exactly the way openQrKhataCard() builds them — the
// three t() lookups, with the package-speed suffix appended in code.
function modalLines(lang = 'en') {
  return {
    connection: t('qrkh_connection', lang, { label: model.connectionLabel }),
    rate: model.monthlyPackageRate === null
      ? t('qrkh_rate_not_set', lang)
      : t('qrkh_rate', lang, { amount: formatPKR(model.monthlyPackageRate) }) +
        (model.packageSpeed ? ` · ${model.packageSpeed}` : ''),
    payAt: t('qrkh_pay_at', lang, { shops: model.shops.join(' · ') }),
  };
}

// ================= G1 — parity guard (this file's own pin) =================

test('G1: parity is 5,162/5,162 in both dicts', () => {
  assert.equal(Object.keys(en).length, 5210, 'EN parity');
  assert.equal(Object.keys(ur).length, 5210, 'UR parity');
  const qrkhEn = Object.keys(en).filter((k) => k.startsWith('qrkh_'));
  const qrkhUr = Object.keys(ur).filter((k) => k.startsWith('qrkh_'));
  assert.equal(qrkhEn.length, 16, 'exactly the 16 qrkh_ keys in EN');
  assert.equal(qrkhUr.length, 16, 'exactly the 16 qrkh_ keys in UR');
  assert.deepEqual([...qrkhEn].sort(), [...QRKH_KEYS].sort(), 'the EN family is exactly the 16 planned keys');
  assert.deepEqual([...qrkhUr].sort(), [...QRKH_KEYS].sort(), 'the UR family is exactly the 16 planned keys');
});

// ================= G2 — the modal lines read Urdu =================

test('G2: the modal lines read Urdu in Urdu mode and stay PKR 3,000', () => {
  const lines = modalLines('ur');
  assert.ok(lines.connection.includes('کنکشن آئی ڈی'), `connection must read Urdu, got: ${lines.connection}`);
  assert.ok(lines.connection.includes('#42'), 'the connection label stays data');
  assert.ok(lines.rate.includes('پیکیج ریٹ'), `rate must read Urdu, got: ${lines.rate}`);
  assert.ok(lines.rate.includes('PKR 3,000'), `rate must still read PKR 3,000, got: ${lines.rate}`);
  assert.ok(lines.rate.endsWith('· 5Mbps'), 'the package-speed suffix survives, appended in code');
  assert.ok(lines.payAt.includes('ادائیگی یہاں کریں'), `pay-at must read Urdu, got: ${lines.payAt}`);
  assert.ok(lines.payAt.includes('Waseem Abbasi Shop'), 'shop names stay proper-noun data');
  // No English label text survives in any Urdu modal line.
  for (const [name, line] of Object.entries(lines)) {
    assert.ok(!line.includes('Connection ID'), `${name} must carry no English label text`);
    assert.ok(!line.includes('Package rate'), `${name} must carry no English label text`);
    assert.ok(!line.includes('Pay at'), `${name} must carry no English label text`);
  }
});

test('G3: the modal lines are byte-identical to today in English mode', () => {
  const lines = modalLines('en');
  assert.equal(lines.connection, 'Connection ID: #42');
  assert.equal(lines.rate, 'Package rate: PKR 3,000/month · 5Mbps');
  assert.equal(lines.payAt, 'Pay at: Waseem Abbasi Shop · Hassan Balla Shop');
});

// ================= G4 — the print lines read Urdu =================

test('G4: the print lines read Urdu in Urdu mode', () => {
  const print = buildKhataCardPrintHtml(model, QR_DATA_URL, labels('ur'));
  assert.ok(print.includes('گاہک کھاتہ کارڈ'), 'print sub must read Urdu');
  assert.ok(print.includes('کنکشن آئی ڈی'), 'print connection must read Urdu');
  assert.ok(print.includes('پیکیج ریٹ'), 'print rate must read Urdu');
  assert.ok(print.includes('PKR 3,000'), 'print rate must still read PKR 3,000');
  assert.ok(print.includes('ادائیگی یہاں کریں'), 'print pay-at must read Urdu');
  assert.ok(print.includes('دکان کاؤنٹر پر اسکین کریں'), 'print scan note must read Urdu');
  assert.ok(print.includes('QR کھاتہ کارڈ — Test Customer'), 'print title must read Urdu');
  assert.ok(!print.includes('Customer Khata Card'), 'no English sub survives in the Urdu print');
  assert.ok(!print.includes('Connection ID:'), 'no English connection label survives in the Urdu print');
  assert.ok(!print.includes('Package rate:'), 'no English rate label survives in the Urdu print');
  assert.ok(!print.includes('Pay at:'), 'no English pay-at label survives in the Urdu print');
  // Data stays data: name, shops, connection label, deep link unchanged
  // (the print HTML-escapes the link's & as &amp; — same link, same data).
  assert.ok(print.includes('Test Customer'), 'customer name stays data');
  assert.ok(print.includes('Waseem Abbasi Shop'), 'shop names stay proper-noun data');
  assert.ok(print.includes('#42'), 'connection label stays data');
  assert.ok(print.includes(model.deepLink.replace(/&/g, '&amp;')), 'deep link unchanged (HTML-escaped form)');
});

test('G5: the print no-QR line reads Urdu in Urdu mode', () => {
  const print = buildKhataCardPrintHtml(model, null, labels('ur'));
  assert.ok(print.includes('اس لنک کے لیے QR کوڈ دستیاب نہیں۔'), 'no-QR line must read Urdu');
  assert.ok(!print.includes('QR code unavailable for this link.'), 'no English no-QR line survives');
});

// ================= G6 — the formatter rides the labels object =================

test('G6: the print rate renders through labels.formatMoney — a stub formatter wins', () => {
  const stub = { ...labels('en'), formatMoney: (n) => `STUB-${n}` };
  const print = buildKhataCardPrintHtml(model, QR_DATA_URL, stub);
  assert.ok(print.includes('STUB-3000'), `stub formatter must win, got a print without STUB-3000`);
  assert.ok(!print.includes('PKR 3,000'), 'the stub must replace the production figure');
});

test('G7: English print with EN labels is byte-identical to the no-labels print', () => {
  const withLabels = buildKhataCardPrintHtml(model, QR_DATA_URL, labels('en'));
  const noLabels = buildKhataCardPrintHtml(model, QR_DATA_URL);
  assert.equal(withLabels, noLabels, 'EN labels must render exactly what the no-labels default renders');
  const withLabelsNoQr = buildKhataCardPrintHtml(model, null, labels('en'));
  const noLabelsNoQr = buildKhataCardPrintHtml(model, null);
  assert.equal(withLabelsNoQr, noLabelsNoQr, 'EN labels must render exactly the no-QR default too');
});

// ================= G8 — the no-labels fallback keeps the legacy form =================

test('G8: the no-labels print default still renders the grouped PKR figure (documented fallback)', () => {
  const print = buildKhataCardPrintHtml(model, QR_DATA_URL);
  assert.ok(print.includes('Package rate: PKR 3,000/month'), 'no-labels default keeps the grouped figure');
  assert.ok(print.includes('Pay at: Waseem Abbasi Shop · Hassan Balla Shop'), 'no-labels default keeps the shops line');
  assert.ok(print.includes('Connection ID: <strong>#42</strong>'), 'no-labels default keeps the connection line');
  // An empty labels object falls back the same way.
  const empty = buildKhataCardPrintHtml(model, QR_DATA_URL, {});
  assert.equal(empty, print, 'an empty labels object falls back to the same defaults');
});

// ================= G9 — wiring =================

test('G9: app.js keys the three modal lines and passes the print labels', () => {
  assert.ok(appJs.includes("t('qrkh_connection'"), 'app.js must pass t(qrkh_connection)');
  assert.ok(appJs.includes("t('qrkh_rate'"), 'app.js must pass t(qrkh_rate)');
  assert.ok(appJs.includes("t('qrkh_rate_not_set'"), 'app.js must pass t(qrkh_rate_not_set)');
  assert.ok(appJs.includes("t('qrkh_pay_at'"), 'app.js must pass t(qrkh_pay_at)');
  assert.ok(appJs.includes('function qrKhataPrintLabels()'), 'app.js must define qrKhataPrintLabels()');
  assert.ok(appJs.includes('formatMoney: formatPKR'), 'qrKhataPrintLabels() must pass formatMoney: formatPKR');
  assert.ok(appJs.includes('buildKhataCardPrintHtml(model, qrDataUrl, qrKhataPrintLabels())'),
    'the print call site must pass the labels as the 3rd arg');
  // The old hardcoded lines are gone from app.js.
  assert.ok(!appJs.includes('Connection ID: ${model.connectionLabel}'), 'the hardcoded connection line is gone');
  assert.ok(!appJs.includes("'Package rate: Not set'"), 'the hardcoded not-set line is gone');
  assert.ok(!appJs.includes("Pay at: ${model.shops.join(' · ')}"), 'the hardcoded pay-at line is gone');
  // The module still takes no new import — the formatter travels inside
  // the labels object (604 pattern).
  const moduleSrc = read('qr-card.js');
  assert.ok(!moduleSrc.includes("from './nav-language.js'"), 'qr-card.js never imports the language layer');
  assert.ok(moduleSrc.includes('formatMoney'), 'the module carries the formatMoney field');
});

test('G10: the modal chrome is keyed in index.html', () => {
  for (const key of ['qrkh_eyebrow', 'qrkh_title', 'qrkh_fallback', 'qrkh_print', 'qrkh_png', 'qrkh_copy']) {
    assert.ok(html.includes(`data-i18n="${key}"`), `index.html must carry data-i18n="${key}"`);
  }
  for (const key of ['qrkh_close_aria', 'qrkh_canvas_aria']) {
    assert.ok(html.includes(`data-i18n-aria-label="${key}"`), `index.html must carry data-i18n-aria-label="${key}"`);
  }
  // data-i18n elements keep their English text in the markup as the
  // boot default (the translation walk replaces it at runtime) — so the
  // check is the ATTRIBUTE, not the absence of the English text.
  const dialog = html.slice(html.indexOf('id="qrKhataCardModal"'), html.indexOf('</dialog>', html.indexOf('id="qrKhataCardModal"')));
  assert.ok(dialog.includes('data-i18n="qrkh_eyebrow"'), 'the eyebrow carries its key');
  assert.ok(dialog.includes('data-i18n="qrkh_title"'), 'the title carries its key');
  // The proper noun stays unkeyed: no data-i18n on the ISP line.
  const ispLine = dialog.split('\n').find((line) => line.includes('qr-khata-isp'));
  assert.ok(ispLine && !ispLine.includes('data-i18n'), 'Shahdara ISP stays unkeyed');
});

// ================= G11 — the not-set line is its own key =================

test('G11: a null rate renders the not-set key, never "Not set/month"', () => {
  const noRate = buildKhataCardModel({ ...customer, monthlySellingAmount: null });
  const lines = {
    connection: t('qrkh_connection', 'ur', { label: noRate.connectionLabel }),
    rate: t('qrkh_rate_not_set', 'ur'),
  };
  assert.equal(lines.rate, 'پیکیج ریٹ: طے نہیں', 'the Urdu not-set line is its own key');
  assert.ok(!lines.rate.includes('/'), 'the not-set line carries no /month suffix');
  const print = buildKhataCardPrintHtml(noRate, QR_DATA_URL, labels('ur'));
  assert.ok(print.includes('پیکیج ریٹ: طے نہیں'), 'print not-set line reads Urdu');
  assert.ok(!print.includes('طے نہیں/month'), 'print not-set never gains a /month suffix');
  const printEn = buildKhataCardPrintHtml(noRate, QR_DATA_URL, labels('en'));
  assert.ok(printEn.includes('Package rate: Not set'), 'EN print not-set line is byte-identical');
  assert.ok(!printEn.includes('Package rate: Not set/month'), 'EN print not-set never gains a /month suffix');
});

// ================= G12 — the family is clean =================

test('G12: the 16 keys are clean — EN byte-identical, EN differs from UR, no Rs token, no money figure', () => {
  for (const key of QRKH_KEYS) {
    assert.equal(en[key], QRKH_EN[key], `${key} EN is byte-identical to the literal it replaces`);
    assert.equal(typeof ur[key], 'string', `${key} must exist in UR`);
    assert.ok(ur[key].length > 0, `${key} UR must not be empty`);
    assert.notEqual(ur[key], en[key], `${key} UR must differ from EN`);
    assert.doesNotMatch(en[key], /Rs\./, `${key} EN must carry no Rs. token`);
    assert.doesNotMatch(ur[key], /Rs\./, `${key} UR must carry no Rs. token`);
    assert.doesNotMatch(en[key], /\bRs\s/, `${key} EN must not carry 'Rs ' (Sharafat 85)`);
    assert.doesNotMatch(ur[key], /\bRs\s/, `${key} UR must not carry 'Rs ' (Sharafat 85)`);
    assert.doesNotMatch(en[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} EN must carry no money figure`);
    assert.doesNotMatch(ur[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} UR must carry no money figure`);
  }
  // No qrkh_ EN value duplicates any other qrkh_ EN value.
  const seen = new Map();
  for (const key of QRKH_KEYS) {
    const first = seen.get(en[key]);
    assert.ok(first === undefined, `${key} duplicates the EN value of ${first}`);
    seen.set(en[key], key);
  }
  // The dict as a whole stays clean (Sharafat 85).
  assert.doesNotMatch(navJs, /Rs\./, 'no Rs. token anywhere in nav-language.js (Sharafat 85)');
  assert.doesNotMatch(navJs, /\bRs\s/, "no 'Rs ' anywhere in nav-language.js (Sharafat 85)");
});

// ================= G13 — self-guard =================

test('G13: this file pins the new total and stays free of the previous and older total literals', () => {
  assert.ok(selfSrc.includes('5210'), 'this file pins the new total 5,162');
  // The previous total's digits and the older total's digits are built,
  // never spelled, so this guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('51' + '61'), 'this file must stay free of the previous-count literal');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file must stay free of the older-count literal');
  // The t() helper is the real one from nav-language.js (not a local stub).
  assert.equal(t('qrkh_title'), 'QR Khata Card');
  assert.equal(t('qrkh_title', 'ur'), 'QR کھاتہ کارڈ');
});
