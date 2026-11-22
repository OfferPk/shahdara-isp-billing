// QC Modal Pills Polish (2026-11-22) — the Quick Collect Cash modal:
// colourful filter pills + hidden scrollbar (issue 1), the unified
// "High priority · ≥2k" pill (issue 2), the banner gap (issue 3) and
// the word-boundary name wrap (issue 4), all at 360px Android.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read
// the HTML/CSS/JS as text and assert the values, plus real renders
// via renderQuickCollectCustomerListHtml; no browser needed.
// Fixture data only — generic fixture names, pattern-fake phones
// (03012345678 family), no real customer data of any kind.
//
// Parent decisions pinned here: D1 (All badge bg reuses
// --qc-indigo-text, border reuses --ds-border), D2 (Paid badge uses
// --color-emerald-dark, the 700 shade — the spec's emerald-600 has
// no exact token), D3 (unified pill reuses --qc-rose-* tokens),
// D4 (banner gap-only, 4px 8px), D5 (Medium + ≥2k keeps separate
// chips), D6 (label composes from the existing keys — sentence case
// "High priority", no new i18n key), D7 (name break-word +
// word-break normal, badge padding + card-main gap tightened).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectCustomerListHtml } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const stylesSrc = read('styles.css');
const qcSrc = read('nav-quick-collect.js');
const qc2Src = read('qc2-priority.js');
const en = TRANSLATIONS.en;

