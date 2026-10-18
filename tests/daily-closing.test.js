import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { addExpense } from '../phase3.js';
import {
  calculateDailyClosingSummary,
  generateDailyClosingSlipText,
  generateDailyClosingWhatsApp,
  generateDailyClosingCsv,
  generateDailyClosingPrintHtml,
  renderDailyClosingSvg,
  setupDailyClosingCard,
  setupDailyClosingModal,
  isPhysicalCashMethod,
  resolveShopLocation,
  resolveCollectorName,
  formatDateYmd
} from '../dashboard-daily-closing.js';

test('isPhysicalCashMethod, resolveShopLocation, and resolveCollectorName classify accurately', () => {
  assert.equal(isPhysicalCashMethod('Cash'), true);
  assert.equal(isPhysicalCashMethod('Cash at Waseem Abbasi shop'), true);
  assert.equal(isPhysicalCashMethod('Cash at Hassan shop'), true);
  assert.equal(isPhysicalCashMethod('JazzCash'), false);
  assert.equal(isPhysicalCashMethod('Easypaisa'), false);
  assert.equal(isPhysicalCashMethod('Bank Transfer'), false);
  assert.equal(isPhysicalCashMethod(''), true);

  assert.equal(resolveShopLocation('Cash at Waseem Abbasi shop'), 'Waseem Abbasi Shop');
  assert.equal(resolveShopLocation('Cash', 'Waseem Abbasi'), 'Waseem Abbasi Shop');
  assert.equal(resolveShopLocation('Cash at Hassan shop'), 'Hassan Shop');
  assert.equal(resolveShopLocation('Cash', 'Hassan Counter'), 'Hassan Shop');
  assert.equal(resolveShopLocation('Cash'), 'Direct Field / Doorstep Cash');
  assert.equal(resolveShopLocation('JazzCash'), 'Digital & Online Wallets');

  assert.equal(resolveCollectorName('Cash at Waseem Abbasi shop'), 'Waseem Abbasi');
  assert.equal(resolveCollectorName('Cash at Hassan shop'), 'Hassan');
  assert.equal(resolveCollectorName('Cash', 'Saad Collector'), 'Saad Collector');
  assert.equal(resolveCollectorName('Cash'), 'Direct / Counter Till');
  assert.equal(resolveCollectorName('Easypaisa'), 'Online / Digital Settlement');
});

