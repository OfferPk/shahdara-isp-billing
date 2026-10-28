// SISP-27: Upstream ISP Bandwidth Bill & Fixed Monthly Overhead Tracker.
// Templates post into the expense ledger via phase3.js addExpense, so the
// profit/share effect comes entirely from the existing
// buildPartnerShareReport computation — this module invents no second
// profit formula. Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERHEAD_KEY,
  UPSTREAM_TEMPLATE_ID,
  OVERHEAD_TEMPLATES,
  sanitizeOverheads,
  resolveOverheadTemplates,
  updateOverheadDefault,
  postOverhead,
  overheadPostingFor,
  bandwidthDueStatus,
} from '../fixed-overheads.js';
import { buildPartnerShareReport, PARTNER_SHARE_RATE, EXPENSE_CATEGORIES } from '../phase3.js';

const REF = new Date('2026-10-27T12:00:00Z');

// One customer, one bill, one Rs. 100,000 receipt dated 2026-10-05.
function revenueState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 100000, method: 'Cash' }] },
      ] },
    ],
    expenses: [],
  };
}

test('storage key and four templates with valid expense categories', () => {
  assert.equal(OVERHEAD_KEY, 'sisp_overheads_v1');
  assert.equal(UPSTREAM_TEMPLATE_ID, 'upstream-bandwidth');
  assert.deepEqual(
    OVERHEAD_TEMPLATES.map(template => [template.id, template.label, template.category]),
    [
      ['upstream-bandwidth', 'Upstream Bandwidth Link', 'Nayatel bill'],
      ['olt-wapda', 'OLT Room WAPDA Bill', 'Electricity'],
      ['lineman-salary', 'Lineman Salary', 'Salary — Saad'],
      ['maintenance-reserve', 'Maintenance Reserve', 'Other expenses'],
    ],
  );
  for (const template of OVERHEAD_TEMPLATES) {
    assert.ok(EXPENSE_CATEGORIES.includes(template.category), `${template.category} must be a valid expense category`);
  }
  assert.equal(PARTNER_SHARE_RATE, 0.5);
});

test('PINNED: posting a Rs. 35,000 upstream bandwidth bill cuts profit by 35,000 and each 50% share by 17,500', () => {
  const before = buildPartnerShareReport(revenueState(), '2026-10', REF);
  assert.equal(before.summary.revenue, 100000);
  assert.equal(before.summary.expenses, 0);
  assert.equal(before.summary.profit, 100000);
  assert.equal(before.summary.share, 50000);

  const { state, overheads } = postOverhead(revenueState(), { templates: [], postings: [] }, 'upstream-bandwidth', {
    amount: 35000,
    date: '2026-10-10',
  });
  assert.equal(state.expenses.length, 1);
  assert.equal(state.expenses[0].category, 'Nayatel bill');
  assert.equal(state.expenses[0].amount, 35000);
  assert.equal(state.expenses[0].date, '2026-10-10');
  assert.equal(overheads.postings.length, 1);
  assert.equal(overheads.postings[0].templateId, 'upstream-bandwidth');
  assert.equal(overheads.postings[0].month, '2026-10');
  assert.equal(overheads.postings[0].expenseId, state.expenses[0].id);

  const after = buildPartnerShareReport(state, '2026-10', REF);
  assert.equal(after.summary.revenue, 100000);
  assert.equal(after.summary.expenses, 35000);
  assert.equal(after.summary.profit, 65000);
  assert.equal(after.summary.share, 32500);
  assert.equal(before.summary.profit - after.summary.profit, 35000);
  assert.equal(before.summary.share - after.summary.share, 17500);
});

test('posting into one month leaves other months untouched', () => {
  const { state } = postOverhead(revenueState(), { templates: [], postings: [] }, 'olt-wapda', {
    amount: 5000,
    date: '2026-09-15',
  });
  const october = buildPartnerShareReport(state, '2026-10', REF);
  assert.equal(october.summary.expenses, 0);
  assert.equal(october.summary.profit, 100000);
  const september = buildPartnerShareReport(state, '2026-09', REF);
  assert.equal(september.summary.expenses, 5000);
});

test('duplicate live posting for the same template + month is refused; another month is fine', () => {
  const first = postOverhead(revenueState(), { templates: [], postings: [] }, 'upstream-bandwidth', {
    amount: 35000,
    date: '2026-10-10',
  });
  assert.throws(
    () => postOverhead(first.state, first.overheads, 'upstream-bandwidth', { amount: 35000, date: '2026-10-20' }),
    /already posted for 2026-10/,
  );
  const otherMonth = postOverhead(first.state, first.overheads, 'upstream-bandwidth', {
    amount: 35000,
    date: '2026-11-10',
  });
  assert.equal(otherMonth.overheads.postings.length, 2);
});

