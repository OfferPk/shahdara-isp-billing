// Plan 628 — Quick Collect form states the bill month it is
// collecting for.
//
// The QC form never said which bill month the payment was for: the
// only month the form step showed was the prefill subtitle's raw code
// ("Bill 2026-10 (PKR 3,000) · Next: RCPT-..."), which hides whenever
// there is no open bill, the sheet opens with an empty amount, or an
// amount was carried over — and the customer header names only the
// customer + Payable. The profile payment form shows its month
// ("Bill month" select + the Plan 394 live line "This payment will be
// recorded for October 2026."). This file asserts the QC form states
// the bill month next to the amount, in human form, always — and that
// the month shown is the month the save records.
//
// The fix (parent decisions D1/D4): one always-visible line under the
// amount field — "Bill month: October 2026" (UR: "بل کا مہینہ:
// October 2026") — reading the save's own month expression, so shown
// == recorded by construction. When Advance is ticked the line names
// the advance target month the way the Plan 382 confirm summary does
// ("Advance credit for December 2026").
//
// This file is NOT a pinning file: 0 parity literals.
//
// Harness: the Plan 626/627 mock DOM + controller harness (mock elements
// behind getElementById, submit + Plan 382 confirm). Synthetic data only
// — no real customer names, no realistic phone numbers (pattern-fake
// digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations,
  addPayment
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7); // real clock: 2026-11
const OCT = '2026-10';
const NOV = '2026-11';
const DEC = '2026-12';
const JAN27 = '2027-01';

// A customer whose oldest unpaid bill is October 2026: profile created
// 5 Oct 2026, bills generated through that date, so only the October
// bill exists and it is unpaid. The form opens on the real clock
// (November), so the target month is the earliest unpaid month: 2026-10.
function octUnpaidState() {
  const nowOct = new Date('2026-10-05T12:00:00Z');
  let state = createInitialState(['Plan628 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, nowOct);
  state = generateMonthlyBillsThroughCurrentMonth(state, nowOct);
  return state;
}

// The same customer with the October bill paid in full: no open bill,
// so the prefill subtitle hides — but the form still has a target
// month (the current month fallback) and an advance pre-ticked.
function fullyPaidState() {
  let state = octUnpaidState();
  const bill = state.customers[0].bills.find((b) => b.month === OCT);
  assert.ok(bill, 'precondition: the October bill exists');
  state = addPayment(state, 'seed-001', OCT, {
    date: '2026-10-20', amount: bill.dueAmount, method: 'Cash'
  }, new Date('2026-10-20T12:00:00Z'));
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

/** Plan 626/627 mock DOM, as-is. The mock creates any id on demand, so
 *  the FIXED markup's new host (quickCollectBillMonthLine) is readable
 *  through the same getEl — on the base it is never written to, so its
 *  text stays ''. */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      dataset: {},
      _afterSiblings: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of [...(listeners[type] || [])]) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      closest: () => null,
      after: (node) => { el._afterSiblings.push(node); return el; },
      querySelector: (sel) => {
        if (String(sel || '').includes('data-qc-waive-late-fee')) {
          if (!el._waiverCheckbox) el._waiverCheckbox = createMockElement(`${id}-waiver-checkbox`, 'input');
          return el._waiverCheckbox;
        }
        return null;
      },
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
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v ?? ''); el.children.length = 0; el._waiverCheckbox = undefined; }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  getEl('quickCollectDuplicateWarning').hidden = true;
  const form = getEl('quickCollectPaymentForm', 'form');
  form.dispatchEvent = (evt) => form.dispatch(evt.type, evt);
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
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
      onEditCustomer: () => {}
    });
    await fn({ controller, getEl, toasts, getState: () => current });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), OCT), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

const errorToast = (toasts) => toasts.find((t) => t.opts?.type === 'error');

// The bill-month line the fix adds: its host, its visible text.
const monthLine = (getEl) => getEl('quickCollectBillMonthLine');
const monthLineText = (getEl) => {
  const line = monthLine(getEl);
  return line && !line.hidden ? line.textContent : '';
};

test('C1 (source): the QC amount group carries a bill-month line host next to the amount', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  const qc = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  const amountAt = page.indexOf('id="quickCollectAmountInput"');
  const hostAt = page.indexOf('id="quickCollectBillMonthLine"');
  const prefillAt = page.indexOf('id="quickCollectPrefillLine"');
  assert.ok(amountAt !== -1, 'precondition: the amount input exists');
  assert.ok(hostAt !== -1, 'the bill-month line host exists in the QC form markup');
  assert.ok(hostAt > amountAt && hostAt < prefillAt,
    'the host sits next to the amount — after the amount input, before the prefill line');
  assert.ok(qc.includes('quickCollectBillMonthLine'),
    'nav-quick-collect.js renders into the bill-month line host');
});

