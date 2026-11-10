/**
 * plan543-one-screen-fails-safely.test.js — Plan 543 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The one-screen flow's two silent failures:
 *  - the customer options skip only entries with no id/name, so an
 *    archived customer can be picked; the change handler then throws
 *    inside getCustomerPaymentDefaults ("Archived customers cannot
 *    receive payments") with no try/catch, and the dues line, amount
 *    and remembered method keep showing the PREVIOUS customer's
 *    figures while the select names the archived one;
 *  - a digital payment with no Transaction ID fails the main submit's
 *    TID guard on the hidden form step: its inline error sits under
 *    an invisible field and (per the Plan 296 rule) no toast explains
 *    it, so the operator on the one screen sees nothing happen.
 *
 * Pins:
 *  - acceptance: an archived customer is absent from the one-screen
 *    dropdown (pure options + the rendered select); a fixture forcing
 *    a defaults failure leaves the dues line hidden and the amount
 *    empty, never the previous customer's figures, while the select
 *    still names the picked customer; one-screen, Easypaisa, no TID,
 *    Save: the form step appears with the inline TID error visible
 *    and the TID field focused, draft amount/method preserved; a cash
 *    one-screen save flows as before (no step switch, payment
 *    recorded);
 *  - the same throw on the save path fails safely too: an archived
 *    pick followed by a typed amount and Save toasts the archived
 *    message and records nothing, instead of throwing out of the
 *    click handler;
 *  - wiring: the archived skip lives in the options builder (the
 *    same `customer.archived` rule as the picker), the change handler
 *    guards the defaults lookup, and the submit switches to the form
 *    step before requestSubmit when a digital payment has neither a
 *    TID nor an override reason.
 *
 * Harness: the Plan 539 controller harness (mock DOM + mock
 * localStorage), extended so the one-screen step's innerHTML rebuilds
 * real one-screen control mocks (select options included) and the
 * form step's hidden flips are logged. Synthetic data only — no real
 * customer names, no realistic phone numbers (pattern-fake digits
 * only).
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
import { quickCollectOneScreenCustomerOptions } from '../quick-collect-one-screen.js';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);

/** Three synthetic customers on the PKR 1,000 package, billed this month; seed-003 is archived. */
function plan543State(now, month) {
  let state = createInitialState(['Plan543 Tester One', 'Plan543 Tester Two', 'Plan543 Tester Archived']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = updateCustomerProfile(state, 'seed-003', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month, 'seed-001').dueAmount), 1000, 'precondition: seed-001 billed 1,000');
  assert.equal(Number(billOf(state, month, 'seed-003').dueAmount), 1000, 'precondition: seed-003 billed 1,000');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-001');
  state.customers.find(c => c.id === 'seed-003').archived = true;
  return state;
}

