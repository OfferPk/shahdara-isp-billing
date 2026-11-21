// Smart Alerts cleanup: compact header, collapsed history row, structured
// collection card. No parity total is asserted anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCREENS, headerSpecForScreen } from '../screen-router.js';
import { buildSmartAlerts } from '../owner-insights.js';
import { formatHisaabDate } from '../dashboard-pnl.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const router = read('screen-router.js');
const ui = read('owner-ui.js');

const referenceDate = new Date('2026-10-07T12:00:00+05:00');
const bill = (month, { amount = 1000, dueDate = null, packageName = null, payments = [] } = {}) => ({ id: `${month}-${dueDate ?? 'none'}-${packageName ?? 'none'}`, month, dueAmount: amount, dueDate, payments, ...(packageName ? { packageSnapshot: { label: packageName } } : {}) });
const payment = (date, amount) => ({ id: `payment-${date}-${amount}`, date, amount, method: 'Cash' });
const customer = (id, name, bills = [], extra = {}) => ({ id, customerNumber: Number(id.replace(/\D/g, '')) || 1, name, serviceStatus: 'not-set', packageSpeed: 'Current manual package', packageHistory: [], bills, ...extra });
const stateOf = (customers = [], expenses = []) => ({ version: 1, customers, expenses, inventoryItems: [], inventoryMovements: [], monthlyClosings: [] });
const alert = (result, id) => result.alerts.find(row => row.id === id);

test('alerts screen has no header action: the View Alerts button only scrolled to the panel already on screen', () => {
  assert.equal('action' in SCREENS.alerts, false);
  const header = headerSpecForScreen('alerts');
  assert.equal(header.actionLabel, null);
  assert.equal(header.actionKind, null);
  assert.equal(header.actionTarget, null);
  // The screen stays reachable: route + More menu + drawer.
  assert.ok(router.includes("alerts: { view: 'billingReportsView'"));
  assert.ok(index.includes('data-mobile-more="alerts"'));
});

test('panel heading: the Status tab gives Smart Alerts a visible heading reusing drawer_alerts', () => {
  // Reports Tab REVERSAL of the #1557 removal: the panel now sits in the
  // Status tab, where every other panel has a visible heading, so it
  // gets one too — reusing the existing drawer_alerts key, no new key.
  // The router header stays the screen title; the panel heading is the
  // in-tab label, the same pattern as the duesRecoveryHeading.
  assert.ok(index.includes('id="smartAlertsHeading"'), 'panel heading exists');
  assert.ok(index.includes('<h3 id="smartAlertsHeading" data-i18n="drawer_alerts">Smart Alerts</h3>'), 'heading reuses drawer_alerts');
  assert.ok(index.includes('<section id="smartAlertsPanel" class="owner-report-panel" aria-labelledby="smartAlertsSummary">'));
  assert.equal(index.includes('LOCAL-ONLY · RULE-BASED'), false);
  assert.equal(index.includes('Derived on this device'), false);
  for (const id of ['smartAlertsPanel', 'smartAlertsSummary', 'smartAlertsList']) assert.ok(index.includes(`id="${id}"`), `${id} is present`);
});

test('summary is one compact line: count plus the checked date, no verbose sentence', () => {
  assert.ok(ui.includes("alert${result.alerts.length===1?'':'s'} · checked ${formatHisaabDate(result.asOf)}"));
  assert.equal(ui.includes('No customer is contacted automatically'), false);
  assert.equal(formatHisaabDate('2026-11-20'), '20 Nov 2026');
  assert.equal(formatHisaabDate('2026-10-07'), '07 Oct 2026');
});

test('insufficient history renders as one collapsed row with a live count', () => {
  assert.equal(ui.includes('<section class="smart-alert-insufficient"'), false);
  assert.ok(ui.includes('<details class="smart-alert-rule-details" aria-label="Comparisons with insufficient history">'));
  assert.ok(ui.includes('<summary>Some comparisons need more local history (${result.insufficient.length})</summary>'));
});

test('collection card leads with the bold comparison and drops the footnote', () => {
  const collectionBill = bill('2026-10', { amount: 100000, payments: [payment('2026-09-30', 10000), payment('2026-09-23', 12000), payment('2026-09-16', 9000), payment('2026-10-07', 1000)] });
  const result = buildSmartAlerts(stateOf([customer('c1', 'Ali', [collectionBill])]), referenceDate);
  const row = alert(result, 'collection-below-weekday-baseline');
  assert.ok(row);
  assert.match(row.detailLead, /Today: PKR 1,000 vs PKR 10,333\.33 average across 3 receipt-bearing same-weekday/);
  assert.equal(row.detail, 'Alert threshold: below 80% of baseline.');
  assert.equal(row.detail.includes('no daily snapshots are saved'), false);
  assert.equal(row.detailLead.includes('below 80%'), false);
});

test('alert computations are unchanged: same alert and insufficient ids for the same saved state', () => {
  const collectionBill = bill('2026-10', { amount: 100000, payments: [payment('2026-09-30', 10000), payment('2026-09-23', 12000), payment('2026-09-16', 9000), payment('2026-10-07', 1000)] });
  const result = buildSmartAlerts(stateOf([customer('c1', 'Ali', [collectionBill])]), referenceDate);
  assert.deepEqual(result.alerts.map(row => row.id), ['collection-below-weekday-baseline']);
  assert.deepEqual(result.insufficient.map(row => row.id), ['package-counts']);
  assert.equal(result.allClear, false);
  const thin = buildSmartAlerts(stateOf([], [{ date: '2026-09-07', amount: 1000, category: 'Repair' }, { date: '2026-10-07', amount: 5000, category: 'Repair' }]), referenceDate);
  assert.ok(thin.insufficient.some(row => row.id === 'expense-baseline-Repair'));
  assert.ok(thin.insufficient.some(row => row.id === 'collection-baseline'));
});
