// Billing Invoice Register (owner request 2026-10-29): period-filtered
// invoice-style record of bills on the Monthly Billing screen, with a CSV
// download of exactly the visible rows. Pure-module tests on synthetic
// data only. Pinned criteria: injectable current month 2026-10; This Month
// = 2026-10 only; Last Month = 2026-09 only; Last 3 = 2026-08..2026-10;
// Last 12 = 2025-11..2026-10 excluding 2025-10; a bill whose only payment
// was VOIDED is NOT Paid; partial payment -> Partial; CSV rows == visible
// filtered rows (same count, same totals).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_REGISTER_CSV_HEADERS,
  billingRegisterCsvFilename,
  billingRegisterCsvNote,
  billingRegisterCsvRows,
  billingRegisterMonths,
  buildBillingRegister,
  normalizeBillingRegisterPeriod,
  normalizeBillingRegisterStatus,
  shiftBillingRegisterMonth
} from '../billing-register.js';
import { generateCsvContent } from '../form-validation.js';

const CURRENT_MONTH = '2026-10';

const bill = (id, month, dueAmount, payments = []) => ({
  id, month, dueAmount, dueDate: `${month}-05`, status: 'pending', payments
});
const pay = (id, amount, extra = {}) => ({ id, date: '2026-10-06', amount, method: 'Cash', ...extra });

// Synthetic ledger: bills spread over 2025-10..2026-10.
// Alpha (#12): Oct paid in full, Sep half paid, Aug unpaid, Nov-2025 paid,
// Oct-2025 paid (outside the Last-12 window). Beta (#13): Oct bill whose
// ONLY payment was voided, Jul-2026 paid in full.
const registerState = () => ({
  customers: [
    {
      id: 'c-alpha', customerNumber: 12, name: 'Register Alpha', phone: '0300 1112223', packageSpeed: '20 Mbps',
      bills: [
        bill('b-a-2026-10', '2026-10', 3000, [pay('p-a-oct', 3000)]),
        bill('b-a-2026-09', '2026-09', 3000, [pay('p-a-sep', 1500)]),
        bill('b-a-2026-08', '2026-08', 3000),
        bill('b-a-2025-11', '2025-11', 3000, [pay('p-a-nov', 3000)]),
        bill('b-a-2025-10', '2025-10', 3000, [pay('p-a-old', 3000)])
      ]
    },
    {
      id: 'c-beta', customerNumber: 13, name: 'Register Beta', phone: '', packageSpeed: '10 Mbps',
      bills: [
        bill('b-b-2026-10', '2026-10', 2000, [pay('p-b-oct', 2000, { voided: true, voidedAt: '2026-10-08T10:00:00', voidReason: 'Duplicate entry' })]),
        bill('b-b-2026-07', '2026-07', 2000, [pay('p-b-jul', 2000)])
      ]
    }
  ]
});

