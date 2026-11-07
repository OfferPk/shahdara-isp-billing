// Plan 449 — Quick Collect payment for a second connection from
// the same screen: after the first connection's payment, the
// customer's other connection (from the active link record) is
// offered with the dues still owed, recordable in the same pass —
// one counter visit, two payments, two honest receipts. The step
// records a second payment only: it merges no connections and
// changes no bill, payment total, connection, or link record by
// itself. The suggested amount is the customer's remaining dues
// (the still-owes figure), because the app stores no
// per-connection bills to read a second connection's dues from;
// the operator types the actual figure when it differs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  secondConnectionAmountCents,
  secondConnectionFigure,
  secondConnectionValidAmountCents,
  formatSecondConnectionAmount,
  secondConnectionActiveLink,
  secondConnectionStep,
  secondConnectionTotalCents,
  secondConnectionSummaryText,
  secondConnectionStepHtml,
} from '../quick-collect-second-connection.js';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  validatePayment,
  addPayment,
  calculatePaymentAllocations,
} from '../core.js';
import { executeQuickCollection, renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';

const moduleSrc = readFileSync(new URL('../quick-collect-second-connection.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const coreSrc = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const OCT_29 = new Date(2026, 9, 29, 12);

// One synthetic customer with an active link: House (primary) and
// Shop (linked). No real customer names anywhere in this file.
function linkList() {
  return [
    { id: 'BL-1', customer: 'seed-001', primaryConnection: 'House', linkedConnection: 'Shop', linkDate: '2026-10-01', linkNote: '', dateUnlinked: '' },
  ];
}

function firstPayment(overrides = {}) {
  return { connection: '', amountCents: 200000, method: 'Cash', ...overrides };
}

function stepInput(overrides = {}) {
  return {
    links: linkList(),
    customerId: 'seed-001',
    firstPayment: firstPayment(),
    remainingDuesCents: 100000,
    ...overrides,
  };
}

/** One synthetic customer, PKR 3,000/month, October 2026 bill generated. */
function octoberState() {
  let state = createInitialState(['Second Connection Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}

// --- Amounts ---

test('amount: amountCents used as-is, rupees convert exactly once', () => {
  assert.equal(secondConnectionAmountCents({ amountCents: 150050 }), 150050);
  assert.equal(secondConnectionAmountCents({ amount: 1500.5 }), 150050);
  assert.equal(secondConnectionAmountCents({ amount: '1500.5' }), 150050);
  assert.equal(secondConnectionAmountCents({ amount: 0 }), 0);
});

test('amount: anything else is null, never a guessed zero', () => {
  assert.equal(secondConnectionAmountCents(null), null);
  assert.equal(secondConnectionAmountCents(undefined), null);
  assert.equal(secondConnectionAmountCents({}), null);
  assert.equal(secondConnectionAmountCents({ amount: '' }), null);
  assert.equal(secondConnectionAmountCents({ amount: 'abc' }), null);
  assert.equal(secondConnectionAmountCents({ amount: NaN }), null);
});

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatSecondConnectionAmount(3000), 'PKR 3,000');
  assert.equal(formatSecondConnectionAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatSecondConnectionAmount(0), 'PKR 0');
});

test('amount: a missing figure is "not a number", never zero', () => {
  assert.equal(formatSecondConnectionAmount(null), 'Not set');
  assert.equal(formatSecondConnectionAmount(undefined), 'Not set');
  assert.equal(formatSecondConnectionAmount(''), 'Not set');
  assert.equal(formatSecondConnectionAmount(true), 'Not set');
  assert.equal(formatSecondConnectionAmount('abc'), 'Not set');
  assert.equal(formatSecondConnectionAmount(NaN), 'Not set');
});

test('figure: null, undefined, empty, or boolean is "not a number"', () => {
  assert.equal(secondConnectionFigure(null), null);
  assert.equal(secondConnectionFigure(undefined), null);
  assert.equal(secondConnectionFigure(''), null);
  assert.equal(secondConnectionFigure(true), null);
  assert.equal(secondConnectionFigure(150000), 150000);
  assert.equal(secondConnectionFigure(0), 0);
});

test('amount: only a positive amount is a usable second amount', () => {
  assert.equal(secondConnectionValidAmountCents({ amount: 1000 }), 100000);
  assert.equal(secondConnectionValidAmountCents({ amount: 0 }), null);
  assert.equal(secondConnectionValidAmountCents({ amount: -5 }), null);
  assert.equal(secondConnectionValidAmountCents({ amount: 'abc' }), null);
  assert.equal(secondConnectionValidAmountCents(null), null);
});

// --- Active link ---

test('link: the active link is found by folded customer id', () => {
  const link = secondConnectionActiveLink(linkList(), '  SEED-001 ');
  assert.equal(link.primaryConnection, 'House');
  assert.equal(link.linkedConnection, 'Shop');
});

test('link: an unlinked record offers no step', () => {
  const links = linkList();
  links[0].dateUnlinked = '2026-11-01';
  assert.equal(secondConnectionActiveLink(links, 'seed-001'), null);
});

test('link: no list, no match, or a blank side offers nothing', () => {
  assert.equal(secondConnectionActiveLink([], 'seed-001'), null);
  assert.equal(secondConnectionActiveLink(null, 'seed-001'), null);
  assert.equal(secondConnectionActiveLink(linkList(), 'seed-999'), null);
  assert.equal(secondConnectionActiveLink(linkList(), ''), null);
  const blank = linkList();
  blank[0].linkedConnection = '   ';
  assert.equal(secondConnectionActiveLink(blank, 'seed-001'), null);
});

test('link: the same connection on both sides is not a link', () => {
  const links = linkList();
  links[0].linkedConnection = 'house';
  assert.equal(secondConnectionActiveLink(links, 'seed-001'), null);
});

// --- Step ---

test('step: the linked connection is the other one, dues are the suggestion', () => {
  const step = secondConnectionStep(stepInput());
  assert.equal(step.firstConnection, 'House');
  assert.equal(step.secondConnection, 'Shop');
  assert.equal(step.firstPaymentCents, 200000);
  assert.equal(step.suggestedCents, 100000);
  assert.equal(step.method, 'Cash');
});

test('step: a first payment that names the linked connection flips the pair', () => {
  const step = secondConnectionStep(stepInput({
    firstPayment: firstPayment({ connection: 'shop' }),
  }));
  assert.equal(step.firstConnection, 'Shop');
  assert.equal(step.secondConnection, 'House');
});

test('step: a first payment that names the primary connection keeps the pair', () => {
  const step = secondConnectionStep(stepInput({
    firstPayment: firstPayment({ connection: 'HOUSE' }),
  }));
  assert.equal(step.firstConnection, 'House');
  assert.equal(step.secondConnection, 'Shop');
});

test('step: no step without a link, a real first payment, or dues left', () => {
  assert.equal(secondConnectionStep(stepInput({ links: [] })), null);
  assert.equal(secondConnectionStep(stepInput({ firstPayment: firstPayment({ amountCents: 0 }) })), null);
  assert.equal(secondConnectionStep(stepInput({ firstPayment: null })), null);
  assert.equal(secondConnectionStep(stepInput({ remainingDuesCents: 0 })), null);
  assert.equal(secondConnectionStep(stepInput({ remainingDuesCents: null })), null);
  assert.equal(secondConnectionStep(stepInput({ remainingDuesCents: -100 })), null);
  assert.equal(secondConnectionStep(stepInput({ customerId: '' })), null);
});

// --- Total and summary ---

test('total: the two payments together sum exactly', () => {
  assert.equal(secondConnectionTotalCents(200000, 100000), 300000);
  assert.equal(secondConnectionTotalCents(200000, 150050), 350050);
  assert.equal(secondConnectionTotalCents(null, 100000), null);
  assert.equal(secondConnectionTotalCents(200000, null), null);
  assert.equal(secondConnectionTotalCents(200000, 'abc'), null);
});

test('summary: first paid, second amount, and the total of the pair', () => {
  const step = secondConnectionStep(stepInput());
  assert.equal(
    secondConnectionSummaryText(step, 100000),
    'House PKR 2,000 paid · Shop PKR 1,000 → Total paid PKR 3,000'
  );
});

test('summary: an unusable second amount falls back to the suggestion', () => {
  const step = secondConnectionStep(stepInput());
  assert.equal(
    secondConnectionSummaryText(step, null),
    'House PKR 2,000 paid · Shop PKR 1,000 → Total paid PKR 3,000'
  );
  assert.equal(secondConnectionSummaryText(null, 100000), '');
});

// --- Markup ---

test('html: the step names the other connection and prefills the suggestion', () => {
  const step = secondConnectionStep(stepInput());
  const html = secondConnectionStepHtml(step);
  assert.ok(html.includes('Second connection — Shop'), 'missing second connection name');
  assert.ok(html.includes('id="sccSecondConnectionAmount"'), 'missing amount input');
  assert.ok(html.includes('value="1000.00"'), 'amount input must prefill the suggestion');
  assert.ok(html.includes('Method: Cash (same as the first payment)'), 'missing method line');
  assert.ok(html.includes('id="sccSecondConnectionTotal"'), 'missing total line');
  assert.ok(html.includes('id="sccSecondConnectionRecord"'), 'missing record button');
  assert.ok(html.includes('id="sccSecondConnectionDismiss"'), 'missing skip button');
  assert.ok(html.includes('Total paid PKR 3,000'), 'missing running total');
});

test('html: a connection name can never break out of the step', () => {
  const step = secondConnectionStep(stepInput({
    links: [{ id: 'BL-1', customer: 'seed-001', primaryConnection: 'House', linkedConnection: '<script>alert(1)</script>', linkDate: '2026-10-01', linkNote: '', dateUnlinked: '' }],
  }));
  const html = secondConnectionStepHtml(step);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw connection name leaked into markup');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped connection name missing');
});

test('html: an unusable step renders nothing', () => {
  assert.equal(secondConnectionStepHtml(null), '');
  assert.equal(secondConnectionStepHtml({}), '');
  assert.equal(secondConnectionStepHtml({ firstConnection: 'House', secondConnection: '', suggestedCents: 100000 }), '');
  assert.equal(secondConnectionStepHtml({ firstConnection: 'House', secondConnection: 'Shop', suggestedCents: 0 }), '');
});

// --- Core connection tag ---

test('tag: validatePayment keeps a connection, folded to one line and capped', () => {
  const validated = validatePayment({
    date: '2026-10-29', amount: 1000, method: 'Cash', connection: '  Shop\n',
  }, OCT_29);
  assert.equal(validated.connection, 'Shop');
  const long = validatePayment({
    date: '2026-10-29', amount: 1000, method: 'Cash', connection: 'S'.repeat(80),
  }, OCT_29);
  assert.equal(long.connection.length, 60);
});

test('tag: a payment without a connection stores nothing extra', () => {
  const validated = validatePayment({
    date: '2026-10-29', amount: 1000, method: 'Cash',
  }, OCT_29);
  assert.ok(!('connection' in validated), 'ordinary payments must stay byte-identical');
  const blank = validatePayment({
    date: '2026-10-29', amount: 1000, method: 'Cash', connection: '   ',
  }, OCT_29);
  assert.ok(!('connection' in blank), 'a blank connection stores nothing');
});

test('tag: the tag rides addPayment and never changes the allocation', () => {
  const tagged = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: 1000, method: 'Cash', connection: 'Shop',
  }, OCT_29);
  const plain = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: 1000, method: 'Cash',
  }, OCT_29);
  const taggedPayment = tagged.customers[0].bills.find((b) => b.month === '2026-10').payments[0];
  const plainPayment = plain.customers[0].bills.find((b) => b.month === '2026-10').payments[0];
  assert.equal(taggedPayment.connection, 'Shop');
  assert.ok(!('connection' in plainPayment), 'untagged record must not gain the field');
  const taggedAllocations = calculatePaymentAllocations(tagged);
  const plainAllocations = calculatePaymentAllocations(plain);
  assert.equal(
    taggedAllocations.forMonth('seed-001', '2026-10').balanceDueCents,
    plainAllocations.forMonth('seed-001', '2026-10').balanceDueCents
  );
});

