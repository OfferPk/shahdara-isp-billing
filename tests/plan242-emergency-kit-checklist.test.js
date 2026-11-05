// Plan 242 — Emergency fault kit checklist per vehicle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validEmergencyKitChecklistDate,
  normalizeEmergencyKitChecklistList,
  recordEmergencyKitChecklist,
  removeEmergencyKitChecklist,
  findEmergencyKitChecklist,
  addEmergencyKitChecklistAnnotation,
  emergencyKitChecklistSorted,
  emergencyKitChecklistsForVehicle,
  latestEmergencyKitChecklistForVehicle,
  emergencyKitChecklistVehicles,
  emergencyKitChecklistMissingItems,
  emergencyKitChecklistMissingCritical,
  emergencyKitChecklistHasMissingCritical,
  emergencyKitChecklistVehiclesWithMissingCritical,
  emergencyKitChecklistSummaryText,
  emergencyKitChecklistText,
  emergencyKitChecklistHtml,
  emergencyKitChecklistCsv,
  emergencyKitChecklistFilename,
} from '../emergency-kit-checklist.js';

const first = {
  id: 'EK-1',
  vehicle: 'Bike-01',
  expected: ['Spare ONU', 'Drop cable', 'Splicer'],
  present: ['Spare ONU', 'Drop cable'],
  critical: ['Splicer'],
  date: '2026-11-05',
  checker: 'Saad',
};

const second = {
  id: 'EK-2',
  vehicle: 'bike-01',
  expected: ['Spare ONU', 'Drop cable', 'Splicer'],
  present: ['Spare ONU', 'Drop cable', 'Splicer'],
  critical: ['Splicer'],
  date: '2026-11-04',
  checker: 'Saad',
};

