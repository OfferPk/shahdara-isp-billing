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
// LIVE FIX 1 (2026-11-12) changed the add path: "Add number" /
// "Change" now opens an INLINE editor on the card itself (input +
// Save / Cancel) that writes through updateCustomerProfile — the
// profile edit is no longer opened from this row. A saved number
// shows GREEN (qc-phone-saved) with a Change button.
//
// Pins:
//  - the card carries a "Mobile Number" row immediately after the
//    Customer row;
//  - a saved number shows GREEN, with a Change button (no Add number);
//  - a whatsappPhone-only customer shows that number — the row is
//    resolved via whatsappPhoneFor from live state, falling back to
//    the receipt's stamped primary phone, never receipt.phone alone;
//  - no usable number anywhere reads "Not saved" with a small
//    secondary "Add number" button (only when the receipt carries a
//    customerId — without one there is nobody to edit);
//  - the Add number / Change button opens the inline editor on the
//    card (the modal stays open; the profile editor never opens);
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

test('a saved primary phone shows GREEN, with a Change button and no "Not saved"', () => {
  // LIVE FIX 1: a saved number shows green (qc-phone-saved, the
  // card's success-green token) with a Change button that opens the
  // inline editor — it no longer reads as plain text with no button.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: FAKE_PHONE }));
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes(FAKE_PHONE), 'saved number shown');
  assert.ok(!row.includes('Not saved'), 'no "Not saved" when a number is saved');
  assert.ok(!html.includes('data-qc-add-phone'), 'no Add number button when a number is saved');
  assert.ok(row.includes('qc-phone-saved'), 'saved number shows green');
  assert.ok(row.includes('data-qc-edit-phone'), 'a Change button opens the inline editor');
  assert.ok(row.includes('qc-meta-val'), 'number reads as a receipt value like the other rows');
});

test('a whatsappPhone-only customer shows that number GREEN, with a Change button', () => {
  // The receipt stamps the primary phone only (nav-quick-collect.js
  // receipt.phone), so a customer whose number lives in whatsappPhone
  // would read "Not saved" from the stamp alone. The live-state
  // resolution (whatsappPhoneFor) is passed in as the option.
  // LIVE FIX 1: the saved number shows green with a Change button.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }), { whatsappPhone: FAKE_PHONE });
  const row = phoneRowOf(html);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes(FAKE_PHONE), 'whatsappPhone shown');
  assert.ok(!row.includes('Not saved'), 'no "Not saved" when whatsappPhone is saved');
  assert.ok(!html.includes('data-qc-add-phone'), 'no Add number button when whatsappPhone is saved');
  assert.ok(row.includes('qc-phone-saved'), 'saved number shows green');
  assert.ok(row.includes('data-qc-edit-phone'), 'a Change button opens the inline editor');
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
  // QC receipt-modal overhaul (decision (j)): the fixture is a PARTIAL
  // receipt (PKR 1,000 still owed) so the merged Still-owed row renders
  // with its figure — the row is hidden when fully paid (QC Success
  // Card Polish, 2026-11-13), and the hiding itself is pinned in
  // tests/qc-success-card-polish.test.js.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: FAKE_PHONE, payableRemaining: 1000, newTotalDues: 1000 }));
  const order = ['>Customer<', 'Mobile Number', 'Date &amp; Method', 'Area / Location', 'Still owed'];
  let last = -1;
  for (const marker of order) {
    const at = html.indexOf(marker);
    assert.ok(at > last, `card must carry ${marker} after the previous row`);
    last = at;
  }
  // QC Success Card Polish (2026-11-13): golden crown name + plain
  // number — no "#" and no parens.
  assert.ok(html.includes('👑 Test Customer 37'), 'Customer row keeps golden crown name + plain number');
  assert.ok(html.includes('08/11/2026 · Cash'), 'Date & Method row keeps date + method (date now prints DD/MM/YYYY)');
  assert.ok(html.includes('quickCollectAreaSelect'), 'Area select stays');
  assert.ok(html.includes('PKR 1,000'), 'Still owed row keeps its figure');
  // The header shows the SHORT form; the full number stays in the
  // title + data-full-receipt-number attributes.
  assert.ok(html.includes('>RCPT-1<'), 'receipt id shows the short form in the header');
  assert.ok(html.includes('title="RCPT-12-202611-01"'), 'full receipt id stays in the title');
  assert.ok(html.includes('data-full-receipt-number="RCPT-12-202611-01"'), 'full receipt id stays in the data attribute');
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

test('the rendered card on a real no-phone payment shows "Not saved" + the button, and the button opens the INLINE editor on the card', async () => {
  // LIVE FIX 1: the button no longer opens the profile editor with
  // the phone focused — it opens an inline input + Save / Cancel on
  // the card itself. The modal stays open and onEditCustomer is never
  // called from this row; typing a number and tapping Save writes it
  // to the profile and the card shows it green.
  await withController(fixtureState(), async ({ controller, getEl, editCalls, toasts, getState }) => {
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
    const fakeTarget = { closest: (sel) => (String(sel).includes('[data-qc-add-phone]') ? fakeButton : null) };
    await getEl('quickCollectReceiptCard').dispatch('click', { target: fakeTarget });
    const editHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(editHtml.includes('data-qc-phone-input'), 'the inline editor opens on the card');
    assert.ok(editHtml.includes('data-qc-phone-save'), 'Save button present');
    assert.equal(getEl('quickCollectModal').open, true, 'the QC modal stays OPEN — no jump to the profile edit');
    assert.equal(editCalls.length, 0, 'the profile editor never opens');
    const fakeInputTarget = { closest: (sel) => (sel === '[data-qc-phone-input]' ? {} : null), value: FAKE_PHONE };
    await getEl('quickCollectReceiptCard').dispatch('input', { target: fakeInputTarget });
    const fakeSaveTarget = { closest: (sel) => (sel === '[data-qc-phone-save]' ? {} : null) };
    await getEl('quickCollectReceiptCard').dispatch('click', { target: fakeSaveTarget });
    assert.equal(getState().customers[0].phone, FAKE_PHONE, 'the number is saved on the profile');
    const savedHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(savedHtml.includes(FAKE_PHONE), 'card shows the saved number');
    assert.ok(savedHtml.includes('qc-phone-saved'), 'saved number shows green');
    assert.ok(toasts.some((t) => String(t.msg).includes('Mobile number saved')), 'success toast fires');
  });
});

test('the rendered card on a real whatsappPhone-only payment shows that number GREEN, with a Change button', async () => {
  // LIVE FIX 1: the saved number shows green with a Change button
  // (no Add number button — a number is already saved).
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
    assert.ok(cardHtml.includes('qc-phone-saved'), 'saved number shows green');
    assert.ok(cardHtml.includes('data-qc-edit-phone'), 'a Change button opens the inline editor');
  });
});

