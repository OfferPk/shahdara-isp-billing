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

test('calculatePlanMigrationProration accurately computes mid-cycle proration, daily rates, and net adjustment', async () => {
  const { calculatePlanMigrationProration, getDaysInCalendarMonth } = await import('../form-validation.js');

  assert.equal(getDaysInCalendarMonth('2026-10-15'), 31);
  assert.equal(getDaysInCalendarMonth('2026-02-10'), 28);

  // Upgrade from 1500 to 2500 on day 16 of a 30-day month
  // Days elapsed: 15, days remaining: 15
  // Old credit: (1500 / 30) * 15 = 750
  // New charge: (2500 / 30) * 15 = 1250
  // Net adjustment: 1250 - 750 = +500
  const result = calculatePlanMigrationProration(1500, 2500, '2026-04-16', 30);
  assert.equal(result.daysInMonth, 30);
  assert.equal(result.effectiveDay, 16);
  assert.equal(result.daysElapsed, 15);
  assert.equal(result.daysRemaining, 15);
  assert.equal(result.oldPlanCredit, 750);
  assert.equal(result.newPlanCharge, 1250);
  assert.equal(result.netAdjustment, 500);
  assert.equal(result.mrrDelta, 1000);
  assert.ok(result.actionLabel.includes('Subscriber Owes +PKR 500'));

  // Downgrade from 3000 to 1500 on day 11 of a 30-day month
  // Days elapsed: 10, days remaining: 20
  // Old credit: (3000 / 30) * 20 = 2000
  // New charge: (1500 / 30) * 20 = 1000
  // Net adjustment: 1000 - 2000 = -1000 (credit)
  const downgradeResult = calculatePlanMigrationProration(3000, 1500, '2026-04-11', 30);
  assert.equal(downgradeResult.daysElapsed, 10);
  assert.equal(downgradeResult.daysRemaining, 20);
  assert.equal(downgradeResult.oldPlanCredit, 2000);
  assert.equal(downgradeResult.newPlanCharge, 1000);
  assert.equal(downgradeResult.netAdjustment, -1000);
  assert.equal(downgradeResult.mrrDelta, -1500);
  assert.ok(downgradeResult.actionLabel.includes('Credit Refund PKR 1,000'));
});

test('assessPlanCompatibility detects transition classification, speed delta, and hardware bottlenecks', async () => {
  const { assessPlanCompatibility, parseSpeedFromPlanName } = await import('../form-validation.js');

  assert.equal(parseSpeedFromPlanName('15 Mbps Family Streamer'), 15);
  assert.equal(parseSpeedFromPlanName('100 Mbps Gigabit Commercial'), 100);
  assert.equal(parseSpeedFromPlanName('Custom 50M Pro'), 50);

  // Upgrade on Gigabit Ethernet
  const upgrade = assessPlanCompatibility('15 Mbps Family Streamer', '40 Mbps Ultra Fiber HD', 'GE');
  assert.equal(upgrade.migrationType, 'UPGRADE');
  assert.equal(upgrade.currentSpeed, 15);
  assert.equal(upgrade.targetSpeed, 40);
  assert.equal(upgrade.speedDelta, 25);
  assert.equal(upgrade.isHardwareCompatible, true);
  assert.equal(upgrade.warningNotice, null);

  // Downgrade
  const downgrade = assessPlanCompatibility('60 Mbps Pro Power User', '25 Mbps Turbo Broadband', 'GE');
  assert.equal(downgrade.migrationType, 'DOWNGRADE');
  assert.equal(downgrade.speedDelta, -35);

  // Hardware bottleneck with FastEthernet ONT
  const bottleneck = assessPlanCompatibility('25 Mbps Turbo Broadband', '150 Mbps Enterprise Fiber', 'FE');
  assert.equal(bottleneck.isHardwareCompatible, false);
  assert.ok(bottleneck.warningNotice.includes('FastEthernet ONT hardware bottleneck'));
});

test('validatePlanMigration and buildPlanMigrationRecord enforce integrity and generate vouchers', async () => {
  const { validatePlanMigration, buildPlanMigrationRecord } = await import('../form-validation.js');

  // Validation failure cases
  const v1 = validatePlanMigration({});
  assert.equal(v1.valid, false);
  assert.ok(v1.errors.some(e => e.includes('Subscriber profile selection is required')));

  const v2 = validatePlanMigration({
    customerId: 'CUST-001',
    currentPlan: '15 Mbps Family Streamer',
    targetPlan: '15 Mbps Family Streamer',
    targetRate: 1500,
    effectiveDate: '2026-10-16',
    authorizedBy: 'Lead Tech'
  });
  assert.equal(v2.valid, false);
  assert.ok(v2.errors.some(e => e.includes('Target plan must be different')));

  // Valid record builder
  const record = buildPlanMigrationRecord({
    customerId: 'CUST-042',
    customerName: 'Muhammad Rizwan',
    customerPhone: '0300-8877665',
    customerArea: 'Vandala Road',
    currentPlan: '15 Mbps Family Streamer',
    currentRate: 1500,
    targetPlan: '25 Mbps Turbo Broadband',
    targetRate: 2000,
    effectiveDate: '2026-10-16',
    notes: 'Requested high speed for remote development',
    authorizedBy: 'Shahdara Lead NOC'
  });

  assert.ok(record.id.startsWith('MIG-'));
  assert.equal(record.customerName, 'Muhammad Rizwan');
  assert.equal(record.migrationType, 'UPGRADE');
  assert.equal(record.speedDelta, 10);
  assert.equal(record.status, 'COMPLETED');
  assert.ok(record.proration);
  assert.ok(record.compatibility);
});

test('getSavedPlanMigrations, savePlanMigration, and updatePlanMigrationStatus manage persistence', async () => {
  const {
    getSavedPlanMigrations,
    savePlanMigration,
    updatePlanMigrationStatus,
    clearPlanMigrations,
    buildPlanMigrationRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.deepEqual(getSavedPlanMigrations(mockStorage), []);

  const r1 = buildPlanMigrationRecord({
    customerId: 'CUST-001',
    customerName: 'Tariq Mehmood',
    currentPlan: '10 Mbps Standard',
    currentRate: 1200,
    targetPlan: '25 Mbps Turbo',
    targetRate: 2000,
    effectiveDate: '2026-10-16'
  });

  savePlanMigration(r1, mockStorage);
  let list = getSavedPlanMigrations(mockStorage);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, r1.id);
  assert.equal(list[0].status, 'COMPLETED');

  // Update status
  updatePlanMigrationStatus(r1.id, 'PENDING_PROVISIONING', mockStorage);
  list = getSavedPlanMigrations(mockStorage);
  assert.equal(list[0].status, 'PENDING_PROVISIONING');

  clearPlanMigrations(mockStorage);
  assert.deepEqual(getSavedPlanMigrations(mockStorage), []);
});

test('calculatePlanMigrationMetrics computes summary stats and filters records', async () => {
  const { calculatePlanMigrationMetrics } = await import('../form-validation.js');

  const records = [
    { id: 'MIG-01', customerName: 'Ali Khan', customerId: 'CUST-01', targetPlan: '25 Mbps', migrationType: 'UPGRADE', netAdjustment: 400, mrrDelta: 500 },
    { id: 'MIG-02', customerName: 'Zubair Ahmad', customerId: 'CUST-02', targetPlan: '40 Mbps', migrationType: 'UPGRADE', netAdjustment: 600, mrrDelta: 800 },
    { id: 'MIG-03', customerName: 'Kamran Shah', customerId: 'CUST-03', targetPlan: '10 Mbps', migrationType: 'DOWNGRADE', netAdjustment: -300, mrrDelta: -300 }
  ];

  const metrics = calculatePlanMigrationMetrics(records);
  assert.equal(metrics.totalMigrations, 3);
  assert.equal(metrics.upgradeCount, 2);
  assert.equal(metrics.downgradeCount, 1);
  assert.equal(metrics.upgradeRatePct, 67);
  assert.equal(metrics.totalNetAdjustmentPkr, 700);
  assert.equal(metrics.totalMrrDeltaPkr, 1000);

  // Filter by UPGRADE
  const upOnly = calculatePlanMigrationMetrics(records, { filterType: 'UPGRADE' });
  assert.equal(upOnly.filteredRecords.length, 2);

  // Search by query
  const search = calculatePlanMigrationMetrics(records, { searchQuery: 'Kamran' });
  assert.equal(search.filteredRecords.length, 1);
  assert.equal(search.filteredRecords[0].customerId, 'CUST-03');
});

test('formatPlanMigrationWhatsApp and generatePlanMigrationHtml format printable and dispatch outputs', async () => {
  const { formatPlanMigrationWhatsApp, generatePlanMigrationHtml, generatePlanMigrationsCsv } = await import('../form-validation.js');

  const record = {
    id: 'MIG-202610-8899',
    timestamp: '2026-10-16T12:00:00Z',
    customerId: 'CUST-108',
    customerName: 'Asif Nadeem',
    customerPhone: '0321-4455667',
    customerArea: 'Begum Kot',
    currentPlan: '15 Mbps Family Streamer',
    currentRate: 1500,
    targetPlan: '25 Mbps Turbo Broadband',
    targetRate: 2000,
    effectiveDate: '2026-10-16',
    migrationType: 'UPGRADE',
    speedDelta: 10,
    netAdjustment: 250,
    mrrDelta: 500,
    status: 'COMPLETED',
    notes: 'Optical power verified at -19.2 dBm',
    authorizedBy: 'Lead Tech Umar',
    proration: {
      daysInMonth: 30,
      effectiveDay: 16,
      daysElapsed: 15,
      daysRemaining: 15,
      oldPlanCredit: 750,
      newPlanCharge: 1000
    },
    compatibility: {
      currentSpeed: 15,
      targetSpeed: 25,
      speedDelta: 10,
      migrationType: 'UPGRADE'
    }
  };

  // WhatsApp text
  const wa = formatPlanMigrationWhatsApp(record);
  assert.match(wa, /SHAHDARA FIBER NET — PLAN MIGRATION VOUCHER/);
  assert.match(wa, /MIG-202610-8899/);
  assert.match(wa, /Asif Nadeem/);
  assert.match(wa, /15 Mbps Family Streamer/);
  assert.match(wa, /25 Mbps Turbo Broadband/);
  assert.match(wa, /\+10 Mbps Speed Adjustment/);
  assert.match(wa, /PKR 250/);

  // A4 Document
  const a4 = generatePlanMigrationHtml(record, { format: 'standard' });
  assert.match(a4, /plan-migration-document/);
  assert.match(a4, /SERVICE PLAN MIGRATION &amp; BANDWIDTH UPGRADE VOUCHER/);
  assert.match(a4, /Asif Nadeem/);
  assert.match(a4, /Previous Plan/);
  assert.match(a4, /New Target Plan/);

  // Thermal Slip
  const thermal = generatePlanMigrationHtml(record, { format: 'thermal' });
  assert.match(thermal, /thermal-migration-slip/);
  assert.match(thermal, /PLAN MIGRATION RECEIPT/);
  assert.match(thermal, /NET: PKR 250/);

  // CSV
  const csv = generatePlanMigrationsCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Voucher ID/);
  assert.match(csv, /MIG-202610-8899/);
  assert.match(csv, /Asif Nadeem/);
});

test('setupPlanMigrationModal wires controller, recalculation, and modal actions', async () => {
  const { setupPlanMigrationModal } = await import('../form-validation.js');

  let modalOpened = false;
  let modalClosed = false;

  const mockElement = (id) => ({
    id,
    dataset: {},
    children: [],
    selectedOptions: [{ dataset: { price: '2000', speed: '25' } }],
    options: [{ value: '25 Mbps Turbo Broadband', dataset: { price: '2000', speed: '25' } }],
    value: id === 'migTargetRateInput' ? '2000' : (id === 'migEffectiveDateInput' ? '2026-10-16' : ''),
    textContent: '',
    style: {},
    appendChild(child) { this.children.push(child); },
    addEventListener: () => {},
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {}
  });

  const modal = mockElement('customerPlanMigrationModal');
  const closeBtn = mockElement('planMigrationCloseBtn');
  const openBtn = mockElement('openPlanMigrationBtn');

  const customerNameEl = mockElement('migCustomerName');
  const customerMetaEl = mockElement('migCustomerMeta');
  const currentPlanEl = mockElement('migCurrentPlan');
  const currentRateEl = mockElement('migCurrentRate');

  const targetPlanSelect = mockElement('migTargetPlanSelect');
  const targetRateInput = mockElement('migTargetRateInput');
  const effectiveDateInput = mockElement('migEffectiveDateInput');
  const ontPortSelect = mockElement('migOntPortSelect');
  const notesInput = mockElement('migNotesInput');
  const authorizerInput = mockElement('migAuthorizerInput');

  const speedDeltaBadge = mockElement('migSpeedDeltaBadge');
  const prorationSummaryBox = mockElement('migProrationSummaryBox');
  const netDueVal = mockElement('migNetDueVal');
  const mrrDeltaVal = mockElement('migMrrDeltaVal');
  const hardwareWarningBanner = mockElement('migHardwareWarningBanner');

  const submitBtn = mockElement('planMigrationSubmitBtn');
  const printA4Btn = mockElement('planMigrationPrintA4Btn');
  const printThermalBtn = mockElement('planMigrationPrintThermalBtn');
  const copyWhatsAppBtn = mockElement('planMigrationCopyWhatsAppBtn');
  const exportCsvBtn = mockElement('planMigrationExportCsvBtn');

  const filterTypeSelect = mockElement('migFilterTypeSelect');
  const searchInput = mockElement('migSearchInput');
  const tableBody = mockElement('migHistoryTableBody');
  const countBadge = mockElement('migTotalCountBadge');
  const kpiUpgrades = mockElement('migKpiUpgrades');
  const kpiNetMrr = mockElement('migKpiNetMrr');
  const kpiProratedTotal = mockElement('migKpiProratedTotal');

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      const map = {
        customerPlanMigrationModal: modal,
        planMigrationCloseBtn: closeBtn,
        migCustomerName: customerNameEl,
        migCustomerMeta: customerMetaEl,
        migCurrentPlan: currentPlanEl,
        migCurrentRate: currentRateEl,
        migTargetPlanSelect: targetPlanSelect,
        migTargetRateInput: targetRateInput,
        migEffectiveDateInput: effectiveDateInput,
        migOntPortSelect: ontPortSelect,
        migNotesInput: notesInput,
        migAuthorizerInput: authorizerInput,
        migSpeedDeltaBadge: speedDeltaBadge,
        migProrationSummaryBox: prorationSummaryBox,
        migNetDueVal: netDueVal,
        migMrrDeltaVal: mrrDeltaVal,
        migHardwareWarningBanner: hardwareWarningBanner,
        planMigrationSubmitBtn: submitBtn,
        planMigrationPrintA4Btn: printA4Btn,
        planMigrationPrintThermalBtn: printThermalBtn,
        planMigrationCopyWhatsAppBtn: copyWhatsAppBtn,
        planMigrationExportCsvBtn: exportCsvBtn,
        migFilterTypeSelect: filterTypeSelect,
        migSearchInput: searchInput,
        migHistoryTableBody: tableBody,
        migTotalCountBadge: countBadge,
        migKpiUpgrades: kpiUpgrades,
        migKpiNetMrr: kpiNetMrr,
        migKpiProratedTotal: kpiProratedTotal
      };
      return map[id] || null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('data-open-plan-migration') || sel.includes('openPlanMigrationBtn')) {
        return [openBtn];
      }
      return [];
    },
    createElement: (tag) => ({
      tag,
      dataset: {},
      value: '',
      textContent: '',
      setAttribute: () => {},
      removeAttribute: () => {}
    })
  };

  try {
    const controller = setupPlanMigrationModal({
      getState: () => ({ customers: [{ id: 'CUST-001', name: 'Zia Khan', package: '15 Mbps', monthlyFee: 1500 }] })
    });

    assert.ok(controller);
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.recalculate, 'function');

    controller.open({ id: 'CUST-001', name: 'Zia Khan', package: '15 Mbps', monthlyFee: 1500 });
    assert.equal(modalOpened, true);

    controller.close();
    assert.equal(modalClosed, true);
  } finally {
    globalThis.document = origDoc;
  }
});

test('DOM and styling: index.html, styles.css, and app.js wire Plan Migration & Proration completely', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /id="openPlanMigrationBtn"/);
  assert.match(indexHtml, /data-open-plan-migration/);
  assert.match(indexHtml, /<dialog id="customerPlanMigrationModal" class="modal plan-migration-modal"/);
  assert.match(indexHtml, /id="planMigrationCloseBtn"/);
  assert.match(indexHtml, /id="migKpiUpgrades"/);
  assert.match(indexHtml, /id="migKpiNetMrr"/);
  assert.match(indexHtml, /id="migKpiProratedTotal"/);
  assert.match(indexHtml, /id="migCustomerName"/);
  assert.match(indexHtml, /id="migCurrentPlan"/);
  assert.match(indexHtml, /id="migCurrentRate"/);
  assert.match(indexHtml, /id="migTargetPlanSelect"/);
  assert.match(indexHtml, /id="migTargetRateInput"/);
  assert.match(indexHtml, /id="migEffectiveDateInput"/);
  assert.match(indexHtml, /id="migOntPortSelect"/);
  assert.match(indexHtml, /id="migSpeedDeltaBadge"/);
  assert.match(indexHtml, /id="migProrationSummaryBox"/);
  assert.match(indexHtml, /id="migNetDueVal"/);
  assert.match(indexHtml, /id="migMrrDeltaVal"/);
  assert.match(indexHtml, /id="migHardwareWarningBanner"/);
  assert.match(indexHtml, /id="planMigrationSubmitBtn"/);
  assert.match(indexHtml, /id="planMigrationCopyWhatsAppBtn"/);
  assert.match(indexHtml, /id="planMigrationPrintA4Btn"/);
  assert.match(indexHtml, /id="planMigrationPrintThermalBtn"/);
  assert.match(indexHtml, /id="migHistoryTableBody"/);
  assert.match(indexHtml, /id="planMigrationExportCsvBtn"/);

  // styles.css checks
  assert.match(stylesCss, /\.plan-migration-modal/);
  assert.match(stylesCss, /\.plan-migration-modal-card/);
  assert.match(stylesCss, /\.mig-subscriber-banner/);
  assert.match(stylesCss, /\.mig-warning-banner/);
  assert.match(stylesCss, /\.mig-form-grid/);
  assert.match(stylesCss, /\.mig-settlement-card/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.plan-migration-modal/);

  // app.js checks
  assert.match(appJs, /setupPlanMigrationModal/);
  assert.match(appJs, /customerPlanMigrationModalController/);
  assert.match(appJs, /openPlanMigrationBtn/);
});

test('evaluateOpticalRxPower classifies ITU-T G.984 GPON Class B+ receiver power correctly', async () => {
  const { evaluateOpticalRxPower } = await import('../form-validation.js');

  // Invalid input
  const invalid = evaluateOpticalRxPower('not-a-number');
  assert.equal(invalid.status, 'INVALID');
  assert.equal(invalid.badgeClass, 'badge-danger');

  // Saturation overload (> -8.0 dBm)
  const saturated = evaluateOpticalRxPower(-6.5);
  assert.equal(saturated.status, 'CRITICAL_SATURATION');
  assert.equal(saturated.badgeClass, 'badge-danger');
  assert.match(saturated.advice, /attenuator/i);

  // High optical power (-10 dBm)
  const high = evaluateOpticalRxPower(-10.2);
  assert.equal(high.status, 'HIGH_POWER');
  assert.equal(high.badgeClass, 'badge-warning');

  // Optimal pristine signal (-12.0 to -22.5 dBm)
  const optimal = evaluateOpticalRxPower(-19.4);
  assert.equal(optimal.status, 'PASS_OPTIMAL');
  assert.equal(optimal.badgeClass, 'badge-success');
  assert.equal(optimal.headroomDb, 7.6);
  assert.match(optimal.label, /Pristine/i);

  // Conditional pass (-22.6 to -26.9 dBm)
  const marginal = evaluateOpticalRxPower(-24.8);
  assert.equal(marginal.status, 'CONDITIONAL_PASS');
  assert.equal(marginal.badgeClass, 'badge-warning');
  assert.equal(marginal.headroomDb, 2.2);
  assert.match(marginal.advice, /clean/i);

  // Excessive attenuation fail (< -27.0 dBm)
  const failed = evaluateOpticalRxPower(-28.6);
  assert.equal(failed.status, 'FAILED_ATTENUATION');
  assert.equal(failed.badgeClass, 'badge-danger');
  assert.equal(failed.headroomDb, -1.6);
  assert.match(failed.advice, /REJECTED/);
});

test('calculateOpticalLossBudget computes theoretical budget vs measured actual attenuation', async () => {
  const { calculateOpticalLossBudget } = await import('../form-validation.js');

  const budget = calculateOpticalLossBudget({
    txPowerDbm: 2.5,
    rxPowerDbm: -19.5,
    wavelengthNm: 1490,
    distanceMeters: 1000,
    splitRatio: '1:16',
    spliceCount: 4,
    adapterCount: 2
  });

  // Fiber loss: 1km * 0.22 = 0.22 dB
  assert.equal(budget.fiberLoss, 0.22);
  // 1:16 split loss: 13.8 dB
  assert.equal(budget.splitterLoss, 13.8);
  // Splice loss: 4 * 0.05 = 0.2 dB
  assert.equal(budget.spliceLoss, 0.2);
  // Adapter loss: 2 * 0.25 = 0.5 dB
  assert.equal(budget.adapterLoss, 0.5);
  // Theoretical total: 0.22 + 13.8 + 0.2 + 0.5 = 14.72 dB
  assert.equal(budget.theoreticalLoss, 14.72);
  // Actual measured: 2.5 - (-19.5) = 22 dB
  assert.equal(budget.actualLoss, 22);
  // Excess loss: 22 - 14.72 = 7.28 dB
  assert.equal(budget.excessLoss, 7.28);
  assert.equal(budget.evaluation.status, 'PASS_OPTIMAL');
});

test('optical acceptance persistence and validation manage records in localStorage', async () => {
  const {
    getSavedOpticalCertificates,
    saveOpticalCertificate,
    clearOpticalCertificates,
    validateOpticalCertificate,
    buildOpticalCertificateRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  // Initially empty
  assert.deepEqual(getSavedOpticalCertificates(mockStorage), []);

  // Validation
  const invalid = validateOpticalCertificate({});
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.customerId);
  assert.ok(invalid.errors.rxPowerDbm);
  assert.ok(invalid.errors.inspector);

  const validForm = {
    customerId: 'cust-101',
    customerName: 'Muhammad Hamza',
    area: 'Baradari Road',
    rxPowerDbm: -18.7,
    txPowerDbm: 3.0,
    wavelengthNm: 1490,
    distanceMeters: 450,
    splitRatio: '1:8',
    spliceCount: 2,
    inspector: 'Tariq Mehmood',
    notes: 'Brand new fiber drop installation'
  };

  const validation = validateOpticalCertificate(validForm);
  assert.equal(validation.isValid, true);

  const customer = { id: 'cust-101', name: 'Muhammad Hamza', customerNumber: '2024-001', area: 'Baradari Road' };
  const record = buildOpticalCertificateRecord(customer, validForm, { now: '2026-10-16T10:00:00Z', sequence: 4521 });

  assert.equal(record.id, 'OPT-202610-4521');
  assert.equal(record.customer.name, 'Muhammad Hamza');
  assert.equal(record.telemetry.rxPowerDbm, -18.7);
  assert.equal(record.telemetry.status, 'PASS_OPTIMAL');

  // Save to storage
  const saved = saveOpticalCertificate(record, mockStorage);
  assert.equal(saved, true);
  const loaded = getSavedOpticalCertificates(mockStorage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'OPT-202610-4521');

  // Clear storage
  clearOpticalCertificates(mockStorage);
  assert.deepEqual(getSavedOpticalCertificates(mockStorage), []);
});

test('formatOpticalAcceptanceWhatsApp generates clean bilingual commissioning dispatch', async () => {
  const { formatOpticalAcceptanceWhatsApp, buildOpticalCertificateRecord } = await import('../form-validation.js');

  const customer = { id: 'cust-55', name: 'Usman Ali', customerNumber: '99', area: 'Wandala Road', package: '25 Mbps' };
  const cert = buildOpticalCertificateRecord(customer, {
    rxPowerDbm: -20.1,
    txPowerDbm: 2.5,
    ontSerial: 'ZTE-F660-8812',
    oltPort: 'PON-03',
    inspector: 'Saad QA Crew',
    notes: 'Verified OK'
  }, { now: '2026-10-16T12:00:00Z', sequence: 1001 });

  const msg = formatOpticalAcceptanceWhatsApp(cert);
  assert.match(msg, /OPTICAL ACCEPTANCE CERTIFICATE/);
  assert.match(msg, /OPT-202610-1001/);
  assert.match(msg, /Usman Ali/);
  assert.match(msg, /ZTE-F660-8812/);
  assert.match(msg, /-20.1 dBm/);
  assert.match(msg, /PRISTINE GPON CLASS B\+ LINK/i);
  assert.match(msg, /Saad QA Crew/);
});

test('generateOpticalCertificateHtml produces valid formal A4 and 80mm POS slip views', async () => {
  const { generateOpticalCertificateHtml, buildOpticalCertificateRecord } = await import('../form-validation.js');

  const customer = { id: 'cust-12', name: 'Rashid Khan', customerNumber: '42', area: 'Kot Mohibbu' };
  const cert = buildOpticalCertificateRecord(customer, {
    rxPowerDbm: -21.4,
    txPowerDbm: 2.8,
    inspector: 'Inspector Bilal'
  }, { now: '2026-10-16T12:00:00Z', sequence: 2002 });

  const a4Html = generateOpticalCertificateHtml(cert, { mode: 'a4' });
  assert.match(a4Html, /optical-a4-certificate/);
  assert.match(a4Html, /OPT-202610-2002/);
  assert.match(a4Html, /Rashid Khan/);
  assert.match(a4Html, /Optical Link Attenuation/);
  assert.match(a4Html, /Inspector Bilal/);

  const thermalHtml = generateOpticalCertificateHtml(cert, { mode: 'thermal' });
  assert.match(thermalHtml, /optical-thermal-slip/);
  assert.match(thermalHtml, /OPT-202610-2002/);
  assert.match(thermalHtml, /Rashid Khan/);
  assert.match(thermalHtml, /-21.4 dBm/);
});

test('generateOpticalCertificatesCsv formats RFC-4180 CSV with headers and UTF-8 BOM', async () => {
  const { generateOpticalCertificatesCsv, buildOpticalCertificateRecord } = await import('../form-validation.js');

  const customer = { id: 'cust-1', name: 'Tahir, "CEO" Shahdara', area: 'GT Road' };
  const cert = buildOpticalCertificateRecord(customer, {
    rxPowerDbm: -19.0,
    inspector: 'Crew A',
    notes: 'Line with, comma and "quotes"'
  }, { sequence: 3003 });

  const csv = generateOpticalCertificatesCsv([cert]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Certificate ID,Date,Customer ID/);
  assert.match(csv, /"Tahir, ""CEO"" Shahdara"/);
  assert.match(csv, /"Line with, comma and ""quotes"""/);
});

test('DOM and styling: index.html, styles.css, and app.js wire Optical QA Acceptance completely', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // index.html checks
  assert.match(indexHtml, /id="openOpticalAcceptanceBtn"/);
  assert.match(indexHtml, /data-open-optical-acceptance/);
  assert.match(indexHtml, /<dialog id="opticalAcceptanceModal" class="modal optical-acceptance-modal"/);
  assert.match(indexHtml, /id="opticalAcceptanceCloseBtn"/);
  assert.match(indexHtml, /id="optKpiTotalCertificates"/);
  assert.match(indexHtml, /id="optKpiAverageRx"/);
  assert.match(indexHtml, /id="optKpiPassRate"/);
  assert.match(indexHtml, /id="optKpiAttenuationAlerts"/);
  assert.match(indexHtml, /id="optCustomerName"/);
  assert.match(indexHtml, /id="optCustomerMeta"/);
  assert.match(indexHtml, /id="optOntSerialInput"/);
  assert.match(indexHtml, /id="optOltPortInput"/);
  assert.match(indexHtml, /id="optWavelengthSelect"/);
  assert.match(indexHtml, /id="optRxPowerInput"/);
  assert.match(indexHtml, /id="optRxPowerSlider"/);
  assert.match(indexHtml, /id="optTxPowerInput"/);
  assert.match(indexHtml, /id="optDistanceInput"/);
  assert.match(indexHtml, /id="optSplitRatioSelect"/);
  assert.match(indexHtml, /id="optSpliceCountInput"/);
  assert.match(indexHtml, /id="optStatusBadge"/);
  assert.match(indexHtml, /id="optLossBudgetBox"/);
  assert.match(indexHtml, /id="opticalAcceptanceSubmitBtn"/);
  assert.match(indexHtml, /id="opticalAcceptanceCopyWhatsAppBtn"/);
  assert.match(indexHtml, /id="opticalAcceptancePrintA4Btn"/);
  assert.match(indexHtml, /id="opticalAcceptancePrintThermalBtn"/);
  assert.match(indexHtml, /id="optFilterStatusSelect"/);
  assert.match(indexHtml, /id="optSearchInput"/);
  assert.match(indexHtml, /id="optHistoryTableBody"/);
  assert.match(indexHtml, /id="opticalAcceptanceExportCsvBtn"/);

  // styles.css checks
  assert.match(stylesCss, /\.optical-acceptance-modal/);
  assert.match(stylesCss, /\.optical-acceptance-modal-card/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.optical-acceptance-modal-card/);

  // app.js checks
  assert.match(appJs, /setupOpticalAcceptanceModal/);
  assert.match(appJs, /customerOpticalAcceptanceModalController/);
  assert.match(appJs, /openOpticalAcceptanceBtn/);
});

test('calculateDropTensionLoad accurately computes horizontal catenary tension and load rating', async () => {
  const { calculateDropTensionLoad } = await import('../form-validation.js');

  // Baseline 50m span, 50cm sag, 35 g/m cable
  const normal = calculateDropTensionLoad(50, 50, 35);
  assert.equal(typeof normal.horizontalTensionNewtons, 'number');
  assert.ok(normal.horizontalTensionNewtons > 150 && normal.horizontalTensionNewtons < 300);
  assert.equal(normal.loadStatus, 'OPTIMAL');
  assert.equal(normal.sagRatioPercent, 1);

  // Excessive tension (over-tightened: 120m span with only 15cm sag)
  const overtightened = calculateDropTensionLoad(120, 15, 35);
  assert.ok(overtightened.horizontalTensionNewtons > 600);
  assert.equal(overtightened.loadStatus, 'EXCESSIVE_TENSION');

  // Excessive sag (loose line: 40m span with 150cm sag)
  const sagging = calculateDropTensionLoad(40, 150, 35);
  assert.equal(sagging.loadStatus, 'EXCESSIVE_SAG');
  assert.ok(sagging.sagRatioPercent > 2.5);

  // Invalid / edge cases
  const edgeZero = calculateDropTensionLoad(0, 50, 35);
  assert.equal(edgeZero.horizontalTensionNewtons, 0);
  assert.equal(edgeZero.loadStatus, 'INVALID');

  const edgeNegativeSag = calculateDropTensionLoad(60, -10, 35);
  assert.equal(edgeNegativeSag.horizontalTensionNewtons, 0);
  assert.equal(edgeNegativeSag.loadStatus, 'INVALID');
});

test('evaluateDropSafetyCompliance determines safety verdicts across rooftop routing & grounding scenarios', async () => {
  const { evaluateDropSafetyCompliance, DROP_SAFETY_VERDICTS } = await import('../form-validation.js');

  // Full pass: adequate clearance, optimal tension, sturdy anchor, grounding intact
  const passRes = evaluateDropSafetyCompliance({
    spanMeters: 45,
    sagCm: 45,
    clearanceMeters: 1.8,
    electricalCrossing: false,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Reinforced Concrete Column',
    groundingBonded: true,
    dripLoopInstalled: true,
    uvConduitProtected: true
  });
  assert.equal(passRes.verdictKey, 'CERTIFIED_PASS');
  assert.equal(passRes.isHazard, false);
  assert.ok(passRes.hazards.length === 0);

  // Critical Electrical Hazard: 0.3m clearance near 440V distribution lines
  const elecRes = evaluateDropSafetyCompliance({
    spanMeters: 55,
    sagCm: 40,
    clearanceMeters: 0.3,
    electricalCrossing: true,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Reinforced Concrete Column',
    groundingBonded: true,
    dripLoopInstalled: true,
    uvConduitProtected: true
  });
  assert.equal(elecRes.verdictKey, 'FAILED_SAFETY_HAZARD');
  assert.equal(elecRes.isHazard, true);
  assert.ok(elecRes.hazards.some(h => h.includes('Clearance from electrical')));

  // Anchor Hazard: makeshift wire tie on flimsy wooden rafter
  const anchorRes = evaluateDropSafetyCompliance({
    spanMeters: 50,
    sagCm: 50,
    clearanceMeters: 1.5,
    anchorType: 'Direct Cable Tie / Makeshift Wire',
    surfaceType: 'Wooden Rafter / Perlin'
  });
  assert.equal(anchorRes.verdictKey, 'FAILED_SAFETY_HAZARD');
  assert.ok(anchorRes.hazards.some(h => h.includes('Makeshift anchoring')));

  // Excessive Tension Hazard (> 600N)
  const tensionRes = evaluateDropSafetyCompliance({
    spanMeters: 130,
    sagCm: 15,
    clearanceMeters: 2.0,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Reinforced Concrete Column',
    groundingBonded: true,
    dripLoopInstalled: true
  });
  assert.equal(tensionRes.verdictKey, 'FAILED_SAFETY_HAZARD');
  assert.ok(tensionRes.hazards.some(h => h.includes('Tensile load')));

  // Conditional Pass: Safe clearance and anchor, but missing drip loop and grounding bond
  const condRes = evaluateDropSafetyCompliance({
    spanMeters: 50,
    sagCm: 50,
    clearanceMeters: 1.5,
    anchorType: 'Drive Hook (J-Hook)',
    surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: false,
    dripLoopInstalled: false,
    uvConduitProtected: false
  });
  assert.equal(condRes.verdictKey, 'CONDITIONAL_PASS');
  assert.equal(condRes.isHazard, false);
  assert.ok(condRes.warnings.length >= 2);
  assert.ok(condRes.warnings.some(w => w.includes('drip loop')));
  assert.ok(condRes.warnings.some(w => w.includes('grounding')));
});

test('validateDropSafetyInspection and buildDropInspectionRecord enforce form validation and data structure', async () => {
  const { validateDropSafetyInspection, buildDropInspectionRecord } = await import('../form-validation.js');

  // Empty data validation failure
  const invalid = validateDropSafetyInspection({});
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.length > 0);

  // Valid form data
  const validForm = {
    inspectorName: 'Umair Drop Specialist',
    inspectionDate: '2026-10-16',
    spanMeters: 50,
    sagCm: 50,
    cableWeightGPerM: 35,
    cableType: '1-Core G.657.A2 Self-Supporting Drop (35 g/m)',
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Solid Red Brick Masonry',
    clearanceMeters: 2.2,
    electricalCrossing: false,
    groundingBonded: true,
    dripLoopInstalled: true,
    uvConduitProtected: true,
    opticalPowerDbm: -19.5,
    notes: 'Rooftop line tied cleanly, clear from WAPDA distribution line.'
  };

  const valResult = validateDropSafetyInspection(validForm);
  assert.equal(valResult.isValid, true);
  assert.equal(valResult.errors.length, 0);

  const customer = {
    id: 'cust-drop-1',
    name: 'Mian Aslam Khan',
    phone: '03001234567',
    customerNumber: 'PK-991',
    area: 'Kot Mohibbu, Shahdara'
  };

  const record = buildDropInspectionRecord(customer, validForm, { now: '2026-10-16T15:00:00Z', sequence: 789 });
  assert.equal(record.id, 'DRP-202610-0789');
  assert.equal(record.customerId, 'cust-drop-1');
  assert.equal(record.customerName, 'Mian Aslam Khan');
  assert.equal(record.inspectorName, 'Umair Drop Specialist');
  assert.equal(record.compliance.verdictKey, 'CERTIFIED_PASS');
  assert.match(record.compliance.verdictLabel, /Certified Safe/);
  assert.ok(record.tension.horizontalTensionNewtons > 150);
});

