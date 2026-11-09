/**
 * plan547-submit-refusals-seen-and-focused.test.js — Plan 547 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: three submit-time refusals were toast-only, so
 * the operator never saw WHERE the problem was —
 *  - an invalid amount (executeQuickCollection throws "Enter a valid
 *    collected amount greater than zero") surfaced only through the
 *    submit handler's catch, as a toast;
 *  - a future payment date toasted t('bdate_future_error') with no
 *    field focus;
 *  - a large cash payment with no approver focused the approver
 *    input, but that input lives inside the collapsed
 *    <details id="quickCollectMoreOptions"> — focus on a hidden
 *    element is invisible, and the toast was the only clue.
 * The Transaction ID refusal, by contrast, got the proper treatment
 * in Plans 292/296: an inline <p role="alert"> under the field,
 * aria-invalid, and focus on the field.
 *
 * Pins:
 *  - acceptance: Save with amount 0 (and a negative amount): inline
 *    error under the amount field, field focused, no reliance on the
 *    toast, nothing recorded; future date: inline error under the
 *    date field, field focused, nothing recorded; cash over the
 *    threshold, approver blank, More Options closed, Save: the
 *    details open, the approver field focused and visible, the toast
 *    still shown; a valid save flows as before (confirm, record);
 *  - the inline errors mirror the TID pattern exactly — same
 *    .qc-field-error class, role="alert", aria-invalid +
 *    aria-describedby, created once and reused, cleared by typing
 *    in the field; the toast is only the fallback when the field is
 *    missing;
 *  - a stale error clears once the value is valid again (the amount
 *    chips set the field programmatically with no input event, so
 *    the typed clear alone would leave a fixed amount's error
 *    showing);
 *  - the fully-paid guard stays toast-only BY DESIGN: it has no
 *    field it belongs under — the month is not wrong, the bill's paid
 *    state is, and the remedy is the Advance checkbox (a toggle, not
 *    a field with an error slot) or a different month; the month
 *    select itself lives inside the collapsed More Options, where an
 *    inline error would hide. Pinned by the wiring test, not by a
 *    behaviour test, so no field is invented for it;
 *  - the one-screen path is not regressed: its own draft validation
 *    refuses an invalid amount on the one screen itself
 *    (quickCollectOneScreenDraft, field 'amount'), and it re-dates
 *    the hidden form to today (Plan 544), so the main submit's new
 *    pre-checks can never fire under a hidden step from the
 *    one-screen.
 *
 * Harness: the Plan 539 / Plan 543 / Plan 544 / Plan 545 controller
 * harness (mock DOM + mock localStorage), with the More Options
 * <details> pre-created (the setup reads it now) and scrollIntoView
 * recorded. Synthetic data only — no real customer names, no
 * realistic phone numbers (pattern-fake digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

const now = new Date();
const today = getPakistanLocalDate(now);
const month = today.slice(0, 7);
const tomorrow = getPakistanLocalDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));

const AMOUNT_MSG = 'Enter a valid collected amount greater than zero.';
const DATE_MSG = 'Payment date cannot be in the future.';

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function plan547State() {
  let state = createInitialState(['Plan547 Tester One']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due');
  return state;
}

/** Plan 547 controller harness: the Plan 545 mock DOM, More Options aware. */
function plan547Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const classes = new Set();
    const el = {
      tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: {
        toggle: (name, force) => {
          const on = force === undefined ? !classes.has(name) : !!force;
          if (on) classes.add(name); else classes.delete(name);
          return on;
        },
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      hasAttribute: () => false,
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      dispatchEvent: (evt) => {
        for (const h of (listeners[evt.type] || [])) h({ type: evt.type, target: el, preventDefault: () => {}, ...evt });
        return true;
      },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      insertAdjacentElement: (position, other) => { el.insertedAfter = { position, element: other }; return other; },
      before: () => {},
      after: () => {},
      scrollIntoView: (...args) => { el.scrolledIntoView = args; },
      focus: () => { el.focused = true; },
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      focused: false,
      insertedAfter: null,
      scrolledIntoView: null,
      opened: false,
      open: false
    };
    let idValue = String(id ?? '');
    Object.defineProperty(el, 'id', {
      get: () => idValue,
      set: (v) => { idValue = String(v ?? ''); if (idValue) registry.set(idValue, el); },
      enumerable: true, configurable: true
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  // Every id the setup reads is pre-created here (the full
  // getElementById list from nav-quick-collect.js), EXCEPT the three
  // dynamically created inline errors — quickCollectTxnError (TID
  // guard) and quickCollectAmountError / quickCollectDateError (Plan
  // 547) — which must be absent until their guard creates them.
  const SETUP_IDS = ['bncBigNameConfirm', 'bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'qcSettleStatusBadge', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectAnotherBtn', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDailyEntrySummary', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectMoreOptions', 'quickCollectNextReceiptLine', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rptRepeatPayment', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'snsSuccessNextSteps', 'sowStillOwesLine', 'transactionsView'];
  for (const setupId of SETUP_IDS) getEl(setupId);

  // The real DOM resets a select's value when its options are rebuilt
  // via innerHTML (the `selected` option wins). The billing month
  // select gets the same treatment, so a fresh open lands on its
  // default.
  const monthSelectEl = getEl('quickCollectMonthSelect');
  let monthHtml = '';
  Object.defineProperty(monthSelectEl, 'innerHTML', {
    get: () => monthHtml,
    set: (v) => {
      monthHtml = String(v ?? '');
      const m = monthHtml.match(/value="([^"]+)"\s+selected/);
      if (m) monthSelectEl.value = m[1];
    }
  });

  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => registry.get(id) ?? null,
    querySelector: () => null,
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
    onEditCustomer: () => {}
  });

  return {
    getEl, toasts, controller,
    // Non-conjuring read: a dynamically created inline error is
    // found only once its guard has created it.
    getError: (id) => registry.get(id) ?? null,
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Open the form for the seed customer with a working requestSubmit. */
function openForm(h) {
  h.controller.open('seed-001');
  const form = h.getEl('quickCollectPaymentForm');
  form.requestSubmit = () => form.dispatch('submit');
  return form;
}

function errorToasts(h) {
  return h.toasts.filter(t => t.opts && t.opts.type === 'error');
}

test('plan 547 (REPRO): Save with amount 0 shows the inline error under the amount field, focused, no toast', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'precondition: amount prefilled at the full dues');
    h.getEl('quickCollectAmountInput').value = '0';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    const amountInput = h.getEl('quickCollectAmountInput');
    assert.ok(amountInput.insertedAfter, 'inline error inserted after the amount field');
    assert.equal(amountInput.insertedAfter.position, 'afterend', 'error sits directly after the field');
    const err = amountInput.insertedAfter.element;
    assert.equal(err.textContent, AMOUNT_MSG, 'inline error names the invalid amount');
    assert.equal(err.hidden, false, 'inline error visible');
    assert.equal(err.className, 'qc-field-error', 'same class as the TID error');
    assert.equal(err.getAttribute('role'), 'alert', 'same role as the TID error');
    assert.equal(amountInput.getAttribute('aria-invalid'), 'true', 'field marked invalid');
    assert.equal(amountInput.getAttribute('aria-describedby'), 'quickCollectAmountError', 'field describes the error');
    assert.equal(amountInput.focused, true, 'amount field focused');
    assert.equal(errorToasts(h).length, 0, 'no reliance on the toast');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, true, 'confirm step never shown');
  } finally {
    h.restore();
  }
});

