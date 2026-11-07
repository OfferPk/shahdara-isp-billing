// Plan 442 — Quick Collect on-screen numeric keypad for the amount:
// big one-thumb digit keys for the amount field, so the operator
// never needs the phone's own keyboard at the counter. Every digit
// key enters exactly its digit, backspace drops the last digit, and
// clear empties the field. The keypad enters digits only and posts
// nothing: it never records a payment by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AMOUNT_KEYPAD_KEYS,
  AMOUNT_KEYPAD_CLEAR_KEY,
  AMOUNT_KEYPAD_BACKSPACE_KEY,
  amountKeypadIsDigit,
  amountKeypadDigitsOf,
  amountKeypadAppendDigit,
  amountKeypadBackspace,
  amountKeypadClear,
  amountKeypadApplyKey,
  amountKeypadLabel,
  amountKeypadHtml,
} from '../quick-collect-amount-keypad.js';

const moduleSrc = readFileSync(new URL('../quick-collect-amount-keypad.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// --- Digits ---

test('only a single digit character is a digit key', () => {
  for (const digit of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    assert.equal(amountKeypadIsDigit(digit), true);
  }
  assert.equal(amountKeypadIsDigit('10'), false);
  assert.equal(amountKeypadIsDigit(''), false);
  assert.equal(amountKeypadIsDigit('a'), false);
  assert.equal(amountKeypadIsDigit('.'), false);
  assert.equal(amountKeypadIsDigit('clear'), false);
  assert.equal(amountKeypadIsDigit('backspace'), false);
  assert.equal(amountKeypadIsDigit(null), false);
  assert.equal(amountKeypadIsDigit(undefined), false);
  assert.equal(amountKeypadIsDigit(5), false);
  assert.equal(amountKeypadIsDigit(true), false);
});

test('the digit string is the whole-rupee figure, paisa dropped never rounded', () => {
  assert.equal(amountKeypadDigitsOf('1500'), '1500');
  assert.equal(amountKeypadDigitsOf('1500.00'), '1500');
  assert.equal(amountKeypadDigitsOf('1500.50'), '1500');
  assert.equal(amountKeypadDigitsOf('1500.99'), '1500');
  assert.equal(amountKeypadDigitsOf('1,500'), '1500');
  assert.equal(amountKeypadDigitsOf(''), '');
  assert.equal(amountKeypadDigitsOf('abc'), '');
  assert.equal(amountKeypadDigitsOf(1500), '1500');
  assert.equal(amountKeypadDigitsOf(0), '0');
  assert.equal(amountKeypadDigitsOf(null), '');
  assert.equal(amountKeypadDigitsOf(undefined), '');
  assert.equal(amountKeypadDigitsOf(true), '');
  assert.equal(amountKeypadDigitsOf(false), '');
  assert.equal(amountKeypadDigitsOf('-500'), '500');
});

// --- Append / backspace / clear ---

test('every digit key appends exactly its digit', () => {
  assert.equal(amountKeypadAppendDigit('', '5'), '5');
  assert.equal(amountKeypadAppendDigit('1', '5'), '15');
  assert.equal(amountKeypadAppendDigit('1500', '5'), '15005');
  assert.equal(amountKeypadAppendDigit('1500.00', '5'), '15005');
  assert.equal(amountKeypadAppendDigit('0', '5'), '05');
  assert.equal(amountKeypadAppendDigit(null, '5'), '5');
});

test('a key that is not a digit never invents a digit', () => {
  assert.equal(amountKeypadAppendDigit('1500', 'x'), '1500');
  assert.equal(amountKeypadAppendDigit('1500.00', 'x'), '1500');
  assert.equal(amountKeypadAppendDigit('', 'clear'), '');
  assert.equal(amountKeypadAppendDigit('1500', ''), '1500');
  assert.equal(amountKeypadAppendDigit('1500', null), '1500');
});

test('backspace drops the last digit and empty stays empty', () => {
  assert.equal(amountKeypadBackspace('1505'), '150');
  assert.equal(amountKeypadBackspace('5'), '');
  assert.equal(amountKeypadBackspace(''), '');
  assert.equal(amountKeypadBackspace('1500.00'), '150');
  assert.equal(amountKeypadBackspace(null), '');
  assert.equal(amountKeypadBackspace('0'), '');
});

test('clear always empties the field', () => {
  assert.equal(amountKeypadClear(), '');
});

// --- One key press ---

test('typing 3000 digit by digit enters exactly 3000', () => {
  let figure = '';
  for (const digit of ['3', '0', '0', '0']) {
    figure = amountKeypadApplyKey(figure, digit);
  }
  assert.equal(figure, '3000');
});

test('applyKey dispatches digit, backspace and clear', () => {
  assert.equal(amountKeypadApplyKey('150', '5'), '1505');
  assert.equal(amountKeypadApplyKey('1505', 'backspace'), '150');
  assert.equal(amountKeypadApplyKey('1505', 'clear'), '');
  assert.equal(amountKeypadApplyKey('1500.00', '3'), '15003');
});

test('an unknown key leaves the figure exactly as it is', () => {
  assert.equal(amountKeypadApplyKey('1500', 'enter'), '1500');
  assert.equal(amountKeypadApplyKey('1500.00', 'enter'), '1500');
  assert.equal(amountKeypadApplyKey('1500', ''), '1500');
  assert.equal(amountKeypadApplyKey('1500', null), '1500');
  assert.equal(amountKeypadApplyKey('1500', 'Clear'), '1500');
  assert.equal(amountKeypadApplyKey('', 'enter'), '');
});

test('the clear and backspace key names are the ones the wiring uses', () => {
  assert.equal(AMOUNT_KEYPAD_CLEAR_KEY, 'clear');
  assert.equal(AMOUNT_KEYPAD_BACKSPACE_KEY, 'backspace');
});

// --- Keys and markup ---

test('the keypad carries digits 0-9, backspace and clear, in reading order', () => {
  assert.deepEqual(AMOUNT_KEYPAD_KEYS, [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'clear', '0', 'backspace',
  ]);
  assert.equal(AMOUNT_KEYPAD_KEYS.length, 12);
  assert.ok(Object.isFrozen(AMOUNT_KEYPAD_KEYS));
});

test('each key is labelled plainly: the digit, C, or the backspace mark', () => {
  assert.equal(amountKeypadLabel('5'), '5');
  assert.equal(amountKeypadLabel('0'), '0');
  assert.equal(amountKeypadLabel('clear'), 'C');
  assert.equal(amountKeypadLabel('backspace'), '⌫');
  assert.equal(amountKeypadLabel('enter'), '');
  assert.equal(amountKeypadLabel(''), '');
  assert.equal(amountKeypadLabel(null), '');
});

test('the keypad markup has one plain button per key, never a submit', () => {
  const html = amountKeypadHtml();
  assert.equal((html.match(/data-kpd-key="/g) || []).length, 12);
  assert.equal((html.match(/<button type="button"/g) || []).length, 12);
  assert.doesNotMatch(html, /type="submit"/);
  for (const key of AMOUNT_KEYPAD_KEYS) {
    assert.match(html, new RegExp(`data-kpd-key="${key}"`));
  }
  assert.match(html, /data-kpd-key="5"[^>]*>5</);
  assert.match(html, /data-kpd-key="clear"[^>]*>C</);
  assert.match(html, /data-kpd-key="backspace"[^>]*>⌫</);
  assert.match(html, /aria-label="Amount key backspace"/);
  assert.match(html, /aria-label="Amount key clear"/);
  assert.match(html, /aria-label="Amount key 5"/);
});

// --- Purity ---

// The module is pure: no document, no store, no clock, no network,
// and nothing that could post a payment.
test('the module is pure and posts nothing', () => {
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /window\./);
  assert.doesNotMatch(moduleSrc, /shahdara_/);
  assert.doesNotMatch(moduleSrc, /^import /m);
  assert.doesNotMatch(moduleSrc, /requestSubmit/);
  assert.doesNotMatch(moduleSrc, /addPayment/);
  assert.doesNotMatch(moduleSrc, /submit\(/);
});

// The module header never names a fenced module's filename literally
// (each name below is built from fragments so the test itself does
// not carry the literal either).
test('the module header names no fenced filename literally', () => {
  const fenced = [
    ['nav', '-', 'quick', '-', 'collect', '.', 'js'].join(''),
    ['quick', '-', 'amount', '-', 'buttons', '.', 'js'].join(''),
    ['cash', '-', 'change', '-', 'calculator', '.', 'js'].join(''),
    ['one', '-', 'screen', '-', 'quick', '-', 'amounts', '.', 'js'].join(''),
    ['quick', '-', 'collect', '-', 'one', '-', 'screen', '.', 'js'].join(''),
    ['last', '-', 'four', '-', 'digits', '-', 'search', '.', 'js'].join(''),
    ['name', '-', 'prefix', '-', 'lookup', '.', 'js'].join(''),
  ];
  for (const name of fenced) {
    assert.doesNotMatch(moduleSrc, new RegExp(name.replace('.', '\\.')));
  }
});

// --- Fences ---

// The neighbouring entry helpers never reference the keypad: this
// plan adds the keypad only, and never rewrites them.
test('fences: the neighbouring entry helpers never reference the keypad', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'quick-amount-' + 'buttons.js',
    'one-screen-quick-' + 'amounts.js',
    'cash-change-' + 'calculator.js',
    'quick-collect-one-' + 'screen.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('amountKeypad'), `${file} must not reference the keypad`);
    assert.ok(!src.includes('kpdAmountKeypad'), `${file} must not reference the keypad host`);
  }
});

// --- Wiring ---

test('wiring: the controller imports the keypad module', () => {
  assert.match(wiringSrc, /quick-collect-amount-keypad\.js/);
  assert.match(wiringSrc, /amountKeypadApplyKey/);
  assert.match(wiringSrc, /amountKeypadHtml/);
});

test('wiring: the keypad renders into its host on the form step', () => {
  assert.match(wiringSrc, /kpdAmountKeypad/);
  assert.match(wiringSrc, /renderAmountKeypad/);
  const start = wiringSrc.indexOf('function renderAmountKeypad()');
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 400);
  assert.match(block, /amountKeypadHtml\(\)/);
});

test('wiring: a keypad tap writes the figure into the amount field', () => {
  const start = wiringSrc.indexOf("amountKeypadBox?.addEventListener('click'");
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 1200);
  assert.match(block, /data-kpd-key/);
  assert.match(block, /amountKeypadApplyKey\(amountInput\.value/);
  assert.match(block, /amountInput\.value =/);
  assert.doesNotMatch(block, /requestSubmit/);
});

test('wiring: a keypad tap refreshes every live line, like a typed amount', () => {
  const start = wiringSrc.indexOf("amountKeypadBox?.addEventListener('click'");
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 1200);
  assert.match(block, /renderAmountWordsLine\(\)/);
  assert.match(block, /renderCashChange\(\)/);
  assert.match(block, /renderSettlementPreview\(\)/);
  assert.match(block, /renderOverpaymentChoice\(\)/);
  assert.match(block, /renderUnderpaymentWarning\(\)/);
  assert.match(block, /renderRemainderWaadaRow\(\)/);
  assert.match(block, /renderWaiverBox\(/);
});

test('wiring: the keypad host sits right after the amount field', () => {
  const input = pageSrc.indexOf('id="quickCollectAmountInput"');
  const host = pageSrc.indexOf('id="kpdAmountKeypad"');
  const prefill = pageSrc.indexOf('id="quickCollectPrefillLine"');
  assert.notEqual(input, -1);
  assert.notEqual(host, -1);
  assert.notEqual(prefill, -1);
  assert.ok(input < host && host < prefill);
});

test('the kpd element-id prefix is used by this plan only', () => {
  assert.equal((pageSrc.match(/id="kpd/g) || []).length, 1);
});

// --- Styles ---

test('styles: the keypad rules exist and reuse existing colours only — no new hex', () => {
  const rules = stylesSrc.match(/\.kpd-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, 'missing .kpd-keypad / .kpd-key rules');
  const baseline = stylesSrc.replace(/\.kpd-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
  // The dark-theme rule reuses the quick chips' dark colours only.
  const dark = stylesSrc.match(/\[data-theme="dark"\] #quickCollectModal \.kpd-key \{[^}]*\}/);
  assert.ok(dark, 'missing dark-theme .kpd-key rule');
  for (const hex of dark[0].match(/#[0-9a-fA-F]{3,8}/g) || []) {
    assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in the dark rule`);
  }
  assert.match(stylesSrc, /\.kpd-keypad \{[^}]*grid-template-columns: repeat\(3, 1fr\)/);
  assert.match(stylesSrc, /\.kpd-key \{[^}]*min-height: 56px/);
});
