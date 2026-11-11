import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWhatsAppNumber,
  calculateHomeTodaySummary,
  generateOwnerDailySummaryWhatsAppText,
  renderHomeTodaySummary
} from '../home-today.js';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';

test('normalizeWhatsAppNumber handles local and international Pakistani numbers', () => {
  assert.equal(normalizeWhatsAppNumber('03001234567'), '923001234567');
  assert.equal(normalizeWhatsAppNumber('0300-1234567'), '923001234567');
  assert.equal(normalizeWhatsAppNumber('923001234567'), '923001234567');
  assert.equal(normalizeWhatsAppNumber('+92 300 1234567'), '923001234567');
  assert.equal(normalizeWhatsAppNumber('3001234567'), '923001234567');
  assert.equal(normalizeWhatsAppNumber(''), '');
});

test('calculateHomeTodaySummary computes today collections, month targets and top overdue', () => {
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  // Add 3 customers
  state = addCustomer(state, 'Asim Khan', refDate, {
    phone: '03001112233',
    monthlySellingAmount: 2000,
    mohalla: 'Main Bazaar',
    createdAt: '2026-10-01'
  });
  const cust1Id = state.customers[state.customers.length - 1].id;

  state = addCustomer(state, 'Bilal Ahmed', refDate, {
    phone: '03219998877',
    monthlySellingAmount: 3500,
    mohalla: 'Kot Mohibbu',
    createdAt: '2026-10-02'
  });
  const cust2Id = state.customers[state.customers.length - 1].id;

  state = addCustomer(state, 'Chaudhry Tariq', refDate, {
    phone: '03456667788',
    monthlySellingAmount: 1500,
    mohalla: 'Saeed Park'
  });
  const cust3Id = state.customers[state.customers.length - 1].id;
  // Mark cust3 as added in prior month
  state.customers[state.customers.length - 1].addedOn = '2026-09-15';

  // Save bills for 2026-10
  state = saveBillMonth(state, cust1Id, { month: '2026-10', dueAmount: 2000, status: 'pending' }, refDate);
  state = saveBillMonth(state, cust2Id, { month: '2026-10', dueAmount: 3500, status: 'pending' }, refDate);
  state = saveBillMonth(state, cust3Id, { month: '2026-10', dueAmount: 1500, status: 'pending' }, refDate);

  // Add cash payment today for cust1 (1000 cash)
  state = addPayment(state, cust1Id, '2026-10', {
    amount: 1000,
    method: 'Cash',
    date: '2026-10-15'
  }, refDate);

  // Add digital payment today for cust2 (1500 JazzCash)
  state = addPayment(state, cust2Id, '2026-10', {
    amount: 1500,
    method: 'JazzCash',
    date: '2026-10-15'
  }, refDate);

  const summary = calculateHomeTodaySummary(state, refDate);

  assert.equal(summary.todayStr, '2026-10-15');
  assert.equal(summary.todayCollected, 2500);
  assert.equal(summary.cashCollected, 1000);
  assert.equal(summary.digitalCollected, 1500);
  assert.equal(summary.todayCount, 2);

  // Month billed: 2000 + 3500 + 1500 = 7000
  assert.equal(summary.monthBilled, 7000);
  // Month collected: 2500
  assert.equal(summary.monthCollected, 2500);
  // Target %: Math.round(2500/7000 * 100) = 36%
  assert.equal(summary.targetPct, 36);

  // Remaining dues:
  // cust1: 1000 due
  // cust2: 2000 due
  // cust3: 1500 due
  // Total due = 4500
  assert.equal(summary.totalDue, 4500);
  assert.equal(summary.customersWithDuesCount, 3);

  // New customers created in 2026-10: cust1, cust2 -> 2
  assert.equal(summary.newCustomersThisMonth, 2);

  // Top overdue list should be ordered (Home Dashboard overhaul:
  // the preview is the top 3 now, so the field is topOverdue):
  // 1. Bilal Ahmed: 2000
  // 2. Chaudhry Tariq: 1500
  // 3. Asim Khan: 1000
  assert.equal(summary.topOverdue.length, 3);
  assert.equal(summary.topOverdue[0].name, 'Bilal Ahmed');
  assert.equal(summary.topOverdue[0].balanceDue, 2000);
  assert.equal(summary.topOverdue[1].name, 'Chaudhry Tariq');
  assert.equal(summary.topOverdue[1].balanceDue, 1500);
  assert.equal(summary.topOverdue[2].name, 'Asim Khan');
  assert.equal(summary.topOverdue[2].balanceDue, 1000);
});

test('generateOwnerDailySummaryWhatsAppText generates complete bilingual WhatsApp message', () => {
  const summary = {
    todayStr: '2026-10-15',
    todayCollected: 2500,
    todayCount: 2,
    cashCollected: 1000,
    digitalCollected: 1500,
    monthBilled: 7000,
    monthCollected: 2500,
    targetPct: 36,
    totalDue: 4500,
    customersWithDuesCount: 3,
    newCustomersThisMonth: 2,
    topOverdue: [
      { customerNumber: 102, name: 'Bilal Ahmed', mohalla: 'Kot Mohibbu', balanceDue: 2000 },
      { customerNumber: 103, name: 'Chaudhry Tariq', mohalla: 'Saeed Park', balanceDue: 1500 }
    ]
  };

  const text = generateOwnerDailySummaryWhatsAppText(summary, 'Shahdara Fiber Net');
  assert.ok(text.includes('Shahdara Fiber Net'));
  assert.ok(text.includes('2026-10-15'));
  assert.ok(text.includes('PKR 2,500'));
  assert.ok(text.includes('Cash: PKR 1,000'));
  assert.ok(text.includes('Digital: PKR 1,500'));
  assert.ok(text.includes('36%'));
  assert.ok(text.includes('PKR 4,500'));
  assert.ok(text.includes('#102 Bilal Ahmed (Kot Mohibbu): *PKR 2,000*'));
  assert.ok(text.includes('#103 Chaudhry Tariq (Saeed Park): *PKR 1,500*'));
});

