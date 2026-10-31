// SISP-109: Post-Storm / Heavy Rain Feeder & Upstream Node Inspection
// Checklist. Pure-function tests on synthetic data only. Pins the spec
// criteria: generating a Post-Storm Checklist ranks upstream nodes by
// descending downstream customer count (inside their zone, nodes before
// splitter boxes) and converts Needs Repair items into REAL SISP-12
// tickets through createTicket — deduplicated while unresolved. Also
// pins: checklist generation is read-only, feeder roots vs critical
// upstream homes (>= 2 downstream), archived homes traversed through
// but never listed/counted, splitter boxes need an active assigned
// customer and anchor their ticket on the first one, check state is a
// per-date persisted run (a new date never inherits ticks), and the
// backup safe-merge round-trip for settings.stormInspections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  STORM_INSPECTIONS_KEY,
  STORM_UNSET_ZONE_KEY,
  buildStormChecklist,
  clearStormCheck,
  createStormRepairTicket,
  ensureStormRun,
  findOpenStormTicket,
  loadStormInspections,
  recordStormCheck,
  sanitizeStormInspections,
  saveStormInspections,
  stormCheckForItem,
  stormRunForDate,
  stormTicketMarker,
  stormTicketPriority
} from '../storm-inspection.js';

const cust = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `House ${n}`, mohalla: 'BARRIAN',
  archived: false, bills: [], ...extra
});

// BARRIAN chain: r1 feeds a + b; a feeds a1 + a2; b feeds b1.
// Downstream (transitive, active only): r1 = 5, a = 2, b = 1.
// PALALIYAA chain: r2 feeds h; h feeds h1 + h2  ->  r2 = 3, h = 2.
// THALII chain: r3 feeds x (ARCHIVED) which feeds x1  ->  r3 = 1 (x1 only).
// Unset mohalla: r4 feeds u1  ->  r4 = 1, zone unset.
function topology() {
  return [
    cust('r1', 1),
    cust('a', 2, { upstreamCustomerId: 'r1' }),
    cust('b', 3, { upstreamCustomerId: 'r1' }),
    cust('a1', 4, { upstreamCustomerId: 'a' }),
    cust('a2', 5, { upstreamCustomerId: 'a' }),
    cust('b1', 6, { upstreamCustomerId: 'b' }),
    cust('r2', 11, { mohalla: 'PALALIYAA' }),
    cust('h', 12, { mohalla: 'PALALIYAA', upstreamCustomerId: 'r2' }),
    cust('h1', 13, { mohalla: 'PALALIYAA', upstreamCustomerId: 'h' }),
    cust('h2', 14, { mohalla: 'PALALIYAA', upstreamCustomerId: 'h' }),
    cust('r3', 21, { mohalla: 'THALII' }),
    cust('x', 22, { mohalla: 'THALII', upstreamCustomerId: 'r3', archived: true }),
    cust('x1', 23, { mohalla: 'THALII', upstreamCustomerId: 'x' }),
    cust('r4', 41, { mohalla: '' }),
    cust('u1', 42, { mohalla: '', upstreamCustomerId: 'r4' }),
    // Splitter boxes (recorded on customer records, SISP-24 style).
    cust('s1', 31, { splitterBoxId: 'SPL-Test-01', splitterPort: 1 }),
    cust('s2', 32, { splitterBoxId: 'SPL-Test-01', splitterPort: 2 }),
    cust('s3', 33, { splitterBoxId: 'SPL-Test-01', splitterPort: 3, archived: true }),
    cust('s4', 34, { splitterBoxId: 'SPL-Gone-01', splitterPort: 1, archived: true })
  ];
}

function zoneWith(checklist, itemKey) {
  return checklist.zones.find((zone) => zone.items.some((item) => item.key === itemKey));
}

function itemOf(checklist, itemKey) {
  for (const zone of checklist.zones) {
    const found = zone.items.find((item) => item.key === itemKey);
    if (found) return found;
  }
  return null;
}

test('checklist ranks upstream nodes by descending downstream count inside each zone (spec pin)', () => {
  const checklist = buildStormChecklist(topology());
  const barrian = zoneWith(checklist, 'feeder:r1');
  // Nodes first, descending downstream: r1 (5) then a (2); the box last.
  assert.deepEqual(barrian.items.map((item) => item.key), ['feeder:r1', 'home:a', 'splitter:SPL-Test-01']);
  assert.equal(itemOf(checklist, 'feeder:r1').downstreamCount, 5);
  assert.equal(itemOf(checklist, 'home:a').downstreamCount, 2);
  const palaliyaa = zoneWith(checklist, 'feeder:r2');
  assert.deepEqual(palaliyaa.items.map((item) => item.key), ['feeder:r2', 'home:h']);
  assert.equal(itemOf(checklist, 'feeder:r2').downstreamCount, 3);
  assert.equal(itemOf(checklist, 'home:h').downstreamCount, 2);
});

