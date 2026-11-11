// Payments Inbox Cleanup & Wallet Ledger Sync — new tests.
//
// Covers the pure wallet-review builder (the Inbox's link to the
// ledger's unverified digital payments) and the controller render:
// one Sync Sheet, unified Paste label, hidden filters when empty,
// 3-column selects, KPI accents, and the wallet-review card.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildInboxWalletReview,
  PaymentsInboxController
} from '../payments-inbox.js';

// Mock localStorage (same pattern as tests/easypaisa-inbox.test.js).
class MockLocalStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MockLocalStorage();
}

const inboxSrc = readFileSync(new URL('../payments-inbox.js', import.meta.url), 'utf8');
const inboxCss = readFileSync(new URL('../payments-inbox.css', import.meta.url), 'utf8');
const routerSrc = readFileSync(new URL('../screen-router.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav.js', import.meta.url), 'utf8');

// The wallet review always covers the CURRENT Pakistan month, so the
// fixtures are dated in that month — never a hardcoded month, or these
// tests would rot the moment the month turns.
const MONTH = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }).slice(0, 7);
const PREV_MONTH = (() => {
  const [y, m] = MONTH.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
})();

// Generic fixtures only — no real customer names or phone numbers.
function customer(id, number, name, payments) {
  return { id, customerNumber: number, name, bills: [{ month: MONTH, payments }] };
}
function payment(id, { date = `${MONTH}-05`, amount = 1000, method = 'Easypaisa', transactionId = '', walletVerified = undefined, voided = undefined } = {}) {
  const p = { id, date, amount, method, transactionId };
  if (walletVerified !== undefined) p.walletVerified = walletVerified;
  if (voided !== undefined) p.voided = voided;
  return p;
}

test('wallet review lists unverified digital payments for the month only', () => {
  const customers = [
    customer('c1', 1, 'Test One', [
      payment('p1', { transactionId: 'TXN1001' }),
      payment('p2', { transactionId: 'TXN1002', walletVerified: true }),
      payment('p3', { date: `${PREV_MONTH}-20`, transactionId: 'TXN1003' })
    ]),
    customer('c2', 2, 'Test Two', [
      payment('p4', { method: 'JazzCash', transactionId: 'TXN2001' }),
      payment('p5', { method: 'Cash', amount: 500 })
    ])
  ];
  const review = buildInboxWalletReview({ customers, month: MONTH });
  // buildWalletReconciliation sorts by date desc; same-date payments
  // keep ledger order (c1's rows before c2's).
  assert.deepEqual(review.pending.map((p) => p.paymentId), ['p1', 'p4']);
  assert.deepEqual(review.duplicateGroups, []);
  assert.deepEqual(review.unclaimed, []);
});

test('wallet review groups the same TID under separator/case variants', () => {
  const customers = [
    customer('c1', 1, 'Test One', [
      payment('p1', { transactionId: 'TXN-9001' }),
      payment('p2', { transactionId: 'txn9001' })
    ])
  ];
  const review = buildInboxWalletReview({ customers, month: MONTH });
  assert.equal(review.duplicateGroups.length, 1);
  assert.equal(review.duplicateGroups[0].displayTid, 'TXN-9001');
  assert.equal(review.duplicateGroups[0].payments.length, 2);
});

test('wallet review never offers a voided payment for verification', () => {
  const customers = [
    customer('c1', 1, 'Test One', [
      payment('p1', { transactionId: 'TXN1001', voided: true }),
      payment('p2', { transactionId: 'TXN-9002' }),
      payment('p3', { transactionId: 'txn9002', voided: true })
    ])
  ];
  const review = buildInboxWalletReview({ customers, month: MONTH });
  assert.deepEqual(review.pending.map((p) => p.paymentId), ['p2']);
  // The duplicate group collapses to one live leg, so it is not a group.
  assert.deepEqual(review.duplicateGroups, []);
});

