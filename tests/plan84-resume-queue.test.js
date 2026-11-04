/**
 * plan84-resume-queue.test.js — Plan 84: hold expiry and
 * resume queue (returning customers, worked in order).
 * Pins:
 * - the queue lists exactly the holds ending inside the
 *   operator-set window, earliest return first, each with
 *   customer, mohalla, and the billing treatment that
 *   applies on return;
 * - a hold past its return date without confirmation stays
 *   visible as overdue-resume, never silently extended,
 *   closed, or dropped by the window;
 * - confirming a resumption is an operator action through
 *   Plan 82's own endHold (the queue itself only lists);
 * - relocations arrive as a caller-supplied list until
 *   Plan 85 exists, and a resumed relocation never queues;
 * - queue actions never alter any bill or payment, so the
 *   module holds no bill or payment field;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, or customer record
 * is ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RESUME_KINDS,
  RESUME_KIND_LABELS,
  RESUME_STATUSES,
  validResumeDate,
  resumeMohallaKey,
  normalizeResumeHold,
  normalizeResumeRelocation,
  buildResumeQueue,
  overdueResumeQueue,
  resumeQueueFiltered,
  buildResumeSummary,
  resumeSummaryText,
  resumeHtml,
  resumeCsv,
  resumeFilename,
} from '../resume-queue.js';

const TODAY = '2026-01-20';

function hold(overrides = {}) {
  return {
    id: 'h1',
    customerId: 'c1',
    customerName: 'Ayesha',
    expectedReturnDate: '2026-01-25',
    status: 'active',
    treatment: 'no_bill',
    mohalla: 'BANII',
    ...overrides,
  };
}

test('strict dates: impossible dates are not dates', () => {
  assert.equal(validResumeDate('2026-02-30'), null);
  assert.equal(validResumeDate('2026-13-01'), null);
  assert.equal(validResumeDate('not a date'), null);
  assert.equal(validResumeDate('2026-01-20'), '2026-01-20');
});

test('window: only holds ending inside it queue, both ends inclusive', () => {
  const holds = [
    hold({ id: 'past-window', expectedReturnDate: '2026-01-19' }),
    hold({ id: 'today', expectedReturnDate: '2026-01-20' }),
    hold({ id: 'edge', expectedReturnDate: '2026-01-27' }),
    hold({ id: 'outside', expectedReturnDate: '2026-01-28' }),
  ];
  // The 2026-01-19 hold is overdue, so it queues as overdue;
  // the 2026-01-28 hold is outside the 7-day window and drops.
  const queue = buildResumeQueue(holds, [], { today: TODAY, windowDays: 7 });
  assert.deepEqual(queue.map((row) => row.id), ['past-window', 'today', 'edge']);
  assert.equal(queue.find((row) => row.id === 'today').daysUntilReturn, 0);
  assert.equal(queue.find((row) => row.id === 'edge').daysUntilReturn, 7);
});

test('overdue resumes stay visible no matter how far past', () => {
  const holds = [hold({ id: 'old', expectedReturnDate: '2025-11-01' })];
  const queue = buildResumeQueue(holds, [], { today: TODAY, windowDays: 1 });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].status, 'overdue');
  assert.equal(queue[0].daysOverdue, 80);
  assert.equal(queue[0].daysUntilReturn, null);
});

test('ended holds and dateless holds never queue', () => {
  const holds = [
    hold({ id: 'ended', status: 'ended', actualReturnDate: '2026-01-22' }),
    hold({ id: 'dateless', expectedReturnDate: '2026-02-30' }),
    hold({ id: 'no-id', id: '' }),
  ];
  assert.deepEqual(buildResumeQueue(holds, [], { today: TODAY }), []);
});

test('ordering: earliest return first, then name A-Z, then id', () => {
  const holds = [
    hold({ id: 'b', customerName: 'Zain', expectedReturnDate: '2026-01-25' }),
    hold({ id: 'a', customerName: 'Ayesha', expectedReturnDate: '2026-01-25' }),
    hold({ id: 'c', customerName: 'Bilal', expectedReturnDate: '2026-01-22' }),
  ];
  const queue = buildResumeQueue(holds, [], { today: TODAY });
  assert.deepEqual(queue.map((row) => row.id), ['c', 'a', 'b']);
});

test('relocation input: caller-supplied shape queues, resumed never queues', () => {
  const relocations = [
    { id: 'r1', customerId: 'c9', customerName: 'Fatima', returnDate: '2026-01-23', status: 'pending', mohalla: 'bani' },
    { id: 'r2', customerId: 'c8', customerName: 'Hassan', returnDate: '2026-01-23', status: 'resumed', mohalla: '' },
  ];
  const queue = buildResumeQueue([], relocations, { today: TODAY });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].kind, 'relocation');
  assert.equal(queue[0].treatmentLabel, 'Relocation return');
  assert.equal(queue[0].onReturn, 'Ordinary billing resumes');
});

test('holds and relocations share one queue, ordered together', () => {
  const holds = [hold({ id: 'h', expectedReturnDate: '2026-01-24' })];
  const relocations = [{ id: 'r', customerId: 'c2', customerName: 'Omar', returnDate: '2026-01-21', status: 'pending', mohalla: '' }];
  const queue = buildResumeQueue(holds, relocations, { today: TODAY });
  assert.deepEqual(queue.map((row) => row.id), ['r', 'h']);
});

test('invalid today yields no queue; invalid window falls back to 7 days', () => {
  assert.deepEqual(buildResumeQueue([hold()], [], { today: '2026-02-30' }), []);
  assert.deepEqual(buildResumeQueue([hold()], [], { today: TODAY, windowDays: -3 }).map((row) => row.id), ['h1']);
  assert.deepEqual(buildResumeQueue([hold({ expectedReturnDate: '2026-01-28' })], [], { today: TODAY, windowDays: 'seven' }), []);
});

test('filters: status, kind, and Plan T mohalla canonical keys', () => {
  assert.equal(resumeMohallaKey('bani'), 'BANII');
  assert.equal(resumeMohallaKey(''), '__unassigned__');
  const queue = buildResumeQueue(
    [hold({ id: 'h', expectedReturnDate: '2026-01-25', mohalla: 'Mohalla Bani' })],
    [{ id: 'r', customerId: 'c2', customerName: 'Omar', returnDate: '2026-01-21', status: 'pending', mohalla: 'BANII' }],
    { today: TODAY },
  );
  assert.equal(resumeQueueFiltered(queue, { mohalla: 'bani' }).length, 2);
  assert.equal(resumeQueueFiltered(queue, { kind: 'relocation' }).length, 1);
  assert.equal(resumeQueueFiltered(queue, { status: 'overdue' }).length, 0);
  assert.equal(resumeQueueFiltered(queue, { mohalla: 'KISHTII' }).length, 0);
});

test('overdue-only helper returns exactly the overdue rows', () => {
  const holds = [
    hold({ id: 'over', expectedReturnDate: '2026-01-10' }),
    hold({ id: 'soon', expectedReturnDate: '2026-01-22' }),
  ];
  assert.deepEqual(overdueResumeQueue(holds, [], { today: TODAY }).map((row) => row.id), ['over']);
});

test('summary counts and text', () => {
  const queue = buildResumeQueue(
    [hold({ id: 'over', expectedReturnDate: '2026-01-10' }), hold({ id: 'soon', expectedReturnDate: '2026-01-22' })],
    [{ id: 'r', customerId: 'c2', returnDate: '2026-01-23', status: 'pending', mohalla: '' }],
    { today: TODAY },
  );
  const summary = buildResumeSummary(queue);
  assert.deepEqual(summary, { total: 3, dueSoon: 2, overdue: 1, holds: 2, relocations: 1 });
  assert.equal(resumeSummaryText(summary), '3 resumes — 2 due soon — 1 overdue');
  assert.equal(resumeSummaryText(buildResumeSummary([])), 'No resumes in the window and none overdue.');
});

test('inputs are never mutated', () => {
  const holds = [hold()];
  const snapshot = JSON.stringify(holds);
  buildResumeQueue(holds, [], { today: TODAY });
  assert.equal(JSON.stringify(holds), snapshot);
});

test('no bill, payment, or package field anywhere in a queue entry', () => {
  const queue = buildResumeQueue([hold()], [], { today: TODAY });
  const keys = Object.keys(queue[0]);
  for (const banned of ['billId', 'bill', 'paymentId', 'payment', 'package', 'amountCents']) {
    assert.ok(!keys.includes(banned), `queue entry must not carry ${banned}`);
  }
  const source = readFileSync(new URL('../resume-queue.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('billId') && !source.includes('paymentId'), 'module source carries no bill/payment link field');
});

test('HTML escaping, CSV quoting, and filename', () => {
  const queue = buildResumeQueue(
    [hold({ customerName: 'Ayesha <script>', mohalla: 'Ba,nii "x"' })],
    [],
    { today: TODAY },
  );
  const html = resumeHtml(queue);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Ayesha &lt;script&gt;'));
  const csv = resumeCsv(queue);
  assert.ok(csv.includes('"Ba,nii ""x"""'));
  assert.equal(resumeFilename(), 'resume-queue.csv');
  assert.ok(resumeHtml([]).includes('No resumes'));
});

test('catalogues are fixed and labelled', () => {
  assert.deepEqual(RESUME_KINDS, ['hold', 'relocation']);
  assert.deepEqual(RESUME_STATUSES, ['due_soon', 'overdue']);
  assert.equal(RESUME_KIND_LABELS.hold, 'Vacation hold');
  assert.equal(normalizeResumeHold(hold({ treatment: 'bogus' })), null);
  assert.equal(normalizeResumeRelocation({ id: 'r', customerId: 'c', returnDate: '2026-02-30' }), null);
});
