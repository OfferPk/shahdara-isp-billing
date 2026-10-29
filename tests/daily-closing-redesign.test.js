// Daily Closing dialog redesign (owner request, 2026-10-29): PRESENTATION
// ONLY. The tall sticky footer bar of six full-width buttons is gone; the
// same six actions now live in a compact 2-column icon+label card grid at
// the top of the dialog, the date controls sit on one compact row with the
// target chip inline, and the only footer-ish element left is a slim
// non-sticky Close at the natural end of the body. These tests pin the new
// structure, the token-only CSS, the unchanged handler wiring (same ids ->
// same controller functions), and the live behaviour of every action via a
// mock-DOM run of the real controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setupDailyClosingModal, formatDateYmd } from '../dashboard-daily-closing.js';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const closingSrc = readFileSync(new URL('../dashboard-daily-closing.js', import.meta.url), 'utf8');
const staffSrc = readFileSync(new URL('../dashboard-staff-performance.js', import.meta.url), 'utf8');

const ACTION_IDS = ['dcCopySlipBtn', 'dcShareWhatsAppBtn', 'dcPrintA4Btn', 'dcPrintPosBtn', 'dcExportCsvBtn', 'openStaffPerfFromClosingBtn'];

function dialogSlice() {
  const start = html.indexOf('id="dailyClosingModal"');
  assert.ok(start > -1, 'daily closing dialog exists');
  const end = html.indexOf('</dialog>', start);
  assert.ok(end > start, 'dialog closes');
  return html.slice(start, end);
}

