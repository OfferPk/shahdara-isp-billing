// Plan 590 — Dark mode gets dark values for dashboard status colours
// (D1(a) scoped dark overrides in dark-contrast.css, chip pairs;
// D2(a) dashboard/search/ledger only, the 29 sampled uses;
// D3(b) tiles keep the saturated token bg, 1px border in the chip text
// colour, distinctness 2.66–2.98:1 DISCLOSED as a shortfall;
// D4(a) fix paid/overdue/info/whatsapp text, leave success (4.28:1
// near-miss) and emerald (6.36:1 pass); D5(a) WCAG 4.5:1 text / 3:1
// non-text vs the dark card #14241f; D6(a) leave the second palette;
// D7(a) this file; D8(a) browser sample; D9(a) leave the inherited ink).
// Rule-aware assertions only (comment-stripped, selector/body split with
// @media recursion — the repro-590 method). A raw `var(--color-paid`
// grep overcounts (it catches chips, buttons, tiles, fills and dots
// together) and a `--color-paid`-only grep undercounts — T2, so no test
// here asserts by substring grep.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ---- rule-aware CSS parsing (mirrors repro-590.mjs) ----
function rulesOf(text) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const j = text.indexOf('{', i);
    if (j < 0) break;
    const sel = text.slice(i, j).trim();
    let depth = 1;
    let k = j + 1;
    while (k < n && depth) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}') depth--;
      k++;
    }
    const body = text.slice(j + 1, k - 1);
    if (sel.startsWith('@media') || sel.startsWith('@supports')) out.push(...rulesOf(body));
    else if (sel && !sel.startsWith('@')) out.push({ sel: sel.replace(/\s+/g, ' ').trim(), body });
    i = k;
  }
  return out;
}
const norm = (s) => s.replace(/\s+/g, ' ').trim();
function darkRules(file) {
  return rulesOf(stripComments(read(file)))
    .filter((r) => r.sel.startsWith('[data-theme="dark"]'));
}
const darkContrast = darkRules('dark-contrast.css');
function findDark(sel) {
  const want = `[data-theme="dark"] ${sel}`;
  const hits = darkContrast.filter((r) => norm(r.sel) === norm(want));
  assert.equal(hits.length, 1, `expected exactly one dark rule for ${sel}, found ${hits.length}`);
  return hits[0];
}
function findRule(file, sel) {
  const hits = rulesOf(stripComments(read(file))).filter((r) => norm(r.sel) === norm(sel));
  assert.equal(hits.length, 1, `expected exactly one rule for ${sel} in ${file}, found ${hits.length}`);
  return hits[0];
}
function decl(body, prop) {
  const m = body.match(new RegExp(`${prop}\\s*:\\s*([^;]+);`));
  assert.ok(m, `expected a ${prop} declaration, body: ${body.slice(0, 120)}`);
  const raw = m[1].trim();
  return { value: raw.replace(/\s*!important\s*$/, '').trim(), important: /!important\s*$/.test(raw) };
}
// Body-only token-definition sweep: :root / [data-theme="dark"] rule bodies
// only (the Plan 588 T3 trap — a naive `--name:` grep would falsely
// "define" --primary from a selector such as `.ds-btn--primary:hover`).
function tokenDefs(file) {
  const text = stripComments(read(file));
  const defs = { light: {}, dark: {} };
  for (const r of rulesOf(text)) {
    if (r.sel === ':root' || r.sel === '[data-theme="dark"]') {
      const bucket = r.sel === ':root' ? defs.light : defs.dark;
      for (const m of r.body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) bucket['--' + m[1]] = m[2].trim();
    }
  }
  return defs;
}
function resolveToken(defs, name, theme) {
  let v = theme === 'dark' ? (defs.dark[name] ?? defs.light[name]) : defs.light[name];
  if (v == null) return null;
  for (let i = 0; i < 4 && v.startsWith('var('); i++) {
    const inner = v.match(/var\((--[a-z0-9-]+)/)?.[1];
    if (!inner) break;
    v = (theme === 'dark' ? (defs.dark[inner] ?? defs.light[inner]) : defs.light[inner]) ?? v;
  }
  return v;
}
// WCAG relative-luminance contrast (the repro-590 math, verbatim).
function hexLum(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [l1, l2] = [hexLum(a), hexLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const DARK_CARD = '#14241f';
const LIGHT_CARD = '#ffffff';

// The 15 text overrides (D1(a)/D2(a)/D4(a)) and the 11 tile-border rules
// (D3(b)) — the 26 dark rules this plan adds, no more.
const TEXT_OVERRIDES = [
  '.text-danger', '.badge-below-target',
  '.revleak-total', '.revleak-flag', '.revleak-amount',
  '.hwaudit-count', '.hwaudit-rx',
  '.power-outage-item-depleted .power-outage-remaining',
  '.cash-stat', '.digital-stat',
  '.collector-role-badge.digital-gateway', '.collector-role-badge.field-collector',
  '#quickCollectUndoBtn', '.recovery-age-badge', '.recovery-phone-line',
];
const TILE_BORDER_RULES = [
  ['.ds-stat--paid .ds-stat__icon', '#8fe0b6'],
  ['.ds-stat--info .ds-stat__icon', 'var(--color-info-strong)'],
  ['.ds-stat--overdue .ds-stat__icon', '#ffb4a8'],
  ['.ds-stat--whatsapp .ds-stat__icon', '#8fe0b6'],
  ['.home-kpi-card.ds-stat--paid .ds-icon-tile', '#8fe0b6'],
  ['.home-kpi-card.ds-stat--info .ds-icon-tile', 'var(--color-info-strong)'],
  ['.home-kpi-card.ds-stat--overdue .ds-icon-tile', '#ffb4a8'],
  ['.home-kpi-card.ds-stat--whatsapp .ds-icon-tile', '#8fe0b6'],
  ['.dc-action-icon--paid', '#8fe0b6'],
  ['.dc-action-icon--info', 'var(--color-info-strong)'],
  ['.dc-action-icon--whatsapp', '#8fe0b6'],
];

// ================= G1 — Inventory =================
test('G1a the 15 sampled text overrides exist, exactly one dark rule each', () => {
  assert.equal(TEXT_OVERRIDES.length, 15);
  for (const sel of TEXT_OVERRIDES) findDark(sel);
});

test('G1b the 11 tile rules exist with a 1px border in the chip text colour', () => {
  assert.equal(TILE_BORDER_RULES.length, 11);
  for (const [sel, colour] of TILE_BORDER_RULES) {
    const rule = findDark(sel);
    const b = decl(rule.body, 'border');
    assert.equal(b.value, `1px solid ${colour}`, `${sel} border`);
    assert.ok(b.important, `${sel} border must carry !important (T5)`);
    // The tile background is NOT overridden — the saturated token stays.
    assert.ok(!/background/.test(rule.body), `${sel} must not override the tile background (D3(b))`);
  }
});

test('G1c the light rules stay byte-identical (no light edit anywhere)', () => {
  const lightTiles = [
    ['components.css', '.ds-stat--paid .ds-stat__icon', 'background: var(--color-paid);'],
    ['components.css', '.ds-stat--info .ds-stat__icon', 'background: var(--color-info);'],
    ['components.css', '.ds-stat--overdue .ds-stat__icon', 'background: var(--color-overdue);'],
    ['components.css', '.ds-stat--whatsapp .ds-stat__icon', 'background: var(--color-whatsapp);'],
    ['dashboard.css', '.home-kpi-card.ds-stat--paid .ds-icon-tile', 'background: var(--color-paid);'],
    ['dashboard.css', '.home-kpi-card.ds-stat--info .ds-icon-tile', 'background: var(--color-info);'],
    ['dashboard.css', '.home-kpi-card.ds-stat--overdue .ds-icon-tile', 'background: var(--color-overdue);'],
    ['dashboard.css', '.home-kpi-card.ds-stat--whatsapp .ds-icon-tile', 'background: var(--color-whatsapp);'],
  ];
  for (const [file, sel, snippet] of lightTiles) {
    assert.ok(findRule(file, sel).body.includes(snippet), `${file} ${sel} must keep ${snippet}`);
  }
  assert.ok(findRule('dashboard.css', '.text-danger').body.includes('color: var(--color-overdue) !important;'));
  assert.ok(findRule('dashboard.css', '.cash-stat').body.includes('color: var(--color-paid);'));
  assert.ok(findRule('dashboard.css', '.digital-stat').body.includes('color: var(--color-info);'));
  assert.ok(findRule('bulk-collect.css', '#quickCollectUndoBtn').body.includes('color: var(--color-overdue);'));
  assert.ok(findRule('styles.css', '.recovery-age-badge').body.includes('color:var(--color-overdue)'));
  assert.ok(findRule('dashboard.css', '.collector-role-badge.field-collector').body.includes('background: var(--color-paid-bg);'));
});

// ================= G2 — Pairs, resolution, !important, no redefine =================
test('G2a every 590 override declaration carries !important (T5)', () => {
  for (const sel of TEXT_OVERRIDES) {
    const rule = findDark(sel);
    const decls = rule.body.split(';').map((d) => d.trim()).filter(Boolean);
    assert.ok(decls.length >= 1, `${sel} has no declarations`);
    for (const d of decls) assert.ok(/!important\s*$/.test(d), `${sel}: ${d} must carry !important`);
  }
  for (const [sel] of TILE_BORDER_RULES) {
    const rule = findDark(sel);
    const decls = rule.body.split(';').map((d) => d.trim()).filter(Boolean);
    assert.equal(decls.length, 1, `${sel} must carry exactly one declaration (the border)`);
    assert.ok(/!important\s*$/.test(decls[0]), `${sel} border must carry !important`);
  }
});

test('G2b the dark text colours resolve to the chip pairs', () => {
  const defs = tokenDefs('tokens.css');
  assert.equal(resolveToken(defs, '--color-info-strong', 'dark'), '#d5e2ff');
  // Paid green text #8fe0b6.
  for (const sel of ['.cash-stat', '.recovery-phone-line']) {
    assert.equal(decl(findDark(sel).body, 'color').value, '#8fe0b6', sel);
  }
  const fc = findDark('.collector-role-badge.field-collector');
  assert.equal(decl(fc.body, 'background').value, '#14382a', 'field-collector bg is the chip green bg');
  assert.equal(decl(fc.body, 'color').value, '#8fe0b6', 'field-collector text is the chip green text');
  // Overdue red text #ffb4a8.
  for (const sel of ['.text-danger', '.badge-below-target', '.revleak-total', '.revleak-flag',
    '.revleak-amount', '.hwaudit-count', '.hwaudit-rx',
    '.power-outage-item-depleted .power-outage-remaining', '.recovery-age-badge']) {
    assert.equal(decl(findDark(sel).body, 'color').value, '#ffb4a8', sel);
  }
  assert.equal(decl(findDark('#quickCollectUndoBtn').body, 'color').value, '#ffb4a8');
  assert.equal(decl(findDark('#quickCollectUndoBtn').body, 'border-color').value, '#ffb4a8');
  // Info blue text via the token (resolves to #d5e2ff in dark).
  for (const sel of ['.digital-stat', '.collector-role-badge.digital-gateway']) {
    assert.equal(decl(findDark(sel).body, 'color').value, 'var(--color-info-strong)', sel);
  }
  // Whatsapp reuses the green pair's text (D4) — no whatsapp pair exists.
  assert.equal(decl(findDark('.ds-stat--whatsapp .ds-stat__icon').body, 'border').value, '1px solid #8fe0b6');
});

test('G2c the status tokens are NOT redefined in either tokens.css dark block', () => {
  const defs = tokenDefs('tokens.css');
  const forbidden = ['--color-paid', '--color-paid-bg', '--color-overdue', '--color-success',
    '--color-success-bg', '--color-info', '--color-whatsapp', '--color-emerald',
    '--color-emerald-light', '--color-emerald-dark'];
  for (const t of forbidden) {
    assert.ok(!(t in defs.dark), `${t} must not be defined in any tokens.css dark block (D1(a))`);
    assert.ok(t in defs.light, `${t} must still be defined in :root`);
  }
  // The dark block still overrides the tokens the spec names (unchanged).
  for (const t of ['--color-brand-500', '--color-pending', '--ink', '--muted', '--line', '--surface']) {
    assert.ok(t in defs.dark, `${t} keeps its dark override`);
  }
});

// ================= G3 — Sampled labels =================
test('G3a overdue labels keep light var(--color-overdue) and go dark #ffb4a8', () => {
  const pairs = [
    ['dashboard.css', '.text-danger'], ['dashboard.css', '.badge-below-target'],
    ['dashboard.css', '.revleak-total'], ['dashboard.css', '.revleak-flag'],
    ['dashboard.css', '.revleak-amount'], ['dashboard.css', '.hwaudit-count'],
    ['dashboard.css', '.hwaudit-rx'],
    ['dashboard.css', '.power-outage-item-depleted .power-outage-remaining'],
    ['styles.css', '.recovery-age-badge'],
  ];
  for (const [file, sel] of pairs) {
    assert.ok(findRule(file, sel).body.includes('color: var(--color-overdue)')
      || findRule(file, sel).body.includes('color:var(--color-overdue)'),
    `${file} ${sel} must keep its light overdue colour`);
    assert.equal(decl(findDark(sel).body, 'color').value, '#ffb4a8', `${sel} dark colour`);
  }
});

test('G3b paid/info labels and the undo button go to their dark pair colours', () => {
  assert.ok(findRule('dashboard.css', '.cash-stat').body.includes('color: var(--color-paid);'));
  assert.equal(decl(findDark('.cash-stat').body, 'color').value, '#8fe0b6');
  assert.ok(findRule('dashboard.css', '.digital-stat').body.includes('color: var(--color-info);'));
  assert.equal(decl(findDark('.digital-stat').body, 'color').value, 'var(--color-info-strong)');
  assert.ok(findRule('dashboard.css', '.collector-role-badge.digital-gateway').body.includes('color: var(--color-info);'));
  assert.ok(findRule('styles.css', '.recovery-phone-line').body.includes('color:var(--color-paid)'));
  assert.equal(decl(findDark('.recovery-phone-line').body, 'color').value, '#8fe0b6');
  const undo = findRule('bulk-collect.css', '#quickCollectUndoBtn');
  assert.ok(undo.body.includes('border-color: var(--color-overdue);'));
  assert.ok(undo.body.includes('color: var(--color-overdue);'));
});

test('G3c the already-fixed ledger chips and inbox badges keep their dark rules', () => {
  const method = findDark(':is(.tx-method-cash, .tx-method-easypaisa)');
  assert.equal(decl(method.body, 'background').value, '#14382a');
  assert.equal(decl(method.body, 'color').value, '#8fe0b6');
  for (const [sel, bg, text] of [
    ['.badge-received', '#064e3b', '#a7f3d0'],
    ['.badge-sent', '#1e3a8a', '#bfdbfe'],
    ['.badge-recorded', '#0c4a6e', '#bae6fd'],
  ]) {
    const rule = rulesOf(stripComments(read('payments-inbox.css')))
      .find((r) => norm(r.sel) === `[data-theme="dark"] ${sel}`);
    assert.ok(rule, `payments-inbox.css keeps its dark ${sel} rule`);
    assert.ok(rule.body.includes(`background: ${bg};`), `${sel} bg unchanged`);
    assert.ok(rule.body.includes(`color: ${text};`), `${sel} text unchanged`);
  }
});

test('G3d success and emerald are deliberately LEFT (D4(a)) — no dark rule for them', () => {
  // .text-success is already 6.36:1 in dark; .amount-val-zero and the
  // .optimal values are the 4.28:1 success near-miss. Neither is overridden.
  assert.ok(findRule('dashboard.css', '.text-success').body.includes('color: var(--color-emerald) !important;'));
  for (const sel of ['.text-success', '.amount-val-zero', '.srv6-stat-val.optimal',
    '.flex-algo-stat-val.optimal', '.optical-evm-stat-val.optimal']) {
    const hits = darkContrast.filter((r) => norm(r.sel).includes(sel));
    assert.equal(hits.length, 0, `${sel} must have no dark-contrast.css rule (D4(a) leaves it)`);
  }
  assert.ok(findRule('dashboard.css', '.amount-val-zero').body.includes('color: var(--color-success);'));
});

// ================= G4 — Dark + visibility + buttons =================
test('G4a the dark text colours clear 4.5:1 and beat their light contrast', () => {
  const rows = [
    ['#8fe0b6', '#19704e', 'paid'],
    ['#ffb4a8', '#b33c33', 'overdue'],
    ['#d5e2ff', '#0270a8', 'info'],
  ];
  for (const [dark, light, name] of rows) {
    const darkRatio = contrast(dark, DARK_CARD);
    const lightRatio = contrast(light, LIGHT_CARD);
    assert.ok(darkRatio >= 4.5, `${name} dark ${dark} must clear 4.5:1, got ${darkRatio.toFixed(2)}:1`);
    assert.ok(darkRatio > lightRatio, `${name} dark ${darkRatio.toFixed(2)}:1 must beat light ${lightRatio.toFixed(2)}:1`);
  }
  assert.equal(contrast('#8fe0b6', DARK_CARD).toFixed(2), '10.37');
  assert.equal(contrast('#ffb4a8', DARK_CARD).toFixed(2), '9.48');
  assert.equal(contrast('#d5e2ff', DARK_CARD).toFixed(2), '12.41');
});

test('G4b tile distinctness is DISCLOSED as a measured shortfall, never claimed', () => {
  // Tile bg vs the dark card stays under the 3:1 non-text bar — the border
  // (G1b) outlines the tile, it does not recolour it. These assertions
  // pin the measured numbers so a later edit cannot silently claim a pass.
  const tiles = [
    ['#19704e', '2.66', 'paid'], ['#b33c33', '2.77', 'overdue'],
    ['#0270a8', '2.98', 'info'], ['#0e7a3d', '2.97', 'whatsapp'],
  ];
  for (const [bg, want, name] of tiles) {
    const got = contrast(bg, DARK_CARD);
    assert.equal(got.toFixed(2), want, `${name} tile distinctness must measure ${want}:1`);
    assert.ok(got < 3, `${name} tile distinctness ${got.toFixed(2)}:1 stays under 3:1 — DISCLOSED shortfall (D3(b))`);
  }
  // And the chip-pair bg the spec's scope sentence points at would be worse.
  for (const bg of ['#14382a', '#402a24', '#26344d']) {
    assert.ok(contrast(bg, DARK_CARD) < 1.3, `chip-pair bg ${bg} would vanish at ${contrast(bg, DARK_CARD).toFixed(2)}:1`);
  }
});

test('G4c the 16 white-text button pairings are unchanged in both themes', () => {
  const defs = tokenDefs('tokens.css');
  // The tokens resolve to their light hex in dark — so every white-text
  // pairing renders exactly as it did before (the sim-redefine guard: a
  // token-only test would still pass under a redefine; this one would not).
  const resolved = {
    '--color-paid': '#19704e', '--color-overdue': '#b33c33', '--color-info': '#0270a8',
    '--color-success': '#059669', '--color-whatsapp': '#0e7a3d', '--color-emerald': '#10b981',
  };
  for (const [t, hex] of Object.entries(resolved)) {
    assert.equal(resolveToken(defs, t, 'dark'), hex, `${t} must resolve to ${hex} in dark`);
  }
  const pairings = [
    ['components.css', '.advance-badge', '--color-paid', 'var(--color-neutral-0)'],
    ['components.css', '.ds-btn--success', '--color-success', 'var(--surface)'],
    ['components.css', '.ds-btn--whatsapp', '--color-whatsapp', 'var(--surface)'],
    ['components.css', '.sla-vip-badge', '--color-info', 'var(--surface)'],
    ['components.css', '.wallet-ledger-badge.pending', '--color-overdue', 'var(--color-neutral-0)'],
    ['components.css', '.void-badge', '--color-overdue', 'var(--color-neutral-0)'],
    ['components.css', '.free-connection-badge', '--color-paid', 'var(--color-neutral-0)'],
    ['components.css', '.shift-weekday-pill.is-on', '--color-success', 'var(--surface)'],
    ['dashboard.css', '.home-kpi-card.ds-stat--paid .ds-icon-tile', '--color-paid', 'var(--white)'],
    ['dashboard.css', '.home-kpi-card.ds-stat--info .ds-icon-tile', '--color-info', 'var(--white)'],
    ['dashboard.css', '.home-kpi-card.ds-stat--overdue .ds-icon-tile', '--color-overdue', 'var(--white)'],
    ['dashboard.css', '.home-kpi-card.ds-stat--whatsapp .ds-icon-tile', '--color-whatsapp', 'var(--white)'],
    ['nav.css', '.fdt-actions-row .btn-primary', '--color-info', '#ffffff'],
    ['nav.css', '.btn-success', '--color-emerald', '#ffffff'],
  ];
  for (const [file, sel, bg, text] of pairings) {
    const rule = findRule(file, sel);
    assert.ok(rule.body.includes(`background: var(${bg});`), `${file} ${sel} bg must stay var(${bg})`);
    assert.ok(rule.body.includes(`color: ${text};`), `${file} ${sel} text must stay ${text}`);
  }
  // The two close-button group rules (one per file) keep the overdue bg.
  for (const file of ['components.css', 'styles.css']) {
    const hits = rulesOf(stripComments(read(file)))
      .filter((r) => r.sel.includes('.close-button') && r.body.includes('var(--color-overdue)')
        && r.body.includes('var(--color-neutral-0)'));
    assert.equal(hits.length, 1, `${file} must keep exactly one overdue-bg close-button rule`);
  }
  // The receipt sheet stays paper-white — no dark rule repaints it.
  assert.equal(darkContrast.filter((r) => r.sel.includes('.receipt-sheet')).length, 0);
});

// ================= G5 — Guards + completeness =================
test('G5a dark-contrast.css holds exactly 19 distinct hex (no new hex)', () => {
  const text = stripComments(read('dark-contrast.css'));
  const set = new Set([...text.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)]
    .map((m) => m[0].toLowerCase()));
  assert.equal(set.size, 19, `dark-contrast.css must hold exactly 19 distinct hex, got ${set.size}: ${[...set].sort().join(' ')}`);
  assert.deepEqual([...set].sort(), ['#0369a1', '#04231a', '#075e54', '#0b7a6c', '#14382a',
    '#16283f', '#1e3d31', '#224236', '#26503f', '#2c5c46', '#3a2c10', '#402a24',
    '#6e453c', '#8fe0b6', '#9cc2f0', '#f6cf7a', '#ff9d92', '#ffb4a8', '#fff']);
  for (const hex of ['#8fe0b6', '#ffb4a8', '#14382a', '#402a24']) {
    assert.ok(set.has(hex), `the reused chip pair hex ${hex} is already in the file`);
  }
});

test('G5b components.css stays hex-free and parity stays 4,722/4,722', () => {
  const hexes = stripComments(read('components.css'))
    .match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
  assert.equal(hexes, null, 'components.css must stay hex-free (var() only)');
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4722, 'EN parity 4,722');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4722, 'UR parity 4,722');
});

