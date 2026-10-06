import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_NAMES, PAYMENT_METHODS, createInitialState, readState, persistState,
  addCustomer, deleteCustomer, archiveCustomer, unarchiveCustomer, updateMohalla, updateCustomerProfile, searchCustomers, generateMonthlyBillsThroughCurrentMonth,
  saveBillMonth, addPayment, correctPayment, deletePayment, recordedAmount, monthsForHistory, nextCycleDueDateFromBillMonth,
  customerPackageProfit, calculateDashboard, calculatePaymentAllocations, listTransactions, buildMonthlyReport,
  effectiveBillStatus, derivedBillStatus, filterCustomersByStatus, addIncident, updateIncident, deleteIncident, countCustomerIncidentsLast30Days,
  exportAllPayments, exportCustomerHistory, formatPKR, createJsonBackup, previewJsonBackupMerge, PAKISTAN_TIME_ZONE,
  summarizeCustomerReceipts, summarizeCustomerTenure
} from '../core.js';

const referenceDate = new Date(2026, 8, 29, 12);
const currentMonth = '2026-09';
const payment = (overrides = {}) => ({ date:'2026-09-15', amount:'100', method:'Cash', ...overrides });
const store = () => { const data = new Map(); return { getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value) }; };
const profile = (state, customerId, changes, date = referenceDate) => updateCustomerProfile(state, customerId, changes, date);

test('starts with exactly the supplied 74 names in original order and every profile/bill field blank', () => {
  const expected = ['NAZEER','AWAIS','TEHMENA','SAFEER','KHALEEL','DARBAR','ALI SHAH','ZARSHAD KHAN','AC HOUSE','MNA HOUSE','CH BILAL','MUHAMMAD QASIM','RAJA JUNAID','RAJA USAMA','PATHAN','HASEEB','RAJA BILAL','QARI MUBASIR','FAREED ABBASI','JAWAD RAJA','HAJI ZAFAR','DOCTOR ZAHID','DOCTER EHSAN','AQIB OWNER','SAQIB EJAZ','RAJA RIAZ','RAJA JAHANGEER','RAJA NOMI','RAJA MOHSIN','MUFTI SADAQAT','TOUSEEF RAJA','KIRAN BILAL','SIKANDAR ABBASI','RAJA FAISAL','RAJA ALI','RAJA SHUNAID','BUT HOUSE','AZEEM BAJWA HOUSE','BANGISH HOUSE','RAJA HAFEEZ','RAJA KHAZER','ZUBAIR USTAD','MEHMOOD ABBASI','RAJA ARIF','RAJA SHEHZAD','KASHIF RAJA','KASHIF ABBASI','SAJID','PTA DIRECTOR','RAJA IRFAN','RAJA FAIZAN','BABAR','CH MURTAZA','QARI BAKAR BAKAR','CH MOIZ','CH SAQLAIN','RAJA MUJAHID','RAJA MASROOR','RAJA TAIMOOR MANGRAYAL','RAJA TAIMOOR CHANDALL','MOBEEN SHAH','NADIR SHAH','SHAH NAWAZ','SHADI','RAB NAWAZ','FAISAL GUJJAR','CH HAMZA','CH SHAFEEQ','CH SANWALL','NADIR GUJJAR','RAJA ASAD','DC HOUSE','AKHTAR HOUSE','SSP HOUSE'];
  assert.equal(INITIAL_NAMES.length, 74);
  assert.deepEqual(INITIAL_NAMES, expected);
  const state = createInitialState();
  assert.deepEqual(state.customers.map(c => c.name), expected);
  assert.ok(state.customers.every(c => c.mohalla === '' && c.address === '' && c.phone === '' && c.ispProvider === '' && c.serviceStatus === 'not-set' && c.packageSpeed === '' && c.monthlyPurchaseCost === null && c.monthlySellingAmount === null && c.monthlyPriceSchedule.length === 0 && c.bills.length === 0));
});

test('new customers start with blank contact, package, amount, and history fields', () => {
  const state = deleteCustomer(createInitialState(), 'seed-001');
  const next = addCustomer(state, 'NAZEER');
  const customer = next.customers.at(-1);
  assert.equal(customer.name, 'NAZEER');
  assert.equal(customer.address, '');
  assert.equal(customer.phone, '');
  assert.equal(customer.serviceStatus, 'not-set');
  assert.equal(customer.packageSpeed, '');
  assert.equal(customer.monthlyPurchaseCost, null);
  assert.equal(customer.monthlySellingAmount, null);
  assert.deepEqual(customer.bills, []);
});

test('profile address, optional phone, package values, and prices persist; blank phone is allowed', () => {
  const storage = store(); const customerId = 'seed-001';
  let state = createInitialState();
  state = profile(state, customerId, { address:'Fixture address', phone:'fixture-phone', packageSpeed:'Fixture package', monthlyPurchaseCost:'25.50', monthlySellingAmount:'60.75' });
  persistState(state, storage);
  let restored = readState(storage);
  let customer = restored.customers[0];
  assert.equal(customer.address, 'Fixture address');
  assert.equal(customer.phone, 'fixture-phone');
  assert.equal(customer.packageSpeed, 'Fixture package');
  assert.equal(customer.monthlyPurchaseCost, 25.5);
  assert.equal(customer.monthlySellingAmount, 60.75);
  assert.equal(customerPackageProfit(customer), 35.25);

  // Editing only the address retains the other profile values; clearing phone is permitted.
  restored = profile(restored, customerId, { address:'', phone:'' });
  persistState(restored, storage);
  customer = readState(storage).customers[0];
  assert.equal(customer.address, '');
  assert.equal(customer.phone, '');
  assert.equal(customer.packageSpeed, 'Fixture package');
  assert.equal(customer.monthlyPurchaseCost, 25.5);
  assert.equal(customer.monthlySellingAmount, 60.75);
});

test('international WhatsApp number stays on the local customer profile after save and reload', () => {
  const storage = store();
  const savedNumber = '+92 (300) 123-4567';
  const state = profile(createInitialState(), 'seed-001', { phone:savedNumber });
  persistState(state, storage);
  assert.equal(readState(storage).customers[0].phone, savedNumber);
});

test('legacy local profiles gain safe defaults without rewriting raw data or existing bill history', () => {
  const storage = store();
  const raw = JSON.stringify({ version:1, customers:[{ id:'legacy-1', name:'NAZEER', mohalla:'', monthlySellingAmount:100, bills:[{ id:'b1', month:currentMonth, dueAmount:50, status:'pending', payments:[] }] }] });
  storage.setItem('shahdara-isp-billing-v1', raw);
  const restored = readState(storage);
  assert.equal(restored.customers[0].address, '');
  assert.equal(restored.customers[0].phone, '');
  assert.equal(restored.customers[0].serviceStatus, 'not-set');
  assert.equal(restored.customers[0].billingStartMonth, null);
  assert.equal(restored.customers[0].packageSpeed, '');
  assert.equal(restored.customers[0].monthlyPurchaseCost, null);
  assert.equal(restored.customers[0].monthlySellingAmount, 100);
  assert.equal(restored.customers[0].bills[0].dueAmount, 50);
  assert.equal(restored.customers[0].monthlyPriceSchedule[0].amount, 100);
  assert.ok(restored.customers[0].monthlyPriceSchedule[0].effectiveMonth > currentMonth);
  assert.equal(storage.getItem('shahdara-isp-billing-v1'), raw);
});

test('validates profile lengths and amounts while allowing optional blank contacts and zero provider cost', () => {
  const state = createInitialState(); const id = state.customers[0].id;
  assert.doesNotThrow(() => profile(state, id, { address:'', phone:'', monthlyPurchaseCost:'0', monthlySellingAmount:'1' }));
  assert.throws(() => profile(state, id, { address:'x'.repeat(201) }), /Address must be 200/);
  assert.throws(() => profile(state, id, { phone:'x'.repeat(41) }), /Phone number must be 40/);
  assert.throws(() => profile(state, id, { packageSpeed:'x'.repeat(81) }), /Package\/speed must be 80/);
  assert.throws(() => profile(state, id, { monthlyPurchaseCost:'-0.01' }), /cannot be negative/);
  assert.throws(() => profile(state, id, { monthlySellingAmount:'0' }), /greater than zero/);
});

test('customer profile/history export includes address and phone and preserves unset values as not recorded', () => {
  let state = createInitialState(); const id = state.customers[0].id;
  let history = exportCustomerHistory(state, id);
  assert.match(history, /Address: Not recorded/);
  assert.match(history, /Phone: Not recorded/);
  assert.match(history, /Monthly selling amount: Not set/);
  state = profile(state, id, { address:'Fixture address', phone:'fixture-phone' });
  history = exportCustomerHistory(state, id);
  assert.match(history, /Address: Fixture address/);
  assert.match(history, /Phone: fixture-phone/);
  assert.match(history, /Expected monthly package profit: Not set/);
});

test('add, persist, reload, and delete customers without losing existing names', () => {
  const storage = store(); let state = createInitialState();
  state = deleteCustomer(state, state.customers[0].id);
  state = addCustomer(state, 'NAZEER');
  assert.equal(state.customers.length, 74);
  const addedId = state.customers.at(-1).id;
  persistState(state, storage);
  const restored = readState(storage);
  assert.equal(restored.customers.at(-1).name, 'NAZEER');
  state = deleteCustomer(restored, addedId);
  assert.equal(state.customers.length, 73);
  assert.equal(state.customers.at(-1).name, 'SSP HOUSE');
  assert.throws(() => addCustomer(state, 'SSP HOUSE'), /already in the list/);
});

test('fresh ledger has no bills, payments, package amounts, or fabricated collections', () => {
  const state = createInitialState();
  assert.ok(state.customers.every(c => c.bills.length === 0 && c.monthlySellingAmount === null));
  assert.match(exportAllPayments(state), /No payment entries have been recorded/);
  assert.match(exportCustomerHistory(state, state.customers[0].id), /No billing details have been recorded/);
  const dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.totalCustomers, 74);
  assert.equal(dashboard.totalCollection, 0);
  assert.equal(dashboard.totalDue, 0);
  assert.equal(dashboard.todayCollection, 0);
  assert.equal(dashboard.previousMonthCollection, 0);
  assert.equal(dashboard.currentMonthDue, 0);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 0);
  assert.equal(dashboard.customersMissingSellingAmount, 74);
  assert.equal(dashboard.incompleteProfitProfiles, 74);
  assert.equal(dashboard.unpricedBillCount, 0);
});

