// Reports → Closing tab polish (3 sub-parts) — Daily Roznamcha &
// Owner Khata left-aligned values + uniform 2-col button grid +
// relabelled Khata button; Saved Closings behind an (i), readable
// timestamps, Cash-profit strip, collapsed older months, one footnote;
// New Customers pill + grouped list; month-compare diff pill;
// One-page summary inline Print + grouped list + rose Total dues.
//
// Base: main c17863f3, suite 21,475/0. New file — ~18 tests.
// Expected suite after this file: ≈21,491–21,493/0.
// Parity here uses the SPLIT form ('52' + '34') — this file must
// never contain the bare parity literal (re-pinned at rebase time: the
// Register polish's +5 keys landed first, so post-merge parity was
// 5,229/5,229; the Bill card rebase (2026-11-23) adds 2 keys → 5,231/5,231; the Billing history rebase (2026-11-23) adds 3 keys → 5,234/5,234).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { formatSavedAt } from '../dashboard-pnl.js';
import { renderNewCustomers } from '../dashboard-new-customers.js';
import { renderMonthComparison } from '../dashboard-month-comparison.js';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, ROOT), 'utf8');
const index = read('index.html');
const styles = read('styles.css');
const dashboardCss = read('dashboard.css');
const components = read('components.css');
const ownerUi = read('owner-ui.js');

// --- Sub-part 1: Daily Roznamcha + Owner Khata Closing ---

test('S1-1a: Daily Roznamcha value is left-aligned by a scoped rule', () => {
  assert.match(styles, /#dailyRoznamchaSection \.summary-value,\s*#ownerKhataSection \.summary-value \{ text-align: left; \}/,
    'scoped left-align rule missing');
});

test('S1-1b: the shared .summary-value rule still right-aligns (untouched)', () => {
  assert.ok(/\.summary-value, \.phase3-metric strong \{[^}]*text-align: right;[^}]*\}/.test(styles),
    'shared rule moved — every other summary value in the app follows it');
});

test('S1-2a: the 6-button container has no inline flex style', () => {
  assert.ok(!index.includes('daily-closing-actions" style='), 'inline style still beats any stylesheet rule');
});

test('S1-2b: the 6 buttons sit in a scoped uniform 2-column grid', () => {
  const rule = /#dailyRoznamchaSection \.daily-closing-actions \{([^}]*)\}/.exec(dashboardCss)?.[1];
  assert.ok(rule, 'scoped grid rule missing from dashboard.css');
  assert.ok(rule.includes('display: grid'), 'grid missing');
  assert.ok(rule.includes('repeat(2, minmax(0, 1fr))'), 'not 2 equal columns');
});

test('S1-3: the Owner Khata button is relabelled via dash_khata_open (id + classes kept)', () => {
  assert.ok(index.includes('id="openOwnerKhataModalBtn" class="action-btn-sm daily-slip-btn" type="button" data-i18n="dash_khata_open">Open Khata Closing ›</button>'),
    'button not relabelled to the new key');
  assert.equal(TRANSLATIONS.en.dash_khata_open, 'Open Khata Closing ›', 'EN value moved');
  assert.ok(typeof TRANSLATIONS.ur.dash_khata_open === 'string' && TRANSLATIONS.ur.dash_khata_open.length > 0, 'UR value missing');
  assert.notEqual(TRANSLATIONS.ur.dash_khata_open, TRANSLATIONS.en.dash_khata_open, 'UR value is the English text');
  // The card title keeps its own key — only the button moved.
  assert.equal(TRANSLATIONS.en.dash_card_khata, '📕 Owner Khata Closing', 'card title key moved');
});

// --- Sub-part 2: Saved Monthly Closings ---

test('S2-1: the Saved Closings intro sits behind a help-tip (i), not a bare paragraph', () => {
  // Parent decision: the SAME <details class="help-tip"> pattern as
  // the Status polish — NOT the prep's suggested audit-explainer
  // class (the prep repro's S2-1 checks audit-explainer; this test
  // pins the parent-decided pattern instead).
  const section = index.slice(index.indexOf('id="savedClosingsSection"'));
  assert.match(section, /<details class="help-tip"><summary class="help-icon"[^>]*>i<\/summary><span[^>]*class="help-tip-content"[^>]*>Created once when the app first opens in the next PKT calendar month\. Status counts are manual values captured at the saved time, not monitored month-end status\.<\/span><\/details>/,
    'intro is not behind a help-tip');
  assert.ok(!section.includes('<p class="chart-caption">Created once'), 'bare caption paragraph still present');
});

