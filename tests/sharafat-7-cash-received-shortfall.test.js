/**
 * sharafat-7-cash-received-shortfall.test.js — Sharafat 7 of the
 * Sharafat 1–100 polish batch (Quick Collect & Split 1–10).
 *
 * The operator's case: the cash change calculator is display-only.
 * `cashReceivedInput` was read only by `renderCashChange` and its
 * `input` listener; the submit handler never read it. An operator
 * could record PKR 3,000 collected while the cash-received box said
 * PKR 2,000, and nothing warned — the till ends the day short with
 * a receipt that says the full amount was collected.
 *
 * The fix: at submit, when a cash method is used and a cash-received
 * figure was typed, a shortfall (cash received below the amount) is
 * refused before posting — a plain refusal, not a click-through
 * warning, because a warned-through shortfall would still record
 * the full amount as collected while the till is short; the
 * operator's correct remedy is to record the cash actually received
 * (a smaller amount) or correct the cash-received figure. The
 * refusal uses the Plan 547 treatment: an inline <p role="alert">
 * under the cash-received field, aria-invalid, and focus on the
 * field; the toast is only the fallback when the field is missing.
 *
 * Pins:
 *  - acceptance: cash payment with cash-received PKR 500 against a
 *    PKR 1,000 amount is refused — inline error under the
 *    cash-received field naming the PKR 500 shortfall, field
 *    focused, no error toast, nothing recorded, confirm step never
 *    shown; exact (PKR 1,000) and over-tendered (PKR 1,500) cash
 *    post unchanged — confirm, record, no cash-received error;
 *    no figure typed means no check — the box is optional; a
 *    non-cash method (Easypaisa + TID) with a short cash figure
 *    typed is unaffected;
 *  - the inline error mirrors the TID pattern exactly — same
 *    .qc-field-error class, role="alert", aria-invalid +
 *    aria-describedby, created once and reused, cleared by typing
 *    in the field; a stale error clears once the figure is valid
 *    again (the value is set programmatically with no input event);
 *  - wiring: the submit handler reads the shortfall through the
 *    calculator's own `cashChangeShortfallCents` (cash-received and
 *    amount field values, exactly as the live hint reads them),
 *    gated on a cash method, before the confirm summary and the
 *    recording; the calculator module itself needed no change —
 *    the helper and the figure formatter already existed.
 *
 * Harness: the Plan 547 controller harness (mock DOM + mock
 * localStorage), with the cash-received error left dynamically
 * created — `quickCollectCashReceivedError` must be absent until
 * its guard creates it, exactly like the TID / amount / date
 * errors. Synthetic data only — no real customer names, no
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

const SHORTFALL_MSG = 'Cash received is PKR 500 less than the amount — collect the full amount or correct the cash-received figure.';

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function sharafat7State() {
  let state = createInitialState(['Sharafat7 Tester One']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due');
  return state;
}

/** Sharafat 7 controller harness: the Plan 547 mock DOM. */
function sharafat7Controller(initialState) {
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
  // getElementById list from nav-quick-collect.js), EXCEPT the
  // dynamically created inline errors — quickCollectTxnError (TID
  // guard), quickCollectAmountError / quickCollectDateError (Plan
  // 547) and quickCollectCashReceivedError (Sharafat 7) — which must
  // be absent until their guard creates them.
  // QC receipt-modal overhaul: qcSettleStatusBadge, quickCollectAnotherBtn,
  // rptRepeatPayment and snsSuccessNextSteps were removed from the success
  // step — the mock must not conjure elements the real DOM no longer has.
  const SETUP_IDS = ['bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectMoreOptions', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'sowStillOwesLine', 'transactionsView'];
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

test('sharafat 7 (REPRO): cash-received PKR 500 against a PKR 1,000 cash amount is refused — inline error, focused, nothing recorded', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'precondition: amount prefilled at the full dues');
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '500';
    await form.dispatch('submit');

    const cashInput = h.getEl('quickCollectCashReceivedInput');
    assert.ok(cashInput.insertedAfter, 'inline error inserted after the cash-received field');
    assert.equal(cashInput.insertedAfter.position, 'afterend', 'error sits directly after the field');
    const err = cashInput.insertedAfter.element;
    assert.equal(err.textContent, SHORTFALL_MSG, 'inline error names the PKR 500 shortfall');
    assert.equal(err.hidden, false, 'inline error visible');
    assert.equal(err.className, 'qc-field-error', 'same class as the TID error');
    assert.equal(err.getAttribute('role'), 'alert', 'same role as the TID error');
    assert.equal(cashInput.getAttribute('aria-invalid'), 'true', 'field marked invalid');
    assert.equal(cashInput.getAttribute('aria-describedby'), 'quickCollectCashReceivedError', 'field describes the error');
    assert.equal(cashInput.focused, true, 'cash-received field focused');
    assert.equal(errorToasts(h).length, 0, 'no reliance on the toast');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, true, 'confirm step never shown');
  } finally {
    h.restore();
  }
});

