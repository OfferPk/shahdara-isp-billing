// Saad visit log: per-visit job record + month-end summary with payments.
// Pure-function tests on synthetic data only. Covers the owner's additions:
// hours per visit (times or hours number), computed monthly days + hours,
// and manual salary/commission payment records.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  SAAD_PAYMENTS_KEY,
  SAAD_VISITS_KEY,
  addSaadPayment,
  addSaadVisit,
  buildMonthlySaadSummary,
  deleteSaadPayment,
  deleteSaadVisit,
  filterSaadVisits,
  formatHours,
  hoursFromTimes,
  loadSaadPayments,
  loadSaadVisits,
  monthOf,
  sanitizeSaadPayments,
  sanitizeSaadVisits,
  saveSaadPayments,
  saveSaadVisits,
  sortedVisitLog,
  updateSaadPayment,
  updateSaadVisit,
  visitHours,
  visitWhereLabel,
  visitsForMonth
} from '../saad-visits.js';

const CUSTOMERS = [
  { id: 'c-1', customerNumber: 1, name: 'RAJA FAISAL', mohalla: 'Barrian', zone: '' },
  { id: 'c-2', customerNumber: 2, name: 'AW AIS', mohalla: 'Shahdara Khurd', zone: 'Side 1' }
];

const visit = (overrides = {}) => ({
  date: '2026-10-05',
  type: 'splicing',
  customerId: 'c-1',
  area: '',
  fiberMeters: '',
  startTime: '09:00',
  endTime: '12:30',
  hoursWorked: '',
  ticketId: '',
  note: '',
  ...overrides
});

function fakeStore(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    _read: () => value
  };
}

test('storage keys are in the sisp family', () => {
  assert.equal(SAAD_VISITS_KEY, 'sisp_saad_visits_v1');
  assert.equal(SAAD_PAYMENTS_KEY, 'sisp_saad_payments_v1');
});

test('hours from times: 09:00-12:30 is 3.5 hours; bad pairs give null', () => {
  assert.equal(hoursFromTimes('09:00', '12:30'), 3.5);
  assert.equal(hoursFromTimes('09:00', '09:00'), null);
  assert.equal(hoursFromTimes('12:30', '09:00'), null);
  assert.equal(hoursFromTimes('9:00', '12:30'), null);
  assert.equal(formatHours(7), '7');
  assert.equal(formatHours(3.5), '3.5');
});

test('add visit happy path: customer picked, area defaults from mohalla, hours from times', () => {
  const [v] = addSaadVisit([], visit(), { customers: CUSTOMERS, ticketIds: [] });
  assert.equal(v.id, 'SV-1');
  assert.equal(v.customerName, 'RAJA FAISAL');
  assert.equal(v.customerNumber, 1);
  assert.equal(v.area, 'Barrian');
  assert.equal(v.hoursWorked, 3.5);
  assert.equal(v.fiberMeters, null);
});

test('add visit: hours number used when no times given', () => {
  const [v] = addSaadVisit([], visit({ startTime: '', endTime: '', hoursWorked: '4' }), { customers: CUSTOMERS });
  assert.equal(v.hoursWorked, 4);
  assert.equal(v.startTime, '');
});

test('add visit: times win over an entered hours number when both given', () => {
  const [v] = addSaadVisit([], visit({ hoursWorked: '9' }), { customers: CUSTOMERS });
  assert.equal(v.hoursWorked, 3.5);
});

test('add visit rejects: missing hours, lone time, end before start', () => {
  assert.throws(() => addSaadVisit([], visit({ startTime: '', endTime: '', hoursWorked: '' }), { customers: CUSTOMERS }), /how long/);
  assert.throws(() => addSaadVisit([], visit({ endTime: '' }), { customers: CUSTOMERS }), /both start and end/);
  assert.throws(() => addSaadVisit([], visit({ startTime: '12:00', endTime: '09:00' }), { customers: CUSTOMERS }), /after start/);
  assert.throws(() => addSaadVisit([], visit({ startTime: '', endTime: '', hoursWorked: '0' }), { customers: CUSTOMERS }), /positive/);
});

