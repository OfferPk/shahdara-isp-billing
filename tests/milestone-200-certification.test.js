/**
 * milestone-200-certification.test.js — SISP-200 (P0, MAJOR MILESTONE)
 *
 * 200-Phase Golden-Ledger End-to-End Financial & Cross-Module
 * Certification Suite.
 *
 * A golden fixture of exactly 10 synthetic subscribers across 3
 * canonical mohallas (BARRIAN, CHAMYAAA, GANGALL) is built ENTIRELY
 * through the app's real write paths on current main:
 *   addCustomer / updateCustomerProfile (core.js),
 *   runBillingCycle (billing-cycle.js — creates bills, rides SISP-4
 *   kist lines, stamps SISP-40 referral credits),
 *   addPayment (core.js), recordAdvancePayment (advance-payment.js,
 *   PR #488), executeQuickCollection (nav-quick-collect.js, SISP-43
 *   billed ticket charges), createTicket/resolveTicket
 *   (complaint-tickets.js), applyConcessionToBill (core.js, SISP-30),
 *   reconcileReferralCredits/applyReferralApplications
 *   (referral-credits.js, SISP-40), createInstallmentPlan
 *   (installment-plan.js, SISP-4), archiveCustomer (core.js),
 *   applyDepositSettlement (hardware-custody.js, SISP-50 / PR #487),
 *   voidPayment (payment-void-audit.js, SISP-34), addExpense
 *   (phase3.js), addRoznamchaOutflow + syncRoznamchaExpenses
 *   (roznamcha.js, SISP-45 / PR #481 mirror), applySettlement
 *   (shop-settlement.js, SISP-1).
 * The only direct record construction is attaching the created kist
 * plan to its customer (installmentPlans) — the plan object itself is
 * produced by the real createInstallmentPlan recorder; the app stores
 * plans on the customer record exactly this way.
 *
 * The hand-computed GOLDEN TABLE (below, written first) is then
 * asserted, at exact integer-cent equality, against FIVE surfaces:
 *   1. core engine — calculatePaymentAllocations + arrearsAndAdvance
 *   2. Khata Doctor — qa-khata-doctor.js (computeLedgerBalance +
 *      runKhataDoctor must be healthy with zero issues)
 *   3. Billing Register — billing-register.js rows + totals
 *   4. Owner Khata — owner-khata.js (partner report + month-end
 *      arrears + shop settlements + roznamcha drawer)
 *   5. Branch Guard + backup — branch-guard.js / createJsonBackup /
 *      previewJsonBackupMerge round-trip on the golden state itself
 *      (at build time this was restore-blocked by the referral-stamp
 *      defect pinned below; FU5 has since fixed it — see the
 *      RECONCILIATION note — and the round-trip now runs on the
 *      golden state, with the fix itself certified in block 6)
 *
 * ---------------------------------------------------------------------
 * RECONCILIATION NOTE (prep onto main d4ed3e79, after the build):
 * This suite was built on base 8df7bad9. Four documented pins encoded
 * the truth of THAT base and flipped — loudly, as designed — once the
 * fixes they waited on merged. Each was corrected at reconciliation
 * to the CURRENT engine truth, verified against live run output;
 * no money figure was invented and the golden total (Rs 11,800,
 * engine-derived) never changed:
 *   (1) FU4 merged (b165d399): voided payments are excluded from
 *       P&L/income at the shared sources (phase3.js paymentEntries
 *       and outstandingAtMonthEnd's walk, dashboard-pnl). The FU4
 *       section below records the flipped delta.
 *   (2) FU5 merged (296919e3): the referral-stamp restore defect is
 *       FIXED; the defect pin flipped into a fix certification and
 *       the round-trip was re-pointed at the golden state (the
 *       referral-free variant was deleted). See the FU5 section.
 *   (3) OWNER-CASH-SHOP unification: 'Hassan Shop' + 'Balla Shop'
 *       are one shop — settlement records and the Owner Khata channel
 *       split now carry the canonical 'Hassan Balla Shop' (September
 *       channel rows merged 5000+2500 = 7500, count 2; totals
 *       unchanged). Expectation lines only were re-pinned.
 *   (4) Restore-side default fills: the backup restore sanitizer
 *       fills customer fields added after the build base (SISP-138
 *       lastContactedAt/lastContactChannel -> null; signalReadings
 *       -> []) — the round-trip fingerprint comparison normalizes
 *       exactly those defaults (probe-verified as the ONLY restored-
 *       state differences; every figure identical).
 *
 * ---------------------------------------------------------------------
 * FU4 DESIGN DECISION (documented, per the phase brief) — FLIPPED:
 * The fixture INCLUDES one voided payment (Golden Two, Rs 1,000 cash,
 * 2026-10-10, voided 2026-10-12 as a duplicate). At build time the
 * partner-report basis used by Owner Khata counted receipts by
 * payment date WITH NO VOID EXCLUSION, so Owner Khata's October
 * `collected` exceeded the valid (non-voided) receipts by exactly
 * the voided amount, pinned as FU4_KNOWN_DELTA (Rs 1,000 collected
 * + 1 receipt). FU4 has MERGED (b165d399 — voided payments excluded
 * from P&L and income computations at the shared sources), so the
 * flip the build anticipated has happened: FU4_KNOWN_DELTA is now
 * ZERO in both months, October collected/profit/shares fell by
 * exactly the voided Rs 1,000 (14,200 -> 13,200; 8,700 -> 7,700;
 * 4,350 -> 3,850 each) and the Direct Cash channel dropped the
 * voided receipt (7,000 x3 -> 6,000 x2). Every surface (engine,
 * Doctor, Register, Owner Khata) now excludes the voided receipt,
 * and they agree with each other to the cent with NO delta.
 *
 * ---------------------------------------------------------------------
 * FU5 FIX (was: ⚠️ DEFECT FOUND BY THIS CERTIFICATION on main
 * 8df7bad9; this phase never fixed production code — FU5 did):
 * A backup containing a bill stamped with a cycle-applied SISP-40
 * referral credit COULD NOT be restored: previewJsonBackupMerge
 * threw "Backup contains an invalid bill correction date."
 * Root cause: billing-cycle.js `withReferralCredit` stamped the
 * bill's amountHistory entry `changedAt` (and
 * `referralCreditAppliedAt`) with Date#toISOString()
 * ("2026-10-02T12:00:00.000Z"), while core.js backup validation
 * requires every amountHistory `changedAt` to match
 * parseLocalDateTime's strict "YYYY-MM-DDTHH:MM" local format.
 * FU5 (296919e3, "Referral-credit stamp format fix") switched
 * withReferralCredit to localDateTimeValue stamps, so referral
 * backups restore. As the build anticipated, the defect pins failed
 * loudly the day the fix landed; at reconciliation they were flipped
 * into a fix certification (block 6: golden backup + minimal repro
 * restore with the credit intact) and the round-trip block was
 * re-pointed at the golden state itself, exactly as prescribed.
 *
 * ---------------------------------------------------------------------
 * OWNER-KHATA ARREARS BRIDGE (definitional, pinned exactly):
 * Owner Khata's pendingArrears reuses phase3 outstandingAtMonthEnd —
 * a month-end snapshot that counts payments dated up to the cutoff
 * and does NOT net the waiver stamps (concession / referral /
 * deposit-offset). At build time its walk also counted voided
 * receipts; since FU4 the walk EXCLUDES voided receipts (phase3.js),
 * so the voidedApplied bridge term is 0 and October's snapshot
 * arrears rose by exactly the Rs 800 the voided receipt used to
 * absorb (17,000 -> 17,800, verified against the report). Against
 * the engine's live balance the exact bridge for this fixture is:
 *   pendingArrears = engineBalance + waiverStamps − voidedApplied
 * with both bridge terms pinned as golden constants (the fixture is
 * designed so no waiver bill is overpaid past its post-waiver due,
 * which keeps the bridge exact; the per-bill preconditions hold by
 * construction and the totals below prove them).
 *
 * Deterministic: every clock is injected (SEP/OCT/NOV anchors); the
 * suite passes on any calendar date. All names/numbers/TIDs are
 * synthetic; shop method strings come from core's PAYMENT_METHODS.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, updateCustomerProfile, addPayment,
  calculatePaymentAllocations, archiveCustomer, createJsonBackup,
  previewJsonBackupMerge, applyConcessionToBill, PAYMENT_METHODS
} from '../core.js';
import { runBillingCycle, arrearsAndAdvance } from '../billing-cycle.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { reconcileReferralCredits, applyReferralApplications } from '../referral-credits.js';
import { createTicket, resolveTicket, billedTicketChargesPending } from '../complaint-tickets.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { recordAdvancePayment, advanceBalanceCents } from '../advance-payment.js';
import { voidPayment } from '../payment-void-audit.js';
import { applyDepositSettlement, depositSettlementOf } from '../hardware-custody.js';
import { addExpense, outstandingAtMonthEnd } from '../phase3.js';
import { addRoznamchaOutflow, syncRoznamchaExpenses, buildRoznamchaDay } from '../roznamcha.js';
import { applySettlement } from '../shop-settlement.js';
import { computeLedgerBalance, buildKhataDoctorCache, runKhataDoctor } from '../qa-khata-doctor.js';
import { buildBillingRegister } from '../billing-register.js';
import { buildOwnerKhataReport } from '../owner-khata.js';
import {
  createBranchGuard, createBranchGuardStamp, recordBranchGuardExport,
  classifyBranchGuardRestore, fingerprintState
} from '../branch-guard.js';
import { vacationHoldState } from '../pause-billing.js';

const D = (y, m, d) => new Date(y, m - 1, d, 12);
const SEP1 = D(2026, 9, 1);
const OCT2 = D(2026, 10, 2);
const NOV2 = D(2026, 11, 2);
const cents = (rupees) => Math.round(rupees * 100);

/* =====================================================================
 * THE GOLDEN TABLE — hand-computed expectations, written FIRST.
 * Money story per subscriber (Rs):
 *  #1 One    BARRIAN   3000/mo. Sep paid Cash; Oct paid at Waseem shop;
 *                      + Rs 3,000 advance (JazzCash, 29 Oct) held as
 *                      pending credit for November.
 *  #2 Two    BARRIAN   2000/mo. Sep paid Easypaisa (TID); Oct paid
 *                      1,200 Easypaisa (TID) + a 1,000 Cash receipt
 *                      that was VOIDED as a duplicate → due 800.
 *  #3 Three  BARRIAN   FREE connection — never billed, never due.
 *  #4 Four   CHAMYAAA  2500/mo. Sep paid; vacation hold covers all of
 *                      October → no Oct bill, month recorded skipped.
 *  #5 Five   CHAMYAAA  3000/mo + hardware kist 2000/mo (6000 over 3).
 *                      Sep bill 5000 paid at Hassan shop; Oct 5000 due.
 *  #6 Six    CHAMYAAA  3000/mo. Sep paid; a billed ticket charge of
 *                      500 (patch cord) settles inside an Oct Quick
 *                      Collect of 3,500 → Oct bill fully covered.
 *  #7 Seven  GANGALL   3000/mo. Sep outage concession 500 stamped,
 *                      then 2,500 paid at Balla shop → Sep settled;
 *                      Oct 3,000 due.
 *  #8 Eight  GANGALL   3000/mo, the referrer. Sep paid; Oct bill
 *                      carries the 500 referral credit, pays 2,500.
 *  #9 Nine   GANGALL   2000/mo, referred by Eight. Sep paid JazzCash
 *                      (the referral trigger); Oct 2,000 due.
 *  #10 Ten   GANGALL   3000/mo + 5,000 security deposit. Sep + Oct
 *                      unpaid (6,000); disconnected 20 Oct and the
 *                      deposit settles oldest-first: Sep 3,000 +
 *                      Oct 2,000 → 1,000 still due, no refund.
 * ===================================================================== */
