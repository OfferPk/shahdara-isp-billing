/**
 * recent-payments.test.js — Owner feature (2026-10-29): Dashboard
 * "Recent Payments" card builder.
 *
 * Pins: latest-5 selection + ordering across customers, voided-payment
 * exclusion (SISP-34) with the 6th-latest filling the gap, field
 * mapping (name / method / amount / stored receipt reference only),
 * same-date tie-break by ledger traversal order, and the empty ledger.
 * SISP-174 adds: recordedAt entry-time tie-break, derived method/shop
 * filter pills + filtering over the wider pool, and the dashboard
 * wiring of the 1-tap Receipt / WhatsApp / PNG row actions.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildRecentPayments,
  buildRecentPaymentPills,
  filterRecentPayments,
  RECENT_PAYMENTS_LIMIT,
  RECENT_PAYMENTS_FILTER_POOL,
  RECENT_PAYMENTS_ALL_FILTER
} from '../recent-payments.js';

function payment(id, date, amount, method, extra = {}) {
  return { id, date, amount, method, ...extra };
}

function customer(id, customerNumber, name, bills, extra = {}) {
  return { id, customerNumber, name, bills, ...extra };
}

function bill(month, payments) {
  return { id: `bill-${month}`, month, dueAmount: 1500, status: 'paid', payments };
}

/** Seven payments across three customers, newest = p7 (2026-10-28). */
function seededState() {
  return {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-09', [payment('p1', '2026-09-05', 1500, 'Cash', { receiptNumber: 'RCPT-1-202609-01' })]),
        bill('2026-10', [payment('p5', '2026-10-20', 1500, 'Cash', { receiptNumber: 'RCPT-1-202610-01' })])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-09', [payment('p2', '2026-09-09', 2000, 'Bank Transfer')]),
        bill('2026-10', [
          payment('p4', '2026-10-11', 2500, 'JazzCash', { receiptNumber: 'RCPT-2-202610-01' }),
          payment('p7', '2026-10-28', 1500, 'Cash at Balla shop', { permanentReceiptNumber: 'REC-2610-0002-AB12' })
        ])
      ]),
      customer('cust-c', 3, 'Fatima Ali', [
        bill('2026-09', [payment('p3', '2026-09-15', 1500, 'Easypaisa')]),
        bill('2026-10', [payment('p6', '2026-10-25', 3000, 'Raast', { receiptNumber: 'RCPT-3-202610-01' })])
      ])
    ]
  };
}

test('returns exactly the latest 5 payments across customers, newest first', () => {
  const rows = buildRecentPayments(seededState());
  assert.equal(RECENT_PAYMENTS_LIMIT, 5);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.paymentId), ['p7', 'p6', 'p5', 'p4', 'p3']);
  assert.deepEqual(rows.map(r => r.date), ['2026-10-28', '2026-10-25', '2026-10-20', '2026-10-11', '2026-09-15']);
});

test('maps name, method, amount and customer identity onto each row', () => {
  const rows = buildRecentPayments(seededState());
  const first = rows[0];
  assert.equal(first.customerId, 'cust-b');
  assert.equal(first.customerNumber, 2);
  assert.equal(first.customerName, 'Kamran Iqbal');
  assert.equal(first.method, 'Cash at Balla shop');
  assert.equal(first.amount, 1500);
  assert.equal(first.month, '2026-10');
  const second = rows[1];
  assert.equal(second.customerName, 'Fatima Ali');
  assert.equal(second.method, 'Raast');
  assert.equal(second.amount, 3000);
});

test('receiptRef is the stored reference only — receiptNumber, else permanentReceiptNumber, else empty', () => {
  const rows = buildRecentPayments(seededState());
  const byId = Object.fromEntries(rows.map(r => [r.paymentId, r]));
  assert.equal(byId.p7.receiptRef, 'REC-2610-0002-AB12');
  assert.equal(byId.p6.receiptRef, 'RCPT-3-202610-01');
  assert.equal(byId.p5.receiptRef, 'RCPT-1-202610-01');
  // p3 carries no stored reference: the builder must NOT invent one.
  assert.equal(byId.p3.receiptRef, '');
});

