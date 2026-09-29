export const INITIAL_NAMES = Object.freeze([
  'NAZEER','AWAIS','TEHMENA','SAFEER','KHALEEL','DARBAR','ALI SHAH','ZARSHAD KHAN','AC HOUSE','MNA HOUSE','CH BILAL','MUHAMMAD QASIM','RAJA JUNAID','RAJA USAMA','PATHAN','HASEEB','RAJA BILAL','QARI MUBASIR','FAREED ABBASI','JAWAD RAJA','HAJI ZAFAR','DOCTOR ZAHID','DOCTER EHSAN','AQIB OWNER','SAQIB EJAZ','RAJA RIAZ','RAJA JAHANGEER','RAJA NOMI','RAJA MOHSIN','MUFTI SADAQAT','TOUSEEF RAJA','KIRAN BILAL','SIKANDAR ABBASI','RAJA FAISAL','RAJA ALI','RAJA SHUNAID','BUT HOUSE','AZEEM BAJWA HOUSE','BANGISH HOUSE','RAJA HAFEEZ','RAJA KHAZER','ZUBAIR USTAD','MEHMOOD ABBASI','RAJA ARIF','RAJA SHEHZAD','KASHIF RAJA','KASHIF ABBASI','SAJID','PTA DIRECTOR','RAJA IRFAN','RAJA FAIZAN','BABAR','CH MURTAZA','QARI BAKAR BAKAR','CH MOIZ','CH SAQLAIN','RAJA MUJAHID','RAJA MASROOR','RAJA TAIMOOR MANGRAYAL','RAJA TAIMOOR CHANDALL','MOBEEN SHAH','NADIR SHAH','SHAH NAWAZ','SHADI','RAB NAWAZ','FAISAL GUJJAR','CH HAMZA','CH SHAFEEQ','CH SANWALL','NADIR GUJJAR','RAJA ASAD','DC HOUSE','AKHTAR HOUSE','SSP HOUSE'
]);
export const PAYMENT_METHODS = Object.freeze(['Cash','JazzCash','Easypaisa','Bank Transfer']);
export const MONTH_LIMIT = 24;
export const STORAGE_KEY = 'shahdara-isp-billing-v1';
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const moneyCents = value => Math.round(Number(value || 0) * 100);
const moneyValue = cents => Number((cents / 100).toFixed(2));
const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const nextMonthKey = month => { const [year, number] = month.split('-').map(Number); return monthKey(new Date(year, number, 1)); };
const dateKey = date => `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
const localDateTimeValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day || parsed.getHours() !== hour || parsed.getMinutes() !== minute) return null;
  return parsed.getTime();
}

export function createInitialState(names = INITIAL_NAMES) {
  return { version: 1, nextCustomerNumber: names.length + 1, customers: names.map((name, index) => ({ id: `seed-${String(index + 1).padStart(3, '0')}`, customerNumber: index + 1, name, mohalla: '', address: '', phone: '', packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], bills: [], incidents: [] })) };
}

export function readState(storage, key = STORAGE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.customers)) return createInitialState();
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
      let bills = Array.isArray(customer.bills) ? customer.bills : [];
      const monthlySellingAmount = customer.monthlySellingAmount ?? null;
      let monthlyPriceSchedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
      if (monthlySellingAmount !== null && monthlySellingAmount !== undefined && monthlySellingAmount !== '' && monthlyPriceSchedule.length === 0) {
        const currentBillIndex = bills.findIndex(bill => bill.month === currentMonth);
        let effectiveMonth = currentMonth;
        if (currentBillIndex >= 0) {
          effectiveMonth = nextMonthKey(currentMonth);
          const currentBill = bills[currentBillIndex];
          if (currentBill.dueAmount === null || currentBill.dueAmount === undefined || currentBill.dueAmount === '') {
            bills = [...bills];
            bills[currentBillIndex] = { ...currentBill, dueAmount:Number(monthlySellingAmount), generated:true, priceSnapshot:Number(monthlySellingAmount), createdAt:currentBill.createdAt ?? localDateTimeValue(migrationDate), amountHistory:Array.isArray(currentBill.amountHistory) ? currentBill.amountHistory : [] };
          }
        }
        monthlyPriceSchedule = [{ amount:Number(monthlySellingAmount), effectiveMonth, recordedAt:localDateTimeValue(migrationDate) }];
      }
      return {
      ...customer,
      id: customer.id ?? `saved-${index + 1}`,
      customerNumber,
      mohalla: customer.mohalla ?? '',
      address: customer.address ?? '',
      phone: customer.phone ?? '',
      packageSpeed: customer.packageSpeed ?? '',
      monthlyPurchaseCost: customer.monthlyPurchaseCost ?? null,
      monthlySellingAmount,
      monthlyPriceSchedule,
      bills,
      incidents: Array.isArray(customer.incidents) ? customer.incidents.map(incident => ({ ...incident, restoredAt:incident.restoredAt || null, note:incident.note ?? '', corrections:Array.isArray(incident.corrections) ? incident.corrections : [] })) : []
      };
    });
    const highestNumber = Math.max(0, ...customers.map(customer => customer.customerNumber));
    return { ...parsed, nextCustomerNumber: Math.max(storedNext, nextAvailable, highestNumber + 1), customers };
  } catch {
    return createInitialState();
  }
}

export function persistState(state, storage, key = STORAGE_KEY) {
  storage.setItem(key, JSON.stringify(state));
}

export function monthsForHistory(referenceDate = new Date()) {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth();
  return Array.from({ length: MONTH_LIMIT }, (_, i) => monthKey(new Date(y, m - i, 1)));
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
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    const existingMonths = new Set(bills.map(bill => bill.month));
    const schedule = Array.isArray(customer.monthlyPriceSchedule) ? customer.monthlyPriceSchedule : [];
    const generated = [];
    for (const month of months) {
      if (existingMonths.has(month)) continue;
      const applicable = schedule.filter(entry => typeof entry.effectiveMonth === 'string' && entry.effectiveMonth <= month).sort((a,b) => a.effectiveMonth.localeCompare(b.effectiveMonth)).at(-1);
      const amount = applicable?.amount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) continue;
      const snapshot = Number(amount);
      generated.push({ id:makeId(), month, dueAmount:snapshot, status:'pending', payments:[], generated:true, priceSnapshot:snapshot, createdAt:localDateTimeValue(referenceDate), amountHistory:[] });
      existingMonths.add(month);
    }
    if (!generated.length) return customer;
    changed = true;
    return { ...customer, bills:[...bills, ...generated].sort((a,b) => b.month.localeCompare(a.month)) };
  });
  return changed ? { ...state, customers } : state;
}

export function addCustomer(state, name) {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) throw new Error('Enter a customer name.');
  if (state.customers.some(c => c.name.localeCompare(cleaned, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('That customer is already in the list.');
  const usedNumbers = new Set(state.customers.map(customer => customer.customerNumber).filter(Number.isSafeInteger));
  let customerNumber = Math.max(state.nextCustomerNumber ?? 1, ...usedNumbers, 0);
  while (usedNumbers.has(customerNumber)) customerNumber++;
  return { ...state, nextCustomerNumber: customerNumber + 1, customers: [...state.customers, { id: makeId(), customerNumber, name: cleaned, mohalla: '', address: '', phone: '', packageSpeed: '', monthlyPurchaseCost: null, monthlySellingAmount: null, monthlyPriceSchedule: [], bills: [], incidents: [] }] };
}

function customerMatchesQuery(customer, query) {
  const normalized = String(query ?? '').trim().toLocaleLowerCase();
  if (!normalized) return true;
  const fields = [customer.name, customer.phone, customer.address].map(value => String(value ?? '').toLocaleLowerCase());
  if (fields.some(value => value.includes(normalized))) return true;
  const numberQuery = normalized.replace(/^#\s*/, '').trim();
  return /^\d+$/.test(numberQuery) && String(customer.customerNumber ?? '').includes(numberQuery);
}

export function searchCustomers(state, query = '') {
  return state.customers.filter(customer => customerMatchesQuery(customer, query));
}

export function deleteCustomer(state, customerId) {
  return { ...state, customers: state.customers.filter(c => c.id !== customerId) };
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
    address: cleanText(valueOrCurrent('address') ?? '', 200, 'Address'),
    phone: cleanText(valueOrCurrent('phone') ?? '', 40, 'Phone number'),
    packageSpeed: cleanText(valueOrCurrent('packageSpeed') ?? '', 80, 'Package/speed'),
    monthlyPurchaseCost: checkCost(valueOrCurrent('monthlyPurchaseCost')),
    monthlySellingAmount: checkPositiveAmount(valueOrCurrent('monthlySellingAmount'), true)
  };
  const previousPrice = current.monthlySellingAmount ?? null;
  const nextPrice = fields.monthlySellingAmount ?? null;
  const priceChanged = (previousPrice === null) !== (nextPrice === null) || (previousPrice !== null && nextPrice !== null && moneyCents(previousPrice) !== moneyCents(nextPrice));
  let monthlyPriceSchedule = Array.isArray(current.monthlyPriceSchedule) ? [...current.monthlyPriceSchedule] : [];
  if (priceChanged) {
    const currentMonth = monthKey(referenceDate);
    const currentBillExists = (current.bills ?? []).some(bill => bill.month === currentMonth);
    const effectiveMonth = currentBillExists ? nextMonthKey(currentMonth) : currentMonth;
    monthlyPriceSchedule = [...monthlyPriceSchedule.filter(entry => entry.effectiveMonth !== effectiveMonth), { amount:nextPrice, effectiveMonth, recordedAt:localDateTimeValue(referenceDate) }];
  }
  return { ...state, customers: state.customers.map(c => c.id === customerId ? { ...c, ...fields, monthlyPriceSchedule } : c) };
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

export function saveBillMonth(state, customerId, { month, dueAmount = null, status }, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (!['pending', 'received'].includes(status)) throw new Error('Choose Pending or Received.');
  const due = checkPositiveAmount(dueAmount, true);
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  if (!existing && due === null) throw new Error('Enter a bill amount before creating a bill. Unconfigured customers do not receive bills.');
  const amountHistory = [...(existing?.amountHistory ?? [])];
  const oldAmount = existing?.dueAmount ?? null;
  const amountChanged = existing && ((oldAmount === null) !== (due === null) || (oldAmount !== null && due !== null && moneyCents(oldAmount) !== moneyCents(due)));
  if (amountChanged) amountHistory.push({ changedAt:localDateTimeValue(referenceDate), previousAmount:oldAmount, newAmount:due, source:'manual correction' });
  const bill = existing
    ? { ...existing, dueAmount:due, status, amountHistory }
    : { id:makeId(), month, dueAmount:due, status, payments:[], generated:false, priceSnapshot:null, createdAt:localDateTimeValue(referenceDate), amountHistory:[] };
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
      let dueRemainingCents = bill.status === 'received' ? 0 : billAmountCents;
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

      // A manually marked Received bill has zero due, but an actual receipt can still
      // be entered later for audit; apply that real cash to this bill before carrying excess.
      let sameMonthReceiptCapacityCents = bill.status === 'received' ? billAmountCents : dueRemainingCents;
      for (const payment of payments) {
        const amountCents = moneyCents(payment.amount);
        const paymentLedger = { paymentId:payment.id, customerId:customer.id, customerNumber:customer.customerNumber, customerName:customer.name, originMonth:bill.month, date:payment.date, method:payment.method, amount:Number(payment.amount), allocations:[], excessCents:0, unappliedCreditCents:0, billUnpriced:false };
        byPaymentId.set(payment.id, paymentLedger);
        const appliedCents = Math.min(amountCents, sameMonthReceiptCapacityCents);
        if (appliedCents > 0) {
          paymentLedger.allocations.push({ month:bill.month, amountCents:appliedCents, kind:'same-month' });
          summary.sameMonthAppliedCents += appliedCents;
          sameMonthReceiptCapacityCents -= appliedCents;
          if (bill.status !== 'received') dueRemainingCents -= appliedCents;
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
  if (!bill) return 'not-recorded';
  if (bill.status === 'received') return 'received';
  const summary = allocations.byCustomerMonth.get(monthAllocationKey(customer.id, bill.month));
  return summary?.balanceDueCents === 0 ? 'received' : 'pending';
}

export function effectiveBillStatus(customer, bill, referenceDate = new Date()) {
  if (!bill) return 'not-recorded';
  if (bill.status === 'received') return 'received';
  return billStatusWithAllocations(customer, bill, calculatePaymentAllocations({ customers:[customer] }));
}

export function listTransactions(state, { customerQuery = '', date = '' } = {}, referenceDate = new Date()) {
  const query = String(customerQuery).trim().toLocaleLowerCase();
  const allocations = calculatePaymentAllocations(state);
  return state.customers.flatMap(customer => (customer.bills ?? []).flatMap(bill => (bill.payments ?? []).map(payment => ({
    id: payment.id,
    paymentId: payment.id,
    customerId: customer.id,
    customerNumber: customer.customerNumber,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerAddress: customer.address,
    month: bill.month,
    status: billStatusWithAllocations(customer, bill, allocations),
    date: payment.date,
    amount: Number(payment.amount),
    method: payment.method,
    allocation:allocations.byPaymentId.get(payment.id)
  })))).filter(row => customerMatchesQuery({ name:row.customerName, phone:row.customerPhone, address:row.customerAddress, customerNumber:row.customerNumber }, query) && (!date || row.date === date))
    .sort((a, b) => b.date.localeCompare(a.date) || a.customerName.localeCompare(b.customerName) || b.month.localeCompare(a.month) || a.paymentId.localeCompare(b.paymentId));
}

export function buildMonthlyReport(state, { month = monthsForHistory()[0], statusFilter = 'all', customerQuery = '' } = {}, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (!['all', 'paid', 'unpaid', 'partial'].includes(statusFilter)) throw new Error('Choose All, Paid, Unpaid, or Partial.');
  const allocations = calculatePaymentAllocations(state);
  return state.customers.filter(customer => customerMatchesQuery(customer, customerQuery)).map(customer => {
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
    const creditPending = moneyValue(allocation?.pendingCreditCents ?? 0);
    if (configuredAmount !== null && configuredAmount !== undefined && configuredAmount !== '') {
      billAmount = Number(configuredAmount);
      excessAmount = moneyValue(allocation?.excessGeneratedCents ?? 0);
      balanceDue = moneyValue(allocation?.balanceDueCents ?? moneyCents(billAmount));
      if (billStatusWithAllocations(customer, bill, allocations) === 'received') {
        status = 'paid';
      } else if (amountReceived > 0 || creditApplied > 0) {
        status = 'partial';
      } else {
        status = 'unpaid';
      }
    }
    return {
      customerId:customer.id,
      customerNumber:customer.customerNumber,
      customerName:customer.name,
      packageSpeed:customer.packageSpeed || '',
      monthlySellingAmount:customer.monthlySellingAmount,
      month,
      billAmount,
      amountReceived,
      balanceDue,
      excessAmount,
      creditApplied,
      creditSources:allocation?.creditSources ?? [],
      creditForwarded,
      creditPending,
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
  const previousMonth = monthKey(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1));
  const today = dateKey(referenceDate);
  let totalCollectionCents = 0;
  let todayCollectionCents = 0;
  let previousMonthCollectionCents = 0;
  let totalDueCents = 0;
  let currentMonthDueCents = 0;
  let expectedMonthlyPackageProfitCents = 0;
  let unpricedBillCount = 0;
  let completeProfitProfiles = 0;

  for (const customer of state.customers) {
    const profit = customerPackageProfit(customer);
    if (profit === null) {
      // Missing monthly selling amount or purchase cost: exclude, never assume a value.
    } else {
      completeProfitProfiles++;
      expectedMonthlyPackageProfitCents += moneyCents(profit);
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
        if (bill.status !== 'received') unpricedBillCount++;
        continue;
      }
      const allocation = allocations.byCustomerMonth.get(monthAllocationKey(customer.id, bill.month));
      const outstandingCents = bill.status === 'received' ? 0 : (allocation?.balanceDueCents ?? moneyCents(amount));
      totalDueCents += outstandingCents;
      if (bill.month === currentMonth) currentMonthDueCents += outstandingCents;
    }

  }

  const incompleteProfitProfiles = state.customers.length - completeProfitProfiles;
  return {
    totalCustomers: state.customers.length,
    totalCollection: moneyValue(totalCollectionCents),
    totalDue: moneyValue(totalDueCents),
    todayCollection: moneyValue(todayCollectionCents),
    previousMonthCollection: moneyValue(previousMonthCollectionCents),
    currentMonthDue: moneyValue(currentMonthDueCents),
    expectedMonthlyPackageProfit: moneyValue(expectedMonthlyPackageProfitCents),
    currentMonth,
    previousMonth,
    today,
    customersMissingSellingAmount: state.customers.filter(customer => customer.monthlySellingAmount === null || customer.monthlySellingAmount === undefined || customer.monthlySellingAmount === '').length,
    incompleteProfitProfiles,
    unpricedBillCount
  };
}

function paymentLines(customer, bill, allocations) {
  return (bill.payments ?? []).map(payment => {
    const allocation = allocations.byPaymentId.get(payment.id);
    const sameMonthCents = (allocation?.allocations ?? []).filter(item => item.kind === 'same-month').reduce((sum,item) => sum + item.amountCents, 0);
    const carried = (allocation?.allocations ?? []).filter(item => item.kind === 'carry-forward');
    const lines = [`Customer number: ${customer.customerNumber}`, `Customer: ${customer.name}`, `Selected bill month: ${bill.month}`, `Actual payment date: ${payment.date}`, `Amount: ${Number(payment.amount).toFixed(2)} (actual receipt, counted once)`, `Method: ${payment.method}`];
    if (allocation?.billUnpriced) lines.push('Allocation: selected bill has no saved amount; no excess credit was inferred.');
    else {
      lines.push(`Applied to selected bill: ${moneyValue(sameMonthCents).toFixed(2)}`);
      for (const item of carried) lines.push(`Auto-credit applied to ${item.month}: ${moneyValue(item.amountCents).toFixed(2)} (allocation, not a new payment)`);
      if (allocation?.unappliedCreditCents) lines.push(`Credit waiting for a future generated bill: ${moneyValue(allocation.unappliedCreditCents).toFixed(2)}`);
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
    `Package / speed: ${customer.packageSpeed || 'Not set'}`,
    `Monthly provider purchase cost: ${customer.monthlyPurchaseCost ?? 'Not set'}`,
    `Monthly selling amount: ${customer.monthlySellingAmount ?? 'Not set'}`,
    `Expected monthly package profit: ${customerPackageProfit(customer) ?? 'Not set'}`,
    ''
  ];
  if (!customer.bills.length) lines.push('No billing details have been recorded.');
  for (const bill of [...customer.bills].sort((a,b) => a.month.localeCompare(b.month))) {
    const status = billStatusWithAllocations(customer, bill, allocations) === 'received' ? 'Received' : 'Pending / partial';
    const allocation = allocations.forMonth(customer.id, bill.month);
    lines.push(`Month: ${bill.month}`, `Status: ${status}`, `Bill amount: ${bill.dueAmount ?? 'Not recorded'}`, `Actual payments received: ${recordedAmount(bill).toFixed(2)}`, `Carry-forward credit applied to this bill (not new cash): ${moneyValue(allocation?.creditAppliedCents ?? 0).toFixed(2)}`, `Balance due after payments and credits: ${allocation?.balanceDueCents === null || allocation?.balanceDueCents === undefined ? 'Not recorded' : moneyValue(allocation.balanceDueCents).toFixed(2)}`);
    for (const source of allocation?.creditSources ?? []) lines.push(`  Credit source: original ${source.receiptAmount.toFixed(2)} receipt dated ${source.paymentDate} (${source.method}) from ${source.originMonth}; applied here=${moneyValue(source.amountCents).toFixed(2)}`);
    if (bill.generated && bill.priceSnapshot !== null && bill.priceSnapshot !== undefined) lines.push(`Automatic monthly bill price snapshot: ${bill.priceSnapshot}`);
    if (allocation?.excessGeneratedCents) lines.push(`Excess from this month's receipts: ${moneyValue(allocation.excessGeneratedCents).toFixed(2)}`);
    if (allocation?.creditForwardedCents) lines.push(`Credit automatically applied to later generated bills: ${moneyValue(allocation.creditForwardedCents).toFixed(2)}`);
    if (allocation?.pendingCreditCents) lines.push(`Credit waiting for a future generated bill: ${moneyValue(allocation.pendingCreditCents).toFixed(2)}`);
    for (const correction of bill.amountHistory ?? []) lines.push(`  Bill amount correction at ${correction.changedAt}: previous=${correction.previousAmount ?? 'Not recorded'}, new=${correction.newAmount ?? 'Not recorded'}`);
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
