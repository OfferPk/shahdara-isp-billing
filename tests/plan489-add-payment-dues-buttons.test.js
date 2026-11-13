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
  // QC Modal Overhaul 2: the figures drive the merged chip row now —
  // the Full/Half dues buttons ARE the static entry chips (the
  // script-rendered .apd-row is deleted). The chips carry
  // data-quick-amount="full|half" and fill from these same figures.
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the merged chip row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  assert.ok(row.includes('data-quick-amount="full"'), 'the Full dues chip must exist');
  assert.ok(row.includes('data-quick-amount="half"'), 'the Half dues chip must exist');
  assert.ok(row.indexOf('data-quick-amount="full"') < row.indexOf('data-quick-amount="half"'), 'Full must come before Half');
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

test('html: the merged chip row carries Full dues, Half dues and Package in order', () => {
  // QC Modal Overhaul 2: addPaymentDuesButtonsHtml is DELETED with
  // the script-rendered .apd-row it built — the dues buttons ARE the
  // static entry chips now. The row carries the three figured chips
  // in order (Full dues, Half dues, Package — addendum A2 brings
  // Package back), then the fixed notes.
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the merged chip row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  for (const type of ['full', 'half', 'package', '2000', '1000', '500']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `the ${type} chip must exist`);
  }
  assert.ok(row.indexOf('data-quick-amount="full"') < row.indexOf('data-quick-amount="half"'), 'Full must come before Half');
  assert.ok(row.indexOf('data-quick-amount="half"') < row.indexOf('data-quick-amount="package"'), 'Half must come before Package');
  assert.ok(!row.includes('data-apd-amount'), 'no script-rendered dues button may remain in the row');
});

test('html: a chip with no known figure shows plain words — the figures are runtime-filled', () => {
  // QC Modal Overhaul 2: the static chips carry plain labels ('Full
  // dues', 'Half dues', 'Package'); the refresh fills the figures
  // ('Full dues (Rs X)') on open. A customer with no dues gets the
  // plain words with a zero figure, never a guessed amount.
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  assert.ok(row.includes('>Full dues</button>'), 'the Full chip starts as plain words');
  assert.ok(row.includes('>Half dues</button>'), 'the Half chip starts as plain words');
  assert.ok(row.includes('>Package</button>'), 'the Package chip starts as plain words');
  assert.ok(!row.includes('data-apd-amount'), 'no chip carries a script-rendered amount');
});

test('html: the refresh labels use the app min-0 decimals — whole rupees print without decimals', () => {
  // QC Modal Overhaul 2: the figures live in the refresh block now
  // (openCustomerCollectionForm), not in a module Html export — the
  // labels still format with toLocaleString('en-PK'), the app's
  // min-0-decimals rule.
  assert.ok(wiringSrc.includes("chip.textContent = `Full dues (Rs ${fullBal > 0 ? fullBal.toLocaleString('en-PK') : '0'})`"), 'the Full refresh label must format min-0 decimals');
  assert.ok(wiringSrc.includes("chip.textContent = `Half dues (Rs ${halfBal > 0 ? halfBal.toLocaleString('en-PK') : '0'})`"), 'the Half refresh label must format min-0 decimals');
  assert.ok(wiringSrc.includes("chip.textContent = `Package (Rs ${packageBal"), 'the Package refresh label must format min-0 decimals');
});

test('html: every chip is type button, so tapping one never submits anything', () => {
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  assert.equal((row.match(/<button /g) || []).length, 6);
  assert.equal((row.match(/type="button"/g) || []).length, 6);
  assert.ok(!row.includes('<form'));
  assert.ok(!row.includes('submit'));
  assert.ok(!row.includes('disabled'));
  assert.ok(!row.includes('readonly'));
});

