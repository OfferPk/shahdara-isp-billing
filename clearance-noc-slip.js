// SISP-140: Disconnected Customer Final Account & Hardware Clearance
// Slip — the Clearance NOC (بے باق سرٹیفکیٹ). Pure builders only: the
// assessment, the slip snapshot and the print HTML. Nothing here writes
// the ledger; app.js renders the profile section and prints through the
// shared receipt print area, exactly like the SISP-50 clearance receipt.
//
// WHAT THIS IS: when a customer is disconnected (archived — the app's
// disconnect action, SISP-19 mapping) the operator can hand them a
// printed certificate stating the final account is fully cleared: no
// balance pending and every ISP-owned hardware item returned.
//
// HOW IT DIFFERS FROM SISP-50: the SISP-50 clearance receipt is the
// record of a security-deposit SETTLEMENT (it reads the settlement
// stamped on the customer and can never print without one). This NOC is
// a different document: it certifies the ACCOUNT, needs no deposit and
// no settlement, and its eligibility is derived live from the canonical
// allocation engine at render/click time. The two coexist — a settled
// deposit is disclosed on the NOC as a final-account line, never
// re-settled or re-counted by it. Like the SISP-50 statement, this
// certificate is a final-account document, not a payment receipt, so
// the SISP-83 receipt verifier deliberately does not stamp it.
//
// ELIGIBILITY (all three, engine truth only):
//  1. archived === true (not archived -> the action is not offered).
//  2. Zero balance due across every bill, computed by
//     calculatePaymentAllocations exactly as app.js computes profile
//     arrears (per-bill balanceDueCents), PLUS zero pending billed
//     ticket charges (SISP-43 — repair charges live on tickets, not
//     bills, and are a real recorded due in this app, so an honest
//     "no dues" certificate must gate on them too, named separately).
//     Kist remainders gate exactly as far as they are billed into
//     bills (their engine balance); unbilled future installments are
//     not dues and never gate. PLUS zero outstanding manual baqaya
//     (OWNER-LOAN — the owner's hand-written dues on the customer
//     record, a real due the bill engine never sees): the remaining
//     amount derives canonically in core.js
//     (manualBaqayaOutstandingCents — entry amounts minus the
//     settlement stamps of the customer's non-voided receipts, the
//     same figure totalOutstandingFigures adds to bill dues on every
//     other surface), and it gates as its own named blocker.
//  3. Every ISP-owned custody item (SISP-19) has a recorded recovery
//     date. Customer-owned items never block — they are not ISP
//     property and never appear on the certificate.
// LEFTOVER ADVANCE CREDIT never blocks: a cleared account can still
// hold unapplied credit (money the ISP owes the customer). It is
// disclosed on the slip as refundable/adjustable — never silently
// zeroed, never netted against the eligibility figure (targeted
// advances are reserved money under the engine's own rules).
import { calculatePaymentAllocations, formatPKR, manualBaqayaOutstandingCents } from './core.js';
import { advanceBalanceCents } from './advance-payment.js';
import { billedTicketChargesPending } from './complaint-tickets.js';
import {
  custodyItems,
  depositSettlementOf,
  isDisconnected,
  normalizeCustodyFields,
  pendingRecoveryItems
} from './hardware-custody.js';
import { bilingualCustomerName } from './urdu-names.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { t } from './nav-language.js';

const nocCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const nocRupees = (centsValue) => Math.round(centsValue) / 100;

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Today in Pakistan time as YYYY-MM-DD (en-CA formats ISO-style).
function pakistanToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// The money figures behind the assessment, all from the canonical
// engine for this customer alone (the engine is per-customer: bills and
// payments live on the record, so a scoped run equals the full-state
// figures app.js reads). Voided payments never count as received
// (SISP-34). Ticket charges are read from the caller's ticket list via
// the SISP-43 helper — this module never loads storage itself.
export function clearanceNocFigures(customer = {}, tickets = []) {
  const source = customer && typeof customer === 'object' ? customer : {};
  const allocations = calculatePaymentAllocations({ customers: [source] });
  let outstandingCents = 0;
  let totalBilledCents = 0;
  let totalReceivedCents = 0;
  let billCount = 0;
  let lastBillMonth = null;
  for (const bill of Array.isArray(source.bills) ? source.bills : []) {
    if (!bill) continue;
    const summary = allocations.forMonth(source.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      outstandingCents += summary.balanceDueCents;
    }
    const due = bill.dueAmount;
    if (due !== null && due !== undefined && due !== '' && Number.isFinite(Number(due))) {
      billCount += 1;
      totalBilledCents += nocCents(due);
      if (typeof bill.month === 'string' && (lastBillMonth === null || bill.month > lastBillMonth)) {
        lastBillMonth = bill.month;
      }
    }
    for (const payment of Array.isArray(bill.payments) ? bill.payments : []) {
      if (!isVoidedPayment(payment)) totalReceivedCents += nocCents(payment?.amount);
    }
  }
  const creditCents = advanceBalanceCents({ customers: [source] }, source.id, allocations);
  const ticketChargesCents = nocCents(billedTicketChargesPending(tickets, source.id));
  return {
    outstanding: nocRupees(outstandingCents),
    creditBalance: nocRupees(creditCents),
    manualBaqayaOutstanding: nocRupees(manualBaqayaOutstandingCents(source)),
    ticketChargesPending: nocRupees(ticketChargesCents),
    totalBilled: nocRupees(totalBilledCents),
    totalReceived: nocRupees(totalReceivedCents),
    billCount,
    lastBillMonth
  };
}

