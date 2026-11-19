// Plan 594 — Uptime section heading is an h4 like its Info-panel neighbours.
//
// Decided (parent, all (a)/(c) as named):
//   D1(a) REWORD the acceptance to the measured census: "the uptime
//         heading is <h4>; the Info panel contains 8 <h3>s as built
//         (7 at runtime — the Financial section reads under Billing);
//         the detail-section demotions are a separate item." The spec's
//         "one <h3>" is unachievable by this plan alone — 9 <h3>s live
//         in the Info panel as built on the 593-merge base (8 at
//         runtime), 8 / 7 after this plan — so the scope is NOT widened
//         to demote the seven detail-section <h3>s or the manual-log <h3>.
//   D2(c) SCOPED rule `.uptime-section .incident-section-heading h4`
//         with the identical 16px-Manrope declarations as the shared
//         `.incident-section-heading h3` rule: the exact look, no new
//         hex, the shared rule untouched, the manual log byte-identical.
//         The naive retarget is REFUTED (it would strip the manual-log
//         <h3> of its only heading rule).
//   D3(a) this new file. D4(a) live-browser heading walk (separate).
//   D5(a) The manual-log heading is the styling reference sibling.
//   D6(a) the dead `.package-history-section h3` rule is left
//         untouched and named in the PR body as pre-existing.
//
// Spec corrections recorded here (see the prep): the heading is
// index.html:7068 on this base (not :7576); the mount is
// app.js:1780 (not :1684); Plan 520 already merged (CLV is <h4>);
// Plan 509 already removed the static rendering — no static <h3>
// remains. The prep was written on the fc4dc0f1 base; the line numbers
// here are re-measured on the 593-merge base (7138709b), where H3
// shifted index.html by +63 lines and app.js by +95.
//
// Census on this base (measured): source-level 8 <h3>s in the Info
// panel as built after this plan (view heading 1 + 7 detail-section
// summaries; tenure is <h4> since 593, uptime is <h4> since this
// plan); runtime 7 on the Info tab (the Financial section reads under
// Billing). The remaining <h3>s, by name: view heading (app.js:8821),
// 7 detail-section summaries (profile-sections.js:160), manual log
// (index.html:7072, Complaints tab), receipts summary (app.js:4146),
// current bill (app.js:10503).
//
// One re-pin, forced by the demotion itself: the 593 census file
// (tests/plan593-service-tenure-heading-h4.test.js:161) named
// `<h3 id="uptimeHeading">` as a remaining heading — 594 re-pins
// that ONE assertion to `<h4>`. No other test file is touched.
//
// Fixtures: none — the heading is static HTML and the census is
// source slices. No customer data, no names, no phones anywhere in
// this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const sectionsSrc = readFileSync(join(dir, '..', 'profile-sections.js'), 'utf8');
const tenureSrc = readFileSync(join(dir, '..', 'service-tenure.js'), 'utf8');
const phvSrc = readFileSync(join(dir, '..', 'package-history-view.js'), 'utf8');
const selfSrc = readFileSync(join(dir, 'plan594-uptime-heading-h4.test.js'), 'utf8');

const indexLines = indexSrc.split('\n');

// The :7068 line, pinned in full. The only difference from the base line
// is the tag name (h3 -> h4). The help-button glyph is U+2139 + U+FE0F,
// written as escapes in a separate segment so the pin cannot drift on
// encoding (no literal glyph anywhere in this file).
const EXPECTED_UPTIME_LINE = '              <div class="incident-section-heading"><div><p class="eyebrow" data-i18n="upt_eyebrow">UPTIME TRACKING</p><h4 id="uptimeHeading" data-i18n="upt_heading">Online / offline time</h4><button class="help-info-btn" type="button" data-help="uptime" aria-label="About this feature" data-i18n-aria-label="help_aria_label">'
  + '\u2139\uFE0F'
  + '</button><p class="incident-manual-note" data-i18n="upt_note">Counted from your own records: the complaint/outage entries below plus every manual service-status change. This app does not monitor the connection itself.</p></div><label class="uptime-month-label" for="uptimeMonthSelect"><span data-i18n="upt_month_label">Month</span><select id="uptimeMonthSelect"></select></label></div>';

const SHARED_RULE = '.incident-section-heading h3{font:700 16px Manrope,sans-serif;letter-spacing:-.2px;margin:0;color:var(--ink)}';
const SCOPED_RULE = '.uptime-section .incident-section-heading h4{font:700 16px Manrope,sans-serif;letter-spacing:-.2px;margin:0;color:var(--ink)}';
const DEAD_RULE = '.package-history-section h3{margin:0;color:#244a3e;font:700 16px Manrope,system-ui,sans-serif}';

