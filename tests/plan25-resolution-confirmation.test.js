import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESOLUTION_CATEGORIES,
  RESOLUTION_DEFAULT_WINDOW_DAYS,
  validResolutionDate,
  wholeDaysBetweenResolutionDates,
  addResolutionDays,
  normalizeReopenWindowDays,
  normalizeConfirmationTicket,
  normalizeConfirmationTicketList,
  resolvedConfirmationTickets,
  normalizeResolutionList,
  recordResolution,
  resolutionDateFor,
  reopenDecision,
  reopenResolvedTicket,
  createFollowUpTicketInput,
  normalizeFollowUpLinkList,
  recordFollowUpLink,
  followUpLinksFor,
  buildConfirmationDraft,
  buildConfirmationRows,
  confirmationSummary,
  confirmationSummaryText,
  confirmationHtml,
  confirmationCsv,
  confirmationFilename,
} from '../resolution-confirmation.js';

function ticket(overrides = {}) {
  return {
    id: 'T1',
    customerId: 'C1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    category: 'no_connection',
    priority: 'high',
    status: 'resolved',
    reportedDate: '2026-11-01',
    assignee: 'Saad',
    note: 'ONU replaced',
    ...overrides,
  };
}

const TODAY = '2026-11-10';
const RESOLUTIONS = [{ ticketId: 'T1', resolvedDate: '2026-11-05' }];

test('catalogue: Plan 21 five categories, default window 7 days', () => {
  assert.deepEqual([...RESOLUTION_CATEGORIES], ['no_connection', 'slow_speed', 'billing_query', 'device_fault', 'relocation_request']);
  assert.equal(RESOLUTION_DEFAULT_WINDOW_DAYS, 7);
});

test('date validation: real dates pass, 2026-02-30 rejected', () => {
  assert.equal(validResolutionDate('2026-11-05'), '2026-11-05');
  assert.equal(validResolutionDate('2026-02-30'), null);
  assert.equal(validResolutionDate('not a date'), null);
  assert.equal(validResolutionDate(''), null);
});

test('day arithmetic and window-end date', () => {
  assert.equal(wholeDaysBetweenResolutionDates('2026-11-05', '2026-11-10'), 5);
  assert.equal(wholeDaysBetweenResolutionDates('2026-11-10', '2026-11-05'), -5);
  assert.equal(wholeDaysBetweenResolutionDates('2026-02-30', TODAY), null);
  assert.equal(addResolutionDays('2026-11-05', 7), '2026-11-12');
  assert.equal(addResolutionDays('2026-02-30', 7), null);
});

test('window normalisation: positive integers kept, bad values fall back to 7 as a whole', () => {
  assert.equal(normalizeReopenWindowDays(14), 14);
  assert.equal(normalizeReopenWindowDays('14'), 14);
  assert.equal(normalizeReopenWindowDays(0), 7);
  assert.equal(normalizeReopenWindowDays(-3), 7);
  assert.equal(normalizeReopenWindowDays(2.5), 7);
  assert.equal(normalizeReopenWindowDays(undefined), 7);
  assert.equal(normalizeReopenWindowDays('soon'), 7);
});

test('ticket normalisation: no customer or unknown category is null, bad date becomes null, inputs not mutated', () => {
  assert.equal(normalizeConfirmationTicket({ category: 'no_connection' }), null);
  assert.equal(normalizeConfirmationTicket(ticket({ category: 'mystery' })), null);
  assert.equal(normalizeConfirmationTicket(ticket({ reportedDate: '2026-02-30' })).reportedDate, null);
  const input = ticket();
  const copy = JSON.parse(JSON.stringify(input));
  normalizeConfirmationTicket(input);
  assert.deepEqual(input, copy);
});

test('ticket list normalisation drops unusable entries, keeps order', () => {
  const list = normalizeConfirmationTicketList([ticket({ id: 'T2' }), { category: 'no_connection' }, ticket({ id: 'T3' })]);
  assert.deepEqual(list.map((t) => t.id), ['T2', 'T3']);
});

test('resolved list: only resolved tickets', () => {
  const list = resolvedConfirmationTickets([ticket({ id: 'T1' }), ticket({ id: 'T2', status: 'open' }), ticket({ id: 'T3', status: 'closed' })]);
  assert.deepEqual(list.map((t) => t.id), ['T1']);
});

test('resolution records: bad entries dropped, duplicates collapse to the first', () => {
  const list = normalizeResolutionList([
    { ticketId: 'T1', resolvedDate: '2026-11-05' },
    { ticketId: 'T1', resolvedDate: '2026-11-06' },
    { ticketId: '', resolvedDate: '2026-11-05' },
    { ticketId: 'T2', resolvedDate: '2026-02-30' },
  ]);
  assert.deepEqual(list, [{ ticketId: 'T1', resolvedDate: '2026-11-05' }]);
});

