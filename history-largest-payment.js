// Plan 412 — History largest payment highlight.
// In a long history the customer's biggest single payment is buried
// among the smaller ones, so the operator cannot quickly answer
// "what is the most I ever paid at once?" This module supplies the
// missing piece: one highlight on the customer history — the single
// largest payment, with its date and method, shown at the top of the
// history. It highlights only and it changes nothing: it reads the
// entries the full history list already composes and writes to no
// store, so no bill, payment, or customer record is ever changed by
// the highlight itself. A voided payment never counts, because money
// that was voided was never paid; a charge, a credit, a refund, or
// an adjustment is not a payment either. An advance counts, because
// an advance is money the customer paid in advance. When two
// payments tie for the largest amount, the earliest dated one is
// highlighted, so the same history always highlights the same
// payment. Amounts print with no decimals for whole rupees
// (PKR 3,000) and one decimal for a paisa remainder (PKR 1,500.5),
// the same shape the history amounts already use.

// A payment that stands: a payment or an advance that was not
// voided, with a positive amount. Anything else is not a payment
// that was made, so it can never be the largest payment.
export function historyLargestPaymentIsPayment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.type !== 'payment' && entry.type !== 'advance') return false;
  if (entry.voided === true) return false;
  if (typeof entry.amountCents !== 'number') return false;
  return Number.isFinite(entry.amountCents) && entry.amountCents > 0;
}

function largestPaymentSortKey(entry) {
  if (!entry || typeof entry.date !== 'string' || entry.date === '') return '9999-99-99';
  if (entry.date.length === 7) return `${entry.date}-01`;
  return entry.date;
}

// The single largest payment in the entries, or null when the
// history holds no payment that stands. The entries are never
// mutated, and the returned entry is the entry itself, so the
// highlight always agrees with the list it sits above.
export function historyLargestPayment(entries) {
  if (!Array.isArray(entries)) return null;
  let largest = null;
  for (const entry of entries) {
    if (!historyLargestPaymentIsPayment(entry)) continue;
    if (largest === null) {
      largest = entry;
      continue;
    }
    if (entry.amountCents > largest.amountCents) {
      largest = entry;
      continue;
    }
    if (entry.amountCents !== largest.amountCents) continue;
    const dateCompare = largestPaymentSortKey(entry) < largestPaymentSortKey(largest) ? -1
      : largestPaymentSortKey(entry) > largestPaymentSortKey(largest) ? 1 : 0;
    if (dateCompare < 0) {
      largest = entry;
      continue;
    }
    if (dateCompare !== 0) continue;
    const ref = String(entry.ref ?? '');
    const largestRef = String(largest.ref ?? '');
    if (ref !== '' && (largestRef === '' || ref < largestRef)) largest = entry;
  }
  return largest;
}

// Amounts print with no decimals for whole rupees (PKR 3,000) and
// one decimal for a paisa remainder (PKR 1,500.5). A value that is
// not a number is never treated as zero; it prints as PKR 0.
export function formatLargestPaymentAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function cleanLargestPaymentText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// One line for the highlight: the amount, the date, and the method
// the payment was made with. An undated payment says so plainly,
// and a payment with no method recorded says so too. Empty when
// there is no largest payment to highlight.
export function historyLargestPaymentText(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const amount = formatLargestPaymentAmount(entry.amountCents);
  const date = cleanLargestPaymentText(entry.date) || 'date not recorded';
  const method = cleanLargestPaymentText(entry.method) || 'method not recorded';
  return `Largest payment · ${amount} · ${date} · ${method}`;
}

function escapeLargestPaymentHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The highlight itself, for the top of the history. Empty when the
// history holds no payment that stands, so a customer who has never
// paid gets no highlight instead of a misleading one. The method is
// user-entered text, so it is escaped before it reaches the page.
export function historyLargestPaymentHtml(entries) {
  const largest = historyLargestPayment(entries);
  if (!largest) return '';
  return `<p class="notice">${escapeLargestPaymentHtml(historyLargestPaymentText(largest))}</p>`;
}
