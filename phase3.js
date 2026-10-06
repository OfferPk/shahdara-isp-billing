export const EXPENSE_CATEGORIES = Object.freeze([
  'Nayatel bill','Electricity','Salary — Saad','Salary — Umair','Cable','ONU','Routers','Charger','Repairs','OLT','Tools','RADIUS server bill','Other expenses'
]);
export const INVENTORY_CATEGORIES = Object.freeze(['ONU','Router','Fiber cable','Connector','Adapter / power supply','Other']);
export const INVENTORY_STATES = Object.freeze(['available','installed','damaged','returned']);
export const PHASE3_SCHEMA_VERSION = 1;
export const PAYROLL_RULES_EFFECTIVE_DATE = '2026-09-30';
export const SAAD_BASE_MONTHLY_SALARY = 15000;
export const SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY = 200;
export const UMAIR_PER_LOGGED_WORKDAY = 1000;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const cents = value => Math.round(Number(value || 0) * 100);
const money = value => Number((value / 100).toFixed(2));
const nonblank = value => value !== null && value !== undefined && value !== '';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const monthOf = value => typeof value === 'string' && DATE_RE.test(value) ? value.slice(0,7) : '';
const validDate = value => {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
};
const dateInZone = (date, opts) => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{...opts,timeZone:'Asia/Karachi'}).formatToParts(date).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
export function pktDate(date = new Date()) { const p=dateInZone(date,{year:'numeric',month:'2-digit',day:'2-digit'}); return `${p.year}-${p.month}-${p.day}`; }
export function pktMonth(date = new Date()) { return monthOf(pktDate(date)); }
export function addMonths(month, delta) { const [year,number]=month.split('-').map(Number); const index=year*12+number-1+delta; return `${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`; }
export function sixMonths(referenceDate = new Date()) { const current=pktMonth(referenceDate); return Array.from({length:6},(_,i)=>addMonths(current,i-5)); }
export function monthEnd(month) { if (!MONTH_RE.test(month)) throw new Error('Choose a valid PKT calendar month.'); const [year,number]=month.split('-').map(Number); return `${month}-${String(new Date(Date.UTC(year,number,0)).getUTCDate()).padStart(2,'0')}`; }
function requireDate(value,label='Date') { const date=String(value??''); if(!validDate(date)) throw new Error(`${label} must be a valid Pakistan local date.`); return date; }
function requireMonth(value) { const month=String(value??''); if(!MONTH_RE.test(month)) throw new Error('Choose a valid PKT calendar month.'); return month; }
function requireText(value,max,label,required=true) { const text=String(value??'').trim(); if(required&&!text) throw new Error(`${label} is required.`); if(text.length>max) throw new Error(`${label} must be ${max} characters or fewer.`); return text; }
function requireAmount(value,{allowZero=false,label='Amount'}={}) { if(!nonblank(value)&&allowZero) return null; const number=Number(value); if(!Number.isFinite(number)||number<(allowZero?0:0.01)) throw new Error(`${label} must be ${allowZero?'zero or greater':'greater than zero'}.`); return Number(number.toFixed(2)); }
function monthLastDayToday(referenceDate) { return pktDate(referenceDate); }