test('history is limited to exactly 24 months and old months are rejected', () => {
  const months = monthsForHistory(referenceDate);
  assert.equal(months.length, 24);
  assert.equal(months[0], '2026-09');
  assert.equal(months.at(-1), '2024-10');
  const state = createInitialState();
  assert.throws(() => saveBillMonth(state, state.customers[0].id, { month:'2024-09', status:'pending' }, referenceDate), /last 24 months/);
});

test('accepts all existing payment methods and both added shop-cash choices', () => {
  const state = createInitialState(); const customerId = state.customers[0].id;
  assert.deepEqual(PAYMENT_METHODS, ['Cash','JazzCash','Easypaisa','Bank Transfer','Cash at Waseem Abbasi shop','Cash at Hassan shop']);
  for (const [index, method] of PAYMENT_METHODS.entries()) {
    const next = addPayment(state, customerId, currentMonth, payment({ method, amount:String(index + 1) }), referenceDate);
    assert.equal(next.customers[0].bills[0].payments[0].method, method);
  }
});

test('payer is optional metadata on one payment, persists locally, and old payer-less receipts remain valid', () => {
  const storage = store();
  let state = createInitialState(['Synthetic Waseem Payer','Synthetic Hassan Payer','Synthetic Legacy Receipt']);
  state = addPayment(state, 'seed-001', currentMonth, payment({ method:'Cash at Waseem Abbasi shop', paidBy:'Tanveer' }), referenceDate);
  state = addPayment(state, 'seed-002', currentMonth, payment({ method:'Cash at Hassan shop', paidBy:'   ' }), referenceDate);
  state = addPayment(state, 'seed-003', currentMonth, payment({ method:'Cash' }), referenceDate);

  const [waseemReceipt] = state.customers[0].bills[0].payments;
  const [hassanReceipt] = state.customers[1].bills[0].payments;
  const [legacyReceipt] = state.customers[2].bills[0].payments;
  assert.equal(waseemReceipt.paidBy, 'Tanveer');
  assert.equal(hassanReceipt.method, 'Cash at Hassan shop');
  assert.equal(Object.hasOwn(hassanReceipt, 'paidBy'), false, 'blank payer is not inferred or stored');
  assert.equal(Object.hasOwn(legacyReceipt, 'paidBy'), false, 'old receipt shape needs no payer field');
  assert.equal(state.customers[0].name, 'Synthetic Waseem Payer', 'payer does not replace customer identity');
  assert.equal(listTransactions(state, { customerQuery:'Tanveer' }, referenceDate).length, 1);

  persistState(state, storage);
  state = readState(storage);
  const restoredWaseem = state.customers[0].bills[0].payments[0];
  assert.equal(restoredWaseem.paidBy, 'Tanveer');
  assert.equal(listTransactions(state, {}, referenceDate).find(row => row.paymentId === restoredWaseem.id).paidBy, 'Tanveer');
  assert.equal(listTransactions(state, {}, referenceDate).find(row => row.paymentId === legacyReceipt.id).paidBy, '');
  assert.match(exportAllPayments(state), /Paid by: Tanveer/);
  assert.match(exportCustomerHistory(state, 'seed-001'), /Paid by: Tanveer/);
  assert.doesNotMatch(exportCustomerHistory(state, 'seed-003'), /Paid by:/);

  state = correctPayment(state, 'seed-001', currentMonth, restoredWaseem.id, payment({ date:'2026-09-16', method:'Cash at Waseem Abbasi shop' }), referenceDate);
  assert.equal(state.customers[0].bills[0].payments[0].paidBy, 'Tanveer', 'editing other receipt fields preserves saved payer when omitted');
  state = correctPayment(state, 'seed-001', currentMonth, restoredWaseem.id, payment({ date:'2026-09-16', method:'Cash at Waseem Abbasi shop', paidBy:'' }), referenceDate);
  assert.equal(Object.hasOwn(state.customers[0].bills[0].payments[0], 'paidBy'), false, 'an explicit blank correction clears only this receipt payer');
});

test('pending partial payments reduce the current selling amount and collection uses actual entries', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  state = profile(state, customerId, { monthlyPurchaseCost:'120', monthlySellingAmount:'250' });
  state = addPayment(state, customerId, currentMonth, payment({ amount:'100', method:'JazzCash' }), referenceDate);
  state = addPayment(state, customerId, currentMonth, payment({ date:'2026-09-20', amount:'50', method:'Cash' }), referenceDate);
  const bill = state.customers[0].bills[0];
  assert.equal(bill.dueAmount, 250);
  assert.equal(bill.priceSnapshot, 250);
  assert.equal(bill.generated, true);
  assert.equal(bill.status, 'pending');
  assert.equal(recordedAmount(bill), 150);
  const dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.totalCollection, 150);
  assert.equal(dashboard.totalDue, 100);
  assert.equal(dashboard.currentMonthDue, 100);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 130);
  assert.equal(dashboard.todayCollection, 0);
});

test('dashboard distinguishes current month from previous-month actual payment dates across a calendar boundary', () => {
  const date = new Date(2026, 8, 1, 12); let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'150' });
  state = addPayment(state, 'seed-001', '2026-09', payment({ date:'2026-09-01', amount:'25' }), date);
  state = saveBillMonth(state, 'seed-002', { month:'2026-08', dueAmount:'200', status:'pending' }, date);
  state = addPayment(state, 'seed-002', '2026-08', payment({ date:'2026-08-31', amount:'60' }), date);
  state = addPayment(state, 'seed-002', '2026-08', payment({ date:'2026-09-01', amount:'10' }), date);
  const dashboard = calculateDashboard(state, date);
  assert.equal(dashboard.today, '2026-09-01');
  assert.equal(dashboard.previousMonth, '2026-08');
  assert.equal(dashboard.totalCollection, 95);
  assert.equal(dashboard.todayCollection, 35);
  assert.equal(dashboard.previousMonthCollection, 60);
  assert.equal(dashboard.currentMonthDue, 125);
  assert.equal(dashboard.totalDue, 255);
});

test('previous-month calculation handles the January-to-December year boundary by payment date', () => {
  const date = new Date(2026, 0, 1, 12); let state = createInitialState();
  state = addPayment(state, 'seed-001', '2026-01', payment({ date:'2025-12-31', amount:'21' }), date);
  state = addPayment(state, 'seed-001', '2026-01', payment({ date:'2026-01-01', amount:'7' }), date);
  const dashboard = calculateDashboard(state, date);
  assert.equal(dashboard.previousMonth, '2025-12');
  assert.equal(dashboard.previousMonthCollection, 21);
  assert.equal(dashboard.todayCollection, 7);
});

test('correcting a payment immediately updates collection, due, today, and previous-month totals', () => {
  const date = new Date(2026, 8, 15, 12); let state = createInitialState();
  state = profile(state, 'seed-001', { monthlyPurchaseCost:'50', monthlySellingAmount:'100' });
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-14', amount:'30' }), date);
  const paymentId = state.customers[0].bills[0].payments[0].id;
  let dashboard = calculateDashboard(state, date);
  assert.equal(dashboard.totalCollection, 30);
  assert.equal(dashboard.currentMonthDue, 70);
  assert.equal(dashboard.todayCollection, 0);
  state = correctPayment(state, 'seed-001', currentMonth, paymentId, payment({ date:'2026-08-31', amount:'45' }), date);
  dashboard = calculateDashboard(state, date);
  assert.equal(dashboard.totalCollection, 45);
  assert.equal(dashboard.currentMonthDue, 55);
  assert.equal(dashboard.todayCollection, 0);
  assert.equal(dashboard.previousMonthCollection, 45);
});

