import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OUTAGE_STATUSES,
  OUTAGE_OPEN_STATUSES,
  OUTAGE_OPEN_TICKET_STATUSES,
  OUTAGE_STATUS_LABELS,
  normalizeOutage,
  normalizeOutageList,
  createOutage,
  openOutageList,
  outageForTicket,
  linkTicketToOutage,
  unlinkTicketFromOutage,
  updateOutageStatus,
  resolveOutage,
  ticketsForOutage,
  pendingResolutionTickets,
  buildOutageStatusDraft,
  outageSummary,
  outageSummaryText,
  outageHtml,
  outageCsv,
  outageFilename,
} from '../outage-grouping.js';

function outage(overrides = {}) {
  return {
    id: 'O1',
    area: 'Bani',
    segment: 'Splitter 3',
    startTime: '2026-11-10 09:30',
    causeNote: 'Fibre cut near the main road',
    status: 'open',
    ticketIds: ['T1', 'T2'],
    ...overrides,
  };
}

function ticket(overrides = {}) {
  return { id: 'T1', customerId: 'C1', customerName: 'Ahmed', status: 'open', ...overrides };
}

// Catalogue: exactly the plan's three outage statuses.
test('plan22: catalogue carries the outage statuses and labels', () => {
  assert.deepEqual([...OUTAGE_STATUSES], ['open', 'in_progress', 'resolved']);
  assert.deepEqual([...OUTAGE_OPEN_STATUSES], ['open', 'in_progress']);
  assert.deepEqual([...OUTAGE_OPEN_TICKET_STATUSES], ['open', 'assigned', 'in_progress']);
  assert.equal(OUTAGE_STATUS_LABELS.resolved, 'Resolved');
});

// Normalisation: no area is not an outage, unknown status falls back.
test('plan22: normalizeOutage rejects a missing area and falls back on status', () => {
  assert.equal(normalizeOutage({ id: 'O9', area: '   ', status: 'open' }), null);
  assert.equal(normalizeOutage(null), null);
  assert.equal(normalizeOutage({ area: 'Bani', status: 'bogus' }).status, 'open');
  assert.equal(normalizeOutage({ area: 'Bani' }).status, 'open');
});

test('plan22: normalizeOutage deduplicates ticket ids and drops blanks', () => {
  const clean = normalizeOutage(outage({ ticketIds: ['T1', ' ', 'T2', 'T1', ''] }));
  assert.deepEqual(clean.ticketIds, ['T1', 'T2']);
});

test('plan22: normalizeOutage never mutates its input', () => {
  const input = outage({ ticketIds: ['T1', 'T1'] });
  const before = JSON.stringify(input);
  normalizeOutage(input);
  assert.equal(JSON.stringify(input), before);
});

test('plan22: createOutage returns null without an area', () => {
  assert.equal(createOutage({ segment: 'Splitter 3' }), null);
  assert.equal(createOutage({ area: 'Bani' }).area, 'Bani');
});

test('plan22: normalizeOutageList drops unusable entries and keeps order', () => {
  const list = normalizeOutageList([outage({ id: 'O1' }), { id: 'OX' }, outage({ id: 'O2', area: 'Kishti' })]);
  assert.deepEqual(list.map((o) => o.id), ['O1', 'O2']);
  assert.deepEqual(normalizeOutageList('nope'), []);
});

test('plan22: openOutageList keeps open and in-progress, drops resolved', () => {
  const list = openOutageList([
    outage({ id: 'O1' }),
    outage({ id: 'O2', status: 'in_progress' }),
    outage({ id: 'O3', status: 'resolved' }),
  ]);
  assert.deepEqual(list.map((o) => o.id), ['O1', 'O2']);
});

// One open outage per ticket.
test('plan22: outageForTicket finds the open outage holding a ticket', () => {
  const list = [outage({ id: 'O1' }), outage({ id: 'O2', area: 'Kishti', ticketIds: ['T9'] })];
  assert.equal(outageForTicket(list, 'T2').id, 'O1');
  assert.equal(outageForTicket(list, 'T9').id, 'O2');
  assert.equal(outageForTicket(list, 'T99'), null);
  assert.equal(outageForTicket(list, ''), null);
});

test('plan22: a ticket linked only to a resolved outage belongs to no open outage', () => {
  const list = [outage({ id: 'O1', status: 'resolved' })];
  assert.equal(outageForTicket(list, 'T1'), null);
});

