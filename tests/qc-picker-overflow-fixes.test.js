// QC picker overflow — user-told CSS bugfix, 2026-11-19.
//
// Five overflow/alignment defects on the Quick Collect Cash picker
// (the list view, NOT the success receipt screen):
//  1. Top buttons: the fixed 44px height clipped "Tag new customers"
//     to a 3rd line spilling below the border. The height is gone
//     (min-height 44px stays), the icon sits inline-left
//     (flex-wrap: nowrap + icon flex: none) and the text wraps to
//     at most 2 lines INSIDE the border. Single-line is NOT
//     achievable at a readable size (Sharafat-97 11px floor).
//  2. Filter dropdowns: native <select>s clip — the fix is label text
//     + font, not CSS. Sort labels shortened EN+UR, 13px scoped to
//     the filter row only; mohalla options are count-only and the
//     pending PKR moved to the summary line under the pills.
//  3. Filter pills: the row squeezed the chips instead of scrolling,
//     so the count badges sat ~0-2px from the pill borders.
//     flex-shrink: 0 + padding 5px 12px restores the designed
//     QC-7 scroll. Disclosed: "Paid 84" sits ~30-64px past the right
//     edge until the row is scrolled.
//  4. Search input: the 🔍 was the placeholder's first character, so
//     the caret overlapped it and widening the padding could never
//     clear it. A real ds-icon 'Search' element now sits at 12px and
//     the input clears it with scoped 38px; the 🔍 leaves the
//     placeholder (EN+UR values).
//  5. Summary banner: "Today: PKR 800 • Round: 0" + "Day Summary"
//     wrapped. The banner keeps flex-wrap (the long case would
//     overflow ~109px under nowrap) and gains justify-content:
//     space-between + a right-aligned button; the '•' separator is
//     deleted. One line holds for small figures only; long figures
//     wrap with the button right-aligned on its own row.
//
// This file pins NO parity total and asserts NO parity (602 pattern):
// it must contain neither the current- nor the previous-total bare
// digits (plan591 G5a sweep — see the self-guard, which builds them
// from split literals so this file never carries them).
// Generic fixtures only: Test Customer, pattern-fake 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  quickCollectMohallaFilterSummaryText,
  quickCollectMohallaFilterCountOptionsHtml,
  quickCollectMohallaPendingCounts,
} from '../quick-collect-mohalla-filter.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const html = read('index.html');
const navLang = read('nav-language.js');
const mohallaFilterSrc = read('quick-collect-mohalla-filter.js');
const wiringSrc = read('nav-quick-collect.js');
const collectSetupSrc = read('collect-setup.js');
const { en, ur } = TRANSLATIONS;

// Same shape as the repo's own ruleBlock helpers: the first rule
// block for a selector.
function ruleBlock(css, selector) {
  const at = css.indexOf(selector);
  assert.ok(at >= 0, `missing ${selector} rule`);
  return css.slice(at, css.indexOf('}', at));
}

// Comment-stripped rule text — prose in comments must never satisfy
// a declaration check (the tightening test's false-green trap:
// 'height: 44px' matches 'min-height: 44px' and comment prose).
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
// A standalone `height:` declaration — never 'min-height:' (the char
// before `height` must be a start, ';' or newline, never '-').
const hasStandaloneHeight = (block) => /(^|[;\n])\s*height\s*:/.test(stripComments(block));

// --- Item 1: top buttons ----------------------------------------------
test('C1 top buttons carry no fixed height; min-height 44px + nowrap icon inline-left', () => {
  const tiles = ruleBlock(styles, '#quickCollectModal .qc-top-actions .bc-open-btn,');
  assert.ok(tiles.includes('min-height: 44px !important'), 'the tiles must keep the 44px floor');
  assert.ok(!hasStandaloneHeight(tiles), 'the tiles must carry NO fixed height declaration — the button grows past 44px instead of clipping');
  assert.ok(tiles.includes('flex-wrap: nowrap'), 'the icon must sit inline-left, not on its own line');
  const icon = ruleBlock(styles, '#quickCollectModal .qc-top-actions .bc-open-btn > span,');
  assert.ok(icon.includes('flex: none'), 'the icon span must not shrink');
  assert.ok(!styles.includes('height: 44px;\n  /* 4px vertical padding'), 'the old fixed-height line must be gone from the override');
});

test('C1 labels unchanged: Bulk Collect Cash + Tag new customers still render', () => {
  assert.ok(read('bulk-collect.js').includes('Bulk Collect Cash'), 'the Bulk title must stay');
  assert.ok(read('new-customer-tag-sheet.js').includes('Tag new customers'), 'the Tag title must stay');
});

