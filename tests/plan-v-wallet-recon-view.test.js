import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWalletReconciliation,
  findPaymentsByTid
} from '../wallet-reconciliation.js';

import {
  RECON_BUCKET_ORDER,
  RECON_BUCKET_ACTIONS,
  buildWalletReconView,
  describeDigitalSettings,
  walletReconViewHtml
} from '../wallet-recon-view.js';

// Plain customers fixture shaped like state.customers. buildWalletReconciliation
// reads bills/payments directly, so no core.js import is needed here.
function customersFixture() {
  const bill = (month, payments) => ({ month, payments });
  return [
    {
      id: 'c1', customerNumber: 1, name: 'Alpha Cust',
      bills: [bill('2026-10', [
        { id: 'p1', date: '2026-10-05', amount: 2000, method: 'Easypaisa', transactionId: 'TXN-100', walletVerified: true, senderTitle: 'Alpha', senderDigits: '3310' },
        { id: 'p2', date: '2026-10-06', amount: 1500, method: 'JazzCash', transactionId: 'TXN-200', walletVerified: false }
      ])]
    },
    {
      id: 'c2', customerNumber: 2, name: 'Beta Cust',
      bills: [bill('2026-10', [
        { id: 'p3', date: '2026-10-07', amount: 3000, method: 'Easypaisa', transactionId: 'TXN-100', walletVerified: false },
        // CP-01 case: this payment is voided, so it must never "block" a TID.
        { id: 'p4', date: '2026-10-08', amount: 5000, method: 'Easypaisa', transactionId: 'TXN-VOID', walletVerified: false, voided: true }
      ])]
    }
  ];
}

function reportFixture(customers = customersFixture()) {
  return buildWalletReconciliation(customers, '2026-10', []);
}

function bucketOf(view, bucket) {
  return view.buckets[bucket];
}

test('null or non-object report gives an empty view, not a throw', () => {
  for (const bad of [null, undefined, 'nope', 42]) {
    const view = buildWalletReconView({ report: bad });
    assert.equal(view.month, '');
    assert.equal(view.rows.length, 0);
    assert.equal(view.openItems, 0);
    assert.deepEqual(Object.keys(view.buckets), [...RECON_BUCKET_ORDER]);
  }
});

test('month is carried from the report', () => {
  assert.equal(buildWalletReconView({ report: reportFixture() }).month, '2026-10');
});

test('verified ledger payments land in matched with the no-action text', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  const matched = bucketOf(view, 'matched');
  assert.equal(matched.count, 1);
  assert.equal(matched.amount, 2000);
  assert.equal(matched.rows[0].customerName, 'Alpha Cust');
  assert.equal(matched.rows[0].tid, 'TXN-100');
  assert.equal(matched.rows[0].action, RECON_BUCKET_ACTIONS.matched);
  assert.equal(matched.rows[0].source, 'ledger');
});

test('pending-verification ledger payments land in unmatched', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  const unmatched = bucketOf(view, 'unmatched');
  // p2 (pending) + p3 (pending) + p4 (voided row still in the report's
  // payment list — the report itself does not filter voided rows; the
  // CP-01 rule lives in findPaymentsByTid, tested separately below).
  assert.equal(unmatched.count, 3);
  assert.equal(unmatched.amount, 1500 + 3000 + 5000);
  assert.ok(unmatched.rows.every((r) => r.action === RECON_BUCKET_ACTIONS.unmatched));
});

test('matched + unmatched figures agree with the report exactly', () => {
  const report = reportFixture();
  const view = buildWalletReconView({ report });
  assert.equal(bucketOf(view, 'matched').count + bucketOf(view, 'unmatched').count, report.digitalCount);
  assert.equal(bucketOf(view, 'matched').amount + bucketOf(view, 'unmatched').amount, report.digitalTotal);
  assert.equal(view.ledger.digitalTotal, report.digitalTotal);
  assert.equal(view.ledger.digitalCount, report.digitalCount);
  assert.equal(view.ledger.pendingVerificationCount, report.pendingVerification.length);
  const pendingSum = report.pendingVerification.reduce((s, p) => s + p.amount, 0);
  assert.equal(bucketOf(view, 'unmatched').amount, pendingSum);
});

