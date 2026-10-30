// SISP-82: Lineman Splicing Machine, OTDR & Field Tool Custody Register.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// a splicer assigned with 950 splices, then logged with +60 new splices,
// reaches 1,010 and triggers the 1,000+ electrode maintenance warning.
// Also pins: the register starts empty (nothing seeds custody records),
// assign/return audit history is append-only, the wrong-counter guard,
// sanitize behaviour, storage round-trip under sisp_field_tools_v1, and
// the backup safe-merge round-trip (settings.fieldTools).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  FIELD_TOOLS_KEY,
  SPLICE_MAINTENANCE_THRESHOLD,
  TOOL_TYPES,
  addFieldTool,
  assignFieldTool,
  buildToolFields,
  fieldToolsSummary,
  loadFieldTools,
  logToolUsage,
  nextToolId,
  returnFieldTool,
  sanitizeFieldTools,
  saveFieldTools,
  toolNeedsMaintenance,
  toolsNeedingMaintenance
} from '../tool-custody-register.js';

const LINEMAN = 'Test Lineman A';
const LINEMAN_B = 'Test Lineman B';

const splicer950 = () => addFieldTool([], {
  type: 'fusion-splicer', name: 'Test Splicer X1', serial: 'SN-TEST-001', spliceCount: 950
}, { date: '2026-10-01' })[0];

test('register starts empty — the catalogue is form aid only, no custody records are seeded', () => {
  assert.deepEqual(sanitizeFieldTools([]), []);
  assert.deepEqual(loadFieldTools({ getItem: () => null }), []);
  assert.deepEqual(TOOL_TYPES.map((entry) => entry.value), ['fusion-splicer', 'cleaver', 'otdr', 'opm', 'vfl', 'ladder']);
  assert.equal(SPLICE_MAINTENANCE_THRESHOLD, 1000);
});

test('PINNED: splicer assigned at 950 splices + 60 logged = 1,010 → electrode maintenance warning', () => {
  let tools = addFieldTool([], {
    type: 'fusion-splicer', name: 'Test Splicer X1', serial: 'SN-TEST-001', spliceCount: 950
  }, { date: '2026-10-01' });
  assert.equal(tools[0].spliceCount, 950);
  assert.equal(toolNeedsMaintenance(tools[0]), false);

  tools = assignFieldTool(tools, tools[0].toolId, { lineman: LINEMAN, date: '2026-10-02' });
  assert.equal(tools[0].assignedToLineman, LINEMAN);

  tools = logToolUsage(tools, tools[0].toolId, { splices: 60, date: '2026-10-03' });
  assert.equal(tools[0].spliceCount, 1010);
  assert.equal(toolNeedsMaintenance(tools[0]), true);
  assert.deepEqual(toolsNeedingMaintenance(tools).map((tool) => tool.toolId), [tools[0].toolId]);
  assert.equal(fieldToolsSummary(tools).maintenanceCount, 1);
});

test('maintenance threshold boundary: 999 splices is fine, exactly 1,000 is due', () => {
  const at999 = addFieldTool([], { type: 'fusion-splicer', spliceCount: 999 })[0];
  assert.equal(toolNeedsMaintenance(at999), false);
  const at1000 = logToolUsage([at999], at999.toolId, { splices: 1 })[0];
  assert.equal(at1000.spliceCount, 1000);
  assert.equal(toolNeedsMaintenance(at1000), true);
  // A cleaver at 1,000 cleaves is never an electrode warning.
  const cleaver = addFieldTool([], { type: 'cleaver', bladeCleavesCount: 5000 })[0];
  assert.equal(toolNeedsMaintenance(cleaver), false);
});

