// Reports → Compare tab polish (5 sub-parts, 360px Android).
// Converted from the prep repro (13 checks, 0/13 on base) plus the
// behavioural annual-summary checks. Generic fixtures only — no real
// customer names, amounts or months from screenshots.
// No parity literal in this file: the suite total moves as the queue
// merges (Register +5 keys, Closing +1), so no parity value is pinned.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAnnualSummary, annualSummaryHtml, annualSummaryCsv } from '../annual-summary.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const appJs = read('app.js');
const ownerUi = read('owner-ui.js');
const annualJs = read('annual-summary.js');
const styles = read('styles.css');
const dashboardCss = read('dashboard.css');
const indexHtml = read('index.html');
const routerJs = read('screen-router.js');
const routerCss = read('screen-router.css');
const componentsCss = read('components.css');

// --- 1. Upgrade offer rows: 2-row layout ---

test('compare polish: upsell offer button is full-width below the name/gain row', () => {
  const rule = (dashboardCss.match(/\.upsell-offer-btn\s*\{[^}]*\}/) || [''])[0];
  assert.match(rule, /width:\s*100%/);
  assert.match(rule, /display:\s*block/);
  // Colour comes from the shared .qc-wa-btn class (styles.css), not a
  // literal here: dashboard.css past the 'Home summary cards' marker must
  // stay hex-free (home-summary-style.test.js), and a bare comment fragment
  // there once broke this rule's parsing entirely.
  assert.doesNotMatch(rule, /background:/);
  assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,6}\b/);
  assert.ok(appJs.includes('class="upsell-offer-btn qc-wa-btn"'), 'offer link wears .qc-wa-btn');
  const waRule = (styles.match(/\.qc-wa-btn\s*\{[^}]*\}/) || [''])[0];
  assert.match(waRule, /background:\s*#25d366/);
  assert.match(waRule, /color:\s*#ffffff/);
});

test('compare polish: upsell name and sub-lines never break mid-word', () => {
  const nameRule = (dashboardCss.match(/\.upsell-name\s*\{[^}]*\}/) || [''])[0];
  const subRule = (dashboardCss.match(/\.upsell-sub-line\s*\{[^}]*\}/) || [''])[0];
  assert.doesNotMatch(nameRule, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(subRule, /overflow-wrap:\s*anywhere/);
  assert.match(nameRule, /overflow-wrap:\s*normal/);
});

test('compare polish: upsell gain renders as a green pill', () => {
  const rule = (dashboardCss.match(/\.upsell-gain\s*\{[^}]*\}/) || [''])[0];
  assert.match(rule, /background:\s*var\(--ds-success-bg\)/);
  assert.match(rule, /color:\s*var\(--ds-success\)/);
  assert.match(rule, /border-radius:\s*var\(--radius-pill\)/);
});

test('compare polish: upsell row is two rows — the tap target wraps name + gain, sub-lines sit outside it', () => {
  const itemRule = (dashboardCss.match(/\.upsell-item\s*\{[^}]*\}/) || [''])[0];
  assert.match(itemRule, /flex-direction:\s*column/);
  const start = appJs.indexOf('upsell-item');
  const region = appJs.slice(start, start + 2500);
  const buttonClose = region.indexOf('</button>');
  const firstSubLine = region.indexOf('upsell-sub-line');
  assert.ok(buttonClose !== -1 && firstSubLine !== -1, 'template has a button and sub-lines');
  assert.ok(region.indexOf('upsell-gain') < buttonClose, 'gain pill is inside the tap target');
  assert.ok(buttonClose < firstSubLine, 'package path + reasons sit outside the button');
});

test('compare polish: upsell gain pill reads /mo in EN, keeps /ماہ in UR', () => {
  assert.equal(TRANSLATIONS.en.upsell_gain, '+{amount}/mo');
  assert.equal(TRANSLATIONS.ur.upsell_gain, '+{amount}/ماہ');
});

// --- 2. Sticky tab bar above the sticky table cells ---

