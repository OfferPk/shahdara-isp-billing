// QC-2 — Priority indicator on collection cards + oldest-first sort
// toggle + high-balance tiers. The 0–100 buildSmartDuesRecovery score
// already exists (High ≥75 / Medium 35–74 / Low <35, with verbatim
// reasons; the Dues Recovery Overhaul raised High from ≥65 and added
// the 75-point floor for arrears, 2+ unpaid bills or an overdue
// Waada — a card that was High at 65–74 without one of those signals
// is Medium now, and Long Four (56, 2 bills, 97 days overdue) is
// High at the floor), but it is computed and shown only in the owner
// view — never where collection happens. QC-2 surfaces it, unchanged,
// on the Quick Collect picker cards and the Field Mode cards: tier
// badge + the scorer's own first reason, plus high-balance tier
// labels. No new scoring, no re-ranking the score does not already
// rank. A card with no scorer row (no open priced bill — e.g.
// baqaya-only) shows NO tier, never a guessed value.
//
// Oldest-first sort: a real working control above the picker search
// that orders the dues list by oldest unpaid bill month (oldest due
// date, then amount desc, then customer number — the
// dashboard-overdue-list.js tie-break); the default (highest dues
// first) is untouched unless the user picks it.
//
// High-balance tiers (audit MISSING #4, boundaries pinned from
// figures already in the code, not invented): 2+ months arrears
// (dueMonthCount >= 2, roster-quick-filters.js) and 90+ days overdue
// (the 90+ aging bucket, dashboard-dues-aging.js). Both come from
// the scorer row's openBillCount / longestOverdueDays.
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read
// the HTML/CSS/JS as text and assert the values; no browser needed.
// Fixture data only — pattern-fake phones (0301234567n family), no
// real customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addPayment, createInitialState, saveBillMonth } from '../core.js';
import {
  getPendingCollectionCustomers,
  renderQuickCollectPickerHtml,
} from '../nav-quick-collect.js';
import { buildSmartDuesRecovery } from '../owner-insights.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const qcSrc = read('nav-quick-collect.js');
const fieldSrc = read('field-mode.js');
const stylesSrc = read('styles.css');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

const URDU = /[\u0600-\u06FF]/;

// The new pure module under test — dynamic import so the scorer pins
// below pass on the pristine base (pre-fix) while the QC-2 tests
// fail with "Cannot find module" until the module lands.
let qc2Cache = null;
const qc2 = async () => {
  if (!qc2Cache) qc2Cache = await import('../qc2-priority.js');
  return qc2Cache;
};

// --- Fixed-date scorer fixture (probe-verified at 2026-11-10) --------
// High One: 3 bills Sep+Oct+Nov @ 20000 (due the 5th), monthly 5000
//   -> 30 amount + 25 overdue (66d) + 15 history (health 25) + 0 late
//   + 10 value = 80 High; 3 open bills, oldest 2026-09-05.
// Long Four: Aug+Sep @ 1000, monthly 1000
//   -> 12 + 25 (97d) + 15 + 0 + 4 = 56 raw, floored to 75 High (2 open
//   bills and 97 days overdue both trigger the High-priority floor);
//   both high-balance tiers.
// Medium Two: Nov @ 10000, monthly 2500
//   -> 24 + 5 (5d) + 10 (insufficient history) + 0 + 7 = 46 Medium.
// Low Three: Nov @ 1000, monthly 500
//   -> 12 + 5 (5d) + 10 + 0 + 1 = 28 Low.
// Settled Five: Nov @ 1000 paid in full -> no scorer row at all.
// Baqaya Six: no bills, one manual baqaya entry -> in the pool with
//   earliestUnpaidMonth null, but no scorer row.
const scorerToday = new Date('2026-11-10T12:00:00+05:00');
function scorerState() {
  let state = createInitialState(['High One', 'Medium Two', 'Low Three', 'Long Four', 'Settled Five', 'Baqaya Six']);
  const [h, m, l, lo, s, b] = state.customers.map((c) => c.id);
  state.customers[0].monthlySellingAmount = 5000;
  state.customers[1].monthlySellingAmount = 2500;
  state.customers[2].monthlySellingAmount = 500;
  state.customers[3].monthlySellingAmount = 1000;
  const bill = (id, month, amount) => {
    state = saveBillMonth(state, id, { month, dueAmount: String(amount), status: 'pending', dueDate: `${month}-05` }, scorerToday);
  };
  for (const month of ['2026-09', '2026-10', '2026-11']) bill(h, month, 20000);
  bill(m, '2026-11', 10000);
  bill(l, '2026-11', 1000);
  bill(lo, '2026-08', 1000);
  bill(lo, '2026-09', 1000);
  bill(s, '2026-11', 1000);
  state = addPayment(state, s, '2026-11', { date: '2026-11-06', amount: '1000', method: 'Cash' }, scorerToday);
  state.customers[5].manualBaqaya = [{ id: 'MBQ-101', amount: 1500, date: '2026-11-01' }];
  return state;
}
function scorerRows(state) {
  const result = buildSmartDuesRecovery(state, scorerToday);
  const rows = {};
  for (const group of result.groups) {
    for (const row of group.customers) rows[row.name] = row;
  }
  return { result, rows };
}

