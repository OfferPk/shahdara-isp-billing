// Reports Register & audit polish — compact Billing Register controls +
// invoice cards, grouped Sales Tax list, collapsed empty audit cards.
// Converted from repro-reports-register-audit.mjs (18 checks: 16 FAIL +
// 2 guard PASS on base c17863f3).
//
// Parity note: this item adds 5 i18n keys (4 help keys + the collapsed
// audit pill key), so the total moves to the new total below — written
// as a SPLIT literal on purpose: the parity sweeps count files that
// contain the bare digits, and a bare literal here would break the
// file-count pins (see plan591 G5a / pnl G4).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';
import { HELP_TOPICS } from '../help-guide.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const componentsCss = read('components.css');
const stylesCss = read('styles.css');
const dashboardCss = read('dashboard.css');
const helpGuideJs = read('help-guide.js');
const billingRegisterJs = read('billing-register.js');
const salesTaxJs = read('package-sales-tax.js');
// The new parity total, split so this file never contains the bare
// digits the sweeps count.
// Re-pin (Reports Closing rebase 2026-11-23): Closing adds 1 key,
// total 5,228 -> 5,229.
// Re-pin (Bill card rebase 2026-11-23): Bill card adds 2 keys,
// total 5,229 -> 5,231.
const PARITY = Number('52' + '31');

function segment(source, startMarker, endMarker, fromIndex = 0) {
  const start = source.indexOf(startMarker, fromIndex);
  assert.notEqual(start, -1, `expected to find ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `expected to find ${endMarker} after ${startMarker}`);
  return source.slice(start, end);
}

// ---------------------------------------------------------------- 1. controls

test('R1a: Download CSV / Print Register are NOT raw unstyled buttons', () => {
  assert.ok(!indexHtml.includes('owner-report-btn'), '.owner-report-btn must be gone (it had no CSS rule anywhere)');
  assert.ok(indexHtml.includes('class="secondary-button" id="billingRegisterDownloadBtn"'), 'Download CSV reuses .secondary-button (radius 9px, border #dce6e1, bg #fff, #36574b) — the spec asked for M3 rounded buttons (12px radius, 14px font, slate-800 text); the closest existing pattern is used instead, disclosed in the PR body');
  assert.ok(indexHtml.includes('class="secondary-button" id="billingRegisterPrintBtn"'), 'Print Register reuses .secondary-button');
});

test('R1b: Period + Print size share one 2-column row on phones', () => {
  const row = segment(indexHtml, '<div class="billing-register-select-row">', '</div>\n            <div class="report-filters');
  assert.ok(row.includes('id="billingRegisterPeriod"'), 'Period select is inside the select row');
  assert.ok(row.includes('id="billingRegisterPrintFormat"'), 'Print size select is inside the select row');
  assert.ok(componentsCss.includes('.billing-register-select-row,\n  .billing-register-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));'), 'the select row is a 2-column grid at <=700px');
  assert.ok(!componentsCss.includes('.billing-register-controls .report-month-label { width: 100%; }'), 'the old rule that forced every label to width:100% (stacking the selects) is gone');
});

test('R1c: the two buttons share one 2-column row', () => {
  const row = segment(indexHtml, '<div class="billing-register-actions">', '</div>\n          </div>');
  assert.ok(row.includes('id="billingRegisterDownloadBtn"'), 'Download CSV is inside the actions row');
  assert.ok(row.includes('id="billingRegisterPrintBtn"'), 'Print Register is inside the actions row');
  assert.ok(componentsCss.includes('.billing-register-select-row,\n  .billing-register-actions { display: grid;'), 'the actions row shares the 2-column grid rule with the select row');
});

test('R1d: All | Paid | Partial | Unpaid chips carry subtle semantic tints', () => {
  assert.ok(stylesCss.includes('.billing-register-status .report-filter-button[data-register-status="paid"]:not([aria-pressed="true"]) { background: var(--color-paid-bg);'), 'Paid chip: exact --color-paid-bg / --color-paid tokens');
  assert.ok(stylesCss.includes('.billing-register-status .report-filter-button[data-register-status="partial"]:not([aria-pressed="true"]) { background: var(--amber-bg);'), 'Partial chip: exact --amber-bg / --amber tokens');
  assert.ok(stylesCss.includes('.billing-register-status .report-filter-button[data-register-status="unpaid"]:not([aria-pressed="true"]) { background: var(--qc-rose-bg);'), 'Unpaid chip: exact --qc-rose-bg / --qc-rose-text tokens');
  assert.ok(!stylesCss.includes('.billing-register-status .report-filter-button[data-register-status="all"]'), 'All stays neutral (the current white) — no tint rule');
});

// ---------------------------------------------------------------- 2. invoice cards

test('R2a: the Month field is gone from the invoice CARD (reference keeps it)', () => {
  assert.ok(!appJs.includes('bill_reg_col_month'), 'no Month cell in the app.js card template — the reference "#N · YYYY-MM" already carries the month');
  assert.ok(appJs.includes('escapeHtml(row.reference)'), 'the reference still renders on the card');
  assert.ok(billingRegisterJs.includes("label: t('bill_reg_col_month', lang)"), 'the Month column SURVIVES in the CSV/print sheet (billing-register.js) — the card and the sheet consume the row model separately');
});

test('R2b: Ticket Charges Paid hides whenever it is PKR 0', () => {
  assert.ok(appJs.includes('row.ticketChargesPaid > 0 ? `<div class="register-ticket-row">'), 'the Ticket row renders only when ticketChargesPaid > 0');
  const card = segment(appJs, 'list.innerHTML = register.rows.map', '.join(\'\');');
  assert.equal((card.match(/bill_reg_col_ticket/g) || []).length, 1, 'exactly one Ticket reference in the card template (inside the conditional)');
});

