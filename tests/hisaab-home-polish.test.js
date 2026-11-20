// Hisaab home polish — the 4 card items from the 2026-11-20 user spec:
// (1) 6-digit KPI amounts stay on one line (bare number, 'PKR' once in
// the section subtitle); (2) Kul Munafa subtitle is the lifetime
// margin %; (3) the Nayatel footnote collapses into a 1-line
// expandable note; (4) the duplicate overline is gone. Plus the
// inherited toggle + FAB scroll-hide + d23 removal from the verified
// hisaab-home prep. Source-scan pins over the real app.js /
// index.html / dashboard.css + runtime checks over the real pure
// modules — the established pattern. Generic fixtures only (no real
// customer names, no real amounts, no phone numbers anywhere).
// This file asserts NO parity total and carries no parity literal.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateLifetimePnl } from '../dashboard-pnl.js';
import { formatPKR } from '../core.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const dashboardCss = readFileSync(join(dir, '..', 'dashboard.css'), 'utf8');
const tokensCss = readFileSync(join(dir, '..', 'tokens.css'), 'utf8');
const navJs = readFileSync(join(dir, '..', 'nav.js'), 'utf8');
const stylesCss = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

const sec = (() => {
  const m = indexHtml.match(/<section[^>]*id="hisaabSection"[\s\S]*?<\/section>/);
  assert.ok(m, 'the Hisaab section exists');
  return m[0];
})();

// The test file's repro state (tests/hisaab-dashboard-section.test.js):
// Nov 2026 payment 3000 + voided 9999, Jun 2025 payment 5000,
// expenses 1000 (Nov 2026) + 2000 (Jun 2025). Pattern-fake names only.
const REPRO_STATE = {
  customers: [{
    id: 'cust-test-1', name: 'Test Customer 1',
    bills: [
      { month: '2026-11', payments: [
        { date: '2026-11-05', amount: 3000 },
        { date: '2026-11-06', amount: 9999, voided: true },
      ] },
      { month: '2025-06', payments: [{ date: '2025-06-10', amount: 5000 }] },
    ],
  }],
  expenses: [
    { date: '2026-11-07', amount: 1000, category: 'Other expenses' },
    { date: '2025-06-15', amount: 2000, category: 'Other expenses' },
  ],
};

test('hisaab polish (1): PKR lives once in the section subtitle; the 6 KPI values are bare numbers', () => {
  // The currency is named once for the whole card — the subtitle is
  // the card's top label line. The per-card label cannot carry it:
  // 'AAMDANI · PKR' measures 95.8px (DejaVu Bold 11px) against ~80px
  // of card content at 360px, so it would ellipse.
  assert.ok(TRANSLATIONS.en.hisaab_section_subtitle.includes('PKR'), 'EN subtitle names PKR once');
  assert.ok(TRANSLATIONS.ur.hisaab_section_subtitle.includes('PKR'), 'UR subtitle names PKR once');
  // The render writes bare numbers: a local helper strips the 'PKR '
  // prefix formatPKR adds, and all six KPI writes go through it.
  assert.ok(appJs.includes("text.startsWith('PKR ') ? text.slice(4) : text"), 'render strips the PKR prefix for the KPI values');
  for (const id of ['hisaabMonthIncome', 'hisaabMonthExpenses', 'hisaabMonthProfit', 'hisaabLifeIncome', 'hisaabLifeExpenses', 'hisaabLifeProfit']) {
    assert.ok(appJs.includes(`setBareMoney('#${id}'`), `#${id} is written as a bare number`);
    assert.ok(!appJs.includes(`setMoney('#${id}'`), `#${id} is no longer written with the PKR prefix`);
  }
  // Runtime shape of the strip: a 6-digit figure loses exactly 'PKR '.
  const stripped = formatPKR(123456).startsWith('PKR ') ? formatPKR(123456).slice(4) : formatPKR(123456);
  assert.equal(stripped, '123,456', 'bare 6-digit figure');
});

test('hisaab polish (1): the KPI value fits on one line — px-2 padding, nowrap, tabular-nums, anywhere neutralised', () => {
  // DejaVu Bold widths behind the fit: '123,456' at 14px is 63.7px
  // against 80px of content at 360px (66.7px at 320px). The spec's
  // ~15px measures 68.3px and misses the 320px width by ~2px, so the
  // value stays at the current 14px — written as the --text-sm token
  // (Plan A forbids the literal scale size in dashboard.css); the
  // token itself is pinned to 14px below, so the measurement still
  // binds to the value the operator actually sees.
  const metric = dashboardCss.match(/\.hisaab-metric\s*\{([^}]*)\}/);
  assert.ok(metric, '.hisaab-metric rule exists');
  assert.match(metric[1], /padding:\s*12px 8px/, 'card horizontal padding is px-2 (8px)');
  const val = dashboardCss.match(/\.hisaab-metric \.home-kpi-val\s*\{([^}]*)\}/);
  assert.ok(val, '.hisaab-metric .home-kpi-val rule exists');
  assert.match(val[1], /font-size:\s*var\(--text-sm\)/, 'value stays 14px via the --text-sm token (see the 320px measurement above)');
  assert.match(tokensCss, /--text-sm:\s*14px/, 'the --text-sm token resolves to 14px');
  assert.match(val[1], /white-space:\s*nowrap/, 'value never wraps');
  assert.match(val[1], /font-variant-numeric:\s*tabular-nums/, 'digits are tabular');
  assert.match(val[1], /overflow-wrap:\s*normal/, 'the old anywhere rule is neutralised — an over-long figure ellipses, never wraps');
  assert.doesNotMatch(dashboardCss, /\.hisaab-metric \.home-kpi-val\s*\{[^}]*overflow-wrap:\s*anywhere/, 'no anywhere wrap left on the hisaab value');
});