test('only feeder roots and critical upstream homes (>= 2 downstream) are listed', () => {
  const checklist = buildStormChecklist(topology());
  assert.equal(itemOf(checklist, 'home:b'), null, 'b feeds only 1 home and has an upstream — not critical');
  assert.equal(itemOf(checklist, 'feeder:a'), null, 'a has an upstream, so it is a home, never a feeder root');
  assert.equal(itemOf(checklist, 'feeder:a1'), null, 'leaf homes feed nobody');
  assert.equal(itemOf(checklist, 'home:x'), null, 'archived homes are never listed');
  assert.equal(itemOf(checklist, 'feeder:x1'), null, 'x1 feeds nobody');
  // r3's chain passes THROUGH archived x: x1 still counts for r3.
  const r3 = itemOf(checklist, 'feeder:r3');
  assert.equal(r3.downstreamCount, 1);
  assert.equal(checklist.nodeCount, 6, 'r1, a, r2, h, r3, r4');
  assert.equal(checklist.boxCount, 1);
  assert.equal(checklist.totalItems, 7);
});

test('zones sort by label with the unset zone last; mohalla variants fold together', () => {
  const customers = topology();
  customers.push(cust('v1', 51, { mohalla: 'MOHALLA BANI' }));
  customers.push(cust('v2', 52, { mohalla: 'Bani', upstreamCustomerId: 'v1' }));
  customers.push(cust('v3', 53, { mohalla: 'BANII', upstreamCustomerId: 'v1' }));
  const checklist = buildStormChecklist(customers);
  const firstKeys = checklist.zones.map((zone) => zone.items[0].key);
  assert.deepEqual(firstKeys, ['feeder:v1', 'feeder:r1', 'feeder:r2', 'feeder:r3', 'feeder:r4']);
  const last = checklist.zones[checklist.zones.length - 1];
  assert.equal(last.key, STORM_UNSET_ZONE_KEY);
  assert.equal(zoneWith(checklist, 'feeder:v1').items.length, 1, 'v2/v3 feed nobody; only the root is listed');
});

test('splitter boxes need an active assigned customer and anchor on the first in roster order', () => {
  const checklist = buildStormChecklist(topology());
  const box = itemOf(checklist, 'splitter:SPL-Test-01');
  assert.equal(box.customerId, 's1', 'first active assigned customer anchors the box');
  assert.equal(box.occupiedCount, 3, 'port map occupancy is the recorded figure (incl. the archived port)');
  assert.equal(box.activeAssignedCount, 2);
  assert.equal(box.portCount, 8);
  assert.equal(itemOf(checklist, 'splitter:SPL-Gone-01'), null, 'a box with only archived customers is not listed');
});

test('generating the checklist is read-only: customers and tickets are never mutated', () => {
  const customers = topology();
  const tickets = [];
  const before = JSON.stringify(customers);
  const checklist = buildStormChecklist(customers, { tickets });
  assert.equal(JSON.stringify(customers), before);
  assert.equal(tickets.length, 0);
  assert.ok(checklist.totalItems > 0);
});

test('Needs Repair converts into exactly one real ticket, deduplicated while unresolved (spec pin)', () => {
  const checklist = buildStormChecklist(topology());
  const box = itemOf(checklist, 'splitter:SPL-Test-01');
  const ref = new Date('2026-10-29T15:00:00+05:00');
  const first = createStormRepairTicket([], box, { technician: 'Test Lineman', referenceDate: ref });
  assert.equal(first.created, true);
  assert.equal(first.tickets.length, 1);
  const ticket = first.ticket;
  assert.match(ticket.id, /^TKT-\d+$/);
  assert.equal(ticket.customerId, 's1', 'box ticket anchors on the first active assigned customer');
  assert.equal(ticket.customerName, 'House 31');
  assert.equal(ticket.customFault, 'Post-storm inspection — needs repair');
  assert.equal(ticket.technician, 'Test Lineman');
  assert.equal(ticket.priority, 'Urgent');
  assert.equal(ticket.status, 'Open');
  assert.ok(ticket.note.includes('splitter box SPL-Test-01'));
  assert.ok(ticket.note.includes(stormTicketMarker('splitter:SPL-Test-01')));

  const second = createStormRepairTicket(first.tickets, box, { technician: 'Test Lineman', referenceDate: ref });
  assert.equal(second.created, false, 'repeat tap while unresolved creates no duplicate');
  assert.equal(second.tickets.length, 1);
  assert.equal(second.ticket.id, ticket.id);

  const resolved = first.tickets.map((entry) => ({ ...entry, status: 'Resolved' }));
  const third = createStormRepairTicket(resolved, box, { technician: 'Test Lineman', referenceDate: ref });
  assert.equal(third.created, true, 'once resolved, a fresh storm can raise a fresh ticket');
  assert.equal(third.tickets.length, 2);
  assert.notEqual(third.ticket.id, ticket.id);
});

