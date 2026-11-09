/**
 * plan540-waiver-waada-keep-focus.test.js — Plan 540 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: both controls rebuild their own DOM on
 * interaction. The late-fee waiver checkbox change handler re-renders
 * the whole waiver box (renderWaiverBox), replacing the checkbox the
 * operator just ticked. The remainder-waada chip handler re-renders
 * the whole waada row (renderRemainderWaadaRow), replacing the chip
 * just tapped. After either interaction, focus falls back to the
 * document body, so a keyboard operator loses their place in the form.
 *
 * Pins:
 *  - acceptance (waiver): Tab to the waiver checkbox, press Space —
 *    the checkbox toggles and focus stays on it (the replacement
 *    checkbox, a new node, checked);
 *  - acceptance (waada): Tab to a waada chip, press Enter — the chip
 *    activates and focus stays on the corresponding chip (the
 *    replacement chip, a new node); same for the Skip chip;
 *  - no focus theft: an amount edit (which re-renders both the
 *    waiver box and the waada row) and a payment-date change (which
 *    re-renders the waada row) leave focus where the operator was —
 *    the re-renders must not suddenly move focus;
 *  - wiring: the focus restore lives in the two interaction handlers
 *    only — renderWaiverBox and renderRemainderWaadaRow themselves
 *    never focus anything, so a package change, a draft restore or a
 *    hide-clear cannot steal focus.
 *
 * Harness: the polish #13 / Plan 538 controller harness (mock DOM +
 * mock localStorage), extended with (a) focus tracking — every mock
 * element's focus() records itself as the focused element, and an
 * innerHTML write that destroys the focused node clears it, exactly
 * like the real DOM dropping focus to the body; (b) a waiver box
 * whose innerHTML write rebuilds the checkbox mock from the markup
 * (checked/disabled parsed from the tag); (c) a remainder-waada row
 * whose innerHTML write rebuilds one chip mock per
 * data-remwaada-chip key, with closest() and a querySelector that
 * answers [data-remwaada-chip="key"]. Synthetic data only — no real
 * customer names, no realistic phone numbers (pattern-fake digits
 * only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations,
  applyLateFeeToBill
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function plan540State(now, month, lateFee = 0) {
  let state = createInitialState(['Plan540 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month).dueAmount), 1000, 'precondition: billed 1,000');
  if (lateFee > 0) {
    state = applyLateFeeToBill(state, 'seed-001', month, { amount: lateFee });
    assert.equal(
      calculatePaymentAllocations(state).forMonth('seed-001', month)?.lateFeeCents,
      lateFee * 100, 'precondition: late fee on the bill');
  }
  return state;
}

/** Plan 540 controller harness: the polish #13 mock DOM, with focus tracking. */
function plan540Controller(initialState) {
  const registry = new Map();
  // The focused element, tracked like document.activeElement. The
  // real DOM drops focus to the body when the focused node is
  // destroyed by an innerHTML write — the two innerHTML setters
  // below clear it the same way.
  let focusedEl = null;
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
      focus: () => { focusedEl = el; },
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

  // The waiver box: innerHTML writes rebuild the checkbox mock,
  // exactly like the real DOM destroying the old node on re-render.
  // The checkbox's checked/disabled state is parsed from the tag.
  const waiverBox = getEl('quickCollectLateFeeWaiverBox');
  let waiverHtml = '';
  let waiverCheckbox = null;
  Object.defineProperty(waiverBox, 'innerHTML', {
    get: () => waiverHtml,
    set: (v) => {
      waiverHtml = String(v ?? '');
      if (focusedEl === waiverCheckbox) focusedEl = null;
      waiverCheckbox = null;
      const m = waiverHtml.match(/<input[^>]*data-qc-waive-late-fee[^>]*>/);
      if (m) {
        waiverCheckbox = createMockElement('', 'input');
        waiverCheckbox.checked = /\bchecked\b/.test(m[0]);
        waiverCheckbox.disabled = /\bdisabled\b/.test(m[0]);
      }
    }
  });
  waiverBox.querySelector = (sel) => (sel === '[data-qc-waive-late-fee]' ? waiverCheckbox : null);

  // The remainder-waada row: innerHTML writes rebuild one chip mock
  // per data-remwaada-chip key, exactly like the real DOM.
  const waadaRow = getEl('quickCollectRemainderWaadaRow');
  let waadaHtml = '';
  let waadaChips = [];
  Object.defineProperty(waadaRow, 'innerHTML', {
    get: () => waadaHtml,
    set: (v) => {
      waadaHtml = String(v ?? '');
      if (focusedEl && waadaChips.includes(focusedEl)) focusedEl = null;
      waadaChips = [];
      for (const m of waadaHtml.matchAll(/data-remwaada-chip="([^"]+)"/g)) {
        const key = m[1];
        const chip = createMockElement('', 'button');
        chip.getAttribute = (n) => (n === 'data-remwaada-chip' ? key : null);
        chip.closest = (sel) => (sel === '[data-remwaada-chip]' ? chip : null);
        waadaChips.push(chip);
      }
    }
  });
  waadaRow.querySelector = (sel) => {
    const m = sel.match(/^\[data-remwaada-chip="([^"]+)"\]$/);
    if (m) return waadaChips.find(c => c.getAttribute('data-remwaada-chip') === m[1]) ?? null;
    if (sel === '[data-remwaada-chip]') return waadaChips[0] ?? null;
    return null;
  };

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
    focused: () => focusedEl,
    waiverCheckbox: () => waiverBox.querySelector('[data-qc-waive-late-fee]'),
    chip: (key) => waadaRow.querySelector(`[data-remwaada-chip="${key}"]`),
    tapChip: (key) => waadaRow.dispatch('click', { target: waadaRow.querySelector(`[data-remwaada-chip="${key}"]`) }),
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

