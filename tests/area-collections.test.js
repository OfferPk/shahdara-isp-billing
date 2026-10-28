/**
 * tests/area-collections.test.js
 * Unit and integration tests for Area-Wise Collections, Mohalla Billing & Recovery Suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  calculateAreaWiseCollections,
  renderAreaCollectionsSvg,
  generateAreaCollectionsCsv,
  generateAreaCollectionsPrintHtml,
  generateAreaCollectionsBriefing,
  setupAreaCollectionsModal,
  resolveCustomerLocation,
  getAreaDescriptors
} from '../dashboard-area-collections.js';
import * as dashboardExports from '../dashboard.js';

function createSampleState() {
  return {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Muhammad Tariq',
        phone: '03001234567',
        area: 'Mohalla Charyaa',
        mohalla: 'Mohalla Charyaa',
        zone: 'Zone A',
        serviceStatus: 'active',
        packageSpeed: '15 Mbps',
        archived: false,
        bills: [
          {
            month: '2026-09',
            dueAmount: '2000',
            dueDate: '2026-09-05',
            payments: [
              { id: 'pay-1', date: '2026-09-08', amount: '2000', method: 'Cash' }
            ]
          },
          {
            month: '2026-10',
            dueAmount: '2000',
            dueDate: '2026-10-05',
            payments: [
              { id: 'pay-2', date: '2026-10-06', amount: '1800', method: 'Cash' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 102,
        name: 'Abdul Rehman',
        phone: '03217654321',
        area: 'Baradari Road',
        mohalla: 'Near Grid Station',
        zone: 'Zone B',
        serviceStatus: 'active',
        packageSpeed: '10 Mbps',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '1500',
            dueDate: '2026-10-05',
            payments: [
              { id: 'pay-3', date: '2026-10-04', amount: '1500', method: 'Easypaisa' }
            ]
          }
        ]
      },
      {
        id: 'cust-3',
        customerNumber: 103,
        name: 'Zahid Hussain',
        phone: '03339876543',
        area: 'Begum Kot',
        mohalla: '',
        zone: '',
        serviceStatus: 'offline',
        packageSpeed: '5 Mbps',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '1000',
            dueDate: '2026-10-05',
            payments: [] // Unpaid
          }
        ]
      },
      {
        id: 'cust-4',
        customerNumber: 104,
        name: 'Archived Customer',
        phone: '03000000000',
        area: 'Mohalla Charyaa',
        serviceStatus: 'active',
        archived: true,
        bills: [
          {
            month: '2026-10',
            dueAmount: '5000',
            payments: []
          }
        ]
      }
    ]
  };
}

test('resolveCustomerLocation and getAreaDescriptors - correctly normalize hierarchy', () => {
  const loc1 = resolveCustomerLocation({ area: 'Mohalla Charyaa', mohalla: 'Mohalla Charyaa', zone: 'Zone A' });
  assert.equal(loc1.area.label, 'Charyaa');
  assert.equal(loc1.separateMohalla, null);
  assert.equal(loc1.zone.label, 'Zone A');

  const desc1 = getAreaDescriptors(loc1);
  assert.equal(desc1.length, 2); // area and zone
  assert.equal(desc1[0].level, 'area');
  assert.equal(desc1[1].level, 'zone');

  const loc2 = resolveCustomerLocation({ area: 'Baradari Road', mohalla: 'Near Grid Station', zone: 'Zone B' });
  assert.notEqual(loc2.separateMohalla, null);
  const desc2 = getAreaDescriptors(loc2);
  assert.equal(desc2.length, 3); // area, mohalla, zone
  assert.equal(desc2[0].level, 'area');
  assert.equal(desc2[1].level, 'mohalla');
  assert.equal(desc2[2].level, 'zone');

  const descEmpty = getAreaDescriptors(resolveCustomerLocation({}));
  assert.equal(descEmpty[0].level, 'unassigned');
});

test('calculateAreaWiseCollections - computes accurate billed, collected, and recovery rates for month', () => {
  const state = createSampleState();
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const result = calculateAreaWiseCollections(state, { month: '2026-10', referenceDate: refDate });

  assert.equal(result.selectedMonth, '2026-10');
  assert.ok(result.rows.length >= 3);

  // Summary checks
  // Total Billed: cust-1 (2000) + cust-2 (1500) + cust-3 (1000) = 4500 (cust-4 archived, excluded)
  assert.equal(result.summary.totalBilled, 4500);
  // Total Collected: cust-1 (1800) + cust-2 (1500) + cust-3 (0) = 3300
  assert.equal(result.summary.totalCollected, 3300);
  // Overall rate: 3300 / 4500 = 73%
  assert.equal(result.summary.overallCollectionRate, 73);
  assert.equal(result.summary.totalCollectionGap, 1200);

  // Top performing area: Baradari Road (1500/1500 = 100%)
  assert.equal(result.summary.topPerformingArea, 'Baradari Road');
  assert.equal(result.summary.topPerformingRate, 100);

  // Check specific area rows
  const charyaaRow = result.rows.find(r => r.areaName === 'Charyaa' && r.level === 'area');
  assert.ok(charyaaRow);
  assert.equal(charyaaRow.billedAmount, 2000);
  assert.equal(charyaaRow.collectedAmount, 1800);
  assert.equal(charyaaRow.collectionRate, 90);
  assert.equal(charyaaRow.tier, 'optimal');

  const baradariRow = result.rows.find(r => r.areaName === 'Baradari Road' && r.level === 'area');
  assert.ok(baradariRow);
  assert.equal(baradariRow.billedAmount, 1500);
  assert.equal(baradariRow.collectedAmount, 1500);
  assert.equal(baradariRow.collectionRate, 100);
  assert.equal(baradariRow.tier, 'optimal');

  const begumKotRow = result.rows.find(r => r.areaName === 'Begum Kot' && r.level === 'area');
  assert.ok(begumKotRow);
  assert.equal(begumKotRow.billedAmount, 1000);
  assert.equal(begumKotRow.collectedAmount, 0);
  assert.equal(begumKotRow.collectionRate, 0);
  assert.equal(begumKotRow.tier, 'lagging');
});

test('calculateAreaWiseCollections - filters by level and search term', () => {
  const state = createSampleState();
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Level filter: area only
  const areaOnly = calculateAreaWiseCollections(state, {
    month: '2026-10',
    level: 'area',
    referenceDate: refDate
  });
  assert.ok(areaOnly.rows.every(r => r.level === 'area' || r.level === 'unassigned'));

  // Search filter
  const searchResult = calculateAreaWiseCollections(state, {
    month: '2026-10',
    search: 'Begum',
    referenceDate: refDate
  });
  assert.equal(searchResult.rows.length, 1);
  assert.equal(searchResult.rows[0].areaName, 'Begum Kot');
});

test('calculateAreaWiseCollections - handles empty state safely', () => {
  const emptyResult = calculateAreaWiseCollections({ customers: [] }, { month: '2026-10' });
  assert.equal(emptyResult.rows.length, 0);
  assert.equal(emptyResult.summary.totalBilled, 0);
  assert.equal(emptyResult.summary.totalCollected, 0);
  assert.equal(emptyResult.summary.overallCollectionRate, 0);
  assert.equal(emptyResult.summary.topPerformingArea, 'None');
});

test('renderAreaCollectionsSvg - generates pure vector SVG with grouped bars and legend', () => {
  const state = createSampleState();
  const data = calculateAreaWiseCollections(state, { month: '2026-10' });
  const svg = renderAreaCollectionsSvg(data, { width: 700 });

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 700'));
  assert.ok(svg.includes('linearGradient id="areaBilledGrad"'));
  assert.ok(svg.includes('linearGradient id="areaCollectedGrad"'));
  assert.ok(svg.includes('linearGradient id="areaOutstandingGrad"'));
  assert.ok(svg.includes('Charyaa'));
  assert.ok(svg.includes('Baradari Road'));
  assert.ok(svg.includes('Billed'));
  assert.ok(svg.includes('Collected'));
  assert.ok(svg.includes('Outstanding'));
});

test('generateAreaCollectionsCsv - creates RFC-4180 CSV with UTF-8 BOM', () => {
  const state = createSampleState();
  const data = calculateAreaWiseCollections(state, { month: '2026-10' });
  const csv = generateAreaCollectionsCsv(data);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Month,Area Name,Level,Parent Area,Total Subscribers'));
  assert.ok(csv.includes('Charyaa'));
  assert.ok(csv.includes('Baradari Road'));
  assert.ok(csv.includes('2000'));
});

test('generateAreaCollectionsPrintHtml - supports A4 and thermal formats', () => {
  const state = createSampleState();
  const data = calculateAreaWiseCollections(state, { month: '2026-10' });

  const a4Html = generateAreaCollectionsPrintHtml({ data, format: 'a4' });
  assert.ok(a4Html.includes('<!DOCTYPE html>'));
  assert.ok(a4Html.includes('Area-Wise Collections & Recovery Performance Manifest'));
  assert.ok(a4Html.includes('Charyaa'));
  assert.ok(a4Html.includes('Billing Desk'));

  const thermalHtml = generateAreaCollectionsPrintHtml({ data, format: 'thermal' });
  assert.ok(thermalHtml.includes('@page { size: 80mm auto; margin: 0; }'));
  assert.ok(thermalHtml.includes('AREA RECOVERY SLIP'));
  assert.ok(thermalHtml.includes('FIELD COLLECTOR RUN SHEET'));
});

test('generateAreaCollectionsBriefing - produces concise executive briefing', () => {
  const state = createSampleState();
  const data = calculateAreaWiseCollections(state, { month: '2026-10' });
  const briefing = generateAreaCollectionsBriefing(data);

  assert.ok(briefing.includes('SHAHDARA BROADBAND - AREA-WISE COLLECTIONS BRIEFING'));
  assert.ok(briefing.includes('Total Billed Revenue: PKR 4,500'));
  assert.ok(briefing.includes('Cash Collected: PKR 3,300'));
  assert.ok(briefing.includes('Overall Recovery Rate: 73%'));
  assert.ok(briefing.includes('Top Performer: Baradari Road (100% recovery)'));
});

test('setupAreaCollectionsModal - handles simulated DOM controller events', () => {
  const state = createSampleState();

  const mockElements = {
    areaCollectionsModal: {
      open: false,
      showModal: () => { mockElements.areaCollectionsModal.open = true; },
      close: () => { mockElements.areaCollectionsModal.open = false; },
      addEventListener: (evt, cb) => { mockElements._modalClickCb = cb; },
      querySelectorAll: (sel) => mockElements._sortThs || []
    },
    areaCollectionsMonthSelect: {
      value: '2026-10',
      options: [],
      replaceChildren: () => { mockElements.areaCollectionsMonthSelect.options = []; },
      appendChild: opt => mockElements.areaCollectionsMonthSelect.options.push(opt),
      addEventListener: (evt, cb) => { mockElements._monthCb = cb; }
    },
    areaCollectionsLevelSelect: {
      value: 'all',
      addEventListener: (evt, cb) => { mockElements._levelCb = cb; }
    },
    areaCollectionsSearchInput: {
      value: '',
      addEventListener: (evt, cb) => { mockElements._searchCb = cb; }
    },
    areaCollectionsKpiBilled: { textContent: '' },
    areaCollectionsKpiCollected: { textContent: '' },
    areaCollectionsKpiOutstanding: { textContent: '' },
    areaCollectionsKpiRate: { textContent: '' },
    areaCollectionsChartContainer: { innerHTML: '' },
    areaCollectionsTableBody: {
      children: [],
      replaceChildren: () => { mockElements.areaCollectionsTableBody.children = []; },
      appendChild: el => mockElements.areaCollectionsTableBody.children.push(el)
    },
    areaCollectionsEmptyState: { hidden: true },
    areaCollectionsExportCsvBtn: { addEventListener: (evt, cb) => { mockElements._csvCb = cb; } },
    areaCollectionsCopyBriefingBtn: { addEventListener: (evt, cb) => { mockElements._briefingCb = cb; } },
    areaCollectionsPrintA4Btn: { addEventListener: (evt, cb) => { mockElements._printA4Cb = cb; } },
    areaCollectionsPrintThermalBtn: { addEventListener: (evt, cb) => { mockElements._printThermalCb = cb; } },
    closeAreaCollectionsModalBtn: { addEventListener: (evt, cb) => { mockElements._closeCb = cb; } },
    closeAreaCollectionsSecondaryBtn: { addEventListener: (evt, cb) => { mockElements._closeSecCb = cb; } },
    quickActionAreaCollections: { addEventListener: (evt, cb) => { mockElements._quickActionCb = cb; } },
    openAreaCollectionsModalBtn: { addEventListener: (evt, cb) => { mockElements._openBtnCb = cb; } }
  };

  const oldDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => mockElements[id] || null,
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      innerHTML: '',
      style: {},
      addEventListener: () => {},
      querySelector: () => null
    })
  };

  try {
    let filteredArea = null;
    let toasted = null;
    const controller = setupAreaCollectionsModal(() => state, {
      onFilterCustomerArea: (name) => { filteredArea = name; },
      onToast: (msg) => { toasted = msg; }
    });

    assert.ok(controller);
    controller.open('2026-10');

    assert.equal(mockElements.areaCollectionsModal.open, true);
    assert.equal(mockElements.areaCollectionsKpiBilled.textContent, 'PKR 4,500');
    assert.equal(mockElements.areaCollectionsKpiCollected.textContent, 'PKR 3,300');
    assert.equal(mockElements.areaCollectionsKpiRate.textContent, '73%');
    assert.ok(mockElements.areaCollectionsChartContainer.innerHTML.includes('<svg'));
    assert.ok(mockElements.areaCollectionsTableBody.children.length > 0);

    // Test close
    controller.close();
    assert.equal(mockElements.areaCollectionsModal.open, false);
  } finally {
    globalThis.document = oldDoc;
  }
});

test('HTML and CSS - verify area collections modal markup and styles exist', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
  const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf-8');

  assert.ok(html.includes('id="areaCollectionsModal"'));
  assert.ok(html.includes('id="quickActionAreaCollections"'));
  assert.ok(html.includes('id="openAreaCollectionsModalBtn"'));
  assert.ok(html.includes('id="areaCollectionsMonthSelect"'));
  assert.ok(html.includes('id="areaCollectionsLevelSelect"'));
  assert.ok(html.includes('id="areaCollectionsSearchInput"'));
  assert.ok(html.includes('id="areaCollectionsKpiBilled"'));
  assert.ok(html.includes('id="areaCollectionsKpiCollected"'));
  assert.ok(html.includes('id="areaCollectionsKpiOutstanding"'));
  assert.ok(html.includes('id="areaCollectionsKpiRate"'));
  assert.ok(html.includes('id="areaCollectionsChartContainer"'));
  assert.ok(html.includes('id="areaCollectionsTableBody"'));
  assert.ok(html.includes('id="areaCollectionsExportCsvBtn"'));
  assert.ok(html.includes('id="areaCollectionsCopyBriefingBtn"'));
  assert.ok(html.includes('id="areaCollectionsPrintA4Btn"'));
  assert.ok(html.includes('id="areaCollectionsPrintThermalBtn"'));

  assert.ok(css.includes('.area-collections-modal'));
  assert.ok(css.includes('[data-theme="dark"] .area-collections-modal'));
});

test('dashboard.js - re-exports area collections suite functions', () => {
  assert.equal(typeof dashboardExports.calculateAreaWiseCollections, 'function');
  assert.equal(typeof dashboardExports.renderAreaCollectionsSvg, 'function');
  assert.equal(typeof dashboardExports.generateAreaCollectionsCsv, 'function');
  assert.equal(typeof dashboardExports.generateAreaCollectionsPrintHtml, 'function');
  assert.equal(typeof dashboardExports.generateAreaCollectionsBriefing, 'function');
  assert.equal(typeof dashboardExports.setupAreaCollectionsModal, 'function');
});