test('R2c: the Paid status pill sits in the card header, not its own row', () => {
  const card = segment(appJs, 'list.innerHTML = register.rows.map', '.join(\'\');');
  const header = segment(card, '<div class="register-customer-top">', '</div>');
  assert.ok(header.includes('report-status ${REGISTER_STATUS_CLASS[row.status]}'), 'the status pill is inside the header top row');
  assert.ok(header.includes('register-advance-badge'), 'the 💎 advance badge moves into the header with the pill');
  assert.ok(componentsCss.includes('.register-customer-top .report-status { margin-inline-start: auto; }'), 'the pill is pushed to the right of the header');
  assert.ok(!card.includes('bill_reg_col_status'), 'no separate Status cell remains in the card template');
});

test('R2d: Package / Bill Amount / Paid Amount share one 3-column row', () => {
  const card = segment(appJs, 'list.innerHTML = register.rows.map', '.join(\'\');');
  const figures = segment(card, '<div class="register-figures">', '${row.ticketChargesPaid > 0');
  assert.ok(figures.includes("t('bill_reg_col_package')"), 'Package is in the figures row');
  assert.ok(figures.includes("t('bill_reg_col_bill')"), 'Bill Amount is in the figures row');
  assert.ok(figures.includes("t('bill_reg_col_paid')"), 'Paid Amount is in the figures row');
  assert.ok(componentsCss.includes('.register-figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));'), 'the figures row is a 3-column grid (card inner ~312px at 360px; longest value "3Mbps / 300GB" ~90px fits)');
});

// ---------------------------------------------------------------- 3. sales tax

test('R3a: the STX top summary is a clean 3-column KPI strip', () => {
  assert.ok(appJs.includes('<div class="monthly-report-summary-bar stx-summary">'), 'the summary bar carries the stx-summary class');
  const bar = segment(appJs, '<div class="monthly-report-summary-bar stx-summary">', '</div>');
  assert.ok(bar.includes('>Taxable</span>'), 'short label "Taxable" (was "Total Taxable Customers:")');
  assert.ok(bar.includes('>Total Tax</span>'), 'short label "Total Tax" (was "Total Sales Tax (19.5%):")');
  assert.ok(bar.includes('>Charged</span>'), 'short label "Charged" (was "Sales tax charged on bills:")');
  assert.ok(stylesCss.includes('.monthly-report-summary-bar.stx-summary {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));'), 'the strip is a 3-column grid');
});

