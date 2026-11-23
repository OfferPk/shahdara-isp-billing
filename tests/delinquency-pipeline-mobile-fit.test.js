// Delinquency Recovery Pipeline mobile fit (2026-11-22, user screenshot):
// the "Khata Wusooli & Aging Pipeline" top bar clipped on the LEFT at 360px
// because .chart-svg-container was a nowrap flex ROW holding two siblings
// (top bar + SVG) whose preferred width (~803px) was ~2.8x the 286px
// container. The fix stacks them (column), moves the pacing line into a
// wrapping HTML bar, and tokenizes the panel per the prep's table.
// Fixture values are generic placeholders, never the screenshot's figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderDelinquencyPipelineSvg } from '../dashboard-charts.js';
import { DELINQUENCY_STAGES } from '../dashboard.js';

const dashboardCss = fs.readFileSync(path.resolve('./dashboard.css'), 'utf-8');
const stylesCss = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
const tokensCss = fs.readFileSync(path.resolve('./tokens.css'), 'utf-8');
const chartsSrc = fs.readFileSync(path.resolve('./dashboard-charts.js'), 'utf-8');
const dashboardSrc = fs.readFileSync(path.resolve('./dashboard.js'), 'utf-8');

function ruleBlock(css, selector) {
  const i = css.indexOf(selector);
  if (i < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (depth === 0) return css.slice(open + 1, j); }
  }
  throw new Error(`unbalanced rule: ${selector}`);
}

const delinquencyFn = chartsSrc.slice(
  chartsSrc.indexOf('export function renderDelinquencyPipelineSvg'),
  chartsSrc.indexOf('export function renderCpeAssetLifecycleSvg'),
);
const stagesSrc = dashboardSrc.slice(
  dashboardSrc.indexOf('export const DELINQUENCY_STAGES'),
  dashboardSrc.indexOf('];', dashboardSrc.indexOf('export const DELINQUENCY_STAGES')),
);

// Generic placeholder fixture (same shape as the real pipeline data).
const fixture = {
  totalDelinquentAccounts: 4,
  totalDelinquentDues: 12400,
  totalExpectedRecovery: 8300,
  dailyPacingTarget: 210,
  pipelineHealthStatus: 'Moderate Delinquency Backlog',
  topDelinquentAreas: [{ areaName: 'Sector A', totalOverdue: 6100 }],
  stages: DELINQUENCY_STAGES.map((s, i) => ({
    ...s,
    totalOverdueAmount: [0, 12400, 0, 6100][i],
    subscriberCount: [0, 5, 0, 2][i],
  })),
};
const out = renderDelinquencyPipelineSvg(fixture);

test('container stacks the top bar above the chart (column, stretch)', () => {
  const block = ruleBlock(dashboardCss, '.chart-svg-container');
  assert.ok(/flex-direction:\s*column/.test(block), 'container must be a column');
  assert.ok(/align-items:\s*stretch/.test(block), 'column children must stretch to full width');
  assert.ok(!/flex-direction:\s*row/.test(block), 'container must not be a row');
});

test('top bar spans the full container width', () => {
  const block = ruleBlock(dashboardCss, '.chart-svg-container .chart-top-bar');
  assert.ok(/width:\s*100%/.test(block), 'top bar must be 100% wide in the column container');
});

test('top bar wraps inside the container instead of clipping', () => {
  const block = ruleBlock(stylesCss, '.chart-top-bar');
  assert.ok(/flex-wrap:\s*wrap/.test(block), 'top bar must wrap its title + stats');
  assert.ok(out.indexOf('chart-top-bar') < out.indexOf('<svg'), 'top bar must come before the chart');
});

test('render order is top bar, chart, pacing bar', () => {
  // Re-pinned at the Home Tab M3 rebase (2026-11-23): S wraps the render
  // in one .chart-with-topbar column (the shared .chart-svg-container is
  // a row flex, so a bare top-bar div + SVG sat side by side and squeezed
  // each other) — the render now starts with the wrapper, the top bar
  // its first child. The order intent is unchanged.
  assert.ok(out.startsWith('<div class="chart-with-topbar"><div class="chart-top-bar">'), 'render must start with the wrapper + top bar');
  const topBarAt = out.indexOf('<div class="chart-top-bar">');
  const svgAt = out.indexOf('<svg');
  const svgEnd = out.indexOf('</svg>');
  const pacingAt = out.indexOf('<div class="chart-pacing-bar">');
  assert.ok(topBarAt < svgAt && svgAt < svgEnd && svgEnd < pacingAt, 'order must be top bar, chart, pacing bar');
});

