// SISP-184: Fleet-Wide Monthly Uptime SLA Leaderboard & Chronic-Offline
// Alert — pure aggregator tests on synthetic data only. The aggregator
// (buildFleetUptime in uptime-tracking.js) reuses buildMonthlyUptime
// per customer, so every pin here is also a pin that the fleet can
// never disagree with a profile: fleet avg of 100 / 90 / 80 is exactly
// 90.0, a mid-month connection is scored on its clamped window (10
// days), never the full month, a connection that starts after the
// month is excluded and REPORTED (never silently dropped, never
// scored 100%), and an offline span recorded both as an incident and
// as a status flip is counted once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FLEET_CHRONIC_OFFLINE_MINUTES,
  FLEET_CHRONIC_UPTIME_PERCENT,
  buildFleetUptime,
  buildMonthlyUptime,
  parsePkDateTime
} from '../uptime-tracking.js';
import { TRANSLATIONS } from '../nav-language.js';

const at = (pkDateTime) => new Date(parsePkDateTime(pkDateTime));
// October 2026 is fully over at this reference instant.
const REF = at('2026-11-05T12:00');
const MONTH = '2026-10';

const customer = (overrides = {}) => ({
  id: 'c-1',
  customerNumber: 1,
  name: 'Test Customer',
  mohalla: 'BARRIAN',
  connectionDate: '2026-09-01',
  addedOn: '2026-09-01',
  serviceStatus: 'active',
  serviceStatusHistory: [],
  incidents: [],
  bills: [],
  archived: false,
  isFreeConnection: false,
  ...overrides
});
const incident = (overrides = {}) => ({
  id: 'inc-1',
  reportedAt: '2026-10-25T00:05',
  offlineAt: '2026-10-25T00:00',
  restoredAt: '2026-10-26T00:00',
  note: 'Fiber cut',
  createdAt: '2026-10-25T00:05',
  corrections: [],
  ...overrides
});

// The spec fleet: A perfect all month, B connected mid-month (Oct 22,
// a 10-day counted window) with exactly 1 day offline -> 90.0%,
// C same window with exactly 2 days offline -> 80.0%.
const custA = () => customer({ id: 'c-a', customerNumber: 1, name: 'Perfect A' });
const custB = () => customer({ id: 'c-b', customerNumber: 2, name: 'Ninety B', connectionDate: '2026-10-22', addedOn: '2026-10-22', incidents: [incident()] });
const custC = () => customer({ id: 'c-c', customerNumber: 3, name: 'Eighty C', connectionDate: '2026-10-22', addedOn: '2026-10-22', incidents: [incident({ restoredAt: '2026-10-27T00:00' })] });

test('fleet average: 100 / 90 / 80 averages to exactly 90.0, one perfect subscriber', () => {
  const fleet = buildFleetUptime([custA(), custB(), custC()], MONTH, REF);
  assert.equal(fleet.includedCount, 3);
  assert.equal(fleet.excludedCount, 0);
  assert.equal(fleet.fleetAvgPercent, 90.0);
  assert.equal(fleet.perfectCount, 1);
  const byId = Object.fromEntries(fleet.rows.map(row => [row.customerId, row]));
  assert.equal(byId['c-a'].uptimePercent, 100);
  assert.equal(byId['c-b'].uptimePercent, 90);
  assert.equal(byId['c-c'].uptimePercent, 80);
});

test('mid-month connection is scored on its clamped window, not the full month', () => {
  const fleet = buildFleetUptime([custB()], MONTH, REF);
  const row = fleet.rows[0];
  // Oct 22 -> Nov 1 is 10 days = 14,400 minutes. Against the full
  // 31-day month the same 1 offline day would read 96.8% — the fleet
  // must use the per-customer clamped window, exactly like the profile.
  assert.equal(row.windowMinutes, 10 * 24 * 60);
  assert.equal(row.lifetimeClamped, true);
  assert.equal(row.offlineMinutes, 24 * 60);
  assert.equal(row.uptimePercent, 90);
  assert.equal(buildMonthlyUptime(custB(), MONTH, REF).windowMinutes, row.windowMinutes);
});