test('G5c the chip rules and the second palette are unchanged; T10 uses are left by name', () => {
  // Plan E chip rules (re-asserted so a later edit cannot silently move them).
  const paid = findDark(':is(.ds-chip--paid, .ds-chip--success)');
  assert.equal(decl(paid.body, 'background').value, '#14382a');
  assert.equal(decl(paid.body, 'color').value, '#8fe0b6');
  const overdue = findDark('.ds-chip--overdue');
  assert.equal(decl(overdue.body, 'background').value, '#402a24');
  assert.equal(decl(overdue.body, 'color').value, '#ffb4a8');
  const info = findDark('.ds-chip--info');
  assert.equal(decl(info.body, 'background').value, 'var(--color-info-bg)');
  assert.equal(decl(info.body, 'color').value, 'var(--color-info-strong)');
  // Second palette (§2.8, D6(a)): dashboard dark rules stay as they are.
  const dashDark = rulesOf(stripComments(read('dashboard.css')))
    .filter((r) => r.sel.startsWith('[data-theme="dark"]'));
  const findDashDark = (sel) => {
    const hits = dashDark.filter((r) => norm(r.sel) === norm(`[data-theme="dark"] ${sel}`));
    assert.equal(hits.length, 1, `expected exactly one dashboard dark rule for ${sel}`);
    return hits[0];
  };
  assert.ok(findDashDark('.status-high').body.includes('color: var(--color-danger-light);'));
  assert.ok(findDashDark('.status-low').body.includes('color: #6ee7b7;'));
  assert.ok(findDashDark('.badge-expansion').body.includes('color: var(--color-emerald-light);'));
  assert.ok(findDashDark('.worklist-tag-overdue').body.includes('color: var(--color-danger-light);'));
  // T10 light-bg uses left behind BY NAME — no dark-contrast.css rule for them.
  // (.worklist-tag-cleared keeps its dashboard.css dark rule; the other two
  // keep their light bgs. None is claimed fixed by this plan.)
  for (const sel of ['.ticket-status-resolved', '.register-advance-badge', '.worklist-tag-cleared']) {
    const hits = darkContrast.filter((r) => norm(r.sel).includes(sel));
    assert.equal(hits.length, 0, `${sel} is left behind by name (T10) — no dark-contrast.css rule`);
  }
});
