import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as deviceCompatibilityNoteModule from '../device-compatibility-note.js';
import {
  validDeviceCompatibilityNoteDay,
  foldDeviceCompatibilityNoteResult,
  normalizeDeviceCompatibilityNote,
  normalizeDeviceCompatibilityNoteList,
  recordDeviceCompatibilityNote,
  deviceCompatibilityNoteForPair,
  deviceCompatibilityNotesForDevice,
  deviceCompatibilityDevices,
  deviceCompatibilityPairText,
  deviceCompatibilityNoteCounts,
  deviceCompatibilityNoteSummaryText,
  deviceCompatibilityNoteText,
  deviceCompatibilityNotesText,
  deviceCompatibilityNoteHtml,
  deviceCompatibilityNotesHtml,
  deviceCompatibilityNotesForDeviceHtml,
  deviceCompatibilityNoteCsv,
  deviceCompatibilityNoteFilename,
} from '../device-compatibility-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'device-compatibility-note.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const NOTE_A = { id: 'DCN-1', device: 'Field Phone A', appVersion: '1.11.0', result: 'works well', issueNote: '', dateTested: '2026-11-05' };
const NOTE_B = { id: 'DCN-2', device: 'Field Phone A', appVersion: '1.10.0', result: 'works with issues', issueNote: 'Receipt screen scrolls slowly', dateTested: '2026-10-05' };
const NOTE_C = { id: 'DCN-3', device: 'Shop Tablet B', appVersion: '1.11.0', result: 'does not work', issueNote: 'App closes on the ledger screen', dateTested: '2026-11-06' };
const NOTE_D = { id: 'DCN-4', device: 'Field Phone A', appVersion: '1.9.0', result: 'works well', issueNote: '', dateTested: '2026-09-01' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validDeviceCompatibilityNoteDay('2026-11-05'), true);
  assert.equal(validDeviceCompatibilityNoteDay('2028-02-29'), true);
  assert.equal(validDeviceCompatibilityNoteDay('2026-02-29'), false);
  assert.equal(validDeviceCompatibilityNoteDay('2026-04-31'), false);
  assert.equal(validDeviceCompatibilityNoteDay('2026-13-01'), false);
  assert.equal(validDeviceCompatibilityNoteDay('2026-00-10'), false);
  assert.equal(validDeviceCompatibilityNoteDay('2026-11-5'), false);
  assert.equal(validDeviceCompatibilityNoteDay('05-11-2026'), false);
  assert.equal(validDeviceCompatibilityNoteDay(''), false);
  assert.equal(validDeviceCompatibilityNoteDay(null), false);
  assert.equal(validDeviceCompatibilityNoteDay(20261105), false);
});

test('result folds works well, works with issues, and does not work, unknown reads null', () => {
  assert.equal(foldDeviceCompatibilityNoteResult('works well'), 'works well');
  assert.equal(foldDeviceCompatibilityNoteResult('Well'), 'works well');
  assert.equal(foldDeviceCompatibilityNoteResult('works with issues'), 'works with issues');
  assert.equal(foldDeviceCompatibilityNoteResult('Issues'), 'works with issues');
  assert.equal(foldDeviceCompatibilityNoteResult('with issues'), 'works with issues');
  assert.equal(foldDeviceCompatibilityNoteResult('does not work'), 'does not work');
  assert.equal(foldDeviceCompatibilityNoteResult('Not working'), 'does not work');
  assert.equal(foldDeviceCompatibilityNoteResult('broken'), 'does not work');
  assert.equal(foldDeviceCompatibilityNoteResult('whatever'), null);
  assert.equal(foldDeviceCompatibilityNoteResult(''), null);
  assert.equal(foldDeviceCompatibilityNoteResult(null), null);
});

