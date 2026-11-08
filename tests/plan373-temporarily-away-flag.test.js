import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEMPORARILY_AWAY_FLAG_STORE_KEY,
  isStrictTemporarilyAwayDate,
  normalizeTemporarilyAwayFlag,
  normalizeTemporarilyAwayFlagList,
  loadTemporarilyAwayFlagList,
  recordTemporarilyAwayFlag,
  removeTemporarilyAwayFlag,
  temporarilyAwayFlagForCustomer,
  hasTemporarilyAwayFlag,
  isTemporarilyAwayFlagActive,
  temporarilyAwayFlagText,
  temporarilyAwayLineHtml,
  temporarilyAwayFlagSectionHtml,
} from '../temporarily-away-flag.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'temporarily-away-flag.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan373-temporarily-away-flag.test.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const roundsSrc = readFileSync(join(dir, '..', 'nav-collection-rounds.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
const FLAG = {
  id: 'TAW-1',
  customerId: 'CUST-1',
  awayFrom: '2026-11-20',
  returnDate: '2026-12-01',
  note: 'Harvest in the village',
};

const FLAG_NO_RETURN = {
  id: 'TAW-2',
  customerId: 'CUST-2',
  awayFrom: '2026-11-22',
  returnDate: '',
  note: '',
};

test('Plan 373: strict dates accept real calendar dates, including leap day', () => {
  assert.equal(isStrictTemporarilyAwayDate('2026-11-20'), true);
  assert.equal(isStrictTemporarilyAwayDate('2024-02-29'), true);
  assert.equal(isStrictTemporarilyAwayDate('2026-01-31'), true);
});

test('Plan 373: strict dates refuse impossible dates and bad shapes', () => {
  assert.equal(isStrictTemporarilyAwayDate('2023-02-29'), false);
  assert.equal(isStrictTemporarilyAwayDate('2026-02-30'), false);
  assert.equal(isStrictTemporarilyAwayDate('2026-13-01'), false);
  assert.equal(isStrictTemporarilyAwayDate('2026-11-31'), false);
  assert.equal(isStrictTemporarilyAwayDate('2026/11/20'), false);
  assert.equal(isStrictTemporarilyAwayDate('20-11-2026'), false);
  assert.equal(isStrictTemporarilyAwayDate(''), false);
  assert.equal(isStrictTemporarilyAwayDate(null), false);
  assert.equal(isStrictTemporarilyAwayDate(20261120), false);
});

test('Plan 373: normalize keeps a valid flag with return date and note', () => {
  assert.deepEqual(normalizeTemporarilyAwayFlag(FLAG), FLAG);
});

test('Plan 373: normalize keeps a flag with no return date and no note', () => {
  assert.deepEqual(normalizeTemporarilyAwayFlag(FLAG_NO_RETURN), FLAG_NO_RETURN);
});

test('Plan 373: normalize refuses a flag with no id, no customer, or no strict away-from date', () => {
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, id: '' }), null);
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, customerId: '  ' }), null);
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, awayFrom: '2026-02-30' }), null);
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, awayFrom: '' }), null);
  assert.equal(normalizeTemporarilyAwayFlag(null), null);
  assert.equal(normalizeTemporarilyAwayFlag('2026-11-20'), null);
});

test('Plan 373: normalize refuses a return date before the away-from date or an invalid return date', () => {
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, returnDate: '2026-11-19' }), null);
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, returnDate: '2026-13-01' }), null);
  assert.equal(normalizeTemporarilyAwayFlag({ ...FLAG, returnDate: 'soon' }), null);
  // A return on the away-from day itself is fine.
  assert.notEqual(normalizeTemporarilyAwayFlag({ ...FLAG, returnDate: '2026-11-20' }), null);
});

test('Plan 373: normalize caps the note at 200 chars and trims the fields', () => {
  const long = normalizeTemporarilyAwayFlag({ ...FLAG, note: `  ${'x'.repeat(250)}  ` });
  assert.equal(long.note.length, 200);
  assert.equal(long.id, 'TAW-1');
  assert.equal(long.customerId, 'CUST-1');
});

