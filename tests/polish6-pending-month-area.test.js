// Receipt polish 6 — (A) Pending Action Center receipt always carries
// its month, derived automatically; (B) the split-tender success card
// carries the same on-screen Area select as the ordinary receipt card,
// and the Quick Collect picker + payment defaults read the profile
// area (mohalla) first. Pure-module tests on synthetic data only, plus
// wiring audits and a real WhatsApp-draft integration check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveReceiptSendMonth,
  formatReceiptMonthLong,
  pendingReceiptMonthLabel,
  pendingReceiptForShare
} from '../pending-receipt-month.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';
import {
  getPendingCollectionCustomers,
  getCustomerPaymentDefaults,
  quickCollectAreaSelectHtml
} from '../nav-quick-collect.js';
import { saveBillMonth } from '../core.js';

const MONTH_MODULE = readFileSync(new URL('../pending-receipt-month.js', import.meta.url), 'utf8');
const PENDING_ACTIONS_SOURCE = readFileSync(new URL('../nav-pending-actions.js', import.meta.url), 'utf8');
const QUICK_COLLECT_SOURCE = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const SPLIT_TENDER_SOURCE = readFileSync(new URL('../split-tender-collect.js', import.meta.url), 'utf8');

// --- (A) month derivation -------------------------------------------------

test('bill month wins when it is a valid YYYY-MM month', () => {
  assert.equal(deriveReceiptSendMonth({ month: '2026-11', date: '2026-10-05' }), '2026-11');
  assert.equal(deriveReceiptSendMonth({ month: '2026-11', date: '' }), '2026-11');
  assert.equal(deriveReceiptSendMonth({ month: ' 2026-11 ', date: '' }), '2026-11');
});

test('payment date month is used when the bill month is missing or invalid', () => {
  assert.equal(deriveReceiptSendMonth({ month: '', date: '2026-11-05' }), '2026-11');
  assert.equal(deriveReceiptSendMonth({ month: '2026-13', date: '2026-11-05' }), '2026-11');
  assert.equal(deriveReceiptSendMonth({ month: 'Nov 2026', date: '2026-11-05' }), '2026-11');
  assert.equal(deriveReceiptSendMonth({ date: '2026-02-28' }), '2026-02');
  assert.equal(deriveReceiptSendMonth({ month: 202611, date: '2026-11-05' }), '2026-11');
});

test('no usable date never invents a month', () => {
  assert.equal(deriveReceiptSendMonth({ month: '', date: '' }), '');
  assert.equal(deriveReceiptSendMonth({ month: '2026-13', date: '2026-02-30' }), '');
  assert.equal(deriveReceiptSendMonth({ month: '2026-00', date: 'not-a-date' }), '');
  assert.equal(deriveReceiptSendMonth({}), '');
  assert.equal(deriveReceiptSendMonth(null), '');
  assert.equal(deriveReceiptSendMonth(undefined), '');
});

test('strict calendar dates: leap day counts, impossible days do not', () => {
  assert.equal(deriveReceiptSendMonth({ date: '2024-02-29' }), '2024-02');
  assert.equal(deriveReceiptSendMonth({ date: '2026-02-29' }), '');
  assert.equal(deriveReceiptSendMonth({ date: '2026-04-31' }), '');
  assert.equal(deriveReceiptSendMonth({ date: '2026-11-31' }), '');
  assert.equal(deriveReceiptSendMonth({ date: '2026-12-31' }), '2026-12');
});

test('month label is the full month name and year', () => {
  assert.equal(formatReceiptMonthLong('2026-11'), 'November 2026');
  assert.equal(formatReceiptMonthLong('2026-01'), 'January 2026');
  assert.equal(formatReceiptMonthLong('2026-12'), 'December 2026');
  assert.equal(formatReceiptMonthLong('2026-13'), '');
  assert.equal(formatReceiptMonthLong(''), '');
  assert.equal(formatReceiptMonthLong(null), '');
  assert.equal(pendingReceiptMonthLabel({ month: '2026-11', date: '2026-10-05' }), 'November 2026');
  assert.equal(pendingReceiptMonthLabel({ month: '', date: '2026-11-05' }), 'November 2026');
  assert.equal(pendingReceiptMonthLabel({ month: '', date: '' }), '');
});

// --- (A) share receipt builder --------------------------------------------

const QUEUE_ITEM = {
  paymentId: 'pay-41',
  receiptId: 'pay-41',
  customerId: 'cust-41',
  customerNumber: 41,
  customerName: 'RAJA KHAZER',
  customerPhone: '03001234567',
  amount: 2000,
  date: '2026-11-05',
  method: 'Easypaisa',
  month: '2026-11',
  billAmount: 3000,
  originMonth: '2026-11',
  someUnknownField: 'must be dropped'
};
const CUSTOMER = { id: 'cust-41', name: 'RAJA KHAZER', phone: '03001234567', customerNumber: 41 };