// --- End to end: two payments, two receipts ---

test('end to end: first and second payments record separately with their own receipts', () => {
  const state = octoberState();
  const first = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-29', method: 'Cash',
  }, OCT_29);
  assert.equal(first.receipt.amount, 2000);
  assert.equal(first.receipt.connection, '');
  const second = executeQuickCollection(first.nextState, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-29', method: 'Cash', connection: 'Shop',
  }, OCT_29);
  assert.equal(second.receipt.amount, 1000);
  assert.equal(second.receipt.connection, 'Shop');
  assert.notEqual(second.receipt.paymentId, first.receipt.paymentId);
  assert.notEqual(second.receipt.receiptNumber, first.receipt.receiptNumber);
  const paid = first.receipt.amount + second.receipt.amount;
  assert.equal(paid, 3000);
  const storedSecond = second.nextState.customers[0].bills
    .find((b) => b.month === '2026-10').payments
    .find((p) => p.id === second.receipt.paymentId);
  assert.equal(storedSecond.connection, 'Shop');
  const storedFirst = second.nextState.customers[0].bills
    .find((b) => b.month === '2026-10').payments
    .find((p) => p.id === first.receipt.paymentId);
  assert.ok(!('connection' in storedFirst), 'the first payment carries no connection');
  const allocations = calculatePaymentAllocations(second.nextState);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
});

