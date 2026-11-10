// Plan 510 — Heading badges: one row, one order, one wording.
//
// (a) The six heading badges (FREE, commercial-VIP, prepaid-until,
// suspension-shield, star timely-payer, loyalty) used to render inline in
// the profile-view heading, in fixed code order, with no grouping — a
// customer with several badges wrapped unpredictably above the Edit/QR/Print
// row. They now live in their own row under the heading, in one fixed
// documented order — status → money → recognition — and the row is omitted
// entirely when no badge applies. Same badge set and labels as before.
// (b) The four header badges in the profile-status stack are unified to
// one pattern: each leads with its subject label, and the two label/value
// badges (Service, Profile) both use the ": " separator. The never-chosen
// manual service status gets its own honest label — "Service: Not chosen"
// — instead of "Service · Not set", which read as if the service itself
// were unset when it only means the operator never chose Active/Offline.
//
// Boundaries, stated plainly: the pause and shield header badges keep
// their shared wording — their labels are shared with the customer card,
// the dashboard and the Service group rows, so rewording them at the header
// would make the same pause/shield read two ways on one screen. Their
// texts already lead with their subject ("Paused since …", "Do Not
// Suspend · …"), so the pattern holds: subject first, values after. The
// customers-list card badges are untouched — this plan is the profile
// heading and header stack only. No status logic changes; no money figures
// are involved, so the PKR rule has nothing to pin here. No new element
// id: the badges row is a class, not an id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { t, setAppLanguage } = await import('../nav-language.js');
const { manualServiceStatusBareLabel, manualServiceStatusLabel, profileArchiveLabel } = await import('../profile-labels.js');

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');
const app = read('app.js');
const index = read('index.html');
const styles = read('styles.css');

// The six heading badges in their fixed documented order:
// status → money → recognition.
const BADGE_MARKERS_IN_ORDER = [
  'suspensionShieldBadgeHtml(customer',
  'free-connection-badge',
  'prepaidUntilBadgeHtml(state, customer)',
  'commercialVipBadgeHtml(customer)',
  'starTimelyPayerBadgeHtml(state, customer)',
  'loyaltyBadgeHtml(customer)',
];

