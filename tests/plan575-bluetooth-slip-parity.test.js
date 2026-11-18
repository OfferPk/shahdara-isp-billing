/**
 * plan575-bluetooth-slip-parity.test.js — Plan 575: the Bluetooth slip
 * carries the tax, area, VER and both leg TIDs the HTML receipt prints.
 *
 * The adapter (escPosFieldsFromPaymentReceipt) dropped all eight figures
 * the HTML receipt prints — sales tax, area, VER, charged late fee,
 * deposit offset, credit transfer, prepay and loose-change credit — and
 * the QC Bluetooth handler printed splits as method 'Split' with only
 * the first leg's TID. The model already carried every figure; the fix
 * is rendering + threading, not computation.
 *
 * Groups:
 *  - G1 (adapter rows): each of the eight rows on a rich receipt, with
 *    EXACT labels (T6 — a bare /Late fee/ grep matches both the charged
 *    and the waived rows, so every label is pinned by its full line).
 *  - G2 (QC handler, 565 withController harness): the non-split slip
 *    gains the six threaded/derived rows and its VER EQUALS the profile
 *    reprint's code for the same payment (D7(a)); the overpaid slip
 *    shows the loose-change row; the split slip shows both leg methods
 *    joined, one TID + one VER stamp per leg, and no combined VER row.
 *  - G3 (ordinary-slip guards): the plain slip gains ONLY the Area +
 *    VER rows (D2(a)); a waived-only slip shows no charged Late fee row.
 *  - G4 (row order + width): the D1(a) HTML order on the rich slip,
 *    and every line fits the 32-char roll on every fixture.
 *
 * Fixtures use synthetic data only (pattern-fake 0300-1234567 phone).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth
} from '../core.js';
import {
  executeQuickCollection,
  getPakistanLocalDate,
  setupQuickCollectModal
} from '../nav-quick-collect.js';
import { buildPaymentReceipt } from '../receipt.js';
import { salesTaxCentsForPrice } from '../package-sales-tax.js';
import {
  buildEscPosReceipt,
  escPosFieldsFromPaymentReceipt,
  THERMAL_WIDTH_CHARS
} from '../thermal-printer.js';
import { verifyReceiptCode } from '../receipt-verifier.js';
import { TICKETS_KEY } from '../complaint-tickets.js';
// nav-quick-collect.js imports the printer as
// './thermal-printer.js?v=1.11.0' — Node treats that as a DIFFERENT
// module instance from '../thermal-printer.js', so the stub below
// must import the same ?v=1.11.0 specifier to reach the singleton
// the modal's Bluetooth handler actually calls.
import { thermalPrinter } from '../thermal-printer.js?v=1.11.0';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const BUSINESS = { businessName: 'Shahdara ISP', businessPhone: '0300-1234567' };

// --- Adapter fixtures (same shapes as the Plan 575 prep repro) ---

function richReceipt() {
  const bill = {
    id: 'bill-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending',
    salesTaxCents: salesTaxCentsForPrice(3000), lateFee: 100,
    depositOffsetAmount: 500, creditTransferInAmount: 300, payments: []
  };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    mohalla: 'Charyaa', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill]
  };
  const payment = { id: 'p-rich', amount: 3685, date: '2026-11-07', method: 'JazzCash', transactionId: 'TXN-9876543210' };
  bill.payments = [payment];
  return buildPaymentReceipt(customer, bill, payment);
}

function plainReceipt() {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill]
  };
  const payment = { id: 'p-live', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  return buildPaymentReceipt(customer, bill, payment);
}

const slipOf = (receipt) => buildEscPosReceipt(escPosFieldsFromPaymentReceipt(receipt, BUSINESS));
// The full line for a row, pinned by an anchored regex — a bare
// startsWith('Late fee') would match the waived row too (T6).
const rowMatching = (slip, re) => slip.lines.find((l) => re.test(l));
const indexOfRow = (slip, re) => slip.lines.findIndex((l) => re.test(l));
const isLatinOnly = (line) => [...line].every((c) => c.charCodeAt(0) < 128);

// --- G1: the eight adapter rows ---

test('plan575 G1: taxed slip shows the tax row with the exact Latin label', () => {
  const receipt = richReceipt();
  const slip = slipOf(receipt);
  const line = rowMatching(slip, /^Sales tax \(19\.5%\)\s+PKR 585$/);
  assert.ok(line, `tax row missing or mislabelled:\n${slip.text}`);
  assert.ok(isLatinOnly(line), `tax row must be Latin-only: ${line}`);
});

test('plan575 G1: slip shows the area row right after Package', () => {
  const receipt = richReceipt();
  const slip = slipOf(receipt);
  const areaIdx = indexOfRow(slip, /^Area\s+Charyaa$/);
  assert.ok(areaIdx > -1, `Area row missing:\n${slip.text}`);
  const packageIdx = indexOfRow(slip, /^Package:/);
  assert.equal(areaIdx, packageIdx + 1, 'Area must sit right after Package');
});

test('plan575 G1: slip shows the VER stamp last, equal to the receipt code', () => {
  const receipt = richReceipt();
  const slip = slipOf(receipt);
  const verifyLine = rowMatching(slip, /^Verify\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$/);
  assert.ok(verifyLine, `Verify row missing:\n${slip.text}`);
  const code = verifyLine.match(/^Verify\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$/)[1];
  assert.equal(code, receipt.verificationCode, 'slip VER must equal the receipt VER');
  assert.ok(
    verifyReceiptCode(code, {
      receiptId: receipt.receiptNumber,
      customerId: receipt.customerId,
      amountPaid: receipt.paidAmount,
      date: receipt.paymentDate
    }),
    'slip VER must verify against the receipt’s own facts'
  );
  // VER is the LAST content row: immediately before the final divider.
  const verifyIdx = indexOfRow(slip, /^Verify\s+VER:/);
  const lastDivider = slip.lines.lastIndexOf('-'.repeat(THERMAL_WIDTH_CHARS));
  assert.equal(verifyIdx, lastDivider - 1, 'Verify must sit right before the final divider');
});

test('plan575 G1: slip shows the charged late fee, never confused with the waived row', () => {
  const slip = slipOf(richReceipt());
  assert.ok(rowMatching(slip, /^Late fee\s+PKR 100$/), `charged Late fee row missing:\n${slip.text}`);
  // A waived-only receipt shows the waived row and NO charged row.
  const waived = slipOf({ ...richReceipt(), lateFee: 0, waivedAmount: 100 });
  assert.ok(rowMatching(waived, /^Late fee waived\s+PKR 100$/), `waived row missing:\n${waived.text}`);
  assert.equal(rowMatching(waived, /^Late fee\s+PKR/), undefined, 'a waived-only slip must not show a charged Late fee row');
});

test('plan575 G1: slip shows the deposit offset row', () => {
  const slip = slipOf(richReceipt());
  assert.ok(rowMatching(slip, /^Deposit offset\s+PKR 500$/), `Deposit offset row missing:\n${slip.text}`);
});

test('plan575 G1: slip shows the credit transfer row', () => {
  const slip = slipOf(richReceipt());
  assert.ok(rowMatching(slip, /^Credit transfer\s+PKR 300$/), `Credit transfer row missing:\n${slip.text}`);
});

test('plan575 G1: prepay slip shows coverage + an UNSIGNED discount', () => {
  const receipt = {
    ...richReceipt(),
    prepay: { months: 3, gross: 6500, rate: 3000, startMonth: '2026-11', discount: 500, cashPaid: 6000 }
  };
  const slip = slipOf(receipt);
  assert.ok(rowMatching(slip, /^Prepay coverage\s+PKR 6,500$/), `Prepay coverage row missing:\n${slip.text}`);
  const discountLine = rowMatching(slip, /^Prepay discount\s+PKR 500$/);
  assert.ok(discountLine, `Prepay discount row missing:\n${slip.text}`);
  assert.ok(!discountLine.includes('-'), `prepay discount must be UNSIGNED, got: ${discountLine}`);
});

test('plan575 G1: slip shows the loose-change credit row', () => {
  const slip = slipOf({ ...richReceipt(), looseChangeCredit: 50 });
  assert.ok(rowMatching(slip, /^Change kept\s+PKR 50$/), `Change kept row missing:\n${slip.text}`);
});

// --- G2: the QC handler (565 withController harness, copied) ---

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

async function withController(state, fn) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  const origLocalStorage = globalThis.localStorage;
  const store = new Map([[TICKETS_KEY, JSON.stringify([])]]);
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); }
  };
  globalThis.document = documentStub;
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

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

function plan575FixtureState({ monthlySellingAmount = 3000, mohalla = null, billFields = {} } = {}) {
  const now = new Date();
  let state = createInitialState(['Plan575 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  const customer = state.customers[0];
  if (mohalla) customer.mohalla = mohalla;
  const bill = customer.bills.find((b) => b.month === MONTH);
  Object.assign(bill, billFields);
  return state;
}

// The byte stream is [header commands][business name][header commands]
// [plain body lines][feed + cut] — the body block carries no commands,
// so slice it out by the builder's own markers (thermal-printer.js
// byte-stream section) and read ITS lines. A naive control-byte strip
// eats the '\n' newlines and leaves the command parameters ('@', 'E',
// '!') glued onto the text, so it must not be used here.
const bodyLinesOf = (bytes) => {
  const text = new TextDecoder().decode(bytes);
  const bodyStart = text.lastIndexOf('\x1Ba\x00') + 3;
  const bodyEnd = text.indexOf('\x1Bd', bodyStart);
  return text.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd).split('\n');
};

test('plan575 G2: non-split QC slip gains the six rows and its VER equals the profile reprint', async () => {
  await withController(plan575FixtureState({
    mohalla: 'Charyaa',
    billFields: {
      salesTaxCents: salesTaxCentsForPrice(3000), lateFee: 100,
      depositOffsetAmount: 500, creditTransferInAmount: 300
    }
  }), async ({ controller, getEl, toasts, getState, captured }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the PKR 3,000 payment is recorded');

    await getEl('quickCollectBluetoothPrintBtn').click();
    const bytes = captured();
    assert.ok(bytes, 'the slip was sent to the printer');
    const lines = bodyLinesOf(bytes);
    const text = lines.join('\n');
    const slip = { lines, text };
    assert.ok(rowMatching(slip, /^Area\s+Charyaa$/), `Area row missing:\n${text}`);
    assert.ok(rowMatching(slip, /^Sales tax \(19\.5%\)\s+PKR 585$/), `tax row missing:\n${text}`);
    assert.ok(rowMatching(slip, /^Late fee\s+PKR 100$/), `charged Late fee row missing:\n${text}`);
    assert.ok(rowMatching(slip, /^Deposit offset\s+PKR 500$/), `Deposit offset row missing:\n${text}`);
    assert.ok(rowMatching(slip, /^Credit transfer\s+PKR 300$/), `Credit transfer row missing:\n${text}`);
    // The 3,000 payment OVERPAYS this bill: the net dues are 2,300
    // (3,000 due + 100 late fee − 500 deposit offset − 300 credit
    // transfer), so the loose-change row reads the 700 overpayment.
    assert.ok(rowMatching(slip, /^Change kept\s+PKR 700$/), `Change kept row missing:\n${text}`);
    // D7(a): the slip VER MUST equal the profile reprint's code for
    // the same payment — the reprint derives its receipt number via
    // generateReceiptNumber (REC-…), not the QC RCPT-… number.
    const verifyLine = rowMatching(slip, /^Verify\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$/);
    assert.ok(verifyLine, `Verify row missing:\n${text}`);
    const code = verifyLine.match(/^Verify\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$/)[1];
    const customer = getState().customers[0];
    const bill = customer.bills.find((b) => b.month === MONTH);
    const reprint = buildPaymentReceipt(customer, bill, paymentsOf(getState(), MONTH)[0]);
    assert.equal(code, reprint.verificationCode, `slip VER ${code} must equal the reprint VER ${reprint.verificationCode}`);
    assert.ok(
      verifyReceiptCode(code, {
        receiptId: reprint.receiptNumber,
        customerId: reprint.customerId,
        amountPaid: reprint.paidAmount,
        date: reprint.paymentDate
      }),
      'slip VER must verify against the reprint’s facts'
    );
    for (const line of slip.lines) assert.ok(line.length <= THERMAL_WIDTH_CHARS, `line too wide (${line.length}): ${line}`);
    assert.equal(toasts.find((t) => t.opts?.type === 'error'), undefined, `no error toast — got: ${toasts.find((t) => t.opts?.type === 'error')?.msg}`);
  });
});

test('plan575 G2: overpaid QC slip shows the loose-change row', async () => {
  await withController(plan575FixtureState(), async ({ controller, getEl, toasts, getState, captured }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3050';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: the PKR 3,050 payment is recorded');

    await getEl('quickCollectBluetoothPrintBtn').click();
    const bytes = captured();
    assert.ok(bytes, 'the slip was sent to the printer');
    const lines = bodyLinesOf(bytes);
    const text = lines.join('\n');
    const slip = { lines, text };
    assert.ok(rowMatching(slip, /^Change kept\s+PKR 50$/), `Change kept row missing:\n${text}`);
    for (const line of slip.lines) assert.ok(line.length <= THERMAL_WIDTH_CHARS, `line too wide (${line.length}): ${line}`);
    assert.equal(toasts.find((t) => t.opts?.type === 'error'), undefined, `no error toast — got: ${toasts.find((t) => t.opts?.type === 'error')?.msg}`);
  });
});

test('plan575 G2: split QC slip shows both leg methods, both TIDs and both leg VER stamps', async () => {
  await withController(plan575FixtureState(), async ({ controller, getEl, toasts, getState, captured }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '1500';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    getEl('quickCollectTransactionIdInput').value = 'TXN-1111111111';
    getEl('quickCollectSplitToggle').checked = true;
    await getEl('quickCollectSplitToggle').dispatch('change');
    getEl('quickCollectSplitAmountInput').value = '1500';
    getEl('quickCollectSplitMethodSelect').value = 'JazzCash';
    await getEl('quickCollectSplitMethodSelect').dispatch('change');
    getEl('quickCollectSplitTransactionIdInput').value = 'TXN-2222222222';
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 2, 'precondition: both split legs are recorded');

    await getEl('quickCollectBluetoothPrintBtn').click();
    const bytes = captured();
    assert.ok(bytes, 'the slip was sent to the printer');
    const lines = bodyLinesOf(bytes);
    const text = lines.join('\n');
    const slip = { lines, text };
    // D9(a): the method row joins the legs, never the literal 'Split'.
    assert.ok(rowMatching(slip, /^Method\s+Cash \+ JazzCash$/), `split Method row missing:\n${text}`);
    // D5(a): one TID + one VER stamp per leg, beside its leg row.
    assert.ok(rowMatching(slip, /^Ref \(Leg 1\)\s+TXN-1111111111$/), `leg 1 TID row missing:\n${text}`);
    assert.ok(rowMatching(slip, /^Ref \(Leg 2\)\s+TXN-2222222222$/), `leg 2 TID row missing:\n${text}`);
    assert.equal(rowMatching(slip, /^Ref\s+TXN/), undefined, 'no joined Ref row may exist (the probe proves it eats the label)');
    // D7(a): each leg stamp equals its leg receipt's own code.
    const customer = getState().customers[0];
    const bill = customer.bills.find((b) => b.month === MONTH);
    const legs = paymentsOf(getState(), MONTH).map((payment) => ({
      method: payment.method,
      code: buildPaymentReceipt(customer, bill, payment).verificationCode
    }));
    for (const [n, leg] of [[1, legs.find((l) => l.method === 'Cash')], [2, legs.find((l) => l.method === 'JazzCash')]]) {
      const line = rowMatching(slip, new RegExp(`^Verify \\(Leg ${n}\\)\\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$`));
      assert.ok(line, `Verify (Leg ${n}) row missing:\n${text}`);
      assert.ok(line.endsWith(`VER: ${leg.code}`), `leg ${n} stamp must equal its receipt code ${leg.code}, got: ${line}`);
    }
    // No COMBINED Verify row on a split slip — VER is per leg only.
    assert.equal(rowMatching(slip, /^Verify\s+VER:/), undefined, 'a split slip must not carry a combined Verify row');
    for (const line of slip.lines) assert.ok(line.length <= THERMAL_WIDTH_CHARS, `line too wide (${line.length}): ${line}`);
    assert.equal(toasts.find((t) => t.opts?.type === 'error'), undefined, `no error toast — got: ${toasts.find((t) => t.opts?.type === 'error')?.msg}`);
  });
});

// --- G3: the ordinary slip stays clean apart from Area + VER ---

test('plan575 G3: ordinary slip gains ONLY the Area + VER rows', () => {
  const slip = slipOf(plainReceipt());
  assert.ok(rowMatching(slip, /^Area\s+Not recorded$/), `Area row missing:\n${slip.text}`);
  assert.ok(rowMatching(slip, /^Verify\s+VER: ([A-Z0-9]{4}-[A-Z0-9]{2})$/), `Verify row missing:\n${slip.text}`);
  for (const re of [/Sales tax/, /^Late fee\s+PKR/, /Deposit offset/, /Credit transfer/, /Prepay/, /Change kept/]) {
    assert.equal(rowMatching(slip, re), undefined, `ordinary slip must not carry a row matching ${re}`);
  }
});

// --- G4: row order (D1(a)) + the 32-char roll ---

test('plan575 G4: the new rows sit in the HTML receipt’s order', () => {
  const rich = slipOf(richReceipt());
  const idx = (re) => indexOfRow(rich, re);
  assert.ok(idx(/^Package:/) < idx(/^Area\s/) , 'Area must follow Package');
  assert.ok(idx(/^Area\s/) < idx(/^Sales tax/) , 'tax must follow Area');
  assert.ok(idx(/^Sales tax/) < idx(/^Late fee\s+PKR/) , 'late fee must follow tax');
  assert.ok(idx(/^Late fee\s+PKR/) < idx(/^Deposit offset/) , 'deposit offset must follow late fee');
  assert.ok(idx(/^Deposit offset/) < idx(/^Credit transfer/) , 'credit transfer must follow deposit offset');
  assert.ok(idx(/^Credit transfer/) < idx(/^AMOUNT PAID/) , 'offset/transfer must precede AMOUNT PAID');
  const prepay = slipOf({ ...richReceipt(), prepay: { months: 3, gross: 6500, rate: 3000, startMonth: '2026-11', discount: 500, cashPaid: 6000 } });
  assert.ok(indexOfRow(prepay, /^Prepay coverage/) < indexOfRow(prepay, /^AMOUNT PAID/), 'prepay coverage must precede AMOUNT PAID');
  assert.ok(indexOfRow(prepay, /^Prepay coverage/) < indexOfRow(prepay, /^Prepay discount/), 'discount must follow coverage');
  const loose = slipOf({ ...richReceipt(), looseChangeCredit: 50 });
  assert.ok(indexOfRow(loose, /^AMOUNT PAID/) < indexOfRow(loose, /^Change kept/), 'Change kept must follow AMOUNT PAID');
  assert.ok(indexOfRow(loose, /^Change kept/) < indexOfRow(loose, /^Balance due/), 'Change kept must precede Balance due');
  assert.ok(indexOfRow(rich, /^Verify\s+VER:/) > indexOfRow(rich, /^Status/), 'Verify must follow Status');
});

test('plan575 G4: every line fits the 32-char roll on every fixture', () => {
  const slips = [
    slipOf(richReceipt()),
    slipOf(plainReceipt()),
    slipOf({ ...richReceipt(), prepay: { months: 3, gross: 6500, rate: 3000, startMonth: '2026-11', discount: 500, cashPaid: 6000 } }),
    slipOf({ ...richReceipt(), looseChangeCredit: 50 })
  ];
  for (const slip of slips) {
    for (const line of slip.lines) assert.ok(line.length <= THERMAL_WIDTH_CHARS, `line too wide (${line.length}): ${line}`);
  }
});
