import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizePromise,
  normalizePromiseList,
  findPromise,
  upsertPromise,
  removePromise,
  markPromiseDone,
  markPromiseWithdrawn,
  openPromises,
  overduePromises,
  donePromises,
  withdrawnPromises,
  promisesForCustomer,
  promiseCustomers,
  promiseText,
  promiseSummaryText,
  promiseHtml,
  promiseAllHtml,
  promiseOpenHtml,
  promiseCsv,
  promiseFilename,
} from '../promise-tracker.js';

const dir = dirname(fileURLToPath(import.meta.url));

const commitment = (over = {}) => ({
  id: 'PR-1',
  customerId: 'Cust A',
  promise: 'Call back about the package question',
  dueDate: '2026-11-07',
  status: 'open',
  completionDate: '',
  ...over,
});

test('half-formed commitments are refused outright', () => {
  assert.equal(normalizePromise(null), null);
  assert.equal(normalizePromise({}), null);
  assert.equal(normalizePromise(commitment({ id: '' })), null);
  assert.equal(normalizePromise(commitment({ customerId: '   ' })), null);
  assert.equal(normalizePromise(commitment({ promise: '' })), null);
  assert.equal(normalizePromise(commitment({ dueDate: '' })), null);
  assert.equal(normalizePromise(commitment({ dueDate: '2026-13-01' })), null);
  assert.equal(normalizePromise(commitment({ dueDate: '07-11-2026' })), null);
  assert.equal(normalizePromise(commitment({ completionDate: '2026-02-30' })), null);
});

test('strict dates: 31-day months pass, February rules hold', () => {
  assert.ok(normalizePromise(commitment({ dueDate: '2026-08-31' })));
  assert.ok(normalizePromise(commitment({ dueDate: '2026-10-31' })));
  assert.ok(normalizePromise(commitment({ dueDate: '2026-12-31' })));
  assert.equal(normalizePromise(commitment({ dueDate: '2026-11-31' })), null);
  assert.equal(normalizePromise(commitment({ dueDate: '2026-02-29' })), null);
  assert.ok(normalizePromise(commitment({ dueDate: '2024-02-29' })));
  assert.equal(normalizePromise(commitment({ dueDate: '2026-02-30' })), null);
});

test('unknown fields are dropped, never stored', () => {
  const record = normalizePromise(commitment({
    waadaId: 'W-9', billId: 'B-9', paymentId: 'P-9', sendNow: true, statusNote: 'x',
  }));
  assert.deepEqual(Object.keys(record).sort(), ['completionDate', 'customerId', 'dueDate', 'id', 'promise', 'status']);
});

test('duplicate ids are never rewritten', () => {
  const base = upsertPromise([], commitment());
  assert.equal(upsertPromise(base, commitment()).length, 1);
  const changed = upsertPromise(base, commitment({ promise: 'Visit next week' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].promise, 'Call back about the package question');
});

test('find and remove work by id', () => {
  const base = upsertPromise(upsertPromise([], commitment()), commitment({ id: 'PR-2', customerId: 'Cust B' }));
  assert.equal(findPromise(base, 'PR-2').customerId, 'Cust B');
  assert.equal(findPromise(base, 'PR-9'), null);
  const removed = removePromise(base, 'PR-1');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, 'PR-2');
});

test('marking done records only the completion date, only from open', () => {
  const base = upsertPromise([], commitment());
  const done = markPromiseDone(base, 'PR-1', '2026-11-06');
  assert.equal(done[0].status, 'done');
  assert.equal(done[0].completionDate, '2026-11-06');
  assert.equal(done[0].promise, 'Call back about the package question');
  assert.equal(done[0].dueDate, '2026-11-07');
  // Bad completion date leaves the record unchanged.
  assert.equal(markPromiseDone(base, 'PR-1', '2026-11-31')[0].status, 'open');
  // A done record cannot be re-marked.
  assert.equal(markPromiseDone(done, 'PR-1', '2026-11-08')[0].completionDate, '2026-11-06');
});

test('withdrawing leaves the open list, only from open', () => {
  const base = upsertPromise([], commitment());
  const withdrawn = markPromiseWithdrawn(base, 'PR-1');
  assert.equal(withdrawn[0].status, 'withdrawn');
  assert.equal(openPromises(withdrawn).length, 0);
  // A withdrawn record cannot be re-withdrawn into a different state.
  assert.equal(markPromiseWithdrawn(withdrawn, 'PR-1')[0].status, 'withdrawn');
  // Withdrawing a done record leaves it done.
  const done = markPromiseDone(base, 'PR-1', '2026-11-06');
  assert.equal(markPromiseWithdrawn(done, 'PR-1')[0].status, 'done');
});

