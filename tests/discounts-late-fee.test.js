import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLateFeeConfig,
  saveLateFeeConfig,
  validatePaymentDiscount,
  calculateNetBillSettlement,
  findOverdueBillsWithLateFeeStatus,
  applyLateFeeToBill,
  waiveLateFeeFromBill,
  applyLateFeeToEligibleBills,
  waiveLateFeeFromBills,
  formatLateFeeNoticeWhatsApp,
  generateLateFeeDiscountsCsv,
  generateLateFeeAuditPrintHtml,
  renderLateFeeDiscountsSvg,
  setupLateFeeModal
} from '../qa-discounts-late-fee.js';

function createMockStorage() {
  const store = new Map();
  return {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
}

function createSampleState() {
  return {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Muhammad Tariq',
        phone: '03001234567',
        mohalla: 'Baradari',
        status: 'Active',
        bills: [
          {
            month: '2026-09',
            dueAmount: 1500,
            dueDate: '2026-09-05',
            payments: []
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 102,
        name: 'Zahid Khan',
        phone: '03217654321',
        mohalla: 'Jia Musa',
        status: 'Active',
        bills: [
          {
            month: '2026-09',
            dueAmount: 2000,
            dueDate: '2026-09-05',
            lateFee: 150,
            lateFeeAppliedAt: '2026-09-10T10:00:00Z',
            lateFeeReason: 'Overdue bill surcharge',
            payments: [
              { amount: 500, date: '2026-09-12', discount: 100 }
            ]
          }
        ]
      }
    ]
  };
}

test('Late fee policy: default configuration is disabled and safe', () => {
  const storage = createMockStorage();
  const config = getLateFeeConfig(storage);
  assert.equal(config.enabled, false, 'Late fee policy must be disabled by default');
  assert.equal(config.defaultAmount, 100);
  assert.equal(config.graceDays, 0);
  assert.equal(typeof config.reason, 'string');
});

test('Late fee policy: save custom config and validate bounds', () => {
  const storage = createMockStorage();
  const ok = saveLateFeeConfig({
    enabled: true,
    defaultAmount: 200,
    graceDays: 5,
    reason: 'Grace period expired'
  }, storage);
  assert.equal(ok, true);

  const reloaded = getLateFeeConfig(storage);
  assert.equal(reloaded.enabled, true);
  assert.equal(reloaded.defaultAmount, 200);
  assert.equal(reloaded.graceDays, 5);
  assert.equal(reloaded.reason, 'Grace period expired');
});

test('calculateNetBillSettlement computes correct balances with late fee and discounts', () => {
  const result = calculateNetBillSettlement({
    billDue: 1500,
    lateFee: 200,
    paymentAmount: 500,
    discount: 100
  });
  assert.equal(result.baseDue, 1500);
  assert.equal(result.lateFee, 200);
  assert.equal(result.cashApplied, 500);
  assert.equal(result.discountApplied, 100);
  // Net balance = 1500 + 200 - 100 - 500 = 1100
  assert.equal(result.balanceDue, 1100);
});

test('applyLateFeeToBill and waiveLateFeeFromBill modify state accurately', () => {
  let state = createSampleState();
  
  // Apply late fee to cust-1
  state = applyLateFeeToBill(state, 'cust-1', '2026-09', {
    amount: 150,
    reason: 'Owner surcharge'
  });
  const bill1 = state.customers[0].bills[0];
  assert.equal(bill1.lateFee, 150);
  assert.equal(bill1.lateFeeReason, 'Owner surcharge');
  assert.ok(bill1.lateFeeAppliedAt);

  // Waive late fee from cust-2
  state = waiveLateFeeFromBill(state, 'cust-2', '2026-09', {
    reason: 'Waived on request'
  });
  const bill2 = state.customers[1].bills[0];
  assert.equal(bill2.lateFee, 0);
  assert.equal(bill2.lateFeeReason, 'Waived on request');
});

test('applyLateFeeToEligibleBills and waiveLateFeeFromBills batch operations work', () => {
  let state = createSampleState();
  const keys = [{ customerId: 'cust-1', month: '2026-09' }];
  state = applyLateFeeToEligibleBills(state, keys, {
    amount: 120,
    reason: 'Batch late fee'
  });
  assert.equal(state.customers[0].bills[0].lateFee, 120);

  state = waiveLateFeeFromBills(state, keys, {
    reason: 'Batch waiver'
  });
  assert.equal(state.customers[0].bills[0].lateFee, 0);
});

test('findOverdueBillsWithLateFeeStatus summarizes late fee roster and metrics', () => {
  const state = createSampleState();
  const policy = { enabled: true, defaultAmount: 150, graceDays: 0 };
  const audit = findOverdueBillsWithLateFeeStatus(state, {
    asOfDate: '2026-10-01',
    policy
  });

  assert.ok(audit.rows.length >= 1);
  assert.equal(typeof audit.metrics.totalOverdueCount, 'number');
  assert.equal(typeof audit.metrics.totalLateFeeAppliedPkr, 'number');
});

test('Late Fee SVG and Reports generate valid non-empty markup', () => {
  const state = createSampleState();
  const audit = findOverdueBillsWithLateFeeStatus(state, { asOfDate: '2026-10-01' });

  const svg = renderLateFeeDiscountsSvg(audit.metrics);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('Late Fee &amp; Discount Financial Impact'));

  const csv = generateLateFeeDiscountsCsv(state, { asOfDate: '2026-10-01' });
  assert.ok(csv.includes('Customer Number,Customer Name,Phone,Mohalla'));

  const a4Html = generateLateFeeAuditPrintHtml({ state, format: 'a4' });
  assert.ok(a4Html.includes('Overdue Bills, Late Fees & Discounts Audit Ledger'));

  const posHtml = generateLateFeeAuditPrintHtml({ state, format: 'pos80' });
  assert.ok(posHtml.includes('Overdue Dues & Late Fees Manifest'));
});

