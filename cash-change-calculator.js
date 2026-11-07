// Plan 432 — Quick Collect cash change calculator.
//
// The street reality: a customer hands over a large note and the
// operator works the change out in their head, so change is sometimes
// wrong and the till is short at the end of the day. This module is
// the calculator only: cash received minus the payment amount, shown
// in plain words and figures, live as the cash figure is typed.
//
// What already exists, and what this plan does NOT rebuild: the
// loose-change chips tender a round amount and keep the excess as
// advance credit — they never show change due as cash to hand back.
// The quick amount buttons fill the amount field. The dues default
// fills the amount field with the full dues. None of them computes
// change due, so this module adds only the missing piece: the change
// arithmetic and the line text.
//
// Calculates ONLY. It posts nothing, reserves nothing, and changes no
// bill, payment, or customer record by itself. It keeps no store: the
// figures come from the two fields on the form, and the answer is
// computed fresh on every render. Cash below the amount never shows
// a negative change: the line says plainly how much more is needed.
// The line text carries only the module's own fixed words and figures
// the module itself formatted from parsed numbers, so raw typed text
// never reaches any markup.

// PKR amounts use the app's min-0 decimals: whole rupees print with
// no decimals, a paisa figure prints only the decimals it has.
export function formatCashChangeAmount(cents) {
  const value = Number(cents);
  if (!Number.isFinite(value)) return '';
  return `PKR ${(value / 100).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// A typed figure is usable only as a finite, non-negative number.
// Null, undefined, blank, boolean, and non-numeric input are "not a
// number", never zero — a missing figure must never read as no cash
// or as a free payment (the defensive rule the dues default pins).
export function cashChangeFigureCents(value) {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  const text = String(value).trim().replace(/[,\s]/g, '');
  if (text === '') return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}

// Change due in cents: cash received minus the payment amount. Null
// when either figure is not usable, when there is no payment amount
// to compare against, or when the cash falls short — a shortfall is
// not a negative change, so it is never returned here.
export function cashChangeCents(cashReceived, paymentAmount) {
  const cash = cashChangeFigureCents(cashReceived);
  const amount = cashChangeFigureCents(paymentAmount);
  if (cash === null || amount === null || amount <= 0) return null;
  if (cash < amount) return null;
  return cash - amount;
}

// How much more cash is needed, in cents: the payment amount minus
// the cash received. Null when either figure is not usable, when
// there is no payment amount, or when the cash already covers it.
export function cashChangeShortfallCents(cashReceived, paymentAmount) {
  const cash = cashChangeFigureCents(cashReceived);
  const amount = cashChangeFigureCents(paymentAmount);
  if (cash === null || amount === null || amount <= 0) return null;
  if (cash >= amount) return null;
  return amount - cash;
}

// The line the operator reads, in plain words and figures: the change
// due, the exact-amount confirmation, or how much more cash is
// needed. '' while either figure is missing — the line stays hidden
// until there is something to show.
export function cashChangeLineText(cashReceived, paymentAmount) {
  const cash = cashChangeFigureCents(cashReceived);
  const amount = cashChangeFigureCents(paymentAmount);
  if (cash === null || amount === null || amount <= 0) return '';
  if (cash === amount) return 'Exact amount — no change due';
  if (cash > amount) return `Change due: ${formatCashChangeAmount(cash - amount)}`;
  return `Not enough cash — ${formatCashChangeAmount(amount - cash)} more needed`;
}

// The line as markup, or '' when there is nothing to show. The text
// holds only the module's own fixed words and its own formatted
// figures, never raw typed text.
export function cashChangeLineHtml(cashReceived, paymentAmount) {
  const line = cashChangeLineText(cashReceived, paymentAmount);
  if (line === '') return '';
  return `<p class="chc-change-line">${line}</p>`;
}
