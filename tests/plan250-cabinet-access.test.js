// Plan 250 — Field cabinet key access note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validCabinetAccessDate,
  normalizeCabinetAccessList,
  recordCabinetAccess,
  removeCabinetAccess,
  findCabinetAccess,
  annotateCabinetAccess,
  cabinetAccessSorted,
  cabinetAccessByCabinet,
  cabinetAccessByDate,
  cabinetAccessCabinets,
  unconfirmedCabinetAccess,
  cabinetAccessSummaryText,
  cabinetAccessText,
  cabinetAccessHtml,
  cabinetAccessCsv,
  cabinetAccessFilename,
} from '../cabinet-access.js';

const first = {
  id: 'CA-1',
  cabinet: 'CAB-1',
  date: '2026-11-05',
  openedBy: 'Saad',
  reason: 'Fibre check after a fault report.',
  lockedAgain: true,
};

const second = {
  id: 'CA-2',
  cabinet: 'CAB-2',
  date: '2026-11-04',
  openedBy: 'Saad',
  reason: 'New customer connection.',
  lockedAgain: false,
};

const third = {
  id: 'CA-3',
  cabinet: 'cab-1',
  date: '2026-11-06',
  openedBy: 'Helper',
  reason: 'Routine inspection.',
  lockedAgain: 'yes',
};

