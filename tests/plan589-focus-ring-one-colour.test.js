// Plan 589 — One focus-ring colour everywhere (D1(c) --green, D2(b) union,
// D3(a) existing dark value, D4(b) 3px/2px, D5(a) recorded exceptions,
// D6(a) dead baselines deleted, D7(a) this file, D8(a) browser sample).
// Rule-aware assertions only (comment-stripped, selector/body split with
// @media recursion — the repro-589/probe-focus.py method). A raw `outline:`
// grep overcounts (it catches `outline: none`, non-focus rules and comment
// mentions) and a `:focus-visible`-only grep undercounts (it misses the
// `:focus` input rules) — T2, so no test here asserts by substring grep.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

// ---- rule-aware CSS parsing (mirrors repro-589.mjs / probe-focus.py) ----
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
    else if (sel && !sel.startsWith('@')) out.push({ sel, body });
    i = k;
  }
  return out;
}
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const VAR_RE = /var\(--[a-z0-9-]+(?:\s*,\s*[^)]+)?\)/;
function outlineInfo(body) {
  const m = body.match(/outline\s*:\s*([^;!}]+)(!important)?\s*;/);
  const oc = body.match(/outline-color\s*:\s*([^;!}]+)(!important)?\s*;/);
  const oo = body.match(/outline-offset\s*:\s*([^;!}]+)/);
  if (!m && !oc) return null;
  const info = {};
  if (m) {
    const val = m[1].trim();
    info.outline = val + (m[2] ? ' !important' : '');
    const w = val.match(/(\d+(?:\.\d+)?px)/);
    const c = val.match(HEX_RE) || val.match(VAR_RE);
    info.width = w ? w[1] : '?';
    info.colour = c ? c[0] : (val.includes('none') ? 'none' : '?');
  }
  if (oc) info.outlineColor = oc[1].trim() + (oc[2] ? ' !important' : '');
  if (oo) info.outlineOffset = oo[1].trim();
  return info;
}
function focusRules(file) {
  const text = stripComments(read(file));
  return rulesOf(text).filter((r) => r.sel.includes(':focus'))
    .map((r) => ({ sel: r.sel.replace(/\s+/g, ' ').trim(), info: outlineInfo(r.body), file }));
}
const CSS_FILES = ['styles.css', 'nav.css', 'components.css', 'dashboard.css',
  'bulk-collect.css', 'customer-import.css', 'new-customer-tag.css',
  'ui-feedback.css', 'payments-list.css', 'dark-contrast.css', 'screen-router.css'];
