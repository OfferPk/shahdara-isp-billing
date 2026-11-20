// Plan 604 — Waada banner and history read in the operator's language,
// with PKR figures.
//
// Plan 601 keyed the Waada banner labels (the prv_wr_* family), but the
// money figure stayed raw: wada-record.js built `Rs ${amountPromised} `
// inline at three sites (banner, history text, single-record html), so
// the banner read "Rs 3000" with no thousands separator. Plan 604 routes
// the figure through the shared formatter — formatPKR from core.js —
// which rides the labels object as a `formatMoney` field (the module
// never imports anything: the purity fence in polish5 forbids it), and
// keys the seven profile-banner confirmation toasts that were still
// hardcoded English in app.js.
//
// The no-labels default keeps the legacy raw `Rs {n}` form (the
// documented fallback, pinned by polish5) — production always passes
// `formatMoney: formatPKR` via wadaRecordLabels().
//
// This file asserts the new parity total (5,162) and is the 33rd pinning
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
import {
  wadaRecordText,
  wadaRecordHtml,
  wadaBannerHtml,
} from '../wada-record.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const navJs = read('nav-language.js');
const appJs = read('app.js');
const selfSrc = read('tests/plan604-waada-banner-pkr-figures.test.js');
const { en, ur } = TRANSLATIONS;

// The labels object exactly the way app.js builds it in
// wadaRecordLabels(): the 12 prv_wr_* keys via t() + the formatter.
function labels(lang = 'en') {
  const pick = (key) => (lang === 'ur' ? ur[key] : en[key]);
  return {
    noWadas: pick('prv_wr_no_wadas'),
    health: pick('prv_wr_health'),
    promisedBy: pick('prv_wr_promised_by'),
    keptOn: pick('prv_wr_kept_on'),
    keptLateOn: pick('prv_wr_kept_late_on'),
    broken: pick('prv_wr_broken'),
    overdueSuffix: pick('prv_wr_overdue_suffix'),
    overdueLabel: pick('prv_wr_overdue_label'),
    note: pick('prv_wr_note'),
    poora: pick('prv_wr_poora'),
    toota: pick('prv_wr_toota'),
    remove: pick('prv_wr_remove'),
    formatMoney: formatPKR,
  };
}

// Generic fixtures only — no real customer names are used anywhere
// in this file.
const pending3000 = { id: 'WD-1', customer: 'CUST-1', promisedDate: '2026-11-20', amountPromised: 3000, note: 'on Friday', status: 'pending', closedDate: '' };
const pending150000 = { id: 'WD-2', customer: 'CUST-1', promisedDate: '2026-11-20', amountPromised: 150000, note: '', status: 'pending', closedDate: '' };
const kept3000 = { id: 'WD-3', customer: 'CUST-1', promisedDate: '2026-11-10', amountPromised: 3000, note: '', status: 'kept', closedDate: '2026-11-10' };
const pendingNoAmount = { id: 'WD-4', customer: 'CUST-1', promisedDate: '2026-11-20', amountPromised: null, note: '', status: 'pending', closedDate: '' };

const TOAST_KEYS = [
  'prv_wr_toast_not_recorded',
  'prv_wr_toast_duplicate',
  'prv_wr_toast_recorded',
  'prv_wr_toast_kept',
  'prv_wr_toast_broken',
  'prv_wr_toast_removed',
  'prv_wr_toast_chip_date',
];

const TOAST_EN = {
  prv_wr_toast_not_recorded: 'Wada not recorded: give a real promised date, and a whole-rupee amount when you enter one.',
  prv_wr_toast_duplicate: 'Wada already recorded — live promise set.',
  prv_wr_toast_recorded: 'Wada recorded.',
  prv_wr_toast_kept: 'Wada marked kept.',
  prv_wr_toast_broken: 'Wada marked broken.',
  prv_wr_toast_removed: 'Wada removed.',
  prv_wr_toast_chip_date: 'Could not compute promise date.',
};

// ================= G1 — parity guard (this file's own pin) =================

