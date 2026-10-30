/**
 * power-backup-monitor.test.js — SISP-62: OLT / Feeder UPS Battery
 * Runtime & WAPDA Outage Timer.
 *
 * Spec pin: starting a WAPDA outage on a 4-hour UPS node at 10:00
 * shows 1h 30m remaining at 12:30, and restoring logs the total
 * outage duration.
 *
 * Also pinned: the registry starts empty (nothing seeded), the timer
 * is just a persisted startedAt (survives a storage round-trip), a
 * battery that depletes mid-outage files exactly ONE AREA_OUTAGE in
 * the SISP-15 Complaint Register (category 'WAPDA / Power Outage',
 * reportedAt = the depletion moment) even when the app only notices
 * on a later tick, a failed logger leaves the outage unlogged for the
 * next tick, restore-after-depletion keeps the complaint link in the
 * history record, and the registry round-trips through JSON backups
 * under the safe-merge rule. Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import {
  AREA_OUTAGE_CUSTOMER_ID, createComplaint, pakistanDateTimeNow, sanitizeComplaints
} from '../complaint-register.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  UPS_NODES_KEY,
  activeOutages,
  addUpsNode,
  batteryStatus,
  checkUpsNodeDepletions,
  cleanFedZones,
  createUpsNode,
  deleteUpsNode,
  endOutage,
  formatBatteryDuration,
  formatClockTime,
  formatRatedHours,
  loadUpsNodes,
  nextUpsNodeId,
  powerBackupSummary,
  sanitizeUpsNodes,
  saveUpsNodes,
  startOutage,
  updateUpsNode
} from '../power-backup-monitor.js';

const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

// Fixed clock points (epoch ms — duration math is timezone-free).
const T10_00 = Date.UTC(2026, 9, 29, 5, 0, 0);   // 10:00 PKT
const T12_30 = Date.UTC(2026, 9, 29, 7, 30, 0);  // 12:30 PKT
const T13_00 = Date.UTC(2026, 9, 29, 8, 0, 0);   // 13:00 PKT
const T13_59 = Date.UTC(2026, 9, 29, 8, 59, 0);  // 13:59 PKT
const T14_00 = Date.UTC(2026, 9, 29, 9, 0, 0);   // 14:00 PKT (4h after 10:00)
const T16_00 = Date.UTC(2026, 9, 29, 11, 0, 0);  // 16:00 PKT

const oltNode = (existing = []) => createUpsNode({
  name: 'Main OLT — Shahdara', kind: 'OLT', ratedBatteryHours: 4, fedZones: ['BARRIAN', 'PALALIYAA']
}, existing, T10_00);

/** The app's SISP-15 logger, replicated 1:1 from app.js's wiring. */
function makeRegisterLogger(register) {
  return (node, depletedAtMs) => {
    const zone = node.fedZones.length ? node.fedZones.join(', ') : node.name;
    const complaint = createComplaint({
      customerId: AREA_OUTAGE_CUSTOMER_ID,
      areaOutage: true,
      zone,
      issueCategory: 'WAPDA / Power Outage',
      reportedAt: pakistanDateTimeNow(new Date(depletedAtMs)),
      resolutionNote: `Auto-logged by the Power Backup monitor: the UPS battery for ${node.name} ran out during a WAPDA outage (rated backup ${node.ratedBatteryHours}h, WAPDA still off).`
    }, register);
    register.push(complaint);
    return complaint.id;
  };
}