const allFocus = CSS_FILES.flatMap(focusRules);
const threePx = (list) => list.filter((r) => r.info && r.info.width === '3px');
const tally = (list) => {
  const c = {};
  for (const r of list) {
    if (r.info?.colour && r.info.colour !== 'none') c[r.info.colour] = (c[r.info.colour] || 0) + 1;
  }
  return c;
};
function tokenDefs(file) {
  // Body-only definition sweep: :root / [data-theme="dark"] rule bodies only.
  // A naive `--name:` grep would falsely "define" --primary from a selector
  // such as `.ds-btn--primary:hover` — the T3 trap from Plan 588.
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
function findRule(sel, file) {
  const hits = allFocus.filter((r) => r.file === file && r.sel === sel);
  assert.equal(hits.length, 1, `expected exactly one focus rule for ${sel} in ${file}, found ${hits.length}`);
  return hits[0];
}
function findContaining(selFragment, file) {
  // For GROUP selectors (one rule, several selectors): the fragment must
  // match exactly one rule. A bare `includes` on a short fragment such as
  // ':focus-visible' would match 30 rules — never use it for those.
  const hits = allFocus.filter((r) => r.file === file && r.sel.includes(selFragment));
  assert.equal(hits.length, 1, `expected exactly one focus rule containing ${selFragment} in ${file}, found ${hits.length}`);
  return hits[0];
}
const GREEN = 'var(--green)';

// ================= G1 — Counts (rule-aware) =================
test('G1a styles.css 3px focus tally is the post-589 tally (21 green, 19 exception)', () => {
  // Home Tab M3 polish (user decision 2026-11-22): the new grouped
  // Pending row button gains a keyboard-focus ring
  // (.home-ops-row-btn:focus-visible, 3px var(--green), offset 2px),
  // so the styles.css green tally moves 20 → 21; the 19 exceptions
  // are unchanged.
  const got = tally(threePx(focusRules('styles.css')));
  assert.deepEqual(got, {
    'var(--green)': 21, '#cce9dd': 8, '#397b5c': 6, 'var(--line)': 2,
    '#bfe3d5': 1, '#80b9a0': 1, '#9acbad': 1,
  });
  // The baseline blue and the dead-baseline colours are gone from the tally.
  for (const gone of ['#2563eb', '#0b624b', '#6caa91', '#97d7bd', '#16745a']) {
    assert.ok(!(gone in got), `${gone} must not occur in any styles.css 3px focus rule`);
  }
});

test('G1b repo-wide 3px tally: 79 rules, 48 green, 12 distinct colours', () => {
  const got = tally(threePx(allFocus));
  assert.equal(Object.values(got).reduce((a, b) => a + b, 0), 79);
  assert.equal(got['var(--green)'], 48);
  assert.equal(Object.keys(got).length, 12);
  // Every remaining 2px focus rule is a named D5(a)/D2(b) exception.
  const twoPx = allFocus.filter((r) => r.info && r.info.width === '2px');
  assert.equal(twoPx.length, 5);
  const twoPxSels = twoPx.map((r) => r.sel).sort();
  assert.ok(twoPxSels.some((s) => s.includes('.reminder-textarea:focus')));
  assert.ok(twoPxSels.some((s) => s.includes('.qos-amount-value:focus')));
  assert.ok(twoPxSels.some((s) => s.includes('.qos-combobox-input:focus')));
  assert.ok(twoPxSels.some((s) => s.includes('th[data-sort-expense]:focus-visible')));
  assert.ok(twoPxSels.some((s) => s.includes('.customer-billing-badge:focus-visible')));
});

test('G1c the counter is rule-aware: comments and non-focus rules do not count (T2)', () => {
  // A substring grep would count 3 `#cce9dd` here; the rule-aware counter
  // must count exactly 1 (the real :focus-visible rule). The comment and
  // the non-focus rule are decoys a grep cannot tell apart.
  const snippet = '/* a comment mentioning #cce9dd must not count */\n'
    + '.decoy-box { border-color: #cce9dd; }\n'
    + '.real-control:focus-visible { outline: 3px solid #cce9dd; outline-offset: 2px; }\n';
  const counted = tally(threePx(rulesOf(stripComments(snippet))
    .filter((r) => r.sel.includes(':focus'))
    .map((r) => ({ info: outlineInfo(r.body) }))));
  assert.deepEqual(counted, { '#cce9dd': 1 });
});

// ================= G2 — Token + resolution =================
test('G2a --green resolves light #145b4b / dark #29b88f and HAS a dark value', () => {
  const defs = tokenDefs('tokens.css');
  assert.equal(resolveToken(defs, '--green', 'light'), '#145b4b');
  assert.equal(resolveToken(defs, '--green', 'dark'), '#29b88f');
  assert.notEqual(resolveToken(defs, '--green', 'dark'), resolveToken(defs, '--green', 'light'),
    'a token with no dark value fails this test by construction (D3 trap)');
  // The spec\'s example range has no dark value and stays unused for focus.
  assert.equal(resolveToken(defs, '--color-brand-600', 'dark'), '#0e5b4d');
  assert.equal(resolveToken(defs, '--color-brand-700', 'dark'), '#094338');
  assert.ok(!allFocus.some((r) => (r.info?.outline || '').includes('--color-brand-600')
    || (r.info?.outline || '').includes('--color-brand-700')),
  'no focus rule uses --color-brand-600/--color-brand-700 by name');
});

test('G2b no in-scope focus rule carries a literal hex or a fallback hex', () => {
  // The new-customer-tag search input (.nct-search-input, color-mix 35%
  // at offset 1px) is one of the 48 var(--green) 3px rules — a RECORDED
  // EXCEPTION (D2(b): import/onboarding stays), not an in-scope rule, so
  // it is excluded here and asserted as an exception in G5d's file note.
  // (Home Tab M3 polish, user decision 2026-11-22: the new
  // .home-ops-row-btn:focus-visible ring is the 48th green rule and is
  // in-scope, so the count below moves 46 → 47.)
  const inScope = allFocus.filter((r) => r.info && r.info.width === '3px' && r.info.colour === GREEN
    && !(r.file === 'new-customer-tag.css' && r.sel.includes('.nct-search-input')));
  assert.equal(inScope.length, 47);
  for (const r of inScope) {
    assert.ok(!r.info.outline.includes('#'),
      `${r.file} ${r.sel} carries a literal hex: ${r.info.outline}`);
    assert.ok(!/var\(--green\s*,/.test(r.info.outline),
      `${r.file} ${r.sel} keeps a dead #0e5b4d fallback: ${r.info.outline}`);
    assert.equal(r.info.outlineOffset, '2px', `${r.file} ${r.sel} offset must be 2px`);
  }
});

test('G2c the dead baselines are gone; one global baseline + one dark baseline remain', () => {
  const dead = allFocus.filter((r) => r.sel === '*:focus-visible');
  assert.equal(dead.length, 0, 'both dead *:focus-visible baselines (:543 #16745a, :841 #0b624b) must be deleted (D6(a), T4)');
  const live = findRule(':focus-visible', 'styles.css');
  assert.ok(live.sel === ':focus-visible', 'the live baseline selector must stay bare :focus-visible');
  assert.equal(live.info.outline, '3px solid var(--green) !important');
  assert.equal(live.info.outlineOffset, '2px');
  const dark = allFocus.filter((r) => r.sel === '[data-theme="dark"] :focus-visible');
  assert.equal(dark.length, 1);
  assert.equal(dark[0].info.outlineColor, 'var(--green) !important');
  // The least visible ring in the app is gone: #1a5845 occurs nowhere.
  assert.ok(!stripComments(read('styles.css')).includes('#1a5845'),
    'the dark input ring #1a5845 (1.94:1) must not survive anywhere');
  const darkInput = findContaining('[data-theme="dark"] input:focus', 'styles.css');
  assert.equal(darkInput.info.outlineColor, 'var(--green) !important');
});

// ================= G3 — Sampled controls =================
test('G3a dashboard controls resolve to the single colour', () => {
  for (const sel of ['.quick-action-tile:focus-visible', '.home-primary-btn:focus-visible',
    '.chart-range-btn:focus-visible', '.chart-action-link:focus-visible',
    '.donut-slice:focus-visible', '.cohort-card:focus-visible', '.heatmap-area-row:focus-visible']) {
    const r = findRule(sel, 'dashboard.css');
    assert.equal(r.info.outline, '3px solid var(--green)', sel);
    assert.equal(r.info.outlineOffset, '2px', sel);
  }
  const primary = findContaining('.primary-button:focus-visible', 'styles.css');
  assert.equal(primary.info.outline, '3px solid var(--green)');
  assert.equal(primary.info.outlineOffset, '2px');
});

test('G3b global search: input :focus and :focus-visible resolve to the same colour', () => {
  const input = findRule('.global-search-control input:focus', 'styles.css');
  assert.equal(input.info.outline, '3px solid var(--green)');
  assert.equal(input.info.outlineOffset, '2px');
  const option = findRule('.global-result-option:focus-visible', 'styles.css');
  assert.equal(option.info.outline, '3px solid var(--green) !important');
  assert.equal(option.info.outlineOffset, '2px');
  // The mouse/keyboard split is gone: the :focus rule and the !important
  // :focus-visible baseline now resolve to the same token.
  const baseline = findRule(':focus-visible', 'styles.css');
  assert.equal(baseline.info.outline, '3px solid var(--green) !important');
});

test('G3c customer list + ledger controls resolve to the single colour', () => {
  const cases = [
    ['.customer-filter-month select:focus-visible', 'styles.css'],
    ['.customer-list-search-control input:focus-visible', 'styles.css'],
    ['.customer-card-clear-dues:focus-visible', 'styles.css'],
    ['.customer-roster-table thead th[data-sort-cust]:focus-visible', 'styles.css'],
    ['.transaction-filters input:focus', 'styles.css', true],
    ['.transaction-filters select:focus', 'styles.css'],
    ['.tx-search-row input[type="search"]:focus', 'styles.css'],
    ['.tx-compact > button.tx-row:focus-visible', 'payments-list.css'],
    ['.daily-closing-receipts-wrap th[data-sort-dcr]:focus', 'styles.css'],
    ['.sortable-th:focus-visible', 'styles.css'],
  ];
  for (const [sel, file, group] of cases) {
    const r = group ? findContaining(sel, file) : findRule(sel, file);
    assert.equal(r.info.outline, '3px solid var(--green)', `${file} ${sel}`);
    assert.equal(r.info.outlineOffset, '2px', `${file} ${sel}`);
  }
  const darkDcr = findRule('[data-theme="dark"] .daily-closing-receipts-wrap th[data-sort-dcr]:focus', 'styles.css');
  assert.equal(darkDcr.info.outlineColor, 'var(--green)');
});

test('G3d nav buttons unify; QC input + profile tab stay named exceptions', () => {
  const group = allFocus.filter((r) => r.file === 'nav.css'
    && r.sel.includes('.view-nav-button:focus-visible') && !r.sel.includes('[data-theme'));
  assert.equal(group.length, 1);
  assert.equal(group[0].info.outline, '3px solid var(--green) !important');
  const darkGroup = allFocus.filter((r) => r.file === 'nav.css'
    && r.sel.includes('[data-theme="dark"] .view-nav-button:focus-visible'));
  assert.equal(darkGroup.length, 1);
  assert.equal(darkGroup[0].info.outline, '3px solid var(--green) !important');
  // QC modal input: RECORDED EXCEPTION (D2(b)/D5(a)) — pale mint stays.
  const qc = findContaining('#quickCollectModal .qc-input:focus-visible', 'styles.css');
  assert.equal(qc.info.outline, '3px solid #cce9dd !important');
  // Profile tab: RECORDED EXCEPTION (D2(b)) — #397b5c stays, and the
  // customer-profile-ui.test.js:447 format pin (no-space `outline:3px solid`,
  // exact selector list) is preserved by non-touch.
  assert.ok(read('styles.css').includes('.profile-tab-button:focus-visible,.profile-action-group button:focus-visible,.back-button:focus-visible{outline:3px solid #397b5c;outline-offset:2px}'),
    'the :1859 profile-tab rule keeps its pinned text shape');
});

// ================= G4 — Dark + visibility =================
test('G4a the single colour clears 3:1 in both themes (computed, not asserted)', () => {
  const defs = tokenDefs('tokens.css');
  const light = resolveToken(defs, '--green', 'light');
  const dark = resolveToken(defs, '--green', 'dark');
  assert.equal(light, '#145b4b');
  assert.equal(dark, '#29b88f');
  assert.ok(contrast(light, '#ffffff') >= 3, `light ${light} vs white: ${contrast(light, '#ffffff').toFixed(2)}:1`);
  assert.ok(contrast(dark, '#14241f') >= 3, `dark ${dark} vs dark surface: ${contrast(dark, '#14241f').toFixed(2)}:1`);
  // The spec's example range fails the dark half by measurement.
  assert.ok(contrast('#0e5b4d', '#14241f') < 3, 'brand-600 dark 2.01:1 fails the bar');
  assert.ok(contrast('#094338', '#14241f') < 3, 'brand-700 dark 1.44:1 fails the bar');
});

test('G4b the D5(a) exceptions keep their own rings, each named', () => {
  // White close-button / help-info rings on dark headers.
  const closeBtn = findContaining('.close-button:focus-visible', 'components.css');
  assert.equal(closeBtn.info.outline, '3px solid var(--color-neutral-0)');
  const helpInfo = findRule('.help-info-btn:focus-visible', 'components.css');
  assert.equal(helpInfo.info.outline, '3px solid var(--color-neutral-0)');
  // The payment-form DS ring is a box-shadow, not an outline (different mechanism).
  assert.ok(read('styles.css').includes('box-shadow: 0 0 0 3px var(--ds-focus-ring)'),
    'the DS box-shadow ring survives (profile-payment-form:164 pins it)');
  // Qos emerald rings (qc-modal-fix:239 pins them emerald, not blue).
  assert.equal(findRule('.qos-amount-value:focus', 'styles.css').info.outline, '2px solid var(--color-emerald)');
  assert.equal(findRule('.qos-combobox-input:focus', 'styles.css').info.outline, '2px solid var(--color-emerald)');
  // QC filter chip keeps --ds-brand (qc-cash-modal-overhaul:212 pins it).
  const chip = findRule('#quickCollectModal .quick-collect-filter-chip:focus-visible', 'styles.css');
  assert.equal(chip.info.outlineColor, 'var(--ds-brand) !important');
  // Billing badge keeps the only blue-accent ring.
  assert.equal(findRule('.customer-billing-badge:focus-visible', 'styles.css').info.outline,
    '2px solid var(--accent, #0284c7)');
});

test('G4c dark-contrast.css still carries no focus rule (Plan 590 owns it)', () => {
  assert.equal(focusRules('dark-contrast.css').length, 0);
  assert.ok(!read('dark-contrast.css').includes('outline'));
});

// ================= G5 — Guards + completeness =================
test('G5a ratchet holds with the exact post-fix counts recorded', () => {
  const distinctHex = (f) => new Set((stripComments(read(f))
    .match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).map((h) => h.toLowerCase())).size;
  assert.ok(distinctHex('styles.css') <= 616, 'styles.css ratchet max 616');
  // 605 -> 607 with the Customers List Cards polish (D2): exactly the two
  // spec-literal name colours #1E3A5F (navy) + #9f1239 (rose-800).
  // (This ratchet lowercases, so its base count is 605, not the 608 the
  // case-sensitive ratchets pin — 3 case-duplicate pairs: #0e5b4d, #14211e,
  // #3fbf9f. The +2 delta is the same either way.)
  assert.equal(distinctHex('styles.css'), 607,
    'styles.css 612 -> 607: #16745a, #0b624b, #6caa91, #97d7bd, #1a5845 leave with the fix');
  assert.ok(distinctHex('nav.css') <= 164, 'nav.css ratchet max 164');
  assert.equal(distinctHex('nav.css'), 163, 'nav.css stays 163 (588 dropped it from 164)');
  assert.equal(distinctHex('payments-list.css'), 9, 'payments-list 10 -> 9: #1f7a5a leaves');
  assert.equal(distinctHex('components.css'), 0, 'components.css stays hex-free');
});

test('G5b parity unchanged at 4,722/4,722 — no i18n key touched', () => {
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR. The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5234);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5234);
});

