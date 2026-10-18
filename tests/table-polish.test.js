import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateCustomerRosterCsv,
  renderCustomerTableEmptyMarkup,
  getCustomerMonthBalance,
  getCustomerTotalCollections
} from '../form-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Customer Roster Table Polish & CSV Export Suite', async t => {
  const sampleCustomers = [
    {
      id: 'cust-101',
      customerNumber: 101,
      name: 'Muhammad Tariq',
      phone: '03001234567',
      cnic: '35202-1234567-1',
      mohalla: 'Main Bazaar',
      zone: 'North',
      address: 'House 14, Street 2',
      packageSpeed: '20 Mbps Fiber',
      monthlySellingAmount: 2000,
      serviceStatus: 'active',
      bills: [
        {
          month: '2026-10',
          dueAmount: 2000,
          payments: [{ amount: 2000 }]
        }
      ]
    },
    {
      id: 'cust-102',
      customerNumber: 102,
      name: 'Usman Ali, "Shop 4"',
      phone: '03217654321',
      cnic: '35202-7654321-2',
      mohalla: 'Kot Mohibbu',
      zone: 'South',
      address: 'Main Chowk, Shahdara',
      packageSpeed: '15 Mbps Fiber',
      monthlySellingAmount: 1500,
      serviceStatus: 'offline',
      bills: [
        {
          month: '2026-10',
          dueAmount: 1500,
          payments: [{ amount: 500 }]
        }
      ]
    }
  ];

  await t.test('generateCustomerRosterCsv produces RFC-4180 CSV with UTF-8 BOM and correct columns', () => {
    const csv = generateCustomerRosterCsv(sampleCustomers, { billingMonth: '2026-10' });

    assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Windows Excel compatibility');
    assert.match(csv, /"Customer #","Customer Name","Phone","CNIC","Area \/ Mohalla"/);
    assert.match(csv, /"101","Muhammad Tariq","03001234567"/);
    assert.match(csv, /"PAID"/);
    assert.match(csv, /"PARTIAL"/);
    // Verifies escaping for names with quotes and commas
    assert.match(csv, /"Usman Ali, ""Shop 4"""/);
  });

  await t.test('generateCustomerRosterCsv safely handles empty list or missing fields', () => {
    const emptyCsv = generateCustomerRosterCsv([], { billingMonth: '2026-10' });
    assert.ok(emptyCsv.startsWith('\uFEFF'));
    const lines = emptyCsv.split('\r\n');
    assert.strictEqual(lines.length, 1, 'Only header row should exist for empty array');

    const bareCust = [{ id: 'cust-999', name: 'Bare Customer' }];
    const bareCsv = generateCustomerRosterCsv(bareCust, { billingMonth: '2026-10' });
    assert.match(bareCsv, /"Bare Customer"/);
    assert.match(bareCsv, /"Not set"/);
  });

  await t.test('renderCustomerTableEmptyMarkup formats clean empty state with reset button', () => {
    const htmlWithQueryAndArea = renderCustomerTableEmptyMarkup('Zubair', 'Kot Mohibbu');
    assert.match(htmlWithQueryAndArea, /colspan="8"/);
    assert.match(htmlWithQueryAndArea, /No customers matching (&quot;|")Zubair(&quot;|") in Kot Mohibbu\./);
    assert.match(htmlWithQueryAndArea, /id="resetCustomerTableFiltersBtn"/);

    const defaultEmpty = renderCustomerTableEmptyMarkup('', 'all');
    assert.match(defaultEmpty, /No customers found\./);
  });

  await t.test('index.html contains customerTableExpandBtn, exportCustomerRosterCsvBtn, and sortable headers', () => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.ok(html.includes('id="customerTableExpandBtn"'), 'Must have table expand button');
    assert.ok(html.includes('id="exportCustomerRosterCsvBtn"'), 'Must have export roster CSV button');
    assert.ok(html.includes('data-sort-cust="number"'), 'Must have sortable # header');
    assert.ok(html.includes('data-sort-cust="name"'), 'Must have sortable Customer header');
    assert.ok(html.includes('data-sort-cust="balance"'), 'Must have sortable Balance Due header');
    assert.ok(html.includes('class="sort-icon"'), 'Must include sort icon elements');
  });

  await t.test('styles.css includes roster-table-expanded, sort-icon, and export button styling', () => {
    const cssPath = path.join(__dirname, '..', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('.app-shell.roster-table-expanded'), 'Must have roster-table-expanded style');
    assert.ok(css.includes('.export-roster-btn'), 'Must have export-roster-btn style');
    assert.ok(css.includes('.customer-table-empty'), 'Must have customer-table-empty style');
    assert.ok(css.includes('.sort-icon'), 'Must have sort-icon style');
  });
});