test('a voided payment among the latest is excluded and the 6th-latest fills its place', () => {
  const state = seededState();
  // Void the newest payment (p7, 2026-10-28) the SISP-34 way.
  state.customers[1].bills[1].payments[1] = {
    ...state.customers[1].bills[1].payments[1],
    voided: true,
    voidedAt: '2026-10-29T09:00:00.000Z',
    voidReason: 'Duplicate entry'
  };
  const rows = buildRecentPayments(state);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.paymentId), ['p6', 'p5', 'p4', 'p3', 'p2']);
  assert.ok(!rows.some(r => r.paymentId === 'p7'));
});

test('same-date ties break by ledger traversal order — later-recorded payment first', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('early', '2026-10-10', 1500, 'Cash')])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('late', '2026-10-10', 1500, 'Cash')])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  assert.deepEqual(rows.map(r => r.paymentId), ['late', 'early']);
});

test('payments of archived customers still count (money received is received)', () => {
  const state = {
    customers: [
      customer('cust-z', 9, 'Old Customer', [
        bill('2026-10', [payment('pz', '2026-10-27', 1800, 'Cash')])
      ], { archived: true })
    ]
  };
  const rows = buildRecentPayments(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentId, 'pz');
});

test('empty and malformed ledgers return an empty array', () => {
  assert.deepEqual(buildRecentPayments({ customers: [] }), []);
  assert.deepEqual(buildRecentPayments({}), []);
  assert.deepEqual(buildRecentPayments(null), []);
  assert.deepEqual(buildRecentPayments({ customers: [customer('c1', 1, 'No Bills', [])] }), []);
  const noDates = {
    customers: [
      customer('c2', 2, 'Dateless', [bill('2026-10', [{ id: 'px', amount: 100, method: 'Cash' }])])
    ]
  };
  assert.deepEqual(buildRecentPayments(noDates), []);
});

test('limit parameter is honoured', () => {
  const rows = buildRecentPayments(seededState(), 3);
  assert.deepEqual(rows.map(r => r.paymentId), ['p7', 'p6', 'p5']);
});

// ---------------------------------------------------------------------------
// SISP-174: recordedAt tie-break, derived filter pills, row-action wiring.
// ---------------------------------------------------------------------------

test('SISP-174: same-date payments with recordedAt order newest-entry first, beating traversal order', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('entered-later', '2026-10-10', 1500, 'Cash', { recordedAt: '2026-10-10T09:30:00.000Z' })])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('entered-earlier', '2026-10-10', 1500, 'Cash', { recordedAt: '2026-10-10T08:15:00.000Z' })])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  // Traversal order alone would put cust-b first; the entry stamp wins.
  assert.deepEqual(rows.map(r => r.paymentId), ['entered-later', 'entered-earlier']);
  assert.equal(rows[0].recordedAtMs, Date.parse('2026-10-10T09:30:00.000Z'));
  assert.equal(rows[1].recordedAtMs, Date.parse('2026-10-10T08:15:00.000Z'));
});

test('SISP-174: a stamped payment ranks above unstamped ones of the same date; unstamped keep traversal order', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('unstamped-old', '2026-10-10', 1500, 'Cash')])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('stamped', '2026-10-10', 1500, 'Cash', { recordedAt: '2026-10-10T07:00:00.000Z' })])
      ]),
      customer('cust-c', 3, 'Fatima Ali', [
        bill('2026-10', [payment('unstamped-new', '2026-10-10', 1500, 'Cash')])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  assert.deepEqual(rows.map(r => r.paymentId), ['stamped', 'unstamped-new', 'unstamped-old']);
  assert.equal(rows[1].recordedAtMs, null);
  assert.equal(rows[2].recordedAtMs, null);
});

test('SISP-174: recordedAt never overrides the payment date itself', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        // Backdated entry: paid for the 9th, typed in on the 28th.
        bill('2026-10', [payment('backdated', '2026-10-09', 1500, 'Cash', { recordedAt: '2026-10-28T10:00:00.000Z' })])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('newer-date', '2026-10-10', 1500, 'Cash')])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  assert.deepEqual(rows.map(r => r.paymentId), ['newer-date', 'backdated']);
});

test('SISP-174: an unusable recordedAt value is treated as no stamp', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('junk-stamp', '2026-10-10', 1500, 'Cash', { recordedAt: 'not-a-date' })])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordedAtMs, null);
});

