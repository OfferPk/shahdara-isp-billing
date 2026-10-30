// OWNER-SIGNAL (owner feature, 2026-10-30): per-customer signal (dBm)
// reading history + complaint before/after signal + per-mohalla average
// signal. Pure-function tests on synthetic data only — no real customer
// names anywhere (the owner's spoken example used his real mohalla
// CHAMYAAA with readings -18 / -20 / -22; the pin below reproduces the
// NUMBERS with synthetic names).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIGNAL_READINGS_CAP,
  appendSignalReading,
  buildAreaSignalReport,
  buildSignalReading,
  latestSignalReading,
  sanitizeSignalReadings,
  signalReadingsNewestFirst,
  validateSignalDbm
} from '../signal-history.js';
import {
  createTicket,
  resolveTicket,
  sanitizeTickets,
  ticketSignalLabel
} from '../complaint-tickets.js';
import {
  addCustomer,
  createInitialState,
  createJsonBackup,
  persistState,
  previewJsonBackupMerge,
  readState,
  updateCustomerProfile
} from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import { canonicalMohalla } from '../phase3.js';

const customer = (overrides = {}) => ({
  id: 'c1',
  customerNumber: 1,
  name: 'Test Customer',
  mohalla: 'CHAMYAAA',
  archived: false,
  lastRxDbm: null,
  signalReadings: [],
  ...overrides
});

// ---------- Part C: the owner's average-signal example, pinned ----------

test('owner example pin: CHAMYAAA readings -18, -20, -22 average exactly -20.0', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 11, name: 'Test Alpha', mohalla: 'MOHALLA CHAMYAAA', lastRxDbm: -18 }),
      customer({ id: 'b', customerNumber: 12, name: 'Test Beta', mohalla: 'MOHALLA CHAMYAAA', lastRxDbm: -20 }),
      customer({ id: 'c', customerNumber: 13, name: 'Test Gamma', mohalla: 'CHAMYAAA', lastRxDbm: -22 })
    ]
  };
  const report = buildAreaSignalReport(state);
  assert.equal(report.length, 1);
  const group = report[0];
  // Group identity + display label are canonicalMohalla's own (the
  // readable label the Mohalla Dashboard cards also show).
  assert.equal(group.areaKey, canonicalMohalla('MOHALLA CHAMYAAA').key);
  assert.equal(group.area, canonicalMohalla('CHAMYAAA').label);
  assert.equal(group.averageDbm, -20.0);
  assert.equal(group.readingsCount, 3);
  assert.equal(group.totalCustomers, 3);
  // Weakest first: -22, -20, -18.
  assert.deepEqual(group.withReadings.map((r) => r.dbm), [-22, -20, -18]);
});

test('area report: canonical variants of one mohalla merge into a single group', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 1, mohalla: 'Mohalla Bani', lastRxDbm: -20 }),
      customer({ id: 'b', customerNumber: 2, mohalla: 'BANII', lastRxDbm: -24 }),
      customer({ id: 'c', customerNumber: 3, mohalla: 'Bani', lastRxDbm: -22 })
    ]
  };
  const report = buildAreaSignalReport(state);
  assert.equal(report.length, 1);
  assert.equal(report[0].areaKey, canonicalMohalla('BANII').key);
  assert.equal(report[0].area, canonicalMohalla('BANII').label);
  assert.equal(report[0].readingsCount, 3);
  assert.equal(report[0].averageDbm, -22);
});

test('area report: no-reading customers count in totals but never in the average; empty area averages null', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 1, mohalla: 'THALII', lastRxDbm: -20 }),
      customer({ id: 'b', customerNumber: 2, mohalla: 'THALII', lastRxDbm: null }),
      customer({ id: 'c', customerNumber: 3, mohalla: 'NAKAR', lastRxDbm: null })
    ]
  };
  const report = buildAreaSignalReport(state);
  const thalii = report.find((g) => g.areaKey === canonicalMohalla('THALII').key);
  assert.equal(thalii.totalCustomers, 2);
  assert.equal(thalii.readingsCount, 1);
  assert.equal(thalii.averageDbm, -20);
  const nakar = report.find((g) => g.areaKey === canonicalMohalla('NAKAR').key);
  assert.equal(nakar.averageDbm, null);
  assert.equal(nakar.readingsCount, 0);
  assert.equal(nakar.totalCustomers, 1);
  // No-reading groups sort after groups with readings.
  assert.equal(report.at(-1).areaKey, canonicalMohalla('NAKAR').key);
});

