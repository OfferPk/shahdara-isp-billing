// Plan 386 — Transaction overpayment choice at entry time: when
// the amount typed exceeds the customer's dues, the operator is
// offered one explicit choice for the extra — keep it as an advance
// toward future bills, or hold it as a credit balance — and the
// choice is recorded with the transaction. It offers the choice
// only and applies nothing automatically.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OVERPAYMENT_CHOICES,
  isOverpaymentChoice,
  overpaymentExtraCents,
  overpaymentChoiceOf,
  normalizeOverpaymentChoice,
  overpaymentChoiceLineText,
  overpaymentChoiceMarkup,
} from '../overpayment-choice.js';
import {
  validatePayment,
  addPayment,
  correctPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../overpayment-choice.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(ROOT, '../core.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(ROOT, '../app.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const stylesSrc = fs.readFileSync(path.join(ROOT, '../styles.css'), 'utf8');
const langSrc = fs.readFileSync(path.join(ROOT, '../nav-language.js'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan386-overpayment-choice.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);
const PAYMENT_DATE = '2026-11-05';
const DUES_9000 = 900000;

// Three open bills at PKR 3,000 each: total dues PKR 9,000.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDuesCents(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues;
}

function allPaymentIds(state) {
  return new Set(state.customers.flatMap((c) => c.bills.flatMap((b) => b.payments.map((p) => p.id))));
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

function recordedPayment(state, month) {
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === month);
  return bill.payments[bill.payments.length - 1];
}

// ---- Module units: the extra over the dues ----

test('Plan 386: the extra is the amount over the dues, or 0 when it does not exceed them', () => {
  assert.equal(overpaymentExtraCents(900000, 950000), 50000);
  assert.equal(overpaymentExtraCents(900000, 900000), 0);
  assert.equal(overpaymentExtraCents(900000, 800000), 0);
  assert.equal(overpaymentExtraCents(0, 50000), 50000);
  assert.equal(overpaymentExtraCents('900000', '950000'), 50000);
  assert.equal(overpaymentExtraCents(null, 950000), 0);
  assert.equal(overpaymentExtraCents(900000, 'not a number'), 0);
});

test('Plan 386: only advance and credit are choices', () => {
  assert.deepEqual(OVERPAYMENT_CHOICES, ['advance', 'credit']);
  assert.equal(isOverpaymentChoice('advance'), true);
  assert.equal(isOverpaymentChoice('credit'), true);
  assert.equal(isOverpaymentChoice(' Advance '), true);
  assert.equal(isOverpaymentChoice('CREDIT'), true);
  assert.equal(isOverpaymentChoice(''), false);
  assert.equal(isOverpaymentChoice('cash'), false);
  assert.equal(isOverpaymentChoice(null), false);
  assert.equal(isOverpaymentChoice(undefined), false);
});

test('Plan 386: normalize keeps a valid choice with the extra recomputed from dues and amount', () => {
  assert.deepEqual(normalizeOverpaymentChoice('advance', DUES_9000, 950000), { choice: 'advance', extraCents: 50000 });
  assert.deepEqual(normalizeOverpaymentChoice('credit', DUES_9000, 950000), { choice: 'credit', extraCents: 50000 });
  assert.deepEqual(normalizeOverpaymentChoice(' Advance ', DUES_9000, 900100), { choice: 'advance', extraCents: 100 });
  // A stale extra on the raw record never survives: the extra is
  // always the amount over the dues, recomputed here.
  assert.deepEqual(
    normalizeOverpaymentChoice({ choice: 'credit', extraCents: 999999 }, DUES_9000, 950000),
    { choice: 'credit', extraCents: 50000 },
  );
});

test('Plan 386: normalize refuses a choice when the payment does not exceed the dues', () => {
  assert.equal(normalizeOverpaymentChoice('advance', DUES_9000, 900000), null);
  assert.equal(normalizeOverpaymentChoice('advance', DUES_9000, 800000), null);
  assert.equal(normalizeOverpaymentChoice('credit', DUES_9000, 0), null);
});

test('Plan 386: normalize refuses a missing or unknown choice', () => {
  assert.equal(normalizeOverpaymentChoice('', DUES_9000, 950000), null);
  assert.equal(normalizeOverpaymentChoice(null, DUES_9000, 950000), null);
  assert.equal(normalizeOverpaymentChoice(undefined, DUES_9000, 950000), null);
  assert.equal(normalizeOverpaymentChoice('cash', DUES_9000, 950000), null);
  assert.equal(normalizeOverpaymentChoice({}, DUES_9000, 950000), null);
  assert.equal(normalizeOverpaymentChoice({ choice: 'refund' }, DUES_9000, 950000), null);
});

test('Plan 386: normalize without dues keeps a well-formed recorded choice and drops a bare word', () => {
  // The correction carry-over shape: no dues are passed on a
  // correction, so a choice that is already a record is kept as-is.
  assert.deepEqual(
    normalizeOverpaymentChoice({ choice: 'advance', extraCents: 50000 }, undefined, 950000),
    { choice: 'advance', extraCents: 50000 },
  );
  assert.equal(normalizeOverpaymentChoice('advance', undefined, 950000), null);
  assert.equal(normalizeOverpaymentChoice({ choice: 'advance' }, undefined, 950000), null);
});

test('Plan 386: the reader takes only well-formed records', () => {
  assert.deepEqual(overpaymentChoiceOf({ overpaymentChoice: { choice: 'credit', extraCents: 50000 } }), { choice: 'credit', extraCents: 50000 });
  assert.equal(overpaymentChoiceOf({ overpaymentChoice: { choice: 'advance', extraCents: 0 } }), null);
  assert.equal(overpaymentChoiceOf({ overpaymentChoice: { choice: 'advance', extraCents: -100 } }), null);
  assert.equal(overpaymentChoiceOf({ overpaymentChoice: { choice: 'advance', extraCents: 50.5 } }), null);
  assert.equal(overpaymentChoiceOf({ overpaymentChoice: { choice: 'refund', extraCents: 50000 } }), null);
  assert.equal(overpaymentChoiceOf({ overpaymentChoice: 'advance' }), null);
  assert.equal(overpaymentChoiceOf({}), null);
  assert.equal(overpaymentChoiceOf(null), null);
  assert.equal(overpaymentChoiceOf(undefined), null);
});

test('Plan 386: normalize never mutates its input', () => {
  const raw = Object.freeze({ choice: 'credit', extraCents: 999999 });
  assert.deepEqual(normalizeOverpaymentChoice(raw, DUES_9000, 950000), { choice: 'credit', extraCents: 50000 });
  assert.deepEqual(raw, { choice: 'credit', extraCents: 999999 });
});

// ---- Module units: plain words and markup ----

test('Plan 386: the choice in plain words names the extra and how it is kept', () => {
  assert.equal(overpaymentChoiceLineText({ choice: 'advance', extraCents: 50000 }), 'Extra PKR 500 as advance');
  assert.equal(overpaymentChoiceLineText({ choice: 'credit', extraCents: 150000 }), 'Extra PKR 1,500 held as credit');
  assert.equal(overpaymentChoiceLineText({ choice: 'advance', extraCents: 50 }), 'Extra PKR 0.5 as advance');
  assert.equal(overpaymentChoiceLineText(null), '');
  assert.equal(overpaymentChoiceLineText({ choice: 'advance', extraCents: 0 }), '');
  assert.equal(
    overpaymentChoiceLineText({ choice: 'credit', extraCents: 50000 }, { extra: 'Zائد', advance: 'ایڈوانس', credit: 'کریڈٹ' }),
    'Zائد PKR 500 کریڈٹ',
  );
});

test('Plan 386: the markup is a dot suffix, escaped, or nothing when there is no choice', () => {
  assert.equal(
    overpaymentChoiceMarkup({ overpaymentChoice: { choice: 'advance', extraCents: 50000 } }),
    ' · Extra PKR 500 as advance',
  );
  assert.equal(overpaymentChoiceMarkup({}), '');
  assert.equal(overpaymentChoiceMarkup(null), '');
  assert.equal(
    overpaymentChoiceMarkup(
      { overpaymentChoice: { choice: 'credit', extraCents: 50000 } },
      { extra: '<Extra>', advance: 'as advance', credit: 'held as credit' },
    ),
    ' · &lt;Extra&gt; PKR 500 held as credit',
  );
});

// ---- Validator and recording ----

test('Plan 386: validatePayment keeps the choice when the amount exceeds the dues', () => {
  const payment = validatePayment({
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
    overpaymentChoice: 'advance', overpaymentDuesCents: DUES_9000,
  }, NOV_6);
  assert.deepEqual(payment.overpaymentChoice, { choice: 'advance', extraCents: 50000 });
  assert.equal('overpaymentDuesCents' in payment, false, 'the dues ride along for the check only and are never stored');
  assert.equal(payment.amount, 9500);
});

test('Plan 386: validatePayment drops the choice when the payment does not exceed the dues', () => {
  for (const amount of [9000, 8000]) {
    const payment = validatePayment({
      date: PAYMENT_DATE, amount, method: 'Cash',
      overpaymentChoice: 'credit', overpaymentDuesCents: DUES_9000,
    }, NOV_6);
    assert.equal('overpaymentChoice' in payment, false, `amount ${amount} must record no choice`);
  }
  const noDues = validatePayment({
    date: PAYMENT_DATE, amount: 9500, method: 'Cash', overpaymentChoice: 'advance',
  }, NOV_6);
  assert.equal('overpaymentChoice' in noDues, false, 'a bare word with no dues to check against stores nothing');
});

test('Plan 386: a reversal can never carry a choice', () => {
  const payment = validatePayment({
    date: PAYMENT_DATE, amount: -3000, method: 'Cash',
    reversalLink: { reversesPaymentId: 'P-ORIG', date: PAYMENT_DATE },
    overpaymentChoice: 'advance', overpaymentDuesCents: 0,
  }, NOV_6);
  assert.ok(payment.reversalLink, 'the reversal link itself records');
  assert.equal('overpaymentChoice' in payment, false);
});

test('Plan 386: addPayment records the choice with the transaction', () => {
  const state = stateWithBills(NOV_6);
  assert.equal(totalDuesCents(state), DUES_9000);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'credit', overpaymentDuesCents: DUES_9000,
  });
  const recorded = recordedPayment(next, '2026-10');
  assert.deepEqual(recorded.overpaymentChoice, { choice: 'credit', extraCents: 50000 });
  assert.equal(recorded.amount, 9500);
  assert.equal(recorded.method, 'Cash');
  assert.equal(recorded.date, PAYMENT_DATE);
});

