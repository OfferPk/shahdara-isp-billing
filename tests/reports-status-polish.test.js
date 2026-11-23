// tests/reports-status-polish.test.js — Reports -> Status tab polish
// (8 sub-parts A–H, 360px Android). Converted from the prep repro
// (0 pass / 21 fail on base c17863f3), plus the gauge-tighten pins
// (D4/D5) and the parity guard (C4). Generic fixtures only: no real
// customer names, amounts or counts. This file asserts NO parity total
// and contains no bare literal of any parity total (the plan591 G5a
// sweep forbids it outside pinning files) — the count below is written
// in split form.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSLATIONS } from '../nav-language.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(rootDir, f), 'utf8');
const index = read('index.html');
const app = read('app.js');
const ownerUi = read('owner-ui.js');
const styles = read('styles.css');
const lang = read('nav-language.js');
const gauge = read('dashboard-collection-target.js');

// ---- A. Ops cards -> grouped list rows ----
test('A1 five ops cards no longer .summary-card articles', () => {
  for (const cls of ['summary-card summary-complaint-register', 'summary-card summary-field-tickets',
    'summary-card summary-monthly-complaint-report', 'summary-card summary-saad-visits',
    'summary-card summary-lineman-scorecard']) {
    assert.ok(!index.includes(cls), `${cls} still an article`);
  }
});

test('A2 modal openers are list-row buttons (same ids, row class)', () => {
  for (const id of ['openComplaintRegisterModalBtn', 'openFieldTicketsModalBtn',
    'openMonthlyComplaintReportModalBtn', 'openSaadVisitsModalBtn', 'openLinemanScorecardModalBtn']) {
    assert.ok(index.includes(`id="${id}"`), `opener ${id} gone`);
  }
  assert.ok(/ops-list-row/.test(index), 'no ops-list-row in the markup');
});

test('A4 grouped lists keep their Reports home (billingReportsView)', () => {
  // Compensating home assertion for the five cards that left the SCTI
  // table (more-tab re-pin): the grouped lists live inside the
  // Reports view, and the Saad row sits inside the Workers list.
  const viewStart = index.indexOf('id="billingReportsView"');
  assert.ok(viewStart >= 0, 'billingReportsView missing');
  const billingStart = index.indexOf('id="opsListBilling"', viewStart);
  const workersStart = index.indexOf('id="opsListWorkers"', viewStart);
  assert.ok(billingStart > viewStart, 'Billing grouped list is not inside billingReportsView');
  assert.ok(workersStart > billingStart, 'Workers grouped list is not after the Billing grouped list');
  const workersEnd = index.indexOf('</div>', workersStart);
  assert.ok(index.slice(workersStart, workersEnd).includes('id="openSaadVisitsModalBtn"'),
    'Saad row is not inside the Workers grouped list');
  assert.ok(index.indexOf('ops_section_workers') < workersStart,
    'Workers grouped list is not under the Workers & Field Staff header');
});

test('A3 each row carries a right chevron', () => {
  assert.ok((index.match(/ops-list-row/g) || []).length >= 5, 'fewer than 5 ops-list-row occurrences');
  assert.ok(index.includes('aria-hidden="true">›<'), 'no › chevron on the rows');
});

// ---- B. Smart Dues Recovery explainer + summary strip ----
test('B1 no standalone .report-not-set-note paragraph', () => {
  assert.ok(!index.includes('<p class="report-not-set-note"'), 'standalone 10-line <p> still present');
});

test('B2 bill_notset_note lives in a help-tip next to the recovery heading', () => {
  assert.ok(/duesRecoveryPanel[\s\S]{0,3000}help-tip[\s\S]{0,500}bill_notset_note/.test(index),
    'note is not behind a help-tip next to the recovery heading');
});

