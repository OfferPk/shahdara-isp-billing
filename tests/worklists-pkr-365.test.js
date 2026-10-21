import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, saveBillMonth, addPayment, formatPKR } from '../core.js';
import {
  calculateDisconnectReconnectWorklists,
  renderWorklistsSvg,
  generateWorklistsCsv,
  generateWorklistsPrintHtml,
  generateWorklistsBriefing
} from '../dashboard-worklists.js';

// Issue #365: formatPKR() already returns "PKR 1,000" — the worklist surface
// must never prefix another "PKR " (it produced "PKR PKR 73,000" on the Home
// card, modal, print work orders and the WhatsApp dispatch manifest).

function createWorklistState() {
  const refDate = new Date('2026-04-25T12:00:00Z');
  let state = createInitialState([]);

  // To Disconnect: Tariq — 2000 due, 15 days overdue
  state = addCustomer(state, 'Tariq Mehmood', refDate, {
    phone: '03001234567', mohalla: 'Main Bazaar', serviceStatus: 'active'
  });
  const c1 = state.customers[state.customers.length - 1];
  c1.area = 'Shahdara Town';
  c1.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, c1.id, { month: '2026-04', dueAmount: 2000, dueDate: '2026-04-10', status: 'pending' }, refDate);

  // To Disconnect: Zahid — 2500 due, 11 days overdue (disconnect total = 4500)
  state = addCustomer(state, 'Zahid Hussain', refDate, {
    phone: '03215556677', mohalla: 'Kot Mohalla', serviceStatus: 'active'
  });
  const c3 = state.customers[state.customers.length - 1];
  c3.area = 'Shahdara Town';
  c3.packageSpeed = '20 Mbps';
  state = saveBillMonth(state, c3.id, { month: '2026-04', dueAmount: 2500, dueDate: '2026-04-14', status: 'pending' }, refDate);

  // To Reconnect: Bilal — offline, 3000 bill fully paid on 2026-04-20
  state = addCustomer(state, 'Bilal Ahmed', refDate, {
    phone: '03334445566', mohalla: 'Gulshan Colony', serviceStatus: 'offline'
  });
  const c4 = state.customers[state.customers.length - 1];
  c4.area = 'Begum Kot';
  c4.packageSpeed = '25 Mbps';
  c4.cancellationDate = '2026-04-12';
  state = saveBillMonth(state, c4.id, { month: '2026-04', dueAmount: 3000, dueDate: '2026-04-10', status: 'pending' }, refDate);
  state = addPayment(state, c4.id, '2026-04', { amount: 3000, date: '2026-04-20', method: 'JazzCash' }, refDate);

  return { state, refDate };
}

function worklistData() {
  const { state, refDate } = createWorklistState();
  return calculateDisconnectReconnectWorklists(state, { referenceDate: refDate });
}

test('worklists-pkr-365: formatPKR itself already carries the PKR prefix', () => {
  assert.equal(formatPKR(4500), 'PKR 4,500');
  assert.equal(formatPKR(0), 'PKR 0');
});

test('worklists-pkr-365: dispatch SVG graphic shows a single PKR', () => {
  const svg = renderWorklistsSvg(worklistData());
  assert.ok(!svg.includes('PKR PKR'), 'SVG must not contain doubled currency');
  assert.ok(svg.includes('PKR 4,500 dues (> 10d)'), 'SVG disconnect line must read "PKR 4,500 dues (> 10d)"');
});

test('worklists-pkr-365: print work orders show a single PKR', () => {
  const html = generateWorklistsPrintHtml(worklistData());
  assert.ok(!html.includes('PKR PKR'), 'Print HTML must not contain doubled currency');
  assert.ok(html.includes('2 accounts &bull; PKR 4,500'), 'Print KPI must read "2 accounts • PKR 4,500"');
  assert.ok(html.includes('<strong>PKR 2,000</strong>'), 'Print dues cell must read "PKR 2,000"');
  assert.ok(html.includes('<strong>PKR 3,000</strong>'), 'Print paid cell must read "PKR 3,000"');
});

test('worklists-pkr-365: WhatsApp dispatch manifest shows a single PKR', () => {
  const briefing = generateWorklistsBriefing(worklistData());
  assert.ok(!briefing.includes('PKR PKR'), 'Manifest must not contain doubled currency');
  assert.ok(briefing.includes('(Total: *PKR 4,500*)'), 'Manifest total must read "PKR 4,500"');
  assert.ok(briefing.includes('- PKR 2,000 [15d late]'), 'Manifest disconnect row must read "- PKR 2,000 [15d late]"');
  assert.ok(briefing.includes('- Paid PKR 3,000 on 2026-04-20'), 'Manifest reconnect row must read "- Paid PKR 3,000 on 2026-04-20"');
});

test('worklists-pkr-365: CSV export keeps raw amounts with no doubled currency', () => {
  const csv = generateWorklistsCsv(worklistData());
  assert.ok(!csv.includes('PKR PKR'), 'CSV must not contain doubled currency');
  assert.ok(csv.includes('Outstanding Dues (PKR)'), 'CSV keeps its (PKR) column header');
});