test('area report: archived customers are excluded entirely', () => {
  const state = {
    customers: [
      customer({ id: 'a', customerNumber: 1, mohalla: 'SODAA', lastRxDbm: -20 }),
      customer({ id: 'b', customerNumber: 2, mohalla: 'SODAA', lastRxDbm: -30, archived: true })
    ]
  };
  const report = buildAreaSignalReport(state);
  assert.equal(report.length, 1);
  assert.equal(report[0].totalCustomers, 1);
  assert.equal(report[0].averageDbm, -20);
});

test('area report: reading date comes from the newest reading; a legacy reading has an unknown date', () => {
  const withHistory = appendSignalReading(customer({ id: 'a', customerNumber: 1, mohalla: 'GANGALL' }), { dbm: -21.5, source: 'manual', date: '2026-10-12' });
  const state = {
    customers: [
      withHistory,
      customer({ id: 'b', customerNumber: 2, mohalla: 'GANGALL', lastRxDbm: -19 })
    ]
  };
  const group = buildAreaSignalReport(state)[0];
  const dated = group.withReadings.find((r) => r.customerId === 'a');
  const legacy = group.withReadings.find((r) => r.customerId === 'b');
  assert.equal(dated.date, '2026-10-12');
  assert.equal(legacy.date, null);
  assert.equal(group.averageDbm, -20.2); // (-21.5 + -19) / 2 = -20.25 → Math.round(-202.5) = -202 → -20.2
});

// ---------- Part A: history + lastRxDbm sync ----------

test('append: latest reading wins and lastRxDbm always syncs to the newest reading', () => {
  let c = customer({ lastRxDbm: -20 });
  c = appendSignalReading(c, { dbm: -24, source: 'manual', date: '2026-10-10' });
  assert.equal(c.signalReadings.length, 1);
  assert.equal(c.lastRxDbm, -24);
  c = appendSignalReading(c, { dbm: -19, source: 'manual', date: '2026-10-11' });
  assert.equal(c.signalReadings.length, 2);
  assert.equal(c.lastRxDbm, -19);
  assert.equal(latestSignalReading(c).dbm, -19);
  // A backdated entry journals into history but does NOT rewind the
  // current signal — newest by entry date still wins.
  c = appendSignalReading(c, { dbm: -28, source: 'manual', date: '2026-10-01' });
  assert.equal(c.signalReadings.length, 3);
  assert.equal(c.lastRxDbm, -19);
  assert.equal(latestSignalReading(c).dbm, -19);
});

test('append: ids are SR-101+ and sequential', () => {
  let c = customer();
  c = appendSignalReading(c, { dbm: -20, date: '2026-10-10' });
  c = appendSignalReading(c, { dbm: -21, date: '2026-10-10' });
  assert.deepEqual(c.signalReadings.map((r) => r.id), ['SR-101', 'SR-102']);
});

test('append: history is capped at the newest SIGNAL_READINGS_CAP entries', () => {
  let c = customer();
  for (let i = 0; i < SIGNAL_READINGS_CAP + 5; i += 1) {
    c = appendSignalReading(c, { dbm: -20, date: '2026-10-10' });
  }
  assert.equal(c.signalReadings.length, SIGNAL_READINGS_CAP);
  assert.equal(c.signalReadings[0].id, 'SR-106');
  assert.equal(c.signalReadings.at(-1).id, `SR-${100 + SIGNAL_READINGS_CAP + 5}`);
});

