// Polish 25 — Bottom navigation labels readable: inactive tabs stop
// looking faint. Two one-word edits in styles.css — the inactive button
// colour in both themes becomes var(--ink) (light #172e29, 14.39:1;
// dark #e8f3ee, 14.20:1) instead of the hardcoded one-off hexes
// (#536a61 light, 5.83:1; #8ca39a dark, ~6.01:1).
//
// This is NOT a WCAG failure — both old ratios pass AA 4.5:1. The
// complaint is real anyway: 11px glyphs, simultaneous contrast against
// the pill-backed active tab (7.01:1), and a nearly invisible top
// border. The fix is colour only: layout, font size, tap targets,
// active rules and badges are all unchanged and pinned below.
//
// Pattern-fake data only: no customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const navSrc = read('nav.css');
const tokensSrc = read('tokens.css');

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function colorValue(rule) {
  // The value runs to the next ';' or to the end of the (minified)
  // rule — the last declaration in a minified rule has no ';'.
  const m = /color\s*:\s*([^;}]+)/.exec(rule);
  assert.ok(m, 'no color declaration in rule');
  return m[1].trim();
}

function backgroundValue(rule) {
  const m = /background\s*:\s*([^;}]+)/.exec(rule);
  assert.ok(m, 'no background declaration in rule');
  return m[1].trim();
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  assert.ok(m, `not a 6-digit hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(rgb) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb;
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(fgHex, bgHex) {
  const l1 = luminance(hexToRgb(fgHex));
  const l2 = luminance(hexToRgb(bgHex));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Token resolutions, asserted against tokens.css so a token change
// trips the test instead of silently changing the measured ratio.
function lightInk() {
  assert.ok(tokensSrc.includes('--color-neutral-900: #172e29'), 'token --color-neutral-900 must stay #172e29');
  assert.ok(tokensSrc.includes('--ink: var(--color-neutral-900)'), 'light --ink must stay the neutral-900 alias');
  return '#172e29';
}

function darkInk() {
  assert.ok(tokensSrc.includes('--ink: #e8f3ee'), 'dark --ink must stay #e8f3ee');
  return '#e8f3ee';
}

function lightGreen() {
  assert.ok(tokensSrc.includes('--color-brand-500: #145b4b'), 'token --color-brand-500 must stay #145b4b in light');
  assert.ok(tokensSrc.includes('--green: var(--color-brand-500)'), 'light --green must stay the brand-500 alias');
  return '#145b4b';
}

function resolveToHex(value, theme) {
  if (value === 'var(--ink)') return theme === 'dark' ? darkInk() : lightInk();
  if (value === 'var(--green)') return theme === 'dark' ? '#29b88f' : lightGreen();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  assert.fail(`cannot resolve colour value ${value}`);
  return '';
}

// Bar backgrounds: light rgba(255,255,255,.98) over the white page
// reads as white; dark rgba(18,30,27,.98) reads as #121e1b.
const LIGHT_BAR_BG = '#ffffff';
const DARK_BAR_BG = '#121e1b';

// --- Req 1: inactive labels readable in both themes ---------------------

test('inactive light: button colour is var(--ink) and clears 7:1 on the white bar', () => {
  const button = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  const value = colorValue(button);
  const ratio = contrastRatio(resolveToHex(value, 'light'), LIGHT_BAR_BG);
  assert.ok(ratio >= 7, `light inactive label must clear 7:1 (got ${ratio.toFixed(2)}:1 for ${value} on white)`);
  assert.equal(value, 'var(--ink)', 'light inactive colour must be the theme-aware --ink token, not a literal hex');
});

test('inactive dark: button colour is var(--ink) and clears 7:1 on the dark bar', () => {
  const button = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav button {');
  const value = colorValue(button);
  const ratio = contrastRatio(resolveToHex(value, 'dark'), DARK_BAR_BG);
  assert.ok(ratio >= 7, `dark inactive label must clear 7:1 (got ${ratio.toFixed(2)}:1 for ${value} on #121e1b)`);
  assert.equal(value, 'var(--ink)', 'dark inactive colour must be the theme-aware --ink token, not a literal hex');
});

