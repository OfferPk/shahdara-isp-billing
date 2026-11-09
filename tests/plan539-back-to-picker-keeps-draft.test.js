/**
 * plan539-back-to-picker-keeps-draft.test.js — Plan 539 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the Back button (backToPickBtn) does
 * showStep('pick'); renderList(); searchInput?.focus() — no draft is
 * kept. An operator who taps Back after typing an amount, picking a
 * method and entering a TID, then re-picks the same customer, gets a
 * blank fresh form. (Contrast: the confirm step's "Back to edit"
 * explicitly returns "with every entry intact".)
 *
 * Pins:
 *  - acceptance: type amount + method + date + TID + a different
 *    month, tap Back, re-pick the same customer — amount, method,
 *    date, TID and month are as typed; the digital fields show for
 *    the restored digital method, and the prefill line hides because
 *    the restored amount is the operator's own figure, not the
 *    suggested one;
 *  - picking a different customer opens fresh defaults AND drops the
 *    draft, so re-picking the first customer afterwards is fresh too;
 *  - closing the modal and reopening opens fresh defaults;
 *  - saving clears the draft, so "Collect again" after a save opens a
 *    fresh form, not the just-saved entries;
 *  - polish #13 interaction: a draft-restored typed amount survives
 *    a package-change reopen exactly like any typed amount (it
 *    differs from the old suggested amount), and a draft amount equal
 *    to the old suggested amount follows the repriced bill instead —
 *    the draft never overrides a package-change reopen;
 *  - wiring: the Back handler captures, the form open restores, the
 *    close cleanup and both success paths clear the draft, and the
 *    month picker's change handler and the draft restore refresh the
 *    same month-dependent boxes.
 *
 * Harness: the polish #13 / Plan 538 controller harness (mock DOM +
 * mock localStorage), with two synthetic customers so the
 * different-customer path can be driven. Synthetic data only — no
 * real customer names, no realistic phone numbers (pattern-fake
 * digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal, packageChangeAmountOptions
} from '../nav-quick-collect.js';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);

/** Two synthetic customers on the PKR 1,000 package, billed this month. */
function plan539State(now, month) {
  let state = createInitialState(['Plan539 Tester One', 'Plan539 Tester Two']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month, 'seed-001').dueAmount), 1000, 'precondition: seed-001 billed 1,000');
  assert.equal(Number(billOf(state, month, 'seed-002').dueAmount), 1000, 'precondition: seed-002 billed 1,000');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due for seed-001');
  return state;
}

/** Plan 539 controller harness: the polish #13 mock DOM, two customers. */
function plan539Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false
    };
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

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
    getElementById: (id) => getEl(id),
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

/** Yesterday in PKT — a date the operator could have picked, proving the restore. */
function yesterdayPk() {
  return getPakistanLocalDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/** The month before the current one — a month the operator could have picked. */
function previousMonthKey(month) {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
}

/** Type the acceptance entries into the open form. */
function typeAcceptanceEntries(h, month) {
  const yesterday = yesterdayPk();
  const prevMonth = previousMonthKey(month);
  h.getEl('quickCollectAmountInput').value = '500.00';
  h.getEl('quickCollectMethodSelect').value = 'Easypaisa';
  h.getEl('quickCollectDateInput').value = yesterday;
  h.getEl('quickCollectTransactionIdInput').value = 'TID-539-TEST-001';
  h.getEl('quickCollectMonthSelect').value = prevMonth;
  return { yesterday, prevMonth };
}

/** Assert the acceptance entries are intact on the form. */
function assertEntriesIntact(h, { yesterday, prevMonth }) {
  assert.equal(h.getEl('quickCollectAmountInput').value, '500.00', 'amount as typed');
  assert.equal(h.getEl('quickCollectMethodSelect').value, 'Easypaisa', 'method as picked');
  assert.equal(h.getEl('quickCollectDateInput').value, yesterday, 'date as picked');
  assert.equal(h.getEl('quickCollectTransactionIdInput').value, 'TID-539-TEST-001', 'TID as typed');
  assert.equal(h.getEl('quickCollectMonthSelect').value, prevMonth, 'month as picked');
}

/** Assert the form holds its fresh-open defaults for the given customer. */
function assertFreshDefaults(h, month) {
  const today = getPakistanLocalDate(new Date());
  assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'amount back at the full dues');
  assert.equal(h.getEl('quickCollectMethodSelect').value, '', 'no method remembered (no past payment)');
  assert.equal(h.getEl('quickCollectDateInput').value, today, 'date back at today');
  assert.equal(h.getEl('quickCollectTransactionIdInput').value, '', 'no TID carried over');
  assert.equal(h.getEl('quickCollectMonthSelect').value, month, 'month back at the target month');
}

