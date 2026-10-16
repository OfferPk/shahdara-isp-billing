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
  generateAdjustmentLedgerCsv, generateAdjustmentVoucherHtml, getSavedAdjustmentVouchers, saveAdjustmentVoucher, setupAdjustmentVoucherModal,
  SERVICE_CONTRACTS_KEY, validatePakistanCnic, validateServiceContract, buildServiceContractData, getSavedServiceContracts, saveServiceContract,
  formatServiceContractWhatsApp, generateServiceContractCsv, generateServiceContractHtml, setupServiceContractModal,
  PAKISTAN_CNIC_PROVINCES, parsePakistaniCnicDetails, calculateKycComplianceAudit, filterKycComplianceRecords,
  generateKycNoticeWhatsAppText, generateKycComplianceCsv, generateKycCompliancePrintHtml, setupKycComplianceModal
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

/* ==========================================================================
   CUSTOMER SERVICE CONTRACT & BROADBAND AGREEMENT TEST SUITE
   ========================================================================== */

test('validatePakistanCnic validates 13-digit Pakistani national identity cards', () => {
  // Valid unformatted 13 digits
  const res1 = validatePakistanCnic('3520212345671');
  assert.equal(res1.valid, true);
  assert.equal(res1.formatted, '35202-1234567-1');
  assert.equal(res1.raw, '3520212345671');

  // Valid formatted with hyphens
  const res2 = validatePakistanCnic('35202-7654321-9');
  assert.equal(res2.valid, true);
  assert.equal(res2.formatted, '35202-7654321-9');
  assert.equal(res2.raw, '3520276543219');

  // Invalid: missing or wrong lengths
  assert.equal(validatePakistanCnic('').valid, false);
  assert.equal(validatePakistanCnic(null).valid, false);
  assert.equal(validatePakistanCnic('35202123456').valid, false); // 11 digits
  assert.equal(validatePakistanCnic('352021234567890').valid, false); // 15 digits
  assert.equal(validatePakistanCnic('abcdefghijklm').valid, false); // non-digits
});

test('validateServiceContract validates customer, fees, speed and technician fields', () => {
  // Valid
  const valid = validateServiceContract({
    customerId: 'cust-10',
    cnic: '35202-1234567-1',
    packageSpeed: '15 Mbps Turbo',
    monthlyRate: 1500,
    installationFee: 1000,
    securityDeposit: 1500,
    technicianName: 'Umair Tech'
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  // Missing customer
  const noCust = validateServiceContract({ customerId: '', packageSpeed: '15 Mbps', monthlyRate: 1500, technicianName: 'Tech' });
  assert.equal(noCust.valid, false);
  assert.match(noCust.errors.customer, /select a subscriber/);

  // Invalid CNIC
  const badCnic = validateServiceContract({ customerId: 'c1', cnic: '123', packageSpeed: '15 Mbps', monthlyRate: 1500, technicianName: 'Tech' });
  assert.equal(badCnic.valid, false);
  assert.match(badCnic.errors.cnic, /13 digits/);

  // Invalid monthly rate
  const badRate = validateServiceContract({ customerId: 'c1', packageSpeed: '15 Mbps', monthlyRate: -50, technicianName: 'Tech' });
  assert.equal(badRate.valid, false);
  assert.match(badRate.errors.monthlyRate, /positive amount/);

  // Missing technician
  const noTech = validateServiceContract({ customerId: 'c1', packageSpeed: '15 Mbps', monthlyRate: 1500, technicianName: '' });
  assert.equal(noTech.valid, false);
  assert.match(noTech.errors.technicianName, /technician/);
});

test('buildServiceContractData builds sequential contract record with financial rollup and SLA', () => {
  const customer = {
    id: 'cust-88',
    customerNumber: 88,
    name: 'Mian Tariq',
    phone: '03001234567',
    area: 'Shahdara Town',
    mohalla: 'Kot Mohibbu'
  };

  const contract = buildServiceContractData({
    customer,
    cnic: '35202-1234567-1',
    packageSpeed: '25 Mbps Ultra',
    monthlyRate: 2500,
    installationFee: 1200,
    securityDeposit: 1500,
    ontModel: 'ZTE F660 GPON',
    ontSerial: 'ZTEG-98765432',
    dropCableMeters: 90,
    opticalPowerDbm: -20.8,
    contractMonths: 12,
    startDate: '2026-10-16',
    technicianName: 'Farhan Engineer',
    notes: '2nd floor installation, aerial drop across main road',
    existingContractsCount: 5
  });

  assert.equal(contract.agreementNumber, 'AGR-202610-0006');
  assert.equal(contract.customer.name, 'Mian Tariq');
  assert.equal(contract.customer.customerNumber, 88);
  assert.equal(contract.cnic, '35202-1234567-1');
  assert.equal(contract.packageSpeed, '25 Mbps Ultra');
  assert.equal(contract.monthlyRate, 2500);
  assert.equal(contract.installationFee, 1200);
  assert.equal(contract.securityDeposit, 1500);
  assert.equal(contract.totalInitialPayment, 5200); // 2500 + 1200 + 1500
  assert.equal(contract.equipment.ontModel, 'ZTE F660 GPON');
  assert.equal(contract.equipment.ontSerial, 'ZTEG-98765432');
  assert.equal(contract.equipment.dropCableMeters, 90);
  assert.equal(contract.equipment.opticalPowerDbm, -20.8);
  assert.equal(contract.contractMonths, 12);
  assert.equal(contract.startDate, '2026-10-16');
  assert.match(contract.expiryDate, /2027-10/);
  assert.equal(contract.slaTerms.faultResolutionHours, 24);
  assert.equal(contract.slaTerms.billingCycleDay, 5);
});

test('getSavedServiceContracts and saveServiceContract persist and retrieve agreements', () => {
  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  };

  assert.deepEqual(getSavedServiceContracts(mockStorage), []);

  const c1 = { agreementNumber: 'AGR-001', customer: { id: 'c1' } };
  const c2 = { agreementNumber: 'AGR-002', customer: { id: 'c2' } };

  saveServiceContract(mockStorage, c1);
  saveServiceContract(mockStorage, c2);

  const all = getSavedServiceContracts(mockStorage);
  assert.equal(all.length, 2);

  const forC1 = getSavedServiceContracts(mockStorage, 'c1');
  assert.equal(forC1.length, 1);
  assert.equal(forC1[0].agreementNumber, 'AGR-001');
});

test('formatServiceContractWhatsApp formats bilingual notification text', () => {
  const contract = {
    agreementNumber: 'AGR-202610-0001',
    startDate: '2026-10-16',
    expiryDate: '2027-10-16',
    contractMonths: 12,
    customer: { name: 'Kashif Ali', customerNumber: 33, phone: '03211234567', area: 'Shahdara Mor' },
    cnic: '35202-9876543-1',
    packageSpeed: '15 Mbps Turbo',
    monthlyRate: 1500,
    installationFee: 1000,
    securityDeposit: 1500,
    totalInitialPayment: 4000,
    equipment: { ontModel: 'Huawei HG8546M', ontSerial: 'HWTC-1234', dropCableMeters: 65, opticalPowerDbm: -21.5 },
    technicianName: 'Umair Tech'
  };

  const text = formatServiceContractWhatsApp(contract);
  assert.match(text, /AGR-202610-0001/);
  assert.match(text, /معاہدہ انٹرنیٹ سروس/);
  assert.match(text, /Kashif Ali/);
  assert.match(text, /35202-9876543-1/);
  assert.match(text, /15 Mbps Turbo/);
  assert.match(text, /1,500/);
  assert.match(text, /4,000/);
  assert.match(text, /Huawei HG8546M/);
  assert.match(text, /24-hour optical line support/);
});

test('generateServiceContractCsv produces valid RFC-4180 CSV export', () => {
  const contracts = [
    {
      agreementNumber: 'AGR-202610-0001',
      startDate: '2026-10-16',
      expiryDate: '2027-10-16',
      customer: { customerNumber: 22, name: 'Babar Azam', phone: '03001234567', area: 'Jia Musa' },
      cnic: '35202-1234567-1',
      packageSpeed: '25 Mbps',
      monthlyRate: 2500,
      installationFee: 1000,
      securityDeposit: 1500,
      totalInitialPayment: 5000,
      equipment: { ontModel: 'GPON Router', ontSerial: 'SN12345', dropCableMeters: 80, opticalPowerDbm: -22.1 },
      technicianName: 'Saad',
      notes: 'Clean drop'
    }
  ];

  const csv = generateServiceContractCsv(contracts);
  assert.match(csv, /Agreement_No,Date,Expiry_Date,Customer_No,Customer_Name/);
  assert.match(csv, /AGR-202610-0001,2026-10-16,2027-10-16,22,Babar Azam/);
  assert.match(csv, /35202-1234567-1,Jia Musa,25 Mbps,2500,1000,1500,5000/);
});

test('generateServiceContractHtml produces A4 agreement and thermal work order slip', () => {
  const contract = {
    agreementNumber: 'AGR-202610-0001',
    startDate: '2026-10-16',
    expiryDate: '2027-10-16',
    contractMonths: 12,
    customer: { name: 'Imran Khan', customerNumber: 77, phone: '03009999999', area: 'Baradari Road' },
    cnic: '35202-1111111-1',
    packageSpeed: '50 Mbps Fiber Max',
    monthlyRate: 3500,
    installationFee: 1500,
    securityDeposit: 2000,
    totalInitialPayment: 7000,
    equipment: { ontModel: 'Dual-Band Fiber Router', ontSerial: 'FBR-8888', dropCableMeters: 110, opticalPowerDbm: -19.5 },
    technicianName: 'Lead Engineer'
  };

  const a4Html = generateServiceContractHtml(contract, { format: 'a4' });
  assert.match(a4Html, /contract-a4-document/);
  assert.match(a4Html, /SHAHDARA FIBER NETWORKS &amp; BROADBAND/);
  assert.match(a4Html, /معاہدہ برائے فراہمی انٹرنیٹ سروس و سامان تنصیب/);
  assert.match(a4Html, /AGR-202610-0001/);
  assert.match(a4Html, /Imran Khan/);
  assert.match(a4Html, /PKR 7,000/);
  assert.match(a4Html, /Dual-Band Fiber Router/);
  assert.match(a4Html, /terms-bilingual-grid/);
  assert.match(a4Html, /Subscriber Signature/);

  const slipHtml = generateServiceContractHtml(contract, { format: 'slip' });
  assert.match(slipHtml, /contract-slip-document/);
  assert.match(slipHtml, /SHAHDARA BROADBAND/);
  assert.match(slipHtml, /Fiber Internet Work Order &amp; Agreement/);
  assert.match(slipHtml, /Agr: AGR-202610-0001/);
  assert.match(slipHtml, /Imran Khan/);
  assert.match(slipHtml, /Total Paid:.*PKR 7,000/);
});

test('setupServiceContractModal controller binds DOM inputs, auto-masks CNIC, and issues agreements', () => {
  const mockStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); }
  };

  const toasts = [];
  const createdAgreements = [];

  const elements = {};
  const createElement = (id, tag = 'div') => {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
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
      querySelectorAll() { return []; },
      setAttribute(k, v) { this[k] = v; },
      removeAttribute(k) { delete this[k]; },
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
    elements[id] = el;
    return el;
  };

  createElement('customerServiceContractModal', 'dialog');
  createElement('closeServiceContractModalBtn', 'button');
  createElement('closeServiceContractSecondaryBtn', 'button');
  createElement('submitServiceContractBtn', 'button');
  createElement('printServiceContractA4Btn', 'button');
  createElement('printServiceContractSlipBtn', 'button');
  createElement('whatsappServiceContractBtn', 'button');
  createElement('exportServiceContractCsvBtn', 'button');
  createElement('contractCustName', 'strong');
  createElement('contractCustPhone', 'span');
  createElement('contractCustLocation', 'span');
  createElement('contractCustCurrentPackage', 'span');
  createElement('contractCnicInput', 'input');
  createElement('contractPackageSelect', 'select');
  createElement('contractMonthlyRateInput', 'input');
  createElement('contractInstallFeeInput', 'input');
  createElement('contractDepositInput', 'input');
  createElement('contractOntModelInput', 'input');
  createElement('contractOntSerialInput', 'input');
  createElement('contractCableMetersInput', 'input');
  createElement('contractOpticalPowerInput', 'input');
  createElement('contractTenureSelect', 'select');
  createElement('contractStartDateInput', 'input');
  createElement('contractTechNameInput', 'input');
  createElement('contractNotesInput', 'input');
  createElement('contractPreviewAgrNumber', 'strong');
  createElement('contractPreviewExpiry', 'strong');
  createElement('contractPreviewTotalInitial', 'strong');
  createElement('contractPreviewOntSummary', 'span');
  createElement('contractCnicError', 'p');
  elements.contractCnicError.hidden = true;
  createElement('contractMonthlyRateError', 'p');
  elements.contractMonthlyRateError.hidden = true;
  createElement('contractTechError', 'p');
  elements.contractTechError.hidden = true;
  createElement('contractHistoryTableBody', 'tbody');

  const oldDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) { return elements[id] || null; }
  };

  try {
    const controller = setupServiceContractModal({
      storage: mockStorage,
      onToast: (msg) => toasts.push(msg),
      onContractCreated: (c) => createdAgreements.push(c)
    });

    const mockCustomer = {
      id: 'cust-77',
      customerNumber: 77,
      name: 'Nawaz Sharif',
      phone: '03001234567',
      area: 'Shahdara Town',
      packageSpeed: '15 Mbps Turbo',
      monthlySellingAmount: 1600
    };

    controller.open(mockCustomer);
    assert.equal(elements.customerServiceContractModal.open, true);
    assert.equal(elements.contractCustName.textContent, 'Nawaz Sharif');

    // Test CNIC Masking
    elements.contractCnicInput.value = '3520212345671';
    elements.contractCnicInput.dispatchEvent({ type: 'input' });
    assert.equal(elements.contractCnicInput.value, '35202-1234567-1');

    // Submit valid agreement
    elements.contractMonthlyRateInput.value = '1600';
    elements.contractInstallFeeInput.value = '1000';
    elements.contractDepositInput.value = '1500';
    elements.contractTechNameInput.value = 'Rashid Tech';
    elements.submitServiceContractBtn.dispatchEvent({ type: 'click' });

    assert.equal(createdAgreements.length, 1);
    assert.equal(createdAgreements[0].customer.name, 'Nawaz Sharif');
    assert.equal(createdAgreements[0].cnic, '35202-1234567-1');
    assert.equal(createdAgreements[0].totalInitialPayment, 4100);
    assert.match(toasts.at(-1), /issued successfully/);

    const saved = getSavedServiceContracts(mockStorage, 'cust-77');
    assert.equal(saved.length, 1);

    controller.close();
    assert.equal(elements.customerServiceContractModal.open, false);
  } finally {
    globalThis.document = oldDoc;
  }
});

