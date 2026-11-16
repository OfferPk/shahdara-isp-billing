// Sharafat 75 — Re-saving a coverage estimate with the same figure
// silently dropped a date/basis correction.
//
// The upsert used to return the list unchanged whenever the premises
// figure was identical, so a date-only or basis-only correction never
// saved. The no-op now requires all three fields to match
// (premises AND date AND basis, normalized); a correction with the
// same figure saves the new date/basis and leaves history untouched,
// and only a figure change appends the old triple to history.
// Tests on generic mohalla names only — no real customer names, no
// phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  upsertCoverageEstimate,
  buildCoverageRegister,
} from '../coverage-register.js';

const estimate = (mohalla, premises, date, basis) => ({ mohalla, premises, date, basis });
const customer = (id, mohalla) => ({ id, name: id, mohalla });

// Base list for every case: Bani 140, 2026-03-01, 'recount', with the
// history entry from the earlier 100 -> 140 figure change — built by
// two upserts, exactly as the plan27 test does.
function baseList() {
  const first = upsertCoverageEstimate([], estimate('Bani', 100, '2026-01-10', 'walk'));
  return upsertCoverageEstimate(first, estimate('Bani', 140, '2026-03-01', 'recount'));
}

test('date-only: same figure + new date saves the new date, history untouched', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-04-15', 'recount'));
  assert.equal(out[0].date, '2026-04-15');
  assert.equal(out[0].premises, 140);
  assert.equal(out[0].basis, 'recount');
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('basis-only: same figure + new basis saves the new basis, history untouched', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-03-01', 'door count'));
  assert.equal(out[0].basis, 'door count');
  assert.equal(out[0].date, '2026-03-01');
  assert.equal(out[0].premises, 140);
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('basis cleared: same figure + basis "" saves the empty basis', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-03-01', ''));
  assert.equal(out[0].basis, '');
  assert.equal(out[0].date, '2026-03-01');
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('date+basis: same figure + new date + new basis saves both, history untouched', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-04-15', 'door count'));
  assert.equal(out[0].date, '2026-04-15');
  assert.equal(out[0].basis, 'door count');
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('date cleared: same figure + date "" saves null ("date not recorded")', () => {
  // Sharafat 75 R6: the browser date input CAN be cleared, so this is
  // a live path, not a corner — clearing the date is a real correction.
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '', 'recount'));
  assert.equal(out[0].date, null);
  assert.equal(out[0].premises, 140);
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('case-only basis edit saves (basis comparison is case-sensitive)', () => {
  // Sharafat 75 R5: text() only trims, so 'recount' vs 'Recount'
  // counts as a change and saves (no history). Harmless — a case-only
  // edit is still an operator edit — but the behaviour is locked here,
  // not accidental.
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-03-01', 'Recount'));
  assert.equal(out[0].basis, 'Recount');
  assert.deepEqual(out[0].history, [{ premises: 100, date: '2026-01-10', basis: 'walk' }]);
});

test('fully identical re-save is still a no-op, history length unchanged', () => {
  const base = baseList();
  const out = upsertCoverageEstimate(base, estimate('Bani', 140, '2026-03-01', 'recount'));
  assert.deepEqual(out, base);
  assert.equal(out[0].history.length, 1);
});

test('padded-date no-op: same figure/basis with a whitespace-padded date stays a no-op', () => {
  // Both sides are normalized before the comparison, so a padded date
  // equals the stored date and saves nothing.
  const base = baseList();
  const out = upsertCoverageEstimate(base, estimate('Bani', 140, ' 2026-03-01 ', 'recount'));
  assert.deepEqual(out, base);
});

test('figure change still appends the old triple (premises + OLD date + OLD basis)', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 160, '2026-03-01', 'recount'));
  assert.equal(out[0].premises, 160);
  assert.deepEqual(out[0].history, [
    { premises: 100, date: '2026-01-10', basis: 'walk' },
    { premises: 140, date: '2026-03-01', basis: 'recount' },
  ]);
});

test('figure change + new date: new date on the row, OLD date in history', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Bani', 160, '2026-04-15', 'door count'));
  assert.equal(out[0].premises, 160);
  assert.equal(out[0].date, '2026-04-15');
  assert.equal(out[0].basis, 'door count');
  assert.deepEqual(out[0].history, [
    { premises: 100, date: '2026-01-10', basis: 'walk' },
    { premises: 140, date: '2026-03-01', basis: 'recount' },
  ]);
});

test('row order unchanged by a date-only correction', () => {
  const list = upsertCoverageEstimate(baseList(), estimate('Malla', 50, '2026-02-01', 'walk'));
  assert.deepEqual(list.map((row) => row.label), ['Banii', 'Malla']);
  const out = upsertCoverageEstimate(list, estimate('Bani', 140, '2026-04-15', 'recount'));
  assert.deepEqual(out.map((row) => row.label), ['Banii', 'Malla']);
  assert.equal(out[0].date, '2026-04-15');
});

test('guards: invalid premises rejected, list unchanged', () => {
  const base = baseList();
  const out = upsertCoverageEstimate(base, estimate('Bani', 0, '2026-04-15', 'recount'));
  assert.deepEqual(out, base);
});

test('guards: inputs never mutated', () => {
  const base = baseList();
  const snapshot = JSON.stringify(base);
  const entry = estimate('Bani', 140, '2026-04-15', 'door count');
  const entrySnapshot = JSON.stringify(entry);
  upsertCoverageEstimate(base, entry);
  assert.equal(JSON.stringify(base), snapshot);
  assert.equal(JSON.stringify(entry), entrySnapshot);
});

test('guards: take-up / remaining untouched by a date-only change', () => {
  const customers = [customer('c1', 'Bani'), customer('c2', 'Bani')];
  const before = buildCoverageRegister({ customers, estimates: baseList() });
  const after = buildCoverageRegister({
    customers,
    estimates: upsertCoverageEstimate(baseList(), estimate('Bani', 140, '2026-04-15', 'recount')),
  });
  const beforeRow = before.rows.find((row) => row.key === 'banii');
  const afterRow = after.rows.find((row) => row.key === 'banii');
  assert.equal(afterRow.takeUpPercent, beforeRow.takeUpPercent);
  assert.equal(afterRow.remainingPremises, beforeRow.remainingPremises);
  assert.equal(afterRow.activeCount, beforeRow.activeCount);
});

test('guards: new-mohalla insert unaffected', () => {
  const out = upsertCoverageEstimate(baseList(), estimate('Malla', 50, '2026-02-01', 'walk'));
  assert.equal(out.length, 2);
  const malla = out.find((row) => row.key === 'malla');
  assert.equal(malla.premises, 50);
  assert.equal(malla.date, '2026-02-01');
  assert.deepEqual(malla.history, []);
});
