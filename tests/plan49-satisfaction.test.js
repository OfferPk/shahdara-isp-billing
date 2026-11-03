/**
 * plan49-satisfaction.test.js — Plan 49: post-resolution satisfaction
 * note and monthly satisfaction view.
 * Pins:
 * - one note per resolved ticket (a second note replaces the first,
 *   never a second rating alongside it); a note for an open ticket
 *   is refused when the caller supplies the eligible ids;
 * - the monthly view's counts match the recorded notes on the same
 *   fixture, grouped by mohalla (case-insensitive, first-seen
 *   casing) and by category, with an unknown ticket counted under
 *   "Unknown" rather than dropped;
 * - a resolved ticket with no reply shows as "no response", never
 *   as a guessed rating; an undated note belongs to no month;
 * - impossible dates (2026-02-30) and bad ratings are refused,
 *   never stored half-formed; recording a rating never reopens or
 *   alters a ticket (the module holds no ticket field, and inputs
 *   are never mutated).
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SATISFACTION_RATINGS,
  validSatisfactionDate,
  validSatisfactionMonth,
  normalizeSatisfactionNote,
  normalizeSatisfactionNoteList,
  findSatisfactionNote,
  upsertSatisfactionNote,
  removeSatisfactionNote,
  satisfactionEligibleTicketIds,
  buildMonthlySatisfaction,
  satisfactionSummaryText,
  satisfactionHtml,
  satisfactionCsv,
  satisfactionFilename,
} from '../satisfaction.js';

const TICKETS = [
  { id: 't-1', customerId: 'c-1', mohalla: 'Bani', category: 'no_connection', status: 'resolved' },
  { id: 't-2', customerId: 'c-2', mohalla: 'bani', category: 'slow_speed', status: 'resolved' },
  { id: 't-3', customerId: 'c-3', mohalla: 'Kishti', category: 'no_connection', status: 'closed' },
  { id: 't-4', customerId: 'c-4', mohalla: '', category: 'device_fault', status: 'resolved' },
  { id: 't-5', customerId: 'c-5', mohalla: 'Bani', category: 'billing_query', status: 'open' },
  { id: 't-7', customerId: 'c-7', mohalla: 'Bani', category: 'device_fault', status: 'resolved' },
];

const NOTES = [
  { ticketId: 't-1', rating: 'satisfied', note: 'Fixed same day', recordedDate: '2026-11-05' },
  { ticketId: 't-2', rating: 'unhappy', note: '', recordedDate: '2026-11-06' },
  { ticketId: 't-3', rating: 'neutral', note: 'Slow but working', recordedDate: '2026-10-20' },
  { ticketId: 't-9', rating: 'satisfied', note: 'Unknown ticket note', recordedDate: '2026-11-07' },
  { ticketId: 't-7', rating: 'neutral', note: '', recordedDate: '' },
];

test('date validation: real dates pass, impossible dates fail', () => {
  assert.equal(validSatisfactionDate('2026-11-05'), '2026-11-05');
  assert.equal(validSatisfactionDate('2026-02-30'), null);
  assert.equal(validSatisfactionDate('2026-13-01'), null);
  assert.equal(validSatisfactionDate('not-a-date'), null);
  assert.equal(validSatisfactionDate(''), null);
});

test('month validation: YYYY-MM with a real month only', () => {
  assert.equal(validSatisfactionMonth('2026-11'), '2026-11');
  assert.equal(validSatisfactionMonth('2026-13'), null);
  assert.equal(validSatisfactionMonth('2026-1'), null);
  assert.equal(validSatisfactionMonth('2026-11-05'), null);
});

test('normalise rejects half-formed notes, blanks become null not guesses', () => {
  assert.equal(normalizeSatisfactionNote({ rating: 'satisfied' }), null);
  assert.equal(normalizeSatisfactionNote({ ticketId: 't-1', rating: 'delighted' }), null);
  assert.equal(normalizeSatisfactionNote({ ticketId: 't-1', rating: 'satisfied', recordedDate: '2026-02-30' }), null);
  assert.equal(normalizeSatisfactionNote(null), null);
  assert.deepEqual(normalizeSatisfactionNote({ ticketId: ' t-1 ', rating: 'neutral', note: '  ', recordedDate: '' }), {
    ticketId: 't-1', rating: 'neutral', note: null, recordedDate: null,
  });
});

test('upsert keeps one note per ticket: second replaces first, list length unchanged', () => {
  const first = upsertSatisfactionNote([], { ticketId: 't-1', rating: 'unhappy', recordedDate: '2026-11-01' });
  assert.equal(first.length, 1);
  const second = upsertSatisfactionNote(first, { ticketId: 't-1', rating: 'satisfied', note: 'Fixed on revisit', recordedDate: '2026-11-02' });
  assert.equal(second.length, 1);
  assert.equal(second[0].rating, 'satisfied');
  assert.equal(second[0].note, 'Fixed on revisit');
  assert.equal(first[0].rating, 'unhappy');
});

test('upsert eligible gate: open ticket refused, resolved accepted, no gate accepts any', () => {
  const eligible = ['t-1', 't-3'];
  const refused = upsertSatisfactionNote([], { ticketId: 't-5', rating: 'satisfied', recordedDate: '2026-11-01' }, eligible);
  assert.deepEqual(refused, []);
  const accepted = upsertSatisfactionNote([], { ticketId: 't-1', rating: 'satisfied', recordedDate: '2026-11-01' }, eligible);
  assert.equal(accepted.length, 1);
  const setAccepted = upsertSatisfactionNote([], { ticketId: 't-3', rating: 'neutral', recordedDate: '2026-11-01' }, new Set(eligible));
  assert.equal(setAccepted.length, 1);
  const ungated = upsertSatisfactionNote([], { ticketId: 't-5', rating: 'satisfied', recordedDate: '2026-11-01' }, null);
  assert.equal(ungated.length, 1);
});

test('remove and find: unknown id leaves the list unchanged', () => {
  const list = normalizeSatisfactionNoteList(NOTES);
  assert.equal(findSatisfactionNote(list, 't-2').rating, 'unhappy');
  assert.equal(findSatisfactionNote(list, 't-99'), null);
  assert.equal(findSatisfactionNote(list, ''), null);
  const removed = removeSatisfactionNote(list, 't-2');
  assert.equal(removed.length, list.length - 1);
  assert.equal(findSatisfactionNote(removed, 't-2'), null);
  assert.deepEqual(removeSatisfactionNote(list, 't-99'), list);
});

test('eligible ids: resolved and closed only, open work never rateable', () => {
  assert.deepEqual(satisfactionEligibleTicketIds(TICKETS), ['t-1', 't-2', 't-3', 't-4', 't-7']);
  assert.deepEqual(satisfactionEligibleTicketIds([]), []);
  assert.deepEqual(satisfactionEligibleTicketIds(null), []);
});

test('monthly view totals match the recorded notes on the same fixture', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  assert.equal(view.month, '2026-11');
  assert.deepEqual(view.totals, { satisfied: 2, neutral: 0, unhappy: 1, total: 3 });
  assert.equal(view.allNotes, 5);
  assert.equal(view.undatedNotes, 1);
  assert.equal(view.monthNotes.length, 3);
});

test('monthly view by mohalla: case-insensitive grouping, unknown ticket kept', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  const byName = Object.fromEntries(view.byMohalla.map((row) => [row.name, row]));
  assert.equal(byName.Bani.total, 2);
  assert.equal(byName.Bani.satisfied, 1);
  assert.equal(byName.Bani.unhappy, 1);
  assert.equal(byName.Unknown.total, 1);
  assert.equal(byName.Unknown.satisfied, 1);
  assert.equal(view.byMohalla.length, 2);
});

test('monthly view by category matches the fixture exactly', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  const byName = Object.fromEntries(view.byCategory.map((row) => [row.name, row]));
  assert.equal(byName['No connection'].total, 1);
  assert.equal(byName['Slow speed'].total, 1);
  assert.equal(byName.Unknown.total, 1);
  assert.equal(view.byCategory.length, 3);
});

test('no response: only resolved tickets without a note, open work excluded', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  assert.equal(view.noResponse.total, 1);
  assert.equal(view.noResponse.tickets[0].id, 't-4');
  assert.deepEqual(view.noResponse.byMohalla, [{ name: 'Unassigned', count: 1 }]);
  assert.deepEqual(view.noResponse.byCategory, [{ name: 'Device fault', count: 1 }]);
});

test('invalid month gives no view, never a guessed month', () => {
  assert.equal(buildMonthlySatisfaction(NOTES, TICKETS, '2026-13'), null);
  assert.equal(buildMonthlySatisfaction(NOTES, TICKETS, ''), null);
});

test('an undated note belongs to no month but stays in the all-notes total', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-10');
  assert.deepEqual(view.totals, { satisfied: 0, neutral: 1, unhappy: 0, total: 1 });
  assert.equal(view.undatedNotes, 1);
  assert.equal(view.allNotes, 5);
});

test('inputs are never mutated by upsert or by building the view', () => {
  const notesBefore = JSON.parse(JSON.stringify(NOTES));
  const ticketsBefore = JSON.parse(JSON.stringify(TICKETS));
  upsertSatisfactionNote(NOTES, { ticketId: 't-1', rating: 'unhappy', recordedDate: '2026-11-09' });
  buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  assert.deepEqual(NOTES, notesBefore);
  assert.deepEqual(TICKETS, ticketsBefore);
});

test('a note carries no bill, payment, priority, or ticket-status field', () => {
  const note = normalizeSatisfactionNote({ ticketId: 't-1', rating: 'satisfied', recordedDate: '2026-11-05' });
  assert.deepEqual(Object.keys(note).sort(), ['note', 'rating', 'recordedDate', 'ticketId']);
});

test('summary text states month totals and the no-response count', () => {
  const view = buildMonthlySatisfaction(NOTES, TICKETS, '2026-11');
  assert.equal(
    satisfactionSummaryText(view),
    '2026-11: 3 rated (2 satisfied, 0 neutral, 1 unhappy); 1 resolved tickets with no response yet.',
  );
  assert.equal(satisfactionSummaryText(null), 'No satisfaction view.');
});

test('HTML escapes note text and shows the no-response note', () => {
  const view = buildMonthlySatisfaction(
    [{ ticketId: 't-1', rating: 'satisfied', note: '<script>alert(1)</script>', recordedDate: '2026-11-05' }],
    TICKETS,
    '2026-11',
  );
  const html = satisfactionHtml(view);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('no response yet'));
});

test('CSV quotes notes with commas and carries mohalla and category rows', () => {
  const view = buildMonthlySatisfaction(
    [{ ticketId: 't-1', rating: 'satisfied', note: 'Fixed, same day', recordedDate: '2026-11-05' }],
    TICKETS,
    '2026-11',
  );
  const csv = satisfactionCsv(view);
  assert.ok(csv.includes('"Fixed, same day"'));
  assert.ok(csv.startsWith('section,name,satisfied,neutral,unhappy,total'));
  assert.ok(csv.includes('mohalla,Bani,1,0,0,1'));
  assert.equal(satisfactionCsv(null), '');
});

test('filename uses the month, or "all" when the month is invalid', () => {
  assert.equal(satisfactionFilename('2026-11'), 'satisfaction-2026-11.csv');
  assert.equal(satisfactionFilename('2026-13'), 'satisfaction-all.csv');
});

test('rating constants list exactly the three plan ratings', () => {
  assert.deepEqual(SATISFACTION_RATINGS, ['satisfied', 'neutral', 'unhappy']);
});
