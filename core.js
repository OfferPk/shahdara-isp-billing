import { validatePhase3State, buildManualPayrollSummary, monthEnd, PAYROLL_RULES_EFFECTIVE_DATE, SAAD_BASE_MONTHLY_SALARY, SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY } from './phase3.js';

export const INITIAL_NAMES = Object.freeze([
  'NAZEER','AWAIS','TEHMENA','SAFEER','KHALEEL','DARBAR','ALI SHAH','ZARSHAD KHAN','AC HOUSE','MNA HOUSE','CH BILAL','MUHAMMAD QASIM','RAJA JUNAID','RAJA USAMA','PATHAN','HASEEB','RAJA BILAL','QARI MUBASIR','FAREED ABBASI','JAWAD RAJA','HAJI ZAFAR','DOCTOR ZAHID','DOCTER EHSAN','AQIB OWNER','SAQIB EJAZ','RAJA RIAZ','RAJA JAHANGEER','RAJA NOMI','RAJA MOHSIN','MUFTI SADAQAT','TOUSEEF RAJA','KIRAN BILAL','SIKANDAR ABBASI','RAJA FAISAL','RAJA ALI','RAJA SHUNAID','BUT HOUSE','AZEEM BAJWA HOUSE','BANGISH HOUSE','RAJA HAFEEZ','RAJA KHAZER','ZUBAIR USTAD','MEHMOOD ABBASI','RAJA ARIF','RAJA SHEHZAD','KASHIF RAJA','KASHIF ABBASI','SAJID','PTA DIRECTOR','RAJA IRFAN','RAJA FAIZAN','BABAR','CH MURTAZA','QARI BAKAR BAKAR','CH MOIZ','CH SAQLAIN','RAJA MUJAHID','RAJA MASROOR','RAJA TAIMOOR MANGRAYAL','RAJA TAIMOOR CHANDALL','MOBEEN SHAH','NADIR SHAH','SHAH NAWAZ','SHADI','RAB NAWAZ','FAISAL GUJJAR','CH HAMZA','CH SHAFEEQ','CH SANWALL','NADIR GUJJAR','RAJA ASAD','DC HOUSE','AKHTAR HOUSE','SSP HOUSE'
]);
export const PAYMENT_METHODS = Object.freeze(['Cash','JazzCash','Easypaisa','Bank Transfer']);
export const MONTH_LIMIT = 24;
export const STORAGE_KEY = 'shahdara-isp-billing-v1';
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const moneyCents = value => Math.round(Number(value || 0) * 100);
const moneyValue = cents => Number((cents / 100).toFixed(2));
export function formatPKR(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits:Number.isInteger(amount) ? 0 : 2, maximumFractionDigits:2 });
  return `PKR ${formatter.format(amount)}`;
}
export const PAKISTAN_TIME_ZONE = 'Asia/Karachi';
function zonedParts(date, options) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', { ...options, timeZone:PAKISTAN_TIME_ZONE }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}
const monthKey = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit' }); return `${p.year}-${p.month}`; };
function shiftMonth(month, delta) { const [year, number] = month.split('-').map(Number); const index = year * 12 + number - 1 + delta; return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`; }
const nextMonthKey = month => shiftMonth(month, 1);
const dateKey = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit', day:'2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
const offsetDateKey = (date, days) => { const shifted = new Date(`${date}T00:00:00.000Z`); shifted.setUTCDate(shifted.getUTCDate() + days); return shifted.toISOString().slice(0, 10); };
const localDateTimeValue = date => { const p = zonedParts(date, { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1 || wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour || wallClock.getUTCMinutes() !== minute) return null;
  return wallClock.getTime() - 5 * 60 * 60 * 1000;
}

export function createInitialState(names = INITIAL_NAMES) {
  return { version: 1, nextCustomerNumber: names.length + 1, customers: names.map((name, index) => ({ id: `seed-${String(index + 1).padStart(3, '0')}`, customerNumber: index + 1, name, mohalla: '', zone:'', address: '', phone: '', ispProvider:'', serviceStatus:'not-set', packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], archived:false, archivedAt:null, bills: [], incidents: [] })), inventoryItems:[], inventoryMovements:[], expenses:[],saadAttendanceDays:[],umairWorkdays:[] };
}

export function readState(storage, key = STORAGE_KEY) {
  const raw = storage.getItem(key);
  if (raw === null) return createInitialState();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Saved billing data is malformed. It was not changed. Use a JSON backup to recover it.'); }
  if (parsed?.version !== 1 || !Array.isArray(parsed.customers)) throw new Error('Saved billing data has an unsupported version or structure. It was not changed. Use a JSON backup to recover it.');
  if (!parsed.customers.every(customer => customer && typeof customer === 'object' && typeof customer.name === 'string' && customer.name.trim())) throw new Error('Saved billing data contains an invalid customer record. It was not changed. Use a JSON backup to recover it.');
  const numberCounts = new Map();
  for (const customer of parsed.customers) if (Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0) numberCounts.set(customer.customerNumber, (numberCounts.get(customer.customerNumber) ?? 0) + 1);
  const reserved = new Set([...numberCounts].filter(([, count]) => count === 1).map(([number]) => number));
  const storedNext = Number.isSafeInteger(parsed.nextCustomerNumber) && parsed.nextCustomerNumber > 0 ? parsed.nextCustomerNumber : INITIAL_NAMES.length + 1;
  let nextAvailable = Math.max(storedNext, ...reserved, 0);
  const migrationDate = new Date();
  const currentMonth = monthKey(migrationDate);
  const used = new Set();
  const customers = parsed.customers.map((customer, index) => {
    let customerNumber = Number.isSafeInteger(customer.customerNumber) && customer.customerNumber > 0 && numberCounts.get(customer.customerNumber) === 1 ? customer.customerNumber : null;
    if (customerNumber === null) {
      const legacyNumber = index + 1;
      if (!reserved.has(legacyNumber) && !used.has(legacyNumber)) customerNumber = legacyNumber;
      else {
        while (reserved.has(nextAvailable) || used.has(nextAvailable)) nextAvailable++;
        customerNumber = nextAvailable++;
      }
    }
    used.add(customerNumber);
    let bills = (Array.isArray(customer.bills) ? customer.bills : []).map(bill => ({ ...bill, dueDate:checkOptionalDate(bill.dueDate ?? null), amountHistory:Array.isArray(bill.amountHistory) ? bill.amountHistory : [] }));
    const monthlySellingAmount = customer.monthlySellingAmount ?? null;
    let monthlyPriceSchedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
    if (monthlySellingAmount !== null && monthlySellingAmount !== undefined && monthlySellingAmount !== '' && monthlyPriceSchedule.length === 0) {
      const currentBillIndex = bills.findIndex(bill => bill.month === currentMonth);
      let effectiveMonth = currentMonth;
      if (currentBillIndex >= 0) {
        effectiveMonth = nextMonthKey(currentMonth);
        const currentBill = bills[currentBillIndex];
        if (currentBill.dueAmount === null || currentBill.dueAmount === undefined || currentBill.dueAmount === '') bills[currentBillIndex] = { ...currentBill, dueAmount:Number(monthlySellingAmount), generated:true, priceSnapshot:Number(monthlySellingAmount), createdAt:currentBill.createdAt ?? localDateTimeValue(migrationDate), amountHistory:currentBill.amountHistory };
      }
      monthlyPriceSchedule = [{ amount:Number(monthlySellingAmount), effectiveMonth, recordedAt:localDateTimeValue(migrationDate) }];
    }
    return {
      ...customer,
      id:customer.id ?? `saved-${index + 1}`,
      customerNumber,
      addedOn:validDateOrNull(customer.addedOn),
      mohalla:customer.mohalla ?? '',
      zone:customer.zone ?? '',
      address:customer.address ?? '',
      phone:customer.phone ?? '',
      ispProvider:customer.ispProvider ?? '',
      serviceStatus:['active','offline','not-set'].includes(customer.serviceStatus) ? customer.serviceStatus : 'not-set',
      packageSpeed:customer.packageSpeed ?? '',
      monthlyPurchaseCost:customer.monthlyPurchaseCost ?? null,
      monthlySellingAmount,
      monthlyPriceSchedule,
      billingStartMonth:validMonthString(customer.billingStartMonth) ? customer.billingStartMonth : null,
      connectionDate:validDateOrNull(customer.connectionDate),
      expiryDate:validDateOrNull(customer.expiryDate),
      cancellationDate:validDateOrNull(customer.cancellationDate),
      packageHistory:Array.isArray(customer.packageHistory) ? customer.packageHistory : [],
      archived:customer.archived === true,
      archivedAt:customer.archived === true ? customer.archivedAt ?? null : null,
      bills,
      incidents:Array.isArray(customer.incidents) ? customer.incidents.map(incident => ({ ...incident, restoredAt:incident.restoredAt || null, note:incident.note ?? '', corrections:Array.isArray(incident.corrections) ? incident.corrections : [] })) : []
    };
  });
  const phase3 = validatePhase3State(parsed);
  const highestNumber = Math.max(0, ...customers.map(customer => customer.customerNumber));
  return { ...parsed, ...phase3, nextCustomerNumber:Math.max(storedNext, nextAvailable, highestNumber + 1), customers };
}

function validDateOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  try { return checkOptionalDate(value, 'Profile date'); } catch { return null; }
}

export function persistState(state, storage, key = STORAGE_KEY) {
  storage.setItem(key, JSON.stringify(state));
}

export function monthsForHistory(referenceDate = new Date()) {
  const current = monthKey(referenceDate);
  return Array.from({ length:MONTH_LIMIT }, (_, i) => shiftMonth(current, -i));
}

/** Derive the following cycle's fifth from the bill period, never the payment date. */
export function nextCycleDueDateFromBillMonth(month) {
  if (!validMonthString(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  if (year < 1 || (year === 9999 && monthNumber === 12)) return null;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-05`;
}

