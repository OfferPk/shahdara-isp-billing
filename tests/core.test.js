import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_NAMES, PAYMENT_METHODS, createInitialState, readState, persistState, addCustomer, deleteCustomer, updateMohalla, saveBillMonth, addPayment, correctPayment, recordedAmount, monthsForHistory, exportAllPayments, exportCustomerHistory } from '../core.js';

const referenceDate = new Date(2026, 8, 29);
const currentMonth = '2026-09';
const payment = (overrides = {}) => ({ date:'2026-09-15', amount:'100', method:'Cash', ...overrides });
const store = () => { const data = new Map(); return { getItem:key => data.get(key) ?? null, setItem:(key,value) => data.set(key,value) }; };

test('starts with exactly the requested 74 names in the original order and no billing data', () => {
  const expected = ['NAZEER','AWAIS','TEHMENA','SAFEER','KHALEEL','DARBAR','ALI SHAH','ZARSHAD KHAN','AC HOUSE','MNA HOUSE','CH BILAL','MUHAMMAD QASIM','RAJA JUNAID','RAJA USAMA','PATHAN','HASEEB','RAJA BILAL','QARI MUBASIR','FAREED ABBASI','JAWAD RAJA','HAJI ZAFAR','DOCTOR ZAHID','DOCTER EHSAN','AQIB OWNER','SAQIB EJAZ','RAJA RIAZ','RAJA JAHANGEER','RAJA NOMI','RAJA MOHSIN','MUFTI SADAQAT','TOUSEEF RAJA','KIRAN BILAL','SIKANDAR ABBASI','RAJA FAISAL','RAJA ALI','RAJA SHUNAID','BUT HOUSE','AZEEM BAJWA HOUSE','BANGISH HOUSE','RAJA HAFEEZ','RAJA KHAZER','ZUBAIR USTAD','MEHMOOD ABBASI','RAJA ARIF','RAJA SHEHZAD','KASHIF RAJA','KASHIF ABBASI','SAJID','PTA DIRECTOR','RAJA IRFAN','RAJA FAIZAN','BABAR','CH MURTAZA','QARI BAKAR BAKAR','CH MOIZ','CH SAQLAIN','RAJA MUJAHID','RAJA MASROOR','RAJA TAIMOOR MANGRAYAL','RAJA TAIMOOR CHANDALL','MOBEEN SHAH','NADIR SHAH','SHAH NAWAZ','SHADI','RAB NAWAZ','FAISAL GUJJAR','CH HAMZA','CH SHAFEEQ','CH SANWALL','NADIR GUJJAR','RAJA ASAD','DC HOUSE','AKHTAR HOUSE','SSP HOUSE'];
  assert.equal(INITIAL_NAMES.length, 74);
  assert.deepEqual(INITIAL_NAMES, expected);
  const state = createInitialState();
  assert.deepEqual(state.customers.map(c => c.name), expected);
  assert.ok(state.customers.every(c => c.mohalla === '' && c.bills.length === 0));
});

test('add, persist, reload, and delete customers without losing existing names', () => {
  const storage = store(); let state = createInitialState();
  const removedId = state.customers[0].id;
  state = deleteCustomer(state, removedId);
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

test('the fresh ledger contains no billing history or payments', () => {
  const state = createInitialState();
  assert.ok(state.customers.every(c => c.bills.length === 0));
  assert.match(exportAllPayments(state), /No payment entries have been recorded/);
  assert.match(exportCustomerHistory(state, state.customers[0].id), /No billing details have been recorded/);
});

test('history is limited to exactly 24 months and old months are rejected', () => {
  const months = monthsForHistory(referenceDate);
  assert.equal(months.length, 24);
  assert.equal(months[0], '2026-09');
  assert.equal(months.at(-1), '2024-10');
  const state = createInitialState();
  assert.throws(() => saveBillMonth(state, state.customers[0].id, {month:'2024-09',status:'pending'}, referenceDate), /last 24 months/);
});

test('accepts all four requested payment methods', () => {
  const state = createInitialState(); const customerId = state.customers[0].id;
  assert.deepEqual(PAYMENT_METHODS, ['Cash','JazzCash','Easypaisa','Bank Transfer']);
  for (const [index, method] of PAYMENT_METHODS.entries()) {
    const next = addPayment(state, customerId, currentMonth, payment({method, amount:String(index+1)}), referenceDate);
    assert.equal(next.customers[0].bills[0].payments[0].method, method);
  }
});

test('records partial payments and calculates the received total', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  state = saveBillMonth(state, customerId, {month:currentMonth,dueAmount:'250',status:'pending'}, referenceDate);
  state = addPayment(state, customerId, currentMonth, payment({amount:'100',method:'JazzCash'}), referenceDate);
  state = addPayment(state, customerId, currentMonth, payment({date:'2026-09-20',amount:'50',method:'Cash'}), referenceDate);
  const bill = state.customers[0].bills[0];
  assert.equal(bill.dueAmount, 250);
  assert.equal(bill.status, 'pending');
  assert.equal(bill.payments.length, 2);
  assert.equal(recordedAmount(bill), 150);
});

test('corrects an existing payment amount, date, and method', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  state = addPayment(state, customerId, currentMonth, payment(), referenceDate);
  const paymentId = state.customers[0].bills[0].payments[0].id;
  state = correctPayment(state, customerId, currentMonth, paymentId, payment({date:'2026-09-18',amount:'125',method:'Easypaisa'}), referenceDate);
  const corrected = state.customers[0].bills[0].payments[0];
  assert.equal(corrected.id, paymentId);
  assert.equal(corrected.date, '2026-09-18');
  assert.equal(corrected.amount, 125);
  assert.equal(corrected.method, 'Easypaisa');
});

test('combined and individual TXT exports include actual recorded payment details only', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  state = saveBillMonth(state, customerId, {month:currentMonth,dueAmount:'100',status:'received'}, referenceDate);
  state = addPayment(state, customerId, currentMonth, payment({amount:'60',method:'Bank Transfer'}), referenceDate);
  const all = exportAllPayments(state);
  const individual = exportCustomerHistory(state, customerId);
  for (const text of [all, individual]) {
    assert.match(text, /NAZEER/);
    assert.match(text, /2026-09/);
    assert.match(text, /2026-09-15/);
    assert.match(text, /60/);
    assert.match(text, /Bank Transfer/);
  }
  assert.doesNotMatch(all, /AWAIS/);
  assert.match(individual, /Status: Received/);
});

test('rejects invalid amounts, methods, and dates', () => {
  let state = createInitialState(); const customerId = state.customers[0].id;
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({amount:'0'}), referenceDate), /greater than zero/);
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({method:'Cheque'}), referenceDate), /valid payment method/);
  assert.throws(() => addPayment(state, customerId, currentMonth, payment({date:'not-a-date'}), referenceDate), /valid payment date/);
});
