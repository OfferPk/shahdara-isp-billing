// SISP-104: 24h Post-Repair Customer Satisfaction Check-In Queue.
// Pure-function tests on synthetic data only. Spec test criterion
// (verbatim): "Resolving CMP-110 places it in the Post-Repair
// Check-In queue until [📲 Send Check-In] sets followUpSentAt."
//
// Window implemented: resolution age in the band [24h, 48h],
// inclusive at both ends — a repair younger than 24h has not had a
// full day to prove itself; past 48h the check-in moment has passed.
// All "now" values below are injected Dates; PKT wall-clock strings
// are the register's own "YYYY-MM-DDTHH:MM" format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  createComplaint,
  loadComplaints,
  sanitizeComplaints,
  saveComplaints,
  setComplaintStatus
} from '../complaint-register.js';
import {
  POST_REPAIR_CHECKIN_MAX_HOURS,
  POST_REPAIR_CHECKIN_MIN_HOURS,
  buildPostRepairCheckinMessage,
  buildPostRepairCheckinQueue,
  isPostRepairCheckinPending,
  markPostRepairCheckinSent,
  parsePktDateTimeMs
} from '../post-repair-checkin.js';
import { TRANSLATIONS } from '../nav-language.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

// 2026-10-29T12:00:00Z is 17:00 in Pakistan — the queue's "now".
const NOW = new Date('2026-10-29T12:00:00Z');
const NOW_PKT = '2026-10-29T17:00';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const base = (overrides = {}) => sanitizeComplaints([{
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Test Customer 21',
  zone: 'Barrian',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-28T09:00',
  resolvedAt: '',
  downtimeHours: null,
  downtimeManual: false,
  status: 'Open',
  resolutionNote: '',
  followUpSentAt: null,
  createdAt: '',
  ...overrides
}])[0];

const resolved = (id, resolvedAt, overrides = {}) => base({
  id,
  status: 'Resolved',
  resolvedAt,
  downtimeHours: 2,
  ...overrides
});

const queueIds = (list, now = NOW) => buildPostRepairCheckinQueue(list, now).map((e) => e.complaint.id);

test('window constants are the spec band: 24h to 48h', () => {
  assert.equal(POST_REPAIR_CHECKIN_MIN_HOURS, 24);
  assert.equal(POST_REPAIR_CHECKIN_MAX_HOURS, 48);
});

test('spec criterion: resolving CMP-110 places it in the queue until the check-in stamps followUpSentAt', () => {
  const storage = memoryStorage();
  let list = sanitizeComplaints([
    base({ id: 'CMP-109' }),
    base({ id: 'CMP-110', reportedAt: '2026-10-28T09:00' })
  ]);
  // Before resolution CMP-110 is nowhere near the queue.
  assert.deepEqual(queueIds(list), []);
  // Resolve it 30 hours before "now" through the register's own path.
  list = setComplaintStatus(list, 'CMP-110', 'Resolved', { resolvedAt: '2026-10-28T11:00' });
  saveComplaints(list, storage);
  const reloaded = loadComplaints(storage);
  assert.deepEqual(queueIds(reloaded), ['CMP-110']);
  // The [📲 Send Check-In] tap stamps followUpSentAt...
  const stamped = markPostRepairCheckinSent(reloaded, 'CMP-110', NOW);
  const entry = stamped.find((c) => c.id === 'CMP-110');
  assert.equal(entry.followUpSentAt, NOW_PKT);
  // ...and CMP-110 leaves the queue, across a storage round-trip too.
  saveComplaints(stamped, storage);
  assert.deepEqual(queueIds(loadComplaints(storage)), []);
  assert.equal(loadComplaints(storage).find((c) => c.id === 'CMP-110').followUpSentAt, NOW_PKT);
});

test('window boundaries: 10h too fresh, 30h due, 60h aged out; 24h and 48h exactly are in', () => {
  const list = [
    resolved('CMP-201', '2026-10-29T07:00'), // 10h ago — too fresh
    resolved('CMP-202', '2026-10-28T11:00'), // 30h ago — due
    resolved('CMP-203', '2026-10-27T05:00'), // 60h ago — aged out
    resolved('CMP-204', '2026-10-28T17:00'), // exactly 24h — in
    resolved('CMP-205', '2026-10-27T17:00'), // exactly 48h — in
    resolved('CMP-206', '2026-10-27T16:59'), // 48h + 1m — out
    resolved('CMP-207', '2026-10-28T17:01')  // 23h 59m — out
  ];
  assert.deepEqual(queueIds(list), ['CMP-205', 'CMP-202', 'CMP-204']); // oldest resolution first
});

test('queue excludes: unstamped-only, resolved-only, single-customer-only, valid resolvedAt only', () => {
  const list = [
    resolved('CMP-301', '2026-10-28T11:00', { followUpSentAt: '2026-10-29T10:00' }), // already checked on
    base({ id: 'CMP-302', status: 'In Progress' }),
    base({ id: 'CMP-303' }), // still Open
    resolved('CMP-304', ''), // resolved status but no resolution time — never fabricated
    resolved('CMP-305', 'not-a-date'),
    resolved('CMP-306', '2026-10-28T11:00', { customerId: AREA_OUTAGE_CUSTOMER_ID, customerName: AREA_OUTAGE_CUSTOMER_ID }), // area outage: nobody to message
    resolved('CMP-307', '2026-10-28T11:00') // the one genuine entry
  ];
  assert.deepEqual(queueIds(list), ['CMP-307']);
});