/**
 * Generate one immutable bill snapshot for each missing retained month on or after
 * the customer's saved price-effective month. Runs locally when the app opens,
 * resumes, or is active across a month boundary; it never infers earlier months.
 */
export function generateMonthlyBillsThroughCurrentMonth(state, referenceDate = new Date()) {
  const months = monthsForHistory(referenceDate).reverse();
  let changed = false;
  const customers = state.customers.map(customer => {
    if (customer.archived) return customer;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const existingMonths = new Set(bills.map(bill => bill.month));
    const schedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
    const generated = [];
    for (const month of months) {
      if (validMonthString(customer.billingStartMonth) && month < customer.billingStartMonth) continue;
      if (existingMonths.has(month)) continue;
      const applicable = schedule.filter(entry => typeof entry.effectiveMonth === 'string' && entry.effectiveMonth <= month).sort((a,b) => a.effectiveMonth.localeCompare(b.effectiveMonth)).at(-1);
      const amount = applicable?.amount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) continue;
      const snapshot = Number(amount);
      generated.push({ id:makeId(), month, dueAmount:snapshot, dueDate:`${month}-05`, status:'pending', payments:[], generated:true, priceSnapshot:snapshot, createdAt:localDateTimeValue(referenceDate), amountHistory:[] });
      existingMonths.add(month);
    }
    if (!generated.length) return customer;
    changed = true;
    return { ...customer, bills:[...bills, ...generated].sort((a,b) => b.month.localeCompare(a.month)) };
  });
  return changed ? { ...state, customers } : state;
}

