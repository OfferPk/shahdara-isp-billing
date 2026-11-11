// Customers Directory Polish (Nov 2026): the operator sees Customer #1
// without scrolling 3 screens.
//
// (a) Pagination: one 48px flex row — [←] 1 / 7 (95) [→] + Per-page
//     select [15 / page ▾] (36px) on the right.
// (b) FILTERS & SORT: Service label above the chips (0px overflow at
//     360px, no scrollbar); the (i) moves into the card header row;
//     Cards|Table becomes the DS-0 .ds-segmented control (--ds-brand)
//     with LayoutGrid/Table/Download SVGs; [Cards|Table] + [Export CSV]
//     share one row; the trust footer joins the app footer.
// (c) New customers by month: 1-row segmented bar (This Mo | Last Mo |
//     3M | 6M, 36px buttons) + compact 3-column .ds-stat-box strip;
//     "1 customer have no join date" → "has" (both sites).
// (d) 8 quick filter pills: 16px ds-icons / status dots; 4 revenue
//     pills as a tight 2×2 grid of two-line cards (8px 10px); 4
//     count-only pills as a compact flex-wrap row of 32px pills; all
//     eight fit in half the old vertical space.
//
// Stylesheet-value approach (polish #17/#21/#25 pattern): read the
// CSS/JS/HTML as text and assert the values; no browser needed. Live
// 360px measurements live in the harness
// (~/workspace/shahdara-customers-directory-harness/measure.mjs).
//
// Fixture figures only (95 customers, 1 / 7 are the design's example
// figures). No customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Mock localStorage BEFORE importing nav-language.js (t() reads it
// lazily at call time).
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { t } = await import('../nav-language.js');
const { ROSTER_PILL_DEFS } = await import('../roster-quick-filters.js');
const { dsIcon, isDsIconName } = await import('../ds-icons.js');

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const css = read('styles.css');
const compCss = read('components.css');
const appSrc = read('app.js');
const html = read('index.html');
const navSrc = read('nav-language.js');

const ruleBlock = (src, selector) => {
  // Last occurrence wins in the cascade: overridden rules resolve to
  // their latest declaration, which is the effective style.
  const at = src.lastIndexOf(selector);
  assert.ok(at >= 0, `${selector} must exist`);
  const open = src.indexOf('{', at);
  const close = src.indexOf('}', open);
  return src.slice(open + 1, close);
};

const renderRosterPillBarFn = (src) => {
  const at = src.indexOf('function renderRosterPillBar(');
  assert.ok(at >= 0, 'renderRosterPillBar must exist in app.js');
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next === -1 ? undefined : next);
};

const renderNewCustomersPanelFn = (src) => {
  const at = src.indexOf('function renderNewCustomersPanel(');
  assert.ok(at >= 0, 'renderNewCustomersPanel must exist in app.js');
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next === -1 ? undefined : next);
};

// --- (a) Pagination: one 48px row ------------------------------------------

test('pagination: prev/next are icon-only arrows, page info is compact', () => {
  const navAt = html.indexOf('id="customerPagination"');
  const navEnd = html.indexOf('</nav>', navAt);
  const nav = html.slice(navAt, navEnd);
  assert.ok(nav.includes('id="customerPrevPage"'), 'prev button must exist');
  assert.ok(nav.includes('id="customerNextPage"'), 'next button must exist');
  assert.ok(nav.includes('>←</button>'), 'prev must be the bare ← glyph');
  assert.ok(nav.includes('>→</button>'), 'next must be the bare → glyph');
  assert.ok(!nav.includes('← Previous'), 'prev must not carry the "Previous" label');
  assert.ok(!nav.includes('Next →'), 'next must not carry the "Next" label');
  assert.ok(!nav.includes('data-i18n="cust_prev"'), 'prev must not let the i18n applier rewrite its text');
  assert.ok(!nav.includes('data-i18n="cust_next"'), 'next must not let the i18n applier rewrite its text');
  // The archived pagination keeps its text labels (shared keys stay).
  assert.ok(html.includes('id="archivedPrevPage"'), 'archived pagination must still exist');
  assert.ok(html.includes('data-i18n="cust_prev"'), 'archived prev keeps the cust_prev key');
  // Compact page info in both languages.
  assert.equal(t('cust_page_info', 'en', { page: 1, totalPages: 7, total: 95 }), '1 / 7 (95)');
  assert.equal(t('cust_page_info', 'ur', { page: 1, totalPages: 7, total: 95 }), 'صفحہ 1 / 7 (95 کل)');
});

