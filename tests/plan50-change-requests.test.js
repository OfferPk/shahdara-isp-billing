/**
 * plan50-change-requests.test.js — Plan 50: customer-requested plan
 * change queue.
 * Pins:
 * - each request carries exactly one customer, one of the four
 *   types, and one of the four statuses; half-formed records
 *   (no id, no customer, unknown type/status, impossible date
 *   2026-02-30, declined without a reason) are refused, never
 *   stored half-formed; blanks become null, never guesses;
 * - the status machine (pending/in-progress forward, done and
 *   declined terminal, declining needs a reason, marking done
 *   records the fulfilling-change link) with refused moves leaving
 *   the list unchanged;
 * - the waiting queue (open only, oldest requested date first,
 *   undated last) and filtering by type and mohalla
 *   (case-insensitive, "Mohalla Bani" matches "bani", unassigned
 *   customers never dropped);
 * - queue actions never alter a bill, payment, or package (the
 *   record holds no such field, and inputs are never mutated).
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANGE_REQUEST_TYPES,
  CHANGE_REQUEST_STATUSES,
  validChangeRequestDate,
  normalizeChangeRequest,
  normalizeChangeRequestList,
  findChangeRequest,
  upsertChangeRequest,
  removeChangeRequest,
  setChangeRequestStatus,
  changeRequestMohallaOf,
  filterChangeRequests,
  sortChangeRequests,
  changeRequestQueue,
  changeRequestSummaryText,
  changeRequestsHtml,
  changeRequestsCsv,
  changeRequestFilename,
} from '../change-requests.js';

const CUSTOMERS = [
  { id: 'c-1', name: 'Ahmed', mohalla: 'Bani' },
  { id: 'c-2', name: 'Bilal', mohalla: 'Kishti' },
  { id: 'c-3', name: 'Usman', mohalla: '' },
];

const REQUESTS = [
  { id: 'r-1', customerId: 'c-1', customerName: 'Ahmed', type: 'package_change', detail: 'Move to 20 Mbps', dateRequested: '2026-11-02', status: 'pending', handler: 'Saad' },
  { id: 'r-2', customerId: 'c-2', customerName: 'Bilal', type: 'relocation', detail: 'Shift to new street', dateRequested: '2026-11-01', status: 'in_progress', handler: '' },
  { id: 'r-3', customerId: 'c-1', customerName: 'Ahmed', type: 'due_date_change', detail: '', dateRequested: '', status: 'pending', handler: '' },
  { id: 'r-4', customerId: 'c-3', customerName: 'Usman', type: 'other', detail: 'Router swap ask', dateRequested: '2026-10-28', status: 'done', handler: 'Owner', fulfilledBy: 'profile Edit form, 2026-10-30' },
  { id: 'r-5', customerId: 'c-2', customerName: 'Bilal', type: 'package_change', detail: 'Downgrade ask', dateRequested: '2026-10-30', status: 'declined', handler: '', declineReason: 'Package not available in area' },
];

test('date validation: real dates pass, impossible dates fail', () => {
  assert.equal(validChangeRequestDate('2026-11-02'), '2026-11-02');
  assert.equal(validChangeRequestDate('2026-02-30'), null);
  assert.equal(validChangeRequestDate('2026-13-01'), null);
  assert.equal(validChangeRequestDate('not-a-date'), null);
  assert.equal(validChangeRequestDate(''), null);
});

test('normalise rejects half-formed requests, blanks become null not guesses', () => {
  assert.equal(normalizeChangeRequest(null), null);
  assert.equal(normalizeChangeRequest({ customerId: 'c-1', type: 'relocation' }), null);
  assert.equal(normalizeChangeRequest({ id: 'r-x', type: 'relocation' }), null);
  assert.equal(normalizeChangeRequest({ id: 'r-x', customerId: 'c-1', type: 'teleport' }), null);
  assert.equal(normalizeChangeRequest({ id: 'r-x', customerId: 'c-1', type: 'relocation', status: 'waiting' }), null);
  assert.equal(normalizeChangeRequest({ id: 'r-x', customerId: 'c-1', type: 'relocation', dateRequested: '2026-02-30' }), null);
  assert.equal(normalizeChangeRequest({ id: 'r-x', customerId: 'c-1', type: 'relocation', status: 'declined' }), null);
  assert.deepEqual(normalizeChangeRequest({ id: ' r-x ', customerId: 'c-1', type: 'other', detail: '  ', handler: '' }), {
    id: 'r-x', customerId: 'c-1', customerName: null, type: 'other', detail: null,
    dateRequested: null, status: 'pending', handler: null, fulfilledBy: null, declineReason: null,
  });
});

test('type and status catalogues match the plan', () => {
  assert.deepEqual(CHANGE_REQUEST_TYPES, ['package_change', 'due_date_change', 'relocation', 'other']);
  assert.deepEqual(CHANGE_REQUEST_STATUSES, ['pending', 'in_progress', 'done', 'declined']);
});

test('upsert replaces by id and refuses invalid records unchanged', () => {
  const replaced = upsertChangeRequest(REQUESTS, { id: 'r-1', customerId: 'c-1', type: 'other', status: 'in_progress', dateRequested: '2026-11-03' });
  assert.equal(replaced.length, REQUESTS.length);
  assert.equal(findChangeRequest(replaced, 'r-1').type, 'other');
  const refused = upsertChangeRequest(REQUESTS, { id: 'r-9', customerId: 'c-1', type: 'teleport' });
  assert.equal(refused.length, REQUESTS.length);
  assert.equal(findChangeRequest(refused, 'r-9'), null);
  assert.equal(removeChangeRequest(REQUESTS, 'r-2').length, REQUESTS.length - 1);
  assert.equal(findChangeRequest(REQUESTS, 'r-2').id, 'r-2');
});

test('status machine: forward moves apply, terminal states refuse', () => {
  const started = setChangeRequestStatus(REQUESTS, 'r-1', 'in_progress');
  assert.equal(started.applied, true);
  assert.equal(started.refusal, null);
  assert.equal(findChangeRequest(started.requests, 'r-1').status, 'in_progress');
  const done = setChangeRequestStatus(REQUESTS, 'r-1', 'done', { fulfilledBy: 'profile Edit form, 2026-11-05' });
  assert.equal(done.applied, true);
  assert.equal(findChangeRequest(done.requests, 'r-1').fulfilledBy, 'profile Edit form, 2026-11-05');
  const back = setChangeRequestStatus(REQUESTS, 'r-4', 'pending');
  assert.equal(back.applied, false);
  assert.equal(back.refusal, 'illegal-transition');
  assert.equal(findChangeRequest(back.requests, 'r-4').status, 'done');
  const reopenDeclined = setChangeRequestStatus(REQUESTS, 'r-5', 'in_progress');
  assert.equal(reopenDeclined.applied, false);
  assert.equal(reopenDeclined.refusal, 'illegal-transition');
  const same = setChangeRequestStatus(REQUESTS, 'r-1', 'pending');
  assert.equal(same.applied, false);
  assert.equal(same.refusal, 'same-status');
  const missing = setChangeRequestStatus(REQUESTS, 'r-99', 'done');
  assert.equal(missing.refusal, 'not-found');
  const bad = setChangeRequestStatus(REQUESTS, 'r-1', 'waiting');
  assert.equal(bad.refusal, 'invalid-status');
});

test('declining requires a reason, and the reason is recorded', () => {
  const refused = setChangeRequestStatus(REQUESTS, 'r-1', 'declined');
  assert.equal(refused.applied, false);
  assert.equal(refused.refusal, 'decline-needs-reason');
  assert.equal(findChangeRequest(refused.requests, 'r-1').status, 'pending');
  const declined = setChangeRequestStatus(REQUESTS, 'r-1', 'declined', { declineReason: 'Customer withdrew the ask' });
  assert.equal(declined.applied, true);
  assert.equal(findChangeRequest(declined.requests, 'r-1').declineReason, 'Customer withdrew the ask');
});

test('queue: open only, oldest date first, undated last', () => {
  const queue = changeRequestQueue(REQUESTS, { customers: CUSTOMERS });
  assert.deepEqual(queue.map((r) => r.id), ['r-2', 'r-1', 'r-3']);
  const sorted = sortChangeRequests(REQUESTS);
  assert.deepEqual(sorted.map((r) => r.id), ['r-4', 'r-5', 'r-2', 'r-1', 'r-3']);
});

test('filter by type and mohalla, case-insensitive, unassigned never dropped', () => {
  assert.deepEqual(filterChangeRequests(REQUESTS, { type: 'package_change' }).map((r) => r.id), ['r-1', 'r-5']);
  assert.deepEqual(filterChangeRequests(REQUESTS, { mohalla: 'bani', customers: CUSTOMERS }).map((r) => r.id), ['r-1', 'r-3']);
  assert.deepEqual(filterChangeRequests(REQUESTS, { mohalla: 'Mohalla Kishti', customers: CUSTOMERS }).map((r) => r.id), ['r-2', 'r-5']);
  assert.deepEqual(filterChangeRequests(REQUESTS, { mohalla: '__unassigned__', customers: CUSTOMERS }).map((r) => r.id), ['r-4']);
  assert.deepEqual(changeRequestQueue(REQUESTS, { type: 'relocation', customers: CUSTOMERS }).map((r) => r.id), ['r-2']);
  assert.equal(changeRequestMohallaOf({ customerId: 'c-9' }, CUSTOMERS), '');
});

test('record holds no bill, payment, or package field; inputs never mutated', () => {
  const before = JSON.stringify(REQUESTS);
  const row = normalizeChangeRequest(REQUESTS[0]);
  assert.deepEqual(Object.keys(row).sort(), ['customerId', 'customerName', 'dateRequested', 'declineReason', 'detail', 'fulfilledBy', 'handler', 'id', 'status', 'type']);
  sortChangeRequests(REQUESTS);
  filterChangeRequests(REQUESTS, { type: 'other' });
  setChangeRequestStatus(REQUESTS, 'r-1', 'done');
  assert.equal(JSON.stringify(REQUESTS), before);
  assert.equal(normalizeChangeRequestList(null).length, 0);
});

test('summary counts match the fixture', () => {
  assert.equal(
    changeRequestSummaryText(REQUESTS, CUSTOMERS),
    '5 requests recorded; 3 waiting (2 pending, 1 in progress), 1 done, 1 declined.',
  );
});

test('summary text, HTML escaping, CSV quoting, filename', () => {
  const evil = [{ id: 'r-e', customerId: 'c-1', customerName: '<Ahmed>', type: 'other', detail: 'a "quoted", note', dateRequested: '2026-11-04', status: 'pending', handler: '' }];
  const html = changeRequestsHtml(evil, { customers: CUSTOMERS });
  assert.ok(html.includes('&lt;Ahmed&gt;'));
  assert.ok(!html.includes('<Ahmed>'));
  const csv = changeRequestsCsv(evil, { customers: CUSTOMERS });
  assert.ok(csv.startsWith('id,customer_id,customer_name,mohalla,type,date_requested,status,handler,detail,fulfilled_by,decline_reason'));
  assert.ok(csv.includes('"a ""quoted"", note"'));
  assert.ok(changeRequestsHtml([]).includes('No change requests recorded yet.'));
  assert.equal(changeRequestFilename('2026-11-04'), 'change-requests-2026-11-04.csv');
  assert.equal(changeRequestFilename('2026-02-30'), 'change-requests-requests.csv');
});