test('customer receipt summaries add actual payments across months and group them by payment date', () => {
  let state = createInitialState();
  state = saveBillMonth(state, 'seed-001', { month:'2026-08', dueAmount:'5000', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-08', payment({ date:'2026-08-15', amount:'3000' }), referenceDate);
  state = saveBillMonth(state, 'seed-001', { month:'2026-09', dueAmount:'9000', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', '2026-09', payment({ date:'2026-09-15', amount:'3000' }), referenceDate);
  assert.deepEqual(summarizeCustomerReceipts(state.customers[0]), {
    total:6000,
    receiptCount:2,
    monthly:[{ month:'2026-09', amount:3000, receiptCount:1 }, { month:'2026-08', amount:3000, receiptCount:1 }]
  });
});

test('receipt summaries never treat a bill charge or selling price as cash received', () => {
  let state = profile(createInitialState(), 'seed-001', { monthlySellingAmount:'6000' });
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  assert.equal(state.customers[0].bills[0].dueAmount, 6000);
  assert.deepEqual(summarizeCustomerReceipts(state.customers[0]), { total:0, receiptCount:0, monthly:[] });
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'1500' }), referenceDate);
  assert.equal(summarizeCustomerReceipts(state.customers[0]).total, 1500);
});

test('receipt summaries stay idempotent across duplicate rows, persistence/reload, and payment edits', () => {
  const storage = store(); let state = createInitialState();
  state = addPayment(state, 'seed-001', '2026-08', payment({ date:'2026-08-15', amount:'3000' }), referenceDate);
  state = addPayment(state, 'seed-001', '2026-09', payment({ date:'2026-09-15', amount:'3000' }), referenceDate);
  const normalState = state;
  const originalAugustReceipt = state.customers[0].bills.find(bill => bill.month === '2026-08').payments[0];
  const customer = state.customers[0];
  const repeatedRowState = { ...state, customers:state.customers.map(row => row.id !== customer.id ? row : { ...row, bills:row.bills.map(bill => bill.month !== '2026-09' ? bill : { ...bill, payments:[...bill.payments, { ...originalAugustReceipt }] }) }) };
  assert.deepEqual(summarizeCustomerReceipts(repeatedRowState.customers[0]), {
    total:6000,
    receiptCount:2,
    monthly:[{ month:'2026-09', amount:3000, receiptCount:1 }, { month:'2026-08', amount:3000, receiptCount:1 }]
  });
  persistState(repeatedRowState, storage);
  state = readState(storage);
  assert.equal(summarizeCustomerReceipts(state.customers[0]).total, 6000);

  state = correctPayment(normalState, 'seed-001', '2026-08', originalAugustReceipt.id, payment({ date:'2026-09-20', amount:'2500' }), referenceDate);
  const corrected = summarizeCustomerReceipts(state.customers[0]);
  assert.equal(corrected.total, 5500);
  assert.equal(corrected.receiptCount, 2);
  assert.deepEqual(corrected.monthly, [{ month:'2026-09', amount:5500, receiptCount:2 }]);
  persistState(state, storage);
  state = readState(storage);
  assert.deepEqual(summarizeCustomerReceipts(state.customers[0]), corrected);
});

test('ISP tenure uses explicit connection dates, handles end dates and never substitutes profile-added dates', () => {
  const connected = { connectionDate:'2025-08-11', serviceStatus:'offline' };
  assert.deepEqual(summarizeCustomerTenure(connected, referenceDate), {
    status:'current', connectionDate:'2025-08-11', profileAddedOn:null, endDate:null, serviceMonths:14
  });
  assert.deepEqual(summarizeCustomerTenure({ ...connected, cancellationDate:'2026-08-12' }, referenceDate), {
    status:'ended', connectionDate:'2025-08-11', profileAddedOn:null, endDate:'2026-08-12', serviceMonths:13
  });
  assert.equal(summarizeCustomerTenure({ ...connected, archived:true, archivedAt:'2026-05-05T10:00' }, referenceDate).serviceMonths, 10);
  assert.equal(summarizeCustomerTenure({ addedOn:'2026-08-01' }, referenceDate).status, 'not-recorded');
  assert.equal(summarizeCustomerTenure({ addedOn:'2026-08-01' }, referenceDate).profileAddedOn, '2026-08-01');
  assert.equal(summarizeCustomerTenure({ connectionDate:'2026-10-01' }, referenceDate).status, 'future');
  assert.equal(summarizeCustomerTenure({ ...connected, archived:true }, referenceDate).status, 'end-date-unknown');
  assert.equal(summarizeCustomerTenure({ connectionDate:'2026-08-01', cancellationDate:'2026-07-31' }, referenceDate).status, 'date-review');
});

test('dashboard never applies a profile selling amount retroactively and excludes unpriced historic bills', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'150' });
  state = addPayment(state, 'seed-001', '2026-08', payment({ date:'2026-08-20', amount:'20' }), referenceDate);
  const dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.currentMonthDue, 150);
  assert.equal(dashboard.totalDue, 150);
  assert.equal(dashboard.totalCollection, 20);
  assert.equal(dashboard.unpricedBillCount, 1);
});

test('a recorded month bill amount overrides the profile selling amount and a Paid toggle cannot clear a real balance', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'150' });
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'180', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'30' }), referenceDate);
  let dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.currentMonthDue, 150);
  assert.equal(dashboard.totalCollection, 30);
  assert.throws(() => saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'180', status:'received' }, referenceDate), /Paid status is derived from actual receipts/);
  dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.currentMonthDue, 150);
  assert.equal(dashboard.totalCollection, 30);
});

test('overpayment never creates negative due and collections remain the actual payment total', () => {
  let state = createInitialState();
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'125' }), referenceDate);
  const dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.currentMonthDue, 0);
  assert.equal(dashboard.totalDue, 0);
  assert.equal(dashboard.totalCollection, 125);
  const report = buildMonthlyReport(state, { month:currentMonth }, referenceDate)[0];
  assert.equal(report.excessAmount, 25);
  assert.equal(report.creditPending, 25);
});

test('expected package profit supports positive, zero, and negative margins', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100', monthlyPurchaseCost:'40' });
  assert.equal(customerPackageProfit(state.customers[0]), 60);
  state = profile(state, 'seed-001', { monthlyPurchaseCost:'100' });
  assert.equal(customerPackageProfit(state.customers[0]), 0);
  state = profile(state, 'seed-001', { monthlyPurchaseCost:'125' });
  assert.equal(customerPackageProfit(state.customers[0]), -25);
  assert.equal(calculateDashboard(state, referenceDate).expectedMonthlyPackageProfit, -25);
});

test('missing cost or selling amount marks per-customer profit not set and excludes incomplete profiles', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' });
  state = profile(state, 'seed-002', { monthlyPurchaseCost:'40' });
  state = profile(state, 'seed-003', { monthlySellingAmount:'80', monthlyPurchaseCost:'30' });
  assert.equal(customerPackageProfit(state.customers[0]), null);
  assert.equal(customerPackageProfit(state.customers[1]), null);
  assert.equal(customerPackageProfit(state.customers[2]), 50);
  const dashboard = calculateDashboard(generateMonthlyBillsThroughCurrentMonth(state, referenceDate), referenceDate);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 50);
  assert.equal(dashboard.incompleteProfitProfiles, 73);
  assert.equal(dashboard.customersMissingSellingAmount, 72);
  assert.equal(dashboard.currentMonthDue, 180);
});

test('dashboard expected profit and current due recalculate after profile price edits', () => {
  let state = createInitialState();
  let dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 0);
  state = profile(state, 'seed-001', { monthlySellingAmount:'100', monthlyPurchaseCost:'60' });
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 40);
  assert.equal(dashboard.currentMonthDue, 100);
  state = profile(state, 'seed-001', { monthlySellingAmount:'130' });
  dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 70);
  assert.equal(dashboard.currentMonthDue, 100);
  assert.equal(state.customers[0].monthlyPriceSchedule.at(-1).effectiveMonth, '2026-10');
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'30' }), referenceDate);
  dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.expectedMonthlyPackageProfit, 70);
  assert.equal(dashboard.currentMonthDue, 70);
  assert.equal(dashboard.totalCollection, 30);
});

test('collection total excludes bill months outside the retained 24-month window', () => {
  let state = createInitialState();
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'8' }), referenceDate);
  const customer = state.customers[0];
  const oldBill = { id:'old-bill', month:'2024-09', dueAmount:null, status:'pending', payments:[{ id:'old-payment', date:'2024-09-30', amount:99, method:'Cash' }] };
  state = { ...state, customers:state.customers.map(c => c.id === customer.id ? { ...c, bills:[...c.bills, oldBill] } : c) };
  assert.equal(calculateDashboard(state, referenceDate).totalCollection, 8);
});

test('TXT exports include actual recorded payments and the saved contact/package profile only', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  state = profile(state, customerId, { address:'Fixture address', phone:'fixture-phone', packageSpeed:'Fixture package', monthlyPurchaseCost:'20', monthlySellingAmount:'60' });
  state = saveBillMonth(state, customerId, { month:currentMonth, dueAmount:'60', status:'pending' }, referenceDate);
  state = addPayment(state, customerId, currentMonth, payment({ amount:'60', method:'Bank Transfer' }), referenceDate);
  const all = exportAllPayments(state);
  const individual = exportCustomerHistory(state, customerId);
  for (const text of [all, individual]) {
    assert.match(text, /NAZEER/);
    assert.match(text, /2026-09/);
    assert.match(text, /2026-09-15/);
    assert.match(text, /60/);
    assert.match(text, /Bank Transfer/);
  }
  assert.match(individual, /Address: Fixture address/);
  assert.match(individual, /Phone: fixture-phone/);
  assert.match(individual, /Package \/ speed: Fixture package/);
  assert.match(individual, /Monthly provider purchase cost: PKR 20/);
  assert.match(individual, /Monthly selling amount: PKR 60/);
  assert.match(individual, /Expected monthly package profit: PKR 40/);
  assert.doesNotMatch(all, /fixture-phone/);
  assert.doesNotMatch(all, /AWAIS/);
  assert.match(individual, /Status: Paid/);
});

test('rejects invalid payments and invalid calendar dates', () => {
  const state = createInitialState(); const customerId = state.customers[0].id;
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({ amount:'0' }), referenceDate), /greater than zero/);
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({ method:'Cheque' }), referenceDate), /valid payment method/);
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({ date:'not-a-date' }), referenceDate), /valid payment date/);
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({ date:'2026-02-29' }), referenceDate), /valid payment date/);
});


test('customer numbers are sequential, stable across deletion and reload, and never reused', () => {
  let state = createInitialState();
  assert.deepEqual(state.customers.map(customer => customer.customerNumber), Array.from({ length:74 }, (_, index) => index + 1));
  const originalId = state.customers[1].id;
  state = deleteCustomer(state, 'seed-074');
  state = addCustomer(state, 'Temporary test customer');
  assert.equal(state.customers.at(-1).customerNumber, 75);
  state = deleteCustomer(state, originalId);
  state = addCustomer(state, 'Second temporary test customer');
  assert.equal(state.customers.at(-1).customerNumber, 76);
  assert.equal(state.customers.find(customer => customer.id === 'seed-001').customerNumber, 1);
  const storage = store(); persistState(state, storage); state = readState(storage);
  state = addCustomer(state, 'Third temporary test customer');
  assert.equal(state.customers.at(-1).customerNumber, 77);
  assert.throws(() => addCustomer(state, 'nazeer'), /already in the list/);
});

test('migration repairs duplicate or missing customer numbers without collisions', () => {
  const storage = store();
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify({ version:1, customers:[
    { id:'legacy-a', name:'NAZEER', customerNumber:7, bills:[] },
    { id:'legacy-b', name:'AWAIS', customerNumber:7, bills:[] },
    { id:'legacy-c', name:'TEHMENA', bills:[] }
  ] }));
  const migrated = readState(storage);
  const numbers = migrated.customers.map(customer => customer.customerNumber);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.deepEqual(numbers, [1,2,3]);
  assert.equal(migrated.customers.every(customer => Array.isArray(customer.incidents)), true);
});

