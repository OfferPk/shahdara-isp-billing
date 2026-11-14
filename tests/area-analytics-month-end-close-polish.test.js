/**
 * area-analytics-month-end-close-polish.test.js — Area Analytics,
 * month-end close tables & sidebar drawer CSS polish.
 * Pins (prep §11.2/§11.3):
 * - roll-forward table: short headers (Paid / Computed / Reported /
 *   Status), the status pill reuses .report-status, and the scoped
 *   nowrap + sticky-first-column rules (source-scan on styles.css).
 *   Why-comment: the header rename + pill are the spec's §1; the old
 *   `Computed closing` / `Reported closing` / `Check` headers are
 *   gone by design, and the CSV header is unchanged (plan68 pin).
 * - equation grid: a null component prints "Not recorded", never 0;
 *   differing totals show the difference in the 6th box; reconciling
 *   totals show ✓. Why-comment: the grid reuses the module's money
 *   rule (plan68) and its honesty fence — a difference is shown,
 *   never forced away.
 * - pre-close sweep cards: every <li> field survives on the card
 *   (label, detail, date, id, age, amount, screen badge), the screen
 *   badge is the item's own screen (STATIC text — navigation stays
 *   in the header buttons), carried-forward is kept, the empty state
 *   is exact. Why-comment: the <ul><li> shape is replaced by cards
 *   by design; the data contract is unchanged.
 * - button rows: the three rows carry the analytics-btn-row class,
 *   NOT an inline display:flex — the class escape around the
 *   deliberate ≤620px grid rule (components.css:3788, Reports Tab
 *   Part 4B(1), which forces every inline-flex row in
 *   .analytics-panel into a 1-col grid). Tick/Remove use the ds
 *   tokens. Why-comment: an !important override would fight a
 *   deliberate measured rule; the class escape is the fix.
 * - drawer footer: the three icon buttons carry data-ds-icon hooks
 *   (Smartphone / Search / Keyboard) and Mode + Backup sit in their
 *   own .nav-drawer-footer-mode-row.
 * - audit captions: the four month-end captions collapse behind
 *   <details class="audit-explainer"> with the full caption verbatim
 *   inside (print behaviour disclosed in the PR body: a closed
 *   <details> prints closed; audit data and CSVs are unaffected).
 * Synthetic data only; no ledger record is ever changed by this item.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCustomerRollForward,
  buildRollForwardTotals,
  rollForwardEquationHtml,
  rollForwardTableHtml,
} from '../balance-rollforward.js';
import {
  buildPrecloseSweep,
  precloseSweepHtml,
} from '../preclose-sweep.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function rowA() {
  return buildCustomerRollForward({
    customerId: 'c1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    month: '2026-10',
    opening: 1000,
    charges: [{ sourceId: 'bill-2026-10', label: 'Bill Oct', amount: 1200 }],
    payments: [{ sourceId: 'receipt-1', label: 'Cash receipt', amount: 500 }],
    concessions: [{ sourceId: 'bill-2026-10-concession', label: 'Concession', amount: 100 }],
    reportedClosing: 1600,
  });
}

function rowB(reportedClosing = 400) {
  return buildCustomerRollForward({
    customerId: 'c2',
    customerName: 'Bilal',
    mohalla: 'Kishti',
    month: '2026-10',
    opening: 200,
    charges: [{ sourceId: 'bill-2026-10-b', label: 'Bill Oct', amount: 300 }],
    payments: [{ sourceId: 'receipt-2', label: 'Cash receipt', amount: 100 }],
    concessions: [],
    reportedClosing,
  });
}

function sweepFixture() {
  return {
    month: '2026-11',
    suspenseItems: [
      { id: 'S-1', label: 'Suspense S-1', detail: 'Easypaisa, no name', amount: 500, ageDays: 40, date: '2026-10-01' },
      { id: 'S-2', label: 'Suspense S-2', amount: 333.33, ageDays: 5, date: '2026-11-01' },
    ],
    walletItems: [
      { id: 'W-1', bucket: 'unmatched', label: 'Wallet W-1', detail: 'TID ABC', amount: 1000, date: '2026-11-02' },
      { id: 'W-2', bucket: 'disputed', label: 'Wallet W-2', detail: 'Duplicate TID', amount: 166.67, date: '2026-11-03' },
    ],
    claims: [
      { id: 'C-1', label: 'Claim C-1', detail: 'Easypaisa TID XYZ', amount: 2000, date: '2026-11-04', closed: false },
    ],
    handovers: [
      { date: '2026-11-03', label: 'Day 2026-11-03', detail: 'Cash Rs. 4500, no handover', handoverRecorded: false },
    ],
    monthClose: { month: '2026-11', status: 'open' },
  };
}

test('roll-forward table: short headers, status pills, scoped nowrap + sticky first column', () => {
  const differing = buildCustomerRollForward({
    customerId: 'c3',
    customerName: 'Chaudhry',
    mohalla: 'Bani',
    month: '2026-10',
    opening: 200,
    charges: [{ sourceId: 'bill-2026-10-c', label: 'Bill Oct', amount: 300 }],
    payments: [{ sourceId: 'receipt-3', label: 'Cash receipt', amount: 100 }],
    concessions: [],
    reportedClosing: 300,
  });
  const uncheckable = buildCustomerRollForward({
    customerId: 'c4',
    customerName: 'Danish',
    mohalla: 'Bani',
    month: '2026-10',
    opening: 200,
    charges: [{ sourceId: 'bill-2026-10-d', label: 'Bill Oct', amount: 300 }],
    payments: [],
    concessions: [],
  });
  const html = rollForwardTableHtml([rowA(), differing, uncheckable]);
  // Short headers by design (spec §1); the old long headers are gone.
  assert.ok(html.startsWith('<div class="table-scroll">'));
  assert.ok(html.includes('<table class="data-table roll-forward-table"><thead><tr><th>Customer</th><th>Mohalla</th><th>Opening</th><th>Charges</th><th>Paid</th><th>Concessions</th><th>Computed</th><th>Reported</th><th>Status</th></tr></thead>'));
  assert.doesNotMatch(html, /Computed closing|Reported closing|<th>Check<\/th>|<th>Payments<\/th>/);
  // Status reuses the .report-status pills, not a new style.
  assert.match(html, /<span class="report-status report-status-paid">✓ Match<\/span>/);
  assert.match(html, /<span class="report-status report-status-partial">Differs Rs\. 100<\/span>/);
  assert.match(html, /<span class="report-status report-status-not-set">Uncheckable<\/span>/);
  // Scoped CSS: money never wraps, first column stays pinned while scrolling.
  const css = read('styles.css');
  const tableCss = css.slice(css.indexOf('.roll-forward-table'));
  assert.match(tableCss, /\.roll-forward-table th, \.roll-forward-table td \{[^}]*white-space: nowrap/);
  assert.match(tableCss, /\.roll-forward-table th, \.roll-forward-table td \{[^}]*overflow-wrap: normal/);
  assert.match(tableCss, /\.roll-forward-table thead th:first-child,\s*\.roll-forward-table tbody td:first-child \{[^}]*position: sticky;[^}]*left: 0/);
});

test('equation grid: reconciling totals show all six figures with ✓', () => {
  const html = rollForwardEquationHtml(buildRollForwardTotals([rowA(), rowB()]));
  assert.equal((html.match(/class="ds-stat-box"/g) || []).length, 6);
  assert.match(html, /Opening<\/span><span class="ds-stat-box__value">Rs\. 1,200<\/span>/);
  assert.match(html, /\+ Charges<\/span><span class="ds-stat-box__value">Rs\. 1,500<\/span>/);
  assert.match(html, /− Payments<\/span><span class="ds-stat-box__value">Rs\. 600<\/span>/);
  assert.match(html, /− Concessions<\/span><span class="ds-stat-box__value">Rs\. 100<\/span>/);
  assert.match(html, /= Computed<\/span><span class="ds-stat-box__value">Rs\. 2,000<\/span>/);
  assert.match(html, /Reported<\/span><span class="ds-stat-box__value">Rs\. 2,000 ✓<\/span>/);
});

test('equation grid: differing totals show the difference in the 6th box', () => {
  const html = rollForwardEquationHtml(buildRollForwardTotals([rowA(), rowB(300)]));
  assert.match(html, /Reported<\/span><span class="ds-stat-box__value">Rs\. 1,900 · Δ Rs\. 100<\/span>/);
  assert.match(html, /= Computed<\/span><span class="ds-stat-box__value">Rs\. 2,000<\/span>/);
});

test('equation grid: a null component prints "Not recorded", never 0', () => {
  assert.equal(rollForwardEquationHtml(null), '');
  assert.equal(rollForwardEquationHtml('not a view'), '');
  const unusable = buildCustomerRollForward({
    customerId: 'c5',
    customerName: 'Ehsan',
    mohalla: 'Bani',
    month: '2026-10',
    opening: 100,
    charges: [{ sourceId: 'bill-x', label: 'Bill', amount: 'abc' }],
    payments: [],
    concessions: [],
    reportedClosing: 100,
  });
  const html = rollForwardEquationHtml(buildRollForwardTotals([unusable]));
  assert.match(html, /= Computed<\/span><span class="ds-stat-box__value">Not recorded<\/span>/);
  assert.match(html, /Reported<\/span><span class="ds-stat-box__value">Not recorded<\/span>/);
  assert.match(html, /\+ Charges<\/span><span class="ds-stat-box__value">Not recorded<\/span>/);
  assert.doesNotMatch(html, /Rs\. 0 · Δ|Δ Rs\. 0/);
});

test('sweep cards: every list field survives, screen badge is the item screen', () => {
  const sweep = buildPrecloseSweep(sweepFixture());
  assert.equal(sweep.totalCount, 6);
  const html = precloseSweepHtml(sweep);
  // The <ul><li> shape is gone by design; cards carry the same fields.
  assert.doesNotMatch(html, /<ul>|<li>/);
  assert.ok(html.includes('<article class="sweep-item-card">'));
  assert.match(html, /Suspense S-1/);
  assert.match(html, /Easypaisa, no name/);
  assert.match(html, /2026-10-01 · S-1 · 40 days/);
  assert.match(html, /Rs\. 500/);
  // Static badge: the owning screen, no navigation from the card.
  assert.match(html, /Suspense register →/);
  assert.match(html, /Wallet ledger →/);
  assert.match(html, /Payment-claim check →/);
  assert.match(html, /Daily closing →/);
  // A handover day with no amount still counts, amount unrecorded.
  assert.match(html, /Amount not recorded/);
});

test('sweep cards: empty sweep renders the exact empty state', () => {
  const sweep = buildPrecloseSweep({ month: '2026-11' });
  assert.equal(sweep.totalCount, 0);
  assert.equal(
    precloseSweepHtml(sweep),
    '<p style="font-size: 12px;">Nothing unreconciled: no unclaimed suspense, unmatched wallet entries, open payment claims, or unclosed day handovers.</p>',
  );
});

test('sweep cards: a closed month keeps its open items as carried-forward exceptions', () => {
  const sweep = buildPrecloseSweep({
    ...sweepFixture(),
    monthClose: { month: '2026-11', status: 'closed', closedDate: '2026-11-30', closedBy: 'Owner' },
  });
  assert.equal(sweep.carriedForward.length, 6);
  const html = precloseSweepHtml(sweep);
  assert.match(html, /Carried-forward exceptions from closed month 2026-11 \(closed 2026-11-30 by Owner\)/);
  assert.ok(html.includes('<article class="sweep-item-card">'));
});

test('button rows: class rows, not inline flex — the 620px grid-rule escape', () => {
  // Why-comment: components.css:3788 deliberately forces every
  // inline-flex row in .analytics-panel into a 1-col grid at ≤620px
  // (Reports Tab Part 4B(1)). These rows escape it by carrying their
  // layout in a class, never an inline style="display: flex".
  const html = read('index.html');
  assert.ok(html.includes('class="analytics-btn-row analytics-btn-row--3"><button id="monthCloseTickBtn"'));
  assert.ok(html.includes('class="analytics-btn-row analytics-btn-row--3"><button id="monthCloseCloseBtn"'));
  assert.ok(html.includes('class="analytics-btn-row analytics-btn-row--2x2"><button id="precloseSweepOpenSuspenseBtn"'));
  for (const id of ['monthCloseTickBtn', 'monthCloseCloseBtn', 'precloseSweepOpenSuspenseBtn']) {
    const at = html.indexOf(`id="${id}"`);
    const divOpen = html.lastIndexOf('<div', at);
    const divTag = html.slice(divOpen, html.indexOf('>', divOpen) + 1);
    assert.doesNotMatch(divTag, /style="display: flex/, `${id} row must not carry inline flex`);
  }
  assert.ok(html.includes('id="monthCloseTickBtn" class="secondary-button btn-sm month-close-tick-btn"'));
  assert.ok(html.includes('id="monthCloseRemoveBtn" class="secondary-button btn-sm month-close-remove-btn"'));
  const css = read('components.css');
  assert.match(css, /\.analytics-btn-row \.month-close-tick-btn \{[^}]*var\(--ds-brand\)/);
  assert.match(css, /\.analytics-btn-row \.month-close-remove-btn \{[^}]*var\(--ds-danger-border\)[^}]*var\(--ds-danger\)/);
  // No truncation: long labels wrap to a second line inside the fixed
  // 40/42px height (harness-measured at 360px: "Mark month closed",
  // "Remove month record" and "Open payment-claim check" all clipped
  // with ellipsis before this rule).
  assert.match(css, /\.analytics-btn-row \.secondary-button \{[^}]*white-space: normal/);
  assert.doesNotMatch(css, /\.analytics-btn-row \.secondary-button \{[^}]*text-overflow: ellipsis/);
  assert.ok(css.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'));
  assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
  assert.ok(css.indexOf('@media (max-width: 620px)', css.indexOf('.analytics-btn-row')) < css.indexOf('repeat(2, minmax(0, 1fr))'));
});

test('drawer footer: three ds-icon hooks, Mode + Backup in their own row', () => {
  const html = read('index.html');
  const footer = html.slice(html.indexOf('nav-drawer-footer'), html.indexOf('</aside>'));
  assert.match(footer, /id="navDrawerPwaStatusBtn"[^>]*><span class="ds-action-icon" data-ds-icon="Smartphone" aria-hidden="true"><\/span>/);
  assert.match(footer, /id="navDrawerCommandPaletteBtn"[^>]*><span class="ds-action-icon" data-ds-icon="Search" aria-hidden="true"><\/span>/);
  assert.match(footer, /id="navDrawerShortcutsBtn"[^>]*><span class="ds-action-icon" data-ds-icon="Keyboard" aria-hidden="true"><\/span>/);
  assert.ok(!footer.includes('📲') && !footer.includes('🔍') && !footer.includes('⌨️'));
  assert.ok(footer.includes('📖')); // handbook untouched
  const modeRow = footer.indexOf('nav-drawer-footer-mode-row');
  assert.ok(modeRow !== -1);
  assert.ok(footer.indexOf('id="operatorModeToggleBtn"', modeRow) !== -1);
  assert.ok(footer.indexOf('id="navDrawerBackupButton"', modeRow) !== -1);
  // Mode left the icon tools row: it now sits after the mode-row opens.
  assert.ok(footer.indexOf('id="operatorModeToggleBtn"') > modeRow);
  const css = read('nav.css');
  assert.match(css, /\.nav-drawer-footer-mode-row > \* \{[^}]*flex: 1 1 0;[^}]*min-height: 36px/);
});

test('export buttons + pack heading: Lucide icons replace the emoji (Print A4 untouched)', () => {
  const html = read('index.html');
  for (const id of ['monthCloseExportBtn', 'rollForwardExportBtn', 'precloseSweepExportBtn', 'monthSnapshotExportBtn', 'monthSnapshotCompareExportBtn', 'ownerReportPackCsvBtn']) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at !== -1, `${id} exists`);
    const button = html.slice(at, html.indexOf('</button>', at));
    assert.ok(button.includes('data-ds-icon="Download"'), `${id} carries the Download icon`);
    assert.ok(!button.includes('📥'), `${id} has no 📥 left`);
  }
  const heading = html.slice(html.indexOf('id="ownerReportPackTitle"'), html.indexOf('</h2>', html.indexOf('id="ownerReportPackTitle"')));
  assert.ok(heading.includes('data-ds-icon="Package"'));
  assert.ok(!heading.includes('📦'));
  const opener = html.slice(html.indexOf('id="ownerReportPackBtn"'), html.indexOf('</button>', html.indexOf('id="ownerReportPackBtn"')));
  assert.ok(opener.includes('data-ds-icon="Package"'));
  assert.ok(html.includes('📄 Print A4')); // out of scope, left alone
});

test('audit captions: four month-end captions collapse behind <details>', () => {
  const html = read('index.html');
  assert.equal((html.match(/<details class="audit-explainer">/g) || []).length, 4);
  assert.equal((html.match(/ⓘ How this audit rule works/g) || []).length, 4);
  // The full caption text stays verbatim inside the details block.
  assert.ok(html.includes('Read-only audit record, taken only when the month-end checklist records the month as closed'));
});
