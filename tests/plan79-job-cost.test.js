/**
 * plan79-job-cost.test.js — Plan 79: installation job cost sheet.
 * Pins:
 * - every job sheet carries exactly one customer, one date, and
 *   one status; half-formed records are refused outright, never
 *   stored half-formed;
 * - materials, labour, transport, fee, and margin are shown
 *   separately and sum correctly on the same fixture, in integer
 *   cents;
 * - a job with no cost entries shows as uncosted, never as
 *   zero-cost; a costed sheet with no fee recorded has a total
 *   cost but a null margin, never an invented one;
 * - completing a sheet changes only its status — it posts no
 *   expense, raises no bill, and moves no stock, so the module
 *   holds no bill, payment, expense, or stock-total field;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, stock, or expense
 * record is ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOB_MATERIAL_ITEMS,
  JOB_MATERIAL_LABELS,
  JOB_STATUSES,
  JOB_STATUS_LABELS,
  validJobDate,
  jobMohallaKey,
  normalizeJob,
  normalizeJobList,
  findJob,
  upsertJob,
  removeJob,
  addJobMaterial,
  completeJob,
  reopenJob,
  jobsFiltered,
  buildJobCosts,
  buildJobSummary,
  formatJobCents,
  jobSummaryText,
  jobHtml,
  jobCsv,
  jobFilename,
} from '../job-cost.js';

const base = {
  id: 'JOB-001',
  customerId: 'C-001',
  customerName: 'Ahmed',
  onboardingId: 'ONB-7',
  date: '2026-01-05',
  mohalla: 'Bani',
  materials: [
    { item: 'drop_cable', qty: 40, unitCostCents: 1200 },
    { item: 'connector', qty: 4, unitCostCents: 2500 },
  ],
  labourMinutes: 90,
  labourCostCents: 20000,
  transportCostCents: 5000,
  feeCents: 100000,
  status: 'draft',
};

test('strict dates: impossible dates are refused, valid dates kept', () => {
  assert.equal(validJobDate('2026-02-30'), null);
  assert.equal(validJobDate('2026-01-05'), '2026-01-05');
  assert.equal(validJobDate('not a date'), null);
  assert.equal(normalizeJob({ ...base, date: '2026-02-30' }), null);
});

test('mohalla canonical keys mirror the Plan T rule', () => {
  assert.equal(jobMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(jobMohallaKey('kishti'), 'KISHTII');
  assert.equal(jobMohallaKey('chamyaa'), 'CHAMYAAA');
  assert.equal(jobMohallaKey('Gulshan'), 'GULSHAN');
  assert.equal(jobMohallaKey(''), null);
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeJob({ ...base, id: '' }), null);
  assert.equal(normalizeJob({ ...base, customerId: '' }), null);
  assert.equal(normalizeJob({ ...base, status: 'done' }), null);
  assert.equal(normalizeJob({ ...base, materials: [{ item: 'onu', qty: 0, unitCostCents: 1000 }] }), null);
  assert.equal(normalizeJob({ ...base, materials: [{ item: 'onu', qty: 1, unitCostCents: -5 }] }), null);
  assert.equal(normalizeJob({ ...base, materials: [{ item: 'widget', qty: 1, unitCostCents: 100 }] }), null);
  assert.equal(normalizeJob({ ...base, labourCostCents: 'free' }), null);
  assert.equal(normalizeJob({ ...base, feeCents: -100 }), null);
});

test('materials, labour, transport, fee, and margin sum exactly', () => {
  const costs = buildJobCosts(base);
  // Materials: 40 × 1200 = 48000, 4 × 2500 = 10000 → 58000.
  assert.equal(costs.materialsCostCents, 58000);
  // Total: 58000 + 20000 + 5000 = 83000; margin: 100000 − 83000.
  assert.equal(costs.totalCostCents, 83000);
  assert.equal(costs.marginCents, 17000);
  assert.equal(costs.costed, true);
});

test('fractional quantities round to the nearest cent, never drift', () => {
  const job = { ...base, materials: [{ item: 'drop_cable', qty: 45.5, unitCostCents: 1200 }] };
  assert.equal(buildJobCosts(job).materialsCostCents, 54600);
  const thirds = { ...base, materials: [{ item: 'connector', qty: 3, unitCostCents: 33333 }] };
  assert.equal(buildJobCosts(thirds).materialsCostCents, 99999);
});

test('a job with no cost entries is uncosted, never zero-cost', () => {
  const bare = { id: 'JOB-002', customerId: 'C-002', date: '2026-01-06', status: 'draft', feeCents: 50000 };
  const costs = buildJobCosts(bare);
  assert.equal(costs.costed, false);
  assert.equal(costs.totalCostCents, null);
  assert.equal(costs.marginCents, null);
  assert.match(jobHtml([bare]), /Uncosted/);
});

test('a costed sheet with no fee recorded has a cost but no margin', () => {
  const noFee = { ...base, feeCents: null };
  const costs = buildJobCosts(noFee);
  assert.equal(costs.costed, true);
  assert.equal(costs.totalCostCents, 83000);
  assert.equal(costs.marginCents, null);
});

test('upsert, find, remove, and non-mutation', () => {
  const before = [base];
  const next = upsertJob(before, { ...base, id: 'JOB-002', customerId: 'C-002' });
  assert.equal(next.length, 2);
  assert.equal(before.length, 1);
  assert.equal(findJob(next, 'JOB-002').customerId, 'C-002');
  assert.equal(findJob(next, 'NOPE'), null);
  assert.equal(removeJob(next, 'JOB-001').length, 1);
  assert.equal(normalizeJobList([base, base]).length, 1);
});

test('complete and reopen move only the status', () => {
  const completed = completeJob([base], 'JOB-001');
  assert.equal(completed[0].status, 'complete');
  assert.equal(completeJob(completed, 'JOB-001')[0].status, 'complete');
  assert.equal(reopenJob(completed, 'JOB-001')[0].status, 'draft');
  assert.equal(reopenJob([base], 'JOB-001')[0].status, 'draft');
  // Completing changes nothing else on the sheet.
  assert.equal(completed[0].feeCents, 100000);
  assert.deepEqual(completed[0].materials, normalizeJob(base).materials);
});

test('materials append only with a valid line, to the named sheet only', () => {
  const withLine = addJobMaterial([base], 'JOB-001', { item: 'onu', qty: 1, unitCostCents: 30000 });
  assert.equal(withLine[0].materials.length, 3);
  assert.equal(buildJobCosts(withLine[0]).totalCostCents, 113000);
  assert.equal(addJobMaterial([base], 'JOB-001', { item: 'onu', qty: 0, unitCostCents: 30000 })[0].materials.length, 2);
  assert.equal(addJobMaterial([base], 'JOB-999', { item: 'onu', qty: 1, unitCostCents: 30000 })[0].materials.length, 2);
});

test('filters by status and mohalla, with __unassigned__ for no mohalla', () => {
  const list = [
    base,
    { ...base, id: 'JOB-002', customerId: 'C-002', mohalla: '', status: 'complete' },
    { ...base, id: 'JOB-003', customerId: 'C-003', mohalla: 'Kishti', status: 'draft' },
  ];
  assert.equal(jobsFiltered(list, { status: 'complete' }).length, 1);
  assert.equal(jobsFiltered(list, { mohalla: 'bani' }).length, 1);
  assert.equal(jobsFiltered(list, { mohalla: '__unassigned__' }).length, 1);
  // More Tab Operational Registries polish (§1): the filter
  // placeholder invites the word "Unassigned", so the folded word
  // (any case, with or without the "Mohalla" prefix) matches the
  // same no-mohalla rows as the literal sentinel.
  assert.equal(jobsFiltered(list, { mohalla: 'Unassigned' }).length, 1);
  assert.equal(jobsFiltered(list, { mohalla: 'unassigned' }).length, 1);
  assert.equal(jobsFiltered(list, { mohalla: 'Mohalla Unassigned' }).length, 1);
  assert.deepEqual(jobsFiltered(list, {}).map((job) => job.id), ['JOB-001', 'JOB-002', 'JOB-003']);
});

test('summary totals cover costed sheets only, never uncosted ones', () => {
  const list = [
    base,
    { id: 'JOB-002', customerId: 'C-002', date: '2026-01-06', status: 'draft', feeCents: 50000 },
  ];
  const summary = buildJobSummary(list);
  assert.equal(summary.total, 2);
  assert.equal(summary.uncosted, 1);
  assert.equal(summary.costed, 1);
  assert.equal(summary.totalCostCents, 83000);
  assert.equal(summary.totalMarginCents, 17000);
  assert.equal(summary.byMohalla.BANII.sheets, 1);
  assert.match(jobSummaryText(summary), /2 job sheets/);
});

test('no bill, payment, expense, or stock field is held by the module', () => {
  const entry = normalizeJob(base);
  const keys = Object.keys(entry);
  for (const forbidden of ['bill', 'billId', 'payment', 'paymentId', 'expense', 'expenseId', 'stockOnHand', 'stockTotal', 'stockQty']) {
    assert.ok(!keys.includes(forbidden), `must not hold ${forbidden}`);
  }
  assert.deepEqual(Object.keys(entry.materials[0]).sort(), ['item', 'label', 'lineCents', 'qty', 'unitCostCents']);
  assert.ok(JOB_MATERIAL_ITEMS.includes('drop_cable'));
  assert.equal(JOB_MATERIAL_LABELS.drop_cable, 'Drop cable');
  assert.deepEqual(JOB_STATUSES, ['draft', 'complete']);
  assert.equal(JOB_STATUS_LABELS.complete, 'Complete');
});

test('cents are used as-is on re-read, never inflated a hundredfold', () => {
  const stored = normalizeJob(base);
  const reread = normalizeJob(stored);
  assert.equal(reread.feeCents, 100000);
  assert.equal(reread.materials[0].lineCents, 48000);
  assert.equal(formatJobCents(17000), 'Rs. 170');
  assert.equal(formatJobCents(-500), '-Rs. 5');
  assert.equal(formatJobCents(null), 'Not recorded');
});

test('HTML escaping, CSV quoting, and filename', () => {
  const evil = { ...base, customerName: '<script>alert(1)</script>', note: 'a,"b"' };
  assert.doesNotMatch(jobHtml([evil]), /<script>/);
  assert.match(jobHtml([evil]), /&lt;script&gt;/);
  assert.match(jobCsv([evil]), /Rs\. 170/);
  assert.equal(jobFilename(), 'job-cost-sheets.csv');
});
