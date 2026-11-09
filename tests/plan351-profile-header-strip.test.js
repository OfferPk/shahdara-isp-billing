import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validProfileHeaderStripDay,
  buildProfileHeaderStrip,
  profileHeaderStripText,
  profileHeaderStripHtml,
} from '../profile-header-strip.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'profile-header-strip.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function baseStrip(overrides = {}) {
  return {
    customerId: 'CUST-1',
    customerName: 'Test Customer',
    outstanding: 3000,
    packageLabel: '5 Mbps — 200 GB',
    packagePrice: 2000,
    lastPayment: { date: '2026-10-19', amount: 2000 },
    nextDueDate: '2026-11-05',
    ...overrides,
  };
}

test('build carries the fixture figures verbatim', () => {
  const strip = buildProfileHeaderStrip(baseStrip());
  assert.equal(strip.customerId, 'CUST-1');
  assert.equal(strip.customerName, 'Test Customer');
  assert.equal(strip.duesCents, 300000);
  assert.equal(strip.dues, 3000);
  assert.equal(strip.packageLabel, '5 Mbps — 200 GB');
  assert.equal(strip.packagePriceCents, 200000);
  assert.equal(strip.packagePrice, 2000);
  assert.deepEqual(strip.lastPayment, { amountCents: 200000, amount: 2000, date: '2026-10-19' });
  assert.equal(strip.nextDueDate, '2026-11-05');
});

test('build refuses a missing or unusable outstanding figure, never zero-fills it', () => {
  for (const outstanding of [undefined, null, '', '  ', -1, -0.5, NaN, Infinity, true, false, 'abc']) {
    assert.equal(buildProfileHeaderStrip(baseStrip({ outstanding })), null, String(outstanding));
  }
});

test('outstanding accepts digit strings and whole-number figures', () => {
  assert.equal(buildProfileHeaderStrip(baseStrip({ outstanding: '3000' })).duesCents, 300000);
  assert.equal(buildProfileHeaderStrip(baseStrip({ outstanding: 1500.25 })).duesCents, 150025);
  assert.equal(buildProfileHeaderStrip(baseStrip({ outstanding: 0 })).duesCents, 0);
});

test('zero dues read as no amount due in text and html', () => {
  const strip = buildProfileHeaderStrip(baseStrip({ outstanding: 0 }));
  assert.match(profileHeaderStripText(strip), /No amount due\./);
  assert.match(profileHeaderStripHtml(strip), /No amount due/);
  assert.doesNotMatch(profileHeaderStripText(strip), /Dues PKR/);
});

// Plan 502: the package is a value the operator never entered, so the
// strip reads "Not set" now (was "No package recorded") — the same
// wording as the view's Service group for the same absence.
test('a missing package label reads as not set, never blank', () => {
  for (const packageLabel of [undefined, null, '', '   ']) {
    const strip = buildProfileHeaderStrip(baseStrip({ packageLabel }));
    assert.equal(strip.packageLabel, 'Not set');
    assert.match(profileHeaderStripText(strip), /Package Not set/);
  }
  const bare = buildProfileHeaderStrip(baseStrip({ packageLabel: '', packagePrice: null }));
  assert.match(profileHeaderStripText(bare), /Package Not set\./);
});

test('a missing package price is shown without a price, never guessed', () => {
  for (const packagePrice of [undefined, null, '', 'abc', -5]) {
    const strip = buildProfileHeaderStrip(baseStrip({ packagePrice }));
    assert.equal(strip.packagePriceCents, null);
    assert.equal(strip.packagePrice, null);
    assert.match(profileHeaderStripText(strip), /Package 5 Mbps — 200 GB\./);
    assert.doesNotMatch(profileHeaderStripText(strip), /\/month/);
  }
});

test('package price accepts a digit string', () => {
  const strip = buildProfileHeaderStrip(baseStrip({ packagePrice: '2000' }));
  assert.equal(strip.packagePriceCents, 200000);
  assert.equal(strip.packagePrice, 2000);
});