function viewAssemblyLine() {
  const start = app.indexOf("$('#customerProfileView').innerHTML = ");
  assert.notEqual(start, -1, 'view assembly must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

test('Plan 510: heading badges live in their own row, after the actions row, in status → money → recognition order', () => {
  const line = viewAssemblyLine();
  const rowOpen = line.indexOf('<div class="profile-heading-badges">');
  assert.notEqual(rowOpen, -1, 'heading badges row div must exist in the view assembly');
  const actionsClose = line.indexOf('profile-view-actions');
  assert.ok(actionsClose !== -1 && actionsClose < rowOpen, 'badges row must come after the Edit/QR/Print actions row');
  assert.ok(line.includes('<div class="profile-heading-badges">${headingBadgesHtml}</div>'), 'badges row must wrap the composed headingBadgesHtml');
  // The order lives in the single composition: status → money → recognition.
  const constStart = app.indexOf('const headingBadgesHtml = ');
  assert.notEqual(constStart, -1, 'heading badges must be composed once into headingBadgesHtml');
  const constEnd = app.indexOf('`;', constStart);
  const composed = app.slice(constStart, constEnd);
  let lastPos = -1;
  for (const marker of BADGE_MARKERS_IN_ORDER) {
    const pos = composed.indexOf(marker);
    assert.notEqual(pos, -1, `composed badges must contain ${marker}`);
    assert.ok(pos > lastPos, `badges must appear in documented order; ${marker} is out of order`);
    lastPos = pos;
  }
  // No badge renders inline in the heading any more: everything before the
  // row must be badge-free.
  const beforeRow = line.slice(0, rowOpen);
  for (const marker of BADGE_MARKERS_IN_ORDER) {
    assert.ok(!beforeRow.includes(marker), `heading must not render ${marker} inline before the badges row`);
  }
  // The heading still carries its actions on the same line.
  // Polish #24 — Edit moved out of the heading into the static header
  // action group, so the heading line no longer carries it; QR and
  // Print stay, and Edit is pinned in its new home instead.
  assert.ok(!line.includes('id="editProfileButton"'), 'Edit no longer renders in the heading — it lives in the static header group');
  assert.ok(index.includes('id="editProfileButton"'), 'Edit button exists in the static header action group');
  assert.ok(line.includes('id="profileQrCardButton"'), 'QR button stays in the heading');
  assert.ok(line.includes('id="profilePrintCardButton"'), 'Print button stays in the heading');
});

test('Plan 510: the badges row is omitted entirely when no badge applies', () => {
  const line = viewAssemblyLine();
  assert.match(
    line,
    /headingBadgesHtml \? `<div class="profile-heading-badges">\$\{headingBadgesHtml\}<\/div>` : ''/,
    'badges row must render only when at least one badge applies'
  );
  const headingConst = app.indexOf('const headingBadgesHtml = ');
  assert.notEqual(headingConst, -1, 'heading badges must be composed once into headingBadgesHtml');
});

test('Plan 510: the badges row wraps as pills on its own full-width row and adds no new hex', () => {
  const match = styles.match(/\.profile-heading-badges\{([^}]*)\}/);
  assert.ok(match, '.profile-heading-badges rule must exist in styles.css');
  const body = match[1];
  assert.match(body, /display:flex/, 'badges row must be flex');
  assert.match(body, /flex-wrap:wrap/, 'badges row must wrap');
  assert.match(body, /flex-basis:100%/, 'badges row must take its own full-width row');
  assert.ok(!body.includes('#'), 'badges row rule must add no new hex colour');
});

test('Plan 510: service badge uses the Label: value pattern in both languages', () => {
  assert.equal(t('prof_service_badge', 'en', { label: 'Active' }), 'Service: Active');
  assert.equal(t('prof_service_badge', 'ur', { label: 'فعال' }), 'سروس: فعال');
  assert.ok(!t('prof_service_badge', 'en', { label: 'Active' }).includes('·'), 'service badge must not use the · separator');
  assert.ok(!t('prof_service_badge', 'ur', { label: 'فعال' }).includes('·'), 'Urdu service badge must not use the · separator');
});

test('Plan 510: a never-chosen service status reads Not chosen, never Not set or Offline', () => {
  setAppLanguage('en');
  assert.equal(manualServiceStatusBareLabel('not-set'), 'Not chosen');
  assert.equal(manualServiceStatusLabel('not-set'), 'Service status: Not chosen');
  assert.ok(!manualServiceStatusLabel('not-set').includes('Not set'), 'never-chosen status must not read Not set');
  assert.ok(!manualServiceStatusLabel('not-set').includes('Offline'), 'never-chosen status must not read Offline');
  // The real states are untouched.
  assert.equal(manualServiceStatusBareLabel('active'), 'Active');
  assert.equal(manualServiceStatusBareLabel('offline'), 'Offline');
  setAppLanguage('ur');
  assert.equal(manualServiceStatusBareLabel('not-set'), 'منتخب نہیں');
  assert.equal(manualServiceStatusLabel('not-set'), 'سروس کی حالت: منتخب نہیں');
  assert.ok(!manualServiceStatusLabel('not-set').includes('طے نہیں'), 'Urdu never-chosen status must not read طے نہیں');
  setAppLanguage('en');
});

test('Plan 510: archive badge keeps the Label: value pattern', () => {
  setAppLanguage('en');
  assert.equal(profileArchiveLabel(false, ''), 'Profile: Active');
  assert.equal(profileArchiveLabel(true, 'synthetic date'), 'Profile: Archived since synthetic date');
});

test('Plan 510: pause and shield header badges keep their shared wording', () => {
  // Their labels are shared with the customer card, the dashboard and the
  // Service group rows — the header reuses them verbatim, so the same
  // pause/shield never reads two ways on one screen.
  assert.match(app, /pauseBadge\.textContent = `⏸ \$\{pauseSummary\.label\}`/, 'pause header badge still renders the shared pause label');
  assert.match(app, /shieldBadge\.textContent = headerShieldSummary\.label/, 'shield header badge still renders the shared shield label');
});

test('Plan 510: static header badge in index.html reads Service: Not chosen', () => {
  assert.ok(index.includes('>Service: Not chosen<'), 'static service badge text must read Service: Not chosen');
  assert.ok(index.includes('aria-label="Manual service status: Not chosen; not monitored"'), 'static service badge aria must match');
  assert.ok(!index.includes('Service · Not set'), 'static service badge must not read Service · Not set');
});

test('Plan 510: badges row uses a class, not a new element id', () => {
  const line = viewAssemblyLine();
  assert.ok(!line.includes('id="profileHeadingBadges"'), 'badges row must not introduce a new element id');
  assert.ok(!/profile-heading-badges[^>]*id=/.test(line), 'badges row div must carry no id attribute');
});
