/**
 * owner-khata.js — SISP-20
 * Monthly Owner Khata Closing Report (Income + Expenses + Outages Archive).
 *
 * One permanent monthly archive view combining financials and network
 * reliability for any selected YYYY-MM month. Every figure is REUSED from
 * an existing computation — nothing is recomputed in a parallel path:
 *
 * - Total Bills Collected, Expenses, Net Profit, Partner Shares:
 *   buildPartnerShareReport (phase3.js). Revenue is actual saved receipts
 *   grouped by payment date; share = 50% of positive monthly profit, else 0
 *   (PARTNER_SHARE_RATE = 0.5, one share each for Nasir and Aqib).
 * - Pending Arrears: outstandingAtMonthEnd (phase3.js) — FIFO from the FULL
 *   bill list, payments counted only through the month-end cutoff.
 * - Shop Cash Settled: SISP-1 settlement records (shop-settlement.js),
 *   summed by settlement date within the month.
 * - Complaints + Offline Hours: buildMonthlyDowntimeAnalytics
 *   (downtime-analytics.js) over the SISP-15 complaint register.
 * - Saved monthly closing snapshot (core.js saveMonthlyClosing): shown when
 *   one exists for the month; the report never creates or alters it.
 *
 * The report is READ-ONLY: buildOwnerKhataReport is a pure function of
 * (state, month, inputs). Same inputs always yield the same numbers, and
 * building a report never writes bills, payments, expenses, customers, or
 * snapshots. The only write in this feature is the owner's explicit Save
 * Note action, which stores plain text under
 * monthly-closing-notes.js — never ledger data.
 *
 * "NayaPay Bandwidth + Field Expenses" is a keyword-matched subtotal over
 * the partner report's own category breakdown (category names containing
 * nayapay, bandwidth, upstream, or field, case-insensitive). It is labeled
 * as such wherever shown; no category list is hardcoded into the totals.
 * The full category breakdown is always shown alongside it, so nothing is
 * hidden behind the keyword match.
 *
 * SISP-51 (Closing 2.0) extends the same report — SISP-20 records and
 * snapshots are untouched — with two additions, both reused, never
 * recomputed in a parallel path:
 *
 * - Collection channel split (collectionChannels): every payment in the
 *   partner report's own enumeration (phase3.js paymentEntries — the
 *   same set whose amounts sum to `collected`) is classified into
 *   exactly one channel: a shop channel when SISP-1's
 *   resolveShopCollector recognises the method/paidBy (Waseem Abbasi
 *   Shop, Hassan Balla Shop, or any data-derived "Cash at X shop"
 *   collector), a wallet channel for SISP-21 digital wallet methods
 *   (canonical labels from wallet-reconciliation.js), and Direct Cash
 *   for everything else (plain Cash and any legacy/custom method), so
 *   the split always sums to the collected total. The partner basis
 *   counts receipts by payment date with no void exclusion, so the
 *   split follows the same basis to stay consistent with `collected`.
 * - Closing cash-in-hand (closingCashInHand): the month-end cash
 *   drawer balance from SISP-11's roznamcha — buildMonthEndCashInHand
 *   (roznamcha.js) over the day records passed in as
 *   inputs.roznamchaDays, anchored on the latest closed day with the
 *   still-open days rolled forward.
 *
 * SISP-196 (Closing 2.0, cont.) adds one more read-only block:
 *
 * - Non-cash adjustments (nonCashAdjustments): an itemization of the
 *   month's NON-CASH bill reductions — the audited waiver stamps the
 *   billing cycle leaves on the bills themselves, attributed by
 *   bill.month === report month (the bill-month rule the billing
 *   register uses; revenue above keeps its payment-date basis):
 *   concessionAmount (SISP-30), referralCreditAmount (SISP-40) and
 *   depositOffsetAmount (SISP-50), plus feederHostCreditAmount
 *   (SISP-97) as its own clearly separate fourth total — the FU1b
 *   allocation engine subtracts all four identically, so omitting the
 *   fourth would under-explain billed vs collected; it is never
 *   folded into the three named totals. Stamps are read with the
 *   engine's coercion (core.js moneyCents reads Number(value || 0);
 *   qa-khata-doctor.js mirrors it): absent, non-finite or negative
 *   junk counts as 0 — the app writers only ever stamp validated
 *   non-negative amounts clamped to the bill. The totals are the
 *   stamped amounts, not the engine's due-capped application; on real
 *   ledgers the two agree. The block never feeds collected, profit or
 *   shares — it only explains why billed ≠ collected.
 *
 * SISP-176 adds the SISP-43 ticket-charge split of the month's
 * collections, derived live like everything else here:
 *
 * - ticketChargesCollected / billCollections: every payment in the
 *   partner report's own enumeration (phase3.js paymentEntries, by
 *   payment date) is split by core's paymentTicketChargeCents into its
 *   ticket portion and its bill portion. The split SPLITS, never adds:
 *   billCollections + ticketChargesCollected always equals the month's
 *   non-voided collections. VOIDED payments are excluded from BOTH
 *   lines (SISP-34: a voided receipt settles nothing — its ticket stamp
 *   settles nothing either). The partner basis behind `collected`
 *   itself still counts voided receipts in this build (the FU4 fix owns
 *   that change); the moment it lands, the split total equals
 *   `collected` exactly. Until then the split total equals `collected`
 *   minus the month's voided amounts — the voided cash is in neither
 *   split line.
 * - ticketChargesPending: billed ticket charges still unpaid at MONTH
 *   END, rebuilt from the ticket records passed in as inputs.tickets
 *   (SISP-12 store, sanitized here): a ticket counts when it was
 *   Resolved-billed on or before month end and was not yet paid by
 *   month end (chargePaidAt after the month, or still unpaid). It is a
 *   receivable, shown beside Pending Arrears — never inside collected.
 *   Tickets carrying no usable dates can only be judged by their
 *   current flags, the same live-derivation limit the rest of this
 *   report accepts.
 *
 * SISP-73 extends the same report once more, again reused, never
 * recomputed in a parallel path:
 *
 * - Installation CapEx (installation* fields + distributableProfit):
 *   the month's net installation surplus/subsidy from SISP-23's
 *   installation-cost accounting (buildMonthlyInstallationSummary in
 *   installation-cost.js). When the owner's persisted toggle
 *   (inputs.includeInstallationCapexInSplit — the modal passes the
 *   SISP-22 partner-settings value) is ON, the month's net subsidy is
 *   deducted from the profit before the 50/50 split, exactly as in
 *   Partner Settlement, so both surfaces always agree: share = 50% of
 *   the positive distributable profit, else 0 (the PR #395 rule). When
 *   OFF, the installation figures are shown tracked separately and the
 *   shares are the partner report's own, untouched.
 *
 * SISP-114 extends it once more: when inputs.charityReservePct > 0
 * (the owner's optional charity / sadqah & emergency reserve setting,
 * charity-reserve.js), round(distributableProfit * pct / 100) is set
 * aside BEFORE the 50/50 split — the base is the SISP-73 distributable
 * profit above, i.e. profit minus the installation subsidy when the
 * CapEx toggle is ON — so nasirShare / aqibShare become 50% of the
 * remainder and the report gains charityReservePct / charityReserve,
 * its distributableProfit reading as the post-reserve remainder. At
 * 0% or when the input is absent, the report is byte-identical to the
 * SISP-73 shape — no new keys, same shares.
 */

