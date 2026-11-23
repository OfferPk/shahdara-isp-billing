// Insights / Reports / Area Analytics screen polish (base d2b47aaf, S #1597 merge).
// Ported from the prep repro (which scored 17/30 on this base: Fix 1 was
// already implemented by #1604 Area Analytics, so C2a-C2c are regression
// guards here). C tests assert the FIXED state; S tests pass on base AND
// with the fix; B tests guard behaviour. Synthetic data only. No parity
// literal anywhere in this file — this is not a pinning file.
// NOTE C1/C8/C2/C4/C5 are source-assertions: the renderers they cover live
// in app.js / owner-ui.js as module-private functions, which node cannot
// import; the repo's own tests use the same source-assertion pattern for
// those internals (see area-network-6-tabs.test.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState, updateCustomerProfile, saveBillMonth, addPayment } from '../core.js';
import { buildPhase3Analytics, buildAreaSummaryCards } from '../phase3.js';
import { buildAreaBreakdowns, buildBusinessHealthScore, buildIspInsights } from '../owner-insights.js';
import { shortBarMonthLabel } from '../owner-ui.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const styles = read('styles.css');
const appJs = read('app.js');
const ownerUi = read('owner-ui.js');
const html = read('index.html');

const ref = new Date('2026-09-15T10:00:00Z');
const pkr = (value) => `PKR ${value}`;
const directBill = (month, dueAmount, payments = []) => ({ id: `bill-${month}`, month, dueAmount, status: 'pending', payments, generated: true, priceSnapshot: dueAmount, amountHistory: [] });
const cardRow = (overrides) => ({
  area: 'Area: Test Area', level: 'area', parentArea: '', depth: 0, customerCount: 2,
  activeCustomers: 2, billedRevenue: 5000, outstanding: 1000, hasBilledRevenue: true,
  hasBillHistory: true, excludedSubscriptions: 0, online: 2, onlineDenominator: 2,
  onlinePercent: 100, complaints: 0, newConnections: 0, arpu: 2500, ...overrides,
});
const flatValues = (card) => {
  const out = [];
  const walk = (value) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(card);
  return out;
};

// ---------- C1: Cash-profit Y-axis tick collision ----------
test('C1: signedOneSeriesSvg drops the negative tick when it sits within one label height of the PKR 0 tick', () => {
  // The collision, from the function's own constants: plotHeight is 168px,
  // labels are ~11px. With high=200000 and low=-2000 the low tick sits
  // |low|/span*168 = 2000/202000*168 = 1.66px below the 0 tick — the two
  // labels print on top of each other. The fix must guard the tick set;
  // the bare `const ticks=[high,0,low]` form (base) has no guard.
  const start = appJs.indexOf('function signedOneSeriesSvg');
  const end = appJs.indexOf('function categoryBarsSvg', start);
  const fn = appJs.slice(start, end);
  assert.ok(start > -1, 'signedOneSeriesSvg exists in app.js');
  const high = 200000, low = -2000, span = high - low, plotHeight = 168;
  const gapPx = (Math.abs(low) / span) * plotHeight;
  assert.ok(gapPx < 14, `fixture really collides on base (gap ${gapPx.toFixed(2)}px < 14px label height)`);
  assert.ok(!fn.includes('const ticks=[high,0,low]'), 'the tick set is guarded (low tick dropped when within one label height of 0)');
});

// ---------- C2: sticky tab-bar overlap + thick scrollbar ----------
test('C2a: the top analytics tab bar hides its horizontal scrollbar', () => {
  const rule = styles.match(/\.analytics-tab-bar\{[^}]*\}/);
  assert.ok(rule, '.analytics-tab-bar rule exists');
  assert.ok(rule[0].includes('scrollbar-width:none'), 'top bar hides its scrollbar (Firefox)');
  assert.ok(styles.includes('.analytics-tab-bar::-webkit-scrollbar'), 'top bar hides its scrollbar (WebKit)');
});

test('C2b: top-bar tab buttons never shrink below their label width', () => {
  const rule = styles.match(/\.analytics-tab-bar \.profile-tab-button\{[^}]*\}/);
  assert.ok(rule, '.analytics-tab-bar .profile-tab-button rule exists');
  assert.ok(!rule[0].includes('flex:1 1 0'), 'buttons do not shrink-to-overlap (no flex:1 1 0)');
  assert.ok(rule[0].includes('flex:0 0 auto') || rule[0].includes('flex-shrink:0'), 'buttons are shrink-0');
});

test('C2c: the lower 6-tab bar is not sticky — only one tab bar sticks', () => {
  assert.ok(
    /\.profile-tabs\.area-network-tabs\s*\{[^}]*position:\s*static/.test(styles)
    || /\.area-network-tabs\s*\{[^}]*position:\s*static/.test(styles),
    'the area-network tab bar is position:static (scoped; the profile-view .profile-tabs stays sticky)',
  );
});

