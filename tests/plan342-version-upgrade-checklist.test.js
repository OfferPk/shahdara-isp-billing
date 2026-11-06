import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as versionUpgradeChecklistModule from '../version-upgrade-checklist.js';
import {
  validVersionUpgradeChecklistDay,
  foldVersionUpgradeChecklistStepStatus,
  normalizeVersionUpgradeChecklistStep,
  normalizeVersionUpgradeChecklistSteps,
  normalizeVersionUpgradeChecklist,
  normalizeVersionUpgradeChecklistList,
  recordVersionUpgradeChecklist,
  versionUpgradeChecklistForVersions,
  tickVersionUpgradeChecklistStep,
  skipVersionUpgradeChecklistStep,
  versionUpgradeChecklistIsComplete,
  versionUpgradeChecklistSkippedSteps,
  incompleteVersionUpgradeChecklists,
  versionUpgradeChecklistCounts,
  versionUpgradeChecklistSummaryText,
  versionUpgradeChecklistText,
  versionUpgradeChecklistsText,
  versionUpgradeChecklistHtml,
  versionUpgradeChecklistsHtml,
  versionUpgradeChecklistIncompleteHtml,
  versionUpgradeChecklistCsv,
  versionUpgradeChecklistFilename,
} from '../version-upgrade-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'version-upgrade-checklist.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const CHECK_A = { id: 'VUC-1', fromVersion: '1.10.0', toVersion: '1.11.0', steps: ['Back up the shop device', 'Install the new version', 'Verify the ledger opens'], checker: 'Saad', date: '2026-11-05' };
const CHECK_B = { id: 'VUC-2', fromVersion: '1.9.0', toVersion: '1.10.0', steps: [{ text: 'Back up the shop device', status: 'done' }, { text: 'Install the new version', status: 'done' }], checker: 'Owner', date: '2026-10-05' };
const CHECK_C = { id: 'VUC-3', fromVersion: '1.11.0', toVersion: '1.12.0', steps: [{ text: 'Back up the shop device', status: 'done' }, { text: 'Install the new version', status: 'skipped' }, { text: 'Verify the ledger opens', status: 'pending' }], checker: 'Saad', date: '2026-11-06' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validVersionUpgradeChecklistDay('2026-11-05'), true);
  assert.equal(validVersionUpgradeChecklistDay('2028-02-29'), true);
  assert.equal(validVersionUpgradeChecklistDay('2026-02-29'), false);
  assert.equal(validVersionUpgradeChecklistDay('2026-04-31'), false);
  assert.equal(validVersionUpgradeChecklistDay('2026-13-01'), false);
  assert.equal(validVersionUpgradeChecklistDay('2026-00-10'), false);
  assert.equal(validVersionUpgradeChecklistDay('2026-11-5'), false);
  assert.equal(validVersionUpgradeChecklistDay('05-11-2026'), false);
  assert.equal(validVersionUpgradeChecklistDay(''), false);
  assert.equal(validVersionUpgradeChecklistDay(null), false);
  assert.equal(validVersionUpgradeChecklistDay(20261105), false);
});

test('step status folds done, skipped, and pending, unknown reads pending', () => {
  assert.equal(foldVersionUpgradeChecklistStepStatus('done'), 'done');
  assert.equal(foldVersionUpgradeChecklistStepStatus('Complete'), 'done');
  assert.equal(foldVersionUpgradeChecklistStepStatus('ticked'), 'done');
  assert.equal(foldVersionUpgradeChecklistStepStatus('skipped'), 'skipped');
  assert.equal(foldVersionUpgradeChecklistStepStatus('skip'), 'skipped');
  assert.equal(foldVersionUpgradeChecklistStepStatus('pending'), 'pending');
  assert.equal(foldVersionUpgradeChecklistStepStatus('whatever'), 'pending');
  assert.equal(foldVersionUpgradeChecklistStepStatus(''), 'pending');
  assert.equal(foldVersionUpgradeChecklistStepStatus(null), 'pending');
});

