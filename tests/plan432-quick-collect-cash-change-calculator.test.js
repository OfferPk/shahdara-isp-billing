// Plan 432 — Quick Collect cash change calculator: one calculator
// on the Quick Collect screen — cash received, payment amount, and
// the change due in plain words and figures, updated as the cash
// figure is typed. It calculates only and posts nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatCashChangeAmount,
  cashChangeFigureCents,
  cashChangeCents,
  cashChangeShortfallCents,
  cashChangeLineText,
  cashChangeLineHtml,
} from '../cash-change-calculator.js';

const moduleSrc = readFileSync(new URL('../cash-change-calculator.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The same fixture the acceptance uses: the customer hands over a
// Rs 5,000 note for a Rs 3,000 payment — Rs 2,000 change is due.
test('acceptance: the change shown always equals cash received minus the payment amount', () => {
  assert.equal(cashChangeCents(5000, 3000), 200000);
  assert.equal(cashChangeLineText(5000, 3000), 'Change due: PKR 2,000');
  assert.equal(
    cashChangeLineHtml(5000, 3000),
    '<p class="chc-change-line">Change due: PKR 2,000</p>',
  );
});

test('change: exact cash means no change due, and the line says so plainly', () => {
  assert.equal(cashChangeCents(3000, 3000), 0);
  assert.equal(cashChangeShortfallCents(3000, 3000), null);
  assert.equal(cashChangeLineText(3000, 3000), 'Exact amount — no change due');
});

test('change: cash below the amount shows "not enough cash" instead of a negative change', () => {
  assert.equal(cashChangeCents(2500, 3000), null);
  assert.equal(cashChangeShortfallCents(2500, 3000), 50000);
  assert.equal(cashChangeLineText(2500, 3000), 'Not enough cash — PKR 500 more needed');
  assert.equal(cashChangeLineText(0, 3000), 'Not enough cash — PKR 3,000 more needed');
  assert.ok(!cashChangeLineText(2500, 3000).includes('-'));
});

test('change: a paisa payment works in cents, never in float rupees', () => {
  assert.equal(cashChangeCents(5000, 1500.5), 349950);
  assert.equal(cashChangeLineText(5000, 1500.5), 'Change due: PKR 3,499.5');
  assert.equal(cashChangeCents('5000.25', '3000.10'), 200015);
});

test('change: numeric strings and comma-grouped figures are usable, exactly as typed', () => {
  assert.equal(cashChangeCents('5000', '3000'), 200000);
  assert.equal(cashChangeCents('5,000', '3,000'), 200000);
  assert.equal(cashChangeLineText('5000', '3000'), 'Change due: PKR 2,000');
});

test('figures: null, undefined, blank, boolean, non-numeric, and negative figures are not amounts', () => {
  for (const bad of [null, undefined, '', '   ', true, false, 'abc', NaN, -500]) {
    assert.equal(cashChangeFigureCents(bad), null, `expected null for ${String(bad)}`);
    assert.equal(cashChangeLineText(bad, 3000), '', `expected no line for cash ${String(bad)}`);
    assert.equal(cashChangeLineText(5000, bad), '', `expected no line for amount ${String(bad)}`);
  }
});

test('figures: no payment amount means no line — a missing amount never reads as free', () => {
  assert.equal(cashChangeLineText(5000, 0), '');
  assert.equal(cashChangeLineText(5000, ''), '');
  assert.equal(cashChangeLineText('', 3000), '');
  assert.equal(cashChangeLineText(null, null), '');
  assert.equal(cashChangeLineHtml(5000, 0), '');
});

test('figures: inputs are never mutated', () => {
  const cash = Object.freeze('5000');
  const amount = Object.freeze('3000');
  assert.equal(cashChangeLineText(cash, amount), 'Change due: PKR 2,000');
});

test('format: PKR amounts print with min-0 decimals, like the rest of the app', () => {
  assert.equal(formatCashChangeAmount(200000), 'PKR 2,000');
  assert.equal(formatCashChangeAmount(150050), 'PKR 1,500.5');
  assert.equal(formatCashChangeAmount(50), 'PKR 0.5');
  assert.equal(formatCashChangeAmount(0), 'PKR 0');
  assert.equal(formatCashChangeAmount(NaN), '');
});

test('html: hostile typed text never reaches the markup', () => {
  assert.equal(cashChangeLineHtml('<script>', 3000), '');
  assert.equal(cashChangeLineHtml(5000, '<script>'), '');
  assert.ok(!cashChangeLineHtml(5000, 3000).includes('<script>'));
});

test('purity: the module is pure and import-free, with no store and no live handles', () => {
  assert.ok(!moduleSrc.includes('localStorage'), 'no store');
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('new Date('), 'no Date');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now');
  assert.ok(!moduleSrc.includes('document.'), 'no document');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!moduleSrc.includes('window.'), 'no window');
  assert.ok(!moduleSrc.includes('import '), 'no imports');
  assert.ok(!moduleSrc.includes('addPayment'), 'never posts');
  assert.ok(!moduleSrc.includes('executeQuickCollection'), 'never posts');
});

