// QC Cash Modal Overhaul (Nov 2026) — the operator reaches the
// Unpaid Customer Queue immediately, without scrolling past truncated
// lists and stacked filters.
//
// (1) Compact sticky header 44px, single row: ⚡ Quick Collect Cash
// left, (i) 32x32 + Close 32x32 right (both already 32x32 via
// §4.1.3/§4.1.4, not success-only). Bulk Collect + Tag New Customers
// side by side in a 2-column compact button row (44px, ds-icons SVGs,
// 1px solid var(--ds-border), no heavy dashed borders).
// (2) Sort by + Mohalla side by side in a 2-column row (bare selects,
// no labels — each select keeps its aria-label). Search placeholder
// shortened. Pending royal blue -> DS-0 Emerald (--ds-brand). Four
// pills (Pending / High ≥ 2k / All / Paid) on two rows (12.5px,
// 6px 10px). Mohalla select in the 2-column row, full width.
// (3) Recent collapses into an accordion, collapsed by default with
// a 1-line summary; "Collected 2026-11-10" becomes a "10 Nov" badge.
// (4) Round total + today collected become a compact 2-column
// .ds-stat-box banner. End-of-day summary + New customer share a
// 2-column 40px button row; the expanded summary is a clean bordered
// card with an inline × top-right.
// (5) Unpaid cards: [#N] badge inline left of the name on Row 1,
// priority pill top-right of Row 1, the figures as their own KPI row
// below (the clipped Row-1 "Outstanding P..." rendering is deleted —
// the dues figure itself stays, exactly once, now without its
// "Outstanding" label), Call / Map / Collect + mode-switcher emoji
// become ds-icons SVGs, Collect is a solid Emerald primary CTA.
//
// Stylesheet-value approach (polish #17/#21/#25/#27, QC-2/QC-3
// pattern): read the HTML/CSS/JS as text and assert the values; no
// browser needed. Fixture data only — generic fixture names,
// pattern-fake phone (03012345678 family), no real customer data of
// any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectCustomerListHtml } from '../nav-quick-collect.js';
import { recentQuickPickHtml, formatRecentQuickPickShortDate } from '../recent-quick-pick.js';
import { quickCollectEndOfDaySummaryHtml } from '../quick-collect-end-of-day-summary.js';
import { dsIcon, isDsIconName } from '../ds-icons.js';
import { TRANSLATIONS, VISIBLE_TEXT_UR } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const stylesSrc = read('styles.css');
const tokensSrc = read('tokens.css');
const bulkCss = read('bulk-collect.css');
const tagCss = read('new-customer-tag.css');
const bulkSrc = read('bulk-collect.js');
const tagSrc = read('new-customer-tag-sheet.js');
const qcSrc = read('nav-quick-collect.js');
const langSrc = read('nav-language.js');
const en = TRANSLATIONS.en;

