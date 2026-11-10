// BUT HOUSE fix — Quick Collect success card shows the customer's
// mobile number (or "Not saved" + "Add number").
//
// The user asked, on the success screen ("yhaa"), for the mobile
// number to be shown if saved, or an option to add and save it there.
// The add-and-save path already existed (profile Edit → Phone field →
// Save profile; also the "Add phone" toast action after Share via
// WhatsApp), but nothing on the success card itself showed the number
// or offered to add it: renderQuickCollectReceiptCardHtml never
// printed a phone row at all.
//
// Pins:
//  - the card carries a "Mobile Number" row immediately after the
//    Customer row;
//  - a saved number shows as plain text, like the other values;
//  - a whatsappPhone-only customer shows that number — the row is
//    resolved via whatsappPhoneFor from live state, falling back to
//    the receipt's stamped primary phone, never receipt.phone alone;
//  - no usable number anywhere reads "Not saved" with a small
//    secondary "Add number" button (only when the receipt carries a
//    customerId — without one there is nobody to edit);
//  - the button invokes the edit path with focus 'phone' (the same
//    path as the warnNoPhone toast action: closeModal, then
//    onEditCustomer(customerId, { focus: 'phone' }) after 350ms);
//  - the other card rows are unchanged, and the WhatsApp draft is
//    untouched (the new label stays card-only).
// Pattern-fake data only: Test Customer, RCPT-12-202611-01,
// 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
  getPakistanLocalDate,
  setupQuickCollectModal,
} from '../nav-quick-collect.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile,
} from '../core.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');

const FAKE_PHONE = '03012345678';
const OTHER_PHONE = '03019876543';

function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 3000,
    customerId: 'cust-37',
    customerName: 'Test Customer',
    customerNumber: 37,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Cash',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
    phone: '',
    ...overrides,
  };
}

// The Mobile Number row, or null when the card has none.
function phoneRowOf(html) {
  const at = html.indexOf('Mobile Number');
  if (at < 0) return null;
  const rowStart = html.lastIndexOf('<div class="qc-receipt-item', at);
  const rowEnd = html.indexOf('</div>', at);
  return html.slice(rowStart, rowEnd);
}

test('REPRO: the success card carries a Mobile Number row immediately after the Customer row', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  const row = phoneRowOf(html);
  assert.ok(row, 'card must carry a Mobile Number row');
  const customerAt = html.indexOf('>Customer<');
  const phoneAt = html.indexOf('Mobile Number');
  const dateAt = html.indexOf('Date &amp; Method');
  assert.ok(customerAt >= 0 && phoneAt > customerAt, 'Mobile Number must follow the Customer row');
  assert.ok(dateAt > phoneAt, 'Mobile Number must sit before the Date & Method row');
});

test('a saved primary phone shows as plain text, with no "Not saved" and no button', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: FAKE_PHONE }));
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes(FAKE_PHONE), 'saved number shown');
  assert.ok(!row.includes('Not saved'), 'no "Not saved" when a number is saved');
  assert.ok(!html.includes('data-qc-add-phone'), 'no Add number button when a number is saved');
  assert.ok(row.includes('qc-meta-val'), 'number reads as plain text like the other values');
});

test('a whatsappPhone-only customer shows that number — the row never reads receipt.phone alone', () => {
  // The receipt stamps the primary phone only (nav-quick-collect.js
  // receipt.phone), so a customer whose number lives in whatsappPhone
  // would read "Not saved" from the stamp alone. The live-state
  // resolution (whatsappPhoneFor) is passed in as the option.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }), { whatsappPhone: FAKE_PHONE });
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes(FAKE_PHONE), 'whatsappPhone shown');
  assert.ok(!row.includes('Not saved'), 'no "Not saved" when whatsappPhone is saved');
  assert.ok(!html.includes('data-qc-add-phone'), 'no Add number button when whatsappPhone is saved');
});

test('the live whatsappPhone wins over a different stamped primary phone', () => {
  // The receipt was stamped before the number was updated on the
  // profile; the card must show the live number, not the stale stamp.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: OTHER_PHONE }), { whatsappPhone: FAKE_PHONE });
  const row = phoneRowOf(html);
  assert.ok(row.includes(FAKE_PHONE), 'live whatsappPhone shown');
  assert.ok(!row.includes(OTHER_PHONE), 'stale stamped primary phone must not show');
});

test('no usable number anywhere reads "Not saved" with an "Add number" button', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }));
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes('Not saved'), '"Not saved" when no number exists');
  assert.ok(row.includes('data-qc-add-phone'), 'Add number button present');
  assert.ok(row.includes('Add number'), 'button labelled "Add number"');
  assert.ok(row.includes('secondary-button'), 'button is a small secondary button');
  assert.ok(row.includes('type="button"'), 'button must not submit anything');
});

test('no number and no customerId reads "Not saved" with NO button — there is nobody to edit', () => {
  const receipt = baseReceipt({ phone: '' });
  delete receipt.customerId;
  const html = renderQuickCollectReceiptCardHtml(receipt);
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes('Not saved'), '"Not saved" when no number exists');
  assert.ok(!html.includes('data-qc-add-phone'), 'no Add number button without a customerId');
});

test('the phone value is HTML-escaped — a hostile stored value cannot break the card', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '<script>alert(1)</script>' }));
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw markup must never reach the card');
  assert.ok(html.includes('&lt;script&gt;'), 'value must be escaped');
});