test('drop inspection persistence manages records, filtering and updates in storage', async () => {
  const {
    getSavedDropInspections,
    saveDropInspection,
    updateDropInspectionStatus,
    clearDropInspections,
    buildDropInspectionRecord
  } = await import('../form-validation.js');

  const mockStore = {};
  const mockStorage = {
    getItem: (key) => mockStore[key] || null,
    setItem: (key, val) => { mockStore[key] = String(val); },
    removeItem: (key) => { delete mockStore[key]; }
  };

  assert.deepEqual(getSavedDropInspections(mockStorage), []);

  const cust1 = { id: 'c-1', name: 'Zahid Iqbal', customerNumber: '101', area: 'Main Bazaar' };
  const cust2 = { id: 'c-2', name: 'Sajid Mehmood', customerNumber: '102', area: 'Baradari' };

  const rec1 = buildDropInspectionRecord(cust1, {
    inspectorName: 'Saad QA',
    spanMeters: 40,
    sagCm: 40,
    clearanceMeters: 2.0,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: true,
    dripLoopInstalled: true
  }, { sequence: 101 });

  const rec2 = buildDropInspectionRecord(cust2, {
    inspectorName: 'Umair Field',
    spanMeters: 80,
    sagCm: 20,
    clearanceMeters: 0.4,
    electricalCrossing: true,
    anchorType: 'Direct Cable Tie / Makeshift Wire',
    surfaceType: 'Wooden Rafter / Perlin',
    groundingBonded: false
  }, { sequence: 102 });

  saveDropInspection(mockStorage, rec1);
  saveDropInspection(mockStorage, rec2);

  const allRecords = getSavedDropInspections(mockStorage);
  assert.equal(allRecords.length, 2);

  // Filter by customer
  const cust1Records = getSavedDropInspections(mockStorage, 'c-1');
  assert.equal(cust1Records.length, 1);
  assert.equal(cust1Records[0].customerId, 'c-1');

  // Update status
  const updated = updateDropInspectionStatus(mockStorage, rec2.id, 'SAFETY_RECTIFIED', 'Grounding rod bonded and cable rerouted');
  assert.equal(updated.compliance.verdictLabel, 'Safety Rectified');
  assert.equal(updated.remediationNotes, 'Grounding rod bonded and cable rerouted');

  // Clear
  clearDropInspections(mockStorage);
  assert.deepEqual(getSavedDropInspections(mockStorage), []);
});

test('calculateDropInspectionMetrics computes QA safety KPIs accurately', async () => {
  const { calculateDropInspectionMetrics, buildDropInspectionRecord } = await import('../form-validation.js');

  const empty = calculateDropInspectionMetrics([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.passRate, 100);

  const recPass = buildDropInspectionRecord({ id: 'c-1' }, {
    spanMeters: 40, sagCm: 40, clearanceMeters: 2.0,
    anchorType: 'SS Tension Clamp + Eye Bolt', surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: true, dripLoopInstalled: true
  }, { sequence: 1 });

  const recHazard = buildDropInspectionRecord({ id: 'c-2' }, {
    spanMeters: 100, sagCm: 15, clearanceMeters: 0.3, electricalCrossing: true,
    anchorType: 'Direct Cable Tie / Makeshift Wire', surfaceType: 'Wooden Rafter / Perlin'
  }, { sequence: 2 });

  const recCond = buildDropInspectionRecord({ id: 'c-3' }, {
    spanMeters: 50, sagCm: 50, clearanceMeters: 1.5,
    anchorType: 'Drive Hook (J-Hook)', surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: false, dripLoopInstalled: false
  }, { sequence: 3 });

  const metrics = calculateDropInspectionMetrics([recPass, recHazard, recCond]);
  assert.equal(metrics.total, 3);
  assert.equal(metrics.certifiedCount, 1);
  assert.equal(metrics.hazardCount, 1);
  assert.equal(metrics.conditionalCount, 1);
  assert.equal(metrics.passRate, 33);
  assert.ok(metrics.averageSpanMeters > 0);
  assert.ok(metrics.highTensionCount >= 1);
});

test('formatDropInspectionWhatsApp generates bilingual technician dispatch text', async () => {
  const { formatDropInspectionWhatsApp, buildDropInspectionRecord } = await import('../form-validation.js');

  const customer = { id: 'c-wa', name: 'Farooq Ahmad', customerNumber: '332', area: 'Kot Mohibbu' };
  const record = buildDropInspectionRecord(customer, {
    inspectorName: 'Saad Lead QA',
    spanMeters: 60,
    sagCm: 60,
    clearanceMeters: 1.8,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: true,
    dripLoopInstalled: true,
    notes: 'Rooftop anchor tested up to 25 kg load.'
  }, { sequence: 888 });

  const msg = formatDropInspectionWhatsApp(record);
  assert.match(msg, /DROP CABLE SAFETY QA CERTIFICATE/);
  assert.match(msg, /DRP-202610-0888/);
  assert.match(msg, /Farooq Ahmad/);
  assert.match(msg, /Kot Mohibbu/);
  assert.match(msg, /QA Verdict/);
  assert.match(msg, /Saad Lead QA/);
  assert.match(msg, /Shahdara Outside Plant/);
});

test('generateDropInspectionHtml renders valid formal A4 certificate and 80mm thermal slip layouts', async () => {
  const { generateDropInspectionHtml, buildDropInspectionRecord } = await import('../form-validation.js');

  const customer = { id: 'c-html', name: 'Tariq Butt', customerNumber: '445', area: 'Saeed Park' };
  const record = buildDropInspectionRecord(customer, {
    inspectorName: 'Umair Inspector',
    spanMeters: 50,
    sagCm: 50,
    clearanceMeters: 1.9,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: true,
    dripLoopInstalled: true,
    opticalPowerDbm: -19.8
  }, { sequence: 999 });

  const a4 = generateDropInspectionHtml(record, { mode: 'a4' });
  assert.match(a4, /drop-a4-cert/);
  assert.match(a4, /DRP-202610-0999/);
  assert.match(a4, /Tariq Butt/);
  assert.match(a4, /Anchor Specs/);
  assert.match(a4, /Calculated Tension:/);
  assert.match(a4, /Umair Inspector/);

  const thermal = generateDropInspectionHtml(record, { mode: 'thermal' });
  assert.match(thermal, /drop-thermal-slip/);
  assert.match(thermal, /DRP-202610-0999/);
  assert.match(thermal, /Tariq Butt/);
  assert.match(thermal, /Certified Safe/);
});

test('generateDropInspectionsCsv produces compliant RFC-4180 CSV with UTF-8 BOM', async () => {
  const { generateDropInspectionsCsv, buildDropInspectionRecord } = await import('../form-validation.js');

  const customer = { id: 'c-csv', name: 'Bashir "Contractor" & Sons', area: 'GT Road, Shahdara' };
  const record = buildDropInspectionRecord(customer, {
    inspectorName: 'Saad QA',
    spanMeters: 45,
    sagCm: 45,
    clearanceMeters: 2.1,
    anchorType: 'SS Tension Clamp + Eye Bolt',
    surfaceType: 'Solid Red Brick Masonry',
    groundingBonded: true,
    dripLoopInstalled: true,
    notes: 'Line crosses street, verified clear'
  }, { sequence: 404 });

  const csv = generateDropInspectionsCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Certificate ID","Customer ID","Subscriber Name"/);
  assert.match(csv, /"Bashir ""Contractor"" & Sons"/);
  assert.match(csv, /"GT Road, Shahdara"/);
  assert.match(csv, /DRP-202610-0404/);
});

test('DOM and styling: index.html, styles.css, and app.js wire Drop Tension & Safety QA Inspection', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // index.html triggers and dialog markup
  assert.match(indexHtml, /id="openDropInspectionBtn"/);
  assert.match(indexHtml, /data-open-drop-inspection/);
  assert.match(indexHtml, /<dialog id="dropSafetyInspectionModal" class="[^"]*drop-safety-modal/);
  assert.match(indexHtml, /id="closeDropSafetyModalBtn"/);
  assert.match(indexHtml, /id="dropKpiTotal"/);
  assert.match(indexHtml, /id="dropKpiCert"/);
  assert.match(indexHtml, /id="dropKpiHazard"/);
  assert.match(indexHtml, /id="dropKpiRate"/);
  assert.match(indexHtml, /id="dropSubName"/);
  assert.match(indexHtml, /id="dropSubArea"/);
  assert.match(indexHtml, /id="dropAnchorTypeSelect"/);
  assert.match(indexHtml, /id="dropSurfaceTypeSelect"/);
  assert.match(indexHtml, /id="dropSpanInput"/);
  assert.match(indexHtml, /id="dropSagInput"/);
  assert.match(indexHtml, /id="dropBendInput"/);
  assert.match(indexHtml, /id="dropGroundInput"/);
  assert.match(indexHtml, /id="dropChkDripLoop"/);
  assert.match(indexHtml, /id="dropChkUvTies"/);
  assert.match(indexHtml, /id="dropChkConduit"/);
  assert.match(indexHtml, /id="dropChkSeal"/);
  assert.match(indexHtml, /id="dropChkArrester"/);
  assert.match(indexHtml, /id="dropPreviewTension"/);
  assert.match(indexHtml, /id="dropPreviewVerdictBadge"/);
  assert.match(indexHtml, /id="dropSubmitBtn"/);
  assert.match(indexHtml, /id="dropCopyWhatsAppBtn"/);
  assert.match(indexHtml, /id="dropPrintA4Btn"/);
  assert.match(indexHtml, /id="dropPrintThermalBtn"/);
  assert.match(indexHtml, /id="dropExportCsvBtn"/);
  assert.match(indexHtml, /id="dropFilterVerdictSelect"/);
  assert.match(indexHtml, /id="dropSearchInput"/);
  assert.match(indexHtml, /id="dropHistoryTableBody"/);

  // styles.css styles
  assert.match(stylesCss, /\.drop-safety-modal/);
  assert.match(stylesCss, /\.drop-safety-modal-card/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.drop-safety-modal-card/);

  // app.js controller integration
  assert.match(appJs, /setupDropSafetyInspectionModal/);
  assert.match(appJs, /customerDropSafetyModalController/);
  assert.match(appJs, /openDropInspectionBtn/);
});

test('evaluateEthernetWireMap evaluates straight-through, open, short, split-pair, and reversed polarity faults', async () => {
  const {
    evaluateEthernetWireMap,
    WIRING_STANDARDS
  } = await import('../form-validation.js');

  // Straight-through T568B
  const straightB = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'NONE' });
  assert.equal(straightB.pass, true);
  assert.equal(straightB.gigabitSupported, true);
  assert.equal(straightB.wireMapGrade, 'STRAIGHT_THROUGH_PASS');
  assert.equal(straightB.pinMap.length, 8);
  assert.equal(straightB.pinMap[0].color, 'White/Orange');
  assert.equal(straightB.pinMap[0].farPin, 1);
  assert.equal(straightB.pinMap[7].color, 'Brown');
  assert.equal(straightB.pinMap[7].farPin, 8);

  // T568A Pin 1 is White/Green
  const straightA = evaluateEthernetWireMap({ standard: 'T568A', faultType: 'NONE' });
  assert.equal(straightA.pinMap[0].color, 'White/Green');
  assert.equal(straightA.pinMap[1].color, 'Green');

  // Open conductor pin 4
  const open4 = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'OPEN_PIN_4' });
  assert.equal(open4.pass, false);
  assert.equal(open4.gigabitSupported, false);
  assert.equal(open4.wireMapGrade, 'OPEN_FAULT');
  assert.equal(open4.pinMap[3].status, 'OPEN');
  assert.equal(open4.pinMap[3].farPin, null);

  // Open pair 4 (pins 7 & 8)
  const open78 = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'OPEN_PIN_7_8' });
  assert.equal(open78.pass, false);
  assert.equal(open78.gigabitSupported, false);
  assert.equal(open78.wireMapGrade, 'OPEN_FAULT_GIGABIT_DROPPED');

  // Short circuit pins 1 & 2
  const short12 = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'SHORT_PINS_1_2' });
  assert.equal(short12.pass, false);
  assert.equal(short12.wireMapGrade, 'SHORT_FAULT');
  assert.equal(short12.pinMap[0].status, 'SHORT');

  // Split pair
  const splitPair = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'SPLIT_PAIR_3_6' });
  assert.equal(splitPair.pass, false);
  assert.equal(splitPair.wireMapGrade, 'SPLIT_PAIR_FAULT');

  // Reversed polarity
  const reversed = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'REVERSED_PAIR_2' });
  assert.equal(reversed.pass, false);
  assert.equal(reversed.wireMapGrade, 'REVERSED_PAIR');
  assert.equal(reversed.pinMap[0].farPin, 2);
  assert.equal(reversed.pinMap[1].farPin, 1);

  // Crossover
  const crossover = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'CROSSOVER' });
  assert.equal(crossover.pass, true);
  assert.equal(crossover.wireMapGrade, 'CROSSOVER_MDIX');
});

test('calculateEthernetTransmission computes insertion loss, return loss, NEXT, propagation delay, and link speed', async () => {
  const {
    calculateEthernetTransmission,
    evaluateEthernetWireMap
  } = await import('../form-validation.js');

  // Cat6 at 25 meters, clean wire map
  const cleanMap = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'NONE' });
  const transCat6 = calculateEthernetTransmission({
    cableGrade: 'CAT6',
    lengthMeters: 25,
    wireMapResult: cleanMap,
    planSpeedMbps: 100
  });

  assert.equal(transCat6.cableGrade, 'CAT6');
  assert.equal(transCat6.lengthMeters, 25);
  assert.equal(transCat6.insertionLossDb, 4.95); // 25 * 0.198
  assert.ok(transCat6.returnLossDb >= 19.0);
  assert.ok(transCat6.nextMarginDb >= 35.0);
  assert.ok(transCat6.propagationDelayNs > 0);
  assert.ok(transCat6.delaySkewNs <= 50.0);
  assert.equal(transCat6.speedMbps, 1000);
  assert.equal(transCat6.isBottleneck, false);
  assert.equal(transCat6.verdictKey, 'FLUKE_CERTIFIED_PASS');
  assert.equal(transCat6.isCertified, true);

  // Excessive length (> 100m)
  const transLong = calculateEthernetTransmission({
    cableGrade: 'CAT6',
    lengthMeters: 120,
    wireMapResult: cleanMap,
    planSpeedMbps: 100
  });
  assert.equal(transLong.isLengthExceeded, true);
  assert.equal(transLong.verdictKey, 'FAILED_TERMINATION_FAULT');

  // Faulty wiring dropping gigabit to 100 Mbps on a 200 Mbps plan
  const faultMap = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'OPEN_PIN_7_8' });
  const transBottleneck = calculateEthernetTransmission({
    cableGrade: 'CAT6',
    lengthMeters: 20,
    wireMapResult: faultMap,
    planSpeedMbps: 200
  });
  assert.equal(transBottleneck.speedMbps, 100);
  assert.equal(transBottleneck.isBottleneck, true);
  assert.ok(transBottleneck.bottleneckNotice.includes('200 Mbps'));

  // Cat5 legacy cable capped at 100 Mbps
  const transCat5 = calculateEthernetTransmission({
    cableGrade: 'CAT5',
    lengthMeters: 30,
    wireMapResult: cleanMap,
    planSpeedMbps: 50
  });
  assert.equal(transCat5.speedMbps, 100);
});

test('validateEthernetCertification and buildEthernetCertRecord validate inputs and produce sequential IDs', async () => {
  const {
    validateEthernetCertification,
    buildEthernetCertRecord
  } = await import('../form-validation.js');

  // Validation
  const invalid = validateEthernetCertification({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.customerId);
  assert.ok(invalid.errors.technicianName);

  const valid = validateEthernetCertification({
    customerId: 'CUST-001',
    technicianName: 'Lineman Bilal',
    lengthMeters: 35
  });
  assert.equal(valid.valid, true);

  // Record builder
  const record = buildEthernetCertRecord({
    customerId: 'CUST-BAR-042',
    customerName: 'Muhammad Arshad',
    customerPhone: '+92 300 9876543',
    customerArea: 'Baradari Road',
    technicianName: 'Lineman Asif',
    cableGrade: 'CAT6',
    lengthMeters: 30,
    wiringStandard: 'T568B',
    faultType: 'NONE',
    planSpeedMbps: 100,
    timestamp: '2026-10-16T12:00:00.000Z'
  }, 4);

  assert.equal(record.id, 'ETH-202610-0005');
  assert.equal(record.customerName, 'Muhammad Arshad');
  assert.equal(record.cableGrade, 'CAT6');
  assert.equal(record.lengthMeters, 30);
  assert.equal(record.verdict, 'FLUKE_CERTIFIED_PASS');
  assert.ok(record.transmission);
  assert.ok(record.wireMap);
});

test('getSavedEthernetCerts, saveEthernetCert, updateEthernetCertStatus, clearEthernetCerts, and calculateEthernetCertMetrics', async () => {
  const {
    getSavedEthernetCerts,
    saveEthernetCert,
    updateEthernetCertStatus,
    clearEthernetCerts,
    calculateEthernetCertMetrics,
    buildEthernetCertRecord
  } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  assert.deepEqual(getSavedEthernetCerts(mockStorage), []);

  const r1 = buildEthernetCertRecord({
    customerId: 'CUST-01',
    technicianName: 'Tech 1',
    cableGrade: 'CAT6',
    lengthMeters: 20
  }, 0);

  const r2 = buildEthernetCertRecord({
    customerId: 'CUST-02',
    technicianName: 'Tech 2',
    cableGrade: 'CAT6',
    lengthMeters: 110 // Fails length limit
  }, 1);

  saveEthernetCert(mockStorage, r1);
  saveEthernetCert(mockStorage, r2);

  const certs = getSavedEthernetCerts(mockStorage);
  assert.equal(certs.length, 2);

  // Filter by customer
  assert.equal(getSavedEthernetCerts(mockStorage, 'CUST-01').length, 1);

  // Update status
  const updated = updateEthernetCertStatus(mockStorage, r2.id, 'RE_TERMINATED_PASS', 'Cut cable to 90m and re-crimped');
  assert.equal(updated.status, 'RE_TERMINATED_PASS');
  assert.equal(updated.verdict, 'FLUKE_CERTIFIED_PASS');

  // Metrics
  const metrics = calculateEthernetCertMetrics(getSavedEthernetCerts(mockStorage));
  assert.equal(metrics.total, 2);
  assert.equal(metrics.certifiedCount, 2);
  assert.equal(metrics.passRatePercent, 100);

  // Clear
  clearEthernetCerts(mockStorage);
  assert.deepEqual(getSavedEthernetCerts(mockStorage), []);
});

test('formatEthernetCertWhatsApp and generateEthernetCertHtml produce bilingual and dual print layouts', async () => {
  const {
    buildEthernetCertRecord,
    formatEthernetCertWhatsApp,
    generateEthernetCertHtml
  } = await import('../form-validation.js');

  const cert = buildEthernetCertRecord({
    customerId: 'CUST-BAR-01',
    customerName: 'Shahid Mehmood',
    customerPhone: '+92 321 4455667',
    customerArea: 'Vandala Road',
    technicianName: 'Lineman Bilal',
    cableGrade: 'CAT6',
    lengthMeters: 25,
    wiringStandard: 'T568B',
    faultType: 'NONE'
  }, 0);

  // WhatsApp
  const wa = formatEthernetCertWhatsApp(cert);
  assert.ok(wa.includes('SHAHDARA ISP - LAN ETHERNET & GIGABIT QA CERTIFICATE'));
  assert.ok(wa.includes('لین کیبلنگ اور گیگابٹ سپیڈ سرٹیفکیٹ'));
  assert.ok(wa.includes('Shahid Mehmood'));
  assert.ok(wa.includes('1000BASE-T Full Duplex (1000 Mbps)'));
  assert.ok(wa.includes('Lineman Bilal'));

  // Thermal Slip
  const thermalHtml = generateEthernetCertHtml(cert, { format: 'slip' });
  assert.ok(thermalHtml.includes('PREMISES LAN CABLE QA SLIP'));
  assert.ok(thermalHtml.includes('Shahid Mehmood'));
  assert.ok(thermalHtml.includes('CAT6 (25m)'));

  // A4 Certificate
  const a4Html = generateEthernetCertHtml(cert, { format: 'a4' });
  assert.ok(a4Html.includes('Outside Plant & Premises LAN Engineering'));
  assert.ok(a4Html.includes('Gigabit Ethernet Cabling & Wire Map QA Certificate'));
  assert.ok(a4Html.includes('ANSI/TIA-568-C.2 Verified'));
  assert.ok(a4Html.includes('Shahid Mehmood'));
  assert.ok(a4Html.includes('Certified Field Engineer Signature'));
});

test('generateEthernetCertsCsv exports valid RFC-4180 CSV with UTF-8 BOM', async () => {
  const {
    buildEthernetCertRecord,
    generateEthernetCertsCsv
  } = await import('../form-validation.js');

  const cert = buildEthernetCertRecord({
    customerId: 'CUST-009',
    customerName: 'Nasir "Chief" Mehmood',
    customerPhone: '+92 300 1234567',
    customerArea: 'Baradari Road',
    technicianName: 'Bilal',
    cableGrade: 'CAT6',
    lengthMeters: 25,
    notes: 'Grounding OK, "tested" high-speed'
  }, 0);

  const csv = generateEthernetCertsCsv([cert]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Certificate ID,Customer ID,Customer Name'));
  assert.ok(csv.includes('"Nasir ""Chief"" Mehmood"'));
  assert.ok(csv.includes('25'));
});

test('renderRj45WireMapSvg generates valid SVG diagram with 8 pin traces', async () => {
  const {
    evaluateEthernetWireMap,
    renderRj45WireMapSvg
  } = await import('../form-validation.js');

  const wm = evaluateEthernetWireMap({ standard: 'T568B', faultType: 'NONE' });
  const svg = renderRj45WireMapSvg(wm);

  assert.ok(svg.includes('<svg class="rj45-wiremap-svg"'));
  assert.ok(svg.includes('T568B'));
  assert.ok(svg.includes('STRAIGHT_THROUGH_PASS'));
  assert.ok(svg.includes('Pin 1 Column'));
  assert.ok(svg.includes('Pin 8 Column'));
  assert.ok(svg.includes('ONT'));
  assert.ok(svg.includes('LAN'));
});

test('DOM and styling: index.html, styles.css, and app.js wire LAN Ethernet Cabling & Gigabit QA Certificate', () => {
  const indexHtml = read('index.html');
  const stylesCss = read('styles.css');
  const appJs = read('app.js');

  // Trigger button
  assert.match(indexHtml, /id="openEthernetCertBtn"/);
  assert.match(indexHtml, /data-open-ethernet-cert/);

  // Modal dialog & inputs
  assert.match(indexHtml, /<dialog id="ethernetCertModal"/);
  assert.match(indexHtml, /id="closeEthernetCertModalBtn"/);
  assert.match(indexHtml, /id="ethKpiWireMap"/);
  assert.match(indexHtml, /id="ethKpiLoss"/);
  assert.match(indexHtml, /id="ethKpiDelay"/);
  assert.match(indexHtml, /id="ethKpiSpeed"/);
  assert.match(indexHtml, /id="ethKpiVerdict"/);
  assert.match(indexHtml, /id="ethWireMapSvgContainer"/);
  assert.match(indexHtml, /id="ethCustomerSelect"/);
  assert.match(indexHtml, /id="ethTechInput"/);
  assert.match(indexHtml, /id="ethCableSelect"/);
  assert.match(indexHtml, /id="ethStandardSelect"/);
  assert.match(indexHtml, /id="ethFaultSelect"/);
  assert.match(indexHtml, /id="ethLengthSlider"/);
  assert.match(indexHtml, /id="ethLengthInput"/);
  assert.match(indexHtml, /id="ethSaveBtn"/);
  assert.match(indexHtml, /id="ethPrintBtn"/);
  assert.match(indexHtml, /id="ethWhatsAppBtn"/);
  assert.match(indexHtml, /id="ethCsvBtn"/);
  assert.match(indexHtml, /id="ethHistoryList"/);

  // Styles
  assert.match(stylesCss, /\.ethernet-cert-modal-card/);
  assert.match(stylesCss, /\.rj45-wiremap-svg/);
  assert.match(stylesCss, /\[data-theme="dark"\] \.ethernet-cert-modal-card/);

  // App.js
  assert.match(appJs, /setupEthernetCertModal/);
  assert.match(appJs, /customerEthernetCertModalController/);
  assert.match(appJs, /openEthernetCertBtn/);
});

test('calculateReflectanceFromOrl and calculateOrlFromReflectance convert correctly', async () => {
  const { calculateReflectanceFromOrl, calculateOrlFromReflectance } = await import('../form-validation.js');

  const r60 = calculateReflectanceFromOrl(60);
  assert.equal(r60.orlDb, 60);
  assert.equal(r60.reflectanceDb, -60);
  assert.equal(r60.reflectancePpm, 1);
  assert.equal(r60.opticalPowerReturnedPercent, 0.0001);

  const r50 = calculateReflectanceFromOrl(50);
  assert.equal(r50.reflectanceDb, -50);
  assert.equal(r50.reflectancePpm, 10);

  const orlBack = calculateOrlFromReflectance(-60);
  assert.equal(orlBack, 60);

  // Clamping and invalid inputs
  assert.equal(calculateReflectanceFromOrl(null).orlDb, 0);
  assert.equal(calculateReflectanceFromOrl('invalid').orlDb, 0);
  assert.equal(calculateOrlFromReflectance(null), 0);
});

test('evaluateOrlReflectance evaluates SC/APC, SC/UPC, defects and DFB laser stability', async () => {
  const { evaluateOrlReflectance } = await import('../form-validation.js');

  // Pristine SC/APC at 65 dB
  const evalApcPass = evaluateOrlReflectance({
    polish: 'SC_APC',
    measuredOrlDb: 65,
    defects: []
  });
  assert.equal(evalApcPass.orlPassed, true);
  assert.equal(evalApcPass.iecEndfacePassed, true);
  assert.equal(evalApcPass.overallPass, true);
  assert.equal(evalApcPass.qualityGrade, 'GRADE_A');
  assert.equal(evalApcPass.laserStabilityRisk, 'NEGLIGIBLE');

  // Marginal SC/APC at 32 dB (below 35 dB floor)
  const evalApcFail = evaluateOrlReflectance({
    polish: 'SC_APC',
    measuredOrlDb: 32,
    defects: []
  });
  assert.equal(evalApcFail.orlPassed, false);
  assert.equal(evalApcFail.overallPass, false);
  assert.ok(evalApcFail.marginDb < 0);

  // Critical Core Scratch on SC/APC
  const evalDefectFail = evaluateOrlReflectance({
    polish: 'SC_APC',
    measuredOrlDb: 62,
    defects: ['CORE_SCRATCH']
  });
  assert.equal(evalDefectFail.iecEndfacePassed, false);
  assert.equal(evalDefectFail.overallPass, false);
  assert.equal(evalDefectFail.qualityGrade, 'GRADE_D');
  assert.equal(evalDefectFail.laserStabilityRisk, 'CRITICAL');
  assert.ok(evalDefectFail.actionRequired.includes('Re-cleave and re-splice') || evalDefectFail.actionRequired.includes('re-splice'));

  // SC/UPC at 52 dB with mild dust
  const evalUpcPass = evaluateOrlReflectance({
    polish: 'SC_UPC',
    measuredOrlDb: 52,
    defects: ['DUST_SPECS']
  });
  assert.equal(evalUpcPass.overallPass, false); // requires cleaning
  assert.equal(evalUpcPass.qualityGrade, 'GRADE_C');
});

test('validateOrlCertInput validates input data bounds and required fields', async () => {
  const { validateOrlCertInput } = await import('../form-validation.js');

  const validRes = validateOrlCertInput({
    customerName: 'Muhammad Tariq',
    technicianName: 'Lineman Sajid',
    measuredOrlDb: 62.5
  });
  assert.equal(validRes.valid, true);
  assert.equal(validRes.errors.length, 0);

  const missingRes = validateOrlCertInput({});
  assert.equal(missingRes.valid, false);
  assert.ok(missingRes.errors.some(e => e.includes('Customer name')));
  assert.ok(missingRes.errors.some(e => e.includes('Technician name')));

  const outOfBoundsRes = validateOrlCertInput({
    customerName: 'Tariq',
    technicianName: 'Sajid',
    measuredOrlDb: 105
  });
  assert.equal(outOfBoundsRes.valid, false);
  assert.ok(outOfBoundsRes.errors.some(e => e.includes('Measured ORL')));
});

test('buildOrlCertRecord generates structured record with unique ID and evaluation', async () => {
  const { buildOrlCertRecord, generateOrlCertId } = await import('../form-validation.js');

  const id = generateOrlCertId(42);
  assert.match(id, /^ORL-\d{6}-0043$/);

  const record = buildOrlCertRecord({
    customerId: 'CUST-TEST-01',
    customerName: 'Kashif Mehmood',
    customerPhone: '+92 300 1234567',
    customerArea: 'Begum Kot, Shahdara',
    polish: 'SC_APC',
    measuredOrlDb: 63.8,
    wavelengthNm: 1550,
    technicianName: 'Splicer Hamza',
    defects: [],
    notes: 'Pre-activation inspection at FAT-04'
  }, 10);

  assert.equal(record.id, generateOrlCertId(10));
  assert.equal(record.customerName, 'Kashif Mehmood');
  assert.equal(record.customerArea, 'Begum Kot, Shahdara');
  assert.equal(record.polish, 'SC_APC');
  assert.equal(record.polishName, 'SC/APC (Green Angled 8°)');
  assert.equal(record.overallPass, true);
  assert.equal(record.qualityGrade, 'GRADE_A');
  assert.equal(record.status, 'CERTIFIED_PASS');
  assert.ok(record.evaluation);
  assert.ok(record.isoStandard.includes('IEC 61300-3-35'));
});

test('getSavedOrlCerts, saveOrlCert, updateOrlCertStatus, clearOrlCerts and calculateOrlCertMetrics perform CRUD', async () => {
  const {
    saveOrlCert,
    getSavedOrlCerts,
    updateOrlCertStatus,
    clearOrlCerts,
    calculateOrlCertMetrics,
    buildOrlCertRecord
  } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const rec1 = buildOrlCertRecord({
    customerId: 'CUST-101',
    customerName: 'Zahid Hussain',
    customerPhone: '+92 321 9988776',
    customerArea: 'Saeed Park',
    polish: 'SC_APC',
    measuredOrlDb: 64,
    technicianName: 'Splicer Bilal',
    defects: []
  }, 0);

  const rec2 = buildOrlCertRecord({
    customerId: 'CUST-102',
    customerName: 'Imran Ashraf',
    customerPhone: '+92 333 4455667',
    customerArea: 'Yousaf Park',
    polish: 'SC_UPC',
    measuredOrlDb: 40, // Fails SC_UPC 50dB
    technicianName: 'Splicer Bilal',
    defects: ['CORE_SCRATCH']
  }, 1);

  saveOrlCert(mockStorage, rec1);
  saveOrlCert(mockStorage, rec2);

  const listAll = getSavedOrlCerts(mockStorage);
  assert.equal(listAll.length, 2);

  // Filter by customerId
  const cust101 = getSavedOrlCerts(mockStorage, 'CUST-101');
  assert.equal(cust101.length, 1);
  assert.equal(cust101[0].customerName, 'Zahid Hussain');

  // Metrics
  const metrics = calculateOrlCertMetrics(listAll);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.passCount, 1);
  assert.equal(metrics.failCount, 1);
  assert.equal(metrics.passRatePercent, 50);
  assert.equal(metrics.averageOrlDb, 44.5); // (64 + 25) / 2

  // Update status after cleaning & re-test
  const updated = updateOrlCertStatus(mockStorage, rec2.id, 'CLEANED_RETEST_PASS', 'Cleaned endface with IPA swab and re-measured');
  assert.equal(updated.status, 'CLEANED_RETEST_PASS');
  assert.equal(updated.overallPass, true);

  const retestedMetrics = calculateOrlCertMetrics(getSavedOrlCerts(mockStorage));
  assert.equal(retestedMetrics.passCount, 2);
  assert.equal(retestedMetrics.passRatePercent, 100);

  // Clear
  clearOrlCerts(mockStorage);
  assert.deepEqual(getSavedOrlCerts(mockStorage), []);
});

test('formatOrlCertWhatsApp formats bilingual notification for technician and customer', async () => {
  const { buildOrlCertRecord, formatOrlCertWhatsApp } = await import('../form-validation.js');

  const rec = buildOrlCertRecord({
    customerId: 'CUST-WA-01',
    customerName: 'Chaudhry Nadeem',
    customerPhone: '+92 300 5544332',
    customerArea: 'Jia Musa, Shahdara',
    polish: 'SC_APC',
    measuredOrlDb: 66.2,
    technicianName: 'Master Splicer Ali',
    defects: []
  }, 5);

  const wa = formatOrlCertWhatsApp(rec);
  assert.ok(wa.includes('SHAHDARA ISP - OPTICAL RETURN LOSS & ENDFACE QA CERTIFICATE'));
  assert.ok(wa.includes('مصدقہ معیاری صاف ریفلیکٹنس'));
  assert.ok(wa.includes('Chaudhry Nadeem'));
  assert.ok(wa.includes('Jia Musa, Shahdara'));
  assert.ok(wa.includes('SC/APC (Green Angled 8°)'));
  assert.ok(wa.includes('Master Splicer Ali'));
  assert.ok(wa.includes('Certified Pristine') || wa.includes('CERTIFIED_PRISTINE'));
});

test('generateOrlCertHtml produces A4 ISO/IEC and 80mm thermal slip layouts', async () => {
  const { buildOrlCertRecord, generateOrlCertHtml } = await import('../form-validation.js');

  const rec = buildOrlCertRecord({
    customerId: 'CUST-PRINT-01',
    customerName: 'Malik Rizwan',
    customerPhone: '+92 321 7766554',
    customerArea: 'Rehman Park, Shahdara',
    polish: 'SC_APC',
    measuredOrlDb: 61.5,
    technicianName: 'Splicer Usman',
    defects: ['DUST_SPECS']
  }, 12);

  // A4 Layout
  const htmlA4 = generateOrlCertHtml(rec, { format: 'a4' });
  assert.ok(htmlA4.includes('SHAHDARA FIBER NETWORKS &amp; BROADBAND'));
  assert.ok(htmlA4.includes('IEC 61300-3-35 CERTIFICATE'));
  assert.ok(htmlA4.includes('Malik Rizwan'));
  assert.ok(htmlA4.includes('Splicer Usman'));
  assert.ok(htmlA4.includes('IEC 61300-3-35 Ferrule Endface Inspection Breakdown'));
  assert.ok(htmlA4.includes('Zone A (Core)'));

  // Thermal Slip
  const htmlSlip = generateOrlCertHtml(rec, { format: 'slip' });
  assert.ok(htmlSlip.includes('SHAHDARA BROADBAND'));
  assert.ok(htmlSlip.includes('Optical Return Loss &amp; Endface QA Slip'));
  assert.ok(htmlSlip.includes('Malik Rizwan'));
  assert.ok(htmlSlip.includes('SC/APC'));
});

test('generateOrlCertsCsv outputs RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildOrlCertRecord, generateOrlCertsCsv } = await import('../form-validation.js');

  const rec1 = buildOrlCertRecord({
    customerId: 'C-01',
    customerName: 'Ali, Khan & Co.',
    customerPhone: '+92 300 1112233',
    customerArea: 'Shahdara Town',
    polish: 'SC_APC',
    measuredOrlDb: 63,
    technicianName: 'Splicer Bilal'
  }, 0);

  const csv = generateOrlCertsCsv([rec1]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Certificate ID,Date,Customer ID'));
  assert.ok(csv.includes('"Ali, Khan & Co."'));
  assert.ok(csv.includes('Shahdara Town'));
  assert.ok(csv.includes('SC/APC (Green Angled 8°)'));
});

test('renderFerruleEndfaceSvg renders 4 concentric IEC zones and angle indicator', async () => {
  const { renderFerruleEndfaceSvg, evaluateOrlReflectance } = await import('../form-validation.js');

  const evalRes = evaluateOrlReflectance({
    polish: 'SC_APC',
    measuredOrlDb: 64,
    defects: ['CORE_SCRATCH', 'DUST_SPECS']
  });

  const svg = renderFerruleEndfaceSvg(evalRes);
  assert.ok(svg.includes('<svg class="ferrule-endface-svg"'));
  assert.ok(svg.includes('IEC 61300-3-35'));
  assert.ok(svg.includes('OPTICAL RETURN LOSS'));
  assert.ok(svg.includes('QA VERDICT'));
});

test('setupOrlCertModal controller initializes safely and handles events', async () => {
  const { setupOrlCertModal } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  const controller = setupOrlCertModal({
    storage: mockStorage,
    getState: () => ({
      customers: [
        { id: 'CUST-10', name: 'Tanveer Ahmed', phone: '+92 300 9988776', area: 'Vandala Road' }
      ]
    })
  });

  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.refresh, 'function');
  assert.equal(typeof controller.setPolish, 'function');
  assert.equal(typeof controller.setMeasuredOrl, 'function');
  assert.equal(typeof controller.addDefect, 'function');

  // Calling without DOM attached is completely safe and returns controller
  assert.equal(controller.open('CUST-10'), controller);
  assert.equal(controller.setPolish('SC_UPC'), controller);
  assert.equal(controller.setMeasuredOrl(55), controller);
  assert.equal(controller.addDefect('OIL_SMUDGE'), controller);
  assert.equal(controller.refresh(), controller);
  assert.equal(controller.close(), controller);
});

