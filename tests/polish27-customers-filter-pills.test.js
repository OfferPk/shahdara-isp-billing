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
// Customers stat cards (2026-11-21, user spec) supersedes the D1/D5
// pins below: each pill carries its own soft semantic tint; the
// pressed revenue card keeps its tint and gains a 2px ring, the
// pressed count pill goes solid-800 with white text; at phone widths
// the bar still wraps but the count row scrolls as a single row.
// The D3 dot assertions stay.
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
// Customers stat cards (2026-11-21, user spec): the BAR still wraps at
// phone widths, but the COUNT ROW inside it is now a single horizontal
// scrollable row — a reversal of the Polish #27 phone decision ("wraps
// into ~3 rows … with no horizontal scroll"). The row's scrollbar is
// hidden (app precedent: .bc-mohalla-pills); pills 3-4 hide behind a
// swipe with no scroll cue — on-phone check owed, a fade/chevron cue
// is a separate follow-up if he wants it.
test('D1 wrap: a 620px media rule keeps the pill bar wrapping, while the count row inside it scrolls as one row', () => {
  const pillBars = media620Blocks(css).filter((block) => block.includes('.roster-pill-bar'));
  assert.equal(pillBars.length, 1, 'exactly one 620px media rule must carry .roster-pill-bar');
  const bar = ruleBlock(pillBars[0], '.roster-pill-bar {');
  assert.ok(bar.includes('flex-wrap: wrap'), 'wrapped bar must carry flex-wrap: wrap');
  assert.ok(bar.includes('overflow-x: visible'), 'wrapped bar must carry overflow-x: visible');
  assert.ok(!bar.includes('overflow-x: auto'), 'wrapped bar must not keep overflow-x: auto');
  const row = ruleBlock(pillBars[0], '.roster-pill-row {');
  assert.ok(row.includes('flex-wrap: nowrap'), 'count row must not wrap at phone widths');
  assert.ok(row.includes('overflow-x: auto'), 'count row must scroll horizontally at phone widths');
  assert.ok(/scrollbar-width\s*:\s*none/.test(row), 'count row must hide its scrollbar');
  assert.ok(css.includes('.roster-pill-row::-webkit-scrollbar'), 'count row must hide the webkit scrollbar');
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
  // Customers Directory Polish: the emoji field is gone entirely — the
  // unpaid pill carries no icon at all (dsIcon '') because its marker
  // is the CSS dot, and no def carries an emoji field any more.
  assert.equal(unpaid.dsIcon, '', 'unpaid dsIcon must be empty (the red dot is CSS now)');
  assert.ok(!('emoji' in unpaid), 'no def carries an emoji field any more');
});