function ruleBlock(src, selector) {
  const start = src.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector} rule`);
  return src.slice(start, src.indexOf('}', start));
}

// The modal's own chips row is ~278px at 360px (dialog 344px minus
// 14px padding each side = 316px content, minus 12px list padding,
// 24px card padding and the 2px border). The figures below use the
// prep's measured chip widths (one-row tightening harness): the High
// badge 87.6px and the ≥2k tag 36px at 0.72rem/2px 7px, the "2+ mos
// arrears" tier label 99.2px.

// --- Issue 1: colourful pills, hidden scrollbar ----------------------

test('pills: the filter row hides its scrollbar but still scrolls', () => {
  const pills = ruleBlock(stylesSrc, '.qc-filter-pills {');
  assert.ok(pills.includes('scrollbar-width: none'), 'the pills row must hide its scrollbar in Firefox');
  assert.ok(pills.includes('overflow-x: auto'), 'the pills row must still scroll — the four pills total ~346-380px against a 316px row');
  assert.ok(stylesSrc.includes('.qc-filter-pills::-webkit-scrollbar {'), 'the pills row must hide its scrollbar in WebKit');
  const webkit = ruleBlock(stylesSrc, '.qc-filter-pills::-webkit-scrollbar {');
  assert.ok(webkit.includes('display: none'), 'the WebKit pills scrollbar must be display:none');
  // Same pair as the in-repo precedent (.qc-customer-list,
  // .profile-tabs, .recovery-priority-pills).
  assert.ok(stylesSrc.includes('.qc-customer-list::-webkit-scrollbar {'), 'the precedent rules must still exist');
});

test('pills: All is indigo — soft tint, solid indigo badge, indigo active fill (D1)', () => {
  assert.ok(html.includes('class="quick-collect-filter-chip qc-filter-all"'), 'the All pill must carry its per-pill class');
  const all = ruleBlock(stylesSrc, '.quick-collect-filter-chip.qc-filter-all {');
  assert.ok(all.includes('background: var(--qc-indigo-bg)'), 'the All pill must be the indigo soft tint');
  assert.ok(all.includes('border-color: var(--ds-border)'), 'the All border reuses --ds-border (D1b — the spec indigo-200 has no token)');
  assert.ok(all.includes('color: var(--qc-indigo-text)'), 'the All text must be indigo');
  const badge = ruleBlock(stylesSrc, '.qc-filter-all .qc-count-badge {');
  assert.ok(badge.includes('background: var(--qc-indigo-text)'), 'the All count badge must be a solid indigo fill (D1b)');
  assert.ok(badge.includes('color: #ffffff'), 'the solid badge text must be white');
  const active = ruleBlock(stylesSrc, '.quick-collect-filter-chip.qc-filter-all.is-active {');
  assert.ok(active.includes('background: var(--qc-indigo-text)'), 'the active All pill must fill indigo');
});

test('pills: Paid is emerald — soft tint, solid emerald badge, emerald active fill (D2)', () => {
  assert.ok(html.includes('class="quick-collect-filter-chip qc-filter-paid"'), 'the Paid pill must carry its per-pill class');
  const paid = ruleBlock(stylesSrc, '.quick-collect-filter-chip.qc-filter-paid {');
  assert.ok(paid.includes('background: var(--qc-mint-bg)'), 'the Paid pill must be the emerald soft tint');
  assert.ok(paid.includes('border-color: var(--qc-mint-border)'), 'the Paid border must be the mint border');
  assert.ok(paid.includes('color: var(--qc-emerald-text)'), 'the Paid text must be emerald');
  const badge = ruleBlock(stylesSrc, '.qc-filter-paid .qc-count-badge {');
  // D2: the spec's emerald-600 has no exact token, so the solid Paid
  // badge uses --color-emerald-dark (the established 700 shade).
  assert.ok(badge.includes('background: var(--color-emerald-dark)'), 'the Paid count badge must be a solid emerald fill (D2, 700 shade)');
  assert.ok(badge.includes('color: #ffffff'), 'the solid badge text must be white');
  const active = ruleBlock(stylesSrc, '.quick-collect-filter-chip.qc-filter-paid.is-active {');
  assert.ok(active.includes('background: var(--color-emerald-dark)'), 'the active Paid pill must fill emerald');
});

test('pills: High badge is a solid rose fill with a rose active fill; Pending keeps the generic badge; the generic active rule stays pinned', () => {
  const badge = ruleBlock(stylesSrc, '.qc-filter-high .qc-count-badge {');
  assert.ok(badge.includes('background: var(--qc-rose-strong-text)'), 'the High count badge must be a solid rose fill');
  assert.ok(badge.includes('color: #ffffff'), 'the solid badge text must be white');
  const active = ruleBlock(stylesSrc, '.quick-collect-filter-chip.qc-filter-high.is-active {');
  assert.ok(active.includes('background: var(--qc-rose-strong-text)'), 'the active High pill must fill rose');
  // Pending keeps the generic slate badge — the spec asked for a deep
  // emerald Pending tint, but Pending's active state is already the
  // deep-emerald DS-0 fill, so no per-pill Pending rule is added.
  assert.ok(!stylesSrc.includes('.qc-filter-pending'), 'no per-pill Pending rule may exist — Pending keeps the generic badge');
  // The generic active rule stays intact and pinned (DS-0 Emerald).
  const generic = ruleBlock(stylesSrc, '.quick-collect-filter-chip.is-active {');
  assert.ok(generic.includes('background: var(--ds-brand)'), 'the generic active pill must stay var(--ds-brand)');
  assert.ok(!generic.includes('#2563eb'), 'the generic active pill must never carry the old blue');
});

test('pills: dark mode gives the inactive badges tint-on-tint fills, and never overrides the active fill', () => {
  // The light solid tokens resolve to light tints in dark mode (rose
  // #ffb4a8, indigo #d5e2ff), which would wash out against white
  // text — the inactive dark badges use the tint bg + tint text
  // pattern instead, scoped to inactive pills so the
  // translucent-white active badge keeps winning when active.
  for (const [filter, bg, text] of [
    ['qc-filter-high', '--qc-rose-bg', '--qc-rose-text'],
    ['qc-filter-all', '--qc-indigo-bg', '--qc-indigo-text'],
    ['qc-filter-paid', '--qc-mint-bg', '--qc-emerald-text'],
  ]) {
    const rule = ruleBlock(stylesSrc, `[data-theme="dark"] #quickCollectModal .quick-collect-filter-chip.${filter}:not(.is-active) .qc-count-badge {`);
    assert.ok(rule.includes(`background: var(${bg})`), `the dark ${filter} badge must use the tint background`);
    assert.ok(rule.includes(`color: var(${text})`), `the dark ${filter} badge must use the tint text`);
  }
  // Dark active stays the established DS-0 Emerald — no per-pill
  // dark active override may exist.
  assert.ok(!stylesSrc.includes('[data-theme="dark"] #quickCollectModal .quick-collect-filter-chip.qc-filter-high.is-active'), 'no dark High active override may exist');
  assert.ok(!stylesSrc.includes('[data-theme="dark"] #quickCollectModal .quick-collect-filter-chip.qc-filter-all.is-active'), 'no dark All active override may exist');
  assert.ok(!stylesSrc.includes('[data-theme="dark"] #quickCollectModal .quick-collect-filter-chip.qc-filter-paid.is-active'), 'no dark Paid active override may exist');
});