// The eligibility verdict. `visible` is the profile-section rule (only
// disconnected customers are offered the action at all). Blockers are
// structured and language-free — the presentation layer words them.
export function assessClearanceNoc(customer = {}, { tickets = [] } = {}) {
  const source = customer && typeof customer === 'object' ? customer : {};
  const figures = clearanceNocFigures(source, tickets);
  const visible = isDisconnected(source);
  const pendingItems = pendingRecoveryItems(source).map((item) => ({ key: item.key, label: item.label }));
  const returnedItems = custodyItems(source)
    .filter((item) => item.ownership === 'isp-owned' && item.recoveredAt !== null)
    .map((item) => ({ key: item.key, label: item.label, recoveredAt: item.recoveredAt }));
  const ispOwnedItems = custodyItems(source).filter((item) => item.ownership === 'isp-owned');
  const blockers = [];
  if (figures.outstanding > 0) blockers.push({ kind: 'balance', amount: figures.outstanding });
  if (figures.manualBaqayaOutstanding > 0) blockers.push({ kind: 'baqaya', amount: figures.manualBaqayaOutstanding });
  if (figures.ticketChargesPending > 0) blockers.push({ kind: 'ticket-charges', amount: figures.ticketChargesPending });
  if (pendingItems.length > 0) blockers.push({ kind: 'hardware', items: pendingItems });
  const depositSettlement = depositSettlementOf(source);
  const custody = normalizeCustodyFields(source);
  return {
    visible,
    eligible: visible && blockers.length === 0,
    blockers,
    figures,
    pendingItems,
    returnedItems,
    noIspHardware: ispOwnedItems.length === 0,
    depositHeld: depositSettlement === null && (custody.securityDeposit ?? 0) > 0 ? custody.securityDeposit : 0,
    depositSettlement: depositSettlement
      ? { settledAt: depositSettlement.settledAt, refundAmount: depositSettlement.refundAmount }
      : null
  };
}

// Profile-section wording for the assessment (current app language via
// t()). Amounts render through core's formatPKR, the same formatter the
// other profile sections use.
export function clearanceNocPresentation(customer = {}, { tickets = [] } = {}) {
  const assessment = assessClearanceNoc(customer, { tickets });
  if (!assessment.visible) return { visible: false, eligible: false, blockerLabels: [] };
  const blockerLabels = assessment.blockers.map((blocker) => {
    if (blocker.kind === 'balance') return t('noc_block_balance', null, { amount: formatPKR(blocker.amount) });
    if (blocker.kind === 'baqaya') return t('noc_block_baqaya', null, { amount: formatPKR(blocker.amount) });
    if (blocker.kind === 'ticket-charges') return t('noc_block_tickets', null, { amount: formatPKR(blocker.amount) });
    return t('noc_block_hardware', null, { items: blocker.items.map((item) => item.label).join(', ') });
  });
  return {
    visible: true,
    eligible: assessment.eligible,
    headingLabel: t('noc_heading'),
    ariaLabel: t('noc_aria'),
    readyLabel: assessment.eligible ? t('noc_ready') : '',
    blockerLabels,
    creditLabel: assessment.figures.creditBalance > 0
      ? t('noc_credit_note', null, { amount: formatPKR(assessment.figures.creditBalance) })
      : '',
    printLabel: t('noc_print_btn')
  };
}