test('validation: dBm follows the SISP-24 rule exactly (-60..+10, 1 decimal, empty = not recorded)', () => {
  assert.equal(validateSignalDbm(''), null);
  assert.equal(validateSignalDbm(null), null);
  assert.equal(validateSignalDbm(-19.44), -19.4);
  assert.equal(validateSignalDbm(-60), -60);
  assert.equal(validateSignalDbm(10), 10);
  assert.throws(() => validateSignalDbm(-60.1), /between -60 and 10 dBm/);
  assert.throws(() => validateSignalDbm(10.1), /between -60 and 10 dBm/);
  assert.throws(() => validateSignalDbm('abc'), /between -60 and 10 dBm/);
  assert.throws(() => buildSignalReading({ dbm: '' }, []), /Enter the signal reading/);
  assert.throws(() => appendSignalReading(customer(), { dbm: 99 }), /between -60 and 10 dBm/);
});

test('sanitizer: malformed readings drop, unknown source defaults to manual, refs only on complaint sources', () => {
  const cleaned = sanitizeSignalReadings([
    { id: 'SR-101', date: '2026-10-01', dbm: -20, source: 'manual', complaintId: 'TKT-101', note: 'x' },
    { id: 'SR-102', date: '2026-10-02', dbm: -24, source: 'complaint-before', complaintId: 'TKT-101' },
    { id: 'SR-102', date: '2026-10-03', dbm: -25, source: 'manual' }, // duplicate id — first wins
    { id: 'BAD-1', date: '2026-10-02', dbm: -20, source: 'manual' }, // bad id
    { id: 'SR-103', date: '10/02/2026', dbm: -20, source: 'manual' }, // bad date
    { id: 'SR-104', date: '2026-10-02', dbm: -99, source: 'manual' }, // out of range
    { id: 'SR-105', date: '2026-10-04', dbm: -22, source: 'something-else' }, // unknown source
    'junk',
    null
  ]);
  assert.deepEqual(cleaned.map((r) => r.id), ['SR-101', 'SR-102', 'SR-105']);
  assert.equal(cleaned[0].complaintId, ''); // manual readings carry no complaint ref
  assert.equal(cleaned[1].complaintId, 'TKT-101');
  assert.equal(cleaned[1].dbm, -24); // first copy of SR-102 wins
  assert.equal(cleaned[2].source, 'manual');
  assert.deepEqual(sanitizeSignalReadings(undefined), []);
  assert.deepEqual(sanitizeSignalReadings('nope'), []);
});

test('newest-first render data: order reverses and weak rows are flagged at the SISP-24 line', () => {
  let c = customer();
  c = appendSignalReading(c, { dbm: -20, date: '2026-10-01' });
  c = appendSignalReading(c, { dbm: -27.5, date: '2026-10-02' });
  c = appendSignalReading(c, { dbm: -26.0, date: '2026-10-03' });
  const rows = signalReadingsNewestFirst(c);
  assert.deepEqual(rows.map((r) => r.dbm), [-26.0, -27.5, -20]);
  assert.deepEqual(rows.map((r) => r.weak), [false, true, false]); // -26.0 exactly is NOT weak
});

// ---------- Core choke points: readState / updateCustomerProfile ----------

test('core: readings survive readState, and a legacy record loads with an empty history', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Signal Roundtrip', new Date('2026-10-01'), { mohalla: 'CHAMYAAA' });
  state = addCustomer(state, 'Legacy No Readings', new Date('2026-10-01'), {});
  state.customers[0] = appendSignalReading(state.customers[0], { dbm: -23, source: 'install', date: '2026-10-01' });
  const storage = new Map();
  const fakeStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k)
  };
  persistState(state, fakeStorage);
  const loaded = readState(fakeStorage);
  const withReadings = loaded.customers.find((c) => c.name === 'Signal Roundtrip');
  const legacy = loaded.customers.find((c) => c.name === 'Legacy No Readings');
  assert.equal(withReadings.signalReadings.length, 1);
  assert.equal(withReadings.signalReadings[0].dbm, -23);
  assert.equal(withReadings.lastRxDbm, -23);
  assert.deepEqual(legacy.signalReadings, []);
});