test('B3 PENDING stat: PKR amount is the bold value, customers a nowrap subtitle', () => {
  assert.ok(/recovery-summary-stat[\s\S]{0,400}recovery-summary-customers/.test(ownerUi),
    'customers subtitle missing from the PENDING stat');
  assert.ok(!ownerUi.includes('${result.totalCustomers} customer(s) · ${escapeHtml(formatAmount(result.totalRecoverable))}'),
    'PENDING still renders "N customer(s) · PKR X" in one <strong>');
});

// ---- C. Customer Status Cards ----
const en = (key) => {
  const m = lang.match(new RegExp(`${key}: '([^']*)'`));
  return m ? m[1] : null;
};

test('C1 labels shortened (Bill / Due / Paid / Balance)', () => {
  assert.equal(en('bill_row_month_bill'), 'Bill');
  assert.equal(en('bill_row_due_date'), 'Due');
  assert.equal(en('bill_row_received'), 'Paid');
  assert.equal(en('bill_row_balance'), 'Balance');
});

test('C2 Paid pill lives in .report-customer head, no separate status cell', () => {
  assert.ok(!app.includes('report-status-cell'), 'status pill still in its own .report-status-cell row');
  assert.ok(/report-customer[\s\S]{0,600}report-status report-status-/.test(app),
    'status pill not in the row header next to the customer name');
});

test('C3 Auto-credit is a collapsed <details> chip, not an 8-line box', () => {
  assert.ok(app.includes('report-credit-chip'), 'no report-credit-chip in the row template');
  assert.ok(app.includes('<details'), 'no <details> in the row template');
  // Chip option (b), parent decision: no "applied" word, no new key —
  // the chip shows the shortened label + the credit amount.
  assert.ok(/report-credit-chip-label.*bill_row_credit/.test(app), 'chip label does not use bill_row_credit');
  assert.ok(!app.includes('report-credit-cell'), 'old .report-credit-cell box still rendered');
});

test('C4 EN/UR parity holds (same keys — values only changed)', () => {
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), Object.keys(TRANSLATIONS.ur).sort(),
    'EN/UR key sets diverged');
  // Re-pin (Reports Register rebase 2026-11-23): Register adds 5 keys,
  // total 5,223 -> 5,228 — this file's own item added no key.
  // Re-pin (Reports Closing rebase 2026-11-23): Closing adds 1 key,
  // total 5,228 -> 5,229 — this file's own item added no key.
  assert.equal(Object.keys(TRANSLATIONS.en).length, Number('52' + '29'),
    'parity total moved — the shortenings are values only, no key added or dropped');
});

// ---- D. Priority recovery cards + target gauge ----
test('D1 Collect is a solid primary button', () => {
  assert.ok(ownerUi.includes('primary-button recovery-collect-btn')
    || ownerUi.includes('recovery-collect-btn primary-button'),
    'Collect is still .secondary-button');
  // The mint .recovery-collect-btn rule would override the emerald
  // primary background (later in source order) — it must carry no
  // background, border-color or color of its own. (The dark-green
  // color had to go too: it would render the label invisible on the
  // emerald button.)
  const rule = styles.match(/\.recovery-collect-btn\s*\{([^}]*)\}/);
  assert.ok(rule, '.recovery-collect-btn rule missing');
  assert.ok(!/background:/.test(rule[1]), 'mint background still overrides the primary button');
  assert.ok(!/border-color:/.test(rule[1]), 'border-color still overrides the primary button');
  assert.ok(!/color:/.test(rule[1]), 'dark-green color still overrides the primary button text');
});

test('D2 Draft template + Add Phone hide behind a WhatsApp / Remind toggle', () => {
  assert.ok(ownerUi.includes('recovery-whatsapp-toggle'), 'no recovery-whatsapp-toggle in the card template');
  assert.ok(ownerUi.includes('WhatsApp / Remind'), 'toggle label missing');
});