export function addInventoryItem(state, fields, referenceDate = new Date()) {
  const name=requireText(fields.name,100,'Item name');
  const category=INVENTORY_CATEGORIES.includes(fields.category)?fields.category:(()=>{throw new Error('Choose a valid inventory category.');})();
  const unit=requireText(fields.unit,24,'Unit of measure');
  const minimumStock=requireAmount(fields.minimumStock??0,{allowZero:true,label:'Minimum stock'});
  const unitCost=requireAmount(fields.unitCost,{allowZero:true,label:'Acquisition cost'});
  const createdDate=nonblank(fields.createdDate)?requireDate(fields.createdDate,'Recorded date'):pktDate(referenceDate);
  const notes=requireText(fields.notes??'',1000,'Notes',false);
  const item={id:makeId(),name,category,unit,minimumStock,unitCost,createdDate,notes};
  return {...state,inventoryItems:[...(state.inventoryItems??[]),item]};
}
export function updateInventoryItem(state,itemId,fields,referenceDate=new Date()) {
  const items=state.inventoryItems??[]; const current=items.find(item=>item.id===itemId); if(!current) throw new Error('Inventory item not found.');
  const next={...current,
    name:Object.hasOwn(fields,'name')?requireText(fields.name,100,'Item name'):current.name,
    category:Object.hasOwn(fields,'category')?(INVENTORY_CATEGORIES.includes(fields.category)?fields.category:(()=>{throw new Error('Choose a valid inventory category.');})()):current.category,
    unit:Object.hasOwn(fields,'unit')?requireText(fields.unit,24,'Unit of measure'):current.unit,
    minimumStock:Object.hasOwn(fields,'minimumStock')?requireAmount(fields.minimumStock,{allowZero:true,label:'Minimum stock'}):current.minimumStock,
    unitCost:Object.hasOwn(fields,'unitCost')?requireAmount(fields.unitCost,{allowZero:true,label:'Acquisition cost'}):current.unitCost,
    notes:Object.hasOwn(fields,'notes')?requireText(fields.notes,1000,'Notes',false):current.notes,
    updatedDate:pktDate(referenceDate)};
  return {...state,inventoryItems:items.map(item=>item.id===itemId?next:item)};
}
function orderMovements(movements) { return [...movements].sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt??'').localeCompare(b.createdAt??'')||a.id.localeCompare(b.id)); }
function applyToBalances(balances,movement) {
  const from=movement.fromState??null,to=movement.toState;
  if(from!==null) balances[from]=(balances[from]??0)-Number(movement.quantity);
  if(to!==null) balances[to]=(balances[to]??0)+Number(movement.quantity);
}
export function inventoryBalances(itemId,state,throughDate='9999-12-31') {
  const balance=Object.fromEntries(INVENTORY_STATES.map(status=>[status,0]));
  for(const movement of orderMovements(state.inventoryMovements??[])) if(movement.itemId===itemId&&movement.date<=throughDate) applyToBalances(balance,movement);
  return balance;
}
function movementStates(type,fields) {
  if(type==='receive') return {fromState:null,toState:'available'};
  if(type==='install'||type==='issue') return {fromState:'available',toState:'installed'};
  if(type==='return') return {fromState:'installed',toState:'returned'};
  if(type==='damage') { if(!['available','installed','returned'].includes(fields.fromState)) throw new Error('Choose the current status of damaged equipment.'); return {fromState:fields.fromState,toState:'damaged'}; }
  if(type==='correction') { const from=fields.fromState||null,to=fields.toState||null; if(from&&!INVENTORY_STATES.includes(from)) throw new Error('Choose a valid correction source status.'); if(to&&!INVENTORY_STATES.includes(to)) throw new Error('Choose a valid correction destination status.'); if(from===to) throw new Error('A stock correction must change the recorded status or quantity.'); if(!String(fields.notes??'').trim()) throw new Error('A note is required for stock corrections.'); return {fromState:from,toState:to}; }
  throw new Error('Choose receive, install/issue, return, damage, or correction.');
}
export function addStockMovement(state,fields,referenceDate=new Date()) {
  const item=(state.inventoryItems??[]).find(row=>row.id===fields.itemId); if(!item) throw new Error('Choose an existing inventory item.');
  const type=String(fields.type??''); const quantity=requireAmount(fields.quantity,{label:'Quantity'}); const date=requireDate(fields.date,'Movement date');
  const {fromState,toState}=movementStates(type,fields);
  if(fields.customerId && !state.customers?.some(customer=>customer.id===fields.customerId)) throw new Error('The selected customer does not exist.');
  if(toState==='installed'&&fields.customerId===undefined) fields={...fields,customerId:''};
  const assignedCustomer=fields.customerId?state.customers?.find(customer=>customer.id===fields.customerId):null;
  const movement={id:makeId(),itemId:item.id,date,type,quantity,fromState,toState,customerId:fields.customerId||'',customerNumberSnapshot:assignedCustomer?.customerNumber??null,customerNameSnapshot:assignedCustomer?.name??'',notes:requireText(fields.notes??'',1000,'Notes',false),createdAt:new Date(referenceDate).toISOString()};
  const candidate=[...(state.inventoryMovements??[]),movement];
  // Backdated movements are accepted only when the complete dated trail remains physically possible.
  const balances=Object.fromEntries(INVENTORY_STATES.map(status=>[status,0]));
  for(const entry of orderMovements(candidate.filter(row=>row.itemId===item.id))) {
    applyToBalances(balances,entry);
    if(INVENTORY_STATES.some(status=>balances[status]<-0.000001)) throw new Error(`Insufficient ${entry.fromState??'source'} stock on ${entry.date}; correct the movement trail first.`);
  }
  return {...state,inventoryMovements:candidate};
}
export function deleteStockMovement(state,movementId) {
  const movements=state.inventoryMovements??[]; if(!movements.some(row=>row.id===movementId)) throw new Error('Stock movement not found.');
  const next={...state,inventoryMovements:movements.filter(row=>row.id!==movementId)};
  const ids=new Set(next.inventoryItems?.map(item=>item.id)??[]);
  for(const id of ids) { const balance=inventoryBalances(id,next); if(INVENTORY_STATES.some(status=>balance[status]<-0.000001)) throw new Error('This movement cannot be deleted because later recorded movements depend on it. Correct the trail instead.'); }
  return next;
}
export function inventorySummary(state) {
  const items=state.inventoryItems??[], movements=state.inventoryMovements??[];
  const groups=Object.fromEntries(INVENTORY_CATEGORIES.map(category=>[category,{category,available:0,installed:0,damaged:0,returned:0,itemCount:0}]));
  let availableValueCents=0,missingCostItems=0,lowStockItems=0,totalAvailable=0;
  const rows=items.map(item=>{ const balance=inventoryBalances(item.id,state); const hasMovements=movements.some(movement=>movement.itemId===item.id); const available=Math.max(0,balance.available); const unitCost=nonblank(item.unitCost)?Number(item.unitCost):null;
    totalAvailable+=available; if(groups[item.category]) { const group=groups[item.category]; group.available+=available; group.installed+=Math.max(0,balance.installed); group.damaged+=Math.max(0,balance.damaged); group.returned+=Math.max(0,balance.returned); group.itemCount++; }
    if(hasMovements&&Number(item.minimumStock)>0&&available<=Number(item.minimumStock)) lowStockItems++;
    if(unitCost===null) missingCostItems++; else availableValueCents+=cents(unitCost*available);
    return {...item,available,hasMovements,installed:Math.max(0,balance.installed),damaged:Math.max(0,balance.damaged),returned:Math.max(0,balance.returned),value:unitCost===null?null:money(cents(unitCost*available))};
  });
  return {hasItemDefinitions:items.length>0,hasMovements:movements.length>0,itemCount:items.length,totalAvailable,
    onuStock:groups.ONU.available,routerStock:groups.Router.available,fiberCable:groups['Fiber cable'].available,connectors:groups.Connector.available,adaptersPowerSupplies:groups['Adapter / power supply'].available,
    installed:rows.reduce((sum,row)=>sum+row.installed,0),damaged:rows.reduce((sum,row)=>sum+row.damaged,0),returned:rows.reduce((sum,row)=>sum+row.returned,0),lowStockItems,availableValue:money(availableValueCents),missingCostItems,groups:Object.values(groups),items:rows,
    movements:orderMovements(movements).reverse().map(movement=>({...movement,itemName:items.find(item=>item.id===movement.itemId)?.name??'Unknown item',unit:items.find(item=>item.id===movement.itemId)?.unit??''}))};
}

export function addExpense(state,fields,referenceDate=new Date()) {
  const date=requireDate(fields.date,'Payment date'); const category=EXPENSE_CATEGORIES.includes(fields.category)?fields.category:(()=>{throw new Error('Choose a valid expense category.');})();
  const amount=requireAmount(fields.amount,{label:'Expense amount'}); const notes=requireText(fields.notes??'',1000,'Notes',false);
  const expense={id:makeId(),date,amount,category,notes,createdAt:new Date(referenceDate).toISOString()};
  return {...state,expenses:[...(state.expenses??[]),expense]};
}
export function updateExpense(state,expenseId,fields,referenceDate=new Date()) {
  const entries=state.expenses??[]; if(!entries.some(row=>row.id===expenseId)) throw new Error('Expense entry not found.');
  const next=entries.map(row=>row.id!==expenseId?row:{...row,
    date:Object.hasOwn(fields,'date')?requireDate(fields.date,'Payment date'):row.date,
    category:Object.hasOwn(fields,'category')?(EXPENSE_CATEGORIES.includes(fields.category)?fields.category:(()=>{throw new Error('Choose a valid expense category.');})()):row.category,
    amount:Object.hasOwn(fields,'amount')?requireAmount(fields.amount,{label:'Expense amount'}):row.amount,
    notes:Object.hasOwn(fields,'notes')?requireText(fields.notes,1000,'Notes',false):row.notes,updatedAt:new Date(referenceDate).toISOString()});
  return {...state,expenses:next};
}
export function deleteExpense(state,expenseId) { const entries=state.expenses??[]; if(!entries.some(row=>row.id===expenseId)) throw new Error('Expense entry not found.'); return {...state,expenses:entries.filter(row=>row.id!==expenseId)}; }

