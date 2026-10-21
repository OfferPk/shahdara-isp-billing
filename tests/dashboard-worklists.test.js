import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import {
  calculateDisconnectReconnectWorklists,
  markCustomerDisconnected,
  markCustomerReconnected,
  revertCustomerServiceStatus,
  renderWorklistsSvg,
  generateWorklistsCsv,
  generateWorklistsPrintHtml,
  generateWorklistsBriefing,
  setupWorklistsModal,
  getWorklistRules,
  saveWorklistRules,
  DEFAULT_WORKLIST_RULES,
  formatDateYmd,
  diffCalendarDays,
  parseBillDueDateString
} from '../dashboard-worklists.js';
import * as dashboardExports from '../dashboard.js';

function createSampleBillingState() {
  const refDate = new Date('2026-04-25T12:00:00Z');
  let state = createInitialState([]);

  // Customer 1: Active, Overdue > 10 days (due April 10, ref April 25 -> 15 days overdue), balance 2000
  // Should be in "To Disconnect"
  state = addCustomer(state, 'Tariq Mehmood', refDate, {
    phone: '03001234567',
    mohalla: 'Main Bazaar',
    serviceStatus: 'active'
  });
  const c1 = state.customers[state.customers.length - 1];
  c1.area = 'Shahdara Town';
  c1.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, c1.id, { month: '2026-04', dueAmount: 2000, dueDate: '2026-04-10', status: 'pending' }, refDate);

  // Customer 2: Active, Overdue exactly 10 days (due April 15, ref April 25 -> 10 days overdue), balance 1500
  // Overdue > 10 is false -> Should NOT be in "To Disconnect" (boundary test)
  state = addCustomer(state, 'Imran Khan', refDate, {
    phone: '03009876543',
    mohalla: 'Station Road',
    serviceStatus: 'active'
  });
  const c2 = state.customers[state.customers.length - 1];
  c2.area = 'Baradari';
  c2.packageSpeed = '10 Mbps';
  state = saveBillMonth(state, c2.id, { month: '2026-04', dueAmount: 1500, dueDate: '2026-04-15', status: 'pending' }, refDate);

  // Customer 3: Active, Overdue 11 days (due April 14, ref April 25 -> 11 days overdue), balance 2500
  // Overdue > 10 is true -> Should be in "To Disconnect" (boundary test)
  state = addCustomer(state, 'Zahid Hussain', refDate, {
    phone: '03215556677',
    mohalla: 'Kot Mohalla',
    serviceStatus: 'active'
  });
  const c3 = state.customers[state.customers.length - 1];
  c3.area = 'Shahdara Town';
  c3.packageSpeed = '20 Mbps';
  state = saveBillMonth(state, c3.id, { month: '2026-04', dueAmount: 2500, dueDate: '2026-04-14', status: 'pending' }, refDate);

  // Customer 4: Offline (Disconnected), dues fully paid (balance 0)
  // Should be in "To Reconnect"
  state = addCustomer(state, 'Bilal Ahmed', refDate, {
    phone: '03334445566',
    mohalla: 'Gulshan Colony',
    serviceStatus: 'offline'
  });
  const c4 = state.customers[state.customers.length - 1];
  c4.area = 'Begum Kot';
  c4.packageSpeed = '25 Mbps';
  c4.cancellationDate = '2026-04-12';
  state = saveBillMonth(state, c4.id, { month: '2026-04', dueAmount: 3000, dueDate: '2026-04-10', status: 'pending' }, refDate);
  state = addPayment(state, c4.id, '2026-04', {
    amount: 3000,
    date: '2026-04-20',
    method: 'JazzCash'
  }, refDate);

  // Customer 5: Offline (Disconnected), but dues still unpaid (balance 1800)
  // Should NOT be in "To Reconnect" and NOT in "To Disconnect"
  state = addCustomer(state, 'Farhan Ali', refDate, {
    phone: '03451122334',
    mohalla: 'Chungi Amar Sidhu',
    serviceStatus: 'offline'
  });
  const c5 = state.customers[state.customers.length - 1];
  c5.area = 'Jia Musa';
  c5.packageSpeed = '10 Mbps';
  c5.cancellationDate = '2026-04-15';
  state = saveBillMonth(state, c5.id, { month: '2026-04', dueAmount: 1800, dueDate: '2026-04-10', status: 'pending' }, refDate);

  // Customer 6: Archived customer
  // Should NEVER be in either list
  state = addCustomer(state, 'Old Archived User', refDate, {
    phone: '03000000000',
    mohalla: 'Old Bazaar',
    serviceStatus: 'offline'
  });
  const c6 = state.customers[state.customers.length - 1];
  state = saveBillMonth(state, c6.id, { month: '2026-04', dueAmount: 5000, dueDate: '2026-04-10', status: 'pending' }, refDate);
  c6.archived = true;

  return { state, refDate, c1, c2, c3, c4, c5, c6 };
}

