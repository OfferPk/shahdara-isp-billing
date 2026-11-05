// Plan 248 — Splitter port occupancy record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validSplitterOccupancyDate,
  normalizeSplitterOccupancyList,
  recordSplitterPort,
  removeSplitterPort,
  findSplitterPort,
  updateSplitterPort,
  splitterOccupancySorted,
  splitterPortsForSplitter,
  splitterOccupancySplitters,
  splitterOccupancyCounts,
  splitterOccupancySummaries,
  fullyOccupiedSplitters,
  splitterOccupancySummaryText,
  splitterOccupancyText,
  splitterOccupancyHtml,
  splitterOccupancyCsv,
  splitterOccupancyFilename,
} from '../splitter-occupancy.js';

const first = {
  id: 'SP-1',
  splitter: 'SPL-Barrian-02',
  segment: 'Barrian Road',
  port: 3,
  status: 'occupied',
  customer: 'Ahmed Raza',
  date: '2026-11-05',
};

const second = {
  id: 'SP-2',
  splitter: 'SPL-Barrian-02',
  segment: 'Barrian Road',
  port: 1,
  status: 'free',
  customer: '',
  date: '2026-11-04',
};

const third = {
  id: 'SP-3',
  splitter: 'spl-barrian-02',
  segment: 'Barrian Road',
  port: 5,
  status: 'occupied',
  customer: 'Fatima Noor',
  date: '2026-11-06',
};

const other = {
  id: 'SP-4',
  splitter: 'SPL-Main-01',
  segment: 'Main Bazaar',
  port: 2,
  status: 'free',
  customer: '',
  date: '2026-11-03',
};

test('half-formed port records are refused', () => {
  assert.equal(recordSplitterPort([], { ...first, id: '' }), null);
  assert.equal(recordSplitterPort([], { ...first, splitter: '  ' }), null);
  assert.equal(recordSplitterPort([], { ...first, segment: '' }), null);
  assert.equal(recordSplitterPort([], { ...first, port: 0 }), null);
  assert.equal(recordSplitterPort([], { ...first, port: -2 }), null);
  assert.equal(recordSplitterPort([], { ...first, port: 1.5 }), null);
  assert.equal(recordSplitterPort([], { ...first, port: 'three' }), null);
  assert.equal(recordSplitterPort([], { ...first, status: 'busy' }), null);
  assert.equal(recordSplitterPort([], { ...first, status: '' }), null);
  assert.equal(recordSplitterPort([], { ...first, customer: '' }), null);
  assert.equal(recordSplitterPort([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordSplitterPort([], { ...first, date: '2026-13-01' }), null);
});

test('strict dates accept leap-day years and reject the rest', () => {
  assert.equal(validSplitterOccupancyDate('2024-02-29'), true);
  assert.equal(validSplitterOccupancyDate('2026-02-29'), false);
  assert.equal(validSplitterOccupancyDate('2026-04-31'), false);
  assert.equal(validSplitterOccupancyDate('2026-11-05'), true);
  assert.equal(validSplitterOccupancyDate('05-11-2026'), false);
  assert.equal(validSplitterOccupancyDate(''), false);
});

test('a free port names no customer, even when one is given', () => {
  const recorded = recordSplitterPort([], { ...second, customer: 'Ahmed Raza' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].customer, '');
  assert.equal(recorded[0].status, 'free');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'nope', extra: 42 };
  const snapshot = JSON.stringify(input);
  const recorded = recordSplitterPort([], input);
  assert.equal(recorded.length, 1);
  assert.equal('surprise' in recorded[0], false);
  assert.equal('extra' in recorded[0], false);
  assert.equal(JSON.stringify(input), snapshot);
  const listInput = [first, second];
  const listSnapshot = JSON.stringify(listInput);
  normalizeSplitterOccupancyList(listInput);
  assert.equal(JSON.stringify(listInput), listSnapshot);
});

test('duplicate ids and duplicate splitter ports are never rewritten', () => {
  const base = recordSplitterPort([], first);
  const sameId = recordSplitterPort(base, { ...second, id: 'SP-1' });
  assert.equal(sameId.length, 1);
  assert.equal(sameId[0].port, 3);
  const samePort = recordSplitterPort(base, {
    ...second,
    id: 'SP-9',
    splitter: 'spl-barrian-02',
    port: 3,
    status: 'occupied',
    customer: 'Someone Else',
  });
  assert.equal(samePort.length, 1);
  assert.equal(samePort[0].customer, 'Ahmed Raza');
});

test('find and remove work by id', () => {
  const base = [first, second, third].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  assert.equal(findSplitterPort(base, 'SP-2').port, 1);
  assert.equal(findSplitterPort(base, 'missing'), null);
  const removed = removeSplitterPort(base, 'SP-2');
  assert.equal(removed.length, 2);
  assert.equal(findSplitterPort(removed, 'SP-2'), null);
});

test('ports sort by splitter, then port number, then id', () => {
  const base = [third, first, other, second].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  const sorted = splitterOccupancySorted(base);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['SP-2', 'SP-1', 'SP-3', 'SP-4'],
  );
});