test('plan 540 acceptance (REPRO): ticking the waiver checkbox keeps focus on the replacement checkbox', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month, 150));
  try {
    h.controller.open('seed-001');
    // The 1,150 prefill covers the 1,000 principal, so the waiver
    // box renders the enabled checkbox on open.
    const before = h.waiverCheckbox();
    assert.ok(before, 'precondition: waiver checkbox rendered');
    assert.equal(before.disabled, false, 'precondition: checkbox enabled — the prefilled 1,150 covers the principal');
    assert.equal(before.checked, false, 'precondition: waiver not yet ticked');

    // Tab to the checkbox, press Space: it toggles.
    before.focus();
    assert.equal(h.focused(), before, 'precondition: focus is on the checkbox');
    before.checked = true;
    await before.dispatch('change');

    // The tick sets the amount to the principal and re-renders the
    // box — the old checkbox node is gone, the new one is checked,
    // and focus must be on it, not lost to the body.
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'waiver tick sets the amount to the principal');
    const after = h.waiverCheckbox();
    assert.ok(after, 'replacement checkbox rendered');
    assert.notEqual(after, before, 'the replacement is a new node — the old one was destroyed');
    assert.equal(after.checked, true, 'replacement checkbox is checked');
    assert.equal(h.focused(), after, 'focus stays on the waiver checkbox');
    assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast');
  } finally {
    h.restore();
  }
});

test('plan 540 acceptance (REPRO): unticking the waiver checkbox keeps focus on the replacement checkbox', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month, 150));
  try {
    h.controller.open('seed-001');
    const first = h.waiverCheckbox();
    assert.ok(first, 'precondition: waiver checkbox rendered');
    first.focus();
    first.checked = true;
    await first.dispatch('change');
    const ticked = h.waiverCheckbox();
    assert.equal(h.focused(), ticked, 'precondition: focus on the ticked replacement');
    assert.equal(ticked.checked, true, 'precondition: waiver ticked');

    // Untick: the amount goes back to the full balance and the box
    // re-renders — focus must follow to the new checkbox.
    ticked.checked = false;
    await ticked.dispatch('change');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1150.00', 'untick restores the amount to the full balance');
    const after = h.waiverCheckbox();
    assert.ok(after, 'replacement checkbox rendered');
    assert.notEqual(after, ticked, 'the replacement is a new node');
    assert.equal(after.checked, false, 'replacement checkbox is unchecked');
    assert.equal(h.focused(), after, 'focus stays on the waiver checkbox');
  } finally {
    h.restore();
  }
});

test('plan 540 acceptance (REPRO): tapping a waada chip keeps focus on the replacement chip', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month));
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectAmountInput').value = '600.00';
    await h.getEl('quickCollectAmountInput').dispatch('input');
    const before = h.chip('plus7');
    assert.ok(before, 'precondition: plus7 chip rendered for the 400 remainder');
    assert.ok(h.chip('plus3'), 'precondition: plus3 chip rendered');

    // Tab to the chip, press Enter: it activates.
    before.focus();
    assert.equal(h.focused(), before, 'precondition: focus is on the chip');
    await h.tapChip('plus7');

    const after = h.chip('plus7');
    assert.ok(after, 'replacement chip rendered');
    assert.notEqual(after, before, 'the replacement is a new node — the old one was destroyed');
    assert.equal(h.focused(), after, 'focus stays on the tapped chip');
    assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast');
  } finally {
    h.restore();
  }
});

test('plan 540 acceptance (REPRO): tapping the Skip chip keeps focus on the replacement Skip chip', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month));
  try {
    h.controller.open('seed-001');
    // Arm a date first, so Skip has something to disarm.
    h.getEl('quickCollectAmountInput').value = '600.00';
    await h.getEl('quickCollectAmountInput').dispatch('input');
    assert.ok(h.chip('plus3'), 'precondition: chips rendered');
    await h.tapChip('plus3');
    assert.ok(h.chip('plus3'), 'precondition: chip still there after arming');

    const skipBefore = h.chip('skip');
    assert.ok(skipBefore, 'precondition: Skip chip rendered');
    skipBefore.focus();
    await h.tapChip('skip');

    const skipAfter = h.chip('skip');
    assert.ok(skipAfter, 'replacement Skip chip rendered');
    assert.notEqual(skipAfter, skipBefore, 'the replacement is a new node');
    assert.equal(h.focused(), skipAfter, 'focus stays on the Skip chip');
  } finally {
    h.restore();
  }
});