// G1 — Inventory: the demoted heading, the view heading, the neighbours.

test('Plan 594: uptime section renders an h4 and no h3 anywhere in its heading', () => {
  const lineNo = indexLines.findIndex((l) => l.includes('id="uptimeHeading"')) + 1;
  assert.equal(lineNo, 7068, 'the uptime heading sits on index.html:7068');
  assert.ok(indexLines[lineNo - 1].includes('<h4 id="uptimeHeading" data-i18n="upt_heading">Online / offline time</h4>'), 'the heading is an h4 with the same text and key');
  assert.ok(!indexSrc.includes('<h3 id="uptimeHeading"'), 'no h3 uptime heading remains anywhere');
  assert.ok(indexLines[lineNo - 2].includes('<section class="incident-section uptime-section" aria-labelledby="uptimeHeading">'), 'the section keeps its classes and aria-labelledby');
});

test('Plan 594: view heading stays h3', () => {
  const viewLine = appSrc.split('\n').find((line) => line.includes("$('#customerProfileView').innerHTML"));
  assert.ok(viewLine, 'the view assembly line exists');
  assert.ok(viewLine.includes("<h3>${t('prof_view_heading')}</h3>"), 'the view heading stays h3');
  assert.equal((viewLine.match(/<h3/g) || []).length, 1, 'the view line carries exactly one h3 (its heading)');
});

test('Plan 594: CLV and package history stay h4 (520/509 pins re-asserted)', () => {
  assert.ok(appSrc.includes('<h4 id="customerLifetimeValueHeading">'), 'the lifetime-value heading is still h4 (Plan 520)');
  assert.ok(phvSrc.includes('<h4>Package history</h4>'), 'the package-history heading is still h4 (Plan 509)');
});

// G2 — The demotion itself: byte-identical except the tag, no line shift.

test('Plan 594: the demoted heading line is byte-identical to the base line except the tag name', () => {
  assert.equal(indexLines[7067], EXPECTED_UPTIME_LINE, 'the :7068 line matches the pinned line in full');
  const restored = indexLines[7067]
    .replace('<h4 id="uptimeHeading"', '<h3 id="uptimeHeading"')
    .replace('Online / offline time</h4>', 'Online / offline time</h3>');
  assert.ok(restored.includes('<h3 id="uptimeHeading" data-i18n="upt_heading">Online / offline time</h3>'), 'swapping the tag back restores the base heading exactly');
});

test('Plan 594: the heading sits on the same line number — no line shift, no panel move', () => {
  const sectionNo = indexLines.findIndex((l) => l.includes('<section class="incident-section uptime-section"')) + 1;
  assert.equal(sectionNo, 7067, 'the section still opens at :7067');
  assert.ok(appSrc.includes("info:['.customer-meta','.uptime-section']"), 'the mount still puts the section second in Info');
  assert.ok(appSrc.includes("complaints:['.incident-section:not(.uptime-section)']"), 'the Complaints mount still excludes the uptime section');
});

test('Plan 594: the manual-log heading stays h3 with its text unchanged', () => {
  const lineNo = indexLines.findIndex((l) => l.includes('id="incidentHeading"')) + 1;
  assert.equal(lineNo, 7072, 'the manual-log heading sits on index.html:7072');
  assert.ok(indexLines[lineNo - 1].includes('<h3 id="incidentHeading" data-i18n="prof_incident_heading">Complaints &amp; outages</h3>'), 'the manual log keeps its h3 and its text');
});

// G3 — The census, asserted by name (D1(a) reworded acceptance).

test('Plan 594: post-fix census in the Info panel as built is 8 h3s — view heading + 7 detail sections', () => {
  // D1(a): the acceptance is reworded to this measured census. The
  // seven detail-section <h3>s are a separate item — they live in the
  // shared profileDetailSectionHtml template and are NOT demoted here.
  // Tenure is <h4> since Plan 593 and uptime is <h4> since this plan,
  // so neither counts. Source total: 8 (view heading 1 + 7 detail
  // sections); runtime total on the Info tab is 7 (see the next test).
  assert.equal((sectionsSrc.match(/<h3/g) || []).length, 1, 'the detail-section template carries exactly one h3');
  const viewLine = appSrc.split('\n').find((line) => line.includes("$('#customerProfileView').innerHTML"));
  const mounted = viewLine.match(/profileSection(?:Customer|Service|Financial|Connection|Network|Hardware|History)Html/g) || [];
  assert.deepEqual(
    [...new Set(mounted)].sort(),
    ['profileSectionConnectionHtml', 'profileSectionCustomerHtml', 'profileSectionFinancialHtml', 'profileSectionHardwareHtml', 'profileSectionHistoryHtml', 'profileSectionNetworkHtml', 'profileSectionServiceHtml'],
    'the view mounts exactly the 7 detail sections',
  );
  assert.equal((viewLine.match(/<h3/g) || []).length, 1, 'the view line carries exactly one h3 (its heading)');
  assert.ok(tenureSrc.includes('<h4>'), 'tenure is h4 since Plan 593 — it adds no h3');
  assert.ok(!tenureSrc.includes('<h3'), 'no h3 left in the tenure module');
  assert.ok(indexSrc.includes('<h4 id="uptimeHeading"'), 'uptime is h4 since this plan — it adds no h3');
});

