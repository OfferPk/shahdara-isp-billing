import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_VERIFICATION_TICK_STORE_KEY,
  PROFILE_VERIFICATION_TICK_BY_MAX_LENGTH,
  PROFILE_VERIFICATION_TICK_FIELDS,
  isStrictProfileVerificationTickDate,
  cleanProfileVerificationTickFields,
  normalizeProfileVerificationTick,
  normalizeProfileVerificationTickList,
  recordProfileVerificationTick,
  removeProfileVerificationTick,
  profileVerificationTickForCustomer,
  hasProfileVerificationTick,
  profileVerificationTickSummaryText,
  profileVerificationTickSectionHtml,
} from '../profile-verification-tick.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'profile-verification-tick.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan372-profile-verification-tick.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return { id: 'CUST-1', name: 'Test Customer', ...overrides };
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

test('Plan 372: strict dates accept real calendar days and refuse impossible ones', () => {
  assert.equal(isStrictProfileVerificationTickDate('2024-02-29'), true);
  assert.equal(isStrictProfileVerificationTickDate('2026-11-06'), true);
  assert.equal(isStrictProfileVerificationTickDate('2025-02-29'), false);
  assert.equal(isStrictProfileVerificationTickDate('2026-02-30'), false);
  assert.equal(isStrictProfileVerificationTickDate('2026-13-01'), false);
  assert.equal(isStrictProfileVerificationTickDate('2026-00-10'), false);
  assert.equal(isStrictProfileVerificationTickDate('2026-11-00'), false);
  assert.equal(isStrictProfileVerificationTickDate('2026-11-6'), false);
  assert.equal(isStrictProfileVerificationTickDate('06/11/2026'), false);
  assert.equal(isStrictProfileVerificationTickDate(''), false);
  assert.equal(isStrictProfileVerificationTickDate(null), false);
  assert.equal(isStrictProfileVerificationTickDate(20261106), false);
});

test('Plan 372: normalize keeps a valid tick and trims and caps the verifier', () => {
  const normalized = normalizeProfileVerificationTick(tick({ verifiedBy: `  ${'A'.repeat(70)}  ` }));
  assert.equal(normalized.verifiedBy.length, PROFILE_VERIFICATION_TICK_BY_MAX_LENGTH);
  assert.equal(normalized.verifiedBy, 'A'.repeat(60));
  assert.deepEqual(normalizeProfileVerificationTick(tick()).fieldsChecked, ['name', 'number', 'mohalla', 'package']);
});

test('Plan 372: normalize refuses a tick with no id, no customer, no verifier, no strict date, or no field checked', () => {
  assert.equal(normalizeProfileVerificationTick(tick({ id: '  ' })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ customerId: '' })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ verifiedBy: '   ' })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ verifiedDate: '' })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ verifiedDate: '2025-02-29' })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ fieldsChecked: [] })), null);
  assert.equal(normalizeProfileVerificationTick(tick({ fieldsChecked: ['unknown'] })), null);
  assert.equal(normalizeProfileVerificationTick(null), null);
  assert.equal(normalizeProfileVerificationTick('not an object'), null);
});

test('Plan 372: fields-checked cleaning keeps the known fields in fixed order, deduped', () => {
  assert.deepEqual(cleanProfileVerificationTickFields(['package', 'name', 'name', 'bogus', 'mohalla']), ['name', 'mohalla', 'package']);
  assert.deepEqual(cleanProfileVerificationTickFields(['number', 'NUMBER']), ['number']);
  assert.deepEqual(cleanProfileVerificationTickFields('name'), []);
  assert.deepEqual(cleanProfileVerificationTickFields(null), []);
  assert.deepEqual(PROFILE_VERIFICATION_TICK_FIELDS, ['name', 'number', 'mohalla', 'package']);
});

test('Plan 372: normalize list dedupes by id and by customer, first wins, and drops invalid ticks', () => {
  const list = normalizeProfileVerificationTickList([
    tick(),
    tick({ id: 'PVT-1', verifiedBy: 'Other' }),
    tick({ id: 'PVT-2', customerId: 'cust-1' }),
    tick({ id: 'PVT-3', customerId: 'CUST-2', verifiedBy: 'Saad' }),
    tick({ id: 'PVT-4', verifiedDate: '2025-02-29' }),
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].verifiedBy, 'Saad');
  assert.equal(list[1].customerId, 'CUST-2');
  assert.deepEqual(normalizeProfileVerificationTickList('not a list'), []);
  assert.deepEqual(normalizeProfileVerificationTickList(null), []);
});

