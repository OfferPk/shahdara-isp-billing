// SISP-123: Repeat-Category Root-Cause Engineering Prescription.
// Pure-function tests on synthetic data only. Spec pin (from the phase
// spec): logging a 2nd "Media Converter / Charger Off" complaint within
// 60 days displays the specific root-cause engineering recommendation
// banner ("Install 12V Mini-UPS or Migrate to Passive PLC Splitter").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROOT_CAUSE_FIX_KEYS,
  ROOT_CAUSE_WINDOW_DAYS,
  complaintFaultGroup,
  faultEventsForCustomer,
  rootCauseAdviceForCustomer,
  rootCauseBannerHtml,
  ticketFaultGroup
} from '../root-cause-advisor.js';
import { AREA_OUTAGE_CUSTOMER_ID, createComplaint } from '../complaint-register.js';
import { TRANSLATIONS } from '../nav-language.js';
import { ENTRY_FILES } from '../build.mjs';

const MC = 'Media Converter / Charger Off';
const MC_PRESET = 'Media Converter Power/Charger';
const REF = new Date('2026-10-29T12:00');

function complaint(id, customerId, issueCategory, reportedAt, extra = {}) {
  return {
    id,
    customerId,
    customerName: 'Synthetic Customer',
    zone: 'BARRIAN',
    issueCategory,
    reportedAt,
    resolvedAt: '',
    downtimeHours: null,
    downtimeManual: false,
    status: 'Open',
    resolutionNote: '',
    resolvedViaTicketId: '',
    ...extra
  };
}