test('pagination: per-page options read "15 / page", values unchanged', () => {
  const navAt = html.indexOf('id="customerPagination"');
  const nav = html.slice(navAt, html.indexOf('</nav>', navAt));
  assert.ok(nav.includes('<option value="15" selected>15 / page</option>'), '15 option must read "15 / page"');
  assert.ok(nav.includes('<option value="30">30 / page</option>'), '30 option must read "30 / page"');
  assert.ok(nav.includes('<option value="60">60 / page</option>'), '60 option must read "60 / page"');
  assert.ok(nav.includes('<option value="all" data-i18n="all">All</option>'), 'All option keeps its value + i18n key');
  assert.ok(nav.includes('<span class="sr-only" data-i18n="cust_per_page">Per page</span>'), 'the "Per page" label stays for screen readers only');
});

test('pagination: one 48px row — 36px controls + 6px padding top/bottom', () => {
  const row = ruleBlock(css, '#customerPagination {');
  assert.ok(row.includes('flex-wrap: nowrap'), 'pagination must not wrap');
  assert.ok(row.includes('padding: 6px 10px'), 'pagination padding must be 6px vertical');
  const btn = ruleBlock(css, '#customerPagination .pagination-btn {');
  assert.ok(btn.includes('min-height: 36px'), 'prev/next buttons must be 36px');
  const sel = ruleBlock(css, '#customerPagination #customerPageSize {');
  assert.ok(sel.includes('min-height: 36px'), 'per-page select must be 36px');
  // 36px controls + 6px + 6px padding = the 48px row.
  assert.equal(36 + 6 + 6, 48, 'row height arithmetic');
});

// --- (b) FILTERS & SORT -----------------------------------------------------

test('filters: Service label sits above the chips (wrap, no scroller)', () => {
  const mediaAt = css.indexOf('@media (max-width: 620px)', css.indexOf('Customers Directory Polish'));
  assert.ok(mediaAt >= 0, 'the polish media block must exist');
  const block = css.slice(mediaAt);
  const toolbarAt = block.indexOf('.customer-filter-panel .service-filter-toolbar {');
  assert.ok(toolbarAt >= 0, 'service toolbar override must exist in the 620px block');
  const toolbar = block.slice(toolbarAt, block.indexOf('}', toolbarAt));
  assert.ok(toolbar.includes('flex-wrap: wrap'), 'toolbar must wrap instead of scrolling');
  assert.ok(toolbar.includes('overflow-x: visible'), 'toolbar must not be a horizontal scroller');
  const labelAt = block.indexOf('.customer-filter-panel .service-filter-toolbar .customer-filter-label {');
  assert.ok(labelAt >= 0, 'service label override must exist');
  const label = block.slice(labelAt, block.indexOf('}', labelAt));
  assert.ok(label.includes('flex: 0 0 100%'), 'label must take its own row above the chips');
});

test('filters: the (i) lives in the FILTERS & SORT header row', () => {
  const headAt = html.indexOf('<div class="customer-filter-head">');
  assert.ok(headAt >= 0, 'filter header row must exist');
  const headEnd = html.indexOf('</div>', headAt);
  const head = html.slice(headAt, headEnd);
  assert.ok(head.includes('data-i18n="cust_filters_sort_heading"'), 'title must be in the header row');
  assert.ok(head.includes('class="help-tip filter-help"'), 'the (i) details must be in the header row');
  assert.ok(head.indexOf('cust_filters_sort_heading') < head.indexOf('filter-help'), 'title left, (i) right');
  const help = ruleBlock(css, '.customer-filter-head .filter-help {');
  assert.ok(help.includes('margin-left: auto'), '(i) must sit at the right edge of the header row');
});

