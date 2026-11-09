// Polish #20 — the Installation home tile showed the raw i18n key
// "dash_tile_installation_title" instead of "Installation" / "انسٹالیشن".
//
// User-reported with a phone screenshot (2026-11-09): the 5th home tile
// (polish #18) read "dash_tile_installation_title" on the user's phone.
// Root cause, parent-verified in the code: the tile markup carries good
// static text and the dictionary HAS both keys in both languages — but
// the data-i18n applier (updateDocumentTranslations, nav-language.js)
// writes t(key) UNCONDITIONALLY, and t() returns the raw key when the
// key is missing from both dicts. On the user's phone the applier ran
// against a STALE nav-language.js (pre-polish-#18, no such keys) while
// index.html was fresh (post-#18, has the tile) — mixed-version stale
// cache from the frozen ?v=1.11.0 pins + the service worker's
// cache-first assets with ignoreSearch. The applier overwrote the good
// static "Installation" with the raw key.
//
// The fix lives in the applier only: when t(key) returns the key itself
// (translation missing), keep the element's existing static text /
// attribute value instead of writing the raw key. t() itself is
// untouched — t('nonexistent_key') === 'nonexistent_key' is pinned by
// an existing test (mobile-nav.test.js) and stays that way.
//
// Pins:
//  - REPRO: with the tile keys missing from the dictionary (the stale
//    cache, simulated by temporarily deleting them), the tile title
//    still reads "Installation", the subtitle still reads
//    "Fees collected & pending", and the aria-label keeps its static
//    text — no raw key anywhere (fails on the pristine head);
//  - with the dictionary present, Urdu mode applies "انسٹالیشن" /
//    "وصول شدہ اور باقی فیس" and English mode applies "Installation" /
//    "Fees collected & pending" (title, subtitle, aria-label);
//  - the same guard on placeholder, title and aria-label: a missing
//    key keeps the existing attribute value, a present key applies the
//    translation;
//  - the preserve-children branch keeps text + children on a missing
//    key and applies the translation on a present one;
//  - an element with empty static text stays empty on a missing key
//    (no raw key written into it);
//  - wiring: t() behaviour unchanged; the guard lives in the applier
//    only; the tile markup still carries its static text.
//
// Synthetic data only: the tile's own static text from index.html;
// no customer names, no phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { TRANSLATIONS, t, updateDocumentTranslations } from '../nav-language.js';

const navLanguageSource = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const TILE_KEYS = [
  'dash_tile_installation_title',
  'dash_tile_installation_sub',
  'dash_tile_installation_aria',
];

// Minimal stand-in for a DOM element: the applier only reads
// getAttribute / hasAttribute / textContent and writes textContent or
// setAttribute, plus querySelectorAll/appendChild on the
// preserve-children path.
class StubEl {
  constructor(attrs = {}, text = '') {
    this._attrs = { ...attrs };
    this._textContent = text;
    this.children = [];
  }

  // Setting textContent clears child nodes, like the real DOM — which
  // is what the preserve-children branch relies on before re-adding
  // the badges it captured.
  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  getAttribute(name) {
    return this._attrs[name] ?? null;
  }

  setAttribute(name, value) {
    this._attrs[name] = String(value);
  }

  hasAttribute(name) {
    return name in this._attrs;
  }

