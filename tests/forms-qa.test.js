import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePakistanPhone, validatePositiveAmount, validateCustomerName, validateTransactionDate, paginateRows, calculateTransactionSummary,
  saveFormDraft, loadFormDraft, clearFormDraft, hasFormDraft, wireFormDraftAutosave, generateCsvContent, downloadCsvFile, generateBatchReceiptHtml,
  maskPakistanPhone, wirePhoneInputMask, formatCustomerStatement, generateCustomerStatementHtml, downloadCustomerStatementCsv,
  formatWhatsAppUrl, buildPaymentReminderMessage, generatePaymentReminderSlipHtml
} from '../form-validation.js';


const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');

test('validatePakistanPhone accepts valid international Pakistani mobile format', () => {
  const res1 = validatePakistanPhone('+923001234567');
  assert.equal(res1.valid, true);
  assert.equal(res1.type, 'pk-international');
  assert.match(res1.message, /Valid Pakistani mobile/);

  const res2 = validatePakistanPhone('+92 300 1234567');
  assert.equal(res2.valid, true);
  assert.equal(res2.type, 'pk-international');

  const res3 = validatePakistanPhone('00923219876543');
  assert.equal(res3.valid, true);
  assert.equal(res3.type, 'pk-international');
});

test('validatePakistanPhone accepts local Pakistani 03xx mobile and gives WhatsApp international tip', () => {
  const res = validatePakistanPhone('03001234567');
  assert.equal(res.valid, true);
  assert.equal(res.type, 'pk-local');
  assert.equal(res.tip, true);
  assert.match(res.message, /\+923001234567/);
});

test('validatePakistanPhone rejects incomplete numbers or non-numeric characters', () => {
  const res1 = validatePakistanPhone('0300123');
  assert.equal(res1.valid, false);
  assert.equal(res1.tip, true);
  assert.match(res1.message, /Incomplete local number/);

  const res2 = validatePakistanPhone('0300-abc-def');
  assert.equal(res2.valid, false);
  assert.match(res2.message, /Only numbers, spaces, dashes/);

  const res3 = validatePakistanPhone('');
  assert.equal(res3.valid, true);
  assert.equal(res3.empty, true);
});

test('validatePositiveAmount accepts valid positive numbers and handles constraints', () => {
  assert.equal(validatePositiveAmount(1500).valid, true);
  assert.equal(validatePositiveAmount('2500.50').valid, true);
  assert.equal(validatePositiveAmount('0').valid, true);
  assert.equal(validatePositiveAmount('0', { allowZero: false }).valid, false);
  assert.equal(validatePositiveAmount(-50).valid, false);
  assert.equal(validatePositiveAmount('-10').message, 'Amount cannot be negative.');
  assert.equal(validatePositiveAmount('abc').valid, false);
  assert.equal(validatePositiveAmount('', { required: true }).valid, false);
  assert.equal(validatePositiveAmount('', { required: false }).valid, true);
});

test('index.html contains phoneValidationHint elements and styles.css provides hint styles', () => {
  assert.match(index, /id="phoneValidationHint"/);
  assert.match(index, /id="newCustomerPhoneHint"/);
  assert.match(styles, /\.phone-validation-hint/);
  assert.match(styles, /\.phone-validation-hint\.valid/);
  assert.match(styles, /\.phone-validation-hint\.tip/);
  assert.match(styles, /\.phone-validation-hint\.invalid/);
});

test('app.js wires phone validation helper and negative amount guards', () => {
  assert.match(app, /wirePhoneValidationHelper\('#phoneInput',\s*'#phoneValidationHint'\)/);
  assert.match(app, /wirePhoneValidationHelper\('#newCustomerPhone',\s*'#newCustomerPhoneHint'\)/);
  assert.match(app, /#monthlySellingAmountInput/);
  assert.match(app, /Number\(val\)\s*<\s*0/);
});

test('validateCustomerName validates customer names correctly', () => {
  const res1 = validateCustomerName('Muhammad Ali');
  assert.equal(res1.valid, true);
  assert.equal(res1.cleanName, 'Muhammad Ali');

  const res2 = validateCustomerName('   Usman   Tariq   ');
  assert.equal(res2.valid, true);
  assert.equal(res2.cleanName, 'Usman Tariq');

  const res3 = validateCustomerName('A');
  assert.equal(res3.valid, false);
  assert.match(res3.message, /at least 2 characters/);

  const res4 = validateCustomerName('');
  assert.equal(res4.valid, false);
  assert.match(res4.message, /cannot be empty/);

  const res5 = validateCustomerName('   ');
  assert.equal(res5.valid, false);

  const res6 = validateCustomerName(null);
  assert.equal(res6.valid, false);

  const longName = 'A'.repeat(105);
  const res7 = validateCustomerName(longName);
  assert.equal(res7.valid, false);
  assert.match(res7.message, /cannot exceed 100/);
});

test('validateTransactionDate enforces YYYY-MM-DD format and valid calendar dates', () => {
  assert.equal(validateTransactionDate('2026-10-15').valid, true);
  assert.equal(validateTransactionDate('2026-02-28').valid, true);

  // Invalid formats
  assert.equal(validateTransactionDate('15-10-2026').valid, false);
  assert.equal(validateTransactionDate('2026/10/15').valid, false);
  assert.equal(validateTransactionDate('invalid').valid, false);
  assert.equal(validateTransactionDate('').valid, false);

  // Invalid calendar bounds
  assert.equal(validateTransactionDate('2026-02-31').valid, false);
  assert.equal(validateTransactionDate('2026-13-01').valid, false);
  assert.equal(validateTransactionDate('2026-00-10').valid, false);

  // Range bounds
  assert.equal(validateTransactionDate('2019-12-31').valid, false);
  assert.equal(validateTransactionDate('2026-10-20', { maxDate: '2026-10-15' }).valid, false);
});

test('paginateRows handles page slicing, bounds clamping, and all-item views', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  // Page 1 with pageSize 3
  const p1 = paginateRows(items, 1, 3);
  assert.deepEqual(p1.items, ['a', 'b', 'c']);
  assert.equal(p1.page, 1);
  assert.equal(p1.totalPages, 3);
  assert.equal(p1.totalItems, 7);

  // Page 3 with pageSize 3
  const p3 = paginateRows(items, 3, 3);
  assert.deepEqual(p3.items, ['g']);
  assert.equal(p3.page, 3);

  // Page out of bounds clamps to max page
  const pOver = paginateRows(items, 10, 3);
  assert.equal(pOver.page, 3);
  assert.deepEqual(pOver.items, ['g']);

  // Page below 1 clamps to 1
  const pUnder = paginateRows(items, 0, 3);
  assert.equal(pUnder.page, 1);

  // PageSize 'all'
  const pAll = paginateRows(items, 1, 'all');
  assert.equal(pAll.items.length, 7);
  assert.equal(pAll.totalPages, 1);

  // Empty list
  const pEmpty = paginateRows([], 1, 10);
  assert.deepEqual(pEmpty.items, []);
  assert.equal(pEmpty.totalPages, 1);
  assert.equal(pEmpty.totalItems, 0);
});