// Linking.
test('plan22: linkTicketToOutage appends a ticket in link order', () => {
  const next = linkTicketToOutage([outage({ ticketIds: ['T1'] })], 'O1', 'T3');
  assert.deepEqual(next[0].ticketIds, ['T1', 'T3']);
});

test('plan22: linking refuses an unknown outage, a resolved outage, or a blank id', () => {
  const list = [outage({ id: 'O1' })];
  assert.deepEqual(linkTicketToOutage(list, 'OX', 'T3'), normalizeOutageList(list));
  assert.deepEqual(
    linkTicketToOutage([outage({ id: 'O1', status: 'resolved' })], 'O1', 'T3')[0].ticketIds,
    ['T1', 'T2'],
  );
  assert.deepEqual(linkTicketToOutage(list, 'O1', '  '), normalizeOutageList(list));
  assert.deepEqual(linkTicketToOutage(list, '', 'T3'), normalizeOutageList(list));
});

test('plan22: linking refuses a ticket already in another open outage', () => {
  const list = [
    outage({ id: 'O1' }),
    outage({ id: 'O2', area: 'Kishti', ticketIds: [] }),
  ];
  const next = linkTicketToOutage(list, 'O2', 'T1');
  assert.deepEqual(next[1].ticketIds, []);
  assert.deepEqual(next[0].ticketIds, ['T1', 'T2']);
});

test('plan22: linking a ticket already in the same outage adds nothing', () => {
  const next = linkTicketToOutage([outage()], 'O1', 'T1');
  assert.deepEqual(next[0].ticketIds, ['T1', 'T2']);
});

test('plan22: linking never mutates the input list', () => {
  const list = [outage()];
  const before = JSON.stringify(list);
  linkTicketToOutage(list, 'O1', 'T3');
  assert.equal(JSON.stringify(list), before);
});

// Unlinking.
test('plan22: unlinkTicketFromOutage removes only the named link', () => {
  const next = unlinkTicketFromOutage([outage()], 'O1', 'T1');
  assert.deepEqual(next[0].ticketIds, ['T2']);
});

test('plan22: unlinking an unknown outage or ticket leaves the list unchanged', () => {
  const list = [outage()];
  assert.deepEqual(unlinkTicketFromOutage(list, 'OX', 'T1'), normalizeOutageList(list));
  assert.deepEqual(unlinkTicketFromOutage(list, 'O1', 'T99'), normalizeOutageList(list));
});

// Status updates.
test('plan22: updateOutageStatus moves only the status of the matched outage', () => {
  const next = updateOutageStatus([outage(), outage({ id: 'O2', area: 'Kishti', ticketIds: [] })], 'O1', 'in_progress');
  assert.equal(next[0].status, 'in_progress');
  assert.equal(next[0].area, 'Bani');
  assert.deepEqual(next[0].ticketIds, ['T1', 'T2']);
  assert.equal(next[1].status, 'open');
});

test('plan22: updateOutageStatus refuses an unknown id or status', () => {
  const list = [outage()];
  assert.deepEqual(updateOutageStatus(list, 'OX', 'resolved'), normalizeOutageList(list));
  assert.deepEqual(updateOutageStatus(list, 'O1', 'bogus'), normalizeOutageList(list));
});

// Resolution: parent resolves, tickets do not.
test('plan22: resolveOutage resolves the parent and splits pending from settled tickets', () => {
  const tickets = [
    ticket({ id: 'T1', status: 'open' }),
    ticket({ id: 'T2', status: 'closed' }),
  ];
  const result = resolveOutage([outage()], 'O1', tickets);
  assert.equal(result.outages[0].status, 'resolved');
  assert.deepEqual(result.linkedTickets.map((t) => t.id), ['T1', 'T2']);
  assert.deepEqual(result.pendingTickets.map((t) => t.id), ['T1']);
  // The tickets themselves are untouched by the resolution.
  assert.equal(tickets[0].status, 'open');
});

test('plan22: resolveOutage changes nothing for an unknown or already-resolved outage', () => {
  const list = [outage({ status: 'resolved' })];
  const result = resolveOutage(list, 'O1', [ticket()]);
  assert.deepEqual(result.outages, normalizeOutageList(list));
  assert.deepEqual(result.linkedTickets, []);
  assert.deepEqual(result.pendingTickets, []);
  const unknown = resolveOutage([outage()], 'OX', [ticket()]);
  assert.equal(unknown.outages[0].status, 'open');
  assert.deepEqual(unknown.pendingTickets, []);
});