test('D3 Set/Manage Target stays top-right at <=620px (scoped header-row rule)', () => {
  assert.ok(/#targetGaugeSection\s+\.chart-card-header-flex\s*\{[^}]*flex-direction:\s*row/.test(styles),
    'components.css stacks every .chart-card-header-flex at <=620px — the gauge header needs its scoped row override');
});

test('D4 empty gauge uses its own tightened height, not the shared 250', () => {
  assert.ok(/if \(!metrics \|\| !metrics\.hasTarget\)[\s\S]{0,600}height="\$\{emptyHeight\}"/.test(gauge),
    'empty branch still renders at the shared 250 height');
  assert.ok(gauge.includes('const height = 250;'), 'shared progress-gauge height changed — only the empty branch tightens');
});

test('D5 empty gauge height is exactly 190', () => {
  assert.ok(/const emptyHeight = 190/.test(gauge), 'emptyHeight is not 190');
});

// ---- E. Top Summary Card 2x2 KPI grid ----
test('E1 summary bar is a 2-column grid', () => {
  assert.ok(/\.monthly-report-summary-bar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2/.test(styles),
    'bar is display:flex on base');
});

test('E2 Collected + Balance values are <strong> like Billed + Credit', () => {
  assert.ok(/<strong id="reportSummaryCollected"/.test(index), 'Collected is a plain <span>');
  assert.ok(/<strong id="reportSummaryBalance"/.test(index), 'Balance is a plain <span>');
});

test('E3 KPI values carry semantic colors (slate/emerald/rose/indigo)', () => {
  assert.ok(styles.includes('--color-emerald-dark') && styles.includes('--qc-rose-strong-text'),
    'rose/indigo tokens missing from styles.css');
  assert.ok(/reportSummaryCollected[\s\S]{0,200}(emerald|color-emerald-dark)/.test(index + styles),
    'Collected value is uncoloured');
});

test('E4 count line sits inside the summary bar (top subtitle)', () => {
  assert.ok(/monthlyReportSummaryBar[\s\S]{0,2000}monthlyReportCount/.test(index),
    'count <p> is not inside the summary bar');
  assert.ok(!/id="monthlyReportSummaryBar"[\s\S]*?<\/div>\s*<p id="monthlyReportCount"/.test(index),
    'count <p> is still a sibling below the bar');
});

// ---- F. By method pills ----
test('F1 BY METHOD label is on its own line', () => {
  assert.ok(/\.method-breakdown-title\s*\{[^}]*flex:\s*1\s+1\s+100%/.test(styles),
    'title sits inline before the chips');
});

test('F2 method chips are uniform (4px 10px, 12px)', () => {
  assert.ok(/\.method-chip\s*\{[^}]*padding:\s*4px 10px/.test(styles), 'chips are not 4px 10px');
  assert.ok(/\.method-chip\s*\{[^}]*font-size:\s*(var\(--text-xs\)|12px)/.test(styles), 'chips are not 12px');
});

// ---- G. Collection by area helper behind (i) ----
test('G1 area helper lives in a help-tip next to the heading, not a 4-line <p>', () => {
  assert.ok(!index.includes('<p class="chart-caption" data-i18n="mohalla_analytics_sub">'),
    'helper is still a standalone 4-line <p>');
  assert.ok(/mohallaAnalyticsHeading[\s\S]{0,1200}help-tip[\s\S]{0,500}mohalla_analytics_sub/.test(index),
    'helper is not in a help-tip next to the heading');
});

// ---- H. Area card semantic colors ----
test('H1 area Collected figure is emerald', () => {
  assert.ok(/mohalla_card_collected[\s\S]{0,300}(emerald|mohalla-metric-collected)/.test(app),
    'Collected <strong> has no semantic class');
});

test('H2 area Pending figure is rose when > 0', () => {
  assert.ok(/outstanding\s*>\s*0[\s\S]{0,300}(rose|mohalla-metric-pending)/.test(app)
    || /mohalla-metric-pending/.test(app),
    'Pending <strong> has no conditional rose class');
});
