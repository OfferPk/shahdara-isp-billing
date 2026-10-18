import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderDailyClosingSvg,
  filterDailyClosingReceipts,
  sortDailyClosingReceipts,
  setupDailyClosingModal,
  calculateDailyClosingSummary
} from '../dashboard-daily-closing.js';

import { createInitialState, saveBillMonth, addPayment } from '../core.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('renderDailyClosingSvg conforms to SVG XML specification', () => {
  let state = createInitialState(['Svg Customer A', 'Svg Customer B']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '1500',
    date: '2026-10-18',
    method: 'Cash at Waseem Abbasi shop'
  }, refDate);
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', {
    amount: '2000',
    date: '2026-10-18',
    method: 'JazzCash'
  }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);
  const svg = renderDailyClosingSvg(summary);

  // 1. Must not have invalid presentation attribute height="auto"
  assert.ok(!svg.includes('height="auto"'), 'SVG must not contain invalid attribute height="auto"');

  // 2. Must contain valid inline style for responsive display
  assert.ok(svg.includes('style="height: auto; max-width: 100%; display: block;"'), 'SVG must use style for height: auto');

  // 3. Must not have invalid 4-value rx on rects
  assert.ok(!svg.includes('rx="4 0 0 4"'), 'SVG rect must not contain invalid 4-value rx="4 0 0 4"');
  assert.ok(!svg.includes('rx="0 4 4 0"'), 'SVG rect must not contain invalid 4-value rx="0 4 4 0"');

  // 4. Must render valid numeric rx rects
  assert.ok(svg.includes('rx="4"'), 'SVG rect must use valid numeric rx="4"');
  assert.ok(svg.includes('viewBox="0 0 640 180"'));
});

test('filterDailyClosingReceipts filters receipts by query correctly', () => {
  const receipts = [
    { customerNumber: 101, customerName: 'Ali Khan', mohalla: 'Main Bazar', billMonth: '2026-10', amount: 2500, method: 'Cash', paidBy: 'Ali' },
    { customerNumber: 102, customerName: 'Usman Tariq', mohalla: 'Shahdara Town', billMonth: '2026-10', amount: 1800, method: 'JazzCash', paidBy: 'Online Portal' },
    { customerNumber: 105, customerName: 'Bilal Ahmad', mohalla: 'Bara Dari', billMonth: '2026-10', amount: 3200, method: 'Cash at Hassan shop', paidBy: 'Hassan' },
    { customerNumber: 110, customerName: 'Zainab Bibi', mohalla: 'Main Bazar', billMonth: '2026-09', amount: 1500, method: 'Easypaisa', paidBy: 'Zainab' }
  ];

  // Empty or null returns full copy
  assert.equal(filterDailyClosingReceipts(receipts, '').length, 4);
  assert.equal(filterDailyClosingReceipts(receipts, null).length, 4);
  assert.equal(filterDailyClosingReceipts(receipts, '   ').length, 4);

  // Filter by customer name
  const byName = filterDailyClosingReceipts(receipts, 'usman');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].customerNumber, 102);

  // Filter by customer number
  const byNumber = filterDailyClosingReceipts(receipts, '105');
  assert.equal(byNumber.length, 1);
  assert.equal(byNumber[0].customerName, 'Bilal Ahmad');

  // Filter by area/mohalla
  const byArea = filterDailyClosingReceipts(receipts, 'Main Bazar');
  assert.equal(byArea.length, 2);

  // Filter by payment method
  const byMethod = filterDailyClosingReceipts(receipts, 'jazzcash');
  assert.equal(byMethod.length, 1);
  assert.equal(byMethod[0].customerNumber, 102);

  // Filter by collector
  const byCollector = filterDailyClosingReceipts(receipts, 'Hassan');
  assert.equal(byCollector.length, 1);

  // Filter by amount
  const byAmount = filterDailyClosingReceipts(receipts, '3200');
  assert.equal(byAmount.length, 1);
  assert.equal(byAmount[0].customerName, 'Bilal Ahmad');

  // Filter with no match
  const noMatch = filterDailyClosingReceipts(receipts, 'NonExistent');
  assert.equal(noMatch.length, 0);

  // Safety on empty inputs
  assert.deepEqual(filterDailyClosingReceipts(null, 'test'), []);
  assert.deepEqual(filterDailyClosingReceipts([], 'test'), []);
});

