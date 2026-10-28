// New Customer Installation Tracker: delay math, reasons, month summary,
// validation, and backup safe-merge. Pure-function tests on synthetic
// data only. Pins the owner's exact examples: 2+1+5 = 8 total delay days,
// and 15 customers x 2 days = 30 total delay days. No SLA, no grace days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  INSTALL_REQUESTS_KEY,
  REASON_NOT_RECORDED,
  addInstallRequest,
  buildMonthlyInstallSummary,
  daysSoFar,
  delayDays,
  delayReasonLabel,
  filterInstallRequests,
  loadInstallRequests,
  markInstallRequestInstalled,
  monthOf,
  requestsForMonth,
  resolveDelayReason,
  sanitizeInstallRequests,
  saveInstallRequests,
  sortedRequestLog
} from '../install-tracker.js';

const CUSTOMERS = [
  { id: 'c1', name: 'Master Zaheer', customerNumber: 1, mohalla: 'Barrian' },
  { id: 'c2', name: 'Faisal', customerNumber: 2, mohalla: 'Barrian' }
];

function request(overrides = {}) {
  return {
    requesterName: 'Master Zaheer',
    requestDate: '2026-10-01',
    amountPaid: '10000',
    payMethod: 'easypaisa',
    payReference: 'TID123',
    ...overrides
  };
}

function installed(overrides = {}) {
  const { installDate, delayReason, ...rest } = overrides;
  let out = addInstallRequest([], request(rest), { customers: CUSTOMERS });
  if (installDate !== undefined) {
    out = markInstallRequestInstalled(out, out[0].id, { installDate, delayReason });
  }
  return out;
}

test('delay math, owner example 1: installs of 2 + 1 + 5 days = total 8', () => {
  let requests = [];
  requests = addInstallRequest(requests, request({ requesterName: 'A', requestDate: '2026-10-01', installDate: '2026-10-03' }), { customers: CUSTOMERS });
  requests = addInstallRequest(requests, request({ requesterName: 'B', requestDate: '2026-10-01', installDate: '2026-10-02' }), { customers: CUSTOMERS });
  requests = addInstallRequest(requests, request({ requesterName: 'C', requestDate: '2026-10-01', installDate: '2026-10-06' }), { customers: CUSTOMERS });
  const summary = buildMonthlyInstallSummary(requests, '2026-10', '2026-10-31');
  assert.deepEqual(summary.installed.map((r) => r.days), [2, 1, 5]);
  assert.equal(summary.totalDelayDays, 8);
  assert.equal(summary.installedCount, 3);
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.pendingCount, 0);
});

test('delay math, owner example 2: 15 customers x 2 days = total 30', () => {
  let requests = [];
  for (let i = 0; i < 15; i++) {
    requests = addInstallRequest(requests, request({ requesterName: `Customer ${i + 1}`, requestDate: '2026-10-01', installDate: '2026-10-03' }), { customers: CUSTOMERS });
  }
  const summary = buildMonthlyInstallSummary(requests, '2026-10', '2026-10-31');
  assert.equal(summary.totalDelayDays, 30);
  assert.equal(summary.installedCount, 15);
  assert.equal(summary.averageDays, 2);
});

test('same-day install = 0 delay days, not negative, not 1', () => {
  const requests = installed({ installDate: '2026-10-01' });
  assert.equal(delayDays(requests[0]), 0);
  const summary = buildMonthlyInstallSummary(requests, '2026-10', '2026-10-31');
  assert.equal(summary.totalDelayDays, 0);
  assert.equal(summary.installed[0].delayed, false);
});

test('pending excluded from total but shown with days-so-far', () => {
  let requests = installed({ installDate: '2026-10-03' }); // 2 days
  requests = addInstallRequest(requests, request({ requesterName: 'Waiting', requestDate: '2026-10-10' }), { customers: CUSTOMERS });
  const summary = buildMonthlyInstallSummary(requests, '2026-10', '2026-10-20');
  assert.equal(summary.totalDelayDays, 2); // pending 10 days-so-far NOT added
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.pending[0].daysSoFar, 10);
  assert.equal(delayDays(requests[1]), null);
  assert.equal(daysSoFar(requests[1], '2026-10-20'), 10);
  assert.equal(daysSoFar(requests[0], '2026-10-20'), null); // installed: no days-so-far
});

