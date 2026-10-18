import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateAreaIntelligenceCsv,
  generatePackageSummaryCsv,
  generateAreaSummaryCsv
} from '../form-validation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Area Analytics Polish Suite - generateAreaIntelligenceCsv produces RFC-4180 CSV with UTF-8 BOM', () => {
  const sampleRows = [
    {
      area: 'Area: Shahdara Town',
      level: 'area',
      parentArea: null,
      totalCustomers: 45,
      activeCustomers: 42,
      billedAmount: 67500,
      collectedAmount: 65000,
      outstanding: 2500,
      collectionRate: 96.3,
      averageCustomerValue: 1500,
      expenses: 12000,
      estimatedProfit: 53000
    },
    {
      area: 'Zone: Main Bazaar',
      level: 'zone',
      parentArea: 'Area: Shahdara Town',
      totalCustomers: 20,
      activeCustomers: 18,
      billedAmount: 30000,
      collectedAmount: 29000,
      outstanding: 1000,
      collectionRate: 96.7,
      averageCustomerValue: 1500,
      expenses: null,
      estimatedProfit: null
    }
  ];

  const csv = generateAreaIntelligenceCsv(sampleRows, { from: '2026-05-01', to: '2026-10-18' });
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  const lines = csv.slice(1).split('\r\n');
  assert.ok(lines.length >= 3, 'Must contain header and data lines');

  // Verify headers
  assert.ok(lines[0].includes('"Area / Mohalla / Zone"'));
  assert.ok(lines[0].includes('"Monthly Billing (PKR)"'));
  assert.ok(lines[0].includes('"Average Customer Value (PKR)"'));
  assert.ok(lines[0].includes('"Expenses (PKR)"'));
  assert.ok(lines[0].includes('"Estimated Profit (PKR)"'));

  // Verify row 1
  assert.ok(lines[1].includes('"Shahdara Town"'));
  assert.ok(lines[1].includes('"45"'));
  assert.ok(lines[1].includes('"67500"'));
  assert.ok(lines[1].includes('"96.3%"'));
  assert.ok(lines[1].includes('"53000"'));

  // Verify row 2 (null expenses and profit handled safely)
  assert.ok(lines[2].includes('"Main Bazaar"'));
  assert.ok(lines[2].includes('"Shahdara Town"'));
  assert.ok(lines[2].includes('"Not estimated"'));
});

test('Area Analytics Polish Suite - generatePackageSummaryCsv produces valid CSV', () => {
  const samplePackageRows = [
    {
      package: '15 Mbps Unlimited',
      customers: 30,
      activeCustomers: 28,
      billedRevenue: 42000,
      outstanding: 3000,
      excludedSubscriptions: 2,
      newSubscriptions: 5,
      expired: 1,
      churn: 0,
      hasBilledRevenue: true,
      hasBillHistory: true,
      arpu: 1500
    },
    {
      package: 'Package not set',
      customers: 2,
      activeCustomers: 0,
      billedRevenue: null,
      outstanding: null,
      excludedSubscriptions: 2,
      newSubscriptions: 0,
      expired: 0,
      churn: 0,
      hasBilledRevenue: false,
      hasBillHistory: false,
      arpu: null
    }
  ];

  const csv = generatePackageSummaryCsv(samplePackageRows);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  const lines = csv.slice(1).split('\r\n');
  assert.ok(lines[0].includes('"Package"'));
  assert.ok(lines[0].includes('"Service-Month Billed (PKR)"'));
  assert.ok(lines[0].includes('"ARPU (PKR)"'));

  // Data row 1
  assert.ok(lines[1].includes('"15 Mbps Unlimited"'));
  assert.ok(lines[1].includes('"42000"'));
  assert.ok(lines[1].includes('"1500"'));

  // Data row 2
  assert.ok(lines[2].includes('"Package not set"'));
  assert.ok(lines[2].includes('"No bill snapshots"'));
  assert.ok(lines[2].includes('"Not set"'));
});

test('Area Analytics Polish Suite - generateAreaSummaryCsv produces valid Location Summary CSV', () => {
  const sampleAreaRows = [
    {
      area: 'Area: Saeed Park',
      level: 'area',
      parentArea: null,
      customerCount: 15,
      activeCustomers: 14,
      billedRevenue: 21000,
      outstanding: 1500,
      excludedSubscriptions: 1,
      onlinePercent: 93.3,
      online: 14,
      offline: 1,
      complaints: 2,
      newConnections: 3,
      hasBilledRevenue: true,
      hasBillHistory: true,
      arpu: 1500
    }
  ];

  const csv = generateAreaSummaryCsv(sampleAreaRows);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');

  const lines = csv.slice(1).split('\r\n');
  assert.ok(lines[0].includes('"Location"'));
  assert.ok(lines[0].includes('"Online %"'));
  assert.ok(lines[0].includes('"Incidents"'));

  assert.ok(lines[1].includes('"Saeed Park"'));
  assert.ok(lines[1].includes('"93.3%"'));
  assert.ok(lines[1].includes('"2"'));
});