const GOLDEN_BALANCES_CENTS = {
  1: { '2026-09': 0, '2026-10': 0 },
  2: { '2026-09': 0, '2026-10': 80000 },
  3: {},
  4: { '2026-09': 0 },
  5: { '2026-09': 0, '2026-10': 500000 },
  6: { '2026-09': 0, '2026-10': 0 },
  7: { '2026-09': 0, '2026-10': 300000 },
  8: { '2026-09': 0, '2026-10': 0 },
  9: { '2026-09': 0, '2026-10': 200000 },
  10: { '2026-09': 0, '2026-10': 100000 }
};
const GOLDEN_TOTAL_BALANCE_CENTS = 1180000; // Rs 11,800
const GOLDEN_ARREARS_NOV = { 1: 0, 2: 800, 3: 0, 4: 0, 5: 5000, 6: 0, 7: 3000, 8: 0, 9: 2000, 10: 1000 };
const GOLDEN_ADVANCE_NOV = { 1: 3000 }; // everyone else: 0

const GOLDEN_REGISTER = {
  '2026-10': {
    totals: { count: 8, totalBilled: 24000, totalPaid: 12200 },
    rows: [
      [1, 'paid', 3000, 3000, 0], [2, 'partial', 2000, 1200, 800],
      [5, 'unpaid', 5000, 0, 5000], [6, 'paid', 3000, 3000, 0],
      [7, 'unpaid', 3000, 0, 3000], [8, 'paid', 3000, 3000, 0],
      [9, 'unpaid', 2000, 0, 2000],
      // #10: the register's paid column is billAmount − balanceDue, so
      // the 2,000 deposit offset shows as covered, while its status
      // chip keys off cash receipts (derivedBillStatus) — with no
      // receipt applied it reads 'unpaid'. Both pinned as derived.
      [10, 'unpaid', 3000, 2000, 1000]
    ]
  },
  '2026-09': {
    totals: { count: 9, totalBilled: 26500, totalPaid: 26500 },
    rows: [
      [1, 'paid', 3000, 3000, 0], [2, 'paid', 2000, 2000, 0],
      [4, 'paid', 2500, 2500, 0], [5, 'paid', 5000, 5000, 0],
      [6, 'paid', 3000, 3000, 0], [7, 'paid', 3000, 3000, 0],
      [8, 'paid', 3000, 3000, 0], [9, 'paid', 2000, 2000, 0],
      [10, 'paid', 3000, 3000, 0]
    ]
  }
};