test('fences: the module header never names a fenced module literally', () => {
  // Fragment-built, so this test's own source never carries the
  // fenced names literally either.
  const fenced = [
    'remembered-' + 'method',
    'dues-amount-' + 'default',
    'quick-collect-' + 'one-screen',
    'name-prefix-' + 'lookup',
    'recent-quick-' + 'pick',
    'one-screen-quick-' + 'amounts',
    'quick-amount-' + 'buttons',
    'save-confirmation-' + 'summary',
    'full-history-' + 'list',
    'balance-' + 'rollforward',
    'loose-change-' + 'credit',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('wiring: the controller imports the cash change calculator module', () => {
  assert.match(wiringSrc, /cash-change-calculator\.js/);
  assert.match(wiringSrc, /cashChangeLineText/);
});

test('wiring: the controller grabs the box, the cash input, and the change line', () => {
  assert.match(wiringSrc, /quickCollectCashChangeBox/);
  assert.match(wiringSrc, /quickCollectCashReceivedInput/);
  assert.match(wiringSrc, /quickCollectCashChangeLine/);
});

test('wiring: renderCashChange shows the box only for a cash method and never for a split payment', () => {
  const start = wiringSrc.indexOf('function renderCashChange()');
  assert.ok(start > -1, 'renderCashChange must be defined');
  const block = wiringSrc.slice(start, start + 900);
  assert.match(block, /isCashPaymentMethod\(method\)/);
  assert.match(block, /splitToggle\?\.checked/);
  assert.match(block, /cashChangeBox\.hidden = !show/);
  assert.match(block, /cashChangeLineText\(cashReceivedInput\?\.value, amountInput\?\.value\)/);
  assert.match(block, /cashChangeLine\.hidden = line === ''/);
});

test('wiring: the change follows every keystroke in both the amount and the cash field', () => {
  assert.match(wiringSrc, /amountInput\?\.addEventListener\('input', \(\) => renderCashChange\(\)\)/);
  assert.match(wiringSrc, /cashReceivedInput\?\.addEventListener\('input', \(\) => renderCashChange\(\)\)/);
});

test('wiring: a method change re-shows or hides the calculator through the shop sync', () => {
  const start = wiringSrc.indexOf('function syncShopChips()');
  assert.ok(start > -1, 'syncShopChips must be defined');
  const block = wiringSrc.slice(start, start + 700);
  assert.ok(block.includes('renderCashChange();'), 'method change must refresh the calculator');
  assert.ok(
    block.indexOf('renderCashChange();') < block.indexOf("if (!cashFamily) return;"),
    'the refresh must run before the non-cash early return',
  );
});

test('wiring: splitting the payment hides the calculator, and un-splitting re-shows it', () => {
  assert.match(wiringSrc, /splitToggle\?\.addEventListener\('change', \(\) => renderCashChange\(\)\)/);
});

test('wiring: the form opens with an empty cash field and a fresh calculator', () => {
  const start = wiringSrc.indexOf("syncMethodChips(activeDefaults.defaultMethod ?? '');");
  assert.ok(start > -1, 'form-open method pre-select must exist');
  const block = wiringSrc.slice(start, start + 400);
  assert.ok(block.includes("if (cashReceivedInput) cashReceivedInput.value = '';"));
  assert.ok(block.includes('renderCashChange();'));
});

test('wiring: a programmatic amount set re-computes the change — concession, waiver, chips, loose change, keypad', () => {
  // Eleven call sites plus the definition itself.
  // Plan 442: the amount keypad is the tenth programmatic
  // amount-set site — a keypad tap sets the amount, so the change
  // re-computes like every other site.
  // Plan 489: the Add payment dues buttons are the eleventh
  // programmatic amount-set site — a button tap fills the amount,
  // so the change re-computes like every other site. The count
  // moves from 11 to 12 for that one new call site only; the intent
  // (every programmatic amount set re-computes the change) is
  // unchanged.
  const calls = (wiringSrc.match(/renderCashChange\(\)/g) || []).length;
  assert.equal(calls, 12, `expected 11 renderCashChange call sites + the definition, found ${calls}`);
  for (const anchor of [
    'the concession sets the amount, so the change',
    'the waiver tick sets the amount, so the change',
    'a chip-set amount re-computes the change',
    'a loose-change tap fills the amount, so the change',
    'keypad tap sets the amount, so the change',
    'A button-set amount refreshes the same live lines',
  ]) {
    assert.ok(wiringSrc.includes(anchor), `missing refresh comment: ${anchor}`);
  }
});

test('wiring: the submit path never reads the cash field — the calculator posts nothing', () => {
  const start = wiringSrc.indexOf("paymentForm?.addEventListener('submit'");
  assert.ok(start > -1, 'the submit handler must exist');
  const handler = wiringSrc.slice(start);
  assert.ok(!handler.includes('cashReceivedInput'), 'the cash field must stay out of the submit path');
  // The only four lines that ever name the cash field: the grab, the
  // render, the cash listener, and the form-open clear.
  assert.equal((wiringSrc.match(/cashReceivedInput/g) || []).length, 5);
});

test('page: the calculator box, cash input, and change line live in the amount field group', () => {
  const start = pageSrc.indexOf('id="quickCollectCashChangeBox"');
  assert.ok(start > -1, 'cash change box must exist');
  const block = pageSrc.slice(start, start + 600);
  assert.ok(block.includes('id="quickCollectCashReceivedInput"'));
  assert.ok(block.includes('type="number"'));
  assert.ok(block.includes('id="quickCollectCashChangeLine"'));
  assert.ok(block.includes('aria-live="polite"'));
  const chips = pageSrc.indexOf('id="quickCollectLooseChangeChips"');
  assert.ok(chips > -1 && chips < start, 'the box sits after the loose-change chips');
  assert.ok(!pageSrc.includes('quickCollectCashReceivedInput" required'), 'the cash field is optional');
});

test('styles: the calculator rules carry layout only — no new hex colour in the file', () => {
  assert.match(stylesSrc, /\.chc-change-box \{/);
  assert.match(stylesSrc, /\.chc-change-line \{/);
  const baseline = stylesSrc.replace(/\.chc-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of stylesSrc.match(/\.chc-[^{]+\{[^}]*\}/g) || []) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('prefix: the chc prefix is the calculator’s own and the ids are unique', () => {
  assert.equal((pageSrc.match(/quickCollectCashChangeBox/g) || []).length, 1);
  // The cash input id appears twice: the label’s for attribute and
  // the input itself.
  assert.equal((pageSrc.match(/quickCollectCashReceivedInput/g) || []).length, 2);
  assert.equal((pageSrc.match(/quickCollectCashChangeLine/g) || []).length, 1);
  // The box variable: the grab, the null guard, and the hidden toggle.
  assert.equal((wiringSrc.match(/cashChangeBox/g) || []).length, 3);
});