test('Plan 372: record adds a tick and replaces in place for the same customer, case-insensitive', () => {
  const added = recordProfileVerificationTick([], tick());
  assert.equal(added.length, 1);
  const replaced = recordProfileVerificationTick(added, tick({ id: 'PVT-9', verifiedBy: 'Owner', verifiedDate: '2026-11-07', fieldsChecked: ['name'] }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'PVT-9');
  assert.equal(replaced[0].verifiedBy, 'Owner');
  const otherCase = recordProfileVerificationTick(added, tick({ id: 'PVT-8', customerId: 'cust-1', verifiedBy: 'Owner' }));
  assert.equal(otherCase.length, 1);
  assert.equal(otherCase[0].id, 'PVT-8');
  const second = recordProfileVerificationTick(added, tick({ id: 'PVT-2', customerId: 'CUST-2' }));
  assert.equal(second.length, 2);
});

test('Plan 372: record leaves the list unchanged for an invalid tick and never mutates its input', () => {
  const before = [tick()];
  const snapshot = JSON.stringify(before);
  assert.deepEqual(recordProfileVerificationTick(before, tick({ verifiedBy: '' })), [tick()]);
  assert.equal(JSON.stringify(before), snapshot);
  const recorded = recordProfileVerificationTick(before, tick({ id: 'PVT-2', customerId: 'CUST-2' }));
  assert.equal(recorded.length, 2);
  assert.equal(JSON.stringify(before), snapshot);
});

test('Plan 372: remove drops only that customer tick', () => {
  const list = [tick(), tick({ id: 'PVT-2', customerId: 'CUST-2' })];
  assert.deepEqual(removeProfileVerificationTick(list, 'cust-1'), [tick({ id: 'PVT-2', customerId: 'CUST-2' })]);
  assert.deepEqual(removeProfileVerificationTick(list, 'CUST-9'), list);
  assert.deepEqual(removeProfileVerificationTick(list, ''), list);
});

test('Plan 372: lookup is case-insensitive and returns null when there is no tick', () => {
  const list = [tick()];
  assert.equal(profileVerificationTickForCustomer(list, 'cust-1').id, 'PVT-1');
  assert.equal(profileVerificationTickForCustomer(list, 'CUST-9'), null);
  assert.equal(profileVerificationTickForCustomer(list, ''), null);
  assert.equal(hasProfileVerificationTick(list, 'CUST-1'), true);
  assert.equal(hasProfileVerificationTick(list, 'CUST-2'), false);
  assert.equal(hasProfileVerificationTick([], 'CUST-1'), false);
});

test('Plan 372: summary text counts verified profiles in plain words', () => {
  assert.equal(profileVerificationTickSummaryText([]), 'No profile verified yet.');
  assert.equal(profileVerificationTickSummaryText([tick()]), '1 profile verified.');
  assert.equal(profileVerificationTickSummaryText([tick(), tick({ id: 'PVT-2', customerId: 'CUST-2' })]), '2 profiles verified.');
});

test('Plan 372: section shows the verifier, the date, and which fields were checked', () => {
  const html = profileVerificationTickSectionHtml(customer(), [tick()], {});
  assert.match(html, /✓ Saad/);
  assert.match(html, /2026-11-06/);
  assert.match(html, /Name, Number, Mohalla, Package/);
  assert.match(html, /id="pvtForm"/);
  assert.match(html, /id="pvtBy"/);
  assert.match(html, /id="pvtDate"/);
  assert.match(html, /id="pvtSaveBtn"/);
  assert.match(html, /id="pvtRemoveBtn"/);
  assert.match(html, /profile-verification-tick/);
  assert.match(html, /name="pvtField" value="name" checked/);
  assert.match(html, /name="pvtField" value="package" checked/);
});

test('Plan 372: a tick with only some fields checked shows only those fields', () => {
  const html = profileVerificationTickSectionHtml(customer(), [tick({ fieldsChecked: ['number', 'package'] })], {});
  assert.match(html, /Number, Package/);
  assert.ok(!html.includes('Name, Number'));
  assert.match(html, /name="pvtField" value="number" checked/);
  assert.ok(!html.includes('name="pvtField" value="name" checked'));
});

test('Plan 372: a profile never verified shows the none line and the add form, never a tick', () => {
  const html = profileVerificationTickSectionHtml(customer(), [], { none: 'Not verified yet.' });
  assert.match(html, /Not verified yet\./);
  assert.ok(!html.includes('pvt-current'));
  assert.match(html, /id="pvtForm"/);
  assert.ok(!html.includes('pvtRemoveBtn'));
  assert.match(html, /name="pvtField" value="name" checked/);
  assert.equal(profileVerificationTickSectionHtml(null, [tick()]), '');
  assert.equal(profileVerificationTickSectionHtml('not an object', [tick()]), '');
});

test('Plan 372: section escapes the verifier text and honours caller labels', () => {
  const html = profileVerificationTickSectionHtml(
    customer(),
    [tick({ verifiedBy: '<script>alert(1)</script>' })],
    { heading: 'Tasdeeq', verifiedBy: 'Kis ne', none: 'Abhi nahi', fields: { name: 'Naam', number: 'Number', mohalla: 'Mohalla', package: 'Package' } },
  );
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Tasdeeq/);
  assert.match(html, /Kis ne/);
  assert.match(html, /Naam, Number, Mohalla, Package/);
});

