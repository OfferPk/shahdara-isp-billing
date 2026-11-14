// QC True 1-Row Tightening (item A, user instruction 2026-11-14,
// expanded spec Addendum A2) — the six new tests from prep v2 §5.
// The harness numbers they pin are MEASURED (gen-1row-a.mjs,
// 0 pageerrors, chromium-headless-shell) and recorded in the
// comments + in tests/qc-modal-overhaul-2-fit.test.js; the tests
// below pin the structure + CSS values that produce them.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read
// the HTML/CSS/JS as text and assert the values; no browser needed.
// Fixture data only — generic fixture names, pattern-fake phones
// (03012345678 family), no real customer data of any kind.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectCustomerListHtml } from '../nav-quick-collect.js';
import { TRANSLATIONS, VISIBLE_TEXT_UR } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const stylesSrc = read('styles.css');
const qcSrc = read('nav-quick-collect.js');
const bulkSrc = read('bulk-collect.js');
const tagSrc = read('new-customer-tag-sheet.js');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

function ruleBlock(src, selector) {
  const start = src.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector} rule`);
  return src.slice(start, src.indexOf('}', start));
}

// 1. Tiles 44px, no subtitles — parent decision D-A12 (44px, not
// the user's 40px: the full titles do not fit the 153px columns on
// one line at 0.85rem, and phone fonts run wider than the harness,
// so 44px lets the titles wrap to two lines comfortably while
// matching the global 44px floor; still 59px shorter than the 103px
// cards they replace — measured tilesBtnH 44 at 360 + 320).
test('1-row: tiles are 44px buttons, icon + title only, handlers untouched', () => {
  const tiles = ruleBlock(stylesSrc, '#quickCollectModal .qc-top-actions .bc-open-btn,');
  assert.ok(tiles.includes('min-height: 44px !important'), 'the tiles must be 44px');
  assert.ok(tiles.includes('height: 44px'), 'the tiles must be exactly 44px tall');
  // The subtitles are deleted from the two modules' button renders.
  assert.ok(!bulkSrc.includes('<small>many payments in one batch</small>'), 'the Bulk subtitle must be gone from the button render');
  assert.ok(!tagSrc.includes('<small>first month free</small>'), 'the Tag subtitle must be gone from the button render');
  assert.ok(bulkSrc.includes('Bulk Collect Cash'), 'the Bulk title must stay');
  assert.ok(tagSrc.includes('Tag new customers'), 'the Tag title must stay');
  // The click -> open() handlers are untouched.
  assert.ok(bulkSrc.includes("addEventListener('click'"), 'the Bulk click handler must stay');
  assert.ok(tagSrc.includes("addEventListener('click'"), 'the Tag click handler must stay');
  assert.ok(bulkSrc.includes('open()'), 'Bulk must still open its modal on click');
  assert.ok(tagSrc.includes('open()'), 'Tag must still open its sheet on click');
  // The orphaned subtitle map keys go with the subtitle (see the
  // qc-cash-modal-overhaul test for the map pins).
  assert.ok(!('Bulk Collect Cash many payments in one batch' in VISIBLE_TEXT_UR), 'the long bulk map key must be gone');
});

// 2. Bill status gone, Paid reachable — the QC-12 dropdown is
// deleted; the 4th pill 'Paid' reaches the paid pool. The pool
// behaviour is pinned in tests/qc12-qc-search-filter-dropdown.test.js;
// this test pins the control itself.
test('1-row: no Bill-status dropdown; the Paid pill reaches the paid pool', () => {
  const stepTop = html.indexOf('id="quickCollectStepPick"');
  const stepEnd = html.indexOf('id="quickCollectSearchInput"', stepTop);
  assert.ok(!html.slice(stepTop, stepEnd).includes('data-qc-status-filter'), 'no Bill-status select may remain in the picker step');
  assert.ok(!html.includes('data-qc-status-filter'), 'no Bill-status select may remain anywhere in the page');
  assert.ok(html.includes('data-filter="paid"'), 'the Paid pill must exist');
  // setFilter takes 'paid' through the chips wiring (data-filter) —
  // there is no literal setFilter('paid') call: the pills' click
  // listener passes the clicked chip's data-filter through.
  assert.ok(qcSrc.includes("setFilter('all-dues')"), 'setFilter must still default to the pending pool');
  assert.ok(qcSrc.includes("'paid'"), 'the paid pool branch must still exist in the controller');
  assert.ok(qcSrc.includes('getPendingCollectionCustomers(state, '), 'the pool builder must still serve the filter types');
  assert.ok(qcSrc.includes("querySelectorAll('.quick-collect-filter-chip')"), 'the chips must still be wired by class');
});

// 3. Search-to-Recent gap 8px — the source-scan equivalent of the
// harness measurement (measured searchToRecentGap 8 at 360 + 320,
// was 44px). Three parts: the picker step gap 12 -> 8, the empty
// suggestion lists hidden (each cost a flex gap), and the toggle
// margin-top 8 -> 0 (the harness scrolled-bottom check proves the
// sticky-header clip does NOT return at 0 — title y stays 30).
test('1-row: Search-to-Recent gap is 8px — step gap 8, empty lists hidden, toggle margin 0', () => {
  const step = ruleBlock(stylesSrc, '#quickCollectModal #quickCollectStepPick.qc-step {');
  assert.ok(step.includes('gap: 8px'), 'the picker step gap must be 8px');
  assert.ok(stylesSrc.includes('#quickCollectModal #nplNamePrefixList:empty,'), 'the empty name-prefix list must hide');
  assert.ok(stylesSrc.includes('#quickCollectModal #lfdLastFourList:empty {'), 'the empty last-four list must hide');
  const toggle = ruleBlock(stylesSrc, '.rqp-toggle {');
  assert.ok(toggle.includes('margin-top: 0'), 'the toggle margin must be 0 — the clip check moved to the harness');
  assert.ok(toggle.includes('height: 38px'), 'the toggle must stay a fixed 38px row');
});

// 4. Labelled action row — Call / Map stay LABELLED (parent decision
// D-A1, superseding the icon-only shape): grid auto auto 1fr, gap
// 8px (6px at <=320px), 38px tall. Measured: Call 67 / Map 71.4 /
// Collect 121.6 x 38px, one row at 360px; Call 67 / Map 71.4 /
// Collect 85.6 x 38px, one row at 320px (the gap-6 fix); 0 overX
// at both widths; 100-card render clean.
test('1-row: labelled action row — grid auto auto 1fr, 38px, gap 6 at 320px', () => {
  const row = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-actions {');
  assert.ok(row.includes('display: grid'), 'the modal action row must be a grid');
  assert.ok(row.includes('grid-template-columns: auto auto 1fr'), 'Call / Map must size to their labels, Collect takes the rest');
  assert.ok(row.includes('gap: 8px'), 'the row gap must be 8px at 360px');
  const call = ruleBlock(stylesSrc, '#quickCollectModal .qc3-action-btn--call,');
  assert.ok(call.includes('min-height: 38px !important'), 'Call / Map must be 38px');
  assert.ok(call.includes('height: 38px'), 'Call / Map must be exactly 38px tall');
  assert.ok(call.includes('padding: 8px 10px'), 'Call / Map must be 8px 10px');
  const collect = ruleBlock(stylesSrc, '#quickCollectModal .qc3-collect {');
  assert.ok(collect.includes('min-height: 38px !important'), 'Collect must be 38px');
  assert.ok(collect.includes('height: 38px'), 'Collect must be exactly 38px tall');
  assert.ok(!collect.includes('flex:'), 'Collect must carry no flex sizing — the grid sizes it');
  assert.ok(stylesSrc.includes('@media (max-width: 320px)'), 'the 320px media block must exist');
  const mq = stylesSrc.slice(stylesSrc.indexOf('@media (max-width: 320px)'));
  assert.ok(mq.includes('gap: 6px'), 'the 320px gap fix must drop the row gap to 6px');
  // The render carries the labelled text (Map, not Location).
  assert.equal(en.qc3_location_short, 'Map', 'the modal-only Map key must read Map');
  assert.equal(ur.qc3_location_short, 'نقشہ', 'the modal-only Map key must read نقشہ in Urdu');
  assert.equal(en.qc3_location, 'Location', 'the shared Location value must stay for Field Mode');
});

// 5. Chips one line (3-chip case) + wrap valve (4-chip case) —
// measured with the real render (probe-1row-a-chips3.mjs): the
// 3-chip case (High priority 87.6 + ≥2k 36 + 2+ mos arrears 99.2)
// fits one 24px row at 360px (card 143.5px) and wraps to 2 rows at
// 320px (card 173.5px) — no crush, no overflow at either width;
// the 4-chip case (+ 90+ days overdue 113.2) wraps to 2 rows at
// both widths (card 173.5px), no crush. The valve is flex-wrap:
// wrap on the chips row — nowrap would crush the badge (measured
// 22.8px in the prep sim), so it stays.
test('1-row: chips row keeps the wrap valve; the short labels fit one line at 360px', () => {
  const chips = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips {');
  assert.ok(chips.includes('flex-wrap: wrap'), 'the chips row must keep flex-wrap: wrap — the valve, never a crush');
  const sizes = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips .qc2-tier-label {');
  assert.ok(sizes.includes('height: 24px'), 'the chips must be 24px tall');
  assert.ok(sizes.includes('padding: 2px 7px'), 'the chips must be 2px 7px');
  assert.ok(sizes.includes('font-size: 0.72rem'), 'the chips must be 0.72rem');
  // The short labels themselves (modal-only keys / shortened values).
  assert.equal(en.qc2_high_balance, '≥2k', 'the High-balance tag must be the bare threshold');
  assert.equal(en.qc2_tier_multi_month_short, '2+ mos arrears', 'the modal-only short multi-month label must exist');
  assert.equal(ur.qc2_tier_multi_month_short, '2+ ماہ بقایا', 'the short label must have its Urdu value');
  assert.equal(en.qc2_tier_multi_month, '2+ months arrears', 'the shared multi-month value must stay for Field Mode');
  // The render proves the labels: a High-priority 3-open-month card
  // carries all three chips and no long label.
  const pool = [
    { id: 'c-1', customerNumber: 1, name: 'Fixture One', area: 'BARRIAN', packageName: 'Package 3,000', totalDues: 3000, callHref: 'tel:03012345678', mapsUrl: 'https://maps.example.invalid/a' },
  ];
  const prio = new Map([['c-1', { group: 'High Priority', openBillCount: 3, longestOverdueDays: 0, reasons: ['Overdue'] }]]);
  const out = renderQuickCollectCustomerListHtml(pool, null, null, '', prio);
  assert.ok(out.includes('High priority'), 'the card must carry the High priority badge');
  assert.ok(out.includes('≥2k'), 'the card must carry the shortened ≥2k tag');
  assert.ok(out.includes('2+ mos arrears'), 'the card must carry the short multi-month label');
  assert.ok(!out.includes('High balance ≥2k'), 'the long High-balance label must be gone');
  assert.ok(!out.includes('2+ months arrears'), 'the long multi-month label must be gone from the modal card');
  assert.ok(out.includes(' Map</a>'), 'the Location button must read Map (after its pin icon)');
  assert.ok(!out.includes('Location'), 'no Location button text may remain on the modal card');
});

// 6. Single scroller visuals — the card is the single scroller:
// the card hides its scrollbar visuals (D3 treatment, parent
// decision D-A11) while still scrolling (92vh cap); the list
// hides its own the same way (pinned in qc-cash-modal-overhaul);
// the dialog itself does NOT scroll (overflow-y: visible).
test('1-row: single scroller visuals — card + list hide their scrollbars, dialog does not scroll', () => {
  const card = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-card {');
  assert.ok(card.includes('scrollbar-width: none'), 'the card must hide its scrollbar in Firefox');
  assert.ok(card.includes('overflow-y: auto'), 'the card must still scroll');
  assert.ok(card.includes('max-height: 92vh'), 'the card cap must stay 92vh');
  assert.ok(stylesSrc.includes('#quickCollectModal .quick-collect-card::-webkit-scrollbar {'), 'the card must hide its scrollbar in WebKit');
  const cardWebkit = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-card::-webkit-scrollbar {');
  assert.ok(cardWebkit.includes('display: none'), 'the WebKit card scrollbar must be display:none');
  const list = ruleBlock(stylesSrc, '.qc-customer-list {');
  assert.ok(list.includes('scrollbar-width: none'), 'the list must hide its scrollbar in Firefox');
  assert.ok(list.includes('overflow-y: auto'), 'the list must still scroll');
  const dialog = ruleBlock(stylesSrc, 'dialog.quick-collect-modal {');
  assert.ok(dialog.includes('overflow-y: visible'), 'the dialog must not scroll — the card is the single scroller');
});
