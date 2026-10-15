import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validatePakistanPhone, validatePositiveAmount, validateCustomerName, validateTransactionDate, paginateRows, calculateTransactionSummary,
  saveFormDraft, loadFormDraft, clearFormDraft, hasFormDraft, wireFormDraftAutosave, generateCsvContent, downloadCsvFile, generateBatchReceiptHtml
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