// The rule block starting at the given selector text, up to its
// closing brace — scoped the same way the QC-3 test scopes its pins.
function ruleBlock(src, selector) {
  const start = src.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector} rule`);
  return src.slice(start, src.indexOf('}', start));
}

// --- (0) Icons ---------------------------------------------------------------

test('qc cash modal icons: the 6 new DS-0 names exist and render valid SVGs', () => {
  for (const name of ['Tag', 'Moon', 'Phone', 'MapPin', 'ClipboardList', 'CreditCard']) {
    assert.ok(isDsIconName(name), `${name} must be a known ds-icon name`);
    const svg = dsIcon(name, 18);
    assert.ok(svg.startsWith('<svg '), `${name}: must start with <svg`);
    assert.ok(svg.includes('width="18"'), `${name}: must honour the requested size`);
    assert.ok(svg.includes('stroke="currentColor"'), `${name}: must be a currentColor stroke icon`);
  }
  // HandCoins (Bulk Collect) already existed — the row reuses it.
  assert.ok(isDsIconName('HandCoins'), 'HandCoins must still exist for Bulk Collect');
});

// --- (1) Compact sticky header 44px ------------------------------------------

test('picker header is one 44px row: eyebrow hidden, 16px ellipsised title', () => {
  const heading = ruleBlock(stylesSrc, '#quickCollectModal:not(.qc-success-open) .modal-heading {');
  assert.ok(heading.includes('align-items: center'), 'the picker header must centre its row (the base rule is flex-start)');
  assert.ok(heading.includes('padding-top: 6px'), '6px top padding around the 32px buttons makes 44px');
  assert.ok(heading.includes('padding-bottom: 6px'), '6px bottom padding around the 32px buttons makes 44px');
  const eyebrow = ruleBlock(stylesSrc, '#quickCollectModal:not(.qc-success-open) .modal-heading .eyebrow {');
  assert.ok(eyebrow.includes('display: none'), 'the eyebrow must hide on the picker steps (it is what made the header two lines)');
  const title = ruleBlock(stylesSrc, '#quickCollectModal:not(.qc-success-open) #quickCollectTitle {');
  assert.ok(title.includes('font-size: 16px'), 'the title must be 16px on one row');
  assert.ok(title.includes('text-overflow: ellipsis'), 'a long title must ellipsis, never wrap the header to two lines');
  // The approved 52px success header is untouched: its own rules stay.
  const success = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .modal-heading {');
  assert.ok(success.includes('align-items: center'), 'the success header rules must still exist');
  // (i) and Close are already 32x32 on every step (§4.1.3/§4.1.4).
  assert.ok(stylesSrc.includes('#quickCollectModal .help-info-btn {'), 'the (i) rule must still exist');
  assert.ok(stylesSrc.includes('#quickCollectModal #closeQuickCollectModalBtn {'), 'the close rule must still exist');
});

// --- (1) Bulk Collect + Tag 2-column compact card row ------------------------

test('bulk + tag share one 2-column 44px button row, found or created by class', () => {
  const row = ruleBlock(stylesSrc, '.qc-top-actions {');
  assert.ok(row.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'the top-actions row must be two equal columns');
  assert.ok(row.includes('gap: 8px'), 'the two cards must keep an 8px gap');
  // QC True 1-Row Tightening (item A, parent decision D-A12): 44px,
  // not 40px and not the old 52px — the full titles do not fit the
  // 153px columns on one line at 0.85rem, and phone fonts run wider
  // than the harness, so 44px lets the titles wrap to two lines
  // comfortably while matching the global 44px floor; still 59px
  // shorter than the 103px cards they replace.
  const rowBtns = ruleBlock(stylesSrc, '#quickCollectModal .qc-top-actions .bc-open-btn,');
  assert.ok(rowBtns.includes('min-height: 44px !important'), 'the row buttons must be 44px');
  assert.ok(rowBtns.includes('height: 44px'), 'the row buttons must be exactly 44px tall');
  assert.ok(rowBtns.includes('font-size: 0.85rem'), 'the 0.85rem label keeps the titles legible at two lines in the 153px columns');
  // Both modules find or create the same row by class — no new id.
  assert.ok(bulkSrc.includes("pick.querySelector('.qc-top-actions')"), 'bulk must find the shared row by class');
  assert.ok(bulkSrc.includes("row.insertBefore(btn, row.firstElementChild)"), 'bulk must prepend, so it lands first');
  assert.ok(tagSrc.includes("pick.querySelector('.qc-top-actions')"), 'tag must find the shared row by class');
  assert.ok(tagSrc.includes('row.appendChild(btn)'), 'tag must append, so it lands second');
  assert.ok(!html.includes('id="qc-top-actions"'), 'the row must not be a new element id');
  // Icons: the emoji become ds-icons; the labels are unchanged.
  assert.ok(bulkSrc.includes("dsIcon('HandCoins', 18)"), 'bulk must use the HandCoins ds-icon, not 💵');
  // The open button itself carries no 💵 — scoped to its line, as the
  // tag button is scoped below. A whole-file ban no longer holds: the
  // Bulk Collect Modal Fix (item 1) puts the user-specified '📅 date ·
  // 💵 Cash · 👤 Collector' text on the collapsed settings summary bar
  // (bulkSettingsSummaryText), which is a different surface from the
  // picker open button.
  const bulkButtonLine = bulkSrc.split('\n').find((line) => line.includes("dsIcon('HandCoins', 18)"));
  assert.ok(bulkButtonLine && !bulkButtonLine.includes('💵'), 'no 💵 may remain on the bulk open button');
  assert.ok(tagSrc.includes("dsIcon('Tag', 18)"), 'tag must use the Tag ds-icon, not 🔖');
  // The sheet keeps its own 🔖 badges inside the sheet (title,
  // "First month free" rows, empty state) — only the picker open
  // button swaps to the ds-icon.
  const tagButtonLine = tagSrc.split('\n').find((line) => line.includes("dsIcon('Tag', 18)"));
  assert.ok(tagButtonLine && !tagButtonLine.includes('🔖'), 'no 🔖 may remain on the tag open button');
});

test('bulk + tag buttons lose the heavy dashed border for 1px solid var(--ds-border)', () => {
  for (const [name, css] of [['bulk', bulkCss], ['tag', tagCss]]) {
    const btn = ruleBlock(css, name === 'bulk' ? '.bc-open-btn {' : '.nct-open-btn {');
    assert.ok(btn.includes('border: 1px solid var(--ds-border)'), `${name}: the open button must be 1px solid var(--ds-border)`);
    assert.ok(!btn.includes('dashed'), `${name}: the heavy dashed border must be gone`);
    assert.ok(btn.includes('min-height: 52px'), `${name}: the open button must be 52px`);
  }
});

// --- (2) Filters, search, pills, mohalla -------------------------------------

test('sort + mohalla share one 2-column row as bare selects, no labels', () => {
  // QC True 1-Row Tightening (item A): the labels above the
  // selects are GONE (each select keeps its aria-label) — the row
  // is just the two selects side by side, Sort first, Mohalla
  // second (the Mohalla select moved here from its own row below
  // the pills). The Bill-status dropdown is deleted entirely (the
  // 4th pill 'Paid' replaces it — see the QC-12 test).
  const rowAt = html.indexOf('class="qc-filter-row-2col"');
  assert.ok(rowAt >= 0, 'the two filter selects must share one row wrapper');
  const sortAt = html.indexOf('data-qc-sort-order', rowAt);
  const mohallaAt = html.indexOf('id="mhfMohallaFilter"', rowAt);
  const rowEnd = html.indexOf('</div>', mohallaAt);
  assert.ok(sortAt > rowAt && mohallaAt > sortAt && mohallaAt < rowEnd, 'Sort and Mohalla must sit inside the row wrapper, Sort first');
  assert.ok(!html.includes('data-qc-status-filter'), 'no Bill-status dropdown may remain in the row');
  assert.ok(!html.includes('qsf-status-filter-label'), 'no filter label span may remain in the row');
  assert.ok(!html.includes('mhf-mohalla-filter-row'), 'no mohalla row wrapper may remain');
  const row = ruleBlock(stylesSrc, '.qc-filter-row-2col {');
  assert.ok(row.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'the filter row must be two equal columns');
  assert.ok(!stylesSrc.includes('.qsf-status-filter-label {'), 'no filter-label rule may remain');
  assert.ok(!stylesSrc.includes('.mhf-mohalla-filter-row {'), 'no mohalla row rule may remain');
  assert.ok(!html.includes('id="qc-filter-row-2col"'), 'the row wrapper must not be a new element id');
});

test('search placeholder is shortened, in the markup and in the i18n key', () => {
  // QC Modal Overhaul 2: the placeholder drops "or area" (the search
  // never matched area by substring — the old text promised a fourth
  // field it did not search) and gains the 🔍, so the box reads
  // "🔍 Search #ID, name, or phone" in the markup and in the key.
  assert.ok(html.includes('placeholder="🔍 Search #ID, name, or phone"'), 'the static placeholder must be the shortened text');
  assert.ok(!html.includes('Search name, #ID, phone, or area...'), 'the old placeholder must be gone from the markup');
  assert.ok(!html.includes('Search by name, #ID'), 'the old long placeholder must be gone from the markup');
  assert.equal(en.qc_search_placeholder, '🔍 Search #ID, name, or phone', 'the EN key must match the shortened placeholder');
});

test('filter pills: four pills at 12.5px, Emerald active, short High label', () => {
  // QC True 1-Row Tightening (item A): the 4th pill 'Paid' joins
  // the chips (the deleted Bill-status dropdown's paid pool), so
  // the pills no longer fit one row at 360px — they wrap to two
  // rows (+50px, disclosed in the PR body). The chip rule itself
  // is unchanged: 12.5px, 6px 10px, 44px tap target, nowrap.
  const chip = ruleBlock(stylesSrc, '.quick-collect-filter-chip {');
  assert.ok(chip.includes('font-size: 12.5px'), 'pills must be 12.5px');
  assert.ok(chip.includes('padding: 6px 10px'), 'pills must be 6px 10px');
  assert.ok(chip.includes('min-height: 44px'), 'pills must keep their 44px tap target');
  assert.ok(chip.includes('white-space: nowrap'), 'pill labels must not wrap mid-label');
  const active = ruleBlock(stylesSrc, '.quick-collect-filter-chip.is-active {');
  assert.ok(active.includes('background: var(--ds-brand)'), 'the active pill must be DS-0 Emerald, not royal blue');
  assert.ok(!active.includes('#2563eb'), 'no royal blue may remain on the active pill');
  const dark = ruleBlock(stylesSrc, '[data-theme="dark"] #quickCollectModal .quick-collect-filter-chip.is-active {');
  assert.ok(dark.includes('background: var(--ds-brand)'), 'the dark active pill must be DS-0 Emerald too');
  // The pill text is shortened so All (95) never wraps; the map key follows.
  // QC Modal Fix item 9: counts are small rounded counter badges,
  // not parens — the count lives in its own .qc-count-badge span.
  assert.ok(html.includes('High ≥ 2k <span class="qc-count-badge" id="quickCollectHighDuesCount">0</span>'), 'the pill must read "High ≥ 2k" with a counter badge, not parens');
  assert.equal(VISIBLE_TEXT_UR['High ≥ 2k'], 'زیادہ ≥ 2k', 'the UR map key must follow the shortened pill');
  assert.ok(!('High Dues ≥ 2k' in VISIBLE_TEXT_UR), 'the old long pill key must be gone from the map');
  // The 4th pill: Paid, with its count badge (see the QC-12 test
  // for the pool + count wiring).
  assert.ok(html.includes('data-filter="paid"'), 'the Paid pill must exist');
  assert.ok(html.includes('Paid <span class="qc-count-badge" id="quickCollectPaidCount">0</span>'), 'the Paid pill must carry a counter badge like its siblings');
  // The focus ring goes Emerald with the pill — scoped to the QC
  // chips only; the global :focus-visible baseline is NOT changed.
  const focus = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-filter-chip:focus-visible {');
  assert.ok(focus.includes('outline-color: var(--ds-brand)'), 'the chip focus ring must be Emerald');
  assert.ok(stylesSrc.includes(':focus-visible {\n  outline: 3px solid #2563eb !important;'), 'the global focus ring baseline must be untouched');
});

test('mohalla select sits in the 2-column row, full width, no own label', () => {
  // QC True 1-Row Tightening (item A): the Mohalla select moved
  // from its own labelled row below the pills into the 2-column
  // filter row above the search (same id + class, so its wiring
  // and the #1399 dues-first option order are untouched). The row
  // + label rules are deleted; the sizing rule stays (it is not
  // row-scoped, and the moved select still uses it).
  assert.ok(!stylesSrc.includes('.mhf-mohalla-filter-row {'), 'the mohalla row rule must be gone');
  assert.ok(!stylesSrc.includes('.mhf-mohalla-filter-row label {'), 'the mohalla row label rule must be gone');
  const select = ruleBlock(stylesSrc, '.mhf-mohalla-filter {');
  assert.ok(select.includes('width: 100%'), 'the mohalla select must be full width so the full amount shows');
  assert.ok(html.includes('id="mhfMohallaFilter"'), 'the mohalla select must still exist, in the 2-column row');
  // The label check is scoped to the picker step — other surfaces
  // (fast customer search, bulk setup) keep their own Mohalla labels.
  const stepTop = html.indexOf('id="quickCollectStepPick"');
  const searchAt = html.indexOf('id="quickCollectSearchInput"', stepTop);
  assert.ok(!html.slice(stepTop, searchAt).includes('>Mohalla</label>'), 'no mohalla label may remain in the picker step');
});

// --- (3) Recent accordion + short date badge ----------------------------------

test('recent short date: pure month-name lookup, no Date, invalid dates never badge', () => {
  assert.equal(formatRecentQuickPickShortDate('2026-11-10'), '10 Nov');
  assert.equal(formatRecentQuickPickShortDate('2026-01-05'), '5 Jan');
  assert.equal(formatRecentQuickPickShortDate('2024-02-29'), '29 Feb');
  assert.equal(formatRecentQuickPickShortDate('2023-02-29'), null);
  assert.equal(formatRecentQuickPickShortDate('2026-13-01'), null);
  assert.equal(formatRecentQuickPickShortDate(''), null);
  assert.equal(formatRecentQuickPickShortDate(null), null);
});

test('recent is an accordion: summary toggle first, rows hidden until tapped', () => {
  const entries = [
    { id: 'c-14', customerNumber: 14, name: 'Fixture Fourteen', mohalla: 'GANGALL', duesCents: 150000, lastCollectedDate: '2026-11-10', lastCollectedRecordedAt: '2026-11-10T10:00:00' },
    { id: 'c-13', customerNumber: 13, name: 'Fixture Thirteen', mohalla: 'BARRIAN', duesCents: 300000, lastCollectedDate: '2026-11-09', lastCollectedRecordedAt: '2026-11-09T10:00:00' },
  ];
  const out = recentQuickPickHtml(entries);
  assert.ok(out.includes('class="rqp-toggle"'), 'recent must render a summary toggle');
  assert.ok(out.includes('aria-expanded="false"'), 'recent must start collapsed');
  assert.ok(out.includes('Recent: 2 collected (latest: #14 Fixture Fourteen)'), 'the toggle must summarise count + latest customer');
  assert.ok(out.includes('class="rqp-rows" hidden'), 'the rows must start hidden');
  assert.ok(out.indexOf('rqp-toggle') < out.indexOf('rqp-rows'), 'the toggle must come before the rows');
  assert.ok(out.includes('rqp-date-badge">10 Nov</'), 'the latest row must badge "10 Nov"');
  assert.ok(out.includes('rqp-date-badge">9 Nov</'), 'the older row must badge "9 Nov"');
  assert.ok(!out.includes('Collected 2026-11-10'), 'no row may show the long "Collected YYYY-MM-DD" line');
  assert.ok(!out.includes('Recent — collected from'), 'the old expanded header line must be gone');
  // The toggle carries no .rqp-row, so the list's click delegation
  // cannot mistake a tap on it for a customer pick.
  const toggleAt = out.indexOf('rqp-toggle');
  const toggleEnd = out.indexOf('</button>', toggleAt);
  assert.ok(!out.slice(toggleAt, toggleEnd).includes('rqp-row'), 'the toggle must not carry .rqp-row');
  // The delegation itself handles the toggle before the row branch.
  assert.ok(qcSrc.includes("closest('.rqp-toggle')"), 'the picker click handler must see the toggle first');
  assert.ok(qcSrc.includes("toggle.setAttribute('aria-expanded'"), 'the toggle must flip aria-expanded');
  // CSS: the chevron rotates on expand; the rows container keeps its
  // [hidden] behaviour against the flex display.
  const chevron = ruleBlock(stylesSrc, '.rqp-toggle[aria-expanded="true"] .rqp-toggle-chevron {');
  assert.ok(chevron.includes('transform: rotate(180deg)'), 'the chevron must rotate on expand');
  assert.ok(stylesSrc.includes('.rqp-rows[hidden] {'), 'the rows container must keep display:none when hidden');
});

// --- (4) Round banner + actions row + eds card ---------------------------------

test('round total + today collected + Day Summary share one compact 3-cell flex banner', () => {
  // QC Modal Overhaul 2: the banner is a flex row (the dead grid rule
  // is deleted), and the Day Summary button is its third cell — the
  // separate .qc-picker-actions-row is gone. The two live lines keep
  // their DOM order (round first, then the target) and their
  // ds-stat-box cells; the button sits after them in the banner.
  const bannerAt = html.indexOf('class="qc-round-banner"');
  assert.ok(bannerAt >= 0, 'the round banner wrapper must exist');
  const rttAt = html.indexOf('id="rttRoundTotals"', bannerAt);
  const dtpAt = html.indexOf('id="dtpDailyTargetProgress"', bannerAt);
  const edsAt = html.indexOf('id="edsEndOfDaySummaryButton"', bannerAt);
  assert.ok(rttAt > bannerAt && dtpAt > rttAt, 'both live lines must sit inside the banner, round first');
  assert.ok(edsAt > dtpAt, 'the Day Summary button must sit inside the banner, after the target progress');
  assert.ok(html.includes('class="rtt-round-totals ds-stat-box"'), 'the round total must be a ds-stat-box cell');
  assert.ok(html.includes('id="dtpDailyTargetProgress" class="ds-stat-box"'), "today's collected must be a ds-stat-box cell");
  assert.ok(!html.includes('id="qc-round-banner"'), 'the banner wrapper must not be a new element id');
  assert.ok(!html.includes('class="qc-picker-actions-row"'), 'the separate actions row must be gone');
  const banner = ruleBlock(stylesSrc, '.qc-round-banner {');
  assert.ok(banner.includes('display: flex'), 'the banner must be a flex row');
  assert.ok(banner.includes('padding: 2px 10px'), 'the banner must be a true 38px row (the spec\'s 6px makes a 46px box — see D-A8)');
  const cell = ruleBlock(stylesSrc, '.qc-round-banner .ds-stat-box {');
  assert.ok(cell.includes('min-height: 0'), 'the banner cells must be compact, not the 56px stat-box height');
  // QC Modal Overhaul 2: the old "padding: 8px 10px" assertion read
  // the DEAD grid block's cell rule (deleted with it) — the live
  // flex cell rule is padding: 0, and the banner itself carries the
  // 6px 10px padding. The dead rule is gone, so the pin follows the
  // live rule.
  assert.ok(cell.includes('padding: 0'), 'the banner cells carry no padding of their own — the banner pads');
  const btn = ruleBlock(stylesSrc, '.qc-round-banner .eds-summary-button {');
  assert.ok(btn.includes('order: 3'), 'the Day Summary button must be the banner third cell');
  assert.ok(btn.includes('min-height: 32px !important'), 'the banner button must be compact at 32px');
});

test('end-of-day summary is a Day Summary button inside the banner; New customer is gone', () => {
  // QC Modal Fix item 2: "+ New customer" is REMOVED — the modal
  // is strictly for fast cash collection — and the summary button
  // is now a BarChart3 SVG + "Day Summary" (its label overflowed
  // before). Quick Collect CSS tightening (user instruction
  // 2026-11-13, parent decision D4): the 📊 is gone; the icon is
  // BarChart3, NOT BarChart2 — BarChart2 does not exist in
  // ds-icons.js, BarChart3 is the canonical bar-chart icon. QC
  // Modal Overhaul 2: the button moved INTO the banner as its third
  // cell (the separate .qc-picker-actions-row is gone) and is
  // compact (32px) instead of full-width 40px. The expanded summary
  // still sits full-width BELOW the banner, never a cell.
  const bannerAt = html.indexOf('class="qc-round-banner"');
  assert.ok(bannerAt >= 0, 'the banner must exist');
  const edsAt = html.indexOf('id="edsEndOfDaySummaryButton"', bannerAt);
  assert.ok(edsAt > bannerAt, 'the summary button must sit inside the banner');
  assert.ok(!html.includes('id="ncaNewCustomerButton"'), 'the New customer button must be gone');
  const summaryAt = html.indexOf('id="edsEndOfDaySummary"');
  assert.ok(summaryAt > html.indexOf('</div>', edsAt), 'the summary region must sit after the banner closes');
  assert.ok(!html.includes('class="qc-picker-actions-row"'), 'the actions row must be gone');
  assert.ok(!html.includes('id="qc-picker-actions-row"'), 'the row wrapper must not be a new element id');
  const btn = ruleBlock(stylesSrc, '.qc-round-banner .eds-summary-button {');
  assert.ok(btn.includes('min-height: 32px !important'), 'the banner button must be 32px (the global 44px floor needs !important to beat)');
  assert.ok(btn.includes('height: 32px'), 'the banner button must be exactly 32px tall');
  // The label is the compact "Day Summary" with a BarChart3 SVG —
  // the Moon ds-icon, the 📊 emoji and the overflowing
  // "End-of-day summary" label are gone. wireDsIcons renders the
  // icon at a fixed 20px, so the 14px size is set in CSS.
  assert.ok(html.includes('data-ds-icon="BarChart3"'), 'the summary button must carry a BarChart3 ds-icon');
  assert.ok(html.includes('Day Summary'), 'the summary button must read "Day Summary"');
  assert.ok(!html.includes('📊 Day Summary'), 'the 📊 emoji must be gone from the summary button');
  const icon = ruleBlock(stylesSrc, '.qc-round-banner .eds-summary-button svg {');
  assert.ok(icon.includes('width: 14px'), 'the Day Summary icon must render at 14px, not the 20px wireDsIcons default');
  assert.ok(icon.includes('height: 14px'), 'the Day Summary icon must be 14px tall');
  // The expanded summary REGION keeps its full aria-label — only
  // the button label is shortened, so the check is the button text.
  assert.ok(!html.includes('End-of-day summary</button>'), 'no overflowing "End-of-day summary" button label may remain');
  // The footer mode-switcher labels are the user's compact ones
  // ("⚡ Quick Entry" / "📋 Full Ledger") — the old ds-icon
  // switcher labels are gone.
  assert.ok(html.includes('⚡ Quick Entry'), 'the one-screen button must read "⚡ Quick Entry"');
  assert.ok(html.includes('📋 Full Ledger'), 'the switch button must read "📋 Full Ledger"');
  assert.ok(!html.includes('⚡ One-screen payment'), 'no old one-screen label may remain');
  assert.ok(!html.includes('📋 Switch to Full Ledger'), 'no old ledger label may remain');
  // The visible-text map keys follow the emoji (no-emoji keys now).
  assert.equal(VISIBLE_TEXT_UR['Switch to Full Ledger & Transactions Table'], 'مکمل لیجر و لین دین جدول پر جائیں');
  assert.ok(!('📋 Switch to Full Ledger & Transactions Table' in VISIBLE_TEXT_UR), 'the old 📋 ledger key must be gone');
  // QC True 1-Row Tightening (item A): the subtitle is deleted
  // from the Bulk Collect open button (icon + title only), so the
  // long bulk key goes with it — the button is now just
  // 'Bulk Collect Cash'.
  assert.equal(VISIBLE_TEXT_UR['Bulk Collect Cash'], 'یکمشت نقد وصولی', 'the short bulk key must stay for the icon + title button');
  assert.ok(!('Bulk Collect Cash many payments in one batch' in VISIBLE_TEXT_UR), 'the long bulk key must be gone with the deleted subtitle');
  assert.ok(!('many payments in one batch' in VISIBLE_TEXT_UR), 'the subtitle key must be gone too');
});

test('expanded end-of-day summary is a bordered card with an inline × top-right', () => {
  const panel = ruleBlock(stylesSrc, '.eds-summary-panel {');
  assert.ok(panel.includes('position: relative'), 'the panel must position its close');
  assert.ok(panel.includes('border: 1px solid var(--ds-border)'), 'the panel must be a clean bordered card');
  assert.ok(panel.includes('background: var(--ds-card)'), 'the panel must use the card token');
  const close = ruleBlock(stylesSrc, '.eds-panel-dismiss {');
  assert.ok(close.includes('position: absolute'), 'the close must sit inline at the top right');
  assert.ok(close.includes('top: 6px'), 'the close must sit 6px from the panel top');
  assert.ok(close.includes('right: 6px'), 'the close must sit 6px from the panel right');
  assert.ok(close.includes('width: 32px'), 'the close must be 32x32');
  assert.ok(close.includes('min-height: 32px !important'), 'the close must beat the global 44px button floor');
  // The rendered button keeps its id (the delegated handler) but is
  // an × now, not a secondary "Close" button.
  const summary = { date: '2026-11-10', count: 1, total: 150000, cashTotal: 150000, cashCount: 1, methods: [{ method: 'Cash', count: 1, total: 150000 }] };
  const out = quickCollectEndOfDaySummaryHtml(summary);
  assert.ok(out.includes('id="edsEndOfDaySummaryClose"'), 'the panel must keep its close id for the delegated handler');
  assert.ok(out.includes('aria-label="Close end-of-day summary"'), 'the × must label itself for assistive tech');
  assert.ok(out.includes('>×</button>'), 'the close must render as an inline ×');
  assert.ok(!out.includes('secondary-button'), 'the close must no longer be a secondary button');
  assert.ok(!out.includes('>Close</button>'), 'the old "Close" text button must be gone');
});

// --- (5) Unpaid cards -----------------------------------------------------------

function cardSegments(listHtml) {
  return listHtml
    .split('class="qc-customer-card')
    .slice(1)
    .map((seg) => {
      const name = (seg.match(/<span class="qc-cust-name">([^<]+)<\/span>/) || [])[1];
      return { name, html: seg };
    });
}

test('unpaid cards: badge left of the name, priority chips on their own row, figures inline on Row 1', () => {
  const customers = [
    { id: 'c-13', customerNumber: 13, name: 'Fixture Thirteen', area: 'BARRIAN', phone: '03012345678', totalDues: 3000, monthlyPackage: 3000, callHref: 'tel:03012345678', mapsUrl: 'https://www.google.com/maps?q=33.7,73.1' },
    { id: 'c-44', customerNumber: 44, name: 'Fixture Forty Four', area: 'GANGALL', phone: '', totalDues: 1500, monthlyPackage: 1500, callHref: null, mapsUrl: null },
  ];
  const priorityById = new Map([
    // The scorer emits display strings ('Medium Priority'), not
    // the lowercase tier keys — see QC2_PRIORITY_GROUPS.
    ['c-13', { group: 'Medium Priority', reasons: ['2 months unpaid (+20 points).'], openBillCount: 1, longestOverdueDays: 5 }],
  ]);
  const segments = cardSegments(renderQuickCollectCustomerListHtml(customers, null, null, '', priorityById));
  assert.equal(segments.length, 2);
  const first = segments[0].html;
  // [#13] badge inline left of the name on Row 1.
  assert.ok(first.indexOf('qc-cust-num') < first.indexOf('qc-cust-name'), 'the #13 badge must sit left of the name');
  // Quick Collect CSS tightening (user instruction 2026-11-13):
  // the priority badge left its top-right seat (.qc-card-right,
  // deleted from the picker render) for the chips row BELOW the
  // identity + figures row — this REVERSES the QC Modal Fix item 5
  // seat and the Overhaul-2 "figures on their own KPI row" shape,
  // so the header + Outstanding share Row 1 and two cards fit on
  // screen. The harness must prove the card at 360px AND 320px.
  assert.ok(!first.includes('qc-card-right'), 'the picker card must not render the top-right column anymore');
  const figuresAt = first.indexOf('qc3-figures');
  const chipsAt = first.indexOf('qc-card-chips');
  assert.ok(chipsAt >= 0 && chipsAt > figuresAt, 'the chips row must follow the figures onto its own row');
  const chipsContent = first.slice(chipsAt, first.indexOf('</div>', chipsAt));
  assert.ok(chipsContent.includes('ds-chip--warning'), 'the chips row must carry the Medium priority badge');
  assert.ok(chipsContent.includes('Medium priority'), 'the chips row must label the tier');
  assert.ok(!chipsContent.includes('qc3-figures'), 'the figures must not sit inside the chips row');
  assert.ok(!chipsContent.includes('Outstanding'), 'the Outstanding figure must stay on Row 1, not in the chips row');
  // QC Modal Fix item 3: the scorer reason is GONE from the picker
  // card — the subtitle line is now "Mohalla • Package Name", so
  // the card stays compact. The reason still renders in Field Mode
  // (field-mode.js), only the picker card drops it.
  assert.ok(!first.includes('2 months unpaid (+20 points).'), 'the scorer reason must be gone from the picker card');
  assert.ok(first.includes('BARRIAN'), 'the subtitle must carry the mohalla');
  // QC True 1-Row Tightening (item A): the dues figure itself
  // stays — exactly once, now WITHOUT its "Outstanding" label
  // (the label node is deleted; the badge already names the
  // figure, so the label was the second copy). The chips row
  // takes the badges now, so the squeeze cannot return the
  // same way.
  assert.ok(!first.includes('Outstanding'), 'the Outstanding label must be gone from the card');
  assert.ok(first.includes('PKR 3,000'), 'the dues figure must stay on Row 1');
  assert.ok(first.includes('PKR 3,000'), 'the dues figure must stay on Row 1');
  // QC Modal Overhaul 2: the Monthly package column is GONE from
  // the modal card — the dues badge above already names the figure,
  // and the column cost a full KPI row per card. Field Mode keeps
  // its monthly figure; the pool's monthlyPackage field stays for
  // it. The fixture still passes monthlyPackage (ignored by the
  // modal render now) to prove the column does not come back.
  assert.ok(!first.includes('Monthly package'), 'the monthly figure must be gone from the modal card');
  assert.ok(!first.includes('qc3-package-val'), 'the monthly figure cell must be gone from the modal card');
  // A card with no scorer row renders no chips row at all.
  assert.ok(!segments[1].html.includes('qc-card-chips'), 'a card with no priority must render no chips row');
  assert.ok(!segments[1].html.includes('qc-card-right'), 'a card with no priority must render no right column');
});

test('unpaid cards: Call / Map / Collect are ds-icons SVGs, Collect is solid Emerald', () => {
  const customers = [
    { id: 'c-13', customerNumber: 13, name: 'Fixture Thirteen', area: 'BARRIAN', phone: '03012345678', totalDues: 3000, monthlyPackage: 3000, callHref: 'tel:03012345678', mapsUrl: 'https://www.google.com/maps?q=33.7,73.1' },
  ];
  const html = renderQuickCollectCustomerListHtml(customers, null);
  assert.ok(!/📞|📍|💳/.test(html), 'no Call / Location / Collect emoji may remain on the card');
  const svgs = (html.match(/<svg /g) || []).length;
  assert.equal(svgs, 3, 'the three action buttons must each carry one ds-icon SVG');
  assert.ok(html.includes('data-qc3-action="call"'), 'Call must still be marked as a card action');
  assert.ok(html.includes('data-qc3-action="location"'), 'Location must still be marked as a card action');
  assert.ok(html.includes('data-qc3-action="collect"'), 'Collect must still be an explicit button');
  // QC Modal Overhaul 2: Collect is plain "Collect" now — the dues
  // badge above it ("PKR 3,000 DUE") already names the figure, so
  // naming it again on the button was the second copy. A settled
  // customer keeps the same plain label.
  assert.ok(!html.includes('Collect PKR 3,000</button>'), 'Collect must not repeat the amount the dues badge already names');
  assert.ok(html.includes('Collect</button>'), 'Collect must stay a plain label');
  const collect = ruleBlock(stylesSrc, '#quickCollectModal .qc3-collect {');
  // Quick Collect CSS tightening (user instruction 2026-11-13):
  // the modal's Collect is flat dark emerald now, NOT the
  // bright-green gradient — this REVERSES the QC Modal Fix item 6
  // emerald gradient for the modal only. The gradient stays on the
  // base rule for Field Mode, and the one-screen save button +
  // help Got-it button keep it too (their own rules).
  assert.ok(collect.includes('background: var(--ds-brand)'), 'modal Collect must be flat dark emerald');
  assert.ok(!collect.includes('linear-gradient'), 'the modal Collect must not carry the bright-green gradient');
  assert.ok(collect.includes('box-shadow: none'), 'the modal Collect must drop the gradient shadow');
  // QC True 1-Row Tightening (item A): the action row is a GRID
  // (auto auto 1fr) at 38px — Call / Map size to their labels,
  // Collect takes the rest. The flex 1 / 1 / 1.5 sizing is gone
  // with the flex row (see the no-crush test for the grid pin).
  assert.ok(collect.includes('min-height: 38px !important'), 'modal Collect must be 38px');
  assert.ok(collect.includes('height: 38px'), 'modal Collect must be exactly 38px tall');
  assert.ok(!collect.includes('flex:'), 'modal Collect must carry no flex sizing anymore — the grid sizes it');
  const base = ruleBlock(stylesSrc, '.qc3-collect {');
  assert.ok(base.includes('linear-gradient'), 'the base Collect gradient must stay for Field Mode');
  assert.ok(base.includes('var(--qc-collect-from)'), 'the base Collect must still start from the collect token');
  assert.ok(base.includes('color: var(--white)'), 'Collect text must be white on the Emerald');
  assert.ok(base.includes('font-weight: 600'), 'Collect must be weight 600 per the user palette');
  assert.ok(!base.includes('var(--green)'), 'the old green outline accent must be gone from Collect');
});

test('picker card geometry: figures sit inline on Row 1 — the full-width KPI line is reversed', () => {
  // QC Modal Overhaul 2: this pin is REVERSED with a why-comment.
  // The QC Cash Modal Overhaul put the figures on their own
  // full-width KPI line at every width because the Row-1 squeeze
  // clipped "Outstanding P..." above 360px and in RTL. That row
  // costs ~39px per card, and the overhaul's "2.5–3 cards on
  // screen" cannot be met with it (measured: 205px badged / 171px
  // plain, 1 fully visible). The clip cannot return the same way:
  // the name and subtitle ellipsis, the figure is nowrap with
  // min-content width, and the button still wraps — a long name
  // truncates with "…" and the figures drop to their own row when
  // they do not fit. The wrap itself stays: the button must wrap
  // at every width so the figures CAN drop when they do not fit.
  // Quick Collect CSS tightening (user instruction 2026-11-13):
  // the badge's top-right seat and the tier labels' Row-1 seat go
  // with it — both now live in the .qc-card-chips row below the
  // identity + figures, at 24px / 2px 7px / 0.72rem (item A).
  const main = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main {');
  assert.ok(main.includes('flex-wrap: wrap'), 'the picker card row must wrap at every width so the figures can drop when they do not fit');
  assert.ok(!stylesSrc.includes('#quickCollectModal .qc3-card-main > .qc-card-right {'), 'the badge top-right seat rule must be gone with the column');
  const chips = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips {');
  assert.ok(chips.includes('flex: 1 1 100%'), 'the chips row must take its own full-width row below the identity + figures');
  assert.ok(chips.includes('flex-wrap: wrap'), 'the chips row must wrap its chips, never crush them');
  assert.ok(stylesSrc.includes('#quickCollectModal .qc-card-chips .ds-chip,'), 'the chips row must size the priority badge');
  const tag = ruleBlock(stylesSrc, '#quickCollectModal .qc-card-chips .qc2-tier-label {');
  assert.ok(tag.includes('height: 24px'), 'the chips must be 24px tall');
  assert.ok(tag.includes('padding: 2px 7px'), 'the chips must be 2px 7px');
  assert.ok(tag.includes('font-size: 0.72rem'), 'the chips must be 0.72rem');
  assert.ok(!stylesSrc.includes('#quickCollectModal .qc3-card-main > .qc2-tier-label {'), 'the tier labels must not sit on Row 1 anymore — they live in the chips row');
  const figures = ruleBlock(stylesSrc, '#quickCollectModal .qc3-figures {');
  assert.ok(figures.includes('flex: 0 0 auto'), 'the figures must sit inline on Row 1, not on their own line');
  assert.ok(!figures.includes('flex: 0 0 100%'), 'the full-width KPI line must be gone');
  assert.ok(figures.includes('justify-content: flex-end'), 'the figures must stay right-aligned');
  const left = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main > .qc-card-left {');
  assert.ok(left.includes('flex: 1 1 0'), 'the identity column must take the leftover width so the figures fit');
  // QC True 1-Row Tightening (item A, parent decision D-A2): the
  // floor drops 140px -> 100px — the chips row took the badges, so
  // a short name needs less room.
  assert.ok(left.includes('min-width: 100px'), 'the identity column must keep a short name visible at the 100px floor');
  // The <=360px QC-7 media block stays: it still serves Field Mode,
  // which shares .qc3-card-main with different children.
  assert.ok(stylesSrc.includes('@media (max-width: 360px)'), 'the QC-7 360px media block must stay for Field Mode');
});

// --- Tokens + fences ------------------------------------------------------------

test('tokens: --ds-border exists in light + dark (the spec token was undefined)', () => {
  // DS-0 never defined --ds-border (only one use with a #cbd5e1
  // fallback); the overhaul defines it so the 1px solid borders
  // render from the token. Both values already existed in the file
  // (--ds-input-border), so no new distinct hex is introduced.
  assert.ok(tokensSrc.includes('--ds-border: #cbd5e1;'), 'light --ds-border must be #cbd5e1');
  assert.ok(tokensSrc.includes('--ds-border: #2d4a40;'), 'dark --ds-border must be #2d4a40');
});

test('fences: no new element id, no new store key, no new hex in the new rules', () => {
  for (const id of ['qc-top-actions', 'qc-round-banner', 'qc-picker-actions-row', 'qc-filter-row-2col']) {
    assert.ok(!html.includes(`id="${id}"`), `no new element id ${id} may appear`);
  }
  for (const src of [bulkSrc, tagSrc]) {
    assert.ok(!/shahdara_[a-z_]+/.test(src), 'the top-actions modules must add no store key');
  }
  assert.ok(!/shahdara_[a-z_]+/.test(read('recent-quick-pick.js')), 'the recent module must add no store key');
  assert.ok(!/shahdara_[a-z_]+/.test(read('quick-collect-end-of-day-summary.js')), 'the summary module must add no store key');
  assert.ok(!/shahdara_[a-z_]+/.test(read('ds-icons.js')), 'the icon set must add no store key');
});

// --- Quick Collect CSS tightening (user instruction 2026-11-13) ------
// §2 single-row banner, title Zap icon, §3 Recent toggle, §4 hidden
// inner scrollbar. The one-row FIT at 360px is harness-measured,
// not CSS-pinned — see tests/qc-modal-overhaul-2-fit.test.js.

test('tightening: the round banner is one row with the progress track on its own strip below', () => {
  // The banner keeps flex-wrap: wrap (nowrap would overflow the
  // 100%-basis track); the track takes order 4 so it always sits
  // BELOW the Today + Round + Day Summary row, never above it as
  // it did before (it had the default order 0). The bar itself is
  // slate-50 with a ds-border edge and a 10px radius.
  const banner = ruleBlock(stylesSrc, '.qc-round-banner {');
  assert.ok(banner.includes('align-items: center'), 'the banner cells must centre on one row');
  assert.ok(banner.includes('background: var(--color-slate-50)'), 'the banner must be slate-50, not slate-100');
  assert.ok(banner.includes('border: 1px solid var(--ds-border)'), 'the banner must carry a ds-border edge');
  assert.ok(banner.includes('border-radius: 10px'), 'the banner radius must be 10px');
  const track = ruleBlock(stylesSrc, '.qc-round-banner .route-progress-track {');
  assert.ok(track.includes('flex: 1 1 100%'), 'the track must take its own full-width row');
  assert.ok(track.includes('order: 4'), 'the track must sit below the row (after the order-3 button)');
});

test('tightening: the modal title carries a Zap SVG and the language switcher writes into its text span', () => {
  // The ⚡ left the qc_title strings — the icon is a Zap SVG in its
  // own span, and the i18n applier writes into .qc-title-text so it
  // cannot wipe the icon (the old textContent wipe on the h2 would
  // have deleted it on every language switch).
  assert.ok(html.includes('<span class="qc-title-icon" data-ds-icon="Zap"'), 'the title must carry a Zap icon span');
  assert.ok(html.includes('<span class="qc-title-text">'), 'the title text must live in its own span');
  assert.ok(isDsIconName('Zap'), 'Zap must be a real ds-icon');
  assert.ok(!TRANSLATIONS.en.qc_title.includes('⚡'), 'the EN title string must not carry the ⚡ anymore');
  assert.ok(!TRANSLATIONS.ur.qc_title.includes('⚡'), 'the UR title string must not carry the ⚡ anymore');
  const icon = ruleBlock(stylesSrc, '#quickCollectModal:not(.qc-success-open) #quickCollectTitle .qc-title-icon svg {');
  assert.ok(icon.includes('width: 16px'), 'the title icon must render at 16px');
  assert.ok(langSrc.includes("container.querySelector('#quickCollectTitle .qc-title-text')"), 'the applier must retarget the title wipe to the text span');
});

test('tightening: the Recent toggle is one 38px row, never clipped or wrapped', () => {
  const toggle = ruleBlock(stylesSrc, '.rqp-toggle {');
  // QC True 1-Row Tightening (item A): margin-top 8px -> 0 — the
  // 8px was the sticky-header clip clearance, but the harness
  // scrolled-bottom check proves the clip does NOT return at 0
  // (title y stays 30, header y 17 h 48, toggle top y 279 vs the
  // header bottom at 81). The clip check now lives in the harness
  // measurement, not in this margin. With the picker step gap at
  // 8px and the empty suggestion lists hidden, the Search-to-Recent
  // gap is the spec's 8px.
  assert.ok(toggle.includes('margin-top: 0'), 'the toggle must sit 0px below the search gap — the 8px clip clearance is proven unneeded by the harness');
  assert.ok(toggle.includes('height: 38px'), 'the toggle must be a fixed 38px row');
  // The global button floor is 44px !important — the height alone
  // cannot beat it; the modal-scoped min-height must.
  const modalToggle = ruleBlock(stylesSrc, '#quickCollectModal .rqp-toggle {');
  assert.ok(modalToggle.includes('min-height: 38px !important'), 'the toggle must beat the 44px button floor at 38px');
  const label = ruleBlock(stylesSrc, '.rqp-toggle-label {');
  assert.ok(label.includes('white-space: nowrap'), 'the toggle label must stay on one line');
  assert.ok(label.includes('text-overflow: ellipsis'), 'a long toggle label must ellipsis, not wrap');
  assert.ok(label.includes('min-width: 0'), 'the label must be allowed to shrink inside the flex row');
});

test('tightening: the customer list hides its inner scrollbar visuals but still scrolls', () => {
  // Parent decision D3: hide the visuals only (option (a)
  // overflow-y:visible was rejected — it kills the cap/metric).
  const list = ruleBlock(stylesSrc, '.qc-customer-list {');
  assert.ok(list.includes('scrollbar-width: none'), 'the list must hide its scrollbar in Firefox');
  assert.ok(list.includes('max-height: 460px'), 'the list cap must stay — the scrollbar hide must not remove the scroll area');
  assert.ok(list.includes('overflow-y: auto'), 'the list must still scroll');
  assert.ok(stylesSrc.includes('.qc-customer-list::-webkit-scrollbar {'), 'the list must hide its scrollbar in WebKit');
  const webkit = ruleBlock(stylesSrc, '.qc-customer-list::-webkit-scrollbar {');
  assert.ok(webkit.includes('display: none'), 'the WebKit scrollbar must be display:none');
});

test('tightening: the modal card hides its outer scrollbar visuals but still scrolls', () => {
  // QC True 1-Row Tightening (item A, parent decision D-A11): the
  // visible outer scrollbar in the user's screenshot was the CARD's
  // (92vh scroller), not the list's and not the dialog's — so the
  // D3 visuals-hide travels to the card. The card is the single
  // scroller; the dialog does not scroll (see the 1-row test file).
  const card = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-card {');
  assert.ok(card.includes('scrollbar-width: none'), 'the card must hide its scrollbar in Firefox');
  assert.ok(card.includes('overflow-y: auto'), 'the card must still scroll');
  assert.ok(card.includes('max-height: 92vh'), 'the card cap must stay 92vh');
  assert.ok(stylesSrc.includes('#quickCollectModal .quick-collect-card::-webkit-scrollbar {'), 'the card must hide its scrollbar in WebKit');
  const webkit = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-card::-webkit-scrollbar {');
  assert.ok(webkit.includes('display: none'), 'the WebKit card scrollbar must be display:none');
});