test('Plan 386: addPayment without a choice records no choice field', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6);
  assert.equal('overpaymentChoice' in recordedPayment(next, '2026-10'), false);
});

// ---- Acceptance: the choice changes nothing by itself ----

test('Plan 386: acceptance — the choice never changes any bill, payment, or past total by itself', () => {
  const base = stateWithBills(NOV_6);
  const withChoice = pay(base, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'advance', overpaymentDuesCents: DUES_9000,
  });
  const withoutChoice = pay(base, '2026-10', '9500', PAYMENT_DATE, NOV_6);
  // Every month's remaining balance is identical with and without it.
  for (const month of ['2026-09', '2026-10', '2026-11']) {
    assert.equal(
      calculatePaymentAllocations(withChoice).forMonth('seed-001', month).balanceDueCents,
      calculatePaymentAllocations(withoutChoice).forMonth('seed-001', month).balanceDueCents,
      `${month} balance must not move because a choice was recorded`,
    );
  }
  // The stored payment is identical apart from the choice itself:
  // the choice applies nothing, so it adds no other field. (The two
  // payments carry different generated ids, so those are set aside.)
  const chosen = recordedPayment(withChoice, '2026-10');
  const plain = recordedPayment(withoutChoice, '2026-10');
  const { overpaymentChoice, id: _chosenId, ...chosenRest } = chosen;
  const { id: _plainId, ...plainRest } = plain;
  assert.deepEqual(chosenRest, plainRest, 'only the choice field may differ');
  assert.deepEqual(overpaymentChoice, { choice: 'advance', extraCents: 50000 });
});

