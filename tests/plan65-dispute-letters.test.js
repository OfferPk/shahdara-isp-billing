/**
 * plan65-dispute-letters.test.js — Plan 65: dispute outcome letter
 * draft and monthly dispute-reason view.
 * Pins:
 * - the draft is offered only for a resolved case with a
 *   resolution record; a resolved case with no resolution shows
 *   as awaiting its letter, never with an invented finding;
 * - the draft's figures match the case and the ledger on the
 *   same fixture: resulting balance is bill total minus
 *   payments received minus the adjustment applied, in integer
 *   cents, with a correction/concession counting its recorded
 *   amount, a matched payment counting zero, and a "none" path
 *   counting zero;
 * - a missing or unusable ledger figure leaves the balance
 *   unrecorded, never zero-filled or guessed;
 * - the monthly view's counts match the case log on the same
 *   fixture, undated resolutions belong to no month, and
 *   resolved cases with no resolution are listed as awaiting;
 * - sending is logged once per case with re-send allowed, and
 *   drafting, sending, or viewing never changes any bill,
 *   payment, case, or Waada record;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPUTE_LETTER_VARIANTS,
  validLetterDate,
  validLetterMonth,
  normalizeLetterVariant,
  letterStatus,
  buildOutcomeLetter,
  letterSummaryText,
  buildMonthlyDisputeView,
  monthlyDisputeViewText,
  monthlyDisputeCsv,
  monthlyDisputeFilename,
  logLetterSent,
  findLetterSends,
  letterSentText,
  letterHtml,
} from '../dispute-letters.js';

const resolvedCase = {
  id: 'D-001',
  customerId: 'C-1',
  customerName: 'Ahmed',
  billId: 'B-101',
  billMonth: '2026-10',
  disputedAmount: 500,
  reason: 'double_charge',
  status: 'resolved',
  evidenceNote: 'TID 123',
  outcome: 'Double charge confirmed',
  dateOpened: '2026-10-05',
  mohalla: 'Bani',
};

const correction = {
  caseId: 'D-001',
  finding: 'Bill raised twice for October',
  outcome: 'Double charge confirmed',
  path: 'correction',
  adjustmentAmount: 500,
  linkedId: 'K-9',
  signOffNote: '',
  signOffBy: '',
  dateResolved: '2026-10-20',
};

test('strict dates and months: impossible dates are never dates', () => {
  assert.equal(validLetterDate('2026-02-30'), null);
  assert.equal(validLetterDate('2026-10-20'), '2026-10-20');
  assert.equal(validLetterDate('2026-10-20T09:00:00Z'), '2026-10-20');
  assert.equal(validLetterMonth('2026-13'), null);
  assert.equal(validLetterMonth('2026-10'), '2026-10');
  assert.equal(normalizeLetterVariant('urdu'), 'urdu');
  assert.equal(normalizeLetterVariant('bogus'), 'roman');
});

test('letter status: ready, awaiting, and not resolved', () => {
  assert.equal(letterStatus(resolvedCase, correction), 'ready');
  assert.equal(letterStatus(resolvedCase, null), 'awaiting');
  assert.equal(letterStatus(resolvedCase, { finding: '', outcome: '' }), 'awaiting');
  assert.equal(letterStatus({ ...resolvedCase, status: 'open' }, correction), 'not_resolved');
  assert.equal(letterStatus(null, correction), 'not_resolved');
});

test('roman draft: figures match the case and ledger exactly', () => {
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: correction,
    billTotal: 1500,
    paymentsReceived: 500,
    variant: 'roman',
  });
  assert.ok(letter);
  assert.equal(letter.resultingBalance, 500); // 1500 - 500 - 500
  assert.equal(letter.adjustmentAmount, 500);
  assert.match(letter.text, /Double charge/);
  assert.match(letter.text, /Bill raised twice for October/);
  assert.match(letter.text, /Double charge confirmed/);
  assert.match(letter.text, /K-9/);
  assert.match(letter.text, /Resulting balance: Rs\. 500/);
  assert.equal(letter.variant, DISPUTE_LETTER_VARIANTS.ROMAN);
});

test('urdu draft: urdu reason label and balance line', () => {
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: correction,
    billTotal: 1500,
    paymentsReceived: 500,
    variant: 'urdu',
  });
  assert.ok(letter);
  assert.match(letter.text, /دوہری چارج/);
  assert.match(letter.text, /موجودہ بقایا: Rs\. 500/);
  assert.match(letter.text, /شاہدرہ فائبر نیٹ/);
});

test('none path: bill stands, adjustment zero, balance without adjustment', () => {
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: { ...correction, path: 'none', adjustmentAmount: null, linkedId: '' },
    billTotal: 1500,
    paymentsReceived: 500,
  });
  assert.ok(letter);
  assert.equal(letter.adjustmentAmount, 0);
  assert.equal(letter.resultingBalance, 1000);
  assert.match(letter.text, /stands as issued/);
});

test('matched payment: adjustment zero, payment found line', () => {
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: { ...correction, path: 'matched_payment', adjustmentAmount: 500, linkedId: 'P-7' },
    billTotal: 1500,
    paymentsReceived: 1000,
  });
  assert.ok(letter);
  assert.equal(letter.adjustmentAmount, 0);
  assert.equal(letter.resultingBalance, 500);
  assert.match(letter.text, /payment has been found/);
  assert.match(letter.text, /P-7/);
});

test('missing ledger figures leave the balance unrecorded, never zero-filled', () => {
  const noBill = buildOutcomeLetter({ caseRecord: resolvedCase, resolution: correction, paymentsReceived: 500 });
  assert.equal(noBill.resultingBalance, null);
  assert.match(noBill.text, /not recorded/);
  const noPayments = buildOutcomeLetter({ caseRecord: resolvedCase, resolution: correction, billTotal: 1500 });
  assert.equal(noPayments.resultingBalance, null);
  const negative = buildOutcomeLetter({ caseRecord: resolvedCase, resolution: correction, billTotal: 1500, paymentsReceived: -5 });
  assert.equal(negative.resultingBalance, null);
  const booleanAmount = buildOutcomeLetter({ caseRecord: resolvedCase, resolution: correction, billTotal: true, paymentsReceived: 500 });
  assert.equal(booleanAmount.resultingBalance, null);
});

test('caller-supplied adjustment wins over the recorded amount', () => {
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: correction,
    billTotal: 1500,
    paymentsReceived: 500,
    adjustmentApplied: 200,
  });
  assert.equal(letter.adjustmentAmount, 200);
  assert.equal(letter.resultingBalance, 800);
});

test('unresolved and awaiting cases are never offered a letter', () => {
  assert.equal(buildOutcomeLetter({ caseRecord: { ...resolvedCase, status: 'open' }, resolution: correction, billTotal: 1500, paymentsReceived: 500 }), null);
  assert.equal(buildOutcomeLetter({ caseRecord: resolvedCase, resolution: null, billTotal: 1500, paymentsReceived: 500 }), null);
  assert.equal(letterSummaryText(null), 'No outcome letter for this case.');
});

test('monthly view: counts by reason and outcome match the case log', () => {
  const cases = [
    resolvedCase,
    { ...resolvedCase, id: 'D-002', reason: 'wrong_amount', outcome: 'Amount corrected', dateOpened: '2026-10-06' },
    { ...resolvedCase, id: 'D-003', reason: 'double_charge', outcome: 'Double charge confirmed', dateOpened: '2026-09-02' },
    { ...resolvedCase, id: 'D-004', reason: 'other', outcome: 'Bill stands', dateOpened: '2026-10-09' },
    { ...resolvedCase, id: 'D-005', status: 'open', outcome: null },
  ];
  const resolutions = [
    correction,
    { ...correction, caseId: 'D-002', path: 'correction', adjustmentAmount: 100, linkedId: 'K-10', dateResolved: '2026-10-21' },
    { ...correction, caseId: 'D-003', dateResolved: '2026-09-15' },
    // D-004 resolved but with no resolution record: awaiting, never counted.
  ];
  const view = buildMonthlyDisputeView(cases, resolutions, '2026-10');
  assert.equal(view.resolvedInMonth, 2);
  assert.equal(view.allResolved, 4);
  assert.equal(view.undatedResolved, 0);
  assert.deepEqual(view.byReason, [
    { reason: 'double_charge', label: 'Double charge', count: 1 },
    { reason: 'wrong_amount', label: 'Wrong amount', count: 1 },
  ]);
  assert.deepEqual(view.byOutcome, [
    { outcome: 'Amount corrected', count: 1 },
    { outcome: 'Double charge confirmed', count: 1 },
  ]);
  assert.equal(view.awaiting.length, 1);
  assert.equal(view.awaiting[0].id, 'D-004');
  assert.match(monthlyDisputeViewText(view), /2 resolved disputes in 2026-10/);
  assert.match(monthlyDisputeViewText(view), /1 resolved case still awaiting its letter/);
});

test('monthly view: undated resolutions belong to no month', () => {
  const cases = [resolvedCase];
  const resolutions = [{ ...correction, dateResolved: null }];
  const view = buildMonthlyDisputeView(cases, resolutions, '2026-10');
  assert.equal(view.resolvedInMonth, 0);
  assert.equal(view.undatedResolved, 1);
  assert.equal(view.allResolved, 1);
  assert.deepEqual(view.byReason, []);
});

test('send log: once per case, re-send allowed, half-formed sends ignored', () => {
  let log = [];
  log = logLetterSent(log, { caseId: 'D-001', customerId: 'C-1', sentAt: '2026-10-21T10:00:00Z', channel: 'whatsapp', variant: 'roman' });
  assert.equal(findLetterSends(log, 'D-001').length, 1);
  assert.equal(letterSentText(findLetterSends(log, 'D-001')), 'Outcome letter sent on 2026-10-21.');
  log = logLetterSent(log, { caseId: 'D-001', customerId: 'C-1', sentAt: '2026-10-22T10:00:00Z', channel: 'whatsapp', variant: 'urdu' });
  assert.match(letterSentText(findLetterSends(log, 'D-001')), /and 1 more time — re-send anytime/);
  assert.equal(letterSentText(findLetterSends(log, 'D-999')), 'Outcome letter not sent yet — send it once for this resolved case.');
  const before = log.length;
  log = logLetterSent(log, { caseId: '', customerId: 'C-1', sentAt: '2026-10-23T10:00:00Z' });
  log = logLetterSent(log, { caseId: 'D-001', customerId: 'C-1', sentAt: '' });
  assert.equal(log.length, before);
});

test('inputs are never mutated and the letter carries no payment or Waada field', () => {
  const caseBefore = JSON.stringify(resolvedCase);
  const resolutionBefore = JSON.stringify(correction);
  const letter = buildOutcomeLetter({
    caseRecord: resolvedCase,
    resolution: correction,
    billTotal: 1500,
    paymentsReceived: 500,
  });
  assert.equal(JSON.stringify(resolvedCase), caseBefore);
  assert.equal(JSON.stringify(correction), resolutionBefore);
  const keys = Object.keys(letter);
  assert.ok(!keys.some((key) => /payment|waada|receipt/i.test(key) && key !== 'paymentsReceived'));
  assert.ok(!('paymentId' in letter) && !('waada' in letter));
});

test('html escaping, csv quoting, and filename', () => {
  const letter = buildOutcomeLetter({
    caseRecord: { ...resolvedCase, customerName: '<b>Ahmed</b>' },
    resolution: { ...correction, finding: 'A "quoted" finding' },
    billTotal: 1500,
    paymentsReceived: 500,
  });
  const html = letterHtml(letter, { draftText: letter.text, sends: [] });
  assert.ok(!html.includes('<b>Ahmed</b>'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
  const view = buildMonthlyDisputeView([resolvedCase], [correction], '2026-10');
  const csv = monthlyDisputeCsv(view);
  assert.match(csv, /reason,Double charge,,1/);
  assert.match(csv, /outcome,,Double charge confirmed,1/);
  assert.equal(monthlyDisputeFilename('2026-10'), 'dispute-reasons-2026-10.csv');
  assert.equal(monthlyDisputeFilename('bogus'), 'dispute-reasons.csv');
});

test('cent sums stay exact on fractional amounts', () => {
  const letter = buildOutcomeLetter({
    caseRecord: { ...resolvedCase, disputedAmount: 333.33 },
    resolution: { ...correction, adjustmentAmount: 333.33 },
    billTotal: 1000,
    paymentsReceived: 166.67,
  });
  assert.equal(letter.resultingBalance, 500); // 1000 - 166.67 - 333.33
});