test('ports list per splitter, case-insensitively', () => {
  const base = [first, second, third, other].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  assert.equal(splitterPortsForSplitter(base, 'spl-barrian-02').length, 3);
  assert.equal(splitterPortsForSplitter(base, 'SPL-Main-01').length, 1);
  assert.equal(splitterPortsForSplitter(base, '').length, 0);
  assert.equal(splitterPortsForSplitter(base, 'nope').length, 0);
});

test('free and occupied counts sum to the splitter total', () => {
  const base = [first, second, third, other].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  const counts = splitterOccupancyCounts(base, 'SPL-Barrian-02');
  assert.deepEqual(counts, {
    splitter: 'SPL-Barrian-02',
    total: 3,
    free: 1,
    occupied: 2,
  });
  assert.equal(counts.free + counts.occupied, counts.total);
  assert.equal(splitterOccupancyCounts(base, 'nope'), null);
  const summaries = splitterOccupancySummaries(base);
  assert.equal(summaries.length, 2);
  assert.equal(
    summaries.every((entry) => entry.free + entry.occupied === entry.total),
    true,
  );
});

test('splitters list once each, first spelling kept', () => {
  const base = [first, second, third, other].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  assert.deepEqual(splitterOccupancySplitters(base), [
    'SPL-Barrian-02',
    'SPL-Main-01',
  ]);
});

test('fully occupied splitters are flagged', () => {
  const base = [first, second, third, other].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  assert.deepEqual(fullyOccupiedSplitters(base), []);
  const full = recordSplitterPort(
    [first, third],
    { ...second, id: 'SP-9', status: 'occupied', customer: 'Bilal' },
  );
  assert.deepEqual(fullyOccupiedSplitters(full), [
    { splitter: 'SPL-Barrian-02', total: 3, free: 0, occupied: 3 },
  ]);
});

test('an update is a dated entry, never a silent overwrite', () => {
  const base = recordSplitterPort([], first);
  const updated = updateSplitterPort(base, 'SP-1', {
    date: '2026-11-06',
    status: 'free',
    customer: '',
  });
  assert.equal(updated[0].status, 'free');
  assert.equal(updated[0].customer, '');
  assert.equal(updated[0].date, '2026-11-06');
  assert.equal(updated[0].updates.length, 1);
  assert.deepEqual(updated[0].updates[0], {
    date: '2026-11-06',
    status: 'free',
    customer: '',
  });
  assert.equal(updated[0].splitter, 'SPL-Barrian-02');
  assert.equal(updated[0].port, 3);
  const again = updateSplitterPort(updated, 'SP-1', {
    date: '2026-11-07',
    status: 'occupied',
    customer: 'Fatima Noor',
  });
  assert.equal(again[0].updates.length, 2);
  assert.equal(again[0].status, 'occupied');
  assert.equal(again[0].customer, 'Fatima Noor');
});

test('bad updates are refused and change nothing', () => {
  const base = recordSplitterPort([], first);
  assert.equal(
    updateSplitterPort(base, 'SP-1', { date: '2026-02-30', status: 'free' }),
    base,
  );
  assert.equal(
    updateSplitterPort(base, 'SP-1', { date: '2026-11-06', status: 'busy' }),
    base,
  );
  assert.equal(
    updateSplitterPort(base, 'SP-1', {
      date: '2026-11-06',
      status: 'occupied',
      customer: '',
    }),
    base,
  );
  assert.equal(
    updateSplitterPort(base, 'missing', {
      date: '2026-11-06',
      status: 'free',
    }),
    base,
  );
  assert.equal(updateSplitterPort(base, 'SP-1', null), base);
});