// --- Relative-month picker fixture (render tests) ---------------------
// Same shape as the scorer fixture, but months relative to the real
// clock so the tiers hold whenever the test runs: High always High
// (75–80, floored), Medium always Medium (46–58), Low always Low
// (23–28), Long always High 75 at the floor with both high-balance
// tiers. The Low bill is due on the 28th so its overdue days stay
// 0–3 (never past the 30-day overdue step); the Long bills sit 3–4
// months back so the oldest is always 90+ days overdue.
const now = new Date();
const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
const monthOffset = (n) => {
  const d = new Date(pkt.getFullYear(), pkt.getMonth() + n, 1);
  return d.toISOString().slice(0, 7);
};
const M = monthOffset(0);
const M1 = monthOffset(-1);
const M2 = monthOffset(-2);
const M3 = monthOffset(-3);
const M4 = monthOffset(-4);
function pickerState() {
  let state = createInitialState(['High One', 'Medium Two', 'Low Three', 'Long Four', 'Settled Five', 'Baqaya Six']);
  const [h, m, l, lo, s] = state.customers.map((c) => c.id);
  state.customers[0].monthlySellingAmount = 5000;
  state.customers[1].monthlySellingAmount = 2500;
  state.customers[2].monthlySellingAmount = 500;
  state.customers[3].monthlySellingAmount = 1000;
  const bill = (id, month, amount, dueDay = '05') => {
    state = saveBillMonth(state, id, { month, dueAmount: String(amount), status: 'pending', dueDate: `${month}-${dueDay}` }, now);
  };
  for (const month of [M2, M1, M]) bill(h, month, 20000);
  bill(m, M, 10000);
  bill(l, M, 1000, '28');
  bill(lo, M4, 1000);
  bill(lo, M3, 1000);
  bill(s, M, 1000);
  state = addPayment(state, s, M, { date: `${M}-06`, amount: '1000', method: 'Cash' }, now);
  state.customers[5].manualBaqaya = [{ id: 'MBQ-101', amount: 1500, date: `${M}-01` }];
  return state;
}
// Card segments of the picker HTML, in render order. The card tag is
// `<button type="button" class="qc-customer-card ...">`, so split on
// the class attribute itself, not on `<button class=`.
function cardSegments(pickerHtml) {
  return pickerHtml
    .split('class="qc-customer-card')
    .slice(1)
    .map((seg) => {
      const id = (seg.match(/data-customer-id="([^"]+)"/) || [])[1];
      const name = (seg.match(/<span class="qc-cust-name">([^<]+)<\/span>/) || [])[1];
      return { id, name, html: seg };
    });
}

// --- Pins: the scorer itself is unchanged -----------------------------