test('registry: starts empty, ids run UPS-101+, CRUD validates and never seeds', () => {
  const storage = store();
  assert.deepEqual(loadUpsNodes(storage), []);
  assert.equal(nextUpsNodeId([]), 'UPS-101');

  let nodes = addUpsNode([], { name: 'Main OLT — Shahdara', kind: 'OLT', ratedBatteryHours: 4, fedZones: 'BARRIAN, PALALIYAA' }, T10_00);
  nodes = addUpsNode(nodes, { name: 'Gangall Switch', kind: 'Switch', ratedBatteryHours: 2.5, fedZones: ['GANGALL'] }, T10_00);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].nodeId, 'UPS-101');
  assert.equal(nodes[1].nodeId, 'UPS-102');
  assert.deepEqual(nodes[0].fedZones, ['BARRIAN', 'PALALIYAA']);
  assert.equal(nodes[0].outage, null);
  assert.deepEqual(nodes[0].history, []);

  assert.throws(() => addUpsNode([], { name: '  ', ratedBatteryHours: 4 }), /name/);
  assert.throws(() => addUpsNode([], { name: 'X', ratedBatteryHours: 0 }), /Battery backup/);
  assert.throws(() => addUpsNode([], { name: 'X', ratedBatteryHours: 999 }), /Battery backup/);
  assert.equal(createUpsNode({ name: 'X', kind: 'Bogus', ratedBatteryHours: 1 }, []).kind, 'Other');

  const updated = updateUpsNode(nodes, 'UPS-102', { ratedBatteryHours: 3 });
  assert.equal(updated[1].ratedBatteryHours, 3);
  assert.equal(nodes[1].ratedBatteryHours, 2.5, 'update returns a new list, original untouched');
  assert.throws(() => updateUpsNode(nodes, 'UPS-999', { name: 'Y' }), /not found/);

  assert.equal(deleteUpsNode(nodes, 'UPS-102').length, 1);
  assert.throws(() => deleteUpsNode(nodes, 'UPS-999'), /not found/);
});

test('cleanFedZones: arrays and comma strings, trimmed, deduped case-insensitively', () => {
  assert.deepEqual(cleanFedZones(' Barrian , barrian, NAKAR ,'), ['Barrian', 'NAKAR']);
  assert.deepEqual(cleanFedZones(['SODAA', '', '  ', 'sodaa', 'BANII']), ['SODAA', 'BANII']);
  assert.deepEqual(cleanFedZones(null), []);
  assert.deepEqual(cleanFedZones(undefined), []);
});

test('sanitize: malformed nodes dropped, outage/history survive a backup round-trip', () => {
  const messy = [
    null, 'junk', { name: 'No id', ratedBatteryHours: 4 },
    { nodeId: 'UPS-101', name: '', ratedBatteryHours: 4 },
    { nodeId: 'UPS-102', name: 'Bad hours', ratedBatteryHours: -2 },
    {
      nodeId: 'UPS-103', name: 'Main OLT', kind: 'OLT', ratedBatteryHours: 4,
      fedZones: ['BARRIAN'],
      outage: { startedAt: new Date(T10_00).toISOString(), batteryDepletedLogged: true, complaintId: 'CMP-101', evil: 'x' },
      history: [{ startedAt: new Date(T10_00).toISOString(), restoredAt: new Date(T13_00).toISOString(), durationMinutes: 180, batteryDepleted: false, complaintId: '' }],
      unknownField: 'drop me'
    }
  ];
  const clean = sanitizeUpsNodes(messy);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].nodeId, 'UPS-103');
  assert.equal(clean[0].unknownField, undefined);
  assert.deepEqual(Object.keys(clean[0].outage).sort(), ['batteryDepletedLogged', 'complaintId', 'startedAt']);
  assert.equal(clean[0].outage.complaintId, 'CMP-101');
  assert.equal(clean[0].history[0].durationMinutes, 180);
  assert.deepEqual(sanitizeUpsNodes('nope'), []);
});

test('SPEC PIN: 4-hour node, outage at 10:00 -> 1h 30m remaining at 12:30; restore logs total duration', () => {
  let nodes = [oltNode()];
  nodes = startOutage(nodes, 'UPS-101', T10_00);

  const at1230 = batteryStatus(nodes[0], T12_30);
  assert.equal(at1230.remainingMinutes, 90);
  assert.equal(at1230.remainingLabel, '1h 30m');
  assert.equal(at1230.elapsedMinutes, 150);
  assert.equal(at1230.depleted, false);
  assert.equal(formatClockTime(nodes[0].outage.startedAt), '10:00');

  const { nodes: after, record, node } = endOutage(nodes, 'UPS-101', T13_00);
  assert.equal(record.durationMinutes, 180, 'total outage duration logged on restore');
  assert.equal(formatBatteryDuration(record.durationMinutes), '3h 0m');
  assert.equal(record.batteryDepleted, false);
  assert.equal(after[0].outage, null);
  assert.equal(node.history.length, 1);
  assert.equal(node.history[0].durationMinutes, 180);
  assert.equal(batteryStatus(after[0], T13_00), null, 'no live status once restored');
});

test('timer guards: double start, restore/delete during wrong states refused', () => {
  let nodes = [oltNode()];
  assert.throws(() => endOutage(nodes, 'UPS-101', T10_00), /No WAPDA outage/);
  nodes = startOutage(nodes, 'UPS-101', T10_00);
  assert.throws(() => startOutage(nodes, 'UPS-101', T10_00), /already running/);
  assert.throws(() => deleteUpsNode(nodes, 'UPS-101'), /still off/);
  assert.throws(() => startOutage(nodes, 'UPS-999', T10_00), /not found/);
});

