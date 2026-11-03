import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DISPATCH_TICKET_CATEGORIES,
  DISPATCH_TICKET_PRIORITIES,
  DISPATCH_QUEUE_STATUSES,
  normalizeDispatchTicket,
  normalizeDispatchTicketList,
  validDispatchDate,
  sortDispatchQueue,
  dispatchQueueList,
  daysDispatchWaiting,
  normalizeDispatchConnection,
  attachConnectionRecords,
  normalizePartsNote,
  attachPartsNotes,
  buildDispatchQueue,
  reorderDispatchQueue,
  completeVisitFromQueue,
  groupQueueByMohalla,
  dispatchQueueSummary,
  dispatchQueueSummaryText,
  dispatchQueueHtml,
  dispatchQueueCsv,
  dispatchQueueFilename,
} from '../dispatch-queue.js';

function job(overrides = {}) {
  return {
    id: 'T1',
    customerId: 'C1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    mohallaKey: 'bani',
    category: 'no_connection',
    priority: 'high',
    status: 'open',
    reportedDate: '2026-11-01',
    assignee: 'Saad',
    note: 'No signal since morning',
    ...overrides,
  };
}

test('catalogue: five categories, four priorities, open+assigned are dispatchable', () => {
  assert.deepEqual([...DISPATCH_TICKET_CATEGORIES], ['no_connection', 'slow_speed', 'billing_query', 'device_fault', 'relocation_request']);
  assert.deepEqual([...DISPATCH_TICKET_PRIORITIES], ['low', 'medium', 'high', 'urgent']);
  assert.deepEqual([...DISPATCH_QUEUE_STATUSES], ['open', 'assigned']);
});

test('date validation: real dates pass, 2026-02-30 and bad shapes fail', () => {
  assert.equal(validDispatchDate('2026-02-28'), '2026-02-28');
  assert.equal(validDispatchDate('2026-02-30'), null);
  assert.equal(validDispatchDate('2026-13-01'), null);
  assert.equal(validDispatchDate('01-11-2026'), null);
  assert.equal(validDispatchDate(''), null);
  assert.equal(validDispatchDate(null), null);
});

test('normalisation: no customer or unknown category is null, never invented', () => {
  assert.equal(normalizeDispatchTicket(job({ customerId: '' })), null);
  assert.equal(normalizeDispatchTicket(job({ customerId: undefined })), null);
  assert.equal(normalizeDispatchTicket(job({ category: 'magic_fault' })), null);
  assert.equal(normalizeDispatchTicket(null), null);
  assert.equal(normalizeDispatchTicket('nope'), null);
});

test('normalisation: unknown priority falls back to medium, unknown status to open, bad date to null', () => {
  const clean = normalizeDispatchTicket(job({ priority: 'extreme', status: 'flying', reportedDate: '2026-02-30' }));
  assert.equal(clean.priority, 'medium');
  assert.equal(clean.status, 'open');
  assert.equal(clean.reportedDate, null);
});

test('normalisation: trimming, and the input is never mutated', () => {
  const input = job({ customerName: '  Ahmed  ', note: '  hello  ' });
  const clean = normalizeDispatchTicket(input);
  assert.equal(clean.customerName, 'Ahmed');
  assert.equal(clean.note, 'hello');
  assert.equal(input.customerName, '  Ahmed  ');
  const list = normalizeDispatchTicketList([job(), job({ customerId: '' })]);
  assert.equal(list.length, 1);
  assert.equal(normalizeDispatchTicketList(null).length, 0);
  assert.equal(normalizeDispatchTicketList('x').length, 0);
});

test('queue membership: exactly open and assigned tickets, in progress/resolved/closed excluded', () => {
  const list = dispatchQueueList([
    job({ id: 'A', status: 'open' }),
    job({ id: 'B', status: 'assigned' }),
    job({ id: 'C', status: 'in_progress' }),
    job({ id: 'D', status: 'resolved' }),
    job({ id: 'E', status: 'closed' }),
    job({ id: 'F', customerId: '' }),
  ]);
  assert.deepEqual(list.map((j) => j.id), ['A', 'B']);
});