test('summary text names free, occupied, and full splitters', () => {
  const base = [first, second, third, other].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  assert.equal(
    splitterOccupancySummaryText(base),
    '4 ports across 2 splitters: 2 free, 2 occupied. No splitter is full.',
  );
  assert.equal(
    splitterOccupancySummaryText([]),
    '0 ports across 0 splitters: 0 free, 0 occupied. No splitter is full.',
  );
  const full = [first, third].reduce((list, entry) => {
    const next = recordSplitterPort(list, entry);
    return next;
  }, []);
  const filled = updateSplitterPort(
    recordSplitterPort(full, { ...second, id: 'SP-9', status: 'occupied', customer: 'Bilal' }),
    'SP-9',
    { date: '2026-11-07', status: 'occupied', customer: 'Bilal' },
  );
  assert.equal(
    splitterOccupancySummaryText(filled).includes('1 splitter is full: SPL-Barrian-02.'),
    true,
  );
});

test('entry text states the port, the state, and the update history', () => {
  assert.equal(
    splitterOccupancyText(first),
    'Splitter SPL-Barrian-02 port 3 (Barrian Road): occupied by Ahmed Raza as of 2026-11-05. No occupancy updates yet.',
  );
  assert.equal(
    splitterOccupancyText(second),
    'Splitter SPL-Barrian-02 port 1 (Barrian Road): free as of 2026-11-04. No occupancy updates yet.',
  );
  assert.equal(splitterOccupancyText({ ...first, date: '2026-02-30' }), '');
});

test('HTML escapes markup in the text', () => {
  const nasty = recordSplitterPort([], {
    ...first,
    customer: '<b>Ahmed</b> & Sons',
  });
  const html = splitterOccupancyHtml(nasty);
  assert.equal(html.includes('<b>Ahmed</b>'), false);
  assert.equal(html.includes('&lt;b&gt;Ahmed&lt;/b&gt; &amp; Sons'), true);
  assert.equal(
    splitterOccupancyHtml([]),
    '<p>No splitter ports recorded.</p>',
  );
});

test('CSV export and filename cover every field', () => {
  const base = [first, second].reduce(
    (list, entry) => recordSplitterPort(list, entry),
    [],
  );
  const csv = splitterOccupancyCsv(base);
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    '"id","splitter","segment","port","status","customer","date updated","occupancy updates"',
  );
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"SPL-Barrian-02"'), true);
  assert.equal(lines[1].includes('"1"'), true);
  assert.equal(splitterOccupancyFilename(), 'splitter-occupancy.csv');
});

test('list normalisation drops bad rows and duplicate ports', () => {
  const dirty = [
    first,
    { ...first, id: 'SP-1' },
    { ...second, splitter: 'SPL-Barrian-02', port: 3 },
    { ...second, date: '2026-02-30' },
    null,
    'nope',
  ];
  const clean = normalizeSplitterOccupancyList(dirty);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'SP-1');
  assert.deepEqual(normalizeSplitterOccupancyList('nope'), []);
  assert.deepEqual(normalizeSplitterOccupancyList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(
    new URL('../splitter-occupancy.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('document.'), false);
});

test('neighbour-module fence: fault history and port map are untouched', () => {
  const source = readFileSync(
    new URL('../splitter-occupancy.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('segment-fault-history'), false);
  assert.equal(source.includes('splitter-map'), false);
  assert.equal(source.includes('splitter-port-swap'), false);
  assert.equal(existsSync(new URL('../segment-fault-history.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../splitter-map.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../splitter-port-swap.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  for (const id of [
    'soList',
    'soSummary',
    'soSplitter',
    'soSegment',
    'soPort',
    'soStatus',
    'soCustomer',
    'soDate',
    'soRecordBtn',
    'soUpdateId',
    'soUpdateDate',
    'soUpdateStatus',
    'soUpdateCustomer',
    'soUpdateBtn',
    'soRemoveId',
    'soRemoveBtn',
    'soFilterSplitter',
    'soSplitterBtn',
    'soSplitterBody',
    'soFullBody',
    'soExportBtn',
  ]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wires the splitter occupancy panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './splitter-occupancy.js'"), true);
  assert.equal(source.includes('renderSplitterOccupancy()'), true);
  assert.equal(source.includes('SPLITTER_OCCUPANCY_KEY'), true);
  assert.equal(source.includes('splitterOccupancySorted'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