test('sharafat 7: exact cash — PKR 1,000 received against PKR 1,000 — posts unchanged', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '1000';
    await form.dispatch('submit');

    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.equal(h.getError('quickCollectCashReceivedError'), null, 'no cash-received error was ever created');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(errorToasts(h).length, 0, 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('sharafat 7: over-tendered cash — PKR 1,500 received against PKR 1,000 — posts unchanged', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '1500';
    await form.dispatch('submit');

    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.equal(h.getError('quickCollectCashReceivedError'), null, 'no cash-received error was ever created');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(errorToasts(h).length, 0, 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('sharafat 7: no cash-received figure typed means no check — the box is optional', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '';
    await form.dispatch('submit');

    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.equal(h.getError('quickCollectCashReceivedError'), null, 'no cash-received error was ever created');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(errorToasts(h).length, 0, 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('sharafat 7: a non-cash method with a short cash figure typed is unaffected', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Easypaisa';
    h.getEl('quickCollectTransactionIdInput').value = 'TXN123456789';
    h.getEl('quickCollectCashReceivedInput').value = '500';
    await form.dispatch('submit');

    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing — the cash check never fired');
    assert.equal(h.getError('quickCollectCashReceivedError'), null, 'no cash-received error was ever created');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(errorToasts(h).length, 0, 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('sharafat 7: typing in the cash-received field clears its inline error', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '500';
    await form.dispatch('submit');
    const cashInput = h.getEl('quickCollectCashReceivedInput');
    const err = cashInput.insertedAfter.element;
    assert.equal(err.hidden, false, 'precondition: error visible');

    await cashInput.dispatch('input');
    assert.equal(err.hidden, true, 'typing hides the error');
    assert.equal(cashInput.getAttribute('aria-invalid'), null, 'invalid flag removed');
  } finally {
    h.restore();
  }
});

test('sharafat 7: fixing the figure without typing clears the stale error on the next submit', async () => {
  const h = sharafat7Controller(sharafat7State());
  try {
    const form = openForm(h);
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectCashReceivedInput').value = '500';
    await form.dispatch('submit');
    const cashInput = h.getEl('quickCollectCashReceivedInput');
    const err = cashInput.insertedAfter.element;
    assert.equal(err.hidden, false, 'precondition: error visible');

    // The figure is corrected programmatically with no input event
    // (a chip tap or a re-render) — the typed clear never runs.
    cashInput.value = '1000';
    assert.equal(err.hidden, false, 'still showing before the next submit — no input event fired');
    await form.dispatch('submit');
    assert.equal(err.hidden, true, 'the valid submit clears the stale error');
    assert.equal(cashInput.getAttribute('aria-invalid'), null, 'invalid flag removed');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
  } finally {
    h.restore();
  }
});

test('sharafat 7 wiring: the submit guard reads the shortfall through the calculator, cash-gated, before the confirm and the record', () => {
  // The guard imports the calculator's own helpers — no new
  // arithmetic is invented in the submit handler.
  assert.ok(wiringSrc.includes("import { cashChangeLineText, cashChangeShortfallCents, formatCashChangeAmount } from './cash-change-calculator.js';"), 'shortfall helper and figure formatter imported beside the line-text helper');
  // The guard reads the two field values exactly as the live hint
  // reads them, and only for a cash method.
  assert.ok(wiringSrc.includes('cashChangeShortfallCents(cashReceivedInput?.value, amountInput?.value)'), 'shortfall read from the cash-received and amount fields');
  assert.ok(wiringSrc.includes('isCashPaymentMethod(methodVal)'), 'guard gated on a cash method');
  // The refusal uses the shared Plan 547 helper under the
  // cash-received field, with the toast only as the fallback.
  assert.ok(wiringSrc.includes("showQuickCollectFieldError(cashReceivedInput, 'quickCollectCashReceivedError'"), 'shortfall refusal uses the shared field-error helper');
  assert.ok(wiringSrc.includes("clearQuickCollectFieldError(cashReceivedInput, 'quickCollectCashReceivedError');"), 'a valid submit clears a stale cash-received error');
  // The guard runs before the confirm summary and the recording.
  const submitIdx = wiringSrc.indexOf("paymentForm?.addEventListener('submit'");
  const submitBlock = wiringSrc.slice(submitIdx);
  assert.ok(submitBlock.indexOf("'quickCollectCashReceivedError'") < submitBlock.indexOf('buildSaveConfirmationSummary()'), 'cash check runs before the confirm summary');
  assert.ok(submitBlock.indexOf("'quickCollectCashReceivedError'") < submitBlock.indexOf('executeQuickCollection(state, {'), 'cash check runs before the recording');
  // The guard sits with the other cash-method submit guard: after
  // the large-cash approval check, before the split validations.
  assert.ok(submitBlock.indexOf("'quickCollectCashReceivedError'") > submitBlock.indexOf("requiresLargeCashApproval(isCashPaymentMethod(methodVal)"), 'cash check runs after the large-cash check');
  assert.ok(submitBlock.indexOf("'quickCollectCashReceivedError'") < submitBlock.indexOf('// Plan 536: the split validations run here'), 'cash check runs before the split validations');
  // The message names the shortfall figure in the app's min-0
  // decimals, and the refusal is a refusal — no confirm step is
  // offered for a shortfall.
  assert.ok(wiringSrc.includes('Cash received is ${formatCashChangeAmount(cashShortfallCents)} less than the amount'), 'message names the shortfall figure');
  const guardIdx = wiringSrc.indexOf("const cashShortfallCents = isCashPaymentMethod(methodVal)");
  const guardBlock = wiringSrc.slice(guardIdx, guardIdx + 1600);
  assert.ok(!guardBlock.includes('appConfirm'), 'no click-through confirm for a shortfall — the refusal stands');
  // The calculator module itself needed no change: it already
  // exported the shortfall helper and the figure formatter, and the
  // submit handler reads them, not a new local computation.
  const calcSrc = readFileSync(new URL('../cash-change-calculator.js', import.meta.url), 'utf8');
  assert.ok(calcSrc.includes('export function cashChangeShortfallCents(cashReceived, paymentAmount)'), 'shortfall helper lives in the calculator');
  assert.ok(calcSrc.includes('export function formatCashChangeAmount(cents)'), 'figure formatter lives in the calculator');
  assert.ok(!calcSrc.includes('quickCollect'), 'the calculator stays submit-agnostic');
});
