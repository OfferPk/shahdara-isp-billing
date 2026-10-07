import test from 'node:test';
import assert from 'node:assert/strict';
import { addPayment, createInitialState, saveBillMonth } from '../core.js';
import { addExpense } from '../phase3.js';
import { answerOwnerCommand, buildCustomerPaymentBehavior, buildCustomerRankings, buildCustomerHealthScore, buildCustomerLifetimeValue, buildSmartDuesRecovery } from '../owner-insights.js';

const today = new Date('2026-10-07T12:00:00+05:00');
const customerId = 'seed-001';
const makeState = () => createInitialState(['Ali']);
function bill(state, month, amount = 1000) { return saveBillMonth(state, customerId, { month, dueAmount:String(amount), status:'pending' }, today); }
function payment(state, month, date, amount) { return addPayment(state, customerId, month, { date, amount:String(amount), method:'Cash' }, today); }
function historyState() {
  let state = makeState();
  state = bill(state,'2026-06'); state = payment(state,'2026-06','2026-06-08',1000);
  state = bill(state,'2026-07'); state = payment(state,'2026-07','2026-07-05',1000);
  state = bill(state,'2026-08'); state = payment(state,'2026-08','2026-08-06',200);
  state = bill(state,'2026-09'); state = payment(state,'2026-09','2026-09-10',1000);
  state = bill(state,'2026-10'); state = payment(state,'2026-10','2026-10-06',250);
  state = addExpense(state,{ date:'2026-10-07', amount:'100', category:'Cable', notes:'' },today);
  return state;
}

test('payment behavior uses actual receipts, recorded due dates, and priced-bill consistency only', () => {
  const state=historyState(),behavior=buildCustomerPaymentBehavior(state,customerId,today);
  assert.equal(behavior.totalPayments,5);
  assert.equal(behavior.totalPaymentAmount,3450);
  assert.equal(behavior.averageMonthlyPayment,690);
  assert.equal(behavior.highestPayment,1000);
  assert.equal(behavior.lowestPayment,200);
  assert.equal(behavior.latePaymentCount,4);
  assert.equal(behavior.partialPaymentCount,2);
  assert.equal(behavior.averagePaymentDelayDays,2.7);
  assert.equal(behavior.paymentConsistency,75);
  assert.equal(behavior.currentBill.balanceDue,750);
  assert.equal(behavior.health.score >= 0 && behavior.health.score <= 100,true);
  assert.ok(behavior.health.reasons.length>=4);
});

test('CLV derives actual receipts, explicit-date tenure and delay locally; future value is a qualified estimate', () => {
  const state=historyState();state.customers[0].connectionDate='2020-01-01';
  const first=state.customers[0].bills.find(row=>row.month==='2026-06').payments[0];
  state.customers[0].bills.find(row=>row.month==='2026-07').payments.push({...first});
  state.customers[0].bills.find(row=>row.month==='2026-10').payments.push({id:'future-receipt',date:'2026-10-08',amount:9999,method:'Cash'});
  const before=JSON.stringify(state),value=buildCustomerLifetimeValue(state,customerId,today);
  assert.equal(value.totalHistoricalRevenue,3450,'a repeated receipt ID and future-dated receipt are excluded');
  assert.equal(value.receiptCount,5);
  assert.equal(value.receiptMonths,5);
  assert.equal(value.observationMonths,5,'calendar months without receipts remain in the average denominator');
  assert.equal(value.averageMonthlyRevenue,690);
  assert.equal(value.averagePaymentDelayDays,2.7);
  assert.equal(value.paymentDelaySampleCount,3);
  assert.equal(value.tenure.serviceMonths,82);
  assert.equal(value.estimatedFutureValue,8280);
  assert.match(value.estimatedFutureValueBasis,/Estimate only:.*× 12 months/);
  assert.match(value.estimatedFutureValueBasis,/does not model attrition/);
  assert.equal(JSON.stringify(state),before,'calculations never modify saved customer or payment records');
});

test('CLV distinguishes no receipts and one receipt month from enough projection history', () => {
  const empty=buildCustomerLifetimeValue(makeState(),customerId,today);
  assert.equal(empty.totalHistoricalRevenue,0);
  assert.equal(empty.averageMonthlyRevenue,null);
  assert.equal(empty.averagePaymentDelayDays,null);
  assert.equal(empty.tenure.status,'not-recorded');
  assert.equal(empty.estimatedFutureValue,null);
  assert.match(empty.estimatedFutureValueBasis,/no historical receipts/);
  let single=makeState();single=bill(single,'2026-09');single=payment(single,'2026-09','2026-09-05',1000);
  const singleMonth=buildCustomerLifetimeValue(single,customerId,today);
  assert.equal(singleMonth.totalHistoricalRevenue,1000);
  assert.equal(singleMonth.estimatedFutureValue,null);
  assert.match(singleMonth.estimatedFutureValueBasis,/at least 2 receipt-bearing/);
});

