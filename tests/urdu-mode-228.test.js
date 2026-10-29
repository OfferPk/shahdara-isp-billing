import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  TRANSLATIONS,
  VISIBLE_TEXT_UR,
  PLACEHOLDER_TEXT_UR,
  isEnglishOnlyVisibleText,
  isAllowlistedVisibleText,
  translateVisibleText,
  setBidiSafeText
} from '../nav-language.js';
import { ENTRY_FILES } from '../build.mjs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('#228 t() dictionary: every English key has an Urdu translation with Urdu script', () => {
  assert.deepEqual(Object.keys(TRANSLATIONS.ur).sort(), Object.keys(TRANSLATIONS.en).sort());
  for (const [key, value] of Object.entries(TRANSLATIONS.ur)) {
    assert.ok(typeof value === 'string' && value.length > 0, `ur.${key} is non-empty`);
  }
});

test('#228 visible-text dictionary covers the main-screen buttons and every value is Urdu', () => {
  for (const key of ['+ Add payment', 'Clear', 'Paid', 'Pending', 'Partial', 'Top Defaulters', 'Monthly Report', '📥 Export CSV', 'Download all payment details (.txt)']) {
    assert.ok(VISIBLE_TEXT_UR[key], `visible-text Urdu exists for ${JSON.stringify(key)}`);
  }
  for (const [en, ur] of Object.entries(VISIBLE_TEXT_UR)) {
    assert.ok(/[\u0600-\u06FF]/.test(ur), `${JSON.stringify(en)} -> ${JSON.stringify(ur)} contains Urdu script`);
    assert.notEqual(ur, en);
  }
  for (const ur of Object.values(PLACEHOLDER_TEXT_UR)) assert.ok(/[\u0600-\u06FF]/.test(ur));
});

test('#228 pattern translations: diagnostics, fleet audits, counters and customer cards', () => {
  assert.equal(translateVisibleText('BGP Diagnostics'), 'BGP تشخیص');
  assert.equal(translateVisibleText('CPE Fleet Audit'), 'CPE فلیٹ آڈٹ');
  assert.equal(translateVisibleText('Active 12'), 'فعال 12');
  assert.equal(translateVisibleText('Not set 74'), 'منتخب نہیں 74');
  assert.equal(translateVisibleText('N #1 Test Customer 01 Package not set'), 'N #1 Test Customer 01 پیکیج منتخب نہیں');
  assert.equal(translateVisibleText('Customers 74'), 'گاہک 74');
  assert.equal(translateVisibleText('Something Unlisted'), null);
});

test('#228 English-only detection and the allow-list (toggle label, brand)', () => {
  assert.equal(isEnglishOnlyVisibleText('Top Defaulters'), true);
  assert.equal(isEnglishOnlyVisibleText('بڑے نادہندگان'), false);
  assert.equal(isEnglishOnlyVisibleText('BGP تشخیص'), false);
  assert.equal(isEnglishOnlyVisibleText('🌐 English'), true);
  assert.equal(isAllowlistedVisibleText('🌐 English'), true);
  assert.equal(isAllowlistedVisibleText('Shahdara'), true);
  assert.equal(isAllowlistedVisibleText('Top Defaulters'), false);
});

test('#228 bidi: amounts and phone numbers are wrapped in <bdi> elements', () => {
  const created = [];
  const doc = {
    createElement: tag => {
      const el = { tag, textContent: '', children: [], appendChild(c) { this.children.push(c); } };
      created.push(el);
      return el;
    },
    createTextNode: text => ({ text })
  };
  const host = {
    ownerDocument: doc,
    textContent: '',
    children: [],
    appendChild(c) { this.children.push(c); }
  };
  setBidiSafeText(host, 'کل PKR 2,500 وصول');
  const bdi = host.children.find(c => c.tag === 'bdi');
  assert.ok(bdi, 'amount is wrapped in a bdi element');
  assert.equal(bdi.textContent, 'PKR 2,500');
  setBidiSafeText(host, 'رابطہ 0300 1234567 کریں');
  assert.ok(host.children.some(c => c.tag === 'bdi' && /0300/.test(c.textContent)), 'phone number is wrapped in a bdi element');
});

test('#228 self-hosted Nastaliq font: subset css exists, is built, loads only in Urdu mode', () => {
  assert.ok(existsSync(new URL('../urdu-font.css', import.meta.url)), 'urdu-font.css exists');
  const css = read('urdu-font.css');
  assert.match(css, /font-family: 'Noto Nastaliq Urdu'/);
  assert.match(css, /src: url\(data:font\/woff2;base64,/, 'font is self-hosted as an embedded subset, no CDN');
  assert.match(css, /html\.lang-ur button[^}]*line-height: 2 !important/, 'Urdu buttons get Nastaliq line-height ≈ 2');
  assert.match(css, /html\.lang-ur table[^}]*Noto Naskh/, 'dense tables use the Naskh-first stack');
  assert.ok(css.length > 100_000, 'subset font data is embedded');
  assert.ok(ENTRY_FILES.includes('urdu-font.css'), 'build ships urdu-font.css');
  const index = read('index.html');
  assert.ok(!index.includes('urdu-font.css'), 'index.html does not preload the Urdu font (English first load stays lean)');
  const lang = read('nav-language.js');
  assert.match(lang, /ensureUrduFont/, 'language module loads the font');
  assert.match(lang, /urduFontLink/, 'font link is injected once, in Urdu mode');
});

test('#228 RTL stylesheet uses logical properties and bidi isolation', () => {
  const navCss = read('nav.css');
  assert.match(navCss, /margin-inline-start/);
  assert.match(navCss, /margin-inline-end/);
  assert.match(navCss, /inset-inline-end/);
  assert.match(navCss, /unicode-bidi: plaintext/, 'mixed English paragraphs keep punctuation order in RTL');
  assert.match(navCss, /unicode-bidi: isolate/, 'bdi elements isolate numbers/amounts');
});
