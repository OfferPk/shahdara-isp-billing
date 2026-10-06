import test from 'node:test';
import assert from 'node:assert/strict';
import { addPayment, createInitialState, autoClosePreviousMonth, createJsonBackup, previewJsonBackupMerge, saveBillMonth, updateCustomerProfile } from '../core.js';
import { addExpense } from '../phase3.js';
import { buildMonthToMonthComparison, explainBusinessPerformance } from '../owner-insights.js';

const oct = new Date('2026-10-07T12:00:00+05:00');
function closingFixture() {
  let state=createInitialState(['Ali','Bilal']);
  state=updateCustomerProfile(state,'seed-001',{serviceStatus:'active',connectionDate:'2026-09-02',packageSpeed:'5 Mbps'},oct);
  state=updateCustomerProfile(state,'seed-002',{serviceStatus:'not-set'},oct);
  state=saveBillMonth(state,'seed-001',{month:'2026-08',dueAmount:'100',status:'pending'},oct);
  state=addPayment(state,'seed-001','2026-08',{date:'2026-08-10',amount:'50',method:'Cash'},oct);
  state=saveBillMonth(state,'seed-001',{month:'2026-09',dueAmount:'1000',status:'pending'},oct);
  state=addPayment(state,'seed-001','2026-09',{date:'2026-09-20',amount:'500',method:'Cash'},oct);
  state=saveBillMonth(state,'seed-002',{month:'2026-09',dueAmount:'100',status:'pending'},oct);
  state={...state,customers:state.customers.map(customer=>customer.id!=='seed-002'?customer:{...customer,bills:customer.bills.map(bill=>bill.month!=='2026-09'?bill:{...bill,dueAmount:null})})};
  state=addExpense(state,{date:'2026-08-10',amount:'10',category:'Cable',notes:''},oct);
  state=addExpense(state,{date:'2026-09-30',amount:'200',category:'Cable',notes:''},oct);
  return state;
}

test('automatic local month close snapshots all bills, priced amounts, cash, outstanding, expenses and dated manual statuses',()=>{
  const state=closingFixture(),closed=autoClosePreviousMonth(state,oct),snapshot=closed.monthlyClosings.find(row=>row.month==='2026-09');
  assert.equal(snapshot.totalCustomers,2);
  assert.equal(snapshot.activeCustomerCount,1);
  assert.equal(snapshot.offlineCustomerCount,0);
  assert.equal(snapshot.notSetCustomerCount,1);
  assert.equal(snapshot.archivedCustomerCount,0);
  assert.equal(snapshot.billCount,2);
  assert.equal(snapshot.pricedBillCount,1);
  assert.equal(snapshot.unpricedBillCount,1);
  assert.equal(snapshot.billedAmount,1000);
  assert.equal(snapshot.collection,500);
  assert.equal(snapshot.pending,500);
  assert.equal(snapshot.expenses,200);
  assert.equal(snapshot.profit,300);
  assert.equal(snapshot.previousMonthComparison.month,'2026-08');
  assert.equal(snapshot.previousMonthComparison.source,'local-ledger');
  assert.equal(snapshot.previousMonthComparison.collection,50);
  assert.equal(snapshot.previousMonthComparison.expenses,10);
  assert.equal(snapshot.previousMonthComparison.profit,40);
  assert.match(snapshot.savedAt,/2026-10-07/);
});

test('automatic monthly close is repeat-safe and does not recalculate a saved historical close',()=>{
  let state=autoClosePreviousMonth(closingFixture(),oct);
  const before=state.monthlyClosings.find(row=>row.month==='2026-09');
  state=addPayment(state,'seed-001','2026-09',{date:'2026-10-01',amount:'500',method:'Cash'},oct);
  const repeated=autoClosePreviousMonth(state,oct);
  assert.deepEqual(repeated.monthlyClosings.find(row=>row.month==='2026-09'),before);
  assert.equal(repeated.monthlyClosings.length,1);
});

test('monthly-close snapshot survives validated backup restore and duplicate close conflicts preserve local data',()=>{
  const state=autoClosePreviousMonth(closingFixture(),oct),backup=createJsonBackup(state,oct);
  const restored=previewJsonBackupMerge(createInitialState(['Ali','Bilal']),backup);
  assert.deepEqual(restored.state.monthlyClosings,state.monthlyClosings);
  assert.equal(restored.counts.addedMonthlyClosings,1);
  const changed=JSON.parse(backup);
  changed.state.monthlyClosings[0].collection=999;
  const conflict=previewJsonBackupMerge(state,JSON.stringify(changed));
  assert.ok(conflict.conflicts.some(row=>row.field==='monthly closing 2026-09'));
  assert.equal(conflict.state.monthlyClosings[0].collection,500);
});

test('month comparisons use receipt-date cash, service-month billing and disclose untracked history',()=>{
  const state=closingFixture(),comparison=buildMonthToMonthComparison(state,'2026-08','2026-09',oct);
  assert.equal(comparison.monthA.billedAmount,100);
  assert.equal(comparison.monthA.collection,50);
  assert.equal(comparison.monthA.collectionRate,50);
  assert.equal(comparison.monthB.billedAmount,1000);
  assert.equal(comparison.monthB.collection,500);
  assert.equal(comparison.monthB.collectionRate,50);
  assert.equal(comparison.monthB.outstanding,500);
  assert.equal(comparison.monthB.activeCustomers,null,'historic service status is not backfilled from current manual status');
  assert.match(comparison.monthB.outstandingSource,/current ledger balance as of/);
  assert.equal(comparison.monthB.newConnections,1);
  assert.equal(comparison.monthB.newCustomers,null,'profile-added dates are not invented for imported/seeded customers');
  assert.throws(()=>buildMonthToMonthComparison(state,'2026-08','2026-08',oct),/two different months/);
});

test('business-performance explanations show recorded customer and category contribution with zero-baseline disclosure',()=>{
  const state=closingFixture();
  const collection=explainBusinessPerformance(state,'collection','2026-08','2026-09',oct);
  assert.equal(collection.change,450);
  assert.equal(collection.drivers[0].name,'Ali');
  assert.equal(collection.drivers[0].change,450);
  assert.equal(collection.drivers[0].percentImpact,100);
  const expense=explainBusinessPerformance(state,'expenses','2026-08','2026-09',oct);
  assert.equal(expense.drivers[0].name,'Cable');
  assert.equal(expense.drivers[0].change,190);
  assert.equal(expense.drivers[0].percentImpact,100);
  const profit=explainBusinessPerformance(state,'profit','2026-08','2026-09',oct);
  assert.equal(profit.change,260);
  assert.equal(profit.drivers.reduce((sum,row)=>sum+row.change,0),260);
  const revenue=explainBusinessPerformance(state,'revenue','2026-08','2026-09',oct);
  assert.equal(revenue.percentChange,900);
  assert.match(revenue.basis,/service-month bill snapshots/);
});