test('sortDailyClosingReceipts sorts receipts accurately across all columns', () => {
  const receipts = [
    { customerNumber: 105, customerName: 'Bilal Ahmad', mohalla: 'Bara Dari', billMonth: '2026-10', amount: 3200, method: 'Cash at Hassan shop', paidBy: 'Hassan' },
    { customerNumber: 101, customerName: 'Ali Khan', mohalla: 'Main Bazar', billMonth: '2026-10', amount: 2500, method: 'Cash', paidBy: 'Ali' },
    { customerNumber: 110, customerName: 'Zainab Bibi', mohalla: 'Main Bazar', billMonth: '2026-09', amount: 1500, method: 'Easypaisa', paidBy: 'Zainab' },
    { customerNumber: 102, customerName: 'Usman Tariq', mohalla: 'Shahdara Town', billMonth: '2026-10', amount: 1800, method: 'JazzCash', paidBy: 'Online Portal' }
  ];

  // Sort by customerNumber ascending
  const byNumAsc = sortDailyClosingReceipts(receipts, 'customerNumber', true);
  assert.deepEqual(byNumAsc.map(r => r.customerNumber), [101, 102, 105, 110]);

  // Sort by customerNumber descending
  const byNumDesc = sortDailyClosingReceipts(receipts, 'customerNumber', false);
  assert.deepEqual(byNumDesc.map(r => r.customerNumber), [110, 105, 102, 101]);

  // Sort by amount ascending
  const byAmountAsc = sortDailyClosingReceipts(receipts, 'amount', true);
  assert.deepEqual(byAmountAsc.map(r => r.amount), [1500, 1800, 2500, 3200]);

  // Sort by amount descending
  const byAmountDesc = sortDailyClosingReceipts(receipts, 'amount', false);
  assert.deepEqual(byAmountDesc.map(r => r.amount), [3200, 2500, 1800, 1500]);

  // Sort by customerName ascending
  const byNameAsc = sortDailyClosingReceipts(receipts, 'customerName', true);
  assert.deepEqual(byNameAsc.map(r => r.customerName), ['Ali Khan', 'Bilal Ahmad', 'Usman Tariq', 'Zainab Bibi']);

  // Sort by customerName descending
  const byNameDesc = sortDailyClosingReceipts(receipts, 'customerName', false);
  assert.deepEqual(byNameDesc.map(r => r.customerName), ['Zainab Bibi', 'Usman Tariq', 'Bilal Ahmad', 'Ali Khan']);

  // Sort by mohalla
  const byMohalla = sortDailyClosingReceipts(receipts, 'mohalla', true);
  assert.equal(byMohalla[0].mohalla, 'Bara Dari');
  assert.equal(byMohalla[byMohalla.length - 1].mohalla, 'Shahdara Town');

  // Null / undefined safety
  assert.deepEqual(sortDailyClosingReceipts(null), []);
  assert.deepEqual(sortDailyClosingReceipts([]), []);
});

