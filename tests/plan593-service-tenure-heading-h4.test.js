// Plan 593 — Service tenure heading is an h4 like every other section.
//
// Decided (parent, all (a)/(b)/(c) as named):
//   D1(a) REWORD the acceptance to the measured census: "the tenure
//         heading is <h4>; the view contains 8 <h3>s (view heading +
//         7 detail-section summaries), 9 on the Info tab with
//         uptime; the detail-section demotions are a separate item."
//         The spec's "exactly one <h3>" is unachievable by this plan
//         alone — 9 <h3>s live inside the view today, 8 after the
//         demotion — so the scope is NOT widened to demote the seven
//         detail-section <h3>s or the uptime <h3> (Plan 594's item).
//   D2(c) 15px Manrope, the CLV/freshness section-heading treatment:
//         one rule `.stv-section h4{margin:0 0 6px;font:700 15px
//         Manrope,sans-serif}` in styles.css. The heading renders
//         at 15px Manrope after the fix; before it rendered at the
//         browser-default <h3> size, because no rule styled it.
//   D3(a) this new file. D4(a) live-browser heading walk (separate).
//   D5(b) CLV / freshness is the styling reference sibling.
//   D6(a) the dead `.package-history-section h3` rule is left
//         untouched and named in the PR body as pre-existing.
//
// Spec corrections recorded here (see the prep): the assembly is
// app.js:8705/:8726 on this base (not :6751); Plan 520 already
// merged (CLV is <h4>); "the only other <h3>" is false — the seven
// <details> sections, uptime, the manual log, and two sibling-panel
// headings all render <h3>.
//
// Fixtures reuse the plan360 generic shape (Customer One, Mohalla A,
// connection 2023-11-06) — no new customer data, no real names, no
// real phones, no phone numbers anywhere in this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serviceTenureSectionHtml } from '../service-tenure.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'service-tenure.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const sectionsSrc = readFileSync(join(dir, '..', 'profile-sections.js'), 'utf8');
const selfSrc = readFileSync(join(dir, 'plan593-service-tenure-heading-h4.test.js'), 'utf8');

function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    connectionDate: '2023-11-06',
    ...overrides,
  };
}