test('queue builder is pure and reports the resolution age', () => {
  const list = [resolved('CMP-401', '2026-10-28T11:00')];
  const before = JSON.stringify(list);
  const queue = buildPostRepairCheckinQueue(list, NOW);
  assert.equal(JSON.stringify(list), before);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].ageHours, 30);
  assert.equal(queue[0].resolvedAt, '2026-10-28T11:00');
});

test('stamp is once-ever: a second stamp never moves followUpSentAt; unknown id throws', () => {
  const list = [resolved('CMP-501', '2026-10-28T11:00')];
  const once = markPostRepairCheckinSent(list, 'CMP-501', NOW);
  const twice = markPostRepairCheckinSent(once, 'CMP-501', new Date('2026-10-30T12:00:00Z'));
  assert.equal(twice.find((c) => c.id === 'CMP-501').followUpSentAt, NOW_PKT);
  // Input list untouched (pure).
  assert.equal(list[0].followUpSentAt, null);
  assert.throws(() => markPostRepairCheckinSent(list, 'CMP-999', NOW), /Complaint not found/);
});

test('reopen keeps the historical stamp: a re-resolved complaint never re-enters the queue', () => {
  let list = [resolved('CMP-601', '2026-10-28T11:00', { reportedAt: '2026-10-28T09:00' })];
  list = markPostRepairCheckinSent(list, 'CMP-601', NOW);
  // The fault returns; the owner reopens the complaint in the register.
  list = setComplaintStatus(list, 'CMP-601', 'Open');
  const reopened = list.find((c) => c.id === 'CMP-601');
  assert.equal(reopened.status, 'Open');
  assert.equal(reopened.followUpSentAt, NOW_PKT); // history kept, never erased
  // Fixed again, resolved inside the window relative to a later "now".
  list = setComplaintStatus(list, 'CMP-601', 'Resolved', { resolvedAt: '2026-10-30T11:00' });
  assert.equal(list.find((c) => c.id === 'CMP-601').followUpSentAt, NOW_PKT);
  assert.deepEqual(queueIds(list, new Date('2026-10-31T12:00:00Z')), []); // still out — stamp is once-ever
});

test('sanitizer: followUpSentAt survives storage sanitization, junk becomes null', () => {
  const [kept] = sanitizeComplaints([base({ followUpSentAt: '2026-10-29T10:15' })]);
  assert.equal(kept.followUpSentAt, '2026-10-29T10:15');
  const [junk] = sanitizeComplaints([base({ followUpSentAt: 'hello' })]);
  assert.equal(junk.followUpSentAt, null);
  const raw = base({});
  delete raw.followUpSentAt; // legacy record without the field
  const [legacy] = sanitizeComplaints([raw]);
  assert.equal(legacy.followUpSentAt, null);
  assert.equal(isPostRepairCheckinPending(legacy), true);
});

test('new complaints start unstamped', () => {
  const created = createComplaint({
    customerId: 'c1',
    customerName: 'Test Customer 21',
    zone: 'Barrian',
    issueCategory: 'Fiber Cut',
    reportedAt: '2026-10-29T10:00'
  }, [], NOW);
  assert.equal(created.followUpSentAt, null);
});

test('backup round-trip: followUpSentAt travels in settings.complaints and survives restore preview', () => {
  const state = createInitialState();
  const complaints = [resolved('CMP-701', '2026-10-28T11:00', { followUpSentAt: '2026-10-29T10:15' })];
  const backup = createJsonBackup(state, NOW, { complaints });
  const document = JSON.parse(backup);
  assert.equal(document.settings.complaints[0].followUpSentAt, '2026-10-29T10:15');
  const preview = previewJsonBackupMerge(state, backup, { currentComplaints: [], currentComplaintsStored: false });
  assert.equal(preview.complaints.length, 1);
  assert.equal(preview.complaints[0].followUpSentAt, '2026-10-29T10:15');
});

test('check-in message: bilingual, personalized, no raw placeholders left', () => {
  const complaint = resolved('CMP-110', '2026-10-28T11:00');
  const roman = buildPostRepairCheckinMessage(complaint, 'en');
  assert.ok(roman.includes('Test Customer 21'));
  assert.ok(roman.includes('CMP-110'));
  assert.ok(roman.includes('Fiber Cut'));
  assert.ok(!/[{}]/.test(roman));
  const urdu = buildPostRepairCheckinMessage(complaint, 'ur');
  assert.ok(urdu.includes('CMP-110'));
  assert.ok(/[\u0600-\u06FF]/.test(urdu)); // Urdu/Arabic script present
  assert.notEqual(urdu, roman);
  assert.equal(buildPostRepairCheckinMessage(null), '');
});

test('parsePktDateTimeMs: naive PKT wall-clock differences are exact', () => {
  const a = parsePktDateTimeMs('2026-10-28T11:00');
  const b = parsePktDateTimeMs('2026-10-29T17:00');
  assert.equal((b - a) / 3600000, 30);
  assert.equal(parsePktDateTimeMs('2026-13-01T00:00'), null);
  assert.equal(parsePktDateTimeMs(''), null);
  assert.equal(parsePktDateTimeMs(null), null);
});

test('i18n audit: every t() key used by the module + dialog exists in en and ur', () => {
  const source = readFileSync(new URL('../post-repair-checkin.js', import.meta.url), 'utf8');
  const used = new Set([...source.matchAll(/t\('([a-z0-9_]+)'/g)].map((m) => m[1]));
  // Keys the dialog/dashboard markup references via data-i18n.
  for (const key of ['prc_open_btn', 'prc_title', 'prc_intro']) used.add(key);
  assert.ok(used.size >= 10, `expected at least 10 audited keys, got ${used.size}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key] !== key, `missing en key: ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key] !== key, `missing ur key: ${key}`);
  }
});
