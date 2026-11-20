// QC receipt micro-polish — the header button (✕, top right) on the
// Quick Collect success card ("Payment Recorded Successfully") is a
// TRUE CLOSE now.
//
// NAMED REVERSAL of PR #1365 and of the QC-top D7(a) KEEP decision
// (user instruction 2026-11-20). PR #1365 fixed a user-reported live
// bug (2026-11-12): tapping the header button on the success card
// took the operator to HOME, and the payment screen had to be found
// and reopened for every next customer — so the header button became
// ↩, running the same full reset as "Next Customer"
// (collectAnotherCustomer) back to the picker. The user now
// explicitly asks for ✕: the header button closes the modal on every
// step including success. A glyph-only swap (✕ that goes back) would
// be dishonest UI, so glyph AND action both change. The one-tap
// back-to-picker from the header is gone; the "Next Customer" button
// still offers it. Done, Escape, backdrop and the phone Back button
// are untouched. The split-tender save lands on this same success
// step (the second showStep('success') site), so it is covered by
// the same close behaviour.
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

test('REPRO: on the success card, the header ✕ CLOSES the modal (PR #1365 reversed)', async () => {
  await withController(fixtureState(), async (h) => {
    await saveToSuccess(h);
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, false, 'the modal must CLOSE — ✕ is a true close on success now, not back-to-picker');
  });
});

test('on the success card, the header ✕ announces itself as a close', async () => {
  await withController(fixtureState(), async (h) => {
    await saveToSuccess(h);
    assert.equal(
      h.getEl('closeQuickCollectModalBtn').getAttribute('aria-label'),
      'Close quick collect modal',
      'on success the button must say it closes — the back-to-picker label is gone',
    );
    assert.equal(
      h.getEl('closeQuickCollectModalBtn').textContent,
      '✕',
      'on success the button must show ✕, never ↩',
    );
  });
});

test('on the picker step, the header ✕ still closes the sheet (unchanged)', async () => {
  await withController(fixtureState(), async (h) => {
    h.controller.open();
    assert.equal(h.getEl('quickCollectStepPick').hidden, false, 'precondition: picker showing');
    assert.equal(h.getEl('quickCollectModal').open, true, 'precondition: modal open');
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, false, 'on the picker the ✕ still closes the sheet');
  });
});

test('on the form step, the header ✕ still closes the sheet (unchanged)', async () => {
  await withController(fixtureState(), async (h) => {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectStepForm').hidden, false, 'precondition: form showing');
    await h.getEl('closeQuickCollectModalBtn').click();
    assert.equal(h.getEl('quickCollectModal').open, false, 'on the form the ✕ still closes the sheet');
  });
});

test('wiring source: the close-button handler calls closeModal directly, and the Done button still closes', () => {
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  const closeAt = setupSrc.indexOf("closeBtn?.addEventListener('click'");
  assert.ok(closeAt >= 0, 'close-button wiring exists');
  const handler = setupSrc.slice(closeAt, closeAt + 200);
  assert.ok(handler.includes("closeBtn?.addEventListener('click', closeModal);"), 'the header button must call closeModal directly (no success branch)');
  assert.ok(!handler.includes('collectAnotherCustomer'), 'the header button must no longer run the back-to-picker reset');
  assert.ok(!handler.includes('stepSuccess'), 'the header handler must no longer branch on the success step');
  const doneAt = setupSrc.indexOf("doneCloseBtn?.addEventListener('click', closeModal)");
  assert.ok(doneAt >= 0, 'Done still closes the sheet — only the header button changed, and only on success');
  // The header button keeps its close wording in the markup.
  const btnAt = pageSrc.indexOf('id="closeQuickCollectModalBtn"');
  assert.ok(btnAt >= 0, 'header close button exists in the markup');
  assert.ok(pageSrc.slice(btnAt, btnAt + 200).includes('aria-label="Close quick collect modal"'), 'markup keeps the close label as the default');
  // QC receipt micro-polish: the static markup is '✕' (the modal opens
  // on the picker, a close step) — and showStep now keeps it '✕' on
  // every step, including success. No '↩' swap remains anywhere.
  assert.ok(pageSrc.slice(btnAt, btnAt + 200).includes('✕'), 'header button is ✕ in the static markup (picker step closes)');
  const showStepAt = quickCollectSrc.indexOf('function showStep');
  assert.ok(showStepAt >= 0, 'showStep exists');
  const showStepBlock = quickCollectSrc.slice(showStepAt, showStepAt + 2000);
  assert.ok(showStepBlock.includes("closeBtn.textContent = '✕';"), 'showStep must set ✕ unconditionally on every step');
  assert.ok(showStepBlock.includes("closeBtn.setAttribute('aria-label', 'Close quick collect modal');"), 'showStep must set the close label unconditionally');
  assert.ok(!showStepBlock.includes("stepName === 'success' ? '↩'"), 'showStep must no longer swap in ↩ on success');
});

test('wiring source: both save paths land on this same success step, so one close behaviour covers them', () => {
  const showSuccess = (quickCollectSrc.match(/showStep\('success'\)/g) || []).length;
  assert.equal(showSuccess, 2, 'exactly two save paths reach the success step (ordinary + split tender) — both share the card and the header close button');
});