test('Plan 373: normalize list dedupes by id and by customer, first wins', () => {
  const list = normalizeTemporarilyAwayFlagList([
    FLAG,
    { ...FLAG, id: 'TAW-9', note: 'Second flag for the same customer' },
    { ...FLAG_NO_RETURN, id: 'TAW-1' },
    FLAG_NO_RETURN,
    { ...FLAG, awayFrom: '2026-02-30' },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'TAW-1');
  assert.equal(list[0].note, 'Harvest in the village');
  assert.equal(list[1].id, 'TAW-2');
  assert.deepEqual(normalizeTemporarilyAwayFlagList(null), []);
  assert.deepEqual(normalizeTemporarilyAwayFlagList('not a list'), []);
});

test('Plan 373: record replaces in place for the same customer and appends a new one', () => {
  const replaced = recordTemporarilyAwayFlag([FLAG], { ...FLAG, id: 'TAW-3', note: 'Family visit' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'TAW-3');
  assert.equal(replaced[0].note, 'Family visit');
  const appended = recordTemporarilyAwayFlag([FLAG], FLAG_NO_RETURN);
  assert.equal(appended.length, 2);
  assert.equal(appended[1].id, 'TAW-2');
});

test('Plan 373: record leaves the list unchanged for an invalid flag', () => {
  const before = [FLAG];
  const next = recordTemporarilyAwayFlag(before, { ...FLAG, customerId: 'CUST-3', returnDate: '2026-11-01' });
  assert.deepEqual(next, [FLAG]);
});

test('Plan 373: remove clears only that customer flag', () => {
  assert.deepEqual(removeTemporarilyAwayFlag([FLAG, FLAG_NO_RETURN], 'cust-1'), [FLAG_NO_RETURN]);
  assert.deepEqual(removeTemporarilyAwayFlag([FLAG], 'CUST-9'), [FLAG]);
  assert.deepEqual(removeTemporarilyAwayFlag([FLAG], ''), [FLAG]);
});

test('Plan 373: lookup matches case-insensitively and reports presence', () => {
  assert.deepEqual(temporarilyAwayFlagForCustomer([FLAG, FLAG_NO_RETURN], 'cust-1'), FLAG);
  assert.equal(temporarilyAwayFlagForCustomer([FLAG], 'CUST-9'), null);
  assert.equal(temporarilyAwayFlagForCustomer([], 'CUST-1'), null);
  assert.equal(temporarilyAwayFlagForCustomer(null, 'CUST-1'), null);
  assert.equal(hasTemporarilyAwayFlag([FLAG], 'CUST-1'), true);
  assert.equal(hasTemporarilyAwayFlag([FLAG], 'CUST-2'), false);
});

test('Plan 373: a flag is active from the away-from date up to and including the return date', () => {
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-11-20'), true);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-11-25'), true);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-12-01'), true);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-11-19'), false);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-12-02'), false);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, '2026-02-30'), false);
  assert.equal(isTemporarilyAwayFlagActive(FLAG, null), false);
  assert.equal(isTemporarilyAwayFlagActive(null, '2026-11-25'), false);
});

test('Plan 373: a flag with no return date stays active from the away-from date on', () => {
  assert.equal(isTemporarilyAwayFlagActive(FLAG_NO_RETURN, '2026-11-22'), true);
  assert.equal(isTemporarilyAwayFlagActive(FLAG_NO_RETURN, '2027-01-15'), true);
  assert.equal(isTemporarilyAwayFlagActive(FLAG_NO_RETURN, '2026-11-21'), false);
});

test('Plan 373: flag text names the return date, or the away-from date when no return is known', () => {
  assert.equal(temporarilyAwayFlagText(FLAG), 'Away until 2026-12-01 · Harvest in the village');
  assert.equal(
    temporarilyAwayFlagText(FLAG_NO_RETURN),
    'Away since 2026-11-22 · return date not known',
  );
  assert.equal(temporarilyAwayFlagText(null), '');
  assert.equal(temporarilyAwayFlagText({ ...FLAG, note: '' }), 'Away until 2026-12-01');
});