test('Plan 386: acceptance — changing the amount updates the extra', () => {
  assert.deepEqual(normalizeOverpaymentChoice('advance', DUES_9000, 950000), { choice: 'advance', extraCents: 50000 });
  assert.deepEqual(normalizeOverpaymentChoice('advance', DUES_9000, 1000000), { choice: 'advance', extraCents: 100000 });
  assert.equal(normalizeOverpaymentChoice('advance', DUES_9000, 900000), null);
});

// ---- Correction carry-over and projection ----

test('Plan 386: correctPayment keeps the choice when it says nothing about it', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'advance', overpaymentDuesCents: DUES_9000,
  });
  const id = recordedPayment(state, '2026-10').id;
  const next = correctPayment(state, 'seed-001', '2026-10', id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
  }, NOV_6);
  assert.deepEqual(recordedPayment(next, '2026-10').overpaymentChoice, { choice: 'advance', extraCents: 50000 });
});

test('Plan 386: correctPayment replaces the choice when one is supplied and clears it on null', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'advance', overpaymentDuesCents: DUES_9000,
  });
  const id = recordedPayment(state, '2026-10').id;
  const replaced = correctPayment(state, 'seed-001', '2026-10', id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash',
    overpaymentChoice: { choice: 'credit', extraCents: 50000 },
  }, NOV_6);
  assert.deepEqual(recordedPayment(replaced, '2026-10').overpaymentChoice, { choice: 'credit', extraCents: 50000 });
  const cleared = correctPayment(state, 'seed-001', '2026-10', id, {
    date: PAYMENT_DATE, amount: 9500, method: 'Cash', overpaymentChoice: null,
  }, NOV_6);
  assert.equal('overpaymentChoice' in recordedPayment(cleared, '2026-10'), false);
});

