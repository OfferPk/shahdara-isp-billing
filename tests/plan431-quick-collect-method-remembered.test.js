// Plan 431 — Quick Collect payment method remembered per customer:
// the method of the customer's last payment is pre-selected on the
// Quick Collect screen (normal form and one screen), changeable, and
// a customer with no past payment pre-selects nothing. The memory
// pre-selects only — it posts nothing and never changes any bill,
// payment, preferred channel, or customer record by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rememberedPaymentMethod,
  rememberedPaymentMethodOfPayments,
} from '../remembered-method.js';
import { PAYMENT_METHODS } from '../core.js';

const moduleSrc = readFileSync(new URL('../remembered-method.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

// The same fixture the acceptance uses: two bills, the latest payment
// by JazzCash, an earlier one by Easypaisa.
function fixtureCustomer() {
  return {
    id: 'cust-1',
    customerNumber: 1,
    name: 'Cust One',
    monthlySellingAmount: 2500,
    bills: [
      {
        id: 'b-1', month: '2026-08', dueAmount: 2500, status: 'paid',
        payments: [{ id: 'p-1', date: '2026-08-05', amount: 2500, method: 'Easypaisa', paidBy: 'Self' }],
      },
      {
        id: 'b-2', month: '2026-09', dueAmount: 2500, status: 'partial',
        payments: [{ id: 'p-2', date: '2026-09-07', amount: 1000, method: 'JazzCash', paidBy: 'Shop Cashier' }],
      },
    ],
  };
}

test('acceptance: the pre-selected method matches the last payment method', () => {
  assert.equal(rememberedPaymentMethod(fixtureCustomer(), PAYMENT_METHODS), 'JazzCash');
});

test('latest date wins even when the payments arrive out of order', () => {
  const payments = [
    { id: 'p-2', date: '2026-09-07', amount: 1000, method: 'JazzCash' },
    { id: 'p-1', date: '2026-08-05', amount: 2500, method: 'Easypaisa' },
  ];
  assert.equal(rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS), 'JazzCash');
});

test('same-day ties break by payment id, latest id wins', () => {
  const payments = [
    { id: 'p-1', date: '2026-09-07', amount: 1000, method: 'Easypaisa' },
    { id: 'p-2', date: '2026-09-07', amount: 1000, method: 'JazzCash' },
  ];
  assert.equal(rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS), 'JazzCash');
});

test('a shop method from the last payment is remembered exactly', () => {
  const payments = [
    { id: 'p-1', date: '2026-09-07', amount: 1000, method: 'Cash at Hassan Balla shop' },
  ];
  assert.equal(
    rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS),
    'Cash at Hassan Balla shop',
  );
});

test('a customer with no past payment remembers nothing', () => {
  const customer = {
    id: 'cust-2', customerNumber: 2, name: 'Cust Two',
    bills: [{ id: 'b-1', month: '2026-09', dueAmount: 2500, status: 'unpaid', payments: [] }],
  };
  assert.equal(rememberedPaymentMethod(customer, PAYMENT_METHODS), null);
});

test('a customer with no bills remembers nothing', () => {
  assert.equal(
    rememberedPaymentMethod({ id: 'cust-3', customerNumber: 3, name: 'Cust Three', bills: [] }, PAYMENT_METHODS),
    null,
  );
  assert.equal(
    rememberedPaymentMethod({ id: 'cust-4', customerNumber: 4, name: 'Cust Four' }, PAYMENT_METHODS),
    null,
  );
});

test('a missing or unusable customer remembers nothing', () => {
  assert.equal(rememberedPaymentMethod(null, PAYMENT_METHODS), null);
  assert.equal(rememberedPaymentMethod(undefined, PAYMENT_METHODS), null);
  assert.equal(rememberedPaymentMethod('cust-1', PAYMENT_METHODS), null);
});

test('a last payment with no usable method remembers nothing', () => {
  assert.equal(
    rememberedPaymentMethodOfPayments([{ id: 'p-1', date: '2026-09-07', amount: 1000 }], PAYMENT_METHODS),
    null,
  );
  assert.equal(
    rememberedPaymentMethodOfPayments([{ id: 'p-1', date: '2026-09-07', amount: 1000, method: '' }], PAYMENT_METHODS),
    null,
  );
  assert.equal(
    rememberedPaymentMethodOfPayments([{ id: 'p-1', date: '2026-09-07', amount: 1000, method: '   ' }], PAYMENT_METHODS),
    null,
  );
});

test('a last payment whose method is not offered remembers nothing', () => {
  const payments = [
    { id: 'p-1', date: '2026-08-05', amount: 2500, method: 'Easypaisa' },
    { id: 'p-2', date: '2026-09-07', amount: 1000, method: 'Some Other Way' },
  ];
  assert.equal(rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS), null);
});

test('a whitespace-padded method still matches the offered method', () => {
  const payments = [
    { id: 'p-1', date: '2026-09-07', amount: 1000, method: ' JazzCash ' },
  ];
  assert.equal(rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS), 'JazzCash');
});

test('no offered methods means nothing is remembered', () => {
  const payments = [{ id: 'p-1', date: '2026-09-07', amount: 1000, method: 'JazzCash' }];
  assert.equal(rememberedPaymentMethodOfPayments(payments, []), null);
  assert.equal(rememberedPaymentMethodOfPayments(payments, null), null);
  assert.equal(rememberedPaymentMethod(fixtureCustomer(), []), null);
});

