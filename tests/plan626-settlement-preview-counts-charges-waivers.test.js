// Plan 626 — Settlement preview counts charges and waivers.
//
// The settlement preview told the operator which bills the typed
// amount would settle — but it only knew about bills. The amount
// field defaults to the payable total (bills PLUS pending ticket
// charges, addon/boost charges and manual baqaya), so a payment of
// exactly the payable total previewed as "bill settled in full"
// plus "PKR 500 left over after all open bills", when the PKR 500
// was not leftover at all: the save settles it against the charge.
// And a ticked late-fee waiver was not in the figures at all, so
// the preview walked the snapped amount over balances that still
// included the fee and showed the bill as partly settled, while the
// save waives the fee and settles the bill in full.
//
// This file is NOT a pinning file: 0 parity literals.
//
// Harness: the Plan 625 mock DOM + controller harness (mock elements
// behind getElementById, amount input event drives the preview, submit
// + Plan 382 confirm), extended with (a) a localStorage stub so the
// controller's loadTickets() sees the fixture ticket charges, and (b)
// a working waiver checkbox behind the waiver box's querySelector (the
// 625 harness returns null there, which would leave the waiver
// untickable). Synthetic data only — no real customer names, no
// realistic phone numbers (pattern-fake digits only).
//
// Harness lesson (from the Plan 626 repro, which OOM'd first): the
// mock's dispatch MUST snapshot the listener list, and the cached
// waiver checkbox MUST be cleared on every innerHTML set — the
// waiver handler re-renders the box and attaches another listener
// to the same mock checkbox, which loops forever on a live list.
// The real DOM destroys the old checkbox on re-render, so the loop
// cannot happen there. Do NOT "improve" the mock back to live
// iteration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { settlementPreview, settlementPreviewMarkup } from '../partial-settlement-preview.js';