test('plan 539 acceptance (REPRO): Back then re-pick the same customer restores amount, method, date, TID and month', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan539Controller(plan539State(now, month));
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'precondition: amount starts at the full dues');

    const typed = typeAcceptanceEntries(h, month);
    await h.getEl('quickCollectBackToPickBtn').click();

    // The pick step is showing again; the form still holds the typed
    // values underneath until the re-pick reopens it.
    h.controller.selectAndOpen('seed-001');

    assertEntriesIntact(h, typed);
    assert.equal(h.getEl('quickCollectDigitalFields').hidden, false, 'digital fields visible for the restored Easypaisa method');
    assert.equal(h.getEl('quickCollectPrefillLine').hidden, true, 'prefill line hides — the restored 500 is the operator’s own figure, not the suggested 1,000');
    assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast');
  } finally {
    h.restore();
  }
});

test('plan 539: picking a different customer opens fresh defaults and drops the draft', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan539Controller(plan539State(now, month));
  try {
    h.controller.open('seed-001');
    typeAcceptanceEntries(h, month);
    await h.getEl('quickCollectBackToPickBtn').click();

    h.controller.selectAndOpen('seed-002');
    assertFreshDefaults(h, month);

    // The draft belonged to seed-001 and was dropped on the
    // different pick — re-picking seed-001 is fresh too.
    h.controller.selectAndOpen('seed-001');
    assertFreshDefaults(h, month);
  } finally {
    h.restore();
  }
});

test('plan 539: closing the modal and reopening opens fresh defaults', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan539Controller(plan539State(now, month));
  try {
    h.controller.open('seed-001');
    typeAcceptanceEntries(h, month);
    await h.getEl('quickCollectBackToPickBtn').click();

    h.controller.close();
    h.controller.open('seed-001');
    assertFreshDefaults(h, month);
  } finally {
    h.restore();
  }
});

test('plan 539: saving clears the draft, so Collect again opens a fresh form', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan539Controller(plan539State(now, month));
  try {
    h.controller.open('seed-001');
    // A full payment: amount at the dues, Cash, today, with a TID.
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectDateInput').value = getPakistanLocalDate(now);
    h.getEl('quickCollectTransactionIdInput').value = 'TID-539-SAVE-001';
    await h.getEl('quickCollectBackToPickBtn').click();

    // Re-pick: the draft comes back, proving it was kept.
    h.controller.selectAndOpen('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'draft restored before the save');
    assert.equal(h.getEl('quickCollectTransactionIdInput').value, 'TID-539-SAVE-001', 'TID restored before the save');

    // Drive the real save: submit shows the confirm step, Confirm
    // arms the key and re-submits, the second submit records it.
    const form = h.getEl('quickCollectPaymentForm');
    form.requestSubmit = () => form.dispatch('submit');
    await form.dispatch('submit');
    await h.getEl('quickCollectConfirmSaveBtn').click();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 0, 'payment recorded in full');
    assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast on save');

    // "Collect again" after the save opens a fresh form: the amount
    // is empty (nothing due), the TID is gone, the date is today.
    // The method is Cash — the fresh default a Cash payment
    // remembers (Plan 431), not the draft.
    h.controller.selectAndOpen('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '', 'amount empty — nothing due, nothing carried over');
    assert.equal(h.getEl('quickCollectTransactionIdInput').value, '', 'no TID carried over');
    assert.equal(h.getEl('quickCollectMethodSelect').value, 'Cash', 'method is the remembered fresh default');
    assert.equal(h.getEl('quickCollectDateInput').value, getPakistanLocalDate(now), 'date is today');
    // Let the success screen's focus timer fire under the mock
    // document before the harness restores the real one.
    await new Promise(r => setTimeout(r, 120));
  } finally {
    h.restore();
  }
});