test('card: the second receipt names its connection, an ordinary receipt does not', () => {
  const state = octoberState();
  const first = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-29', method: 'Cash',
  }, OCT_29);
  const second = executeQuickCollection(first.nextState, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-29', method: 'Cash', connection: 'Shop',
  }, OCT_29);
  const firstCard = renderQuickCollectReceiptCardHtml(first.receipt);
  assert.ok(!firstCard.includes('>Connection<'), 'an ordinary receipt must show no connection row');
  const secondCard = renderQuickCollectReceiptCardHtml(second.receipt);
  assert.ok(secondCard.includes('>Connection<'), 'the second receipt must name its connection');
  assert.ok(secondCard.includes('Shop'), 'the second receipt must show the connection name');
});

// --- Wiring ---

test('wiring: the Quick Collect controller imports the second-connection step', () => {
  assert.ok(wiringSrc.includes("from './quick-collect-second-connection.js'"), 'missing module import');
  for (const name of ['secondConnectionStep,', 'secondConnectionStepHtml,', 'secondConnectionSummaryText,', 'secondConnectionTotalCents,', 'secondConnectionValidAmountCents,']) {
    assert.ok(wiringSrc.includes(name), `missing step import ${name}`);
  }
  assert.ok(wiringSrc.includes('stillOwesCents, stillOwesLine, stillOwesLineHtml'), 'missing still-owes cents import');
});

