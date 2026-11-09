// Plan 535 — Entry-form clearance flag covers both legs and names
// only Bank Transfer.
//
// Problem: the entry-form flag read only the leg-1 method select,
// and updateSplitVisibility never refreshed it — so a split whose
// leg 2 was a Bank Transfer showed no "bill settles when cleared"
// flag while entering, even though the success-screen flag checks
// both legs. And the flag's copy promised a cheque the app never
// offers (PAYMENT_METHODS carries no Cheque, validatePayment
// rejects it) — only the receipt-side flag can ever see a legacy
// cheque record.
//
// Pins:
//  - the entry form flags a Bank Transfer only, on either leg: leg 2
//    Bank Transfer shows the flag before saving, leg 2 Easypaisa
//    shows nothing, and turning the split off clears it again
//    (REPRO: fails on the pristine head, which never reads leg 2);
//  - the entry text names the Bank Transfer and mentions no cheque;
//  - single-payment behaviour is unchanged: leg-1 Bank Transfer
//    flags, leg-1 Cash does not;
//  - the receipt side is untouched: a legacy cheque receipt still
//    flags on the success screen with the old text;
//  - the wiring: the render reads both legs through the entry rule,
//    updateSplitVisibility refreshes the flag, and no entry-form
//    copy mentions cheque.
// Synthetic data only: one pattern-fake customer, PKR 3,000 dues.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PENDING_CLEARANCE_FLAG_TEXT,
  PENDING_CLEARANCE_ENTRY_FLAG_TEXT,
  pendingClearanceFlagForMethod,
  pendingClearanceFlagForReceipt,
  pendingClearanceEntryFlagForMethod,
} from '../pending-clearance-flag.js';
import {
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile,
} from '../core.js';
import { getPakistanLocalDate, setupQuickCollectModal } from '../nav-quick-collect.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const ENTRY_TEXT = 'Bank transfer — bill settles when cleared';

