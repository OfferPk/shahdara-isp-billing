import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPaymentReceipt } from '../receipt.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { buildArrearsBreakdown } from '../billing-cycle.js';
import { listTransactions, autoPackageRollbackOf } from '../core.js';
import { waivedLateFeeStampFor } from '../late-fee-waiver.js';

// Plan 562 — All three draft call sites pass the full receipt snapshot.
//
// The defect: createReceiptWhatsAppDraft only prints the lines the
// caller attached, and the three call sites attached different subsets.
// The profile-history caller attached everything except status, voided
// and autoPackage; the Transactions-list caller attached only bill
// amount, balance, ticket charges, tax, area, advance credit, waived
// amount and arrears — no FIFO, no contributor split, no previous
// payments, no autoPackage — and it spread the row in, so the bill's
// lowercase status leaked into the draft as `status`; the dashboard
// Recent Payments caller attached arrears, FIFO, ticket charges, tax
// and area — no advance credit, no waived amount, no contributor
// split, no previous payments, no autoPackage — and neither status
// nor voided. Same payment, three different WhatsApp texts.
//
// The fix (app.js call sites only): every site passes the full
// buildPaymentReceipt snapshot — status and voided included — plus the
// autoPackage follow recovered from the validated rollback stamp
// (core.js autoPackageRollbackOf) where the follow fired, fee only
// (the label is not stored on the payment) and never for a voided
// payment, whose follow was rolled back. The profile share-draft
// helper (profileShareDraftReceiptInput) carries status + voided too,
// so the record-time share path stops leaving Plan 561's known
// limitation open: a voided payment on an already-covered bill via a
// caller passing neither status nor voided read CREDIT RECEIVED.
//
// How this is tested: app.js is not importable in node tests (DOM at
// module top level), so the wiring is pinned by source assertions on
// app.js — those FAIL on the pristine base and pass after the fix —
// and the identity property is pinned by behaviour tests that build
// the three inputs with builders mirroring the fixed production
// shapes (the same pattern Plan 561's draftInput uses). The identity
// tests pass on the pristine base too — they pin what the fixed
// shapes must produce; the wiring tests are what tie those shapes
// to production. The pre-fix divergences were confirmed live by a
// probe before writing the tests: the Transactions shape drafted a
// CREDIT RECEIVED payment as "Status: PAID" (the lowercase bill
// status leak), the dashboard shape drafted a voided payment on an
// already-covered bill as "Status: CREDIT RECEIVED" with an
// Outstanding line, and the dashboard shape dropped the history and
// waived lines a rich partial draft carries.

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const PHONE = '+92 300 123 4567'; // pattern-fake, same as the Plan 561 tests
const pay = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

function fixture({ dueAmount = 2000, payments = [], month = '2026-08', extraCustomer = {} } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', bills: [bill], ...extraCustomer };
  return { customer, bill };
}
const draft = (input) => createReceiptWhatsAppDraft(PHONE, input);
const mappedBillStatus = (receipt) => (receipt.status === 'PAID' ? 'paid' : receipt.status === 'PARTIAL' ? 'partial' : null);