test('scorer pins: exact scores and tiers for the four fixture customers', () => {
  const { result, rows } = scorerRows(scorerState());
  assert.equal(result.totalCustomers, 4);
  assert.equal(rows['High One'].priorityScore, 80);
  assert.equal(rows['High One'].group, 'High Priority');
  assert.deepEqual(rows['High One'].components, { amount: 30, overdue: 25, history: 15, latePayments: 0, customerValue: 10 });
  // Dues Recovery Overhaul: Long Four's raw 56 is floored to 75 High
  // — 2 unpaid bills and 97 days overdue both trigger the floor.
  // The components are unchanged (the floor is not a component), and
  // the floor reason is spelled out on the row.
  assert.equal(rows['Long Four'].priorityScore, 75);
  assert.equal(rows['Long Four'].group, 'High Priority');
  assert.equal(rows['Long Four'].highPriorityFloor, true);
  assert.ok(rows['Long Four'].reasons.some(reason => reason.startsWith('High-priority floor:')));
  assert.equal(rows['Medium Two'].priorityScore, 46);
  assert.equal(rows['Medium Two'].group, 'Medium Priority');
  assert.equal(rows['Low Three'].priorityScore, 28);
  assert.equal(rows['Low Three'].group, 'Low Priority');
  assert.match(result.formula, /High ≥75; Medium 35–74; Low <35/);
});

test('scorer pins: reasons are verbatim sentences, settled and baqaya-only customers have no row', () => {
  const { rows } = scorerRows(scorerState());
  assert.equal(rows['High One'].reasons[0], 'Outstanding PKR 60,000 (+30 amount points).');
  assert.equal(rows['Long Four'].reasons[1], '97 days overdue (+25 points).');
  assert.ok(rows['Medium Two'].reasons.length >= 4);
  assert.equal(rows['Settled Five'], undefined, 'a customer paid in full has no scorer row');
  assert.equal(rows['Baqaya Six'], undefined, 'a baqaya-only customer has no scorer row');
  assert.equal(rows['High One'].openBillCount, 3);
  assert.equal(rows['High One'].longestOverdueDays, 66);
  assert.equal(rows['High One'].oldestDueDate, '2026-09-05');
  assert.equal(rows['Long Four'].openBillCount, 2);
  assert.equal(rows['Long Four'].longestOverdueDays, 97);
});

// --- Pins: the pure QC-2 module ---------------------------------------

test('qc2 sort order mapping: oldest only when asked, anything else is the default', async () => {
  const mod = await qc2();
  assert.equal(mod.QC2_SORT_AMOUNT, 'amount');
  assert.equal(mod.QC2_SORT_OLDEST, 'oldest');
  assert.equal(mod.qc2SortOrderFromValue('oldest'), 'oldest');
  assert.equal(mod.qc2SortOrderFromValue('amount'), 'amount');
  assert.equal(mod.qc2SortOrderFromValue('bogus'), 'amount');
  assert.equal(mod.qc2SortOrderFromValue(undefined), 'amount');
  assert.equal(mod.qc2SortOrderFromValue(null), 'amount');
});

test('qc2 tier mapping: scorer group strings to high/medium/low, unknown to null', async () => {
  const mod = await qc2();
  assert.equal(mod.qc2PriorityTier('High Priority'), 'high');
  assert.equal(mod.qc2PriorityTier('Medium Priority'), 'medium');
  assert.equal(mod.qc2PriorityTier('Low Priority'), 'low');
  assert.equal(mod.qc2PriorityTier('bogus'), null);
  assert.equal(mod.qc2PriorityTier(undefined), null);
  assert.equal(mod.qc2PriorityTier(null), null);
  assert.deepEqual(mod.QC2_PRIORITY_LABEL_KEYS, {
    high: 'qc2_priority_high',
    medium: 'qc2_priority_medium',
    low: 'qc2_priority_low',
  });
  assert.equal(mod.QC2_PRIORITY_BADGE_CLASSES.high, 'ds-chip ds-chip--danger');
  assert.equal(mod.QC2_PRIORITY_BADGE_CLASSES.medium, 'ds-chip ds-chip--warning');
  assert.equal(mod.QC2_PRIORITY_BADGE_CLASSES.low, 'ds-chip');
});

test('qc2 top reason is the scorer reasons[0] verbatim, null when there is none', async () => {
  const mod = await qc2();
  const { rows } = scorerRows(scorerState());
  assert.equal(mod.qc2TopReason(rows['High One']), 'Outstanding PKR 60,000 (+30 amount points).');
  assert.equal(mod.qc2TopReason({ reasons: [] }), null);
  assert.equal(mod.qc2TopReason({}), null);
  assert.equal(mod.qc2TopReason(null), null);
  assert.equal(mod.qc2TopReason(undefined), null);
});

