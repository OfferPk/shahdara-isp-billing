import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStrictProfileFreshnessDate,
  latestFieldChangeDateForCustomer,
  latestVerificationDateForCustomer,
  profileFreshnessForCustomer,
  profileFreshnessStampText,
  profileFreshnessStampHtml,
} from '../profile-freshness-stamp.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-freshness-stamp.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
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
    date: '2026-11-01',
    ...overrides,
  };
}

function tick(overrides = {}) {
  return {
    id: 'PVT-1',
    customerId: 'CUST-1',
    verifiedBy: 'Saad',
    verifiedDate: '2026-11-05',
    fieldsChecked: ['name', 'number', 'mohalla', 'package'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Strict dates
// ---------------------------------------------------------------------------

test('dates: strict YYYY-MM-DD, leap-aware', () => {
  assert.equal(isStrictProfileFreshnessDate('2024-02-29'), true);
  assert.equal(isStrictProfileFreshnessDate('2025-02-29'), false);
  assert.equal(isStrictProfileFreshnessDate('2026-11-06'), true);
  assert.equal(isStrictProfileFreshnessDate('2026-13-01'), false);
  assert.equal(isStrictProfileFreshnessDate('2026-04-31'), false);
  assert.equal(isStrictProfileFreshnessDate('2026-11-6'), false);
  assert.equal(isStrictProfileFreshnessDate('06/11/2026'), false);
  assert.equal(isStrictProfileFreshnessDate(''), false);
  assert.equal(isStrictProfileFreshnessDate(null), false);
  assert.equal(isStrictProfileFreshnessDate(undefined), false);
  assert.equal(isStrictProfileFreshnessDate(20261106), false);
});

// ---------------------------------------------------------------------------
// Latest field-change date
// ---------------------------------------------------------------------------

test('latest field-change date: picks the latest strict date for the customer', () => {
  const changes = [
    change({ id: 'FCH-1', date: '2026-11-01' }),
    change({ id: 'FCH-2', date: '2026-10-20' }),
    change({ id: 'FCH-3', date: '2026-11-04' }),
  ];
  assert.equal(latestFieldChangeDateForCustomer(changes, 'CUST-1'), '2026-11-04');
});

test('latest field-change date: ignores other customers, invalid dates, and junk rows', () => {
  const changes = [
    change({ id: 'FCH-1', date: '2026-11-01' }),
    change({ id: 'FCH-2', customerId: 'CUST-2', date: '2026-12-25' }),
    change({ id: 'FCH-3', date: '2026-02-30' }),
    change({ id: 'FCH-4', date: '' }),
    null,
    'not an entry',
  ];
  assert.equal(latestFieldChangeDateForCustomer(changes, 'CUST-1'), '2026-11-01');
});

test('latest field-change date: customer match is case-insensitive; empty without a match', () => {
  assert.equal(latestFieldChangeDateForCustomer([change()], 'cust-1'), '2026-11-01');
  assert.equal(latestFieldChangeDateForCustomer([change()], 'CUST-9'), '');
  assert.equal(latestFieldChangeDateForCustomer([], 'CUST-1'), '');
  assert.equal(latestFieldChangeDateForCustomer(null, 'CUST-1'), '');
  assert.equal(latestFieldChangeDateForCustomer([change()], ''), '');
});

// ---------------------------------------------------------------------------
// Latest verification date
// ---------------------------------------------------------------------------

test('latest verification date: the tick date for the customer, or empty', () => {
  assert.equal(latestVerificationDateForCustomer([tick()], 'CUST-1'), '2026-11-05');
  assert.equal(latestVerificationDateForCustomer([tick()], 'cust-1'), '2026-11-05');
  assert.equal(latestVerificationDateForCustomer([tick()], 'CUST-9'), '');
  assert.equal(latestVerificationDateForCustomer([], 'CUST-1'), '');
  assert.equal(latestVerificationDateForCustomer(null, 'CUST-1'), '');
});

test('latest verification date: an invalid tick date reads as no tick', () => {
  assert.equal(latestVerificationDateForCustomer([tick({ verifiedDate: '2026-02-30' })], 'CUST-1'), '');
  assert.equal(latestVerificationDateForCustomer([tick({ verifiedDate: '' })], 'CUST-1'), '');
});

// ---------------------------------------------------------------------------
// Combined freshness
// ---------------------------------------------------------------------------

test('freshness: the later date wins, and names its source', () => {
  assert.deepEqual(
    profileFreshnessForCustomer([change({ date: '2026-11-06' })], [tick({ verifiedDate: '2026-11-05' })], 'CUST-1'),
    { date: '2026-11-06', source: 'change' },
  );
  assert.deepEqual(
    profileFreshnessForCustomer([change({ date: '2026-11-01' })], [tick({ verifiedDate: '2026-11-05' })], 'CUST-1'),
    { date: '2026-11-05', source: 'verification' },
  );
});

test('freshness: a tie goes to the verification, a lone source stands alone', () => {
  assert.deepEqual(
    profileFreshnessForCustomer([change({ date: '2026-11-05' })], [tick({ verifiedDate: '2026-11-05' })], 'CUST-1'),
    { date: '2026-11-05', source: 'verification' },
  );
  assert.deepEqual(
    profileFreshnessForCustomer([change({ date: '2026-11-02' })], [], 'CUST-1'),
    { date: '2026-11-02', source: 'change' },
  );
  assert.deepEqual(
    profileFreshnessForCustomer([], [tick({ verifiedDate: '2026-11-05' })], 'CUST-1'),
    { date: '2026-11-05', source: 'verification' },
  );
});

test('freshness: never touched means an empty date and an empty source', () => {
  assert.deepEqual(profileFreshnessForCustomer([], [], 'CUST-1'), { date: '', source: '' });
  assert.deepEqual(profileFreshnessForCustomer([change()], [tick()], 'CUST-9'), { date: '', source: '' });
});

test('freshness: the stamp matches the latest change or verification date on the same fixture', () => {
  const changes = [change({ id: 'FCH-1', date: '2026-10-01' }), change({ id: 'FCH-2', date: '2026-11-03' })];
  const ticks = [tick({ verifiedDate: '2026-10-15' })];
  assert.deepEqual(profileFreshnessForCustomer(changes, ticks, 'CUST-1'), { date: '2026-11-03', source: 'change' });
  const laterTicks = [tick({ verifiedDate: '2026-11-04' })];
  assert.deepEqual(profileFreshnessForCustomer(changes, laterTicks, 'CUST-1'), { date: '2026-11-04', source: 'verification' });
});

// ---------------------------------------------------------------------------
// Stamp text and HTML
// ---------------------------------------------------------------------------

test('stamp text: checked-on line with the date, never-checked line without one', () => {
  assert.equal(
    profileFreshnessStampText({ date: '2026-11-06', source: 'change' }),
    'Checked on 2026-11-06.',
  );
  // Plan 514: the shared never-checked wording is "Not checked yet"
  // (one pair with "Checked on …", shared with the verification tick).
  assert.equal(profileFreshnessStampText({ date: '', source: '' }), 'Not checked yet.');
  assert.equal(profileFreshnessStampText(null), 'Not checked yet.');
  assert.equal(profileFreshnessStampText({ date: '2026-02-30', source: 'change' }), 'Not checked yet.');
});

test('stamp text: caller labels win, plain defaults apply when a label is missing', () => {
  const labels = { checkedOn: 'Last seen {date}', neverChecked: 'Not seen yet.' };
  assert.equal(profileFreshnessStampText({ date: '2026-11-06', source: 'verification' }, labels), 'Last seen 2026-11-06');
  assert.equal(profileFreshnessStampText({ date: '', source: '' }, labels), 'Not seen yet.');
  assert.equal(profileFreshnessStampText({ date: '2026-11-06', source: 'change' }, {}), 'Checked on 2026-11-06.');
});

test('stamp HTML: the dated stamp shows the heading and the date emphasised', () => {
  const html = profileFreshnessStampHtml(customer(), [change({ date: '2026-11-06' })], [], {});
  assert.ok(html.includes('class="profile-freshness-stamp"'));
  assert.ok(html.includes('<h4>Profile freshness</h4>'));
  assert.ok(html.includes('<strong>2026-11-06</strong>'));
  assert.ok(html.includes('Checked on'));
  assert.ok(!html.includes('Never checked.'));
});

test('stamp HTML: a profile never touched shows the never-checked line', () => {
  const html = profileFreshnessStampHtml(customer(), [], [], {});
  assert.ok(html.includes('<h4>Profile freshness</h4>'));
  assert.ok(html.includes('Not checked yet.'));
  assert.ok(html.includes('class="dfs-stamp dfs-none"'));
  assert.ok(!html.includes('<strong>'));
});

test('stamp HTML: no customer means no stamp at all', () => {
  assert.equal(profileFreshnessStampHtml(null, [change()], [tick()]), '');
  assert.equal(profileFreshnessStampHtml(undefined, [], []), '');
});

test('stamp HTML: labels are escaped, and a hostile date never becomes markup', () => {
  const hostile = tick({ verifiedDate: '2026-11-06<script>alert(1)</script>' });
  const html = profileFreshnessStampHtml(customer(), [], [hostile], { heading: '<b>Fresh</b>' });
  assert.ok(html.includes('Not checked yet.'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;b&gt;Fresh&lt;/b&gt;'));
});

// ---------------------------------------------------------------------------
// Purity, fences, and the no-new-store rule
// ---------------------------------------------------------------------------

test('purity: the module reads no storage, clock, network, or page', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/shahdara_[a-z0-9_]+_v\d/.test(moduleSrc), 'the stamp keeps no store of its own');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'the module must not name the standalone OLT word');
});

test('fences: the module and its tests never name a fenced file literally', () => {
  // The fenced neighbours are the per-field change log and the
  // verification tick modules. Their filenames are built from
  // fragments here so the test itself never contains them either.
  const fenced = [
    ['field', '-change', '-history', '.js'],
    ['profile', '-verification', '-tick', '.js'],
  ];
  for (const parts of fenced) {
    const name = parts.join('');
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `test names fenced file ${name}`);
  }
});

test('no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
  // The forbidden names are built from fragments so this test itself
  // never contains them literally.
  const forbiddenNames = [
    ['Kir', 'an'],
    ['Hai', 'der'],
    ['Shu', 'naid'],
    ['Kha', 'zer'],
    ['Moh', 'sin'],
    ['Shar', 'jell'],
    ['No', 'mi'],
  ].map((parts) => parts.join(''));
  for (const name of forbiddenNames) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Wiring, styles, and language
// ---------------------------------------------------------------------------

test('wiring: import, stamp after the strip, before the dues breakdown', () => {
  assert.ok(appSrc.includes("from './profile-freshness-stamp.js'"));
  assert.ok(appSrc.includes('profileFreshnessStampHtml'));
  assert.ok(appSrc.includes('profileFreshnessStampMarkup'));
  assert.ok(appSrc.includes('loadFieldChanges()'));
  assert.ok(appSrc.includes('loadProfileVerificationTicks()'));
  // Order, not adjacency: the stamp sits between the header strip
  // and the dues breakdown, so the strip is still before the dues
  // breakdown and the breakdown is still before the household link.
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}');
  const stampAt = appSrc.indexOf('${profileFreshnessStampMarkup}');
  const breakdownAt = appSrc.indexOf('${duesBreakdownSectionMarkup}');
  const householdAt = appSrc.indexOf('${householdLinkSectionMarkup}');
  assert.ok(stripAt > 0 && stampAt > stripAt && breakdownAt > stampAt && householdAt > breakdownAt);
});

test('wiring: the profile order assertion still holds — banner, strip, then groups', () => {
  const bannerAt = appSrc.indexOf('${wadaProfileBannerHtml(customer)}');
  const stripAt = appSrc.indexOf('${profileHeaderStripSectionHtml}', bannerAt);
  const groupsAt = appSrc.indexOf('${profileInfoGroupsHtml}', stripAt);
  assert.ok(bannerAt > 0, 'wada banner is in the profile template');
  assert.ok(stripAt > bannerAt, 'strip sits after the wada banner');
  assert.ok(groupsAt > stripAt, 'strip sits before the field groups');
  const stampAt = appSrc.indexOf('${profileFreshnessStampMarkup}');
  assert.ok(stampAt > stripAt, 'freshness stamp sits after the strip');
  assert.ok(stampAt < groupsAt, 'freshness stamp sits before the field groups');
});

test('styles: the stamp rules exist and reuse an existing colour only', () => {
  for (const cls of ['.profile-freshness-stamp', '.dfs-stamp', '.dfs-none']) {
    assert.ok(stylesSrc.includes(cls), `styles must define ${cls}`);
  }
  const stripped = stylesSrc.replace(/\.profile-freshness-stamp[^{]*\{[^}]*\}|\.dfs-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.profile-freshness-stamp[^{]*\{[^}]*\}|\.dfs-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'freshness stamp styles exist');
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('language: both tables carry the freshness stamp labels', () => {
  // Count `key:` (with the colon) so a key is not also counted inside
  // a longer key that starts with it.
  for (const key of ['prof_dfs_heading', 'prof_dfs_checked_on', 'prof_dfs_never_checked']) {
    assert.equal(langSrc.split(`${key}:`).length - 1, 2, `${key} must appear once per language table`);
  }
});
