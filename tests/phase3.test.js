import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, readState, persistState, updateCustomerProfile, addIncident, addPayment,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import {
  EXPENSE_CATEGORIES, INVENTORY_CATEGORIES, addInventoryItem, updateInventoryItem, addStockMovement,
  deleteStockMovement, inventoryBalances, inventorySummary, addExpense, updateExpense, deleteExpense,
  buildPhase3Analytics, outstandingAtMonthEnd, sixMonths, pktDate, areaLabel, isActiveSubscription, canonicalPackage
} from '../phase3.js';

const ref = new Date('2026-09-15T10:00:00Z');
const store = () => { const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}; };
const editProfile=(state,id,fields,date=ref)=>updateCustomerProfile(state,id,fields,date);
const directBill=(month,dueAmount,payments=[])=>({id:`bill-${month}`,month,dueAmount,status:'pending',payments,generated:true,priceSnapshot:dueAmount,amountHistory:[]});

test('starter state has no seeded inventory or expenses, and optional zone/subscription values remain unset',()=>{
  const state=createInitialState();
  assert.equal(state.customers.length,74);
  assert.equal(state.inventoryItems.length,0);assert.equal(state.inventoryMovements.length,0);assert.equal(state.expenses.length,0);
  assert.ok(state.customers.every(customer=>customer.zone===''&&customer.connectionDate===null&&customer.expiryDate===null&&customer.cancellationDate===null&&customer.packageHistory.length===0));
  const summary=inventorySummary(state);assert.equal(summary.hasItemDefinitions,false);assert.equal(summary.hasMovements,false);
});

test('inventory definitions do not create stock and dated movements transfer actual quantities by status',()=>{
  let state=createInitialState();
  state=addInventoryItem(state,{name:'ONT model entered by owner',category:'ONU',unit:'piece',minimumStock:'2',unitCost:'100',createdDate:'2026-09-01'});
  const item=state.inventoryItems[0];assert.equal(inventoryBalances(item.id,state).available,0);assert.equal(inventorySummary(state).hasMovements,false);
  state=addStockMovement(state,{itemId:item.id,type:'receive',quantity:'5',date:'2026-09-02',notes:'Recorded delivery'});
  state=addStockMovement(state,{itemId:item.id,type:'install',quantity:'2',date:'2026-09-03',customerId:'seed-001',notes:'Installed on customer'});
  state=addStockMovement(state,{itemId:item.id,type:'return',quantity:'1',date:'2026-09-04',customerId:'seed-001',notes:'Customer return'});
  state=addStockMovement(state,{itemId:item.id,type:'damage',quantity:'1',date:'2026-09-05',fromState:'available',notes:'Physically damaged'});
  let summary=inventorySummary(state);
  assert.equal(summary.onuStock,2);assert.equal(summary.installed,1);assert.equal(summary.returned,1);assert.equal(summary.damaged,1);
  assert.equal(summary.lowStockItems,1);assert.equal(summary.availableValue,200);
  state=addStockMovement(state,{itemId:item.id,type:'correction',quantity:'1',date:'2026-09-06',fromState:'',toState:'available',notes:'Physical recount variance'});
  summary=inventorySummary(state);assert.equal(summary.onuStock,3);assert.equal(summary.lowStockItems,0);assert.equal(summary.availableValue,300);
  assert.equal(summary.movements.length,5);assert.equal(summary.movements[0].type,'correction');
});