test('steps normalize from strings or objects, blank steps dropped', () => {
  assert.deepEqual(normalizeVersionUpgradeChecklistSteps([' Back up the shop device ', '  ', '', { text: 'Install the new version', status: 'DONE' }, { text: '', status: 'done' }, null]), [
    { text: 'Back up the shop device', status: 'pending' },
    { text: 'Install the new version', status: 'done' },
  ]);
  assert.deepEqual(normalizeVersionUpgradeChecklistStep('Verify the ledger opens'), { text: 'Verify the ledger opens', status: 'pending' });
  assert.equal(normalizeVersionUpgradeChecklistStep('   '), null);
  assert.equal(normalizeVersionUpgradeChecklistStep(42), null);
});

test('steps normalize from a newline string', () => {
  assert.deepEqual(normalizeVersionUpgradeChecklistSteps('Back up the shop device\nInstall the new version\n'), [
    { text: 'Back up the shop device', status: 'pending' },
    { text: 'Install the new version', status: 'pending' },
  ]);
  assert.deepEqual(normalizeVersionUpgradeChecklistSteps(42), []);
  assert.deepEqual(normalizeVersionUpgradeChecklistSteps(null), []);
});

test('a checklist normalizes with trimmed fields', () => {
  assert.deepEqual(normalizeVersionUpgradeChecklist({ ...CHECK_A, fromVersion: ' 1.10.0 ', checker: ' Saad ' }), {
    id: 'VUC-1',
    fromVersion: '1.10.0',
    toVersion: '1.11.0',
    steps: [
      { text: 'Back up the shop device', status: 'pending' },
      { text: 'Install the new version', status: 'pending' },
      { text: 'Verify the ledger opens', status: 'pending' },
    ],
    checker: 'Saad',
    date: '2026-11-05',
  });
});

test('half-formed checklists are refused', () => {
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, id: '' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, fromVersion: '' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, toVersion: '' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, steps: [] }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, steps: ['  ', ''] }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, checker: '' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, date: '2026-02-30' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, date: '' }), null);
  assert.equal(normalizeVersionUpgradeChecklist(null), null);
  assert.equal(normalizeVersionUpgradeChecklist('nope'), null);
});

test('same from and to version is refused', () => {
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, toVersion: '1.10.0' }), null);
  assert.equal(normalizeVersionUpgradeChecklist({ ...CHECK_A, toVersion: ' 1.10.0 ' }), null);
});

test('unknown fields are dropped', () => {
  const clean = normalizeVersionUpgradeChecklist({ ...CHECK_A, installedBy: 'Someone', rollbackPlan: 'go back' });
  assert.deepEqual(Object.keys(clean).sort(), ['checker', 'date', 'fromVersion', 'id', 'steps', 'toVersion']);
});

test('record refuses duplicate ids and never rewrites', () => {
  const list = recordVersionUpgradeChecklist([], CHECK_A);
  const again = recordVersionUpgradeChecklist(list, { ...CHECK_A, checker: 'Owner' });
  assert.equal(again.length, 1);
  assert.equal(again[0].checker, 'Saad');
  assert.deepEqual(again, list);
});

test('record refuses a half-formed checklist and leaves the list unchanged', () => {
  const list = recordVersionUpgradeChecklist([], CHECK_A);
  const next = recordVersionUpgradeChecklist(list, { ...CHECK_B, date: 'bad-date' });
  assert.equal(next, list);
  assert.equal(normalizeVersionUpgradeChecklistList('not a list').length, 0);
});

test('find by version pair, case-insensitive', () => {
  const list = [CHECK_A, CHECK_B, CHECK_C];
  assert.equal(versionUpgradeChecklistForVersions(list, '1.10.0', '1.11.0')?.id, 'VUC-1');
  assert.equal(versionUpgradeChecklistForVersions(list, ' 1.9.0 ', '1.10.0')?.id, 'VUC-2');
  assert.equal(versionUpgradeChecklistForVersions(list, '1.11.0', '1.10.0'), null);
  assert.equal(versionUpgradeChecklistForVersions(list, '', '1.11.0'), null);
});

test('tick marks only that step done on only that checklist', () => {
  const list = [CHECK_A, CHECK_B];
  const next = tickVersionUpgradeChecklistStep(list, 'VUC-1', 1);
  assert.notEqual(next, list);
  assert.equal(next[0].steps[1].status, 'done');
  assert.equal(next[0].steps[0].status, 'pending');
  assert.equal(next[0].steps[2].status, 'pending');
  assert.equal(next[1].steps[0].status, 'done');
  assert.equal(list[0].steps[1], 'Install the new version');
});