test('wallet review lists unclaimed suspense entries, never claimed ones', () => {
  const suspenseEntries = [
    { suspenseId: 'SUS-101', amount: 1500, wallet: 'Easypaisa', senderName: 'Unknown Sender', tid: 'TXN555', date: `${MONTH}-06`, claimed: false, createdAt: `${MONTH}-06` },
    { suspenseId: 'SUS-102', amount: 2000, wallet: 'JazzCash', senderName: 'Claimed Sender', tid: 'TXN556', date: `${MONTH}-07`, claimed: true, claimedCustomerId: 'c1', claimedCustomerName: 'Test One', claimedAt: `${MONTH}-08`, claimedMonth: MONTH, createdAt: `${MONTH}-07` }
  ];
  const review = buildInboxWalletReview({ customers: [], month: MONTH, suspenseEntries });
  assert.deepEqual(review.unclaimed.map((e) => e.suspenseId), ['SUS-101']);
});

test('wallet review is empty when everything is verified and claimed', () => {
  const customers = [
    customer('c1', 1, 'Test One', [payment('p1', { transactionId: 'TXN1001', walletVerified: true })])
  ];
  const review = buildInboxWalletReview({ customers, month: MONTH, suspenseEntries: [] });
  assert.deepEqual(review.pending, []);
  assert.deepEqual(review.duplicateGroups, []);
  assert.deepEqual(review.unclaimed, []);
});

function renderInbox({ items = [], state = null, suspenseEntries = null } = {}) {
  localStorage.clear();
  if (suspenseEntries) {
    localStorage.setItem('sisp_suspense_payments_v1', JSON.stringify(suspenseEntries));
  }
  const container = { innerHTML: '' };
  const controller = new PaymentsInboxController({ getState: () => state });
  controller.container = container;
  controller.items = items;
  controller.render();
  return container.innerHTML;
}

const inboxItem = {
  txnId: 'TXN1001',
  date: `${MONTH}-05`,
  datetimeIso: `${MONTH}-05T10:00:00`,
  direction: 'Received',
  amount: 1000,
  senderName: 'Test Sender',
  senderNumber: '03012345678',
  status: 'Recorded',
  recorded: false
};

test('render: one Sync Sheet, unified Paste label, no empty-state Sync copy', () => {
  const html = renderInbox({ items: [inboxItem], state: { customers: [] } });
  assert.equal(html.match(/Sync Sheet/g)?.length, 1);
  assert.match(html, /Paste SMS \/ CSV/);
  assert.doesNotMatch(html, /Paste \/ CSV/);
  assert.doesNotMatch(html, /Paste Email \/ SMS/);
  assert.doesNotMatch(html, /emptySyncBtn/);
});

test('render: search and filters are hidden while the inbox is empty', () => {
  const html = renderInbox({ items: [], state: { customers: [] } });
  assert.doesNotMatch(html, /easypaisa-filter-toolbar/);
  assert.doesNotMatch(html, /easypaisaSearchInput/);
  const withItems = renderInbox({ items: [inboxItem], state: { customers: [] } });
  assert.match(withItems, /easypaisa-filter-toolbar/);
  assert.match(withItems, /placeholder="Search by TID, name, phone, or amount"/);
  assert.doesNotMatch(withItems, /Search Txn ID, customer, phone, or amount/);
});