test('stock movements reject unsupported, impossible, and undated counts; correction requires a note',()=>{
  let state=addInventoryItem(createInitialState(),{name:'Router unit',category:'Router',unit:'piece',minimumStock:0,unitCost:null,createdDate:'2026-09-01'});const id=state.inventoryItems[0].id;
  assert.throws(()=>addStockMovement(state,{itemId:id,type:'install',quantity:1,date:'2026-09-01'}),/Insufficient/);
  assert.throws(()=>addStockMovement(state,{itemId:id,type:'receive',quantity:1,date:'2026-02-30'}),/valid Pakistan local date/);
  assert.throws(()=>addStockMovement(state,{itemId:id,type:'correction',quantity:1,date:'2026-09-01',toState:'available'}),/note is required/);
  state=addStockMovement(state,{itemId:id,type:'receive',quantity:3,date:'2026-09-01'});
  const receive=state.inventoryMovements[0];
  state=addStockMovement(state,{itemId:id,type:'install',quantity:2,date:'2026-09-02'});
  assert.throws(()=>deleteStockMovement(state,receive.id),/later recorded movements depend/);
  assert.throws(()=>updateInventoryItem(state,id,{unit:'x'.repeat(25)}),/24 characters/);
});

test('inventory summary keeps unit groups separate, tracks all requested material categories, and values available stock only',()=>{
  let state=createInitialState();
  for(const [index,category,unit,cost] of [[0,'ONU','piece',50],[1,'Router','piece',80],[2,'Fiber cable','meter',2],[3,'Connector','piece',3],[4,'Adapter / power supply','piece',15]]) {
    state=addInventoryItem(state,{name:`actual ${category}`,category,unit,minimumStock:0,unitCost:cost,createdDate:'2026-09-01'});
    state=addStockMovement(state,{itemId:state.inventoryItems[index].id,type:'receive',quantity:index+1,date:'2026-09-02'});
  }
  const summary=inventorySummary(state);
  assert.equal(summary.onuStock,1);assert.equal(summary.routerStock,2);assert.equal(summary.fiberCable,3);assert.equal(summary.connectors,4);assert.equal(summary.adaptersPowerSupplies,5);
  assert.equal(summary.availableValue,50+160+6+12+75);
  state=addStockMovement(state,{itemId:state.inventoryItems[0].id,type:'install',quantity:1,date:'2026-09-03'});
  assert.equal(inventorySummary(state).availableValue,50+160+6+12+75-50);
});

test('all requested expense categories accept only actual positive dated amounts and support correction/deletion',()=>{
  assert.deepEqual(EXPENSE_CATEGORIES,['Nayatel bill','Electricity','Salary — Saad','Salary — Umair','Cable','ONU','Routers','Charger','Repairs','OLT','Tools','RADIUS server bill','Other expenses']);
  let state=createInitialState();
  for(const [index,category] of EXPENSE_CATEGORIES.entries()) state=addExpense(state,{date:`2026-09-${String(index+1).padStart(2,'0')}`,amount:'10.50',category,notes:'manual entry'});
  assert.equal(state.expenses.length,13);assert.equal(state.expenses.reduce((sum,row)=>sum+row.amount,0),136.5);
  const target=state.expenses[0];state=updateExpense(state,target.id,{date:'2026-10-01',amount:'21',category:'Other expenses',notes:'corrected'});
  assert.equal(state.expenses.find(row=>row.id===target.id).amount,21);assert.equal(state.expenses.find(row=>row.id===target.id).date,'2026-10-01');
  state=deleteExpense(state,target.id);assert.equal(state.expenses.length,12);
  assert.throws(()=>addExpense(state,{date:'2026-02-30',amount:'1',category:'Electricity'}),/valid Pakistan local date/);
  assert.throws(()=>addExpense(state,{date:'2026-09-01',amount:'0',category:'Electricity'}),/greater than zero/);
  assert.throws(()=>addExpense(state,{date:'2026-09-01',amount:'1',category:'Made up'}),/valid expense category/);
});