test('half-formed cabinet access notes are refused', () => {
  assert.equal(recordCabinetAccess([], { ...first, id: '' }), null);
  assert.equal(recordCabinetAccess([], { ...first, cabinet: '  ' }), null);
  assert.equal(recordCabinetAccess([], { ...first, openedBy: '' }), null);
  assert.equal(recordCabinetAccess([], { ...first, reason: '' }), null);
  assert.equal(recordCabinetAccess([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordCabinetAccess([], { ...first, date: '2026-13-01' }), null);
  assert.equal(recordCabinetAccess([], { ...first, date: '05-11-2026' }), null);
});

test('strict dates accept leap-day years and reject the rest', () => {
  assert.equal(validCabinetAccessDate('2024-02-29'), true);
  assert.equal(validCabinetAccessDate('2025-02-29'), false);
  assert.equal(validCabinetAccessDate('2026-04-31'), false);
  assert.equal(validCabinetAccessDate('2026-11-05'), true);
  assert.equal(validCabinetAccessDate('2026-11-5'), false);
  assert.equal(validCabinetAccessDate(20261105), false);
  assert.equal(validCabinetAccessDate(''), false);
});

test('locked again is yes only when it is said plainly', () => {
  assert.equal(recordCabinetAccess([], first)[0].lockedAgain, true);
  assert.equal(recordCabinetAccess([], second)[0].lockedAgain, false);
  assert.equal(recordCabinetAccess([], third)[0].lockedAgain, true);
  assert.equal(
    recordCabinetAccess([], { ...first, lockedAgain: 'maybe' })[0].lockedAgain,
    false,
  );
  assert.equal(
    recordCabinetAccess([], { ...first, lockedAgain: 'no' })[0].lockedAgain,
    false,
  );
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'extra', cabinetCode: 7 };
  const snapshot = JSON.stringify(input);
  const list = recordCabinetAccess([], input);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.equal('cabinetCode' in list[0], false);
  assert.deepEqual(list[0].annotations, []);
  assert.equal(JSON.stringify(input), snapshot);
});

test('duplicate ids are never rewritten', () => {
  const list = recordCabinetAccess([first], { ...second, id: 'CA-1' });
  assert.equal(list.length, 1);
  assert.equal(list[0].cabinet, 'CAB-1');
});

test('the same cabinet may be opened many times, one note per opening', () => {
  const list = recordCabinetAccess([first], third);
  assert.equal(list.length, 2);
  assert.equal(list[1].cabinet, 'cab-1');
  assert.equal(list[1].openedBy, 'Helper');
});

test('find and remove work by id', () => {
  const list = [first, second, third];
  assert.equal(findCabinetAccess(list, 'CA-2').cabinet, 'CAB-2');
  assert.equal(findCabinetAccess(list, 'CA-9'), null);
  const kept = removeCabinetAccess(list, 'CA-2');
  assert.equal(kept.length, 2);
  assert.equal(kept.some((item) => item.id === 'CA-2'), false);
  assert.deepEqual(
    removeCabinetAccess(list, '  CA-1 ').map((item) => item.id),
    ['CA-2', 'CA-3'],
  );
});

test('openings sort by date, then cabinet, then id', () => {
  const sorted = cabinetAccessSorted([third, first, second]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['CA-2', 'CA-1', 'CA-3'],
  );
});

test('openings list by cabinet, case-insensitively', () => {
  const list = [first, second, third];
  assert.deepEqual(
    cabinetAccessByCabinet(list, 'CAB-1').map((item) => item.id),
    ['CA-1', 'CA-3'],
  );
  assert.deepEqual(
    cabinetAccessByCabinet(list, 'cab-2').map((item) => item.id),
    ['CA-2'],
  );
  assert.deepEqual(cabinetAccessByCabinet(list, 'CAB-9'), []);
});

test('openings list by exact date', () => {
  const list = [first, second, third];
  assert.deepEqual(
    cabinetAccessByDate(list, '2026-11-05').map((item) => item.id),
    ['CA-1'],
  );
  assert.deepEqual(cabinetAccessByDate(list, '2026-11-07'), []);
});

test('cabinet list keeps the first spelling of each cabinet', () => {
  assert.deepEqual(cabinetAccessCabinets([first, second, third]), [
    'CAB-1',
    'CAB-2',
  ]);
  assert.deepEqual(cabinetAccessCabinets([]), []);
});

test('openings without a locked-again confirmation are flagged', () => {
  const flagged = unconfirmedCabinetAccess([first, second, third]);
  assert.deepEqual(
    flagged.map((item) => item.id),
    ['CA-2'],
  );
  assert.deepEqual(unconfirmedCabinetAccess([first, third]), []);
});

test('an annotation is a dated note, never a rewrite', () => {
  const list = [first];
  const next = annotateCabinetAccess(list, 'CA-1', {
    date: '2026-11-06',
    note: 'Lock checked again the next morning, still shut.',
  });
  assert.notEqual(next, list);
  assert.equal(next[0].cabinet, 'CAB-1');
  assert.equal(next[0].date, '2026-11-05');
  assert.equal(next[0].openedBy, 'Saad');
  assert.equal(next[0].reason, 'Fibre check after a fault report.');
  assert.equal(next[0].lockedAgain, true);
  assert.equal(next[0].annotations.length, 1);
  assert.deepEqual(next[0].annotations[0], {
    date: '2026-11-06',
    note: 'Lock checked again the next morning, still shut.',
  });
  const again = annotateCabinetAccess(next, 'CA-1', {
    date: '2026-11-07',
    note: 'Second check, all fine.',
  });
  assert.equal(again[0].annotations.length, 2);
});

test('bad annotations are refused and leave the list untouched', () => {
  const list = [first];
  assert.equal(
    annotateCabinetAccess(list, 'CA-1', { date: '2026-02-30', note: 'x' }),
    list,
  );
  assert.equal(
    annotateCabinetAccess(list, 'CA-1', { date: '2026-11-06', note: '' }),
    list,
  );
  assert.equal(
    annotateCabinetAccess(list, 'CA-9', { date: '2026-11-06', note: 'x' }),
    list,
  );
  assert.equal(annotateCabinetAccess(list, 'CA-1', null), list);
  assert.equal(
    annotateCabinetAccess(list, 'CA-1', { note: 'x' }),
    list,
  );
});

test('summary text counts confirmed and unconfirmed openings', () => {
  assert.equal(
    cabinetAccessSummaryText([first, second, third]),
    '3 openings: 2 confirmed locked again, 1 not confirmed. 1 opening without a locked-again confirmation.',
  );
  assert.equal(
    cabinetAccessSummaryText([first]),
    '1 opening: 1 confirmed locked again, 0 not confirmed. Every opening was confirmed locked again.',
  );
  assert.equal(
    cabinetAccessSummaryText([]),
    '0 openings: 0 confirmed locked again, 0 not confirmed. Every opening was confirmed locked again.',
  );
});

test('note text names the cabinet, opener, date, reason, and lock state', () => {
  assert.equal(
    cabinetAccessText(first),
    'Cabinet CAB-1 opened by Saad on 2026-11-05 for Fibre check after a fault report. Locked again: yes. No dated annotations yet.',
  );
  assert.equal(
    cabinetAccessText(second),
    'Cabinet CAB-2 opened by Saad on 2026-11-04 for New customer connection. Locked again: no. No dated annotations yet.',
  );
  assert.equal(cabinetAccessText({ ...first, date: '2026-02-30' }), '');
});

test('HTML escapes opener and reason text', () => {
  const html = cabinetAccessHtml([
    { ...first, openedBy: 'A & B <Team>', reason: 'Said "yes" <today>.' },
  ]);
  assert.equal(html.includes('A &amp; B &lt;Team&gt;'), true);
  assert.equal(html.includes('Said &quot;yes&quot; &lt;today&gt;.'), true);
  assert.equal(html.includes('<Team>'), false);
  assert.equal(
    cabinetAccessHtml([]),
    '<p>No cabinet access notes recorded.</p>',
  );
});

test('CSV export uses the cabinet-access filename', () => {
  const csv = cabinetAccessCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    '"id","cabinet","date","opened by","reason","locked again","dated annotations"',
  );
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"CAB-2"'), true);
  assert.equal(lines[1].includes('"no"'), true);
  assert.equal(lines[2].includes('"CAB-1"'), true);
  assert.equal(lines[2].includes('"yes"'), true);
  assert.equal(cabinetAccessFilename(), 'cabinet-access-notes.csv');
});