test('global customer search matches partial name, optional phone/address, and partial number', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { phone:'PhoneLookup-742', address:'Lane 8, Building 31' });
  assert.deepEqual(searchCustomers(state, 'naz').map(customer => customer.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, 'lookup-742').map(customer => customer.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, 'Building 31').map(customer => customer.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, '#74').map(customer => customer.id), ['seed-074']);
  assert.ok(searchCustomers(state, '#7').some(customer => customer.id === 'seed-007'));
  assert.equal(createInitialState().customers.every(customer => customer.address === '' && customer.phone === ''), true);
});

test('all-customer transactions are newest first, filter by date, and share name/phone/address/number search', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { phone:'PhoneLookup-742', address:'Lane 8, Building 31' });
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-20', amount:'30' }), referenceDate);
  state = addPayment(state, 'seed-002', currentMonth, payment({ date:'2026-09-19', amount:'20' }), referenceDate);
  state = addPayment(state, 'seed-074', currentMonth, payment({ date:'2026-09-21', amount:'40' }), referenceDate);
  const transactions = listTransactions(state, {}, referenceDate);
  assert.deepEqual(transactions.map(row => row.customerNumber), [74,1,2]);
  assert.deepEqual(listTransactions(state, { date:'2026-09-20' }, referenceDate).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'phoneLookup-742' }, referenceDate).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Building 31' }, referenceDate).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'#74' }, referenceDate).map(row => row.customerNumber), [74]);
  assert.deepEqual(listTransactions(state, { customerQuery:'NAZ' }, referenceDate).map(row => row.customerId), ['seed-001']);
});

test('transaction recency windows use inclusive Pakistan-local payment dates and intersect with name/date filters', () => {
  const pktMidnight = new Date('2026-10-04T19:00:00.000Z');
  const justBeforePktMidnight = new Date('2026-10-04T18:59:59.999Z');
  let state = createInitialState(['Synthetic Recency A','Synthetic Recency B','Synthetic Recency C','Synthetic Recency D','Synthetic Recency E','Synthetic Recency F','Synthetic Recency G']);
  state = saveBillMonth(state, 'seed-001', { month:'2026-10', dueAmount:'30', dueDate:'2026-10-05', status:'pending' }, pktMidnight);
  state = addPayment(state, 'seed-001', '2026-08', payment({ date:'2026-10-01', amount:'10' }), pktMidnight);
  state = addPayment(state, 'seed-001', '2026-09', payment({ date:'2026-09-29', amount:'20' }), pktMidnight);
  state = addPayment(state, 'seed-001', '2026-10', payment({ date:'2026-10-05', amount:'30' }), pktMidnight);
  state = saveBillMonth(state, 'seed-002', { month:'2026-10', dueAmount:'100', status:'pending' }, pktMidnight);
  state = addPayment(state, 'seed-002', '2026-10', payment({ date:'2026-09-28', amount:'40' }), pktMidnight);
  state = addPayment(state, 'seed-003', '2026-10', payment({ date:'2026-10-06', amount:'50' }), pktMidnight);
  state = addPayment(state, 'seed-004', '2026-07', payment({ date:'2026-07-08', amount:'60' }), pktMidnight);
  state = addPayment(state, 'seed-005', '2026-07', payment({ date:'2026-07-07', amount:'70' }), pktMidnight);
  state = addPayment(state, 'seed-006', '2026-09', payment({ date:'2026-09-06', amount:'80' }), pktMidnight);
  state = addPayment(state, 'seed-007', '2026-09', payment({ date:'2026-09-05', amount:'90' }), pktMidnight);

  const allHistory = listTransactions(state, {}, pktMidnight);
  assert.deepEqual(allHistory.map(row => row.date), ['2026-10-06','2026-10-05','2026-10-01','2026-09-29','2026-09-28','2026-09-06','2026-09-05','2026-07-08','2026-07-07']);
  assert.equal(allHistory.find(row => row.date === '2026-10-05').status, 'paid');
  assert.equal(allHistory.find(row => row.date === '2026-10-05').balanceDueCents, 0);

  const last7 = listTransactions(state, { recencyDays:7 }, pktMidnight);
  assert.deepEqual(last7.map(row => row.date), ['2026-10-05','2026-10-01','2026-09-29']);
  assert.equal(last7.find(row => row.date === '2026-10-01').month, '2026-08', 'an old bill month is included when its actual payment date is recent');
  assert.ok(!last7.some(row => row.month === '2026-10' && row.date === '2026-09-28'), 'a current bill month is excluded when its actual payment date is old');
  assert.deepEqual(listTransactions(state, { recencyDays:30 }, pktMidnight).map(row => row.date), ['2026-10-05','2026-10-01','2026-09-29','2026-09-28','2026-09-06']);
  assert.deepEqual(listTransactions(state, { recencyDays:90 }, pktMidnight).map(row => row.date), ['2026-10-05','2026-10-01','2026-09-29','2026-09-28','2026-09-06','2026-09-05','2026-07-08']);
  assert.ok(listTransactions(state, { recencyDays:7 }, justBeforePktMidnight).some(row => row.date === '2026-09-28'), 'the local calendar day boundary advances at midnight PKT, not UTC midnight');

  assert.deepEqual(listTransactions(state, { customerQuery:'Synthetic Recency A', date:'2026-10-05', recencyDays:7 }, pktMidnight).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Synthetic Recency A', date:'2026-09-28', recencyDays:7 }, pktMidnight), [], 'exact date and customer search intersect with recency');
  assert.deepEqual(listTransactions(state, { date:'2026-09-28' }, pktMidnight).map(row => row.customerId), ['seed-002'], 'clearing recency restores the exact-date-only history');
  assert.deepEqual(listTransactions(state, { recencyDays:'all' }, pktMidnight), allHistory, 'All history preserves the original newest-first ledger');
  assert.deepEqual(listTransactions(state, { customerQuery:'No matching synthetic customer', recencyDays:7 }, pktMidnight), [], 'no matches produce an empty result');
  assert.throws(() => listTransactions(state, { recencyDays:14 }, pktMidnight), /Choose All history, Last 7 days/);
});

test('global search finds customers by saved bill status, amount, and exact receipt details across customers', () => {
  let state = createInitialState();
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'1200', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-12', amount:'300', method:'Easypaisa' }), referenceDate);
  state = saveBillMonth(state, 'seed-002', { month:currentMonth, dueAmount:'800', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-002', currentMonth, payment({ date:'2026-09-13', amount:'800', method:'JazzCash' }), referenceDate);

  assert.deepEqual(searchCustomers(state, 'partial').map(row => row.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, 'paid').map(row => row.id), ['seed-002']);
  assert.deepEqual(searchCustomers(state, 'PKR 1,200').map(row => row.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, 'Easypaisa').map(row => row.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, '2026-09-12').map(row => row.id), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Easypaisa' }, referenceDate).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Paid' }, referenceDate).map(row => row.customerId), ['seed-002']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Partial' }, referenceDate).map(row => row.customerId), ['seed-001']);
  assert.deepEqual(listTransactions(state, { customerQuery:'Easypaisa', date:'2026-09-13' }, referenceDate), []);
});

test('monthly report classifies priced customers, shows unconfigured rows as Not set, and never calls them unpaid', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' });
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'100' }), referenceDate);
  state = profile(state, 'seed-002', { monthlySellingAmount:'100' });
  state = profile(state, 'seed-003', { packageSpeed:'Test plan', monthlySellingAmount:'100' });
  state = addPayment(state, 'seed-003', currentMonth, payment({ amount:'40' }), referenceDate);
  state = addPayment(state, 'seed-004', currentMonth, payment({ amount:'55' }), referenceDate);
  state = saveBillMonth(state, 'seed-005', { month:currentMonth, dueAmount:'60', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-005', currentMonth, payment({ amount:'60' }), referenceDate);
  const options = { month:currentMonth };
  assert.equal(buildMonthlyReport(state, options, referenceDate).length, 74);
  assert.equal(buildMonthlyReport(state, { ...options, statusFilter:'paid' }, referenceDate).length, 2);
  assert.equal(buildMonthlyReport(state, { ...options, statusFilter:'unpaid' }, referenceDate).length, 1);
  assert.equal(buildMonthlyReport(state, { ...options, statusFilter:'partial' }, referenceDate).length, 1);
  const unconfigured = buildMonthlyReport(state, options, referenceDate).find(row => row.customerId === 'seed-004');
  assert.equal(unconfigured.status, 'not-set');
  assert.equal(unconfigured.billAmount, null);
  assert.equal(unconfigured.balanceDue, null);
  assert.equal(unconfigured.amountReceived, 55);
  const partial = buildMonthlyReport(state, { ...options, statusFilter:'partial' }, referenceDate)[0];
  assert.equal(partial.customerNumber, 3);
  assert.equal(partial.packageSpeed, 'Test plan');
  assert.equal(partial.monthlySellingAmount, 100);
  assert.equal(partial.amountReceived, 40);
  assert.equal(partial.balanceDue, 60);
  assert.equal(buildMonthlyReport(state, { ...options, statusFilter:'pending' }, referenceDate)[0].customerId, 'seed-002');
  assert.equal(buildMonthlyReport(state, { ...options, statusFilter:'not-set' }, referenceDate).length, 70);
  assert.throws(() => buildMonthlyReport(state, { ...options, statusFilter:'unknown' }, referenceDate), /Choose All, Paid, Pending, Partial, or Not set/);
});

test('monthly report month selection uses explicit past bills only and shared search filters report rows', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { phone:'ReportPhone-22', address:'Report Address 15', monthlySellingAmount:'90' });
  state = saveBillMonth(state, 'seed-002', { month:'2026-08', dueAmount:'80', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-002', '2026-08', payment({ date:'2026-08-18', amount:'30' }), referenceDate);
  const current = buildMonthlyReport(state, { month:currentMonth, customerQuery:'ReportPhone-22' }, referenceDate);
  assert.equal(current.length, 1);
  assert.equal(current[0].status, 'pending');
  assert.equal(current[0].billAmount, 90);
  const past = buildMonthlyReport(state, { month:'2026-08', statusFilter:'partial' }, referenceDate);
  assert.equal(past.length, 1);
  assert.equal(past[0].customerNumber, 2);
  assert.equal(past[0].billAmount, 80);
  assert.equal(past[0].amountReceived, 30);
  assert.equal(past[0].balanceDue, 50);
  const unpricedPast = buildMonthlyReport(state, { month:'2026-08' }, referenceDate).find(row => row.customerId === 'seed-001');
  assert.equal(unpricedPast.status, 'not-set');
  assert.equal(unpricedPast.billAmount, null);
});