test('renderHomeTodaySummary populates DOM elements and top 3 overdue cards', () => {
  const elements = {};
  const mockDoc = {
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = { textContent: '', innerHTML: '' };
      }
      return elements[id];
    }
  };

  const summary = {
    todayStr: '2026-10-15',
    todayCollected: 2500,
    todayCount: 2,
    cashCollected: 1000,
    digitalCollected: 1500,
    monthBilled: 7000,
    monthCollected: 2500,
    targetPct: 36,
    totalDue: 4500,
    customersWithDuesCount: 3,
    newCustomersThisMonth: 2,
    topOverdue: [
      { id: 'c1', customerNumber: 102, name: 'Bilal Ahmed', phone: '03219998877', mohalla: 'Kot Mohibbu', balanceDue: 2000 },
      { id: 'c2', customerNumber: 103, name: 'Chaudhry Tariq', phone: '', mohalla: 'Saeed Park', balanceDue: 1500 }
    ]
  };

  renderHomeTodaySummary(mockDoc, summary);

  assert.ok(elements['homeTodayDateText'].textContent.includes('2026-10-15'));
  assert.equal(elements['homeTodayCollected'].textContent, 'PKR 2,500');
  assert.ok(elements['homeTodayCashVsDigital'].textContent.includes('Cash: PKR 1,000'));
  assert.ok(elements['homeTodayCashVsDigital'].textContent.includes('Digital: PKR 1,500'));
  assert.equal(elements['homeTodayTargetPct'].textContent, '36%');
  assert.equal(elements['homeTodayTotalDues'].textContent, 'PKR 4,500');
  assert.equal(elements['homeTodayDuesCount'].textContent, '3 accounts with dues');
  assert.equal(elements['homeTodayNewCustomers'].textContent, '2');

  const listHtml = elements['homeTopOverdueList'].innerHTML;
  assert.ok(listHtml.includes('#102'));
  assert.ok(listHtml.includes('Bilal Ahmed'));
  assert.ok(listHtml.includes('PKR 2,000'));
  assert.ok(listHtml.includes('https://wa.me/923219998877'));
  assert.ok(listHtml.includes('#quick-collect/c1'));
  assert.ok(listHtml.includes('#103'));
  assert.ok(listHtml.includes('Chaudhry Tariq'));
  assert.ok(listHtml.includes('PKR 1,500'));
});

test('calculateHomeTodaySummary: connectionDate decides the new-connection month, and a voided payment counts nowhere', () => {
  // Home Dashboard overhaul, Part 1: the old addedOn-first order
  // counted a customer in the month their profile was typed, not
  // the month they were connected, and disagreed with the KPI
  // strip (Plan 477 rule) by one. A voided receipt is history,
  // never a payment — it must not inflate today or month totals.
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  // D: profile typed in October, connected in September — NOT new.
  state = addCustomer(state, 'Typed Oct', refDate, { monthlySellingAmount: 2000, createdAt: '2026-10-03' });
  state.customers[state.customers.length - 1].addedOn = '2026-10-03';
  state.customers[state.customers.length - 1].connectionDate = '2026-09-20';
  // E: profile typed in September, connected in October — IS new.
  state = addCustomer(state, 'Connected Oct', refDate, { monthlySellingAmount: 2000, createdAt: '2026-09-10' });
  state.customers[state.customers.length - 1].addedOn = '2026-09-10';
  state.customers[state.customers.length - 1].connectionDate = '2026-10-05';
  // F: 1000 paid today, then voided — collects nothing, still owes.
  state = addCustomer(state, 'Voided Pay', refDate, { monthlySellingAmount: 1000, createdAt: '2026-10-01' });
  const custF = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-10-01';
  state = saveBillMonth(state, custF, { month: '2026-10', dueAmount: 1000, status: 'pending' }, refDate);
  state = addPayment(state, custF, '2026-10', { amount: 1000, method: 'Cash', date: '2026-10-15' }, refDate);
  state.customers[state.customers.length - 1].bills.find((b) => b.month === '2026-10').payments[0].voided = true;

  const summary = calculateHomeTodaySummary(state, refDate);
  assert.equal(summary.newCustomersThisMonth, 2, 'E (connected Oct) and F (connected Oct) count; D (connected Sep) does not');
  assert.equal(summary.todayCollected, 0, 'voided payment is not today collection');
  assert.equal(summary.todayCount, 0, 'voided payment is not a today payment');
  assert.equal(summary.monthCollected, 0, 'voided payment is not month collection');
  assert.equal(summary.totalDue, 1000, 'voided payment leaves the full bill due');
});