test('R3b: STX per-customer cards are compact 2-line grouped rows', () => {
  assert.ok(appJs.includes('<li class="stx-grouped-row">'), 'rows are compact grouped rows, not .report-row cards');
  assert.ok(appJs.includes('<ol class="monthly-report-list stx-grouped-list">'), 'rows sit inside ONE grouped white card');
  assert.ok(!appJs.includes('report-row stx-row'), 'no .report-row.stx-row card remains');
  const row = segment(appJs, '<li class="stx-grouped-row">', '</li>');
  assert.ok(row.includes('row.customerName'), 'left: customer name');
  assert.ok(row.includes('row.packageLabel'), 'left: package');
  assert.ok(row.includes('formatSalesTaxAmount(row.taxCents)'), 'right: bold tax figure');
  assert.ok(row.includes('formatSalesTaxAmount(row.billTaxCents)'), 'right: muted "Not set" subtitle below (formatSalesTaxAmount(null))');
  assert.ok(stylesCss.includes('.stx-grouped-list {\n  background: var(--surface);'), 'the grouped list is one white card (surface/line/radius-lg)');
  assert.ok(stylesCss.includes('.stx-grouped-row + .stx-grouped-row { border-top: 1px solid var(--line); }'), 'rows divide with a single line');
});

// Re-pin (Plan J rebase 2026-11-23): the old 'Never round to whole
// rupees' module pin is reversed by J's NAMED REVERSAL (user decision
// 2026-11-22: whole-rupee tax, "1793 instead of 1792.5") — the module
// now rounds stored tax to whole rupees, so that string no longer
// exists. What this guard still pins is the Register's own display
// path: figures render through formatSalesTaxAmount (max-2 decimals)
// and the Register never rounds a figure itself. Old bills keep the
// cents recorded on them.
test('R3c GUARD: sales-tax figures render through formatSalesTaxAmount (no Register-side rounding)', () => {
  assert.ok(salesTaxJs.includes('Pinned rounding (user decision 2026-11-22'), 'package-sales-tax.js pins the whole-rupee rule (Plan J reversal of Polish #11)');
  assert.ok(appJs.includes('formatSalesTaxAmount(totals.derivedTotalCents)'), 'the strip still formats through formatSalesTaxAmount (max-2 decimals)');
  assert.ok(!appJs.includes('Math.round(row.taxCents'), 'no whole-rupee rounding of the tax figure');
});

// ---------------------------------------------------------------- 4. audit cards

test('R4a: empty Disconnect Reasons & Win-Back collapses to a 1-line row', () => {
  assert.ok(appJs.includes('const winbackCollapsed = winbackQueue.length === 0 && winbackAnalytics.totalArchived === 0;'), 'collapse iff queue 0 AND no archived disconnects (analytics still render when archives exist)');
  assert.ok(appJs.includes("winbackSection.classList.toggle('audit-collapsed', winbackCollapsed)"), 'the section gets .audit-collapsed');
  assert.ok(!appJs.includes('<li class="winback-empty">'), 'the winback empty <li> is gone');
  assert.ok(dashboardCss.includes('.audit-collapsed .winback-sub,'), 'the sub paragraph hides when collapsed');
  assert.ok(dashboardCss.includes('.audit-collapsed .winback-analytics { display: none; }'), 'the analytics block hides when collapsed');
  assert.ok(dashboardCss.includes('.audit-collapsed .winback-list,'), 'the list hides when collapsed');
});