const LABELS = {
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

// G1 — Inventory: the demoted heading, the view heading, the order.

test('Plan 593: tenure section renders an h4 and no h3 anywhere in its output', () => {
  const html = serviceTenureSectionHtml(customer(), '2026-11-06', LABELS);
  assert.ok(html.includes('<h4>Service tenure</h4>'), 'the heading is an h4');
  assert.ok(!html.includes('<h3'), 'no h3 opens in the tenure output');
  assert.ok(!html.includes('</h3>'), 'no h3 closes in the tenure output');
  assert.equal((moduleSrc.match(/<h4/g) || []).length, 1, 'exactly one h4 in the module');
  assert.equal((moduleSrc.match(/<h3/g) || []).length, 0, 'no h3 left in the module');
});

test('Plan 593: view heading stays h3 and the Service body order is unchanged', () => {
  const viewLine = appSrc.split('\n').find((line) => line.includes("$('#customerProfileView').innerHTML"));
  assert.ok(viewLine, 'the view assembly line exists');
  assert.ok(viewLine.includes("<h3>${t('prof_view_heading')}</h3>"), 'the view heading stays h3');
  assert.equal((viewLine.match(/<h3/g) || []).length, 1, 'the view line carries exactly one h3');
  const bodyLine = appSrc.split('\n').find((line) => line.includes('const profileSectionServiceBody = '));
  assert.ok(bodyLine, 'the Service body line exists');
  assert.ok(
    bodyLine.indexOf('${packageHistorySectionMarkup}') < bodyLine.indexOf('${serviceTenureSectionMarkup}')
    && bodyLine.indexOf('${serviceTenureSectionMarkup}') < bodyLine.indexOf('${profileInfoGroupFragments.service}'),
    'package history -> tenure -> info-group service, order unchanged',
  );
});

test('Plan 593: CLV heading stays h4 (Plan 520 pin re-asserted)', () => {
  assert.ok(appSrc.includes('<h4 id="customerLifetimeValueHeading">'), 'the lifetime-value heading is still h4');
});

// G2 — The demotion itself: words, dates, classes and aria byte-identical.

test('Plan 593: current customer renders words, dates, classes and aria exactly', () => {
  const html = serviceTenureSectionHtml(customer(), '2026-11-06', LABELS);
  assert.equal(
    html,
    '<section class="service-tenure-section stv-section" aria-label="Service tenure"><h4>Service tenure</h4><p class="stv-primary">3 years 1 month</p><p class="stv-detail">Connected since 2023-11-06</p></section>',
    'the only difference from the base render is the tag name',
  );
});

test('Plan 593: not-recorded state renders h4, the not-recorded wording, and no detail line', () => {
  const html = serviceTenureSectionHtml(customer({ connectionDate: null }), '2026-11-06', LABELS);
  assert.equal(
    html,
    '<section class="service-tenure-section stv-section" aria-label="Service tenure"><h4>Service tenure</h4><p class="stv-primary">Connection date not recorded</p></section>',
    'the not-recorded state keeps the h4 and the wording, still no detail line',
  );
  assert.ok(!html.includes('stv-detail'), 'no detail line is shown');
});

test('Plan 593: future connection date renders h4 with Not started and the recorded date', () => {
  const html = serviceTenureSectionHtml(customer({ connectionDate: '2027-01-01' }), '2026-11-06', LABELS);
  assert.equal(
    html,
    '<section class="service-tenure-section stv-section" aria-label="Service tenure"><h4>Service tenure</h4><p class="stv-primary">Not started</p><p class="stv-detail">Recorded connection date 2027-01-01</p></section>',
    'the future state keeps the h4 with its own wording',
  );
});

test('Plan 593: heading label is escaped before it reaches the page', () => {
  const html = serviceTenureSectionHtml(customer(), '2026-11-06', { ...LABELS, heading: '<b>Tenure</b>' });
  assert.ok(!html.includes('<b>Tenure</b>'), 'raw markup never reaches the page');
  assert.ok(html.includes('&lt;b&gt;Tenure&lt;/b&gt;'), 'the heading is escaped');
  assert.ok(html.includes('<h4>&lt;b&gt;Tenure&lt;/b&gt;</h4>'), 'the escaped heading sits in the h4');
});

// G3 — The census, asserted by name (D1(a) reworded acceptance).

test('Plan 593: post-fix census inside the profile view is 4 h3s — view heading + 3 detail sections', () => {
  // Profile Info-tab redesign (user decision 2026-11-22): Connection,
  // Network, Hardware and History no longer render <details> shells —
  // they render as rows in ONE grouped list (spans, no h3), so the
  // view mounts 3 detail sections + the grouped list. D1(a): the
  // acceptance is reworded to this measured census. The three
  // detail-section <h3>s are a separate item — they live in the
  // shared profileDetailSectionHtml template and are NOT demoted here.
  assert.equal((sectionsSrc.match(/<h3/g) || []).length, 1, 'the detail-section template carries exactly one h3');
  const viewLine = appSrc.split('\n').find((line) => line.includes("$('#customerProfileView').innerHTML"));
  const mounted = viewLine.match(/profileSection(?:Customer|Service|Financial)Html/g) || [];
  assert.deepEqual(
    [...new Set(mounted)].sort(),
    ['profileSectionCustomerHtml', 'profileSectionFinancialHtml', 'profileSectionServiceHtml'],
    'the view mounts exactly the 3 remaining detail sections',
  );
  assert.ok(viewLine.includes('profileInfoGroupedListHtml'), 'the view mounts the grouped list (4 rows, no h3)');
  assert.equal((viewLine.match(/<h3/g) || []).length, 1, 'the view line carries exactly one h3 (its heading)');
});

test('Plan 593: the remaining headings are named — uptime h4 on Info (594), manual log h3 on Complaints, two sibling-panel h3s', () => {
  // Census after the redesign: 4 h3s inside the view (source); the Info
  // panel as built holds 4 (uptime is h4 now, so it adds none); at
  // runtime the Info tab holds 3 (Financial reads under Billing).
  // Uptime is h4 — Plan 594 demoted it; the manual log + the two
  // sibling panels keep their h3s. Each remaining heading below is
  // named by its mount, so a later reader cannot mistake this census
  // for a failure.
  assert.ok(indexSrc.includes('<h4 id="uptimeHeading"'), 'uptime is h4 on the Info panel (Plan 594 demoted it)');
  assert.ok(!indexSrc.includes('<h3 id="uptimeHeading"'), 'no h3 uptime heading remains');
  assert.ok(indexSrc.includes('<h3 id="incidentHeading"'), 'the manual log heads its own Complaints tab panel');
  assert.ok(appSrc.includes("<h3>${t('prof_receipts_heading')}</h3>"), 'the receipts summary keeps its h3 (sibling panel)');
  assert.ok(appSrc.includes('<h3 class="current-bill-heading-pill">'), 'the current bill keeps its h3 (sibling panel)');
});

// G4 — Styling treatment (D2(c), D5(b), D6(a)).

test('Plan 593: the tenure heading carries the 15px Manrope section-heading rule', () => {
  assert.ok(
    stylesSrc.includes('.stv-section h4{margin:0 0 6px;font:700 15px Manrope,sans-serif}'),
    'the decided rule exists verbatim',
  );
  assert.ok(!stylesSrc.includes('.stv-section h3'), 'no .stv-section h3 rule remains');
  // D5(b): CLV / freshness is the reference sibling — both rules exist
  // with the same 15px Manrope treatment.
  assert.ok(stylesSrc.includes('.customer-lifetime-value h4{margin:0 0 10px;color:#244a3e;font:700 15px Manrope,system-ui,sans-serif}'), 'the CLV reference rule exists');
  assert.ok(stylesSrc.includes('.profile-freshness-group h4{margin:0 0 6px;font:700 15px Manrope,sans-serif}'), 'the freshness reference rule exists');
});

test('Plan 593: the new rule adds no hex and the dead package-history h3 rule is untouched', () => {
  const rule = '.stv-section h4{margin:0 0 6px;font:700 15px Manrope,sans-serif}';
  assert.ok(stylesSrc.includes(rule), 'the rule exists to measure');
  assert.ok(!rule.includes('#'), 'the rule carries no colour literal — colour inherits');
  // D6(a): pre-existing dead rule, left untouched and named here.
  assert.ok(
    stylesSrc.includes('.package-history-section h3{margin:0;color:#244a3e;font:700 16px Manrope,system-ui,sans-serif}'),
    'the dead package-history h3 rule is still present, as before',
  );
});

// G5 — Guards + completeness.

test('Plan 593: module stays pure and carries no i18n key literal', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!moduleSrc.includes('prof_tenure'), 'labels arrive from the caller, never from the module');
});

