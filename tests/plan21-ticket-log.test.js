import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_OPEN_STATUSES,
  validTicketDate,
  wholeDaysBetweenTicketDates,
  normalizeTicket,
  createTicket,
  normalizeTicketList,
  updateTicketStatus,
  closeTicket,
  updateTicketAssignee,
  openTicketList,
  ticketMatchesMohalla,
  filterTicketList,
  sortTicketList,
  daysTicketWaiting,
  ticketSummary,
  ticketSummaryText,
  ticketHtml,
  ticketCsv,
  ticketFilename,
} from '../ticket-log.js';

const TODAY = '2026-11-10';

function ticket(overrides = {}) {
  return {
    id: 'T1',
    customerId: 'C1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    mohallaKey: 'bani',
    category: 'no_connection',
    priority: 'high',
    status: 'open',
    reportedDate: '2026-11-05',
    assignee: 'Saad',
    note: 'No internet since morning',
    ...overrides,
  };
}

// Catalogue: exactly the plan's five categories and five statuses.
test('plan21: catalogue carries the plan categories, priorities and statuses', () => {
  assert.deepEqual([...TICKET_CATEGORIES], [
    'no_connection', 'slow_speed', 'billing_query', 'device_fault', 'relocation_request',
  ]);
  assert.equal(TICKET_CATEGORY_LABELS.relocation_request, 'Relocation request');
  assert.deepEqual([...TICKET_PRIORITIES], ['low', 'medium', 'high', 'urgent']);
  assert.deepEqual([...TICKET_STATUSES], ['open', 'assigned', 'in_progress', 'resolved', 'closed']);
  assert.deepEqual([...TICKET_OPEN_STATUSES], ['open', 'assigned', 'in_progress']);
});

test('plan21: validTicketDate accepts real dates and rejects impossible ones', () => {
  assert.equal(validTicketDate('2026-11-05'), '2026-11-05');
  assert.equal(validTicketDate('2026-02-30'), null);
  assert.equal(validTicketDate('05-11-2026'), null);
  assert.equal(validTicketDate(''), null);
  assert.equal(validTicketDate(null), null);
});

test('plan21: whole days between dates, invalid gives null', () => {
  assert.equal(wholeDaysBetweenTicketDates('2026-11-05', '2026-11-10'), 5);
  assert.equal(wholeDaysBetweenTicketDates('2026-11-10', '2026-11-05'), -5);
  assert.equal(wholeDaysBetweenTicketDates('2026-02-30', '2026-11-10'), null);
});

// Normalisation: identity is strict, display defaults are forgiving.
test('plan21: normalize keeps a good ticket verbatim', () => {
  const input = ticket();
  const out = normalizeTicket(input);
  assert.deepEqual(out, input);
  assert.notEqual(out, input);
});

test('plan21: normalize returns null without a customer', () => {
  assert.equal(normalizeTicket(ticket({ customerId: '' })), null);
  assert.equal(normalizeTicket(ticket({ customerId: '   ' })), null);
  assert.equal(normalizeTicket(null), null);
});

test('plan21: normalize returns null for an unknown category, never invents one', () => {
  assert.equal(normalizeTicket(ticket({ category: 'router_install' })), null);
  assert.equal(normalizeTicket(ticket({ category: '' })), null);
});

test('plan21: unknown priority falls back to medium, unknown status to open', () => {
  const out = normalizeTicket(ticket({ priority: 'critical', status: 'waiting' }));
  assert.equal(out.priority, 'medium');
  assert.equal(out.status, 'open');
});

test('plan21: bad reported date becomes null, never guessed', () => {
  assert.equal(normalizeTicket(ticket({ reportedDate: '2026-02-30' })).reportedDate, null);
  assert.equal(normalizeTicket(ticket({ reportedDate: '' })).reportedDate, null);
});

test('plan21: normalize trims text fields and never mutates the input', () => {
  const input = ticket({ customerName: '  Ahmed  ', note: '  hello  ' });
  const out = normalizeTicket(input);
  assert.equal(out.customerName, 'Ahmed');
  assert.equal(out.note, 'hello');
  assert.equal(input.customerName, '  Ahmed  ');
});

test('plan21: createTicket requires exactly one customer and category', () => {
  assert.ok(createTicket(ticket()));
  assert.equal(createTicket(ticket({ customerId: '' })), null);
  assert.equal(createTicket(ticket({ category: 'other' })), null);
});