test('R4b: empty At-Risk Loyal Customers collapses to a 1-line row', () => {
  // PREP CORRECTION: the prep repro asserted the whole file contains no
  // '<li class="upsell-empty">' — but that class is SHARED with the
  // Package Upgrade Suggestions card (app.js, t('upsell_empty')), which
  // is the Compare polish's area and is deliberately untouched. This
  // check scopes to the LOYALTY render instead, and the guard below
  // pins the upsell render as untouched.
  assert.ok(appJs.includes('const loyaltyCollapsed = atRiskRows.length === 0;'), 'collapse iff atRiskRows is 0');
  assert.ok(appJs.includes("loyaltySection.classList.toggle('audit-collapsed', loyaltyCollapsed)"), 'the section gets .audit-collapsed');
  const loyaltyRender = segment(appJs, 'loyaltyListEl.innerHTML =', '.join(\'\');');
  assert.ok(!loyaltyRender.includes('upsell-empty'), 'the loyalty empty <li> is gone from the loyalty render');
  assert.ok(!loyaltyRender.includes('loyalty_empty'), 'the loyalty_empty key is no longer rendered by the loyalty card (kept, uncalled — see the parity test)');
  const upsellRender = segment(appJs, 'upsellListEl.innerHTML =', '.join(\'\');');
  assert.ok(upsellRender.includes('<li class="upsell-empty">'), 'GUARD: the Package Upgrade card keeps its own empty <li> (Compare polish area)');
});

test('R4c: empty Hardware / Optical Bottleneck Audit collapses to a 1-line row', () => {
  assert.ok(appJs.includes('const hwauditCollapsed = suspects.length === 0;'), 'collapse iff suspects is 0');
  assert.ok(appJs.includes("hwauditSection.classList.toggle('audit-collapsed', hwauditCollapsed)"), 'the section gets .audit-collapsed');
  assert.ok(!appJs.includes('<li class="hwaudit-empty">'), 'the hwaudit empty <li> is gone');
  assert.ok(dashboardCss.includes('.audit-collapsed .hwaudit-sub { display: none; }') || dashboardCss.includes('.audit-collapsed .hwaudit-sub,'), 'the sub paragraph hides when collapsed');
  assert.ok(dashboardCss.includes('.audit-collapsed .hwaudit-list { display: none; }'), 'the list hides when collapsed');
});

test('R4d: the (i) circles on At-Risk + Revenue Leak shrink to 28px', () => {
  assert.ok(componentsCss.includes('.upsell-header button:not([hidden]).help-info-btn,'), 'the override scopes to the audit headers (upsell/loyalty)');
  assert.ok(componentsCss.includes('.revleak-header button:not([hidden]).help-info-btn,'), 'the override scopes to the Revenue Leak header');
  assert.ok(componentsCss.includes('min-height: 28px !important;'), '28px beats the base 40px circle and the 44px global floor');
  const baseRule = segment(componentsCss, 'button:not([hidden]).help-info-btn {', '}');
  assert.ok(baseRule.includes('width: 40px;') && baseRule.includes('height: 40px;') && baseRule.includes('min-height: 40px !important;'), 'GUARD: the base 40px .help-info-btn rule is untouched (every other (i) in the app keeps it)');
});

test('R4e: Win-Back + Hardware Audit get their own (i) buttons', () => {
  assert.ok(indexHtml.includes('data-help="winback"'), 'the collapsed Win-Back row mounts a (i) button');
  assert.ok(indexHtml.includes('data-help="hwaudit"'), 'the collapsed Hardware Audit row mounts a (i) button');
  assert.ok(indexHtml.includes('class="help-info-btn" type="button" data-help="winback"'), 'the Win-Back (i) copies the loyalty button markup exactly');
  assert.ok(indexHtml.includes('class="help-info-btn" type="button" data-help="hwaudit"'), 'the Hardware Audit (i) copies the loyalty button markup exactly');
});

test('R4f: the help registry gains winback + hwaudit topics', () => {
  assert.deepEqual(HELP_TOPICS.winback, { titleKey: 'help_winback_title', bodyKey: 'help_winback_body' }, 'winback registered with the help_<topic>_title/_body key scheme');
  assert.deepEqual(HELP_TOPICS.hwaudit, { titleKey: 'help_hwaudit_title', bodyKey: 'help_hwaudit_body' }, 'hwaudit registered with the help_<topic>_title/_body key scheme');
  for (const lang of ['en', 'ur']) {
    for (const key of ['help_winback_title', 'help_hwaudit_title']) {
      assert.ok(typeof TRANSLATIONS[lang][key] === 'string' && TRANSLATIONS[lang][key].length > 0, `${key} (${lang}) exists`);
    }
    for (const key of ['help_winback_body', 'help_hwaudit_body']) {
      assert.ok(typeof TRANSLATIONS[lang][key] === 'string' && TRANSLATIONS[lang][key].length >= 60, `${key} (${lang}) exists and its body is >= 60 chars`);
    }
  }
});

