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
import { readFileSync } from 'node:fs';
import {
  BILLING_REGISTER_CSV_HEADERS,
  BILLING_REGISTER_PERIODS,
  BILLING_REGISTER_STATUSES,
  billingRegisterCsvFilename,
  billingRegisterCsvNote,
  billingRegisterCsvRows,
  billingRegisterMonths,
  buildBillingRegister,
  buildBillingRegisterPrintHtml,
  normalizeBillingRegisterPeriod,
  normalizeBillingRegisterPrintFormat,
  normalizeBillingRegisterStatus,
  shiftBillingRegisterMonth
} from '../billing-register.js';
import { generateCsvContent } from '../form-validation.js';
import { TRANSLATIONS, t } from '../nav-language.js';
import { PARTNERS } from '../partner-settlement.js';

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

// ---------------------------------------------------------------------------
// SISP-185: printable summary sheet (A4 + 80mm) of the filtered register.
// The sheet consumes the register object itself — the exact filtered rows
// and totals — so these pins compare the printed HTML against the same
// register the screen/CSV tests above already pinned.
const printTotalsLine = (register) => t('bill_reg_totals', 'en', {
  count: register.totals.count,
  billed: `PKR ${register.totals.totalBilled.toLocaleString('en-PK')}`,
  paid: `PKR ${register.totals.totalPaid.toLocaleString('en-PK')}`
});
const printedRefs = (html) => [...html.matchAll(/<td class="ref">([^<]+)<\/td>/g)].map((m) => m[1]);
const dataRowCount = (html) => (html.match(/<tr><td/g) ?? []).length;

test('register print PINNED: A4 sheet under Paid (default) carries exactly the paid rows + screen totals', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'paid', currentMonth: CURRENT_MONTH });
  const html = buildBillingRegisterPrintHtml(register, { businessName: 'Test Fiber', generatedDate: '2026-10-31', lang: 'en' });
  assert.deepEqual(printedRefs(html), register.rows.map((row) => row.reference), 'printed rows == filtered rows, in register order');
  assert.equal(dataRowCount(html), register.rows.length);
  assert.ok(html.includes('Register Alpha'));
  assert.ok(!html.includes('Register Beta'), 'the voided-only bill is not a Paid row and never reaches the Paid sheet');
  assert.ok(html.includes('0300 1112223'), 'A4 keeps the Mobile column');
  assert.ok(html.includes(t('bill_reg_col_balance', 'en')), 'A4 keeps the Balance Due column');
  assert.ok(html.includes(printTotalsLine(register)), 'sheet totals line == the screen totals for the same selection');
  assert.ok(html.includes(`Period: Last 3 Months (2026-08 – 2026-10) · Bill status: Paid`), 'sheet header describes the exact filter');
  assert.ok(html.includes('Test Fiber'), 'brand comes from the caller settings');
  assert.ok(html.includes('Generated 2026-10-31'));
});

test('register print PINNED: A4 sheet under All matches the full filtered set (voided-only bill prints Unpaid, paid 0)', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows.length, 4);
  const html = buildBillingRegisterPrintHtml(register, { generatedDate: '2026-10-31', lang: 'en' });
  assert.deepEqual(printedRefs(html), register.rows.map((row) => row.reference));
  assert.equal(dataRowCount(html), 4);
  const betaRow = html.split('<tr>').find((chunk) => chunk.includes('#13 · 2026-10'));
  assert.ok(betaRow, 'voided-only bill row is printed under All');
  assert.ok(betaRow.includes('PKR 0'), 'its paid amount prints as 0 — a voided payment never counts as paid');
  assert.ok(betaRow.includes('Unpaid'));
  assert.ok(html.includes(printTotalsLine(register)), 'totals: 4 invoices · Billed PKR 11,000 · Paid PKR 4,500');
  assert.ok(html.includes('PKR 6,500'), 'balance column total is the plain sum of the printed rows (0 + 2000 + 1500 + 3000)');
});

