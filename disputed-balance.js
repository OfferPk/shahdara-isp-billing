// Plan 62 (Plan 1-100) — Disputed amount shown separately, undisputed
// balance still due.
//
// While a bill is disputed, the whole bill looks overdue, so the
// customer stops paying even the part nobody disputes and the chase
// becomes unfair. This module is the presentation split only: for
// one bill it shows total, disputed amount, and undisputed balance
// separately, and it builds the reminder draft the ladder sends
// while a case is open — a draft that chases only the undisputed
// portion and says plainly that a dispute is open.
//
// The fences, stated plainly:
//   - Presentation and reminder handling only. No amount is
//     rewritten, no bill, payment, or Waada record is touched, and
//     the bill-extension rule (Plan 38) is untouched — this module
//     holds no bill total to rewrite, only the split it computed
//     from caller-supplied figures.
//   - Only an OPEN Plan 61 case counts (open, investigating,
//     escalated to owner). A resolved case is history: it is
//     excluded here, so closing a case restores the ordinary
//     full-balance view with no code path to remember.
//   - Any correction or concession still goes through its existing
//     path (Plan K), never through this split or its draft.
//   - Amounts are summed in integer cents, so no float drift.
//     Inputs are never mutated, and the module never reads storage,
//     the clock, or the network. It is import-free by design, like
//     the other pure modules: the caller supplies every bill and
//     every case, already in Plan 61's shape.
//
// Matching a case to a bill: same customer, and the same bill —
// matched by bill id when the caller supplies one, otherwise by
// bill month. A case for another customer or another bill never
// contributes, and a case with no usable amount is counted, never
// zero-filled into a total.
//
// When the disputed amount exceeds the bill total, the undisputed
// balance is 0 — never negative — and the excess is reported
// separately, so the figures still reconcile in plain words:
// total + excess = disputed + undisputed.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

// A usable money amount in integer cents, or null. Booleans, null,
// blank, non-finite, and non-positive values are not amounts — a
// missing amount is never silently read as zero.
function toCents(amount) {
  if (typeof amount === 'boolean' || amount === null || amount === undefined) return null;
  if (typeof amount === 'string' && amount.trim() === '') return null;
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function fromCents(cents) {
  return cents / 100;
}

export function formatDisputedAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'Rs. 0';
  return `Rs. ${num}`;
}

// The Plan 61 open statuses, restated here so this module stays
// import-free: resolved cases are history, never a live dispute.
export const DISPUTED_BALANCE_OPEN_STATUSES = ['open', 'investigating', 'escalated'];

export const DISPUTED_REMINDER_VARIANTS = Object.freeze({
  ROMAN: 'roman',
  URDU: 'urdu',
});

// Normalise one caller-supplied case to the fields this module
// needs, or null when it carries nothing usable. A case with a
// disputed amount that cannot be read as money is kept with a null
// amount and counted by the caller-visible count, never summed.
function normalizeCase(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const customerId = text(raw.customerId);
  const billId = text(raw.billId);
  const billMonth = text(raw.billMonth);
  if (!customerId) return null;
  const status = text(raw.status).toLowerCase().replace(/[\s-]+/g, '_');
  const amountCents = raw.disputedAmountCents !== undefined && raw.disputedAmountCents !== null
    ? (typeof raw.disputedAmountCents === 'number' && Number.isFinite(raw.disputedAmountCents) && raw.disputedAmountCents > 0
      ? Math.round(raw.disputedAmountCents) : null)
    : toCents(raw.disputedAmount ?? raw.amount);
  return {
    id: text(raw.id),
    customerId,
    customerName: text(raw.customerName),
    billId,
    billMonth,
    status,
    disputedAmountCents: amountCents,
    disputedAmount: amountCents === null ? null : fromCents(amountCents),
  };
}

function normalizeCaseList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const item = normalizeCase(raw);
    if (item) out.push(item);
  }
  return out;
}

