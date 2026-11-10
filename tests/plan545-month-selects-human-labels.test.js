/**
 * plan545-month-selects-human-labels.test.js — Plan 545 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the billing-month select renders each option's
 * label as the raw key ("2026-11") and the advance-target select does
 * the same — the operator must parse YYYY-MM at the counter, while
 * the confirm summary already renders the same months as human
 * labels ("November 2026").
 *
 * Pins:
 *  - acceptance: both selects list "November 2026" etc. with values
 *    still YYYY-MM; picking one still records against that month;
 *    the confirm summary and the form now agree in wording;
 *  - the label comes from the existing monthLabel helper
 *    (monthly-complaint-report.js), already imported by the
 *    controller and already used by the Plan 541 package box for the
 *    same "Month YYYY" English label — no new month formatter, and
 *    the label is English in both languages, exactly like Plan 541
 *    (the Urdu-aware displayMonthName lives in app.js and is not
 *    importable from the controller);
 *  - values stay YYYY-MM: the submit path, the month-change handler
 *    (refreshMonthDependentBoxes), the package box (Plan 541) and
 *    the Plan 544 date-chip sync are all driven by the value, never
 *    the label — behaviour there is unchanged.
 *
 * Harness: the Plan 539 / Plan 543 / Plan 544 controller harness
 * (mock DOM + mock localStorage), extended to capture the advance
 * target select's innerHTML the same way the billing month select's
 * is captured. Synthetic data only — no real customer names, no
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
import { monthLabel } from '../monthly-complaint-report.js';
import { saveConfirmationMonthLabel } from '../save-confirmation-summary.js';
import {
  defaultAdvanceTargetMonth, advanceTargetMonthOptions
} from '../advance-payment.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

const now = new Date();
const today = getPakistanLocalDate(now);
const month = today.slice(0, 7);

function previousMonthKey(m) {
  const [year, n] = m.split('-').map(Number);
  return n === 1 ? `${year - 1}-12` : `${year}-${String(n - 1).padStart(2, '0')}`;
}
const prevMonth = previousMonthKey(month);

/** Parse <option value="…" …>label</option> rows out of a select's HTML. */
function parseOptions(html) {
  const rows = [];
  const re = /<option value="([^"]+)"([^>]*)>([^<]*)<\/option>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    rows.push({ value: m[1], selected: /\bselected\b/.test(m[2]), label: m[3] });
  }
  return rows;
}

/** One synthetic customer on the PKR 1,000 package, billed from last month. */
function plan545State() {
  let state = createInitialState(['Plan545 Tester One']);
  // The price schedule entry is effective from the month the profile
  // is written in — write it in last month (Plan 521 precedent), so
  // bills generate from last month onward.
  const prevMonthDate = new Date(`${prevMonth}-05T12:00:00`);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
    phone: '03000001234', mohalla: 'BANII',
  }, prevMonthDate);
  // Bills from last month onward, so the earliest unpaid month is
  // last month and the month select has more than one open month.
  state.customers[0].billingStartMonth = prevMonth;
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', prevMonth)?.balanceDueCents, 100000, 'precondition: 1,000 still due for last month');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for this month');
  return state;
}

