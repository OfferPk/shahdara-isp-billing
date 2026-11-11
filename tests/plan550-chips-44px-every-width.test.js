// Plan 550: Amount, date, filter and loose-change chips are 44px at every
// width.
// The 44px tap-target minimum for the Quick Collect chips lived only in
// the <=480px media query in components.css (Plan D). Above 480px the
// base rules applied — padding 4px 10px on the amount/date chips
// (~26px of content), 6px 12px on the filter chips (~30px),
// min-height 36px on the loose-change chips and 40px on the shop
// chips — so on a tablet or desktop, where the operator also works,
// the small chips were the odd ones out next to the 44/56px method
// chips, the 56px keypad and the 44px remwaada chips. This plan lifts
// the 44px minimum into the base rules for all six chip classes,
// reusing the media-query declarations; no new sizes, no colour change,
// no layout change on phones.
//
// DESIGN CORRECTION (verified against the 832c496b base before
// changing anything): the rendered heights were ALREADY >=44px at
// every width, because styles.css:782 carries a global top-level rule
// `button:not([hidden]) { min-height: 44px !important; }` and every
// one of these chips is a <button> element (filter/amount/date chips
// in index.html, shop chips created as buttons in
// nav-quick-collect.js:2821, loose-change chips created as buttons in
// loose-change-credit.js:107). The design read the chip rules in
// isolation and missed that rule. So this plan changes no rendered
// height: it makes each chip rule carry its own 44px guarantee, so
// the tap target no longer depends on the global button rule — if
// that rule is ever narrowed, the chips stay 44px. The 480px media
// query is left exactly as it is: tests/plan-d-mobile.test.js pins
// its four 44px rules as the <=480px guarantee, and removing them
// would force rewriting those pins for zero visual change.
// Method chips, the keypad and the remwaada chips are untouched.
// All money shown in PKR only (no money touched here).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const styles = read('styles.css');
const components = read('components.css');

const flat = (s) => s.replace(/\s+/g, ' ');

// First top-level rule for a selector: the base rule, not a :hover /
// .is-active / [data-theme] variant and not a rule inside a media
// block. The next non-space char after the selector must be "{" (so
// ".qc-date-chip" never matches ".qc-date-chips").
function baseRule(css, selector) {
  const flatCss = flat(css);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = flatCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(m, `expected a base rule for ${selector}`);
  return m[0];
}

function decl(rule, prop) {
  const m = rule.match(new RegExp(`${prop}:\\s*([^;]+);`));
  assert.ok(m, `expected ${prop} in rule ${rule.slice(0, 60)}`);
  return m[1].trim();
}