test('DOM & CSS integration for service contract modal', () => {
  const freshIndex = read('index.html');
  const freshApp = read('app.js');
  const freshStyles = read('styles.css');

  // index.html
  assert.match(freshIndex, /id="openServiceContractBtn"/);
  assert.match(freshIndex, /id="customerServiceContractModal"/);
  assert.match(freshIndex, /id="closeServiceContractModalBtn"/);
  assert.match(freshIndex, /id="contractCustName"/);
  assert.match(freshIndex, /id="contractCnicInput"/);
  assert.match(freshIndex, /id="contractPackageSelect"/);
  assert.match(freshIndex, /id="contractMonthlyRateInput"/);
  assert.match(freshIndex, /id="contractInstallFeeInput"/);
  assert.match(freshIndex, /id="contractDepositInput"/);
  assert.match(freshIndex, /id="contractOntModelInput"/);
  assert.match(freshIndex, /id="contractOntSerialInput"/);
  assert.match(freshIndex, /id="contractCableMetersInput"/);
  assert.match(freshIndex, /id="contractOpticalPowerInput"/);
  assert.match(freshIndex, /id="contractTenureSelect"/);
  assert.match(freshIndex, /id="contractStartDateInput"/);
  assert.match(freshIndex, /id="contractTechNameInput"/);
  assert.match(freshIndex, /id="contractNotesInput"/);
  assert.match(freshIndex, /id="submitServiceContractBtn"/);
  assert.match(freshIndex, /id="printServiceContractA4Btn"/);
  assert.match(freshIndex, /id="printServiceContractSlipBtn"/);
  assert.match(freshIndex, /id="whatsappServiceContractBtn"/);
  assert.match(freshIndex, /id="exportServiceContractCsvBtn"/);
  assert.match(freshIndex, /id="contractHistoryTableBody"/);

  // app.js
  assert.match(freshApp, /setupServiceContractModal/);
  assert.match(freshApp, /customerServiceContractModalController/);
  assert.match(freshApp, /#openServiceContractBtn/);

  // styles.css
  assert.match(freshStyles, /\.agreement-modal/);
  assert.match(freshStyles, /\.contract-customer-ribbon/);
  assert.match(freshStyles, /\.contract-grid/);
  assert.match(freshStyles, /\.contract-col/);
  assert.match(freshStyles, /\.contract-preview-box/);
  assert.match(freshStyles, /\.contract-history-section/);
  assert.match(freshStyles, /\[data-theme="dark"\]\s+\.agreement-modal/);
});

test('validateDisputeClaim validates subscriber, category, positive amount, and reason length', async () => {
  const { validateDisputeClaim } = await import('../form-validation.js');

  const valid = validateDisputeClaim({
    customerId: 'cust-12',
    category: 'unrecorded_payment',
    disputedAmount: 1500,
    reason: 'Paid cash to technician Umair on Friday, not credited',
    filedBy: 'Muhammad Ali'
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  const noCust = validateDisputeClaim({
    customerId: '',
    category: 'rate_mismatch',
    disputedAmount: 500,
    reason: 'Downgraded speed not reflected',
    filedBy: 'Admin'
  });
  assert.equal(noCust.isValid, false);
  assert.match(noCust.errors.customerId, /Valid subscriber account/);

  const badCat = validateDisputeClaim({
    customerId: 'cust-1',
    category: 'invalid_category_xyz',
    disputedAmount: 500,
    reason: 'Wrong package',
    filedBy: 'Admin'
  });
  assert.equal(badCat.isValid, false);
  assert.match(badCat.errors.category, /valid dispute category/);

  const zeroAmt = validateDisputeClaim({
    customerId: 'cust-1',
    category: 'other',
    disputedAmount: 0,
    reason: 'General inquiry reason',
    filedBy: 'Admin'
  });
  assert.equal(zeroAmt.isValid, false);
  assert.match(zeroAmt.errors.disputedAmount, /greater than zero/);

  const shortReason = validateDisputeClaim({
    customerId: 'cust-1',
    category: 'other',
    disputedAmount: 100,
    reason: 'bad',
    filedBy: 'Admin'
  });
  assert.equal(shortReason.isValid, false);
  assert.match(shortReason.errors.reason, /at least 5 characters/);

  const shortFiler = validateDisputeClaim({
    customerId: 'cust-1',
    category: 'other',
    disputedAmount: 100,
    reason: 'Detailed reason here',
    filedBy: 'A'
  });
  assert.equal(shortFiler.isValid, false);
  assert.match(shortFiler.errors.filedBy, /min 2 characters/);
});

test('assessDisputeClaim computes current balance, approved credit, and plausibility recommendation', async () => {
  const { assessDisputeClaim } = await import('../form-validation.js');

  const customer = {
    id: 'cust-10',
    bills: [
      { month: '2026-09', dueAmount: 1500, status: 'unpaid' },
      { month: '2026-10', dueAmount: 2000, status: 'unpaid' }
    ]
  };

  const assessment = assessDisputeClaim({
    category: 'unrecorded_payment',
    disputedAmount: 1500,
    approvedAmount: 1500
  }, customer);

  assert.equal(assessment.currentBalance, 3500);
  assert.equal(assessment.disputedAmount, 1500);
  assert.equal(assessment.approvedAmount, 1500);
  assert.equal(assessment.netProjectedBalance, 2000);
  assert.equal(assessment.isPlausible, true);
  assert.match(assessment.recommendation, /matches or is within outstanding arrears/);

  const excessAssessment = assessDisputeClaim({
    category: 'unrecorded_payment',
    disputedAmount: 5000
  }, customer);

  assert.equal(excessAssessment.isPlausible, false);
  assert.match(excessAssessment.recommendation, /exceeds total outstanding balance/);
});

test('buildDisputeClaimRecord, getSavedDisputeClaims, and updateDisputeClaimStatus manage dispute lifecycle', async () => {
  const { buildDisputeClaimRecord, getSavedDisputeClaims, saveDisputeClaim, updateDisputeClaimStatus } = await import('../form-validation.js');

  const memoryStore = new Map();
  const mockStorage = {
    getItem: (k) => memoryStore.get(k) || null,
    setItem: (k, v) => memoryStore.set(k, String(v)),
    removeItem: (k) => memoryStore.delete(k)
  };

  const customer = {
    id: 'c-45',
    customerNumber: 45,
    name: 'Hamza Tariq',
    phone: '03001234567',
    area: 'Main Bazar',
    bills: [{ dueAmount: 2500, status: 'unpaid' }]
  };

  const claim = buildDisputeClaimRecord({
    customer,
    category: 'unrecorded_payment',
    disputedAmount: 1000,
    reason: 'Paid cash to technician on 10th Oct',
    filedBy: 'Hamza Tariq',
    status: 'SUBMITTED',
    evidenceRef: 'Cash receipt #1042',
    existingClaimsCount: 0
  });

  assert.match(claim.ticketNumber, /^DSP-\d{6}-0001$/);
  assert.equal(claim.customerName, 'Hamza Tariq');
  assert.equal(claim.disputedAmount, 1000);
  assert.equal(claim.previousBalance, 2500);
  assert.equal(claim.status, 'SUBMITTED');

  saveDisputeClaim(claim, mockStorage);
  const saved = getSavedDisputeClaims(mockStorage, 'c-45');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].ticketNumber, claim.ticketNumber);

  const updated = updateDisputeClaimStatus(claim.ticketNumber, {
    status: 'APPROVED_FULL',
    resolvedBy: 'Saad Manager',
    resolutionNotes: 'Verified against technician cash log'
  }, mockStorage);

  assert.equal(updated.status, 'APPROVED_FULL');
  assert.equal(updated.approvedAmount, 1000);
  assert.equal(updated.projectedBalance, 1500);
  assert.equal(updated.resolvedBy, 'Saad Manager');

  const reloaded = getSavedDisputeClaims(mockStorage, 'c-45');
  assert.equal(reloaded[0].status, 'APPROVED_FULL');
  assert.equal(reloaded[0].projectedBalance, 1500);
});

test('formatDisputeClaimWhatsApp formats bilingual WhatsApp dispatch text', async () => {
  const { formatDisputeClaimWhatsApp } = await import('../form-validation.js');

  const claim = {
    ticketNumber: 'DSP-202610-0005',
    customerName: 'Zahid Khan',
    customerNumber: 22,
    categoryLabel: 'Package Tariff / Rate Discrepancy',
    categoryLabelUrdu: 'پیکج ریٹ و ٹیرف فرق',
    disputedAmount: 500,
    approvedAmount: 500,
    projectedBalance: 1200,
    status: 'APPROVED_FULL',
    reason: 'Charged 15 Mbps speed package instead of 10 Mbps',
    evidenceRef: 'Speed test screenshot',
    resolutionNotes: 'Approved 500 PKR tariff difference credit',
    resolvedBy: 'Accounts Lead'
  };

  const text = formatDisputeClaimWhatsApp(claim);
  assert.match(text, /DSP-202610-0005/);
  assert.match(text, /Zahid Khan/);
  assert.match(text, /#22/);
  assert.match(text, /Package Tariff \/ Rate Discrepancy/);
  assert.match(text, /500/);
  assert.match(text, /APPROVED IN FULL/);
  assert.match(text, /1,200/);
  assert.match(text, /Charged 15 Mbps speed package/);
  assert.match(text, /Accounts Lead/);
});

test('generateDisputeClaimsCsv outputs RFC-4180 compliant CSV', async () => {
  const { generateDisputeClaimsCsv } = await import('../form-validation.js');

  const claims = [
    {
      ticketNumber: 'DSP-202610-0001',
      createdAt: '2026-10-16T10:00:00Z',
      customerNumber: 12,
      customerName: 'Bilal Ahmad',
      customerPhone: '03211112233',
      customerArea: 'Chowk',
      categoryLabel: 'Unrecorded Cash / Direct Payment',
      disputedAmount: 1500,
      approvedAmount: 1500,
      projectedBalance: 0,
      status: 'APPROVED_FULL',
      filedBy: 'Customer',
      resolvedBy: 'Manager',
      evidenceRef: 'TID 9988',
      reason: 'Direct payment not recorded'
    }
  ];

  const csv = generateDisputeClaimsCsv(claims);
  assert.match(csv, /Ticket_No,Date,Customer_No,Customer_Name/);
  assert.match(csv, /DSP-202610-0001,2026-10-16,12,Bilal Ahmad/);
  assert.match(csv, /1500,1500,0/);
  assert.match(csv, /APPROVED_FULL/);
});

test('generateDisputeClaimHtml generates printable settlement sheets and 80mm slips', async () => {
  const { generateDisputeClaimHtml } = await import('../form-validation.js');

  const claim = {
    ticketNumber: 'DSP-202610-0008',
    customerName: 'Asim Riaz',
    customerNumber: 55,
    customerPhone: '03009988776',
    customerArea: 'Kot Mohibbu',
    categoryLabel: 'Prolonged Service Outage / Fiber Cut',
    categoryLabelUrdu: 'طویل سروس تعطل و خرابی',
    disputedAmount: 400,
    approvedAmount: 400,
    previousBalance: 2000,
    projectedBalance: 1600,
    status: 'APPROVED_FULL',
    reason: '4 days fiber cut during GT Road drain excavation',
    evidenceRef: 'Area outage ticket #OT-44',
    resolutionNotes: 'Pro-rated downtime credit approved',
    resolvedBy: 'Network Director'
  };

  const slipHtml = generateDisputeClaimHtml(claim, { format: 'slip' });
  assert.match(slipHtml, /dispute-thermal-slip/);
  assert.match(slipHtml, /DSP-202610-0008/);
  assert.match(slipHtml, /Asim Riaz/);
  assert.match(slipHtml, /PKR 400/);
  assert.match(slipHtml, /PKR 1,600/);

  const a4Html = generateDisputeClaimHtml(claim, { format: 'a4' });
  assert.match(a4Html, /dispute-formal-sheet/);
  assert.match(a4Html, /FORMAL BILLING DISPUTE SETTLEMENT VOUCHER/);
  assert.match(a4Html, /درخواست برائے تصفیہ متنازعہ واجبات/);
  assert.match(a4Html, /DSP-202610-0008/);
  assert.match(a4Html, /Asim Riaz/);
  assert.match(a4Html, /Kot Mohibbu/);
  assert.match(a4Html, /Network Director/);
});

test('DOM & CSS integration for Customer Billing Dispute Settlement Modal', () => {
  const freshIndex = read('index.html');
  const freshApp = read('app.js');
  const freshStyles = read('styles.css');

  // index.html
  assert.match(freshIndex, /id="openDisputeClaimBtn"/);
  assert.match(freshIndex, /id="customerDisputeModal"/);
  assert.match(freshIndex, /id="closeDisputeModalBtn"/);
  assert.match(freshIndex, /id="disputeCustName"/);
  assert.match(freshIndex, /id="disputeCustPhone"/);
  assert.match(freshIndex, /id="disputeCustBalance"/);
  assert.match(freshIndex, /id="disputeCategorySelect"/);
  assert.match(freshIndex, /id="disputeBillMonthSelect"/);
  assert.match(freshIndex, /id="disputeAmountInput"/);
  assert.match(freshIndex, /id="disputeClaimedDateInput"/);
  assert.match(freshIndex, /id="disputeEvidenceInput"/);
  assert.match(freshIndex, /id="disputeReasonInput"/);
  assert.match(freshIndex, /id="disputeStatusSelect"/);
  assert.match(freshIndex, /id="disputeApprovedAmountInput"/);
  assert.match(freshIndex, /id="disputeFiledByInput"/);
  assert.match(freshIndex, /id="disputeResolvedByInput"/);
  assert.match(freshIndex, /id="disputeResolutionNotesInput"/);
  assert.match(freshIndex, /id="disputePreviewTicket"/);
  assert.match(freshIndex, /id="disputePreviewCredit"/);
  assert.match(freshIndex, /id="disputePreviewNetBal"/);
  assert.match(freshIndex, /id="disputePreviewRecommendation"/);
  assert.match(freshIndex, /id="submitDisputeClaimBtn"/);
  assert.match(freshIndex, /id="printDisputeA4Btn"/);
  assert.match(freshIndex, /id="printDisputeSlipBtn"/);
  assert.match(freshIndex, /id="whatsappDisputeBtn"/);
  assert.match(freshIndex, /id="exportDisputeCsvBtn"/);
  assert.match(freshIndex, /id="disputeHistoryTableBody"/);

  // app.js
  assert.match(freshApp, /setupDisputeClaimModal/);
  assert.match(freshApp, /customerDisputeModalController/);
  assert.match(freshApp, /#openDisputeClaimBtn/);

  // styles.css
  assert.match(freshStyles, /\.dispute-modal-card/);
  assert.match(freshStyles, /\.dispute-customer-ribbon/);
  assert.match(freshStyles, /\.dispute-grid/);
  assert.match(freshStyles, /\.dispute-col/);
  assert.match(freshStyles, /\.dispute-preview-box/);
  assert.match(freshStyles, /\.dispute-history-section/);
  assert.match(freshStyles, /\[data-theme="dark"\]\s+\.dispute-modal/);
});

test('exportDisputeClaimsSummaryStats aggregates claims, status counts, categories, and recovery rate', async () => {
  const { exportDisputeClaimsSummaryStats } = await import('../form-validation.js');

  const claims = [
    { ticketNumber: 'DSP-01', disputedAmount: 1000, approvedAmount: 1000, category: 'unrecorded_payment', status: 'APPROVED_FULL' },
    { ticketNumber: 'DSP-02', disputedAmount: 1500, approvedAmount: 500, category: 'speed_issue', status: 'APPROVED_PARTIAL' },
    { ticketNumber: 'DSP-03', disputedAmount: 2000, approvedAmount: 0, category: 'unrecorded_payment', status: 'UNDER_INVESTIGATION' },
    { ticketNumber: 'DSP-04', disputedAmount: 500, approvedAmount: 0, category: 'other', status: 'REJECTED' }
  ];

  const stats = exportDisputeClaimsSummaryStats(claims);
  assert.equal(stats.totalClaims, 4);
  assert.equal(stats.totalDisputedAmount, 5000);
  assert.equal(stats.totalApprovedAmount, 1500);
  assert.equal(stats.pendingCount, 1);
  assert.equal(stats.approvedCount, 2);
  assert.equal(stats.rejectedCount, 1);
  assert.equal(stats.categoryBreakdown.unrecorded_payment, 2);
  assert.equal(stats.categoryBreakdown.speed_issue, 1);
  assert.equal(stats.recoveryRate, 30.0); // 1500 / 5000 * 100 = 30%

  // Fallback for empty list
  const emptyStats = exportDisputeClaimsSummaryStats([]);
  assert.equal(emptyStats.totalClaims, 0);
  assert.equal(emptyStats.totalDisputedAmount, 0);
  assert.equal(emptyStats.recoveryRate, 0);
});

test('filterDisputeClaims filters claims by status, category, and keyword search', async () => {
  const { filterDisputeClaims } = await import('../form-validation.js');

  const claims = [
    { ticketNumber: 'DSP-202610-001', customerName: 'Zahid Khan', customerPhone: '03001112233', category: 'unrecorded_payment', status: 'APPROVED_FULL', reason: 'Direct bank transfer slip' },
    { ticketNumber: 'DSP-202610-002', customerName: 'Hamza Farooq', customerPhone: '03214445566', category: 'speed_issue', status: 'UNDER_INVESTIGATION', reason: 'High packet loss on fiber line' },
    { ticketNumber: 'DSP-202610-003', customerName: 'Rashid Minhas', customerPhone: '03337778899', category: 'unrecorded_payment', status: 'SUBMITTED', reason: 'Cash collected by Umair' }
  ];

  const all = filterDisputeClaims(claims);
  assert.equal(all.length, 3);

  const byStatus = filterDisputeClaims(claims, { status: 'APPROVED_FULL' });
  assert.equal(byStatus.length, 1);
  assert.equal(byStatus[0].ticketNumber, 'DSP-202610-001');

  const byCat = filterDisputeClaims(claims, { category: 'unrecorded_payment' });
  assert.equal(byCat.length, 2);

  const bySearchTicket = filterDisputeClaims(claims, { search: '002' });
  assert.equal(bySearchTicket.length, 1);
  assert.equal(bySearchTicket[0].customerName, 'Hamza Farooq');

  const bySearchReason = filterDisputeClaims(claims, { search: 'fiber line' });
  assert.equal(bySearchReason.length, 1);
  assert.equal(bySearchReason[0].customerName, 'Hamza Farooq');

  const noMatch = filterDisputeClaims(claims, { search: 'nonexistent query' });
  assert.equal(noMatch.length, 0);
});

// ============================================================================
// PTA Regulatory KYC Compliance Register & CNIC Identity Audit Tests
// ============================================================================

test('parsePakistaniCnicDetails parses valid NADRA CNICs and resolves province and gender', () => {
  // Punjab male (starts with 3, ends with odd digit)
  const cnic1 = parsePakistaniCnicDetails('35202-1234567-1');
  assert.equal(cnic1.valid, true);
  assert.equal(cnic1.formatted, '35202-1234567-1');
  assert.equal(cnic1.raw, '3520212345671');
  assert.equal(cnic1.provinceCode, '3');
  assert.match(cnic1.provinceName, /Punjab/);
  assert.equal(cnic1.genderCode, '1');
  assert.equal(cnic1.gender, 'Male');

  // Sindh female (starts with 4, ends with even digit)
  const cnic2 = parsePakistaniCnicDetails('42101-7654321-2');
  assert.equal(cnic2.valid, true);
  assert.equal(cnic2.provinceName, 'Sindh');
  assert.equal(cnic2.gender, 'Female');

  // KPK male (starts with 1)
  const cnic3 = parsePakistaniCnicDetails('1730198765431');
  assert.equal(cnic3.valid, true);
  assert.equal(cnic3.formatted, '17301-9876543-1');
  assert.match(cnic3.provinceName, /Khyber Pakhtunkhwa/);
  assert.equal(cnic3.gender, 'Male');

  // Balochistan female (starts with 5)
  const cnic4 = parsePakistaniCnicDetails('54400-3333333-4');
  assert.equal(cnic4.valid, true);
  assert.equal(cnic4.provinceName, 'Balochistan');
  assert.equal(cnic4.gender, 'Female');

  // Islamabad Capital Territory (starts with 6)
  const cnic5 = parsePakistaniCnicDetails('61101-5555555-5');
  assert.equal(cnic5.valid, true);
  assert.equal(cnic5.provinceName, 'Islamabad (ICT)');

  // Gilgit-Baltistan / AJK (starts with 7)
  const cnic6 = parsePakistaniCnicDetails('71501-8888888-7');
  assert.equal(cnic6.valid, true);
  assert.equal(cnic6.provinceName, 'Gilgit-Baltistan / AJK');
});

test('parsePakistaniCnicDetails detects invalid formats, missing values, and bad province digits', () => {
  // Empty / null
  const emptyRes = parsePakistaniCnicDetails('');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.reason, /No CNIC provided/i);

  // Short length (11 digits)
  const shortRes = parsePakistaniCnicDetails('35202-123456');
  assert.equal(shortRes.valid, false);
  assert.match(shortRes.reason, /13 numeric digits/i);

  // Long length (15 digits)
  const longRes = parsePakistaniCnicDetails('352021234567199');
  assert.equal(longRes.valid, false);
  assert.match(longRes.reason, /13 numeric digits/i);

  // Invalid province prefix digit 0 or 8
  const invalidProvince = parsePakistaniCnicDetails('85202-1234567-1');
  assert.equal(invalidProvince.valid, false);
  assert.match(invalidProvince.reason, /Invalid province identifier/i);

  // Alphanumeric
  const alphaRes = parsePakistaniCnicDetails('35202-ABCDEFG-1');
  assert.equal(alphaRes.valid, false);
});

test('calculateKycComplianceAudit analyzes customer base and flags missing, invalid, and duplicate CNICs', () => {
  const dummyState = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Tariq Mehmood', cnic: '35202-1111111-1', phone: '03001111111', mohalla: 'Main Bazaar', archived: false },
      { id: 'c2', customerNumber: 2, name: 'Nasir Iqbal', cnic: '35202-2222222-2', phone: '03002222222', mohalla: 'Kot Mohibbu', archived: false },
      { id: 'c3', customerNumber: 3, name: 'Sajid Ali', cnic: '', phone: '03003333333', mohalla: 'Main Bazaar', archived: false }, // missing
      { id: 'c4', customerNumber: 4, name: 'Rashid Khan', cnic: '12345', phone: '03004444444', mohalla: 'Saeed Park', archived: false }, // invalid
      { id: 'c5', customerNumber: 5, name: 'Imran Ashraf', cnic: '35202-1111111-1', phone: '03005555555', mohalla: 'Main Bazaar', archived: false }, // duplicate of c1!
      { id: 'c6', customerNumber: 6, name: 'Archived User', cnic: '', phone: '03006666666', mohalla: 'Other', archived: true } // archived
    ]
  };

  const auditActive = calculateKycComplianceAudit(dummyState, { includeArchived: false });
  assert.equal(auditActive.totalAudited, 5);
  assert.equal(auditActive.missingCount, 1);
  assert.equal(auditActive.invalidCount, 1);
  assert.equal(auditActive.duplicateCount, 2); // c1 and c5 both flagged as duplicate
  assert.equal(auditActive.compliantCount, 1); // only c2 is fully compliant unique
  assert.equal(auditActive.complianceRate, 20.0); // 1 / 5 = 20%
  assert.equal(auditActive.riskLevel, 'HIGH_RISK');

  // Verify records structure
  const recC1 = auditActive.records.find(r => r.customerId === 'c1');
  assert.equal(recC1.status, 'DUPLICATE_CNIC');
  assert.equal(recC1.isDuplicate, true);

  const recC3 = auditActive.records.find(r => r.customerId === 'c3');
  assert.equal(recC3.status, 'MISSING_CNIC');
  assert.equal(recC3.statusLabel, 'Missing CNIC');

  const recC4 = auditActive.records.find(r => r.customerId === 'c4');
  assert.equal(recC4.status, 'INVALID_FORMAT');

  // Include archived
  const auditAll = calculateKycComplianceAudit(dummyState, { includeArchived: true });
  assert.equal(auditAll.totalAudited, 6);
  assert.equal(auditAll.missingCount, 2);

  // Handles null / empty gracefully
  const emptyAudit = calculateKycComplianceAudit(null);
  assert.equal(emptyAudit.totalAudited, 0);
  assert.equal(emptyAudit.complianceRate, 100);
});

