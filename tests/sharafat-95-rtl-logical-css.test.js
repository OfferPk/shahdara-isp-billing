// Sharafat 95 — physical left/margin-left/border-left CSS does not mirror
// in Urdu mode. styles.css + nav.css convert in place to logical
// properties (margin-inline-start/end, padding-inline-start/end,
// border-inline-start/end, inset-inline-start/end, text-align:start,
// scroll-padding-inline-start); asymmetric 4-value shorthands rewrite to
// logical longhands; the redundant [dir=rtl] margin overrides are deleted.
//
// Port of the implementer's repro (~/workspace/.sharafat95-scratch/repro.mjs):
// the `ruleHas` any-occurrence matcher, not a first-occurrence extractor —
// some selectors appear in several rules (e.g. .customer-view-toggle),
// and the first occurrence is not always the one carrying the property.
// Fixture data: none — pure CSS-source assertions, no names or numbers.
//
// Disclosed follow-ups (not this item): 169 occurrences in 10 other CSS
// files stay physical; asymmetric border-radius stays un-mirrored; FABs
// mirror by judgement call (D6(a)); the sidebar-offset fix changes the
// desktop RTL layout (R11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const nav = read('nav.css');

// Does ANY rule whose selector list contains `selector` declare a property
// matching `propRe`? Scans every occurrence. Handles the minified
// styles.css:1 blob (`sel{...}`) and spaced rules alike.
function ruleHas(css, selector, propRe) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{[^}]*' + propRe);
  return re.test(css);
}
const L = (p) => `\\b${p}\\s*:`;
const hasLogical = (css, sel, prop) => ruleHas(css, sel, L(prop));
const hasPhysical = (css, sel, prop) => ruleHas(css, sel, `(?<![\\w-])${prop}\\s*:`);

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// --- F1–F13: the bug's facets ---
test('F1 privacy pill mirrors (margin-inline-start:auto)', () => {
  assert.ok(hasLogical(styles, '.privacy-pill', 'margin-inline-start'),
    'styles.css .privacy-pill still margin-left:auto');
});

test('F2 month-card chevron mirrors (summary::after margin-inline-start:auto)', () => {
  assert.ok(hasLogical(styles, '.month-card summary::after', 'margin-inline-start'),
    'styles.css .month-card summary::after still margin-left:auto');
});

test('F3 no-record dot mirrors (margin-inline-start:auto)', () => {
  assert.ok(hasLogical(styles, '.no-record-dot', 'margin-inline-start'),
    'styles.css .no-record-dot still margin-left:auto');
});

test('F4 toast accent mirrors (border-inline-start)', () => {
  assert.ok(hasLogical(styles, '.toast:not([hidden])', 'border-inline-start'),
    'styles.css .toast:not([hidden]) still border-left:4px');
});

test('F5 payment-allocation accent mirrors (border-inline-start)', () => {
  assert.ok(hasLogical(styles, '.payment-allocation', 'border-inline-start'),
    'styles.css .payment-allocation still border-left:2px');
});

test('F6 receipt-reminder accent mirrors (border-inline-start)', () => {
  assert.ok(hasLogical(styles, '.receipt-reminder', 'border-inline-start'),
    'styles.css .receipt-reminder still border-left:3px');
});

test('F7 customer-select text mirrors (text-align:start)', () => {
  assert.ok(ruleHas(styles, '.customer-select', 'text-align\\s*:\\s*start'),
    'styles.css .customer-select still text-align:left');
});

test('F8 sidebar offset mirrors (margin-inline-start:250px / 72px)', () => {
  // Biggest defect: the content margin sat on the physical left while the
  // drawer sits on the right in RTL, leaving a 250px dead strip.
  assert.match(nav, /margin-inline-start\s*:\s*250px/,
    'nav.css content offset still margin-left:250px');
  assert.match(nav, /margin-inline-start\s*:\s*72px/,
    'nav.css collapsed-rail offset still margin-left:72px');
});

test('F9 border-color-only overrides mirror (border-inline-start-color)', () => {
  assert.ok(hasLogical(styles, '.statement-summary-card.balance-overdue', 'border-inline-start-color'),
    'statement-summary-card.balance-overdue still border-left-color');
  assert.ok(hasLogical(styles, '.business-health-positive', 'border-inline-start-color'),
    'business-health-positive still border-left-color');
  assert.ok(hasLogical(styles, '#fhlFullHistoryList .payment-row.hist-type-payment', 'border-inline-start-color'),
    'fhl hist-type-payment still border-left-color');
});

test('F10 sticky first column mirrors (inset-inline-start:0)', () => {
  assert.ok(hasLogical(styles, '.table-scroll th:first-child, .table-scroll td:first-child', 'inset-inline-start'),
    'styles.css sticky first column still left:0');
});

