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

  await t.test('generateCustomerRosterCsv excludes voided payments from status, balance and collections (Sharafat 27)', () => {
    // A voided-only payment is history, never money: the CSV must agree with
    // the table — status PENDING (not PAID), full balance due, 0 collected.
    const voidedOnly = {
      id: 'cust-void-01',
      customerNumber: 201,
      name: 'Voided Only Customer',
      phone: '03001234567',
      mohalla: 'Baradari',
      zone: 'North',
      address: 'House 1',
      packageSpeed: '20 Mbps Fiber',
      monthlySellingAmount: 2000,
      serviceStatus: 'active',
      bills: [
        { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000, voided: true }] }
      ]
    };
    const csv = generateCustomerRosterCsv([voidedOnly], { billingMonth: '2026-10' });
    const lines = csv.split('\r\n');
    assert.strictEqual(lines.length, 2, 'Header plus the one customer row');
    assert.match(lines[1], /"PENDING","2000","0"$/, 'Voided-only row: PENDING, full 2000 due, 0 collected');
    assert.doesNotMatch(lines[1], /"PAID"/);

    // Mixed case: a real 500 plus a voided 1500 on a 2000 bill → PARTIAL,
    // 1500 still due, 500 collected.
    const mixed = {
      ...voidedOnly,
      id: 'cust-void-02',
      customerNumber: 202,
      name: 'Mixed Payment Customer',
      bills: [
        { month: '2026-10', dueAmount: 2000, payments: [{ amount: 500 }, { amount: 1500, voided: true }] }
      ]
    };
    const mixedCsv = generateCustomerRosterCsv([mixed], { billingMonth: '2026-10' });
    assert.match(mixedCsv.split('\r\n')[1], /"PARTIAL","1500","500"$/);
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

  await t.test('cards-mode empty state carries a sibling reset button reusing cust_table_reset (Sharafat 35)', () => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const lines = html.split('\n');
    const emptyLine = lines.findIndex(line => line.includes('id="noSearchResults"'));
    assert.ok(emptyLine >= 0, 'Must have #noSearchResults');
    // The button must NOT nest inside the textContent-driven <p> — a nested
    // button would be destroyed on the next render.
    assert.doesNotMatch(lines[emptyLine], /resetCustomerCardsFiltersBtn/, 'Reset button must not live inside #noSearchResults');
    const wrapperLine = lines.findIndex(line => line.includes('id="customerCardsEmptyActions"'));
    assert.strictEqual(wrapperLine, emptyLine + 1, 'Cards reset wrapper must be the sibling directly after #noSearchResults');
    assert.match(lines[wrapperLine], /hidden/, 'Wrapper starts hidden; renderCustomers() toggles it with the empty state');
    assert.match(lines[wrapperLine], /id="resetCustomerCardsFiltersBtn"/);
    assert.match(lines[wrapperLine], /class="secondary-button reset-filter-btn"/);
    assert.match(lines[wrapperLine], /data-i18n="cust_table_reset"/, 'Cards button reuses the table reset label — zero new i18n keys');
  });

  await t.test('table reset and cards reset share one named handler that clears all eight filters (Sharafat 35)', () => {
    const appPath = path.join(__dirname, '..', 'app.js');
    const app = fs.readFileSync(appPath, 'utf8');
    const defs = app.match(/function resetCustomerRosterFilters\(\) \{/g) || [];
    assert.strictEqual(defs.length, 1, 'Exactly one shared reset handler');
    const bodyStart = app.indexOf('function resetCustomerRosterFilters() {');
    const bodyEnd = app.indexOf('\n}\n', bodyStart);
    const body = app.slice(bodyStart, bodyEnd);
    // All eight clears, exactly as the table reset always cleared them.
    assert.match(body, /\$\('#customerListSearch'\)\.value = '';/);
    assert.match(body, /\$\('#globalCustomerSearch'\)\.value = '';/);
    assert.match(body, /customerSearchField = UNIFIED_IDENTIFIER_FIELD_ID;/);
    assert.match(body, /\$\('#customerSearchField'\)\.value = UNIFIED_IDENTIFIER_FIELD_ID;/);
    assert.match(body, /customerRosterPill = 'all';/);
    assert.match(body, /customerAreaFilter = 'all';/);
    assert.match(body, /\$\('#customerFilterArea'\)\.value = 'all';/);
    assert.match(body, /selectedServiceFilter = 'all';/);
    assert.match(body, /selectedBillingFilter = 'all';/);
    assert.match(body, /customerCurrentPage = 1;/);
    assert.match(body, /renderCustomers\(\);/);
    // Fork 2 (a): renderCustomers() ONLY — the global-query staleness is
    // found-not-fixed, not widened here.
    assert.doesNotMatch(body, /renderGlobalSearch|renderTransactions|renderMonthlyReport/);
    // Month and sort are untouched, exactly as the table reset left them.
    assert.doesNotMatch(body, /selectedBillingMonth|customerSortBy/);
    // Both buttons call the one handler; the old inline body is gone.
    assert.match(app, /\$\('#resetCustomerTableFiltersBtn'\)\?\.addEventListener\('click', resetCustomerRosterFilters\);/);
    assert.match(app, /\$\('#resetCustomerCardsFiltersBtn'\)\?\.addEventListener\('click', resetCustomerRosterFilters\);/);
    assert.doesNotMatch(app, /resetCustomerTableFiltersBtn'\)\?\.addEventListener\('click', \(\) => \{/);
  });

  await t.test('cards reset button is wired once at module setup, never inside renderCustomers (Sharafat 35)', () => {
    const appPath = path.join(__dirname, '..', 'app.js');
    const app = fs.readFileSync(appPath, 'utf8');
    const wiring = app.match(/\$\('#resetCustomerCardsFiltersBtn'\)\?\.addEventListener/g) || [];
    assert.strictEqual(wiring.length, 1, 'Cards reset wired exactly once');
    const renderStart = app.indexOf('function renderCustomers()');
    const renderEnd = app.indexOf('\nfunction ', renderStart + 1);
    const renderBody = app.slice(renderStart, renderEnd);
    assert.doesNotMatch(renderBody, /resetCustomerCardsFiltersBtn/, 'Wiring inside renderCustomers() would double-bind on every render');
    // The toggle lives in the empty-state block instead, gated on cards mode.
    assert.match(renderBody, /cardsEmptyActions\.hidden = emptySearch\.hidden \|\| customerViewMode !== 'cards';/);
  });

  await t.test('styles.css gives the cards reset the table button sizing with zero new hex (Sharafat 35)', () => {
    const cssPath = path.join(__dirname, '..', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.match(css, /\.customer-cards-empty-actions \.reset-filter-btn \{[^}]*min-height: 38px;/);
    assert.match(css, /\.customer-cards-empty-actions \{[^}]*text-align: center;/);
  });
});
