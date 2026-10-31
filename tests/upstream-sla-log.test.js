// SISP-117: Upstream Provider (Main Uplink / NayaPay Down) Outage SLA &
// Rebate Claim Log. Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): logging two Main Uplink / NayaPay Down
// incidents (3.5h + 2.5h = 6.0h) aggregates 6.0h in the Upstream Claim
// log and exports both timestamps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COMPLAINT_CATEGORIES,
  sanitizeComplaints
} from '../complaint-register.js';
import {
  UPSTREAM_TEMPLATE_ID,
  sanitizeOverheads
} from '../fixed-overheads.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  UPSTREAM_SLA_CATEGORY,
  UPSTREAM_SLA_CSV_HEADERS,
  buildUpstreamSlaCsv,
  buildUpstreamSlaLog,
  monthHoursFor,
  resolveUpstreamBandwidthBill,
  upstreamIncidentDurationHours,
  upstreamSlaCsvFilename,
  upstreamSlaCsvRows
} from '../upstream-sla-log.js';

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'AREA_OUTAGE',
  customerName: 'AREA_OUTAGE',
  zone: 'Shahdara Town',
  issueCategory: 'Main Uplink / NayaPay Down',
  reportedAt: '2026-10-03T01:00',
  resolvedAt: '2026-10-03T04:30',
  downtimeHours: 3.5,
  downtimeManual: false,
  status: 'Resolved',
  resolutionNote: 'Upstream restored',
  resolvedViaTicketId: '',
  syncReopenGuard: '',
  createdAt: '',
  ...overrides
});

// The SISP-27 store shapes, sanitized through the real sanitizer: the
// month's live posting (its expense must exist in state.expenses) and/or
// the recorded default amount for the upstream template.
const overheadsWithPosting = (amount = 35000, month = '2026-10') => sanitizeOverheads({
  templates: [],
  postings: [{ id: 'post-1', templateId: UPSTREAM_TEMPLATE_ID, month, expenseId: 'exp-1', amount, date: `${month}-05`, note: '' }]
});
const overheadsWithDefault = (amount = 35000) => sanitizeOverheads({
  templates: [{ id: UPSTREAM_TEMPLATE_ID, defaultAmount: amount }],
  postings: []
});
const stateWithExpense = { customers: [], expenses: [{ id: 'exp-1', date: '2026-10-05', category: 'Nayatel bill', amount: 35000 }] };
const emptyState = { customers: [], expenses: [] };

const specIncidents = () => [
  complaint({ id: 'CMP-101', reportedAt: '2026-10-03T01:00', resolvedAt: '2026-10-03T04:30', downtimeHours: 3.5 }),
  complaint({ id: 'CMP-102', reportedAt: '2026-10-14T22:00', resolvedAt: '2026-10-15T00:30', downtimeHours: 2.5 })
];

test('category is the register\'s one real upstream category — no invented value', () => {
  assert.equal(UPSTREAM_SLA_CATEGORY, 'Main Uplink / NayaPay Down');
  assert.ok(COMPLAINT_CATEGORIES.includes(UPSTREAM_SLA_CATEGORY));
  // The register sanitizer itself carries the category through unchanged.
  const [clean] = sanitizeComplaints([complaint()]);
  assert.equal(clean.issueCategory, UPSTREAM_SLA_CATEGORY);
});

test('SPEC PIN: two upstream incidents 3.5h + 2.5h aggregate 6.0h; availability + rebate derive from 6.0h; CSV exports both timestamps', () => {
  const claim = buildUpstreamSlaLog(specIncidents(), overheadsWithPosting(35000), stateWithExpense, '2026-10');
  assert.equal(claim.incidentCount, 2);
  assert.equal(claim.measuredCount, 2);
  assert.equal(claim.ongoingCount, 0);
  assert.equal(claim.totalDowntimeHours, 6);
  assert.equal(claim.monthHours, 744); // October: 31 days × 24
  // Availability = (744 − 6) / 744 × 100 = 99.1935… → 99.19 (2 dp).
  assert.equal(claim.availabilityPct, 99.19);
  // Rebate base read from the live SISP-27 posting, never hardcoded.
  assert.equal(claim.bandwidthBill.amount, 35000);
  assert.equal(claim.bandwidthBill.source, 'posting');
  // Pro-rata rebate: round(35000 × 6 / 744) = round(282.258…) = 282.
  assert.equal(claim.suggestedRebate, 282);
  const csv = buildUpstreamSlaCsv(claim);
  assert.ok(csv.includes('2026-10-03T01:00'), 'first incident reported timestamp exported');
  assert.ok(csv.includes('2026-10-03T04:30'), 'first incident resolved timestamp exported');
  assert.ok(csv.includes('2026-10-14T22:00'), 'second incident reported timestamp exported');
  assert.ok(csv.includes('2026-10-15T00:30'), 'second incident resolved timestamp exported');
  assert.ok(csv.includes('6 h total upstream downtime'), 'totals ride in the NOTE row');
  assert.equal(upstreamSlaCsvFilename(claim), 'upstream-sla-claim-2026-10_filtered.csv');
  const rows = upstreamSlaCsvRows(claim);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].durationHours, 3.5);
  assert.equal(rows[1].durationHours, 2.5);
  assert.equal(UPSTREAM_SLA_CSV_HEADERS.length, 9);
});