test('calculateDailyClosingSummary computes accurate collections, channels, shops, expenses, and net cash in hand', () => {
  let state = createInitialState(['Closing Cust A', 'Closing Cust B', 'Closing Cust C']);
  const refDate = new Date('2026-10-18T14:30:00+05:00');

  // Customer A: Billed 3100 in 2026-10 (October has 31 days)
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  // Payment today at Waseem Abbasi shop
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '2000',
    date: '2026-10-18',
    method: 'Cash at Waseem Abbasi shop',
    paidBy: 'Waseem Abbasi'
  }, refDate);

  // Customer B: Billed 3100
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  // Payment today via JazzCash
  state = addPayment(state, state.customers[1].id, '2026-10', {
    amount: '1500',
    date: '2026-10-18',
    method: 'JazzCash',
    paidBy: 'Online Portal'
  }, refDate);

  // Customer C: Billed 3100
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  // Payment today at Hassan shop
  state = addPayment(state, state.customers[2].id, '2026-10', {
    amount: '1000',
    date: '2026-10-18',
    method: 'Cash at Hassan shop',
    paidBy: 'Hassan'
  }, refDate);

  // Operating Expenses today
  state = addExpense(state, {
    date: '2026-10-18',
    category: 'Cable',
    amount: '800',
    notes: 'Fiber patch cords & drop cable clips'
  }, refDate);

  state = addExpense(state, {
    date: '2026-10-18',
    category: 'Electricity',
    amount: '500',
    notes: 'Generator petrol for OLT backup'
  }, refDate);

  // Earlier expense from previous day (should not be in today's closing)
  state = addExpense(state, {
    date: '2026-10-17',
    category: 'Tools',
    amount: '1200',
    notes: 'Cleaver blade'
  }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);

  assert.equal(summary.todayStr, '2026-10-18');
  assert.equal(summary.currentMonth, '2026-10');
  assert.equal(summary.todayCollected, 4500); // 2000 + 1500 + 1000
  assert.equal(summary.todayCount, 3);
  assert.equal(summary.averageTicket, 1500);

  // Cash vs Digital breakdown
  assert.equal(summary.cashCollected, 3000); // 2000 (Waseem) + 1000 (Hassan)
  assert.equal(summary.digitalCollected, 1500); // 1500 (JazzCash)
  assert.equal(summary.cashSharePct, 67); // 3000 / 4500 = 67%
  assert.equal(summary.digitalSharePct, 33); // 1500 / 4500 = 33%

  // Expenses today
  assert.equal(summary.todayExpenses, 1300); // 800 + 500
  assert.equal(summary.todayExpenseCount, 2);
  assert.equal(summary.expenseCategories.length, 2);

  // Net Cash in Hand & Net Day Balance
  assert.equal(summary.netCashInHand, 1700); // 3000 cash - 1300 expenses = 1700
  assert.equal(summary.netDayBalance, 3200); // 4500 total - 1300 expenses = 3200

  // Shops attribution
  assert.ok(summary.shops.length >= 3);
  const waseemShop = summary.shops.find(s => s.name === 'Waseem Abbasi Shop');
  assert.ok(waseemShop);
  assert.equal(waseemShop.amount, 2000);
  assert.equal(waseemShop.count, 1);

  const hassanShop = summary.shops.find(s => s.name === 'Hassan Shop');
  assert.ok(hassanShop);
  assert.equal(hassanShop.amount, 1000);
  assert.equal(hassanShop.count, 1);

  const digitalShop = summary.shops.find(s => s.name === 'Digital & Online Wallets');
  assert.ok(digitalShop);
  assert.equal(digitalShop.amount, 1500);

  // Receipts ledger
  assert.equal(summary.receipts.length, 3);
  assert.equal(summary.receipts[0].customerName, 'Closing Cust A');
  assert.equal(summary.receipts[0].shopName, 'Waseem Abbasi Shop');
  assert.equal(summary.receipts[1].customerName, 'Closing Cust B');
  assert.equal(summary.receipts[2].customerName, 'Closing Cust C');

  // Status & Target
  assert.equal(summary.dailyTarget, 300); // 9300 / 31 = 300
  assert.ok(summary.targetAttainment > 100);
  assert.equal(summary.closingStatus, 'exceeded');
  assert.equal(summary.statusLabel, 'Target Met (100%+)');
});

test('calculateDailyClosingSummary handles zero activity cleanly', () => {
  const state = createInitialState(['Empty Cust']);
  const summary = calculateDailyClosingSummary(state, new Date('2026-10-18T12:00:00+05:00'));

  assert.equal(summary.todayCollected, 0);
  assert.equal(summary.todayCount, 0);
  assert.equal(summary.cashCollected, 0);
  assert.equal(summary.digitalCollected, 0);
  assert.equal(summary.todayExpenses, 0);
  assert.equal(summary.netCashInHand, 0);
  assert.equal(summary.netDayBalance, 0);
  assert.equal(summary.closingStatus, 'no-activity');
  assert.equal(summary.statusLabel, 'No Activity Today');
  assert.equal(summary.receipts.length, 0);
});

test('generateDailyClosingSlipText formats complete executive text with all sections', () => {
  let state = createInitialState(['Slip Cust A', 'Slip Cust B']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '2000',
    date: '2026-10-18',
    method: 'Cash at Waseem Abbasi shop',
    paidBy: 'Waseem Abbasi'
  }, refDate);

  state = addExpense(state, {
    date: '2026-10-18',
    category: 'Electricity',
    amount: '350',
    notes: 'Power backup'
  }, refDate);

  const text = generateDailyClosingSlipText(state, refDate);
  assert.ok(text.includes('DAILY REGISTER CLOSING'));
  assert.ok(text.includes('Date: 2026-10-18 PKT'));
  assert.ok(text.includes('Total Collections Today:'));
  assert.ok(text.includes('CASH RECONCILIATION & TILL'));
  assert.ok(text.includes('Physical Cash In:'));
  assert.ok(text.includes('Expenses Paid Today:'));
  assert.ok(text.includes('Net Cash in Hand:'));
  assert.ok(text.includes('Waseem Abbasi shop'));
  assert.ok(text.includes('SHOP & COLLECTOR TOTALS'));
  assert.ok(text.includes('EXPENSES PAID TODAY'));
});

