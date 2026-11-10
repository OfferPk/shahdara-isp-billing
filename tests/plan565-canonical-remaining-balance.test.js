/**
 * plan565-canonical-remaining-balance.test.js — Plan 565: One canonical
 * remaining balance on all four Quick Collect surfaces.
 *
 * The same Quick Collect receipt's remaining balance was derived
 * differently on each surface (nav-quick-collect.js):
 *  - WhatsApp draft: receipt.payableRemaining ?? receipt.newTotalDues
 *    ?? receipt.newBalanceDue ?? 0 (the canonical chain — most
 *    complete, already correct);
 *  - success card (renderQuickCollectReceiptCardHtml):
 *    receipt.payableRemaining ?? receipt.newTotalDues;
 *  - image receipt (generateReceiptImageBlob): receipt.newTotalDues
 *    only — for the figure, the colour AND the settled/partial line;
 *  - Bluetooth slip: receipt.payableRemaining ??
 *    receipt.newBalanceDue (month-only, no newTotalDues, no ?? 0);
 *  - the success screen's settle/partial badge
 *    (renderSettleStatusBadge): (payableRemaining ?? newTotalDues)
 *    <= 0 — the card's status display, so it is the same surface
 *    as the card for status purposes.
 * payableRemaining includes pending ticket/addon/baqaya charges after
 * the payment, newTotalDues is bills-only, newBalanceDue is
 * month-only. This plan uses the draft's chain on the card, the
 * image receipt, the Bluetooth slip and the badge, with the same
 * ?? 0 fallback discipline. No source figure's computation changes.
 *
 * BOUNDARY (Plan 566, NOT this plan): the ?? chain handles missing
 * fields, not non-finite ones — a NaN payableRemaining still rides
 * through ?? and is Plan 566's guard to add. No test here pins NaN.
 *
 * Fixtures (synthetic data only; pattern-fake 03001234567 phone):
 *  - Fixture A (real, via executeQuickCollection): a PKR 1,000 bill
 *    paid in full with a PKR 300 billed ticket charge still pending
 *    afterwards — newTotalDues 0, newBalanceDue 0, payableRemaining
 *    300, isSettled false. The draft, card and slip already read
 *    300 here (payableRemaining is stamped); only the image receipt
 *    understates it (PKR 0, "settled") — that is the live bug.
 *  - Fixture B (hand-built, no payableRemaining): exercises the
 *    fallback chain itself — (a) newBalanceDue 500 only, (b)
 *    newTotalDues 0 with newBalanceDue 500 (chain order: bills-only
 *    wins over month-only, exactly like the draft).
 *
 * Pins:
 *  - BEHAVIOUR (fail on the pristine base, pass after the fix):
 *    image receipt on Fixture A shows PKR 300 + Partial (not PKR 0
 *    + settled); image receipt on Fixture B(a) shows PKR 500 (not
 *    "PKR —"); success card on Fixture B(a) shows PKR 500 (not
 *    "PKR —").
 *  - PIN (pass before and after): draft/card/slip/badge agree on
 *    Fixture A (PKR 300, PARTIAL); draft on Fixture B(a) is PKR 500;
 *    Fixture B(b) reads PKR 0 on draft, card and image alike;
 *    a fully-settled receipt reads PKR 0 + settled on the image;
 *    a partial bill payment (600 of 1,000, no tickets) reads PKR 400
 *    on draft and card alike.
 *  - WIRING (source pins, plan549 precedent): the Bluetooth slip's
 *    balanceDue and the settle badge's settled check use the
 *    canonical chain. They are pinned in source because the
 *    behavioural path (a real modal collection) always stamps
 *    payableRemaining — executeQuickCollection sets it on every
 *    receipt — so the fallback case is unreachable through the
 *    modal; the modal-drive test below covers the slip and the badge
 *    behaviourally on Fixture A.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations
} from '../core.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  renderQuickCollectReceiptCardHtml,
  generateReceiptImageBlob,
  getPakistanLocalDate,
  setupQuickCollectModal
} from '../nav-quick-collect.js';
import { createTicket, resolveTicket, TICKETS_KEY } from '../complaint-tickets.js';
// nav-quick-collect.js imports the printer as
// './thermal-printer.js?v=1.11.0' — Node treats that as a DIFFERENT
// module instance from '../thermal-printer.js', so the stub below
// must import the same ?v=1.11.0 specifier to reach the singleton
// the modal's Bluetooth handler actually calls.
import { thermalPrinter } from '../thermal-printer.js?v=1.11.0';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TODAY = getPakistanLocalDate(new Date());

function plan565FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan565 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

// One resolved, billed, unpaid ticket charge of PKR 300 for seed-001.
function pendingTicket300() {
  const created = createTicket({
    customerId: 'seed-001', customerName: 'Plan565 Tester',
    faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  return resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 300 }],
    billingType: 'billed', referenceDate: new Date('2026-10-28T14:30:00')
  });
}

// Fixture A: pay the PKR 1,000 bill in full; the PKR 300 ticket stays
// pending, so the receipt's remaining is the ticket alone.
function collectFixtureA() {
  const { receipt } = executeQuickCollection(plan565FixtureState(), {
    customerId: 'seed-001', month: MONTH, amount: 1000, method: 'Cash',
    tickets: pendingTicket300()
  }, new Date());
  return receipt;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

// Fixture B(a): no payableRemaining, no newTotalDues, month still owes 500.
function receiptNoPayableRemaining(overrides = {}) {
  return {
    id: 'receipt-b', receiptNumber: 'RCPT-B-202611-01',
    customerName: 'Test Customer', customerNumber: 7,
    date: '2026-11-10', month: '2026-11', method: 'Cash',
    area: 'Test Area', amount: 1000, newBalanceDue: 500,
    ...overrides
  };
}

// The "Remaining Balance" figure on the success card, or null.
function cardRemainingOf(html) {
  // QC receipt-modal overhaul (§4.3.2, decision (j)): the "Remaining
  // Balance" row is gone — the merged Still-owed row carries the
  // figure ("PKR X" when something remains, "Fully paid" at 0, never
  // "PKR 0"), with the Plan 526 charged label while ticket/boost
  // charges are pending.
  const m = html.match(/Still owed(?: \(incl\. pending charges\))?<\/span>\s*<strong[^>]*>\s*([^<]+)/);
  return m ? m[1].trim() : null;
}

// --- Image receipt: a fake document + recording canvas ---------------

function imageFills(receipt) {
  const fills = [];
  const ctx = {
    fillStyle: '', font: '',
    fillText: (text, x, y) => fills.push({ text: String(text), x, y }),
    fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}
  };
  const canvas = {
    width: 0, height: 0, getContext: () => ctx,
    toBlob: (cb) => cb({ type: 'image/png' })
  };
  const origDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  try {
    return generateReceiptImageBlob(receipt).then((blob) => ({ blob, fills }));
  } finally {
    globalThis.document = origDocument;
  }
}

const imageBalanceOf = (fills) => fills.find((f) => f.x === 420 && f.y === 375)?.text ?? null;
const imageStatusOf = (fills) => fills.find((f) => f.x === 30 && f.y === 420)?.text ?? null;

/* ---------------- Fixture A: real receipt ---------------- */

