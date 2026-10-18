import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import { setupDailyClosingCard, generateDailyClosingSlipText } from '../dashboard-daily-closing.js';
import { setupY1731Modal } from '../dashboard-y1731-oam.js';
import { setupPseudowireModal } from '../dashboard-pseudowire.js';
import { setupBfdModal } from '../dashboard-bfd.js';
import { setupVplsModal } from '../dashboard-vpls.js';
import { setupCgnatModal } from '../dashboard-cgnat.js';
import { setupOltChassisModal } from '../dashboard-olt-chassis.js';
import { setupSrv6Modal } from '../dashboard-srv6.js';
import { setupOpticalEvmModal } from '../dashboard-optical-evm.js';

function createMockElement(id) {
  const listeners = {};
  return {
    id,
    dataset: {},
    tagName: 'DIV',
    textContent: '',
    innerHTML: '',
    value: '',
    className: '',
    style: {},
    getAttribute(name) { return this.dataset[name.replace(/^data-/, '')] || null; },
    setAttribute(name, val) { this.dataset[name.replace(/^data-/, '')] = String(val); },
    removeAttribute(name) { delete this.dataset[name.replace(/^data-/, '')]; },
    addEventListener(event, handler) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event.type;
      const handlers = listeners[type] || [];
      handlers.forEach(h => h(event));
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    open: false
  };
}

function createMockDocument(elementIds = []) {
  const elements = {};
  elementIds.forEach(id => {
    elements[id] = createMockElement(id);
  });
  return {
    elements,
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = createMockElement(id);
      }
      return elements[id];
    },
    documentElement: {
      getAttribute(name) { return 'light'; }
    }
  };
}

test('setupDailyClosingCard reads live state from getState() at click time (#238)', async () => {
  let state = createInitialState();
  state = addCustomer(state, 'Ali Khan', new Date(), { phone: '03001234567', monthlyRate: 2000 });
  const custId = state.customers[state.customers.length - 1].id;

  const mockDoc = createMockDocument([
    'dashboardDailyClosingValue',
    'dashboardDailyClosingPeriod',
    'dashboardClosingStatusBadge',
    'quickActionDailyClosingSlip',
    'dailyClosingModal'
  ]);

  const oldDoc = globalThis.document;
  globalThis.document = mockDoc;

  let toasted = '';
  let copiedText = '';
  const mockClipboard = {
    async writeText(t) {
      copiedText = t;
    }
  };

  // Wire with getState
  setupDailyClosingCard(state, new Date(), {
    getState: () => state,
    onToast: (msg) => { toasted = msg; },
    clipboard: mockClipboard
  });

  const slipBtn = mockDoc.getElementById('quickActionDailyClosingSlip');
  const modal = mockDoc.getElementById('dailyClosingModal');

  // First click before payment: should have 0 collected
  await slipBtn.click();
  assert.ok(copiedText.includes('Total Collections Today: PKR 0'), 'Should show PKR 0 collections initially');
  assert.ok(toasted.includes('copied to clipboard'));
  assert.equal(modal.open, true);

  // Close modal
  modal.close();
  assert.equal(modal.open, false);

  // Now record payment into state
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonth = todayStr.slice(0, 7);
  state = addPayment(state, custId, currentMonth, { amount: 2000, date: todayStr, method: 'Cash', notes: 'test pay' });

  // Second click: should read updated state via getState() and show PKR 2,000!
  await slipBtn.click();
  assert.ok(copiedText.includes('Total Collections Today: PKR 2,000'), 'Slip must reflect the new payment recorded after initial setup');
  assert.equal(modal.open, true, 'Modal should open for full preview');

  globalThis.document = oldDoc;
});

test('8 diagnostics setup functions wire open button, close button, and modal showModal (#237)', () => {
  const diagConfigs = [
    { fn: setupY1731Modal, openBtn: 'dashboardOpenY1731ModalBtn', modal: 'dashboardY1731Modal', closeBtn: 'dashboardY1731ModalCloseBtn' },
    { fn: setupPseudowireModal, openBtn: 'dashboardOpenPseudowireModalBtn', modal: 'dashboardPseudowireModal', closeBtn: 'dashboardPseudowireModalCloseBtn' },
    { fn: setupBfdModal, openBtn: 'dashboardOpenBfdModalBtn', modal: 'dashboardBfdModal', closeBtn: 'dashboardBfdModalCloseBtn' },
    { fn: setupVplsModal, openBtn: 'dashboardOpenVplsModalBtn', modal: 'dashboardVplsModal', closeBtn: 'dashboardVplsModalCloseBtn' },
    { fn: setupCgnatModal, openBtn: 'dashboardOpenCgnatModalBtn', modal: 'dashboardCgnatModal', closeBtn: 'dashboardCgnatModalCloseBtn' },
    { fn: setupOltChassisModal, openBtn: 'dashboardOpenOltChassisModalBtn', modal: 'dashboardOltChassisModal', closeBtn: 'dashboardOltChassisModalCloseBtn' },
    { fn: setupSrv6Modal, openBtn: 'dashboardOpenSrv6ModalBtn', modal: 'dashboardSrv6Modal', closeBtn: 'dashboardSrv6ModalCloseBtn' },
    { fn: setupOpticalEvmModal, openBtn: 'dashboardOpenOpticalEvmModalBtn', modal: 'dashboardOpticalEvmModal', closeBtn: 'dashboardOpticalEvmModalCloseBtn' },
  ];

  const state = createInitialState();

  for (const cfg of diagConfigs) {
    const mockDoc = createMockDocument([cfg.openBtn, cfg.modal, cfg.closeBtn]);
    const oldDoc = globalThis.document;
    globalThis.document = mockDoc;

    cfg.fn(state, { document: mockDoc });

    const openBtn = mockDoc.getElementById(cfg.openBtn);
    const modal = mockDoc.getElementById(cfg.modal);
    const closeBtn = mockDoc.getElementById(cfg.closeBtn);

    assert.equal(modal.open, false, `${cfg.modal} should start closed`);

    // Click open button
    openBtn.click();
    assert.equal(modal.open, true, `${cfg.openBtn} click should open ${cfg.modal}`);

    // Click close button
    closeBtn.click();
    assert.equal(modal.open, false, `${cfg.closeBtn} click should close ${cfg.modal}`);

    globalThis.document = oldDoc;
  }
});
