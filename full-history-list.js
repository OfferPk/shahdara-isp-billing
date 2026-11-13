// Plan 401 — Full transaction history list per customer.
// The profile already shows only a mini-slip of recent payments, so a
// customer who asks "show me everything I have ever paid" gets a
// partial answer. This module composes the missing piece: one full
// read-only list per customer — every payment, charge, credit and
// refund in date order, with the amount and the running balance after
// each entry. Sharafat 12: the list also carries the pieces the
// running balance used to miss — late and shifting fees, the seven
// due-reducing bill fields as adjustment lines, manual baqaya
// charges with their owner adjustments, and ticket/add-on charges as
// informational zero-movement lines — and it keeps zero-amount
// bills, payments and credits visible, and credits of any recorded
// source with the source named. It lists only and changes nothing: it reads the bills
// already on the customer record plus the credit entries and refund
// records already stored on this device, and it writes to no store.
// The mini-slip, the receipt-number search, the offline queue view
// and the category tag already exist and are left alone; this list is
// a separate view over the same records, not a search, not today's
// list, and not a filter label.
export const FULL_HISTORY_TYPES = Object.freeze([
  'charge',
  'payment',
  'advance',
  'credit',
  'refund',
  'adjustment',
  // Sharafat 12 — 'info': an informational line, never a movement.
  // The ticket/add-on charge portions of a payment are already
  // inside the payment cash, so they are shown as a labelled line
  // with their amount and move nothing — charging them again would
  // double-count and break the running balance against the dues.
  'info',
]);

export const FULL_HISTORY_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

export const FULL_HISTORY_EMPTY_TEXT = 'No transactions yet';

const HISTORY_TYPE_ORDER = Object.freeze({
  charge: 0,
  payment: 1,
  advance: 2,
  credit: 3,
  refund: 4,
  adjustment: 5,
  info: 6,
});

// Sharafat 12 — the seven due-reducing bill fields, in the engine's
// exact clamp order (the allocation engine in core.js): each one
// subtracts from what is left of the bill, clamped so stacked
// waivers can never drive the due negative. History mirrors that
// order, or a concession larger than the remaining due over-reduces
// the history against the engine.
const HISTORY_BILL_ADJUSTMENT_FIELDS = Object.freeze([
  ['depositOffsetAmount', 'Deposit offset'],
  ['creditTransferInAmount', 'Credit transfer in'],
  ['badDebtWriteOffAmount', 'Bad-debt write-off'],
  ['referralCreditAmount', 'Referral credit'],
  ['concessionAmount', 'Concession'],
  ['feederHostCreditAmount', 'Feeder-host credit'],
  ['firstMonthWaivedAmount', 'First-month waiver'],
]);

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapHistoryYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isStrictHistoryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapHistoryYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function isStrictHistoryMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function cleanHistoryKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanHistoryText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function rupeesToCents(value) {
  // Sharafat 12: a missing, boolean or blank figure is not a number,
  // never zero — Number(null) is 0 and Number(true) is 1, and both
  // would invent a charge out of nothing. A priced zero bill reads
  // as 0 only when the stored figure really is 0.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function finiteCents(value) {
  // Sharafat 12: same rule as rupeesToCents — a missing, boolean or
  // blank figure is not a number, never zero-filled into a credit
  // or a refund.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function historySortKey(entry) {
  if (!entry.date) return '9999-99-99';
  if (entry.date.length === 7) return `${entry.date}-01`;
  return entry.date;
}

function historyEntryDate(value, month) {
  if (isStrictHistoryDate(value)) return value;
  if (isStrictHistoryMonth(month)) return month;
  if (isStrictHistoryMonth(value)) return value;
  return '';
}