test('pacing line lives in the wrapping HTML bar, not in the SVG', () => {
  const pacingBar = out.match(/<div class="chart-pacing-bar">([\s\S]*?)<\/div>/);
  assert.ok(pacingBar, 'pacing bar must exist in the render output');
  assert.ok(pacingBar[1].includes('Pacing Target:'), 'pacing bar must carry the pacing line');
  assert.ok(!/<text[^>]*>[\s\S]*?Pacing Target:[\s\S]*?<\/text>/.test(out), 'pacing line must not remain an SVG <text>');
  const barBlock = ruleBlock(stylesCss, '.chart-pacing-bar');
  assert.ok(!/white-space:\s*nowrap/.test(barBlock), 'pacing bar must wrap');
  assert.ok(barBlock.includes('var(--text-table-head)'), 'pacing bar must use the token font size');
});

test('top-bar + metric-sub are tokenized', () => {
  const topBar = ruleBlock(stylesCss, '.chart-top-bar');
  assert.ok(!/padding:\s*2px 4px 6px/.test(topBar), 'top-bar padding must be tokenized');
  assert.ok(!/gap:\s*4px/.test(topBar), 'top-bar gap must be tokenized');
  assert.ok(topBar.includes('var(--space-1)') && topBar.includes('var(--space-2)'), 'top-bar must use space tokens');
  const title = ruleBlock(stylesCss, '.chart-top-bar-title');
  assert.ok(!/13px/.test(title), 'title must not carry a 13px literal');
  assert.ok(title.includes('var(--text-tab)'), 'title must use --text-tab');
  const sub = ruleBlock(stylesCss, '.chart-metric-sub');
  assert.ok(!/11px/.test(sub), 'metric-sub must not carry an 11px literal');
  assert.ok(sub.includes('var(--text-table-head)'), 'metric-sub must use --text-table-head');
  assert.ok(!sub.includes('#64748b'), 'metric-sub must drop the dead #64748b fallback (--muted is defined)');
});

