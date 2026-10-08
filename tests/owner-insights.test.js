import test from 'node:test';
import assert from 'node:assert/strict';
import { addPayment, createInitialState, saveBillMonth } from '../core.js';
import { addExpense } from '../phase3.js';
import { answerOwnerCommand, buildBusinessHealthScore, buildCustomerPaymentBehavior, buildCustomerRankings, buildCustomerHealthScore, buildCustomerLifetimeValue, buildNextServiceAnniversary, buildUpcomingServiceAnniversaries, buildSmartDuesRecovery } from '../owner-insights.js';

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
  assert.deepEqual([value.nextServiceAnniversary.status,value.nextServiceAnniversary.date,value.nextServiceAnniversary.years],['upcoming','2027-01-01',7]);
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

test('next service anniversaries use saved connection dates, handle leap/year boundaries, and withhold unsafe milestones',()=>{
  const customer={connectionDate:'2020-10-07',addedOn:'1999-01-01'},before=JSON.stringify(customer);
  const todayMilestone=buildNextServiceAnniversary(customer,today);
  assert.deepEqual([todayMilestone.status,todayMilestone.date,todayMilestone.years,todayMilestone.daysUntil],['today','2026-10-07',6,0]);
  const afterMilestone=buildNextServiceAnniversary(customer,new Date('2026-10-08T12:00:00+05:00'));
  assert.deepEqual([afterMilestone.status,afterMilestone.date,afterMilestone.years],['upcoming','2027-10-07',7]);
  assert.equal(buildNextServiceAnniversary({addedOn:'2020-10-07'},today).status,'not-recorded','profile creation is not an anniversary anchor');
  assert.equal(buildNextServiceAnniversary({connectionDate:'2027-01-01'},today).status,'future');
  assert.equal(buildNextServiceAnniversary({connectionDate:'2020-01-01',cancellationDate:'2026-10-06'},today).status,'ended');
  const endBefore=buildNextServiceAnniversary({connectionDate:'2025-10-08',expiryDate:'2026-10-07'},today);
  assert.deepEqual([endBefore.status,endBefore.date,endBefore.endDate],['ends-before-anniversary','2026-10-08','2026-10-07']);
  const leap=buildNextServiceAnniversary({connectionDate:'2020-02-29'},new Date('2026-02-28T12:00:00+05:00'));
  assert.deepEqual([leap.status,leap.date,leap.years],['today','2026-02-28',6]);
  const yearBoundary=buildNextServiceAnniversary({connectionDate:'2023-01-01'},new Date('2026-12-31T12:00:00+05:00'));
  assert.deepEqual([yearBoundary.date,yearBoundary.years,yearBoundary.daysUntil],['2027-01-01',4,1]);
  assert.equal(JSON.stringify(customer),before,'the calculation never changes saved profile data');
});

