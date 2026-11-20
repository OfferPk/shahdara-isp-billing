// tests/performance-analytics.test.js — Performance & Collection Analytics.
// SVG overlap fixes, package-tier normalization, 4 sub-tabs, 10px font floor.
// This file IS a pinning file: it asserts the EN/UR parity total below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  canonicalPackageTierName,
  truncateMethodLegendLabel,
  methodPeriodDisplayLabel,
  calculatePackageDistribution,
  calculatePackageMarginBreakdown,
  renderSeasonalCashflowSvg,
  renderChurnRiskGaugeSvg,
  renderUpstreamGatewaySvg,
  renderAcquisitionRoiSvg,
  renderPaymentMethodSvg
} from '../dashboard-charts.js';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dcSrc = readFileSync(resolve(ROOT, 'dashboard-charts.js'), 'utf8');
const indexSrc = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const cssSrc = readFileSync(resolve(ROOT, 'dashboard.css'), 'utf8');

test('canonicalPackageTierName merges case and spacing variants into one tier', () => {
  assert.equal(canonicalPackageTierName('15mbps'), '15 Mbps');
  assert.equal(canonicalPackageTierName('15 Mbps'), '15 Mbps');
  assert.equal(canonicalPackageTierName('5mbps'), '5 Mbps');
  assert.equal(canonicalPackageTierName('29mbps'), '29 Mbps');
  assert.equal(canonicalPackageTierName('15Mbps Unlimited'), '15 Mbps Unlimited');
  assert.equal(canonicalPackageTierName('15mbps unlimited'), '15 Mbps Unlimited');
  assert.equal(canonicalPackageTierName('5Mbps / 150GB'), '5 Mbps / 150 GB');
  assert.equal(canonicalPackageTierName('  15 Mbps  '), '15 Mbps');
  assert.equal(canonicalPackageTierName(''), 'Unassigned');
  assert.equal(canonicalPackageTierName(null), 'Unassigned');
  assert.equal(canonicalPackageTierName('Free Trial'), 'Free Trial');
});

test('distribution and margin aggregators merge variants with summed counts', () => {
  const customers = [
    { archived: false, packageSpeed: '15mbps', serviceStatus: 'active', monthlySellingAmount: 3000 },
    { archived: false, packageSpeed: '15mbps', serviceStatus: 'active', monthlySellingAmount: 3000 },
    { archived: false, packageSpeed: '15mbps', serviceStatus: 'active', monthlySellingAmount: 3000 },
    { archived: false, packageSpeed: '15 Mbps', serviceStatus: 'active', monthlySellingAmount: 3000 },
    { archived: false, packageSpeed: '15 Mbps', serviceStatus: 'active', monthlySellingAmount: 3000 },
    { archived: false, packageSpeed: '29mbps', serviceStatus: 'active', monthlySellingAmount: 3999 }
  ];
  const dist = calculatePackageDistribution({ customers });
  assert.equal(dist.packages.length, 2);
  const t15 = dist.packages.find((p) => p.packageName === '15 Mbps');
  assert.equal(t15.count, 5);
  assert.equal(t15.monthlyRevenue, 15000);
  const margin = calculatePackageMarginBreakdown({ customers }, { costPerMbps: 50 });
  assert.equal(margin.packages.length, 2);
  assert.equal(margin.packages.find((p) => p.packageName === '15 Mbps').subscriberCount, 5);
  assert.equal(margin.packages.find((p) => p.packageName === '29 Mbps').subscriberCount, 1);
});

test('seasonal YoY label sits on its own line above the header', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .map((monthName, i) => ({
      monthName, currentYearAmount: 40000 + i * 1000, priorYearAmount: 30000 + i * 1000,
      currentYearCount: 5, yoyGrowthPercent: 10
    }));
  months[9].currentYearAmount = 123456;
  const svg = renderSeasonalCashflowSvg({
    months, currentMonthIndex: 11, currentYear: 2026, priorYear: 2025,
    currentYearYtdTotal: 900000, priorYearYtdTotal: 450000,
    ytdGrowthPercent: 100, velocityStatus: 'Baseline Period',
    hasCurrentYearData: true, hasPriorYearData: true,
    peakMonth: { monthIndex: 9, monthName: 'Oct', currentYearAmount: 123456 }
  });
  assert.match(svg, /<text x="570" y="8"[^>]*>\s*YoY: \+100% \(Baseline Period\)/);
});