test('recordResolution: first date stands, bad id or date leaves list unchanged', () => {
  assert.deepEqual(recordResolution(RESOLUTIONS, 'T1', '2026-11-08'), RESOLUTIONS);
  assert.deepEqual(recordResolution(RESOLUTIONS, 'T2', '2026-11-08'), [...RESOLUTIONS, { ticketId: 'T2', resolvedDate: '2026-11-08' }]);
  assert.deepEqual(recordResolution(RESOLUTIONS, '', '2026-11-08'), RESOLUTIONS);
  assert.deepEqual(recordResolution(RESOLUTIONS, 'T2', '2026-02-30'), RESOLUTIONS);
  assert.equal(resolutionDateFor(RESOLUTIONS, 'T1'), '2026-11-05');
  assert.equal(resolutionDateFor(RESOLUTIONS, 'T9'), null);
});

test('reopen decision: within window is eligible, with days and window end', () => {
  const decision = reopenDecision(ticket(), RESOLUTIONS, TODAY, 7);
  assert.equal(decision.eligible, true);
  assert.equal(decision.reason, 'within_window');
  assert.equal(decision.daysSinceResolved, 5);
  assert.equal(decision.windowEndDate, '2026-11-12');
});

test('reopen decision: exactly windowDays ago is still inside (inclusive both ends)', () => {
  const decision = reopenDecision(ticket(), RESOLUTIONS, '2026-11-12', 7);
  assert.equal(decision.eligible, true);
});

test('reopen decision: one day past the window is window_passed', () => {
  const decision = reopenDecision(ticket(), RESOLUTIONS, '2026-11-13', 7);
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'window_passed');
  assert.equal(decision.daysSinceResolved, 8);
});

test('reopen decision: non-resolved tickets are not eligible', () => {
  assert.equal(reopenDecision(ticket({ status: 'open' }), RESOLUTIONS, TODAY, 7).reason, 'not_resolved');
  assert.equal(reopenDecision(ticket({ status: 'closed' }), RESOLUTIONS, TODAY, 7).reason, 'not_resolved');
});

test('reopen decision: no resolution record means unknown, never guessed', () => {
  const decision = reopenDecision(ticket(), [], TODAY, 7);
  assert.equal(decision.eligible, 'unknown');
  assert.equal(decision.reason, 'no_resolution_date');
  assert.equal(decision.daysSinceResolved, null);
});

test('reopen decision: invalid window falls back to 7', () => {
  assert.equal(reopenDecision(ticket(), RESOLUTIONS, '2026-11-12', 0).eligible, true);
  assert.equal(reopenDecision(ticket(), RESOLUTIONS, '2026-11-13', 0).reason, 'window_passed');
});

test('reopenResolvedTicket: only status moves, everything else and other tickets unchanged', () => {
  const list = [ticket({ id: 'T1' }), ticket({ id: 'T2', status: 'open' })];
  const next = reopenResolvedTicket(list, 'T1', TODAY, 7, RESOLUTIONS);
  assert.equal(next[0].status, 'open');
  assert.equal(next[0].note, 'ONU replaced');
  assert.equal(next[0].id, 'T1');
  assert.equal(next[1].status, 'open');
  assert.deepEqual(list[0].status, 'resolved');
});

test('reopenResolvedTicket: window passed, unknown window, or unknown id leaves list unchanged', () => {
  const list = [ticket()];
  assert.deepEqual(reopenResolvedTicket(list, 'T1', '2026-11-20', 7, RESOLUTIONS), normalizeConfirmationTicketList(list));
  assert.deepEqual(reopenResolvedTicket(list, 'T1', TODAY, 7, []), normalizeConfirmationTicketList(list));
  assert.deepEqual(reopenResolvedTicket(list, 'T9', TODAY, 7, RESOLUTIONS), normalizeConfirmationTicketList(list));
});

test('reopenResolvedTicket: reopening never creates a second ticket', () => {
  const list = [ticket(), ticket({ id: 'T2', status: 'open' })];
  assert.equal(reopenResolvedTicket(list, 'T1', TODAY, 7, RESOLUTIONS).length, 2);
});

test('follow-up input: same customer/category/priority, open, reported today, note names the old ticket', () => {
  const input = createFollowUpTicketInput(ticket(), { id: 'T9', reportedDate: TODAY });
  assert.equal(input.customerId, 'C1');
  assert.equal(input.category, 'no_connection');
  assert.equal(input.priority, 'high');
  assert.equal(input.status, 'open');
  assert.equal(input.reportedDate, TODAY);
  assert.ok(input.note.includes('ONU replaced'));
  assert.ok(input.note.includes('Follow-up of ticket T1'));
});

test('follow-up input: no note still names the old ticket; bad ticket or date is null', () => {
  const input = createFollowUpTicketInput(ticket({ note: '' }), { id: 'T9', reportedDate: TODAY });
  assert.equal(input.note, 'Follow-up of ticket T1');
  assert.equal(createFollowUpTicketInput(ticket(), { id: 'T9', reportedDate: '2026-02-30' }), null);
  assert.equal(createFollowUpTicketInput({ category: 'no_connection' }, { id: 'T9', reportedDate: TODAY }), null);
});

