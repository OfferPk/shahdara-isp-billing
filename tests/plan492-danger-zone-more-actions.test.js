// Plan 492 — Danger zone and action row move out of the way.
// The profile's action row, the Technical QA list and the Danger zone
// all sat above the tabs, so the destructive Delete button was more
// prominent and higher than the profile itself. Plan 492 moves the
// Danger zone to the bottom of the Info panel (below the profile view),
// keeps Archive/Unarchive in the header row, and collapses the 13
// quick actions behind one "More actions" disclosure. No button
// behaviour changes: Delete still only fires on a clean account
// (polish #10), Archive still works from the header, and all 13
// actions stay reachable behind the disclosure.
// Polish #24 (user decision 2026-11-09) SUPERSEDES the danger-zone
// part: the zone is removed entirely and Delete moves into the header
// row, visible on every tab; the clean-account gate is gone too, so
// Delete now deletes the profile and its whole history. The tests
// below that pinned the zone's location now pin its absence instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const css = read('profile-ui.css');
const styles = read('styles.css');
const lang = read('nav-language.js');

// The 12 quick actions that collapse behind "More actions" (Archive
// AND Unarchive stay visible in the header row; the QA tools stay in
// their own disclosure). Count pinned: 12, not the design's
// approximate 12 — and not 13 any more. Profile Polish B (10) (user
// request 2026-11-12) swaps one seat: Record payment moves up into
// the header row and Archive moves down into the Payments grid, so
// the count stays 13 with one member exchanged. Profile Archive
// Button Visibility (user report 2026-11-13) reverses that seat:
// Archive leaves the grid for Row 1 beside Record payment, so the
// count drops to 12.
const ACTION_IDS = [
  'advancePaymentButton', 'backdatedPaymentButton',
  'openAccountStatementBtn', 'openReminderModalBtn', 'openCustomerPromiseBtn',
  'openBillInvoiceBtn', 'openLedgerAuditBtn', 'openAdjustmentModalBtn',
  'openServiceContractBtn', 'openDisputeClaimBtn', 'openKycAuditBtn',
  'openEquipmentRetrievalBtn',
];

// Profile View Polish (user report 2026-11-13) deliberately REVERSES
// Polish #24 here (same class as #1393's Archive reversal): the
// danger zone RETURNS at the bottom of the Info tab, and Delete
// leaves the header action group for it — Delete sat right beneath
// Edit, one accidental tap from wiping the profile and its whole
// history. The zone is rendered by app.js (not static markup), so
// its title/help keys are the new prof_danger_zone_* pair; the old
// dead prof_danger_title / prof_danger_help keys stay gone.
test('Plan 492: the danger zone RETURNS at the Info-tab bottom — Delete lives there, not in the header action group (Profile View Polish reversal of polish #24)', () => {
  assert.ok(app.includes('class="profile-danger-zone"'), 'the danger-zone block is rendered by app.js');
  assert.ok(app.includes("t('prof_danger_zone_title')"), 'the zone heading is the Danger zone key');
  assert.ok(app.includes("t('prof_danger_zone_help')"), 'the zone carries its help copy');
  assert.ok(lang.includes("prof_danger_zone_title: 'Danger zone'"), 'the zone title key exists in English');
  assert.ok(lang.includes("prof_danger_zone_title: 'خطرناک زون'"), 'the zone title key exists in Urdu');
  assert.ok(!lang.includes('prof_danger_title'), 'the dead danger-zone title key is gone from the dictionaries');
  assert.ok(!lang.includes('prof_danger_help'), 'the dead danger-zone help key is gone from the dictionaries');
  assert.ok(!index.includes('id="deleteCustomerButton"'), 'Delete is not in the header action group any more');
  assert.ok(app.includes('id="deleteCustomerButton"'), 'delete button keeps its id (the delegated wiring attaches to it)');
  const zoneAt = app.indexOf('profile-danger-zone');
  assert.ok(zoneAt > app.indexOf('Object.entries(PROFILE_SECTION_TAB)'), 'the zone is appended after the section-move loop — bottom of the Info tab');
});

// Profile View Polish — the zone is mounted into the Info panel
// again, but NOT by mountCustomerProfileContent: renderCustomerProfileView
// appends it after the section-move loop, so the mount group still
// claims no zone (its info group still ends with the uptime section).
test('Plan 492: mountCustomerProfileContent still mounts no danger zone — renderCustomerProfileView appends it after the move loop (Profile View Polish)', () => {
  assert.ok(
    app.includes("info:['.customer-meta','.uptime-section']"),
    'info group ends with the uptime section — no danger zone claimed',
  );
  assert.ok(!app.includes("'.profile-danger-zone'"), 'no mount group claims the danger zone anywhere');
  assert.ok(app.indexOf('profile-danger-zone') > app.indexOf('Object.entries(PROFILE_SECTION_TAB)'), 'the zone append sits after the section-move loop');
});