test('share receipt carries everything the WhatsApp draft needs', () => {
  const receipt = pendingReceiptForShare(QUEUE_ITEM, CUSTOMER);
  assert.equal(receipt.id, 'pay-41');
  assert.equal(receipt.customerId, 'cust-41');
  assert.equal(receipt.customerName, 'RAJA KHAZER');
  assert.equal(receipt.customerNumber, 41);
  assert.equal(receipt.amount, 2000);
  assert.equal(receipt.method, 'Easypaisa');
  assert.equal(receipt.date, '2026-11-05');
  assert.equal(receipt.month, '2026-11');
  assert.equal(receipt.billAmount, 3000);
  assert.equal('originMonth' in receipt, false);
  assert.equal('someUnknownField' in receipt, false);
});

test('share receipt derives the month from the payment date when the bill month is blank', () => {
  const receipt = pendingReceiptForShare({ ...QUEUE_ITEM, month: '' }, CUSTOMER);
  assert.equal(receipt.month, '2026-11');
});

test('share receipt never invents a month and never mutates its inputs', () => {
  const beforeItem = JSON.stringify(QUEUE_ITEM);
  const beforeCustomer = JSON.stringify(CUSTOMER);
  const receipt = pendingReceiptForShare({ ...QUEUE_ITEM, month: '', date: '' }, CUSTOMER);
  assert.equal(receipt.month, '');
  assert.equal(JSON.stringify(QUEUE_ITEM), beforeItem);
  assert.equal(JSON.stringify(CUSTOMER), beforeCustomer);
  const noBill = pendingReceiptForShare({ ...QUEUE_ITEM, billAmount: undefined }, CUSTOMER);
  assert.equal('billAmount' in noBill, false);
  const nanBill = pendingReceiptForShare({ ...QUEUE_ITEM, billAmount: NaN }, CUSTOMER);
  assert.equal('billAmount' in nanBill, false);
});

test('purity fence: the month module imports nothing and reads no storage, clock or network', () => {
  assert.equal(/^\s*import\s/m.test(MONTH_MODULE), false);
  assert.equal(MONTH_MODULE.includes('localStorage'), false);
  assert.equal(MONTH_MODULE.includes('sessionStorage'), false);
  assert.equal(MONTH_MODULE.includes('fetch('), false);
  assert.equal(MONTH_MODULE.includes('new Date('), false);
  assert.equal(MONTH_MODULE.includes('Date.now('), false);
});

// --- (A) wiring: the Pending Action Center uses the builder ---------------

test('wiring: pending send path builds the share receipt and shows the month on the card', () => {
  assert.ok(PENDING_ACTIONS_SOURCE.includes('pendingReceiptForShare(r, cust)'));
  // Reports Tab Part 3: the compact card shows the SHORT month label
  // ('Nov 2026') from the same shared derivation as the share draft —
  // the full 'November 2026' does not fit the one-line meta row.
  assert.ok(PENDING_ACTIONS_SOURCE.includes('pendingReceiptShortMonthLabel(r)'));
  assert.equal(PENDING_ACTIONS_SOURCE.includes('originMonth: r.month'), false);
  assert.ok(PENDING_ACTIONS_SOURCE.includes("from './pending-receipt-month.js'"));
});

// --- (A) integration: the derived month reaches a real WhatsApp draft ----

test('integration: a pending receipt with a blank bill month still opens a WhatsApp draft carrying its month', async () => {
  const { executeReceiptWhatsAppShare } = await import('../nav-quick-profile.js');
  const mockStorage = {
    store: {},
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };
  let openedUrl = null;
  const mockWindow = { open(u) { openedUrl = u; } };
  const mockClipboard = { async writeText() {} };

  // The queue item as the center builds it when the bill month is blank.
  const receipt = pendingReceiptForShare({ ...QUEUE_ITEM, month: '' }, CUSTOMER);
  assert.equal(receipt.month, '2026-11');
  const result = await executeReceiptWhatsAppShare(CUSTOMER, receipt, {
    storage: mockStorage,
    windowObj: mockWindow,
    clipboardObj: mockClipboard
  });
  assert.equal(result.success, true);
  assert.equal(result.method, 'whatsapp');
  assert.ok(openedUrl.includes('wa.me/923001234567'));
  const sentText = decodeURIComponent(openedUrl);
  assert.ok(sentText.includes('Billing Month: Nov 2026'));
  assert.ok(sentText.includes('RAJA KHAZER'));
});

// --- (B) split-tender card carries the Area select ------------------------

