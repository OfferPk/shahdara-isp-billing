import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VISIT_OUTCOMES,
  VISIT_OUTCOME_LABELS,
  QUEUEABLE_VISIT_OUTCOMES,
  normalizeVisitOutcome,
  isPlan2Outcome,
  isQueueableOutcome,
  deriveNextActionDate,
  normalizeVisitRecord,
  validatePaidVisit,
  buildNextActionQueue,
  queueSummary,
} from '../visit-outcomes.js';

import {
  FIELD_ROUTE_OUTCOMES,
  saveFieldRouteOutcome,
  getFieldRouteOutcomes,
} from '../nav-collection-rounds.js';

const mockStorage = () => ({
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
});

const visit = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Customer',
  mohalla: 'Bazaar',
  outcome: 'not_home',
  note: '',
  visitDate: '2026-11-03',
  ...overrides,
});

// ---- catalogue ----

test('catalogue holds exactly Plan 2 six outcomes with labels', () => {
  assert.deepEqual([...VISIT_OUTCOMES], ['paid', 'promised', 'not_home', 'refused', 'dispute', 'no_answer']);
  assert.equal(VISIT_OUTCOME_LABELS.not_home, 'Not home');
  assert.equal(VISIT_OUTCOME_LABELS.no_answer, 'No answer');
  assert.equal(VISIT_OUTCOME_LABELS.dispute, 'Dispute');
});

test('normalize maps aliases and rejects non-outcomes without inventing one', () => {
  assert.equal(normalizeVisitOutcome('not home'), 'not_home');
  assert.equal(normalizeVisitOutcome('No Answer'), 'no_answer');
  assert.equal(normalizeVisitOutcome('  DISPUTE  '), 'dispute');
  assert.equal(normalizeVisitOutcome('promised to pay'), 'promised');
  assert.equal(normalizeVisitOutcome('pending'), null);
  assert.equal(normalizeVisitOutcome('partial'), null);
  assert.equal(normalizeVisitOutcome('something else'), null);
  assert.equal(normalizeVisitOutcome(''), null);
  assert.equal(normalizeVisitOutcome(null), null);
});

test('queueable outcomes are promised and missed visits only', () => {
  assert.equal(isQueueableOutcome('promised'), true);
  assert.equal(isQueueableOutcome('not_home'), true);
  assert.equal(isQueueableOutcome('no_answer'), true);
  assert.equal(isQueueableOutcome('refused'), true);
  assert.equal(isQueueableOutcome('dispute'), true);
  assert.equal(isQueueableOutcome('paid'), false);
  assert.equal(isQueueableOutcome('pending'), false);
  assert.equal(isPlan2Outcome('paid'), true);
  assert.equal(isPlan2Outcome('pending'), false);
  assert.deepEqual([...QUEUEABLE_VISIT_OUTCOMES], ['promised', 'not_home', 'refused', 'dispute', 'no_answer']);
});

// ---- next-action date ----

test('deriveNextActionDate: explicit date wins, promised uses promiseDate, missed visits go next day', () => {
  assert.equal(deriveNextActionDate('not_home', { visitDate: '2026-11-03', nextActionDate: '2026-11-10' }), '2026-11-10');
  assert.equal(deriveNextActionDate('promised', { visitDate: '2026-11-03', promiseDate: '2026-11-08' }), '2026-11-08');
  assert.equal(deriveNextActionDate('promised', { visitDate: '2026-11-03', nextActionDate: '2026-11-05', promiseDate: '2026-11-08' }), '2026-11-05');
  assert.equal(deriveNextActionDate('no_answer', { visitDate: '2026-11-03' }), '2026-11-04');
  assert.equal(deriveNextActionDate('refused', { visitDate: '2026-11-30' }), '2026-12-01');
  assert.equal(deriveNextActionDate('dispute', { visitDate: '2026-11-03', promiseDate: '2026-11-20' }), '2026-11-04');
});

test('deriveNextActionDate returns null only when no usable date exists, ignoring invalid dates', () => {
  assert.equal(deriveNextActionDate('not_home', {}), null);
  assert.equal(deriveNextActionDate('not_home', { visitDate: 'not-a-date', nextActionDate: '2026-13-40' }), null);
  assert.equal(deriveNextActionDate('promised', { visitDate: '2026-11-03', promiseDate: 'bogus' }), '2026-11-04');
});