test('S2-2a: formatSavedAt renders midnight as 12:36 AM (no ISO, no year, no PKT)', () => {
  assert.equal(formatSavedAt('2026-11-01T00:36'), 'Nov 1 · 12:36 AM');
  assert.equal(formatSavedAt('2026-11-01T12:05'), 'Nov 1 · 12:05 PM');
  assert.equal(formatSavedAt('2026-11-01T15:30'), 'Nov 1 · 3:30 PM');
  assert.equal(formatSavedAt('2026-10-31T23:59'), 'Oct 31 · 11:59 PM');
});

test('S2-2b: formatSavedAt passes malformed input through raw (never blank)', () => {
  assert.equal(formatSavedAt('2026-13-01T00:36'), '2026-13-01T00:36', 'impossible month');
  assert.equal(formatSavedAt('2026-02-30T10:00'), '2026-02-30T10:00', 'impossible day');
  assert.equal(formatSavedAt('2026-11-01 00:36'), '2026-11-01 00:36', 'wrong shape');
  assert.equal(formatSavedAt(''), '');
  assert.equal(formatSavedAt(null), '');
});

test('S2-2c: renderClosings formats the saved time (no raw ISO + PKT)', () => {
  assert.ok(ownerUi.includes('formatSavedAt(row.savedAt)'), 'renderClosings does not call formatSavedAt');
  assert.ok(!/Saved \$\{escapeHtml\(row\.savedAt\)\} PKT/.test(ownerUi), 'raw ISO timestamp still rendered');
});

test('S2-3: Cash profit is a full-width highlighted strip at the bottom', () => {
  const rule = /\.closing-metrics>div:last-child\{([^}]*)\}/.exec(styles)?.[1];
  assert.ok(rule, 'strip rule missing');
  assert.ok(rule.includes('grid-column:span 2'), 'strip does not span both columns');
  assert.ok(rule.includes('var(--qc-mint-bg)'), 'strip background is not the mint token');
  assert.ok(rule.includes('var(--qc-mint-border)'), 'strip border is not the mint token');
});

