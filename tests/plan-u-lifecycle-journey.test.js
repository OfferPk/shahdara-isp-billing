import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveLifecycleStatus,
  buildLifecycleJourney,
  lifecycleJourneyHtml,
} from '../lifecycle-journey.js';

const base = (overrides = {}) => ({
  id: 'c1',
  customerNumber: 7,
  name: 'Aamir',
  serviceStatus: 'active',
  ...overrides,
});

test('null customer gives an empty journey with not-set status', () => {
  const journey = buildLifecycleJourney(null);
  assert.equal(journey.currentStatus.key, 'not-set');
  assert.equal(journey.archived, false);
  assert.deepEqual(journey.events, []);
  assert.deepEqual(journey.undatedEvents, []);
  assert.equal(journey.eventCount, 0);
});

test('added-only customer yields one added event', () => {
  const journey = buildLifecycleJourney(base({ addedOn: '2026-01-05' }));
  assert.equal(journey.events.length, 1);
  assert.equal(journey.events[0].type, 'added');
  assert.equal(journey.events[0].date, '2026-01-05');
});

test('connection on a different date yields a separate connected event', () => {
  const journey = buildLifecycleJourney(base({ addedOn: '2026-01-05', connectionDate: '2026-01-08' }));
  assert.deepEqual(journey.events.map((e) => e.type), ['added', 'connected']);
});

test('connection on the same date as added is one onboarding, not two', () => {
  const journey = buildLifecycleJourney(base({ addedOn: '2026-01-05', connectionDate: '2026-01-05' }));
  assert.equal(journey.events.length, 1);
  assert.equal(journey.events[0].type, 'added');
});

test('connection without any added date still appears once', () => {
  const journey = buildLifecycleJourney(base({ connectionDate: '2026-02-01' }));
  assert.equal(journey.events.length, 1);
  assert.equal(journey.events[0].type, 'connected');
});

test('invalid dates are dropped, never invented', () => {
  const journey = buildLifecycleJourney(base({
    addedOn: 'soon',
    packageHistory: [{ date: 'not-a-date', oldPackage: 'A', newPackage: 'B' }],
    serviceStatusHistory: [{ status: 'offline', at: 'garbage' }],
  }));
  assert.deepEqual(journey.events, []);
});

test('package change detail carries old, new, rates and staff', () => {
  const journey = buildLifecycleJourney(base({
    packageHistory: [{ date: '2026-03-10', oldPackage: '10Mbps', newPackage: '20Mbps', oldMonthlyRate: 1500, newMonthlyRate: 2500, staffName: 'Saad' }],
  }));
  assert.equal(journey.events.length, 1);
  assert.equal(journey.events[0].type, 'package-change');
  assert.match(journey.events[0].detail, /10Mbps → 20Mbps/);
  assert.match(journey.events[0].detail, /PKR 1500 → PKR 2500/);
  assert.match(journey.events[0].detail, /Saad/);
});

test('package change with null rates says not set, not zero', () => {
  const journey = buildLifecycleJourney(base({
    packageHistory: [{ date: '2026-03-10', oldPackage: '', newPackage: '20Mbps', oldMonthlyRate: null, newMonthlyRate: null }],
  }));
  assert.match(journey.events[0].detail, /not set → 20Mbps/);
  assert.match(journey.events[0].detail, /not set → not set/);
});

test('package change without a date is dropped', () => {
  const journey = buildLifecycleJourney(base({
    packageHistory: [{ oldPackage: 'A', newPackage: 'B' }],
  }));
  assert.deepEqual(journey.events, []);
});

test('service status flips appear with their recorded dates', () => {
  const journey = buildLifecycleJourney(base({
    serviceStatusHistory: [
      { status: 'offline', at: '2026-04-01T10:30' },
      { status: 'active', at: '2026-04-05T09:00' },
    ],
  }));
  assert.deepEqual(journey.events.map((e) => e.title), ['Service offline', 'Service active']);
  assert.equal(journey.events[0].date, '2026-04-01');
});

test('unknown service status entries are dropped', () => {
  const journey = buildLifecycleJourney(base({
    serviceStatusHistory: [{ status: 'mystery', at: '2026-04-01T10:30' }],
  }));
  assert.deepEqual(journey.events, []);
});

test('hold started carries the scheduled resume date', () => {
  const journey = buildLifecycleJourney(base({
    paused: true, pauseStartDate: '2026-05-01', autoResumeDate: '2026-06-01',
  }));
  const hold = journey.events.find((e) => e.type === 'hold-started');
  assert.equal(hold.date, '2026-05-01');
  assert.match(hold.detail, /2026-06-01/);
});

test('hold started without a resume date says so honestly', () => {
  const journey = buildLifecycleJourney(base({
    paused: true, pauseStartDate: '2026-05-01', autoResumeDate: null,
  }));
  assert.match(journey.events[0].detail, /no resume date recorded/);
});