test('html: the dues chips ARE the entry-form chips now — one row, one handler', () => {
  // QC Modal Overhaul 2: the old split (script-rendered dues row +
  // static chip row, two handlers) is gone — the dues buttons ARE
  // the entry chips, and the single chip handler fills from the
  // shared figures.
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  assert.ok(row.includes('quick-amount-chip'), 'the dues chips must be entry-form chips');
  assert.ok(row.includes('data-quick-amount="full"'), 'Full dues must be a chip');
  assert.ok(row.includes('data-quick-amount="half"'), 'Half dues must be a chip');
  assert.ok(wiringSrc.includes("modal.querySelectorAll('.quick-amount-chip')"));
  assert.ok(!wiringSrc.includes('addPaymentDuesButtonsHtml'), 'the deleted Html export must not be referenced');
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

test('wiring: the controller imports the dues figures module, not the deleted row builder', () => {
  assert.match(wiringSrc, /add-payment-dues-buttons\.js/);
  assert.match(wiringSrc, /addPaymentDuesFigures/);
  // QC Modal Overhaul 2: the Html export is deleted with the row it
  // built — the figures are the module's only export now. The name
  // still appears in one why-comment (the deletion note); what must
  // be gone is the function itself and every call to it.
  assert.doesNotMatch(wiringSrc, /addPaymentDuesButtonsHtml/);
  assert.ok(!wiringSrc.includes('function renderAddPaymentDuesButtons()'), 'the row builder function must be gone');
  assert.ok(!wiringSrc.includes('renderAddPaymentDuesButtons();'), 'no row builder call may remain');
});

test('wiring: the dues row is the static chip row — no script-rendered row ahead of it', () => {
  // QC Modal Overhaul 2: renderAddPaymentDuesButtons() is deleted —
  // the dues buttons ARE the static entry chips in the page, so
  // there is no script-rendered row, no .apd-row, and no before()
  // insertion on the form step.
  assert.ok(!wiringSrc.includes('function renderAddPaymentDuesButtons()'), 'the row builder must be gone');
  assert.ok(!wiringSrc.includes('.apd-row'), 'no apd row class may remain');
  assert.ok(!pageSrc.includes('apd-row'), 'the page carries no apd row');
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the static chip row must exist');
});

test('wiring: the row refreshes from the amount default whenever the picked customer changes', () => {
  const openAt = wiringSrc.indexOf('function openCustomerCollectionForm(');
  assert.notEqual(openAt, -1);
  const openBlock = wiringSrc.slice(openAt, wiringSrc.indexOf('function renderOneScreen(', openAt));
  // QC Modal Overhaul 2: the open flow refreshes the static chips'
  // labels from the shared figures (Full dues / Half dues /
  // Package) — no renderAddPaymentDuesButtons() call remains.
  assert.ok(openBlock.includes('chip.textContent = `Full dues (Rs '), 'the form open must refresh the Full chip label');
  assert.ok(openBlock.includes('chip.textContent = `Half dues (Rs '), 'the form open must refresh the Half chip label');
  assert.ok(openBlock.includes('chip.textContent = `Package (Rs '), 'the form open must refresh the Package chip label');
  assert.ok(openBlock.includes('fullDues: activeDefaults.suggestedAmount'), 'the refresh must read the full-dues default');
  assert.ok(!openBlock.includes('renderAddPaymentDuesButtons();'), 'no dues-buttons render call may remain in the open');
});

test('wiring: tapping a chip fills only the form amount field', () => {
  // QC Modal Overhaul 2: the tap path is the single chip handler
  // now (the .apd-row handler is deleted with its row) — anchored
  // on the chip wiring comment, not on a data-apd-amount lookup.
  const start = wiringSrc.indexOf('// Wire quick amount helper chips');
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 3000);
  assert.match(block, /amountInput\.value = chipFigures\.full\.toFixed\(2\)/);
  assert.match(block, /amountInput\.value = chipFigures\.half\.toFixed\(2\)/);
  assert.match(block, /amountInput\.value = packagePrice\.toFixed\(2\)/);
  assert.match(block, /amountInput\.focus\(\)/);
  assert.ok(!block.includes('requestSubmit'), 'a chip tap must never submit');
  assert.ok(!block.includes('submitOneScreenPayment'), 'a chip tap must never save');
  assert.ok(!block.includes('executeQuickCollection'), 'a chip tap must never post');
  assert.ok(!block.includes('addPayment('), 'a chip tap must never record a payment');
});

test('wiring: the filled amount stays editable — the tap never locks the field', () => {
  const start = wiringSrc.indexOf('// Wire quick amount helper chips');
  const block = wiringSrc.slice(start, start + 3000);
  assert.ok(!block.includes('amountInput.readOnly'), 'chip tap must not lock the amount field');
  assert.ok(!block.includes('amountInput.disabled'), 'chip tap must not disable the amount field');
  assert.ok(block.includes('amountInput.focus();'), 'the field keeps focus so the operator can edit it');
});

test('wiring: a chip tap refreshes the live lines like any other chip tap', () => {
  const start = wiringSrc.indexOf('// Wire quick amount helper chips');
  const block = wiringSrc.slice(start, start + 3000);
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

test('wiring: the entry form chip row is the merged row — Full, Half, Package, fixed notes', () => {
  const rowAt = pageSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the quick-amount row must exist');
  const row = pageSrc.slice(rowAt, pageSrc.indexOf('</div>', rowAt));
  // QC Modal Overhaul 2: one merged row — Full dues, Half dues,
  // Package (addendum A2) + the fixed notes 2,000 / 1,000 / 500.
  // Current Month and 1,500 are dropped (their figures were a second
  // copy of a figure the Full chip or the field already offers).
  for (const type of ['full', 'half', 'package', '2000', '1000', '500']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `merged ${type} chip must stay`);
  }
  assert.ok(!row.includes('data-quick-amount="current"'), 'the Current Month chip must be gone');
  assert.ok(!row.includes('data-quick-amount="1500"'), 'the 1,500 chip must be gone');
  assert.ok(!row.includes('data-apd-amount'), 'the dues buttons are static chips now, not a script row');
});
