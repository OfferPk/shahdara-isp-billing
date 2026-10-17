/**
 * tests/package-revenue.test.js
 * Unit and integration tests for Package Revenue Mix, Donut Visualization & Portfolio ARPU Suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  calculatePackageRevenueMix,
  renderPackageRevenueDonutSvg,
  generatePackageRevenueCsv,
  generatePackageRevenuePrintHtml,
  generatePackageRevenueBriefing,
  setupPackageRevenueModal,
  resolvePackageForCustomer,
  resolvePackageForBill,
  describeDonutArc
} from '../dashboard-package-revenue.js';
import * as dashboardExports from '../dashboard.js';

function createSampleState() {
  return {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Tariq Mehmood',
        phone: '03001234567',
        serviceStatus: 'active',
        packageSpeed: '15 Mbps Unlimited',
        monthlySellingAmount: 3000,
        connectionDate: '2026-01-10',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '3000',
            dueDate: '2026-10-05',
            packageSnapshot: {
              packageId: '15mbps-unlimited',
              label: '15Mbps Unlimited',
              nominalPrice: 3000,
              speedMbps: 15,
              packageType: 'Unlimited',
              dataLimit: ''
            },
            payments: [
              { id: 'p-1', date: '2026-10-06', amount: '3000', method: 'Cash' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 102,
        name: 'Rashid Ali',
        phone: '03217654321',
        serviceStatus: 'active',
        packageSpeed: '5 Mbps',
        monthlySellingAmount: 1500,
        connectionDate: '2026-02-15',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '1500',
            dueDate: '2026-10-05',
            packageSpeed: '5 Mbps',
            payments: [
              { id: 'p-2', date: '2026-10-08', amount: '1000', method: 'Easypaisa' }
            ]
          }
        ]
      },
      {
        id: 'cust-3',
        customerNumber: 103,
        name: 'Hassan Raza',
        phone: '03339876543',
        serviceStatus: 'active',
        packageSpeed: '5 Mbps',
        monthlySellingAmount: 1500,
        connectionDate: '2026-03-01',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '1500',
            dueDate: '2026-10-05',
            packageSpeed: '5 Mbps',
            payments: []
          }
        ]
      },
      {
        id: 'cust-4',
        customerNumber: 104,
        name: 'Zahid Khan',
        phone: '03451122334',
        serviceStatus: 'offline',
        packageSpeed: '3Mbps / 100GB',
        monthlySellingAmount: 1000,
        connectionDate: '2026-04-12',
        archived: false,
        bills: [
          {
            month: '2026-10',
            dueAmount: '1000',
            dueDate: '2026-10-05',
            payments: [
              { id: 'p-3', date: '2026-10-04', amount: '1000', method: 'Cash' }
            ]
          }
        ]
      },
      {
        id: 'cust-5',
        customerNumber: 105,
        name: 'Unassigned Account',
        phone: '03009988776',
        serviceStatus: 'not-set',
        packageSpeed: '',
        archived: false,
        bills: []
      }
    ]
  };
}

test('resolvePackageForCustomer & resolvePackageForBill normalize catalog and custom plans', () => {
  const p1 = resolvePackageForCustomer({ packageSpeed: '15Mbps Unlimited' });
  assert.equal(p1.key, '15mbps-unlimited');
  assert.equal(p1.label, '15Mbps Unlimited');
  assert.equal(p1.nominalPrice, 3000);

  const p2 = resolvePackageForCustomer({ packageSpeed: '5 Mbps' });
  assert.equal(p2.key, '5mbps');
  assert.equal(p2.label, '5 Mbps');

  const p3 = resolvePackageForCustomer({ packageSpeed: '' });
  assert.equal(p3.key, '__package_not_set__');
  assert.equal(p3.label, 'Package not set');

  const billSnap = {
    packageSnapshot: {
      packageId: '3mbps-100gb',
      label: '3Mbps / 100GB',
      nominalPrice: 1000,
      speedMbps: 3,
      packageType: 'Limited',
      dataLimit: '100 GB'
    }
  };
  const billPkg = resolvePackageForBill({ id: 'c1' }, billSnap, '2026-10');
  assert.equal(billPkg.key, '3mbps-100gb');
  assert.equal(billPkg.label, '3Mbps / 100GB');
  assert.equal(billPkg.nominalPrice, 1000);
});

test('calculatePackageRevenueMix computes accurate billed, collected, ARPU, and shares', () => {
  const state = createSampleState();
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const result = calculatePackageRevenueMix(state, {
    month: '2026-10',
    referenceDate: refDate
  });

  assert.equal(result.selectedMonth, '2026-10');
  assert.ok(result.summary);

  // Total Billed: 3000 (15M) + 1500 (5M) + 1500 (5M) + 1000 (3M) = 7000
  assert.equal(result.summary.totalBilled, 7000);

  // Total Collected in month: 3000 + 1000 + 1000 = 5000
  assert.equal(result.summary.totalCollected, 5000);

  // Overall collection rate: 5000 / 7000 * 100 = 71%
  assert.equal(result.summary.overallCollectionRate, 71);

  // Total Customers: 5
  assert.equal(result.summary.totalCustomers, 5);

  // 15 Mbps row check
  const row15 = result.rows.find(r => r.label.includes('15Mbps') || r.label.includes('15 Mbps'));
  assert.ok(row15);
  assert.equal(row15.billedAmount, 3000);
  assert.equal(row15.collectedAmount, 3000);
  assert.equal(row15.collectionRate, 100);
  assert.equal(row15.totalCustomers, 1);
  assert.equal(row15.activeCustomers, 1);
  assert.equal(row15.arpu, 3000);
  assert.equal(row15.billedShare, 42.9);

  // 5 Mbps row check
  const row5 = result.rows.find(r => r.key === '5mbps');
  assert.ok(row5);
  assert.equal(row5.billedAmount, 3000); // 1500 + 1500
  assert.equal(row5.collectedAmount, 1000);
  assert.equal(row5.collectionRate, 33);
  assert.equal(row5.totalCustomers, 2);
  assert.equal(row5.activeCustomers, 2);
  assert.equal(row5.arpu, 1500); // 3000 / 2

  // Top revenue package
  assert.ok(result.summary.topRevenuePackage);
  assert.equal(result.summary.topRevenueAmount, 3000);
});

test('calculatePackageRevenueMix handles search and column sorting', () => {
  const state = createSampleState();
  const resFiltered = calculatePackageRevenueMix(state, {
    month: '2026-10',
    search: '15mbps'
  });
  assert.equal(resFiltered.rows.length, 1);
  assert.ok(resFiltered.rows[0].label.includes('15Mbps') || resFiltered.rows[0].label.includes('15 Mbps'));

  const resSorted = calculatePackageRevenueMix(state, {
    month: '2026-10',
    sortBy: 'totalCustomers',
    sortOrder: 'desc'
  });
  assert.ok(resSorted.rows[0].totalCustomers >= resSorted.rows[1].totalCustomers);
});

test('calculatePackageRevenueMix handles empty state safely', () => {
  const emptyRes = calculatePackageRevenueMix({ customers: [] }, { month: '2026-10' });
  assert.equal(emptyRes.rows.length, 0);
  assert.equal(emptyRes.summary.totalBilled, 0);
  assert.equal(emptyRes.summary.totalCollected, 0);
  assert.equal(emptyRes.summary.totalCustomers, 0);
  assert.equal(emptyRes.summary.overallCollectionRate, 0);
});

test('describeDonutArc generates valid SVG path data', () => {
  const arc = describeDonutArc(100, 100, 50, 80, 0, 90);
  assert.ok(typeof arc === 'string');
  assert.ok(arc.startsWith('M'));
  assert.ok(arc.includes('A 80 80'));
  assert.ok(arc.includes('L'));
  assert.ok(arc.includes('A 50 50'));
  assert.ok(arc.endsWith('Z'));
});

test('renderPackageRevenueDonutSvg generates responsive vector SVG markup', () => {
  const state = createSampleState();
  const data = calculatePackageRevenueMix(state, { month: '2026-10' });

  const svgBilled = renderPackageRevenueDonutSvg(data, { width: 700, metric: 'billed' });
  assert.ok(svgBilled.includes('<svg'));
  assert.ok(svgBilled.includes('class="package-revenue-donut-svg"'));
  assert.ok(svgBilled.includes('TOTAL BILLED'));
  assert.ok(svgBilled.includes('donut-slice'));

  const svgSubs = renderPackageRevenueDonutSvg(data, { width: 700, metric: 'subscribers' });
  assert.ok(svgSubs.includes('TOTAL SUBS'));

  // Empty data svg
  const emptyData = calculatePackageRevenueMix({ customers: [] }, { month: '2026-10' });
  const svgEmpty = renderPackageRevenueDonutSvg(emptyData, { width: 700 });
  assert.ok(svgEmpty.includes('<svg'));
  assert.ok(svgEmpty.includes('No package billing recorded'));
});

test('generatePackageRevenueCsv produces RFC-4180 CSV with UTF-8 BOM', () => {
  const state = createSampleState();
  const data = calculatePackageRevenueMix(state, { month: '2026-10' });
  const csv = generatePackageRevenueCsv(data);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Month,Package Label,Speed (Mbps)'));
  assert.ok(csv.includes('Billed Revenue (PKR)'));
  assert.ok(csv.includes('2026-10'));
  assert.ok(csv.includes('15Mbps Unlimited'));
});

test('generatePackageRevenuePrintHtml supports A4 and 80mm thermal formats', () => {
  const state = createSampleState();
  const data = calculatePackageRevenueMix(state, { month: '2026-10' });

  const a4Html = generatePackageRevenuePrintHtml({ data, format: 'a4' });
  assert.ok(a4Html.includes('<!DOCTYPE html>'));
  assert.ok(a4Html.includes('Package Revenue Mix &amp; Portfolio ARPU Statement'));
  assert.ok(a4Html.includes('Prepared by:'));

  const thermalHtml = generatePackageRevenuePrintHtml({ data, format: 'thermal' });
  assert.ok(thermalHtml.includes('@page { size: 80mm auto;'));
  assert.ok(thermalHtml.includes('PACKAGE REVENUE MIX'));
});

test('generatePackageRevenueBriefing builds clipboard-ready bilingual summary', () => {
  const state = createSampleState();
  const data = calculatePackageRevenueMix(state, { month: '2026-10' });
  const text = generatePackageRevenueBriefing(data);

  assert.ok(text.includes('PACKAGE REVENUE MIX BRIEFING'));
  assert.ok(text.includes('Total Billed Revenue: PKR 7,000'));
  assert.ok(text.includes('Cash Collected: PKR 5,000'));
  assert.ok(text.includes('مجموعی آمدن:'));
  assert.ok(text.includes('سب سے مقبول پیکج:'));
});

test('setupPackageRevenueModal wires DOM controllers and events cleanly', () => {
  const state = createSampleState();
  const mockListeners = {};
  const mockElements = {
    packageRevenueModal: {
      open: false,
      showModal: () => { mockElements.packageRevenueModal.open = true; },
      close: () => { mockElements.packageRevenueModal.open = false; },
      addEventListener: (evt, cb) => { mockListeners[`modal_${evt}`] = cb; },
      querySelectorAll: () => []
    },
    packageRevenueMonthSelect: { value: '2026-10', addEventListener: (evt, cb) => { mockListeners[`month_${evt}`] = cb; } },
    packageRevenueSearchInput: { value: '', addEventListener: (evt, cb) => { mockListeners[`search_${evt}`] = cb; } },
    packageRevenueModeBilledBtn: { style: {}, addEventListener: (evt, cb) => { mockListeners[`modeBilled_${evt}`] = cb; } },
    packageRevenueModeSubsBtn: { style: {}, addEventListener: (evt, cb) => { mockListeners[`modeSubs_${evt}`] = cb; } },
    packageRevenueKpiBilled: { textContent: '' },
    packageRevenueKpiCollected: { textContent: '' },
    packageRevenueKpiOutstanding: { textContent: '' },
    packageRevenueKpiArpu: { textContent: '' },
    packageRevenueChartContainer: { clientWidth: 600, innerHTML: '' },
    packageRevenueTableBody: { innerHTML: '', addEventListener: (evt, cb) => { mockListeners[`table_${evt}`] = cb; } },
    packageRevenueEmptyState: { hidden: true },
    closePackageRevenueModalBtn: { addEventListener: (evt, cb) => { mockListeners[`closeBtn_${evt}`] = cb; } },
    closePackageRevenueSecondaryBtn: { addEventListener: (evt, cb) => { mockListeners[`closeSec_${evt}`] = cb; } },
    packageRevenueExportCsvBtn: { addEventListener: (evt, cb) => { mockListeners[`export_${evt}`] = cb; } },
    packageRevenueCopyBriefingBtn: { addEventListener: (evt, cb) => { mockListeners[`copy_${evt}`] = cb; } },
    packageRevenuePrintA4Btn: { addEventListener: (evt, cb) => { mockListeners[`printA4_${evt}`] = cb; } },
    packageRevenuePrintThermalBtn: { addEventListener: (evt, cb) => { mockListeners[`printThermal_${evt}`] = cb; } },
    quickActionPackageRevenue: { addEventListener: (evt, cb) => { mockListeners[`trigger_quick`] = cb; } },
    openPackageRevenueModalBtn: { addEventListener: (evt, cb) => { mockListeners[`trigger_btn`] = cb; } }
  };

  const originalGetElementById = globalThis.document?.getElementById;
  globalThis.document = {
    getElementById: (id) => mockElements[id] || null
  };

  let filterCaptured = null;
  const controller = setupPackageRevenueModal(() => state, {
    onFilterPackageCustomers: (pkg) => { filterCaptured = pkg; },
    onToast: () => {}
  });

  assert.ok(controller);
  controller.open('2026-10');
  assert.equal(mockElements.packageRevenueModal.open, true);
  assert.equal(mockElements.packageRevenueKpiBilled.textContent, 'PKR 7,000');
  assert.equal(mockElements.packageRevenueKpiCollected.textContent, 'PKR 5,000');

  controller.close();
  assert.equal(mockElements.packageRevenueModal.open, false);

  if (originalGetElementById) {
    globalThis.document.getElementById = originalGetElementById;
  }
});

test('index.html and styles.css contain package revenue modal markup and styling', () => {
  const htmlPath = path.resolve('index.html');
  const cssPath = path.resolve('styles.css');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(html.includes('id="packageRevenueModal"'));
  assert.ok(html.includes('id="quickActionPackageRevenue"'));
  assert.ok(html.includes('id="openPackageRevenueModalBtn"'));
  assert.ok(html.includes('id="packageRevenueChartContainer"'));
  assert.ok(html.includes('id="packageRevenueTableBody"'));

  assert.ok(css.includes('.package-revenue-modal'));
  assert.ok(css.includes('.donut-slice'));
  assert.ok(css.includes('[data-theme="dark"] .package-revenue-modal'));
});

test('dashboard.js re-exports package revenue mix functions correctly', () => {
  assert.equal(typeof dashboardExports.calculatePackageRevenueMix, 'function');
  assert.equal(typeof dashboardExports.renderPackageRevenueDonutSvg, 'function');
  assert.equal(typeof dashboardExports.generatePackageRevenueCsv, 'function');
  assert.equal(typeof dashboardExports.generatePackageRevenuePrintHtml, 'function');
  assert.equal(typeof dashboardExports.generatePackageRevenueBriefing, 'function');
  assert.equal(typeof dashboardExports.setupPackageRevenueModal, 'function');
  assert.equal(typeof dashboardExports.resolvePackageForCustomer, 'function');
  assert.equal(typeof dashboardExports.resolvePackageForBill, 'function');
});
