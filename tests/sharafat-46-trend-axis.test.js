import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMonthlyTrendSvg } from '../dashboard-charts.js';

// Sharafat 46: the trend-chart y-axis labels used to round to whole "k"
// (a 1,500 tick read "2k", +33%), and the rounding collapsed distinct
// gridlines to the same label (max 1,500 gave two "2k" lines). The fix is
// label-only — bare exact numbers with en-PK grouping — and the tick VALUES
// are unchanged (exact multiples of 250). These tests pin the LABELS, so
// they extract the y-axis <text> nodes (x="56", plotX − 8) rather than
// substring-matching the whole SVG: the bar aria-labels and <title>s already
// contain formatPKR figures and would false-pass a naive includes() check.

// The y-axis labels are the <text> nodes right-anchored at x = plotX − 8 = 56.
function yAxisLabels(svg) {
  return [...svg.matchAll(/<text x="56"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
}

function trendsWithMax(max) {
  return [
    { month: '2026-05', monthLabel: "May '26", billed: 0, collected: 0 },
    { month: '2026-06', monthLabel: "Jun '26", billed: 0, collected: 0 },
    { month: '2026-07', monthLabel: "Jul '26", billed: 0, collected: 0 },
    { month: '2026-08', monthLabel: "Aug '26", billed: 0, collected: 0 },
    { month: '2026-09', monthLabel: "Sep '26", billed: 0, collected: 0 },
    { month: '2026-10', monthLabel: "Oct '26", billed: max, collected: 0 },
  ];
}

test('Sharafat 46: max-4,600 chart labels equal the tick values (acceptance)', () => {
  // yCeil = ceil(4,600 * 1.15 / 1,000) * 1,000 = 6,000; ticks are
  // yCeil / 4 steps: 0 / 1,500 / 3,000 / 4,500 / 6,000.
  const svg = renderMonthlyTrendSvg(trendsWithMax(4600));
  assert.deepEqual(yAxisLabels(svg), ['0', '1,500', '3,000', '4,500', '6,000']);
});

test('Sharafat 46: max-1,500 chart gives five distinct labels (no collapse)', () => {
  // Before the fix the 1,500 and 2,000 gridlines both read "2k".
  const svg = renderMonthlyTrendSvg(trendsWithMax(1500));
  const labels = yAxisLabels(svg);
  assert.deepEqual(labels, ['0', '500', '1,000', '1,500', '2,000']);
  assert.equal(new Set(labels).size, labels.length);
});

test('Sharafat 46: small-max chart keeps sub-1,000 ticks exact', () => {
  // Max 800 → yCeil 1,000; ticks 0 / 250 / 500 / 750 / 1,000. The
  // sub-1,000 ticks were already exact; only the 1,000 tick changes
  // (it read "1k" before the fix).
  const svg = renderMonthlyTrendSvg(trendsWithMax(800));
  assert.deepEqual(yAxisLabels(svg), ['0', '250', '500', '750', '1,000']);
});

test('Sharafat 46: large-max labels stay exact and fit the 56px gutter', () => {
  // Max 250,000 → yCeil 288,000; ticks 0 / 72,000 / 144,000 / 216,000 /
  // 288,000. The longest label "288,000" is 7 characters ≈ 39px at
  // font-size 10 — inside the 56px label gutter (plotX − 8). A label that
  // fits at the 560 viewBox width fits at 360px too: the SVG scales via
  // viewBox, so this is a viewBox-coordinate bound, not a viewport one.
  const svg = renderMonthlyTrendSvg(trendsWithMax(250000));
  const labels = yAxisLabels(svg);
  assert.deepEqual(labels, ['0', '72,000', '144,000', '216,000', '288,000']);
  assert.ok(Math.max(...labels.map((label) => label.length)) <= 8);
});

test('Sharafat 46: target line and legend are untouched by the label fix', () => {
  // The dashboard.test.js :1234 fixture re-rendered: the target label still
  // uses the full formatPKR form and the legend still lists the milestone;
  // only the gridline labels changed (now exact).
  const trends = [
    { month: '2026-08', monthLabel: "Aug '26", billed: 10000, collected: 8500 },
    { month: '2026-09', monthLabel: "Sep '26", billed: 12000, collected: 11000 },
    { month: '2026-10', monthLabel: "Oct '26", billed: 15000, collected: 12500 },
  ];
  const svg = renderMonthlyTrendSvg(trends, { targetRevenue: 14000 });
  assert.ok(svg.includes('chart-target-line'));
  assert.ok(svg.includes('chart-target-label'));
  assert.ok(svg.includes('Target: PKR 14,000'));
  assert.ok(svg.includes('Target Milestone'));
  assert.deepEqual(yAxisLabels(svg), ['0', '4,500', '9,000', '13,500', '18,000']);
});
