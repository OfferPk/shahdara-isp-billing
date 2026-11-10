/* Plan 555: the ONE shared money format for receipt surfaces, and the
 * net arrears balance the receipt's "Baqi Rehta" row shows.
 *
 * The problem: four receipt formatters printed the same rupees
 * differently — HTML formatAmount (receipt.js) used toLocaleString()
 * with no locale and no fraction digits, PNG money() (png-receipt.js)
 * the same, split-tender formatAmount and the QC WhatsApp draft used
 * toLocaleString('en-PK') with default fractions, while formatPKR
 * (core.js) uses en-PK min-0/max-2 — so PKR 292.50 printed as
 * "PKR 292.5" on HTML/PNG/WhatsApp and "PKR 292.50" in the profile
 * draft, and a null package price printed as an invented "PKR 0".
 *
 * formatReceiptMoney is formatPKR's formatting (en-PK: whole rupees
 * print bare, fractional rupees keep two digits — 292.5 reads 292.50)
 * with a receipt-appropriate missing figure: null/undefined/empty/
 * non-finite renders as "—", never PKR 0. formatPKR itself is
 * untouched — it still returns 'Not set' for null, which is the
 * profile/draft convention, not a receipt figure.
 *
 * netArrearsBalanceRupees answers the other half of Plan 555: the
 * arrears block's "Baqi Rehta" must agree with the receipt's own
 * Balance Due field. buildArrearsBreakdown's stored balanceDue is
 * gross of every bill-field waiver (by house convention — the stored
 * shape is untouched), while buildPaymentReceipt nets them all into
 * balanceDueCents, so the receipt's own balance is the figure: when
 * balanceDueCents is known it IS the net balance, and the arrears row
 * shows it. When the balance is unknown (balanceDueCents null) the
 * fallback is the breakdown's gross minus all six bill-field waivers
 * — the SISP-30 display netting the thermal slip already did for five
 * of the six (concession, referral, deposit offset, credit transfer,
 * feeder-host credit), now including the polish #23 first-month tag —
 * clamped at 0. When neither figure exists there is no balance to
 * show, and the function returns null instead of a guessed zero.
 */

const RECEIPT_MONEY_WHOLE_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const RECEIPT_MONEY_FRACTION_FORMATTER = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatReceiptMoneyFigure(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  // Exactly formatPKR's rule (core.js): whole rupees print bare
  // (PKR 300), fractional rupees keep two digits (PKR 292.50) — a
  // min-0/max-2 formatter would drop the trailing zero (292.5).
  return (Number.isInteger(num) ? RECEIPT_MONEY_WHOLE_FORMATTER : RECEIPT_MONEY_FRACTION_FORMATTER).format(num);
}

export function formatReceiptMoney(value) {
  const figure = formatReceiptMoneyFigure(value);
  return figure === '—' ? '—' : `PKR ${figure}`;
}

// The six bill-field waivers buildPaymentReceipt nets into
// balanceDueCents (SISP-30 concession, SISP-40 referral credit,
// SISP-50 deposit offset, SISP-111 credit transfer, SISP-97
// feeder-host credit, polish #23 first-month tag).
const WAIVER_FIELDS = [
  'concessionAmount',
  'referralCreditAmount',
  'depositOffsetAmount',
  'creditTransferInAmount',
  'feederHostCreditAmount',
  'firstMonthWaivedAmount',
];

export function netArrearsBalanceRupees(receipt) {
  if (!receipt || typeof receipt !== 'object') return null;
  if (typeof receipt.balanceDueCents === 'number' && Number.isFinite(receipt.balanceDueCents)) {
    return receipt.balanceDueCents / 100;
  }
  const breakdown = receipt.arrearsBreakdown;
  if (!breakdown || typeof breakdown !== 'object') return null;
  const gross = Number(breakdown.balanceDue);
  if (!Number.isFinite(gross)) return null;
  let net = gross;
  for (const field of WAIVER_FIELDS) {
    const waiver = Number(receipt[field]);
    if (Number.isFinite(waiver) && waiver > 0) net -= waiver;
  }
  return Math.max(0, net);
}