// The Plan D block is the LAST `@media (max-width: 480px)` block in
// components.css (same extraction as tests/plan-d-mobile.test.js).
function lastMediaBlock(css, query) {
  const marker = `@media (${query})`;
  const start = css.lastIndexOf(marker);
  assert.ok(start >= 0, `no ${marker} block found`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${marker} block`);
}

const planD = lastMediaBlock(components, 'max-width: 480px');

function mediaDecls(block, selector) {
  const flatBlock = flat(block);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = flatBlock.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(m, `expected ${selector} in the <=480px block`);
  return m[0];
}

// ---- Base rules carry the 44px minimum -------------------------------

test('amount chips: base rules carry min-height 44px at every width', () => {
  for (const selector of ['.quick-amount-chip', '.qab-amount-chip']) {
    const rule = baseRule(styles, selector);
    assert.equal(decl(rule, 'min-height'), '44px', `${selector} base min-height`);
    // The media-query declarations, reused: the chips centre their
    // single-line label vertically at every width now, not only <=480px.
    assert.equal(decl(rule, 'display'), 'inline-flex', `${selector} base display`);
    assert.equal(decl(rule, 'align-items'), 'center', `${selector} base align-items`);
  }
});

test('date chips: base rule carries min-height 44px at every width', () => {
  const rule = baseRule(styles, '.qc-date-chip');
  assert.equal(decl(rule, 'min-height'), '44px');
  assert.equal(decl(rule, 'display'), 'inline-flex');
  assert.equal(decl(rule, 'align-items'), 'center');
});

test('filter chips: base rule carries min-height 44px at every width', () => {
  const rule = baseRule(styles, '.quick-collect-filter-chip');
  assert.equal(decl(rule, 'min-height'), '44px');
  assert.equal(decl(rule, 'display'), 'inline-flex');
  assert.equal(decl(rule, 'align-items'), 'center');
});

test('loose-change chips: base min-height is 44px, not 36px', () => {
  const rule = baseRule(components, '.loose-change-chip');
  assert.equal(decl(rule, 'min-height'), '44px');
});

test('shop chips: base min-height is 44px, not 40px', () => {
  const rule = baseRule(components, '.qc-shop-chip');
  assert.equal(decl(rule, 'min-height'), '44px');
});

// ---- Nothing else about the chips changed ----------------------------

test('chip rules keep their old sizes and colours', () => {
  // No new sizes: padding / font-size / radius are exactly as before.
  assert.equal(decl(baseRule(styles, '.quick-amount-chip'), 'padding'), '4px 10px');
  assert.equal(decl(baseRule(styles, '.quick-amount-chip'), 'font-size'), '0.78rem');
  assert.equal(decl(baseRule(styles, '.qab-amount-chip'), 'padding'), '4px 10px');
  assert.equal(decl(baseRule(styles, '.qc-date-chip'), 'padding'), '4px 10px');
  // QC Cash Modal Overhaul: the filter-chip padding moves 6px 12px →
  // 6px 10px (with the 12.5px font) so Pending / High ≥ 2k / All fit
  // on one row at 360px. Min-height stays 44px; every other chip
  // rule keeps its old size.
  assert.equal(decl(baseRule(styles, '.quick-collect-filter-chip'), 'padding'), '6px 10px');
  assert.equal(decl(baseRule(components, '.loose-change-chip'), 'padding'), '4px 10px');
  assert.equal(decl(baseRule(components, '.qc-shop-chip'), 'padding'), '7px 12px');
  assert.equal(decl(baseRule(components, '.qc-shop-chip'), 'font-size'), '13px');
  // No new hex in any touched rule. The date/loose-change/shop rules
  // are token-only already; the filter rule carries hex only as
  // var() fallbacks and the amount rules carry three pre-existing
  // hexes — pin those sets exactly, so a new hex here is caught.
  // (The design-tokens ratchet is the global check.)
  for (const [css, selector] of [
    [styles, '.qc-date-chip'],
    [components, '.loose-change-chip'],
    [components, '.qc-shop-chip'],
  ]) {
    assert.doesNotMatch(baseRule(css, selector), /#[0-9a-fA-F]{3,8}\b/, `${selector} adds no hex`);
  }
  for (const [selector, expected] of [
    ['.quick-amount-chip', ['#334155', '#cbd5e1', '#f1f5f9']],
    ['.qab-amount-chip', ['#334155', '#cbd5e1', '#f1f5f9']],
    ['.quick-collect-filter-chip', ['#475569', '#cbd5e1', '#f8fafc']],
  ]) {
    const rule = baseRule(styles, selector);
    const hexes = new Set(rule.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
    assert.deepEqual([...hexes].sort(), expected, `${selector} hex set unchanged`);
  }
});

test('Plan 544 date-chip active styling is untouched (size only here)', () => {
  const rule = baseRule(styles, '.quick-method-chip.is-active, .qc-date-chip.is-active');
  assert.match(rule, /background:\s*var\(--primary/);
  assert.match(rule, /color:\s*#ffffff/);
});

test('Plan 528 amount group labels are untouched', () => {
  assert.ok(components.includes('.qc-amount-group-label'), 'group-label rule still exists');
  assert.ok(components.includes('.qc-shop-label, .qc-amount-group-label'), 'group-label rule unchanged');
});

// ---- The already-44px controls are untouched -------------------------

test('method chips, keypad and remwaada chips keep their heights', () => {
  assert.equal(decl(baseRule(styles, '.quick-method-chip'), 'min-height'), '44px');
  assert.equal(decl(baseRule(styles, '.quick-method-chip.bwb-big'), 'min-height'), '56px');
  assert.equal(decl(baseRule(styles, '.kpd-key'), 'min-height'), '56px');
  assert.equal(decl(baseRule(components, '.qc-remwaada-chip'), 'min-height'), '44px');
});

// ---- The <=480px guarantee stays where Plan D pinned it --------------

test('Plan D block still carries the four 44px rules (kept, not removed)', () => {
  for (const selector of [
    '.quick-collect-filter-chip',
    '.quick-amount-chip',
    '.qc-date-chip',
    '.loose-change-chip',
  ]) {
    assert.equal(decl(mediaDecls(planD, selector), 'min-height'), '44px', `${selector} in Plan D block`);
  }
});

// ---- The finding: the global button rule already guaranteed 44px -----

test('global button rule still guarantees 44px for every button (the finding)', () => {
  // styles.css:782, top level: every visible button already measured
  // >=44px before this plan, which is why this plan changes no
  // rendered height. Pinned so a future narrowing of that rule is
  // noticed — the chip rules above are now the chips' own guarantee.
  assert.match(styles, /button:not\(\[hidden\]\)\s*\{\s*min-height:\s*44px\s*!important;\s*\}/);
  assert.match(styles, /button, input:not\(\[type="hidden"\]\), select, textarea\s*\{\s*min-height:\s*44px;\s*\}/);
});
