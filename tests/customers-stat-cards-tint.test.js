// Customers stat cards — billing summary cards + status filter pills
// get soft semantic tints, separated count badges, and a single
// scrollable count row on the Customers tab (user spec 2026-11-21).
//
// Adapted from the prep repro (which scored 7/16 on the base).
// C tests assert the FIXED state. S tests are stability (PASS on base
// AND with the fix). B tests are behaviour (PASS on base AND with the
// fix).
// This file is NOT a pinning file: it carries no parity total.
//
// Harness: the stylesheet-value approach (Polish #17/#21/#25/#27
// pattern) — read the CSS/JS/i18n as text and assert the values; no
// browser, no DOM dispatch, no mock window needed. Token values are
// resolved through tokens.css so the fix may use existing tokens OR
// new --roster-* tokens: each tint slot carries an allow-list of the
// spec hex and the documented nearest-token substitute (see the
// prep report — substitutions are only those that keep contrast
// >= 4.5:1 or are non-text slots like borders and rings).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] || '.';
const read = (name) => readFileSync(join(root, name), 'utf8');
const css = read('components.css');
const appSrc = read('app.js');
const tokensSrc = read('tokens.css');
const html = read('index.html');
const { TRANSLATIONS } = await import(pathToFileURL(join(root, 'nav-language.js')).href);
const { ROSTER_PILL_DEFS } = await import(pathToFileURL(join(root, 'roster-quick-filters.js')).href);

function ruleBlock(source, selectorWithBrace) {
  const start = source.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.ok(i < source.length, `unterminated rule ${selectorWithBrace}`);
  return source.slice(open + 1, i);
}

// Brace-balanced extraction of every `@media (max-width: 620px)` block.
function media620Blocks(source) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = source.indexOf('@media (max-width: 620px)', from);
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

// First brace-balanced rule whose selector mentions a pill id, with an
// optional [aria-pressed="true"] qualifier.
function pillRule(id, pressed) {
  const needle = pressed
    ? `[data-roster-pill="${id}"][aria-pressed="true"]`
    : `[data-roster-pill="${id}"]`;
  const start = css.indexOf(needle);
  assert.ok(start >= 0, `missing ${pressed ? 'pressed' : 'idle'} rule for pill ${id}`);
  const open = css.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.ok(i < css.length, `unterminated pill rule for ${id}`);
  return css.slice(open + 1, i);
}

