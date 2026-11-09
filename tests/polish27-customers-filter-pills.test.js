// Polish #27 — Customers filter pills: wrap, full figures, one visual
// language. The pill bar was a horizontal scroller by design, so at
// 360 px the Unpaid pill's PKR total clipped at the screen edge and six
// of the eight pills were invisible with no scroll cue; the red dot was
// the 🔴 emoji, and the dark-theme selected pill failed contrast
// (white on dark --green, 2.52:1).
//
// Recommended defaults implemented (no design review, user instruction
// 2026-11-09): the bar wraps at <= 620 px (desktop keeps the scrolling
// row); the full PKR figure stays; the unpaid signal is a designed 8 px
// CSS dot; labels stay byte-identical; the selected pill keeps its
// solid-green treatment with dark-theme text fixed to dark ink; each
// pill carries its own 44 px tap-target guarantee.
//
// Stylesheet-value approach (polish #17/#21/#25 pattern): read the
// CSS/JS as text and assert the values; no browser needed.
//
// Fixture figures only (45 unpaid, PKR 80,500 are the design's example
// figures, never the screenshot's unknowable trailing digits). No
// customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROSTER_PILL_DEFS } from '../roster-quick-filters.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const css = read('components.css');
const appSrc = read('app.js');
const html = read('index.html');
const tokensSrc = read('tokens.css');

function ruleBlock(source, selectorWithBrace) {
  const start = source.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

// Brace-balanced extraction of every `@media (max-width: 620px)` block.
function media620Blocks(source) {
  const blocks = [];
  const marker = '@media (max-width: 620px)';
  let from = 0;
  for (;;) {
    const start = source.indexOf(marker, from);
    if (start < 0) return blocks;
    let depth = 0;
    let i = source.indexOf('{', start);
    const open = i;
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    assert.ok(i < source.length, 'unterminated 620px media block');
    blocks.push(source.slice(open + 1, i));
    from = i + 1;
  }
}

function renderRosterPillBarFn(source) {
  const start = source.indexOf('function renderRosterPillBar(summary)');
  assert.ok(start >= 0, 'renderRosterPillBar missing from app.js');
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end === -1 ? source.length : end);
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

// --- D1: wrap, don't scroll (<= 620 px) ------------------------------------

test('D1 wrap: a 620px media rule makes the pill bar wrap with no horizontal scroll', () => {
  const pillBars = media620Blocks(css).filter((block) => block.includes('.roster-pill-bar'));
  assert.equal(pillBars.length, 1, 'exactly one 620px media rule must carry .roster-pill-bar');
  const bar = ruleBlock(pillBars[0], '.roster-pill-bar {');
  assert.ok(bar.includes('flex-wrap: wrap'), 'wrapped bar must carry flex-wrap: wrap');
  assert.ok(bar.includes('overflow-x: visible'), 'wrapped bar must carry overflow-x: visible');
  assert.ok(!bar.includes('overflow-x: auto'), 'wrapped bar must not keep overflow-x: auto');
});

test('D1 pin: the base bar rule still scrolls on wide screens (desktop unchanged)', () => {
  const bar = ruleBlock(css, '.roster-pill-bar {');
  assert.ok(bar.includes('overflow-x: auto'), 'base bar rule must keep overflow-x: auto for wide screens');
  assert.ok(!bar.includes('flex-wrap'), 'base bar rule must not wrap (wrap is the 620px rule only)');
  assert.ok(bar.includes('gap: var(--space-2)'), 'bar gap must stay var(--space-2)');
  assert.ok(bar.includes('padding: var(--space-2) 0'), 'bar padding must stay var(--space-2) 0');
});

// --- D6: own 44 px tap-target guarantee -------------------------------------

test('D6 tap target: the pill carries its own 44px min-height', () => {
  const pill = ruleBlock(css, '.roster-pill {');
  const m = /min-height\s*:\s*([^;}]+)/.exec(pill);
  assert.ok(m, 'no min-height declaration in .roster-pill');
  assert.equal(m[1].trim(), '44px', 'pill min-height must be 44px, not the old 38px');
});

