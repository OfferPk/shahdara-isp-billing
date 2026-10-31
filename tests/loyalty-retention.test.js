/**
 * loyalty-retention.test.js — SISP-90: Customer Tenure (12+ Months)
 * Loyalty Badge & At-Risk Churn Alert.
 *
 * Pins (synthetic data only):
 *  - Tenure: whole calendar months from the recorded connectionDate
 *    (uptime-tracking's summarizeProfileAge); the addedOn fallback is
 *    labelled basis 'profile'; no dates -> no tenure; a future start
 *    -> no tenure; an ended connection reports the months it ran.
 *  - SPEC PIN 1: 14-month tenure + 2 complaints this month -> flagged
 *    At-Risk (register-only, and 1 register + 1 ticket cross-source).
 *  - SPEC PIN 2: 14-month tenure + 0 complaints / no downtime ->
 *    loyal badge only, NOT in the panel.
 *  - SPEC PIN 3: 11-month tenure + 3 complaints -> NOT in the panel
 *    (tenure gate), and no badge.
 *  - Downtime: >= 720 unioned minutes this month flags on its own;
 *    690 minutes does not; exactly 720 does; an incident period also
 *    present in the status history is unioned, never double-counted.
 *  - Complaint month rules: reportedAt (PKT wall clock) decides;
 *    createdAt-only records are read in Pakistan time (Sep 30 20:30Z
 *    is Oct 1 in PKT and counts; Oct 31 20:00Z is Nov 1 and does
 *    not); last month's complaints never count; other customers' and
 *    area-outage records never count; all statuses count.
 *  - Exclusions: archived and 'not-set' customers never appear;
 *    serviceStatus 'offline' loyal customers DO appear; FREE loyal
 *    customers DO appear (loyalty is tenure, not fees).
 *  - Sort: most complaints, then most downtime, then longest tenure,
 *    then lowest customer number.
 *  - Read-only: building the panel mutates nothing.
 *  - Badge: loyaltyBadgeHtml renders the crown badge only at 12+
 *    months of proven tenure.
 *  - i18n: every loyalty_* key used in app.js / profile-ui.js /
 *    index.html exists in en + ur; badge CSS is token-only.
 *  - Wiring: dashboard section + list in index.html, app.js renders
 *    via buildAtRiskLoyalCustomers and puts the badge on the customer
 *    card and the profile heading, build.mjs keeps loyalty-retention
 *    out of ENTRY_FILES (app.js-only import, dist stays 25).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LOYALTY_MIN_TENURE_MONTHS, AT_RISK_MIN_COMPLAINTS_THIS_MONTH, AT_RISK_MIN_DOWNTIME_MINUTES,
  customerTenure, loyaltyInfoForCustomer, complaintMonthOf, ticketMonthOf,
  countComplaintsInMonth, downtimeMinutesInMonth,
  buildAtRiskLoyalCustomers, atRiskRowForCustomer, buildLoyaltySummary
} from '../loyalty-retention.js';
import { loyaltyBadgeHtml } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-29T12:00:00+05:00'); // PKT month 2026-10

function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Test Loyal', phone: '03001234567',
    mohalla: 'BARRIAN', serviceStatus: 'active', archived: false,
    isFreeConnection: false, connectionDate: '2025-08-10', addedOn: '2025-08-10',
    bills: [], incidents: [], serviceStatusHistory: [], ...overrides
  };
}
function complaint(id, customerId, extra = {}) {
  return { id, customerId, issueCategory: 'No Internet', status: 'Open', reportedAt: '2026-10-12T09:30', createdAt: '2026-10-12T04:30:00.000Z', ...extra };
}
function ticket(id, customerId, extra = {}) {
  return { id, customerId, faultPreset: 'No Signal', status: 'Open', createdAt: '2026-10-20T11:00', ...extra };
}
const state = (customers) => ({ customers });

test('tenure: whole months from connectionDate, labelled connection basis', () => {
  const tenure = customerTenure(customer(), REF);
  assert.equal(tenure.months, 14);
  assert.equal(tenure.basis, 'connection');
  assert.equal(tenure.startDate, '2025-08-10');
  const info = loyaltyInfoForCustomer(customer(), REF);
  assert.equal(info.isLoyal, true);
  assert.equal(info.tenureMonths, 14);
});

test('tenure: addedOn fallback is labelled profile basis, never hidden', () => {
  const c = customer({ connectionDate: '', addedOn: '2025-06-05' });
  const tenure = customerTenure(c, REF);
  assert.equal(tenure.months, 16);
  assert.equal(tenure.basis, 'profile');
  assert.equal(loyaltyInfoForCustomer(c, REF).tenureBasis, 'profile');
});

test('tenure: no recorded start -> no tenure, no loyalty; future start -> no tenure', () => {
  const none = customer({ connectionDate: '', addedOn: '' });
  assert.equal(customerTenure(none, REF).months, null);
  assert.equal(loyaltyInfoForCustomer(none, REF).isLoyal, false);
  const future = customer({ connectionDate: '2027-01-01', addedOn: '2027-01-01' });
  assert.equal(customerTenure(future, REF).months, null);
  assert.equal(loyaltyInfoForCustomer(future, REF).isLoyal, false);
});

test('tenure: exactly 12 months is loyal; 11 months is not', () => {
  const twelve = customer({ connectionDate: '2025-10-29', addedOn: '2025-10-29' });
  assert.equal(customerTenure(twelve, REF).months, 12);
  assert.equal(loyaltyInfoForCustomer(twelve, REF).isLoyal, true);
  const eleven = customer({ connectionDate: '2025-11-15', addedOn: '2025-11-15' });
  assert.equal(customerTenure(eleven, REF).months, 11);
  assert.equal(loyaltyInfoForCustomer(eleven, REF).isLoyal, false);
  assert.equal(LOYALTY_MIN_TENURE_MONTHS, 12);
});

test('SPEC PIN 1: 14-month tenure + 2 register complaints this month -> flagged', () => {
  const c = customer();
  const complaints = [complaint('r1', 'c1'), complaint('r2', 'c1', { reportedAt: '2026-10-25T18:05', status: 'Resolved' })];
  const rows = buildAtRiskLoyalCustomers(state([c]), { complaints, tickets: [] }, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].customerId, 'c1');
  assert.equal(rows[0].tenureMonths, 14);
  assert.equal(rows[0].complaintsThisMonth, 2);
  assert.deepEqual(rows[0].complaintBreakdown, { total: 2, register: 2, tickets: 0 });
  assert.deepEqual(rows[0].reasons, ['complaints']);
  assert.equal(buildLoyaltySummary(rows).count, 1);
});

test('SPEC PIN 1b: 1 register complaint + 1 ticket this month also reaches the gate', () => {
  const c = customer();
  const rows = buildAtRiskLoyalCustomers(state([c]), { complaints: [complaint('r1', 'c1')], tickets: [ticket('t1', 'c1')] }, REF);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].complaintBreakdown, { total: 2, register: 1, tickets: 1 });
  assert.equal(AT_RISK_MIN_COMPLAINTS_THIS_MONTH, 2);
});

test('SPEC PIN 2: 14-month tenure + 0 complaints / no downtime -> badge only, not flagged', () => {
  const c = customer();
  const rows = buildAtRiskLoyalCustomers(state([c]), { complaints: [], tickets: [] }, REF);
  assert.equal(rows.length, 0);
  assert.equal(atRiskRowForCustomer(state([c]), c, { complaints: [], tickets: [] }, REF), null);
  assert.equal(loyaltyInfoForCustomer(c, REF).isLoyal, true);
  assert.match(loyaltyBadgeHtml(c, REF), /loyalty-badge/);
  assert.match(loyaltyBadgeHtml(c, REF), /👑/);
});

test('SPEC PIN 3: 11-month tenure + 3 complaints -> NOT flagged, no badge (tenure gate)', () => {
  const c = customer({ connectionDate: '2025-11-15', addedOn: '2025-11-15' });
  const complaints = [complaint('r1', 'c1'), complaint('r2', 'c1'), complaint('r3', 'c1')];
  const rows = buildAtRiskLoyalCustomers(state([c]), { complaints, tickets: [] }, REF);
  assert.equal(rows.length, 0);
  assert.equal(loyaltyBadgeHtml(c, REF), '');
});

test('downtime: 13h recorded incident this month flags on downtime alone', () => {
  const c = customer({ incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T21:00', note: 'Fiber cut' }] });
  assert.equal(downtimeMinutesInMonth(c, '2026-10', REF), 780);
  const rows = buildAtRiskLoyalCustomers(state([c]), { complaints: [], tickets: [] }, REF);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].reasons, ['downtime']);
  assert.equal(rows[0].downtimeMinutes, 780);
  assert.equal(rows[0].downtimeHours, 13);
  assert.equal(AT_RISK_MIN_DOWNTIME_MINUTES, 720);
});

test('downtime: 11h30m does not flag; exactly 12h does', () => {
  const under = customer({ incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T19:30', note: '' }] });
  assert.equal(downtimeMinutesInMonth(under, '2026-10', REF), 690);
  assert.equal(buildAtRiskLoyalCustomers(state([under]), {}, REF).length, 0);
  const exact = customer({ incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T20:00', note: '' }] });
  assert.equal(downtimeMinutesInMonth(exact, '2026-10', REF), 720);
  assert.equal(buildAtRiskLoyalCustomers(state([exact]), {}, REF).length, 1);
});

test('downtime: a period recorded as incident AND status span is unioned, never doubled', () => {
  const c = customer({
    incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T20:00', note: 'Recorded twice' }],
    serviceStatusHistory: [
      { status: 'active', at: '2026-10-01T09:00' },
      { status: 'offline', at: '2026-10-05T08:00' },
      { status: 'active', at: '2026-10-05T20:00' }
    ]
  });
  assert.equal(downtimeMinutesInMonth(c, '2026-10', REF), 720);
});

test('complaint months: reportedAt decides; last month never counts', () => {
  const c = customer();
  const lastMonth = complaint('r0', 'c1', { reportedAt: '2026-09-28T10:00', createdAt: '2026-09-28T05:00:00.000Z' });
  assert.equal(complaintMonthOf(lastMonth), '2026-09');
  const counts = countComplaintsInMonth(c, { complaints: [lastMonth, complaint('r1', 'c1')], tickets: [] }, '2026-10');
  assert.deepEqual(counts, { total: 1, register: 1, tickets: 0 });
});

test('complaint months: createdAt-only records are read in Pakistan time', () => {
  const c = customer();
  const pktOctober = complaint('r1', 'c1', { reportedAt: '', createdAt: '2026-09-30T20:30:00.000Z' }); // Oct 1 01:30 PKT
  const pktNovember = complaint('r2', 'c1', { reportedAt: '', createdAt: '2026-10-31T20:00:00.000Z' }); // Nov 1 01:00 PKT
  assert.equal(complaintMonthOf(pktOctober), '2026-10');
  assert.equal(complaintMonthOf(pktNovember), '2026-11');
  const counts = countComplaintsInMonth(c, { complaints: [pktOctober, pktNovember], tickets: [] }, '2026-10');
  assert.equal(counts.total, 1);
});

test('complaint months: other customers and area-outage records never count; ticket month parses', () => {
  const c = customer();
  const complaints = [complaint('r1', 'someone-else'), complaint('r2', 'AREA_OUTAGE')];
  const tickets = [ticket('t1', 'c1', { createdAt: '2026-09-30T23:59' }), ticket('t2', 'c1')];
  assert.equal(ticketMonthOf(tickets[1]), '2026-10');
  const counts = countComplaintsInMonth(c, { complaints, tickets }, '2026-10');
  assert.deepEqual(counts, { total: 1, register: 0, tickets: 1 });
});

test('exclusions: archived and not-set never appear; offline-status and FREE loyal customers do', () => {
  const two = [complaint('r1', 'x'), complaint('r2', 'x')];
  const archived = customer({ id: 'x', archived: true });
  assert.equal(buildAtRiskLoyalCustomers(state([archived]), { complaints: two }, REF).length, 0);
  const notSet = customer({ id: 'x', serviceStatus: 'not-set' });
  assert.equal(buildAtRiskLoyalCustomers(state([notSet]), { complaints: two }, REF).length, 0);
  const offline = customer({ id: 'x', serviceStatus: 'offline' });
  assert.equal(buildAtRiskLoyalCustomers(state([offline]), { complaints: two }, REF).length, 1);
  const free = customer({ id: 'x', isFreeConnection: true });
  assert.equal(buildAtRiskLoyalCustomers(state([free]), { complaints: two }, REF).length, 1);
});

test('sort: most complaints, then most downtime, then longest tenure, then lowest number', () => {
  const mk = (id, num, conn, extra = {}) => customer({ id, customerNumber: num, connectionDate: conn, addedOn: conn, ...extra });
  const a = mk('a', 5, '2025-08-10'); // 14 months, 2 complaints
  const b = mk('b', 3, '2024-08-10'); // 26 months, 2 complaints + 13h downtime
  const c = mk('c', 9, '2025-08-10', { incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T21:00', note: '' }] }); // 2 complaints + downtime
  const d = mk('d', 1, '2025-08-10'); // 3 complaints
  const complaints = [
    complaint('r1', 'a'), complaint('r2', 'a'),
    complaint('r3', 'b'), complaint('r4', 'b'),
    complaint('r5', 'c'), complaint('r6', 'c'),
    complaint('r7', 'd'), complaint('r8', 'd'), complaint('r9', 'd')
  ];
  const bDown = { ...b, incidents: [{ offlineAt: '2026-10-06T08:00', restoredAt: '2026-10-06T21:00', note: '' }] };
  const rows = buildAtRiskLoyalCustomers(state([a, bDown, c, d]), { complaints, tickets: [] }, REF);
  assert.deepEqual(rows.map((r) => r.customerId), ['d', 'b', 'c', 'a']);
});

test('read-only: building the panel mutates nothing', () => {
  const c = customer({ incidents: [{ offlineAt: '2026-10-05T08:00', restoredAt: '2026-10-05T21:00', note: 'Fiber cut' }] });
  const complaints = [complaint('r1', 'c1'), complaint('r2', 'c1')];
  const before = JSON.stringify({ c, complaints });
  buildAtRiskLoyalCustomers(state([c]), { complaints, tickets: [ticket('t1', 'c1')] }, REF);
  loyaltyInfoForCustomer(c, REF);
  assert.equal(JSON.stringify({ c, complaints }), before);
});

test('badge: renders only with 12+ months of proven tenure', () => {
  assert.match(loyaltyBadgeHtml(customer(), REF), /👑 1\+ Yr Loyal|loyalty-badge/);
  assert.equal(loyaltyBadgeHtml(customer({ connectionDate: '2026-05-01', addedOn: '2026-05-01' }), REF), '');
  assert.equal(loyaltyBadgeHtml(customer({ connectionDate: '', addedOn: '' }), REF), '');
  assert.equal(loyaltyBadgeHtml(null, REF), '');
});

test('i18n: every loyalty_* key used by the UI exists in en + ur and never echoes the key', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const profileSrc = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const src of [appSrc, profileSrc]) {
    for (const match of src.matchAll(/t\('(loyalty_[a-z_]+)'/g)) used.add(match[1]);
  }
  for (const match of indexSrc.matchAll(/data-i18n="(loyalty_[a-z_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 8, `expected >= 8 loyalty keys, got ${used.size}`);
  for (const lang of ['en', 'ur']) {
    for (const key of used) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${lang}:${key}`);
      assert.notEqual(TRANSLATIONS[lang][key], key);
    }
  }
});

test('wiring: dashboard panel, app render, card + profile badge, CSS tokens, dist budget', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const profileSrc = readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8');
  const cssSrc = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const buildSrc = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.match(indexSrc, /id="loyaltyAtRiskList"/);
  assert.match(indexSrc, /id="loyaltyAtRiskCount"/);
  assert.match(appSrc, /from '\.\/loyalty-retention\.js'/);
  assert.match(appSrc, /buildAtRiskLoyalCustomers\(state, \{ complaints: loadComplaints\(\), tickets: loadTickets\(\) \}, referenceDate\)/);
  assert.ok((appSrc.match(/loyaltyBadgeHtml\(customer\)/g) || []).length >= 2, 'badge on card + profile heading');
  assert.match(profileSrc, /export function loyaltyBadgeHtml/);
  const badgeRule = /\.loyalty-badge \{[^}]*\}/.exec(cssSrc);
  assert.ok(badgeRule, 'badge rule exists');
  assert.ok(!badgeRule[0].includes('#'), 'badge rule is token-only (no hex)');
  assert.ok(!/ENTRY_FILES = \[[^\]]*loyalty-retention\.js/.test(buildSrc), 'loyalty module stays app.js-only');
});