const GOLDEN_KHATA = {
  '2026-09': {
    collected: 23000, receiptCount: 8, expenses: 0, profit: 23000,
    nasirShare: 11500, aqibShare: 11500, shopSettled: 7500,
    pendingArrears: 3500, arrearsBillCount: 9, closingBalance: 19000,
    channels: [
      { channel: 'Direct Cash', kind: 'cash', amount: 11500, count: 4 },
      // OWNER-CASH-SHOP unification: the two legacy shop methods
      // ('Cash at Hassan shop' / 'Cash at Balla shop') are ONE shop —
      // the report merges them into a single Hassan Balla Shop row
      // (5000 + 2500 = 7500, count 2). Total unchanged.
      { channel: 'Hassan Balla Shop', kind: 'shop', amount: 7500, count: 2 },
      { channel: 'Easypaisa', kind: 'wallet', amount: 2000, count: 1 },
      { channel: 'JazzCash', kind: 'wallet', amount: 2000, count: 1 }
    ]
  },
  '2026-10': {
    // POST-FU4 (see header): the voided Rs 1,000 receipt is excluded
    // from collected/profit/shares and the Direct Cash channel.
    collected: 13200, receiptCount: 5, expenses: 5500, profit: 7700,
    nasirShare: 3850, aqibShare: 3850, shopSettled: 3000,
    pendingArrears: 17800, arrearsBillCount: 17, closingBalance: 26500,
    channels: [
      { channel: 'Direct Cash', kind: 'cash', amount: 6000, count: 2 },
      { channel: 'Waseem Abbasi Shop', kind: 'shop', amount: 3000, count: 1 },
      { channel: 'Easypaisa', kind: 'wallet', amount: 1200, count: 1 },
      { channel: 'JazzCash', kind: 'wallet', amount: 3000, count: 1 }
    ]
  }
};
// Valid (non-voided) receipts, hand-counted from the fixture records.
const GOLDEN_VALID_RECEIPTS = {
  '2026-09': { total: 23000, count: 8 },
  '2026-10': { total: 13200, count: 5 }
};
// FU4 FLIPPED (reconciliation onto post-FU4 main): FU4 merged
// (b165d399 — voided payments excluded from P&L/income at the shared
// sources), so Owner Khata's basis now excludes the voided Rs 1,000
// October receipt too. The known delta is ZERO in both months: the
// report's collected equals the valid receipts exactly. (At build
// time, on pre-FU4 main, October pinned { amount: 1000, count: 1 }.)
const FU4_KNOWN_DELTA = { '2026-09': { amount: 0, count: 0 }, '2026-10': { amount: 0, count: 0 } };
// Arrears bridge terms (see header): waiver stamps the month-end
// snapshot does not net. POST-FU4 the snapshot's payment walk also
// excludes voided receipts (phase3.js), so the voidedApplied term —
// the part of the voided receipt the pre-FU4 walk absorbed — is now
// ZERO: the voided Rs 1,000 no longer reduces the snapshot arrears
// at all (October pendingArrears rose by exactly the Rs 800 it used
// to absorb: 17,000 → 17,800, verified against the report).
const ARREARS_BRIDGE = {
  '2026-09': { waiversCents: 350000, voidedAppliedCents: 0 },   // concession 500 + Sep deposit offset 3,000
  '2026-10': { waiversCents: 600000, voidedAppliedCents: 0 } // + referral 500 + Oct offset 2,000; voided applied = 0 post-FU4 (was 80000)
};

/* ---------------------------------------------------------------------
 * Fixture builder — real write paths only (see header). (At build
 * time a referral-free variant existed solely because the golden
 * backup could not be restored; since FU5 fixed that defect, the
 * round-trip is certified on the golden state itself and the variant
 * was removed at reconciliation.)
 * ------------------------------------------------------------------- */