test('calculateKycComplianceAudit rates risk levels properly (LOW, MODERATE, HIGH)', () => {
  // 100% compliant -> LOW_RISK
  const stateLow = {
    customers: [
      { id: 'c1', cnic: '35202-1111111-1', archived: false },
      { id: 'c2', cnic: '35202-2222222-2', archived: false }
    ]
  };
  const auditLow = calculateKycComplianceAudit(stateLow);
  assert.equal(auditLow.complianceRate, 100);
  assert.equal(auditLow.riskLevel, 'LOW_RISK');

  // 80% compliant (4 out of 5) -> MODERATE_RISK
  const stateMod = {
    customers: [
      { id: 'c1', cnic: '35202-1111111-1', archived: false },
      { id: 'c2', cnic: '35202-2222222-2', archived: false },
      { id: 'c3', cnic: '35202-3333333-3', archived: false },
      { id: 'c4', cnic: '35202-4444444-4', archived: false },
      { id: 'c5', cnic: '', archived: false } // 1 missing out of 5 = 80%
    ]
  };
  const auditMod = calculateKycComplianceAudit(stateMod);
  assert.equal(auditMod.complianceRate, 80);
  assert.equal(auditMod.riskLevel, 'MODERATE_RISK');
});

test('filterKycComplianceRecords filters by status, sector, and search query', () => {
  const records = [
    { customerId: 'c1', customerNumber: 101, name: 'Muhammad Ali', phone: '03001234567', cnic: '35202-1111111-1', mohalla: 'Main Bazaar', status: 'COMPLIANT' },
    { customerId: 'c2', customerNumber: 102, name: 'Usman Ghani', phone: '03217654321', cnic: '', mohalla: 'Kot Mohibbu', status: 'MISSING' },
    { customerId: 'c3', customerNumber: 103, name: 'Kashif Mehmood', phone: '03459876543', cnic: '999', mohalla: 'Main Bazaar', status: 'INVALID' }
  ];

  assert.equal(filterKycComplianceRecords(records).length, 3);
  assert.equal(filterKycComplianceRecords(records, { status: 'MISSING' }).length, 1);
  assert.equal(filterKycComplianceRecords(records, { status: 'MISSING' })[0].customerId, 'c2');
  assert.equal(filterKycComplianceRecords(records, { sector: 'Kot Mohibbu' }).length, 1);
  assert.equal(filterKycComplianceRecords(records, { search: 'Kashif' }).length, 1);
  assert.equal(filterKycComplianceRecords(records, { search: '0321' }).length, 1);
  assert.equal(filterKycComplianceRecords(records, { search: '1111111' }).length, 1);
  assert.equal(filterKycComplianceRecords(records, { search: 'nonexistent' }).length, 0);
});