function isOpenCase(entry) {
  return DISPUTED_BALANCE_OPEN_STATUSES.includes(entry.status);
}

// Open cases for one bill: same customer, same bill (by id when
// the caller supplies one, otherwise by month). Resolved cases
// never match, so a closed case restores the full-balance view.
export function openCasesForBill(cases, { customerId, billId, billMonth } = {}) {
  const customer = text(customerId);
  const id = text(billId);
  const month = text(billMonth);
  if (!customer || (!id && !month)) return [];
  return normalizeCaseList(cases).filter((entry) => {
    if (!isOpenCase(entry)) return false;
    if (entry.customerId !== customer) return false;
    if (id) return entry.billId === id;
    return entry.billMonth !== '' && entry.billMonth === month;
  });
}

// The split for one bill. Returns null when the bill total is not
// a usable amount — a split is never shown for a figure that was
// never recorded. Disputed sums only the open cases' usable
// amounts; unusable amounts are counted in unusableCaseCount and
// never zero-filled.
export function splitBillBalance({ total, cases, customerId, billId, billMonth } = {}) {
  const totalCents = toCents(total);
  if (totalCents === null) return null;
  const open = openCasesForBill(cases, { customerId, billId, billMonth });
  let disputedCents = 0;
  let unusableCaseCount = 0;
  const caseIds = [];
  for (const entry of open) {
    if (entry.id) caseIds.push(entry.id);
    if (entry.disputedAmountCents === null) unusableCaseCount += 1;
    else disputedCents += entry.disputedAmountCents;
  }
  const undisputedCents = Math.max(totalCents - disputedCents, 0);
  const excessCents = Math.max(disputedCents - totalCents, 0);
  return {
    customerId: text(customerId),
    billId: text(billId),
    billMonth: text(billMonth),
    total: fromCents(totalCents),
    totalCents,
    disputed: fromCents(disputedCents),
    disputedCents,
    undisputed: fromCents(undisputedCents),
    undisputedCents,
    excess: fromCents(excessCents),
    excessCents,
    hasOpenDispute: open.length > 0,
    fullyDisputed: open.length > 0 && undisputedCents === 0,
    caseCount: open.length,
    caseIds,
    unusableCaseCount,
    // total + excess always equals disputed + undisputed.
    reconciles: totalCents + excessCents === disputedCents + undisputedCents,
  };
}

// The split for a list of bills, one row per bill that has an open
// dispute; bills without one keep their ordinary full balance and
// are not listed here. Sorted by customer name, then bill month,
// so the view reads in the same order every time.
export function splitBillList(bills, cases) {
  const list = Array.isArray(bills) ? bills : [];
  const rows = [];
  for (const bill of list) {
    if (!bill || typeof bill !== 'object') continue;
    const split = splitBillBalance({
      total: bill.total ?? bill.balanceDue ?? bill.amount,
      cases,
      customerId: bill.customerId,
      billId: bill.billId ?? bill.id,
      billMonth: bill.billMonth ?? bill.month,
    });
    if (!split || !split.hasOpenDispute) continue;
    rows.push({
      ...split,
      customerName: text(bill.customerName) || split.customerId,
      mohalla: text(bill.mohalla),
    });
  }
  rows.sort((a, b) => {
    const an = a.customerName.toLowerCase();
    const bn = b.customerName.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    if (a.billMonth !== b.billMonth) return a.billMonth < b.billMonth ? -1 : 1;
    return a.billId < b.billId ? -1 : a.billId > b.billId ? 1 : 0;
  });
  let totalCents = 0;
  let disputedCents = 0;
  let undisputedCents = 0;
  for (const row of rows) {
    totalCents += row.totalCents;
    disputedCents += row.disputedCents;
    undisputedCents += row.undisputedCents;
  }
  return {
    rows,
    summary: {
      billCount: rows.length,
      total: fromCents(totalCents),
      totalCents,
      disputed: fromCents(disputedCents),
      disputedCents,
      undisputed: fromCents(undisputedCents),
      undisputedCents,
    },
  };
}