// --- Item 2: filter dropdowns ------------------------------------------
test('C2 sort labels are shortened EN+UR and the selects run at scoped 13px', () => {
  assert.equal(en.qc2_sort_amount, 'Highest dues', 'EN sort must read Highest dues');
  assert.equal(en.qc2_sort_oldest, 'Oldest due', 'EN sort must read Oldest due');
  assert.equal(ur.qc2_sort_amount, 'زیادہ بقایا پہلے', 'UR sort must be shortened too');
  assert.equal(ur.qc2_sort_oldest, 'پرانا بقایا پہلے', 'UR sort must be shortened too');
  assert.ok(html.includes('>Highest dues</option>'), 'the markup fallback must be the short label');
  assert.ok(html.includes('>Oldest due</option>'), 'the markup fallback must be the short label');
  const scoped = ruleBlock(styles, '.qc-filter-row-2col .qc-input {');
  assert.ok(scoped.includes('font-size: 13px'), 'the filter-row selects must be 13px');
  const base = ruleBlock(styles, '.qc-input {');
  assert.ok(base.includes('font-size: 1rem'), 'the shared .qc-input must stay 1rem — the 13px is scoped, never global');
});

const MOHALLAS = ['BANII', 'GANGALL', 'KISHTII'];
function pickerEntries() {
  return [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', area: 'BANII', totalDues: 3000 },
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'BANII', area: 'BANII', totalDues: 2000 },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'GANGALL', area: 'GANGALL', totalDues: 1500 },
  ];
}

test('C2 mohalla options are count-only; the pending PKR rides the summary line', () => {
  const counts = quickCollectMohallaPendingCounts(pickerEntries(), MOHALLAS);
  const options = quickCollectMohallaFilterCountOptionsHtml(counts, '');
  assert.ok(options.includes('<option value="">All (3)</option>'), 'the All option must be count-only');
  assert.ok(options.includes('BANII (2)</option>'), 'row options must be count-only');
  assert.ok(!options.includes('PKR'), 'no PKR may remain in any option label');
  assert.equal(
    quickCollectMohallaFilterSummaryText(pickerEntries(), '', counts.totalPendingPkr),
    '3 customers · PKR 6,500.',
    'no filter: the summary line reads the pool total',
  );
  assert.equal(
    quickCollectMohallaFilterSummaryText(pickerEntries(), 'BANII', 5000),
    '3 customers in BANII · PKR 5,000.',
    'filtered: the summary line reads that mohalla total',
  );
  assert.equal(
    quickCollectMohallaFilterSummaryText(pickerEntries(), 'BANII'),
    '3 customers in BANII.',
    'no PKR passed: the old callers strings are unchanged',
  );
  assert.ok(
    /quickCollectMohallaFilterSummaryText\(\s*picked\.customers, '', counts\.totalPendingPkr,?\s*\)/.test(wiringSrc),
    'the picker caller must pass the pool PKR with no filter',
  );
  assert.ok(
    /quickCollectMohallaFilterSummaryText\(\s*picked\.customers, activeMohallaFilter, row \? row\.pendingPkr : 0,?\s*\)/.test(wiringSrc),
    'the picker caller must pass the row PKR when filtered',
  );
});

// --- Item 3: filter pills ------------------------------------------------
test('C3 filter chips do not shrink and carry 5px 12px', () => {
  const chip = ruleBlock(styles, '.quick-collect-filter-chip {');
  assert.ok(chip.includes('flex-shrink: 0'), 'the chips must not shrink — the row scrolls instead');
  assert.ok(chip.includes('padding: 5px 12px'), 'the chips must carry the px-3 breathing room');
  assert.ok(chip.includes('min-height: 44px'), 'the 44px tap target stays');
  const row = ruleBlock(styles, '.qc-filter-pills {');
  assert.ok(row.includes('overflow-x: auto'), 'the pill row must still scroll horizontally');
});

