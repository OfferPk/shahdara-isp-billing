// #225 acceptance: the customer statement must satisfy
//   opening + bills - payments - credits = closing
// for partial payments, advance credit and archived months, and its closing
// balance must match the ledger engine (calculatePaymentAllocations) exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCustomerStatement } from '../form-validation.js';
import { calculatePaymentAllocations } from '../core.js';

const REF = new Date(2026, 9, 15); // 15 Oct 2026 (local)

function identityHolds(st) {
  assert.equal(
    st.openingBalance + st.totalBilled - st.totalPaid,
    st.currentBalance,
    `identity broken: opening ${st.openingBalance} + billed ${st.totalBilled} - paid ${st.totalPaid} != closing ${st.currentBalance}`
  );
  // Every event's running balance must be the previous balance + charge - credit.
  let prev = st.openingBalance;
  for (const ev of st.events) {
    assert.equal(ev.runningBalance, prev + ev.charge - ev.credit, `running balance wrong at ${ev.date} ${ev.type}`);
    prev = ev.runningBalance;
  }
  if (st.events.length) assert.equal(prev, st.currentBalance);
}

// Engine net position for the same customer object: total balance due across
// priced months minus credit still waiting to be applied (the app computes
// pending credit per receipt; per-month summaries carry it on the source month).
function engineNet(customer) {
  const alloc = calculatePaymentAllocations({ customers: [customer] });
  let dueCents = 0;
  let pendingCents = 0;
  for (const bill of customer.bills) {
    const s = alloc.forMonth(customer.id, bill.month);
    if (!s) continue;
    dueCents += s.balanceDueCents ?? 0;
    pendingCents += s.pendingCreditCents ?? 0;
  }
  return (dueCents - pendingCents) / 100;
}

test('#225 partial payment: closing is the unpaid remainder and identity holds', () => {
  const customer = {
    id: 'p1', customerNumber: 11, name: 'Partial Payer',
    bills: [
      { id: 'b1', month: '2026-08', dueDate: '2026-08-05', dueAmount: 1500, payments: [{ id: 'pay1', date: '2026-08-07', amount: 900, method: 'Cash' }] }
    ]
  };
  const st = formatCustomerStatement(customer, { referenceDate: REF });
  identityHolds(st);
  assert.equal(st.totalBilled, 1500);
  assert.equal(st.totalPaid, 900);
  assert.equal(st.currentBalance, 600);
  assert.equal(st.currentBalance, engineNet(customer));
});

test('#225 advance credit: overpayment and unpriced-bill advance carry as negative closing', () => {
  const customer = {
    id: 'a1', customerNumber: 12, name: 'Advance Payer',
    bills: [
      { id: 'b1', month: '2026-08', dueDate: '2026-08-05', dueAmount: 1200, lateFee: 100, payments: [{ id: 'pay1', date: '2026-08-06', amount: 2000, method: 'JazzCash', reference: 'JC-9' }] },
      { id: 'b2', month: '2026-09', dueDate: '2026-09-05', dueAmount: null, payments: [{ id: 'pay2', date: '2026-09-02', amount: 500, method: 'Cash' }] },
      { id: 'b3', month: '2026-07', dueDate: '2026-07-05', dueAmount: 1000, payments: [{ id: 'pay3', date: '2026-07-06', amount: 400, method: 'Cash' }] },
      { id: 'b4', month: '2026-06', dueDate: '2026-06-05', dueAmount: 1000, payments: [{ id: 'pay4', date: '2026-06-06', amount: 1000, method: 'Cash' }] }
    ]
  };
  const st = formatCustomerStatement(customer, { referenceDate: REF });
  identityHolds(st);
  assert.equal(st.totalBilled, 3300);
  assert.equal(st.totalPaid, 3900);
  assert.equal(st.currentBalance, -600);
  assert.equal(st.currentBalance, engineNet(customer), 'statement closing must equal the ledger engine net position');
});

test('#225 archived months: settled old months fold into opening balance for ranged statements', () => {
  const customer = {
    id: 'r1', customerNumber: 13, name: 'Long History',
    bills: [
      { id: 'b1', month: '2026-06', dueDate: '2026-06-05', dueAmount: 1000, payments: [{ id: 'pay1', date: '2026-06-06', amount: 1000, method: 'Cash' }] },
      { id: 'b2', month: '2026-07', dueDate: '2026-07-05', dueAmount: 1000, payments: [{ id: 'pay2', date: '2026-07-06', amount: 400, method: 'Cash' }] },
      { id: 'b3', month: '2026-08', dueDate: '2026-08-05', dueAmount: 1300, payments: [] }
    ]
  };
  const all = formatCustomerStatement(customer, { referenceDate: REF });
  identityHolds(all);
  assert.equal(all.currentBalance, 1900);

  const ranged = formatCustomerStatement(customer, { range: '3m', referenceDate: REF });
  identityHolds(ranged);
  // Cutoff 2026-07-15: June (settled) and July (600 still owed) fold into opening.
  assert.equal(ranged.openingBalance, 600);
  // Closing is range-independent: the customer's position is the same.
  assert.equal(ranged.currentBalance, all.currentBalance);
});

test('#225 late fee + discount: identity holds and discount never exceeds the bill', () => {
  const customer = {
    id: 'd1', customerNumber: 14, name: 'Discount Case',
    bills: [
      { id: 'b1', month: '2026-08', dueDate: '2026-08-05', dueAmount: 1000, lateFee: 100, payments: [{ id: 'pay1', date: '2026-08-09', amount: 600, method: 'Cash', discount: 5000, discountReason: 'Owner concession' }] }
    ]
  };
  const st = formatCustomerStatement(customer, { referenceDate: REF });
  identityHolds(st);
  assert.equal(st.totalBilled, 1100);
  // The stored discount (5000) must be capped at the bill total, never shown
  // at face value: the discount event credits exactly 1100.
  const discountEvent = st.events.find(e => e.type === 'discount');
  assert.equal(discountEvent.credit, 1100);
  // Settlement order mirrors the allocation engine: discount applies against
  // the bill first, so the 600 cash becomes genuine advance credit and the
  // closing matches the engine net exactly.
  assert.equal(st.currentBalance, -600);
  assert.equal(st.currentBalance, engineNet(customer));
});

test('#225 empty history: statement is a clean zero ledger', () => {
  const st = formatCustomerStatement({ id: 'e1', customerNumber: 15, name: 'New Customer', bills: [] }, { referenceDate: REF });
  identityHolds(st);
  assert.equal(st.currentBalance, 0);
  assert.equal(st.events.length, 0);
});
