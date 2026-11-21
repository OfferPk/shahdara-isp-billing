import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';

// Telemetry Lab: the 46 simulated telecom diagnostics move out of the Home
// tab into More -> Network Diagnostics Lab, and the seven named SVG
// collisions + the Delinquency/Fiber top bars + the three broken '?' icons
// are fixed. This file IS a pinning file: it asserts the NEW parity total
// (the Lab tab label is the one new key). Fixtures are generic only — no
// real customer, place or amount from any screenshot appears here.
//
// NOW-vs-LATER: the Area-Analytics 4-tab outer bar does not exist yet, so
// the Lab ships as a collapsed <details> panel at the top of #analyticsView;
// the 4-tab item adopts this panel mechanically as Tab 5 (the id + the
// .diagnostics-lab-region class are the stable anchors).

const TELECOM46 = [
  'dashboardOtdrChart', 'dashboardSolarChart', 'dashboardAerialChart',
  'dashboardMicrowaveChart', 'dashboardSpliceChart', 'dashboardJettingChart',
  'dashboardPonDbaChart', 'dashboardSplicerChart', 'dashboardBgpChart',
  'dashboardIptvChart', 'dashboardDnsChart', 'dashboardDwdmChart',
  'dashboardOscChart', 'dashboardQinqChart', 'dashboardSyncEChart',
  'dashboardRoadmChart', 'dashboardMicroOtdrChart', 'dashboardMclagChart',
  'dashboardFlowspecChart', 'dashboardRamanChart', 'dashboardSrMplsChart',
  'dashboardPmdChart', 'dashboardEvpnChart', 'dashboardKerrChart',
  'dashboardMplsTeChart', 'dashboardMefEthernetChart', 'dashboardErpsChart',
  'dashboardY1731Chart', 'dashboardPseudowireChart', 'dashboardBfdChart',
  'dashboardVplsChart', 'dashboardBotdaChart', 'dashboardCgnatChart',
  'dashboardOltChassisChart', 'dashboardSrv6Chart', 'dashboardFlexAlgoChart',
  'dashboardOpticalEvmChart', 'dashboardOtnChart', 'dashboardMplsTpChart',
  'dashboardL3VpnChart', 'dashboardEdfaCascadeChart', 'dashboardPtpTbcChart',
  'dashboardRpkiChart', 'dashboardPolarizationChart', 'dashboardRocev2Chart',
  'dashboardOlpChart',
];
const ANALYTICS21 = [
  'dashboardTrendChart', 'dashboardStatusChart', 'dashboardAreaChart',
  'dashboardPackageChart', 'dashboardHealthChart', 'dashboardMethodsChart',
  'dashboardChurnChart', 'dashboardHeatmapChart', 'dashboardSeasonalChart',
  'dashboardPackageMarginChart', 'dashboardLtvChart', 'dashboardIncidentChart',
  'dashboardProjectionChart', 'dashboardUpstreamChart',
  'dashboardAcquisitionChart', 'dashboardShapingChart', 'dashboardFiberChart',
  'dashboardDelinquencyChart', 'dashboardCpeChart', 'dashboardPowerChart',
  'dashboardRouteDensityChart',
];

function read(rel) {
  return readFileSync(new URL(rel, import.meta.url), 'utf-8');
}

function homeChartsRegion(html) {
  const start = html.indexOf('id="homeChartsCollapsible"');
  const end = html.indexOf('</details>', start);
  return html.slice(start, end);
}

test('Lab: all 46 telecom cards live in the Lab, none left on Home', () => {
  const html = read('../index.html');
  const home = homeChartsRegion(html);
  for (const id of TELECOM46) assert(!home.includes(`id="${id}"`), `${id} still on Home`);
  const labAt = html.indexOf('id="diagnosticsLabCollapsible"');
  assert(labAt > -1, 'Lab details missing');
  const labEnd = html.indexOf('</details>', labAt);
  const lab = html.slice(labAt, labEnd);
  for (const id of TELECOM46) assert(lab.includes(`id="${id}"`), `${id} missing from Lab`);
  for (const id of ANALYTICS21) assert(home.includes(`id="${id}"`), `${id} left Home`);
});

test('Lab: collapsed by default, first child of #analyticsView', () => {
  const html = read('../index.html');
  const viewAt = html.indexOf('<section id="analyticsView"');
  const labAt = html.indexOf('id="diagnosticsLabCollapsible"');
  assert(labAt - viewAt < 200, 'Lab is not the first child of #analyticsView');
  const labTag = html.slice(labAt - 10, html.indexOf('>', labAt) + 1);
  assert(!labTag.includes(' open'), 'Lab must ship collapsed by default');
  assert(html.includes('id="diagnosticsLabSummary"'), 'Lab summary id missing');
});

test('Lab: More menu + router + the one new key', () => {
  const html = read('../index.html');
  assert(html.includes('data-mobile-more="diagnostics-lab"'), 'menu entry missing');
  const router = read('../screen-router.js');
  assert(router.includes("'diagnostics-lab': { view: 'analyticsView'"), 'router entry missing');
  assert(router.includes("anchor: '#diagnosticsLabCollapsible'"), 'router anchor missing');
  // The router entry MUST carry a header action with a selector target
  // (app-shell pins every screen to one); the action focuses the Lab
  // summary, which the generic loop opens before scrolling.
  assert(router.includes("action: { label: 'Open Lab', focus: '#diagnosticsLabSummary' }"), 'router action missing');
  assert(router.includes("'diagnostics-lab': 'analyticsView'"), 'SCREEN_VIEW entry missing');
  assert(router.includes("spec.view === 'analyticsView' ? 'showAnalyticsButton'"), 'ensureViewVisible fallback missing');
  assert.equal(TRANSLATIONS.en.analytics_tab_lab, 'Network Diagnostics Lab');
  assert.equal(TRANSLATIONS.ur.analytics_tab_lab, 'نیٹ ورک ڈائیگناسٹکس لیب');
});