/** Plan 543 controller harness: the Plan 539 mock DOM, one-screen aware. */
function plan543Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      hasAttribute: () => false,
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      closest: () => null,
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      insertAdjacentElement: (position, other) => { el.insertedAfter = { position, element: other }; return other; },
      before: () => {},
      after: () => {},
      scrollIntoView: () => {},
      focus: () => { el.focused = true; },
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      focused: false,
      insertedAfter: null,
      opened: false,
      open: false
    };
    // The real DOM registers an element by id when the id is set, so
    // a dynamically created element (the TID inline error) is found
    // by a later getElementById — and an id never set is never found.
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

  // The real DOM's getElementById returns null for an id that does
  // not exist — it never conjures an element. The mock must do the
  // same, or the TID guard's "create the inline error" branch could
  // never be driven. So every id the setup reads is pre-created here
  // (the full getElementById list from nav-quick-collect.js), EXCEPT
  // quickCollectTxnError: that one is created dynamically by the TID
  // guard itself, and must be absent until then.
  // QC receipt-modal overhaul: qcSettleStatusBadge, quickCollectAnotherBtn,
  // rptRepeatPayment and snsSuccessNextSteps were removed from the success
  // step — the mock must not conjure elements the real DOM no longer has.
  const SETUP_IDS = ['bncBigNameConfirm', 'bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDailyEntrySummary', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectNextReceiptLine', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'sowStillOwesLine', 'transactionsView'];
  for (const setupId of SETUP_IDS) getEl(setupId);

  // The real DOM resets a select's value when its options are rebuilt
  // via innerHTML (the `selected` option wins). The mock must do the
  // same, or a fresh open would keep the previous opening's month.
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

  // The one-screen step rebuilds its controls from the HTML the
  // renderer writes: every id in the markup becomes a child mock,
  // selects get their option values, and querySelector finds them by
  // id — the same rebuild the polish #13 harness does for the
  // concession box. The form step's hidden flips are logged so a
  // test can prove the step was never shown (cash) as well as shown
  // (missing TID).
  const stepOneScreen = getEl('quickCollectStepOneScreen');
  let oneScreenHtml = '';
  Object.defineProperty(stepOneScreen, 'innerHTML', {
    get: () => oneScreenHtml,
    set: (v) => {
      oneScreenHtml = String(v ?? '');
      stepOneScreen.children = [];
      const tagRe = /<(\w+)[^>]*\sid="([^"]+)"[^>]*>/g;
      let match;
      while ((match = tagRe.exec(oneScreenHtml)) !== null) {
        const [, tag, childId] = match;
        const child = createMockElement(childId, tag);
        if (/ hidden[\s>]/.test(match[0])) child.hidden = true;
        if (tag === 'select') {
          const selectRe = new RegExp(`<select[^>]*\\sid="${childId}"[^>]*>([\\s\\S]*?)</select>`);
          const selectMatch = oneScreenHtml.match(selectRe);
          const optionsHtml = selectMatch ? selectMatch[1] : '';
          const optionValues = [...optionsHtml.matchAll(/<option[^>]*\svalue="([^"]*)"/g)].map(m => m[1]);
          child.options = optionValues.map(value => ({ value }));
          const selected = optionsHtml.match(/<option[^>]*\svalue="([^"]*)"[^>]*\sselected/);
          child.value = selected ? selected[1] : (optionValues[0] ?? '');
        }
        if (tag === 'input') {
          const valueMatch = match[0].match(/\svalue="([^"]*)"/);
          if (valueMatch) child.value = valueMatch[1];
        }
        stepOneScreen.children.push(child);
      }
    }
  });
  stepOneScreen.querySelector = (selector) => {
    if (typeof selector === 'string' && selector.startsWith('#')) {
      return stepOneScreen.children.find(c => c.id === selector.slice(1)) ?? null;
    }
    return null;
  };
  const stepForm = getEl('quickCollectStepForm');
  const formHiddenLog = [];
  let formHidden = false;
  Object.defineProperty(stepForm, 'hidden', {
    get: () => formHidden,
    set: (v) => { formHidden = Boolean(v); formHiddenLog.push(formHidden); }
  });

  return {
    getEl, toasts, controller, formHiddenLog,
    get stepOneScreen() { return stepOneScreen; },
    get stepForm() { return stepForm; },
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Open the one-screen and wait out its 50 ms focus timer. */
async function openOneScreen(h) {
  h.controller.openOneScreen();
  await new Promise(r => setTimeout(r, 60));
}

/** Pick a customer on the one-screen (drives the real change handler). */
async function pickOneScreenCustomer(h, customerId) {
  const select = h.stepOneScreen.querySelector('#qosOneScreenCustomer');
  select.value = customerId;
  await select.dispatch('change');
  return select;
}

function assertNoErrorToast(h) {
  assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast');
}

test('plan 543 (REPRO): archived customers are absent from the one-screen customer options', () => {
  const options = quickCollectOneScreenCustomerOptions([
    { id: 'CUST-1', name: 'Customer One', customerNumber: 1 },
    { id: 'CUST-2', name: 'Customer Archived', customerNumber: 2, archived: true },
    { id: 'CUST-3', name: 'Customer Three', customerNumber: 3 },
  ]);
  assert.deepEqual(options.map((option) => option.value), ['CUST-1', 'CUST-3']);
});

test('plan 543 (REPRO): the rendered one-screen dropdown never offers the archived customer', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan543Controller(plan543State(now, month));
  try {
    await openOneScreen(h);
    const select = h.stepOneScreen.querySelector('#qosOneScreenCustomer');
    assert.ok(select, 'customer select exists');
    assert.deepEqual(select.options.map((option) => option.value), ['', 'seed-001', 'seed-002']);
  } finally {
    h.restore();
  }
});