test('generateKycNoticeWhatsAppText formats PTA compliance reminder message with Urdu & English', () => {
  const customer = {
    customerNumber: 42,
    name: 'Asim Raza',
    phone: '03009988776'
  };

  const text = generateKycNoticeWhatsAppText(customer);
  assert.match(text, /PTA SUBSCRIBER IDENTITY VERIFICATION NOTICE/i);
  assert.match(text, /Asim Raza/);
  assert.match(text, /CNIC/);
  assert.match(text, /Pakistan Telecommunication Authority|شاہدرہ/);

  // Null input handles safely
  assert.equal(generateKycNoticeWhatsAppText(null), '');
});

test('generateKycComplianceCsv and generateKycCompliancePrintHtml produce valid outputs', () => {
  const auditData = {
    generatedAt: '2026-10-16T09:00:00.000Z',
    totalAudited: 2,
    compliantCount: 1,
    missingCount: 1,
    invalidCount: 0,
    duplicateCount: 0,
    complianceRate: 50.0,
    riskLevel: 'HIGH_RISK',
    riskLabel: 'HIGH RISK (Immediate Rectification Required)',
    provinces: { Punjab: 1 },
    genderCount: { Male: 1, Female: 0, Unknown: 1 },
    records: [
      {
        customerId: 'c1', customerNumber: 1, name: 'Ali Raza', phone: '03001234567',
        mohalla: 'Main Bazaar', cnic: '35202-1111111-1', formattedCnic: '35202-1111111-1',
        status: 'VERIFIED', statusLabel: 'Verified', province: 'Punjab', gender: 'Male', reason: 'Valid CNIC'
      },
      {
        customerId: 'c2', customerNumber: 2, name: 'Bilal Ahmad', phone: '03217654321',
        mohalla: 'Kot Mohibbu', cnic: '', formattedCnic: 'NOT_RECORDED',
        status: 'MISSING_CNIC', statusLabel: 'Missing CNIC', province: 'Unknown', gender: 'Unknown', reason: 'No CNIC provided'
      }
    ]
  };

  const csv = generateKycComplianceCsv(auditData);
  assert.match(csv, /CNIC Number/);
  assert.match(csv, /Ali Raza/);
  assert.match(csv, /35202-1111111-1/);
  assert.match(csv, /Bilal Ahmad/);

  const html = generateKycCompliancePrintHtml(auditData);
  assert.match(html, /PTA Subscriber KYC Register/i);
  assert.match(html, /Ali Raza/);
  assert.match(html, /Kot Mohibbu/);
  assert.match(html, /Audit Verified|HIGH RISK/);

  // Edge cases
  assert.equal(generateKycComplianceCsv(null), '');
  assert.equal(generateKycCompliancePrintHtml(null), '');
});