// The certificate snapshot. Null unless the customer is eligible RIGHT
// NOW — app.js rebuilds it at click time, so a stale profile render can
// never print a clearance the ledger no longer supports. Read-only: it
// reads the record and the engine, and stamps nothing.
export function buildClearanceNocSlip(customer = {}, { tickets = [], issueDate = '' } = {}) {
  const source = customer && typeof customer === 'object' ? customer : {};
  const assessment = assessClearanceNoc(source, { tickets });
  if (!assessment.eligible) return null;
  const archivedDate = typeof source.archivedAt === 'string' ? source.archivedAt.slice(0, 10) : '';
  return {
    customerName: bilingualCustomerName(source),
    customerNumber: Number.isSafeInteger(source.customerNumber) && source.customerNumber > 0 ? String(source.customerNumber) : '',
    mohalla: typeof source.mohalla === 'string' ? source.mohalla : '',
    connectionDate: isValidDateString(source.connectionDate) ? source.connectionDate : null,
    disconnectedDate: isValidDateString(archivedDate) ? archivedDate : null,
    issueDate: isValidDateString(issueDate) ? issueDate : pakistanToday(),
    billCount: assessment.figures.billCount,
    lastBillMonth: assessment.figures.lastBillMonth,
    totalBilled: assessment.figures.totalBilled,
    totalReceived: assessment.figures.totalReceived,
    balanceDue: 0,
    creditBalance: assessment.figures.creditBalance,
    depositHeld: assessment.depositHeld,
    depositSettlement: assessment.depositSettlement,
    returnedItems: assessment.returnedItems,
    noIspHardware: assessment.noIspHardware,
    status: 'CLEARED'
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// A certificate field label in both languages, from the dictionary —
// the printed document is bilingual by design (the SISP-50 receipt
// pattern), so every label renders en + ur regardless of UI language.
const biLabel = (key, params = {}) => `${t(key, 'en', params)} / ${t(key, 'ur', params)}`;

// Printable clearance certificate. Single A4-style layout reusing the
// standard receipt classes (the SISP-50 pattern), so the existing print
// CSS applies. Paper styling is deliberate, not an app UI surface.
export function generateClearanceNocSlipHtml(slip, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567'
} = {}) {
  if (!slip) return '';
  const formatAmount = (val) => {
    if (val === null || val === undefined || val === '') return 'PKR 0';
    const num = Number(val);
    return `PKR ${num.toLocaleString()}`;
  };
  const notRecorded = biLabel('noc_not_recorded');
  const hardwareRows = slip.noIspHardware
    ? `<div class="receipt-field"><dt>${escapeHtml(biLabel('noc_hardware_heading'))}:</dt><dd>${escapeHtml(biLabel('noc_no_hardware'))}</dd></div>`
    : slip.returnedItems.map((item) => `<div class="receipt-field"><dt>${escapeHtml(item.label)}:</dt><dd>✅ ${escapeHtml(biLabel('noc_returned_on', { date: item.recoveredAt }))}</dd></div>`).join('');
  return `<article class="receipt-sheet a4-receipt" data-receipt-format="clearance-noc">
  <header class="receipt-head">
    <div>
      <span class="receipt-brand">${escapeHtml(businessName)}</span>
      <h1>${escapeHtml(biLabel('noc_title'))}</h1>
      <p>Phone: ${escapeHtml(businessPhone)}</p>
    </div>
    <span class="receipt-mark receipt-status-paid">${escapeHtml(biLabel('noc_status_cleared'))}</span>
  </header>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_customer'))}:</dt><dd>${escapeHtml(slip.customerName)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_connection_no'))}:</dt><dd>#${escapeHtml(slip.customerNumber)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_mohalla'))}:</dt><dd>${escapeHtml(slip.mohalla || notRecorded)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_connected_on'))}:</dt><dd>${escapeHtml(slip.connectionDate || notRecorded)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_disconnected_on'))}:</dt><dd>${escapeHtml(slip.disconnectedDate || notRecorded)}</dd></div>
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt><strong>${escapeHtml(biLabel('noc_account_heading'))}</strong></dt><dd></dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_bills_issued'))}:</dt><dd>${slip.billCount}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_last_bill'))}:</dt><dd>${escapeHtml(slip.lastBillMonth || notRecorded)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_total_billed'))}:</dt><dd>${formatAmount(slip.totalBilled)}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_total_paid'))}:</dt><dd>${formatAmount(slip.totalReceived)}</dd></div>
    <div class="receipt-field receipt-paid-field"><dt><strong>${escapeHtml(biLabel('noc_balance_due'))}:</strong></dt><dd><strong>${formatAmount(slip.balanceDue)}</strong></dd></div>
    ${slip.creditBalance > 0 ? `<div class="receipt-field"><dt>${escapeHtml(biLabel('noc_credit_held'))}:</dt><dd>${formatAmount(slip.creditBalance)}</dd></div>` : ''}
    ${slip.depositHeld > 0 ? `<div class="receipt-field"><dt>${escapeHtml(biLabel('noc_deposit_held'))}:</dt><dd>${formatAmount(slip.depositHeld)}</dd></div>` : ''}
    ${slip.depositSettlement ? `<div class="receipt-field"><dt>${escapeHtml(biLabel('noc_deposit_settled'))}:</dt><dd>${escapeHtml(slip.depositSettlement.settledAt)} · ${formatAmount(slip.depositSettlement.refundAmount)}</dd></div>` : ''}
    <div class="receipt-divider">--------------------------------</div>
    <div class="receipt-field"><dt><strong>${escapeHtml(biLabel('noc_hardware_heading'))}</strong></dt><dd></dd></div>
    ${hardwareRows}
    <div class="receipt-field"><dt>${escapeHtml(biLabel('noc_issue_date'))}:</dt><dd>${escapeHtml(slip.issueDate)}</dd></div>
  </dl>
  <div class="receipt-divider">================================</div>
  <p>${escapeHtml(t('noc_declaration', 'en'))}</p>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">${escapeHtml(t('noc_declaration', 'ur'))}</div>
  <footer class="receipt-terms">
    <div class="receipt-signatures">
      <div class="receipt-sig-box"><span>${escapeHtml(biLabel('noc_sign_business', { business: businessName }))}</span></div>
      <div class="receipt-sig-box"><span>${escapeHtml(biLabel('noc_sign_customer'))}</span></div>
    </div>
    <p class="receipt-footer-text">* ${escapeHtml(businessName)} *</p>
  </footer>
</article>`;
}