import { buildPartnerShareReport, outstandingAtMonthEnd, paymentEntries, PARTNER_SHARE_RATE } from './phase3.js';
import { buildMonthlyInstallationSummary } from './installation-cost.js';
import { loadPartnerSettings } from './partner-settlement.js';
import { buildMonthlyDowntimeAnalytics } from './downtime-analytics.js';
import { loadComplaints, pakistanMonthNow } from './complaint-register.js';
import { canonicalShopName, loadShopSettlements, resolveShopCollector } from './shop-settlement.js';
import {
  DIGITAL_BREAKDOWN_METHODS,
  canonicalWalletLabel,
  isDigitalWalletMethod
} from './wallet-reconciliation.js';
import { buildMonthEndCashInHand, loadRoznamchaDays } from './roznamcha.js';
import { paymentTicketChargeCents } from './core.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { loadTickets, sanitizeTickets } from './complaint-tickets.js';
import { buildShopScorecard, renderShopScorecardHtml } from './shop-performance-analytics.js';
import { computeCharityReserve, loadCharityReserveSettings, sanitizeCharityReservePct } from './charity-reserve.js';
import { t } from './nav-language.js';
import {
  getMonthlyClosingNote,
  loadMonthlyClosingNotes,
  saveMonthlyClosingNotes,
  setMonthlyClosingNote
} from './monthly-closing-notes.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const BANDWIDTH_FIELD_RE = /nayapay|bandwidth|upstream|field/i;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** SISP-51: channel label for money the owner collected directly. */
export const DIRECT_CASH_CHANNEL = 'Direct Cash';

/** Same month basis as phase3.js revenue: the payment DATE's YYYY-MM. */
function monthOfPaymentDate(value) {
  return typeof value === 'string' && DATE_KEY_RE.test(value) ? value.slice(0, 7) : '';
}

/**
 * SISP-51: the one collection channel a payment belongs to. Shop first
 * (SISP-1's resolver reads method + paidBy, so "Cash at Waseem shop" and
 * a plain-Cash receipt paid by Hassan both land at their shop), then
 * SISP-21 digital wallets, then Direct Cash for plain Cash and any
 * legacy/custom method — every payment lands somewhere, so the split
 * always sums to the partner report's collected total.
 */
export function classifyPaymentChannel(payment) {
  const shop = resolveShopCollector(payment?.method, payment?.paidBy);
  if (shop) return { channel: shop, kind: 'shop' };
  if (isDigitalWalletMethod(payment?.method)) {
    return { channel: canonicalWalletLabel(payment?.method), kind: 'wallet' };
  }
  return { channel: DIRECT_CASH_CHANNEL, kind: 'cash' };
}

/**
 * SISP-51: the month's collections split by channel, over the partner
 * report's own payment enumeration. Order: Direct Cash, shops by amount
 * (highest first), then wallets in SISP-21 breakdown order.
 */
function buildCollectionChannels(state, month) {
  const byKey = new Map();
  for (const { payment } of paymentEntries(state)) {
    if (!payment || typeof payment !== 'object') continue;
    if (monthOfPaymentDate(payment.date) !== month) continue;
    const { channel, kind } = classifyPaymentChannel(payment);
    const key = `${kind}:${channel}`;
    const entry = byKey.get(key) ?? { channel, kind, amount: 0, count: 0 };
    entry.amount += Number(payment.amount || 0);
    entry.count += 1;
    byKey.set(key, entry);
  }
  const lines = [...byKey.values()];
  const cash = lines.filter((line) => line.kind === 'cash');
  const shops = lines
    .filter((line) => line.kind === 'shop')
    .sort((a, b) => b.amount - a.amount || a.channel.localeCompare(b.channel));
  const wallets = DIGITAL_BREAKDOWN_METHODS
    .map((label) => byKey.get(`wallet:${label}`))
    .filter(Boolean);
  const ordered = [...cash, ...shops, ...wallets];
  // Defensive: a future channel kind must never be silently dropped.
  for (const line of lines) if (!ordered.includes(line)) ordered.push(line);
  return ordered.map((line) => ({
    channel: line.channel,
    kind: line.kind,
    amount: wholeRupees(line.amount),
    count: line.count
  }));
}

/**
 * SISP-196: one bill waiver stamp read the way the allocation engine
 * reads it — core.js moneyCents coerces with Number(value || 0) (the
 * Khata Doctor's cents() mirrors it). Absent, non-numeric and
 * non-finite stamps read as 0, and a negative stamp counts as 0 too:
 * the writers (applyConcessionToBill, the cycle's referral stamping,
 * applyDepositSettlement, the feeder-host stamping) only ever record
 * validated non-negative amounts, so a negative is junk, never a
 * negative "reduction".
 */
function stampAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * SISP-196: the month's non-cash bill reductions, summed from the
 * audited stamps on the bills whose bill.month IS the report month —
 * never recomputed from payments or settings. Whole rupees, like
 * every other figure on this report's surface. All customers count
 * (the arrears and revenue computations above do not filter by
 * archive status either); the block is always present, zeroed when
 * the month carries no stamps, so consumers get a stable shape.
 */
function buildNonCashAdjustments(state, month) {
  let concessions = 0;
  let referralCredits = 0;
  let depositOffsets = 0;
  let feederHostCredits = 0;
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  for (const customer of customers) {
    const bills = Array.isArray(customer?.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (!bill || bill.month !== month) continue;
      concessions += stampAmount(bill.concessionAmount);
      referralCredits += stampAmount(bill.referralCreditAmount);
      depositOffsets += stampAmount(bill.depositOffsetAmount);
      feederHostCredits += stampAmount(bill.feederHostCreditAmount);
    }
  }
  return {
    concessionsTotal: wholeRupees(concessions),
    referralCreditsTotal: wholeRupees(referralCredits),
    depositOffsetsTotal: wholeRupees(depositOffsets),
    feederHostCreditsTotal: wholeRupees(feederHostCredits)
  };
}