test('D3 pin: every pill maps to a ds-icon (or a status dot), no emoji anywhere', () => {
  // Customers Directory Polish supersedes the old pin ("the other six
  // emoji stay"): all six are replaced by 16px ds-icons; unpaid and
  // paid carry no icon — their markers are the CSS dots.
  const expected = { all: 'Users', unpaid: '', arrears: 'AlertTriangle', waada: 'Handshake', paid: '', credit: 'Wallet', paused: 'Pause', kist: 'Package' };
  for (const def of ROSTER_PILL_DEFS) {
    assert.equal(def.dsIcon, expected[def.id], `${def.id} dsIcon must be ${expected[def.id] || '(none — status dot)'}`);
    assert.ok(!('emoji' in def), `${def.id} must not carry an emoji field`);
  }
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

// --- D5: selected state — per-pill pressed treatment ------------------------
// Customers stat cards (2026-11-21, user spec): the generic solid-green
// pressed rule (Polish #27 D5) is replaced by eight per-pill pressed
// rules. Revenue cards keep their tint and gain a 2px ring; count pills
// go solid-800 with white text. The old dark override (dark ink on
// dark --green) is deleted: the --roster-*-active backgrounds are
// theme-stable, so white text clears 4.5:1 in both themes, and dark
// pressed revenue cards keep their idle dark tints + ring.

test('D5 dark: no generic dark pressed override remains; per-pill pressed states clear 4.5:1 in dark', () => {
  assert.ok(
    !css.includes('[data-theme="dark"] .roster-pill[aria-pressed="true"]'),
    'the old generic dark pressed override must be gone (per-pill rules replace it)'
  );
  // The pressed count-pill backgrounds are theme-stable tokens: the
  // dark block must hold the same values as light, so white text
  // clears 4.5:1 in dark too (same ratios as light).
  const darkTokens = tokensSrc.slice(tokensSrc.indexOf('[data-theme="dark"]'));
  for (const [token, hex, ratio] of [
    ['--roster-all-active', '#065f46', 7.68],
    ['--roster-waada-active', '#6d28d9', 7.10],
    ['--roster-slate-800', '#1e293b', 14.63],
    ['--roster-kist-active', '#115e59', 7.58]
  ]) {
    assert.ok(darkTokens.includes(`${token}: ${hex}`), `dark ${token} must stay ${hex} (theme-stable pressed bg)`);
    const measured = contrastRatio('#ffffff', hex);
    assert.ok(measured >= 4.5, `white on ${hex} must clear 4.5:1 in dark (got ${measured.toFixed(2)}:1, expected ~${ratio}:1)`);
  }
  // Dark pressed revenue cards keep their idle dark tints + ring, so
  // the dark idle text on the dark tint background must clear 4.5:1.
  // Token resolutions are asserted so a token change trips the test
  // instead of silently changing the measured ratio.
  for (const [id, textToken, textHex, bgToken, bgHex] of [
    ['unpaid', '--color-pending', '#fbbf24', '--qc-amber-soft-bg', '#3a2c10'],
    ['arrears', '--qc-rose-text', '#ffb4a8', '--qc-rose-bg', '#3a1513'],
    ['paid', '--qc-mint-strong-text', '#86dcbb', '--qc-mint-bg', '#16362d'],
    ['credit', '--roster-sky-900', '#d5e2ff', '--qc-low-bg', '#182d27']
  ]) {
    assert.ok(darkTokens.includes(`${textToken}: ${textHex}`), `dark ${textToken} must stay ${textHex}`);
    assert.ok(darkTokens.includes(`${bgToken}: ${bgHex}`), `dark ${bgToken} must stay ${bgHex}`);
    const measured = contrastRatio(textHex, bgHex);
    assert.ok(measured >= 4.5, `dark pressed ${id} text ${textHex} on ${bgHex} must clear 4.5:1 (got ${measured.toFixed(2)}:1)`);
  }
  // The pressed total inherits the pill's text colour in both themes.
  const total = ruleBlock(css, '.roster-pill[aria-pressed="true"] .roster-pill-total {');
  assert.ok(total.includes('color: inherit'), 'pressed total must inherit the pill text colour');
  assert.ok(!/#/.test(total), 'pressed total rule must contain no hex literal (token-only)');
});

test('D5 pin: the light pressed treatment is per-pill — rings on revenue cards, solid-800 on count pills', () => {
  // Revenue: same tint as idle + a 2px ring in the pill's ring token.
  for (const [id, bgToken, ringToken, ringHex] of [
    ['unpaid', '--qc-amber-soft-bg', '--qc-amber-strong-border', '#f59e0b'],
    ['arrears', '--qc-rose-bg', '--qc-rose-strong-text', '#e11d48'],
    ['paid', '--qc-mint-bg', '--color-emerald', '#10b981'],
    ['credit', '--qc-low-bg', '--qc-low-border', '#0ea5e9']
  ]) {
    const rule = ruleBlock(css, `.roster-pill[data-roster-pill="${id}"][aria-pressed="true"] {`);
    assert.ok(rule.includes(`background: var(${bgToken})`), `active ${id} must keep its tint background var(${bgToken})`);
    assert.ok(rule.includes(`box-shadow: 0 0 0 2px var(${ringToken})`), `active ${id} ring must be 2px var(${ringToken})`);
    assert.ok(tokensSrc.includes(`${ringToken}: ${ringHex}`), `token ${ringToken} must stay ${ringHex}`);
  }
  // Count: solid-800 background + white text, each clearing 4.5:1.
  for (const [id, bgToken, bgHex] of [
    ['all', '--roster-all-active', '#065f46'],
    ['waada', '--roster-waada-active', '#6d28d9'],
    ['paused', '--roster-slate-800', '#1e293b'],
    ['kist', '--roster-kist-active', '#115e59']
  ]) {
    const rule = ruleBlock(css, `.roster-pill[data-roster-pill="${id}"][aria-pressed="true"] {`);
    assert.ok(rule.includes(`background: var(${bgToken})`), `active ${id} background must be var(${bgToken})`);
    assert.ok(rule.includes(`border-color: var(${bgToken})`), `active ${id} border must match its background`);
    assert.equal(/(?:^|[;\n])\s*color\s*:\s*([^;}]+)/.exec(rule)[1].trim(), 'var(--color-neutral-0)', `active ${id} text must stay white`);
    assert.ok(tokensSrc.includes(`${bgToken}: ${bgHex}`), `token ${bgToken} must stay ${bgHex}`);
    const ratio = contrastRatio('#ffffff', bgHex);
    assert.ok(ratio >= 4.5, `active ${id} white on ${bgHex} must clear 4.5:1 (got ${ratio.toFixed(2)}:1)`);
  }
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
  // Customers Directory Polish: the label is the bare i18n string now
  // — the emoji-prefixed construction is gone with the emoji field.
  assert.ok(fn.includes('const label = t(def.labelKey);'), 'label must be the bare i18n string');
  assert.ok(!fn.includes('def.emoji'), 'render must not reference any emoji field');
  const unpaid = ROSTER_PILL_DEFS.find((def) => def.id === 'unpaid');
  assert.equal(unpaid.dsIcon, '', 'unpaid carries no icon, so its aria-label is emoji-free');
});
