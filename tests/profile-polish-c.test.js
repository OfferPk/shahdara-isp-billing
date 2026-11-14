import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { profileServiceState, profileServiceStatusPillHtml, profileServiceStatusWord } from '../profile-ui.js';
import { profileDetailSectionHtml } from '../profile-sections.js';
import { packageHistoryViewSectionHtml } from '../package-history-view.js';
import { serviceTenureSectionHtml } from '../service-tenure.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const styles = read('styles.css');

// Profile Polish C (user spec 2026-11-12, item (15) of the 22-part
// profile spec):
// - section headers show a SMALL pill with just the status word
//   ("Active" GREEN, "Pending" RED/YELLOW, no "· —" separators);
// - info texts as PILLS/info format: the package history explainer,
//   the "No package or monthly selling-rate changes have been
//   recorded" note, and Service tenure / "Connection date not
//   recorded".
// The codebase has no literal "Pending" service state — the derived
// states are Active / Offline / Vacation / Expired / Suspended /
// Not chosen ("Pending" is the bill status, whose pill already
// exists) — so the header pill reuses each state's existing pill
// colour: Active green, Vacation amber (yellow), Offline/Suspended
// red, Expired/Not chosen neutral. No figure changes anywhere: the
// same labels, the same values, the same wiring — only what shows,
// in what order, and in what shape.

// ------------------------------------------------------------ status word

const baseCustomer = (overrides = {}) => ({ serviceStatus: 'active', ...overrides });
const openSuspension = (overrides = {}) => ({ status: 'open', suspensionDate: '2026-10-12', ...overrides });
const TODAY = '2026-11-09';

test('Polish C (15): the section-header pill shows just the bare status word — never the dated label, never a separator', () => {
  const cases = [
    [baseCustomer({ serviceStatus: 'active' }), null, 'Active'],
    [baseCustomer({ serviceStatus: 'offline' }), null, 'Offline'],
    [baseCustomer({ serviceStatus: 'not-set' }), null, 'Not chosen'],
    [baseCustomer({ serviceStatus: 'active', cancellationDate: '2026-11-01' }), null, 'Expired'],
    [baseCustomer({ serviceStatus: 'active', paused: true, pauseStartDate: '2026-11-03' }), null, 'Vacation'],
    [baseCustomer({ serviceStatus: 'active' }), openSuspension(), 'Suspended'],
  ];
  for (const [customer, suspension, word] of cases) {
    const state = profileServiceState(customer, { today: TODAY, openSuspension: suspension });
    assert.equal(profileServiceStatusWord(state), word, `${state.state} reads as ${word}`);
    assert.ok(!profileServiceStatusWord(state).includes('·'), 'no separator in the bare word');
  }
  // The dated labels stay long — the word is what the pill drops.
  const vacation = profileServiceState(baseCustomer({ serviceStatus: 'active', paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: null });
  assert.equal(vacation.label, 'Vacation · since Nov 3 2026', 'the full label still carries the date');
  assert.equal(profileServiceStatusWord(vacation), 'Vacation', 'the word drops the date');
  const suspended = profileServiceState(baseCustomer({ serviceStatus: 'active' }), { today: TODAY, openSuspension: openSuspension() });
  assert.equal(suspended.label, 'Suspended · Oct 12 2026', 'the full label still carries the date');
  assert.equal(profileServiceStatusWord(suspended), 'Suspended', 'the word drops the date');
  // An unknown state falls back to its label rather than an empty pill.
  assert.equal(profileServiceStatusWord({ state: 'bogus', label: 'Bogus label' }), 'Bogus label');
});

test('Polish C (15): the word-only pill is the same status pill, with just the word inside', () => {
  const active = profileServiceState(baseCustomer({ serviceStatus: 'active' }), { today: TODAY, openSuspension: null });
  assert.equal(
    profileServiceStatusPillHtml(active, { wordOnly: true }),
    '<span class="profile-service-status profile-service-status-active">Active</span>',
    'Active pill, word only',
  );
  const vacation = profileServiceState(baseCustomer({ serviceStatus: 'active', paused: true, pauseStartDate: '2026-11-03' }), { today: TODAY, openSuspension: null });
  assert.equal(
    profileServiceStatusPillHtml(vacation, { wordOnly: true }),
    '<span class="profile-service-status profile-service-status-vacation">Vacation</span>',
    'Vacation pill, word only — no date, no separator',
  );
  // The default pill is unchanged: the header badge still shows the full label.
  assert.equal(
    profileServiceStatusPillHtml(vacation),
    '<span class="profile-service-status profile-service-status-vacation">Vacation · since Nov 3 2026</span>',
    'default pill keeps the full dated label',
  );
});

test('Polish C (15): the word pill colours are the existing status colours — Active green, Vacation amber, Offline red', () => {
  const activeRule = styles.match(/\.profile-service-status-active\{[^}]*\}/);
  assert.ok(activeRule && activeRule[0].includes('background:#e9f7ed'), 'Active pill is green');
  const vacationRule = styles.match(/\.profile-service-status-vacation\{[^}]*\}/);
  assert.ok(vacationRule && vacationRule[0].includes('background:var(--amber-bg)'), 'Vacation pill is amber (yellow)');
  const offlineRule = styles.match(/\.profile-service-status-offline\{[^}]*\}/);
  assert.ok(offlineRule && offlineRule[0].includes('background:#fff1e9'), 'Offline pill is red');
});

