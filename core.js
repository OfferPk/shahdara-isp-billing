export const INITIAL_NAMES = Object.freeze([
  'NAZEER','AWAIS','TEHMENA','SAFEER','KHALEEL','DARBAR','ALI SHAH','ZARSHAD KHAN','AC HOUSE','MNA HOUSE','CH BILAL','MUHAMMAD QASIM','RAJA JUNAID','RAJA USAMA','PATHAN','HASEEB','RAJA BILAL','QARI MUBASIR','FAREED ABBASI','JAWAD RAJA','HAJI ZAFAR','DOCTOR ZAHID','DOCTER EHSAN','AQIB OWNER','SAQIB EJAZ','RAJA RIAZ','RAJA JAHANGEER','RAJA NOMI','RAJA MOHSIN','MUFTI SADAQAT','TOUSEEF RAJA','KIRAN BILAL','SIKANDAR ABBASI','RAJA FAISAL','RAJA ALI','RAJA SHUNAID','BUT HOUSE','AZEEM BAJWA HOUSE','BANGISH HOUSE','RAJA HAFEEZ','RAJA KHAZER','ZUBAIR USTAD','MEHMOOD ABBASI','RAJA ARIF','RAJA SHEHZAD','KASHIF RAJA','KASHIF ABBASI','SAJID','PTA DIRECTOR','RAJA IRFAN','RAJA FAIZAN','BABAR','CH MURTAZA','QARI BAKAR BAKAR','CH MOIZ','CH SAQLAIN','RAJA MUJAHID','RAJA MASROOR','RAJA TAIMOOR MANGRAYAL','RAJA TAIMOOR CHANDALL','MOBEEN SHAH','NADIR SHAH','SHAH NAWAZ','SHADI','RAB NAWAZ','FAISAL GUJJAR','CH HAMZA','CH SHAFEEQ','CH SANWALL','NADIR GUJJAR','RAJA ASAD','DC HOUSE','AKHTAR HOUSE','SSP HOUSE'
]);
export const PAYMENT_METHODS = Object.freeze(['Cash','JazzCash','Easypaisa','Bank Transfer']);
export const MONTH_LIMIT = 24;
export const STORAGE_KEY = 'shahdara-isp-billing-v1';
const clone = value => JSON.parse(JSON.stringify(value));
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createInitialState(names = INITIAL_NAMES) {
  return { version: 1, customers: names.map((name, index) => ({ id: `seed-${String(index + 1).padStart(3, '0')}`, name, mohalla: '', bills: [] })) };
}

export function readState(storage, key = STORAGE_KEY) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.customers)) return createInitialState();
    return parsed;
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
  return Array.from({ length: MONTH_LIMIT }, (_, i) => {
    const date = new Date(y, m - i, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}

export function addCustomer(state, name) {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) throw new Error('Enter a customer name.');
  if (state.customers.some(c => c.name.localeCompare(cleaned, undefined, { sensitivity: 'accent' }) === 0)) throw new Error('That customer is already in the list.');
  return { ...state, customers: [...state.customers, { id: makeId(), name: cleaned, mohalla: '', bills: [] }] };
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
function checkAmount(value, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error('Amount must be greater than zero.');
  return Math.round(number * 100) / 100;
}
function customerOrThrow(state, customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  if (!customer) throw new Error('Customer not found.');
  return customer;
}

export function saveBillMonth(state, customerId, { month, dueAmount = null, status }, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  if (!['pending', 'received'].includes(status)) throw new Error('Choose Pending or Received.');
  const due = checkAmount(dueAmount, true);
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  const bill = existing ? { ...existing, dueAmount: due, status } : { id: makeId(), month, dueAmount: due, status, payments: [] };
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: existing ? c.bills.map(b => b.month === month ? bill : b) : [...c.bills, bill].sort((a,b) => b.month.localeCompare(a.month)) }) };
}

function validatePayment({ date, amount, method }) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw new Error('Enter a valid payment date.');
  const cents = checkAmount(amount);
  if (!PAYMENT_METHODS.includes(method)) throw new Error('Choose a valid payment method.');
  return { date, amount: cents, method };
}

export function addPayment(state, customerId, month, fields, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const payment = { id: makeId(), ...validatePayment(fields) };
  const customer = customerOrThrow(state, customerId);
  const existing = customer.bills.find(b => b.month === month);
  const bill = existing ? { ...existing, payments: [...existing.payments, payment] } : { id: makeId(), month, dueAmount: null, status: 'pending', payments: [payment] };
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: existing ? c.bills.map(b => b.month === month ? bill : b) : [...c.bills, bill].sort((a,b) => b.month.localeCompare(a.month)) }) };
}

export function correctPayment(state, customerId, month, paymentId, fields, referenceDate = new Date()) {
  checkMonth(month, referenceDate);
  const payment = { id: paymentId, ...validatePayment(fields) };
  const customer = customerOrThrow(state, customerId);
  const bill = customer.bills.find(b => b.month === month);
  if (!bill?.payments.some(p => p.id === paymentId)) throw new Error('Payment not found.');
  return { ...state, customers: state.customers.map(c => c.id !== customerId ? c : { ...c, bills: c.bills.map(b => b.month !== month ? b : { ...b, payments: b.payments.map(p => p.id === paymentId ? payment : p) }) }) };
}

export function recordedAmount(bill) {
  return (bill?.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function paymentLines(customer, bill) {
  return (bill.payments ?? []).map(p => `Customer: ${customer.name}\nMonth: ${bill.month}\nPayment date: ${p.date}\nAmount: ${p.amount}\nMethod: ${p.method}\n`);
}

export function exportAllPayments(state) {
  const lines = ['Shahdara ISP Billing — payment details', 'Exported from this device only', ''];
  let count = 0;
  for (const customer of state.customers) for (const bill of customer.bills) for (const line of paymentLines(customer, bill)) { lines.push(line); count++; }
  if (!count) lines.push('No payment entries have been recorded.');
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportCustomerHistory(state, customerId) {
  const customer = customerOrThrow(state, customerId);
  const lines = [`Shahdara ISP Billing — customer history`, `Customer: ${customer.name}`, `Mohalla: ${customer.mohalla || 'Not recorded'}`, ''];
  if (!customer.bills.length) lines.push('No billing details have been recorded.');
  for (const bill of [...customer.bills].sort((a,b) => a.month.localeCompare(b.month))) {
    lines.push(`Month: ${bill.month}`, `Status: ${bill.status === 'received' ? 'Received' : 'Pending'}`, `Bill amount: ${bill.dueAmount ?? 'Not recorded'}`, `Payments received: ${recordedAmount(bill).toFixed(2)}`);
    for (const payment of bill.payments ?? []) lines.push(`  Payment date: ${payment.date} | Amount: ${payment.amount} | Method: ${payment.method}`);
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