test('duplicate TID group becomes one disputed row summing its payments', () => {
  const report = reportFixture();
  assert.equal(report.duplicateGroups.length, 1);
  const view = buildWalletReconView({ report });
  const disputed = bucketOf(view, 'disputed');
  assert.equal(disputed.count, 1);
  assert.equal(disputed.amount, 2000 + 3000);
  assert.equal(disputed.rows[0].tid, 'TXN-100');
  assert.equal(disputed.rows[0].paymentCount, 2);
  assert.equal(disputed.rows[0].action, RECON_BUCKET_ACTIONS.disputed);
  assert.equal(view.ledger.duplicateGroupCount, 1);
});

test('disputed rows do not change the ledger totals', () => {
  const report = reportFixture();
  const view = buildWalletReconView({ report });
  assert.equal(view.ledger.digitalTotal, report.digitalTotal);
  assert.equal(bucketOf(view, 'matched').count + bucketOf(view, 'unmatched').count, report.digitalCount);
});

test('bucket order follows RECON_BUCKET_ORDER', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  assert.deepEqual(Object.keys(view.buckets), [...RECON_BUCKET_ORDER]);
  // rows are grouped ledger -> disputed -> inbox -> suspense by construction
  const firstDisputed = view.rows.findIndex((r) => r.bucket === 'disputed');
  const lastLedger = view.rows.map((r) => r.bucket).lastIndexOf('unmatched');
  assert.ok(firstDisputed > lastLedger);
});

test('openItems counts every non-matched row', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  assert.equal(view.openItems, view.rows.filter((r) => r.bucket !== 'matched').length);
  assert.ok(view.openItems > 0);
});

test('inbox review items beat unrecorded, recorded and sent items are excluded', () => {
  const inboxItems = [
    { txnId: 'IN-1', amount: 1000, direction: 'Received', status: 'Needs review', recorded: false, date: '2026-10-10', senderName: 'Review Sender' },
    { txnId: 'IN-2', amount: 2000, direction: 'Received', status: 'OK', recorded: false, date: '2026-10-11', senderName: 'Unrecorded Sender' },
    { txnId: 'IN-3', amount: 3000, direction: 'Received', status: 'OK', recorded: true, date: '2026-10-12', senderName: 'Already Recorded' },
    { txnId: 'IN-4', amount: 4000, direction: 'Sent', status: 'OK', recorded: false, date: '2026-10-13', senderName: 'Sent Out' },
    { txnId: 'IN-5', amount: 5000, direction: 'Received', status: 'OK', recorded: false, date: '2026-09-30', senderName: 'Last Month' }
  ];
  const view = buildWalletReconView({ report: reportFixture(), inboxItems });
  assert.equal(bucketOf(view, 'inbox-review').count, 1);
  assert.equal(bucketOf(view, 'inbox-review').rows[0].tid, 'IN-1');
  assert.equal(bucketOf(view, 'inbox-unrecorded').count, 1);
  assert.equal(bucketOf(view, 'inbox-unrecorded').rows[0].tid, 'IN-2');
  assert.ok(!view.rows.some((r) => r.tid === 'IN-3' || r.tid === 'IN-4' || r.tid === 'IN-5'));
});

test('inbox date falls back to datetimeIso', () => {
  const view = buildWalletReconView({
    report: reportFixture(),
    inboxItems: [{ txnId: 'IN-9', amount: 700, direction: 'Received', recorded: false, datetimeIso: '2026-10-15T10:00:00', senderName: 'Iso Sender' }]
  });
  assert.equal(bucketOf(view, 'inbox-unrecorded').rows[0].date, '2026-10-15');
});

test('unclaimed suspense entries land in suspense-unclaimed with the claim action', () => {
  const view = buildWalletReconView({
    report: reportFixture(),
    suspenseEntries: [{ suspenseId: 'SUS-101', amount: 2500, wallet: 'Easypaisa', senderName: 'Unknown Sender', tid: 'TXN-NEW', date: '2026-10-09', claimed: false }]
  });
  const bucket = bucketOf(view, 'suspense-unclaimed');
  assert.equal(bucket.count, 1);
  assert.equal(bucket.amount, 2500);
  assert.equal(bucket.rows[0].action, RECON_BUCKET_ACTIONS['suspense-unclaimed']);
});