test('plan565: Fixture A receipt carries the pending ticket in payableRemaining', () => {
  const receipt = collectFixtureA();
  assert.equal(receipt.newTotalDues, 0, 'bills are settled in full');
  assert.equal(receipt.newBalanceDue, 0, 'the month is settled in full');
  assert.equal(receipt.ticketChargesPending, 300, 'the PKR 300 ticket is still pending');
  assert.equal(receipt.payableRemaining, 300, 'canonical remaining is the pending ticket alone');
  assert.equal(receipt.isSettled, false, 'not settled while a charge is pending');
});

test('plan565 PIN: draft on Fixture A shows PKR 300 remaining and PARTIAL', () => {
  const text = formatQuickCollectWhatsAppReceipt(collectFixtureA()).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 300'), text);
  assert.ok(text.includes('PARTIAL'), text);
  assert.ok(!text.includes('PAID IN FULL'), text);
});

test('plan565 PIN: success card on Fixture A shows PKR 300 remaining', () => {
  const html = renderQuickCollectReceiptCardHtml({ ...collectFixtureA(), id: 'receipt-a' });
  assert.equal(cardRemainingOf(html), 'PKR 300', html);
});

test('plan565 BEHAVIOUR: image receipt on Fixture A shows PKR 300 and Partial, not PKR 0 and settled', async () => {
  const { blob, fills } = await imageFills(collectFixtureA());
  assert.ok(blob, 'the image renders');
  assert.equal(imageBalanceOf(fills), 'PKR 300', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Partial payment recorded/, JSON.stringify(fills));
  assert.ok(!fills.some((f) => f.text.includes('Bill settled in full')), JSON.stringify(fills));
});