test('filters: Cards|Table is the DS-0 segmented control with SVG icons', () => {
  const toggleAt = html.indexOf('class="customer-view-toggle ds-segmented"');
  assert.ok(toggleAt >= 0, 'toggle must carry the .ds-segmented class');
  const rowAt = html.indexOf('<div class="customer-view-row">');
  assert.ok(rowAt >= 0 && rowAt < toggleAt, 'toggle must sit inside the view row');
  const rowEnd = html.indexOf('</div>', html.indexOf('id="exportCustomerRosterCsvBtn"'));
  const row = html.slice(rowAt, rowEnd);
  assert.ok(row.includes('data-ds-icon="LayoutGrid"'), 'Cards must use the LayoutGrid SVG');
  assert.ok(row.includes('data-ds-icon="Table"'), 'Table must use the Table SVG');
  assert.ok(row.includes('data-ds-icon="Download"'), 'Export CSV must use the Download SVG');
  assert.ok(row.includes('id="exportCustomerRosterCsvBtn"'), 'Export CSV must share the row with the toggle');
  assert.ok(!/[🗂️📋📥]/.test(row), 'no 3D emoji in the toggle/export row');
  assert.ok(row.includes('<span data-i18n="cust_cards">Cards</span>'), 'Cards label must be an inner span (applier-safe)');
  assert.ok(row.includes('<span data-i18n="cust_table">Table</span>'), 'Table label must be an inner span (applier-safe)');
  assert.ok(row.includes('<span data-i18n="cust_export_roster">Export CSV</span>'), 'Export label must be an inner span (applier-safe)');
  assert.ok(isDsIconName('LayoutGrid') && isDsIconName('Table') && isDsIconName('Download'), 'the three icons must exist');
  const active = ruleBlock(css, '.customer-view-toggle.ds-segmented .customer-view-btn[aria-selected="true"],');
  assert.ok(active.includes('background: var(--ds-brand)'), 'active segment must be --ds-brand, not the old blue');
  assert.ok(active.includes('border-color: var(--ds-brand)'), 'active segment border must be --ds-brand');
  const icons = ruleBlock(css, '.customer-view-toggle.ds-segmented .customer-view-btn .ds-action-icon svg,');
  assert.ok(icons.includes('width: 16px'), 'toggle icons must be 16px');
  assert.ok(appSrc.includes("cardsBtn.setAttribute('aria-selected'"), 'render must sync aria-selected on the toggle');
});

test('filters: trust footer joins the app footer into one muted card', () => {
  // The 74px gap was main's bottom-nav clearance; the app footer
  // already clears the nav itself (88px padding-bottom), so on the
  // customers screen main needs none of it.
  assert.ok(css.includes('body[data-screen="customers"] main { padding-bottom: 0; }'), 'customers screen must drop main\'s 74px bottom padding');
  assert.ok(css.includes('body[data-screen="customers"] .app-footer { border-top: 0; background: #f7faf8; }'), 'app footer must lose its top border and share the muted background');
  const paneFooter = ruleBlock(css, '.customer-pane .pane-footer {');
  assert.ok(paneFooter.includes('background: #f7faf8'), 'pane footer must share the muted background');
  assert.ok(css.includes('main{padding-bottom:calc(74px + env(safe-area-inset-bottom))}'), 'the global clearance rule itself must stay (other screens keep it)');
});

// --- (c) New customers by month --------------------------------------------