test('Plan 386: listTransactions projects the choice on the row', () => {
  let state = stateWithBills(NOV_6);
  state = pay(state, '2026-10', '9500', PAYMENT_DATE, NOV_6, {
    overpaymentChoice: 'credit', overpaymentDuesCents: DUES_9000,
  });
  const id = recordedPayment(state, '2026-10').id;
  const rows = listTransactions(state, {}, NOV_6);
  const row = rows.find((entry) => entry.paymentId === id);
  assert.ok(row, 'the transaction row must exist');
  assert.deepEqual(row.overpaymentChoice, { choice: 'credit', extraCents: 50000 });
  const plain = pay(stateWithBills(NOV_6), '2026-10', '3000', PAYMENT_DATE, NOV_6);
  const plainId = recordedPayment(plain, '2026-10').id;
  const plainRow = listTransactions(plain, {}, NOV_6).find((entry) => entry.paymentId === plainId);
  assert.equal(plainRow.overpaymentChoice, null);
});

// ---- Wiring: the entry form offers the choice as the amount is typed ----

test('Plan 386: the entry form imports the choice and renders it', () => {
  assert.ok(navSrc.includes("import { overpaymentExtraCents } from './overpayment-choice.js';"));
  assert.ok(navSrc.includes('function renderOverpaymentChoice()'));
  assert.ok(navSrc.includes("document.getElementById('quickCollectOverpaymentChoice')"));
  assert.ok(navSrc.includes("document.getElementById('quickCollectOverpaymentExtra')"));
  assert.ok(navSrc.includes('overpaymentChoiceBox.hidden = extraCents <= 0;'));
});

test('Plan 386: the choice refreshes on every keystroke, month, Advance, split, open, chip, and keypad tap', () => {
  const calls = navSrc.match(/renderOverpaymentChoice\(\)/g) || [];
  // Definition plus nine refresh sites: month change, amount input,
  // Advance toggle, split toggle, form open, quick-amount chip,
  // loose-change chip, amount keypad, Add payment dues buttons.
  // Plan 442: the amount keypad is the eighth refresh site — a
  // keypad tap sets the amount, so the choice re-offers like
  // every other programmatic amount set.
  // Plan 489: the Add payment dues buttons are the ninth refresh
  // site — a button tap fills the amount, so the choice re-offers
  // like every other programmatic amount set. The count moves from
  // 9 to 10 for that one new call site only; the intent (the choice
  // refreshes on every programmatic amount set) is unchanged.
  // Plan 539: the Back-draft restore is the tenth refresh site — a
  // restored amount re-offers the choice like every other
  // programmatic amount set. The count moves from 10 to 11 for that
  // one new call site only; the intent is unchanged.
  // Sharafat 1: the leg-2 input is the eleventh refresh site —
  // typing the second leg re-offers the choice over the combined
  // total, exactly like typing leg 1. The count moves from 11 to
  // 12 for that one new call site only; the intent is unchanged.
  assert.equal(calls.length, 12, `expected 12 renderOverpaymentChoice() sites, found ${calls.length}`);
});