// --- Issue 2: one unified High + ≥2k pill ----------------------------

function highPool() {
  return [
    { id: 'c-1', customerNumber: 1, name: 'Fixture One', area: 'BARRIAN', packageName: 'Package 3,000', totalDues: 3000, callHref: 'tel:03012345678', mapsUrl: 'https://maps.example.invalid/a' },
  ];
}

function highPrio() {
  return new Map([['c-1', { group: 'High Priority', openBillCount: 3, longestOverdueDays: 0, reasons: ['Overdue'] }]]);
}

test('unified pill: a High + ≥2k card renders ONE unified pill and no separate ≥2k tag', () => {
  const out = renderQuickCollectCustomerListHtml(highPool(), null, null, '', highPrio());
  assert.ok(out.includes('qc-unified-priority'), 'the card must carry the unified pill');
  assert.ok(out.includes('High priority'), 'the unified pill must keep the pinned "High priority" label (sentence case, D6)');
  assert.ok(out.includes('≥2k'), 'the unified pill must keep the "≥2k" threshold');
  assert.ok(out.includes('🔥'), 'the unified pill must keep the fire marker');
  assert.ok(out.includes('High priority · ≥2k'), 'the unified pill must read as one "High priority · ≥2k" label');
  assert.ok(!out.includes('qc2-high-balance-tag'), 'the separate ≥2k tag must be skipped on a unified card');
  assert.ok(out.includes('ds-chip ds-chip--danger qc2-badge--high qc-unified-priority'), 'the unified pill must keep the danger chip + high badge classes');
  // The badge-class map itself is untouched (pinned in
  // qc2-priority-on-cards): the pill is composed at render time.
  assert.ok(qc2Src.includes("high: 'ds-chip ds-chip--danger'"), 'the badge-class map must stay unchanged');
});

test('unified pill: a Medium + ≥2k card keeps the separate ≥2k tag and no unified pill (D5)', () => {
  const pool = [
    { id: 'c-2', customerNumber: 2, name: 'Fixture Two', area: 'BARRIAN', packageName: 'Package 3,000', totalDues: 3000, callHref: 'tel:03012345678', mapsUrl: 'https://maps.example.invalid/a' },
  ];
  const prio = new Map([['c-2', { group: 'Medium Priority', openBillCount: 1, longestOverdueDays: 0, reasons: ['Overdue'] }]]);
  const out = renderQuickCollectCustomerListHtml(pool, null, null, '', prio);
  assert.ok(out.includes('Medium priority'), 'the Medium card must keep its tier badge');
  assert.ok(out.includes('qc2-high-balance-tag'), 'the Medium + ≥2k card must keep the separate ≥2k tag');
  assert.ok(!out.includes('qc-unified-priority'), 'no unified pill may appear on a Medium card');
});