test('setupDailyClosingModal wires receipts search, column sort, count badge and reset', () => {
  let state = createInitialState(['Modal Cust A', 'Modal Cust B']);
  const refDate = new Date('2026-10-18T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', {
    amount: '1200',
    date: '2026-10-18',
    method: 'Cash',
    paidBy: 'Direct'
  }, refDate);

  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', {
    amount: '2500',
    date: '2026-10-18',
    method: 'JazzCash',
    paidBy: 'Collector Waseem'
  }, refDate);

  // Mock DOM
  const eventListeners = new Map();
  function createMockElement(id, tag = 'div') {
    const listeners = {};
    const attrs = {};
    const children = [];
    return {
      id,
      tagName: tag.toUpperCase(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      hidden: false,
      getAttribute: (name) => attrs[name] || null,
      setAttribute: (name, val) => { attrs[name] = val; },
      removeAttribute: (name) => { delete attrs[name]; },
      addEventListener: (type, handler) => {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(handler);
      },
      dispatchEvent: (evt) => {
        const type = typeof evt === 'string' ? evt : evt.type;
        const handlers = listeners[type] || [];
        handlers.forEach(h => h(typeof evt === 'string' ? { type } : evt));
      },
      querySelector: (selector) => {
        if (selector === '.sort-indicator') return createMockElement('sort-indicator', 'span');
        return null;
      },
      querySelectorAll: () => [],
      focus: () => {}
    };
  }

  const modalEl = createMockElement('dailyClosingModal', 'dialog');
  const searchInput = createMockElement('dailyClosingReceiptsSearch', 'input');
  const countBadge = createMockElement('dailyClosingReceiptsCount', 'span');
  const resetBtn = createMockElement('resetDailyClosingReceiptsBtn', 'button');
  const tableBody = createMockElement('dailyClosingReceiptsTableBody', 'tbody');
  const emptyEl = createMockElement('dailyClosingReceiptsEmpty', 'p');

  const thCustNum = createMockElement('thNum', 'th');
  thCustNum.setAttribute('data-sort-dcr', 'customerNumber');
  const thAmount = createMockElement('thAmt', 'th');
  thAmount.setAttribute('data-sort-dcr', 'amount');

  modalEl.querySelectorAll = (selector) => {
    if (selector === 'th[data-sort-dcr]') return [thCustNum, thAmount];
    return [];
  };

  const elementsMap = {
    dailyClosingModal: modalEl,
    dailyClosingReceiptsSearch: searchInput,
    dailyClosingReceiptsCount: countBadge,
    resetDailyClosingReceiptsBtn: resetBtn,
    dailyClosingReceiptsTableBody: tableBody,
    dailyClosingReceiptsEmpty: emptyEl,
    dailyClosingDateInput: createMockElement('dailyClosingDateInput', 'input')
  };

  const originalDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null
  };

  try {
    const controller = setupDailyClosingModal(() => state, { referenceDate: refDate });
    assert.ok(controller, 'Controller should initialize');

    controller.render();

    // Initial render should show both receipts
    assert.ok(countBadge.textContent.includes('2 Receipts'));
    assert.ok(tableBody.innerHTML.includes('Modal Cust A'));
    assert.ok(tableBody.innerHTML.includes('Modal Cust B'));
    assert.equal(thCustNum.getAttribute('aria-sort'), 'ascending');

    // Simulate search filter: type "Cust A"
    searchInput.value = 'Cust A';
    searchInput.dispatchEvent('input');

    assert.ok(countBadge.textContent.includes('1 of 2 Receipts'));
    assert.ok(tableBody.innerHTML.includes('Modal Cust A'));
    assert.ok(!tableBody.innerHTML.includes('Modal Cust B'));
    assert.equal(resetBtn.style.display, 'inline-block');

    // Simulate clicking reset button
    resetBtn.dispatchEvent('click');
    assert.equal(searchInput.value, '');
    assert.ok(countBadge.textContent.includes('2 Receipts'));
    assert.ok(tableBody.innerHTML.includes('Modal Cust B'));

    // Simulate sorting by amount
    thAmount.dispatchEvent('click');
    assert.equal(thAmount.getAttribute('aria-sort'), 'descending');

    // Toggle amount sort ascending
    thAmount.dispatchEvent('click');
    assert.equal(thAmount.getAttribute('aria-sort'), 'ascending');
  } finally {
    globalThis.document = originalDoc;
  }
});

test('HTML and CSS integrity for daily closing receipts table polish', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

  // Verify elements in index.html
  assert.ok(indexHtml.includes('id="dailyClosingReceiptsSearch"'), 'index.html must have dailyClosingReceiptsSearch');
  assert.ok(indexHtml.includes('id="dailyClosingReceiptsCount"'), 'index.html must have dailyClosingReceiptsCount');
  assert.ok(indexHtml.includes('id="resetDailyClosingReceiptsBtn"'), 'index.html must have resetDailyClosingReceiptsBtn');
  assert.ok(indexHtml.includes('data-sort-dcr="customerNumber"'), 'index.html must have data-sort-dcr customerNumber');
  assert.ok(indexHtml.includes('data-sort-dcr="customerName"'), 'index.html must have data-sort-dcr customerName');
  assert.ok(indexHtml.includes('data-sort-dcr="mohalla"'), 'index.html must have data-sort-dcr mohalla');
  assert.ok(indexHtml.includes('data-sort-dcr="amount"'), 'index.html must have data-sort-dcr amount');

  // Verify styles in styles.css
  assert.ok(stylesCss.includes('.daily-closing-receipts-toolbar'), 'styles.css must style .daily-closing-receipts-toolbar');
  assert.ok(stylesCss.includes('th[data-sort-dcr]'), 'styles.css must style th[data-sort-dcr]');
  assert.ok(stylesCss.includes('[data-theme="dark"] .daily-closing-receipts-toolbar'), 'styles.css must support dark theme for receipts toolbar');
  assert.ok(stylesCss.includes('@media (max-width: 640px)'), 'styles.css must have responsive media query');
});