test('compare polish: reports tab bar paints above sticky table cells, tops hold', () => {
  const bar = styles.match(/\.reports-tabs\{[^}]*\}/);
  assert.ok(bar, 'reports-tabs rule exists');
  assert.ok(bar[0].includes('z-index:30'));
  assert.ok(bar[0].includes('top:78px'));
  assert.ok(styles.includes('.reports-tabs{top:58px}'), '<=620px follows the 58px topbar');
  assert.ok(styles.includes('.reports-tabs.reports-tabs { top: 56px; }'), '<=380px follows the 56px topbar');
});

// --- 3. Annual Owner Summary: toggle + Year/Export row + KPI colours ---

function annualFixture() {
  const zeroMonths = Array.from({ length: 8 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    collections: 0, expenses: 0, newCustomers: 0, departed: 0,
    customersStart: 10, customersEnd: 10, churnRate: 0, snapshotClosed: true,
  }));
  const liveMonths = ['2026-09', '2026-10', '2026-11'].map((month) => ({
    month, collections: 1000, expenses: 500, newCustomers: 1, departed: 0,
    customersStart: 10, customersEnd: 11, churnRate: 0, snapshotClosed: true,
  }));
  // December is omitted on purpose: no row yet, so its figures are null.
  return buildAnnualSummary({ year: '2026', months: [...zeroMonths, ...liveMonths] });
}

