// Plan 370 — Customer profile dues breakdown by month.
//
// The profile shows one total dues figure, so a customer who asks
// "which months do I owe for?" gets no answer without opening each
// bill separately. This module adds only the missing piece: one
// read-only breakdown on the profile — per month, billed, paid, and
// still owed — composed from the bills and payments already on the
// profile. It is a view only: it merges no records and never changes
// any bill, payment, or customer record by itself.
//
// The breakdown is composed from the same allocation figures the
// profile already uses, supplied by the caller, and invents nothing:
//   - billed is the month's bill amount (base plus late and shifting
//     fees) from the allocation summary for that month;
//   - still owed is that summary's remaining balance, floored at
//     zero, so the per-month still-owed figures sum exactly to the
//     profile's bill dues on the same fixture;
//   - paid is billed minus still owed: the amount of the bill already
//     covered (receipts, advance credit, discounts and owner offsets
//     the allocation engine applied), so billed minus paid equals
//     still owed exactly on every priced row. The engine never leaves
//     a remaining balance above the bill amount, so paid is never
//     negative on a real summary.
// A month whose bill has no priced amount yet is shown as not priced,
// never as a due and never as settled. A month fully paid shows as
// settled. The profile's total dues are the still-owed figures plus
// the manual additional amount the caller supplies (zero when there
// is none); the additional amount is shown as its own line, never
// folded into a month, so the total still reconciles exactly.
//
// The module is pure and import-free: the caller supplies the
// customer record, the allocation result, and the additional amount,
// and the module never reads storage, the clock, or the network,
// never imports another module, and never mutates an input. It holds
// no store of its own. Money is integer cents throughout, PKR only,
// never converted. Months are strict YYYY-MM keys, oldest first;
// a bill with no usable month cannot be placed in a monthly view and
// is left out, never guessed. Two records for the same month merge
// into one row, so a month is never counted twice.
//
// This view is distinct from the neighbours it sits beside:
//   - the at-a-glance strip shows the same total as one figure; this
//     view breaks that figure down by month and never re-computes it
//     from a second, competing calculation;
//   - the balance reply draft is a message the operator sends, not a
//     profile view;
//   - the multi-connection combined dues view breaks dues down by
//     connection, not by month;
//   - the shop-wide aging dashboard buckets every customer's dues by
//     days overdue; this view is one customer's months, in order;
//   - the monthly KPI sheet records shop-wide figures for one month;
//     this view records nothing and shows one customer's months;
//   - the revenue stream partition splits one month's collections
//     across the shop; this view splits one customer's dues across
//     months.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const defaultFormatAmount = (value) => `PKR ${String(value ?? '')}`;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function fromCents(cents) {
  return cents / 100;
}

function validMonthKey(value) {
  const raw = text(value);
  if (!raw) return null;
  return MONTH_RE.test(raw) ? raw : null;
}

function cleanCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