test('assign/return audit: history is append-only and custody cannot jump holders', () => {
  let tools = [splicer950()];
  const id = tools[0].toolId;
  tools = assignFieldTool(tools, id, { lineman: LINEMAN, date: '2026-10-02' });
  assert.throws(() => assignFieldTool(tools, id, { lineman: LINEMAN_B, date: '2026-10-03' }), /already with/);
  assert.throws(() => assignFieldTool(tools, id, { lineman: ' ', date: '2026-10-03' }), /Lineman name is required/);
  tools = returnFieldTool(tools, id, { date: '2026-10-05', condition: 'fair' });
  assert.equal(tools[0].assignedToLineman, '');
  assert.equal(tools[0].condition, 'fair');
  assert.throws(() => returnFieldTool(tools, id, { date: '2026-10-06' }), /already in the store/);
  const actions = tools[0].history.map((entry) => entry.action);
  assert.deepEqual(actions, ['added', 'assigned', 'returned', 'condition']);
  assert.equal(tools[0].history[1].lineman, LINEMAN);
  assert.equal(tools[0].history[2].lineman, LINEMAN);
  // Re-assign after return works and keeps the earlier history intact.
  tools = assignFieldTool(tools, id, { lineman: LINEMAN_B, date: '2026-10-07' });
  assert.equal(tools[0].assignedToLineman, LINEMAN_B);
  assert.equal(tools[0].history.length, 5);
});

test('usage logging: only the counter belonging to the tool type can move', () => {
  let tools = addFieldTool([], { type: 'cleaver', name: 'Test Cleaver', bladeCleavesCount: 120 });
  const cleaverId = tools[0].toolId;
  tools = logToolUsage(tools, cleaverId, { cleaves: 30 });
  assert.equal(tools[0].bladeCleavesCount, 150);
  assert.equal(tools[0].spliceCount, 0);
  assert.throws(() => logToolUsage(tools, cleaverId, { splices: 5 }), /belong to a fusion splicer/);
  assert.throws(() => logToolUsage(tools, cleaverId, { cleaves: 0 }), /above zero/);
  assert.throws(() => logToolUsage(tools, cleaverId, { cleaves: 2.5 }), /above zero/);

  const otdr = addFieldTool([], { type: 'otdr', name: 'Test OTDR' })[0];
  assert.throws(() => logToolUsage([otdr], otdr.toolId, { splices: 1 }), /no usage counter/);

  const splicer = splicer950();
  assert.throws(() => logToolUsage([splicer], splicer.toolId, { cleaves: 10 }), /belong to a cleaver/);
});

test('add validation: type required, name defaults to the type label, counters are type-scoped', () => {
  assert.throws(() => buildToolFields({ type: 'chainsaw' }), /Tool type is required/);
  assert.throws(() => buildToolFields({}), /Tool type is required/);
  const ladder = buildToolFields({ type: 'ladder', spliceCount: 500, bladeCleavesCount: 500 });
  assert.equal(ladder.name, 'Ladder');
  assert.equal(ladder.spliceCount, 0);
  assert.equal(ladder.bladeCleavesCount, 0);
  assert.equal(ladder.condition, 'good');
  assert.throws(() => buildToolFields({ type: 'otdr', condition: 'shiny' }), /valid condition/);
  assert.equal(nextToolId([]), 'TOOL-101');
  const two = addFieldTool(addFieldTool([], { type: 'otdr' }), { type: 'vfl' });
  assert.deepEqual(two.map((tool) => tool.toolId), ['TOOL-101', 'TOOL-102']);
});

test('sanitize: malformed rows dropped, counters clamped, ids filled from TOOL-101', () => {
  const clean = sanitizeFieldTools([
    { type: 'fusion-splicer', name: 'S1', spliceCount: -5, bladeCleavesCount: 3.9, condition: 'weird', history: [{ action: 'assigned', lineman: 'L', date: '2026-01-01' }, { action: 'hacked' }] },
    { type: 'unknown-gadget', name: 'Nope' },
    null,
    { toolId: 'TOOL-107', type: 'ladder', name: 'Ladder 3m' }
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].spliceCount, 0);
  assert.equal(clean[0].bladeCleavesCount, 3);
  assert.equal(clean[0].condition, 'good');
  assert.equal(clean[0].history.length, 1);
  assert.equal(clean[0].toolId, 'TOOL-101');
  assert.equal(clean[1].toolId, 'TOOL-107');
  assert.deepEqual(fieldToolsSummary(clean), { totalCount: 2, assignedCount: 0, inStoreCount: 2, maintenanceCount: 0 });
});

