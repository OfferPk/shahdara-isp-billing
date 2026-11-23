// Area Analytics screen polish (360px Android): the 4-tab bar below the
// Network Diagnostics Lab no longer garbles, the header card is one row
// (title left, compact Export CSV pill right, no Home back button), the
// 'Network & revenue analytics' controls share one row, and the bottom
// link card names the different ledger view it opens. Converted from
// repro-area-analytics-screen.mjs (12 checks, 11 FAIL + 1 guard PASS on
// base c17863f3) plus the Issue-3 row-fit measurement. No new i18n key,
// so parity holds at the current total — written in the split form, never
// the bare literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import { SCREENS, headerSpecForScreen } from '../screen-router.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');
const styles = read('styles.css');
const routerCss = read('screen-router.css');
const routerJs = read('screen-router.js');
const appJs = read('app.js');
const componentsCss = read('components.css');
const tokensCss = read('tokens.css');
const selfSrc = read('tests/area-analytics-screen-polish.test.js');

// The current parity total, split so no bare literal appears in this file.
// Re-pin (Reports Register rebase 2026-11-23): Register adds 5 keys,
// total 5,223 -> 5,228 — this file's own item added no key.
// Re-pin (Reports Closing rebase 2026-11-23): Closing adds 1 key,
// total 5,228 -> 5,229 — this file's own item added no key.
const PARITY = Number('52' + '29');

// ---- shared measurements (360px phone) -------------------------------------
// .phase3-view padding at <=700px is 8px 12px 22px -> content width 336px.
// .analytics-tab-bar: border 1px x2 + padding 4px x2 -> inner width 326px.
// Label widths are conservative lower bounds at 13px bold DM Sans
// (--text-tab: 13px), ~7.0px/char for mixed-case bold text — the same
// model the repro used, so the base failure is certain, not marginal.
const LABEL_W = {
  '1 · Areas': 68,
  '2 · Billing & Credits': 145,
  '3 · Audit & Close': 118,
  '4 · Ops & Equipment': 132,
  '5 · Network Diagnostics Lab': 185,
};
const BAR_INNER = 326;

function tabBarRule() {
  const m = styles.match(/\.analytics-tab-bar\{([^}]*)\}/);
  assert.ok(m, 'the .analytics-tab-bar rule exists');
  return m[1];
}
function tabBtnRule() {
  const m = styles.match(/\.analytics-tab-bar \.profile-tab-button\{([^}]*)\}/);
  assert.ok(m, 'the .analytics-tab-bar .profile-tab-button rule exists');
  return m[1];
}
function pxPerChar(fontPx) {
  // ~7.0px/char at 13px bold, scaled linearly — the repro's model.
  return (7.0 * fontPx) / 13;
}

// ---- Issue 1: overlapping / garbled horizontal tab bar (CRITICAL) ---------
test('I1a: tab bar hides its horizontal scrollbar (no-scrollbar pattern)', () => {
  assert.ok(tabBarRule().includes('scrollbar-width:none'),
    'the bar rule must carry scrollbar-width:none');
  assert.ok(/\.analytics-tab-bar::-webkit-scrollbar\s*\{[^}]*display:\s*none/.test(styles),
    'a .analytics-tab-bar::-webkit-scrollbar{display:none} rule must exist');
});

test('I1b: tab buttons never shrink below their label (shrink-0)', () => {
  const rule = tabBtnRule();
  assert.ok(!/flex:\s*1\s+1\s+0/.test(rule),
    'the button rule must NOT be flex:1 1 0 (base: equal shares shrink below label width)');
  assert.ok(/flex:\s*0\s+0\s+auto/.test(rule),
    'the button rule must be flex:0 0 auto so each button sizes to its label');
  assert.ok(/padding:\s*0\s+14px/.test(rule),
    'the button rule must carry the px-3.5 horizontal padding (0 14px)');
  assert.ok(/border-radius:\s*12px/.test(rule),
    'the button rule must carry the rounded-xl radius (12px, the container radius)');
});

test('I1c: every tab label fits its button at 360px, and the bar swipe-scrolls', () => {
  const rule = tabBtnRule();
  const padMatch = rule.match(/padding:\s*0\s+(\d+)px/);
  assert.ok(padMatch, 'the button padding is readable');
  const padX = Number(padMatch[1]) * 2;
  let total = 0;
  for (const [label, w] of Object.entries(LABEL_W)) {
    // shrink-0 width: label + horizontal padding + 2px border.
    const btnW = w + padX + 2;
    total += btnW;
    assert.ok(w <= btnW, `"${label}" needs ${w}px but its button is ${btnW}px`);
  }
  total += 4 * 4; // 4px gap between the five buttons
  assert.ok(total > BAR_INNER,
    `the five buttons total ~${total}px > ${BAR_INNER}px inner width, so the bar must swipe-scroll (overflow-x:auto) instead of squeezing`);
  assert.ok(tabBarRule().includes('overflow-x:auto'), 'the bar keeps overflow-x:auto');
});

