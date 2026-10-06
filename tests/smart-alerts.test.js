import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSmartAlerts } from '../owner-insights.js';

const referenceDate=new Date('2026-10-07T12:00:00+05:00');
const bill=(month,{amount=1000,dueDate=null,packageName=null,payments=[]}={})=>({id:`${month}-${dueDate??'none'}-${packageName??'none'}`,month,dueAmount:amount,dueDate,payments,...(packageName?{packageSnapshot:{label:packageName}}:{})});
const payment=(date,amount)=>({id:`payment-${date}-${amount}`,date,amount,method:'Cash'});
const customer=(id,name,bills=[],extra={})=>({id,customerNumber:Number(id.replace(/\D/g,''))||1,name,serviceStatus:'not-set',packageSpeed:'Current manual package',packageHistory:[],bills,...extra});
const stateOf=(customers=[],expenses=[])=>({version:1,customers,expenses,inventoryItems:[],inventoryMovements:[],monthlyClosings:[]});
const alert=(result,id)=>result.alerts.find(row=>row.id===id);

test('two positive balances in distinct bill months link the named customer and use due today PKT date',()=>{
  const state=stateOf([customer('c1','Ali',[bill('2026-08',{amount:1000}),bill('2026-09',{amount:1200}),bill('2026-10',{amount:500,dueDate:'2026-10-07'})])]);
  const result=buildSmartAlerts(state,referenceDate);
  assert.equal(result.asOf,'2026-10-07');
  const overdue=alert(result,'unpaid-months-c1');
  assert.ok(overdue);
  assert.match(overdue.detail,/2026-08, 2026-09, 2026-10/);
  assert.equal(overdue.customerId,'c1');
  assert.equal(alert(result,'due-today'),undefined);
});

test('due-today alert uses a transparent distinct-customer threshold of five',()=>{
  const state=stateOf(Array.from({length:5},(_,index)=>customer(`c${index+1}`,`Customer ${index+1}`,[bill('2026-10',{amount:1500,dueDate:'2026-10-07'})])));
  const result=buildSmartAlerts(state,referenceDate);
  assert.match(alert(result,'due-today').detail,/5 saved bill\(s\).*PKR 7,500.*threshold—not a historical anomaly/);
  const belowThreshold=buildSmartAlerts(stateOf(state.customers.slice(0,4)),referenceDate);
  assert.equal(belowThreshold.alerts.some(row=>row.id==='due-today'),false);
  assert.match(belowThreshold.checks.find(row=>row.id==='due-today').note,/4 customer\(s\).*threshold is 5/);
});

test('expense alert compares month-to-date category spend to two or more recorded same-cutoff months',()=>{
  const state=stateOf([], [
    {date:'2026-07-07',amount:1000,category:'Cable'},
    {date:'2026-08-07',amount:1000,category:'Cable'},
    {date:'2026-09-07',amount:1000,category:'Cable'},
    {date:'2026-09-08',amount:50000,category:'Cable'},
    {date:'2026-10-07',amount:2200,category:'Cable'}
  ]);
  const result=buildSmartAlerts(state,referenceDate);
  assert.match(alert(result,'expense-Cable').detail,/PKR 2,200 vs PKR 1,000 average over 2026-07, 2026-08, 2026-09/);
  assert.match(alert(result,'expense-Cable').detail,/at least 50% and PKR 500/);
});

test('expense and receipt comparisons are withheld when their recorded history is insufficient',()=>{
  const state=stateOf([], [{date:'2026-09-07',amount:1000,category:'Repair'},{date:'2026-10-07',amount:5000,category:'Repair'}]);
  const result=buildSmartAlerts(state,referenceDate);
  assert.equal(alert(result,'expense-Repair'),undefined);
  assert.ok(result.insufficient.some(row=>row.id==='expense-baseline-Repair'));
  assert.ok(result.insufficient.some(row=>row.id==='collection-baseline'));
});

test('package decline uses complete saved service-month labels, not the current manual profile value',()=>{
  const state=stateOf([
    customer('c1','Ali',[bill('2026-08',{packageName:'5 Mbps'}),bill('2026-09',{packageName:'5 Mbps'})]),
    customer('c2','Bilal',[bill('2026-08',{packageName:'5 Mbps'})])
  ]);
  const result=buildSmartAlerts(state,referenceDate);
  assert.match(alert(result,'package-decline-5 Mbps').detail,/2 customer\(s\) in 2026-08 → 1 in 2026-09/);
  const incomplete=stateOf([customer('c1','Ali',[bill('2026-08'),bill('2026-09',{packageName:'5 Mbps'})])]);
  const withheld=buildSmartAlerts(incomplete,referenceDate);
  assert.equal(withheld.alerts.some(row=>row.id.startsWith('package-decline-')),false);
  assert.ok(withheld.insufficient.some(row=>row.id==='package-counts'));
});

test('collection comparison uses saved same-weekday receipt days and the documented 80% threshold',()=>{
  const collectionBill=bill('2026-10',{amount:100000,payments:[payment('2026-09-30',10000),payment('2026-09-23',12000),payment('2026-09-16',9000),payment('2026-10-07',1000)]});
  const result=buildSmartAlerts(stateOf([customer('c1','Ali',[collectionBill])]),referenceDate);
  assert.match(alert(result,'collection-below-weekday-baseline').detail,/Today: PKR 1,000 vs PKR 10,333\.33 average across 3 receipt-bearing same-weekday/);
  assert.match(alert(result,'collection-below-weekday-baseline').detail,/below 80% of baseline/);
});

test('manual Offline profile state is never described as a verified network outage',()=>{
  const state=stateOf([customer('c1','Offline customer',[bill('2026-10')],{serviceStatus:'offline'})]);
  const result=buildSmartAlerts(state,referenceDate);
  assert.equal(result.alerts.some(row=>/network outage/i.test(`${row.title} ${row.detail}`)),false);
  assert.match(result.manualStatusNote,/not a verified network outage/);
});

test('all Smart Alerts are pure read-only calculations over the supplied state',()=>{
  const state=stateOf([
    customer('c1','Ali',[bill('2026-08'),bill('2026-09'),bill('2026-10',{dueDate:'2026-10-07'})]),
    customer('c2','Bilal',[bill('2026-08',{packageName:'Plan A'}),bill('2026-09',{packageName:'Plan A'})])
  ],[{date:'2026-10-07',amount:2500,category:'Cable'}]);
  const before=JSON.stringify(state);
  buildSmartAlerts(state,referenceDate);
  assert.equal(JSON.stringify(state),before);
});