/** SISP-196: tolerate hand-built / older report objects in the text builders. */
function nonCashOf(report) {
  const raw = report?.nonCashAdjustments ?? {};
  return {
    concessionsTotal: wholeRupees(raw.concessionsTotal),
    referralCreditsTotal: wholeRupees(raw.referralCreditsTotal),
    depositOffsetsTotal: wholeRupees(raw.depositOffsetsTotal),
    feederHostCreditsTotal: wholeRupees(raw.feederHostCreditsTotal)
  };
}

function nonCashSum(nonCash) {
  return nonCash.concessionsTotal + nonCash.referralCreditsTotal
    + nonCash.depositOffsetsTotal + nonCash.feederHostCreditsTotal;
}

/**
 * SISP-176: the month's collections split into bill money vs settled
 * SISP-43 ticket charges, over the partner report's own payment
 * enumeration (same payment-date basis as `collected` and the channel
 * split). Voided payments are skipped entirely — a voided receipt's
 * ticket stamp settles nothing (SISP-34) — so the two lines always sum
 * to the month's non-voided collections, never more.
 */
function buildTicketChargeSplit(state, month) {
  let billCents = 0;
  let ticketCentsTotal = 0;
  let receiptCount = 0;
  for (const { payment } of paymentEntries(state)) {
    if (!payment || typeof payment !== 'object') continue;
    if (monthOfPaymentDate(payment.date) !== month) continue;
    if (isVoidedPayment(payment)) continue;
    const ticketCents = paymentTicketChargeCents(payment);
    const amountCents = Math.round(Number(payment.amount || 0) * 100);
    ticketCentsTotal += ticketCents;
    billCents += Math.max(0, amountCents - ticketCents);
    if (ticketCents > 0) receiptCount += 1;
  }
  return {
    billCollections: wholeRupees(billCents / 100),
    ticketChargesCollected: wholeRupees(ticketCentsTotal / 100),
    ticketChargeReceiptCount: receiptCount
  };
}

/**
 * SISP-176: billed ticket charges still unpaid at the END of `month`,
 * rebuilt from the (sanitized) SISP-12 ticket records. A ticket counts
 * when it was Resolved with billingType 'billed' in or before the month
 * and its charge was not paid by month end — still unpaid today, or
 * paid in a later month (chargePaidAt's month is after `month`). A
 * chargePaid flag with no usable chargePaidAt date reads as paid (the
 * conservative side: never inflate a receivable on a dateless record).
 */