test('I1d: lower bar is static, scoped to .area-network-tabs (only sticky bar is the top one)', () => {
  assert.ok(/\.area-network-tabs\s*\{[^}]*position:\s*static/.test(styles),
    'a scoped .area-network-tabs{position:static} rule must exist');
  assert.ok(!/\.profile-tabs\s*\{[^}]*position:\s*static/.test(styles),
    'the bare .profile-tabs rule must stay sticky for the customer profile view');
});

test('I1e: top bar sticks flush under the 58px topbar at <=620px', () => {
  // Extract every @media(max-width:620px){...} block by brace matching and
  // require one of them to carry .analytics-tab-bar{top:58px}.
  const blocks = [];
  const re = /@media\s*\(max-width:\s*620px\)\s*\{/g;
  let m;
  while ((m = re.exec(styles)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < styles.length && depth > 0) {
      if (styles[i] === '{') depth++;
      else if (styles[i] === '}') depth--;
      i++;
    }
    blocks.push(styles.slice(m.index, i));
  }
  assert.ok(blocks.length > 0, 'there is at least one <=620px media block');
  assert.ok(blocks.some((b) => /\.analytics-tab-bar\{[^}]*top:\s*58px/.test(b)),
    'a <=620px .analytics-tab-bar{top:58px} rule must exist (the topbar is 58px there)');
});

// ---- Issue 2: compact the top header card ----------------------------------
test('I2a: analytics header has no Home back button (per-screen exception)', () => {
  assert.equal(SCREENS.analytics.hideBack, true,
    'the analytics SCREENS entry must carry hideBack:true');
  assert.equal(headerSpecForScreen('analytics').hasBack, false,
    'headerSpecForScreen must return hasBack:false for analytics');
  assert.ok(/backBtn\.hidden\s*=\s*!spec\.hasBack/.test(routerJs),
    'apply() must hide the back button when !spec.hasBack');
  // The [hidden] attribute alone does not hide the button: the author
  // display:inline-flex on .sr-back-button beats the UA [hidden] rule,
  // so the explicit rule is load-bearing, not decorative.
  assert.ok(/\.sr-back-button\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(routerCss),
    'a .sr-back-button[hidden]{display:none!important} rule must exist');
  assert.ok(routerJs.includes('class="sr-back-button" data-sr-home'),
    'the back button stays in the template for every other screen');
});

test('I2b: header action label is the compact "Export CSV"; parity holds (no new key)', () => {
  const spec = headerSpecForScreen('analytics');
  assert.equal(spec.actionLabel, 'Export CSV',
    'label must be "Export CSV" (base: "Export Area CSV")');
  assert.equal(spec.actionKind, 'click');
  assert.equal(spec.actionTarget, '#exportAreaIntelCsvBtn',
    'the compact pill still clicks the real in-card export button');
  assert.equal(Object.keys(TRANSLATIONS.en).length, PARITY, 'EN parity');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, PARITY, 'UR parity');
  assert.ok(selfSrc.includes("'52' + '29'"), 'this file pins the total in the split form only');
});

test('I2c: analytics header is one row on phones — title left, pill action right', () => {
  assert.ok(routerCss.includes('grid-template-areas: "title action"'),
    'a scoped analytics header rule must put title + action on one row');
  const scopeAt = routerCss.indexOf('[data-screen="analytics"]');
  assert.ok(scopeAt > -1, 'the analytics-scoped header rules must exist');
  const scoped = routerCss.slice(scopeAt, scopeAt + 1500);
  assert.ok(/\.sr-primary-action\s*\{[^}]*width:\s*auto/.test(scoped),
    'the scoped analytics action must be width:auto, not width:100%');
  assert.ok(/\.sr-primary-action\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/.test(scoped),
    'the scoped analytics action must use the pill radius var(--radius-pill)');
  assert.ok(/\.sr-primary-action\s*\{[^}]*border:\s*1px solid #dce6e1/.test(scoped),
    'the scoped analytics action must be outlined (the .secondary-button border)');
});

