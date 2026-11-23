// Profile Uptime polish (2026-11-22, user spec): Delete Customer moves to
// the very bottom of the Info tab, the uptime header compacts behind an
// inline (i) toggle, the ONLINE tile agrees with the live status line
// for same-day connections, and the KPI tiles gain semantic tints with
// the two footnotes merged into one line.
//
// Port of the prep repro (~/workspace/.profile-uptime-prep-scratch/
// repro-profile-uptime.mjs). NOT a pinning file: 0 parity literals.
// Synthetic data only — no real customer names, no realistic phones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

const {
  buildMonthlyUptime,
  currentStatusSession,
  parsePkDateTime
} = await import(pathToFileURL(join(root, 'uptime-tracking.js')).href);

const at = (pkDateTime) => new Date(parsePkDateTime(pkDateTime));
const indexSrc = readFileSync(join(root, 'index.html'), 'utf8');
const appSrc = readFileSync(join(root, 'app.js'), 'utf8');
const componentsSrc = readFileSync(join(root, 'components.css'), 'utf8');
const stylesSrc = readFileSync(join(root, 'styles.css'), 'utf8');
const langSrc = readFileSync(join(root, 'nav-language.js'), 'utf8');

// A connection made at 23:57 on Nov 21, read at 00:14 on Nov 22 — the
// screenshot's exact numbers. The creation stamp is the initial
// service-status history entry core.js writes for a new customer.
const sameDayCustomer = (overrides = {}) => ({
  id: 'c-uptime-polish',
  customerNumber: 42,
  name: 'Synthetic Uptime Customer',
  connectionDate: '2026-11-21',
  addedOn: '2026-11-21',
  serviceStatus: 'active',
  serviceStatusHistory: [{ status: 'active', at: '2026-11-21T23:57' }],
  incidents: [],
  bills: [],
  archived: false,
  ...overrides
});
const NOW = at('2026-11-22T00:14');

// The renderUptimePanel function source, extracted by brace counting
// (the panel itself needs a DOM; the composition is source).
const renderUptimePanelSrc = (() => {
  const start = appSrc.indexOf('function renderUptimePanel(customer)');
  const open = appSrc.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < appSrc.length; i++) {
    if (appSrc[i] === '{') depth += 1;
    if (appSrc[i] === '}') { depth -= 1; if (depth === 0) return appSrc.slice(start, i + 1); }
  }
  return '';
})();

test('C1: live line and ONLINE tile agree for a same-day 23:57 connection', () => {
  const customer = sameDayCustomer();
  const session = currentStatusSession(customer, NOW);
  assert.equal(session.precision, 'datetime', 'the live line has datetime precision from the 23:57 stamp');
  assert.equal(session.totalMinutes, 17, 'the live line reads 17 min (23:57 -> 00:14)');
  const summary = buildMonthlyUptime(customer, '2026-11', NOW);
  assert.equal(summary.onlineMinutes, 17,
    'the ONLINE tile reads 17 min too — the window starts at the 23:57 activation stamp, not 00:00');
  assert.equal(summary.windowMinutes, 17, 'the counted window is 17 min');
});

// RE-PINNED 2026-11-23 by the rebase (K overlap): N's R1 appended a
// danger-zone section to #profilePanelInfo, but K's merged Info
// redesign (user decision 2026-11-22) already put Delete at the very
// bottom of the Info tab as a slim row in #customerProfileView — R1's
// goal, superseding its mechanism (the zone box is gone by K's design).
// The row is appended after the section-move loop, so it lands last.
test('C2 (source): Delete is a slim row at the Info-tab bottom, appended after the section-move loop', () => {
  const rowIdx = appSrc.indexOf('profile-delete-row');
  assert.ok(rowIdx > 0, 'a slim Delete row exists in app.js');
  assert.ok(appSrc.includes("$('#customerProfileView').insertAdjacentHTML('beforeend'"),
    'the row is appended to the view');
  assert.ok(rowIdx > appSrc.indexOf('Object.entries(PROFILE_SECTION_TAB)'),
    'the row is appended after the section-move loop (bottom of the Info tab)');
  assert.ok(!appSrc.includes('class="profile-danger-zone"'),
    'no danger-zone section (K redesign removed the box; R1 is done position-wise)');
});

