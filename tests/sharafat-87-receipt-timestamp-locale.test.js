/**
 * sharafat-87-receipt-timestamp-locale.test.js — Sharafat 87.
 *
 * The Bluetooth printer TEST slip printed its timestamp with a bare
 * `new Date().toLocaleString('en-PK')`, so it stayed English even in Urdu
 * mode. The fix routes it through the new `formatHumanDateTime(value)`
 * helper in nav-language.js: English stays the exact current call
 * (byte-identical, no options), Urdu renders the month name in Urdu
 * script, pinned to Asia/Karachi.
 *
 * Pins:
 *  - helper, both languages: `formatHumanDateTime(date, 'ur')` is
 *    "16 نومبر، 2026، 11:58 AM" (Urdu month name, Latin digits, English
 *    AM/PM — like every amount in the app); `formatHumanDateTime(date,
 *    'en')` is byte-identical to `date.toLocaleString('en-PK')`; with no
 *    lang argument the helper follows `getAppLanguage()` (stubbed
 *    storage 'ur'/'en');
 *  - call site: the test-slip site in app.js calls
 *    `formatHumanDateTime(new Date())` and no bare
 *    `dateTimeLabel: new Date().toLocaleString('en-PK')` remains;
 *  - width: the Urdu stamp rendered through `buildEscPosReceipt` keeps
 *    the `Date` row within the 32-char thermal width with the month
 *    نومبر intact;
 *  - invalid input: 'not-a-date' / null / undefined / boolean returns
 *    '', never 'Invalid Date' and never throws;
 *  - guards (deliberately untouched): `zonedParts` in core.js still
 *    hardcodes 'en-US' and `localDateTimeValue` still returns the PKT
 *    `YYYY-MM-DDTHH:mm` key; customer receipts still print the stored
 *    ISO `paymentDate`; the QC slip still prints `DD/MM/YYYY` via
 *    `formatQcReceiptDate`.
 *
 * Disclosure (Sharafat 87): the changed surface is the operator's
 * Bluetooth printer TEST slip, not a customer receipt — customer receipts
 * print a stored ISO date (`YYYY-MM-DD`) or `DD/MM/YYYY` and do not
 * change. The 21 dashboard/report timestamps and `humanDate` /
 * `formatDisplayDate` are disclosed follow-up, not swept in.
 *
 * Harness: pure ESM, no node_modules. Fixed instant
 * 2026-11-16T11:58:23+05:00. Synthetic data only — no real customer
 * names, no phone numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatHumanDateTime,
  URDU_SCRIPT_PATTERN,
  LANGUAGE_STORAGE_KEY
} from '../nav-language.js';
import { buildEscPosReceipt, THERMAL_WIDTH_CHARS } from '../thermal-printer.js';
import { formatQcReceiptDate } from '../nav-quick-collect.js';
import { localDateTimeValue } from '../core.js';

// Fixed instant: 2026-11-16 11:58:23 PKT. Under TZ=UTC (how the gates run)
// the device-timezone English call prints the UTC hour (6:58).
const FIXED = new Date('2026-11-16T11:58:23+05:00');
const EXPECTED_URDU = '16 نومبر، 2026، 11:58 AM';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const coreSrc = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const receiptSrc = readFileSync(new URL('../receipt.js', import.meta.url), 'utf8');
const qcSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

// The helper reads the app language from storage at call time, like t().
// Stub globalThis.localStorage per test and restore it afterwards.
function withLanguage(lang, fn) {
  const store = { [LANGUAGE_STORAGE_KEY]: lang };
  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  try {
    return fn();
  } finally {
    if (origLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = origLocalStorage;
  }
}

test('Sharafat 87: helper renders the Urdu month name in ur mode', () => {
  const out = formatHumanDateTime(FIXED, 'ur');
  assert.equal(out, EXPECTED_URDU);
  assert.match(out, URDU_SCRIPT_PATTERN);
  assert.ok(out.includes('نومبر'), 'month name is the Urdu word نومبر');
});

test('Sharafat 87: helper is byte-identical to the old en-PK call in en mode', () => {
  assert.equal(formatHumanDateTime(FIXED, 'en'), FIXED.toLocaleString('en-PK'));
});

test('Sharafat 87: helper with no lang follows the active app language', () => {
  assert.equal(withLanguage('ur', () => formatHumanDateTime(FIXED)), EXPECTED_URDU);
  assert.equal(
    withLanguage('en', () => formatHumanDateTime(FIXED)),
    FIXED.toLocaleString('en-PK')
  );
});

test('Sharafat 87: helper accepts a date string or a timestamp', () => {
  assert.equal(formatHumanDateTime('2026-11-16T11:58:23+05:00', 'ur'), EXPECTED_URDU);
  assert.equal(formatHumanDateTime(FIXED.getTime(), 'ur'), EXPECTED_URDU);
  assert.equal(
    formatHumanDateTime(FIXED.getTime(), 'en'),
    FIXED.toLocaleString('en-PK')
  );
});

test('Sharafat 87: invalid input returns empty, never throws or prints Invalid Date', () => {
  for (const bad of ['not-a-date', '', null, undefined, true, false, NaN, {}]) {
    assert.equal(formatHumanDateTime(bad, 'ur'), '', `ur: ${String(bad)}`);
    assert.equal(formatHumanDateTime(bad, 'en'), '', `en: ${String(bad)}`);
  }
  assert.equal(formatHumanDateTime(new Date('not-a-date'), 'ur'), '');
});

test('Sharafat 87: the test-slip site calls the helper, not the bare en-PK call', () => {
  assert.ok(
    appSrc.includes('dateTimeLabel: formatHumanDateTime(new Date())'),
    'test-slip handler routes its timestamp through formatHumanDateTime'
  );
  assert.ok(
    !appSrc.includes("dateTimeLabel: new Date().toLocaleString('en-PK')"),
    'no bare en-PK timestamp remains at the test-slip site'
  );
  assert.ok(
    appSrc.includes("import { formatHumanDateTime } from './nav-language.js'"),
    'app.js imports the helper directly from nav-language.js'
  );
  assert.ok(
    /export (function|const) formatHumanDateTime/.test(navSrc),
    'formatHumanDateTime is exported from nav-language.js'
  );
});

test('Sharafat 87: the Urdu stamp fits the 32-char thermal slip through the helper', () => {
  assert.equal(THERMAL_WIDTH_CHARS, 32);
  const { lines } = buildEscPosReceipt({
    businessName: 'Shahdara ISP',
    receiptNumber: 'TEST',
    dateTimeLabel: formatHumanDateTime(FIXED, 'ur'),
    amount: 'PKR 0',
    statusLabel: 'TEST SLIP'
  });
  const dateRow = lines.find((line) => line.startsWith('Date'));
  assert.ok(dateRow, 'slip has a Date row');
  assert.ok(dateRow.includes('نومبر'), `Date row keeps the month نومبر: ${dateRow}`);
  assert.ok(
    dateRow.length <= THERMAL_WIDTH_CHARS,
    `Date row fits the roll: ${dateRow.length} chars`
  );
});

test('Sharafat 87: zonedParts still hardcodes en-US — stored keys unchanged', () => {
  assert.ok(
    coreSrc.includes("new Intl.DateTimeFormat('en-US'"),
    'zonedParts stays the en-US base for stored keys'
  );
  assert.equal(localDateTimeValue(FIXED), '2026-11-16T11:58');
});

test('Sharafat 87: customer receipts still print the stored ISO date', () => {
  assert.match(
    receiptSrc,
    /paymentDate:\s*validStoredDate\(payment\.date\)/,
    'receipt paymentDate stays the stored ISO date, untouched by locale'
  );
});

test('Sharafat 87: the QC slip still prints DD/MM/YYYY via formatQcReceiptDate', () => {
  assert.equal(formatQcReceiptDate('2026-11-16'), '16/11/2026');
  assert.ok(
    qcSrc.includes('dateTimeLabel: formatQcReceiptDate(activeReceipt.date)'),
    'QC slip dateTimeLabel still calls formatQcReceiptDate'
  );
});
