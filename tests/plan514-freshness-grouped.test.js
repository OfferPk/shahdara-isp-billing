// Plan 514 — Freshness signals grouped under one heading, one wording.
//
// The freshness stamp ("Checked on <date>" / never checked,
// profile-freshness-stamp.js) and the verification tick ("not
// verified yet", profile-verification-tick.js) both answer "is this
// record current?" but lived in three places with three wordings.
// Plan 514 groups them adjacent under one heading ("Profile
// freshness"), shares one date format (humanDate) and one wording
// pair ("Checked on …" / "Not checked yet"). The per-field change
// history stays where it is (after the tenure section) and keeps its
// own heading, "Field change history" — it is history, not freshness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  profileFreshnessStampText,
  profileFreshnessStampHtml,
} from '../profile-freshness-stamp.js';
import {
  profileVerificationTickSectionHtml,
} from '../profile-verification-tick.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stampSrc = readFileSync(join(dir, '..', 'profile-freshness-stamp.js'), 'utf8');
const tickSrc = readFileSync(join(dir, '..', 'profile-verification-tick.js'), 'utf8');
const fchSrc = readFileSync(join(dir, '..', 'field-change-history.js'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Customer One',
    mohalla: 'Mohalla A',
    ...overrides,
  };
}

function change(overrides = {}) {
  return {
    id: 'FCH-1',
    customerId: 'CUST-1',
    field: 'phone',
    oldValue: 'old',
    newValue: 'new',
    changedBy: 'Saad',
    date: '2026-11-06',
    ...overrides,
  };
}

function tick(overrides = {}) {
  return {
    id: 'PVT-1',
    customerId: 'CUST-1',
    verifiedBy: 'Saad',
    verifiedDate: '2026-11-06',
    fieldsChecked: ['name', 'number', 'mohalla', 'package'],
    ...overrides,
  };
}

// A stand-in for the app's humanDate: the shape matters (a function
// that maps an ISO date to display text), not the locale output.
const formatDate = (iso) => `D[${iso}]`;

// ---------------------------------------------------------------------------
// One date format: the stamp
// ---------------------------------------------------------------------------

test('Plan 514: the stamp formats its date through the shared formatter', () => {
  const html = profileFreshnessStampHtml(customer(), [change()], [], {}, formatDate);
  assert.ok(html.includes('<strong>D[2026-11-06]</strong>'), 'formatted date is emphasised');
  assert.ok(!html.includes('<strong>2026-11-06</strong>'), 'no raw ISO date in the display line');
});

test('Plan 514: without a formatter the stamp keeps the plain ISO date', () => {
  const html = profileFreshnessStampHtml(customer(), [change()], [], {});
  assert.ok(html.includes('<strong>2026-11-06</strong>'));
  assert.equal(profileFreshnessStampText({ date: '2026-11-06', source: 'change' }), 'Checked on 2026-11-06.');
});

test('Plan 514: the stamp text helper formats through the same formatter', () => {
  assert.equal(
    profileFreshnessStampText({ date: '2026-11-06', source: 'verification' }, {}, formatDate),
    'Checked on D[2026-11-06].',
  );
});

// ---------------------------------------------------------------------------
// One wording pair: "Checked on …" / "Not checked yet"
// ---------------------------------------------------------------------------

test('Plan 514: the shared never-checked wording is "Not checked yet"', () => {
  assert.equal(profileFreshnessStampText({ date: '', source: '' }), 'Not checked yet.');
  assert.equal(profileFreshnessStampText(null), 'Not checked yet.');
  const stampHtml = profileFreshnessStampHtml(customer(), [], [], {});
  assert.ok(stampHtml.includes('Not checked yet.'));
  assert.ok(!stampHtml.includes('Never checked.'));
  const tickHtml = profileVerificationTickSectionHtml(customer(), [], {});
  assert.ok(tickHtml.includes('Not checked yet.'));
  assert.ok(!tickHtml.includes('Not verified yet.'));
});

test('Plan 514: both language tables carry the one wording pair', () => {
  assert.ok(langSrc.includes("prof_dfs_never_checked: 'Not checked yet.'"));
  assert.ok(langSrc.includes("prof_pvt_none: 'Not checked yet.'"));
  assert.ok(langSrc.includes("prof_dfs_never_checked: 'ابھی جانچ نہیں ہوئی۔'"));
  assert.ok(langSrc.includes("prof_pvt_none: 'ابھی جانچ نہیں ہوئی۔'"));
  assert.ok(langSrc.includes("prof_dfs_checked_on: 'Checked on {date}.'"));
  assert.ok(langSrc.includes("prof_dfs_checked_on: 'آخری جانچ: {date}۔'"));
});

// ---------------------------------------------------------------------------
// One heading: the stamp and the tick carry no heading of their own
// when grouped
// ---------------------------------------------------------------------------

test('Plan 514: a null heading means the stamp renders no <h4> of its own', () => {
  const grouped = profileFreshnessStampHtml(customer(), [change()], [], { heading: null }, formatDate);
  assert.ok(grouped.includes('class="profile-freshness-stamp"'));
  assert.ok(!grouped.includes('<h4>'), 'the group carries the one heading');
  assert.ok(grouped.includes('aria-label="Profile freshness"'), 'the section stays labelled');
  assert.ok(grouped.includes('<strong>D[2026-11-06]</strong>'));
  const standalone = profileFreshnessStampHtml(customer(), [change()], [], {});
  assert.ok(standalone.includes('<h4>Profile freshness</h4>'), 'a heading still renders when one is given');
});