test('dashboard-worklists: formatDateYmd and diffCalendarDays compute calendar days in PKT', () => {
  const d = new Date('2026-04-15T22:30:00Z'); // In PKT (UTC+5), this is 2026-04-16T03:30
  assert.equal(formatDateYmd(d), '2026-04-16');

  // Calendar day diff
  assert.equal(diffCalendarDays('2026-04-25', '2026-04-15'), 10);
  assert.equal(diffCalendarDays('2026-04-25', '2026-04-25'), 0);
  assert.equal(diffCalendarDays('2026-04-10', '2026-04-25'), -15);
});

test('dashboard-worklists: parseBillDueDateString resolves explicit dueDate and month default', () => {
  assert.equal(parseBillDueDateString({ dueDate: '2026-04-15', month: '2026-04' }), '2026-04-15');
  assert.equal(parseBillDueDateString({ month: '2026-04' }), '2026-04-10');
  assert.equal(parseBillDueDateString(null), null);
});

test('dashboard-worklists: getWorklistRules and saveWorklistRules manage default thresholds', () => {
  const defaults = getWorklistRules();
  assert.equal(defaults.disconnectOverdueDays, 10);
  assert.equal(defaults.disconnectMinBalance, 0);
  assert.equal(defaults.reconnectMaxBalance, 0);

  const custom = saveWorklistRules({
    disconnectOverdueDays: 15,
    disconnectMinBalance: 500,
    reconnectMaxBalance: 100
  });
  assert.equal(custom.disconnectOverdueDays, 15);
  assert.equal(custom.disconnectMinBalance, 500);

  // Restore defaults
  saveWorklistRules(DEFAULT_WORKLIST_RULES);
});

test('dashboard-worklists: calculateDisconnectReconnectWorklists evaluates exact PKT boundaries', () => {
  const { state, refDate } = createSampleBillingState();
  const worklists = calculateDisconnectReconnectWorklists(state, {
    referenceDate: refDate,
    rules: { disconnectOverdueDays: 10, disconnectMinBalance: 0, reconnectMaxBalance: 0 }
  });

  // Verify KPIs
  assert.equal(worklists.referenceDate, '2026-04-25');
  assert.equal(worklists.kpis.toDisconnectCount, 2, 'Should include Tariq (15d late) and Zahid (11d late)');
  assert.equal(worklists.kpis.toDisconnectTotalAmount, 4500, '2000 + 2500');
  assert.equal(worklists.kpis.toReconnectCount, 1, 'Should include Bilal whose dues are cleared');
  assert.equal(worklists.kpis.totalActionable, 3);

  // Check To Disconnect List
  const discIds = worklists.toDisconnect.map(c => c.name);
  assert.ok(discIds.includes('Tariq Mehmood'), 'Tariq (15 days overdue > 10) must be scheduled for disconnect');
  assert.ok(discIds.includes('Zahid Hussain'), 'Zahid (11 days overdue > 10) must be scheduled for disconnect');
  assert.ok(!discIds.includes('Imran Khan'), 'Imran (exactly 10 days overdue, not > 10) must NOT be in disconnect list');
  assert.ok(!discIds.includes('Bilal Ahmed'), 'Bilal is offline and cleared; must NOT be in disconnect list');
  assert.ok(!discIds.includes('Farhan Ali'), 'Farhan is already offline; must NOT be in disconnect list');
  assert.ok(!discIds.includes('Old Archived User'), 'Archived user must NOT be in disconnect list');

  // Check To Reconnect List
  const recNames = worklists.toReconnect.map(c => c.name);
  assert.ok(recNames.includes('Bilal Ahmed'), 'Bilal (offline with 0 balance) must be scheduled for reconnect');
  assert.ok(!recNames.includes('Farhan Ali'), 'Farhan (offline with 1800 dues) must NOT be scheduled for reconnect');
  assert.ok(!recNames.includes('Tariq Mehmood'), 'Tariq is active; must NOT be in reconnect list');
});