// --- D3: the red dot becomes a CSS dot (unpaid only) ------------------------

test('D3 def: the unpaid pill carries no emoji in its definition', () => {
  const unpaid = ROSTER_PILL_DEFS.find((def) => def.id === 'unpaid');
  assert.ok(unpaid, 'unpaid def missing');
  assert.equal(unpaid.emoji, '', 'unpaid emoji must be empty (the red dot is CSS now)');
});

test('D3 pin: the other six emoji stay (only the unpaid dot is designed)', () => {
  const expected = { arrears: '⚠️', waada: '🤝', paid: '🟢', credit: '💎', paused: '⏸️', kist: '📦' };
  for (const def of ROSTER_PILL_DEFS) {
    if (def.id in expected) assert.equal(def.emoji, expected[def.id], `${def.id} emoji must stay`);
  }
  assert.equal(ROSTER_PILL_DEFS.find((def) => def.id === 'all').emoji, '', 'all keeps no emoji');
});

test('D3 render: the unpaid button emits a CSS dot span as its first child', () => {
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes('<span class="roster-pill-dot" aria-hidden="true"></span>'), 'render must emit the dot span');
  assert.ok(fn.includes("def.id === 'unpaid'"), 'the dot must be gated on the unpaid pill only');
  assert.ok(
    fn.indexOf('roster-pill-dot') < fn.indexOf('roster-pill-label'),
    'the dot span must come before the label span (first child of the button)'
  );
});

test('D3 style: .roster-pill-dot is a designed 8px dot on the danger token, no hex', () => {
  const dot = ruleBlock(css, '.roster-pill-dot {');
  assert.ok(dot.includes('width: 8px'), 'dot width must be 8px');
  assert.ok(dot.includes('height: 8px'), 'dot height must be 8px');
  assert.ok(dot.includes('border-radius: 50%'), 'dot must be round');
  assert.ok(dot.includes('background: var(--color-danger)'), 'dot background must be the var(--color-danger) token');
  assert.ok(dot.includes('flex: 0 0 auto'), 'dot must not shrink');
  assert.ok(!/#/.test(dot), 'dot rule must contain no hex literal (token-only)');
});

// --- D2: the full figure stays ----------------------------------------------

test('D2 full figure: the render still spells the whole PKR total, untruncated', () => {
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes('formatAmount(pill.totalCents / 100)'), 'money pills must still render formatAmount(totalCents / 100)');
  // Fragment-built so the banned literals never appear in this file.
  assert.ok(!fn.includes('sli' + 'ce('), 'the render must not slice the total');
  assert.ok(!fn.includes('subs' + 'tring('), 'the render must not substring the total');
  assert.ok(!fn.includes('ellipsis'), 'the render must not ellipsize the total');
});

// --- D5: selected state — dark-theme text fix --------------------------------

test('D5 dark: the pressed pill (and its total) reads in dark ink, clearing 4.5:1', () => {
  assert.ok(
    css.includes('[data-theme="dark"] .roster-pill[aria-pressed="true"] .roster-pill-total'),
    'the dark override must cover the pressed total span too (the :2991 rule sets it white)'
  );
  const dark = ruleBlock(css, '[data-theme="dark"] .roster-pill[aria-pressed="true"],');
  const m = /color\s*:\s*([^;}]+)/.exec(dark);
  assert.ok(m, 'no color declaration in the dark pressed rule');
  assert.equal(m[1].trim(), 'var(--color-neutral-900)', 'dark pressed text must be var(--color-neutral-900)');
  assert.ok(!/#/.test(dark), 'dark pressed rule must contain no hex literal (token-only)');
  // Token resolutions, asserted against tokens.css so a token change
  // trips the test instead of silently changing the measured ratio.
  assert.ok(tokensSrc.includes('--color-neutral-900: #172e29'), 'token --color-neutral-900 must stay #172e29');
  const darkTokens = tokensSrc.slice(tokensSrc.indexOf('[data-theme="dark"]'));
  assert.ok(darkTokens.includes('--color-brand-500: #29b88f'), 'dark --green (via --color-brand-500) must stay #29b88f');
  const ratio = contrastRatio('#172e29', '#29b88f');
  assert.ok(ratio >= 4.5, `dark pressed pill must clear 4.5:1 (got ${ratio.toFixed(2)}:1 for #172e29 on #29b88f)`);
});