test('Plan 373: flag text honours caller label templates with a date placeholder', () => {
  const labels = { awayUntil: '{date} تک باہر', awaySince: '{date} سے باہر', noReturnDate: 'واپسی کی تاریخ معلوم نہیں' };
  assert.equal(temporarilyAwayFlagText(FLAG, labels), '2026-12-01 تک باہر · Harvest in the village');
  assert.equal(
    temporarilyAwayFlagText(FLAG_NO_RETURN, labels),
    '2026-11-22 سے باہر · واپسی کی تاریخ معلوم نہیں',
  );
});

test('Plan 373: round-list line shows only while the flag is active today', () => {
  const html = temporarilyAwayLineHtml(FLAG, '2026-11-25');
  assert.ok(html.includes('Away until 2026-12-01'));
  assert.ok(html.includes('Harvest in the village'));
  assert.ok(html.includes('taw-route-line'));
  assert.equal(temporarilyAwayLineHtml(FLAG, '2026-11-19'), '');
  assert.equal(temporarilyAwayLineHtml(FLAG, '2026-12-02'), '');
  assert.equal(temporarilyAwayLineHtml(null, '2026-11-25'), '');
  const noReturnHtml = temporarilyAwayLineHtml(FLAG_NO_RETURN, '2026-12-15');
  assert.ok(noReturnHtml.includes('Away since 2026-11-22'));
  assert.ok(noReturnHtml.includes('return date not known'));
});