export function addCustomer(state, name, referenceDate = new Date()) {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) throw new Error('Enter a customer name.');
  if (state.customers.some(c => c.name.localeCompare(cleaned, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('That customer is already in the list.');
  const usedNumbers = new Set(state.customers.map(customer => customer.customerNumber).filter(Number.isSafeInteger));
  let customerNumber = Math.max(state.nextCustomerNumber ?? 1, ...usedNumbers, 0);
  while (usedNumbers.has(customerNumber)) customerNumber++;
  return { ...state, nextCustomerNumber: customerNumber + 1, customers: [...state.customers, { id: makeId(), customerNumber, name: cleaned, addedOn:dateKey(referenceDate), mohalla: '', zone:'', address: '', phone: '', ispProvider:'', serviceStatus:'not-set', packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], billingStartMonth:null, connectionDate:null, expiryDate:null, cancellationDate:null, packageHistory:[], archived:false, archivedAt:null, bills: [], incidents: [] }] };
}

function customerMatchesQuery(customer, query, allocations = null) {
  const normalized = String(query ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const fields = [customer.name, customer.phone ?? customer.customerPhone, customer.address ?? customer.customerAddress, customer.customerNumber]
    .map(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase());
  if (fields.some(value => value.includes(normalized))) return true;
  const numberQuery = normalized.replace(/^#\s*/, '').trim();
  if (/^\d+$/.test(numberQuery) && String(customer.customerNumber ?? '').includes(numberQuery)) return true;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  if (!bills.length) return false;
  const ledgerAllocations = allocations ?? calculatePaymentAllocations({ customers:[customer] });
  const ledgerFields = [];
  for (const bill of bills) {
    const status = derivedBillStatus(customer, bill, ledgerAllocations);
    const summary = ledgerAllocations.forMonth?.(customer.id, bill.month);
    const billAmount = bill.dueAmount;
    const received = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = summary?.balanceDueCents === null || summary?.balanceDueCents === undefined ? null : summary.balanceDueCents / 100;
    ledgerFields.push(bill.month, bill.id, status, billAmount, received, balance);
    for (const amount of [billAmount, received, balance]) if (amount !== null && amount !== undefined && amount !== '') ledgerFields.push(formatPKR(amount));
    for (const payment of bill.payments ?? []) ledgerFields.push(payment.id, payment.date, payment.method, payment.amount, formatPKR(payment.amount));
  }
  return ledgerFields.some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(normalized));
}

function transactionMatchesQuery(row, query) {
  const normalized = String(query ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const fields = [row.customerName, row.customerNumber, row.customerPhone, row.customerAddress, row.month, row.date, row.method, row.status, row.paymentId, row.amount, formatPKR(row.amount), `#${row.customerNumber}`];
  return customerMatchesQuery({ name:row.customerName, customerNumber:row.customerNumber, customerPhone:row.customerPhone, customerAddress:row.customerAddress }, normalized)
    || fields.some(value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().includes(normalized));
}

export function searchCustomers(state, query = '') {
  if (!String(query ?? '').normalize('NFKC').trim()) return state.customers.slice();
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => customerMatchesQuery(customer, query, allocations));
}

export function derivedBillStatus(customer, bill, allocations = null) {
  if (!bill) return 'not-set';
  const amount = bill.dueAmount;
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'not-set';
  const result = allocations ?? calculatePaymentAllocations({ customers:[customer] });
  const summary = result.forMonth?.(customer.id, bill.month) ?? result.byCustomerMonth?.get(monthAllocationKey(customer.id, bill.month));
  if (!summary || summary.balanceDueCents === null || summary.balanceDueCents === undefined) return 'not-set';
  if (summary.balanceDueCents <= 0) return 'paid';
  return summary.sameMonthAppliedCents > 0 || summary.creditAppliedCents > 0 ? 'partial' : 'pending';
}

export function buildPayrollSummary(state, month, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const allocations = calculatePaymentAllocations(state);
  const eligibleCustomers = state.customers.filter(customer => {
    if (!customer.addedOn || customer.addedOn <= PAYROLL_RULES_EFFECTIVE_DATE || customer.addedOn > monthEnd(month)) return false;
    if (customer.archived || customer.serviceStatus !== 'active') return false;
    const bill = (customer.bills ?? []).find(item => item.month === month);
    return derivedBillStatus(customer, bill, allocations) === 'paid';
  });
  const manual = buildManualPayrollSummary(state, month);
  const saadMonthlyIncrement = eligibleCustomers.length * SAAD_PER_ELIGIBLE_CUSTOMER_MONTHLY;
  return {...manual,eligibleActivePaidCustomerCount:eligibleCustomers.length,eligibleCustomers:eligibleCustomers.map(customer=>({id:customer.id,customerNumber:customer.customerNumber,name:customer.name})),
    saadBaseMonthlySalary:SAAD_BASE_MONTHLY_SALARY,saadMonthlyIncrement,saadMonthlySalary:SAAD_BASE_MONTHLY_SALARY+saadMonthlyIncrement};
}

export function filterCustomersByStatus(state, { serviceStatus = 'all', billingStatus = 'all', month = monthsForHistory()[0], customerQuery = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (!['all','active','offline','not-set'].includes(serviceStatus)) throw new Error('Choose All, Active, Offline, or Not set for service status.');
  if (!['all','paid','pending','partial','not-set'].includes(billingStatus)) throw new Error('Choose All, Paid, Pending, Partial, or Not set for billing status.');
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => {
    if (!customerMatchesQuery(customer, customerQuery, allocations)) return false;
    if (serviceStatus !== 'all' && (customer.serviceStatus ?? 'not-set') !== serviceStatus) return false;
    if (billingStatus === 'all') return true;
    const bill = (customer.bills ?? []).find(item => item.month === month);
    return derivedBillStatus(customer, bill, allocations) === billingStatus;
  });
}

export function deleteCustomer(state, customerId) {
  return { ...state, customers: state.customers.filter(c => c.id !== customerId) };
}

export function archiveCustomer(state, customerId, referenceDate = new Date()) {
  customerOrThrow(state, customerId);
  return { ...state, customers:state.customers.map(customer => customer.id === customerId ? { ...customer, archived:true, archivedAt:localDateTimeValue(referenceDate) } : customer) };
}

export function unarchiveCustomer(state, customerId, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  if (!customer.archived) return state;
  const currentMonth = monthKey(referenceDate);
  let monthlyPriceSchedule = [...(customer.monthlyPriceSchedule ?? [])];
  if (customer.monthlySellingAmount !== null && customer.monthlySellingAmount !== undefined && customer.monthlySellingAmount !== '') {
    const effectiveMonth = (customer.bills ?? []).some(bill => bill.month === currentMonth) ? nextMonthKey(currentMonth) : currentMonth;
    monthlyPriceSchedule = [...monthlyPriceSchedule.filter(entry => entry.effectiveMonth !== effectiveMonth), { amount:Number(customer.monthlySellingAmount), effectiveMonth, recordedAt:localDateTimeValue(referenceDate) }];
  }
  return { ...state, customers:state.customers.map(item => item.id === customerId ? { ...item, archived:false, archivedAt:null, billingStartMonth:currentMonth, monthlyPriceSchedule } : item) };
}

export function updateMohalla(state, customerId, mohalla) {
  return { ...state, customers: state.customers.map(c => c.id === customerId ? { ...c, mohalla: String(mohalla ?? '').trim() } : c) };
}

function checkMonth(month, referenceDate) {
  if (!monthsForHistory(referenceDate).includes(month)) throw new Error(`Choose a month within the last ${MONTH_LIMIT} months.`);
}
function checkPositiveAmount(value, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be greater than zero.');
  return Math.round(number * 100) / 100;
}
function checkCost(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error('Monthly purchase cost cannot be negative.');
  return Math.round(number * 100) / 100;
}
function checkServiceStatus(value) {
  if (!['active','offline','not-set'].includes(value)) throw new Error('Choose Active, Offline, or Not set for manual service status.');
  return value;
}
function checkOptionalDate(value, label = 'Due date') {
  if (value === '' || value === null || value === undefined) return null;
  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  return date;
}
function customerOrThrow(state, customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  return customer;
}

export function updateCustomerProfile(state, customerId, values = {}, referenceDate = new Date()) {
  const current = customerOrThrow(state, customerId);
  const valueOrCurrent = key => Object.hasOwn(values, key) ? values[key] : current[key];
  const cleanText = (value, maxLength, label) => {
    const cleaned = String(value ?? '').trim();
    if (cleaned.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
    return cleaned;
  };
  const fields = {
    mohalla: cleanText(valueOrCurrent('mohalla') ?? '', 100, 'Mohalla'),
    zone: cleanText(valueOrCurrent('zone') ?? '', 100, 'Zone'),
    address: cleanText(valueOrCurrent('address') ?? '', 200, 'Address'),
    phone: cleanText(valueOrCurrent('phone') ?? '', 40, 'Phone number'),
    ispProvider: cleanText(valueOrCurrent('ispProvider') ?? '', 100, 'ISP/provider name'),
    serviceStatus: checkServiceStatus(valueOrCurrent('serviceStatus') ?? 'not-set'),
    packageSpeed: cleanText(valueOrCurrent('packageSpeed') ?? '', 80, 'Package/speed'),
    monthlyPurchaseCost: checkCost(valueOrCurrent('monthlyPurchaseCost')),
    monthlySellingAmount: checkPositiveAmount(valueOrCurrent('monthlySellingAmount'), true),
    connectionDate: checkOptionalDate(valueOrCurrent('connectionDate'), 'Connection date'),
    expiryDate: checkOptionalDate(valueOrCurrent('expiryDate'), 'Expiry date'),
    cancellationDate: checkOptionalDate(valueOrCurrent('cancellationDate'), 'Cancellation date')
  };
  const previousPrice = current.monthlySellingAmount ?? null;
  const nextPrice = fields.monthlySellingAmount ?? null;
  const priceChanged = (previousPrice === null) !== (nextPrice === null) || (previousPrice !== null && nextPrice !== null && moneyCents(previousPrice) !== moneyCents(nextPrice));
  const packageChanged = String(current.packageSpeed ?? '') !== fields.packageSpeed;
  let packageHistory = Array.isArray(current.packageHistory) ? [...current.packageHistory] : [];
  if (packageChanged || priceChanged) {
    const staffName = cleanText(values.packageChangeStaffName ?? '', 100, 'Staff name');
    packageHistory.push({
      date:dateKey(referenceDate), recordedAt:localDateTimeValue(referenceDate),
      oldPackage:String(current.packageSpeed ?? ''), newPackage:fields.packageSpeed,
      oldMonthlyRate:previousPrice, newMonthlyRate:nextPrice,
      monthlyRecurringPriceDelta:previousPrice === null || nextPrice === null ? null : Number((nextPrice - previousPrice).toFixed(2)),
      staffName
    });
  }
  let monthlyPriceSchedule = Array.isArray(current.monthlyPriceSchedule) ? [...current.monthlyPriceSchedule] : [];
  if (priceChanged) {
    const currentMonth = monthKey(referenceDate);
    const currentBillExists = (current.bills ?? []).some(bill => bill.month === currentMonth);
    const effectiveMonth = currentBillExists ? nextMonthKey(currentMonth) : currentMonth;
    monthlyPriceSchedule = [...monthlyPriceSchedule.filter(entry => entry.effectiveMonth !== effectiveMonth), { amount:nextPrice, effectiveMonth, recordedAt:localDateTimeValue(referenceDate) }];
  }
  return { ...state, customers: state.customers.map(c => c.id === customerId ? { ...c, ...fields, monthlyPriceSchedule, packageHistory } : c) };
}

function validateIncident(fields) {
  const reportedAt = String(fields.reportedAt ?? '').trim();
  const offlineAt = String(fields.offlineAt ?? '').trim();
  const restoredAt = String(fields.restoredAt ?? '').trim() || null;
  const reportedTime = parseLocalDateTime(reportedAt);
  const offlineTime = parseLocalDateTime(offlineAt);
  const restoredTime = restoredAt === null ? null : parseLocalDateTime(restoredAt);
  if (reportedTime === null) throw new Error('Enter a valid complaint/report date and time.');
  if (offlineTime === null) throw new Error('Enter a valid offline-start date and time.');
  if (restoredAt !== null && restoredTime === null) throw new Error('Enter a valid restored-online date and time.');
  if (restoredTime !== null && (restoredTime < reportedTime || restoredTime < offlineTime)) throw new Error('Restored-online time cannot be earlier than the report or offline-start time.');
  const note = String(fields.note ?? '').trim();
  if (note.length > 2000) throw new Error('Complaint/resolution note must be 2000 characters or fewer.');
  return { reportedAt, offlineAt, restoredAt, note };
}

export function addIncident(state, customerId, fields, recordedAt = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const incident = { id:makeId(), ...validateIncident(fields), createdAt:localDateTimeValue(recordedAt), corrections:[] };
  return { ...state, customers:state.customers.map(c => c.id === customerId ? { ...c, incidents:[...(c.incidents ?? []), incident].sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id)) } : c) };
}

export function updateIncident(state, customerId, incidentId, fields, editedAt = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const incident = (customer.incidents ?? []).find(item => item.id === incidentId);
  if (!incident) throw new Error('Complaint/outage record not found.');
  const correction = {
    recordedAt:localDateTimeValue(editedAt),
    previous:{ reportedAt:incident.reportedAt, offlineAt:incident.offlineAt, restoredAt:incident.restoredAt ?? null, note:incident.note ?? '' }
  };
  const updated = { ...incident, ...validateIncident(fields), corrections:[...(incident.corrections ?? []), correction] };
  return { ...state, customers:state.customers.map(c => c.id !== customerId ? c : { ...c, incidents:c.incidents.map(item => item.id === incidentId ? updated : item).sort((a,b) => b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id)) }) };
}

export function deleteIncident(state, customerId, incidentId) {
  const customer = customerOrThrow(state, customerId);
  if (!(customer.incidents ?? []).some(item => item.id === incidentId)) throw new Error('Complaint/outage record not found.');
  return { ...state, customers:state.customers.map(c => c.id !== customerId ? c : { ...c, incidents:c.incidents.filter(item => item.id !== incidentId) }) };
}

export function countCustomerIncidentsLast30Days(state, customerId, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const cutoff = referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000;
  return (customer.incidents ?? []).filter(incident => {
    const reportedTime = parseLocalDateTime(incident.reportedAt);
    return reportedTime !== null && reportedTime >= cutoff && reportedTime <= referenceDate.getTime();
  }).length;
}

export function saveBillMonth(state, customerId, { month, dueAmount = null, status, dueDate = undefined }, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (status !== 'pending') throw new Error('Paid status is derived from actual receipts or valid carry-forward credit. Record an actual payment instead of manually marking a bill paid.');
  const due = checkPositiveAmount(dueAmount, true);
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  if (customer.archived && !existing) throw new Error('Archived customers do not receive new bills. Unarchive the customer first.');
  if (!existing && due === null) throw new Error('Enter a bill amount before creating a bill. Unconfigured customers do not receive bills.');
  const requestedDueDate = dueDate === undefined ? undefined : checkOptionalDate(dueDate);
  const savedDueDate = existing ? (requestedDueDate === undefined ? existing.dueDate ?? null : requestedDueDate) : requestedDueDate ?? `${month}-05`;
  const amountHistory = [...(existing?.amountHistory ?? [])];
  const oldAmount = existing?.dueAmount ?? null;
  const amountChanged = existing && ((oldAmount === null) !== (due === null) || (oldAmount !== null && due !== null && moneyCents(oldAmount) !== moneyCents(due)));
  if (amountChanged) amountHistory.push({ changedAt:localDateTimeValue(referenceDate), previousAmount:oldAmount, newAmount:due, source:'manual correction' });
  const bill = existing
    ? { ...existing, dueAmount:due, dueDate:savedDueDate, status, amountHistory }
    : { id:makeId(), month, dueAmount:due, dueDate:savedDueDate, status, payments:[], generated:false, priceSnapshot:null, createdAt:localDateTimeValue(referenceDate), amountHistory:[] };
  const bills = [...customer.bills.filter(b => b.month !== month), bill].sort((a,b) => b.month.localeCompare(a.month));
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills }) };
}