test('upcoming service anniversary list sorts nearest first and excludes archived or unsupported dates without mutation',()=>{
  const state={customers:[
    {id:'later',customerNumber:4,name:'Later',connectionDate:'2020-10-10',serviceStatus:'offline'},
    {id:'today',customerNumber:2,name:'Today',connectionDate:'2020-10-07'},
    {id:'soon',customerNumber:3,name:'Soon',connectionDate:'2020-10-09'},
    {id:'archived',customerNumber:5,name:'Archived',connectionDate:'2020-10-07',archived:true},
    {id:'missing',customerNumber:6,name:'Missing',addedOn:'2020-10-07'},
    {id:'future',customerNumber:7,name:'Future',connectionDate:'2027-01-01'},
    {id:'ending',customerNumber:8,name:'Ending',connectionDate:'2025-10-08',expiryDate:'2026-10-07'}
  ]};
  const before=JSON.stringify(state),result=buildUpcomingServiceAnniversaries(state,today,2);
  assert.equal(result.asOf,'2026-10-07');
  assert.equal(result.totalCount,3,'manual Offline is not treated as a dated service end');
  assert.deepEqual(result.rows.map(row=>[row.customerId,row.date,row.daysUntil]),[['today','2026-10-07',0],['soon','2026-10-09',2]]);
  assert.equal(JSON.stringify(state),before,'dashboard data is derived without editing profiles');
  assert.equal(buildUpcomingServiceAnniversaries({customers:[]},today).totalCount,0);
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

function businessHealthFixture() {
  let state=makeState();
  state={...state,customers:state.customers.map(customer=>({...customer,addedOn:'2026-01-01'}))};
  for(const month of ['2026-07','2026-08','2026-09']) {
    state=bill(state,month,1000);state=payment(state,month,`${month}-08`,900);
    state=addExpense(state,{date:`${month}-10`,amount:'100',category:'Cable',notes:''},today);
  }
  return state;
}

test('business health uses three completed PKT months, saved report metrics, weighted contributions, and is read-only',()=>{
  let state=businessHealthFixture();
  state=bill(state,'2026-10',1000);state=payment(state,'2026-10','2026-10-06',1000);
  const before=JSON.stringify(state),result=buildBusinessHealthScore(state,today);
  assert.deepEqual(result.window.months,['2026-07','2026-08','2026-09']);
  assert.equal(result.window.startDate,'2026-07-01');
  assert.equal(result.window.endDate,'2026-09-30');
  assert.equal(result.availableFactorCount,5);
  assert.equal(result.renormalized,true);
  assert.equal(result.factors.find(row=>row.id==='collectionRate').value,90);
  assert.equal(result.factors.find(row=>row.id==='outstandingRatio').value,10);
  assert.ok(Math.abs(result.factors.find(row=>row.id==='cashProfitMargin').value-(2400/2700*100))<0.01);
  assert.ok(Math.abs(result.factors.find(row=>row.id==='expenseRatio').value-(300/2700*100))<0.01);
  assert.equal(result.factors.find(row=>row.id==='customerGrowth').value,0);
  assert.ok(Math.abs(result.factors.reduce((sum,row)=>sum+row.contribution,0)-result.score)<=0.1);
  assert.equal(JSON.stringify(state),before,'the score must not mutate any saved business record');
  assert.match(result.factors.find(row=>row.id==='collectionRate').basis,/actual positive receipt rows by payment date/);
  assert.match(result.factors.find(row=>row.id==='cashProfitMargin').basis,/actual receipts/);
  assert.match(result.factors.find(row=>row.id==='cashProfitMargin').basis,/dated expenses/);
  assert.match(result.factors.find(row=>row.id==='cashProfitMargin').basis,/not accrual/i);
});

test('business health excludes malformed and future receipt dates from cash-rate totals',()=>{
  let state=businessHealthFixture();
  state.customers[0].bills.find(row=>row.month==='2026-09').payments.push({id:'bad-date',date:'2026-09-99',amount:99999,method:'Cash'},{id:'future',date:'2026-10-08',amount:99999,method:'Cash'});
  const result=buildBusinessHealthScore(state,today);
  assert.equal(result.factors.find(row=>row.id==='collectionRate').value,90);
  assert.match(result.factors.find(row=>row.id==='cashProfitMargin').basis,/3 receipt\(s\)/);
});

test('business health withholds undefined financial ratios and all-score result when denominators are zero',()=>{
  let state=makeState();
  state={...state,customers:state.customers.map(customer=>({...customer,addedOn:'2026-10-01'}))};
  state=addExpense(state,{date:'2026-09-10',amount:'500',category:'Cable',notes:''},today);
  const result=buildBusinessHealthScore(state,today);
  assert.equal(result.score,null);
  assert.equal(result.availableFactorCount,0);
  for(const id of ['collectionRate','outstandingRatio','cashProfitMargin','expenseRatio','customerGrowth','documentedChurn']) {
    assert.equal(result.unavailableFactors.find(row=>row.id===id).available,false);
  }
  assert.match(result.unavailableFactors.find(row=>row.id==='cashProfitMargin').unavailableReason,/denominator is zero/);
});

test('recorded-expense quality reaches 100 at 20% and zero at 70%',()=>{
  let efficient=businessHealthFixture();
  efficient={...efficient,expenses:efficient.expenses.map(row=>({...row,amount:'180'}))};
  const atTwenty=buildBusinessHealthScore(efficient,today).factors.find(row=>row.id==='expenseRatio');
  assert.ok(Math.abs(atTwenty.value-20)<0.01);
  assert.equal(atTwenty.quality,100);
  let high=businessHealthFixture();
  high={...high,expenses:high.expenses.map(row=>({...row,amount:'630'}))};
  const atSeventy=buildBusinessHealthScore(high,today).factors.find(row=>row.id==='expenseRatio');
  assert.ok(Math.abs(atSeventy.value-70)<0.01);
  assert.equal(atSeventy.quality,0);
});

test('cash losses and excessive recorded expenses are clearly classified as negative factors',()=>{
  let state=businessHealthFixture();
  state={...state,expenses:state.expenses.map(row=>({...row,amount:'1200'}))};
  const result=buildBusinessHealthScore(state,today),margin=result.factors.find(row=>row.id==='cashProfitMargin'),expense=result.factors.find(row=>row.id==='expenseRatio');
  assert.ok(margin.value<0);
  assert.equal(margin.quality,0);
  assert.equal(margin.polarity,'negative');
  assert.ok(expense.value>70);
  assert.equal(expense.quality,0);
  assert.equal(expense.polarity,'negative');
});

test('dated profile growth and documented churn use explicit events, deduplicate event types, and ignore current manual status',()=>{
  let state=makeState();
  state={...state,customers:[
    {...state.customers[0],addedOn:'2025-01-01',cancellationDate:'2026-08-10',archived:true,archivedAt:'2026-08-11T09:00',serviceStatus:'offline'},
    {...state.customers[0],id:'older-profile',customerNumber:2,addedOn:'2025-06-01',cancellationDate:null,archived:false,archivedAt:null,serviceStatus:'active'},
    {...state.customers[0],id:'new-profile',customerNumber:3,addedOn:'2026-08-01',cancellationDate:null,archived:false,archivedAt:null,serviceStatus:'not-set'}
  ]};
  const result=buildBusinessHealthScore(state,today),growth=result.factors.find(row=>row.id==='customerGrowth'),churn=result.factors.find(row=>row.id==='documentedChurn');
  assert.equal(result.openingCustomerBase,2);
  assert.equal(growth.value,50);
  assert.equal(growth.quality,100);
  assert.ok(Math.abs(churn.value-100/3)<0.01,'cancellation and archive dates on one profile count once');
  assert.equal(churn.quality,0);
  state={...state,customers:state.customers.map(customer=>({...customer,serviceStatus:customer.serviceStatus==='offline'?'active':'offline'}))};
  const statusChanged=buildBusinessHealthScore(state,today);
  assert.ok(Math.abs(statusChanged.factors.find(row=>row.id==='documentedChurn').value-100/3)<0.01,'manual Active/Offline labels do not affect churn');
  assert.equal(statusChanged.score,result.score);
});

test('business health uses a saved close for the opening base and does not call missing event history zero churn',()=>{
  let state=makeState();
  state={...state,customers:state.customers.map(customer=>({...customer,addedOn:'2025-01-01'})),monthlyClosings:[{month:'2026-06',totalCustomers:5,archivedCustomerCount:1}]};
  const result=buildBusinessHealthScore(state,today);
  assert.equal(result.openingCustomerBase,6);
  assert.match(result.openingBasis,/Saved 2026-06 close/);
  assert.equal(result.unavailableFactors.find(row=>row.id==='documentedChurn').value,null);
  assert.match(result.unavailableFactors.find(row=>row.id==='documentedChurn').unavailableReason,/absence is not assumed to mean zero churn/);
});

test('incomplete profile dates make growth and churn unavailable and available weights renormalize transparently',()=>{
  let state=businessHealthFixture();
  state={...state,customers:state.customers.map((customer,index)=>index===0?{...customer,addedOn:null}:customer)};
  const result=buildBusinessHealthScore(state,today);
  assert.equal(result.factors.some(row=>row.id==='customerGrowth'),false);
  assert.equal(result.factors.some(row=>row.id==='documentedChurn'),false);
  assert.ok(result.renormalized);
  assert.equal(result.availableWeight,80);
  assert.equal(result.availableFactorCount,4);
  assert.match(result.unavailableFactors.find(row=>row.id==='customerGrowth').unavailableReason,/added-on date/);
});
