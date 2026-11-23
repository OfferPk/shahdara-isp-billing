// Home Tab Analytics CSS bugfix (360px Android, Material Design 3).
// Squeezed card headers, broken FDH legend, route-density whitespace,
// recovery-pipeline pills cut off at "Top D".
// Text-only + real render: imports the renderers (like dashboard.test.js)
// and asserts on the returned strings + the CSS rules. No browser needed.
// Fixture data only — generic area names, no real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFiberDistributionSvg } from '../dashboard-charts.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const indexHtml = read('index.html');
const dashboardCss = read('dashboard.css');
const stylesCss = read('styles.css');

// 360px content width (same arithmetic as the fiber-hubs test): 360 -
// 2x12 (region pad) - 2x1 (region border) - 2x1 (card border) - 2x10
// (card pad at <=680px) = 312px; the prep measured ~314px usable.
const CONTENT_WIDTH_360 = 314;
// Per-glyph width the repo's fit tests use: 6.6px/char at 11px = 0.6em.
const GLYPH_PX = 6.6;

const article = (cardClass, nextClass) =>
  indexHtml.slice(indexHtml.indexOf(cardClass), indexHtml.indexOf(nextClass));

test('health header stacks: title full-width on top, Good/Watch/Overdue/Offline in a 4-col grid below', () => {
  const health = article('chart-card-health', 'chart-card-methods');
  assert.match(health, /class="chart-card-header chart-card-header-flex chart-card-header--stacked"/,
    'health header must carry the stacked modifier');
  assert.ok(health.includes('id="dashboardHealthActions"'), 'health filter group must stay');
  for (const label of ['Good', 'Watch', 'Overdue', 'Offline']) {
    assert.ok(health.includes(`>${label}<`), `health filter button ${label} must stay`);
  }
  const stacked = dashboardCss.match(/\.chart-card-header-flex\.chart-card-header--stacked\s*\{([^}]*)\}/);
  assert.ok(stacked, 'stacked-header rule missing from dashboard.css');
  assert.match(stacked[1], /flex-direction\s*:\s*column/, 'stacked header must be a column');
  assert.match(stacked[1], /align-items\s*:\s*stretch/, 'stacked header children must stretch full-width');
  assert.match(stacked[1], /gap\s*:\s*var\(--space-2-5\)/, 'stacked header gap must be 10px (gap-2.5 token)');
  const group = dashboardCss.match(/\.chart-card-health \.health-filter-group\s*\{([^}]*)\}/);
  assert.ok(group, 'health filter-group grid rule missing');
  assert.match(group[1], /display\s*:\s*grid/, 'health filters must be a grid below the title');
  assert.match(group[1], /grid-template-columns\s*:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    'health filters must be 4 equal columns');
  // "Overdue" (7 chars x 6.6px) + 16px padding + 2px border = ~64px < ~73px column.
  const colWidth = Math.floor((CONTENT_WIDTH_360 - 3 * 6) / 4);
  assert.ok(7 * GLYPH_PX + 18 <= colWidth, `Overdue must fit its ${colWidth}px grid column`);
});

test('heatmap header stacks: title full-width on top, All|Optimal|Moderate|Lagging as a full-width segmented bar below', () => {
  const heatmap = article('chart-card-heatmap', 'chart-card-seasonal');
  assert.match(heatmap, /class="chart-card-header chart-card-header-flex chart-card-header--stacked"/,
    'heatmap header must carry the stacked modifier');
  for (const label of ['All', 'Optimal', 'Moderate', 'Lagging']) {
    assert.ok(heatmap.includes(`>${label}<`), `heatmap filter button ${label} must stay`);
  }
  const group = dashboardCss.match(/\.chart-card-heatmap \.heatmap-filter-group\s*\{([^}]*)\}/);
  assert.ok(group, 'heatmap filter-group full-width rule missing');
  assert.match(group[1], /width\s*:\s*100%/, 'heatmap filter group must span the card width');
  const btn = dashboardCss.match(/\.chart-card-heatmap \.heatmap-filter-btn\s*\{([^}]*)\}/);
  assert.ok(btn, 'heatmap filter-button flex rule missing');
  assert.match(btn[1], /flex\s*:\s*1\s+1\s+0/, 'heatmap buttons must share the bar evenly');
  assert.match(btn[1], /text-align\s*:\s*center/, 'heatmap button labels must centre in their share');
});