test('seasonal peak badge fits its label and stays inside the plot at December', () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .map((monthName, i) => ({
      monthName, currentYearAmount: 40000 + i * 1000, priorYearAmount: 30000 + i * 1000,
      currentYearCount: 5, yoyGrowthPercent: 10
    }));
  months[11].currentYearAmount = 1234567;
  const svg = renderSeasonalCashflowSvg({
    months, currentMonthIndex: 11, currentYear: 2026, priorYear: 2025,
    currentYearYtdTotal: 900000, priorYearYtdTotal: 450000,
    ytdGrowthPercent: 100, velocityStatus: 'Baseline Period',
    hasCurrentYearData: true, hasPriorYearData: true,
    peakMonth: { monthIndex: 11, monthName: 'December', currentYearAmount: 1234567 }
  });
  const rect = svg.match(/<rect x="(-?[\d.]+)" y="-12" width="([\d.]+)" height="15"[^>]*fill="#0e5b4d"/);
  assert.ok(rect, 'peak badge rect exists');
  const x = parseFloat(rect[1]);
  const w = parseFloat(rect[2]);
  assert.ok(w >= Math.ceil('Peak: December (PKR 1,234,567)'.length * 6.0) + 18, `badge width ${w} fits its label`);
  // PARENT CORRECTION 2026-11-20: the rect x is RELATIVE to the callout
  // group's translate — the bounds check must use the ABSOLUTE span
  // (translate + rect x). The first draft compared the raw relative x
  // (-99) against absolute bounds and failed a correct badge.
  const group = svg.match(/<g transform="translate\(([\d.]+), ([\d.]+)\)" text-anchor="middle">\s*<rect x="/);
  const absX = (group ? parseFloat(group[1]) : 0) + x;
  assert.ok(absX >= 0 && absX + w <= 570, `badge spans ${absX}..${absX + w}, inside the plot`);
});

test('churn readout sits below the pivot line, clear of the needle', () => {
  const risk = {
    totalCustomers: 50, churnRiskScore: 12, riskTier: 'low', riskTierLabel: 'Low Churn Risk',
    highRisk: { count: 1, percent: 2, totalDue: 3000 },
    moderateRisk: { count: 2, percent: 4, totalDue: 4000 },
    lowRisk: { count: 47, percent: 94 }, atRiskRevenue: 7000
  };
  const svg = renderChurnRiskGaugeSvg(risk);
  assert.match(svg, /<text x="115" y="164"[^>]*font-size="22"[^>]*>12%<\/text>/);
  assert.match(svg, /<text x="115" y="196"[^>]*>Low Churn Risk<\/text>/);
  assert.match(svg, /<text x="115" y="212"[^>]*>Weighted Risk Score<\/text>/);
});

test('upstream and acquisition summary headers live in HTML, not in the SVG', () => {
  const upstream = renderUpstreamGatewaySvg({
    gateways: [{ provider: 'Provider A', allocatedBandwidthMbps: 100, latencyMs: 12, jitterMs: 2, slaPercent: 99, activeSubscribers: 40, failoverRole: 'Primary Active' }],
    totalBandwidthCapacityMbps: 100, primaryGateway: 'Test Gateway',
    failoverRedundancyStatus: 'Multi-Homed Redundant', totalWholesaleCost: 60000, configuredGatewaysCount: 1
  });
  assert.equal(upstream.includes('Primary Gateway:'), false);
  assert.equal(upstream.includes('Redundancy:'), false);
  assert.match(upstream, /viewBox="0 0 560 222"/);
  const acq = renderAcquisitionRoiSvg({
    totalPortfolioAcquisitions: 20,
    channels: [{ name: 'Test Channel', totalAcquisitions: 12, paybackMonths: 2, blendedCac: 1000, netRoiPercent: 42, velocityStatus: 'Rapid Payback', color: '#0e5b4d' }],
    fastestPaybackChannel: 'Test Channel', portfolioNetRoiPercent: 42,
    totalPortfolioCac: 12000, totalPortfolioRealizedRevenue: 60000, portfolioAvgPaybackMonths: 2
  });
  assert.equal(acq.includes('Fastest Channel:'), false);
  assert.equal(acq.includes('Portfolio Net ROI:'), false);
  assert.match(acq, /viewBox="0 0 560 222"/);
});