test('generateDailyClosingWhatsApp creates rich bilingual Urdu and English text', () => {
  let state = createInitialState(['WhatsApp Cust']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '1800',
    date: '2026-10-18',
    method: 'Cash at Hassan shop',
    paidBy: 'Hassan'
  }, refDate);

  state = addExpense(state, {
    date: '2026-10-18',
    category: 'Cable',
    amount: '400',
    notes: 'Splice tray'
  }, refDate);

  const text = generateDailyClosingWhatsApp(state, refDate);
  assert.ok(text.includes('شاہدرہ آئی ایس پی — یومیہ رجسٹر کلوزنگ'));
  assert.ok(text.includes('SHAHDARA ISP — DAILY REGISTER CLOSING'));
  assert.ok(text.includes('Net Cash in Hand:'));
  assert.ok(text.includes('Hassan Shop'));
  assert.ok(text.includes('Cable:'));
});

test('generateDailyClosingCsv produces RFC-4180 compliant CSV with UTF-8 BOM', () => {
  let state = createInitialState(['Csv Cust']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '1500',
    date: '2026-10-18',
    method: 'Cash',
    paidBy: 'Counter'
  }, refDate);

  state = addExpense(state, {
    date: '2026-10-18',
    category: 'Charger',
    amount: '600',
    notes: 'Power adapter'
  }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);
  const csv = generateDailyClosingCsv(summary);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('DAILY CASH REGISTER & CLOSING AUDIT'));
  assert.ok(csv.includes('Physical Cash In (PKR)'));
  assert.ok(csv.includes('Net Cash in Hand (PKR)'));
  assert.ok(csv.includes('Csv Cust'));
  assert.ok(csv.includes('Power adapter'));
});

test('generateDailyClosingPrintHtml produces valid A4 and 80mm POS HTML documents', () => {
  let state = createInitialState(['Print Cust']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '2500',
    date: '2026-10-18',
    method: 'Cash at Waseem Abbasi shop',
    paidBy: 'Waseem'
  }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);

  const a4Html = generateDailyClosingPrintHtml(summary, { format: 'a4' });
  assert.ok(a4Html.includes('<!DOCTYPE html>'));
  assert.ok(a4Html.includes('A4 Register Closing Statement'));
  assert.ok(a4Html.includes('Cashier / Till Reconciler Signature'));
  assert.ok(a4Html.includes('Waseem Abbasi Shop'));

  const posHtml = generateDailyClosingPrintHtml(summary, { format: 'pos' });
  assert.ok(posHtml.includes('<!DOCTYPE html>'));
  assert.ok(posHtml.includes('80mm auto'));
  assert.ok(posHtml.includes('NET CASH IN HAND'));
  assert.ok(posHtml.includes('Waseem Abbasi Shop'));
});

test('renderDailyClosingSvg produces pure-vector responsive SVG graphic', () => {
  let state = createInitialState(['Svg Cust']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '2000',
    date: '2026-10-18',
    method: 'Cash'
  }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);
  const svg = renderDailyClosingSvg(summary);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('viewBox="0 0 640 180"'));
  assert.ok(svg.includes('NET CASH IN HAND (TILL)'));
  assert.ok(svg.includes('COLLECTIONS MIX'));
  assert.ok(svg.includes('</svg>'));
});

test('setupDailyClosingCard updates DOM elements and wires clipboard copy', async () => {
  let state = createInitialState(['Card Cust']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '1200',
    date: '2026-10-18',
    method: 'Cash'
  }, refDate);

  const mockValue = { textContent: '' };
  const mockPeriod = { textContent: '' };
  const mockBadge = { textContent: '', className: '' };
  let clickHandler = null;
  const mockBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { clickHandler = fn; }
  };

  const originalDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardDailyClosingValue') return mockValue;
      if (id === 'dashboardDailyClosingPeriod') return mockPeriod;
      if (id === 'dashboardClosingStatusBadge') return mockBadge;
      if (id === 'quickActionDailyClosingSlip') return mockBtn;
      return null;
    }
  };

  try {
    let toastMessage = '';
    let clipboardText = '';
    const mockClipboard = {
      writeText: async (t) => { clipboardText = t; }
    };

    setupDailyClosingCard(state, refDate, {
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(mockValue.textContent.includes('1,200'));
    assert.ok(mockPeriod.textContent.includes('Net Cash'));
    assert.ok(mockBadge.textContent.length > 0);

    assert.ok(clickHandler);
    await clickHandler();
    assert.ok(clipboardText.includes('DAILY REGISTER CLOSING'));
    assert.equal(toastMessage, 'Daily closing slip copied to clipboard!');
  } finally {
    globalThis.document = originalDoc;
  }
});