test('plan 543 (REPRO): a failed defaults lookup clears the dues line and amount, never the previous customer’s figures', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan543Controller(plan543State(now, month));
  try {
    await openOneScreen(h);
    // Pick a live customer first: the figures fill in.
    await pickOneScreenCustomer(h, 'seed-001');
    const amountInputOne = h.stepOneScreen.querySelector('#qosOneScreenAmount');
    const duesLine = h.stepOneScreen.querySelector('#qosOneScreenDues');
    const methodSelectOne = h.stepOneScreen.querySelector('#qosOneScreenMethod');
    assert.equal(amountInputOne.value, '1000.00', 'precondition: amount prefilled at the full dues');
    assert.equal(duesLine.hidden, false, 'precondition: dues line shown');
    // The line is shown and non-empty. Its exact figure is NOT pinned
    // here: the call site passes rupees to a cents function, so the
    // live line reads 1/100th of the payable figure (PKR 10 for PKR
    // 1,000 dues) while the amount field reads the right figure — a
    // pre-existing Plan 525 wiring bug found while implementing this
    // plan, reported to the parent as a future plan's job. Pinning the
    // wrong figure would bless the bug; pinning the right figure would
    // fail until that fix lands.
    assert.notEqual(duesLine.textContent, '', 'precondition: dues line has text');

    // Now force the failure: an archived customer id in the select
    // (the dropdown itself never offers one — the fixture drives the
    // handler directly, the way a stale or archived pick would).
    const select = await pickOneScreenCustomer(h, 'seed-003');
    assert.equal(amountInputOne.value, '', 'amount empty — never the previous customer’s 1,000');
    assert.equal(duesLine.textContent, '', 'dues line text cleared');
    assert.equal(duesLine.hidden, true, 'dues line hidden');
    assert.equal(methodSelectOne.value, '', 'remembered method cleared — never the previous customer’s method');
    assert.equal(select.value, 'seed-003', 'the select itself still names the picked customer');
    assertNoErrorToast(h);
  } finally {
    h.restore();
  }
});

test('plan 543 (REPRO): one-screen Easypaisa with no TID switches to the form step with the inline TID error visible and focused', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan543Controller(plan543State(now, month));
  try {
    await openOneScreen(h);
    await pickOneScreenCustomer(h, 'seed-001');
    const methodSelectOne = h.stepOneScreen.querySelector('#qosOneScreenMethod');
    methodSelectOne.value = 'Easypaisa';
    const form = h.getEl('quickCollectPaymentForm');
    form.requestSubmit = () => form.dispatch('submit');
    const saveBtn = h.stepOneScreen.querySelector('#qosOneScreenSaveBtn');
    await saveBtn.click();

    // The form step is showing — the switch happened before the
    // submit handler ran, so before its confirm-summary check.
    assert.equal(h.stepForm.hidden, false, 'form step visible');
    assert.equal(h.stepOneScreen.hidden, true, 'one-screen hidden');
    assert.ok(h.formHiddenLog.includes(false), 'the form step was switched to, not merely left visible');
    // The TID guard's inline error is visible under the TID field.
    const tidInput = h.getEl('quickCollectTransactionIdInput');
    assert.ok(tidInput.insertedAfter, 'inline error inserted after the TID field');
    assert.equal(tidInput.insertedAfter.element.textContent, 'Please enter a Transaction ID or an override reason for digital payments.', 'inline error names the missing input');
    assert.equal(tidInput.insertedAfter.element.hidden, false, 'inline error visible');
    assert.equal(tidInput.getAttribute('aria-invalid'), 'true', 'field marked invalid');
    assert.equal(tidInput.focused, true, 'TID field focused');
    // The draft survived the switch onto the main form.
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'amount preserved');
    assert.equal(h.getEl('quickCollectMethodSelect').value, 'Easypaisa', 'method preserved');
    assert.equal(h.getEl('quickCollectMonthSelect').value, month, 'month preserved');
    assertNoErrorToast(h);
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'nothing recorded — the payment waits for the TID');
  } finally {
    h.restore();
  }
});