test('PKT six-month boundaries and partial current month use Pakistan local calendar dates',()=>{
  const afterMidnightPkt=new Date('2026-09-30T20:00:00Z');
  assert.equal(pktDate(afterMidnightPkt),'2026-10-01');
  assert.deepEqual(sixMonths(afterMidnightPkt),['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
  const report=buildPhase3Analytics(createInitialState(),afterMidnightPkt);
  assert.equal(report.currentMonth,'2026-10');assert.equal(report.currentMonthPartial,true);assert.equal(report.months.length,6);
  assert.equal(report.asOf,'2026-10-01');assert.equal(report.hasRevenueRecords,false);assert.equal(report.hasExpenseRecords,false);
});

test('area summary rolls up the parent area with nested zones and keeps manual online status separate',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{zone:'Central',mohalla:'North',address:'Road 1',serviceStatus:'active',monthlySellingAmount:'100',packageSpeed:'10 Mbps',connectionDate:'2026-09-03'});
  state=editProfile(state,'seed-002',{zone:'Central',mohalla:'North',serviceStatus:'offline',monthlySellingAmount:'200',packageSpeed:'15 Mbps'});
  state=editProfile(state,'seed-003',{mohalla:'South',address:'Road 2',serviceStatus:'not-set'});
  assert.equal(areaLabel(state.customers[0]),'Area: North');assert.equal(areaLabel(state.customers[2]),'Area: South');assert.equal(areaLabel(state.customers[3]),'Area not set');
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[directBill('2026-09',100,[{id:'p1',date:'2026-09-10',amount:40,method:'Cash'}])]}:customer.id==='seed-002'?{...customer,bills:[directBill('2026-09',200)]}:customer)};
  const report=buildPhase3Analytics(state,ref),area=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: North'),zone=report.areaRows.find(row=>row.level==='zone'&&row.area==='Zone: Central');
  assert.equal(area.customerCount,2);assert.equal(area.billedRevenue,300);assert.equal(area.outstanding,260);assert.equal(area.activeCustomers,2);assert.equal(area.onlinePercent,50);assert.equal(area.onlineDenominator,2);assert.equal(area.arpu,150);assert.equal(area.newConnections,1);
  assert.equal(zone.customerCount,2);assert.equal(zone.parentArea,'Area: North');assert.equal(zone.includedInAreaRollup,true);assert.equal(report.unassignedArea.profiles,71);
  const noBillArea=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: South');assert.equal(noBillArea.hasBilledRevenue,false);assert.equal(noBillArea.hasBillHistory,false);assert.equal(noBillArea.arpu,null);
  assert.equal(report.onlineOffline.online,1);assert.equal(report.onlineOffline.offline,1);assert.equal(report.onlineOffline.notSet,72);assert.equal(report.onlineOffline.denominator,2);assert.equal(report.onlineOffline.onlinePercent,50);
});

test('area, mohalla, zone and package keys normalize Unicode, whitespace and case without fuzzy merging',()=>{
  let state=createInitialState();
  const profiles=[
    ['seed-001',' North\u00a0  Park ',' central ','15Mbps',100,100],
    ['seed-002','north park','CENTRAL','15 Mbps',120,120],
    ['seed-003','ＮＯＲＴＨ　ＰＡＲＫ','Central','15 MBPS',150,150],
    ['seed-004','North Park','Central West','15 mbps',200,200],
    ['seed-005','North-Park','Central','15Mbps',250,250],
    ['seed-006','North Park','Central-West','15Mbps',300,300]
  ];
  for(const [id,mohalla,zone,packageSpeed,price,billAmount] of profiles)state=editProfile(state,id,{mohalla,zone,packageSpeed,monthlySellingAmount:String(price)});
  state={...state,customers:state.customers.map(customer=>{const fixture=profiles.find(row=>row[0]===customer.id);return fixture?{...customer,bills:[directBill('2026-09',fixture[5])]}:customer;})};
  const report=buildPhase3Analytics(state,ref),north=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: North Park'),hyphen=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: North-Park');
  assert.equal(north.customerCount,5);assert.equal(north.activeCustomers,5);assert.equal(north.billedRevenue,870);assert.equal(north.arpu,174);
  assert.equal(hyphen.customerCount,1);
  const northZones=report.areaRows.filter(row=>row.level==='zone'&&row.parentArea==='Area: North Park');
  assert.deepEqual(northZones.map(row=>row.area),['Zone: Central','Zone: Central West','Zone: Central-West']);
  assert.deepEqual(northZones.map(row=>row.customerCount),[3,1,1]);
  assert.equal(areaLabel({mohalla:'ＮＯＲＴＨ　ＰＡＲＫ'}),'Area: North Park');
  const speed=report.packageRows.find(row=>row.package==='15 Mbps');
  assert.equal(speed.customers,6);assert.equal(speed.activeCustomers,6);assert.equal(speed.billedRevenue,1120);assert.equal(speed.arpu,Number((1120/6).toFixed(2)));
  assert.deepEqual(['5Mbps','10 Mbps','15 MBPS','30mbps'].map(value=>canonicalPackage(value).label),['5 Mbps','10 Mbps','15 Mbps','30 Mbps']);
  assert.notEqual(canonicalPackage('Silver Plan').key,canonicalPackage('Silver-Plan').key);
});

