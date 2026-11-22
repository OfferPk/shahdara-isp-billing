// Fiber Distribution Hubs & Splitter Matrix — mobile redesign (360px).
// The panel clipped on the left at 360px: .chart-svg-container was a ROW
// flex built for a single SVG child, but renderFiberDistributionSvg
// returns TWO top-level siblings (top-bar div + svg), so the flex line
// overflowed and justify-content:center split the overflow LEFT and
// RIGHT. The fix stacks the container in a column, narrows the SVG
// viewBox 560 -> 420 with 15px labels (11.1px effective at 312px
// display — the 11px content floor, Sharafat 97), and moves the legend
// out of the SVG into wrapping HTML chips.
// Text-only + real render: imports the renderer (like dashboard.test.js)
// and asserts on the returned string + the CSS rules. No browser needed.
// Fixture data only — generic area names, no real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderFiberDistributionSvg } from '../dashboard-charts.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const dashboardCss = read('dashboard.css');
const stylesCss = read('styles.css');
const tokensCss = read('tokens.css');

// 360px viewport -> .chart-svg-container content width (same arithmetic
// as the prep repro): 360 - 2x12 (region pad, --space-3) - 2x1 (region
// border) - 2x1 (card border) - 2x10 (card pad at <=680px) = 312px.
const space3 = Number((tokensCss.match(/--space-3:\s*(\d+)px/) || [])[1]);
const containerWidth360 = 360 - 2 * space3 - 2 * 1 - 2 * 1 - 2 * 10;
// 320px viewport: same arithmetic.
const containerWidth320 = 320 - 2 * space3 - 2 * 1 - 2 * 1 - 2 * 10;
// Per-glyph width the repo's fit tests use: 6.6px/char at 11px = 0.6em.
const GLYPH_EM = 0.6;

const metrics = {
  totalDeployedPorts: 96,
  totalSparePorts: 1,
  overallSaturationPercent: 99,
  hubs: [
    { areaName: 'Central Hub', totalPorts: 96, activeSubscribers: 95, offlineSubscribers: 0, assignedPorts: 95, saturationPercent: 99 },
    { areaName: 'North Ridge', totalPorts: 10, activeSubscribers: 9, offlineSubscribers: 0, assignedPorts: 9, saturationPercent: 90 },
    { areaName: 'Farooq Ganj', totalPorts: 10, activeSubscribers: 7, offlineSubscribers: 1, assignedPorts: 8, saturationPercent: 80 },
    { areaName: 'Begum Kot', totalPorts: 10, activeSubscribers: 5, offlineSubscribers: 0, assignedPorts: 5, saturationPercent: 50 },
    { areaName: 'Eastside Long Area Name Here', totalPorts: 10, activeSubscribers: 4, offlineSubscribers: 2, assignedPorts: 6, saturationPercent: 60 },
  ],
};

const rendered = renderFiberDistributionSvg(metrics);
const svgOnly = rendered.slice(rendered.indexOf('<svg'), rendered.indexOf('</svg>') + '</svg>'.length);

test('container stacks its children in a column (shared fix with Recovery Pipeline)', () => {
  const rule = dashboardCss.match(/\.chart-svg-container\s*\{([^}]*)\}/);
  assert.ok(rule, '.chart-svg-container rule missing from dashboard.css');
  const body = rule[1];
  assert.match(body, /display\s*:\s*flex/, 'container must stay a flex container');
  assert.match(body, /flex-direction\s*:\s*column/, 'container must stack children (was row flex)');
  assert.match(body, /align-items\s*:\s*stretch/, 'children must stretch to full width');
  assert.match(body, /justify-content\s*:\s*flex-start/, 'stack must start at the top');
  assert.doesNotMatch(body, /justify-content\s*:\s*center/, 'centered overflow is the defect — must be gone');
  const topBarRule = dashboardCss.match(/\.chart-svg-container\s+\.chart-top-bar\s*\{([^}]*)\}/);
  assert.ok(topBarRule, '.chart-svg-container .chart-top-bar rule missing');
  assert.match(topBarRule[1], /width\s*:\s*100%/, 'top bar must span the card width');
});