test('DOM wiring: index.html contains KYC audit modal and button', () => {
  assert.match(index, /id="openKycAuditBtn"/);
  assert.match(index, /id="kycComplianceModal"/);
  assert.match(index, /id="kycStatusFilter"/);
  assert.match(index, /id="kycSectorFilter"/);
  assert.match(index, /id="kycSearchInput"/);
  assert.match(index, /id="downloadKycCsvBtn"/);
  assert.match(index, /id="printKycRegisterBtn"/);
  assert.match(index, /id="copyKycStatementBtn"/);
  assert.match(index, /id="kycTableBody"/);
});

test('CSS styling: styles.css contains KYC modal styles and dark mode rules', () => {
  assert.match(styles, /\.kyc-modal-card/);
  assert.match(styles, /\.kyc-metrics-bar/);
  assert.match(styles, /\.kyc-metric-pill/);
  assert.match(styles, /\.kyc-controls-toolbar/);
  assert.match(styles, /\.kyc-table-scroll/);
  assert.match(styles, /\[data-theme="dark"\] \.kyc-modal-card/);
});

test('app.js exports and wires customerKycComplianceModalController', () => {
  assert.match(app, /setupKycComplianceModal/);
  assert.match(app, /customerKycComplianceModalController/);
  assert.match(app, /openKycAuditBtn/);
});

test('validateEquipmentRetrieval checks subscriber, equipment type, serial, status, technician, and non-negative amounts', async () => {
  const { validateEquipmentRetrieval } = await import('../form-validation.js');

  const valid = validateEquipmentRetrieval({
    customerId: 'cust-1',
    equipmentType: 'ont_gpon',
    serialNumber: 'HG8546M-12345',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair Field Lead',
    recoveryDate: '2026-10-16',
    securityDepositHeld: 3000,
    damageDeduction: 0,
    unreturnedPenalty: 0
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});

  const missingCust = validateEquipmentRetrieval({
    customerId: '',
    equipmentType: 'ont_gpon',
    serialNumber: 'HG8546M-12345',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair',
    recoveryDate: '2026-10-16'
  });
  assert.equal(missingCust.valid, false);
  assert.match(missingCust.errors.customerId, /Subscriber selection/);

  const invalidType = validateEquipmentRetrieval({
    customerId: 'cust-1',
    equipmentType: 'invalid_type_xyz',
    serialNumber: '12345',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair',
    recoveryDate: '2026-10-16'
  });
  assert.equal(invalidType.valid, false);
  assert.match(invalidType.errors.equipmentType, /equipment type/);

  const shortSerial = validateEquipmentRetrieval({
    customerId: 'cust-1',
    equipmentType: 'ont_gpon',
    serialNumber: '12',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair',
    recoveryDate: '2026-10-16'
  });
  assert.equal(shortSerial.valid, false);
  assert.match(shortSerial.errors.serialNumber, /min 3 chars/);

  const invalidDate = validateEquipmentRetrieval({
    customerId: 'cust-1',
    equipmentType: 'ont_gpon',
    serialNumber: '12345',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair',
    recoveryDate: 'not-a-date'
  });
  assert.equal(invalidDate.valid, false);
  assert.match(invalidDate.errors.recoveryDate, /YYYY-MM-DD/);

  const negAmount = validateEquipmentRetrieval({
    customerId: 'cust-1',
    equipmentType: 'ont_gpon',
    serialNumber: '12345',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair',
    recoveryDate: '2026-10-16',
    securityDepositHeld: -500
  });
  assert.equal(negAmount.valid, false);
  assert.match(negAmount.errors.securityDepositHeld, /negative/);
});

test('calculateEquipmentSettlement computes net refund, balance due, and balanced status', async () => {
  const { calculateEquipmentSettlement } = await import('../form-validation.js');

  // Case 1: Refund due to subscriber (Deposit 3000, damage 500 => Refund 2500)
  const res1 = calculateEquipmentSettlement({
    securityDepositHeld: 3000,
    damageDeduction: 500,
    unreturnedPenalty: 0,
    monthlyArrears: 0
  });
  assert.equal(res1.securityDepositHeld, 3000);
  assert.equal(res1.totalDeductions, 500);
  assert.equal(res1.netRefundToSubscriber, 2500);
  assert.equal(res1.netDueFromSubscriber, 0);
  assert.equal(res1.isBalanced, false);

  // Case 2: Balance due from subscriber (Deposit 3000, deductions 4500 => Due 1500)
  const res2 = calculateEquipmentSettlement({
    securityDepositHeld: 3000,
    damageDeduction: 1000,
    unreturnedPenalty: 1500,
    monthlyArrears: 2000
  });
  assert.equal(res2.totalDeductions, 4500);
  assert.equal(res2.netRefundToSubscriber, 0);
  assert.equal(res2.netDueFromSubscriber, 1500);
  assert.equal(res2.isBalanced, false);

  // Case 3: Balanced ledger (Deposit 3000, deductions 3000 => Both 0)
  const res3 = calculateEquipmentSettlement({
    securityDepositHeld: 3000,
    damageDeduction: 3000
  });
  assert.equal(res3.netRefundToSubscriber, 0);
  assert.equal(res3.netDueFromSubscriber, 0);
  assert.equal(res3.isBalanced, true);
});

test('buildEquipmentRetrievalRecord formats sequential manifest number and structured metadata', async () => {
  const { buildEquipmentRetrievalRecord } = await import('../form-validation.js');

  const customer = {
    id: 'seed-005',
    customerNumber: 5,
    name: 'Tariq Butt',
    phone: '03007654321',
    area: 'Kot Mohibbu'
  };

  const rec = buildEquipmentRetrievalRecord({
    customer,
    equipmentType: 'ont_gpon',
    brandModel: 'Huawei HG8546M',
    serialNumber: 'SN48575443ABC1',
    conditionRating: 'excellent',
    retrievalStatus: 'retrieved',
    technicianName: 'Umair Field Lead',
    recoveryDate: '2026-10-16',
    securityDepositHeld: 3500,
    damageDeduction: 0,
    existingCount: 3
  });

  assert.equal(rec.manifestNumber, 'RET-202610-0004');
  assert.equal(rec.customerId, 'seed-005');
  assert.equal(rec.customerName, 'Tariq Butt');
  assert.equal(rec.equipmentType, 'ont_gpon');
  assert.equal(rec.equipmentTypeLabel, 'GPON ONT / ONU Optical Modem');
  assert.equal(rec.serialNumber, 'SN48575443ABC1');
  assert.equal(rec.conditionRating, 'excellent');
  assert.equal(rec.retrievalStatus, 'retrieved');
  assert.equal(rec.settlement.netRefundToSubscriber, 3500);
});