test('wiring source: the card container delegates the Add number click to the INLINE editor, never to the profile edit', () => {
  // LIVE FIX 1: the button no longer opens the profile editor (the
  // old pin asserted onEditCustomer with focus 'phone' after 350ms).
  // The delegation now opens the inline editor on the card and Save
  // writes through updateCustomerProfile + onSaveState.
  const cardStart = quickCollectSrc.indexOf('export function renderQuickCollectReceiptCardHtml');
  const cardEnd = quickCollectSrc.indexOf('export function quickCollectShopChoices');
  const cardSrc = quickCollectSrc.slice(cardStart, cardEnd);
  assert.ok(cardSrc.includes('data-qc-add-phone'), 'the card markup carries the Add number hook');
  assert.ok(cardSrc.includes('data-qc-edit-phone'), 'the card markup carries the Change hook');
  assert.ok(cardSrc.includes('qc-phone-saved'), 'a saved number carries the green class');
  // The delegation lives in the modal setup (it needs the closure
  // editor state + onSaveState, which the pure renderer cannot see).
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  assert.ok(setupSrc.includes("receiptCardContainer.addEventListener('click'"), 'the card container delegates clicks');
  assert.ok(setupSrc.includes("closest?.('[data-qc-add-phone], [data-qc-edit-phone]')"), 'the delegation matches the Add number / Change hooks');
  assert.ok(setupSrc.includes("closest?.('[data-qc-phone-save]')"), 'the delegation matches the Save hook');
  assert.ok(setupSrc.includes('updateCustomerProfile(getState(), activeReceipt.customerId'), 'Save writes through the canonical profile path');
  assert.ok(setupSrc.includes('onSaveState(next)'), 'Save persists the updated state');
  const blockStart = setupSrc.indexOf('// LIVE FIX 3: the success card');
  const blockEnd = setupSrc.indexOf('function executeUndo()', blockStart);
  const block = setupSrc.slice(blockStart, blockEnd);
  assert.ok(block.length > 500, 'the inline-editor delegation block exists');
  assert.ok(!block.includes('onEditCustomer'), 'the phone row never opens the profile editor');
});
