// Plan 588 — The `.btn-*` family collapses onto the token system.
//
// `.btn-primary` was defined twice with different colours (blue #0270a8
// on the 15 field-tool Save buttons, green #0e5b4d on the 2 pending-action
// buttons) and `--primary` was defined in NO CSS file — the green only
// worked via the `#0e5b4d` fallback — and neither were `--text`,
// `--bg-muted`, `--border-color`, `--text-color`. This file owns the fix:
//
//   G1 — Counts: token-exact var counts (11/9/6/10/10) and usage counts
//        (17/41/1/16/3); the prefix-grep 31 is asserted as 9+10+12.
//   G2 — The aliases: defined exactly once in tokens.css, var() refs
//        only; all 8 .btn-* uses resolve (light) to their fallback
//        values; no .btn-* rule references an undefined variable.
//   G3 — The sampled buttons: fdt Save blue, pending Collect Cash
//        green via the alias, pending Send WhatsApp ds-brand via the
//        scoped override, fdt WhatsApp bright, pending Fulfill emerald,
//        fdt Cancel text via the alias, bulk chips 34px.
//   G4 — Dark (the disclosure group): the fdt dark rule re-tokens
//        identically; the two pending dark rules keep their literal
//        values; .btn-primary has no dark rule and resolves #0e5b4d.
//   G5 — Guards + completeness: ratchet baselines hold (nav.css 163,
//        down from 164 via #094338), parity unchanged at 4,722/4,722,
//        `.ds-btn--primary` still #145b4b, base rule + 44px floor
//        unchanged, the other 13 undefined vars still undefined
//        (KNOWN-OPEN), and the D1(a) side effect pinned as a known
//        change: 83 of the 148 repo-wide uses of the five variables
//        carry a different fallback and recolour to the alias value.
//
// Token-exact matching throughout — a substring grep counts
// `var(--text-color` and `var(--text-muted` as `--text` (31, not 9),
// and a naive `--name:` grep "defines" `--primary` from the
// `.ds-btn--primary:hover` selector. No customer data, no phone numbers,
// no synthetic matches — the assertions are over the real shipped class
// names, CSS rules, and token values. Rendered pixels are proven by the
// D8(a) browser sample (sample-before.json / sample-after.json in the
// implementer scratch), not by this file: no jsdom in the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const navCss = read('nav.css');
const tokensCss = read('tokens.css');
const componentsCss = read('components.css');
const stylesCss = read('styles.css');
const dashboardCss = read('dashboard.css');
const html = read('index.html');

// Distinct hex, the design-tokens-230 method: comment-stripped, 6-or-3
// digit regex only (a 3–8-digit regex over-counts).
function distinctHex(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).size;
}

// Token-exact var-use count: `var(--name` followed by `,` or `)` — so
// `var(--text-color` and `var(--text-muted` never count as `--text` (T2).
function countVarUses(css, bare) {
  return (css.match(new RegExp(`var\\(--${bare}(?=[,)])`, 'g')) || []).length;
}

