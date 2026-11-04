import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validGeneratorFuelDate,
  normalizeGeneratorFuel,
  normalizeGeneratorFuelList,
  findGeneratorFuel,
  upsertGeneratorFuel,
  removeGeneratorFuel,
  generatorFuelsNewestFirst,
  generatorFuelsForSite,
  latestGeneratorFuelLevel,
  latestGeneratorFuel,
  generatorFuelCounts,
  generatorFuelSummaryText,
  generatorFuelHtml,
  generatorFuelCsv,
  generatorFuelFilename,
} from '../generator-fuel-log.js';

const entry = (over = {}) => ({
  id: 'GF-1',
  site: 'Main Site',
  date: '2026-11-05',
  fuelAdded: 20,
  levelAfterFill: 45,
  runningHours: 120,
  note: 'Filled before the night cut.',
  ...over,
});

test('strict dates: real values pass, impossible values refused', () => {
  assert.equal(validGeneratorFuelDate('2026-11-05'), '2026-11-05');
  assert.equal(validGeneratorFuelDate('2026-08-31'), '2026-08-31');
  assert.equal(validGeneratorFuelDate('2026-10-31'), '2026-10-31');
  assert.equal(validGeneratorFuelDate('2026-12-31'), '2026-12-31');
  assert.equal(validGeneratorFuelDate('2024-02-29'), '2024-02-29');
  assert.equal(validGeneratorFuelDate('2026-02-30'), null);
  assert.equal(validGeneratorFuelDate('2026-04-31'), null);
  assert.equal(validGeneratorFuelDate('2026-13-01'), null);
  assert.equal(validGeneratorFuelDate('05-11-2026'), null);
  assert.equal(validGeneratorFuelDate(''), null);
  assert.equal(validGeneratorFuelDate(null), null);
});