test('the other card rows are unchanged and in order around the new row', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: FAKE_PHONE }));
  const order = ['>Customer<', 'Mobile Number', 'Date &amp; Method', 'Area / Location', 'Remaining Balance'];
  let last = -1;
  for (const marker of order) {
    const at = html.indexOf(marker);
    assert.ok(at > last, `card must carry ${marker} after the previous row`);
    last = at;
  }
  assert.ok(html.includes('Test Customer (#37)'), 'Customer row keeps name + number');
  assert.ok(html.includes('08/11/2026 · Cash'), 'Date & Method row keeps date + method (date now prints DD/MM/YYYY)');
  assert.ok(html.includes('quickCollectAreaSelect'), 'Area select stays');
  assert.ok(html.includes('PKR 0'), 'Remaining Balance row keeps its figure');
  assert.ok(html.includes('RCPT-12-202611-01'), 'receipt id stays in the header');
});

test('the WhatsApp draft is untouched — the new label stays card-only', () => {
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt({ phone: FAKE_PHONE }));
  assert.ok(!text.includes('Mobile Number'), 'draft must not gain the card label');
  assert.ok(!text.includes('Not saved'), 'draft must not gain the card wording');
  assert.ok(!text.includes('Add number'), 'draft must not gain the card button');
});

// --- The "Add number" button wiring (behavioural, through the real
// modal controller + a real payment) ---
// Mock-DOM harness adapted from the Plan 534 leg-2 duplicate test:
// auto-creating elements, listeners recorded per element, innerHTML
// assignment stores the markup string.

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
      scrolledIntoView: false,
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; },
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
    activeElement: null,
  };
  return { getEl, documentStub };
}

async function withController(state, fn, hooks = {}) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  globalThis.document = documentStub;
  try {
    let current = state;
    const toasts = [];
    const editCalls = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: (id, opts) => { editCalls.push({ id, opts }); if (typeof hooks.onEditCustomer === 'function') hooks.onEditCustomer(id, opts); },
    });
    await fn({ controller, getEl, toasts, editCalls, getState: () => current });
  } finally {
    // The submit path schedules a ~60ms focus timer against `document`;
    // let it fire while the stub is still installed.
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts.
async function submitAndConfirm(getEl, getState, month) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(
    getState().customers[0].bills.find((b) => b.month === month)?.payments ?? [],
    [],
    'Plan 382: the first submit shows the summary — nothing posts yet',
  );
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

function fixtureState(patch = {}) {
  const now = new Date();
  let state = createInitialState(['Phone Row Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000, ...patch,
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

test('the rendered card on a real no-phone payment shows "Not saved" + the button, and the button opens the profile editor with the phone focused', async () => {
  await withController(fixtureState(), async ({ controller, getEl, editCalls, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    assert.equal(
      (getState().customers[0].bills.find((b) => b.month === MONTH)?.payments ?? []).length,
      1,
      'precondition: the payment recorded',
    );
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes('Mobile Number'), 'card carries the Mobile Number row');
    assert.ok(cardHtml.includes('Not saved'), 'card reads "Not saved" for a no-phone customer');
    assert.ok(cardHtml.includes('data-qc-add-phone'), 'card carries the Add number button');
    // The button is rendered markup, not a mock child — dispatch the
    // delegated click with a target whose closest() matches the hook,
    // exactly as a real tap would.
    const fakeButton = {};
    const fakeTarget = { closest: (sel) => (sel === '[data-qc-add-phone]' ? fakeButton : null) };
    await getEl('quickCollectReceiptCard').dispatch('click', { target: fakeTarget });
    // The toast action's path waits 350ms before opening the editor.
    await new Promise((resolve) => setTimeout(resolve, 450));
    assert.equal(getEl('quickCollectModal').open, false, 'the QC modal closes first');
    assert.equal(editCalls.length, 1, 'the editor opens exactly once');
    assert.equal(editCalls[0].id, 'seed-001', 'the editor opens for the receipt customer');
    assert.deepEqual(editCalls[0].opts, { focus: 'phone' }, 'the editor opens with the phone field focused');
  });
});

test('the rendered card on a real whatsappPhone-only payment shows that number, with no button', async () => {
  await withController(fixtureState({ whatsappPhone: FAKE_PHONE }), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes('Mobile Number'), 'card carries the Mobile Number row');
    assert.ok(cardHtml.includes(FAKE_PHONE), 'card shows the live whatsappPhone');
    assert.ok(!cardHtml.includes('Not saved'), 'no "Not saved" when whatsappPhone is saved');
    assert.ok(!cardHtml.includes('data-qc-add-phone'), 'no Add number button when a number is saved');
  });
});

test('wiring source: the card container delegates the Add number click to the toast action\'s edit path', () => {
  const cardStart = quickCollectSrc.indexOf('export function renderQuickCollectReceiptCardHtml');
  const cardEnd = quickCollectSrc.indexOf('export function quickCollectShopChoices');
  const cardSrc = quickCollectSrc.slice(cardStart, cardEnd);
  assert.ok(cardSrc.includes('data-qc-add-phone'), 'the card markup carries the Add number hook');
  // The delegation lives in the modal setup (it needs closeModal +
  // onEditCustomer, which the pure renderer cannot see).
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  assert.ok(setupSrc.includes("receiptCardContainer.addEventListener('click'"), 'the card container delegates clicks');
  assert.ok(setupSrc.includes("closest?.('[data-qc-add-phone]')"), 'the delegation matches the Add number hook');
  assert.ok(setupSrc.includes('onEditCustomer(customerId, { focus: \'phone\' })') || setupSrc.includes('onEditCustomer(activeReceipt.customerId, { focus: \'phone\' })'), 'the click opens the editor with the phone focused');
  assert.ok(setupSrc.includes('setTimeout(() => onEditCustomer'), 'the editor opens after the modal closes (350ms, the toast action\'s path)');
});