// ---- record normalisation ----

test('normalizeVisitRecord keeps exactly one outcome and drops records without one or without a customer', () => {
  const entry = normalizeVisitRecord(visit({ outcome: 'No Answer', note: 'Door locked', customerName: 'Ali' }));
  assert.equal(entry.outcome, 'no_answer');
  assert.equal(entry.outcomeLabel, 'No answer');
  assert.equal(entry.note, 'Door locked');
  assert.equal(entry.nextActionDate, '2026-11-04');
  assert.equal(normalizeVisitRecord(visit({ outcome: 'pending' })), null);
  assert.equal(normalizeVisitRecord(visit({ outcome: 'paid', customerId: '' })), null);
  assert.equal(normalizeVisitRecord(null), null);
  assert.equal(normalizeVisitRecord('not_home'), null);
});

test('a dispute visit entry explicitly does not create a dispute case', () => {
  const entry = normalizeVisitRecord(visit({ outcome: 'dispute', note: 'Bill wrong' }));
  assert.equal(entry.disputeCaseCreated, false);
  const other = normalizeVisitRecord(visit({ outcome: 'not_home' }));
  assert.equal('disputeCaseCreated' in other, false);
});

// ---- paid-visit payment rule ----

test('validatePaidVisit flags a paid visit with no payment record and passes one with evidence', () => {
  assert.match(validatePaidVisit(visit({ outcome: 'paid' })), /requires a real payment record/);
  assert.equal(validatePaidVisit(visit({ outcome: 'paid', paymentId: 'TID-1' })), null);
  assert.equal(validatePaidVisit(visit({ outcome: 'paid', paymentRecorded: true })), null);
  assert.match(validatePaidVisit(visit({ outcome: 'partial' })), /requires a real payment record/);
  assert.equal(validatePaidVisit(visit({ outcome: 'partial', paymentRecorded: true })), null);
  assert.equal(validatePaidVisit(visit({ outcome: 'not_home' })), null);
  assert.equal(validatePaidVisit(visit({ outcome: 'dispute' })), null);
});

// ---- queue ----

test('buildNextActionQueue includes promised and missed visits only, sorted by date then name', () => {
  const queue = buildNextActionQueue([
    visit({ customerId: 'c3', customerName: 'Zahid', outcome: 'promised', visitDate: '2026-11-03', promiseDate: '2026-11-06' }),
    visit({ customerId: 'c1', customerName: 'Ali', outcome: 'not_home', visitDate: '2026-11-03' }),
    visit({ customerId: 'c2', customerName: 'Bilal', outcome: 'paid', visitDate: '2026-11-03', paymentId: 'TID-9' }),
    visit({ customerId: 'c4', customerName: 'Sara', outcome: 'pending', visitDate: '2026-11-03' }),
    visit({ customerId: 'c5', customerName: 'Ayesha', outcome: 'no_answer', visitDate: '2026-11-02' }),
  ]);
  assert.deepEqual(queue.map((e) => e.customerId), ['c5', 'c1', 'c3']);
  assert.equal(queue[0].nextActionDate, '2026-11-03');
  assert.equal(queue[1].nextActionDate, '2026-11-04');
  assert.equal(queue[2].nextActionDate, '2026-11-06');
});

test('queue sorts dateless entries last and breaks date ties by name then id', () => {
  const queue = buildNextActionQueue([
    visit({ customerId: 'c9', customerName: 'Zed', outcome: 'refused', visitDate: '' }),
    visit({ customerId: 'c2', customerName: 'Ali', outcome: 'dispute', visitDate: '2026-11-03' }),
    visit({ customerId: 'c1', customerName: 'Ali', outcome: 'not_home', visitDate: '2026-11-03' }),
  ]);
  assert.deepEqual(queue.map((e) => e.customerId), ['c1', 'c2', 'c9']);
  assert.equal(queue[2].nextActionDate, null);
});

test('queue marks overdue only against an explicitly supplied today, never the clock', () => {
  const queue = buildNextActionQueue([
    visit({ customerId: 'c1', outcome: 'not_home', visitDate: '2026-11-03' }),
    visit({ customerId: 'c2', outcome: 'promised', visitDate: '2026-11-03', promiseDate: '2026-11-20' }),
  ], { today: '2026-11-10' });
  assert.equal(queue[0].overdue, true);
  assert.equal(queue[1].overdue, false);
  const noToday = buildNextActionQueue([visit({ customerId: 'c1', outcome: 'not_home', visitDate: '2020-01-01' })]);
  assert.equal(noToday[0].overdue, false);
});

