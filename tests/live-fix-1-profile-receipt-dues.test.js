// LIVE FIX 1 (2026-11-12): four user-priority live fixes in one PR —
//  (1) the profile Clear dues tap did NOTHING on the user's phone (no
//      dialog, no toast, button idle) + the action group needed polish;
//  (2) the Add-customer sheet overflowed the phone with no Save visible;
//  (3) the receipt's Mobile Number row must edit inline (add + save on
//      the receipt, green when saved) instead of jumping to the profile;
//  (4) the Home Dues list tile opened Dues Recovery instead of the
//      customer dues list.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01, 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  setupQuickCollectModal,
  receiptPhoneSaveField,
  getPakistanLocalDate,
} from '../nav-quick-collect.js';
import {
  calculatePaymentAllocations,
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile,
} from '../core.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const styles = read('styles.css');
const navCss = read('nav.css');
const router = read('screen-router.js');
const language = read('nav-language.js');
const html = read('index.html');
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
function phoneRowOf(cardHtml) {
  const at = cardHtml.indexOf('Mobile Number');
  if (at < 0) return null;
  const rowStart = cardHtml.lastIndexOf('<div class="qc-receipt-item', at);
  const rowEnd = cardHtml.indexOf('</div>', at);
  return cardHtml.slice(rowStart, rowEnd);
}

// ---------------------------------------------------------------------------
// Part 1 — Clear dues wiring + profile action-group polish
// ---------------------------------------------------------------------------

test('LIVE FIX 1: renderDetail wires Clear dues on every profile render, behind a dataset guard', () => {
  const start = app.indexOf('function renderDetail()');
  assert.ok(start >= 0, 'renderDetail exists');
  const nextFn = app.indexOf('\nfunction ', start + 1);
  const renderDetailSrc = nextFn === -1 ? app.slice(start) : app.slice(start, nextFn);
  assert.ok(renderDetailSrc.includes("const clearDuesBtn = $('#clearDuesButton');"), 'renderDetail looks the button up');
  assert.ok(renderDetailSrc.includes('!clearDuesBtn.dataset.wiredClearDues'), 'the wiring is guarded so a re-render never double-attaches');
  assert.ok(renderDetailSrc.includes("clearDuesBtn.dataset.wiredClearDues = '1';"), 'the guard is set once the listener attaches');
  assert.ok(renderDetailSrc.includes("clearDuesBtn.addEventListener('click'"), 'the click listener attaches in renderDetail');
});

test('LIVE FIX 1: the module-level Clear dues binding is gone — one wiring site only', () => {
  assert.ok(!app.includes("$('#clearDuesButton').addEventListener('click', () => { void clearDues(); });"), 'the old module-level binding is removed');
  assert.equal(app.split('wiredClearDues').length - 1, 2, 'exactly one guard check + one guard set (a tap can never run clearDues() twice)');
});

test('LIVE FIX 1: a guard-refused Clear dues tap says so instead of dying silently', () => {
  const start = app.indexOf('async function clearDues()');
  assert.ok(start >= 0, 'clearDues exists');
  const nextFn = app.indexOf('\nfunction ', start + 1);
  const clearDuesSrc = nextFn === -1 ? app.slice(start) : app.slice(start, nextFn);
  assert.ok(clearDuesSrc.includes('Clear dues is already running'), 'a refused tap toasts instead of returning silently');
});

test('LIVE FIX 1: a rejected Clear dues promise surfaces as an error toast, never void-swallowed', () => {
  const start = app.indexOf('function renderDetail()');
  const nextFn = app.indexOf('\nfunction ', start + 1);
  const renderDetailSrc = app.slice(start, nextFn);
  assert.ok(renderDetailSrc.includes('.catch((err)'), 'the click handler catches a rejected clearDues()');
  assert.ok(renderDetailSrc.includes('Clear dues could not start'), 'the rejection toasts with the reason');
});