test('DOM and styling: index.html, styles.css, and app.js wire ORL & Reflectance QA Certificate', () => {
  const freshIndex = read('index.html');
  const freshStyles = read('styles.css');
  const freshApp = read('app.js');

  // Trigger button
  assert.match(freshIndex, /id="openOrlCertBtn"/);
  assert.match(freshIndex, /data-open-orl-cert/);

  // Modal dialog & inputs
  assert.match(freshIndex, /<dialog id="orlCertModal"/);
  assert.match(freshIndex, /id="closeOrlCertModalBtn"/);
  assert.match(freshIndex, /id="orlKpiEffectiveOrl"/);
  assert.match(freshIndex, /id="orlKpiReflectance"/);
  assert.match(freshIndex, /id="orlKpiLaserRisk"/);
  assert.match(freshIndex, /id="orlKpiVerdict"/);
  assert.match(freshIndex, /id="orlFerruleSvgContainer"/);
  assert.match(freshIndex, /id="orlCustomerSelect"/);
  assert.match(freshIndex, /id="orlTechInput"/);
  assert.match(freshIndex, /id="orlPolishSelect"/);
  assert.match(freshIndex, /id="orlDefectSelect"/);
  assert.match(freshIndex, /id="orlMeasuredSlider"/);
  assert.match(freshIndex, /id="orlMeasuredInput"/);
  assert.match(freshIndex, /id="orlNotesInput"/);
  assert.match(freshIndex, /id="orlSaveBtn"/);
  assert.match(freshIndex, /id="orlPrintBtn"/);
  assert.match(freshIndex, /id="orlWhatsAppBtn"/);
  assert.match(freshIndex, /id="orlCsvBtn"/);
  assert.match(freshIndex, /id="orlHistoryList"/);

  // Styles
  assert.match(freshStyles, /\.orl-cert-modal-card/);
  assert.match(freshStyles, /\.ferrule-endface-svg/);
  assert.match(freshStyles, /\[data-theme="dark"\] \.orl-cert-modal-card/);

  // App.js
  assert.match(freshApp, /setupOrlCertModal/);
  assert.match(freshApp, /customerOrlCertModalController/);
  assert.match(freshApp, /openOrlCertBtn/);
});

/* ==========================================================================
   CUSTOMER PREMISES ONU DDMI TRANSCEIVER TELEMETRY & HARDWARE QA TEST SUITE
   ========================================================================== */

test('DDMI catalogs: transceiver standards and severity levels are valid and complete', async () => {
  const { DDMI_TRANSCEIVER_TYPES, DDMI_SEVERITY_LEVELS } = await import('../form-validation.js');

  assert.ok(DDMI_TRANSCEIVER_TYPES.GPON_CLASS_B_PLUS);
  assert.ok(DDMI_TRANSCEIVER_TYPES.GPON_CLASS_C_PLUS);
  assert.ok(DDMI_TRANSCEIVER_TYPES.XGSPON_N1_N2);
  assert.ok(DDMI_TRANSCEIVER_TYPES.EPON_1000BASE_PX20);
  assert.ok(DDMI_TRANSCEIVER_TYPES.BIDI_SFP_GE);

  const gponB = DDMI_TRANSCEIVER_TYPES.GPON_CLASS_B_PLUS;
  assert.equal(gponB.technology, 'GPON 2.488G / 1.244G');
  assert.equal(gponB.standard, 'ITU-T G.984.2');
  assert.equal(gponB.txWavelengthNm, 1310);
  assert.equal(gponB.rxWavelengthNm, 1490);
  assert.ok(gponB.txPowerRangeDbm.minWarn < gponB.txPowerRangeDbm.maxWarn);
  assert.ok(gponB.rxPowerRangeDbm.minWarn < gponB.rxPowerRangeDbm.maxWarn);

  assert.ok(DDMI_SEVERITY_LEVELS.OPTIMAL);
  assert.ok(DDMI_SEVERITY_LEVELS.WARNING);
  assert.ok(DDMI_SEVERITY_LEVELS.ALARM);
  assert.ok(DDMI_SEVERITY_LEVELS.CRITICAL);
});

test('estimateLaserRulMonths Arrhenius model calculates physical life expectancy based on temperature and bias current', async () => {
  const { estimateLaserRulMonths } = await import('../form-validation.js');

  // Baseline at room temperature 25°C and 15mA nominal bias
  const baselineLife = estimateLaserRulMonths(25, 15);
  assert.equal(baselineLife, 60);

  // Moderate temperature 45°C
  const midLife = estimateLaserRulMonths(45, 15);
  assert.ok(midLife < baselineLife);
  assert.ok(midLife > 10);

  // High stress: 75°C and 45mA bias current
  const stressedLife = estimateLaserRulMonths(75, 45);
  assert.ok(stressedLife < midLife);
  assert.ok(stressedLife >= 1);

  // Severe temperature clamp test (e.g. 100°C)
  const extremeLife = estimateLaserRulMonths(100, 60);
  assert.equal(extremeLife, 1);
});

test('evaluateDdmiTelemetry performs multi-channel threshold checks and health scoring', async () => {
  const { evaluateDdmiTelemetry } = await import('../form-validation.js');

  // 1. Pristine nominal telemetry on GPON Class B+
  const pristine = evaluateDdmiTelemetry({
    temperatureC: 40.0,
    voltageV: 3.30,
    txBiasCurrentMa: 15.0,
    txPowerDbm: 2.5,
    rxPowerDbm: -18.0,
    transceiverTypeId: 'GPON_CLASS_B_PLUS'
  });

  assert.equal(pristine.pass, true);
  assert.equal(pristine.verdict.label, 'CERTIFIED HEALTHY (Optimal Telemetry)');
  assert.ok(pristine.scores.overall >= 95);
  assert.equal(pristine.thresholds.temperature, 'NORMAL');
  assert.equal(pristine.thresholds.voltage, 'NORMAL');
  assert.equal(pristine.thresholds.txBias, 'NORMAL');
  assert.equal(pristine.thresholds.txPower, 'NORMAL');
  assert.equal(pristine.thresholds.rxPower, 'NORMAL');
  assert.equal(pristine.warnings.length, 0);

  // 2. High laser temperature warning (68°C)
  const hot = evaluateDdmiTelemetry({
    temperatureC: 68.0,
    voltageV: 3.30,
    txBiasCurrentMa: 15.0,
    txPowerDbm: 2.5,
    rxPowerDbm: -18.0,
    transceiverTypeId: 'GPON_CLASS_B_PLUS'
  });
  assert.equal(hot.thresholds.temperature, 'WARN_HIGH');
  assert.ok(hot.scores.temperature < pristine.scores.temperature);
  assert.ok(hot.warnings.some(w => w.includes('temperature')));

  // 3. Critical low optical Rx power (-32 dBm)
  const deadLink = evaluateDdmiTelemetry({
    temperatureC: 40.0,
    voltageV: 3.30,
    txBiasCurrentMa: 15.0,
    txPowerDbm: 2.5,
    rxPowerDbm: -32.0,
    transceiverTypeId: 'GPON_CLASS_B_PLUS'
  });
  assert.equal(deadLink.pass, false);
  assert.equal(deadLink.thresholds.rxPower, 'ALARM_LOW');
  assert.ok(deadLink.scores.rxPower <= 20);
  assert.equal(deadLink.verdict.label, 'CRITICAL ALARM (Hardware Replacement Required)');
});

test('buildDdmiCertRecord generates structured certification audit records', async () => {
  const { buildDdmiCertRecord } = await import('../form-validation.js');

  const record = buildDdmiCertRecord({
    customerName: 'Muhammad Tariq',
    customerId: 'CUST-042',
    area: 'Saeed Park',
    onuModel: 'Huawei HG8546M',
    onuSerialNumber: 'HWTC-12345678',
    transceiverTypeId: 'GPON_CLASS_B_PLUS',
    temperatureC: 41.5,
    voltageV: 3.31,
    txBiasCurrentMa: 16.0,
    txPowerDbm: 2.2,
    rxPowerDbm: -19.4,
    inspectedBy: 'Shahdara QA Inspector',
    linemanNotes: 'Customer drop fiber spliced and verified.'
  });

  assert.ok(record.id.startsWith('DDMI-'));
  assert.equal(record.customerName, 'Muhammad Tariq');
  assert.equal(record.customerId, 'CUST-042');
  assert.equal(record.area, 'Saeed Park');
  assert.equal(record.temperatureC, 41.5);
  assert.equal(record.voltageV, 3.31);
  assert.equal(record.txBiasCurrentMa, 16.0);
  assert.equal(record.txPowerDbm, 2.2);
  assert.equal(record.rxPowerDbm, -19.4);
  assert.equal(record.pass, true);
  assert.ok(record.healthScore >= 90);
  assert.ok(record.estimatedRulMonths > 0);
});

test('formatDdmiCertWhatsApp outputs bilingual English and Urdu summary for technicians', async () => {
  const { buildDdmiCertRecord, formatDdmiCertWhatsApp } = await import('../form-validation.js');

  const record = buildDdmiCertRecord({
    customerName: 'Bashir Ahmed',
    customerId: 'CUST-88',
    area: 'Farrukhabad',
    onuModel: 'ZTE F660',
    onuSerialNumber: 'ZTEG-99887766',
    transceiverTypeId: 'GPON_CLASS_B_PLUS',
    temperatureC: 43.0,
    voltageV: 3.30,
    txBiasCurrentMa: 17.0,
    txPowerDbm: 2.1,
    rxPowerDbm: -19.0,
    inspectedBy: 'Saad (Field Ops)',
    linemanNotes: 'All optics in spec.'
  });

  const waText = formatDdmiCertWhatsApp(record);
  assert.match(waText, /SHAHDARA ISP/);
  assert.match(waText, /آپٹیکل ٹرانسیور تشخیصی رپورٹ/);
  assert.match(waText, /Bashir Ahmed/);
  assert.match(waText, /Farrukhabad/);
  assert.match(waText, /43°C/);
  assert.match(waText, /3\.3 V/);
  assert.match(waText, /17 mA/);
  assert.match(waText, /-19 dBm/);
  assert.match(waText, /CERTIFIED HEALTHY/);
});

test('generateDdmiCertHtml produces standard A4 certificate and thermal 80mm slip', async () => {
  const { buildDdmiCertRecord, generateDdmiCertHtml } = await import('../form-validation.js');

  const record = buildDdmiCertRecord({
    customerName: 'Imran Khan',
    customerId: 'CUST-100',
    area: 'Jia Musa',
    onuModel: 'FiberHome AN5506',
    onuSerialNumber: 'FHTT-55443322',
    transceiverTypeId: 'GPON_CLASS_B_PLUS',
    temperatureC: 39.0,
    voltageV: 3.32,
    txBiasCurrentMa: 14.5,
    txPowerDbm: 2.8,
    rxPowerDbm: -17.5,
    inspectedBy: 'Shahdara ISP QA Tech'
  });

  const a4Html = generateDdmiCertHtml(record, 'standard');
  assert.match(a4Html, /ddmi-a4-certificate/);
  assert.match(a4Html, /SHAHDARA FIBER BROADBAND SERVICES/);
  assert.match(a4Html, /CUST-100/);
  assert.match(a4Html, /FiberHome AN5506/);
  assert.match(a4Html, /Laser Diode Tx Bias Current/);

  const thermalHtml = generateDdmiCertHtml(record, 'thermal');
  assert.match(thermalHtml, /ddmi-thermal-slip/);
  assert.match(thermalHtml, /ONU DDMI TELEMETRY SLIP/);
  assert.match(thermalHtml, /FHTT-55443322/);
});

test('generateDdmiCertsCsv produces RFC-4180 export with UTF-8 BOM', async () => {
  const { buildDdmiCertRecord, generateDdmiCertsCsv } = await import('../form-validation.js');

  const rec1 = buildDdmiCertRecord({
    customerName: 'Customer A, Shahdara',
    customerId: 'CUST-001',
    area: 'Shahdara Town',
    onuModel: 'Huawei HG8546M',
    onuSerialNumber: 'SN-001'
  });

  const rec2 = buildDdmiCertRecord({
    customerName: 'Customer B',
    customerId: 'CUST-002',
    area: 'Qaiser Town',
    onuModel: 'ZTE F609',
    onuSerialNumber: 'SN-002'
  });

  const csv = generateDdmiCertsCsv([rec1, rec2]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Certificate ID,Date \/ Time/);
  assert.match(csv, /"Customer A, Shahdara"/);
  assert.match(csv, /Customer B/);
});

test('renderDdmiTelemetrySvg renders pure vector 5-gauge dashboard with health readout', async () => {
  const { buildDdmiCertRecord, renderDdmiTelemetrySvg } = await import('../form-validation.js');

  const record = buildDdmiCertRecord({
    customerName: 'Naveed Akhtar',
    customerId: 'CUST-77',
    area: 'Kot Mohibbu',
    transceiverTypeId: 'GPON_CLASS_B_PLUS',
    temperatureC: 44.0,
    voltageV: 3.30,
    txBiasCurrentMa: 18.0,
    txPowerDbm: 2.3,
    rxPowerDbm: -18.5
  });

  const svg = renderDdmiTelemetrySvg(record);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /ddmi-telemetry-svg/);
  assert.match(svg, /TEMP/);
  assert.match(svg, /VOLTAGE/);
  assert.match(svg, /TX BIAS/);
  assert.match(svg, /TX POWER/);
  assert.match(svg, /RX POWER/);
  assert.match(svg, /HEALTH INDEX/);
  assert.match(svg, /EXPECTED LIFE/);
});

test('storage operations: saveDdmiCert, getSavedDdmiCerts, and clearDdmiCerts', async () => {
  const { buildDdmiCertRecord, saveDdmiCert, getSavedDdmiCerts, clearDdmiCerts } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  assert.deepEqual(getSavedDdmiCerts(mockStorage), []);

  const r1 = buildDdmiCertRecord({ customerName: 'User 1' });
  const r2 = buildDdmiCertRecord({ customerName: 'User 2' });

  saveDdmiCert(r1, mockStorage);
  saveDdmiCert(r2, mockStorage);

  const saved = getSavedDdmiCerts(mockStorage);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].customerName, 'User 2'); // newest first
  assert.equal(saved[1].customerName, 'User 1');

  clearDdmiCerts(mockStorage);
  assert.deepEqual(getSavedDdmiCerts(mockStorage), []);
});

test('setupDdmiCertModal handles headless and mock environments safely', async () => {
  const { setupDdmiCertModal } = await import('../form-validation.js');

  const controller = setupDdmiCertModal({
    document: null,
    storage: null
  });

  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.getCurrentReading, 'function');
  assert.equal(typeof controller.setReading, 'function');

  // Calling without error
  controller.open();
  controller.setReading({ temperatureC: 45 });
  controller.close();
});

test('DOM and styling: index.html, styles.css, and app.js wire Customer ONU DDMI Telemetry QA Modal', () => {
  const freshIndex = read('index.html');
  const freshStyles = read('styles.css');
  const freshApp = read('app.js');

  // Trigger button in index.html
  assert.match(freshIndex, /id="openDdmiCertBtn"/);
  assert.match(freshIndex, /data-open-ddmi-cert/);

  // Modal dialog & inputs in index.html
  assert.match(freshIndex, /<dialog id="ddmiCertModal"/);
  assert.match(freshIndex, /id="ddmiCertModalCloseBtn"/);
  assert.match(freshIndex, /id="ddmiSvgContainer"/);
  assert.match(freshIndex, /id="ddmiHealthDisplay"/);
  assert.match(freshIndex, /id="ddmiVerdictBadge"/);
  assert.match(freshIndex, /id="ddmiWarningsContainer"/);
  assert.match(freshIndex, /id="ddmiCustomerNameInput"/);
  assert.match(freshIndex, /id="ddmiAreaSelect"/);
  assert.match(freshIndex, /id="ddmiOnuModelInput"/);
  assert.match(freshIndex, /id="ddmiOnuSerialInput"/);
  assert.match(freshIndex, /id="ddmiTransceiverTypeSelect"/);
  assert.match(freshIndex, /id="ddmiTempSlider"/);
  assert.match(freshIndex, /id="ddmiTempVal"/);
  assert.match(freshIndex, /id="ddmiVoltSlider"/);
  assert.match(freshIndex, /id="ddmiVoltVal"/);
  assert.match(freshIndex, /id="ddmiBiasSlider"/);
  assert.match(freshIndex, /id="ddmiBiasVal"/);
  assert.match(freshIndex, /id="ddmiTxSlider"/);
  assert.match(freshIndex, /id="ddmiTxVal"/);
  assert.match(freshIndex, /id="ddmiRxSlider"/);
  assert.match(freshIndex, /id="ddmiRxVal"/);
  assert.match(freshIndex, /id="ddmiNotesInput"/);
  assert.match(freshIndex, /id="ddmiRecordCertBtn"/);
  assert.match(freshIndex, /id="ddmiCopyReportBtn"/);
  assert.match(freshIndex, /id="ddmiPrintA4Btn"/);
  assert.match(freshIndex, /id="ddmiPrintThermalBtn"/);
  assert.match(freshIndex, /id="ddmiExportCsvBtn"/);
  assert.match(freshIndex, /id="ddmiClearHistoryBtn"/);
  assert.match(freshIndex, /id="ddmiHistoryTableBody"/);

  // Styles
  assert.match(freshStyles, /\.ddmi-cert-modal-card/);
  assert.match(freshStyles, /\.ddmi-telemetry-svg/);
  assert.match(freshStyles, /\[data-theme="dark"\] \.ddmi-cert-modal-card/);

  // App.js
  assert.match(freshApp, /setupDdmiCertModal/);
  assert.match(freshApp, /customerDdmiCertModalController/);
  assert.match(freshApp, /openDdmiCertBtn/);
});

/* ==========================================================================
   OPTICAL FIBER CHROMATIC & PMD DISPERSION QA TEST SUITE
   ========================================================================== */

test('Dispersion catalogs: fiber standards and bitrate profiles are complete and physically accurate', async () => {
  const { FIBER_DISPERSION_PROFILES, BITRATE_DISPERSION_STANDARDS, DISPERSION_SEVERITY_LEVELS } = await import('../form-validation.js');

  assert.ok(FIBER_DISPERSION_PROFILES.G652D);
  assert.ok(FIBER_DISPERSION_PROFILES.G655);
  assert.ok(FIBER_DISPERSION_PROFILES.G657A1);
  assert.ok(FIBER_DISPERSION_PROFILES.G657A2);
  assert.ok(FIBER_DISPERSION_PROFILES.LEGACY_AERIAL_1998);

  const g652 = FIBER_DISPERSION_PROFILES.G652D;
  assert.equal(g652.zeroDispersionWavelengthNm, 1312);
  assert.equal(g652.nominalPmdCoef, 0.10);

  assert.ok(BITRATE_DISPERSION_STANDARDS.RATE_1G);
  assert.ok(BITRATE_DISPERSION_STANDARDS.RATE_2_5G);
  assert.ok(BITRATE_DISPERSION_STANDARDS.RATE_10G);
  assert.ok(BITRATE_DISPERSION_STANDARDS.RATE_25G);
  assert.ok(BITRATE_DISPERSION_STANDARDS.RATE_100G);

  assert.ok(DISPERSION_SEVERITY_LEVELS.OPTIMAL);
  assert.ok(DISPERSION_SEVERITY_LEVELS.MARGINAL);
  assert.ok(DISPERSION_SEVERITY_LEVELS.EXCEEDED);
});

test('calculateChromaticDispersionCoefficient computes physical dispersion curve D(lambda)', async () => {
  const { FIBER_DISPERSION_PROFILES, calculateChromaticDispersionCoefficient } = await import('../form-validation.js');

  const g652 = FIBER_DISPERSION_PROFILES.G652D;

  // At zero dispersion wavelength 1312 nm: should be exactly ~0 ps/(nm*km)
  const dZero = calculateChromaticDispersionCoefficient(1312, g652);
  assert.ok(Math.abs(dZero) < 0.1);

  // At 1550 nm on standard SMF: standard value is ~17 ps/(nm*km)
  const d1550 = calculateChromaticDispersionCoefficient(1550, g652);
  assert.ok(d1550 >= 16.5 && d1550 <= 17.5);

  // At 1310 nm: slightly negative dispersion (-0.1 to -0.3 ps/(nm*km))
  const d1310 = calculateChromaticDispersionCoefficient(1310, g652);
  assert.ok(d1310 < 0);
  assert.ok(d1310 > -1.0);
});

test('evaluateLinkDispersion evaluates CD, PMD DGD, and bit rate penalties', async () => {
  const { evaluateLinkDispersion } = await import('../form-validation.js');

  // 1. Nominal 12.5 km link at 1550 nm for 10G XGS-PON
  const res10G = evaluateLinkDispersion({
    spanLengthKm: 12.5,
    operatingWavelengthNm: 1550,
    fiberProfileId: 'G652D',
    targetBitrateId: 'RATE_10G'
  });

  assert.equal(res10G.cdPassed, true);
  assert.equal(res10G.pmdPassed, true);
  assert.equal(res10G.overallPass, true);
  assert.ok(res10G.totalCdPsPerNm > 200 && res10G.totalCdPsPerNm < 225);
  assert.ok(res10G.meanDgdPs > 0.3 && res10G.meanDgdPs < 0.4);
  assert.equal(res10G.verdict.id, 'OPTIMAL');

  // 2. Long 50 km feeder span at 25G-PON (25G limit is only 120 ps/nm)
  const res25GExceeded = evaluateLinkDispersion({
    spanLengthKm: 50.0,
    operatingWavelengthNm: 1550,
    fiberProfileId: 'G652D',
    targetBitrateId: 'RATE_25G'
  });

  assert.equal(res25GExceeded.cdPassed, false);
  assert.equal(res25GExceeded.overallPass, false);
  assert.equal(res25GExceeded.verdict.id, 'EXCEEDED');
  assert.ok(res25GExceeded.warnings.some(w => w.includes('Chromatic Dispersion')));
});

test('buildDispersionCertRecord creates sequential structured inspection records', async () => {
  const { buildDispersionCertRecord } = await import('../form-validation.js');

  const record = buildDispersionCertRecord({
    feederRouteName: 'Saeed Park to Kot Mohibbu Sub-Ring',
    spanLengthKm: 8.4,
    operatingWavelengthNm: 1577,
    fiberProfileId: 'G657A1',
    targetBitrateId: 'RATE_10G',
    inspectedBy: 'Saad QA Tech'
  });

  assert.ok(record.id.startsWith('DSP-'));
  assert.equal(record.feederRouteName, 'Saeed Park to Kot Mohibbu Sub-Ring');
  assert.equal(record.spanLengthKm, 8.4);
  assert.equal(record.operatingWavelengthNm, 1577);
  assert.equal(record.overallPass, true);
  assert.ok(record.totalCdPsPerNm > 0);
  assert.ok(record.meanDgdPs > 0);
});

test('formatDispersionCertWhatsApp outputs bilingual NOC summary', async () => {
  const { buildDispersionCertRecord, formatDispersionCertWhatsApp } = await import('../form-validation.js');

  const record = buildDispersionCertRecord({
    feederRouteName: 'Shahdara to Farrukhabad Trunk',
    originPop: 'Shahdara OLT',
    destinationNode: 'Farrukhabad FAT Hub',
    spanLengthKm: 14.0,
    operatingWavelengthNm: 1550
  });

  const text = formatDispersionCertWhatsApp(record);
  assert.match(text, /SHAHDARA ISP/);
  assert.match(text, /ڈسپریشن/);
  assert.match(text, /Shahdara to Farrukhabad Trunk/);
  assert.match(text, /14 km/);
  assert.match(text, /1550 nm/);
  assert.match(text, /PASSED/);
});

test('generateDispersionCertHtml produces standard A4 certificate and thermal slip', async () => {
  const { buildDispersionCertRecord, generateDispersionCertHtml } = await import('../form-validation.js');

  const record = buildDispersionCertRecord({
    feederRouteName: 'Jia Musa Overhead Feeder',
    spanLengthKm: 6.2,
    operatingWavelengthNm: 1550
  });

  const a4 = generateDispersionCertHtml(record, 'standard');
  assert.match(a4, /dispersion-a4-certificate/);
  assert.match(a4, /SHAHDARA FIBER BROADBAND SERVICES/);
  assert.match(a4, /Jia Musa Overhead Feeder/);

  const thermal = generateDispersionCertHtml(record, 'thermal');
  assert.match(thermal, /dispersion-thermal-slip/);
  assert.match(thermal, /OPTICAL DISPERSION QA SLIP/);
});

test('generateDispersionCertsCsv produces RFC-4180 CSV with BOM', async () => {
  const { buildDispersionCertRecord, generateDispersionCertsCsv } = await import('../form-validation.js');

  const r1 = buildDispersionCertRecord({ feederRouteName: 'Route 1, Shahdara' });
  const r2 = buildDispersionCertRecord({ feederRouteName: 'Route 2' });

  const csv = generateDispersionCertsCsv([r1, r2]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /Certificate ID,Date \/ Time/);
  assert.match(csv, /"Route 1, Shahdara"/);
  assert.match(csv, /Route 2/);
});

test('renderDispersionAnalysisSvg renders pure vector spectral curve and KPI ribbon', async () => {
  const { buildDispersionCertRecord, renderDispersionAnalysisSvg } = await import('../form-validation.js');

  const record = buildDispersionCertRecord({
    feederRouteName: 'Baradari Road Trunk',
    spanLengthKm: 10.0,
    operatingWavelengthNm: 1550
  });

  const svg = renderDispersionAnalysisSvg(record);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /dispersion-analysis-svg/);
  assert.match(svg, /CHROMATIC DISPERSION SPECTRAL CURVE/);
  assert.match(svg, /polyline/);
  assert.match(svg, /TOTAL CHROMATIC DISPERSION/);
  assert.match(svg, /MAXWELLIAN PEAK DGD/);
});

test('storage operations: saveDispersionCert, getSavedDispersionCerts, and clearDispersionCerts', async () => {
  const { buildDispersionCertRecord, saveDispersionCert, getSavedDispersionCerts, clearDispersionCerts } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  assert.deepEqual(getSavedDispersionCerts(mockStorage), []);

  const r1 = buildDispersionCertRecord({ feederRouteName: 'Span A' });
  const r2 = buildDispersionCertRecord({ feederRouteName: 'Span B' });

  saveDispersionCert(r1, mockStorage);
  saveDispersionCert(r2, mockStorage);

  const list = getSavedDispersionCerts(mockStorage);
  assert.equal(list.length, 2);
  assert.equal(list[0].feederRouteName, 'Span B'); // newest first
  assert.equal(list[1].feederRouteName, 'Span A');

  clearDispersionCerts(mockStorage);
  assert.deepEqual(getSavedDispersionCerts(mockStorage), []);
});

test('setupDispersionCertModal operates safely in headless and mock environments', async () => {
  const { setupDispersionCertModal } = await import('../form-validation.js');

  const controller = setupDispersionCertModal({
    document: null,
    storage: null
  });

  assert.equal(typeof controller.open, 'function');
  assert.equal(typeof controller.close, 'function');
  assert.equal(typeof controller.getCurrentReading, 'function');
  assert.equal(typeof controller.setReading, 'function');

  controller.open();
  controller.setReading({ spanLengthKm: 15.0 });
  controller.close();
});

test('DOM and styling: index.html, styles.css, and app.js wire Fiber Feeder Dispersion QA Modal', () => {
  const freshIndex = read('index.html');
  const freshStyles = read('styles.css');
  const freshApp = read('app.js');

  // Trigger button in index.html
  assert.match(freshIndex, /id="openDispersionCertBtn"/);
  assert.match(freshIndex, /data-open-dispersion-cert/);

  // Modal dialog & inputs in index.html
  assert.match(freshIndex, /<dialog id="dispersionCertModal"/);
  assert.match(freshIndex, /id="dispersionCertModalCloseBtn"/);
  assert.match(freshIndex, /id="dispersionSvgContainer"/);
  assert.match(freshIndex, /id="dispersionCdReadout"/);
  assert.match(freshIndex, /id="dispersionDgdReadout"/);
  assert.match(freshIndex, /id="dispersionBitrateReadout"/);
  assert.match(freshIndex, /id="dispersionVerdictBadge"/);
  assert.match(freshIndex, /id="dispersionWarningsContainer"/);
  assert.match(freshIndex, /id="dispersionRouteInput"/);
  assert.match(freshIndex, /id="dispersionOriginInput"/);
  assert.match(freshIndex, /id="dispersionDestInput"/);
  assert.match(freshIndex, /id="dispersionFiberProfileSelect"/);
  assert.match(freshIndex, /id="dispersionWlSelect"/);
  assert.match(freshIndex, /id="dispersionTargetBitrateSelect"/);
  assert.match(freshIndex, /id="dispersionSpanSlider"/);
  assert.match(freshIndex, /id="dispersionSpanVal"/);
  assert.match(freshIndex, /id="dispersionPmdSlider"/);
  assert.match(freshIndex, /id="dispersionPmdVal"/);
  assert.match(freshIndex, /id="dispersionNotesInput"/);
  assert.match(freshIndex, /id="dispersionRecordCertBtn"/);
  assert.match(freshIndex, /id="dispersionCopyReportBtn"/);
  assert.match(freshIndex, /id="dispersionPrintA4Btn"/);
  assert.match(freshIndex, /id="dispersionPrintThermalBtn"/);
  assert.match(freshIndex, /id="dispersionExportCsvBtn"/);
  assert.match(freshIndex, /id="dispersionClearHistoryBtn"/);
  assert.match(freshIndex, /id="dispersionHistoryTableBody"/);

  // Styles
  assert.match(freshStyles, /\.dispersion-cert-modal-card/);
  assert.match(freshStyles, /\.dispersion-analysis-svg/);
  assert.match(freshStyles, /\[data-theme="dark"\] \.dispersion-cert-modal-card/);

  // App.js
  assert.match(freshApp, /setupDispersionCertModal/);
  assert.match(freshApp, /customerDispersionModalController/);
  assert.match(freshApp, /openDispersionCertBtn/);
});

/* ==========================================================================
   CUSTOMER FIBER CABLE BENDING RADIUS & MACRO-BEND QA TEST SUITE
   ========================================================================== */

test('Bend loss catalogs: ITU-T fiber standards, wavelength multipliers, and verdicts are accurate', async () => {
  const {
    FIBER_BEND_STANDARDS,
    WAVELENGTH_BEND_MULTIPLIERS,
    ROUTING_CHECKLIST_ITEMS,
    BEND_VERDICTS
  } = await import('../form-validation.js');

  assert.ok(FIBER_BEND_STANDARDS.G652D);
  assert.ok(FIBER_BEND_STANDARDS.G657A1);
  assert.ok(FIBER_BEND_STANDARDS.G657A2);
  assert.ok(FIBER_BEND_STANDARDS.G657B3);

  assert.equal(FIBER_BEND_STANDARDS.G652D.minRadiusMm, 30.0);
  assert.equal(FIBER_BEND_STANDARDS.G657A1.minRadiusMm, 10.0);
  assert.equal(FIBER_BEND_STANDARDS.G657A2.minRadiusMm, 7.5);
  assert.equal(FIBER_BEND_STANDARDS.G657B3.minRadiusMm, 5.0);

  // Wavelength sensitivity: 1625nm > 1577nm > 1550nm > 1490nm > 1310nm
  assert.ok(WAVELENGTH_BEND_MULTIPLIERS['1625'].factor > WAVELENGTH_BEND_MULTIPLIERS['1577'].factor);
  assert.ok(WAVELENGTH_BEND_MULTIPLIERS['1577'].factor > WAVELENGTH_BEND_MULTIPLIERS['1550'].factor);
  assert.ok(WAVELENGTH_BEND_MULTIPLIERS['1550'].factor > WAVELENGTH_BEND_MULTIPLIERS['1490'].factor);
  assert.ok(WAVELENGTH_BEND_MULTIPLIERS['1490'].factor > WAVELENGTH_BEND_MULTIPLIERS['1310'].factor);

  assert.equal(ROUTING_CHECKLIST_ITEMS.length, 5);
  assert.ok(BEND_VERDICTS.OPTIMAL_PASS);
  assert.ok(BEND_VERDICTS.ACCEPTABLE_PASS);
  assert.ok(BEND_VERDICTS.MARGINAL_WARNING);
  assert.ok(BEND_VERDICTS.CRITICAL_MACROBEND_FAIL);
});

test('calculateMacroBendLoss models physics of bend-induced loss and wavelength differential', async () => {
  const { calculateMacroBendLoss, BEND_VERDICTS } = await import('../form-validation.js');

  // Compliant radius on G.657.A2 (R = 15mm, turns = 2, no stress, full checklist)
  const safeRes = calculateMacroBendLoss({
    fiberType: 'G657A2',
    radiusMm: 15.0,
    turnsCount: 2,
    microBendStressIndex: 0,
    checklist: { rosette_slack: true, wall_corners: true, clip_tension: true, entry_conduit: true, onu_pigtail: true }
  });

  assert.equal(safeRes.compliant, true);
  assert.equal(safeRes.verdict.id, BEND_VERDICTS.OPTIMAL_PASS.id);
  assert.ok(safeRes.loss1550Db < 0.25);
  assert.ok(safeRes.loss1310Db <= safeRes.loss1550Db);
  assert.ok(safeRes.loss1625Db >= safeRes.loss1550Db);
  assert.ok(safeRes.differential1550_1310Db >= 0);

  // Severe macro-bend on G.652.D (R = 10mm, turns = 3, well below 30mm minimum)
  const severeRes = calculateMacroBendLoss({
    fiberType: 'G652D',
    radiusMm: 10.0,
    turnsCount: 3,
    microBendStressIndex: 0
  });

  assert.equal(severeRes.compliant, false);
  assert.ok(severeRes.loss1550Db > 1.0, `Expected severe loss on 10mm G652D, got ${severeRes.loss1550Db}`);
  assert.ok(severeRes.differential1550_1310Db > 0.8, 'Expected strong wavelength differential on severe macro-bend');
  assert.equal(severeRes.verdict.id, BEND_VERDICTS.CRITICAL_MACROBEND_FAIL.id);

  // Turns scaling: 4 turns should produce roughly double the macro-bend loss of 2 turns
  const twoTurns = calculateMacroBendLoss({ fiberType: 'G657A1', radiusMm: 8.0, turnsCount: 2 });
  const fourTurns = calculateMacroBendLoss({ fiberType: 'G657A1', radiusMm: 8.0, turnsCount: 4 });
  assert.ok(fourTurns.loss1550Db > twoTurns.loss1550Db * 1.8);

  // Micro-bend stress index addition
  const noStress = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 15.0, microBendStressIndex: 0 });
  const highStress = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 15.0, microBendStressIndex: 50 });
  assert.ok(highStress.microBendPenaltyDb > 0.4);
  assert.ok(highStress.loss1550Db > noStress.loss1550Db);

  // Incomplete checklist triggers critical checklist verdict fail
  const fullCheck = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 15.0, checklist: { rosette_slack: true, wall_corners: true, clip_tension: true, entry_conduit: true, onu_pigtail: true } });
  const badCheck = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 15.0, checklist: { rosette_slack: false, wall_corners: false, clip_tension: true, entry_conduit: true, onu_pigtail: true } });
  assert.equal(fullCheck.verdict.id, BEND_VERDICTS.OPTIMAL_PASS.id);
  assert.equal(badCheck.criticalChecklistFailed, true);
  assert.equal(badCheck.verdict.id, BEND_VERDICTS.CRITICAL_MACROBEND_FAIL.id);
});

test('validateBendLossCertInput handles valid and invalid parameter boundaries', async () => {
  const { validateBendLossCertInput } = await import('../form-validation.js');

  const v1 = validateBendLossCertInput({ customerName: 'Ahmad Khan', radiusMm: 15, turnsCount: 2, microBendStressIndex: 0, fiberType: 'G657A2' });
  assert.equal(v1.valid, true);

  const v2 = validateBendLossCertInput({ customerName: 'Ahmad Khan', radiusMm: 1, turnsCount: 2 }); // below 2.5mm
  assert.equal(v2.valid, false);
  assert.ok(v2.errors.radiusMm);

  const v3 = validateBendLossCertInput({ customerName: 'Ahmad Khan', radiusMm: 15, turnsCount: 0 }); // turns < 1
  assert.equal(v3.valid, false);
  assert.ok(v3.errors.turnsCount);

  const v4 = validateBendLossCertInput({ customerName: 'Ahmad Khan', radiusMm: 15, microBendStressIndex: 120 }); // index > 100
  assert.equal(v4.valid, false);
  assert.ok(v4.errors.microBendStressIndex);

  const v5 = validateBendLossCertInput({ customerName: '', radiusMm: 15, turnsCount: 2, microBendStressIndex: 0 });
  assert.equal(v5.valid, false);
  assert.ok(v5.errors.customerName);
});

