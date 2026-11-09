import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildProfilePrintCardHtml } from '../profile-print-card.js';
import {
  buildProfileHeaderStrip,
  profileHeaderStripText,
  profileHeaderStripHtml,
} from '../profile-header-strip.js';
import { TRANSLATIONS } from '../nav-language.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(dir, '..', name), 'utf8');

// Plan 502 — one empty-state wording rule for view and form:
// a value the operator never entered (an identity, contact or
// configuration field) reads "Not set" (prof_not_set); an event or
// date that was never recorded reads "Not recorded"
// (prof_not_recorded). Computed figures with no record behind them
// (dues, install cost) also read "Not recorded". The print card and
// the header strip follow the same rule, and every profile-form
// select with nothing chosen shows the same blank-option words in
// both languages.
//
// Boundary, stated plainly: the custody, optical, pole and feeder
// sections keep their own "Not recorded" fallbacks — they are
// separate sections with their own conventions, not the four info
// groups, and this plan does not rewrite them.

const format = (value) => `PKR ${value}`;

function formHtml() {
  const html = read('index.html');
  const start = html.indexOf('id="customerProfileForm"');
  assert.notEqual(start, -1, 'profile form must exist');
  const end = html.indexOf('id="profileContributorsEditor"', start);
  assert.notEqual(end, -1, 'form must end before the contributors editor');
  return html.slice(start, end);
}

function groupsLiteral() {
  const app = read('app.js');
  // Polish #28 Phase A — the four-groups literal became the eight
  // fragments object (profileInfoGroupFragments); the wording-rule
  // pins follow the new name, rows verbatim.
  const start = app.indexOf('const profileInfoGroupFragments = {');
  assert.notEqual(start, -1, 'fragments object must exist');
  const end = app.indexOf('\n', start);
  return app.slice(start, end);
}

// ------------------------------------------------------------ the rule itself

test('Plan 502: the rule is written down as a code comment at the four groups', () => {
  const app = read('app.js');
  assert.ok(app.includes('Plan 502 — empty-state wording rule'), 'rule comment must sit at the four groups');
  assert.ok(app.includes('never entered'), 'rule must name the never-entered side');
  assert.ok(app.includes('never recorded'), 'rule must name the never-recorded side');
  assert.ok(read('profile-print-card.js').includes('Plan 502'), 'print card must carry the rule');
  assert.ok(read('profile-header-strip.js').includes('Plan 502'), 'header strip must carry the rule');
});

test('Plan 502: both wording keys exist in English and Urdu with real values', () => {
  for (const key of ['prof_not_set', 'prof_not_recorded']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en value is the raw key for ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur value is the raw key for ${key}`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur value for ${key} must carry Urdu script`);
  }
  assert.equal(TRANSLATIONS.en.prof_not_set, 'Not set');
  assert.equal(TRANSLATIONS.en.prof_not_recorded, 'Not recorded');
});

// ------------------------------------------------------------ the four info groups

test('Plan 502: Connection rows — never-entered field values read Not set', () => {
  const groups = groupsLiteral();
  assert.ok(groups.includes("customer.routerModel || t('prof_not_set')"), 'router model must read Not set');
  assert.ok(groups.includes("fiberMeters === '' ? t('prof_not_set')"), 'fiber meters must read Not set');
  assert.ok(groups.includes("fiberPerMeterRate === '' ? t('prof_not_set')"), 'fiber rate must read Not set');
});

test('Plan 502: Connection rows — never-recorded dates still read Not recorded', () => {
  const groups = groupsLiteral();
  assert.ok(groups.includes("customer.connectionDate ? humanDate(customer.connectionDate) : t('prof_not_recorded')"), 'connection start must read Not recorded');
  assert.ok(groups.includes("customer.expiryDate ? humanDate(customer.expiryDate) : t('prof_not_recorded')"), 'expiry must read Not recorded');
  assert.ok(groups.includes("customer.cancellationDate ? humanDate(customer.cancellationDate) : t('prof_not_recorded')"), 'cancellation must read Not recorded');
  assert.equal((groups.match(/t\('prof_not_recorded'\)/g) || []).length, 3, 'only the three date rows may read Not recorded in the fragments');
});

test('Plan 502: Contact / Location / Service rows still read Not set', () => {
  const groups = groupsLiteral();
  for (const fragment of [
    "phone || t('prof_not_set')",
    "cnic ? formatCnicDisplay(cnic) : t('prof_not_set')",
    "customer.mohalla || t('prof_not_set')",
    "customer.zone || t('prof_not_set')",
    "customer.address || t('prof_not_set')",
    "customer.notes?.trim() || t('prof_not_set')",
    "customer.ispProvider || t('prof_not_set')",
    "customer.packageSpeed || t('prof_not_set')",
    "customer.pppoeUsername || t('prof_not_set')",
    "customer.staticIp || t('prof_not_set')",
  ]) {
    assert.ok(groups.includes(fragment), `fragments object must keep ${fragment}`);
  }
});

// ------------------------------------------------------------ print card