test('Plan 514: a null heading means the tick renders no <h4> of its own', () => {
  const grouped = profileVerificationTickSectionHtml(customer(), [tick()], { heading: null }, formatDate);
  assert.ok(grouped.includes('profile-verification-tick'));
  assert.ok(!grouped.includes('<h4>'), 'the group carries the one heading');
  assert.ok(grouped.includes('aria-label="Profile verification"'), 'the section stays labelled');
  assert.ok(grouped.includes('✓ Saad'));
  assert.ok(grouped.includes('D[2026-11-06]'), 'the current line uses the shared format');
  assert.ok(grouped.includes('id="pvtForm"'), 'the form still renders');
  const standalone = profileVerificationTickSectionHtml(customer(), [tick()], {});
  assert.ok(standalone.includes('<h4>Profile verification</h4>'), 'a heading still renders when one is given');
});

test('Plan 514: the tick date input keeps the raw ISO value, only the display line is formatted', () => {
  const html = profileVerificationTickSectionHtml(customer(), [tick()], { heading: null }, formatDate);
  assert.ok(html.includes('value="2026-11-06"'), 'the date input still takes the ISO value');
  assert.ok(html.includes('D[2026-11-06]'), 'the display line shows the formatted date');
});

// ---------------------------------------------------------------------------
// The group in the profile view
// ---------------------------------------------------------------------------

test('Plan 514: app.js renders stamp and tick adjacent inside one group, after the strip, before the dues breakdown', () => {
  const groupAt = appSrc.indexOf('class="profile-freshness-group"');
  assert.ok(groupAt > 0, 'the group section exists in the template');
  assert.ok(appSrc.includes('<h4>${t(\'prof_dfs_heading\')}</h4>'), 'the group carries the one heading');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const stampAt = appSrc.indexOf('${profileFreshnessStampMarkup}');
  const tickAt = appSrc.indexOf('${profileVerificationTickSectionMarkup}');
  const duesAt = appSrc.indexOf('${duesBreakdownSectionMarkup}');
  const lastAt = appSrc.indexOf('${lastInteractionLineMarkup}');
  assert.ok(stripAt > 0 && groupAt > stripAt, 'the group sits after the header strip');
  assert.ok(stampAt > groupAt && tickAt > stampAt, 'stamp then tick, adjacent inside the group');
  const groupCloseAt = appSrc.indexOf('</section>', tickAt);
  assert.equal(appSrc.slice(tickAt, groupCloseAt).trim(), '${profileVerificationTickSectionMarkup}', 'nothing sits between the tick and the group close');
  assert.ok(duesAt > groupCloseAt && lastAt > duesAt, 'the group sits before the dues breakdown and the last-interaction line');
  assert.ok(tickAt < lastAt, 'the tick no longer sits after the last-interaction line');
});

test('Plan 514: app.js passes the shared humanDate formatter to both builders', () => {
  const stampCallAt = appSrc.indexOf('profileFreshnessStampHtml(customer, loadFieldChanges()');
  assert.ok(stampCallAt > 0);
  assert.ok(appSrc.slice(stampCallAt, stampCallAt + 500).includes('humanDate'), 'the stamp call passes humanDate');
  const tickCallAt = appSrc.indexOf('profileVerificationTickSectionHtml(customer, loadProfileVerificationTicks()');
  assert.ok(tickCallAt > 0);
  assert.ok(appSrc.slice(tickCallAt, tickCallAt + 1000).includes('humanDate'), 'the tick call passes humanDate');
});

test('Plan 514: the tick wiring still finds its form inside the grouped section', () => {
  assert.ok(appSrc.includes("querySelector('.profile-verification-tick')"));
  assert.ok(appSrc.includes("querySelector('#pvtForm')"));
  assert.ok(appSrc.includes("querySelector('#pvtRemoveBtn')"));
});

test('Plan 514: the group heading is styled like the other section headings, with no new colour', () => {
  assert.ok(stylesSrc.includes('.profile-freshness-group h4'), 'the group heading has a rule');
  const stripped = stylesSrc.replace(/\.profile-freshness-group h4\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.profile-freshness-group h4\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// The change history stays history, not freshness
// ---------------------------------------------------------------------------

test('Plan 514: the change-history list keeps its history heading where it is', () => {
  assert.ok(langSrc.includes("prof_fch_heading: 'Field change history'"));
  assert.ok(langSrc.includes("prof_fch_heading: 'فیلڈ تبدیلی کی تاریخ'"));
  assert.ok(!fchSrc.includes('freshness'), 'the history module never speaks of freshness');
  assert.ok(appSrc.includes("querySelector('.stv-section')?.insertAdjacentHTML('afterend', fieldChangeHistorySectionHtml("), 'history still lands after the tenure section');
});

// ---------------------------------------------------------------------------
// Purity and PII
// ---------------------------------------------------------------------------

test('Plan 514: no real customer names or phone numbers in the modules or this test', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the modules or this test. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(stampSrc));
  assert.ok(!phoneShape.test(tickSrc));
  assert.ok(!phoneShape.test(testSrc));
  // The forbidden names are built from fragments so this test itself
  // never contains them literally.
  const forbiddenNames = [
    ['RA', 'JA ', 'JUN', 'AID'],
    ['RA', 'JA ', 'US', 'AMA'],
    ['CH', ' SAN', 'WALL'],
    ['DAR', 'BAR'],
  ].map((parts) => parts.join(''));
  for (const name of forbiddenNames) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('Plan 514: the changed modules stay pure — no page, storage, clock, network, or import', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ']) {
    assert.ok(!stampSrc.includes(banned), `stamp module must not contain ${banned}`);
    assert.ok(!tickSrc.includes(banned), `tick module must not contain ${banned}`);
  }
});