test('a posting whose expense was deleted is stale and does not block a re-post', () => {
  const first = postOverhead(revenueState(), { templates: [], postings: [] }, 'upstream-bandwidth', {
    amount: 35000,
    date: '2026-10-10',
  });
  const stateWithoutExpense = { ...first.state, expenses: [] };
  assert.equal(overheadPostingFor(first.overheads, stateWithoutExpense, 'upstream-bandwidth', '2026-10'), null);
  const reposted = postOverhead(stateWithoutExpense, first.overheads, 'upstream-bandwidth', {
    amount: 36000,
    date: '2026-10-12',
  });
  assert.equal(reposted.state.expenses.length, 1);
  assert.equal(reposted.state.expenses[0].amount, 36000);
});

test('posting validation: unknown template, bad amount, bad date', () => {
  const empty = { templates: [], postings: [] };
  assert.throws(() => postOverhead(revenueState(), empty, 'nope', { amount: 100, date: '2026-10-10' }), /Unknown overhead template/);
  assert.throws(() => postOverhead(revenueState(), empty, 'olt-wapda', { amount: 0, date: '2026-10-10' }), /positive overhead amount/);
  assert.throws(() => postOverhead(revenueState(), empty, 'olt-wapda', { amount: 100, date: '2026-13-10' }), /valid payment date/);
  assert.throws(() => postOverhead(revenueState(), empty, 'olt-wapda', { amount: 100, date: '' }), /valid payment date/);
});

test('bandwidth due banner: due when unpaid, cleared by posting or by a direct ledger expense', () => {
  const state = revenueState();
  const empty = { templates: [], postings: [] };
  const unpaid = bandwidthDueStatus(state, empty, REF);
  assert.equal(unpaid.due, true);
  assert.equal(unpaid.month, '2026-10');
  assert.equal(unpaid.paidVia, null);

  const posted = postOverhead(state, empty, 'upstream-bandwidth', { amount: 35000, date: '2026-10-10' });
  const viaPosting = bandwidthDueStatus(posted.state, posted.overheads, REF);
  assert.equal(viaPosting.due, false);
  assert.equal(viaPosting.paidVia, 'posting');

  const directState = { ...state, expenses: [{ id: 'e9', date: '2026-10-03', amount: 35000, category: 'Nayatel bill' }] };
  const viaExpense = bandwidthDueStatus(directState, empty, REF);
  assert.equal(viaExpense.due, false);
  assert.equal(viaExpense.paidVia, 'expense');

  // A September Nayatel bill does not clear October.
  const wrongMonth = { ...state, expenses: [{ id: 'e9', date: '2026-09-03', amount: 35000, category: 'Nayatel bill' }] };
  assert.equal(bandwidthDueStatus(wrongMonth, empty, REF).due, true);
});

test('default amounts: resolve applies stored overrides; update validates and clears', () => {
  const resolved = resolveOverheadTemplates({ templates: [{ id: 'upstream-bandwidth', defaultAmount: 35000 }], postings: [] });
  assert.equal(resolved.find(template => template.id === 'upstream-bandwidth').defaultAmount, 35000);
  assert.equal(resolved.find(template => template.id === 'olt-wapda').defaultAmount, null);

  const updated = updateOverheadDefault({ templates: [], postings: [] }, 'olt-wapda', 12000);
  assert.deepEqual(updated.templates, [{ id: 'olt-wapda', defaultAmount: 12000 }]);
  const cleared = updateOverheadDefault(updated, 'olt-wapda', null);
  assert.deepEqual(cleared.templates, []);
  assert.throws(() => updateOverheadDefault({ templates: [], postings: [] }, 'olt-wapda', 0), /greater than zero/);
  assert.throws(() => updateOverheadDefault({ templates: [], postings: [] }, 'nope', 100), /Unknown overhead template/);
});

test('sanitize drops unknown templates, bad amounts and bad dates, keeps valid rows', () => {
  const cleaned = sanitizeOverheads({
    templates: [
      { id: 'upstream-bandwidth', defaultAmount: 35000 },
      { id: 'nope', defaultAmount: 100 },
      { id: 'olt-wapda', defaultAmount: -5 },
      { id: 'olt-wapda', defaultAmount: 8000 },
    ],
    postings: [
      { id: 'x1', templateId: 'upstream-bandwidth', month: '2026-10', expenseId: 'e1', amount: 35000, date: '2026-10-10', note: 'ok' },
      { id: 'x2', templateId: 'nope', month: '2026-10', expenseId: 'e2', amount: 100, date: '2026-10-10' },
      { id: 'x3', templateId: 'olt-wapda', month: '2026-13', expenseId: 'e3', amount: 100, date: '2026-13-01' },
      { id: 'x4', templateId: 'olt-wapda', month: '2026-10', expenseId: 'e4', amount: 0, date: '2026-10-05' },
    ],
  });
  assert.deepEqual(cleaned.templates, [
    { id: 'upstream-bandwidth', defaultAmount: 35000 },
    { id: 'olt-wapda', defaultAmount: 8000 },
  ]);
  assert.equal(cleaned.postings.length, 1);
  assert.equal(cleaned.postings[0].id, 'x1');
  assert.deepEqual(sanitizeOverheads(null), { templates: [], postings: [] });
  assert.deepEqual(sanitizeOverheads([]), { templates: [], postings: [] });
  assert.deepEqual(sanitizeOverheads('junk'), { templates: [], postings: [] });
});