test('core: updateCustomerProfile preserves the signal history untouched', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Profile Keeper', new Date('2026-10-01'), {});
  const id = state.customers[0].id;
  state.customers[0] = appendSignalReading(state.customers[0], { dbm: -22, source: 'manual', date: '2026-10-05' });
  const before = state.customers[0].signalReadings;
  state = updateCustomerProfile(state, id, { phone: '03001234567' });
  assert.deepEqual(state.customers[0].signalReadings, before);
  assert.equal(state.customers[0].lastRxDbm, -22);
});

// ---------- Backup round-trip + merge union ----------

function stateWithReadings() {
  let state = createInitialState();
  state = addCustomer(state, 'Backup Signal', new Date('2026-10-01'), { mohalla: 'BARRIAN' });
  state.customers[0] = appendSignalReading(state.customers[0], { dbm: -24, source: 'complaint-before', complaintId: 'TKT-101', date: '2026-10-05' });
  state.customers[0] = appendSignalReading(state.customers[0], { dbm: -19, source: 'complaint-after', complaintId: 'TKT-101', date: '2026-10-06' });
  return state;
}

test('backup: readings ride the JSON backup with the customer', () => {
  const state = stateWithReadings();
  const backup = createJsonBackup(state, new Date('2026-10-07'));
  const parsed = JSON.parse(backup);
  const readings = parsed.state.customers[0].signalReadings;
  assert.equal(readings.length, 2);
  assert.deepEqual(readings.map((r) => r.dbm), [-24, -19]);
  assert.equal(readings[0].complaintId, 'TKT-101');
});

test('backup merge: readings union by id — missing ones are adopted, duplicates never repeat, no conflicts', () => {
  const full = stateWithReadings();
  const backup = createJsonBackup(full, new Date('2026-10-07'));
  // The receiving device holds the same customer with only the FIRST reading.
  const partial = JSON.parse(JSON.stringify(full));
  partial.customers[0].signalReadings = [partial.customers[0].signalReadings[0]];
  const preview = previewJsonBackupMerge(partial, backup);
  const merged = preview.state.customers[0];
  assert.equal(merged.signalReadings.length, 2);
  assert.deepEqual(merged.signalReadings.map((r) => r.id), ['SR-101', 'SR-102']);
  assert.equal(preview.conflicts.filter((c) => /signal/i.test(c.field)).length, 0);
  // Merging the same backup again adds nothing.
  const again = previewJsonBackupMerge(preview.state, backup);
  assert.equal(again.state.customers[0].signalReadings.length, 2);
});

// ---------- Part B: complaint before / after ----------

const ticketInput = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Test Customer',
  faultPreset: 'Fiber Cut / Splice Loss',
  technician: 'Test Lineman',
  ...overrides
});

test('ticket create: a before reading is stored and validated; blank stores null (never a faked 0)', () => {
  const withSignal = createTicket(ticketInput({ signalBeforeDbm: '-24.5' }), []);
  assert.equal(withSignal.signalBeforeDbm, -24.5);
  assert.equal(withSignal.signalAfterDbm, null);
  const blank = createTicket(ticketInput({ signalBeforeDbm: '' }), []);
  assert.equal(blank.signalBeforeDbm, null);
  const absent = createTicket(ticketInput(), []);
  assert.equal(absent.signalBeforeDbm, null);
  assert.throws(() => createTicket(ticketInput({ signalBeforeDbm: '15' }), []), /between -60 and 10 dBm/);
});

test('ticket resolve: after reading completes the pair; the label shows both sides', () => {
  const created = createTicket(ticketInput({ signalBeforeDbm: -24 }), []);
  const resolved = resolveTicket([created], created.id, { materialsUsed: [], billingType: 'free', signalAfterDbm: -19 });
  const ticket = resolved[0];
  assert.equal(ticket.status, 'Resolved');
  assert.equal(ticket.signalBeforeDbm, -24);
  assert.equal(ticket.signalAfterDbm, -19);
  assert.equal(ticketSignalLabel(ticket), '-24 → -19 dBm');
});

