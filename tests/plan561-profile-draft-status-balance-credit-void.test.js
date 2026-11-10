import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt } from '../receipt.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { receiptTermsNoteText } from '../receipt-terms.js';

// Plan 561 — Profile WhatsApp draft states status and balance for
// credit, received and void receipts.
//
// The defect: createReceiptWhatsAppDraft only appended its
// status/outstanding/next-bill block for billStatus 'paid' / 'partial'.
// Every production caller maps only PAID/PARTIAL into billStatus, so a
// CREDIT RECEIVED, RECEIVED or VOID receipt arrived as billStatus null
// and the draft printed amount + method + month and then nothing — no
// status, no outstanding figure, no next-bill date. The amount label
// also flipped ("Amount Paid" for paid, "Amount Received" for partial)
// for the same money, where the Quick Collect draft always says
// "Amount Received".
//
// The fix resolves the receipt status inside the draft: the receipt
// status first when the caller passed it (buildPaymentReceipt's
// uppercase vocabulary), else the voided flag, else the figures the
// draft already receives — only VOID can carry a positive balance with
// billStatus null, and only a covered bill can read balanceDueCents 0
// with billStatus null. A no-bill-context draft still shows a status
// line, with the outstanding stated as not derivable, never guessed.

function fixture({ dueAmount = 2000, payments = [], month = '2026-08' } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', bills: [bill] };
  return { customer, bill };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

// The draft input exactly as the production call sites build it: only
// PAID/PARTIAL map into billStatus; every other receipt status arrives
// as null, with the receipt's own figures.
const draftInput = (receipt, pay, extra = {}) => ({
  customerName: 'Synthetic Customer', customerNumber: 42, amount: pay.amount, date: pay.date, method: 'Cash', month: '2026-08',
  billStatus: receipt.status === 'PAID' ? 'paid' : receipt.status === 'PARTIAL' ? 'partial' : null,
  billAmount: receipt.nominalPrice, balanceDueCents: receipt.balanceDueCents, billDueDate: '2026-08-05',
  ...extra
});
const draft = (input, options) => createReceiptWhatsAppDraft('+92 300 123 4567', input, options);

// Pins: the receipt statuses the plan is about are stamped by
// buildPaymentReceipt exactly as the spec says, with the balances the
// draft derives from.
test('plan561 pin: buildPaymentReceipt stamps CREDIT RECEIVED, VOID and RECEIVED with their balances', () => {
  const first = payment('cr-first', 2000, '2026-08-05');
  const second = payment('cr-second', 500, '2026-08-06');
  const covered = fixture({ payments: [first, second] });
  const creditReceipt = buildPaymentReceipt(covered.customer, covered.bill, second);
  assert.equal(creditReceipt.status, 'CREDIT RECEIVED');
  assert.equal(creditReceipt.balanceDueCents, 0);

  const voided = payment('void-one', 300, '2026-08-05', { voided: true });
  const voidFixture = fixture({ payments: [voided] });
  const voidReceipt = buildPaymentReceipt(voidFixture.customer, voidFixture.bill, voided);
  assert.equal(voidReceipt.status, 'VOID');
  assert.equal(voidReceipt.balanceDueCents, 200000);

  const unknown = payment('recv-one', 100, '2026-08-12');
  const unknownFixture = fixture({ dueAmount: null, payments: [unknown] });
  const unknownReceipt = buildPaymentReceipt(unknownFixture.customer, unknownFixture.bill, unknown);
  assert.equal(unknownReceipt.status, 'RECEIVED');
  assert.equal(unknownReceipt.balanceDueCents, null);
});

// Pins: the paid and partial blocks are unchanged by Plan 561.
test('plan561 pin: paid and partial drafts still show their status blocks', () => {
  const paid = payment('pin-paid', 2000, '2026-08-05');
  const paidFixture = fixture({ payments: [paid] });
  const paidReceipt = buildPaymentReceipt(paidFixture.customer, paidFixture.bill, paid);
  assert.equal(paidReceipt.status, 'PAID');
  const paidDraft = draft(draftInput(paidReceipt, paid));
  assert.match(paidDraft.message, /✅ Status: PAID/);
  assert.match(paidDraft.message, /💵 Outstanding: PKR 0/);
  assert.match(paidDraft.message, /📅 Next Bill Due: Sep 5 2026/);

  const partial = payment('pin-partial', 300, '2026-08-05');
  const partialFixture = fixture({ payments: [partial] });
  const partialReceipt = buildPaymentReceipt(partialFixture.customer, partialFixture.bill, partial);
  assert.equal(partialReceipt.status, 'PARTIAL');
  const partialDraft = draft(draftInput(partialReceipt, partial));
  assert.match(partialDraft.message, /💰 Amount Received: PKR 300/);
  assert.match(partialDraft.message, /🟠 Status: PARTIAL/);
  assert.match(partialDraft.message, /💵 Outstanding: PKR 1,700/);
  assert.match(partialDraft.message, /📅 Current Bill Due: Aug 5 2026/);
});

test('plan561: a CREDIT RECEIVED draft shows its status and PKR 0 outstanding', () => {
  const first = payment('cr-first', 2000, '2026-08-05');
  const second = payment('cr-second', 500, '2026-08-06');
  const { customer, bill } = fixture({ payments: [first, second] });
  const receipt = buildPaymentReceipt(customer, bill, second);
  const message = draft(draftInput(receipt, second)).message;
  assert.match(message, /💰 Amount Received: PKR 500/);
  assert.match(message, /✅ Status: CREDIT RECEIVED/);
  assert.match(message, /💵 Outstanding: PKR 0/);
  assert.match(message, /Bill already covered before this payment — recorded as credit/);
  assert.match(message, /📅 Next Bill Due: Sep 5 2026/);
  assert.doesNotMatch(message, /Status: VOID|This payment was voided/);
});

test('plan561: a VOID draft says voided and shows no outstanding as if owed', () => {
  const voided = payment('void-one', 300, '2026-08-05', { voided: true });
  const { customer, bill } = fixture({ payments: [voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  const message = draft(draftInput(receipt, voided)).message;
  assert.match(message, /💰 Amount Received: PKR 300/);
  assert.match(message, /❌ Status: VOID/);
  assert.match(message, /This payment was voided and counts as no payment/);
  assert.doesNotMatch(message, /Outstanding:/);
  assert.doesNotMatch(message, /Next Bill Due:|Current Bill Due:|Please pay by the 5th/);
  assert.ok(message.includes(receiptTermsNoteText()), 'the terms note still rides the void draft');
});

test('plan561: a RECEIVED draft shows its status and states the outstanding as not derivable', () => {
  const unknown = payment('recv-one', 100, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount: null, payments: [unknown] });
  const receipt = buildPaymentReceipt(customer, bill, unknown);
  const message = draft(draftInput(receipt, unknown)).message;
  assert.match(message, /💰 Amount Received: PKR 100/);
  assert.match(message, /✅ Status: RECEIVED/);
  assert.match(message, /💵 Outstanding: Not available/);
  assert.doesNotMatch(message, /Outstanding: PKR/);
  assert.doesNotMatch(message, /Status: PAID|Status: PARTIAL|Status: VOID/);
});

test('plan561: a no-bill-context draft still shows a status line', () => {
  const message = draft({
    customerName: 'Synthetic Customer', customerNumber: 42, amount: 100, date: '2026-08-12', method: 'Cash', month: '2026-08'
  }).message;
  assert.match(message, /✅ Status: RECEIVED/);
  assert.match(message, /💵 Outstanding: Not available/);
  assert.doesNotMatch(message, /Outstanding: PKR/);
});

test('plan561: the amount label is one label on both branches', () => {
  const paid = payment('label-paid', 2000, '2026-08-05');
  const paidFixture = fixture({ payments: [paid] });
  const paidReceipt = buildPaymentReceipt(paidFixture.customer, paidFixture.bill, paid);
  const paidMessage = draft(draftInput(paidReceipt, paid)).message;
  assert.match(paidMessage, /💰 Amount Received: PKR 2,000/);
  assert.doesNotMatch(paidMessage, /Amount Paid/);

  const partial = payment('label-partial', 300, '2026-08-05');
  const partialFixture = fixture({ payments: [partial] });
  const partialReceipt = buildPaymentReceipt(partialFixture.customer, partialFixture.bill, partial);
  const partialMessage = draft(draftInput(partialReceipt, partial)).message;
  assert.match(partialMessage, /💰 Amount Received: PKR 300/);
  assert.doesNotMatch(partialMessage, /Amount Paid/);
});

test('plan561: an explicitly passed receipt status is honoured', () => {
  const base = { customerName: 'Synthetic Customer', customerNumber: 42, amount: 500, date: '2026-08-06', method: 'Cash', month: '2026-08', billAmount: 2000, balanceDueCents: 0, billDueDate: '2026-08-05' };
  assert.match(draft({ ...base, status: 'CREDIT RECEIVED' }).message, /✅ Status: CREDIT RECEIVED/);
  assert.match(draft({ ...base, status: 'RECEIVED', billAmount: null, balanceDueCents: null }).message, /✅ Status: RECEIVED/);
  // A voided overpayment on an already-covered bill: the figures alone
  // read as CREDIT RECEIVED, so only the explicit status disambiguates.
  assert.match(draft({ ...base, status: 'VOID' }).message, /❌ Status: VOID/);
  assert.doesNotMatch(draft({ ...base, status: 'VOID' }).message, /Outstanding:/);
  // buildPaymentReceipt's own uppercase vocabulary lands in the
  // paid/partial branches exactly as the mapped lowercase values do.
  assert.match(draft({ ...base, status: 'PAID' }).message, /✅ Status: PAID/);
  assert.match(draft({ ...base, status: 'PARTIAL', balanceDueCents: 170000 }).message, /🟠 Status: PARTIAL/);
});

test('plan561: a voided payment is VOID even when the leaked bill status says partial', () => {
  // The Transactions list spreads the row into the draft, so the draft
  // sees the bill's status ('partial') and the voided flag side by side.
  // The bill status must never masquerade as the receipt status: this
  // payment was voided, so the draft is VOID, not PARTIAL.
  const first = payment('tx-first', 300, '2026-08-05');
  const voided = payment('tx-void', 300, '2026-08-06', { voided: true });
  const { customer, bill } = fixture({ payments: [first, voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  assert.equal(receipt.status, 'VOID');
  const message = draft({
    ...draftInput(receipt, voided), status: 'partial', voided: true
  }).message;
  assert.match(message, /❌ Status: VOID/);
  assert.doesNotMatch(message, /Status: PARTIAL/);
  assert.doesNotMatch(message, /Outstanding:/);
});

// Pin: a caller claiming paid/partial whose figures disagree still gets
// no settled block — the draft refuses to label a contradiction, exactly
// as the pre-Plan 561 contradictory-paid pin requires.
test('plan561 pin: a contradictory paid claim gets no settled block and no void mislabel', () => {
  const message = draft({
    customerName: 'Synthetic Customer', customerNumber: 42, amount: 300, date: '2026-08-10', method: 'Cash', month: '2026-08',
    billStatus: 'paid', billAmount: 1200, balanceDueCents: 90000, billDueDate: '2026-08-05'
  }).message;
  assert.doesNotMatch(message, /Status: PAID|Outstanding: PKR 0|Next Bill Due:/);
  assert.doesNotMatch(message, /Status: VOID/);
});

test('plan561: the new blocks render in Urdu script and Roman too', () => {
  const first = payment('lang-first', 2000, '2026-08-05');
  const second = payment('lang-second', 500, '2026-08-06');
  const { customer, bill } = fixture({ payments: [first, second] });
  const receipt = buildPaymentReceipt(customer, bill, second);
  const urdu = draft(draftInput(receipt, second), { lang: 'urdu' }).message;
  assert.match(urdu, /✅ کیفیت: کریڈٹ موصول/);
  assert.match(urdu, /💵 بقایا رقم: PKR 0/);
  assert.match(urdu, /💰 رقم موصول: PKR 500/);
  const roman = draft(draftInput(receipt, second), { lang: 'roman' }).message;
  assert.match(roman, /✅ Status: CREDIT WASOOL/);
  assert.match(roman, /💰 Raqam Wasool: PKR 500/);

  const voided = payment('lang-void', 300, '2026-08-05', { voided: true });
  const voidFixture = fixture({ payments: [voided] });
  const voidReceipt = buildPaymentReceipt(voidFixture.customer, voidFixture.bill, voided);
  const voidUrdu = draft(draftInput(voidReceipt, voided), { lang: 'urdu' }).message;
  assert.match(voidUrdu, /❌ کیفیت: منسوخ/);
  assert.doesNotMatch(voidUrdu, /Outstanding:/);
});