test('half-formed checklists are refused', () => {
  assert.equal(recordEmergencyKitChecklist([], { ...first, id: '' }), null);
  assert.equal(recordEmergencyKitChecklist([], { ...first, vehicle: '' }), null);
  assert.equal(recordEmergencyKitChecklist([], { ...first, expected: [] }), null);
  assert.equal(recordEmergencyKitChecklist([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordEmergencyKitChecklist([], { ...first, checker: '  ' }), null);
});

test('strict dates use a 12-entry days-in-month table', () => {
  assert.equal(validEmergencyKitChecklistDate('2026-11-05'), true);
  assert.equal(validEmergencyKitChecklistDate('2024-02-29'), true);
  assert.equal(validEmergencyKitChecklistDate('2026-02-29'), false);
  assert.equal(validEmergencyKitChecklistDate('2026-04-31'), false);
  assert.equal(validEmergencyKitChecklistDate('2026-13-01'), false);
  assert.equal(validEmergencyKitChecklistDate('05-11-2026'), false);
  assert.equal(validEmergencyKitChecklistDate(20261105), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const entry = {
    ...first,
    billId: 'B-1',
    customer: 'Someone',
    expected: ['Spare ONU', ' spare onu ', 'Splicer', ''],
    present: ['Spare ONU', 'Unknown tool'],
    critical: ['Splicer', 'Not expected'],
  };
  const before = JSON.stringify(entry);
  const recorded = recordEmergencyKitChecklist([], entry);
  assert.equal(JSON.stringify(entry), before);
  assert.deepEqual(Object.keys(recorded[0]).sort(), [
    'annotations',
    'checker',
    'critical',
    'date',
    'expected',
    'id',
    'present',
    'vehicle',
  ]);
  assert.deepEqual(recorded[0].expected, ['Spare ONU', 'Splicer']);
  assert.deepEqual(recorded[0].present, ['Spare ONU']);
  assert.deepEqual(recorded[0].critical, ['Splicer']);
});

test('a duplicate id is never rewritten', () => {
  const base = recordEmergencyKitChecklist([], first);
  const again = recordEmergencyKitChecklist(base, { ...first, checker: 'Other' });
  assert.equal(again.length, 1);
  assert.equal(again[0].checker, 'Saad');
});

test('find and remove work on the id', () => {
  const base = recordEmergencyKitChecklist(
    recordEmergencyKitChecklist([], first),
    second,
  );
  assert.equal(findEmergencyKitChecklist(base, 'EK-2').vehicle, 'bike-01');
  assert.equal(findEmergencyKitChecklist(base, 'EK-9'), null);
  const removed = removeEmergencyKitChecklist(base, 'EK-1');
  assert.deepEqual(removed.map((item) => item.id), ['EK-2']);
});

test('sorting is date descending, then vehicle, then id', () => {
  const rows = emergencyKitChecklistSorted([second, first]);
  assert.deepEqual(rows.map((item) => item.id), ['EK-1', 'EK-2']);
});

test('per-vehicle listing is case-insensitive and latest is the newest date', () => {
  const base = recordEmergencyKitChecklist(
    recordEmergencyKitChecklist([], first),
    second,
  );
  assert.deepEqual(
    emergencyKitChecklistsForVehicle(base, 'BIKE-01').map((item) => item.id),
    ['EK-1', 'EK-2'],
  );
  assert.equal(latestEmergencyKitChecklistForVehicle(base, 'Bike-01').id, 'EK-1');
  assert.equal(latestEmergencyKitChecklistForVehicle(base, 'Van-9'), null);
  assert.deepEqual(emergencyKitChecklistVehicles(base), ['Bike-01']);
});

test('missing items and missing critical items are derived from expected', () => {
  assert.deepEqual(emergencyKitChecklistMissingItems(first), ['Splicer']);
  assert.deepEqual(emergencyKitChecklistMissingCritical(first), ['Splicer']);
  assert.equal(emergencyKitChecklistHasMissingCritical(first), true);
  assert.deepEqual(emergencyKitChecklistMissingItems(second), []);
  assert.equal(emergencyKitChecklistHasMissingCritical(second), false);
});

test('vehicles with missing critical kit are flagged on their latest checklist', () => {
  const base = recordEmergencyKitChecklist(
    recordEmergencyKitChecklist([], first),
    second,
  );
  assert.deepEqual(emergencyKitChecklistVehiclesWithMissingCritical(base), [
    'Bike-01',
  ]);
  const fixed = {
    ...first,
    id: 'EK-3',
    date: '2026-11-06',
    present: ['Spare ONU', 'Drop cable', 'Splicer'],
  };
  const withFix = recordEmergencyKitChecklist(base, fixed);
  assert.deepEqual(emergencyKitChecklistVehiclesWithMissingCritical(withFix), []);
});

test('an annotation never rewrites a checklist', () => {
  const base = recordEmergencyKitChecklist([], first);
  const annotated = addEmergencyKitChecklistAnnotation(base, 'EK-1', {
    date: '2026-11-06',
    note: 'Splicer borrowed from shop stock.',
  });
  assert.equal(annotated[0].vehicle, 'Bike-01');
  assert.deepEqual(annotated[0].present, ['Spare ONU', 'Drop cable']);
  assert.deepEqual(annotated[0].annotations, [
    { date: '2026-11-06', note: 'Splicer borrowed from shop stock.' },
  ]);
  const bad = addEmergencyKitChecklistAnnotation(base, 'EK-1', {
    date: '2026-02-30',
    note: 'Bad date.',
  });
  assert.deepEqual(bad[0].annotations, []);
});

test('summary and checklist text show present versus missing side by side', () => {
  const base = recordEmergencyKitChecklist([], first);
  assert.equal(
    emergencyKitChecklistSummaryText(base),
    '1 emergency kit checklist for 1 vehicle. 1 vehicle missing critical kit.',
  );
  assert.equal(
    emergencyKitChecklistText(first),
    'Vehicle Bike-01 — 2026-11-05 — checked by Saad. Present: Spare ONU, Drop cable. Missing: Splicer. Critical missing: Splicer.',
  );
  assert.match(emergencyKitChecklistText(second), /Nothing missing\./);
  assert.match(emergencyKitChecklistText(second), /No critical items missing\./);
  assert.equal(emergencyKitChecklistText(null), '');
});

test('HTML is escaped and CSV exports one row per checklist', () => {
  const tricky = {
    ...first,
    id: 'EK-9',
    vehicle: 'Bike <b>&</b>',
    checker: 'Saad',
  };
  const html = emergencyKitChecklistHtml([tricky]);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /Bike &lt;b&gt;&amp;&lt;\/b&gt;/);
  assert.equal(
    emergencyKitChecklistHtml([]),
    '<p>No emergency kit checklists recorded.</p>',
  );
  const csv = emergencyKitChecklistCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(
    lines[0],
    '"id","vehicle","date","checker","expected","present","missing","missing critical"',
  );
  assert.match(lines[1], /"EK-1","Bike-01"/);
  assert.equal(emergencyKitChecklistFilename(), 'emergency-kit-checklists.csv');
});

test('list normalisation drops bad rows and keeps the first id', () => {
  const rows = normalizeEmergencyKitChecklistList([
    first,
    { ...first, checker: 'Other' },
    { ...first, id: 'EK-2', date: '2026-02-30' },
    null,
  ]);
  assert.deepEqual(rows.map((item) => item.id), ['EK-1']);
  assert.equal(rows[0].checker, 'Saad');
  assert.deepEqual(normalizeEmergencyKitChecklistList('nope'), []);
});

test('purity fence: no storage, clock, or network access', () => {
  const source = readFileSync(
    new URL('../emergency-kit-checklist.js', import.meta.url),
    'utf8',
  );
  for (const banned of ['localStorage', 'sessionStorage', 'new Date(', 'Date.now(', 'fetch(', 'XMLHttpRequest', 'document.']) {
    assert.doesNotMatch(source, new RegExp(banned.replace(/[().]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /import\s/);
});

test('neighbour-module fence: tool kit, kit power, and vehicle fuel are untouched', () => {
  const source = readFileSync(
    new URL('../emergency-kit-checklist.js', import.meta.url),
    'utf8',
  );
  for (const name of ['tool-kit-log', 'kit-power', 'vehicle-fuel']) {
    assert.doesNotMatch(source, new RegExp(name));
  }
  assert.equal(existsSync(new URL('../tool-kit-log.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../kit-power.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../vehicle-fuel.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  for (const id of [
    'ekcHeading',
    'ekcVehicle',
    'ekcExpected',
    'ekcPresent',
    'ekcCritical',
    'ekcDate',
    'ekcChecker',
    'ekcRecordBtn',
    'ekcList',
    'ekcFilterVehicle',
    'ekcFilterBtn',
    'ekcFlagged',
    'ekcAnnotateId',
    'ekcAnnotateDate',
    'ekcAnnotateNote',
    'ekcAnnotateBtn',
    'ekcRemoveId',
    'ekcRemoveBtn',
    'ekcExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the emergency kit checklist panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /emergency-kit-checklist\.js/);
  assert.match(source, /renderEmergencyKitChecklist/);
  assert.match(source, /ekcRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