test('customer-card filters combine manual service state, derived bill state, selected month and global search', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { serviceStatus:'active', phone:'FilterPhone-1' });
  state = profile(state, 'seed-002', { serviceStatus:'active' });
  state = profile(state, 'seed-003', { serviceStatus:'offline' });
  state = profile(state, 'seed-004', { serviceStatus:'not-set' });
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'100' }), referenceDate);
  state = saveBillMonth(state, 'seed-002', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = saveBillMonth(state, 'seed-003', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-003', currentMonth, payment({ amount:'40' }), referenceDate);
  state = saveBillMonth(state, 'seed-001', { month:'2026-08', dueAmount:'80', status:'pending' }, referenceDate);
  assert.deepEqual(filterCustomersByStatus(state, { billingStatus:'paid', month:currentMonth }, referenceDate).map(row => row.id), ['seed-001']);
  assert.deepEqual(filterCustomersByStatus(state, { billingStatus:'pending', serviceStatus:'active', month:currentMonth }, referenceDate).map(row => row.id), ['seed-002']);
  assert.deepEqual(filterCustomersByStatus(state, { billingStatus:'partial', serviceStatus:'offline', month:currentMonth }, referenceDate).map(row => row.id), ['seed-003']);
  assert.ok(filterCustomersByStatus(state, { billingStatus:'not-set', month:currentMonth }, referenceDate).some(row => row.id === 'seed-004'));
  assert.deepEqual(filterCustomersByStatus(state, { serviceStatus:'active', customerQuery:'FilterPhone-1', month:'2026-08' }, referenceDate).map(row => row.id), ['seed-001']);
  assert.deepEqual(filterCustomersByStatus(state, { serviceStatus:'offline', billingStatus:'pending', month:'2026-08' }, referenceDate).map(row => row.id), []);
  const customer = state.customers[0];
  assert.equal(derivedBillStatus(customer, undefined), 'not-set');
  assert.equal(derivedBillStatus(customer, customer.bills.find(bill => bill.month === currentMonth)), 'paid');
});

test('customer-list search matches name, formatted phone, customer number and stable ID across every billing-status filter', () => {
  let state = createInitialState(['Synthetic Paid Search','Synthetic Partial Search','Synthetic Pending Search','Synthetic Not Set Search']);
  state = profile(state, 'seed-001', { phone:'+92 (300) 111-2222' });
  state = profile(state, 'seed-002', { phone:'0300-222-3333' });
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'100' }), referenceDate);
  state = saveBillMonth(state, 'seed-002', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-002', currentMonth, payment({ amount:'40' }), referenceDate);
  state = saveBillMonth(state, 'seed-003', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);

  assert.deepEqual(searchCustomers(state, 'Synthetic Paid Search').map(row => row.id), ['seed-001']);
  assert.deepEqual(searchCustomers(state, '923001112222').map(row => row.id), ['seed-001'], 'phone digits match regardless of saved punctuation');
  assert.deepEqual(searchCustomers(state, '0300 222 3333').map(row => row.id), ['seed-002'], 'spaces in a phone query do not require matching saved punctuation');
  assert.deepEqual(searchCustomers(state, '#3').map(row => row.id), ['seed-003']);
  assert.deepEqual(searchCustomers(state, 'seed-004').map(row => row.id), ['seed-004']);

  const matches = (billingStatus, customerQuery) => filterCustomersByStatus(state, { billingStatus, month:currentMonth, customerQuery }, referenceDate).map(row => row.id);
  assert.deepEqual(matches('paid', 'Synthetic Paid Search'), ['seed-001']);
  assert.deepEqual(matches('partial', '03002223333'), ['seed-002']);
  assert.deepEqual(matches('pending', '#3'), ['seed-003']);
  assert.deepEqual(matches('not-set', 'seed-004'), ['seed-004']);
});

test('correcting and deleting one of multiple installments updates history, totals, status, exports, and reload', () => {
  const storage = store(); let state = createInitialState();
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-14', amount:'30' }), referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-15', amount:'20', method:'JazzCash' }), referenceDate);
  const firstId = state.customers[0].bills[0].payments[0].id;
  const secondId = state.customers[0].bills[0].payments[1].id;
  state = correctPayment(state, 'seed-001', currentMonth, firstId, payment({ date:'2026-09-16', amount:'10' }), referenceDate);
  assert.equal(calculateDashboard(state, referenceDate).totalCollection, 30);
  assert.equal(buildMonthlyReport(state, { month:currentMonth, statusFilter:'partial', customerQuery:'#1' }, referenceDate)[0].balanceDue, 70);
  persistState(state, storage); state = readState(storage);
  assert.equal(state.customers[0].bills[0].payments.find(item => item.id === firstId).amount, 10);
  state = deletePayment(state, 'seed-001', currentMonth, firstId, referenceDate);
  persistState(state, storage); state = readState(storage);
  const bill = state.customers[0].bills[0];
  assert.deepEqual(bill.payments.map(item => item.id), [secondId]);
  assert.equal(recordedAmount(bill), 20);
  assert.equal(effectiveBillStatus(state.customers[0], bill, referenceDate), 'pending');
  assert.equal(calculateDashboard(state, referenceDate).totalCollection, 20);
  assert.equal(calculateDashboard(state, referenceDate).currentMonthDue, 80);
  assert.equal(buildMonthlyReport(state, { month:currentMonth, statusFilter:'partial', customerQuery:'#1' }, referenceDate)[0].balanceDue, 80);
  assert.equal(listTransactions(state, { customerQuery:'#1' }, referenceDate).length, 1);
  assert.doesNotMatch(exportAllPayments(state), /Amount: PKR 10\n/);
  assert.match(exportAllPayments(state), /Amount: PKR 20/);
  assert.doesNotMatch(exportCustomerHistory(state, 'seed-001'), /Amount: PKR 10/);
});

const incident = (overrides = {}) => ({ reportedAt:'2026-09-28T10:00', offlineAt:'2026-09-28T09:30', restoredAt:'', note:'', ...overrides });

test('fresh profiles contain no complaint or outage history', () => {
  const state = createInitialState();
  assert.ok(state.customers.every(customer => Array.isArray(customer.incidents) && customer.incidents.length === 0));
  assert.match(exportCustomerHistory(state, 'seed-001'), /No complaint\/outage records have been recorded/);
});

test('manual incident log supports multiple open and resolved outages and exact rolling 30-day local-time boundaries', () => {
  const reference = new Date(2026, 8, 29, 12, 0, 0); let state = createInitialState();
  state = addIncident(state, 'seed-001', incident(), reference);
  state = addIncident(state, 'seed-001', incident({ reportedAt:'2026-09-01T08:00', offlineAt:'2026-09-01T07:30', restoredAt:'2026-09-02T11:00', note:'Resolved test note' }), reference);
  state = addIncident(state, 'seed-001', incident({ reportedAt:'2026-08-30T12:00', offlineAt:'2026-08-30T11:00', restoredAt:'2026-08-30T13:00' }), reference);
  state = addIncident(state, 'seed-001', incident({ reportedAt:'2026-08-30T11:59', offlineAt:'2026-08-30T11:00' }), reference);
  state = addIncident(state, 'seed-001', incident({ reportedAt:'2026-09-29T12:01', offlineAt:'2026-09-29T12:02' }), reference);
  const stored = state.customers[0].incidents;
  assert.equal(stored.length, 5);
  assert.equal(stored.filter(item => !item.restoredAt).length, 3);
  assert.equal(stored.filter(item => item.restoredAt).length, 2);
  assert.equal(countCustomerIncidentsLast30Days(state, 'seed-001', reference), 3);
  assert.equal(countCustomerIncidentsLast30Days(state, 'seed-002', reference), 0);
  assert.ok(stored[0].reportedAt >= stored[1].reportedAt);
});

test('incident date/time validation rejects malformed dates and restoration before report or outage start', () => {
  const state = createInitialState(); const customerId = 'seed-001';
  assert.doesNotThrow(() => addIncident(state, customerId, incident()));
  assert.throws(() => addIncident(state, customerId, incident({ reportedAt:'2026-02-30T12:00' })), /valid complaint\/report date and time/);
  assert.throws(() => addIncident(state, customerId, incident({ offlineAt:'bad-time' })), /valid offline-start date and time/);
  assert.throws(() => addIncident(state, customerId, incident({ restoredAt:'2026-09-28T08:00' })), /cannot be earlier/);
  assert.throws(() => addIncident(state, customerId, incident({ offlineAt:'2026-09-29T11:00', restoredAt:'2026-09-29T10:59' })), /cannot be earlier/);
});

test('incident edits preserve a visible correction audit and persistence; confirmed deletion removes the record from count/export', () => {
  const storage = store(); const reference = new Date(2026, 8, 29, 12, 0, 0); let state = createInitialState();
  state = addIncident(state, 'seed-001', incident({ note:'Initial test note' }), reference);
  const incidentId = state.customers[0].incidents[0].id;
  state = updateIncident(state, 'seed-001', incidentId, incident({ reportedAt:'2026-09-27T10:00', offlineAt:'2026-09-27T09:15', restoredAt:'2026-09-27T12:00', note:'Corrected test note' }), new Date('2026-09-29T12:30:00+05:00'));
  persistState(state, storage); state = readState(storage);
  const corrected = state.customers[0].incidents.find(item => item.id === incidentId);
  assert.equal(corrected.restoredAt, '2026-09-27T12:00');
  assert.equal(corrected.corrections.length, 1);
  assert.equal(corrected.corrections[0].previous.note, 'Initial test note');
  const exported = exportCustomerHistory(state, 'seed-001');
  assert.match(exported, /Corrected test note/);
  assert.match(exported, /Correction at 2026-09-29T12:30/);
  assert.match(exported, /previous report=2026-09-28T10:00/);
  assert.equal(countCustomerIncidentsLast30Days(state, 'seed-001', reference), 1);
  state = deleteIncident(state, 'seed-001', incidentId);
  persistState(state, storage); state = readState(storage);
  assert.equal(state.customers[0].incidents.length, 0);
  assert.equal(countCustomerIncidentsLast30Days(state, 'seed-001', reference), 0);
  assert.doesNotMatch(exportCustomerHistory(state, 'seed-001'), /Corrected test note|Initial test note/);
});


