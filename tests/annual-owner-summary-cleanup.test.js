/**
 * annual-owner-summary-cleanup.test.js — Annual Owner Summary /
 * Enquiries / Deposits / Loan Tracker cleanup (2026-11-13).
 * Pins:
 * - the annual section moved into the Reports tab (after Growth &
 *   Finance Matrix), while the three registries stay in Analytics;
 * - the KPI grid reads the same view as the table, so the two can
 *   never disagree again; the badge is derived from view.liveMonths
 *   (never hardcoded), with the December-unfrozen part only when
 *   December has no frozen snapshot;
 * - the plain-words summary appears exactly once, collapsed in a
 *   <details>, and no #annualSummarySummary element or assignment
 *   remains;
 * - at 0 records the filter/mutation/export rows hide by TOTAL
 *   entries, while the + Add creation forms stay reachable;
 * - mohalla placeholders read 'Filter by mohalla (or Unassigned)'
 *   and no plan number leaks into the draft dropdown or sections;
 * - the filter checkboxes sit on one line via the scoped flex
 *   label; the shared .table-scroll rule keeps cells on one line
 *   with a sticky first column.
 * Synthetic data only; no live record is ever changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildAnnualSummary,
  annualSummaryText,
  annualSummaryHtml,
} from '../annual-summary.js';
import { ENQUIRY_REPLY_DRAFT_LABELS } from '../enquiry-log.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('cleanup: the annual section lives in the Reports tab, not Analytics', () => {
  const html = read('../index.html');
  const reportsStart = html.indexOf('id="billingReportsView"');
  const analyticsStart = html.indexOf('id="analyticsView"');
  const annualStart = html.indexOf('aria-labelledby="annualSummaryHeading"');
  const enquiryStart = html.indexOf('aria-labelledby="enquiryLogHeading"');
  assert.ok(reportsStart !== -1, 'Reports view exists');
  assert.ok(analyticsStart !== -1, 'Analytics view exists');
  assert.ok(annualStart > reportsStart && annualStart < analyticsStart, 'annual section sits inside the Reports tab');
  assert.ok(enquiryStart > analyticsStart, 'enquiry log stays in Analytics');
  const matrixStart = html.indexOf('aria-labelledby="multiMonthMatrixHeading"');
  assert.ok(annualStart > matrixStart, 'annual section sits after Growth & Finance Matrix');
});

test('cleanup: the KPI grid shows the year figures from the same view as the table', () => {
  const view = buildAnnualSummary({
    year: '2026',
    months: [{
      month: '2026-01', collections: 471200, expenses: 190480,
      newCustomers: 21, departed: 0, customersStart: 73, customersEnd: 94,
      churnRate: 0, snapshotClosed: true,
    }],
  });
  const html = annualSummaryHtml(view);
  assert.equal(html.split('class="ds-stat-box"').length - 1, 4, '2x2 grid of stat boxes');
  assert.ok(html.includes('Rs. 471,200'), 'Collections in the grid');
  assert.ok(html.includes('Rs. 190,480'), 'Expenses in the grid');
  assert.ok(html.includes('Rs. 280,720'), 'Net in the grid');
  assert.ok(html.includes('>+21<'), 'Growth shows +21');
  assert.ok(html.includes('0% churn'), 'Churn under Growth');
  assert.ok(html.indexOf('Rs. 471,200') < html.indexOf('<table'), 'grid renders before the table');
  assert.ok(html.includes('<strong>Rs. 471,200</strong>'), 'table footer carries the same total');
});

test('cleanup: the badge derives the live-month count and the unfrozen December', () => {
  const months = Array.from({ length: 11 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    collections: 1000, expenses: 500, newCustomers: 0, departed: 0,
    customersStart: 73, customersEnd: 73, churnRate: 0,
    snapshotClosed: false, live: true,
  }));
  const view = buildAnnualSummary({ year: '2026', months });
  assert.deepEqual(view.liveMonths.length, 11);
  const html = annualSummaryHtml(view);
  assert.ok(html.includes('>11 Live Months · Dec 2026 Unfrozen</span>'), 'badge names 11 live months and the unfrozen December');
});

test('cleanup: no badge when no month is live; no Dec part when December is frozen', () => {
  const frozen = buildAnnualSummary({
    year: '2026',
    months: [{
      month: '2026-01', collections: 1000, expenses: 500, newCustomers: 0, departed: 0,
      customersStart: 73, customersEnd: 73, churnRate: 0, snapshotClosed: true,
    }],
  });
  assert.ok(!annualSummaryHtml(frozen).includes('local-only-badge'), 'no badge without live months');
  const decFrozen = buildAnnualSummary({
    year: '2026',
    months: [
      {
        month: '2026-11', collections: 1000, expenses: 500, newCustomers: 0, departed: 0,
        customersStart: 73, customersEnd: 73, churnRate: 0, snapshotClosed: false, live: true,
      },
      {
        month: '2026-12', collections: 1000, expenses: 500, newCustomers: 0, departed: 0,
        customersStart: 73, customersEnd: 73, churnRate: 0, snapshotClosed: true,
      },
    ],
  });
  const html = annualSummaryHtml(decFrozen);
  assert.ok(html.includes('>1 Live Month</span>'), 'singular badge when one month is live');
  assert.ok(!html.includes('Dec 2026 Unfrozen'), 'no Dec part once December is frozen');
});

test('cleanup: the plain-words summary appears exactly once, collapsed in the details', () => {
  const view = buildAnnualSummary({
    year: '2026',
    months: [{
      month: '2026-11', collections: 5000, expenses: 2000, newCustomers: 1, departed: 0,
      customersStart: 101, customersEnd: 102, churnRate: 0, snapshotClosed: false, live: true,
    }],
  });
  const text = annualSummaryText(view);
  const html = annualSummaryHtml(view);
  assert.equal(html.split(text).length - 1, 1, 'one copy of the full text, inside the details');
  assert.ok(html.includes('<details><summary>'), 'the copy is collapsed');
  assert.ok(html.includes('Once a year this answers one honest question'), 'the year-view rules sit in the same details');
});

test('cleanup: no annualSummarySummary element or assignment remains', () => {
  assert.ok(!read('../index.html').includes('annualSummarySummary'), 'element removed from the section');
  assert.ok(!read('../app.js').includes('annualSummarySummary'), 'assignment removed from the renderer');
});

test('cleanup: at 0 records the filter/mutation/export rows hide by total entries', () => {
  const html = read('../index.html');
  const app = read('../app.js');
  for (const id of [
    'enquiryFilterRow', 'enquiryMutationRow',
    'depositFilterRow', 'depositMutationRow',
    'loanFilterRow', 'loanMutationRow',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `${id} wrapper exists`);
    assert.ok(app.includes(`$('#${id}')`), `${id} is toggled by its renderer`);
  }
  assert.ok(app.includes('const hasEnquiries = entries.length > 0;'), 'enquiry gate uses the total count');
  assert.ok(app.includes('const hasDeposits = entries.length > 0;'), 'deposit gate uses the total count');
  assert.ok(app.includes('const hasLoans = entries.length > 0;'), 'loan gate uses the total count');
  // Loan empty-state dedup: the overdue line only renders when
  // loans exist, and the overdue-only filter no longer claims the
  // register is empty when it is the overdue list that is empty.
  assert.ok(app.includes("entries.length === 0 ? ''"), 'overdue empty state gated on total loans');
  assert.ok(app.includes('showOverdueOnly && entries.length > 0 && shown.length === 0'), 'overdue-only empty body says No overdue loans');
});

test('cleanup: creation forms sit behind + Add buttons that stay visible at 0', () => {
  const html = read('../index.html');
  const app = read('../app.js');
  assert.ok(html.includes('+ Record Enquiry'), 'enquiry + Add button');
  assert.ok(html.includes('+ Record Equipment Deposit'), 'deposit + Add button');
  assert.ok(html.includes('+ Issue Loan Equipment'), 'loan + Add button');
  for (const id of ['enquiryCreateDetails', 'depositCreateDetails', 'loanCreateDetails']) {
    assert.ok(html.includes(`id="${id}"`), `${id} details exists`);
    assert.ok(html.includes(`class="registry-create-details" id="${id}"`), `${id} uses the collapse pattern`);
  }
  assert.ok(app.includes('if (enquiryCreateDetails) enquiryCreateDetails.open = false;'), 'enquiry form closes on record');
  assert.ok(app.includes('if (depositCreateDetails) depositCreateDetails.open = false;'), 'deposit form closes on record');
  assert.ok(app.includes('if (loanCreateDetails) loanCreateDetails.open = false;'), 'loan form closes on record');
});

test('cleanup: mohalla placeholders read "Filter by mohalla (or Unassigned)"', () => {
  const html = read('../index.html');
  // Scope to the three registry sections: other sections (dispute
  // log, claim check, the operational registries) carry their own
  // '__unassigned__' placeholders and belong to other items.
  const enquiryStart = html.indexOf('aria-labelledby="enquiryLogHeading"');
  const loanStart = html.indexOf('aria-labelledby="loanTrackerHeading"');
  const loanEnd = html.indexOf('</section>', loanStart);
  const registries = html.slice(enquiryStart, loanEnd);
  assert.equal(registries.split('Filter by mohalla (or Unassigned)').length - 1, 3, 'one placeholder per registry');
  assert.ok(!registries.includes('Mohalla or __unassigned__'), 'no __unassigned__ placeholder remains in the three sections');
});

test('cleanup: no plan number leaks into the draft dropdown or the sections', () => {
  const html = read('../index.html');
  assert.ok(!html.includes('(Plans 72-75)'), 'enquiry caption no longer names the plans');
  assert.ok(!html.includes('Balance reply (Plan 72)'), 'no Plan 72 label in the page');
  assert.ok(!html.includes('Plan 73'), 'no Plan 73 in the page');
  assert.ok(!html.includes('Plan 74'), 'no Plan 74 in the page');
  assert.ok(!html.includes('Plan 75'), 'no Plan 75 in the page');
  assert.ok(
    Object.values(ENQUIRY_REPLY_DRAFT_LABELS).every((label) => !label.includes('Plan')),
    'all four draft labels are plan-free',
  );
});

test('cleanup: captions are one line; the full rules live in the tooltips', () => {
  const html = read('../index.html');
  assert.ok(html.includes('Questions from WhatsApp or phone, worked oldest first.'), 'enquiry subtitle');
  assert.ok(html.includes('One record per device held against a refundable deposit.'), 'deposit subtitle');
  assert.ok(html.includes('One record per loan unit left while a faulty device is away for repair.'), 'loan subtitle');
  assert.ok(html.includes('Read-only year view from the twelve monthly figures'), 'annual subtitle');
  // One dashboard help-tip already existed; the three Annual
  // registries add three more and the six Operational registries
  // (job cost, RMA, recovery, vacation, resume, suspension) add
  // six more — the annual rules live in the year-view details
  // instead, so the annual section has no second tooltip.
  // Rebase note (#1395): the count moved 4 → 10 when the
  // Operational registries adopted the same subtitle + tooltip
  // pattern in §5; the pin still guards the annual section
  // having no second tooltip and every registry keeping its
  // full rules in a tooltip.
  assert.equal(html.split('class="help-tip"').length - 1, 10, 'dashboard + three Annual + six Operational tooltips');
  assert.ok(html.includes('with the pending list ordered by age as the queue the operator works through'), 'enquiry rules kept in its tooltip');
  assert.ok(html.includes('it adds the per-device record those money paths never kept'), 'deposit rules kept in its tooltip');
  assert.ok(html.includes("returning a loan leaves the original device"), 'loan rules kept in its tooltip');
});

test('cleanup: filter checkboxes sit on one line via the scoped flex label', () => {
  const html = read('../index.html');
  const styles = read('../styles.css');
  assert.equal(html.split('registry-filter-check').length - 1, 2, 'both checkbox labels carry the class');
  assert.ok(styles.includes('.registry-filter-check { display: flex;'), 'scoped flex label exists');
  assert.ok(styles.includes('.registry-filter-check input[type="checkbox"] { width: 18px; height: 18px; min-height: 18px; flex: none; }'), 'checkbox keeps its own 18px box');
});

test('cleanup: shared .table-scroll rule keeps cells on one line with a sticky first column', () => {
  const styles = read('../styles.css');
  assert.ok(styles.includes('.table-scroll th, .table-scroll td { white-space: nowrap; overflow-wrap: normal; }'), 'nowrap cells');
  assert.ok(styles.includes('.table-scroll th:first-child, .table-scroll td:first-child { position: sticky; left: 0;'), 'sticky first column');
  assert.ok(styles.includes('.table-scroll thead th:first-child { z-index: 4; background: #f6faf8; }'), 'corner cell keeps the header colour');
});