// Resolve a var(--name) reference to its light :root token value.
function resolveVar(value) {
  const m = /var\(\s*(--[a-zA-Z0-9-]+)/.exec(value);
  if (!m) return value.trim().toLowerCase();
  const light = tokensSrc.slice(0, tokensSrc.indexOf('[data-theme="dark"]'));
  const tm = new RegExp(`${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+);`).exec(light);
  assert.ok(tm, `token ${m[1]} has no light value in tokens.css`);
  const resolved = tm[1].trim();
  const nested = /var\(\s*(--[a-zA-Z0-9-]+)/.exec(resolved);
  return nested ? resolveVar(resolved) : resolved.toLowerCase();
}

function declValue(block, prop) {
  const m = new RegExp(`(?:^|[;\\n])\\s*${prop}\\s*:\\s*([^;}]+)`).exec(block);
  assert.ok(m, `no ${prop} declaration in rule`);
  return m[1].trim();
}

function assertTint(block, slot, allowedHexes) {
  const raw = declValue(block, slot.prop);
  const resolved = resolveVar(raw);
  assert.ok(
    allowedHexes.includes(resolved),
    `${slot.prop} resolves to ${resolved}, expected one of ${allowedHexes.join(', ')}`
  );
}

// Spec hex first, documented nearest-token substitute second (contrast
// >= 4.5:1, or a non-text slot where contrast does not apply).
// Customers stat cards (2026-11-21): the unpaid text allow-list also
// carries #9a5e06 — the prep's TINTS table listed only the spec hex
// #78350f, but the parent decision locks the --color-pending
// substitute (5.09:1; the spec hex has no token) for the unpaid text.
const TINTS = {
  unpaid: { bg: ['#fffbeb'], border: ['#fde68a'], text: ['#78350f', '#9a5e06'], ring: ['#f59e0b'] },
  arrears: { bg: ['#fff1f2'], border: ['#fecdd3'], text: ['#881337', '#be123c'], ring: ['#f43f5e', '#e11d48'] },
  paid: { bg: ['#ecfdf5'], border: ['#a7f3d0'], text: ['#064e3b', '#065f46'], ring: ['#10b981'] },
  credit: { bg: ['#f0f9ff'], border: ['#bae6fd', '#bfdbfe'], text: ['#0c4a6e'], ring: ['#0ea5e9'] },
  all: { bg: ['#ecfdf5'], border: ['#a7f3d0'], text: ['#047857', '#065f46'], activeBg: ['#065f46'] },
  waada: { bg: ['#faf5ff', '#f5f3ff'], border: ['#e9d5ff', '#e2e8f0'], text: ['#6b21a8', '#6d28d9'], activeBg: ['#6b21a8', '#6d28d9'] },
  paused: { bg: ['#f1f5f9'], border: ['#e2e8f0'], text: ['#334155'], activeBg: ['#1e293b'] },
  kist: { bg: ['#f0fdfa'], border: ['#99f6e4', '#e2e8f0'], text: ['#115e59', '#047857', '#0c463a'], activeBg: ['#115e59', '#0c463a'] }
};

// --- C1: the arrears label shortens -----------------------------------------

test('C1 label: EN arrears shortens to 2+ Mo Arrears; UR stays short as-is', () => {
  assert.equal(TRANSLATIONS.en.cust_pill_arrears, '2+ Mo Arrears');
  assert.equal(TRANSLATIONS.ur.cust_pill_arrears, '2+ ماہ بقایا');
});

// --- C2: count separates from the PKR figure --------------------------------

test('C2 markup: the count badge moves into line 1; line 2 carries the PKR total alone', () => {
  const fn = renderRosterPillBarFn(appSrc);
  const line1Start = fn.indexOf('<span class="roster-pill-line1">');
  const line2Start = fn.indexOf('<span class="roster-pill-line2">');
  assert.ok(line1Start >= 0, 'revenue card line 1 missing');
  assert.ok(line2Start >= 0, 'revenue card line 2 missing');
  const line1 = fn.slice(line1Start, line2Start);
  // Bound line 2 at the end of the revenue return: the slice must not
  // run into the count-branch return below, which carries its own
  // roster-pill-count badge (intended — the count pills keep theirs).
  const line2End = fn.indexOf('</button>', line2Start);
  assert.ok(line2End > line2Start, 'revenue card return must close');
  const line2 = fn.slice(line2Start, line2End);
  assert.ok(line1.includes('roster-pill-count'), 'count badge must sit in line 1 (top-right of the card)');
  assert.ok(!line2.includes('roster-pill-count'), 'line 2 must not carry the count any more');
  assert.ok(line2.includes('roster-pill-total'), 'line 2 must still carry the PKR total');
  assert.ok(fn.includes('formatAmount(pill.totalCents / 100)'), 'total must still render the full figure via formatAmount');
});

// --- C3: revenue tints -------------------------------------------------------

test('C3 tints: each revenue card carries its soft semantic tint', () => {
  for (const id of ['unpaid', 'arrears', 'paid', 'credit']) {
    const rule = pillRule(id, false);
    assertTint(rule, { prop: 'background' }, TINTS[id].bg);
    assertTint(rule, { prop: 'border-color' }, TINTS[id].border);
    assertTint(rule, { prop: 'color' }, TINTS[id].text);
  }
});

// --- C4: revenue active rings ------------------------------------------------

test('C4 rings: the active revenue card keeps its tint and gains a 2px ring', () => {
  for (const id of ['unpaid', 'arrears', 'paid', 'credit']) {
    const rule = pillRule(id, true);
    const shadow = declValue(rule, 'box-shadow');
    assert.ok(shadow.includes('0 0 0 2px'), `active ${id} ring must be 2px (got ${shadow})`);
    const resolved = resolveVar(shadow);
    assert.ok(TINTS[id].ring.includes(resolved), `active ${id} ring resolves to ${resolved}, expected one of ${TINTS[id].ring.join(', ')}`);
  }
});

// --- C5: one scrollable count row --------------------------------------------

test('C5 row: the count pills sit on one scrollable row at phone widths', () => {
  const pillBars = media620Blocks(css).filter((block) => block.includes('.roster-pill-row'));
  assert.equal(pillBars.length, 1, 'exactly one 620px media rule must carry .roster-pill-row');
  const row = ruleBlock(pillBars[0], '.roster-pill-row {');
  assert.ok(row.includes('flex-wrap: nowrap'), 'count row must not wrap at phone widths');
  assert.ok(row.includes('overflow-x: auto'), 'count row must scroll horizontally at phone widths');
  // No-scrollbar treatment (app precedent: .bc-mohalla-pills).
  assert.ok(/scrollbar-width\s*:\s*none/.test(css), 'count row must hide the scrollbar (scrollbar-width: none)');
  assert.ok(css.includes('.roster-pill-row::-webkit-scrollbar'), 'count row must hide the webkit scrollbar');
});

// --- C6: count pill tints -----------------------------------------------------

test('C6 tints: each count pill carries its subtle matching tint when inactive', () => {
  for (const id of ['all', 'waada', 'paused', 'kist']) {
    const rule = pillRule(id, false);
    assertTint(rule, { prop: 'background' }, TINTS[id].bg);
    assertTint(rule, { prop: 'border-color' }, TINTS[id].border);
    assertTint(rule, { prop: 'color' }, TINTS[id].text);
  }
});

// --- C7: tiny count badge ------------------------------------------------------

test('C7 badge: the count renders inside a tiny rounded badge', () => {
  const badge = ruleBlock(css, '.roster-pill-count {');
  assert.ok(/border-radius\s*:\s*999px/.test(badge), 'count badge must be fully rounded');
  assert.ok(/font-size\s*:\s*11px/.test(badge), 'count badge text must be 11px');
  assert.ok(/font-weight\s*:\s*600/.test(badge), 'count badge text must be semibold');
  assert.ok(/padding\s*:\s*0\s+6px/.test(badge) || /padding\s*:\s*[^;}]*6px/.test(badge), 'count badge must carry horizontal padding');
});

// --- C8: zero-count pills muted unless selected ---------------------------------

test('C8 zero: pills with a 0 count are muted unless selected', () => {
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes('roster-pill--zero') || fn.includes('roster-pill-zero'), 'render must mark zero-count pills');
  const zero = ruleBlock(css, '.roster-pill--zero {');
  assert.ok(/opacity\s*:\s*0?\.7/.test(zero), 'zero-count pills must sit at opacity 0.7');
  const zeroPressed = ruleBlock(css, '.roster-pill--zero[aria-pressed="true"] {');
  assert.ok(/opacity\s*:\s*1/.test(zeroPressed), 'a selected zero-count pill must return to full opacity');
});