test('a customer with no payment yet reads no payment yet, never a blank', () => {
  for (const lastPayment of [undefined, null, {}, { date: '2026-10-19' }, { amount: 2000 }]) {
    const strip = buildProfileHeaderStrip(baseStrip({ lastPayment }));
    assert.equal(strip.lastPayment, null);
    assert.match(profileHeaderStripText(strip), /No payment yet\./);
    assert.match(profileHeaderStripHtml(strip), /No payment yet/);
  }
});

test('a last payment needs a positive amount and a strict date', () => {
  for (const lastPayment of [
    { date: '2026-10-19', amount: 0 },
    { date: '2026-10-19', amount: -50 },
    { date: '2026-02-30', amount: 2000 },
    { date: 'not-a-date', amount: 2000 },
    { date: '2026-10-19', amount: 'abc' },
  ]) {
    const strip = buildProfileHeaderStrip(baseStrip({ lastPayment }));
    assert.equal(strip.lastPayment, null, JSON.stringify(lastPayment));
  }
});

test('a last payment takes only the date part of a datetime string', () => {
  const strip = buildProfileHeaderStrip(baseStrip({ lastPayment: { date: '2026-10-19T10:00:00', amount: 2000 } }));
  assert.equal(strip.lastPayment.date, '2026-10-19');
});

test('a missing next due date reads as not recorded, never invented', () => {
  for (const nextDueDate of [undefined, null, '', '  ']) {
    const strip = buildProfileHeaderStrip(baseStrip({ nextDueDate }));
    assert.equal(strip.nextDueDate, null);
    assert.match(profileHeaderStripText(strip), /Next due date not recorded\./);
    assert.match(profileHeaderStripHtml(strip), /Not recorded/);
  }
});

test('a bad next due date is dropped, never shown', () => {
  for (const nextDueDate of ['2026-02-30', '2026-13-01', 'not-a-date', '2026-11-5']) {
    const strip = buildProfileHeaderStrip(baseStrip({ nextDueDate }));
    assert.equal(strip.nextDueDate, null, nextDueDate);
  }
});

test('strict dates: leap years and month lengths are honoured', () => {
  assert.equal(validProfileHeaderStripDay('2028-02-29'), '2028-02-29');
  assert.equal(validProfileHeaderStripDay('2026-02-29'), null);
  assert.equal(validProfileHeaderStripDay('2026-02-30'), null);
  assert.equal(validProfileHeaderStripDay('2026-04-31'), null);
  assert.equal(validProfileHeaderStripDay('2026-04-30'), '2026-04-30');
  assert.equal(validProfileHeaderStripDay('2026-13-01'), null);
  assert.equal(validProfileHeaderStripDay('2026-00-10'), null);
  assert.equal(validProfileHeaderStripDay('2026-11-00'), null);
  assert.equal(validProfileHeaderStripDay('garbage'), null);
  assert.equal(validProfileHeaderStripDay(''), null);
  assert.equal(validProfileHeaderStripDay('2026-11-05T10:00:00'), '2026-11-05');
});

test('text carries all four figures on the same fixture', () => {
  const strip = buildProfileHeaderStrip(baseStrip());
  const textOut = profileHeaderStripText(strip);
  assert.match(textOut, /Dues PKR 3000\./);
  assert.match(textOut, /Package 5 Mbps — 200 GB \(PKR 2000\/month\)\./);
  assert.match(textOut, /Last payment PKR 2000 on 2026-10-19\./);
  assert.match(textOut, /Next due 2026-11-05\./);
});

test('a custom amount formatter is honoured in text and html', () => {
  const strip = buildProfileHeaderStrip(baseStrip());
  const format = (value) => `Rs ${value}`;
  assert.match(profileHeaderStripText(strip, format), /Dues Rs 3000\./);
  assert.match(profileHeaderStripHtml(strip, format), /Rs 3000/);
  assert.match(profileHeaderStripHtml(strip, format), /Rs 2000\/month/);
});

test('html carries the four figures under the phs strip id', () => {
  const html = profileHeaderStripHtml(buildProfileHeaderStrip(baseStrip()));
  assert.match(html, /id="phsStrip"/);
  assert.match(html, /Dues/);
  assert.match(html, /PKR 3000/);
  assert.match(html, /5 Mbps — 200 GB/);
  assert.match(html, /PKR 2000\/month/);
  assert.match(html, /Last payment/);
  assert.match(html, /2026-10-19/);
  assert.match(html, /Next due/);
  assert.match(html, /2026-11-05/);
});

