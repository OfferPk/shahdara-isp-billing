/**
 * plan76-enquiry-log.test.js — Plan 76: inbound enquiry log and
 * unanswered-enquiry queue.
 * Pins:
 * - every enquiry carries exactly one customer, one type, and
 *   one reply status; half-formed records are refused outright,
 *   never stored half-formed;
 * - the pending list shows exactly the unanswered enquiries on
 *   the same fixture, oldest first, undated last;
 * - marking an enquiry answered records the reply draft used
 *   (Plans 72-75) where one was sent, or 'none' otherwise;
 * - a referral needs a linked ticket, case, or request id, and
 *   the link stays visible on the record, including after a
 *   reopen back to pending;
 * - answering or referring an enquiry never changes any bill,
 *   payment, ticket, or request record — the module holds no
 *   such field of its own;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no ticket, case, or request record is
 * ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENQUIRY_TYPES,
  ENQUIRY_TYPE_LABELS,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_REPLY_DRAFTS,
  ENQUIRY_REPLY_DRAFT_LABELS,
  validEnquiryDate,
  enquiryMohallaKey,
  normalizeEnquiry,
  normalizeEnquiryList,
  findEnquiry,
  upsertEnquiry,
  removeEnquiry,
  markEnquiryAnswered,
  referEnquiry,
  reopenEnquiry,
  pendingEnquiries,
  buildEnquirySummary,
  enquirySummaryText,
  enquiryHtml,
  enquiryCsv,
  enquiryFilename,
} from '../enquiry-log.js';

const enquiry = (overrides = {}) => ({
  id: 'e-1',
  customerId: 'cust-1',
  customerName: 'Ahmed',
  date: '2026-10-20',
  type: 'balance',
  status: 'pending',
  channel: 'whatsapp',
  question: 'Mera balance kitna hai?',
  mohalla: 'Bani',
  ...overrides,
});

test('strict dates: impossible dates never stored as a date', () => {
  assert.equal(validEnquiryDate('2026-02-30'), null);
  assert.equal(validEnquiryDate('2026-10-20'), '2026-10-20');
  assert.equal(validEnquiryDate(''), null);
  assert.equal(normalizeEnquiry(enquiry({ date: '2026-02-30' })).date, null);
});

test('mohalla canonical keys mirror the Plan T rule', () => {
  assert.equal(enquiryMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(enquiryMohallaKey('kishti'), 'KISHTII');
  assert.equal(enquiryMohallaKey('chamyaa'), 'CHAMYAAA');
  assert.equal(enquiryMohallaKey('Gulshan'), 'GULSHAN');
  assert.equal(enquiryMohallaKey(''), null);
});

test('half-formed enquiries are refused outright', () => {
  assert.equal(normalizeEnquiry(enquiry({ id: '' })), null);
  assert.equal(normalizeEnquiry(enquiry({ customerId: '' })), null);
  assert.equal(normalizeEnquiry(enquiry({ type: 'unknown' })), null);
  assert.equal(normalizeEnquiry(enquiry({ status: 'unknown' })), null);
  assert.equal(normalizeEnquiry(enquiry({ status: 'referred_ticket' })), null);
  assert.equal(normalizeEnquiry(null), null);
  assert.equal(normalizeEnquiry(enquiry({ status: 'referred_case', linkedId: 'D-001' })).status, 'referred_case');
});

test('type and status catalogues are exactly the plan lists', () => {
  assert.deepEqual(ENQUIRY_TYPES, ['balance', 'payment_history', 'package_info', 'fault_status', 'request_status', 'other']);
  assert.deepEqual(ENQUIRY_STATUSES, ['pending', 'answered', 'referred_ticket', 'referred_case', 'referred_request']);
  assert.equal(ENQUIRY_TYPE_LABELS.balance, 'Balance');
  assert.equal(ENQUIRY_STATUS_LABELS.referred_ticket, 'Referred to ticket');
  assert.deepEqual(ENQUIRY_REPLY_DRAFTS, ['balance_reply', 'payment_slip', 'info_card', 'status_reply', 'none']);
  // Annual Owner Summary cleanup (2026-11-13): all four plan
  // references are stripped from the reply-draft dropdown — the
  // labels are user-facing and must not leak internal plan numbers.
  assert.equal(ENQUIRY_REPLY_DRAFT_LABELS.balance_reply, 'Balance Reply');
  assert.equal(ENQUIRY_REPLY_DRAFT_LABELS.payment_slip, 'Payment history slip');
  assert.equal(ENQUIRY_REPLY_DRAFT_LABELS.info_card, 'Package info card');
  assert.equal(ENQUIRY_REPLY_DRAFT_LABELS.status_reply, 'Fault/request status reply');
});

test('upsert, find, and remove keep exactly one record per id', () => {
  const first = upsertEnquiry([], enquiry());
  assert.equal(first.length, 1);
  const replaced = upsertEnquiry(first, enquiry({ question: 'Updated question' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].question, 'Updated question');
  assert.equal(findEnquiry(replaced, 'e-1').id, 'e-1');
  assert.equal(findEnquiry(replaced, 'missing'), null);
  assert.deepEqual(removeEnquiry(replaced, 'e-1'), []);
  assert.equal(upsertEnquiry(first, enquiry({ id: '' })).length, 1);
});

test('marking answered records the reply draft used, pending only', () => {
  const rows = [enquiry(), enquiry({ id: 'e-2', status: 'answered' })];
  const next = markEnquiryAnswered(rows, 'e-1', 'balance_reply');
  assert.equal(next[0].status, 'answered');
  assert.equal(next[0].replyDraft, 'balance_reply');
  assert.equal(markEnquiryAnswered(rows, 'e-2', 'info_card')[1].replyDraft, 'none');
  assert.equal(markEnquiryAnswered(rows, 'missing', 'info_card').length, 2);
  const noDraft = markEnquiryAnswered(rows, 'e-1', 'not_a_draft');
  assert.equal(noDraft[0].replyDraft, 'none');
});

test('referral needs a linked id and only works from pending', () => {
  const rows = [enquiry(), enquiry({ id: 'e-2', status: 'answered' })];
  const next = referEnquiry(rows, 'e-1', 'referred_ticket', 'T-42');
  assert.equal(next[0].status, 'referred_ticket');
  assert.equal(next[0].linkedId, 'T-42');
  assert.equal(referEnquiry(rows, 'e-1', 'referred_ticket', '')[0].status, 'pending');
  assert.equal(referEnquiry(rows, 'e-1', 'answered', 'T-42')[0].status, 'pending');
  assert.equal(referEnquiry(rows, 'e-2', 'referred_case', 'D-001')[1].status, 'answered');
});

test('reopening keeps the link and the reply draft visible', () => {
  const rows = [enquiry({ status: 'referred_request', linkedId: 'R-7', replyDraft: 'status_reply' })];
  const next = reopenEnquiry(rows, 'e-1');
  assert.equal(next[0].status, 'pending');
  assert.equal(next[0].linkedId, 'R-7');
  assert.equal(next[0].replyDraft, 'status_reply');
  assert.equal(reopenEnquiry([enquiry()], 'e-1')[0].status, 'pending');
});

test('pending list is pending only, oldest first, undated last', () => {
  const rows = [
    enquiry({ id: 'e-new', date: '2026-10-25' }),
    enquiry({ id: 'e-old', date: '2026-10-01' }),
    enquiry({ id: 'e-undated', date: '' }),
    enquiry({ id: 'e-answered', status: 'answered', date: '2026-09-01' }),
    enquiry({ id: 'e-referred', status: 'referred_ticket', linkedId: 'T-1', date: '2026-09-01' }),
  ];
  assert.deepEqual(pendingEnquiries(rows).map((row) => row.id), ['e-old', 'e-new', 'e-undated']);
});

test('pending list filters by type and mohalla, unassigned never dropped', () => {
  const rows = [
    enquiry({ id: 'e-1', type: 'balance', mohalla: 'Bani' }),
    enquiry({ id: 'e-2', type: 'fault_status', mohalla: 'Mohalla Bani' }),
    enquiry({ id: 'e-3', type: 'balance', mohalla: '' }),
  ];
  assert.deepEqual(pendingEnquiries(rows, { type: 'balance' }).map((row) => row.id), ['e-1', 'e-3']);
  assert.deepEqual(pendingEnquiries(rows, { mohalla: 'bani' }).map((row) => row.id), ['e-1', 'e-2']);
  assert.deepEqual(pendingEnquiries(rows, { mohalla: '__unassigned__' }).map((row) => row.id), ['e-3']);
  // Annual Owner Summary cleanup (2026-11-13): the filter
  // placeholder now reads 'Filter by mohalla (or Unassigned)', so
  // the folded word matches the same no-mohalla rows as the
  // literal sentinel.
  assert.deepEqual(pendingEnquiries(rows, { mohalla: 'Unassigned' }).map((row) => row.id), ['e-3']);
  assert.deepEqual(pendingEnquiries(rows, { mohalla: 'unassigned' }).map((row) => row.id), ['e-3']);
});

test('summary counts match the log on the same fixture', () => {
  const rows = [
    enquiry(),
    enquiry({ id: 'e-2', status: 'answered', replyDraft: 'info_card' }),
    enquiry({ id: 'e-3', status: 'referred_ticket', linkedId: 'T-1' }),
    enquiry({ id: 'e-4', status: 'referred_case', linkedId: 'D-1' }),
    enquiry({ id: 'e-5', type: 'fault_status' }),
  ];
  const summary = buildEnquirySummary(rows);
  assert.equal(summary.total, 5);
  assert.equal(summary.pending, 2);
  assert.equal(summary.answered, 1);
  assert.equal(summary.referred, 2);
  assert.equal(summary.byType.balance, 4);
  assert.equal(summary.byType.fault_status, 1);
  assert.match(enquirySummaryText(summary), /5 enquiries/);
  assert.match(enquirySummaryText(summary), /2 pending/);
  // Annual Owner Summary cleanup (2026-11-13): at 0 the summary
  // returns the count line, not 'No enquiries recorded yet.' — the
  // old sentence duplicated the body's empty state, so the same
  // words appeared twice. Same shape as deposit/loan summaries.
  assert.equal(enquirySummaryText(buildEnquirySummary([])), '0 enquiries recorded · 0 pending · 0 answered · 0 referred to a ticket, case, or request queue.');
});

test('non-mutation and no ledger field fence', () => {
  const rows = [enquiry()];
  const before = JSON.stringify(rows);
  markEnquiryAnswered(rows, 'e-1', 'balance_reply');
  referEnquiry(rows, 'e-1', 'referred_ticket', 'T-1');
  pendingEnquiries(rows);
  assert.equal(JSON.stringify(rows), before);
  const keys = Object.keys(normalizeEnquiry(enquiry())).sort();
  assert.deepEqual(keys, ['channel', 'customerId', 'customerName', 'date', 'id', 'linkedId', 'mohalla', 'mohallaKey', 'question', 'replyDraft', 'status', 'type']);
  for (const forbidden of ['billId', 'paymentId', 'amount', 'balance', 'waada', 'ticketId', 'caseId', 'requestId']) {
    assert.ok(!keys.includes(forbidden), `${forbidden} must not be a stored field`);
  }
});

test('HTML escaping, CSV quoting, and filename', () => {
  const rows = [enquiry({ question: 'A "quoted" <note>, with comma' })];
  const html = enquiryHtml(rows);
  assert.ok(!html.includes('<note>'));
  assert.ok(html.includes('&quot;quoted&quot;'));
  const csv = enquiryCsv(rows);
  assert.ok(csv.startsWith('id,customer,date,type,reply_status,channel,question,reply_draft,linked_record,mohalla'));
  assert.ok(csv.includes('"A ""quoted"" <note>, with comma"'));
  assert.equal(enquiryFilename(), 'enquiries.csv');
  assert.match(enquiryHtml([]), /No enquiries recorded yet/);
});

test('normalizeEnquiryList drops half-formed rows and keeps the rest', () => {
  const rows = normalizeEnquiryList([enquiry(), enquiry({ id: '' }), null, enquiry({ id: 'e-2' })]);
  assert.deepEqual(rows.map((row) => row.id), ['e-1', 'e-2']);
});
