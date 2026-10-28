import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveBillMonth, addPayment, updateCustomerProfile } from '../core.js';
import { buildCustomerRankings, CUSTOMER_RANKING_TYPES, TROUBLESOME_RULE } from '../owner-insights.js';
import { groupAreasWithCounts } from '../form-validation.js';
import { canonicalMohalla } from '../phase3.js';

// Customer lists: Top 10 early payers (1st–3rd, crowned 👑 in the UI),
// 10 often-late payers (after the 5th), and the "tang karne wale" list,
// plus "Mohalla (N)" headcounts next to mohalla names in the filters.
// Early/late count the receipt's own day-of-month across all saved history;
// the 4th and 5th are neither early nor late.

const today = new Date('2026-10-07T12:00:00+05:00');
const billFor = (state, id, month, opts = {}) => saveBillMonth(state, id, { month, dueAmount: '1000', status: 'pending', ...opts }, today);
const payFor = (state, id, month, date) => addPayment(state, id, month, { date, amount: '1000', method: 'Cash' }, today);
const profile = (state, id, mohalla) => updateCustomerProfile(state, id, { mohalla, serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, today);

function listState() {
  let state = createInitialState(['Ali', 'Bilal', 'Chaudhry', 'Danish', 'Ehsan']);
  state = profile(state, 'seed-001', 'Bani');
  state = profile(state, 'seed-002', 'Bani');
  state = profile(state, 'seed-003', 'bani');
  state = profile(state, 'seed-004', 'Kishti');
  state = profile(state, 'seed-005', 'Kishti');
  // Ali: three early receipts (2nd, 1st, 3rd) + one late receipt (10th).
  for (const month of ['2026-06', '2026-07', '2026-08', '2026-09']) state = billFor(state, 'seed-001', month);
  state = payFor(state, 'seed-001', '2026-06', '2026-06-02');
  state = payFor(state, 'seed-001', '2026-07', '2026-07-01');
  state = payFor(state, 'seed-001', '2026-08', '2026-08-03');
  state = payFor(state, 'seed-001', '2026-09', '2026-09-10');
  // Bilal: two late receipts (6th, 20th), nothing early.
  for (const month of ['2026-06', '2026-07']) state = billFor(state, 'seed-002', month);
  state = payFor(state, 'seed-002', '2026-06', '2026-06-06');
  state = payFor(state, 'seed-002', '2026-07', '2026-07-20');
  // Chaudhry: boundary days only — 4th and 5th are neither early nor late.
  for (const month of ['2026-06', '2026-07']) state = billFor(state, 'seed-003', month);
  state = payFor(state, 'seed-003', '2026-06', '2026-06-04');
  state = payFor(state, 'seed-003', '2026-07', '2026-07-05');
  // Danish: one early receipt (3rd).
  state = billFor(state, 'seed-004', '2026-06');
  state = payFor(state, 'seed-004', '2026-06', '2026-06-03');
  // Ehsan: one bill due 2026-08-05, never paid — 63 days overdue at 2026-10-07.
  state = billFor(state, 'seed-005', '2026-08', { dueDate: '2026-08-05' });
  return state;
}

test('ranking types include early, late and troublesome lists', () => {
  for (const id of ['early-payers', 'late-payers', 'troublesome']) assert.ok(CUSTOMER_RANKING_TYPES.some(row => row.id === id), `${id} is a ranking type`);
  assert.match(TROUBLESOME_RULE, /30 or more days overdue/);
  assert.match(TROUBLESOME_RULE, /2 or more recorded complaints/);
});

test('early payers rank 1st–3rd receipts across all history', () => {
  const result = buildCustomerRankings(listState(), { type: 'early-payers' }, today);
  assert.deepEqual(result.rows.map(row => row.name), ['Ali', 'Danish']);
  assert.deepEqual(result.rows.map(row => row.value), [3, 1]);
  assert.equal(result.rows[0].displayValue, '3 early payments · 1st–3rd');
  assert.equal(result.rows[1].displayValue, '1 early payment · 1st–3rd');
});

test('late payers rank after-5th receipts; 4th and 5th do not count', () => {
  const result = buildCustomerRankings(listState(), { type: 'late-payers' }, today);
  assert.deepEqual(result.rows.map(row => row.name), ['Bilal', 'Ali']);
  assert.deepEqual(result.rows.map(row => row.value), [2, 1]);
  assert.equal(result.rows[0].displayValue, '2 late payments · after 5th');
});

test('troublesome list applies the stated rule and ranks by signals then late count', () => {
  const complaints = [{ customerId: 'seed-002' }, { customerId: 'seed-002' }, { customerId: 'seed-004' }];
  const result = buildCustomerRankings(listState(), { type: 'troublesome', complaints }, today);
  assert.deepEqual(result.rows.map(row => row.name), ['Bilal', 'Ehsan']);
  assert.deepEqual(result.rows.map(row => row.value), [2, 1]);
  assert.match(result.rows[0].displayValue, /2 payments after the 5th/);
  assert.match(result.rows[0].displayValue, /2 complaints/);
  assert.match(result.rows[1].displayValue, /63 days overdue/);
  // Complaints are optional: late payments alone still qualify Bilal.
  const withoutComplaints = buildCustomerRankings(listState(), { type: 'troublesome' }, today);
  assert.deepEqual(withoutComplaints.rows.map(row => row.name), ['Bilal', 'Ehsan']);
});

test('early and late lists cap at 10 rows', () => {
  let state = createInitialState(Array.from({ length: 12 }, (_, i) => `Customer ${i + 1}`));
  for (let i = 1; i <= 12; i++) {
    const id = `seed-${String(i).padStart(3, '0')}`;
    state = billFor(state, id, '2026-06');
    state = payFor(state, id, '2026-06', '2026-06-02');
  }
  const result = buildCustomerRankings(state, { type: 'early-payers' }, today);
  assert.equal(result.rows.length, 10);
  assert.ok(result.rows.every(row => row.value === 1));
});

test('mohalla headcounts group spelling variants and skip empty areas', () => {
  const groups = groupAreasWithCounts([
    { mohalla: 'Bani' }, { mohalla: 'bani' }, { mohalla: 'Bani ' }, { mohalla: 'Kishti' }, { mohalla: '' }, { area: 'Bani' },
  ]);
  assert.deepEqual(groups, [
    { value: 'Bani', count: 4, label: 'Bani (4)' },
    { value: 'Kishti', count: 1, label: 'Kishti (1)' },
  ]);
  const rankingGroups = groupAreasWithCounts([
    { zone: 'North' }, { mohalla: '', zone: 'North' }, { mohalla: 'Bani' }, { mohalla: '', zone: '' },
  ], customer => customer.mohalla?.trim() || customer.zone?.trim() || 'Area not recorded');
  assert.deepEqual(rankingGroups, [
    { value: 'Area not recorded', count: 1, label: 'Area not recorded (1)' },
    { value: 'Bani', count: 1, label: 'Bani (1)' },
    { value: 'North', count: 2, label: 'North (2)' },
  ]);
});

test('mohalla headcounts group by canonical identity when the caller passes it', () => {
  const canonicalKey = raw => canonicalMohalla(raw)?.key ?? raw.toLowerCase();
  const canonicalLabel = raw => raw === 'Area not recorded' ? raw : (canonicalMohalla(raw)?.label ?? raw);
  const groups = groupAreasWithCounts([
    { mohalla: 'Bani' }, { mohalla: 'BANII' }, { mohalla: 'MOHALAA BANI' }, { mohalla: 'Kishti' },
  ], c => (c.mohalla || c.area || '').trim(), canonicalKey, canonicalLabel);
  assert.deepEqual(groups, [
    { value: 'Banii', count: 3, label: 'Banii (3)' },
    { value: 'Kishtii', count: 1, label: 'Kishtii (1)' },
  ]);
});