test('node tickets name the house and its downstream count; priority follows shared-plant reach', () => {
  const checklist = buildStormChecklist(topology());
  const ref = new Date('2026-10-29T15:00:00+05:00');
  const big = createStormRepairTicket([], itemOf(checklist, 'feeder:r1'), { technician: 'Test Lineman', referenceDate: ref });
  assert.equal(big.ticket.customerId, 'r1');
  assert.equal(big.ticket.priority, 'Urgent', 'feeds 5 homes — shared plant');
  assert.ok(big.ticket.note.includes('feeder node House 1 (#1) — feeds 5 homes downstream'));
  const small = createStormRepairTicket([], itemOf(checklist, 'feeder:r3'), { technician: 'Test Lineman', referenceDate: ref });
  assert.equal(small.ticket.priority, 'Normal', 'feeds exactly 1 home');
  assert.equal(stormTicketPriority(itemOf(checklist, 'home:a')), 'Urgent');
  assert.throws(
    () => createStormRepairTicket([], itemOf(checklist, 'feeder:r1'), { technician: '', referenceDate: ref }),
    /technician/,
    'createTicket still enforces a lineman — no anonymous tickets'
  );
});

test('an unresolved storm ticket from an earlier run is annotated, never duplicated', () => {
  const checklist = buildStormChecklist(topology());
  const ref = new Date('2026-10-28T15:00:00+05:00');
  const made = createStormRepairTicket([], itemOf(checklist, 'home:a'), { technician: 'Test Lineman', referenceDate: ref });
  const rebuilt = buildStormChecklist(topology(), { tickets: made.tickets });
  assert.equal(itemOf(rebuilt, 'home:a').openTicketId, made.ticket.id);
  assert.equal(findOpenStormTicket(made.tickets, 'home:a').id, made.ticket.id);
  assert.equal(findOpenStormTicket(made.tickets.map((entry) => ({ ...entry, status: 'Resolved' })), 'home:a'), null);
});

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    raw: map
  };
}

test('check state persists per date; a new date starts fresh and never inherits ticks', () => {
  const storage = fakeStorage();
  let data = loadStormInspections(storage);
  assert.deepEqual(data, { runs: [] });
  data = recordStormCheck(data, '2026-10-29', 'feeder:r1', { status: 'ok' }, '2026-10-29T10:00:00.000Z');
  data = recordStormCheck(data, '2026-10-29', 'home:a', { status: 'ticket', ticketId: 'TKT-101' }, '2026-10-29T10:05:00.000Z');
  saveStormInspections(data, storage);
  assert.ok(storage.raw.has(STORM_INSPECTIONS_KEY));

  const reloaded = loadStormInspections(storage);
  assert.equal(stormCheckForItem(reloaded, '2026-10-29', 'feeder:r1').status, 'ok');
  assert.equal(stormCheckForItem(reloaded, '2026-10-29', 'home:a').ticketId, 'TKT-101');
  assert.equal(stormRunForDate(reloaded, '2026-10-30'), null, 'tomorrow has no run yet');

  const nextDay = ensureStormRun(reloaded, '2026-10-30', '2026-10-30T07:00:00.000Z');
  assert.deepEqual(stormRunForDate(nextDay, '2026-10-30').checks, {}, 'a new day inherits NO ticks');
  assert.equal(stormCheckForItem(nextDay, '2026-10-29', 'feeder:r1').status, 'ok', 'yesterday stays readable in its own run');

  const undone = clearStormCheck(nextDay, '2026-10-29', 'feeder:r1');
  assert.equal(stormCheckForItem(undone, '2026-10-29', 'feeder:r1'), null, 'undo clears only that check');
  assert.equal(stormCheckForItem(undone, '2026-10-29', 'home:a').status, 'ticket');
});