test('G5c the baseline + QC comments tell the truth about the change', () => {
  const styles = read('styles.css');
  assert.ok(styles.includes('one colour, var(--green) (light #145b4b'),
    'the Issue-229 baseline comment names the new colour');
  assert.ok(styles.includes('RECORDED\n   EXCEPTION (D2(b)/D5(a): the QC modal stays on its own ring)'),
    'the QC modal comment records the exception instead of the old split');
  assert.ok(styles.includes('RECORDED\n   EXCEPTION (Plan 589 D5(a))'),
    'the QC chip comment records the exception');
  assert.ok(!styles.includes('the global\n   :focus-visible baseline (Issue 229) is NOT changed.'),
    'no QC comment may still claim the baseline is NOT changed');
  assert.ok(!styles.includes('The global baseline\n   is NOT changed;'),
    'no QC comment may still claim the baseline is NOT changed (2nd form)');
});

test('G5d customer-import.css focus rules are covered (no test read this file before)', () => {
  const rules = focusRules('customer-import.css');
  assert.equal(rules.length, 5);
  const bySel = (frag) => rules.find((r) => r.sel.includes(frag));
  assert.equal(bySel('.ci-open-btn').info.outline, '3px solid var(--color-info-strong)');
  assert.equal(bySel('.ci-text').info.outline,
    '3px solid color-mix(in srgb, var(--green, #0e5b4d) 30%, transparent)');
  assert.equal(bySel('.ci-file').info.outline, '3px solid var(--color-info-strong)');
  assert.equal(bySel('.ci-f input').info.outline,
    '3px solid color-mix(in srgb, var(--green, #0e5b4d) 30%, transparent)');
  assert.equal(bySel('.bog-f select').info.outline,
    '3px solid color-mix(in srgb, var(--green, #0e5b4d) 30%, transparent)');
  // Import stays a recorded exception (D2(b)) — asserted, not unified.
});
