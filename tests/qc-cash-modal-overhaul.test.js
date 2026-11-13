// QC Cash Modal Overhaul (Nov 2026) — the operator reaches the
// Unpaid Customer Queue immediately, without scrolling past truncated
// lists and stacked filters.
//
// (1) Compact sticky header 44px, single row: ⚡ Quick Collect Cash
// left, (i) 32x32 + Close 32x32 right (both already 32x32 via
// §4.1.3/§4.1.4, not success-only). Bulk Collect + Tag New Customers
// side by side in a 2-column compact card row (52px, ds-icons SVGs,
// 1px solid var(--ds-border), no heavy dashed borders).
// (2) Bill status + Sort by side by side in a 2-column row (labels
// above selects, 12px bold). Search placeholder shortened. Pending
// royal blue -> DS-0 Emerald (--ds-brand). All 3 pills on one row
// (12.5px, 6px 10px). Mohalla label above the select, full width.
// (3) Recent collapses into an accordion, collapsed by default with
// a 1-line summary; "Collected 2026-11-10" becomes a "10 Nov" badge.
// (4) Round total + today collected become a compact 2-column
// .ds-stat-box banner. End-of-day summary + New customer share a
// 2-column 40px button row; the expanded summary is a clean bordered
// card with an inline × top-right.
// (5) Unpaid cards: [#N] badge inline left of the name on Row 1,
// priority pill top-right of Row 1, the figures as their own KPI row
// below (the clipped Row-1 "Outstanding P..." rendering is deleted —
// the dues figure itself stays, exactly once, fully labelled),
// Call / Location / Collect + mode-switcher emoji become ds-icons
// SVGs, Collect is a solid Emerald primary CTA.
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