test('lowest five: ascending by uptime, ties broken by customer number, short fleets list everyone', () => {
  const bHighNumber = customer({ id: 'c-b9', customerNumber: 9, name: 'Ninety Nine', connectionDate: '2026-10-22', addedOn: '2026-10-22', incidents: [incident()] });
  const bLowNumber = customer({ id: 'c-b4', customerNumber: 4, name: 'Ninety Four', connectionDate: '2026-10-22', addedOn: '2026-10-22', incidents: [incident()] });
  const fleet = buildFleetUptime([custA(), bHighNumber, custC(), bLowNumber], MONTH, REF);
  assert.equal(fleet.lowestFive.length, 4);
  assert.deepEqual(fleet.lowestFive.map(row => row.customerId), ['c-c', 'c-b4', 'c-b9', 'c-a']);
  assert.deepEqual(fleet.lowestFive.map(row => row.uptimePercent), [80, 90, 90, 100]);
});

test('lowest five caps at five rows on a bigger fleet', () => {
  const fleet6 = [1, 2, 3, 4, 5, 6].map(n => customer({
    id: `c-n${n}`,
    customerNumber: n,
    connectionDate: '2026-10-22',
    addedOn: '2026-10-22',
    incidents: [incident({ restoredAt: `2026-10-${25 + n}T00:00` })]
  }));
  const fleet = buildFleetUptime(fleet6, MONTH, REF);
  assert.equal(fleet.includedCount, 6);
  assert.equal(fleet.rows.length, 6);
  assert.equal(fleet.lowestFive.length, 5);
  assert.equal(fleet.lowestFive[0].customerNumber, 6, 'most offline ranks first');
});

test('a connection starting after the month is excluded and reported, never scored', () => {
  const late = customer({ id: 'c-late', customerNumber: 8, name: 'Late Joiner', connectionDate: '2026-11-03', addedOn: '2026-11-03' });
  const fleet = buildFleetUptime([custA(), late], MONTH, REF);
  assert.equal(fleet.includedCount, 1);
  assert.equal(fleet.excludedCount, 1);
  assert.deepEqual(fleet.excluded, [{ customerId: 'c-late', customerNumber: 8 }]);
  assert.equal(fleet.fleetAvgPercent, 100, 'the excluded subscriber does not move the average');
  assert.ok(fleet.rows.every(row => row.customerId !== 'c-late'));
});

test('archived subscribers are out of the fleet entirely (not counted, not "excluded")', () => {
  const archived = customer({ id: 'c-arch', customerNumber: 9, archived: true, archivedAt: '2026-10-20', incidents: [incident({ restoredAt: '2026-10-30T00:00' })] });
  const fleet = buildFleetUptime([custA(), archived], MONTH, REF);
  assert.equal(fleet.includedCount, 1);
  assert.equal(fleet.excludedCount, 0);
  assert.equal(fleet.fleetAvgPercent, 100);
});

test('FREE connections are counted — uptime is service, not fees', () => {
  const free = customer({ id: 'c-free', customerNumber: 5, name: 'Free Line', isFreeConnection: true, connectionDate: '2026-10-22', addedOn: '2026-10-22', incidents: [incident({ restoredAt: '2026-10-27T00:00' })] });
  const fleet = buildFleetUptime([custA(), free], MONTH, REF);
  assert.equal(fleet.includedCount, 2);
  const freeRow = fleet.rows.find(row => row.customerId === 'c-free');
  assert.equal(freeRow.isFreeConnection, true);
  assert.equal(freeRow.uptimePercent, 80);
  assert.equal(fleet.fleetAvgPercent, 90);
});

test('an offline span recorded twice (incident + status flip) is counted once in the fleet', () => {
  const twice = customer({
    id: 'c-twice',
    customerNumber: 6,
    connectionDate: '2026-10-22',
    addedOn: '2026-10-22',
    incidents: [incident()],
    serviceStatusHistory: [
      { status: 'offline', at: '2026-10-25T06:00' },
      { status: 'active', at: '2026-10-25T18:00' }
    ]
  });
  const fleet = buildFleetUptime([twice], MONTH, REF);
  assert.equal(fleet.rows[0].offlineMinutes, 24 * 60, 'unioned, not 24h + 12h');
  assert.equal(fleet.rows[0].uptimePercent, 90);
});