test('a note normalizes with trimmed fields and drops unknown fields', () => {
  assert.deepEqual(normalizeDeviceCompatibilityNote({ ...NOTE_B, device: ' Field Phone A ', issueNote: ' Receipt screen scrolls slowly ', customer: 'Someone', bill: 100 }), {
    id: 'DCN-2',
    device: 'Field Phone A',
    appVersion: '1.10.0',
    result: 'works with issues',
    issueNote: 'Receipt screen scrolls slowly',
    dateTested: '2026-10-05',
  });
  assert.deepEqual(normalizeDeviceCompatibilityNote({ ...NOTE_A, result: 'WELL' }), { ...NOTE_A });
  assert.equal(normalizeDeviceCompatibilityNote(null), null);
  assert.equal(normalizeDeviceCompatibilityNote('Field Phone A'), null);
});

test('half-formed notes are refused', () => {
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, id: '' }), null);
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, device: '   ' }), null);
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, appVersion: '' }), null);
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, result: 'fine' }), null);
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, dateTested: '2026-02-29' }), null);
  assert.equal(normalizeDeviceCompatibilityNote({ ...NOTE_A, dateTested: '' }), null);
});

test('record refuses a duplicate id', () => {
  const list = [NOTE_A];
  assert.equal(recordDeviceCompatibilityNote(list, { ...NOTE_B, id: 'DCN-1' }), list);
  assert.equal(recordDeviceCompatibilityNote(list, NOTE_A), list);
});

test('record refuses a second note for the same device and version pair', () => {
  const list = [NOTE_A];
  assert.equal(recordDeviceCompatibilityNote(list, { id: 'DCN-9', device: 'field phone a', appVersion: '1.11.0', result: 'does not work', issueNote: '', dateTested: '2026-11-06' }), list);
  const next = recordDeviceCompatibilityNote(list, NOTE_B);
  assert.equal(next.length, 2);
  assert.notEqual(next, list);
});

test('record accepts a different version for the same device', () => {
  const list = recordDeviceCompatibilityNote([NOTE_A], NOTE_D);
  assert.equal(list.length, 2);
  assert.deepEqual(list[1], NOTE_D);
});

test('lookup by pair finds the note, case-insensitive, missing pair returns null', () => {
  const list = [NOTE_A, NOTE_B, NOTE_C];
  assert.deepEqual(deviceCompatibilityNoteForPair(list, 'FIELD PHONE A', '1.10.0'), NOTE_B);
  assert.deepEqual(deviceCompatibilityNoteForPair(list, 'Shop Tablet B', '1.11.0'), NOTE_C);
  assert.equal(deviceCompatibilityNoteForPair(list, 'Field Phone A', '1.12.0'), null);
  assert.equal(deviceCompatibilityNoteForPair(list, 'Unknown Phone', '1.11.0'), null);
  assert.equal(deviceCompatibilityNoteForPair(list, '', '1.11.0'), null);
  assert.equal(deviceCompatibilityNoteForPair(list, 'Field Phone A', ''), null);
});

test('lookup by device lists tested versions in version order', () => {
  const list = [NOTE_D, NOTE_B, NOTE_A, NOTE_C];
  assert.deepEqual(deviceCompatibilityNotesForDevice(list, 'field phone a'), [NOTE_B, NOTE_A, NOTE_D]);
  assert.deepEqual(deviceCompatibilityNotesForDevice(list, 'Shop Tablet B'), [NOTE_C]);
  assert.deepEqual(deviceCompatibilityNotesForDevice(list, 'Unknown Phone'), []);
  assert.deepEqual(deviceCompatibilityNotesForDevice(list, ''), []);
});

test('device list collapses case and sorts A-Z with first spelling kept', () => {
  const list = [NOTE_C, NOTE_A, { ...NOTE_B, device: 'field phone a' }];
  assert.deepEqual(deviceCompatibilityDevices(list), ['Field Phone A', 'Shop Tablet B']);
  assert.deepEqual(deviceCompatibilityDevices([]), []);
  assert.deepEqual(deviceCompatibilityDevices(null), []);
});

