import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  dashboardChartsTabForSection,
  setDashboardChartsTab
} from '../dashboard-charts.js';
import {
  DASHBOARD_PLACE_KEY,
  restoreDashboardPlace,
  saveDashboardPlace
} from '../dashboard-place.js';

// De-dup (user, 2026-11-22): the four Home sections below the charts region
// each live in exactly ONE charts tab — Monthly Provider Cost Breakdown,
// System Health and the data-safety banner in Network; Pending Works in
// Customers. They are single instances in index.html (not chart cards), so
// the card sync never touched them and they rendered under every tab.
// The map lives in dashboard-charts.js (DASHBOARD_CHARTS_SECTIONS); the
// sync toggles `hidden` on the four ids, and the scroll restore activates
// the saved section's home tab before opening it.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECTION_IDS = [
  'homeProviderCostDetails',
  'pendingWorksSection',
  'systemHealthSection',
  'dataSafetyBanner'
];

// A small stand-in for the page the tab sync reads: the charts grid (no
// cards), the four tab buttons, and the four sections as plain objects
// with a `hidden` flag.
function fakeSyncDoc() {
  const sections = {};
  for (const id of SECTION_IDS) sections[id] = { id, hidden: false };
  const buttons = ['revenue', 'customers', 'network', 'forecast'].map((tab) => ({
    dataset: { chartsTab: tab },
    classList: { toggle: () => {} },
    setAttribute: () => {}
  }));
  const grid = { querySelectorAll: () => [] };
  return {
    sections,
    buttons,
    querySelector: (selector) => (selector === '.dashboard-charts-grid' ? grid : null),
    querySelectorAll: (selector) => (
      selector === '#dashboardChartsTabBar .dashboard-charts-tab-button' ? buttons : []
    ),
    getElementById: (id) => sections[id] ?? null
  };
}

function visibleSections(doc) {
  return SECTION_IDS.filter((id) => doc.sections[id].hidden === false);
}

// The sync reads the global `document`, so each sync test installs the
// fake doc and restores whatever was there before.
function withFakeDoc(doc, fn) {
  const originalDoc = globalThis.document;
  globalThis.document = doc;
  try {
    return fn();
  } finally {
    globalThis.document = originalDoc;
  }
}

// A small in-memory stand-in for the record store (same shape as the
// plan485 tests: the module takes storage in, so the tests never touch
// the real one).
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

test('provider cost, system health and banner live in Network', () => {
  assert.equal(dashboardChartsTabForSection('homeProviderCostDetails'), 'network');
  assert.equal(dashboardChartsTabForSection('systemHealthSection'), 'network');
  assert.equal(dashboardChartsTabForSection('dataSafetyBanner'), 'network');
});

test('pending works lives in Customers', () => {
  assert.equal(dashboardChartsTabForSection('pendingWorksSection'), 'customers');
});

test('unknown section ids map to no tab', () => {
  assert.equal(dashboardChartsTabForSection('homeChartsCollapsible'), null);
  assert.equal(dashboardChartsTabForSection('billingDashboard'), null);
  assert.equal(dashboardChartsTabForSection('no-such-section'), null);
});

test('Network tab shows only its three sections', () => {
  const doc = fakeSyncDoc();
  withFakeDoc(doc, () => setDashboardChartsTab('network'));
  assert.deepEqual(visibleSections(doc), ['homeProviderCostDetails', 'systemHealthSection', 'dataSafetyBanner']);
});

test('Customers tab shows only Pending Works', () => {
  const doc = fakeSyncDoc();
  withFakeDoc(doc, () => setDashboardChartsTab('customers'));
  assert.deepEqual(visibleSections(doc), ['pendingWorksSection']);
});

test('Revenue tab hides all four sections', () => {
  const doc = fakeSyncDoc();
  withFakeDoc(doc, () => setDashboardChartsTab('revenue'));
  assert.deepEqual(visibleSections(doc), []);
});

test('Forecast tab hides all four sections', () => {
  const doc = fakeSyncDoc();
  withFakeDoc(doc, () => setDashboardChartsTab('forecast'));
  assert.deepEqual(visibleSections(doc), []);
});

test('unknown tab names are ignored', () => {
  const doc = fakeSyncDoc();
  withFakeDoc(doc, () => {
    setDashboardChartsTab('network');
    setDashboardChartsTab('no-such-tab');
  });
  assert.deepEqual(visibleSections(doc), ['homeProviderCostDetails', 'systemHealthSection', 'dataSafetyBanner']);
});