test('queueSummary counts match the queue itself, including overdue and per-outcome counts', () => {
  const queue = buildNextActionQueue([
    visit({ customerId: 'c1', outcome: 'not_home', visitDate: '2026-11-03' }),
    visit({ customerId: 'c2', outcome: 'not_home', visitDate: '2026-11-03' }),
    visit({ customerId: 'c3', outcome: 'promised', visitDate: '2026-11-03', promiseDate: '2026-11-20' }),
    visit({ customerId: 'c4', outcome: 'paid', visitDate: '2026-11-03', paymentId: 'TID-1' }),
  ], { today: '2026-11-10' });
  const summary = queueSummary(queue);
  assert.equal(summary.total, 3);
  assert.equal(summary.overdue, 2);
  assert.equal(summary.byOutcome.not_home, 2);
  assert.equal(summary.byOutcome.promised, 1);
  assert.equal(summary.byOutcome.paid, undefined);
  assert.deepEqual(queueSummary([]), { total: 0, overdue: 0, byOutcome: { promised: 0, not_home: 0, refused: 0, dispute: 0, no_answer: 0 } });
});

test('queue never mutates its input visits', () => {
  const visits = [visit({ customerId: 'c1', outcome: 'not_home' })];
  const before = JSON.stringify(visits);
  buildNextActionQueue(visits, { today: '2026-11-10' });
  assert.equal(JSON.stringify(visits), before);
});

// ---- wiring through the existing route storage ----

test('route storage now records dispute and no_answer outcomes and keeps their next-action date', () => {
  const store = mockStorage();
  const res = saveFieldRouteOutcome('cust-201', { outcome: 'dispute', note: 'Says bill is double', nextActionDate: '2026-11-06' }, store, '2026-11-03');
  assert.equal(res.outcome, 'dispute');
  assert.equal(res.nextActionDate, '2026-11-06');
  const res2 = saveFieldRouteOutcome('cust-202', { outcome: 'no_answer', note: 'Phone off' }, store, '2026-11-03');
  assert.equal(res2.outcome, 'no_answer');
  const outcomes = getFieldRouteOutcomes(store, '2026-11-03');
  assert.equal(outcomes['cust-201'].outcome, 'dispute');
  assert.equal(outcomes['cust-202'].outcome, 'no_answer');
  assert.equal(FIELD_ROUTE_OUTCOMES.DISPUTE, 'dispute');
  assert.equal(FIELD_ROUTE_OUTCOMES.NO_ANSWER, 'no_answer');
});

test('stored route outcomes feed the queue end to end', () => {
  const store = mockStorage();
  saveFieldRouteOutcome('cust-301', { outcome: 'promised', promiseDate: '2026-11-05', note: 'Will pay Friday' }, store, '2026-11-03');
  saveFieldRouteOutcome('cust-302', { outcome: 'not_home', note: 'Shop closed' }, store, '2026-11-03');
  saveFieldRouteOutcome('cust-303', { outcome: 'paid', amount: 1000 }, store, '2026-11-03');
  const outcomes = getFieldRouteOutcomes(store, '2026-11-03');
  const visits = Object.entries(outcomes).map(([customerId, rec]) => ({
    customerId,
    customerName: customerId,
    outcome: rec.outcome,
    note: rec.note,
    visitDate: '2026-11-03',
    promiseDate: rec.promiseDate,
    nextActionDate: rec.nextActionDate,
  }));
  const queue = buildNextActionQueue(visits);
  assert.deepEqual(queue.map((e) => e.customerId), ['cust-302', 'cust-301']);
});

test('existing outcomes still record exactly as before', () => {
  const store = mockStorage();
  const res = saveFieldRouteOutcome('cust-401', { outcome: 'promised', promiseDate: '2026-11-09', promiseAmount: 500 }, store, '2026-11-03');
  assert.equal(res.outcome, 'promised');
  assert.equal(res.promiseDate, '2026-11-09');
  const bad = saveFieldRouteOutcome('cust-402', { outcome: 'nonsense' }, store, '2026-11-03');
  assert.equal(bad.outcome, 'pending');
});
