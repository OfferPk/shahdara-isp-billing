import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Profile Polish A (user spec 2026-11-12, items (5)–(9) of the
// 22-part profile spec):
// (5) header "Active" + "Profile: Active" merge into ONE Active pill
//     with a Facebook-style blue verified tick;
// (6) "Current billing · {month}" heading as a pill;
// (7) "Unused advance credit" hidden when there is none;
// (8) profile fields auto-sort, filled on top, unfilled below;
// (9) "Actual cash received on bill" hidden when there are no receipts.
// No figure changes anywhere: the same labels, the same values, only
// what shows, in what order, and in what shape.

function groupMarkupFunctions() {
  const app = read('app.js');
  const start = app.indexOf('function profileReadonlyField(');
  assert.notEqual(start, -1, 'profileReadonlyField must exist');
  const markupStart = app.indexOf('function profileInfoGroupMarkup(');
  assert.notEqual(markupStart, -1, 'profileInfoGroupMarkup must exist');
  const end = app.indexOf('\n}\n', markupStart);
  assert.notEqual(end, -1, 'profileInfoGroupMarkup must end cleanly');
  const src = app.slice(start, end + 3);
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return runInNewContext(`${src}\nprofileInfoGroupMarkup;`, { escapeHtml, PROFILE_EMPTY_DASH: '—' });
}

function billSummarySource() {
  const app = read('app.js');
  const start = app.indexOf('function renderCurrentBillSummary(');
  assert.notEqual(start, -1, 'renderCurrentBillSummary must exist');
  const end = app.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'renderCurrentBillSummary must end cleanly');
  return app.slice(start, end + 3);
}

// ------------------------------------------------------------ (8) auto-sort

test('Polish A (8): filled rows render on top, unfilled rows below, order kept inside each half', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const html = profileInfoGroupMarkup('Location', [
    ['Area', '—'],
    ['Zone', 'Zone 1'],
    ['Address', '—'],
    ['Notes', 'Near the masjid'],
  ]);
  const order = ['Zone', 'Notes', 'Area', 'Address'].map((label) => html.indexOf(`<dt>${label}</dt>`));
  assert.ok(order.every((idx) => idx !== -1), 'all four rows must render');
  assert.ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], 'filled rows first in declared order, then unfilled rows in declared order');
});

test('Polish A (8): a dash with an explanatory note still counts as unfilled', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const html = profileInfoGroupMarkup('Money', [
    ['Profit', '— (missing purchase cost)'],
    ['Selling', 'PKR 3,000'],
  ]);
  assert.ok(html.indexOf('<dt>Selling</dt>') < html.indexOf('<dt>Profit</dt>'), 'the noted dash sorts below the filled row');
});

test('Polish A (8): all-filled and all-empty groups keep their declared order', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const filled = profileInfoGroupMarkup('Contact', [['Phone', '03012345678'], ['CNIC', '35201-1234567-1']]);
  assert.ok(filled.indexOf('<dt>Phone</dt>') < filled.indexOf('<dt>CNIC</dt>'), 'filled rows stay in order');
  const empty = profileInfoGroupMarkup('Location', [['Area', '—'], ['Zone', '—']]);
  assert.ok(empty.indexOf('<dt>Area</dt>') < empty.indexOf('<dt>Zone</dt>'), 'empty rows stay in order');
});

test('Polish A (8): the actions block still travels with the first row when that row sorts below', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const block = '<div class="profile-readonly-field-wide"><div class="profile-contact-shortcuts"><a>Call</a></div></div>';
  const html = profileInfoGroupMarkup('Contact', [['Phone', '—'], ['CNIC', '35201-1234567-1']], block);
  const cnicIdx = html.indexOf('<dt>CNIC</dt>');
  const phoneIdx = html.indexOf('<dt>Phone</dt>');
  const blockIdx = html.indexOf('profile-contact-shortcuts');
  assert.ok(cnicIdx !== -1 && phoneIdx !== -1 && blockIdx !== -1, 'both rows and the block must render');
  assert.ok(cnicIdx < phoneIdx, 'the filled CNIC row sorts above the empty phone row');
  assert.ok(phoneIdx < blockIdx, 'the block still sits immediately after the phone row');
});