test('Plan 373: round-list line escapes the note', () => {
  const html = temporarilyAwayLineHtml({ ...FLAG, note: '<script>alert(1)</script>' }, '2026-11-25');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('Plan 373: profile section shows the current flag and the edit form', () => {
  const html = temporarilyAwayFlagSectionHtml({ id: 'CUST-1', name: 'Customer One' }, [FLAG], {});
  assert.ok(html.includes('Temporarily away'));
  assert.ok(html.includes('Away until 2026-12-01'));
  assert.ok(html.includes('Harvest in the village'));
  assert.ok(html.includes('value="2026-11-20"'));
  assert.ok(html.includes('value="2026-12-01"'));
  assert.ok(html.includes('id="tawForm"'));
  assert.ok(html.includes('id="tawRemoveBtn"'));
  assert.ok(html.includes('temporarily-away-flag'));
});

test('Plan 373: profile section shows the none line and the add form when no flag exists', () => {
  const html = temporarilyAwayFlagSectionHtml({ id: 'CUST-1', name: 'Customer One' }, [], {});
  assert.ok(html.includes('Not away — no flag recorded.'));
  assert.ok(html.includes('id="tawForm"'));
  assert.ok(!html.includes('tawRemoveBtn'));
  assert.ok(!html.includes('2026-'));
  assert.equal(temporarilyAwayFlagSectionHtml(null, [FLAG], {}), '');
});

test('Plan 373: profile section escapes the note and uses plain defaults', () => {
  const html = temporarilyAwayFlagSectionHtml(
    { id: 'CUST-1', name: 'Customer One' },
    [{ ...FLAG, note: 'A & B <shop>' }],
    {},
  );
  assert.ok(html.includes('A &amp; B &lt;shop&gt;'));
  assert.ok(html.includes('Away from'));
  assert.ok(html.includes('Expected return'));
});

test('Plan 373: storage loader reads the flag list and tolerates bad storage', () => {
  const storage = {
    getItem: (key) => (key === TEMPORARILY_AWAY_FLAG_STORE_KEY ? JSON.stringify([FLAG]) : null),
  };
  assert.deepEqual(loadTemporarilyAwayFlagList(storage), [FLAG]);
  assert.deepEqual(loadTemporarilyAwayFlagList({ getItem: () => null }), []);
  assert.deepEqual(loadTemporarilyAwayFlagList({ getItem: () => 'not json' }), []);
  assert.deepEqual(loadTemporarilyAwayFlagList(null), []);
  assert.deepEqual(loadTemporarilyAwayFlagList(undefined), []);
});

test('Plan 373: module is pure — no storage, clock, network, page or import', () => {
  assert.ok(!moduleSrc.includes('document.'));
  assert.ok(!moduleSrc.includes('localStorage'));
  assert.ok(!moduleSrc.includes('new Date('));
  assert.ok(!moduleSrc.includes('Date.now('));
  assert.ok(!moduleSrc.includes('fetch('));
  assert.ok(!moduleSrc.includes('window.'));
  assert.ok(!moduleSrc.includes('import '));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  assert.equal(TEMPORARILY_AWAY_FLAG_STORE_KEY, 'shahdara_taw_flags_v1');
});

test('Plan 373: module never names the fenced hold, exit or archive module files literally', () => {
  const fenced = [
    ['vacation', '-holds', '.js'].join(''),
    ['exit', '-reasons', '.js'].join(''),
    ['inactive', '-record', '-archive', '.js'].join(''),
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('Plan 373: styles reuse existing colours only — no new hex in temporarily-away rules', () => {
  const stripped = stylesSrc.replace(/\.temporarily-away-flag[^{]*\{[^}]*\}|\.taw-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.temporarily-away-flag[^{]*\{[^}]*\}|\.taw-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'temporarily-away styles exist');
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 373: app.js wires the flag after the verification tick and before the household link', () => {
  assert.ok(appSrc.includes("from './temporarily-away-flag.js'"));
  assert.ok(appSrc.includes('loadTemporarilyAwayFlags'));
  assert.ok(appSrc.includes('saveTemporarilyAwayFlags'));
  assert.ok(appSrc.includes('temporarilyAwayFlagSectionMarkup'));
  assert.ok(appSrc.includes("querySelector('#tawForm')"));
  assert.ok(appSrc.includes("querySelector('#tawRemoveBtn')"));
  // Order, not adjacency: Plan 514 moved the verification tick into
  // the freshness group after the header strip, so the tick no
  // longer sits between the last-interaction line and this flag.
  // What this pin still guards: the flag sits after the
  // last-interaction line and still before the household link.
  const lastAt = appSrc.indexOf('${lastInteractionLineMarkup}');
  const awayAt = appSrc.indexOf('${temporarilyAwayFlagSectionMarkup}');
  const householdAt = appSrc.indexOf('${householdLinkSectionMarkup}');
  assert.ok(lastAt > 0 && awayAt > lastAt && householdAt > awayAt);
});

test('Plan 373: language tables carry the temporarily-away labels in both languages', () => {
  // Count `key:` (with the colon) so `prof_taw_note` is not also
  // counted inside `prof_taw_note_placeholder`.
  for (const key of ['prof_taw_heading', 'prof_taw_intro', 'prof_taw_away_from', 'prof_taw_return_date', 'prof_taw_note', 'prof_taw_note_placeholder', 'prof_taw_remove', 'prof_taw_none', 'prof_taw_away_until', 'prof_taw_away_since', 'prof_taw_no_return_date']) {
    assert.equal(langSrc.split(`${key}:`).length - 1, 2, `${key} must appear once per language table`);
  }
});

test('Plan 373: profile order still holds — banner, then strip, then groups', () => {
  const bannerAt = appSrc.indexOf('wadaProfileBannerHtml(customer)');
  const stripAt = appSrc.indexOf('profileHeaderStripSectionHtml}');
  const groupsAt = appSrc.indexOf('profileInfoGroupsHtml}');
  assert.ok(bannerAt > 0 && stripAt > bannerAt && groupsAt > stripAt);
});

test('Plan 373: round list shows the away line and skips reminders while flagged', () => {
  assert.ok(roundsSrc.includes("from './temporarily-away-flag.js'"));
  assert.ok(roundsSrc.includes('loadTemporarilyAwayFlagList('));
  assert.ok(roundsSrc.includes('temporarilyAwayFlagForCustomer('));
  assert.ok(roundsSrc.includes('temporarilyAwayLineHtml('));
  assert.ok(roundsSrc.includes('isTemporarilyAwayFlagActive('));
  // The visit-reminder action for a stop is guarded by the away flag:
  // a flagged-away customer gets no WhatsApp reminder link and no
  // copy-reminder button on the round list.
  assert.ok(roundsSrc.includes('const whatsappAction = awayActive'));
  assert.ok(roundsSrc.includes('${awayInfo}'));
});

test('Plan 373: no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
});