test('plan 543: a cash one-screen save flows as before — no step switch, payment recorded', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan543Controller(plan543State(now, month));
  try {
    await openOneScreen(h);
    await pickOneScreenCustomer(h, 'seed-001');
    const methodSelectOne = h.stepOneScreen.querySelector('#qosOneScreenMethod');
    methodSelectOne.value = 'Cash';
    const form = h.getEl('quickCollectPaymentForm');
    form.requestSubmit = () => form.dispatch('submit');
    await h.stepOneScreen.querySelector('#qosOneScreenSaveBtn').click();

    // The submit shows the confirm step straight from the one
    // screen — the form step was never shown in between.
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.ok(!h.formHiddenLog.includes(false), 'the form step was never switched to for cash');
    // Confirm and save: the payment records exactly as before.
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assertNoErrorToast(h);
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('plan 543: an archived pick followed by a typed amount and Save toasts the archived message and records nothing', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan543Controller(plan543State(now, month));
  try {
    await openOneScreen(h);
    // The change handler cleared the figures; the select still names
    // the archived customer. Typing an amount and saving must fail
    // safely — the archived guard's own message, no throw, no record.
    await pickOneScreenCustomer(h, 'seed-003');
    h.stepOneScreen.querySelector('#qosOneScreenAmount').value = '500.00';
    h.stepOneScreen.querySelector('#qosOneScreenMethod').value = 'Cash';
    const form = h.getEl('quickCollectPaymentForm');
    form.requestSubmit = () => form.dispatch('submit');
    await h.stepOneScreen.querySelector('#qosOneScreenSaveBtn').click();

    assert.ok(h.toasts.some(t => typeof t.msg === 'string' && /Archived customers cannot receive payments/.test(t.msg)), 'archived message toasted');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-003', month)?.balanceDueCents, 100000, 'nothing recorded for the archived customer');
    assert.equal(h.stepOneScreen.hidden, false, 'still on the one screen');
  } finally {
    h.restore();
  }
});

test('plan 543 wiring: archived skip in the options builder, guarded change handler, form-step switch before the submit', () => {
  const oneScreen = readFileSync(new URL('../quick-collect-one-screen.js', import.meta.url), 'utf8');
  assert.ok(oneScreen.includes('if (customer.archived) continue;'), 'options builder skips archived customers');
  const optionsIdx = oneScreen.indexOf('export function quickCollectOneScreenCustomerOptions');
  const optionsBlock = oneScreen.slice(optionsIdx, optionsIdx + 1200);
  assert.ok(optionsBlock.includes('if (customer.archived) continue;'), 'the skip is in the options builder, not elsewhere');

  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  // The picker keeps its own identical rule, untouched.
  const pickerIdx = qc.indexOf('export function getPendingCollectionCustomers');
  const pickerBlock = qc.slice(pickerIdx, pickerIdx + 800);
  assert.ok(pickerBlock.includes('if (customer.archived) continue;'), 'picker rule unchanged');
  // The change handler guards the defaults lookup.
  const bindIdx = qc.indexOf('function bindOneScreenControls()');
  const bindBlock = qc.slice(bindIdx, qc.indexOf('function submitOneScreenPayment()', bindIdx));
  assert.ok(bindBlock.includes('try {'), 'change handler has a try');
  assert.ok(bindBlock.includes('getCustomerPaymentDefaults(getState(), customerId, new Date(), loadTickets())'), 'change handler still reads the defaults');
  assert.ok(bindBlock.includes('} catch {'), 'change handler catches a failed lookup');
  assert.ok(bindBlock.includes("duesLine.hidden = true;"), 'failed lookup hides the dues line');
  // The submit switches to the form step when the TID guard would
  // fire, before requestSubmit — and the switch is to the form step,
  // never the success step (polish #21's tick re-trigger is untouched).
  const submitIdx = qc.indexOf('function submitOneScreenPayment()');
  const submitBlock = qc.slice(submitIdx, qc.indexOf('function openOneScreen()', submitIdx));
  assert.ok(submitBlock.includes("showStep('form')"), 'submit switches to the form step');
  assert.ok(!submitBlock.includes("showStep('success')"), 'submit never jumps to the success step');
  assert.ok(submitBlock.indexOf("showStep('form')") < submitBlock.indexOf('paymentForm.requestSubmit()'), 'the switch happens before the submit runs');
  assert.ok(submitBlock.includes('isDigitalPaymentMethod(draft.method)'), 'the switch is gated on a digital method');
  assert.ok(submitBlock.includes("transactionIdInput?.value || ''"), 'the switch reads the live TID field');
  assert.ok(submitBlock.includes("overrideReasonInput?.value || ''"), 'the switch reads the live override reason');
  // No new store key, no new hex, no new element id, PKR only.
  assert.ok(!qc.includes('shahdara_one_screen'), 'no new store key');
  assert.ok(!/\.qc-[a-z-]*#[0-9a-f]{6}/i.test(qc), 'no new hex colour');
  assert.ok(!submitBlock.includes('localStorage'), 'submit never persists');
});
