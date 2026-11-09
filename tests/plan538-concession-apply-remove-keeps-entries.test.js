/**
 * plan538-concession-apply-remove-keeps-entries.test.js — Plan 538 of the
 * Plans 491–600 polish programme (record-payment batch, 521–550).
 *
 * The operator's case: the concession Apply and Remove handlers in
 * renderConcessionBox both reopen the form with
 * openCustomerCollectionForm(customerId) and afterwards restore ONLY the
 * amount field (to the post-concession net balance). Everything else the
 * operator had typed — method, date, Transaction ID, sender name/digits,
 * paid-by and notes, split leg 2, screenshot — was reset to defaults.
 * This is the same *class* of wipe as merged polish #13, but #13 covers
 * only the package-change reopen; the concession reopen is a separate
 * handler with its own reopen call, so it is a genuinely different item.
 *
 * Pins:
 *  - Apply: method Easypaisa + TID + sender + paid-by + note + a past
 *    date + split leg 2 + an attached screenshot all survive the
 *    reopen, and the amount lands at the net due (dues 1,000 −
 *    concession 100 = 900);
 *  - Remove: removing the concession likewise preserves the entries,
 *    and the amount returns to the full dues (1,000);
 *  - an untouched form reopens on its defaults after Apply/Remove —
 *    the restore invents nothing;
 *  - the concession computation is unchanged: Apply stamps exactly
 *    the suggestion (100) and never rewrites the bill's own amount;
 *  - wiring: both handlers capture before the reopen and restore
 *    after it; openCustomerCollectionForm's normal-open defaults
 *    (digital fields / split / screenshot reset) are untouched —
 *    the restore is what brings entries back, not a change to the
 *    defaults.
 *
 * Harness: the polish #13 controller harness (mock DOM + mock
 * localStorage seeded with one 72h outage complaint), plus a
 * concession box whose innerHTML rebuilds real Apply/Remove button
 * mocks (the real DOM destroys them on every innerHTML write, so a
 * stale button must never collect a second listener) and stubbed
 * Image/FileReader/canvas so the screenshot picker runs its real
 * compression pipeline in Node. Synthetic data only — no real
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
import { COMPLAINTS_KEY } from '../complaint-register.js';

const FAKE_PROOF_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function plan538State(now, month) {
  let state = createInitialState(['Plan538 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month).dueAmount), 1000, 'precondition: current bill at the old package');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents, 100000, 'precondition: 1,000 still due');
  return state;
}

/**
 * Plan 538 controller harness: the polish #13 mock DOM, extended with
 * (a) a mock localStorage seeded with one 72h outage complaint in the
 * bill's month, so the concession box renders an eligible suggestion
 * (72h >= 12h threshold; suggested = round((1,000 / 720) * 72) = 100);
 * (b) a concession box whose innerHTML write rebuilds the Apply/Remove
 * button mocks, like the real DOM; (c) stubbed Image, FileReader and
 * canvas, so the screenshot picker runs its real compression pipeline.
 */
