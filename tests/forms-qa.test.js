import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePakistanPhone, validatePositiveAmount, validateCustomerName, validateTransactionDate, paginateRows, calculateTransactionSummary,
  saveFormDraft, loadFormDraft, clearFormDraft, hasFormDraft, wireFormDraftAutosave, generateCsvContent, downloadCsvFile, generateBatchReceiptHtml,
  maskPakistanPhone, wirePhoneInputMask, formatCustomerStatement, generateCustomerStatementHtml, downloadCustomerStatementCsv,
  formatWhatsAppUrl, buildPaymentReminderMessage, generatePaymentReminderSlipHtml,
  reconcileCustomerLedger, generateLedgerAuditReport, generateLedgerAuditCsv, generateLedgerAuditPrintHtml,
  calculateDenominationTotal, buildDailyRegisterData, formatDailyRegisterWhatsAppText, generateDailyRegisterCsv, generateDailyRegisterPrintHtml, setupDailyRegisterModal,
  ADJUSTMENT_VOUCHERS_KEY, ADJUSTMENT_CATEGORIES, calculateOutageCredit, validateAdjustmentVoucher, buildAdjustmentVoucherData, formatAdjustmentVoucherWhatsApp,
  generateAdjustmentLedgerCsv, generateAdjustmentVoucherHtml, getSavedAdjustmentVouchers, saveAdjustmentVoucher, setupAdjustmentVoucherModal
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

