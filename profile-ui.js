import { PAYMENT_METHODS, calculatePaymentAllocations, derivedBillStatus, formatPKR, listTransactions, nextCycleDueDateFromBillMonth, searchCustomers } from './core.js';

const BILL_STATUS = Object.freeze({
  paid: { label:'Paid', className:'status-received' },
  pending: { label:'Pending', className:'status-pending' },
  partial: { label:'Partial', className:'status-partial' },
  'not-set': { label:'Not set', className:'status-empty' }
});
const normalisePhoneSyntax = phone => String(phone ?? '').trim().replace(/[\s().-]/g, '');
const validCalendarDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};
const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
const formatReceiptDate = value => {
  if (!validCalendarDate(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(12, 0, 0, 0);
  return new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).format(date).replace(',', '');
};
const formatReceiptMonth = value => validMonth(value)
  ? new Intl.DateTimeFormat('en-US', { month:'short', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}-01T00:00:00Z`))
  : null;
const safeLine = (value, limit = 120) => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, limit);

/** Present only a saved bill and the balance computed from existing payment allocations. */
export function currentBillPresentation(customer, month, allocations) {
  const bill = (customer?.bills ?? []).find(item => item.month === month) ?? null;
  const amount = bill?.dueAmount;
  const hasBillAmount = amount !== null && amount !== undefined && amount !== '' && Number.isFinite(Number(amount)) && Number(amount) > 0;
  const status = derivedBillStatus(customer, bill, allocations);
  const summary = allocations?.forMonth?.(customer?.id, month);
  const balanceDueCents = summary?.balanceDueCents ?? null;
  const receivedAmount = bill ? (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) : 0;
  const statusPresentation = BILL_STATUS[status] ?? BILL_STATUS['not-set'];

  return {
    month,
    billAmount: hasBillAmount ? Number(amount) : null,
    billAmountLabel: hasBillAmount ? formatPKR(Number(amount)) : 'Not set',
    status,
    statusLabel: statusPresentation.label,
    statusClassName: statusPresentation.className,
    receivedAmount,
    receivedAmountLabel: bill?.payments?.length ? formatPKR(receivedAmount) : 'No receipts',
    receiptCount: bill?.payments?.length ?? 0,
    balanceDueCents,
    balanceDueLabel: balanceDueCents === null ? 'Not set' : formatPKR(balanceDueCents / 100)
  };
}

/** Cross-search matching customers and their saved bill/payment detail, irrespective of customer-list filters. */
export function buildGlobalLedgerSearch(state, query, month) {
  const normalized = String(query ?? '').normalize('NFKC').trim();
  if (!normalized) return [];
  const allocations = calculatePaymentAllocations(state);
  const allTransactions = listTransactions(state);
  const matchingTransactions = listTransactions(state, { customerQuery:normalized });
  return searchCustomers(state, normalized).map(customer => {
    const receipts = allTransactions.filter(row => row.customerId === customer.id);
    const matchedReceiptIds = new Set(matchingTransactions.filter(row => row.customerId === customer.id).map(row => row.paymentId));
    const orderedReceipts = [...receipts].sort((a, b) => Number(matchedReceiptIds.has(b.paymentId)) - Number(matchedReceiptIds.has(a.paymentId)) || b.date.localeCompare(a.date) || a.paymentId.localeCompare(b.paymentId));
    return {
      customer,
      billing:currentBillPresentation(customer, month, allocations),
      receipts:orderedReceipts.slice(0, 3),
      receiptCount:receipts.length,
      matchingReceiptCount:receipts.filter(row => matchedReceiptIds.has(row.paymentId)).length
    };
  });
}

/** Build call and WhatsApp targets without guessing a country code or accepting extension/URL syntax. */
export function contactActionTargets(phone) {
  const compact = normalisePhoneSyntax(phone);
  if (!/^\+?\d{3,20}$/.test(compact)) return null;
  const explicitInternational = /^\+?[1-9]\d{7,14}$/.test(compact);
  return {
    tel:`tel:${compact}`,
    whatsapp:explicitInternational ? `https://wa.me/${compact.replace(/^\+/, '')}` : null
  };
}

