// Plan 624 — A digital second-connection payment carries the first
// payment's transaction reference (TID + sender, or the override
// reason) and the strict digital rule applies to the second path.
// C tests assert the FIXED state (they FAIL on the base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix). B tests are behaviour.
// This file is NOT a pinning file: it contains no parity literals.
// Harness: the polish #13 controller harness (mock DOM behind
// getElementById) extended with (a) the payment form's requestSubmit so
// the direct-save button posts through the real submit handler, (b) the
// billing-link loader option so the second-connection step renders,
// (c) the second-connection box's Record tap via a faked click target.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TODAY = getPakistanLocalDate(new Date());
const TID = 'TID-624-TEST-001';
const OVERRIDE = 'Test override reason';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find((c) => c.id === id)?.bills?.find((b) => b.month === month);

function linkList() {
  return [
    { id: 'BL-1', customer: 'seed-001', primaryConnection: 'House', linkedConnection: 'Shop', linkDate: '2026-10-01', linkNote: '', dateUnlinked: '' },
  ];
}

/** One synthetic customer on the PKR 3,000 package, with an October bill
 * still unpaid and a November bill — the October arrears are what leave
 * remaining dues after the first payment, so the second-connection step
 * is offered. (A single-bill partial payment reprices that bill to the
 * taken fee — executeQuickCollection's direct-collection rule — leaving
 * nothing owed and no step; the two-bill fixture is the realistic path
 * to the step.) */
function plan624State() {
  const oct29 = new Date(2026, 9, 29, 12);
  let state = createInitialState(['Second Connection Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, oct29);
  state = generateMonthlyBillsThroughCurrentMonth(state, oct29);
  state = generateMonthlyBillsThroughCurrentMonth(state, new Date());
  assert.equal(Number(billOf(state, '2026-10').dueAmount), 3000, 'precondition: October bill is 3,000');
  assert.equal(Number(billOf(state, MONTH).dueAmount), 3000, 'precondition: current bill is 3,000');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-10')?.balanceDueCents, 300000, 'precondition: 3,000 still due for October');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', MONTH)?.balanceDueCents, 300000, 'precondition: 3,000 still due for the current month');
  return state;
}

/**
 * Plan 624 controller harness: the polish #13 mock DOM, extended with
 * the payment form's requestSubmit (direct-save posts through the real
 * submit handler) and the billing-link loader option (the
 * second-connection step renders only with an active link).
 */
