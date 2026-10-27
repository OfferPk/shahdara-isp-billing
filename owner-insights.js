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
    tenure,estimatedFutureValue:estimatedFutureCents===null?null:amount(estimatedFutureCents),estimatedFutureValueBasis
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

// ============================================================================
// Owner Assistant question understanding (LOCAL-ONLY, READ-ONLY).
// A much stronger local parser over the saved ledger: trilingual keyword and
// Roman-Urdu variant handling, day/week/range/month periods, amounts with
// k/hazar/lakh units, fuzzy customer-name matching with ambiguity handling,
// and a suggestion-based fallback instead of a dead-end help paragraph.
// Every figure is computed from the real state through the same allocation
// logic as the rest of the app; nothing is estimated or invented.
// ============================================================================

const MONTH_NAMES_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MONTH_NAMES_UR = ['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'];
const ROMAN_MONTHS = [['jan','january'],['feb','february'],['mar','march'],['apr','april'],['may','may'],['jun','june'],['jul','july'],['aug','august'],['sep','september'],['sept','september'],['oct','october'],['nov','november'],['dec','december']];

function normalizeQueryText(query) {
  return String(query ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}
const queryTokens = text => String(text ?? '').replace(/[؟?!.،,؛;:'"()«»\-–—/]/g, ' ').split(/\s+/).filter(Boolean);

// Roman-Urdu spelling variants folded to one canonical token so intent cues
// survive casual spelling ("ajj", "howy", "bakaya", "wasuli", ...).
const TOKEN_FOLDS = new Map(Object.entries({
  ajj:'aaj', aj:'aaj', aaj:'aaj',
  kon:'kaun', kaun:'kaun', kisne:'kis', kis:'kis',
  hovy:'hue', huay:'hue', huye:'hue', hue:'hue',
  maheena:'mahina', maheene:'mahina', mahine:'mahina', mahina:'mahina', mahiny:'mahina',
  bakaya:'baqaya', baqaya:'baqaya', baki:'baqi', baqi:'baqi',
  wasuli:'wasool', vasool:'wasool', wasool:'wasool',
  kharch:'kharcha', kharcha:'kharcha', kharche:'kharcha',
  diya:'di', dia:'di', diye:'di', di:'di',
  aaya:'aya', aya:'aya',
  kitne:'kitna', kitni:'kitna', kitna:'kitna',
  ziada:'zyada', zyada:'zyada',
  pichlay:'pichhla', pichle:'pichhla', pichla:'pichhla', pichhle:'pichhla', pichhla:'pichhla',
  batayen:'batao', bataen:'batao',
  walay:'wale', waley:'wale', wale:'wale',
  sub:'sab', sb:'sab',
  naye:'naye', naya:'naya', nai:'nayi', nayi:'nayi',
  lagay:'lage', lage:'lage'
}));
const foldToken = token => TOKEN_FOLDS.get(token) ?? token;
const foldedTokenSet = text => new Set(queryTokens(text).map(foldToken));

function selectedMonth(query, referenceDate) {
  const current = monthFor(referenceDate), text = normalizeQueryText(query);
  if (/\b(last|previous|pichle|pichlay|pichhle|pichhla|pichla|guzishta)\s+(month|mahina|mahine|maheena|maheene)\b|پچھلے مہینے|گزشتہ ماہ/u.test(text)) return shiftMonth(current, -1);
  let index = MONTH_NAMES_EN.findIndex(name => text.includes(name));
  if (index < 0) index = MONTH_NAMES_UR.findIndex(name => text.includes(name));
  if (index < 0) { const roman = ROMAN_MONTHS.find(([short]) => new RegExp(`\\b${short}\\.?\\b`, 'u').test(text)); if (roman) index = MONTH_NAMES_EN.indexOf(roman[1]); }
  if (index >= 0) { const year = text.match(/\b(20\d{2})\b/)?.[1] ?? current.slice(0, 4); return `${year}-${String(index + 1).padStart(2, '0')}`; }
  return current;
}
function namedMonths(text, referenceDate) {
  const current = monthFor(referenceDate), found = [];
  const push = (index, year) => { if (index >= 0) found.push(`${year ?? current.slice(0, 4)}-${String(index + 1).padStart(2, '0')}`); };
  for (const [i, name] of MONTH_NAMES_EN.entries()) if (new RegExp(`\\b${name}\\b`, 'u').test(text)) push(i, text.match(new RegExp(`${name}\\s+(20\\d{2})`, 'u'))?.[1]);
  for (const [i, name] of MONTH_NAMES_UR.entries()) if (text.includes(name)) push(i, undefined);
  if (!found.length) for (const [short, full] of ROMAN_MONTHS) if (new RegExp(`\\b${short}\\.?\\b`, 'u').test(text)) push(MONTH_NAMES_EN.indexOf(full), undefined);
  return [...new Set(found)];
}

// Periods: a specific day, a rolling/explicit date range, or a month.
// "kal" means yesterday unless the question is clearly future-marked: every
// saved record is historical, so the past reading is the useful one.
function parsePeriod(text, referenceDate) {
  const today = dateFor(referenceDate), current = monthFor(referenceDate), tokens = foldedTokenSet(text);
  const has = (...words) => words.some(word => tokens.has(word));
  const futureMarked = /\b(aane wala|aane wale|agle|agla|next|upcoming)\b/u.test(text) || text.includes('آنے وال');
  const dayPeriod = (date, label) => ({ kind:'day', date, from:date, to:date, label });
  if (!futureMarked && (has('parso', 'parson') || text.includes('پرسوں') || /\bday before yesterday\b/u.test(text))) return dayPeriod(shiftDate(today, -2), 'Day before yesterday');
  if (has('aaj', 'today') || text.includes('آج')) return dayPeriod(today, 'Today');
  if (!futureMarked && (has('yesterday', 'kal') || text.includes('کل') || text.includes('گزشتہ روز'))) return dayPeriod(shiftDate(today, -1), 'Yesterday');
  const lastDays = text.match(/(?:last|past|pichhla|pichhle|pichle|guzishta|گزشتہ|پچھلے)\s*(\d{1,3})\s*(?:days?|din|دن)/u) ?? text.match(/(\d{1,3})\s*(?:din|days?|دن)\s*(?:mein|me|ki|ka|bhar)/u);
  if (lastDays) { const n = Math.max(1, Math.min(366, Number(lastDays[1]))); return { kind:'range', from:shiftDate(today, -(n - 1)), to:today, label:`Last ${n} days` }; }
  if (has('hafta', 'hafte', 'week') || text.includes('ہفتہ')) {
    if (has('pichhla', 'last', 'previous')) return { kind:'range', from:shiftDate(today, -6), to:today, label:'Last 7 days' };
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(), sinceMonday = (dow + 6) % 7;
    return { kind:'range', from:shiftDate(today, -sinceMonday), to:today, label:'This week' };
  }
  const month = selectedMonth(text, referenceDate), clamped = month <= current ? month : current;
  return { kind:'month', month:clamped, from:`${clamped}-01`, to:`${clamped}-31`, label:clamped };
}

// Amounts with units: "5000", "5,000", "5k", "5 hazar", "1 lakh", "۵ ہزار".
function parseAmountToken(raw, unit) {
  const value = Number.parseFloat(String(raw).replaceAll(',', ''));
  if (!Number.isFinite(value)) return null;
  const multiplier = !unit ? 1 : (unit === 'k' || unit === 'hazar' || unit === 'ہزار') ? 1000 : 100000;
  return Math.round(value * multiplier);
}
function parseThreshold(text) {
  const num = '(\\d[\\d,]*(?:\\.\\d+)?)\\s*(k|hazar|lakh|lac|ہزار|لاکھ)?';
  const cue = '(?:above|over|more than|greater than|exceed(?:ing)?|se\\s*zyada|se\\s*ziada|zyada|زیادہ|سے\\s*زیادہ|>)';
  const after = text.match(new RegExp(`${cue}\\s*(?:rs\\.?|pkr)?\\s*${num}`, 'u'));
  if (after) return parseAmountToken(after[1], after[2]);
  const before = text.match(new RegExp(`${num}\\s*(?:rs\\.?|pkr)?\\s*(?:${cue}|outstanding|balance|baqaya)`, 'u'));
  return before ? parseAmountToken(before[1], before[2]) : null;
}
function parseTopN(text) {
  const match = text.match(/\btop\s*(\d{1,2})\b/u) ?? text.match(/\b(\d{1,2})\s*(?:sab se|sab sy|سب سے)/u);
  return match ? Math.max(1, Math.min(50, Number(match[1]))) : 5;
}
function parseDaysCount(text) {
  const match = text.match(/(\d{1,4})\s*(?:din|days?|day|دن)/u);
  return match ? Number(match[1]) : null;
}

const METHOD_ALIASES = [
  { name:'Cash', test:/\b(cash|naqad|naqd|naghdi)\b|نقد/u },
  { name:'Easypaisa', test:/easy\s?paisa|easypaisa|ایزی\s?پیسہ/u },
  { name:'JazzCash', test:/jazz\s?cash|جاز\s?کیش/u },
  { name:'Bank Transfer', test:/\bbank\b|بینک/u },
  { name:'Raast', test:/\braast\b|راست/u }
];
const methodMatchesStored = (canonical, stored) => {
  const value = String(stored ?? '').toLocaleLowerCase('en');
  if (canonical === 'Cash') return !isDigitalMethodName(value);
  return value.includes(canonical.toLocaleLowerCase('en').split(' ')[0]);
};
const isDigitalMethodName = value => /jazz|easy|bank|raast|online/.test(value);

function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = row;
  }
  return previous[b.length];
}

const NAME_STOPWORDS = new Set(['ka','ki','ke','ko','ne','se','mein','me','par','hai','hain','he','tha','thi','the','who','whom','whose','has','have','had','not','no','this','that','these','those','did','does','do','done','was','were','been','being','am','is','are','will','would','can','could','should','get','gets','got','give','gives','tell','told','about','kitna','kitni','kitne','kya','kyun','kab','kahan','kaun','kon','kis','kisne','customer','customers','user','users','subscriber','subscribers','balance','outstanding','remaining','due','dues','baqaya','baqi','bill','check','details','detail','status','history','last','payment','payments','paid','pay','karo','batao','bataen','show','find','what','how','much','many','mujhe','please','wala','wale','wala','walay','aaj','kal','mahina','mahine','month','is','us','es','ye','yeh','wo','woh','total','new','naye','connection','connections','add','added','hue','package','speed','mbps','area','mohalla','collection','expense','kharcha','profit','cash','easypaisa','jazzcash','bank','raast','din','days','hafta','week','sab','zyada','kam','top','defaulter','defaulters','pending','unpaid','di','diya','diy','ada','jama','since','kabse','bhar','aur','or','and','kaunsi','konsi','konsa','liye','apna','apne','mera','mere','hamara','list','names','naam','bata','do','den','kr','kar','krdo','kardo','wali','bane','bana','bani','hua','hui','hoga','hogi','chahiye','chahye','wala']);

// Fuzzy customer matching over the query's name-like tokens. Scores exact
// phrase matches highest, then exact name tokens, small misspellings, and
// prefixes. Close scores are reported as ambiguous instead of guessed.
function matchCustomers(state, text) {
  const tokens = queryTokens(text).filter(token => token.length > 1 && !NAME_STOPWORDS.has(token) && !/^\d+$/.test(token) && !/[^\x00-\x7F]/.test(token));
  if (!tokens.length) return { status:'none', matches:[], nameLike:false, suggestions:[] };
  const phrase = tokens.join(' ');
  const scored = [];
  for (const customer of state.customers ?? []) {
    const nameNorm = normalizeQueryText(customer.name ?? '');
    const nameTokens = queryTokens(nameNorm);
    if (!nameTokens.length) continue;
    let score = 0, hits = 0;
    if (phrase.includes(nameTokens.join(' '))) score += 100;
    for (const token of tokens) {
      if (nameTokens.includes(token)) { score += 10; hits++; }
      else if (token.length >= 4 && nameTokens.some(nameToken => Math.abs(nameToken.length - token.length) <= 1 && editDistance(nameToken, token) <= 1)) { score += 6; hits++; }
      else if (token.length >= 4 && nameTokens.some(nameToken => nameToken.startsWith(token) || token.startsWith(nameToken))) { score += 4; hits++; }
    }
    if (score > 0) scored.push({ customer, score, pure:hits === tokens.length });
  }
  scored.sort((a, b) => b.score - a.score || String(a.customer.name).localeCompare(String(b.customer.name)));
  if (!scored.length) {
    const suggestions = [];
    for (const customer of state.customers ?? []) {
      const nameTokens = queryTokens(normalizeQueryText(customer.name ?? ''));
      if (tokens.some(token => token.length >= 4 && nameTokens.some(nameToken => editDistance(nameToken, token) <= 2))) suggestions.push(customer.name);
      if (suggestions.length >= 3) break;
    }
    return { status:'none', matches:[], nameLike:true, suggestions };
  }
  const top = scored[0];
  const close = scored.filter(row => top.score - row.score <= 3);
  if (close.length === 1) return { status:'one', matches:[top], nameLike:true, suggestions:[] };
  return { status:'many', matches:close.slice(0, 5), nameLike:true, suggestions:[] };
}

const EXAMPLE_QUESTIONS = [
  { question:'Ajj kon sy new customers add hovy?', keys:['new','customer','customers','add','aaj','connection','naye'] },
  { question:'Aaj kis kis ne payment di?', keys:['payment','paid','aaj','kis','di','collection'] },
  { question:'Aaj kis kis ne payment nahi di?', keys:['payment','nahi','pending','aaj','kis','baqaya'] },
  { question:'Is maheene cash kitna aya aur Easypaisa kitna?', keys:['cash','easypaisa','collection','mahina','method','jazzcash'] },
  { question:'Is maheene collection kitni hai?', keys:['collection','mahina','paisa','wasool'] },
  { question:'Pichle maheene se collection zyada hai ya kam?', keys:['pichhla','collection','zyada','kam','compare','mahina'] },
  { question:'Sab se zyada baqaya kis ka hai?', keys:['baqaya','sab','zyada','defaulter','outstanding'] },
  { question:'Is maheene kharcha kis cheez par sab se zyada hua?', keys:['kharcha','expense','category','cheez'] },
  { question:'Area-wise pending kitna hai?', keys:['area','pending','mohalla','baqaya'] },
  { question:'Total kitne customer hain?', keys:['total','customer','customers','kitne','count'] },
  { question:'10 Mbps walay kitne customer hain?', keys:['package','mbps','customer','speed'] },
  { question:'Is maheene profit kitna hai?', keys:['profit','munafa','mahina'] },
  { question:'Ali ne last payment kab di thi?', keys:['last','payment','kab','customer'] }
];
function buildSuggestions(state, text, nameSuggestions = []) {
  const tokens = foldedTokenSet(text);
  const scored = EXAMPLE_QUESTIONS.map(example => ({ question:example.question, score:example.keys.reduce((sum, key) => sum + (tokens.has(key) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  const picked = scored.filter(row => row.score > 0).slice(0, 3).map(row => row.question);
  for (const fallback of ['October collection', 'Ali ka balance', 'Aaj kis kis ne payment nahi di?']) if (picked.length < 3 && !picked.includes(fallback)) picked.push(fallback);
  const nameQuestions = nameSuggestions.map(name => `${name} ka balance?`);
  return [...new Set([...nameQuestions, ...picked])].slice(0, 4);
}
const contains = (text, regex, terms = []) => regex.test(text) || terms.some(term => text.includes(term));

export function answerOwnerCommand(state, query, referenceDate = new Date()) {
  const text = normalizeQueryText(query);
  const current = monthFor(referenceDate), today = dateFor(referenceDate);
  const period = parsePeriod(text, referenceDate);
  const month = (() => { const requested = selectedMonth(text, referenceDate); return requested <= current ? requested : current; })();
  const periodFields = period.kind === 'month' ? { month } : period.kind === 'day' ? { date:period.date, from:period.from, to:period.to, label:period.label } : { from:period.from, to:period.to, label:period.label };
  const tokens = foldedTokenSet(text);
  const has = (...words) => words.some(word => tokens.has(word));
  const isToday = period.kind === 'day' && period.date === today;

  const collectionIntent = contains(text, /\b(collection|collected|receive|received|revenue|income|paisa|paise|wasool|vasool|recovery)\b/u, ['جمع', 'وصولی', 'پیسے آئے', 'آمدنی']);
  const expenseIntent = contains(text, /\b(expense|expenses|expenditure|costs?|kharcha|kharchay|kharch)\b/u, ['اخراجات', 'خرچ']);
  const profitIntent = contains(text, /\b(profit|munafa|net|margin|bachat)\b/u, ['منافع', 'بچت']);
  const paidWords = /\b(paid|pay|payment|payments|jama|adaygi|adaa)\b/u.test(text) || text.includes('ادائیگی') || text.includes('ادا');
  const negatedPay = (/\bnahi(n)?\b/u.test(text) && /\b(di|diya|dia|ki|hua|hue)\b/u.test(text)) || (text.includes('نہیں') && paidWords) || /\b(not paid|did ?n[o']t pay|unpaid)\b/u.test(text);
  const pendingIntent = negatedPay || contains(text, /\b(pending|baqaya|baqi|baki|bakaya|dues?|outstanding|receivables?)\b/u, ['بقایا', 'بقایاجات', 'بقیہ', 'واجب']);
  const customerBillIntent = /\b(?:bill\s+(?:check|status|details)|check\s+bill)\b/u.test(text);
  const outstandingIntent = pendingIntent || contains(text, /\b(balance|remaining)\b/u, ['بقیہ']) || customerBillIntent;
  const whoIntent = has('kis', 'kaun', 'who', 'kisne') || text.includes('کس');
  const paidIntent = !negatedPay && (paidWords || (whoIntent && /\bdi\b/u.test(text)));
  const customerWord = contains(text, /\b(customers?|users?|subscribers?|connections?|gahak|clients?)\b/u, ['گاہک', 'کسٹمر']);
  const newCustomerIntent = customerWord && (/\bnew\b/u.test(text) || has('naye', 'naya', 'nayi', 'add', 'added', 'lage', 'connect', 'connection', 'joined', 'hue') || text.includes('نئے') || text.includes('نیا'));
  const areaIntent = contains(text, /\b(area|areas|mohalla|mohallas|zone|zones|ilaqa)\b/u, ['علاقہ', 'محلہ']);
  const detailIntent = contains(text, /\b(last|kab|since|history|details?|statement|kabse)\b/u, ['آخری']) || has('kab') || (has('total') && /\b(diya|di|paid|chuka)\b/u.test(text));
  const monthNamed = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/u.test(text) || MONTH_NAMES_UR.some(name => text.includes(name));

  const allocations = calculatePaymentAllocations(state);
  const entries = state.customers.flatMap(customer => (customer.bills ?? []).map(bill => ({ customer, bill, due:validPrice(bill.dueAmount) ? cents(bill.dueAmount) : null, balance:validPrice(bill.dueAmount) ? Math.max(0, allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? cents(bill.dueAmount)) : null })));
  const paymentsBetween = (from, to) => state.customers.flatMap(customer => (customer.bills ?? []).flatMap(bill => (bill.payments ?? []).filter(payment => typeof payment.date === 'string' && payment.date >= from && payment.date <= to).map(payment => ({ customer, bill, payment }))));
  const expensesBetween = (from, to) => (state.expenses ?? []).filter(row => typeof row.date === 'string' && row.date >= from && row.date <= to);
  const sumPayments = rows => rows.reduce((sum, row) => sum + cents(row.payment.amount), 0);
  const sumExpenses = rows => rows.reduce((sum, row) => sum + cents(row.amount), 0);
  const periodPayments = paymentsBetween(period.from, period.to), periodExpenses = expensesBetween(period.from, period.to);
  const monthPayments = period.kind === 'month' ? periodPayments : paymentsBetween(`${month}-01`, `${month}-31`);
  const monthExpenses = period.kind === 'month' ? periodExpenses : expensesBetween(`${month}-01`, `${month}-31`);
  const collectionCents = sumPayments(periodPayments), expenseCents = sumExpenses(periodExpenses);
  const monthCollectionCents = sumPayments(monthPayments), monthExpenseCents = sumExpenses(monthExpenses);
  const pending = entries.filter(row => row.bill.month === month && row.due !== null && row.balance > 0);
  const allOutstanding = entries.filter(row => row.due !== null && row.balance > 0);
  const threshold = parseThreshold(text);
  const outstandingByCustomer = () => {
    const groups = new Map();
    for (const row of allOutstanding) {
      const item = groups.get(row.customer.id) ?? { customerId:row.customer.id, customerNumber:row.customer.customerNumber, name:row.customer.name, package:row.customer.packageSpeed || 'Not recorded', cents:0, bills:0, oldestDueDate:null };
      item.cents += row.balance; item.bills++;
      if (isCalendarDate(row.bill.dueDate) && (!item.oldestDueDate || row.bill.dueDate < item.oldestDueDate)) item.oldestDueDate = row.bill.dueDate;
      groups.set(row.customer.id, item);
    }
    return [...groups.values()].map(item => ({ ...item, outstanding:amount(item.cents), overdueDays:item.oldestDueDate ? Math.max(0, daysBetween(today, item.oldestDueDate) ?? 0) : null })).sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  };
  const balanceRow = customer => {
    const rows = entries.filter(row => row.customer.id === customer.id && row.due !== null), selected = rows.find(row => row.bill.month === month), selectedBill = (customer.bills ?? []).find(row => row.month === month);
    const actualPaid = (selectedBill?.payments ?? []).reduce((sum, payment) => sum + cents(payment.amount), 0), credit = allocations.forMonth(customer.id, month)?.creditAppliedCents ?? 0;
    return { customerId:customer.id, customerNumber:customer.customerNumber, name:customer.name, package:customer.packageSpeed || 'Not recorded', month, bill:selected ? amount(selected.due) : null, paid:amount(actualPaid), creditApplied:amount(credit), remaining:selected ? amount(selected.balance) : 0, totalOutstanding:amount(rows.reduce((sum, row) => sum + row.balance, 0)) };
  };

  const matched = matchCustomers(state, text);
  if (isToday && collectionIntent && expenseIntent) return { intent:'daily-summary', date:today, label:'Today', collection:amount(collectionCents), receiptCount:periodPayments.length, expenses:amount(expenseCents), expenseCount:periodExpenses.length };
  if (period.kind === 'range' && collectionIntent && expenseIntent) return { intent:'period-summary', from:period.from, to:period.to, label:period.label, collection:amount(collectionCents), receiptCount:periodPayments.length, expenses:amount(expenseCents), expenseCount:periodExpenses.length, net:amount(collectionCents - expenseCents) };

  if (newCustomerIntent) {
    const rows = state.customers.filter(customer => !customer.archived)
      .map(customer => { const date = isCalendarDate(customer.connectionDate) ? customer.connectionDate : (isCalendarDate(customer.addedOn) ? customer.addedOn : null); return date ? { customer, date } : null; })
      .filter(row => row && row.date >= period.from && row.date <= period.to)
      .sort((a, b) => b.date.localeCompare(a.date) || a.customer.name.localeCompare(b.customer.name))
      .map(({ customer, date }) => ({ customerId:customer.id, customerNumber:customer.customerNumber, name:customer.name, package:customer.packageSpeed || 'Not recorded', area:customer.mohalla?.trim() || customer.zone?.trim() || 'Area not recorded', date }));
    return { intent:'new-customers', ...periodFields, count:rows.length, rows };
  }

  const named = namedMonths(text, referenceDate);
  const compareIntent = contains(text, /\b(vs\.?|versus|compare|compared|comparison|muqabla|difference)\b/u, ['بمقابلہ', 'موازنہ']) || (has('zyada', 'kam') && (has('pichhla') || named.length > 0)) || text.includes('زیادہ ہے یا کم') || (/\b(higher|lower|more|less)\b/u.test(text) && (/\b(last|previous)\b/u.test(text) || has('pichhla') || named.length > 0));
  if (compareIntent && (collectionIntent || expenseIntent || profitIntent || named.length >= 2 || has('zyada', 'kam'))) {
    let monthA, monthB;
    if (named.length >= 2) [monthA, monthB] = [...named].sort();
    else if (named.length === 1) { monthB = named[0] <= current ? named[0] : current; monthA = shiftMonth(monthB, -1); }
    else { monthB = current; monthA = shiftMonth(current, -1); }
    const focus = profitIntent ? 'cashProfit' : expenseIntent ? 'expenses' : 'collection';
    let rows = null;
    try {
      const comparison = buildMonthToMonthComparison(state, monthA, monthB, referenceDate, allocations);
      rows = [['collection', 'Collection'], ['expenses', 'Expenses'], ['cashProfit', 'Cash profit'], ['billedAmount', 'Billed amount']].map(([key, label]) => { const change = comparison.changes[key]; return { key, label, from:change.from, to:change.to, change:change.absoluteChange, percentChange:change.percentChange }; }).filter(row => row.from !== null && row.to !== null);
    } catch { rows = null; }
    if (!rows) {
      const facts = m => { const c = sumPayments(paymentsBetween(`${m}-01`, `${m}-31`)), e = sumExpenses(expensesBetween(`${m}-01`, `${m}-31`)); return { collection:amount(c), expenses:amount(e), cashProfit:amount(c - e), billedAmount:amount(entries.filter(row => row.bill.month === m && row.due !== null).reduce((sum, row) => sum + row.due, 0)) }; };
      const a = facts(monthA), b = facts(monthB);
      rows = [['collection', 'Collection'], ['expenses', 'Expenses'], ['cashProfit', 'Cash profit'], ['billedAmount', 'Billed amount']].map(([key, label]) => ({ key, label, from:a[key], to:b[key], change:Number((b[key] - a[key]).toFixed(2)), percentChange:a[key] === 0 ? (b[key] === 0 ? 0 : null) : Number(((b[key] - a[key]) / Math.abs(a[key]) * 100).toFixed(1)) }));
    }
    const focusRow = rows.find(row => row.key === focus) ?? rows[0];
    return { intent:'month-comparison', monthA, monthB, focus, rows, direction:focusRow.change > 0 ? 'up' : focusRow.change < 0 ? 'down' : 'same', focusChange:focusRow.change, focusPercentChange:focusRow.percentChange };
  }

  const methodHit = METHOD_ALIASES.find(alias => alias.test.test(text));
  if (!profitIntent && methodHit && (collectionIntent || has('kitna', 'aya', 'collection'))) {
    const groups = new Map();
    for (const row of periodPayments) { const name = String(row.payment.method ?? '').trim() || 'Not recorded'; const group = groups.get(name) ?? { method:name, cents:0, count:0 }; group.cents += cents(row.payment.amount); group.count++; groups.set(name, group); }
    if (![...groups.keys()].some(name => methodMatchesStored(methodHit.name, name))) groups.set(methodHit.name, { method:methodHit.name, cents:0, count:0 });
    const rows = [...groups.values()].map(group => ({ method:group.method, amount:amount(group.cents), count:group.count })).sort((a, b) => b.amount - a.amount);
    const focusAmount = rows.filter(row => methodMatchesStored(methodHit.name, row.method)).reduce((sum, row) => sum + cents(row.amount), 0);
    return { intent:'method-collection', ...periodFields, rows, total:amount(collectionCents), receiptCount:periodPayments.length, focusMethod:methodHit.name, focusAmount:amount(focusAmount) };
  }
  if (!profitIntent && collectionIntent && !areaIntent && /\b(wise|split|breakdown|methods?|alag)\b/u.test(text)) {
    const groups = new Map();
    for (const row of periodPayments) { const name = String(row.payment.method ?? '').trim() || 'Not recorded'; const group = groups.get(name) ?? { method:name, cents:0, count:0 }; group.cents += cents(row.payment.amount); group.count++; groups.set(name, group); }
    const rows = [...groups.values()].map(group => ({ method:group.method, amount:amount(group.cents), count:group.count })).sort((a, b) => b.amount - a.amount);
    return { intent:'method-collection', ...periodFields, rows, total:amount(collectionCents), receiptCount:periodPayments.length, focusMethod:null, focusAmount:null };
  }

  if (paidIntent && whoIntent) {
    const rows = periodPayments.filter(row => Number.isFinite(Number(row.payment.amount)) && Number(row.payment.amount) > 0)
      .map(row => ({ customerId:row.customer.id, customerNumber:row.customer.customerNumber, name:row.customer.name, amount:amount(cents(row.payment.amount)), method:String(row.payment.method ?? '').trim() || 'Not recorded', date:row.payment.date }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
    return { intent:'paid-list', ...periodFields, rows, total:amount(rows.reduce((sum, row) => sum + cents(row.amount), 0)), count:rows.length };
  }

  if (expenseIntent && (contains(text, /\b(breakdown|break-?down|category|categories|wise|top|highest|sab se|sab sy)\b/u, ['کس چیز', 'زمرہ']) || has('cheez'))) {
    const groups = new Map();
    for (const row of periodExpenses) { const name = String(row.category ?? '').trim() || 'Not recorded'; const group = groups.get(name) ?? { category:name, cents:0, count:0 }; group.cents += cents(row.amount); group.count++; groups.set(name, group); }
    const rows = [...groups.values()].map(group => ({ category:group.category, amount:amount(group.cents), count:group.count })).sort((a, b) => b.amount - a.amount);
    return { intent:'expense-breakdown', ...periodFields, rows, total:amount(expenseCents), expenseCount:periodExpenses.length };
  }

  const allAreas = [...new Set(state.customers.map(customer => customer.mohalla?.trim() || customer.zone?.trim()).filter(Boolean))];
  const namedArea = allAreas.find(label => text.includes(normalizeQueryText(label))) ?? null;
  if (areaIntent && collectionIntent && !pendingIntent) {
    const groups = new Map();
    for (const row of periodPayments) { const label = row.customer.mohalla?.trim() || row.customer.zone?.trim() || 'Area not recorded'; const group = groups.get(label) ?? { area:label, cents:0, ids:new Set(), count:0 }; group.cents += cents(row.payment.amount); group.ids.add(row.customer.id); group.count++; groups.set(label, group); }
    let rows = [...groups.values()].map(group => ({ area:group.area, amount:amount(group.cents), customers:group.ids.size, receipts:group.count })).sort((a, b) => b.amount - a.amount);
    if (namedArea) rows = rows.filter(row => row.area === namedArea);
    return { intent:'area-collection', ...periodFields, rows, total:amount(rows.reduce((sum, row) => sum + cents(row.amount), 0)), areaFilter:namedArea };
  }
  if (areaIntent && pendingIntent) {
    const groups = new Map();
    for (const row of pending) { const label = row.customer.mohalla?.trim() || row.customer.zone?.trim() || 'Area not recorded'; const group = groups.get(label) ?? { area:label, cents:0, ids:new Set() }; group.cents += row.balance; group.ids.add(row.customer.id); groups.set(label, group); }
    const rows = [...groups.values()].map(row => ({ area:row.area, outstanding:amount(row.cents), customers:row.ids.size })).sort((a, b) => b.outstanding - a.outstanding);
    return { intent:'area-pending', month, rows };
  }

  const defaulterIntent = /\b(defaulter|defaulters)\b/u.test(text) || (outstandingIntent && ((has('sab') && has('zyada')) || /\b(highest|biggest|most|top)\b/u.test(text)));
  if (defaulterIntent && threshold === null) {
    const limit = parseTopN(text), rows = outstandingByCustomer().slice(0, limit);
    return { intent:'top-defaulters', rows, total:rows.length, limit };
  }
  if (threshold !== null && outstandingIntent) {
    const rows = outstandingByCustomer().filter(row => row.cents > threshold * 100);
    return { intent:'threshold-outstanding', threshold, rows, total:rows.length };
  }

  const daysMentioned = parseDaysCount(text);
  const overdueIntent = contains(text, /\b(overdue|aging|ageing|purana|purane|purani)\b/u, ['متاخر']) || (daysMentioned !== null && pendingIntent && has('purana', 'purane', 'older', 'zyada', 'din'));
  if (overdueIntent) {
    if (daysMentioned !== null && (has('purana', 'purane', 'older', 'zyada') || /\bolder\b/u.test(text))) {
      const stricter = /\b(zyada|older|more|above|over)\b/u.test(text) || text.includes('زیادہ');
      const rows = outstandingByCustomer().filter(row => row.overdueDays !== null && (stricter ? row.overdueDays > daysMentioned : row.overdueDays >= daysMentioned));
      return { intent:'overdue-aging', minDays:daysMentioned, rows, total:rows.length };
    }
    const buckets = [['1–30 days', 1, 30], ['31–60 days', 31, 60], ['61–90 days', 61, 90], ['90+ days', 91, Infinity]].map(([label, lo, hi]) => ({ label, lo, hi, cents:0, bills:0, ids:new Set() }));
    for (const row of allOutstanding) {
      if (!isCalendarDate(row.bill.dueDate)) continue;
      const age = daysBetween(today, row.bill.dueDate);
      if (age === null || age < 1) continue;
      const bucket = buckets.find(item => age >= item.lo && age <= item.hi);
      if (bucket) { bucket.cents += row.balance; bucket.bills++; bucket.ids.add(row.customer.id); }
    }
    const rows = buckets.filter(bucket => bucket.cents > 0).map(bucket => ({ label:bucket.label, amount:amount(bucket.cents), bills:bucket.bills, customers:bucket.ids.size }));
    return { intent:'overdue-aging', rows, total:amount(rows.reduce((sum, row) => sum + cents(row.amount), 0)) };
  }

  const packageSpeedMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mbps|mb\b|mega)/u);
  const packageWord = contains(text, /\b(package|packages|speed|plan|plans)\b/u, ['پیکیج', 'پلان']);
  if (packageSpeedMatch || (packageWord && (customerWord || has('kitna')))) {
    const allPackages = [...new Set(state.customers.map(customer => (customer.packageSpeed ?? '').trim()).filter(Boolean))];
    const duesOf = id => allOutstanding.filter(row => row.customer.id === id).reduce((sum, row) => sum + row.balance, 0);
    let target = null, wanted = null;
    if (packageSpeedMatch) { wanted = Number.parseFloat(packageSpeedMatch[1]); target = allPackages.find(name => Number.parseFloat(String(name).replace(',', '.')) === wanted) ?? `${packageSpeedMatch[1]} Mbps`; }
    else target = allPackages.find(name => text.includes(normalizeQueryText(name))) ?? null;
    if (target) {
      const members = state.customers.filter(customer => !customer.archived && (customer.packageSpeed ?? '').trim() && (wanted !== null ? Number.parseFloat(String(customer.packageSpeed).replace(',', '.')) === wanted : (customer.packageSpeed ?? '').trim() === target));
      const rows = members.map(customer => ({ customerId:customer.id, customerNumber:customer.customerNumber, name:customer.name, package:target, outstanding:amount(duesOf(customer.id)) })).sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
      return { intent:'package-customers', package:target, count:rows.length, duesTotal:amount(rows.reduce((sum, row) => sum + cents(row.outstanding), 0)), rows };
    }
    const rows = allPackages.map(name => { const members = state.customers.filter(customer => !customer.archived && (customer.packageSpeed ?? '').trim() === name); return { package:name, customers:members.length, duesTotal:amount(members.reduce((sum, customer) => sum + duesOf(customer.id), 0)) }; }).sort((a, b) => b.customers - a.customers || a.package.localeCompare(b.package));
    return { intent:'package-customers', package:null, distribution:true, count:rows.reduce((sum, row) => sum + row.customers, 0), duesTotal:amount(rows.reduce((sum, row) => sum + cents(row.duesTotal), 0)), rows };
  }

  if ((customerWord || /\bbills?\b/u.test(text)) && matched.status === 'none' && !negatedPay && !packageSpeedMatch && (has('total', 'kul', 'overall', 'count', 'kitna') || /\bhow many\b/u.test(text))) {
    const live = state.customers.filter(customer => !customer.archived);
    return { intent:'counts-overview', month, total:state.customers.length, active:live.filter(customer => customer.serviceStatus === 'active').length, offline:live.filter(customer => customer.serviceStatus === 'offline').length, notSet:live.filter(customer => (customer.serviceStatus ?? 'not-set') === 'not-set').length, archived:state.customers.length - live.length, withDues:new Set(allOutstanding.map(row => row.customer.id)).size, duesTotal:amount(allOutstanding.reduce((sum, row) => sum + row.balance, 0)), billedThisMonth:new Set(entries.filter(row => row.bill.month === month).map(row => row.customer.id)).size };
  }

  if (outstandingIntent && !whoIntent && matched.status === 'none' && !matched.nameLike) {
    const rows = outstandingByCustomer();
    return { intent:'total-outstanding', total:amount(allOutstanding.reduce((sum, row) => sum + row.balance, 0)), customers:rows.length };
  }
  if (matched.status === 'many' && (outstandingIntent || detailIntent)) {
    return { intent:'customer-candidates', month, rows:matched.matches.map(row => balanceRow(row.customer)) };
  }
  if (matched.status === 'one' && (outstandingIntent || detailIntent || paidIntent)) {
    const customer = matched.matches[0].customer;
    if (detailIntent) {
      const behavior = buildCustomerPaymentBehavior(state, customer, referenceDate, allocations);
      const lifetime = buildCustomerLifetimeValue(state, customer, referenceDate);
      const last = behavior.receipts[0] ?? null;
      return { intent:'customer-detail', month, customerId:customer.id, customerNumber:customer.customerNumber, name:customer.name, package:customer.packageSpeed || 'Not recorded', area:customer.mohalla?.trim() || customer.zone?.trim() || 'Area not recorded', since:isCalendarDate(customer.connectionDate) ? customer.connectionDate : (isCalendarDate(customer.addedOn) ? customer.addedOn : null), totalOutstanding:behavior.totalOutstanding, currentBill:behavior.currentBill, lastPayment:last ? { date:last.date, amount:Number(last.amount), method:String(last.method ?? '').trim() || 'Not recorded' } : null, totalPaid:lifetime.totalHistoricalRevenue, totalPayments:lifetime.receiptCount, healthScore:behavior.health.score, healthCategory:behavior.health.category };
    }
    return { intent:'customer-balance', month, rows:[balanceRow(customer)] };
  }
  if (matched.status === 'one' && matched.matches[0].pure && !collectionIntent && !expenseIntent && !profitIntent) {
    return { intent:'customer-balance', month, rows:[balanceRow(matched.matches[0].customer)] };
  }

  if (pendingIntent) {
    const rows = pending.map(row => ({ customerId:row.customer.id, customerNumber:row.customer.customerNumber, name:row.customer.name, package:row.customer.packageSpeed || 'Not recorded', bill:amount(row.due), paid:amount((row.bill.payments ?? []).reduce((sum, payment) => sum + cents(payment.amount), 0)), remaining:amount(row.balance), dueDate:row.bill.dueDate ?? null }));
    return { intent:'pending-list', month, rows, pendingTotal:amount(rows.reduce((sum, row) => sum + cents(row.remaining), 0)) };
  }
  if (profitIntent) {
    if (period.kind === 'day') return { intent:'daily-summary', date:period.date, label:period.label, collection:amount(collectionCents), receiptCount:periodPayments.length, expenses:amount(expenseCents), expenseCount:periodExpenses.length };
    if (period.kind === 'range') return { intent:'period-summary', from:period.from, to:period.to, label:period.label, collection:amount(collectionCents), receiptCount:periodPayments.length, expenses:amount(expenseCents), expenseCount:periodExpenses.length, net:amount(collectionCents - expenseCents) };
    return { intent:'monthly-profit', month, collection:amount(monthCollectionCents), expenses:amount(monthExpenseCents), profit:amount(monthCollectionCents - monthExpenseCents), receiptCount:monthPayments.length, expenseCount:monthExpenses.length, basis:'Actual cash receipts minus recorded expenses; unpaid bills, inventory book value and estimated costs are excluded.' };
  }
  if (expenseIntent) {
    if (period.kind === 'day') return { intent:'daily-expenses', date:period.date, label:period.label, expenses:amount(expenseCents), expenseCount:periodExpenses.length };
    if (period.kind === 'range') return { intent:'period-expenses', from:period.from, to:period.to, label:period.label, expenses:amount(expenseCents), expenseCount:periodExpenses.length };
    return { intent:'monthly-expenses', month, expenses:amount(monthExpenseCents), expenseCount:monthExpenses.length };
  }
  if (collectionIntent || monthNamed) {
    if (period.kind === 'day') return { intent:'daily-collection', date:period.date, label:period.label, collection:amount(collectionCents), receiptCount:periodPayments.length };
    if (period.kind === 'range') return { intent:'period-collection', from:period.from, to:period.to, label:period.label, collection:amount(collectionCents), receiptCount:periodPayments.length };
    return { intent:'monthly-collection', month, collection:amount(monthCollectionCents), receiptCount:monthPayments.length };
  }
  return { intent:'help', message:'I could not match that question to the saved records, and nothing was changed. Try one of these instead:', suggestions:buildSuggestions(state, text, matched.suggestions) };
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
function healthFactor(id,label,value,score,basis,unavailableReason='',nextStep='') {
  const available=score!==null&&Number.isFinite(score);
  return{id,label,value:value===null||!Number.isFinite(value)?null:Number(value),quality:available?Number(clamp(score,0,100).toFixed(1)):null,weight:BUSINESS_HEALTH_WEIGHTS[id],basis,unavailableReason,nextStep,available};
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
    healthFactor('collectionRate','Receipt-date collection rate',collectionRate,collectionRate===null?null:collectionRate/90*100,`${moneyBasis} Divided by ${pkr(billCents)} of saved priced service-month bills. ${billBasis} Score: 0%→0; 90% or more→100, linearly between.`,billCents===0?'Not available: no priced bill amount is recorded for this three-month window.':'',"What unlocks this: generate bills for a month (Bills screen) and record the payments that come in. Bills and receipts from completed months count here — the current month joins after it ends."),
    healthFactor('outstandingRatio','Outstanding-balance ratio',outstandingRatio,outstandingRatio===null?null:(1-outstandingRatio/50)*100,`${pkr(outstandingCents)} outstanding ÷ ${pkr(billCents)} saved priced bill amount. ${outstandingSources} Score: 0%→100; 50% or more→0, linearly between.`,billCents===0?'Not available: no priced bill amount is recorded for this three-month window.':'',"What unlocks this: priced bills from a completed month. Set each customer's monthly fee (Collect, then Set packages and monthly fee), generate the month's bills, and this ratio appears after month-end."),
    healthFactor('cashProfitMargin','Cash-profit margin',cashProfitMargin,cashProfitMargin===null?null:(cashProfitMargin+20)/50*100,`${pkr(receiptCents)} actual receipts − ${pkr(expenseCents)} dated expenses = ${pkr(cashProfitCents)} cash profit, divided by actual receipts. ${receipts.length} receipt(s), ${expenses.length} expense(s). This is cash profit, not accrual/accounting profit. Score: −20%→0; +30% or more→100, linearly between.`,receiptCents===0?'Not available: no positive actual receipts are recorded, so the margin denominator is zero.':'',"What unlocks this: record at least one payment in a completed month (Quick Collect). Receipts count by payment date, so this month's collections join after month-end."),
    healthFactor('expenseRatio','Recorded-expense ratio',expenseRatio,expenseRatio===null?null:expenseRatio<=20?100:(70-expenseRatio)/50*100,`${pkr(expenseCents)} dated recorded expenses ÷ ${pkr(receiptCents)} actual receipt-date collection; ${expenses.length} expense(s). Score: 20% or less→100; 70% or more→0, linearly between. This overlaps mathematically with cash-profit margin.`,receiptCents===0?'Not available: no positive actual receipts are recorded, so the ratio denominator is zero.':'',"What unlocks this: record at least one payment in a completed month (Quick Collect) — the ratio then compares that window's recorded expenses with its receipts."),
    healthFactor('customerGrowth','Dated customer growth',growthRate,growthRate===null?null:50+growthRate/10*50,`${growthRate===null?'No complete dated-growth rate can be calculated.':`${newCustomers} new profile(s) with a saved added-on date ÷ ${openingCustomerBase} opening profiles = ${growthRate.toFixed(1)}%.`} ${openingBasis} Score: 0% growth→50; 10% or more→100, linearly between. Profile additions are not necessarily new network connections.`,!allAddedDatesRecorded?'Not available: one or more profiles have no valid saved added-on date, so dated additions may be incomplete.':openingCustomerBase===0?'Not available: the opening profile count is zero or unavailable.':'',"What unlocks this: profiles with a saved added-on date. Customers added in the app get one automatically; profiles without that date keep this factor off until every profile has one."),
    healthFactor('documentedChurn','Documented cancellation / archive rate',churnRate,churnRate===null?null:(1-churnRate/10)*100,`${documentedChurnCount} distinct profile(s) with an explicit saved cancellation date or a still-present archive timestamp ÷ ${churnBase??'unavailable'} profiles present or added during the window = ${churnRate===null?'Not available':`${churnRate.toFixed(1)}%`}. ${openingBasis} Current Active/Offline labels are not used. Cleared archive timestamps after unarchive and undated events cannot be recovered, so this is documented churn only. Score: 0%→100; 10% or more→0, linearly between.`,!allAddedDatesRecorded?'Not available: the opening profile history is incomplete because some added-on dates are missing.':churnBase===0?'Not available: the recorded profile population is zero or unavailable.':documentedChurnCount===0?'Not available: no dated cancellation/archive event in this window establishes a recorded churn rate; absence is not assumed to mean zero churn.':'',"What unlocks this: a dated record when someone leaves — set a cancellation date on the profile or archive it. Undated departures are never guessed, so this stays off until a dated event exists in the window." )
  ];
  const available=factors.filter(row=>row.available),availableWeight=available.reduce((sum,row)=>sum+row.weight,0);
  const normalized=available.map(row=>{const effectiveWeight=row.weight/availableWeight*100,contribution=row.quality*effectiveWeight/100;return{...row,effectiveWeight:Number(effectiveWeight.toFixed(1)),contribution:Number(contribution.toFixed(1)),polarity:row.quality>=60?'positive':row.quality<=40?'negative':'neutral'};});
  const score=available.length?Number((normalized.reduce((sum,row)=>sum+row.contribution,0)).toFixed(1)):null;
  return{score,category:score===null?'Insufficient recorded metrics':score>=80?'Strong recorded indicators':score>=60?'Mixed recorded indicators':'Needs attention',asOf:dateFor(referenceDate),window:{startMonth:firstMonth,endMonth:lastCompleteMonth,startDate:windowStart,endDate:windowEnd,months},availableFactorCount:available.length,totalFactorCount:factors.length,availableWeight,renormalized:available.length>0&&availableWeight!==100,openingCustomerBase,openingBasis,factors:normalized,unavailableFactors:factors.filter(row=>!row.available)};
}

/** ISP insights strip for the Analytics screen (#361): collection rate this
 * month vs last, an outstanding (overdue) trend over the last four months,
 * and new vs lost customers this month — all from the same saved,
 * report-compatible per-month facts the comparison and health score use.
 * Nulls are preserved (never shown as zero) when a month has no priced
 * bills or no dated profile history. */
export function buildIspInsights(state,referenceDate=new Date(),allocations=calculatePaymentAllocations(state)) {
  const currentMonth=monthFor(referenceDate),lastMonth=shiftMonth(currentMonth,-1);
  const trendMonths=[shiftMonth(currentMonth,-3),shiftMonth(currentMonth,-2),lastMonth,currentMonth];
  const facts=new Map(trendMonths.map(month=>[month,monthComparisonFacts(state,month,referenceDate,allocations)]));
  const cur=facts.get(currentMonth),prev=facts.get(lastMonth);
  const rateRow=f=>({month:f.month,rate:f.collectionRate,billed:f.billedAmount,collected:f.collection,receiptCount:f.collectionReceiptCount});
  const collection={
    thisMonth:rateRow(cur),
    lastMonth:rateRow(prev),
    deltaPoints:cur.collectionRate!==null&&prev.collectionRate!==null?Number((cur.collectionRate-prev.collectionRate).toFixed(1)):null
  };
  const overdueTrend=trendMonths.map(month=>{const f=facts.get(month);return{month,outstanding:f.outstanding,source:f.outstandingSource};});
  const lostThisMonth=cur.disconnectedCustomers!==null&&cur.archivedCustomers!==null?cur.disconnectedCustomers+cur.archivedCustomers:null;
  return{
    asOf:dateFor(referenceDate),
    currentMonth,
    lastMonth,
    collection,
    overdueTrend,
    newThisMonth:cur.newCustomers,
    newConnectionsThisMonth:cur.newConnections,
    disconnectedThisMonth:cur.disconnectedCustomers,
    archivedThisMonth:cur.archivedCustomers,
    lostThisMonth
  };
}

/** Area, zone & package breakdowns for the Analytics screen (#361).
 * Bill-level grouping over saved priced bills up to the current Pakistan
 * month. Every priced bill belongs to exactly one area group, one zone
 * group and one package group, so billed/collected/outstanding/overdue
 * totals reconcile across the three breakdowns and with the priced-bill
 * ledger totals. Collected counts receipts recorded on the group's bills
 * (a rate can exceed 100% where receipts exceed priced bills — the same
 * convention as the health-score collection rate). Outstanding is the
 * payment-allocation balance, never recomputed. Overdue is as of today
 * (PKT): a bill whose due date has passed and whose allocation balance
 * is still positive; a bill due today is not overdue. Unpriced bills are
 * excluded (no price to bill) and counted separately; future service
 * months are excluded. Saved bills of archived profiles are included as
 * ledger history. Groups exist only where a priced bill exists, so every
 * shown group has a collection rate; customers without priced bills do
 * not appear. Area is the customer's saved area or mohalla; zone rows
 * carry their parent area so same-named zones in different areas stay
 * separate; package is the recorded package on each bill (snapshot or
 * dated history). Customer counts are distinct customers with at least
 * one priced bill in the group, so package counts do not sum — one
 * customer can hold bills under several recorded packages over time. */
const areaBreakdownLabel = customer => String(customer?.area ?? '').trim() || String(customer?.mohalla ?? '').trim() || 'Area not recorded';
const zoneBreakdownLabel = customer => {
  const zone = String(customer?.zone ?? '').trim();
  if (!zone) return 'Zone not recorded';
  const area = areaBreakdownLabel(customer);
  return area === 'Area not recorded' ? zone : `${area} · ${zone}`;
};
export function buildAreaBreakdowns(state, referenceDate = new Date(), allocations = calculatePaymentAllocations(state)) {
  const asOf = dateFor(referenceDate), currentMonth = monthFor(referenceDate);
  const groups = { area: new Map(), zone: new Map(), package: new Map() };
  const ensure = (map, key) => {
    let group = map.get(key);
    if (!group) { group = { name: key, customers: new Set(), billedCents: 0, collectedCents: 0, outstandingCents: 0, overdueBills: 0, overdueCustomers: new Set() }; map.set(key, group); }
    return group;
  };
  let pricedBillCount = 0, unpricedBillCount = 0;
  for (const customer of state.customers ?? []) {
    const area = areaBreakdownLabel(customer), zone = zoneBreakdownLabel(customer);
    for (const bill of customer.bills ?? []) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(bill.month ?? '')) || bill.month > currentMonth) continue;
      if (!validPrice(bill.dueAmount)) { unpricedBillCount++; continue; }
      pricedBillCount++;
      const dueCents = cents(bill.dueAmount);
      const balanceCents = Math.max(0, allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? dueCents);
      const collectedCents = (bill.payments ?? []).filter(payment => Number.isFinite(Number(payment.amount)) && Number(payment.amount) > 0).reduce((sum, payment) => sum + cents(payment.amount), 0);
      const pkg = recordedPackageForMonth(customer, bill, bill.month) ?? 'Package not recorded';
      const overdue = /^\d{4}-\d{2}-\d{2}$/.test(bill.dueDate ?? '') && bill.dueDate < asOf && balanceCents > 0;
      for (const [map, key] of [[groups.area, area], [groups.zone, zone], [groups.package, pkg]]) {
        const group = ensure(map, key);
        group.customers.add(customer.id);
        group.billedCents += dueCents; group.collectedCents += collectedCents; group.outstandingCents += balanceCents;
        if (overdue) { group.overdueBills++; group.overdueCustomers.add(customer.id); }
      }
    }
  }
  const finish = map => [...map.values()].map(group => ({
    name: group.name, customers: group.customers.size,
    billed: amount(group.billedCents), collected: amount(group.collectedCents), outstanding: amount(group.outstandingCents),
    collectionRate: group.billedCents ? Number((group.collectedCents / group.billedCents * 100).toFixed(1)) : null,
    overdueBills: group.overdueBills, overdueCustomers: group.overdueCustomers.size,
  })).sort((a, b) => b.outstanding - a.outstanding || b.billed - a.billed || a.name.localeCompare(b.name));
  const areas = finish(groups.area), zones = finish(groups.zone), packages = finish(groups.package);
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  return {
    asOf, currentMonth, pricedBillCount, unpricedBillCount, areas, zones, packages,
    totals: { billed: sum(areas, 'billed'), collected: sum(areas, 'collected'), outstanding: sum(areas, 'outstanding'), overdueBills: sum(areas, 'overdueBills') },
  };
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