test('tick refuses a missing checklist, a bad step index, or an out-of-range index', () => {
  const list = [CHECK_A];
  assert.equal(tickVersionUpgradeChecklistStep(list, 'VUC-9', 0), list);
  assert.equal(tickVersionUpgradeChecklistStep(list, 'VUC-1', -1), list);
  assert.equal(tickVersionUpgradeChecklistStep(list, 'VUC-1', 3), list);
  assert.equal(tickVersionUpgradeChecklistStep(list, 'VUC-1', 1.5), list);
  assert.equal(tickVersionUpgradeChecklistStep(list, 'VUC-1', '1'), list);
});

test('skip marks a step skipped and the step stays flagged', () => {
  const list = [CHECK_A];
  const next = skipVersionUpgradeChecklistStep(list, 'VUC-1', 0);
  assert.equal(next[0].steps[0].status, 'skipped');
  assert.deepEqual(versionUpgradeChecklistSkippedSteps(next[0]), [{ text: 'Back up the shop device', status: 'skipped' }]);
  assert.equal(versionUpgradeChecklistIsComplete(next[0]), false);
  assert.equal(skipVersionUpgradeChecklistStep(list, 'VUC-9', 0), list);
});

test('complete only when every step is done', () => {
  assert.equal(versionUpgradeChecklistIsComplete(CHECK_A), false);
  assert.equal(versionUpgradeChecklistIsComplete(CHECK_B), true);
  assert.equal(versionUpgradeChecklistIsComplete(CHECK_C), false);
  assert.equal(versionUpgradeChecklistIsComplete(null), false);
  const ticked = tickVersionUpgradeChecklistStep(tickVersionUpgradeChecklistStep(tickVersionUpgradeChecklistStep([CHECK_A], 'VUC-1', 0), 'VUC-1', 1), 'VUC-1', 2);
  assert.equal(versionUpgradeChecklistIsComplete(ticked[0]), true);
  assert.deepEqual(versionUpgradeChecklistSkippedSteps(CHECK_C), [{ text: 'Install the new version', status: 'skipped' }]);
  assert.deepEqual(versionUpgradeChecklistSkippedSteps(CHECK_B), []);
});

test('incomplete list is date ordered and excludes complete checklists', () => {
  const open = incompleteVersionUpgradeChecklists([CHECK_C, CHECK_A, CHECK_B]);
  assert.deepEqual(open.map((entry) => entry.id), ['VUC-1', 'VUC-3']);
  assert.deepEqual(incompleteVersionUpgradeChecklists([CHECK_B]), []);
  assert.deepEqual(incompleteVersionUpgradeChecklists([]), []);
});

test('counts reconcile: total equals complete plus incomplete, skipped counted', () => {
  assert.deepEqual(versionUpgradeChecklistCounts([CHECK_A, CHECK_B, CHECK_C]), { total: 3, complete: 1, incomplete: 2, skipped: 1 });
  assert.deepEqual(versionUpgradeChecklistCounts([]), { total: 0, complete: 0, incomplete: 0, skipped: 0 });
});

test('summary text for empty, one, and several checklists', () => {
  assert.equal(versionUpgradeChecklistSummaryText([]), 'No version upgrade checklists.');
  assert.equal(versionUpgradeChecklistSummaryText([CHECK_B]), '1 upgrade checklist: 1 complete, 0 incomplete.');
  assert.equal(versionUpgradeChecklistSummaryText([CHECK_A, CHECK_B, CHECK_C]), '3 upgrade checklists: 1 complete, 2 incomplete. 1 skipped step flagged.');
});

test('text renders versions, steps, checker, date, and state', () => {
  assert.equal(
    versionUpgradeChecklistText(CHECK_B),
    '1.9.0 to 1.10.0 — steps: 1. Back up the shop device (done); 2. Install the new version (done); checked by Owner on 2026-10-05; complete',
  );
  assert.ok(versionUpgradeChecklistText(CHECK_A).includes('incomplete'));
  assert.equal(versionUpgradeChecklistText(null), '');
  assert.equal(versionUpgradeChecklistsText([]), 'No version upgrade checklists.');
  assert.ok(versionUpgradeChecklistsText([CHECK_C, CHECK_A]).startsWith('1.10.0 to 1.11.0'));
});