test('bulk + tag share one 2-column 52px card row, found or created by class', () => {
  const row = ruleBlock(stylesSrc, '.qc-top-actions {');
  assert.ok(row.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'the top-actions row must be two equal columns');
  assert.ok(row.includes('gap: 8px'), 'the two cards must keep an 8px gap');
  const rowBtns = ruleBlock(stylesSrc, '.qc-top-actions .bc-open-btn,');
  assert.ok(rowBtns.includes('min-height: 52px'), 'the row buttons must be 52px');
  assert.ok(rowBtns.includes('font-size: 0.85rem'), 'the 0.85rem label keeps "Bulk Collect Cash" on one line beside its icon at 360px');
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

test('bill status + sort share one 2-column row, labels above the selects', () => {
  const rowAt = html.indexOf('class="qc-filter-row-2col"');
  assert.ok(rowAt >= 0, 'the two filter labels must share one row wrapper');
  const firstLabel = html.indexOf('class="qsf-status-filter-row"', rowAt);
  const secondLabel = html.indexOf('class="qsf-status-filter-row"', firstLabel + 1);
  const rowEnd = html.indexOf('</div>', secondLabel);
  assert.ok(firstLabel > rowAt && secondLabel > firstLabel && secondLabel < rowEnd, 'both filter labels must sit inside the row wrapper');
  const row = ruleBlock(stylesSrc, '.qc-filter-row-2col {');
  assert.ok(row.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'the filter row must be two equal columns');
  const cell = ruleBlock(stylesSrc, '.qc-filter-row-2col .qsf-status-filter-row {');
  assert.ok(cell.includes('flex-direction: column'), 'each filter must stack its label above its select');
  const label = ruleBlock(stylesSrc, '.qc-filter-row-2col .qsf-status-filter-label {');
  assert.ok(label.includes('font-size: 12px'), 'filter labels must be 12px');
  assert.ok(label.includes('font-weight: 700'), 'filter labels must be bold');
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

test('filter pills: one row at 12.5px, Emerald active, short High label', () => {
  const chip = ruleBlock(stylesSrc, '.quick-collect-filter-chip {');
  assert.ok(chip.includes('font-size: 12.5px'), 'pills must be 12.5px so all three fit one row at 360px');
  assert.ok(chip.includes('padding: 6px 10px'), 'pills must be 6px 10px so all three fit one row at 360px');
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
  // The focus ring goes Emerald with the pill — scoped to the QC
  // chips only; the global :focus-visible baseline is NOT changed.
  const focus = ruleBlock(stylesSrc, '#quickCollectModal .quick-collect-filter-chip:focus-visible {');
  assert.ok(focus.includes('outline-color: var(--ds-brand)'), 'the chip focus ring must be Emerald');
  assert.ok(stylesSrc.includes(':focus-visible {\n  outline: 3px solid #2563eb !important;'), 'the global focus ring baseline must be untouched');
});

test('mohalla label sits above the select, full width', () => {
  const row = ruleBlock(stylesSrc, '.mhf-mohalla-filter-row {');
  assert.ok(row.includes('flex-direction: column'), 'the mohalla row must stack its label above the select');
  assert.ok(row.includes('align-items: stretch'), 'the stacked row must stretch the select full width');
  const label = ruleBlock(stylesSrc, '.mhf-mohalla-filter-row label {');
  assert.ok(label.includes('font-size: 12px'), 'the mohalla label must be 12px');
  assert.ok(label.includes('font-weight: 700'), 'the mohalla label must be bold');
  const select = ruleBlock(stylesSrc, '.mhf-mohalla-filter {');
  assert.ok(select.includes('width: 100%'), 'the mohalla select must be full width so the full amount shows');
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
  assert.ok(banner.includes('padding: 6px 10px'), 'the banner must be compact');
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
  // is now "📊 Day Summary" (its label overflowed before). QC Modal
  // Overhaul 2: the button moved INTO the banner as its third cell
  // (the separate .qc-picker-actions-row is gone) and is compact
  // (32px) instead of full-width 40px. The expanded summary still
  // sits full-width BELOW the banner, never a cell.
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
  // The label is the user's compact "📊 Day Summary" — the Moon
  // ds-icon and the overflowing "End-of-day summary" label are gone.
  assert.ok(html.includes('📊 Day Summary'), 'the summary button must read "📊 Day Summary"');
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
  assert.equal(VISIBLE_TEXT_UR['Bulk Collect Cash many payments in one batch'], 'یکمشت نقد وصولی — کئی ادائیگیاں ایک بیچ میں');
  assert.ok(!('💵 Bulk Collect Cash many payments in one batch' in VISIBLE_TEXT_UR), 'the old 💵 bulk key must be gone');
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

test('unpaid cards: badge left of the name, priority pill top-right, figures as their own KPI row', () => {
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
  // The priority badge sits in the .qc-card-right column (top-right
  // of Row 1); the figures sit AFTER it, on their own KPI row.
  const rightAt = first.indexOf('qc-card-right');
  const figuresAt = first.indexOf('qc3-figures');
  assert.ok(rightAt >= 0 && figuresAt > rightAt, 'the figures must follow the right column onto their own KPI row');
  const rightContent = first.slice(rightAt, first.indexOf('</div>', rightAt));
  assert.ok(rightContent.includes('ds-chip--warning'), 'the right column must carry the Medium priority badge');
  assert.ok(rightContent.includes('Medium priority'), 'the right column must label the tier');
  assert.ok(!rightContent.includes('qc3-figures'), 'the figures must not sit inside the right column anymore');
  assert.ok(!rightContent.includes('Outstanding'), 'the Outstanding figure must not sit on Row 1 anymore');
  // QC Modal Fix item 3: the scorer reason is GONE from the picker
  // card — the subtitle line is now "Mohalla • Package Name", so
  // the card stays compact. The reason still renders in Field Mode
  // (field-mode.js), only the picker card drops it.
  assert.ok(!first.includes('2 months unpaid (+20 points).'), 'the scorer reason must be gone from the picker card');
  assert.ok(first.includes('BARRIAN'), 'the subtitle must carry the mohalla');
  // The dues figure itself stays — exactly once, fully labelled, in
  // the KPI row (the clipped Row-1 rendering is what was deleted).
  assert.ok(first.includes('Outstanding'), 'the Outstanding label must stay in the KPI row');
  assert.ok(first.includes('PKR 3,000'), 'the dues figure must stay in the KPI row');
  // QC Modal Overhaul 2: the Monthly package column is GONE from
  // the modal card — the dues badge above already names the figure,
  // and the column cost a full KPI row per card. Field Mode keeps
  // its monthly figure; the pool's monthlyPackage field stays for
  // it. The fixture still passes monthlyPackage (ignored by the
  // modal render now) to prove the column does not come back.
  assert.ok(!first.includes('Monthly package'), 'the monthly figure must be gone from the modal card');
  assert.ok(!first.includes('qc3-package-val'), 'the monthly figure cell must be gone from the modal card');
  // A card with no scorer row renders no right column at all.
  assert.ok(!segments[1].html.includes('qc-card-right'), 'a card with no priority must render no right column');
});

test('unpaid cards: Call / Location / Collect are ds-icons SVGs, Collect is solid Emerald', () => {
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
  const collect = ruleBlock(stylesSrc, '.qc3-collect {');
  // QC Modal Fix item 6: Collect is the user's emerald gradient,
  // not the old solid Emerald — the tonal palette lives in
  // tokens.css (--qc-collect-from / --qc-collect-to).
  assert.ok(collect.includes('linear-gradient'), 'Collect must be the emerald gradient');
  assert.ok(collect.includes('var(--qc-collect-from)'), 'Collect must start from the collect token');
  assert.ok(collect.includes('color: var(--white)'), 'Collect text must be white on the Emerald');
  assert.ok(collect.includes('font-weight: 600'), 'Collect must be weight 600 per the user palette');
  assert.ok(!collect.includes('var(--green)'), 'the old green outline accent must be gone from Collect');
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
  const main = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main {');
  assert.ok(main.includes('flex-wrap: wrap'), 'the picker card row must wrap at every width so the figures can drop when they do not fit');
  const right = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main > .qc-card-right {');
  assert.ok(right.includes('align-self: flex-start'), 'the priority badge must sit top-right of Row 1');
  const figures = ruleBlock(stylesSrc, '#quickCollectModal .qc3-figures {');
  assert.ok(figures.includes('flex: 0 0 auto'), 'the figures must sit inline on Row 1, not on their own line');
  assert.ok(!figures.includes('flex: 0 0 100%'), 'the full-width KPI line must be gone');
  assert.ok(figures.includes('justify-content: flex-end'), 'the figures must stay right-aligned');
  const left = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main > .qc-card-left {');
  assert.ok(left.includes('flex: 1 1 0'), 'the identity column must take the leftover width so the figures fit');
  assert.ok(left.includes('min-width: 140px'), 'the identity column must keep a short name visible');
  // The <=360px QC-7 media block stays: it still serves Field Mode,
  // which shares .qc3-card-main with different children.
  assert.ok(stylesSrc.includes('@media (max-width: 360px)'), 'the QC-7 360px media block must stay for Field Mode');
  const labels = ruleBlock(stylesSrc, '#quickCollectModal .qc3-card-main > .qc2-tier-label {');
  assert.ok(labels.includes('margin-left: auto'), 'tier labels must stay right-aligned on their own line');
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