test('open commitments list soonest-due first', () => {
  const base = upsertPromise(
    upsertPromise(upsertPromise([], commitment({ id: 'PR-3', dueDate: '2026-11-20' })),
      commitment({ id: 'PR-1', dueDate: '2026-11-07' })),
    commitment({ id: 'PR-2', dueDate: '2026-11-07', customerId: 'Cust A' }));
  const open = openPromises(base);
  assert.deepEqual(open.map((item) => item.id), ['PR-1', 'PR-2', 'PR-3']);
});

test('overdue means due strictly before today, and stays visible', () => {
  const base = upsertPromise(
    upsertPromise(upsertPromise([], commitment({ id: 'PR-1', dueDate: '2026-11-06' })),
      commitment({ id: 'PR-2', dueDate: '2026-11-07' })),
    commitment({ id: 'PR-3', dueDate: '2026-11-05' }));
  assert.deepEqual(overduePromises(base, '2026-11-07').map((item) => item.id), ['PR-3', 'PR-1']);
  assert.deepEqual(overduePromises(base, 'not-a-date'), []);
  // Done and withdrawn records never appear as overdue.
  const settled = markPromiseWithdrawn(markPromiseDone(base, 'PR-1', '2026-11-06'), 'PR-3');
  assert.deepEqual(overduePromises(settled, '2026-11-07'), []);
});

test('done and withdrawn lists hold only their own state', () => {
  const base = upsertPromise(
    upsertPromise(upsertPromise([], commitment({ id: 'PR-1' })),
      commitment({ id: 'PR-2', customerId: 'Cust B' })),
    commitment({ id: 'PR-3', customerId: 'Cust C' }));
  const settled = markPromiseWithdrawn(markPromiseDone(base, 'PR-1', '2026-11-06'), 'PR-2');
  assert.deepEqual(donePromises(settled).map((item) => item.id), ['PR-1']);
  assert.deepEqual(withdrawnPromises(settled).map((item) => item.id), ['PR-2']);
  assert.deepEqual(openPromises(settled).map((item) => item.id), ['PR-3']);
});

test('customers list keeps first spelling, A-Z; per-customer view is case-insensitive', () => {
  const base = upsertPromise(
    upsertPromise(upsertPromise([], commitment({ customerId: 'cust b' })),
      commitment({ id: 'PR-2', customerId: 'Cust A' })),
    commitment({ id: 'PR-3', customerId: 'CUST B' }));
  assert.deepEqual(promiseCustomers(base), ['Cust A', 'cust b']);
  assert.equal(promisesForCustomer(base, 'CUST B').length, 2);
  assert.equal(promisesForCustomer(base, 'nobody').length, 0);
});

test('promise text and summary state the record plainly', () => {
  assert.equal(
    promiseText(commitment()),
    'Promise to Cust A: Call back about the package question — promised by 2026-11-07. Still open.',
  );
  assert.equal(
    promiseText(commitment({ status: 'done', completionDate: '2026-11-06' })),
    'Promise to Cust A: Call back about the package question — promised by 2026-11-07. Done on 2026-11-06.',
  );
  const base = upsertPromise(upsertPromise([], commitment()), commitment({ id: 'PR-2', customerId: 'Cust B' }));
  const settled = markPromiseDone(base, 'PR-1', '2026-11-06');
  assert.equal(promiseSummaryText(settled), '2 commitments: 1 open, 1 done, 0 withdrawn.');
  assert.equal(promiseText(null), '');
});

test('HTML escapes operator text', () => {
  const html = promiseHtml(commitment({ promise: '<script>alert(1)</script>' }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(promiseAllHtml([]), '<p>No commitments recorded.</p>');
  assert.equal(promiseOpenHtml([]), '<p>No open commitments.</p>');
});

test('CSV export and filename', () => {
  const base = upsertPromise([], commitment());
  const csv = promiseCsv(base);
  assert.ok(csv.startsWith('id,customerId,promise,dueDate,status,completionDate\n'));
  assert.ok(csv.includes('PR-1,Cust A,Call back about the package question,2026-11-07,open,'));
  assert.equal(promiseFilename(), 'promise-tracker.csv');
});

test('inputs are never mutated', () => {
  const input = commitment();
  const snapshot = JSON.stringify(input);
  upsertPromise([], input);
  markPromiseDone([input], 'PR-1', '2026-11-06');
  markPromiseWithdrawn([input], 'PR-1');
  assert.equal(JSON.stringify(input), snapshot);
});

test('purity fence: module has no imports, storage, clock, or network use', () => {
  const source = readFileSync(join(dir, '..', 'promise-tracker.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('waada'));
});

test('panel wiring: all panel element ids exist in index.html, no standalone OLT in app.js', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = ['ptCustomer', 'ptPromise', 'ptDueDate', 'ptSaveBtn', 'ptDoneId', 'ptDoneDate', 'ptDoneBtn',
    'ptWithdrawId', 'ptWithdrawBtn', 'ptRemoveId', 'ptRemoveBtn', 'ptExportBtn', 'ptFilter',
    'ptSummary', 'ptBody', 'ptHeading', 'ptOverdueBody'];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(app));
});
