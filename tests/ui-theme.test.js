import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');
const tokens = read('tokens.css');

test('theme toggle button and SVG icons exist in index.html topbar', () => {
  assert.match(index, /id="themeToggle"[^>]*class="theme-toggle"/);
  assert.match(index, /aria-label="Toggle dark\/light theme"/);
  assert.match(index, /class="theme-icon theme-icon-sun"/);
  assert.match(index, /class="theme-icon theme-icon-moon"/);
  assert.match(index, /try\{const t=localStorage\.getItem\('shahdara_theme'\)/);
});

test('styles.css supports comprehensive dark and light themes with smooth transitions', () => {
  assert.match(styles, /\.theme-toggle\s*\{/);
  // #230: the bare [data-theme="dark"] token block and the system-dark token
  // block moved from styles.css into tokens.css (single source of truth);
  // the component-level dark rules remain in styles.css below.
  assert.match(tokens, /\[data-theme="dark"\]\s*\{/);
  assert.match(tokens, /@media\s*\(prefers-color-scheme:\s*dark\)/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.theme-icon-moon\s*\{/);
  assert.match(styles, /\[data-theme="dark"\]\s*body\s*\{/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.summary-card/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.mobile-bottom-nav/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.table-scroll/);
});

test('app.js wires theme toggle, outside click on mobile more menu, and search shortcut', () => {
  assert.match(app, /function initTheme\(\)/);
  assert.match(app, /localStorage\.setItem\('shahdara_theme'/);
  assert.match(app, /document\.documentElement\.setAttribute\('data-theme'/);
  assert.match(app, /data-theme/);
  assert.match(app, /mobileMoreMenu/);
  assert.match(app, /globalCustomerSearch/);
});