test('timer persists through storage: reload mid-outage keeps counting from startedAt', () => {
  const storage = store();
  let nodes = startOutage([oltNode()], 'UPS-101', T10_00);
  assert.equal(saveUpsNodes(nodes, storage), true);
  assert.ok(storage.getItem(UPS_NODES_KEY).includes('UPS-101'));
  const reloaded = loadUpsNodes(storage);
  const status = batteryStatus(reloaded[0], T12_30);
  assert.equal(status.remainingLabel, '1h 30m');
  assert.equal(activeOutages(reloaded, T12_30).length, 1);
  assert.equal(powerBackupSummary(reloaded, T12_30).activeCount, 1);
});

test('depletion: battery dying mid-outage files exactly ONE AREA_OUTAGE in the SISP-15 register', () => {
  const register = [];
  const logger = makeRegisterLogger(register);
  let nodes = startOutage([oltNode()], 'UPS-101', T10_00);

  // 13:59 — one minute of battery left, nothing logged.
  let sweep = checkUpsNodeDepletions(nodes, T13_59, logger);
  assert.equal(sweep.logged.length, 0);
  assert.equal(register.length, 0);
  assert.equal(batteryStatus(nodes[0], T13_59).remainingMinutes, 1);

  // 14:00 — battery exactly depleted: logged once, stamped with the id.
  sweep = checkUpsNodeDepletions(nodes, T14_00, logger);
  assert.equal(sweep.logged.length, 1);
  assert.equal(sweep.logged[0].complaintId, 'CMP-101');
  assert.equal(sweep.logged[0].depletedAtMs, T14_00);
  nodes = sweep.nodes;
  assert.equal(nodes[0].outage.batteryDepletedLogged, true);
  assert.equal(nodes[0].outage.complaintId, 'CMP-101');
  assert.equal(register.length, 1);
  const entry = register[0];
  assert.equal(entry.customerId, AREA_OUTAGE_CUSTOMER_ID);
  assert.equal(entry.issueCategory, 'WAPDA / Power Outage');
  assert.equal(entry.zone, 'BARRIAN, PALALIYAA');
  assert.equal(entry.reportedAt, '2026-10-29T14:00', 'reportedAt is the depletion moment (PKT), not the tick time');
  assert.equal(entry.status, 'Open');
  assert.match(entry.resolutionNote, /UPS battery for Main OLT/);
  // The register's own sanitizer accepts the entry unchanged (no corruption).
  assert.equal(sanitizeComplaints(register).length, 1);

  // Later ticks never log it again.
  sweep = checkUpsNodeDepletions(nodes, T16_00, logger);
  assert.equal(sweep.logged.length, 0);
  assert.equal(register.length, 1);
});

test('depletion noticed after app restart: persisted unlogged outage still files on the next check', () => {
  const storage = store();
  const register = [];
  // App closed at 10:05 with the outage running; battery died at 14:00;
  // the app is only reopened at 16:00.
  saveUpsNodes(startOutage([oltNode()], 'UPS-101', T10_00), storage);
  const reloaded = loadUpsNodes(storage);
  assert.equal(reloaded[0].outage.batteryDepletedLogged, false);
  const sweep = checkUpsNodeDepletions(reloaded, T16_00, makeRegisterLogger(register));
  assert.equal(sweep.logged.length, 1);
  assert.equal(register[0].reportedAt, '2026-10-29T14:00', 'backdated to depletion, not to the 16:00 reopen');
});

test('depletion: a failing logger leaves the outage unlogged so the next tick retries', () => {
  const nodes = startOutage([oltNode()], 'UPS-101', T10_00);
  const failing = () => { throw new Error('register unavailable'); };
  const sweep = checkUpsNodeDepletions(nodes, T14_00, failing);
  assert.equal(sweep.logged.length, 0);
  assert.equal(sweep.nodes[0].outage.batteryDepletedLogged, false);
  const empty = checkUpsNodeDepletions(nodes, T14_00, () => '');
  assert.equal(empty.logged.length, 0);
  assert.equal(empty.nodes[0].outage.batteryDepletedLogged, false);
  const noLogger = checkUpsNodeDepletions(nodes, T14_00);
  assert.equal(noLogger.logged.length, 0);
});