// --- C9: All Active pressed is solid emerald --------------------------------------

test('C9 active: All Active pressed is solid emerald-800 with white text', () => {
  const rule = pillRule('all', true);
  assertTint(rule, { prop: 'background' }, TINTS.all.activeBg);
  assertTint(rule, { prop: 'color' }, ['#ffffff', '#fff']);
});

// --- S1: groups and order unchanged -------------------------------------------

test('S1 groups: pill order and the two groups stay as pinned', () => {
  assert.deepEqual(
    ROSTER_PILL_DEFS.map((def) => def.id),
    ['all', 'unpaid', 'arrears', 'waada', 'paid', 'credit', 'paused', 'kist']
  );
  assert.ok(appSrc.includes("ROSTER_REVENUE_PILL_IDS = ['unpaid', 'arrears', 'paid', 'credit']"));
  assert.ok(appSrc.includes("ROSTER_COUNT_PILL_IDS = ['all', 'waada', 'paused', 'kist']"));
  assert.ok(renderRosterPillBarFn(appSrc).includes('<div class="roster-pill-grid">'));
  assert.ok(renderRosterPillBarFn(appSrc).includes('<div class="roster-pill-row">'));
});

// --- S2: full figure, no truncation ---------------------------------------------

test('S2 figure: the full PKR total stays, never sliced or ellipsized', () => {
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes('formatAmount(pill.totalCents / 100)'));
  assert.ok(!fn.includes('sli' + 'ce('), 'the render must not slice the total');
  assert.ok(!fn.includes('subs' + 'tring('), 'the render must not substring the total');
  assert.ok(!fn.includes('ellipsis'), 'the render must not ellipsize the total');
});

// --- S3: mount, placement, tap wiring --------------------------------------------

test('S3 wiring: mount, placement and tap behaviour stay', () => {
  assert.ok(html.includes('id="rosterPillBar"'), 'pill bar mount must exist');
  assert.ok(html.indexOf('id="rosterPillBar"') > html.indexOf('id="newCustomersPanel"'), 'bar must stay below the new-customers panel');
  assert.ok(html.indexOf('id="rosterPillBar"') < html.indexOf('id="customerList"'), 'bar must stay above the customer list');
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(fn.includes("customerRosterPill = normalizeRosterPill(button.dataset.rosterPill)"), 'tap must still set the pill');
  assert.ok(fn.includes('customerCurrentPage = 1'), 'tap must still reset to page 1');
  assert.ok(fn.includes('renderCustomers()'), 'tap must still re-render the roster');
});

// --- S4: tap targets -----------------------------------------------------------------

test('S4 targets: revenue cards stay 44px, count pills stay 32px', () => {
  const gridPill = ruleBlock(css, '.roster-pill-grid .roster-pill {');
  assert.ok(gridPill.includes('min-height: 44px'), 'revenue cards must keep the 44px tap target');
  const rowPill = ruleBlock(css, '.roster-pill-row .roster-pill {');
  assert.ok(rowPill.includes('min-height: 32px'), 'count pills must keep the 32px height');
});

// --- S5: no emoji -----------------------------------------------------------------------

test('S5 emoji: no 3D emoji in the pill definitions or render', () => {
  const defsSrc = read('roster-quick-filters.js');
  assert.ok(!/[⚠️🤝🟢💎⏸️📦]/.test(defsSrc), 'no 3D emoji in the pill definitions');
  assert.ok(!/[⚠️🤝🟢💎⏸️📦]/.test(renderRosterPillBarFn(appSrc)), 'no 3D emoji in the pill render');
});

// --- B1: i18n audit ----------------------------------------------------------------------

test('B1 i18n: every pill key exists in English and Urdu, non-empty', () => {
  const keys = ['cust_pill_bar_aria', ...ROSTER_PILL_DEFS.map((def) => def.labelKey)];
  assert.equal(keys.length, 9);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});

// --- B2: the SISP-136 CSS block stays token-only --------------------------------------------

test('B2 tokens: the SISP-136 CSS block carries no hex literal', () => {
  const block = css.slice(css.indexOf('/* SISP-136'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-136 CSS block must stay token-only (no hex)');
});
