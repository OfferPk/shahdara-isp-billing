import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isStrictDate,
  normalizeAuditCycle,
  normalizeAuditCycleList,
  findAuditCycle,
  createAuditCycle,
  completeAuditCycle,
  removeAuditCycle,
  normalizeAuditLine,
  normalizeAuditLineList,
  findAuditLine,
  addAuditLine,
  removeAuditLine,
  auditLineVariance,
  auditCycleLines,
  auditCycleTotals,
  auditsSorted,
  auditsOpen,
  auditsCompleted,
  auditsByAuditor,
  auditAuditors,
  auditCycleSummaryText,
  auditLineText,
  auditCycleText,
  auditLineHtml,
  auditCycleHtml,
  auditCycleAllHtml,
  auditCycleCsv,
  auditCycleFilename,
} from '../inventory-audit.js';

const dir = dirname(fileURLToPath(import.meta.url));

const audit = (over = {}) => ({
  id: 'AUD-1',
  auditDate: '2026-11-01',
  auditor: 'Saad',
  status: 'open',
  completedDate: '',
  ...over,
});

const line = (over = {}) => ({
  id: 'LINE-1',
  auditId: 'AUD-1',
  item: 'ONU',
  recordedQty: 10,
  countedQty: 9,
  varianceNote: 'One unit missing from shelf',
  ...over,
});

test('half-formed audit refused', () => {
  assert.equal(normalizeAuditCycle(null), null);
  assert.equal(normalizeAuditCycle(audit({ id: '' })), null);
  assert.equal(normalizeAuditCycle(audit({ auditor: '' })), null);
  assert.equal(normalizeAuditCycle(audit({ auditDate: '' })), null);
  assert.equal(normalizeAuditCycle(audit({ auditDate: '2026-02-30' })), null);
  assert.equal(normalizeAuditCycle(audit({ auditDate: '01-11-2026' })), null);
});

test('strict dates accept 31-day months and Feb 29 only in leap years', () => {
  assert.equal(isStrictDate('2026-01-31'), true);
  assert.equal(isStrictDate('2026-08-31'), true);
  assert.equal(isStrictDate('2026-10-31'), true);
  assert.equal(isStrictDate('2026-12-31'), true);
  assert.equal(isStrictDate('2026-04-31'), false);
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-02-29'), false);
  assert.equal(isStrictDate('2026-13-01'), false);
  assert.equal(isStrictDate('2026-00-10'), false);
});

test('completed audit needs a strict completed date; unknown status becomes open', () => {
  assert.equal(normalizeAuditCycle(audit({ status: 'completed' })), null);
  assert.equal(normalizeAuditCycle(audit({ status: 'completed', completedDate: '2026-02-30' })), null);
  const done = normalizeAuditCycle(audit({ status: 'completed', completedDate: '2026-11-02' }));
  assert.equal(done.status, 'completed');
  assert.equal(done.completedDate, '2026-11-02');
  assert.equal(normalizeAuditCycle(audit({ status: 'weird' })).status, 'open');
});

test('duplicate audit id refused', () => {
  const list = createAuditCycle([], audit());
  assert.equal(list.length, 1);
  assert.equal(createAuditCycle(list, audit({ auditor: 'Other' })).length, 1);
  assert.equal(createAuditCycle(list, audit())[0].auditor, 'Saad');
});

test('complete rules: open completes, bad date ignored, completed stays completed', () => {
  const list = createAuditCycle([], audit());
  const done = completeAuditCycle(list, 'AUD-1', '2026-11-03');
  assert.equal(done[0].status, 'completed');
  assert.equal(done[0].completedDate, '2026-11-03');
  assert.equal(completeAuditCycle(list, 'AUD-1', 'not-a-date')[0].status, 'open');
  assert.equal(completeAuditCycle(done, 'AUD-1', '2026-11-04')[0].completedDate, '2026-11-03');
  assert.equal(completeAuditCycle(list, 'NOPE', '2026-11-03').length, 1);
});

test('remove audit: open removed, completed kept', () => {
  const list = createAuditCycle([], audit());
  assert.equal(removeAuditCycle(list, 'AUD-1').length, 0);
  const done = completeAuditCycle(list, 'AUD-1', '2026-11-03');
  assert.equal(removeAuditCycle(done, 'AUD-1').length, 1);
});

test('half-formed line refused', () => {
  assert.equal(normalizeAuditLine(null), null);
  assert.equal(normalizeAuditLine(line({ id: '' })), null);
  assert.equal(normalizeAuditLine(line({ auditId: '' })), null);
  assert.equal(normalizeAuditLine(line({ item: '' })), null);
  assert.equal(normalizeAuditLine(line({ recordedQty: '' })), null);
  assert.equal(normalizeAuditLine(line({ countedQty: null })), null);
});