// RE-PINNED 2026-11-23 by the rebase (K overlap): the delegation
// stays on #customerProfileView — the Delete row lives in the view,
// and the view is a SIBLING of #profilePanelInfo (index.html), not a
// child, so panel delegation would never fire. N's panel move is
// dropped with R1's zone; the branch + handler body are unchanged.
test('C3 (source): delete delegation stays on the view that holds the row', () => {
  assert.ok(appSrc.includes("$('#customerProfileView')?.addEventListener('click'"),
    'the delegation is on #customerProfileView, which holds the Delete row');
  // Find the click listener whose body branches on the Delete id, and
  // check what element it is attached to.
  const branchIdx = appSrc.indexOf("event.target.closest('#deleteCustomerButton')");
  assert.ok(branchIdx > 0, 'a delegation still branches on the Delete id');
  const listenerIdx = appSrc.lastIndexOf("addEventListener('click'", branchIdx);
  assert.ok(listenerIdx > 0, 'the branch sits inside a click listener');
  const attachContext = appSrc.slice(Math.max(0, listenerIdx - 300), listenerIdx);
  assert.ok(attachContext.includes('customerProfileView'),
    'that listener is attached to the view (which contains the row)');
  assert.ok(!appSrc.includes("$('#profilePanelInfo')?.addEventListener('click'"),
    'no panel delegation — the panel does not contain the row');
});

test('C4 (source): the uptime header keeps title + (i) + month picker in one row, note collapsed', () => {
  const sectionStart = indexSrc.indexOf('<section class="incident-section uptime-section"');
  const uptimeSection = indexSrc.slice(sectionStart, indexSrc.indexOf('</section>', sectionStart));
  assert.ok(!uptimeSection.includes('<p class="incident-manual-note" data-i18n="upt_note">'),
    'the disclaimer is no longer an always-visible paragraph in the header');
  assert.ok(uptimeSection.includes('<details') || uptimeSection.includes('aria-expanded'),
    'the note sits behind the (i) toggle (details/help-tip or an aria-expanded button), collapsed by default');
  assert.ok(!/open>/.test(uptimeSection),
    'the toggle starts closed — the note is hidden until tapped');
  assert.ok(/\.uptime-section\s+\.incident-section-heading\s*\{[^}]*flex-direction:\s*row/.test(stylesSrc),
    'a rule keeps the uptime header a row (title + (i) + picker) instead of the generic column stack');
});