function ticket(id, customerId, faultPreset, createdAt, extra = {}) {
  return {
    id,
    customerId,
    customerName: 'Synthetic Customer',
    complaintId: '',
    faultPreset,
    customFault: '',
    technician: 'Synthetic Lineman',
    priority: 'Normal',
    status: 'Open',
    createdAt,
    resolvedAt: '',
    note: '',
    materialsUsed: [],
    billingType: 'free',
    billedAmount: 0,
    chargePaid: false,
    ...extra
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

test('spec pin: 2nd Media Converter complaint within 60 days earns the Mini-UPS / PLC prescription', () => {
  // Logged through the real register creator, like the operator flow.
  let complaints = [];
  complaints = [...complaints, createComplaint(
    { customerId: 'cust-1', customerName: 'Synthetic Customer', issueCategory: MC, reportedAt: '2026-10-01T10:00' },
    complaints
  )];
  complaints = [...complaints, createComplaint(
    { customerId: 'cust-1', customerName: 'Synthetic Customer', issueCategory: MC, reportedAt: '2026-10-21T10:00' },
    complaints
  )];
  const advice = rootCauseAdviceForCustomer({ complaints, tickets: [] }, 'cust-1', REF);
  assert.equal(advice.length, 1);
  assert.equal(advice[0].group, MC);
  assert.equal(advice[0].category, MC); // label renders as recorded
  assert.equal(advice[0].count, 2);
  assert.equal(advice[0].daysApart, 20);
  assert.equal(advice[0].fixKey, 'rca_fix_media_converter');
  const banner = rootCauseBannerHtml(advice);
  assert.match(banner, /root-cause-banner/);
  assert.ok(banner.includes(TRANSLATIONS.en.rca_fix_media_converter));
  assert.ok(banner.includes('12V mini-UPS'), 'spec prescription names the 12V mini-UPS');
  assert.ok(banner.includes('passive PLC splitter'), 'spec prescription names the passive PLC splitter');
  assert.ok(banner.includes(MC), 'banner names the recorded category');
});

test('window: exactly 60 days apart fires; 61 days apart does not; pair ages out of the trailing window', () => {
  const at60 = [
    complaint('CMP-101', 'cust-1', MC, '2026-08-30T12:00'),
    complaint('CMP-102', 'cust-1', MC, '2026-10-29T12:00')
  ];
  assert.equal(rootCauseAdviceForCustomer({ complaints: at60, tickets: [] }, 'cust-1', REF).length, 1);
  const at61 = [
    complaint('CMP-101', 'cust-1', MC, '2026-08-29T12:00'),
    complaint('CMP-102', 'cust-1', MC, '2026-10-29T12:00')
  ];
  assert.equal(rootCauseAdviceForCustomer({ complaints: at61, tickets: [] }, 'cust-1', REF).length, 0);
  // Same close pair, but the reference has moved on: both events fell
  // out of the trailing 60-day window, so the advice disappears.
  const oldPair = [
    complaint('CMP-101', 'cust-1', MC, '2026-06-01T10:00'),
    complaint('CMP-102', 'cust-1', MC, '2026-06-21T10:00')
  ];
  assert.equal(rootCauseAdviceForCustomer({ complaints: oldPair, tickets: [] }, 'cust-1', REF).length, 0);
  assert.equal(ROOT_CAUSE_WINDOW_DAYS, 60);
});

test('different categories within 60 days never combine', () => {
  const complaints = [
    complaint('CMP-101', 'cust-1', MC, '2026-10-20T10:00'),
    complaint('CMP-102', 'cust-1', 'Fiber Cut', '2026-10-25T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints, tickets: [] }, 'cust-1', REF), []);
});

test('SISP-44 dedup: a complaint and its linked ticket are ONE fault', () => {
  const complaints = [complaint('CMP-101', 'cust-1', MC, '2026-10-20T10:00')];
  const tickets = [ticket('TKT-101', 'cust-1', MC_PRESET, '2026-10-20T11:00', { complaintId: 'CMP-101' })];
  const events = faultEventsForCustomer(complaints, tickets, 'cust-1');
  assert.equal(events.length, 1);
  assert.equal(events[0].source, 'complaint');
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints, tickets }, 'cust-1', REF), []);
});

test('cross-ledger: a complaint plus a standalone ticket of the mapped preset repeats the fault', () => {
  const complaints = [complaint('CMP-101', 'cust-1', MC, '2026-10-05T10:00')];
  const tickets = [ticket('TKT-101', 'cust-1', MC_PRESET, '2026-10-15T10:00')];
  const advice = rootCauseAdviceForCustomer({ complaints, tickets }, 'cust-1', REF);
  assert.equal(advice.length, 1);
  assert.equal(advice[0].group, MC);
  assert.equal(advice[0].count, 2);
});

test('standalone tickets group by their recorded preset mapping', () => {
  const mcTickets = [
    ticket('TKT-101', 'cust-1', MC_PRESET, '2026-10-05T10:00'),
    ticket('TKT-102', 'cust-1', MC_PRESET, '2026-10-25T10:00')
  ];
  const mcAdvice = rootCauseAdviceForCustomer({ complaints: [], tickets: mcTickets }, 'cust-1', REF);
  assert.equal(mcAdvice.length, 1);
  assert.equal(mcAdvice[0].group, MC);
  // The fiber preset maps back to two register categories, so it keeps
  // its own preset-labelled group instead of guessing one.
  const fiberTickets = [
    ticket('TKT-101', 'cust-1', 'Fiber Cut / Splice Loss', '2026-10-05T10:00'),
    ticket('TKT-102', 'cust-1', 'Fiber Cut / Splice Loss', '2026-10-25T10:00')
  ];
  const fiberAdvice = rootCauseAdviceForCustomer({ complaints: [], tickets: fiberTickets }, 'cust-1', REF);
  assert.equal(fiberAdvice.length, 1);
  assert.equal(fiberAdvice[0].group, 'Fiber Cut / Splice Loss');
  assert.equal(fiberAdvice[0].fixKey, 'rca_fix_fiber_cut_splice');
  // A fiber register complaint and a fiber ticket do NOT merge into a
  // guessed category.
  const mixed = rootCauseAdviceForCustomer({
    complaints: [complaint('CMP-101', 'cust-1', 'Fiber Cut', '2026-10-05T10:00')],
    tickets: [ticket('TKT-101', 'cust-1', 'Fiber Cut / Splice Loss', '2026-10-06T10:00')]
  }, 'cust-1', REF);
  assert.deepEqual(mixed, []);
});

test('status never gates the count: open + resolved repeats still fire', () => {
  const complaints = [
    complaint('CMP-101', 'cust-1', MC, '2026-10-05T10:00', { status: 'Resolved', resolvedAt: '2026-10-05T14:00' }),
    complaint('CMP-102', 'cust-1', MC, '2026-10-25T10:00')
  ];
  assert.equal(rootCauseAdviceForCustomer({ complaints, tickets: [] }, 'cust-1', REF).length, 1);
});

test('unmapped categories never advise: Other and Main Uplink / NayaPay Down', () => {
  const others = [
    complaint('CMP-101', 'cust-1', 'Other', '2026-10-20T10:00'),
    complaint('CMP-102', 'cust-1', 'Other', '2026-10-25T10:00'),
    complaint('CMP-103', 'cust-1', 'Other', '2026-10-28T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints: others, tickets: [] }, 'cust-1', REF), []);
  const uplink = [
    complaint('CMP-104', 'cust-1', 'Main Uplink / NayaPay Down', '2026-10-20T10:00'),
    complaint('CMP-105', 'cust-1', 'Main Uplink / NayaPay Down', '2026-10-28T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints: uplink, tickets: [] }, 'cust-1', REF), []);
  assert.equal(ROOT_CAUSE_FIX_KEYS.Other, undefined);
  assert.equal(ROOT_CAUSE_FIX_KEYS['Main Uplink / NayaPay Down'], undefined);
});

test('invalid or missing dates never count; future-dated records never count', () => {
  const oneValidOneBroken = [
    complaint('CMP-101', 'cust-1', MC, ''),
    complaint('CMP-102', 'cust-1', MC, '2026-10-25T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints: oneValidOneBroken, tickets: [] }, 'cust-1', REF), []);
  const withGarbage = [
    complaint('CMP-101', 'cust-1', MC, 'not-a-date'),
    complaint('CMP-102', 'cust-1', MC, '2026-10-05T10:00'),
    complaint('CMP-103', 'cust-1', MC, '2026-10-25T10:00')
  ];
  const advice = rootCauseAdviceForCustomer({ complaints: withGarbage, tickets: [] }, 'cust-1', REF);
  assert.equal(advice.length, 1);
  assert.equal(advice[0].count, 2);
  const future = [
    complaint('CMP-101', 'cust-1', MC, '2026-10-25T10:00'),
    complaint('CMP-102', 'cust-1', MC, '2026-12-25T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints: future, tickets: [] }, 'cust-1', REF), []);
});

test('area-outage rows and other customers never leak into a customer\'s advice', () => {
  const complaints = [
    complaint('CMP-101', AREA_OUTAGE_CUSTOMER_ID, MC, '2026-10-20T10:00'),
    complaint('CMP-102', AREA_OUTAGE_CUSTOMER_ID, MC, '2026-10-25T10:00'),
    complaint('CMP-103', 'cust-2', MC, '2026-10-20T10:00'),
    complaint('CMP-104', 'cust-1', MC, '2026-10-21T10:00')
  ];
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints, tickets: [] }, AREA_OUTAGE_CUSTOMER_ID, REF), []);
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints, tickets: [] }, 'cust-1', REF), []);
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints, tickets: [] }, 'cust-2', REF), []);
});