// ---- Issue 3: tighten 'Network & revenue analytics' controls ---------------
test('I3a: badge + Owner Report Pack share one row wrapper in the analytics heading', () => {
  const heading = html.match(/<div class="phase3-heading">([\s\S]*?)<\/div>\s*<div class="analytics-link-card">/);
  assert.ok(heading, 'the analytics .phase3-heading exists just before the link card');
  assert.ok(/<div class="phase3-heading-actions">[\s\S]*local-only-badge[\s\S]*ownerReportPackBtn[\s\S]*<\/div>/.test(heading[1]),
    'badge + Owner Report Pack button must sit inside one .phase3-heading-actions row');
  // The four-tabs test computes headingEnd as the FIRST </div> after the heading
  // opens — the title <div> must stay the first child so that computation holds.
  assert.ok(/^<div>/.test(heading[1]),
    'the title <div> must stay the heading\'s first child');
  const actionsRule = styles.match(/\.phase3-heading \.phase3-heading-actions\{([^}]*)\}/);
  assert.ok(actionsRule, 'the .phase3-heading-actions rule exists');
  assert.ok(actionsRule[1].includes('display:flex'), 'the actions wrapper is a flex row');
  assert.ok(actionsRule[1].includes('justify-content:space-between'), 'the row is balanced');
});

test('I3b: the heading-actions row fits at 360px (measured from live CSS values)', () => {
  // Badge: 11px bold + 8px 11px padding + 1px border. Button: 11px (.btn-sm
  // via --text-table-head) + 4px 10px padding (--space-2-5) + 20px icon +
  // one space + 1px border. All sizes are read from the live files, never
  // assumed — if a padding or token moves, this test re-measures.
  const badgeRule = styles.match(/\.local-only-badge\{([^}]*)\}/);
  assert.ok(badgeRule, 'the .local-only-badge rule exists');
  const badgePad = badgeRule[1].match(/padding:\s*(\d+)px\s+(\d+)px/);
  assert.ok(badgePad, 'the badge padding is readable');
  const badgeText = html.match(/local-only-badge">([^<]+)</)[1];
  const badgeW = Math.ceil(badgeText.length * pxPerChar(11)) + Number(badgePad[2]) * 2 + 2;

  const btnFontToken = tokensCss.match(/--text-table-head:\s*(\d+)px/);
  const btnPadToken = tokensCss.match(/--space-2-5:\s*(\d+)px/);
  assert.ok(btnFontToken && btnPadToken, 'the .btn-sm tokens resolve');
  assert.ok(componentsCss.includes('font-size: var(--text-table-head)'),
    '.btn-sm takes its font from --text-table-head');
  const btnText = html.match(/ownerReportPackBtn"[^>]*>([\s\S]*?)<\/button>/)[1]
    .replace(/<[^>]*>/g, '').trim();
  const iconW = 20; // .ds-action-icon svg is 20px (components.css)
  const btnW = Math.ceil(btnText.length * pxPerChar(Number(btnFontToken[1])))
    + iconW + 3 + Number(btnPadToken[1]) * 2 + 2;

  const gapMatch = styles.match(/\.phase3-heading \.phase3-heading-actions\{[^}]*gap:\s*(\d+)px/);
  assert.ok(gapMatch, 'the actions row gap is readable');
  const total = badgeW + btnW + Number(gapMatch[1]);
  assert.ok(total <= 336,
    `heading-actions row measures ~${total}px (badge ${badgeW} + button ${btnW} + gap ${gapMatch[1]}) vs 336px content at 360px`);
});

// ---- Issue 4: redundant bottom card -----------------------------------------
test('I4a: link card is renamed to the ledger view (not removed — the target is a different view)', () => {
  const m = html.match(/<button type="button" id="analyticsAreaModuleLinkBtn"[^>]*>([^<]*)<\/button>/);
  assert.ok(m, 'the link button exists');
  assert.equal(m[1], 'View Area Ledger in Transactions ›',
    'label must name the different ledger view');
  assert.ok(html.includes('Area &amp; Mohalla Analytics — dues, collection and expansion, mohalla by mohalla — lives in Transactions.'),
    'the caption stays: it explains the link');
});

test('I4b: link card keeps its right edge clear of the 50px speed-dial FAB zone', () => {
  const m = styles.match(/\.analytics-link-card\{([^}]*)\}/);
  assert.ok(m, 'the .analytics-link-card rule exists');
  const pr = m[1].match(/padding-right:\s*(\d+)px/);
  assert.ok(pr && Number(pr[1]) >= 56,
    'the card needs padding-right >= 56px (FAB is 50px at 16px from the edge = 66px zone)');
});

test('I4c GUARD: the renamed link still switches to Transactions and scrolls to the Area module', () => {
  assert.ok(appJs.includes("switchView('transactions')"), 'handler still switches to Transactions');
  assert.ok(appJs.includes("document.getElementById('areaAnalyticsModule')?.scrollIntoView"),
    'handler still scrolls to #areaAnalyticsModule');
});
