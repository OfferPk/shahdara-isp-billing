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
//
// DS-0 (2026-11-10) updates the pins below, intent preserved:
// - the bar is 64px tall (was 58px) and its backgrounds are the DS-0
//   translucent surfaces (light rgba(255,255,255,0.92), dark
//   rgba(21,39,34,0.92) compositing to #152726 over the dark page);
//   the light/dark inactive ratios are still >= 7:1 (14.36:1 / 13.69:1).
// - badge colours are the same values through --ds-* tokens (light
//   badge var(--ds-brand) #0f5338, 9.07:1; alert var(--ds-danger-strong)
//   #dc2626, 4.83:1; dark badge var(--color-emerald) #10b981 with text
//   var(--dk-bg) #14241f, 6.36:1; dark alert var(--ds-danger-strong)
//   #f87171 with text var(--dk-bg), 5.83:1) — all still >= 4.5:1.
// - the button rule gains the DS-0 flex-column icon layout; the 11px
//   labels, 44px targets and 5 columns are pinned as before.
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
  // DS-0: the badge colours below resolve through the --ds-* tokens
  // (asserted against tokens.css so a token change trips the test).
  if (value === 'var(--ds-brand)') {
    assert.ok(tokensSrc.includes('--ds-brand: #0f5338'), 'light --ds-brand must stay #0f5338');
    assert.ok(tokensSrc.includes('--ds-brand: #29b88f'), 'dark --ds-brand must stay #29b88f');
    return theme === 'dark' ? '#29b88f' : '#0f5338';
  }
  if (value === 'var(--ds-danger-strong)') {
    assert.ok(tokensSrc.includes('--ds-danger-strong: #dc2626'), 'light --ds-danger-strong must stay #dc2626');
    assert.ok(tokensSrc.includes('--ds-danger-strong: #f87171'), 'dark --ds-danger-strong must stay #f87171');
    return theme === 'dark' ? '#f87171' : '#dc2626';
  }
  if (value === 'var(--color-emerald)') {
    assert.ok(tokensSrc.includes('--color-emerald: #10b981'), 'token --color-emerald must stay #10b981');
    return '#10b981';
  }
  if (value === 'var(--dk-bg)') {
    assert.ok(tokensSrc.includes('--dk-bg: #14241f'), 'token --dk-bg must stay #14241f');
    return '#14241f';
  }
  if (value === 'var(--white)') {
    assert.ok(tokensSrc.includes('--white: var(--color-neutral-0)'), '--white must stay the neutral-0 alias');
    assert.ok(tokensSrc.includes('--color-neutral-0: #ffffff'), 'token --color-neutral-0 must stay #ffffff');
    return '#ffffff';
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  assert.fail(`cannot resolve colour value ${value}`);
  return '';
}