test('LTV header stacks: title full-width on top, Avg LTV | Total Revenue + Cohort Drilldown on one row below', () => {
  const ltv = article('chart-card-ltv', 'chart-card-incident');
  assert.match(ltv, /class="chart-card-header chart-card-header-flex chart-card-header--stacked"/,
    'LTV header must carry the stacked modifier');
  assert.ok(ltv.includes('Avg LTV'), 'Avg LTV button must stay');
  assert.ok(ltv.includes('Total Revenue'), 'Total Revenue button must stay');
  assert.ok(ltv.includes('Cohort Drilldown'), 'Cohort Drilldown button must stay');
  const row = dashboardCss.match(/\.chart-card-ltv \.chart-header-actions-row\s*\{([^}]*)\}/);
  assert.ok(row, 'LTV actions-row rule missing — .chart-header-actions-row has no rule anywhere else');
  assert.match(row[1], /display\s*:\s*flex/, 'LTV actions must sit on one flex row');
  assert.match(row[1], /align-items\s*:\s*center/, 'LTV actions must align centre');
  assert.match(row[1], /justify-content\s*:\s*space-between/, 'metric group and drilldown must sit at opposite ends');
  assert.match(row[1], /gap\s*:\s*var\(--space-2\)/, 'LTV actions gap must be 8px');
  // The rule must be scoped to .chart-card-ltv: the Projection card
  // (index.html:806) shares .chart-header-actions-row and is out of scope.
  assert.doesNotMatch(dashboardCss, /(^|\n)\.chart-header-actions-row\s*\{/,
    'no global .chart-header-actions-row rule — it would also restyle the Projection card');
  // Width check at ~314px: metric group (~150px) + drilldown (~110px) + 8px gap ≈ 268px.
  assert.ok(150 + 110 + 8 <= CONTENT_WIDTH_360, 'LTV actions must fit one row at 360px');
});

test('FDH legend renders one clean swatch per label (no legacy ::before duplicate)', () => {
  const oneHub = renderFiberDistributionSvg({
    totalDeployedPorts: 96, totalSparePorts: 1, overallSaturationPercent: 99,
    hubs: [{ areaName: 'Central Hub', totalPorts: 96, activeSubscribers: 95, offlineSubscribers: 0, assignedPorts: 95, saturationPercent: 99 }],
  });
  assert.equal(oneHub.split('<span class="chart-legend-chip').length - 1, 3, 'exactly three legend chips');
  assert.equal(oneHub.split('<span class="chart-legend-swatch').length - 1, 3,
    'exactly three swatch spans — one per chip, no duplicate dot in the markup');
  // The duplication is CSS: the legacy phase-3 rules (.chart-legend
  // span::before + min-height:24px, styles.css:147 and 406-408) put a
  // green dot on EVERY descendant span and stretch the 10px swatch into
  // a 24px-tall bar. The scoped override below kills both — and only for
  // the chip/swatch spans, so the phase-3 legends keep their dots.
  assert.match(stylesCss, /\.chart-legend \.chart-legend-chip::before,\s*\.chart-legend \.chart-legend-swatch::before\s*\{[^}]*content\s*:\s*none/,
    'scoped ::before override missing from styles.css');
  assert.match(stylesCss, /\.chart-legend \.chart-legend-chip,\s*\.chart-legend \.chart-legend-swatch\s*\{[^}]*min-height\s*:\s*0/,
    'scoped min-height:0 override missing from styles.css');
  assert.ok(stylesCss.includes('.chart-legend span::before'),
    'legacy phase-3 .chart-legend span::before rule must stay — the phase-3 legends rely on it');
  assert.ok(indexHtml.includes('class="legend-billed"'), 'phase-3 legend markup must stay');
  const legendRules = [...stylesCss.matchAll(/\.chart-legend\{([^}]*)\}/g)].map((m) => m[1]);
  // styles.css carries several .chart-legend rules (the legacy phase-3
  // one at :147 and the FDH one at :19024) — the FDH rule is the one
  // that centres its chips.
  const legend = legendRules.find((body) => /justify-content\s*:\s*center/.test(body));
  assert.ok(legend, '.chart-legend rule missing');
  assert.match(legend, /flex-wrap\s*:\s*wrap/, 'legend chips must wrap');
  assert.match(legend, /gap\s*:\s*6px\s+var\(--space-4\)/,
    'legend gap must be 6px row / 16px column (gap-y-1.5 / gap-x-4)');
  assert.match(legend, /justify-content\s*:\s*center/, 'legend chips must centre');
});