// Extract a top-level block (`:root { ... }` / `[data-theme="dark"] { ... }`)
// by brace matching from the selector's opening brace.
function extractBlock(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `${selector} block exists`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced block for ${selector}`);
}

// `--name: value;` pairs inside one block.
function parseDefs(block) {
  const defs = {};
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    defs[`--${m[1]}`] = m[2].trim();
  }
  return defs;
}

const lightDefs = parseDefs(extractBlock(tokensCss, ':root {'));
const darkDefs = parseDefs(extractBlock(tokensCss, '[data-theme="dark"] {'));

// Resolve a token name to its hex in a theme, following var() chains.
// Dark falls back to the light definition (a token with no dark value
// renders its light value in dark), then to null (undefined).
function resolveToken(name, theme, seen = new Set()) {
  assert.ok(!seen.has(name), `no var() cycle at ${name}`);
  seen.add(name);
  const raw = theme === 'dark'
    ? (darkDefs[name] ?? lightDefs[name] ?? null)
    : (lightDefs[name] ?? null);
  if (raw === null) return null;
  const ref = /^var\((--[\w-]+)\)$/.exec(raw);
  if (ref) return resolveToken(ref[1], theme, seen);
  return raw.toLowerCase();
}

// Resolve `var(--name, fallback)` in a theme: the token value, or the
// fallback when the token is undefined.
function resolveVarUse(name, fallback, theme) {
  return resolveToken(name, theme) ?? fallback.toLowerCase();
}

// All CSS rules as (selector, body) pairs. Comments are stripped first:
// a `/* ... */` comment sitting above a rule would otherwise land inside
// the captured selector. The regex matches inner rules of @media blocks
// too (their selectors parse cleanly); nav.css carries no .btn-* rule
// inside @media, so the .btn-* filter below is exact.
function cssRules(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

// Count standalone class tokens (whitespace-separated `class="…"` values
// + `className = '…'` assignments) — never a substring grep.
function countClassToken(text, token) {
  let n = 0;
  for (const m of text.matchAll(/class="([^"]*)"/g)) {
    if (m[1].split(/\s+/).includes(token)) n += 1;
  }
  for (const m of text.matchAll(/className\s*=\s*'([^']*)'/g)) {
    if (m[1].split(/\s+/).includes(token)) n += 1;
  }
  return n;
}

function ruleBody(css, selectorRegex) {
  const rules = cssRules(css).filter((r) => selectorRegex.test(r.selector));
  assert.equal(rules.length, 1, `exactly one rule matches ${selectorRegex}`);
  return rules[0].body;
}

// ---------- G1 — Counts ----------

test('G1: nav.css carries 11 --primary, 9 --text, 6 --bg-muted, 10 --border-color, 10 --text-color uses (token-exact)', () => {
  // Spec correction: "--text used 31 times" is the `var(--text` PREFIX
  // count (9 --text + 10 --text-color + 12 --text-muted). Token-exact
  // it is 9 (repro B4/S4).
  assert.equal(countVarUses(navCss, 'primary'), 11, 'var(--primary) uses in nav.css');
  assert.equal(countVarUses(navCss, 'text'), 9, 'var(--text) uses in nav.css');
  assert.equal(countVarUses(navCss, 'bg-muted'), 6, 'var(--bg-muted) uses in nav.css');
  assert.equal(countVarUses(navCss, 'border-color'), 10, 'var(--border-color) uses in nav.css');
  assert.equal(countVarUses(navCss, 'text-color'), 10, 'var(--text-color) uses in nav.css');
  assert.equal((navCss.match(/var\(--text/g) || []).length, 31, 'prefix var(--text count (9 + 10 + 12)');
  assert.equal(countVarUses(navCss, 'text-color'), 10, 'var(--text-color) is 10 of the 31');
  assert.equal(countVarUses(navCss, 'text-muted'), 12, 'var(--text-muted) is 12 of the 31');
  assert.equal(9 + 10 + 12, 31, 'the prefix count decomposes exactly');
});

test('G1: the token counter itself is token-exact (var(--text) vs var(--text-color) vs var(--text-muted))', () => {
  const sample = 'color: var(--text, #334155); border: 1px solid var(--text-color, #334155); color: var(--text-muted, #64748b);';
  assert.equal(countVarUses(sample, 'text'), 1, 'only the bare --text use counts');
  assert.equal(countVarUses(sample, 'text-color'), 1, '--text-color counts only as itself');
  assert.equal(countVarUses(sample, 'text-muted'), 1, '--text-muted counts only as itself');
});

test('G1: usage counts are btn-primary 17 / btn-secondary 41 / btn-success 1 / btn-whatsapp 16 / btn-tool-secondary 3', () => {
  const js = readdirSync(root).filter((f) => f.endsWith('.js')).map((f) => read(f)).join('\n');
  assert.equal(countClassToken(html, 'btn-primary') + countClassToken(js, 'btn-primary'), 17, 'btn-primary total');
  assert.equal(countClassToken(html, 'btn-secondary') + countClassToken(js, 'btn-secondary'), 41, 'btn-secondary total');
  assert.equal(countClassToken(html, 'btn-success') + countClassToken(js, 'btn-success'), 1, 'btn-success total');
  assert.equal(countClassToken(html, 'btn-whatsapp') + countClassToken(js, 'btn-whatsapp'), 16, 'btn-whatsapp total');
  assert.equal(countClassToken(html, 'btn-tool-secondary') + countClassToken(js, 'btn-tool-secondary'), 3, 'btn-tool-secondary total');
  assert.equal(countClassToken(html, 'btn-primary'), 15, 'btn-primary in index.html (all fdt Save buttons)');
  assert.equal(countClassToken(html, 'btn-secondary'), 33, 'btn-secondary in index.html (all fdt Cancel buttons)');
  assert.equal(countClassToken(html, 'btn-whatsapp'), 16, 'btn-whatsapp in index.html');
});

// ---------- G2 — The aliases + resolution ----------

test('G2: the 5 aliases are defined exactly once in tokens.css, in the semantic-alias section, as var() refs only', () => {
  // Body-only definition counting (T3): the anchored `^\s*--name\s*:`
  // form never matches the `.ds-btn--primary:hover` selector, which a
  // naive `--primary:` grep falsely counts as a definition.
  for (const name of ['--primary', '--text', '--text-color', '--bg-muted', '--border-color']) {
    const defs = (tokensCss.match(new RegExp(`^\\s*${name.replace(/-/g, '\\-')}\\s*:`, 'gm')) || []).length;
    assert.equal(defs, 1, `${name} is defined exactly once in tokens.css`);
  }
  // They live in the semantic-alias section (after --amber-bg, before
  // the DS-0 comment), following the existing alias pattern.
  const section = tokensCss.slice(tokensCss.indexOf('/* Semantic aliases'), tokensCss.indexOf('/* DS-0 design-system palette'));
  for (const line of [
    '--primary: var(--color-brand-600);',
    '--text: var(--color-slate-700);',
    '--text-color: var(--color-slate-700);',
    '--bg-muted: var(--color-slate-100);',
    '--border-color: var(--color-slate-300);',
  ]) {
    assert.ok(section.includes(line), `semantic-alias section defines ${line}`);
  }
  // var() refs only — no hex in the alias definitions.
  for (const name of ['--primary', '--text', '--text-color', '--bg-muted', '--border-color']) {
    assert.match(lightDefs[name], /^var\(--[\w-]+\)$/, `${name} aliases to a token, not a literal`);
  }
  // The alias values are the VALUE-identical tokens, not the spec's
  // suggested ones (sim-spec-replace 1/6): --primary resolves to
  // #0e5b4d, NOT to --green's #145b4b.
  assert.equal(resolveToken('--primary', 'light'), '#0e5b4d', '--primary resolves to #0e5b4d');
  assert.notEqual(resolveToken('--primary', 'light'), '#145b4b', '--primary must NOT resolve to --green (#145b4b)');
  assert.equal(resolveToken('--text', 'light'), '#334155', '--text resolves to #334155');
  assert.equal(resolveToken('--bg-muted', 'light'), '#f1f5f9', '--bg-muted resolves to #f1f5f9');
  assert.equal(resolveToken('--border-color', 'light'), '#cbd5e1', '--border-color resolves to #cbd5e1');
});

test('G2: all 8 .btn-* uses resolve (light) to their current fallback values', () => {
  // The eight uses (repro R1): .fdt-actions-row .btn-secondary (--text),
  // .btn-tool-secondary (3), .btn-primary (--primary), .btn-secondary (3).
  // Each resolves through its alias to exactly the value its fallback
  // already rendered — that is what "value-preserving" means for the
  // buttons. The fallbacks are KEPT in the uses (T13 safety net).
  const expected = [
    [/^\.fdt-actions-row \.btn-secondary$/, '--text', '#334155'],
    [/^\.btn-tool-secondary$/, '--bg-muted', '#f1f5f9'],
    [/^\.btn-tool-secondary$/, '--border-color', '#cbd5e1'],
    [/^\.btn-tool-secondary$/, '--text-color', '#334155'],
    [/^\.btn-primary$/, '--primary', '#0e5b4d'],
    [/^\.btn-secondary$/, '--bg-muted', '#f1f5f9'],
    [/^\.btn-secondary$/, '--text-color', '#334155'],
    [/^\.btn-secondary$/, '--border-color', '#cbd5e1'],
  ];
  assert.equal(expected.length, 8, 'exactly the 8 .btn-* undefined uses');
  for (const [selRe, name, fallback] of expected) {
    const body = ruleBody(navCss, selRe);
    assert.ok(body.includes(`var(${name}, ${fallback})`), `${selRe} still carries var(${name}, ${fallback}) — fallback kept`);
    assert.equal(resolveVarUse(name, fallback, 'light'), fallback.toLowerCase(), `${name} resolves (light) to its fallback ${fallback}`);
  }
});

test('G2: no .btn-* rule in nav.css references an undefined variable', () => {
  // The defined set is swept from rule BODIES across all stylesheets
  // (T3) — a selector such as `.ds-btn--primary:hover` never counts.
  const defined = new Set();
  for (const css of [tokensCss, stylesCss, componentsCss, dashboardCss, navCss]) {
    for (const { body } of cssRules(css)) {
      for (const m of body.matchAll(/--([\w-]+)\s*:/g)) defined.add(`--${m[1]}`);
    }
  }
  // The five aliases are in the defined set (they are the fix).
  for (const name of ['--primary', '--text', '--text-color', '--bg-muted', '--border-color']) {
    assert.ok(defined.has(name), `${name} is defined`);
  }
  const btnRules = cssRules(navCss).filter((r) => r.selector.includes('.btn-'));
  assert.ok(btnRules.length >= 20, `the .btn-* family has ${btnRules.length} rule blocks`);
  const used = new Set();
  for (const { body } of btnRules) {
    for (const m of body.matchAll(/var\((--[\w-]+)/g)) used.add(m[1]);
  }
  for (const name of [...used].sort()) {
    assert.ok(defined.has(name), `.btn-* rules use ${name}, which must be defined`);
  }
});

// ---------- G3 — The sampled buttons ----------

test('G3: the field-tool Save button resolves blue #0270a8 / 7px 14px / 12.5px', () => {
  const body = ruleBody(navCss, /^\.fdt-actions-row \.btn-primary$/);
  assert.match(body, /background:\s*var\(--color-info\);/, 'background comes from --color-info');
  assert.equal(resolveToken('--color-info', 'light'), '#0270a8', '--color-info is the fdt blue #0270a8');
  assert.match(body, /padding:\s*7px 14px;/, 'padding 7px 14px');
  assert.match(body, /font-size:\s*12\.5px;/, 'font-size 12.5px');
  assert.match(body, /border-radius:\s*6px;/, 'border-radius 6px');
  // The scoped rule (0,2,0) beats the unscoped .btn-primary (0,1,0),
  // so the 15 fdt Save buttons render blue, not green.
  // The blue is token-spelled now (D4(a)), not a literal declaration —
  // the why-comment above it still names #0270a8 in prose, so the check
  // is on the declaration, not the whole body.
  assert.ok(!/background:\s*#0270a8/.test(body), 'the blue is token-spelled now (D4(a)), not a literal');
});

test('G3: pending Collect Cash resolves #0e5b4d via the alias; pending Send WhatsApp still resolves #0F5338 via the scoped override', () => {
  const primary = ruleBody(navCss, /^\.btn-primary$/);
  assert.match(primary, /background:\s*var\(--primary, #0e5b4d\);/, 'unscoped .btn-primary keeps its var(--primary, #0e5b4d)');
  assert.equal(resolveVarUse('--primary', '#0e5b4d', 'light'), '#0e5b4d', 'pending Collect Cash renders #0e5b4d through the alias');
  // The Send WhatsApp button is overridden by the scoped rule — two
  // classes (0,2,0) beat one (0,1,0) — so it renders ds-brand, NOT the
  // primary green the spec claims (repro B9).
  const override = ruleBody(navCss, /^\.pending-card-receipt \.pending-wa-btn$/);
  assert.match(override, /background:\s*var\(--ds-brand, #0F5338\);/, 'the wa-btn override still spells var(--ds-brand, #0F5338)');
  assert.equal(resolveToken('--ds-brand', 'light'), '#0f5338', '--ds-brand is #0F5338');
  const overrideClasses = ('.pending-card-receipt .pending-wa-btn'.match(/\.[\w-]+/g) || []).length;
  assert.equal(overrideClasses, 2, 'the override selector carries 2 classes, so it wins over .btn-primary (1 class)');
});

test('G3: fdt WhatsApp resolves #25d366 (literal, no token exists) and pending Fulfill resolves #10b981 via --color-emerald', () => {
  const wa = ruleBody(navCss, /^\.fdt-actions-row \.btn-whatsapp$/);
  assert.match(wa, /background:\s*#25d366;/, 'fdt WhatsApp keeps its bright literal #25d366 (D4(a) — no token exists)');
  const success = ruleBody(navCss, /^\.btn-success$/);
  assert.match(success, /background:\s*var\(--color-emerald\);/, 'pending Fulfill background comes from --color-emerald');
  assert.equal(resolveToken('--color-emerald', 'light'), '#10b981', '--color-emerald is #10b981');
  // .btn-accept keeps the literal #10b981 (D6(a)) — the two greens are
  // the same value, spelled two ways, by decision.
  const accept = ruleBody(navCss, /^\.btn-accept$/);
  assert.match(accept, /background:\s*#10b981;/, '.btn-accept keeps its literal #10b981');
});

test('G3: fdt Cancel resolves #334155 text via the alias; bulk chips keep min-height 34px + the scoped 34px !important', () => {
  const cancel = ruleBody(navCss, /^\.fdt-actions-row \.btn-secondary$/);
  assert.match(cancel, /color:\s*var\(--text, #334155\);/, 'fdt Cancel text keeps var(--text, #334155)');
  assert.equal(resolveVarUse('--text', '#334155', 'light'), '#334155', 'fdt Cancel text renders #334155 through the alias');
  assert.match(cancel, /padding:\s*7px 12px;/, 'fdt Cancel padding 7px 12px');
  const chips = ruleBody(navCss, /^\.btn-tool-secondary$/);
  assert.match(chips, /min-height:\s*34px;/, 'bulk chips keep min-height 34px');
  assert.match(chips, /height:\s*34px;/, 'bulk chips keep height 34px');
  assert.match(chips, /padding:\s*0 10px;/, 'bulk chips keep padding 0 10px');
  const scoped = ruleBody(navCss, /^#pendingActionsModal \.btn-tool-secondary$/);
  assert.match(scoped, /min-height:\s*34px !important;/, 'the modal-scoped 34px !important still beats the 44px floor');
  assert.match(scoped, /height:\s*34px !important;/, 'the modal-scoped height 34px !important is intact');
});

// ---------- G4 — Dark (the disclosure group) ----------

test('G4: the fdt dark rule re-tokens identically; the two pending dark rules keep their literal values (D3(b2))', () => {
  // WHY (Plan 588 D3(b2)): #475569 IS the dark value of
  // --color-slate-300 and #cbd5e1 IS the dark value of --color-slate-600,
  // so the fdt dark rule renders exactly as before. The pending dark
  // pair has NO equal dark token (nearest --dk-surface-2 #1d352e is off
  // by 1; --dk-line #2d4a40 is further off), so those two rules stay
  // literal — the acceptance's dark clause as written stays unsatisfied
  // for them, disclosed in the PR body, never claimed otherwise.
  const fdtDark = ruleBody(navCss, /^\[data-theme="dark"\] \.fdt-actions-row \.btn-secondary$/);
  assert.match(fdtDark, /border-color:\s*var\(--color-slate-300\);/, 'fdt dark border comes from --color-slate-300');
  assert.match(fdtDark, /color:\s*var\(--color-slate-600\);/, 'fdt dark text comes from --color-slate-600');
  assert.equal(resolveToken('--color-slate-300', 'dark'), '#475569', 'dark --color-slate-300 is #475569 (identical)');
  assert.equal(resolveToken('--color-slate-600', 'dark'), '#cbd5e1', 'dark --color-slate-600 is #cbd5e1 (identical)');
  for (const selRe of [
    /^\[data-theme="dark"\] \.btn-tool-secondary$/,
    /^\[data-theme="dark"\] \.btn-secondary$/,
  ]) {
    const body = ruleBody(navCss, selRe);
    assert.match(body, /background:\s*#1d362e;/, `${selRe} keeps its literal dark background #1d362e`);
    assert.match(body, /border-color:\s*#2b453b;/, `${selRe} keeps its literal dark border #2b453b`);
    assert.match(body, /color:\s*#e2e8f0;/, `${selRe} keeps its literal dark text #e2e8f0`);
    assert.ok(!/var\(--/.test(body), `${selRe} carries no var() — it is literal by decision, not token-spelled`);
  }
});

test('G4: .btn-primary has no dark rule and resolves #0e5b4d in dark via the alias (a token value, not a fallback)', () => {
  // WHY: --color-brand-600 has NO dark value (redefining it would
  // recolour its 10 other var() users app-wide — T8), so in dark the
  // pending Collect Cash button renders the light token value #0e5b4d.
  // That is the disclosed dark outcome, never "a dark value".
  const darkPrimary = cssRules(navCss).filter((r) => r.selector.includes('[data-theme="dark"]') && r.selector.includes('.btn-primary'));
  assert.equal(darkPrimary.length, 0, 'no dark rule targets .btn-primary');
  assert.equal(resolveToken('--color-brand-600', 'dark'), '#0e5b4d', '--color-brand-600 has no dark value, so it resolves #0e5b4d in dark too');
  assert.equal(resolveToken('--primary', 'dark'), '#0e5b4d', '.btn-primary resolves #0e5b4d in dark via the alias');
  // The Send WhatsApp button next to it DOES go token-bright in dark
  // (--ds-brand dark #29b88f) — the asymmetry is real and disclosed.
  assert.equal(resolveToken('--ds-brand', 'dark'), '#29b88f', '--ds-brand dark is #29b88f');
});

// ---------- G5 — Guards + completeness ----------

test('G5: ratchet baselines hold — nav.css 163 (down from 164 via #094338), styles.css 613, components.css 0', () => {
  // WHY the exact 163: D5(b) re-tokens .btn-primary:hover #094338 to
  // --color-brand-700, and #094338 occurred exactly once in nav.css.
  // Every other re-tokened hex occurs elsewhere too, so the count drops
  // by exactly one. The ratchet is a MAXIMUM (nav.css ≤164), so 163
  // holds with room to spare.
  assert.equal(distinctHex(navCss), 163, 'nav.css distinct hex is exactly 163');
  assert.ok(distinctHex(navCss) <= 164, 'nav.css distinct hex must not exceed 164');
  assert.equal(distinctHex(stylesCss), 613, 'styles.css distinct hex is exactly 613');
  assert.ok(distinctHex(stylesCss) <= 616, 'styles.css distinct hex must not exceed 616');
  assert.equal(distinctHex(componentsCss), 0, 'components.css stays hex-free');
  // #094338 survives only inside the why-comment text (comments are
  // stripped by the ratchet method above); no declaration uses it.
  const strippedNav = navCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((strippedNav.match(/#094338/g) || []).length, 0, 'no #094338 declaration remains in nav.css');
});

test('G5: parity is unchanged at 4,722/4,722 (no i18n key touched)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4722, 'EN keys');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4722, 'UR keys');
  assert.deepEqual(
    Object.keys(TRANSLATIONS.en).sort(),
    Object.keys(TRANSLATIONS.ur).sort(),
    'no key is missing from either dict',
  );
});

test('G5: .ds-btn--primary still resolves #145b4b, the base .secondary-button rule and the 44px floor are unchanged', () => {
  // The ds green (#145b4b) is NOT the pending green (#0e5b4d) — asserted
  // so a future "unify" cannot silently recolour the pending buttons.
  const dsPrimary = ruleBody(componentsCss, /^\.ds-btn--primary$/);
  assert.match(dsPrimary, /background:\s*var\(--green\);/, '.ds-btn--primary still uses --green');
  assert.equal(resolveToken('--green', 'light'), '#145b4b', '--green resolves to #145b4b, not #0e5b4d');
  // The base .secondary-button rule lives on the minified styles.css:1
  // (pinned by plan497:75–76) — byte-identical, never edited.
  assert.match(stylesCss, /\.primary-button\{border-radius:9px;min-height:40px/, 'the base button rule on styles.css:1 is unchanged');
  // The 44px floor (styles.css:923) is unchanged.
  assert.ok(stylesCss.includes('button:not([hidden]) { min-height: 44px !important; }'), 'the 44px floor is unchanged');
  // .btn-sm (587's territory) is untouched here: the class is defined
  // exactly once, in components.css, and no nav.css rule mentions it.
  assert.equal((componentsCss.match(/^\.btn-sm\s*\{/gm) || []).length, 1, '.btn-sm is still defined exactly once, in components.css');
  assert.ok(!/\.btn-sm/.test(navCss), 'nav.css carries no .btn-sm rule');
});

test('G5: the other 13 undefined vars are still undefined (KNOWN-OPEN — the acceptance covers .btn-* rules only, D2(a))', () => {
  // WHY: D2(a) fixes the 5 named vars via aliases and leaves the other
  // 13 (101 uses, all non-button modal chrome) undefined as a different
  // item. This test pins that boundary so a future plan cannot mistake
  // "still undefined" for "missed".
  const defined = new Set();
  for (const css of [tokensCss, stylesCss, componentsCss, dashboardCss, navCss]) {
    for (const { body } of cssRules(css)) {
      for (const m of body.matchAll(/--([\w-]+)\s*:/g)) defined.add(`--${m[1]}`);
    }
  }
  const stillOpen = [
    '--text-muted', '--border', '--bg-soft', '--surface-sunken',
    '--line-strong', '--bg-surface', '--surface-2', '--surface-subtle',
    '--bg-subtle', '--input-bg', '--surface-secondary', '--topbar-height',
    '--bg-hover',
  ];
  assert.equal(stillOpen.length, 13, '13 vars stay open');
  for (const name of stillOpen) {
    assert.ok(!defined.has(name), `${name} is still undefined (KNOWN-OPEN)`);
  }
});

test('G5: the D1(a) side effect is pinned as a KNOWN CHANGE — 83 of 148 repo-wide uses of the five variables recolour to the alias value', () => {
  // WHY (Plan 588 D1(a)/D2(a), disclosed in the PR body): defining the
  // five aliases in tokens.css defines the variables ONCE, for every
  // user — not just the 8 .btn-* uses. 65 of the 148 uses carry a
  // fallback identical to the alias value and render exactly as before
  // (including all 8 .btn-* uses — G2). The other 83 carry a DIFFERENT
  // fallback and recolour to the alias value in light (e.g. --text
  // #0f172a -> #334155, --border-color #e2e8f0 -> #cbd5e1, --primary
  // #0284c7 -> #0e5b4d on selected rows). In dark they resolve through
  // the dark token values where they exist (--color-slate-*) or the
  // light value where they do not (--color-brand-600). This is the
  // decided mechanism, NOT a regression — but it is a visible change
  // outside "nav.css button classes only", so it is pinned here as a
  // change, never as "unchanged". The value-preserving route would have
  // been D1(b) (8 in-place replaces); the parent decided D1(a).
  const alias = { '--primary': '#0e5b4d', '--text': '#334155', '--bg-muted': '#f1f5f9', '--border-color': '#cbd5e1', '--text-color': '#334155' };
  let same = 0;
  let diff = 0;
  const perFile = {};
  for (const [name, css] of [['tokens.css', tokensCss], ['styles.css', stylesCss], ['components.css', componentsCss], ['dashboard.css', dashboardCss], ['nav.css', navCss]]) {
    let s = 0;
    let d = 0;
    for (const m of css.matchAll(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g)) {
      if (!(m[1] in alias)) continue;
      if ((m[2] || '').trim().toLowerCase() === alias[m[1]].toLowerCase()) s += 1;
      else d += 1;
    }
    if (s + d > 0) perFile[name] = [s, d];
    same += s;
    diff += d;
  }
  assert.equal(same + diff, 148, '148 repo-wide uses of the five variables');
  assert.equal(same, 65, '65 uses carry a fallback identical to the alias value');
  assert.equal(diff, 83, '83 uses carry a different fallback and recolour');
  assert.deepEqual(perFile['nav.css'], [19, 27], 'nav.css: 19 same / 27 different');
  assert.deepEqual(perFile['styles.css'], [44, 56], 'styles.css: 44 same / 56 different');
  assert.deepEqual(perFile['dashboard.css'], [2, 0], 'dashboard.css: 2 same / 0 different');
  assert.equal(perFile['components.css'], undefined, 'components.css uses none of the five variables');
  assert.equal(perFile['tokens.css'], undefined, 'tokens.css uses none of the five variables (it defines them)');
  // Spot-checks on the three most visible recolourings.
  assert.ok(stylesCss.includes('var(--primary, #0284c7)'), 'selected rows still spell var(--primary, #0284c7) — they now render #0e5b4d');
  assert.ok(navCss.includes('var(--text-color, #0f172a)'), 'pending-card titles still spell var(--text-color, #0f172a) — they now render #334155');
  assert.ok(stylesCss.includes('var(--border-color, #e2e8f0)'), 'cards still spell var(--border-color, #e2e8f0) — they now render #cbd5e1');
});