test('Plan 372: module is pure — no page, storage, clock, network, or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  assert.equal(PROFILE_VERIFICATION_TICK_STORE_KEY, 'shahdara_pvt_ticks_v1');
});

test('Plan 372: module and tests never name the fenced neighbours literally', () => {
  const fenced = [
    ['backup', 'verification'].join('-') + '.js',
    ['export', 'verification'].join('-') + '.js',
    ['receipt', 'verifier'].join('-') + '.js',
    ['restore', 'verification'].join('-') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `tests name fenced file ${name}`);
  }
});

test('Plan 372: styles reuse existing colours only — no new hex in verification-tick rules', () => {
  assert.ok(stylesSrc.includes('.profile-verification-tick'));
  assert.ok(stylesSrc.includes('.pvt-form'));
  const rules = stylesSrc.match(/\.pvt-[^{]+\{[^}]*\}|\.profile-verification-tick[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0);
  const baseline = stylesSrc.replace(/\.pvt-[^{]+\{[^}]*\}|\.profile-verification-tick[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map(hex => hex.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 372: app.js wires the tick after the last-interaction line and before the household link', () => {
  assert.ok(appSrc.includes("from './profile-verification-tick.js'"));
  assert.ok(appSrc.includes('loadProfileVerificationTicks'));
  assert.ok(appSrc.includes('saveProfileVerificationTicks'));
  assert.ok(appSrc.includes('profileVerificationTickSectionMarkup'));
  // Order, not adjacency: the Plan 373 temporarily-away flag section
  // now sits between the verification tick and the household link, so
  // the tick is still after the last-interaction line and still before
  // the household link.
  const lastAt = appSrc.indexOf('${lastInteractionLineMarkup}');
  const tickAt = appSrc.indexOf('${profileVerificationTickSectionMarkup}');
  const awayAt = appSrc.indexOf('${temporarilyAwayFlagSectionMarkup}');
  const householdAt = appSrc.indexOf('${householdLinkSectionMarkup}');
  assert.ok(lastAt > 0 && tickAt > lastAt && awayAt > tickAt && householdAt > awayAt);
  assert.ok(appSrc.includes('profileVerificationTickSectionEl'));
  assert.ok(appSrc.includes("querySelector('#pvtForm')"));
  assert.ok(appSrc.includes("querySelector('#pvtRemoveBtn')"));
});

test('Plan 372: language tables carry the verification-tick labels in both languages', () => {
  for (const key of ['prof_pvt_heading', 'prof_pvt_intro', 'prof_pvt_verified_by', 'prof_pvt_date', 'prof_pvt_fields', 'prof_pvt_field_name', 'prof_pvt_field_number', 'prof_pvt_field_mohalla', 'prof_pvt_field_package', 'prof_pvt_remove', 'prof_pvt_none']) {
    assert.equal(langSrc.split(key).length - 1, 2, `${key} must appear once per language table`);
  }
});

test('Plan 372: profile order still holds — banner, then strip, then groups', () => {
  const bannerAt = appSrc.indexOf('wadaProfileBannerHtml(customer)');
  const stripAt = appSrc.indexOf('profileHeaderStripSectionHtml}');
  const groupsAt = appSrc.indexOf('profileInfoGroupsHtml}');
  assert.ok(bannerAt > 0 && stripAt > bannerAt && groupsAt > stripAt);
});

test('Plan 372: no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
});

test('Plan 372: recording a tick never changes any bill, payment, or customer field', () => {
  // The module owns only its own tick list: record/remove return a new
  // list of ticks and never touch any other record shape.
  const before = [tick()];
  const recorded = recordProfileVerificationTick(before, tick({ id: 'PVT-2', customerId: 'CUST-2' }));
  assert.equal(recorded.length, 2);
  assert.deepEqual(recorded[0], tick());
  assert.equal(Object.keys(recorded[0]).sort().join(','), 'customerId,fieldsChecked,id,verifiedBy,verifiedDate');
  const removed = removeProfileVerificationTick(recorded, 'CUST-1');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].customerId, 'CUST-2');
});