test('D5 pin: the light pressed treatment is unchanged (solid green, white text)', () => {
  const pressed = ruleBlock(css, '.roster-pill[aria-pressed="true"] {');
  assert.ok(pressed.includes('background: var(--green)'), 'light pressed background must stay var(--green)');
  assert.ok(pressed.includes('border-color: var(--green-dark)'), 'light pressed border must stay var(--green-dark)');
  // `color:` must be its own declaration — the plain /color:/ pattern
  // also matches inside `border-color:` (which precedes it here).
  assert.equal(/(?:^|[;\n])\s*color\s*:\s*([^;}]+)/.exec(pressed)[1].trim(), 'var(--color-neutral-0)', 'light pressed text must stay white');
  assert.ok(tokensSrc.includes('--color-brand-500: #145b4b'), 'light --green (via --color-brand-500) must stay #145b4b');
  const ratio = contrastRatio('#ffffff', '#145b4b');
  assert.ok(ratio >= 4.5, `light pressed pill must clear 4.5:1 (got ${ratio.toFixed(2)}:1 for white on #145b4b)`);
});

// --- D4: labels byte-identical ------------------------------------------------

test('D4 labels: All Active / Unpaid This Month stay byte-identical in EN and UR', () => {
  assert.equal(TRANSLATIONS.en.cust_pill_all, 'All Active');
  assert.equal(TRANSLATIONS.ur.cust_pill_all, 'تمام فعال');
  assert.equal(TRANSLATIONS.en.cust_pill_unpaid, 'Unpaid This Month');
  assert.equal(TRANSLATIONS.ur.cust_pill_unpaid, 'اس مہینے ادا نہیں');
});

// --- Behaviour and placement pins ----------------------------------------------

test('pins: the three-span pill structure and the tap wiring are unchanged', () => {
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes('roster-pill-label'), 'label span must stay');
  assert.ok(fn.includes('roster-pill-count'), 'count span must stay');
  assert.ok(fn.includes('roster-pill-total'), 'total span must stay');
  assert.ok(fn.includes("customerRosterPill = normalizeRosterPill(button.dataset.rosterPill)"), 'tap must still set the pill');
  assert.ok(fn.includes('customerCurrentPage = 1'), 'tap must still reset to page 1');
  assert.ok(fn.includes('renderCustomers()'), 'tap must still re-render the roster');
});

test('pins: the bar stays at the top — below the new-customers panel, above the list', () => {
  assert.ok(html.includes('id="rosterPillBar"'), 'pill bar mount must exist');
  assert.ok(html.indexOf('id="rosterPillBar"') > html.indexOf('id="newCustomersPanel"'), 'bar must stay below the new-customers panel');
  assert.ok(html.indexOf('id="rosterPillBar"') < html.indexOf('id="customerList"'), 'bar must stay above the customer list');
});

test('pins: the unpaid aria-label carries the full figure with no emoji', () => {
  const fn = renderRosterPillBarFn(appSrc);
  // The label is built as `emoji + t(labelKey)` only when the def
  // carries an emoji — with the unpaid emoji empty, its aria-label
  // (label + count + total) can carry no emoji.
  assert.ok(fn.includes("const label = `${def.emoji ? `${def.emoji} ` : ''}${t(def.labelKey)}`"), 'label must stay emoji-prefixed only when the def has one');
  const unpaid = ROSTER_PILL_DEFS.find((def) => def.id === 'unpaid');
  assert.equal(unpaid.emoji, '', 'unpaid emoji empty, so its aria-label is emoji-free');
});