test('dashboard-worklists: custom threshold rules modify worklist filtering', () => {
  const { state, refDate } = createSampleBillingState();

  // Test with overdueDays = 12: Tariq (15d) is in, Zahid (11d) is OUT
  const w1 = calculateDisconnectReconnectWorklists(state, {
    referenceDate: refDate,
    rules: { disconnectOverdueDays: 12, disconnectMinBalance: 0, reconnectMaxBalance: 0 }
  });
  assert.equal(w1.toDisconnect.length, 1);
  assert.equal(w1.toDisconnect[0].name, 'Tariq Mehmood');

  // Test with minBalance = 2200: Zahid (2500) is in, Tariq (2000) is OUT
  const w2 = calculateDisconnectReconnectWorklists(state, {
    referenceDate: refDate,
    rules: { disconnectOverdueDays: 10, disconnectMinBalance: 2200, reconnectMaxBalance: 0 }
  });
  assert.equal(w2.toDisconnect.length, 1);
  assert.equal(w2.toDisconnect[0].name, 'Zahid Hussain');
});

test('dashboard-worklists: markCustomerDisconnected updates serviceStatus and cancellationDate reversibly', () => {
  const { state, refDate, c1 } = createSampleBillingState();
  assert.equal(c1.serviceStatus, 'active');

  const { newState, previousStatus, previousCancellationDate } = markCustomerDisconnected(state, c1.id, { referenceDate: refDate });
  const updated = newState.customers.find(c => c.id === c1.id);

  assert.equal(updated.serviceStatus, 'offline', 'serviceStatus must be updated to offline');
  assert.equal(updated.cancellationDate, '2026-04-25', 'cancellationDate must record the PKT action date');
  assert.equal(previousStatus, 'active');
  assert.equal(previousCancellationDate, null);

  // Now test reversibility (Undo)
  const revertedState = revertCustomerServiceStatus(newState, c1.id, previousStatus, { cancellationDate: previousCancellationDate }, refDate);
  const reverted = revertedState.customers.find(c => c.id === c1.id);

  assert.equal(reverted.serviceStatus, 'active', 'reverting must restore active status');
  assert.equal(reverted.cancellationDate, null, 'reverting must restore previous cancellationDate');
});

test('dashboard-worklists: markCustomerReconnected updates serviceStatus and connectionDate reversibly', () => {
  const { state, refDate, c4 } = createSampleBillingState();
  assert.equal(c4.serviceStatus, 'offline');

  const { newState, previousStatus, previousConnectionDate } = markCustomerReconnected(state, c4.id, { referenceDate: refDate });
  const updated = newState.customers.find(c => c.id === c4.id);

  assert.equal(updated.serviceStatus, 'active', 'serviceStatus must be updated to active');
  assert.equal(updated.connectionDate, '2026-04-25', 'connectionDate must record the PKT reconnection date');
  assert.equal(updated.cancellationDate, null, 'cancellationDate must be cleared on reconnection');

  // Now test reversibility (Undo)
  const revertedState = revertCustomerServiceStatus(newState, c4.id, previousStatus, { connectionDate: previousConnectionDate, cancellationDate: '2026-04-12' }, refDate);
  const reverted = revertedState.customers.find(c => c.id === c4.id);

  assert.equal(reverted.serviceStatus, 'offline', 'reverting must restore offline status');
  assert.equal(reverted.cancellationDate, '2026-04-12');
});