test('plan21: normalizeTicketList drops unusable entries and keeps order', () => {
  const out = normalizeTicketList([ticket({ id: 'T1' }), ticket({ id: 'T2', customerId: '' }), ticket({ id: 'T3' })]);
  assert.deepEqual(out.map((t) => t.id), ['T1', 'T3']);
  assert.deepEqual(normalizeTicketList('nope'), []);
});

// Status changes: only the status field moves.
test('plan21: updateTicketStatus changes only the matched ticket status', () => {
  const list = [ticket({ id: 'T1' }), ticket({ id: 'T2', status: 'assigned' })];
  const out = updateTicketStatus(list, 'T2', 'in_progress');
  assert.equal(out[1].status, 'in_progress');
  assert.equal(out[0].status, 'open');
  assert.equal(out[1].customerName, 'Ahmed');
  assert.equal(list[1].status, 'assigned');
});

test('plan21: updateTicketStatus leaves everything unchanged for bad status or id', () => {
  const list = [ticket()];
  assert.deepEqual(updateTicketStatus(list, 'T1', 'waiting'), list);
  assert.deepEqual(updateTicketStatus(list, 'T99', 'closed'), list);
});

test('plan21: closeTicket closes only that ticket and changes nothing else', () => {
  const before = ticket({ note: 'keep me' });
  const out = closeTicket([before, ticket({ id: 'T2' })], 'T1');
  assert.equal(out[0].status, 'closed');
  assert.equal(out[0].note, 'keep me');
  assert.equal(out[0].customerId, 'C1');
  assert.equal(out[0].category, 'no_connection');
  assert.equal(out[1].status, 'open');
  // No bill, payment or customer-status field exists on a ticket.
  assert.equal('bill' in out[0], false);
  assert.equal('payment' in out[0], false);
  assert.equal('customerStatus' in out[0], false);
});

test('plan21: updateTicketAssignee sets the owner without changing status', () => {
  const out = updateTicketAssignee([ticket({ assignee: '' })], 'T1', 'Saad');
  assert.equal(out[0].assignee, 'Saad');
  assert.equal(out[0].status, 'open');
  assert.deepEqual(updateTicketAssignee([ticket()], 'T99', 'Saad'), [ticket()]);
});

// Open list.
test('plan21: openTicketList keeps open, assigned and in progress only', () => {
  const list = [
    ticket({ id: 'T1', status: 'open' }),
    ticket({ id: 'T2', status: 'assigned' }),
    ticket({ id: 'T3', status: 'in_progress' }),
    ticket({ id: 'T4', status: 'resolved' }),
    ticket({ id: 'T5', status: 'closed' }),
  ];
  assert.deepEqual(openTicketList(list).map((t) => t.id), ['T1', 'T2', 'T3']);
});

// Mohalla matching.
test('plan21: mohalla key match wins over label, label match is case-insensitive', () => {
  const row = ticket({ mohalla: 'Bani', mohallaKey: 'bani' });
  assert.equal(ticketMatchesMohalla(row, '', 'bani'), true);
  assert.equal(ticketMatchesMohalla(row, '', 'other'), false);
  assert.equal(ticketMatchesMohalla(ticket({ mohalla: 'Bani', mohallaKey: '' }), 'bani', ''), true);
  assert.equal(ticketMatchesMohalla(ticket({ mohalla: 'BANI', mohallaKey: '' }), 'Bani', ''), true);
});

test('plan21: Unassigned mohalla filter matches only tickets with no mohalla', () => {
  assert.equal(ticketMatchesMohalla(ticket({ mohalla: '' }), 'Unassigned', ''), true);
  assert.equal(ticketMatchesMohalla(ticket({ mohalla: 'Bani' }), 'Unassigned', ''), false);
  assert.equal(ticketMatchesMohalla(ticket({ mohalla: 'Bani' }), '', ''), true);
});

// Filtering.
test('plan21: filter by status', () => {
  const list = [ticket({ id: 'T1', status: 'open' }), ticket({ id: 'T2', status: 'closed' })];
  assert.deepEqual(filterTicketList(list, { status: 'closed' }).map((t) => t.id), ['T2']);
  assert.deepEqual(filterTicketList(list, { status: '' }).map((t) => t.id), ['T1', 'T2']);
});

test('plan21: filter by category', () => {
  const list = [
    ticket({ id: 'T1', category: 'slow_speed' }),
    ticket({ id: 'T2', category: 'billing_query' }),
  ];
  assert.deepEqual(filterTicketList(list, { category: 'billing_query' }).map((t) => t.id), ['T2']);
});

