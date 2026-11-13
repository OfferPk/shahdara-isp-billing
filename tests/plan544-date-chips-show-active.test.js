/**
 * plan544-date-chips-show-active.test.js — Plan 544 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the payment-date chips (Today / Yesterday /
 * Prev Month End / Custom) set the date input on tap but never mark
 * which chip matches the current date — no `is-active` class is ever
 * toggled, unlike the method chips (syncMethodChips) and the filter
 * chips (setFilter). After tapping "Yesterday" and then editing the
 * date by hand, nothing shows which shortcut (if any) the date
 * corresponds to.
 *
 * Pins:
 *  - acceptance: tap "Yesterday" — the chip lights and the date is
 *    yesterday; edit the date to today by hand — "Today" lights;
 *    pick any other date — only "Custom" lights; a fresh open
 *    pre-fills today, so "Today" is lit from the start;
 *  - the lit chip follows the date however it was set: a chip tap, a
 *    hand edit, a Back-to-pick draft restore (Plan 539) — never a
 *    stale chip beside a date it does not describe;
 *  - wiring: syncDateChips is called from the chip tap, from the
 *    date input's input/change listeners, and from every reopen that
 *    pre-fills a date (concession restore, draft restore, form open,
 *    one-screen submit); the date chips share the method chips'
 *    active styling — no new CSS rule, no new hex;
 *  - no date computation changes: the chip kind comes from the same
 *    targets the taps use (paymentDateChipForDate), so a lit chip
 *    always agrees with what tapping it would set.
 *
 * Harness: the Plan 539 / Plan 543 controller harness (mock DOM +
 * mock localStorage), with a real classList (the earlier harness
 * stubs toggle as a no-op), a synchronous dispatchEvent (the chip
 * tap handler dispatches input/change on the date input), and the
 * four date chips returned by the modal's querySelectorAll for
 * '[data-qc-date-chip]'. Synthetic data only — no real customer
 * names, no realistic phone numbers (pattern-fake digits only).
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
import { paymentDateChipTargets, paymentDateChipForDate } from '../backdated-payment-helper.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const now = new Date();
const today = getPakistanLocalDate(now);
const targets = paymentDateChipTargets(today);
const month = today.slice(0, 7);

/** The day before prev-month-end: a custom date on every calendar day. */
function customDateFor(todayStr) {
  const prevEnd = paymentDateChipTargets(todayStr).prevMonthEnd;
  const d = new Date(`${prevEnd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Two synthetic customers on the PKR 1,000 package, billed this month. */
function plan544State() {
  let state = createInitialState(['Plan544 Tester One', 'Plan544 Tester Two']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
    phone: '03000001234', mohalla: 'BANII',
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000,
    phone: '03000005678', mohalla: 'BANII',
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-001');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-002', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-002');
  return state;
}

/** Plan 544 controller harness: the Plan 543 mock DOM, date-chip aware. */
function plan544Controller(initialState) {
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
      // The real DOM fires listeners synchronously; the chip tap
      // handler dispatches input/change on the date input and relies
      // on that (Plan 544's listeners must run before the tap returns).
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
  const SETUP_IDS = ['bwbOtherMethodBtn', 'closeQuickCollectModalBtn', 'customersView', 'dtpDailyTargetProgress', 'edsEndOfDaySummary', 'edsEndOfDaySummaryButton', 'kpdAmountKeypad', 'lfdLastFourList', 'mhfMohallaFilter', 'mhfMohallaFilterSummary', 'ncaNewCustomerButton', 'ncaQuickAddForm', 'nplNamePrefixList', 'osbOfflineSavedBadge', 'pcfPendingClearanceFlag', 'pcfSuccessPendingClearanceFlag', 'quickCollectAdvanceCheckbox', 'quickCollectAdvanceTargetMonth', 'quickCollectAllCount', 'quickCollectAmountInput', 'quickCollectAmountWordsLine', 'quickCollectBackToPickBtn', 'quickCollectBluetoothPrintBtn', 'quickCollectCashChangeBox', 'quickCollectCashChangeLine', 'quickCollectCashReceivedInput', 'quickCollectCategoryTagSelect', 'quickCollectCollectedByInput', 'quickCollectCollectionMohallaInput', 'quickCollectCollectionPlaceSelect', 'quickCollectConcessionBox', 'quickCollectConfirmBackBtn', 'quickCollectConfirmBtn', 'quickCollectConfirmSaveBtn', 'quickCollectConfirmSummary', 'quickCollectContributorField', 'quickCollectContributorSelect', 'quickCollectCrossPayerNameInput', 'quickCollectCrossPayerSelect', 'quickCollectCrossRelationshipInput', 'quickCollectCustomerHeader', 'quickCollectCustomerList', 'quickCollectDateInput', 'quickCollectDigitalFields', 'quickCollectDoneCloseBtn', 'quickCollectDueAmountVal', 'quickCollectDuesCount', 'quickCollectDuplicateCancelBtn', 'quickCollectDuplicateMsg', 'quickCollectDuplicateProceedBtn', 'quickCollectDuplicateReasonInput', 'quickCollectDuplicateWarning', 'quickCollectExcessCashPurposeSelect', 'quickCollectGoToTransactionsBtn', 'quickCollectHandlingNoteBox', 'quickCollectHighDuesCount', 'quickCollectLargeCashApprover', 'quickCollectLargeCashThreshold', 'quickCollectLateFeeWaiverBox', 'quickCollectLooseChangeChips', 'quickCollectMethodSelect', 'quickCollectModal', 'quickCollectMonthSelect', 'quickCollectOpenOneScreenBtn', 'quickCollectOverpaymentChoice', 'quickCollectOverpaymentExtra', 'quickCollectOverrideDetails', 'quickCollectOverrideReasonInput', 'quickCollectOwnerPaymentInfo', 'quickCollectPackageBox', 'quickCollectPaidByInput', 'quickCollectPaymentForm', 'quickCollectPrefillLine', 'quickCollectPrintReceiptBtn', 'quickCollectPromiseLinkSelect', 'quickCollectReceiptCard', 'quickCollectRemainderWaadaRow', 'quickCollectRemoveScreenshotBtn', 'quickCollectReversalUndoBtn', 'quickCollectScreenshotInput', 'quickCollectScreenshotPreview', 'quickCollectScreenshotPreviewWrap', 'quickCollectSearchClearBtn', 'quickCollectSearchInput', 'quickCollectSenderDigitsInput', 'quickCollectSenderNameInput', 'quickCollectSettlementPreview', 'quickCollectShareImageBtn', 'quickCollectShopChips', 'quickCollectShopLabel', 'quickCollectShopRow', 'quickCollectSplitAmountInput', 'quickCollectSplitDigitalFields', 'quickCollectSplitFields', 'quickCollectSplitMethodSelect', 'quickCollectSplitOverrideReasonInput', 'quickCollectSplitSenderDigitsInput', 'quickCollectSplitSenderNameInput', 'quickCollectSplitToggle', 'quickCollectSplitTransactionIdInput', 'quickCollectStandingInstructionLine', 'quickCollectStepConfirm', 'quickCollectStepForm', 'quickCollectStepOneScreen', 'quickCollectStepPick', 'quickCollectStepSuccess', 'quickCollectSuccessHeading', 'quickCollectSuccessMessage', 'quickCollectSuspendedWarning', 'quickCollectTransactionIdInput', 'quickCollectUnderpaymentWarning', 'quickCollectUndoBtn', 'quickCollectUptimeLine', 'quickCollectUrduNoteInput', 'quickCollectWhatsAppBtn', 'rpvReceiptPreview', 'rqpRecentQuickPick', 'rsdReceiptShareDraft', 'rttRoundTotals', 'sccSecondConnectionAmount', 'sccSecondConnectionRecord', 'sccSecondConnectionStep', 'sccSecondConnectionTotal', 'sowStillOwesLine', 'transactionsView'];
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

  // The four date chips live under the search box in the real sheet
  // (index.html ~27006): the modal answers them for the
  // '[data-qc-date-chip]' selector and nothing else, exactly like the
  // real DOM — every other selector still returns no matches.
  const dateChips = ['today', 'yesterday', 'prev-month-end', 'custom'].map(kind => {
    const chip = createMockElement('', 'button');
    chip.setAttribute('data-qc-date-chip', kind);
    return chip;
  });
  getEl('quickCollectModal').querySelectorAll = (selector) =>
    selector === '[data-qc-date-chip]' ? dateChips : [];

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
    getEl, toasts, controller, dateChips,
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Which chip (if any) is lit right now — at most one. */
function litChip(h) {
  const lit = h.dateChips.filter(chip => chip.classList.contains('is-active'));
  assert.equal(lit.length <= 1, true, 'at most one date chip is lit');
  return lit.length === 1 ? lit[0].getAttribute('data-qc-date-chip') : null;
}

function dateInput(h) { return h.getEl('quickCollectDateInput'); }

async function tapChip(h, kind) {
  const chip = h.dateChips.find(c => c.getAttribute('data-qc-date-chip') === kind);
  assert.ok(chip, `chip ${kind} exists`);
  await chip.click();
  return chip;
}

test('plan 544 (REPRO): tapping "Yesterday" lights Yesterday and sets yesterday', async () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    assert.equal(litChip(h), 'today', 'precondition: the fresh open lights Today');
    await tapChip(h, 'yesterday');
    assert.equal(dateInput(h).value, targets.yesterday, 'date is yesterday');
    assert.equal(litChip(h), 'yesterday', 'Yesterday lights, Today goes out');
  } finally {
    h.restore();
  }
});

test('plan 544 (REPRO): tapping "Today" lights Today; tapping "Prev Month End" lights its chip', async () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    await tapChip(h, 'yesterday');
    assert.equal(litChip(h), 'yesterday', 'precondition: Yesterday lit');
    await tapChip(h, 'today');
    assert.equal(dateInput(h).value, targets.today, 'date is today');
    assert.equal(litChip(h), 'today', 'Today lights again');
    await tapChip(h, 'prev-month-end');
    assert.equal(dateInput(h).value, targets.prevMonthEnd, 'date is prev-month-end');
    // On the 1st of a month yesterday and prev-month-end are the same
    // day, and the reverse map names it 'yesterday' (pinned in the
    // pure tests) — so the lit chip is whatever the shared mapping
    // says for the value, never a stale chip.
    assert.equal(litChip(h), paymentDateChipForDate(targets.prevMonthEnd, today), 'prev-month-end tap lights the chip the value maps to');
  } finally {
    h.restore();
  }
});

test('plan 544 (REPRO): a hand edit of the date re-lights the chips — today, then a custom date', async () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    await tapChip(h, 'yesterday');
    assert.equal(litChip(h), 'yesterday', 'precondition: Yesterday lit');
    // Hand-edit to today (the date input fires input on typing).
    dateInput(h).value = targets.today;
    dateInput(h).dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(litChip(h), 'today', 'hand-editing to today lights Today');
    // Hand-edit to a date no shortcut covers (the picker fires change).
    const custom = customDateFor(today);
    assert.equal(paymentDateChipForDate(custom, today), 'custom', 'precondition: the picked date is a custom one');
    dateInput(h).value = custom;
    dateInput(h).dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(litChip(h), 'custom', 'only Custom lights for an arbitrary date');
    // And back to yesterday by hand.
    dateInput(h).value = targets.yesterday;
    dateInput(h).dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(litChip(h), 'yesterday', 'hand-editing to yesterday lights Yesterday');
  } finally {
    h.restore();
  }
});

test('plan 544 (REPRO): a fresh open pre-fills today and lights Today', () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    assert.equal(dateInput(h).value, today, 'date prefilled to today');
    assert.equal(litChip(h), 'today', 'Today is lit on the fresh open');
  } finally {
    h.restore();
  }
});

test('plan 544 (REPRO): a Back-to-pick draft restore re-lights the chip for the restored date', async () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    await tapChip(h, 'yesterday');
    assert.equal(dateInput(h).value, targets.yesterday, 'precondition: Yesterday picked');
    assert.equal(litChip(h), 'yesterday', 'precondition: Yesterday lit');
    await h.getEl('quickCollectBackToPickBtn').click();
    h.controller.selectAndOpen('seed-001');
    assert.equal(dateInput(h).value, targets.yesterday, 'draft restored the yesterday date');
    assert.equal(litChip(h), 'yesterday', 'the restored date re-lights Yesterday');
  } finally {
    h.restore();
  }
});

test('plan 544 (REPRO): tapping "Custom" focuses the date input without changing it; picking a date then lights Custom', async () => {
  const h = plan544Controller(plan544State());
  try {
    h.controller.open('seed-001');
    assert.equal(dateInput(h).value, today, 'precondition: date is today');
    assert.equal(litChip(h), 'today', 'precondition: Today lit');
    await tapChip(h, 'custom');
    assert.equal(dateInput(h).value, today, 'Custom never invents a date');
    assert.equal(dateInput(h).focused, true, 'Custom hands focus to the date input');
    assert.equal(litChip(h), 'today', 'the chip stays on Today until a date is picked');
    const custom = customDateFor(today);
    dateInput(h).value = custom;
    dateInput(h).dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(litChip(h), 'custom', 'the picked date lights Custom');
  } finally {
    h.restore();
  }
});

test('plan 544 wiring: sync runs from the tap, the input listeners, and every date pre-fill', () => {
  assert.ok(wiringSrc.includes("import { computePaymentDateChip, isFuturePaymentDate, paymentDateChipForDate } from './backdated-payment-helper.js';"), 'reverse mapping imported from the same module as the taps');
  assert.ok(wiringSrc.includes('function syncDateChips()'), 'sync helper exists');
  assert.ok(wiringSrc.includes("chip.classList.toggle('is-active', chip.getAttribute('data-qc-date-chip') === active);"), 'sync toggles is-active by the chip kind');
  assert.ok(wiringSrc.includes("dateInput?.addEventListener('input', syncDateChips);"), 'hand edits re-light via input');
  assert.ok(wiringSrc.includes("dateInput?.addEventListener('change', syncDateChips);"), 'picker picks re-light via change');
  // Every programmatic date set is followed by a sync, so a reopen
  // can never leave a stale chip beside its date.
  const concessionIdx = wiringSrc.indexOf('function restoreConcessionFormEntries(entries)');
  const concessionBlock = wiringSrc.slice(concessionIdx, concessionIdx + 2500);
  assert.ok(concessionBlock.includes('syncDateChips();'), 'concession restore re-lights');
  const draftIdx = wiringSrc.indexOf('function restoreBackToPickDraft(customerId, options = {})');
  const draftBlock = wiringSrc.slice(draftIdx, draftIdx + 1500);
  assert.ok(draftBlock.includes('syncDateChips();'), 'draft restore re-lights');
  const openIdx = wiringSrc.indexOf('function openCustomerCollectionForm(customerId, options = {})');
  const openBlock = wiringSrc.slice(openIdx, wiringSrc.indexOf("showStep('form')", openIdx));
  assert.ok(openBlock.includes('syncDateChips();'), 'form open re-lights after the prefill');
  const oneScreenIdx = wiringSrc.indexOf('function submitOneScreenPayment()');
  const oneScreenBlock = wiringSrc.slice(oneScreenIdx, oneScreenIdx + 2500);
  assert.ok(oneScreenBlock.includes('syncDateChips();'), 'one-screen submit re-lights the hidden form');
  // No focus moves anywhere in the sync path (Plan 540 untouched).
  const syncIdx = wiringSrc.indexOf('function syncDateChips()');
  const syncBlock = wiringSrc.slice(syncIdx, syncIdx + 600);
  assert.ok(!syncBlock.includes('.focus('), 'sync never moves focus');
  // The date chips share the method chips' active rule: one selector
  // list, no new rule, no new hex anywhere in the change.
  assert.ok(cssSrc.includes('.quick-method-chip.is-active, .qc-date-chip.is-active {'), 'date chips reuse the method-chip active rule');
  assert.ok(cssSrc.includes('[data-theme="dark"] .quick-method-chip.is-active, [data-theme="dark"] .qc-date-chip.is-active {'), 'dark theme shares the rule too');
  assert.ok(!wiringSrc.includes('paymentDateChipForDate(') || wiringSrc.includes("paymentDateChipForDate(dateInput.value, getPakistanLocalDate())"), 'the sync reads the same targets the taps use');
});