test('top-bar metrics are three wrapping cells, same numbers and order', () => {
  assert.ok(rendered.includes('Markaz-e-Taqseem-e-Fiber (FDH)'), 'title missing');
  assert.equal(rendered.split('Markaz-e-Taqseem-e-Fiber (FDH)').length - 1, 1, 'title must appear exactly once');
  assert.ok(rendered.includes('chart-metric-strip'), 'metrics must use the .chart-metric-strip pattern');
  assert.equal(rendered.split('chart-metric-cell').length - 1, 3, 'exactly three metric cells');
  const labels = [...rendered.matchAll(/chart-metric-label">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Total Ports', 'Dark Headroom', 'Saturation'], 'same labels, same order');
  const values = [...rendered.matchAll(/chart-metric-value[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(values, ['96', '1', '99%'], 'same numbers, same order');
  assert.ok(!rendered.includes('chart-metric-sub'), 'old inline metric span must be gone');
  assert.ok(!rendered.includes('Total Ports: <strong>'), 'old "Total Ports: 96 · ..." inline format must be gone');
  assert.match(stylesCss, /\.chart-top-bar\{[^}]*flex-wrap\s*:\s*wrap/, 'top bar itself must wrap');
});

test('no centered overflow at 360px: every top-bar item fits the 312px container', () => {
  assert.equal(containerWidth360, 312, 'container width arithmetic changed — re-measure');
  // Widest single item is the metric strip: 3 cells, each at least its
  // label ("Saturation", 10 chars at 11px, 0.6em) + 2 x 8px gaps.
  const stripMin = 3 * Math.ceil(10 * 11 * GLYPH_EM) + 2 * 8;
  assert.ok(stripMin <= containerWidth360, `metric strip min-content ${stripMin}px must fit ${containerWidth360}px`);
  // Longest unbreakable word anywhere in the top bar: "Saturation".
  const longestWord = Math.ceil(10 * 11 * GLYPH_EM) + 8;
  assert.ok(longestWord <= containerWidth360, `longest word ${longestWord}px must fit ${containerWidth360}px`);
  assert.ok(rendered.includes('width="100%"'), 'svg must take the container width, not a fixed width');
});

test('no centered overflow at 320px either', () => {
  assert.equal(containerWidth320, 272, 'container width arithmetic changed — re-measure');
  const stripMin = 3 * Math.ceil(10 * 11 * GLYPH_EM) + 2 * 8;
  assert.ok(stripMin <= containerWidth320, `metric strip min-content ${stripMin}px must fit ${containerWidth320}px`);
});

test('SVG viewBox is narrowed to 420x240 (populated) while the empty state stays 560x240', () => {
  assert.ok(rendered.includes('viewBox="0 0 420 240"'), 'populated chart must use the narrowed 420x240 viewBox');
  assert.ok(!rendered.includes('viewBox="0 0 560 240"'), 'populated chart must not keep the 560-wide viewBox');
  const empty = renderFiberDistributionSvg({ hubs: [], totalDeployedPorts: 0 });
  assert.ok(empty.includes('viewBox="0 0 560 240"'), 'empty state is out of scope — its viewBox stays 560x240');
  assert.ok(empty.includes('No fiber distribution hubs or drops recorded'), 'empty state text unchanged');
});

test('SVG text clears the 11px floor at 360px display', () => {
  const labelFont = Number((svgOnly.match(/text-anchor="end"[^>]*font-size="([\d.]+)"/) || [])[1]);
  const valueFont = Number((svgOnly.match(/text-anchor="start"[^>]*font-size="([\d.]+)"/) || [])[1]);
  assert.equal(labelFont, 15, 'hub labels must be 15px in viewBox units');
  assert.equal(valueFont, 15, 'value text must be 15px in viewBox units');
  const scale = containerWidth360 / 420;
  assert.ok(labelFont * scale >= 11, `labels read ${(labelFont * scale).toFixed(1)}px effective at 312px display — must clear the 11px floor`);
  assert.ok(valueFont * scale >= 11, `values read ${(valueFont * scale).toFixed(1)}px effective at 312px display — must clear the 11px floor`);
  const fonts = [...svgOnly.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(fonts.length > 0 && fonts.every((f) => f >= 15), 'no sub-15px text may remain in the populated SVG');
});

test('labels and values fit inside the viewBox (measured geometry)', () => {
  // Label <text> ends at leftPad - 12 (text-anchor="end"); worst case is
  // the truncated 16-glyph label (slice(0,15) + '…') at 15px, 0.6em.
  // (x= comes before text-anchor= in the rendered element.)
  const labelX = Number((svgOnly.match(/x="(\d+)"[^>]*text-anchor="end"/) || [])[1]);
  assert.equal(labelX, 148, 'label anchor must be leftPad(160) - 12');
  const worstLabel = 16 * GLYPH_EM * 15;
  assert.ok(labelX - worstLabel >= 0, `worst-case label ${worstLabel}px must start inside the viewBox (starts at ${labelX - worstLabel})`);
  // Value <text> starts at leftPad + plotWidth + 8; worst case is
  // "100/100 (100%)" (14 glyphs) at 15px bold, 0.6em.
  const valueX = Number((svgOnly.match(/x="(\d+)"[^>]*text-anchor="start"/) || [])[1]);
  assert.equal(valueX, 288, 'value anchor must be leftPad(160) + plotWidth(120) + 8');
  const worstValue = 14 * GLYPH_EM * 15;
  assert.ok(valueX + worstValue <= 420, `worst-case value ends at ${valueX + worstValue}, must stay inside the 420 viewBox`);
});

test('legend is HTML chips below the SVG, not a single-line SVG group', () => {
  assert.ok(rendered.includes('<div class="chart-legend"'), 'legend must be an HTML div below the SVG');
  assert.equal(rendered.split('chart-legend-chip').length - 1, 3, 'exactly three legend chips');
  const chips = [...rendered.matchAll(/chart-legend-chip"[^>]*>(?:<span[^>]*><\/span>)([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(chips, ['Active Drops', 'Offline Drops', 'Dark Headroom (Spare)'], 'same legend items, same order');
  assert.ok(!svgOnly.includes('Dark Headroom (Spare)'), 'legend text must not live inside the SVG any more');
  assert.ok(!svgOnly.includes('<g transform="translate('), 'no centered SVG legend group may remain');
  assert.ok(rendered.indexOf('<div class="chart-legend"') > rendered.indexOf('</svg>'), 'legend must come after the SVG');
  assert.match(stylesCss, /\.chart-legend\{[^}]*flex-wrap\s*:\s*wrap/, 'legend chips must wrap');
  assert.match(stylesCss, /\.chart-legend-chip\{[^}]*var\(--text-table-head\)/, 'legend text must sit at the 11px floor token');
});

test('numbers, labels and colour thresholds are unchanged (layout only)', () => {
  for (const [name, text] of [
    ['Central Hub', '95/96 (99%)'],
    ['North Ridge', '9/10 (90%)'],
    ['Farooq Ganj', '8/10 (80%)'],
    ['Begum Kot', '5/10 (50%)'],
    ['Eastside Long A…', '6/10 (60%)'],
  ]) {
    assert.ok(rendered.includes(name), `hub ${name} missing`);
    assert.ok(rendered.includes(text), `hub ${name} must show ${text}`);
  }
  assert.ok(rendered.includes('Eastside Long A…'), '16+ char names still truncate to slice(0,15) + ellipsis');
  assert.ok(!rendered.includes('Eastside Long Area Name Here'), 'untruncated long name must not appear');
  // Thresholds: >=85 red, 70-84 amber, <70 emerald.
  assert.ok(svgOnly.includes('fill="#ef4444"'), '99% and 90% values must stay red');
  assert.ok(svgOnly.includes('fill="#d97706"'), '80% value must stay amber');
  assert.ok(svgOnly.includes('fill="var(--color-emerald)"'), '50% and 60% values must stay emerald');
  assert.ok(rendered.includes('style="color:#ef4444"'), 'overall 99% saturation must stay red in the top bar');
});

test('tokens are used and no new hex appears in the populated render', () => {
  for (const token of ['var(--color-brand-600)', 'var(--color-emerald-dark)', 'var(--color-emerald)', 'var(--color-slate-400)']) {
    assert.ok(rendered.includes(token), `populated render must use ${token}`);
  }
  // Kept hex only (parent decision — no exact token): offline amber,
  // amber scale, red scale. Anything else is a new hex. var() FALLBACK
  // hexes (var(--ink, #182e2a), var(--bg-soft, #f1f5f3)) are pre-existing
  // and deliberately kept — strip them before the audit.
  const kept = new Set(['#f59e0b', '#d97706', '#ef4444']);
  const withoutFallbacks = rendered.replace(/var\(--[^,]+,\s*#[0-9a-fA-F]{6}\)/g, 'var(--token)');
  const hexes = [...withoutFallbacks.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
  const unexpected = hexes.filter((h) => !kept.has(h));
  assert.deepEqual(unexpected, [], `unexpected hex in the populated render: ${unexpected.join(', ')}`);
  assert.ok(hexes.includes('#f59e0b'), 'offline amber must still be present (kept hex)');
});