function plan624Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v ?? ''); }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };

  let state = initialState;
  const toasts = [];
  const controller = setupQuickCollectModal({
    getState: () => state,
    onSaveState: (next) => { state = next; },
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    onSelectCustomer: () => {},
    onEditCustomer: () => {},
    loadBillingLinks: () => linkList()
  });
  // The direct-save button posts via paymentForm.requestSubmit — wire
  // the mock form to dispatch the real submit handler.
  const form = getEl('quickCollectPaymentForm');
  form.requestSubmit = () => form.dispatch('submit');
  return {
    getEl, toasts, controller,
    get state() { return state; },
    async restore() {
      await new Promise((resolve) => setTimeout(resolve, 130));
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Record the first payment through the real submit (direct save). */
async function recordFirst(h, { method, amount, tid = '', senderName = '', senderDigits = '', overrideReason = '' }) {
  h.controller.open('seed-001');
  assert.ok(Number(h.getEl('quickCollectAmountInput').value) > 0, 'precondition: amount prefills the dues');
  h.getEl('quickCollectAmountInput').value = String(amount);
  h.getEl('quickCollectMethodSelect').value = method;
  h.getEl('quickCollectDateInput').value = TODAY;
  h.getEl('quickCollectTransactionIdInput').value = tid;
  h.getEl('quickCollectSenderNameInput').value = senderName;
  h.getEl('quickCollectSenderDigitsInput').value = senderDigits;
  h.getEl('quickCollectOverrideReasonInput').value = overrideReason;
  await h.getEl('quickCollectDirectSaveBtn').click();
  // The first payment lands on the target month — the OLDEST unpaid
  // bill (October here), not necessarily the current month — so find
  // the bill that gained the payment instead of assuming the month.
  const bill = h.state.customers[0].bills.find((b) => (b.payments ?? []).length === 1);
  assert.ok(bill, 'precondition: the first payment recorded');
  const firstMonth = bill.month;
  const payments = bill.payments ?? [];
  assert.equal(payments.length, 1, 'precondition: exactly one payment recorded');
  const stepBox = h.getEl('sccSecondConnectionStep');
  assert.equal(stepBox.hidden, false, 'precondition: the second-connection step is offered');
  assert.ok(stepBox.innerHTML.includes('Shop'), 'precondition: the step names the other connection');
  return { payment: payments[0], month: firstMonth };
}

/** Tap Record on the second-connection step. */
async function recordSecond(h, amount) {
  h.getEl('sccSecondConnectionAmount').value = String(amount);
  const box = h.getEl('sccSecondConnectionStep');
  await box.dispatch('click', { target: { id: 'sccSecondConnectionRecord' } });
  const bill = h.state.customers[0].bills.find((b) => (b.payments ?? []).some((p) => p.connection === 'Shop'));
  assert.ok(bill, 'precondition: the second payment recorded');
  const second = bill.payments.find((p) => p.connection === 'Shop');
  assert.ok(second, 'precondition: the second payment recorded');
  return { payment: second, month: bill.month };
}

test('C1: a digital second payment carries the first payment reference (TID + sender)', async () => {
  const h = plan624Controller(plan624State());
  try {
    await recordFirst(h, { method: 'Easypaisa', amount: 2000, tid: TID, senderName: 'Test Sender', senderDigits: '5678' });
    const { payment: second } = await recordSecond(h, 1000);
    assert.equal(second.transactionId || '', TID, 'the second payment carries the first payment TID');
    assert.equal(second.senderTitle || '', 'Test Sender', 'the second payment carries the sender');
    assert.equal(second.senderDigits || '', '5678', 'the second payment carries the sender digits');
  } finally { await h.restore(); }
});

test('C2: a digital second payment carries the first payment override reason when there is no TID', async () => {
  const h = plan624Controller(plan624State());
  try {
    await recordFirst(h, { method: 'Easypaisa', amount: 2000, tid: '', overrideReason: OVERRIDE });
    const { payment: second } = await recordSecond(h, 1000);
    assert.equal(second.referenceOverrideReason || '', OVERRIDE, 'the second payment carries the override reason');
  } finally { await h.restore(); }
});

test('C3: the second-connection path applies strictDigitalReference', () => {
  const src = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  const start = src.indexOf('function recordSecondConnectionPayment()');
  assert.ok(start >= 0, 'recordSecondConnectionPayment exists');
  const end = src.indexOf('// Plan 434:', start);
  assert.ok(end > start, 'recordSecondConnectionPayment region found');
  const body = src.slice(start, end);
  assert.ok(body.includes('strictDigitalReference: true'), 'the second-connection call never applies strictDigitalReference');
});

test('C4: a cash second payment records exactly as before — no reference, no refusal', async () => {
  const h = plan624Controller(plan624State());
  try {
    await recordFirst(h, { method: 'Cash', amount: 2000 });
    const { payment: second } = await recordSecond(h, 1000);
    assert.equal(second.transactionId || '', '', 'cash carries no reference');
    assert.equal(second.referenceOverrideReason || '', '', 'cash carries no override reason');
    assert.equal(Number(second.amount), 1000, 'cash amount records');
  } finally { await h.restore(); }
});

test('S1: a digital second payment still records the same amount, month and connection', async () => {
  const h = plan624Controller(plan624State());
  try {
    const { month: firstMonth } = await recordFirst(h, { method: 'Easypaisa', amount: 2000, tid: TID, senderName: 'Test Sender', senderDigits: '5678' });
    const { payment: second, month: secondMonth } = await recordSecond(h, 1000);
    assert.equal(Number(second.amount), 1000, 'amount records');
    assert.equal(second.connection, 'Shop', 'connection records');
    assert.equal(secondMonth, firstMonth, 'second payment records on the first payment month');
    assert.equal(second.method, 'Easypaisa', 'method inherits the first payment');
  } finally { await h.restore(); }
});

test('S2: the second-connection step is offered after a digital first payment', async () => {
  const h = plan624Controller(plan624State());
  try {
    await recordFirst(h, { method: 'Easypaisa', amount: 2000, tid: TID });
    const stepBox = h.getEl('sccSecondConnectionStep');
    assert.equal(stepBox.hidden, false, 'step shows');
    assert.ok(stepBox.innerHTML.includes('Method: Easypaisa'), 'step names the inherited method');
  } finally { await h.restore(); }
});

test('B1: the second-connection wiring is unchanged', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(page.includes('id="sccSecondConnectionStep"'), 'step host exists');
  const qc = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  assert.ok(qc.includes("from './quick-collect-second-connection.js'"), 'step module imported');
  assert.ok(qc.includes('function recordSecondConnectionPayment()'), 'second-connection recorder exists');
  assert.ok(qc.includes('executeQuickCollection(postSaveState, {'), 'second payment reuses the save path');
  assert.ok(qc.includes('connection: step.secondConnection,'), 'second payment names its connection');
});