test('index.html, styles.css, and app.js provide markup, styles, and wiring for customer ledger audit', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // HTML assertions
  assert.match(indexHtml, /id="openLedgerAuditBtn"/);
  assert.match(indexHtml, /<dialog id="customerLedgerAuditModal" class="modal audit-modal"/);
  assert.match(indexHtml, /id="closeLedgerAuditModalBtn"/);
  assert.match(indexHtml, /id="auditStatusPill"/);
  assert.match(indexHtml, /id="auditTotalBilledVal"/);
  assert.match(indexHtml, /id="auditTotalPaidVal"/);
  assert.match(indexHtml, /id="auditOutstandingVal"/);
  assert.match(indexHtml, /id="auditUnappliedCreditVal"/);
  assert.match(indexHtml, /id="auditDiscrepancyBox"/);
  assert.match(indexHtml, /id="auditDiscrepancyList"/);
  assert.match(indexHtml, /id="auditTableBody"/);
  assert.match(indexHtml, /id="printLedgerAuditBtn"/);
  assert.match(indexHtml, /id="copyLedgerAuditReportBtn"/);
  assert.match(indexHtml, /id="exportLedgerAuditCsvBtn"/);

  // Styles assertions
  assert.match(stylesCss, /\.audit-modal\s*\{/);
  assert.match(stylesCss, /\.audit-kpi-card\s*\{/);
  assert.match(stylesCss, /\.audit-status-badge\s*\{/);
  assert.match(stylesCss, /\.audit-pill-clean\s*\{/);
  assert.match(stylesCss, /\.audit-pill-danger\s*\{/);
  assert.match(stylesCss, /\[data-theme="dark"\]\s*\.audit-modal/);
  assert.match(stylesCss, /@media print[\s\S]*?body\.printing-audit\s*#customerLedgerAuditModal/);

  // App assertions
  assert.match(appJs, /reconcileCustomerLedger/);
  assert.match(appJs, /generateLedgerAuditReport/);
  assert.match(appJs, /generateLedgerAuditCsv/);
  assert.match(appJs, /renderLedgerAuditModal/);
  assert.match(appJs, /openLedgerAuditBtn\.addEventListener/);
  assert.match(appJs, /printLedgerAuditBtn\.addEventListener/);
  assert.match(appJs, /copyLedgerAuditReportBtn\.addEventListener/);
  assert.match(appJs, /exportLedgerAuditCsvBtn\.addEventListener/);
});

test('reconcileCustomerLedger identifies clean balanced accounts and detects discrepancies', () => {
  // 1. Clean customer
  const cleanCustomer = {
    id: 'cust-101',
    customerNumber: 101,
    name: 'Hamza Farooq',
    phone: '03001112233',
    serviceStatus: 'active',
    bills: [
      { id: 'b-1', month: '2026-08', dueAmount: 2000, paid: true, payments: [{ id: 'p-1', amount: 2000, date: '2026-08-05' }] },
      { id: 'b-2', month: '2026-09', dueAmount: 2000, paid: true, payments: [{ id: 'p-2', amount: 2000, date: '2026-09-04' }] }
    ]
  };
  const cleanResult = reconcileCustomerLedger(cleanCustomer);
  assert.equal(cleanResult.reconciliationStatus, 'CLEAN');
  assert.equal(cleanResult.totalBilled, 4000);
  assert.equal(cleanResult.totalPaid, 4000);
  assert.equal(cleanResult.netOutstanding, 0);
  assert.equal(cleanResult.unappliedCredit, 0);
  assert.equal(cleanResult.monthsPaidCount, 2);
  assert.equal(cleanResult.discrepancyCount, 0);
  assert.equal(cleanResult.auditRows.length, 2);
  assert.equal(cleanResult.auditRows[0].status, 'PAID');

  // 2. Customer with overdue arrears and lingering partial
  const arrearsCustomer = {
    id: 'cust-102',
    customerNumber: 102,
    name: 'Bilal Ahmad',
    serviceStatus: 'active',
    bills: [
      { id: 'b-1', month: '2026-08', dueAmount: 2500, paid: false, payments: [{ id: 'p-1', amount: 1500, date: '2026-08-10' }] },
      { id: 'b-2', month: '2026-09', dueAmount: 2500, paid: false, payments: [] }
    ]
  };
  const arrearsResult = reconcileCustomerLedger(arrearsCustomer);
  assert.equal(arrearsResult.reconciliationStatus, 'ARREARS_PENDING');
  assert.equal(arrearsResult.totalBilled, 5000);
  assert.equal(arrearsResult.totalPaid, 1500);
  assert.equal(arrearsResult.netOutstanding, 3500);
  assert.equal(arrearsResult.monthsPartialCount, 1);
  assert.equal(arrearsResult.monthsPendingCount, 1);
  assert.ok(arrearsResult.discrepancies.some(d => d.type === 'LINGERING_PARTIAL'));
  assert.ok(arrearsResult.discrepancies.some(d => d.type === 'OVERDUE_ARREARS'));

  // 3. Customer with advance credit surplus
  const surplusCustomer = {
    id: 'cust-103',
    customerNumber: 103,
    name: 'Zainab Bibi',
    serviceStatus: 'active',
    bills: [
      { id: 'b-1', month: '2026-09', dueAmount: 1800, paid: true, payments: [{ id: 'p-1', amount: 3000, date: '2026-09-02' }] }
    ]
  };
  const surplusResult = reconcileCustomerLedger(surplusCustomer);
  assert.equal(surplusResult.reconciliationStatus, 'CREDIT_SURPLUS');
  assert.equal(surplusResult.unappliedCredit, 1200);
  assert.ok(surplusResult.discrepancies.some(d => d.type === 'SURPLUS_CREDIT'));

  // 4. Delayed payment timing check (settled 4 months later)
  const delayedCustomer = {
    id: 'cust-104',
    name: 'Kamran Ali',
    serviceStatus: 'active',
    bills: [
      { id: 'b-1', month: '2026-04', dueAmount: 2000, paid: true, payments: [{ id: 'p-1', amount: 2000, date: '2026-08-15' }] }
    ]
  };
  const delayedResult = reconcileCustomerLedger(delayedCustomer);
  assert.ok(delayedResult.discrepancies.some(d => d.type === 'DELAYED_PAYMENT'));

  // 5. Multiple receipts on same date check
  const dupReceiptCustomer = {
    id: 'cust-105',
    name: 'Rashid Mehmood',
    bills: [
      {
        id: 'b-1', month: '2026-09', dueAmount: 3000, paid: true,
        payments: [
          { id: 'p-1', amount: 1500, date: '2026-09-05' },
          { id: 'p-2', amount: 1500, date: '2026-09-05' }
        ]
      }
    ]
  };
  const dupResult = reconcileCustomerLedger(dupReceiptCustomer);
  assert.ok(dupResult.discrepancies.some(d => d.type === 'DUPLICATE_RECEIPT_DATE'));

  // 6. Active customer with 0 bills
  const unbilledActive = {
    id: 'cust-106',
    name: 'New Subscriber',
    serviceStatus: 'active',
    bills: []
  };
  const unbilledResult = reconcileCustomerLedger(unbilledActive);
  assert.ok(unbilledResult.discrepancies.some(d => d.type === 'ACTIVE_UNBILLED'));

  // 7. Null customer handling
  const nullResult = reconcileCustomerLedger(null);
  assert.equal(nullResult.customer, null);
  assert.equal(nullResult.totalBilled, 0);
  assert.equal(nullResult.discrepancyCount, 0);
});

test('generateLedgerAuditReport formats comprehensive text briefing report', () => {
  const customer = {
    id: 'cust-201',
    customerNumber: 201,
    name: 'Usman Ghani',
    phone: '03219876543',
    area: 'Mohalla Sheikhan',
    bills: [
      { id: 'b-1', month: '2026-08', dueAmount: 2200, paid: true, payments: [{ id: 'p-1', amount: 2200, date: '2026-08-05' }] },
      { id: 'b-2', month: '2026-09', dueAmount: 2200, paid: false, payments: [{ id: 'p-2', amount: 1000, date: '2026-09-07' }] }
    ]
  };

  const auditResult = reconcileCustomerLedger(customer);
  const report = generateLedgerAuditReport(auditResult, customer);

  assert.match(report, /SHAHDARA ISP BILLING · CUSTOMER LEDGER AUDIT REPORT/);
  assert.match(report, /Customer:\s*Usman Ghani/);
  assert.match(report, /ID:\s*#201/);
  assert.match(report, /03219876543/);
  assert.match(report, /Mohalla Sheikhan/);
  assert.match(report, /Total Billed:\s*PKR 4,400/);
  assert.match(report, /Total Collected:\s*PKR 3,200/);
  assert.match(report, /Net Outstanding:\s*PKR 1,200/);
  assert.match(report, /AUDIT DISCREPANCIES & FINDINGS/);
  assert.match(report, /MONTHLY LEDGER BREAKDOWN/);
  assert.match(report, /2026-08/);
  assert.match(report, /2026-09/);

  // Null input handles gracefully
  assert.equal(generateLedgerAuditReport(null), '');
});

test('generateLedgerAuditCsv outputs valid RFC-4180 CSV with UTF-8 BOM and correct columns', () => {
  const customer = {
    id: 'cust-301',
    customerNumber: 301,
    name: 'Shahid Nadeem',
    bills: [
      { id: 'b-1', month: '2026-08', dueAmount: 1500, dueDate: '2026-08-05', paid: true, payments: [{ id: 'p-1', amount: 1500, date: '2026-08-04' }] },
      { id: 'b-2', month: '2026-09', dueAmount: 1500, dueDate: '2026-09-05', paid: false, payments: [] }
    ]
  };

  const auditResult = reconcileCustomerLedger(customer);
  const csv = generateLedgerAuditCsv(auditResult, customer);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Month,Month_Label,Due_Date,Billed_PKR,Paid_PKR,Balance_Due_PKR,Status,Receipts_Count/);
  assert.match(csv, /2026-08,August 2026,2026-08-05,1500,1500,0,PAID,1/);
  assert.match(csv, /2026-09,September 2026,2026-09-05,1500,0,1500,PENDING,0/);

  // Null input handles gracefully
  assert.equal(generateLedgerAuditCsv(null), '');
});

test('generateLedgerAuditPrintHtml creates printable document structure with signatures', () => {
  const customer = {
    id: 'cust-401',
    customerNumber: 401,
    name: 'Farhan Akhtar',
    phone: '03334445566',
    area: 'Railway Road',
    serviceStatus: 'active',
    packageSpeed: '25 Mbps',
    bills: [
      { id: 'b-1', month: '2026-09', dueAmount: 2500, dueDate: '2026-09-05', paid: true, payments: [{ id: 'p-1', amount: 2500, date: '2026-09-03' }] }
    ]
  };

  const auditResult = reconcileCustomerLedger(customer);
  const html = generateLedgerAuditPrintHtml(auditResult, customer);

  assert.match(html, /SHAHDARA ISP NETWORKS/);
  assert.match(html, /Customer Ledger Reconciliation &amp; Financial Quality Assurance Audit/);
  assert.match(html, /Farhan Akhtar/);
  assert.match(html, /#401/);
  assert.match(html, /03334445566/);
  assert.match(html, /Railway Road/);
  assert.match(html, /TOTAL BILLED/);
  assert.match(html, /TOTAL COLLECTED/);
  assert.match(html, /NET BALANCE DUE/);
  assert.match(html, /audit-print-table/);
  assert.match(html, /September 2026/);
  assert.match(html, /Accounting Auditor \/ QA Officer/);
  assert.match(html, /Network Operations Director/);

  // Null input handles gracefully
  assert.equal(generateLedgerAuditPrintHtml(null), '');
});

test('calculateDenominationTotal accurately tallies Pakistani currency notes', () => {
  // Test standard denominations breakdown
  assert.equal(calculateDenominationTotal({}), 0);
  assert.equal(calculateDenominationTotal(null), 0);

  // Test full till count
  const denoms = {
    5000: 4,  // 20,000
    1000: 15, // 15,000
    500: 8,   // 4,000
    100: 25,  // 2,500
    50: 10,   // 500
    20: 20,   // 400
    10: 10    // 100
  };
  const countTotal = calculateDenominationTotal(denoms);
  // Expected: 20000 + 15000 + 4000 + 2500 + 500 + 400 + 100 = 42,500
  assert.equal(countTotal, 42500);

  // Negative or invalid counts ignored safely
  const invalidRes = calculateDenominationTotal({ 5000: -2, 1000: 'abc', 500: 2 });
  assert.equal(invalidRes, 1000);
});

test('buildDailyRegisterData reconciles collections, operational expenses, and physical cash count', () => {
  const dummyState = {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 1,
        name: 'Rashid Ali',
        bills: [
          {
            id: 'b-1',
            month: '2026-10',
            payments: [
              { id: 'p-1', amount: 2000, date: '2026-10-16', method: 'Cash' },
              { id: 'p-2', amount: 500, date: '2026-10-15', method: 'Cash' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 2,
        name: 'Usman Ghani',
        bills: [
          {
            id: 'b-2',
            month: '2026-10',
            payments: [
              { id: 'p-3', amount: 3500, date: '2026-10-16T11:30:00.000Z', method: 'JazzCash' }
            ]
          }
        ]
      },
      {
        id: 'cust-3',
        customerNumber: 3,
        name: 'Naveed Akhtar',
        bills: [
          {
            id: 'b-3',
            month: '2026-10',
            payments: [
              { id: 'p-4', amount: 1500, date: '2026-10-16', method: 'Bank Transfer' }
            ]
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-1', date: '2026-10-16', category: 'Fiber Splice Repair', notes: 'Main street cut', amount: 1200 },
      { id: 'exp-2', date: '2026-10-16', category: 'Fuel / Bike Petrol', notes: 'Line team', amount: 800 },
      { id: 'exp-3', date: '2026-10-15', category: 'Tea & Refreshment', notes: 'Office staff', amount: 400 }
    ]
  };

  // Case 1: Balanced Till
  // Opening: 5,000
  // Cash In: 2,000 (Rashid Ali)
  // Digital In: 3,500 (JazzCash) + 1,500 (Bank) = 5,000
  // Expenses: 1,200 + 800 = 2,000
  // Net physical cash expected: 5,000 + 2,000 - 2,000 = 5,000
  // Physical count: 1x 5000 note = 5,000
  const regBalanced = buildDailyRegisterData(dummyState, '2026-10-16', {
    openingCash: 5000,
    denominations: { 5000: 1 }
  });

  assert.equal(regBalanced.date, '2026-10-16');
  assert.equal(regBalanced.openingCash, 5000);
  assert.equal(regBalanced.totalCollections, 7000);
  assert.equal(regBalanced.cashCollections, 2000);
  assert.equal(regBalanced.digitalCollections, 5000);
  assert.equal(regBalanced.totalExpenses, 2000);
  assert.equal(regBalanced.netPhysicalCash, 5000);
  assert.equal(regBalanced.physicalCountTotal, 5000);
  assert.equal(regBalanced.cashVariance, 0);
  assert.equal(regBalanced.varianceStatus, 'balanced');
  assert.match(regBalanced.varianceLabel, /Balanced/i);
  assert.equal(regBalanced.transactionCount, 3);
  assert.equal(regBalanced.expenseCount, 2);

  // Case 2: Cash Over (physical > calculated)
  const regOver = buildDailyRegisterData(dummyState, '2026-10-16', {
    openingCash: 5000,
    denominations: { 5000: 1, 500: 1 } // 5,500 -> 500 over
  });
  assert.equal(regOver.cashVariance, 500);
  assert.ok(regOver.varianceStatus === 'surplus' || regOver.varianceStatus === 'over');
  assert.match(regOver.varianceLabel, /Surplus|Over/i);

  // Case 3: Cash Short (physical < calculated)
  const regShort = buildDailyRegisterData(dummyState, '2026-10-16', {
    openingCash: 5000,
    denominations: { 1000: 4 } // 4,000 -> 1,000 short
  });
  assert.equal(regShort.cashVariance, -1000);
  assert.ok(regShort.varianceStatus === 'deficit' || regShort.varianceStatus === 'short');
  assert.match(regShort.varianceLabel, /Deficit|Short/i);

  // Handles empty or null inputs gracefully
  const emptyReg = buildDailyRegisterData(null, null);
  assert.equal(emptyReg.totalCollections, 0);
  assert.equal(emptyReg.totalExpenses, 0);
  assert.equal(emptyReg.netPhysicalCash, 0);
});

test('formatDailyRegisterWhatsAppText creates formatted WhatsApp briefing', () => {
  const dummyData = {
    date: '2026-10-16',
    openingCash: 3000,
    totalCollections: 12500,
    cashCollections: 7500,
    digitalCollections: 5000,
    totalExpenses: 2500,
    netPhysicalCash: 8000,
    physicalCountTotal: 8000,
    cashVariance: 0,
    varianceStatus: 'balanced',
    varianceLabel: '✓ BALANCED (PKR 0)',
    transactionCount: 5,
    expenseCount: 2
  };

  const text = formatDailyRegisterWhatsAppText(dummyData);
  assert.match(text, /SHAHDARA.*DAILY REGISTER/i);
  assert.match(text, /2026-10-16/);
  assert.match(text, /3,000/);
  assert.match(text, /7,500/);
  assert.match(text, /5,000/);
  assert.match(text, /2,500/);
  assert.match(text, /8,000/);
  assert.match(text, /12,500/);

  // Null input handles gracefully
  assert.equal(formatDailyRegisterWhatsAppText(null), '');
});

test('generateDailyRegisterCsv creates multi-section CSV export', () => {
  const dummyData = {
    date: '2026-10-16',
    openingCash: 2000,
    totalCollections: 5000,
    cashCollections: 3000,
    digitalCollections: 2000,
    totalExpenses: 1000,
    netPhysicalCash: 4000,
    physicalCountTotal: 4000,
    cashVariance: 0,
    varianceStatus: 'balanced',
    varianceLabel: '✓ BALANCED',
    payments: [
      { id: 'p-1', customerNumber: 101, customerName: 'Zahid Mahmood', billMonth: '2026-10', amount: 3000, method: 'Cash' }
    ],
    expenses: [
      { id: 'exp-1', category: 'Fuel', notes: 'Line team petrol', amount: 1000 }
    ],
    denominationBreakdown: [
      { denomination: 1000, count: 4, subtotal: 4000 }
    ]
  };

  const csv = generateDailyRegisterCsv(dummyData);
  assert.match(csv, /SUMMARY,Register_Date,2026-10-16/);
  assert.match(csv, /SUMMARY,Opening_Cash_Float,2000/);
  assert.match(csv, /SUMMARY,Net_Physical_Cash_Expected,4000/);
  assert.match(csv, /SUMMARY,Cash_Variance,0/);
  assert.match(csv, /COLLECTION,101,Zahid Mahmood,2026-10,Cash,3000/);
  assert.match(csv, /EXPENSE,,,,Fuel,1000/);

  // Null input handles gracefully
  assert.equal(generateDailyRegisterCsv(null), '');
});

test('generateDailyRegisterPrintHtml creates complete printable statement document', () => {
  const dummyState = {
    customers: [
      {
        id: 'cust-12',
        customerNumber: 12,
        name: 'Hamza Malik',
        bills: [
          {
            id: 'b-1',
            month: '2026-10',
            payments: [{ id: 'p-1', amount: 10000, date: '2026-10-16', method: 'Cash' }]
          }
        ]
      }
    ],
    expenses: [
      { id: 'exp-1', date: '2026-10-16', category: 'Splicing Sleeve Pack', notes: 'Core maintenance', amount: 3000 }
    ]
  };

  const regData = buildDailyRegisterData(dummyState, '2026-10-16', {
    openingCash: 5000,
    denominations: { 5000: 2, 1000: 2 }
  });

  const html = generateDailyRegisterPrintHtml(regData);
  assert.match(html, /SHAHDARA BROADBAND &amp; ISP NETWORKS/);
  assert.match(html, /Daily Cash Register &amp; Day-End Closing Statement/);
  assert.match(html, /روزنامچہ کیش رجسٹر/);
  assert.match(html, /Hamza Malik/);
  assert.match(html, /Splicing Sleeve Pack/);
  assert.match(html, /Net Physical Cash/);
  assert.match(html, /PKR 5,000/);
  assert.match(html, /Cashier \/ Field Collector Signature/);
  assert.match(html, /Managing Accountant \(Saad \/ Umair\)/);

  // Null input handles gracefully
  assert.equal(generateDailyRegisterPrintHtml(null), '');
});

test('setupDailyRegisterModal initializes and exposes controller interface', () => {
  // Test fallback safe controller when DOM elements are not present
  const dummyStorage = {
    store: {},
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = String(v); }
  };

  const controller = setupDailyRegisterModal({
    getState: () => ({ customers: [], expenses: [] }),
    storage: dummyStorage
  });

  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.setDate, 'function');
  assert.equal(typeof controller.refresh, 'function');
  assert.equal(typeof controller.getData, 'function');

  // Calling methods does not throw
  controller.open('2026-10-16');
  controller.setDate('2026-10-17');
  controller.refresh();
  controller.close();
});

test('DOM & CSS integration for daily cash register modal', () => {
  const freshIndex = read('index.html');
  const freshApp = read('app.js');
  const freshStyles = read('styles.css');

  // index.html
  assert.match(freshIndex, /id="dailyCashRegisterModal"/);
  assert.match(freshIndex, /id="closeDailyRegisterModalBtn"/);
  assert.match(freshIndex, /id="registerDateInput"/);
  assert.match(freshIndex, /id="registerOpeningCash"/);
  assert.match(freshIndex, /id="registerNetCashVal"/);
  assert.match(freshIndex, /id="registerDigitalTotalVal"/);
  assert.match(freshIndex, /id="registerTotalInflowsVal"/);
  assert.match(freshIndex, /id="registerTotalExpensesVal"/);
  assert.match(freshIndex, /id="registerPhysicalCountVal"/);
  assert.match(freshIndex, /id="registerVarianceBadge"/);
  assert.match(freshIndex, /id="noteCount5000"/);
  assert.match(freshIndex, /id="noteCount1000"/);
  assert.match(freshIndex, /id="noteCount500"/);
  assert.match(freshIndex, /id="noteCount100"/);
  assert.match(freshIndex, /id="noteCount50"/);
  assert.match(freshIndex, /id="noteCount20"/);
  assert.match(freshIndex, /id="noteCount10"/);
  assert.match(freshIndex, /id="registerReceiptsTableBody"/);
  assert.match(freshIndex, /id="registerExpensesTableBody"/);
  assert.match(freshIndex, /id="printDailyRegisterBtn"/);
  assert.match(freshIndex, /id="sendWhatsAppRegisterBtn"/);
  assert.match(freshIndex, /id="exportDailyRegisterCsvBtn"/);
  assert.match(freshIndex, /id="copyRegisterTextBtn"/);
  assert.match(freshIndex, /id="quickActionDailyClosingSlip"/);
  assert.match(freshIndex, /id="quickActionDailyRegisterTile"/);

  // app.js
  assert.match(freshApp, /setupDailyRegisterModal/);
  assert.match(freshApp, /dailyRegisterController/);
  assert.match(freshApp, /#dailyCashRegisterModal/);

  // styles.css
  assert.match(freshStyles, /\.register-modal/);
  assert.match(freshStyles, /\.register-summary-ribbon/);
  assert.match(freshStyles, /\.register-denominations-card/);
  assert.match(freshStyles, /\.denomination-inputs-grid/);
  assert.match(freshStyles, /\.register-tables-split/);
  assert.match(freshStyles, /\.status-balanced/);
  assert.match(freshStyles, /\.status-over/);
  assert.match(freshStyles, /\.status-short/);
  assert.match(freshStyles, /body\.printing-register/);
});

/* ==========================================================================
   CUSTOMER ACCOUNT ADJUSTMENT & OUTAGE VOUCHER TEST SUITE
   ========================================================================== */

test('calculateOutageCredit prorates monthly rate based on downtime days and hours', () => {
  // 1500 PKR monthly package with 30 days month: 50 PKR/day, 2.083 PKR/hour
  // 3 days downtime
  const creditDays = calculateOutageCredit(1500, { days: 3, hours: 0, daysInMonth: 30 });
  assert.equal(creditDays, 150);

  // 12 hours downtime
  const creditHours = calculateOutageCredit(1500, { days: 0, hours: 12, daysInMonth: 30 });
  assert.equal(creditHours, 25);

  // Combined 2 days and 6 hours downtime
  // (2 * 50) + (6 * 2.0833) = 100 + 12.5 = 112.5 -> rounds to 113
  const creditCombined = calculateOutageCredit(1500, { days: 2, hours: 6, daysInMonth: 30 });
  assert.equal(creditCombined, 113);

  // Boundary cases: 0 days, 0 hours, 0 rate, clamped to monthly rate
  assert.equal(calculateOutageCredit(0, { days: 5 }), 0);
  assert.equal(calculateOutageCredit(1500, { days: 0, hours: 0 }), 0);
  assert.equal(calculateOutageCredit(1500, { days: 40 }), 1500); // cannot exceed full monthly rate
});

test('validateAdjustmentVoucher enforces required fields, positive amounts, and length constraints', () => {
  // Valid voucher
  const validRes = validateAdjustmentVoucher({
    customerId: 'cust-123',
    amount: 500,
    category: 'downtime_credit',
    reason: 'Main feeder fiber cut repaired',
    authorizedBy: 'Saad (Director)'
  });
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});

  // Missing customer
  const noCust = validateAdjustmentVoucher({
    customerId: '',
    amount: 500,
    category: 'downtime_credit',
    reason: 'Valid reason here',
    authorizedBy: 'Saad'
  });
  assert.equal(noCust.valid, false);
  assert.match(noCust.errors.customerId, /Customer is required/);

  // Invalid amounts
  assert.equal(validateAdjustmentVoucher({ customerId: 'c1', amount: 0, category: 'custom', reason: 'Valid reason', authorizedBy: 'Saad' }).valid, false);
  assert.equal(validateAdjustmentVoucher({ customerId: 'c1', amount: -200, category: 'custom', reason: 'Valid reason', authorizedBy: 'Saad' }).valid, false);
  assert.equal(validateAdjustmentVoucher({ customerId: 'c1', amount: 150000, category: 'custom', reason: 'Valid reason', authorizedBy: 'Saad' }).valid, false);
  assert.equal(validateAdjustmentVoucher({ customerId: 'c1', amount: 'abc', category: 'custom', reason: 'Valid reason', authorizedBy: 'Saad' }).valid, false);

  // Short reason (< 5 characters)
  const shortReason = validateAdjustmentVoucher({
    customerId: 'c1',
    amount: 300,
    category: 'custom',
    reason: 'Fix',
    authorizedBy: 'Saad'
  });
  assert.equal(shortReason.valid, false);
  assert.match(shortReason.errors.reason, /at least 5 characters/);

  // Short authorizer (< 2 characters)
  const shortAuth = validateAdjustmentVoucher({
    customerId: 'c1',
    amount: 300,
    category: 'custom',
    reason: 'Legitimate reason note',
    authorizedBy: 'S'
  });
  assert.equal(shortAuth.valid, false);
  assert.match(shortAuth.errors.authorizedBy, /at least 2 characters/);
});

test('buildAdjustmentVoucherData constructs complete immutable voucher record with projected balance', () => {
  const mockCustomer = {
    id: 'cust-99',
    customerNumber: 42,
    name: 'Raja Tariq',
    phone: '03001234567',
    mohalla: 'Main Bazaar',
    bills: [
      { id: 'b1', month: '2026-09', dueAmount: 1500, payments: [{ amount: 1500 }] }, // balance 0
      { id: 'b2', month: '2026-10', dueAmount: 2000, payments: [{ amount: 500 }] }   // balance 1500
    ]
  };

  const voucher = buildAdjustmentVoucherData({
    customer: mockCustomer,
    category: 'downtime_credit',
    amount: 400,
    reason: '3 days outage during road widening work',
    authorizedBy: 'Umair (Network Ops)',
    date: '2026-10-16',
    outageDetails: { days: 3, hours: 0, monthlyRate: 2000, calculatedCredit: 400 },
    existingVouchersCount: 3
  });

  assert.equal(voucher.voucherNumber, 'ADJ-202610-0004');
  assert.equal(voucher.customerId, 'cust-99');
  assert.equal(voucher.customerNumber, 42);
  assert.equal(voucher.customerName, 'Raja Tariq');
  assert.equal(voucher.category, 'downtime_credit');
  assert.equal(voucher.categoryLabel, 'Fiber Cut / Outage Downtime Credit');
  assert.equal(voucher.categoryLabelUrdu, 'انٹرنیٹ خرابی کٹوتی');
  assert.equal(voucher.amount, 400);
  assert.equal(voucher.previousBalance, 1500);
  assert.equal(voucher.projectedBalance, 1100);
  assert.equal(voucher.date, '2026-10-16');
  assert.equal(voucher.outageDetails.days, 3);
  assert.equal(voucher.outageDetails.calculatedCredit, 400);
});

test('formatAdjustmentVoucherWhatsApp formats bilingual notification text', () => {
  const voucher = {
    voucherNumber: 'ADJ-202610-0001',
    customerName: 'Muhammad Ali',
    customerNumber: 15,
    date: '2026-10-16',
    categoryLabel: 'Fiber Cut / Outage Downtime Credit',
    categoryLabelUrdu: 'انٹرنیٹ خرابی کٹوتی',
    amount: 350,
    projectedBalance: 1150,
    reason: 'Shahdara Town transmission fiber snapped',
    authorizedBy: 'Network Lead',
    outageDetails: { days: 2, hours: 4 }
  };

  const text = formatAdjustmentVoucherWhatsApp(voucher);
  assert.match(text, /ADJ-202610-0001/);
  assert.match(text, /Muhammad Ali/);
  assert.match(text, /#15/);
  assert.match(text, /350/);
  assert.match(text, /انٹرنیٹ خرابی کٹوتی/);
  assert.match(text, /2 days, 4 hours outage/);
  assert.match(text, /1,150/);
  assert.match(text, /Network Lead/);
});

test('generateAdjustmentLedgerCsv produces RFC-4180 compliant CSV', () => {
  const vouchers = [
    {
      voucherNumber: 'ADJ-202610-0001',
      date: '2026-10-15',
      customerNumber: 10,
      customerName: 'Ali Khan',
      categoryLabel: 'Fiber Cut / Outage Downtime Credit',
      amount: 500,
      previousBalance: 2000,
      projectedBalance: 1500,
      reason: 'Splitter burn',
      authorizedBy: 'Manager',
      createdAt: '2026-10-15T12:00:00Z'
    }
  ];

  const csv = generateAdjustmentLedgerCsv(vouchers);
  assert.match(csv, /Voucher_No,Date,Customer_No,Customer_Name/);
  assert.match(csv, /ADJ-202610-0001,2026-10-15,10,Ali Khan/);
  assert.match(csv, /500,2000,1500/);
});

test('generateAdjustmentVoucherHtml generates printable voucher slips and sheets', () => {
  const voucher = {
    voucherNumber: 'ADJ-202610-0002',
    date: '2026-10-16',
    customerNumber: 8,
    customerName: 'Zahid Hussain',
    customerPhone: '03017654321',
    customerArea: 'Jia Musa',
    categoryLabel: 'Billing Dispute / Overcharge Settlement',
    categoryLabelUrdu: 'بل تنازعہ حل',
    amount: 250,
    previousBalance: 1000,
    projectedBalance: 750,
    reason: 'Speed package downgrade credit',
    authorizedBy: 'Saad Accounting'
  };

  const slipHtml = generateAdjustmentVoucherHtml(voucher, { format: 'slip' });
  assert.match(slipHtml, /adj-thermal-slip/);
  assert.match(slipHtml, /ADJ-202610-0002/);
  assert.match(slipHtml, /Zahid Hussain/);
  assert.match(slipHtml, /Jia Musa/);
  assert.match(slipHtml, /بل تنازعہ حل/);
  assert.match(slipHtml, /PKR 250/);
  assert.match(slipHtml, /Saad Accounting/);

  const sheetHtml = generateAdjustmentVoucherHtml(voucher, { format: 'sheet' });
  assert.match(sheetHtml, /adj-formal-sheet/);
});

test('getSavedAdjustmentVouchers and saveAdjustmentVoucher persist and filter by customer in storage', () => {
  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  };

  assert.deepEqual(getSavedAdjustmentVouchers(mockStorage), []);

  const v1 = { id: '1', customerId: 'c1', voucherNumber: 'ADJ-001', amount: 200 };
  const v2 = { id: '2', customerId: 'c2', voucherNumber: 'ADJ-002', amount: 300 };

  saveAdjustmentVoucher(mockStorage, v1);
  saveAdjustmentVoucher(mockStorage, v2);

  const all = getSavedAdjustmentVouchers(mockStorage);
  assert.equal(all.length, 2);

  const forC1 = getSavedAdjustmentVouchers(mockStorage, 'c1');
  assert.equal(forC1.length, 1);
  assert.equal(forC1[0].voucherNumber, 'ADJ-001');

  const forC2 = getSavedAdjustmentVouchers(mockStorage, 'c2');
  assert.equal(forC2.length, 1);
  assert.equal(forC2[0].voucherNumber, 'ADJ-002');
});

test('setupAdjustmentVoucherModal controller binds DOM events, handles calculation and issuance', () => {
  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  };

  const toasts = [];
  const issuedVouchers = [];

  const elements = {};
  const createElement = (id, tag = 'div') => {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      hidden: false,
      dataset: {},
      listeners: {},
      addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        const fns = this.listeners[evt.type] || [];
        fns.forEach(fn => fn(evt));
      },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
    elements[id] = el;
    return el;
  };

  createElement('customerAdjustmentModal', 'dialog');
  createElement('closeAdjustmentModalBtn', 'button');
  createElement('closeAdjustmentModalSecondaryBtn', 'button');
  createElement('openAdjustmentModalBtn', 'button');
  createElement('adjCustomerName', 'strong');
  createElement('adjCustomerMeta', 'span');
  createElement('adjCurrentBalance', 'strong');
  createElement('adjProjectedBalance', 'strong');
  createElement('adjToggleCalculatorBtn', 'button');
  createElement('adjCalculatorBody', 'div');
  createElement('adjToggleCalcIcon', 'span');
  createElement('adjOutageDays', 'input');
  createElement('adjOutageHours', 'input');
  createElement('adjMonthlyRateDisplay', 'input');
  createElement('adjCalcCreditPkr', 'strong');
  createElement('adjApplyCalcBtn', 'button');
  createElement('customerAdjustmentForm', 'form');
  createElement('adjCategorySelect', 'select');
  createElement('adjAmountInput', 'input');
  createElement('adjDateInput', 'input');
  createElement('adjAuthorizedByInput', 'input');
  createElement('adjReasonInput', 'textarea');
  createElement('adjAmountError', 'span');
  elements.adjAmountError.hidden = true;
  createElement('adjAuthError', 'span');
  elements.adjAuthError.hidden = true;
  createElement('adjReasonError', 'span');
  elements.adjReasonError.hidden = true;
  createElement('adjPreviewVoucherNum', 'span');
  createElement('adjPreviewAmount', 'strong');
  createElement('adjPreviewCategory', 'span');
  createElement('adjPreviewNewBal', 'span');
  createElement('submitAdjustmentVoucherBtn', 'button');
  createElement('printAdjustmentSlipBtn', 'button');
  createElement('sendAdjustmentWhatsAppBtn', 'button');
  createElement('adjHistoryTableBody', 'tbody');
  createElement('adjHistoryCountBadge', 'span');

  const oldDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) { return elements[id] || null; }
  };

  try {
    const controller = setupAdjustmentVoucherModal({
      modalId: 'customerAdjustmentModal',
      storage: mockStorage,
      onToast: (msg) => toasts.push(msg),
      onVoucherIssued: (v) => issuedVouchers.push(v)
    });

    const mockCustomer = {
      id: 'cust-55',
      customerNumber: 55,
      name: 'Chaudhry Bilal',
      phone: '03009876543',
      mohalla: 'Shahdara Mor',
      monthlySellingAmount: 1800,
      bills: [
        { id: 'b1', month: '2026-10', dueAmount: 1800, payments: [] }
      ]
    };

    controller.open(mockCustomer);
    assert.equal(elements.customerAdjustmentModal.open, true);
    assert.match(elements.adjCustomerName.textContent, /Chaudhry Bilal/);
    assert.equal(elements.adjCurrentBalance.textContent, 'PKR 1,800');

    // Test Outage Calculator Toggle & Input
    elements.adjCalculatorBody.hidden = true;
    elements.adjToggleCalculatorBtn.dispatchEvent({ type: 'click' });
    assert.equal(elements.adjCalculatorBody.hidden, false);

    elements.adjOutageDays.value = '2'; // 2 days of 1800/30 = 120 PKR
    elements.adjOutageDays.dispatchEvent({ type: 'input' });
    assert.equal(elements.adjCalcCreditPkr.textContent, 'PKR 120');

    // Apply calculated credit to voucher form
    elements.adjApplyCalcBtn.dispatchEvent({ type: 'click' });
    assert.equal(elements.adjAmountInput.value, '120');
    assert.match(elements.adjReasonInput.value, /Outage compensation/);

    // Issue voucher
    elements.adjAuthorizedByInput.value = 'Saad (Director)';
    elements.submitAdjustmentVoucherBtn.dispatchEvent({ type: 'click' });

    assert.equal(issuedVouchers.length, 1);
    assert.equal(issuedVouchers[0].amount, 120);
    assert.equal(issuedVouchers[0].customerName, 'Chaudhry Bilal');
    assert.match(toasts.at(-1), /issued successfully/);

    // Verify voucher saved in storage
    const saved = getSavedAdjustmentVouchers(mockStorage, 'cust-55');
    assert.equal(saved.length, 1);

    controller.close();
    assert.equal(elements.customerAdjustmentModal.open, false);
  } finally {
    globalThis.document = oldDoc;
  }
});

test('DOM & CSS integration for customer adjustment voucher modal', () => {
  const freshIndex = read('index.html');
  const freshApp = read('app.js');
  const freshStyles = read('styles.css');

  // index.html
  assert.match(freshIndex, /id="customerAdjustmentModal"/);
  assert.match(freshIndex, /id="openAdjustmentModalBtn"/);
  assert.match(freshIndex, /id="closeAdjustmentModalBtn"/);
  assert.match(freshIndex, /id="adjCustomerName"/);
  assert.match(freshIndex, /id="adjCurrentBalance"/);
  assert.match(freshIndex, /id="adjProjectedBalance"/);
  assert.match(freshIndex, /id="adjToggleCalculatorBtn"/);
  assert.match(freshIndex, /id="adjOutageDays"/);
  assert.match(freshIndex, /id="adjOutageHours"/);
  assert.match(freshIndex, /id="adjApplyCalcBtn"/);
  assert.match(freshIndex, /id="customerAdjustmentForm"/);
  assert.match(freshIndex, /id="adjCategorySelect"/);
  assert.match(freshIndex, /id="adjAmountInput"/);
  assert.match(freshIndex, /id="adjReasonInput"/);
  assert.match(freshIndex, /id="submitAdjustmentVoucherBtn"/);
  assert.match(freshIndex, /id="printAdjustmentSlipBtn"/);
  assert.match(freshIndex, /id="sendAdjustmentWhatsAppBtn"/);
  assert.match(freshIndex, /id="adjHistoryTableBody"/);

  // app.js
  assert.match(freshApp, /setupAdjustmentVoucherModal/);
  assert.match(freshApp, /customerAdjustmentModalController/);
  assert.match(freshApp, /#openAdjustmentModalBtn/);

  // styles.css
  assert.match(freshStyles, /\.adjustment-modal/);
  assert.match(freshStyles, /\.adjustment-customer-strip/);
  assert.match(freshStyles, /\.adjustment-calculator-fieldset/);
  assert.match(freshStyles, /\.adj-preview-card/);
  assert.match(freshStyles, /\.adj-history-section/);
  assert.match(freshStyles, /\[data-theme="dark"\]\s+\.adjustment-modal/);
});
