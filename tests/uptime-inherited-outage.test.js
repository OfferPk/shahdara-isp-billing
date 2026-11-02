// SISP-189: Inherited Upstream Daisy-Chain Outage Attribution in
// Customer Uptime. A downstream subscriber's monthly summary may OPT
// IN to the recorded outages of its daisy-chain ancestors
// (upstreamCustomerId): each ancestor's periods are derived by the
// exact collectOfflineIntervals/collectWindowPeriods path an own
// period takes, clipped to the customer's own counted window, and
// every span enters ONE interval union — so a downstream complaint
// overlapping an upstream feeder outage is counted exactly once.
// Pure-function tests on synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMonthlyUptime,
  parsePkDateTime
} from '../uptime-tracking.js';
import { traceUpstreamChain } from '../outage-impact.js';
import { TRANSLATIONS } from '../nav-language.js';

const at = (pkDateTime) => new Date(parsePkDateTime(pkDateTime));
const REF = at('2026-11-05T09:00'); // full October 2026 window: 31 days = 44,640 min

const customer = (overrides = {}) => ({
  id: 'c-solo',
  customerNumber: 9,
  name: 'Home Solo',
  connectionDate: '2026-09-01',
  addedOn: '2026-09-01',
  serviceStatus: 'active',
  serviceStatusHistory: [],
  incidents: [],
  bills: [],
  archived: false,
  upstreamCustomerId: null,
  ...overrides
});
const incident = (overrides = {}) => ({
  id: 'inc-x',
  reportedAt: '2026-10-10T08:05',
  offlineAt: '2026-10-10T08:00',
  restoredAt: '2026-10-12T14:00',
  note: 'Recorded outage',
  createdAt: '2026-10-10T08:05',
  corrections: [],
  ...overrides
});

// Chain: leaf -> mid -> root (leaf fed by mid, mid fed by root).
const root = (overrides = {}) => customer({ id: 'c-root', customerNumber: 1, name: 'Home Root', upstreamCustomerId: null, ...overrides });
const mid = (overrides = {}) => customer({ id: 'c-mid', customerNumber: 2, name: 'Home Mid', upstreamCustomerId: 'c-root', ...overrides });
const leaf = (overrides = {}) => customer({ id: 'c-leaf', customerNumber: 3, name: 'Home Leaf', upstreamCustomerId: 'c-mid', ...overrides });

// ---------- ancestor walk ----------

test('ancestor walk: nearest first up to the root, dangling id ends the chain', () => {
  const chain = [root(), mid(), leaf()];
  assert.deepEqual(traceUpstreamChain(chain, leaf().id).map((c) => c.id), ['c-mid', 'c-root']);
  assert.deepEqual(traceUpstreamChain(chain, root().id), []);
  const orphanChain = [root(), mid(), leaf({ upstreamCustomerId: 'c-ghost' })];
  assert.deepEqual(traceUpstreamChain(orphanChain, 'c-leaf'), []);
  assert.deepEqual(traceUpstreamChain([], leaf().id), []);
});

test('ancestor walk: a pre-existing A<->B cycle terminates, each home at most once', () => {
  const a = customer({ id: 'c-a', upstreamCustomerId: 'c-b' });
  const b = customer({ id: 'c-b', upstreamCustomerId: 'c-a' });
  assert.deepEqual(traceUpstreamChain([a, b], a.id).map((c) => c.id), ['c-b']);
  assert.deepEqual(traceUpstreamChain([a, b], b.id).map((c) => c.id), ['c-a']);
  const self = customer({ id: 'c-self', upstreamCustomerId: 'c-self' });
  assert.deepEqual(traceUpstreamChain([self], self.id), []);
});

// ---------- the spec pin: interval-union dedup ----------

