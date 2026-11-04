/**
 * plan92-status-board.test.js — Plan 92: mohalla service-status board.
 * Pins:
 * - each mohalla's board status matches its linked outage or
 *   maintenance record on the same fixture (open outage -> outage,
 *   in-progress outage -> degraded, active window -> maintenance);
 * - a mohalla with no open outage or active window shows as normal,
 *   never as guessed, and clearing the source record clears the
 *   board entry on the next build;
 * - precedence outage > degraded > maintenance > normal, with every
 *   linked record still named in the row's sources;
 * - a mohalla named only by a live record still gets a row, and
 *   an area typed in a record is quoted exactly as recorded,
 *   never silently dropped;
 * - the board is read-only: inputs are never mutated and the module
 *   names no store.
 * Synthetic data only; the board sets no status by itself and
 * changes no ticket, billing, or customer record.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOARD_STATUSES,
  BOARD_STATUS_LABELS,
  canonicalBoardMohalla,
  isValidBoardDate,
  normalizeBoardOutage,
  normalizeBoardWindow,
  buildStatusBoard,
  filterBoardRows,
  boardSummary,
  boardSummaryText,
  boardHtml,
  boardCsv,
  boardFilename,
} from '../status-board.js';

const TODAY = '2026-01-20';

test('canonical mohalla keys mirror the Plan T rule', () => {
  assert.equal(canonicalBoardMohalla('Mohalla Bani').key, 'banii');
  assert.equal(canonicalBoardMohalla('bani').key, 'banii');
  assert.equal(canonicalBoardMohalla('BANI').key, 'banii');
  assert.equal(canonicalBoardMohalla('Mohalla Kishti').key, 'kishtii');
  assert.equal(canonicalBoardMohalla('chamyaa').key, 'chamyaaa');
  assert.equal(canonicalBoardMohalla('  '), null);
  assert.equal(canonicalBoardMohalla(''), null);
  assert.equal(canonicalBoardMohalla(null), null);
});

test('strict board dates reject impossible dates', () => {
  assert.equal(isValidBoardDate('2026-02-30'), false);
  assert.equal(isValidBoardDate('2026-01-20'), true);
  assert.equal(isValidBoardDate('20-01-2026'), false);
  assert.equal(isValidBoardDate(''), false);
});

test('open outage maps to outage, in-progress outage to degraded, resolved ignored', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani', 'Kishti', 'Gangall'],
    outages: [
      { id: 'O1', area: 'Bani', status: 'open', startTime: '2026-01-20 08:00', causeNote: 'Feeder down' },
      { id: 'O2', area: 'Kishti', status: 'in_progress', startTime: '2026-01-19 10:00', causeNote: 'Splitter swap underway' },
      { id: 'O3', area: 'Gangall', status: 'resolved', startTime: '2026-01-18 09:00', causeNote: 'Old fault' },
    ],
    windows: [],
    today: TODAY,
  });
  const byMohalla = Object.fromEntries(board.rows.map((row) => [row.mohalla, row]));
  assert.equal(byMohalla.Banii.status, 'outage');
  assert.equal(byMohalla.Banii.sourceLabel, 'Feeder down');
  assert.equal(byMohalla.Kishtii.status, 'degraded');
  assert.equal(byMohalla.Gangall.status, 'normal');
});

test('active window maps to maintenance; completed, postponed, and other-day windows do not', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani', 'Kishti', 'Gangall', 'Barrian', 'Thalii'],
    outages: [],
    windows: [
      { id: 'W1', date: TODAY, status: 'scheduled', description: 'Cable re-route', mohallas: ['Bani'] },
      { id: 'W2', date: '2026-01-05', status: 'in_progress', description: 'Splitter swap', mohallas: ['Kishti'] },
      { id: 'W3', date: TODAY, status: 'completed', description: 'Done work', mohallas: ['Gangall'] },
      { id: 'W4', date: TODAY, status: 'postponed', description: 'Delayed work', mohallas: ['Barrian'] },
      { id: 'W5', date: '2026-01-25', status: 'scheduled', description: 'Future work', mohallas: ['Thalii'] },
    ],
    today: TODAY,
  });
  const byMohalla = Object.fromEntries(board.rows.map((row) => [row.mohalla, row]));
  assert.equal(byMohalla.Banii.status, 'maintenance');
  assert.equal(byMohalla.Kishtii.status, 'maintenance');
  assert.equal(byMohalla.Gangall.status, 'normal');
  assert.equal(byMohalla.Barrian.status, 'normal');
  assert.equal(byMohalla.Thalii.status, 'normal');
});

test('no usable today means scheduled windows never count as active', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani'],
    outages: [],
    windows: [{ id: 'W1', date: TODAY, status: 'scheduled', description: 'Work', mohallas: ['Bani'] }],
    today: 'not-a-date',
  });
  assert.equal(board.rows[0].status, 'normal');
  assert.equal(board.today, null);
});

test('precedence outage over degraded over maintenance, all sources still named', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani', 'Kishti', 'Gangall'],
    outages: [
      { id: 'O1', area: 'Bani', status: 'open', causeNote: 'Feeder down' },
      { id: 'O2', area: 'Kishti', status: 'in_progress', causeNote: 'Repair underway' },
    ],
    windows: [
      { id: 'W1', date: TODAY, status: 'scheduled', description: 'Cable work', mohallas: ['Bani', 'Kishti', 'Gangall'] },
    ],
    today: TODAY,
  });
  const byMohalla = Object.fromEntries(board.rows.map((row) => [row.mohalla, row]));
  assert.equal(byMohalla.Banii.status, 'outage');
  assert.equal(byMohalla.Kishtii.status, 'degraded');
  assert.equal(byMohalla.Gangall.status, 'maintenance');
  assert.equal(byMohalla.Banii.sources.length, 2);
  assert.equal(byMohalla.Kishtii.sources.length, 2);
  assert.ok(byMohalla.Banii.sources.some((s) => s.kind === 'window'));
});

test('a mohalla named only by a live record gets a row; a typed area is quoted, never dropped', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani'],
    outages: [
      { id: 'O1', area: 'Sodaa', status: 'open', causeNote: 'Fault' },
      { id: 'O2', area: 'Splitter Z', status: 'open', causeNote: 'Segment typed as area' },
    ],
    windows: [],
    today: TODAY,
  });
  const names = board.rows.map((row) => row.mohalla);
  assert.ok(names.includes('Sodaa'));
  assert.equal(board.rows.find((row) => row.mohalla === 'Sodaa').status, 'outage');
  // No segment mapping was supplied, so the typed area is quoted
  // visibly as its own row until the record is corrected at its
  // source — it is never silently dropped.
  assert.ok(names.includes('Splitter Z'));
  assert.equal(board.rows.find((row) => row.mohalla === 'Splitter Z').status, 'outage');
});

test('segment mapping covers its mohallas with their own names', () => {
  const board = buildStatusBoard({
    mohallas: [],
    outages: [{ id: 'O1', area: 'Splitter A', status: 'open', causeNote: 'Segment fault' }],
    windows: [],
    today: TODAY,
    segments: [{ segment: 'Splitter A', mohallas: ['Bani', 'Kishti'] }],
  });
  assert.deepEqual(board.rows.map((row) => row.mohalla).sort(), ['Banii', 'Kishtii']);
  assert.ok(board.rows.every((row) => row.status === 'outage'));
});

test('clearing the source record clears the board entry on the next build', () => {
  const outages = [{ id: 'O1', area: 'Bani', status: 'open', causeNote: 'Feeder down' }];
  const first = buildStatusBoard({ mohallas: ['Bani'], outages, windows: [], today: TODAY });
  assert.equal(first.rows[0].status, 'outage');
  const second = buildStatusBoard({ mohallas: ['Bani'], outages: [], windows: [], today: TODAY });
  assert.equal(second.rows[0].status, 'normal');
  assert.equal(second.rows[0].sources.length, 0);
});

test('unusable outages and windows are dropped, never counted on a guessed figure', () => {
  assert.equal(normalizeBoardOutage({ id: 'O1', status: 'open' }), null);
  assert.equal(normalizeBoardOutage(null), null);
  assert.equal(normalizeBoardWindow({ id: 'W1', date: '2026-02-30', status: 'scheduled', description: 'Work', mohallas: ['Bani'] }), null);
  assert.equal(normalizeBoardWindow({ id: 'W2', date: TODAY, status: 'bogus', description: 'Work', mohallas: ['Bani'] }), null);
  assert.equal(normalizeBoardWindow({ id: 'W3', date: TODAY, status: 'scheduled', description: 'Work', mohallas: [] }), null);
  const board = buildStatusBoard({
    mohallas: ['Bani'],
    outages: [{ status: 'open' }],
    windows: [{ id: 'W1', date: '2026-02-30', status: 'scheduled', description: 'Work', mohallas: ['Bani'] }],
    today: TODAY,
  });
  assert.equal(board.rows[0].status, 'normal');
});

test('filters by status and mohalla, summary counts check', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani', 'Kishti', 'Gangall'],
    outages: [{ id: 'O1', area: 'Bani', status: 'open', causeNote: 'Fault' }],
    windows: [{ id: 'W1', date: TODAY, status: 'scheduled', description: 'Work', mohallas: ['Kishti'] }],
    today: TODAY,
  });
  assert.equal(filterBoardRows(board.rows, { status: 'outage' }).length, 1);
  assert.equal(filterBoardRows(board.rows, { mohalla: 'Mohalla Bani' }).length, 1);
  assert.equal(filterBoardRows(board.rows, { status: 'normal' }).length, 1);
  assert.deepEqual(boardSummary(board), { normal: 1, degraded: 0, outage: 1, maintenance: 1, total: 3 });
  assert.match(boardSummaryText(board), /3 mohallas on the board/);
  assert.match(boardSummaryText(board), /1 in outage/);
});

test('inputs are never mutated', () => {
  const outages = [{ id: 'O1', area: 'Bani', status: 'open', causeNote: 'Fault' }];
  const windows = [{ id: 'W1', date: TODAY, status: 'scheduled', description: 'Work', mohallas: ['Kishti'] }];
  const mohallas = ['Bani', 'Kishti'];
  const snapshot = JSON.stringify({ outages, windows, mohallas });
  buildStatusBoard({ mohallas, outages, windows, today: TODAY });
  assert.equal(JSON.stringify({ outages, windows, mohallas }), snapshot);
});

test('board is read-only: module names no store and reads no storage', () => {
  const source = readFileSync(new URL('../status-board.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|shahdara_/);
  assert.ok(BOARD_STATUSES.includes('normal'));
  assert.equal(BOARD_STATUS_LABELS.outage, 'Outage');
});

test('HTML escaping, CSV quoting, and filename', () => {
  const board = buildStatusBoard({
    mohallas: ['Bani'],
    outages: [{ id: 'O1', area: 'Bani', status: 'open', causeNote: 'Fault <b> & "quotes"' }],
    windows: [],
    today: TODAY,
  });
  assert.doesNotMatch(boardHtml(board), /<b>/);
  assert.match(boardCsv(board), /"Fault <b> & ""quotes"""/);
  assert.equal(boardFilename(TODAY), 'status-board-2026-01-20.csv');
  assert.equal(boardFilename('bogus'), 'status-board.csv');
});

test('rows sort worst status first, then mohalla name', () => {
  const board = buildStatusBoard({
    mohallas: ['Thalii', 'Bani', 'Kishti'],
    outages: [{ id: 'O1', area: 'Thalii', status: 'open', causeNote: 'Fault' }],
    windows: [{ id: 'W1', date: TODAY, status: 'scheduled', description: 'Work', mohallas: ['Bani'] }],
    today: TODAY,
  });
  assert.deepEqual(board.rows.map((row) => row.status), ['outage', 'maintenance', 'normal']);
});