test('queue membership: caller may override the status set explicitly', () => {
  const list = dispatchQueueList(
    [job({ id: 'A', status: 'in_progress' }), job({ id: 'B', status: 'open' })],
    { statuses: ['in_progress'] },
  );
  assert.deepEqual(list.map((j) => j.id), ['A']);
  const empty = dispatchQueueList([job({ id: 'A', status: 'open' })], { statuses: ['bogus'] });
  assert.deepEqual(empty.map((j) => j.id), []);
});

test('sorting: highest priority first, then oldest reported first', () => {
  const list = sortDispatchQueue([
    job({ id: 'low-new', priority: 'low', reportedDate: '2026-11-10' }),
    job({ id: 'urgent-old', priority: 'urgent', reportedDate: '2026-11-09' }),
    job({ id: 'urgent-new', priority: 'urgent', reportedDate: '2026-11-10' }),
    job({ id: 'high-old', priority: 'high', reportedDate: '2026-11-01' }),
  ]);
  assert.deepEqual(list.map((j) => j.id), ['urgent-old', 'urgent-new', 'high-old', 'low-new']);
});

test('sorting: no reported date sorts last, then name A-Z, then id', () => {
  const list = sortDispatchQueue([
    job({ id: 'B', customerName: 'Zaid', reportedDate: null }),
    job({ id: 'A', customerName: 'Ahmed', reportedDate: null }),
    job({ id: 'C', customerName: 'Ahmed', reportedDate: null }),
    job({ id: 'D', customerName: 'Bilal', reportedDate: '2026-11-01' }),
  ]);
  assert.deepEqual(list.map((j) => j.id), ['D', 'A', 'C', 'B']);
});

test('sorting: mohalla batches after priority and age, Unassigned last', () => {
  const list = sortDispatchQueue([
    job({ id: 'z', mohalla: 'Zaman', mohallaKey: 'zaman' }),
    job({ id: 'a', mohalla: 'Bani', mohallaKey: 'bani' }),
    job({ id: 'u', mohalla: '', mohallaKey: '' }),
    job({ id: 'm', mohalla: 'Kishti', mohallaKey: 'kishti' }),
  ]);
  assert.deepEqual(list.map((j) => j.id), ['a', 'm', 'z', 'u']);
});

test('sorting: mohalla label match is case-insensitive when no canonical key', () => {
  const list = dispatchQueueList([
    job({ id: 'a', mohalla: 'Bani', mohallaKey: '' }),
    job({ id: 'b', mohalla: 'Kishti', mohallaKey: '' }),
  ], { mohalla: 'bani' });
  assert.deepEqual(list.map((j) => j.id), ['a']);
});

test('filters: mohalla key, Unassigned label, category and assignee', () => {
  const tickets = [
    job({ id: 'a', mohalla: 'Bani', mohallaKey: 'bani', category: 'no_connection', assignee: 'Saad' }),
    job({ id: 'b', mohalla: 'Kishti', mohallaKey: 'kishti', category: 'slow_speed', assignee: 'Saad' }),
    job({ id: 'c', mohalla: '', mohallaKey: '', category: 'no_connection', assignee: 'Ali' }),
  ];
  assert.deepEqual(dispatchQueueList(tickets, { mohallaKey: 'kishti' }).map((j) => j.id), ['b']);
  assert.deepEqual(dispatchQueueList(tickets, { mohalla: 'Unassigned' }).map((j) => j.id), ['c']);
  assert.deepEqual(dispatchQueueList(tickets, { category: 'no_connection' }).map((j) => j.id), ['a', 'c']);
  assert.deepEqual(dispatchQueueList(tickets, { assignee: 'saad' }).map((j) => j.id), ['a', 'b']);
  assert.deepEqual(dispatchQueueList(tickets, { assignee: 'ali' }).map((j) => j.id), ['c']);
});

test('waiting days: normal, future clamped to 0, invalid to null', () => {
  assert.equal(daysDispatchWaiting(job({ reportedDate: '2026-11-01' }), '2026-11-04'), 3);
  assert.equal(daysDispatchWaiting(job({ reportedDate: '2026-11-10' }), '2026-11-04'), 0);
  assert.equal(daysDispatchWaiting(job({ reportedDate: '2026-02-30' }), '2026-11-04'), null);
  assert.equal(daysDispatchWaiting(job({ customerId: '' }), '2026-11-04'), null);
});