test('Area Analytics Polish Suite - HTML integrity for search, exports, and sortable headers', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // Area intelligence search and controls
  assert.ok(html.includes('id="areaIntelSearch"'), 'Must contain #areaIntelSearch');
  assert.ok(html.includes('id="areaIntelRowCount"'), 'Must contain #areaIntelRowCount');
  assert.ok(html.includes('id="exportAreaIntelCsvBtn"'), 'Must contain #exportAreaIntelCsvBtn');
  assert.ok(html.includes('id="resetAreaIntelFiltersBtn"'), 'Must contain #resetAreaIntelFiltersBtn');

  // Area intelligence table headers (all 10 sortable)
  assert.ok(html.includes('data-sort-area="area"'), 'Must sort by area');
  assert.ok(html.includes('data-sort-area="totalCustomers"'), 'Must sort by totalCustomers');
  assert.ok(html.includes('data-sort-area="activeCustomers"'), 'Must sort by activeCustomers');
  assert.ok(html.includes('data-sort-area="billedAmount"'), 'Must sort by billedAmount');
  assert.ok(html.includes('data-sort-area="collectedAmount"'), 'Must sort by collectedAmount');
  assert.ok(html.includes('data-sort-area="outstanding"'), 'Must sort by outstanding');
  assert.ok(html.includes('data-sort-area="collectionRate"'), 'Must sort by collectionRate');
  assert.ok(html.includes('data-sort-area="averageCustomerValue"'), 'Must sort by averageCustomerValue');
  assert.ok(html.includes('data-sort-area="expenses"'), 'Must sort by expenses');
  assert.ok(html.includes('data-sort-area="estimatedProfit"'), 'Must sort by estimatedProfit');

  // Package summary CSV and headers
  assert.ok(html.includes('id="exportPackageSummaryCsvBtn"'), 'Must contain #exportPackageSummaryCsvBtn');
  assert.ok(html.includes('data-sort-pkgsum="package"'), 'Must sort by package name');
  assert.ok(html.includes('data-sort-pkgsum="customers"'), 'Must sort by customer count');
  assert.ok(html.includes('data-sort-pkgsum="billedRevenue"'), 'Must sort by billed revenue');
  assert.ok(html.includes('data-sort-pkgsum="arpu"'), 'Must sort by ARPU');

  // Location summary CSV
  assert.ok(html.includes('id="exportAreaSummaryCsvBtn"'), 'Must contain #exportAreaSummaryCsvBtn');
});

test('Area Analytics Polish Suite - CSS styles for badge, range controls, and dark mode', () => {
  const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');

  assert.ok(css.includes('.area-intel-count-badge'), 'Must style .area-intel-count-badge');
  assert.ok(css.includes('.area-intel-status-pill'), 'Must style .area-intel-status-pill');
  assert.ok(css.includes('[data-theme="dark"] .area-intel-count-badge'), 'Must support dark mode for badge');
  assert.ok(css.includes('.analytics-range-controls'), 'Must style .analytics-range-controls');
});

test('Area Analytics Polish Suite - app.js wiring verification', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

  assert.ok(appJs.includes('generateAreaIntelligenceCsv'), 'Must import generateAreaIntelligenceCsv');
  assert.ok(appJs.includes('generatePackageSummaryCsv'), 'Must import generatePackageSummaryCsv');
  assert.ok(appJs.includes('generateAreaSummaryCsv'), 'Must import generateAreaSummaryCsv');

  assert.ok(appJs.includes('areaSearchQuery'), 'Must track areaSearchQuery');
  assert.ok(appJs.includes("areaSortKey === 'averageCustomerValue'"), 'Must handle averageCustomerValue sort');
  assert.ok(appJs.includes("areaSortKey === 'expenses'"), 'Must handle expenses sort');
  assert.ok(appJs.includes("areaSortKey === 'estimatedProfit'"), 'Must handle estimatedProfit sort');

  assert.ok(appJs.includes('renderPackageSummaryTable'), 'Must have renderPackageSummaryTable');
  assert.ok(appJs.includes("querySelectorAll('[data-sort-pkgsum]')"), 'Must wire [data-sort-pkgsum] headers');

  assert.ok(appJs.includes('exportAreaIntelCsvBtn'), 'Must wire exportAreaIntelCsvBtn');
  assert.ok(appJs.includes('exportPackageSummaryCsvBtn'), 'Must wire exportPackageSummaryCsvBtn');
  assert.ok(appJs.includes('exportAreaSummaryCsvBtn'), 'Must wire exportAreaSummaryCsvBtn');
});