test('automatic local-month billing is idempotent, never backfills before price setup, and snapshots next-month price changes', () => {
  const sep1 = new Date(2026, 8, 1, 9); const sep29 = new Date(2026, 8, 29, 12); const oct1 = new Date(2026, 9, 1, 9);
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'90' }, sep1);
  assert.deepEqual(state.customers[0].bills, []);
  state = generateMonthlyBillsThroughCurrentMonth(state, sep29);
  let customer = state.customers[0];
  assert.deepEqual(customer.bills.map(bill => bill.month), ['2026-09']);
  assert.equal(customer.bills[0].dueAmount, 90);
  assert.equal(customer.bills[0].priceSnapshot, 90);
  assert.equal(customer.bills[0].generated, true);
  assert.strictEqual(generateMonthlyBillsThroughCurrentMonth(state, sep29), state);
  state = profile(state, 'seed-001', { monthlySellingAmount:'120' }, sep29);
  assert.equal(state.customers[0].monthlyPriceSchedule.at(-1).effectiveMonth, '2026-10');
  state = generateMonthlyBillsThroughCurrentMonth(state, oct1);
  customer = state.customers[0];
  assert.deepEqual(customer.bills.map(bill => bill.month), ['2026-10','2026-09']);
  assert.equal(customer.bills.find(bill => bill.month === '2026-09').dueAmount, 90);
  assert.equal(customer.bills.find(bill => bill.month === '2026-10').dueAmount, 120);
  assert.equal(customer.bills.find(bill => bill.month === '2026-09').priceSnapshot, 90);
});

test('unconfigured customers receive no automatic bill; a new configured customer starts only at its effective month', () => {
  const jan5 = new Date(2026, 0, 5, 10); const mar15 = new Date(2026, 2, 15, 10);
  let state = createInitialState();
  assert.strictEqual(generateMonthlyBillsThroughCurrentMonth(state, mar15), state);
  state = addCustomer(state, 'Fixture new customer');
  const newId = state.customers.at(-1).id;
  state = profile(state, newId, { monthlySellingAmount:'65' }, jan5);
  state = generateMonthlyBillsThroughCurrentMonth(state, mar15);
  const customer = state.customers.find(item => item.id === newId);
  assert.deepEqual(customer.bills.map(bill => bill.month), ['2026-03','2026-02','2026-01']);
  assert.ok(customer.bills.every(bill => bill.dueAmount === 65 && bill.priceSnapshot === 65));
  assert.equal(state.customers.filter(item => item.id.startsWith('seed-')).every(item => item.bills.length === 0), true);
});

test('automatic bill amount corrections preserve the generated price snapshot and show a correction trail', () => {
  const storage = store(); let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'90' }, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'95', status:'pending' }, referenceDate);
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'92', status:'pending' }, referenceDate);
  const bill = state.customers[0].bills.find(item => item.month === currentMonth);
  assert.equal(bill.generated, true);
  assert.equal(bill.priceSnapshot, 90);
  assert.equal(bill.dueAmount, 92);
  assert.equal(bill.amountHistory.length, 2);
  assert.equal(bill.amountHistory[0].previousAmount, 90);
  assert.equal(bill.amountHistory[1].previousAmount, 95);
  persistState(state, storage); state = readState(storage);
  assert.match(exportCustomerHistory(state, 'seed-001'), /Bill amount correction/);
});

test('partial and exact receipts cover only their own bill and create no excess credit', () => {
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' }, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'40' }), referenceDate);
  let allocation = calculatePaymentAllocations(state);
  assert.equal(allocation.forMonth('seed-001', currentMonth).balanceDueCents, 6000);
  assert.equal(allocation.forMonth('seed-001', currentMonth).excessGeneratedCents, 0);
  assert.equal(buildMonthlyReport(state, { month:currentMonth }, referenceDate).find(row => row.customerId === 'seed-001').status, 'partial');
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-20', amount:'60' }), referenceDate);
  allocation = calculatePaymentAllocations(state);
  assert.equal(allocation.forMonth('seed-001', currentMonth).balanceDueCents, 0);
  assert.equal(allocation.forMonth('seed-001', currentMonth).excessGeneratedCents, 0);
  assert.equal(allocation.forMonth('seed-001', currentMonth).pendingCreditCents, 0);
  assert.equal(calculateDashboard(state, referenceDate).totalCollection, 100);
});

test('overpayment credit rolls through later generated bills while cash collection and transaction counts stay single-entry', () => {
  const december1 = new Date(2026, 11, 1, 9);
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' }, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ date:'2026-09-20', amount:'350' }), referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, december1);
  const allocations = calculatePaymentAllocations(state);
  const september = allocations.forMonth('seed-001', '2026-09');
  const october = allocations.forMonth('seed-001', '2026-10');
  const november = allocations.forMonth('seed-001', '2026-11');
  const december = allocations.forMonth('seed-001', '2026-12');
  assert.equal(september.actualReceiptsCents, 35000);
  assert.equal(september.balanceDueCents, 0);
  assert.equal(september.excessGeneratedCents, 25000);
  assert.equal(september.creditForwardedCents, 25000);
  assert.equal(september.pendingCreditCents, 0);
  assert.equal(october.creditAppliedCents, 10000);
  assert.equal(october.balanceDueCents, 0);
  assert.equal(november.creditAppliedCents, 10000);
  assert.equal(november.balanceDueCents, 0);
  assert.equal(december.creditAppliedCents, 5000);
  assert.equal(december.balanceDueCents, 5000);
  assert.equal(december.creditSources[0].originMonth, '2026-09');
  assert.equal(december.creditSources[0].paymentDate, '2026-09-20');
  assert.equal(december.creditSources[0].method, 'Cash');
  const report = buildMonthlyReport(state, { month:'2026-12', statusFilter:'partial' }, december1).find(row => row.customerId === 'seed-001');
  assert.equal(report.amountReceived, 0);
  assert.equal(report.creditApplied, 50);
  assert.equal(report.balanceDue, 50);
  assert.equal(report.creditSources[0].receiptAmount, 350);
  const dashboard = calculateDashboard(state, december1);
  assert.equal(dashboard.totalCollection, 350);
  assert.equal(dashboard.totalDue, 50);
  assert.equal(listTransactions(state, {}, december1).length, 1);
  const allPayments = exportAllPayments(state);
  assert.equal((allPayments.match(/Amount: PKR 350 \(actual receipt, counted once\)/g) ?? []).length, 1);
  assert.match(allPayments, /Auto-credit applied to 2026-10: PKR 100/);
  assert.match(exportCustomerHistory(state, 'seed-001'), /Credit source: original PKR 350 receipt dated 2026-09-20 \(Cash\) from 2026-09; applied here=PKR 50/);
});

test('unapplied excess persists on its original receipt until the next month bill is generated', () => {
  const storage = store(); const october1 = new Date(2026, 9, 1, 9);
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' }, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'150' }), referenceDate);
  let ledger = calculatePaymentAllocations(state);
  assert.equal(ledger.forMonth('seed-001', currentMonth).pendingCreditCents, 5000);
  assert.equal(ledger.byPaymentId.get(state.customers[0].bills.find(bill => bill.month === currentMonth).payments[0].id).unappliedCreditCents, 5000);
  persistState(state, storage); state = readState(storage);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', currentMonth).pendingCreditCents, 5000);
  state = generateMonthlyBillsThroughCurrentMonth(state, october1);
  ledger = calculatePaymentAllocations(state);
  assert.equal(ledger.forMonth('seed-001', '2026-10').billAmountCents, 10000);
  assert.equal(ledger.forMonth('seed-001', '2026-10').creditAppliedCents, 5000);
  assert.equal(ledger.forMonth('seed-001', '2026-10').balanceDueCents, 5000);
  const dashboard = calculateDashboard(state, october1);
  assert.equal(dashboard.currentMonthDue, 50);
  assert.equal(dashboard.totalCollection, 150);
  assert.equal(listTransactions(state, {}, october1).length, 1);
});

test('editing or deleting a source receipt recomputes every later credit and outstanding month without changing other cash', () => {
  const october1 = new Date(2026, 9, 1, 9);
  let state = createInitialState();
  state = profile(state, 'seed-001', { monthlySellingAmount:'100' }, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'150' }), referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, october1);
  const sourceId = state.customers[0].bills.find(bill => bill.month === currentMonth).payments[0].id;
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-10').balanceDueCents, 5000);
  state = correctPayment(state, 'seed-001', currentMonth, sourceId, payment({ date:'2026-09-21', amount:'70' }), october1);
  let ledger = calculatePaymentAllocations(state);
  assert.equal(ledger.forMonth('seed-001', currentMonth).balanceDueCents, 3000);
  assert.equal(ledger.forMonth('seed-001', '2026-10').creditAppliedCents, 0);
  assert.equal(ledger.forMonth('seed-001', '2026-10').balanceDueCents, 10000);
  let dashboard = calculateDashboard(state, october1);
  assert.equal(dashboard.totalCollection, 70);
  assert.equal(dashboard.totalDue, 130);
  state = deletePayment(state, 'seed-001', currentMonth, sourceId, october1);
  ledger = calculatePaymentAllocations(state);
  assert.equal(ledger.forMonth('seed-001', currentMonth).balanceDueCents, 10000);
  assert.equal(ledger.forMonth('seed-001', '2026-10').creditAppliedCents, 0);
  assert.equal(ledger.forMonth('seed-001', '2026-10').balanceDueCents, 10000);
  dashboard = calculateDashboard(state, october1);
  assert.equal(dashboard.totalCollection, 0);
  assert.equal(dashboard.totalDue, 200);
  assert.equal(listTransactions(state, {}, october1).length, 0);
});