test('plan 539 + polish #13: a draft-restored typed amount survives a package-change reopen; an untouched one follows the repriced bill', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan539Controller(plan539State(now, month));
  try {
    // Typed 2,500 differs from the suggested 1,000: Back, re-pick
    // (the draft restores it), then the package-change reopen —
    // the operator's explicit entry always wins over a re-prefill.
    h.controller.open('seed-001');
    h.getEl('quickCollectAmountInput').value = '2500.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectDateInput').value = getPakistanLocalDate(now);
    h.getEl('quickCollectTransactionIdInput').value = 'TID-539-TYPED-001';
    await h.getEl('quickCollectBackToPickBtn').click();
    h.controller.selectAndOpen('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '2500.00', 'precondition: draft restored the typed 2,500');
    h.controller.selectAndOpen('seed-001', packageChangeAmountOptions('2500.00', 1000, 900));
    assert.equal(h.getEl('quickCollectAmountInput').value, '2500.00', 'typed 2,500 survives the package-change reopen');
    assert.equal(h.getEl('quickCollectTransactionIdInput').value, '', 'package-change reopen still resets the TID (the draft never overrides it)');

    // Typed 1,000 equals the old suggested 1,000: Back, re-pick,
    // then the package-change reopen — the field still held the old
    // prefill, so it follows the repriced bill (900).
    h.controller.open('seed-001');
    h.getEl('quickCollectAmountInput').value = '1000.00';
    h.getEl('quickCollectMethodSelect').value = 'Cash';
    h.getEl('quickCollectDateInput').value = getPakistanLocalDate(now);
    h.getEl('quickCollectTransactionIdInput').value = 'TID-539-UNTOUCHED-001';
    await h.getEl('quickCollectBackToPickBtn').click();
    h.controller.selectAndOpen('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'precondition: draft restored the 1,000');
    h.controller.selectAndOpen('seed-001', packageChangeAmountOptions('1000.00', 1000, 900));
    assert.equal(h.getEl('quickCollectAmountInput').value, '900.00', 'untouched amount follows the repriced bill');
  } finally {
    h.restore();
  }
});

test('plan 539 wiring: Back captures, the open restores, close and both success paths clear, one month refresh', () => {
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('let backToPickDraft = null;'), 'draft state exists, in memory only');
  assert.ok(qc.includes('function captureBackToPickDraft()'), 'capture helper exists');
  assert.ok(qc.includes('function restoreBackToPickDraft(customerId, options = {})'), 'restore helper exists');
  assert.ok(qc.includes('function refreshMonthDependentBoxes()'), 'month refresh is one shared function');
  const backIdx = qc.indexOf("backToPickBtn?.addEventListener('click'");
  assert.ok(backIdx > 0, 'Back button wired');
  const backBlock = qc.slice(backIdx, backIdx + 1500);
  assert.ok(backBlock.includes('captureBackToPickDraft()'), 'Back captures the draft before leaving');
  const openIdx = qc.indexOf('function openCustomerCollectionForm(customerId, options = {})');
  const openEnd = qc.indexOf('// Plan 426: one single screen', openIdx);
  const openBlock = qc.slice(openIdx, openEnd);
  assert.ok(openBlock.includes('restoreBackToPickDraft(customerId, options)'), 'the form open restores the draft');
  assert.ok(openBlock.indexOf('restoreBackToPickDraft(customerId, options)') < openBlock.indexOf("showStep('form')"), 'restore runs before the form is shown');
  // The month picker and the draft restore refresh the same boxes.
  assert.ok(qc.includes("monthSelect?.addEventListener('change', refreshMonthDependentBoxes)"), 'month change refreshes the shared boxes');
  assert.ok(qc.includes('if (draft.month !== activeDefaults?.targetMonth) refreshMonthDependentBoxes();'), 'draft restore refreshes them only when the month moved');
  // Clear sites: close cleanup and both success paths.
  const closeIdx = qc.indexOf('function handleDialogClosed()');
  const closeBlock = qc.slice(closeIdx, closeIdx + 2500);
  assert.ok(closeBlock.includes('backToPickDraft = null;'), 'modal close drops the draft');
  const successClears = qc.split("showStep('success')").length - 1;
  assert.ok(successClears >= 2, 'two success paths exist');
  const beforeEachSuccess = qc.split("showStep('success')").slice(0, -1);
  assert.ok(beforeEachSuccess.every(part => part.slice(-1500).includes('backToPickDraft = null;')), 'every success path clears the draft first');
  // The draft never overrides a package-change reopen or a repeat.
  assert.ok(qc.includes('options.emptyAmount === true || (options.amountOverride !== undefined && options.amountOverride !== null)'), 'restore carves out amountOverride and emptyAmount');
  // No persistence, no new store, no new element id.
  const captureBody = qc.slice(qc.indexOf('function captureBackToPickDraft()'), qc.indexOf('function restoreBackToPickDraft'));
  const restoreBody = qc.slice(qc.indexOf('function restoreBackToPickDraft'), qc.indexOf('function openCustomerCollectionForm'));
  assert.ok(!captureBody.includes('localStorage'), 'capture never persists');
  assert.ok(!restoreBody.includes('localStorage'), 'restore never persists');
  assert.ok(!qc.includes('shahdara_back_to_pick'), 'no new store key');
  // The fresh-open defaults are untouched: a fresh open still resets
  // the digital fields, the split and the screenshot.
  assert.ok(qc.includes("if (transactionIdInput) transactionIdInput.value = '';"), 'fresh open still clears the TID');
  assert.ok(qc.includes("if (splitToggle) splitToggle.checked = false;"), 'fresh open still turns the split off');
  assert.ok(qc.includes("currentScreenshotDataUrl = '';"), 'fresh open still clears the screenshot');
});