test('HTML escapes user text', () => {
  const nasty = { ...CHECK_A, checker: '<b>Saad</b>', steps: ['Back up <script> the device'] };
  const html = versionUpgradeChecklistHtml(nasty);
  assert.ok(!html.includes('<b>Saad</b>'));
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(versionUpgradeChecklistHtml(null), '');
  assert.equal(versionUpgradeChecklistsHtml([]), '<p>No version upgrade checklists yet.</p>');
  assert.ok(versionUpgradeChecklistsHtml([CHECK_A]).includes('1.10.0 to 1.11.0'));
});

test('incomplete HTML lists only incomplete checklists', () => {
  const html = versionUpgradeChecklistIncompleteHtml([CHECK_A, CHECK_B, CHECK_C]);
  assert.ok(html.includes('1.10.0 to 1.11.0'));
  assert.ok(html.includes('1.11.0 to 1.12.0'));
  assert.ok(!html.includes('1.9.0 to 1.10.0'));
  assert.equal(versionUpgradeChecklistIncompleteHtml([CHECK_B]), '<p>No incomplete upgrade checklists.</p>');
});

test('CSV header and rows quote fields with commas', () => {
  const csv = versionUpgradeChecklistCsv([CHECK_A]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,fromVersion,toVersion,steps,checker,date');
  assert.ok(lines[1].startsWith('VUC-1,1.10.0,1.11.0,'));
  assert.ok(lines[1].includes('1. Back up the shop device (pending); 2. Install the new version (pending); 3. Verify the ledger opens (pending)'));
  const commaCsv = versionUpgradeChecklistCsv([{ ...CHECK_A, steps: ['Back up, then install', 'Verify the ledger opens'] }]);
  assert.ok(commaCsv.split('\n')[1].includes('"1. Back up, then install (pending); 2. Verify the ledger opens (pending)"'));
  assert.equal(versionUpgradeChecklistCsv([]).split('\n').length, 1);
  assert.equal(versionUpgradeChecklistFilename(), 'version-upgrade-checklists.csv');
});

test('inputs are never mutated', () => {
  const frozen = deepFreeze([CHECK_A, CHECK_B, CHECK_C]);
  const before = JSON.stringify(frozen);
  recordVersionUpgradeChecklist(frozen, CHECK_A);
  tickVersionUpgradeChecklistStep(frozen, 'VUC-1', 0);
  skipVersionUpgradeChecklistStep(frozen, 'VUC-1', 0);
  incompleteVersionUpgradeChecklists(frozen);
  versionUpgradeChecklistCounts(frozen);
  versionUpgradeChecklistsText(frozen);
  versionUpgradeChecklistsHtml(frozen);
  versionUpgradeChecklistCsv(frozen);
  assert.equal(JSON.stringify(frozen), before);
});

test('module is pure: no page, storage, clock, network, or version install', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(versionUpgradeChecklistModule);
  assert.ok(!exported.some((name) => /install|rollback|apply/i.test(name)));
});

test('fence: module never names the version and release notes log file', () => {
  assert.ok(!moduleSrc.includes('version-log'));
  assert.ok(!moduleSrc.includes('release-assurance'));
});

test('wiring: app.js imports the module, renders it, and stores it under the vuc key', () => {
  assert.ok(appJs.includes("from './version-upgrade-checklist.js'"));
  assert.ok(appJs.includes('renderVersionUpgradeChecklists()'));
  assert.ok(appJs.includes('shahdara_vuc_checklists_v1'));
  assert.ok(appJs.includes('versionUpgradeChecklistSummaryText'));
  assert.ok(!/renderVersionUpgradeChecklists\(\)\s*;\s*renderVersionUpgradeChecklists\(\)/.test(appJs));
});

test('wiring: index.html carries the vuc panel after the Plan 341 panel', () => {
  assert.ok(indexHtml.includes('id="vucHeading"'));
  assert.ok(indexHtml.includes('id="vucBody"'));
  assert.ok(indexHtml.includes('id="vucSummary"'));
  assert.ok(indexHtml.includes('id="vucSaveBtn"'));
  assert.ok(indexHtml.includes('id="vucTickBtn"'));
  assert.ok(indexHtml.indexOf('id="tdsHeading"') < indexHtml.indexOf('id="vucHeading"'));
});