function validatePayment({ date, amount, method }) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw new Error('Enter a valid payment date.');
  const cents = checkPositiveAmount(amount);
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
  return { date, amount: cents, method };
}

export function addPayment(state, customerId, month, fields, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  state = generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
  const payment = { id: makeId(), ...validatePayment(fields) };
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  if (customer.archived && !existing) throw new Error('Archived customers cannot receive a new monthly bill. Unarchive the customer first.');
  const bill = existing ? { ...existing, payments: [...existing.payments, payment] } : { id: makeId(), month, dueAmount: null, status: 'pending', payments: [payment] };
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: existing ? c.bills.map(b => b.month === month ? bill : b) : [...c.bills, bill].sort((a,b) => b.month.localeCompare(a.month)) }) };
}

export function correctPayment(state, customerId, month, paymentId, fields, referenceDate = new Date()) {
  const payment = { id: paymentId, ...validatePayment(fields) };
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill?.payments.some(p => p.id === paymentId)) throw new Error('Payment not found.');
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.map(p => p.id === paymentId ? payment : p) }) }) };
}

export function deletePayment(state, customerId, month, paymentId, referenceDate = new Date()) {
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill?.payments.some(payment => payment.id === paymentId)) throw new Error('Payment not found.');
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : {
    ...c,
    bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.filter(payment => payment.id !== paymentId) })
  }) };
}

export function recordedAmount(bill) {
  return (bill?.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

/**
 * Summarize recorded receipt rows only. Bill amounts and derived credit are not
 * cash; stable payment IDs keep an accidentally repeated ledger row from counting twice.
 * Monthly buckets follow the actual payment date, not the bill month.
 */
export function summarizeCustomerReceipts(customer) {
  const seenPaymentIds = new Set();
  const monthlyCents = new Map();
  let totalCents = 0;
  let receiptCount = 0;
  for (const bill of Array.isArray(customer?.bills) ? customer.bills : []) {
    for (const payment of Array.isArray(bill?.payments) ? bill.payments : []) {
      if (!payment || typeof payment !== 'object') continue;
      const paymentId = typeof payment.id === 'string' ? payment.id.trim() : '';
      if (paymentId && seenPaymentIds.has(paymentId)) continue;
      let date;
      try { date = checkOptionalDate(payment.date, 'Payment date'); } catch { continue; }
      const amount = Number(payment.amount);
      if (!date || !Number.isFinite(amount) || amount <= 0) continue;
      const amountCents = moneyCents(amount);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) continue;
      if (paymentId) seenPaymentIds.add(paymentId);
      totalCents += amountCents;
      const month = date.slice(0, 7);
      const bucket = monthlyCents.get(month) ?? { amountCents:0, receiptCount:0 };
      bucket.amountCents += amountCents;
      bucket.receiptCount++;
      monthlyCents.set(month, bucket);
      receiptCount++;
    }
  }
  return {
    total:moneyValue(totalCents),
    receiptCount,
    monthly:[...monthlyCents.entries()].sort(([a],[b]) => b.localeCompare(a)).map(([month,bucket]) => ({ month, amount:moneyValue(bucket.amountCents), receiptCount:bucket.receiptCount }))
  };
}

/**
 * Calculate ISP time from an explicit connection date. Profile creation, billing
 * start, manual online status, and missing archive dates are never used as substitutes.
 */
export function summarizeCustomerTenure(customer, referenceDate = new Date()) {
  const safeDate = (value, label) => { try { return checkOptionalDate(value, label); } catch { return null; } };
  const connectionDate = safeDate(customer?.connectionDate, 'Connection date');
  const profileAddedOn = safeDate(customer?.addedOn, 'Customer added date');
  if (!connectionDate) return { status:'not-recorded', connectionDate:null, profileAddedOn, endDate:null, serviceMonths:null };
  const today = dateKey(referenceDate);
  if (connectionDate > today) return { status:'future', connectionDate, profileAddedOn, endDate:null, serviceMonths:null };

  const cancellationDate = safeDate(customer?.cancellationDate, 'Cancellation date');
  const expiryDate = safeDate(customer?.expiryDate, 'Expiry date');
  const archiveDate = customer?.archived === true
    ? safeDate(typeof customer.archivedAt === 'string' ? customer.archivedAt.slice(0, 10) : customer.archivedAt, 'Archive date')
    : null;
  const ended = customer?.archived === true || Boolean(cancellationDate && cancellationDate <= today) || Boolean(expiryDate && expiryDate < today);
  const endDate = [cancellationDate && cancellationDate <= today ? cancellationDate : null, expiryDate && expiryDate < today ? expiryDate : null, archiveDate && archiveDate <= today ? archiveDate : null].filter(Boolean).sort()[0] ?? null;
  if (ended && !endDate) return { status:'end-date-unknown', connectionDate, profileAddedOn, endDate:null, serviceMonths:null };
  const effectiveEndDate = endDate ?? today;
  if (effectiveEndDate < connectionDate) return { status:'date-review', connectionDate, profileAddedOn, endDate:effectiveEndDate, serviceMonths:null };
  const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const serviceMonths = monthIndex(effectiveEndDate) - monthIndex(connectionDate) + 1;
  return { status:endDate ? 'ended' : 'current', connectionDate, profileAddedOn, endDate, serviceMonths };
}

const monthAllocationKey = (customerId, month) => JSON.stringify([customerId, month]);

/**
 * Recompute same-month receipt use and chronological carry-forward from the saved
 * actual payment entries. Allocations are derived, never duplicated as payments;
 * unused credit remains attached to its original receipt until a later bill exists.
 */
export function calculatePaymentAllocations(state) {
  const byPaymentId = new Map();
  const byCustomerMonth = new Map();
  for (const customer of state.customers) {
    const pendingCredits = [];
    const bills = [...(customer.bills ?? [])].sort((a,b) => a.month.localeCompare(b.month));
    for (const bill of bills) {
      const key = monthAllocationKey(customer.id, bill.month);
      const summary = { customerId:customer.id, month:bill.month, billAmountCents:null, actualReceiptsCents:0, sameMonthAppliedCents:0, creditAppliedCents:0, creditSources:[], balanceDueCents:null, excessGeneratedCents:0, creditForwardedCents:0, pendingCreditCents:0 };
      byCustomerMonth.set(key, summary);
      const payments = [...(bill.payments ?? [])].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
      summary.actualReceiptsCents = payments.reduce((sum,payment) => sum + moneyCents(payment.amount), 0);
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        for (const payment of payments) byPaymentId.set(payment.id, { paymentId:payment.id, customerId:customer.id, customerNumber:customer.customerNumber, customerName:customer.name, originMonth:bill.month, date:payment.date, method:payment.method, amount:Number(payment.amount), allocations:[], excessCents:0, unappliedCreditCents:0, billUnpriced:true });
        continue;
      }

      const billAmountCents = moneyCents(amount);
      summary.billAmountCents = billAmountCents;
      let dueRemainingCents = billAmountCents;
      for (const credit of pendingCredits) {
        if (dueRemainingCents <= 0) break;
        const appliedCents = Math.min(credit.remainingCents, dueRemainingCents);
        if (appliedCents <= 0) continue;
        credit.remainingCents -= appliedCents;
        dueRemainingCents -= appliedCents;
        summary.creditAppliedCents += appliedCents;
        credit.sourceSummary.creditForwardedCents += appliedCents;
        credit.paymentLedger.allocations.push({ month:bill.month, amountCents:appliedCents, kind:'carry-forward' });
        summary.creditSources.push({ paymentId:credit.paymentLedger.paymentId, originMonth:credit.paymentLedger.originMonth, paymentDate:credit.paymentLedger.date, method:credit.paymentLedger.method, receiptAmount:credit.paymentLedger.amount, amountCents:appliedCents });
      }
      for (let index = pendingCredits.length - 1; index >= 0; index--) if (pendingCredits[index].remainingCents <= 0) pendingCredits.splice(index, 1);

      let sameMonthReceiptCapacityCents = dueRemainingCents;
      for (const payment of payments) {
        const amountCents = moneyCents(payment.amount);
        const paymentLedger = { paymentId:payment.id, customerId:customer.id, customerNumber:customer.customerNumber, customerName:customer.name, originMonth:bill.month, date:payment.date, method:payment.method, amount:Number(payment.amount), allocations:[], excessCents:0, unappliedCreditCents:0, billUnpriced:false };
        byPaymentId.set(payment.id, paymentLedger);
        const appliedCents = Math.min(amountCents, sameMonthReceiptCapacityCents);
        if (appliedCents > 0) {
          paymentLedger.allocations.push({ month:bill.month, amountCents:appliedCents, kind:'same-month' });
          summary.sameMonthAppliedCents += appliedCents;
          sameMonthReceiptCapacityCents -= appliedCents;
          dueRemainingCents -= appliedCents;
        }
        const excessCents = amountCents - appliedCents;
        if (excessCents > 0) {
          paymentLedger.excessCents = excessCents;
          summary.excessGeneratedCents += excessCents;
          pendingCredits.push({ paymentLedger, sourceSummary:summary, remainingCents:excessCents });
        }
      }
      summary.balanceDueCents = Math.max(0, dueRemainingCents);
    }
    for (const credit of pendingCredits) {
      if (credit.remainingCents <= 0) continue;
      credit.sourceSummary.pendingCreditCents += credit.remainingCents;
      credit.paymentLedger.unappliedCreditCents += credit.remainingCents;
    }
  }
  return { byPaymentId, byCustomerMonth, forMonth:(customerId, month) => byCustomerMonth.get(monthAllocationKey(customerId, month)) };
}