test('PIN: downstream complaint overlapping an upstream feeder outage counts the overlap once', () => {
  // Leaf's own recorded outage: Oct 10 08:00 -> Oct 12 14:00 = 3,240 min.
  const leafCustomer = leaf({ incidents: [incident()] });
  // Root's feeder outage: Oct 11 00:00 -> Oct 13 00:00 = 2,880 min.
  // Overlap Oct 11 00:00 -> Oct 12 14:00 = 2,280 min.
  // Union = 3,240 + 2,880 - 2,280 = 3,840 min offline, never 6,120.
  const rootCustomer = root({ incidents: [incident({ id: 'inc-root', offlineAt: '2026-10-11T00:00', restoredAt: '2026-10-13T00:00', note: 'Feeder cut' })] });
  const roster = [rootCustomer, mid(), leafCustomer];

  const plain = buildMonthlyUptime(leafCustomer, '2026-10', REF);
  assert.equal(plain.offlineMinutes, 3240);
  assert.equal('inheritedUpstreamPeriods' in plain, false);

  const summary = buildMonthlyUptime(leafCustomer, '2026-10', REF, { includeInherited: true, customers: roster });
  assert.equal(summary.offlineMinutes, 3840);
  assert.equal(summary.onlineMinutes, 44640 - 3840);
  assert.deepEqual(summary.offline, { days: 2, hours: 16, minutes: 0, totalMinutes: 3840 });
  // Own periods list is untouched; the inherited period rides its own list.
  assert.equal(summary.periods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  const inherited = summary.inheritedUpstreamPeriods[0];
  assert.equal(inherited.minutes, 2880);
  assert.equal(inherited.reason, 'Feeder cut');
  assert.equal(inherited.source, 'record');
  assert.equal(inherited.open, false);
});

test('two ancestors down at the same time: their overlap also counts once', () => {
  // Root: Oct 5 00:00 -> Oct 7 00:00 (2,880). Mid: Oct 6 00:00 -> Oct 8 00:00 (2,880).
  // Overlap Oct 6 -> Oct 7 = 1,440. Union = 4,320. Leaf has no own outage.
  const rootCustomer = root({ incidents: [incident({ id: 'inc-r', offlineAt: '2026-10-05T00:00', restoredAt: '2026-10-07T00:00' })] });
  const midCustomer = mid({ incidents: [incident({ id: 'inc-m', offlineAt: '2026-10-06T00:00', restoredAt: '2026-10-08T00:00' })] });
  const summary = buildMonthlyUptime(leaf(), '2026-10', REF, { includeInherited: true, customers: [rootCustomer, midCustomer, leaf()] });
  assert.equal(summary.offlineMinutes, 4320);
  assert.equal(summary.inheritedUpstreamPeriods.length, 2);
  // Newest first: mid's period (Oct 6) ahead of root's (Oct 5).
  assert.equal(summary.inheritedUpstreamPeriods[0].ancestorId, 'c-mid');
  assert.equal(summary.inheritedUpstreamPeriods[1].ancestorId, 'c-root');
});

// ---------- clipping, attribution, sources ----------

test('an inherited period is clipped to the month window exactly like an own period', () => {
  // Root outage Sep 28 12:00 -> Oct 2 12:00; inside October it is
  // Oct 1 00:00 -> Oct 2 12:00 = 2,160 min.
  const rootCustomer = root({ incidents: [incident({ id: 'inc-clip', offlineAt: '2026-09-28T12:00', restoredAt: '2026-10-02T12:00' })] });
  const directLeaf = leaf({ upstreamCustomerId: 'c-root' });
  const summary = buildMonthlyUptime(directLeaf, '2026-10', REF, { includeInherited: true, customers: [rootCustomer, directLeaf] });
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods[0].startMs, parsePkDateTime('2026-10-01T00:00'));
  assert.equal(summary.inheritedUpstreamPeriods[0].minutes, 2160);
  assert.equal(summary.offlineMinutes, 2160);
});

test('every inherited period carries its source ancestor identity; the chain is listed nearest first', () => {
  const midCustomer = mid({ incidents: [incident({ id: 'inc-mid' })] });
  const summary = buildMonthlyUptime(leaf(), '2026-10', REF, { includeInherited: true, customers: [root(), midCustomer, leaf()] });
  assert.deepEqual(summary.inheritedAncestors, [
    { id: 'c-mid', name: 'Home Mid', customerNumber: 2, archived: false },
    { id: 'c-root', name: 'Home Root', customerNumber: 1, archived: false }
  ]);
  const inherited = summary.inheritedUpstreamPeriods[0];
  assert.equal(inherited.inherited, true);
  assert.equal(inherited.ancestorId, 'c-mid');
  assert.equal(inherited.ancestorName, 'Home Mid');
  assert.equal(inherited.ancestorNumber, 2);
});

test('an ancestor status-history offline span is inherited through the same derivation', () => {
  const rootCustomer = root({
    serviceStatusHistory: [
      { status: 'offline', at: '2026-10-03T10:00' },
      { status: 'active', at: '2026-10-03T16:00' }
    ]
  });
  const directLeaf = leaf({ upstreamCustomerId: 'c-root' });
  const summary = buildMonthlyUptime(directLeaf, '2026-10', REF, { includeInherited: true, customers: [rootCustomer, directLeaf] });
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods[0].source, 'status');
  assert.equal(summary.inheritedUpstreamPeriods[0].minutes, 360);
  assert.equal(summary.offlineMinutes, 360);
});