test('ended hold with skipped months is an undated event listing the months', () => {
  const journey = buildLifecycleJourney(base({
    paused: false, pauseStartDate: '2026-05-01', pauseSkippedMonths: ['2026-05', '2026-06'],
  }));
  assert.equal(journey.events.filter((e) => e.type === 'hold-started').length, 1);
  assert.equal(journey.undatedEvents.length, 1);
  assert.equal(journey.undatedEvents[0].type, 'hold-resumed');
  assert.match(journey.undatedEvents[0].detail, /2026-05, 2026-06/);
  assert.equal(journey.undatedEvents[0].date, null);
});

test('currently paused customer gets no hold-resumed event', () => {
  const journey = buildLifecycleJourney(base({
    paused: true, pauseStartDate: '2026-05-01', pauseSkippedMonths: ['2026-05'],
  }));
  assert.deepEqual(journey.undatedEvents, []);
});

test('disconnect history entry carries reason, eligibility and note', () => {
  const journey = buildLifecycleJourney(base({
    archived: true, archivedAt: '2026-07-02T11:00',
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: 'competitor', winBackEligible: true, disconnectNote: 'Moved away' }],
  }));
  const archived = journey.events.filter((e) => e.type === 'archived');
  assert.equal(archived.length, 1);
  assert.match(archived[0].detail, /Competitor/);
  assert.match(archived[0].detail, /eligible/);
  assert.match(archived[0].detail, /Moved away/);
});

test('legacy archive (archivedAt, no history) still appears once', () => {
  const journey = buildLifecycleJourney(base({
    archived: true, archivedAt: '2026-07-02T11:00', disconnectHistory: [],
  }));
  assert.equal(journey.events.filter((e) => e.type === 'archived').length, 1);
});

test('current archive duplicating a history date is not doubled', () => {
  const journey = buildLifecycleJourney(base({
    archived: true, archivedAt: '2026-07-02T11:00',
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: '', winBackEligible: false, disconnectNote: '' }],
  }));
  assert.equal(journey.events.filter((e) => e.type === 'archived').length, 1);
});

test('archived with no date and no history is undated, not dated by guess', () => {
  const journey = buildLifecycleJourney(base({ archived: true, archivedAt: null, disconnectHistory: [] }));
  assert.deepEqual(journey.events, []);
  assert.equal(journey.undatedEvents.length, 1);
  assert.equal(journey.undatedEvents[0].type, 'archived');
});

test('unrecorded disconnect reason reads as not recorded', () => {
  const journey = buildLifecycleJourney(base({
    archived: true, archivedAt: '2026-07-02T11:00',
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: 'bogus', winBackEligible: false, disconnectNote: '' }],
  }));
  assert.match(journey.events[0].detail, /Not recorded/);
});

test('all four disconnect reasons label correctly', () => {
  for (const [reason, label] of [['shifted', 'Shifted'], ['competitor', 'Competitor'], ['affordability', 'Affordability'], ['temporary-travel', 'Temporary travel']]) {
    const journey = buildLifecycleJourney(base({
      archived: true, archivedAt: '2026-07-02T11:00',
      disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: reason, winBackEligible: false, disconnectNote: '' }],
    }));
    assert.match(journey.events[0].detail, new RegExp(label));
  }
});

test('win-back offer sent appears as its own dated event', () => {
  const journey = buildLifecycleJourney(base({ winBackOfferSentAt: '2026-07-10T09:00' }));
  assert.equal(journey.events.length, 1);
  assert.equal(journey.events[0].type, 'winback-offer-sent');
  assert.equal(journey.events[0].date, '2026-07-10');
});

test('active customer with disconnect history gets an undated restored event', () => {
  const journey = buildLifecycleJourney(base({
    archived: false,
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: 'temporary-travel', winBackEligible: true, disconnectNote: '' }],
  }));
  const restored = journey.undatedEvents.find((e) => e.type === 'restored');
  assert.ok(restored);
  assert.match(restored.detail, /Restore date not recorded/);
});

test('currently archived customer gets no restored event', () => {
  const journey = buildLifecycleJourney(base({
    archived: true, archivedAt: '2026-07-02T11:00',
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: '', winBackEligible: false, disconnectNote: '' }],
  }));
  assert.equal(journey.undatedEvents.filter((e) => e.type === 'restored').length, 0);
});

test('status priority: archived beats on-hold beats service status', () => {
  assert.equal(resolveLifecycleStatus(base({ archived: true, paused: true, pauseStartDate: '2026-05-01', serviceStatus: 'active' })).key, 'archived');
  assert.equal(resolveLifecycleStatus(base({ paused: true, pauseStartDate: '2026-05-01', serviceStatus: 'offline' })).key, 'on-hold');
  assert.equal(resolveLifecycleStatus(base({ serviceStatus: 'offline' })).key, 'offline');
  assert.equal(resolveLifecycleStatus(base({ serviceStatus: 'active' })).key, 'active');
});