/** Return a user-reviewed wa.me composer URL for one saved receipt; never sends a message. */
export function createReceiptWhatsAppDraft(phone, receipt) {
  const target = contactActionTargets(phone)?.whatsapp;
  const amount = Number(receipt?.amount);
  const name = safeLine(receipt?.customerName);
  const method = safeLine(receipt?.method, 40);
  const customerNumber = Number(receipt?.customerNumber);
  const date = String(receipt?.date ?? '');
  const month = String(receipt?.month ?? '');
  if (!target || !name || !Number.isSafeInteger(customerNumber) || customerNumber < 1 || !Number.isFinite(amount) || amount <= 0 || !validCalendarDate(date) || !validMonth(month) || !PAYMENT_METHODS.includes(method)) return null;

  const billAmount = Number(receipt?.billAmount);
  const balanceDueCents = Number(receipt?.balanceDueCents);
  const hasBillContext = Number.isFinite(billAmount) && billAmount > 0 && Number.isSafeInteger(balanceDueCents) && balanceDueCents >= 0;
  const requestedStatus = receipt?.billStatus ?? receipt?.status;
  const billStatus = hasBillContext
    ? requestedStatus === 'paid' && balanceDueCents === 0 ? 'paid'
      : requestedStatus === 'partial' && balanceDueCents > 0 ? 'partial'
        : null
    : null;
  const paidBy = safeLine(receipt?.paidBy, 100);
  const lines = [
    '🧾 SHAHDARA ISP — PAYMENT RECEIPT',
    '',
    `👤 Customer: ${name}`,
    `🆔 Customer #: ${customerNumber}`,
    ...(paidBy ? [`Paid by: ${paidBy}`] : []),
    '',
    `💰 Amount ${billStatus === 'paid' ? 'Paid' : 'Received'}: ${formatPKR(amount)}`,
    `📅 Payment Date: ${formatReceiptDate(date)}`,
    `💳 Method: ${method}`,
    `📆 Billing Month: ${formatReceiptMonth(month)}`
  ];

  if (billStatus === 'paid') {
    const nextBillDue = formatReceiptDate(nextCycleDueDateFromBillMonth(month)) ?? 'Not available';
    lines.push(
      '',
      '✅ Status: PAID',
      '💵 Outstanding: PKR 0',
      '',
      '━━━━━━━━━━━━━━',
      `📅 Next Bill Due: ${nextBillDue}`,
      '',
      '⚠️ Please pay by the 5th to avoid service interruption. thanks 🥰'
    );
  } else if (billStatus === 'partial') {
    const currentBillDue = formatReceiptDate(receipt?.billDueDate) ?? 'Not recorded';
    lines.push(
      '',
      '🟠 Status: PARTIAL',
      `💵 Outstanding: ${formatPKR(balanceDueCents / 100)}`,
      `💳 Bill Amount: ${formatPKR(billAmount)}`,
      `📅 Current Bill Due: ${currentBillDue}`
    );
  }

  const message = lines.join('\n');
  return { url:`${target}?text=${encodeURIComponent(message)}`, message };
}

/** Bind each actual receipt only to its owning profile's saved number and identity. */
export function resolveReceiptWhatsAppAction(customer, receipt) {
  if (!customer?.id || !receipt || receipt.customerId !== customer.id) return { type:'unavailable', reason:'customer-mismatch' };
  const phone = String(customer.phone ?? '').trim();
  if (!contactActionTargets(phone)?.whatsapp) return { type:'phone-required', hasSavedPhone:Boolean(phone) };
  const draft = createReceiptWhatsAppDraft(phone, {
    ...receipt,
    customerName:customer.name,
    customerNumber:customer.customerNumber
  });
  return draft ? { type:'draft', draft } : { type:'unavailable', reason:'invalid-receipt' };
}