// A payment's type follows what it is, not where it was recorded:
// a negative amount is money returned, an advance kind is an advance,
// and a refund or adjustment tag is a refund or an adjustment.
function paymentHistoryType(payment) {
  if (Number(payment?.amount) < 0) return 'refund';
  if (cleanHistoryKey(payment?.kind) === 'advance') return 'advance';
  const tag = cleanHistoryKey(payment?.categoryTag);
  if (tag === 'refund') return 'refund';
  if (tag === 'adjustment') return 'adjustment';
  if (tag === 'advance') return 'advance';
  return 'payment';
}

// A payment's stamped charge lines (SISP-43 ticket charges,
// SISP-106 boost add-on charges): the lines ride the payment as
// `{ amount }` in rupees. Only finite positive lines count — a
// corrupt line reads as no charge, never as an invented one. On
// clean data this equals the engine's paymentTicketChargeCents /
// paymentAddonChargeCents exactly; the builder stays import-free
// (Plan 401 pins that), so it sums the lines itself.
function historyStampChargeCents(lines) {
  if (!Array.isArray(lines)) return 0;
  let total = 0;
  for (const line of lines) {
    const cents = rupeesToCents(line?.amount);
    if (cents !== null && cents > 0) total += cents;
  }
  return total;
}

// The running balance after an entry: what the customer still owes.
// Charges and refunds add to what is owed; payments, advances and
// adjustments reduce it. A credit entry that came from an overpayment
// is already counted inside its source payment, so it moves nothing;
// a credit entry from an approved adjustment reduces what is owed.
// An informational line (ticket/add-on charges already inside the
// payment cash) moves nothing by design — its amount is shown,
// never charged twice. A voided payment is listed but moves nothing.
function historyBalanceDelta(entry) {
  if (entry.voided) return 0;
  if (entry.type === 'info') return 0;
  if (entry.type === 'charge' || entry.type === 'refund') return entry.amountCents;
  if (entry.type === 'payment' || entry.type === 'advance' || entry.type === 'adjustment') {
    return -entry.amountCents;
  }
  if (entry.type === 'credit') {
    return entry.source === 'adjustment' ? -entry.amountCents : 0;
  }
  return 0;
}

