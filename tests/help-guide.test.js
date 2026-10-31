/**
 * help-guide.test.js — OWNER-HELP: per-feature ℹ️ guide popups.
 *
 * Pins (synthetic data only; no ledger data is read or written):
 *  (a) Every data-help key used anywhere in shipped code resolves to a
 *      registry entry whose title + body exist in BOTH en and ur.
 *  (b) Every registry entry is mounted by at least one data-help usage
 *      (no orphan/dead topics, no unregistered mounts — the set is
 *      tight in both directions).
 *  (c) The shared dialog markup uses the unified class="close-btn" ↩
 *      close button and the shared dialog.billing-modal shell whose
 *      surface is var(--modal-surface) (dark-mode safe).
 *  (d) openHelpTopic renders the right title/body for a sample key,
 *      and helpTopicContent returns the exact dictionary strings in
 *      BOTH languages; unknown topics are refused, never rendered.
 *  (e) No help body or title contains fabricated placeholder text.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  HELP_TOPICS,
  HELP_TOPIC_KEYS,
  HELP_DIALOG_ID,
  HELP_TITLE_ID,
  HELP_BODY_ID,
  helpButtonMarkup,
  helpTopicContent,
  openHelpTopic,
} from '../help-guide.js';
import { TRANSLATIONS } from '../nav-language.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

/** All shipped runtime sources: index.html + every root-level .js module. */
function shippedSources() {
  const files = ['index.html'];
  for (const name of readdirSync(root)) {
    if (name.endsWith('.js') && !name.endsWith('.test.js')) files.push(name);
  }
  return files.map((name) => ({ name, text: read(name) }));
}

/** Every topic key mounted anywhere in shipped code. */
function mountedTopicKeys() {
  const keys = new Set();
  for (const { text } of shippedSources()) {
    for (const m of text.matchAll(/data-help="([a-z0-9_]+)"/g)) keys.add(m[1]);
    for (const m of text.matchAll(/helpButtonMarkup\('([a-z0-9_]+)'\)/g)) keys.add(m[1]);
  }
  return keys;
}

test('OWNER-HELP (a): every mounted data-help key resolves with en+ur title and body', () => {
  const mounted = mountedTopicKeys();
  assert.ok(mounted.size >= 20, `expected at least 20 mounted topics, found ${mounted.size}`);
  for (const key of mounted) {
    const topic = HELP_TOPICS[key];
    assert.ok(topic, `data-help="${key}" has no registry entry`);
    for (const lang of ['en', 'ur']) {
      const title = TRANSLATIONS[lang][topic.titleKey];
      const body = TRANSLATIONS[lang][topic.bodyKey];
      assert.equal(typeof title, 'string', `${lang} missing title key ${topic.titleKey}`);
      assert.equal(typeof body, 'string', `${lang} missing body key ${topic.bodyKey}`);
      assert.ok(title.trim().length > 0, `${lang} title empty for ${key}`);
      assert.ok(body.trim().length >= 60, `${lang} body too short to be a real guide for ${key}`);
    }
  }
});

test('OWNER-HELP (b): every registry entry is mounted at least once (no orphans)', () => {
  const mounted = mountedTopicKeys();
  for (const key of HELP_TOPIC_KEYS) {
    assert.ok(mounted.has(key), `registry topic "${key}" is never mounted`);
  }
  assert.deepEqual(
    [...mounted].sort(),
    [...HELP_TOPIC_KEYS].sort(),
    'mounted topic set must equal the registry set exactly',
  );
});

test('OWNER-HELP (c): shared dialog uses the unified close-btn and the var(--modal-surface) shell', () => {
  const html = read('index.html');
  const dialogMatch = html.match(/<dialog id="helpGuideDialog"[^>]*>/);
  assert.ok(dialogMatch, 'helpGuideDialog missing from index.html');
  assert.match(dialogMatch[0], /class="[^"]*\bbilling-modal\b/, 'dialog must use the shared billing-modal shell');
  const closeMatch = html.match(/<button id="helpGuideCloseBtn"[^>]*>([^<]*)<\/button>/);
  assert.ok(closeMatch, 'helpGuideCloseBtn missing');
  assert.match(closeMatch[0], /class="close-btn"/, 'close button must use the unified close-btn class');
  assert.equal(closeMatch[1].trim(), '↩', 'close button glyph must be the unified ↩');
  const styles = read('styles.css');
  assert.match(
    styles,
    /dialog\.billing-modal[^{]*\{[^}]*background:\s*var\(--modal-surface\)/,
    'dialog.billing-modal shell must paint var(--modal-surface)',
  );
});