function billStatusWithAllocations(customer, bill, allocations) {
  return derivedBillStatus(customer, bill, allocations);
}

export function effectiveBillStatus(customer, bill, referenceDate = new Date()) {
  const status = billStatusWithAllocations(customer, bill, calculatePaymentAllocations({ customers:[customer] }));
  return status === 'paid' ? 'received' : status === 'not-set' ? 'not-recorded' : 'pending';
}

export function listTransactions(state, { customerQuery = '', date = '', recencyDays = null } = {}, referenceDate = new Date()) {
  const query = String(customerQuery).trim().toLocaleLowerCase();
  const windowDays = recencyDays === null || recencyDays === undefined || recencyDays === '' || recencyDays === 'all' ? null : Number(recencyDays);
  if (windowDays !== null && ![7, 30, 90].includes(windowDays)) throw new Error('Choose All history, Last 7 days, Last 30 days, or Last 90 days.');
  const throughDate = windowDays === null ? null : dateKey(referenceDate);
  const fromDate = windowDays === null ? null : offsetDateKey(throughDate, 1 - windowDays);
  const allocations = calculatePaymentAllocations(state);
  return state.customers.flatMap(customer => (customer.bills ?? []).flatMap(bill => (bill.payments ?? []).map(payment => ({
    id: payment.id,
    paymentId: payment.id,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    customerServiceStatus: customer.serviceStatus ?? 'not-set',
    customerPhone: customer.phone,
    customerAddress: customer.address,
    month: bill.month,
    billAmount: bill.dueAmount ?? null,
    balanceDueCents: allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? null,
    billDueDate: bill.dueDate ?? null,
    status: billStatusWithAllocations(customer, bill, allocations),
    date: payment.date,
    amount: Number(payment.amount),
    method: payment.method,
    allocation:allocations.byPaymentId.get(payment.id)
  })))).filter(row => transactionMatchesQuery(row, query) && (!date || row.date === date) && (windowDays === null || (row.date >= fromDate && row.date <= throughDate)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName) || b.month.localeCompare(a.month) || a.paymentId.localeCompare(b.paymentId));
}

export function buildMonthlyReport(state, { month = monthsForHistory()[0], statusFilter = 'all', customerQuery = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (statusFilter === 'unpaid') statusFilter = 'pending';
  if (!['all', 'paid', 'pending', 'partial', 'not-set'].includes(statusFilter)) throw new Error('Choose All, Paid, Pending, Partial, or Not set.');
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => customerMatchesQuery(customer, customerQuery, allocations)).map(customer => {
    const bill = customer.bills.find(item => item.month === month);
    const configuredAmount = bill?.dueAmount ?? null;
    const amountReceived = recordedAmount(bill);
    const allocation = bill ? allocations.byCustomerMonth.get(monthAllocationKey(customer.id, month)) : null;
    let status = 'not-set';
    let balanceDue = null;
    let billAmount = null;
    let excessAmount = null;
    const creditApplied = moneyValue(allocation?.creditAppliedCents ?? 0);
    const creditForwarded = moneyValue(allocation?.creditForwardedCents ?? 0);
    const pendingCreditSources = [...allocations.byPaymentId.values()]
      .filter(source => source.customerId === customer.id && source.unappliedCreditCents > 0)
      .map(source => ({ paymentId:source.paymentId, originMonth:source.originMonth, paymentDate:source.date, method:source.method, receiptAmount:source.amount, amountCents:source.unappliedCreditCents }));
    const creditPending = moneyValue(pendingCreditSources.reduce((sum, source) => sum + source.amountCents, 0));
    if (configuredAmount !== null && configuredAmount !== undefined && configuredAmount !== '') {
      billAmount = Number(configuredAmount);
      excessAmount = moneyValue(allocation?.excessGeneratedCents ?? 0);
      balanceDue = moneyValue(allocation?.balanceDueCents ?? moneyCents(billAmount));
      status = billStatusWithAllocations(customer, bill, allocations);
    }
    return {
      customerId:customer.id,
      customerNumber:customer.customerNumber,
      customerName:customer.name,
      archived:customer.archived === true,
      serviceStatus:customer.serviceStatus ?? 'not-set',
      packageSpeed:customer.packageSpeed || '',
      ispProvider:customer.ispProvider || '',
      monthlySellingAmount:customer.monthlySellingAmount,
      month,
      dueDate:bill?.dueDate ?? null,
      billAmount,
      amountReceived,
      balanceDue,
      excessAmount,
      creditApplied,
      creditSources:allocation?.creditSources ?? [],
      creditForwarded,
      creditPending,
      pendingCreditSources,
      status
    };
  }).filter(row => statusFilter === 'all' || row.status === statusFilter);
}

export function customerPackageProfit(customer) {
  if (customer?.monthlyPurchaseCost === null || customer?.monthlyPurchaseCost === undefined || customer?.monthlySellingAmount === null || customer?.monthlySellingAmount === undefined) return null;
  return moneyValue(moneyCents(customer.monthlySellingAmount) - moneyCents(customer.monthlyPurchaseCost));
}

/**
 * Collections count actual payment entries only and are grouped by their payment dates.
 * The 24-month window is based on retained bill months. Pending known bills are their stored
 * month-specific amount less payments recorded against that bill, floored at zero. Generated
 * bills retain price snapshots; derived credits from excess receipts roll forward to later
 * generated bills and are never counted as new cash. A bill marked received closes its due
 * but never creates a collection entry.
 * Expected monthly package profit is selling amount minus provider purchase cost for complete profiles.
 */
export function calculateDashboard(state, referenceDate = new Date()) {
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const allocations = calculatePaymentAllocations(state);
  const currentMonth = monthKey(referenceDate);
  const previousMonth = shiftMonth(currentMonth, -1);
  const today = dateKey(referenceDate);
  let totalCollectionCents = 0;
  let todayCollectionCents = 0;
  let previousMonthCollectionCents = 0;
  let totalDueCents = 0;
  let currentMonthDueCents = 0;
  let expectedMonthlyPackageProfitCents = 0;
  let expectedMonthlyProviderCostCents = 0;
  const pendingCreditCents = [...allocations.byPaymentId.values()].reduce((sum, receipt) => sum + (receipt.unappliedCreditCents ?? 0), 0);
  let unpricedBillCount = 0;
  let completeProfitProfiles = 0;
  let customersMissingProviderCost = 0;
  const providerGroups = new Map();

  for (const customer of state.customers) {
    if (!customer.archived) {
      const profit = customerPackageProfit(customer);
      if (profit !== null) {
        completeProfitProfiles++;
        expectedMonthlyPackageProfitCents += moneyCents(profit);
      }
      const providerName = String(customer.ispProvider ?? '').trim();
      const cost = customer.monthlyPurchaseCost;
      const hasCost = !(cost === null || cost === undefined || cost === '' || !Number.isFinite(Number(cost)) || Number(cost) < 0);
      if (!hasCost) customersMissingProviderCost++;
      if (providerName || hasCost) {
        const provider = providerName || 'Provider name not set';
        const providerKey = provider.toLocaleLowerCase();
        const group = providerGroups.get(providerKey) ?? { provider, expectedMonthlyCostCents:0, profilesWithCost:0, profilesMissingCost:0 };
        if (!providerName && group.provider !== 'Provider name not set') group.provider = provider;
        if (hasCost) {
          const cents = moneyCents(cost);
          group.expectedMonthlyCostCents += cents;
          group.profilesWithCost++;
          expectedMonthlyProviderCostCents += cents;
        } else {
          group.profilesMissingCost++;
        }
        providerGroups.set(providerKey, group);
      }
    }

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const retainedBills = bills.filter(bill => retainedMonths.has(bill.month));
    for (const bill of bills) for (const payment of bill.payments ?? []) {
      const paymentCents = moneyCents(payment.amount);
      if (retainedMonths.has(bill.month)) totalCollectionCents += paymentCents;
      if (payment.date === today) todayCollectionCents += paymentCents;
      if (typeof payment.date === 'string' && payment.date.slice(0, 7) === previousMonth) previousMonthCollectionCents += paymentCents;
    }
    for (const bill of retainedBills) {
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '') {
        unpricedBillCount++;
        continue;
      }
      const allocation = allocations.byCustomerMonth.get(monthAllocationKey(customer.id, bill.month));
      const outstandingCents = allocation?.balanceDueCents ?? moneyCents(amount);
      totalDueCents += outstandingCents;
      if (bill.month === currentMonth) currentMonthDueCents += outstandingCents;
    }

  }

  const activeCustomers = state.customers.filter(customer => !customer.archived);
  const incompleteProfitProfiles = activeCustomers.length - completeProfitProfiles;
  return {
    totalCustomers: activeCustomers.length,
    archivedCustomers:state.customers.length - activeCustomers.length,
    activeServiceCount:activeCustomers.filter(customer => customer.serviceStatus === 'active').length,
    offlineServiceCount:activeCustomers.filter(customer => customer.serviceStatus === 'offline').length,
    unsetServiceCount:activeCustomers.filter(customer => !['active','offline'].includes(customer.serviceStatus)).length,
    totalCollection: moneyValue(totalCollectionCents),
    totalDue: moneyValue(totalDueCents),
    todayCollection: moneyValue(todayCollectionCents),
    previousMonthCollection: moneyValue(previousMonthCollectionCents),
    currentMonthDue: moneyValue(currentMonthDueCents),
    pendingCredit: moneyValue(pendingCreditCents),
    expectedMonthlyPackageProfit: moneyValue(expectedMonthlyPackageProfitCents),
    expectedMonthlyProviderCost:moneyValue(expectedMonthlyProviderCostCents),
    customersMissingProviderCost,
    providerCostBreakdown:[...providerGroups.values()].sort((a,b) => a.provider.localeCompare(b.provider)).map(group => ({ provider:group.provider, expectedMonthlyCost:moneyValue(group.expectedMonthlyCostCents), profilesWithCost:group.profilesWithCost, profilesMissingCost:group.profilesMissingCost })),
    currentMonth,
    previousMonth,
    today,
    customersMissingSellingAmount: activeCustomers.filter(customer => customer.monthlySellingAmount === null || customer.monthlySellingAmount === undefined || customer.monthlySellingAmount === '').length,
    incompleteProfitProfiles,
    unpricedBillCount
  };
}