test('LIVE FIX 1: every profile Row 1 button stays one line at a 44px tap target', () => {
  assert.ok(styles.includes('.profile-action-group>button{min-height:44px;touch-action:manipulation;white-space:nowrap;min-width:0}'), 'all four group buttons are single-line, 44px, shrinkable');
  assert.ok(styles.includes('.profile-action-group .text-button.danger{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 10px;border:1px solid #edd8d2;border-radius:9px;background:#fffafa;font-size:11px;line-height:1.2;text-align:center;text-decoration:none;white-space:nowrap}'), 'Delete no longer wraps to two lines ("Delete / customer") while the others are one line');
});

test('LIVE FIX 1: the scroll-top FAB sits above the speed dial — the D-T6 padding no longer exceeds its top edge (disclosed trade-off)', () => {
  // Pucho + Profile Header Polish moved the FAB above the speed-dial
  // trigger (their boxes overlapped; the dial paints above at z-index
  // 1040). The FAB bottom is now a calc, not 74px: desktop 60+16+50+12
  // = 138px, mobile 64+16+50+12 = 142px. Its top edge (138+40 = 178px
  // desktop, 142+34 = 176px mobile) now sits ABOVE the ≤620px D-T6
  // detail-pane bottom padding (126px) — the old guarantee that the
  // padding exceeds the FAB top edge no longer holds, and the last
  // content can slide under the 34px FAB at the very bottom of a scroll
  // (revealed by scrolling up slightly; the FAB only shows past 400px
  // scroll and is 34px wide at the right edge). Raising every bottom
  // padding by ~50px to restore the guarantee was rejected as out of
  // scope for this polish — disclosed in the PR body; the Transactions
  // item owns further FAB work (auto-hide). This pins the new geometry
  // so a later change cannot silently move it again.
  const fab = navCss.match(/\.scroll-top-button \{[^}]*\}/);
  assert.ok(fab, 'scroll-top button rule present');
  assert.ok(fab[0].includes('bottom: calc(var(--bottom-nav-height, 60px) + 16px + 50px + 12px)'), 'FAB bottom is the above-dial calc');
  const fabHeight = Number(fab[0].match(/height: (\d+)px/)?.[1]);
  assert.equal(fabHeight, 40, 'FAB height is 40px');
  assert.ok(navCss.includes('bottom: calc(var(--bottom-nav-height, 64px) + 16px + 50px + 12px)'), 'mobile FAB bottom is the above-dial calc');
  const pane = styles.match(/\.detail-pane \{ padding: 18px 14px max\(96px, (\d+)px\); \}/);
  assert.ok(pane, 'D-T6 detail-pane bottom padding present');
  assert.equal(Number(pane[1]), 126, 'D-T6 padding is still 126px');
  // The disclosed trade-off, pinned as inequalities (recorded, not
  // blessed): FAB top edge 178px desktop / 176px mobile exceeds 126px.
  assert.ok(138 + fabHeight > Number(pane[1]), 'desktop FAB top edge now sits above the D-T6 padding (disclosed, see comment)');
  assert.ok(142 + 34 > Number(pane[1]), 'mobile FAB top edge now sits above the D-T6 padding (disclosed, see comment)');
});

// ---------------------------------------------------------------------------
// Part 2 — Add-customer sheet overflow + sticky Save
// ---------------------------------------------------------------------------

test('LIVE FIX 2: the Add-customer dialog labels wrap (scoped — the global nowrap stays)', () => {
  assert.ok(styles.includes('#addCustomerDialog .optional-label{white-space:normal}'), 'labels wrap inside the Add-customer dialog only');
  assert.ok(styles.includes('.optional-label { white-space: nowrap; }'), 'the global §3.1 nowrap (billing-ledger redesign) is untouched everywhere else');
});

test('LIVE FIX 2: the Add-customer sheet cannot overflow horizontally and its Save sticks to the bottom', () => {
  assert.ok(styles.includes('#addCustomerDialog:has(#addCustomerForm){max-height:calc(100dvh - 24px);overflow-y:auto;overflow-x:hidden}'), 'the dialog clips horizontal overflow');
  assert.ok(styles.includes('.new-customer-fields>*{min-width:0}'), 'grid children can shrink below content width, so nothing forces the track wide');
  assert.ok(styles.includes('.new-customer-fields .modal-actions{margin-top:12px;position:sticky;bottom:0;background:#fff;padding-top:9px}'), 'the Save row sticks to the bottom (backup-modal pattern) while the sheet scrolls');
});

