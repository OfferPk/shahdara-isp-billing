/**
 * plan63-payment-claims.test.js — Plan 63: "I already paid"
 * payment-claim check workflow.
 * Pins:
 * - every claim carries a channel, a reference, and exactly one
 *   outcome; half-formed records are refused, never stored
 *   half-formed;
 * - a matched claim links to the payment or suspense item by id
 *   only, without duplicating it, and a matched claim with no
 *   link id is refused;
 * - a not-found claim stays visible with a follow-up note until
 *   the operator closes it with a reason; closing it without a
 *   reason is refused;
 * - recording a claim never carries a payment row, a suspense
 *   row, or a bill field, and inputs are never mutated;
 * - impossible dates (2026-02-30) are refused; amounts sum in
 *   integer cents.
 * Synthetic data only; no payment record is ever created or
 * altered by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLAIM_CHANNELS,
  CLAIM_OUTCOMES,
  validClaimDate,
  claimMohallaKey,
  normalizePaymentClaim,
  normalizePaymentClaimList,
  upsertPaymentClaim,
  removePaymentClaim,
  findPaymentClaim,
  setClaimOutcome,
  closePaymentClaim,
  reopenPaymentClaim,
  openPaymentClaims,
  buildClaimSummary,
  claimSummaryText,
  claimHtml,
  claimCsv,
  claimFilename,
} from '../payment-claims.js';

function baseClaim(overrides = {}) {
  return {
    id: 'C-001',
    customerId: 'c1',
    customerName: 'Ayesha',
    dateClaimed: '2026-10-05',
    amount: 1500,
    channel: 'easypaisa',
    reference: 'TID-987654321',
    outcome: 'pending',
    mohalla: 'Mohalla Bani',
    ...overrides,
  };
}

test('strict dates: impossible dates are refused, datetimes keep only the date part', () => {
  assert.equal(validClaimDate('2026-02-30'), null);
  assert.equal(validClaimDate('2026-10-05'), '2026-10-05');
  assert.equal(validClaimDate('2026-10-05T14:30:00'), '2026-10-05');
  assert.equal(validClaimDate('not a date'), null);
  assert.equal(normalizePaymentClaim(baseClaim({ dateClaimed: '2026-02-30' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ dateClaimed: '' })).dateClaimed, null);
});

test('mohalla canonical keys mirror the Plan T rule', () => {
  assert.equal(claimMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(claimMohallaKey('kishti'), 'KISHTII');
  assert.equal(claimMohallaKey('Chamyaa'), 'CHAMYAAA');
  assert.equal(claimMohallaKey('Gulshan'), 'GULSHAN');
  assert.equal(claimMohallaKey(''), null);
});

test('half-formed claims are refused, never stored half-formed', () => {
  assert.equal(normalizePaymentClaim(baseClaim({ id: '' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ customerId: '' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ reference: '  ' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ channel: 'crypto' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ amount: 0 })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ amount: -50 })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ amount: 'abc' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ amount: true })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ outcome: 'guessed' })), null);
  assert.deepEqual(upsertPaymentClaim([], baseClaim({ reference: '' })), []);
});

test('a matched claim needs its link id, and the link is only an id', () => {
  assert.equal(normalizePaymentClaim(baseClaim({ outcome: 'matched_payment' })), null);
  assert.equal(normalizePaymentClaim(baseClaim({ outcome: 'matched_suspense' })), null);
  const matched = normalizePaymentClaim(baseClaim({ outcome: 'matched_payment', linkedId: 'PAY-441' }));
  assert.equal(matched.linkedId, 'PAY-441');
  assert.ok(!('payment' in matched) && !('suspense' in matched) && !('bill' in matched));
  const suspense = normalizePaymentClaim(baseClaim({ outcome: 'matched_suspense', linkedId: 'SUS-101' }));
  assert.equal(suspense.linkedId, 'SUS-101');
});

test('upsert, find, and remove keep the list clean', () => {
  let list = upsertPaymentClaim([], baseClaim());
  list = upsertPaymentClaim(list, baseClaim({ id: 'C-002', amount: 500, channel: 'cash', reference: 'SLIP-7' }));
  assert.equal(list.length, 2);
  assert.equal(findPaymentClaim(list, 'C-002').amount, 500);
  list = upsertPaymentClaim(list, baseClaim({ id: 'C-002', amount: 600, channel: 'cash', reference: 'SLIP-7' }));
  assert.equal(list.length, 2);
  assert.equal(findPaymentClaim(list, 'C-002').amount, 600);
  assert.equal(removePaymentClaim(list, 'C-001').length, 1);
  assert.equal(findPaymentClaim(list, 'nope'), null);
});

test('outcome moves: matched needs a link, not-found keeps the follow-up note', () => {
  const list = normalizePaymentClaimList([baseClaim()]);
  assert.deepEqual(setClaimOutcome(list, 'C-001', 'matched_payment'), list);
  const matched = setClaimOutcome(list, 'C-001', 'matched_payment', 'PAY-441');
  assert.equal(matched[0].outcome, 'matched_payment');
  assert.equal(matched[0].linkedId, 'PAY-441');
  const notFound = setClaimOutcome(list, 'C-001', 'not_found', '', 'Ask Saad to check the Easypaisa statement');
  assert.equal(notFound[0].outcome, 'not_found');
  assert.equal(notFound[0].followUpNote, 'Ask Saad to check the Easypaisa statement');
  assert.equal(notFound[0].closed, false);
  assert.deepEqual(setClaimOutcome(list, 'C-001', 'guessed'), list);
});

test('a not-found claim closes only with a reason; matched closes freely', () => {
  const notFound = normalizePaymentClaimList([baseClaim({ outcome: 'not_found', followUpNote: 'Check statement' })]);
  assert.deepEqual(closePaymentClaim(notFound, 'C-001'), notFound);
  assert.deepEqual(closePaymentClaim(notFound, 'C-001', '  '), notFound);
  const closed = closePaymentClaim(notFound, 'C-001', 'No matching transfer on the statement');
  assert.equal(closed[0].closed, true);
  assert.equal(closed[0].closeReason, 'No matching transfer on the statement');
  assert.deepEqual(closePaymentClaim(closed, 'C-001', 'again'), closed);
  const matched = [baseClaim({ outcome: 'matched_payment', linkedId: 'PAY-441' })];
  assert.equal(closePaymentClaim(matched, 'C-001')[0].closed, true);
  assert.equal(normalizePaymentClaim(baseClaim({ outcome: 'not_found', closed: true })), null);
});

test('reopen restores a closed claim to the open list', () => {
  const list = [baseClaim({ outcome: 'not_found', closed: true, closeReason: 'Checked' })];
  assert.equal(openPaymentClaims(list).length, 0);
  const reopened = reopenPaymentClaim(list, 'C-001');
  assert.equal(reopened[0].closed, false);
  assert.equal(reopened[0].closeReason, '');
  assert.equal(openPaymentClaims(reopened).length, 1);
});

test('open list: closed claims are history, oldest claimed first, undated last', () => {
  const list = [
    baseClaim({ id: 'C-003', dateClaimed: '2026-10-09' }),
    baseClaim({ id: 'C-001', dateClaimed: '2026-10-05' }),
    baseClaim({ id: 'C-002', dateClaimed: '' }),
    baseClaim({ id: 'C-004', dateClaimed: '2026-10-01', closed: true, outcome: 'matched_payment', linkedId: 'PAY-1' }),
  ];
  assert.deepEqual(openPaymentClaims(list).map((entry) => entry.id), ['C-001', 'C-003', 'C-002']);
});

test('open list filters by outcome, channel, and mohalla', () => {
  const list = [
    baseClaim({ id: 'C-001', outcome: 'not_found', channel: 'easypaisa', mohalla: 'Bani' }),
    baseClaim({ id: 'C-002', outcome: 'matched_payment', linkedId: 'PAY-1', channel: 'cash', mohalla: 'Kishti' }),
    baseClaim({ id: 'C-003', outcome: 'pending', channel: 'easypaisa', mohalla: '' }),
  ];
  assert.deepEqual(openPaymentClaims(list, { outcome: 'not_found' }).map((entry) => entry.id), ['C-001']);
  assert.deepEqual(openPaymentClaims(list, { channel: 'cash' }).map((entry) => entry.id), ['C-002']);
  assert.deepEqual(openPaymentClaims(list, { mohalla: 'Mohalla Bani' }).map((entry) => entry.id), ['C-001']);
  assert.deepEqual(openPaymentClaims(list, { mohalla: '__unassigned__' }).map((entry) => entry.id), ['C-003']);
});

test('summary sums exactly in integer cents', () => {
  const list = [
    baseClaim({ id: 'C-001', amount: 333.33, outcome: 'not_found' }),
    baseClaim({ id: 'C-002', amount: 166.67, outcome: 'matched_payment', linkedId: 'PAY-1' }),
    baseClaim({ id: 'C-003', amount: 500, outcome: 'pending' }),
  ];
  const summary = buildClaimSummary(list);
  assert.equal(summary.total, 3);
  assert.equal(summary.totalAmount, 1000);
  assert.equal(summary.byOutcome.not_found.amount, 333.33);
  assert.equal(summary.byOutcome.matched_payment.amount, 166.67);
  assert.match(claimSummaryText(summary), /3 claims totalling Rs\. 1000/);
  assert.equal(claimSummaryText(buildClaimSummary([])), 'No payment claims recorded yet.');
});

test('inputs are never mutated and no payment field is ever carried', () => {
  const claim = baseClaim();
  const before = JSON.stringify(claim);
  const list = [claim];
  setClaimOutcome(list, 'C-001', 'matched_payment', 'PAY-441');
  closePaymentClaim(list, 'C-001', 'reason');
  assert.equal(JSON.stringify(claim), before);
  const stored = normalizePaymentClaim(claim);
  assert.ok(!('payment' in stored) && !('suspense' in stored) && !('bill' in stored) && !('waada' in stored));
  assert.equal(Object.keys(stored).sort().join(','), 'amount,amountCents,channel,closeReason,closed,customerId,customerName,dateClaimed,followUpNote,id,linkedId,mohalla,outcome,reference');
});

test('html escapes, csv quotes, and filename are well formed', () => {
  const list = [baseClaim({ customerName: 'Ayesha <script>', reference: 'TID "9", 1' })];
  const html = claimHtml(list);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Ayesha &lt;script&gt;'));
  const csv = claimCsv(list);
  assert.ok(csv.includes('"TID ""9"", 1"'));
  assert.match(claimFilename(), /^payment-claims-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(claimHtml([]), '<p class="empty-note">No claims in this view.</p>');
});

test('catalogues are exactly the plan’s channels and outcomes', () => {
  assert.deepEqual(CLAIM_CHANNELS, ['cash', 'easypaisa', 'jazzcash', 'bank_transfer', 'other']);
  assert.deepEqual(CLAIM_OUTCOMES, ['pending', 'matched_payment', 'matched_suspense', 'not_found']);
});