test('suspense entry whose TID matches a recorded payment (case/space variant) is already-recorded', () => {
  const customers = customersFixture();
  const view = buildWalletReconView({
    report: reportFixture(customers),
    customers,
    suspenseEntries: [{ suspenseId: 'SUS-102', amount: 2000, wallet: 'Easypaisa', senderName: 'Alpha', tid: ' txn-100 ', date: '2026-10-09', claimed: false }]
  });
  assert.equal(bucketOf(view, 'suspense-recorded').count, 1);
  assert.equal(bucketOf(view, 'suspense-unclaimed').count, 0);
  const row = bucketOf(view, 'suspense-recorded').rows[0];
  assert.equal(row.customerName, 'Alpha Cust');
  assert.equal(row.action, RECON_BUCKET_ACTIONS['suspense-recorded']);
});

test('CP-01: suspense entry whose TID matches ONLY a voided payment stays unclaimed', () => {
  const customers = customersFixture();
  const view = buildWalletReconView({
    report: reportFixture(customers),
    customers,
    suspenseEntries: [{ suspenseId: 'SUS-103', amount: 5000, wallet: 'Easypaisa', senderName: 'Void Sender', tid: 'TXN-VOID', date: '2026-10-09', claimed: false }]
  });
  assert.equal(bucketOf(view, 'suspense-recorded').count, 0);
  assert.equal(bucketOf(view, 'suspense-unclaimed').count, 1);
});

test('CP-01 regression carried over: findPaymentsByTid skips voided payments', () => {
  const customers = customersFixture();
  assert.deepEqual(findPaymentsByTid(customers, 'TXN-VOID'), []);
  assert.deepEqual(findPaymentsByTid(customers, 'txn-void'), []);
  const found = findPaymentsByTid(customers, 'TXN-100');
  assert.equal(found.length, 2);
  assert.ok(found.every((p) => p.voided !== true));
  assert.deepEqual(findPaymentsByTid(customers, '   '), []);
});

test('claimed suspense entries are audit history and never shown', () => {
  const view = buildWalletReconView({
    report: reportFixture(),
    suspenseEntries: [{ suspenseId: 'SUS-104', amount: 900, wallet: 'JazzCash', senderName: 'Old', tid: 'TXN-OLD', date: '2026-10-09', claimed: true }]
  });
  assert.equal(bucketOf(view, 'suspense-unclaimed').count, 0);
  assert.equal(bucketOf(view, 'suspense-recorded').count, 0);
});

test('invalid suspense entries are dropped, not shown', () => {
  const view = buildWalletReconView({
    report: reportFixture(),
    suspenseEntries: [
      { suspenseId: 'SUS-105', amount: 0, wallet: 'Easypaisa', tid: 'TXN-Z', date: '2026-10-09', claimed: false },
      { suspenseId: 'SUS-106', amount: 100, wallet: '', tid: 'TXN-Z', date: '2026-10-09', claimed: false },
      { suspenseId: 'SUS-107', amount: 100, wallet: 'Easypaisa', tid: 'TXN-Z', date: 'not-a-date', claimed: false },
      { suspenseId: 'SUS-108', amount: 100, wallet: 'Easypaisa', tid: 'TXN-Z', date: '2026-09-09', claimed: false },
      null,
      'junk'
    ]
  });
  assert.equal(bucketOf(view, 'suspense-unclaimed').count, 0);
});

test('non-array inputs are guarded', () => {
  const report = { month: '2026-10', payments: 'nope', duplicateGroups: null, pendingVerification: null, digitalTotal: 0, digitalCount: 0 };
  const view = buildWalletReconView({ report, inboxItems: 'nope', suspenseEntries: 42, customers: null });
  assert.equal(view.rows.length, 0);
  assert.equal(view.ledger.digitalTotal, 0);
});

test('inputs are not mutated', () => {
  const report = reportFixture();
  const inboxItems = [{ txnId: 'IN-1', amount: 100, direction: 'Received', recorded: false, date: '2026-10-10' }];
  const suspenseEntries = [{ suspenseId: 'SUS-101', amount: 200, wallet: 'Easypaisa', tid: 'TXN-NEW', date: '2026-10-09', claimed: false }];
  for (const o of [report, inboxItems, suspenseEntries]) Object.freeze(o);
  Object.freeze(report.payments);
  const view = buildWalletReconView({ report, inboxItems, suspenseEntries });
  assert.ok(view.rows.length > 0);
});

