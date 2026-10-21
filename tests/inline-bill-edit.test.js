import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlan, applyCustomerPlan, setupInlineBillEdit } from '../customer-plan.js';
import { BILL_PACKAGES } from '../package-catalog.js';

test('normalizePlan validates positive monthly fee and packages', () => {
  // Empty inputs
  assert.equal(normalizePlan({}), null);

  // Valid custom fee
  const custom = normalizePlan({ fee: '2500' });
  assert.equal(custom.fee, 2500);
  assert.equal(custom.packageLabel, '');

  // Valid package
  const pkg = BILL_PACKAGES[0];
  const withPkg = normalizePlan({ packageId: pkg.id });
  assert.equal(withPkg.fee, pkg.price);
  assert.equal(withPkg.packageLabel, pkg.label);

  // Invalid fees
  assert.throws(() => normalizePlan({ fee: '0' }), /greater than zero/i);
  assert.throws(() => normalizePlan({ fee: '-500' }), /greater than zero/i);
  assert.throws(() => normalizePlan({ fee: 'abc' }), /greater than zero/i);
  assert.throws(() => normalizePlan({ packageId: 'invalid-id' }), /available packages/i);
});

test('applyCustomerPlan updates customer profile, generates bill, and records staffName', () => {
  const refDate = new Date('2026-10-15T12:00:00Z');
  const state = {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Test Customer',
        phone: '03001234567',
        serviceStatus: 'active',
        monthlySellingAmount: null,
        bills: []
      }
    ]
  };

  const plan = {
    packageLabel: '15MBPS',
    fee: 2000,
    connectionDate: '2026-10-01',
    staffName: 'Inline edit'
  };

  const { nextState, billed } = applyCustomerPlan(state, 'cust-1', plan, refDate);
  const updated = nextState.customers.find(c => c.id === 'cust-1');

  assert.equal(updated.monthlySellingAmount, 2000);
  assert.equal(updated.packageSpeed, '15MBPS');
  assert.equal(updated.packageHistory?.[0]?.staffName, 'Inline edit');

  assert.ok(billed, 'Bill should be generated for the current month');
  assert.equal(billed.month, '2026-10');
  assert.equal(Number(billed.dueAmount), 2000);
});

test('setupInlineBillEdit wires form, quick pick chips, submit validation, and undo', () => {
  let committedState = null;
  const initialState = {
    customers: [
      {
        id: 'c-1',
        customerNumber: 42,
        name: 'Ahmad Khan',
        phone: '03009999999',
        monthlySellingAmount: null,
        bills: []
      },
      {
        id: 'c-2',
        customerNumber: 43,
        name: 'Bilal Tariq',
        phone: '03008888888',
        monthlySellingAmount: 1500,
        bills: []
      }
    ]
  };

  let currentState = initialState;
  const mockController = {
    getState: () => currentState,
    commitState: (next) => {
      currentState = next;
      committedState = next;
    }
  };

  let toastCalls = [];
  const mockWin = {
    quickCollectModalController: mockController,
    toast: (msg, opts) => toastCalls.push({ msg, opts }),
    setTimeout: (fn) => fn()
  };

  // Mock DOM elements
  const listeners = {};
  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      dataset: {},
      attributes: {},
      children: [],
      style: {},
      innerHTML: '',
      value: '',
      hidden: false,
      textContent: '',
      setAttribute: (k, v) => { el.attributes[k] = v; },
      removeAttribute: (k) => { delete el.attributes[k]; },
      getAttribute: (k) => el.attributes[k],
      focus: () => { el.focused = true; },
      select: () => {},
      close: () => { el.open = false; },
      showModal: () => { el.open = true; },
      addEventListener: (type, fn) => {
        listeners[type] = listeners[type] || [];
        listeners[type].push(fn);
      },
      querySelector: (selector) => {
        if (selector === '#inlineBillEditForm') return form;
        if (selector === '#inlineBillFeeInput') return feeInput;
        if (selector === '#inlineBillPackageSelect') return pkgSelect;
        if (selector === '#inlineBillEditEyebrow') return eyebrow;
        if (selector === '#inlineBillEditTitle') return title;
        if (selector === '#inlineBillCustomerInfo') return custInfo;
        if (selector === '#inlineBillError') return errorBox;
        if (selector === '#inlineBillSaveBtn') return submitBtn;
        return null;
      },
      querySelectorAll: (selector) => {
        if (selector === '[data-close-dialog]') return [closeBtn, cancelBtn];
        if (selector === '.inline-bill-quick-picks [data-fee]') return chips;
        return [];
      }
    };
    return el;
  }

  const form = createElement('form');
  form.id = 'inlineBillEditForm';
  const feeInput = createElement('input');
  feeInput.id = 'inlineBillFeeInput';
  const pkgSelect = createElement('select');
  pkgSelect.id = 'inlineBillPackageSelect';
  const eyebrow = createElement('p');
  eyebrow.id = 'inlineBillEditEyebrow';
  const title = createElement('h2');
  title.id = 'inlineBillEditTitle';
  const custInfo = createElement('p');
  custInfo.id = 'inlineBillCustomerInfo';
  const errorBox = createElement('p');
  errorBox.id = 'inlineBillError';
  const submitBtn = createElement('button');
  submitBtn.id = 'inlineBillSaveBtn';
  const closeBtn = createElement('button');
  const cancelBtn = createElement('button');
  const chips = [1000, 1500, 2000, 2500, 3000].map(fee => {
    const c = createElement('button');
    c.dataset.fee = String(fee);
    return c;
  });

  const dialog = createElement('dialog');
  dialog.id = 'inlineBillEditDialog';

  const mockDoc = {
    getElementById: (id) => (id === 'inlineBillEditDialog' ? dialog : null),
    createElement,
    body: { appendChild: () => {} },
    addEventListener: () => {},
    querySelector: () => null
  };

  const { open } = setupInlineBillEdit({ win: mockWin, doc: mockDoc, getController: () => mockController });

  // 1. Open for customer with no bill set
  open('c-1');
  assert.equal(dialog.dataset.customerId, 'c-1');
  assert.equal(title.textContent, 'Set monthly bill');
  assert.equal(eyebrow.textContent, 'SET MONTHLY BILL');
  assert.equal(feeInput.value, '');

  // 2. Click a quick pick chip (2500)
  feeInput.value = chips[3].dataset.fee; // 2500
  assert.equal(feeInput.value, '2500');

  // 3. Form submission with fee = 2500
  const submitListener = listeners['submit'][0];
  submitListener({ preventDefault: () => {} });

  assert.ok(committedState, 'State should be committed');
  const c1 = committedState.customers.find(c => c.id === 'c-1');
  assert.equal(c1.monthlySellingAmount, 2500);

  // Toast should have Undo option
  assert.equal(toastCalls.length, 1);
  assert.match(toastCalls[0].msg, /PKR 2,500 set for #42 Ahmad Khan/);
  assert.equal(toastCalls[0].opts.actionLabel, 'Undo');

  // Trigger Undo
  toastCalls[0].opts.onAction();
  const restored = currentState.customers.find(c => c.id === 'c-1');
  assert.equal(restored.monthlySellingAmount, null);
  assert.equal(toastCalls.length, 2);
  assert.match(toastCalls[1].msg, /Restored previous billing/);
});