test('Lab: parity is the NEW total (this file is the pin)', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5221);
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5221);
});

test('Lab: no in-SVG headers left on the seven fixed cards', () => {
  const splicer = read('../dashboard-splicer.js');
  assert(!splicer.includes("selectedUnit.name.split('(')[0].trim()}</text>"), 'splicer header still in SVG');
  assert(splicer.includes('chart-top-bar'), 'splicer top bar missing');
  const dba = read('../dashboard-pon-dba.js');
  assert(!dba.includes('${selectedPort.name}</text>'), 'pon-dba header still in SVG');
  assert(dba.includes('chart-top-bar'), 'pon-dba top bar missing');
  const dwdm = read('../dashboard-dwdm.js');
  assert(!dwdm.includes("${b.healthTier} (${ch.primaryArea})</text>"), 'dwdm pill still in SVG');
  assert(dwdm.includes('chart-top-bar'), 'dwdm top bar missing');
  const iptv = read('../dashboard-iptv.js');
  assert(!iptv.includes('CONCURRENT VIEWERS</text>'), 'iptv strip still in SVG');
  assert(iptv.includes('chart-metric-strip'), 'iptv strip missing');
  const bgp = read('../dashboard-bgp.js');
  // The truncation expression itself moved into the HTML top bar, where it
  // legitimately lives on, and the class string is kept by the two
  // detailed-modal headings — so scope to the compact title's SVG
  // coordinates: x="32" y="26" is unique to the removed compact <text>;
  // the modal headings use x="0" y="14".
  assert(!bgp.includes('<text x="32" y="26" class="bgp-text bgp-title">'), 'bgp compact title still in SVG');
  assert(bgp.includes('chart-top-bar'), 'bgp top bar missing');
  const otdr = read('../dashboard-otdr.js');
  assert(!otdr.includes('<text x="${leftPad}" y="22"'), 'otdr title still in SVG');
  assert(otdr.includes('chart-top-bar'), 'otdr top bar missing');
  const solar = read('../dashboard-solar.js');
  assert(!solar.includes('<text x="${leftPad}" y="22"'), 'solar title still in SVG');
  assert(solar.includes('chart-top-bar'), 'solar top bar missing');
});

test('Lab: Delinquency + Fiber titles moved to HTML top bars too', () => {
  const charts = read('../dashboard-charts.js');
  assert(charts.includes('chart-top-bar'), 'dashboard-charts top bar missing');
  // Each title appears exactly once — in the HTML bar, not as an SVG <text>.
  assert.equal(charts.split('Markaz-e-Taqseem-e-Fiber (FDH)').length - 1, 1, 'Fiber title must live only in its top bar');
  assert.equal(charts.split('Khata Wusooli &amp; Aging Pipeline').length - 1, 1, 'Delinquency title must live only in its top bar');
  assert(!charts.includes('Markaz-e-Taqseem-e-Fiber (FDH)\n      </text>'), 'Fiber title still an SVG text');
  assert(!charts.includes('Khata Wusooli &amp; Aging Pipeline\n      </text>'), 'Delinquency title still an SVG text');
});

test('Lab: the three broken question marks are gone', () => {
  const splice = read('../dashboard-splice.js');
  assert(!splice.includes("'? Radius Compliant'"), 'splice compliant ? remains');
  assert(!splice.includes('(? Loss)'), 'splice (? Loss) remains');
  assert(splice.includes('dB Loss'), 'splice dB Loss missing');
  const jetting = read('../dashboard-jetting.js');
  assert(!jetting.includes('`? Complete Penetration'), 'jetting complete ? remains');
  assert(!jetting.includes('`? Undershoot'), 'jetting undershoot ? remains');
});

test('Lab: lazy trigger points at the Lab, queue moved to app.js, dead cards stay dead', () => {
  const lazy = read('../lazy-telecom.js');
  assert(lazy.includes("'.diagnostics-lab-region'"), 'lazy trigger still watches Home');
  const charts = read('../dashboard-charts.js');
  assert(!charts.includes('queueTelecomCharts('), 'dashboard still queues telecom');
  const app = read('../app.js');
  assert(app.includes("import { queueTelecomCharts } from './lazy-telecom.js';"), 'app.js queue import missing');
  assert(app.includes("queueTelecomCharts(state, new Date(), {"), 'app.js queue call missing');
  assert(app.includes("labSection.addEventListener('toggle'"), 'app.js Lab toggle wiring missing');
  const dash = read('../dashboard.js');
  assert(!dash.includes('renderErpsDiagramSvg('), 'erps wired (out of scope)');
  assert(!dash.includes('renderBotdaDiagramSvg('), 'botda wired (out of scope)');
  assert(!dash.includes('renderFlexAlgoDiagramSvg('), 'flex-algo wired (out of scope)');
});