test('unapplied customer credit remains visible and valid indefinitely after its source bill leaves the 24-month display', () => {
  const state = createInitialState();
  const customer = state.customers[0];
  const oldBill = { id:'old-source-bill', month:'2024-09', dueAmount:100, status:'pending', generated:false, payments:[{ id:'old-source-receipt', date:'2024-09-30', amount:150, method:'Cash' }] };
  const withBills = { ...state, customers:state.customers.map(item => item.id === customer.id ? { ...item, bills:[oldBill] } : item) };
  const ledger = calculatePaymentAllocations(withBills);
  assert.equal(ledger.forMonth(customer.id, '2024-09').pendingCreditCents, 5000);
  assert.equal(ledger.forMonth(customer.id, currentMonth), undefined);
  const dashboard = calculateDashboard(withBills, referenceDate);
  assert.equal(dashboard.totalCollection, 0);
  assert.equal(dashboard.totalDue, 0);
  assert.equal(dashboard.pendingCredit, 50);
  assert.equal(listTransactions(withBills, {}, referenceDate).length, 1);
  const pendingReport = buildMonthlyReport(withBills, { month:currentMonth }, referenceDate).find(row => row.customerId === customer.id);
  assert.equal(pendingReport.status, 'not-set');
  assert.equal(pendingReport.creditPending, 50);
  assert.equal(pendingReport.pendingCreditSources[0].paymentId, 'old-source-receipt');
  assert.equal(pendingReport.pendingCreditSources[0].originMonth, '2024-09');
  const exportText = exportCustomerHistory(withBills, customer.id);
  assert.equal((exportAllPayments(withBills).match(/Amount: PKR 150 \(actual receipt, counted once\)/g) ?? []).length, 1);
  let corrected = correctPayment(withBills, customer.id, '2024-09', 'old-source-receipt', payment({ date:'2024-09-30', amount:'130' }), referenceDate);
  let correctedLedger = calculatePaymentAllocations(corrected);
  assert.equal(correctedLedger.forMonth(customer.id, '2024-09').pendingCreditCents, 3000);
  assert.equal(calculateDashboard(corrected, referenceDate).pendingCredit, 30);
  assert.equal(buildMonthlyReport(corrected, { month:currentMonth }, referenceDate).find(row => row.customerId === customer.id).creditPending, 30);
  corrected = deletePayment(corrected, customer.id, '2024-09', 'old-source-receipt', referenceDate);
  const deletedLedger = calculatePaymentAllocations(corrected);
  assert.equal(deletedLedger.forMonth(customer.id, '2024-09').pendingCreditCents, 0);
  assert.equal(calculateDashboard(corrected, referenceDate).totalCollection, 0);
  assert.equal(calculateDashboard(corrected, referenceDate).pendingCredit, 0);

  let withTargetBill = saveBillMonth(withBills, customer.id, { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  const targetLedger = calculatePaymentAllocations(withTargetBill);
  assert.equal(targetLedger.forMonth(customer.id, currentMonth).creditAppliedCents, 5000);
  assert.equal(targetLedger.forMonth(customer.id, currentMonth).balanceDueCents, 5000);
  const targetDashboard = calculateDashboard(withTargetBill, referenceDate);
  assert.equal(targetDashboard.totalCollection, 0);
  assert.equal(targetDashboard.totalDue, 50);
  assert.equal(targetDashboard.pendingCredit, 0);
  const targetReport = buildMonthlyReport(withTargetBill, { month:currentMonth }, referenceDate).find(row => row.customerId === customer.id);
  assert.equal(targetReport.creditApplied, 50);
  assert.equal(targetReport.amountReceived, 0);
  assert.equal(targetReport.creditSources[0].originMonth, '2024-09');
  assert.match(exportCustomerHistory(withTargetBill, customer.id), /Credit source: original PKR 150 receipt dated 2024-09-30 \(Cash\) from 2024-09; applied here=PKR 50/);
});

test('today and previous-month collections use payment dates even when a saved bill month is older than 24 months', () => {
  const state = createInitialState();
  const customer = state.customers[0];
  const agedBill = { id:'aged-bill', month:'2024-09', dueAmount:100, status:'pending', generated:false, payments:[
    { id:'today-on-aged-bill', date:'2026-09-29', amount:27, method:'Cash' },
    { id:'previous-on-aged-bill', date:'2026-08-31', amount:33, method:'Bank Transfer' }
  ] };
  const withBills = { ...state, customers:state.customers.map(item => item.id === customer.id ? { ...item, bills:[agedBill] } : item) };
  const dashboard = calculateDashboard(withBills, referenceDate);
  assert.equal(dashboard.totalCollection, 0);
  assert.equal(dashboard.todayCollection, 27);
  assert.equal(dashboard.previousMonthCollection, 33);
  const rows = listTransactions(withBills, {}, referenceDate);
  assert.deepEqual(rows.map(row => row.paymentId), ['today-on-aged-bill','previous-on-aged-bill']);
  assert.equal(listTransactions(withBills, { date:'2026-08-31' }, referenceDate).length, 1);
});


test('billing cannot be manually marked Paid; a full actual receipt derives Paid and is counted once', () => {
  let state = createInitialState();
  assert.throws(() => saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'received' }, referenceDate), /Paid status is derived from actual receipts/);
  state = saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', status:'pending' }, referenceDate);
  assert.equal(effectiveBillStatus(state.customers[0], state.customers[0].bills[0], referenceDate), 'pending');
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'100' }), referenceDate);
  const summary = calculatePaymentAllocations(state).forMonth('seed-001', currentMonth);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.sameMonthAppliedCents, 10000);
  assert.equal(summary.excessGeneratedCents, 0);
  assert.equal(summary.pendingCreditCents, 0);
  assert.equal(calculateDashboard(state, referenceDate).totalCollection, 100);
  assert.equal(effectiveBillStatus(state.customers[0], state.customers[0].bills[0], referenceDate), 'received');
  assert.equal(listTransactions(state, {}, referenceDate).length, 1);
});

test('PKR formatter groups thousands, preserves cents, supports negative margin, and marks unset values', () => {
  assert.equal(formatPKR(3000), 'PKR 3,000');
  assert.equal(formatPKR(3000.5), 'PKR 3,000.50');
  assert.equal(formatPKR(-25.25), 'PKR -25.25');
  assert.equal(formatPKR(0), 'PKR 0');
  assert.equal(formatPKR(null), 'Not set');
  assert.equal(formatPKR(''), 'Not set');
});


test('manual Active/Offline/Not set service state persists independently of paid/partial billing status', () => {
  const storage = store(); let state = createInitialState();
  assert.deepEqual([calculateDashboard(state, referenceDate).activeServiceCount, calculateDashboard(state, referenceDate).offlineServiceCount, calculateDashboard(state, referenceDate).unsetServiceCount], [0,0,74]);
  state = profile(state, 'seed-001', { serviceStatus:'active', monthlySellingAmount:'100' });
  state = profile(state, 'seed-002', { serviceStatus:'offline' });
  state = profile(state, 'seed-003', { serviceStatus:'active' });
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  state = addPayment(state, 'seed-001', currentMonth, payment({ amount:'40' }), referenceDate);
  persistState(state, storage); state = readState(storage);
  let dashboard = calculateDashboard(state, referenceDate);
  assert.deepEqual([dashboard.activeServiceCount, dashboard.offlineServiceCount, dashboard.unsetServiceCount], [2,1,71]);
  assert.equal(effectiveBillStatus(state.customers[0], state.customers[0].bills[0], referenceDate), 'pending');
  assert.equal(buildMonthlyReport(state, { month:currentMonth }).find(row => row.customerId === 'seed-001').status, 'partial');
  assert.equal(buildMonthlyReport(state, { month:currentMonth }).find(row => row.customerId === 'seed-001').serviceStatus, 'active');
  assert.equal(listTransactions(state, {}).find(row => row.customerId === 'seed-001').customerServiceStatus, 'active');
  assert.match(exportCustomerHistory(state, 'seed-001'), /Manual service status \(not billing status\): Active/);
  state = profile(state, 'seed-001', { serviceStatus:'offline' });
  assert.equal(buildMonthlyReport(state, { month:currentMonth }).find(row => row.customerId === 'seed-001').status, 'partial');
  assert.equal(buildMonthlyReport(state, { month:currentMonth }).find(row => row.customerId === 'seed-001').serviceStatus, 'offline');
  assert.throws(() => profile(state, 'seed-001', { serviceStatus:'paid' }), /Choose Active, Offline, or Not set/);
  persistState(state, storage); state = readState(storage);
  dashboard = calculateDashboard(state, referenceDate);
  assert.equal(state.customers[0].serviceStatus, 'offline');
  assert.equal(dashboard.offlineServiceCount, 2);
  assert.equal(dashboard.currentMonthDue, 60);
});

test('package suggestions remain blank by default while suggested or custom values persist', () => {
  const storage = store(); let state = createInitialState();
  assert.ok(state.customers.every(customer => customer.packageSpeed === ''));
  state = profile(state, 'seed-001', { packageSpeed:'15 Mbps' });
  state = profile(state, 'seed-002', { packageSpeed:'Custom fiber plan 42 Mbps' });
  persistState(state, storage); state = readState(storage);
  assert.equal(state.customers[0].packageSpeed, '15 Mbps');
  assert.equal(state.customers[1].packageSpeed, 'Custom fiber plan 42 Mbps');
  assert.equal(state.customers[2].packageSpeed, '');
});

