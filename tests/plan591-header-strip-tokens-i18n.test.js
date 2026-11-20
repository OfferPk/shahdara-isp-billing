// Plan 591 — Header strip uses tokens and speaks the operator's language
// (D1(a) labels param passed by app.js, D2(a) section/label/value only,
// D3(a) frozen --phs-label, D4(d) new --text-phs-value 15px, D5(a) 13
// fresh keys, D6(a) the text function translated too, D7(a) phs_per_month,
// D9(a) this file, D10(a) browser sample). Rule-aware assertions only
// (comment-stripped, selector/body split with @media recursion — the
// repro-591 method). A raw `style=` grep overcounts (it catches the
// word inside comments) and a raw hex grep overcounts the same way, so
// no test here asserts by substring grep over an unstripped file.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import {
  buildProfileHeaderStrip,
  profileHeaderStripHtml,
  profileHeaderStripText,
} from '../profile-header-strip.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ---- rule-aware CSS parsing (mirrors repro-591.mjs) ----
function rulesOf(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const j = text.indexOf('{', i);
    if (j < 0) break;
    const sel = text.slice(i, j).trim();
    let depth = 1;
    let k = j + 1;
    while (k < n && depth) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}') depth--;
      k++;
    }
    const body = text.slice(j + 1, k - 1);
    if (sel.startsWith('@media') || sel.startsWith('@supports')) out.push(...rulesOf(body));
    else if (sel && !sel.startsWith('@')) out.push({ sel, body });
    i = k;
  }
  return out;
}

function ruleBody(css, selector) {
  const rule = rulesOf(stripComments(css)).find((r) => r.sel === selector);
  assert.ok(rule, `expected a rule for ${selector}`);
  return rule.body;
}

function declarations(body) {
  const out = {};
  for (const decl of body.split(';')) {
    const at = decl.indexOf(':');
    if (at < 0) continue;
    out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim();
  }
  return out;
}

function tokenMap(css, selector) {
  const rule = rulesOf(stripComments(css)).find((r) => r.sel === selector);
  assert.ok(rule, `expected a token block for ${selector}`);
  return declarations(rule.body);
}

function resolveVar(map, value) {
  let v = (value || '').trim();
  for (let i = 0; i < 8 && v.includes('var('); i++) {
    v = v.replace(/var\((--[a-zA-Z0-9-]+)(?:,[^)]*)?\)/g, (_, name) => {
      assert.ok(name in map, `token ${name} is not defined`);
      return map[name].trim();
    });
  }
  return v;
}

function hexCount(file) {
  const m = stripComments(read(file)).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  return new Set(m).size;
}

// ---- WCAG relative luminance / contrast (the repro-591 math) ----
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function near(actual, expected, eps = 0.02) {
  assert.ok(Math.abs(actual - expected) < eps, `expected contrast ${expected} (±${eps}), got ${actual.toFixed(2)}`);
}

// ---- fixtures (same shape as plan351's baseStrip) ----
function baseStrip(overrides = {}) {
  return buildProfileHeaderStrip({
    customerId: 'CUST-1',
    customerName: 'Test Customer',
    outstanding: 3000,
    packageLabel: '5 Mbps — 200 GB',
    packagePrice: 2000,
    lastPayment: { date: '2026-10-19', amount: 2000 },
    nextDueDate: '2026-11-05',
    ...overrides,
  });
}

// The labels object app.js passes (t('phs_*') values), built from the
// real TRANSLATIONS — the same values the live strip renders with.
function urLabels() {
  const ur = TRANSLATIONS.ur;
  return {
    dues: ur.phs_dues,
    package: ur.phs_package,
    lastPayment: ur.phs_last_payment,
    nextDue: ur.phs_next_due,
    noAmountDue: ur.phs_no_amount_due,
    noPaymentYet: ur.phs_no_payment_yet,
    notRecorded: ur.phs_not_recorded,
    noAmountDueText: ur.phs_no_amount_due_text,
    noPaymentYetText: ur.phs_no_payment_yet_text,
    nextDueNotRecorded: ur.phs_next_due_not_recorded,
    unavailable: ur.phs_unavailable,
    aria: ur.phs_aria,
    perMonth: ur.phs_per_month,
    notSet: ur.prof_not_set,
  };
}

const moduleSrc = read('profile-header-strip.js');
const stylesCss = read('styles.css');
const tokensCss = read('tokens.css');
const appJs = read('app.js');