test('register print: zero-row selection prints the honest empty sheet with zero totals', () => {
  const register = buildBillingRegister(registerState(), { period: 'last', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows.length, 0, 'fixture: September holds only a partial bill, so Paid is empty');
  const html = buildBillingRegisterPrintHtml(register, { generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(html.includes(t('bill_reg_empty', 'en')), 'empty message prints instead of stale rows');
  assert.ok(!html.includes('Register Alpha') && !html.includes('Register Beta'));
  assert.equal(dataRowCount(html), 0);
  assert.ok(html.includes(printTotalsLine(register)), 'zero totals line still prints');
  assert.ok(html.includes('Period: Last Month (2026-09) · Bill status: Paid'), 'header still describes the empty selection');
});

test('register print: sign-offs iterate the given partner set — a third partner appears with no code change', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  const html = buildBillingRegisterPrintHtml(register, { partners: ['Partner One', 'Partner Two', 'Partner Three'], lang: 'en' });
  for (const name of ['Partner One', 'Partner Two', 'Partner Three']) assert.ok(html.includes(name), `${name} sign-off block prints`);
  assert.ok(html.includes(t('bill_reg_sign_prepared', 'en')), 'prepared-by block prints');
  assert.equal((html.match(/class="sig"/g) ?? []).length, 4, 'prepared-by + one block per partner');
  const fallback = buildBillingRegisterPrintHtml(register, { lang: 'en' });
  for (const name of PARTNERS) assert.ok(fallback.includes(name), `default partner set includes ${name}`);
  assert.equal((fallback.match(/class="sig"/g) ?? []).length, PARTNERS.length + 1);
});

test('register print PINNED: 80mm sheet uses the condensed columns only, rows still identified', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  const html = buildBillingRegisterPrintHtml(register, { format: '80mm', generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(html.includes('size: 80mm auto'), 'thermal page size is set');
  assert.ok(html.includes('<th class="ref">#</th>'), 'reference condenses to the customer number');
  assert.ok(html.includes('<th class="cust">Customer</th>'));
  assert.ok(html.includes('<th class="nowrap">Month</th>'));
  assert.ok(!html.includes(t('bill_reg_col_mobile', 'en')), 'Mobile column is dropped on 80mm');
  assert.ok(!html.includes(t('bill_reg_col_package', 'en')), 'Package column is dropped on 80mm');
  assert.ok(!html.includes(t('bill_reg_col_balance', 'en')), 'Balance Due column is dropped on 80mm');
  assert.deepEqual(printedRefs(html), register.rows.map((row) => `#${row.customerNumber}`), 'rows identified by customer number, in register order');
  assert.equal(dataRowCount(html), register.rows.length);
  assert.ok(html.includes(printTotalsLine(register)), 'totals survive the condensed layout');
  assert.equal(normalizeBillingRegisterPrintFormat('80mm'), '80mm');
  assert.equal(normalizeBillingRegisterPrintFormat('bogus'), 'a4');
});

test('register print: business phone prints only when settings record one — never the receipt placeholder', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  const noPhone = buildBillingRegisterPrintHtml(register, { businessPhone: '', lang: 'en' });
  assert.ok(!noPhone.includes('0300-1234567'), 'the placeholder phone from receipt defaults never leaks onto the sheet');
  const withPhone = buildBillingRegisterPrintHtml(register, { businessName: 'Settings Fiber', businessPhone: '0321 5556677', lang: 'en' });
  assert.ok(withPhone.includes('0321 5556677'), 'a recorded settings phone prints');
  assert.ok(withPhone.includes('Settings Fiber'));
  const noBrand = buildBillingRegisterPrintHtml(register, { businessName: '', lang: 'en' });
  assert.ok(noBrand.includes('Shahdara ISP'), 'blank brand falls back to the app-wide receipt fallback');
});

test('register print: generating the sheet mutates neither state nor register (byte-identical)', () => {
  const state = registerState();
  const stateBefore = JSON.stringify(state);
  const register = buildBillingRegister(state, { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH });
  const registerBefore = JSON.stringify(register);
  buildBillingRegisterPrintHtml(register, { lang: 'en' });
  buildBillingRegisterPrintHtml(register, { format: '80mm', partners: ['Someone'], lang: 'ur' });
  assert.equal(JSON.stringify(register), registerBefore);
  assert.equal(JSON.stringify(state), stateBefore);
});

test('register print: i18n audit — every bill_reg_* key used by module, markup and handler exists in en + ur', () => {
  const moduleSource = readFileSync(new URL('../billing-register.js', import.meta.url), 'utf8');
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of moduleSource.matchAll(/t\('(bill_reg_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of appSource.matchAll(/t\('(bill_reg_[a-z_]+)'/g)) used.add(m[1]);
  for (const m of indexHtml.matchAll(/data-i18n="(bill_reg_[a-z_]+)"/g)) used.add(m[1]);
  // Dynamic keys the sheet builds from the register's own period/status:
  for (const period of BILLING_REGISTER_PERIODS) used.add(`bill_reg_period_${period}`);
  for (const status of BILLING_REGISTER_STATUSES) used.add(`bill_reg_status_${status}`);
  assert.ok(used.has('bill_reg_print') && used.has('bill_reg_col_balance') && used.has('bill_reg_sign_prepared'));
  for (const key of used) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en missing ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
  }
  const urduSheet = buildBillingRegisterPrintHtml(
    buildBillingRegister(registerState(), { period: 'last3', status: 'all', currentMonth: CURRENT_MONTH }),
    { lang: 'ur' }
  );
  assert.ok(urduSheet.includes(TRANSLATIONS.ur.bill_reg_title), 'Urdu sheet renders dictionary text, never raw keys');
  assert.ok(!urduSheet.includes('bill_reg_'), 'no raw bill_reg_* key leaks into the Urdu sheet');
});

test('register print: wiring — print button + format select in markup, handler in app.js', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(indexHtml.includes('id="billingRegisterPrintBtn"'), 'print button sits in the register controls');
  assert.ok(indexHtml.includes('id="billingRegisterPrintFormat"'), 'A4 / 80mm format select present');
  assert.ok(indexHtml.includes('id="billingRegisterDownloadBtn"'), 'CSV download button untouched');
  assert.ok(appSource.includes('buildBillingRegisterPrintHtml'), 'app.js builds the sheet from the live register');
  assert.ok(appSource.includes("$('#billingRegisterPrintBtn')"), 'app.js wires the print handler');
  assert.ok(appSource.includes('partners: PARTNERS'), 'sign-offs come from the recorded partner set');
  assert.ok(appSource.includes("businessPhone: state.settings?.businessPhone || ''"), 'phone comes from settings only, no placeholder fallback');
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

// Sharafat 44: the screen totals line names the active status + period, and
// the row month renders "October 2026", never the raw YYYY-MM.
// app.js is a browser script (no node import), so the render itself is
// pinned by source assertion below (the Sharafat 40/43 render-pin pattern);
// the label values are pinned functionally here with the real t() + builder.
// The composition below mirrors the render's expression exactly — if a key
// were missing or the builder stopped normalizing period/status, the
// composed label would carry the raw key instead of the translated word.
const sharafat44AppSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sharafat44TotalsLabel = (register, lang) => `${t(`bill_reg_status_${register.status}`, lang)} bills · ${t(`bill_reg_period_${register.period}`, lang)}: `;
const sharafat44ScreenTotalsLine = (register, lang) => sharafat44TotalsLabel(register, lang) + t('bill_reg_totals', lang, {
  count: register.totals.count,
  billed: `PKR ${register.totals.totalBilled.toLocaleString('en-PK')}`,
  paid: `PKR ${register.totals.totalPaid.toLocaleString('en-PK')}`
});

test('register Sharafat 44: default view totals line names "Paid" + the period', () => {
  const register = buildBillingRegister(registerState(), { period: 'this', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(register.period, 'this');
  assert.equal(register.status, 'paid');
  assert.equal(register.totals.count, 1);
  assert.equal(sharafat44TotalsLabel(register, 'en'), 'Paid bills · This Month: ');
  assert.equal(sharafat44ScreenTotalsLine(register, 'en'), 'Paid bills · This Month: 1 invoices · Billed PKR 3,000 · Paid PKR 3,000');
  // The render composes the same prefix at the totals site (screen-only).
  assert.ok(sharafat44AppSource.includes("const totalsLabel = `${t(`bill_reg_status_${register.status}`)} bills · ${t(`bill_reg_period_${register.period}`)}: `;"),
    'renderBillingRegister prefixes the totals with status + period');
  assert.ok(sharafat44AppSource.includes("let totalsText = totalsLabel + t('bill_reg_totals'"),
    'the labelled totals text is what reaches #billingRegisterTotals');
});

test('register Sharafat 44: switching the chip changes the label every time; "All" never reads "Paid"', () => {
  const expected = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid', all: 'All' };
  for (const status of BILLING_REGISTER_STATUSES) {
    const register = buildBillingRegister(registerState(), { period: 'this', status, currentMonth: CURRENT_MONTH });
    assert.equal(register.status, status, 'the builder normalizes the chip value back onto the register');
    assert.equal(sharafat44TotalsLabel(register, 'en'), `${expected[status]} bills · This Month: `);
  }
  const all = buildBillingRegister(registerState(), { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.ok(!sharafat44TotalsLabel(all, 'en').startsWith('Paid bills'), '"All bills", never "Paid bills" under status all');
  const last3 = buildBillingRegister(registerState(), { period: 'last3', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(sharafat44TotalsLabel(last3, 'en'), 'Paid bills · Last 3 Months: ');
  // UR composition is English-shaped (accepted per the parent decision — the
  // CSV note + print filter line already compose the same way today).
  const paidUr = buildBillingRegister(registerState(), { period: 'this', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(sharafat44TotalsLabel(paidUr, 'ur'), 'ادا شدہ bills · اس مہینہ: ');
  const allUr = buildBillingRegister(registerState(), { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.equal(sharafat44TotalsLabel(allUr, 'ur'), 'تمام bills · اس مہینہ: ');
});

test('register Sharafat 44: the card drops the Month cell — the reference keeps it, CSV + print keep the Month column', () => {
  // Reports Register & audit polish: the Month cell leaves the invoice
  // CARD (the reference "#N · YYYY-MM" already carries the month) but
  // Month survives in the CSV download and the print sheet, which
  // consume the row model — not the card DOM.
  const register = buildBillingRegister(registerState(), { period: 'this', status: 'paid', currentMonth: CURRENT_MONTH });
  assert.equal(register.rows[0].month, '2026-10', 'row model stays raw YYYY-MM');
  assert.equal(register.rows[0].reference, '#12 · 2026-10', 'the reference identifier stays raw too');
  // No Month cell anywhere in the app.js card template: the only
  // app.js use of the key is gone (the key itself still lives in
  // nav-language.js for the CSV/print columns).
  assert.ok(!sharafat44AppSource.includes('bill_reg_col_month'), 'no Month cell in the app.js card template');
  // Month survives in the CSV (header + a data row's month field)...
  const csv = generateCsvContent(BILLING_REGISTER_CSV_HEADERS, billingRegisterCsvRows(register));
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.length);
  assert.equal(lines[0], 'Reference,Customer,Mobile,Package,Month,Bill Amount,Paid Amount,Status,Ticket Charges Paid,Total Collected');
  assert.ok(lines[1].includes(',2026-10,'), 'the CSV data row still carries the raw month');
  // ... and in the print sheet.
  const html = buildBillingRegisterPrintHtml(register, { businessName: 'Test Fiber', generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(html.includes('<th class="nowrap">Month</th>'), 'the print sheet keeps its Month column');
  assert.ok(html.includes('2026-10'), 'the print sheet still shows the raw month');
  // displayMonthName lives on for the month selects (the helper itself
  // is in app.js, so its outputs are pinned here, not imported).
  assert.equal(t('cust_month_oct', 'ur'), 'اکتوبر');
  assert.equal(t('cust_month_nov', 'ur'), 'نومبر');
  const enMonth = (month) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  assert.equal(enMonth('2026-10'), 'October 2026');
  assert.equal(enMonth('2026-11'), 'November 2026');
});

test('register Sharafat 44: ticket suffix still appends AFTER the labelled totals (SISP-176 shape)', () => {
  const state = { customers: [{
    id: 'c-t1', customerNumber: 21, name: 'Ticket Pin', phone: '', packageSpeed: '15 Mbps',
    bills: [ticketBill('b-t1', '2026-10', 3000, [ticketPay('p-t1', 3500, 500)])]
  }] };
  const register = buildBillingRegister(state, { period: 'this', status: 'all', currentMonth: CURRENT_MONTH });
  assert.deepEqual(register.ticketTotals, { totalTicketChargesPaid: 500, totalCollected: 3500 });
  const ticketText = t('bill_reg_totals_ticket', 'en', { ticket: 'PKR 500', collected: 'PKR 3,500' });
  const line = `${sharafat44ScreenTotalsLine(register, 'en')} · ${ticketText}`;
  assert.ok(line.startsWith('All bills · This Month: '), 'label prefix first');
  assert.ok(line.indexOf('1 invoices') > 0 && line.indexOf(ticketText) > line.indexOf('1 invoices'), 'ticket split after the totals, never before the label');
  // Source order: the label is built before the ticket append in app.js
  // (guard the -1: on a tree without the label, indexOf would be -1 and
  // the < comparison below would pass vacuously).
  const labelIdx = sharafat44AppSource.indexOf('const totalsLabel = ');
  const ticketIdx = sharafat44AppSource.indexOf("totalsText += ` · ${t('bill_reg_totals_ticket'");
  assert.ok(labelIdx > -1, 'the totals label exists in renderBillingRegister');
  assert.ok(ticketIdx > -1, 'the ticket append exists in renderBillingRegister');
  assert.ok(labelIdx < ticketIdx, 'label precedes the ticket append in renderBillingRegister');
});

test('register Sharafat 44: print sheet keeps the BARE totals line (screen-only label)', () => {
  const register = buildBillingRegister(registerState(), { period: 'last3', status: 'paid', currentMonth: CURRENT_MONTH });
  const html = buildBillingRegisterPrintHtml(register, { businessName: 'Test Fiber', generatedDate: '2026-10-31', lang: 'en' });
  assert.ok(html.includes(printTotalsLine(register)), 'print totals line is the bare bill_reg_totals text');
  assert.ok(!html.includes('Paid bills ·'), 'the screen-only prefix never reaches the print sheet');
  assert.ok(html.includes('Period: Last 3 Months (2026-08 – 2026-10) · Bill status: Paid'), 'the print header already names the filter, so the bare line is not misleading there');
});