function addUniquePayrollDate(state,key,value,label) {
  const date=requireDate(value,label),entries=state[key]??[];
  if(entries.includes(date)) return state;
  return {...state,[key]:[...entries,date].sort()};
}
function removePayrollDate(state,key,value,label) {
  const date=requireDate(value,label),entries=state[key]??[];
  if(!entries.includes(date)) throw new Error(`${label} entry not found.`);
  return {...state,[key]:entries.filter(entry=>entry!==date)};
}
export function addSaadAttendanceDay(state,date) { return addUniquePayrollDate(state,'saadAttendanceDays',date,'Attendance date'); }
export function removeSaadAttendanceDay(state,date) { return removePayrollDate(state,'saadAttendanceDays',date,'Attendance'); }
export function addUmairWorkday(state,date) { return addUniquePayrollDate(state,'umairWorkdays',date,'Work date'); }
export function removeUmairWorkday(state,date) { return removePayrollDate(state,'umairWorkdays',date,'Workday'); }
export function buildManualPayrollSummary(state,month) {
  requireMonth(month);
  const attendanceDays=[...new Set((state.saadAttendanceDays??[]).filter(date=>monthOf(date)===month))].sort();
  const umairWorkdays=[...new Set((state.umairWorkdays??[]).filter(date=>monthOf(date)===month))].sort();
  return {month,attendanceDays,attendanceDayCount:attendanceDays.length,umairWorkdays,umairWorkdayCount:umairWorkdays.length,
    umairMonthlyExpense:umairWorkdays.length*UMAIR_PER_LOGGED_WORKDAY};
}

function normalizedText(value) { return String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim(); }
function comparisonKey(value) { return normalizedText(value).toLowerCase().normalize('NFKC'); }
function readableLabel(value) {
  const readableWord=word=>{
    const letters=word.match(/\p{L}/gu)??[];
    if(letters.length>=2&&letters.length<=3&&letters.every(letter=>letter===letter.toLocaleUpperCase('en-US')))return word;
    const chars=Array.from(word); if(!chars.length)return word;
    return chars[0].toLocaleUpperCase('en-US')+chars.slice(1).join('').toLocaleLowerCase('en-US');
  };
  return normalizedText(value).split(' ').map(word=>word.split(/([-–—/])/u).map(part=>/^[-–—/]$/u.test(part)?part:readableWord(part)).join('')).join(' ');
}
function canonicalLocation(value) {
  const text=normalizedText(value); return text?{key:comparisonKey(text),label:readableLabel(text)}:null;
}
export function canonicalPackage(value) {
  const text=normalizedText(value); if(!text)return null;
  const speed=text.match(/^(5|10|15|30)\s*mbps$/iu);
  return speed?{key:`${speed[1]}mbps`,label:`${speed[1]} Mbps`}:{key:comparisonKey(text),label:readableLabel(text)};
}
function subscriptionExclusionReason(customer,onDate) {
  const date=typeof onDate==='string'?onDate:pktDate(onDate),month=monthOf(date);
  if(customer.archived===true)return 'archived';
  if(customer.cancellationDate&&customer.cancellationDate<=date)return 'cancelled';
  if(customer.expiryDate&&customer.expiryDate<date)return 'expired';
  if(customer.connectionDate&&customer.connectionDate>date)return 'notYetEffective';
  if(MONTH_RE.test(String(customer.billingStartMonth??''))&&customer.billingStartMonth>month)return 'notYetEffective';
  if(!canonicalPackage(customer.packageSpeed))return 'packageNotSet';
  if(priceForMonth(customer,month)===null) {
    const futureRate=(customer.monthlyPriceSchedule??[]).some(entry=>MONTH_RE.test(String(entry.effectiveMonth??''))&&entry.effectiveMonth>month&&Number.isFinite(Number(entry.amount))&&Number(entry.amount)>0);
    return futureRate?'notYetEffective':'priceNotSet';
  }
  return null;
}
export function isActiveSubscription(customer,onDate) { return subscriptionExclusionReason(customer,onDate)===null; }
export function areaLabel(customer) {
  const area=canonicalLocation(customer.area)||canonicalLocation(customer.mohalla);
  return area?`Area: ${area.label}`:'Area not set';
}
function uniqueCustomerRows(customers) {
  const seen=new Set();
  return customers.filter((customer,index)=>{
    const key=customer?.id!==undefined&&customer?.id!==null&&String(customer.id)!==''?`id:${customer.id}`:customer?.customerNumber!==undefined?`number:${customer.customerNumber}`:`row:${index}`;
    if(seen.has(key))return false; seen.add(key); return true;
  });
}
function billRevision(bill) {
  const correction=[...(bill.amountHistory??[])].map(entry=>String(entry.changedAt??'')).sort().at(-1)??'';
  return [String(bill.updatedAt??''),correction,String(bill.createdAt??'')].sort().at(-1)??'';
}
function uniqueBillsForCustomer(customer) {
  const byMonth=new Map();
  for(const [index,bill] of (customer.bills??[]).entries()) {
    const key=MONTH_RE.test(String(bill.month??''))?`month:${bill.month}`:`row:${bill.id??index}`;
    const current=byMonth.get(key),revision=billRevision(bill);
    if(!current||revision>current.revision||(revision===current.revision&&String(bill.id??'').localeCompare(String(current.bill.id??''))>0))byMonth.set(key,{bill,revision});
  }
  return [...byMonth.values()].map(entry=>entry.bill);
}
function paymentEntries(state) { return allBills(state).flatMap(({customer,bill})=>(bill.payments??[]).map(payment=>({customer,bill,payment}))); }
function allBills(state) { return uniqueCustomerRows(state.customers??[]).flatMap(customer=>uniqueBillsForCustomer(customer).map(bill=>({customer,bill}))); }
function dateThrough(referenceDate,month) { const end=monthEnd(month); const today=pktDate(referenceDate); return end>today?today:end; }
export function outstandingAtMonthEnd(state,month,referenceDate=new Date()) {
  const cutoff=dateThrough(referenceDate,month); let totalCents=0,billCount=0; const byCustomer=new Map();
  for(const customer of uniqueCustomerRows(state.customers??[])) {
    const bills=uniqueBillsForCustomer(customer).filter(bill=>MONTH_RE.test(bill.month)&&bill.month<=month).sort((a,b)=>a.month.localeCompare(b.month));
    let pendingCredit=0,customerCents=0;
    for(const bill of bills) {
      const due=Number(bill.dueAmount); if(!Number.isFinite(due)||due<=0) continue; billCount++;
      let remaining=cents(due); const credit=Math.min(remaining,pendingCredit); remaining-=credit; pendingCredit-=credit;
      const payments=[...(bill.payments??[])].filter(payment=>validDate(payment.date)&&payment.date<=cutoff).sort((a,b)=>a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id)));
      for(const payment of payments) { const value=cents(payment.amount); const applied=Math.min(value,remaining); remaining-=applied; pendingCredit+=value-applied; }
      customerCents+=remaining;
    }
    totalCents+=customerCents; byCustomer.set(customer.id,money(customerCents));
  }
  return {total:money(totalCents),byCustomer,cutoff,month,partial:month===pktMonth(referenceDate),billCount};
}
function priceForMonth(customer,month) {
  const schedule=(customer.monthlyPriceSchedule??[]).filter(entry=>typeof entry.effectiveMonth==='string'&&entry.effectiveMonth<=month).sort((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth));
  const allSchedule=customer.monthlyPriceSchedule??[];
  const amount=schedule.at(-1)?.amount??(allSchedule.length?null:customer.monthlySellingAmount);
  return nonblank(amount)&&Number.isFinite(Number(amount))&&Number(amount)>0?Number(amount):null;
}
function hasSubscriptionInMonth(customer,month) {
  const start=`${month}-01`,end=monthEnd(month);
  if(customer.archived&&String(customer.archivedAt??'').slice(0,10)<=end) return false;
  if(customer.connectionDate&&customer.connectionDate>end) return false;
  if(customer.expiryDate&&customer.expiryDate<start) return false;
  if(customer.cancellationDate&&customer.cancellationDate<=end) return false;
  return priceForMonth(customer,month)!==null;
}
function serviceRevenueByCustomerMonth(state,month) {
  const map=new Map(); for(const {customer,bill} of allBills(state)) if(bill.month===month&&nonblank(bill.dueAmount)&&Number.isFinite(Number(bill.dueAmount))&&Number(bill.dueAmount)>0) map.set(customer.id,money(cents(bill.dueAmount))); return map;
}
function churnDate(customer) { return customer.cancellationDate || (customer.archived===true ? String(customer.archivedAt??'').slice(0,10) : ''); }
function countDate(rows,field,month) { return rows.filter(row=>monthOf(row[field])===month).length; }
function actualCashByMonth(state,month) { return paymentEntries(state).filter(({payment})=>monthOf(payment.date)===month).reduce((sum,row)=>sum+Number(row.payment.amount||0),0); }
function validIncidentMonth(incident) { return typeof incident.reportedAt==='string'?incident.reportedAt.slice(0,7):''; }

