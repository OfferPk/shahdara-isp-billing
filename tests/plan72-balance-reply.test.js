/**
 * plan72-balance-reply.test.js — Plan 72: balance enquiry reply
 * draft (customer asked, operator sends).
 * Pins:
 * - the draft's balance, due date, and last payment match the
 *   ledger on the same fixture, in integer cents;
 * - a customer with a zero balance gets a "no amount due"
 *   wording, never a zero presented as a demand;
 * - a customer with an open dispute sees the undisputed figure
 *   with a note that a case is open, and a fully disputed
 *   balance reads as "no undisputed amount due", never as a
 *   demand for the disputed amount;
 * - a missing or unusable outstanding figure refuses the whole
 *   draft, never zero-filled or guessed; a missing due date or
 *   last payment is said plainly, never invented;
 * - sending is logged once per customer with re-send allowed,
 *   and drafting or sending never changes any bill, payment,
 *   case, or Waada record;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BALANCE_REPLY_VARIANTS,
  normalizeBalanceReplyVariant,
  validBalanceReplyDate,
  buildBalanceReply,
  balanceReplySummaryText,
  logBalanceReplySent,
  findBalanceReplySends,
  balanceReplySentText,
  balanceReplyHtml,
} from '../balance-reply.js';

const base = {
  customerId: 'C-1',
  customerName: 'Ahmed',
  outstanding: 1000,
  dueDate: '2026-11-05',
  lastPayment: { amount: 500, date: '2026-10-05' },
  openDisputes: [],
  variant: 'roman',
};

test('strict dates: impossible dates refused, datetime contributes only its date part', () => {
  assert.equal(validBalanceReplyDate('2026-02-30'), null);
  assert.equal(validBalanceReplyDate('2026-11-05'), '2026-11-05');
  assert.equal(validBalanceReplyDate('2026-11-05T10:00:00'), '2026-11-05');
  assert.equal(validBalanceReplyDate(''), null);
  assert.equal(validBalanceReplyDate('not a date'), null);
});

test('variant normalisation: urdu kept, anything else falls back to roman', () => {
  assert.equal(normalizeBalanceReplyVariant('urdu'), BALANCE_REPLY_VARIANTS.URDU);
  assert.equal(normalizeBalanceReplyVariant('URDU'), BALANCE_REPLY_VARIANTS.URDU);
  assert.equal(normalizeBalanceReplyVariant('english'), BALANCE_REPLY_VARIANTS.ROMAN);
  assert.equal(normalizeBalanceReplyVariant(''), BALANCE_REPLY_VARIANTS.ROMAN);
});

test('plain draft: balance, due date, and last payment match the fixture exactly', () => {
  const reply = buildBalanceReply(base);
  assert.ok(reply);
  assert.equal(reply.outstandingCents, 100000);
  assert.equal(reply.balance, 1000);
  assert.equal(reply.balanceKind, 'due');
  assert.equal(reply.hasOpenDispute, false);
  assert.equal(reply.dueDate, '2026-11-05');
  assert.deepEqual(reply.lastPayment, { amountCents: 50000, amount: 500, date: '2026-10-05' });
  assert.match(reply.text, /Your current balance is Rs\. 1000\./);
  assert.match(reply.text, /Due date: 2026-11-05\./);
  assert.match(reply.text, /Last payment: Rs\. 500 on 2026-10-05\./);
  assert.equal(balanceReplySummaryText(reply), 'Current balance Rs. 1000.');
});

test('zero balance gets a "no amount due" wording, never a zero presented as a demand', () => {
  const reply = buildBalanceReply({ ...base, outstanding: 0 });
  assert.ok(reply);
  assert.equal(reply.balanceKind, 'none');
  assert.equal(reply.balance, 0);
  assert.match(reply.text, /You have no amount due at the moment\./);
  assert.doesNotMatch(reply.text, /Your current balance is Rs\. 0/);
  assert.equal(balanceReplySummaryText(reply), 'No amount due.');
});

test('open dispute: undisputed balance shown with a note, exact cent sums', () => {
  const reply = buildBalanceReply({
    ...base,
    openDisputes: [{ disputedAmount: 333.33 }, { disputedAmount: 166.67 }],
  });
  assert.ok(reply);
  assert.equal(reply.hasOpenDispute, true);
  assert.equal(reply.openDisputeCount, 2);
  assert.equal(reply.disputedCents, 50000);
  assert.equal(reply.disputedAmount, 500);
  assert.equal(reply.undisputedCents, 50000);
  assert.equal(reply.balance, 500);
  assert.equal(reply.balanceKind, 'undisputed');
  assert.equal(reply.excessCents, 0);
  assert.match(reply.text, /Your undisputed balance is Rs\. 500\./);
  assert.match(reply.text, /a dispute case is open on your bill \(Rs\. 500\)/);
  assert.match(reply.text, /does not include the disputed amount/);
  assert.equal(balanceReplySummaryText(reply), 'Undisputed balance Rs. 500 (disputed Rs. 500 not included).');
});

test('fully disputed balance: no undisputed amount due, excess reported, never negative', () => {
  const reply = buildBalanceReply({
    ...base,
    outstanding: 500,
    openDisputes: [{ disputedAmount: 800 }],
  });
  assert.ok(reply);
  assert.equal(reply.balance, 0);
  assert.equal(reply.excessCents, 30000);
  assert.match(reply.text, /You have no undisputed amount due at the moment\./);
  assert.match(reply.text, /exceeds the outstanding balance by Rs\. 300/);
});

test('missing or unusable outstanding refuses the whole draft, never zero-filled', () => {
  for (const bad of [null, undefined, '', true, -5, Number.NaN, 'not a number']) {
    assert.equal(buildBalanceReply({ ...base, outstanding: bad }), null, `outstanding ${String(bad)}`);
  }
});

test('missing due date and last payment are said plainly, never invented', () => {
  const reply = buildBalanceReply({ ...base, dueDate: '', lastPayment: null });
  assert.ok(reply);
  assert.equal(reply.dueDate, null);
  assert.equal(reply.lastPayment, null);
  assert.match(reply.text, /Due date: not recorded\./);
  assert.match(reply.text, /No payment recorded yet\./);
  const badPayment = buildBalanceReply({ ...base, lastPayment: { amount: 500, date: '2026-02-30' } });
  assert.equal(badPayment.lastPayment, null);
  const badAmount = buildBalanceReply({ ...base, lastPayment: { amount: '', date: '2026-10-05' } });
  assert.equal(badAmount.lastPayment, null);
});

test('unusable dispute entries are counted, never zero-filled into the total', () => {
  const reply = buildBalanceReply({
    ...base,
    openDisputes: [{ disputedAmount: 200 }, { disputedAmount: '' }, { disputedAmount: true }],
  });
  assert.equal(reply.disputedCents, 20000);
  assert.equal(reply.unusableDisputes, 2);
  assert.equal(reply.balance, 800);
  assert.match(balanceReplyHtml(reply), /Dispute entries with no usable amount: 2 \(not counted\)/);
});

test('urdu variant carries the same figures in Urdu script', () => {
  const reply = buildBalanceReply({
    ...base,
    openDisputes: [{ disputedAmount: 500 }],
    variant: 'urdu',
  });
  assert.equal(reply.variant, BALANCE_REPLY_VARIANTS.URDU);
  assert.match(reply.text, /السلام علیکم Ahmed،/);
  assert.match(reply.text, /آپ کا غیر متنازعہ بقایا: Rs\. 500۔/);
  assert.match(reply.text, /ادائیگی کی آخری تاریخ: 2026-11-05۔/);
  assert.match(reply.text, /آخری ادائیگی: Rs\. 500، تاریخ 2026-10-05۔/);
  assert.match(reply.text, /شاہدرہ فائبر نیٹ/);
});

test('send log: once per customer, re-send allowed, half-formed entries ignored', () => {
  const empty = [];
  const logged = logBalanceReplySent(empty, { customerId: 'C-1', sentAt: '2026-11-04T10:00:00', channel: 'whatsapp', variant: 'roman' });
  assert.equal(empty.length, 0, 'log is never mutated');
  assert.equal(logged.length, 1);
  assert.equal(findBalanceReplySends(logged, 'C-1').length, 1);
  assert.equal(findBalanceReplySends(logged, 'C-2').length, 0);
  assert.equal(balanceReplySentText(findBalanceReplySends(logged, 'C-1')), 'Balance reply sent on 2026-11-04.');
  const resent = logBalanceReplySent(logged, { customerId: 'C-1', sentAt: '2026-11-05T10:00:00', channel: 'whatsapp', variant: 'roman' });
  assert.equal(resent.length, 2);
  assert.match(balanceReplySentText(findBalanceReplySends(resent, 'C-1')), /and 1 more time/);
  assert.equal(logBalanceReplySent(logged, { customerId: '', sentAt: '2026-11-04T10:00:00' }).length, 1);
  assert.equal(logBalanceReplySent(logged, { customerId: 'C-1', sentAt: '' }).length, 1);
  assert.equal(balanceReplySentText([]), 'Balance reply not sent yet.');
});

test('non-mutation and no-ledger-field fence', () => {
  const input = { ...base, openDisputes: [{ disputedAmount: 100 }] };
  const snapshot = JSON.stringify(input);
  const reply = buildBalanceReply(input);
  assert.equal(JSON.stringify(input), snapshot, 'input never mutated');
  const forbidden = ['billTotal', 'payments', 'paymentsReceived', 'waada', 'promiseAmount', 'bill', 'receipt'];
  for (const key of forbidden) {
    assert.ok(!(key in reply), `reply must not carry ${key}`);
  }
});

test('html escapes names and figures, and shows the draft and send state', () => {
  const reply = buildBalanceReply({ ...base, customerName: '<script>alert(1)</script>' });
  const html = balanceReplyHtml(reply, { draftText: reply.text, sends: [] });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Current balance: Rs\. 1000/);
  assert.match(html, /Balance reply not sent yet\./);
  assert.equal(balanceReplyHtml(null), '<p class="empty-state">Balance reply unavailable — the outstanding figure is missing or unusable.</p>');
});