function paymentLines(customer, bill, allocations) {
  return (bill.payments ?? []).map(payment => {
    const allocation = allocations.byPaymentId.get(payment.id);
    const sameMonthCents = (allocation?.allocations ?? []).filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
    const carried = (allocation?.allocations ?? []).filter(item => item.kind === 'carry-forward');
    const serviceLabel = ({ active:'Active', offline:'Offline', 'not-set':'Not set' })[customer.serviceStatus] ?? 'Not set';
    const billingLabel = ({ paid:'Paid', pending:'Pending', partial:'Partial', 'not-set':'Not set' })[billStatusWithAllocations(customer, bill, allocations)];
    const lines = [`Customer number: ${customer.customerNumber}`, `Customer: ${customer.name}`, `Service status (manual, not billing status): ${serviceLabel}`, `Billing status: ${billingLabel}`, `Selected bill month: ${bill.month}`, `Actual payment date: ${payment.date}`, `Amount: ${formatPKR(payment.amount)} (actual receipt, counted once)`, `Method: ${payment.method}`];
    if (allocation?.billUnpriced) lines.push('Allocation: selected bill has no saved amount; no excess credit was inferred.');
    else {
      lines.push(`Applied to selected bill: ${formatPKR(moneyValue(sameMonthCents))}`);
      for (const item of carried) lines.push(`Auto-credit applied to ${item.month}: ${formatPKR(moneyValue(item.amountCents))} (allocation, not a new payment)`);
      if (allocation?.unappliedCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatPKR(moneyValue(allocation.unappliedCreditCents))}`);
    }
    return `${lines.join('\n')}\n`;
  });
}

export function exportAllPayments(state) {
  const lines = ['Shahdara ISP Billing — payment details', 'Exported from this device only', ''];
  const allocations = calculatePaymentAllocations(state);
  let count = 0;
  for (const customer of state.customers) for (const bill of customer.bills) for (const line of paymentLines(customer, bill, allocations)) { lines.push(line); count++; }
  if (!count) lines.push('No payment entries have been recorded.');
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportCustomerHistory(state, customerId) {
  const customer = customerOrThrow(state, customerId);
  const allocations = calculatePaymentAllocations(state);
  const lines = [
    'Shahdara ISP Billing — customer history',
    `Customer number: ${customer.customerNumber ?? 'Not assigned'}`,
    `Customer: ${customer.name}`,
    `Mohalla: ${customer.mohalla || 'Not recorded'}`,
    `Address: ${customer.address || 'Not recorded'}`,
    `Phone: ${customer.phone || 'Not recorded'}`,
    `ISP/provider: ${customer.ispProvider || 'Not set'}`,
    `Manual service status (not billing status): ${({ active:'Active', offline:'Offline', 'not-set':'Not set' })[customer.serviceStatus] ?? 'Not set'}`,
    `Package / speed: ${customer.packageSpeed || 'Not set'}`,
    `Monthly provider purchase cost: ${formatPKR(customer.monthlyPurchaseCost)}`,
    `Monthly selling amount: ${formatPKR(customer.monthlySellingAmount)}`,
    `Expected monthly package profit: ${formatPKR(customerPackageProfit(customer))}`,
    `Archive status: ${customer.archived ? `Archived since ${customer.archivedAt ?? 'date not recorded'}` : 'Active'}`,
    `Automatic billing resumes from month: ${customer.billingStartMonth ?? 'Not limited by an archive resume date'}`,
    ''
  ];
  if (!customer.bills.length) lines.push('No billing details have been recorded.');
  for (const bill of [...customer.bills].sort((a,b) => a.month.localeCompare(b.month))) {
    const status = ({ paid:'Paid', pending:'Pending', partial:'Partial', 'not-set':'Not set' })[billStatusWithAllocations(customer, bill, allocations)];
    const allocation = allocations.forMonth(customer.id, bill.month);
    lines.push(`Month: ${bill.month}`, `Status: ${status}`, `Bill amount: ${formatPKR(bill.dueAmount)}`, `Optional due date: ${bill.dueDate ?? 'Not set — no due-date rule or penalty applied'}`, `Actual payments received: ${formatPKR(recordedAmount(bill))}`, `Carry-forward credit applied to this bill (not new cash): ${formatPKR(moneyValue(allocation?.creditAppliedCents ?? 0))}`, `Balance due after payments and credits: ${allocation?.balanceDueCents === null || allocation?.balanceDueCents === undefined ? 'Not recorded' : formatPKR(moneyValue(allocation.balanceDueCents))}`);
    for (const source of allocation?.creditSources ?? []) lines.push(`  Credit source: original ${formatPKR(source.receiptAmount)} receipt dated ${source.paymentDate} (${source.method}) from ${source.originMonth}; applied here=${formatPKR(moneyValue(source.amountCents))}`);
    if (bill.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined) lines.push(`Automatic monthly bill price snapshot: ${formatPKR(bill.priceSnapshot)}`);
    if (allocation?.excessGeneratedCents) lines.push(`Excess from this month's receipts: ${formatPKR(moneyValue(allocation.excessGeneratedCents))}`);
    if (allocation?.creditForwardedCents) lines.push(`Credit automatically applied to later generated bills: ${formatPKR(moneyValue(allocation.creditForwardedCents))}`);
    if (allocation?.pendingCreditCents) lines.push(`Credit waiting for a future generated bill: ${formatPKR(moneyValue(allocation.pendingCreditCents))}`);
    for (const correction of bill.amountHistory ?? []) lines.push(`  Bill amount correction at ${correction.changedAt}: previous=${formatPKR(correction.previousAmount)}, new=${formatPKR(correction.newAmount)}`);
    for (const line of paymentLines(customer, bill, allocations)) lines.push(`  ${line.trim().replaceAll('\n',' | ')}`);
    lines.push('');
  }
  if (!(customer.incidents ?? []).length) lines.push('No complaint/outage records have been recorded.');
  else {
    lines.push('Manual complaint/outage records');
    for (const incident of [...customer.incidents].sort((a,b) => a.reportedAt.localeCompare(b.reportedAt))) {
      lines.push(
        `Reported at: ${incident.reportedAt}`,
        `Offline since: ${incident.offlineAt}`,
        `Restored online at: ${incident.restoredAt ?? 'Not restored'}`,
        `Incident state: ${incident.restoredAt ? 'Resolved' : 'Open'}`,
        `Complaint/resolution note: ${incident.note || 'Not recorded'}`
      );
      for (const correction of incident.corrections ?? []) lines.push(`  Correction at ${correction.recordedAt}: previous report=${correction.previous.reportedAt}, offline=${correction.previous.offlineAt}, restored=${correction.previous.restoredAt ?? 'Open'}, note=${correction.previous.note || 'Not recorded'}`);
      lines.push('');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}


export const BACKUP_FORMAT = 'shahdara-isp-billing-backup';
const MAX_BACKUP_CHARACTERS = 25 * 1024 * 1024;
const deepCopy = value => JSON.parse(JSON.stringify(value));
const isBlank = value => value === null || value === undefined || value === '';
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validMonthString(value) { return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
function validStoredDateTime(value, label) {
  if (value === null || value === undefined || value === '') return;
  if (parseLocalDateTime(value) === null) throw new Error(`Backup contains an invalid ${label}.`);
}
function validBackupAmount(value, label, allowZero = false) {
  if (isBlank(value)) return;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0)) throw new Error(`Backup contains an invalid ${label}.`);
}
function validateBackupState(source) {
  if (!source || typeof source !== 'object' || source.version !== 1 || !Array.isArray(source.customers)) throw new Error('Backup has an unsupported or incomplete state version. No local data has changed.');
  if (source.customers.length > 10000) throw new Error('Backup contains too many customer profiles.');
  const customerIds = new Set(); const customerNumbers = new Set(); const customerNames = new Set();
  const billIds = new Set(); const paymentIds = new Set(); const incidentIds = new Set();
  const customers = source.customers.map((customer, customerIndex) => {
    if (!customer || typeof customer !== 'object' || typeof customer.id !== 'string' || !customer.id || customer.id.length > 200) throw new Error(`Backup customer ${customerIndex + 1} has an invalid unique ID.`);
    if (customerIds.has(customer.id)) throw new Error(`Backup has a duplicate customer ID: ${customer.id}.`);
    customerIds.add(customer.id);
    if (!Number.isSafeInteger(customer.customerNumber) || customer.customerNumber < 1 || customerNumbers.has(customer.customerNumber)) throw new Error(`Backup has a missing or duplicate customer number near ${customer.name || customerIndex + 1}.`);
    customerNumbers.add(customer.customerNumber);
    if (typeof customer.name !== 'string' || !customer.name.trim() || customer.name.length > 100) throw new Error(`Backup customer #${customer.customerNumber} has an invalid name.`);
    const normalizedName = customer.name.trim().toLocaleLowerCase();
    if (customerNames.has(normalizedName)) throw new Error(`Backup has duplicate customer names matching “${customer.name.trim()}”.`);
    customerNames.add(normalizedName);
    for (const [field, limit, label] of [['mohalla',100,'mohalla'],['zone',100,'zone'],['address',200,'address'],['phone',40,'phone number'],['ispProvider',100,'ISP/provider name'],['packageSpeed',80,'package/speed']]) {
      if (customer[field] !== undefined && (typeof customer[field] !== 'string' || customer[field].length > limit)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid ${label}.`);
    }
    if (customer.serviceStatus !== undefined && !['active','offline','not-set'].includes(customer.serviceStatus)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid manual service status.`);
    validBackupAmount(customer.monthlySellingAmount, `selling amount for customer #${customer.customerNumber}`);
    validBackupAmount(customer.monthlyPurchaseCost, `provider cost for customer #${customer.customerNumber}`, true);
    if (customer.archived !== undefined && typeof customer.archived !== 'boolean') throw new Error(`Backup customer #${customer.customerNumber} has an invalid archive status.`);
    if (customer.billingStartMonth !== null && customer.billingStartMonth !== undefined && !validMonthString(customer.billingStartMonth)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid billing resume month.`);
    validStoredDateTime(customer.archivedAt, 'archive date');
    if (customer.addedOn !== null && customer.addedOn !== undefined && customer.addedOn !== '') checkOptionalDate(customer.addedOn, 'Customer added date');
    for (const field of ['connectionDate','expiryDate','cancellationDate']) if (customer[field] !== null && customer[field] !== undefined && customer[field] !== '') checkOptionalDate(customer[field], `${field} date`);
    const schedule = customer.monthlyPriceSchedule ?? [];
    const packageHistory = customer.packageHistory ?? [];
    const sourceBills = customer.bills ?? [];
    const sourceIncidents = customer.incidents ?? [];
    if (!Array.isArray(schedule) || !Array.isArray(packageHistory) || !Array.isArray(sourceBills) || !Array.isArray(sourceIncidents)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid billing/history list.`);
    for (const change of packageHistory) {
      if (!change || typeof change !== 'object') throw new Error(`Backup customer #${customer.customerNumber} has an invalid package change.`);
      checkOptionalDate(change.date ?? null, 'Package change date');
      validStoredDateTime(change.recordedAt, 'package change record date');
      for (const field of ['oldPackage','newPackage','staffName']) if (change[field] !== undefined && (typeof change[field] !== 'string' || change[field].length > 100)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid package history field.`);
      validBackupAmount(change.oldMonthlyRate, 'previous monthly rate');
      validBackupAmount(change.newMonthlyRate, 'new monthly rate');
      if (change.monthlyRecurringPriceDelta !== null && change.monthlyRecurringPriceDelta !== undefined && !Number.isFinite(Number(change.monthlyRecurringPriceDelta))) throw new Error(`Backup customer #${customer.customerNumber} has an invalid package price delta.`);
    }
    const scheduleMonths = new Set();
    for (const entry of schedule) {
      if (!entry || !validMonthString(entry.effectiveMonth) || scheduleMonths.has(entry.effectiveMonth)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate price-effective month.`);
      scheduleMonths.add(entry.effectiveMonth);
      validBackupAmount(entry.amount, 'scheduled selling amount');
      validStoredDateTime(entry.recordedAt, 'price schedule date');
    }
    const billMonths = new Set();
    const bills = sourceBills.map(bill => {
      if (!bill || typeof bill.id !== 'string' || !bill.id || billIds.has(bill.id)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate bill ID.`);
      billIds.add(bill.id);
      if (!validMonthString(bill.month) || billMonths.has(bill.month)) throw new Error(`Backup customer #${customer.customerNumber} has an invalid or duplicate billing month.`);
      billMonths.add(bill.month);
      if (!['pending','received'].includes(bill.status)) throw new Error(`Backup bill ${bill.month} has an invalid status.`);
      validBackupAmount(bill.dueAmount, `bill amount for ${bill.month}`);
      validBackupAmount(bill.priceSnapshot, `price snapshot for ${bill.month}`);
      const dueDate = checkOptionalDate(bill.dueDate ?? null);
      if (!Array.isArray(bill.payments ?? []) || !Array.isArray(bill.amountHistory ?? [])) throw new Error(`Backup bill ${bill.month} has an invalid payment or correction list.`);
      const payments = bill.payments.map(payment => {
        if (!payment || typeof payment.id !== 'string' || !payment.id || paymentIds.has(payment.id)) throw new Error(`Backup has a missing or duplicate payment ID for ${bill.month}.`);
        paymentIds.add(payment.id);
        return { ...payment, ...validatePayment(payment) };
      });
      for (const correction of bill.amountHistory ?? []) {
        if (!correction || typeof correction !== 'object') throw new Error(`Backup bill ${bill.month} has an invalid amount correction.`);
        validStoredDateTime(correction.changedAt, 'bill correction date');
        validBackupAmount(correction.previousAmount, 'previous bill amount');
        validBackupAmount(correction.newAmount, 'corrected bill amount');
      }
      return { ...bill, dueDate, payments, amountHistory:bill.amountHistory ?? [] };
    });
    const incidents = sourceIncidents.map(incident => {
      if (!incident || typeof incident.id !== 'string' || !incident.id || incidentIds.has(incident.id)) throw new Error(`Backup customer #${customer.customerNumber} has a missing or duplicate incident ID.`);
      incidentIds.add(incident.id);
      validateIncident(incident);
      if (!Array.isArray(incident.corrections ?? [])) throw new Error(`Backup incident on customer #${customer.customerNumber} has an invalid correction list.`);
      for (const correction of incident.corrections ?? []) {
        if (!correction || !correction.previous) throw new Error(`Backup incident on customer #${customer.customerNumber} has an invalid correction entry.`);
        validStoredDateTime(correction.recordedAt, 'incident correction date');
        const previous = validateIncident(correction.previous);
        if (previous.reportedAt === '' || previous.offlineAt === '') throw new Error(`Backup incident on customer #${customer.customerNumber} has incomplete prior dates.`);
      }
      return { ...incident, ...validateIncident(incident), corrections:incident.corrections ?? [] };
    });
    return {
      ...customer,
      id:customer.id,
      name:customer.name.trim(),
      addedOn:checkOptionalDate(customer.addedOn ?? null, 'Customer added date'),
      mohalla:customer.mohalla ?? '', zone:customer.zone ?? '', address:customer.address ?? '', phone:customer.phone ?? '', ispProvider:customer.ispProvider ?? '', serviceStatus:customer.serviceStatus ?? 'not-set', packageSpeed:customer.packageSpeed ?? '',
      monthlySellingAmount:customer.monthlySellingAmount ?? null, monthlyPurchaseCost:customer.monthlyPurchaseCost ?? null,
      monthlyPriceSchedule:schedule, billingStartMonth:customer.billingStartMonth ?? null, archived:customer.archived === true, archivedAt:customer.archived === true ? customer.archivedAt ?? null : null,
      connectionDate:customer.connectionDate ?? null, expiryDate:customer.expiryDate ?? null, cancellationDate:customer.cancellationDate ?? null,
      packageHistory, bills, incidents
    };
  });
  const highestNumber = Math.max(0, ...customers.map(customer => customer.customerNumber));
  const nextCustomerNumber = Number.isSafeInteger(source.nextCustomerNumber) && source.nextCustomerNumber > 0 ? Math.max(source.nextCustomerNumber, highestNumber + 1) : highestNumber + 1;
  const phase3 = validatePhase3State(source);
  return { ...source, ...phase3, version:1, nextCustomerNumber, customers };
}

export function createJsonBackup(state, exportedAt = new Date()) {
  const safeState = deepCopy(state);
  return JSON.stringify({ format:BACKUP_FORMAT, formatVersion:1, exportedAt:localDateTimeValue(exportedAt), state:safeState }, null, 2);
}

/**
 * Validate a JSON backup and produce a preview-only, non-destructive merge. Existing
 * nonblank profile fields and conflicting bill values always win; unique receipts,
 * bills, incidents and profiles are added only after the user explicitly applies it.
 */
export function previewJsonBackupMerge(existingState, backupText) {
  if (typeof backupText !== 'string' || backupText.length > MAX_BACKUP_CHARACTERS) throw new Error('Backup is too large or is not readable JSON. No local data has changed.');
  let document;
  try { document = JSON.parse(backupText); }
  catch { throw new Error('Backup is not valid JSON. No local data has changed.'); }
  if (!document || document.format !== BACKUP_FORMAT || document.formatVersion !== 1) throw new Error('This is not a supported Shahdara ISP Billing JSON backup. No local data has changed.');
  const incomingState = validateBackupState(document.state);
  const current = deepCopy(existingState);
  const conflicts = [];
  const counts = { addedCustomers:0, mergedCustomers:0, addedBills:0, addedPayments:0, addedIncidents:0, addedInventoryItems:0, addedInventoryMovements:0, addedExpenses:0, addedSaadAttendanceDays:0, addedUmairWorkdays:0, filledProfileFields:0, changes:0 };
  const addConflict = (customer, field) => conflicts.push({ customerNumber:customer.customerNumber, name:customer.name, field });
  const nonempty = value => !(value === null || value === undefined || value === '');
  const mergeField = (target, source, key, customer) => {
    const oldValue = target[key]; const newValue = source[key];
    if (sameJson(oldValue, newValue) || (key === 'addedOn' && !nonempty(oldValue) && !nonempty(newValue))) return;
    if (key === 'serviceStatus' && (!oldValue || oldValue === 'not-set') && newValue !== 'not-set') { target[key] = newValue; counts.filledProfileFields++; counts.changes++; return; }
    if (!nonempty(oldValue) && nonempty(newValue)) { target[key] = deepCopy(newValue); counts.filledProfileFields++; counts.changes++; return; }
    if (nonempty(oldValue) && !nonempty(newValue)) return;
    addConflict(customer, key);
  };
  for (const backupCustomer of incomingState.customers) {
    const byId = current.customers.find(customer => customer.id === backupCustomer.id);
    const byNumber = current.customers.find(customer => customer.customerNumber === backupCustomer.customerNumber);
    const byName = current.customers.find(customer => customer.name.trim().toLocaleLowerCase() === backupCustomer.name.trim().toLocaleLowerCase());
    if (!byId) {
      if (byNumber || byName) {
        addConflict(backupCustomer, byNumber ? 'customer number belongs to a different profile' : 'customer name belongs to a different profile');
        continue;
      }
      current.customers.push(deepCopy(backupCustomer));
      counts.addedCustomers++; counts.addedBills += backupCustomer.bills.length; counts.addedPayments += backupCustomer.bills.reduce((sum,bill)=>sum+bill.payments.length,0); counts.addedIncidents += backupCustomer.incidents.length; counts.changes++;
      continue;
    }
    if (byId.customerNumber !== backupCustomer.customerNumber || byId.name.trim().toLocaleLowerCase() !== backupCustomer.name.trim().toLocaleLowerCase()) {
      addConflict(backupCustomer, 'customer ID, number, or name identity differs');
      continue;
    }
    counts.mergedCustomers++;
    const customer = byId;
    for (const key of ['mohalla','zone','address','phone','ispProvider','serviceStatus','packageSpeed','monthlySellingAmount','monthlyPurchaseCost','billingStartMonth','connectionDate','expiryDate','cancellationDate','addedOn','archived','archivedAt']) mergeField(customer, backupCustomer, key, backupCustomer);
    customer.packageHistory = customer.packageHistory ?? [];
    for (const change of backupCustomer.packageHistory ?? []) if (!customer.packageHistory.some(existing=>sameJson(existing,change))) { customer.packageHistory.push(deepCopy(change)); counts.changes++; }
    for (const incomingEntry of backupCustomer.monthlyPriceSchedule) {
      const existingEntry = customer.monthlyPriceSchedule.find(entry => entry.effectiveMonth === incomingEntry.effectiveMonth);
      if (!existingEntry) { customer.monthlyPriceSchedule.push(deepCopy(incomingEntry)); counts.changes++; }
      else if (Number(existingEntry.amount) !== Number(incomingEntry.amount)) addConflict(backupCustomer, `price schedule ${incomingEntry.effectiveMonth}`);
    }
    customer.monthlyPriceSchedule.sort((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth));
    for (const incomingBill of backupCustomer.bills) {
      let existingBill = customer.bills.find(bill => bill.month === incomingBill.month);
      if (!existingBill) {
        customer.bills.push(deepCopy(incomingBill)); counts.addedBills++; counts.addedPayments+=incomingBill.payments.length; counts.changes++;
        continue;
      }
      for (const key of ['dueAmount','dueDate','status','generated','priceSnapshot']) {
        const oldValue = existingBill[key] ?? null; const newValue = incomingBill[key] ?? null;
        if (sameJson(oldValue,newValue)) continue;
        if (!nonempty(oldValue) && nonempty(newValue)) { existingBill[key]=deepCopy(newValue); counts.changes++; }
        else if (nonempty(oldValue) && !nonempty(newValue)) continue;
        else addConflict(backupCustomer, `bill ${incomingBill.month} ${key}`);
      }
      existingBill.amountHistory = existingBill.amountHistory ?? [];
      for (const correction of incomingBill.amountHistory) if (!existingBill.amountHistory.some(item=>sameJson(item,correction))) { existingBill.amountHistory.push(deepCopy(correction)); counts.changes++; }
      existingBill.payments = existingBill.payments ?? [];
      for (const incomingPayment of incomingBill.payments) {
        const existingPayment = existingBill.payments.find(payment=>payment.id===incomingPayment.id);
        if (!existingPayment) { existingBill.payments.push(deepCopy(incomingPayment)); counts.addedPayments++; counts.changes++; }
        else if (!sameJson(existingPayment,incomingPayment)) addConflict(backupCustomer, `payment ${incomingPayment.id}`);
      }
    }
    customer.bills.sort((a,b)=>b.month.localeCompare(a.month));
    for (const incomingIncident of backupCustomer.incidents) {
      const existingIncident = customer.incidents.find(incident=>incident.id===incomingIncident.id);
      if (!existingIncident) { customer.incidents.push(deepCopy(incomingIncident)); counts.addedIncidents++; counts.changes++; }
      else if (!sameJson(existingIncident,incomingIncident)) addConflict(backupCustomer, `incident ${incomingIncident.id}`);
    }
    customer.incidents.sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt)||a.id.localeCompare(b.id));
  }
  for (const [key,countKey,label] of [['inventoryItems','addedInventoryItems','inventory item'],['inventoryMovements','addedInventoryMovements','inventory movement'],['expenses','addedExpenses','expense']]) {
    current[key] = current[key] ?? [];
    for (const incoming of incomingState[key] ?? []) {
      const existing = current[key].find(entry=>entry.id===incoming.id);
      if (!existing) { current[key].push(deepCopy(incoming)); counts[countKey]++; counts.changes++; }
      else if (!sameJson(existing,incoming)) conflicts.push({customerNumber:null,name:'',field:`${label} ${incoming.id}`});
    }
  }
  for (const [key,countKey] of [['saadAttendanceDays','addedSaadAttendanceDays'],['umairWorkdays','addedUmairWorkdays']]) {
    current[key]=current[key]??[];
    const known=new Set(current[key]);
    for(const date of incomingState[key]??[])if(!known.has(date)){known.add(date);counts[countKey]++;counts.changes++;}
    current[key]=[...known].sort();
  }
  current.customers.sort((a,b)=>a.customerNumber-b.customerNumber);
  current.nextCustomerNumber = Math.max(existingState.nextCustomerNumber ?? 1, incomingState.nextCustomerNumber, ...current.customers.map(customer=>customer.customerNumber+1));
  const state = counts.changes ? current : existingState;
  return { state, counts, conflicts, canApply:counts.changes>0, backupCustomerCount:incomingState.customers.length, exportedAt:document.exportedAt ?? '' };
}