test('add visit rejects: bad date, bad type, unknown customer, unknown ticket', () => {
  assert.throws(() => addSaadVisit([], visit({ date: '05-10-2026' }), { customers: CUSTOMERS }), /valid visit date/);
  assert.throws(() => addSaadVisit([], visit({ type: 'flying' }), { customers: CUSTOMERS }), /work type/);
  assert.throws(() => addSaadVisit([], visit({ customerId: 'nope' }), { customers: CUSTOMERS }), /from the list/);
  assert.throws(() => addSaadVisit([], visit({ ticketId: 'TKT-999' }), { customers: CUSTOMERS, ticketIds: ['TKT-101'] }), /does not exist/);
});

test('add visit accepts a real ticket id', () => {
  const [v] = addSaadVisit([], visit({ ticketId: 'TKT-101' }), { customers: CUSTOMERS, ticketIds: ['TKT-101'] });
  assert.equal(v.ticketId, 'TKT-101');
});

test('add visit: area-level work with no customer is allowed; neither customer nor area is rejected', () => {
  const [v] = addSaadVisit([], visit({ customerId: '', area: 'Barrian main fiber' }), { customers: CUSTOMERS });
  assert.equal(v.customerId, '');
  assert.equal(v.area, 'Barrian main fiber');
  assert.equal(visitWhereLabel(v), 'Barrian main fiber');
  assert.throws(() => addSaadVisit([], visit({ customerId: '', area: '' }), { customers: CUSTOMERS }), /where Saad worked/);
});

test('add visit: explicit area override beats the customer mohalla default', () => {
  const [v] = addSaadVisit([], visit({ area: 'Near Jamia Masjid' }), { customers: CUSTOMERS });
  assert.equal(v.area, 'Near Jamia Masjid');
});

test('add visit: fiber meters recorded only (positive decimals ok, negatives rejected)', () => {
  const [v] = addSaadVisit([], visit({ fiberMeters: '150.5' }), { customers: CUSTOMERS });
  assert.equal(v.fiberMeters, 150.5);
  assert.throws(() => addSaadVisit([], visit({ fiberMeters: '-5' }), { customers: CUSTOMERS }), /positive/);
});

test('add visit: ids sequence and input list is untouched', () => {
  const before = [];
  const after = addSaadVisit(before, visit(), { customers: CUSTOMERS });
  const after2 = addSaadVisit(after, visit({ date: '2026-10-06' }), { customers: CUSTOMERS });
  assert.equal(before.length, 0);
  assert.equal(after[0].id, 'SV-1');
  assert.equal(after2[1].id, 'SV-2');
});

test('sanitize drops malformed visits and keeps clean ones', () => {
  const clean = sanitizeSaadVisits([
    { id: 'SV-1', date: '2026-10-05', type: 'splicing', customerId: 'c-1', area: 'Barrian', hoursWorked: 3.5 },
    { date: 'not-a-date', type: 'splicing' },
    { date: '2026-10-05', type: 'teleport' },
    null,
    'junk'
  ]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'SV-1');
});

test('visitHours falls back to times when stored hours are missing', () => {
  assert.equal(visitHours({ hoursWorked: null, startTime: '10:00', endTime: '12:00' }), 2);
  assert.equal(visitHours({ hoursWorked: null, startTime: '', endTime: '' }), 0);
});

test('storage round-trip for visits and payments with a fake store', () => {
  const store = fakeStore();
  saveSaadVisits(addSaadVisit([], visit(), { customers: CUSTOMERS }), store);
  assert.equal(loadSaadVisits(store).length, 1);
  assert.equal(loadSaadVisits(fakeStore('not json')).length, 0);
  saveSaadPayments(addSaadPayment([], { date: '2026-10-31', amount: '15000', type: 'salary' }), store);
  assert.equal(loadSaadPayments(store).length, 1);
});

test('add payment: happy path, and rejects bad date / amount / type', () => {
  const [p] = addSaadPayment([], { date: '2026-10-31', amount: '15000', type: 'salary', note: 'October salary' });
  assert.equal(p.id, 'SP-1');
  assert.equal(p.amount, 15000);
  assert.throws(() => addSaadPayment([], { date: '2026-10-31', amount: '0', type: 'salary' }), /positive/);
  assert.throws(() => addSaadPayment([], { date: '2026-10-31', amount: '100', type: 'bonus' }), /Salary or Commission/);
  assert.throws(() => addSaadPayment([], { date: '31-10-2026', amount: '100', type: 'salary' }), /valid payment date/);
});