test('wiring: the save path carries the connection onto the payment and its receipt', () => {
  assert.ok(wiringSrc.includes('connection: connection ? String(connection).trim() : undefined,'), 'missing connection on the save path');
  assert.ok(wiringSrc.includes("connection: newPayment?.connection || '',"), 'missing connection on the receipt');
  assert.ok(wiringSrc.includes('>Connection<'), 'missing connection row on the receipt card');
});

test('wiring: the success screen renders the step and records through the same save path', () => {
  assert.ok(wiringSrc.includes("document.getElementById('sccSecondConnectionStep')"), 'missing step host ref');
  assert.ok(wiringSrc.includes('function renderSecondConnectionStep()'), 'missing step renderer');
  assert.ok(wiringSrc.includes('renderSecondConnectionStep();'), 'step never rendered after a save');
  assert.ok(wiringSrc.includes('executeQuickCollection(postSaveState, {'), 'second payment must reuse the save path');
  assert.ok(wiringSrc.includes('connection: step.secondConnection,'), 'second payment must name its connection');
  assert.ok(wiringSrc.includes('secondConnectionRecorded = false;'), 'pass flag must reset for a fresh save');
  assert.ok(wiringSrc.includes('loadBillingLinks'), 'missing billing-link loader option');
});

test('wiring: the host passes its billing-link loader into the controller', () => {
  assert.ok(appSrc.includes('loadBillingLinks: () => loadBillingLinks(),'), 'missing loader option in app.js');
});

