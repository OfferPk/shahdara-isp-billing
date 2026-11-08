// Plan 489 — Add payment full-dues and half-dues one-tap amount
// buttons: two buttons on the Add payment form step — full dues,
// half dues — that fill the amount field with the figure they name
// and nothing else. Tapping never posts the payment, and the filled
// amount stays freely editable afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPaymentDuesFigures,
  addPaymentDuesButtonsHtml,
} from '../add-payment-dues-buttons.js';
import {
  addPayment,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

const moduleSrc = readFileSync(new URL('../add-payment-dues-buttons.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const testSrc = readFileSync(new URL(import.meta.url), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);

// Three open bills at PKR 3,000 each: total dues PKR 9,000, and the
// customer is on the PKR 3,000 monthly selling amount.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

// The customer's full dues in rupees, read straight from the
// allocation engine's own figures on the same fixture: every open
// bill's remaining balance, plus unpaid manual baqaya in cents as
// supplied — the same rule the amount default the form fills from
// follows, computed here independently of it.
function fixtureFullDues(state, baqayaCents = 0) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let duesCents = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) duesCents += remaining;
  }
  if (baqayaCents > 0) duesCents += baqayaCents;
  return duesCents / 100;
}

function fixtureFigures() {
  return addPaymentDuesFigures({ fullDues: 9000 });
}

test('acceptance: the fixture fills full dues and half dues from the customer record', () => {
  const state = stateWithBills(NOV_6);
  const fullDues = fixtureFullDues(state);
  assert.equal(fullDues, 9000);
  const figures = addPaymentDuesFigures({ fullDues });
  assert.deepEqual(figures, { full: 9000, half: 4500 });
  const html = addPaymentDuesButtonsHtml(figures);
  assert.ok(html.includes('data-apd-amount="9000"'));
  assert.ok(html.includes('data-apd-amount="4500"'));
  assert.ok(html.indexOf('data-apd-amount="9000"') < html.indexOf('data-apd-amount="4500"'));
});

test('acceptance: a part-paid customer fills the smaller full dues, not the old total', () => {
  let state = stateWithBills(NOV_6);
  state = addPayment(state, 'seed-001', '2026-09', { amount: 3000, date: '2026-09-05', method: 'Cash' }, NOV_6);
  const figures = addPaymentDuesFigures({ fullDues: fixtureFullDues(state) });
  assert.deepEqual(figures, { full: 6000, half: 3000 });
});

test('acceptance: unpaid manual baqaya joins the full dues the buttons fill', () => {
  const state = stateWithBills(NOV_6);
  const figures = addPaymentDuesFigures({ fullDues: fixtureFullDues(state, 50000) });
  assert.deepEqual(figures, { full: 9500, half: 4750 });
});

test('figures: half dues are half the full dues, rounded to whole rupees', () => {
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: 3001 }),
    { full: 3001, half: 1501 },
  );
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: 1500.5 }),
    { full: 1500.5, half: 750 },
  );
});

test('figures: half of one rupee is one rupee, never zero', () => {
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: 1 }),
    { full: 1, half: 1 },
  );
});

test('figures: half of a sub-rupee due is nothing, never a guessed round figure', () => {
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: 0.4 }),
    { full: 0.4, half: null },
  );
});

test('figures: no dues means no full and no half', () => {
  assert.deepEqual(addPaymentDuesFigures({ fullDues: null }), { full: null, half: null });
  assert.deepEqual(addPaymentDuesFigures({ fullDues: 0 }), { full: null, half: null });
});

test('figures: zero, negative, blank, boolean, and non-numeric figures are not amounts', () => {
  for (const bad of [0, -3000, '', true, false, 'abc', NaN, undefined]) {
    assert.deepEqual(
      addPaymentDuesFigures({ fullDues: bad }),
      { full: null, half: null },
      `expected nulls for ${String(bad)}`,
    );
  }
});

test('figures: a numeric string is a usable figure, exactly as the entry form reads it', () => {
  assert.deepEqual(
    addPaymentDuesFigures({ fullDues: '3000' }),
    { full: 3000, half: 1500 },
  );
});