test('a record with no site or no date is refused', () => {
  assert.equal(normalizeGeneratorFuel(entry({ site: '' })), null);
  assert.equal(normalizeGeneratorFuel(entry({ site: '   ' })), null);
  assert.equal(normalizeGeneratorFuel(entry({ site: null })), null);
  assert.equal(normalizeGeneratorFuel(entry({ date: '' })), null);
  assert.equal(normalizeGeneratorFuel(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeGeneratorFuel(entry({ id: '' })), null);
});

test('fuel and level rules: no fill, zero fill, negative level, negative hours refused', () => {
  assert.equal(normalizeGeneratorFuel(entry({ fuelAdded: null })), null);
  assert.equal(normalizeGeneratorFuel(entry({ fuelAdded: 0 })), null);
  assert.equal(normalizeGeneratorFuel(entry({ fuelAdded: -5 })), null);
  assert.equal(normalizeGeneratorFuel(entry({ fuelAdded: 'abc' })), null);
  assert.equal(normalizeGeneratorFuel(entry({ levelAfterFill: null })), null);
  assert.equal(normalizeGeneratorFuel(entry({ levelAfterFill: -1 })), null);
  assert.equal(normalizeGeneratorFuel(entry({ runningHours: -2 })), null);
  assert.equal(normalizeGeneratorFuel(entry({ runningHours: 'abc' })), null);
});

test('zero level and zero running hours are real values, not refusals', () => {
  const item = normalizeGeneratorFuel(entry({ levelAfterFill: 0, runningHours: 0 }));
  assert.equal(item.levelAfterFill, 0);
  assert.equal(item.runningHours, 0);
});

test('running hours and note are optional; string numbers are accepted', () => {
  const item = normalizeGeneratorFuel(entry({ runningHours: undefined, note: undefined, fuelAdded: '20', levelAfterFill: '45' }));
  assert.equal(item.runningHours, null);
  assert.equal(item.note, '');
  assert.equal(item.fuelAdded, 20);
  assert.equal(item.levelAfterFill, 45);
});

test('unknown fields are dropped: a record can never grow an expense, vendor-bill, or payment field', () => {
  const item = normalizeGeneratorFuel(entry({ expenseAmount: 5000, vendorBillId: 'VB-1', paymentId: 'P-1', stockCount: 3 }));
  assert.deepEqual(Object.keys(item).sort(), ['date', 'fuelAdded', 'id', 'levelAfterFill', 'note', 'runningHours', 'site']);
});

test('duplicate id: identical re-save unchanged, different figures refused', () => {
  const base = [entry()];
  assert.equal(upsertGeneratorFuel(base, entry()).length, 1);
  assert.equal(upsertGeneratorFuel(base, entry()).length, 1);
  const changed = upsertGeneratorFuel(base, entry({ fuelAdded: 30 }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].fuelAdded, 20);
  const added = upsertGeneratorFuel(base, entry({ id: 'GF-2', date: '2026-11-06' }));
  assert.equal(added.length, 2);
});

test('removal drops only the named id; inputs are never mutated', () => {
  const base = [entry(), entry({ id: 'GF-2', date: '2026-11-06' })];
  const after = removeGeneratorFuel(base, 'GF-1');
  assert.deepEqual(after.map((row) => row.id), ['GF-2']);
  assert.equal(base.length, 2);
  assert.equal(removeGeneratorFuel(base, 'GF-9').length, 2);
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  const rows = normalizeGeneratorFuelList([entry(), entry({ site: '' }), entry({ id: 'GF-1', fuelAdded: 99 })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fuelAdded, 20);
  assert.deepEqual(normalizeGeneratorFuelList(null), []);
  assert.deepEqual(normalizeGeneratorFuelList('nope'), []);
});

test('find returns the entry or null', () => {
  const base = [entry(), entry({ id: 'GF-2', site: 'North Site', date: '2026-11-06' })];
  assert.equal(findGeneratorFuel(base, 'GF-2').site, 'North Site');
  assert.equal(findGeneratorFuel(base, 'GF-9'), null);
});

test('site history is newest first; site match is case-insensitive', () => {
  const base = [
    entry({ id: 'GF-1', date: '2026-11-01' }),
    entry({ id: 'GF-2', date: '2026-11-05' }),
    entry({ id: 'GF-3', site: 'North Site', date: '2026-11-06' }),
  ];
  assert.deepEqual(generatorFuelsForSite(base, 'main site').map((row) => row.id), ['GF-2', 'GF-1']);
  assert.deepEqual(generatorFuelsForSite(base, '').map((row) => row.id), []);
  assert.deepEqual(generatorFuelsNewestFirst(base).map((row) => row.id), ['GF-3', 'GF-2', 'GF-1']);
});

test('latest level comes from the newest fill, even when it was recorded first', () => {
  const base = [
    entry({ id: 'GF-1', date: '2026-11-05', levelAfterFill: 60 }),
    entry({ id: 'GF-2', date: '2026-11-01', levelAfterFill: 20 }),
  ];
  assert.equal(latestGeneratorFuelLevel(base, 'Main Site'), 60);
  assert.equal(latestGeneratorFuel(base, 'Main Site').id, 'GF-1');
  assert.equal(latestGeneratorFuelLevel(base, 'Nowhere Site'), null);
  assert.equal(latestGeneratorFuel(base, 'Nowhere Site'), null);
});

test('counts group sites case-insensitively', () => {
  const base = [entry(), entry({ id: 'GF-2', site: 'MAIN SITE', date: '2026-11-06' }), entry({ id: 'GF-3', site: 'North Site', date: '2026-11-06' })];
  assert.deepEqual(generatorFuelCounts(base), { fills: 3, sites: 2 });
  assert.deepEqual(generatorFuelCounts([]), { fills: 0, sites: 0 });
});

test('summary text: empty log says so, filled log names the latest fill', () => {
  assert.equal(generatorFuelSummaryText([]), 'No fuel fill recorded yet.');
  const base = [entry(), entry({ id: 'GF-2', site: 'North Site', date: '2026-11-06' })];
  assert.equal(generatorFuelSummaryText(base), '2 fuel fills across 2 sites; latest fill 2026-11-06 at North Site.');
  assert.equal(generatorFuelSummaryText([entry()]), '1 fuel fill across 1 site; latest fill 2026-11-05 at Main Site.');
});

test('site page html shows the latest level and history newest first, and escapes input', () => {
  const base = [
    entry({ id: 'GF-1', date: '2026-11-01', levelAfterFill: 20 }),
    entry({ id: 'GF-2', date: '2026-11-05', levelAfterFill: 60, note: '<b>bold</b>' }),
  ];
  const html = generatorFuelHtml(base, 'Main Site');
  assert.match(html, /Latest level at Main Site: 60 litres \(filled 2026-11-05\)/);
  assert.ok(html.indexOf('GF-2') < html.indexOf('GF-1'));
  assert.ok(!html.includes('<b>bold</b>'));
  assert.equal(generatorFuelHtml(base, 'Nowhere Site'), '<p>No fuel fill recorded yet for Nowhere Site.</p>');
  assert.equal(generatorFuelHtml(base, ''), '<p>Pick a site to see its fuel log.</p>');
});

test('csv header, rows, quoting, and filename', () => {
  const base = [entry({ note: 'Filled, "before" the cut' })];
  const csv = generatorFuelCsv(base);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,site,date,fuel_added_litres,level_after_fill_litres,running_hours,note');
  assert.equal(lines[1], 'GF-1,Main Site,2026-11-05,20,45,120,"Filled, ""before"" the cut"');
  assert.equal(generatorFuelFilename(), 'generator-fuel-log.csv');
});

test('purity: recording a fill never invents an expense, vendor bill, or payment figure', () => {
  const base = upsertGeneratorFuel([], entry());
  assert.equal(base.length, 1);
  assert.ok(!('expenseAmount' in base[0]) && !('vendorBillId' in base[0]) && !('paymentId' in base[0]));
  assert.equal(JSON.stringify(base), JSON.stringify([normalizeGeneratorFuel(entry())]));
});