test('dashboard-worklists: renderWorklistsSvg produces valid vector SVG telemetry markup', () => {
  const { state, refDate } = createSampleBillingState();
  const data = calculateDisconnectReconnectWorklists(state, { referenceDate: refDate });
  const svg = renderWorklistsSvg(data);

  assert.ok(svg.includes('<svg'), 'Must produce an SVG tag');
  assert.ok(svg.includes('TO DISCONNECT'), 'Must contain Disconnect label');
  assert.ok(svg.includes('TO RECONNECT'), 'Must contain Reconnect label');
  assert.ok(svg.includes('2026-04-25'), 'Must display reference date in PKT');
});

test('dashboard-worklists: generateWorklistsCsv produces RFC-4180 CSV with UTF-8 BOM', () => {
  const { state, refDate } = createSampleBillingState();
  const data = calculateDisconnectReconnectWorklists(state, { referenceDate: refDate });
  const csv = generateWorklistsCsv(data);

  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('SECTION 1: TO DISCONNECT'), 'Must contain Disconnect section');
  assert.ok(csv.includes('SECTION 2: TO RECONNECT'), 'Must contain Reconnect section');
  assert.ok(csv.includes('Tariq Mehmood'), 'Must list Tariq');
  assert.ok(csv.includes('Bilal Ahmed'), 'Must list Bilal');
});

test('dashboard-worklists: generateWorklistsPrintHtml formats printable field work orders', () => {
  const { state, refDate } = createSampleBillingState();
  const data = calculateDisconnectReconnectWorklists(state, { referenceDate: refDate });
  const html = generateWorklistsPrintHtml(data);

  assert.ok(html.includes('Field Work Orders'), 'Must have title');
  assert.ok(html.includes('TO DISCONNECT'), 'Must have disconnect section');
  assert.ok(html.includes('TO RECONNECT'), 'Must have reconnect section');
  assert.ok(html.includes('Tariq Mehmood'), 'Must include customer name');
});

test('dashboard-worklists: generateWorklistsBriefing formats field dispatch manifest', () => {
  const { state, refDate } = createSampleBillingState();
  const data = calculateDisconnectReconnectWorklists(state, { referenceDate: refDate });
  const briefing = generateWorklistsBriefing(data);

  assert.ok(briefing.includes('SHAHDARA ISP - FIELD ACTION MANIFEST'));
  assert.ok(briefing.includes('TO DISCONNECT'));
  assert.ok(briefing.includes('TO RECONNECT'));
  assert.ok(briefing.includes('Tariq Mehmood'));
  assert.ok(briefing.includes('Bilal Ahmed'));
});

test('dashboard-worklists: dashboard.js re-exports all worklist functions correctly', () => {
  assert.equal(typeof dashboardExports.calculateDisconnectReconnectWorklists, 'function');
  assert.equal(typeof dashboardExports.markCustomerDisconnected, 'function');
  assert.equal(typeof dashboardExports.markCustomerReconnected, 'function');
  assert.equal(typeof dashboardExports.revertCustomerServiceStatus, 'function');
  assert.equal(typeof dashboardExports.renderWorklistsSvg, 'function');
  assert.equal(typeof dashboardExports.generateWorklistsCsv, 'function');
  assert.equal(typeof dashboardExports.generateWorklistsPrintHtml, 'function');
  assert.equal(typeof dashboardExports.generateWorklistsBriefing, 'function');
  assert.equal(typeof dashboardExports.setupWorklistsModal, 'function');
});

test('dashboard-collection-target: confirm popup is replaced with appConfirm', async () => {
  const fs = await import('node:fs/promises');
  const code = await fs.readFile('dashboard-collection-target.js', 'utf-8');
  assert.ok(!code.includes('if (confirm(`Remove the target'), 'Browser confirm() must not be used for remove collection target');
  assert.ok(code.includes('appConfirm'), 'window.appConfirm must be used');
});