function buildGoldenFixture() {
  let state = createInitialState();
  const add = (name, options = {}) => {
    state = addCustomer(state, name, SEP1, options);
    return state.customers[state.customers.length - 1];
  };
  const one = add('Golden One', { mohalla: 'Barrian', phone: '0300-0000001' });
  const two = add('Golden Two', { mohalla: 'Barrian', phone: '0300-0000002' });
  const three = add('Golden Three', { mohalla: 'Barrian', isFreeConnection: true });
  const four = add('Golden Four', { mohalla: 'Chamyaaa' });
  const five = add('Golden Five', { mohalla: 'Chamyaaa' });
  const six = add('Golden Six', { mohalla: 'Chamyaaa' });
  const seven = add('Golden Seven', { mohalla: 'Gangall' });
  const eight = add('Golden Eight', { mohalla: 'Gangall' });
  const nine = add('Golden Nine', { mohalla: 'Gangall', referredByCustomerId: eight.id });
  const ten = add('Golden Ten', { mohalla: 'Gangall', securityDeposit: 5000 });
  const byNumber = new Map(state.customers.map((c) => [c.customerNumber, c]));

  const price = (id, amount, speed) => {
    state = updateCustomerProfile(state, id, { monthlySellingAmount: String(amount), packageSpeed: speed }, SEP1);
  };
  price(one.id, 3000, '15 Mbps'); price(two.id, 2000, '10 Mbps'); price(four.id, 2500, '10 Mbps');
  price(five.id, 3000, '15 Mbps'); price(six.id, 3000, '15 Mbps'); price(seven.id, 3000, '15 Mbps');
  price(eight.id, 3000, '15 Mbps'); price(nine.id, 2000, '10 Mbps'); price(ten.id, 3000, '15 Mbps');

  // SISP-4 hardware kist for Five: Rs 6,000 over 3 months from Sep.
  const plan = createInstallmentPlan(
    { itemTitle: 'Golden Router + Fiber', totalAmount: 6000, downPayment: 0, totalMonths: 3, startDate: '2026-09-01' },
    { id: 'plan-golden-1' }
  );
  state = { ...state, customers: state.customers.map((c) => (c.id === five.id ? { ...c, installmentPlans: [plan] } : c)) };

  let cycles = [];
  const runCycle = (month, ref, options) => {
    const run = runBillingCycle(state, month, cycles, ref, options);
    state = run.state; cycles = [...cycles, run.cycle];
    return run;
  };
  runCycle('2026-09', D(2026, 9, 2));

  const pay = (id, month, fields, ref) => { state = addPayment(state, id, month, fields, ref); };
  pay(one.id, '2026-09', { date: '2026-09-06', amount: '3000', method: 'Cash' }, D(2026, 9, 6));
  pay(two.id, '2026-09', { date: '2026-09-08', amount: '2000', method: 'Easypaisa', transactionId: 'EP-GOLD-1001' }, D(2026, 9, 8));
  pay(four.id, '2026-09', { date: '2026-09-10', amount: '2500', method: 'Cash' }, D(2026, 9, 10));
  pay(five.id, '2026-09', { date: '2026-09-12', amount: '5000', method: 'Cash at Hassan shop' }, D(2026, 9, 12));
  pay(six.id, '2026-09', { date: '2026-09-05', amount: '3000', method: 'Cash' }, D(2026, 9, 5));
  state = applyConcessionToBill(state, seven.id, '2026-09', { amount: 500, reason: 'Outage Reaayat' }, D(2026, 9, 13));
  pay(seven.id, '2026-09', { date: '2026-09-14', amount: '2500', method: 'Cash at Balla shop' }, D(2026, 9, 14));
  pay(eight.id, '2026-09', { date: '2026-09-06', amount: '3000', method: 'Cash' }, D(2026, 9, 6));
  pay(nine.id, '2026-09', { date: '2026-09-09', amount: '2000', method: 'JazzCash', transactionId: 'JC-GOLD-2001' }, D(2026, 9, 9));

  // SISP-40: Nine's first valid payment queues Eight's Rs 500 credit.
  const reconciled = reconcileReferralCredits(state, [], { now: D(2026, 9, 20) });
  let credits = reconciled.credits;

  // Vacation hold for Four covering October (PR #483 lineage).
  state = updateCustomerProfile(state, four.id, { paused: true, pauseStartDate: '2026-10-01', autoResumeDate: '2026-11-16' }, D(2026, 9, 28));

  // SISP-43 setup: Six's billed ticket (patch cord, Rs 500).
  let tickets = [];
  const ticket = createTicket({ customerId: six.id, customerName: 'Golden Six', technician: 'Saad', customFault: 'Golden patch cord damaged' }, tickets, D(2026, 9, 18));
  tickets = resolveTicket([ticket], ticket.id, { materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }], billingType: 'billed', referenceDate: D(2026, 9, 19) });

  // October cycle — the referral credit rides it.
  const octRun = runCycle('2026-10', OCT2, { referralCredits: credits });
  credits = applyReferralApplications(credits, octRun.referralApplications, '2026-10');

  pay(one.id, '2026-10', { date: '2026-10-07', amount: '3000', method: 'Cash at Waseem Abbasi shop' }, D(2026, 10, 7));
  pay(two.id, '2026-10', { date: '2026-10-09', amount: '1200', method: 'Easypaisa', transactionId: 'EP-GOLD-1002' }, D(2026, 10, 9));
  pay(two.id, '2026-10', { date: '2026-10-10', amount: '1000', method: 'Cash' }, D(2026, 10, 10));
  const twoOct = state.customers.find((c) => c.id === two.id).bills.find((b) => b.month === '2026-10');
  const voidTarget = twoOct.payments.find((p) => Number(p.amount) === 1000);
  const voided = voidPayment(state, two.id, '2026-10', voidTarget.id, { voidReason: 'Duplicate entry', voidedAt: '2026-10-12T10:00:00' });
  state = voided.state;

  const qc = executeQuickCollection(state, { customerId: six.id, month: '2026-10', amount: 3500, date: '2026-10-11', method: 'Cash', tickets }, D(2026, 10, 11));
  state = qc.nextState; tickets = qc.nextTickets;

  pay(eight.id, '2026-10', { date: '2026-10-13', amount: '2500', method: 'Cash' }, D(2026, 10, 13));

  // PR #488: One's advance for November, recorded 29 Oct.
  const adv = recordAdvancePayment(state, one.id, { amount: 3000, date: '2026-10-29', method: 'JazzCash', note: 'November paid early' }, D(2026, 10, 29));
  state = adv.nextState;

  // SISP-50: Ten disconnects; the deposit settles his arrears.
  state = archiveCustomer(state, ten.id, D(2026, 10, 20));
  const tenNow = state.customers.find((c) => c.id === ten.id);
  const allocBefore = calculatePaymentAllocations(state);
  const billBalances = tenNow.bills.map((b) => ({ month: b.month, balanceDue: (allocBefore.forMonth(ten.id, b.month)?.balanceDueCents ?? 0) / 100 }));
  const arrearsTen = billBalances.reduce((sum, row) => sum + row.balanceDue, 0);
  const settledTen = applyDepositSettlement(tenNow, arrearsTen, { date: '2026-10-20', billBalances, receiptNumber: 'DEP-GOLD-001' });
  state = { ...state, customers: state.customers.map((c) => (c.id === ten.id ? settledTen : c)) };

  // Expenses: one direct (phase3 addExpense) + the roznamcha mirror.
  state = addExpense(state, { date: '2026-10-03', category: 'Other expenses', amount: 4000, notes: 'Golden generator fuel' }, D(2026, 10, 3));
  let days = addRoznamchaOutflow([], '2026-10-05', { category: 'Fiber Splicing', amount: 1500, note: 'Golden pole repair' });
  const sync = syncRoznamchaExpenses(state.expenses, days, D(2026, 10, 31));
  state = { ...state, expenses: sync.expenses };

  // SISP-1 shop handovers (the real recorder stamps the receipts).
  let settlements = [];
  for (const [shop, amount, date] of [['Hassan Shop', 5000, '2026-09-25'], ['Balla Shop', 2500, '2026-09-28'], ['Waseem Abbasi Shop', 3000, '2026-10-20']]) {
    const res = applySettlement(state, shop, amount, date);
    state = res.state; settlements = [...settlements, res.settlement];
  }

  return { state, byNumber, tickets, settlements, days, credits, voidRecord: voided.voidRecord, syncResult: sync };
}