test('S2-4: older closings collapse — newest expanded, rest are <details>', () => {
  const fn = ownerUi.slice(ownerUi.indexOf('function renderClosings()'));
  assert.match(fn, /index===0\)return `<article class="saved-closing-card">/, 'newest month is not the expanded article');
  assert.match(fn, /<details class="saved-closing-card saved-closing-collapsed"><summary class="closing-collapse-summary">/,
    'older months are not <details>');
  assert.match(fn, /Profit \$\{escapeHtml\(formatAmount\(row\.profit\)\)\} ▾/, 'summary does not read "Month · Profit PKR … ▾"');
});

test('S2-5: one footnote <p> per card — status + comparison merged', () => {
  assert.ok(!ownerUi.includes('closing-previous-note'), 'second footnote paragraph still rendered');
  assert.equal((ownerUi.match(/<p class="closing-status-note">/g) || []).length, 1,
    'more than one status-note <p> in the template');
  const fn = ownerUi.slice(ownerUi.indexOf('function renderClosings()'));
  assert.ok(fn.includes('Compared with'), 'comparison sentence dropped from the merged footnote');
});

// --- Sub-part 3: New Customers / Month Compare / One-Page Summary ---

test('S3-1a: the count is a compact emerald pill badge next to the title', () => {
  assert.ok(index.includes('id="ncmNewTotal" class="ncm-count-pill"'), '#ncmNewTotal is not the pill class');
  const rule = /\.ncm-count-pill \{([^}]*)\}/.exec(components)?.[1];
  assert.ok(rule, 'pill rule missing from components.css');
  assert.ok(rule.includes('var(--qc-mint-bg)') && rule.includes('var(--qc-mint-border)') && rule.includes('var(--color-emerald-dark)'),
    'pill is not the emerald token set');
  assert.ok(rule.includes('var(--radius-pill)'), 'pill radius is not the pill token');
});

test('S3-1b: the duplicate count line is gone (renderer + markup)', () => {
  assert.ok(!index.includes('id="ncmNewLine"'), '#ncmNewLine still in index.html');
  const els = {};
  const doc = { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) };
  renderNewCustomers(doc, { month: '2026-11', customerCount: 3, customers: [] });
  assert.equal(els.ncmNewTotal.textContent, '3', 'pill badge does not carry the count');
  assert.equal('ncmNewLine' in els, false, 'renderer still queries the removed line element');
});

test('S3-2: the New Customers list is one grouped white card', () => {
  const rule = /#newCustomersSection \.provider-cost-list,\s*#printSummarySection \.provider-cost-list\{([^}]*)\}/.exec(styles)?.[1];
  assert.ok(rule, 'grouped-list rule missing');
  assert.ok(rule.includes('display:block'), 'list is not a single column');
  assert.ok(rule.includes('var(--radius-lg)'), 'grouped card radius is not --radius-lg');
  assert.ok(styles.includes('#newCustomersSection .provider-cost-list li+li,') && styles.includes('border-top:1px solid var(--line)'),
    'rows are not divide-y');
});

test('S3-3a: the month-compare repeat line is gone (renderer + markup)', () => {
  assert.ok(!index.includes('id="mvcMonthLine"'), '#mvcMonthLine still in index.html');
  const els = {};
  const doc = { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false, className: '' }) };
  renderMonthComparison(doc, { currentMonth: '2026-11', previousMonth: '2026-10', currentCents: 100000, previousCents: 50000, differenceCents: 50000, direction: 'more' });
  assert.equal(els.mvcMonthTotal.textContent, 'PKR 1,000', 'big total moved');
  assert.equal('mvcMonthLine' in els, false, 'renderer still queries the removed line element');
});

test('S3-3b: the diff is a semantic pill by direction', () => {
  const run = (direction, differenceCents) => {
    const els = {};
    const doc = { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false, className: '' }) };
    renderMonthComparison(doc, { currentMonth: '2026-11', previousMonth: '2026-10', currentCents: 100000, previousCents: 100000 - differenceCents, differenceCents, direction });
    return els.mvcMonthDiff;
  };
  assert.equal(run('less', -260100).className, 'collection-forecast-collected mvc-diff-pill mvc-diff-pill--less', 'less is not the rose pill');
  assert.ok(run('less', -260100).textContent.includes('less than last month'), 'less text moved');
  assert.equal(run('more', 50000).className, 'collection-forecast-collected mvc-diff-pill mvc-diff-pill--more', 'more is not the emerald pill');
  assert.equal(run('same', 0).className, 'collection-forecast-collected mvc-diff-pill mvc-diff-pill--same', 'same is not the neutral pill');
  assert.equal(run('same', 0).textContent, 'Same as last month', 'same text moved');
  // The pure function is unchanged — the pill is a class, not new text.
  assert.ok(components.includes('.mvc-diff-pill--less { background: var(--qc-rose-bg);'), 'rose pill is not the rose token set');
  assert.ok(components.includes('.mvc-diff-pill--more { background: var(--qc-mint-bg);'), 'emerald pill is not the mint token set');
});

test('S3-4: the One-page summary header stays a row at phone width', () => {
  assert.match(components, /#newCustomersSection \.collection-forecast-header,\s*#printSummarySection \.collection-forecast-header \{ flex-direction: row; align-items: center;/,
    'scoped row-header rule missing');
  // The Print handler + print CSS are untouched (Plan 486 pins hold).
  assert.ok(index.includes('id="ppsPrintBtn"'), 'Print button moved');
});

test('S3-5: the One-page summary list is grouped and Total dues reads rose', () => {
  assert.ok(styles.includes('#printSummarySection #ppsTotalDues{color:var(--qc-rose-strong-text)}'),
    'Total dues is not the rose token');
  assert.ok(index.includes('id="ppsTotalDues"'), 'Total dues element moved');
});

// --- Parity (split literal — never the bare number) ---

test('parity: EN/UR stay equal at the new total after +1 key', () => {
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  const expected = Number('52' + '34');  // Re-pin (Bill card rebase 2026-11-23): Bill card adds 2 keys → 5,231 (was 5,229 via Reports Closing).
  assert.equal(Object.keys(TRANSLATIONS.en).length, expected, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, expected, 'UR key count moved');
});