test('same zone names stay distinct under different parent areas; explicit mohalla remains a separate level',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{area:'North District',mohalla:'River Park',zone:'Shared',packageSpeed:'5 Mbps',monthlySellingAmount:'100'});
  state=editProfile(state,'seed-002',{area:'North District',mohalla:'Hill Park',zone:'shared',packageSpeed:'5Mbps',monthlySellingAmount:'100'});
  state=editProfile(state,'seed-003',{area:'South District',mohalla:'',zone:'Shared',packageSpeed:'5 Mbps',monthlySellingAmount:'100'});
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'||customer.id==='seed-002'?{...customer,area:'North District'}:customer.id==='seed-003'?{...customer,area:'South District'}:customer)};
  const rows=buildPhase3Analytics(state,ref).areaRows;
  assert.equal(rows.filter(row=>row.level==='area').length,2);
  assert.equal(rows.filter(row=>row.level==='mohalla').length,2);
  assert.equal(rows.filter(row=>row.level==='zone'&&row.area==='Zone: Shared').length,3);
  assert.ok(rows.some(row=>row.level==='zone'&&row.area==='Zone: Shared'&&row.parentArea==='Mohalla: River Park'));
  assert.ok(rows.some(row=>row.level==='zone'&&row.area==='Zone: Shared'&&row.parentArea==='Mohalla: Hill Park'));
  assert.ok(rows.some(row=>row.level==='zone'&&row.area==='Zone: Shared'&&row.parentArea==='Area: South District'));
});

test('custom package labels trim and case-normalize without merging punctuation-distinct names',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{packageSpeed:'  Gold   Plan ',monthlySellingAmount:'100'});
  state=editProfile(state,'seed-002',{packageSpeed:'gold plan',monthlySellingAmount:'100'});
  state=editProfile(state,'seed-003',{packageSpeed:'Gold-Plan',monthlySellingAmount:'100'});
  const rows=buildPhase3Analytics(state,ref).packageRows;
  assert.equal(rows.find(row=>row.package==='Gold Plan').customers,2);
  assert.equal(rows.find(row=>row.package==='Gold-Plan').customers,1);
});

