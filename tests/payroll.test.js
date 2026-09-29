import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, readState, addCustomer, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  saveBillMonth, addPayment, archiveCustomer, unarchiveCustomer, deleteCustomer, buildPayrollSummary,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import {
  addSaadAttendanceDay, removeSaadAttendanceDay, addUmairWorkday, removeUmairWorkday,
  addExpense, buildPhase3Analytics, validatePhase3State
} from '../phase3.js';

const october = new Date('2026-10-15T12:00:00+05:00');
const november = new Date('2026-11-15T12:00:00+05:00');
const january = new Date('2027-01-15T12:00:00+05:00');
const store = () => { const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}; };
const setProfile = (state,id,fields,date=october) => updateCustomerProfile(state,id,fields,date);
const cashPayment = (amount,date='2026-10-10') => ({date,amount:String(amount),method:'Cash'});
const summaryFor = state => buildPayrollSummary(state,'2026-10',october);

test('generated and manually created monthly bills default to the fifth across December-to-January boundaries',()=>{
  let state=setProfile(createInitialState(),'seed-001',{monthlySellingAmount:'120'},new Date('2026-12-15T12:00:00+05:00'));
  state=generateMonthlyBillsThroughCurrentMonth(state,january);
  const customer=state.customers.find(row=>row.id==='seed-001');
  assert.equal(customer.bills.find(bill=>bill.month==='2026-12').dueDate,'2026-12-05');
  assert.equal(customer.bills.find(bill=>bill.month==='2027-01').dueDate,'2027-01-05');
  state=saveBillMonth(state,'seed-002',{month:'2027-01',dueAmount:'90',status:'pending'},january);
  assert.equal(state.customers.find(row=>row.id==='seed-002').bills[0].dueDate,'2027-01-05');
});

test('custom due-date overrides persist and historical bill snapshots are never backfilled or rewritten',()=>{
  let state=setProfile(createInitialState(),'seed-001',{monthlySellingAmount:'120'},new Date('2026-12-15T12:00:00+05:00'));
  state=generateMonthlyBillsThroughCurrentMonth(state,january);
  state=saveBillMonth(state,'seed-001',{month:'2026-12',dueAmount:'120',dueDate:'2026-12-19',status:'pending'},new Date('2026-12-20T12:00:00+05:00'));
  state=setProfile(state,'seed-001',{monthlySellingAmount:'150'},january);
  state=generateMonthlyBillsThroughCurrentMonth(state,january);
  let december=state.customers[0].bills.find(bill=>bill.month==='2026-12');
  assert.equal(december.dueDate,'2026-12-19');
  assert.equal(december.priceSnapshot,120);

  const storage=store();
  let legacy=createInitialState();
  const historic={id:'historic-2026-08',month:'2026-08',dueAmount:88,dueDate:null,status:'pending',payments:[],generated:true,priceSnapshot:88,createdAt:'2026-08-01T12:00',amountHistory:[]};
  legacy={...legacy,customers:legacy.customers.map(customer=>customer.id==='seed-001'?{...customer,monthlySellingAmount:88,monthlyPriceSchedule:[{effectiveMonth:'2026-08',amount:88}],billingStartMonth:'2026-08',bills:[historic]}:customer)};
  storage.setItem('shahdara-isp-billing-v1',JSON.stringify(legacy));
  let migrated=readState(storage);
  assert.equal(migrated.customers[0].bills[0].dueDate,null);
  migrated=generateMonthlyBillsThroughCurrentMonth(migrated,october);
  const old=migrated.customers[0].bills.find(bill=>bill.month==='2026-08');
  assert.equal(old.dueDate,null);
  assert.equal(old.priceSnapshot,88);
  assert.equal(old.dueAmount,88);
  assert.equal(migrated.customers[0].bills.find(bill=>bill.month==='2026-10').dueDate,'2026-10-05');
});