function locationPath(customer) {
  const explicitArea=canonicalLocation(customer.area),mohalla=canonicalLocation(customer.mohalla),area=explicitArea??mohalla;
  const separateMohalla=explicitArea&&mohalla&&explicitArea.key!==mohalla.key?mohalla:null;
  return {area,separateMohalla,zone:canonicalLocation(customer.zone)};
}
function newSummaryGroup(label,key,level,parentArea='',depth=0) {
  return {area:label,key,level,parentArea,depth,customerCount:0,activeCustomers:0,online:0,offline:0,notSet:0,billedRevenueCents:0,outstandingCents:0,complaints:0,newConnections:0,hasBilledRevenue:false,hasBillHistory:false};
}
function addSummaryCustomer(group,customer,active,revenueMap,outstanding,billHistoryCustomerIds,currentMonth) {
  group.customerCount++; if(active)group.activeCustomers++;
  if(!customer.archived&&customer.serviceStatus==='active')group.online++; else if(!customer.archived&&customer.serviceStatus==='offline')group.offline++; else if(!customer.archived)group.notSet++;
  if(revenueMap.has(customer.id)){group.billedRevenueCents+=cents(revenueMap.get(customer.id));group.hasBilledRevenue=true;}
  const due=outstanding.byCustomer.get(customer.id)??0; group.outstandingCents+=cents(due);
  if(billHistoryCustomerIds.has(customer.id))group.hasBillHistory=true;
  group.complaints+=(customer.incidents??[]).length;
  if(monthOf(customer.connectionDate)===currentMonth)group.newConnections++;
}
function finalizeSummaryGroup(group,includedInAreaRollup=false) {
  const billedRevenue=money(group.billedRevenueCents),outstandingAmount=money(group.outstandingCents);
  return {...group,billedRevenue,outstanding:outstandingAmount,excludedSubscriptions:group.customerCount-group.activeCustomers,
    onlineDenominator:group.online+group.offline,onlinePercent:group.online+group.offline?Number((group.online/(group.online+group.offline)*100).toFixed(1)):null,
    hasBilledRevenue:group.hasBilledRevenue===true,hasBillHistory:group.hasBillHistory===true,
    arpu:group.activeCustomers&&group.hasBilledRevenue?money(Math.round(group.billedRevenueCents/group.activeCustomers)):null,includedInAreaRollup};
}
function sortedGroups(map) { return [...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value); }