test('provider cost dashboard groups Nayatel case-insensitively and excludes missing costs', () => {
  const storage = store(); let state = createInitialState();
  state = profile(state, 'seed-001', { ispProvider:'Nayatel', monthlyPurchaseCost:'1200', monthlySellingAmount:'3000' });
  state = profile(state, 'seed-002', { ispProvider:'NAYATEL', monthlyPurchaseCost:'800', monthlySellingAmount:'2500' });
  state = profile(state, 'seed-003', { ispProvider:'Other ISP', monthlyPurchaseCost:'', monthlySellingAmount:'1000' });
  state = profile(state, 'seed-004', { monthlyPurchaseCost:'0' });
  persistState(state, storage); state = readState(storage);
  let dashboard = calculateDashboard(state, referenceDate);
  assert.equal(dashboard.expectedMonthlyProviderCost, 2000);
  assert.equal(dashboard.customersMissingProviderCost, 71);
  assert.deepEqual(dashboard.providerCostBreakdown.map(item => item.provider), ['Nayatel','Other ISP','Provider name not set']);
  assert.equal(dashboard.providerCostBreakdown.find(item => item.provider === 'Nayatel').expectedMonthlyCost, 2000);
  assert.equal(dashboard.providerCostBreakdown.find(item => item.provider === 'Nayatel').profilesWithCost, 2);
  assert.equal(dashboard.providerCostBreakdown.find(item => item.provider === 'Other ISP').profilesMissingCost, 1);
  state = profile(state, 'seed-002', { monthlyPurchaseCost:'1000', ispProvider:'Nayatel' });
  persistState(state, storage); dashboard = calculateDashboard(readState(storage), referenceDate);
  assert.equal(dashboard.expectedMonthlyProviderCost, 2200);
  assert.equal(dashboard.providerCostBreakdown.find(item => item.provider === 'Nayatel').expectedMonthlyCost, 2200);
});

test('optional due dates are validated, shown in PKT reports/exports and add no automatic penalty', () => {
  assert.equal(PAKISTAN_TIME_ZONE, 'Asia/Karachi');
  let state = saveBillMonth(createInitialState(), 'seed-001', { month:currentMonth, dueAmount:'100', dueDate:'2026-09-30', status:'pending' }, referenceDate);
  const row = buildMonthlyReport(state, { month:currentMonth }).find(item => item.customerId === 'seed-001');
  assert.equal(row.dueDate, '2026-09-30');
  assert.equal(row.balanceDue, 100);
  assert.equal(calculateDashboard(state, referenceDate).currentMonthDue, 100);
  assert.match(exportCustomerHistory(state, 'seed-001'), /Optional due date: 2026-09-30/);
  assert.throws(() => saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', dueDate:'2026-02-30', status:'pending' }, referenceDate), /valid due date/);
  assert.throws(() => saveBillMonth(state, 'seed-001', { month:currentMonth, dueAmount:'100', dueDate:'2026-09-31', status:'pending' }, referenceDate), /valid due date/);
  const nearMidnight = new Date('2026-09-30T18:59:00Z');
  const karachiMidnight = new Date('2026-09-30T19:00:00Z');
  assert.equal(calculateDashboard(createInitialState(), nearMidnight).today, '2026-09-30');
  assert.equal(calculateDashboard(createInitialState(), karachiMidnight).today, '2026-10-01');
  assert.equal(monthsForHistory(nearMidnight)[0], '2026-09');
  assert.equal(monthsForHistory(karachiMidnight)[0], '2026-10');
});

test('next-cycle due date derives from the bill month and rolls across month and year boundaries', () => {
  assert.equal(nextCycleDueDateFromBillMonth('2026-10'), '2026-11-05');
  assert.equal(nextCycleDueDateFromBillMonth('2026-11'), '2026-12-05');
  assert.equal(nextCycleDueDateFromBillMonth('2026-12'), '2027-01-05');
  assert.equal(nextCycleDueDateFromBillMonth('2027-01'), '2027-02-05');
  assert.equal(nextCycleDueDateFromBillMonth('2026-13'), null);
  assert.equal(nextCycleDueDateFromBillMonth('0000-12'), null);
  assert.equal(nextCycleDueDateFromBillMonth('9999-12'), null);
});

test('archiving preserves profile number, bills, receipts and credit; unarchive resumes without duplicate or archived-month bills', () => {
  const beforeArchive = new Date('2026-09-29T12:00:00+05:00');
  const duringArchive = new Date('2026-10-20T12:00:00+05:00');
  const resumeDate = new Date('2026-11-02T12:00:00+05:00');
  let state = profile(createInitialState(), 'seed-001', { monthlySellingAmount:'100' }, beforeArchive);
  state = generateMonthlyBillsThroughCurrentMonth(state, beforeArchive);
  state = addPayment(state, 'seed-001', '2026-09', payment({ date:'2026-09-29', amount:'250' }), beforeArchive);
  const originalId = state.customers[0].id;
  state = archiveCustomer(state, originalId, duringArchive);
  const archived = state.customers[0];
  assert.equal(archived.customerNumber, 1);
  assert.equal(archived.bills.length, 1);
  assert.equal(calculatePaymentAllocations(state).forMonth(originalId, '2026-09').pendingCreditCents, 15000);
  assert.equal(generateMonthlyBillsThroughCurrentMonth(state, duringArchive), state);
  assert.equal(calculateDashboard(state, duringArchive).totalCustomers, 73);
  state = unarchiveCustomer(state, originalId, resumeDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, resumeDate);
  const restored = state.customers[0];
  assert.equal(restored.id, originalId);
  assert.equal(restored.customerNumber, 1);
  assert.deepEqual(restored.bills.map(bill => bill.month).sort(), ['2026-09','2026-11']);
  assert.equal(restored.bills.find(bill => bill.month === '2026-11').dueAmount, 100);
  assert.equal(restored.bills.filter(bill => bill.month === '2026-11').length, 1);
  assert.equal(calculatePaymentAllocations(state).forMonth(originalId, '2026-11').creditAppliedCents, 10000);
  assert.match(exportCustomerHistory(state, originalId), /Amount: PKR 250 \(actual receipt, counted once\)/);
});

test('JSON backup round-trip includes profiles, monthly snapshots, receipts, credit and incidents with preview-before-merge', () => {
  const storage = store(); let source = createInitialState();
  source = profile(source, 'seed-001', { address:'Backup street', phone:'03000000000', ispProvider:'Nayatel', serviceStatus:'active', packageSpeed:'10 Mbps', monthlyPurchaseCost:'1200', monthlySellingAmount:'3000' }, referenceDate);
  source = generateMonthlyBillsThroughCurrentMonth(source, referenceDate);
  source = addPayment(source, 'seed-001', currentMonth, payment({ amount:'3500' }), referenceDate);
  source = addIncident(source, 'seed-001', { reportedAt:'2026-09-28T10:00', offlineAt:'2026-09-28T09:45', restoredAt:null, note:'Backup fixture only' }, referenceDate);
  persistState(source, storage);
  const backupText = createJsonBackup(source, new Date('2026-09-29T12:30:00+05:00'));
  const backup = JSON.parse(backupText);
  assert.equal(backup.format, 'shahdara-isp-billing-backup');
  assert.equal(backup.formatVersion, 1);
  assert.equal(backup.state.customers[0].serviceStatus, 'active');
  assert.equal(backup.state.customers[0].bills[0].payments.length, 1);
  assert.equal(backup.state.customers[0].incidents.length, 1);
  let preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.canApply, true);
  assert.equal(preview.counts.addedPayments, 1);
  assert.equal(preview.counts.addedIncidents, 1);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(preview.state.customers[0].serviceStatus, 'active');
  const creditBefore = calculatePaymentAllocations(preview.state).forMonth('seed-001', currentMonth).pendingCreditCents;
  assert.equal(creditBefore, 50000);
  persistState(preview.state, storage);
  const restored = readState(storage);
  assert.equal(restored.customers[0].phone, '03000000000');
  assert.equal(restored.customers[0].serviceStatus, 'active');
  assert.equal(restored.customers[0].bills[0].priceSnapshot, 3000);
  assert.equal(restored.customers[0].bills[0].payments[0].amount, 3500);
  assert.equal(restored.customers[0].incidents[0].note, 'Backup fixture only');
  assert.equal(calculatePaymentAllocations(restored).byPaymentId.values().next().value.unappliedCreditCents, 50000);
});

test('backup preview merges blank fields only and detects duplicate IDs/numbers and identity collisions without overwriting', () => {
  let local = profile(createInitialState(), 'seed-001', { address:'Local address' });
  let incoming = profile(createInitialState(), 'seed-001', { address:'Backup address', phone:'backup phone', serviceStatus:'offline' });
  const preview = previewJsonBackupMerge(local, createJsonBackup(incoming, referenceDate));
  assert.equal(preview.state.customers[0].address, 'Local address');
  assert.equal(preview.state.customers[0].phone, 'backup phone');
  assert.equal(preview.state.customers[0].serviceStatus, 'offline');
  assert.ok(preview.conflicts.some(conflict => conflict.field === 'address'));
  assert.equal(preview.canApply, true);

  const duplicateId = JSON.parse(createJsonBackup(createInitialState(), referenceDate));
  duplicateId.state.customers[1].id = duplicateId.state.customers[0].id;
  assert.throws(() => previewJsonBackupMerge(local, JSON.stringify(duplicateId)), /duplicate customer ID/);
  const duplicateNumber = JSON.parse(createJsonBackup(createInitialState(), referenceDate));
  duplicateNumber.state.customers[1].customerNumber = duplicateNumber.state.customers[0].customerNumber;
  assert.throws(() => previewJsonBackupMerge(local, JSON.stringify(duplicateNumber)), /duplicate customer number/);
  const collision = createInitialState(['Different person']);
  const collisionPreview = previewJsonBackupMerge(local, createJsonBackup(collision, referenceDate));
  assert.equal(collisionPreview.canApply, false);
  assert.equal(collisionPreview.state.customers[0].name, 'NAZEER');
  assert.ok(collisionPreview.conflicts.length > 0);
  assert.throws(() => previewJsonBackupMerge(local, '{bad json'), /not valid JSON/);
  assert.throws(() => previewJsonBackupMerge(local, 'x'.repeat(25 * 1024 * 1024 + 1)), /too large/);
});

test('malformed or unsupported local updates fail closed without changing the stored bytes', () => {
  for (const raw of ['{not json', JSON.stringify({ version:99, customers:[] })]) {
    const data = new Map([['shahdara-isp-billing-v1', raw]]);
    const storage = { getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value) };
    assert.throws(() => readState(storage), /malformed|unsupported version/);
    assert.equal(storage.getItem('shahdara-isp-billing-v1'), raw);
  }
});
