/**
 * plan55-restoration-sweep.test.js — Plan 55: post-outage restoration
 * verification sweep.
 * Pins:
 * - date validation, half-formed refusal, and blank date/note
 *   staying null, never guessed;
 * - one sweep per id (re-save replaces), remove/find, and
 *   non-mutation;
 * - affected customers exactly (mohalla canonical rule incl.
 *   aliases, segment via the connection register, archived listed
 *   separately, no-mohalla-no-segment never assigned);
 * - the segment checklist (sweep segments plus affected segments,
 *   no-segment group, check shown, confirmed/still-down counts);
 * - segment checks (real date and named checker required, re-check
 *   replaces, checklist-scope refusal);
 * - customer confirm / still-down (never both, still-down wins in
 *   stored data);
 * - the follow-up list (stored link wins, ticket fallback, name
 *   order) and the follow-up ticket draft (draft only, never a
 *   ticket write, never a reopen);
 * - completion keeps the sweep as history and changes nothing else;
 * - summary text, HTML escaping, CSV quoting, filename safety,
 *   and the fence: no bill, payment, or ticket-status field.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SWEEP_STATUSES,
  isValidSweepDate,
  canonicalSweepMohalla,
  normalizeSweep,
  normalizeSweepList,
  sortSweeps,
  upsertSweep,
  removeSweep,
  findSweep,
  markSegmentChecked,
  markCustomerConfirmed,
  markCustomerStillDown,
  completeSweep,
  sweepAffectedCustomers,
  sweepChecklist,
  sweepFollowUpList,
  followUpTicketDraft,
  sweepSummaryText,
  sweepsHtml,
  sweepsCsv,
  sweepFilename,
} from '../restoration-sweep.js';

const base = {
  id: 'SW55-1',
  outageId: 'O22-1',
  date: '2026-11-02',
  mohallas: ['Bani'],
  segments: ['Splitter A'],
  note: 'After the upstream fix',
};

const customers = [
  { id: 'c1', name: 'Ahmed', mohalla: 'Bani', archived: false },
  { id: 'c2', name: 'Bilal', mohalla: 'Kishti', archived: false },
  { id: 'c3', name: 'Chaudhry', mohalla: 'Bani', archived: true },
  { id: 'c4', name: 'Danish', mohalla: '', archived: false },
];

const connections = [
  { customerId: 'c2', splitter: 'Splitter A' },
  { customerId: 'c4', splitter: 'Splitter B' },
];

test('date validation: real dates pass, impossible dates fail', () => {
  assert.equal(isValidSweepDate('2026-11-02'), true);
  assert.equal(isValidSweepDate('2024-02-29'), true);
  assert.equal(isValidSweepDate('2026-02-30'), false);
  assert.equal(isValidSweepDate('2026-13-01'), false);
  assert.equal(isValidSweepDate('not-a-date'), false);
  assert.equal(isValidSweepDate(''), false);
});

test('canonical mohalla: aliases collapse, prefix stripped, blank is null', () => {
  assert.equal(canonicalSweepMohalla('bani').stored, 'BANII');
  assert.equal(canonicalSweepMohalla('Mohalla Kishti').stored, 'KISHTII');
  assert.equal(canonicalSweepMohalla('chamyaa').stored, 'CHAMYAAA');
  assert.equal(canonicalSweepMohalla(''), null);
  assert.equal(canonicalSweepMohalla('  '), null);
});

test('half-formed sweeps refused outright, blank date/note stay null', () => {
  assert.equal(normalizeSweep(null), null);
  assert.equal(normalizeSweep({ ...base, id: '' }), null);
  assert.equal(normalizeSweep({ ...base, outageId: '' }), null);
  assert.equal(normalizeSweep({ ...base, mohallas: [], segments: [] }), null);
  assert.equal(normalizeSweep({ ...base, date: '2026-02-30' }), null);
  assert.equal(normalizeSweep({ ...base, status: 'unknown' }), null);
  const blank = normalizeSweep({ id: 'SW55-2', outageId: 'O22-2', mohallas: ['Bani'] });
  assert.equal(blank.date, null);
  assert.equal(blank.note, null);
  assert.equal(blank.status, SWEEP_STATUSES.OPEN);
});

test('upsert replaces by id, remove/find work, inputs never mutated', () => {
  const frozen = Object.freeze({ ...base });
  const list = upsertSweep([], frozen);
  assert.equal(list.length, 1);
  assert.equal(frozen.checks, undefined);
  const replaced = upsertSweep(list, { ...base, note: 'Updated note' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].note, 'Updated note');
  assert.equal(list[0].note, 'After the upstream fix');
  assert.equal(findSweep(replaced, 'SW55-1').outageId, 'O22-1');
  assert.equal(findSweep(replaced, 'missing'), null);
  assert.equal(removeSweep(replaced, 'SW55-1').length, 0);
  assert.equal(removeSweep(replaced, '').length, 1);
  assert.deepEqual(normalizeSweepList('not-a-list'), []);
});

test('affected customers exactly: mohalla, segment, archived separate, unassigned never assigned', () => {
  const result = sweepAffectedCustomers(base, { customers, connections });
  assert.equal(result.totalCustomers, 4);
  assert.equal(result.affectedCount, 2);
  assert.deepEqual(result.customers.map((row) => row.customerId), ['c1', 'c2']);
  assert.equal(result.customers[0].matchedBy, 'mohalla');
  assert.equal(result.customers[1].matchedBy, 'segment');
  assert.equal(result.customers[1].segment, 'Splitter A');
  assert.deepEqual(result.archivedCustomers.map((row) => row.customerId), ['c3']);
  assert.equal(sweepAffectedCustomers({ ...base, mohallas: ['Nowhere'], segments: [] }, { customers, connections }).affectedCount, 0);
  assert.deepEqual(sweepAffectedCustomers(null, { customers, connections }).customers, []);
});

test('checklist: sweep segments plus affected segments, no-segment group, counts', () => {
  const affected = sweepAffectedCustomers(base, { customers, connections });
  const checklist = sweepChecklist(base, affected);
  assert.deepEqual(checklist.map((row) => row.segment), ['No segment recorded', 'Splitter A']);
  const splitter = checklist.find((row) => row.segment === 'Splitter A');
  assert.deepEqual(splitter.customers.map((row) => row.customerId), ['c2']);
  assert.equal(splitter.checked, null);
  const noSegment = checklist.find((row) => row.segment === 'No segment recorded');
  assert.deepEqual(noSegment.customers.map((row) => row.customerId), ['c1']);
  assert.deepEqual(sweepChecklist(null, affected), []);
});

test('segment checks: bad input refused, re-check replaces, checklist scope enforced', () => {
  const list = upsertSweep([], base);
  assert.equal(markSegmentChecked(list, 'SW55-1', { segment: 'Splitter A', date: '2026-02-30', by: 'Saad' }), list);
  assert.equal(markSegmentChecked(list, 'SW55-1', { segment: 'Splitter A', date: '2026-11-02', by: '' }), list);
  assert.equal(markSegmentChecked(list, 'missing', { segment: 'Splitter A', date: '2026-11-02', by: 'Saad' }), list);
  const checked = markSegmentChecked(list, 'SW55-1', { segment: 'Splitter A', date: '2026-11-02', by: 'Saad' });
  assert.equal(checked[0].checks.length, 1);
  assert.equal(checked[0].checks[0].by, 'Saad');
  const rechecked = markSegmentChecked(checked, 'SW55-1', { segment: 'Splitter A', date: '2026-11-03', by: 'Owner' });
  assert.equal(rechecked[0].checks.length, 1);
  assert.equal(rechecked[0].checks[0].by, 'Owner');
  assert.equal(markSegmentChecked(list, 'SW55-1', { segment: 'Splitter Z', date: '2026-11-02', by: 'Saad' }, ['Splitter A']), list);
  const allowed = markSegmentChecked(list, 'SW55-1', { segment: 'splitter a', date: '2026-11-02', by: 'Saad' }, ['Splitter A']);
  assert.equal(allowed[0].checks.length, 1);
});

test('customer confirm and still-down: never both, still-down wins in stored data', () => {
  const list = upsertSweep([], base);
  const confirmed = markCustomerConfirmed(list, 'SW55-1', 'c1');
  assert.deepEqual(confirmed[0].confirmedCustomerIds, ['c1']);
  assert.equal(markCustomerConfirmed(confirmed, 'SW55-1', 'c1'), confirmed);
  const flagged = markCustomerStillDown(confirmed, 'SW55-1', { customerId: 'c1', originalTicketId: 'T21-9', note: 'ONU dark' });
  assert.deepEqual(flagged[0].confirmedCustomerIds, []);
  assert.equal(flagged[0].stillDownCases.length, 1);
  assert.equal(flagged[0].stillDownCases[0].originalTicketId, 'T21-9');
  const back = markCustomerConfirmed(flagged, 'SW55-1', 'c1');
  assert.deepEqual(back[0].confirmedCustomerIds, ['c1']);
  assert.deepEqual(back[0].stillDownCases, []);
  assert.equal(markCustomerStillDown(list, 'SW55-1', { customerId: '' }), list);
  assert.equal(markCustomerConfirmed(list, 'missing', 'c1'), list);
  const stored = normalizeSweep({ ...base, confirmedCustomerIds: ['c1'], stillDownCases: [{ customerId: 'c1' }] });
  assert.deepEqual(stored.confirmedCustomerIds, []);
});

test('follow-up list: stored link wins, ticket fallback, name order', () => {
  const sweep = normalizeSweep({
    ...base,
    stillDownCases: [
      { customerId: 'c2', originalTicketId: 'T21-5', note: 'Still dark' },
      { customerId: 'c1', note: '' },
    ],
  });
  const tickets = [{ id: 'T21-1', customerId: 'c1' }, { id: 'T21-2', customerId: 'c1' }];
  const followUps = sweepFollowUpList(sweep, { customers, tickets });
  assert.deepEqual(followUps.map((entry) => entry.customerId), ['c1', 'c2']);
  assert.equal(followUps[0].customerName, 'Ahmed');
  assert.equal(followUps[0].originalTicketId, 'T21-1');
  assert.equal(followUps[1].originalTicketId, 'T21-5');
  assert.equal(followUps[0].note, null);
  assert.deepEqual(sweepFollowUpList(null, {}), []);
});

test('follow-up ticket draft: draft only, names outage and ticket, no bill/payment field', () => {
  const draft = followUpTicketDraft({ customerId: 'c1', originalTicketId: 'T21-1', note: 'ONU dark' }, { outageId: 'O22-1' });
  assert.equal(draft.customerId, 'c1');
  assert.equal(draft.category, 'no_connection');
  assert.equal(draft.priority, 'high');
  assert.equal(draft.status, 'open');
  assert.match(draft.note, /O22-1/);
  assert.match(draft.note, /T21-1/);
  assert.equal(draft.bill, undefined);
  assert.equal(draft.payment, undefined);
  assert.equal(draft.ticketStatus, undefined);
  assert.equal(followUpTicketDraft({ customerId: '' }, {}), null);
  const noOutage = followUpTicketDraft({ customerId: 'c1' }, {});
  assert.match(noOutage.note, /not recorded/);
});

test('completion keeps the sweep as history and changes nothing else', () => {
  const list = upsertSweep([], base);
  const done = completeSweep(list, 'SW55-1');
  assert.equal(done[0].status, SWEEP_STATUSES.COMPLETED);
  assert.equal(done[0].outageId, 'O22-1');
  assert.equal(completeSweep(done, 'SW55-1'), done);
  assert.equal(completeSweep(list, 'missing'), list);
});

test('sorting: dated first oldest first, undated last, then id', () => {
  const sorted = sortSweeps([
    { id: 'SW55-3', outageId: 'O22-3', mohallas: ['Bani'] },
    { id: 'SW55-1', outageId: 'O22-1', date: '2026-11-02', mohallas: ['Bani'] },
    { id: 'SW55-2', outageId: 'O22-2', date: '2026-11-01', mohallas: ['Bani'] },
  ]);
  assert.deepEqual(sorted.map((sweep) => sweep.id), ['SW55-2', 'SW55-1', 'SW55-3']);
});

test('summary text counts sweeps, checks, confirmed, and still-down', () => {
  assert.equal(sweepSummaryText([]), 'No restoration sweeps recorded yet.');
  const list = markCustomerStillDown(
    markSegmentChecked(upsertSweep([], base), 'SW55-1', { segment: 'Splitter A', date: '2026-11-02', by: 'Saad' }),
    'SW55-1',
    { customerId: 'c1' },
  );
  assert.equal(
    sweepSummaryText(list),
    '1 sweep: 1 open, 0 completed; 1 segment checked, 0 customers confirmed back, 1 still down.',
  );
});

test('HTML escapes values and CSV quotes commas', () => {
  const nasty = normalizeSweep({ ...base, note: '<b>&"quoted"</b>' });
  const html = sweepsHtml([nasty], { 'SW55-1': { affectedCount: 2, followUps: [{ customerName: 'Ahmed<script>' }] } });
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;/);
  assert.match(html, /Ahmed&lt;script&gt;/);
  assert.match(html, /Splitter A/);
  const csv = sweepsCsv([nasty]);
  assert.match(csv, /"<b>&""quoted""<\/b>"/);
  assert.match(csv, /^id,outage_id,date,status,mohallas,segments,covered_customers,segments_checked,customers_confirmed,customers_still_down,note\n/);
});

test('filename uses the given date, unknown date otherwise', () => {
  assert.equal(sweepFilename('2026-11-04'), 'restoration-sweeps-2026-11-04.csv');
  assert.equal(sweepFilename('bad'), 'restoration-sweeps-unknown-date.csv');
  assert.equal(sweepFilename(), 'restoration-sweeps-unknown-date.csv');
});

test('checklist counts confirmed and still-down inside each segment', () => {
  const sweep = normalizeSweep({
    ...base,
    confirmedCustomerIds: ['c1'],
    stillDownCases: [{ customerId: 'c2' }],
  });
  const affected = sweepAffectedCustomers(sweep, { customers, connections });
  const checklist = sweepChecklist(sweep, affected);
  const splitter = checklist.find((row) => row.segment === 'Splitter A');
  assert.equal(splitter.stillDownCount, 1);
  assert.equal(splitter.confirmedCount, 0);
  const noSegment = checklist.find((row) => row.segment === 'No segment recorded');
  assert.equal(noSegment.confirmedCount, 1);
  assert.equal(noSegment.stillDownCount, 0);
});