test('Saad supplement requires a post-effective-date customer with a fully paid selected-month bill and Active unarchived status',()=>{
  let state=addCustomer(createInitialState(),'New paying customer',new Date('2026-10-01T12:00:00+05:00'));
  const customerId=state.customers.at(-1).id;
  state=setProfile(state,customerId,{serviceStatus:'active'});
  state=saveBillMonth(state,customerId,{month:'2026-10',dueAmount:'100',status:'pending'},october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'an unpaid bill is excluded');
  state=addPayment(state,customerId,'2026-10',cashPayment(50),october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'a partial payment is excluded');
  state=addPayment(state,customerId,'2026-10',cashPayment(50,'2026-10-12'),october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,1);
  assert.equal(summaryFor(state).saadMonthlyIncrement,200);
  assert.equal(summaryFor(state).saadMonthlySalary,15200);

  state=setProfile(state,customerId,{serviceStatus:'offline'});
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'Offline removes the increment');
  state=setProfile(state,customerId,{serviceStatus:'active'});
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,1,'reactivated and fully paid counts again');
  state=archiveCustomer(state,customerId,october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'archiving removes the increment');
  state=unarchiveCustomer(state,customerId,october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,1,'unarchiving restores eligibility when Active and paid');
  state=deleteCustomer(state,customerId);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'dropping the customer removes the increment');
});

test('the original 74 starter profiles and customers added on the effective-date boundary are excluded',()=>{
  let state=setProfile(createInitialState(),'seed-001',{serviceStatus:'active'},october);
  state=saveBillMonth(state,'seed-001',{month:'2026-10',dueAmount:'100',status:'pending'},october);
  state=addPayment(state,'seed-001','2026-10',cashPayment(100),october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'a starter profile is not a post-effective addition');

  state=addCustomer(state,'Boundary date customer',new Date('2026-09-30T12:00:00+05:00'));
  const boundaryId=state.customers.at(-1).id;
  state=setProfile(state,boundaryId,{serviceStatus:'active'});
  state=saveBillMonth(state,boundaryId,{month:'2026-10',dueAmount:'100',status:'pending'},october);
  state=addPayment(state,boundaryId,'2026-10',cashPayment(100),october);
  assert.equal(summaryFor(state).eligibleActivePaidCustomerCount,0,'only dates strictly after the effective date count');
});

test('attendance and workday records are unique date-only entries with separate selected-month totals',()=>{
  let state=createInitialState();
  state=addSaadAttendanceDay(state,'2026-10-01');
  const afterFirstAttendance=state;
  state=addSaadAttendanceDay(state,'2026-10-01');
  assert.strictEqual(state,afterFirstAttendance,'duplicate Saad attendance date is a no-op');
  state=addSaadAttendanceDay(state,'2026-10-02');
  state=addSaadAttendanceDay(state,'2026-11-01');
  state=addUmairWorkday(state,'2026-10-03');
  const afterFirstWorkday=state;
  state=addUmairWorkday(state,'2026-10-03');
  assert.strictEqual(state,afterFirstWorkday,'duplicate Umair work date is a no-op');
  state=addUmairWorkday(state,'2026-10-04');
  state=addUmairWorkday(state,'2026-11-02');

  const octoberSummary=summaryFor(state);
  assert.equal(octoberSummary.attendanceDayCount,2);
  assert.equal(octoberSummary.umairWorkdayCount,2);
  assert.equal(octoberSummary.umairMonthlyExpense,2000);
  assert.equal(octoberSummary.saadMonthlySalary,15000,'attendance never multiplies Saad salary');
  const novemberSummary=buildPayrollSummary(state,'2026-11',november);
  assert.equal(novemberSummary.attendanceDayCount,1);
  assert.equal(novemberSummary.umairWorkdayCount,1);
  assert.equal(novemberSummary.umairMonthlyExpense,1000);

  assert.deepEqual(state.expenses,[],'workday summaries do not create cash-expense records');
  assert.equal(buildPhase3Analytics(state,october).incomeExpense.find(row=>row.month==='2026-10').expenses,null,'no recorded cash expense is not fabricated as zero');
  state=addExpense(state,{date:'2026-10-10',amount:'2000',category:'Salary — Umair'});
  assert.equal(buildPhase3Analytics(state,october).incomeExpense.find(row=>row.month==='2026-10').expenses,2000,'only an actual manual ledger entry enters cash totals');
  assert.equal(state.expenses.length,1,'calculated payroll is not also inserted as a transaction');

  state=removeSaadAttendanceDay(state,'2026-10-02');
  state=removeUmairWorkday(state,'2026-10-04');
  assert.equal(summaryFor(state).attendanceDayCount,1);
  assert.equal(summaryFor(state).umairMonthlyExpense,1000);
});