export function buildPhase3Analytics(state,referenceDate=new Date()) {
  const currentMonth=pktMonth(referenceDate),months=sixMonths(referenceDate),today=pktDate(referenceDate);
  const customerRows=uniqueCustomerRows(state.customers??[]),bills=allBills(state),payments=paymentEntries(state),expenses=state.expenses??[],incidents=customerRows.flatMap(customer=>(customer.incidents??[]).map(incident=>({customer,incident}))),areas=new Map();
  const billHistoryCustomerIds=new Set(bills.filter(({bill})=>bill.month<=currentMonth&&nonblank(bill.dueAmount)&&Number.isFinite(Number(bill.dueAmount))&&Number(bill.dueAmount)>0).map(({customer})=>customer.id));
  const revenueMap=serviceRevenueByCustomerMonth({customers:customerRows},currentMonth),outstanding=outstandingAtMonthEnd({customers:customerRows},currentMonth,referenceDate);
  const exclusionCounts={archived:0,cancelled:0,expired:0,notYetEffective:0,packageNotSet:0,priceNotSet:0};
  let activeConfiguredSubscriptions=0;
  const packageMap=new Map();
  const getPackage=customer=>{
    const canonical=canonicalPackage(customer.packageSpeed),key=canonical?.key??'__package_not_set__';
    if(!packageMap.has(key))packageMap.set(key,{package:canonical?.label??'Package not set',packageKey:key,customers:0,activeCustomers:0,excludedSubscriptions:0,billedRevenueCents:0,outstandingCents:0,newSubscriptions:0,expired:0,churn:0,hasBilledRevenue:false,hasBillHistory:false,exclusionCounts:{}});
    return packageMap.get(key);
  };
  for(const customer of customerRows) {
    const reason=subscriptionExclusionReason(customer,today),active=reason===null;
    if(active)activeConfiguredSubscriptions++; else exclusionCounts[reason]=(exclusionCounts[reason]??0)+1;
    const packageGroup=getPackage(customer); packageGroup.customers++; if(active)packageGroup.activeCustomers++;
    else {packageGroup.excludedSubscriptions++;packageGroup.exclusionCounts[reason]=(packageGroup.exclusionCounts[reason]??0)+1;}
    if(revenueMap.has(customer.id)){packageGroup.billedRevenueCents+=cents(revenueMap.get(customer.id));packageGroup.hasBilledRevenue=true;}
    packageGroup.outstandingCents+=cents(outstanding.byCustomer.get(customer.id)??0);
    if(billHistoryCustomerIds.has(customer.id))packageGroup.hasBillHistory=true;
    if(monthOf(customer.connectionDate)===currentMonth)packageGroup.newSubscriptions++;
    if(monthOf(customer.expiryDate)===currentMonth)packageGroup.expired++;
    if(monthOf(churnDate(customer))===currentMonth)packageGroup.churn++;

    const path=locationPath(customer);
    if(!path.area)continue;
    if(!areas.has(path.area.key))areas.set(path.area.key,{summary:newSummaryGroup(`Area: ${path.area.label}`,path.area.key,'area'),zones:new Map(),mohallas:new Map()});
    const area=areas.get(path.area.key); addSummaryCustomer(area.summary,customer,active,revenueMap,outstanding,billHistoryCustomerIds,currentMonth);
    let zoneMap=area.zones,zoneParent=area.summary.area,depth=1;
    if(path.separateMohalla) {
      if(!area.mohallas.has(path.separateMohalla.key))area.mohallas.set(path.separateMohalla.key,{summary:newSummaryGroup(`Mohalla: ${path.separateMohalla.label}`,path.separateMohalla.key,'mohalla',area.summary.area,1),zones:new Map()});
      const mohallaGroup=area.mohallas.get(path.separateMohalla.key); addSummaryCustomer(mohallaGroup.summary,customer,active,revenueMap,outstanding,billHistoryCustomerIds,currentMonth);
      zoneMap=mohallaGroup.zones; zoneParent=mohallaGroup.summary.area; depth=2;
    }
    const zoneKey=path.zone?.key??'__zone_not_set__';
    if(!zoneMap.has(zoneKey))zoneMap.set(zoneKey,newSummaryGroup(path.zone?`Zone: ${path.zone.label}`:'Zone not set',zoneKey,'zone',zoneParent,depth));
    addSummaryCustomer(zoneMap.get(zoneKey),customer,active,revenueMap,outstanding,billHistoryCustomerIds,currentMonth);
  }
  const areaRows=[];
  for(const area of sortedGroups(areas)) {
    areaRows.push(finalizeSummaryGroup(area.summary));
    for(const zone of sortedGroups(area.zones))areaRows.push(finalizeSummaryGroup(zone,true));
    for(const mohalla of sortedGroups(area.mohallas)) {
      areaRows.push(finalizeSummaryGroup(mohalla.summary,true));
      for(const zone of sortedGroups(mohalla.zones))areaRows.push(finalizeSummaryGroup(zone,true));
    }
  }
  const packageRows=[...packageMap.values()].sort((a,b)=>a.packageKey==='__package_not_set__'?1:b.packageKey==='__package_not_set__'?-1:a.packageKey.localeCompare(b.packageKey)).map(row=>{
    const billedRevenue=money(row.billedRevenueCents),outstandingAmount=money(row.outstandingCents);
    return {...row,billedRevenue,outstanding:outstandingAmount,hasBilledRevenue:row.hasBilledRevenue===true,hasBillHistory:row.hasBillHistory===true,
      arpu:row.activeCustomers&&row.hasBilledRevenue?money(Math.round(row.billedRevenueCents/row.activeCustomers)):null};
  });
  const unassignedProfiles=customerRows.filter(customer=>!locationPath(customer).area),unassignedArea={profiles:unassignedProfiles.length,
    activeConfiguredSubscriptions:unassignedProfiles.filter(customer=>subscriptionExclusionReason(customer,today)===null).length,
    withZone:unassignedProfiles.filter(customer=>!!canonicalLocation(customer.zone)).length,withoutZone:unassignedProfiles.filter(customer=>!canonicalLocation(customer.zone)).length,
    namedAreaProfilesWithoutZone:customerRows.filter(customer=>locationPath(customer).area&&!canonicalLocation(customer.zone)).length};
  const currentBilledRevenueCents=[...revenueMap.values()].reduce((sum,amount)=>sum+cents(amount),0);
  const currentServiceMonthArpu={billedRevenue:revenueMap.size?money(currentBilledRevenueCents):null,billSnapshotCount:revenueMap.size,
    activeSubscriptions:activeConfiguredSubscriptions,excludedSubscriptions:customerRows.length-activeConfiguredSubscriptions,excludedByReason:exclusionCounts,
    arpu:activeConfiguredSubscriptions&&revenueMap.size?money(Math.round(currentBilledRevenueCents/activeConfiguredSubscriptions)):null};

  const revenueCollection=months.map(month=>{const matchingBills=bills.filter(({bill})=>bill.month===month&&nonblank(bill.dueAmount)&&Number(bill.dueAmount)>0);const matchingPayments=payments.filter(({payment})=>monthOf(payment.date)===month);return {month,billedRevenue:matchingBills.length?matchingBills.reduce((sum,row)=>sum+Number(row.bill.dueAmount),0):null,cashCollection:matchingPayments.length?matchingPayments.reduce((sum,row)=>sum+Number(row.payment.amount||0),0):null,billCount:matchingBills.length,receiptCount:matchingPayments.length};});
  const incomeExpense=months.map(month=>{const matchingPayments=payments.filter(({payment})=>monthOf(payment.date)===month);const matchingExpenses=expenses.filter(row=>monthOf(row.date)===month);return {month,income:matchingPayments.length?matchingPayments.reduce((sum,row)=>sum+Number(row.payment.amount||0),0):null,expenses:matchingExpenses.length?matchingExpenses.reduce((sum,row)=>sum+Number(row.amount||0),0):null,incomeCount:matchingPayments.length,expenseCount:matchingExpenses.length};});
  const monthEndOutstanding=months.map(month=>({...outstandingAtMonthEnd(state,month,referenceDate),month}));
  const growth=months.map(month=>{const end=month===currentMonth?today:monthEnd(month);const matching=customerRows.filter(customer=>monthOf(customer.connectionDate)===month);const newConnections=matching.length?matching.length:null;const knownDated=customerRows.filter(customer=>customer.connectionDate&&customer.connectionDate<=end);const cumulativeKnownActive=knownDated.length?knownDated.filter(customer=>{const ended=churnDate(customer);return !ended||ended>end;}).filter(customer=>!customer.expiryDate||customer.expiryDate>=end).length:null;return {month,newConnections,cumulativeKnownActive};});
  const onlineCount=customerRows.filter(customer=>!customer.archived&&customer.serviceStatus==='active').length,offlineCount=customerRows.filter(customer=>!customer.archived&&customer.serviceStatus==='offline').length,notSetCount=customerRows.filter(customer=>!customer.archived&&!['active','offline'].includes(customer.serviceStatus)).length;
  const knownUndated=customerRows.filter(customer=>!customer.connectionDate).length;
  const targetMonth=addMonths(currentMonth,1),targetStart=`${targetMonth}-01`;
  let forecastCents=0,forecastCustomers=0,forecastMissingPrice=0;
  for(const customer of customerRows) {
    if(customer.archived||customer.cancellationDate&&customer.cancellationDate<=targetStart||customer.connectionDate&&customer.connectionDate>targetStart||customer.expiryDate&&customer.expiryDate<targetStart) continue;
    const price=priceForMonth(customer,targetMonth); if(price===null){forecastMissingPrice++;continue;} forecastCents+=cents(price);forecastCustomers++;
  }
  const lastSixIncidents=incidents.filter(({incident})=>months.includes(validIncidentMonth(incident)));
  const networkIssues=months.map(month=>({month,count:lastSixIncidents.filter(({incident})=>validIncidentMonth(incident)===month).length}));
  return {currentMonth,currentMonthPartial:true,months,asOf:today,areaRows,packageRows,unassignedArea,currentServiceMonthArpu,
    revenueCollection,hasRevenueRecords:revenueCollection.some(row=>row.billCount>0||row.receiptCount>0),incomeExpense,hasIncomeRecords:incomeExpense.some(row=>row.incomeCount>0),hasExpenseRecords:incomeExpense.some(row=>row.expenseCount>0),monthEndOutstanding,
    growth,hasConnectionDates:customerRows.some(customer=>validDate(customer.connectionDate)),knownUndatedConnections:knownUndated,growthCumulativeIsPartial:knownUndated>0,onlineOffline:{online:onlineCount,offline:offlineCount,notSet:notSetCount,denominator:onlineCount+offlineCount,onlinePercent:onlineCount+offlineCount?Number((onlineCount/(onlineCount+offlineCount)*100).toFixed(1)):null},
    forecast:{month:targetMonth,amount:money(forecastCents),customersIncluded:forecastCustomers,missingPrice:forecastMissingPrice},networkIssues,incidentCount:incidents.length,
    totalBills:bills.filter(({bill})=>nonblank(bill.dueAmount)&&Number(bill.dueAmount)>0).length,totalPayments:payments.length,totalExpenses:expenses.length,
    currentBilledRevenue:revenueMap.size?money(currentBilledRevenueCents):0,currentOutstanding:outstanding.total};
}

