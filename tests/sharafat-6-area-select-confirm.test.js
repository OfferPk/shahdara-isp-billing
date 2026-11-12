// Sharafat 6 — Success-card Area select rewrites the customer's
// profile mohalla on change, with no confirm or undo.
//
// Problem: changing the Area select on the success receipt card
// immediately called updateCustomerProfile + onSaveState, so a
// mis-tap while fixing the receipt silently changed the customer's
// recorded mohalla; the only feedback was a toast, and there was no
// undo.
//
// Fix: nothing is written from an unconfirmed select change. The
// change asks the shared in-app confirm first; a confirmed change
// updates the receipt and the profile together, and its toast carries
// an Undo that puts the old mohalla back on both. Picking the area
// already shown, or 'Unassigned', changes nothing.
//
// Pins:
//  - REPRO: a change with no confirm available writes nothing —
//    onSaveState is not called and the profile mohalla is untouched;
//  - declining the confirm writes nothing and puts the select back
//    on the receipt's area;
//  - confirming updates the profile mohalla AND the receipt area
//    together, and the confirm names the new area;
//  - the confirmed-change toast carries an Undo action; invoking it
//    restores the old mohalla on the profile and the receipt;
//  - 'Unassigned' and the already-shown area ask nothing and write
//    nothing;
//  - wiring: the change handler asks window.appConfirm before any
//    profile write; the three confirm strings live in nav-language
//    (en + ur, params agree, ur carries Urdu script).
// Pattern-fake data only: Area Confirm Tester, 03012345678.
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
import {
  TRANSLATIONS,
  t,
  URDU_SCRIPT_PATTERN,
} from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');
const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

const OLD_AREA = 'SODAA';
const NEW_AREA = 'GANGALL';

// Mock-DOM harness adapted from the qc-success-card-phone-row test:
// auto-creating elements, listeners recorded per element, innerHTML
// assignment stores the markup string. onSaveState is counted, so a
// test can tell a write from a re-render.
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
    let saves = 0;
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; saves += 1; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {},
    });
    await fn({
      controller, getEl, toasts,
      getState: () => current,
      saves: () => saves,
    });
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

