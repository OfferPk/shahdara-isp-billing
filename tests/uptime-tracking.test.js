// Owner feature: Customer Uptime Tracking — profile age stamp,
// online/offline month summary, status-flip history.
// Pure-function + core tests on synthetic data only. Owner arithmetic
// pins: a 31-day month with exactly 2 days 6 hours recorded offline
// must read online 28 days 18 hours / offline 2 days 6 hours with the
// reason listed; February counts 29 days in a leap year and 28 in a
// non-leap year; boundary periods split per month; open periods count
// to now; time before the connection existed is never counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile
} from '../core.js';
import {
  buildMonthlyUptime,
  calendarAgeBetween,
  collectOfflineIntervals,
  daysInCalendarMonth,
  parsePkDateTime,
  splitMinutes,
  summarizeProfileAge
} from '../uptime-tracking.js';

const at = (pkDateTime) => new Date(parsePkDateTime(pkDateTime));
const customer = (overrides = {}) => ({
  id: 'c-uptime',
  customerNumber: 42,
  name: 'Test Customer 42',
  connectionDate: '2026-09-01',
  addedOn: '2026-09-01',
  serviceStatus: 'active',
  serviceStatusHistory: [],
  incidents: [],
  bills: [],
  archived: false,
  ...overrides
});
const incident = (overrides = {}) => ({
  id: 'inc-1',
  reportedAt: '2026-10-10T08:05',
  offlineAt: '2026-10-10T08:00',
  restoredAt: '2026-10-12T14:00',
  note: 'Fiber cut on the main road',
  createdAt: '2026-10-10T08:05',
  corrections: [],
  ...overrides
});

// ---------- profile age stamp ----------

test('age stamp: months + days from a known connection date', () => {
  const age = summarizeProfileAge(customer({ connectionDate: '2026-07-15' }), at('2026-10-29T10:00'));
  assert.equal(age.status, 'current');
  assert.equal(age.basis, 'connection');
  assert.equal(age.months, 3);
  assert.equal(age.days, 14);
  assert.equal(age.totalDays, 106);
});

test('age stamp: falls back to the profile-added date, honestly labelled', () => {
  const age = summarizeProfileAge(customer({ connectionDate: null, addedOn: '2026-10-01' }), at('2026-10-29T10:00'));
  assert.equal(age.status, 'profile');
  assert.equal(age.basis, 'profile');
  assert.equal(age.months, 0);
  assert.equal(age.days, 28);
});

test('age stamp: no connection date and no added date -> not recorded, nothing invented', () => {
  const age = summarizeProfileAge(customer({ connectionDate: null, addedOn: null }), at('2026-10-29T10:00'));
  assert.equal(age.status, 'not-recorded');
  assert.equal(age.months, null);
  assert.equal(age.days, null);
});

test('age stamp: a future connection date is not aged', () => {
  const age = summarizeProfileAge(customer({ connectionDate: '2027-01-10' }), at('2026-10-29T10:00'));
  assert.equal(age.status, 'future');
  assert.equal(age.months, null);
});

test('age stamp: an ended connection freezes at its end date', () => {
  const age = summarizeProfileAge(
    customer({ connectionDate: '2026-01-10', cancellationDate: '2026-04-10' }),
    at('2026-10-29T10:00')
  );
  assert.equal(age.status, 'ended');
  assert.equal(age.months, 3);
  assert.equal(age.days, 0);
});

test('calendarAgeBetween clamps month anchors (Jan 31 -> Feb 28)', () => {
  assert.deepEqual(calendarAgeBetween('2026-01-31', '2026-03-01'), { months: 1, days: 1, totalDays: 29 });
  assert.equal(calendarAgeBetween('2026-03-01', '2026-01-31'), null);
});

// ---------- month summary: the owner pins ----------

