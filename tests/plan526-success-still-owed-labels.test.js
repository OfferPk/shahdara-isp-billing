// Plan 526 — Success screen labels which "still owed" it means: the
// still-owes line names its figure "Bill dues still owed" / "Bill
// dues fully paid" (bill dues + baqaya only — ticket/boost charges
// are not dues), and the next-steps row reads "Still owed (incl.
// pending charges)" when ticket or boost charges are still pending.
// Label-only: no figure, badge, or allocation change anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STILL_OWES_FULLY_PAID_TEXT,
  STILL_OWES_STILL_OWED_TEXT,
  stillOwesLine,
  stillOwesLineText,
  stillOwesLineHtml,
  stillOwesCents,
} from '../quick-collect-still-owes.js';
import {
  SUCCESS_NEXT_STEPS_STILL_OWED_TEXT,
  SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT,
  successNextStepsFromReceipt,
  successNextStepsLineText,
  successNextStepsHtml,
} from '../success-next-steps.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stillOwesSrc = readFileSync(new URL('../quick-collect-still-owes.js', import.meta.url), 'utf8');
const nextStepsSrc = readFileSync(new URL('../success-next-steps.js', import.meta.url), 'utf8');

function customer(bills, extra = {}) {
  return { id: 'cust-1', bills, ...extra };
}

function bill(month) {
  return { month };
}

function allocationsFor(balances) {
  return {
    forMonth: (_customerId, month) => ({ balanceDueCents: balances[month] ?? 0 }),
  };
}

// The Plan 526 acceptance fixture: both bills settled, but a Rs 500
// repair (ticket) charge still pending after a full bill payment of
// PKR 3,000. Before this plan the screen read "Fully paid" at the
// top and "Still owed PKR 500" in the next-steps panel — the same
// breath saying paid and owed at once.
const settledBills = [bill('2026-09'), bill('2026-10')];
const settledAllocations = allocationsFor({ '2026-09': 0, '2026-10': 0 });

function chargedReceipt(extra = {}) {
  return {
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 3000,
    payableRemaining: 500,
    newTotalDues: 0,
    ticketChargesPending: 500,
    addonChargesPending: 0,
    ...extra,
  };
}

// --- Still-owes line: bill dues, labelled as bill dues ---

test('still-owes text: a settled bill reads "Bill dues fully paid"', () => {
  const line = stillOwesLine(customer(settledBills), settledAllocations, 0);
  assert.equal(line.fullyPaid, true);
  assert.equal(STILL_OWES_FULLY_PAID_TEXT, 'Bill dues fully paid');
  assert.equal(stillOwesLineText(line), 'Bill dues fully paid');
});

test('still-owes text: an owed figure reads "Bill dues still owed PKR …"', () => {
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 150000, '2026-10': 300000 }),
    0,
  );
  assert.equal(STILL_OWES_STILL_OWED_TEXT, 'Bill dues still owed');
  assert.equal(stillOwesLineText(line), 'Bill dues still owed PKR 4,500');
});

test('still-owes html: the owed line and the settled pill both name bill dues', () => {
  const owedHtml = stillOwesLineHtml({ stillOwedCents: 300000, stillOwed: 3000, fullyPaid: false });
  assert.ok(owedHtml.includes('Bill dues still owed PKR 3,000'), 'owed line must name bill dues');
  assert.ok(owedHtml.includes('has-balance'), 'owed line must carry has-balance');
  const paidHtml = stillOwesLineHtml({ stillOwedCents: 0, stillOwed: 0, fullyPaid: true });
  assert.ok(paidHtml.includes('✓ Bill dues fully paid'), 'settled pill must name bill dues');
  assert.ok(paidHtml.includes('zero-balance'), 'settled pill must carry zero-balance');
});

test('still-owes figure: the label change moves no figure', () => {
  // The same fixture Plan 440 pins: a 500 repair charge pending
  // while both bills are settled is still 0 dues — the figure is
  // untouched, only its label changed.
  assert.equal(
    stillOwesCents(customer(settledBills, { ticketChargesPending: 500 }), settledAllocations, 0),
    0,
  );
  assert.equal(
    stillOwesCents(
      customer([bill('2026-09'), bill('2026-10')]),
      allocationsFor({ '2026-09': 150000, '2026-10': 300000 }),
      0,
    ),
    450000,
  );
});