test('figures: called with nothing, every figure is null', () => {
  assert.deepEqual(addPaymentDuesFigures(), { full: null, half: null });
  assert.deepEqual(addPaymentDuesFigures({}), { full: null, half: null });
  assert.deepEqual(addPaymentDuesFigures(null), { full: null, half: null });
});

test('figures: inputs are never mutated', () => {
  const input = Object.freeze({ fullDues: 3000 });
  assert.deepEqual(addPaymentDuesFigures(input), { full: 3000, half: 1500 });
});

test('html: the two buttons render in order with their figures in the labels', () => {
  assert.equal(
    addPaymentDuesButtonsHtml(fixtureFigures()),
    '<button type="button" class="qab-amount-chip" data-apd-amount="9000">Full dues (Rs 9,000)</button>'
    + '<button type="button" class="qab-amount-chip" data-apd-amount="4500">Half dues (Rs 4,500)</button>',
  );
});

test('html: a button with no known figure shows plain words and carries no amount', () => {
  assert.equal(
    addPaymentDuesButtonsHtml({ full: null, half: null }),
    '<button type="button" class="qab-amount-chip">Full dues</button>'
    + '<button type="button" class="qab-amount-chip">Half dues</button>',
  );
});

test('html: a known figure and an unknown figure mix — only the known one carries an amount', () => {
  const html = addPaymentDuesButtonsHtml({ full: 3000, half: null });
  assert.ok(html.includes('data-apd-amount="3000"'));
  assert.ok(html.includes('>Half dues</button>'));
  assert.equal((html.match(/data-apd-amount=/g) || []).length, 1);
});

test('html: every button is type button, so tapping one never submits anything', () => {
  const html = addPaymentDuesButtonsHtml(fixtureFigures());
  assert.equal((html.match(/<button /g) || []).length, 2);
  assert.equal((html.match(/type="button"/g) || []).length, 2);
  assert.ok(!html.includes('<form'));
  assert.ok(!html.includes('submit'));
  assert.ok(!html.includes('disabled'));
  assert.ok(!html.includes('readonly'));
});

test('html: labels use the app min-0 decimals — whole rupees print without decimals', () => {
  const html = addPaymentDuesButtonsHtml({ full: 1500.5, half: 750 });
  assert.ok(html.includes('Full dues (Rs 1,500.5)'));
  assert.ok(html.includes('Half dues (Rs 750)'));
});

test('html: the buttons are not entry-form chips — the old chip handler never sees them', () => {
  const html = addPaymentDuesButtonsHtml(fixtureFigures());
  assert.ok(!html.includes('quick-amount-chip'));
  assert.ok(!html.includes('data-quick-amount'));
  assert.ok(wiringSrc.includes("modal.querySelectorAll('.quick-amount-chip')"));
});

test('module: pure — no clock, page, storage, network, or store key', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('document.'), 'module must not touch the page');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('fetch('), 'module must not touch the network');
  assert.ok(!moduleSrc.includes('window.'), 'module must not touch the window');
  assert.ok(!moduleSrc.includes('shahdara_'), 'module keeps no store');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not name the standalone word');
  assert.ok(!/^import /m.test(moduleSrc), 'module is import-free');
  assert.ok(!moduleSrc.includes("from './"), 'module is import-free');
});