test('equipment retrieval storage functions manage saved records and status updates safely', async () => {
  const {
    getSavedEquipmentRetrievals,
    saveEquipmentRetrieval,
    updateEquipmentRetrievalStatus,
    clearEquipmentRetrievals
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.deepEqual(getSavedEquipmentRetrievals(mockStorage), []);

  const record1 = {
    id: 'ret-1',
    manifestNumber: 'RET-202610-0001',
    customerName: 'Khurram Shehzad',
    equipmentTypeLabel: 'GPON ONT',
    retrievalStatus: 'pending_retrieval',
    settlement: { securityDepositHeld: 3000, netRefundToSubscriber: 3000 }
  };

  saveEquipmentRetrieval(record1, mockStorage);
  assert.equal(getSavedEquipmentRetrievals(mockStorage).length, 1);

  // Update status
  const updated = updateEquipmentRetrievalStatus('RET-202610-0001', 'retrieved', mockStorage, {
    updatedBy: 'NOC Manager',
    note: 'Physically checked into store'
  });
  assert.equal(updated.retrievalStatus, 'retrieved');
  assert.equal(updated.statusUpdatedBy, 'NOC Manager');

  // Clear
  clearEquipmentRetrievals(mockStorage);
  assert.deepEqual(getSavedEquipmentRetrievals(mockStorage), []);
});

test('calculateEquipmentRetrievalMetrics aggregates counts, settlement amounts, and recovery rate', async () => {
  const { calculateEquipmentRetrievalMetrics } = await import('../form-validation.js');

  const sampleList = [
    {
      manifestNumber: 'RET-202610-0001',
      customerName: 'Asim Raza',
      customerPhone: '03001112233',
      customerArea: 'Main Bazar',
      retrievalStatus: 'retrieved',
      settlement: { securityDepositHeld: 3000, netRefundToSubscriber: 3000, totalDeductions: 0 }
    },
    {
      manifestNumber: 'RET-202610-0002',
      customerName: 'Zahid Khan',
      customerPhone: '03214445566',
      customerArea: 'Chowk Shahdara',
      retrievalStatus: 'pending_retrieval',
      settlement: { securityDepositHeld: 3500, netRefundToSubscriber: 2500, totalDeductions: 1000 }
    },
    {
      manifestNumber: 'RET-202610-0003',
      customerName: 'Noman Butt',
      customerPhone: '03337778899',
      customerArea: 'Saeed Park',
      retrievalStatus: 'damaged_unusable',
      settlement: { securityDepositHeld: 3000, netRefundToSubscriber: 0, totalDeductions: 3000 }
    }
  ];

  const res = calculateEquipmentRetrievalMetrics(sampleList);
  assert.equal(res.metrics.totalCount, 3);
  assert.equal(res.metrics.retrievedCount, 1);
  assert.equal(res.metrics.pendingCount, 1);
  assert.equal(res.metrics.damagedCount, 1);
  assert.equal(res.metrics.totalDepositHeld, 9500);
  assert.equal(res.metrics.totalRefunded, 5500);
  assert.equal(res.metrics.totalDeductions, 4000);
  assert.equal(res.metrics.recoveryRatePercent, 33);

  // Filter by query
  const queryRes = calculateEquipmentRetrievalMetrics(sampleList, { query: 'Zahid' });
  assert.equal(queryRes.filtered.length, 1);
  assert.equal(queryRes.filtered[0].customerName, 'Zahid Khan');

  // Filter by status
  const pendingRes = calculateEquipmentRetrievalMetrics(sampleList, { statusFilter: 'pending' });
  assert.equal(pendingRes.filtered.length, 1);
  assert.equal(pendingRes.filtered[0].retrievalStatus, 'pending_retrieval');
});

test('formatEquipmentRetrievalWhatsApp builds professional bilingual notification', async () => {
  const { formatEquipmentRetrievalWhatsApp } = await import('../form-validation.js');

  const record = {
    manifestNumber: 'RET-202610-0012',
    recoveryDate: '2026-10-16',
    customerName: 'Muhammad Arshad',
    customerNumber: 42,
    customerArea: 'Main Bazar Shahdara',
    customerPhone: '03001234567',
    equipmentTypeLabel: 'GPON ONT / ONU Optical Modem',
    brandModel: 'Huawei HG8546M',
    serialNumber: '48575443ABC123',
    conditionLabel: 'Good Working Condition',
    retrievalStatusLabel: 'Retrieved & In Custody',
    retrievalStatusLabelUrdu: 'موصول شدہ / برآمد',
    technicianName: 'Umair Field Lead',
    conditionNotes: 'Adapter intact',
    settlement: {
      securityDepositHeld: 3000,
      damageDeduction: 0,
      unreturnedPenalty: 0,
      monthlyArrears: 0,
      netRefundToSubscriber: 3000,
      netDueFromSubscriber: 0
    }
  };

  const text = formatEquipmentRetrievalWhatsApp(record);
  assert.match(text, /SHAHDARA BROADBAND - HARDWARE RETRIEVAL MANIFEST/);
  assert.match(text, /RET-202610-0012/);
  assert.match(text, /Muhammad Arshad/);
  assert.match(text, /Huawei HG8546M/);
  assert.match(text, /48575443ABC123/);
  assert.match(text, /NET REFUND PAYABLE TO SUBSCRIBER:\*\s+\*PKR 3,000\*/);
  assert.match(text, /Umair Field Lead/);
});

test('generateEquipmentRetrievalHtml produces standard A4 and 80mm thermal slips', async () => {
  const { generateEquipmentRetrievalHtml } = await import('../form-validation.js');

  const record = {
    manifestNumber: 'RET-202610-0015',
    recoveryDate: '2026-10-16',
    customerName: 'Sajid Mehmood',
    customerNumber: 99,
    customerArea: 'Chowk Shahdara',
    customerPhone: '03219876543',
    equipmentTypeLabel: 'GPON ONT',
    brandModel: 'Huawei HG8546M',
    serialNumber: 'HW8546M-999',
    conditionLabel: 'Good Working Condition',
    retrievalStatusLabel: 'Retrieved & In Custody',
    technicianName: 'Umair Lead',
    settlement: {
      securityDepositHeld: 3000,
      damageDeduction: 500,
      totalDeductions: 500,
      netRefundToSubscriber: 2500,
      netDueFromSubscriber: 0
    }
  };

  // Standard A4 layout
  const a4 = generateEquipmentRetrievalHtml(record, { format: 'standard' });
  assert.match(a4, /SUBSCRIBER EQUIPMENT CUSTODY &amp; RETRIEVAL MANIFEST/);
  assert.match(a4, /RET-202610-0015/);
  assert.match(a4, /Sajid Mehmood/);
  assert.match(a4, /HW8546M-999/);
  assert.match(a4, /PKR 2,500/);
  assert.match(a4, /Umair Lead/);

  // Thermal 80mm layout
  const thermal = generateEquipmentRetrievalHtml(record, { format: 'thermal' });
  assert.match(thermal, /thermal-receipt-container/);
  assert.match(thermal, /SHAHDARA BROADBAND/);
  assert.match(thermal, /RET-202610-0015/);
  assert.match(thermal, /Refund Due: PKR 2,500/);
});

test('generateEquipmentRetrievalCsv exports RFC-4180 CSV with UTF-8 BOM', async () => {
  const { generateEquipmentRetrievalCsv } = await import('../form-validation.js');

  const records = [
    {
      manifestNumber: 'RET-202610-0001',
      recoveryDate: '2026-10-16',
      customerNumber: 1,
      customerName: 'Ali Raza',
      customerArea: 'Main Bazar',
      customerPhone: '03001234567',
      equipmentTypeLabel: 'GPON ONT',
      brandModel: 'Huawei HG8546M',
      serialNumber: 'SN-001',
      conditionLabel: 'Like New',
      retrievalStatusLabel: 'Retrieved',
      technicianName: 'Umair',
      settlement: { securityDepositHeld: 3000, netRefundToSubscriber: 3000 }
    }
  ];

  const csv = generateEquipmentRetrievalCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Manifest Number","Date"/);
  assert.match(csv, /"RET-202610-0001"/);
  assert.match(csv, /"Ali Raza"/);
  assert.match(csv, /"SN-001"/);
});

test('setupEquipmentRetrievalModal wires form inputs, settlement calculator, and modal triggers', async () => {
  const { setupEquipmentRetrievalModal } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  const modalEl = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  };

  const custSelect = { innerHTML: '', value: '', addEventListener: () => {} };
  const depositInput = { value: '3000', addEventListener: () => {}, dataset: {} };
  const damageInput = { value: '500', addEventListener: () => {}, dataset: {} };
  const penaltyInput = { value: '0', addEventListener: () => {}, dataset: {} };
  const arrearsInput = { value: '0', addEventListener: () => {}, dataset: {} };
  const netRefundEl = { textContent: '' };
  const netDueEl = { textContent: '' };
  const tableBody = { innerHTML: '', addEventListener: () => {}, dataset: {} };
  const statusFilter = { value: 'all', addEventListener: () => {}, dataset: {} };
  const searchInput = { value: '', addEventListener: () => {}, dataset: {} };
  const closeBtn = { addEventListener: () => {}, dataset: {} };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'equipmentRetrievalModal') return modalEl;
      if (id === 'closeEquipmentRetrievalBtn') return closeBtn;
      if (id === 'retrievalCustomerSelect') return custSelect;
      if (id === 'retrievalDepositInput') return depositInput;
      if (id === 'retrievalDamageInput') return damageInput;
      if (id === 'retrievalPenaltyInput') return penaltyInput;
      if (id === 'retrievalArrearsInput') return arrearsInput;
      if (id === 'retrievalNetRefundVal') return netRefundEl;
      if (id === 'retrievalNetDueVal') return netDueEl;
      if (id === 'equipmentRetrievalTableBody') return tableBody;
      if (id === 'retrievalFilterStatus') return statusFilter;
      if (id === 'retrievalSearchInput') return searchInput;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '[data-open-equipment-retrieval]') return [];
      return [];
    }
  };

  try {
    const controller = setupEquipmentRetrievalModal({
      getState: () => ({ customers: [{ id: 'c1', name: 'Zeeshan' }] }),
      storage: mockStorage
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');

    controller.open();
    assert.equal(modalOpened, true);

    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('DOM and styling: index.html, styles.css, and app.js wire Equipment Retrieval Return Manifest completely', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /id="openEquipmentRetrievalBtn"/);
  assert.match(indexHtml, /<dialog id="equipmentRetrievalModal" class="modal equipment-retrieval-modal"/);
  assert.match(indexHtml, /id="closeEquipmentRetrievalBtn"/);
  assert.match(indexHtml, /id="retrievalCustomerSelect"/);
  assert.match(indexHtml, /id="retrievalTypeSelect"/);
  assert.match(indexHtml, /id="retrievalSerialInput"/);
  assert.match(indexHtml, /id="retrievalDepositInput"/);
  assert.match(indexHtml, /id="retrievalNetRefundVal"/);
  assert.match(indexHtml, /id="exportEquipmentRetrievalCsvBtn"/);
  assert.match(indexHtml, /id="equipmentRetrievalTableBody"/);

  // styles.css checks
  assert.match(stylesCss, /\.equipment-retrieval-modal-card/);
  assert.match(stylesCss, /\.retrieval-metrics-bar/);
  assert.match(stylesCss, /\.retrieval-metric-pill/);
  assert.match(stylesCss, /\.retrieval-form-grid/);
  assert.match(stylesCss, /\.retrieval-settlement-box/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.equipment-retrieval-modal-card/);

  // app.js checks
  assert.match(appJs, /setupEquipmentRetrievalModal/);
  assert.match(appJs, /customerEquipmentRetrievalModalController/);
  assert.match(appJs, /openEquipmentRetrievalBtn/);
});

test('validateSpliceInspection validates required fields, core counts, and loss boundaries strictly', async () => {
  const { validateSpliceInspection } = await import('../form-validation.js');

  // Valid payload
  const valid = validateSpliceInspection({
    enclosureId: 'FDH-WND-01',
    location: 'Wandala Road Main Chowk',
    inspectorName: 'Umair Lead Splicer',
    inspectionDate: '2026-10-16',
    category: 'NEW_DEPLOYMENT',
    coresCount: 24,
    averageLossDb: 0.035,
    inputPowerDbm: 4.50,
    outputPowerDbm: 4.25,
    checklist: {
      closureSealed: true,
      spliceTraysOrganized: true,
      cableTiesSecured: true,
      dropPigtailsLabeled: true,
      silicaGelReplaced: true
    },
    notes: 'Fusion arc calibrated on Fujikura 88S.'
  });

  assert.equal(valid.isValid, true);
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.sanitized.enclosureId, 'FDH-WND-01');
  assert.equal(valid.sanitized.coresCount, 24);
  assert.equal(valid.sanitized.averageLossDb, 0.035);

  // Invalid payload checks
  const invalid = validateSpliceInspection({
    enclosureId: '',
    location: '',
    inspectorName: 'A',
    inspectionDate: 'invalid-date',
    category: 'UNKNOWN_CATEGORY',
    coresCount: 150,
    averageLossDb: -0.5,
    inputPowerDbm: 100
  });

  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.length >= 7);
  assert.ok(invalid.errors.some(e => e.includes('Enclosure / Pole ID is required')));
  assert.ok(invalid.errors.some(e => e.includes('Installation location')));
  assert.ok(invalid.errors.some(e => e.includes('Lead Splicer')));
  assert.ok(invalid.errors.some(e => e.includes('Valid inspection date')));
  assert.ok(invalid.errors.some(e => e.includes('splicing operation category')));
  assert.ok(invalid.errors.some(e => e.includes('cores spliced must be an integer')));
  assert.ok(invalid.errors.some(e => e.includes('Average splice loss must be a positive number')));
  assert.ok(invalid.errors.some(e => e.includes('Input optical power must be between')));
});