test('wiring: the success step hosts the second-connection step', () => {
  assert.ok(pageSrc.includes('<div id="sccSecondConnectionStep" class="scc-second-connection" aria-live="polite" hidden>'), 'missing step host on the success step');
});

// --- Fences ---

test('fences: the second-connection module is pure — no clock, no storage, no store key', () => {
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!/new Date\(/.test(moduleSrc), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('sessionStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('shahdara_'), 'module must not hold a store key');
  assert.ok(!moduleSrc.includes('import '), 'module must be import-free');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not name the OLT word');
});

test('fences: the module header never names a fenced file literally', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenced = [
    'combined-' + 'dues.js',
    'billing-' + 'link.js',
    'full-history-' + 'list.js',
    'quick-collect-round-' + 'totals.js',
    'quick-collect-still-' + 'owes.js',
    'quick-collect-big-name-' + 'confirm.js',
    'quick-collect-mohalla-' + 'filter.js',
    'quick-collect-end-of-day-' + 'summary.js',
    'daily-entry-' + 'summary.js',
    'daily-target-' + 'progress.js',
    'save-confirmation-' + 'summary.js',
    'receipt-' + 'preview.js',
    'success-next-' + 'steps.js',
    'offline-saved-' + 'badge.js',
    'receipt-share-' + 'draft.js',
    'pending-clearance-' + 'flag.js',
    'cash-change-' + 'calculator.js',
    'remembered-' + 'method.js',
    'dues-amount-' + 'default.js',
    'quick-collect-one-' + 'screen.js',
    'quick-collect-amount-' + 'keypad.js',
    'double-tap-save-' + 'guard.js',
    'big-wallet-method-' + 'buttons.js',
    'name-prefix-' + 'lookup.js',
    'recent-quick-' + 'pick.js',
    'last-four-digits-' + 'search.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the second-connection step', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'combined-' + 'dues.js',
    'billing-' + 'link.js',
    'full-history-' + 'list.js',
    'quick-collect-round-' + 'totals.js',
    'quick-collect-still-' + 'owes.js',
    'quick-collect-big-name-' + 'confirm.js',
    'quick-collect-mohalla-' + 'filter.js',
    'quick-collect-end-of-day-' + 'summary.js',
    'daily-entry-' + 'summary.js',
    'save-confirmation-' + 'summary.js',
    'success-next-' + 'steps.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('SecondConnection'), `${file} must not reference the second-connection step`);
    assert.ok(!src.includes('sccSecondConnection'), `${file} must not reference the second-connection step`);
  }
});

test('fences: the core connection tag is only a tag — it changes no total', () => {
  assert.ok(coreSrc.includes('...(cleanConnection ? { connection: cleanConnection } : {}),'), 'missing conditional tag on the validated payment');
  assert.ok(!coreSrc.includes('connectionCents'), 'the tag must not enter any money figure');
});

// --- Styles ---

test('styles: the second-connection rules lay out only — no new hex', () => {
  const rules = stylesSrc.match(/\.scc-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'missing .scc-second-connection rule');
  const baseline = stylesSrc.replace(/\.scc-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