test('Plan 594: the runtime census is 7 h3s on the Info tab — Financial reads under Billing', () => {
  // At runtime the Financial <details> section moves to Billing on
  // every render, taking one detail-section <h3> (and the CLV <h4>)
  // with it — so the Info tab holds 7 h3s (view heading + 6 detail
  // sections + uptime 0), not the source-level 8.
  assert.ok(appSrc.includes("const PROFILE_SECTION_TAB = { financial: 'billing' };"), 'the Financial section maps to Billing');
  assert.ok(appSrc.includes('panel.append(section)'), 'the move appends the section into its panel');
  const innerTabsSrc = readFileSync(join(dir, 'profile-inner-tabs-overhaul.test.js'), 'utf8');
  assert.ok(innerTabsSrc.includes("financial: 'billing'"), 'the inner-tabs file pins the Financial-to-Billing move');
  assert.ok(indexSrc.includes('<h3 id="incidentHeading"'), 'the manual log keeps its h3 on the Complaints tab');
  assert.ok(appSrc.includes("<h3>${t('prof_receipts_heading')}</h3>"), 'the receipts summary keeps its h3 (sibling panel)');
  assert.ok(appSrc.includes('<h3 class="current-bill-heading-pill">'), 'the current bill keeps its h3 (sibling panel)');
});

// G4 — Styling treatment (D2(c), D5(a), D6(a)).

test('Plan 594: the uptime heading keeps the exact 16px Manrope look via the scoped rule', () => {
  assert.ok(stylesSrc.includes(SCOPED_RULE), 'the decided scoped rule exists verbatim');
  assert.ok(stylesSrc.includes(SHARED_RULE), 'the shared h3 rule is byte-identical to base — the manual log keeps its look');
  assert.ok(!stylesSrc.includes('}.incident-section-heading h4{'), 'no BARE .incident-section-heading h4 rule exists (the h4 rule is scoped to .uptime-section only)');
  assert.equal(stylesSrc.split(SCOPED_RULE).length - 1, 1, 'the scoped rule appears exactly once');
});

test('Plan 594: the scoped rule adds no hex and the dead package-history h3 rule is untouched', () => {
  assert.ok(!SCOPED_RULE.includes('#'), 'the scoped rule carries no colour literal — colour inherits via var(--ink)');
  // D6(a): pre-existing dead rule, left untouched and named here.
  assert.ok(stylesSrc.includes(DEAD_RULE), 'the dead package-history h3 rule is still present, as before');
});

// G5 — Guards + completeness.

test('Plan 594: upt_heading exists in both tables and parity does not move', () => {
  assert.equal(TRANSLATIONS.en.upt_heading, 'Online / offline time', 'the English heading text is pinned');
  assert.equal(TRANSLATIONS.ur.upt_heading, 'آن لائن / آف لائن وقت', 'the Urdu heading text is pinned');
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4735, 'EN parity 4,735');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4735, 'UR parity 4,735');
  // Trap T6: 591's G5a fails the suite if any test file contains the
  // old-count digits. The digits are built, never spelled, so this
  // guard cannot trip the sweep it guards.
  assert.ok(!selfSrc.includes('47' + '22'), 'this file must stay free of the old-count literal');
});

test('Plan 594: the mount groups are unchanged', () => {
  assert.ok(appSrc.includes("info:['.customer-meta','.uptime-section']"), 'Info still mounts .customer-meta then .uptime-section');
  assert.ok(appSrc.includes("complaints:['.incident-section:not(.uptime-section)']"), 'Complaints still excludes the uptime section via :not()');
});

test('Plan 594: no JS references #uptimeHeading', () => {
  assert.ok(!/uptimeHeading/.test(appSrc), 'app.js never dereferences the id — the fix needs no JS change');
  // The h3s left behind, by name: view heading (app.js:8821), 7
  // detail-section summaries (profile-sections.js:160), manual log
  // (index.html:7072), receipts summary (app.js:4146), current bill
  // (app.js:10503). None of them is silently claimed fixed here.
});
