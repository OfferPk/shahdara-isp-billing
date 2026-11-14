import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSLATIONS } from '../nav-language.js';
import {
  normalizeWhatsAppNumber,
  calculateHomeTodaySummary,
  generateOwnerDailySummaryWhatsAppText,
  renderHomeTodaySummary
} from '../home-today.js';
import { createInitialState, addCustomer, saveBillMonth, addPayment, calculatePaymentAllocations, applyConcessionToBill, addManualBaqayaEntry } from '../core.js';
import { totalOutstandingFigures } from '../manual-baqaya.js';

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
  // Home Dashboard polish (A4, reading (a)): the amount AND the note
  // chips live in the sub-line; the amount column is gone.
  assert.ok(!listHtml.includes('overdue-amount-col'), 'the amount column is deleted from the render');
  const subStart = listHtml.indexOf('overdue-item-sub');
  assert.ok(subStart >= 0, 'sub-line exists');
  assert.ok(listHtml.indexOf('PKR 2,000') > subStart, 'the amount sits inside the sub-line');
  assert.ok(listHtml.indexOf('pkr-note-chips') > subStart, 'the note chips sit inside the sub-line');
  assert.ok(listHtml.includes('₨1000 ×2'), 'PKR 2,000 breaks down to two 1000 chips');
  assert.ok(listHtml.includes('overdue-item-name'), 'the name still carries its ellipsis class');
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

test('home dashboard polish (A4): Collect is a solid emerald 32px nowrap pill', () => {
  const css = readFileSync(new URL('../screen-router.css', import.meta.url), 'utf8');
  // The light rule lives after the dark block (it wins in light mode);
  // the grey pill is gone.
  const start = css.indexOf('.overdue-collect-link {', css.indexOf('Home Dashboard polish (A4): the Collect button'));
  assert.ok(start >= 0, 'Collect rule exists after the A4 comment');
  const block = css.slice(start, start + 400);
  assert.ok(!block.includes('#eef3f0'), 'the grey Collect pill is gone');
  assert.ok(block.includes('white-space: nowrap'), 'Collect never clips its label');
  assert.ok(block.includes('flex-shrink: 0'), 'Collect never shrinks');
  assert.ok(block.includes('height: 32px'), 'Collect is 32px tall');
  assert.ok(block.includes('background: var(--ds-brand'), 'Collect is solid brand emerald');
  assert.ok(block.includes('color: var(--white)'), 'Collect text is white (the spec #fff as a token)');
  assert.ok(css.includes('[data-theme="dark"] .overdue-collect-link {'), 'dark mode keeps the emerald Collect');
});

test('home dashboard polish (A4): View all stays on one line', () => {
  const css = readFileSync(new URL('../screen-router.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.overdue-view-all-link {'), css.indexOf('.overdue-view-all-link {') + 200);
  assert.ok(block.includes('white-space: nowrap'), 'View all never wraps');
  assert.ok(block.includes('flex-shrink: 0'), 'View all never shrinks');
  assert.equal(TRANSLATIONS.en.dash_today_overdue_all, 'View all →', 'EN View-all label');
  assert.equal(TRANSLATIONS.ur.dash_today_overdue_all, 'سب دیکھیں →', 'UR View-all label');
});

test('home dashboard polish (A4): a Top-3 row with a WhatsApp link does not overflow at 320px (source-scan; no live harness)', () => {
  // No live 360/320px harness runs in this sandbox (plan552
  // precedent): the contract is asserted on the source instead — the
  // amount column is gone, the left column takes the remaining width,
  // and the Collect link cannot shrink or wrap. The mid-scroll FAB
  // overlap is a separate, recorded-not-blessed item (PR #1390) and
  // is NOT claimed fixed here.
  const css = readFileSync(new URL('../screen-router.css', import.meta.url), 'utf8');
  const homeToday = readFileSync(new URL('../home-today.js', import.meta.url), 'utf8');
  assert.ok(!homeToday.includes('class="overdue-amount-col"'), 'no amount column widens the row');
  assert.ok(css.includes('.overdue-item-info {'), 'left column rule exists');
  const info = css.slice(css.indexOf('.overdue-item-info {'), css.indexOf('.overdue-item-info {') + 200);
  assert.ok(info.includes('flex: 1'), 'left column takes the remaining width');
  assert.ok(info.includes('min-width: 0'), 'left column may shrink');
});

test('Sharafat 19: a bill fully covered by applied credit drops out of Top 3', () => {
  // Raw due−paid would still rank this customer: Sep due 1000, paid
  // 1000 in Sep, Oct due 1500, paid 0 in Oct. The engine sees the
  // 1500 excess from September as advance credit that settles
  // October in full — so the customer owes nothing and must not rank.
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  state = addCustomer(state, 'Covered By Credit', refDate, {
    phone: '03001112233',
    monthlySellingAmount: 1500,
    mohalla: 'Main Bazaar',
    createdAt: '2026-09-01'
  });
  const coveredId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-09-01';
  state = saveBillMonth(state, coveredId, { month: '2026-09', dueAmount: 1000, status: 'pending' }, refDate);
  state = saveBillMonth(state, coveredId, { month: '2026-10', dueAmount: 1500, status: 'pending' }, refDate);
  state = addPayment(state, coveredId, '2026-09', {
    amount: 2500,
    method: 'Cash',
    date: '2026-09-20'
  }, refDate);

  // Still owing: Oct bill 500, unpaid.
  state = addCustomer(state, 'Still Owing', refDate, {
    phone: '03004445566',
    monthlySellingAmount: 500,
    mohalla: 'Kot Mohibbu',
    createdAt: '2026-10-01'
  });
  const owingId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-10-01';
  state = saveBillMonth(state, owingId, { month: '2026-10', dueAmount: 500, status: 'pending' }, refDate);

  const summary = calculateHomeTodaySummary(state, refDate);
  assert.equal(summary.topOverdue.length, 1, 'the credit-covered customer drops out');
  assert.equal(summary.topOverdue[0].name, 'Still Owing');
  assert.equal(summary.topOverdue[0].balanceDue, 500);
  assert.equal(summary.customersWithDuesCount, 1);
  assert.equal(summary.totalDue, 500, 'the dashboard total agrees with Top 3');
  // The month figures stay raw (Sharafat 19 scope): Oct billed is
  // 1500 + 500, and the September payment is not October collection.
  assert.equal(summary.monthBilled, 2000);
  assert.equal(summary.monthCollected, 0);
  // The shown figure IS the profile's figure, not a re-derived one.
  const allocations = calculatePaymentAllocations(state);
  const owing = state.customers.find(c => c.id === owingId);
  assert.equal(summary.topOverdue[0].balanceDue, totalOutstandingFigures(owing, allocations).total);
});