test('SISP-174: the default view is unchanged — pool + All filter reproduces the default list exactly', () => {
  const state = seededState();
  const fallback = buildRecentPayments(state);
  const pool = buildRecentPayments(state, RECENT_PAYMENTS_FILTER_POOL);
  assert.ok(pool.length > RECENT_PAYMENTS_LIMIT);
  assert.deepEqual(filterRecentPayments(pool, RECENT_PAYMENTS_ALL_FILTER), fallback);
  assert.deepEqual(filterRecentPayments(pool, ''), fallback);
  assert.deepEqual(pool.slice(0, RECENT_PAYMENTS_LIMIT), fallback);
});

test('SISP-174: pills derive from the pool — one per shop / method present, with pool counts', () => {
  const pool = buildRecentPayments(seededState(), RECENT_PAYMENTS_FILTER_POOL);
  const pills = buildRecentPaymentPills(pool);
  assert.deepEqual(pills, [
    { key: 'shop:Hassan Balla Shop', label: 'Hassan Balla Shop', count: 1 },
    { key: 'method:Raast', label: 'Raast', count: 1 },
    { key: 'method:Cash', label: 'Cash', count: 2 },
    { key: 'method:JazzCash', label: 'JazzCash', count: 1 },
    { key: 'method:Easypaisa', label: 'Easypaisa', count: 1 },
    { key: 'method:Bank Transfer', label: 'Bank Transfer', count: 1 }
  ]);
  // The Balla pill is the one the "Cash at Balla shop" payments belong to.
  const ballaRows = pool.filter(r => r.method === 'Cash at Balla shop');
  assert.ok(ballaRows.length > 0);
  assert.ok(ballaRows.every(r => r.shop === 'Hassan Balla Shop' && r.filterKey === 'shop:Hassan Balla Shop'));
});

test('SISP-174: a shop that is not in the data grows no pill; once present, it appears', () => {
  const base = seededState();
  assert.ok(!buildRecentPaymentPills(buildRecentPayments(base, RECENT_PAYMENTS_FILTER_POOL))
    .some(pill => pill.key === 'shop:Corner Shop'));
  const withShop = seededState();
  withShop.customers[0].bills[1].payments.push(
    payment('p8', '2026-10-29', 1200, 'Cash at Corner shop'));
  const pills = buildRecentPaymentPills(buildRecentPayments(withShop, RECENT_PAYMENTS_FILTER_POOL));
  assert.deepEqual(pills[0], { key: 'shop:Corner Shop', label: 'Corner Shop', count: 1 });
});

test('SISP-174: a shop collection recorded as plain Cash with the shop in paidBy joins the shop pill', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('via-shop', '2026-10-10', 1500, 'Cash', { paidBy: 'Balla' })])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('direct-cash', '2026-10-11', 1500, 'Cash')])
      ])
    ]
  };
  const pool = buildRecentPayments(state, RECENT_PAYMENTS_FILTER_POOL);
  const byId = Object.fromEntries(pool.map(r => [r.paymentId, r]));
  assert.equal(byId['via-shop'].filterKey, 'shop:Hassan Balla Shop');
  assert.equal(byId['direct-cash'].filterKey, 'method:Cash');
  assert.deepEqual(filterRecentPayments(pool, 'shop:Hassan Balla Shop').map(r => r.paymentId), ['via-shop']);
});

test('SISP-174: filtering keeps only the matching rows, newest first, capped at the card limit', () => {
  const pool = buildRecentPayments(seededState(), RECENT_PAYMENTS_FILTER_POOL);
  assert.deepEqual(filterRecentPayments(pool, 'shop:Hassan Balla Shop').map(r => r.paymentId), ['p7']);
  assert.deepEqual(filterRecentPayments(pool, 'method:Cash').map(r => r.paymentId), ['p5', 'p1']);
  assert.deepEqual(filterRecentPayments(pool, 'method:JazzCash').map(r => r.paymentId), ['p4']);
  assert.deepEqual(filterRecentPayments(pool, 'method:No Such Method'), []);
});