test('lifetime-value ranking sorts by actual historical receipts and keeps estimates separate', () => {
  const state=historyState();
  state.customers.push({...state.customers[0],id:'zero-receipts',customerNumber:2,name:'No receipts',bills:[]});
  const result=buildCustomerRankings(state,{type:'lifetime-value',month:'2026-10'},today);
  assert.deepEqual(result.rows.map(row=>[row.name,row.value,row.displayValue]),[['Ali',345000,'PKR 3,450'],['No receipts',0,'PKR 0']]);
  assert.equal(result.rows[0].estimatedFutureValue,8280);
  assert.equal(result.rows[1].estimatedFutureValue,null);
});

test('health score is withheld until at least two completed priced months and reports the reason', () => {
  let state=makeState(); state=bill(state,'2026-09'); state=payment(state,'2026-09','2026-09-05',1000);
  const result=buildCustomerHealthScore(state,customerId,today);
  assert.equal(result.score,null);
  assert.equal(result.category,'Insufficient history');
  assert.match(result.reasons[0],/at least 2/);
});

test('health score categories stay within documented Good/Risk/Critical thresholds', () => {
  let state=makeState();
  for(const month of ['2026-06','2026-07','2026-08','2026-09']) { state=bill(state,month); state=payment(state,month,`${month}-05`,1000); }
  const good=buildCustomerHealthScore(state,customerId,today);
  assert.equal(good.category,'Good');
  assert.ok(good.score>=80);
  const customer=state.customers[0];
  for(const row of customer.bills.filter(item=>item.month!=='2026-06')) row.payments=[];
  const critical=buildCustomerHealthScore(state,customerId,today);
  assert.ok(critical.score<80);
  assert.ok(['Risk','Critical'].includes(critical.category));
  assert.match(critical.reasons.join(' '),/regularity|Outstanding|Partial installments/i);
});

test('rankings respect month, area, package and manual service-status filters', () => {
  let state=historyState();
  state={...state,customers:state.customers.map(customer=>({...customer,mohalla:'MOHALLA CHARYAA',packageSpeed:'5 Mbps',serviceStatus:'active',connectionDate:'2020-01-01',monthlySellingAmount:1500}))};
  const result=buildCustomerRankings(state,{type:'highest-paying',month:'2026-10',area:'MOHALLA CHARYAA',packageName:'5 Mbps',status:'active'},today);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].displayValue,'PKR 250');
  const noMatch=buildCustomerRankings(state,{type:'highest-paying',month:'2026-10',area:'MOHALLA KISHTI',packageName:'all',status:'all'},today);
  assert.equal(noMatch.rows.length,0);
});

test('longest overdue and repeat late payer rankings use saved bill due dates and actual receipt dates', () => {
  const state=historyState();
  const overdue=buildCustomerRankings(state,{type:'longest-overdue',month:'2026-10'},today);
  assert.equal(overdue.rows.length,1);
  assert.equal(overdue.rows[0].displayValue,'2 days');
  const late=buildCustomerRankings(state,{type:'repeat-late',month:'2026-10'},today);
  assert.equal(late.rows[0].displayValue,'1 late receipt');
});

test('owner commands return read-only answers for English, Roman Urdu and Urdu query examples', () => {
  const state=historyState();
  const collection=answerOwnerCommand(state,'October mein kitna paisa aya?',today);
  assert.equal(collection.intent,'monthly-collection'); assert.equal(collection.collection,250);
  const balance=answerOwnerCommand(state,'Ali ka bill check karo',today);
  assert.equal(balance.intent,'customer-balance'); assert.equal(balance.rows[0].name,'Ali');
  const pending=answerOwnerCommand(state,'Aaj kis kis ne payment nahi di?',today);
  assert.equal(pending.intent,'pending-list'); assert.ok(pending.rows.some(row=>row.remaining>0));
  const daily=answerOwnerCommand(state,'Aaj ki collection aur expense batao',today);
  assert.equal(daily.intent,'daily-summary'); assert.equal(daily.collection,0); assert.equal(daily.expenses,100);
  const profit=answerOwnerCommand(state,'اس مہینے profit کتنا ہے؟',today);
  assert.equal(profit.intent,'monthly-profit'); assert.equal(profit.profit,150);
  const high=answerOwnerCommand(state,'customers with more than 5000 outstanding',today);
  assert.equal(high.intent,'threshold-outstanding'); assert.equal(high.rows.length,0);
});

test('owner assistant answers never mutate state', () => {
  const state=historyState(),before=JSON.stringify(state);
  for(const query of ['October collection','Ali balance','today expense','delete Ali']) answerOwnerCommand(state,query,today);
  assert.equal(JSON.stringify(state),before);
});

test('dues recovery groups only recorded positive balances, explains its score, and totals each group', () => {
  const state=historyState(),result=buildSmartDuesRecovery(state,today);
  assert.equal(result.totalCustomers,1);
  assert.ok(result.totalRecoverable>0);
  assert.equal(result.groups.reduce((sum,group)=>sum+group.recoverableAmount,0),result.totalRecoverable);
  assert.equal(result.groups.reduce((sum,group)=>sum+group.count,0),1);
  assert.match(result.formula,/High ≥65; Medium 35–64; Low <35/);
  assert.ok(result.groups.find(group=>group.count)?.customers[0].reasons.length>=4);
});