test('LIVE FIX 2: the Save button exists in the Add-customer form', () => {
  const dialogAt = html.indexOf('id="addCustomerDialog"');
  const submitAt = html.indexOf('id="addCustomerSubmit"');
  assert.ok(dialogAt >= 0, 'Add-customer dialog exists');
  assert.ok(submitAt > dialogAt, 'the submit button lives inside the dialog');
  const submitLine = html.split('\n').find((line) => line.includes('id="addCustomerSubmit"'));
  assert.ok(submitLine.includes('Check and add customer'), 'the submit button is labelled');
  assert.ok(submitLine.includes('type="submit"'), 'the submit button submits the form');
});

// ---------------------------------------------------------------------------
// Part 3 — receipt Mobile Number field, inline + smart
// ---------------------------------------------------------------------------

test('LIVE FIX 3: receiptPhoneSaveField writes back to the field that produced the displayed number', () => {
  assert.equal(receiptPhoneSaveField({ whatsappPhone: FAKE_PHONE, phone: '' }, FAKE_PHONE), 'whatsappPhone', 'the displayed whatsappPhone saves back to whatsappPhone');
  assert.equal(receiptPhoneSaveField({ whatsappPhone: '', phone: FAKE_PHONE }, FAKE_PHONE), 'phone', 'the displayed primary phone saves back to phone');
  assert.equal(receiptPhoneSaveField({ whatsappPhone: '03011111111', phone: FAKE_PHONE }, FAKE_PHONE), 'phone', 'a set-but-not-displayed whatsappPhone is never overwritten by the primary number');
  assert.equal(receiptPhoneSaveField({}, ''), 'phone', 'no number at all writes the primary phone');
  assert.equal(receiptPhoneSaveField(null, FAKE_PHONE), 'phone', 'a missing customer writes the primary phone');
});

test('LIVE FIX 3: a saved number shows GREEN with a Change button, never an Add number button', () => {
  const cardHtml = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: FAKE_PHONE }));
  const row = phoneRowOf(cardHtml);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes(FAKE_PHONE), 'saved number shown');
  assert.ok(row.includes('qc-phone-saved'), 'saved number carries the green class');
  assert.ok(row.includes('data-qc-edit-phone'), 'a Change button opens the inline editor');
  assert.ok(row.includes('Change'), 'button labelled "Change"');
  assert.ok(!cardHtml.includes('data-qc-add-phone'), 'no Add number button when a number is saved');
  assert.ok(!row.includes('Not saved'), 'no "Not saved" when a number is saved');
});

test('LIVE FIX 3: edit mode renders an input + Save / Cancel, and an error reads as an alert', () => {
  const cardHtml = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }), { editingPhone: true, phoneEditValue: FAKE_PHONE });
  const row = phoneRowOf(cardHtml);
  assert.ok(row, 'phone row present');
  assert.ok(row.includes('data-qc-phone-input'), 'inline input present');
  assert.ok(row.includes(`value="${FAKE_PHONE}"`), 'the input is prefilled with the number being edited');
  assert.ok(row.includes('placeholder="03012345678"'), 'pattern-fake placeholder only, never a real number');
  assert.ok(row.includes('data-qc-phone-save'), 'Save button present');
  assert.ok(row.includes('data-qc-phone-cancel'), 'Cancel button present');
  assert.ok(!cardHtml.includes('data-qc-add-phone'), 'no Add number button while editing');
  const errorHtml = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }), { editingPhone: true, phoneEditValue: 'abc', phoneEditError: 'Only numbers, spaces, dashes, or a leading + are allowed.' });
  const errorRow = phoneRowOf(errorHtml);
  assert.ok(errorRow.includes('data-qc-phone-error'), 'validation error span present');
  assert.ok(errorRow.includes('role="alert"'), 'the error is announced');
  assert.ok(errorRow.includes('Only numbers, spaces, dashes'), 'the validation message shows inline');
});