test('only the upstream category in the reported month counts — other causes and other months are excluded', () => {
  const list = [
    ...specIncidents(),
    complaint({ id: 'CMP-103', issueCategory: 'Fiber Cut', downtimeHours: 9 }),
    complaint({ id: 'CMP-104', issueCategory: 'WAPDA / Power Outage', downtimeHours: 9 }),
    complaint({ id: 'CMP-105', reportedAt: '2026-09-03T01:00', resolvedAt: '2026-09-03T04:30', downtimeHours: 9 })
  ];
  const claim = buildUpstreamSlaLog(list, overheadsWithPosting(), stateWithExpense, '2026-10');
  assert.equal(claim.incidentCount, 2);
  assert.equal(claim.totalDowntimeHours, 6);
  const september = buildUpstreamSlaLog(list, overheadsWithPosting(), stateWithExpense, '2026-09');
  assert.equal(september.incidentCount, 1);
  assert.equal(september.totalDowntimeHours, 9);
  assert.equal(september.monthHours, 720); // September: 30 × 24
});

test('unresolved incident: listed as ongoing/unmeasured, contributes 0 hours — no time is fabricated', () => {
  const list = [
    ...specIncidents(),
    complaint({ id: 'CMP-106', status: 'In Progress', reportedAt: '2026-10-20T09:00', resolvedAt: '', downtimeHours: null })
  ];
  const claim = buildUpstreamSlaLog(list, overheadsWithPosting(), stateWithExpense, '2026-10');
  assert.equal(claim.incidentCount, 3);
  assert.equal(claim.measuredCount, 2);
  assert.equal(claim.ongoingCount, 1);
  assert.equal(claim.totalDowntimeHours, 6);
  const ongoing = claim.incidents.find((row) => row.id === 'CMP-106');
  assert.equal(ongoing.durationHours, null);
  assert.equal(ongoing.measured, false);
  const csvRow = upstreamSlaCsvRows(claim).find((row) => row.id === 'CMP-106');
  assert.equal(csvRow.durationHours, '');
  assert.equal(csvRow.resolvedAt, '');
});

test('duration rule: stored hours win (manual override), timestamp fallback only for a Resolved record with no stored hours', () => {
  // Manual override 5h while the timestamps imply 2h — the stored value wins.
  assert.equal(upstreamIncidentDurationHours(complaint({
    reportedAt: '2026-10-03T01:00', resolvedAt: '2026-10-03T03:00', downtimeHours: 5, downtimeManual: true
  })), 5);
  // Resolved, stored hours missing → the register's own reported→resolved math.
  assert.equal(upstreamIncidentDurationHours(complaint({
    reportedAt: '2026-10-03T01:00', resolvedAt: '2026-10-03T02:30', downtimeHours: null
  })), 1.5);
  // Open with no resolution → unmeasured, never measured to "now".
  assert.equal(upstreamIncidentDurationHours(complaint({
    status: 'Open', resolvedAt: '', downtimeHours: null
  })), null);
  // The whole log agrees: override month totals 5, not 2.
  const claim = buildUpstreamSlaLog([
    complaint({ reportedAt: '2026-10-03T01:00', resolvedAt: '2026-10-03T03:00', downtimeHours: 5, downtimeManual: true })
  ], overheadsWithDefault(), emptyState, '2026-10');
  assert.equal(claim.totalDowntimeHours, 5);
});

test('overlapping incidents sum per incident (SISP-16 precedent — no union, so both analytics views agree)', () => {
  const list = [
    complaint({ id: 'CMP-101', reportedAt: '2026-10-03T01:00', resolvedAt: '2026-10-03T05:00', downtimeHours: 4 }),
    complaint({ id: 'CMP-102', reportedAt: '2026-10-03T03:00', resolvedAt: '2026-10-03T05:00', downtimeHours: 2 })
  ];
  const claim = buildUpstreamSlaLog(list, overheadsWithDefault(), emptyState, '2026-10');
  assert.equal(claim.totalDowntimeHours, 6);
});

test('rebate base: recorded default when no live posting; stale posting (expense deleted) falls back to the default', () => {
  const fromDefault = buildUpstreamSlaLog(specIncidents(), overheadsWithDefault(35000), emptyState, '2026-10');
  assert.equal(fromDefault.bandwidthBill.amount, 35000);
  assert.equal(fromDefault.bandwidthBill.source, 'default');
  assert.equal(fromDefault.suggestedRebate, 282);

  // Posting exists but its expense was deleted from the ledger → stale,
  // so the recorded default (20000) is the base instead of the posting.
  const stale = resolveUpstreamBandwidthBill(
    sanitizeOverheads({
      templates: [{ id: UPSTREAM_TEMPLATE_ID, defaultAmount: 20000 }],
      postings: [{ id: 'post-9', templateId: UPSTREAM_TEMPLATE_ID, month: '2026-10', expenseId: 'gone', amount: 35000, date: '2026-10-05', note: '' }]
    }),
    emptyState,
    '2026-10'
  );
  assert.equal(stale.amount, 20000);
  assert.equal(stale.source, 'default');

  // A posting for a DIFFERENT month is not this month's bill.
  const otherMonth = buildUpstreamSlaLog(specIncidents(), overheadsWithPosting(35000, '2026-09'), stateWithExpense, '2026-10');
  assert.equal(otherMonth.bandwidthBill.amount, null);
  assert.equal(otherMonth.suggestedRebate, null);
});