test('method legend truncates long labels and the period reads as words', () => {
  assert.equal(truncateMethodLegendLabel('Cash at North Test Shop'), 'Cash at North Test S\u2026');
  assert.equal(truncateMethodLegendLabel('Cash'), 'Cash');
  assert.equal(methodPeriodDisplayLabel('currentMonth'), 'This Month');
  assert.equal(methodPeriodDisplayLabel('30days'), 'Last 30 Days');
  assert.equal(methodPeriodDisplayLabel('all'), 'All Time');
  const svg = renderPaymentMethodSvg({
    methods: [
      { method: 'Cash', amount: 50000, percent: 50, count: 10, avgAmount: 5000 },
      { method: 'Cash at North Test Shop', amount: 30000, percent: 30, count: 6, avgAmount: 5000 },
      { method: 'JazzCash', amount: 20000, percent: 20, count: 4, avgAmount: 5000 }
    ],
    totalCount: 20, totalAmount: 100000, cashPercent: 80, digitalPercent: 20, period: 'currentMonth'
  });
  assert.match(svg, />Cash at North Test S\u2026<\/text>/);
  assert.match(svg, /aria-label="Cash at North Test Shop:/);
  assert.match(svg, />This Month<\/text>/);
  assert.equal(svg.includes('Filter:'), false);
  assert.equal(svg.includes('currentMonth'), false);
});

test('no sub-10px in-SVG font size remains in dashboard-charts.js', () => {
  const left = dcSrc.match(/font-size="[89](?:\.5)?"/g) || [];
  assert.equal(left.length, 0, `${left.length} sub-10px sizes left`);
});

test('tab bar, summary rows, and tab mechanism are wired', () => {
  assert.match(indexSrc, /id="dashboardChartsTabBar"/);
  for (const tab of ['revenue', 'customers', 'network', 'forecast']) {
    assert.match(indexSrc, new RegExp(`data-charts-tab="${tab}"`));
  }
  for (const id of ['dashChart16Summary', 'dashChart17Summary', 'dashUpstreamPrimaryGateway', 'dashUpstreamRedundancy', 'dashAcqFastestChannel', 'dashAcqPortfolioRoi']) {
    assert.match(indexSrc, new RegExp(`id="${id}"`));
  }
  assert.match(dcSrc, /const DASHBOARD_CHARTS_TABS = \{/);
  assert.match(dcSrc, /let dashboardChartsTab = 'revenue'/);
  assert.match(dcSrc, /export function syncDashboardChartsTabs\(\)/);
  assert.match(dcSrc, /export function setupDashboardChartsTabs\(\)/);
  assert.match(dcSrc, /card\.hidden = !activeCards\.some/);
  assert.match(cssSrc, /\.dashboard-chart-card\[hidden\] \{/);
  assert.match(cssSrc, /\.chart-summary-row\[hidden\] \{/);
});

test('EN/UR parity holds at the new total with the 8 new keys', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5213);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5213);
  for (const key of ['dash_charts_tab_revenue', 'dash_charts_tab_customers', 'dash_charts_tab_network', 'dash_charts_tab_forecast', 'dash_upstream_primary_gateway', 'dash_upstream_redundancy', 'dash_acq_fastest_channel', 'dash_acq_portfolio_roi']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string');
    assert.ok(TRANSLATIONS.en[key].length > 0);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string');
    assert.ok(TRANSLATIONS.ur[key].length > 0);
  }
});