/* ---------------- Fixture B: fallback chain ---------------- */

test('plan565 PIN: draft on Fixture B(a) falls back to newBalanceDue, PKR 500', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptNoPayableRemaining()).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 500'), text);
  assert.ok(text.includes('PARTIAL'), text);
});

test('plan565 BEHAVIOUR: success card on Fixture B(a) falls back to newBalanceDue, PKR 500', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptNoPayableRemaining());
  assert.equal(cardRemainingOf(html), 'PKR 500', html);
});

test('plan565 BEHAVIOUR: image receipt on Fixture B(a) falls back to newBalanceDue, PKR 500', async () => {
  const { fills } = await imageFills(receiptNoPayableRemaining());
  assert.equal(imageBalanceOf(fills), 'PKR 500', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Partial payment recorded/, JSON.stringify(fills));
});

test('plan565 PIN: Fixture B(b) — newTotalDues 0 wins over newBalanceDue 500 on draft and image; the card hides its zero row', async () => {
  const receipt = receiptNoPayableRemaining({ newTotalDues: 0 });
  const draft = formatQuickCollectWhatsAppReceipt(receipt).text;
  assert.ok(draft.includes('⚖️ *Remaining Balance:* PKR 0'), draft);
  assert.ok(draft.includes('PAID IN FULL'), draft);
  const html = renderQuickCollectReceiptCardHtml(receipt);
  // QC receipt-modal overhaul (§4.3.2, decision (j)): the merged
  // Still-owed row is ALWAYS shown — a fully-settled receipt reads
  // "Fully paid" (green), never "PKR 0" and never a hidden row. This
  // deliberately replaces PR #1332's hide-zero rule for this row; the
  // draft and the image receipt still show PKR 0.
  assert.equal(cardRemainingOf(html), 'Fully paid', html);
  const { fills } = await imageFills(receipt);
  assert.equal(imageBalanceOf(fills), 'PKR 0', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Bill settled in full/, JSON.stringify(fills));
});

test('plan565 PIN: a fully-settled receipt reads PKR 0 and settled on the image', async () => {
  const receipt = receiptNoPayableRemaining({ newTotalDues: 0, newBalanceDue: 0, payableRemaining: 0 });
  const { fills } = await imageFills(receipt);
  assert.equal(imageBalanceOf(fills), 'PKR 0', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Bill settled in full/, JSON.stringify(fills));
});

/* ---------------- Partial bill payment: draft and card agree ---------------- */

test('plan565 PIN: a partial bill payment (600 of 1,000, no tickets) reads PKR 400 on draft and card alike', () => {
  const { receipt } = executeQuickCollection(plan565FixtureState(), {
    customerId: 'seed-001', month: MONTH, amount: 600, method: 'Cash'
  }, new Date());
  assert.equal(receipt.payableRemaining, 400, 'no ticket pending, so the remaining is the bill alone');
  const draft = formatQuickCollectWhatsAppReceipt(receipt).text;
  assert.ok(draft.includes('⚖️ *Remaining Balance:* PKR 400'), draft);
  assert.ok(draft.includes('PARTIAL'), draft);
  const html = renderQuickCollectReceiptCardHtml({ ...receipt, id: 'receipt-partial' });
  assert.equal(cardRemainingOf(html), 'PKR 400', html);
});

/* ---------------- Wiring pins: slip + badge chains ---------------- */

const quickCollectSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

test('plan565 WIRING: Bluetooth slip balanceDue uses the canonical chain', () => {
  // The slip is built inside the modal's click handler, and a real
  // modal collection always stamps payableRemaining — so the fallback
  // case is unreachable behaviourally and is pinned here in source
  // (plan549 precedent for this handler).
  assert.ok(
    quickCollectSrc.includes('split.balanceDueCents / 100 : (activeReceipt.payableRemaining ?? activeReceipt.newTotalDues ?? activeReceipt.newBalanceDue ?? 0)'),
    'slip balanceDue is payableRemaining ?? newTotalDues ?? newBalanceDue ?? 0'
  );
});