test('list normalisation drops bad rows and duplicate ids', () => {
  const dirty = [
    first,
    { ...second, date: '2026-02-30' },
    { ...first, id: 'CA-1' },
    null,
    'nope',
  ];
  const clean = normalizeCabinetAccessList(dirty);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'CA-1');
  assert.deepEqual(normalizeCabinetAccessList('nope'), []);
  assert.deepEqual(normalizeCabinetAccessList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(
    new URL('../cabinet-access.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('document.'), false);
});

test('neighbour-module fence: shop keys register and inspection round are untouched', () => {
  const source = readFileSync(
    new URL('../cabinet-access.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('access-register'), false);
  assert.equal(source.includes('pole-inspection'), false);
  assert.equal(existsSync(new URL('../access-register.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../pole-inspection.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'ckList',
    'ckSummary',
    'ckCabinet',
    'ckDate',
    'ckOpenedBy',
    'ckReason',
    'ckLockedAgain',
    'ckRecordBtn',
    'ckAnnotateId',
    'ckAnnotateDate',
    'ckAnnotateNote',
    'ckAnnotateBtn',
    'ckRemoveId',
    'ckRemoveBtn',
    'ckFilterCabinet',
    'ckCabinetBtn',
    'ckCabinetBody',
    'ckDateInput',
    'ckDateBtn',
    'ckDateBody',
    'ckFlaggedBody',
    'ckExportBtn',
  ]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wires the cabinet access panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './cabinet-access.js'"), true);
  assert.equal(source.includes('renderCabinetAccess()'), true);
  assert.equal(source.includes('CABINET_ACCESS_KEY'), true);
  assert.equal(source.includes('cabinetAccessSorted'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