// The package follow this payment triggered, recovered from the
// validated rollback stamp — the production helper's shape, mirrored
// here (fee only, never for a voided payment).
const autoPackageFieldForDraft = (payment) => {
  if (payment?.voided === true) return {};
  const stamp = autoPackageRollbackOf(payment);
  if (!stamp) return {};
  return { autoPackage: { fee: Number(stamp.fee) } };
};
const followStamp = (fee) => ({ customer: { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer' }, fee });

// The three call sites' draft inputs, mirroring the fixed production
// shapes (customerName/customerNumber are what
// resolveReceiptWhatsAppAction attaches from the customer record).
const profileHistoryInput = (customer, bill, payment, receipt) => ({
  customerName: customer.name, customerNumber: customer.customerNumber,
  customerId: customer.id, date: payment.date, amount: payment.amount, method: payment.method,
  paidBy: payment.paidBy, month: bill.month, paymentId: payment.id,
  billStatus: mappedBillStatus(receipt), status: receipt.status, voided: payment.voided === true,
  billAmount: receipt.nominalPrice, balanceDueCents: receipt.balanceDueCents, billDueDate: bill?.dueDate ?? null,
  arrearsBreakdown: buildArrearsBreakdown(customer, bill),
  fifoAllocation: receipt.fifoAllocation, fifoRemaining: receipt.fifoRemaining, fifoShow: receipt.fifoShow,
  ticketCharges: receipt.ticketCharges, salesTaxCents: receipt.salesTaxCents, area: receipt.area,
  advanceCredit: receipt.advanceCredit, contributorSplit: receipt.contributorSplit,
  waivedAmount: receipt.waivedAmount, previousPayments: receipt.previousPayments,
  ...autoPackageFieldForDraft(payment)
});
const transactionsInput = (state, customer, bill, payment, receipt) => {
  const row = listTransactions(state).find((t) => t.paymentId === payment.id);
  const savedPayment = payment;
  return {
    ...row,
    customerName: customer.name, customerNumber: customer.customerNumber,
    billStatus: mappedBillStatus(receipt), status: receipt?.status ?? null,
    billAmount: receipt?.nominalPrice ?? null, balanceDueCents: receipt?.balanceDueCents ?? null,
    ticketCharges: receipt?.ticketCharges ?? [], salesTaxCents: receipt?.salesTaxCents ?? null,
    area: receipt?.area ?? null, advanceCredit: receipt?.advanceCredit ?? null,
    waivedAmount: receipt?.waivedAmount ?? 0,
    fifoAllocation: receipt?.fifoAllocation ?? null, fifoRemaining: receipt?.fifoRemaining ?? null,
    fifoShow: receipt?.fifoShow ?? false, contributorSplit: receipt?.contributorSplit ?? null,
    previousPayments: receipt?.previousPayments ?? [],
    arrearsBreakdown: buildArrearsBreakdown(customer, bill),
    ...autoPackageFieldForDraft(savedPayment)
  };
};
const dashboardInput = (customer, bill, payment, receipt) => ({
  customerName: customer.name, customerNumber: customer.customerNumber,
  customerId: customer.id, date: payment.date, amount: payment.amount, method: payment.method,
  paidBy: payment.paidBy, month: bill.month, paymentId: payment.id,
  billStatus: mappedBillStatus(receipt), status: receipt.status, voided: payment.voided === true,
  billAmount: receipt.nominalPrice, balanceDueCents: receipt.balanceDueCents, billDueDate: bill?.dueDate ?? null,
  arrearsBreakdown: buildArrearsBreakdown(customer, bill),
  fifoAllocation: receipt.fifoAllocation, fifoRemaining: receipt.fifoRemaining, fifoShow: receipt.fifoShow,
  ticketCharges: receipt.ticketCharges, salesTaxCents: receipt.salesTaxCents, area: receipt.area,
  advanceCredit: receipt.advanceCredit, contributorSplit: receipt.contributorSplit,
  waivedAmount: receipt.waivedAmount, previousPayments: receipt.previousPayments,
  ...autoPackageFieldForDraft(payment)
});
// The profile share-draft helper's shape (record-time path): the full
// snapshot plus the follow note the record-time target carries.
const shareDraftInput = (customer, bill, payment, receipt, autoPackage = null) => ({
  customerName: customer.name, customerNumber: customer.customerNumber,
  id: payment.id, customerId: customer.id, date: payment.date, amount: payment.amount,
  method: payment.method, paidBy: payment.paidBy, month: bill.month, paymentId: payment.id,
  billStatus: mappedBillStatus(receipt), status: receipt.status, voided: payment.voided === true,
  billAmount: receipt.nominalPrice, balanceDueCents: receipt.balanceDueCents, billDueDate: bill?.dueDate ?? null,
  arrearsBreakdown: buildArrearsBreakdown(customer, bill),
  fifoAllocation: receipt.fifoAllocation, fifoRemaining: receipt.fifoRemaining, fifoShow: receipt.fifoShow,
  ticketCharges: receipt.ticketCharges, salesTaxCents: receipt.salesTaxCents, area: receipt.area,
  advanceCredit: receipt.advanceCredit, contributorSplit: receipt.contributorSplit,
  waivedAmount: receipt.waivedAmount, previousPayments: receipt.previousPayments,
  ...(autoPackage ? { autoPackage } : {})
});
const threeMessages = (customer, bill, payment, receipt) => {
  const state = { customers: [customer] };
  return {
    history: draft(profileHistoryInput(customer, bill, payment, receipt)).message,
    transactions: draft(transactionsInput(state, customer, bill, payment, receipt)).message,
    dashboard: draft(dashboardInput(customer, bill, payment, receipt)).message
  };
};

// --- Wiring: the production call sites pass the full snapshot. ---
// (These fail on the pristine base — app.js is not importable, so the
// wiring is pinned by source assertion, the repo's established pattern
// for app.js call-site work; see polish11-sales-tax.test.js.)

test('plan562 wiring: profileShareDraftReceiptInput carries status and voided', () => {
  const start = appSrc.indexOf('function profileShareDraftReceiptInput');
  const end = appSrc.indexOf('function renderProfileShareDraft', start);
  const body = appSrc.slice(start, end);
  assert.ok(body.includes('status: receiptData.status'), 'the helper passes the receipt status through');
  assert.ok(body.includes('voided: payment.voided === true'), 'the helper passes the voided flag through');
});

test('plan562 wiring: the profile-history caller passes status, voided and the follow field', () => {
  // The history row's call is the spaceless one (dashboard's has spaces).
  const start = appSrc.indexOf('receiptWhatsAppActionMarkup(customer, { customerId:customer.id, date:payment.date');
  assert.ok(start >= 0, 'the profile-history call site exists');
  const body = appSrc.slice(start, start + 1400);
  assert.ok(body.includes('status:receiptData.status'), 'history passes the receipt status');
  assert.ok(body.includes('voided:payment.voided === true'), 'history passes the voided flag');
  assert.ok(body.includes('...autoPackageFieldForDraft(payment)'), 'history derives the follow field from the rollback stamp');
});

test('plan562 wiring: the Transactions caller passes the receipt status and the missing snapshot fields', () => {
  const start = appSrc.indexOf('receiptWhatsAppActionMarkup(customer, { ...transaction, billStatus:receiptBillStatus');
  assert.ok(start >= 0, 'the Transactions call site exists');
  const body = appSrc.slice(start, start + 1200);
  // After the spread, so it overrides the row's lowercase bill status.
  assert.ok(body.includes('status: receiptData?.status ?? null'), 'Transactions passes the receipt status (overriding the bill status leak)');
  assert.ok(body.includes('fifoAllocation: receiptData?.fifoAllocation'), 'Transactions passes the FIFO allocation');
  assert.ok(body.includes('fifoRemaining: receiptData?.fifoRemaining'), 'Transactions passes the FIFO remaining split');
  assert.ok(body.includes('fifoShow: receiptData?.fifoShow'), 'Transactions passes the FIFO show flag');
  assert.ok(body.includes('contributorSplit: receiptData?.contributorSplit'), 'Transactions passes the contributor split');
  assert.ok(body.includes('previousPayments: receiptData?.previousPayments'), 'Transactions passes the previous payments');
  assert.ok(body.includes('...autoPackageFieldForDraft(savedPayment)'), 'Transactions derives the follow field from the rollback stamp');
  // The voided flag already rides the spread row (listTransactions
  // stamps voided: payment.voided === true) — pin that it is not
  // clobbered by a later explicit field.
  assert.ok(!body.includes('voided: savedPayment'), 'Transactions does not override the spread voided flag');
});

test('plan562 wiring: the dashboard Recent Payments caller passes the full snapshot', () => {
  const start = appSrc.indexOf('function recentPaymentActionsMarkup');
  const end = appSrc.indexOf('function renderPowerBackupDashboard', start);
  const body = appSrc.slice(start, end);
  assert.ok(body.includes('status: receiptData.status'), 'dashboard passes the receipt status');
  assert.ok(body.includes('voided: payment.voided === true'), 'dashboard passes the voided flag');
  assert.ok(body.includes('advanceCredit: receiptData.advanceCredit'), 'dashboard passes the advance credit');
  assert.ok(body.includes('contributorSplit: receiptData.contributorSplit'), 'dashboard passes the contributor split');
  assert.ok(body.includes('waivedAmount: receiptData.waivedAmount'), 'dashboard passes the waived amount');
  assert.ok(body.includes('previousPayments: receiptData.previousPayments'), 'dashboard passes the previous payments');
  assert.ok(body.includes('...autoPackageFieldForDraft(payment)'), 'dashboard derives the follow field from the rollback stamp');
});

test('plan562 wiring: the follow field is derived from the validated rollback stamp', () => {
  assert.ok(appSrc.includes('autoPackageRollbackOf'), 'app.js reads the rollback stamp through the validated reader');
  const start = appSrc.indexOf('function autoPackageFieldForDraft');
  assert.ok(start >= 0, 'the draft follow-field helper exists');
  const body = appSrc.slice(start, appSrc.indexOf('function profileShareDraftReceiptInput', start));
  assert.ok(body.includes('autoPackageRollbackOf(payment)'), 'the helper reads the stamp through autoPackageRollbackOf');
  assert.ok(body.includes("payment?.voided === true"), 'the helper never derives a follow for a voided payment');
  assert.ok(body.includes('fee: Number(stamp.fee)'), 'the helper carries the stamp fee (no label is stored)');
});

// --- Identity: one payment, one draft text, whichever screen opened it. ---

test('plan562: a paid payment drafts identically from all three call sites', () => {
  const paid = pay('id-paid', 2000, '2026-08-05');
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.status, 'PAID');
  const { history, transactions, dashboard } = threeMessages(customer, bill, paid, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /✅ Status: PAID/);
  assert.match(history, /💵 Outstanding: PKR 0/);
});

test('plan562: a rich partial payment drafts identically, with every snapshot line', () => {
  // July partial leaves arrears (FIFO shows); the August payment is the
  // second on its bill (history shows); a contributor rides the bill;
  // the payment waived a late fee.
  const billJul = { id: 'bill-jul', month: '2026-07', dueAmount: 1000, status: 'pending', payments: [pay('rich-jul', 300, '2026-07-05')] };
  const billAug = { id: 'bill-aug', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [
    pay('rich-1', 300, '2026-08-05'),
    pay('rich-2', 400, '2026-08-06', { lateFeeWaived: true, waivedAmount: 50, waivedLateFee: waivedLateFeeStampFor({ month: '2026-08', lateFee: 50, lateFeeAppliedAt: '2026-08-04T00:00:00.000Z', lateFeeReason: 'Late fee' }) })
  ] };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', subContributors: [{ id: 'SC-1', name: 'Neighbour One', sharePKR: 500 }], bills: [billJul, billAug] };
  const receipt = buildPaymentReceipt(customer, billAug, billAug.payments[1]);
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.fifoShow, true, 'the fixture exercises FIFO');
  assert.ok(receipt.contributorSplit, 'the fixture exercises the contributor split');
  assert.equal(receipt.previousPayments.length, 2, 'the fixture exercises the history');
  assert.equal(receipt.waivedAmount, 50, 'the fixture exercises the waived amount');
  const { history, transactions, dashboard } = threeMessages(customer, billAug, billAug.payments[1], receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /💠 FIFO taqseem:/);
  assert.match(history, /🤝 Hissa taqseem \(bill split\):/);
  assert.match(history, /📜 Last 3 Payments/);
  assert.match(history, /🎟️ Late Fee Waived: -PKR 50/);
  assert.match(history, /🟠 Status: PARTIAL/);
  assert.match(history, /💵 Outstanding: PKR 1,300/);
});

test('plan562: a CREDIT RECEIVED payment drafts identically — and no longer as PAID on Transactions', () => {
  const first = pay('cr-first', 2000, '2026-08-05');
  const second = pay('cr-second', 500, '2026-08-06');
  const { customer, bill } = fixture({ payments: [first, second] });
  const receipt = buildPaymentReceipt(customer, bill, second);
  assert.equal(receipt.status, 'CREDIT RECEIVED');
  const { history, transactions, dashboard } = threeMessages(customer, bill, second, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /✅ Status: CREDIT RECEIVED/);
  assert.match(history, /Bill already covered before this payment — recorded as credit/);
  assert.doesNotMatch(history, /Status: PAID/);
});

test('plan562: a voided payment on an already-covered bill drafts VOID from every call site', () => {
  // Plan 561's known limitation: a voided payment on an already-covered
  // bill via a caller passing neither status nor voided read CREDIT
  // RECEIVED. The full snapshot removes the ambiguity — the explicit
  // status and voided flag travel with the draft input now.
  const first = pay('void-first', 2000, '2026-08-05');
  const voided = pay('void-second', 500, '2026-08-06', { voided: true });
  const { customer, bill } = fixture({ payments: [first, voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  assert.equal(receipt.status, 'VOID');
  const { history, transactions, dashboard } = threeMessages(customer, bill, voided, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /❌ Status: VOID/);
  assert.doesNotMatch(history, /Outstanding:/);
  assert.doesNotMatch(history, /Status: CREDIT RECEIVED/);
  // The share-draft path carries the same explicit fields now.
  const share = draft(shareDraftInput(customer, bill, voided, receipt)).message;
  assert.match(share, /❌ Status: VOID/);
  assert.doesNotMatch(share, /Status: CREDIT RECEIVED/);
});

test('plan562 pin: without status or voided, the same voided payment still reads CREDIT RECEIVED', () => {
  // Contrast pin: this is the ambiguity the full snapshot removes. It
  // passes before and after the fix — it documents why the fields
  // matter, it does not test the fixed wiring (the wiring tests do).
  const first = pay('pin-first', 2000, '2026-08-05');
  const voided = pay('pin-second', 500, '2026-08-06', { voided: true });
  const { customer, bill } = fixture({ payments: [first, voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  const bare = {
    customerName: customer.name, customerNumber: customer.customerNumber,
    amount: 500, date: '2026-08-06', method: 'Cash', month: '2026-08',
    billStatus: null, billAmount: receipt.nominalPrice, balanceDueCents: receipt.balanceDueCents
  };
  assert.match(draft(bare).message, /✅ Status: CREDIT RECEIVED/);
});

test('plan562: a RECEIVED payment (unpriced bill) drafts identically with no guessed outstanding', () => {
  const unknown = pay('recv-one', 100, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount: null, payments: [unknown] });
  const receipt = buildPaymentReceipt(customer, bill, unknown);
  assert.equal(receipt.status, 'RECEIVED');
  const { history, transactions, dashboard } = threeMessages(customer, bill, unknown, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /✅ Status: RECEIVED/);
  assert.match(history, /💵 Outstanding: Not available/);
  assert.doesNotMatch(history, /Outstanding: PKR/);
});

test('plan562: an advance-tagged payment drafts identically, advance line included', () => {
  const advance = pay('adv-one', 500, '2026-08-05', { kind: 'advance' });
  const { customer, bill } = fixture({ payments: [advance] });
  const receipt = buildPaymentReceipt(customer, bill, advance);
  assert.ok(receipt.advanceCredit, 'the fixture exercises the advance credit');
  const { history, transactions, dashboard } = threeMessages(customer, bill, advance, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /💎 Advance Credit Applied: PKR 0 • Remaining Advance Balance: PKR 0/);
});

test('plan562: a package-follow payment drafts identically, with the follow line from the stamp', () => {
  // The follow fired at record time and left its validated rollback
  // stamp on the payment; the three reprint paths recover the fee
  // from it (no label is stored, so the line carries the fee only).
  const followed = pay('follow-one', 1600, '2026-08-05', { autoPackageRollback: followStamp(1600) });
  const { customer, bill } = fixture({ dueAmount: 1600, payments: [followed] });
  const receipt = buildPaymentReceipt(customer, bill, followed);
  const { history, transactions, dashboard } = threeMessages(customer, bill, followed, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  // Plan 563: the profile draft's package line follows the receipt
  // language — the default (English) layout now reads English-only,
  // so the bilingual literal this test used to assert became the
  // Quick Collect bilingual entry. The parity intent is unchanged:
  // the follow line is present, identical on all three call sites,
  // with the fee from the stamp.
  assert.match(history, /📦 Package updated: PKR 1,600/);
  // The record-time share path carries the same line, with its label.
  const share = draft(shareDraftInput(customer, bill, followed, receipt, { fee: 1600, packageLabel: '5 Mbps' })).message;
  assert.match(share, /📦 Package updated: 5 Mbps — PKR 1,600/);
});

test('plan562: a voided follow payment carries no package line on any call site', () => {
  // Voiding rolls the follow back, so the package did not change — the
  // stamp must never resurrect the line on a voided payment's draft.
  const followed = pay('follow-void', 1600, '2026-08-05', { voided: true, autoPackageRollback: followStamp(1600) });
  const { customer, bill } = fixture({ dueAmount: 1600, payments: [followed] });
  const receipt = buildPaymentReceipt(customer, bill, followed);
  assert.equal(receipt.status, 'VOID');
  const { history, transactions, dashboard } = threeMessages(customer, bill, followed, receipt);
  assert.equal(transactions, history, 'Transactions matches profile history');
  assert.equal(dashboard, history, 'dashboard matches profile history');
  assert.match(history, /❌ Status: VOID/);
  assert.doesNotMatch(history, /Package updated/);
});