test('render: the three filter dropdowns sit in one compact row', () => {
  const html = renderInbox({ items: [inboxItem], state: { customers: [] } });
  assert.match(html, /id="easypaisaFilterDirection"/);
  assert.match(html, /id="easypaisaFilterStatus"/);
  assert.match(html, /id="easypaisaFilterDate"/);
  assert.match(inboxCss, /\.filter-selects-group\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test('render: This Month Received and Inbox Status carry the same left accents as the top cards', () => {
  const html = renderInbox({ items: [inboxItem], state: { customers: [] } });
  assert.match(html, /easypaisa-kpi-card highlight-green">\s*<div class="kpi-label">This Month Received<\/div>/);
  assert.match(html, /easypaisa-kpi-card highlight-blue">\s*<div class="kpi-label">Inbox Status<\/div>/);
});

test('render: wallet review appears only when there is something to review', () => {
  const pendingState = {
    customers: [customer('c1', 1, 'Test One', [payment('p1', { transactionId: 'TXN1001' })])]
  };
  const html = renderInbox({ items: [], state: pendingState });
  assert.match(html, /class="easypaisa-wallet-review"/);
  assert.match(html, /Wallet review/);
  assert.match(html, /Mark verified/);
  assert.match(html, /TXN1001/);
  assert.match(html, new RegExp(`data-wallet-toggle="c1\\|${MONTH}\\|p1\\|verified"`));

  const cleanState = {
    customers: [customer('c1', 1, 'Test One', [payment('p1', { transactionId: 'TXN1001', walletVerified: true })])]
  };
  // Assert on the section class, not the heading text: the render
  // template carries a "Wallet review" HTML comment unconditionally.
  assert.doesNotMatch(renderInbox({ items: [], state: cleanState }), /class="easypaisa-wallet-review"/);
  assert.doesNotMatch(renderInbox({ items: [], state: null }), /class="easypaisa-wallet-review"/);
});

test('render: wallet review shows duplicate TIDs and unclaimed suspense', () => {
  const state = {
    customers: [customer('c1', 1, 'Test One', [
      payment('p1', { transactionId: 'TXN-9001' }),
      payment('p2', { transactionId: 'txn9001' })
    ])]
  };
  const html = renderInbox({
    items: [],
    state,
    suspenseEntries: [
      { suspenseId: 'SUS-101', amount: 1500, wallet: 'Easypaisa', senderName: 'Unknown Sender', tid: 'TXN555', date: `${MONTH}-06`, claimed: false, createdAt: `${MONTH}-06` }
    ]
  });
  assert.match(html, /Duplicate TID TXN-9001/);
  assert.match(html, /Unclaimed suspense transfers/);
  assert.match(html, /SUS-101/);
  assert.match(html, /data-suspense-review/);
});

test('router: the Inbox header has no Sync Sheet action and a short subtitle', () => {
  assert.match(routerSrc, /easypaisa: \{ view: 'easypaisaView', title: 'Payments Inbox', subtitle: 'Easypaisa emails & statements' \}/);
  assert.doesNotMatch(routerSrc, /easypaisa: \{[^}]*action:/);
});

test('nav: the floating action button stays hidden on the Payments Inbox', () => {
  assert.match(navSrc, /isPaymentsInboxScreen/);
  assert.match(navSrc, /String\(screen \|\| ''\)\.toLowerCase\(\) === 'easypaisa'/);
});

test('css: the app footer is hidden on the Inbox screen only', () => {
  assert.match(inboxCss, /body\.sr-screen-mode\[data-screen="easypaisa"\] \.app-footer \{ display: none; \}/);
});

test('no new element ids: every id in the Inbox markup already existed', () => {
  const knownIds = new Set([
    'easypaisaSyncBtn', 'easypaisaImportManualBtn', 'easypaisaSettingsBtn',
    'easypaisaSearchInput', 'easypaisaFilterDirection', 'easypaisaFilterStatus',
    'easypaisaFilterDate', 'easypaisaClearFiltersBtn', 'easypaisaSettingsModal',
    'easypaisaSettingsForm', 'settingSheetUrl', 'settingOwnerNumber',
    'easypaisaImportModal', 'manualPasteInput', 'manualPasteSubmitBtn',
    'csvFileInput', 'pdfFileInput', 'emptyPasteBtn'
  ]);
  // Leading-space match only, so data-txn-id="..." is not mistaken
  // for an id="..." attribute.
  const ids = [...inboxSrc.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0, 'ids found in the Inbox source');
  for (const id of ids) {
    assert.ok(knownIds.has(id), `new element id ${id} — disclose it or drop it`);
  }
});

test('wallet review wires the existing verify and suspense paths, nothing new', () => {
  assert.match(inboxSrc, /setPaymentWalletVerified\(liveState, customerId, billMonth, paymentId, target === 'verified'\)/);
  assert.match(inboxSrc, /window\.suspensePaymentsModalController/);
  assert.match(inboxSrc, /document\.getElementById\('openWalletLedgerModalBtn'\)/);
});