test('buildBendLossCertRecord generates formatted audit record with unique ID', async () => {
  const { calculateMacroBendLoss, buildBendLossCertRecord } = await import('../form-validation.js');

  const result = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 12.0, turnsCount: 1 });
  const existing = [{ id: 'BND-202610-0001' }, { id: 'BND-202610-0002' }];

  const record = buildBendLossCertRecord({
    ...result,
    customerNumber: 'CUST-8801',
    customerName: 'Muhammad Tariq',
    customerPhone: '+923001234567',
    area: 'MOHALLA NAKAR',
    technicianName: 'Lineman Bashir',
    notes: 'Corner molding secured with clips.'
  }, existing);

  assert.match(record.id, /^BND-\d{6}-0003$/);
  assert.equal(record.customerName, 'Muhammad Tariq');
  assert.equal(record.customerNumber, 'CUST-8801');
  assert.equal(record.area, 'MOHALLA NAKAR');
  assert.equal(record.radiusMm, 12.0);
  assert.equal(record.turnsCount, 1);
  assert.ok(record.timestamp);
});

test('getSavedBendLossCerts and saveBendLossCert manage storage lifecycle and 100-item cap', async () => {
  const { getSavedBendLossCerts, saveBendLossCert, clearBendLossCerts, BEND_LOSS_STORAGE_KEY } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  assert.deepEqual(getSavedBendLossCerts(mockStorage), []);

  // Save 105 items
  for (let i = 1; i <= 105; i++) {
    saveBendLossCert({ id: `BND-${String(i).padStart(4, '0')}`, customerName: `Cust ${i}`, radiusMm: 15 }, mockStorage);
  }

  const saved = getSavedBendLossCerts(mockStorage);
  assert.equal(saved.length, 100);
  assert.equal(saved[0].id, 'BND-0105'); // Most recent first
  assert.equal(saved[99].id, 'BND-0006'); // FIFO cap

  // Corrupted storage handling
  mockStorage.setItem(BEND_LOSS_STORAGE_KEY, 'INVALID_JSON_CORRUPT');
  assert.deepEqual(getSavedBendLossCerts(mockStorage), []);

  // Clear
  saveBendLossCert({ id: 'BND-0001', customerName: 'Test' }, mockStorage);
  assert.equal(getSavedBendLossCerts(mockStorage).length, 1);
  clearBendLossCerts(mockStorage);
  assert.equal(getSavedBendLossCerts(mockStorage).length, 0);
});

test('renderBendLossAnalysisSvg generates SVG markup with radius mandrel and spectral bars', async () => {
  const { calculateMacroBendLoss, renderBendLossAnalysisSvg } = await import('../form-validation.js');

  const result = calculateMacroBendLoss({ fiberType: 'G657A2', radiusMm: 15.0, turnsCount: 2 });
  const svg = renderBendLossAnalysisSvg(result);

  assert.ok(svg.includes('<svg class="bend-loss-analysis-svg"'));
  assert.ok(svg.includes('viewBox="0 0 760 300"'));
  assert.ok(svg.includes('R = 15.0 mm'));
  assert.ok(svg.includes('ITU-T G.657 FIBER BEND DYNAMICS'));
  assert.ok(svg.includes('SPECTRAL LOSS DIFFERENTIAL'));
  assert.ok(svg.includes('1310nm'));
  assert.ok(svg.includes('1550nm'));
  assert.ok(svg.includes('1625nm'));
});

test('formatBendLossCertWhatsApp generates rich field dispatch summary', async () => {
  const { formatBendLossCertWhatsApp, BEND_VERDICTS } = await import('../form-validation.js');

  const text = formatBendLossCertWhatsApp({
    id: 'BND-0012',
    timestamp: '2026-10-16T15:30:00Z',
    technicianName: 'Lineman Farhan',
    area: 'Shahdara Park',
    customerName: 'Usman Ali',
    customerNumber: '1042',
    fiberType: 'G.657.A2',
    radiusMm: 12.5,
    turnsCount: 2,
    microBendStressIndex: 10,
    loss1310Db: 0.08,
    loss1490Db: 0.16,
    loss1550Db: 0.28,
    loss1625Db: 0.72,
    differential1550_1310Db: 0.20,
    verdict: BEND_VERDICTS.OPTIMAL_PASS,
    notes: 'Protected with wall cable clip.'
  });

  assert.ok(text.includes('SHAHDARA FIBER NET · BENDING RADIUS & MACRO-BEND QA REPORT'));
  assert.ok(text.includes('BND-0012'));
  assert.ok(text.includes('Usman Ali'));
  assert.ok(text.includes('12.5 mm'));
  assert.ok(text.includes('1310 nm'));
  assert.ok(text.includes('1550 nm'));
  assert.ok(text.includes('1625 nm'));
  assert.ok(text.includes('Differential (1550 - 1310):* 0.2 dB') || text.includes('Differential (1550 - 1310):* 0.20 dB'));
  assert.ok(text.includes('Protected with wall cable clip.'));
});

test('generateBendLossCertHtml renders dual printable A4 cert and 80mm POS thermal slip', async () => {
  const { generateBendLossCertHtml, BEND_VERDICTS } = await import('../form-validation.js');

  const cert = {
    id: 'BND-0044',
    timestamp: '2026-10-16T16:00:00Z',
    customerName: 'Zahid Mehmood',
    customerNumber: '1099',
    customerPhone: '+923007654321',
    area: 'Mohalla Charyaa',
    fiberType: 'G.657.A2',
    radiusMm: 14.0,
    turnsCount: 1,
    loss1310Db: 0.05,
    loss1550Db: 0.18,
    loss1625Db: 0.50,
    differential1550_1310Db: 0.13,
    verdict: BEND_VERDICTS.OPTIMAL_PASS,
    technicianName: 'Lineman Aslam',
    notes: 'Clean bend arc maintained.'
  };

  const sheetHtml = generateBendLossCertHtml(cert, { format: 'sheet' });
  assert.ok(sheetHtml.includes('SHAHDARA ISP BROADBAND &amp; OPTICAL NETWORKS'));
  assert.ok(sheetHtml.includes('OUTSIDE PLANT &amp; SUBSCRIBER PREMISES BEND LOSS QA CERTIFICATE'));
  assert.ok(sheetHtml.includes('Zahid Mehmood'));
  assert.ok(sheetHtml.includes('BND-0044'));
  assert.ok(sheetHtml.includes('SUBSCRIBER DETAILS'));

  const slipHtml = generateBendLossCertHtml(cert, { format: 'slip' });
  assert.ok(slipHtml.includes('bend-thermal-slip'));
  assert.ok(slipHtml.includes('BEND RADIUS &amp; MACRO-BEND QA'));
  assert.ok(slipHtml.includes('14 mm'));
});

test('generateBendLossCertsCsv produces RFC-4180 CSV with UTF-8 BOM', async () => {
  const { generateBendLossCertsCsv, BEND_VERDICTS } = await import('../form-validation.js');

  const emptyCsv = generateBendLossCertsCsv([]);
  assert.ok(emptyCsv.startsWith('\uFEFFInspection_ID,Date,Customer_No,Customer_Name'));

  const records = [
    {
      id: 'BND-0001',
      timestamp: '2026-10-16T12:00:00Z',
      customerNumber: '1001',
      customerName: 'Ali Raza, Khan',
      customerPhone: '+923001112233',
      area: 'Shahdara Town',
      fiberType: 'G657A2',
      radiusMm: 15,
      turnsCount: 2,
      microBendStressIndex: 0,
      loss1310Db: 0.05,
      loss1550Db: 0.20,
      differential1550_1310Db: 0.15,
      verdict: BEND_VERDICTS.OPTIMAL_PASS,
      technicianName: 'Lineman Tariq',
      notes: 'Pass, good loop.'
    }
  ];

  const csv = generateBendLossCertsCsv(records);
  assert.ok(csv.startsWith('\uFEFFInspection_ID'));
  assert.ok(csv.includes('"Ali Raza, Khan"'));
  assert.ok(csv.includes('"Pass, good loop."'));
  assert.ok(csv.includes('BND-0001'));
});

test('UI wiring, index.html, styles.css, app.js and modal integration for bend loss cert', async () => {
  const freshIndex = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const freshApp = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const freshStyles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

  // Trigger button
  assert.match(freshIndex, /id="openBendLossCertBtn"/);
  assert.match(freshIndex, /data-open-bend-loss-cert/);

  // Modal dialog and elements
  assert.match(freshIndex, /id="bendLossCertModal"/);
  assert.match(freshIndex, /id="bendLossCertModalTitle"/);
  assert.match(freshIndex, /id="bendLossCertModalCloseBtn"/);
  assert.match(freshIndex, /id="bendLossSvgContainer"/);
  assert.match(freshIndex, /id="bendLoss1310Readout"/);
  assert.match(freshIndex, /id="bendLoss1550Readout"/);
  assert.match(freshIndex, /id="bendLossDiffReadout"/);
  assert.match(freshIndex, /id="bendLossVerdictBadge"/);
  assert.match(freshIndex, /id="bendLossFiberSelect"/);
  assert.match(freshIndex, /id="bendLossRadiusSlider"/);
  assert.match(freshIndex, /id="bendLossRadiusVal"/);
  assert.match(freshIndex, /id="bendLossTurnsSlider"/);
  assert.match(freshIndex, /id="bendLossTurnsVal"/);
  assert.match(freshIndex, /id="bendLossStressSlider"/);
  assert.match(freshIndex, /id="bendLossStressVal"/);
  assert.match(freshIndex, /id="bendCheckRosette"/);
  assert.match(freshIndex, /id="bendCheckCorners"/);
  assert.match(freshIndex, /id="bendCheckClips"/);
  assert.match(freshIndex, /id="bendCheckEntry"/);
  assert.match(freshIndex, /id="bendCheckOnu"/);
  assert.match(freshIndex, /id="bendLossNotesInput"/);
  assert.match(freshIndex, /id="bendLossRecordCertBtn"/);
  assert.match(freshIndex, /id="bendLossCopyReportBtn"/);
  assert.match(freshIndex, /id="bendLossPrintA4Btn"/);
  assert.match(freshIndex, /id="bendLossPrintThermalBtn"/);
  assert.match(freshIndex, /id="bendLossExportCsvBtn"/);
  assert.match(freshIndex, /id="bendLossClearHistoryBtn"/);
  assert.match(freshIndex, /id="bendLossHistoryTableBody"/);

  // Styles
  assert.match(freshStyles, /\.bend-loss-cert-modal-card/);
  assert.match(freshStyles, /\.bend-loss-analysis-svg/);
  assert.match(freshStyles, /\[data-theme="dark"\] \.bend-loss-cert-modal-card/);

  // App.js
  assert.match(freshApp, /setupBendLossCertModal/);
  assert.match(freshApp, /customerBendLossModalController/);
  assert.match(freshApp, /openBendLossCertBtn/);
});

test('calculateRecommendedSlackLoopDimensions computes safe rosette cassette clearance', async () => {
  const { calculateRecommendedSlackLoopDimensions } = await import('../form-validation.js');

  // G.657.A2 inside standard 86x86mm Pakistani faceplate rosette
  const rosetteA2 = calculateRecommendedSlackLoopDimensions({
    fiberType: 'G657A2',
    enclosureWidthMm: 86,
    enclosureHeightMm: 86,
    targetSlackLengthMeters: 1.0
  });

  assert.equal(rosetteA2.isCompatible, true);
  assert.equal(rosetteA2.minRadiusMm, 7.5);
  assert.equal(rosetteA2.minCoilDiameterMm, 15.0);
  assert.ok(rosetteA2.recommendedTurns >= 10);
  assert.ok(rosetteA2.actualSlackStoredMeters >= 0.8);
  assert.ok(rosetteA2.advisory.includes('Enclosure accommodates safe'));

  // G.652.D inside small 50x50mm micro surface box (violates 60mm diameter requirement)
  const legacyMicro = calculateRecommendedSlackLoopDimensions({
    fiberType: 'G652D',
    enclosureWidthMm: 50,
    enclosureHeightMm: 50
  });

  assert.equal(legacyMicro.isCompatible, false);
  assert.equal(legacyMicro.minCoilDiameterMm, 60.0);
  assert.ok(legacyMicro.advisory.includes('INCOMPATIBLE'));
});

test('setupBendLossCertModal operates safely in headless and interactive mock DOM environments', async () => {
  const { setupBendLossCertModal, BEND_LOSS_STORAGE_KEY } = await import('../form-validation.js');

  // 1. Headless test
  const headless = setupBendLossCertModal({ document: null, storage: null });
  assert.equal(typeof headless.open, 'function');
  assert.equal(typeof headless.close, 'function');
  assert.equal(typeof headless.getCurrentReading, 'function');
  assert.equal(typeof headless.setReading, 'function');
  headless.open();
  headless.setReading({ radiusMm: 20 });
  headless.close();

  // 2. Interactive Mock DOM test
  const listeners = {};
  const createElement = (tag, id, type = 'text', val = '') => ({
    tagName: tag.toUpperCase(),
    id,
    type,
    value: val,
    checked: true,
    textContent: '',
    innerHTML: '',
    className: '',
    open: false,
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; if (k === 'open') this.open = true; },
    removeAttribute(k) { delete this.attributes[k]; if (k === 'open') this.open = false; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    addEventListener(evt, fn) {
      if (!listeners[id]) listeners[id] = {};
      listeners[id][evt] = fn;
    },
    click() {
      if (listeners[id] && listeners[id].click) listeners[id].click();
    }
  });

  const domElements = {
    bendLossCertModal: createElement('dialog', 'bendLossCertModal'),
    bendLossCertModalCloseBtn: createElement('button', 'bendLossCertModalCloseBtn'),
    bendLossFiberSelect: createElement('select', 'bendLossFiberSelect', 'select-one', 'G657A2'),
    bendLossRadiusSlider: createElement('input', 'bendLossRadiusSlider', 'range', '15.0'),
    bendLossRadiusVal: createElement('strong', 'bendLossRadiusVal'),
    bendLossTurnsSlider: createElement('input', 'bendLossTurnsSlider', 'range', '2'),
    bendLossTurnsVal: createElement('strong', 'bendLossTurnsVal'),
    bendLossStressSlider: createElement('input', 'bendLossStressSlider', 'range', '0'),
    bendLossStressVal: createElement('strong', 'bendLossStressVal'),
    bendLossNotesInput: createElement('input', 'bendLossNotesInput', 'text', 'Clean bend routing'),
    bendCheckRosette: createElement('input', 'bendCheckRosette', 'checkbox'),
    bendCheckCorners: createElement('input', 'bendCheckCorners', 'checkbox'),
    bendCheckClips: createElement('input', 'bendCheckClips', 'checkbox'),
    bendCheckEntry: createElement('input', 'bendCheckEntry', 'checkbox'),
    bendCheckOnu: createElement('input', 'bendCheckOnu', 'checkbox'),
    bendLossSvgContainer: createElement('div', 'bendLossSvgContainer'),
    bendLoss1310Readout: createElement('div', 'bendLoss1310Readout'),
    bendLoss1550Readout: createElement('div', 'bendLoss1550Readout'),
    bendLossDiffReadout: createElement('div', 'bendLossDiffReadout'),
    bendLossVerdictBadge: createElement('span', 'bendLossVerdictBadge'),
    bendLossRecordCertBtn: createElement('button', 'bendLossRecordCertBtn'),
    bendLossCopyReportBtn: createElement('button', 'bendLossCopyReportBtn'),
    bendLossPrintA4Btn: createElement('button', 'bendLossPrintA4Btn'),
    bendLossPrintThermalBtn: createElement('button', 'bendLossPrintThermalBtn'),
    bendLossExportCsvBtn: createElement('button', 'bendLossExportCsvBtn'),
    bendLossClearHistoryBtn: createElement('button', 'bendLossClearHistoryBtn'),
    bendLossHistoryTableBody: createElement('tbody', 'bendLossHistoryTableBody')
  };

  const mockDoc = {
    getElementById(id) { return domElements[id] || null; },
    querySelectorAll(sel) { return []; },
    createElement(tag) { return createElement(tag, `mock-${tag}`); }
  };

  const store = {};
  const mockStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };

  let toastMessage = '';
  const controller = setupBendLossCertModal({
    document: mockDoc,
    storage: mockStorage,
    onToast: (msg) => { toastMessage = msg; },
    getCustomerData: () => ({ name: 'Rashid Khan', customerNumber: '2045', phone: '+923009988776', area: 'Shahdara' })
  });

  // Open with customer
  controller.open({ name: 'Rashid Khan', customerNumber: '2045', phone: '+923009988776', area: 'Shahdara' });
  assert.equal(domElements.bendLossCertModal.open, true);
  assert.ok(domElements.bendLoss1310Readout.textContent.includes('dB'));
  assert.ok(domElements.bendLoss1550Readout.textContent.includes('dB'));
  assert.ok(domElements.bendLossVerdictBadge.textContent.includes('PASS'));

  // Test setReading
  controller.setReading({ radiusMm: 12.0, turnsCount: 3, fiberType: 'G657A1' });
  assert.equal(domElements.bendLossRadiusSlider.value, 12);
  assert.equal(domElements.bendLossTurnsSlider.value, 3);
  assert.equal(domElements.bendLossFiberSelect.value, 'G657A1');

  // Trigger record
  domElements.bendLossRecordCertBtn.click();
  assert.ok(toastMessage.includes('Recorded Macro-Bend QA Certificate'));
  assert.ok(store[BEND_LOSS_STORAGE_KEY]);
  assert.ok(domElements.bendLossHistoryTableBody.innerHTML.includes('Rashid Khan'));

  // Clear history
  domElements.bendLossClearHistoryBtn.click();
  assert.ok(toastMessage.includes('Cleared'));
  assert.equal(store[BEND_LOSS_STORAGE_KEY], undefined);

  // Close
  controller.close();
  assert.equal(domElements.bendLossCertModal.open, false);
});

test('OTDR bidirectional constants and presets match ITU-T G.650.1 / G.652 standards', async () => {
  const {
    BIDIRECTIONAL_OTDR_STORAGE_KEY,
    OTDR_WAVELENGTHS,
    OTDR_EVENT_TYPES,
    OTDR_ROUTE_PRESETS,
    BIDIRECTIONAL_QA_VERDICTS
  } = await import('../form-validation.js');

  assert.equal(BIDIRECTIONAL_OTDR_STORAGE_KEY, 'shahdara_otdr_bidirectional_certs_v1');

  // Verify Wavelengths
  assert.ok(OTDR_WAVELENGTHS['1310']);
  assert.equal(OTDR_WAVELENGTHS['1310'].wavelengthNm, 1310);
  assert.equal(OTDR_WAVELENGTHS['1550'].standardFiberAttenuation, 0.20);
  assert.equal(OTDR_WAVELENGTHS['1625'].wavelengthNm, 1625);

  // Verify Event Types
  assert.ok(OTDR_EVENT_TYPES.FUSION_SPLICE);
  assert.equal(OTDR_EVENT_TYPES.FUSION_SPLICE.isReflective, false);
  assert.equal(OTDR_EVENT_TYPES.FUSION_SPLICE.maxAllowedLossDb, 0.10);
  assert.ok(OTDR_EVENT_TYPES.LAUNCH_CONNECTOR.isReflective);
  assert.ok(OTDR_EVENT_TYPES.TERMINAL_REFLECTIVE.isReflective);

  // Verify Route Presets
  assert.ok(Array.isArray(OTDR_ROUTE_PRESETS));
  assert.ok(OTDR_ROUTE_PRESETS.length >= 5);
  const baradari = OTDR_ROUTE_PRESETS.find(p => p.id === 'ROUTE_BARADARI_TRUNK');
  assert.ok(baradari);
  assert.equal(baradari.spanLengthKm, 14.8);
  assert.ok(baradari.events.some(ev => ev.lossAtoB < 0)); // has gainer

  // Verify Verdicts
  assert.ok(BIDIRECTIONAL_QA_VERDICTS.CERTIFIED_PASS);
  assert.ok(BIDIRECTIONAL_QA_VERDICTS.RESPLICE_ADVISORY);
  assert.ok(BIDIRECTIONAL_QA_VERDICTS.CRITICAL_FAULT);
});

test('calculateBidirectionalAveraging arithmetically cancels false gainers and computes true loss', async () => {
  const { calculateBidirectionalAveraging } = await import('../form-validation.js');

  // Case with a clear gainer at splice 2: -0.15 dB A->B, +0.35 dB B->A => True = +0.10 dB
  const events = [
    { id: 'E1', distanceKm: 0.0, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.30, lossBtoA: 0.30 },
    { id: 'E2', distanceKm: 4.5, type: 'FUSION_SPLICE', lossAtoB: -0.15, lossBtoA: 0.35 },
    { id: 'E3', distanceKm: 8.0, type: 'FUSION_SPLICE', lossAtoB: 0.06, lossBtoA: 0.04 },
    { id: 'E4', distanceKm: 10.0, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.40, lossBtoA: 0.40 }
  ];

  const result = calculateBidirectionalAveraging({
    events,
    fiberLengthKm: 10.0,
    wavelengthNm: 1550
  });

  assert.equal(result.fiberLengthKm, 10.0);
  assert.equal(result.wavelengthNm, 1550);
  assert.equal(result.fiberDistributedLossDb, 2.0); // 10.0 * 0.20
  assert.equal(result.gainerCount, 1);

  // Event 2 analysis
  const ev2 = result.events.find(e => e.id === 'E2');
  assert.ok(ev2);
  assert.equal(ev2.isGainer, true);
  assert.equal(ev2.isGainerAtoB, true);
  assert.equal(ev2.isGainerBtoA, false);
  assert.equal(ev2.trueLossDb, 0.10); // (-0.15 + 0.35) / 2
  assert.equal(ev2.backscatterDeltaDb, -0.25); // (-0.15 - 0.35) / 2
  assert.equal(ev2.verdict, 'PASS');

  // Total true loss = 2.0 (fiber) + 0.30 + 0.10 + 0.05 + 0.40 = 2.85 dB
  assert.equal(result.totalTrueLossDb, 2.85);
  assert.equal(result.meanAttenuationDbPerKm, 0.285);
  assert.equal(result.overallVerdict.id, 'CERTIFIED_PASS');
});

test('calculateBidirectionalAveraging flags excessive splice loss as RESPLICE_ADVISORY or CRITICAL_FAULT', async () => {
  const { calculateBidirectionalAveraging } = await import('../form-validation.js');

  // Severe splice loss at 3.0km (0.24 dB true loss)
  const events = [
    { id: 'E1', distanceKm: 3.0, type: 'FUSION_SPLICE', lossAtoB: 0.22, lossBtoA: 0.26 } // True: 0.24 dB
  ];

  const result = calculateBidirectionalAveraging({
    events,
    fiberLengthKm: 5.0,
    wavelengthNm: 1550
  });

  assert.equal(result.respliceRequiredCount, 1);
  assert.equal(result.overallVerdict.id, 'RESPLICE_ADVISORY');

  // Critical fault case: impossible unphysical negative true loss
  const faultEvents = [
    { id: 'E1', distanceKm: 2.0, type: 'FUSION_SPLICE', lossAtoB: -0.50, lossBtoA: -0.20 } // True: -0.35 dB
  ];
  const faultResult = calculateBidirectionalAveraging({
    events: faultEvents,
    fiberLengthKm: 5.0
  });
  assert.equal(faultResult.criticalCount, 1);
  assert.equal(faultResult.overallVerdict.id, 'CRITICAL_FAULT');
});

test('renderBidirectionalOtdrSvg produces valid interactive SVG graphic markup', async () => {
  const { renderBidirectionalOtdrSvg } = await import('../form-validation.js');

  const svg = renderBidirectionalOtdrSvg({
    events: [
      { id: 'E1', distanceKm: 0.0, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.3, lossBtoA: 0.3 },
      { id: 'E2', distanceKm: 5.0, type: 'FUSION_SPLICE', lossAtoB: -0.12, lossBtoA: 0.28 },
      { id: 'E3', distanceKm: 10.0, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.4, lossBtoA: 0.4 }
    ],
    fiberLengthKm: 10.0,
    wavelengthNm: 1550,
    width: 720,
    height: 280
  });

  assert.ok(svg.includes('<svg class="bidirectional-otdr-svg"'));
  assert.ok(svg.includes('viewBox="0 0 720 280"'));
  assert.ok(svg.includes('BIDIRECTIONAL OTDR TRACE AVERAGING'));
  assert.ok(svg.includes('1550nm'));
  assert.ok(svg.includes('#38bdf8')); // Trace A->B color
  assert.ok(svg.includes('#f59e0b')); // Trace B->A color
  assert.ok(svg.includes('#10b981')); // True avg color
  assert.ok(svg.includes('Attenuation (dB)'));
  assert.ok(svg.includes('Distance Along Span (km)'));
  assert.ok(svg.includes('otdr-event-marker'));
});

test('buildBidirectionalOtdrCertRecord creates compliant record with unique ID and telemetries', async () => {
  const { buildBidirectionalOtdrCertRecord } = await import('../form-validation.js');

  const existing = [{ id: 'OTDR-BI-202610-0001' }];
  const record = buildBidirectionalOtdrCertRecord({
    customerName: 'Muhammad Arshad',
    customerNumber: 'PK-4029',
    area: 'Baradari Road',
    routeName: 'Baradari Trunk Feeder to Ring-A',
    fiberLengthKm: 12.0,
    wavelengthNm: 1550,
    events: [
      { id: 'E1', distanceKm: 0.0, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.25, lossBtoA: 0.25 },
      { id: 'E2', distanceKm: 6.0, type: 'FUSION_SPLICE', lossAtoB: -0.10, lossBtoA: 0.22 },
      { id: 'E3', distanceKm: 12.0, type: 'TERMINAL_REFLECTIVE', lossAtoB: 0.35, lossBtoA: 0.35 }
    ],
    notes: 'Span spliced with Sumitomo Type-82C.'
  }, existing);

  assert.match(record.id, /^OTDR-BI-\d{6}-0002$/);
  assert.equal(record.customerName, 'Muhammad Arshad');
  assert.equal(record.customerNumber, 'PK-4029');
  assert.equal(record.area, 'Baradari Road');
  assert.equal(record.gainerCount, 1);
  assert.ok(record.totalTrueLossDb > 0);
  assert.equal(record.verdict, 'CERTIFIED_PASS');
  assert.equal(record.notes, 'Span spliced with Sumitomo Type-82C.');
});

test('storage functions persist, read, and clear bidirectional OTDR cert records', async () => {
  const {
    saveBidirectionalOtdrCert,
    getSavedBidirectionalOtdrCerts,
    clearBidirectionalOtdrCerts,
    BIDIRECTIONAL_OTDR_STORAGE_KEY
  } = await import('../form-validation.js');

  const mockStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
  };

  assert.deepEqual(getSavedBidirectionalOtdrCerts(mockStorage), []);

  const cert1 = { id: 'OTDR-BI-202610-0001', customerName: 'Tariq Mehmood', totalTrueLossDb: 2.5 };
  const cert2 = { id: 'OTDR-BI-202610-0002', customerName: 'Zahid Hussain', totalTrueLossDb: 3.1 };

  saveBidirectionalOtdrCert(cert1, mockStorage);
  saveBidirectionalOtdrCert(cert2, mockStorage);

  const saved = getSavedBidirectionalOtdrCerts(mockStorage);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, 'OTDR-BI-202610-0002'); // latest first

  clearBidirectionalOtdrCerts(mockStorage);
  assert.deepEqual(getSavedBidirectionalOtdrCerts(mockStorage), []);
  assert.equal(mockStorage.getItem(BIDIRECTIONAL_OTDR_STORAGE_KEY), null);
});

test('formatBidirectionalOtdrCertWhatsApp formats comprehensive notice text', async () => {
  const { formatBidirectionalOtdrCertWhatsApp } = await import('../form-validation.js');

  const record = {
    id: 'OTDR-BI-202610-0005',
    timestamp: '2026-10-16T12:00:00Z',
    customerName: 'Imtiaz Ahmed',
    customerNumber: 'SH-8821',
    area: 'Jia Musa',
    routeName: 'Jia Musa Ring Feeder',
    originNode: 'OLT Hub Alpha',
    terminusNode: 'FAT-03',
    fiberLengthKm: 8.5,
    wavelengthNm: 1550,
    apparentLossAtoBDb: 2.85,
    apparentLossBtoADb: 2.75,
    totalTrueLossDb: 2.80,
    meanAttenuationDbPerKm: 0.329,
    gainerCount: 1,
    verdictLabel: 'CERTIFIED PASS',
    technicianName: 'Sajjad Ali',
    notes: 'Core misalignment eliminated.',
    events: [
      { distanceKm: 4.2, type: 'FUSION_SPLICE', lossAtoB: -0.15, lossBtoA: 0.25, trueLossDb: 0.05, isGainer: true }
    ]
  };

  const msg = formatBidirectionalOtdrCertWhatsApp(record);
  assert.ok(msg.includes('SHAHDARA FIBER NETWORK OPERATIONS'));
  assert.ok(msg.includes('OTDR BIDIRECTIONAL QA CERTIFICATE'));
  assert.ok(msg.includes('OTDR-BI-202610-0005'));
  assert.ok(msg.includes('Imtiaz Ahmed'));
  assert.ok(msg.includes('8.50 km'));
  assert.ok(msg.includes('2.80 dB'));
  assert.ok(msg.includes('False Gainers Eliminated'));
  assert.ok(msg.includes('CERTIFIED PASS'));
  assert.ok(msg.includes('Sajjad Ali'));
});

test('generateBidirectionalOtdrCertHtml outputs A4 sheet and thermal slip formats', async () => {
  const { generateBidirectionalOtdrCertHtml } = await import('../form-validation.js');

  const record = {
    id: 'OTDR-BI-202610-0006',
    timestamp: '2026-10-16T12:00:00Z',
    customerName: 'Khurram Shehzad',
    customerNumber: 'SH-1094',
    area: 'Begum Kot',
    routeName: 'Begum Kot Commercial Feeder',
    originNode: 'Begum Kot Central OLT',
    terminusNode: 'FAT-09',
    fiberLengthKm: 6.4,
    wavelengthNm: 1550,
    apparentLossAtoBDb: 2.10,
    apparentLossBtoADb: 1.95,
    totalTrueLossDb: 2.02,
    meanAttenuationDbPerKm: 0.316,
    gainerCount: 1,
    verdictLabel: 'CERTIFIED PASS',
    technicianName: 'Asim Raza',
    events: [
      { id: 'E1', distanceKm: 0.0, type: 'LAUNCH_CONNECTOR', lossAtoB: 0.3, lossBtoA: 0.3, trueLossDb: 0.3, verdict: 'PASS' },
      { id: 'E2', distanceKm: 3.2, type: 'FUSION_SPLICE', lossAtoB: -0.12, lossBtoA: 0.26, trueLossDb: 0.07, isGainer: true, verdict: 'PASS' }
    ]
  };

  // Sheet format
  const sheetHtml = generateBidirectionalOtdrCertHtml(record, { format: 'sheet' });
  assert.ok(sheetHtml.includes('a4-otdr-cert'));
  assert.ok(sheetHtml.includes('SHAHDARA ISP &amp; OPTICAL FIBER NETWORK'));
  assert.ok(sheetHtml.includes('OTDR-BI-202610-0006'));
  assert.ok(sheetHtml.includes('Khurram Shehzad'));
  assert.ok(sheetHtml.includes('bidirectional-otdr-svg'));
  assert.ok(sheetHtml.includes('NOC Supervisor Sign-off'));

  // Slip format
  const slipHtml = generateBidirectionalOtdrCertHtml(record, { format: 'slip' });
  assert.ok(slipHtml.includes('thermal-otdr-slip'));
  assert.ok(slipHtml.includes('SHAHDARA FIBER NET'));
  assert.ok(slipHtml.includes('OTDR BIDIRECTIONAL QA SLIP'));
  assert.ok(slipHtml.includes('2.02 dB'));
  assert.ok(slipHtml.includes('*** CARRIER CERTIFIED FIBER ***'));
});

test('generateBidirectionalOtdrCsv outputs valid CSV columns and formatted rows', async () => {
  const { generateBidirectionalOtdrCsv } = await import('../form-validation.js');

  const records = [
    {
      id: 'OTDR-BI-202610-0001',
      timestamp: '2026-10-16T10:00:00Z',
      customerNumber: 'SH-01',
      customerName: 'Ali Raza',
      area: 'Baradari',
      routeName: 'Trunk Feeder',
      originNode: 'PoP 1',
      terminusNode: 'FAT 1',
      fiberLengthKm: 10.0,
      wavelengthNm: 1550,
      totalTrueLossDb: 2.8,
      apparentLossAtoBDb: 2.9,
      apparentLossBtoADb: 2.7,
      meanAttenuationDbPerKm: 0.28,
      gainerCount: 1,
      verdict: 'CERTIFIED_PASS',
      technicianName: 'Umair',
      notes: 'Clean'
    }
  ];

  const csv = generateBidirectionalOtdrCsv(records);
  assert.ok(csv.includes('CertID,Timestamp,CustomerNumber,CustomerName'));
  assert.ok(csv.includes('"OTDR-BI-202610-0001"'));
  assert.ok(csv.includes('"Ali Raza"'));
  assert.ok(csv.includes('"Baradari"'));
  assert.ok(csv.includes('10.00'));
  assert.ok(csv.includes('2.80'));
});

test('setupBidirectionalOtdrModal wires event listeners and handles user interactions', async () => {
  const { setupBidirectionalOtdrModal, BIDIRECTIONAL_OTDR_STORAGE_KEY } = await import('../form-validation.js');

  function createMockElement(id) {
    const listeners = {};
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      open: false,
      style: {},
      addEventListener(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      dispatchEvent(event) {
        if (listeners[event.type]) {
          listeners[event.type].forEach(fn => fn(event));
        }
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      appendChild(child) { /* mock */ },
      querySelector(sel) { return null; },
      querySelectorAll(sel) { return []; }
    };
  }

  const elements = {
    '#bidirectionalOtdrModal': createMockElement('bidirectionalOtdrModal'),
    '#bidirectionalOtdrModalCloseBtn': createMockElement('bidirectionalOtdrModalCloseBtn'),
    '#bidirectionalOtdrSvgContainer': createMockElement('bidirectionalOtdrSvgContainer'),
    '#bidirectionalOtdrPresetSelect': createMockElement('bidirectionalOtdrPresetSelect'),
    '#bidirectionalOtdrWlSelect': createMockElement('bidirectionalOtdrWlSelect'),
    '#bidirectionalOtdrSpanSlider': createMockElement('bidirectionalOtdrSpanSlider'),
    '#bidirectionalOtdrSpanVal': createMockElement('bidirectionalOtdrSpanVal'),
    '#bidirectionalOtdrRouteInput': createMockElement('bidirectionalOtdrRouteInput'),
    '#bidirectionalOtdrOriginInput': createMockElement('bidirectionalOtdrOriginInput'),
    '#bidirectionalOtdrDestInput': createMockElement('bidirectionalOtdrDestInput'),
    '#bidirectionalOtdrNotesInput': createMockElement('bidirectionalOtdrNotesInput'),
    '#bidirectionalOtdrTrueLossReadout': createMockElement('bidirectionalOtdrTrueLossReadout'),
    '#bidirectionalOtdrApparentAtoBReadout': createMockElement('bidirectionalOtdrApparentAtoBReadout'),
    '#bidirectionalOtdrApparentBtoAReadout': createMockElement('bidirectionalOtdrApparentBtoAReadout'),
    '#bidirectionalOtdrGainersReadout': createMockElement('bidirectionalOtdrGainersReadout'),
    '#bidirectionalOtdrVerdictBadge': createMockElement('bidirectionalOtdrVerdictBadge'),
    '#bidirectionalOtdrEventsTableBody': createMockElement('bidirectionalOtdrEventsTableBody'),
    '#bidirectionalOtdrAddEventBtn': createMockElement('bidirectionalOtdrAddEventBtn'),
    '#bidirectionalOtdrHistoryTableBody': createMockElement('bidirectionalOtdrHistoryTableBody'),
    '#bidirectionalOtdrRecordCertBtn': createMockElement('bidirectionalOtdrRecordCertBtn'),
    '#bidirectionalOtdrCopyReportBtn': createMockElement('bidirectionalOtdrCopyReportBtn'),
    '#bidirectionalOtdrPrintA4Btn': createMockElement('bidirectionalOtdrPrintA4Btn'),
    '#bidirectionalOtdrPrintThermalBtn': createMockElement('bidirectionalOtdrPrintThermalBtn'),
    '#bidirectionalOtdrExportCsvBtn': createMockElement('bidirectionalOtdrExportCsvBtn'),
    '#bidirectionalOtdrClearHistoryBtn': createMockElement('bidirectionalOtdrClearHistoryBtn')
  };

  elements['#bidirectionalOtdrSpanSlider'].value = '14.8';
  elements['#bidirectionalOtdrWlSelect'].value = '1550';
  elements['#bidirectionalOtdrPresetSelect'].value = 'ROUTE_BARADARI_TRUNK';

  const mockRoot = {
    querySelector(sel) { return elements[sel] || null; },
    querySelectorAll(sel) {
      if (sel === '[data-open-bidirectional-otdr]') return [];
      return [];
    }
  };

  const mockDoc = {
    createElement(tag) { return createMockElement(`dyn-${tag}`); }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  let toastLog = [];
  const controller = setupBidirectionalOtdrModal({
    storage: mockStorage,
    onToast: (msg) => toastLog.push(msg),
    getCustomerData: () => ({ name: 'Naveed Akhtar', customerNumber: 'SH-5512', area: 'Baradari' }),
    doc: mockDoc,
    root: mockRoot
  });

  assert.ok(controller);

  // Open modal
  controller.open();
  assert.equal(elements['#bidirectionalOtdrModal'].open, true);
  assert.ok(elements['#bidirectionalOtdrTrueLossReadout'].textContent.includes('dB'));

  // Test setReading
  controller.setReading({ fiberLengthKm: 16.5, wavelengthNm: 1310 });
  assert.equal(elements['#bidirectionalOtdrSpanSlider'].value, 16.5);
  assert.equal(elements['#bidirectionalOtdrWlSelect'].value, 1310);

  // Record cert
  elements['#bidirectionalOtdrRecordCertBtn'].click();
  assert.ok(toastLog.some(msg => msg.includes('Recorded OTDR Bidirectional QA Cert')));
  assert.ok(store[BIDIRECTIONAL_OTDR_STORAGE_KEY]);

  // Clear history
  elements['#bidirectionalOtdrClearHistoryBtn'].click();
  assert.ok(toastLog.some(msg => msg.includes('Cleared Bidirectional OTDR')));
  assert.equal(store[BIDIRECTIONAL_OTDR_STORAGE_KEY], undefined);

  // Close modal
  controller.close();
  assert.equal(elements['#bidirectionalOtdrModal'].open, false);
});

test('index.html and styles.css include bidirectional OTDR modal elements and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="openBidirectionalOtdrBtn"'));
  assert.ok(html.includes('data-open-bidirectional-otdr'));
  assert.ok(html.includes('id="bidirectionalOtdrModal"'));
  assert.ok(html.includes('id="bidirectionalOtdrSvgContainer"'));
  assert.ok(html.includes('id="bidirectionalOtdrTrueLossReadout"'));
  assert.ok(html.includes('id="bidirectionalOtdrEventsTableBody"'));

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.bidirectional-otdr-modal-card'));
  assert.ok(css.includes('.bidirectional-otdr-svg'));
  assert.ok(css.includes('.bidirectional-otdr-svg-wrap'));
});