function plan538Controller(initialState, month) {
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

  // The concession box: innerHTML writes rebuild the button mocks,
  // exactly like the real DOM destroying the old nodes on re-render.
  const concessionBox = getEl('quickCollectConcessionBox');
  let boxHtml = '';
  let applyBtn = createMockElement('', 'button');
  let removeBtn = createMockElement('', 'button');
  Object.defineProperty(concessionBox, 'innerHTML', {
    get: () => boxHtml,
    set: (v) => {
      boxHtml = String(v ?? '');
      applyBtn = createMockElement('', 'button');
      removeBtn = createMockElement('', 'button');
    }
  });
  concessionBox.querySelector = (sel) => {
    if (sel === '[data-qc-apply-concession]') return boxHtml.includes('data-qc-apply-concession') ? applyBtn : null;
    if (sel === '[data-qc-remove-concession]') return boxHtml.includes('data-qc-remove-concession') ? removeBtn : null;
    return null;
  };
  concessionBox.querySelectorAll = () => [];

  const complaint = {
    id: 'CMP-538', customerId: 'seed-001', customerName: 'Plan538 Tester',
    zone: 'Shahdara Town', issueCategory: 'Fiber Cut',
    reportedAt: `${month}-05T10:00`, resolvedAt: `${month}-05T14:00`,
    downtimeHours: 72, downtimeManual: false, status: 'Resolved',
    resolutionNote: '', createdAt: ''
  };
  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (key === COMPLAINTS_KEY ? JSON.stringify([complaint]) : null),
    setItem: () => {},
    removeItem: () => {}
  };

  // Stubbed browser image APIs so the screenshot picker runs its real
  // compression pipeline (decode -> canvas -> JPEG data URL) in Node.
  class StubImage {
    constructor() { this.width = 800; this.height = 600; }
    set src(_value) { setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0); }
  }
  class StubFileReader {
    readAsDataURL(_blob) {
      this.result = FAKE_PROOF_DATA_URL;
      setTimeout(() => { if (typeof this.onload === 'function') this.onload(); }, 0);
    }
  }
  const origImage = globalThis.Image;
  const origFileReader = globalThis.FileReader;
  globalThis.Image = StubImage;
  globalThis.FileReader = StubFileReader;

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = createMockElement('', tag);
      if (tag === 'canvas') {
        el.getContext = () => ({ drawImage: () => {} });
        el.toBlob = (cb) => cb(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
      }
      return el;
    },
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
    applyBtn: () => concessionBox.querySelector('[data-qc-apply-concession]'),
    removeBtn: () => concessionBox.querySelector('[data-qc-remove-concession]'),
    boxHtml: () => concessionBox.innerHTML,
    get state() { return state; },
    restore() {
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
      globalThis.Image = origImage;
      globalThis.FileReader = origFileReader;
    }
  };
}