const SPLIT_COMBINED = {
  splitGroupId: 'grp-1',
  customerId: '41',
  customerNumber: 41,
  customerName: 'RAJA KHAZER',
  customerNameUrdu: '',
  phone: '03001234567',
  area: 'Unassigned',
  month: '2026-11',
  date: '2026-11-05',
  package: '5 Mbps',
  legs: [
    { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-1', method: 'Cash', amount: 1000, transactionId: '', date: '2026-11-05', voided: false },
    { leg: 2, paymentId: 'pay-b', receiptNumber: 'RCPT-2', method: 'Easypaisa', amount: 1000, transactionId: '58247157439', date: '2026-11-05', voided: false }
  ],
  totalReceivedCents: 200000,
  totalReceived: 2000,
  balanceDueCents: 100000,
  status: 'PARTIAL'
};

test('split card without a select keeps the plain-text area (backward compatible)', () => {
  const html = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  // Polish 21 (Req 6): the partial badge moved out of the card header
  // into the status section — the card still shows the partial state as
  // the remaining-balance row.
  assert.ok(!html.includes('Partial Payment'), 'split card header must not carry the partial badge any more');
  // QC receipt-modal overhaul: the Remaining Balance row is the merged
  // Still-owed row now — same figure, always shown.
  assert.ok(!html.includes('Remaining Balance'), 'no Remaining Balance row may remain');
  assert.ok(html.includes('Still owed') && html.includes('PKR 1,000'), 'split card must still show the remaining balance as Still owed');
  assert.ok(html.includes('<strong class="qc-meta-val">Unassigned</strong>'));
  assert.equal(html.includes('data-qc-area-select'), false);
  assert.equal(renderSplitReceiptCardHtml(null), '');
});

test('split card with a select renders the select instead of plain-text area', () => {
  const selectHtml = quickCollectAreaSelectHtml(SPLIT_COMBINED.area);
  assert.ok(selectHtml.includes('data-qc-area-select'));
  const html = renderSplitReceiptCardHtml(SPLIT_COMBINED, selectHtml);
  assert.ok(html.includes(selectHtml));
  assert.ok(html.includes('data-qc-area-select'));
  assert.equal(html.includes('<strong class="qc-meta-val">Unassigned</strong>'), false);
  // Polish 21 (Req 6): the partial badge moved out of the card header
  // into the status section (see the test above).
  assert.ok(!html.includes('Partial Payment'), 'split card header must not carry the partial badge any more');
});

// --- (B) picker + payment defaults read the profile area first ------------

// Plan 556: the payment-defaults fallback is now the receipt convention
// 'Not recorded' (polish #12); the picker row keeps 'Unassigned' — its
// area is the QC-4 filter key input, so only the card translates it at
// render (see tests/plan556-area-wording-one-wording.test.js).
test('picker and payment defaults show mohalla first, legacy area second, fallback last', () => {
  const month = '2026-11';
  let state = { customers: [
    { id: 'm', customerNumber: 1, name: 'Mohalla Only', phone: '03000000001', mohalla: 'CHARYAA', archived: false, bills: [] },
    { id: 'a', customerNumber: 2, name: 'Area Only', phone: '03000000002', area: 'Jia Musa', archived: false, bills: [] },
    { id: 'b', customerNumber: 3, name: 'Both Set', phone: '03000000003', area: 'Old Area', mohalla: 'GANGALL', archived: false, bills: [] },
    { id: 'n', customerNumber: 4, name: 'Neither Set', phone: '03000000004', archived: false, bills: [] }
  ] };
  for (const id of ['m', 'a', 'b', 'n']) {
    state = saveBillMonth(state, id, { month, dueAmount: 1000, status: 'pending' });
  }
  const rows = getPendingCollectionCustomers(state, '', 'all-dues');
  assert.equal(rows.find(r => r.id === 'm').area, 'CHARYAA');
  assert.equal(rows.find(r => r.id === 'a').area, 'Jia Musa');
  assert.equal(rows.find(r => r.id === 'b').area, 'GANGALL');
  assert.equal(rows.find(r => r.id === 'n').area, 'Unassigned');

  const refDate = new Date('2026-11-05T12:00:00+05:00');
  assert.equal(getCustomerPaymentDefaults(state, 'm', refDate).area, 'CHARYAA');
  assert.equal(getCustomerPaymentDefaults(state, 'a', refDate).area, 'Jia Musa');
  assert.equal(getCustomerPaymentDefaults(state, 'b', refDate).area, 'GANGALL');
  assert.equal(getCustomerPaymentDefaults(state, 'n', refDate).area, 'Not recorded'); // Plan 556: defaults use the receipt convention now
});

// --- (B) wiring: split card select + area-save sync -----------------------

test('wiring: success screen passes the Area select into the split card and syncs the split receipt on save', () => {
  // QC receipt-modal overhaul: the split call now passes the merged-row
  // options (next-due text + charges flag) as a third argument.
  assert.ok(QUICK_COLLECT_SOURCE.includes('renderSplitReceiptCardHtml(activeReceipt.splitTender, quickCollectAreaSelectHtml(activeReceipt.splitTender.area), { nextDueDateText, chargesPending })'));
  assert.ok(QUICK_COLLECT_SOURCE.includes('splitTender: { ...activeReceipt.splitTender, area: stored }'));
  assert.ok(SPLIT_TENDER_SOURCE.includes('areaSelectHtml'));
  assert.ok(QUICK_COLLECT_SOURCE.includes("customer.mohalla || customer.area || 'Unassigned'"));
});