test('ticket resolve: resolving WITHOUT an after reading stays allowed and appends nothing', () => {
  const created = createTicket(ticketInput({ signalBeforeDbm: -24 }), []);
  const resolved = resolveTicket([created], created.id, { materialsUsed: [], billingType: 'free' });
  const ticket = resolved[0];
  assert.equal(ticket.status, 'Resolved');
  assert.equal(ticket.signalAfterDbm, null);
  assert.equal(ticketSignalLabel(ticket), 'Before fix: -24 dBm');
  const bare = createTicket(ticketInput(), []);
  const bareResolved = resolveTicket([bare], bare.id, { materialsUsed: [], billingType: 'free' });
  assert.equal(ticketSignalLabel(bareResolved[0]), '');
  const afterOnly = resolveTicket([bare], bare.id, { materialsUsed: [], billingType: 'free', signalAfterDbm: '-18' });
  // (bare is already resolved in its own list above — use a fresh ticket)
  assert.equal(afterOnly[0].signalAfterDbm, -18);
});

test('ticket resolve: an invalid after reading is refused, not stored', () => {
  const created = createTicket(ticketInput(), []);
  assert.throws(() => resolveTicket([created], created.id, { materialsUsed: [], signalAfterDbm: '42' }), /between -60 and 10 dBm/);
});

test('ticket sanitize: the pair survives sanitizeTickets; out-of-range values sanitize to null', () => {
  const created = createTicket(ticketInput({ signalBeforeDbm: -24 }), []);
  const resolved = resolveTicket([created], created.id, { materialsUsed: [], billingType: 'free', signalAfterDbm: -19 });
  const clean = sanitizeTickets(resolved);
  assert.equal(clean[0].signalBeforeDbm, -24);
  assert.equal(clean[0].signalAfterDbm, -19);
  const dirty = sanitizeTickets([{ ...resolved[0], signalAfterDbm: 99 }]);
  assert.equal(dirty[0].signalAfterDbm, null);
  const legacy = sanitizeTickets([{ id: 'TKT-101', customerId: 'c1' }]);
  assert.equal(legacy[0].signalBeforeDbm, null);
  assert.equal(legacy[0].signalAfterDbm, null);
});

// ---------- i18n + wiring audits ----------

test('i18n: every sig_* key used in app code exists in both dictionaries with matching params', () => {
  const sources = ['app.js', 'signal-history.js', 'index.html']
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const used = new Set([...sources.matchAll(/sig_[a-z_]+/g)].map((m) => m[0]));
  assert.ok(used.size >= 15, `expected at least 15 sig_* keys in use, found ${used.size}`);
  const paramsOf = (text) => [...String(text).matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
  for (const key of used) {
    assert.ok(key in TRANSLATIONS.en, `${key} missing from en dictionary`);
    assert.ok(key in TRANSLATIONS.ur, `${key} missing from ur dictionary`);
    assert.deepEqual(paramsOf(TRANSLATIONS.ur[key]), paramsOf(TRANSLATIONS.en[key]), `${key} param mismatch en vs ur`);
    assert.notEqual(TRANSLATIONS.en[key], key, `${key} renders as its own raw key`);
  }
});

test('wiring: dialog, ticket field, area button, and app imports are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="areaSignalModal"/);
  assert.match(html, /id="areaSignalCloseBtn" class="modal-close"[^>]*>↩</);
  assert.match(html, /id="openAreaSignalModalBtn"/);
  assert.match(html, /id="ticketAddSignalBefore"/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/signal-history\.js'/);
  assert.match(app, /setupAreaSignalModal/);
  assert.match(app, /onTicketSignal/);
  assert.match(app, /id="profileSignalRecordBtn"|profileSignalRecordBtn/);
});