test('unified pill: the scoped rule carries the spec geometry in rose (D3)', () => {
  const rule = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips .qc-unified-priority {');
  assert.ok(rule.includes('display: inline-flex'), 'the unified pill must be inline-flex');
  assert.ok(rule.includes('gap: 4px'), 'the unified pill must gap the fire marker from the label');
  assert.ok(rule.includes('padding: 2px 10px'), 'the unified pill must be 2px 10px');
  assert.ok(rule.includes('font-size: 11px'), 'the unified pill must be 11px');
  assert.ok(rule.includes('font-weight: 600'), 'the unified pill must be weight 600');
  assert.ok(rule.includes('border-radius: 999px'), 'the unified pill must be a full pill');
  assert.ok(rule.includes('white-space: nowrap'), 'the unified pill must never split across lines');
  assert.ok(rule.includes('background: var(--qc-rose-bg)'), 'the unified pill must use the rose tint (D3)');
  assert.ok(rule.includes('border: 1px solid var(--qc-rose-border)'), 'the unified pill must carry the rose border');
  assert.ok(rule.includes('color: var(--qc-rose-text)'), 'the unified pill must use the rose text');
  // The label composes from the existing keys — no new i18n key.
  assert.equal(en.qc2_priority_high, 'High priority', 'the High label key must stay sentence case');
  assert.equal(en.qc2_high_balance, '≥2k', 'the High-balance key must stay the bare threshold');
});

test('unified pill: the ≥2k-only tag gets its own scoped override, and the shared sizing block stays pinned', () => {
  // The shared sizing block's selector list ENDS with
  // ".qc2-high-balance-tag {", so a first-occurrence lookup returns
  // the shared block — the override is the LAST occurrence of the
  // selector (placed after the shared block, so it wins at equal
  // specificity).
  const sel = '#quickCollectModal .qc-card-chips .qc2-high-balance-tag {';
  const at = stylesSrc.lastIndexOf(sel);
  assert.ok(at >= 0, 'missing the scoped ≥2k-only override rule');
  const tag = stylesSrc.slice(at, stylesSrc.indexOf('}', at));
  assert.ok(tag.includes('padding: 2px 10px'), 'the ≥2k-only tag must be 2px 10px');
  assert.ok(tag.includes('font-size: 11px'), 'the ≥2k-only tag must be 11px');
  assert.ok(tag.includes('font-weight: 600'), 'the ≥2k-only tag must be weight 600');
  assert.ok(tag.includes('background: var(--qc-rose-bg)'), 'the ≥2k-only tag must use the rose tint');
  // The shared sizing block is NEVER edited — it stays pinned at
  // 24px / 2px 7px / 0.72rem (qc-true-one-row-tightening).
  const sizes = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips .qc2-tier-label {');
  assert.ok(sizes.includes('height: 24px'), 'the chips must stay 24px tall');
  assert.ok(sizes.includes('padding: 2px 7px'), 'the chips must stay 2px 7px');
  assert.ok(sizes.includes('font-size: 0.72rem'), 'the chips must stay 0.72rem');
  const chips = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips {');
  assert.ok(chips.includes('flex-wrap: wrap'), 'the chips row must keep its wrap valve');
});

// --- Issue 3: banner gap ----------------------------------------------

test('banner: Today and Round are separated by the 8px column gap alone (D4)', () => {
  const banner = ruleBlock(stylesSrc, '.qc-round-banner {');
  assert.ok(banner.includes('gap: 4px 8px'), 'the banner column gap must be 8px so "Today: PKR 0" and "Round: 0" never collide');
  assert.ok(banner.includes('justify-content: space-between'), 'the banner must keep space-between');
  assert.ok(banner.includes('flex-wrap: wrap'), 'the banner must keep its wrap');
  // No separator element was added — the button order stays 3 and
  // the C5 ::before ban holds (the separator stays deleted).
  assert.ok(!stylesSrc.includes('.qc-round-banner .rtt-round-totals::before {'), 'the deleted separator rule must stay deleted (C5)');
  assert.ok(!html.includes('qc-round-separator'), 'no separator element may be added to the banner');
});

// --- Issue 4: word-boundary name wrap ---------------------------------

test('name: the modal name wraps between words, never mid-word, and the clamp stays', () => {
  const name = ruleBlock(stylesSrc, '#quickCollectModal .qc-cust-name {');
  assert.ok(name.includes('overflow-wrap: break-word'), 'the modal name must break words only as a last resort');
  assert.ok(name.includes('word-break: normal'), 'the modal name must state the never-split-mid-word behaviour');
  assert.ok(!name.includes('break-all'), 'the modal name rule must never split everywhere');
  assert.ok(!/break-all/.test(stylesSrc), 'no split-everywhere rule may exist anywhere in the stylesheet');
  assert.ok(name.includes('-webkit-line-clamp: 2'), 'the modal name keeps its 2-line clamp');
  assert.ok(name.includes('display: -webkit-box'), 'the modal name keeps its box clamp');
});

test('name: the modal-scoped tightening gives the name column ~6px more room, and the base rules stay untouched', () => {
  // Badge padding 4px 6px -> 3px 5px (saves ~2px) + card-main gap
  // 12px -> 8px (saves ~4px), both modal-scoped so Field Mode is
  // untouched. The gap is added IN PLACE to the existing
  // #quickCollectModal .qc3-card-main rule — never a second rule with
  // that selector, because the one-row test reads this block
  // first-occurrence for flex-wrap.
  const badge = ruleBlock(stylesSrc, '#quickCollectModal .qc-cust-num {');
  assert.ok(badge.includes('padding: 3px 5px'), 'the modal #ID badge must tighten to 3px 5px');
  const main = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main {');
  assert.ok(main.includes('flex-wrap: wrap'), 'the card-main rule must keep its pinned flex-wrap');
  assert.ok(main.includes('gap: 8px'), 'the card-main gap must tighten to 8px');
  // The base (unscoped) rules stay untouched — Field Mode shares them.
  const baseBadge = ruleBlock(stylesSrc, '.qc-cust-num {');
  assert.ok(baseBadge.includes('padding: 4px 6px'), 'the base #ID badge must stay 4px 6px for Field Mode');
  assert.ok(baseBadge.includes('font-weight: 700'), 'the base badge weight must stay');
  assert.ok(baseBadge.includes('background: #f1f5f9'), 'the base badge slate must stay');
  // The modal tint override (a second bare .qc-cust-num rule) stays:
  // mint background + emerald text, pinned by qc-modal-fix.
  assert.ok(/\.qc-cust-num \{[^}]*background: var\(--qc-mint-bg\)[^}]*color: var\(--qc-emerald-text\)/.test(stylesSrc), 'the modal badge tint override must stay');
  const baseMain = ruleBlock(stylesSrc, '.qc3-card-main {');
  assert.ok(baseMain.includes('gap: 12px'), 'the base card-main gap must stay 12px for Field Mode');
});

// --- 360px fit (measured model, no browser) ----------------------------

test('fit: the unified 2-chip case fits one 24px chips row at 360px, and wraps by design at 320px', () => {
  // Row width at 360px ≈ 278px (see the header comment). Unified
  // pill width, derived from the prep's measured chip widths:
  //   "High priority" text 73.6px at 11.52px font (87.6 - 14 padding)
  //     -> 70.3px at 11px; " · " ~11px; "≥2k" text 24px at 11.04px
  //     font (36 - 12 padding) -> 23.9px at 11px; "🔥 " ~14px;
  //     padding 2x10px = 20px. Total ≈ 139.2px.
  // Chips row: unified 139.2 + gap 6 + "2+ mos arrears" 99.2
  //   = 244.4px ≤ 278px — one 24px row at 360px, ~20px wider than
  //   the old two-chip case (234.8px) and still inside the row.
  const unified = (87.6 - 14) * (11 / 11.52) + 11 + (36 - 12) * (11 / 11.04) + 14 + 20;
  const row360 = unified + 6 + 99.2;
  assert.ok(row360 <= 278, `the unified 2-chip case must fit the 278px row at 360px (measured ${row360.toFixed(1)}px)`);
  // At 320px the row is ~238px, so the same case wraps onto a
  // second row — the pinned flex-wrap valve, not a clip, and the
  // unified pill itself never splits (white-space: nowrap, pinned
  // above). Recorded, not blessed: the true 360px check is owed
  // on-phone after deploy (no Chrome on this VM).
  assert.ok(row360 > 238, `the unified case must exceed the ~238px row at 320px so the wrap valve is exercised (measured ${row360.toFixed(1)}px)`);
  const chips = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips {');
  assert.ok(chips.includes('flex-wrap: wrap'), 'the chips row must keep its wrap valve for the 320px case');
});