test('qc2 priority map flattens the scorer groups by customer id', async () => {
  const mod = await qc2();
  const { result, rows } = scorerRows(scorerState());
  const byId = mod.qc2PriorityByCustomerId(result);
  assert.ok(byId instanceof Map);
  assert.equal(byId.size, 4);
  assert.equal(byId.get(rows['High One'].customerId).priorityScore, 80);
  assert.equal(byId.get(rows['Long Four'].customerId).group, 'High Priority');
  assert.equal(mod.qc2PriorityByCustomerId(null).size, 0);
  assert.equal(mod.qc2PriorityByCustomerId({}).size, 0);
  assert.equal(mod.qc2PriorityByCustomerId({ groups: 'nope' }).size, 0);
});

test('qc2 high-balance tiers: 2+ open months and 90+ days, boundaries pinned', async () => {
  const mod = await qc2();
  const { rows } = scorerRows(scorerState());
  // High One: 3 open months, 66 days -> multi-month only.
  assert.deepEqual(mod.qc2HighBalanceTiers(rows['High One']), ['multi-month']);
  // Long Four: 2 open months, 97 days -> both tiers.
  assert.deepEqual(mod.qc2HighBalanceTiers(rows['Long Four']), ['multi-month', 'long-overdue']);
  // Medium / Low: 1 open month, 5 days -> no tier.
  assert.deepEqual(mod.qc2HighBalanceTiers(rows['Medium Two']), []);
  assert.deepEqual(mod.qc2HighBalanceTiers(rows['Low Three']), []);
  // Boundaries, pinned: 1 month is not multi-month, 2 is; 89 days
  // is not long-overdue, 90 is.
  assert.deepEqual(mod.qc2HighBalanceTiers({ openBillCount: 1, longestOverdueDays: 90 }), ['long-overdue']);
  assert.deepEqual(mod.qc2HighBalanceTiers({ openBillCount: 2, longestOverdueDays: 89 }), ['multi-month']);
  assert.deepEqual(mod.qc2HighBalanceTiers({ openBillCount: 2, longestOverdueDays: 90 }), ['multi-month', 'long-overdue']);
  assert.deepEqual(mod.qc2HighBalanceTiers(null), []);
  assert.deepEqual(mod.qc2HighBalanceTiers({}), []);
  assert.deepEqual(mod.QC2_HIGH_BALANCE_TIER_LABEL_KEYS, {
    'multi-month': 'qc2_tier_multi_month',
    'long-overdue': 'qc2_tier_long_overdue',
  });
});

test('qc2 card composition: one object per card, null when the scorer has no row', async () => {
  const mod = await qc2();
  const { rows } = scorerRows(scorerState());
  const high = mod.qc2CardPriority(rows['High One']);
  assert.equal(high.tier, 'high');
  assert.equal(high.badgeClass, 'ds-chip ds-chip--danger');
  assert.equal(high.labelKey, 'qc2_priority_high');
  assert.equal(high.reason, 'Outstanding PKR 60,000 (+30 amount points).');
  assert.deepEqual(high.tierKeys, ['multi-month']);
  const low = mod.qc2CardPriority(rows['Low Three']);
  assert.equal(low.tier, 'low');
  assert.equal(low.badgeClass, 'ds-chip');
  assert.deepEqual(low.tierKeys, []);
  assert.equal(mod.qc2CardPriority(null), null);
  assert.equal(mod.qc2CardPriority(undefined), null);
});