test('ARPU uses one current PKT bill snapshot per customer divided by active configured subscriptions, including Offline',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{packageSpeed:'5Mbps',monthlySellingAmount:'100',serviceStatus:'offline',mohalla:'North'});
  state=editProfile(state,'seed-002',{packageSpeed:'5 Mbps',monthlySellingAmount:'200',serviceStatus:'active',mohalla:'North'});
  state=editProfile(state,'seed-003',{packageSpeed:'10 Mbps',monthlySellingAmount:'300',expiryDate:'2026-09-14',mohalla:'North'});
  state=editProfile(state,'seed-004',{packageSpeed:'10 Mbps',monthlySellingAmount:'500',mohalla:'North'});
  state=editProfile(state,'seed-005',{packageSpeed:'30 Mbps',monthlySellingAmount:null,mohalla:'North'});
  state=editProfile(state,'seed-006',{packageSpeed:'30Mbps',monthlySellingAmount:'450',cancellationDate:'2026-09-10',mohalla:'North'});
  state={...state,customers:state.customers.map(customer=>{
    if(customer.id==='seed-001')return {...customer,bills:[directBill('2026-09',80)]};
    if(customer.id==='seed-002')return {...customer,bills:[directBill('2026-09',240)]};
    if(customer.id==='seed-003')return {...customer,bills:[directBill('2026-09',30)]};
    if(customer.id==='seed-004')return {...customer,monthlyPriceSchedule:[{amount:500,effectiveMonth:'2026-10'}]};
    if(customer.id==='seed-006')return {...customer,bills:[directBill('2026-09',50)]};
    return customer;
  })};
  const report=buildPhase3Analytics(state,ref),overall=report.currentServiceMonthArpu,five=report.packageRows.find(row=>row.package==='5 Mbps'),ten=report.packageRows.find(row=>row.package==='10 Mbps');
  assert.equal(overall.billedRevenue,400);assert.equal(overall.billSnapshotCount,4);assert.equal(overall.activeSubscriptions,2);assert.equal(overall.excludedSubscriptions,72);assert.equal(overall.arpu,200);
  assert.equal(overall.excludedByReason.expired,1);assert.equal(overall.excludedByReason.notYetEffective,1);assert.equal(overall.excludedByReason.priceNotSet,1);assert.equal(overall.excludedByReason.cancelled,1);
  assert.equal(five.customers,2);assert.equal(five.activeCustomers,2);assert.equal(five.billedRevenue,320);assert.equal(five.arpu,160);
  assert.equal(ten.activeCustomers,0);assert.equal(ten.billedRevenue,30);assert.equal(ten.arpu,null);
  assert.equal(report.areaRows.find(row=>row.level==='area'&&row.area==='Area: North').activeCustomers,2);
  assert.equal(report.packageRows.find(row=>row.package==='Package not set').arpu,null);
});

test('duplicate customer references and duplicate same-month bills cannot double count profiles, revenue, ARPU or outstanding',()=>{
  let state=editProfile(createInitialState(),'seed-001',{mohalla:'North',zone:'Central',packageSpeed:'5 Mbps',monthlySellingAmount:'100',serviceStatus:'offline'});
  const original=state.customers[0],first={...directBill('2026-09',70),id:'bill-first',createdAt:'2026-09-01T10:00:00'},latest={...directBill('2026-09',90),id:'bill-latest',createdAt:'2026-09-10T10:00:00'};
  state={...state,customers:[{...original,bills:[first,latest]},...state.customers.slice(1),{...original,bills:[first,latest]}]};
  const report=buildPhase3Analytics(state,ref),area=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: North');
  assert.equal(area.customerCount,1);assert.equal(area.activeCustomers,1);assert.equal(area.billedRevenue,90);assert.equal(area.outstanding,90);assert.equal(area.arpu,90);
  assert.equal(report.currentServiceMonthArpu.billSnapshotCount,1);assert.equal(report.currentServiceMonthArpu.activeSubscriptions,1);assert.equal(report.currentServiceMonthArpu.arpu,90);
  assert.equal(outstandingAtMonthEnd(state,'2026-09',ref).billCount,1);
});

test('missing package, price, area and bill snapshots stay Not set; address is not inferred as an area',()=>{
  let state=editProfile(createInitialState(),'seed-001',{address:'17 Example Road',packageSpeed:'',monthlySellingAmount:null});
  const report=buildPhase3Analytics(state,ref),missingPackage=report.packageRows.find(row=>row.package==='Package not set');
  assert.equal(areaLabel(state.customers[0]),'Area not set');assert.equal(report.areaRows.length,0);assert.equal(report.unassignedArea.profiles,74);
  assert.equal(report.currentServiceMonthArpu.billedRevenue,null);assert.equal(report.currentServiceMonthArpu.arpu,null);assert.equal(report.currentServiceMonthArpu.activeSubscriptions,0);
  assert.equal(missingPackage.hasBilledRevenue,false);assert.equal(missingPackage.arpu,null);assert.equal(missingPackage.activeCustomers,0);
});