test('an untested pair says so plainly', () => {
  assert.equal(deviceCompatibilityPairText([NOTE_A], 'Field Phone A', '1.12.0'), 'Not tested: Field Phone A with app version 1.12.0 has no compatibility note.');
  assert.equal(deviceCompatibilityPairText([], 'Field Phone A', '1.11.0'), 'Not tested: Field Phone A with app version 1.11.0 has no compatibility note.');
  assert.equal(deviceCompatibilityPairText([NOTE_A], '', '1.11.0'), 'Give a device and an app version to look up.');
  assert.equal(deviceCompatibilityPairText([NOTE_A], 'Field Phone A', ''), 'Give a device and an app version to look up.');
});

test('pair text shows the result and issue note when tested', () => {
  assert.equal(deviceCompatibilityPairText([NOTE_A, NOTE_B], 'Field Phone A', '1.11.0'), 'Field Phone A with app version 1.11.0: works well (tested 2026-11-05)');
  assert.equal(deviceCompatibilityPairText([NOTE_A, NOTE_B], 'Field Phone A', '1.10.0'), 'Field Phone A with app version 1.10.0: works with issues — Receipt screen scrolls slowly (tested 2026-10-05)');
});

test('counts reconcile to the notes listed', () => {
  assert.deepEqual(deviceCompatibilityNoteCounts([NOTE_A, NOTE_B, NOTE_C, NOTE_D]), { total: 4, worksWell: 2, worksWithIssues: 1, doesNotWork: 1 });
  assert.deepEqual(deviceCompatibilityNoteCounts([]), { total: 0, worksWell: 0, worksWithIssues: 0, doesNotWork: 0 });
  const counts = deviceCompatibilityNoteCounts([NOTE_A, NOTE_B, NOTE_C]);
  assert.equal(counts.worksWell + counts.worksWithIssues + counts.doesNotWork, counts.total);
});

test('summary text names the counts', () => {
  assert.equal(deviceCompatibilityNoteSummaryText([]), 'No device compatibility notes.');
  assert.equal(deviceCompatibilityNoteSummaryText([NOTE_A]), '1 compatibility note: 1 work well, 0 work with issues, 0 do not work.');
  assert.equal(deviceCompatibilityNoteSummaryText([NOTE_A, NOTE_B, NOTE_C]), '3 compatibility notes: 1 work well, 1 work with issues, 1 do not work.');
});

test('plain text for one note and for the list', () => {
  assert.equal(deviceCompatibilityNoteText(NOTE_B), 'Field Phone A with app version 1.10.0 — works with issues — Receipt screen scrolls slowly; tested 2026-10-05');
  assert.equal(deviceCompatibilityNoteText(NOTE_A), 'Field Phone A with app version 1.11.0 — works well; tested 2026-11-05');
  assert.equal(deviceCompatibilityNoteText(null), '');
  assert.equal(deviceCompatibilityNotesText([]), 'No device compatibility notes.');
  assert.equal(
    deviceCompatibilityNotesText([NOTE_C, NOTE_A]),
    'Field Phone A with app version 1.11.0 — works well; tested 2026-11-05\nShop Tablet B with app version 1.11.0 — does not work — App closes on the ledger screen; tested 2026-11-06',
  );
});

test('HTML escapes user text while plain text keeps it verbatim', () => {
  const tricky = { id: 'DCN-9', device: '<script>alert(1)</script>', appVersion: '1.11.0', result: 'works with issues', issueNote: 'a "quoted" note', dateTested: '2026-11-06' };
  const html = deviceCompatibilityNoteHtml(tricky);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&quot;quoted&quot;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(deviceCompatibilityNoteText(tricky).includes('<script>alert(1)</script>'));
  assert.equal(deviceCompatibilityNoteHtml(null), '');
  assert.equal(deviceCompatibilityNotesHtml([]), '<p>No device compatibility notes yet.</p>');
  assert.ok(deviceCompatibilityNotesHtml([NOTE_A]).includes('Field Phone A with app version 1.11.0'));
});