test('paused without a start date is not on-hold', () => {
  assert.equal(resolveLifecycleStatus(base({ paused: true, pauseStartDate: null, serviceStatus: 'active' })).key, 'active');
});

test('journey archived flag always agrees with the record', () => {
  assert.equal(buildLifecycleJourney(base({ archived: true })).archived, true);
  assert.equal(buildLifecycleJourney(base({ archived: false })).archived, false);
  assert.equal(buildLifecycleJourney(base({})).archived, false);
});

test('events sort oldest first even when inputs arrive newest first', () => {
  const journey = buildLifecycleJourney(base({
    addedOn: '2026-01-05',
    packageHistory: [
      { date: '2026-06-01', oldPackage: 'A', newPackage: 'B' },
      { date: '2026-03-01', oldPackage: 'X', newPackage: 'Y' },
    ],
  }));
  assert.deepEqual(journey.events.map((e) => e.date), ['2026-01-05', '2026-03-01', '2026-06-01']);
});

test('same-date events follow the fixed type order', () => {
  const journey = buildLifecycleJourney(base({
    addedOn: '2026-01-05',
    packageHistory: [{ date: '2026-01-05', oldPackage: 'A', newPackage: 'B' }],
    serviceStatusHistory: [{ status: 'offline', at: '2026-01-05T08:00' }],
  }));
  assert.deepEqual(journey.events.map((e) => e.type), ['added', 'package-change', 'service-status']);
});

test('building a journey never mutates the customer record', () => {
  const customer = base({
    addedOn: '2026-01-05',
    packageHistory: [{ date: '2026-03-01', oldPackage: 'A', newPackage: 'B' }],
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: 'shifted', winBackEligible: false, disconnectNote: '' }],
  });
  const before = JSON.stringify(customer);
  buildLifecycleJourney(customer);
  assert.equal(JSON.stringify(customer), before);
});

test('non-array history fields are ignored, not crashed on', () => {
  const journey = buildLifecycleJourney(base({
    packageHistory: 'nope', serviceStatusHistory: 42, disconnectHistory: null, pauseSkippedMonths: '2026-05',
  }));
  assert.deepEqual(journey.events, []);
  assert.deepEqual(journey.undatedEvents, []);
});

test('customer id and number ride through the journey', () => {
  const journey = buildLifecycleJourney(base({ id: 'cx', customerNumber: 42 }));
  assert.equal(journey.customerId, 'cx');
  assert.equal(journey.customerNumber, 42);
});

test('eventCount counts dated plus undated events', () => {
  const journey = buildLifecycleJourney(base({
    addedOn: '2026-01-05',
    paused: false, pauseStartDate: '2026-05-01', pauseSkippedMonths: ['2026-05'],
  }));
  assert.equal(journey.eventCount, journey.events.length + journey.undatedEvents.length);
  assert.equal(journey.eventCount, 3);
});

test('HTML contains the status banner and every dated event', () => {
  const html = lifecycleJourneyHtml(buildLifecycleJourney(base({
    addedOn: '2026-01-05',
    packageHistory: [{ date: '2026-03-01', oldPackage: 'A', newPackage: 'B' }],
  })));
  assert.match(html, /Current status:/);
  assert.match(html, /2026-01-05/);
  assert.match(html, /2026-03-01/);
  assert.match(html, /Customer journey/);
});

test('HTML escapes hostile text instead of injecting it', () => {
  const html = lifecycleJourneyHtml(buildLifecycleJourney(base({
    packageHistory: [{ date: '2026-03-01', oldPackage: '<script>alert(1)</script>', newPackage: 'B', staffName: 'x" onerror="y' }],
  })));
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('HTML empty journey shows the empty state, not an empty list', () => {
  const html = lifecycleJourneyHtml(buildLifecycleJourney(base({})));
  assert.match(html, /No lifecycle events recorded yet/);
  assert.doesNotMatch(html, /<ol/);
});

test('HTML labels undated events as date not recorded', () => {
  const html = lifecycleJourneyHtml(buildLifecycleJourney(base({
    archived: false,
    disconnectHistory: [{ archivedAt: '2026-07-02T11:00', disconnectReason: '', winBackEligible: false, disconnectNote: '' }],
  })));
  assert.match(html, /Date not recorded/);
  assert.match(html, /Restored to active/);
});

test('HTML of a null journey is empty', () => {
  assert.equal(lifecycleJourneyHtml(null), '');
});

test('archived status detail names the disconnect reason', () => {
  const status = resolveLifecycleStatus(base({ archived: true, disconnectReason: 'affordability' }));
  assert.equal(status.key, 'archived');
  assert.match(status.detail, /Affordability/);
});

test('on-hold status detail names the resume date when present', () => {
  const status = resolveLifecycleStatus(base({ paused: true, pauseStartDate: '2026-05-01', autoResumeDate: '2026-06-01' }));
  assert.equal(status.key, 'on-hold');
  assert.match(status.detail, /2026-06-01/);
});