test('current ARPU selects the PKT service month across a Pakistan-local month boundary',()=>{
  let state=editProfile(createInitialState(),'seed-001',{packageSpeed:'10 Mbps',monthlySellingAmount:'100'});
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[directBill('2026-09',90),directBill('2026-10',110)]}:customer)};
  const report=buildPhase3Analytics(state,new Date('2026-09-30T20:00:00Z'));
  assert.equal(report.currentMonth,'2026-10');assert.equal(report.asOf,'2026-10-01');
  assert.equal(report.currentServiceMonthArpu.billSnapshotCount,1);assert.equal(report.currentServiceMonthArpu.billedRevenue,110);assert.equal(report.currentServiceMonthArpu.activeSubscriptions,1);assert.equal(report.currentServiceMonthArpu.arpu,110);
});

test('bill revenue is by immutable service-month snapshot while collections follow actual receipt date',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{monthlySellingAmount:'120',packageSpeed:'10 Mbps'});
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[directBill('2026-08',100,[{id:'p-aug',date:'2026-09-05',amount:40,method:'Cash'}])]}:customer)};
  const report=buildPhase3Analytics(state,ref);
  const august=report.revenueCollection.find(row=>row.month==='2026-08'),september=report.revenueCollection.find(row=>row.month==='2026-09');
  assert.equal(august.billedRevenue,100);assert.equal(august.cashCollection,null);
  assert.equal(september.billedRevenue,null);assert.equal(september.cashCollection,40);
  assert.equal(report.currentBilledRevenue,0);assert.equal(report.hasRevenueRecords,true);
});

test('month-end outstanding is an immutable receipt-date snapshot with prepaid credit applied sequentially',()=>{
  let state=createInitialState();
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[
    directBill('2026-08',100,[{id:'over',date:'2026-08-31',amount:150,method:'Cash'}]),
    directBill('2026-09',100,[{id:'later',date:'2026-10-05',amount:50,method:'Cash'}]),
    directBill('2026-10',100,[])
  ]}:customer)};
  const asOf=new Date('2026-11-01T10:00:00Z');
  assert.equal(outstandingAtMonthEnd(state,'2026-08',asOf).total,0);
  assert.equal(outstandingAtMonthEnd(state,'2026-09',asOf).total,50);
  assert.equal(outstandingAtMonthEnd(state,'2026-10',asOf).total,100);
  const report=buildPhase3Analytics(state,asOf);
  assert.equal(report.monthEndOutstanding.find(row=>row.month==='2026-09').total,50);
  assert.equal(report.monthEndOutstanding.find(row=>row.month==='2026-10').total,100);
});

test('package analytics distinguish new subscription, expiry and explicit churn; Offline alone never means churn',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{packageSpeed:'5 Mbps',monthlySellingAmount:'100',serviceStatus:'offline',connectionDate:'2026-09-03'});
  state=editProfile(state,'seed-002',{packageSpeed:'5 Mbps',monthlySellingAmount:'120',expiryDate:'2026-09-20'});
  state=editProfile(state,'seed-003',{packageSpeed:'10 Mbps',monthlySellingAmount:'130',cancellationDate:'2026-09-09'});
  state=editProfile(state,'seed-004',{packageSpeed:'15 Mbps',monthlySellingAmount:'140'});
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[directBill('2026-09',100)]}:customer)};
  const report=buildPhase3Analytics(state,new Date('2026-09-29T12:00:00Z')),five=report.packageRows.find(row=>row.package==='5 Mbps'),ten=report.packageRows.find(row=>row.package==='10 Mbps');
  assert.equal(five.customers,2);assert.equal(five.newSubscriptions,1);assert.equal(five.expired,1);assert.equal(five.churn,0);
  assert.equal(ten.churn,1);assert.equal(ten.expired,0);assert.equal(five.activeCustomers,1);
  assert.equal(isActiveSubscription(state.customers[0],'2026-09-15'),true);assert.equal(isActiveSubscription(state.customers[1],'2026-09-29'),false);assert.equal(isActiveSubscription(state.customers[2],'2026-09-29'),false);
});