test('module: the header never names a fenced file literally', () => {
  const fenced = [
    'dues-' + 'amount-default',
    'quick-collect-' + 'one-screen',
    'name-' + 'prefix-lookup',
    'recent-' + 'quick-pick',
    'quick-' + 'amount-buttons',
    'transaction-' + 'prefill',
    'save-' + 'confirmation-summary',
    'full-' + 'history-list',
    'balance-' + 'rollforward',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name} literally`);
  }
});

test('module: fixtures are generic — no real customer name in the module or test', () => {
  // Fragment-built so this test itself never spells the real names.
  const real = ['Ki' + 'ran', 'Bi' + 'lal', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Sa' + 'ad'];
  for (const name of real) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('wiring: the controller imports the dues buttons module', () => {
  assert.match(wiringSrc, /add-payment-dues-buttons\.js/);
  assert.match(wiringSrc, /addPaymentDuesFigures/);
  assert.match(wiringSrc, /addPaymentDuesButtonsHtml/);
});

test('wiring: the row sits ahead of the entry form chip row on the form step', () => {
  const start = wiringSrc.indexOf('function renderAddPaymentDuesButtons()');
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 2200);
  assert.match(block, /stepForm\.querySelector\('\.qc-quick-amount-chips'\)/);
  assert.match(block, /stepForm\.querySelector\('\.apd-row'\)/);
  assert.match(block, /className = 'qc-quick-amount-chips apd-row'/);
  assert.match(block, /chipsRow\.before\(duesRow\)/);
  assert.match(block, /duesRow\.innerHTML = addPaymentDuesButtonsHtml\(figures\)/);
});

test('wiring: the row refreshes from the amount default whenever the picked customer changes', () => {
  const openAt = wiringSrc.indexOf('function openCustomerCollectionForm(');
  assert.notEqual(openAt, -1);
  const openBlock = wiringSrc.slice(openAt, wiringSrc.indexOf('function renderOneScreen(', openAt));
  assert.ok(openBlock.includes('renderAddPaymentDuesButtons();'), 'the form open must refresh the dues buttons');
  const renderAt = wiringSrc.indexOf('function renderAddPaymentDuesButtons()');
  const renderBlock = wiringSrc.slice(renderAt, renderAt + 2200);
  assert.match(renderBlock, /fullDues: activeDefaults\?\.suggestedAmount \?\? null/);
});

test('wiring: tapping a button fills only the form amount field', () => {
  const start = wiringSrc.indexOf('data-apd-amount');
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 1100);
  assert.match(block, /amountInput\.value = amount\.toFixed\(2\)/);
  assert.match(block, /amountInput\.focus\(\)/);
  assert.ok(!block.includes('requestSubmit'), 'a button tap must never submit');
  assert.ok(!block.includes('submitOneScreenPayment'), 'a button tap must never save');
  assert.ok(!block.includes('executeQuickCollection'), 'a button tap must never post');
  assert.ok(!block.includes('addPayment('), 'a button tap must never record a payment');
});

test('wiring: the filled amount stays editable — the tap never locks the field', () => {
  const start = wiringSrc.indexOf('data-apd-amount');
  const block = wiringSrc.slice(start, start + 1100);
  assert.ok(!block.includes('amountInput.readOnly'), 'button tap must not lock the amount field');
  assert.ok(!block.includes('amountInput.disabled'), 'button tap must not disable the amount field');
  assert.ok(block.includes('amountInput.focus();'), 'the field keeps focus so the operator can edit it');
});

test('wiring: a button tap refreshes the live lines like any other chip tap', () => {
  const start = wiringSrc.indexOf('data-apd-amount');
  const block = wiringSrc.slice(start, start + 1100);
  assert.ok(block.includes('renderAmountWordsLine();'), 'words refresh after the fill');
  assert.ok(block.includes('renderSettlementPreview();'), 'preview refreshes after the fill');
  assert.ok(block.includes('renderOverpaymentChoice();'), 'choice refreshes after the fill');
  assert.ok(block.includes('renderUnderpaymentWarning();'), 'warning refreshes after the fill');
});

test('wiring: the row is rendered by script — no new element id in the page', () => {
  assert.ok(!pageSrc.includes('apd-'), 'the page carries no apd element id');
});

test('styles: the dues buttons reuse the one-screen buttons look — no new style', () => {
  assert.ok(stylesSrc.includes('.qab-amount-chip'));
  assert.ok(stylesSrc.includes('.qab-amount-chip:hover'));
  assert.match(stylesSrc, /\[data-theme="dark"\] #quickCollectModal \.qab-amount-chip/);
});

test('wiring: the entry form chip row is untouched — its buttons and figures stay', () => {
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the quick-amount row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  for (const type of ['full', 'package', 'current', 'half', '500', '1000', '1500', '2000']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `existing ${type} button must stay`);
  }
  assert.ok(!row.includes('data-apd-amount'), 'the dues buttons are a script-rendered row, not static chips');
});
