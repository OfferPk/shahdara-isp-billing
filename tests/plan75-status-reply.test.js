/**
 * plan75-status-reply.test.js — Plan 75: open fault and request
 * status reply draft (customer asked, operator sends).
 * Pins:
 * - the draft's status, dates, and next step match the ticket
 *   or request record on the same fixture;
 * - a customer with no open ticket or request gets a plain
 *   "no open case" wording, never an invented status;
 * - resolved and closed tickets are never part of the draft —
 *   this plan never replaces the post-resolution confirmation
 *   (Plan 25), which covers resolved tickets only;
 * - an open outage linked to a ticket is named with its area,
 *   cause, and start time, and only an open outage counts;
 * - a missing date, assignee, handler, or next step is said
 *   plainly, never invented;
 * - sending is logged once per customer with re-send allowed,
 *   and drafting or sending never changes any ticket or
 *   request record;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no ticket or request record is ever
 * changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_REPLY_VARIANTS,
  normalizeStatusReplyVariant,
  validStatusReplyDate,
  buildStatusReply,
  statusReplySentText,
  logStatusReplySent,
  findStatusReplySends,
  statusReplyHtml,
} from '../status-reply.js';

const ticket = (overrides = {}) => ({
  id: 't-1',
  customerId: 'cust-1',
  category: 'no_connection',
  priority: 'high',
  status: 'open',
  reportedDate: '2026-10-20',
  assignee: 'Saad',
  note: 'Line down after rain',
  ...overrides,
});

const outage = (overrides = {}) => ({
  id: 'o-1',
  area: 'Bani',
  segment: '',
  startTime: '2026-10-20 08:00',
  causeNote: 'Main splitter fault',
  status: 'open',
  ticketIds: ['t-1'],
  ...overrides,
});

const request = (overrides = {}) => ({
  id: 'r-1',
  customerId: 'cust-1',
  type: 'relocation',
  detail: 'Moving to street 4',
  dateRequested: '2026-10-25',
  status: 'pending',
  handler: '',
  ...overrides,
});

test('strict dates: 2026-02-30 is not a date', () => {
  assert.equal(validStatusReplyDate('2026-02-30'), null);
  assert.equal(validStatusReplyDate('2026-10-20'), '2026-10-20');
  assert.equal(validStatusReplyDate(''), null);
});

test('variant normalisation defaults to roman', () => {
  assert.equal(normalizeStatusReplyVariant('urdu'), 'urdu');
  assert.equal(normalizeStatusReplyVariant('bogus'), 'roman');
  assert.equal(normalizeStatusReplyVariant(''), 'roman');
});

test('draft matches the ticket record: status, date, assignee next step', () => {
  const reply = buildStatusReply({ customerId: 'cust-1', customerName: 'Ahmed', tickets: [ticket()], requests: [] });
  assert.equal(reply.kind, 'open');
  assert.equal(reply.items.length, 1);
  assert.match(reply.text, /No connection/);
  assert.match(reply.text, /Open/);
  assert.match(reply.text, /2026-10-20/);
  assert.match(reply.text, /Assigned to Saad/);
});

test('open outage linked to a ticket is named with area, cause, start', () => {
  const reply = buildStatusReply({ customerId: 'cust-1', tickets: [ticket()], outages: [outage()] });
  assert.equal(reply.items[0].outage.area, 'Bani');
  assert.match(reply.text, /Bani/);
  assert.match(reply.text, /Main splitter fault/);
  assert.match(reply.text, /2026-10-20 08:00/);
  assert.match(reply.text, /open outage/);
});

test('only an open outage counts: resolved outage is not linked', () => {
  const reply = buildStatusReply({ customerId: 'cust-1', tickets: [ticket()], outages: [outage({ status: 'resolved' })] });
  assert.equal(reply.items[0].outage, null);
  assert.doesNotMatch(reply.text, /Main splitter fault/);
  assert.match(reply.text, /Assigned to Saad/);
});

test('resolved and closed tickets are never in the draft', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    tickets: [ticket({ id: 't-2', status: 'resolved' }), ticket({ id: 't-3', status: 'closed' })],
    requests: [],
  });
  assert.equal(reply.kind, 'none');
  assert.match(reply.text, /koi open case nahi hai/);
});

test('no open case wording, never an invented status', () => {
  const reply = buildStatusReply({ customerId: 'cust-1', customerName: 'Ahmed', tickets: [], requests: [] });
  assert.equal(reply.kind, 'none');
  assert.deepEqual(reply.items, []);
  assert.match(reply.text, /koi open case nahi hai/);
  assert.doesNotMatch(reply.text, /Status: Open/);
  const urdu = buildStatusReply({ customerId: 'cust-1', tickets: [], variant: 'urdu' });
  assert.match(urdu.text, /کوئی کھلا کیس نہیں ہے/);
});

test('requests are listed with type, status, date, handler next step', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    tickets: [],
    requests: [request({ handler: 'Saad' })],
  });
  assert.equal(reply.kind, 'open');
  assert.match(reply.text, /Relocation/);
  assert.match(reply.text, /Pending/);
  assert.match(reply.text, /2026-10-25/);
  assert.match(reply.text, /Being handled by Saad/);
});

test('items are oldest first, tickets before requests on the same date', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    tickets: [ticket({ reportedDate: '2026-10-25' })],
    requests: [request({ dateRequested: '2026-10-20' })],
  });
  assert.equal(reply.items[0].kind, 'request');
  assert.equal(reply.items[1].kind, 'ticket');
  const sameDay = buildStatusReply({
    customerId: 'cust-1',
    tickets: [ticket({ reportedDate: '2026-10-20' })],
    requests: [request({ dateRequested: '2026-10-20' })],
  });
  assert.equal(sameDay.items[0].kind, 'ticket');
  assert.equal(sameDay.items[1].kind, 'request');
});

test('missing fields are said plainly, never invented', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    tickets: [ticket({ assignee: '', reportedDate: '2026-02-30' })],
    requests: [request({ handler: '', dateRequested: '' })],
  });
  assert.match(reply.text, /Waiting for assignment/);
  assert.match(reply.text, /not recorded/);
  assert.match(reply.text, /Waiting in the queue/);
  assert.equal(reply.items[0].reportedDate, null);
  assert.equal(reply.items[1].dateRequested, null);
});

test('other customers, done and declined requests are excluded', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    tickets: [ticket({ customerId: 'cust-2' })],
    requests: [
      request({ id: 'r-2', status: 'done' }),
      request({ id: 'r-3', status: 'declined', declineReason: 'No' }),
    ],
  });
  assert.equal(reply.kind, 'none');
});

test('send log: once per customer, re-send allowed, half-formed ignored', () => {
  let log = logStatusReplySent([], { customerId: 'cust-1', sentAt: '2026-11-04T10:00:00Z', channel: 'whatsapp', variant: 'roman' });
  log = logStatusReplySent(log, { customerId: 'cust-1', sentAt: '2026-11-04T11:00:00Z', channel: 'whatsapp', variant: 'urdu' });
  log = logStatusReplySent(log, { sentAt: '2026-11-04T12:00:00Z' });
  assert.equal(findStatusReplySends(log, 'cust-1').length, 2);
  assert.equal(findStatusReplySends(log, 'cust-2').length, 0);
  assert.match(statusReplySentText(findStatusReplySends(log, 'cust-1')), /2 times/);
  assert.equal(statusReplySentText([]), 'Not sent yet.');
});

test('non-mutation and no-ledger-field fence', () => {
  const ticketsIn = [ticket()];
  const requestsIn = [request()];
  const beforeTickets = JSON.stringify(ticketsIn);
  const beforeRequests = JSON.stringify(requestsIn);
  const reply = buildStatusReply({ customerId: 'cust-1', tickets: ticketsIn, requests: requestsIn });
  assert.equal(JSON.stringify(ticketsIn), beforeTickets);
  assert.equal(JSON.stringify(requestsIn), beforeRequests);
  const keys = new Set();
  for (const item of reply.items) Object.keys(item).forEach((k) => keys.add(k));
  for (const forbidden of ['billId', 'paymentId', 'amount', 'balance', 'waada', 'package']) {
    assert.ok(!keys.has(forbidden), `must not carry ${forbidden}`);
  }
  assert.equal(buildStatusReply({}), null);
  assert.equal(buildStatusReply({ customerId: '' }), null);
});

test('HTML escaping in the draft panel', () => {
  const reply = buildStatusReply({
    customerId: 'cust-1',
    customerName: '<b>Ahmed</b>',
    tickets: [ticket({ note: '<script>' })],
  });
  const html = statusReplyHtml(reply, { draftText: reply.text, sends: [] });
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
});