test('qc2 oldest-first sort: oldest unpaid month first, nulls last, dashboard tie-break, no mutation', async () => {
  const mod = await qc2();
  const state = pickerState();
  const pool = getPendingCollectionCustomers(state, '', 'all-dues');
  // Pool entries now carry earliestUnpaidMonth (added by QC-2).
  const byName = {};
  for (const e of pool) byName[e.name] = e;
  assert.equal(byName['Long Four'].earliestUnpaidMonth, M4);
  assert.equal(byName['High One'].earliestUnpaidMonth, M2);
  assert.equal(byName['Medium Two'].earliestUnpaidMonth, M);
  assert.equal(byName['Low Three'].earliestUnpaidMonth, M);
  assert.equal(byName['Baqaya Six'].earliestUnpaidMonth, null);
  const before = JSON.stringify(pool);
  const sorted = mod.qc2SortByOldestFirst(pool);
  assert.deepEqual(sorted.map((e) => e.name), ['Long Four', 'High One', 'Medium Two', 'Low Three', 'Baqaya Six']);
  assert.equal(JSON.stringify(pool), before, 'the sort must not mutate the pool');
  assert.notEqual(sorted, pool, 'the sort must return a new array');
  // Tie-break: same oldest month -> larger dues first.
  assert.deepEqual(
    mod.qc2SortByOldestFirst([
      { name: 'b', earliestUnpaidMonth: '2026-11', totalDues: 100, customerNumber: 2 },
      { name: 'a', earliestUnpaidMonth: '2026-11', totalDues: 100, customerNumber: 1 },
      { name: 'c', earliestUnpaidMonth: '2026-11', totalDues: 500, customerNumber: 3 },
    ]).map((e) => e.name),
    ['c', 'a', 'b'],
  );
  // Sort dispatcher: oldest sorts, anything else returns the pool untouched.
  assert.deepEqual(mod.qc2SortCollectionEntries(pool, 'oldest').map((e) => e.name), ['Long Four', 'High One', 'Medium Two', 'Low Three', 'Baqaya Six']);
  assert.equal(mod.qc2SortCollectionEntries(pool, 'amount'), pool, 'the default order must be the pool itself, untouched');
  assert.equal(mod.qc2SortCollectionEntries(pool, 'bogus'), pool);
});

// --- Pins: the QC picker cards -----------------------------------------

test('picker default order is unchanged when the sort is untouched (highest dues first)', () => {
  const state = pickerState();
  const picked = renderQuickCollectPickerHtml(state, '', 'all-dues');
  assert.deepEqual(picked.customers.map((c) => c.name), ['High One', 'Medium Two', 'Long Four', 'Baqaya Six', 'Low Three']);
  assert.deepEqual(cardSegments(picked.html).map((c) => c.name), ['High One', 'Medium Two', 'Long Four', 'Baqaya Six', 'Low Three']);
});

test('picker oldest-first toggle reorders by oldest unpaid bill month, and back', () => {
  const state = pickerState();
  const oldest = renderQuickCollectPickerHtml(state, '', 'all-dues', null, '', { sortOrder: 'oldest' });
  assert.deepEqual(oldest.customers.map((c) => c.name), ['Long Four', 'High One', 'Medium Two', 'Low Three', 'Baqaya Six']);
  assert.deepEqual(cardSegments(oldest.html).map((c) => c.name), ['Long Four', 'High One', 'Medium Two', 'Low Three', 'Baqaya Six']);
  const back = renderQuickCollectPickerHtml(state, '', 'all-dues', null, '', { sortOrder: 'amount' });
  assert.deepEqual(back.customers.map((c) => c.name), ['High One', 'Medium Two', 'Long Four', 'Baqaya Six', 'Low Three']);
});

