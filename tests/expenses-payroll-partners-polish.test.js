/**
 * expenses-payroll-partners-polish.test.js — Expenses, Payroll & Partner
 * Settlement 3-tab polish (user-told task, 2026-11-20).
 *
 * Six tabs became five (Ledger | Payroll | Partners | Fixed overheads |
 * Upstream); the per-partner tabs are gone and the Partners tab carries
 * one shared detail for both partners from the settlement month. Saad's
 * three tall cards became one compact card with an (i) tooltip; the
 * Umair Record button hides at 0 workdays; category totals became a
 * compact list with unit labels; the KPI grid holds 2 balanced cards;
 * the drawing form collapses behind a + Add button; the reserve input
 * gets the standard token border; Re-open hides when no slip is saved.
 * Static markup + source-string checks (no DOM harness for this view).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const components = readFileSync(new URL('../components.css', import.meta.url), 'utf8');

test('tabs: five in order Ledger | Payroll | Partners | Fixed overheads | Upstream', () => {
  const tabIds = [...new Set(indexHtml.match(/id="expenseTab[A-Z][a-z]+"/g) || [])];
  assert.deepEqual(tabIds, [
    'id="expenseTabLedger"',
    'id="expenseTabPayroll"',
    'id="expenseTabPartners"',
    'id="expenseTabOverheads"',
    'id="expenseTabUpstream"',
  ]);
  for (const dead of ['expenseTabNasir', 'expenseTabAqib', 'expenseTabSettlement',
    'nasirSharePanel', 'aqibSharePanel', 'nasirShareMonth', 'aqibShareMonth',
    'nasirShareContent', 'aqibShareContent', 'partnerSettlementPanel']) {
    assert.ok(!indexHtml.includes(dead), `${dead} is gone`);
  }
  assert.ok(!app.includes('renderPartnerShare('), 'no renderPartnerShare caller left');
  assert.ok(!app.includes("function renderPartnerShare("), 'renderPartnerShare is gone');
  assert.ok(app.includes("key==='partners'?'partner-settlement':null"), 'Partners tab gates on partner-settlement only');
});

test('payroll: summary + attendance + workdays live inside #payrollPanel', () => {
  const panel = indexHtml.indexOf('id="payrollPanel"');
  assert.ok(panel > 0, 'payrollPanel exists');
  const order = ['id="payrollPanel"', 'id="payrollSummaryHeading"', 'id="saadAttendanceHeading"',
    'id="umairWorkdayHeading"', 'id="partnersPanel"'];
  let last = -1;
  for (const id of order) {
    const at = indexHtml.indexOf(id);
    assert.ok(at > last, `${id} follows the previous panel/section`);
    last = at;
  }
  const ledgerSlice = indexHtml.slice(indexHtml.indexOf('id="expensesLedgerPanel"'), panel);
  for (const id of ['payrollSummaryHeading', 'saadAttendanceHeading', 'umairWorkdayHeading']) {
    assert.ok(!ledgerSlice.includes(id), `${id} moved out of the Ledger panel`);
  }
});

test('Saad: one compact card with an (i) tooltip; the three tall cards are gone', () => {
  assert.ok(indexHtml.includes('saad-payroll-card'), 'Saad single card exists');
  const at = indexHtml.indexOf('saad-payroll-card');
  const card = indexHtml.slice(at, at + 2200);
  assert.ok(card.includes('Saad · payroll'), 'card title');
  assert.ok(card.includes('id="saadMonthlySalary"'), 'salary id survives');
  assert.ok(card.includes('class="help-tip"'), 'tooltip present');
  assert.ok(card.includes('id="saadSalaryDetail"'), 'dynamic salary detail survives inside the tooltip');
  assert.ok(card.includes('id="saadEligibleCustomerCount"'), 'eligible-customers id survives');
  assert.ok(card.includes('id="saadAttendanceCount"'), 'attendance id survives');
  assert.ok(card.includes('id="recordSaadSalaryExpenseBtn"'), 'Record button survives');
  assert.ok(!indexHtml.includes('Saad · eligible customers'), 'separate eligible-customers card is gone');
  assert.ok(!indexHtml.includes('Saad · attendance (informational)'), 'separate attendance card is gone');
  assert.ok(styles.includes('.saad-payroll-card .help-icon{width:28px;height:28px;min-height:28px;font-size:11px}'),
    'scoped 28px (i) rule for the compact card (matched to the Month-end 28px standard after #1553 merged)');
  assert.ok(styles.includes('.saad-payroll-card .saad-payroll-counts strong{font-size:12px}'),
    'counts line does not inherit the 19px metric-amount size');
});

test('Umair: Record button hides at 0 logged workdays', () => {
  assert.ok(app.includes("$('#recordUmairSalaryExpenseBtn').hidden = payroll.umairWorkdayCount === 0;"),
    'renderExpenses hides the button at 0 workdays');
});

test('record buttons: both prefill handlers switch to the Ledger tab before scrolling', () => {
  assert.equal(app.split("expenseActiveTab='ledger'; syncExpenseTabs();").length - 1, 2,
    'Saad + Umair handlers both switch to Ledger first (the form lives there)');
});

test('category totals: a compact list with unit labels, not a bare-count table', () => {
  assert.ok(indexHtml.includes('id="expenseCategoryTotalsList"'), 'list exists');
  assert.ok(!indexHtml.includes('expenseCategoryTotalsBody'), 'table body is gone');
  assert.ok(app.includes("$('#expenseCategoryTotalsList')"), 'render targets the list');
  assert.ok(app.includes('<li class="partner-share-row">'), 'rows reuse the partner-share row');
  assert.ok(app.includes("entr${entry.count === 1 ? 'y' : 'ies'}"), 'rows carry "N entry/entries"');
  assert.ok(app.includes("'<li class=\"empty-state\">No expenses match the current filters.</li>'"),
    'empty state is a list item, no amount');
});

test('KPI grid: exactly 2 balanced cards; the dropped count survives in the filter help', () => {
  assert.ok(indexHtml.includes('expense-kpi-grid'), 'scoped KPI grid class exists');
  assert.ok(!indexHtml.includes('id="expenseEntryCount"'), 'Recorded-expenses card is gone');
  assert.ok(!app.includes("$('#expenseEntryCount')"), 'no unguarded write to the deleted card');
  assert.ok(styles.includes('.expense-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'),
    'scoped 2-col rule (placed after every .phase3-metric-grid rule, so it wins at 360px too)');
  assert.ok(styles.includes('@media(max-width:360px) { .payroll-metric-grid { grid-template-columns:1fr; } }'),
    'payroll grid goes 1-col at 360px (Saad card above Umair card)');
});

test('drawing form: collapsed behind + Add Drawing / Outlay; edit opens it, submit/cancel close it', () => {
  const at = indexHtml.indexOf('id="partnerLedgerCreateDetails"');
  assert.ok(at > 0, 'create details exists');
  const block = indexHtml.slice(at, at + 1200);
  assert.ok(block.includes('<summary class="primary-button">+ Add Drawing / Outlay</summary>'),
    'summary button');
  assert.ok(block.includes('id="partnerLedgerForm"'), 'form sits inside the details');
  assert.equal(app.split('partnerLedgerDetails.open = true').length - 1, 1,
    'edit handler opens the details before scrolling');
  assert.equal(app.split('partnerLedgerDetails.open = false').length - 1, 2,
    'submit + cancel both close the details');
});

test('reserve input: standard token border; the full-width Save rule is gone', () => {
  const at = components.indexOf('.charity-reserve-label input');
  assert.ok(at > 0, 'reserve input rule exists');
  const rule = components.slice(at, components.indexOf('}', at));
  assert.ok(rule.includes('border: 1px solid var(--line);'), 'token border, no raw black border');
  assert.ok(rule.includes('border-radius: 9px;'), 'standard radius');
  assert.ok(!components.includes('.charity-reserve-control .secondary-button { width: 100%'),
    'the <=480px full-width Save rule is deleted');
});

test('partners detail + re-open: one shared detail from the settlement month; Re-open hides with no slip', () => {
  assert.ok(indexHtml.includes('id="partnerShareDetail"'), 'detail host exists');
  assert.ok(indexHtml.indexOf('id="partnerShareDetail"') > indexHtml.indexOf('id="partnerSettlementContent"'),
    'detail sits after the settlement content');
  assert.ok(app.includes('function renderPartnerShareDetail(month)'), 'detail renderer exists');
  assert.ok(app.includes('renderPartnerShareDetail(report.month);'), 'settlement render drives the detail');
  assert.ok(indexHtml.includes('id="partnerSettlementReopenBtn"'), 'Re-open button exists');
  assert.ok(app.includes('if (reopenBtn) reopenBtn.hidden = !slip;'), 'Re-open hides when no slip is saved');
});