test('sanitizer drops malformed runs/checks and keeps only the newest 7 runs', () => {
  const dirty = {
    runs: [
      { date: 'not-a-date', startedAt: '', checks: { 'feeder:r1': { status: 'ok', ticketId: '', at: '' } } },
      { date: '2026-02-30', startedAt: '', checks: {} },
      {
        date: '2026-10-29', startedAt: 'x', checks: {
          'feeder:r1': { status: 'ok', ticketId: 'TKT-101', at: 't' },
          'home:a': { status: 'ticket', ticketId: 'bogus', at: '' },
          'weird:1': { status: 'ok', ticketId: '', at: '' },
          'splitter:DB-01': { status: 'ticket', ticketId: 'TKT-102', at: '' }
        }
      },
      ...Array.from({ length: 8 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, startedAt: '', checks: {} }))
    ]
  };
  const clean = sanitizeStormInspections(dirty);
  assert.equal(clean.runs.length, 7, 'retention keeps the newest 7 dated runs');
  assert.equal(clean.runs[clean.runs.length - 1].date, '2026-10-29');
  const run = stormRunForDate(clean, '2026-10-29');
  assert.deepEqual(Object.keys(run.checks).sort(), ['feeder:r1', 'splitter:DB-01']);
  assert.equal(run.checks['feeder:r1'].ticketId, '', 'an ok check never carries a ticket id');
  assert.equal(run.checks['splitter:DB-01'].ticketId, 'TKT-102');
  assert.deepEqual(sanitizeStormInspections(null), { runs: [] });
  assert.deepEqual(sanitizeStormInspections('junk'), { runs: [] });
});

test('backup safe-merge: storm runs travel in settings.stormInspections and restore only onto an empty device', () => {
  const data = recordStormCheck({ runs: [] }, '2026-10-29', 'feeder:r1', { status: 'ok' }, '2026-10-29T10:00:00.000Z');
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { stormInspections: data });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.stormInspections.runs.length, 1);
  assert.equal(parsed.settings.stormInspections.runs[0].checks['feeder:r1'].status, 'ok');

  const adopt = previewJsonBackupMerge(createInitialState(), backupText, {
    currentStormInspections: { runs: [] }, currentStormInspectionsStored: false
  });
  assert.equal(adopt.stormInspections.runs.length, 1, 'adopted when this device has none');
  assert.equal(adopt.counts.stormInspectionsRestored, 1);

  const other = recordStormCheck({ runs: [] }, '2026-10-28', 'home:a', { status: 'ok' }, '2026-10-28T09:00:00.000Z');
  const clash = previewJsonBackupMerge(createInitialState(), backupText, {
    currentStormInspections: other, currentStormInspectionsStored: true
  });
  assert.equal(clash.stormInspections, null, 'differing runs on both sides are kept local, never overwritten');
  assert.ok(clash.conflicts.some((entry) => /Storm inspection/.test(entry.field)));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, {
    currentStormInspections: data, currentStormInspectionsStored: true
  });
  assert.equal(identical.stormInspections, null, 'identical runs are a no-op, not a conflict');
  assert.ok(!identical.conflicts.some((entry) => /Storm inspection/.test(entry.field)));
});

test('i18n: every storm_ key used by the module and the dialog exists in en + ur, dicts in parity', () => {
  const moduleSource = readFileSync(new URL('../storm-inspection.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of moduleSource.matchAll(/\bt\('([a-z0-9_]+)'/g)) used.add(match[1]);
  for (const match of html.matchAll(/data-i18n="(storm_[a-z0-9_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 20, `expected the storm UI to use its key set, saw ${used.size}`);
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  const enKeys = Object.keys(TRANSLATIONS.en).filter((key) => key.startsWith('storm_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((key) => key.startsWith('storm_')).sort();
  assert.deepEqual(enKeys, urKeys, 'storm_ dictionaries must be in full parity');
});

test('dark mode: the storm surface uses theme tokens only (no hardcoded colours)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* SISP-109');
  const end = css.indexOf('/* Saad visit log');
  assert.ok(start >= 0 && end > start, 'storm CSS block present');
  const block = css.slice(start, end);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the storm CSS block');
  assert.ok(block.includes('var(--surface)') && block.includes('var(--line)'), 'cards use theme tokens');
  const moduleSource = readFileSync(new URL('../storm-inspection.js', import.meta.url), 'utf8');
  assert.ok(!/#[0-9a-fA-F]{6}\b/.test(moduleSource), 'no hex colours in the module');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogStart = html.indexOf('id="stormInspectionModal"');
  assert.ok(dialogStart >= 0, 'dialog present');
  const dialogSlice = html.slice(dialogStart, dialogStart + 400);
  assert.ok(dialogSlice.includes('billing-modal'), 'dialog uses the shared themed billing-modal surface');
  assert.ok(html.includes('id="stormInspectionCloseBtn" class="modal-close"'), 'shared modal-close ↩ button');
  assert.ok(html.includes('id="openStormInspectionModalBtn"'), 'dashboard open button present');
});