test('picker cards carry the tier badge and the scorer reason verbatim', () => {
  const state = pickerState();
  const cards = cardSegments(renderQuickCollectPickerHtml(state, '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  assert.ok(byName['High One'].html.includes('ds-chip--danger'), 'High card must carry the danger badge');
  assert.ok(byName['High One'].html.includes('High priority'), 'High card must label the tier');
  assert.ok(byName['High One'].html.includes('Outstanding PKR 60,000 (+30 amount points).'), 'High card must show the scorer reason verbatim');
  assert.ok(byName['Medium Two'].html.includes('ds-chip--warning'), 'Medium card must carry the warning badge');
  assert.ok(byName['Medium Two'].html.includes('Medium priority'), 'Medium card must label the tier');
  assert.ok(byName['Low Three'].html.includes('Low priority'), 'Low card must label the tier');
  assert.ok(!byName['Low Three'].html.includes('ds-chip--danger') && !byName['Low Three'].html.includes('ds-chip--warning'), 'Low card must use the neutral badge');
  assert.ok(byName['Long Four'].html.includes('Outstanding PKR 2,000 (+12 amount points).'), 'Long card must show its own reason');
});

test('picker cards carry the high-balance tier labels and the card accent', () => {
  const state = pickerState();
  const cards = cardSegments(renderQuickCollectPickerHtml(state, '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  assert.ok(byName['High One'].html.includes('2+ months arrears'), '3 open months must label 2+ months arrears');
  assert.ok(byName['Long Four'].html.includes('2+ months arrears'), '2 open months must label 2+ months arrears');
  assert.ok(byName['Long Four'].html.includes('90+ days overdue'), '97-day oldest due must label 90+ days overdue');
  assert.ok(!byName['Medium Two'].html.includes('2+ months arrears') && !byName['Medium Two'].html.includes('90+ days overdue'), '1 open month, 5 days overdue must carry no tier label');
  assert.ok(!byName['Low Three'].html.includes('2+ months arrears'), 'Low card must carry no tier label');
  assert.ok(byName['High One'].html.includes('qc2-tier-high'), 'High-balance card must carry the accent class');
  assert.ok(byName['Long Four'].html.includes('qc2-tier-high'), 'Long-overdue card must carry the accent class');
  assert.ok(!byName['Medium Two'].html.includes('qc2-tier-high'), 'No-tier card must not carry the accent class');
});

test('picker card with no scorer row shows no tier and no reason, never a guessed value', () => {
  const state = pickerState();
  const cards = cardSegments(renderQuickCollectPickerHtml(state, '', 'all-dues').html);
  const byName = {};
  for (const c of cards) byName[c.name] = c;
  assert.ok(byName['Baqaya Six'], 'the baqaya-only customer must still be listed');
  assert.ok(!byName['Baqaya Six'].html.includes('qc2-priority'), 'baqaya-only card must show no priority row');
  assert.ok(!byName['Baqaya Six'].html.includes('High priority') && !byName['Baqaya Six'].html.includes('Medium priority') && !byName['Baqaya Six'].html.includes('Low priority'), 'baqaya-only card must show no tier label');
  assert.ok(!byName['Baqaya Six'].html.includes('2+ months arrears') && !byName['Baqaya Six'].html.includes('90+ days overdue'), 'baqaya-only card must show no tier label');
  assert.ok(!byName['Baqaya Six'].html.includes('qc2-tier-high'), 'baqaya-only card must show no tier accent');
});

// --- Pins: the sort control in the picker ------------------------------

test('sort dropdown sits in the picker step above the search, default Highest dues first', () => {
  const step = html.indexOf('id="quickCollectStepPick"');
  assert.ok(step >= 0, 'missing picker step');
  const selectTags = [...html.matchAll(/<select[^>]*>/g)].map((m) => m[0]);
  const selectTag = selectTags.find((tag) => tag.includes('data-qc-sort-order'));
  assert.ok(selectTag, 'missing sort-order select');
  const selectIdx = html.indexOf(selectTag);
  assert.ok(selectIdx > step, 'sort dropdown must sit inside the picker step');
  const search = html.indexOf('id="quickCollectSearchInput"');
  assert.ok(selectIdx < search, 'sort dropdown must sit ABOVE the search input');
  assert.ok(!/id="/.test(selectTag), 'sort dropdown must be class/data-attribute wired — no new element id');
  assert.ok(html.includes('value="amount" selected'), 'Highest dues first must be the selected default');
  for (const value of ['amount', 'oldest']) {
    assert.ok(html.includes(`value="${value}"`), `missing sort option ${value}`);
  }
  const label = html.indexOf('qc2_sort_label');
  assert.ok(label > step && label < search, 'sort label must sit above the search too');
});

test('sort wiring: change maps the value through qc2SortOrderFromValue and re-renders', () => {
  assert.ok(qcSrc.includes("querySelector('[data-qc-sort-order]')"), 'missing class-found lookup for the sort dropdown');
  assert.ok(qcSrc.includes('qc2SortOrderFromValue('), 'sort change must map its value through qc2SortOrderFromValue');
  assert.ok(qcSrc.includes('activeSortOrder'), 'the picker must keep the chosen sort order in state');
  assert.ok(qcSrc.includes('sortOrder: activeSortOrder'), 'renderList must pass the chosen sort order to the picker renderer');
  assert.ok(qcSrc.includes('buildSmartDuesRecovery'), 'the picker must read the existing scorer');
  assert.ok(qcSrc.includes('qc2PriorityByCustomerId'), 'the picker must flatten the scorer groups by customer id');
});

// --- Pins: Field Mode cards --------------------------------------------

test('field mode builds the same priority map and renders the badge, reason and tiers', () => {
  assert.ok(fieldSrc.includes('buildSmartDuesRecovery'), 'field mode must read the existing scorer');
  assert.ok(fieldSrc.includes('qc2PriorityByCustomerId'), 'field mode must flatten the scorer groups by customer id');
  assert.ok(fieldSrc.includes('qc2CardPriority'), 'field mode must use the shared card composition');
  assert.ok(fieldSrc.includes('renderList(visible, statusById, priorityById)'), 'field mode must pass the priority map into its list renderer');
  assert.ok(fieldSrc.includes('qc2-priority'), 'field mode cards must render the priority row');
  assert.ok(fieldSrc.includes('qc2-tier-high'), 'field mode cards must carry the high-balance accent');
});

// --- Pins: i18n ---------------------------------------------------------

test('qc2_ keys exist in EN and UR, with Urdu script in the Urdu values', () => {
  assert.equal(en.qc2_sort_label, 'Sort by');
  assert.equal(en.qc2_sort_amount, 'Highest dues first');
  assert.equal(en.qc2_sort_oldest, 'Oldest due first');
  assert.equal(en.qc2_priority_high, 'High priority');
  assert.equal(en.qc2_priority_medium, 'Medium priority');
  assert.equal(en.qc2_priority_low, 'Low priority');
  assert.equal(en.qc2_tier_multi_month, '2+ months arrears');
  assert.equal(en.qc2_tier_long_overdue, '90+ days overdue');
  for (const key of ['qc2_sort_label', 'qc2_sort_amount', 'qc2_sort_oldest', 'qc2_priority_high', 'qc2_priority_medium', 'qc2_priority_low', 'qc2_tier_multi_month', 'qc2_tier_long_overdue']) {
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR value for ${key}`);
    assert.ok(URDU.test(ur[key]), `UR value for ${key} must carry Urdu script`);
  }
});

// --- Pins: CSS -----------------------------------------------------------

test('qc2 card rules are token-only and reuse the existing chip variants', () => {
  const start = stylesSrc.indexOf('.qc2-priority {');
  assert.ok(start >= 0, 'missing .qc2-priority rule');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('display: flex'), 'priority row must be flex (badge + reason side by side)');
  // The QC-2 rules are one contiguous block ending with the card
  // accent rule — scope the hex check to exactly that block, and
  // check the ratchet the way it is defined: no NEW hex. A hex that
  // already appears elsewhere in the sheet (e.g. the #64748b
  // fallback inside var(--text-muted, ...), the same fallback
  // .qc-cust-meta uses) adds no distinct hex.
  const accentStart = stylesSrc.indexOf('.qc2-tier-high', start);
  assert.ok(accentStart >= 0, 'missing high-balance card accent rule');
  const added = stylesSrc.slice(start, stylesSrc.indexOf('}', accentStart) + 1);
  const addedHex = [...new Set(added.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
  const rest = stylesSrc.slice(0, start) + stylesSrc.slice(stylesSrc.indexOf('}', accentStart) + 1);
  for (const hex of addedHex) {
    assert.ok(rest.includes(hex), `QC-2 CSS introduces new hex ${hex} — reuse tokens`);
  }
  assert.ok(added.includes('var(--color-danger)'), 'the card accent must use the danger token');
});

// --- Pins: no new store key, no new element id ---------------------------

test('qc2 adds no store key and no new element id', () => {
  assert.ok(!/shahdara_[a-z_]*qc2/.test(qcSrc + fieldSrc), 'no new store key for QC-2');
  assert.ok(!/id="qc2/.test(html), 'no new element id for QC-2');
});