test('calculateSpliceInsertionLoss computes optical attenuation accurately', async () => {
  const { calculateSpliceInsertionLoss } = await import('../form-validation.js');

  assert.equal(calculateSpliceInsertionLoss(4.50, 4.20), 0.30);
  assert.equal(calculateSpliceInsertionLoss(4.50, 4.50), 0);
  assert.equal(calculateSpliceInsertionLoss(4.00, 4.50), 0); // clamped to non-negative
  assert.equal(calculateSpliceInsertionLoss(null, 4.20), null);
  assert.equal(calculateSpliceInsertionLoss('abc', 4.20), null);
});

test('determineSpliceVerdict classifies joint quality according to ITU-T and OSP standards', async () => {
  const { determineSpliceVerdict } = await import('../form-validation.js');

  // Case 1: ≤ 0.05 dB with enclosure sealed and trays organized -> Certified Passed
  const v1 = determineSpliceVerdict(0.035, {
    closureSealed: true,
    spliceTraysOrganized: true,
    cableTiesSecured: true
  });
  assert.equal(v1.verdict, 'PASSED_CERTIFIED');
  assert.ok(v1.label.includes('Certified Passed'));
  assert.equal(v1.statusClass, 'status-passed');

  // Case 2: 0.08 dB with sealed enclosure -> Conditional Pass
  const v2 = determineSpliceVerdict(0.085, { closureSealed: true });
  assert.equal(v2.verdict, 'CONDITIONAL_PASS');
  assert.ok(v2.label.includes('Conditional Pass'));
  assert.equal(v2.statusClass, 'status-conditional');

  // Case 3: > 0.12 dB -> Failed Rework Required
  const v3 = determineSpliceVerdict(0.180, { closureSealed: true });
  assert.equal(v3.verdict, 'FAILED_REWORK');
  assert.ok(v3.label.includes('Failed - Rework Required'));
  assert.equal(v3.statusClass, 'status-failed');

  // Case 4: Excellent loss but unsealed enclosure -> Failed
  const v4 = determineSpliceVerdict(0.025, { closureSealed: false });
  assert.equal(v4.verdict, 'FAILED_REWORK');
  assert.ok(v4.reason.includes('Enclosure rubber gasket not sealed'));
});

test('buildSpliceInspectionRecord constructs sequential inspection ticket with timestamps', async () => {
  const { buildSpliceInspectionRecord } = await import('../form-validation.js');

  const record = buildSpliceInspectionRecord({
    enclosureId: 'FAT-BR-05',
    location: 'Ravi Riverfront Bridge Mast',
    inspectorName: 'Khurram Technician',
    inspectionDate: '2026-10-16',
    category: 'WEATHER_RESTORATION',
    coresCount: 8,
    averageLossDb: 0.040,
    inputPowerDbm: 4.80,
    outputPowerDbm: 4.30,
    checklist: {
      closureSealed: true,
      spliceTraysOrganized: true,
      cableTiesSecured: true,
      dropPigtailsLabeled: true,
      silicaGelReplaced: true
    },
    notes: 'Wind storm snapped drop cable respliced.'
  });

  assert.match(record.id, /^SPL-202610-\d{4}$/);
  assert.equal(record.enclosureId, 'FAT-BR-05');
  assert.equal(record.category, 'WEATHER_RESTORATION');
  assert.equal(record.coresCount, 8);
  assert.equal(record.averageLossDb, 0.040);
  assert.equal(record.insertionLossDb, 0.50);
  assert.equal(record.verdict, 'PASSED_CERTIFIED');
  assert.ok(record.createdAt);
});

test('splice inspection storage functions manage local persistence, status updates, and clearing', async () => {
  const {
    getSavedSpliceInspections,
    saveSpliceInspection,
    updateSpliceInspectionStatus,
    clearSpliceInspections,
    buildSpliceInspectionRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.deepEqual(getSavedSpliceInspections(mockStorage), []);

  const rec1 = buildSpliceInspectionRecord({
    enclosureId: 'FDH-SPD-02',
    location: 'Saeed Park Tubewell',
    inspectorName: 'Farhan Lead',
    inspectionDate: '2026-10-16',
    category: 'CUT_REPAIR',
    coresCount: 12,
    averageLossDb: 0.150,
    checklist: { closureSealed: true }
  });

  saveSpliceInspection(rec1, mockStorage);
  let saved = getSavedSpliceInspections(mockStorage);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, rec1.id);
  assert.equal(saved[0].verdict, 'FAILED_REWORK');

  // Update status to passed after rework
  const updated = updateSpliceInspectionStatus(rec1.id, 'PASSED_CERTIFIED', 'Re-spliced with zero bubbles.', mockStorage);
  assert.ok(updated);
  assert.equal(updated.verdict, 'PASSED_CERTIFIED');

  saved = getSavedSpliceInspections(mockStorage);
  assert.equal(saved[0].verdict, 'PASSED_CERTIFIED');
  assert.ok(saved[0].notes.includes('Re-spliced with zero bubbles'));

  clearSpliceInspections(mockStorage);
  assert.deepEqual(getSavedSpliceInspections(mockStorage), []);
});

test('calculateSpliceInspectionMetrics aggregates KPIs and applies category/verdict/search filters', async () => {
  const { calculateSpliceInspectionMetrics } = await import('../form-validation.js');

  const mockRecords = [
    { id: 'SPL-01', enclosureId: 'FDH-01', location: 'Wandala', category: 'NEW_DEPLOYMENT', coresCount: 12, averageLossDb: 0.030, verdict: 'PASSED_CERTIFIED' },
    { id: 'SPL-02', enclosureId: 'FAT-02', location: 'Saeed Park', category: 'CUT_REPAIR', coresCount: 8, averageLossDb: 0.080, verdict: 'CONDITIONAL_PASS' },
    { id: 'SPL-03', enclosureId: 'FAT-03', location: 'Jia Musa', category: 'CUT_REPAIR', coresCount: 24, averageLossDb: 0.160, verdict: 'FAILED_REWORK' }
  ];

  const metrics = calculateSpliceInspectionMetrics(mockRecords);
  assert.equal(metrics.totalInspections, 3);
  assert.equal(metrics.passedCount, 1);
  assert.equal(metrics.conditionalCount, 1);
  assert.equal(metrics.failedCount, 1);
  assert.equal(metrics.passRatePct, 33);
  assert.equal(metrics.totalCoresSpliced, 44);
  assert.equal(metrics.reworkPendingCount, 1);
  assert.equal(metrics.averageLossDb, 0.090);

  // Filter by category
  const cutRepairMetrics = calculateSpliceInspectionMetrics(mockRecords, { category: 'CUT_REPAIR' });
  assert.equal(cutRepairMetrics.filteredRecords.length, 2);

  // Filter by verdict
  const failedMetrics = calculateSpliceInspectionMetrics(mockRecords, { verdict: 'FAILED_REWORK' });
  assert.equal(failedMetrics.filteredRecords.length, 1);
  assert.equal(failedMetrics.filteredRecords[0].id, 'SPL-03');

  // Search query
  const searchMetrics = calculateSpliceInspectionMetrics(mockRecords, { search: 'Jia Musa' });
  assert.equal(searchMetrics.filteredRecords.length, 1);
  assert.equal(searchMetrics.filteredRecords[0].enclosureId, 'FAT-03');
});