test('html escapes a hostile package label', () => {
  const strip = buildProfileHeaderStrip(baseStrip({ packageLabel: '<script>alert(1)</script>' }));
  const html = profileHeaderStripHtml(strip);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('text and html handle a missing strip plainly', () => {
  assert.equal(profileHeaderStripText(null), 'Profile header strip unavailable.');
  assert.equal(profileHeaderStripHtml(null), '');
  assert.equal(profileHeaderStripHtml(undefined), '');
});

test('inputs are never mutated', () => {
  const input = deepFreeze(baseStrip());
  const strip = buildProfileHeaderStrip(input);
  assert.equal(strip.duesCents, 300000);
  assert.equal(input.outstanding, 3000);
  assert.equal(input.lastPayment.amount, 2000);
  profileHeaderStripText(strip);
  profileHeaderStripHtml(strip);
  assert.equal(input.outstanding, 3000);
});

test('module is pure: no storage, clock, network, document, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'shahdara_', 'OLT']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('module never names a fenced neighbour file literally', () => {
  for (const banned of ['balance-reply', 'profile-ui', 'customer-completeness', 'profile-completion', 'profile-field-save', 'profile-error-jump']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
});

test('wiring: app.js imports the strip module', () => {
  assert.ok(appJs.includes("import { buildProfileHeaderStrip, profileHeaderStripHtml } from './profile-header-strip.js';"));
});

test('wiring: the strip is built from the profile balance figures in renderCustomerProfileView', () => {
  assert.ok(appJs.includes('buildProfileHeaderStrip({'));
  assert.ok(appJs.includes('balanceReplyCurrent ? balanceReplyCurrent.outstanding : null'));
  assert.ok(appJs.includes('balanceReplyCurrent ? balanceReplyCurrent.lastPayment : null'));
  assert.ok(appJs.includes('balanceReplyCurrent ? balanceReplyCurrent.dueDate : null'));
  assert.ok(appJs.includes('profileHeaderStripHtml(profileHeaderStrip, formatAmount)'));
});

test('wiring: the strip sits at the top of the profile, after the wada banner and before the field groups', () => {
  // Polish #28 Phase A — the profile renders as 7 <details> sections:
  // the strip sits in the assembly above every section, the wada banner
  // opens the Financial section, and the field groups are fragments
  // inside the section bodies. The old flat order (banner → strip →
  // groups) no longer exists; the preserved intent is strip above the
  // sections, banner first in Financial, groups inside their sections.
  const stripAt = appJs.indexOf('${profileHeaderStripSectionHtml}');
  const customerAt = appJs.indexOf('${profileSectionCustomerHtml}', stripAt);
  const historyAt = appJs.indexOf('${profileSectionHistoryHtml}', customerAt);
  assert.ok(stripAt > 0, 'strip is in the profile assembly');
  assert.ok(customerAt > stripAt, 'sections sit after the strip');
  assert.ok(historyAt > customerAt, 'sections render in order');
  const financialAt = appJs.indexOf('const profileSectionFinancialBody = ');
  const financialBody = appJs.slice(financialAt, appJs.indexOf('\n', financialAt));
  assert.ok(financialBody.indexOf('${wadaProfileBannerHtml(customer)}') < financialBody.indexOf('${duesBreakdownSectionMarkup}'), 'wada banner opens the Financial section');
  assert.ok(appJs.includes('profileInfoGroupFragments.contact'), 'field groups live on as fragments');
});

test('wiring: no store is added for the strip — it is composed live, never saved', () => {
  assert.ok(!appJs.includes('loadProfileHeaderStrip'));
  assert.ok(!appJs.includes('saveProfileHeaderStrip'));
  assert.ok(!appJs.includes('shahdara_phs'));
});

test('the strip lives in the profile view, not as a standalone panel in index.html', () => {
  assert.ok(!indexHtml.includes('phsStrip'));
});
