import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { amountInWords, amountInWordsLineText } from '../amount-in-words.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'amount-in-words.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// ---------------------------------------------------------------------------
// Words for whole amounts
// ---------------------------------------------------------------------------

test('words: zero reads Zero', () => {
  assert.equal(amountInWords(0), 'Zero');
  assert.equal(amountInWords('0'), 'Zero');
  assert.equal(amountInWords('0.00'), 'Zero');
});

test('words: ones, teens and tens', () => {
  assert.equal(amountInWords(1), 'One');
  assert.equal(amountInWords(7), 'Seven');
  assert.equal(amountInWords(11), 'Eleven');
  assert.equal(amountInWords(15), 'Fifteen');
  assert.equal(amountInWords(19), 'Nineteen');
  assert.equal(amountInWords(20), 'Twenty');
  assert.equal(amountInWords(21), 'Twenty one');
  assert.equal(amountInWords(45), 'Forty five');
  assert.equal(amountInWords(99), 'Ninety nine');
});

test('words: hundreds', () => {
  assert.equal(amountInWords(100), 'One hundred');
  assert.equal(amountInWords(101), 'One hundred one');
  assert.equal(amountInWords(150), 'One hundred fifty');
  assert.equal(amountInWords(999), 'Nine hundred ninety nine');
});

test('words: thousands — the spec example', () => {
  assert.equal(amountInWords(1000), 'One thousand');
  assert.equal(amountInWords(1500), 'One thousand five hundred');
  // A mistyped 15000 reads "Fifteen thousand", so the extra zero is
  // heard before the receipt is printed.
  assert.equal(amountInWords(15000), 'Fifteen thousand');
  assert.equal(amountInWords(25000), 'Twenty five thousand');
  assert.equal(amountInWords(99999), 'Ninety nine thousand nine hundred ninety nine');
});

test('words: lakhs and crores use the South Asian grouping', () => {
  assert.equal(amountInWords(100000), 'One lakh');
  assert.equal(amountInWords(150000), 'One lakh fifty thousand');
  assert.equal(amountInWords(250000), 'Two lakh fifty thousand');
  assert.equal(amountInWords(1000000), 'Ten lakh');
  assert.equal(amountInWords(999999), 'Nine lakh ninety nine thousand nine hundred ninety nine');
  assert.equal(amountInWords(10000000), 'One crore');
  assert.equal(amountInWords(15000000), 'One crore fifty lakh');
  assert.equal(amountInWords(100000000), 'Ten crore');
});

test('words: large amounts keep grouping', () => {
  assert.equal(amountInWords(1000000000), 'One arab');
  assert.equal(amountInWords(123456789), 'Twelve crore thirty four lakh fifty six thousand seven hundred eighty nine');
});

// ---------------------------------------------------------------------------
// Decimals, typing states and invalid input
// ---------------------------------------------------------------------------

test('words: paisa is read after "and"', () => {
  assert.equal(amountInWords(1500.5), 'One thousand five hundred and fifty paisa');
  assert.equal(amountInWords('1500.50'), 'One thousand five hundred and fifty paisa');
  assert.equal(amountInWords('1500.05'), 'One thousand five hundred and five paisa');
  assert.equal(amountInWords('0.50'), 'Zero and fifty paisa');
  assert.equal(amountInWords('0.25'), 'Zero and twenty five paisa');
});

test('words: a whole amount carries no paisa part', () => {
  assert.equal(amountInWords('1500.00'), 'One thousand five hundred');
  assert.equal(amountInWords('1500.0'), 'One thousand five hundred');
});

test('words: a trailing dot mid-typing keeps the whole amount', () => {
  assert.equal(amountInWords('1500.'), 'One thousand five hundred');
});

test('words: surrounding whitespace is trimmed', () => {
  assert.equal(amountInWords(' 1500 '), 'One thousand five hundred');
});