// Bar backgrounds: light rgba(255,255,255,0.92) over the white page
// reads as white; dark rgba(21,39,34,0.92) over the dark page (#14241f)
// reads as #152726.
const LIGHT_BAR_BG = '#ffffff';
const DARK_BAR_BG = '#152726';

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
  // DS-0: same values, through the --ds-* tokens (light badge was
  // var(--green, #0e5b4d); #0f5338 is the DS-0 brand token; the white
  // text is var(--white) now, not a #ffffff literal).
  assert.equal(backgroundValue(badge), 'var(--ds-brand)', 'light badge background must stay the DS-0 brand token');
  assert.equal(colorValue(badge), 'var(--white)', 'light badge text must stay white');
  const lightRatio = contrastRatio(resolveToHex('var(--ds-brand)', 'light'), resolveToHex('var(--white)', 'light'));
  assert.ok(lightRatio >= 4.5, `light badge must clear 4.5:1 (got ${lightRatio.toFixed(2)}:1)`);
  const alert = ruleBlock(navSrc, '.bottom-nav-badge.badge-alert {');
  assert.equal(backgroundValue(alert), 'var(--ds-danger-strong)', 'light alert badge background must stay the DS-0 danger token');
  assert.equal(colorValue(alert), 'var(--white)', 'light alert badge text must stay white');
  const alertRatio = contrastRatio(resolveToHex('var(--white)', 'light'), resolveToHex('var(--ds-danger-strong)', 'light'));
  assert.ok(alertRatio >= 4.5, `light alert badge must clear 4.5:1 (got ${alertRatio.toFixed(2)}:1)`);
  const darkBadge = ruleBlock(navSrc, '[data-theme="dark"] .bottom-nav-badge {');
  assert.equal(backgroundValue(darkBadge), 'var(--color-emerald)', 'dark badge background must stay the emerald token');
  assert.equal(colorValue(darkBadge), 'var(--dk-bg)', 'dark badge text must stay the dark page token');
  const darkRatio = contrastRatio(resolveToHex('var(--dk-bg)', 'dark'), resolveToHex('var(--color-emerald)', 'dark'));
  assert.ok(darkRatio >= 4.5, `dark badge must clear 4.5:1 (got ${darkRatio.toFixed(2)}:1)`);
  const darkAlert = ruleBlock(navSrc, '[data-theme="dark"] .bottom-nav-badge.badge-alert {');
  assert.equal(backgroundValue(darkAlert), 'var(--ds-danger-strong)', 'dark alert badge background must stay the DS-0 danger token');
  assert.equal(colorValue(darkAlert), 'var(--dk-bg)', 'dark alert badge text must stay the dark page token');
  const darkAlertRatio = contrastRatio(resolveToHex('var(--dk-bg)', 'dark'), resolveToHex('var(--ds-danger-strong)', 'dark'));
  assert.ok(darkAlertRatio >= 4.5, `dark alert badge must clear 4.5:1 (got ${darkAlertRatio.toFixed(2)}:1)`);
  // DS-0: badges are 18px pills docked to the icon's top-right corner.
  assert.ok(badge.includes('height: 18px'), 'badge height must be 18px');
  assert.ok(badge.includes('min-width: 18px'), 'badge min-width must be 18px');
  assert.ok(badge.includes('top: 2px'), 'badge must dock to the icon top');
  assert.ok(badge.includes('right: calc(50% - 26px)'), 'badge must dock to the icon right');
});

// --- Layout untouched ------------------------------------------------------

test('layout untouched: 11px bold labels, 44px tap targets, 64px bar, 5 columns', () => {
  const button = ruleBlock(stylesSrc, '.mobile-bottom-nav button{');
  assert.ok(button.includes("font:700 11px 'DM Sans'"), 'button font must stay 700 11px DM Sans');
  assert.ok(button.includes('min-height:44px'), 'button tap target must stay 44px');
  assert.ok(button.includes('padding:4px 2px'), 'button padding must stay 4px 2px');
  assert.ok(button.includes('border-radius:9px'), 'button radius must stay 9px');
  assert.ok(button.includes('background:transparent'), 'button background must stay transparent');
  // DS-0: icon above the label — flex column, icon centred over the text.
  assert.ok(button.includes('display:flex'), 'button must lay the icon over the label');
  assert.ok(button.includes('flex-direction:column'), 'button must stack icon above label');
  assert.ok(button.includes('align-items:center'), 'button must centre the icon and label');
  const bar = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  assert.ok(bar.includes('min-height:64px'), 'DS-0: bar min-height must be 64px (was 58px)');
  assert.ok(bar.includes('grid-template-columns:repeat(5,minmax(0,1fr))'), 'bar must stay a 5-column grid');
  assert.ok(bar.includes('gap:2px'), 'bar gap must stay 2px');
});

test('bar untouched: light and dark backgrounds and borders are as before', () => {
  const bar = ruleBlock(stylesSrc, '.mobile-bottom-nav{');
  // DS-0: the bar is the translucent sticky surface now (was .98 opaque).
  assert.ok(bar.includes('background:rgba(255,255,255,0.92)'), 'light bar background must be rgba(255,255,255,0.92)');
  assert.ok(bar.includes('border-top:1px solid var(--ds-line)'), 'light bar top border must be the --ds-line token');
  const darkBar = ruleBlock(stylesSrc, '[data-theme="dark"] .mobile-bottom-nav{');
  assert.ok(darkBar.includes('background:rgba(21,39,34,0.92)!important'), 'dark bar background must be rgba(21,39,34,0.92)!important (the rule that renders)');
  assert.ok(darkBar.includes('border-top-color:var(--ds-line)!important'), 'dark bar border must be the --ds-line token');
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