// --- Next-steps row: "(incl. pending charges)" when charges are pending ---

test('next steps: a pending ticket charge is flagged on the panel', () => {
  const next = successNextStepsFromReceipt(chargedReceipt(), null);
  assert.equal(next.chargesPending, true);
  assert.equal(next.stillOwed, 500);
  assert.equal(next.fullyPaid, false);
  assert.equal(SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT, 'Still owed (incl. pending charges)');
});

test('next steps: a pending boost charge alone is flagged too', () => {
  const next = successNextStepsFromReceipt(
    chargedReceipt({ ticketChargesPending: 0, addonChargesPending: 500 }),
    null,
  );
  assert.equal(next.chargesPending, true);
});

test('next steps: no pending charge reads as before, with the plain label', () => {
  const next = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 2000,
    payableRemaining: 1000,
    newTotalDues: 1000,
  }, '2026-10-05');
  assert.equal(next.chargesPending, false);
  assert.equal(SUCCESS_NEXT_STEPS_STILL_OWED_TEXT, 'Still owed');
  assert.equal(successNextStepsLineText(next), 'Paid PKR 2,000 · Still owed PKR 1,000 · Next due 2026-10-05');
  assert.match(
    successNextStepsHtml(next),
    /<span class="qc-meta-label">Still owed<\/span>/,
    'no-charge panel must carry the plain label',
  );
  assert.doesNotMatch(successNextStepsHtml(next), /incl\. pending charges/);
});

test('next steps: a non-numeric or zero pending charge is not pending', () => {
  for (const pending of [0, null, undefined, '500', true]) {
    const next = successNextStepsFromReceipt(
      chargedReceipt({ ticketChargesPending: pending, addonChargesPending: pending }),
      null,
    );
    assert.equal(next.chargesPending, false, `expected false for ${String(pending)}`);
  }
});

test('next steps text: the charged row names the charges in plain words', () => {
  const next = successNextStepsFromReceipt(chargedReceipt(), null);
  assert.equal(
    successNextStepsLineText(next),
    'Paid PKR 3,000 · Still owed (incl. pending charges) PKR 500 · Next due date not recorded',
  );
});

test('next steps html: the charged row carries the qualified label', () => {
  const html = successNextStepsHtml(successNextStepsFromReceipt(chargedReceipt(), null));
  assert.match(html, /<span class="qc-meta-label">Still owed \(incl\. pending charges\)<\/span>/);
  assert.match(html, /PKR 500/);
});

test('next steps: a split collection reads the pending charges off the leg receipt', () => {
  const split = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 1000,
    payableRemaining: 500,
    ticketChargesPending: 500,
    addonChargesPending: 0,
    splitTender: { totalReceived: 2500, balanceDueCents: 50000 },
  }, '2026-10-05');
  assert.equal(split.amountPaid, 2500);
  assert.equal(split.stillOwed, 500);
  assert.equal(split.chargesPending, true);
  assert.match(successNextStepsHtml(split), /Still owed \(incl\. pending charges\)/);
  const splitPlain = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 1000,
    payableRemaining: 500,
    splitTender: { totalReceived: 2500, balanceDueCents: 50000 },
  }, '2026-10-05');
  assert.equal(splitPlain.chargesPending, false);
  assert.doesNotMatch(successNextStepsHtml(splitPlain), /incl\. pending charges/);
});

// --- Acceptance: both lines visible, each labelled for what it counts ---

test('acceptance: settled bills with a pending charge read without contradiction', () => {
  const line = stillOwesLine(customer(settledBills), settledAllocations, 0);
  assert.equal(stillOwesLineText(line), 'Bill dues fully paid');
  const next = successNextStepsFromReceipt(chargedReceipt(), null);
  assert.equal(
    successNextStepsLineText(next),
    'Paid PKR 3,000 · Still owed (incl. pending charges) PKR 500 · Next due date not recorded',
  );
  // The two labels name different figures: bill dues are settled, and
  // the 500 still owed is the pending charge — never the same figure
  // under two names.
  assert.notEqual(stillOwesLineText(line), successNextStepsLineText(next));
});