test('sanitize payments drops bad rows', () => {
  const clean = sanitizeSaadPayments([
    { id: 'SP-1', date: '2026-10-31', type: 'salary', amount: 15000 },
    { date: '2026-10-31', type: 'salary', amount: -5 },
    { date: '2026-10-31', type: 'gift', amount: 100 }
  ]);
  assert.equal(clean.length, 1);
});

test('monthly summary: same-day two visits count as ONE day but sum BOTH hours', () => {
  let visits = addSaadVisit([], visit({ date: '2026-10-05', type: 'splicing', startTime: '09:00', endTime: '11:00' }), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-05', type: 'fiber-fix', startTime: '13:00', endTime: '14:30' }), { customers: CUSTOMERS });
  const s = buildMonthlySaadSummary(visits, [], '2026-10');
  assert.equal(s.dayCount, 1);
  assert.deepEqual(s.daysPresent, ['2026-10-05']);
  assert.equal(s.totalHours, 3.5);
  assert.equal(s.perDay.length, 1);
  assert.equal(s.perDay[0].hours, 3.5);
  assert.deepEqual(s.perDay[0].places, ['RAJA FAISAL (#1)']);
  assert.equal(s.splicingCount, 1);
  assert.equal(s.fiberFixCount, 1);
});

test('monthly summary: 2 visits on 2 days + salary + commission payment totals', () => {
  let visits = addSaadVisit([], visit({ date: '2026-10-05', startTime: '09:00', endTime: '12:00' }), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-06', type: 'install', customerId: 'c-2', startTime: '10:00', endTime: '14:00' }), { customers: CUSTOMERS });
  let payments = addSaadPayment([], { date: '2026-10-31', amount: '15000', type: 'salary' });
  payments = addSaadPayment(payments, { date: '2026-10-31', amount: '2400', type: 'commission' });
  const s = buildMonthlySaadSummary(visits, payments, '2026-10');
  assert.equal(s.dayCount, 2);
  assert.deepEqual(s.daysPresent, ['2026-10-05', '2026-10-06']);
  assert.equal(s.totalHours, 7);
  assert.equal(s.installCount, 1);
  assert.equal(s.salaryTotal, 15000);
  assert.equal(s.commissionTotal, 2400);
  assert.equal(s.grandTotal, 17400);
  assert.equal(s.payments.length, 2);
});

test('monthly summary: visits but no payment shows payment 0, not blank or crash', () => {
  const visits = addSaadVisit([], visit(), { customers: CUSTOMERS });
  const s = buildMonthlySaadSummary(visits, [], '2026-10');
  assert.equal(s.salaryTotal, 0);
  assert.equal(s.commissionTotal, 0);
  assert.equal(s.grandTotal, 0);
  assert.equal(s.payments.length, 0);
});

test('monthly summary: zero-visit month shows 0 days / 0 hours', () => {
  const s = buildMonthlySaadSummary([], [], '2026-11');
  assert.equal(s.dayCount, 0);
  assert.equal(s.totalHours, 0);
  assert.deepEqual(s.daysPresent, []);
  assert.deepEqual(s.perDay, []);
});

test('monthly summary: payment dated in month X never appears in month Y', () => {
  const payments = addSaadPayment([], { date: '2026-09-30', amount: '15000', type: 'salary' });
  const oct = buildMonthlySaadSummary([], payments, '2026-10');
  const sep = buildMonthlySaadSummary([], payments, '2026-09');
  assert.equal(oct.grandTotal, 0);
  assert.equal(sep.grandTotal, 15000);
});

test('monthly summary: per-day where labels show customer and area work side by side', () => {
  let visits = addSaadVisit([], visit({ date: '2026-10-05', customerId: 'c-1' }), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-05', type: 'fiber-fix', customerId: '', area: 'Barrian main fiber', startTime: '15:00', endTime: '16:00' }), { customers: CUSTOMERS });
  const s = buildMonthlySaadSummary(visits, [], '2026-10');
  assert.deepEqual(s.perDay[0].places, ['RAJA FAISAL (#1)', 'Barrian main fiber']);
  assert.equal(s.totalFiberMeters, 0);
  const withFiber = addSaadVisit(visits, visit({ date: '2026-10-07', fiberMeters: '120' }), { customers: CUSTOMERS });
  assert.equal(buildMonthlySaadSummary(withFiber, [], '2026-10').totalFiberMeters, 120);
});

test('backup: visits + payments travel in settings and restore under safe-merge rules', () => {
  const visits = addSaadVisit([], visit(), { customers: CUSTOMERS });
  const payments = addSaadPayment([], { date: '2026-10-31', amount: '15000', type: 'salary' });
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { saadVisits: visits, saadPayments: payments });
  const backup = JSON.parse(backupText);
  assert.equal(backup.settings.saadVisits.length, 1);
  assert.equal(backup.settings.saadPayments.length, 1);
  // Fresh device adopts both sections.
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.canApply, true);
  assert.equal(preview.saadVisits.length, 1);
  assert.equal(preview.saadPayments.length, 1);
  assert.equal(preview.counts.saadVisitsRestored, 1);
  assert.equal(preview.counts.saadPaymentsRestored, 1);
  // Device that already holds DIFFERENT visits keeps its own + conflict.
  const otherVisit = addSaadVisit([], visit({ date: '2026-10-07', note: 'Other device work' }), { customers: CUSTOMERS });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentSaadVisits: otherVisit, currentSaadVisitsStored: true });
  assert.equal(clash.saadVisits, null);
  assert.ok(clash.conflicts.some((c) => /Saad visit records differ/.test(c.field)));
});