// ---------- C3: overdue-trend month labels ----------
test('C3: the overdue-trend rows use compact single-line month labels', () => {
  assert.ok(ownerUi.includes("shortBarMonthLabel(row.month)"), 'trend rows use shortBarMonthLabel');
  assert.ok(!ownerUi.includes('<span>${escapeHtml(monthName(row.month))}</span>'), 'trend rows no longer use the full month name');
});

test('S1: shortBarMonthLabel already yields the compact form', () => {
  assert.equal(shortBarMonthLabel('2026-08'), "Aug '26");
  assert.equal(shortBarMonthLabel('2026-11'), "Nov '26");
});

// ---------- C4: KPI figures left-aligned ----------
test('C4: the KPI figures are explicitly left-aligned', () => {
  const rule = styles.match(/\.summary-value,\s*\.phase3-metric strong\s*\{[\s\S]*?\}/);
  assert.ok(rule, '.phase3-metric strong rule exists');
  assert.ok(rule[0].includes('text-align:left'), 'figures are left-aligned, not floating right');
});

// ---------- C5: Business Health Score clutter ----------
test('C5a: an empty factor group renders nothing (no empty Neutral section)', () => {
  assert.ok(!ownerUi.includes('No factor falls in this group'), 'the empty-group paragraph is gone');
});

test('C5b: the Window-data paragraph is tucked behind a details toggle', () => {
  const start = ownerUi.indexOf('function renderBusinessHealthScore');
  const end = ownerUi.indexOf('function renderIspInsights', start);
  const fn = ownerUi.slice(start, end);
  const hostAt = fn.indexOf('host.innerHTML=`');
  assert.ok(hostAt > -1, 'renderBusinessHealthScore writes host.innerHTML');
  const tpl = fn.slice(hostAt);
  assert.ok(tpl.indexOf('<details') > -1 && tpl.indexOf('<details') < tpl.indexOf('coverageText'),
    'a <details> opens before the Window-data (coverage) paragraph');
});

test('C5c: the What-unlocks-this paragraph lives inside the factor details', () => {
  const start = ownerUi.indexOf('const unavailableCard=');
  const end = ownerUi.indexOf('const group=', start);
  const fn = ownerUi.slice(start, end);
  assert.ok(fn.indexOf('<details>') > -1, 'unavailableCard has a details element');
  assert.ok(fn.indexOf('<details>') < fn.indexOf('business-health-next-step'),
    'the next-step paragraph sits inside the details, not above it');
});

test('S6: the Window-data text stays in the rendered UI (not deleted)', () => {
  assert.ok(ownerUi.includes('Window data:'), 'Window data: text is still rendered (tucked, not removed)');
});

// ---------- C6: Area Intelligence buttons + helper ----------
test('C6a: the Collections button is the full-width primary', () => {
  assert.ok(/id="openAreaCollectionsModalBtn" class="[^"]*primary-button/.test(html),
    'Area Collections & Recovery Suite is a primary-button');
});

test('C6b: the two secondary buttons sit in their own grid below the primary', () => {
  const between = html.slice(html.indexOf('openAreaCollectionsModalBtn'), html.indexOf('openAreaSignalModalBtn'));
  assert.ok(between.includes('<div'), 'a wrapper div opens between the primary and the secondary buttons');
});

test('C6c: the helper paragraph under the buttons is one concise line', () => {
  const m = html.match(/areaIntelligenceHeading[\s\S]*?<p class="chart-caption">([^<]*)<\/p>/);
  assert.ok(m, 'the Area Intelligence helper caption exists');
  assert.ok(m[1].length <= 120, `helper is one line (got ${m[1].length} chars)`);
  assert.ok(!m[1].includes('do not add parent and child totals'), 'the long two-sentence version is gone');
});

test('S8: the helper caption stays a literal (no new i18n key)', () => {
  const m = html.match(/areaIntelligenceHeading[\s\S]*?<p class="chart-caption"([^>]*)>/);
  assert.ok(m && !m[1].includes('data-i18n'), 'no data-i18n on the helper caption');
});

// ---------- C7: duplicate ZONE Not set cards ----------
test('C7a: an area with NO named zones gets no separate Not-set child card', () => {
  const cards = buildAreaSummaryCards([
    cardRow({}),
    cardRow({ area: 'Zone not set', level: 'zone', parentArea: 'Area: Test Area', depth: 1 }),
  ], true, pkr);
  assert.equal(cards.length, 1, 'only the roll-up card renders');
  assert.ok(!cards.some((card) => card.label === 'Not set'), 'no Not-set card');
});