test('delay reason preserved, shown for delayed installs, fallback when missing', () => {
  const withReason = installed({ installDate: '2026-10-04', delayReason: 'Fiber/ONU late — Nasir' });
  assert.equal(delayReasonLabel(withReason[0]), 'Fiber/ONU late — Nasir');
  const summary = buildMonthlyInstallSummary(withReason, '2026-10', '2026-10-31');
  assert.equal(summary.installed[0].reason, 'Fiber/ONU late — Nasir');
  const withoutReason = installed({ installDate: '2026-10-04' });
  assert.equal(delayReasonLabel(withoutReason[0]), REASON_NOT_RECORDED);
  const summary2 = buildMonthlyInstallSummary(withoutReason, '2026-10', '2026-10-31');
  assert.equal(summary2.installed[0].reason, REASON_NOT_RECORDED);
});

test('reason presets: custom text wins, Other preset alone stores nothing', () => {
  assert.equal(resolveDelayReason('Saad did not come', ''), 'Saad did not come');
  assert.equal(resolveDelayReason('Saad did not come', '  Nasir late fiber  '), 'Nasir late fiber');
  assert.equal(resolveDelayReason('Other', ''), '');
  assert.equal(resolveDelayReason('', ''), '');
});

test('month grouping by REQUEST month: October request installed in November stays in October', () => {
  const requests = installed({ requestDate: '2026-10-28', installDate: '2026-11-02' });
  assert.equal(buildMonthlyInstallSummary(requests, '2026-10', '2026-11-30').installedCount, 1);
  assert.equal(buildMonthlyInstallSummary(requests, '2026-11', '2026-11-30').installedCount, 0);
  assert.equal(buildMonthlyInstallSummary(requests, '2026-11', '2026-11-30').requestCount, 0);
  assert.equal(requestsForMonth(requests, '2026-10').length, 1);
  assert.equal(filterInstallRequests(requests, { month: '2026-11' }).length, 0);
});

test('empty month = all zeros, never blank or a crash', () => {
  const summary = buildMonthlyInstallSummary([], '2026-10', '2026-10-31');
  assert.deepEqual(
    [summary.requestCount, summary.installedCount, summary.pendingCount, summary.totalDelayDays, summary.averageDays],
    [0, 0, 0, 0, 0]
  );
  assert.deepEqual(summary.installed, []);
  assert.deepEqual(summary.pending, []);
});

test('validation: missing name, bad date, negative amount, unknown method, unknown customer, install before request', () => {
  assert.throws(() => addInstallRequest([], request({ requesterName: '  ' }), { customers: CUSTOMERS }), /Requester name is required/);
  assert.throws(() => addInstallRequest([], request({ requestDate: 'not-a-date' }), { customers: CUSTOMERS }), /valid request date/);
  assert.throws(() => addInstallRequest([], request({ amountPaid: '' }), { customers: CUSTOMERS }), /Amount paid/);
  assert.throws(() => addInstallRequest([], request({ amountPaid: '-5' }), { customers: CUSTOMERS }), /0 or more/);
  assert.throws(() => addInstallRequest([], request({ payMethod: 'crypto' }), { customers: CUSTOMERS }), /valid payment method/);
  assert.throws(() => addInstallRequest([], request({ customerId: 'nope' }), { customers: CUSTOMERS }), /from the list/);
  assert.throws(() => addInstallRequest([], request({ installDate: '2026-09-30' }), { customers: CUSTOMERS }), /before the request date/);
  // Zero paid is allowed (request with no advance yet).
  const zero = addInstallRequest([], request({ amountPaid: '0' }), { customers: CUSTOMERS });
  assert.equal(zero[0].amountPaid, 0);
  // Linked customer snapshots name/number without mutating the customer.
  const linked = addInstallRequest([], request({ customerId: 'c1' }), { customers: CUSTOMERS });
  assert.equal(linked[0].customerName, 'Master Zaheer');
  assert.equal(linked[0].customerNumber, 1);
  assert.equal(CUSTOMERS[0].name, 'Master Zaheer');
});