// --- Item 4: search input -------------------------------------------------
test('C4 the magnifier is a separate icon; the placeholder carries no 🔍; the input clears it', () => {
  assert.ok(html.includes('<span class="qc-search-icon" data-ds-icon="Search" aria-hidden="true">'), 'the search box must carry a real icon element');
  assert.ok(!en.qc_search_placeholder.includes('🔍'), 'the EN placeholder must drop the emoji');
  assert.ok(!ur.qc_search_placeholder.includes('🔍'), 'the UR placeholder must drop the emoji');
  assert.equal(en.qc_search_placeholder, 'Search #ID, name, or phone', 'the EN placeholder keeps its words');
  assert.ok(!html.includes('placeholder="🔍'), 'the markup placeholder must drop the emoji too');
  const icon = ruleBlock(styles, '.qc-search-icon {');
  assert.ok(icon.includes('position: absolute'), 'the icon must be positioned over the input');
  assert.ok(icon.includes('inset-inline-start: 12px'), 'the icon must sit at 12px');
  assert.ok(icon.includes('pointer-events: none'), 'the icon must never eat clicks');
  const iconSvg = ruleBlock(styles, '.qc-search-icon svg {');
  assert.ok(iconSvg.includes('width: 18px'), 'the icon must be 18px');
  const scoped = ruleBlock(styles, '#quickCollectModal .qc-search-input {');
  assert.ok(scoped.includes('padding-inline-start: 38px'), 'the Quick Collect search must clear the icon with 38px');
  assert.ok(!collectSetupSrc.includes('qc-search-icon'), 'the shared collect-setup search keeps no icon');
  const baseInput = ruleBlock(styles, '.qc-search-input {');
  assert.ok(baseInput.includes('padding-inline-start: 12px'), 'the shared input keeps 12px — the 38px is scoped, never global');
});

// --- Item 5: summary banner ----------------------------------------------
test('C5 the banner puts Day Summary on the right and keeps its wrap', () => {
  const banner = ruleBlock(styles, '.qc-round-banner {');
  assert.ok(banner.includes('justify-content: space-between'), 'the banner must push the button right');
  assert.ok(banner.includes('flex-wrap: wrap'), 'the banner must keep its wrap — the long case must wrap, not overflow');
  assert.ok(!styles.includes('.qc-round-banner .rtt-round-totals::before {'), 'the • separator rule must be gone');
  const button = ruleBlock(styles, '.qc-round-banner .eds-summary-button {');
  assert.ok(button.includes('margin-inline-start: auto'), 'the button must right-align on its own wrapped row too');
  assert.ok(button.includes('padding: 0 8px'), 'the button padding must be tightened to 0 8px');
  assert.ok(button.includes('min-height: 32px !important'), 'the button must stay 32px');
  assert.ok(button.includes('order: 3'), 'the button must stay the third cell');
  assert.ok(html.includes('Day Summary'), 'the Day Summary label must stay');
});

// --- Steady state ---------------------------------------------------------
test('S1 the three changed keys exist in EN and UR, key count unchanged', () => {
  for (const key of ['qc2_sort_amount', 'qc2_sort_oldest', 'qc_search_placeholder']) {
    assert.ok(typeof en[key] === 'string' && en[key].length > 0, `missing EN value for ${key}`);
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR value for ${key}`);
  }
  assert.equal(Object.keys(en).length, Object.keys(ur).length, 'EN and UR dicts must stay equal in size');
});

test('S2 no Rs. token anywhere in nav-language.js (Sharafat 85)', () => {
  assert.ok(!navLang.includes('Rs.'), 'no Rs. token may appear');
  assert.ok(!/\bRs\s/.test(navLang), 'no Rs-space token may appear');
});

test('S3 the summary helper keeps its old shape when no PKR is passed', () => {
  assert.equal(quickCollectMohallaFilterSummaryText([], ''), 'No customers.', 'zero customers reads the same');
  assert.equal(quickCollectMohallaFilterSummaryText([{ id: 'x' }], ''), '1 customer.', 'one customer reads the same');
  assert.ok(mohallaFilterSrc.includes('function quickCollectMohallaCountLabel'), 'the count-label helper stays — its shape is the summary line shape');
});

// --- Self-guard: this file pins no parity total ---------------------------
test('G self-guard — this file carries none of the parity bare digits', () => {
  // The digits are built from split literals so this file itself never
  // contains them (plan591 G5a sweeps the whole tests/ tree for the bare
  // digits of the current total, pnl G4 counts the files containing
  // them). This file asserts no parity total — 0 new keys.
  const selfSrc = read('tests/qc-picker-overflow-fixes.test.js');
  assert.ok(!selfSrc.includes('52' + '17'), 'this file must not carry the current parity bare digits');
  assert.ok(!selfSrc.includes('52' + '13'), 'this file must not carry the previous parity bare digits');
  assert.ok(!selfSrc.includes('52' + '03'), 'this file must not carry the older parity bare digits');
});
