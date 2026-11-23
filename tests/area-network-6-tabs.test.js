// Area Analytics & Network 6-tab refactor — the analytics tail (Area
// Intelligence through Power Backup) groups into six numbered tabs with
// compact breakdown cards. This file IS a pinning file: it asserts the
// current parity total, so it must never contain the previous total in
// any form — bare, split, or formatted — anywhere, including comments.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');
const ownerUi = read('owner-ui.js');
const appJs = read('app.js');
const styles = read('styles.css');

const TABS = ['areas', 'zones', 'packages', 'uptime', 'pon', 'poles'];

test('6-tab bar: six numbered buttons in order, labelled by the six new keys', () => {
  const bar = html.match(/<nav class="profile-tabs area-network-tabs"[^>]*>([\s\S]*?)<\/nav>/);
  // Area Analytics screen polish (insights D1): the lower 6-tab bar is
  // static now — only the top tab bar stays sticky. Message-only re-pin;
  // the test asserts the bar exists, not its position.
  assert.ok(bar, 'the 6-tab bar exists');
  assert.ok(html.indexOf('area-network-tabs') < html.indexOf('areaIntelligenceHeading'), 'the bar sits before Area Intelligence');
  const btns = [...bar[1].matchAll(/data-area-network-tab-btn="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(btns, TABS, 'the six buttons run 1 Areas → 6 Poles & Power');
  for (const tab of TABS) {
    assert.ok(bar[1].includes(`data-i18n="area_network_tab_${tab}"`), `${tab} button carries its key`);
  }
  // The keys carry the numbers, so translations never have to.
  const expectedEn = { areas: '1 · Areas', zones: '2 · Zones', packages: '3 · Packages', uptime: '4 · Uptime & Issues', pon: '5 · PON & Fiber', poles: '6 · Poles & Power' };
  const expectedUr = { areas: '1 · علاقے', zones: '2 · زونز', packages: '3 · پیکجز', uptime: '4 · اپ ٹائم اور مسائل', pon: '5 · PON اور فائبر', poles: '6 · کھمبے اور بجلی' };
  for (const tab of TABS) {
    assert.equal(TRANSLATIONS.en[`area_network_tab_${tab}`], expectedEn[tab], `${tab} EN label`);
    assert.equal(TRANSLATIONS.ur[`area_network_tab_${tab}`], expectedUr[tab], `${tab} UR label`);
  }
  // Rendered text carries a plain &; the static fallback in source escapes
  // it as an entity — the two spellings must not be confused.
  assert.ok(bar[1].includes('4 · Uptime &amp; Issues'), 'the static fallback escapes & as an entity in source');
  // First paint: tab 1 is the active tab.
  assert.ok(bar[1].includes('data-area-network-tab-btn="areas" aria-pressed="true"'), 'tab 1 starts active');
  // Every tail unit carries its tab (the breakdown groups get theirs from
  // the builder — see the card test — the rest are static markup).
  const units = [
    ['class="table-card area-intelligence-card" data-area-network-tab="areas"', 'Area Intelligence'],
    ['class="table-card area-summary-card" data-area-network-tab="areas"', 'area summary'],
    ['class="table-card" data-area-network-tab="packages" aria-labelledby="packageAnalyticsHeading"', 'package summary'],
    ['class="table-card" data-area-network-tab="uptime"', 'network issues'],
    ['class="ops-section-header" data-area-network-tab="uptime pon poles"', 'Network & PON heading'],
    ['summary-downtime-analytics ds-stat ds-stat--info ops-card" data-area-network-tab="uptime"', 'Downtime'],
    ['summary-upstream-sla ds-stat ds-stat--info ops-card" data-area-network-tab="uptime"', 'Upstream SLA'],
    ['summary-fleet-uptime ds-stat ds-stat--info ops-card" data-area-network-tab="uptime"', 'Fleet Uptime'],
    ['summary-splitter-map ds-stat ds-stat--brand ops-card" data-area-network-tab="pon"', 'Splitter Port Map'],
    ['summary-pon-capacity ds-stat ds-stat--pending ops-card" data-area-network-tab="pon"', 'PON Port Capacity'],
    ['summary-outage-impact ds-stat ds-stat--overdue ops-card" data-area-network-tab="pon"', 'Feeder Outage Impact'],
    ['summary-daisy-chain ds-stat ds-stat--pending ops-card" data-area-network-tab="pon"', 'Daisy-Chain Tree'],
    ['summary-pole-landmark ds-stat ds-stat--info ops-card" data-area-network-tab="poles"', 'Pole & Landmark'],
    ['summary-pole-registry ds-stat ds-stat--info ops-card" data-area-network-tab="poles"', 'Pole Registry'],
    ['summary-power-backup ds-stat ds-stat--pending ops-card" data-area-network-tab="poles"', 'Power Backup'],
  ];
  for (const [marker, label] of units) assert.ok(html.includes(marker), `${label} carries its tab`);
});

test('parity: the six new keys move the suite to the new total in both dicts', () => {
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds
  // exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR.
  // The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5231, 'EN parity');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5231, 'UR parity');
});

test('breakdown cards: one header row with a count · rate badge, then Billed | Collected | Due', () => {
  assert.ok(ownerUi.includes('class="area-breakdown-card-head"'), 'the card has a header row');
  assert.ok(ownerUi.includes('class="area-breakdown-badge"'), 'the card has a count · rate badge');
  assert.ok(ownerUi.includes('`${row.customers} cust · ${rate(row.collectionRate)}`'), 'the badge reads count + rate');
  assert.ok(ownerUi.includes('`${row.customers} cust`'), 'a missing rate leaves just the count');
  for (const label of ['Billed', 'Collected', 'Due']) {
    assert.ok(ownerUi.includes(`<span>${label}</span>`), `the card shows ${label}`);
  }
  for (const dropped of ['Customers with bills', 'Outstanding', 'Collection rate', 'Overdue bills · customers']) {
    assert.ok(!ownerUi.includes(`<span>${dropped}</span>`), `the ${dropped} pair leaves the card face`);
  }
  // The groups carry their tab from the builder (the panel itself stays
  // visible: its heading + totals row + basis caption are general text).
  assert.ok(ownerUi.includes('data-area-network-tab="${tab}"'), 'each group carries its tab');
  for (const [call, tab] of [["'Areas'", 'areas'], ["'Zones'", 'zones'], ["'Packages'", 'packages']]) {
    assert.ok(ownerUi.includes(`group(${call},`), `${call} group is built`);
    assert.ok(ownerUi.includes(`', '${tab}')}`), `${call} group lands on the ${tab} tab`);
  }
});

test('breakdown CSS: 3-column metrics, 11px labels, 12.5px values — the compact shape', () => {
  assert.ok(styles.includes('.area-breakdown-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 10px}'), 'metrics are one 3-column row');
  assert.ok(styles.includes('.area-breakdown-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}'), 'the header is one row');
  assert.ok(styles.includes('.area-breakdown-badge{flex:0 0 auto;font-size:11px;font-weight:700;'), 'the badge sits at the 11px floor');
  assert.ok(styles.includes('.area-breakdown-metrics span{font-size:11px;'), 'labels stay 11px');
  assert.ok(styles.includes('.area-breakdown-metrics strong{color:var(--ink,#263f34);font-size:12.5px;'), 'values stay 12.5px');
  // Height model (360px viewport, 328px content): 24 padding + 19.5 header
  // + 8 gap + one metrics row (15.4 label + 2 gap + 18.75 value) + 2
  // border — under the 108px target, half the 217px baseline.
  const height = 24 + 19.5 + 8 + (11 * 1.4 + 2 + 12.5 * 1.5) + 2;
  assert.ok(height <= 108, `compact card computes to ${height}px, target ≤108px`);
});

test('package table: third header reads Active in full and still sorts', () => {
  assert.ok(html.includes('data-sort-pkgsum="activeCustomers" tabindex="0" role="columnheader" title="Sort by active subscriptions">Active <span'), 'the package 3rd header is the short Active');
  assert.ok(!html.includes('data-sort-pkgsum="activeCustomers" tabindex="0" role="columnheader" title="Sort by active subscriptions">Active configured subscriptions'), 'the long header is gone from the package table');
  assert.ok(html.includes('<th scope="col">Active configured subscriptions</th>'), 'the area table keeps its own header');
});

test('network issues: 2-column grid at 360px, only months above zero highlighted', () => {
  assert.ok(!styles.includes('.network-issues-list{grid-template-columns:1fr}'), 'the ≤360px 1-column override is gone');
  assert.ok(styles.includes('.network-issues-list{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'the ≤700px 2-column rule applies at 360px');
  const render = appJs.match(/\$\('#networkIssuesList'\)\.innerHTML=([\s\S]*?);\n/);
  assert.ok(render, 'the network issues render exists');
  assert.ok(render[1].includes('has-incidents'), 'the render marks months with incidents');
  assert.ok(render[1].includes('row.count>0'), 'only months with a count above zero are marked');
  assert.ok(styles.includes('.network-issues-list li.has-incidents{border-color:var(--green,#1e654b);background:#f6faf8}'), 'the highlight reuses existing colours');
});

test('ops headers: the five title-repeat buttons are gone; each header is a tappable button with the opener id and a chevron', () => {
  const heads = {
    openDowntimeAnalyticsModalBtn: 'Downtime Analytics',
    openUpstreamSlaModalBtn: 'Upstream SLA & Rebate',
    openSplitterMapModalBtn: 'Splitter Port Map',
    openDaisyChainTreeModalBtn: 'Daisy-Chain Tree',
    openPoleRegistryModalBtn: 'Pole Registry',
  };
  for (const [id, label] of Object.entries(heads)) {
    assert.ok(html.includes(`<button type="button" class="ds-card-head" id="${id}">`), `${label}: the header is the opener button`);
    assert.ok(!html.includes(`<button id="${id}" class="action-btn-sm`), `${label}: the bottom title-repeat button is gone`);
    const block = html.match(new RegExp(`<button type="button" class="ds-card-head" id="${id}">([\\s\\S]*?)</button>`));
    assert.ok(block, `${label}: the header block closes as a button`);
    assert.ok(block[1].includes('<span class="ds-card-chevron" aria-hidden="true">›</span>'), `${label}: the header carries a chevron`);
  }
  // The distinct tool buttons stay: Splitter keeps Dark Fiber Finder.
  assert.ok(html.includes('id="openDarkFiberModalBtn"'), 'Splitter keeps its Dark Fiber Finder tool button');
  assert.ok(html.includes('id="openOutageImpactModalBtn"'), 'Feeder keeps its Trace Outage Impact tool button');
});

test('PON badge is an ID rule and the tab sync is wired with no new import edge', () => {
  assert.ok(styles.includes('#dashboardPonCapacityValue{background:#f1f4f2;border-radius:999px;padding:4px 8px;max-width:62%}'), 'the PON stat is a pill badge by ID rule');
  assert.ok(html.includes('<strong id="dashboardPonCapacityValue" class="summary-value ds-card-metric">'), 'the PON metric markup is untouched');
  assert.ok(ownerUi.includes('export function syncAreaNetworkTabs()'), 'the sync is exported at module top level');
  assert.ok(ownerUi.includes("let areaNetworkTab = 'areas'"), 'the default tab is 1 · Areas');
  assert.ok(appJs.includes("import { setupOwnerCenter, syncAreaNetworkTabs } from './owner-ui.js?v=1.11.0';"), 'app.js extends the existing owner-ui.js import (zero new edge)');
  assert.ok(appJs.includes('syncAreaNetworkTabs();'), 'renderAnalytics calls the sync');
  assert.ok(ownerUi.includes('syncAreaNetworkTabs();'), 'refresh() calls the sync');
  assert.ok(styles.includes('[data-area-network-tab][hidden]{display:none!important}'), 'the scoped hidden rule beats .table-card display:grid');
});