test('FDH viewBox height is computed from the hub count (1 hub tight, 4 hubs unchanged)', () => {
  // Why: the fixed 216-tall viewBox centred a single hub's bar at y=120,
  // leaving ~82px of internal whitespace below the metric strip at 312px
  // display. 1 hub -> topPad 12 + 1x42 row + bottomPad 12 = 66; 4 hubs
  // stay 216 (topPad 36 + 4x42 + bottomPad 12), so the pinned 5-hub
  // geometry in tests/fiber-hubs-mobile-redesign.test.js is untouched.
  const hub = (name) => ({ areaName: name, totalPorts: 96, activeSubscribers: 95, offlineSubscribers: 0, assignedPorts: 95, saturationPercent: 99 });
  const oneHub = renderFiberDistributionSvg({
    totalDeployedPorts: 96, totalSparePorts: 1, overallSaturationPercent: 99, hubs: [hub('Central Hub')],
  });
  assert.ok(oneHub.includes('viewBox="0 0 420 66"'), '1-hub chart must use the tight 420x66 viewBox');
  assert.ok(oneHub.includes('Central Hub'), 'single hub label must stay');
  const fourHubs = renderFiberDistributionSvg({
    totalDeployedPorts: 126, totalSparePorts: 4, overallSaturationPercent: 90,
    hubs: [hub('Central Hub'), hub('North Ridge'), hub('Farooq Ganj'), hub('Begum Kot')],
  });
  assert.ok(fourHubs.includes('viewBox="0 0 420 216"'), '4-hub chart must keep the 420x216 viewBox');
});

test('recovery-pipeline pills wrap on this card only, so all three show fully at 360px', () => {
  // Why wrap, not tighter padding (parent decision D5): the spec's
  // px-2.5/py-1.5 at text-xs does NOT shrink the pills — they are already
  // 10px horizontal at 11px font, and the spec values make them wider.
  // Measured at the repo's 0.6em glyph width: "Recovery Pipeline" (17ch)
  // ~112px + "Dues Aging (0–90+d)" (19ch) ~125px + "Top Defaulters" (14ch)
  // ~92px text, + 20px padding + 2px border each, + 2x8px gaps = ~411px
  // vs ~314px content width. All three cannot fit one row at the 11px
  // floor by padding alone — so THIS card's pill row wraps, keeping the
  // 11px floor and current tight padding. This reverses the 2026-11-22
  // scroll-row decision for this card only.
  const delinquency = article('chart-card-delinquency', 'chart-card-cpe');
  for (const label of ['Recovery Pipeline', 'Dues Aging (0–90+d)', 'Top Defaulters']) {
    assert.ok(delinquency.includes(`>${label}<`), `pill ${label} must stay in the header`);
  }
  const labels = ['Recovery Pipeline', 'Dues Aging (0–90+d)', 'Top Defaulters'];
  const oneRowWidth = labels.reduce((sum, label) => sum + Math.ceil(label.length * GLYPH_PX) + 20 + 2, 0) + 2 * 8;
  assert.ok(oneRowWidth > CONTENT_WIDTH_360,
    `one-row pill width ${oneRowWidth}px exceeds the ${CONTENT_WIDTH_360}px content width — wrap is required, padding alone cannot fit them`);
  const row = dashboardCss.match(/\.chart-card-delinquency \.chart-actions-scroll\s*\{([^}]*)\}/);
  assert.ok(row, 'delinquency pill-row wrap rule missing from dashboard.css');
  assert.match(row[1], /flex-wrap\s*:\s*wrap/, 'delinquency pills must wrap onto two rows');
  assert.match(row[1], /overflow-x\s*:\s*visible/, 'wrapped pills must not scroll-clip (no horizontal scroll)');
  // The base .chart-actions-scroll rule (scroll row) must stay for the
  // shared class — the wrap is scoped to this card only. (Anchor the
  // match at line start: the scoped rule above also ends in
  // ".chart-actions-scroll {" and would match an unanchored pattern.)
  const base = dashboardCss.match(/(?:^|\n)\.chart-actions-scroll\s*\{([^}]*)\}/);
  assert.ok(base, 'base .chart-actions-scroll rule missing');
  assert.match(base[1], /flex-wrap\s*:\s*nowrap/, 'base scroll-row behaviour must stay nowrap for any other use');
});