export function fullHistoryEntries(input = {}) {
  const customerId = cleanHistoryKey(input.customerId);
  if (!customerId) return [];
  const bills = Array.isArray(input.bills) ? input.bills : [];
  const creditEntries = Array.isArray(input.creditEntries) ? input.creditEntries : [];
  const refundRecords = Array.isArray(input.refundRecords) ? input.refundRecords : [];
  // Sharafat 12: the customer's manual baqaya entries, already
  // derived by core.js manualBaqayaEntriesWithRemaining (full
  // amount, date, note, settled/adjusted/remaining cents, owner
  // adjustments) — the builder reads them, it never re-derives
  // them, and it stays import-free.
  const manualBaqayaEntries = Array.isArray(input.manualBaqayaEntries) ? input.manualBaqayaEntries : [];
  const entries = [];

  for (const bill of bills) {
    if (!bill || typeof bill !== 'object') continue;
    const billMonth = isStrictHistoryMonth(bill.month) ? bill.month : '';
    const billDate = historyEntryDate(bill.dueDate, bill.month);
    // Transactions Screen Overhaul (Plan 449): the bill's own
    // recorded connection, carried onto its entries so the
    // per-connection filter can separate them — until now no entry
    // ever carried one, so a named-connection view was always empty
    // and a second-connection payment was only ever visible under
    // All connections. A bill that names no connection leaves its
    // entries untagged; the filter never guesses a connection.
    const billConnection = cleanHistoryText(bill.connection ?? bill.connectionId);
    const billConnectionTag = billConnection ? { connection: billConnection } : {};
    const chargeCents = rupeesToCents(bill.dueAmount);
    // Sharafat 12: an unpriced bill (dueAmount null/invalid) carries
    // no charge yet — the engine holds its payments as pending
    // credit — so no charge, fee or adjustment entry is built for
    // it. A priced zero bill (dueAmount 0) keeps a visible PKR 0
    // charge entry instead, so a fully-concessed month still
    // appears. Either way the bill's payments are listed below:
    // they are real cash, and a later bill settles against them, so
    // dropping them would leave the final balance above the dues.
    if (chargeCents !== null) {
      entries.push({
        type: 'charge',
        date: billDate,
        month: billMonth,
        amountCents: chargeCents,
        runningBalanceCents: 0,
        note: '',
        method: '',
        ref: cleanHistoryText(bill.id),
        voided: false,
        ...billConnectionTag,
      });
      if (chargeCents > 0) {
        // Sharafat 12: the bill's own amount is only the base — the
        // engine charges late and shifting fees on top of it, so the
        // history charges them as their own labelled lines on the
        // same date, or the final balance falls short of the dues.
        const lateFeeCents = rupeesToCents(bill.lateFee || 0) ?? 0;
        if (lateFeeCents > 0) {
          entries.push({
            type: 'charge',
            date: billDate,
            month: billMonth,
            amountCents: lateFeeCents,
            runningBalanceCents: 0,
            note: 'Late fee',
            method: '',
            ref: cleanHistoryText(bill.id),
            voided: false,
            ...billConnectionTag,
          });
        }
        const shiftingFeeCents = rupeesToCents(bill.shiftingFee || 0) ?? 0;
        if (shiftingFeeCents > 0) {
          entries.push({
            type: 'charge',
            date: billDate,
            month: billMonth,
            amountCents: shiftingFeeCents,
            runningBalanceCents: 0,
            note: 'Shifting fee',
            method: '',
            ref: cleanHistoryText(bill.id),
            voided: false,
            ...billConnectionTag,
          });
        }
        // Sharafat 12: the seven due-reducing fields as their own
        // adjustment lines, each clamped against what is left of
        // the bill amount (base + late fee + shifting fee) in the
        // engine's order — a fully-concessed month then reads
        // charge +3000, adjustment −3000, net 0, both visible.
        let remainingCents = chargeCents + lateFeeCents + shiftingFeeCents;
        for (const [field, label] of HISTORY_BILL_ADJUSTMENT_FIELDS) {
          const rawCents = rupeesToCents(bill[field] || 0);
          if (rawCents === null || rawCents <= 0) continue;
          const appliedCents = Math.min(rawCents, remainingCents);
          if (appliedCents <= 0) continue;
          remainingCents -= appliedCents;
          entries.push({
            type: 'adjustment',
            date: billDate,
            month: billMonth,
            amountCents: appliedCents,
            runningBalanceCents: 0,
            note: label,
            method: '',
            ref: cleanHistoryText(bill.id),
            voided: false,
            ...billConnectionTag,
          });
        }
      }
    }
    const payments = Array.isArray(bill.payments) ? bill.payments : [];
    for (const payment of payments) {
      if (!payment || typeof payment !== 'object') continue;
      const amountCents = rupeesToCents(payment.amount);
      // Sharafat 12: a zero-amount payment stays visible (PKR 0,
      // delta 0) instead of disappearing; only a figure that is
      // not a number is dropped.
      if (amountCents === null) continue;
      const type = paymentHistoryType(payment);
      // The payment's own recorded connection first; a payment
      // recorded on a bill of one connection belongs to that
      // connection, the same fallback the date and month already use.
      const paymentConnection = cleanHistoryText(payment.connection ?? payment.connectionId ?? bill.connection ?? bill.connectionId);
      const paymentConnectionTag = paymentConnection ? { connection: paymentConnection } : {};
      const isVoided = payment.voided === true;
      entries.push({
        type,
        date: historyEntryDate(payment.date, bill.month),
        month: billMonth,
        amountCents: Math.abs(amountCents),
        runningBalanceCents: 0,
        note: cleanHistoryText(payment.note),
        method: cleanHistoryText(payment.method),
        ref: cleanHistoryText(payment.id),
        voided: isVoided,
        ...paymentConnectionTag,
      });
      // Sharafat 12: the ticket/add-on charge portions of a payment
      // are already inside the payment cash above — charging them
      // again would double-count and break the dues equality — so
      // they appear as INFORMATIONAL zero-movement lines only
      // (type 'info', delta 0), labelled with what they are. A
      // voided payment settles nothing, so it carries no such line.
      if (!isVoided) {
        const ticketCents = historyStampChargeCents(payment.ticketCharges);
        if (ticketCents > 0) {
          entries.push({
            type: 'info',
            date: historyEntryDate(payment.date, bill.month),
            month: billMonth,
            amountCents: ticketCents,
            runningBalanceCents: 0,
            note: 'Ticket charges — included in payment',
            method: '',
            ref: cleanHistoryText(payment.id),
            voided: false,
            ...paymentConnectionTag,
          });
        }
        const addonCents = historyStampChargeCents(payment.addonCharges);
        if (addonCents > 0) {
          entries.push({
            type: 'info',
            date: historyEntryDate(payment.date, bill.month),
            month: billMonth,
            amountCents: addonCents,
            runningBalanceCents: 0,
            note: 'Add-on charges — included in payment',
            method: '',
            ref: cleanHistoryText(payment.id),
            voided: false,
            ...paymentConnectionTag,
          });
        }
      }
    }
  }

  // Sharafat 12: a manual baqaya is a due the owner wrote by hand,
  // not a generated bill — its FULL original amount is a charge on
  // the entry's date. The settlements ride the paying receipts as
  // stamps, so the payment cash above already settles it and no
  // second entry is built for them: baqaya 1500, payment 500 with a
  // baqaya stamp reads +1500 −500 = 1000, the remaining dues.
  for (const baqayaEntry of manualBaqayaEntries) {
    if (!baqayaEntry || typeof baqayaEntry !== 'object') continue;
    const baqayaCents = rupeesToCents(baqayaEntry.amount);
    if (baqayaCents === null || baqayaCents <= 0) continue;
    const baqayaNote = cleanHistoryText(baqayaEntry.note);
    entries.push({
      type: 'charge',
      date: historyEntryDate(baqayaEntry.date, ''),
      month: '',
      amountCents: baqayaCents,
      runningBalanceCents: 0,
      note: baqayaNote ? `Manual baqaya — ${baqayaNote}` : 'Manual baqaya',
      method: '',
      ref: cleanHistoryText(baqayaEntry.id),
      voided: false,
    });
    // Owner adjustments on the entry lower what is left with no
    // payment — each one is its own adjustment line on its own
    // date, or an adjusted baqaya would never reconcile.
    const baqayaAdjustments = Array.isArray(baqayaEntry.adjustments) ? baqayaEntry.adjustments : [];
    for (const adjustment of baqayaAdjustments) {
      if (!adjustment || typeof adjustment !== 'object') continue;
      const adjustmentCents = rupeesToCents(adjustment.amount);
      if (adjustmentCents === null || adjustmentCents <= 0) continue;
      const adjustmentNote = cleanHistoryText(adjustment.note);
      entries.push({
        type: 'adjustment',
        date: historyEntryDate(adjustment.date, ''),
        month: '',
        amountCents: adjustmentCents,
        runningBalanceCents: 0,
        note: adjustmentNote ? `Manual baqaya adjustment — ${adjustmentNote}` : 'Manual baqaya adjustment',
        method: '',
        ref: cleanHistoryText(baqayaEntry.id),
        voided: false,
      });
    }
  }

  for (const credit of creditEntries) {
    if (!credit || typeof credit !== 'object') continue;
    if (cleanHistoryKey(credit.customerId) !== customerId) continue;
    const amountCents = finiteCents(credit.amountCents);
    // Sharafat 12: a credit of any recorded source stays visible
    // with its source named — only a figure that is not a number,
    // or a negative one, is dropped. A zero-amount credit stays
    // visible (PKR 0, delta 0).
    if (amountCents === null || amountCents < 0) continue;
    const source = cleanHistoryKey(credit.source);
    entries.push({
      type: 'credit',
      date: historyEntryDate(credit.date, ''),
      month: '',
      amountCents,
      runningBalanceCents: 0,
      note: cleanHistoryText(credit.note),
      method: '',
      ref: cleanHistoryText(credit.id),
      voided: false,
      source,
    });
  }

  for (const refund of refundRecords) {
    if (!refund || typeof refund !== 'object') continue;
    if (cleanHistoryKey(refund.customerId) !== customerId) continue;
    const amountCents = finiteCents(refund.amountCents);
    if (amountCents === null || amountCents <= 0) continue;
    entries.push({
      type: 'refund',
      date: historyEntryDate(refund.refundDate, ''),
      month: '',
      amountCents,
      runningBalanceCents: 0,
      note: cleanHistoryText(refund.reason),
      method: cleanHistoryText(refund.method),
      ref: cleanHistoryText(refund.id),
      voided: false,
    });
  }

  entries.sort((a, b) => {
    const dateCompare = historySortKey(a) < historySortKey(b) ? -1 : historySortKey(a) > historySortKey(b) ? 1 : 0;
    if (dateCompare !== 0) return dateCompare;
    const typeCompare = HISTORY_TYPE_ORDER[a.type] - HISTORY_TYPE_ORDER[b.type];
    if (typeCompare !== 0) return typeCompare;
    return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });

  let balanceCents = 0;
  for (const entry of entries) {
    balanceCents += historyBalanceDelta(entry);
    entry.runningBalanceCents = balanceCents;
  }
  return entries;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatHistoryAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function fullHistoryRunningNote(balanceCents) {
  const balance = Number(balanceCents);
  if (!Number.isFinite(balance) || balance === 0) return 'Settled';
  if (balance > 0) return `Still owed ${formatHistoryAmount(balance)}`;
  return `Credit ${formatHistoryAmount(-balance)}`;
}

export function fullHistoryEntryLineText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const label = FULL_HISTORY_TYPE_LABELS[entry.type] || 'Payment';
  const date = entry.date ? entry.date : 'date not recorded';
  const amount = formatHistoryAmount(entry.amountCents);
  const note = fullHistoryRunningNote(entry.runningBalanceCents);
  const voided = entry.voided ? ' · VOID' : '';
  // Sharafat 12: a credit names its source, so an unfamiliar one is
  // shown, never silently dropped.
  const source = entry.type === 'credit' && entry.source ? ` · Source: ${entry.source}` : '';
  return `${date} · ${label}${voided} · ${amount}${source} · ${note}`;
}

function escapeHistoryHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fullHistoryListHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const rows = entries.map((entry) => {
    const label = FULL_HISTORY_TYPE_LABELS[entry.type] || 'Payment';
    const date = entry.date ? entry.date : 'date not recorded';
    const amount = formatHistoryAmount(entry.amountCents);
    const note = fullHistoryRunningNote(entry.runningBalanceCents);
    // Sharafat 12: a credit names its source in the meta line, so an
    // unfamiliar source is shown, never silently dropped.
    const source = entry.type === 'credit' && entry.source ? `Source: ${entry.source}` : '';
    const details = [date, entry.method, source, entry.note].filter(Boolean).join(' · ');
    const voided = entry.voided ? ' · VOID' : '';
    return `<li class="payment-row"><span class="payment-main"><span class="payment-amount">${escapeHistoryHtml(label)} · ${escapeHistoryHtml(amount)}${escapeHistoryHtml(voided)}</span><span class="payment-meta">${escapeHistoryHtml(details)} · ${escapeHistoryHtml(note)}</span></span></li>`;
  });
  return `<ul class="payment-list">${rows.join('')}</ul>`;
}

export function fullHistorySummaryText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return FULL_HISTORY_EMPTY_TEXT;
  const last = entries[entries.length - 1];
  const count = entries.length === 1 ? '1 entry' : `${entries.length} entries`;
  return `${count} · ${fullHistoryRunningNote(last.runningBalanceCents)}`;
}