test('plan 540: an amount edit re-renders both boxes but does not move focus', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month, 150));
  try {
    h.controller.open('seed-001');
    const amountInput = h.getEl('quickCollectAmountInput');
    // Focus the amount field itself, then type — the waiver box and
    // the waada row both re-render, but focus must stay put.
    amountInput.focus();
    assert.equal(h.focused(), amountInput, 'precondition: focus is on the amount field');
    amountInput.value = '600.00';
    await amountInput.dispatch('input');
    assert.ok(h.waiverCheckbox(), 'waiver box re-rendered on the amount edit');
    assert.ok(h.chip('plus3'), 'waada row rendered on the amount edit');
    assert.equal(h.focused(), amountInput, 'focus stays on the amount field — no re-render steals it');
  } finally {
    h.restore();
  }
});

test('plan 540: a payment-date change re-renders the waada row but does not move focus', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan540Controller(plan540State(now, month));
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectAmountInput').value = '600.00';
    await h.getEl('quickCollectAmountInput').dispatch('input');
    assert.ok(h.chip('plus3'), 'precondition: chips rendered');

    const dateInput = h.getEl('quickCollectDateInput');
    dateInput.focus();
    assert.equal(h.focused(), dateInput, 'precondition: focus is on the date field');
    const yesterday = getPakistanLocalDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    dateInput.value = yesterday;
    await dateInput.dispatch('change');
    assert.ok(h.chip('plus3'), 'waada row re-rendered on the date change');
    assert.equal(h.focused(), dateInput, 'focus stays on the date field — the waada re-render does not steal it');
  } finally {
    h.restore();
  }
});

test('plan 540 wiring: the focus restore lives in the two interaction handlers only', () => {
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  // Waiver: the change handler restores focus after its re-render.
  const waiverIdx = qc.indexOf('function renderWaiverBox(customerId, month)');
  assert.ok(waiverIdx > 0, 'renderWaiverBox exists');
  const waiverEnd = qc.indexOf('// Owner feature: Change Package row', waiverIdx);
  const waiverBlock = qc.slice(waiverIdx, waiverEnd);
  const changeIdx = waiverBlock.indexOf("checkbox?.addEventListener('change'");
  assert.ok(changeIdx > 0, 'waiver checkbox change handler exists');
  const changeBlock = waiverBlock.slice(changeIdx, changeIdx + 1500);
  assert.ok(changeBlock.includes('renderWaiverBox(customerId, month);'), 'change handler re-renders the box');
  assert.ok(changeBlock.indexOf('renderWaiverBox(customerId, month);') < changeBlock.indexOf('.focus()'), 'focus restore runs after the re-render');
  assert.ok(changeBlock.includes("querySelector('[data-qc-waive-late-fee]')"), 'focus goes to the replacement checkbox');
  // The render function itself never focuses: a month change, a
  // package change or a draft restore re-render must not move focus.
  const renderOnly = waiverBlock.slice(0, changeIdx);
  assert.ok(!renderOnly.includes('.focus()'), 'renderWaiverBox itself never focuses');
  // Waada: the click handler restores focus after each re-render.
  const clickIdx = qc.indexOf("remainderWaadaRow?.addEventListener('click'");
  assert.ok(clickIdx > 0, 'waada row click handler exists');
  const clickBlock = qc.slice(clickIdx, clickIdx + 1500);
  assert.ok(clickBlock.includes('renderRemainderWaadaRow();'), 'click handler re-renders the row');
  assert.ok(clickBlock.includes('focusRemainderWaadaChip(key);'), 'click handler restores focus to the tapped chip');
  assert.equal(clickBlock.split('renderRemainderWaadaRow();').length - 1, 2, 'both branches (skip and date) re-render');
  assert.equal(clickBlock.split('focusRemainderWaadaChip(key);').length - 1, 2, 'both branches restore focus after the re-render');
  assert.ok(clickBlock.indexOf('renderRemainderWaadaRow();') < clickBlock.indexOf('focusRemainderWaadaChip(key);'), 'focus restore runs after the re-render');
  // The helper focuses the replacement chip with the same key.
  const helperIdx = qc.indexOf('function focusRemainderWaadaChip(key)');
  assert.ok(helperIdx > 0, 'focus helper exists');
  const helperBlock = qc.slice(helperIdx, helperIdx + 300);
  assert.ok(helperBlock.includes('[data-remwaada-chip="${key}"]'), 'helper selects the replacement chip by key');
  // The render function itself never focuses.
  const renderIdx = qc.indexOf('function renderRemainderWaadaRow()');
  const renderEnd = qc.indexOf('// Chip taps are the ONLY way', renderIdx);
  const renderBlock = qc.slice(renderIdx, renderEnd);
  assert.ok(!renderBlock.includes('.focus()'), 'renderRemainderWaadaRow itself never focuses');
  // No new element id, no new store key.
  assert.ok(!qc.includes('shahdara_plan540'), 'no new store key');
});