test('a non-array payments value remembers nothing', () => {
  assert.equal(rememberedPaymentMethodOfPayments(null, PAYMENT_METHODS), null);
  assert.equal(rememberedPaymentMethodOfPayments('JazzCash', PAYMENT_METHODS), null);
  assert.equal(rememberedPaymentMethodOfPayments(undefined, PAYMENT_METHODS), null);
});

test('the input list is never mutated or reordered', () => {
  const payments = [
    { id: 'p-2', date: '2026-09-07', amount: 1000, method: 'JazzCash' },
    { id: 'p-1', date: '2026-08-05', amount: 2500, method: 'Easypaisa' },
  ];
  const before = payments.map((p) => p.id).join(',');
  assert.equal(rememberedPaymentMethodOfPayments(payments, PAYMENT_METHODS), 'JazzCash');
  assert.equal(payments.map((p) => p.id).join(','), before);
});

test('the module is pure: no store, no storage, no clock, no network, no import', () => {
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('import '), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(moduleSrc.includes('window.'), false);
});

// The fenced modules are built from fragments so this file never names
// any of them literally — the same rule the module header follows.
const fenced = [
  ['dues', 'amount-default.js'],
  ['quick-collect', 'one-screen.js'],
  ['name-prefix', 'lookup.js'],
  ['recent-quick', 'pick.js'],
  ['one-screen-quick', 'amounts.js'],
  ['payment', 'channel.js'],
  ['history-method', 'filter.js'],
  ['save-confirmation', 'summary.js'],
  ['full-history', 'list.js'],
  ['balance', 'rollforward.js'],
].map(([a, b]) => a + '-' + b);

test('fence: the module header never names a fenced module literally', () => {
  for (const name of fenced) {
    assert.equal(moduleSrc.includes(name), false, `module must not name ${name}`);
  }
});

test('defaults: a customer with a last payment gets it as defaultMethod', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = { customers: [fixtureCustomer()] };
  const defaults = getCustomerPaymentDefaults(state, 'cust-1', new Date('2026-09-20T12:00:00Z'));
  assert.equal(defaults.defaultMethod, 'JazzCash');
  assert.equal(defaults.lastPaidBy, 'Shop Cashier');
});

test('defaults: a customer with no past payment gets a null defaultMethod', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = {
    customers: [{
      id: 'cust-2', customerNumber: 2, name: 'Cust Two', monthlySellingAmount: 2500,
      bills: [{ id: 'b-1', month: '2026-09', dueAmount: 2500, status: 'unpaid', payments: [] }],
    }],
  };
  const defaults = getCustomerPaymentDefaults(state, 'cust-2', new Date('2026-09-20T12:00:00Z'));
  assert.equal(defaults.defaultMethod, null);
});

test('wiring: the form pre-selects the remembered method and nothing when there is none', () => {
  assert.ok(wiringSrc.includes("methodSelect.value = activeDefaults.defaultMethod ?? '';"),
    'the form select takes the remembered method, or nothing');
  assert.ok(wiringSrc.includes("syncMethodChips(activeDefaults.defaultMethod ?? '');"),
    'the method chips follow the same remembered value');
  assert.ok(wiringSrc.includes("updateDigitalVisibility(activeDefaults.defaultMethod ?? '');"),
    'the digital fields follow the same remembered value');
  assert.equal(wiringSrc.includes("defaultMethod || 'Cash'"), false,
    'no Cash fallback may re-select a method for a customer with no past payment');
});

test('wiring: the one screen pre-selects the remembered method on customer change', () => {
  assert.ok(wiringSrc.includes("methodSelectOne.value = activeDefaults.defaultMethod ?? '';"),
    'the one-screen method select takes the remembered method, or nothing');
});

test('wiring: the remembered method is imported and used as the single source', () => {
  assert.ok(wiringSrc.includes("import { rememberedPaymentMethod } from './remembered-method.js';"));
  assert.ok(wiringSrc.includes('rememberedPaymentMethod(customer, PAYMENT_METHODS)'));
  assert.equal(wiringSrc.includes('QUICK_COLLECT_STORAGE_KEY') && wiringSrc.includes('savedMethod'), false,
    'the device-wide last-used fallback is gone from the defaults path');
});

test('wiring: no new element id is introduced for the remembered method', () => {
  assert.equal(wiringSrc.includes('rmd-'), false);
  assert.ok(wiringSrc.includes("getElementById('quickCollectMethodSelect')"),
    'the normal form reuses its existing method select');
  assert.ok(wiringSrc.includes("stepOneScreen.querySelector('#qosOneScreenMethod')"),
    'the one screen reuses its existing method select');
});

test('acceptance: the memory never changes a bill, payment, or customer record', () => {
  // The module exports only two pure readers; nothing in it writes.
  assert.equal(typeof rememberedPaymentMethod, 'function');
  assert.equal(typeof rememberedPaymentMethodOfPayments, 'function');
  const customer = fixtureCustomer();
  const snapshot = JSON.stringify(customer);
  rememberedPaymentMethod(customer, PAYMENT_METHODS);
  assert.equal(JSON.stringify(customer), snapshot);
});
