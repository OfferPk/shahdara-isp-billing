// Issue 355: the top-bar fast-search trigger had no base style and kept
// the browser-default light-grey box, glaring in dark mode. It must
// carry the same chrome as the neighbouring top-bar icon buttons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nav = readFileSync(new URL('../nav.css', import.meta.url), 'utf8');

test('355: .mobile-search-trigger has a base rule with themed background/border', () => {
  const base = nav.match(/\.mobile-search-trigger \{[^}]*\}/s);
  assert.ok(base, 'base rule exists');
  assert.match(base[0], /background:\s*var\(--surface/);
  assert.match(base[0], /border:\s*1px solid var\(--line/);
  assert.match(base[0], /border-radius:\s*8px/);
});

test('355: dark theme gives the trigger the same dark chrome as its neighbours', () => {
  const dark = nav.match(/\[data-theme="dark"\] \.mobile-search-trigger \{[^}]*\}/s);
  assert.ok(dark, 'dark rule exists');
  // #14241f = rgb(20, 36, 31), the dark top-bar button background.
  assert.match(dark[0], /background:\s*#14241f/);
  assert.match(dark[0], /border-color:\s*#253d35/);
});