function rangeMonths(startDate,endDate) {
  const start=requireDate(startDate,'Start date'),end=requireDate(endDate,'End date');
  if(start>end)throw new Error('Start date must be on or before the end date.');
  return {start,end,startMonth:monthOf(start),endMonth:monthOf(end)};
}
function dateWithin(value,start,end) { return validDate(value)&&value>=start&&value<=end; }
function areaDescriptors(path,includeUnspecifiedZone=true) {
  const output=[];
  if(!path.area)return[{id:'unassigned',area:'Area not set',key:'__area_not_set__',rootArea:'Area not set',level:'unassigned',parentArea:'',depth:0}];
  const areaId=`area:${path.area.key}`,areaLabelText=`Area: ${path.area.label}`;
  output.push({id:areaId,area:areaLabelText,key:path.area.key,rootArea:areaLabelText,level:'area',parentArea:'',depth:0});
  let parentId=areaId,parentLabel=areaLabelText,depth=1;
  if(path.separateMohalla) {
    parentId=`mohalla:${path.area.key}:${path.separateMohalla.key}`;parentLabel=`Mohalla: ${path.separateMohalla.label}`;
    output.push({id:parentId,area:parentLabel,key:path.separateMohalla.key,rootArea:areaLabelText,level:'mohalla',parentArea:areaLabelText,depth:1});depth=2;
  }
  if(path.zone||includeUnspecifiedZone) {
    const zoneKey=path.zone?.key??'__zone_not_set__',zoneLabel=path.zone?`Zone: ${path.zone.label}`:'Zone not set';
    output.push({id:`zone:${parentId}:${zoneKey}`,area:zoneLabel,key:zoneKey,rootArea:areaLabelText,level:'zone',parentArea:parentLabel,depth});
  }
  return output;
}
function packageLabelForSavedBill(customer,bill,currentMonth) {
  const saved=String(bill?.packageSnapshot?.label??'').trim();
  if(saved)return canonicalPackage(saved)?.label??readableLabel(saved);
  const history=(customer.packageHistory??[]).filter(row=>validDate(row.date)&&row.date.slice(0,7)<=bill.month).sort((a,b)=>b.date.localeCompare(a.date));
  if(history.length&&String(history[0].newPackage??'').trim())return canonicalPackage(history[0].newPackage)?.label??readableLabel(history[0].newPackage);
  if(bill.month===currentMonth&&String(customer.packageSpeed??'').trim())return canonicalPackage(customer.packageSpeed)?.label??readableLabel(customer.packageSpeed);
  return null;
}