test('quantities must be whole units >= 0; numeric strings accepted', () => {
  assert.equal(normalizeAuditLine(line({ recordedQty: -1 })), null);
  assert.equal(normalizeAuditLine(line({ countedQty: 1.5 })), null);
  assert.equal(normalizeAuditLine(line({ recordedQty: 'ten' })), null);
  assert.equal(normalizeAuditLine(line({ recordedQty: Number.NaN })), null);
  assert.equal(normalizeAuditLine(line({ recordedQty: '12', countedQty: '12' })).recordedQty, 12);
  assert.equal(normalizeAuditLine(line({ recordedQty: 0, countedQty: 0 })).countedQty, 0);
});

test('unknown fields dropped from audits and lines', () => {
  const cleanAudit = normalizeAuditCycle(audit({ billId: 'B-1', paymentTotal: 500 }));
  assert.equal('billId' in cleanAudit, false);
  assert.equal('paymentTotal' in cleanAudit, false);
  const cleanLine = normalizeAuditLine(line({ stockQty: 99, billAmount: 100 }));
  assert.equal('stockQty' in cleanLine, false);
  assert.equal('billAmount' in cleanLine, false);
});

test('add line: missing audit refused, completed audit refused, duplicate id refused', () => {
  const audits = createAuditCycle([], audit());
  assert.equal(addAuditLine([], [], line()).length, 0);
  assert.equal(addAuditLine(audits, [], line({ auditId: 'NOPE' })).length, 0);
  const withLine = addAuditLine(audits, [], line());
  assert.equal(withLine.length, 1);
  assert.equal(addAuditLine(audits, withLine, line({ item: 'Router' })).length, 1);
  const done = completeAuditCycle(audits, 'AUD-1', '2026-11-03');
  assert.equal(addAuditLine(done, withLine, line({ id: 'LINE-2' })).length, 1);
});

test('remove line: open audit allows, completed audit refuses', () => {
  const audits = createAuditCycle([], audit());
  const lines = addAuditLine(audits, [], line());
  assert.equal(removeAuditLine(audits, lines, 'AUD-1', 'LINE-1').length, 0);
  const done = completeAuditCycle(audits, 'AUD-1', '2026-11-03');
  assert.equal(removeAuditLine(done, lines, 'AUD-1', 'LINE-1').length, 1);
  assert.equal(removeAuditLine(audits, lines, 'AUD-1', 'NOPE').length, 1);
});

test('variance labels: balanced, shortage, surplus', () => {
  assert.deepEqual(auditLineVariance(line({ recordedQty: 5, countedQty: 5 })), { difference: 0, label: 'Balanced' });
  assert.deepEqual(auditLineVariance(line({ recordedQty: 10, countedQty: 9 })), { difference: -1, label: 'Shortage' });
  assert.deepEqual(auditLineVariance(line({ recordedQty: 3, countedQty: 5 })), { difference: 2, label: 'Surplus' });
  assert.equal(auditLineVariance(null), null);
});

test('audit lines ordered item A-Z then id', () => {
  const audits = createAuditCycle([], audit());
  let lines = addAuditLine(audits, [], line({ id: 'L-2', item: 'Router' }));
  lines = addAuditLine(audits, lines, line({ id: 'L-1', item: 'onu' }));
  lines = addAuditLine(audits, lines, line({ id: 'L-3', item: 'Drop cable', auditId: 'AUD-1' }));
  const ordered = auditCycleLines(lines, 'AUD-1');
  assert.deepEqual(ordered.map((entry) => entry.item), ['Drop cable', 'onu', 'Router']);
  assert.equal(auditCycleLines(lines, 'AUD-2').length, 0);
});

test('audit totals sum recorded and counted exactly', () => {
  const audits = createAuditCycle([], audit());
  let lines = addAuditLine(audits, [], line({ recordedQty: 10, countedQty: 9 }));
  lines = addAuditLine(audits, lines, line({ id: 'LINE-2', item: 'Router', recordedQty: 4, countedQty: 6, varianceNote: '' }));
  assert.deepEqual(auditCycleTotals(lines, 'AUD-1'), { items: 2, recorded: 14, counted: 15, difference: 1, label: 'Surplus' });
  assert.deepEqual(auditCycleTotals(lines, 'AUD-2'), { items: 0, recorded: 0, counted: 0, difference: 0, label: 'Balanced' });
});

test('audits sorted newest first; open and completed lists split', () => {
  let audits = createAuditCycle([], audit({ id: 'A-1', auditDate: '2026-10-01' }));
  audits = createAuditCycle(audits, audit({ id: 'A-2', auditDate: '2026-11-01' }));
  audits = completeAuditCycle(audits, 'A-1', '2026-10-02');
  assert.deepEqual(auditsSorted(audits).map((entry) => entry.id), ['A-2', 'A-1']);
  assert.deepEqual(auditsOpen(audits).map((entry) => entry.id), ['A-2']);
  assert.deepEqual(auditsCompleted(audits).map((entry) => entry.id), ['A-1']);
});