/** Yesterday in PKT — a date the operator could have picked, proving the restore. */
function yesterdayPk() {
  return getPakistanLocalDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

/** Type the acceptance entries into the open form (method + TID + note + split + screenshot). */
async function typeAcceptanceEntries(h) {
  const yesterday = yesterdayPk();
  h.getEl('quickCollectMethodSelect').value = 'Easypaisa';
  h.getEl('quickCollectDateInput').value = yesterday;
  h.getEl('quickCollectTransactionIdInput').value = 'TID-538-TEST-001';
  h.getEl('quickCollectSenderNameInput').value = 'Test Sender';
  h.getEl('quickCollectSenderDigitsInput').value = '5678';
  h.getEl('quickCollectOverrideReasonInput').value = 'Test override reason';
  h.getEl('quickCollectPaidByInput').value = 'Test Payer';
  h.getEl('quickCollectUrduNoteInput').value = 'Test note';
  h.getEl('quickCollectSplitToggle').checked = true;
  h.getEl('quickCollectSplitAmountInput').value = '400.00';
  h.getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
  h.getEl('quickCollectSplitTransactionIdInput').value = 'TID-538-LEG2-001';
  h.getEl('quickCollectSplitOverrideReasonInput').value = 'Leg2 override reason';
  h.getEl('quickCollectSplitSenderNameInput').value = 'Leg2 Sender';
  h.getEl('quickCollectSplitSenderDigitsInput').value = '1234';
  const shot = h.getEl('quickCollectScreenshotInput');
  shot.files = [new Blob(['fake-proof'], { type: 'image/jpeg' })];
  await shot.dispatch('change');
  assert.equal(h.getEl('quickCollectScreenshotPreview').src, FAKE_PROOF_DATA_URL, 'precondition: screenshot attached via the real picker');
  assert.equal(h.getEl('quickCollectScreenshotPreviewWrap').hidden, false, 'precondition: screenshot preview shown');
  return yesterday;
}

/** Assert every typed entry is intact after a concession reopen. */
function assertEntriesIntact(h, yesterday) {
  assert.equal(h.getEl('quickCollectMethodSelect').value, 'Easypaisa', 'method survives');
  assert.equal(h.getEl('quickCollectDateInput').value, yesterday, 'date survives');
  assert.equal(h.getEl('quickCollectTransactionIdInput').value, 'TID-538-TEST-001', 'TID survives');
  assert.equal(h.getEl('quickCollectSenderNameInput').value, 'Test Sender', 'sender name survives');
  assert.equal(h.getEl('quickCollectSenderDigitsInput').value, '5678', 'sender digits survive');
  assert.equal(h.getEl('quickCollectOverrideReasonInput').value, 'Test override reason', 'override reason survives');
  assert.equal(h.getEl('quickCollectPaidByInput').value, 'Test Payer', 'paid-by survives');
  assert.equal(h.getEl('quickCollectUrduNoteInput').value, 'Test note', 'note survives');
  assert.equal(h.getEl('quickCollectSplitToggle').checked, true, 'split toggle survives');
  assert.equal(h.getEl('quickCollectSplitAmountInput').value, '400.00', 'leg-2 amount survives');
  assert.equal(h.getEl('quickCollectSplitMethodSelect').value, 'Easypaisa', 'leg-2 method survives');
  assert.equal(h.getEl('quickCollectSplitTransactionIdInput').value, 'TID-538-LEG2-001', 'leg-2 TID survives');
  assert.equal(h.getEl('quickCollectSplitOverrideReasonInput').value, 'Leg2 override reason', 'leg-2 override reason survives');
  assert.equal(h.getEl('quickCollectSplitSenderNameInput').value, 'Leg2 Sender', 'leg-2 sender name survives');
  assert.equal(h.getEl('quickCollectSplitSenderDigitsInput').value, '1234', 'leg-2 sender digits survive');
  assert.equal(h.getEl('quickCollectScreenshotPreview').src, FAKE_PROOF_DATA_URL, 'screenshot survives');
  assert.equal(h.getEl('quickCollectScreenshotPreviewWrap').hidden, false, 'screenshot preview still shown');
  assert.equal(h.getEl('quickCollectDigitalFields').hidden, false, 'digital fields visible for the restored Easypaisa method');
  assert.equal(h.getEl('quickCollectSplitFields').hidden, false, 'split fields visible for the restored split');
}

test('plan 538 acceptance (apply): entries survive the concession reopen, amount lands at the net due', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan538Controller(plan538State(now, month), month);
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'amount starts at the full dues');
    assert.ok(h.applyBtn(), 'precondition: Apply button rendered for the eligible suggestion');

    const yesterday = await typeAcceptanceEntries(h);
    await h.applyBtn().click();

    // The concession itself: exactly the suggestion, bill untouched.
    assert.equal(Number(billOf(h.state, month).concessionAmount), 100, 'concession stamped at the suggested 100');
    assert.equal(Number(billOf(h.state, month).dueAmount), 1000, 'bill amount never rewritten');
    assert.equal(h.getEl('quickCollectAmountInput').value, '900.00', 'amount at the net due (1,000 − 100)');
    assert.ok(h.boxHtml().includes('Net due: PKR 900'), 'box shows the same net due — the display and the amount agree');
    assertEntriesIntact(h, yesterday);
    assert.ok(h.removeBtn(), 'box now offers Remove for the applied concession');
    assert.ok(h.toasts.some(t => t.msg.includes('PKR 100 applied')), 'success toast names the concession');
    assert.equal(h.toasts.filter(t => typeof t.msg === 'string' && /error|couldn/i.test(t.msg)).length, 0, 'no error toast');
  } finally {
    h.restore();
  }
});

test('plan 538 acceptance (remove): removing the concession likewise preserves the entries, amount returns to full dues', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan538Controller(plan538State(now, month), month);
  try {
    h.controller.open('seed-001');
    const yesterday = await typeAcceptanceEntries(h);
    await h.applyBtn().click();
    assert.equal(h.getEl('quickCollectAmountInput').value, '900.00', 'precondition: concession applied');

    // The operator re-types nothing between Apply and Remove — the
    // entries Apply restored are the ones Remove must keep.
    await h.removeBtn().click();

    assert.equal(Number(billOf(h.state, month).concessionAmount || 0), 0, 'concession cleared');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'amount back to the full dues');
    assertEntriesIntact(h, yesterday);
    assert.ok(h.applyBtn(), 'box offers Apply again once the concession is gone');
    assert.ok(h.toasts.some(t => t.msg.includes('concession removed')), 'remove toast shown');
  } finally {
    h.restore();
  }
});