test('restore after depletion: history keeps the complaint link and batteryDepleted flag', () => {
  const register = [];
  let nodes = startOutage([oltNode()], 'UPS-101', T10_00);
  nodes = checkUpsNodeDepletions(nodes, T14_00, makeRegisterLogger(register)).nodes;
  const { record, node } = endOutage(nodes, 'UPS-101', T16_00);
  assert.equal(record.durationMinutes, 360);
  assert.equal(record.batteryDepleted, true);
  assert.equal(record.complaintId, 'CMP-101');
  assert.equal(node.history[0].batteryDepleted, true);
  assert.equal(node.outage, null);
});

test('summary: worst node is the one whose battery dies first; depleted counts separately', () => {
  const first = oltNode();
  let nodes = [
    first,
    createUpsNode({ name: 'Gangall Switch', kind: 'Switch', ratedBatteryHours: 2, fedZones: ['GANGALL'] }, [first], T10_00)
  ];
  nodes = startOutage(nodes, 'UPS-101', T10_00);
  nodes = startOutage(nodes, 'UPS-102', T10_00);
  const summary = powerBackupSummary(nodes, T12_30);
  assert.equal(summary.nodeCount, 2);
  assert.equal(summary.activeCount, 2);
  assert.equal(summary.depletedCount, 1, 'the 2h switch battery died at 12:00');
  assert.equal(summary.worst.node.nodeId, 'UPS-102');
  assert.equal(summary.worst.status.depleted, true);
  assert.equal(powerBackupSummary([], T12_30).worst, null);
});

test('formatting: durations and rated hours render without float noise', () => {
  assert.equal(formatBatteryDuration(90), '1h 30m');
  assert.equal(formatBatteryDuration(45), '45m');
  assert.equal(formatBatteryDuration(180), '3h 0m');
  assert.equal(formatBatteryDuration(0), '0m');
  assert.equal(formatRatedHours(4), '4');
  assert.equal(formatRatedHours(2.5), '2.5');
});

test('backup: nodes travel in settings.upsNodes and restore under the safe-merge rule', () => {
  const nodes = startOutage([oltNode()], 'UPS-101', T10_00);
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-29T12:00:00+05:00'), { upsNodes: nodes });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.upsNodes.length, 1);
  assert.equal(parsed.settings.upsNodes[0].nodeId, 'UPS-101');
  assert.ok(parsed.settings.upsNodes[0].outage, 'a running outage travels with the backup');

  // Fresh device: adopted.
  const fresh = previewJsonBackupMerge(createInitialState(), backupText, { currentUpsNodes: [], currentUpsNodesStored: false });
  assert.equal(fresh.upsNodes.length, 1);
  assert.equal(fresh.upsNodes[0].outage.startedAt, new Date(T10_00).toISOString());
  assert.equal(fresh.counts.upsNodesRestored, 1);

  // Identical on both sides: no restore, no conflict.
  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentUpsNodes: nodes, currentUpsNodesStored: true });
  assert.equal(identical.upsNodes, null);
  assert.equal(identical.conflicts.some((c) => /Power backup/.test(c.field)), false);

  // Different real nodes on both sides: keep existing + conflict.
  const other = [createUpsNode({ name: 'Other OLT', kind: 'OLT', ratedBatteryHours: 6, fedZones: [] }, [], T10_00)];
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentUpsNodes: other, currentUpsNodesStored: true });
  assert.equal(clash.upsNodes, null);
  assert.equal(clash.conflicts.some((c) => /Power backup/.test(c.field)), true);

  // No nodes in the backup: preview carries nothing, existing data model untouched.
  const plain = previewJsonBackupMerge(createInitialState(), createJsonBackup(createInitialState(), new Date('2026-10-29T12:00:00+05:00'), {}));
  assert.equal(plain.upsNodes, null);
});

test('i18n audit: every pwr_* key used in the module, app.js and index.html exists in en AND ur', () => {
  const sources = [
    readFileSync(new URL('../power-backup-monitor.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../app.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  ].join('\n');
  const used = new Set([...sources.matchAll(/pwr_[a-z_]+/g)].map((match) => match[0]));
  assert.ok(used.size >= 30, `expected a real key surface, found ${used.size}`);
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `missing en translation: ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur translation: ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en translation is the raw key: ${key}`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur translation is the raw key: ${key}`);
  }
});