test('restore activates the home tab before opening the saved section', () => {
  const doc = fakeSyncDoc();
  const order = [];
  // The saved section starts hidden (Revenue active) and records when its
  // `open` flag is set, so the test can prove activation ran first.
  const providerSection = doc.sections.homeProviderCostDetails;
  let providerOpen = false;
  Object.defineProperty(providerSection, 'open', {
    get: () => providerOpen,
    set: (value) => { order.push('open'); providerOpen = value; }
  });
  const storage = fakeStorage();
  saveDashboardPlace(storage, { scrollY: 500, openSectionId: 'homeProviderCostDetails' });
  const scrollCalls = [];
  const viewport = { scrollTo: (x, y) => { scrollCalls.push([x, y]); } };
  // The callback mirrors the app.js wiring: look the id up, set its tab.
  const activateSectionTab = (sectionId) => {
    order.push(`activate:${sectionId}`);
    const homeTab = dashboardChartsTabForSection(sectionId);
    if (homeTab) setDashboardChartsTab(homeTab);
  };
  withFakeDoc(doc, () => {
    setDashboardChartsTab('revenue');
    assert.equal(providerSection.hidden, true);
    const restored = restoreDashboardPlace(doc, viewport, storage, activateSectionTab);
    assert.deepEqual(restored, { scrollY: 500, openSectionId: 'homeProviderCostDetails' });
  });
  assert.deepEqual(order, ['activate:homeProviderCostDetails', 'open']);
  assert.equal(providerSection.hidden, false);
  assert.equal(providerSection.open, true);
  assert.deepEqual(scrollCalls, [[0, 500]]);
});

test('restore with a non-section id activates no tab', () => {
  const doc = fakeSyncDoc();
  const activated = [];
  const collapsible = { id: 'homeChartsCollapsible', open: false };
  doc.getElementById = (id) => (id === 'homeChartsCollapsible' ? collapsible : doc.sections[id] ?? null);
  const storage = fakeStorage();
  saveDashboardPlace(storage, { scrollY: 100, openSectionId: 'homeChartsCollapsible' });
  const scrollCalls = [];
  const viewport = { scrollTo: (x, y) => { scrollCalls.push([x, y]); } };
  const activateSectionTab = (sectionId) => {
    const homeTab = dashboardChartsTabForSection(sectionId);
    if (homeTab) {
      activated.push(homeTab);
      setDashboardChartsTab(homeTab);
    }
  };
  withFakeDoc(doc, () => {
    setDashboardChartsTab('network');
    restoreDashboardPlace(doc, viewport, storage, activateSectionTab);
  });
  assert.deepEqual(activated, []);
  assert.equal(collapsible.open, true);
  assert.deepEqual(scrollCalls, [[0, 100]]);
  // The Network visibility from before the restore stands untouched.
  assert.deepEqual(visibleSections(doc), ['homeProviderCostDetails', 'systemHealthSection', 'dataSafetyBanner']);
});

test('scoped [hidden] rules hide the three flex sections', () => {
  const css = readFileSync(join(repoRoot, 'dashboard.css'), 'utf8');
  const rule = css.match(/#pendingWorksSection\[hidden\],\s*#systemHealthSection\[hidden\],\s*#dataSafetyBanner\[hidden\] \{\s*display: none !important;\s*\}/);
  assert.ok(rule, 'dashboard.css must carry one scoped [hidden] rule for the three flex sections');
});

test('the four sections keep their DOM positions and the banner stays last', () => {
  const html = readFileSync(join(repoRoot, 'index.html'), 'utf8');
  const lines = html.split('\n');
  const lineOf = (id) => lines.findIndex((line) => line.includes(`id="${id}"`));
  // The grid range, computed the same way the repro does: the sections
  // must stay OUTSIDE .dashboard-charts-grid (no markup move).
  const gridOpen = lines.findIndex((line) => line.includes('class="dashboard-charts-grid"'));
  const regionClose = lines.findIndex((line, i) => i > gridOpen && line.trim() === '</section>');
  for (const id of SECTION_IDS) {
    const occurrences = html.split(`id="${id}"`).length - 1;
    assert.equal(occurrences, 1, `${id} must occur exactly once in index.html`);
    const line = lineOf(id);
    assert.ok(line > -1, `${id} must exist in index.html`);
    assert.ok(line < gridOpen || line > regionClose, `${id} must stay outside .dashboard-charts-grid`);
  }
  assert.ok(lineOf('homeProviderCostDetails') < lineOf('pendingWorksSection'), 'provider cost stays before pending works');
  assert.ok(lineOf('pendingWorksSection') < lineOf('systemHealthSection'), 'pending works stays before system health');
  assert.ok(lineOf('systemHealthSection') < lineOf('dataSafetyBanner'), 'banner stays last of the four');
});