test('register: month math crosses the year boundary', () => {
  assert.equal(shiftBillingRegisterMonth('2026-01', -1), '2025-12');
  assert.equal(shiftBillingRegisterMonth('2026-10', -11), '2025-11');
  assert.deepEqual(billingRegisterMonths('last3', CURRENT_MONTH), ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(billingRegisterMonths('last', CURRENT_MONTH), ['2026-09']);
  assert.equal(normalizeBillingRegisterPeriod('bogus'), 'this');
  assert.equal(normalizeBillingRegisterStatus('bogus'), 'paid');
});

test('register PINNED (a): This Month returns only 2026-10 bills', () => {
  const register = buildBillingRegister(registerState(), { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.deepEqual(register.months, ['2026-10']);
  assert.equal(register.rows.length, 2);
  assert.ok(register.rows.every((row) => row.month === '2026-10'));
});

test('register PINNED (b): Last Month returns only 2026-09 bills', () => {
  const register = buildBillingRegister(registerState(), { period: 'last', status: 'all', currentMonth: CURRENT_MONTH });
  assert.deepEqual(register.months, ['2026-09']);
  assert.equal(register.rows.length, 1);
  assert.equal(register.rows[0].month, '2026-09');
  assert.equal(register.rows[0].customerNumber, 12);
});

test('register PINNED (c): Last 3 Months returns 2026-08..2026-10 only', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  assert.deepEqual(register.months, ['2026-08', '2026-09', '2026-10']);
  assert.equal(register.rows.length, 4);
  assert.ok(register.rows.every((row) => row.month >= '2026-08' && row.month <= '2026-10'));
  assert.ok(!register.rows.some((row) => row.month === '2026-07'));
});

test('register PINNED (d): Last 12 Months returns 2025-11..2026-10 and excludes 2025-10', () => {
  const register = buildBillingRegister(registerState(), { period: 'last12', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(register.months.length, 12);
  assert.equal(register.months[0], '2025-11');
  assert.equal(register.months[11], '2026-10');
  assert.ok(register.rows.some((row) => row.month === '2025-11'));
  assert.ok(!register.rows.some((row) => row.month === '2025-10'), 'the paid 2025-10 bill stays outside the window');
  assert.equal(register.rows.length, 6);
});

test('register PINNED (e): a bill whose only payment was VOIDED is NOT Paid', () => {
  const state = registerState();
  const paid = buildBillingRegister(state, { period: 'this', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.ok(!paid.rows.some((row) => row.customerNumber === 13), 'voided-only bill must not appear under Paid');
  const all = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  const beta = all.rows.find((row) => row.customerNumber === 13);
  assert.equal(beta.status, 'unpaid');
  assert.equal(beta.paidAmount, 0);
  assert.equal(beta.billAmount, 2000);
});

test('register PINNED (f): partial payment -> Partial with exact paid amount', () => {
  const register = buildBillingRegister(registerState(), { period: 'last', status: 'partial', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows.length, 1);
  assert.equal(register.rows[0].status, 'partial');
  assert.equal(register.rows[0].billAmount, 3000);
  assert.equal(register.rows[0].paidAmount, 1500);
  assert.equal(register.rows[0].balanceDue, 1500);
});

test('register: defaults are This Month + Paid (owner wording: jo jo bill pay ho)', () => {
  const register = buildBillingRegister(registerState(), { currentMonth: CURRENT_MONTH });
  assert.equal(register.period, 'this');
  assert.equal(register.status, 'paid');
  assert.equal(register.rows.length, 1);
  assert.equal(register.rows[0].reference, '#12 · 2026-10');
  assert.equal(register.rows[0].customerName, 'Register Alpha');
  assert.equal(register.rows[0].mobile, '0300 1112223');
  assert.equal(register.rows[0].packageSpeed, '20 Mbps');
  assert.deepEqual(register.totals, { count: 1, totalBilled: 3000, totalPaid: 3000 });
});

test('register PINNED (g): CSV rows == visible filtered rows (same count, same totals)', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  const note = billingRegisterCsvNote(register, { periodLabel: 'Last 3 Months', statusLabel: 'All' });
  assert.match(note, /showing 4 of 4 bills/);
  const noteRow = { reference: note, customer: '', mobile: '', package: '', month: '', billAmount: '', paidAmount: '', status: '' };
  const csv = generateCsvContent(BILLING_REGISTER_CSV_HEADERS, [noteRow, ...billingRegisterCsvRows(register)]);
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.length);
  // SISP-176 appended the two split columns at the END; the original
  // eight columns keep their positions and figures.
  assert.equal(lines[0], 'Reference,Customer,Mobile,Package,Month,Bill Amount,Paid Amount,Status,Ticket Charges Paid,Total Collected');
  assert.ok(lines[1].includes('Note: Filtered view:'), 'second line is the filtered-view NOTE row');
  const dataLines = lines.slice(2);
  assert.equal(dataLines.length, register.rows.length);
  const billedTotal = dataLines.reduce((sum, line) => sum + Number(line.split(',')[5]), 0);
  const paidTotal = dataLines.reduce((sum, line) => sum + Number(line.split(',')[6]), 0);
  assert.equal(billedTotal, register.totals.totalBilled);
  assert.equal(paidTotal, register.totals.totalPaid);
  assert.equal(register.totals.totalBilled, 11000);
  assert.equal(register.totals.totalPaid, 4500);
  assert.equal(billingRegisterCsvFilename(register), 'billing-register-last3-all_filtered.csv');
});

// ---------------------------------------------------------------------------
// SISP-176: the SISP-43 ticket-charge split. Quick Collect settles bill
// dues + billed ticket charges in ONE receipt; the ticket portion rides
// the payment as a ticketCharges stamp and is NOT bill money (the engine
// keeps it out of allocation). The register splits it out per row —
// it never ADDS to the bill figures.
// ---------------------------------------------------------------------------
const ticketBill = (id, month, dueAmount, payments = []) => bill(id, month, dueAmount, payments);
const ticketPay = (id, amount, ticketAmount) => pay(id, amount, { ticketCharges: [{ ticketId: 'TKT-101', amount: ticketAmount }] });

test('register SISP-176 PINNED: Rs 3,000 bill + Rs 500 ticket charge -> Bill Paid 3,000 + Ticket Charges Paid 500', () => {
  const state = { customers: [{
    id: 'c-t1', customerNumber: 21, name: 'Ticket Pin', phone: '', packageSpeed: '15 Mbps',
    bills: [ticketBill('b-t1', '2026-10', 3000, [ticketPay('p-t1', 3500, 500)])]
  }] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows.length, 1);
  const row = register.rows[0];
  assert.equal(row.status, 'paid');
  assert.equal(row.paidAmount, 3000, 'bill portion only — the ticket cash is not bill money');
  assert.equal(row.ticketChargesPaid, 500);
  assert.equal(row.paidAmount + row.ticketChargesPaid, 3500, 'the split sums to the one receipt amount, never more');
  assert.deepEqual(register.totals, { count: 1, totalBilled: 3000, totalPaid: 3000 }, 'pre-split totals stay byte-identical');
  assert.deepEqual(register.ticketTotals, { totalTicketChargesPaid: 500, totalCollected: 3500 });
});

test('register SISP-176: mixed period — charge-free rows read 0 and bill totals are unchanged', () => {
  const state = { customers: [
    { id: 'c-t1', customerNumber: 21, name: 'Ticket Mix A', phone: '', packageSpeed: '15 Mbps',
      bills: [ticketBill('b-t1', '2026-10', 3000, [ticketPay('p-t1', 3500, 500)])] },
    { id: 'c-t2', customerNumber: 22, name: 'Ticket Mix B', phone: '', packageSpeed: '10 Mbps',
      bills: [ticketBill('b-t2', '2026-10', 2000, [pay('p-t2', 2000)])] }
  ] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  const plain = register.rows.find((row) => row.customerNumber === 22);
  assert.equal(plain.ticketChargesPaid, 0);
  assert.equal(register.totals.totalBilled, 5000);
  assert.equal(register.totals.totalPaid, 5000, 'bill-paid total identical to the pre-split computation');
  assert.equal(register.ticketTotals.totalTicketChargesPaid, 500);
  assert.equal(register.ticketTotals.totalCollected, 5500);
  assert.equal(
    register.ticketTotals.totalCollected,
    register.totals.totalPaid + register.ticketTotals.totalTicketChargesPaid,
    'identity: Bill Paid + Ticket Charges Paid == Total Collected'
  );
});

test('register SISP-176: a VOIDED payment settles no ticket charge either', () => {
  const state = { customers: [{
    id: 'c-t3', customerNumber: 23, name: 'Ticket Void', phone: '', packageSpeed: '10 Mbps',
    bills: [ticketBill('b-t3', '2026-10', 3000, [
      pay('p-t3', 3500, { ticketCharges: [{ ticketId: 'TKT-102', amount: 500 }], voided: true, voidedAt: '2026-10-09T10:00:00', voidReason: 'Wrong entry' })
    ])]
  }] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  const row = register.rows[0];
  assert.equal(row.status, 'unpaid');
  assert.equal(row.paidAmount, 0);
  assert.equal(row.ticketChargesPaid, 0, 'the voided stamp contributes nothing to the split');
  assert.deepEqual(register.ticketTotals, { totalTicketChargesPaid: 0, totalCollected: 0 });
});

test('register SISP-176: partial receipt splits bill portion and ticket portion', () => {
  const state = { customers: [{
    id: 'c-t4', customerNumber: 24, name: 'Ticket Partial', phone: '', packageSpeed: '10 Mbps',
    bills: [ticketBill('b-t4', '2026-10', 3000, [ticketPay('p-t4', 2000, 500)])]
  }] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  const row = register.rows[0];
  assert.equal(row.status, 'partial');
  assert.equal(row.paidAmount, 1500, 'only 2,000 - 500 of the receipt is bill money');
  assert.equal(row.ticketChargesPaid, 500);
  assert.equal(row.balanceDue, 1500);
});

test('register SISP-176: CSV carries the split columns and they sum to ticketTotals', () => {
  const state = { customers: [
    { id: 'c-t1', customerNumber: 21, name: 'Ticket Mix A', phone: '', packageSpeed: '15 Mbps',
      bills: [ticketBill('b-t1', '2026-10', 3000, [ticketPay('p-t1', 3500, 500)])] },
    { id: 'c-t2', customerNumber: 22, name: 'Ticket Mix B', phone: '', packageSpeed: '10 Mbps',
      bills: [ticketBill('b-t2', '2026-10', 2000, [pay('p-t2', 2000)])] }
  ] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  const csvRows = billingRegisterCsvRows(register);
  const withTicket = csvRows.find((row) => row.customer === 'Ticket Mix A');
  assert.equal(withTicket.ticketChargesPaid, 500);
  assert.equal(withTicket.collectedAmount, 3500);
  const noteRow = { reference: 'Note: x', customer: '', mobile: '', package: '', month: '', billAmount: '', paidAmount: '', status: '', ticketChargesPaid: '', collectedAmount: '' };
  const csv = generateCsvContent(BILLING_REGISTER_CSV_HEADERS, [noteRow, ...csvRows]);
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.length);
  assert.ok(lines[0].endsWith(',Ticket Charges Paid,Total Collected'));
  const dataLines = lines.slice(2);
  const ticketTotal = dataLines.reduce((sum, line) => sum + Number(line.split(',')[8]), 0);
  const collectedTotal = dataLines.reduce((sum, line) => sum + Number(line.split(',')[9]), 0);
  assert.equal(ticketTotal, register.ticketTotals.totalTicketChargesPaid);
  assert.equal(collectedTotal, register.ticketTotals.totalCollected);
});

test('register: unpriced bills are not invoices; module ships in the build', async () => {
  const state = registerState();
  // The app keeps one bill per customer per month (saveBillMonth upserts),
  // so the unpriced bill belongs to its own customer.
  state.customers.push({
    id: 'c-gamma', customerNumber: 14, name: 'Register Gamma', phone: '', packageSpeed: '',
    bills: [{ id: 'b-g-unpriced', month: '2026-10', dueAmount: null, dueDate: '2026-10-05', status: 'pending', payments: [] }]
  });
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows.length, 2, 'unpriced bill adds no register row');
  assert.equal(register.periodBillCount, 2);
  const { ENTRY_FILES } = await import('../build.mjs');
  assert.ok(ENTRY_FILES.includes('billing-register.js'));
});

test('register: SISP-171 referral-credit bill (Rs. 3,000 − Rs. 500 credit, Rs. 2,500 cash) reads Paid', () => {
  // Spec pin: the SISP-40 referral credit settles the bill together with
  // the cash (FU1b aligned the engine the register derives from), so
  // the register must show the bill Paid with zero balance due — never
  // Unpaid/Partial over the waived Rs. 500.
  const state = {
    customers: [{
      id: 'c-ref171', customerNumber: 21, name: 'Register Referral', phone: '', packageSpeed: '15 Mbps',
      bills: [{
        id: 'b-ref-2026-10', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', status: 'pending',
        referralCreditAmount: 500, referralCreditReason: 'Hamsaya Referral Credit',
        payments: [pay('p-ref-oct', 2500)]
      }]
    }]
  };
  const all = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(all.rows.length, 1);
  assert.equal(all.rows[0].status, 'paid');
  assert.equal(all.rows[0].balanceDue, 0);
  assert.equal(all.rows[0].billAmount, 3000);
  const paidOnly = buildBillingRegister(state, { period: 'this', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(paidOnly.rows.length, 1);
  const unpaidOnly = buildBillingRegister(state, { period: 'this', status: 'unpaid', currentMonth: CURRENT_MONTH });
  assert.equal(unpaidOnly.rows.length, 0);
});