test('B5: an area WITH a named zone keeps its genuine unzoned-subset child card', () => {
  const cards = buildAreaSummaryCards([
    cardRow({}),
    cardRow({ area: 'Zone: North', level: 'zone', parentArea: 'Area: Test Area', depth: 1, customerCount: 1, activeCustomers: 1, billedRevenue: 3000, outstanding: 500, arpu: 3000 }),
    cardRow({ area: 'Zone not set', level: 'zone', parentArea: 'Area: Test Area', depth: 1, customerCount: 1, activeCustomers: 1, billedRevenue: 2000, outstanding: 500, arpu: 2000 }),
  ], true, pkr);
  assert.equal(cards.length, 3, 'roll-up + named zone + unzoned subset all render');
  assert.ok(cards.some((card) => card.label === 'Not set'), 'the subset Not-set card is kept');
});

// ---------- C8: compact area cards ----------
test('C8: the area card renderer emits a chevron details section for secondary rows', () => {
  const start = appJs.indexOf('function renderAreaSummaryCardsHtml');
  const end = appJs.indexOf('function renderAreaIntelligence', start);
  const fn = appJs.slice(start, end);
  assert.ok(start > -1, 'renderAreaSummaryCardsHtml exists');
  assert.ok(fn.includes('<details'), 'cards tuck secondary rows behind a <details> chevron');
});

test('S3b: the card data still carries every figure (layout-only change)', () => {
  const [card] = buildAreaSummaryCards([cardRow({})], true, pkr);
  const values = flatValues(card);
  assert.ok(values.includes('PKR 5000'), 'billed figure present');
  assert.ok(values.includes('PKR 1000'), 'outstanding figure present');
  assert.ok(values.includes('PKR 2500'), 'ARPU figure present');
  assert.equal(card.label, 'Test Area');
  assert.equal(card.context, 'Area roll-up');
});

// ---------- C9: whole-rupee ARPU ----------
function arpuFixture() {
  let state = createInitialState(['Test One']);
  state = updateCustomerProfile(state, 'seed-001', { zone: '', mohalla: 'North', serviceStatus: 'active', monthlySellingAmount: '1873.42', packageSpeed: '15 Mbps', connectionDate: '2026-09-03' }, ref);
  state = { ...state, customers: state.customers.map((c) => (c.id === 'seed-001' ? { ...c, bills: [directBill('2026-09', 1873.42)] } : c)) };
  return buildPhase3Analytics(state, ref);
}

test('C9a: the area roll-up ARPU is a whole-rupee figure', () => {
  const report = arpuFixture();
  const area = report.areaRows.find((row) => row.level === 'area' && row.area === 'Area: North');
  assert.ok(area, 'area roll-up exists');
  assert.equal(Number(area.arpu), 1873, 'ARPU rounds to whole rupees (1873.42 -> 1873)');
  assert.equal(Number(area.arpu), Math.round(Number(area.arpu)), 'ARPU has no decimal part');
});

test('C9b: the KPI-card ARPU (current service month) is whole rupees too', () => {
  const report = arpuFixture();
  assert.equal(Number(report.currentServiceMonthArpu.arpu), 1873, 'KPI ARPU matches the rounded roll-up form');
});

test('S9: ARPU stays Not set (null) with zero active subscriptions', () => {
  const report = buildPhase3Analytics(createInitialState(['Test One']), ref);
  assert.equal(report.currentServiceMonthArpu.arpu, null);
});

// ---------- S2: Zones view already aggregates unzoned profiles ----------
test('S2: the Zones view aggregates all unzoned profiles into ONE Zone-not-recorded row', () => {
  const today = new Date('2026-10-07T12:00:00+05:00');
  let state = createInitialState(['Test One', 'Test Two']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'North' }, today);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'South' }, today);
  state = saveBillMonth(state, 'seed-001', { month: '2026-09', dueAmount: '1000', status: 'pending' }, today);
  state = saveBillMonth(state, 'seed-002', { month: '2026-09', dueAmount: '1000', status: 'pending' }, today);
  const result = buildAreaBreakdowns(state, today);
  const unzoned = result.zones.filter((row) => row.name === 'Zone not recorded');
  assert.equal(unzoned.length, 1, 'exactly one unzoned row across both areas');
  assert.equal(unzoned[0].customers, 2, 'both unzoned profiles fold into it');
});