const printFixture = () => ({
  customerId: 'CUST-1',
  customerName: 'Customer One',
  customerNumber: '36',
  businessName: 'Shahdara ISP',
  knownAs: 'Shuna',
  mohalla: 'Shahdara Village',
  packageLabel: '15 Mbps',
  packagePrice: 3000,
  outstanding: 3000,
  lastPayment: { amount: 3000, date: '2026-10-05' },
  contactNumber: '03012345678',
  handlingNote: 'Collect only from the father.',
  printDate: '2026-11-06',
});

test('Plan 502: print card — missing identity and contact fields read Not set', () => {
  const card = buildProfilePrintCardHtml({
    ...printFixture(),
    customerName: '', knownAs: '', mohalla: '', contactNumber: '',
  }, format);
  assert.ok(card);
  // Five, not four: the name reads "Not set" twice — once in the
  // page <title> and once in the card heading — plus known-as,
  // mohalla and contact number once each.
  assert.equal((card.match(/Not set/g) || []).length, 5, 'one Not set per missing field, name twice (title + heading)');
  assert.ok(!card.includes('Not recorded'), 'no identity/contact field may read Not recorded');
});

test('Plan 502: print card — no package reads Not set, matching the view Service group', () => {
  const card = buildProfilePrintCardHtml({ ...printFixture(), packageLabel: '', packagePrice: null }, format);
  assert.ok(card.includes('Not set'));
  assert.ok(!card.includes('No package recorded'), 'the old package wording must be gone');
});

test('Plan 502: print card — a missing computed figure still reads Not recorded', () => {
  const card = buildProfilePrintCardHtml({ ...printFixture(), outstanding: null }, format);
  assert.ok(card.includes('Not recorded'), 'dues with no record behind them stay Not recorded');
});

test('Plan 502: print card — plain-words equivalents for record absences are unchanged', () => {
  const card = buildProfilePrintCardHtml({ ...printFixture(), lastPayment: null, handlingNote: '' }, format);
  assert.ok(card.includes('No payment yet'));
  assert.ok(card.includes('No handling note recorded'));
});

// ------------------------------------------------------------ header strip

const stripFixture = () => ({
  customerId: 'CUST-1',
  customerName: 'Customer One',
  outstanding: 1500,
  packageLabel: '15 Mbps',
  packagePrice: 3000,
  lastPayment: { amount: 3000, date: '2026-10-05' },
  nextDueDate: '2026-11-05',
});

test('Plan 502: header strip — no package reads Not set, matching the view Service group', () => {
  const strip = buildProfileHeaderStrip({ ...stripFixture(), packageLabel: '' });
  assert.equal(strip.packageLabel, 'Not set');
  assert.match(profileHeaderStripText(strip), /Package Not set/);
  assert.match(profileHeaderStripHtml(strip), /Not set/);
  assert.doesNotMatch(profileHeaderStripText(strip), /No package recorded/);
});

test('Plan 502: header strip — a missing next due date still reads Not recorded', () => {
  const strip = buildProfileHeaderStrip({ ...stripFixture(), nextDueDate: '' });
  assert.equal(strip.nextDueDate, null);
  assert.match(profileHeaderStripText(strip), /Next due date not recorded\./);
  assert.match(profileHeaderStripHtml(strip), /Not recorded/);
});

test('Plan 502: header strip — no payment yet is unchanged', () => {
  const strip = buildProfileHeaderStrip({ ...stripFixture(), lastPayment: null });
  assert.match(profileHeaderStripText(strip), /No payment yet\./);
  assert.match(profileHeaderStripHtml(strip), /No payment yet/);
});

// ------------------------------------------------------------ form blank options

test('Plan 502: every profile-form select with nothing chosen reads Not set', () => {
  const form = formHtml();
  for (const [id, value] of [
    ['serviceStatusInput', 'not-set'],
    ['fiberZoneInput', ''],
    ['onuConnectorTypeInput', ''],
    ['converterSideInput', ''],
    ['routerOwnershipInput', ''],
    ['mediaConverterOwnershipInput', ''],
    ['residenceTypeInput', ''],
  ]) {
    assert.ok(
      form.includes(`<select id="${id}"><option value="${value}" data-i18n="prof_not_set">Not set</option>`),
      `${id} blank option must read Not set via prof_not_set`,
    );
  }
});

test('Plan 502: no profile-form blank option reads Not recorded any more', () => {
  const form = formHtml();
  assert.ok(!form.includes('prof_not_recorded'), 'prof_not_recorded must be gone from the profile form');
  assert.ok(!form.includes('>Not recorded</option>'), 'no blank option may carry the old wording');
});

test('Plan 502: selects with a real default keep their own words', () => {
  const form = formHtml();
  assert.ok(form.includes('data-i18n="prof_conn_residential"'), 'connection type keeps Residential');
  assert.ok(form.includes('data-i18n="visitwin_anytime"'), 'visit window keeps Any time');
  assert.ok(form.includes('data-i18n="prof_rcpt_default"'), 'receipt language/channel keep Default');
  assert.ok(form.includes('data-i18n="shield_reason_none"'), 'shield reason keeps No shield');
  assert.ok(form.includes('Direct feed — no upstream house'), 'upstream feed keeps its own label');
});