test('custom-fault tickets carry no recorded category and never group', () => {
  const tickets = [
    ticket('TKT-101', 'cust-1', '', '2026-10-05T10:00', { customFault: 'Charger kharab' }),
    ticket('TKT-102', 'cust-1', '', '2026-10-25T10:00', { customFault: 'Charger kharab' })
  ];
  assert.equal(ticketFaultGroup(tickets[0]), null);
  assert.deepEqual(rootCauseAdviceForCustomer({ complaints: [], tickets }, 'cust-1', REF), []);
  assert.equal(complaintFaultGroup({ issueCategory: MC }), MC);
  assert.equal(ticketFaultGroup({ faultPreset: MC_PRESET }), MC);
});

test('read-only: deriving advice and rendering the banner mutate nothing', () => {
  const ledgers = {
    complaints: [
      complaint('CMP-101', 'cust-1', MC, '2026-10-05T10:00'),
      complaint('CMP-102', 'cust-1', MC, '2026-10-25T10:00')
    ],
    tickets: [ticket('TKT-101', 'cust-1', MC_PRESET, '2026-10-06T10:00', { complaintId: 'CMP-101' })]
  };
  const before = JSON.stringify(ledgers);
  const advice = rootCauseAdviceForCustomer(deepFreeze(ledgers), 'cust-1', REF);
  assert.equal(advice.length, 1);
  assert.ok(rootCauseBannerHtml(advice).length > 0);
  assert.equal(JSON.stringify(ledgers), before);
  assert.equal(rootCauseBannerHtml([]), '');
});

test('i18n: every key the advisor and its surfaces use exists in en AND ur', () => {
  const advisorSource = readFileSync(new URL('../root-cause-advisor.js', import.meta.url), 'utf8');
  const used = new Set([...advisorSource.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  for (const fixKey of Object.values(ROOT_CAUSE_FIX_KEYS)) used.add(fixKey);
  assert.ok(used.size >= 10, 'audit actually collected the rca keys');
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  // No raw key may leak into an Urdu banner either.
  const banner = rootCauseBannerHtml(rootCauseAdviceForCustomer({
    complaints: [
      complaint('CMP-101', 'cust-1', MC, '2026-10-05T10:00'),
      complaint('CMP-102', 'cust-1', MC, '2026-10-25T10:00')
    ],
    tickets: []
  }, 'cust-1', REF));
  assert.ok(!banner.includes('rca_'), 'banner renders strings, never raw keys');
});

test('wiring: profile, register modal and ticket modal all consume the one derivation', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const registerSource = readFileSync(new URL('../complaint-register.js', import.meta.url), 'utf8');
  const ticketsSource = readFileSync(new URL('../complaint-tickets.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes("from './root-cause-advisor.js'"), 'app.js imports the advisor');
  assert.ok(appSource.includes('rootCauseBannerHtml(rootCauseAdviceForCustomer('), 'profile renders the banner');
  assert.equal(appSource.split('getRootCauseAdvice: (customerId)').length - 1, 2, 'both modal setups receive the host callback');
  assert.ok(registerSource.includes('getRootCauseAdvice'), 'register modal accepts the callback');
  assert.ok(registerSource.includes('rootCauseBannerHtml'), 'register cards render the banner');
  assert.ok(ticketsSource.includes('getRootCauseAdvice'), 'ticket modal accepts the callback');
  assert.ok(ticketsSource.includes('rootCauseBannerHtml'), 'ticket cards render the banner');
  // Perf budget (#219): the advisor is bundled through the existing
  // import graph only — it must never become a new entry file.
  assert.ok(!ENTRY_FILES.includes('root-cause-advisor.js'), 'advisor is not a build entry');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const bannerCss = css.slice(css.indexOf('.root-cause-banner'), css.indexOf('.root-cause-banner') + 700);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(bannerCss), 'banner CSS is token-only, no hex');
});