test('plan565 WIRING: merged Still-owed row uses the canonical chain', () => {
  // QC receipt-modal overhaul (§4.3.2): the settle badge is gone — the
  // merged Still-owed row is the one card surface that reads the
  // canonical remaining figure, and it branches on remainingPayable > 0
  // (PKR X when owed, "Fully paid" at 0).
  assert.ok(
    quickCollectSrc.includes('const remainingPayable = receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? 0;'),
    'card builder computes the canonical remaining figure'
  );
  assert.ok(
    quickCollectSrc.includes('remainingPayable > 0 ? `PKR ${formatReceiptMoneyFigure(remainingPayable)}` : escapeHtml(SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT)'),
    'merged row branches on remainingPayable > 0'
  );
  assert.ok(!quickCollectSrc.includes('function renderSettleStatusBadge()'), 'settle render must be gone');
});

/* ---------------- Modal drive: Bluetooth slip + badge on Fixture A ---------------- */

// The plan534 mock-DOM harness (adapted): the modal reads its elements
// by id, so the registry auto-creates any id the flow touches.
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div', className = '') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), className, textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: (sel) => {
        if (typeof sel !== 'string' || !sel.startsWith('.')) return null;
        const wanted = sel.slice(1);
        const walk = (node) => {
          for (const child of (node.children || [])) {
            if (String(child.className || '').split(' ').includes(wanted)) return child;
            const found = walk(child);
            if (found) return found;
          }
          return null;
        };
        return walk(el);
      },
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      scrollIntoView: () => { el.scrolledIntoView = true; },
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false,
      scrolledIntoView: false
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag, className) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag, className));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
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

async function withController(state, tickets, fn) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  const origLocalStorage = globalThis.localStorage;
  // The modal loads its tickets through loadTickets(), which reads
  // localStorage — seed the one pending PKR 300 ticket there.
  const store = new Map([[TICKETS_KEY, JSON.stringify(tickets)]]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); }
  };
  globalThis.document = documentStub;
  // The Bluetooth handler prints through the shared singleton — stub
  // its transport only (isConnected true so connect() is skipped).
  const origIsConnected = thermalPrinter.isConnected;
  const origPrint = thermalPrinter.print;
  let capturedBytes = null;
  thermalPrinter.isConnected = () => true;
  thermalPrinter.print = async (bytes) => { capturedBytes = bytes; };
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
    await fn({ controller, getEl, toasts, getState: () => current, captured: () => capturedBytes });
  } finally {
    thermalPrinter.isConnected = origIsConnected;
    thermalPrinter.print = origPrint;
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
    if (origLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = origLocalStorage;
  }
}

// Plan 382: the first submit shows the confirm summary — nothing
// posts; confirm, then resubmit to post.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

test('plan565: Bluetooth slip + merged Still-owed row on Fixture A show PKR 300 and PARTIAL', async () => {
  await withController(plan565FixtureState(), pendingTicket300(), async ({ controller, getEl, toasts, getState, captured }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '1000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the PKR 1,000 payment is recorded');
    assert.equal(calculatePaymentAllocations(getState()).forMonth('seed-001', MONTH)?.balanceDueCents, 0, 'precondition: the bill is settled in full');

    // QC receipt-modal overhaul (§4.3.2): the settle badge is gone —
    // the merged Still-owed row in the receipt card carries the settled/
    // partial state. Fixture A has a PKR 300 ticket pending, so the row
    // reads the Plan 526 charged label with PKR 300.
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes('Still owed (incl. pending charges)'), `merged row carries the charged label:\n${cardHtml}`);
    assert.ok(cardHtml.includes('PKR 300'), `merged row shows PKR 300:\n${cardHtml}`);

    await getEl('quickCollectBluetoothPrintBtn').click();
    const bytes = captured();
    assert.ok(bytes, 'the slip was sent to the printer');
    const text = new TextDecoder().decode(bytes);
    const balanceLine = text.split('\n').find((l) => l.startsWith('Balance due'));
    assert.ok(balanceLine, `slip carries a Balance due row:\n${text}`);
    assert.ok(balanceLine.endsWith('PKR 300'), `slip Balance due is PKR 300, got: ${balanceLine}`);
    const statusLine = text.split('\n').find((l) => l.startsWith('Status'));
    assert.ok(statusLine, `slip carries a Status row:\n${text}`);
    assert.ok(statusLine.endsWith('PARTIAL'), `slip status is PARTIAL, got: ${statusLine}`);
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});