test('F11 floating panels mirror (inset-inline-end:0)', () => {
  assert.ok(hasLogical(styles, '.help-tip-content', 'inset-inline-end'),
    'help-tip still right:0');
  assert.ok(hasLogical(styles, '.tx-export-options', 'inset-inline-end'),
    'export dropdown still right:0');
});

test('F12 list indents mirror (padding-inline-start)', () => {
  assert.ok(hasLogical(styles, '.bill-audit ol', 'padding-inline-start'),
    'bill-audit list still padding-left');
  assert.ok(hasLogical(styles, '.incident-audit ol', 'padding-inline-start'),
    'incident-audit list still padding-left');
});

test('F13 all flex spacers mirror (margin-inline-start:auto)', () => {
  const spacers = [
    '.online-snapshot-values strong', '.service-state-counts', '.pagination-size-label',
    '.customer-view-toggle', '.qc-receipt-ref', '.customer-filter-head .filter-help',
    '.dc-attainment-wrap', '.oqs-mark', '.profile-detail-section summary::after',
    '.profile-accordion summary::after', '.drawer-technical-summary::after',
  ];
  for (const s of spacers) {
    assert.ok(hasLogical(styles + '\n' + nav, s, 'margin-inline-start'),
      `${s} still margin-left:auto`);
  }
});

// --- F14–F18: asymmetric padding/margin SHORTHANDS ---
// The prep called the other shorthands symmetric — wrong: 14 asymmetric
// 4-value shorthands hide physical left/right values. 6 are COUPLED to
// conversions in this item (converting the button without the input
// padding would create a new RTL bug); 8 are the same bug class in the
// same two files. All rewrite to logical longhands, LTR-identical.
test('F14 customer-card-controls shorthand mirrors (padding-inline-start:50px)', () => {
  assert.ok(ruleHas(styles, '.customer-card-controls', 'padding-inline-start\\s*:\\s*50px'),
    'the base shorthand padding:0 10px 2px 50px still pins 50px to the physical left');
});

test('F15 search-input paddings mirror (padding-inline-end:36px)', () => {
  assert.ok(ruleHas(styles, '.qc-search-input', 'padding-inline-end\\s*:\\s*36px'),
    'qc-search-input still reserves 36px on the physical right');
  assert.ok(ruleHas(styles, '.fcs-search-input', 'padding-inline-end\\s*:\\s*36px'),
    'fcs-search-input still reserves 36px on the physical right');
});

test('F16 dismiss/chevron paddings mirror (44px / 26px)', () => {
  assert.ok(ruleHas(styles, '.eds-summary-panel', 'padding-inline-end\\s*:\\s*44px'),
    'eds panel still reserves 44px on the physical right');
  assert.ok(ruleHas(styles, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-area-select', 'padding-inline-end\\s*:\\s*26px'),
    'qc area-select still reserves 26px on the physical right');
});

test('F17 service-state-counts shorthand mirrors (padding-inline-start:10px)', () => {
  assert.ok(ruleHas(styles, '.service-state-counts', 'padding-inline-start\\s*:\\s*10px'),
    'service-state-counts shorthand padding:0 5px 0 10px still pins 10px to the physical left');
});

test('F18 remaining asymmetric shorthands mirror', () => {
  const shorthands = [
    [styles, '.archived-unarchive-button', 'margin-inline-start\\s*:\\s*49px'],
    [styles, '.table-filter-count', 'margin-inline-start\\s*:\\s*auto'],
    [styles, '.owner-command-toggle .local-only-badge', 'margin-inline-start\\s*:\\s*auto'],
    [styles, '.scc-record-button', 'margin-inline-end\\s*:\\s*8px'],
    [styles, '.customer-technical-grid .secondary-button', 'padding-inline-end\\s*:\\s*30px'],
    [styles, '.global-result-actions', 'padding-inline-start\\s*:\\s*12px'],
    [nav, '.nav-drawer-group-title', 'margin-inline-start\\s*:\\s*10px'],
    [nav, '.speed-dial-action', 'padding-inline-end\\s*:\\s*16px'],
  ];
  for (const [css, sel, prop] of shorthands) {
    assert.ok(ruleHas(css, sel, prop), `${sel} shorthand still pins a physical left/right value`);
  }
});

// --- F19: redundant [dir=rtl] margin overrides are removed (D5(a)) ---
test('F19 redundant [dir=rtl] margin overrides are gone', () => {
  assert.ok(!nav.includes('[dir="rtl"] .topbar-actions,'),
    'redundant [dir=rtl] .topbar-actions margin override survives');
  assert.ok(!nav.includes('[dir="rtl"] .nav-drawer-badge,'),
    'redundant [dir=rtl] .nav-drawer-badge margin override survives');
  assert.ok(!nav.includes('[dir="rtl"] .more-menu-badge,'),
    'redundant [dir=rtl] .more-menu-badge margin override survives');
  assert.ok(!nav.includes('[dir="rtl"] .qc-search-clear,'),
    'redundant [dir=rtl] qc-search-clear / fcs-search-clear rule survives');
});

// --- F20: the margin-left:0 breakpoint overrides convert ---
// Converting the base (margin-inline-start:auto) without the breakpoint
// override (margin-left:0) would leave the override zeroing the wrong
// side in RTL only — LTR tests stay green, the RTL layout breaks.
test('F20 margin-left:0 breakpoint overrides convert', () => {
  const overrides = [
    '.pagination-size-label', '.customer-view-toggle',
    '.customer-view-row .customer-view-toggle', '.online-snapshot-values strong',
  ];
  for (const s of overrides) {
    assert.ok(!hasPhysical(styles, s, 'margin-left'),
      `${s} still carries a physical margin-left`);
    assert.ok(ruleHas(styles, s, 'margin-inline-start\\s*:\\s*0'),
      `${s} has no margin-inline-start:0 override`);
  }
});

// --- C/S: guards and controls ---
// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('C1 hex pins hold (styles.css 608 / nav.css 163, no new hex)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(nav), 163, `nav.css hex count moved (${hexCount(nav)})`);
});