test('plan 547 (REPRO): a negative amount is refused the same way', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '-50';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    const amountInput = h.getEl('quickCollectAmountInput');
    assert.ok(amountInput.insertedAfter, 'inline error inserted after the amount field');
    assert.equal(amountInput.insertedAfter.element.textContent, AMOUNT_MSG, 'inline error names the invalid amount');
    assert.equal(amountInput.insertedAfter.element.hidden, false, 'inline error visible');
    assert.equal(amountInput.focused, true, 'amount field focused');
    assert.equal(errorToasts(h).length, 0, 'no reliance on the toast');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
  } finally {
    h.restore();
  }
});

test('plan 547 (REPRO): a future payment date shows the inline error under the date field, focused, no toast', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    assert.equal(h.getEl('quickCollectDateInput').value, today, 'precondition: date prefilled to today');
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectDateInput').value = tomorrow;
    await form.dispatch('submit');

    const dateInput = h.getEl('quickCollectDateInput');
    assert.ok(dateInput.insertedAfter, 'inline error inserted after the date field');
    const err = dateInput.insertedAfter.element;
    assert.equal(err.textContent, DATE_MSG, 'inline error names the future date');
    assert.equal(err.hidden, false, 'inline error visible');
    assert.equal(err.className, 'qc-field-error', 'same class as the TID error');
    assert.equal(err.getAttribute('role'), 'alert', 'same role as the TID error');
    assert.equal(dateInput.getAttribute('aria-invalid'), 'true', 'field marked invalid');
    assert.equal(dateInput.getAttribute('aria-describedby'), 'quickCollectDateError', 'field describes the error');
    assert.equal(dateInput.focused, true, 'date field focused');
    assert.equal(errorToasts(h).length, 0, 'no reliance on the toast');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, true, 'confirm step never shown');
  } finally {
    h.restore();
  }
});