test('filters: by month and by type; log newest first', () => {
  let visits = addSaadVisit([], visit({ date: '2026-10-05' }), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-09-05', type: 'install' }), { customers: CUSTOMERS });
  assert.equal(visitsForMonth(visits, '2026-10').length, 1);
  assert.equal(filterSaadVisits(visits, { type: 'install' }).length, 1);
  assert.equal(filterSaadVisits(visits, { month: '2026-10' }).length, 1);
  const log = sortedVisitLog(visits);
  assert.equal(log[0].date, '2026-10-05');
  assert.equal(log[1].date, '2026-09-05');
  assert.equal(monthOf('2026-10-05'), '2026-10');
});

// ---- Edit + delete (user-ordered): same validation as create, in-place
// updates, computed summaries follow at once, deleted stays deleted. ----

test('edit visit: hours change updates month summary, keeps id + position + createdAt', () => {
  let visits = [];
  visits = addSaadVisit(visits, visit(), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-06' }), { customers: CUSTOMERS });
  const before = visits[0];
  const edited = updateSaadVisit(visits, visits[0].id, visit({ startTime: '09:00', endTime: '13:00' }), { customers: CUSTOMERS });
  assert.equal(edited.length, 2);
  assert.equal(edited[0].id, 'SV-1');
  assert.equal(edited[0].createdAt, before.createdAt);
  assert.equal(edited[0].hoursWorked, 4);
  assert.equal(edited[1].id, 'SV-2');
  const summary = buildMonthlySaadSummary(edited, [], '2026-10');
  assert.equal(summary.totalHours, 7.5); // 4 + 3.5
  assert.equal(summary.dayCount, 2);
  assert.equal(summary.visits.length, 2);
});

test('edit visit: date change moves it between month summaries', () => {
  let visits = [];
  visits = addSaadVisit(visits, visit(), { customers: CUSTOMERS });
  const edited = updateSaadVisit(visits, visits[0].id, visit({ date: '2026-11-02' }), { customers: CUSTOMERS });
  assert.equal(buildMonthlySaadSummary(edited, [], '2026-10').visits.length, 0);
  assert.equal(buildMonthlySaadSummary(edited, [], '2026-11').visits.length, 1);
  assert.equal(buildMonthlySaadSummary(edited, [], '2026-11').dayCount, 1);
});

test('edit visit: same validation as create; unchanged customer kept when it left the list', () => {
  let visits = [];
  visits = addSaadVisit(visits, visit(), { customers: CUSTOMERS });
  assert.throws(() => updateSaadVisit(visits, 'SV-999', visit(), { customers: CUSTOMERS }), /not found/);
  assert.throws(() => updateSaadVisit(visits, visits[0].id, visit({ endTime: '08:00' }), { customers: CUSTOMERS }), /after start time/);
  assert.throws(() => updateSaadVisit(visits, visits[0].id, visit({ startTime: '09:00', endTime: '' }), { customers: CUSTOMERS }), /both start and end time/);
  assert.throws(() => updateSaadVisit(visits, visits[0].id, visit({ startTime: '', endTime: '' }), { customers: CUSTOMERS }), /start \+ end time, or hours worked/);
  assert.throws(() => updateSaadVisit(visits, visits[0].id, visit({ customerId: 'c-9' }), { customers: CUSTOMERS }), /from the list/);
  // Unchanged customer is NOT rejected when the customer left the list.
  const kept = updateSaadVisit(visits, visits[0].id, visit({ startTime: '09:00', endTime: '10:00' }), { customers: [] });
  assert.equal(kept[0].customerName, 'RAJA FAISAL');
  assert.equal(kept[0].hoursWorked, 1);
  // But switching to a different unknown customer still throws.
  assert.throws(() => updateSaadVisit(visits, visits[0].id, visit({ customerId: 'c-9' }), { customers: [] }), /from the list/);
});

test('edit payment: amount + type change updates the salary/commission split', () => {
  let payments = [];
  payments = addSaadPayment(payments, { date: '2026-10-03', amount: 5000, type: 'salary' });
  payments = addSaadPayment(payments, { date: '2026-10-20', amount: 2000, type: 'commission' });
  const edited = updateSaadPayment(payments, payments[0].id, { date: '2026-10-03', amount: 8000, type: 'commission' });
  assert.equal(edited[0].id, 'SP-1');
  assert.equal(edited[1].id, 'SP-2');
  const summary = buildMonthlySaadSummary([], edited, '2026-10');
  assert.equal(summary.salaryTotal, 0);
  assert.equal(summary.commissionTotal, 10000);
  assert.equal(summary.grandTotal, 10000);
  assert.throws(() => updateSaadPayment(payments, 'SP-999', { date: '2026-10-03', amount: 1, type: 'salary' }), /not found/);
  assert.throws(() => updateSaadPayment(payments, payments[0].id, { date: '2026-10-03', amount: 0, type: 'salary' }), /positive/);
});

test('delete visit and payment: removed from lists and from summary totals', () => {
  let visits = [];
  visits = addSaadVisit(visits, visit(), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-06' }), { customers: CUSTOMERS });
  let payments = [];
  payments = addSaadPayment(payments, { date: '2026-10-03', amount: 5000, type: 'salary' });
  const afterVisitDelete = deleteSaadVisit(visits, visits[0].id);
  assert.equal(afterVisitDelete.length, 1);
  assert.equal(afterVisitDelete[0].id, 'SV-2');
  assert.equal(buildMonthlySaadSummary(afterVisitDelete, [], '2026-10').visits.length, 1);
  assert.equal(buildMonthlySaadSummary(afterVisitDelete, [], '2026-10').totalHours, 3.5);
  const afterPaymentDelete = deleteSaadPayment(payments, payments[0].id);
  assert.equal(afterPaymentDelete.length, 0);
  assert.equal(buildMonthlySaadSummary([], afterPaymentDelete, '2026-10').grandTotal, 0);
  assert.throws(() => deleteSaadVisit(visits, 'SV-999'), /not found/);
  assert.throws(() => deleteSaadPayment(payments, 'SP-999'), /not found/);
});

test('backup: edited entries travel, deleted entries stay deleted after restore', () => {
  let visits = [];
  visits = addSaadVisit(visits, visit(), { customers: CUSTOMERS });
  visits = addSaadVisit(visits, visit({ date: '2026-10-06' }), { customers: CUSTOMERS });
  visits = updateSaadVisit(visits, visits[0].id, visit({ startTime: '09:00', endTime: '13:00' }), { customers: CUSTOMERS });
  visits = deleteSaadVisit(visits, visits[1].id);
  let payments = [];
  payments = addSaadPayment(payments, { date: '2026-10-03', amount: 5000, type: 'salary' });
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { saadVisits: visits, saadPayments: payments });
  const backup = JSON.parse(backupText);
  assert.equal(backup.settings.saadVisits.length, 1);
  assert.equal(backup.settings.saadVisits[0].id, 'SV-1');
  assert.equal(backup.settings.saadVisits[0].hoursWorked, 4);
  assert.ok(!backup.settings.saadVisits.some((v) => v.id === 'SV-2'));
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.saadVisits.map((v) => v.id), ['SV-1']);
  assert.equal(preview.counts.saadVisitsRestored, 1);
  assert.equal(preview.saadPayments.length, 1);
});