test('calculateTransactionSummary computes totals, averages, and method distributions', () => {
  const txs = [
    { amount: 1500, method: 'Cash' },
    { amount: 2500, method: 'EasyPaisa' },
    { amount: 2000, method: 'Cash' },
    { amount: 3000, method: 'Bank Transfer' }
  ];

  const summary = calculateTransactionSummary(txs);
  assert.equal(summary.count, 4);
  assert.equal(summary.totalAmount, 9000);
  assert.equal(summary.averageAmount, 2250);
  assert.equal(summary.methodCounts['Cash'], 2);
  assert.equal(summary.methodCounts['EasyPaisa'], 1);
  assert.equal(summary.methodCounts['Bank Transfer'], 1);

  const emptySummary = calculateTransactionSummary([]);
  assert.equal(emptySummary.count, 0);
  assert.equal(emptySummary.totalAmount, 0);
  assert.equal(emptySummary.averageAmount, 0);
});

test('app.js integrates validateCustomerName in saveNewCustomer', () => {
  assert.match(app, /validateCustomerName\(details\.name\)/);
  assert.match(app, /errorBox\.textContent\s*=\s*nameValidation\.message/);
});

test('saveFormDraft, loadFormDraft, clearFormDraft, and hasFormDraft manage draft state in storage', () => {
  const mockStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, val) { this._data[key] = String(val); },
    removeItem(key) { delete this._data[key]; }
  };

  assert.equal(hasFormDraft('testForm', mockStorage), false);
  assert.equal(loadFormDraft('testForm', mockStorage), null);

  saveFormDraft('testForm', { name: 'Ali', phone: '03001234567' }, mockStorage);
  assert.equal(hasFormDraft('testForm', mockStorage), true);

  const loaded = loadFormDraft('testForm', mockStorage);
  assert.equal(loaded.name, 'Ali');
  assert.equal(loaded.phone, '03001234567');

  clearFormDraft('testForm', mockStorage);
  assert.equal(hasFormDraft('testForm', mockStorage), false);
  assert.equal(loadFormDraft('testForm', mockStorage), null);
});

test('generateCsvContent properly escapes quotes, commas, handles newlines, and prepends UTF-8 BOM', () => {
  const headers = [
    { key: 'name', label: 'Full Name' },
    { key: 'role', label: 'Designation' },
    { key: 'quote', label: 'Note' }
  ];
  const rows = [
    { name: 'John Doe', role: 'Manager', quote: 'Hello, World!' },
    { name: 'Jane "Ace" Smith', role: 'Engineer', quote: 'Line 1\nLine 2' }
  ];

  const csv = generateCsvContent(headers, rows);
  // Verify UTF-8 BOM
  assert.ok(csv.startsWith('\uFEFF'));
  // Verify header line
  assert.match(csv, /Full Name,Designation,Note/);
  // Verify commas escaped with quotes
  assert.match(csv, /"Hello, World!"/);
  // Verify double quotes escaped as ""
  assert.match(csv, /"Jane ""Ace"" Smith"/);
});

test('generateBatchReceiptHtml generates slips with correct customer details, balance and filters', () => {
  const customers = [
    {
      id: 'cust-1',
      customerNumber: 1,
      name: 'Babar Azam',
      monthlyPrice: 2000,
      area: 'Shahdara Town',
      phone: '03001112233',
      package: '20 Mbps Fiber',
      bills: [{ month: '2026-10', dueAmount: 2000, paidAmount: 2000 }]
    },
    {
      id: 'cust-2',
      customerNumber: 2,
      name: 'Shaheen Afridi',
      monthlyPrice: 2500,
      area: 'Begum Kot',
      phone: '03004445566',
      package: '30 Mbps Fiber',
      bills: [{ month: '2026-10', dueAmount: 2500, paidAmount: 1000 }]
    }
  ];

  const allHtml = generateBatchReceiptHtml(customers, '2026-10', null, { filter: 'all' });
  assert.match(allHtml, /Babar Azam/);
  assert.match(allHtml, /Shaheen Afridi/);
  assert.match(allHtml, /SHAHDARA FIBER NET/);
  assert.match(allHtml, /CUSTOMER BILLING SLIP/);
  assert.match(allHtml, /status-paid/);
  assert.match(allHtml, /status-partial/);

  const pendingHtml = generateBatchReceiptHtml(customers, '2026-10', null, { filter: 'pending' });
  assert.ok(!pendingHtml.includes('Babar Azam'));
  assert.ok(pendingHtml.includes('Shaheen Afridi'));

  const paidHtml = generateBatchReceiptHtml(customers, '2026-10', null, { filter: 'paid' });
  assert.ok(paidHtml.includes('Babar Azam'));
  assert.ok(!paidHtml.includes('Shaheen Afridi'));
});