test('connection attach: last record per customer wins, ports and serials upper-cased', () => {
  const jobs = [job({ id: 'T1', customerId: 'C1' }), job({ id: 'T2', customerId: 'C2' })];
  const attached = attachConnectionRecords(jobs, [
    { customerId: 'C1', oltId: 'OLT-1', ponPort: 'pon-3', splitter: 'S1', onuSerial: 'onu-9', installDate: '2026-10-01' },
    { customerId: 'C1', oltId: 'OLT-1', ponPort: 'PON-4', splitter: 'S2', onuSerial: 'ONU-10', installDate: '2026-10-02' },
    { customerId: '', oltId: 'OLT-1' },
  ]);
  assert.equal(attached[0].connection.ponPort, 'PON-4');
  assert.equal(attached[0].connection.onuSerial, 'ONU-10');
  assert.equal(attached[1].connection, null);
  assert.equal(normalizeDispatchConnection({ customerId: 'C9', installDate: '2026-02-30' }).installDate, null);
  assert.equal(normalizeDispatchConnection({}), null);
});

test('parts notes: last note per ticket wins, missing note is empty', () => {
  const jobs = [job({ id: 'T1' }), job({ id: 'T2' })];
  const attached = attachPartsNotes(jobs, [
    { ticketId: 'T1', note: 'Spare ONU' },
    { ticketId: 'T1', note: 'Spare ONU + patch cord' },
    { ticketId: '', note: 'Nothing' },
    { ticketId: 'T9', note: '' },
  ]);
  assert.equal(attached[0].partsNote, 'Spare ONU + patch cord');
  assert.equal(attached[1].partsNote, '');
  assert.equal(normalizePartsNote({ ticketId: 'T1', note: '  ' }), null);
  assert.equal(normalizePartsNote(null), null);
});

test('buildDispatchQueue: pipeline combines queue, connection, note and waiting days', () => {
  const queue = buildDispatchQueue(
    [job({ id: 'T1', priority: 'urgent' }), job({ id: 'T2', priority: 'low', status: 'closed' })],
    {
      connections: [{ customerId: 'C1', oltId: 'OLT-1', ponPort: 'PON-3' }],
      partsNotes: [{ ticketId: 'T1', note: 'Ladder' }],
      today: '2026-11-04',
    },
  );
  assert.equal(queue.length, 1);
  assert.equal(queue[0].connection.ponPort, 'PON-3');
  assert.equal(queue[0].partsNote, 'Ladder');
  assert.equal(queue[0].waitingDays, 3);
});

test('reorder: moving a job changes only display order, never a ticket field', () => {
  const jobs = [job({ id: 'A' }), job({ id: 'B' }), job({ id: 'C' })];
  const moved = reorderDispatchQueue(jobs, 0, 2);
  assert.deepEqual(moved.map((j) => j.id), ['B', 'C', 'A']);
  assert.deepEqual(jobs.map((j) => j.id), ['A', 'B', 'C']);
  assert.equal(moved[2].status, 'open');
  assert.equal('amount' in moved[2], false);
  assert.deepEqual(reorderDispatchQueue(jobs, -1, 1).map((j) => j.id), ['A', 'B', 'C']);
  assert.deepEqual(reorderDispatchQueue(jobs, 0, 9).map((j) => j.id), ['A', 'B', 'C']);
  assert.deepEqual(reorderDispatchQueue(jobs, 1, 1).map((j) => j.id), ['A', 'B', 'C']);
  assert.deepEqual(reorderDispatchQueue(null, 0, 1), []);
});