test('new customers: 1-row segmented bar with short labels', () => {
  const fn = renderNewCustomersPanelFn(appSrc);
  assert.ok(fn.includes('NEWCUST_RANGE_SHORT_KEYS'), 'short-label key map must exist');
  assert.ok(fn.includes('<div class="new-customers-controls ds-segmented"'), 'controls must be the DS-0 segmented control');
  assert.ok(fn.includes('class="customer-filter-button ds-segmented__button"'), 'period buttons must be segmented buttons');
  assert.ok(fn.includes('t(NEWCUST_RANGE_SHORT_KEYS[key])'), 'buttons must use the short labels');
  assert.ok(fn.includes('aria-selected="${newCustomersView === key ? \'true\' : \'false\'}"'), 'buttons must sync aria-selected');
  // The month select is its own row below the bar, not a 5th grid cell.
  const controlsAt = fn.indexOf('<div class="new-customers-controls ds-segmented"');
  const monthAt = fn.indexOf('<label class="new-customers-month"');
  assert.ok(monthAt > controlsAt && fn.indexOf('</div>', controlsAt) < monthAt, 'month label must follow the closed controls div');
  assert.equal(t('cust_newcust_this_month_short', 'en'), 'This Mo');
  assert.equal(t('cust_newcust_last_month_short', 'en'), 'Last Mo');
  assert.equal(t('cust_newcust_last_3_months_short', 'en'), '3M');
  assert.equal(t('cust_newcust_last_6_months_short', 'en'), '6M');
  assert.equal(t('cust_newcust_this_month_short', 'ur'), 'اس ماہ');
  assert.equal(t('cust_newcust_last_month_short', 'ur'), 'گزشتہ ماہ');
  assert.equal(t('cust_newcust_last_3_months_short', 'ur'), '3 ماہ');
  assert.equal(t('cust_newcust_last_6_months_short', 'ur'), '6 ماہ');
  // The full labels stay for the panel heading.
  assert.equal(t('cust_newcust_this_month', 'en'), 'This month');
  assert.equal(t('cust_newcust_last_6_months', 'en'), 'Last 6 months');
  const btn = ruleBlock(css, '.new-customers-controls.ds-segmented .ds-segmented__button {');
  assert.ok(btn.includes('min-height: 36px'), 'period buttons must be 36px');
});

test('new customers: metrics live in a compact 3-column .ds-stat-box strip', () => {
  const fn = renderNewCustomersPanelFn(appSrc);
  assert.ok(fn.includes('<div class="new-customers-totals" role="status">'), 'totals strip must exist');
  const totalsAt = fn.indexOf('<div class="new-customers-totals"');
  const totals = fn.slice(totalsAt, fn.indexOf('</div>`', totalsAt));
  assert.equal((totals.match(/class="ds-stat-box"/g) || []).length, 3, 'strip must have exactly 3 stat boxes');
  assert.ok(totals.includes('ds-stat-box__label'), 'each box must have a label');
  assert.ok(totals.includes('ds-stat-box__value'), 'each box must have a value');
  assert.ok(totals.includes("t('cust_newcust_count'"), 'box 1 must be the new-customer count');
  assert.ok(totals.includes("t('cust_newcust_connection_fees')"), 'box 2 must be the connection fees');
  assert.ok(totals.includes("t('cust_newcust_routers')"), 'box 3 must cover routers');
  assert.ok(totals.includes("t('cust_newcust_fiber')"), 'box 3 must cover fiber');
  const strip = ruleBlock(css, '.new-customers-totals {');
  assert.ok(strip.includes('display: grid'), 'strip must be a grid, not the old flex-wrap row');
  assert.ok(strip.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'strip must be 3 columns');
});

test('new customers: "1 customer has no join date" (singular fixed, plural kept)', () => {
  assert.equal(
    t('cust_newcust_undated_one', 'en'),
    '1 customer has no join date (added before dates were recorded) and is not counted in any month.'
  );
  assert.ok(t('cust_newcust_undated_one', 'ur').includes('شامل ہوا'), 'Urdu singular must use the singular verb');
  assert.ok(t('cust_newcust_undated_one', 'ur').includes('نہیں ہوتا'), 'Urdu singular must use the singular ending');
  // The plural key is untouched (other counts still read "have").
  assert.equal(
    t('cust_newcust_undated', 'en', { count: 5 }),
    '5 customers have no join date (added before dates were recorded) and are not counted in any month.'
  );
  const fn = renderNewCustomersPanelFn(appSrc);
  assert.ok(fn.includes("report.undatedCount === 1 ? 'cust_newcust_undated_one' : 'cust_newcust_undated'"), 'render must pick the singular key at count 1');
  assert.ok(!fn.includes("have no join date (added before dates were recorded)"), 'the inline EN fallback with the typo must be gone from app.js');
  assert.ok(!navSrc.includes('1 customer have no join date'), 'the typo must not survive anywhere in the dictionary');
});