test('inactive: the rejected --muted token is never used (it would be worse than today)', () => {
  const light = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  const dark = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav button {');
  assert.ok(!light.includes('--muted'), 'light inactive must not use --muted (#586e65, 5.48:1 — worse than the old #536a61)');
  assert.ok(!dark.includes('--muted'), 'dark inactive must not use --muted');
});

// --- Req 2: active stays distinct and unchanged --------------------------

test('active light: green on the mint pill stays >= 6.5:1 and the pill is unchanged', () => {
  const active = ruleBlock(stylesSrc, '.mobile-bottom-nav button[aria-current=page]{');
  assert.ok(active.includes('background:#e6f3ee'), 'light active pill background must stay #e6f3ee');
  const value = colorValue(active);
  assert.equal(value, 'var(--green)', 'light active text must stay var(--green)');
  const ratio = contrastRatio(resolveToHex(value, 'light'), '#e6f3ee');
  assert.ok(ratio >= 6.5, `light active label must stay >= 6.5:1 (got ${ratio.toFixed(2)}:1)`);
});

test('active dark: #34d399 on #19382e stays >= 6.5:1 and the pill is unchanged', () => {
  const active = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav button[aria-current=page] {');
  assert.ok(active.includes('background: #19382e'), 'dark active pill background must stay #19382e');
  const value = colorValue(active);
  assert.equal(value, '#34d399', 'dark active text must stay #34d399');
  const ratio = contrastRatio(value, '#19382e');
  assert.ok(ratio >= 6.5, `dark active label must stay >= 6.5:1 (got ${ratio.toFixed(2)}:1)`);
});

// --- Req 3: badges unchanged ----------------------------------------------

test('badges: all four pairs clear 4.5:1 in both themes, as-is', () => {
  const badge = ruleBlock(navSrc, '.bottom-nav-badge {');
  assert.equal(backgroundValue(badge), 'var(--green, #0e5b4d)', 'light badge background must stay var(--green, #0e5b4d)');
  assert.equal(colorValue(badge), '#ffffff', 'light badge text must stay white');
  const lightRatio = contrastRatio(resolveToHex('var(--green)', 'light'), '#ffffff');
  assert.ok(lightRatio >= 4.5, `light badge must clear 4.5:1 (got ${lightRatio.toFixed(2)}:1)`);
  const alert = ruleBlock(navSrc, '.bottom-nav-badge.badge-alert {');
  assert.equal(backgroundValue(alert), '#dc2626', 'light alert badge background must stay #dc2626');
  assert.equal(colorValue(alert), '#ffffff', 'light alert badge text must stay white');
  const alertRatio = contrastRatio('#ffffff', '#dc2626');
  assert.ok(alertRatio >= 4.5, `light alert badge must clear 4.5:1 (got ${alertRatio.toFixed(2)}:1)`);
  const darkBadge = ruleBlock(navSrc, '[data-theme="dark"] .bottom-nav-badge {');
  assert.equal(backgroundValue(darkBadge), '#10b981', 'dark badge background must stay #10b981');
  assert.equal(colorValue(darkBadge), '#0b1814', 'dark badge text must stay #0b1814');
  const darkRatio = contrastRatio('#0b1814', '#10b981');
  assert.ok(darkRatio >= 4.5, `dark badge must clear 4.5:1 (got ${darkRatio.toFixed(2)}:1)`);
  const darkAlert = ruleBlock(navSrc, '[data-theme="dark"] .bottom-nav-badge.badge-alert {');
  assert.equal(backgroundValue(darkAlert), '#f87171', 'dark alert badge background must stay #f87171');
  assert.equal(colorValue(darkAlert), '#1a0505', 'dark alert badge text must stay #1a0505');
  const darkAlertRatio = contrastRatio('#1a0505', '#f87171');
  assert.ok(darkAlertRatio >= 4.5, `dark alert badge must clear 4.5:1 (got ${darkAlertRatio.toFixed(2)}:1)`);
});

// --- Layout untouched ------------------------------------------------------

test('layout untouched: 11px bold labels, 44px tap targets, 58px bar, 5 columns', () => {
  const button = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  assert.ok(button.includes("font:700 11px 'DM Sans'"), 'button font must stay 700 11px DM Sans');
  assert.ok(button.includes('min-height:44px'), 'button tap target must stay 44px');
  assert.ok(button.includes('padding:4px 2px'), 'button padding must stay 4px 2px');
  assert.ok(button.includes('border-radius:9px'), 'button radius must stay 9px');
  assert.ok(button.includes('background:transparent'), 'button background must stay transparent');
  const bar = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  assert.ok(bar.includes('min-height:58px'), 'bar min-height must stay 58px');
  assert.ok(bar.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'bar must stay a 5-column grid');
  assert.ok(bar.includes('gap:2px'), 'bar gap must stay 2px');
});

test('bar untouched: light and dark backgrounds and borders are as before', () => {
  const bar = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  assert.ok(bar.includes('background:rgba(255,255,255,.98)'), 'light bar background must stay rgba(255,255,255,.98)');
  assert.ok(bar.includes('border-top:1px solid var(--line,#dfe8e3)'), 'light bar top border must stay the --line token');
  const darkBar = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav{');
  assert.ok(darkBar.includes('background:rgba(18,30,27,.98)!important'), 'dark bar background must stay rgba(18,30,27,.98)!important (the rule that renders)');
  assert.ok(darkBar.includes('border-top-color:#274036!important'), 'dark bar border must stay #274036!important');
});

// --- No new hex in the touched rules ----------------------------------------

test('no new hex: the two touched colour declarations use var(--ink) only', () => {
  const light = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  const dark = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav button {');
  assert.ok(!/#/.test(colorValue(light)), 'light inactive colour declaration must contain no hex literal');
  assert.ok(!/#/.test(colorValue(dark)), 'dark inactive colour declaration must contain no hex literal');
  // Scoped to the nav button rules: #536a61 still legitimately lives in
  // two unrelated rules (archived-customers summary, archive badge), so
  // this must NOT be a whole-sheet grep.
  assert.ok(!light.includes('#536a61'), 'the old light nav hex #536a61 must be gone from the button rule');
  assert.ok(!dark.includes('#8ca39a'), 'the old dark nav hex #8ca39a must be gone from the button rule');
});