test('price changes create dated old/new package and rate history without rewriting earlier bill snapshots',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{packageSpeed:'5 Mbps',monthlySellingAmount:'100'},new Date('2026-09-01T08:00:00Z'));
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-001'?{...customer,bills:[directBill('2026-09',100)]}:customer)};
  state=editProfile(state,'seed-001',{packageSpeed:'10 Mbps',monthlySellingAmount:'125',packageChangeStaffName:'Operator A'},new Date('2026-09-10T08:00:00Z'));
  const customer=state.customers[0],change=customer.packageHistory.at(-1);
  assert.equal(change.date,'2026-09-10');assert.equal(change.oldPackage,'5 Mbps');assert.equal(change.newPackage,'10 Mbps');assert.equal(change.oldMonthlyRate,100);assert.equal(change.newMonthlyRate,125);assert.equal(change.monthlyRecurringPriceDelta,25);assert.equal(change.staffName,'Operator A');
  assert.equal(customer.bills.find(bill=>bill.month==='2026-09').dueAmount,100);
});

test('next-month forecast includes offline configured subscriptions and excludes expired, cancelled, and archived profiles',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{monthlySellingAmount:'100',serviceStatus:'offline'});
  state=editProfile(state,'seed-002',{monthlySellingAmount:'200',expiryDate:'2026-09-30'});
  state=editProfile(state,'seed-003',{monthlySellingAmount:'300',cancellationDate:'2026-09-25'});
  state=editProfile(state,'seed-004',{monthlySellingAmount:'400'});
  state={...state,customers:state.customers.map(customer=>customer.id==='seed-004'?{...customer,archived:true,archivedAt:'2026-09-01T12:00'}:customer)};
  const forecast=buildPhase3Analytics(state,ref).forecast;
  assert.equal(forecast.month,'2026-10');assert.equal(forecast.amount,100);assert.equal(forecast.customersIncluded,1);
});

test('cash-versus-expense chart excludes provider estimates and inventory book value from actual cash accounting',()=>{
  let state=createInitialState();
  state=editProfile(state,'seed-001',{monthlySellingAmount:'100',monthlyPurchaseCost:'70'});
  state=addPayment(state,'seed-001','2026-09',{date:'2026-09-10',amount:'100',method:'Cash'},ref);
  state=addExpense(state,{date:'2026-09-12',amount:'20',category:'Electricity'},ref);
  state=addInventoryItem(state,{name:'Cable reel',category:'Fiber cable',unit:'roll',unitCost:'500',minimumStock:0,createdDate:'2026-09-01'});
  state=addStockMovement(state,{itemId:state.inventoryItems[0].id,type:'receive',quantity:'2',date:'2026-09-02'});
  const report=buildPhase3Analytics(state,ref),september=report.incomeExpense.find(row=>row.month==='2026-09');
  assert.equal(september.income,100);assert.equal(september.expenses,20);assert.equal(september.incomeCount,1);assert.equal(september.expenseCount,1);
  assert.equal(inventorySummary(state).availableValue,1000);
  assert.equal(report.hasIncomeRecords,true);assert.equal(report.hasExpenseRecords,true);
});

test('expense and inventory corrections are additive local records and never create purchases by themselves',()=>{
  let state=createInitialState();state=addInventoryItem(state,{name:'Adapter',category:'Adapter / power supply',unit:'piece',unitCost:'25',minimumStock:0,createdDate:'2026-09-01'});
  assert.equal(inventorySummary(state).hasMovements,false);assert.equal(state.expenses.length,0);
  state=updateInventoryItem(state,state.inventoryItems[0].id,{unitCost:'30',minimumStock:'3'});
  assert.equal(state.inventoryItems[0].unitCost,30);assert.equal(inventorySummary(state).hasMovements,false);
});