test('plan21: filter by mohalla uses the canonical key when present', () => {
  const list = [
    ticket({ id: 'T1', mohalla: 'Bani', mohallaKey: 'bani' }),
    ticket({ id: 'T2', mohalla: 'Chah', mohallaKey: 'chah' }),
  ];
  assert.deepEqual(filterTicketList(list, { mohallaKey: 'chah' }).map((t) => t.id), ['T2']);
});

test('plan21: openOnly filter drops resolved and closed tickets', () => {
  const list = [ticket({ id: 'T1', status: 'open' }), ticket({ id: 'T2', status: 'resolved' })];
  assert.deepEqual(filterTicketList(list, { openOnly: true }).map((t) => t.id), ['T1']);
});

test('plan21: combined filters intersect', () => {
  const list = [
    ticket({ id: 'T1', status: 'open', category: 'slow_speed', mohalla: 'Bani', mohallaKey: 'bani' }),
    ticket({ id: 'T2', status: 'open', category: 'slow_speed', mohalla: 'Chah', mohallaKey: 'chah' }),
    ticket({ id: 'T3', status: 'closed', category: 'slow_speed', mohalla: 'Bani', mohallaKey: 'bani' }),
  ];
  assert.deepEqual(
    filterTicketList(list, { status: 'open', category: 'slow_speed', mohallaKey: 'bani' }).map((t) => t.id),
    ['T1'],
  );
});

// Sorting.
test('plan21: sort puts urgent first, then oldest reported, then name', () => {
  const list = [
    ticket({ id: 'T1', customerName: 'Zaid', priority: 'low', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', customerName: 'Ahmed', priority: 'urgent', reportedDate: '2026-11-09' }),
    ticket({ id: 'T3', customerName: 'Bilal', priority: 'urgent', reportedDate: '2026-11-02' }),
    ticket({ id: 'T4', customerName: 'Ahmed', priority: 'urgent', reportedDate: null }),
  ];
  assert.deepEqual(sortTicketList(list).map((t) => t.id), ['T3', 'T2', 'T4', 'T1']);
});

test('plan21: sort never mutates the input list', () => {
  const list = [ticket({ id: 'T1', priority: 'low' }), ticket({ id: 'T2', priority: 'urgent' })];
  const out = sortTicketList(list);
  assert.equal(list[0].id, 'T1');
  assert.equal(out[0].id, 'T2');
});

// Waiting days.
test('plan21: days waiting counts from reported date to today', () => {
  assert.equal(daysTicketWaiting(ticket({ reportedDate: '2026-11-05' }), TODAY), 5);
  assert.equal(daysTicketWaiting(ticket({ reportedDate: '2026-11-10' }), TODAY), 0);
  assert.equal(daysTicketWaiting(ticket({ reportedDate: '2026-11-12' }), TODAY), 0);
  assert.equal(daysTicketWaiting(ticket({ reportedDate: null }), TODAY), null);
  assert.equal(daysTicketWaiting(ticket({ reportedDate: '2026-11-05' }), 'bad'), null);
});

// Summary, HTML, CSV.
test('plan21: summary counts total, open and per-status', () => {
  const summary = ticketSummary([
    ticket({ id: 'T1', status: 'open' }),
    ticket({ id: 'T2', status: 'assigned' }),
    ticket({ id: 'T3', status: 'closed' }),
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.open, 2);
  assert.equal(summary.byStatus.open, 1);
  assert.equal(summary.byStatus.closed, 1);
  assert.equal(ticketSummaryText(summary), '2 open of 3 tickets');
});

test('plan21: html escapes note and name, shows waiting and owner', () => {
  const html = ticketHtml([ticket({ customerName: '<Ali>', note: 'a & b' })], { today: TODAY });
  assert.ok(!html.includes('<Ali>'));
  assert.ok(html.includes('&lt;Ali&gt;'));
  assert.ok(html.includes('a &amp; b'));
  assert.ok(html.includes('Waiting: 5 days'));
  assert.ok(html.includes('Saad'));
  assert.equal(ticketHtml([], {}), '<p class="empty-state">No tickets match these filters.</p>');
});

test('plan21: csv rows quote commas and carry waiting days', () => {
  const csv = ticketCsv([ticket({ note: 'slow, again' })], { today: TODAY });
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Ticket id,Customer,Mohalla,Category,Priority,Status,Reported date,Waiting days,Owner,Note');
  assert.ok(lines[1].includes('"slow, again"'));
  assert.ok(lines[1].includes(',5,Saad,'));
});

test('plan21: filename is stable', () => {
  assert.equal(ticketFilename(), 'ticket-log.csv');
});
