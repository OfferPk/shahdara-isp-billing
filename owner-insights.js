import { calculatePaymentAllocations, monthsForHistory, summarizeCustomerReceipts, summarizeCustomerTenure } from './core.js';

const cents = value => Math.round(Number(value || 0) * 100);
const amount = value => Number((value / 100).toFixed(2));
const validPrice = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const zonedParts = (date, withDay = false) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Karachi', year:'numeric', month:'2-digit', ...(withDay ? {day:'2-digit'} : {}) }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
const monthFor = date => { const p=zonedParts(date); return `${p.year}-${p.month}`; };
const dateFor = date => { const p=zonedParts(date,true); return `${p.year}-${p.month}-${p.day}`; };
const shiftMonth = (month, delta) => { const [year, n]=month.split('-').map(Number); const index=year*12+n-1+delta; return `${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`; };
const daysBetween = (later, earlier) => /^\d{4}-\d{2}-\d{2}$/.test(later ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(earlier ?? '') ? Math.floor((Date.parse(`${later}T00:00:00Z`)-Date.parse(`${earlier}T00:00:00Z`))/86400000) : null;
const pkr = value => `PKR ${new Intl.NumberFormat('en-PK').format(amount(value))}`;

function pricedBill(customer, bill, allocations) {
  if (!validPrice(bill?.dueAmount)) return null;
  const dueCents=cents(bill.dueAmount), allocation=allocations.forMonth(customer.id,bill.month);
  const balanceCents=Math.max(0,allocation?.balanceDueCents ?? dueCents);
  const payments=(bill.payments ?? []).filter(payment=>Number.isFinite(Number(payment.amount))&&Number(payment.amount)>0);
  const events=[...(allocation?.creditSources ?? []).map(source=>({date:source.paymentDate,cents:Number(source.amountCents)||0})),...payments.map(payment=>({date:payment.date,cents:cents(payment.amount)}))]
    .filter(event=>/^\d{4}-\d{2}-\d{2}$/.test(event.date ?? '')&&event.cents>0).sort((a,b)=>a.date.localeCompare(b.date));
  let funded=0,settlementDate=null;
  for(const event of events){funded+=event.cents;if(funded>=dueCents){settlementDate=event.date;break;}}
  return {customerId:customer.id,month:bill.month,bill,dueCents,balanceCents,payments,settlementDate,dueDate:/^\d{4}-\d{2}-\d{2}$/.test(bill.dueDate ?? '')?bill.dueDate:null};
}

export function buildCustomerPaymentBehavior(state, customerOrId, referenceDate=new Date(), allocations=calculatePaymentAllocations(state)) {
  const customer=typeof customerOrId==='string'?state.customers.find(item=>item.id===customerOrId):customerOrId;
  if(!customer)return null;
  const currentMonth=monthFor(referenceDate);
  const bills=(customer.bills ?? []).map(bill=>pricedBill(customer,bill,allocations)).filter(Boolean).sort((a,b)=>b.month.localeCompare(a.month));
  const receipts=(customer.bills ?? []).flatMap(bill=>(bill.payments ?? []).filter(payment=>Number.isFinite(Number(payment.amount))&&Number(payment.amount)>0).map(payment=>({...payment,month:bill.month,dueDate:/^\d{4}-\d{2}-\d{2}$/.test(bill.dueDate ?? '')?bill.dueDate:null})));
  const receiptCents=receipts.map(row=>cents(row.amount)),totalCents=receiptCents.reduce((sum,x)=>sum+x,0);
  const billedMonths=bills.filter(row=>row.month<=currentMonth),completedBills=billedMonths.filter(row=>row.month<currentMonth).slice(0,6);
  const settledDated=billedMonths.filter(row=>row.dueDate&&row.settlementDate);
  const delays=settledDated.map(row=>Math.max(0,daysBetween(row.settlementDate,row.dueDate)??0));
  const averagePaymentDelayDays=delays.length?Number((delays.reduce((sum,x)=>sum+x,0)/delays.length).toFixed(1)):null;
  const latePaymentCount=receipts.filter(row=>row.dueDate&&row.date>row.dueDate).length;
  const partialPaymentCount=bills.reduce((sum,row)=>sum+row.payments.filter(payment=>cents(payment.amount)<row.dueCents).length,0);
  const lateBillCount=billedMonths.filter(row=>row.dueDate&&(row.settlementDate?row.settlementDate>row.dueDate:row.balanceCents>0&&dateFor(referenceDate)>row.dueDate)).length;
  const monthsWithBills=new Set(billedMonths.map(row=>row.month)).size;
  const consistencySettled=completedBills.filter(row=>row.balanceCents===0).length;
  const paymentConsistency=completedBills.length>=2?Math.round(consistencySettled/completedBills.length*100):null;
  const outstandingCents=bills.reduce((sum,row)=>sum+row.balanceCents,0);
  const currentBill=bills.find(row=>row.month===currentMonth)??null;
  const longestOverdueDays=bills.reduce((max,row)=>row.dueDate&&row.balanceCents>0?Math.max(max,Math.max(0,daysBetween(dateFor(referenceDate),row.dueDate)??0)):max,0);
  const health=scoreCustomer(customer,bills,completedBills,averagePaymentDelayDays,referenceDate);
  return {
    customerId:customer.id,totalPayments:receipts.length,totalPaymentAmount:amount(totalCents),
    averageMonthlyPayment:monthsWithBills?amount(Math.round(totalCents/monthsWithBills)):null,
    averageMonthlyPaymentBasis:monthsWithBills?`${monthsWithBills} saved priced bill month${monthsWithBills===1?'':'s'}`:'No priced bills recorded',
    highestPayment:receiptCents.length?amount(Math.max(...receiptCents)):null,lowestPayment:receiptCents.length?amount(Math.min(...receiptCents)):null,
    latePaymentCount,partialPaymentCount,lateBillCount,averagePaymentDelayDays,delaySampleCount:delays.length,
    paymentConsistency,consistencySettledMonths:consistencySettled,consistencyBillMonths:completedBills.length,
    totalOutstanding:amount(outstandingCents),totalOutstandingCents:outstandingCents,
    currentBill:currentBill?{month:currentBill.month,dueAmount:amount(currentBill.dueCents),balanceDue:amount(currentBill.balanceCents),dueDate:currentBill.dueDate,status:currentBill.balanceCents===0?'Paid':currentBill.balanceCents<currentBill.dueCents?'Partial':'Pending'}:null,
    longestOverdueDays,receipts:receipts.sort((a,b)=>b.date.localeCompare(a.date)),bills,health
  };
}

function scoreCustomer(customer,bills,completedBills,averageDelay,referenceDate) {
  if(completedBills.length<2)return{score:null,category:'Insufficient history',reasons:[`Only ${completedBills.length} completed priced bill month${completedBills.length===1?'':'s'} recorded; at least 2 are needed for a score.`]};
  const currentMonth=monthFor(referenceDate),scoredBills=bills.filter(row=>row.month<=currentMonth);
  const unsettled=completedBills.filter(row=>row.balanceCents>0).length;
  const dated=scoredBills.filter(row=>row.dueDate);
  const late=dated.filter(row=>row.settlementDate?row.settlementDate>row.dueDate:row.balanceCents>0&&dateFor(referenceDate)>row.dueDate).length;
  const owed=scoredBills.reduce((sum,row)=>sum+row.balanceCents,0),billed=scoredBills.reduce((sum,row)=>sum+row.dueCents,0);
  const partial=completedBills.filter(row=>row.payments.length>1||row.payments.some(payment=>cents(payment.amount)<row.dueCents)).length;
  const penalties={regularity:35*unsettled/completedBills.length,overdue:dated.length?20*late/dated.length:0,balance:billed?20*Math.min(1,owed/billed):0,partial:10*partial/completedBills.length,delay:averageDelay===null?0:15*Math.min(1,averageDelay/30)};
  const score=Math.max(0,Math.min(100,Math.round(100-Object.values(penalties).reduce((sum,value)=>sum+value,0))));
  const category=score>=80?'Good':score>=60?'Risk':'Critical';
  const reasons=[
    `Payment regularity: ${completedBills.length-unsettled}/${completedBills.length} recent completed bill months settled (−${Math.round(penalties.regularity)} points).`,
    dated.length?`Due-date history: ${late}/${dated.length} priced bills late or still overdue (−${Math.round(penalties.overdue)} points).`:'No saved due dates; late-history deduction was not applied.',
    billed?`Outstanding: ${pkr(owed)} of ${pkr(billed)} across saved priced bills (−${Math.round(penalties.balance)} points).`:'No priced bills available for an outstanding-balance score.',
    `Partial installments: ${partial}/${completedBills.length} recent completed bill months (−${Math.round(penalties.partial)} points).`,
    averageDelay===null?'Average delay unavailable because no fully settled bill has a recorded due date.':`Average settlement delay: ${averageDelay} days across ${scoredBills.filter(row=>row.dueDate&&row.settlementDate).length} dated settled bills (−${Math.round(penalties.delay)} points).`
  ];
  return{score,category,reasons,penalties:Object.fromEntries(Object.entries(penalties).map(([key,value])=>[key,Math.round(value)])),historyMonths:completedBills.length};
}

export function buildCustomerHealthScore(state,customerOrId,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  return buildCustomerPaymentBehavior(state,customerOrId,referenceDate,allocations)?.health??null;
}

export const CUSTOMER_RANKING_TYPES=Object.freeze([
  {id:'highest-paying',label:'Highest-paying customers'},{id:'most-consistent',label:'Most consistent customers'},
  {id:'longest-standing',label:'Longest-standing customers'},{id:'highest-package',label:'Highest-value package'},
  {id:'highest-outstanding',label:'Highest outstanding'},{id:'longest-overdue',label:'Longest overdue'},{id:'repeat-late',label:'Repeat late payers'},
  {id:'lifetime-value',label:'Lifetime value · actual receipts'}
]);
function serviceAnniversaryDateForYear(month,day,year) {
  const leapYear=year%4===0&&(year%100!==0||year%400===0);
  const adjustedDay=month===2&&day===29&&!leapYear?28:day;
  return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(adjustedDay).padStart(2,'0')}`;
}
/** Derive a local-only milestone from the saved connection date; never infer or persist a date. */
export function buildNextServiceAnniversary(customer,referenceDate=new Date()) {
  if(!customer)return null;
  const tenure=summarizeCustomerTenure(customer,referenceDate);
  if(tenure.status!=='current')return{status:tenure.status,connectionDate:tenure.connectionDate,date:null,years:null,daysUntil:null,endDate:tenure.endDate};
  const asOf=dateFor(referenceDate),[startYear,month,day]=tenure.connectionDate.split('-').map(Number);
  let year=Math.max(startYear+1,Number(asOf.slice(0,4)));
  if(year>9999)return{status:'year-out-of-range',connectionDate:tenure.connectionDate,date:null,years:null,daysUntil:null,endDate:null};
  let date=serviceAnniversaryDateForYear(month,day,year);
  if(date<asOf){year++;if(year>9999)return{status:'year-out-of-range',connectionDate:tenure.connectionDate,date:null,years:null,daysUntil:null,endDate:null};date=serviceAnniversaryDateForYear(month,day,year);}
  const scheduledEndDate=[customer.cancellationDate,customer.expiryDate].filter(value=>isCalendarDate(value)&&value>=asOf).sort()[0]??null;
  if(scheduledEndDate&&date>scheduledEndDate)return{status:'ends-before-anniversary',connectionDate:tenure.connectionDate,date,years:year-startYear,daysUntil:null,endDate:scheduledEndDate};
  return{status:date===asOf?'today':'upcoming',connectionDate:tenure.connectionDate,date,years:year-startYear,daysUntil:daysBetween(date,asOf),endDate:scheduledEndDate};
}
/** Derive local-only lifetime revenue and a clearly qualified 12-month estimate. */
export function buildCustomerLifetimeValue(state,customerOrId,referenceDate=new Date()) {
  const customer=typeof customerOrId==='string'?state.customers.find(item=>item.id===customerOrId):customerOrId;
  if(!customer)return null;
  const asOf=dateFor(referenceDate),currentMonth=asOf.slice(0,7);
  const seenPaymentIds=new Set();
  const historyCustomer={...customer,bills:[...(customer.bills??[])].sort((a,b)=>a.month.localeCompare(b.month)).map(bill=>({...bill,payments:(bill.payments??[]).filter(payment=>{
    if(!isCalendarDate(payment.date)||payment.date>asOf)return false;
    const id=typeof payment.id==='string'?payment.id.trim():'';
    if(id&&seenPaymentIds.has(id))return false;
    if(id)seenPaymentIds.add(id);
    return true;
  })}))};
  const receipts=summarizeCustomerReceipts(historyCustomer);
  const receiptMonths=receipts.monthly.filter(row=>row.month<=currentMonth).length;
  const firstReceiptMonth=receipts.monthly.filter(row=>row.month<=currentMonth).at(-1)?.month??null;
  const monthNumber=month=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
  const observationMonths=firstReceiptMonth?monthNumber(currentMonth)-monthNumber(firstReceiptMonth)+1:0;
  const historicalCents=cents(receipts.total);
  const averageMonthlyRevenueCents=observationMonths?Math.round(historicalCents/observationMonths):null;
  const estimatedFutureCents=receiptMonths>=2&&averageMonthlyRevenueCents!==null?averageMonthlyRevenueCents*12:null;
  const historyState={...state,customers:[historyCustomer]};
  const behavior=buildCustomerPaymentBehavior(historyState,historyCustomer,referenceDate);
  const tenure=summarizeCustomerTenure(customer,referenceDate);
  const nextServiceAnniversary=buildNextServiceAnniversary(customer,referenceDate);
  const averageMonthlyRevenueBasis=observationMonths
    ? `${observationMonths} calendar month${observationMonths===1?'':'s'} from first saved receipt through ${currentMonth}, including months without receipts.`
    : 'No valid historical receipts are recorded.';
  const estimatedFutureValueBasis=estimatedFutureCents===null
    ? receiptMonths===0?'Not estimated: no historical receipts are recorded.':'Not estimated: at least 2 receipt-bearing calendar months are required.'
    : `Estimate only: ${pkr(averageMonthlyRevenueCents)} average monthly receipts × 12 months, based on ${receiptMonths} receipt-bearing month${receiptMonths===1?'':'s'} across ${observationMonths} calendar month${observationMonths===1?'':'s'} through ${currentMonth}; assumes that historical average continues and does not model attrition or future price changes.`;
  return {
    customerId:customer.id,asOf,totalHistoricalRevenue:amount(historicalCents),receiptCount:receipts.receiptCount,
    firstReceiptMonth,receiptMonths,observationMonths,
    averageMonthlyRevenue:averageMonthlyRevenueCents===null?null:amount(averageMonthlyRevenueCents),averageMonthlyRevenueBasis,
    averagePaymentDelayDays:behavior?.averagePaymentDelayDays??null,paymentDelaySampleCount:behavior?.delaySampleCount??0,
    tenure,nextServiceAnniversary,estimatedFutureValue:estimatedFutureCents===null?null:amount(estimatedFutureCents),estimatedFutureValueBasis
  };
}
function packagePriceForMonth(customer,bill,month,referenceDate) {
  if(validPrice(bill?.packageSnapshot?.nominalPrice))return Number(bill.packageSnapshot.nominalPrice);
  const schedule=(customer.monthlyPriceSchedule??[]).filter(row=>row.effectiveMonth<=month&&validPrice(row.amount)).sort((a,b)=>b.effectiveMonth.localeCompare(a.effectiveMonth));
  if(schedule.length)return Number(schedule[0].amount);
  if(month===monthFor(referenceDate)&&validPrice(customer.monthlySellingAmount))return Number(customer.monthlySellingAmount);
  return null;
}
export function buildCustomerRankings(state,{type='highest-paying',month=monthFor(new Date()),area='all',packageName='all',status='all',startDate='',endDate=''}={},referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  if(!CUSTOMER_RANKING_TYPES.some(item=>item.id===type))throw new Error('Choose a supported customer ranking.');
  const current=monthFor(referenceDate),selected=/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month<=current?month:current,rows=[];let excludedCount=0;
  for(const customer of state.customers){
    const areaValue=customer.mohalla?.trim()||customer.zone?.trim()||'Area not recorded',packageValue=customer.packageSpeed?.trim()||'Package not set';
    if(area!=='all'&&areaValue!==area)continue;if(packageName!=='all'&&packageValue!==packageName)continue;
    if(status==='archived'?!customer.archived:status!=='all'&&(customer.archived||(customer.serviceStatus??'not-set')!==status))continue;
    const behavior=buildCustomerPaymentBehavior(state,customer,referenceDate,allocations),bill=(customer.bills??[]).find(row=>row.month===selected);
    const lifetime=type==='lifetime-value'?buildCustomerLifetimeValue(state,customer,referenceDate):null;
    const balance=bill&&validPrice(bill.dueAmount)?allocations.forMonth(customer.id,selected)?.balanceDueCents??cents(bill.dueAmount):null;
    const selectedReceipts=behavior.receipts.filter(payment=>payment.date.slice(0,7)===selected&&(!startDate||payment.date>=startDate)&&(!endDate||payment.date<=endDate));
    const overdueDays=balance>0&&/^\d{4}-\d{2}-\d{2}$/.test(bill?.dueDate??'')?Math.max(0,daysBetween(dateFor(referenceDate),bill.dueDate)??0):null;
    let value=null,displayValue='';
    switch(type){
      case'highest-paying':value=selectedReceipts.reduce((sum,row)=>sum+cents(row.amount),0);displayValue=pkr(value);break;
      case'most-consistent':value=behavior.paymentConsistency;displayValue=value===null?'':`${value}% · ${behavior.consistencySettledMonths}/${behavior.consistencyBillMonths} settled`;break;
      case'longest-standing':value=customer.connectionDate?Date.parse(`${customer.connectionDate}T00:00:00Z`):null;displayValue=customer.connectionDate?`Since ${customer.connectionDate}`:'';break;
      case'highest-package':value=packagePriceForMonth(customer,bill,selected,referenceDate);displayValue=value===null?'':pkr(cents(value));break;
      case'highest-outstanding':value=balance;displayValue=value===null?'':pkr(value);break;
      case'longest-overdue':value=overdueDays;displayValue=value===null?'':`${value} day${value===1?'':'s'}`;break;
      case'repeat-late':value=selectedReceipts.filter(payment=>payment.dueDate&&payment.date>payment.dueDate).length;displayValue=`${value} late receipt${value===1?'':'s'}`;break;
      case'lifetime-value':value=cents(lifetime.totalHistoricalRevenue);displayValue=pkr(value);break;
    }
    if(value===null||!Number.isFinite(value)){excludedCount++;continue;}
    rows.push({customerId:customer.id,customerNumber:customer.customerNumber,name:customer.name,area:areaValue,package:packageValue,serviceStatus:customer.archived?'Archived':({active:'Active',offline:'Offline','not-set':'Not set'})[customer.serviceStatus??'not-set'],value,displayValue,health:behavior.health,connectionDate:customer.connectionDate??null,
      ...(lifetime?{estimatedFutureValue:lifetime.estimatedFutureValue,estimatedFutureValueBasis:lifetime.estimatedFutureValueBasis}:{} )});
  }
  rows.sort((a,b)=>type==='longest-standing'?a.value-b.value:b.value-a.value||a.name.localeCompare(b.name));
  return{type,month:selected,rows:rows.slice(0,100),excludedCount,area,packageName,status};
}

function selectedMonth(query,referenceDate) {
  const current=monthFor(referenceDate),text=String(query??'').normalize('NFKC').toLocaleLowerCase('en');
  if(/\b(last|previous|pichle|pichlay|guzishta)\s+(month|mahine|maheena)\b|پچھلے مہینے|گزشتہ ماہ/u.test(text))return shiftMonth(current,-1);
  const english=['january','february','march','april','may','june','july','august','september','october','november','december'];
  const urdu=['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'];
  let index=english.findIndex(name=>text.includes(name));if(index<0)index=urdu.findIndex(name=>text.includes(name));
  if(index>=0){const year=text.match(/\b(20\d{2})\b/)?.[1]??current.slice(0,4);return`${year}-${String(index+1).padStart(2,'0')}`;}
  return current;
}
const contains=(text,regex,terms=[])=>regex.test(text)||terms.some(term=>text.includes(term));
export function answerOwnerCommand(state,query,referenceDate=new Date()) {
  const text=String(query??'').trim().normalize('NFKC').toLocaleLowerCase('en').replace(/[٠-٩]/g,digit=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const current=monthFor(referenceDate),today=dateFor(referenceDate),requestedMonth=selectedMonth(text,referenceDate),month=requestedMonth<=current?requestedMonth:current;
  const isToday=contains(text,/\b(today|aaj|aj)\b/u,['آج','آج کی','آج کا']);
  const collectionIntent=contains(text,/\b(collection|collected|received|paisa|wasool|wasooli)\b/u,['جمع','وصولی','پیسے آئے']);
  const expenseIntent=contains(text,/\b(expense|expenses|kharcha|kharchay)\b/u,['اخراجات','خرچ']);
  const pendingIntent=contains(text,/\b(pending|unpaid|not paid|did not pay|nahi di|nahin di|baqi|baki)\b/u,['بقایا','بقایاجات','نہیں دی','ادا نہیں']);
  const customerBillIntent=/\b(?:bill\s+(?:check|status|details)|check\s+bill)\b/u.test(text);
  const outstandingIntent=contains(text,/\b(outstanding|balance|remaining|due|baki|baqi)\b/u,['بقایا','بقیہ','balance'])||customerBillIntent;
  const areaIntent=contains(text,/\b(area|mohalla|zone)\b/u,['علاقہ','محلہ']);
  const profitIntent=contains(text,/\b(profit|munafa|net)\b/u,['منافع']);
  const monthNamed=/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/u.test(text)||['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'].some(name=>text.includes(name));
  const allocations=calculatePaymentAllocations(state);
  const entries=state.customers.flatMap(customer=>(customer.bills??[]).map(bill=>({customer,bill,due:validPrice(bill.dueAmount)?cents(bill.dueAmount):null,balance:validPrice(bill.dueAmount)?Math.max(0,allocations.forMonth(customer.id,bill.month)?.balanceDueCents??cents(bill.dueAmount)):null})));
  const paymentsFor=(day=null,monthFilter=null)=>state.customers.flatMap(customer=>(customer.bills??[]).flatMap(bill=>(bill.payments??[]).filter(payment=>(!day||payment.date===day)&&(!monthFilter||payment.date.slice(0,7)===monthFilter)).map(payment=>({customer,bill,payment}))));
  const periodPayments=paymentsFor(isToday?today:null,isToday?null:month),periodExpenses=(state.expenses??[]).filter(row=>isToday?row.date===today:row.date?.slice(0,7)===month);
  const collectionCents=periodPayments.reduce((sum,row)=>sum+cents(row.payment.amount),0),expenseCents=periodExpenses.reduce((sum,row)=>sum+cents(row.amount),0);
  const pending=entries.filter(row=>row.bill.month===month&&row.due!==null&&row.balance>0);
  const allOutstanding=entries.filter(row=>row.due!==null&&row.balance>0);
  const thresholdMatch=text.match(/(?:over|above|more than|greater than|exceed(?:ing)?|>|زیادہ|سے زیادہ)\s*(\d[\d,]*)/u)??text.match(/(\d[\d,]*)\s*(?:above|se zyada|سے زیادہ|outstanding|balance)/u);
  const threshold=thresholdMatch?Number(thresholdMatch[1].replaceAll(',','')):null;
  if(isToday&&collectionIntent&&expenseIntent)return{intent:'daily-summary',date:today,collection:amount(collectionCents),receiptCount:periodPayments.length,expenses:amount(expenseCents),expenseCount:periodExpenses.length};
  if(isToday&&collectionIntent)return{intent:'daily-collection',date:today,collection:amount(collectionCents),receiptCount:periodPayments.length};
  if(isToday&&expenseIntent)return{intent:'daily-expenses',date:today,expenses:amount(expenseCents),expenseCount:periodExpenses.length};
  if(areaIntent&&pendingIntent){const groups=new Map();for(const row of pending){const label=row.customer.mohalla?.trim()||row.customer.zone?.trim()||'Area not recorded';const group=groups.get(label)??{area:label,cents:0,ids:new Set()};group.cents+=row.balance;group.ids.add(row.customer.id);groups.set(label,group);}const rows=[...groups.values()].map(row=>({area:row.area,outstanding:amount(row.cents),customers:row.ids.size})).sort((a,b)=>b.outstanding-a.outstanding);return{intent:'area-pending',month,rows};}
  if(threshold!==null&&outstandingIntent){const groups=new Map();for(const row of allOutstanding){const item=groups.get(row.customer.id)??{customerId:row.customer.id,customerNumber:row.customer.customerNumber,name:row.customer.name,package:row.customer.packageSpeed||'Not recorded',cents:0};item.cents+=row.balance;groups.set(row.customer.id,item);}const rows=[...groups.values()].filter(row=>row.cents>threshold*100).map(row=>({...row,outstanding:amount(row.cents)})).sort((a,b)=>b.outstanding-a.outstanding);return{intent:'threshold-outstanding',threshold,rows,total:rows.length};}
  if(outstandingIntent&&!pendingIntent&&!profitIntent){
    const stop=new Set(['ka','ki','ke','kitna','kitni','kitne','balance','outstanding','remaining','due','bill','check','details','status','karo','hai','he','is','customer','customers','show','find','what','how','much','mujhe','please','batao','batayen','walay','wala','kis','kaun','aaj','month','mahine','mahina','اس','مہینے','کا','کی','کے','کتنا','کتنی','ہے','ہیں','مجھے']);
    const candidate=text.replace(/[؟?!.،,؛:]/g,' ').split(/\s+/).filter(word=>word&&!stop.has(word)&&/[a-z]/i.test(word)).join(' ');
    const matches=candidate?state.customers.filter(customer=>customer.name.toLocaleLowerCase('en').includes(candidate)||candidate.split(' ').some(word=>word.length>2&&customer.name.toLocaleLowerCase('en').includes(word))).map(customer=>{
      const rows=entries.filter(row=>row.customer.id===customer.id&&row.due!==null),selected=rows.find(row=>row.bill.month===month),selectedBill=customer.bills.find(row=>row.month===month),actualPaid=(selectedBill?.payments??[]).reduce((sum,payment)=>sum+cents(payment.amount),0),credit=allocations.forMonth(customer.id,month)?.creditAppliedCents??0;
      return{customerId:customer.id,customerNumber:customer.customerNumber,name:customer.name,package:customer.packageSpeed||'Not recorded',month,bill:selected?amount(selected.due):null,paid:amount(actualPaid),creditApplied:amount(credit),remaining:selected?amount(selected.balance):0,totalOutstanding:amount(rows.reduce((sum,row)=>sum+row.balance,0))};
    }):[];
    if(matches.length)return{intent:'customer-balance',month,rows:matches};
  }
  if(pendingIntent){const rows=pending.map(row=>({customerId:row.customer.id,customerNumber:row.customer.customerNumber,name:row.customer.name,package:row.customer.packageSpeed||'Not recorded',bill:amount(row.due),paid:amount((row.bill.payments??[]).reduce((sum,payment)=>sum+cents(payment.amount),0)),remaining:amount(row.balance),dueDate:row.bill.dueDate??null}));return{intent:'pending-list',month,rows,pendingTotal:amount(rows.reduce((sum,row)=>sum+cents(row.remaining),0))};}
  if(profitIntent){return{intent:'monthly-profit',month,collection:amount(collectionCents),expenses:amount(expenseCents),profit:amount(collectionCents-expenseCents),receiptCount:periodPayments.length,expenseCount:periodExpenses.length,basis:'Actual cash receipts minus recorded expenses; unpaid bills, inventory book value and estimated costs are excluded.'};}
  if(expenseIntent)return{intent:isToday?'daily-expenses':'monthly-expenses',month,date:isToday?today:undefined,expenses:amount(expenseCents),expenseCount:periodExpenses.length};
  if(collectionIntent||monthNamed)return{intent:isToday?'daily-collection':'monthly-collection',month,date:isToday?today:undefined,collection:amount(collectionCents),receiptCount:periodPayments.length};
  return{intent:'help',message:'Try: “October collection”, “Ali ka balance”, “Aaj kis kis ne payment nahi di?”, “today collection and expense”, “اس مہینے profit کتنا ہے؟”, “area-wise pending”, or “customers above 5000 outstanding”. Only saved local records are queried.'};
}


export function buildSmartDuesRecovery(state,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  const rows=[];
  for(const customer of state.customers){
    const open=(customer.bills??[]).filter(bill=>validPrice(bill.dueAmount)).map(bill=>({bill,balance:Math.max(0,allocations.forMonth(customer.id,bill.month)?.balanceDueCents??cents(bill.dueAmount))})).filter(row=>row.balance>0);
    if(!open.length)continue;
    const behavior=buildCustomerPaymentBehavior(state,customer,referenceDate,allocations);
    const outstandingCents=open.reduce((sum,row)=>sum+row.balance,0);
    const overdueRows=open.map(row=>({date:row.bill.dueDate,days:/^\d{4}-\d{2}-\d{2}$/.test(row.bill.dueDate??'')?Math.max(0,daysBetween(dateFor(referenceDate),row.bill.dueDate)??0):null}));
    const knownOverdue=overdueRows.filter(row=>row.days!==null).map(row=>row.days);
    const longestOverdueDays=knownOverdue.length?Math.max(...knownOverdue):null;
    const monthlyValue=validPrice(customer.monthlySellingAmount)?Number(customer.monthlySellingAmount):null;
    const components={
      amount:outstandingCents>=5000000?30:outstandingCents>=2500000?27:outstandingCents>=1000000?24:outstandingCents>=500000?20:outstandingCents>=250000?16:outstandingCents>=100000?12:6,
      overdue:longestOverdueDays===null?0:longestOverdueDays>60?25:longestOverdueDays>30?18:longestOverdueDays>7?12:longestOverdueDays>0?5:0,
      history:behavior.health.score===null?10:Math.round((100-behavior.health.score)/5),
      latePayments:Math.min(15,behavior.latePaymentCount*3),
      customerValue:monthlyValue===null?0:monthlyValue>=5000?10:monthlyValue>=2500?7:monthlyValue>=1000?4:1
    };
    const priorityScore=Object.values(components).reduce((sum,value)=>sum+value,0);
    const group=priorityScore>=65?'High Priority':priorityScore>=35?'Medium Priority':'Low Priority';
    const oldestBill=open.sort((a,b)=>(a.bill.dueDate??a.bill.month).localeCompare(b.bill.dueDate??b.bill.month))[0].bill;
    const reasons=[`Outstanding ${pkr(outstandingCents)} (+${components.amount} amount points).`,longestOverdueDays===null?'Saved due date not available.':`${longestOverdueDays} days overdue (+${components.overdue} points).`,behavior.health.score===null?'Payment history is insufficient; neutral history points applied.':`Payment health ${behavior.health.score}/100 (+${components.history} history points).`,`${behavior.latePaymentCount} recorded late receipt${behavior.latePaymentCount===1?'':'s'} (+${components.latePayments} points).`,monthlyValue===null?'Monthly customer value not recorded.':`Saved monthly value ${pkr(cents(monthlyValue))} (+${components.customerValue} value points).`];
    rows.push({customerId:customer.id,customerNumber:customer.customerNumber,name:customer.name,package:customer.packageSpeed||'Not recorded',area:customer.mohalla?.trim()||customer.zone?.trim()||'Area not recorded',archived:customer.archived===true,phone:customer.phone||'',outstanding:amount(outstandingCents),outstandingCents,openBillCount:open.length,oldestDueDate:oldestBill.dueDate??null,longestOverdueDays,latePaymentCount:behavior.latePaymentCount,health:behavior.health,monthlyValue,priorityScore,group,components,reasons});
  }
  const groups=['High Priority','Medium Priority','Low Priority'].map(name=>{const customers=rows.filter(row=>row.group===name).sort((a,b)=>b.priorityScore-a.priorityScore||b.outstandingCents-a.outstandingCents);return{name,customers,count:customers.length,recoverableAmount:amount(customers.reduce((sum,row)=>sum+row.outstandingCents,0))};});
  return{asOf:dateFor(referenceDate),groups,totalCustomers:rows.length,totalRecoverable:amount(rows.reduce((sum,row)=>sum+row.outstandingCents,0)),formula:'Outstanding amount (6–30 points) + overdue days (0–25) + payment history (0–20; neutral if insufficient) + late receipts (0–15) + saved monthly value (0–10). High ≥65; Medium 35–64; Low <35. Due dates and profile value are never inferred.'};
}


function countMonthField(customers,field,month) { return customers.filter(customer=>typeof customer[field]==='string'&&customer[field].slice(0,7)===month).length; }
function historicalPackageName(customer,bill,month,currentMonth) {
  if(bill?.packageSnapshot?.label)return bill.packageSnapshot.label;
  const history=(customer.packageHistory??[]).filter(row=>typeof row.date==='string'&&row.date.slice(0,7)<=month).sort((a,b)=>b.date.localeCompare(a.date));
  if(history.length)return history[0].newPackage||'Package not set';
  if(month===currentMonth&&customer.packageSpeed?.trim())return customer.packageSpeed.trim();
  return null;
}
function percentChange(from,to) {
  if(!Number.isFinite(from)||!Number.isFinite(to)||from===null||to===null)return null;
  if(from===0)return to===0?0:null;
  return Number(((to-from)/Math.abs(from)*100).toFixed(1));
}
function monthComparisonFacts(state,month,referenceDate,allocations) {
  const currentMonth=monthFor(referenceDate),snapshot=(state.monthlyClosings??[]).find(row=>row.month===month)??null;
  const billRows=state.customers.flatMap(customer=>(customer.bills??[]).filter(bill=>bill.month===month).map(bill=>({customer,bill})));
  const priced=billRows.filter(({bill})=>validPrice(bill.dueAmount));
  const billedCents=priced.reduce((sum,row)=>sum+cents(row.bill.dueAmount),0);
  const collectionCents=state.customers.flatMap(customer=>(customer.bills??[]).flatMap(bill=>(bill.payments??[]).filter(payment=>payment.date?.slice(0,7)===month))).reduce((sum,payment)=>sum+cents(payment.amount),0);
  const expenseRows=(state.expenses??[]).filter(row=>row.date?.slice(0,7)===month);
  const expenseCents=expenseRows.reduce((sum,row)=>sum+cents(row.amount),0);
  const ledgerOutstanding=priced.reduce((sum,{customer,bill})=>sum+Math.max(0,allocations.forMonth(customer.id,month)?.balanceDueCents??cents(bill.dueAmount)),0);
  const allAddedDates=state.customers.some(customer=>typeof customer.addedOn==='string');
  const allConnectionDates=state.customers.some(customer=>typeof customer.connectionDate==='string');
  const allArchiveDates=state.customers.some(customer=>typeof customer.archivedAt==='string');
  const allCancellationDates=state.customers.some(customer=>typeof customer.cancellationDate==='string');
  const activeCustomers=snapshot?snapshot.activeCustomerCount:month===currentMonth?state.customers.filter(customer=>!customer.archived&&customer.serviceStatus==='active').length:null;
  const statusSource=snapshot?`saved close · captured ${snapshot.savedAt}`:month===currentMonth?`current manual status · as of ${dateFor(referenceDate)}`:'not captured historically';
  const packageDistribution={};
  for(const {customer,bill} of billRows){const name=historicalPackageName(customer,bill,month,currentMonth);if(name)packageDistribution[name]=(packageDistribution[name]??0)+1;}
  const unrecordedPackages=billRows.length-Object.values(packageDistribution).reduce((sum,value)=>sum+value,0);
  return{
    month,
    billCount:billRows.length,
    pricedBillCount:priced.length,
    unpricedBillCount:billRows.length-priced.length,
    billedAmount:amount(billedCents),
    collection:amount(collectionCents),
    collectionReceiptCount:state.customers.reduce((sum,customer)=>sum+(customer.bills??[]).reduce((n,bill)=>n+(bill.payments??[]).filter(payment=>payment.date?.slice(0,7)===month).length,0),0),
    outstanding:amount(snapshot?snapshot.pending:ledgerOutstanding),
    outstandingSource:snapshot?`saved month-close snapshot captured ${snapshot.savedAt}`:`current ledger balance as of ${dateFor(referenceDate)}; later receipts may have changed this past month`,
    expenses:amount(expenseCents),
    expenseCount:expenseRows.length,
    cashProfit:amount(collectionCents-expenseCents),
    activeCustomers,
    activeCustomerSource:statusSource,
    offlineCustomers:snapshot?snapshot.offlineCustomerCount:month===currentMonth?state.customers.filter(customer=>!customer.archived&&customer.serviceStatus==='offline').length:null,
    notSetServiceCustomers:snapshot?snapshot.notSetCustomerCount:month===currentMonth?state.customers.filter(customer=>!customer.archived&&(customer.serviceStatus??'not-set')==='not-set').length:null,
    newCustomers:allAddedDates?countMonthField(state.customers,'addedOn',month):null,
    newConnections:allConnectionDates?countMonthField(state.customers,'connectionDate',month):null,
    archivedCustomers:allArchiveDates?countMonthField(state.customers,'archivedAt',month):null,
    disconnectedCustomers:allCancellationDates?countMonthField(state.customers,'cancellationDate',month):null,
    collectionRate:billedCents?Number((collectionCents/billedCents*100).toFixed(1)):null,
    packageDistribution,
    unrecordedPackageBills:unrecordedPackages,
    packageDistributionNote:unrecordedPackages?`${unrecordedPackages} bill(s) have no saved package snapshot/history.`:'Package distribution uses saved bill snapshots or dated package history.',
    snapshotSavedAt:snapshot?.savedAt??null,
    source:snapshot?'saved-snapshot':'local-ledger'
  };
}

export function buildMonthToMonthComparison(state,monthA,monthB,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  const valid=monthsForHistory(referenceDate);
  if(!valid.includes(monthA)||!valid.includes(monthB))throw new Error(`Choose two distinct months within the retained ${valid.length}-month history.`);
  if(monthA===monthB)throw new Error('Choose two different months to compare.');
  const first=monthComparisonFacts(state,monthA,referenceDate,allocations),second=monthComparisonFacts(state,monthB,referenceDate,allocations);
  const metrics=['billCount','pricedBillCount','unpricedBillCount','billedAmount','collection','outstanding','expenses','cashProfit','activeCustomers','offlineCustomers','notSetServiceCustomers','newCustomers','newConnections','archivedCustomers','disconnectedCustomers','collectionRate'];
  const changes=Object.fromEntries(metrics.map(key=>{const from=first[key],to=second[key],available=Number.isFinite(from)&&Number.isFinite(to);return[key,{from,to,absoluteChange:available?Number((to-from).toFixed(2)):null,percentChange:available?percentChange(from,to):null,unavailableReason:available?'':`${key} was not saved for both selected months.`}];}));
  const packages=[...new Set([...Object.keys(first.packageDistribution),...Object.keys(second.packageDistribution)])].sort().map(name=>{const from=first.packageDistribution[name]??0,to=second.packageDistribution[name]??0;return{name,from,to,change:to-from,percentChange:percentChange(from,to)};});
  return{monthA:first,monthB:second,changes,packageChanges:packages,basis:{collection:'Actual receipts grouped by their saved payment date.',billedAmount:'Saved priced bill snapshots grouped by service month; unpriced bills are counted separately.',outstanding:'Saved month-close pending snapshot if present; otherwise current ledger balance for the selected bill month as of the comparison date.',profit:'Receipt-date cash collection minus actual dated expenses; not accrual/accounting profit.',activeCustomers:'Saved manual service-state snapshot when available; otherwise current manual status for the current month only. Older unsnapshotted months are unavailable.',newCustomers:'Saved profile-added dates only; this is new profile records, not necessarily new network connections.',newConnections:'Explicit saved connection dates only.',disconnectedCustomers:'Explicit cancellation dates only; archive actions are reported separately.',collectionRate:'Receipt-date collection divided by service-month bill amount. This can exceed 100% when receipts include collections of older balances.'}};
}

const BUSINESS_HEALTH_WEIGHTS=Object.freeze({collectionRate:25,outstandingRatio:20,cashProfitMargin:20,expenseRatio:15,customerGrowth:10,documentedChurn:10});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const validStoredDate=value=>isCalendarDate(value)?value:(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&isCalendarDate(value.slice(0,10))?value.slice(0,10):null);
function healthFactor(id,label,value,score,basis,unavailableReason='') {
  const available=score!==null&&Number.isFinite(score);
  return{id,label,value:value===null||!Number.isFinite(value)?null:Number(value),quality:available?Number(clamp(score,0,100).toFixed(1)):null,weight:BUSINESS_HEALTH_WEIGHTS[id],basis,unavailableReason,available};
}
/** Build a local-only, non-mutating health indicator from dated records and report-compatible metrics. */
export function buildBusinessHealthScore(state,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  const currentMonth=monthFor(referenceDate),lastCompleteMonth=shiftMonth(currentMonth,-1),firstMonth=shiftMonth(lastCompleteMonth,-2);
  const months=[firstMonth,shiftMonth(firstMonth,1),lastCompleteMonth],windowStart=`${firstMonth}-01`,windowEnd=`${lastCompleteMonth}-${new Date(Date.UTC(Number(lastCompleteMonth.slice(0,4)),Number(lastCompleteMonth.slice(5,7)),0)).getUTCDate()}`;
  const facts=months.map(month=>monthComparisonFacts(state,month,referenceDate,allocations));
  const billCents=facts.reduce((sum,row)=>sum+cents(row.billedAmount),0);
  const outstandingCents=facts.reduce((sum,row)=>sum+cents(row.outstanding),0);
  const receipts=(state.customers??[]).flatMap(customer=>(customer.bills??[]).flatMap(bill=>(bill.payments??[]).filter(payment=>isCalendarDate(payment.date)&&payment.date>=windowStart&&payment.date<=windowEnd&&Number.isFinite(Number(payment.amount))&&Number(payment.amount)>0)));
  const expenses=(state.expenses??[]).filter(row=>isCalendarDate(row.date)&&row.date>=windowStart&&row.date<=windowEnd&&Number.isFinite(Number(row.amount))&&Number(row.amount)>0);
  const receiptCents=receipts.reduce((sum,row)=>sum+cents(row.amount),0),expenseCents=expenses.reduce((sum,row)=>sum+cents(row.amount),0),cashProfitCents=receiptCents-expenseCents;
  const collectionRate=billCents>0?receiptCents/billCents*100:null;
  const outstandingRatio=billCents>0?outstandingCents/billCents*100:null;
  const cashProfitMargin=receiptCents>0?cashProfitCents/receiptCents*100:null;
  const expenseRatio=receiptCents>0?expenseCents/receiptCents*100:null;
  const customers=state.customers??[],allAddedDatesRecorded=customers.length>0&&customers.every(customer=>isCalendarDate(customer.addedOn));
  const baselineMonth=shiftMonth(firstMonth,-1),baselineClose=(state.monthlyClosings??[]).find(row=>row.month===baselineMonth);
  const snapshotBase=baselineClose&&Number.isSafeInteger(baselineClose.totalCustomers)&&Number.isSafeInteger(baselineClose.archivedCustomerCount)?baselineClose.totalCustomers+baselineClose.archivedCustomerCount:null;
  const datedBase=allAddedDatesRecorded?customers.filter(customer=>customer.addedOn<windowStart).length:null;
  const openingCustomerBase=snapshotBase??datedBase;
  const openingBasis=snapshotBase!==null?`Saved ${baselineMonth} close: ${baselineClose.totalCustomers} non-archived + ${baselineClose.archivedCustomerCount} archived profiles.`:datedBase!==null?`${datedBase} current saved profiles with a recorded added-on date before ${windowStart}.`:'No complete saved opening profile count; missing added-on dates are not treated as zero.';
  const newCustomers=allAddedDatesRecorded?customers.filter(customer=>customer.addedOn>=windowStart&&customer.addedOn<=windowEnd).length:null;
  const growthRate=newCustomers!==null&&openingCustomerBase>0?newCustomers/openingCustomerBase*100:null;
  const churnBase=openingCustomerBase!==null&&newCustomers!==null?openingCustomerBase+newCustomers:null;
  const churnIds=new Set();
  for(const customer of customers){
    const cancellation=validStoredDate(customer.cancellationDate),archive=customer.archived===true?validStoredDate(customer.archivedAt):null;
    if([cancellation,archive].some(date=>date&&date>=windowStart&&date<=windowEnd&&(!isCalendarDate(customer.addedOn)||date>=customer.addedOn)))churnIds.add(customer.id??customer.customerNumber);
  }
  const documentedChurnCount=churnIds.size;
  const churnRate=churnBase>0&&documentedChurnCount>0?documentedChurnCount/churnBase*100:null;
  const moneyBasis=`${firstMonth}–${lastCompleteMonth} PKT: actual positive receipt rows by payment date; ${receipts.length} receipt(s).`;
  const billBasis=`${firstMonth}–${lastCompleteMonth} service-month priced bill snapshots; ${facts.reduce((sum,row)=>sum+row.pricedBillCount,0)} priced bill-month row(s); unpriced bills excluded.`;
  const outstandingSources=[...new Set(facts.map(row=>row.outstandingSource))].join(' ');
  const factors=[
    healthFactor('collectionRate','Receipt-date collection rate',collectionRate,collectionRate===null?null:collectionRate/90*100,`${moneyBasis} Divided by ${pkr(billCents)} of saved priced service-month bills. ${billBasis} Score: 0%→0; 90% or more→100, linearly between.`,billCents===0?'Not available: no priced bill amount is recorded for this three-month window.':''),
    healthFactor('outstandingRatio','Outstanding-balance ratio',outstandingRatio,outstandingRatio===null?null:(1-outstandingRatio/50)*100,`${pkr(outstandingCents)} outstanding ÷ ${pkr(billCents)} saved priced bill amount. ${outstandingSources} Score: 0%→100; 50% or more→0, linearly between.`,billCents===0?'Not available: no priced bill amount is recorded for this three-month window.':''),
    healthFactor('cashProfitMargin','Cash-profit margin',cashProfitMargin,cashProfitMargin===null?null:(cashProfitMargin+20)/50*100,`${pkr(receiptCents)} actual receipts − ${pkr(expenseCents)} dated expenses = ${pkr(cashProfitCents)} cash profit, divided by actual receipts. ${receipts.length} receipt(s), ${expenses.length} expense(s). This is cash profit, not accrual/accounting profit. Score: −20%→0; +30% or more→100, linearly between.`,receiptCents===0?'Not available: no positive actual receipts are recorded, so the margin denominator is zero.':''),
    healthFactor('expenseRatio','Recorded-expense ratio',expenseRatio,expenseRatio===null?null:expenseRatio<=20?100:(70-expenseRatio)/50*100,`${pkr(expenseCents)} dated recorded expenses ÷ ${pkr(receiptCents)} actual receipt-date collection; ${expenses.length} expense(s). Score: 20% or less→100; 70% or more→0, linearly between. This overlaps mathematically with cash-profit margin.`,receiptCents===0?'Not available: no positive actual receipts are recorded, so the ratio denominator is zero.':''),
    healthFactor('customerGrowth','Dated customer growth',growthRate,growthRate===null?null:50+growthRate/10*50,`${growthRate===null?'No complete dated-growth rate can be calculated.':`${newCustomers} new profile(s) with a saved added-on date ÷ ${openingCustomerBase} opening profiles = ${growthRate.toFixed(1)}%.`} ${openingBasis} Score: 0% growth→50; 10% or more→100, linearly between. Profile additions are not necessarily new network connections.`,!allAddedDatesRecorded?'Not available: one or more profiles have no valid saved added-on date, so dated additions may be incomplete.':openingCustomerBase===0?'Not available: the opening profile count is zero or unavailable.':''),
    healthFactor('documentedChurn','Documented cancellation / archive rate',churnRate,churnRate===null?null:(1-churnRate/10)*100,`${documentedChurnCount} distinct profile(s) with an explicit saved cancellation date or a still-present archive timestamp ÷ ${churnBase??'unavailable'} profiles present or added during the window = ${churnRate===null?'Not available':`${churnRate.toFixed(1)}%`}. ${openingBasis} Current Active/Offline labels are not used. Cleared archive timestamps after unarchive and undated events cannot be recovered, so this is documented churn only. Score: 0%→100; 10% or more→0, linearly between.`,!allAddedDatesRecorded?'Not available: the opening profile history is incomplete because some added-on dates are missing.':churnBase===0?'Not available: the recorded profile population is zero or unavailable.':documentedChurnCount===0?'Not available: no dated cancellation/archive event in this window establishes a recorded churn rate; absence is not assumed to mean zero churn.':'' )
  ];
  const available=factors.filter(row=>row.available),availableWeight=available.reduce((sum,row)=>sum+row.weight,0);
  const normalized=available.map(row=>{const effectiveWeight=row.weight/availableWeight*100,contribution=row.quality*effectiveWeight/100;return{...row,effectiveWeight:Number(effectiveWeight.toFixed(1)),contribution:Number(contribution.toFixed(1)),polarity:row.quality>=60?'positive':row.quality<=40?'negative':'neutral'};});
  const score=available.length?Number((normalized.reduce((sum,row)=>sum+row.contribution,0)).toFixed(1)):null;
  return{score,category:score===null?'Insufficient recorded metrics':score>=80?'Strong recorded indicators':score>=60?'Mixed recorded indicators':'Needs attention',asOf:dateFor(referenceDate),window:{startMonth:firstMonth,endMonth:lastCompleteMonth,startDate:windowStart,endDate:windowEnd,months},availableFactorCount:available.length,totalFactorCount:factors.length,availableWeight,renormalized:available.length>0&&availableWeight!==100,openingCustomerBase,openingBasis,factors:normalized,unavailableFactors:factors.filter(row=>!row.available)};
}

function aggregateMonthCustomers(state,month,key,allocations) {
  const result=new Map();
  for(const customer of state.customers){let total=0;
    for(const bill of customer.bills??[]){if(key==='collection'){for(const payment of bill.payments??[])if(payment.date?.slice(0,7)===month)total+=cents(payment.amount);}
      else if(key==='billedAmount'&&bill.month===month&&validPrice(bill.dueAmount))total+=cents(bill.dueAmount);
      else if(key==='outstanding'&&bill.month===month&&validPrice(bill.dueAmount))total+=Math.max(0,allocations.forMonth(customer.id,month)?.balanceDueCents??cents(bill.dueAmount));}
    if(total)result.set(customer.name,(result.get(customer.name)??0)+total);
  }return result;
}
function aggregateMonthExpenses(state,month) {const result=new Map();for(const row of state.expenses??[])if(row.date?.slice(0,7)===month)result.set(row.category,(result.get(row.category)??0)+cents(row.amount));return result;}
function contributionRows(first,second,totalChange) {
  const totalChangeCents=cents(totalChange),keys=new Set([...first.keys(),...second.keys()]);return[...keys].map(name=>{const change=(second.get(name)??0)-(first.get(name)??0);return{name,change:amount(change),percentImpact:totalChangeCents?Number((change/totalChangeCents*100).toFixed(1)):null};}).filter(row=>row.change!==0).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,5);
}
export function explainBusinessPerformance(state,metric,monthA,monthB,referenceDate=new Date()) {
  const selected=metric==='revenue'?'billedAmount':metric==='profit'?'cashProfit':metric;
  if(!['billedAmount','collection','outstanding','expenses','cashProfit'].includes(selected))throw new Error('Choose revenue, collection, outstanding, expenses, or profit.');
  const comparison=buildMonthToMonthComparison(state,monthA,monthB,referenceDate),change=comparison.changes[selected];
  if(change.absoluteChange===null)return{metric:selected,monthA,monthB,change:null,drivers:[],explanation:'Insufficient saved data to compare both selected months.'};
  if(change.absoluteChange===0)return{metric:selected,monthA,monthB,change:0,percentChange:change.percentChange,drivers:[],explanation:'The selected totals are equal. No net increase or decrease is recorded.'};
  let drivers=[],basis='Recorded ledger amounts show these contributing changes; they do not establish external causes.';
  if(selected==='cashProfit'){
    const collectionDelta=comparison.changes.collection.absoluteChange,expenseDelta=comparison.changes.expenses.absoluteChange;
    drivers=[{name:'Receipt-date collection',change:collectionDelta,percentImpact:change.absoluteChange?Number((collectionDelta/change.absoluteChange*100).toFixed(1)):null},{name:'Recorded expenses (deducted from cash profit)',change:-expenseDelta,percentImpact:change.absoluteChange?Number((-expenseDelta/change.absoluteChange*100).toFixed(1)):null}].filter(row=>row.change!==0);
    basis='Exact identity for this app: cash profit change = receipt-date collection change − recorded expense change. This is not accrual or inventory-adjusted profit.';
  } else if(selected==='expenses'){
    drivers=contributionRows(aggregateMonthExpenses(state,monthA),aggregateMonthExpenses(state,monthB),change.absoluteChange);
    basis='Actual dated expense entries grouped by their saved category. Category changes explain the recorded total difference, not why a purchase happened.';
  } else if(selected==='collection'){
    const allocations=calculatePaymentAllocations(state);drivers=contributionRows(aggregateMonthCustomers(state,monthA,'collection',allocations),aggregateMonthCustomers(state,monthB,'collection',allocations),change.absoluteChange);
    basis='Actual receipts grouped by saved customer and payment date. Customer contribution is not a claim about external causes.';
  } else if(selected==='billedAmount'){
    const allocations=calculatePaymentAllocations(state);drivers=contributionRows(aggregateMonthCustomers(state,monthA,'billedAmount',allocations),aggregateMonthCustomers(state,monthB,'billedAmount',allocations),change.absoluteChange);
    basis='Saved priced service-month bill snapshots grouped by customer. Unpriced bills and unrecorded customers do not contribute.';
  } else {
    const saved=(state.monthlyClosings??[]).some(snapshot=>snapshot.month===monthA||snapshot.month===monthB);
    if(saved)return{metric:selected,monthA,monthB,change:change.absoluteChange,percentChange:change.percentChange,drivers:[],basis:'One or both totals use a saved close snapshot; per-customer close balances were not stored.',explanation:'The total change is available, but its customer-level drivers cannot be reconstructed without per-customer close snapshots.'};
    const allocations=calculatePaymentAllocations(state);drivers=contributionRows(aggregateMonthCustomers(state,monthA,'outstanding',allocations),aggregateMonthCustomers(state,monthB,'outstanding',allocations),change.absoluteChange);
    basis='Current recorded bill balances by service month as of today; later payments can change older-month outstanding, so this is not a historical month-end cause analysis.';
  }
  return{metric:selected,monthA,monthB,change:change.absoluteChange,percentChange:change.percentChange,drivers,basis,explanation:`Recorded ${selected} ${change.absoluteChange>0?'increased':'decreased'} by ${pkr(Math.abs(cents(change.absoluteChange)))} (${change.percentChange===null?'percentage change unavailable because the earlier total was zero':`${Math.abs(change.percentChange)}%`}). Main measured contributors are listed below. These figures describe ledger movements, not proven outside causes.`};
}


const isCalendarDate = value => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value ?? ''))return false;
  const parsed=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
};
function shiftDate(date,days) { return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10); }
function daysInMonth(month) { const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number,0)).getUTCDate(); }
function monthOffset(month,delta) { const [year,number]=month.split('-').map(Number),index=year*12+number-1+delta;return`${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`; }
function recordedPackageForMonth(customer,bill,month) {
  const saved=String(bill?.packageSnapshot?.label??'').trim();if(saved)return saved;
  const history=(customer.packageHistory??[]).filter(row=>isCalendarDate(row.date)&&row.date.slice(0,7)<=month).sort((a,b)=>b.date.localeCompare(a.date));
  const name=String(history[0]?.newPackage??'').trim();return name||null;
}

/** Derive local-only, read-only alerts. No alerts or history are persisted or sent anywhere. */
export function buildSmartAlerts(state,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  const asOf=dateFor(referenceDate),currentMonth=asOf.slice(0,7),alerts=[],insufficient=[],checks=[];
  const check=(id,status,note='')=>checks.push({id,status,note});
  const addInsufficient=(id,note)=>{insufficient.push({id,note});check(id,'insufficient',note);};
  const positiveBills=[];
  for(const customer of state.customers??[])for(const bill of customer.bills??[]) {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(bill.month??'')||bill.month>currentMonth||!validPrice(bill.dueAmount))continue;
    const dueCents=cents(bill.dueAmount),balanceCents=Math.max(0,allocations.forMonth(customer.id,bill.month)?.balanceDueCents??dueCents);
    if(balanceCents>0)positiveBills.push({customer,bill,balanceCents});
  }

  const dueToday=positiveBills.filter(row=>isCalendarDate(row.bill.dueDate)&&row.bill.dueDate===asOf),dueCustomers=new Map();
  for(const row of dueToday){const current=dueCustomers.get(row.customer.id)??{customer:row.customer,bills:0,balanceCents:0};current.bills++;current.balanceCents+=row.balanceCents;dueCustomers.set(row.customer.id,current);}
  const dueCount=dueCustomers.size,dueBillCount=dueToday.length,dueBalance=dueToday.reduce((sum,row)=>sum+row.balanceCents,0);
  if(dueCount>=5)alerts.push({id:'due-today',severity:'warning',title:`${dueCount} customers have unpaid bills due today`,detail:`${dueBillCount} saved bill(s) · ${pkr(dueBalance)} outstanding. Rule: at least 5 distinct customers with a recorded due date today. No historical daily due-status snapshots exist, so this is a count threshold—not a historical anomaly.`});
  check('due-today',dueCount>=5?'alert':'clear',dueCount>=5?'':`${dueCount} customer(s) with an unpaid bill due today; the alert threshold is 5.`);

  const byCustomer=new Map();
  for(const row of positiveBills){const entry=byCustomer.get(row.customer.id)??{customer:row.customer,months:new Map(),balanceCents:0};entry.months.set(row.bill.month,(entry.months.get(row.bill.month)??0)+row.balanceCents);entry.balanceCents+=row.balanceCents;byCustomer.set(row.customer.id,entry);}
  const multipleMonthCustomers=[...byCustomer.values()].filter(row=>row.months.size>=2).sort((a,b)=>b.balanceCents-a.balanceCents);
  for(const row of multipleMonthCustomers){const months=[...row.months.keys()].sort();alerts.push({id:`unpaid-months-${row.customer.id}`,severity:'warning',title:`${row.customer.name||'Customer'} has balances in ${months.length} unpaid months`,detail:`Saved bill months: ${months.join(', ')} · ${pkr(row.balanceCents)} outstanding across those months.`,customerId:row.customer.id,customerName:row.customer.name||'Customer'});}
  check('two-unpaid-months',multipleMonthCustomers.length?'alert':'clear',multipleMonthCustomers.length?'': 'No customer currently has positive saved balances in two or more distinct priced bill months.');

  const validExpenses=(state.expenses??[]).filter(row=>isCalendarDate(row.date)&&row.date<=asOf&&Number.isFinite(Number(row.amount))&&Number(row.amount)>0);
  const dayOfMonth=Number(asOf.slice(8,10)),mtdByMonth=new Map();
  for(const row of validExpenses){const month=row.date.slice(0,7),cutoff=month===currentMonth?dayOfMonth:Math.min(dayOfMonth,daysInMonth(month));if(Number(row.date.slice(8,10))>cutoff)continue;const values=mtdByMonth.get(month)??{totalCents:0,categories:new Map()};const value=cents(row.amount),category=String(row.category??'').trim()||'Not recorded';values.totalCents+=value;values.categories.set(category,(values.categories.get(category)??0)+value);mtdByMonth.set(month,values);}
  const baselineMonths=[1,2,3].map(offset=>monthOffset(currentMonth,-offset)).filter(month=>mtdByMonth.has(month)).sort();
  const currentExpenses=mtdByMonth.get(currentMonth),expenseCategories=[...new Set(currentExpenses?[...currentExpenses.categories.keys()]:[])],expenseAlerts=[];
  if(!expenseCategories.length){check('expense-baseline','clear','No positive dated expense has been recorded so far this month.');}
  else {
    let missingExpenseBaseline=false;
    for(const category of expenseCategories){
      if(baselineMonths.length<2){missingExpenseBaseline=true;addInsufficient(`expense-baseline-${category}`,`No expense alert for “${category}”: only ${baselineMonths.length} prior month-to-date period(s) contain dated expense entries; at least 2 are required.`);continue;}
      const baselineCents=Math.round(baselineMonths.reduce((sum,month)=>sum+(mtdByMonth.get(month).categories.get(category)??0),0)/baselineMonths.length),actualCents=currentExpenses.categories.get(category)??0;
      if(baselineCents<=0){missingExpenseBaseline=true;addInsufficient(`expense-baseline-${category}`,`No expense alert for “${category}”: recorded month-to-date spending in the ${baselineMonths.length} comparison month(s) provides no positive category baseline.`);continue;}
      if(actualCents>=baselineCents*1.5&&actualCents-baselineCents>=50000)expenseAlerts.push({id:`expense-${category}`,severity:'notice',title:`${category} expenses are above their recent baseline`,detail:`This month to date: ${pkr(actualCents)} vs ${pkr(baselineCents)} average over ${baselineMonths.join(', ')} through the same day of month. Rule: at least 50% and PKR 500 above the recorded baseline.`});
    }
    alerts.push(...expenseAlerts);
    if(expenseAlerts.length)check('expense-baseline','alert','');else if(!missingExpenseBaseline)check('expense-baseline','clear',`No category is at least 50% and PKR 500 above its baseline from ${baselineMonths.length} comparable recorded-expense month(s).`);
  }

  const previousCompletedMonth=monthOffset(currentMonth,-1),earlierCompletedMonth=monthOffset(currentMonth,-2),packageMonthRows=[];
  for(const month of [earlierCompletedMonth,previousCompletedMonth]){
    const rows=(state.customers??[]).flatMap(customer=>(customer.bills??[]).filter(bill=>bill.month===month).map(bill=>({customer,bill,name:recordedPackageForMonth(customer,bill,month)})));
    packageMonthRows.push({month,rows});
  }
  const packageDataComplete=packageMonthRows.every(period=>period.rows.length>0&&period.rows.every(row=>row.name));
  if(!packageDataComplete){const missing=packageMonthRows.filter(period=>!period.rows.length||period.rows.some(row=>!row.name)).map(period=>period.month);addInsufficient('package-counts',`Package trend is not shown: complete recorded package labels for all saved bill rows are unavailable in ${missing.join(' and ')}. Counts require dated bill package snapshots/history; current manual status is not substituted.`);}
  else {
    const counts=packageMonthRows.map(period=>{const map=new Map();for(const row of period.rows){const ids=map.get(row.name)??new Set();ids.add(row.customer.id);map.set(row.name,ids);}return{month:period.month,counts:new Map([...map].map(([name,ids])=>[name,ids.size]))};});
    const names=new Set([...counts[0].counts.keys(),...counts[1].counts.keys()]),declines=[];
    for(const name of names){const before=counts[0].counts.get(name)??0,after=counts[1].counts.get(name)??0;if(after<before)declines.push({name,before,after});}
    for(const row of declines)alerts.push({id:`package-decline-${row.name}`,severity:'notice',title:`${row.name} billed-customer count declined`,detail:`${row.before} customer(s) in ${counts[0].month} → ${row.after} in ${counts[1].month}. This uses distinct customers with saved service-month bill package snapshots/history; it is not a verified count of active network connections.`});
    check('package-counts',declines.length?'alert':'clear',declines.length?'':`No decline in recorded billed-customer counts between ${counts[0].month} and ${counts[1].month}.`);
  }

  const dailyReceipts=new Map();
  for(const customer of state.customers??[])for(const bill of customer.bills??[])for(const payment of bill.payments??[]){if(!isCalendarDate(payment.date)||payment.date>asOf||!Number.isFinite(Number(payment.amount))||Number(payment.amount)<=0)continue;dailyReceipts.set(payment.date,(dailyReceipts.get(payment.date)??0)+cents(payment.amount));}
  const matchingWeekdays=[7,14,21,28].map(days=>shiftDate(asOf,-days)).filter(date=>dailyReceipts.has(date));
  const currentCollection=dailyReceipts.get(asOf)??0;
  if(matchingWeekdays.length<2)addInsufficient('collection-baseline',`No low-collection comparison yet: only ${matchingWeekdays.length} of the prior 4 same-weekday dates have saved receipts; at least 2 receipt-bearing comparison days are required.`);
  else {
    const baselineCents=Math.round(matchingWeekdays.reduce((sum,date)=>sum+dailyReceipts.get(date),0)/matchingWeekdays.length);
    if(baselineCents>0&&currentCollection<baselineCents*0.8)alerts.push({id:'collection-below-weekday-baseline',severity:'notice',title:'Today’s collection is below comparable prior weeks',detail:`Today: ${pkr(currentCollection)} vs ${pkr(baselineCents)} average across ${matchingWeekdays.length} receipt-bearing same-weekday date(s) in the prior 4 weeks. Alert threshold: below 80% of baseline. Dates without saved receipts are not treated as samples; no daily snapshots are saved.`});
    check('collection-baseline',baselineCents>0&&currentCollection<baselineCents*0.8?'alert':'clear',baselineCents>0&&currentCollection<baselineCents*0.8?'':`Today’s ${pkr(currentCollection)} is not below 80% of the ${matchingWeekdays.length}-sample comparable weekday baseline (${pkr(baselineCents)}).`);
  }

  return{asOf,alerts,insufficient,checks,allClear:alerts.length===0&&insufficient.length===0,manualStatusNote:'Manual Offline status is not a verified network outage and is not used as an alert.'};
}