const root = process.argv[2] || '.';
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);
const { createTicket, resolveTicket } = await import(pathToFileURL(join(root, 'complaint-tickets.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const REF = new Date();
const TICKET_AMOUNT = 500;
const ADDON_AMOUNT = 200;
const BAQAYA_AMOUNT = 300;
const LATE_FEE = 300;

function plan626State(now, { lateFee = 0, addon = false, baqaya = false } = {}) {
  let state = createInitialState(['Plan626 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  if (lateFee > 0) bill.lateFee = lateFee;
  if (addon) {
    customer.speedBoosts = [{
      boostId: 'BST-101', boostMbps: 10, durationDays: 7,
      addonFeePKR: ADDON_AMOUNT, startDate: '2026-11-01',
      expiryDate: '2026-11-08', chargePaid: false
    }];
  }
  if (baqaya) {
    customer.manualBaqaya = [{ id: 'MBQ-101', amount: BAQAYA_AMOUNT, date: '2026-10-01' }];
  }
  return state;
}

function ticketList() {
  const created = createTicket({
    customerId: 'seed-001',
    customerName: 'Plan626 Tester',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Test Lineman'
  }, []);
  return resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: TICKET_AMOUNT }],
    billingType: 'billed',
    referenceDate: REF
  });
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

const balanceDueCents = (state, month) =>
  calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents;

/** Plan 625's mock DOM + controller harness, with a working waiver
 *  checkbox behind the waiver box's querySelector and an optional
 *  localStorage stub carrying fixture tickets. */
function mockDom() {
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
      dispatch: async (type, evt = {}) => { for (const h of [...(listeners[type] || [])]) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: (sel) => {
        // The waiver box re-renders its checkbox on every render; the
        // mock keeps one working checkbox per box so the tick can be
        // driven through the same change event the real UI fires.
        if (String(sel || '').includes('data-qc-waive-late-fee')) {
          if (!el._waiverCheckbox) el._waiverCheckbox = createMockElement(`${id}-waiver-checkbox`, 'input');
          return el._waiverCheckbox;
        }
        return null;
      },
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
      // A re-render replaces the box's children (the real DOM
      // destroys the old checkbox and creates a new one), so the
      // cached waiver checkbox dies with the render.
      set: (v) => { html = String(v ?? ''); el.children.length = 0; el._waiverCheckbox = undefined; }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  getEl('quickCollectDuplicateWarning').hidden = true;
  const form = getEl('quickCollectPaymentForm', 'form');
  form.dispatchEvent = (evt) => form.dispatch(evt.type, evt);
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  return { getEl, documentStub };
}

async function withController(state, fn, { tickets = null } = {}) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  const origStorage = globalThis.localStorage;
  globalThis.document = documentStub;
  if (tickets) {
    const storage = memoryStorage();
    storage.setItem('sisp_tickets_v1', JSON.stringify(tickets));
    globalThis.localStorage = storage;
  }
  try {
    let current = state;
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {}
    });
    await fn({ controller, getEl, toasts, getState: () => current });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
    if (tickets) {
      if (origStorage === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = origStorage;
    }
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

const errorToast = (toasts) => toasts.find((t) => t.opts?.type === 'error');

async function typeAmount(getEl, amount) {
  getEl('quickCollectAmountInput').value = String(amount);
  await getEl('quickCollectAmountInput').dispatch('input');
}

const previewHtml = (getEl) => getEl('quickCollectSettlementPreview').innerHTML;

async function tickWaiver(getEl) {
  const box = getEl('quickCollectLateFeeWaiverBox');
  const checkbox = box.querySelector('[data-qc-waive-late-fee]');
  assert.ok(checkbox, 'precondition: the waiver box renders a tickable checkbox');
  checkbox.checked = true;
  await checkbox.dispatch('change');
}

test('C1: a payment of exactly the payable total previews no leftover when a ticket charge is pending', async () => {
  const tickets = ticketList();
  await withController(plan626State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    assert.equal(getEl('quickCollectAmountInput').value, '3500', 'precondition: the amount defaults to dues 3,000 + charge 500');
    await typeAmount(getEl, 3500);
    const html = previewHtml(getEl);
    assert.ok(html.includes('settled in full'), `precondition: the bill line settles in full — got: ${html}`);
    assert.ok(!html.includes('left over'), `the PKR 500 is not leftover — it settles the charge — got: ${html}`);
    assert.ok(html.includes('PKR 500'), `the charge appears as a settled line — got: ${html}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  }, { tickets });
});

test('C2: a ticked late-fee waiver previews the bill settled in full, never partly settled', async () => {
  await withController(plan626State(new Date(), { lateFee: LATE_FEE }), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    assert.equal(balanceDueCents(getState(), MONTH), 330000, 'precondition: the bill carries the 300 late fee (3,000 + 300 = 330,000 cents)');
    await typeAmount(getEl, 3000);
    let html = previewHtml(getEl);
    assert.ok(html.includes('remains'), `precondition: unticked, the preview shows the fee still owed — got: ${html}`);
    await tickWaiver(getEl);
    assert.equal(getEl('quickCollectAmountInput').value, '3000.00', 'the waiver tick snaps the amount to the principal');
    html = previewHtml(getEl);
    assert.ok(html.includes('settled in full'), `the waived bill previews settled in full — got: ${html}`);
    assert.ok(!html.includes('remains'), `no fee remains on the preview — got: ${html}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C3: all three charge kinds preview settled in the engine order — baqaya, then ticket, then addon', async () => {
  const tickets = ticketList();
  await withController(plan626State(new Date(), { addon: true, baqaya: true }), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    assert.equal(getEl('quickCollectAmountInput').value, '4000', 'precondition: the amount defaults to dues 3,000 + charges 1,000');
    await typeAmount(getEl, 4000);
    const html = previewHtml(getEl);
    assert.ok(html.includes('settled in full'), `precondition: the bill line settles in full — got: ${html}`);
    assert.ok(!html.includes('left over'), `nothing is left over — every charge settles — got: ${html}`);
    for (const amount of ['PKR 300', 'PKR 500', 'PKR 200']) {
      assert.ok(html.includes(amount), `the ${amount} charge appears as a settled line — got: ${html}`);
    }
    const baqayaAt = html.indexOf('PKR 300');
    const ticketAt = html.indexOf('PKR 500');
    const addonAt = html.indexOf('PKR 200');
    assert.ok(baqayaAt > -1 && ticketAt > -1 && addonAt > -1, 'all three charge amounts appear');
    assert.ok(baqayaAt < ticketAt && ticketAt < addonAt,
      `charges preview in the engine settle order (baqaya, ticket, addon) — got: ${html}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  }, { tickets });
});

test('C4: the preview total matches the record — a 3,500 payment stamps the 500 ticket charge', async () => {
  const tickets = ticketList();
  const ticketId = tickets[0].id;
  await withController(plan626State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeAmount(getEl, 3500);
    assert.ok(!previewHtml(getEl).includes('left over'), 'precondition: the preview shows no leftover');
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.equal(recorded[0].method, 'Cash', 'the recorded method is Cash');
    assert.deepEqual(recorded[0].ticketCharges, [{ ticketId, amount: 500 }],
      'the record stamps the settled ticket charge, exactly as the preview showed');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  }, { tickets });
});

test('C5: the preview total matches the record — a waived payment stamps the waived fee', async () => {
  await withController(plan626State(new Date(), { lateFee: LATE_FEE }), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeAmount(getEl, 3000);
    await tickWaiver(getEl);
    assert.ok(previewHtml(getEl).includes('settled in full'), 'precondition: the preview shows the waived bill settled in full');
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.equal(recorded[0].lateFeeWaived, true, 'the record stamps the waiver');
    assert.equal(recorded[0].waivedAmount, 300, 'the record stamps the waived 300');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the bill is settled in full, fee included');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C6 (source): the preview feeds charges and the waiver, and the waiver tick refreshes it', () => {
  const src = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');

  const prevAt = src.indexOf('function renderSettlementPreview()');
  assert.ok(prevAt > -1, 'renderSettlementPreview must be defined');
  const prevFn = src.slice(prevAt, src.indexOf('function renderOverpaymentChoice()', prevAt));
  assert.ok(prevFn.includes('planManualBaqayaSettlement')
    || prevFn.includes('manualBaqayaPending')
    || prevFn.includes('ticketChargeLines'),
    'the preview feeds the pending charges (baqaya / ticket / addon)');
  assert.ok(prevFn.includes('waiverTicked') || prevFn.includes('planLateFeeWaiver'),
    'the preview reads the ticked waiver');

  // The waiver change handler must refresh the preview — a tick sets
  // the amount programmatically (no input event), so without this
  // call the fixed preview never renders (Candidate 5's refresh gap).
  const waiverAt = src.indexOf("checkbox?.addEventListener('change', () => {");
  assert.ok(waiverAt > -1, 'the waiver checkbox change handler must exist');
  const handler = src.slice(waiverAt, src.indexOf('function renderWaiverBox', waiverAt) === -1
    ? src.indexOf('// Owner feature: Change Package row', waiverAt)
    : src.indexOf('function renderWaiverBox', waiverAt));
  assert.ok(handler.includes('renderSettlementPreview();'),
    'the waiver tick refreshes the settlement preview');

  // Plan 385 pins the preview import line byte-identical — the fix
  // reuses the existing settlementPreview / settlementPreviewMarkup
  // imports, it does not extend them.
  assert.ok(src.includes("import { settlementPreview, settlementPreviewMarkup } from './partial-settlement-preview.js';"),
    'the preview import line stays byte-identical (Plan 385 pin)');

  // Plan 626 edge, module level: with no open bill, a planned charge
  // still settles from the whole amount — the save's remainder is the
  // amount minus zero dues — so the preview shows the charge line
  // instead of nothing. A bill-only preview keeps the exact pinned
  // shape (no chargeLines field).
  const charged = settlementPreview({
    bills: [],
    targetMonth: MONTH,
    amountCents: 50000,
    charges: [{ label: 'Ticket charge (TKT-1)', amountCents: 50000, balanceCents: 50000 }],
  });
  assert.deepEqual(charged.lines, [], 'no bill lines when no bill is open');
  assert.equal(charged.leftoverCents, 0, 'the charge takes the whole amount');
  assert.equal(charged.totalAppliedCents, 50000, 'the applied total counts the charge');
  assert.equal(charged.chargeLines?.length, 1, 'the charge line is present');
  assert.ok(settlementPreviewMarkup(charged).includes('Ticket charge (TKT-1): PKR 500 settled in full'),
    'the markup renders the charge line');
  assert.deepEqual(settlementPreview({ bills: [], targetMonth: MONTH, amountCents: 50000 }),
    { lines: [], leftoverCents: 0, totalAppliedCents: 0 },
    'a bill-only preview with no open bill keeps the exact pinned shape');
});

test('S1: a settlement with neither charges nor a waiver previews exactly as before', async () => {
  await withController(plan626State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeAmount(getEl, 3000);
    const html = previewHtml(getEl);
    assert.ok(html.includes('settled in full'), `the bill settles in full — got: ${html}`);
    assert.ok(!html.includes('left over'), `no leftover on an exact payment — got: ${html}`);
    assert.ok(!html.includes('PKR 500') && !html.includes('PKR 200') && !html.includes('PKR 300'),
      `no charge lines appear — got: ${html}`);
    await typeAmount(getEl, 3500);
    assert.ok(previewHtml(getEl).includes('PKR 500 left over after all open bills'),
      'an overpayment still reports the true leftover exactly as before');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('B1: the preview wiring is unchanged', async () => {
  await withController(plan626State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeAmount(getEl, 0);
    assert.equal(previewHtml(getEl), '', 'an empty amount previews nothing');
    await typeAmount(getEl, 1500);
    assert.ok(previewHtml(getEl).includes('remains'), 'a part-payment previews the remainder');
    await typeAmount(getEl, 3000);
    assert.ok(previewHtml(getEl).includes('settled in full'), 'a full payment previews settled in full');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});