test('calculatePulseWidthDeadZones computes spatial length and dead zones per IEC 61746-1', async () => {
  const { calculatePulseWidthDeadZones, SPEED_OF_LIGHT_VACUUM_MPS } = await import('../form-validation.js');

  const p3 = calculatePulseWidthDeadZones(3, 1550);
  assert.equal(p3.pulseWidthNs, 3);
  assert.equal(p3.eventDeadZoneM, 0.5);
  assert.equal(p3.attenuationDeadZoneM, 2.0);
  assert.equal(p3.dynamicRangeDb, 18.0);
  assert.ok(p3.spatialLengthM > 0.3 && p3.spatialLengthM < 0.35);

  const p10 = calculatePulseWidthDeadZones(10, 1550);
  assert.equal(p10.pulseWidthNs, 10);
  assert.equal(p10.eventDeadZoneM, 1.2);
  assert.equal(p10.attenuationDeadZoneM, 3.8);
  assert.equal(p10.dynamicRangeDb, 26.0);

  const p100 = calculatePulseWidthDeadZones(100, 1550);
  assert.equal(p100.eventDeadZoneM, 6.0);
  assert.equal(p100.attenuationDeadZoneM, 18.0);
  assert.equal(p100.dynamicRangeDb, 36.0);

  const p1000 = calculatePulseWidthDeadZones(1000, 1550);
  assert.equal(p1000.eventDeadZoneM, 50.0);
  assert.equal(p1000.attenuationDeadZoneM, 140.0);
  assert.equal(p1000.dynamicRangeDb, 43.0);
});

test('evaluateOtdrDeadzoneCalibration verifies launch box, tail box, and event resolution', async () => {
  const { evaluateOtdrDeadzoneCalibration, OTDR_SPAN_PRESETS } = await import('../form-validation.js');

  const preset = OTDR_SPAN_PRESETS[0];
  const result = evaluateOtdrDeadzoneCalibration({
    spanName: preset.name,
    spanLengthKm: preset.spanLengthKm,
    pulseWidthId: '10ns',
    launchBoxLengthM: 500,
    tailBoxLengthM: 300,
    events: preset.events
  });

  assert.equal(result.launchBox.adequacy, 'VERIFIED_PASS');
  assert.equal(result.tailBox.adequacy, 'VERIFIED_PASS');
  assert.equal(result.maskedEventCount, 0);
  assert.equal(result.overallVerdict, 'CERTIFIED_CALIBRATION_PASS');
  assert.ok(result.totalMeasuredLinkLossDb > 1.0);
  assert.ok(result.dynamicRangeMarginDb > 10.0);

  // Test missing launch cable
  const noLaunch = evaluateOtdrDeadzoneCalibration({
    spanLengthKm: 5.0,
    pulseWidthId: '10ns',
    launchBoxLengthM: 0,
    tailBoxLengthM: 300
  });
  assert.equal(noLaunch.launchBox.adequacy, 'FAIL_NO_LAUNCH_CABLE');
  assert.equal(noLaunch.overallVerdict, 'FAIL_CALIBRATION_REJECT');

  // Test short launch cable
  const shortLaunch = evaluateOtdrDeadzoneCalibration({
    spanLengthKm: 5.0,
    pulseWidthId: '100ns', // ADZ = 18m, minRequired = 27m, but minimum floor is 100m
    launchBoxLengthM: 60,
    tailBoxLengthM: 300
  });
  assert.equal(shortLaunch.launchBox.adequacy, 'MARGINAL_SHORT_CABLE');
  assert.equal(shortLaunch.overallVerdict, 'CONDITIONAL_PASS');

  // Test missing tail cable
  const noTail = evaluateOtdrDeadzoneCalibration({
    spanLengthKm: 5.0,
    pulseWidthId: '10ns',
    launchBoxLengthM: 500,
    tailBoxLengthM: 0
  });
  assert.equal(noTail.tailBox.adequacy, 'FAIL_NO_TAIL_CABLE');
  assert.equal(noTail.overallVerdict, 'CONDITIONAL_PASS');

  // Test closely-spaced events masking
  const maskedEventsResult = evaluateOtdrDeadzoneCalibration({
    spanLengthKm: 5.0,
    pulseWidthId: '100ns', // EDZ = 6.0 meters
    launchBoxLengthM: 1000,
    tailBoxLengthM: 500,
    events: [
      { id: 'E1', distanceM: 1000, label: 'Splice A', lossDb: 0.05, type: 'SPLICE' },
      { id: 'E2', distanceM: 1003, label: 'Splice B (3m away, within 6m EDZ)', lossDb: 0.06, type: 'SPLICE' }
    ]
  });
  assert.equal(maskedEventsResult.maskedEventCount, 2);
  assert.equal(maskedEventsResult.events[0].isMaskedByDeadZone, true);
  assert.equal(maskedEventsResult.events[1].isMaskedByDeadZone, true);
  assert.equal(maskedEventsResult.overallVerdict, 'CONDITIONAL_PASS');
});

test('renderOtdrDeadzoneSvg produces vector SVG trace with zones and HUD ribbon', async () => {
  const { evaluateOtdrDeadzoneCalibration, renderOtdrDeadzoneSvg } = await import('../form-validation.js');

  const analysis = evaluateOtdrDeadzoneCalibration({
    spanLengthKm: 6.2,
    pulseWidthId: '10ns',
    launchBoxLengthM: 500,
    tailBoxLengthM: 300
  });

  const svg = renderOtdrDeadzoneSvg(analysis, { width: 800, height: 340 });
  assert.ok(svg.includes('<svg viewBox="0 0 800 340"'));
  assert.ok(svg.includes('Launch Fiber Box'));
  assert.ok(svg.includes('Optical Fiber Link Span Under Test'));
  assert.ok(svg.includes('Receive Tail Box'));
  assert.ok(svg.includes('class="otdr-deadzone-trace-svg"'));
  assert.ok(svg.includes('ADZ: 3.8m'));
  assert.ok(svg.includes('Demarcation'));
});

test('generateOtdrDeadzoneCertHtml outputs valid A4 and thermal printable layouts', async () => {
  const { evaluateOtdrDeadzoneCalibration, generateOtdrDeadzoneCertHtml } = await import('../form-validation.js');

  const analysis = evaluateOtdrDeadzoneCalibration({
    spanName: 'Baradari Central OLT to Jia Musa Ring FAT-04',
    spanLengthKm: 6.2,
    pulseWidthId: '10ns'
  });

  const a4Html = generateOtdrDeadzoneCertHtml(analysis, 'a4');
  assert.ok(a4Html.includes('Shahdara ISP Metrology &amp; Optical QA Laboratory'));
  assert.ok(a4Html.includes('IEC 61746-1 &amp; ITU-T G.650.1'));
  assert.ok(a4Html.includes(analysis.certId));
  assert.ok(a4Html.includes('Launch Box (Near-End)'));
  assert.ok(a4Html.includes('Lead Metrology Engineer'));

  const thermalHtml = generateOtdrDeadzoneCertHtml(analysis, 'thermal');
  assert.ok(thermalHtml.includes('SHAHDARA ISP METROLOGY'));
  assert.ok(thermalHtml.includes('OTDR DEAD ZONE CALIBRATION'));
  assert.ok(thermalHtml.includes(analysis.certId));
  assert.ok(thermalHtml.includes('PULSE WIDTH:'));
});

test('formatOtdrDeadzoneCertWhatsApp outputs bilingual Urdu and English dispatch text', async () => {
  const { evaluateOtdrDeadzoneCalibration, formatOtdrDeadzoneCertWhatsApp } = await import('../form-validation.js');

  const analysis = evaluateOtdrDeadzoneCalibration({
    spanName: 'Baradari Central OLT to Jia Musa',
    spanLengthKm: 6.2,
    pulseWidthId: '10ns'
  });

  const wa = formatOtdrDeadzoneCertWhatsApp(analysis);
  assert.ok(wa.includes('SHAHDARA ISP - OTDR DEAD ZONE QA CALIBRATION'));
  assert.ok(wa.includes('او ٹی ڈی آر ڈیڈ زون و پلس کیلیبریشن'));
  assert.ok(wa.includes(analysis.certId));
  assert.ok(wa.includes('Event Dead Zone (EDZ):'));
  assert.ok(wa.includes('Attenuation Dead Zone (ADZ):'));
  assert.ok(wa.includes('Launch Box:'));
});

test('generateOtdrDeadzoneCertsCsv exports RFC-4180 CSV with UTF-8 BOM', async () => {
  const { evaluateOtdrDeadzoneCalibration, generateOtdrDeadzoneCertsCsv } = await import('../form-validation.js');

  const analysis1 = evaluateOtdrDeadzoneCalibration({ spanName: 'Span Alpha', spanLengthKm: 4.5 });
  const analysis2 = evaluateOtdrDeadzoneCalibration({ spanName: 'Span Beta', spanLengthKm: 8.2 });

  const csv = generateOtdrDeadzoneCertsCsv([analysis1, analysis2]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Certificate ID","Timestamp","Span Name"'));
  assert.ok(csv.includes('"Span Alpha"'));
  assert.ok(csv.includes('"Span Beta"'));
});

test('localStorage helpers correctly save, retrieve, update, and calculate metrics', async () => {
  const {
    saveOtdrDeadzoneCert,
    getSavedOtdrDeadzoneCerts,
    updateOtdrDeadzoneCertStatus,
    clearOtdrDeadzoneCerts,
    calculateOtdrDeadzoneMetrics,
    evaluateOtdrDeadzoneCalibration
  } = await import('../form-validation.js');

  const mockStore = {};
  const mockStorage = {
    getItem: (k) => mockStore[k] || null,
    setItem: (k, v) => { mockStore[k] = String(v); },
    removeItem: (k) => { delete mockStore[k]; }
  };

  const cert1 = evaluateOtdrDeadzoneCalibration({ certId: 'DZC-202610-0001', spanLengthKm: 5.0 });
  const cert2 = evaluateOtdrDeadzoneCalibration({ certId: 'DZC-202610-0002', spanLengthKm: 10.0 });

  assert.equal(saveOtdrDeadzoneCert(cert1, mockStorage), true);
  assert.equal(saveOtdrDeadzoneCert(cert2, mockStorage), true);

  const saved = getSavedOtdrDeadzoneCerts(mockStorage);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].certId, 'DZC-202610-0002');

  const okUpdate = updateOtdrDeadzoneCertStatus('DZC-202610-0001', 'CONDITIONAL_PASS', mockStorage);
  assert.equal(okUpdate, true);

  const updatedSaved = getSavedOtdrDeadzoneCerts(mockStorage);
  const updatedItem = updatedSaved.find(c => c.certId === 'DZC-202610-0001');
  assert.equal(updatedItem.overallVerdict, 'CONDITIONAL_PASS');

  const metrics = calculateOtdrDeadzoneMetrics(updatedSaved);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.conditional, 1);
  assert.equal(metrics.certified, 1);
  assert.equal(metrics.passRate, 50.0);

  assert.equal(clearOtdrDeadzoneCerts(mockStorage), true);
  assert.equal(getSavedOtdrDeadzoneCerts(mockStorage).length, 0);
});

test('index.html and styles.css include OTDR Dead Zone QA modal elements and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="openOtdrDeadzoneBtn"'));
  assert.ok(html.includes('data-open-otdr-deadzone'));
  assert.ok(html.includes('id="otdrDeadzoneModal"'));
  assert.ok(html.includes('id="otdrDeadzoneSvgContainer"'));
  assert.ok(html.includes('id="otdrDeadzoneHudRibbon"'));
  assert.ok(html.includes('id="otdrDeadzonePresetSelect"'));
  assert.ok(html.includes('id="otdrDeadzonePulseSelect"'));
  assert.ok(html.includes('id="otdrDeadzoneWlSelect"'));
  assert.ok(html.includes('id="saveOtdrDeadzoneCertBtn"'));
  assert.ok(html.includes('id="printOtdrDeadzoneA4Btn"'));

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.otdr-deadzone-modal-card'));
  assert.ok(css.includes('.otdr-deadzone-trace-svg'));
  assert.ok(css.includes('.otdr-deadzone-svg-wrap'));
});

test('setupOtdrDeadzoneModal binds DOM elements, recalculates, and saves certificates', async () => {
  const { setupOtdrDeadzoneModal, OTDR_DEADZONE_CERT_STORAGE_KEY } = await import('../form-validation.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      innerHTML: '',
      open: false,
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      querySelectorAll() { return []; }
    };
  }

  const elements = {
    otdrDeadzoneModal: createMockEl('otdrDeadzoneModal'),
    openOtdrDeadzoneBtn: createMockEl('openOtdrDeadzoneBtn'),
    closeOtdrDeadzoneBtn: createMockEl('closeOtdrDeadzoneBtn'),
    otdrDeadzonePresetSelect: createMockEl('otdrDeadzonePresetSelect'),
    otdrDeadzonePulseSelect: createMockEl('otdrDeadzonePulseSelect'),
    otdrDeadzoneWlSelect: createMockEl('otdrDeadzoneWlSelect'),
    otdrDeadzoneLaunchInput: createMockEl('otdrDeadzoneLaunchInput'),
    otdrDeadzoneTailInput: createMockEl('otdrDeadzoneTailInput'),
    otdrDeadzoneSvgContainer: createMockEl('otdrDeadzoneSvgContainer'),
    otdrDeadzoneHudRibbon: createMockEl('otdrDeadzoneHudRibbon'),
    saveOtdrDeadzoneCertBtn: createMockEl('saveOtdrDeadzoneCertBtn'),
    printOtdrDeadzoneA4Btn: createMockEl('printOtdrDeadzoneA4Btn'),
    printThermalBtn: createMockEl('printOtdrDeadzoneThermalBtn'),
    whatsappOtdrDeadzoneBtn: createMockEl('whatsappOtdrDeadzoneBtn'),
    exportCsvBtn: createMockEl('exportOtdrDeadzoneCsvBtn'),
    otdrDeadzoneHistoryTbody: createMockEl('otdrDeadzoneHistoryTbody')
  };

  elements.otdrDeadzonePresetSelect.value = 'SPAN_BARADARI_JIA_MUSA';
  elements.otdrDeadzonePulseSelect.value = '10ns';
  elements.otdrDeadzoneWlSelect.value = '1550';
  elements.otdrDeadzoneLaunchInput.value = '500';
  elements.otdrDeadzoneTailInput.value = '300';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toastLog = [];
  const controller = setupOtdrDeadzoneModal({
    storage: mockStorage,
    doc: mockDoc,
    onToast: (msg) => toastLog.push(msg)
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.otdrDeadzoneModal.open, true);
  assert.ok(elements.otdrDeadzoneSvgContainer.innerHTML.includes('<svg'));
  assert.ok(elements.otdrDeadzoneHudRibbon.innerHTML.includes('Event Dead Zone'));

  elements.saveOtdrDeadzoneCertBtn.click();
  assert.ok(toastLog.some(msg => msg.includes('saved successfully')));
  assert.ok(store[OTDR_DEADZONE_CERT_STORAGE_KEY]);

  controller.close();
  assert.equal(elements.otdrDeadzoneModal.open, false);
});

test('calculateTheoreticalSplittingLoss computes 10*log10(N) dB accurately', async () => {
  const { calculateTheoreticalSplittingLoss } = await import('../form-validation.js');
  assert.equal(calculateTheoreticalSplittingLoss(1), 0.0);
  assert.equal(calculateTheoreticalSplittingLoss(2), 3.01);
  assert.equal(calculateTheoreticalSplittingLoss(4), 6.02);
  assert.equal(calculateTheoreticalSplittingLoss(8), 9.03);
  assert.equal(calculateTheoreticalSplittingLoss(16), 12.04);
  assert.equal(calculateTheoreticalSplittingLoss(32), 15.05);
  assert.equal(calculateTheoreticalSplittingLoss(64), 18.06);
  assert.equal(calculateTheoreticalSplittingLoss(0), 0.0);
});

test('evaluateSplitterPorts evaluates 1:8 PLC splitter and handles exemplary inputs', async () => {
  const { evaluateSplitterPorts } = await import('../form-validation.js');
  const res = evaluateSplitterPorts({
    splitterType: '1:8',
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.90, 10.05, 9.88, 9.95, 10.10, 9.80, 10.00]
  });

  assert.equal(res.splitterType, '1:8');
  assert.equal(res.portCount, 8);
  assert.equal(res.passCount, 8);
  assert.equal(res.failHighCount, 0);
  assert.equal(res.failLowCount, 0);
  assert.equal(res.conditionalCount, 0);
  assert.equal(res.uniformityStatus, 'PASS');
  assert.ok(res.uniformityDeltaDb <= 0.80);
  assert.equal(res.overallVerdict, 'CERTIFIED_CLASS_A');
  assert.ok(res.excessLossDb >= 0.0);
});

test('evaluateSplitterPorts flags high loss and pinched ports', async () => {
  const { evaluateSplitterPorts } = await import('../form-validation.js');
  const res = evaluateSplitterPorts({
    splitterType: '1:8',
    inputPowerDbm: 3.0,
    portLosses: [10.2, 10.3, 18.5, 10.1, 10.4, 10.2, 10.3, 10.2]
  });

  assert.equal(res.failHighCount, 1);
  assert.equal(res.overallVerdict, 'REJECT_DEFECTIVE');
  assert.equal(res.ports[2].status, 'FAILED_HIGH_LOSS');
  assert.ok(res.ports[2].note.includes('Excessive attenuation'));
});

test('evaluateSplitterPorts flags unphysical low loss readings', async () => {
  const { evaluateSplitterPorts } = await import('../form-validation.js');
  const res = evaluateSplitterPorts({
    splitterType: '1:8',
    inputPowerDbm: 3.0,
    portLosses: [9.8, 9.9, 5.0, 9.8, 9.9, 10.0, 9.8, 10.0]
  });

  assert.equal(res.failLowCount, 1);
  assert.equal(res.overallVerdict, 'REJECT_DEFECTIVE');
  assert.equal(res.ports[2].status, 'FAILED_LOW_LOSS');
  assert.ok(res.ports[2].note.includes('theoretical limit'));
});

test('evaluateSplitterPorts handles asymmetrical tap couplers', async () => {
  const { evaluateSplitterPorts } = await import('../form-validation.js');
  const res = evaluateSplitterPorts({
    splitterType: 'TAP_85_15',
    inputPowerDbm: 2.5,
    portLosses: [0.85, 8.60]
  });

  assert.equal(res.portCount, 2);
  assert.equal(res.passCount, 2);
  assert.equal(res.overallVerdict, 'CERTIFIED_CLASS_A');
  assert.equal(res.ports[0].legName, 'Through (85%)');
  assert.equal(res.ports[1].legName, 'Tap (15%)');
});

test('validateSplitterQaInput validates required fields correctly', async () => {
  const { validateSplitterQaInput } = await import('../form-validation.js');
  const invalid = validateSplitterQaInput({});
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.location);
  assert.ok(invalid.errors.technicianName);

  const valid = validateSplitterQaInput({
    splitterType: '1:8',
    location: 'Baradari Hub FAT-08',
    technicianName: 'Muhammad Rizwan',
    inputPowerDbm: '3.5'
  });
  assert.equal(valid.valid, true);
});

test('buildSplitterQaRecord creates sequential cert IDs and preserves data', async () => {
  const { buildSplitterQaRecord } = await import('../form-validation.js');
  const existing = [{ certId: 'SPL-202610-0001' }, { certId: 'SPL-202610-0002' }];
  const record = buildSplitterQaRecord({
    splitterType: '1:8',
    location: 'Baradari Hub FAT-08',
    technicianName: 'Muhammad Rizwan',
    wavelengthNm: 1550,
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  }, existing);

  assert.equal(record.certId, 'SPL-202610-0003');
  assert.equal(record.splitterType, '1:8');
  assert.equal(record.evaluation.overallVerdict, 'CERTIFIED_CLASS_A');
});

test('renderSplitterQaAnalysisSvg returns valid SVG markup with bars and enclosure', async () => {
  const { evaluateSplitterPorts, renderSplitterQaAnalysisSvg } = await import('../form-validation.js');
  const ev = evaluateSplitterPorts({
    splitterType: '1:8',
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  });

  const svg = renderSplitterQaAnalysisSvg(ev);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('splitter-qa-svg'));
  assert.ok(svg.includes('Theoretical Split:'));
  assert.ok(svg.includes('Telcordia Limit:'));
  assert.ok(svg.includes('Uniformity:'));
  assert.ok(svg.includes('Excess Loss:'));
});

test('generateSplitterQaCertHtml generates both A4 and 80mm thermal formats', async () => {
  const { buildSplitterQaRecord, generateSplitterQaCertHtml } = await import('../form-validation.js');
  const record = buildSplitterQaRecord({
    splitterType: '1:8',
    location: 'Baradari Hub FAT-08',
    technicianName: 'Muhammad Rizwan',
    wavelengthNm: 1550,
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  });

  const a4 = generateSplitterQaCertHtml(record, { format: 'a4' });
  assert.ok(a4.includes('SHAHDARA BROADBAND ISP'));
  assert.ok(a4.includes('Telcordia GR-1209-CORE'));
  assert.ok(a4.includes('Channel Uniformity ΔU'));

  const thermal = generateSplitterQaCertHtml(record, { format: 'thermal' });
  assert.ok(thermal.includes('SHAHDARA ISP - OSP QA'));
  assert.ok(thermal.includes('80mm auto'));
  assert.ok(thermal.includes('PORT MEASUREMENTS:'));
});

test('formatSplitterQaCertWhatsApp formats bilingual dispatch notice', async () => {
  const { buildSplitterQaRecord, formatSplitterQaCertWhatsApp } = await import('../form-validation.js');
  const record = buildSplitterQaRecord({
    splitterType: '1:8',
    location: 'Baradari Hub FAT-08',
    technicianName: 'Muhammad Rizwan',
    wavelengthNm: 1550,
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  });

  const wa = formatSplitterQaCertWhatsApp(record);
  assert.ok(wa.includes('SHAHDARA ISP - OPTICAL SPLITTER QA ACCREDITATION'));
  assert.ok(wa.includes('یونیفارمٹی'));
  assert.ok(wa.includes('1:8 Balanced PLC Splitter'));
});

test('generateSplitterQaCertsCsv generates RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildSplitterQaRecord, generateSplitterQaCertsCsv } = await import('../form-validation.js');
  const record = buildSplitterQaRecord({
    splitterType: '1:8',
    location: 'Baradari Hub FAT-08',
    technicianName: 'Muhammad Rizwan',
    wavelengthNm: 1550,
    inputPowerDbm: 3.5,
    portLosses: [9.85, 9.92, 10.05, 9.88, 9.95, 10.12, 9.80, 10.02]
  });

  const csv = generateSplitterQaCertsCsv([record]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Certificate ID'));
  assert.ok(csv.includes(record.certId));
});

test('getSavedSplitterQaCerts, saveSplitterQaCert, updateSplitterQaCertStatus, and calculateSplitterQaMetrics work correctly', async () => {
  const {
    SPLITTER_QA_STORAGE_KEY,
    getSavedSplitterQaCerts,
    saveSplitterQaCert,
    updateSplitterQaCertStatus,
    clearSplitterQaCerts,
    calculateSplitterQaMetrics,
    buildSplitterQaRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const cert1 = buildSplitterQaRecord({ splitterType: '1:8', location: 'Baradari' });
  cert1.certId = 'SPL-202610-0001';
  const cert2 = buildSplitterQaRecord({ splitterType: '1:16', location: 'Vandala' });
  cert2.certId = 'SPL-202610-0002';

  assert.equal(saveSplitterQaCert(cert1, mockStorage), true);
  assert.equal(saveSplitterQaCert(cert2, mockStorage), true);

  const list = getSavedSplitterQaCerts(mockStorage);
  assert.equal(list.length, 2);

  assert.equal(updateSplitterQaCertStatus('SPL-202610-0001', 'CONDITIONAL_DEGRADED', mockStorage), true);
  const updated = getSavedSplitterQaCerts(mockStorage);
  assert.equal(updated.find(c => c.certId === 'SPL-202610-0001').evaluation.overallVerdict, 'CONDITIONAL_DEGRADED');

  const metrics = calculateSplitterQaMetrics(updated);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.conditional, 1);

  assert.equal(clearSplitterQaCerts(mockStorage), true);
  assert.equal(getSavedSplitterQaCerts(mockStorage).length, 0);
});

test('index.html and styles.css include Splitter QA modal elements and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="openSplitterQaBtn"'));
  assert.ok(html.includes('data-open-splitter-qa'));
  assert.ok(html.includes('id="splitterQaModal"'));
  assert.ok(html.includes('id="splitterQaSvgContainer"'));
  assert.ok(html.includes('id="splitterQaHudRibbon"'));
  assert.ok(html.includes('id="splitterQaPortsGrid"'));
  assert.ok(html.includes('id="saveSplitterQaCertBtn"'));
  assert.ok(html.includes('id="printSplitterQaA4Btn"'));

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.splitter-qa-modal-card'));
  assert.ok(css.includes('.splitter-qa-svg'));
  assert.ok(css.includes('.splitter-qa-svg-wrap'));
});

test('setupSplitterQaModal binds DOM elements, handles presets, recalculates, and saves certificates', async () => {
  const { setupSplitterQaModal, SPLITTER_QA_STORAGE_KEY } = await import('../form-validation.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      innerHTML: '',
      open: false,
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      querySelectorAll() { return []; }
    };
  }

  const elements = {
    splitterQaModal: createMockEl('splitterQaModal'),
    openSplitterQaBtn: createMockEl('openSplitterQaBtn'),
    closeSplitterQaBtn: createMockEl('closeSplitterQaBtn'),
    splitterQaPresetSelect: createMockEl('splitterQaPresetSelect'),
    splitterQaTypeSelect: createMockEl('splitterQaTypeSelect'),
    splitterQaInputPower: createMockEl('splitterQaInputPower'),
    splitterQaWlSelect: createMockEl('splitterQaWlSelect'),
    splitterQaLocation: createMockEl('splitterQaLocation'),
    splitterQaTech: createMockEl('splitterQaTech'),
    splitterQaSerial: createMockEl('splitterQaSerial'),
    splitterQaNotes: createMockEl('splitterQaNotes'),
    splitterQaPortsGrid: createMockEl('splitterQaPortsGrid'),
    splitterQaSvgContainer: createMockEl('splitterQaSvgContainer'),
    splitterQaHudRibbon: createMockEl('splitterQaHudRibbon'),
    saveSplitterQaCertBtn: createMockEl('saveSplitterQaCertBtn'),
    printSplitterQaA4Btn: createMockEl('printSplitterQaA4Btn'),
    printSplitterQaThermalBtn: createMockEl('printSplitterQaThermalBtn'),
    whatsappSplitterQaBtn: createMockEl('whatsappSplitterQaBtn'),
    exportSplitterQaCsvBtn: createMockEl('exportSplitterQaCsvBtn'),
    splitterQaHistoryTbody: createMockEl('splitterQaHistoryTbody')
  };

  elements.splitterQaTypeSelect.value = '1:8';
  elements.splitterQaInputPower.value = '3.5';
  elements.splitterQaLocation.value = 'Baradari Hub FAT-08';
  elements.splitterQaTech.value = 'Muhammad Rizwan';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toastLog = [];
  const controller = setupSplitterQaModal({
    storage: mockStorage,
    doc: mockDoc,
    onToast: (msg) => toastLog.push(msg)
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.splitterQaModal.open, true);
  assert.ok(elements.splitterQaSvgContainer.innerHTML.includes('<svg'));

  elements.saveSplitterQaCertBtn.click();
  assert.ok(toastLog.some(msg => msg.includes('saved successfully')));
  assert.ok(store[SPLITTER_QA_STORAGE_KEY]);

  controller.close();
  assert.equal(elements.splitterQaModal.open, false);
});

// ============================================================================
// Optical Connector Ferrule End-Face Geometric Interferometry & Durability QA
// ============================================================================

test('FERRULE_CONNECTOR_TYPES and FERRULE_GEOMETRY_PRESETS contain correct standards and specs', async () => {
  const { FERRULE_CONNECTOR_TYPES, FERRULE_GEOMETRY_PRESETS } = await import('../form-validation.js');

  assert.ok(FERRULE_CONNECTOR_TYPES['SC_APC']);
  assert.ok(FERRULE_CONNECTOR_TYPES['SC_UPC']);
  assert.ok(FERRULE_CONNECTOR_TYPES['LC_APC']);
  assert.ok(FERRULE_CONNECTOR_TYPES['LC_UPC']);
  assert.ok(FERRULE_CONNECTOR_TYPES['FC_APC']);
  assert.ok(FERRULE_CONNECTOR_TYPES['FC_UPC']);

  assert.equal(FERRULE_CONNECTOR_TYPES['SC_APC'].polish, 'APC');
  assert.equal(FERRULE_CONNECTOR_TYPES['SC_APC'].nominalAngleDeg, 8.0);
  assert.equal(FERRULE_CONNECTOR_TYPES['SC_APC'].ferruleDiameterMm, 2.5);
  assert.equal(FERRULE_CONNECTOR_TYPES['LC_APC'].ferruleDiameterMm, 1.25);
  assert.equal(FERRULE_CONNECTOR_TYPES['SC_UPC'].polish, 'UPC');
  assert.equal(FERRULE_CONNECTOR_TYPES['SC_UPC'].nominalAngleDeg, 0.0);

  assert.ok(FERRULE_GEOMETRY_PRESETS.PRESET_SHAHDARA_NOC_MASTER_APC);
  assert.ok(FERRULE_GEOMETRY_PRESETS.PRESET_SHAHDARA_LOCAL_PIGTAIL_APEX_FAIL);
  assert.ok(FERRULE_GEOMETRY_PRESETS.PRESET_SHAHDARA_XGSPON_ENTERPRISE_APC);
  assert.ok(FERRULE_GEOMETRY_PRESETS.PRESET_SHAHDARA_OVERPOLISHED_UNDERCUT_FAIL);
  assert.ok(FERRULE_GEOMETRY_PRESETS.PRESET_SHAHDARA_EXCESSIVE_RADIUS_FLAT_FAIL);
});

test('evaluateFerruleGeometry correctly evaluates Grade A master reference pass', async () => {
  const { evaluateFerruleGeometry } = await import('../form-validation.js');

  const res = evaluateFerruleGeometry({
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0,
    angleDeg: 8.04,
    springForceN: 8.0,
    matingCycles: 15
  });

  assert.equal(res.overallVerdict, 'PASS_GRADE_A');
  assert.equal(res.verdictStatus, 'PASS');
  assert.equal(res.isPhysicalContact, true);
  assert.equal(res.airGapNm, 0);
  assert.ok(res.domeDropNm > 0);
  assert.ok(res.elasticCompNm > 0);
  assert.ok(res.contactRadiusUm > 0);
  assert.ok(res.hertzianStressMpa <= 1200);
  assert.ok(res.estimatedIlDb <= 0.25);
  assert.ok(res.estimatedOrlDb >= 65);
});

test('evaluateFerruleGeometry correctly flags local pigtail with excessive apex offset and air gap', async () => {
  const { evaluateFerruleGeometry } = await import('../form-validation.js');

  const res = evaluateFerruleGeometry({
    connectorType: 'SC_UPC',
    rocMm: 18.5,
    apexOffsetUm: 74.8,
    fiberHeightNm: -65.0,
    angleDeg: 0.08,
    springForceN: 7.5,
    matingCycles: 2
  });

  assert.equal(res.overallVerdict, 'FAIL');
  assert.equal(res.verdictStatus, 'FAIL');
  assert.equal(res.isPhysicalContact, false);
  assert.ok(res.airGapNm > 0);
  assert.equal(res.isApexValid, false);
  assert.equal(res.isFiberHeightValid, false);
  assert.ok(res.diagnosticSummary.includes('Core Air Gap'));
  assert.ok(res.diagnosticSummary.includes('Apex Offset'));
});

test('evaluateFerruleGeometry correctly flags over-polished undercut and excessive flatness', async () => {
  const { evaluateFerruleGeometry } = await import('../form-validation.js');

  // Overpolished undercut
  const undercut = evaluateFerruleGeometry({
    connectorType: 'FC_UPC',
    rocMm: 9.1,
    apexOffsetUm: 32.0,
    fiberHeightNm: -135.0,
    angleDeg: 0.12,
    springForceN: 7.2
  });
  assert.equal(undercut.overallVerdict, 'FAIL');
  assert.equal(undercut.isFiberHeightValid, false);
  assert.ok(undercut.diagnosticSummary.includes('Excessive Undercut'));

  // Flat ferrule (> 25mm)
  const flat = evaluateFerruleGeometry({
    connectorType: 'LC_UPC',
    rocMm: 38.0,
    apexOffsetUm: 42.0,
    fiberHeightNm: -15.0,
    angleDeg: 0.05,
    springForceN: 5.5
  });
  assert.equal(flat.overallVerdict, 'FAIL');
  assert.equal(flat.isRocValid, false);
  assert.ok(flat.diagnosticSummary.includes('Excessive Flatness'));
});

test('renderFerruleGeometryAnalysisSvg outputs compliant SVG markup with cross section and fringes', async () => {
  const { evaluateFerruleGeometry, renderFerruleGeometryAnalysisSvg } = await import('../form-validation.js');

  const calc = evaluateFerruleGeometry({
    connectorType: 'SC_APC',
    rocMm: 8.0,
    apexOffsetUm: 20.0,
    fiberHeightNm: 10.0,
    angleDeg: 8.0
  });

  const svg = renderFerruleGeometryAnalysisSvg(calc);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('ferruleCrossSection'));
  assert.ok(svg.includes('interferometryHud'));
  assert.ok(svg.includes('ZIRCONIA'));
  assert.ok(svg.includes('INTERFERENCE FRINGES'));
  assert.ok(svg.includes('FIBER HEIGHT PROFILE'));
  assert.ok(svg.includes('</svg>'));
});

test('buildFerruleGeometryRecord creates normalized record object', async () => {
  const { buildFerruleGeometryRecord } = await import('../form-validation.js');

  const record = buildFerruleGeometryRecord({
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0,
    serialNumber: 'SN-TEST-12345',
    location: 'NOC Shelf 04',
    inspectorName: 'Engr. Haris Tariq',
    notes: 'Unit test note'
  });

  assert.ok(record.certId.startsWith('FG-QA-'));
  assert.equal(record.connectorType, 'SC_APC');
  assert.equal(record.serialNumber, 'SN-TEST-12345');
  assert.equal(record.location, 'NOC Shelf 04');
  assert.equal(record.inspectorName, 'Engr. Haris Tariq');
  assert.equal(record.notes, 'Unit test note');
  assert.equal(record.status, 'APPROVED');
  assert.equal(record.verdictStatus, 'PASS');
});