test('formatLateFeeNoticeWhatsApp creates bilingual notification message', () => {
  const customer = { customerNumber: 101, name: 'Muhammad Tariq', phone: '03001234567' };
  const row = { month: '2026-09', balanceDue: 1650, hasLateFee: true, lateFee: 150, lateFeeReason: 'Overdue' };
  const config = { defaultAmount: 150 };

  const text = formatLateFeeNoticeWhatsApp({ customer, row, config });
  assert.ok(text.includes('BROADBAND'));
  assert.ok(text.includes('Muhammad Tariq'));
  assert.ok(text.includes('1650'));
  assert.ok(text.includes('Late fee of PKR 150'));
});

test('setupLateFeeModal integrates with window.appConfirm on batch and row actions', async () => {
  let state = createSampleState();
  const storage = createMockStorage();

  const ids = [
    'lateFeeManagerModal', 'closeLateFeeModalBtn', 'lateFeePolicyToggle', 'lateFeeDefaultAmountInput',
    'lateFeeGraceDaysInput', 'lateFeeReasonInput', 'saveLateFeePolicyBtn', 'lateFeeBatchApplyBtn',
    'lateFeeBatchWaiveBtn', 'lateFeeSelectAllCheckbox', 'lateFeeRosterTableBody', 'lateFeeRosterEmpty',
    'lateFeeChartContainer', 'lateFeeKpiEligibleCount', 'lateFeeKpiOverdueCount',
    'lateFeeKpiAppliedTotal', 'lateFeeKpiDiscountsTotal', 'lateFeeExportCsvBtn',
    'lateFeePrintA4Btn', 'lateFeePrintThermalBtn',
    'quickActionLateFeeManager', 'openLateFeeManagerBtn'
  ];

  const listeners = {};
  const dom = {};
  ids.forEach(id => {
    dom[id] = {
      id,
      value: '',
      checked: false,
      style: {},
      hidden: false,
      innerHTML: '',
      textContent: '',
      dataset: {},
      addEventListener(evt, fn) {
        listeners[`${id}:${evt}`] = fn;
      },
      querySelectorAll: (sel) => {
        if (sel === 'input[type="checkbox"]:checked') {
          return [{ dataset: { customerId: 'cust-1', month: '2026-09' } }];
        }
        return [];
      },
      querySelector: () => null,
      closest: () => null,
      showModal: () => {},
      close: () => {}
    };
  });

  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById: (id) => dom[id] || null,
    querySelectorAll: () => []
  };

  let toastMessage = '';
  const onToast = (msg) => { toastMessage = msg; };

  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = storage;

  // Set up mock window.appConfirm
  let appConfirmCalled = 0;
  let appConfirmResult = true;
  globalThis.window = {
    appConfirm: async () => {
      appConfirmCalled++;
      return appConfirmResult;
    },
    open: () => {}
  };

  setupLateFeeModal({
    getState: () => state,
    updateState: (s) => { state = s; },
    toast: onToast
  });

  // Verify save policy handler
  dom['lateFeePolicyToggle'].checked = true;
  dom['lateFeeDefaultAmountInput'].value = '250';
  dom['lateFeeGraceDaysInput'].value = '2';
  dom['lateFeeReasonInput'].value = 'Late payment fee';
  listeners['saveLateFeePolicyBtn:click']();
  assert.equal(toastMessage, 'Late fee policy configuration saved locally.');

  // Test single row apply with appConfirm true
  appConfirmResult = true;
  appConfirmCalled = 0;
  const mockApplyEvent = {
    target: {
      closest: (selector) => {
        if (selector === '.apply-late-fee-row-btn') {
          return { dataset: { custId: 'cust-1', month: '2026-09' } };
        }
        return null;
      }
    }
  };
  await listeners['lateFeeRosterTableBody:click'](mockApplyEvent);
  assert.equal(appConfirmCalled, 1, 'appConfirm should be called on apply fee');
  assert.equal(state.customers[0].bills[0].lateFee, 250);

  // Test single row waive with appConfirm false (cancelled)
  appConfirmResult = false;
  appConfirmCalled = 0;
  const mockWaiveEvent = {
    target: {
      closest: (selector) => {
        if (selector === '.waive-late-fee-row-btn') {
          return { dataset: { custId: 'cust-1', month: '2026-09' } };
        }
        return null;
      }
    }
  };
  await listeners['lateFeeRosterTableBody:click'](mockWaiveEvent);
  assert.equal(appConfirmCalled, 1, 'appConfirm should be called on waive fee');
  assert.equal(state.customers[0].bills[0].lateFee, 250, 'Fee should not be waived when appConfirm returns false');

  // Test single row waive with appConfirm true (confirmed)
  appConfirmResult = true;
  await listeners['lateFeeRosterTableBody:click'](mockWaiveEvent);
  assert.equal(state.customers[0].bills[0].lateFee, 0, 'Fee should be waived when appConfirm returns true');

  // Test batch apply with appConfirm true
  appConfirmResult = true;
  appConfirmCalled = 0;
  await listeners['lateFeeBatchApplyBtn:click']();
  assert.equal(appConfirmCalled, 1, 'appConfirm should be called on batch apply');

  // Test batch waive with appConfirm true
  appConfirmCalled = 0;
  await listeners['lateFeeBatchWaiveBtn:click']();
  assert.equal(appConfirmCalled, 1, 'appConfirm should be called on batch waive');

  // Clean up mocks
  globalThis.document = origDoc;
  globalThis.localStorage = origLocalStorage;
  delete globalThis.window;
});
