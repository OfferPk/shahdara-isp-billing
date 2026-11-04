/**
 * plan59-winback-queue.test.js — Plan 59: former-customer winback queue
 * with re-contact drafts.
 * Pins:
 * - the queue lists exactly the former customers on the same fixture,
 *   ordered by time since leaving (longest first, undated last, then
 *   name A-Z), each with time since leaving and exit reason;
 * - the leaving date is the archived date when valid, else the Plan 57
 *   record's recorded date, else null — never a guessed date; an
 *   impossible date (2026-02-30) or a future leaving date gives a
 *   null time-since-leaving;
 * - no exit record, or a reason outside Plan 57's six, shows as
 *   "not recorded", never as a guessed cause; the latest dated save
 *   conversation wins, undated ones count as the oldest;
 * - marking do-not-re-contact removes an entry from the queue
 *   without deleting its history (exit record and save conversation
 *   are untouched, and unmarking brings the entry back);
 * - a re-contact draft carries no invented improvement claim: with
 *   no operator-typed change it has no improvement sentence, and
 *   with one it carries that text verbatim; it promises no discount
 *   and no instant reconnection, in either variant;
 * - sending only appends to the send log; the module holds no bill,
 *   payment, package, or lifecycle field, and inputs are never
 *   mutated.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validWinbackDate,
  winbackDatePart,
  daysSinceLeaving,
  buildWinbackQueue,
  winbackDoNotRecontactList,
  markDoNotRecontact,
  unmarkDoNotRecontact,
  buildRecontactDraft,
  logWinbackSend,
  findWinbackSends,
  winbackSentText,
  buildWinbackSummary,
  winbackSummaryText,
  winbackHtml,
  winbackCsv,
  winbackFilename,
} from '../winback-queue.js';

const TODAY = '2026-11-04';

const former = [
  { id: 'c1', name: 'Ayesha', mohalla: 'Bani', archivedAt: '2026-08-01T10:00' },
  { id: 'c2', name: 'Bilal', mohalla: 'Kishti', archivedAt: '2026-10-20T09:30' },
  { id: 'c3', name: 'Chandni', mohalla: '', archivedAt: '' },
];

const exits = [
  { customerId: 'c1', reason: 'repeated_faults', recordedDate: '2026-08-01' },
  { customerId: 'c2', reason: 'price', recordedDate: '2026-10-20' },
];

const saves = [
  { customerId: 'c1', outcome: 'declined_left', conversationDate: '2026-07-20' },
  { customerId: 'c1', outcome: 'still_deciding', conversationDate: '2026-07-28' },
];

test('date validation accepts real dates and refuses impossible ones', () => {
  assert.equal(validWinbackDate('2026-11-04'), '2026-11-04');
  assert.equal(validWinbackDate('2024-02-29'), '2024-02-29');
  assert.equal(validWinbackDate('2026-02-30'), null);
  assert.equal(validWinbackDate('2026-13-01'), null);
  assert.equal(validWinbackDate('not-a-date'), null);
  assert.equal(validWinbackDate(''), null);
  assert.equal(winbackDatePart('2026-08-01T10:00'), '2026-08-01');
  assert.equal(winbackDatePart('2026-02-30T10:00'), null);
});

test('days since leaving counts whole days and refuses future dates', () => {
  assert.equal(daysSinceLeaving('2026-11-04', TODAY), 0);
  assert.equal(daysSinceLeaving('2026-08-01', TODAY), 95);
  assert.equal(daysSinceLeaving('2026-11-05', TODAY), null);
  assert.equal(daysSinceLeaving('2026-02-30', TODAY), null);
  assert.equal(daysSinceLeaving(null, TODAY), null);
});

test('queue lists exactly the former customers, longest-since first', () => {
  const queue = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, today: TODAY });
  assert.deepEqual(queue.map((entry) => entry.customerId), ['c1', 'c2', 'c3']);
  assert.equal(queue[0].daysSinceLeaving, 95);
  assert.equal(queue[0].leftDate, '2026-08-01');
  assert.equal(queue[0].exitReason, 'repeated_faults');
  assert.equal(queue[0].exitReasonLabel, 'Repeated faults');
  assert.equal(queue[1].daysSinceLeaving, 15);
  assert.equal(queue[2].daysSinceLeaving, null);
  assert.equal(queue[2].leftDate, null);
  assert.equal(queue[2].exitReason, null);
  assert.equal(queue[2].exitReasonLabel, 'Not recorded');
  assert.equal(queue[2].saveOutcomeLabel, 'Not recorded');
});

test('archived date wins over the exit record date, which is the fallback', () => {
  const queue = buildWinbackQueue({
    formerCustomers: [
      { id: 'x1', name: 'X', archivedAt: '2026-09-10T08:00' },
      { id: 'x2', name: 'Y', archivedAt: '' },
    ],
    exitRecords: [
      { customerId: 'x1', reason: 'price', recordedDate: '2026-09-01' },
      { customerId: 'x2', reason: 'competitor', recordedDate: '2026-09-05' },
    ],
    today: TODAY,
  });
  assert.equal(queue[0].customerId, 'x2');
  assert.equal(queue[0].leftDate, '2026-09-05');
  assert.equal(queue[1].customerId, 'x1');
  assert.equal(queue[1].leftDate, '2026-09-10');
});

test('a reason outside Plan 57 six is not recorded, never guessed', () => {
  const queue = buildWinbackQueue({
    formerCustomers: [{ id: 'z1', name: 'Z', archivedAt: '2026-10-01T00:00' }],
    exitRecords: [{ customerId: 'z1', reason: 'boredom', recordedDate: '2026-10-01' }],
    today: TODAY,
  });
  assert.equal(queue[0].exitReason, null);
  assert.equal(queue[0].exitReasonLabel, 'Not recorded');
});

test('the latest dated save conversation wins and undated counts as oldest', () => {
  const queue = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, today: TODAY });
  assert.equal(queue[0].saveOutcome, 'still_deciding');
  assert.equal(queue[0].saveOutcomeLabel, 'Still deciding');
  const undated = buildWinbackQueue({
    formerCustomers: [{ id: 'u1', name: 'U', archivedAt: '2026-10-01T00:00' }],
    saveConversations: [
      { customerId: 'u1', outcome: 'declined_left', conversationDate: '' },
      { customerId: 'u1', outcome: 'accepted_stayed', conversationDate: '2026-09-01' },
    ],
    today: TODAY,
  });
  assert.equal(undated[0].saveOutcome, 'accepted_stayed');
  const bad = buildWinbackQueue({
    formerCustomers: [{ id: 'u2', name: 'V', archivedAt: '2026-10-01T00:00' }],
    saveConversations: [{ customerId: 'u2', outcome: 'left_happily', conversationDate: '2026-09-01' }],
    today: TODAY,
  });
  assert.equal(bad[0].saveOutcome, null);
});

test('do-not-re-contact removes from the queue without deleting history', () => {
  const flagged = markDoNotRecontact([], 'c1');
  assert.deepEqual(flagged, ['c1']);
  assert.deepEqual(markDoNotRecontact(flagged, 'c1'), ['c1']);
  const queue = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, doNotRecontactIds: flagged, today: TODAY });
  assert.deepEqual(queue.map((entry) => entry.customerId), ['c2', 'c3']);
  const excluded = winbackDoNotRecontactList({ formerCustomers: former, doNotRecontactIds: flagged });
  assert.deepEqual(excluded.map((entry) => entry.customerId), ['c1']);
  assert.deepEqual(unmarkDoNotRecontact(flagged, 'c1'), []);
  const restored = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, doNotRecontactIds: unmarkDoNotRecontact(flagged, 'c1'), today: TODAY });
  assert.equal(restored.length, 3);
  // Flagging never touches the source records themselves.
  assert.equal(exits.length, 2);
  assert.equal(saves.length, 2);
});

test('customers without an id are dropped, never guessed', () => {
  const queue = buildWinbackQueue({
    formerCustomers: [{ name: 'No id', archivedAt: '2026-10-01T00:00' }, { id: 'ok', name: 'Ok', archivedAt: '2026-10-01T00:00' }],
    today: TODAY,
  });
  assert.deepEqual(queue.map((entry) => entry.customerId), ['ok']);
});

test('draft carries no invented improvement claim without operator text', () => {
  const entry = { customerId: 'c1', customerName: 'Ayesha' };
  const roman = buildRecontactDraft(entry, {});
  assert.match(roman.text, /Ayesha/);
  assert.match(roman.text, /wapsi ki dawat/);
  assert.doesNotMatch(roman.text, /discount|foran|instant|fixed|theek ho gaya/i);
  assert.match(roman.text, /koi bill nahi banega/);
  const urdu = buildRecontactDraft(entry, { variant: 'urdu' });
  assert.equal(urdu.variant, 'urdu');
  assert.match(urdu.text, /واپسی کی دعوت/);
  const withChange = buildRecontactDraft(entry, { whatChanged: 'Naya package: 20 Mbps, Rs 1500.' });
  assert.match(withChange.text, /Naya package: 20 Mbps, Rs 1500\./);
  assert.equal(buildRecontactDraft({ customerName: 'No id' }, {}), null);
  assert.equal(buildRecontactDraft(null, {}), null);
});

test('send log appends and finds per customer, and sent text counts', () => {
  const log = logWinbackSend([], { customerId: 'c1', sentAt: '2026-11-04T10:00', variant: 'roman', channel: 'whatsapp' });
  assert.equal(log.length, 1);
  assert.equal(findWinbackSends(log, 'c1').length, 1);
  assert.equal(findWinbackSends(log, 'c2').length, 0);
  assert.equal(logWinbackSend(log, { customerId: '' }).length, 1);
  assert.equal(winbackSentText([]), 'Not sent yet');
  assert.equal(winbackSentText(log), 'Sent once');
  assert.equal(winbackSentText([...log, ...log]), 'Sent 2 times');
});

test('inputs are never mutated and entries carry no money field', () => {
  const snapshot = JSON.stringify(former);
  const queue = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, today: TODAY });
  assert.equal(JSON.stringify(former), snapshot);
  for (const entry of queue) {
    assert.equal('bill' in entry, false);
    assert.equal('payment' in entry, false);
    assert.equal('package' in entry, false);
  }
});

test('summary counts, HTML escaping, CSV quoting, filename', () => {
  const queue = buildWinbackQueue({ formerCustomers: former, exitRecords: exits, saveConversations: saves, today: TODAY });
  const summary = buildWinbackSummary(queue);
  assert.equal(summary.total, 3);
  assert.equal(summary.withExitReason, 2);
  assert.equal(summary.withoutExitReason, 1);
  assert.equal(summary.withSaveOutcome, 1);
  assert.match(winbackSummaryText(summary), /3 former customers/);
  const nasty = [{ ...queue[0], customerName: '<Ayesha & Co>' }];
  assert.doesNotMatch(winbackHtml(nasty), /<Ayesha/);
  assert.match(winbackHtml(nasty), /&lt;Ayesha &amp; Co&gt;/);
  const csv = winbackCsv([{ ...queue[0], customerName: 'Ayesha, Jr' }]);
  assert.match(csv, /"Ayesha, Jr"/);
  assert.equal(winbackFilename(), 'winback-queue.csv');
  assert.match(winbackHtml([]), /No former customers/);
});