test('legacy migration adds only blank Phase 3 fields without changing existing bills or starter order',()=>{
  const storage=store(),raw=JSON.stringify({version:1,nextCustomerNumber:75,customers:[{id:'seed-001',customerNumber:1,name:'NAZEER',mohalla:'',packageSpeed:'',monthlySellingAmount:null,bills:[directBill('2026-08',100)]}]});
  storage.setItem('shahdara-isp-billing-v1',raw);const migrated=readState(storage);
  assert.equal(migrated.customers[0].zone,'');assert.equal(migrated.customers[0].connectionDate,null);assert.equal(migrated.customers[0].expiryDate,null);assert.equal(migrated.customers[0].cancellationDate,null);assert.deepEqual(migrated.customers[0].packageHistory,[]);
  assert.deepEqual(migrated.inventoryItems,[]);assert.deepEqual(migrated.inventoryMovements,[]);assert.deepEqual(migrated.expenses,[]);
  assert.equal(migrated.customers[0].bills[0].dueAmount,100);assert.equal(storage.getItem('shahdara-isp-billing-v1'),raw);
});

test('JSON backup and reviewed merge preserve zones, dates, package history, inventory trail, and expenses',()=>{
  let source=createInitialState();
  source=editProfile(source,'seed-001',{zone:'West',packageSpeed:'30 Mbps',monthlySellingAmount:'250',connectionDate:'2026-09-02',expiryDate:'2027-09-01',cancellationDate:''});
  source=addInventoryItem(source,{name:'Actual ONU',category:'ONU',unit:'piece',minimumStock:2,unitCost:50,createdDate:'2026-09-01'});
  source=addStockMovement(source,{itemId:source.inventoryItems[0].id,type:'receive',quantity:3,date:'2026-09-03'});
  source=addExpense(source,{date:'2026-09-04',amount:'25',category:'Tools',notes:'local record'});
  const backup=createJsonBackup(source,ref);const preview=previewJsonBackupMerge(createInitialState(),backup);
  assert.equal(preview.counts.addedInventoryItems,1);assert.equal(preview.counts.addedInventoryMovements,1);assert.equal(preview.counts.addedExpenses,1);
  const customer=preview.state.customers[0];assert.equal(customer.zone,'West');assert.equal(customer.connectionDate,'2026-09-02');assert.equal(customer.packageHistory.length,1);
  assert.equal(preview.state.inventoryItems.length,1);assert.equal(preview.state.inventoryMovements.length,1);assert.equal(preview.state.expenses[0].amount,25);
});

test('backup validation rejects fabricated or malformed expense and stock data',()=>{
  const state=createInitialState();
  const invalid=JSON.parse(createJsonBackup(state,ref));invalid.state.expenses=[{id:'bad',date:'2026-09-01',amount:-1,category:'Electricity',notes:''}];
  assert.throws(()=>previewJsonBackupMerge(createInitialState(),JSON.stringify(invalid)),/Expense amount must be greater than zero/);
  const badItem=JSON.parse(createJsonBackup(state,ref));badItem.state.inventoryItems=[{id:'x',name:'thing',category:'Not a category',unit:'piece',minimumStock:0,unitCost:1,createdDate:'2026-09-01',notes:''}];
  assert.throws(()=>previewJsonBackupMerge(createInitialState(),JSON.stringify(badItem)),/invalid inventory category/);
});

test('actual complaints/outages roll into the assigned area and monthly issue counts use recorded report dates only',()=>{
  let state=createInitialState();state=editProfile(state,'seed-001',{mohalla:'Eastside',zone:'East'});
  state=addIncident(state,'seed-001',{reportedAt:'2026-09-12T10:00',offlineAt:'2026-09-12T10:00',restoredAt:'2026-09-12T12:00',note:'Manual record'},ref);
  const report=buildPhase3Analytics(state,ref),area=report.areaRows.find(row=>row.level==='area'&&row.area==='Area: Eastside');
  assert.equal(area.complaints,1);assert.equal(report.incidentCount,1);assert.equal(report.networkIssues.find(row=>row.month==='2026-09').count,1);
});