test('Plan 386: the submit posts the choice and the dues through the collection path', () => {
  assert.ok(navSrc.includes('overpaymentChoice: selectedOverpaymentChoice || undefined,'));
  assert.ok(navSrc.includes('overpaymentDuesCents: selectedOverpaymentChoice ? overpaymentDuesCents : undefined,'));
  assert.ok(navSrc.includes("overpaymentChoiceBox?.querySelector('input[name=\"quickCollectOverpaymentChoice\"]:checked')"));
  assert.ok(navSrc.includes('overpaymentChoice: overpaymentChoice || undefined,'));
  assert.ok(navSrc.includes('overpaymentDuesCents: Number.isFinite(Number(overpaymentDuesCents)) ? Math.round(Number(overpaymentDuesCents)) : undefined,'));
  assert.ok(coreSrc.includes("import { normalizeOverpaymentChoice, overpaymentChoiceOf } from './overpayment-choice.js';"));
  assert.ok(coreSrc.includes('overpaymentChoice: overpaymentChoiceOf(payment),'));
  assert.ok(coreSrc.includes('overpaymentChoice: fields.overpaymentChoice !== undefined ? fields.overpaymentChoice : existingPayment.overpaymentChoice,'));
});

test('Plan 386: the choice box sits on the entry form after the settlement preview', () => {
  const previewAt = indexSrc.indexOf('id="quickCollectSettlementPreview"');
  const choiceAt = indexSrc.indexOf('id="quickCollectOverpaymentChoice"');
  assert.ok(previewAt > 0 && choiceAt > previewAt, 'the choice box must follow the settlement preview');
  assert.ok(indexSrc.includes('id="quickCollectOverpaymentExtra"'));
  assert.ok(indexSrc.includes('name="quickCollectOverpaymentChoice" value="advance"'));
  assert.ok(indexSrc.includes('name="quickCollectOverpaymentChoice" value="credit"'));
  const fieldset = indexSrc.slice(choiceAt, indexSrc.indexOf('</fieldset>', choiceAt));
  assert.ok(!fieldset.includes('checked'), 'no radio is pre-ticked: the choice is offered, never forced');
});

test('Plan 386: the choice shows on both profile rows and the Transactions card', () => {
  assert.ok(appSrc.includes("import { overpaymentChoiceMarkup } from './overpayment-choice.js';"));
  assert.ok(appSrc.includes('function profileOverpaymentChoiceMarkup(payment)'));
  assert.ok(appSrc.includes('function transactionOverpaymentChoiceMarkup(transaction)'));
  assert.equal((appSrc.match(/\$\{profileOverpaymentChoiceMarkup\(payment\)\}/g) || []).length, 2, 'both profile history rows carry it');
  assert.equal((appSrc.match(/\$\{transactionOverpaymentChoiceMarkup\(transaction\)\}/g) || []).length, 1, 'the Transactions card carries it');
});

test('Plan 386: the choice labels exist in both language tables', () => {
  for (const key of ['prof_opc_hist_extra', 'prof_opc_hist_advance', 'prof_opc_hist_credit']) {
    assert.ok(langSrc.includes(`${key}:`), `missing language key ${key}`);
  }
  assert.ok(langSrc.includes("prof_opc_hist_extra: 'Extra',"));
  assert.ok(langSrc.includes("prof_opc_hist_advance: 'as advance',"));
  assert.ok(langSrc.includes("prof_opc_hist_credit: 'held as credit',"));
});

// ---- Guards ----

test('Plan 386: the module is pure — no page, storage, clock, network, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'import ', 'shahdara_', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
  // Exactly the six intended exports, no more.
  const exports = moduleSrc.match(/^export function \w+/gm) || [];
  assert.deepEqual(exports, [
    'export function isOverpaymentChoice',
    'export function overpaymentExtraCents',
    'export function overpaymentChoiceOf',
    'export function normalizeOverpaymentChoice',
    'export function overpaymentChoiceLineText',
    'export function overpaymentChoiceMarkup',
  ]);
});

test('Plan 386: the module never names a fenced neighbour', () => {
  // Fragment-built so this test itself never spells the fenced names.
  const fenced = [
    'advance-pay' + 'ment.js',
    'credit-bal' + 'ance.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 386: styles reuse existing colours only — no new hex in the choice rules', () => {
  const rules = stylesSrc.match(/\.opc-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 4, `expected choice rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.opc-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('Plan 386: no real customer names in the module or this test', () => {
  // Fragment-built so this test itself never spells the real names.
  const names = ['Sa' + 'ad', 'Kir' + 'an', 'Hai' + 'der', 'Shun' + 'aid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi'];
  for (const name of names) {
    assert.ok(!moduleSrc.includes(name), `module must not contain ${name}`);
    assert.ok(!testSrc.includes(name), `test must not contain ${name}`);
  }
});