test('acceptance: a fixture with no charges reads exactly as before', () => {
  const line = stillOwesLine(
    customer([bill('2026-09'), bill('2026-10')]),
    allocationsFor({ '2026-09': 0, '2026-10': 100000 }),
    0,
  );
  assert.equal(stillOwesLineText(line), 'Bill dues still owed PKR 1,000');
  const next = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 2000,
    payableRemaining: 1000,
    newTotalDues: 1000,
  }, '2026-10-05');
  assert.equal(successNextStepsLineText(next), 'Paid PKR 2,000 · Still owed PKR 1,000 · Next due 2026-10-05');
});

// --- Wiring: the labels live in the two pure modules, the controller is untouched ---

test('wiring: the controller still renders both lines from the same modules', () => {
  assert.ok(wiringSrc.includes("from './quick-collect-still-owes.js'"), 'missing still-owes import');
  assert.ok(wiringSrc.includes("from './success-next-steps.js'"), 'missing next-steps import');
  assert.ok(wiringSrc.includes('function renderStillOwesLine()'), 'missing still-owes render');
  assert.ok(wiringSrc.includes('function renderSuccessNextSteps()'), 'missing next-steps render');
  assert.ok(wiringSrc.includes('successNextStepsFromReceipt(activeReceipt, nextDueDate)'), 'panel must read the issued receipt');
  assert.ok(wiringSrc.includes('stillOwesLine(postSaveCustomer, calculatePaymentAllocations(postSaveState), baqayaCents)'), 'line must read the post-save record');
});

test('wiring: the receipt card badge is untouched — it still reads the payable remainder', () => {
  // BUT HOUSE fix: the renderer takes an optional second argument
  // carrying the live-state WhatsApp resolution (whatsappPhone first,
  // else the primary phone) — the signature changed, the card builder
  // and its canonical remaining figure did not.
  assert.ok(wiringSrc.includes('function renderQuickCollectReceiptCardHtml(receipt, { whatsappPhone } = {})'), 'missing receipt card');
  const start = wiringSrc.indexOf('function renderQuickCollectReceiptCardHtml(receipt, { whatsappPhone } = {})');
  const slice = wiringSrc.slice(start, start + 2600);
  assert.match(slice, /receipt\.payableRemaining \?\? receipt\.newTotalDues/);
  // Polish 21 (Req 6): the settle/partial badge moved out of the card
  // header into the status section (renderSettleStatusBadge) — the card
  // builder no longer carries the texts, the settle render does, reading
  // the same payable remainder.
  assert.ok(!slice.includes('Settle in Full'), 'card builder must not carry the settle badge any more');
  const settleStart = wiringSrc.indexOf('function renderSettleStatusBadge()');
  assert.ok(settleStart >= 0, 'missing settle render');
  const settleSlice = wiringSrc.slice(settleStart, settleStart + 1500);
  assert.match(settleSlice, /activeReceipt\.payableRemaining \?\? activeReceipt\.newTotalDues/);
  assert.match(settleSlice, /✓ Settle in Full/);
  assert.match(settleSlice, /⏳ Partial Payment/);
});

test('labels: the new wording lives in the modules, not in the controller', () => {
  assert.ok(stillOwesSrc.includes('Bill dues still owed'), 'still-owes module must carry the owed label');
  assert.ok(stillOwesSrc.includes('Bill dues fully paid'), 'still-owes module must carry the settled label');
  assert.ok(nextStepsSrc.includes('Still owed (incl. pending charges)'), 'next-steps module must carry the charged label');
  assert.ok(!wiringSrc.includes('Bill dues still owed'), 'controller must not hardcode the still-owes label');
  assert.ok(!wiringSrc.includes('incl. pending charges'), 'controller must not hardcode the charged label');
});

test('purity: the changed modules stay pure — no clock, no storage, no page', () => {
  for (const [name, src] of [['still-owes', stillOwesSrc], ['next-steps', nextStepsSrc]]) {
    assert.ok(!src.includes('Date.now('), `${name} must not read the clock`);
    assert.ok(!/new Date\(/.test(src), `${name} must not read the clock`);
    assert.ok(!src.includes('localStorage'), `${name} must not touch storage`);
    assert.ok(!src.includes('document.'), `${name} must not touch the page`);
    assert.ok(!src.includes('import '), `${name} must be import-free`);
  }
});