test('follow-up links: dedup by new ticket, bad links dropped, lookup by old ticket', () => {
  const links = normalizeFollowUpLinkList([
    { oldTicketId: 'T1', newTicketId: 'T9' },
    { oldTicketId: 'T1', newTicketId: 'T9' },
    { oldTicketId: '', newTicketId: 'T8' },
  ]);
  assert.deepEqual(links, [{ oldTicketId: 'T1', newTicketId: 'T9' }]);
  assert.deepEqual(recordFollowUpLink(links, 'T1', 'T9'), links);
  assert.deepEqual(recordFollowUpLink(links, 'T1', 'T10'), [...links, { oldTicketId: 'T1', newTicketId: 'T10' }]);
  assert.deepEqual(followUpLinksFor(links, 'T1'), links);
  assert.deepEqual(followUpLinksFor(links, 'T2'), []);
});

test('Roman draft: category, note, reported and resolved dates verbatim; window in plain words', () => {
  const draft = buildConfirmationDraft(ticket(), RESOLUTIONS, 'roman', { windowDays: 7 });
  assert.equal(draft.variant, 'roman');
  assert.ok(draft.text.includes('Ahmed'));
  assert.ok(draft.text.includes('No connection'));
  assert.ok(draft.text.includes('ONU replaced'));
  assert.ok(draft.text.includes('2026-11-01'));
  assert.ok(draft.text.includes('2026-11-05'));
  assert.ok(draft.text.includes('7 din'));
  assert.equal(draft.resolvedDate, '2026-11-05');
});

test('Urdu draft: Urdu script, same figures, support contact only when supplied', () => {
  const draft = buildConfirmationDraft(ticket(), RESOLUTIONS, 'urdu', { windowDays: 7 });
  assert.equal(draft.variant, 'urdu');
  assert.ok(draft.text.includes('السلام علیکم'));
  assert.ok(draft.text.includes('2026-11-05'));
  assert.ok(!draft.text.includes('رابطہ:'));
  const withContact = buildConfirmationDraft(ticket(), RESOLUTIONS, 'urdu', { windowDays: 7, supportContact: '0300-1234567' });
  assert.ok(withContact.text.includes('0300-1234567'));
});

test('draft: missing note is stated, not invented; non-resolved tickets get no draft', () => {
  const draft = buildConfirmationDraft(ticket({ note: '' }), RESOLUTIONS, 'roman', { windowDays: 7 });
  assert.ok(draft.text.includes('not recorded'));
  assert.equal(buildConfirmationDraft(ticket({ status: 'open' }), RESOLUTIONS, 'roman'), null);
  assert.equal(buildConfirmationDraft({ category: 'no_connection' }, RESOLUTIONS, 'roman'), null);
});

test('draft: missing resolution date is shown as not recorded, never guessed', () => {
  const draft = buildConfirmationDraft(ticket(), [], 'roman', { windowDays: 7 });
  assert.ok(draft.text.includes('Not recorded'));
  assert.equal(draft.resolvedDate, null);
});

test('rows and summary: counts split within window, past window, unknown', () => {
  const rows = buildConfirmationRows(
    [ticket({ id: 'T1' }), ticket({ id: 'T2', status: 'resolved' }), ticket({ id: 'T3', status: 'open' })],
    [{ ticketId: 'T1', resolvedDate: '2026-11-05' }, { ticketId: 'T2', resolvedDate: '2026-10-01' }],
    TODAY, 7, { variant: 'roman' },
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].decision.eligible, true);
  assert.equal(rows[1].decision.reason, 'window_passed');
  assert.ok(rows[0].draft.text.includes('Ahmed'));
  const summary = confirmationSummary(rows);
  assert.deepEqual(summary, { resolved: 2, withinWindow: 1, windowPassed: 1, unknownWindow: 0 });
  assert.equal(confirmationSummaryText(summary), '2 resolved · 1 can reopen in window · 1 past window · 0 unknown window');
});

test('HTML: escaped, names customer, category, dates and decision', () => {
  const rows = buildConfirmationRows([ticket()], RESOLUTIONS, TODAY, 7, { variant: 'roman' });
  const html = confirmationHtml(rows);
  assert.ok(html.includes('Ahmed'));
  assert.ok(html.includes('No connection'));
  assert.ok(html.includes('2026-11-05'));
  const evil = buildConfirmationRows([ticket({ customerName: '<b>&amp;' })], RESOLUTIONS, TODAY, 7, { variant: 'roman' });
  assert.ok(!confirmationHtml(evil).includes('<b>'));
  assert.equal(confirmationHtml([]), '<p class="empty-state">No resolved tickets yet.</p>');
});

test('CSV: header, row values, quoting, filename', () => {
  const rows = buildConfirmationRows([ticket({ note: 'a "quoted" note' })], RESOLUTIONS, TODAY, 7, { variant: 'roman' });
  const csv = confirmationCsv(rows);
  assert.ok(csv.startsWith('Ticket id,Customer,Category,Reported date,Resolved date,Reopen decision,Days since resolved,Window ends'));
  assert.ok(csv.includes('T1,Ahmed,No connection,2026-11-01,2026-11-05,within_window,5,2026-11-12'));
  assert.equal(confirmationFilename(), 'resolution-confirmation.csv');
});