test('an open (still-running) ancestor outage is inherited as open, clipped to the window end', () => {
  const rootCustomer = root({ incidents: [incident({ id: 'inc-open', offlineAt: '2026-10-30T00:00', restoredAt: null })] });
  const directLeaf = leaf({ upstreamCustomerId: 'c-root' });
  const summary = buildMonthlyUptime(directLeaf, '2026-10', REF, { includeInherited: true, customers: [rootCustomer, directLeaf] });
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods[0].open, true);
  assert.equal(summary.inheritedUpstreamPeriods[0].endMs, parsePkDateTime('2026-11-01T00:00'));
  assert.equal(summary.inheritedUpstreamPeriods[0].minutes, 2880);
});

test('an archived ancestor still contributes its recorded periods (the chain ran through it)', () => {
  const rootCustomer = root({ archived: true, incidents: [incident({ id: 'inc-arch' })] });
  const directLeaf = leaf({ upstreamCustomerId: 'c-root' });
  const summary = buildMonthlyUptime(directLeaf, '2026-10', REF, { includeInherited: true, customers: [rootCustomer, directLeaf] });
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods[0].minutes, 3240);
  assert.equal(summary.inheritedAncestors[0].archived, true);
});

// ---------- option off / no ancestors ----------

test('option OFF (or absent) is byte-identical to the legacy summary — no new keys, same figures', () => {
  const leafCustomer = leaf({ incidents: [incident()] });
  const roster = [root({ incidents: [incident({ id: 'inc-r2' })] }), mid(), leafCustomer];
  const legacy = buildMonthlyUptime(leafCustomer, '2026-10', REF);
  assert.deepEqual(buildMonthlyUptime(leafCustomer, '2026-10', REF, {}), legacy);
  assert.deepEqual(buildMonthlyUptime(leafCustomer, '2026-10', REF, { includeInherited: false, customers: roster }), legacy);
  assert.deepEqual(buildMonthlyUptime(leafCustomer, '2026-10', REF, { customers: roster }), legacy);
  assert.equal('inheritedUpstreamPeriods' in legacy, false);
  assert.equal('inheritedAncestors' in legacy, false);
});

test('no ancestors: the opt-in summary lists nothing inherited and keeps the legacy totals', () => {
  const solo = customer({ incidents: [incident()] });
  const summary = buildMonthlyUptime(solo, '2026-10', REF, { includeInherited: true, customers: [solo] });
  assert.deepEqual(summary.inheritedUpstreamPeriods, []);
  assert.deepEqual(summary.inheritedAncestors, []);
  assert.equal(summary.offlineMinutes, 3240);
  // Option on but no roster supplied: still safe, still no inheritance.
  const noRoster = buildMonthlyUptime(solo, '2026-10', REF, { includeInherited: true });
  assert.deepEqual(noRoster.inheritedUpstreamPeriods, []);
  assert.equal(noRoster.offlineMinutes, 3240);
});

test('a cycle in the chain cannot double-count or hang the summary', () => {
  const a = customer({ id: 'c-a', upstreamCustomerId: 'c-b', incidents: [] });
  const b = customer({ id: 'c-b', upstreamCustomerId: 'c-a', incidents: [incident({ id: 'inc-b' })] });
  const summary = buildMonthlyUptime(a, '2026-10', REF, { includeInherited: true, customers: [a, b] });
  assert.equal(summary.inheritedUpstreamPeriods.length, 1);
  assert.equal(summary.inheritedUpstreamPeriods[0].ancestorId, 'c-b');
  assert.equal(summary.offlineMinutes, 3240);
});

// ---------- purity ----------

test('computing an inherited summary mutates nothing (state byte-identical)', () => {
  const roster = [root({ incidents: [incident({ id: 'inc-p' })] }), mid(), leaf({ incidents: [incident()] })];
  const before = JSON.stringify(roster);
  buildMonthlyUptime(roster[2], '2026-10', REF, { includeInherited: true, customers: roster });
  assert.equal(JSON.stringify(roster), before);
});

// ---------- i18n + wiring ----------

test('i18n: every upt_inherited_* key exists in en + ur with matching placeholders', () => {
  const keys = ['upt_inherited_toggle', 'upt_inherited_heading', 'upt_inherited_note', 'upt_inherited_from', 'upt_inherited_totals'];
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch ${key}`);
  }
});

test('wiring: the profile uptime panel drives the opt-in through buildMonthlyUptime', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes('includeInherited: true'), 'renderUptimePanel must request inherited periods');
  assert.ok(appSource.includes('upt_inherited_toggle'), 'panel must render the opt-in toggle');
  assert.ok(appSource.includes('data-uptime-inherited-toggle'), 'toggle must be wired');
});