test('formatSpliceInspectionWhatsApp formats structured bilingual field notification text', async () => {
  const { formatSpliceInspectionWhatsApp } = await import('../form-validation.js');

  const record = {
    id: 'SPL-202610-1234',
    inspectionDate: '2026-10-16',
    enclosureId: 'FDH-WND-01',
    location: 'Wandala Road Main Chowk',
    inspectorName: 'Umair Lead Splicer',
    category: 'NEW_DEPLOYMENT',
    coresCount: 24,
    averageLossDb: 0.032,
    inputPowerDbm: 4.50,
    outputPowerDbm: 4.20,
    insertionLossDb: 0.30,
    verdict: 'PASSED_CERTIFIED',
    verdictLabel: '🟢 Certified Passed (Loss ≤ 0.05 dB)',
    checklist: {
      closureSealed: true,
      spliceTraysOrganized: true,
      cableTiesSecured: true,
      dropPigtailsLabeled: true,
      silicaGelReplaced: true
    },
    notes: 'Fiber tube 1 & 2 verified.'
  };

  const text = formatSpliceInspectionWhatsApp(record);
  assert.match(text, /SHAHDARA FIBER NETWORK — OSP SPLICING QA CERTIFICATE/);
  assert.match(text, /SPL-202610-1234/);
  assert.match(text, /FDH-WND-01/);
  assert.match(text, /Wandala Road Main Chowk/);
  assert.match(text, /Umair Lead Splicer/);
  assert.match(text, /24 Cores/);
  assert.match(text, /0.032 dB/);
  assert.match(text, /Total Insertion Loss: 0.3 dB/);
  assert.match(text, /Certified Passed/);
  assert.match(text, /Closure Gasket Sealed: ✅/);
  assert.match(text, /Fiber tube 1 & 2 verified/);
});

test('generateSpliceInspectionHtml creates standard A4 certificate and thermal 80mm slip', async () => {
  const { generateSpliceInspectionHtml } = await import('../form-validation.js');

  const record = {
    id: 'SPL-202610-9876',
    inspectionDate: '2026-10-16',
    enclosureId: 'FDH-STN-04',
    location: 'Shahdara Station Flyover Pillar',
    inspectorName: 'Tariq Field Lead',
    category: 'SPLITTER_EXPANSION',
    coresCount: 16,
    averageLossDb: 0.045,
    inputPowerDbm: 4.80,
    outputPowerDbm: 4.35,
    insertionLossDb: 0.45,
    verdict: 'PASSED_CERTIFIED',
    verdictLabel: '🟢 Certified Passed',
    checklist: {
      closureSealed: true,
      spliceTraysOrganized: true,
      cableTiesSecured: true,
      dropPigtailsLabeled: true,
      silicaGelReplaced: true
    },
    notes: 'Expanded 1:16 PLC splitter on port 4.'
  };

  // Standard A4 Layout
  const standardHtml = generateSpliceInspectionHtml(record, { format: 'standard' });
  assert.match(standardHtml, /SHAHDARA FIBER NETWORK \(PVT\) LTD/);
  assert.match(standardHtml, /SPL-202610-9876/);
  assert.match(standardHtml, /FDH-STN-04/);
  assert.match(standardHtml, /16 Cores/);
  assert.match(standardHtml, /0.045 dB/);
  assert.match(standardHtml, /Lead Splicer Signature/);
  assert.match(standardHtml, /OSP QA Manager/);

  // Thermal 80mm Layout
  const thermalHtml = generateSpliceInspectionHtml(record, { format: 'thermal' });
  assert.match(thermalHtml, /thermal-splice-slip/);
  assert.match(thermalHtml, /SHAHDARA FIBER NET/);
  assert.match(thermalHtml, /SPL-202610-9876/);
  assert.match(thermalHtml, /Splicer Sign &amp; Date/);
});

test('generateSpliceInspectionCsv creates RFC-4180 compliant CSV export with UTF-8 BOM', async () => {
  const { generateSpliceInspectionCsv } = await import('../form-validation.js');

  const records = [
    {
      id: 'SPL-202610-1111',
      inspectionDate: '2026-10-16',
      enclosureId: 'FAT-JM-03',
      location: 'Jia Musa Main Bazaar',
      category: 'CUT_REPAIR',
      coresCount: 8,
      averageLossDb: 0.028,
      inputPowerDbm: 4.20,
      outputPowerDbm: 4.00,
      insertionLossDb: 0.20,
      checklist: {
        closureSealed: true,
        spliceTraysOrganized: true,
        cableTiesSecured: true,
        dropPigtailsLabeled: true,
        silicaGelReplaced: true
      },
      verdict: 'PASSED_CERTIFIED',
      inspectorName: 'Umair Lead',
      notes: 'Road construction cut fixed.'
    }
  ];

  const csv = generateSpliceInspectionCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Inspection ID,Date,Enclosure \/ Pole ID,Location/);
  assert.match(csv, /SPL-202610-1111,2026-10-16,FAT-JM-03,"?Jia Musa Main Bazaar"?,CUT_REPAIR,8,0\.028/);
  assert.match(csv, /PASS,PASS,PASS,PASS,PASS,PASSED_CERTIFIED,"?Umair Lead"?,"?Road construction cut fixed\.?"?/);
});

test('setupSpliceInspectionModal wires interactive modal controls, form submission, and live preview', async () => {
  const { setupSpliceInspectionModal } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let modalOpened = false;
  let modalClosed = false;
  const modalEl = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    addEventListener: () => {}
  };

  const closeBtn = { addEventListener: () => {} };
  const formEl = { addEventListener: () => {}, reset: () => {} };
  const enclosureInput = { value: 'FDH-WND-01' };
  const locationInput = { value: 'Wandala Road' };
  const inspectorInput = { value: 'Umair Lead' };
  const dateInput = { value: '2026-10-16' };
  const categorySelect = { value: 'NEW_DEPLOYMENT' };
  const coresInput = { value: '12' };
  const lossInput = { value: '0.035', addEventListener: () => {} };
  const inputPowerInput = { value: '4.50', addEventListener: () => {} };
  const outputPowerInput = { value: '4.25', addEventListener: () => {} };
  const insertionLossDisplay = { textContent: '' };
  const verdictPreviewBadge = { textContent: '', className: '' };
  const notesInput = { value: 'Clean splice' };

  const checkSealed = { checked: true, addEventListener: () => {} };
  const checkTrays = { checked: true, addEventListener: () => {} };
  const checkTies = { checked: true, addEventListener: () => {} };
  const checkLabeled = { checked: true, addEventListener: () => {} };
  const checkSilica = { checked: true, addEventListener: () => {} };

  const kpiTotal = { textContent: '' };
  const kpiPassRate = { textContent: '' };
  const kpiAvgLoss = { textContent: '' };
  const kpiFailed = { textContent: '' };

  const filterVerdictSelect = { value: 'all', addEventListener: () => {} };
  const filterCategorySelect = { value: 'all', addEventListener: () => {} };
  const searchInput = { value: '', addEventListener: () => {} };
  const tableBody = { innerHTML: '', querySelectorAll: () => [] };
  const exportCsvBtn = { addEventListener: () => {} };

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'spliceInspectionModal') return modalEl;
      if (id === 'spliceInspectionCloseBtn') return closeBtn;
      if (id === 'spliceInspectionForm') return formEl;
      if (id === 'spliceEnclosureIdInput') return enclosureInput;
      if (id === 'spliceLocationInput') return locationInput;
      if (id === 'spliceInspectorInput') return inspectorInput;
      if (id === 'spliceDateInput') return dateInput;
      if (id === 'spliceCategorySelect') return categorySelect;
      if (id === 'spliceCoresInput') return coresInput;
      if (id === 'spliceLossInput') return lossInput;
      if (id === 'spliceInputPowerInput') return inputPowerInput;
      if (id === 'spliceOutputPowerInput') return outputPowerInput;
      if (id === 'spliceInsertionLossDisplay') return insertionLossDisplay;
      if (id === 'spliceVerdictPreviewBadge') return verdictPreviewBadge;
      if (id === 'spliceNotesInput') return notesInput;
      if (id === 'spliceCheckSealed') return checkSealed;
      if (id === 'spliceCheckTrays') return checkTrays;
      if (id === 'spliceCheckTies') return checkTies;
      if (id === 'spliceCheckLabeled') return checkLabeled;
      if (id === 'spliceCheckSilica') return checkSilica;
      if (id === 'spliceKpiTotal') return kpiTotal;
      if (id === 'spliceKpiPassRate') return kpiPassRate;
      if (id === 'spliceKpiAvgLoss') return kpiAvgLoss;
      if (id === 'spliceKpiFailed') return kpiFailed;
      if (id === 'spliceFilterVerdictSelect') return filterVerdictSelect;
      if (id === 'spliceFilterCategorySelect') return filterCategorySelect;
      if (id === 'spliceSearchInput') return searchInput;
      if (id === 'spliceTableBody') return tableBody;
      if (id === 'spliceExportCsvBtn') return exportCsvBtn;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('[data-open-splice-inspection]')) return [];
      return [];
    }
  };

  try {
    const controller = setupSpliceInspectionModal({
      getState: () => ({ customers: [] }),
      storage: mockStorage
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');

    controller.open();
    assert.equal(modalOpened, true);

    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('DOM and styling: index.html, styles.css, and app.js wire Fiber Splicing QA Manifest completely', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /id="openSpliceInspectionBtn"/);
  assert.match(indexHtml, /<dialog id="spliceInspectionModal" class="modal splice-modal"/);
  assert.match(indexHtml, /id="spliceInspectionCloseBtn"/);
  assert.match(indexHtml, /id="spliceKpiTotal"/);
  assert.match(indexHtml, /id="spliceKpiPassRate"/);
  assert.match(indexHtml, /id="spliceKpiAvgLoss"/);
  assert.match(indexHtml, /id="spliceKpiFailed"/);
  assert.match(indexHtml, /id="spliceInspectionForm"/);
  assert.match(indexHtml, /id="spliceEnclosureIdInput"/);
  assert.match(indexHtml, /id="spliceLocationInput"/);
  assert.match(indexHtml, /id="spliceInspectorInput"/);
  assert.match(indexHtml, /id="spliceCategorySelect"/);
  assert.match(indexHtml, /id="spliceLossInput"/);
  assert.match(indexHtml, /id="spliceInsertionLossDisplay"/);
  assert.match(indexHtml, /id="spliceCheckSealed"/);
  assert.match(indexHtml, /id="spliceVerdictPreviewBadge"/);
  assert.match(indexHtml, /id="spliceTableBody"/);
  assert.match(indexHtml, /id="spliceExportCsvBtn"/);

  // styles.css checks
  assert.match(stylesCss, /\.splice-modal-card/);
  assert.match(stylesCss, /\.splice-metrics-ribbon/);
  assert.match(stylesCss, /\.splice-kpi-card/);
  assert.match(stylesCss, /\.splice-form/);
  assert.match(stylesCss, /\.splice-form-grid/);
  assert.match(stylesCss, /\.splice-checklist-fieldset/);
  assert.match(stylesCss, /\.splice-status-badge/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.splice-modal-card/);

  // app.js checks
  assert.match(appJs, /setupSpliceInspectionModal/);
  assert.match(appJs, /customerSpliceInspectionModalController/);
  assert.match(appJs, /openSpliceInspectionBtn/);
});