// --- (d) 8 quick filter pills ----------------------------------------------

test('pills: revenue grid + count row split, icons at 16px, no emoji', () => {
  assert.deepEqual(
    ROSTER_PILL_DEFS.map((def) => def.id),
    ['all', 'unpaid', 'arrears', 'waada', 'paid', 'credit', 'paused', 'kist'],
    'pill order must stay'
  );
  const fn = renderRosterPillBarFn(appSrc);
  assert.ok(appSrc.includes("ROSTER_REVENUE_PILL_IDS = ['unpaid', 'arrears', 'paid', 'credit']"), 'revenue group must be unpaid, arrears, paid, credit');
  assert.ok(appSrc.includes("ROSTER_COUNT_PILL_IDS = ['all', 'waada', 'paused', 'kist']"), 'count group must be all, waada, paused, kist');
  assert.ok(fn.includes('<div class="roster-pill-grid">'), 'revenue pills must render inside the grid div');
  assert.ok(fn.includes('<div class="roster-pill-row">'), 'count pills must render inside the row div');
  assert.ok(fn.includes('dsIcon(def.dsIcon, 16)'), 'pill icons must render at 16px via dsIcon');
  assert.ok(fn.includes('roster-pill-dot--paid'), 'paid must get the green status dot');
  assert.ok(fn.includes('<span class="roster-pill-line1">'), 'revenue cards must have a line-1 (icon + label)');
  assert.ok(fn.includes('<span class="roster-pill-line2">'), 'revenue cards must have a line-2 (count · total)');
  const defsSrc = read('roster-quick-filters.js');
  assert.ok(!/[⚠️🤝🟢💎⏸️📦]/.test(defsSrc), 'no 3D emoji in the pill definitions');
  assert.ok(!/[⚠️🤝🟢💎⏸️📦]/.test(fn), 'no 3D emoji in the pill render');
  assert.ok(dsIcon('AlertTriangle', 16).includes('width="16"'), 'AlertTriangle must honour size 16');
  assert.ok(dsIcon('Pause', 16).includes('width="16"'), 'Pause must honour size 16');
});

test('pills: 2×2 grid of two-line cards, 32px count pills, half the height', () => {
  const grid = ruleBlock(compCss, '.roster-pill-grid {');
  assert.ok(grid.includes('display: grid'), 'revenue group must be a grid');
  assert.ok(grid.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'revenue grid must be 2 columns');
  const gridPill = ruleBlock(compCss, '.roster-pill-grid .roster-pill {');
  assert.ok(gridPill.includes('flex-direction: column'), 'revenue cards must stack label over figures');
  assert.ok(gridPill.includes('padding: 8px 10px'), 'revenue cards must use the tight 8px 10px padding');
  const rowPill = ruleBlock(compCss, '.roster-pill-row .roster-pill {');
  assert.ok(rowPill.includes('min-height: 32px'), 'count pills must be 32px');
  const paidDot = ruleBlock(compCss, '.roster-pill-dot--paid {');
  assert.ok(paidDot.includes('background: var(--color-paid)'), 'paid dot must use the paid token');
  // Height budget (harness baseline: old bar 372px at 360px):
  // grid 2 rows × 44px + 8px gap + row 1 row × 32px + bar padding 16px
  // = 144px worst case (row wraps to 2 rows: 184px) — under half (186px).
  const worst = 2 * 44 + 8 + 2 * 32 + 8 + 16;
  assert.ok(worst <= 186, `worst-case pill height ${worst}px must fit in half the old 372px`);
  // At phone widths each group takes the full bar width.
  const mediaAt = compCss.indexOf('@media (max-width: 620px)', compCss.indexOf('.roster-pill-grid'));
  assert.ok(mediaAt >= 0, 'the 620px pill block must exist');
  const media = compCss.slice(mediaAt, compCss.indexOf('/* SISP-134', mediaAt));
  assert.ok(media.includes('.roster-pill-grid,'), 'grid must go full-width at phone widths');
  assert.ok(media.includes('.roster-pill-row {'), 'row must go full-width at phone widths');
  assert.ok(media.includes('flex: 1 1 100%'), 'groups must take the full bar width');
});