test('index.html and styles.css contain Phase 12 draft notices, CSV buttons, and batch receipt modal', () => {
  assert.match(index, /id="newCustomerDraftNotice"/);
  assert.match(index, /id="discardNewCustomerDraftBtn"/);
  assert.match(index, /id="expenseDraftNotice"/);
  assert.match(index, /id="discardExpenseDraftBtn"/);
  assert.match(index, /id="exportTransactionsCsvBtn"/);
  assert.match(index, /id="exportExpensesCsvBtn"/);
  assert.match(index, /id="exportInventoryCsvBtn"/);
  assert.match(index, /id="exportMonthlyReportCsvBtn"/);
  assert.match(index, /id="batchReceiptPrintBtn"/);
  assert.match(index, /id="batchReceiptModal"/);
  assert.match(index, /id="triggerBatchPrintBtn"/);

  assert.match(styles, /\.draft-restore-notice/);
  assert.match(styles, /\.draft-discard-btn/);
  assert.match(styles, /\.batch-receipt-slip/);
  assert.match(styles, /\.batch-slip-stub/);
  assert.match(styles, /@media print/);
});

test('app.js wires Phase 12 draft autosave, CSV exports, and batch receipt sheet', () => {
  assert.match(app, /wireFormDraftAutosave/);
  assert.match(app, /#exportTransactionsCsvBtn/);
  assert.match(app, /#exportExpensesCsvBtn/);
  assert.match(app, /#exportInventoryCsvBtn/);
  assert.match(app, /#exportMonthlyReportCsvBtn/);
  assert.match(app, /#batchReceiptPrintBtn/);
  assert.match(app, /renderBatchReceipts/);
});

test('maskPakistanPhone formats local 03xx numbers and preserves international format', () => {
  assert.equal(maskPakistanPhone('03001234567'), '0300-1234567');
  assert.equal(maskPakistanPhone('03219876543'), '0321-9876543');
  assert.equal(maskPakistanPhone('0300-1234567'), '0300-1234567');
  assert.equal(maskPakistanPhone('+92 300 1234567'), '+92 300 1234567');
  assert.equal(maskPakistanPhone('923001234567'), '+92 300 1234567');
  assert.equal(maskPakistanPhone('0300'), '0300');
  assert.equal(maskPakistanPhone('03'), '03');
  assert.equal(maskPakistanPhone(''), '');
  assert.equal(maskPakistanPhone(null), '');
});

test('wirePhoneInputMask attaches input listener and applies mask', () => {
  const listeners = new Map();
  const fakeInput = {
    value: '03001234567',
    dataset: {},
    addEventListener(ev, fn) { listeners.set(ev, fn); }
  };

  wirePhoneInputMask(fakeInput);
  assert.equal(fakeInput.dataset.masked, 'true');

  const onInput = listeners.get('input');
  assert.ok(typeof onInput === 'function');
  fakeInput.value = '03217654321';
  onInput();
  assert.equal(fakeInput.value, '0321-7654321');

  // Second call does not double-wire
  let callCount = 0;
  fakeInput.addEventListener = () => { callCount++; };
  wirePhoneInputMask(fakeInput);
  assert.equal(callCount, 0);
});

test('formatCustomerStatement calculates chronological ledger and running balance', () => {
  const sampleCustomer = {
    id: 'cust-001',
    customerNumber: 42,
    name: 'Muhammad Aslam',
    phone: '0300-1234567',
    area: 'Farooq Ganj',
    packageSpeed: '15 Mbps',
    serviceStatus: 'active',
    bills: [
      {
        id: 'bill-2026-01',
        month: '2026-01',
        dueAmount: 2000,
        dueDate: '2026-01-05',
        payments: [
          { id: 'p1', date: '2026-01-08', amount: 2000, method: 'Cash' }
        ]
      },
      {
        id: 'bill-2026-02',
        month: '2026-02',
        dueAmount: 2200,
        dueDate: '2026-02-05',
        payments: [
          { id: 'p2', date: '2026-02-10', amount: 1500, method: 'EasyPaisa', reference: 'EP-9988' }
        ]
      },
      {
        id: 'bill-2026-03',
        month: '2026-03',
        dueAmount: 2200,
        dueDate: '2026-03-05',
        payments: []
      }
    ]
  };

  const fullStatement = formatCustomerStatement(sampleCustomer, { range: 'all' });
  assert.equal(fullStatement.customer.name, 'Muhammad Aslam');
  assert.equal(fullStatement.customer.customerNumber, 42);
  assert.equal(fullStatement.openingBalance, 0);
  assert.equal(fullStatement.totalBilled, 6400); // 2000 + 2200 + 2200
  assert.equal(fullStatement.totalPaid, 3500); // 2000 + 1500
  assert.equal(fullStatement.currentBalance, 2900); // 6400 - 3500
  assert.equal(fullStatement.events.length, 5); // 3 bills + 2 payments

  // Check sequence of events and running balances
  assert.equal(fullStatement.events[0].type, 'bill');
  assert.equal(fullStatement.events[0].charge, 2000);
  assert.equal(fullStatement.events[0].runningBalance, 2000);

  assert.equal(fullStatement.events[1].type, 'payment');
  assert.equal(fullStatement.events[1].credit, 2000);
  assert.equal(fullStatement.events[1].runningBalance, 0);

  assert.equal(fullStatement.events[2].type, 'bill');
  assert.equal(fullStatement.events[2].charge, 2200);
  assert.equal(fullStatement.events[2].runningBalance, 2200);

  assert.equal(fullStatement.events[3].type, 'payment');
  assert.equal(fullStatement.events[3].credit, 1500);
  assert.equal(fullStatement.events[3].runningBalance, 700);

  assert.equal(fullStatement.events[4].type, 'bill');
  assert.equal(fullStatement.events[4].charge, 2200);
  assert.equal(fullStatement.events[4].runningBalance, 2900);
});

test('formatCustomerStatement handles range filtering and calculates correct opening balance', () => {
  const customer = {
    id: 'c10',
    customerNumber: 10,
    name: 'Tariq',
    bills: [
      { id: 'b1', month: '2025-10', dueAmount: 1000, dueDate: '2025-10-05', payments: [{ id: 'p1', date: '2025-10-06', amount: 500, method: 'Cash' }] }, // net +500
      { id: 'b2', month: '2025-11', dueAmount: 1000, dueDate: '2025-11-05', payments: [{ id: 'p2', date: '2025-11-06', amount: 1000, method: 'Cash' }] }, // net 0
      { id: 'b3', month: '2026-03', dueAmount: 1200, dueDate: '2026-03-05', payments: [] } // net +1200
    ]
  };

  const refDate = new Date('2026-03-15T00:00:00Z');
  const statement3m = formatCustomerStatement(customer, { range: '3m', referenceDate: refDate });
  assert.equal(statement3m.openingBalance, 500); // 2025 bills net to +500
  assert.equal(statement3m.totalBilled, 1200);
  assert.equal(statement3m.currentBalance, 1700);

  // Null customer handling
  const emptyRes = formatCustomerStatement(null);
  assert.equal(emptyRes.customer, null);
  assert.equal(emptyRes.currentBalance, 0);
});

test('generateCustomerStatementHtml produces complete printable statement markup', () => {
  const statementData = {
    customer: { id: 'c1', customerNumber: 99, name: 'Shahid Khan', phone: '0300-1112233', area: 'Kot Mohalla', package: '20 Mbps', serviceStatus: 'active' },
    range: 'all',
    openingBalance: 0,
    totalBilled: 5000,
    totalPaid: 4000,
    currentBalance: 1000,
    events: [
      { date: '2026-02-05', type: 'bill', description: 'Monthly Bill (2026-02)', month: '2026-02', charge: 5000, credit: 0, runningBalance: 5000 },
      { date: '2026-02-08', type: 'payment', description: 'Payment Received · Cash', month: '2026-02', charge: 0, credit: 4000, runningBalance: 1000 }
    ]
  };

  const html = generateCustomerStatementHtml(statementData);
  assert.match(html, /SHAHDARA FIBER NET/);
  assert.match(html, /CUSTOMER ACCOUNT STATEMENT/);
  assert.match(html, /#99/);
  assert.match(html, /Shahid Khan/);
  assert.match(html, /Kot Mohalla/);
  assert.match(html, /Total Billed Charges/);
  assert.match(html, /PKR 5,000/);
  assert.match(html, /Total Payments Received/);
  assert.match(html, /PKR 4,000/);
  assert.match(html, /Ending Net Balance/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /ISP Authorized Representative/);
  assert.match(html, /Customer Signature/);

  // Empty statement
  assert.match(generateCustomerStatementHtml(null), /statement-empty/);
});

test('downloadCustomerStatementCsv generates RFC 4180 CSV with UTF-8 BOM and triggers download', () => {
  const statementData = {
    customer: { id: 'c1', customerNumber: 7, name: 'Bilal Ahmad' },
    range: 'all',
    events: [
      { date: '2026-01-05', type: 'bill', month: '2026-01', description: 'Monthly Bill', method: 'Billed', charge: 2500, credit: 0, runningBalance: 2500 },
      { date: '2026-01-10', type: 'payment', month: '2026-01', description: 'Payment Received', method: 'Cash', charge: 0, credit: 2500, runningBalance: 0 }
    ]
  };

  let downloadedFilename = '';
  let downloadedContent = '';

  const fakeLink = {
    setAttribute(k, v) {
      if (k === 'download') downloadedFilename = v;
      if (k === 'href') downloadedContent = v;
    },
    style: {},
    click() {}
  };

  const origBlob = globalThis.Blob;
  const origURL = globalThis.URL;

  try {
    globalThis.Blob = class {
      constructor(chunks) { this.content = chunks.join(''); }
    };
    globalThis.URL = {
      createObjectURL: (blob) => `blob:${blob.content}`,
      revokeObjectURL: () => {}
    };

    const fakeDoc = {
      createElement: () => fakeLink,
      body: { appendChild: () => {}, removeChild: () => {} }
    };

    const res = downloadCustomerStatementCsv(statementData, fakeDoc);
    assert.equal(res, true);
    assert.match(downloadedFilename, /^statement_Bilal_Ahmad_all_\d{4}-\d{2}-\d{2}\.csv$/);
    assert.match(downloadedContent, /Date,Type,Month,Description/);
    assert.match(downloadedContent, /2500/);

    // False when no statement
    assert.equal(downloadCustomerStatementCsv(null, fakeDoc), false);
  } finally {
    globalThis.Blob = origBlob;
    globalThis.URL = origURL;
  }
});

test('index.html and styles.css provide accessible customer account statement and thermal receipt support', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');

  assert.match(indexHtml, /id="openAccountStatementBtn"/);
  assert.match(indexHtml, /id="accountStatementModal"/);
  assert.match(indexHtml, /id="statementRangeSelect"/);
  assert.match(indexHtml, /id="printStatementBtn"/);
  assert.match(indexHtml, /id="downloadStatementCsvBtn"/);
  assert.match(indexHtml, /id="statementPreviewContainer"/);

  assert.match(stylesCss, /\.statement-modal/);
  assert.match(stylesCss, /\.customer-account-statement/);
  assert.match(stylesCss, /\.thermal-receipt-button/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.statement-modal/);
  assert.match(stylesCss, /body\.printing-statement/);
  assert.match(stylesCss, /body\.printing-thermal/);
  assert.match(stylesCss, /\.thermal-receipt/);
});

test('app.js integrates customer statement modal, thermal receipt printing, and phone input masking', () => {
  const appJs = read('app.js');
  assert.match(appJs, /formatCustomerStatement/);
  assert.match(appJs, /generateCustomerStatementHtml/);
  assert.match(appJs, /downloadCustomerStatementCsv/);
  assert.match(appJs, /renderAccountStatement/);
  assert.match(appJs, /#openAccountStatementBtn/);
  assert.match(appJs, /#accountStatementModal/);
  assert.match(appJs, /#statementRangeSelect/);
  assert.match(appJs, /#printStatementBtn/);
  assert.match(appJs, /#downloadStatementCsvBtn/);
  assert.match(appJs, /isThermal/);
  assert.match(appJs, /data-print-thermal-receipt/);
  assert.match(appJs, /wirePhoneInputMask/);
});

test('formatWhatsAppUrl formats local and international numbers into standard wa.me links with encoded text', () => {
  assert.equal(formatWhatsAppUrl('03001234567').url, 'https://wa.me/923001234567');
  assert.equal(formatWhatsAppUrl('+92 300 1234567').url, 'https://wa.me/923001234567');
  assert.equal(formatWhatsAppUrl('00923219876543').url, 'https://wa.me/923219876543');
  assert.equal(formatWhatsAppUrl('923001234567').url, 'https://wa.me/923001234567');
  assert.equal(formatWhatsAppUrl('0300-1234567').url, 'https://wa.me/923001234567');

  const withMsg = formatWhatsAppUrl('03001234567', 'Dear Customer, your bill is Rs. 2,000');
  assert.equal(withMsg.url, 'https://wa.me/923001234567?text=Dear%20Customer%2C%20your%20bill%20is%20Rs.%202%2C000');
  assert.equal(withMsg.validPhone, true);

  // Invalid or empty inputs return validPhone: false and empty url
  assert.equal(formatWhatsAppUrl('').validPhone, false);
  assert.equal(formatWhatsAppUrl('').url, '');
  assert.equal(formatWhatsAppUrl(null).validPhone, false);
  assert.equal(formatWhatsAppUrl(null).url, '');
  assert.equal(formatWhatsAppUrl('12345').validPhone, false);
  assert.equal(formatWhatsAppUrl('invalid-phone').validPhone, false);
});

test('buildPaymentReminderMessage generates templates for due, overdue, disconnection, payment, and welcome', () => {
  const customer = {
    id: 'cust-101',
    customerNumber: 101,
    name: 'Muhammad Tariq',
    phone: '03001234567',
    package: '20 Mbps Fiber',
    monthlyPrice: 2000,
    area: 'Shahdara Town'
  };

  const billingData = {
    month: '2026-10',
    billAmount: 2000,
    balance: 2000,
    dueDate: '10th of the month',
    paidAmount: 2000,
    paymentDate: '2026-10-15',
    packageName: '20 Mbps Fiber'
  };

  // Due template
  const dueMsg = buildPaymentReminderMessage({ customer, templateType: 'due', billingData, customNote: 'Please pay via JazzCash' });
  assert.match(dueMsg, /Muhammad Tariq/);
  assert.match(dueMsg, /2,000/);
  assert.match(dueMsg, /10th of the month/);
  assert.match(dueMsg, /Shahdara ISP/);
  assert.match(dueMsg, /Please pay via JazzCash/);

  // Overdue template
  const overdueMsg = buildPaymentReminderMessage({ customer, templateType: 'overdue', billingData });
  assert.match(overdueMsg, /Overdue Payment Notice/);
  assert.match(overdueMsg, /disruption/);

  // Disconnection notice
  const disconnMsg = buildPaymentReminderMessage({ customer, templateType: 'disconnection', billingData });
  assert.match(disconnMsg, /FINAL NOTICE/);
  assert.match(disconnMsg, /temporary disconnection/);

  // Payment confirmation
  const payMsg = buildPaymentReminderMessage({ customer, templateType: 'payment', billingData });
  assert.match(payMsg, /Payment Received/);
  assert.match(payMsg, /Thank you/);

  // Welcome template
  const welcomeMsg = buildPaymentReminderMessage({ customer, templateType: 'welcome', billingData });
  assert.match(welcomeMsg, /Welcome to Shahdara ISP/);
  assert.match(welcomeMsg, /20 Mbps Fiber/);

  // Fallback defaults when customer is null
  const defaultMsg = buildPaymentReminderMessage({ customer: null });
  assert.match(defaultMsg, /Valued Customer/);
});

test('generatePaymentReminderSlipHtml creates 80mm thermal slip with customer info, notice badge, and footer', () => {
  const customer = {
    id: 'cust-202',
    customerNumber: 202,
    name: 'Zahid Mahmood',
    phone: '0321-7654321',
    package: '30 Mbps Unlimited',
    monthlyPrice: 2500,
    area: 'Begum Kot'
  };

  const billingData = {
    month: '2026-10',
    balance: 2500,
    billAmount: 2500,
    dueDate: '2026-10-10'
  };

  const html = generatePaymentReminderSlipHtml({
    customer,
    templateType: 'overdue',
    billingData,
    customNote: 'Kindly clear your outstanding balance of Rs. 2,500 immediately.'
  });

  assert.match(html, /Shahdara ISP Network/);
  assert.match(html, /OVERDUE DUES NOTICE/);
  assert.match(html, /Zahid Mahmood/);
  assert.match(html, /#202/);
  assert.match(html, /0321-7654321/);
  assert.match(html, /Begum Kot/);
  assert.match(html, /PKR 2,500/);
  assert.match(html, /Kindly clear your outstanding balance/);
  assert.match(html, /Pay by due date to avoid service disconnection/);
});

test('generatePaymentReminderSlipHtml escapes HTML and safely falls back on missing data', () => {
  const unsafeCustomer = {
    id: 'cust-x',
    customerNumber: 999,
    name: '<script>alert("xss")</script> & Ahmad',
    phone: '0300-111<222>',
    area: 'Area <b>Bold</b>'
  };

  const html = generatePaymentReminderSlipHtml({
    customer: unsafeCustomer,
    templateType: 'due',
    billingData: {},
    customNote: '<b>Pay promptly</b> & smile'
  });

  // Verify dangerous tags are escaped
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp; Ahmad'));
  assert.ok(html.includes('&lt;222&gt;'));
  assert.ok(html.includes('Area &lt;b&gt;Bold&lt;/b&gt;'));
  assert.ok(html.includes('&lt;b&gt;Pay promptly&lt;/b&gt; &amp; smile'));
  assert.match(html, /MONTHLY BILL DUE REMINDER/);
});

test('formatWhatsAppUrl handles formatted strings with parentheses and dots', () => {
  const res1 = formatWhatsAppUrl('+92 (300) 123.4567');
  assert.equal(res1.validPhone, true);
  assert.equal(res1.url, 'https://wa.me/923001234567');

  const res2 = formatWhatsAppUrl('0092-321-9876543');
  assert.equal(res2.validPhone, true);
  assert.equal(res2.url, 'https://wa.me/923219876543');

  const res3 = formatWhatsAppUrl('(0300) 123-4567');
  assert.equal(res3.validPhone, true);
  assert.equal(res3.url, 'https://wa.me/923001234567');
});

test('index.html and styles.css provide accessible payment reminder modal, whatsapp button, and thermal print slip', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');

  assert.match(indexHtml, /id="openReminderModalBtn"/);
  assert.match(indexHtml, /id="paymentReminderModal"/);
  assert.match(indexHtml, /id="reminderTemplateSelect"/);
  assert.match(indexHtml, /id="reminderMessageText"/);
  assert.match(indexHtml, /id="reminderCharCount"/);
  assert.match(indexHtml, /id="reminderPhoneNotice"/);
  assert.match(indexHtml, /id="sendWhatsAppReminderBtn"/);
  assert.match(indexHtml, /id="copyReminderTextBtn"/);
  assert.match(indexHtml, /id="printReminderSlipBtn"/);

  assert.match(stylesCss, /\.reminder-modal/);
  assert.match(stylesCss, /\.reminder-modal-card/);
  assert.match(stylesCss, /\.reminder-customer-summary/);
  assert.match(stylesCss, /\.reminder-template-selector/);
  assert.match(stylesCss, /\.reminder-textarea/);
  assert.match(stylesCss, /\.whatsapp-button/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.reminder-modal-card/);
  assert.match(stylesCss, /body\.printing-reminder/);
  assert.match(stylesCss, /\.reminder-print-slip/);
});

test('app.js integrates payment reminder modal, live template preview, WhatsApp dispatch, and thermal print', () => {
  const appJs = read('app.js');
  assert.match(appJs, /formatWhatsAppUrl/);
  assert.match(appJs, /buildPaymentReminderMessage/);
  assert.match(appJs, /generatePaymentReminderSlipHtml/);
  assert.match(appJs, /openPaymentReminderModal/);
  assert.match(appJs, /openReminderBtn/);
  assert.match(appJs, /reminderModal/);
  assert.match(appJs, /reminderTemplateSelect/);
  assert.match(appJs, /reminderMessageText/);
  assert.match(appJs, /sendWhatsAppReminderBtn/);
  assert.match(appJs, /copyReminderTextBtn/);
  assert.match(appJs, /printReminderSlipBtn/);
  assert.match(appJs, /body\.classList\.add\('printing-reminder'\)/);
});

test('buildCustomerBillInvoiceData calculates itemized billing invoice, arrears, and net payable amount', async () => {
  const { buildCustomerBillInvoiceData } = await import('../form-validation.js');

  const customer = {
    id: 'cust-205',
    customerNumber: 205,
    name: 'Hamza Farooq',
    phone: '03211234567',
    mohalla: 'Chah Miran',
    zone: 'Zone B',
    packageSpeed: '30',
    serviceStatus: 'active',
    customDueDate: '2026-10-10',
    bills: [
      {
        id: 'bill-2026-08',
        month: '2026-08',
        dueAmount: 2500,
        payments: [{ id: 'p-1', amount: 2500 }]
      },
      {
        id: 'bill-2026-09',
        month: '2026-09',
        dueAmount: 2500,
        payments: [{ id: 'p-2', amount: 1000 }] // 1500 arrears
      },
      {
        id: 'bill-2026-10',
        month: '2026-10',
        dueAmount: 2500,
        dueDate: '2026-10-10',
        payments: []
      }
    ]
  };

  const invoice = buildCustomerBillInvoiceData(customer, '2026-10');
  assert.equal(invoice.isValid, true);
  assert.equal(invoice.customerNumber, '205');
  assert.equal(invoice.customerName, 'Hamza Farooq');
  assert.equal(invoice.billingMonth, '2026-10');
  assert.equal(invoice.invoiceNumber, 'INV-202610-205');
  assert.equal(invoice.monthlyCharge, 2500);
  assert.equal(invoice.arrears, 1500);
  assert.equal(invoice.payments, 0);
  assert.equal(invoice.netPayable, 4000); // 2500 current + 1500 arrears
  assert.equal(invoice.dueDate, '2026-10-10');
  assert.equal(invoice.status, 'UNPAID');

  // If a payment is recorded for current month
  customer.bills[2].payments.push({ id: 'p-3', amount: 2000 });
  const partialInvoice = buildCustomerBillInvoiceData(customer, '2026-10');
  assert.equal(partialInvoice.payments, 2000);
  assert.equal(partialInvoice.netPayable, 2000); // (2500-2000) + 1500 = 2000
  assert.equal(partialInvoice.status, 'PARTIAL');

  // Safe fallback for null/empty customer
  const nullInvoice = buildCustomerBillInvoiceData(null);
  assert.equal(nullInvoice.isValid, false);
  assert.equal(nullInvoice.netPayable, 0);
  assert.equal(nullInvoice.status, 'NO_BILL');
});

test('generateBillInvoiceHtml produces standard A4 sheet and 80mm thermal slip layouts', async () => {
  const { buildCustomerBillInvoiceData, generateBillInvoiceHtml } = await import('../form-validation.js');

  const customer = {
    id: 'cust-301',
    customerNumber: 301,
    name: 'Zahid Mahmood',
    phone: '03009876543',
    mohalla: 'Main Bazaar',
    zone: 'Zone 1',
    packageSpeed: '25',
    serviceStatus: 'active',
    bills: [
      {
        id: 'bill-2026-10',
        month: '2026-10',
        dueAmount: 2200,
        payments: []
      }
    ]
  };

  const data = buildCustomerBillInvoiceData(customer, '2026-10');

  // Standard A4 Layout
  const standardHtml = generateBillInvoiceHtml(data, { format: 'standard' });
  assert.match(standardHtml, /class="bill-invoice-sheet"/);
  assert.match(standardHtml, /Shahdara ISP Network/);
  assert.match(standardHtml, /INV-202610-301/);
  assert.match(standardHtml, /Zahid Mahmood/);
  assert.match(standardHtml, /Main Bazaar, Zone 1/);
  assert.match(standardHtml, /25 Mbps Fiber/);
  assert.match(standardHtml, /2,200/);
  assert.match(standardHtml, /Payment Instructions/);

  // 80mm Thermal POS Slip Layout
  const thermalHtml = generateBillInvoiceHtml(data, { format: 'thermal' });
  assert.match(thermalHtml, /class="bill-invoice-slip thermal-receipt"/);
  assert.match(thermalHtml, /MONTHLY BILL INVOICE/);
  assert.match(thermalHtml, /#301/);
  assert.match(thermalHtml, /TOTAL AMOUNT DUE/);
  assert.match(thermalHtml, /2,200/);
  assert.match(thermalHtml, /Billing Representative Signature/);

  // Fallback for empty data
  assert.match(generateBillInvoiceHtml(null), /empty-state/);
});

test('buildWhatsAppBillInvoiceText formats Urdu-English WhatsApp notification with breakdown', async () => {
  const { buildCustomerBillInvoiceData, buildWhatsAppBillInvoiceText } = await import('../form-validation.js');

  const customer = {
    id: 'cust-404',
    customerNumber: 404,
    name: 'Nasir Iqbal',
    phone: '03331122334',
    packageSpeed: '50',
    bills: [
      {
        month: '2026-09',
        dueAmount: 3000,
        payments: [{ amount: 1000 }]
      },
      {
        month: '2026-10',
        dueAmount: 3000,
        dueDate: '2026-10-05',
        payments: []
      }
    ]
  };

  const data = buildCustomerBillInvoiceData(customer, '2026-10');
  const waText = buildWhatsAppBillInvoiceText(data);

  assert.match(waText, /SHAHDARA ISP NETWORK - MONTHLY BILL INVOICE/);
  assert.match(waText, /Nasir Iqbal/);
  assert.match(waText, /#404/);
  assert.match(waText, /2026-10/);
  assert.match(waText, /INV-202610-404/);
  assert.match(waText, /رواں ماہ کے چارجز: PKR 3,000/);
  assert.match(waText, /پچھلے بقایا جات \(Arrears\): PKR 2,000/);
  assert.match(waText, /کل قابل ادا رقم \(Net Due\): PKR 5,000/);
  assert.match(waText, /2026-10-05/);
  assert.match(waText, /EasyPaisa \/ JazzCash/);

  // Fallback for invalid input
  assert.equal(buildWhatsAppBillInvoiceText(null), '');
});

test('index.html and styles.css provide customer bill invoice modal, triggers, and print layout', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');

  assert.match(indexHtml, /id="openBillInvoiceBtn"/);
  assert.match(indexHtml, /id="customerBillInvoiceModal"/);
  assert.match(indexHtml, /id="invoiceMonthSelect"/);
  assert.match(indexHtml, /id="invoiceFormatSelect"/);
  assert.match(indexHtml, /id="invoiceCustomNote"/);
  assert.match(indexHtml, /id="downloadInvoiceHtmlBtn"/);
  assert.match(indexHtml, /id="printBillInvoiceBtn"/);
  assert.match(indexHtml, /id="sendWhatsAppInvoiceBtn"/);
  assert.match(indexHtml, /id="copyInvoiceTextBtn"/);
  assert.match(indexHtml, /id="billInvoicePreviewContainer"/);

  assert.match(stylesCss, /\.invoice-modal/);
  assert.match(stylesCss, /\.invoice-modal-card/);
  assert.match(stylesCss, /\.bill-invoice-sheet/);
  assert.match(stylesCss, /\.invoice-table/);
  assert.match(stylesCss, /\.bill-invoice-slip\.thermal-receipt/);
  assert.match(stylesCss, /body\.printing-invoice/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.invoice-modal/);
});

test('app.js integrates customer bill invoice modal, format switcher, printing, and WhatsApp dispatch', () => {
  const appJs = read('app.js');

  assert.match(appJs, /buildCustomerBillInvoiceData/);
  assert.match(appJs, /generateBillInvoiceHtml/);
  assert.match(appJs, /buildWhatsAppBillInvoiceText/);
  assert.match(appJs, /generateStandaloneInvoiceDocument/);
  assert.match(appJs, /downloadHtmlFile/);
  assert.match(appJs, /openCustomerBillInvoiceModal/);
  assert.match(appJs, /renderBillInvoiceContent/);
  assert.match(appJs, /openInvoiceBtn/);
  assert.match(appJs, /invoiceModal/);
  assert.match(appJs, /invoiceMonthSelect/);
  assert.match(appJs, /invoiceFormatSelect/);
  assert.match(appJs, /invoiceCustomNote/);
  assert.match(appJs, /downloadInvoiceHtmlBtn/);
  assert.match(appJs, /printInvoiceBtn/);
  assert.match(appJs, /sendWhatsAppInvoiceBtn/);
  assert.match(appJs, /copyInvoiceTextBtn/);
  assert.match(appJs, /body\.classList\.add\('printing-invoice'\)/);
});

test('generateStandaloneInvoiceDocument embeds complete CSS styles and standalone HTML structure', async () => {
  const { buildCustomerBillInvoiceData, generateStandaloneInvoiceDocument } = await import('../form-validation.js');

  const customer = {
    id: 'cust-401',
    customerNumber: 401,
    name: 'Muhammad Aslam',
    phone: '03001234567',
    mohalla: 'Kot Mohibbu',
    zone: 'Zone C',
    packageSpeed: '40',
    serviceStatus: 'active',
    bills: [{ id: 'b-401', month: '2026-10', dueAmount: 3000, payments: [] }]
  };

  const data = buildCustomerBillInvoiceData(customer, '2026-10');
  const docHtml = generateStandaloneInvoiceDocument(data, {
    format: 'standard',
    customNote: 'Please pay by 10th October.'
  });

  assert.match(docHtml, /<!DOCTYPE html>/i);
  assert.match(docHtml, /<html lang="en">/i);
  assert.match(docHtml, /<title>Invoice - INV-202610-401 - Shahdara ISP<\/title>/);
  assert.match(docHtml, /Please pay by 10th October\./);
  assert.match(docHtml, /\.bill-invoice-sheet/);
  assert.match(docHtml, /window\.print\(\)/);

  // Fallback for empty data
  const fallbackDoc = generateStandaloneInvoiceDocument(null);
  assert.match(fallbackDoc, /<!DOCTYPE html>/i);
});

test('downloadHtmlFile safely triggers a simulated browser download and handles headless environments gracefully', async () => {
  const { downloadHtmlFile } = await import('../form-validation.js');

  // When doc is not passed or undefined in Node environment
  assert.doesNotThrow(() => {
    downloadHtmlFile('test.html', '<h1>Test</h1>', null);
  });

  // With a mock document
  let clickTriggered = false;
  let revoked = false;
  const mockAnchor = {
    style: {},
    setAttribute: (name, val) => { mockAnchor[name] = val; },
    click: () => { clickTriggered = true; }
  };
  const mockDoc = {
    createElement: (tag) => {
      assert.equal(tag, 'a');
      return mockAnchor;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };

  const origURL = globalThis.URL;
  globalThis.URL = {
    createObjectURL: (blob) => 'blob:mock-url',
    revokeObjectURL: (url) => { revoked = true; }
  };

  try {
    downloadHtmlFile('invoice.html', '<html>content</html>', mockDoc);
    assert.equal(clickTriggered, true);
    assert.equal(revoked, true);
    assert.equal(mockAnchor.download, 'invoice.html');
  } finally {
    globalThis.URL = origURL;
  }
});

test('custom notes are reflected in standard invoice, thermal slip, and WhatsApp dispatch text', async () => {
  const { buildCustomerBillInvoiceData, generateBillInvoiceHtml, buildWhatsAppBillInvoiceText } = await import('../form-validation.js');

  const customer = {
    id: 'cust-501',
    customerNumber: 501,
    name: 'Tariq Javed',
    phone: '03007654321',
    bills: [{ id: 'b-1', month: '2026-10', dueAmount: 1800, payments: [] }]
  };

  const data = buildCustomerBillInvoiceData(customer, '2026-10');
  const customNote = 'Speed doubled for 3 months promotion! شکریہ';

  const standardHtml = generateBillInvoiceHtml(data, { format: 'standard', customNote });
  assert.match(standardHtml, /Speed doubled for 3 months promotion! شکریہ/);

  const thermalHtml = generateBillInvoiceHtml(data, { format: 'thermal', customNote });
  assert.match(thermalHtml, /Speed doubled for 3 months promotion! شکریہ/);

  const waText = buildWhatsAppBillInvoiceText(data, customNote);
  assert.match(waText, /Speed doubled for 3 months promotion! شکریہ/);
});