test('new state and restore create no attendance, workday, bill, or expense entries unless entered',()=>{
  const state=createInitialState();
  const summary=summaryFor(state);
  assert.deepEqual(state.saadAttendanceDays,[]);
  assert.deepEqual(state.umairWorkdays,[]);
  assert.deepEqual(state.expenses,[]);
  assert.equal(summary.attendanceDayCount,0);
  assert.equal(summary.umairWorkdayCount,0);
  assert.equal(summary.umairMonthlyExpense,0);
  assert.ok(state.customers.every(customer=>customer.bills.length===0));
  assert.deepEqual(validatePhase3State({...state,saadAttendanceDays:['2026-10-01','2026-10-01'],umairWorkdays:['2026-10-02','2026-10-02']}).saadAttendanceDays,['2026-10-01']);
  assert.deepEqual(validatePhase3State({...state,saadAttendanceDays:['2026-10-01','2026-10-01'],umairWorkdays:['2026-10-02','2026-10-02']}).umairWorkdays,['2026-10-02']);
});

test('payroll date logs and new-customer dates survive the validated merge-only backup flow',()=>{
  let local=addSaadAttendanceDay(createInitialState(),'2026-10-03');
  let incoming=addCustomer(createInitialState(),'Backup-only post-release customer',new Date('2026-10-01T12:00:00+05:00'));
  incoming=addSaadAttendanceDay(incoming,'2026-10-03');
  incoming=addSaadAttendanceDay(incoming,'2026-10-04');
  incoming=addUmairWorkday(incoming,'2026-10-08');
  const backup=createJsonBackup(incoming,october);
  const preview=previewJsonBackupMerge(local,backup);
  assert.equal(preview.canApply,true);
  assert.equal(preview.counts.addedCustomers,1);
  assert.equal(preview.counts.addedSaadAttendanceDays,1,'a date already present locally is not duplicated');
  assert.equal(preview.counts.addedUmairWorkdays,1);
  assert.deepEqual(preview.state.saadAttendanceDays,['2026-10-03','2026-10-04']);
  assert.deepEqual(preview.state.umairWorkdays,['2026-10-08']);
  assert.equal(preview.state.customers.find(customer=>customer.name==='Backup-only post-release customer').addedOn,'2026-10-01');
  assert.equal(previewJsonBackupMerge(preview.state,backup).canApply,false,'reapplying the same backup is idempotent');
});

test('backup merge fills missing added-on metadata for matching customers but preserves an explicit local date',()=>{
  const incoming=addCustomer(createInitialState(),'Shared backup customer',new Date('2026-10-01T12:00:00+05:00'));
  const id=incoming.customers.at(-1).id;
  const backup=createJsonBackup(incoming,october);
  const missing={...incoming,customers:incoming.customers.map(customer=>customer.id===id?{...customer,addedOn:null}:customer)};
  const filled=previewJsonBackupMerge(missing,backup);
  assert.equal(filled.state.customers.find(customer=>customer.id===id).addedOn,'2026-10-01');
  assert.equal(filled.counts.filledProfileFields,1);
  const explicit={...incoming,customers:incoming.customers.map(customer=>customer.id===id?{...customer,addedOn:'2026-10-02'}:customer)};
  const conflict=previewJsonBackupMerge(explicit,backup);
  assert.equal(conflict.state.customers.find(customer=>customer.id===id).addedOn,'2026-10-02');
  assert.ok(conflict.conflicts.some(item=>item.field==='addedOn'));
});
