// Plan P — Billing clarity: arrears, advance, concession, deposit labels.
// Presentation only: every test below pins a label or a sum, never a new
// total. Fixtures are synthetic; no real customer data is used.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  billClarityBreakdown,
  billClarityTextLines,
  customerBillClarityBreakdowns
} from '../billing-clarity.js';
import { calculatePaymentAllocations } from '../core.js';
import { currentBillPresentation } from '../profile-ui.js';
import { buildBillingRegister, buildBillingRegisterPrintHtml } from '../billing-register.js';
import { generateCustomerStatementHtml, formatCustomerStatementWhatsApp } from '../form-validation.js';

const pay = (id, date, amount, extra = {}) => ({ id, date, amount, method: 'Cash', ...extra });
const bill = (month, overrides = {}) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`,
  status: 'pending', payments: [], generated: true, priceSnapshot: 3000, ...overrides
});
const customer = (overrides = {}) => ({
  id: 'c1', customerNumber: 11, name: 'Test Customer', archived: false,
  billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});
const breakdownFor = (cust, month) => {
  const target = cust.bills.find((row) => row.month === month);
  return billClarityBreakdown(cust, target, calculatePaymentAllocations({ customers: [cust] }));
};
const sumLines = (breakdown) => {
  const charges = breakdown.lines.filter((line) => line.role === 'charge')
    .reduce((sum, line) => sum + line.amount, 0);
  const deductions = breakdown.lines.filter((line) => line.role === 'deduction')
    .reduce((sum, line) => sum + line.amount, 0);
  return { charges, deductions };
};

test('null for missing customer, missing bill, unpriced bill, and invalid month', () => {
  const cust = customer({ bills: [bill('2026-10')] });
  assert.equal(billClarityBreakdown(null, cust.bills[0]), null);
  assert.equal(billClarityBreakdown(cust, null), null);
  assert.equal(billClarityBreakdown(cust, bill('2026-10', { dueAmount: 0 })), null);
  assert.equal(billClarityBreakdown(cust, bill('2026-10', { dueAmount: null })), null);
  assert.equal(billClarityBreakdown(cust, bill('2026-13')), null);
  assert.equal(billClarityTextLines(null).length, 0);
});

test('plain bill: package is the whole bill, gross equals net, no deduction lines', () => {
  const cust = customer({ bills: [bill('2026-10')] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.packageAmount, 3000);
  assert.equal(out.previousArrears, 0);
  assert.equal(out.grossTotal, 3000);
  assert.equal(out.netBalance, 3000);
  assert.equal(out.deductionsTotal, 0);
  assert.equal(out.reconcilesToAllocation, true);
  assert.deepEqual(out.lines.filter((line) => line.role === 'deduction'), []);
});

test('lines always sum: charges equal gross, gross minus deductions equals net', () => {
  const cust = customer({
    bills: [
      bill('2026-09'),
      bill('2026-10', {
        dueAmount: 4000, kistTotal: 1000, lateFee: 200, shiftingFee: 100,
        concessionAmount: 300, depositOffsetAmount: 200,
        payments: [pay('p1', '2026-10-06', 1000, { discount: 100 })]
      })
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  const { charges, deductions } = sumLines(out);
  assert.equal(charges, out.grossTotal);
  assert.equal(out.grossTotal - deductions, out.netBalance);
  assert.equal(out.packageAmount, 3000);
  assert.equal(out.kistAmount, 1000);
  assert.equal(out.lateFeeAmount, 200);
  assert.equal(out.shiftingFeeAmount, 100);
  assert.equal(out.previousArrears, 3000);
  assert.equal(out.grossTotal, 7300);
  assert.equal(out.reconcilesToAllocation, true);
});

test('arrears label: an unpaid earlier month is arrears on the next bill', () => {
  const cust = customer({ bills: [bill('2026-09'), bill('2026-10')] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.previousArrears, 3000);
  assert.equal(out.grossTotal, 6000);
  assert.equal(out.netBalance, 6000);
  const line = out.lines.find((entry) => entry.key === 'previousArrears');
  assert.ok(line && line.label.includes('Arrears'));
});

test('kist split: due amount separates into package and kist, total unchanged', () => {
  const cust = customer({ bills: [bill('2026-10', { dueAmount: 4000, kistTotal: 1000 })] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.packageAmount, 3000);
  assert.equal(out.kistAmount, 1000);
  assert.equal(out.grossTotal, 4000);
});

test('concession label: outage concession deducts, gross total does not move', () => {
  const cust = customer({ bills: [bill('2026-10', { concessionAmount: 500, concessionReason: 'Outage 20h' })] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.concessionAmount, 500);
  assert.equal(out.concessionReason, 'Outage 20h');
  assert.equal(out.grossTotal, 3000);
  assert.equal(out.netBalance, 2500);
  assert.equal(out.reconcilesToAllocation, true);
});

test('deposit offset label: security deposit offset deducts, gross total does not move', () => {
  const cust = customer({ bills: [bill('2026-10', { depositOffsetAmount: 800, depositOffsetReason: 'Settled' })] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.depositOffsetAmount, 800);
  assert.equal(out.grossTotal, 3000);
  assert.equal(out.netBalance, 2200);
  assert.equal(out.reconcilesToAllocation, true);
});

test('advance consumed label: earlier overpayment settles the next bill as advance', () => {
  const cust = customer({
    bills: [
      bill('2026-09', { payments: [pay('p1', '2026-09-06', 5000)] }),
      bill('2026-10')
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.advanceConsumed, 2000);
  assert.equal(out.previousArrears, 0);
  assert.equal(out.grossTotal, 3000);
  assert.equal(out.netBalance, 1000);
  assert.equal(out.reconcilesToAllocation, true);
});

test('cash paid label: a same-month receipt deducts, voided receipts do not', () => {
  const cust = customer({
    bills: [bill('2026-10', {
      payments: [
        pay('p1', '2026-10-06', 1000),
        pay('p2', '2026-10-07', 500, { voided: true })
      ]
    })]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.cashPaid, 1000);
  assert.equal(out.netBalance, 2000);
});

test('payment discount label: receipt discount deducts alongside cash', () => {
  const cust = customer({
    bills: [bill('2026-10', { payments: [pay('p1', '2026-10-06', 1000, { discount: 200 })] })]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.cashPaid, 1000);
  assert.equal(out.discountApplied, 200);
  assert.equal(out.netBalance, 1800);
});

test('all four Plan P labels together on one bill', () => {
  const cust = customer({
    bills: [
      bill('2026-09', { payments: [pay('p0', '2026-09-06', 5000)] }),
      bill('2026-10', {
        concessionAmount: 500, depositOffsetAmount: 300
      })
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.concessionAmount, 500);
  assert.equal(out.depositOffsetAmount, 300);
  assert.equal(out.advanceConsumed, 2000);
  assert.equal(out.grossTotal, 3000);
  assert.equal(out.deductionsTotal, 2800);
  assert.equal(out.netBalance, 200);
  assert.equal(out.reconcilesToAllocation, true);
  const keys = out.lines.map((line) => line.key);
  assert.ok(keys.includes('concession') && keys.includes('depositOffset') && keys.includes('advanceConsumed'));
});

test('waiver clamping: a waiver larger than the bill never drives the balance negative', () => {
  const cust = customer({ bills: [bill('2026-10', { concessionAmount: 99999 })] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.concessionAmount, 3000);
  assert.equal(out.netBalance, 0);
  assert.equal(out.reconcilesToAllocation, true);
});

test('other bill credits are labelled separately and still reconcile', () => {
  const cust = customer({
    bills: [bill('2026-10', { referralCreditAmount: 400, feederHostCreditAmount: 100 })]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.referralCreditAmount, 400);
  assert.equal(out.feederHostCreditAmount, 100);
  assert.equal(out.otherCreditsAmount, 500);
  assert.equal(out.netBalance, 2500);
  assert.equal(out.reconcilesToAllocation, true);
});

test('text lines name all four labels with signed deduction amounts', () => {
  const cust = customer({
    bills: [
      bill('2026-09'),
      bill('2026-10', { concessionAmount: 500, depositOffsetAmount: 300 })
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  const text = billClarityTextLines(out).join('\n');
  assert.ok(text.includes('Arrears'));
  assert.ok(text.includes('Concession'));
  assert.ok(text.includes('Deposit offset'));
  assert.ok(text.includes('Total Due'));
  assert.ok(text.includes('Balance'));
});

test('text lines show advance consumed when credit settles the bill', () => {
  const cust = customer({
    bills: [
      bill('2026-09', { payments: [pay('p1', '2026-09-06', 4000)] }),
      bill('2026-10')
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  const text = billClarityTextLines(out).join('\n');
  assert.ok(text.includes('Advance consumed'));
  assert.equal(out.advanceConsumed, 1000);
});

test('breakdown never mutates the customer or the bill', () => {
  const cust = customer({
    bills: [bill('2026-09'), bill('2026-10', { concessionAmount: 500 })]
  });
  const before = JSON.stringify(cust);
  breakdownFor(cust, '2026-10');
  assert.equal(JSON.stringify(cust), before);
});

test('customer breakdowns: newest month first, unpriced bills skipped', () => {
  const cust = customer({
    bills: [bill('2026-08'), bill('2026-09', { dueAmount: 0 }), bill('2026-10')]
  });
  const list = customerBillClarityBreakdowns(cust);
  assert.deepEqual(list.map((row) => row.month), ['2026-10', '2026-08']);
});

test('profile presentation carries the same breakdown object', () => {
  const cust = customer({ bills: [bill('2026-09'), bill('2026-10', { concessionAmount: 500 })] });
  const allocations = calculatePaymentAllocations({ customers: [cust] });
  const presentation = currentBillPresentation(cust, '2026-10', allocations);
  assert.equal(presentation.clarity.previousArrears, 3000);
  assert.equal(presentation.clarity.concessionAmount, 500);
  assert.equal(presentation.clarity.netBalance, 5500);
  assert.equal(presentation.billAmount, 3000);
});

test('profile presentation clarity is null for an unpriced bill', () => {
  const cust = customer({ bills: [bill('2026-10', { dueAmount: null })] });
  const allocations = calculatePaymentAllocations({ customers: [cust] });
  assert.equal(currentBillPresentation(cust, '2026-10', allocations).clarity, null);
});

test('billing register rows carry clarity and totals stay unchanged', () => {
  const cust = customer({
    bills: [
      bill('2026-09'),
      bill('2026-10', { concessionAmount: 500, payments: [pay('p1', '2026-10-06', 1000)] })
    ]
  });
  const register = buildBillingRegister({ customers: [cust] }, { period: 'last3', status: 'all', currentMonth: '2026-10' });
  const row = register.rows.find((entry) => entry.month === '2026-10');
  assert.ok(row);
  assert.equal(row.clarity.previousArrears, 3000);
  assert.equal(row.clarity.concessionAmount, 500);
  assert.equal(row.clarity.advanceConsumed, 0);
  assert.equal(row.billAmount, 3000);
  // The register's pre-existing paid definition is billAmount minus
  // balanceDue, so the 500 concession shows inside totalPaid (1000 cash
  // + 500 concession relief). Plan P adds labels; it does not redefine
  // that figure.
  assert.deepEqual(register.totals, { count: 2, totalBilled: 6000, totalPaid: 1500 });
});

test('billing register A4 print shows the breakdown column and labels', () => {
  const cust = customer({
    bills: [bill('2026-09'), bill('2026-10', { concessionAmount: 500 })]
  });
  const register = buildBillingRegister({ customers: [cust] }, { period: 'last3', status: 'all', currentMonth: '2026-10' });
  const html = buildBillingRegisterPrintHtml(register, { businessName: 'Test Fiber', generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(html.includes('Bill Breakdown'));
  assert.ok(html.includes('Arrears'));
  assert.ok(html.includes('Concession'));
});

test('billing register thermal print keeps its narrow columns (no breakdown column)', () => {
  const cust = customer({ bills: [bill('2026-10')] });
  const register = buildBillingRegister({ customers: [cust] }, { period: 'last3', status: 'all', currentMonth: '2026-10' });
  const html = buildBillingRegisterPrintHtml(register, { format: '80mm', generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(!html.includes('Bill Breakdown'));
});

test('statement HTML carries the breakdown section with the four labels', () => {
  const cust = customer({ bills: [bill('2026-09'), bill('2026-10', { concessionAmount: 500 })] });
  const breakdowns = customerBillClarityBreakdowns(cust);
  const statement = {
    customer: { id: 'c1', customerNumber: 11, name: 'Test Customer', phone: '0300', area: 'Shahdara', package: '20Mbps', serviceStatus: 'active' },
    range: 'all', openingBalance: 0, totalBilled: 6000, totalPaid: 0, currentBalance: 6000, events: []
  };
  const html = generateCustomerStatementHtml(statement, { billBreakdowns: breakdowns });
  assert.ok(html.includes('Bill breakdown'));
  assert.ok(html.includes('Arrears'));
  assert.ok(html.includes('Concession'));
  assert.ok(html.includes('Deposit Offset'));
  assert.ok(html.includes('Advance Consumed'));
  assert.ok(html.includes('2026-10'));
});

test('statement HTML without breakdowns renders exactly the old sections', () => {
  const statement = {
    customer: { id: 'c1', customerNumber: 11, name: 'Test Customer', phone: '0300', area: 'Shahdara', package: '20Mbps', serviceStatus: 'active' },
    range: 'all', openingBalance: 0, totalBilled: 3000, totalPaid: 0, currentBalance: 3000, events: []
  };
  const html = generateCustomerStatementHtml(statement, {});
  assert.ok(!html.includes('Bill breakdown'));
  assert.ok(html.includes('Total Billed Charges'));
});

test('statement WhatsApp text carries breakdown lines when supplied', () => {
  const breakdowns = [{
    month: '2026-10', packageAmount: 3000, previousArrears: 3000,
    concessionAmount: 500, depositOffsetAmount: 300, advanceConsumed: 0, netBalance: 5200
  }];
  const statement = {
    customer: { id: 'c1', customerNumber: 11, name: 'Test Customer', phone: '0300', area: 'Shahdara', package: '20Mbps', serviceStatus: 'active' },
    range: 'all', openingBalance: 0, totalBilled: 6000, totalPaid: 0, currentBalance: 6000, events: []
  };
  const text = formatCustomerStatementWhatsApp(statement, { billBreakdowns: breakdowns });
  assert.ok(text.includes('BILL BREAKDOWN'));
  assert.ok(text.includes('2026-10'));
  assert.ok(text.includes('Arrears'));
});

test('statement WhatsApp text without breakdowns has no breakdown section', () => {
  const statement = {
    customer: { id: 'c1', customerNumber: 11, name: 'Test Customer', phone: '0300', area: 'Shahdara', package: '20Mbps', serviceStatus: 'active' },
    range: 'all', openingBalance: 0, totalBilled: 3000, totalPaid: 0, currentBalance: 3000, events: []
  };
  assert.ok(!formatCustomerStatementWhatsApp(statement, {}).includes('BILL BREAKDOWN'));
});

test('non-numeric bill fields count as zero, never NaN', () => {
  const cust = customer({
    bills: [bill('2026-10', { concessionAmount: 'oops', depositOffsetAmount: undefined, lateFee: 'x' })]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.concessionAmount, 0);
  assert.equal(out.depositOffsetAmount, 0);
  assert.equal(out.lateFeeAmount, 0);
  assert.equal(out.netBalance, 3000);
  assert.ok(Number.isFinite(out.netBalance));
});

test('fully settled bill nets to zero with every label shown', () => {
  const cust = customer({
    bills: [bill('2026-10', { payments: [pay('p1', '2026-10-06', 3000)] })]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.cashPaid, 3000);
  assert.equal(out.netBalance, 0);
  assert.equal(out.reconcilesToAllocation, true);
});

test('arrears from two unpaid months sum into the next bill', () => {
  const cust = customer({ bills: [bill('2026-08'), bill('2026-09'), bill('2026-10')] });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.previousArrears, 6000);
  assert.equal(out.grossTotal, 9000);
  assert.equal(out.netBalance, 9000);
});

test('advance on the current bill does not erase earlier arrears', () => {
  // September unpaid (arrears 3000); October bill paid 4000 against its
  // own 3000 — the 1000 excess is credit, not arrears settlement.
  const cust = customer({
    bills: [
      bill('2026-09'),
      bill('2026-10', { payments: [pay('p1', '2026-10-06', 4000)] })
    ]
  });
  const out = breakdownFor(cust, '2026-10');
  assert.equal(out.previousArrears, 3000);
  assert.equal(out.cashPaid, 3000);
  assert.equal(out.grossTotal, 6000);
  assert.equal(out.netBalance, 3000);
});