function fixtureState(patch = {}) {
  const now = new Date();
  let state = createInitialState(['Area Confirm Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000, mohalla: OLD_AREA, ...patch,
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

async function reachSuccessCard({ controller, getEl, getState }) {
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
  const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
  assert.ok(cardHtml.includes(`value="${OLD_AREA}" selected`), 'precondition: the card shows the old area selected');
}

// The Area select is rendered markup, not a mock child — dispatch the
// delegated change with a target whose closest() matches the hook,
// exactly as a real tap would. The confirm answer resolves on a
// microtask; the short wait lets the .then() run.
async function changeArea(getEl, value) {
  const fakeSelect = { value };
  const fakeTarget = { closest: (sel) => (sel === '[data-qc-area-select]' ? fakeSelect : null) };
  await getEl('quickCollectReceiptCard').dispatch('change', { target: fakeTarget });
  await new Promise((resolve) => setTimeout(resolve, 10));
}

// Installs a window.appConfirm stub that records its options and
// answers `answer`, runs fn, then restores the previous window.
async function withConfirm(answer, fn) {
  const prevWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    appConfirm: async (opts) => { calls.push(opts); return answer; },
  };
  try {
    const result = await fn(calls);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return result;
  } finally {
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  }
}

const mohallaOf = (state) => state.customers[0].mohalla;

test('REPRO: changing the Area select with no confirm available writes nothing', async () => {
  await withController(fixtureState(), async ({ controller, getEl, toasts, getState, saves }) => {
    await reachSuccessCard({ controller, getEl, getState });
    const savesBefore = saves();
    await changeArea(getEl, NEW_AREA);
    assert.equal(saves(), savesBefore, 'no onSaveState call before confirmation');
    assert.equal(mohallaOf(getState()), OLD_AREA, 'the profile mohalla is untouched');
    assert.equal(toasts.filter((x) => x.msg.includes('Area updated')).length, 0, 'no area toast without a confirmed change');
    assert.ok(getEl('quickCollectReceiptCard').innerHTML.includes(`value="${OLD_AREA}" selected`), 'the select falls back to the receipt area');
  });
});

test('declining the confirm writes nothing and puts the select back on the receipt area', async () => {
  await withController(fixtureState(), async ({ controller, getEl, toasts, getState, saves }) => {
    await reachSuccessCard({ controller, getEl, getState });
    const savesBefore = saves();
    await withConfirm(false, async (calls) => {
      await changeArea(getEl, NEW_AREA);
      assert.equal(calls.length, 1, 'the confirm was asked exactly once');
      assert.ok(calls[0].message.includes(NEW_AREA), 'the confirm names the new area');
    });
    assert.equal(saves(), savesBefore, 'a declined change never saves');
    assert.equal(mohallaOf(getState()), OLD_AREA, 'the profile mohalla is untouched');
    assert.equal(toasts.filter((x) => x.msg.includes('Area updated')).length, 0, 'no area toast for a declined change');
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes(`value="${OLD_AREA}" selected`), 'the select falls back to the receipt area');
    assert.ok(!cardHtml.includes(`value="${NEW_AREA}" selected`), 'the new area is not shown selected');
  });
});

test('confirming updates the profile mohalla AND the receipt area together', async () => {
  await withController(fixtureState(), async ({ controller, getEl, toasts, getState, saves }) => {
    await reachSuccessCard({ controller, getEl, getState });
    const savesBefore = saves();
    await withConfirm('confirm', async (calls) => {
      await changeArea(getEl, NEW_AREA);
      assert.equal(calls.length, 1, 'the confirm was asked exactly once');
      assert.equal(calls[0].title, t('qc_area_confirm_title'), 'the confirm carries the keyed title');
      assert.equal(calls[0].confirmLabel, t('qc_area_confirm_btn'), 'the confirm carries the keyed button');
    });
    assert.equal(saves(), savesBefore + 1, 'exactly one save for the confirmed change');
    assert.equal(mohallaOf(getState()), NEW_AREA, 'the profile mohalla is the new area');
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes(`value="${NEW_AREA}" selected`), 'the receipt shows the new area selected');
    assert.ok(!cardHtml.includes(`value="${OLD_AREA}" selected`), 'the old area is not shown selected');
    const toast = toasts.find((x) => x.msg.includes(`Area updated to ${NEW_AREA}`));
    assert.ok(toast, 'the confirmed change still toasts');
    assert.equal(toast.opts.type, 'success', 'the toast is a success toast');
    assert.equal(toast.opts.actionLabel, t('qcpkg_undo'), 'the toast carries the Undo action');
    assert.equal(typeof toast.opts.onAction, 'function', 'the Undo action is wired');
  });
});

test('the confirmed-change toast Undo restores the old mohalla on the profile and the receipt', async () => {
  await withController(fixtureState(), async ({ controller, getEl, toasts, getState }) => {
    await reachSuccessCard({ controller, getEl, getState });
    await withConfirm('confirm', async () => { await changeArea(getEl, NEW_AREA); });
    assert.equal(mohallaOf(getState()), NEW_AREA, 'precondition: the change applied');
    const toast = toasts.find((x) => x.msg.includes(`Area updated to ${NEW_AREA}`));
    assert.ok(toast && typeof toast.opts.onAction === 'function', 'precondition: the Undo action exists');
    const toastsBefore = toasts.length;
    toast.opts.onAction();
    assert.equal(mohallaOf(getState()), OLD_AREA, 'Undo puts the old mohalla back on the profile');
    const cardHtml = getEl('quickCollectReceiptCard').innerHTML;
    assert.ok(cardHtml.includes(`value="${OLD_AREA}" selected`), 'Undo puts the old area back on the receipt');
    assert.ok(!cardHtml.includes(`value="${NEW_AREA}" selected`), 'the new area is not shown selected after Undo');
    assert.equal(toasts.length, toastsBefore + 1, 'Undo toasts the restore');
    assert.ok(toasts[toasts.length - 1].msg.includes(`Area updated to ${OLD_AREA}`), 'the restore toast names the old area');
  });
});