// ================= G1 — Inventory =================

test('G1a: the module carries no inline style attribute and no hex literal', () => {
  // The acceptance's flip proof, on the raw source: the old template
  // carried 9 style attributes and 3 hex on one line (:177 on the base).
  // A comment mentioning either word would break this on purpose — the
  // module's comments name neither, so the raw check is exact here.
  assert.doesNotMatch(moduleSrc, /style=/);
  assert.doesNotMatch(moduleSrc, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/);
  assert.doesNotMatch(moduleSrc, /import /);
});

test('G1b: the three new class rules exist with the moved declarations', () => {
  const section = declarations(ruleBody(stylesCss, '.profile-header-strip'));
  assert.equal(section.display, 'grid');
  assert.equal(section['grid-template-columns'], 'repeat(2,minmax(0,1fr))');
  assert.equal(section.gap, 'var(--space-3)');
  assert.equal(section['align-items'], 'stretch');
  assert.equal(section.margin, 'var(--space-2) 0 var(--space-3)');
  assert.equal(section.padding, 'var(--space-2-5) var(--space-3)');
  assert.equal(section.border, '1px solid var(--line)');
  assert.equal(section['border-radius'], 'var(--radius-xs)');
  assert.equal(section.background, 'var(--surface-soft)');
  const label = declarations(ruleBody(stylesCss, '.phs-label'));
  assert.equal(label.display, 'block');
  assert.equal(label['font-size'], 'var(--text-table-head)');
  assert.equal(label.color, 'var(--phs-label)');
  const value = declarations(ruleBody(stylesCss, '.phs-value'));
  assert.equal(value['font-size'], 'var(--text-phs-value)');
  // Every moved declaration is a var() reference — no literal px or hex
  // survives in the three new rules (the layout numbers live in tokens).
  // The border-width '1px' is excepted: it was literal in the old inline
  // style too, and no token owns a border width — only its colour moved.
  for (const [sel, body] of [['.profile-header-strip', section], ['.phs-label', label], ['.phs-value', value]]) {
    for (const [prop, val] of Object.entries(body)) {
      assert.doesNotMatch(val, /#[0-9a-fA-F]{3,6}\b/, `${sel} ${prop} carries a hex literal`);
      if (prop !== 'border') {
        assert.doesNotMatch(val, /\b\d+px\b/, `${sel} ${prop} carries a literal pixel value`);
      }
    }
  }
});

test('G1c: the four pills are untouched under D2(a) — the 12 literal hex stay', () => {
  // D2(a) leaves the pills exactly as they were; the acceptance's letter
  // is the module file only. Any pill recolouring is a scope change.
  const expected = {
    '.phs-pill-dues': { background: '#fee2e2', color: '#b91c1c', 'border-color': '#dc9478' },
    '.phs-pill-package': { background: '#e5efff', color: '#174b87', 'border-color': '#adc9f1' },
    '.phs-pill-last-payment': { background: '#dcfce7', color: '#145b38', 'border-color': '#5fa876' },
    '.phs-pill-next-due': { background: '#fef3c7', color: '#704600', 'border-color': '#e7c77e' },
  };
  for (const [sel, props] of Object.entries(expected)) {
    const body = declarations(ruleBody(stylesCss, sel));
    for (const [prop, val] of Object.entries(props)) {
      assert.equal(body[prop], val, `${sel} ${prop} moved — the pills are D2(a) untouched`);
    }
  }
  const zero = declarations(ruleBody(stylesCss, '.phs-pill-dues-zero'));
  assert.equal(zero.background, 'var(--phs-dues-zero-bg)');
  assert.equal(zero.color, 'var(--color-emerald-dark)');
  assert.equal(zero['border-color'], 'var(--phs-dues-zero-border)');
});

// ================= G2 — The token move =================

test('G2a: the new class rules resolve to the decided tokens in light and dark', () => {
  const light = tokenMap(tokensCss, ':root');
  const darkAttr = tokenMap(tokensCss, '[data-theme="dark"]');
  const darkMedia = tokenMap(tokensCss, ':root:not([data-theme="light"])');
  const section = declarations(ruleBody(stylesCss, '.profile-header-strip'));
  // Section background + border, light and dark.
  assert.equal(resolveVar(light, section.background), '#f6f9f7');
  assert.equal(resolveVar(darkAttr, section.background), '#192d27');
  assert.equal(resolveVar(darkMedia, section.background), '#192d27');
  assert.equal(resolveVar(light, section.border.split(' ').pop()), '#dce6e1');
  assert.equal(resolveVar(darkAttr, section.border.split(' ').pop()), '#253d35');
  // Label size + colour, light and dark.
  const label = declarations(ruleBody(stylesCss, '.phs-label'));
  assert.equal(resolveVar(light, label['font-size']), '11px');
  assert.equal(resolveVar(light, label.color), '#5b6472');
  assert.equal(resolveVar(darkAttr, label.color), '#5b6472');
  assert.equal(resolveVar(darkMedia, label.color), '#5b6472');
  // Value size, light and dark (a size token has no dark variant).
  const value = declarations(ruleBody(stylesCss, '.phs-value'));
  assert.equal(resolveVar(light, value['font-size']), '15px');
  // Layout numbers resolve to the old inline literals, pixel-identical.
  assert.equal(resolveVar(light, section.gap), '12px');
  assert.equal(resolveVar(light, section.padding), '10px 12px');
  assert.equal(resolveVar(light, section.margin), '8px 0 12px');
  assert.equal(resolveVar(light, section['border-radius']), '8px');
});

test('G2b: the two new tokens are defined where D3(a)/D4(d) put them', () => {
  const light = tokenMap(tokensCss, ':root');
  const darkAttr = tokenMap(tokensCss, '[data-theme="dark"]');
  const darkMedia = tokenMap(tokensCss, ':root:not([data-theme="light"])');
  // Frozen label: the same value in :root and in BOTH dark blocks (the
  // 590 T4/T11 trap — the two dark blocks must agree, or media-query
  // users get the light value in dark).
  assert.equal(light['--phs-label'], '#5b6472');
  assert.equal(darkAttr['--phs-label'], '#5b6472');
  assert.equal(darkMedia['--phs-label'], '#5b6472');
  // Value size: :root only — a size, not a colour, so no dark variant.
  assert.equal(light['--text-phs-value'], '15px');
  assert.ok(!('--text-phs-value' in darkAttr), '--text-phs-value must not gain a dark value');
  assert.ok(!('--text-phs-value' in darkMedia), '--text-phs-value must not gain a dark value');
});

test('G2c: no new hex anywhere the ratchets watch', () => {
  // styles.css keeps exactly 608 distinct hex (comment-stripped,
  // case-sensitive — the pin method); the pill hex already occur
  // elsewhere, and the three new rules use var() only.
  assert.equal(hexCount('styles.css'), 608);
  assert.equal(hexCount('dark-contrast.css'), 19);
  assert.equal(hexCount('components.css'), 0);
  assert.equal(hexCount('nav.css'), 163);
  // tokens.css gains exactly one distinct hex: the frozen --phs-label
  // value (116 → 117). tokens.css carries no exact-count pin — this
  // records the move, it does not pin a new baseline.
  assert.equal(hexCount('tokens.css'), 117);
});

// ================= G3 — The labels in both languages =================

test('G3a: all 13 phs_* keys exist in EN and UR, defined once per dict', () => {
  const expected = {
    phs_dues: 'Dues',
    phs_package: 'Package',
    phs_last_payment: 'Last payment',
    phs_next_due: 'Next due',
    phs_no_amount_due: 'No amount due',
    phs_no_payment_yet: 'No payment yet',
    phs_not_recorded: 'Not recorded',
    phs_no_amount_due_text: 'No amount due.',
    phs_no_payment_yet_text: 'No payment yet.',
    phs_next_due_not_recorded: 'Next due date not recorded.',
    phs_unavailable: 'Profile header strip unavailable.',
    phs_aria: 'Customer at a glance',
    phs_per_month: '/month',
  };
  const navSrc = read('nav-language.js');
  const [enHalf, urHalf] = navSrc.split('\n  ur: {');
  assert.ok(enHalf && urHalf, 'expected the en/ur dict split');
  for (const [key, en] of Object.entries(expected)) {
    assert.equal(TRANSLATIONS.en[key], en, `en.${key} must be the live English string`);
    assert.ok(TRANSLATIONS.ur[key], `ur.${key} must exist`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur.${key} must carry Urdu script`);
    assert.notEqual(TRANSLATIONS.ur[key], en, `ur.${key} must differ from the English`);
    assert.equal((enHalf.match(new RegExp(`^    ${key}:`, 'gm')) || []).length, 1, `${key} defined once in en`);
    assert.equal((urHalf.match(new RegExp(`^    ${key}:`, 'gm')) || []).length, 1, `${key} defined once in ur`);
  }
  // The text sentences end with the Urdu full stop, never a Latin '.'.
  for (const key of ['phs_no_amount_due_text', 'phs_no_payment_yet_text', 'phs_next_due_not_recorded', 'phs_unavailable']) {
    assert.ok(TRANSLATIONS.ur[key].endsWith('۔'), `ur.${key} must end with '۔'`);
    assert.ok(!TRANSLATIONS.ur[key].endsWith('.'), `ur.${key} must not end with a Latin '.'`);
  }
});

test('G3b: the live strip renders its labels and fallbacks in Urdu', () => {
  const strip = baseStrip();
  const html = profileHeaderStripHtml(strip, undefined, urLabels());
  // All four labels in Urdu, none of the English labels left.
  for (const label of ['بقایا', 'پیکج', 'آخری ادائیگی', 'اگلی ادائیگی']) {
    assert.ok(html.includes(label), `Urdu strip must show ${label}`);
  }
  for (const label of ['>Dues<', '>Package<', '>Last payment<', '>Next due<']) {
    assert.ok(!html.includes(label), `Urdu strip must not show English ${label}`);
  }
  assert.ok(html.includes('aria-label="گاہک کا خلاصہ ایک نظر میں"'), 'aria-label renders in Urdu');
  assert.ok(html.includes('/ماہ'), 'the /month suffix renders as /ماہ');
  assert.ok(!html.includes('/month'), 'the Latin /month must not survive in Urdu mode');
  // The fallbacks, one strip each.
  const zero = profileHeaderStripHtml(baseStrip({ outstanding: 0 }), undefined, urLabels());
  assert.ok(zero.includes('کوئی رقم باقی نہیں'), 'zero dues reads in Urdu');
  const noPay = profileHeaderStripHtml(baseStrip({ lastPayment: null }), undefined, urLabels());
  assert.ok(noPay.includes('ابھی تک کوئی ادائیگی نہیں'), 'no payment yet reads in Urdu');
  const noDue = profileHeaderStripHtml(baseStrip({ nextDueDate: null }), undefined, urLabels());
  assert.ok(noDue.includes('ریکارڈ نہیں'), 'not recorded reads in Urdu');
  const noPkg = profileHeaderStripHtml(baseStrip({ packageLabel: '', packagePrice: null }), undefined, urLabels());
  assert.ok(noPkg.includes('طے نہیں'), "the 'Not set' package reads via prof_not_set in Urdu");
  assert.ok(!noPkg.includes('Not set'), "the English 'Not set' must not survive in Urdu mode");
});

test('G3c: with no labels passed, the strip renders the exact English of today', () => {
  // The default-English guard: plan351/plan502 call with no labels arg,
  // so every string they pin must read exactly as it did on the base.
  const strip = baseStrip();
  const html = profileHeaderStripHtml(strip);
  assert.ok(html.includes('>Dues<') && html.includes('>Package<'));
  assert.ok(html.includes('>Last payment<') && html.includes('>Next due<'));
  assert.ok(html.includes('aria-label="Customer at a glance"'));
  assert.ok(html.includes('/month') && !html.includes('/ماہ'));
  assert.ok(profileHeaderStripHtml(baseStrip({ outstanding: 0 })).includes('No amount due'));
  assert.ok(profileHeaderStripHtml(baseStrip({ lastPayment: null })).includes('No payment yet'));
  assert.ok(profileHeaderStripHtml(baseStrip({ nextDueDate: null })).includes('Not recorded'));
  assert.ok(profileHeaderStripHtml(baseStrip({ packageLabel: '', packagePrice: null })).includes('Not set'));
  // A partial labels object falls back to English per missing entry.
  const partial = profileHeaderStripHtml(strip, undefined, { dues: 'بقایا' });
  assert.ok(partial.includes('>بقایا<') && partial.includes('>Package<'));
});

test('G3d: the text function renders its sentences in Urdu (D6(a))', () => {
  const strip = baseStrip();
  const text = profileHeaderStripText(strip, undefined, urLabels());
  assert.ok(text.includes('بقایا PKR 3000۔'), 'populated dues sentence uses the Urdu label and ۔');
  assert.ok(text.includes('پیکج 5 Mbps — 200 GB (PKR 2000/ماہ)۔'), 'package sentence uses the Urdu label and /ماہ');
  assert.ok(text.includes('آخری ادائیگی PKR 2000 on 2026-10-19۔'), 'last-payment sentence uses the Urdu label');
  assert.ok(text.includes('اگلی ادائیگی 2026-11-05۔'), 'next-due sentence uses the Urdu label');
  assert.equal(profileHeaderStripText(baseStrip({ outstanding: 0 }), undefined, urLabels()), 'کوئی رقم باقی نہیں۔ پیکج 5 Mbps — 200 GB (PKR 2000/ماہ)۔ آخری ادائیگی PKR 2000 on 2026-10-19۔ اگلی ادائیگی 2026-11-05۔');
  assert.equal(profileHeaderStripText(baseStrip({ lastPayment: null }), undefined, urLabels()).includes('ابھی تک کوئی ادائیگی نہیں۔'), true);
  assert.equal(profileHeaderStripText(baseStrip({ nextDueDate: null }), undefined, urLabels()).includes('اگلی ادائیگی کی تاریخ ریکارڈ نہیں۔'), true);
  assert.equal(profileHeaderStripText(null, undefined, urLabels()), 'پروفائل ہیڈر پٹی دستیاب نہیں۔');
  // No Latin '.' may terminate an Urdu sentence (T8): every sentence
  // in the Urdu render ends with '۔'.
  for (const sentence of text.split('۔')) {
    assert.ok(!sentence.includes('.'), `Urdu sentence must not carry a Latin '.': ${sentence}`);
  }
  // No-labels call: the exact English sentences plan351 pins.
  assert.equal(profileHeaderStripText(null), 'Profile header strip unavailable.');
  assert.match(profileHeaderStripText(strip), /No amount due\.|Dues PKR 3000\./);
  // DISCLOSED, not blessed: the populated last-payment sentence keeps
  // the English word 'on' between amount and date — no key covers it,
  // and the text function has no production caller (repro A14), so its
  // Urdu is test-surface only. The assertion records the fact.
  assert.ok(profileHeaderStripText(strip, undefined, urLabels()).includes(' on '), "the text sentence still carries the English word 'on'");
});

// ================= G4 — Dark + visibility =================

test('G4a: the dark section blends with the page; labels stay readable on the pills', () => {
  const darkAttr = tokenMap(tokensCss, '[data-theme="dark"]');
  const section = declarations(ruleBody(stylesCss, '.profile-header-strip'));
  const sectionBgDark = resolveVar(darkAttr, section.background);
  // The slab blends: 1.11:1 against the dark page (was 15.29:1 pale).
  near(contrast(sectionBgDark, '#14241f'), 1.11);
  // The labels never sit on the section background — they sit on the
  // pills — so the bar is label-vs-pill, in both themes (the pills are
  // frozen, so light and dark resolve to the same numbers).
  const label = declarations(ruleBody(stylesCss, '.phs-label'));
  const labelColour = resolveVar(darkAttr, label.color);
  const pillBgs = {
    dues: '#fee2e2',
    package: '#e5efff',
    last: '#dcfce7',
    next: '#fef3c7',
  };
  const expected = { dues: 4.90, package: 5.16, last: 5.45, next: 5.37 };
  for (const [key, bg] of Object.entries(pillBgs)) {
    near(contrast(labelColour, bg), expected[key]);
    assert.ok(contrast(labelColour, bg) >= 4.5, `label on the ${key} pill must clear 4.5:1`);
  }
  // The values on the pills, same bar.
  const valueColours = { dues: '#b91c1c', package: '#174b87', last: '#145b38', next: '#704600' };
  const valueExpected = { dues: 5.30, package: 7.57, last: 7.40, next: 7.35 };
  for (const [key, colour] of Object.entries(valueColours)) {
    near(contrast(colour, pillBgs[key]), valueExpected[key]);
    assert.ok(contrast(colour, pillBgs[key]) >= 4.5, `value on the ${key} pill must clear 4.5:1`);
  }
});

test('G4b: the --muted label route is NOT taken (the R4 trap record)', () => {
  const label = declarations(ruleBody(stylesCss, '.phs-label'));
  assert.notEqual(label.color, 'var(--muted)', 'the label must not be --muted');
  assert.equal(label.color, 'var(--phs-label)', 'the label is the frozen token');
  // The rejected alternative, in the message: --muted reads #8ca39a in
  // dark, which on the pale pills is 2.20–2.44:1 — unreadable. A future
  // edit that swaps the token in must update this test deliberately.
  const muted = '#8ca39a';
  for (const bg of ['#fee2e2', '#e5efff', '#dcfce7', '#fef3c7']) {
    assert.ok(contrast(muted, bg) < 4.5, `--muted on ${bg} is ${contrast(muted, bg).toFixed(2)}:1 — below the bar, so it stays rejected`);
  }
});

test('G4c: the pills stay pale in dark — DISCLOSED shortfall, not a pass', () => {
  // Under D2(a) the four pills keep their literal hex backgrounds, so in
  // dark they are bright slabs on the dark page (13.20–14.69:1). This
  // test asserts the measured numbers AND names them as the D2(a)
  // disclosure — it does not claim them against any bar.
  const expected = { dues: 13.20, package: 13.92, last: 14.69, next: 14.49 };
  const bgs = { dues: '#fee2e2', package: '#e5efff', last: '#dcfce7', next: '#fef3c7' };
  for (const [key, bg] of Object.entries(bgs)) {
    near(contrast(bg, '#14241f'), expected[key]);
    assert.ok(contrast(bg, '#14241f') > 3, `the ${key} pill slab is pale in dark (D2(a) disclosure)`);
  }
  // The zero pill is a second pale slab (15.31:1), same disclosure.
  near(contrast('#ECFDF5', '#14241f'), 15.31);
  // And the zero pill's token values have no dark values (D2(a) leaves
  // them as-is) — its text stays readable on its own mint (5.21:1).
  const darkAttr = tokenMap(tokensCss, '[data-theme="dark"]');
  const darkMedia = tokenMap(tokensCss, ':root:not([data-theme="light"])');
  assert.ok(!('--phs-dues-zero-bg' in darkAttr), '--phs-dues-zero-bg has no dark value');
  assert.ok(!('--phs-dues-zero-border' in darkAttr), '--phs-dues-zero-border has no dark value');
  assert.ok(!('--phs-dues-zero-bg' in darkMedia), '--phs-dues-zero-bg has no media-query dark value');
  assert.ok(!('--phs-dues-zero-border' in darkMedia), '--phs-dues-zero-border has no media-query dark value');
  near(contrast('#047857', '#ECFDF5'), 5.21);
});

// ================= G5 — Guards + completeness =================

test('G5a: parity is 5,195/5,195 and the re-pin set is complete', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5195, 'EN parity 5,195');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5195, 'UR parity 5,195');
  // Every file that pinned 5,187 now pins 5,195 (35 files), and no file
  // still pins the old count. This file itself asserts 5,168 — plus
  // Plan 592's new test file, which pins 5,168 as its own G5 guard
  // (the parity VALUE does not move; only the file count does) — plus
  // Hisaab H3's new test file, which pins 5,168 as its own G5 guard
  // the same way — plus Plan 593's new test file, which pins 5,168 as
  // its own G5 guard the same way — plus Plan 594's new test file,
  // which pins 5,168 as its own G5 guard the same way — plus Plan
  // 596's new test file, which pins 5,168 as its own G5 guard the
  // same way — plus Plan 600's new test file, which pins 5,168 as its
  // own guard the same way — plus Plan 601's new test file, which pins
  // 5,168 as its own guard the same way — plus Plan 604's new test
  // file, which pins 5,168 as its own guard the same way — plus Plan
  // 606's new test file, which pins 5,168 as its own guard the same
  // way — plus Plan 608's new test file, which pins 5,168 as its own
  // guard the same way, so the count is 35. (Plan 602's new test file
  // pins no parity total, which is why the count held at 32 through
  // 602 — and Plan 611's new test file pins no parity total either,
  // which is why the count holds at 35 through 611 — and Plan 612's
  // new test file pins no parity total either, which is why the count
  // holds at 35 through 612 — and the Performance & Collection
  // Analytics new test file pins the new total, which is why the count
  // moves to 36.) The sweep below
  // counts 36, not 37: the privacy canary
  // (tests/privacy-zero-pii-ratchet.test.js) holds the OLD digits
  // '5162' inside the invented CNIC '35202-4815162-3' — a PII fixture,
  // not a parity pin, so it is never re-pinned and it drops out of the
  // fresh count; the old-sweep excludes it for the same reason.
  const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js'));
  // This file itself mentions '5187' as the literal it checks against,
  // so it is excluded from the sweep — and so is the privacy canary,
  // which holds the old digits inside its invented CNIC. Every OTHER
  // file must be clean.
  const old = testFiles.filter((f) => f !== 'plan591-header-strip-tokens-i18n.test.js' && f !== 'privacy-zero-pii-ratchet.test.js' && read(`tests/${f}`).includes('5187'));
  const fresh = testFiles.filter((f) => read(`tests/${f}`).includes('5195'));
  assert.deepEqual(old, [], 'no test file may still pin 5,187');
  assert.equal(fresh.length, 36, `expected 36 files containing 5,195 (35 re-pins + the Analytics pinning file; the privacy canary holds the old digits), got ${fresh.length}: ${fresh.join(', ')}`);
});

test('G5b: the wiring is the labels object, and the module stays pure', () => {
  // app.js passes all 14 entries (13 fresh keys + prof_not_set).
  assert.ok(appJs.includes('profileHeaderStripHtml(profileHeaderStrip, formatAmount, {'));
  for (const key of ['phs_dues', 'phs_package', 'phs_last_payment', 'phs_next_due', 'phs_no_amount_due', 'phs_no_payment_yet', 'phs_not_recorded', 'phs_no_amount_due_text', 'phs_no_payment_yet_text', 'phs_next_due_not_recorded', 'phs_unavailable', 'phs_aria', 'phs_per_month']) {
    assert.ok(appJs.includes(`t('${key}')`), `app.js must pass t('${key}')`);
  }
  assert.ok(appJs.includes("notSet: t('prof_not_set')"), "app.js must pass t('prof_not_set') for the 'Not set' data value");
  // The module stays pure and keeps the Plan 502 wording.
  assert.doesNotMatch(moduleSrc, /import /);
  assert.ok(moduleSrc.includes("'Not set'"), "the module still reads 'Not set' (Plan 502)");
  assert.doesNotMatch(moduleSrc, /No package recorded/, "'No package recorded' is pre-502 wording and must not come back (trap T2)");
});

test('G5c: the strings left behind are listed, not silently claimed fixed', () => {
  // What 591 deliberately does NOT fix (D2(a) pills, D6(b) n/a — the
  // text function IS translated, so only the pills and the 'on' word
  // remain). Each is asserted in its own group; this test pins the
  // inventory so a later edit cannot silently claim them.
  const pillRules = ['.phs-pill-dues', '.phs-pill-package', '.phs-pill-last-payment', '.phs-pill-next-due'];
  for (const sel of pillRules) {
    assert.match(ruleBody(stylesCss, sel), /background:#[0-9a-fA-F]{6}/, `${sel} still carries a literal hex background (D2(a) disclosure)`);
  }
  assert.ok(profileHeaderStripText(baseStrip(), undefined, urLabels()).includes(' on '), "the text sentence still carries the English word 'on' (disclosed)");
  // The 12 stale '4,669' parity TITLES + 5 why-comments are NOT this
  // plan's sweep: the asserts moved to 5,195 (G5a) while the titles
  // stay as they were — a title sweep is a different item. This asserts
  // the split: each of the 12 files still carries '4,669' somewhere
  // (title or comment) AND pins 5,195 in its asserts.
  const staleTitleFiles = [
    'plan566-receipt-card-nan-guard.test.js',
    'plan567-urdu-script-labels.test.js',
    'plan568-dynamic-receipt-labels.test.js',
    'plan569-urdu-script-wiring-css.test.js',
    'plan570-terms-reminder-coverage.test.js',
    'plan577-secondary-receipt-area-terms.test.js',
    'plan578-settlement-offset-ver-void.test.js',
    'plan579-split-card-month-date-package-tax-ver.test.js',
    'sharafat-93-backup-health-i18n.test.js',
    'sharafat-95-rtl-logical-css.test.js',
    'sharafat-96-touch-targets.test.js',
    'sharafat-100-profile-tab-fit.test.js',
  ];
  for (const name of staleTitleFiles) {
    const src = read(`tests/${name}`);
    assert.ok(src.includes('4,669'), `${name} still carries its stale '4,669' title/comment (not this plan's sweep)`);
    assert.ok(src.includes('5195'), `${name} pins 5,195 in its asserts`);
    assert.ok(!src.includes('5187'), `${name} no longer pins 5,187`);
  }
});
