// Modal close-button redesign (user-ordered 2026-10-28): every modal, dialog
// and sheet close button is one unmistakable red circle with a white back
// arrow (↩), 48px tap target, theme tokens only — so the old white-box-in-
// dark-mode look cannot come back. The channel-remove button in
// nav-wdm-spectrum.js deliberately uses .wdm-remove-btn, not a close class.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const CLOSE_CLASSES = [
  'close-button',
  'modal-close-btn',
  'billing-modal-close',
  'modal-close',
  'close-btn',
  'field-tools-close-btn',
  'sheet-close-btn',
];
const CLOSE_CLASS_RE = new RegExp(`class="[^"]*(?:${CLOSE_CLASSES.join('|')})`);
const CLOSE_LABEL_RE = /aria-label="[^"]*[Cc]lose/;
const BUTTON_RE = /<button\b[^>]*>([^<]*)<\/button>/g;

function closeButtonsIn(source) {
  const found = [];
  for (const m of source.matchAll(BUTTON_RE)) {
    const full = m[0];
    const openTag = full.slice(0, full.indexOf('>') + 1);
    if (CLOSE_CLASS_RE.test(openTag) && CLOSE_LABEL_RE.test(openTag)) found.push(m[1]);
  }
  return found;
}

test('modal close redesign: one shared red-circle rule covers every close class', () => {
  const css = read('components.css');
  for (const cls of CLOSE_CLASSES) assert.ok(css.includes(`.${cls}`), `components.css covers .${cls}`);
  assert.ok(css.includes('background: var(--color-overdue);'), 'close background uses the overdue-red token');
  assert.ok(css.includes('color: var(--color-neutral-0);'), 'close glyph uses the neutral-0 token');
  assert.ok(css.includes('border-radius: 50%;'), 'close button is a circle');
  assert.ok(css.includes('width: 48px;') && css.includes('height: 48px;'), 'close button is a 48px tap target');
});

test('modal close redesign: phone close rule is a red circle, not the old square', () => {
  const css = read('styles.css');
  assert.ok(!css.includes('border-radius: 12px !important'), 'old 12px square close rule is gone');
  assert.ok(css.includes('border-radius: 50% !important'), 'phone close rule is a circle');
  assert.ok(css.includes('background: var(--color-overdue) !important'), 'phone close rule is red');
});

test('modal close redesign: every dialog close button shows the back arrow', () => {
  const sources = [['index.html', read('index.html')]];
  for (const name of readdirSync(root).filter((f) => f.endsWith('.js'))) {
    sources.push([name, read(name)]);
  }
  let checked = 0;
  for (const [name, source] of sources) {
    for (const glyph of closeButtonsIn(source)) {
      checked += 1;
      assert.equal(glyph, '↩', `${name}: dialog close button must show ↩, found ${JSON.stringify(glyph)}`);
    }
  }
  assert.ok(checked > 100, `expected 100+ dialog close buttons, found ${checked}`);
});

test('modal close redesign: the channel-remove button is not a close button', () => {
  const source = read('nav-wdm-spectrum.js');
  assert.ok(source.includes('class="wdm-remove-btn"'), 'remove button uses .wdm-remove-btn');
  assert.ok(!source.includes('class="close-button"'), 'no .close-button left in nav-wdm-spectrum.js');
});