const moduleSrc = readFileSync(new URL('../pending-clearance-flag.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function plan535FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan535 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000,
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

/** The owner-cash-shop test's mock DOM + controller harness (Plan 534
 *  shape, without the leg-2 duplicate card — this plan needs only
 *  the method selects, the split toggle, and the flag host). */
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

// Open the form with leg 1 on Cash, so the flag starts hidden.
async function openWithCashLeg1(getEl, controller) {
  controller.open('seed-001');
  getEl('quickCollectMethodSelect').value = 'Cash';
  await getEl('quickCollectMethodSelect').dispatch('change');
  assert.equal(getEl('pcfPendingClearanceFlag').hidden, true, 'precondition: Cash leg 1 shows no flag');
}

async function setSplit(getEl, on) {
  const splitToggle = getEl('quickCollectSplitToggle');
  splitToggle.checked = on;
  await splitToggle.dispatch('change');
}

async function setLeg2Method(getEl, method) {
  getEl('quickCollectSplitMethodSelect').value = method;
  await getEl('quickCollectSplitMethodSelect').dispatch('change');
}

// --- The entry rule: Bank Transfer only ---

test('entry text: it names the Bank Transfer and mentions no cheque', () => {
  assert.equal(PENDING_CLEARANCE_ENTRY_FLAG_TEXT, ENTRY_TEXT);
  assert.match(PENDING_CLEARANCE_ENTRY_FLAG_TEXT, /Bank transfer/);
  assert.doesNotMatch(PENDING_CLEARANCE_ENTRY_FLAG_TEXT, /cheque/i);
});

test('entry rule: every bank-transfer spelling flags', () => {
  for (const method of [
    'Bank Transfer',
    'bank transfer',
    'bank_transfer',
    'BANK_TRANSFER',
    'Bank_Transfer',
    '  Bank Transfer  ',
    'bank  transfer',
  ]) {
    assert.equal(pendingClearanceEntryFlagForMethod(method), ENTRY_TEXT, `expected a flag for ${JSON.stringify(method)}`);
  }
});

test('entry rule: a cheque never flags on the entry form', () => {
  for (const method of ['Cheque', 'cheque', 'CHEQUE', ' cheque ', 'Cheque ']) {
    assert.equal(pendingClearanceEntryFlagForMethod(method), '', `expected no flag for ${JSON.stringify(method)}`);
  }
});

test('entry rule: cash, wallet, Raast and shop methods never flag', () => {
  for (const method of [
    'Cash',
    'JazzCash',
    'Easypaisa',
    'NayaPay',
    'Raast',
    'Cash at Waseem Abbasi shop',
    'Cash at Hassan shop',
    'Cash at Balla shop',
  ]) {
    assert.equal(pendingClearanceEntryFlagForMethod(method), '', `expected no flag for ${JSON.stringify(method)}`);
  }
});

test('entry rule: a blank, damaged, or unknown method never flags — never a guess', () => {
  for (const method of ['', '   ', null, undefined, 123, true, false, {}, [], 'BankTransfer', 'bank-transfer', 'transfer', 'online', 'Bank']) {
    assert.equal(pendingClearanceEntryFlagForMethod(method), '', `expected no flag for ${String(method)}`);
  }
});

// --- The receipt side is untouched ---

test('receipt rule: a legacy cheque receipt still flags with the old text', () => {
  assert.equal(PENDING_CLEARANCE_FLAG_TEXT, 'pending clearance — bill settles when cleared');
  const receipt = {
    id: 'rcpt-1',
    receiptNumber: 'RCPT-41-202611-01',
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 3000,
    method: 'Cheque',
    date: '2026-11-07',
    month: '2026-11',
    phone: '03012345678',
  };
  assert.equal(pendingClearanceFlagForReceipt(receipt), PENDING_CLEARANCE_FLAG_TEXT);
  assert.equal(pendingClearanceFlagForMethod('Cheque'), PENDING_CLEARANCE_FLAG_TEXT);
  const splitReceipt = {
    ...receipt,
    method: 'Cash + JazzCash',
    splitTender: {
      legs: [
        { leg: 1, receiptNumber: 'RCPT-41-202611-01', method: 'Cash', amount: 3000 },
        { leg: 2, receiptNumber: 'RCPT-41-202611-02', method: 'Cheque', amount: 2000 },
      ],
    },
  };
  assert.equal(pendingClearanceFlagForReceipt(splitReceipt), PENDING_CLEARANCE_FLAG_TEXT);
});

// --- The flag on the form, through the real render ---

test('REPRO (Plan 535): split on, leg 2 Bank Transfer shows the flag before saving', async () => {
  await withController(plan535FixtureState(), async ({ controller, getEl }) => {
    await openWithCashLeg1(getEl, controller);
    const flagEl = getEl('pcfPendingClearanceFlag');

    await setSplit(getEl, true);
    await setLeg2Method(getEl, 'Bank Transfer');

    // The bug: on the pristine head the render never reads leg 2, so
    // the flag stays hidden and the customer leaves believing a
    // transfer leg is settled.
    assert.equal(flagEl.hidden, false, 'the flag is visible while leg 2 is a Bank Transfer');
    assert.equal(flagEl.textContent, ENTRY_TEXT, 'the flag names the Bank Transfer');
  });
});

test('form: split on, leg 2 Easypaisa shows no flag', async () => {
  await withController(plan535FixtureState(), async ({ controller, getEl }) => {
    await openWithCashLeg1(getEl, controller);
    const flagEl = getEl('pcfPendingClearanceFlag');

    await setSplit(getEl, true);
    await setLeg2Method(getEl, 'Easypaisa');

    assert.equal(flagEl.hidden, true, 'no flag for a wallet leg 2');
    assert.equal(flagEl.textContent, '', 'no flag text for a wallet leg 2');
  });
});

test('form: turning the split off clears a leg-2 transfer flag', async () => {
  await withController(plan535FixtureState(), async ({ controller, getEl }) => {
    await openWithCashLeg1(getEl, controller);
    const flagEl = getEl('pcfPendingClearanceFlag');

    await setSplit(getEl, true);
    await setLeg2Method(getEl, 'Bank Transfer');
    assert.equal(flagEl.hidden, false, 'precondition: the leg-2 transfer flags');

    await setSplit(getEl, false);
    assert.equal(flagEl.hidden, true, 'split off: leg 2 no longer exists, so its flag goes away');
    assert.equal(flagEl.textContent, '', 'split off: no flag text');
  });
});

test('form: single payment, leg-1 Bank Transfer flags and leg-1 Cash does not', async () => {
  await withController(plan535FixtureState(), async ({ controller, getEl }) => {
    await openWithCashLeg1(getEl, controller);
    const flagEl = getEl('pcfPendingClearanceFlag');
    const methodSelect = getEl('quickCollectMethodSelect');

    methodSelect.value = 'Bank Transfer';
    await methodSelect.dispatch('change');
    assert.equal(flagEl.hidden, false, 'a single Bank Transfer flags, as before');
    assert.equal(flagEl.textContent, ENTRY_TEXT, 'the single flag uses the entry wording');

    methodSelect.value = 'Cash';
    await methodSelect.dispatch('change');
    assert.equal(flagEl.hidden, true, 'Cash clears the flag again');
  });
});

test('form: either leg flags — leg-1 transfer stays flagged when leg 2 is a wallet', async () => {
  await withController(plan535FixtureState(), async ({ controller, getEl }) => {
    controller.open('seed-001');
    const flagEl = getEl('pcfPendingClearanceFlag');
    const methodSelect = getEl('quickCollectMethodSelect');

    methodSelect.value = 'Bank Transfer';
    await methodSelect.dispatch('change');
    assert.equal(flagEl.hidden, false, 'precondition: the leg-1 transfer flags');

    await setSplit(getEl, true);
    await setLeg2Method(getEl, 'Easypaisa');
    assert.equal(flagEl.hidden, false, 'leg 1 still flags with a wallet leg 2');
    assert.equal(flagEl.textContent, ENTRY_TEXT, 'the flag text is unchanged');
  });
});

// --- Wiring ---

test('wiring: the controller imports the entry rule', () => {
  assert.ok(wiringSrc.includes("from './pending-clearance-flag.js'"), 'missing module import');
  assert.ok(wiringSrc.includes('pendingClearanceEntryFlagForMethod'), 'missing entry-rule import');
});

test('wiring: the form render reads both legs through the entry rule', () => {
  assert.ok(wiringSrc.includes('function renderPendingClearanceFlag()'), 'missing form render function');
  const fn = wiringSrc.slice(
    wiringSrc.indexOf('function renderPendingClearanceFlag()'),
    wiringSrc.indexOf('function renderBigNameConfirm()'),
  );
  assert.ok(fn.includes("methodSelect ? String(methodSelect.value || '') : ''"), 'render must read the leg-1 select value');
  assert.ok(fn.includes('splitToggle?.checked'), 'render must only read leg 2 while the split is on');
  assert.ok(fn.includes('splitMethodSelect'), 'render must read the leg-2 select');
  assert.ok(fn.includes('pendingClearanceEntryFlagForMethod(method)'), 'render must flag leg 1 by the entry rule');
  assert.ok(fn.includes('pendingClearanceEntryFlagForMethod(splitMethod)'), 'render must flag leg 2 by the entry rule');
  assert.ok(fn.includes('pendingClearanceFlagEl.textContent = flag;'), 'render must write the flag as plain text');
  assert.ok(fn.includes("pendingClearanceFlagEl.hidden = flag === '';"), 'render must hide when there is no flag');
});

test('wiring: updateSplitVisibility refreshes the flag, with no new split listener', () => {
  assert.ok(wiringSrc.includes('function updateSplitVisibility()'), 'missing split visibility function');
  const fn = wiringSrc.slice(
    wiringSrc.indexOf('function updateSplitVisibility()'),
    wiringSrc.indexOf('function updateCounts()'),
  );
  assert.ok(fn.includes('renderPendingClearanceFlag();'), 'split visibility must refresh the flag');
  // Plan 527: the split toggle keeps exactly five change listeners —
  // the refresh rides inside updateSplitVisibility, never a sixth.
  const listeners = wiringSrc.match(/splitToggle\?\.addEventListener\('change'/g) || [];
  assert.equal(listeners.length, 5, `expected 5 split-toggle change listeners, got ${listeners.length}`);
});

test('wiring: no entry-form copy mentions cheque', () => {
  // The render function itself.
  const fn = wiringSrc.slice(
    wiringSrc.indexOf('function renderPendingClearanceFlag()'),
    wiringSrc.indexOf('function renderBigNameConfirm()'),
  );
  assert.doesNotMatch(fn, /cheque/i, 'the entry render must not mention cheque');
  // The entry text constant and the entry rule in the module.
  const entryAt = moduleSrc.indexOf('PENDING_CLEARANCE_ENTRY_FLAG_TEXT');
  const entrySrc = moduleSrc.slice(entryAt);
  assert.doesNotMatch(entrySrc, /cheque/i, 'the entry text and entry rule must not mention cheque');
  // The Plan 444 comment above the entry host in the page.
  const commentAt = pageSrc.indexOf('Plan 444: pending-clearance flag — shown while');
  const hostAt = pageSrc.indexOf('id="pcfPendingClearanceFlag"');
  assert.ok(commentAt !== -1 && commentAt < hostAt, 'the entry comment must sit above the entry host');
  assert.doesNotMatch(pageSrc.slice(commentAt, hostAt), /cheque/i, 'the entry comment must not mention cheque');
});