test('no recorded bandwidth bill: rebate unavailable (null), never fabricated — availability still computed', () => {
  const claim = buildUpstreamSlaLog(specIncidents(), sanitizeOverheads({ templates: [], postings: [] }), emptyState, '2026-10');
  assert.equal(claim.bandwidthBill.amount, null);
  assert.equal(claim.bandwidthBill.source, null);
  assert.equal(claim.suggestedRebate, null);
  assert.equal(claim.availabilityPct, 99.19);
  assert.ok(buildUpstreamSlaCsv(claim).includes('suggested rebate unavailable'));
});

test('read-only: building the log and the CSV mutates nothing (byte-for-byte state pin)', () => {
  const complaints = [...specIncidents(), complaint({ id: 'CMP-106', status: 'Open', resolvedAt: '', downtimeHours: null })];
  const overheads = overheadsWithPosting();
  const state = { customers: [], expenses: [{ id: 'exp-1', date: '2026-10-05', category: 'Nayatel bill', amount: 35000 }] };
  const before = JSON.stringify({ complaints, overheads, state });
  const claim = buildUpstreamSlaLog(complaints, overheads, state, '2026-10');
  buildUpstreamSlaCsv(claim);
  assert.equal(JSON.stringify({ complaints, overheads, state }), before);
});

test('month helpers + invalid month: real calendar hours, zeroed log, no crash', () => {
  assert.equal(monthHoursFor('2026-10'), 744);
  assert.equal(monthHoursFor('2026-02'), 672); // Feb 2026: 28 days
  assert.equal(monthHoursFor('2024-02'), 696); // leap year: 29 days
  assert.equal(monthHoursFor(''), null);
  assert.equal(monthHoursFor('2026-13'), null);
  const claim = buildUpstreamSlaLog(specIncidents(), overheadsWithDefault(), emptyState, '');
  assert.equal(claim.incidentCount, 0);
  assert.equal(claim.availabilityPct, null);
  assert.equal(claim.suggestedRebate, null);
});

test('empty month: zero incidents, 100% availability, rebate 0 when a bill is recorded', () => {
  const claim = buildUpstreamSlaLog([], overheadsWithDefault(), emptyState, '2026-10');
  assert.equal(claim.incidentCount, 0);
  assert.equal(claim.totalDowntimeHours, 0);
  assert.equal(claim.availabilityPct, 100);
  assert.equal(claim.suggestedRebate, 0);
});

test('i18n audit: every t() key in the module + every upsla data-i18n key in the new dialog/card exists in en AND ur', () => {
  const moduleSource = fs.readFileSync(new URL('../upstream-sla-log.js', import.meta.url), 'utf8');
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const match of moduleSource.matchAll(/\bt\('([a-z0-9_]+)'/g)) keys.add(match[1]);
  for (const match of appSource.matchAll(/\bt\('(dash_upsla[a-z0-9_]*|dash_card_upsla)'/g)) keys.add(match[1]);
  const dialogBlock = html.slice(html.indexOf('id="upstreamSlaModal"'), html.indexOf('id="upstreamSlaModal"') + 3000);
  for (const match of dialogBlock.matchAll(/data-i18n="([a-z0-9_]+)"/g)) keys.add(match[1]);
  const cardBlock = html.slice(html.indexOf('summary-upstream-sla'), html.indexOf('summary-upstream-sla') + 1200);
  for (const match of cardBlock.matchAll(/data-i18n="([a-z0-9_]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 25, `expected at least 25 audited keys, found ${keys.size}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});

test('wiring: app.js imports the module, index.html carries the card + dialog with every id the controller queries', () => {
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/upstream-sla-log\.js'/);
  assert.match(appSource, /setupUpstreamSlaModal\(/);
  assert.match(appSource, /buildUpstreamSlaLog\(loadComplaints\(\), loadOverheads\(\)/);
  for (const id of [
    'dashboardUpslaValue', 'dashboardUpslaPeriod', 'upstreamSlaSummary', 'openUpstreamSlaModalBtn',
    'upstreamSlaModal', 'upstreamSlaModalTitle', 'upstreamSlaCloseBtn', 'upstreamSlaMonth',
    'upstreamSlaSummaryLine', 'upstreamSlaTotals', 'upstreamSlaIncidentList', 'upstreamSlaExportBtn'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  // The dialog rides the shared billing-modal shell (var(--modal-surface)).
  assert.match(html, /<dialog id="upstreamSlaModal" class="billing-modal upstream-sla-modal"/);
});