test('ledger rows carry method, tid and sender label', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  const row = bucketOf(view, 'matched').rows[0];
  assert.equal(row.method, 'Easypaisa');
  assert.equal(row.billMonth, '2026-10');
  assert.equal(row.paymentId, 'p1');
});

test('settings checklist: all configured, none configured, partial bank', () => {
  const full = describeDigitalSettings({ ownerRaastId: '03001234567', ownerTillId: 'TILL1', ownerAccountNumber: 'PK00', ownerQrDataUrl: 'data:image/png;base64,xx', ownerPhone: '03001234567' });
  assert.equal(full.length, 5);
  assert.ok(full.every((s) => s.configured && s.action === 'Ready'));
  const none = describeDigitalSettings({});
  assert.ok(none.every((s) => !s.configured));
  const partial = describeDigitalSettings({ ownerBankName: 'Some Bank', ownerAccountNumber: '' });
  assert.equal(partial.find((s) => s.key === 'bank').configured, false);
  assert.equal(describeDigitalSettings(null).length, 5);
  assert.equal(buildWalletReconView({ report: reportFixture() }).settings.length, 0);
  assert.equal(buildWalletReconView({ report: reportFixture(), settings: { ownerPhone: '0300' } }).settings.length, 5);
});

test('settings object is not mutated by the checklist', () => {
  const settings = { ownerPhone: ' 03001234567 ' };
  const before = JSON.stringify(settings);
  describeDigitalSettings(settings);
  assert.equal(JSON.stringify(settings), before);
});

test('HTML escapes hostile names and TIDs', () => {
  const report = {
    month: '2026-10',
    payments: [{ date: '2026-10-05', amount: 100, method: 'Easypaisa', transactionId: '<script>alert(1)</script>', customerNumber: 9, customerName: '<img src=x onerror=alert(1)>', walletVerified: false, senderLabel: '' }],
    duplicateGroups: [],
    pendingVerification: [],
    digitalTotal: 100,
    digitalCount: 1
  };
  const html = walletReconViewHtml(buildWalletReconView({ report }));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Unmatched'));
});

test('HTML bucket filter shows only that bucket', () => {
  const view = buildWalletReconView({ report: reportFixture() });
  const html = walletReconViewHtml(view, { bucketFilter: 'disputed' });
  assert.ok(html.includes('Disputed'));
  assert.ok(!html.includes('Matched — verified'));
  const all = walletReconViewHtml(view);
  assert.ok(all.includes('Matched — verified'));
  assert.ok(all.includes('Disputed'));
});

test('HTML empty view and null view render a friendly line', () => {
  assert.ok(walletReconViewHtml(null).includes('No reconciliation data'));
  assert.ok(walletReconViewHtml(buildWalletReconView({ report: null })).includes('No reconciliation data'));
});

test('HTML carries the open-items line and the settings checklist', () => {
  const view = buildWalletReconView({ report: reportFixture(), settings: { ownerPhone: '03001234567' } });
  const html = walletReconViewHtml(view);
  assert.ok(html.includes(`${view.openItems} items need action in 2026-10.`));
  assert.ok(html.includes('Digital payment channels'));
  assert.ok(html.includes('WhatsApp phone'));
});

test('per-bucket totals equal the sum of their rows', () => {
  const view = buildWalletReconView({
    report: reportFixture(),
    inboxItems: [{ txnId: 'IN-1', amount: 400, direction: 'Received', recorded: false, date: '2026-10-10' }],
    suspenseEntries: [{ suspenseId: 'SUS-101', amount: 600, wallet: 'Raast', tid: 'TXN-NEW', date: '2026-10-09', claimed: false }]
  });
  for (const bucket of RECON_BUCKET_ORDER) {
    const b = view.buckets[bucket];
    assert.equal(b.amount, b.rows.reduce((s, r) => s + r.amount, 0), bucket);
    assert.equal(b.count, b.rows.length, bucket);
  }
});

test('empty month view has zero buckets and zero open items', () => {
  const report = buildWalletReconciliation([], '2026-11', []);
  const view = buildWalletReconView({ report });
  assert.equal(view.rows.length, 0);
  assert.equal(view.openItems, 0);
  assert.equal(view.ledger.digitalTotal, 0);
});
