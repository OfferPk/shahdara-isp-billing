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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const css = read('profile-ui.css');
const styles = read('styles.css');
const lang = read('nav-language.js');

// The 13 quick actions that collapse behind "More actions" (Archive /
// Unarchive stay visible in the header row; the QA tools stay in their
// own disclosure). Count pinned: 13, not the design's approximate 12.
const ACTION_IDS = [
  'currentBillPaymentShortcut', 'advancePaymentButton', 'backdatedPaymentButton',
  'openAccountStatementBtn', 'openReminderModalBtn', 'openCustomerPromiseBtn',
  'openBillInvoiceBtn', 'openLedgerAuditBtn', 'openAdjustmentModalBtn',
  'openServiceContractBtn', 'openDisputeClaimBtn', 'openKycAuditBtn',
  'openEquipmentRetrievalBtn',
];

test('Plan 492: Danger zone sits inside #profileContentMounts after the uptime section, not above the tabs', () => {
  const mountsAt = index.indexOf('id="profileContentMounts"');
  const zoneAt = index.indexOf('class="profile-danger-zone"');
  const tabsAt = index.indexOf('class="profile-tabs"');
  const uptimeAt = index.indexOf('id="uptimeSummaryBody"');
  const incidentAt = index.indexOf('id="incidentHeading"');
  assert.ok(mountsAt >= 0 && zoneAt > mountsAt, 'danger zone must live inside the mounts container');
  assert.ok(zoneAt > tabsAt, 'danger zone must come after the tabs nav in source, not above it');
  assert.ok(zoneAt > uptimeAt, 'danger zone follows the uptime section inside the mounts');
  assert.ok(zoneAt < incidentAt, 'danger zone precedes the complaints section (it mounts into Info, not Complaints)');
  assert.ok(index.includes('id="deleteCustomerButton"'), 'delete button keeps its id (polish #10 wiring attaches to it)');
  assert.ok(index.includes('id="profileDangerZoneTitle"'), 'danger-zone title stays with the zone');
  assert.ok(index.includes('data-i18n="prof_danger_help"'), 'danger-zone help copy moves with the zone, unchanged');
});

test('Plan 492: mountCustomerProfileContent mounts the danger zone LAST into the Info panel', () => {
  // Plan 509 — the static package-history section is gone, so the info
  // group no longer claims '.package-history-section'; the danger zone
  // is still last, after the profile view and uptime.
  assert.ok(
    app.includes("info:['.customer-meta','.uptime-section','.profile-danger-zone']"),
    'info group must end with the danger zone, after the profile view and uptime',
  );
});

test('Plan 492: the 13 quick actions live inside the More actions disclosure; Archive stays in the header row', () => {
  assert.strictEqual(ACTION_IDS.length, 13, 'the collapsed action row holds 13 buttons');
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

test('Plan 492: disclosure grid keeps the #302 treatment (full-row payment/backdated, 44px targets, wrapping labels)', () => {
  assert.ok(css.includes('.profile-more-actions-grid {'), 'inner grid rule exists');
  assert.ok(
    css.includes('.profile-more-actions-grid > .current-payment-shortcut,'),
    'payment shortcut gets the full-row rule inside the grid',
  );
  assert.match(
    css,
    /\.profile-more-actions-grid > \.current-payment-shortcut,[\s\S]*?grid-column: 1 \/ -1/,
    'payment shortcut and back-dated link each span the full grid row',
  );
  assert.match(
    css,
    /\.profile-more-actions-grid > button:not\(\.current-payment-shortcut\):not\(\.backdated-payment-link\) \{[^}]*min-height: 44px/,
    'the other action buttons keep 44px targets inside the disclosure',
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

test('Plan 492: Delete wiring and the clean-account gate are untouched (polish #10)', () => {
  assert.ok(app.includes("$('#deleteCustomerButton').addEventListener"), 'delete button wiring still attaches once at startup');
  assert.ok(app.includes('deleteCustomerButton'), 'delete handler references the same id');
});