test('generateFerruleGeometryCertHtml generates A4 and thermal formats', async () => {
  const { buildFerruleGeometryRecord, generateFerruleGeometryCertHtml } = await import('../form-validation.js');

  const record = buildFerruleGeometryRecord({
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0,
    serialNumber: 'SN-APC-001'
  });

  const a4 = generateFerruleGeometryCertHtml(record, { format: 'a4' });
  assert.ok(a4.includes('SHAHDARA ISP METROLOGY LABORATORY'));
  assert.ok(a4.includes(record.certId));
  assert.ok(a4.includes('Telcordia GR-326-CORE'));

  const thermal = generateFerruleGeometryCertHtml(record, { format: 'thermal' });
  assert.ok(thermal.includes('FERRULE GEOMETRY QA SLIP'));
  assert.ok(thermal.includes(record.certId));
  assert.ok(thermal.includes('Radius Curv (R):'));
});

test('formatFerruleGeometryCertWhatsApp formats dispatch message', async () => {
  const { buildFerruleGeometryRecord, formatFerruleGeometryCertWhatsApp } = await import('../form-validation.js');

  const record = buildFerruleGeometryRecord({
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0,
    serialNumber: 'SN-APC-001',
    inspectorName: 'Engr. Haris'
  });

  const wa = formatFerruleGeometryCertWhatsApp(record);
  assert.ok(wa.includes('*SHAHDARA ISP - FERRULE GEOMETRY QA REPORT*'));
  assert.ok(wa.includes(record.certId));
  assert.ok(wa.includes('Engr. Haris'));
  assert.ok(wa.includes('Curvature Radius (R):'));
});

test('generateFerruleGeometryCertsCsv exports compliant CSV', async () => {
  const { buildFerruleGeometryRecord, generateFerruleGeometryCertsCsv } = await import('../form-validation.js');

  const record1 = buildFerruleGeometryRecord({
    connectorType: 'SC_APC',
    rocMm: 8.4,
    apexOffsetUm: 14.2,
    fiberHeightNm: 18.0
  });

  const csv = generateFerruleGeometryCertsCsv([record1]);
  assert.ok(csv.includes('Cert ID,Timestamp,Connector Type'));
  assert.ok(csv.includes(record1.certId));
  assert.ok(csv.includes('SC_APC'));
});

test('LocalStorage methods save, retrieve, update, and clear ferrule geometry certs', async () => {
  const {
    getSavedFerruleGeometryCerts,
    saveFerruleGeometryCert,
    updateFerruleGeometryCertStatus,
    clearFerruleGeometryCerts,
    calculateFerruleGeometryMetrics,
    buildFerruleGeometryRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  assert.equal(getSavedFerruleGeometryCerts(mockStorage).length, 0);

  const cert1 = buildFerruleGeometryRecord({ connectorType: 'SC_APC', rocMm: 8.4, apexOffsetUm: 14.2, fiberHeightNm: 18.0 });
  const cert2 = buildFerruleGeometryRecord({ connectorType: 'SC_UPC', rocMm: 18.5, apexOffsetUm: 74.8, fiberHeightNm: -65.0 });

  assert.equal(saveFerruleGeometryCert(cert1, mockStorage), true);
  assert.equal(saveFerruleGeometryCert(cert2, mockStorage), true);

  const saved = getSavedFerruleGeometryCerts(mockStorage);
  assert.equal(saved.length, 2);

  const metrics = calculateFerruleGeometryMetrics(saved);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.passCount, 1);
  assert.equal(metrics.failCount, 1);
  assert.equal(metrics.passRatePercent, 50);

  assert.equal(updateFerruleGeometryCertStatus(cert2.certId, 'RE-POLISHED_PASSED', mockStorage), true);
  const updated = getSavedFerruleGeometryCerts(mockStorage);
  assert.equal(updated.find(c => c.certId === cert2.certId).status, 'RE-POLISHED_PASSED');

  assert.equal(clearFerruleGeometryCerts(mockStorage), true);
  assert.equal(getSavedFerruleGeometryCerts(mockStorage).length, 0);
});

test('index.html and styles.css include Ferrule Geometry QA modal elements and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="openFerruleGeometryBtn"'));
  assert.ok(html.includes('data-open-ferrule-geometry'));
  assert.ok(html.includes('id="ferruleGeometryModal"'));
  assert.ok(html.includes('id="ferruleGeometrySvgContainer"'));
  assert.ok(html.includes('id="ferruleGeometryHudRibbon"'));
  assert.ok(html.includes('id="ferruleGeometryPresetSelect"'));
  assert.ok(html.includes('id="ferruleGeometryTypeSelect"'));
  assert.ok(html.includes('id="ferruleGeometryRocInput"'));
  assert.ok(html.includes('id="saveFerruleGeometryCertBtn"'));
  assert.ok(html.includes('id="printFerruleGeometryA4Btn"'));

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.ferrule-geometry-modal-card'));
  assert.ok(css.includes('.ferrule-geometry-svg'));
  assert.ok(css.includes('.ferrule-geometry-svg-wrap'));
});

test('setupFerruleGeometryModal binds DOM elements, handles presets, recalculates, and saves certificates', async () => {
  const { setupFerruleGeometryModal, FERRULE_GEOMETRY_CERT_STORAGE_KEY } = await import('../form-validation.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      innerHTML: '',
      open: false,
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      querySelectorAll() { return []; }
    };
  }

  const elements = {
    ferruleGeometryModal: createMockEl('ferruleGeometryModal'),
    openFerruleGeometryBtn: createMockEl('openFerruleGeometryBtn'),
    closeFerruleGeometryBtn: createMockEl('closeFerruleGeometryBtn'),
    ferruleGeometryPresetSelect: createMockEl('ferruleGeometryPresetSelect'),
    ferruleGeometryTypeSelect: createMockEl('ferruleGeometryTypeSelect'),
    ferruleGeometryRocInput: createMockEl('ferruleGeometryRocInput'),
    ferruleGeometryApexInput: createMockEl('ferruleGeometryApexInput'),
    ferruleGeometryFiberHeightInput: createMockEl('ferruleGeometryFiberHeightInput'),
    ferruleGeometryAngleInput: createMockEl('ferruleGeometryAngleInput'),
    ferruleGeometrySpringForceInput: createMockEl('ferruleGeometrySpringForceInput'),
    ferruleGeometryCyclesInput: createMockEl('ferruleGeometryCyclesInput'),
    ferruleGeometryLocationInput: createMockEl('ferruleGeometryLocationInput'),
    ferruleGeometryTechInput: createMockEl('ferruleGeometryTechInput'),
    ferruleGeometrySerialInput: createMockEl('ferruleGeometrySerialInput'),
    ferruleGeometryNotesInput: createMockEl('ferruleGeometryNotesInput'),
    ferruleGeometrySvgContainer: createMockEl('ferruleGeometrySvgContainer'),
    ferruleGeometryHudRibbon: createMockEl('ferruleGeometryHudRibbon'),
    saveFerruleGeometryCertBtn: createMockEl('saveFerruleGeometryCertBtn'),
    printFerruleGeometryA4Btn: createMockEl('printFerruleGeometryA4Btn'),
    printFerruleGeometryThermalBtn: createMockEl('printFerruleGeometryThermalBtn'),
    whatsappFerruleGeometryBtn: createMockEl('whatsappFerruleGeometryBtn'),
    exportFerruleGeometryCsvBtn: createMockEl('exportFerruleGeometryCsvBtn'),
    ferruleGeometryHistoryTbody: createMockEl('ferruleGeometryHistoryTbody')
  };

  elements.ferruleGeometryTypeSelect.value = 'SC_APC';
  elements.ferruleGeometryRocInput.value = '8.4';
  elements.ferruleGeometryApexInput.value = '14.2';
  elements.ferruleGeometryFiberHeightInput.value = '18';
  elements.ferruleGeometryAngleInput.value = '8.04';
  elements.ferruleGeometrySpringForceInput.value = '8.0';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toastLog = [];
  const controller = setupFerruleGeometryModal({
    storage: mockStorage,
    doc: mockDoc,
    document: mockDoc,
    onToast: (msg) => toastLog.push(msg)
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.ferruleGeometryModal.open, true);
  assert.ok(elements.ferruleGeometrySvgContainer.innerHTML.includes('<svg'));

  elements.saveFerruleGeometryCertBtn.click();
  assert.ok(toastLog.some(msg => msg.includes('saved successfully')));
  assert.ok(store[FERRULE_GEOMETRY_CERT_STORAGE_KEY]);

  controller.close();
  assert.equal(elements.ferruleGeometryModal.open, false);
});

// ============================================================================
// Optical Fiber Fusion Splicer Arc Discharge Plasma, Electrode Life & Proof-Test Tension QA Suite
// Standards: IEC 61073-1, Telcordia GR-765-CORE Issue 1, ITU-T G.650.1, ITU-T G.652.D
// ============================================================================

test('SPLICER_MODELS, FIBER_TYPES, PROOF_TEST_STATUSES, and FUSION_ARC_PRESETS contain accurate metrology parameters', async () => {
  const { SPLICER_MODELS, FIBER_TYPES, PROOF_TEST_STATUSES, QA_VERDICTS, FUSION_ARC_PRESETS } = await import('../form-validation.js');

  assert.ok(SPLICER_MODELS['FUJIKURA_90S']);
  assert.ok(SPLICER_MODELS['SUMITOMO_Z2C']);
  assert.ok(SPLICER_MODELS['INNO_VIEW7']);
  assert.ok(SPLICER_MODELS['SIGNALFIRE_AI9']);
  assert.ok(SPLICER_MODELS['FUJIKURA_41S']);

  assert.equal(SPLICER_MODELS['FUJIKURA_90S'].maxElectrodeCycles, 5000);
  assert.equal(SPLICER_MODELS['SUMITOMO_Z2C'].maxElectrodeCycles, 6000);
  assert.equal(SPLICER_MODELS['FUJIKURA_90S'].standardProofTensionN, 2.0);

  assert.ok(FIBER_TYPES['G652D']);
  assert.ok(FIBER_TYPES['G657A1']);
  assert.ok(FIBER_TYPES['G657A2']);
  assert.ok(FIBER_TYPES['G655']);
  assert.ok(FIBER_TYPES['OM3_MMF']);

  assert.equal(FIBER_TYPES['G652D'].modeFieldDiameterUm, 9.2);
  assert.equal(FIBER_TYPES['G652D'].claddingDiameterUm, 125.0);

  assert.ok(PROOF_TEST_STATUSES['PASSED_TENSILE_VERIFIED'].isPassing);
  assert.ok(!PROOF_TEST_STATUSES['FAILED_TENSILE_FRACTURE'].isPassing);

  assert.ok(QA_VERDICTS['TELCORDIA_GRADE_A'].isCompliant);
  assert.ok(QA_VERDICTS['COMMERCIAL_PASS'].isCompliant);
  assert.ok(!QA_VERDICTS['REJECT_RESPLICE_MANDATED'].isCompliant);

  assert.ok(FUSION_ARC_PRESETS.PRESET_BARADARI_MAIN_FEEDER_GRADE_A);
  assert.ok(FUSION_ARC_PRESETS.PRESET_BEGUM_KOT_HIGH_PRESSURE_SUMITOMO);
  assert.ok(FUSION_ARC_PRESETS.PRESET_JIA_MUSA_WORN_ELECTRODE_WARNING);
  assert.ok(FUSION_ARC_PRESETS.PRESET_RACHNA_TOWN_CLEAVE_TILT_FAIL);
  assert.ok(FUSION_ARC_PRESETS.PRESET_VANDALA_ROAD_PROOF_SNAP_FRACTURE);
});

test('calculateElectrodeLife calculates wear odometer, status, and tip radius erosion accurately', async () => {
  const { calculateElectrodeLife } = await import('../form-validation.js');

  // Case 1: Brand new electrodes (500 / 5000)
  const life1 = calculateElectrodeLife(500, 5000);
  assert.equal(life1.dischargeCount, 500);
  assert.equal(life1.maxCycles, 5000);
  assert.equal(life1.remainingDischarges, 4500);
  assert.equal(life1.remainingPercent, 90);
  assert.equal(life1.status, 'OPTIMAL_PRISTINE');
  assert.equal(life1.estimatedTipRadiusUm, 26.0); // 20 * (1 + 0.0006 * 500) = 26.0

  // Case 2: Normal wear (3200 / 5000, 64% used)
  const life2 = calculateElectrodeLife(3200, 5000);
  assert.equal(life2.status, 'NORMAL_WEAR');
  assert.equal(life2.remainingPercent, 36);

  // Case 3: Maintenance due (4400 / 5000, 88% used)
  const life3 = calculateElectrodeLife(4400, 5000);
  assert.equal(life3.status, 'MAINTENANCE_DUE');

  // Case 4: Expired (5200 / 5000)
  const life4 = calculateElectrodeLife(5200, 5000);
  assert.equal(life4.status, 'EXPIRED_REPLACE_MANDATORY');
  assert.equal(life4.remainingPercent, 0);
  assert.equal(life4.remainingDischarges, 0);
});

test('calculateArcCompensation computes temperature, barometric pressure, and humidity drive deltas', async () => {
  const { calculateArcCompensation } = await import('../form-validation.js');

  // Standard condition: 20°C, 1013.25 hPa, 50% RH
  const compStd = calculateArcCompensation(20, 1013.25, 50, 100);
  assert.equal(compStd.totalDeltaCurrentMa, 0);
  assert.equal(compStd.arcPowerStepAdjustment, 0);
  assert.equal(compStd.calibratedArcPower, 100);
  assert.equal(compStd.condition, 'BALANCED_STABLE');

  // Cold weather at high elevation/pressure drop: 10°C, 990 hPa, 70% RH
  // deltaTemp = -0.04 * (10 - 20) = +0.40 mA
  // deltaPress = 0.015 * (1013.25 - 990) = +0.34875 mA
  // deltaHum = 0.010 * (70 - 50) = +0.20 mA
  // Total ~ 0.95 mA -> step ~ 0.95 / 0.02 = 47.5 -> 48 steps
  const compColdHigh = calculateArcCompensation(10, 990, 70, 100);
  assert.ok(compColdHigh.totalDeltaCurrentMa > 0.8);
  assert.ok(compColdHigh.arcPowerStepAdjustment > 40);
  assert.ok(compColdHigh.calibratedArcPower > 140);
  assert.equal(compColdHigh.condition, 'HIGH_POWER_COMPENSATION');

  // Hot summer day: 42°C, 1015 hPa, 30% RH
  const compHot = calculateArcCompensation(42, 1015, 30, 100);
  assert.ok(compHot.totalDeltaCurrentMa < -0.8);
  assert.ok(compHot.calibratedArcPower < 80);
  assert.equal(compHot.condition, 'LOW_POWER_REDUCTION');
});

test('calculateSpliceLoss computes Marcuse core eccentricity and cleave angle tilt losses', async () => {
  const { calculateSpliceLoss } = await import('../form-validation.js');

  // Pristine joint: G.652.D (MFD 9.2um, w = 4.6um), 0.10um X, 0.10um Y, 0.4° and 0.5° cleave
  const res = calculateSpliceLoss({
    fiberTypeId: 'G652D',
    coreOffsetXUm: 0.10,
    coreOffsetYUm: 0.10,
    cleaveAngleLeftDeg: 0.4,
    cleaveAngleRightDeg: 0.5,
    bubblePenaltyDb: 0.000
  });

  assert.equal(res.fiberTypeId, 'G652D');
  assert.equal(res.netCoreOffsetUm, 0.141); // sqrt(0.01 + 0.01) = 0.1414
  assert.ok(res.offsetLossDb > 0.003 && res.offsetLossDb < 0.006);
  assert.equal(res.netTiltAngleDeg, 0.1);
  assert.ok(res.totalSpliceLossDb > 0.010 && res.totalSpliceLossDb < 0.020);

  // Severe offset and tilt: 0.8um offset, 2.5° cleave difference, 0.05 bubble
  const resBad = calculateSpliceLoss({
    fiberTypeId: 'G652D',
    coreOffsetXUm: 0.8,
    coreOffsetYUm: 0.6,
    cleaveAngleLeftDeg: 3.0,
    cleaveAngleRightDeg: 0.5,
    bubblePenaltyDb: 0.05
  });

  assert.equal(resBad.netCoreOffsetUm, 1.0); // sqrt(0.64 + 0.36) = 1.0
  assert.ok(resBad.offsetLossDb > 0.15); // 4.343 * (1.0 / 4.6)^2 ~ 0.205 dB
  assert.ok(resBad.tiltLossDb > 0.08);
  assert.equal(resBad.defectLossDb, 0.05);
  assert.ok(resBad.totalSpliceLossDb > 0.30);
});