test('LIVE FIX 3: the edited number is HTML-escaped — a hostile typed value cannot break the card', () => {
  const cardHtml = renderQuickCollectReceiptCardHtml(baseReceipt({ phone: '' }), { editingPhone: true, phoneEditValue: '<script>alert(1)</script>' });
  assert.ok(!cardHtml.includes('<script>alert(1)</script>'), 'raw markup must never reach the card');
  assert.ok(cardHtml.includes('&lt;script&gt;'), 'value must be escaped');
});

// --- The inline editor, behaviourally, through the real modal
// controller + a real payment (mock-DOM harness adapted from the
// Plan 534 leg-2 duplicate test, as in
// tests/qc-success-card-phone-row.test.js) ---

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
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

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

// Dispatch a delegated click on the card container with a target whose
// closest() matches the given selector (exactly as a real tap would).
async function tapCard(getEl, selector) {
  const fakeTarget = { closest: (sel) => (String(sel).includes(selector) ? {} : null) };
  await getEl('quickCollectReceiptCard').dispatch('click', { target: fakeTarget });
}

test('LIVE FIX 3: Add number opens the inline editor on the card — the modal stays open, the profile editor never opens', async () => {
  await withController(fixtureState(), async ({ controller, getEl, editCalls, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes('Not saved'), 'precondition: no number saved yet');
    assert.ok(cardHtml.includes('data-qc-add-phone'), 'precondition: Add number button present');
    await tapCard(getEl, '[data-qc-add-phone]');
    const editHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(editHtml.includes('data-qc-phone-input'), 'the inline editor opens on the card');
    assert.ok(editHtml.includes('data-qc-phone-save'), 'Save button present');
    assert.ok(editHtml.includes('data-qc-phone-cancel'), 'Cancel button present');
    assert.equal(getEl('quickCollectModal').open, true, 'the QC modal stays OPEN — no jump to the profile edit');
    assert.equal(editCalls.length, 0, 'the profile editor never opens');
  });
});

test('LIVE FIX 3: typing a number and tapping Save writes it to the profile and the card shows it green', async () => {
  await withController(fixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    await tapCard(getEl, '[data-qc-add-phone]');
    const fakeInputTarget = { closest: (sel) => (sel === '[data-qc-phone-input]' ? {} : null), value: FAKE_PHONE };
    await getEl('quickCollectReceiptCard').dispatch('input', { target: fakeInputTarget });
    await tapCard(getEl, '[data-qc-phone-save]');
    assert.equal(getState().customers[0].phone, FAKE_PHONE, 'the number is saved on the profile via updateCustomerProfile');
    const savedHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(savedHtml.includes(FAKE_PHONE), 'card shows the saved number');
    assert.ok(savedHtml.includes('qc-phone-saved'), 'saved number shows green');
    assert.ok(!savedHtml.includes('data-qc-phone-input'), 'the editor closes after a successful save');
    assert.ok(toasts.some((t) => String(t.msg).includes('Mobile number saved')), 'success toast fires');
  });
});

test('LIVE FIX 3: an invalid number shows an inline error and saves nothing; the editor stays open', async () => {
  await withController(fixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    await tapCard(getEl, '[data-qc-add-phone]');
    const fakeInputTarget = { closest: (sel) => (sel === '[data-qc-phone-input]' ? {} : null), value: 'abc' };
    await getEl('quickCollectReceiptCard').dispatch('input', { target: fakeInputTarget });
    await tapCard(getEl, '[data-qc-phone-save]');
    assert.ok(!getState().customers[0].phone, 'nothing is saved for an invalid number');
    const errorHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(errorHtml.includes('data-qc-phone-input'), 'the editor stays open so the operator can fix the number');
    assert.ok(errorHtml.includes('data-qc-phone-error'), 'the validation error shows inline');
    assert.ok(errorHtml.includes('Only numbers, spaces, dashes'), 'the validation message names the problem');
  });
});