test('plan 547 (REPRO): large cash with no approver opens More Options, scrolls it into view, focuses the approver', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    const details = h.getEl('quickCollectMoreOptions');
    details.open = false;
    h.getEl('quickCollectLargeCashThreshold').value = '5000';
    h.getEl('quickCollectAmountInput').value = '10000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    assert.equal(details.open, true, 'More Options opened before the focus');
    assert.ok(details.scrolledIntoView, 'the details were scrolled into view');
    assert.equal(h.getEl('quickCollectLargeCashApprover').focused, true, 'approver field focused');
    assert.ok(h.toasts.some(t => typeof t.msg === 'string' && /Large cash payments need the owner/.test(t.msg)), 'the toast still explains the refusal');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, true, 'confirm step never shown');
  } finally {
    h.restore();
  }
});

test('plan 547: typing in the field clears its inline error', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '0';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');
    const amountInput = h.getEl('quickCollectAmountInput');
    const err = amountInput.insertedAfter.element;
    assert.equal(err.hidden, false, 'precondition: error visible');

    await amountInput.dispatch('input');
    assert.equal(err.hidden, true, 'typing hides the error');
    assert.equal(amountInput.getAttribute('aria-invalid'), null, 'invalid flag removed');

    // Same for the date error.
    h.getEl('quickCollectDateInput').value = tomorrow;
    await form.dispatch('submit');
    const dateInput = h.getEl('quickCollectDateInput');
    const dateErr = dateInput.insertedAfter.element;
    assert.equal(dateErr.hidden, false, 'precondition: date error visible');
    await dateInput.dispatch('input');
    assert.equal(dateErr.hidden, true, 'typing hides the date error');
    assert.equal(dateInput.getAttribute('aria-invalid'), null, 'invalid flag removed');
  } finally {
    h.restore();
  }
});

test('plan 547: fixing the amount without typing (a chip tap) clears the stale error on the next submit', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '0';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');
    const amountInput = h.getEl('quickCollectAmountInput');
    const err = amountInput.insertedAfter.element;
    assert.equal(err.hidden, false, 'precondition: error visible');

    // A chip tap sets the value programmatically with no input event
    // (SISP-101) — the typed clear never runs.
    amountInput.value = '1000.00';
    assert.equal(err.hidden, false, 'still showing before the next submit — no input event fired');
    await form.dispatch('submit');
    assert.equal(err.hidden, true, 'the valid submit clears the stale error');
    assert.equal(amountInput.getAttribute('aria-invalid'), null, 'invalid flag removed');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
  } finally {
    h.restore();
  }
});

