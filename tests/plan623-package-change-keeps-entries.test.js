// Plan 623 — Package-change reopen keeps method, date, reference and
// notes, not just the amount (polish #13 kept only the amount).
// C tests assert the FIXED state (they FAIL on the base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix). B tests are behaviour.
// This file is NOT a pinning file: it contains no parity literals.
// Harness: the polish #13 controller harness (mock DOM + the package
// box's two wired nodes behind its querySelector) plus plan 538's
// stubbed Image/FileReader/canvas so the screenshot picker runs its
// real compression pipeline in Node. Synthetic data only — no real
// customer names, no realistic phone numbers (pattern-fake digits
// only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, addCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const FAKE_PROOF_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';
const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find((c) => c.id === id)?.bills?.find((b) => b.month === month);

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function plan623State(now) {
  let state = createInitialState(['Plan623 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, MONTH).dueAmount), 1000, 'precondition: current bill at the old package');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', MONTH)?.balanceDueCents, 100000, 'precondition: 1,000 still due');
  return state;
}

/** One synthetic FREE-connection customer (bill skipped on a package change). */
function plan623FreeState(now) {
  let state = addCustomer(createInitialState([]), 'Plan623 Free Tester', now, { isFreeConnection: true });
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(state.customers[0].bills.length, 0, 'precondition: a free connection gets no bill');
  return { state, id };
}

/**
 * Plan 623 controller harness: the polish #13 mock DOM, extended with
 * (a) the package box's two wired nodes, (b) stubbed Image, FileReader
 * and canvas so the screenshot picker runs its real compression
 * pipeline, (c) a null localStorage so no open path reads a real one.
 */