test('SISP-174: a filter reaches matching payments beyond the global top 5', () => {
  const payments = [];
  for (let i = 0; i < 6; i += 1) {
    payments.push(payment(`cash-${i}`, `2026-10-${String(20 + i)}`, 1000, 'Cash'));
  }
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [bill('2026-10', payments)]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('old-shop', '2026-10-01', 900, 'Cash at Balla shop')])
      ])
    ]
  };
  // The shop payment is 7th overall: invisible in the default last-5…
  assert.ok(!buildRecentPayments(state).some(r => r.paymentId === 'old-shop'));
  // …but the pool carries it, its pill exists, and filtering shows it.
  const pool = buildRecentPayments(state, RECENT_PAYMENTS_FILTER_POOL);
  assert.ok(buildRecentPaymentPills(pool).some(pill => pill.key === 'shop:Hassan Balla Shop'));
  assert.deepEqual(filterRecentPayments(pool, 'shop:Hassan Balla Shop').map(r => r.paymentId), ['old-shop']);
});

test('SISP-174: a voided payment appears under no pill and grows no pill', () => {
  const state = seededState();
  state.customers[1].bills[1].payments[1] = {
    ...state.customers[1].bills[1].payments[1],
    voided: true,
    voidedAt: '2026-10-29T09:00:00.000Z',
    voidReason: 'Duplicate entry'
  };
  const pool = buildRecentPayments(state, RECENT_PAYMENTS_FILTER_POOL);
  const pills = buildRecentPaymentPills(pool);
  assert.ok(!pool.some(r => r.paymentId === 'p7'));
  assert.ok(!pills.some(pill => pill.key === 'shop:Hassan Balla Shop'));
  for (const pill of pills) {
    assert.ok(!filterRecentPayments(pool, pill.key).some(r => r.paymentId === 'p7'));
  }
  // The Cash pill count drops with the voided p5 in a second scenario.
  const state2 = seededState();
  state2.customers[0].bills[1].payments[0] = {
    ...state2.customers[0].bills[1].payments[0],
    voided: true,
    voidedAt: '2026-10-29T09:00:00.000Z',
    voidReason: 'Wrong amount'
  };
  const cashPill = buildRecentPaymentPills(buildRecentPayments(state2, RECENT_PAYMENTS_FILTER_POOL))
    .find(pill => pill.key === 'method:Cash');
  assert.equal(cashPill.count, 1);
});

test('SISP-174: dashboard wires the pills and the 1-tap Receipt / WhatsApp / PNG actions to the real receipt paths', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // Filter pills container + derived-pool rendering in the dashboard block.
  assert.ok(html.includes('id="recentPaymentsFilters"'));
  assert.ok(app.includes('buildRecentPayments(state, RECENT_PAYMENTS_FILTER_POOL)'));
  assert.ok(app.includes('buildRecentPaymentPills(recentPool)'));
  assert.ok(app.includes('filterRecentPayments(recentPool, recentPaymentsFilter)'));
  assert.ok(app.includes("querySelectorAll('[data-recent-filter]')"));
  // Print receipt: the same data-print-receipt wiring as profile/transactions.
  assert.ok(app.includes("recentPaymentsListEl.querySelectorAll('[data-print-receipt]')"));
  assert.ok(app.includes('printPaymentReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)'));
  // PNG: profile-ui's shared button markup, wired to downloadPngReceipt.
  assert.ok(app.includes('pngReceiptButtonMarkup(customer.id, row.month, payment.id, customer.customerNumber)'));
  assert.ok(app.includes("recentPaymentsListEl.querySelectorAll('[data-png-receipt]')"));
  assert.ok(app.includes('downloadPngReceipt(button.dataset.customerId, button.dataset.month, button.dataset.paymentId)'));
  // WhatsApp: the shared receipt-draft markup fed with buildPaymentReceipt data.
  assert.ok(app.includes('receiptWhatsAppActionMarkup(customer, {'));
  assert.ok(app.includes('bindReceiptPhoneActions(recentPaymentsListEl)'));
  // Actions render OUTSIDE the profile-navigation button (never nested):
  // the row template closes the open-button before the actions markup.
  assert.ok(app.includes('</button>${recentPaymentActionsMarkup(row)}'));
  // The actions carry the row's own customer / month / payment identity.
  assert.ok(app.includes('data-print-receipt data-customer-id="${escapeHtml(customer.id)}" data-month="${escapeHtml(row.month)}" data-payment-id="${escapeHtml(payment.id)}"'));
});

test('SISP-174: the new dashboard strings exist in both languages', () => {
  const nav = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  for (const key of ['dash_recent_filter_all', 'dash_recent_filter_label', 'dash_recent_receipt', 'dash_recent_receipt_aria']) {
    assert.equal(nav.split(`${key}:`).length - 1, 2, `${key} must exist in en and ur`);
  }
});
