import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, updateCustomerProfile } from '../core.js';
import { buildAreaIntelligence, buildPackageRevenue } from '../phase3.js';

const referenceDate=new Date('2026-10-07T12:00:00+05:00');
const bill=(id,month,dueAmount,payments=[],packageName='')=>({id,month,dueAmount,status:'pending',generated:true,amountHistory:[],payments,...(packageName?{packageSnapshot:{label:packageName}}:{})});
function fixture() {
  let state=createInitialState(['Ali','Bilal']);
  state=updateCustomerProfile(state,'seed-001',{mohalla:'MOHALLA CHARYAA',zone:'East',serviceStatus:'active',packageSpeed:'5 Mbps',monthlySellingAmount:1000,connectionDate:'2026-08-01'},referenceDate);
  state=updateCustomerProfile(state,'seed-002',{mohalla:'MOHALLA KISHTI',zone:'West',serviceStatus:'offline',packageSpeed:'10 Mbps',monthlySellingAmount:1500,connectionDate:'2026-09-01'},referenceDate);
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[
    bill('aug-a','2026-08',800,[{id:'r-aug',date:'2026-08-20',amount:300,method:'Cash'}],'5 Mbps'),
    bill('sep-a','2026-09',1000,[{id:'r-sep',date:'2026-09-20',amount:600,method:'Cash'}],'5 Mbps'),
    bill('oct-a','2026-10',1000,[{id:'r-oct',date:'2026-10-02',amount:200,method:'Cash'}],'5 Mbps')
  ]}:customer.id==='seed-002'?{...customer,bills:[bill('sep-b','2026-09',1500,[],'10 Mbps')]}:customer)};
  state={...state,expenses:[{id:'area-expense',date:'2026-09-12',amount:100,category:'Cable',notes:'tagged',area:'MOHALLA CHARYAA',zone:'East'}]};
  return state;
}

test('area dashboard groups saved billing and receipt dates by the current mohalla/zone structure without double counting child rows',()=>{
  const state=fixture(),before=JSON.stringify(state);
  const result=buildAreaIntelligence(state,{startDate:'2026-09-01',endDate:'2026-09-30'},referenceDate);
  const charyaa=result.rows.find(row=>row.level==='area'&&row.area==='Area: Mohalla Charyaa');
  const east=result.rows.find(row=>row.level==='zone'&&row.area==='Zone: East');
  const kishti=result.rows.find(row=>row.level==='area'&&row.area==='Area: Mohalla Kishti');
  assert.equal(charyaa.totalCustomers,1);assert.equal(charyaa.billedAmount,1000);assert.equal(charyaa.collectedAmount,600);
  assert.equal(charyaa.outstanding,900,'outstanding includes the older unpaid August balance as well as September');assert.equal(charyaa.collectionRate,60);assert.equal(charyaa.averageCustomerValue,1000);
  assert.equal(charyaa.expenses,100);assert.equal(charyaa.estimatedProfit,500);
  assert.equal(east.billedAmount,1000);assert.equal(east.collectedAmount,600);assert.equal(east.outstanding,900,'the East zone carries the same customer open balance, including August');assert.equal(east.expenses,100);assert.equal(east.estimatedProfit,500);
  assert.equal(kishti.billedAmount,1500);assert.equal(kishti.collectedAmount,0);assert.equal(kishti.outstanding,1500);
  assert.equal(charyaa.activeCustomers,null,'historical area-level active status is not reconstructed from today’s manual status');
  assert.equal(east.activeCustomers,null);assert.match(result.basis.customers,/current saved roster/);assert.match(result.basis.activeCustomers,/unavailable/);
  assert.equal(JSON.stringify(state),before,'analytics never changes saved customer, bill, receipt or expense records');
});