// Reminder-ladder handling: rewrite a ladder bill list so each bill
// chases only its undisputed portion while a case is open. A fully
// disputed bill keeps a 0 balance, which the ladder already
// excludes as a zero-balance bill — it never appears as a chase.
// The bill-extension rule is untouched: this runs on whatever list
// the caller passes (in the app, the post-extension list), and it
// changes only the balance figure, never a due date. Returns a NEW
// list; the caller's bills are never mutated.
export function adjustLadderBills(bills, cases) {
  const list = Array.isArray(bills) ? bills : [];
  let adjustedCount = 0;
  let fullyDisputedCount = 0;
  let totalDisputedCents = 0;
  const out = list.map((bill) => {
    if (!bill || typeof bill !== 'object') return bill;
    const split = splitBillBalance({
      total: bill.balanceDue ?? bill.amount,
      cases,
      customerId: bill.customerId,
      billId: bill.billId ?? bill.id,
      billMonth: bill.billMonth ?? bill.month,
    });
    if (!split || !split.hasOpenDispute) return { ...bill };
    adjustedCount += 1;
    totalDisputedCents += split.disputedCents;
    if (split.fullyDisputed) fullyDisputedCount += 1;
    return {
      ...bill,
      balanceDue: split.undisputed,
      disputeNote: split,
    };
  });
  return { bills: out, adjustedCount, fullyDisputedCount, totalDisputedCents };
}

// Per-customer dispute totals across a bill list, for the ladder
// send path: the draft for a customer chases the customer's total
// undisputed portion and names the total disputed portion.
export function disputeTotalsForCustomer(bills, cases, customerId) {
  const customer = text(customerId);
  if (!customer) return null;
  const list = Array.isArray(bills) ? bills : [];
  let totalCents = 0;
  let disputedCents = 0;
  let undisputedCents = 0;
  let caseCount = 0;
  for (const bill of list) {
    if (!bill || typeof bill !== 'object') continue;
    if (text(bill.customerId) !== customer) continue;
    const split = splitBillBalance({
      total: bill.balanceDue ?? bill.total ?? bill.amount,
      cases,
      customerId: customer,
      billId: bill.billId ?? bill.id,
      billMonth: bill.billMonth ?? bill.month,
    });
    if (!split || !split.hasOpenDispute) continue;
    totalCents += split.totalCents;
    disputedCents += split.disputedCents;
    undisputedCents += split.undisputedCents;
    caseCount += split.caseCount;
  }
  if (caseCount === 0) return null;
  return {
    customerId: customer,
    hasOpenDispute: true,
    total: fromCents(totalCents),
    totalCents,
    disputed: fromCents(disputedCents),
    disputedCents,
    undisputed: fromCents(undisputedCents),
    undisputedCents,
    caseCount,
  };
}

function formatDate(value) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw || '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [, month, day] = raw.split('-').map(Number);
  return `${day} ${months[month - 1]}`;
}