test('storage round-trip under sisp_field_tools_v1', () => {
  const store = new Map();
  const storage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value)
  };
  let tools = [splicer950()];
  tools = assignFieldTool(tools, tools[0].toolId, { lineman: LINEMAN, date: '2026-10-02' });
  assert.equal(saveFieldTools(tools, storage), true);
  assert.ok(store.has(FIELD_TOOLS_KEY));
  const loaded = loadFieldTools(storage);
  assert.deepEqual(loaded, sanitizeFieldTools(tools));
  assert.equal(loaded[0].assignedToLineman, LINEMAN);
  assert.equal(loadFieldTools({ getItem: () => '{broken json' }).length, 0);
});

test('backup safe-merge: field tools travel in settings.fieldTools and restore only onto an empty device', () => {
  const tools = [splicer950()];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { fieldTools: tools });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.fieldTools.length, 1);
  assert.equal(parsed.settings.fieldTools[0].toolId, 'TOOL-101');
  assert.equal(parsed.settings.fieldTools[0].spliceCount, 950);

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.fieldTools.length, 1);
  assert.equal(preview.fieldTools[0].type, 'fusion-splicer');

  const other = addFieldTool([], { type: 'ladder', name: 'Other Ladder' });
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentFieldTools: other, currentFieldToolsStored: true });
  assert.equal(clash.fieldTools, null);
  assert.ok(clash.conflicts.some((entry) => entry.field === 'Field tool records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentFieldTools: tools, currentFieldToolsStored: true });
  assert.equal(identical.fieldTools, null);
  assert.equal(identical.conflicts.filter((entry) => entry.field.startsWith('Field tool')).length, 0);
});

test('wiring: app.js imports the module, dashboard card + modal exist, dist entry list unchanged', () => {
  const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes("from './tool-custody-register.js'"));
  assert.ok(appJs.includes('setupToolCustodyModal'));
  assert.ok(appJs.includes('fieldTools: loadFieldTools()'));
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['toolCustodyModal', 'toolCustodyForm', 'toolCustodyList', 'toolCustodyCloseBtn', 'openToolCustodyModalBtn', 'dashboardToolsValue']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const build = fs.readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('tool-custody-register.js'), 'module must be inlined via app.js only (dist stays 25)');
});

test('i18n audit: every t() key used by the module + dashboard card resolves in en and ur', () => {
  const moduleSource = fs.readFileSync(new URL('../tool-custody-register.js', import.meta.url), 'utf8');
  const keys = new Set([...moduleSource.matchAll(/(?:^|[^a-zA-Z])t\('([a-z0-9_]+)'/g)].map((match) => match[1]));
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  for (const match of appSource.matchAll(/(?:^|[^a-zA-Z])t\('(dash_tools_[a-z_]+)'/g)) keys.add(match[1]);
  for (const type of TOOL_TYPES) keys.add(type.labelKey);
  assert.ok(keys.size >= 20, `expected a real key set, got ${keys.size}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key] !== key, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key] !== key, `ur missing ${key}`);
  }
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const htmlKeys = new Set([...html.matchAll(/data-i18n(?:-placeholder)?="(toolcust_[a-z0-9_]+|dash_card_tools|dash_btn_tools)"/g)].map((match) => match[1]));
  assert.ok(htmlKeys.size >= 15, `expected modal keys in index.html, got ${htmlKeys.size}`);
  for (const key of htmlKeys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string', `en missing html key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string', `ur missing html key ${key}`);
  }
});

test('CSS: tool custody styles use theme tokens only (no hex colours)', () => {
  const css = fs.readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('SISP-82: Field tool custody');
  assert.ok(start > 0, 'SISP-82 CSS block present');
  const block = css.slice(start, css.indexOf('/* SISP-48', start) > start ? css.indexOf('/* SISP-48', start) : start + 4000);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hex colours in the SISP-82 CSS block');
  assert.ok(block.includes('var(--modal-surface)') || block.includes('var(--surface)'));
});