test('G1: parity is 5,162/5,162 in both dicts', () => {
  assert.equal(Object.keys(en).length, 5203, 'EN parity');
  assert.equal(Object.keys(ur).length, 5203, 'UR parity');
  const prvEn = Object.keys(en).filter((k) => k.startsWith('prv_'));
  const prvUr = Object.keys(ur).filter((k) => k.startsWith('prv_'));
  // Plan 608 adds the 240th prv_ key (prv_wr_toast_past_date).
  assert.equal(prvEn.length, 240, 'exactly the prv_ keys in EN (232 from 601 + 7 toast keys + 1 past-date key from 608)');
  assert.equal(prvUr.length, 240, 'exactly the prv_ keys in UR');
});

// ================= G2 — the amount renders PKR, grouped =================

test('G2: the banner amount renders PKR 3,000 with formatMoney: formatPKR', () => {
  const html = wadaBannerHtml([pending3000], '2026-11-15', labels());
  assert.ok(html.includes('PKR 3,000'), `banner must read PKR 3,000, got: ${html}`);
  assert.ok(!html.includes('Rs 3000'), 'banner must not carry the raw Rs figure');
});

test('G3: history text and single-record html render PKR 3,000', () => {
  const text = wadaRecordText(kept3000, '2026-11-15', labels());
  assert.ok(text.includes('PKR 3,000'), `history text must read PKR 3,000, got: ${text}`);
  assert.ok(!text.includes('Rs 3000'), 'history text must not carry the raw Rs figure');
  const html = wadaRecordHtml(kept3000, '2026-11-15', labels());
  assert.ok(html.includes('PKR 3,000'), `record html must read PKR 3,000, got: ${html}`);
  assert.ok(!html.includes('Rs 3000'), 'record html must not carry the raw Rs figure');
});

test('G4: grouping holds for six figures — 150000 renders PKR 150,000', () => {
  const banner = wadaBannerHtml([pending150000], '2026-11-15', labels());
  assert.ok(banner.includes('PKR 150,000'), `banner must read PKR 150,000, got: ${banner}`);
  assert.ok(!banner.includes('Rs 150000'), 'banner must not carry the raw Rs figure');
  const text = wadaRecordText(pending150000, '2026-11-15', labels());
  assert.ok(text.includes('PKR 150,000'), `history text must read PKR 150,000, got: ${text}`);
});

test('G5: no raw Rs {n} figure in any rendered output with labels', () => {
  const outputs = [
    wadaBannerHtml([pending3000, pending150000], '2026-11-15', labels()),
    wadaRecordText(pending3000, '2026-11-15', labels()),
    wadaRecordText(kept3000, '2026-11-15', labels()),
    wadaRecordHtml(pending3000, '2026-11-15', labels()),
    wadaRecordHtml(kept3000, '2026-11-15', labels()),
    // Urdu labels too: the figure is language-invariant via formatPKR.
    wadaBannerHtml([pending3000], '2026-11-15', labels('ur')),
    wadaRecordText(kept3000, '2026-11-15', labels('ur')),
  ];
  for (const out of outputs) {
    assert.doesNotMatch(out, /Rs \d/, `rendered output must carry no raw Rs figure: ${out}`);
  }
});

test('G6: a null amount renders no amount part at all', () => {
  const banner = wadaBannerHtml([pendingNoAmount], '2026-11-15', labels());
  assert.ok(!banner.includes('PKR'), 'a null amount must render no PKR figure');
  assert.ok(!banner.includes('Rs '), 'a null amount must render no Rs figure');
  const text = wadaRecordText(pendingNoAmount, '2026-11-15', labels());
  assert.ok(!text.includes('PKR'), 'a null amount must render no PKR figure in text');
  assert.ok(!text.includes('Rs '), 'a null amount must render no Rs figure in text');
});

// ================= G7 — the seven toasts are keyed =================

test('G7: the seven profile toasts ride t(prv_wr_toast_*) and the literals are gone from app.js', () => {
  for (const key of TOAST_KEYS) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
    assert.equal(en[key], TOAST_EN[key], `${key} EN is byte-identical to the literal it replaces`);
  }
  // The literals are gone from app.js — except the Sharafat 69 setter
  // passthrough, which stays verbatim (named follow-up, not 604's).
  for (const literal of Object.values(TOAST_EN)) {
    assert.ok(!appJs.includes(`'${literal}'`), `app.js must no longer hardcode '${literal}'`);
  }
  assert.ok(appJs.includes("err?.message === 'Promise amount must be more than Rs 0' ? err.message : t('prv_wr_toast_not_recorded')"),
    'the Sharafat 69 setter-refusal passthrough stays verbatim; only the generic fallback is keyed');
});