test('mark installed: happy path, reason replace/keep, and all rejections', () => {
  let requests = addInstallRequest([], request(), { customers: CUSTOMERS });
  assert.throws(() => markInstallRequestInstalled(requests, 'IR-999', { installDate: '2026-10-03' }), /not found/);
  assert.throws(() => markInstallRequestInstalled(requests, requests[0].id, { installDate: 'bad' }), /valid install date/);
  assert.throws(() => markInstallRequestInstalled(requests, requests[0].id, { installDate: '2026-09-01' }), /before the request date/);
  requests = markInstallRequestInstalled(requests, requests[0].id, { installDate: '2026-10-03', delayReason: 'Saad did not come' });
  assert.equal(requests[0].installDate, '2026-10-03');
  assert.equal(delayDays(requests[0]), 2);
  assert.equal(requests[0].delayReason, 'Saad did not come');
  assert.throws(() => markInstallRequestInstalled(requests, requests[0].id, { installDate: '2026-10-04' }), /already marked installed/);
});

test('sanitize: bad rows dropped, bad install date falls back to pending, unknown method becomes Other', () => {
  const cleaned = sanitizeInstallRequests([
    { requesterName: 'Good', requestDate: '2026-10-01', amountPaid: 5000, payMethod: 'cash' },
    { requesterName: '', requestDate: '2026-10-01', amountPaid: 5000, payMethod: 'cash' },
    { requesterName: 'NoDate', requestDate: 'junk', amountPaid: 5000, payMethod: 'cash' },
    { requesterName: 'BadAmount', requestDate: '2026-10-01', amountPaid: -1, payMethod: 'cash' },
    { requesterName: 'BadInstall', requestDate: '2026-10-05', amountPaid: 5000, payMethod: 'cash', installDate: '2026-10-02' },
    { requesterName: 'WeirdMethod', requestDate: '2026-10-01', amountPaid: 5000, payMethod: 'crypto' }
  ]);
  assert.equal(cleaned.length, 3);
  assert.equal(cleaned.find((r) => r.requesterName === 'BadInstall').installDate, '');
  assert.equal(cleaned.find((r) => r.requesterName === 'WeirdMethod').payMethod, 'other');
});

test('log order newest first; days-so-far clamps future requests to 0', () => {
  let requests = addInstallRequest([], request({ requestDate: '2026-10-01' }), { customers: CUSTOMERS });
  requests = addInstallRequest(requests, request({ requesterName: 'Later', requestDate: '2026-10-09' }), { customers: CUSTOMERS });
  const log = sortedRequestLog(requests);
  assert.equal(log[0].requestDate, '2026-10-09');
  assert.equal(log[1].requestDate, '2026-10-01');
  assert.equal(monthOf('2026-10-09'), '2026-10');
  assert.equal(daysSoFar({ requestDate: '2026-12-01', installDate: '' }, '2026-10-20'), 0);
});

test('storage round-trip under the tracker key', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const requests = installed({ installDate: '2026-10-03', delayReason: 'Fiber/ONU late — Nasir' });
  assert.equal(saveInstallRequests(requests, storage), true);
  assert.equal(store.has(INSTALL_REQUESTS_KEY), true);
  const loaded = loadInstallRequests(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].requesterName, 'Master Zaheer');
  assert.equal(delayDays(loaded[0]), 2);
  assert.deepEqual(loadInstallRequests({ getItem: () => 'not json' }), []);
});

test('backup: requests travel in settings and restore under safe-merge rules', () => {
  const requests = installed({ installDate: '2026-10-03', delayReason: 'Fiber/ONU late — Nasir' });
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { installRequests: requests });
  const backup = JSON.parse(backupText);
  assert.equal(backup.settings.installRequests.length, 1);
  assert.equal(backup.settings.installRequests[0].delayReason, 'Fiber/ONU late — Nasir');
  // Fresh device adopts the section.
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.canApply, true);
  assert.equal(preview.installRequests.length, 1);
  assert.equal(preview.counts.installRequestsRestored, 1);
  // Device that already holds DIFFERENT requests keeps its own + conflict.
  const other = addInstallRequest([], request({ requesterName: 'Other device request', requestDate: '2026-10-07' }), { customers: CUSTOMERS });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentInstallRequests: other, currentInstallRequestsStored: true });
  assert.equal(clash.installRequests, null);
  assert.ok(clash.conflicts.some((c) => /Installation request records differ/.test(c.field)));
});
