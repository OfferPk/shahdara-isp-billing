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
// index.html:7072 on this base (not :7576); the mount is
// app.js:1780 (not :1684); Plan 520 already merged (CLV is <h4>);
// Plan 509 already removed the static rendering — no static <h3>
// remains. The prep was written on the fc4dc0f1 base; the line numbers
// here are re-measured on the 593-merge base (7138709b), where H3
// shifted index.html by +63 lines and app.js by +95.
//
// RE-PINNED 2026-11-20 by the Hisaab-home polish: its index.html edits
// above the uptime section (d23 span removal + toggle + provider-details
// wrapper, net +4 lines) shift all three pins by +4 (7068→7072,
// 7067→7071, manual log 7072→7076). The heading itself is untouched —
// only the line numbers move, with this comment as the reason.
//
// RE-PINNED 2026-11-20 by Telemetry Lab: the 46 telecom articles leave
// the Home charts grid above the uptime section (net -459 lines: -460
// removed, +1 More-menu button), so all three pins move -459
// (7089→6630, 7088→6629, manual log 7093→6634). The heading itself is
// untouched — only the line numbers move, with this comment as the reason.
//
// RE-PINNED 2026-11-21 by Plan 613: the edit form gains one h3 line
// above the uptime section (net +1 line), so all three pins move +1
// (6630→6631, 6629→6630, manual log 6634→6635). The heading itself is
// untouched — only the line numbers move, with this comment as the reason.
//
// RE-PINNED 2026-11-21 by Customers search toolbar: its index.html edits
// above the uptime section (identifier select into the Filters panel +3
// lines; search-block restructure +2 — chip to the top of the block,
// label row with the (i), control with the pill wrapper) shift all three
// pins by +5 (6631→6636, 6630→6635, manual log 6635→6640). The heading
// itself is untouched — only the line numbers move, with this comment as
// the reason.
//
// Census on this base (measured): source-level 8 <h3>s in the Info
// panel as built after this plan (view heading 1 + 7 detail-section
// summaries; tenure is <h4> since 593, uptime is <h4> since this
// plan); runtime 7 on the Info tab (the Financial section reads under
// Billing). The remaining <h3>s, by name: view heading (app.js:8821),
// 7 detail-section summaries (profile-sections.js:160), manual log
// (index.html:6640, Complaints tab), receipts summary (app.js:4146),
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

// The :6631 line, pinned in full. The only difference from the base line
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
  // Performance & Collection Analytics — the Analytics section gains a
  // tabs bar + 2 HTML summary rows above this section, so the pinned
  // lines move +14 (7072→7086, 7071→7085, 7076→7090); the lines
  // themselves are unchanged.
  // Business counter — the Hisaab section gains a counter line + two
  // averages lines above this section, so the pinned lines move +3
  // (7086→7089, 7085→7088, 7090→7093); the lines themselves are unchanged.
  // Telemetry Lab — the 46 telecom articles leave the Home charts grid
  // above this section, so the pinned lines move -459 (7089→6630,
  // 7088→6629, 7093→6634); the lines themselves are unchanged.
  // Plan 613 — the edit form gains one h3 line above this section,
  // so the pinned lines move +1 (6630→6631, 6629→6630, 6634→6635);
  // the lines themselves are unchanged.
  // Customers search toolbar — the identifier select moves into the
  // Filters panel (+3 lines) and the search block is restructured (+2),
  // so the pinned lines move +5 (6631→6636, 6630→6635, 6635→6640);
  // the lines themselves are unchanged.
  assert.equal(lineNo, 6636, 'the uptime heading sits on index.html:6636');
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
  // Plan 601 — the heading is keyed: the module renders the label, the
  // default is the same English heading, and the dict carries it.
  assert.ok(phvSrc.includes('<h4>${escapeHtml(L.heading)}</h4>'), 'the package-history heading is still h4 (Plan 509)');
  assert.ok(phvSrc.includes("heading: 'Package history',"), 'the module default still carries the heading');
  assert.equal(TRANSLATIONS.en.prv_ph_heading, 'Package history', 'the dict value is the heading the operator sees');
});

// G2 — The demotion itself: byte-identical except the tag, no line shift.

test('Plan 594: the demoted heading line is byte-identical to the base line except the tag name', () => {
  assert.equal(indexLines[6635], EXPECTED_UPTIME_LINE, 'the :6636 line matches the pinned line in full');
  const restored = indexLines[6635]
    .replace('<h4 id="uptimeHeading"', '<h3 id="uptimeHeading"')
    .replace('Online / offline time</h4>', 'Online / offline time</h3>');
  assert.ok(restored.includes('<h3 id="uptimeHeading" data-i18n="upt_heading">Online / offline time</h3>'), 'swapping the tag back restores the base heading exactly');
});

test('Plan 594: the heading sits on the same line number — no line shift, no panel move', () => {
  const sectionNo = indexLines.findIndex((l) => l.includes('<section class="incident-section uptime-section"')) + 1;
  assert.equal(sectionNo, 6635, 'the section still opens at :6635');
  // Plan 617: the share-draft host joins the info group FIRST, so the
  // uptime section is now third in Info, not second — its panel is
  // unchanged (still Info), only its position within the group moved.
  assert.ok(appSrc.includes("info:['#stxProfileShareDraft','.customer-meta','.uptime-section']"), 'the mount still puts the section in Info, third after the draft and the view');
  assert.ok(appSrc.includes("complaints:['.incident-section:not(.uptime-section)']"), 'the Complaints mount still excludes the uptime section');
});

test('Plan 594: the manual-log heading stays h3 with its text unchanged', () => {
  const lineNo = indexLines.findIndex((l) => l.includes('id="incidentHeading"')) + 1;
  assert.equal(lineNo, 6640, 'the manual-log heading sits on index.html:6640');
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
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5223, 'EN parity 5,223');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5223, 'UR parity 5,223');
  // Trap T6: 591's G5a fails the suite if any test file contains the
  // old-count digits (now the previous total, four-seven-six-six).
  // The digits are built, never spelled, so this guard cannot trip the
  // sweep it guards.
  assert.ok(!selfSrc.includes('47' + '66'), 'this file must stay free of the old-count literal');
});

test('Plan 594: the mount groups are unchanged except the Plan 617 draft move', () => {
  // Plan 617: the share-draft host joins the info group FIRST — Info
  // now mounts the draft, then .customer-meta, then .uptime-section.
  // The Complaints group is untouched.
  assert.ok(appSrc.includes("info:['#stxProfileShareDraft','.customer-meta','.uptime-section']"), 'Info mounts the draft first, then .customer-meta, then .uptime-section');
  assert.ok(appSrc.includes("complaints:['.incident-section:not(.uptime-section)']"), 'Complaints still excludes the uptime section via :not()');
});

test('Plan 594: no JS references #uptimeHeading', () => {
  assert.ok(!/uptimeHeading/.test(appSrc), 'app.js never dereferences the id — the fix needs no JS change');
  // The h3s left behind, by name: view heading (app.js:8821), 7
  // detail-section summaries (profile-sections.js:160), manual log
  // (index.html:6640), receipts summary (app.js:4146), current bill
  // (app.js:10503). None of them is silently claimed fixed here.
});