test('plan22: resolveOutage skips linked tickets missing from the supplied list', () => {
  const result = resolveOutage([outage()], 'O1', [ticket({ id: 'T1', status: 'assigned' })]);
  assert.deepEqual(result.linkedTickets.map((t) => t.id), ['T1']);
  assert.deepEqual(result.pendingTickets.map((t) => t.id), ['T1']);
});

test('plan22: resolveOutage honours a caller-supplied open-ticket status list', () => {
  const tickets = [ticket({ id: 'T1', status: 'open' }), ticket({ id: 'T2', status: 'resolved' })];
  const result = resolveOutage([outage()], 'O1', tickets, { openTicketStatuses: ['resolved'] });
  assert.deepEqual(result.pendingTickets.map((t) => t.id), ['T2']);
});

// Linked ticket views.
test('plan22: ticketsForOutage returns linked tickets in link order', () => {
  const tickets = [ticket({ id: 'T2' }), ticket({ id: 'T1' }), ticket({ id: 'T3' })];
  assert.deepEqual(ticketsForOutage(outage(), tickets).map((t) => t.id), ['T1', 'T2']);
  assert.deepEqual(ticketsForOutage({ area: '' }, tickets), []);
});

test('plan22: pendingResolutionTickets keeps only tickets still waiting', () => {
  const tickets = [
    ticket({ id: 'T1', status: 'in_progress' }),
    ticket({ id: 'T2', status: 'resolved' }),
  ];
  assert.deepEqual(pendingResolutionTickets(outage(), tickets).map((t) => t.id), ['T1']);
});

// Status draft.
test('plan22: buildOutageStatusDraft names area, segment, start and cause', () => {
  const draft = buildOutageStatusDraft(outage());
  assert.equal(draft.ready, true);
  assert.match(draft.text, /Bani \(Splitter 3\)/);
  assert.match(draft.text, /2026-11-10 09:30/);
  assert.match(draft.text, /Fibre cut near the main road/);
  assert.match(draft.text, /Open/);
  assert.match(draft.text, /isi fault se linked hai/);
});

test('plan22: buildOutageStatusDraft personalises for one customer and omits a missing cause', () => {
  const draft = buildOutageStatusDraft(outage({ causeNote: '', segment: '' }), { customerName: 'Ahmed' });
  assert.match(draft.text, /Assalam-o-Alaikum Ahmed,/);
  assert.doesNotMatch(draft.text, /Wajah:/);
  assert.match(draft.text, /Bani mein fault/);
});

test('plan22: buildOutageStatusDraft for a resolved outage says service should be back', () => {
  const draft = buildOutageStatusDraft(outage({ status: 'resolved' }));
  assert.match(draft.text, /Resolved/);
  assert.match(draft.text, /Fault theek ho gaya hai/);
  assert.doesNotMatch(draft.text, /kaam kar rahi hai/);
});

test('plan22: buildOutageStatusDraft is not ready for a non-outage', () => {
  assert.deepEqual(buildOutageStatusDraft({ area: '' }), { text: '', ready: false });
  assert.deepEqual(buildOutageStatusDraft(null), { text: '', ready: false });
});

// Summary, HTML, CSV.
test('plan22: outageSummary counts open, resolved and links', () => {
  const summary = outageSummary([
    outage({ id: 'O1' }),
    outage({ id: 'O2', area: 'Kishti', status: 'resolved', ticketIds: ['T9'] }),
    { id: 'OX' },
  ]);
  assert.deepEqual(summary, { total: 2, open: 1, resolved: 1, linkedTickets: 3 });
  assert.equal(outageSummaryText(summary), '1 open of 2 outages, 3 tickets linked');
  assert.equal(outageSummaryText(null), 'No outages');
});

test('plan22: outageHtml escapes content and reports the empty state', () => {
  assert.match(outageHtml([]), /No outages recorded/);
  const html = outageHtml([outage({ area: '<Bani> & "friends"', causeNote: '<script>' })]);
  assert.match(html, /&lt;Bani&gt; &amp; &quot;friends&quot;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /2 tickets linked/);
});

test('plan22: outageCsv quotes fields with commas and quotes', () => {
  const csv = outageCsv([outage({ area: 'Bani, West', causeNote: 'He said "cut"' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Outage id,Area,Segment,Start time,Cause note,Status,Linked tickets');
  assert.match(lines[1], /"Bani, West"/);
  assert.match(lines[1], /"He said ""cut"""/);
  assert.match(lines[1], /T1; T2/);
});

test('plan22: outageFilename is stable', () => {
  assert.equal(outageFilename(), 'outage-groups.csv');
});