test('complete visit: only the matched ticket status moves, unknown id or status changes nothing', () => {
  const list = [job({ id: 'A', status: 'assigned' }), job({ id: 'B', status: 'open', note: 'keep me' })];
  const done = completeVisitFromQueue(list, 'A');
  assert.equal(done[0].status, 'resolved');
  assert.equal(done[1].status, 'open');
  assert.equal(done[1].note, 'keep me');
  assert.equal(done[0].customerId, 'C1');
  assert.equal('amount' in done[0], false);
  assert.deepEqual(completeVisitFromQueue(list, 'ZZZ').map((j) => j.status), ['assigned', 'open']);
  assert.deepEqual(completeVisitFromQueue(list, 'A', 'bogus').map((j) => j.status), ['assigned', 'open']);
  assert.equal(completeVisitFromQueue(list, 'A', 'in_progress')[0].status, 'in_progress');
});

test('grouping by mohalla: queue order preserved, Unassigned group last', () => {
  const groups = groupQueueByMohalla([
    job({ id: 'a', mohalla: 'Bani', mohallaKey: 'bani' }),
    job({ id: 'b', mohalla: '', mohallaKey: '' }),
    job({ id: 'c', mohalla: 'Bani', mohallaKey: 'bani' }),
    job({ id: 'd', mohalla: 'Kishti', mohallaKey: 'kishti' }),
  ]);
  assert.deepEqual(groups.map((g) => g.label), ['Bani', 'Kishti', 'Unassigned']);
  assert.deepEqual(groups[0].jobs.map((j) => j.id), ['a', 'c']);
  assert.deepEqual(groupQueueByMohalla(null), []);
});

test('summary: totals and per-priority counts, summary text', () => {
  const summary = dispatchQueueSummary([
    job({ priority: 'urgent' }), job({ priority: 'urgent' }), job({ priority: 'low' }),
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.byPriority.urgent, 2);
  assert.equal(summary.byPriority.low, 1);
  assert.equal(summary.byPriority.high, 0);
  assert.equal(dispatchQueueSummaryText(summary), '3 jobs in the dispatch queue, 2 urgent');
  assert.equal(dispatchQueueSummaryText({ total: 1, byPriority: { urgent: 0 } }), '1 job in the dispatch queue');
  assert.equal(dispatchQueueSummaryText(null), 'No jobs in the dispatch queue');
});

test('HTML: escaped, numbered, with connection and parts note', () => {
  const html = dispatchQueueHtml(buildDispatchQueue([job({ customerName: '<b>Ahmed</b>' })], {
    connections: [{ customerId: 'C1', oltId: 'OLT-1', ponPort: 'PON-3', splitter: 'S1', onuSerial: 'ONU-9' }],
    partsNotes: [{ ticketId: 'T1', note: 'Spare ONU' }],
    today: '2026-11-04',
  }));
  assert.match(html, /#1/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /OLT-1/);
  assert.match(html, /PON-3/);
  assert.match(html, /Spare ONU/);
  assert.match(html, /Waiting: 3 days/);
  assert.equal(dispatchQueueHtml([]), '<p class="empty-state">No jobs in the dispatch queue.</p>');
  const offset = dispatchQueueHtml([job({ id: 'T9' })], { startAt: 4 });
  assert.match(offset, /#5/);
});

test('HTML: no connection record and no parts note are stated, not invented', () => {
  const html = dispatchQueueHtml(buildDispatchQueue([job()], { today: '2026-11-04' }));
  assert.match(html, /no record/);
  assert.match(html, /No parts note/);
});

test('CSV: header, rows, quoting, and filename', () => {
  const csv = dispatchQueueCsv(buildDispatchQueue([job({ customerName: 'Ahmed, Jr.', note: 'He said "no signal"' })], {
    connections: [{ customerId: 'C1', oltId: 'OLT-1', ponPort: 'PON-3' }],
    partsNotes: [{ ticketId: 'T1', note: 'Ladder' }],
    today: '2026-11-04',
  }));
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Queue position,Ticket id,Customer,Mohalla,Category,Priority,Status,Reported date,Waiting days,Owner,OLT,PON port,Splitter,ONU serial,Parts/tools note,Ticket note');
  assert.match(lines[1], /^1,T1,"Ahmed, Jr\.",Bani,No connection,High,open,2026-11-01,3,Saad,OLT-1,PON-3,,,Ladder,"He said ""no signal"""/);
  assert.equal(dispatchQueueFilename(), 'dispatch-queue.csv');
});
