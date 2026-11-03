# Plan N — Payment completion flows

Two gaps, closed without changing billing, totals, or the sync protocol.

## 1. Kist payoff: payment or waiver, never a silent close

The old profile payoff button was a one-click close: it settled the plan
with `payoffAmount`/`payoffDate` but recorded no payment and no waiver
reason, so cash paid was not in the ledger unless recorded separately,
and a waiver had nothing on record. That button is removed.

The payoff dialog now offers exactly two paths:

- **Record payoff payment** — the operator types a payment method (one
  of `PAYMENT_METHODS`). The remaining amount is recorded first via
  `addPayment` on the current month's bill, exactly as the kist
  down-payment path does. The plan settles only after that payment
  records, and the payment id is stored on the plan as
  `payoffPaymentId`. A failed payment, an unknown method, or a zero
  remainder settles nothing.
- **Waive remaining** — no payment is recorded, but a reason is
  required and stored on the plan as `payoffReason`. A blank reason
  settles nothing.

The pure rules live in `installment-plan.js` (`validatePayoffChoice`,
`settlePlanEarly` with `method`/`reason`/`paymentId`); a settled plan
carries `payoffMethod` (`payment` | `waiver` | `null` on pre-Plan-N
settlements), and the profile card labels a waived settlement with its
reason (`profile-ui.js` `kistSettlementPresentation`, new
`prof_kist_settled_waived*` strings) so a waived plan never looks paid.

Note on the payment path: the payoff payment lands on the current
month's bill through the normal ledger path — it does not retroactively
create kist bills for the unbilled installments. What it guarantees is
that the cash is in the ledger and linked to the plan.

## 2. Profile remainder Waada

Quick Collect and Field Mode already offered a remainder-Waada chip
after a partial payment; the profile payment form did not, so a partial
payment there left the original promise untouched. The profile form now
shows the same four chip dates (`+3`, `+7`, 10th, 15th, from
`remainderWaadaChipDates`) plus Skip, while the typed amount leaves
part of that month's bill unpaid.

Choosing a date stamps the payment exactly as Quick Collect does
(`waada-queue.js` `stampRemainderWaada`): the payment carries
`remainderWaada` (including the promise it replaced, for the void
path) and the customer's live promise is set through `setCustomerWaada`
with the remainder-Waada note, in the same save as the payment, with
`promiseAmount` equal to the customer's total outstanding after the
payment. Skip, no chip, or a fully-settled customer leaves the promise
exactly as it was. Full-payment Waada clearing in `core.js` `addPayment`
is unaffected.
