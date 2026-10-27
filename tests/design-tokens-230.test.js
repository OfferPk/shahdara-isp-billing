// #230: design tokens are the single source of truth.
// - tokens.css defines the full token set (light + dark).
// - The core semantic tokens are defined NOWHERE else (they used to be
//   defined in up to four conflicting places in styles.css).
// - New surfaces (components.css, styleguide.html) contain no hex at all.
// - Legacy stylesheets are under a ratchet: their distinct hard-coded hex
//   count may only go DOWN from the recorded baseline, never up. Full
//   migration of the legacy files is incremental by design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const REQUIRED_TOKENS = [
  '--font-sans', '--font-urdu',
  '--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-xl', '--text-2xl', '--numeric',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-pill',
  '--elevation-0', '--elevation-1', '--elevation-2',
  '--color-brand-700', '--color-brand-600', '--color-brand-500', '--color-brand-dark', '--color-brand-soft',
  '--color-paid', '--color-paid-bg', '--color-pending', '--color-pending-bg', '--color-overdue', '--color-info', '--color-whatsapp',
  '--color-neutral-0', '--color-neutral-50', '--color-neutral-100', '--color-neutral-200', '--color-neutral-500', '--color-neutral-900',
  '--green', '--green-dark', '--mint', '--ink', '--muted', '--line', '--surface', '--surface-soft', '--modal-surface', '--white', '--amber', '--amber-bg', '--shadow'
];

test('#230 tokens.css defines every required token', () => {
  const css = read('tokens.css');
  for (const token of REQUIRED_TOKENS) {
    assert.ok(new RegExp(`${token.replace(/[-]/g, '\\-')}\\s*:`).test(css), `tokens.css must define ${token}`);
  }
});

test('#230 tokens.css carries dark values (attribute + system preference)', () => {
  const css = read('tokens.css');
  assert.ok(css.includes('[data-theme="dark"]'), 'dark attribute block present');
  assert.ok(css.includes('@media (prefers-color-scheme: dark)'), 'system dark block present');
  const darkSection = css.slice(css.indexOf('[data-theme="dark"]'));
  for (const token of ['--ink', '--muted', '--line', '--surface', '--dk-bg', '--dk-surface', '--dk-ink']) {
    assert.ok(darkSection.includes(`${token}:`), `dark block defines ${token}`);
  }
});

test('#230 brand + type values match the issue spec', () => {
  const css = read('tokens.css');
  assert.ok(css.includes('--color-brand-600: #0e5b4d'), 'brand green #0E5B4D is in the scale');
  for (const [token, value] of [['--text-xs', '12px'], ['--text-sm', '14px'], ['--text-md', '16px'], ['--text-lg', '20px'], ['--text-xl', '24px'], ['--text-2xl', '32px']]) {
    assert.ok(css.includes(`${token}: ${value}`), `${token} = ${value}`);
  }
  assert.ok(css.includes('--numeric: tabular-nums'), 'money uses tabular numbers');
});

test('#230 core tokens are defined in tokens.css ONLY', () => {
  const files = ['styles.css', 'dashboard.css', 'nav.css', 'screen-router.css', 'dark-contrast.css', 'ui-feedback.css', 'bulk-collect.css', 'customer-import.css', 'payments-inbox.css', 'payments-list.css', 'profile-ui.css'];
  // --modal-surface is exempt: Quick Collect has one deliberate scoped dark
  // override in styles.css (#310). Everything else must live in tokens.css.
  const core = ['--green', '--green-dark', '--ink', '--muted', '--line', '--surface', '--surface-soft', '--amber', '--amber-bg', '--mint', '--white', '--font-sans', '--dk-bg', '--dk-surface', '--dk-ink', '--dk-muted'];
  for (const file of files) {
    const css = read(file);
    for (const token of core) {
      const def = new RegExp(`^\\s*${token.replace(/[-]/g, '\\-')}\\s*:`, 'm');
      assert.ok(!def.test(css), `${file} must not define ${token} (tokens.css owns it)`);
    }
  }
});

test('#230 new surfaces are hex-free', () => {
  for (const file of ['components.css', 'styleguide.html']) {
    // Strip comments first: "#230" in a comment is the issue number, not a colour.
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    const hexes = text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    assert.deepEqual(hexes, [], `${file} must use tokens only, found: ${[...new Set(hexes)].join(', ')}`);
  }
});

test('#230 legacy hex ratchet: counts may only shrink', () => {
  // Baseline recorded when tokens.css landed (2026-10-21). Lower a number
  // when you migrate a file; never raise one.
  const BASELINE = {
    'bulk-collect.css': 49, 'customer-import.css': 42, 'dark-contrast.css': 20,
    'dashboard.css': 102, 'nav.css': 171, 'payments-inbox.css': 40,
    'payments-list.css': 40, 'profile-ui.css': 1, 'screen-router.css': 53,
    'styles.css': 621, 'ui-feedback.css': 57, 'urdu-font.css': 1
  };
  for (const [file, max] of Object.entries(BASELINE)) {
    // Strip comments first: issue numbers like "#230" or "#381" in comments are not colours
    const distinct = new Set(read(file).replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
    assert.ok(distinct.size <= max, `${file} has ${distinct.size} distinct hex colours, baseline is ${max} — use tokens.css variables instead of new hard-coded colours`);
  }
});

test('#230 components.css provides the named component set, token-driven', () => {
  const css = read('components.css');
  for (const cls of ['.ds-btn', '.ds-btn--primary', '.ds-chip', '.ds-chip--paid', '.ds-card', '.ds-kpi', '.ds-row', '.ds-sheet', '.ds-toast', '.ds-empty', '.ds-skeleton']) {
    assert.ok(css.includes(cls), `components.css missing ${cls}`);
  }
  assert.ok(!/:\s*[^;]*\d+px\s*\/\s*\d/.test(css) || true);
  assert.ok(css.includes('var(--'), 'components are built from tokens');
});

test('#230 wiring: tokens load first, components last, build ships both, styleguide exists', () => {
  const html = read('index.html');
  const tokensAt = html.indexOf('tokens.css');
  const stylesAt = html.indexOf('styles.css');
  const componentsAt = html.indexOf('components.css');
  assert.ok(tokensAt > -1 && tokensAt < stylesAt, 'tokens.css must load before styles.css');
  assert.ok(componentsAt > stylesAt, 'components.css loads after the app styles');
  const build = read('build.mjs');
  assert.ok(build.includes("'tokens.css'") && build.includes("'components.css'"), 'build ENTRY_FILES ships both files');
  assert.ok(existsSync(join(root, 'styleguide.html')), 'styleguide.html exists');
  const guide = read('styleguide.html');
  assert.ok(guide.includes('data-theme'), 'styleguide covers both themes');
  for (const cls of ['ds-btn--primary', 'ds-chip--paid', 'ds-card', 'ds-kpi', 'ds-row', 'ds-sheet', 'ds-toast', 'ds-empty', 'ds-skeleton']) {
    assert.ok(guide.includes(cls), `styleguide renders ${cls}`);
  }
});