test('hisaab polish (2): Kul Munafa subtitle is the lifetime margin %', () => {
  const lifeProfitAt = sec.indexOf('id="hisaabLifeProfit"');
  assert.ok(lifeProfitAt >= 0, 'life profit value exists');
  const article = sec.slice(lifeProfitAt, sec.indexOf('</article>', lifeProfitAt));
  assert.ok(/id="hisaabLifeMargin"/.test(article), 'life profit article carries #hisaabLifeMargin');
  assert.ok(!/data-i18n="hisaab_label_paid"/.test(article), "the life profit subtitle is no longer 'Ada shuda'");
  assert.ok(appJs.includes("$('#hisaabLifeMargin')"), 'render writes the life margin element');
  assert.ok(appJs.includes('life.margin'), 'render reads life.margin');
  // Runtime: the fixture lifetime margin is 62.5 through the same
  // month-agnostic template the month margin uses.
  const life = calculateLifetimePnl(REPRO_STATE, { referenceDate: new Date('2026-11-18T00:00:00Z') });
  assert.equal(life.margin, 62.5, 'fixture lifetime margin');
  assert.equal(t('hisaab_month_margin', 'en', { margin: life.margin }), 'Margin 62.5%', 'margin template renders the lifetime value');
});

test('hisaab polish (3): the Nayatel footnote collapses into a 1-line expandable note', () => {
  const details = sec.match(/<details[^>]*id="hisaabProviderDetails"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(details, 'the provider details <details> exists');
  const inner = details[1];
  assert.ok(inner.includes('id="hisaabProviderSummary"'), 'the summary carries its id');
  assert.ok(inner.includes('id="hisaabProviderLines"'), 'the provider lines stay inside the details');
  assert.ok(inner.includes('id="hisaabHonestyLine"'), 'the honesty line stays inside the details');
  // The render writes the summary from the first active provider,
  // reusing the pending / paid-total templates — no new key, and the
  // full lines stay reachable on expand (nothing is deleted).
  assert.ok(appJs.includes("$('#hisaabProviderSummary')"), 'render writes the provider summary');
  assert.ok(appJs.includes('hisaab_provider_pending'), 'summary reuses the pending template');
  assert.ok(appJs.includes('hisaab_provider_paid_total'), 'summary reuses the paid-total template');
  // The summary keeps 72px of right padding so its text never runs
  // under the idle FAB (50px trigger + 16px inset + 6px clearance),
  // and ellipses instead of wrapping.
  const summary = dashboardCss.match(/\.hisaab-provider-summary\s*\{([^}]*)\}/);
  assert.ok(summary, '.hisaab-provider-summary rule exists');
  assert.match(summary[1], /padding:\s*4px 72px 4px 0/, 'summary clears the idle FAB on the right');
  assert.match(summary[1], /white-space:\s*nowrap/, 'summary stays one line');
  assert.match(summary[1], /text-overflow:\s*ellipsis/, 'summary ellipses when long');
});

test('hisaab polish (4): the duplicate overline is gone', () => {
  assert.ok(!indexHtml.includes('data-i18n="hisaab_section_eyebrow"'), 'no eyebrow key rendered in the section');
  assert.ok(!('hisaab_section_eyebrow' in TRANSLATIONS.en), 'eyebrow key deleted from the EN dict');
  assert.ok(!('hisaab_section_eyebrow' in TRANSLATIONS.ur), 'eyebrow key deleted from the UR dict');
});

test('hisaab polish: the [ Is mahine | Kul ] toggle switches the two grids', () => {
  assert.ok(sec.includes('id="hisaabViewToggle"'), 'the toggle exists');
  assert.ok(sec.includes('data-i18n="hisaab_toggle_month"'), 'the month button carries the new key');
  assert.ok(sec.includes('data-i18n="hisaab_section_lifetime"'), 'the Kul button reuses the lifetime key');
  assert.ok(appJs.includes('hisaabView'), 'render gates the grids on the view');
  assert.ok(appJs.includes("hisaabViewToggleBound"), 'the toggle binding is once-only');
});

test('hisaab polish: the FAB hides while scrolling and the d23 stamp is gone', () => {
  assert.ok(navJs.includes('export function setupSpeedDialScrollHide'), 'the scroll-hide helper exists in nav.js');
  assert.ok(appJs.includes('setupSpeedDialScrollHide()'), 'the helper is wired next to setupScrollToTop');
  assert.ok(!indexHtml.includes('<span class="build-stamp"'), 'no d23 stamp in the header');
  assert.ok(!/\.build-stamp\s*\{/.test(stylesCss), 'no .build-stamp rule left');
});