test('custom ranges use actual payment dates and full touched service-month snapshots, while expenses obey the date cutoff',()=>{
  const state=fixture(),result=buildAreaIntelligence(state,{startDate:'2026-09-15',endDate:'2026-10-07'},referenceDate);
  const charyaa=result.rows.find(row=>row.level==='area'&&row.area==='Area: Mohalla Charyaa');
  assert.equal(charyaa.billedAmount,2000,'September and October bill snapshots are both counted in full');
  assert.equal(charyaa.collectedAmount,800,'only September 15–October 7 receipt dates count');
  assert.equal(charyaa.outstanding,1700,'all priced bill balances due through the selected end date are included');
  assert.equal(charyaa.expenses,null,'the explicit expense dated September 12 is outside this selected range');assert.equal(charyaa.estimatedProfit,null);
  assert.match(result.basis.billing,/touching the selected date range/);assert.match(result.basis.expenses,/area\/zone-tagged/);
});

test('an area without explicit expense attribution shows expense and estimated profit as unavailable, never allocates whole-business expenses',()=>{
  const state=fixture();state.expenses=state.expenses.map(({area,zone,...expense})=>expense);
  const result=buildAreaIntelligence(state,{startDate:'2026-09-01',endDate:'2026-09-30'},referenceDate);
  const charyaa=result.rows.find(row=>row.level==='area'&&row.area==='Area: Mohalla Charyaa');
  assert.equal(result.hasAreaExpenseAttribution,false);assert.equal(result.unallocatedExpenseCount,1);assert.equal(charyaa.expenses,null);assert.equal(charyaa.estimatedProfit,null);
  assert.match(charyaa.expensesSource,/not allocated/);assert.match(charyaa.estimatedProfitBasis,/Not estimated/);
});

test('package revenue uses bill snapshots or dated package history and does not backfill a current package into an old bill',()=>{
  const state=fixture();
  state.customers=state.customers.map(customer=>customer.id==='seed-002'?{...customer,bills:[bill('sep-b-no-package','2026-09',1500)]}:customer);
  const result=buildPackageRevenue(state,{startDate:'2026-09-01',endDate:'2026-09-30'},referenceDate);
  assert.deepEqual(result.rows.map(row=>[row.package,row.revenue,row.billCount]).sort(),[['5 Mbps',1000,1],['Package not recorded',1500,1]]);
  assert.equal(result.unrecordedPackageBills,1);assert.match(result.basis,/not backfilled/);
});

test('current manual Active count is labeled as-of today and dated package history can classify historical bills',()=>{
  const state=fixture();
  state.customers=state.customers.map(customer=>customer.id==='seed-001'?{...customer,
    packageHistory:[{date:'2026-08-10',newPackage:'5 Mbps'}],
    bills:customer.bills.map(row=>row.id==='sep-a'?{...row,packageSnapshot:undefined}:row)
  }:customer.id==='seed-002'?{...customer,bills:customer.bills.map(row=>({...row,packageSnapshot:undefined}))}:customer);
  const area=buildAreaIntelligence(state,{startDate:'2026-10-01',endDate:'2026-10-07'},referenceDate).rows.find(row=>row.level==='area'&&row.area==='Area: Mohalla Charyaa');
  assert.equal(area.activeCustomers,1);assert.match(area.activeCustomerSource,/as of 2026-10-07/);
  const packages=buildPackageRevenue(state,{startDate:'2026-09-01',endDate:'2026-09-30'},referenceDate);
  assert.ok(packages.rows.some(row=>row.package==='5 Mbps'&&row.revenue===1000));
  assert.equal(packages.unrecordedPackageBills,1,'the other historical bill has no package snapshot/history and remains unrecorded');
});

test('area and package date ranges reject invalid order, invalid dates and future dates',()=>{
  const state=fixture();
  assert.throws(()=>buildAreaIntelligence(state,{startDate:'2026-09-30',endDate:'2026-09-01'},referenceDate),/on or before/);
  assert.throws(()=>buildPackageRevenue(state,{startDate:'2026-02-30',endDate:'2026-03-01'},referenceDate),/valid Pakistan local date/);
  assert.throws(()=>buildAreaIntelligence(state,{startDate:'2026-10-01',endDate:'2026-10-08'},referenceDate),/later than today/);
});