test('PIN: 31-day month, one offline period of 2 days 6 hours -> online 28d 18h, offline 2d 6h, reason listed', () => {
  const summary = buildMonthlyUptime(customer({ incidents: [incident()] }), '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.daysInMonth, 31);
  assert.deepEqual(summary.offline, { days: 2, hours: 6, minutes: 0, totalMinutes: 3240 });
  assert.deepEqual(summary.online, { days: 28, hours: 18, minutes: 0, totalMinutes: 41400 });
  assert.equal(summary.periods.length, 1);
  assert.equal(summary.periods[0].reason, 'Fiber cut on the main road');
  assert.equal(summary.periods[0].minutes, 3240);
  assert.equal(summary.periods[0].open, false);
});

test('PIN: February counts 29 days in a leap year and 28 in a non-leap year', () => {
  assert.equal(daysInCalendarMonth(2028, 2), 29);
  assert.equal(daysInCalendarMonth(2026, 2), 28);
  const leap = buildMonthlyUptime(customer({ connectionDate: '2027-06-01' }), '2028-02', at('2028-03-10T09:00'));
  assert.equal(leap.daysInMonth, 29);
  assert.equal(leap.onlineMinutes, 29 * 1440);
  const plain = buildMonthlyUptime(customer({ connectionDate: '2025-06-01' }), '2026-02', at('2026-03-10T09:00'));
  assert.equal(plain.daysInMonth, 28);
  assert.equal(plain.onlineMinutes, 28 * 1440);
});

test('PIN: an offline period spanning a month boundary is split per month', () => {
  const spanning = incident({
    reportedAt: '2026-10-30T12:05',
    offlineAt: '2026-10-30T12:00',
    restoredAt: '2026-11-02T12:00',
    note: 'Pole damaged by storm'
  });
  const october = buildMonthlyUptime(customer({ incidents: [spanning] }), '2026-10', at('2026-12-01T09:00'));
  assert.deepEqual(october.offline, { days: 1, hours: 12, minutes: 0, totalMinutes: 2160 });
  const november = buildMonthlyUptime(customer({ incidents: [spanning] }), '2026-11', at('2026-12-01T09:00'));
  assert.deepEqual(november.offline, { days: 1, hours: 12, minutes: 0, totalMinutes: 2160 });
  assert.equal(november.periods[0].reason, 'Pole damaged by storm');
});

test('PIN: an open (unrestored) offline period counts up to now', () => {
  const open = incident({ restoredAt: null, offlineAt: '2026-10-30T00:00', reportedAt: '2026-10-30T00:10', note: 'ONU dead' });
  const summary = buildMonthlyUptime(customer({ incidents: [open] }), '2026-10', at('2026-10-31T12:00'));
  assert.deepEqual(summary.offline, { days: 1, hours: 12, minutes: 0, totalMinutes: 2160 });
  assert.equal(summary.periods[0].open, true);
  assert.equal(summary.openSinceMs, parsePkDateTime('2026-10-30T00:00'));
});

test('PIN: time before the connection existed is never counted', () => {
  const early = incident({ offlineAt: '2026-10-10T08:00', restoredAt: '2026-10-12T14:00', reportedAt: '2026-10-10T08:05' });
  const summary = buildMonthlyUptime(customer({ connectionDate: '2026-10-15', incidents: [early] }), '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.offlineMinutes, 0);
  assert.equal(summary.periods.length, 0);
  // Counted window = Oct 15 00:00 -> Nov 1 00:00 = 17 days, all online.
  assert.equal(summary.windowMinutes, 17 * 1440);
  assert.equal(summary.onlineMinutes, 17 * 1440);
  assert.equal(summary.lifetimeClamped, true);
});

test('PIN: a customer with no offline records shows the full month online', () => {
  const summary = buildMonthlyUptime(customer(), '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.offlineMinutes, 0);
  assert.equal(summary.onlineMinutes, 31 * 1440);
  assert.deepEqual(summary.periods, []);
  assert.equal(summary.openSinceMs, null);
});

test('status-history spans count as offline time and union with records (never double-counted)', () => {
  const history = [
    { status: 'active', at: '2026-10-01T09:00' },
    { status: 'offline', at: '2026-10-05T10:00' },
    { status: 'active', at: '2026-10-07T10:00' }
  ];
  const fromHistory = buildMonthlyUptime(customer({ serviceStatusHistory: history }), '2026-10', at('2026-11-05T09:00'));
  assert.equal(fromHistory.offlineMinutes, 2 * 1440);
  assert.equal(fromHistory.periods[0].source, 'status');

  // The exact same span also logged as an incident must count once.
  const overlap = incident({ offlineAt: '2026-10-05T10:00', restoredAt: '2026-10-07T10:00', reportedAt: '2026-10-05T10:05', note: 'Same outage, logged twice' });
  const unioned = buildMonthlyUptime(customer({ serviceStatusHistory: history, incidents: [overlap] }), '2026-10', at('2026-11-05T09:00'));
  assert.equal(unioned.offlineMinutes, 2 * 1440);
  assert.equal(unioned.periods.length, 2);
});

test('an open status-history offline span counts to now and flags the customer offline', () => {
  const history = [
    { status: 'active', at: '2026-10-01T09:00' },
    { status: 'offline', at: '2026-10-20T06:00' }
  ];
  const summary = buildMonthlyUptime(customer({ serviceStatus: 'offline', serviceStatusHistory: history }), '2026-10', at('2026-10-22T06:00'));
  assert.equal(summary.offlineMinutes, 2 * 1440);
  assert.equal(summary.openSinceMs, parsePkDateTime('2026-10-20T06:00'));
});

test('collectOfflineIntervals skips malformed records instead of guessing', () => {
  const intervals = collectOfflineIntervals(customer({
    incidents: [
      incident({ id: 'bad-1', offlineAt: 'not-a-date' }),
      incident({ id: 'bad-2', offlineAt: '2026-10-10T08:00', restoredAt: '2026-10-09T08:00' }),
      incident({ id: 'good', offlineAt: '2026-10-10T08:00', restoredAt: '2026-10-10T09:00' })
    ]
  }));
  assert.equal(intervals.length, 1);
  assert.equal(intervals[0].minutes, undefined);
  assert.equal(intervals[0].endMs - intervals[0].startMs, 60 * 60 * 1000);
});

test('FREE connection: month summary works with no bills at all', () => {
  const summary = buildMonthlyUptime(customer({ isFreeConnection: true, bills: [] }), '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.onlineMinutes, 31 * 1440);
  assert.equal(summary.daysInMonth, 31);
});

test('splitMinutes breaks a total into days/hours/minutes', () => {
  assert.deepEqual(splitMinutes(3240), { days: 2, hours: 6, minutes: 0, totalMinutes: 3240 });
  assert.deepEqual(splitMinutes(90), { days: 0, hours: 1, minutes: 30, totalMinutes: 90 });
  assert.deepEqual(splitMinutes(-5), { days: 0, hours: 0, minutes: 0, totalMinutes: 0 });
});

// ---------- core: status history stamping ----------

test('addCustomer seeds the status history for an initially offline/active customer only', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 7', at('2026-10-01T09:30'), { serviceStatus: 'offline' });
  const offline = state.customers.find(c => c.name === 'Test Customer 7');
  assert.deepEqual(offline.serviceStatusHistory, [{ status: 'offline', at: '2026-10-01T09:30' }]);

  state = addCustomer(state, 'Test Customer 8', at('2026-10-01T09:30'));
  const unset = state.customers.find(c => c.name === 'Test Customer 8');
  assert.deepEqual(unset.serviceStatusHistory, []);
});

test('updateCustomerProfile stamps a flip and stays silent on a no-change save', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 9', at('2026-10-01T09:00'), { serviceStatus: 'active' });
  const id = state.customers.find(c => c.name === 'Test Customer 9').id;

  state = updateCustomerProfile(state, id, { serviceStatus: 'offline' }, at('2026-10-05T10:00'));
  let saved = state.customers.find(c => c.id === id);
  assert.deepEqual(saved.serviceStatusHistory, [
    { status: 'active', at: '2026-10-01T09:00' },
    { status: 'offline', at: '2026-10-05T10:00' }
  ]);

  // Editing an unrelated field must not append a stamp.
  state = updateCustomerProfile(state, id, { phone: '0300-0000000' }, at('2026-10-06T10:00'));
  saved = state.customers.find(c => c.id === id);
  assert.equal(saved.serviceStatusHistory.length, 2);

  state = updateCustomerProfile(state, id, { serviceStatus: 'active' }, at('2026-10-07T10:00'));
  saved = state.customers.find(c => c.id === id);
  assert.equal(saved.serviceStatusHistory.length, 3);
  assert.deepEqual(saved.serviceStatusHistory[2], { status: 'active', at: '2026-10-07T10:00' });
});

test('a legacy record without history starts one on its first recorded flip', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 10', at('2026-10-01T09:00'));
  const id = state.customers[0].id;
  state = { ...state, customers: state.customers.map(c => ({ ...c, serviceStatus: 'active', serviceStatusHistory: undefined })) };
  state = updateCustomerProfile(state, id, { serviceStatus: 'offline' }, at('2026-10-03T08:00'));
  assert.deepEqual(state.customers[0].serviceStatusHistory, [{ status: 'offline', at: '2026-10-03T08:00' }]);
});

test('readState keeps well-formed history entries and drops junk', () => {
  const storage = {
    getItem: () => JSON.stringify({
      version: 1,
      nextCustomerNumber: 2,
      customers: [{
        id: 'c-legacy', customerNumber: 1, name: 'Test Customer 11',
        serviceStatus: 'offline',
        serviceStatusHistory: [
          { status: 'active', at: '2026-10-01T09:00' },
          { status: 'bogus', at: '2026-10-02T09:00' },
          { status: 'offline', at: 'not-a-date' },
          'garbage',
          { status: 'offline', at: '2026-10-03T09:00' }
        ],
        bills: [], incidents: []
      }]
    })
  };
  const state = readState(storage);
  assert.deepEqual(state.customers[0].serviceStatusHistory, [
    { status: 'active', at: '2026-10-01T09:00' },
    { status: 'offline', at: '2026-10-03T09:00' }
  ]);
});

test('JSON backup round-trip preserves and unions the status history', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 12', at('2026-10-01T09:00'), { serviceStatus: 'active' });
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, { serviceStatus: 'offline' }, at('2026-10-05T10:00'));

  const backupJson = createJsonBackup(state, at('2026-10-18T09:00'));
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers[0].serviceStatusHistory.length, 2);

  // Local side kept only the first stamp; the merge must union, not lose.
  const localState = JSON.parse(JSON.stringify(state));
  localState.customers[0].serviceStatusHistory = [{ status: 'active', at: '2026-10-01T09:00' }];
  localState.customers[0].serviceStatus = 'active';
  const preview = previewJsonBackupMerge(localState, backupJson);
  assert.equal(preview.canApply, true);
  assert.deepEqual(preview.state.customers[0].serviceStatusHistory, [
    { status: 'active', at: '2026-10-01T09:00' },
    { status: 'offline', at: '2026-10-05T10:00' }
  ]);
});