test('per-device HTML shows notes or a plain not-tested line', () => {
  const html = deviceCompatibilityNotesForDeviceHtml([NOTE_A, NOTE_B], 'Field Phone A');
  assert.ok(html.includes('1.10.0'));
  assert.ok(html.includes('1.11.0'));
  assert.equal(deviceCompatibilityNotesForDeviceHtml([NOTE_A], 'Unknown Phone'), '<p>Not tested: Unknown Phone has no compatibility notes.</p>');
  assert.equal(deviceCompatibilityNotesForDeviceHtml([NOTE_A], ''), '<p>Give a device to look up.</p>');
});

test('CSV header and rows quote fields with commas', () => {
  const csv = deviceCompatibilityNoteCsv([NOTE_A]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,device,appVersion,result,issueNote,dateTested');
  assert.equal(lines[1], 'DCN-1,Field Phone A,1.11.0,works well,,2026-11-05');
  const commaCsv = deviceCompatibilityNoteCsv([{ ...NOTE_B, issueNote: 'Scrolls slowly, then freezes' }]);
  assert.ok(commaCsv.split('\n')[1].includes('"Scrolls slowly, then freezes"'));
  assert.equal(deviceCompatibilityNoteCsv([]).split('\n').length, 1);
  assert.equal(deviceCompatibilityNoteFilename(), 'device-compatibility-notes.csv');
});

test('recording a note changes only the note list', () => {
  const before = [NOTE_A];
  const next = recordDeviceCompatibilityNote(before, NOTE_B);
  assert.equal(before.length, 1);
  assert.equal(next.length, 2);
  assert.notEqual(next, before);
});

test('inputs are never mutated', () => {
  const frozen = deepFreeze([NOTE_A, NOTE_B, NOTE_C]);
  const before = JSON.stringify(frozen);
  recordDeviceCompatibilityNote(frozen, NOTE_D);
  deviceCompatibilityNoteForPair(frozen, 'Field Phone A', '1.10.0');
  deviceCompatibilityNotesForDevice(frozen, 'Field Phone A');
  deviceCompatibilityDevices(frozen);
  deviceCompatibilityPairText(frozen, 'Field Phone A', '1.10.0');
  deviceCompatibilityNoteCounts(frozen);
  deviceCompatibilityNotesText(frozen);
  deviceCompatibilityNotesHtml(frozen);
  deviceCompatibilityNoteCsv(frozen);
  assert.equal(JSON.stringify(frozen), before);
});

test('module is pure: no page, storage, clock, network, or behaviour change', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(deviceCompatibilityNoteModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change/i.test(name)));
});

test('fence: module never names the existing device files', () => {
  assert.ok(!moduleSrc.includes('business-device'));
  assert.ok(!moduleSrc.includes('device-backup-schedule'));
});

test('wiring: app.js imports the module, renders it, and stores it under the dcn key', () => {
  assert.ok(appJs.includes("from './device-compatibility-note.js'"));
  assert.ok(appJs.includes('renderDeviceCompatibilityNotes()'));
  assert.ok(appJs.includes('shahdara_dcn_notes_v1'));
  assert.ok(appJs.includes('deviceCompatibilityNoteSummaryText'));
  assert.ok(!/renderDeviceCompatibilityNotes\(\)\s*;\s*renderDeviceCompatibilityNotes\(\)/.test(appJs));
});

test('wiring: index.html carries the dcn panel after the Plan 342 panel', () => {
  assert.ok(indexHtml.includes('id="dcnHeading"'));
  assert.ok(indexHtml.includes('id="dcnBody"'));
  assert.ok(indexHtml.includes('id="dcnSummary"'));
  assert.ok(indexHtml.includes('id="dcnSaveBtn"'));
  assert.ok(indexHtml.includes('id="dcnLookupBtn"'));
  assert.ok(indexHtml.indexOf('id="vucHeading"') < indexHtml.indexOf('id="dcnHeading"'));
});