function buildTicketChargesPending(tickets, month) {
  let total = 0;
  let count = 0;
  for (const ticket of sanitizeTickets(tickets)) {
    if (ticket.billingType !== 'billed' || ticket.status !== 'Resolved') continue;
    if (!(ticket.billedAmount > 0)) continue;
    const resolvedMonth = String(ticket.resolvedAt || '').slice(0, 7);
    if (!MONTH_RE.test(resolvedMonth) || resolvedMonth > month) continue;
    if (ticket.chargePaid) {
      const paidMonth = String(ticket.chargePaidAt || '').slice(0, 7);
      if (!MONTH_RE.test(paidMonth) || paidMonth <= month) continue;
    }
    total += ticket.billedAmount;
    count += 1;
  }
  return { ticketChargesPending: wholeRupees(total), ticketChargesPendingCount: count };
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPKR(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

function wholeRupees(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function monthLabel(month) {
  if (!MONTH_RE.test(String(month || ''))) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}

/**
 * Pure: builds the closing report for `month` from ledger state + side
 * inputs. An invalid month yields a zeroed report for '' (same convention
 * as buildMonthlyDowntimeAnalytics). Never mutates its inputs.
 */
export function buildOwnerKhataReport(state, month, inputs = {}) {
  const validMonth = MONTH_RE.test(String(month || '')) ? String(month) : '';
  const complaints = Array.isArray(inputs.complaints) ? inputs.complaints : [];
  const settlements = Array.isArray(inputs.settlements) ? inputs.settlements : [];
  const tickets = Array.isArray(inputs.tickets) ? inputs.tickets : [];
  const roznamchaDays = Array.isArray(inputs.roznamchaDays) ? inputs.roznamchaDays : [];
  const notes = inputs.notes && typeof inputs.notes === 'object' ? inputs.notes : {};
  const savedSnapshot = inputs.savedSnapshot && typeof inputs.savedSnapshot === 'object'
    ? inputs.savedSnapshot
    : null;
  const referenceDate = inputs.referenceDate instanceof Date ? inputs.referenceDate : new Date();

  if (!validMonth) {
    return {
      month: '', validMonth: false, collected: 0, receiptCount: 0,
      pendingArrears: 0, arrearsBillCount: 0, arrearsCutoff: '', arrearsPartial: false,
      shopSettled: 0, shopSettledCount: 0, shopSettledByShop: [],
      collectionChannels: [], closingCashInHand: null,
      nonCashAdjustments: { concessionsTotal: 0, referralCreditsTotal: 0, depositOffsetsTotal: 0, feederHostCreditsTotal: 0 },
      billCollections: 0, ticketChargesCollected: 0, ticketChargeReceiptCount: 0,
      ticketChargesPending: 0, ticketChargesPendingCount: 0,
      expenses: 0, expenseCount: 0, expenseCategories: [], bandwidthFieldExpenses: 0,
      profit: 0, isLoss: false, nasirShare: 0, aqibShare: 0,
      installationNet: 0, installationSurplus: 0, installationSubsidy: 0,
      installationCount: 0, installationRecordedCount: 0, installationPartial: false,
      installationCapexIncluded: false, distributableProfit: 0,
      totalComplaints: 0, totalDowntime: 0, areaOutageComplaints: 0, areaOutageDowntime: 0,
      topCauses: [], savedSnapshot: null, note: '',
      badDebtWrittenOff: 0, badDebtCustomerCount: 0
    };
  }

  // Financials — reused verbatim from the partner share report.
  const partner = buildPartnerShareReport(state, validMonth, referenceDate);
  const summary = partner.summary || {};
  // SISP-73: installation CapEx position for the month (SISP-23
  // accounting) and, when the owner's toggle is ON, the adjusted split —
  // the same computation Partner Settlement performs, so the two
  // surfaces can never disagree.
  const installation = buildMonthlyInstallationSummary(state?.customers, validMonth);
  const installationCapexIncluded = inputs.includeInstallationCapexInSplit === true;
  const profit = wholeRupees(summary.profit);
  const distributableProfit = installationCapexIncluded
    ? profit - wholeRupees(installation.subsidy)
    : profit;
  const partnerShare = installationCapexIncluded
    ? (distributableProfit > 0 ? Math.round(distributableProfit * PARTNER_SHARE_RATE) : 0)
    : wholeRupees(summary.share);

  // SISP-114 (merge composition with SISP-73): optional charity /
  // sadqah reserve, set aside BEFORE the 50/50 split and computed on
  // the SISP-73 distributable profit above — the percentage applies to
  // profit minus any installation subsidy when the CapEx toggle is ON,
  // never to raw profit. Absent / 0% -> charity stays null and both
  // shares are the SISP-73 partnerShare verbatim (byte-identical
  // report shape).
  const charityPct = sanitizeCharityReservePct(inputs.charityReservePct);
  const charity = charityPct > 0 ? computeCharityReserve(distributableProfit, charityPct) : null;
  const shareEach = charity ? charity.shareEach : partnerShare;
  const expenseCategories = Array.isArray(summary.categoryBreakdown) ? summary.categoryBreakdown : [];
  const bandwidthFieldExpenses = expenseCategories
    .filter((row) => BANDWIDTH_FIELD_RE.test(String(row.category || '')))
    .reduce((sum, row) => sum + wholeRupees(row.amount), 0);

  // Arrears — reused verbatim from the month-end outstanding computation.
  const arrears = outstandingAtMonthEnd(state, validMonth, referenceDate);

  // Shop cash settled in this month — SISP-1 settlement records by date.
  const monthSettlements = settlements.filter((record) =>
    record && typeof record === 'object' &&
    typeof record.date === 'string' && record.date.slice(0, 7) === validMonth &&
    Number.isFinite(Number(record.amount)) && Number(record.amount) > 0);
  const shopMap = new Map();
  for (const record of monthSettlements) {
    // OWNER-CASH-SHOP: settlements stored under a legacy shop name read
    // into the ONE unified row; stored records are not rewritten.
    const shop = canonicalShopName(String(record.shop || '')) || 'Unknown shop';
    const entry = shopMap.get(shop) ?? { shop, amount: 0, count: 0 };
    entry.amount += wholeRupees(record.amount);
    entry.count += 1;
    shopMap.set(shop, entry);
  }
  const shopSettledByShop = [...shopMap.values()].sort((a, b) => b.amount - a.amount);

  // SISP-51: collection channel split — the partner enumeration above,
  // classified per payment, so the lines sum to `collected`.
  const collectionChannels = buildCollectionChannels(state, validMonth);

  // SISP-196: non-cash bill reductions — the month's audited waiver
  // stamps, itemized read-only (see buildNonCashAdjustments).
  const nonCashAdjustments = buildNonCashAdjustments(state, validMonth);

  // SISP-176: ticket-charge split of the same month's collections
  // (void-exclusive, so the lines sum to non-voided collections) and the
  // month-end pending ticket charges from the ticket store.
  const ticketSplit = buildTicketChargeSplit(state, validMonth);
  const ticketPending = buildTicketChargesPending(tickets, validMonth);

  // SISP-51: month-end closing cash-in-hand — the SISP-11 roznamcha
  // drawer, anchored on its latest closed day (see roznamcha.js).
  const drawer = buildMonthEndCashInHand(state, roznamchaDays, validMonth, settlements);
  const closingCashInHand = drawer
    ? {
        balance: wholeRupees(drawer.balance),
        monthEndDate: drawer.monthEndDate,
        lastClosedDate: drawer.lastClosedDate,
        monthEndClosed: drawer.monthEndClosed === true
      }
    : null;

  // SISP-64: bad-debt register totals, computed by the caller from
  // bad-debt-ledger.js (badDebtSummary) and passed in — the register
  // lives outside the ledger state, and a write-off is not a monthly
  // figure: the report carries the CURRENT active written-off total
  // so the owner sees how much of the book is declared uncollectible.
  const badDebtInput = inputs.badDebt && typeof inputs.badDebt === 'object' ? inputs.badDebt : {};
  const badDebtWrittenOff = wholeRupees(Number.isFinite(Number(badDebtInput.activeTotal)) ? Number(badDebtInput.activeTotal) : 0);
  const badDebtCustomerCount = Number.isSafeInteger(Number(badDebtInput.activeCount)) && Number(badDebtInput.activeCount) > 0 ? Number(badDebtInput.activeCount) : 0;

  // Network reliability — reused verbatim from the downtime analytics.
  const network = buildMonthlyDowntimeAnalytics(complaints, validMonth);

  return {
    month: validMonth,
    validMonth: true,
    collected: wholeRupees(summary.revenue),
    receiptCount: Number(summary.receiptCount || 0),
    pendingArrears: wholeRupees(arrears.total),
    arrearsBillCount: Number(arrears.billCount || 0),
    arrearsCutoff: String(arrears.cutoff || ''),
    arrearsPartial: arrears.partial === true,
    shopSettled: monthSettlements.reduce((sum, record) => sum + wholeRupees(record.amount), 0),
    shopSettledCount: monthSettlements.length,
    shopSettledByShop,
    collectionChannels,
    closingCashInHand,
    nonCashAdjustments,
    billCollections: ticketSplit.billCollections,
    ticketChargesCollected: ticketSplit.ticketChargesCollected,
    ticketChargeReceiptCount: ticketSplit.ticketChargeReceiptCount,
    ticketChargesPending: ticketPending.ticketChargesPending,
    ticketChargesPendingCount: ticketPending.ticketChargesPendingCount,
    expenses: wholeRupees(summary.expenses),
    expenseCount: Number(summary.expenseCount || 0),
    expenseCategories,
    bandwidthFieldExpenses,
    profit,
    isLoss: summary.isLoss === true,
    nasirShare: shareEach,
    aqibShare: shareEach,
    // SISP-114: reserve fields exist only when a reserve was set aside.
    ...(charity && charity.charityReserve > 0 ? {
      charityReservePct: charity.charityReservePct,
      charityReserve: charity.charityReserve
    } : {}),
    installationNet: wholeRupees(installation.net),
    installationSurplus: wholeRupees(installation.surplus),
    installationSubsidy: wholeRupees(installation.subsidy),
    installationCount: installation.installCount,
    installationRecordedCount: installation.recordedCount,
    installationPartial: installation.hasPartial === true,
    installationCapexIncluded,
    // SISP-114 composition: with a reserve set aside, the
    // distributable profit reads as the post-reserve remainder.
    distributableProfit: charity && charity.charityReserve > 0 ? charity.distributableProfit : distributableProfit,
    totalComplaints: Number(network.totalComplaints || 0),
    totalDowntime: Number(network.totalDowntime || 0),
    areaOutageComplaints: Number(network.areaOutageComplaints || 0),
    areaOutageDowntime: Number(network.areaOutageDowntime || 0),
    topCauses: (Array.isArray(network.byCause) ? network.byCause : [])
      .filter((row) => Number(row.incidents || 0) > 0)
      .map((row) => ({ category: row.category, incidents: row.incidents, totalDowntime: row.totalDowntime })),
    badDebtWrittenOff,
    badDebtCustomerCount,
    savedSnapshot: savedSnapshot && savedSnapshot.month === validMonth
      ? {
          savedAt: String(savedSnapshot.savedAt || ''),
          collection: wholeRupees(savedSnapshot.collection),
          pending: wholeRupees(savedSnapshot.pending),
          profit: wholeRupees(savedSnapshot.profit)
        }
      : null,
    note: getMonthlyClosingNote(notes, validMonth)
  };
}

/** Roman Urdu one-page summary for WhatsApp copy. Pure. */
export function buildOwnerKhataWhatsAppText(report) {
  if (!report || !report.validMonth) return 'Owner Khata Closing: koi mahina muntakhib nahi.';
  const lines = [
    `📕 Owner Khata Closing — ${monthLabel(report.month)}`,
    `Total Bills Collected: ${formatPKR(report.collected)} (${report.receiptCount} receipts)`,
    `Pending Arrears: ${formatPKR(report.pendingArrears)}`,
    `Shop Cash Settled: ${formatPKR(report.shopSettled)} (${report.shopSettledCount} handovers)`,
    `Expenses: ${formatPKR(report.expenses)} (${report.expenseCount} entries)`,
    `NayaPay Bandwidth + Field Expenses: ${formatPKR(report.bandwidthFieldExpenses)}`,
    `Net Profit: ${formatPKR(report.profit)}${report.isLoss ? ' (loss)' : ''}`,
    `Nasir share (50%): ${formatPKR(report.nasirShare)} · Aqib share (50%): ${formatPKR(report.aqibShare)}`,
    `Complaints: ${report.totalComplaints} · Network Offline: ${report.totalDowntime} h (zone-wide: ${report.areaOutageComplaints} faults, ${report.areaOutageDowntime} h)`,
  ];
  // SISP-176: ticket-charge split lines, in the same collections
  // cluster — shown only when the month actually has ticket-charge
  // activity, like the channel split below.
  if (report.ticketChargesCollected > 0 || report.ticketChargesPending > 0) {
    lines.splice(2, 0,
      `Ticket Charges Collected: ${formatPKR(report.ticketChargesCollected)}`,
      `Ticket Charges Pending: ${formatPKR(report.ticketChargesPending)}`);
  }
  // SISP-114: reserve line (fixed report language, like the rest of
  // this summary) only when a reserve was set aside; the share figures
  // above already reflect it. Inserted before the shares line.
  if (report.charityReserve > 0) {
    const shareIdx = lines.findIndex((line) => line.startsWith('Nasir share'));
    const reserveLine = `Charity / Sadqah & Emergency Reserve (${report.charityReservePct}%): ${formatPKR(report.charityReserve)} — set aside before the 50/50 split`;
    if (shareIdx >= 0) lines.splice(shareIdx, 0, reserveLine); else lines.push(reserveLine);
  }
  // SISP-51: channel split + closing cash-in-hand, right under the
  // collected line (these two builders use fixed report language, like
  // the rest of this summary — the modal UI carries the t() strings).
  if (report.closingCashInHand) {
    const cash = report.closingCashInHand;
    lines.splice(2, 0, `Closing Cash-in-Hand (Roznamcha): ${formatPKR(cash.balance)}${cash.monthEndClosed ? ` · drawer band ${cash.monthEndDate}` : ' · expected (mahina abhi band nahi hua)'}`);
  }
  if (Array.isArray(report.collectionChannels) && report.collectionChannels.length) {
    lines.splice(2, 0, `Channel Split: ${report.collectionChannels.map((c) => `${c.channel} ${formatPKR(c.amount)}`).join(' · ')}`);
  }
  // SISP-196: the month's non-cash bill reductions, one summary line,
  // only when the month actually carries waiver stamps.
  const waNonCash = nonCashOf(report);
  if (nonCashSum(waNonCash) > 0) {
    lines.push(`Non-Cash Adjustments: Concessions ${formatPKR(waNonCash.concessionsTotal)} · Referral Credits ${formatPKR(waNonCash.referralCreditsTotal)} · Deposit Offsets ${formatPKR(waNonCash.depositOffsetsTotal)}${waNonCash.feederHostCreditsTotal > 0 ? ` · Feeder Host Credits ${formatPKR(waNonCash.feederHostCreditsTotal)}` : ''}`);
  }
  // SISP-73: installation CapEx position, plus the distributable profit
  // when the toggle was ON (fixed report language, like the rest of
  // this summary — the modal UI carries the t() strings).
  if (report.installationCount > 0 && (report.installationSubsidy > 0 || report.installationSurplus > 0)) {
    lines.push(report.installationNet >= 0
      ? `Installation surplus: ${formatPKR(report.installationSurplus)}`
      : `Installation subsidy (borne by the ISP): ${formatPKR(report.installationSubsidy)}`);
    if (report.installationCapexIncluded) {
      lines.push(`Distributable profit (after installation subsidy): ${formatPKR(report.distributableProfit)}`);
    }
  }
  // SISP-64: declared-uncollectible money, shown only while any is
  // still written off so a clean book adds no line.
  if (report.badDebtWrittenOff > 0) {
    lines.push(`Bad Debt Written Off: ${formatPKR(report.badDebtWrittenOff)} (${report.badDebtCustomerCount} customer${report.badDebtCustomerCount === 1 ? '' : 's'})`);
  }
  if (report.note) lines.push(`Owner note: ${report.note}`);
  lines.push('Ye report sirf khulasa hai — is se koi bill, payment ya khata tabdeel nahi hota.');
  return lines.join('\n');
}

/** Standalone single-page printable report HTML. Pure. */
export function buildOwnerKhataPrintHtml(report) {
  if (!report || !report.validMonth) {
    return '<!doctype html><html><body><p>No month selected.</p></body></html>';
  }
  const categoryRows = report.expenseCategories.map((row) =>
    `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const shopRows = report.shopSettledByShop.map((row) =>
    `<tr><td>${escapeHtml(row.shop)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const channelRows = (Array.isArray(report.collectionChannels) ? report.collectionChannels : []).map((row) =>
    `<tr><td>${escapeHtml(row.channel)}</td><td>${escapeHtml(String(row.count))}</td><td>${escapeHtml(formatPKR(row.amount))}</td></tr>`).join('');
  const causeRows = report.topCauses.map((row) =>
    `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(String(row.incidents))}</td><td>${escapeHtml(String(row.totalDowntime))} h</td></tr>`).join('');
  // SISP-196: non-cash adjustments pairs, only when the month carries stamps.
  const printNonCash = nonCashOf(report);
  const nonCashSection = nonCashSum(printNonCash) > 0 ? `<h2>Non-cash adjustments</h2>
  <div class="pair"><span>Concessions</span><strong>${escapeHtml(formatPKR(printNonCash.concessionsTotal))}</strong></div>
  <div class="pair"><span>Referral credits</span><strong>${escapeHtml(formatPKR(printNonCash.referralCreditsTotal))}</strong></div>
  <div class="pair"><span>Security deposit offsets</span><strong>${escapeHtml(formatPKR(printNonCash.depositOffsetsTotal))}</strong></div>${printNonCash.feederHostCreditsTotal > 0 ? `
  <div class="pair"><span>Feeder host bijli credits</span><strong>${escapeHtml(formatPKR(printNonCash.feederHostCreditsTotal))}</strong></div>` : ''}` : '';
  // SISP-73: installation CapEx pairs — shown whenever the month had
  // new installations; the distributable-profit pair appears only when
  // the toggle was ON and the shares above were computed from it.
  const installationPairs = report.installationCount > 0 ? `
  <div class="pair"><span>${report.installationNet >= 0 ? 'Net installation surplus' : 'Net installation subsidy (borne by the ISP)'} (${escapeHtml(String(report.installationCount))} new installation${report.installationCount === 1 ? '' : 's'})</span><strong>${escapeHtml(formatPKR(Math.abs(report.installationNet)))}</strong></div>${report.installationCapexIncluded ? `
  <div class="pair"><span>Distributable profit (after installation subsidy)</span><strong>${escapeHtml(formatPKR(report.distributableProfit))}</strong></div>` : ''}` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Owner Khata Closing — ${escapeHtml(monthLabel(report.month))}</title><style>
    body{font-family:system-ui,Arial,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{font-size:20px}h2{font-size:16px;margin-top:24px;border-bottom:1px solid #ccc;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #eee}td:last-child,th:last-child{text-align:right}
    .pair{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.note{background:#f6f6f6;padding:12px;border-radius:8px;white-space:pre-wrap}
    .foot{color:#555;font-size:12px;margin-top:24px}
  </style></head><body>
  <h1>📕 Monthly Business &amp; Network Health Report</h1>
  <p><strong>Shahdara ISP</strong> · ${escapeHtml(monthLabel(report.month))}</p>
  <h2>Financials</h2>
  <div class="pair"><span>Total Bills Collected (${escapeHtml(String(report.receiptCount))} receipts)</span><strong>${escapeHtml(formatPKR(report.collected))}</strong></div>
  <div class="pair"><span>Ticket Charges Collected${report.ticketChargeReceiptCount ? ` (${escapeHtml(String(report.ticketChargeReceiptCount))} receipts)` : ''}</span><strong>${escapeHtml(formatPKR(report.ticketChargesCollected))}</strong></div>
  <div class="pair"><span>Pending Arrears${report.arrearsPartial ? ' (month still open)' : ''}</span><strong>${escapeHtml(formatPKR(report.pendingArrears))}</strong></div>
  <div class="pair"><span>Ticket Charges Pending (month end${report.ticketChargesPendingCount ? `, ${escapeHtml(String(report.ticketChargesPendingCount))} tickets` : ''})</span><strong>${escapeHtml(formatPKR(report.ticketChargesPending))}</strong></div>
  <div class="pair"><span>Shop Cash Settled (${escapeHtml(String(report.shopSettledCount))} handovers)</span><strong>${escapeHtml(formatPKR(report.shopSettled))}</strong></div>
  <div class="pair"><span>Expenses (${escapeHtml(String(report.expenseCount))} entries)</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong></div>
  <div class="pair"><span>NayaPay Bandwidth + Field Expenses (keyword-matched)</span><strong>${escapeHtml(formatPKR(report.bandwidthFieldExpenses))}</strong></div>
  <div class="pair"><span>Net Profit${report.isLoss ? ' (loss)' : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></div>
  ${report.charityReserve > 0 ? `<div class="pair"><span>Charity / Sadqah &amp; Emergency Reserve (${escapeHtml(String(report.charityReservePct))}% — set aside before the 50/50 split)</span><strong>${escapeHtml(formatPKR(report.charityReserve))}</strong></div>` : ''}
  <div class="pair"><span>Nasir share (50% of positive profit)</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></div>
  <div class="pair"><span>Aqib share (50% of positive profit)</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></div>${installationPairs}
  ${shopRows ? `<h2>Shop cash settled by shop</h2><table><tr><th>Shop</th><th>Handovers</th><th>Amount</th></tr>${shopRows}</table>` : ''}
  ${channelRows ? `<h2>Collections by channel</h2><table><tr><th>Channel</th><th>Receipts</th><th>Amount</th></tr>${channelRows}</table>` : ''}
  ${report.closingCashInHand ? `<div class="pair"><span>Closing Cash-in-Hand (Roznamcha) — ${report.closingCashInHand.monthEndClosed ? `drawer closed ${escapeHtml(report.closingCashInHand.monthEndDate)}` : 'expected, month-end day not closed'}</span><strong>${escapeHtml(formatPKR(report.closingCashInHand.balance))}</strong></div>` : ''}
  ${nonCashSection}
  ${categoryRows ? `<h2>Expenses by category</h2><table><tr><th>Category</th><th>Entries</th><th>Amount</th></tr>${categoryRows}</table>` : ''}
  <h2>Network reliability</h2>
  <div class="pair"><span>Total Complaints</span><strong>${escapeHtml(String(report.totalComplaints))}</strong></div>
  <div class="pair"><span>Total Network Offline Hours</span><strong>${escapeHtml(String(report.totalDowntime))} h</strong></div>
  <div class="pair"><span>Zone-wide faults</span><strong>${escapeHtml(String(report.areaOutageComplaints))} faults · ${escapeHtml(String(report.areaOutageDowntime))} h</strong></div>
  ${causeRows ? `<h2>Outages by cause</h2><table><tr><th>Cause</th><th>Incidents</th><th>Hours</th></tr>${causeRows}</table>` : ''}
  ${report.savedSnapshot ? `<h2>Saved monthly closing</h2><div class="pair"><span>Saved at</span><strong>${escapeHtml(report.savedSnapshot.savedAt)}</strong></div><div class="pair"><span>Saved collection / profit</span><strong>${escapeHtml(formatPKR(report.savedSnapshot.collection))} / ${escapeHtml(formatPKR(report.savedSnapshot.profit))}</strong></div>` : '<h2>Saved monthly closing</h2><p>No saved monthly closing snapshot for this month.</p>'}
  ${report.note ? `<h2>Owner closing note</h2><div class="note">${escapeHtml(report.note)}</div>` : ''}
  <p class="foot">This report only summarizes the ledger — it never changes bills, payments, expenses, or customers. Pending Arrears counts unpaid balances on bills through this month, with payments counted through ${escapeHtml(report.arrearsCutoff || 'month end')}.</p>
  </body></html>`;
}

/**
 * Dashboard-card + modal controller, following the SISP-16 downtime
 * analytics modal pattern. Returns { open, refresh } or null when the
 * dialog is absent (e.g. unit-test DOM).
 */
export function setupOwnerKhataModal(getState, { onToast } = {}) {
  const dialog = typeof document !== 'undefined' ? document.getElementById('ownerKhataModal') : null;
  if (!dialog) return null;
  const $ = (id) => dialog.querySelector(`#${id}`);
  let month = pakistanMonthNow();

  function currentReport() {
    const state = getState();
    const savedSnapshot = (state.monthlyClosings ?? []).find((row) => row.month === month) ?? null;
    return buildOwnerKhataReport(state, month, {
      complaints: loadComplaints(),
      settlements: loadShopSettlements(),
      tickets: loadTickets(),
      notes: loadMonthlyClosingNotes(),
      roznamchaDays: loadRoznamchaDays(),
      charityReservePct: loadCharityReserveSettings().charityReservePct,
      savedSnapshot,
      // SISP-73: the same persisted partner-settings toggle the
      // Partner Settlement tab uses, so both surfaces agree.
      includeInstallationCapexInSplit: loadPartnerSettings().includeInstallationCapexInSplit
    });
  }

  function render() {
    const report = currentReport();
    const lineEl = $('ownerKhataSummaryLine');
    if (lineEl) {
      lineEl.textContent = !report.validMonth
        ? 'Choose a month to see its closing report.'
        : `Collected ${formatPKR(report.collected)} · Arrears ${formatPKR(report.pendingArrears)} · Expenses ${formatPKR(report.expenses)} · Net profit ${formatPKR(report.profit)} · ${report.totalComplaints} complaints · ${report.totalDowntime} h offline`;
    }
    const bodyEl = $('ownerKhataBody');
    if (bodyEl) {
      const shopLines = report.shopSettledByShop.map((row) =>
        `<p><span>${escapeHtml(row.shop)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(String(row.count))} handovers</small></p>`).join('');
      const categoryLines = report.expenseCategories.map((row) =>
        `<p><span>${escapeHtml(row.category)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(String(row.count))} entries</small></p>`).join('');
      const causeLines = report.topCauses.map((row) =>
        `<p><span>${escapeHtml(row.category)}</span><strong>${escapeHtml(String(row.incidents))} faults · ${escapeHtml(String(row.totalDowntime))} h</strong></p>`).join('');
      // SISP-51: channel split lines (shop names + wallet brands are
      // ledger data and stay verbatim; only the Direct Cash label and
      // the framing strings are translated) + closing cash-in-hand.
      const channelLines = report.collectionChannels.map((row) =>
        `<p><span>${escapeHtml(row.kind === 'cash' ? t('khata2_channel_direct_cash') : row.channel)}</span><strong>${escapeHtml(formatPKR(row.amount))}</strong><small> · ${escapeHtml(t(row.count === 1 ? 'khata2_receipt_sing' : 'khata2_receipt_plur', null, { count: row.count }))}</small></p>`).join('');
      const cashInHandLine = report.closingCashInHand
        ? `<p><span>${escapeHtml(t('khata2_cash_in_hand'))}</span><strong>${escapeHtml(formatPKR(report.closingCashInHand.balance))}</strong><small> · ${escapeHtml(report.closingCashInHand.monthEndClosed ? t('khata2_cash_closed_through', null, { date: report.closingCashInHand.monthEndDate }) : t('khata2_cash_expected'))}</small></p>`
        : '';
      // SISP-196: non-cash adjustments lines — a title plus the three
      // named totals (the feeder-host line rides along only when the
      // month actually carries one), shown only when the month has
      // any waiver stamps at all, like the channel block above.
      const nonCash = nonCashOf(report);
      const nonCashLines = nonCashSum(nonCash) > 0 ? `
          <p><span>${escapeHtml(t('khata2_noncash_title'))}</span></p>
          <p><span>${escapeHtml(t('khata2_noncash_concessions'))}</span><strong>${escapeHtml(formatPKR(nonCash.concessionsTotal))}</strong></p>
          <p><span>${escapeHtml(t('khata2_noncash_referral'))}</span><strong>${escapeHtml(formatPKR(nonCash.referralCreditsTotal))}</strong></p>
          <p><span>${escapeHtml(t('khata2_noncash_deposit'))}</span><strong>${escapeHtml(formatPKR(nonCash.depositOffsetsTotal))}</strong></p>${nonCash.feederHostCreditsTotal > 0 ? `
          <p><span>${escapeHtml(t('khata2_noncash_feeder'))}</span><strong>${escapeHtml(formatPKR(nonCash.feederHostCreditsTotal))}</strong></p>` : ''}`
        : '';
      // SISP-114: charity / sadqah reserve line, shown only when a
      // reserve was set aside for the month (report carries the fields
      // only then); the share lines below already reflect it.
      const charityLine = report.charityReserve > 0
        ? `<p><span>${escapeHtml(t('charity_reserve_label'))}</span><strong>${escapeHtml(formatPKR(report.charityReserve))}</strong><small> · ${escapeHtml(t('charity_reserve_share_note', null, { pct: report.charityReservePct }))}</small></p>`
        : '';
      bodyEl.innerHTML = `
        <article class="owner-khata-section"><h3>Financials</h3>
          <p><span>Total Bills Collected</span><strong>${escapeHtml(formatPKR(report.collected))}</strong><small> · ${escapeHtml(String(report.receiptCount))} receipts</small></p>
          <p><span>${escapeHtml(t('khata2_ticket_collected'))}</span><strong>${escapeHtml(formatPKR(report.ticketChargesCollected))}</strong>${report.ticketChargeReceiptCount ? `<small> · ${escapeHtml(t(report.ticketChargeReceiptCount === 1 ? 'khata2_receipt_sing' : 'khata2_receipt_plur', null, { count: report.ticketChargeReceiptCount }))}</small>` : ''}</p>
          <p><span>Pending Arrears</span><strong>${escapeHtml(formatPKR(report.pendingArrears))}</strong><small> · ${escapeHtml(String(report.arrearsBillCount))} bills · through ${escapeHtml(report.arrearsCutoff || 'month end')}${report.arrearsPartial ? ' (month still open)' : ''}</small></p>
          <p><span>${escapeHtml(t('khata2_ticket_pending'))}</span><strong>${escapeHtml(formatPKR(report.ticketChargesPending))}</strong>${report.ticketChargesPendingCount ? `<small> · ${escapeHtml(t(report.ticketChargesPendingCount === 1 ? 'khata2_ticket_sing' : 'khata2_ticket_plur', null, { count: report.ticketChargesPendingCount }))}</small>` : ''}</p>
          <p><span>Shop Cash Settled</span><strong>${escapeHtml(formatPKR(report.shopSettled))}</strong><small> · ${escapeHtml(String(report.shopSettledCount))} handovers</small></p>
          ${shopLines}
          ${channelLines ? `<p><span>${escapeHtml(t('khata2_channels_title'))}</span></p>${channelLines}` : ''}
          ${nonCashLines}
          <p><span>Expenses</span><strong>${escapeHtml(formatPKR(report.expenses))}</strong><small> · ${escapeHtml(String(report.expenseCount))} entries</small></p>
          <p><span>NayaPay Bandwidth + Field Expenses</span><strong>${escapeHtml(formatPKR(report.bandwidthFieldExpenses))}</strong><small> · keyword-matched categories</small></p>
          ${categoryLines}
          <p><span>Net Profit${report.isLoss ? ' (loss)' : ''}</span><strong>${escapeHtml(formatPKR(report.profit))}</strong></p>
          ${charityLine}
          <p><span>Nasir share (50%)</span><strong>${escapeHtml(formatPKR(report.nasirShare))}</strong></p>
          <p><span>Aqib share (50%)</span><strong>${escapeHtml(formatPKR(report.aqibShare))}</strong></p>
          ${report.installationCount > 0 ? `<p><span>${escapeHtml(t(report.installationNet >= 0 ? 'capex_net_surplus' : 'capex_net_subsidy'))}</span><strong>${escapeHtml(formatPKR(Math.abs(report.installationNet)))}</strong><small> · ${escapeHtml(t('capex_install_count', null, { count: report.installationCount }))}${report.installationPartial ? ` · ${escapeHtml(t('capex_partial_note'))}` : ''}</small></p>` : ''}
          ${report.installationCount > 0 && report.installationCapexIncluded ? `<p><span>${escapeHtml(t('capex_distributable_profit'))}</span><strong>${escapeHtml(formatPKR(report.distributableProfit))}</strong></p>` : ''}
          ${report.installationCount > 0 && !report.installationCapexIncluded ? `<p><span>${escapeHtml(t('capex_tracked_separately'))}</span></p>` : ''}
          ${cashInHandLine}
        </article>
        ${renderShopScorecardHtml(buildShopScorecard(getState(), loadShopSettlements(), month))}
        <article class="owner-khata-section"><h3>Network reliability</h3>
          <p><span>Total Complaints</span><strong>${escapeHtml(String(report.totalComplaints))}</strong></p>
          <p><span>Total Network Offline Hours</span><strong>${escapeHtml(String(report.totalDowntime))} h</strong></p>
          <p><span>Zone-wide faults</span><strong>${escapeHtml(String(report.areaOutageComplaints))} faults · ${escapeHtml(String(report.areaOutageDowntime))} h</strong></p>
          ${causeLines}
        </article>
        <article class="owner-khata-section"><h3>Saved monthly closing</h3>
          ${report.savedSnapshot
            ? `<p><span>Saved at</span><strong>${escapeHtml(report.savedSnapshot.savedAt)}</strong></p><p><span>Saved collection / profit</span><strong>${escapeHtml(formatPKR(report.savedSnapshot.collection))} / ${escapeHtml(formatPKR(report.savedSnapshot.profit))}</strong></p>`
            : '<p>No saved monthly closing snapshot for this month.</p>'}
        </article>
        <p class="owner-khata-footnote">This report only summarizes the ledger — it never changes bills, payments, expenses, or customers. Same month, same ledger → same numbers.</p>`;
    }
    const noteEl = $('ownerKhataNote');
    if (noteEl) noteEl.value = report.note;
  }

  const monthInput = $('ownerKhataMonth');
  if (monthInput) {
    monthInput.value = month;
    monthInput.addEventListener('change', () => {
      month = monthInput.value || pakistanMonthNow();
      render();
    });
  }
  const saveNoteBtn = $('ownerKhataSaveNoteBtn');
  if (saveNoteBtn) saveNoteBtn.addEventListener('click', () => {
    const noteEl = $('ownerKhataNote');
    const next = setMonthlyClosingNote(loadMonthlyClosingNotes(), month, noteEl ? noteEl.value : '');
    if (saveMonthlyClosingNotes(next)) {
      if (onToast) onToast('Closing note saved for this month.');
      render();
    } else if (onToast) {
      onToast('Closing note could not be saved on this device.');
    }
  });
  const printBtn = $('ownerKhataPrintBtn');
  if (printBtn) printBtn.addEventListener('click', () => {
    const html = buildOwnerKhataPrintHtml(currentReport());
    const printWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWindow) {
      if (onToast) onToast('Pop-up blocked — allow pop-ups, then tap Print again.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  });
  const copyBtn = $('ownerKhataCopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const text = buildOwnerKhataWhatsAppText(currentReport());
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        if (onToast) onToast('Closing summary copied — paste it into WhatsApp.');
      } else if (onToast) {
        onToast('Copy is not available on this device.');
      }
    } catch {
      if (onToast) onToast('Copy failed — try again.');
    }
  });
  const closeBtn = $('ownerKhataCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  const openBtn = typeof document !== 'undefined' ? document.getElementById('openOwnerKhataModalBtn') : null;
  if (openBtn) openBtn.addEventListener('click', () => {
    month = pakistanMonthNow();
    if (monthInput) monthInput.value = month;
    render();
    dialog.showModal();
  });

  return {
    open(prefilter = {}) {
      if (MONTH_RE.test(String(prefilter.month || ''))) month = String(prefilter.month);
      if (monthInput) monthInput.value = month;
      render();
      dialog.showModal();
    },
    refresh() {
      render();
    }
  };
}