/** Plan 545 controller harness: the Plan 544 mock DOM, month-select aware. */
function plan545Controller(initialState) {
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
  // getElementById list from nav-quick-collect.js), EXCEPT
  // quickCollectTxnError, which the TID guard creates dynamically.
  const SETUP_IDS = ['bncBigNameConfirm', 'bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'qcSettleStatusBadge', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectAnotherBtn', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDailyEntrySummary', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectNextReceiptLine', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rptRepeatPayment', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'snsSuccessNextSteps', 'sowStillOwesLine', 'transactionsView'];
  for (const setupId of SETUP_IDS) getEl(setupId);

  // The real DOM resets a select's value when its options are rebuilt
  // via innerHTML (the `selected` option wins). Both month selects
  // get the same treatment, so a fresh open lands on its default.
  for (const selectId of ['quickCollectMonthSelect', 'quickCollectAdvanceTargetMonth']) {
    const selectEl = getEl(selectId);
    let html = '';
    Object.defineProperty(selectEl, 'innerHTML', {
      get: () => html,
      set: (v) => {
        html = String(v ?? '');
        const m = html.match(/value="([^"]+)"\s+selected/);
        if (m) selectEl.value = m[1];
      }
    });
  }

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
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

test('plan 545 (REPRO): the billing month select lists human labels, values stay YYYY-MM', () => {
  const h = plan545Controller(plan545State());
  try {
    h.controller.open('seed-001');
    const options = parseOptions(h.getEl('quickCollectMonthSelect').innerHTML);
    assert.ok(options.length > 1, 'more than one month offered');
    for (const opt of options) {
      assert.match(opt.value, /^\d{4}-\d{2}$/, `value stays YYYY-MM: ${opt.value}`);
      assert.equal(opt.label, monthLabel(opt.value), `label is the human month for ${opt.value}`);
      assert.notEqual(opt.label, opt.value, 'no raw YYYY-MM label');
    }
    // The earliest unpaid month is pre-selected, and the current
    // month is in the list with its human label.
    const selected = options.filter(o => o.selected);
    assert.equal(selected.length, 1, 'exactly one option pre-selected');
    assert.equal(selected[0].value, prevMonth, 'pre-selected month is the earliest unpaid month');
    const current = options.find(o => o.value === month);
    assert.ok(current, 'current month offered');
    assert.equal(current.label, monthLabel(month), 'current month reads as a human label');
    assert.equal(h.getEl('quickCollectMonthSelect').value, prevMonth, 'select value is the target month');
  } finally {
    h.restore();
  }
});

test('plan 545 (REPRO): the advance target select lists human labels, values stay YYYY-MM', () => {
  const h = plan545Controller(plan545State());
  try {
    h.controller.open('seed-001');
    const options = parseOptions(h.getEl('quickCollectAdvanceTargetMonth').innerHTML);
    assert.deepEqual(
      options.map(o => o.value),
      advanceTargetMonthOptions(),
      'advance options are the current month onward, values unchanged'
    );
    for (const opt of options) {
      assert.match(opt.value, /^\d{4}-\d{2}$/, `value stays YYYY-MM: ${opt.value}`);
      assert.equal(opt.label, monthLabel(opt.value), `label is the human month for ${opt.value}`);
      assert.notEqual(opt.label, opt.value, 'no raw YYYY-MM label');
    }
    const selected = options.filter(o => o.selected);
    assert.equal(selected.length, 1, 'exactly one option pre-selected');
    assert.equal(selected[0].value, defaultAdvanceTargetMonth(), 'next month pre-selected');
    assert.equal(h.getEl('quickCollectAdvanceTargetMonth').value, defaultAdvanceTargetMonth(), 'select value is the advance default');
  } finally {
    h.restore();
  }
});

test('plan 545: picking a month still records against that month, and the confirm summary agrees in wording', async () => {
  const h = plan545Controller(plan545State());
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectMonthSelect').value, prevMonth, 'precondition: form targets last month');
    // Pick the current month in the select, like the operator would.
    h.getEl('quickCollectMonthSelect').value = month;
    h.getEl('quickCollectMonthSelect').dispatchEvent(new Event('change', { bubbles: true }));
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    const form = h.getEl('quickCollectPaymentForm');
    form.requestSubmit = () => form.dispatch('submit');
    await form.dispatch('submit');

    // The confirm step shows the summary of the exact figures about
    // to post — and it names the picked month the same way the
    // select does, not as raw YYYY-MM.
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false, 'confirm step showing');
    assert.ok(
      h.getEl('quickCollectConfirmSummary').innerHTML.includes(monthLabel(month)),
      `confirm summary names the picked month as "${monthLabel(month)}"`
    );
    // Confirm and save: the payment records against the picked
    // month, and last month stays exactly as it was.
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'picked month settled in full');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', prevMonth)?.balanceDueCents, 100000, 'last month untouched');
    assert.ok(!h.toasts.some(t => typeof t.msg === 'string' && /error/i.test(t.msg)), 'no error toast');
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('plan 545: the form label and the confirm-summary label agree for every month', () => {
  // monthLabel (the selects) and saveConfirmationMonthLabel (the
  // confirm summary) must spell the same month the same way, or the
  // form and the summary would disagree in wording.
  for (let n = 1; n <= 12; n++) {
    const key = `2026-${String(n).padStart(2, '0')}`;
    assert.equal(monthLabel(key), saveConfirmationMonthLabel(key), `labels agree for ${key}`);
  }
  assert.equal(monthLabel('2026-12'), 'December 2026', 'year-end label');
  assert.equal(monthLabel('2027-01'), 'January 2027', 'year-rollover label');
});

test('plan 545 wiring: both month selects render monthLabel, nothing else renders a raw month option', () => {
  const labelled = wiringSrc.match(/\$\{monthLabel\(m\)\}<\/option>/g) || [];
  assert.equal(labelled.length, 2, 'exactly two option builders use monthLabel — billing month and advance target');
  assert.ok(!wiringSrc.includes('>${m}</option>'), 'no month option still shows the raw YYYY-MM key as its label');
  assert.ok(!wiringSrc.includes('shows raw YYYY-MM'), 'the stale raw-label comment is gone');
  // Month-name fix: the import now carries monthName alongside
  // monthLabel (same module, same line) — the pin's intent, "monthLabel
  // was already imported", is unchanged.
  assert.ok(wiringSrc.includes("import { monthLabel, monthName } from './monthly-complaint-report.js';"), 'monthLabel was already imported — no new import');
  // The value-driven readers are untouched: the submit, the
  // month-change handler and the package box all read .value.
  assert.ok(wiringSrc.includes('monthSelect?.value || activeDefaults?.targetMonth'), 'submit still reads the month value');
  assert.ok(wiringSrc.includes("monthSelect?.addEventListener('change', refreshMonthDependentBoxes)"), 'month-change handler still wired');
  assert.ok(wiringSrc.includes('monthSelect?.value || activeDefaults?.targetMonth || null'), 'package box still reads the month value');
});