test('compare polish: annual table hides the 8 empty Rs. 0 months behind a toggle', () => {
  const html = annualSummaryHtml(annualFixture());
  assert.equal((html.match(/annual-empty-month" hidden/g) || []).length, 8, '8 empty rows hidden by default');
  assert.ok(html.includes('Show 8 empty months ▾'), 'toggle label is data-driven');
  assert.match(annualJs, /row\.collections === 0 && row\.expenses === 0/, 'toggle keys on rendered values, not present:false');
});

test('compare polish: December stays visible with —, not hidden as an empty month', () => {
  const html = annualSummaryHtml(annualFixture());
  assert.ok(html.includes('<tr><td>2026-12</td>'), 'December row renders without the empty-month class');
  const decRow = html.slice(html.indexOf('<tr><td>2026-12</td>'), html.indexOf('</tr>', html.indexOf('<tr><td>2026-12</td>')));
  assert.ok(decRow.includes('—'), 'December money figures render as — (not yet), not Rs. 0');
});

test('compare polish: annual CSV export still carries all 12 months', () => {
  const csv = annualSummaryCsv(annualFixture());
  for (const month of ['2026-01', '2026-08', '2026-09', '2026-12']) {
    assert.ok(csv.includes(month), `CSV keeps ${month}`);
  }
});

test('compare polish: Year selector + Export annual CSV share one row', () => {
  const section = indexHtml.slice(indexHtml.indexOf('id="annualOwnerSummarySection"'), indexHtml.indexOf('id="annualOwnerSummarySection"') + 1500);
  const exportPos = section.indexOf('annualSummaryExportBtn');
  const yearPos = section.indexOf('annualSummaryYear');
  assert.ok(exportPos !== -1 && yearPos !== -1, 'both controls exist');
  assert.ok(!section.slice(Math.min(exportPos, yearPos), Math.max(exportPos, yearPos)).includes('</div>'), 'no div boundary between them');
});

test('compare polish: annual KPI values are semantically coloured', () => {
  const html = annualSummaryHtml(annualFixture());
  assert.ok(html.includes('ds-stat-box__value--emerald'), 'Collections + Net emerald');
  assert.ok(html.includes('ds-stat-box__value--rose'), 'Expenses rose');
  assert.ok(html.includes('ds-stat-box__value--indigo'), 'Growth indigo');
  assert.match(componentsCss, /\.ds-stat-box__value--emerald\s*\{\s*color:\s*var\(--color-emerald-dark\)/);
  assert.match(componentsCss, /\.ds-stat-box__value--rose\s*\{\s*color:\s*var\(--qc-rose-strong-text\)/);
  assert.match(componentsCss, /\.ds-stat-box__value--indigo\s*\{\s*color:\s*var\(--qc-indigo-text\)/);
});

// --- 4. Customer Rankings: 2-col filters, Filters chip, tappable rows ---

test('compare polish: Ranking + Month share a 2-column row at ≤700px', () => {
  assert.match(styles, /@media\(max-width:700px\)\{\s*section\[aria-labelledby="customerRankingHeading"\] \.owner-filter-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

test('compare polish: Area / Package / Manual status collapse behind a Filters chip with active state', () => {
  const section = indexHtml.slice(indexHtml.indexOf('id="customerRankingsSection"'), indexHtml.indexOf('</section>', indexHtml.indexOf('id="customerRankingsSection"')));
  const detailsPos = section.indexOf('<details class="owner-filter-details">');
  assert.ok(detailsPos !== -1, 'Filters details exists');
  assert.ok(section.indexOf('id="rankingFiltersState"') !== -1, 'chip carries an active-filter state span');
  for (const id of ['rankingArea', 'rankingPackage', 'rankingStatus']) {
    assert.ok(section.indexOf(`id="${id}"`) > detailsPos, `${id} sits inside the chip`);
  }
  for (const id of ['rankingType', 'rankingMonth']) {
    assert.ok(section.indexOf(`id="${id}"`) < detailsPos, `${id} stays outside the chip`);
  }
  assert.match(ownerUi, /rankingFiltersState/, 'renderRankingOptions updates the chip state');
});

test('compare polish: ranked rows are tappable, no bulky ledger button, crown + estimate intact', () => {
  assert.ok(!ownerUi.includes('Open ledger'), 'no ledger button string remains in owner-ui.js');
  assert.match(ownerUi, /<article class="owner-result-card" role="button" tabindex="0" data-open-ranking-customer=/);
  assert.match(ownerUi, /owner-result-chevron/);
  assert.match(ownerUi, /keydown/, 'rows are keyboard reachable (Enter/Space)');
  assert.match(ownerUi, /owner-crown-avatar/, 'early-payer crown variant intact');
  assert.match(ownerUi, /owner-result-estimate/, 'lifetime-value estimate line intact');
});

// --- 5. Compare Two Months: header, hidden both-null cards, delta polarity ---

test('compare polish: reports screen declares hideBack and gets a one-row header', () => {
  const entry = routerJs.slice(routerJs.indexOf('reports: {'), routerJs.indexOf('\n  bills:'));
  assert.match(entry, /hideBack:\s*true/);
  assert.match(routerCss, /body\.sr-screen-mode\[data-screen="reports"\] \.sr-screen-header\s*\{[^}]*grid-template-areas:\s*"title action"/);
  assert.match(routerCss, /body\.sr-screen-mode\[data-screen="reports"\] \.sr-primary-action\s*\{\s*width:\s*auto;\s*border-radius:\s*var\(--radius-pill\)/);
});

test('compare polish: both-null metric cards hide, partial cards stay', () => {
  const render = ownerUi.slice(ownerUi.indexOf('function renderComparison'), ownerUi.indexOf('function renderComparison') + 2500);
  assert.match(render, /change\.from\s*===\s*null\s*&&\s*change\.to\s*===\s*null/);
});

test('compare polish: comparison deltas carry a semantic polarity class', () => {
  assert.match(ownerUi, /GOOD_UP_COMPARE_KEYS\s*=\s*\['billedAmount', 'collection', 'cashProfit', 'collectionRate', 'activeCustomers', 'newCustomers', 'newConnections', 'billCount', 'pricedBillCount'\]/);
  assert.match(ownerUi, /BAD_UP_COMPARE_KEYS\s*=\s*\['outstanding', 'expenses', 'unpricedBillCount', 'archivedCustomers', 'disconnectedCustomers'\]/);
  assert.match(ownerUi, /comparison-delta--good/);
  assert.match(ownerUi, /comparison-delta--bad/);
  assert.match(styles, /\.comparison-delta--good\s*\{\s*color:\s*var\(--color-emerald-dark\)/);
  assert.match(styles, /\.comparison-delta--bad\s*\{\s*color:\s*var\(--qc-rose-strong-text\)/);
});