// The reminder draft while a dispute is open. It chases ONLY the
// undisputed portion and says plainly that a dispute is open — it
// never asks for the disputed amount, and it never promises a
// disconnection. Returns null when there is no open dispute to
// note, or when nothing undisputed remains to chase; the caller
// then falls back to the ordinary ladder draft (or, for a fully
// disputed bill, to no chase at all).
export function buildDisputedReminderDraft({ customerName, step, dueDate, daysOverdue, split } = {}, variant = DISPUTED_REMINDER_VARIANTS.ROMAN) {
  if (!split || !split.hasOpenDispute || split.undisputedCents <= 0) return null;
  const name = text(customerName) || '—';
  const undisputed = formatDisputedAmount(split.undisputed);
  const disputed = formatDisputedAmount(split.disputed);
  const due = formatDate(dueDate);
  const days = Number(daysOverdue);
  const dayWord = Number.isFinite(days) ? `${days} din` : '';
  const stepWord = step === 'final' ? 'final notice' : step === 'firm' ? 'firm reminder' : 'gentle reminder';
  if (variant === DISPUTED_REMINDER_VARIANTS.URDU) {
    return {
      variant: DISPUTED_REMINDER_VARIANTS.URDU,
      step: stepWord,
      text: `السلام علیکم ${name}، یاد دہانی: آپ کے بل پر تنازعہ زیر غور ہے، اس لیے متنازعہ ${disputed} کے علاوہ صرف غیر متنازعہ ${undisputed} ابھی واجب الادا ہے (واجب الادا تاریخ ${due}، ${dayWord} سے واجب الادا)۔ برائے مہربانی غیر متنازعہ رقم جلد ادا فرما دیں، تنازعہ حل ہوتے ہی باقی رقم کا فیصلہ ہو جائے گا۔ شکریہ — شاہدرہ فائبر نیٹ۔`,
    };
  }
  return {
    variant: DISPUTED_REMINDER_VARIANTS.ROMAN,
    step: stepWord,
    text: `Assalam-o-Alaikum ${name}, yaad dehani: aap ke bill par dispute open hai, is liye disputed ${disputed} ke ilawa sirf undisputed ${undisputed} abhi due hai (due date ${due}, ${dayWord} se overdue). Baraye meherbani undisputed raqam jald ada farma dein; dispute hal hote hi baqi raqam ka faisla ho jaye ga. Shukriya — Shahdara Fiber Net.`,
  };
}

export function disputedBalanceSummaryText(result) {
  const summary = result?.summary;
  if (!summary || summary.billCount === 0) return 'No bill currently has an open dispute — every bill shows its ordinary full balance.';
  return `${summary.billCount} bill${summary.billCount === 1 ? '' : 's'} with an open dispute: total Rs. ${summary.total}, disputed Rs. ${summary.disputed}, undisputed still due Rs. ${summary.undisputed}. The reminder ladder chases only the undisputed portion while a case is open; closing a case restores the ordinary full-balance view.`;
}

function splitRowHtml(row) {
  const name = row.customerName ? `${escapeHtml(row.customerName)} (${escapeHtml(row.customerId)})` : escapeHtml(row.customerId);
  const billLabel = row.billMonth ? `${escapeHtml(row.billMonth)}${row.billId ? ` (${escapeHtml(row.billId)})` : ''}` : escapeHtml(row.billId);
  return `<tr><td>${name}</td><td>${billLabel}</td><td>Rs. ${row.total}</td><td>Rs. ${row.disputed}</td><td><strong>Rs. ${row.undisputed}</strong></td><td>${row.caseCount} open case${row.caseCount === 1 ? '' : 's'}${row.excessCents > 0 ? ` · Rs. ${row.excess} disputed above the bill total` : ''}${row.unusableCaseCount > 0 ? ` · ${row.unusableCaseCount} case${row.unusableCaseCount === 1 ? '' : 's'} with no usable amount, not counted` : ''}</td></tr>`;
}

export function disputedBalanceHtml(result) {
  const rows = result?.rows ?? [];
  if (rows.length === 0) return '<p style="font-size: 12px;">No bill currently has an open dispute — every bill shows its ordinary full balance.</p>';
  return `<table class="data-table"><thead><tr><th>Customer</th><th>Bill</th><th>Total</th><th>Disputed</th><th>Undisputed still due</th><th>Open cases</th></tr></thead><tbody>${rows.map(splitRowHtml).join('')}</tbody></table>`;
}

export function disputedBalanceCsv(result) {
  const rows = result?.rows ?? [];
  const header = ['customerId', 'customerName', 'billId', 'billMonth', 'total', 'disputed', 'undisputed', 'openCaseCount'].map(csvCell).join(',');
  const lines = rows.map((row) => [row.customerId, row.customerName, row.billId, row.billMonth, row.total, row.disputed, row.undisputed, row.caseCount].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function disputedBalanceFilename() {
  return 'disputed-balances.csv';
}