test('Plan 593: parity does not move — no new key, and no stale-count literal in this file', () => {
  // Re-pin (Reports Closing polish): parity 5,223 → 5,229 — the item adds exactly one i18n key, dash_khata_open ('Open Khata Closing ›'), EN + UR. The Reports Register polish (+5 keys) merged first, so this re-pin lands at 5,231 (was 5,229 via Reports Closing).
  // Re-pin (Bill card rebase 2026-11-23): parity 5,229 → 5,231 — L adds 2 keys, prof_hist_snapshot_footnote + prof_hist_due_on, EN + UR.
  // Re-pin (Billing history rebase 2026-11-23): parity 5,231 → 5,234 — M adds 3 keys, prof_hist_empty_months + prof_hist_mark_paid + prof_hist_empty_custom, EN + UR.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5234, 'EN parity 5,234');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5234, 'UR parity 5,234');
  // Trap T7: 591's G5a fails the suite if any test file contains the
  // old-count digits (now the previous total, four-seven-six-six).
  // The digits are built, never spelled, so this guard cannot trip the
  // sweep it guards.
  assert.ok(!selfSrc.includes('47' + '66'), 'this file must stay free of the old-count literal');
});

test('Plan 593: app.js call site passes the same labels and no heading tag', () => {
  const start = appSrc.indexOf('serviceTenureSectionHtml(customer, localDate(), {');
  assert.ok(start > 0, 'the tenure call site exists');
  const slice = appSrc.slice(start, start + 1200);
  assert.ok(slice.includes("heading: t('prof_tenure_heading')"), 'the heading still comes from the same key');
  assert.ok(slice.includes('});'), 'the call object closes');
  assert.ok(!slice.includes('<h3') && !slice.includes('<h4'), 'the caller passes labels, never a tag');
  assert.ok(appSrc.includes("import { serviceTenureSectionHtml } from './service-tenure.js';"), 'the module import is unchanged');
});