  querySelectorAll() {
    return [...this.children];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

// The applier's later sections (bottom nav, drawer, QC titles) look up
// elements by id/class; returning null/[] for everything skips them,
// which is exactly what a container without those surfaces does.
function mockContainer({ text = [], placeholder = [], title = [], aria = [] } = {}) {
  return {
    querySelectorAll(selector) {
      if (selector === '[data-i18n]') return text;
      if (selector === '[data-i18n-placeholder]') return placeholder;
      if (selector === '[data-i18n-title]') return title;
      if (selector === '[data-i18n-aria-label]') return aria;
      return [];
    },
    querySelector() {
      return null;
    },
  };
}

function tileElements() {
  const title = new StubEl({ 'data-i18n': 'dash_tile_installation_title' }, 'Installation');
  const sub = new StubEl({ 'data-i18n': 'dash_tile_installation_sub' }, 'Fees collected & pending');
  const button = new StubEl(
    {
      'data-i18n-aria-label': 'dash_tile_installation_aria',
      'aria-label': 'Installation — Fees collected & pending (Open the installation dashboard)',
    },
    '',
  );
  return { title, sub, button };
}

// Simulates the user's stale cache: the loaded nav-language.js predates
// polish #18, so the tile keys are absent from both dictionaries.
// Restores them afterwards, whatever happens.
function withStaleDictionary(fn) {
  const saved = {};
  for (const lang of ['en', 'ur']) {
    saved[lang] = {};
    for (const key of TILE_KEYS) {
      saved[lang][key] = TRANSLATIONS[lang][key];
      delete TRANSLATIONS[lang][key];
    }
  }
  try {
    return fn();
  } finally {
    for (const lang of ['en', 'ur']) {
      for (const key of TILE_KEYS) {
        TRANSLATIONS[lang][key] = saved[lang][key];
      }
    }
  }
}

test('REPRO: stale dictionary keeps the tile static text instead of writing the raw key', () => {
  withStaleDictionary(() => {
    const { title, sub, button } = tileElements();
    updateDocumentTranslations('en', mockContainer({
      text: [title, sub],
      aria: [button],
    }));
    assert.equal(title.textContent, 'Installation');
    assert.equal(sub.textContent, 'Fees collected & pending');
    assert.equal(
      button.getAttribute('aria-label'),
      'Installation — Fees collected & pending (Open the installation dashboard)',
    );
    assert.ok(!title.textContent.includes('dash_tile_installation_title'));
    assert.ok(!sub.textContent.includes('dash_tile_installation_sub'));
    assert.ok(!button.getAttribute('aria-label').includes('dash_tile_installation_aria'));
  });
  // The keys are back afterwards, so later tests see the real dictionary.
  assert.equal(t('dash_tile_installation_title', 'en'), 'Installation');
});

test('present dictionary applies the tile translations in both languages', () => {
  const en = tileElements();
  updateDocumentTranslations('en', mockContainer({ text: [en.title, en.sub], aria: [en.button] }));
  assert.equal(en.title.textContent, 'Installation');
  assert.equal(en.sub.textContent, 'Fees collected & pending');
  assert.equal(
    en.button.getAttribute('aria-label'),
    'Installation — Fees collected & pending (Open the installation dashboard)',
  );

  const ur = tileElements();
  updateDocumentTranslations('ur', mockContainer({ text: [ur.title, ur.sub], aria: [ur.button] }));
  assert.equal(ur.title.textContent, 'انسٹالیشن');
  assert.equal(ur.sub.textContent, 'وصول شدہ اور باقی فیس');
  assert.equal(
    ur.button.getAttribute('aria-label'),
    'انسٹالیشن — وصول شدہ اور باقی فیس (انسٹالیشن ڈیش بورڈ کھولیں)',
  );
});

test('placeholder guard: missing key keeps the existing placeholder, present key applies', () => {
  const missing = new StubEl(
    { 'data-i18n-placeholder': 'polish20_no_such_key', placeholder: 'Search customers…' },
    '',
  );
  const present = new StubEl(
    { 'data-i18n-placeholder': 'search_placeholder', placeholder: 'Search customers…' },
    '',
  );
  updateDocumentTranslations('en', mockContainer({ placeholder: [missing, present] }));
  assert.equal(missing.getAttribute('placeholder'), 'Search customers…');
  assert.equal(present.getAttribute('placeholder'), t('search_placeholder', 'en'));
  assert.ok(!missing.getAttribute('placeholder').includes('polish20_no_such_key'));
});

test('title and aria-label guards: missing key keeps the existing value, present key applies', () => {
  const titleMissing = new StubEl(
    { 'data-i18n-title': 'polish20_no_such_key', title: 'Switch to Urdu' },
    '',
  );
  const titlePresent = new StubEl(
    { 'data-i18n-title': 'lang_switch_title', title: 'Switch to Urdu' },
    '',
  );
  const ariaMissing = new StubEl(
    { 'data-i18n-aria-label': 'polish20_no_such_key', 'aria-label': 'Switch interface language' },
    '',
  );
  const ariaPresent = new StubEl(
    { 'data-i18n-aria-label': 'lang_aria_label', 'aria-label': 'Switch interface language' },
    '',
  );
  updateDocumentTranslations('en', mockContainer({
    title: [titleMissing, titlePresent],
    aria: [ariaMissing, ariaPresent],
  }));
  assert.equal(titleMissing.getAttribute('title'), 'Switch to Urdu');
  assert.equal(titlePresent.getAttribute('title'), t('lang_switch_title', 'en'));
  assert.equal(ariaMissing.getAttribute('aria-label'), 'Switch interface language');
  assert.equal(ariaPresent.getAttribute('aria-label'), t('lang_aria_label', 'en'));
  assert.ok(!titleMissing.getAttribute('title').includes('polish20_no_such_key'));
  assert.ok(!ariaMissing.getAttribute('aria-label').includes('polish20_no_such_key'));
});

test('preserve-children branch: missing key keeps text and children, present key applies', () => {
  const badge = new StubEl({}, '');
  const missing = new StubEl(
    { 'data-i18n': 'polish20_no_such_key', 'data-i18n-preserve-children': '' },
    'Collect',
  );
  missing.children = [badge];
  const present = new StubEl(
    { 'data-i18n': 'nav_collection', 'data-i18n-preserve-children': '' },
    'Collect',
  );
  present.children = [badge];
  updateDocumentTranslations('en', mockContainer({ text: [missing, present] }));
  assert.equal(missing.textContent, 'Collect');
  assert.deepEqual(missing.children, [badge]);
  assert.equal(present.textContent, `${t('nav_collection', 'en')} `);
  assert.deepEqual(present.children, [badge]);
});

test('empty static text stays empty on a missing key — no raw key written in', () => {
  const el = new StubEl({ 'data-i18n': 'polish20_no_such_key' }, '');
  updateDocumentTranslations('en', mockContainer({ text: [el] }));
  assert.equal(el.textContent, '');
});

test('wiring: t() is unchanged and the guard lives in the applier only', () => {
  // t() still returns the key itself for a missing key (pinned by
  // mobile-nav.test.js) — the fix is in the applier, not in t().
  assert.equal(t('nonexistent_key', 'en'), 'nonexistent_key');
  assert.equal(t('polish20_no_such_key', 'ur'), 'polish20_no_such_key');
  // The applier skips a write when the translation comes back as the
  // key itself, in all four data-i18n sections.
  assert.match(navLanguageSource, /translated === key/);
  assert.match(navLanguageSource, /if \(translated !== key\) el\.setAttribute\('placeholder', translated\)/);
  assert.match(navLanguageSource, /if \(translated !== key\) el\.setAttribute\('title', translated\)/);
  assert.match(navLanguageSource, /if \(translated !== key\) el\.setAttribute\('aria-label', translated\)/);
  // t()'s own fallback is untouched.
  assert.match(navLanguageSource, /let text = dict\[key\] \?\? TRANSLATIONS\.en\[key\] \?\? key;/);
  // The tile markup still ships its static text as the fallback.
  assert.match(indexSource, /data-i18n="dash_tile_installation_title">Installation</);
  assert.match(indexSource, /data-i18n="dash_tile_installation_sub">Fees collected &amp; pending</);
});