test('Sharafat 19: a baqaya-only customer appears in Top 3 with the baqaya figure', () => {
  // No bills at all — only a manual baqaya entry. Raw due−paid
  // could never rank this customer; the engine figure includes it.
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  state = addCustomer(state, 'Baqaya Only', refDate, {
    phone: '03001112233',
    mohalla: 'Main Bazaar',
    createdAt: '2026-09-01'
  });
  const baqayaId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-09-01';
  state = addManualBaqayaEntry(state, baqayaId, { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, refDate);

  const summary = calculateHomeTodaySummary(state, refDate);
  assert.equal(summary.topOverdue.length, 1);
  assert.equal(summary.topOverdue[0].name, 'Baqaya Only');
  assert.equal(summary.topOverdue[0].balanceDue, 1500);
  assert.equal(summary.customersWithDuesCount, 1, 'the count now includes baqaya-only customers (see the PR body: the KPI defaulter count stays bills-only by design)');
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find(c => c.id === baqayaId);
  assert.equal(summary.topOverdue[0].balanceDue, totalOutstandingFigures(customer, allocations).total);
});

test('Sharafat 19: a voided payment leaves the full bill due in Top 3; a fully-paid bill drops out', () => {
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  // Voided: bill 1000, paid 1000 today, then voided — still owes 1000.
  state = addCustomer(state, 'Voided Pay', refDate, {
    phone: '03001112233',
    monthlySellingAmount: 1000,
    mohalla: 'Main Bazaar',
    createdAt: '2026-10-01'
  });
  const voidedId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-10-01';
  state = saveBillMonth(state, voidedId, { month: '2026-10', dueAmount: 1000, status: 'pending' }, refDate);
  state = addPayment(state, voidedId, '2026-10', {
    amount: 1000,
    method: 'Cash',
    date: '2026-10-15'
  }, refDate);
  state.customers[state.customers.length - 1].bills.find((b) => b.month === '2026-10').payments[0].voided = true;

  // Paid: bill 800, paid 800 — owes nothing, absent from Top 3.
  state = addCustomer(state, 'Fully Paid', refDate, {
    phone: '03004445566',
    monthlySellingAmount: 800,
    mohalla: 'Kot Mohibbu',
    createdAt: '2026-10-01'
  });
  const paidId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-10-01';
  state = saveBillMonth(state, paidId, { month: '2026-10', dueAmount: 800, status: 'pending' }, refDate);
  state = addPayment(state, paidId, '2026-10', {
    amount: 800,
    method: 'Cash',
    date: '2026-10-15'
  }, refDate);

  const summary = calculateHomeTodaySummary(state, refDate);
  assert.equal(summary.topOverdue.length, 1, 'only the voided-payment customer still owes');
  assert.equal(summary.topOverdue[0].name, 'Voided Pay');
  assert.equal(summary.topOverdue[0].balanceDue, 1000);
  assert.equal(summary.customersWithDuesCount, 1);
  assert.equal(summary.totalDue, 1000, 'the voided payment leaves the full bill due everywhere');
});

test('Sharafat 19: a concession-adjusted bill shows the reduced engine figure in Top 3', () => {
  // SISP-30 outage concession of 500 on a 2000 bill: the gross due
  // stays 2000 on the bill, but the engine — and the profile — read
  // 1500. Top 3 must show 1500, not the gross 2000.
  const refDate = new Date('2026-10-15T12:00:00Z');
  let state = createInitialState([]);

  state = addCustomer(state, 'Concession Case', refDate, {
    phone: '03001112233',
    monthlySellingAmount: 2000,
    mohalla: 'Main Bazaar',
    createdAt: '2026-10-01'
  });
  const custId = state.customers[state.customers.length - 1].id;
  state.customers[state.customers.length - 1].connectionDate = '2026-10-01';
  state = saveBillMonth(state, custId, { month: '2026-10', dueAmount: 2000, status: 'pending' }, refDate);
  state = applyConcessionToBill(state, custId, '2026-10', { amount: 500, reason: 'Outage concession' }, refDate);

  const summary = calculateHomeTodaySummary(state, refDate);
  assert.equal(summary.topOverdue.length, 1);
  assert.equal(summary.topOverdue[0].name, 'Concession Case');
  assert.equal(summary.topOverdue[0].balanceDue, 1500);
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find(c => c.id === custId);
  assert.equal(summary.topOverdue[0].balanceDue, totalOutstandingFigures(customer, allocations).total);
});