test('evaluateFusionSpliceQa correctly classifies Telcordia Grade A, Commercial Pass, and Re-Splice', async () => {
  const { evaluateFusionSpliceQa } = await import('../form-validation.js');

  // Grade A Master Splice
  const evalGradeA = evaluateFusionSpliceQa({
    splicerModelId: 'FUJIKURA_90S',
    fiberTypeId: 'G652D',
    dischargeCount: 450,
    coreOffsetXUm: 0.10,
    coreOffsetYUm: 0.08,
    cleaveAngleLeftDeg: 0.4,
    cleaveAngleRightDeg: 0.5,
    proofTensionN: 2.10,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  assert.equal(evalGradeA.verdict.id, 'TELCORDIA_GRADE_A');
  assert.ok(evalGradeA.isApproved);
  assert.ok(evalGradeA.spliceLoss.totalSpliceLossDb <= 0.030);
  assert.equal(evalGradeA.proofStressMpa, 171.1); // 2.10 * 81.49 = 171.129

  // Commercial Pass
  const evalComm = evaluateFusionSpliceQa({
    splicerModelId: 'SUMITOMO_Z2C',
    fiberTypeId: 'G657A1',
    dischargeCount: 2200,
    coreOffsetXUm: 0.28,
    coreOffsetYUm: 0.22,
    cleaveAngleLeftDeg: 0.9,
    cleaveAngleRightDeg: 1.1,
    proofTensionN: 1.96,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  assert.equal(evalComm.verdict.id, 'COMMERCIAL_PASS');
  assert.ok(evalComm.isApproved);

  // Rejected due to Tensile Fracture
  const evalFracture = evaluateFusionSpliceQa({
    splicerModelId: 'FUJIKURA_41S',
    fiberTypeId: 'G652D',
    dischargeCount: 1500,
    coreOffsetXUm: 0.15,
    coreOffsetYUm: 0.12,
    proofTensionN: 1.96,
    proofStatus: 'FAILED_TENSILE_FRACTURE'
  });

  assert.equal(evalFracture.verdict.id, 'REJECT_RESPLICE_MANDATED');
  assert.ok(!evalFracture.isApproved);

  // Rejected due to excessive cleave angle (> 2.0°)
  const evalCleaveFail = evaluateFusionSpliceQa({
    splicerModelId: 'SIGNALFIRE_AI9',
    fiberTypeId: 'G657A2',
    cleaveAngleLeftDeg: 2.8,
    cleaveAngleRightDeg: 0.5,
    proofTensionN: 2.0,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  assert.equal(evalCleaveFail.verdict.id, 'REJECT_RESPLICE_MANDATED');
  assert.ok(!evalCleaveFail.isApproved);
});

test('renderFusionArcQaAnalysisSvg renders clean SVG markup with PAS alignment elements', async () => {
  const { evaluateFusionSpliceQa, renderFusionArcQaAnalysisSvg } = await import('../form-validation.js');

  const evaluation = evaluateFusionSpliceQa({
    splicerModelId: 'FUJIKURA_90S',
    fiberTypeId: 'G652D',
    dischargeCount: 500,
    coreOffsetXUm: 0.12,
    coreOffsetYUm: 0.10,
    cleaveAngleLeftDeg: 0.4,
    cleaveAngleRightDeg: 0.5,
    proofTensionN: 2.0,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  const svg = renderFusionArcQaAnalysisSvg(evaluation, { width: 760, height: 360 });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('PAS Core Alignment'));
  assert.ok(svg.includes('Fiber A (Left)'));
  assert.ok(svg.includes('Fiber B (Right)'));
  assert.ok(svg.includes('plasmaGlow'));
  assert.ok(svg.includes('plasmaFilter'));
  assert.ok(svg.includes('CALIBRATED ARC POWER'));
  assert.ok(svg.includes('ESTIMATED JOINT LOSS'));

  // Test empty/null input fallback
  const emptySvg = renderFusionArcQaAnalysisSvg(null);
  assert.ok(emptySvg.includes('No Fusion QA Data'));
});

test('buildFusionArcQaRecord and generateFusionArcQaCertId generate structured immutable records', async () => {
  const { buildFusionArcQaRecord, generateFusionArcQaCertId } = await import('../form-validation.js');

  const id = generateFusionArcQaCertId('2026-10-17T04:00:00Z');
  assert.match(id, /^FUS-202610-\d{4}$/);

  const record = buildFusionArcQaRecord({
    customer: { id: 'cust-77', name: 'Zain Ul Abideen', phone: '03021122334', mohalla: 'Jia Musa', zone: 'Zone-A' },
    splicerModelId: 'FUJIKURA_90S',
    splicerSerialNumber: 'F90S-PK-88241',
    dischargeCount: 600,
    technicianName: 'Umair Splicer',
    notes: 'Fusion joint inside 24-core dome closure tray 1.'
  });

  assert.ok(record.id.startsWith('FUS-'));
  assert.equal(record.customerName, 'Zain Ul Abideen');
  assert.equal(record.customerArea, 'Jia Musa, Zone-A');
  assert.equal(record.technicianName, 'Umair Splicer');
  assert.equal(record.status, 'ACTIVE_CERTIFIED');
  assert.ok(record.evaluation);
  assert.equal(record.evaluation.splicerSerialNumber, 'F90S-PK-88241');
});

test('generateFusionArcQaCertHtml produces formal A4 and 80mm thermal receipt slips', async () => {
  const { buildFusionArcQaRecord, generateFusionArcQaCertHtml } = await import('../form-validation.js');

  const record = buildFusionArcQaRecord({
    customer: { id: 'cust-10', name: 'Mian Aslam', phone: '03009988776', mohalla: 'Baradari' },
    splicerModelId: 'FUJIKURA_90S',
    dischargeCount: 450,
    proofTensionN: 2.10,
    proofStatus: 'PASSED_TENSILE_VERIFIED',
    spliceLocation: 'Baradari Chowk ODF'
  });

  // Standard A4
  const a4Html = generateFusionArcQaCertHtml(record, { format: 'standard' });
  assert.ok(a4Html.includes('fusion-arc-qa-sheet'));
  assert.ok(a4Html.includes('Shahdara ISP Network Operations'));
  assert.ok(a4Html.includes('آپٹیکل فائبر فیوژن آرک کیلیبریشن و ٹینسائل کوالٹی سرٹیفکیٹ'));
  assert.ok(a4Html.includes('Mian Aslam'));
  assert.ok(a4Html.includes('Baradari Chowk ODF'));
  assert.ok(a4Html.includes('PAS Core Alignment'));
  assert.ok(a4Html.includes('Proof-Test Tensile Pull Load'));

  // Thermal 80mm
  const thermalHtml = generateFusionArcQaCertHtml(record, { format: 'thermal' });
  assert.ok(thermalHtml.includes('fusion-arc-thermal-slip'));
  assert.ok(thermalHtml.includes('FUSION SPLICER ARC QA SLIP'));
  assert.ok(thermalHtml.includes('Shahdara ISP Network'));
  assert.ok(thermalHtml.includes('Mian Aslam') || thermalHtml.includes('Baradari Chowk ODF'));
  assert.ok(thermalHtml.includes('ESTIMATED LOSS:'));
  assert.ok(thermalHtml.includes('PROOF TENSION:'));
});

test('formatFusionArcQaCertWhatsApp formats bilingual Urdu/English technician dispatch text', async () => {
  const { buildFusionArcQaRecord, formatFusionArcQaCertWhatsApp } = await import('../form-validation.js');

  const record = buildFusionArcQaRecord({
    customer: { id: 'cust-20', name: 'Tariq Butt', phone: '03004455667', mohalla: 'Vandala Road' },
    splicerModelId: 'SUMITOMO_Z2C',
    splicerSerialNumber: 'SZ2C-99120',
    dischargeCount: 1850,
    spliceLocation: 'Vandala Road Sub-FAT #04',
    proofTensionN: 1.98,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  const waText = formatFusionArcQaCertWhatsApp(record);
  assert.ok(waText.includes('SHAHDARA ISP · FUSION SPLICER ARC QA CERTIFICATE'));
  assert.ok(waText.includes('آپٹیکل فائبر فیوژن ویلڈنگ و کوالٹی رپورٹ'));
  assert.ok(waText.includes('SZ2C-99120'));
  assert.ok(waText.includes('Vandala Road Sub-FAT #04'));
  assert.ok(waText.includes('جوائنٹ لاس (Insertion Loss):'));
  assert.ok(waText.includes('1.98 N'));
  assert.ok(waText.includes('✅'));

  // Null input handles gracefully
  assert.equal(formatFusionArcQaCertWhatsApp(null), '');
});

test('generateFusionArcQaCertsCsv exports RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildFusionArcQaRecord, generateFusionArcQaCertsCsv } = await import('../form-validation.js');

  const r1 = buildFusionArcQaRecord({
    customer: { id: 'c1', name: 'Bilal Ahmad', mohalla: 'Begum Kot' },
    splicerModelId: 'FUJIKURA_90S',
    splicerSerialNumber: 'F90S-PK-88241',
    dischargeCount: 450,
    notes: 'Clean joint, no bubbles.'
  });

  const r2 = buildFusionArcQaRecord({
    customer: { id: 'c2', name: 'Shahid Mehmood', mohalla: 'Jia Musa' },
    splicerModelId: 'INNO_VIEW7',
    splicerSerialNumber: 'IV7-44021',
    dischargeCount: 4150,
    notes: 'Electrode oxidation noted, cleaning required.'
  });

  const csv = generateFusionArcQaCertsCsv([r1, r2]);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('Certificate_ID,Created_At,Customer_Name'));
  assert.ok(csv.includes('Bilal Ahmad'));
  assert.ok(csv.includes('Shahid Mehmood'));
  assert.ok(csv.includes('F90S-PK-88241'));
  assert.ok(csv.includes('IV7-44021'));
  assert.ok(csv.includes('"Clean joint, no bubbles."'));
});

test('LocalStorage persistence methods and calculateFusionArcQaMetrics aggregate audit data', async () => {
  const {
    FUSION_ARC_QA_STORAGE_KEY,
    getSavedFusionArcQaCerts,
    saveFusionArcQaCert,
    updateFusionArcQaCertStatus,
    clearFusionArcQaCerts,
    calculateFusionArcQaMetrics,
    buildFusionArcQaRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  assert.deepEqual(getSavedFusionArcQaCerts(mockStorage), []);

  const r1 = buildFusionArcQaRecord({
    id: 'FUS-202610-1001',
    splicerModelId: 'FUJIKURA_90S',
    coreOffsetXUm: 0.10,
    coreOffsetYUm: 0.08,
    proofTensionN: 2.10,
    proofStatus: 'PASSED_TENSILE_VERIFIED'
  });

  const r2 = buildFusionArcQaRecord({
    id: 'FUS-202610-1002',
    splicerModelId: 'FUJIKURA_41S',
    dischargeCount: 2900,
    proofStatus: 'FAILED_TENSILE_FRACTURE'
  });

  saveFusionArcQaCert(r1, mockStorage);
  saveFusionArcQaCert(r2, mockStorage);

  const list = getSavedFusionArcQaCerts(mockStorage);
  assert.equal(list.length, 2);

  // Update status
  updateFusionArcQaCertStatus('FUS-202610-1002', 'RESOLVED_RESPLICED', mockStorage);
  const updatedList = getSavedFusionArcQaCerts(mockStorage);
  const updatedItem = updatedList.find(r => r.id === 'FUS-202610-1002');
  assert.equal(updatedItem.status, 'RESOLVED_RESPLICED');

  // Metrics calculation
  const metrics = calculateFusionArcQaMetrics(updatedList);
  assert.equal(metrics.totalInspections, 2);
  assert.equal(metrics.gradeACount, 1);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.fractureCount, 1);
  assert.equal(metrics.complianceRatePercent, 50.0);

  // Clear
  clearFusionArcQaCerts(mockStorage);
  assert.deepEqual(getSavedFusionArcQaCerts(mockStorage), []);
});

test('setupFusionArcQaModal initializes controller and binds DOM mock elements', async () => {
  const { setupFusionArcQaModal } = await import('../form-validation.js');

  function createMockEl(id) {
    return {
      id,
      value: '',
      innerHTML: '',
      open: false,
      listeners: {},
      addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      },
      dispatchEvent(event) {
        const fns = this.listeners[event.type] || [];
        fns.forEach(fn => fn(event));
      },
      click() {
        this.dispatchEvent({ type: 'click' });
      },
      close() { this.open = false; },
      showModal() { this.open = true; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      querySelectorAll() { return []; }
    };
  }

  const elements = {
    fusionArcQaModal: createMockEl('fusionArcQaModal'),
    closeFusionArcQaBtn: createMockEl('closeFusionArcQaBtn'),
    fusionArcPresetSelect: createMockEl('fusionArcPresetSelect'),
    fusionArcSplicerSelect: createMockEl('fusionArcSplicerSelect'),
    fusionArcFiberTypeSelect: createMockEl('fusionArcFiberTypeSelect'),
    fusionArcSerialInput: createMockEl('fusionArcSerialInput'),
    fusionArcLocationInput: createMockEl('fusionArcLocationInput'),
    fusionArcTechnicianInput: createMockEl('fusionArcTechnicianInput'),
    fusionArcDischargeInput: createMockEl('fusionArcDischargeInput'),
    fusionArcTempInput: createMockEl('fusionArcTempInput'),
    fusionArcPressureInput: createMockEl('fusionArcPressureInput'),
    fusionArcHumidityInput: createMockEl('fusionArcHumidityInput'),
    fusionArcOffsetXInput: createMockEl('fusionArcOffsetXInput'),
    fusionArcOffsetYInput: createMockEl('fusionArcOffsetYInput'),
    fusionArcCleaveLeftInput: createMockEl('fusionArcCleaveLeftInput'),
    fusionArcCleaveRightInput: createMockEl('fusionArcCleaveRightInput'),
    fusionArcProofTensionInput: createMockEl('fusionArcProofTensionInput'),
    fusionArcProofStatusSelect: createMockEl('fusionArcProofStatusSelect'),
    fusionArcBubblePenaltyInput: createMockEl('fusionArcBubblePenaltyInput'),
    fusionArcNotesInput: createMockEl('fusionArcNotesInput'),
    fusionArcSvgContainer: createMockEl('fusionArcSvgContainer'),
    fusionArcHudRibbon: createMockEl('fusionArcHudRibbon'),
    fusionArcHistoryTable: createMockEl('fusionArcHistoryTable'),
    fusionArcHistoryTbody: createMockEl('fusionArcHistoryTbody'),
    fusionArcSearchInput: createMockEl('fusionArcSearchInput'),
    fusionArcStatusFilterSelect: createMockEl('fusionArcStatusFilterSelect'),
    saveFusionArcCertBtn: createMockEl('saveFusionArcCertBtn'),
    printFusionArcStandardBtn: createMockEl('printFusionArcStandardBtn'),
    printFusionArcThermalBtn: createMockEl('printFusionArcThermalBtn'),
    whatsAppFusionArcBtn: createMockEl('whatsAppFusionArcBtn'),
    exportFusionArcCsvBtn: createMockEl('exportFusionArcCsvBtn')
  };

  elements.fusionArcSplicerSelect.value = 'FUJIKURA_90S';
  elements.fusionArcFiberTypeSelect.value = 'G652D';
  elements.fusionArcDischargeInput.value = '450';
  elements.fusionArcTempInput.value = '22';
  elements.fusionArcPressureInput.value = '1012';
  elements.fusionArcHumidityInput.value = '45';
  elements.fusionArcOffsetXInput.value = '0.12';
  elements.fusionArcOffsetYInput.value = '0.08';
  elements.fusionArcCleaveLeftInput.value = '0.4';
  elements.fusionArcCleaveRightInput.value = '0.5';
  elements.fusionArcProofTensionInput.value = '2.10';
  elements.fusionArcProofStatusSelect.value = 'PASSED_TENSILE_VERIFIED';

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toastLog = [];
  try {
    const controller = setupFusionArcQaModal({
      storage: mockStorage,
      onToast: (msg) => toastLog.push(msg)
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.populateCustomer, 'function');
    assert.equal(typeof controller.renderHistory, 'function');

    assert.ok(elements.fusionArcSvgContainer.innerHTML.includes('<svg'));
    assert.ok(elements.fusionArcHudRibbon.innerHTML.includes('Estimated Joint Loss'));

    // Save action
    elements.saveFusionArcCertBtn.click();
    assert.ok(toastLog.some(msg => msg.includes('saved successfully')));

    // Close button
    elements.closeFusionArcQaBtn.click();
    assert.equal(elements.fusionArcQaModal.open, false);
  } finally {
    globalThis.document = origDoc;
  }
});

// ============================================================================
// Optical Fiber Coating Stripping Mechanical Force & Cladding Scratch QA Suite
// Standards: IEC 60793-1-32, Telcordia GR-20-CORE Issue 4, TIA-455-178-B
// ============================================================================

test('STRIPPER_TOOLS, FIBER_COATING_TYPES, STRIP_QA_VERDICTS, and STRIP_FORCE_PRESETS contain accurate metrology parameters', async () => {
  const { STRIPPER_TOOLS, FIBER_COATING_TYPES, STRIP_QA_VERDICTS, STRIP_FORCE_PRESETS } = await import('../form-validation.js');

  assert.ok(STRIPPER_TOOLS['MILLER_CFS3']);
  assert.ok(STRIPPER_TOOLS['FUJIKURA_RS03']);
  assert.ok(STRIPPER_TOOLS['SUMITOMO_JR6']);
  assert.ok(STRIPPER_TOOLS['PROSKIT_8PK326']);
  assert.ok(STRIPPER_TOOLS['LOCAL_ECONOMY_TOOL']);

  assert.equal(STRIPPER_TOOLS['MILLER_CFS3'].targetNotchUm, 140.0);
  assert.equal(STRIPPER_TOOLS['FUJIKURA_RS03'].type, 'Thermal Heated Blade Stripper');

  assert.ok(FIBER_COATING_TYPES['DUAL_ACRYLATE_250']);
  assert.ok(FIBER_COATING_TYPES['BEND_INSENSITIVE_250']);
  assert.ok(FIBER_COATING_TYPES['COMPACT_COATING_200']);
  assert.ok(FIBER_COATING_TYPES['TIGHT_BUFFER_900']);

  assert.equal(FIBER_COATING_TYPES['DUAL_ACRYLATE_250'].telcordiaMinForceN, 1.3);
  assert.equal(FIBER_COATING_TYPES['DUAL_ACRYLATE_250'].telcordiaMaxForceN, 8.9);

  assert.ok(STRIP_QA_VERDICTS['GRADE_A_PRISTINE'].isCompliant);
  assert.ok(STRIP_QA_VERDICTS['COMMERCIAL_PASS'].isCompliant);
  assert.ok(!STRIP_QA_VERDICTS['FAILED_HIGH_FORCE_GOUGE'].isCompliant);
  assert.ok(!STRIP_QA_VERDICTS['FAILED_LOW_ADHESION_DELAMINATION'].isCompliant);

  assert.ok(STRIP_FORCE_PRESETS.PRESET_MILLER_CFS3_STANDARD_PASS);
  assert.ok(STRIP_FORCE_PRESETS.PRESET_FUJIKURA_RS03_THERMAL_PERFECT);
  assert.ok(STRIP_FORCE_PRESETS.PRESET_DULL_BLADE_CLADDING_GOUGE);
  assert.ok(STRIP_FORCE_PRESETS.PRESET_WEATHERED_DROP_CABLE_HARDENED);
  assert.ok(STRIP_FORCE_PRESETS.PRESET_DEFECTIVE_LOOSE_JACKET_DELAMINATION);
});

test('calculateGriffithFractureStrength evaluates breaking strength degradation from micro-scratches accurately', async () => {
  const { calculateGriffithFractureStrength } = await import('../form-validation.js');

  // Case 1: Pristine surface (depth 0nm)
  const res0 = calculateGriffithFractureStrength(0);
  assert.equal(res0.flawDepthNm, 0);
  assert.equal(res0.breakingStressMpa, 4800.0);
  assert.equal(res0.breakingStressGpa, 4.80);
  assert.equal(res0.strengthRetentionPercent, 100.0);
  assert.equal(res0.severity, 'PRISTINE_NO_FLAWS');

  // Case 2: Shallow micro-scuff (50nm depth)
  // sigma_f = 0.75 / (1.12 * sqrt(50e-9)) = 0.75 / (1.12 * 2.236e-4) = 0.75 / 2.504e-4 ~ 2994.8 MPa
  const resShallow = calculateGriffithFractureStrength(50);
  assert.ok(resShallow.breakingStressMpa > 2900 && resShallow.breakingStressMpa < 3100);
  assert.equal(resShallow.severity, 'MODERATE_FLAW');

  // Case 3: Deep cladding gouge (450nm depth)
  // sigma_f = 0.75 / (1.12 * sqrt(450e-9)) = 0.75 / (1.12 * 6.708e-4) = 0.75 / 7.513e-4 ~ 998.2 MPa
  const resDeep = calculateGriffithFractureStrength(450);
  assert.ok(resDeep.breakingStressMpa < 1200);
  assert.ok(resDeep.breakingStressGpa < 1.20);
  assert.ok(resDeep.strengthRetentionPercent < 25.0);
});

test('evaluateStripForceQa correctly classifies Grade A, Commercial Pass, and Failures', async () => {
  const { evaluateStripForceQa } = await import('../form-validation.js');

  // Grade A Pass
  const resA = evaluateStripForceQa({
    toolId: 'MILLER_CFS3',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    measuredNotchUm: 140.0,
    peakForceN: 3.2,
    residueScore: 5,
    hasVisibleScratches: false
  });

  assert.equal(resA.verdict.id, 'GRADE_A_PRISTINE');
  assert.ok(resA.isApproved);
  assert.equal(resA.radialClearanceUm, 7.5); // (140 - 125) / 2 = 7.5
  assert.equal(resA.notchStatus, 'OPTIMAL_CLEARANCE');

  // Commercial Pass (near bounds, force 6.5 N)
  const resComm = evaluateStripForceQa({
    toolId: 'PROSKIT_8PK326',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    measuredNotchUm: 138.0,
    peakForceN: 6.5,
    residueScore: 3,
    hasVisibleScratches: false
  });

  assert.equal(resComm.verdict.id, 'COMMERCIAL_PASS');
  assert.ok(resComm.isApproved);

  // Failure: Low force / delamination (force 0.8 N < 1.3 N min)
  const resDelam = evaluateStripForceQa({
    toolId: 'MILLER_CFS3',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    peakForceN: 0.8,
    residueScore: 4
  });

  assert.equal(resDelam.verdict.id, 'FAILED_LOW_ADHESION_DELAMINATION');
  assert.ok(!resDelam.isApproved);

  // Failure: High force / weathered (force 11.2 N > 8.9 N max)
  const resHighForce = evaluateStripForceQa({
    toolId: 'PROSKIT_8PK326',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    peakForceN: 11.2
  });

  assert.equal(resHighForce.verdict.id, 'FAILED_HIGH_FORCE_GOUGE');
  assert.ok(!resHighForce.isApproved);
});

test('evaluateStripForceQa detects narrow blade notch collision hazards and gouges', async () => {
  const { evaluateStripForceQa } = await import('../form-validation.js');

  const resCollision = evaluateStripForceQa({
    toolId: 'LOCAL_ECONOMY_TOOL',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    measuredNotchUm: 126.0,
    peakForceN: 5.5,
    hasVisibleScratches: true,
    estimatedFlawDepthNm: 350
  });

  assert.equal(resCollision.notchStatus, 'COLLISION_HAZARD');
  assert.equal(resCollision.radialClearanceUm, 0.5); // (126 - 125) / 2 = 0.5
  assert.equal(resCollision.verdict.id, 'FAILED_HIGH_FORCE_GOUGE');
  assert.ok(!resCollision.isApproved);
});

test('renderStripForceAnalysisSvg renders clean vector SVG markup with force gauges and callouts', async () => {
  const { evaluateStripForceQa, renderStripForceAnalysisSvg } = await import('../form-validation.js');

  const evaluation = evaluateStripForceQa({
    toolId: 'MILLER_CFS3',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    measuredNotchUm: 140.0,
    peakForceN: 3.5,
    stripLengthMm: 35.0,
    residueScore: 5
  });

  const svg = renderStripForceAnalysisSvg(evaluation, { width: 760, height: 360 });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('OPTICAL FIBER STRIPPING TRANSITION'));
  assert.ok(svg.includes('250µm Jacket'));
  assert.ok(svg.includes('125µm Bare Glass'));
  assert.ok(svg.includes('TELCORDIA GR-20 PEAK STRIPPING FORCE'));
  assert.ok(svg.includes('V-Notch (140µm)'));
  assert.ok(svg.includes('GRIFFITH BREAKING STRENGTH'));

  // Test empty fallback
  const emptySvg = renderStripForceAnalysisSvg(null);
  assert.ok(emptySvg.includes('No Strip Force QA Data'));
});

test('buildStripForceRecord and generateStripForceCertId construct immutable structured records', async () => {
  const { buildStripForceRecord, generateStripForceCertId } = await import('../form-validation.js');

  const id = generateStripForceCertId('2026-10-17T04:00:00Z');
  assert.match(id, /^STR-202610-\d{4}$/);

  const record = buildStripForceRecord({
    customer: { id: 'cust-50', name: 'Nawazish Ali', phone: '03005544332', mohalla: 'Kot Mohibbu' },
    toolId: 'MILLER_CFS3',
    stripperSerialNumber: 'CFS3-99881',
    measuredNotchUm: 140.0,
    peakForceN: 3.2,
    technicianName: 'Farhan Splicing Tech',
    notes: 'Clean stripped fiber for mechanical splice.'
  });

  assert.ok(record.id.startsWith('STR-'));
  assert.equal(record.customerName, 'Nawazish Ali');
  assert.equal(record.technicianName, 'Farhan Splicing Tech');
  assert.equal(record.status, 'ACTIVE_CERTIFIED');
  assert.equal(record.evaluation.stripperSerialNumber, 'CFS3-99881');
});

test('generateStripForceCertHtml produces formal A4 and 80mm thermal receipt slips', async () => {
  const { buildStripForceRecord, generateStripForceCertHtml } = await import('../form-validation.js');

  const record = buildStripForceRecord({
    customer: { id: 'cust-15', name: 'Sheikh Tanveer', phone: '03001122334', mohalla: 'Jia Musa' },
    toolId: 'MILLER_CFS3',
    peakForceN: 3.4,
    location: 'Jia Musa Commercial Ring FAT-01'
  });

  // Standard A4
  const a4Html = generateStripForceCertHtml(record, { format: 'standard' });
  assert.ok(a4Html.includes('strip-force-qa-sheet'));
  assert.ok(a4Html.includes('Shahdara ISP Network Operations'));
  assert.ok(a4Html.includes('شاہدرہ آپٹیکل فائبر کوٹنگ اسٹرپنگ فورس و گلاس کوالٹی سرٹیفکیٹ'));
  assert.ok(a4Html.includes('Sheikh Tanveer'));
  assert.ok(a4Html.includes('Jia Musa Commercial Ring FAT-01'));
  assert.ok(a4Html.includes('Peak Stripping Force (F_peak)'));

  // Thermal 80mm
  const thermalHtml = generateStripForceCertHtml(record, { format: 'thermal' });
  assert.ok(thermalHtml.includes('strip-force-thermal-slip'));
  assert.ok(thermalHtml.includes('FIBER STRIP FORCE QA SLIP'));
  assert.ok(thermalHtml.includes('PEAK STRIP FORCE:'));
});

test('formatStripForceCertWhatsApp formats bilingual Urdu/English technician dispatch text', async () => {
  const { buildStripForceRecord, formatStripForceCertWhatsApp } = await import('../form-validation.js');

  const record = buildStripForceRecord({
    customer: { id: 'cust-30', name: 'Haji Rafiq', phone: '03219988776', mohalla: 'Vandala Road' },
    toolId: 'MILLER_CFS3',
    stripperSerialNumber: 'CFS3-11092',
    location: 'Vandala Road FAT Joint #03',
    peakForceN: 3.2,
    measuredNotchUm: 140.0
  });

  const waText = formatStripForceCertWhatsApp(record);
  assert.ok(waText.includes('SHAHDARA ISP · FIBER STRIP FORCE QA CERTIFICATE'));
  assert.ok(waText.includes('آپٹیکل فائبر کوٹنگ اسٹرپنگ فورس و کوالٹی رپورٹ'));
  assert.ok(waText.includes('CFS3-11092'));
  assert.ok(waText.includes('Vandala Road FAT Joint #03'));
  assert.ok(waText.includes('پیک اسٹرپ فورس (Peak Force): *3.2 N*'));
  assert.ok(waText.includes('✅'));

  // Null input handles gracefully
  assert.equal(formatStripForceCertWhatsApp(null), '');
});

test('generateStripForceCertsCsv exports RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildStripForceRecord, generateStripForceCertsCsv } = await import('../form-validation.js');

  const r1 = buildStripForceRecord({
    customer: { id: 'c1', name: 'Zia Ul Haq', mohalla: 'Baradari' },
    toolId: 'MILLER_CFS3',
    stripperSerialNumber: 'CFS3-44120',
    peakForceN: 3.2,
    notes: 'Pristine 0 residue.'
  });

  const r2 = buildStripForceRecord({
    customer: { id: 'c2', name: 'Khalid Mehmood', mohalla: 'Begum Kot' },
    toolId: 'LOCAL_ECONOMY_TOOL',
    stripperSerialNumber: 'GEN-8812',
    peakForceN: 7.9,
    hasVisibleScratches: true,
    estimatedFlawDepthNm: 350,
    notes: 'Blade gouged cladding, blade dull.'
  });

  const csv = generateStripForceCertsCsv([r1, r2]);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('Certificate_ID,Created_At,Customer_Name'));
  assert.ok(csv.includes('Zia Ul Haq'));
  assert.ok(csv.includes('Khalid Mehmood'));
  assert.ok(csv.includes('CFS3-44120'));
  assert.ok(csv.includes('"Blade gouged cladding, blade dull."'));
});

test('LocalStorage persistence methods and calculateStripForceMetrics aggregate audit data', async () => {
  const {
    STRIP_FORCE_QA_STORAGE_KEY,
    getSavedStripForceCerts,
    saveStripForceCert,
    updateStripForceCertStatus,
    clearStripForceCerts,
    calculateStripForceMetrics,
    buildStripForceRecord
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  assert.deepEqual(getSavedStripForceCerts(mockStorage), []);

  const r1 = buildStripForceRecord({
    id: 'STR-202610-1001',
    toolId: 'MILLER_CFS3',
    peakForceN: 3.2,
    hasVisibleScratches: false
  });

  const r2 = buildStripForceRecord({
    id: 'STR-202610-1002',
    toolId: 'LOCAL_ECONOMY_TOOL',
    peakForceN: 8.5,
    hasVisibleScratches: true,
    estimatedFlawDepthNm: 400
  });

  saveStripForceCert(r1, mockStorage);
  saveStripForceCert(r2, mockStorage);

  const list = getSavedStripForceCerts(mockStorage);
  assert.equal(list.length, 2);

  // Update status
  updateStripForceCertStatus('STR-202610-1002', 'RESOLVED_REPLACED_TOOL', mockStorage);
  const updatedList = getSavedStripForceCerts(mockStorage);
  const updatedItem = updatedList.find(r => r.id === 'STR-202610-1002');
  assert.equal(updatedItem.status, 'RESOLVED_REPLACED_TOOL');

  // Metrics calculation
  const metrics = calculateStripForceMetrics(updatedList);
  assert.equal(metrics.totalInspections, 2);
  assert.equal(metrics.gradeACount, 1);
  assert.equal(metrics.rejectedCount, 1);
  assert.equal(metrics.scratchedCount, 1);
  assert.equal(metrics.complianceRatePercent, 50.0);

  // Clear
  clearStripForceCerts(mockStorage);
  assert.deepEqual(getSavedStripForceCerts(mockStorage), []);
});

test('setupStripForceQaModal initializes controller and binds DOM mock elements', async () => {
  const { setupStripForceQaModal } = await import('../form-validation.js');

  function createMockEl(id) {
    return {
      id,
      value: '',
      innerHTML: '',
      open: false,
      listeners: {},
      addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      },
      dispatchEvent(event) {
        const fns = this.listeners[event.type] || [];
        fns.forEach(fn => fn(event));
      },
      click() {
        this.dispatchEvent({ type: 'click' });
      },
      close() { this.open = false; },
      showModal() { this.open = true; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; },
      querySelectorAll() { return []; }
    };
  }

  const elements = {
    stripForceQaModal: createMockEl('stripForceQaModal'),
    closeStripForceQaBtn: createMockEl('closeStripForceQaBtn'),
    stripForcePresetSelect: createMockEl('stripForcePresetSelect'),
    stripForceToolSelect: createMockEl('stripForceToolSelect'),
    stripForceCoatingSelect: createMockEl('stripForceCoatingSelect'),
    stripForceSerialInput: createMockEl('stripForceSerialInput'),
    stripForceLocationInput: createMockEl('stripForceLocationInput'),
    stripForceTechnicianInput: createMockEl('stripForceTechnicianInput'),
    stripForcePeakForceInput: createMockEl('stripForcePeakForceInput'),
    stripForceNotchInput: createMockEl('stripForceNotchInput'),
    stripForceLengthInput: createMockEl('stripForceLengthInput'),
    stripForceResidueSelect: createMockEl('stripForceResidueSelect'),
    stripForceScratchSelect: createMockEl('stripForceScratchSelect'),
    stripForceFlawDepthInput: createMockEl('stripForceFlawDepthInput'),
    stripForceNotesInput: createMockEl('stripForceNotesInput'),
    stripForceSvgContainer: createMockEl('stripForceSvgContainer'),
    stripForceHudRibbon: createMockEl('stripForceHudRibbon'),
    stripForceHistoryTable: createMockEl('stripForceHistoryTable'),
    stripForceHistoryTbody: createMockEl('stripForceHistoryTbody'),
    stripForceSearchInput: createMockEl('stripForceSearchInput'),
    stripForceStatusFilterSelect: createMockEl('stripForceStatusFilterSelect'),
    saveStripForceCertBtn: createMockEl('saveStripForceCertBtn'),
    printStripForceStandardBtn: createMockEl('printStripForceStandardBtn'),
    printStripForceThermalBtn: createMockEl('printStripForceThermalBtn'),
    whatsAppStripForceBtn: createMockEl('whatsAppStripForceBtn'),
    exportStripForceCsvBtn: createMockEl('exportStripForceCsvBtn')
  };

  elements.stripForceToolSelect.value = 'MILLER_CFS3';
  elements.stripForceCoatingSelect.value = 'DUAL_ACRYLATE_250';
  elements.stripForcePeakForceInput.value = '3.2';
  elements.stripForceNotchInput.value = '140.0';
  elements.stripForceLengthInput.value = '35';
  elements.stripForceResidueSelect.value = '5';
  elements.stripForceScratchSelect.value = 'NO';

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toastLog = [];
  try {
    const controller = setupStripForceQaModal({
      storage: mockStorage,
      onToast: (msg) => toastLog.push(msg)
    });

    assert.ok(controller);
    assert.equal(typeof controller.recalculate, 'function');
    assert.equal(typeof controller.populateCustomer, 'function');
    assert.equal(typeof controller.renderHistory, 'function');

    assert.ok(elements.stripForceSvgContainer.innerHTML.includes('<svg'));
    assert.ok(elements.stripForceHudRibbon.innerHTML.includes('Peak Stripping Force'));

    // Save action
    elements.saveStripForceCertBtn.click();
    assert.ok(toastLog.some(msg => msg.includes('saved successfully')));

    // Close button
    elements.closeStripForceQaBtn.click();
    assert.equal(elements.stripForceQaModal.open, false);
  } finally {
    globalThis.document = origDoc;
  }
});

// ============================================================================
// OPTICAL FIBER FUSION SPLICE CORE ALIGNMENT, MFD & LATERAL OFFSET QA SUITE TESTS
// ============================================================================

test('qa-splice-mfd-offset constants and lookup structures are well-formed', async () => {
  const {
    FIBER_PROFILES,
    SPLICER_ALIGNMENT_TYPES,
    OPERATING_WAVELENGTHS,
    TELCORDIA_SPLICE_VERDICTS,
    SHAH_SPLICE_PRESETS
  } = await import('../form-validation.js');

  // Verify fiber profiles
  assert.ok(FIBER_PROFILES.ITU_G652D);
  assert.equal(FIBER_PROFILES.ITU_G652D.nominalCoreDiameterUm, 8.2);
  assert.equal(FIBER_PROFILES.ITU_G652D.nominalMfd1310Um, 9.2);
  assert.equal(FIBER_PROFILES.ITU_G652D.nominalMfd1550Um, 10.4);

  assert.ok(FIBER_PROFILES.ITU_G657A2);
  assert.equal(FIBER_PROFILES.ITU_G657A2.nominalMfd1310Um, 8.6);

  assert.ok(FIBER_PROFILES.ITU_G655_NZDSF);
  assert.equal(FIBER_PROFILES.ITU_G655_NZDSF.nominalMfd1550Um, 8.4);

  assert.ok(FIBER_PROFILES.LEGACY_AERIAL);
  assert.equal(FIBER_PROFILES.LEGACY_AERIAL.typicalConcentricityErrorUm, 0.85);

  // Splicer alignment technologies
  assert.ok(SPLICER_ALIGNMENT_TYPES.CORE_PAS);
  assert.equal(SPLICER_ALIGNMENT_TYPES.CORE_PAS.eccentricityCompensationFactor, 0.10);
  assert.ok(SPLICER_ALIGNMENT_TYPES.FIXED_VGROOVE);
  assert.equal(SPLICER_ALIGNMENT_TYPES.FIXED_VGROOVE.eccentricityCompensationFactor, 1.00);

  // Wavelengths
  assert.ok(OPERATING_WAVELENGTHS['1310']);
  assert.ok(OPERATING_WAVELENGTHS['1550']);
  assert.ok(OPERATING_WAVELENGTHS['1490']);
  assert.ok(OPERATING_WAVELENGTHS['1577']);

  // Telcordia verdicts
  assert.equal(TELCORDIA_SPLICE_VERDICTS.GRADE_A_EXCELLENT.maxLossDb, 0.03);
  assert.equal(TELCORDIA_SPLICE_VERDICTS.GRADE_B_PASS.maxLossDb, 0.08);
  assert.equal(TELCORDIA_SPLICE_VERDICTS.GRADE_C_CONDITIONAL.maxLossDb, 0.15);
  assert.equal(TELCORDIA_SPLICE_VERDICTS.REJECT_RESPLICE_MANDATED.code, 'REJECT');

  // Presets
  assert.ok(SHAH_SPLICE_PRESETS.BARADARI_NOC_TRUNK);
  assert.ok(SHAH_SPLICE_PRESETS.VANDALA_DROP_TRANSITION);
  assert.ok(SHAH_SPLICE_PRESETS.BEGUM_KOT_HIGH_TILT_FAIL);
});

test('calculateMfdMismatchLoss correctly applies Gaussian Marcuse formulation', async () => {
  const { calculateMfdMismatchLoss } = await import('../form-validation.js');

  // Identical MFD -> 0 dB
  assert.equal(calculateMfdMismatchLoss(9.2, 9.2), 0);
  assert.equal(calculateMfdMismatchLoss(10.4, 10.4), 0);

  // Symmetry: L(w1, w2) === L(w2, w1)
  const lossForward = calculateMfdMismatchLoss(9.2, 10.4);
  const lossReverse = calculateMfdMismatchLoss(10.4, 9.2);
  assert.ok(lossForward > 0);
  assert.equal(lossForward, lossReverse);

  // Substantial MFD difference: 7.8 vs 10.4
  const largeLoss = calculateMfdMismatchLoss(7.8, 10.4);
  assert.ok(largeLoss > lossForward);
  assert.ok(largeLoss > 0.05);

  // Boundary checks: 0 or negative
  assert.equal(calculateMfdMismatchLoss(0, 9.2), 0);
  assert.equal(calculateMfdMismatchLoss(-5, 9.2), 0);
});

test('calculateLateralOffsetLoss correctly computes quadratic radial displacement penalty', async () => {
  const { calculateLateralOffsetLoss } = await import('../form-validation.js');

  // Zero offset -> 0 loss
  assert.equal(calculateLateralOffsetLoss(0, 9.2, 9.2), 0);

  // Small offset 0.1 µm
  const loss01 = calculateLateralOffsetLoss(0.1, 9.2, 9.2);
  assert.ok(loss01 > 0);
  assert.ok(loss01 < 0.01);

  // Doubling offset quadruples loss (quadratic d^2)
  const loss02 = calculateLateralOffsetLoss(0.2, 9.2, 9.2);
  const ratio = loss02 / loss01;
  assert.ok(Math.abs(ratio - 4.0) < 0.2);

  // Severe offset 1.0 µm
  const loss10 = calculateLateralOffsetLoss(1.0, 9.2, 9.2);
  assert.ok(loss10 > 0.15); // > 0.15 dB reject threshold
});

test('calculateAngularTiltLoss computes cleave angle misalignment with wavelength scaling', async () => {
  const { calculateAngularTiltLoss } = await import('../form-validation.js');

  // Zero tilt -> 0 loss
  assert.equal(calculateAngularTiltLoss(0, 9.2, 9.2, 1310), 0);

  // Small tilt 0.25 deg
  const loss1310 = calculateAngularTiltLoss(0.25, 9.2, 9.2, 1310);
  assert.ok(loss1310 > 0);
  assert.ok(loss1310 < 0.03);

  // At longer wavelength (1550nm vs 1310nm), angular tilt loss decreases as 1 / lambda^2
  const loss1550 = calculateAngularTiltLoss(0.25, 9.2, 9.2, 1550);
  assert.ok(loss1550 < loss1310);

  // Excessive tilt 2.0 deg
  const lossHigh = calculateAngularTiltLoss(2.0, 9.2, 9.2, 1310);
  assert.ok(lossHigh > 0.15); // Out of spec
});

test('calculateNetCoreOffset distinguishes Core PAS compensation from Fixed V-Groove', async () => {
  const { calculateNetCoreOffset } = await import('../form-validation.js');

  // With Core PAS: 90% of eccentricity is compensated
  const pasOffset = calculateNetCoreOffset({
    leftEccentricityUm: 0.85,
    rightEccentricityUm: 0.35,
    splicerType: 'CORE_PAS',
    residualOffsetUm: 0.10,
    alignmentAngleDeg: 60
  });

  // With Fixed V-Groove: full eccentricity vector difference remains
  const vgrooveOffset = calculateNetCoreOffset({
    leftEccentricityUm: 0.85,
    rightEccentricityUm: 0.35,
    splicerType: 'FIXED_VGROOVE',
    residualOffsetUm: 0.10,
    alignmentAngleDeg: 60
  });

  assert.ok(pasOffset < vgrooveOffset);
  assert.ok(vgrooveOffset > 0.5);
  assert.ok(pasOffset < 0.2);
});

test('determineSpliceQualityVerdict classifies Telcordia GR-765-CORE thresholds', async () => {
  const { determineSpliceQualityVerdict } = await import('../form-validation.js');

  const gradeA = determineSpliceQualityVerdict(0.021);
  assert.equal(gradeA.code, 'GRADE_A');

  const gradeB = determineSpliceQualityVerdict(0.065);
  assert.equal(gradeB.code, 'GRADE_B');

  const gradeC = determineSpliceQualityVerdict(0.125);
  assert.equal(gradeC.code, 'GRADE_C');

  const reject = determineSpliceQualityVerdict(0.210);
  assert.equal(reject.code, 'REJECT');
});

test('evaluateSpliceLoss performs full joint decomposition across presets', async () => {
  const { evaluateSpliceLoss } = await import('../form-validation.js');

  // Baradari NOC Trunk (Grade A)
  const baradari = evaluateSpliceLoss({
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    wavelength: '1310',
    leftEccentricityUm: 0.20,
    rightEccentricityUm: 0.20,
    tiltAngleDeg: 0.25,
    alignmentAngleDeg: 30,
    residualOffsetUm: 0.08
  });

  assert.equal(baradari.isIdenticalFibers, true);
  assert.equal(baradari.lossMfdDb, 0);
  assert.ok(baradari.totalLossDb <= 0.03);
  assert.equal(baradari.verdict.code, 'GRADE_A');
  assert.equal(baradari.isTelcordiaCompliant, true);

  // Dissimilar Fiber Transition: G.655 NZ-DSF to G.652.D
  const dissimilar = evaluateSpliceLoss({
    leftFiberType: 'ITU_G655_NZDSF',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    wavelength: '1550',
    leftEccentricityUm: 0.22,
    rightEccentricityUm: 0.25,
    tiltAngleDeg: 0.30
  });

  assert.equal(dissimilar.isIdenticalFibers, false);
  assert.ok(dissimilar.lossMfdDb > 0.02);
  assert.equal(dissimilar.dominantFactor, 'MFD_MISMATCH');

  // High Tilt Defect Splicing
  const highTilt = evaluateSpliceLoss({
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'ACTIVE_CLAD',
    tiltAngleDeg: 1.85
  });

  assert.ok(highTilt.totalLossDb > 0.15);
  assert.equal(highTilt.verdict.code, 'REJECT');
  assert.equal(highTilt.isTelcordiaCompliant, false);
  assert.equal(highTilt.dominantFactor, 'ANGULAR_TILT');
});

test('validateSpliceMfdOffset enforces valid types, angles, and eccentricity boundaries', async () => {
  const { validateSpliceMfdOffset } = await import('../form-validation.js');

  const valid = validateSpliceMfdOffset({
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G657A1',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 0.45,
    leftEccentricityUm: 0.30,
    rightEccentricityUm: 0.25
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  const badFiber = validateSpliceMfdOffset({
    leftFiberType: 'UNKNOWN_PLASTIC_FIBER',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 0.45
  });
  assert.equal(badFiber.isValid, false);
  assert.ok(badFiber.errors.leftFiberType);

  const badTilt = validateSpliceMfdOffset({
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 15.0
  });
  assert.equal(badTilt.isValid, false);
  assert.ok(badTilt.errors.tiltAngleDeg);
});

test('buildSpliceMfdOffsetRecord constructs structured immutable record with SMFD prefix', async () => {
  const { buildSpliceMfdOffsetRecord } = await import('../form-validation.js');

  const record = buildSpliceMfdOffsetRecord({
    customer: {
      id: 'cust-101',
      name: 'Tariq Butt',
      phone: '0301-7654321',
      zone: 'Vandala Road'
    },
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G657A2',
    splicerType: 'ACTIVE_CLAD',
    wavelength: '1490',
    tiltAngleDeg: 0.35,
    technicianName: 'Sajjad Ali',
    location: 'FAT-09 Pole Mount'
  });

  assert.ok(record.id.startsWith('SMFD-'));
  assert.equal(record.customer.name, 'Tariq Butt');
  assert.equal(record.leftFiberType, 'ITU_G652D');
  assert.equal(record.rightFiberType, 'ITU_G657A2');
  assert.ok(record.totalLossDb >= 0);
  assert.ok(record.createdAt);
  assert.ok(record.verdict.code);
});

test('renderSpliceMfdOffsetSvg outputs valid pure-vector SVG markup', async () => {
  const { evaluateSpliceLoss, renderSpliceMfdOffsetSvg } = await import('../form-validation.js');

  const analysis = evaluateSpliceLoss({
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G657A2',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 0.45
  });

  const svg = renderSpliceMfdOffsetSvg(analysis);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 760 340"'));
  assert.ok(svg.includes('id="leftFiber"'));
  assert.ok(svg.includes('id="rightFiber"'));
  assert.ok(svg.includes('Joint Interface'));
  assert.ok(svg.includes('α_MFD:'));
  assert.ok(svg.includes('α_Offset:'));
  assert.ok(svg.includes('α_Tilt:'));
  assert.ok(svg.includes('</svg>'));
});

test('generateSpliceMfdOffsetCertHtml produces formal A4 and 80mm thermal POS formats', async () => {
  const { buildSpliceMfdOffsetRecord, generateSpliceMfdOffsetCertHtml } = await import('../form-validation.js');

  const record = buildSpliceMfdOffsetRecord({
    customer: { name: 'Chaudhry Akram', phone: '0321-4455667', zone: 'Jia Musa' },
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G657A1',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 0.25,
    technicianName: 'Engr. Imran Malik',
    location: 'Jia Musa Commercial Joint #03'
  });

  // A4 formal accreditation
  const a4Html = generateSpliceMfdOffsetCertHtml(record, { format: 'A4' });
  assert.ok(a4Html.includes('FUSION SPLICE CORE GEOMETRY & LOSS ACCREDITATION'));
  assert.ok(a4Html.includes('SHAHDARA BROADBAND FIBER NETWORK'));
  assert.ok(a4Html.includes(record.id));
  assert.ok(a4Html.includes('ITU-T G.650.1 / GR-765-CORE'));
  assert.ok(a4Html.includes('Chaudhry Akram'));
  assert.ok(a4Html.includes('Total Modeled Loss'));

  // 80mm POS Thermal Slip
  const posHtml = generateSpliceMfdOffsetCertHtml(record, { format: 'POS' });
  assert.ok(posHtml.includes('80mm auto'));
  assert.ok(posHtml.includes('FUSION SPLICE QA SLIP'));
  assert.ok(posHtml.includes(record.id));
  assert.ok(posHtml.includes('α_MFD:'));
  assert.ok(posHtml.includes('KEEP FOR JOINT RECORDS'));
});

test('formatSpliceMfdOffsetCertWhatsApp produces bilingual Urdu & English technician dispatch notice', async () => {
  const { buildSpliceMfdOffsetRecord, formatSpliceMfdOffsetCertWhatsApp } = await import('../form-validation.js');

  const record = buildSpliceMfdOffsetRecord({
    customer: { name: 'Dr. Zahid', zone: 'Baradari' },
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    tiltAngleDeg: 0.20,
    technicianName: 'Muhammad Rizwan',
    location: 'Baradari Feeder FAT #01'
  });

  const text = formatSpliceMfdOffsetCertWhatsApp(record);
  assert.ok(text.includes('SHAHDARA FIBER NET - FUSION SPLICE QA CERTIFICATE'));
  assert.ok(text.includes(record.id));
  assert.ok(text.includes('Muhammad Rizwan'));
  assert.ok(text.includes('TOTAL INSERTION LOSS:'));
  assert.ok(text.includes('اردو رزلٹ:'));
  assert.ok(text.includes('042-37900000'));
});

test('generateSpliceMfdOffsetCertsCsv generates compliant RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildSpliceMfdOffsetRecord, generateSpliceMfdOffsetCertsCsv } = await import('../form-validation.js');

  const r1 = buildSpliceMfdOffsetRecord({ location: 'Site Alpha', leftFiberType: 'ITU_G652D', rightFiberType: 'ITU_G652D' });
  const r2 = buildSpliceMfdOffsetRecord({ location: 'Site Beta, with comma', leftFiberType: 'ITU_G652D', rightFiberType: 'ITU_G657A2' });

  const csv = generateSpliceMfdOffsetCertsCsv([r1, r2]);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('Certificate ID,Date,Customer Name'));
  assert.ok(csv.includes(r1.id));
  assert.ok(csv.includes('"Site Beta, with comma"')); // RFC-4180 quoting
});

test('localStorage CRUD operations and calculateSpliceMfdOffsetMetrics function accurately', async () => {
  const {
    buildSpliceMfdOffsetRecord,
    getSavedSpliceMfdOffsetCerts,
    saveSpliceMfdOffsetCert,
    updateSpliceMfdOffsetCertStatus,
    clearSpliceMfdOffsetCerts,
    calculateSpliceMfdOffsetMetrics
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  // Initially empty
  assert.deepEqual(getSavedSpliceMfdOffsetCerts(mockStorage), []);

  const r1 = buildSpliceMfdOffsetRecord({ tiltAngleDeg: 0.20 }); // Grade A
  const r2 = buildSpliceMfdOffsetRecord({ tiltAngleDeg: 1.85 }); // Reject

  assert.equal(saveSpliceMfdOffsetCert(r1, mockStorage), true);
  assert.equal(saveSpliceMfdOffsetCert(r2, mockStorage), true);

  const saved = getSavedSpliceMfdOffsetCerts(mockStorage);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, r2.id); // unshift order

  // Update status
  const updated = updateSpliceMfdOffsetCertStatus(r1.id, 'RESOLVED_RE_SPLICED', mockStorage);
  assert.equal(updated, true);
  const reloaded = getSavedSpliceMfdOffsetCerts(mockStorage);
  assert.equal(reloaded.find(x => x.id === r1.id).status, 'RESOLVED_RE_SPLICED');

  // Metrics
  const metrics = calculateSpliceMfdOffsetMetrics(reloaded);
  assert.equal(metrics.total, 2);
  assert.ok(metrics.passRatePercent >= 50);
  assert.ok(metrics.avgLossDb > 0);

  // Clear
  clearSpliceMfdOffsetCerts(mockStorage);
  assert.deepEqual(getSavedSpliceMfdOffsetCerts(mockStorage), []);
});

test('setupSpliceMfdOffsetModal wires full interactive modal lifecycle', async () => {
  const { setupSpliceMfdOffsetModal } = await import('../form-validation.js');

  function createMockEl(tag = 'div') {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      classList: new Set(),
      className: '',
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      attributes: {},
      listeners: {},
      addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      click() {
        if (this.listeners.click) this.listeners.click.forEach(fn => fn({ target: this }));
      },
      dispatchEvent(evt) {
        if (this.listeners[evt.type]) this.listeners[evt.type].forEach(fn => fn(evt));
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(selector) {
        return this._childrenMap ? this._childrenMap[selector] || null : null;
      },
      querySelectorAll() {
        return [];
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; }
    };
    return el;
  }

  const dialog = createMockEl('dialog');
  const elements = {
    '#spliceLeftFiberSelect': createMockEl('select'),
    '#spliceRightFiberSelect': createMockEl('select'),
    '#spliceSplicerSelect': createMockEl('select'),
    '#spliceWavelengthSelect': createMockEl('select'),
    '#splicePresetSelect': createMockEl('select'),
    '#spliceTiltInput': createMockEl('input'),
    '#spliceTiltValBadge': createMockEl('span'),
    '#spliceLeftEccInput': createMockEl('input'),
    '#spliceRightEccInput': createMockEl('input'),
    '#spliceTechnicianInput': createMockEl('input'),
    '#spliceLocationInput': createMockEl('input'),
    '#spliceNotesInput': createMockEl('input'),
    '#spliceSvgContainer': createMockEl('div'),
    '#spliceTotalLossBadge': createMockEl('div'),
    '#spliceVerdictPill': createMockEl('div'),
    '#spliceMfdLossBadge': createMockEl('div'),
    '#spliceOffsetLossBadge': createMockEl('div'),
    '#spliceTiltLossBadge': createMockEl('div'),
    '#spliceHistoryTbody': createMockEl('tbody'),
    '#spliceHistorySearch': createMockEl('input'),
    '#spliceHistoryVerdictFilter': createMockEl('select'),
    '#spliceSaveCertBtn': createMockEl('button'),
    '#splicePrintA4Btn': createMockEl('button'),
    '#splicePrintPosBtn': createMockEl('button'),
    '#spliceExportCsvBtn': createMockEl('button'),
    '#spliceWhatsAppBtn': createMockEl('button'),
    '#spliceCloseBtn': createMockEl('button')
  };
  dialog._childrenMap = elements;

  const trigger = createMockEl('button');
  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toasts = [];
  const controller = setupSpliceMfdOffsetModal({
    dialogElement: dialog,
    triggerButton: trigger,
    storage: mockStorage,
    onToast: (msg) => toasts.push(msg)
  });

  assert.ok(controller);
  assert.equal(typeof controller.recalculate, 'function');
  assert.equal(typeof controller.populateCustomer, 'function');
  assert.equal(typeof controller.renderHistory, 'function');

  // Verify options were populated
  assert.ok(elements['#spliceLeftFiberSelect'].children.length > 0);
  assert.ok(elements['#spliceRightFiberSelect'].children.length > 0);
  assert.ok(elements['#spliceSplicerSelect'].children.length > 0);
  assert.ok(elements['#splicePresetSelect'].children.length > 0);

  // Recalculate creates SVG
  const analysis = controller.recalculate();
  assert.ok(analysis.totalLossDb >= 0);
  assert.ok(elements['#spliceSvgContainer'].innerHTML.includes('<svg'));

  // Save cert
  elements['#spliceSaveCertBtn'].click();
  assert.ok(toasts.some(t => t.includes('Saved Splice Certificate')));

  // History rendered
  assert.ok(elements['#spliceHistoryTbody'].innerHTML.includes('SMFD-'));

  // Customer population
  controller.populateCustomer({ name: 'Malik Usman', mohalla: 'Vandala Road' });
  assert.ok(elements['#spliceLocationInput'].value.includes('Malik Usman'));
});

// ============================================================================
// OPTICAL FIBER SPLICE SLEEVE HEAT-SHRINK CURE & TENSILE RETENTION QA TESTS
// ============================================================================

test('qa-splice-sleeve-cure constants and schema structures are valid', async () => {
  const {
    SLEEVE_TYPES,
    HOT_MELT_ADHESIVES,
    TUBE_CONDITIONS,
    SLEEVE_QA_VERDICTS,
    SHAH_SLEEVE_PRESETS
  } = await import('../form-validation.js');

  // Sleeve types
  assert.ok(SLEEVE_TYPES.SLEEVE_60MM_STANDARD);
  assert.equal(SLEEVE_TYPES.SLEEVE_60MM_STANDARD.nominalLengthMm, 60.0);
  assert.equal(SLEEVE_TYPES.SLEEVE_60MM_STANDARD.telcordiaMinTensileN, 100);

  assert.ok(SLEEVE_TYPES.SLEEVE_40MM_SLIM);
  assert.equal(SLEEVE_TYPES.SLEEVE_40MM_SLIM.nominalLengthMm, 40.0);

  assert.ok(SLEEVE_TYPES.SLEEVE_25MM_MICRO);
  assert.equal(SLEEVE_TYPES.SLEEVE_25MM_MICRO.nominalLengthMm, 25.0);

  assert.ok(SLEEVE_TYPES.SLEEVE_60MM_DIELECTRIC);

  // Hot melt polymers
  assert.ok(HOT_MELT_ADHESIVES.EVA_STANDARD);
  assert.equal(HOT_MELT_ADHESIVES.EVA_STANDARD.nominalMeltingPointC, 98);

  assert.ok(HOT_MELT_ADHESIVES.POLYOLEFIN_HIGH_FLOW);
  assert.equal(HOT_MELT_ADHESIVES.POLYOLEFIN_HIGH_FLOW.nominalMeltingPointC, 115);

  // Verdicts
  assert.equal(SLEEVE_QA_VERDICTS.OPTIMAL_CERTIFIED.code, 'OPTIMAL');
  assert.equal(SLEEVE_QA_VERDICTS.COMPLIANT_STANDARD.code, 'COMPLIANT');
  assert.equal(SLEEVE_QA_VERDICTS.CONDITIONAL_REHEAT.code, 'REHEAT_DUE');
  assert.equal(SLEEVE_QA_VERDICTS.REJECT_RE_SLEEVE.code, 'RE_SLEEVE');

  // Presets
  assert.ok(SHAH_SLEEVE_PRESETS.BARADARI_EXCHANGE_60MM);
  assert.ok(SHAH_SLEEVE_PRESETS.VANDALA_SLIM_40MM);
  assert.ok(SHAH_SLEEVE_PRESETS.JIA_MUSA_UNDER_CURED);
  assert.ok(SHAH_SLEEVE_PRESETS.BEGUM_KOT_OVERHEATED_CHAR);
});

test('calculateCureThermalEnergy evaluates oven thermodynamics and ambient loss compensation', async () => {
  const { calculateCureThermalEnergy, SLEEVE_TYPES, HOT_MELT_ADHESIVES } = await import('../form-validation.js');

  const sleeve = SLEEVE_TYPES.SLEEVE_60MM_STANDARD;
  const eva = HOT_MELT_ADHESIVES.EVA_STANDARD;

  // Perfect target parameters at 25°C ambient
  const nominal = calculateCureThermalEnergy(sleeve.targetCureTempC, sleeve.targetCureTimeSec, 25, sleeve, eva);
  assert.ok(Math.abs(nominal - 1.0) < 0.05);

  // Under-cure: lower temperature and shortened duration
  const underCure = calculateCureThermalEnergy(160, 14, 25, sleeve, eva);
  assert.ok(underCure < 0.60);

  // Over-cure: high temp and prolonged cycle
  const overCure = calculateCureThermalEnergy(245, 50, 25, sleeve, eva);
  assert.ok(overCure > 1.50);

  // Cold ambient (e.g. 5°C winter in Shahdara) vs warm ambient (40°C summer)
  const coldRatio = calculateCureThermalEnergy(200, 28, 5, sleeve, eva);
  const hotRatio = calculateCureThermalEnergy(200, 28, 40, sleeve, eva);
  assert.ok(coldRatio < hotRatio);
});

test('calculateVoidMicroBendPenalty models localized stress over the fusion core junction', async () => {
  const { calculateVoidMicroBendPenalty } = await import('../form-validation.js');

  // Zero bubble -> 0 dB
  assert.equal(calculateVoidMicroBendPenalty(0, 0), 0);

  // Bubble directly over splice (dist == 0) produces highest micro-bending
  const penaltyOverSplice = calculateVoidMicroBendPenalty(0.4, 0);
  assert.ok(penaltyOverSplice > 0.01);

  // Same bubble located far away at peripheral edge (dist == 15mm) has decayed negligible effect
  const penaltyPeripheral = calculateVoidMicroBendPenalty(0.4, 15);
  assert.ok(penaltyPeripheral < penaltyOverSplice);
  assert.ok(penaltyPeripheral < 0.005);
});

test('calculateAxialTensileRetention evaluates mechanical pull proof retention under IEC 61073-1', async () => {
  const { calculateAxialTensileRetention, SLEEVE_TYPES } = await import('../form-validation.js');

  const sleeve = SLEEVE_TYPES.SLEEVE_60MM_STANDARD;

  // Ideal cure with complete meniscus and pristine tube
  const ideal = calculateAxialTensileRetention(sleeve, 1.0, true, 5);
  assert.ok(ideal >= 120);

  // Incomplete meniscus seal penalty
  const noMeniscus = calculateAxialTensileRetention(sleeve, 1.0, false, 5);
  assert.ok(noMeniscus < ideal);
  assert.ok(ideal - noMeniscus >= 15);

  // Severely degraded / charred tube condition penalty
  const charred = calculateAxialTensileRetention(sleeve, 1.0, true, 1);
  assert.ok(charred < ideal);
  assert.ok(ideal - charred >= 20);
});

test('evaluateSleeveCureQa performs comprehensive evaluation across field scenarios', async () => {
  const { evaluateSleeveCureQa } = await import('../form-validation.js');

  // Baradari Exchange Nominal
  const baradari = evaluateSleeveCureQa({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    adhesiveType: 'EVA_STANDARD',
    ovenTempC: 205,
    cureTimeSec: 28,
    ambientTempC: 24,
    bubbleCount: 0,
    maxBubbleDiamMm: 0,
    hasMeniscusSeal: true
  });
  assert.equal(baradari.verdict.code, 'OPTIMAL');
  assert.equal(baradari.isTelcordiaCompliant, true);
  assert.ok(baradari.tensileRetentionN >= 115);

  // Jia Musa Under-Cured Winter Joint
  const jiaMusa = evaluateSleeveCureQa({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 170,
    cureTimeSec: 16,
    ambientTempC: 7,
    hasMeniscusSeal: false
  });
  assert.equal(jiaMusa.verdict.code, 'REHEAT_DUE');

  // Begum Kot Scorched / Charred Reject
  const begumKot = evaluateSleeveCureQa({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 245,
    cureTimeSec: 52,
    outerTubeCondition: 'CHARRED_EMBRITTLED',
    isBubbleOverSplice: true,
    maxBubbleDiamMm: 0.85
  });
  assert.equal(begumKot.verdict.code, 'RE_SLEEVE');
  assert.equal(begumKot.isTelcordiaCompliant, false);
});

test('validateSpliceSleeveCure validates temperature, duration, and bubble inputs', async () => {
  const { validateSpliceSleeveCure } = await import('../form-validation.js');

  const valid = validateSpliceSleeveCure({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 200,
    cureTimeSec: 28,
    maxBubbleDiamMm: 0.2
  });
  assert.equal(valid.isValid, true);
  assert.deepEqual(valid.errors, {});

  const badTemp = validateSpliceSleeveCure({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 350,
    cureTimeSec: 28
  });
  assert.equal(badTemp.isValid, false);
  assert.ok(badTemp.errors.ovenTempC);

  const badTime = validateSpliceSleeveCure({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 200,
    cureTimeSec: 120
  });
  assert.equal(badTime.isValid, false);
  assert.ok(badTime.errors.cureTimeSec);
});

test('buildSpliceSleeveCureRecord constructs structured immutable record with SCUR prefix', async () => {
  const { buildSpliceSleeveCureRecord } = await import('../form-validation.js');

  const record = buildSpliceSleeveCureRecord({
    customer: { name: 'Mian Aslam', phone: '0300-1122334', zone: 'Begum Kot' },
    sleeveType: 'SLEEVE_40MM_SLIM',
    ovenTempC: 195,
    cureTimeSec: 18,
    technicianName: 'Umair Optical Tech',
    location: 'FAT Pole 14'
  });

  assert.ok(record.id.startsWith('SCUR-'));
  assert.equal(record.customer.name, 'Mian Aslam');
  assert.equal(record.sleeveType, 'SLEEVE_40MM_SLIM');
  assert.ok(record.tensileRetentionN > 0);
  assert.ok(record.createdAt);
  assert.ok(record.verdict.code);
});

test('renderSpliceSleeveCureSvg produces valid pure-vector SVG markup', async () => {
  const { evaluateSleeveCureQa, renderSpliceSleeveCureSvg } = await import('../form-validation.js');

  const analysis = evaluateSleeveCureQa({
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 200,
    cureTimeSec: 28,
    hasMeniscusSeal: true
  });

  const svg = renderSpliceSleeveCureSvg(analysis);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 760 340"'));
  assert.ok(svg.includes('id="sleeveAssembly"'));
  assert.ok(svg.includes('Fusion Joint Core'));
  assert.ok(svg.includes('Meniscus OK'));
  assert.ok(svg.includes('Tensile Retention:'));
  assert.ok(svg.includes('</svg>'));
});

test('generateSpliceSleeveCureCertHtml produces formal A4 and 80mm thermal POS formats', async () => {
  const { buildSpliceSleeveCureRecord, generateSpliceSleeveCureCertHtml } = await import('../form-validation.js');

  const record = buildSpliceSleeveCureRecord({
    customer: { name: 'Shahid Mehmood', phone: '0333-8899001', zone: 'Baradari' },
    sleeveType: 'SLEEVE_60MM_STANDARD',
    ovenTempC: 205,
    cureTimeSec: 28,
    technicianName: 'Engr. Imran Malik',
    location: 'ODF Rack 01'
  });

  // A4 formal accreditation
  const a4Html = generateSpliceSleeveCureCertHtml(record, { format: 'A4' });
  assert.ok(a4Html.includes('OPTICAL FUSION SPLICE PROTECTOR CURE & TENSILE RETENTION CERTIFICATE'));
  assert.ok(a4Html.includes('SHAHDARA BROADBAND FIBER NETWORK'));
  assert.ok(a4Html.includes(record.id));
  assert.ok(a4Html.includes('Telcordia GR-1380-CORE / IEC 61073-1'));
  assert.ok(a4Html.includes('Shahid Mehmood'));
  assert.ok(a4Html.includes('Axial Tensile Proof Retention'));

  // 80mm POS Thermal Slip
  const posHtml = generateSpliceSleeveCureCertHtml(record, { format: 'POS' });
  assert.ok(posHtml.includes('80mm auto'));
  assert.ok(posHtml.includes('SPLICE PROTECTOR CURE SLIP'));
  assert.ok(posHtml.includes(record.id));
  assert.ok(posHtml.includes('Tensile Hold:'));
  assert.ok(posHtml.includes('KEEP IN CLOSURE TRAY'));
});

test('formatSpliceSleeveCureCertWhatsApp produces bilingual Urdu & English technician dispatch notice', async () => {
  const { buildSpliceSleeveCureRecord, formatSpliceSleeveCureCertWhatsApp } = await import('../form-validation.js');

  const record = buildSpliceSleeveCureRecord({
    customer: { name: 'Kashif Ali', zone: 'Vandala Road' },
    sleeveType: 'SLEEVE_40MM_SLIM',
    ovenTempC: 195,
    cureTimeSec: 18,
    technicianName: 'Tariq Mehmood',
    location: 'FAT Joint #08'
  });

  const text = formatSpliceSleeveCureCertWhatsApp(record);
  assert.ok(text.includes('SHAHDARA FIBER NET - SPLICE SLEEVE CURE QA CERTIFICATE'));
  assert.ok(text.includes(record.id));
  assert.ok(text.includes('Tariq Mehmood'));
  assert.ok(text.includes('Tensile Hold:'));
  assert.ok(text.includes('اردو رزلٹ:'));
  assert.ok(text.includes('042-37900000'));
});

test('generateSpliceSleeveCureCertsCsv generates compliant RFC-4180 CSV with UTF-8 BOM', async () => {
  const { buildSpliceSleeveCureRecord, generateSpliceSleeveCureCertsCsv } = await import('../form-validation.js');

  const r1 = buildSpliceSleeveCureRecord({ location: 'Exchange ODF', sleeveType: 'SLEEVE_60MM_STANDARD' });
  const r2 = buildSpliceSleeveCureRecord({ location: 'Pole 12, with comma', sleeveType: 'SLEEVE_40MM_SLIM' });

  const csv = generateSpliceSleeveCureCertsCsv([r1, r2]);
  assert.ok(csv.startsWith('\uFEFF')); // UTF-8 BOM
  assert.ok(csv.includes('Certificate ID,Date,Customer Name'));
  assert.ok(csv.includes(r1.id));
  assert.ok(csv.includes('"Pole 12, with comma"'));
});

test('localStorage CRUD operations and calculateSpliceSleeveCureMetrics function accurately', async () => {
  const {
    buildSpliceSleeveCureRecord,
    getSavedSpliceSleeveCureCerts,
    saveSpliceSleeveCureCert,
    updateSpliceSleeveCureCertStatus,
    clearSpliceSleeveCureCerts,
    calculateSpliceSleeveCureMetrics
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  // Initially empty
  assert.deepEqual(getSavedSpliceSleeveCureCerts(mockStorage), []);

  const r1 = buildSpliceSleeveCureRecord({ ovenTempC: 205, cureTimeSec: 28 }); // Optimal
  const r2 = buildSpliceSleeveCureRecord({ outerTubeCondition: 'CHARRED_EMBRITTLED' }); // Reject

  assert.equal(saveSpliceSleeveCureCert(r1, mockStorage), true);
  assert.equal(saveSpliceSleeveCureCert(r2, mockStorage), true);

  const saved = getSavedSpliceSleeveCureCerts(mockStorage);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, r2.id); // unshift order

  // Update status
  const updated = updateSpliceSleeveCureCertStatus(r1.id, 'PASSED_ARCHIVED', mockStorage);
  assert.equal(updated, true);
  const reloaded = getSavedSpliceSleeveCureCerts(mockStorage);
  assert.equal(reloaded.find(x => x.id === r1.id).status, 'PASSED_ARCHIVED');

  // Metrics
  const metrics = calculateSpliceSleeveCureMetrics(reloaded);
  assert.equal(metrics.total, 2);
  assert.ok(metrics.passRatePercent >= 50);
  assert.ok(metrics.avgTensileN > 0);

  // Clear
  clearSpliceSleeveCureCerts(mockStorage);
  assert.deepEqual(getSavedSpliceSleeveCureCerts(mockStorage), []);
});

test('setupSpliceSleeveCureModal wires full interactive modal lifecycle', async () => {
  const { setupSpliceSleeveCureModal } = await import('../form-validation.js');

  function createMockEl(tag = 'div') {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      classList: new Set(),
      className: '',
      style: {},
      value: '',
      innerHTML: '',
      textContent: '',
      attributes: {},
      listeners: {},
      addEventListener(evt, fn) {
        if (!this.listeners[evt]) this.listeners[evt] = [];
        this.listeners[evt].push(fn);
      },
      click() {
        if (this.listeners.click) this.listeners.click.forEach(fn => fn({ target: this }));
      },
      dispatchEvent(evt) {
        if (this.listeners[evt.type]) this.listeners[evt.type].forEach(fn => fn(evt));
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      querySelector(selector) {
        return this._childrenMap ? this._childrenMap[selector] || null : null;
      },
      querySelectorAll() {
        return [];
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; }
    };
    return el;
  }

  const dialog = createMockEl('dialog');
  const elements = {
    '#sleeveTypeSelect': createMockEl('select'),
    '#sleeveAdhesiveSelect': createMockEl('select'),
    '#sleevePresetSelect': createMockEl('select'),
    '#sleeveTempInput': createMockEl('input'),
    '#sleeveTimeInput': createMockEl('input'),
    '#sleeveAmbientInput': createMockEl('input'),
    '#sleeveBubbleCountInput': createMockEl('input'),
    '#sleeveBubbleDiamInput': createMockEl('input'),
    '#sleeveOverSpliceSelect': createMockEl('select'),
    '#sleeveMeniscusSelect': createMockEl('select'),
    '#sleeveTubeCondSelect': createMockEl('select'),
    '#sleeveTechnicianInput': createMockEl('input'),
    '#sleeveLocationInput': createMockEl('input'),
    '#sleeveNotesInput': createMockEl('input'),
    '#sleeveSvgContainer': createMockEl('div'),
    '#sleeveEnergyBadge': createMockEl('div'),
    '#sleeveVerdictPill': createMockEl('div'),
    '#sleeveTensileBadge': createMockEl('div'),
    '#sleeveMicroBendBadge': createMockEl('div'),
    '#sleeveMeniscusBadge': createMockEl('div'),
    '#sleeveHistoryTbody': createMockEl('tbody'),
    '#sleeveHistorySearch': createMockEl('input'),
    '#sleeveHistoryVerdictFilter': createMockEl('select'),
    '#sleeveSaveCertBtn': createMockEl('button'),
    '#sleevePrintA4Btn': createMockEl('button'),
    '#sleevePrintPosBtn': createMockEl('button'),
    '#sleeveExportCsvBtn': createMockEl('button'),
    '#sleeveWhatsAppBtn': createMockEl('button'),
    '#sleeveCloseBtn': createMockEl('button')
  };
  dialog._childrenMap = elements;

  const trigger = createMockEl('button');
  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toasts = [];
  const controller = setupSpliceSleeveCureModal({
    dialogElement: dialog,
    triggerButton: trigger,
    storage: mockStorage,
    onToast: (msg) => toasts.push(msg)
  });

  assert.ok(controller);
  assert.equal(typeof controller.recalculate, 'function');
  assert.equal(typeof controller.populateCustomer, 'function');
  assert.equal(typeof controller.renderHistory, 'function');

  // Verify options were populated
  assert.ok(elements['#sleeveTypeSelect'].children.length > 0);
  assert.ok(elements['#sleeveAdhesiveSelect'].children.length > 0);
  assert.ok(elements['#sleevePresetSelect'].children.length > 0);

  // Recalculate creates SVG
  const analysis = controller.recalculate();
  assert.ok(analysis.tensileRetentionN >= 0);
  assert.ok(elements['#sleeveSvgContainer'].innerHTML.includes('<svg'));

  // Save cert
  elements['#sleeveSaveCertBtn'].click();
  assert.ok(toasts.some(t => t.includes('Saved Splice Protector Certificate')));

  // History rendered
  assert.ok(elements['#sleeveHistoryTbody'].innerHTML.includes('SCUR-'));

  // Customer population
  controller.populateCustomer({ name: 'Chaudhry Akram', mohalla: 'Jia Musa' });
  assert.ok(elements['#sleeveLocationInput'].value.includes('Chaudhry Akram'));
});

test('qa-cleave-quality constants and catalogs conform to ITU-T and Telcordia specifications', async () => {
  const {
    CLEAVER_MODELS,
    SURFACE_DEFECT_TYPES,
    BLADE_HEIGHT_SETTINGS,
    CLEAVE_QA_VERDICTS,
    SHAH_CLEAVE_PRESETS
  } = await import('../form-validation.js');

  assert.ok(CLEAVER_MODELS['FUJIKURA_CT50']);
  assert.equal(CLEAVER_MODELS['FUJIKURA_CT50'].bladeChannels, 16);
  assert.ok(CLEAVER_MODELS['SUMITOMO_FC6S']);
  assert.equal(CLEAVER_MODELS['SUMITOMO_FC6S'].totalBladeLife, 36000);

  assert.ok(SURFACE_DEFECT_TYPES['NONE_PRISTINE']);
  assert.equal(SURFACE_DEFECT_TYPES['NONE_PRISTINE'].lossPenaltyDb, 0.0);
  assert.ok(SURFACE_DEFECT_TYPES['HACKLE_RADIAL']);
  assert.equal(SURFACE_DEFECT_TYPES['HACKLE_RADIAL'].verdictImpact, 'REJECT');

  assert.ok(BLADE_HEIGHT_SETTINGS['OPTIMAL']);
  assert.equal(BLADE_HEIGHT_SETTINGS['OPTIMAL'].angleMultiplier, 1.0);

  assert.ok(CLEAVE_QA_VERDICTS['GRADE_A_EXCELLENT']);
  assert.equal(CLEAVE_QA_VERDICTS['GRADE_A_EXCELLENT'].isPassing, true);
  assert.equal(CLEAVE_QA_VERDICTS['GRADE_D_REJECT'].isPassing, false);

  assert.ok(SHAH_CLEAVE_PRESETS['PRESET_BARADARI_CT50']);
  assert.ok(SHAH_CLEAVE_PRESETS['PRESET_RAVI_SIPHON_REJECT']);
});

test('calculateCleaveAngleLoss calculates Marcuse tilt insertion loss across angular degrees', async () => {
  const { calculateCleaveAngleLoss } = await import('../form-validation.js');

  assert.equal(calculateCleaveAngleLoss(0), 0);
  const loss05 = calculateCleaveAngleLoss(0.5);
  assert.ok(loss05 > 0.05 && loss05 < 0.12, `0.5° loss was ${loss05}`);
  const loss10 = calculateCleaveAngleLoss(1.0);
  assert.ok(loss10 > 0.30 && loss10 < 0.40, `1.0° loss was ${loss10}`);
  const loss20 = calculateCleaveAngleLoss(2.0);
  assert.ok(loss20 > 1.20 && loss20 < 1.60, `2.0° loss was ${loss20}`);
});

test('calculateBladeWearMetrics tracks channel wear and total lifetime wear index', async () => {
  const { calculateBladeWearMetrics } = await import('../form-validation.js');

  const fresh = calculateBladeWearMetrics('SUMITOMO_FC6S', 1, 200);
  assert.equal(fresh.channel, 1);
  assert.equal(fresh.channelHealth, 'OPTIMAL');
  assert.equal(fresh.isChannelExhausted, false);

  const warn = calculateBladeWearMetrics('SUMITOMO_FC6S', 1, 2000);
  assert.equal(warn.channelHealth, 'WARNING');

  const exhausted = calculateBladeWearMetrics('SUMITOMO_FC6S', 1, 2600);
  assert.equal(exhausted.channelHealth, 'EXHAUSTED');
  assert.equal(exhausted.isChannelExhausted, true);
});

test('evaluateCleaveQuality assigns appropriate quality grades and fusion readiness', async () => {
  const { evaluateCleaveQuality } = await import('../form-validation.js');

  // Grade A: Pristine 0.35°
  const gradeA = evaluateCleaveQuality({
    cleaverModelId: 'FUJIKURA_CT50',
    cleaveAngleDeg: 0.35,
    defectTypeId: 'NONE_PRISTINE',
    bladeHeightId: 'OPTIMAL'
  });
  assert.equal(gradeA.verdict.code, 'GRADE_A');
  assert.equal(gradeA.isPassing, true);
  assert.equal(gradeA.fusionSpliceReady, true);
  assert.equal(gradeA.reCleaveRequired, false);

  // Grade B: 0.75° with peripheral mist
  const gradeB = evaluateCleaveQuality({
    cleaverModelId: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 0.75,
    defectTypeId: 'MIST_PERIPHERY',
    bladeHeightId: 'OPTIMAL'
  });
  assert.equal(gradeB.verdict.code, 'GRADE_B');
  assert.equal(gradeB.fusionSpliceReady, true);

  // Grade C: 1.35° with minor lip
  const gradeC = evaluateCleaveQuality({
    cleaverModelId: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 1.35,
    defectTypeId: 'LIP_SMALL',
    bladeHeightId: 'OPTIMAL'
  });
  assert.equal(gradeC.verdict.code, 'GRADE_C');
  assert.equal(gradeC.fusionSpliceReady, false);
  assert.equal(gradeC.fastConnectorReady, true);

  // Grade D: Severe hackle or high angle
  const gradeD = evaluateCleaveQuality({
    cleaverModelId: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 2.20,
    defectTypeId: 'HACKLE_RADIAL',
    bladeHeightId: 'TOO_HIGH'
  });
  assert.equal(gradeD.verdict.code, 'GRADE_D');
  assert.equal(gradeD.isPassing, false);
  assert.equal(gradeD.reCleaveRequired, true);
});

test('renderFiberCleaveQualitySvg outputs valid SVG graphic with telemetry ribbons', async () => {
  const { evaluateCleaveQuality, renderFiberCleaveQualitySvg } = await import('../form-validation.js');

  const analysis = evaluateCleaveQuality({
    cleaverModelId: 'FUJIKURA_CT50',
    cleaveAngleDeg: 0.42,
    defectTypeId: 'NONE_PRISTINE',
    bladeHeightId: 'OPTIMAL',
    bladeChannel: 2,
    cleavesOnChannel: 300
  });

  const svg = renderFiberCleaveQualitySvg(analysis);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('FIBER CLEAVE ANGLE &amp; END-FACE TOPOGRAPHY METROLOGY'));
  assert.ok(svg.includes('θ = 0.42°'));
  assert.ok(svg.includes('Cladding (125 µm)'));
  assert.ok(svg.includes('Core (9.2 µm)'));
  assert.ok(svg.includes('GRADE_A'));
  assert.ok(svg.includes('</svg>'));
});

test('validateFiberCleaveInput guards input bounds for angle, channel and count', async () => {
  const { validateFiberCleaveInput } = await import('../form-validation.js');

  const valid = validateFiberCleaveInput({
    cleaveAngleDeg: 0.65,
    bladeChannel: 4,
    cleavesOnChannel: 800
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validateFiberCleaveInput({
    cleaveAngleDeg: -2,
    bladeChannel: 40,
    cleavesOnChannel: -100
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('buildFiberCleaveRecord generates unique ID and complete certificate snapshot', async () => {
  const { buildFiberCleaveRecord } = await import('../form-validation.js');

  const customer = { id: 'cust_99', name: 'Naveed Akhtar', mohalla: 'Vandala Road', phone: '03001234567' };
  const record = buildFiberCleaveRecord({
    customer,
    cleaverModelId: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 0.55,
    defectTypeId: 'NONE_PRISTINE',
    technicianName: 'Zahid Lead Splicer',
    location: 'FAT-04 Wandala',
    notes: 'Pre-splice check'
  });

  assert.match(record.id, /^CLV-\d{6}-\d{4}$/);
  assert.equal(record.customerName, 'Naveed Akhtar');
  assert.equal(record.customerMohalla, 'Vandala Road');
  assert.equal(record.cleaveAngleDeg, 0.55);
  assert.equal(record.isPassing, true);
  assert.equal(record.technicianName, 'Zahid Lead Splicer');
});

test('fiber cleave certs localStorage persistence and calculateFiberCleaveMetrics', async () => {
  const {
    getSavedFiberCleaveCerts,
    saveFiberCleaveCert,
    clearFiberCleaveCerts,
    calculateFiberCleaveMetrics
  } = await import('../form-validation.js');

  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  assert.deepEqual(getSavedFiberCleaveCerts(mockStorage), []);

  const cert1 = { id: 'CLV-01', verdictCode: 'GRADE_A', isPassing: true, cleaveAngleDeg: 0.40, totalEstimatedLossDb: 0.010 };
  const cert2 = { id: 'CLV-02', verdictCode: 'GRADE_D', isPassing: false, cleaveAngleDeg: 2.10, totalEstimatedLossDb: 0.350 };

  saveFiberCleaveCert(cert1, mockStorage);
  saveFiberCleaveCert(cert2, mockStorage);

  const loaded = getSavedFiberCleaveCerts(mockStorage);
  assert.equal(loaded.length, 2);

  const metrics = calculateFiberCleaveMetrics(loaded);
  assert.equal(metrics.totalCertificates, 2);
  assert.equal(metrics.gradeACount, 1);
  assert.equal(metrics.gradeDCount, 1);
  assert.equal(metrics.passRatePct, 50);
  assert.equal(metrics.reCleaveMandatedCount, 1);

  clearFiberCleaveCerts(mockStorage);
  assert.deepEqual(getSavedFiberCleaveCerts(mockStorage), []);
});

test('generateFiberCleaveQualityCertHtml creates formal A4 and 80mm thermal documents', async () => {
  const { generateFiberCleaveQualityCertHtml } = await import('../form-validation.js');

  const record = {
    id: 'CLV-202610-1234',
    dateStr: '2026-10-17',
    customerName: 'Shahdara Baradari Feeder',
    customerMohalla: 'Baradari Zone 1',
    technicianName: 'Kamran Splicer',
    location: 'ODF Rack 02',
    cleaverModelName: 'Fujikura CT50 Automated',
    bladeChannel: 3,
    cleavesOnChannel: 400,
    channelWearPct: 11,
    cleaveAngleDeg: 0.32,
    defectName: 'Pristine Mirror Zone',
    angleLossDb: 0.005,
    defectLossDb: 0.000,
    totalEstimatedLossDb: 0.005,
    verdictLabel: 'Grade A — Ultra-Low Loss Fusion Splice Certified',
    isPassing: true,
    fusionSpliceReady: true,
    notes: 'Lab calibrated'
  };

  const htmlA4 = generateFiberCleaveQualityCertHtml(record, { format: 'A4' });
  assert.ok(htmlA4.includes('SHAHDARA OPTICAL NETWORK METROLOGY LABORATORY'));
  assert.ok(htmlA4.includes('CLV-202610-1234'));
  assert.ok(htmlA4.includes('0.32°'));
  assert.ok(htmlA4.includes('Grade A — Ultra-Low Loss Fusion Splice Certified'));

  const htmlPos = generateFiberCleaveQualityCertHtml(record, { format: 'POS' });
  assert.ok(htmlPos.includes('FIBER CLEAVE QA FIELD SLIP'));
  assert.ok(htmlPos.includes('CLV-202610-1234'));
  assert.ok(htmlPos.includes('80mm'));
});

test('formatFiberCleaveQualityCertWhatsApp produces bilingual dispatch message', async () => {
  const { formatFiberCleaveQualityCertWhatsApp } = await import('../form-validation.js');

  const record = {
    id: 'CLV-202610-5678',
    dateStr: '2026-10-17',
    customerName: 'Imran Ashraf',
    customerMohalla: 'Jia Musa',
    technicianName: 'Umair Field Lead',
    location: 'FAT-02 Drop Terminal',
    cleaverModelName: 'Sumitomo FC-6S',
    bladeChannel: 5,
    cleavesOnChannel: 850,
    channelWearPct: 38,
    cleaveAngleDeg: 0.62,
    defectName: 'Peripheral Mist Zone',
    totalEstimatedLossDb: 0.038,
    verdictLabel: 'Grade B — Standard Outside Plant Fusion Splice Pass',
    isPassing: true
  };

  const text = formatFiberCleaveQualityCertWhatsApp(record);
  assert.ok(text.includes('SHAHDARA FIBER NETWORK — CLEAVE QA CERTIFICATE'));
  assert.ok(text.includes('سرٹیفکیٹ برائے آپٹیکل فائبر کلیو اینگل و کوالٹی'));
  assert.ok(text.includes('CLV-202610-5678'));
  assert.ok(text.includes('Imran Ashraf'));
  assert.ok(text.includes('0.62°'));
  assert.ok(text.includes('فائبر کا سرا صاف ہے'));
});

test('generateFiberCleaveQualityCertsCsv exports RFC-4180 CSV with UTF-8 BOM', async () => {
  const { generateFiberCleaveQualityCertsCsv } = await import('../form-validation.js');

  const records = [
    {
      id: 'CLV-01',
      dateStr: '2026-10-17',
      customerId: 'c1',
      customerName: 'Shahid Mehmood',
      customerMohalla: 'Vandala',
      technicianName: 'Zahid',
      location: 'FAT-01',
      cleaverModelName: 'Sumitomo FC-6S',
      bladeChannel: 2,
      cleavesOnChannel: 300,
      channelWearPct: 13,
      cleaveAngleDeg: 0.48,
      defectName: 'Pristine Mirror',
      bladeHeightName: 'Optimal',
      angleLossDb: 0.011,
      defectLossDb: 0.0,
      totalEstimatedLossDb: 0.011,
      verdictCode: 'GRADE_A',
      verdictLabel: 'Grade A',
      isPassing: true,
      fusionSpliceReady: true,
      notes: 'Clean'
    }
  ];

  const csv = generateFiberCleaveQualityCertsCsv(records);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Certificate ID","Date","Customer ID"'));
  assert.ok(csv.includes('"CLV-01"'));
  assert.ok(csv.includes('"Shahid Mehmood"'));
  assert.ok(csv.includes('"0.48"'));
});

test('setupFiberCleaveQualityModal wires interactive controls, calculation and history', async () => {
  const { setupFiberCleaveQualityModal } = await import('../form-validation.js');

  function createMockEl(tagName = 'div') {
    const el = {
      tagName: tagName.toUpperCase(),
      attributes: {},
      children: [],
      value: '',
      innerHTML: '',
      textContent: '',
      style: {},
      className: '',
      addEventListener(evt, fn) {
        this._listeners = this._listeners || {};
        this._listeners[evt] = this._listeners[evt] || [];
        this._listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        if (this._listeners && this._listeners[evt.type]) {
          this._listeners[evt.type].forEach(fn => fn(evt));
        }
      },
      click() {
        this.dispatchEvent({ type: 'click' });
      },
      appendChild(c) {
        this.children.push(c);
      },
      querySelector(selector) {
        return this._childrenMap ? this._childrenMap[selector] || null : null;
      },
      querySelectorAll() {
        return [];
      },
      setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; }
    };
    return el;
  }

  const dialog = createMockEl('dialog');
  dialog.ownerDocument = {
    createElement(tag) { return createMockEl(tag); }
  };
  const elements = {
    '#cleaveModelSelect': createMockEl('select'),
    '#cleavePresetSelect': createMockEl('select'),
    '#cleaveAngleInput': createMockEl('input'),
    '#cleaveDefectSelect': createMockEl('select'),
    '#cleaveBladeHeightSelect': createMockEl('select'),
    '#cleaveChannelInput': createMockEl('input'),
    '#cleaveCountInput': createMockEl('input'),
    '#cleaveTechnicianInput': createMockEl('input'),
    '#cleaveLocationInput': createMockEl('input'),
    '#cleaveNotesInput': createMockEl('input'),
    '#cleaveSvgContainer': createMockEl('div'),
    '#cleaveAngleBadge': createMockEl('div'),
    '#cleaveVerdictPill': createMockEl('div'),
    '#cleaveLossBadge': createMockEl('div'),
    '#cleaveWearBadge': createMockEl('div'),
    '#cleaveHistoryTbody': createMockEl('tbody'),
    '#cleaveHistorySearch': createMockEl('input'),
    '#cleaveHistoryFilter': createMockEl('select'),
    '#cleaveSaveCertBtn': createMockEl('button'),
    '#cleavePrintA4Btn': createMockEl('button'),
    '#cleavePrintPosBtn': createMockEl('button'),
    '#cleaveExportCsvBtn': createMockEl('button'),
    '#cleaveWhatsAppBtn': createMockEl('button'),
    '#cleaveCloseBtn': createMockEl('button')
  };
  dialog._childrenMap = elements;

  const trigger = createMockEl('button');
  const store = {};
  const mockStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; }
  };

  const toasts = [];
  const controller = setupFiberCleaveQualityModal({
    dialogElement: dialog,
    triggerButton: trigger,
    storage: mockStorage,
    onToast: (msg) => toasts.push(msg)
  });

  assert.ok(controller);
  assert.equal(typeof controller.recalculate, 'function');
  assert.equal(typeof controller.populateCustomer, 'function');
  assert.equal(typeof controller.renderHistory, 'function');

  // Verify dropdowns populated
  assert.ok(elements['#cleaveModelSelect'].children.length > 0);
  assert.ok(elements['#cleaveDefectSelect'].children.length > 0);
  assert.ok(elements['#cleavePresetSelect'].children.length > 0);

  // Recalculate creates SVG
  const analysis = controller.recalculate();
  assert.ok(analysis.totalEstimatedLossDb >= 0);
  assert.ok(elements['#cleaveSvgContainer'].innerHTML.includes('<svg'));

  // Save cert
  elements['#cleaveSaveCertBtn'].click();
  assert.ok(toasts.some(t => t.includes('Saved Cleave QA Certificate')));

  // History rendered
  assert.ok(elements['#cleaveHistoryTbody'].innerHTML.includes('CLV-'));

  // Customer population
  controller.populateCustomer({ name: 'Tariq Mehmood', mohalla: 'Baradari' });
  assert.ok(elements['#cleaveLocationInput'].value.includes('Tariq Mehmood'));
});