test('C2: opening the form states the bill month in human form next to the amount', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    const text = monthLineText(getEl);
    assert.ok(text.includes('October 2026'),
      `the line names the target month in human form — got: ${JSON.stringify(text)}`);
    assert.ok(!text.includes('2026-10'),
      `the line never shows the raw YYYY-MM code — got: ${JSON.stringify(text)}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C3: the month shown is the month the save records', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    assert.ok(monthLineText(getEl).includes('October 2026'),
      'precondition: the line names October 2026 before the save');
    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), OCT);
    assert.equal(recorded.length, 1, 'the payment records on the October bill');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C4: picking another month in the month select updates the line', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    assert.ok(monthLineText(getEl).includes('October 2026'), 'precondition: October first');
    getEl('quickCollectMonthSelect').value = NOV;
    await getEl('quickCollectMonthSelect').dispatch('change');
    assert.ok(monthLineText(getEl).includes('November 2026'),
      `the line follows the month select — got: ${JSON.stringify(monthLineText(getEl))}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C5: the line still shows when the prefill subtitle hides (fully-paid customer)', async () => {
  await withController(fullyPaidState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    const prefill = getEl('quickCollectPrefillLine');
    assert.ok(prefill.hidden || prefill.textContent === '',
      'precondition: no open bill, so the prefill subtitle hides');
    // Nothing is due, so Advance is pre-ticked and the money is FOR
    // the advance target month (next month by default): the line
    // names that month — the form still states a month.
    const text = monthLineText(getEl);
    assert.ok(text.includes('December 2026'),
      `the line still states a month with no open bill — got: ${JSON.stringify(text)}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C6: the label reads in Urdu mode', async () => {
  const origStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (k === 'shahdara_language_v1' ? 'ur' : null),
    setItem: () => {}, removeItem: () => {}
  };
  try {
    await withController(octUnpaidState(), async ({ controller, getEl, toasts }) => {
      controller.open('seed-001');
      const text = monthLineText(getEl);
      assert.ok(text.includes('بل کا مہینہ'),
        `the label reads in Urdu mode — got: ${JSON.stringify(text)}`);
      assert.ok(text.includes('October 2026'),
        'the month name itself stays in the app\u2019s English form');
      assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
    });
  } finally {
    if (origStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = origStorage;
  }
});

test('C7: ticking Advance names the advance target month instead', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    assert.ok(monthLineText(getEl).includes('October 2026'), 'precondition: October first');
    getEl('quickCollectAdvanceTargetMonth').value = JAN27;
    getEl('quickCollectAdvanceCheckbox').checked = true;
    await getEl('quickCollectAdvanceCheckbox').dispatch('change');
    await getEl('quickCollectAdvanceTargetMonth').dispatch('change');
    assert.ok(monthLineText(getEl).includes('January 2027'),
      `an advance is FOR its target month — got: ${JSON.stringify(monthLineText(getEl))}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C8: clearing Advance returns the line to the target bill month', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    getEl('quickCollectAdvanceTargetMonth').value = JAN27;
    getEl('quickCollectAdvanceCheckbox').checked = true;
    await getEl('quickCollectAdvanceCheckbox').dispatch('change');
    assert.ok(monthLineText(getEl).includes('January 2027'), 'precondition: advance month showing');
    getEl('quickCollectAdvanceCheckbox').checked = false;
    await getEl('quickCollectAdvanceCheckbox').dispatch('change');
    assert.ok(monthLineText(getEl).includes('October 2026'),
      `clearing Advance restores the bill month — got: ${JSON.stringify(monthLineText(getEl))}`);
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('S1: a plain payment still records on the right bill', async () => {
  await withController(octUnpaidState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), OCT);
    assert.equal(recorded.length, 1, 'the payment records');
    assert.equal(recorded[0].method, 'Cash', 'the recorded method is Cash');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('S2 (source): the prefill subtitle is untouched — the fix adds a line, it does not rewrite it', () => {
  const qc = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  assert.match(qc, /const billPart = `Bill \$\{month\} \(PKR \$\{dues\.toLocaleString\('en-PK'\)\}\)`;/,
    'renderFormSubtitle still renders "Bill YYYY-MM (PKR dues)" as before');
});