test('action link is tokenized; 6px radius kept with a why-comment', () => {
  const link = ruleBlock(dashboardCss, '.chart-action-link');
  assert.ok(!/11\.5px/.test(link), 'action link must not carry an 11.5px literal');
  assert.ok(link.includes('var(--text-table-head)'), 'action link must use --text-table-head');
  assert.ok(!/rgba\(14, 91, 77/.test(link), 'action link must not carry the brand rgba literals');
  assert.ok(link.includes('color-mix(in srgb, var(--color-brand-600)'), 'action link must use color-mix over --color-brand-600');
  assert.ok(link.includes('var(--space-1)') && link.includes('var(--space-2-5)'), 'action link padding must use space tokens');
  assert.ok(/border-radius:\s*6px/.test(link), '6px radius is kept (no token)');
  assert.ok(link.includes('no radius token'), 'kept 6px radius must carry a why-comment');
  const hover = ruleBlock(dashboardCss, '.chart-action-link:hover');
  assert.ok(!/rgba\(14, 91, 77/.test(hover), 'action-link hover must not carry the brand rgba literal');
  assert.ok(hover.includes('color-mix(in srgb, var(--color-brand-600) 14%'), 'hover must use the 14% color-mix');
});

test('render colors are tokenized; kept hex carries why-comments', () => {
  assert.ok(!delinquencyFn.includes('style="color:#047857"'), 'Net Exp must not carry the #047857 literal');
  assert.ok(delinquencyFn.includes('style="color:var(--color-emerald-dark)"'), 'Net Exp must use --color-emerald-dark');
  assert.ok(delinquencyFn.includes("let statusColor = 'var(--color-emerald-dark)'"), 'healthy status must use --color-emerald-dark');
  assert.ok(delinquencyFn.includes("statusColor = 'var(--td-risk-moderate-deep)'"), 'moderate status must use --td-risk-moderate-deep');
  assert.ok(!delinquencyFn.includes('var(--bg-soft'), 'render must not use the undefined --bg-soft');
  assert.ok(delinquencyFn.includes('fill="#f1f5f3"'), 'track fill keeps the exact #f1f5f3 value');
  assert.ok(delinquencyFn.includes('Plan 588 G4 pin'), 'kept track value must cite the Plan 588 pin');
  assert.ok(!delinquencyFn.includes('rgba(14, 91, 77'), 'render must not carry the brand rgba literal');
  assert.ok(!delinquencyFn.includes('stroke="#0e5b4d"'), 'empty-state check must not carry the #0e5b4d literal');
  assert.ok(delinquencyFn.includes('color-mix(in srgb, var(--color-brand-600) 8%, transparent)'), 'empty state must use the brand color-mix');
  assert.ok(delinquencyFn.includes('font-size="var(--text-tab)"'), 'empty-state title must use --text-tab');
  assert.ok(delinquencyFn.includes('font-size="var(--text-table-head)"'), 'empty-state subtitle must use --text-table-head');
  // #dc2626 kept in both places (statusColor + top-bar Overdue figure).
  assert.ok(delinquencyFn.includes("statusColor = '#dc2626'"), 'critical status keeps #dc2626');
  assert.ok(delinquencyFn.includes('style="color:#dc2626"'), 'Overdue figure keeps #dc2626');
  assert.ok(delinquencyFn.includes('no exact token'), 'kept #dc2626 must carry a why-comment');
});

test('stage colors are tokenized at the shared source; kept hex carries why-comments', () => {
  assert.ok(stagesSrc.includes("color: 'var(--color-brand-600)'"), 'grace stage must use --color-brand-600');
  assert.ok(stagesSrc.includes("color: 'var(--td-risk-moderate-deep)'"), 'throttle stage must use --td-risk-moderate-deep');
  assert.ok(stagesSrc.includes("color: '#0284c7'"), 'notice stage keeps #0284c7');
  assert.ok(stagesSrc.includes("color: '#dc2626'"), 'severe stage keeps #dc2626');
  assert.ok(stagesSrc.includes('no exact token'), 'kept stage hex must carry why-comments');
  // The kept hex still paints the bars (shared source feeds the render + the modal tables).
  assert.ok(out.includes('fill="#0284c7"'), 'notice bar must paint in the kept #0284c7');
  assert.ok(out.includes('fill="#dc2626"'), 'severe bar must paint in the kept #dc2626');
});

test('numbers are unchanged (generic fixture)', () => {
  assert.ok(out.includes('Khata Wusooli &amp; Aging Pipeline'), 'title unchanged');
  assert.ok(out.includes('Delinquent:'), 'delinquent label unchanged');
  assert.ok(out.includes('PKR 12,400'), 'overdue amount unchanged');
  assert.ok(out.includes('PKR 8,300'), 'expected recovery unchanged');
  assert.ok(out.includes('PKR 210/day'), 'pacing target unchanged');
  assert.ok(out.includes('Sector A (PKR 6,100)'), 'top dues sector unchanged');
  assert.ok(out.includes('5 (PKR 12,400)'), 'notice stage count + amount unchanged');
  assert.equal(DELINQUENCY_STAGES.length, 4, 'still four stages');
  assert.deepEqual(
    DELINQUENCY_STAGES.map((s) => s.recoveryProbability),
    [0.9, 0.7, 0.45, 0.15],
    'recovery probabilities unchanged',
  );
});

test('measured container widths at 360px / 320px (from the live CSS rules)', () => {
  // .dashboard padding (<=800px) + region padding + region border +
  // card padding (both <=680px overrides) — the same arithmetic the
  // repro used; the container is 286px at 360px, 246px at 320px.
  function pxPerSide(block, prop) {
    const m = block.match(new RegExp(`${prop}:\\s*([^;]+);`));
    const parts = m[1].trim().split(/\s+/);
    const num = (tok) => {
      const vm = tok.match(/^var\(--space-(\S+?)\)$/);
      if (vm) return Number(tokensCss.match(new RegExp(`--space-${vm[1]}:\\s*(\\d+)px`))[1]);
      return Number(tok.replace('px', ''));
    };
    if (parts.length === 1) return [num(parts[0]), num(parts[0])];
    if (parts.length === 2) return [num(parts[0]), num(parts[1])];
    return [num(parts[0]), num(parts[1])];
  }
  const regionOverride = dashboardCss.match(/@media \(max-width: 680px\) \{[\s\S]*?\.dashboard-charts-region \{([^}]*)\}/);
  const cardOverride = dashboardCss.match(/@media \(max-width: 680px\) \{[\s\S]*?\.dashboard-chart-card \{([^}]*)\}/);
  const regionPad = pxPerSide(regionOverride[1], 'padding');
  const cardPad = pxPerSide(cardOverride[1], 'padding');
  const widthAt = (viewport) => viewport - 2 * 14 - 2 * regionPad[1] - 2 * 1 - 2 * cardPad[1];
  assert.equal(widthAt(360), 286, 'container is 286px at a 360px viewport');
  assert.equal(widthAt(320), 246, 'container is 246px at a 320px viewport');
});