test('plan 547: a valid save flows as before — confirm, record, no inline errors', async () => {
  const h = plan547Controller(plan547State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    await form.dispatch('submit');

    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.equal(h.getError('quickCollectAmountError'), null, 'no amount error was ever created');
    assert.equal(h.getError('quickCollectDateError'), null, 'no date error was ever created');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(errorToasts(h).length, 0, 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('plan 547 wiring: the TID pattern shared, pre-checks before the confirm and the record, approver opened before focus', () => {
  // The shared helper mirrors the TID block exactly.
  const helperIdx = wiringSrc.indexOf('function showQuickCollectFieldError(input, errorId, message)');
  assert.ok(helperIdx > -1, 'shared field-error helper exists');
  const helperBlock = wiringSrc.slice(helperIdx, helperIdx + 1400);
  assert.ok(helperBlock.includes("err.className = 'qc-field-error';"), 'same error class as the TID error');
  assert.ok(helperBlock.includes("err.setAttribute('role', 'alert');"), 'same alert role as the TID error');
  assert.ok(helperBlock.includes("input.insertAdjacentElement('afterend', err);"), 'error sits directly after the field');
  assert.ok(helperBlock.includes("input.setAttribute('aria-invalid', 'true');"), 'field marked invalid');
  assert.ok(helperBlock.includes("input.setAttribute('aria-describedby', errorId);"), 'field describes the error');
  assert.ok(helperBlock.includes('input.focus();'), 'field focused');
  assert.ok(helperBlock.includes("input.addEventListener('input', clear);"), 'typing clears the error');
  // The pre-checks call the helper for both fields.
  assert.ok(wiringSrc.includes("showQuickCollectFieldError(dateInput, 'quickCollectDateError'"), 'date refusal uses the helper');
  assert.ok(wiringSrc.includes("showQuickCollectFieldError(amountInput, 'quickCollectAmountError'"), 'amount refusal uses the helper');
  assert.ok(wiringSrc.includes("t('bdate_future_error')"), 'date message is the existing i18n string');
  // The amount backstop is untouched: the recorder still refuses an
  // invalid amount for every other entry path.
  assert.ok(wiringSrc.includes("throw new Error('Enter a valid collected amount greater than zero.');"), 'executeQuickCollection still throws on an invalid amount');
  // The pre-checks run before the confirm summary and the recording.
  const submitIdx = wiringSrc.indexOf("paymentForm?.addEventListener('submit'");
  const submitBlock = wiringSrc.slice(submitIdx);
  assert.ok(submitBlock.indexOf("'quickCollectAmountError'") < submitBlock.indexOf('buildSaveConfirmationSummary()'), 'amount check runs before the confirm summary');
  assert.ok(submitBlock.indexOf("'quickCollectDateError'") < submitBlock.indexOf('buildSaveConfirmationSummary()'), 'date check runs before the confirm summary');
  assert.ok(submitBlock.indexOf("'quickCollectAmountError'") < submitBlock.indexOf('executeQuickCollection(state, {'), 'amount check runs before the recording');
  // The large-cash block opens More Options before focusing the
  // approver, and it is the only submit-time focus target inside
  // the section.
  const cashIdx = wiringSrc.indexOf('requiresLargeCashApproval(isCashPaymentMethod(methodVal)');
  const cashBlock = wiringSrc.slice(cashIdx, cashIdx + 1200);
  assert.ok(cashBlock.includes('moreOptionsDetails.open = true;'), 'details opened before the focus');
  assert.ok(cashBlock.indexOf('moreOptionsDetails.open = true;') < cashBlock.indexOf('largeCashApproverInput?.focus();'), 'open happens before focus');
  assert.ok(cashBlock.includes('scrollIntoView'), 'details scrolled into view');
  assert.ok(wiringSrc.includes("const moreOptionsDetails = document.getElementById('quickCollectMoreOptions');"), 'details read beside the other large-cash fields');
  // The fully-paid guard stays toast-only by design: no field owns
  // the refusal, so no inline error is invented for it.
  const paidIdx = wiringSrc.indexOf("onToast(t('adv_blocked_paid')");
  assert.ok(paidIdx > -1, 'fully-paid guard still toasts');
  const paidBlock = wiringSrc.slice(paidIdx - 600, paidIdx + 100);
  assert.ok(!paidBlock.includes('showQuickCollectFieldError'), 'no inline error invented for the fully-paid guard');
  // No validation rule changed, no new hex, no new store key, no new
  // element-id prefix, PKR only.
  assert.ok(!wiringSrc.includes('shahdara_plan547'), 'no new store key');
  assert.ok(!/\.qc-[a-z-]*#[0-9a-f]{6}/i.test(submitBlock.slice(0, 4000)), 'no new hex colour in the submit handler');
});