test('chronic rule: below 95% OR 24h+ offline flags the row; both legs pinned at the boundary', () => {
  assert.equal(FLEET_CHRONIC_UPTIME_PERCENT, 95);
  assert.equal(FLEET_CHRONIC_OFFLINE_MINUTES, 24 * 60);
  const fleet = buildFleetUptime([custA(), custB(), custC()], MONTH, REF);
  const byId = Object.fromEntries(fleet.rows.map(row => [row.customerId, row]));
  assert.equal(byId['c-a'].chronic, false);
  assert.equal(byId['c-b'].chronic, true, '90% uptime is chronic');
  assert.equal(byId['c-c'].chronic, true);
  assert.equal(fleet.chronicCount, 2);
  // Second leg alone: full-month window, 25h offline = 96.6% uptime
  // (above 95) but >= 24h offline -> chronic.
  const longOutage = customer({ id: 'c-long', customerNumber: 11, incidents: [incident({ offlineAt: '2026-10-10T00:00', restoredAt: '2026-10-11T01:00', reportedAt: '2026-10-10T00:05', createdAt: '2026-10-10T00:05' })] });
  // Just under both legs: 23h59m offline on a full month = 96.8% -> not chronic.
  const justUnder = customer({ id: 'c-under', customerNumber: 12, incidents: [incident({ offlineAt: '2026-10-10T00:00', restoredAt: '2026-10-10T23:59', reportedAt: '2026-10-10T00:05', createdAt: '2026-10-10T00:05' })] });
  const boundary = buildFleetUptime([longOutage, justUnder], MONTH, REF);
  const bById = Object.fromEntries(boundary.rows.map(row => [row.customerId, row]));
  assert.equal(bById['c-long'].uptimePercent, 96.6);
  assert.equal(bById['c-long'].chronic, true, '24h+ offline leg flags on its own');
  assert.equal(bById['c-under'].uptimePercent, 96.8);
  assert.equal(bById['c-under'].chronic, false);
});

test('rows carry the display facts: name, number, mohalla, offline minutes', () => {
  const fleet = buildFleetUptime([custC()], MONTH, REF);
  const row = fleet.rows[0];
  assert.equal(row.name, 'Eighty C');
  assert.equal(row.customerNumber, 3);
  assert.equal(row.mohalla, 'BARRIAN');
  assert.equal(row.offlineMinutes, 2 * 24 * 60);
});

test('empty fleet: no average, no rows, nothing invented', () => {
  const fleet = buildFleetUptime([], MONTH, REF);
  assert.equal(fleet.includedCount, 0);
  assert.equal(fleet.excludedCount, 0);
  assert.equal(fleet.perfectCount, 0);
  assert.equal(fleet.chronicCount, 0);
  assert.equal(fleet.fleetAvgPercent, null);
  assert.deepEqual(fleet.lowestFive, []);
});

test('an invalid month is refused, like the per-customer summary', () => {
  assert.throws(() => buildFleetUptime([], '2026-13', REF), /valid month/);
  assert.throws(() => buildFleetUptime([], 'October', REF), /valid month/);
});

test('i18n: every new upt_fleet_* key exists in English and Urdu with matching placeholders', () => {
  const keys = ['upt_fleet_title', 'upt_fleet_period', 'upt_fleet_period_none', 'upt_fleet_excluded', 'upt_fleet_lowest', 'upt_fleet_row_offline', 'upt_fleet_chronic_note', 'upt_fleet_note'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    const placeholders = (text) => (text.match(/\{[a-z]+\}/g) || []).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity for ${key}`);
  }
  assert.ok(TRANSLATIONS.en.upt_fleet_period.includes('{perfect}') && TRANSLATIONS.en.upt_fleet_period.includes('{count}'));
  assert.ok(TRANSLATIONS.en.upt_fleet_excluded.includes('{count}'));
  assert.ok(TRANSLATIONS.en.upt_fleet_row_offline.includes('{duration}'));
});

test('wiring: the dashboard card markup and the render hook are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="dashboardFleetUptimeValue"'), 'fleet value hook');
  assert.ok(html.includes('id="dashboardFleetUptimePeriod"'), 'fleet period hook');
  assert.ok(html.includes('id="fleetUptimeSummary"'), 'fleet summary hook');
  assert.ok(html.includes('summary-fleet-uptime ds-stat ds-stat--info'), 'card follows the shared ds-stat design');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('buildFleetUptime'), 'app.js aggregates via buildFleetUptime');
  assert.ok(app.includes('data-fleet-uptime-customer-id'), 'rows carry the profile-open hook');
});