test('plan 538: an untouched form reopens on its defaults after Apply/Remove — the restore invents nothing', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan538Controller(plan538State(now, month), month);
  try {
    h.controller.open('seed-001');
    await h.applyBtn().click();
    assert.equal(h.getEl('quickCollectAmountInput').value, '900.00', 'amount at the net due');
    assert.equal(h.getEl('quickCollectMethodSelect').value, '', 'no method invented (no past payment remembers one)');
    assert.equal(h.getEl('quickCollectTransactionIdInput').value, '', 'no TID invented');
    assert.equal(h.getEl('quickCollectSplitToggle').checked, false, 'split stays off');
    assert.equal(h.getEl('quickCollectScreenshotPreview').src, '', 'no screenshot invented');

    await h.removeBtn().click();
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000.00', 'amount back to the full dues');
    assert.equal(h.getEl('quickCollectMethodSelect').value, '', 'still no method invented');
    assert.equal(h.getEl('quickCollectSplitToggle').checked, false, 'split still off');
  } finally {
    h.restore();
  }
});

test('plan 538: the concession itself is unchanged — Apply stamps exactly the suggestion, never rewrites the bill', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan538Controller(plan538State(now, month), month);
  try {
    h.controller.open('seed-001');
    await h.applyBtn().click();
    const bill = billOf(h.state, month);
    assert.equal(Number(bill.concessionAmount), 100, 'stamped amount is the suggestion (round((1,000 / 720) * 72))');
    assert.equal(bill.concessionReason, 'Outage Reaayat: 72h offline', 'reason names the logged downtime');
    assert.equal(Number(bill.dueAmount), 1000, 'due amount untouched by the concession');
    assert.equal(calculatePaymentAllocations(h.state).forMonth('seed-001', month)?.balanceDueCents, 90000, 'balance due is the net figure');
  } finally {
    h.restore();
  }
});

test('plan 538 wiring: both handlers capture before the reopen and restore after it; normal-open defaults untouched', () => {
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('function captureConcessionFormEntries()'), 'capture helper exists');
  assert.ok(qc.includes('function restoreConcessionFormEntries(entries)'), 'restore helper exists');
  const applyIdx = qc.indexOf("querySelector('[data-qc-apply-concession]')");
  const removeIdx = qc.indexOf("querySelector('[data-qc-remove-concession]')");
  assert.ok(applyIdx > 0 && removeIdx > 0, 'both handlers present');
  const applyBlock = qc.slice(applyIdx, applyIdx + 4000);
  assert.ok(applyBlock.includes('captureConcessionFormEntries()'), 'Apply captures before the reopen');
  assert.ok(applyBlock.indexOf('restoreConcessionFormEntries(') > applyBlock.indexOf('openCustomerCollectionForm(customerId)'), 'Apply restores after the reopen');
  const removeBlock = qc.slice(removeIdx, removeIdx + 2500);
  assert.ok(removeBlock.includes('captureConcessionFormEntries()'), 'Remove captures before the reopen');
  assert.ok(removeBlock.indexOf('restoreConcessionFormEntries(') > removeBlock.indexOf('openCustomerCollectionForm(customerId)'), 'Remove restores after the reopen');
  // The open function's own defaults are untouched: a fresh open still
  // resets the digital fields, the split and the screenshot — the
  // restore is what brings entries back, not a change to the defaults.
  assert.ok(qc.includes("if (transactionIdInput) transactionIdInput.value = '';"), 'fresh open still clears the TID');
  assert.ok(qc.includes("if (splitToggle) splitToggle.checked = false;"), 'fresh open still turns the split off');
  assert.ok(qc.includes("currentScreenshotDataUrl = '';"), 'fresh open still clears the screenshot');
  assert.ok(qc.includes('function renderConcessionBox(customerId, month)'), 'concession box renderer intact');
});