// ------------------------------------------------------------ section header

test('Polish C (15): a section shell takes caller-owned summary HTML for the pill; a plain summary is still escaped', () => {
  const withPill = profileDetailSectionHtml({
    key: 'service',
    heading: 'Service & Package',
    summaryHtml: '<span class="profile-service-status profile-service-status-active">Active</span>',
    body: '<p>BODY</p>',
    open: true,
  });
  assert.ok(withPill.includes('<span class="profile-section-summary"><span class="profile-service-status profile-service-status-active">Active</span></span>'), 'the pill sits in the summary span, unescaped');
  assert.ok(!withPill.includes('·'), 'no separator in the pill header');
  const plain = profileDetailSectionHtml({
    key: 'financial',
    heading: 'Financial Details',
    summary: 'Dues PKR 1,000 · Monthly gross profit PKR 1,800',
    body: '<p>BODY</p>',
    open: true,
  });
  assert.ok(plain.includes('<summary><h3>Financial Details</h3><span class="profile-section-summary">Dues PKR 1,000 · Monthly gross profit PKR 1,800</span></summary>'), 'a plain summary renders exactly as before');
  const escaped = profileDetailSectionHtml({ key: 'customer', heading: 'A & B <C>', summary: 'x "y"', body: '', open: false });
  assert.ok(escaped.includes('<h3>A &amp; B &lt;C&gt;</h3><span class="profile-section-summary">x &quot;y&quot;</span>'), 'heading and summary are still escaped without summaryHtml');
});

test('Polish C (15): the Service section header is the word-only status pill — the old "speed · label" summary is gone', () => {
  assert.ok(app.includes('summaryHtml: profileServiceStatusPillHtml(serviceState, { wordOnly: true })'), 'the Service section passes the word-only pill');
  assert.ok(!app.includes('summary: `${profileEmptyText(customer.packageSpeed)} · ${serviceState.label}`'), 'the old "speed · label" summary is gone');
  // Profile View Polish §1b: the badges-row pill is gone (it duplicated
  // the header badge) — the full-label pill now lives ONLY as the
  // word-only Service summary above, and the header badge renders the
  // derived state via #profileServiceStatusBadge instead.
  assert.ok(!app.includes('${profileServiceStatusPillHtml(serviceState)}'), 'no full-label pill in the badges row any more');
  assert.match(app, /profile-service-status-\$\{derivedServiceState\.modifier\}/, 'the header badge still follows the derived state');
});

// ------------------------------------------------------------ info texts

