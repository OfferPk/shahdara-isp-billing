// QC back button fix — the header back arrow (↩, top right) on the
// Quick Collect success card ("Payment Recorded Successfully") must
// return to the previous payment screen — the customer picker — so
// the next customer's payment can be taken right away.
//
// User-reported live bug 2026-11-12 (Roman Urdu + phone screenshot):
// tapping ↩ on the success card took the operator to HOME, and the
// payment screen had to be found and reopened for every next
// customer. Root cause: the header button is wired as a modal CLOSE
// for every step (closeModal), and closing the sheet makes the
// collect route leave() history.back() to the screen underneath —
// Home when Quick Collect was opened from Home / the bottom bar.
//
// Fix: on the success step only, ↩ runs the same full reset as the
// "Next Customer" button (collectAnotherCustomer): undo timers and
// reversal undo are dropped, the picker step shows again, the search
// is cleared and the active customer/receipt are reset — the modal
// stays OPEN on the picker. Every other step keeps the close
// behaviour (Done, Escape, backdrop and the phone Back button are
// untouched). The split-tender save lands on this same success step
// (the second showStep('success') site), so it is covered by the
// same step check; a flow with no meaningful previous payment
// screen does not exist here — every success card is reached from
// this modal's picker.
//
// Harness: the QC success-card phone-row controller harness (mock
// DOM + a real payment through submit + confirm). Pattern-fake data
// only: generic fixture names, no realistic phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getPakistanLocalDate,
  setupQuickCollectModal,
} from '../nav-quick-collect.js';
import {
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile,
} from '../core.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');
const pageSrc = read('index.html');

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

async function withController(state, fn) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  globalThis.document = documentStub;
  try {
    let current = state;
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {},
    });
    await fn({ controller, getEl, toasts, getState: () => current });
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

function fixtureState() {
  const now = new Date();
  let state = createInitialState(['Back Button Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000,
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

/** Drive a real cash payment through to the success step. */
async function saveToSuccess({ controller, getEl, getState }) {
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
  assert.equal(getEl('quickCollectStepSuccess').hidden, false, 'precondition: success step showing');
  assert.equal(getEl('quickCollectStepPick').hidden, true, 'precondition: picker hidden behind success');
  assert.equal(getEl('quickCollectModal').open, true, 'precondition: modal open on success');
}

test('REPRO: on the success card, the header back arrow returns to the picker — the modal stays open', async () => {
  await withController(fixtureState(), async (h) => {
    await saveToSuccess(h);
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, true, 'the modal must STAY OPEN — closing it drops the operator on Home');
    assert.equal(h.getEl('quickCollectStepPick').hidden, false, 'the picker step shows again — the next customer can be picked right away');
    assert.equal(h.getEl('quickCollectStepSuccess').hidden, true, 'the success step is left behind');
    assert.equal(h.getEl('quickCollectSearchInput').value, '', 'the picker search is cleared for the next customer');
  });
});

test('on the success card, the header back arrow announces itself as back to the customer list', async () => {
  await withController(fixtureState(), async (h) => {
    await saveToSuccess(h);
    assert.equal(
      h.getEl('closeQuickCollectModalBtn').getAttribute('aria-label'),
      'Back to customer list',
      'on success the arrow must say where it goes — it no longer closes the sheet',
    );
  });
});

test('on the picker step, the header back arrow still closes the sheet (unchanged)', async () => {
  await withController(fixtureState(), async (h) => {
    h.controller.open();
    assert.equal(h.getEl('quickCollectStepPick').hidden, false, 'precondition: picker showing');
    assert.equal(h.getEl('quickCollectModal').open, true, 'precondition: modal open');
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, false, 'on the picker the arrow still closes the sheet');
  });
});

test('on the form step, the header back arrow still closes the sheet (unchanged)', async () => {
  await withController(fixtureState(), async (h) => {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectStepForm').hidden, false, 'precondition: form showing');
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, false, 'on the form the arrow still closes the sheet');
  });
});

test('wiring source: the close-button handler branches on the success step, and the Done button still closes', () => {
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  const closeAt = setupSrc.indexOf("closeBtn?.addEventListener('click'");
  assert.ok(closeAt >= 0, 'close-button wiring exists');
  const handler = setupSrc.slice(closeAt, closeAt + 600);
  assert.ok(handler.includes('quickCollectStepSuccess') || handler.includes('stepSuccess'), 'the handler must read the success step before deciding');
  assert.ok(handler.includes('collectAnotherCustomer'), 'on success the arrow must run the same reset as Next Customer');
  assert.ok(handler.includes('closeModal'), 'off success the arrow must still close the modal');
  const doneAt = setupSrc.indexOf("doneCloseBtn?.addEventListener('click', closeModal)");
  assert.ok(doneAt >= 0, 'Done still closes the sheet — only the header arrow changes, and only on success');
  // The header button keeps its close wording in the markup (the
  // label is swapped at runtime by the step change, exactly like the
  // picker's own "Back to Picker" button already says).
  const btnAt = pageSrc.indexOf('id="closeQuickCollectModalBtn"');
  assert.ok(btnAt >= 0, 'header back button exists in the markup');
  assert.ok(pageSrc.slice(btnAt, btnAt + 200).includes('aria-label="Close quick collect modal"'), 'markup keeps the close label as the default');
  // QC Modal Overhaul 2: the static markup is '✕' (the modal opens
  // on the picker, a close step) — the '↩' appears only on the
  // success step, swapped in by showStep(). A static '↩' would
  // promise a back action the picker step does not perform.
  assert.ok(pageSrc.slice(btnAt, btnAt + 200).includes('✕'), 'header button is ✕ in the static markup (picker step closes)');
  const showStepAt = quickCollectSrc.indexOf('function showStep');
  assert.ok(showStepAt >= 0, 'showStep exists');
  const showStepBlock = quickCollectSrc.slice(showStepAt, showStepAt + 2000);
  assert.ok(showStepBlock.includes("closeBtn.textContent = stepName === 'success' ? '↩' : '✕'"), 'showStep must swap the glyph per step — ↩ on success, ✕ elsewhere');
});

test('wiring source: both save paths land on this same success step, so one step check covers them', () => {
  const showSuccess = (quickCollectSrc.match(/showStep\('success'\)/g) || []).length;
  assert.equal(showSuccess, 2, 'exactly two save paths reach the success step (ordinary + split tender) — both share the card and the header arrow');
});
