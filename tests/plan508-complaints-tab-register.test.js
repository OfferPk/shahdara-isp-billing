import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 508 — Complaints tab shows the customer's complaints: the tab
// labelled "Complaints" received only the static manual service log
// (`.incident-section:not(.uptime-section)`, "MANUAL SERVICE LOG /
// Complaints & outages") via mountCustomerProfileContent, while the
// register-based complaints list (complaintsSectionHtml, SISP-15) plus
// tickets and downtime all rendered inside the Info view. The tab did
// not show the customer's complaints. The fix moves the register list
// (and its "Open complaint register" button) into the Complaints tab,
// alongside the manual log, under the manual log's one shared
// "Complaints & outages" heading — so the register section carries no
// heading of its own any more. Tickets/downtime stay in Info.
//
// Boundaries, stated plainly: the register data, the modal wiring and
// the manual log are untouched — only where the register list renders
// changes. The complaints mount group
// (`.incident-section:not(.uptime-section)`) is unchanged, so the
// manual log still lands in the tab. The `.profile-complaints-section
// h4` CSS rule is left in place, unreferenced — removing it would mean
// editing a shared selector list for zero user-visible benefit (Plan
// 506/507 precedent). The section keeps its aria-label
// (prof_complaint_aria) for screen readers. No new element-id prefix,
// store key, hex colour or i18n key; the dead prof_complaint_heading
// key is removed from both dictionaries (Plan 506/507 precedent).

const app = read('app.js');
const index = read('index.html');

function infoViewTemplate() {
  const start = app.indexOf("$('#customerProfileView').innerHTML = `");
  assert.notEqual(start, -1, '#customerProfileView innerHTML assignment must exist');
  const end = app.indexOf('`;', start);
  assert.notEqual(end, -1, 'innerHTML template must close');
  // Polish #28 Phase A — the Info view renders as 7 <details> sections:
  // the assembly line carries only the heading + section shells, and
  // each section's items live in its body const. The Info view's full
  // render is the assembly plus the seven bodies.
  const bodies = ['Customer', 'Service', 'Financial', 'Connection', 'Network', 'Hardware', 'History']
    .map((name) => {
      const at = app.indexOf(`const profileSection${name}Body = `);
      assert.notEqual(at, -1, `${name} section body must exist`);
      return app.slice(at, app.indexOf('\n', at));
    })
    .join('\n');
  return `${app.slice(start, end)}\n${bodies}`;
}

function complaintsSectionDefinition() {
  const start = app.indexOf('const complaintsSectionHtml = `');
  assert.notEqual(start, -1, 'complaintsSectionHtml must be defined');
  const end = app.indexOf('`;', start);
  assert.notEqual(end, -1, 'complaints section template must close');
  return app.slice(start, end);
}

test('Plan 508: the Info view no longer carries a second complaints list', () => {
  const template = infoViewTemplate();
  assert.ok(!template.includes('complaintsSectionHtml'),
    'the Info view template must not interpolate the register complaints list');
  assert.ok(!app.includes('${complaintsSectionHtml}'),
    'no template anywhere may interpolate the register complaints list');
});

test('Plan 508: the register list renders into the Complaints panel, after the manual log', () => {
  // The panel is re-rendered per customer, so the previous register
  // section is removed first — otherwise every render would stack
  // another copy after the manual log.
  assert.ok(app.includes("$('#profilePanelComplaints')"),
    'the render must target the Complaints panel');
  assert.ok(app.includes("querySelector('.profile-complaints-section')?.remove()"),
    'the previous register section must be removed before the new one lands');
  assert.ok(app.includes("insertAdjacentHTML('beforeend', complaintsSectionHtml)"),
    'the register section must be appended at the end of the Complaints panel');
  // The static mount group is unchanged: the manual log still lands in
  // the tab at module load, and the register list follows it.
  assert.match(app, /complaints:\['\.incident-section:not\(\.uptime-section\)'\]/);
  assert.ok(index.includes('id="profilePanelComplaints"'),
    'the Complaints panel must exist');
});

test('Plan 508: one shared heading — the register section carries no heading of its own', () => {
  const section = complaintsSectionDefinition();
  assert.ok(!section.includes('<h4>'),
    'the register section must not bring its own heading into the tab');
  assert.ok(!app.includes("t('prof_complaint_heading')"),
    'app.js must no longer wire prof_complaint_heading');
  assert.ok(section.includes("t('prof_complaint_aria')"),
    'the section keeps its aria-label for screen readers');
  assert.ok(!('prof_complaint_heading' in TRANSLATIONS.en),
    'prof_complaint_heading must be gone from EN');
  assert.ok(!('prof_complaint_heading' in TRANSLATIONS.ur),
    'prof_complaint_heading must be gone from UR');
  // The manual log's heading is the shared one.
  assert.ok(index.includes('data-i18n="prof_incident_heading">Complaints &amp; outages</h3>'),
    'the manual log keeps the shared "Complaints & outages" heading');
});

test('Plan 508: the register section keeps its list, empty state, banner and Open button', () => {
  const section = complaintsSectionDefinition();
  assert.ok(section.includes('profile-complaints-list'),
    'the register entries list must survive the move');
  assert.ok(section.includes("t('prof_complaint_empty')"),
    'the empty state must survive the move');
  assert.ok(section.includes('upstreamChainBannerHtml'),
    'the upstream-chain banner must survive the move');
  assert.ok(section.includes('id="profileOpenComplaintRegisterBtn"'),
    'the Open complaint register button must survive the move');
  assert.ok(section.includes("t('prof_complaint_open')"),
    'the Open button keeps its label');
  assert.ok('prof_complaint_aria' in TRANSLATIONS.en, 'aria key stays in EN');
  assert.ok('prof_complaint_aria' in TRANSLATIONS.ur, 'aria key stays in UR');
  assert.ok('prof_complaint_empty' in TRANSLATIONS.en, 'empty key stays in EN');
  assert.ok('prof_complaint_open' in TRANSLATIONS.en, 'open key stays in EN');
});

test('Plan 508: the Open button is wired in the Complaints panel, not the Info view', () => {
  assert.ok(app.includes("$('#profilePanelComplaints').querySelector('#profileOpenComplaintRegisterBtn')"),
    'the Open button wiring must query the Complaints panel');
  assert.ok(!app.includes("$('#customerProfileView').querySelector('#profileOpenComplaintRegisterBtn')"),
    'the Open button wiring must no longer query the Info view');
});

test('Plan 508: tickets and downtime stay in the Info view', () => {
  const template = infoViewTemplate();
  assert.ok(template.includes('${ticketsSectionHtml}'),
    'the field-tickets section stays in the Info view');
  assert.ok(template.includes('${downtimeSectionHtml}'),
    'the downtime section stays in the Info view');
  assert.ok(template.includes('${rootCauseBanner}'),
    'the root-cause banner stays in the Info view');
});