test('C5 (source): the three KPI tiles carry their semantic tints', () => {
  assert.ok(/uptime-stat[^{]*\{[^}]*var\(--qc-mint-bg\)/.test(componentsSrc),
    'the ONLINE tile uses the soft emerald token');
  assert.ok(/uptime-stat[^{]*\{[^}]*var\(--qc-rose-bg\)/.test(componentsSrc)
    || /uptime-stat[^{]*\{[^}]*var\(--color-slate-100\)/.test(componentsSrc),
    'the OFFLINE tile uses the soft rose (or neutral slate) token');
  assert.ok(/uptime-stat[^{]*\{[^}]*var\(--color-slate-100\)/.test(componentsSrc),
    'the DAYS IN MONTH tile uses the soft slate token');
});

test('C6 (source): the two footnotes are one concise muted line', () => {
  assert.ok(renderUptimePanelSrc.length > 0, 'renderUptimePanel is found');
  const noteCount = (renderUptimePanelSrc.match(/<p class="uptime-note">/g) || []).length;
  assert.equal(noteCount, 3,
    'the panel emits three uptime-note lines (combined footnote + the two inherited-upstream notes), not four — partial + none-offline share one element');
  assert.ok(renderUptimePanelSrc.includes('lifetimeStart') || renderUptimePanelSrc.includes('upt_summary_footnote'),
    'the combined footnote still carries the connection-start fact');
});

test('S1: a legacy record with no history stamp keeps the midnight window', () => {
  const customer = sameDayCustomer({
    connectionDate: '2026-10-15',
    addedOn: '2026-10-15',
    serviceStatusHistory: []
  });
  const summary = buildMonthlyUptime(customer, '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.windowMinutes, 17 * 1440, 'Oct 15 00:00 -> Nov 1 00:00 = 17 days (the pinned midnight rule)');
  assert.equal(summary.onlineMinutes, 17 * 1440, 'all online, no offline recorded');
  assert.equal(summary.lifetimeClamped, true, 'still flagged as lifetime-clamped');
});

test('S2: a first stamp on a LATER date does not shrink the window', () => {
  const customer = sameDayCustomer({
    connectionDate: '2026-10-15',
    addedOn: '2026-10-15',
    serviceStatusHistory: [{ status: 'active', at: '2026-10-20T09:00' }]
  });
  const summary = buildMonthlyUptime(customer, '2026-10', at('2026-11-05T09:00'));
  assert.equal(summary.windowMinutes, 17 * 1440,
    'the stamp is five days after the connection date, so the honest window still starts at midnight Oct 15');
});

test('S3: a full month with no clamp is untouched', () => {
  const customer = sameDayCustomer({
    connectionDate: '2025-06-01',
    addedOn: '2025-06-01',
    serviceStatusHistory: [{ status: 'active', at: '2025-06-01T09:00' }]
  });
  const summary = buildMonthlyUptime(customer, '2026-02', at('2026-03-10T09:00'));
  assert.equal(summary.onlineMinutes, 28 * 1440, 'February 2026 is 28 days, all online');
});

test('S4: the delete flow itself is unchanged — confirm + snapshot + 5s Undo', () => {
  assert.ok(appSrc.includes("event.target.closest('#deleteCustomerButton')"),
    'delegation still branches on the Delete id');
  assert.ok(appSrc.includes('duration:5000') && appSrc.includes("actionLabel:'Undo'"),
    'the 5-second Undo toast survives the move');
  assert.ok(appSrc.includes('snapshotBeforeDestructiveAction'),
    'the pre-delete safety snapshot survives the move');
  // RE-PINNED 2026-11-23 by the rebase (K overlap): the danger-zone box
  // is gone (K redesign) — the Delete row keeps the id, and the help
  // copy lives in the confirm sheet, not a zone heading.
  assert.ok(appSrc.includes('profile-delete-row'),
    'Delete is the slim row (K redesign); no danger-zone box');
  assert.ok(appSrc.includes("t('prof_danger_zone_help')"),
    'the delete help copy survives in the confirm sheet');
});

test('S5: the uptime help topic stays registered for the handbook', () => {
  assert.ok(langSrc.includes("help_uptime_title: '⏱️ Uptime Tracking'"),
    'the dialog topic title stays (the header button becomes a toggle; the topic stays reachable from the handbook)');
  assert.ok(langSrc.includes('help_uptime_body:'), 'the dialog topic body stays');
});

test('B1: offline spans still agree with the live counter to the minute', () => {
  // The live-status-counter flip scenario: created Oct 1 09:00 active,
  // flipped offline Oct 5 10:00, read Oct 7 13:00.
  const customer = sameDayCustomer({
    connectionDate: null,
    addedOn: '2026-10-01',
    serviceStatus: 'offline',
    serviceStatusHistory: [
      { status: 'active', at: '2026-10-01T09:00' },
      { status: 'offline', at: '2026-10-05T10:00' }
    ]
  });
  const summary = buildMonthlyUptime(customer, '2026-10', at('2026-10-07T13:00'));
  assert.equal(summary.offlineMinutes, 2 * 1440 + 3 * 60, 'offline 2 days 3 hours, as the counter says');
  assert.equal(summary.openSinceMs, parsePkDateTime('2026-10-05T10:00'), 'open-since matches the counter stamp');
});