function plan623Controller(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
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
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v ?? ''); }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  // The package box gets a working select + apply button behind its
  // querySelector, exactly the two nodes renderPackageBox wires.
  const pkgSelect = createMockElement('quickCollectPackageSelect', 'select');
  const pkgApply = createMockElement('', 'button');
  pkgApply.disabled = true;
  const packageBox = getEl('quickCollectPackageBox');
  packageBox.querySelector = (sel) =>
    sel === '#quickCollectPackageSelect' ? pkgSelect : sel === '[data-qc-change-package]' ? pkgApply : null;

  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
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
    getEl, pkgSelect, pkgApply, packageBox, toasts, controller,
    get state() { return state; },
    async restore() {
      await new Promise((resolve) => setTimeout(resolve, 130));
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

/** Type the acceptance entries into the open form (method + date + TID + sender + notes + split + screenshot). */
async function typeAcceptanceEntries(h) {
  const yesterday = yesterdayPk();
  h.getEl('quickCollectAmountInput').value = '2500';
  h.getEl('quickCollectMethodSelect').value = 'Easypaisa';
  h.getEl('quickCollectDateInput').value = yesterday;
  h.getEl('quickCollectTransactionIdInput').value = 'TID-623-TEST-001';
  h.getEl('quickCollectSenderNameInput').value = 'Test Sender';
  h.getEl('quickCollectSenderDigitsInput').value = '5678';
  h.getEl('quickCollectOverrideReasonInput').value = 'Test override reason';
  h.getEl('quickCollectPaidByInput').value = 'Test Payer';
  h.getEl('quickCollectCollectedByInput').value = 'Test Collector';
  h.getEl('quickCollectUrduNoteInput').value = 'Test note';
  h.getEl('quickCollectSplitToggle').checked = true;
  h.getEl('quickCollectSplitAmountInput').value = '400.00';
  h.getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
  h.getEl('quickCollectSplitTransactionIdInput').value = 'TID-623-LEG2-001';
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

/** Assert every typed entry is intact after a package-change reopen. */
function assertEntriesIntact(h, yesterday) {
  assert.equal(h.getEl('quickCollectMethodSelect').value, 'Easypaisa', 'method survives');
  assert.equal(h.getEl('quickCollectDateInput').value, yesterday, 'date survives');
  assert.equal(h.getEl('quickCollectTransactionIdInput').value, 'TID-623-TEST-001', 'TID survives');
  assert.equal(h.getEl('quickCollectSenderNameInput').value, 'Test Sender', 'sender name survives');
  assert.equal(h.getEl('quickCollectSenderDigitsInput').value, '5678', 'sender digits survive');
  assert.equal(h.getEl('quickCollectOverrideReasonInput').value, 'Test override reason', 'override reason survives');
  assert.equal(h.getEl('quickCollectPaidByInput').value, 'Test Payer', 'paid-by survives');
  assert.equal(h.getEl('quickCollectCollectedByInput').value, 'Test Collector', 'collected-by survives');
  assert.equal(h.getEl('quickCollectUrduNoteInput').value, 'Test note', 'note survives');
  assert.equal(h.getEl('quickCollectSplitToggle').checked, true, 'split toggle survives');
  assert.equal(h.getEl('quickCollectSplitAmountInput').value, '400.00', 'leg-2 amount survives');
  assert.equal(h.getEl('quickCollectSplitMethodSelect').value, 'Easypaisa', 'leg-2 method survives');
  assert.equal(h.getEl('quickCollectSplitTransactionIdInput').value, 'TID-623-LEG2-001', 'leg-2 TID survives');
  assert.equal(h.getEl('quickCollectSplitOverrideReasonInput').value, 'Leg2 override reason', 'leg-2 override reason survives');
  assert.equal(h.getEl('quickCollectSplitSenderNameInput').value, 'Leg2 Sender', 'leg-2 sender name survives');
  assert.equal(h.getEl('quickCollectSplitSenderDigitsInput').value, '1234', 'leg-2 sender digits survive');
  assert.equal(h.getEl('quickCollectScreenshotPreview').src, FAKE_PROOF_DATA_URL, 'screenshot survives');
  assert.equal(h.getEl('quickCollectScreenshotPreviewWrap').hidden, false, 'screenshot preview still shown');
  assert.equal(h.getEl('quickCollectDigitalFields').hidden, false, 'digital fields visible for the restored Easypaisa method');
  assert.equal(h.getEl('quickCollectSplitFields').hidden, false, 'split fields visible for the restored split');
}

/** Pick the 2,000 package and tap Apply. */
async function changePackageTo2000(h) {
  h.pkgSelect.value = '5mbps-200gb';
  await h.pkgSelect.dispatch('change');
  assert.equal(h.pkgApply.disabled, false, 'precondition: apply arms once a different package is picked');
  await h.pkgApply.click();
}

test('C1: method, date, reference, sender, notes, split leg 2 and screenshot survive the package-change reopen (amount stays 2500)', async () => {
  const h = plan623Controller(plan623State(new Date()));
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000', 'precondition: amount starts at the full dues');
    const yesterday = await typeAcceptanceEntries(h);
    await changePackageTo2000(h);
    assert.equal(Number(billOf(h.state, MONTH).dueAmount), 2000, 'bill repriced via the host save');
    assert.equal(h.getEl('quickCollectAmountInput').value, '2500', 'polish #13: the typed amount still survives');
    assertEntriesIntact(h, yesterday);
  } finally { await h.restore(); }
});

test('C2: Undo after the package change restores the same entries (and the typed amount)', async () => {
  const h = plan623Controller(plan623State(new Date()));
  try {
    h.controller.open('seed-001');
    const yesterday = await typeAcceptanceEntries(h);
    await changePackageTo2000(h);
    const undo = h.toasts.find((t) => typeof t.opts?.onAction === 'function');
    assert.ok(undo, 'precondition: the change toast carries the Undo action');
    undo.opts.onAction();
    assert.equal(Number(billOf(h.state, MONTH).dueAmount), 1000, 'undo restored the old bill');
    assert.equal(h.state.customers[0].packageSpeed, '3Mbps / 100GB', 'undo restored the old package');
    assert.equal(h.getEl('quickCollectAmountInput').value, '2500', 'polish #13: undo restores the typed amount');
    assertEntriesIntact(h, yesterday);
  } finally { await h.restore(); }
});

test('C3: the package-change handler reuses the concession capture/restore pair', () => {
  const src = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  const start = src.indexOf('function renderPackageBox(customerId)');
  assert.ok(start >= 0, 'renderPackageBox exists');
  const end = src.indexOf('function captureBackToPickDraft()', start);
  assert.ok(end > start, 'renderPackageBox region found');
  const body = src.slice(start, end);
  assert.ok(body.includes('captureConcessionFormEntries()'), 'the Apply handler never captures the form entries');
  assert.ok(body.includes('restoreConcessionFormEntries('), 'the Apply handler never restores the form entries');
});

test('C4: the notes survive a package-change reopen even when the amount override is empty (free connection, bill skipped)', async () => {
  const { state: freeState, id } = plan623FreeState(new Date());
  const h = plan623Controller(freeState);
  try {
    h.controller.open(id);
    h.getEl('quickCollectCollectedByInput').value = 'Test Collector';
    h.getEl('quickCollectUrduNoteInput').value = 'Test note';
    await changePackageTo2000(h);
    assert.equal(h.getEl('quickCollectCollectedByInput').value, 'Test Collector', 'collected-by survives the skipped-bill reopen');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, 'Test note', 'note survives the skipped-bill reopen');
  } finally { await h.restore(); }
});

test('S1: an untouched field follows the new bill — open, change package without typing, amount lands at the new dues', async () => {
  const h = plan623Controller(plan623State(new Date()));
  try {
    h.controller.open('seed-001');
    const today = getPakistanLocalDate(new Date());
    await changePackageTo2000(h);
    assert.equal(h.getEl('quickCollectAmountInput').value, '2000', 'untouched amount follows the new bill');
    assert.equal(h.getEl('quickCollectMethodSelect').value, '', 'untouched method stays at the remembered default (none)');
    assert.equal(h.getEl('quickCollectDateInput').value, today, 'untouched date stays at today');
  } finally { await h.restore(); }
});

test('S2: a normal customer pick still defaults to full dues', async () => {
  const h = plan623Controller(plan623State(new Date()));
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000', 'fresh open prefills the full dues');
  } finally { await h.restore(); }
});

test('B1: the package-change wiring is unchanged', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(page.includes('id="quickCollectPackageBox"'), 'package box host div exists');
  const qc = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  assert.ok(qc.includes('renderPackageBox(customerId)'), 'form render calls the package box');
  assert.ok(qc.includes('data-qc-change-package'), 'apply button hook present');
  assert.ok(qc.includes('export function packageChangeAmountOptions'), 'amount-options helper exported');
});