test('words: empty, non-numeric, negative and out-of-range values have no words', () => {
  assert.equal(amountInWords(''), '');
  assert.equal(amountInWords('   '), '');
  assert.equal(amountInWords('abc'), '');
  assert.equal(amountInWords('1,500'), '');
  assert.equal(amountInWords('15 000'), '');
  assert.equal(amountInWords('-5'), '');
  assert.equal(amountInWords(-1500), '');
  assert.equal(amountInWords(null), '');
  assert.equal(amountInWords(undefined), '');
  assert.equal(amountInWords({}), '');
  assert.equal(amountInWords(NaN), '');
  assert.equal(amountInWords(Infinity), '');
  assert.equal(amountInWords('99999999999999999999'), '');
});

// ---------------------------------------------------------------------------
// Line text
// ---------------------------------------------------------------------------

test('line text: the words for the digits currently typed, or empty', () => {
  assert.equal(amountInWordsLineText('15000'), 'Fifteen thousand');
  assert.equal(amountInWordsLineText(''), '');
  assert.equal(amountInWordsLineText('abc'), '');
});

// ---------------------------------------------------------------------------
// Purity and fences
// ---------------------------------------------------------------------------

test('module: pure, import-free, no store, no clock, no page access', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'display only: no store key');
  assert.ok(!moduleSrc.includes('document.'), 'no page access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('import '), 'import-free module');
  assert.ok(!moduleSrc.includes('export default'), 'no default export');
});

test('module: no standalone OLT in the module', () => {
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'deployment guard: no standalone OLT');
});

test('module: the header never names a fenced module literally', () => {
  // No amount-in-words module existed before this plan, so there is no
  // fenced filename to name — the header must not invent one either.
  // The names are built from fragments so this test itself never
  // contains a fenced filename literally.
  const fenced = ['amount', 'in', 'words'].join('-') + '.js';
  assert.ok(!moduleSrc.includes(fenced), 'header must not name the module itself as a fence');
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

test('styles: the words line rule exists and adds no new hex colour', () => {
  assert.ok(stylesSrc.includes('.aiw-words-line'), 'styles must define .aiw-words-line');
  const stripped = stylesSrc.replace(/\.aiw-words-line[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.aiw-words-line[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'words line styles exist');
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Wiring (static: the live display is DOM-coupled, like the Plan 376
// pre-fill line, so the wiring is pinned by source, not by a DOM)
// ---------------------------------------------------------------------------

test('wiring: the payment form imports the words module and owns the line element', () => {
  assert.ok(
    quickCollectSrc.includes("from './amount-in-words.js'"),
    'nav-quick-collect.js must import amount-in-words.js',
  );
  assert.ok(
    quickCollectSrc.includes('quickCollectAmountWordsLine'),
    'nav-quick-collect.js must own the words line element',
  );
  assert.ok(
    quickCollectSrc.includes('amountInWordsLineText'),
    'nav-quick-collect.js must use amountInWordsLineText',
  );
  assert.ok(
    indexSrc.includes('id="quickCollectAmountWordsLine"'),
    'index.html must carry the words line element',
  );
  assert.ok(
    indexSrc.includes('class="aiw-words-line"'),
    'index.html must give the words line its class',
  );
});

test('wiring: the words refresh on every amount edit and on form open', () => {
  // Typing: an input listener on the amount field refreshes the line.
  assert.ok(
    /amountInput\?\.addEventListener\('input', \(\) => renderAmountWordsLine\(\)\)/.test(quickCollectSrc),
    'an amount input listener must refresh the words line',
  );
  // Form open: the line is refreshed when the form is pre-filled.
  const openCalls = quickCollectSrc.split('renderAmountWordsLine()').length - 1;
  assert.ok(openCalls >= 3, `renderAmountWordsLine must be called from the form flow (${openCalls} calls found)`);
});

test('wiring: clearing the field clears the words', () => {
  assert.ok(
    /wordsLine\.hidden = text === ''/.test(quickCollectSrc),
    'the words line must hide when there are no words',
  );
});