/** Build date-filtered area/zone figures. Historical groupings use today's saved location assignment because location history is not stored. */
export function buildAreaIntelligence(state,{startDate,endDate},referenceDate=new Date()) {
  const range=rangeMonths(startDate,endDate),today=pktDate(referenceDate);
  if(range.end>today)throw new Error('End date cannot be later than today in Pakistan time.');
  const customers=uniqueCustomerRows(state.customers??[]),customerById=new Map(customers.map(customer=>[customer.id,customer])),groups=new Map(),customerGroupIds=new Map();
  const ensureGroup=descriptor=>{
    if(!groups.has(descriptor.id))groups.set(descriptor.id,{...descriptor,customerIds:new Set(),billedCents:0,billCount:0,billedCustomerIds:new Set(),collectedCents:0,receiptCount:0,outstandingCents:0,outstandingBillCount:0,expenseCents:0,expenseCount:0});
    return groups.get(descriptor.id);
  };
  for(const customer of customers) {
    const descriptors=areaDescriptors(locationPath(customer)),ids=[];
    for(const descriptor of descriptors){const group=ensureGroup(descriptor);group.customerIds.add(customer.id);ids.push(group.id);}
    customerGroupIds.set(customer.id,ids);
  }
  const bills=allBills({customers}),billHistoryByCustomer=new Map();
  for(const {customer,bill} of bills) {
    if(!MONTH_RE.test(String(bill.month??'')))continue;
    if(bill.month<=range.endMonth&&nonblank(bill.dueAmount)&&Number.isFinite(Number(bill.dueAmount))&&Number(bill.dueAmount)>0)billHistoryByCustomer.set(customer.id,(billHistoryByCustomer.get(customer.id)??0)+1);
    if(bill.month<range.startMonth||bill.month>range.endMonth||!nonblank(bill.dueAmount)||!Number.isFinite(Number(bill.dueAmount))||Number(bill.dueAmount)<=0)continue;
    for(const id of customerGroupIds.get(customer.id)??[]){const group=groups.get(id);group.billedCents+=cents(bill.dueAmount);group.billCount++;group.billedCustomerIds.add(customer.id);}
  }
  const cutoff=new Date(`${range.end}T23:59:59+05:00`),outstanding=outstandingAtMonthEnd({customers},range.endMonth,cutoff);
  for(const group of groups.values())for(const customerId of group.customerIds){group.outstandingCents+=cents(outstanding.byCustomer.get(customerId)??0);group.outstandingBillCount+=billHistoryByCustomer.get(customerId)??0;}
  for(const {customer,payment} of paymentEntries({customers}))if(dateWithin(payment.date,range.start,range.end)) {
    for(const id of customerGroupIds.get(customer.id)??[]){const group=groups.get(id);group.collectedCents+=cents(payment.amount);group.receiptCount++;}
  }
  const expenses=(state.expenses??[]).filter(expense=>dateWithin(expense.date,range.start,range.end));
  const locationExpenses=expenses.filter(expense=>canonicalLocation(expense.area)||canonicalLocation(expense.mohalla)||canonicalLocation(expense.zone));
  const unallocatedExpenseCount=expenses.length-locationExpenses.length;
  for(const expense of locationExpenses) {
    const path=locationPath(expense),descriptors=areaDescriptors(path,false);
    for(const descriptor of descriptors){const group=groups.get(descriptor.id);if(!group)continue;group.expenseCents+=cents(expense.amount);group.expenseCount++;}
  }
  const currentRosterStatus=range.end===today;
  const rows=[...groups.values()].map(group=>{
    const billedAmount=group.billCount?money(group.billedCents):null;
    const collectedAmount=group.receiptCount||group.billCount||locationExpenses.length?money(group.collectedCents):null;
    const outstandingAmount=group.outstandingBillCount?money(group.outstandingCents):null;
    const expensesAvailable=group.expenseCount>0,areaExpenses=expensesAvailable?money(group.expenseCents):null;
    const customerValue=group.billedCustomerIds.size?money(Math.round(group.billedCents/group.billedCustomerIds.size)):null;
    const activeCustomers=currentRosterStatus?[...group.customerIds].filter(id=>{const customer=customerById.get(id);return customer&&!customer.archived&&customer.serviceStatus==='active';}).length:null;
    const estimatedProfit=expensesAvailable&&collectedAmount!==null?money(cents(collectedAmount)-cents(areaExpenses)):null;
    return {...group,customerIds:undefined,billedCustomerIds:undefined,
      totalCustomers:group.customerIds.size,activeCustomers,activeCustomerSource:currentRosterStatus?`current manual status as of ${today}`:'not captured for this historical date',
      billedAmount,collectedAmount,outstanding:outstandingAmount,collectionRate:group.billedCents?Number((group.collectedCents/group.billedCents*100).toFixed(1)):null,
      averageCustomerValue:customerValue,expenses:areaExpenses,estimatedProfit,
      expensesSource:expensesAvailable?'Only expenses with an explicit saved area/mohalla/zone tag; unallocated business expenses are excluded.':locationExpenses.length?'No explicitly tagged expense entry for this area/zone in the selected range.':'Not recorded for an area/zone; whole-business expenses are not allocated.',
      estimatedProfitBasis:estimatedProfit===null?(locationExpenses.length?'Not estimated: no explicit expense allocation is recorded for this area/zone in the selected range.':'Not estimated because explicit area/zone expense attribution is unavailable.'):'Estimate = receipt-date cash collected − explicitly area/zone-tagged expenses; unallocated whole-business expenses are excluded, so this is not full accounting profit.'};
  }).sort((a,b)=>a.rootArea?.localeCompare(b.rootArea??'')||a.depth-b.depth||a.area.localeCompare(b.area));
  return {startDate:range.start,endDate:range.end,startMonth:range.startMonth,endMonth:range.endMonth,asOf:range.end,
    rows,hasAreaExpenseAttribution:locationExpenses.length>0,locationExpenseCount:locationExpenses.length,unallocatedExpenseCount,
    basis:{customers:'Customer counts use the current saved roster and saved location assignments; historical area/customer snapshots are not available.',activeCustomers:currentRosterStatus?'Current manual Active status, shown as of today; it is not network monitoring.':'Historical area-level active status is unavailable because no dated area/zone status snapshot is stored.',billing:'Positive saved bill snapshots grouped by service month; all bill months touching the selected date range are included in full.',collection:'Actual saved receipts grouped by their payment date within the selected date range.',outstanding:`Reconstructed from saved priced bills due through ${range.endMonth} and receipt dates through ${range.end}; no saved area-level month-close balance snapshot exists.`,collectionRate:'Actual receipt-date collections during the selected date range divided by saved billing for the service months touching that range; may exceed 100%.',averageCustomerValue:'Selected-range saved billing divided by distinct customers with a priced bill in those service months.',expenses:locationExpenses.length?'Only explicit saved area/mohalla/zone expense tags are included; unallocated expenses are not spread across locations.':'No explicitly area/zone-tagged expense entries are recorded in this date range.',profit:'Estimated only when this area/zone has an explicit expense allocation; collection less tagged expenses, with unallocated whole-business expenses excluded.'}};
}