// ---------- S3: roll-up totals already include the unzoned subset ----------
test('S3: dropping the Not-set child card cannot change totals (roll-up already includes it)', () => {
  let state = createInitialState(['Test One', 'Test Two', 'Test Three']);
  state = updateCustomerProfile(state, 'seed-001', { zone: 'Central', mohalla: 'North', serviceStatus: 'active', monthlySellingAmount: '100', packageSpeed: '10 Mbps', connectionDate: '2026-09-03' }, ref);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'North', serviceStatus: 'active', monthlySellingAmount: '200', packageSpeed: '15 Mbps' }, ref);
  state = updateCustomerProfile(state, 'seed-003', { mohalla: 'South', serviceStatus: 'not-set' }, ref);
  state = { ...state, customers: state.customers.map((c) => (c.id === 'seed-001' ? { ...c, bills: [directBill('2026-09', 100, [{ id: 'p1', date: '2026-09-10', amount: 40, method: 'Cash' }])] } : c.id === 'seed-002' ? { ...c, bills: [directBill('2026-09', 200)] } : c)) };
  const report = buildPhase3Analytics(state, ref);
  const area = report.areaRows.find((row) => row.level === 'area' && row.area === 'Area: North');
  const zone = report.areaRows.find((row) => row.level === 'zone' && row.area === 'Zone: Central');
  const notSet = report.areaRows.find((row) => row.level === 'zone' && row.area === 'Zone not set' && row.parentArea === 'Area: North');
  assert.ok(area && zone && notSet, 'roll-up, named zone and Not-set rows all exist in the table rows');
  assert.equal(Number(area.billedRevenue), Number(zone.billedRevenue) + Number(notSet.billedRevenue),
    'roll-up billed equals named-zone + unzoned-subset billed (no double-count when the child card goes)');
});

// ---------- S4: the 6-tab bar itself is untouched ----------
test('S4: the lower 6-tab bar keeps its six buttons and keys', () => {
  const bar = html.match(/<nav class="profile-tabs area-network-tabs"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(bar, 'the 6-tab bar exists');
  const btns = [...bar[1].matchAll(/data-area-network-tab-btn="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(btns, ['areas', 'zones', 'packages', 'uptime', 'pon', 'poles']);
});

// ---------- S5: Not-set fallbacks ----------
test('S5: zero-active ARPU and unset online stay Not set, never zero', () => {
  const [card] = buildAreaSummaryCards([cardRow({ activeCustomers: 0, onlinePercent: null, online: 0, onlineDenominator: 0, arpu: null })], true, pkr);
  const values = Object.fromEntries(card.metrics.map((m) => [m.label, m.value]));
  assert.equal(values['ARPU · billed / active'], 'Not set');
  assert.equal(values['Online % (n/N)'], 'Not set (0/0)');
});

// ---------- S7: export still reads the table rows ----------
test('S7: the area export still uses the table rows (unaffected by the card change)', () => {
  assert.ok(appJs.includes('generateAreaSummaryCsv(data.areaRows)'), 'export reads data.areaRows');
});

// ---------- B1/B2/B4: behaviour guards ----------
function insightsFixture() {
  const today = new Date('2026-10-07T12:00:00+05:00');
  let state = createInitialState(['Test One']);
  state = { ...state, customers: state.customers.map((c) => ({ ...c, addedOn: '2026-01-01' })) };
  state = saveBillMonth(state, 'seed-001', { month: '2026-09', dueAmount: '1000', status: 'pending' }, today);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-10', amount: '1000', method: 'Cash' }, today);
  state = saveBillMonth(state, 'seed-001', { month: '2026-10', dueAmount: '1000', status: 'pending' }, today);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-06', amount: '250', method: 'Cash' }, today);
  return { state, today };
}

test('B1: the overdue-trend VALUES are unchanged by the label shortening', () => {
  const { state, today } = insightsFixture();
  const r = buildIspInsights(state, today);
  assert.deepEqual(r.overdueTrend.map((row) => row.month), ['2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(r.overdueTrend.map((row) => row.outstanding), [0, 0, 0, 750]);
});

test('B2: the health-factor DATA is unchanged by the tuck (next steps + basis stay)', () => {
  // Bare dated state (no bills/receipts/expenses) leaves factors unavailable,
  // exactly like the existing health pin — the tuck must not touch the data.
  const today = new Date('2026-10-07T12:00:00+05:00');
  let state = createInitialState(['Test One']);
  state = { ...state, customers: state.customers.map((c) => ({ ...c, addedOn: '2026-01-01' })) };
  const result = buildBusinessHealthScore(state, today);
  assert.ok(result.unavailableFactors.length >= 1, 'unavailable factors exist');
  for (const factor of result.unavailableFactors) {
    assert.ok(factor.nextStep && factor.nextStep.startsWith('What unlocks this:'), 'next step text stays on the data');
    assert.ok(typeof factor.basis === 'string' && factor.basis.length > 0, 'basis text stays on the data');
  }
  assert.ok(result.score === null || (result.score >= 0 && result.score <= 100), 'score stays in range or null');
});

test('B4: area-network tab switching still hides/shows by tab', () => {
  assert.ok(ownerUi.includes('el.hidden = !tabs.includes(areaNetworkTab)'), 'syncAreaNetworkTabs still gates by tab');
  assert.ok(ownerUi.includes("let areaNetworkTab = 'areas'"), 'default tab stays Areas');
});