test('Polish A (8): the actions block stays after the first row when the first row is filled', () => {
  const profileInfoGroupMarkup = groupMarkupFunctions();
  const block = '<div class="profile-readonly-field-wide"><div class="profile-contact-shortcuts"><a>Call</a></div></div>';
  const html = profileInfoGroupMarkup('Contact', [['Phone', '03012345678'], ['CNIC', '—']], block);
  const phoneIdx = html.indexOf('<dt>Phone</dt>');
  const blockIdx = html.indexOf('profile-contact-shortcuts');
  const cnicIdx = html.indexOf('<dt>CNIC</dt>');
  assert.ok(phoneIdx < blockIdx && blockIdx < cnicIdx, 'block after the phone row, empty CNIC below');
});

// ------------------------------------------------------------ (5) one Active pill

test('Polish A (5): the header merges Active + Profile: Active into one pill only when live and Active', () => {
  const app = read('app.js');
  assert.ok(app.includes("!customer.archived && derivedServiceState.state === 'active'"), 'merge only for a live profile whose derived state is Active');
  assert.ok(app.includes('archiveStateBadge.hidden = isSingleActivePill'), 'the archive pill hides exactly when the pills merge');
  // Pucho + Profile Header Polish deliberately reverses the tick: the
  // merged pill reads cleanly as '● Active' now. The merge itself stays.
  assert.ok(!app.includes('profile-verified-tick'), 'no verified tick anywhere in the render');
  assert.ok(app.includes('serviceStatusBadge.textContent = derivedServiceState.label'), 'the merged pill is plain text now');
  const index = read('index.html');
  assert.ok(index.includes('id="profileServiceStatusBadge"'), 'the service badge element stays');
  assert.ok(index.includes('id="archiveStateBadge"'), 'the archive badge element stays (hidden by JS, not deleted)');
});

// Pucho + Profile Header Polish deliberately reverses the tick rule
// (styles.css) — the pill is plain '● Active' now. The rule's #2563eb
// is still used elsewhere, so the §8.9 ratchet count holds.
test('Polish A (5): the verified tick is GONE — Pucho + Profile Header Polish reverses it', () => {
  const styles = read('styles.css');
  assert.ok(!styles.includes('profile-verified-tick'), 'no tick rule or class left in styles.css');
  assert.ok(styles.includes('#2563eb'), 'the tick blue is still used elsewhere (ratchet count holds)');
});

// ------------------------------------------------------------ (6) billing heading pill

test('Polish A (6): the current-billing heading renders as a pill', () => {
  const src = billSummarySource();
  assert.ok(src.includes('<h3 class="current-bill-heading-pill">'), 'the heading carries the pill class');
  const styles = read('styles.css');
  assert.match(styles, /\.current-bill-heading-pill\{[^}]*border-radius:999px[^}]*\}/, 'the heading pill is pill-shaped');
});

// ------------------------------------------------------------ (7) hide empty unused credit

test('Polish A (7): the unused-credit stat renders only when credit exists', () => {
  const src = billSummarySource();
  assert.ok(src.includes('${unusedCreditCents ? `<article class="current-bill-stat ds-stat-box"><span>${t(\'prof_current_unused_credit\')'), 'the unused-credit article is conditional on credit');
  assert.ok(!src.includes('prof_none_recorded'), 'no "none recorded" fallback renders in the billing summary any more');
});

// ------------------------------------------------------------ (9) hide empty received

test('Polish A (9): the received stat renders only when receipts exist', () => {
  const src = billSummarySource();
  assert.ok(src.includes('${summary.receiptCount ? `<article class="current-bill-stat ds-stat-box"><span>${t(\'prof_current_received\')'), 'the received article is conditional on receipts');
  assert.ok(!src.includes('prof_current_no_receipts'), 'no "no receipts" fallback renders in the billing summary any more');
});

// ------------------------------------------------------------ ratchet

test('Polish A ratchet: styles.css still 614 distinct hex (no new hard-coded colour)', () => {
  const styles = read('styles.css');
  const stripped = styles.replace(/\/\*[\s\S]*?\*\//g, '');
  const distinct = new Set(stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.equal(distinct.size, 614, 'styles.css must stay at 614 distinct hex (no new hard-coded colour)');
});

test('Polish A: no real customer names or phone numbers in this test', () => {
  const testSrc = read('tests/profile-polish-a.test.js');
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(testSrc), 'test must not contain a realistic phone number');
});
