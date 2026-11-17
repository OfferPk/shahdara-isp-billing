// Sharafat 93 — backup health strings are hardcoded English: in Urdu mode
// the topbar badge, the Home safety badge, the backup formatters' fallbacks
// and the footer backup-panel buttons/labels never translated. The fix maps
// the English-canonical model to t() keys at the render sites (88 precedent),
// keys the 14 .backup-actions buttons + "Run Khata Doctor" + the five <dt>
// labels, and translates the two formatters at the source.
//
// Source pins only for app.js (which no test executes) + live checks against
// the real nav-language.js TRANSLATIONS / t() and the real backup-health.js
// model — the 88 pattern. No test pins a rendered badge string at runtime;
// the mapping helpers are driven through t() with an explicit language.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS, t } from '../nav-language.js';
import {
  assessBackupHealth,
  BACKUP_HEALTH_PAYMENT_THRESHOLD,
  BACKUP_HEALTH_SAFE_MS,
  BACKUP_HEALTH_DUE_MS,
} from '../backup-health.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const html = read('index.html');

function bodyOf(src, startRe) {
  const m = src.match(startRe);
  if (!m) return null;
  // Scan from the END of the matched signature: a signature may itself
  // contain braces (e.g. default params), which would end the scan early.
  const open = src.indexOf('{', m.index + m[0].length);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

const labelHelper = bodyOf(app, /function backupHealthLabelText\(health, lastExportAt, lang = null\)/);
const titleHelper = bodyOf(app, /function backupHealthTitleText\(health, lastExportAt, paymentsSinceExport, lang = null\)/);
const badgeFn = bodyOf(app, /function renderBackupHealthBadge\(\)/);
const safetyFn = bodyOf(app, /function updateDataSafetyUi\(/);
const dateFn = bodyOf(app, /function formatBackupDateTime\(/);
const sizeFn = bodyOf(app, /function formatBackupSize\(/);

// The footer line: index.html:14903 on this base (one minified line).
const footerLine = html.split('\n').find((l) => l.includes('id="backupControls"')) || '';
const actionsDiv = (footerLine.match(/<div class="backup-actions">([\s\S]*?)<\/div>/) || [])[1] || '';

// ---- Badge render: EN byte-identical to the model literals, UR per §4.3 ----

test('Sharafat 93 badge labels: EN byte-identical to the model, UR translated', () => {
  const expected = {
    bkup_health_label_never: ['Backup: Never', 'بیک اپ: کبھی نہیں'],
    bkup_health_label_safe: ['Backup: Safe', 'بیک اپ: محفوظ'],
    bkup_health_label_due: ['Backup: Due', 'بیک اپ: واجب'],
    bkup_health_label_critical: ['Backup: Critical', 'بیک اپ: نازک حالت'],
  };
  for (const [key, [en, ur]] of Object.entries(expected)) {
    assert.equal(t(key, 'en'), en, `${key} EN must be byte-identical to the model label`);
    assert.equal(t(key, 'ur'), ur, `${key} UR value`);
  }
});

test('Sharafat 93 badge titles: EN byte-identical to the model, UR translated (incl. {count})', () => {
  const expected = {
    bkup_health_title_never: ['No off-device backup recorded. Tap to download a JSON backup now.', 'ابھی تک کوئی آف ڈیوائس بیک اپ ریکارڈ نہیں ہوا۔ ابھی JSON بیک اپ ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔'],
    bkup_health_title_safe: ['Last off-device backup was less than 24 hours ago. Tap to download a fresh copy.', 'آخری آف ڈیوائس بیک اپ 24 گھنٹے سے کم پہلے ہوا تھا۔ تازہ کاپی ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔'],
    bkup_health_title_due: ['Last off-device backup is 1–3 days old. Tap to download a fresh JSON backup.', 'آخری آف ڈیوائس بیک اپ 1–3 دن پرانا ہے۔ تازہ JSON بیک اپ ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔'],
    bkup_health_title_critical_stale: ['Last off-device backup is over 3 days old. Tap to download a JSON backup now.', 'آخری آف ڈیوائس بیک اپ 3 دن سے زیادہ پرانا ہے۔ ابھی JSON بیک اپ ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔'],
  };
  for (const [key, [en, ur]] of Object.entries(expected)) {
    assert.equal(t(key, 'en'), en, `${key} EN must be byte-identical to the model title`);
    assert.equal(t(key, 'ur'), ur, `${key} UR value`);
  }
  assert.equal(
    t('bkup_health_title_critical_payments', 'en', { count: 10 }),
    '10 new payments since the last backup. Tap to download a JSON backup now.',
    'payments title interpolates {count} in EN',
  );
  assert.equal(
    t('bkup_health_title_critical_payments', 'ur', { count: 10 }),
    'آخری بیک اپ کے بعد سے 10 نئی ادائیگیاں۔ ابھی JSON بیک اپ ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔',
    'payments title interpolates {count} in UR',
  );
  assert.equal(t('bkup_health_tap_download', 'en'), 'Tap to download a JSON backup.');
  assert.equal(t('bkup_health_tap_download', 'ur'), 'JSON بیک اپ ڈاؤن لوڈ کرنے کے لیے تھپتھپائیں۔');
});

test('Sharafat 93 mapping helpers branch on (status, never, payments) — never and stale-critical do not collapse', () => {
  assert.ok(labelHelper, 'backupHealthLabelText exists in app.js');
  assert.ok(titleHelper, 'backupHealthTitleText exists in app.js');
  // The never branch comes first in both helpers and uses its own keys.
  assert.ok(/const never = !lastExportAt/.test(labelHelper), 'label helper derives never from lastExportAt');
  assert.ok(/const never = !lastExportAt/.test(titleHelper), 'title helper derives never from lastExportAt');
  assert.ok(labelHelper.indexOf("t('bkup_health_label_never'") < labelHelper.indexOf("t('bkup_health_label_safe'"), 'never label precedes safe label');
  assert.ok(titleHelper.indexOf("t('bkup_health_title_never'") < titleHelper.indexOf("t('bkup_health_title_critical_payments'"), 'never title precedes payments title');
  assert.ok(/paymentsSinceExport >= BACKUP_HEALTH_PAYMENT_THRESHOLD/.test(titleHelper), 'payments branch uses the model threshold constant');
  assert.ok(/\{ count: paymentsSinceExport \}/.test(titleHelper), 'payments title passes the count as a {count} param');
  for (const key of ['bkup_health_label_never', 'bkup_health_label_safe', 'bkup_health_label_due', 'bkup_health_label_critical']) {
    assert.ok(labelHelper.includes(`t('${key}'`), `label helper maps ${key}`);
  }
  for (const key of ['bkup_health_title_never', 'bkup_health_title_critical_payments', 'bkup_health_title_safe', 'bkup_health_title_due', 'bkup_health_title_critical_stale']) {
    assert.ok(titleHelper.includes(`t('${key}'`), `title helper maps ${key}`);
  }
});

test('Sharafat 93 topbar badge renders through the helpers + the tap-download suffix key', () => {
  assert.ok(badgeFn, 'renderBackupHealthBadge exists in app.js');
  assert.ok(!badgeFn.includes('labelEl.textContent = health.label'), 'badge no longer writes health.label verbatim');
  assert.ok(!badgeFn.includes('health.title} Tap to download'), 'badge no longer appends the English suffix verbatim');
  assert.ok(badgeFn.includes('backupHealthLabelText(health, record.lastExportAt)'), 'badge label comes from the helper');
  assert.ok(badgeFn.includes('backupHealthTitleText(health, record.lastExportAt, paymentsSinceExport)'), 'badge title comes from the helper');
  assert.ok(badgeFn.includes("t('bkup_health_tap_download')"), 'badge title/aria-label keep the suffix via its own key');
  assert.ok(badgeFn.includes("badge.title = `${healthTitle} ${t('bkup_health_tap_download')}`"), 'badge title formula unchanged apart from the keyed suffix');
  assert.ok(badgeFn.includes("badge.setAttribute('aria-label', `${healthLabel}. ${healthTitle} ${t('bkup_health_tap_download')}`)"), 'badge aria-label formula unchanged apart from the keyed strings');
});

test('Sharafat 93 Home safety badge renders through the same helpers', () => {
  assert.ok(safetyFn, 'updateDataSafetyUi exists in app.js');
  assert.ok(!safetyFn.includes('bannerBackupBadge.textContent = backupHealth.label'), 'Home badge no longer writes the model label verbatim');
  assert.ok(!safetyFn.includes('bannerBackupBadge.title = backupHealth.title'), 'Home badge no longer writes the model title verbatim');
  assert.ok(safetyFn.includes('backupHealthLabelText(backupHealth, backupRecord.lastExportAt)'), 'Home badge label comes from the helper');
  assert.ok(safetyFn.includes('backupHealthTitleText(backupHealth, backupRecord.lastExportAt, paymentsSinceExport)'), 'Home badge title comes from the helper');
});

// ---- Formatters: translated at the source ----

test('Sharafat 93 formatBackupDateTime falls back to t(bkup_never)', () => {
  assert.ok(dateFn, 'formatBackupDateTime exists in app.js');
  assert.ok(!dateFn.includes("return 'Never'"), 'bare Never fallback is gone');
  assert.ok(dateFn.includes("t('bkup_never')"), 'invalid/missing date returns the keyed fallback');
  assert.equal(t('bkup_never', 'en'), 'Never');
  assert.equal(t('bkup_never', 'ur'), 'کبھی نہیں');
});

test('Sharafat 93 formatBackupSize falls back to t(bkup_not_available)', () => {
  assert.ok(sizeFn, 'formatBackupSize exists in app.js');
  assert.ok(!sizeFn.includes("return 'Not available'"), 'bare Not available fallback is gone');
  assert.ok(sizeFn.includes("t('bkup_not_available')"), 'non-finite/negative size returns the keyed fallback');
  assert.equal(t('bkup_not_available', 'en'), 'Not available');
  assert.equal(t('bkup_not_available', 'ur'), 'دستیاب نہیں');
});

// ---- Footer panel: the doc's acceptance test against the real index.html ----

test('Sharafat 93 every .backup-actions button label resolves in EN + UR and EN is byte-identical to the static text', () => {
  assert.ok(actionsDiv, '.backup-actions div found in the footer line');
  const buttons = [...actionsDiv.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, 14, 'the .backup-actions div still holds exactly 14 buttons');
  for (const [, attrs, inner] of buttons) {
    const spanMatch = inner.match(/<span data-i18n="([^"]+)">([^<]*)<\/span>/);
    const labelKey = (attrs.match(/data-i18n="([^"]+)"/) || [])[1] || (spanMatch || [])[1];
    assert.ok(labelKey, `button has a data-i18n label key: ${attrs.slice(0, 60)}`);
    const en = TRANSLATIONS.en[labelKey];
    const ur = TRANSLATIONS.ur[labelKey];
    assert.ok(en && en.length > 0, `${labelKey} resolves in EN`);
    assert.ok(ur && ur.length > 0, `${labelKey} resolves in UR`);
    // D8: the emoji sits outside the translated span, never inside the key
    // value — so for span-wrapped labels the static text IS the span text.
    // The raw HTML escapes & as &amp;; the browser renders it as &, which
    // is what the key value holds — decode before comparing.
    const staticText = (spanMatch ? spanMatch[2] : inner.replace(/<[^>]+>/g, '').trim()).replace(/&amp;/g, '&');
    assert.equal(en, staticText, `${labelKey} EN must be byte-identical to the static button text`);
  }
});

test('Sharafat 93 every titled .backup-actions button title resolves in EN + UR and EN is byte-identical', () => {
  const buttons = [...actionsDiv.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
  const titled = buttons.filter(([, attrs]) => attrs.includes('title="'));
  assert.equal(titled.length, 10, 'exactly 10 titled buttons in the div');
  for (const [, attrs] of titled) {
    const titleKey = (attrs.match(/data-i18n-title="([^"]+)"/) || [])[1];
    const staticTitle = (attrs.match(/title="([^"]*)"/) || [])[1];
    assert.ok(titleKey, `titled button has a data-i18n-title key: ${attrs.slice(0, 80)}`);
    assert.equal(TRANSLATIONS.en[titleKey], staticTitle, `${titleKey} EN must be byte-identical to the static title attribute`);
    assert.ok(TRANSLATIONS.ur[titleKey] && TRANSLATIONS.ur[titleKey].length > 0, `${titleKey} resolves in UR`);
  }
});

test('Sharafat 93 Run Khata Doctor + all five <dt> labels resolve in EN + UR, EN byte-identical', () => {
  const khata = footerLine.match(/<button[^>]*id="runKhataDoctorButton"[^>]*>([\s\S]*?)<\/button>/);
  assert.ok(khata, 'Run Khata Doctor button found');
  const khataKey = (khata[1].match(/<span data-i18n="([^"]+)">([^<]*)<\/span>/) || []);
  assert.equal(khataKey[1], 'bkup_khata_doctor_btn');
  assert.equal(TRANSLATIONS.en.bkup_khata_doctor_btn, khataKey[2], 'Khata Doctor EN byte-identical');
  assert.ok(TRANSLATIONS.ur.bkup_khata_doctor_btn.length > 0, 'Khata Doctor UR resolves');
  const dtLabels = {
    bkup_last_success_label: 'Last successful backup',
    bkup_size_label: 'Backup size',
    bkup_status_label: 'Status',
    bkup_storage_protection_label: 'Storage Protection',
    bkup_storage_quota_label: 'Storage Quota Used',
  };
  for (const [key, text] of Object.entries(dtLabels)) {
    assert.ok(footerLine.includes(`<dt data-i18n="${key}">${text}</dt>`), `<dt> ${key} keyed with byte-identical EN text`);
    assert.ok(TRANSLATIONS.ur[key] && TRANSLATIONS.ur[key].length > 0, `${key} resolves in UR`);
  }
});

// ---- Guards: model untouched, neighbours untouched, parity holds ----

test('Sharafat 93 model stays English-canonical (live import, all five branches)', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const never = assessBackupHealth({ lastExportAt: null, paymentsSinceExport: 0, now });
  const safe = assessBackupHealth({ lastExportAt: new Date(now - 23 * 3600e3).toISOString(), paymentsSinceExport: 0, now });
  const due = assessBackupHealth({ lastExportAt: new Date(now - 48 * 3600e3).toISOString(), paymentsSinceExport: 0, now });
  const stale = assessBackupHealth({ lastExportAt: new Date(now - 96 * 3600e3).toISOString(), paymentsSinceExport: 0, now });
  const byPay = assessBackupHealth({ lastExportAt: new Date(now - 3600e3).toISOString(), paymentsSinceExport: 10, now });
  assert.equal(never.label, 'Backup: Never');
  assert.equal(safe.label, 'Backup: Safe');
  assert.equal(due.label, 'Backup: Due');
  assert.equal(stale.label, 'Backup: Critical');
  assert.equal(byPay.label, 'Backup: Critical');
  assert.equal(never.title, 'No off-device backup recorded. Tap to download a JSON backup now.');
  assert.equal(safe.title, 'Last off-device backup was less than 24 hours ago. Tap to download a fresh copy.');
  assert.equal(due.title, 'Last off-device backup is 1–3 days old. Tap to download a fresh JSON backup.');
  assert.equal(stale.title, 'Last off-device backup is over 3 days old. Tap to download a JSON backup now.');
  assert.equal(byPay.title, '10 new payments since the last backup. Tap to download a JSON backup now.');
});

test('Sharafat 93 thresholds unchanged (10 payments, <24h safe, <=3d due)', () => {
  assert.equal(BACKUP_HEALTH_PAYMENT_THRESHOLD, 10);
  assert.equal(BACKUP_HEALTH_SAFE_MS, 24 * 3600e3);
  assert.equal(BACKUP_HEALTH_DUE_MS, 3 * 24 * 3600e3);
});

test('Sharafat 93 pre-action banners + morning-briefing keys survive untouched', () => {
  assert.ok(app.includes("t(prompt.never ? 'bkup_preaction_never'"), 'pre-action banners still map via bkup_preaction_*');
  assert.ok(read('morning-briefing.js').includes('brief_backup_never'), 'morning briefing still uses brief_backup_*');
});

test('Sharafat 93 EN/UR parity holds (4,671 == 4,671)', () => {
  // Round 2 (D9): net −1 key — 'cust_card_father_ref_short' and
  // 'cust_card_tenure_since_short' deleted, 'cust_card_ref_short' added.
  const enKeys = Object.keys(TRANSLATIONS.en);
  const urKeys = Object.keys(TRANSLATIONS.ur);
  assert.equal(enKeys.length, 4671);
  assert.equal(urKeys.length, 4671);
  const diff = enKeys.filter((k) => !TRANSLATIONS.ur[k]).concat(urKeys.filter((k) => !TRANSLATIONS.en[k]));
  assert.deepEqual(diff, []);
});

test('Sharafat 93 badge markup ids survive; static badge untouched', () => {
  assert.ok(html.includes('id="backupHealthBadge"'), 'topbar badge id survives');
  assert.ok(html.includes('id="dataSafetyBackupBadge"'), 'Home safety badge id survives');
  assert.ok(html.includes('<span id="backupHealthLabel">Backup: Never</span>'), 'static badge markup untouched (pre-boot fallback stays English)');
});

test('Sharafat 93 Clear All + Delta Merge keep their existing keys (no duplicate keying)', () => {
  assert.ok(footerLine.includes('data-i18n="clr_button"'), 'Clear All keeps clr_button');
  assert.ok(footerLine.includes('<span data-i18n="dmerge_button">Delta Merge (another device)</span>'), 'Delta Merge keeps dmerge_button on its label span');
  assert.equal(TRANSLATIONS.en.clr_button, 'Clear All Record');
  assert.equal(TRANSLATIONS.en.dmerge_button, 'Delta Merge (another device)');
});
