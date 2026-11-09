import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, '..', name), 'utf8');

const ruleBody = (css, selectorPattern) => {
  const m = css.match(selectorPattern);
  assert.ok(m, `rule must exist: ${selectorPattern}`);
  return m[1];
};

// The profile Edit button must read as the primary action in the header
// row: filled with the app green token and white text, not another pale
// outlined button like its neighbours.
test('profile Edit button is a filled primary button', () => {
  const css = read('ui-feedback.css');
  const body = ruleBody(css, /#editProfileButton\.profile-edit-button:not\(\[hidden\]\) \{([^}]*)\}/);
  assert.match(body, /background: var\(--green/);
  assert.match(body, /border: 1px solid var\(--green/);
  assert.match(body, /color: #fff/);
  assert.match(body, /font-weight: 700/);
  assert.match(body, /white-space: nowrap/);
  assert.match(body, /box-shadow:/);
});

test('profile Edit button keeps its thumb-sized target and pencil icon', () => {
  const css = read('ui-feedback.css');
  const body = ruleBody(css, /#editProfileButton\.profile-edit-button:not\(\[hidden\]\) \{([^}]*)\}/);
  assert.match(body, /min-height: 48px/);
  assert.match(body, /font-size: 14px/);
  assert.match(body, /padding: 0 16px/);
  assert.match(css, /\.profile-edit-button::before \{ content: '✎'/);
});

test('profile header action row wraps and labels never break mid-label', () => {
  const css = read('styles.css');
  const actions = ruleBody(css, /\.profile-view-actions\{([^}]*)\}/);
  assert.match(actions, /flex-wrap:wrap/);
  // The shared heading rule also contains `.profile-view-heading`, so
  // check every occurrence: the profile-only rule must carry the wrap.
  const headings = [...css.matchAll(/\.profile-view-heading\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(headings.some((b) => /flex-wrap:wrap/.test(b)), 'a .profile-view-heading rule must wrap');
  const feedback = read('ui-feedback.css');
  assert.match(feedback, /\.profile-view-actions \.secondary-button \{ white-space: nowrap; \}/);
});

// Root cause of the reported overlap: the author `display: flex` on the
// floating button overrode the UA `hidden` rule, and the base rule had no
// opacity, so the button showed even at the top of the page, sitting over
// the profile Speak Due button. It must stay invisible until JS adds
// .is-visible after scrolling past 300px.
test('floating scroll-top button is hidden until scrolled', () => {
  const css = read('nav.css');
  const base = ruleBody(css, /\.scroll-top-button \{([^}]*)\}/);
  assert.match(base, /opacity: 0/);
  assert.match(base, /pointer-events: none/);
  const hidden = ruleBody(css, /\.scroll-top-button\[hidden\] \{([^}]*)\}/);
  assert.match(hidden, /display: none/);
  const visible = ruleBody(css, /\.scroll-top-button\.is-visible \{([^}]*)\}/);
  assert.match(visible, /opacity: 1/);
  assert.match(visible, /pointer-events: auto/);
});

test('floating scroll-top button keeps clearance above the mobile bottom nav', () => {
  const css = read('nav.css');
  const mobile = css.slice(css.indexOf('.scroll-top-button {\n    bottom:'));
  assert.match(mobile, /bottom: 60px/);
  assert.match(mobile, /right: 12px/);
});

// Behaviour is untouched: same button, same id, same edit flow, and the
// per-field Save wiring from the earlier profile polish is still present.
// Polish #24 — the button moved from a re-rendered heading into static
// header markup, so the markup lives in index.html now and its listener
// attaches once at startup to the id directly.
test('Edit button wiring and per-field save wiring are unchanged', () => {
  const app = read('app.js');
  const html = read('index.html');
  assert.ok(html.includes('id="editProfileButton"'), 'Edit button markup must exist in the static header');
  assert.ok(html.includes('profile-edit-button'), 'Edit button class must exist in the static header');
  assert.ok(app.includes("$('#editProfileButton').addEventListener('click'"), 'Edit click listener must exist');
  assert.ok(app.includes('profileEditMode = true'), 'Edit must still open the edit flow');
  assert.ok(app.includes('profile-field-save'), 'per-field Save wiring from PR #813 must remain');
});