let goldenCache = null;
const golden = () => (goldenCache ??= buildGoldenFixture());

const customerOf = (state, number) => state.customers.find((c) => c.customerNumber === number);
const engineBalances = (state) => {
  const alloc = calculatePaymentAllocations(state);
  const perCustomer = new Map();
  let total = 0;
  for (const c of state.customers) {
    const perBill = {};
    let sum = 0;
    for (const b of c.bills) { perBill[b.month] = alloc.forMonth(c.id, b.month).balanceDueCents; sum += perBill[b.month]; }
    perCustomer.set(c.customerNumber, { perBill, totalCents: sum });
    total += sum;
  }
  return { alloc, perCustomer, totalCents: total };
};

/* ================= 0. Coverage: every spec item exists + exercised == */
test('SISP-200 coverage: all spec features exist on main and are exercised by the fixture', () => {
  const { state, tickets, settlements, days, credits, syncResult } = golden();
  assert.equal(state.customers.length, 10);
  assert.deepEqual([...new Set(state.customers.map((c) => c.mohalla))].sort(), ['BARRIAN', 'CHAMYAAA', 'GANGALL']);
  // The three shop methods are core's own recorded constants.
  for (const method of ['Cash at Waseem Abbasi shop', 'Cash at Hassan shop', 'Cash at Balla shop']) {
    assert.ok(PAYMENT_METHODS.includes(method), `PAYMENT_METHODS carries ${method}`);
  }
  const cust = (n) => customerOf(state, n);
  // FREE connection: flagged, and the generators never billed it.
  assert.equal(cust(3).isFreeConnection, true);
  assert.equal(cust(3).bills.length, 0);
  // Vacation hold: October skipped and recorded; hold reads active mid-October.
  assert.deepEqual(cust(4).pauseSkippedMonths, ['2026-10']);
  assert.equal(cust(4).bills.some((b) => b.month === '2026-10'), false);
  assert.equal(vacationHoldState(cust(4), '2026-10-15'), 'active');
  // Hardware kist: both bills carry the 2,000 kist line; plan advanced twice.
  for (const month of ['2026-09', '2026-10']) {
    const bill = cust(5).bills.find((b) => b.month === month);
    assert.equal(bill.kistTotal, 2000);
    assert.equal(bill.dueAmount, 5000);
  }
  assert.equal(cust(5).installmentPlans[0].monthsBilled, 2);
  // Billed ticket charge: settled inside the Quick Collect payment.
  const sixOct = cust(6).bills.find((b) => b.month === '2026-10');
  const qcPayment = sixOct.payments.find((p) => Number(p.amount) === 3500);
  assert.deepEqual(qcPayment.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  assert.equal(tickets[0].chargePaid, true);
  assert.equal(tickets[0].chargePaymentId, qcPayment.id);
  assert.equal(billedTicketChargesPending(tickets, cust(6).id), 0);
  // Outage concession stamp (SISP-30).
  assert.equal(cust(7).bills.find((b) => b.month === '2026-09').concessionAmount, 500);
  // Referral credit (SISP-40): queued by Nine's first payment, applied
  // to Eight's October bill by the cycle, queue entry consumed.
  assert.equal(cust(8).bills.find((b) => b.month === '2026-10').referralCreditAmount, 500);
  assert.equal(credits.length, 1);
  assert.equal(credits[0].referralId, 'REF-101');
  assert.equal(credits[0].status, 'applied');
  assert.equal(credits[0].appliedAmount, 500);
  // Advance payment (PR #488): tagged record rides One's October bill.
  const advPayment = cust(1).bills.find((b) => b.month === '2026-10').payments.find((p) => p.kind === 'advance');
  assert.ok(advPayment);
  assert.equal(advanceBalanceCents(state, cust(1).id), 300000);
  // Security deposit offset (SISP-50): settlement record + bill stamps.
  const settlement = depositSettlementOf(cust(10));
  assert.deepEqual(settlement.offsets, [{ month: '2026-09', amount: 3000 }, { month: '2026-10', amount: 2000 }]);
  assert.equal(settlement.arrearsRemaining, 1000);
  assert.equal(settlement.refundAmount, 0);
  assert.equal(cust(10).securityDeposit, 0);
  assert.equal(cust(10).bills.find((b) => b.month === '2026-09').depositOffsetAmount, 3000);
  assert.equal(cust(10).bills.find((b) => b.month === '2026-10').depositOffsetAmount, 2000);
  // Easypaisa TID (SISP-21): wallet receipts carry their transaction ids.
  const twoSep = cust(2).bills.find((b) => b.month === '2026-09').payments[0];
  assert.equal(twoSep.method, 'Easypaisa');
  assert.equal(twoSep.transactionId, 'EP-GOLD-1001');
  // Roznamcha expense mirror (PR #481): the outflow exists in the day
  // ledger AND as a synced expense, linked by the deterministic id.
  assert.equal(syncResult.added, 1);
  const outflow = days[0].outflows[0];
  const mirror = state.expenses.find((e) => e.roznamchaEntryId === outflow.id);
  assert.ok(mirror, 'roznamcha outflow mirrored into Expenses');
  assert.equal(mirror.amount, 1500);
  assert.equal(mirror.category, 'Cable'); // ROZNAMCHA_EXPENSE_CATEGORY_MAP: Fiber Splicing → Cable
  assert.equal(mirror.date, '2026-10-05');
  const dayView = buildRoznamchaDay(state, days, '2026-10-05', settlements);
  assert.equal(dayView.outTotal, 1500);
  // Shop settlements (SISP-1): all three shops settled, receipts stamped.
  assert.deepEqual(settlements.map((s) => [s.shop, s.amount]), [['Hassan Balla Shop', 5000], ['Hassan Balla Shop', 2500], ['Waseem Abbasi Shop', 3000]]);
  const stamped = (n, month) => customerOf(state, n).bills.find((b) => b.month === month).payments[0];
  assert.equal(stamped(5, '2026-09').shopSettledAmount, 5000);
  assert.equal(stamped(7, '2026-09').shopSettledAmount, 2500);
  assert.equal(stamped(1, '2026-10').shopSettledAmount, 3000);
});

/* ================= 1. Golden table vs the core engine ================ */
test('SISP-200 engine: calculatePaymentAllocations matches the golden table to the cent', () => {
  const { state } = golden();
  const { alloc, perCustomer, totalCents } = engineBalances(state);
  for (const [number, months] of Object.entries(GOLDEN_BALANCES_CENTS)) {
    assert.deepEqual(perCustomer.get(Number(number)).perBill, months, `customer #${number} per-bill balances`);
  }
  assert.equal(totalCents, GOLDEN_TOTAL_BALANCE_CENTS);
  // One's advance waits as pending credit on the October summary —
  // it is NOT arrears and NOT applied to the settled October bill.
  const oneOct = alloc.forMonth(customerOf(state, 1).id, '2026-10');
  assert.equal(oneOct.pendingCreditCents, 300000);
  assert.equal(oneOct.balanceDueCents, 0);
  // Billing-cycle view of November: arrears + advance agree per customer.
  let arrearsSum = 0; let advanceSum = 0;
  for (const c of state.customers) {
    const view = arrearsAndAdvance(c, '2026-11');
    assert.equal(view.previousArrears, GOLDEN_ARREARS_NOV[c.customerNumber] ?? 0, `#${c.customerNumber} Nov arrears`);
    assert.equal(view.advanceCredit, GOLDEN_ADVANCE_NOV[c.customerNumber] ?? 0, `#${c.customerNumber} Nov advance`);
    arrearsSum += view.previousArrears; advanceSum += view.advanceCredit;
  }
  assert.equal(cents(arrearsSum), GOLDEN_TOTAL_BALANCE_CENTS);
  assert.equal(advanceSum, 3000);
});

/* ================= 2. Engine ↔ Khata Doctor ========================== */
test('SISP-200 doctor: Khata Doctor agrees with the engine and reports a healthy ledger', () => {
  const { state, settlements, voidRecord } = golden();
  const { perCustomer, totalCents } = engineBalances(state);
  // Component-level agreement per customer (the Doctor's own ledger walk).
  for (const c of state.customers) {
    const ledger = computeLedgerBalance(c);
    assert.equal(ledger.balanceCents, perCustomer.get(c.customerNumber).totalCents, `#${c.customerNumber} doctor balance == engine`);
  }
  const one = computeLedgerBalance(customerOf(state, 1));
  assert.equal(one.creditCents, 300000, 'advance held as credit, exactly the engine pending credit');
  const six = computeLedgerBalance(customerOf(state, 6));
  assert.equal(six.balanceCents, 0);
  assert.equal(six.creditCents, 0, 'the ticket-charge portion of a receipt never leaks into bill credit');
  assert.equal(computeLedgerBalance(customerOf(state, 7)).concessionsCents, 50000);
  assert.equal(computeLedgerBalance(customerOf(state, 8)).referralCreditsCents, 50000);
  assert.equal(computeLedgerBalance(customerOf(state, 10)).depositOffsetsCents, 500000);
  // Full run with the app's own side inputs + a fresh verified cache:
  // a healthy golden ledger produces ZERO issues of any severity.
  const doctor = runKhataDoctor(state, {
    settlements, voidPayments: [voidRecord], cache: buildKhataDoctorCache(state, NOV2)
  });
  assert.equal(doctor.healthy, true);
  assert.deepEqual(doctor.summary, {
    customersChecked: 10, errors: 0, warnings: 0, infos: 0, repairable: 0,
    totalLedgerBalanceCents: GOLDEN_TOTAL_BALANCE_CENTS
  });
  assert.equal(doctor.summary.totalLedgerBalanceCents, totalCents);
  for (const row of doctor.customers) {
    assert.deepEqual(row.issues, [], `#${row.customerNumber} has zero doctor issues`);
    assert.equal(row.ledgerBalanceCents, perCustomer.get(row.customerNumber).totalCents);
    assert.equal(row.cacheStale, false);
  }
});

/* ================= 3. Engine ↔ Billing Register ====================== */
test('SISP-200 register: every row and total equals the engine derivation', () => {
  const { state } = golden();
  const { alloc } = engineBalances(state);
  for (const [month, period] of [['2026-10', 'this'], ['2026-09', 'last']]) {
    const register = buildBillingRegister(state, { period, status: 'all', currentMonth: '2026-10' });
    const expected = GOLDEN_REGISTER[month];
    assert.deepEqual(register.totals, expected.totals, `${month} totals`);
    assert.deepEqual(
      register.rows.map((r) => [r.customerNumber, r.status, r.billAmount, r.paidAmount, r.balanceDue]),
      expected.rows,
      `${month} rows`
    );
    // Cross-check each row against the engine directly (not just the table).
    for (const row of register.rows) {
      const summary = alloc.forMonth(customerOf(state, row.customerNumber).id, month);
      assert.equal(cents(row.billAmount), summary.billAmountCents);
      assert.equal(cents(row.balanceDue), summary.balanceDueCents);
      assert.equal(cents(row.paidAmount), summary.billAmountCents - summary.balanceDueCents);
    }
  }
  // Default view (Paid only) shows exactly the settled October bills —
  // the voided-only money never makes Two's bill read as paid.
  const paidOnly = buildBillingRegister(state, { period: 'this', status: 'paid', currentMonth: '2026-10' });
  assert.deepEqual(paidOnly.rows.map((r) => r.customerNumber), [1, 6, 8]);
});

/* ================= 4. Records ↔ Owner Khata (+ FU4 pin) ============== */
test('SISP-200 owner khata: month figures equal the underlying records (FU4 delta flipped to zero)', () => {
  const { state, settlements, days } = golden();
  const { perCustomer } = engineBalances(state);
  for (const month of ['2026-09', '2026-10']) {
    const report = buildOwnerKhataReport(state, month, { settlements, roznamchaDays: days, referenceDate: NOV2 });
    const expected = GOLDEN_KHATA[month];
    assert.equal(report.collected, expected.collected, `${month} collected`);
    assert.equal(report.receiptCount, expected.receiptCount, `${month} receiptCount`);
    assert.equal(report.expenses, expected.expenses, `${month} expenses`);
    assert.equal(report.profit, expected.profit, `${month} profit`);
    assert.equal(report.nasirShare, expected.nasirShare, `${month} Nasir share`);
    assert.equal(report.aqibShare, expected.aqibShare, `${month} Aqib share`);
    assert.equal(report.shopSettled, expected.shopSettled, `${month} shop settled`);
    assert.deepEqual(report.collectionChannels, expected.channels, `${month} channel split`);
    // The channel split always sums to collected (the surface's own rule).
    assert.equal(report.collectionChannels.reduce((sum, c) => sum + c.amount, 0), report.collected);
    assert.equal(report.closingCashInHand.balance, expected.closingBalance, `${month} roznamcha closing`);
    assert.equal(report.arrearsBillCount, expected.arrearsBillCount, `${month} arrears bill count`);
    // FU4 PIN (flipped at reconciliation — FU4 has merged): collected
    // now equals the valid receipts EXACTLY; the known delta is zero
    // in both months. Before FU4, October's delta was Rs 1,000 + 1
    // receipt (the voided duplicate counted as income).
    assert.equal(report.collected - GOLDEN_VALID_RECEIPTS[month].total, FU4_KNOWN_DELTA[month].amount, `${month} FU4 collected delta`);
    assert.equal(report.receiptCount - GOLDEN_VALID_RECEIPTS[month].count, FU4_KNOWN_DELTA[month].count, `${month} FU4 count delta`);
    // Arrears bridge: the month-end snapshot equals the engine balance
    // scoped to bills ≤ month, plus the pinned waiver/voided bridge.
    const engineScoped = [...perCustomer.values()]
      .reduce((sum, entry) => sum + Object.entries(entry.perBill)
        .filter(([billMonth]) => billMonth <= month)
        .reduce((s, [, v]) => s + v, 0), 0);
    const bridge = ARREARS_BRIDGE[month];
    assert.equal(cents(report.pendingArrears), engineScoped + bridge.waiversCents - bridge.voidedAppliedCents, `${month} arrears bridge`);
    // And the report faithfully reuses outstandingAtMonthEnd (its contract).
    assert.equal(report.pendingArrears, outstandingAtMonthEnd(state, month, NOV2).total);
  }
  // Drawer reconciliation across the two months (roznamcha's own math,
  // void-aware): Sep closing = Sep direct cash + Sep handovers;
  // Oct closing = Sep closing + Oct direct cash (void excluded) +
  // Oct handovers − Oct outflows.
  assert.equal(GOLDEN_KHATA['2026-09'].closingBalance, 11500 + 7500);
  assert.equal(GOLDEN_KHATA['2026-10'].closingBalance, 19000 + 6000 + 3000 - 1500);
});

/* ============ 5. Backup round-trip + checksum + branch guard ======== */
test('SISP-200 backup: round-trip restores identical figures (golden state — FU5 fixed the referral restore defect)', () => {
  const fx = golden();
  const guardState = fx.state;
  let seq = 0;
  const guard = createBranchGuard({ idFactory: () => `guard-golden-${++seq}`, now: NOV2 });
  const stamp = createBranchGuardStamp(guard, guardState, NOV2);
  assert.equal(stamp.fingerprint, fingerprintState(guardState));
  const guardAfter = recordBranchGuardExport(guard, stamp, NOV2);

  const backup = createJsonBackup(guardState, NOV2, { branchGuard: stamp, shopSettlements: fx.settlements, roznamchaDays: fx.days });
  const document = JSON.parse(backup);
  assert.match(document.checksum, /^crc32:[0-9a-f]{8}$/);

  const preview = previewJsonBackupMerge(createInitialState(), backup, { currentBranchGuard: guardAfter });
  assert.equal(preview.checksumStatus, 'verified');
  assert.deepEqual(preview.conflicts, []);
  assert.equal(preview.counts.addedCustomers, 10);
  assert.equal(preview.counts.addedBills, 17);
  assert.equal(preview.counts.addedPayments, 14);
  // Restoring this device's own export into an empty device adopts the
  // lineage — never blocked, no override required.
  assert.equal(preview.branchGuard.status, 'adopt');
  assert.equal(preview.branchGuard.blocked, false);
  // The guard's own classification of the golden stamp against the
  // golden state: same point in the same lineage.
  assert.deepEqual(
    classifyBranchGuardRestore({ guard: guardAfter, stamp, localCustomerCount: 10, localFingerprint: fingerprintState(guardState) }),
    { status: 'same-point', blocked: false, requiresOverride: false, silent: true }
  );
  // Re-derived figures from the restored state are IDENTICAL.
  const restored = preview.state;
  // The fingerprint comparison first normalizes the restore-side
  // default fills: restore runs every customer through the shipped
  // sanitizer, which fills fields the fixture's write paths never set
  // with their defaults (SISP-138 lastContactedAt/lastContactChannel
  // -> null; signalReadings -> []). Probe-verified: those 30 default
  // fills (3 fields x 10 customers) are the ONLY differences between
  // the golden and restored states — absent and explicit-default are
  // the same record, so exactly those fields are dropped on BOTH
  // sides when they hold a default value; everything else must match
  // byte-for-byte.
  const normalizeRestoreDefaults = (s) => {
    const clone = JSON.parse(JSON.stringify(s));
    for (const c of clone.customers ?? []) {
      if (c.lastContactedAt == null) delete c.lastContactedAt;
      if (c.lastContactChannel == null) delete c.lastContactChannel;
      if (Array.isArray(c.signalReadings) && c.signalReadings.length === 0) delete c.signalReadings;
    }
    return clone;
  };
  assert.equal(fingerprintState(normalizeRestoreDefaults(restored)), fingerprintState(normalizeRestoreDefaults(guardState)));
  assert.equal(engineBalances(restored).totalCents, GOLDEN_TOTAL_BALANCE_CENTS);
  assert.equal(engineBalances(restored).totalCents, engineBalances(guardState).totalCents);
  const doctor = runKhataDoctor(restored, {
    settlements: fx.settlements, voidPayments: [fx.voidRecord], cache: buildKhataDoctorCache(restored, NOV2)
  });
  assert.equal(doctor.healthy, true);
  assert.equal(doctor.summary.totalLedgerBalanceCents, GOLDEN_TOTAL_BALANCE_CENTS);
  // Checksum verification catches tampering and blocks the apply.
  const tampered = previewJsonBackupMerge(createInitialState(), backup.replace('Golden One', 'Golden Onf'), {});
  assert.equal(tampered.checksumStatus, 'mismatch');
  assert.equal(tampered.canApply, false);
});

/* ===== 6. FU5 FIX: the golden backup restores (defect flipped) ===== */
test('SISP-200 FU5 fix: a referral-stamped bill no longer makes the golden backup unrestorable', () => {
  const { state, settlements, days } = golden();
  const backup = createJsonBackup(state, NOV2, { shopSettlements: settlements, roznamchaDays: days });
  // Export side is healthy: the document is created and checksummed.
  assert.match(JSON.parse(backup).checksum, /^crc32:[0-9a-f]{8}$/);
  // WAS a known defect at build time (see header): restore validation
  // rejected the cycle-stamped referral bill's ISO-format
  // amountHistory changedAt. FU5 (296919e3) switched withReferralCredit
  // to localDateTimeValue stamps, so the golden backup — referral
  // stamp included — now restores cleanly. This block certifies the
  // fix: if the defect ever returns, these assertions fail loudly.
  const preview = previewJsonBackupMerge(createInitialState(), backup, {});
  assert.equal(preview.checksumStatus, 'verified');
  assert.deepEqual(preview.conflicts, []);
  const restoredEight = preview.state.customers.find((c) => c.customerNumber === 8);
  assert.equal(restoredEight.bills.find((b) => b.month === '2026-10').referralCreditAmount, 500);
  assert.equal(engineBalances(preview.state).totalCents, GOLDEN_TOTAL_BALANCE_CENTS);
  // The branch guard itself was never the blocker: its classification
  // of the golden stamp against the golden state is the benign verdict.
  let seq = 0;
  const guard = createBranchGuard({ idFactory: () => `guard-defect-${++seq}`, now: NOV2 });
  const stamp = createBranchGuardStamp(guard, state, NOV2);
  const guardAfter = recordBranchGuardExport(guard, stamp, NOV2);
  assert.equal(
    classifyBranchGuardRestore({ guard: guardAfter, stamp, localCustomerCount: 10, localFingerprint: fingerprintState(state) }).status,
    'same-point'
  );
  // Minimal repro (2 customers, referral only): the same cycle-stamped
  // referral bill that used to make the backup unrestorable now
  // restores with its credit intact — the defect needed nothing else
  // from the fixture, and neither does the fix.
  let s = createInitialState();
  s = addCustomer(s, 'Repro Referrer', SEP1, { mohalla: 'Gangall' });
  const referrer = s.customers[0];
  s = addCustomer(s, 'Repro Referred', SEP1, { mohalla: 'Gangall', referredByCustomerId: referrer.id });
  const referred = s.customers[1];
  s = updateCustomerProfile(s, referrer.id, { monthlySellingAmount: '3000' }, SEP1);
  s = updateCustomerProfile(s, referred.id, { monthlySellingAmount: '2000' }, SEP1);
  let cycles = [];
  let run = runBillingCycle(s, '2026-09', cycles, D(2026, 9, 2)); s = run.state; cycles = [...cycles, run.cycle];
  s = addPayment(s, referred.id, '2026-09', { date: '2026-09-09', amount: '2000', method: 'Cash' }, D(2026, 9, 9));
  const rec = reconcileReferralCredits(s, [], { now: D(2026, 9, 20) });
  run = runBillingCycle(s, '2026-10', cycles, OCT2, { referralCredits: rec.credits }); s = run.state;
  const stampedBill = s.customers[0].bills.find((b) => b.month === '2026-10');
  assert.equal(stampedBill.referralCreditAmount, 500);
  const reproPreview = previewJsonBackupMerge(createInitialState(), createJsonBackup(s, NOV2), {});
  assert.equal(reproPreview.checksumStatus, 'verified');
  assert.equal(
    reproPreview.state.customers[0].bills.find((b) => b.month === '2026-10').referralCreditAmount,
    500
  );
});