// One dues breakdown for a customer, from the caller's allocation
// result and additional amount. Rows are oldest month first; each
// row carries billed, paid and still owed in integer cents (plus
// the same figures in PKR), a priced flag, and a settled flag.
// totalStillOwedCents is the sum of the rows' still-owed figures;
// profileTotalCents adds the manual additional amount, which is
// the profile's total dues on the same fixture. One row per month:
// the allocation result holds one summary per month, so two records
// for the same month still produce one row from that summary, and
// a month is never counted twice.
export function duesBreakdownByMonth(customer, allocations, manualBaqayaCents = 0) {
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  const months = [...new Set(bills.map((bill) => validMonthKey(bill?.month)).filter((month) => month !== null))].sort();
  const rows = months.map((month) => {
    const summary = allocations && typeof allocations.forMonth === 'function'
      ? allocations.forMonth(customer?.id, month)
      : null;
    const billedCents = summary && typeof summary.billAmountCents === 'number'
      ? Math.max(0, Math.round(summary.billAmountCents))
      : null;
    if (billedCents === null) {
      return { month, billedCents: null, paidCents: null, stillOwedCents: 0, billed: null, paid: null, stillOwed: 0, priced: false, settled: false };
    }
    const stillOwedCents = summary && typeof summary.balanceDueCents === 'number'
      ? Math.max(0, Math.round(summary.balanceDueCents))
      : 0;
    const paidCents = billedCents - stillOwedCents;
    return {
      month,
      billedCents,
      paidCents,
      stillOwedCents,
      billed: fromCents(billedCents),
      paid: fromCents(paidCents),
      stillOwed: fromCents(stillOwedCents),
      priced: true,
      settled: stillOwedCents === 0,
    };
  });
  const totalStillOwedCents = rows.reduce((sum, row) => sum + row.stillOwedCents, 0);
  const manualCents = cleanCents(manualBaqayaCents);
  return {
    customerId: text(customer?.id),
    rows,
    hasRows: rows.length > 0,
    allSettled: rows.length > 0 && rows.every((row) => row.settled),
    totalStillOwedCents,
    totalStillOwed: fromCents(totalStillOwedCents),
    manualBaqayaCents: manualCents,
    manualBaqaya: fromCents(manualCents),
    profileTotalCents: totalStillOwedCents + manualCents,
    profileTotal: fromCents(totalStillOwedCents + manualCents),
  };
}

// The profile section for the breakdown: one row per month with
// billed, paid and still owed, a settled badge on a month fully
// paid, a not-priced line on a month with no priced bill, the manual
// additional amount as its own line when there is one, and the total
// still owed. A customer with no bills reads the none line instead
// of a blank. Read-only: no form, no button, no binding.
export function duesBreakdownSectionHtml(customer, allocations, manualBaqayaCents = 0, texts = {}, formatAmount = defaultFormatAmount) {
  const format = typeof formatAmount === 'function' ? formatAmount : defaultFormatAmount;
  const breakdown = duesBreakdownByMonth(customer, allocations, manualBaqayaCents);
  const label = (key, fallback) => {
    const value = text(texts?.[key]);
    return value || fallback;
  };
  const heading = label('heading', 'Dues by month');
  const intro = label('intro', 'What is owed for each month, from the bills and payments already on this profile.');
  const rows = breakdown.rows.map((row) => {
    if (!row.priced) {
      return `<li><span class="dmb-month">${escapeHtml(row.month)}</span> <span class="dmb-not-priced">${escapeHtml(label('notPriced', 'Bill not priced yet'))}</span></li>`;
    }
    const settled = row.settled ? ` <span class="dmb-settled">${escapeHtml(label('settled', 'Settled'))}</span>` : '';
    return `<li><span class="dmb-month">${escapeHtml(row.month)}</span> <span class="dmb-billed">${escapeHtml(label('billed', 'Billed'))} ${escapeHtml(format(row.billed))}</span> <span class="dmb-paid">${escapeHtml(label('paid', 'Paid'))} ${escapeHtml(format(row.paid))}</span> <span class="dmb-owed">${escapeHtml(label('stillOwed', 'Still owed'))} ${escapeHtml(format(row.stillOwed))}</span>${settled}</li>`;
  }).join('');
  const list = rows
    ? `<ul id="dmbList" class="dmb-list">${rows}</ul>`
    : `<p class="dmb-none">${escapeHtml(label('none', 'No bills recorded yet.'))}</p>`;
  const additional = breakdown.manualBaqayaCents > 0
    ? `<p class="dmb-additional">${escapeHtml(label('additional', 'Additional amount'))} ${escapeHtml(format(breakdown.manualBaqaya))}</p>`
    : '';
  const total = `<p class="dmb-total">${escapeHtml(label('total', 'Total still owed'))} ${escapeHtml(format(breakdown.profileTotal))}</p>`;
  return `<section class="profile-dues-breakdown" aria-label="${escapeHtml(heading)}"><h4>${escapeHtml(heading)}</h4><p>${escapeHtml(intro)}</p>${list}${additional}${total}</section>`;
}