test('OWNER-HELP (d): openHelpTopic renders the sample topic; content resolves in both languages', () => {
  const els = {
    [HELP_DIALOG_ID]: {
      open: false,
      shown: 0,
      showModal() { this.open = true; this.shown += 1; },
      close() { this.open = false; },
    },
    [HELP_TITLE_ID]: { textContent: '' },
    [HELP_BODY_ID]: { textContent: '' },
  };
  const fakeDoc = { getElementById: (id) => els[id] || null };

  assert.equal(openHelpTopic('optical_rx', fakeDoc), true);
  assert.equal(els[HELP_DIALOG_ID].open, true);
  assert.equal(els[HELP_TITLE_ID].textContent, TRANSLATIONS.en.help_optical_rx_title);
  assert.equal(els[HELP_BODY_ID].textContent, TRANSLATIONS.en.help_optical_rx_body);
  assert.match(els[HELP_BODY_ID].textContent, /-26 dBm/, 'optical guide must state the real weak-signal threshold');

  for (const lang of ['en', 'ur']) {
    const content = helpTopicContent('optical_rx', lang);
    assert.equal(content.title, TRANSLATIONS[lang].help_optical_rx_title);
    assert.equal(content.body, TRANSLATIONS[lang].help_optical_rx_body);
  }

  // Unknown topics are refused — a raw dictionary key must never render.
  assert.equal(helpTopicContent('no_such_topic'), null);
  assert.equal(openHelpTopic('no_such_topic', fakeDoc), false);
});

test('OWNER-HELP (e): no help text contains fabricated placeholders', () => {
  const banned = [/todo/i, /lorem/i, /placeholder/i, /fixme/i, /xxx/i];
  for (const key of HELP_TOPIC_KEYS) {
    const topic = HELP_TOPICS[key];
    for (const lang of ['en', 'ur']) {
      for (const dictKey of [topic.titleKey, topic.bodyKey]) {
        const value = TRANSLATIONS[lang][dictKey];
        for (const pattern of banned) {
          assert.ok(!pattern.test(value), `${lang}.${dictKey} contains placeholder text ${pattern}`);
        }
      }
    }
  }
});

test('OWNER-HELP: the ℹ️ button is never a close control (SISP-87 audit safety)', () => {
  const markup = helpButtonMarkup('field_mode');
  assert.match(markup, /class="help-info-btn"/);
  assert.match(markup, /data-help="field_mode"/);
  assert.match(markup, /type="button"/);
  assert.ok(!/data-close/i.test(markup), 'help button must not carry data-close');
  assert.ok(!/aria-label="[^"]*close/i.test(markup), 'help button aria-label must not say "close"');
  const html = read('index.html');
  for (const m of html.matchAll(/<button class="help-info-btn"[^>]*>/g)) {
    assert.ok(!/data-close/i.test(m[0]), 'static help button must not carry data-close');
    assert.ok(!/aria-label="[^"]*close/i.test(m[0]), 'static help button aria-label must not say "close"');
  }
});

test('OWNER-HELP: every topic carries exactly the help_<topic>_title/_body key scheme', () => {
  for (const key of HELP_TOPIC_KEYS) {
    assert.equal(HELP_TOPICS[key].titleKey, `help_${key}_title`);
    assert.equal(HELP_TOPICS[key].bodyKey, `help_${key}_body`);
  }
  assert.equal(typeof TRANSLATIONS.en.help_aria_label, 'string');
  assert.equal(typeof TRANSLATIONS.ur.help_aria_label, 'string');
});