test('redesign: six actions live in a 2-column card grid at the top of the dialog body', () => {
  const slice = dialogSlice();
  const gridAt = slice.indexOf('class="daily-closing-actions"');
  assert.ok(gridAt > -1, 'actions grid container present');
  const kpiAt = slice.indexOf('daily-closing-kpi-grid');
  assert.ok(kpiAt > gridAt, 'actions grid sits above the KPI figures (no scrolling past figures to reach actions)');
  for (const id of ACTION_IDS) {
    const at = slice.indexOf(`id="${id}"`);
    assert.ok(at > gridAt && at < kpiAt, `${id} is inside the actions grid`);
    const btnTag = slice.slice(slice.lastIndexOf('<button', at), slice.indexOf('>', at));
    assert.ok(btnTag.includes('dc-action-btn'), `${id} carries the action-card class`);
  }
  for (const label of ['Copy Daily Slip', 'WhatsApp Briefing', 'Print A4 Statement', 'Thermal 80mm Slip', 'Export CSV (RFC-4180)', 'Staff Performance']) {
    assert.ok(slice.includes(`<span class="dc-action-label">${label}</span>`), `label kept verbatim: ${label}`);
  }
  assert.equal((slice.match(/<span class="dc-action-icon /g) || []).length, 6, 'every action card has an icon tile');
});

test('redesign: no sticky footer bar remains; slim non-sticky Close at the natural end', () => {
  const slice = dialogSlice();
  assert.ok(!slice.includes('<footer'), 'dialog has no <footer> element anymore');
  assert.ok(!slice.includes('billing-modal-footer'), 'dialog no longer uses the shared sticky footer bar');
  assert.ok(!css.includes('.daily-closing-modal .billing-modal-footer'), 'dead footer CSS for this dialog removed');
  const closeAt = slice.indexOf('id="closeDailyClosingSecondaryBtn"');
  assert.ok(closeAt > -1, 'secondary close kept (same id, same handler)');
  assert.ok(closeAt > slice.indexOf('id="dailyClosingReceiptsTableBody"'), 'close sits at the natural end, after the receipts ledger');
  const closeTag = slice.slice(slice.lastIndexOf('<button', closeAt), slice.indexOf('>', closeAt));
  assert.ok(closeTag.includes('daily-closing-close-btn'), 'close is the slim text button, not the giant primary bar');
  assert.ok(slice.includes('id="closeDailyClosingModalBtn"'), 'header ↩ close kept');
});

test('redesign: date controls on one compact row with the target chip inline', () => {
  const slice = dialogSlice();
  const toolbarAt = slice.indexOf('class="daily-closing-toolbar"');
  const gridAt = slice.indexOf('class="daily-closing-actions"');
  assert.ok(toolbarAt > -1 && gridAt > toolbarAt, 'toolbar directly above the actions grid');
  const toolbar = slice.slice(toolbarAt, gridAt);
  for (const id of ['dailyClosingPrevDateBtn', 'dailyClosingDateInput', 'dailyClosingNextDateBtn', 'dailyClosingTodayDateBtn', 'dcKpiAttainment']) {
    assert.ok(toolbar.includes(`id="${id}"`), `${id} stays in the toolbar`);
  }
  assert.ok(toolbar.includes('class="daily-closing-date-nav"'), 'date controls grouped in the compact nav row');
  assert.ok(toolbar.includes('◀ Prev'), 'Prev label shortened, meaning intact');
  assert.ok(toolbar.includes('Next ▶'), 'Next label shortened, meaning intact');
});

test('redesign: CSS is a token-only 2-column grid with a dark-mode rule and no sticky positioning', () => {
  const start = css.indexOf('Daily Closing redesign');
  assert.ok(start > -1, 'redesign block present in styles.css');
  const block = css.slice(start, css.indexOf('.daily-closing-kpi-grid', start));
  assert.ok(block.includes('.daily-closing-actions {'), 'actions grid rule');
  assert.ok(block.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'exactly 2 columns');
  assert.ok(block.includes('.dc-action-btn {'), 'action card rule');
  assert.ok(block.includes('background: var(--surface-soft)'), 'card surface from token');
  assert.ok(block.includes('border: 1px solid var(--line)'), 'card border from token');
  assert.ok(block.includes('border-radius: var(--radius-md)'), 'card radius from token');
  assert.ok(block.includes('.dc-action-icon {'), 'icon tile rule');
  assert.ok(block.includes('[data-theme="dark"] .daily-closing-modal .dc-action-btn'), 'dark-mode rule present');
  assert.ok(!/position:\s*sticky/.test(block), 'nothing sticky in the redesigned dialog chrome');
  const noComments = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const hexes = noComments.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  assert.deepEqual(hexes, [], `no hard-coded hex in the redesign block (found ${hexes})`);
  assert.ok(/\.daily-closing-toolbar \.dc-date-label \{\s*display: none;/.test(css), 'phone strip hides the text label (aria-label remains)');
});

test('redesign: every action stays bound to the same controller handler', () => {
  for (const [id, varName] of [['dcCopySlipBtn', 'copySlipBtn'], ['dcShareWhatsAppBtn', 'shareWhatsAppBtn'], ['dcPrintA4Btn', 'printA4Btn'], ['dcPrintPosBtn', 'printPosBtn'], ['dcExportCsvBtn', 'exportCsvBtn']]) {
    assert.ok(closingSrc.includes(`getElementById('${id}')`), `${id} still looked up by the closing controller`);
    assert.ok(closingSrc.includes(`${varName}.addEventListener('click'`), `${id} still click-wired in the closing controller`);
  }
  for (const [id, varName] of [['dailyClosingPrevDateBtn', 'prevDateBtn'], ['dailyClosingNextDateBtn', 'nextDateBtn'], ['dailyClosingTodayDateBtn', 'todayDateBtn'], ['closeDailyClosingModalBtn', 'closeBtn'], ['closeDailyClosingSecondaryBtn', 'closeSecondaryBtn']]) {
    assert.ok(closingSrc.includes(`getElementById('${id}')`), `${id} still looked up`);
    assert.ok(closingSrc.includes(`${varName}.addEventListener('click'`), `${id} still click-wired`);
  }
  assert.ok(staffSrc.includes(`getElementById('openStaffPerfFromClosingBtn')`), 'staff button still looked up by the staff controller');
  assert.ok(staffSrc.includes(`openFromClosingBtn.addEventListener('click'`), 'staff button still opens the staff controller');
  assert.ok(staffSrc.includes(`querySelector('.dc-action-label')`), 'staff label sync writes into the card label span');
});

test('redesign: mock-DOM run — all six actions + date nav + closes behave exactly as before', async () => {
  const todayStr = formatDateYmd(new Date());
  const month = todayStr.slice(0, 7);
  let state = createInitialState(['Redesign Cust A']);
  state = saveBillMonth(state, state.customers[0].id, { month, dueAmount: '3000', status: 'pending' }, new Date());
  state = addPayment(state, state.customers[0].id, month, { amount: '3000', date: todayStr, method: 'Cash', paidBy: 'Direct' }, new Date());

  // Mock DOM (pattern follows tests/daily-closing-polish.test.js)
  const registry = new Map();
  function createMockElement(id, tag = 'div') {
    const listeners = {};
    const attrs = {};
    const el = {
      id,
      tagName: tag.toUpperCase(),
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      hidden: false,
      options: [],
      children: [],
      getAttribute: (n) => attrs[n] || null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      showModal: () => { el.opened = true; },
      close: () => { el.closedCount = (el.closedCount || 0) + 1; },
      opened: false,
      closedCount: 0
    };
    return el;
  }
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };

  const openCalls = [];
  const printWrites = [];
  let copiedText = '';
  let csvAnchor = null;
  const fakePrintWin = () => ({
    document: { open() {}, write(h) { printWrites.push(h); }, close() {} },
    focus() {},
    print() {}
  });

  const origDocument = globalThis.document;
  const origWindow = globalThis.window;
  const origNavigator = globalThis.navigator;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = createMockElement('', tag);
      if (tag === 'a') csvAnchor = el;
      return el;
    },
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  Object.defineProperty(globalThis, 'window', {
    value: { open: (url) => { openCalls.push(url); return url === '' ? fakePrintWin() : null; } },
    configurable: true
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: { writeText: async (t) => { copiedText = t; } } },
    configurable: true
  });

  try {
    const toasts = [];
    const controller = setupDailyClosingModal(() => state, { onToast: (m) => toasts.push(m) });
    assert.ok(controller, 'controller created');
    controller.open();
    assert.equal(getEl('dailyClosingModal').opened, true, 'modal opens');

    // Date navigation: prev -> yesterday, next -> back to today, today -> today
    const dateInput = getEl('dailyClosingDateInput');
    assert.equal(dateInput.value, todayStr, 'opens on today');
    await getEl('dailyClosingPrevDateBtn').click();
    const y = new Date(`${todayStr}T12:00:00+05:00`);
    y.setDate(y.getDate() - 1);
    assert.equal(dateInput.value, formatDateYmd(y), 'Prev moves one day back');
    await getEl('dailyClosingNextDateBtn').click();
    assert.equal(dateInput.value, todayStr, 'Next returns to today');
    await getEl('dailyClosingTodayDateBtn').click();
    assert.equal(dateInput.value, todayStr, 'Today pins today');

    // 1) Copy Daily Slip -> clipboard receives the real slip text
    await getEl('dcCopySlipBtn').click();
    assert.ok(copiedText.includes('DAILY REGISTER CLOSING'), 'copy slip handler produced the closing slip');
    assert.ok(toasts.includes('Daily closing slip copied to clipboard!'), 'copy toast fired');

    // 2) WhatsApp Briefing -> wa.me draft opened
    await getEl('dcShareWhatsAppBtn').click();
    assert.ok(openCalls.some((u) => typeof u === 'string' && u.startsWith('https://wa.me/?text=')), 'WhatsApp handler opened the wa.me draft');

    // 3) Print A4 -> A4 statement written to the print window
    printWrites.length = 0;
    await getEl('dcPrintA4Btn').click();
    assert.ok(printWrites.some((h) => h.includes('A4 Register Closing Statement')), 'A4 handler produced the A4 statement');

    // 4) Thermal 80mm -> POS slip written
    printWrites.length = 0;
    await getEl('dcPrintPosBtn').click();
    assert.ok(printWrites.some((h) => h.includes('80mm POS')), 'thermal handler produced the 80mm slip');

    // 5) Export CSV -> download anchor clicked with the dated filename
    csvAnchor = null;
    await getEl('dcExportCsvBtn').click();
    assert.ok(csvAnchor, 'CSV handler built a download anchor');
    assert.ok(String(csvAnchor.download || '').startsWith('shahdara_daily_closing_'), 'CSV filename keeps the dated pattern');

    // 6) Staff Performance button is NOT wired by this controller (the staff
    // module owns it) — the closing controller never even looks it up.
    assert.equal(registry.has('openStaffPerfFromClosingBtn'), false, 'closing controller leaves the staff button to the staff module');

    // Closes: slim end Close and header ↩ both close the dialog
    await getEl('closeDailyClosingSecondaryBtn').click();
    assert.equal(getEl('dailyClosingModal').closedCount, 1, 'slim end Close closes the dialog');
    await getEl('closeDailyClosingModalBtn').click();
    assert.equal(getEl('dailyClosingModal').closedCount, 2, 'header ↩ closes the dialog');
  } finally {
    globalThis.document = origDocument;
    Object.defineProperty(globalThis, 'window', { value: origWindow, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true });
  }
});