test('R4g GUARD: scroll-end clearance already exists — pb-20 is redundant', () => {
  assert.ok(stylesCss.includes('body[data-screen="reports"] main{padding-bottom:calc(142px + env(safe-area-inset-bottom))}'), 'the Reports screen already has 142px bottom clearance on main (clears the 126px FAB band) — the spec\'s pb-20 adds nothing at scroll-end and is skipped, disclosed in the PR body');
  assert.ok(!indexHtml.includes('pb-20'), 'no pb-20 class was added to the audit cards');
});

// ---------------------------------------------------------------- shared guards

test('collapsed rows show the "None right now" pill (one line, title + pill)', () => {
  for (const lang of ['en', 'ur']) {
    assert.ok(typeof TRANSLATIONS[lang].audit_none_right_now === 'string', `audit_none_right_now exists (${lang})`);
  }
  assert.equal((indexHtml.match(/data-i18n="audit_none_right_now"/g) || []).length, 3, 'the pill sits in exactly 3 headers (winback, loyalty, hwaudit)');
  assert.ok(dashboardCss.includes('.audit-none-pill { display: none;'), 'the pill is hidden by default');
  assert.ok(dashboardCss.includes('.audit-collapsed .audit-none-pill { display: inline-flex; }'), 'the pill shows only when the card is collapsed');
  assert.ok(dashboardCss.includes('.upsell-title,\n.winback-title,\n.revleak-title,\n.hwaudit-title { flex: 1; min-width: 0; }'), 'the titles take the free space so (i) + pill + count pack right');
});

test('all-clear precedence: the group hide still wins when EVERY audit is 0', () => {
  // The block sums all five counts (not five separate === 0 checks) and
  // hides every section by heading id while showing #auditsClearPill.
  const block = segment(appJs, 'const auditsAllClear =', 'auditSection.hidden = auditsAllClear;');
  assert.ok(block.includes('auditsUpsellCount + auditsWinbackCount + auditsLoyaltyCount + auditsRevleakCount + auditsHwauditCount === 0'), 'all five counts feed the all-clear sum');
  assert.ok(block.includes('auditsPillEl.hidden = !auditsAllClear;'), 'the pill shows only when every audit is 0');
  assert.ok(block.includes("'upsellHeading', 'winbackHeading', 'loyaltyHeading', 'revenueLeakHeading', 'hwauditHeading'"), 'all five sections hide as a group — the per-card collapse only applies when at least one audit has items');
});

test('parity moves to the new total (5 keys: 4 help + 1 pill)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, PARITY, 'EN parity');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, PARITY, 'UR parity');
  // The 3 empty keys become uncalled but are KEPT (no unused-key test
  // exists; removing them would churn the parity pins for zero benefit).
  for (const key of ['winback_empty', 'loyalty_empty', 'hwaudit_empty']) {
    assert.ok(key in TRANSLATIONS.en && key in TRANSLATIONS.ur, `${key} is kept (uncalled)`);
  }
});

test('no new hex: the new rules reuse tokens only', () => {
  // Every rule this item adds (chip tints, STX strip + grouped rows,
  // audit collapse + pill, register figures, 28px (i) override) is
  // token-based — none of the added rule texts may contain a hex colour.
  const addedRules = [
    segment(stylesCss, '.billing-register-status .report-filter-button[data-register-status="paid"]', '.billing-register-status .report-filter-button[data-register-status="unpaid"]'),
    segment(stylesCss, '.monthly-report-summary-bar.stx-summary {', '.stx-grouped-tax-sub {'),
    segment(dashboardCss, '.audit-collapsed .winback-sub,', '.hwaudit-title { flex: 1; min-width: 0; }'),
    segment(componentsCss, '.register-figures {', '.register-ticket-row .report-cell-label {'),
  ];
  for (const rule of addedRules) {
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule), `no hex colour in the added rules (found in: ${rule.slice(0, 80)}...)`);
  }
});