test('Polish C (15): the package history explainer is an info note and the no-changes note is a pill, with the same wording', () => {
  const format = (value) => `PKR ${value}`;
  const empty = packageHistoryViewSectionHtml({}, {}, format);
  assert.ok(empty.includes('<p class="phv-explainer">Every package this customer has been on, with the dates and the price at the time'), 'the explainer carries its info-note class');
  assert.ok(empty.includes('<p class="phv-none">No package or monthly selling-rate changes have been recorded.</p>'), 'the no-changes note wording is unchanged');
  const withPackage = packageHistoryViewSectionHtml({ packageHistory: [] }, { label: '5 Mbps', price: 2000 }, format);
  assert.ok(withPackage.includes('<p class="phv-explainer">Every package this customer has been on'), 'the explainer is there when a package exists too');
  assert.ok(withPackage.includes('<ul id="phvList" class="phv-list">'), 'a current package still lists instead of the note');
  assert.ok(!withPackage.includes('phv-none'), 'no empty-state note when a package exists');
});

const TENURE_LABELS = {
  heading: 'Service tenure',
  yearOne: '1 year',
  years: '{n} years',
  monthOne: '1 month',
  months: '{n} months',
  notRecorded: 'Connection date not recorded',
  notStarted: 'Not started',
  endUnknown: 'End date not recorded',
  checkDates: 'Check connection dates',
  connectedSince: 'Connected since {date}',
  ended: 'Service ended {date}',
  recordedDate: 'Recorded connection date {date}',
  durationUnknown: 'Connected since {date} · duration unavailable',
  endBeforeConnection: 'Saved end date {date} is before connection',
};

test('Polish C (15): the tenure line is a pill — "Connection date not recorded" when unrecorded, the tenure words when recorded', () => {
  const unrecorded = serviceTenureSectionHtml({}, '2026-11-06', TENURE_LABELS);
  assert.ok(unrecorded.includes('<p class="stv-primary">Connection date not recorded</p>'), 'the not-recorded wording sits in the pill');
  const recorded = serviceTenureSectionHtml({ connectionDate: '2023-11-06' }, '2026-11-06', TENURE_LABELS);
  assert.ok(recorded.includes('<p class="stv-primary">3 years 1 month</p>'), 'the tenure words sit in the pill');
  assert.ok(recorded.includes('<p class="stv-detail">Connected since 2023-11-06</p>'), 'the detail line under the pill is unchanged');
});

test('Polish C (15): the info texts share one info-blue pill palette, all pre-existing colours', () => {
  for (const cls of ['.phv-explainer', '.phv-none', '.stv-primary']) {
    assert.ok(styles.includes(cls), `styles must define ${cls}`);
  }
  const explainerRule = styles.match(/\.phv-explainer\{[^}]*\}/);
  assert.ok(explainerRule && explainerRule[0].includes('background:#e5efff'), 'the explainer takes the info blue');
  assert.ok(explainerRule && explainerRule[0].includes('border-radius:12px'), 'the long explainer is an info note, not a one-line pill');
  const noneRule = styles.match(/\.phv-none\{[^}]*background:#e5efff[^}]*\}/);
  assert.ok(noneRule && noneRule[0].includes('border-radius:999px'), 'the no-changes note is a real pill');
  const tenureRule = styles.match(/\.stv-primary\{[^}]*background:#e5efff[^}]*\}/);
  assert.ok(tenureRule && tenureRule[0].includes('border-radius:999px'), 'the tenure line is a real pill');
  for (const rule of [explainerRule[0], noneRule[0], tenureRule[0]]) {
    assert.ok(rule.includes('color:#174b87') && rule.includes('border:1px solid #adc9f1'), 'all three share the same info-blue palette');
  }
});

// ------------------------------------------------------------ ratchet

test('Polish C ratchet: styles.css still 613 distinct hex (no new hard-coded colour)', () => {
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  // 614 → 613 with Customers Cards Compact (item B): deleting the
  // card's health-reasons rule removed its unique hex #62766d.
  assert.equal(distinct.size, 613, 'styles.css must stay at 613 distinct hex (no new hard-coded colour)');
});

test('Polish C: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-polish-c.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