test('LIVE FIX 3: saving with an empty editor shows an inline error and saves nothing', async () => {
  await withController(fixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    await tapCard(getEl, '[data-qc-add-phone]');
    await tapCard(getEl, '[data-qc-phone-save]');
    assert.ok(!getState().customers[0].phone, 'nothing is saved for an empty editor');
    const errorHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(errorHtml.includes('data-qc-phone-input'), 'the editor stays open');
    assert.ok(errorHtml.includes('Enter a mobile number to save.'), 'the empty-save error shows inline');
  });
});

test('LIVE FIX 3: Cancel closes the editor without saving — the card goes back to "Not saved"', async () => {
  await withController(fixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    await submitAndConfirm(getEl, getState, MONTH);
    await tapCard(getEl, '[data-qc-add-phone]');
    assert.ok(getEl('quickCollectReceiptCard').innerHTML.includes('data-qc-phone-input'), 'precondition: editor open');
    await tapCard(getEl, '[data-qc-phone-cancel]');
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(!cardHtml.includes('data-qc-phone-input'), 'the editor closes');
    assert.ok(cardHtml.includes('Not saved'), 'the card goes back to "Not saved"');
    assert.ok(cardHtml.includes('data-qc-add-phone'), 'Add number is offered again');
    assert.ok(!getState().customers[0].phone, 'nothing is saved on cancel');
  });
});

test('LIVE FIX 3: wiring source — the card container delegates the phone row to the inline editor, never to the profile edit', () => {
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  assert.ok(setupSrc.includes("closest?.('[data-qc-add-phone], [data-qc-edit-phone]')"), 'the delegation matches the Add number / Change hooks');
  assert.ok(setupSrc.includes("closest?.('[data-qc-phone-save]')"), 'the delegation matches the Save hook');
  assert.ok(setupSrc.includes("closest?.('[data-qc-phone-cancel]')"), 'the delegation matches the Cancel hook');
  assert.ok(setupSrc.includes("closest?.('[data-qc-phone-input]')"), 'the typed value is tracked by a delegated input listener');
  assert.ok(setupSrc.includes('validatePakistanPhone(value)'), 'Save validates before writing');
  assert.ok(setupSrc.includes('updateCustomerProfile(getState(), activeReceipt.customerId'), 'Save writes through the canonical profile path');
  assert.ok(setupSrc.includes('onSaveState(next)'), 'Save persists the updated state');
  // The phone-row delegation must not jump to the profile editor any
  // more (the warnNoPhone toast action still may — it is a different
  // path). Slice the LIVE FIX 3 delegation block and check it alone.
  const blockStart = setupSrc.indexOf('// LIVE FIX 3: the success card');
  const blockEnd = setupSrc.indexOf('function executeUndo()', blockStart);
  const block = setupSrc.slice(blockStart, blockEnd);
  assert.ok(block.length > 500, 'the inline-editor delegation block exists');
  assert.ok(!block.includes('onEditCustomer'), 'the phone row never calls onEditCustomer');
  assert.ok(!block.includes('closeModal()'), 'the phone row never closes the modal');
});

// ---------------------------------------------------------------------------
// Part 4 — Home Dues list tile opens the customer dues list
// ---------------------------------------------------------------------------

test('LIVE FIX 4: the Dues list tile opens the Top Defaulters modal — one listener path, no route', () => {
  // The direct wiring that sent the tile to '#/recovery' is gone.
  assert.ok(!app.includes('duesListBtn'), 'no direct #homeActionDuesList wiring remains');
  assert.ok(!app.includes('wiredDues'), 'no direct-wiring dataset guard remains');
  // The single remaining path is onDuesList in the quick-actions setup.
  const onDuesStart = app.indexOf('onDuesList: () => {');
  assert.ok(onDuesStart >= 0, 'onDuesList exists in the quick-actions setup');
  const onDuesSrc = app.slice(onDuesStart, onDuesStart + 900);
  assert.ok(onDuesSrc.includes('topDefaultersModalController?.open'), 'the tile opens the Top Defaulters modal (the customer dues list)');
  assert.ok(onDuesSrc.includes('topDefaultersModalController.open();'), 'the modal opens through its controller');
  assert.ok(onDuesSrc.includes("$('#quickActionTopDefaulters')?.click()"), 'a not-yet-initialised controller falls back to the modal trigger');
  assert.ok(!onDuesSrc.includes('#/recovery'), 'the tile never navigates to Dues Recovery');
  assert.ok(!onDuesSrc.includes('switchView'), 'the tile never switches views');
});