test('C2 numeric columns stay right-aligned (text-align:right untouched)', () => {
  assert.ok(ruleHas(styles, '.transaction-amount', 'text-align\\s*:\\s*right'),
    '.transaction-amount lost its right alignment');
  assert.ok(ruleHas(styles, '.payment-amount', 'text-align\\s*:\\s*right'),
    '.payment-amount lost its right alignment');
  assert.ok(ruleHas(styles, '.statement-table .col-num', 'text-align\\s*:\\s*right'),
    '.statement-table .col-num lost its right alignment');
});

test('C3 RTL override block untouched (drawer/nav already mirrored there)', () => {
  assert.ok(nav.includes('[dir="rtl"] .nav-drawer,'), 'the [dir=rtl] drawer override is gone');
  assert.ok(nav.includes('transform: translateX(100%)'), 'the drawer RTL transform is gone');
});

test('C4 centring rules untouched (left:50% + translateX(-50%) is direction-neutral)', () => {
  assert.ok(ruleHas(styles, '.toast', 'left\\s*:\\s*50%'), 'a centring rule was converted');
  assert.match(styles, /transform:\s*translateX\(-50%\)/, 'the centring transform is gone');
});

test('C5 symmetric rules untouched (left+right pairs are direction-neutral)', () => {
  assert.ok(ruleHas(styles, '.global-customer-results', 'left\\s*:\\s*24px;\\s*right\\s*:\\s*24px'),
    'a symmetric left/right pair was touched for no gain');
});

test('C6 print rules untouched (left:0 !important full-bleed)', () => {
  assert.ok(styles.includes('body.printing-batch #batchReceiptModal'),
    'a print rule was touched');
});

test('C7 braces balanced in styles.css + nav.css', () => {
  assert.equal((styles.match(/\{/g) || []).length, (styles.match(/\}/g) || []).length,
    'styles.css brace mismatch');
  assert.equal((nav.match(/\{/g) || []).length, (nav.match(/\}/g) || []).length,
    'nav.css brace mismatch');
});

test('S1 EN/UR parity holds (4,669 / 4,669 — Round 2 D9 net −1, Quick Collect polish +4 keys, Plan 582 −6 orphan keys)', () => {
  // The prep hardcoded 4,574 — stale on this base; this base was
  // 4,672/4,672 (verified by import), unchanged by this CSS-only
  // item. Round 2 (D9) moves it to 4,671/4,671: two keys deleted,
  // one added. Quick Collect polish (2026-11-17) adds 4 keys
  // (EN + UR), so the count moves to 4,675/4,675. Plan 582 (D1(b))
  // deletes the six orphan dash_tile_collect_*/dash_tile_closing_*
  // keys, so the count moves to 4,669/4,669.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5145, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5145, 'UR key count moved');
});

test('S2 logical-property precedent already exists (conversion follows it)', () => {
  assert.match(styles, /margin-inline-start/, 'no margin-inline-start precedent in styles.css');
  assert.match(nav, /margin-inline-start/, 'no margin-inline-start precedent in nav.css');
});

// --- 360px-RTL source pin (R6): arithmetic, not pixels —
// no layout engine runs in Node. The sidebar-offset conversion removes
// the 250px dead strip in RTL, and Sharafat 90's dot-only pill keeps the
// phone topbar inside 360px. On-phone check stays the user's.
test('360px RTL: no physical sidebar offset remains, dot-only pill intact', () => {
  assert.ok(!/margin-left\s*:\s*250px/.test(nav), 'a 250px physical content offset survives in nav.css');
  assert.ok(!/margin-left\s*:\s*72px/.test(nav), 'a 72px physical collapsed-rail offset survives in nav.css');
  assert.ok(styles.includes('#networkStatusPill{width:32px;height:32px;padding:0;justify-content:center}'),
    'Sharafat 90 dot-only pill rule is gone (the 360px topbar budget breaks)');
});