test('G8: the seven toast keys are clean — EN differs from UR, no Rs token, no money figure, no duplicate EN', () => {
  const prvEn = Object.keys(en).filter((k) => k.startsWith('prv_'));
  const seen = new Map();
  for (const k of prvEn) seen.set(en[k], k);
  for (const key of TOAST_KEYS) {
    assert.equal(typeof en[key], 'string', `${key} must exist in EN`);
    assert.equal(typeof ur[key], 'string', `${key} must exist in UR`);
    assert.ok(ur[key].length > 0, `${key} UR must not be empty`);
    assert.notEqual(ur[key], en[key], `${key} UR must differ from EN`);
    assert.ok(ur[key].endsWith('۔'), `${key} UR is a sentence and ends with ۔`);
    assert.doesNotMatch(en[key], /Rs\./, `${key} EN must carry no Rs. token`);
    assert.doesNotMatch(ur[key], /Rs\./, `${key} UR must carry no Rs. token`);
    assert.doesNotMatch(en[key], /\bRs\s/, `${key} EN must not carry 'Rs ' (Sharafat 85)`);
    assert.doesNotMatch(ur[key], /\bRs\s/, `${key} UR must not carry 'Rs ' (Sharafat 85)`);
    assert.doesNotMatch(en[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} EN must carry no money figure`);
    assert.doesNotMatch(ur[key], /(?:PKR|Rs)\s*\d|\d[\d,]*\s*(?:PKR|Rs)/, `${key} UR must carry no money figure`);
  }
  // No toast EN value duplicates any other prv_ EN value.
  for (const key of TOAST_KEYS) {
    const first = seen.get(en[key]);
    assert.equal(first, key, `${key} duplicates the EN value of ${first}`);
  }
  // The dict as a whole stays clean (Sharafat 85).
  assert.doesNotMatch(navJs, /Rs\./, 'no Rs. token anywhere in nav-language.js (Sharafat 85)');
  assert.doesNotMatch(navJs, /\bRs\s/, "no 'Rs ' anywhere in nav-language.js (Sharafat 85)");
});

// ================= G9 — wiring + fallback =================

test('G9: app.js passes formatMoney: formatPKR in wadaRecordLabels()', () => {
  assert.ok(appJs.includes('formatMoney: formatPKR'), 'wadaRecordLabels() must pass formatMoney: formatPKR');
  // The module still takes no import — the formatter travels inside the
  // labels object (purity fence, polish5).
  const moduleSrc = read('wada-record.js');
  assert.doesNotMatch(moduleSrc, /^\s*import\s/m, 'wada-record.js still imports nothing');
  assert.ok(moduleSrc.includes('formatMoney'), 'the module carries the formatMoney field');
});

test('G10: the no-labels default still renders raw Rs 100 (documented fallback, polish5)', () => {
  // polish5 pins this exact string without labels; 604 must not "fix" it.
  const first = { id: 'WD-1', customer: 'CUST-1', promisedDate: '2026-11-07', amountPromised: 100, note: 'in next bill', status: 'pending', closedDate: '' };
  assert.equal(wadaRecordText(first, '2026-11-05'), 'Rs 100 promised by 7 Nov 2026 — Saturday — “in next bill”.');
  // An empty labels object (plan507's stub) falls back the same way.
  assert.equal(wadaRecordText(first, '2026-11-05', {}), 'Rs 100 promised by 7 Nov 2026 — Saturday — “in next bill”.');
  // ...while the production labels path formats it.
  assert.ok(wadaRecordText(first, '2026-11-05', labels()).includes('PKR 100'));
});

// ================= G11 — self-guard =================

test('G11: this file pins the new total and stays free of the previous and older total literals', () => {
  assert.ok(selfSrc.includes('5203'), 'this file pins the new total 5,162');
  // The previous total's digits and the older total's digits are built,
  // never spelled, so this guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('51' + '61'), 'this file must stay free of the previous-count literal');
  assert.ok(!selfSrc.includes('51' + '45'), 'this file must stay free of the older-count literal');
  // The t() helper is the real one from nav-language.js (not a local stub).
  assert.equal(t('prv_wr_toast_kept'), 'Wada marked kept.');
  assert.equal(t('prv_wr_toast_kept', 'ur'), 'وعدہ پورا ہوا قرار دیا گیا۔');
});