test('picking Unassigned asks nothing and writes nothing', async () => {
  await withController(fixtureState(), async ({ controller, getEl, getState, saves }) => {
    await reachSuccessCard({ controller, getEl, getState });
    const savesBefore = saves();
    await withConfirm('confirm', async (calls) => {
      await changeArea(getEl, '');
      assert.equal(calls.length, 0, 'no confirm for Unassigned');
    });
    assert.equal(saves(), savesBefore, 'Unassigned never saves');
    assert.equal(mohallaOf(getState()), OLD_AREA, 'the profile mohalla is untouched');
  });
});

test('picking the area already shown asks nothing and writes nothing', async () => {
  await withController(fixtureState(), async ({ controller, getEl, getState, saves }) => {
    await reachSuccessCard({ controller, getEl, getState });
    const savesBefore = saves();
    await withConfirm('confirm', async (calls) => {
      await changeArea(getEl, OLD_AREA);
      assert.equal(calls.length, 0, 'no confirm for the already-shown area');
    });
    assert.equal(saves(), savesBefore, 'the already-shown area never saves');
    assert.equal(mohallaOf(getState()), OLD_AREA, 'the profile mohalla is untouched');
  });
});

test('dictionary: the three confirm keys exist in en and ur, params agree, ur carries Urdu script', () => {
  const keys = ['qc_area_confirm_title', 'qc_area_confirm_message', 'qc_area_confirm_btn'];
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en carries ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur carries ${key}`);
    assert.ok(URDU_SCRIPT_PATTERN.test(TRANSLATIONS.ur[key]), `ur ${key} carries Urdu script`);
    const paramsOf = (text) => [...(text.match(/\{\w+\}/g) || [])].sort();
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `${key} params agree`);
  }
  assert.equal(TRANSLATIONS.en.qc_area_confirm_message.includes('{area}'), true, 'the message names the new area');
});

test('wiring source: the change handler asks window.appConfirm before any profile write', () => {
  const setupStart = quickCollectSrc.indexOf('export function setupQuickCollectModal');
  const setupSrc = quickCollectSrc.slice(setupStart);
  const handlerAt = setupSrc.indexOf("closest?.('[data-qc-area-select]')");
  assert.ok(handlerAt >= 0, 'the card container delegates the change to the Area select hook');
  const askAt = setupSrc.indexOf('window.appConfirm', handlerAt);
  assert.ok(askAt > handlerAt, 'the handler asks the shared confirm');
  const beforeAsk = setupSrc.slice(handlerAt, askAt);
  assert.ok(!beforeAsk.includes('updateCustomerProfile('), 'no profile write before the confirm is asked');
  assert.ok(!beforeAsk.includes('onSaveState('), 'no save before the confirm is asked');
  const thenAt = setupSrc.indexOf('ask.then', askAt);
  assert.ok(thenAt > askAt, 'the confirm answer settles the change');
  assert.ok(setupSrc.slice(thenAt, thenAt + 650).includes('applyAreaChange(stored, previousMohalla)'), 'a confirmed answer applies the change');
  assert.ok(setupSrc.includes("actionLabel: t('qcpkg_undo')"), 'the confirmed-change toast carries the Undo label');
  assert.ok(setupSrc.includes("t('qc_area_confirm_title')"), 'the confirm title is keyed');
  assert.ok(setupSrc.includes("t('qc_area_confirm_message'"), 'the confirm message is keyed');
  assert.ok(setupSrc.includes("t('qc_area_confirm_btn')"), 'the confirm button is keyed');
});