test('LIVE FIX 4: the screen router no longer maps the Dues list tile to any screen', () => {
  // The id still appears in the explanatory comment above the map —
  // the pin is the map itself, which must not route the tile anywhere.
  const mapStart = router.indexOf('const TILE_TO_SCREEN');
  assert.ok(mapStart >= 0, 'the tile-to-screen map exists');
  const tileMap = router.slice(mapStart, router.indexOf(';', mapStart));
  assert.ok(!tileMap.includes('homeActionDuesList'), 'the tile id is absent from the tile-to-screen map');
  assert.ok(!router.includes("homeActionDuesList: 'recovery'"), 'no tile-to-recovery mapping remains anywhere');
  assert.ok(router.includes("quickActionRecordExpense: 'expenses'"), 'the other route tiles are untouched');
  assert.ok(router.includes("quickActionMonthlyReports: 'reports'"), 'the other route tiles are untouched');
  assert.ok(router.includes("quickActionAnalytics: 'analytics'"), 'the other route tiles are untouched');
});

test('LIVE FIX 4: the tile reads as the dues list in both languages — no more "Recovery"', () => {
  assert.ok(language.includes("dash_tile_dues_aria: 'Dues list — Top defaulters (who owes how much)'"), 'EN aria names the Top defaulters list');
  assert.ok(language.includes("dash_tile_dues_sub: 'Top defaulters'"), 'EN subtitle names the Top defaulters list');
  assert.ok(language.includes("dash_tile_dues_aria: 'واجبات کی فہرست — بڑے نادہندگان (کس کے کتنے بقایا ہیں)'"), 'UR aria names the Top defaulters list');
  assert.ok(language.includes("dash_tile_dues_sub: 'بڑے نادہندگان'"), 'UR subtitle names the Top defaulters list');
  assert.ok(!language.includes("dash_tile_dues_sub: 'Recovery & defaulters'"), 'the old EN "Recovery" subtitle is gone');
  assert.ok(!language.includes("dash_tile_dues_sub: 'وصولی اور نادہندگان'"), 'the old UR "Recovery" subtitle is gone');
  const tileAt = html.indexOf('id="homeActionDuesList"');
  assert.ok(tileAt >= 0, 'the tile exists');
  const tileSrc = html.slice(tileAt, tileAt + 1200);
  assert.ok(tileSrc.includes('Dues list — Top defaulters (who owes how much)'), 'the static aria-label matches the new EN text');
  assert.ok(tileSrc.includes('>Top defaulters<'), 'the static subtitle matches the new EN text');
});

test('LIVE FIX 4: the e2e specs expect the modal, not the Recovery screen', () => {
  const routerSpec = read('tests/e2e/screen-router.spec.mjs');
  assert.ok(routerSpec.includes("await expect(page.locator('#topDefaultersModal')).toBeVisible()"), 'screen-router spec expects the modal');
  assert.ok(!routerSpec.includes("await expectScreen(page, 'recovery')"), 'screen-router spec no longer expects the Recovery screen from the tile');
  const overloadSpec = read('tests/e2e/home-screen-overload-213.spec.mjs');
  assert.ok(overloadSpec.includes("await expect(page.locator('#topDefaultersModal')).toBeVisible()"), 'overload spec expects the modal');
  assert.ok(!overloadSpec.includes("await expect(page).toHaveURL(/#\\/recovery$/)"), 'overload spec no longer expects a Recovery URL from the tile');
});

test('LIVE FIX 4: Dues Recovery stays reachable from its own nav entries', () => {
  assert.ok(html.includes('data-nav-target="recovery"'), 'the drawer still links to Dues Recovery');
  assert.ok(html.includes('data-mobile-more="recovery"'), 'the mobile more menu still links to Dues Recovery');
});