test('auditor filter is case-insensitive; auditors list keeps first spelling A-Z', () => {
  let audits = createAuditCycle([], audit({ auditor: 'Saad' }));
  audits = createAuditCycle(audits, audit({ id: 'AUD-2', auditor: 'saad' }));
  audits = createAuditCycle(audits, audit({ id: 'AUD-3', auditor: 'Ali' }));
  assert.equal(auditsByAuditor(audits, 'SAAD').length, 2);
  assert.equal(auditsByAuditor(audits, '').length, 3);
  assert.deepEqual(auditAuditors(audits), ['Ali', 'Saad']);
});

test('find helpers return null when missing', () => {
  assert.equal(findAuditCycle([], 'AUD-1'), null);
  assert.equal(findAuditLine([], 'LINE-1'), null);
  const audits = createAuditCycle([], audit());
  assert.equal(findAuditCycle(audits, 'AUD-1').auditor, 'Saad');
  const lines = addAuditLine(audits, [], line());
  assert.equal(findAuditLine(lines, 'LINE-1').item, 'ONU');
});

test('summary, line text and cycle text', () => {
  const audits = createAuditCycle([], audit());
  const lines = addAuditLine(audits, [], line());
  assert.equal(auditCycleSummaryText(audits, lines), '1 audits (1 open, 0 completed), 1 items counted');
  assert.equal(auditLineText(line()), 'ONU: recorded 10, counted 9 (Shortage -1) — One unit missing from shelf');
  assert.equal(auditLineText(null), '');
  assert.ok(auditCycleText(audit(), lines).includes('Audit AUD-1 (2026-11-01, Saad, open)'));
  assert.equal(auditCycleText(null, lines), '');
});

test('HTML escapes user text', () => {
  const html = auditLineHtml(line({ item: '<script>alert(1)</script>', varianceNote: '"quoted"' }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const cycleHtml = auditCycleHtml(audit({ auditor: '<b>Saad</b>' }), []);
  assert.ok(!cycleHtml.includes('<b>Saad</b>'));
  assert.ok(auditCycleAllHtml([], []).length === 0);
});

test('CSV has one row per line plus audit-only rows; filename fixed', () => {
  const audits = createAuditCycle([], audit());
  const lines = addAuditLine(audits, [], line());
  const csv = auditCycleCsv(audits, lines);
  assert.ok(csv.startsWith('audit_id,audit_date,auditor'));
  assert.ok(csv.includes('"AUD-1","2026-11-01","Saad","open",""'));
  assert.ok(csv.includes('"LINE-1","ONU","10","9","-1","Shortage"'));
  const emptyCsv = auditCycleCsv(createAuditCycle([], audit({ id: 'AUD-9' })), []);
  assert.ok(emptyCsv.includes('"AUD-9"'));
  assert.equal(auditCycleFilename(), 'inventory-audits.csv');
});

test('inputs are never mutated', () => {
  const input = audit();
  const snapshot = JSON.stringify(input);
  createAuditCycle([], input);
  normalizeAuditCycle(input);
  assert.equal(JSON.stringify(input), snapshot);
  const lineInput = line();
  const lineSnapshot = JSON.stringify(lineInput);
  const audits = createAuditCycle([], audit());
  addAuditLine(audits, [], lineInput);
  assert.equal(JSON.stringify(lineInput), lineSnapshot);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const audits = normalizeAuditCycleList([audit(), audit({ auditor: 'Other' }), null, audit({ auditDate: 'bad' })]);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].auditor, 'Saad');
  const lines = normalizeAuditLineList([line(), line({ item: 'Router' }), null, 'nope']);
  assert.equal(lines.length, 1);
  assert.equal(normalizeAuditCycleList('nope').length, 0);
  assert.equal(normalizeAuditLineList(null).length, 0);
});

test('purity fence: module reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'inventory-audit.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('import '));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = [
    'iaHeading', 'iaSummary', 'iaExportBtn',
    'iaAuditId', 'iaAuditDate', 'iaAuditor', 'iaSaveBtn',
    'iaCompleteId', 'iaCompleteDate', 'iaCompleteBtn',
    'iaRemoveAuditId', 'iaRemoveAuditBtn',
    'iaLineAuditId', 'iaLineId', 'iaLineItem', 'iaLineRecorded',
    'iaLineCounted', 'iaLineNote', 'iaLineSaveBtn',
    'iaLineRemoveId', 'iaLineRemoveBtn',
    'iaFilter', 'iaBody',
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the inventory audit panel and render loop', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('inventory-audit.js'));
  assert.ok(app.includes('renderInventoryAudit'));
  assert.ok(app.includes('shahdara_inventory_audits_v1'));
  assert.ok(app.includes('shahdara_inventory_audit_lines_v1'));
  assert.doesNotMatch(app, /\b(?:suspendService|restoreService|RouterOS|RADIUS|OLT)\b/);
});