test('Plan 492: the 12 quick actions live inside the More actions disclosure; Archive and Unarchive stay in the header row (Profile Archive Button Visibility)', () => {
  assert.strictEqual(ACTION_IDS.length, 12, 'the collapsed action row holds 12 buttons');
  const groupAt = index.indexOf('class="profile-action-group"');
  const detailsAt = index.indexOf('id="profileMoreActionsDetails"');
  const gridAt = index.indexOf('class="profile-more-actions-grid"');
  const qaAt = index.indexOf('id="customerTechnicalToolsDetails"');
  assert.ok(groupAt >= 0 && detailsAt > groupAt, 'More actions disclosure sits inside the action group');
  assert.ok(
    index.includes('<details class="customer-technical-tools profile-more-actions" id="profileMoreActionsDetails">'),
    'disclosure reuses the Technical QA box treatment (full-row span, 44px summary) and is closed by default',
  );
  assert.ok(index.includes('data-i18n="prof_more_actions"'), 'disclosure label is keyed for Urdu');
  assert.ok(gridAt > detailsAt && qaAt > gridAt, 'grid sits inside the disclosure, QA disclosure after it');
  for (const id of ACTION_IDS) {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > gridAt && at < qaAt, `${id} must sit inside the More actions grid, before the QA list`);
  }
  for (const id of ['archiveCustomerButton', 'unarchiveCustomerButton']) {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > groupAt && at < detailsAt, `${id} stays a direct child of the action group, ahead of the disclosure`);
  }
  assert.ok(
    index.includes('class="profile-action-group" role="group" data-i18n-aria-label="prof_actions_aria" aria-label="Customer quick actions"'),
    'action group keeps its role and aria label',
  );
});

test('Plan 492: prof_more_actions exists in English and Urdu', () => {
  assert.ok(lang.includes("prof_more_actions: 'More actions'"), 'English label exists');
  assert.match(lang, /prof_more_actions:\s*'[^']*[\u0600-\u06FF]/, 'Urdu label carries Urdu script');
});

// Profile redesign: the #302 treatment moved INTO the category
// grids. The outer grid is now a 1-column stack of categories; each
// category holds a 2-column 52px action-card grid, Advance + back-dated
// sit in Payments (Profile Polish B (10) moved Record payment up to
// the header and Archive down here; Profile Archive Button Visibility
// then moved Archive back up to Row 1 beside Record payment), and only
// the back-dated entry spans the full category row (as a footer
// action, not a full-row payment shortcut).
test('Plan 492: disclosure grid keeps the #302 treatment inside the category grids (2-col 52px cards, backdated full-row)', () => {
  assert.ok(css.includes('.profile-more-actions-grid {'), 'outer grid rule exists');
  assert.match(
    css,
    /\.profile-more-actions-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/,
    'outer grid is a 1-column stack of categories',
  );
  assert.match(
    css,
    /\.profile-more-actions-category-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
    'each category grid is 2-column',
  );
  assert.match(
    css,
    /\.profile-more-actions-category-grid > button \{[^}]*min-height: 52px/,
    'the action cards keep 52px targets inside the disclosure',
  );
  assert.match(
    css,
    /\.profile-more-actions-category-grid > \.backdated-payment-link \{[^}]*grid-column: 1 \/ -1/,
    'the back-dated entry spans the full category row',
  );
  assert.ok(css.includes('border-top: 1px solid var(--line)'), 'grid divider uses the line token (hex-free)');
  assert.ok(!css.includes('.profile-action-group > .current-payment-shortcut'), 'no dead direct-child payment rule remains');
  assert.ok(!css.includes('.profile-action-group > button:not(.current-payment-shortcut)'), 'no dead direct-child button rule remains');
  assert.match(
    styles,
    /\.customer-technical-tools\s*\{\s*grid-column: 1 \/ -1/,
    'the reused QA box class still spans the full row, so the disclosure does too',
  );
});

// Profile View Polish — the wiring moves with the button: the
// module-level $('#deleteCustomerButton').addEventListener cannot
// survive the re-rendered zone node, so the handler is delegated on
// #customerProfileView instead (same id, same handler body). The
// clean-account gate stays REMOVED (polish #24, user decision
// 2026-11-09).
test('Plan 492: Delete wiring is delegated on #customerProfileView; the clean-account gate is REMOVED (polish #24, Profile View Polish)', () => {
  assert.ok(app.includes("$('#customerProfileView')?.addEventListener('click'"), 'delete wiring attaches once, delegated on the profile view');
  assert.ok(app.includes("event.target.closest('#deleteCustomerButton')"), 'delegation branches on the Delete id');
  assert.ok(app.includes('deleteCustomerButton'), 'delete handler references the same id');
  assert.ok(!app.includes('customerDeleteCleanCheck'), 'the gate import and its call are gone from app.js');
  assert.ok(!app.includes('customerDeleteRefusalText'), 'the gate refusal text is gone from app.js');
});