/** Group saved service-month bill snapshots by recorded package labels for a date range. */
export function buildPackageRevenue(state,{startDate,endDate},referenceDate=new Date()) {
  const range=rangeMonths(startDate,endDate),today=pktDate(referenceDate);
  if(range.end>today)throw new Error('End date cannot be later than today in Pakistan time.');
  const currentMonth=pktMonth(referenceDate),groups=new Map();let unrecordedPackageBills=0,pricedBillCount=0;
  for(const {customer,bill} of allBills(state)) {
    if(!MONTH_RE.test(String(bill.month??''))||bill.month<range.startMonth||bill.month>range.endMonth||!nonblank(bill.dueAmount)||!Number.isFinite(Number(bill.dueAmount))||Number(bill.dueAmount)<=0)continue;
    pricedBillCount++;
    const label=packageLabelForSavedBill(customer,bill,currentMonth)??'Package not recorded';
    if(label==='Package not recorded')unrecordedPackageBills++;
    const key=comparisonKey(label);if(!groups.has(key))groups.set(key,{package:label,revenueCents:0,billCount:0,customerIds:new Set()});
    const group=groups.get(key);group.revenueCents+=cents(bill.dueAmount);group.billCount++;group.customerIds.add(customer.id);
  }
  const rows=[...groups.values()].map(row=>({package:row.package,revenue:money(row.revenueCents),billCount:row.billCount,customers:row.customerIds.size}))
    .sort((a,b)=>b.revenue-a.revenue||a.package.localeCompare(b.package));
  return {startDate:range.start,endDate:range.end,startMonth:range.startMonth,endMonth:range.endMonth,rows,pricedBillCount,unrecordedPackageBills,
    basis:'Positive saved bill price snapshots grouped by service month; package labels use a saved bill snapshot or dated package history. Current package settings are not backfilled into older months.'};
}

export function validatePhase3State(source) {
  const itemIds=new Set(),movementIds=new Set(),expenseIds=new Set();
  const validateDateEntries=(entries,label)=>{
    if(!Array.isArray(entries??[]))throw new Error(`Backup ${label} entries must be a list.`);
    return [...new Set((entries??[]).map(date=>requireDate(date,label)))].sort();
  };
  const inventoryItems=(source.inventoryItems??[]).map((item,index)=>{
    if(!item||typeof item.id!=='string'||!item.id||itemIds.has(item.id))throw new Error(`Inventory item ${index+1} has an invalid or duplicate ID.`);itemIds.add(item.id);
    requireText(item.name,100,'Item name'); if(!INVENTORY_CATEGORIES.includes(item.category))throw new Error('Backup contains an invalid inventory category.');requireText(item.unit,24,'Unit of measure');
    requireAmount(item.minimumStock??0,{allowZero:true,label:'Minimum stock'});requireAmount(item.unitCost,{allowZero:true,label:'Acquisition cost'});requireDate(item.createdDate,'Item date'); if(item.updatedDate)requireDate(item.updatedDate,'Item update date');requireText(item.notes??'',1000,'Notes',false);return {...item};
  });
  const inventoryMovements=(source.inventoryMovements??[]).map((movement,index)=>{
    if(!movement||typeof movement.id!=='string'||!movement.id||movementIds.has(movement.id))throw new Error(`Inventory movement ${index+1} has an invalid or duplicate ID.`);movementIds.add(movement.id);
    if(!itemIds.has(movement.itemId))throw new Error('Backup stock movement refers to a missing inventory item.');requireDate(movement.date,'Movement date');requireAmount(movement.quantity,{label:'Quantity'});
    if(!INVENTORY_STATES.includes(movement.toState)&&movement.toState!==null)throw new Error('Backup contains an invalid stock destination.');if(!INVENTORY_STATES.includes(movement.fromState)&&movement.fromState!==null)throw new Error('Backup contains an invalid stock source.');requireText(movement.notes??'',1000,'Notes',false);return {...movement};
  });
  const expenses=(source.expenses??[]).map((expense,index)=>{
    if(!expense||typeof expense.id!=='string'||!expense.id||expenseIds.has(expense.id))throw new Error(`Expense ${index+1} has an invalid or duplicate ID.`);expenseIds.add(expense.id);requireDate(expense.date,'Payment date');requireAmount(expense.amount,{label:'Expense amount'});if(!EXPENSE_CATEGORIES.includes(expense.category))throw new Error('Backup contains an invalid expense category.');requireText(expense.notes??'',1000,'Notes',false);return {...expense};
  });
  const saadAttendanceDays=validateDateEntries(source.saadAttendanceDays,'Attendance date');
  const umairWorkdays=validateDateEntries(source.umairWorkdays,'Work date');
  return {inventoryItems,inventoryMovements,expenses,saadAttendanceDays,umairWorkdays};
}
export const phase3Validation = Object.freeze({validDate,validMonthString:value=>typeof value==='string'&&MONTH_RE.test(value)});
