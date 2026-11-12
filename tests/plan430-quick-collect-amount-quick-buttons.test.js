// Plan 430 — Quick Collect amount quick buttons: one row of three
// buttons on the one screen — full dues, half dues, package price.
// Each button fills the amount field with the figure it names and
// nothing else: tapping never posts the payment, and the filled
// amount stays freely editable afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  oneScreenQuickAmountFigures,
  oneScreenQuickAmountButtonsHtml,
} from '../one-screen-quick-amounts.js';

const moduleSrc = readFileSync(new URL('../one-screen-quick-amounts.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The same fixture the acceptance uses: full dues Rs 3,000 across
// the open bills, package price Rs 2,000.
function fixtureFigures() {
  return oneScreenQuickAmountFigures({ fullDues: 3000, packagePrice: 2000 });
}

test('acceptance: the fixture fills full dues, half dues, and the package price', () => {
  assert.deepEqual(fixtureFigures(), { full: 3000, half: 1500, package: 2000 });
  const html = oneScreenQuickAmountButtonsHtml(fixtureFigures());
  assert.ok(html.includes('data-qab-amount="3000"'));
  assert.ok(html.includes('data-qab-amount="1500"'));
  assert.ok(html.includes('data-qab-amount="2000"'));
  assert.ok(html.indexOf('data-qab-amount="3000"') < html.indexOf('data-qab-amount="1500"'));
  assert.ok(html.indexOf('data-qab-amount="1500"') < html.indexOf('data-qab-amount="2000"'));
});

test('figures: half dues are half the full dues, rounded to whole rupees', () => {
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 3001, packagePrice: 2000 }),
    { full: 3001, half: 1501, package: 2000 },
  );
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 1500.5, packagePrice: null }),
    { full: 1500.5, half: 750, package: null },
  );
});

test('figures: half of one rupee is one rupee, never zero', () => {
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 1, packagePrice: null }),
    { full: 1, half: 1, package: null },
  );
});

test('figures: half of a sub-rupee due is nothing, never a guessed round figure', () => {
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 0.4, packagePrice: null }),
    { full: 0.4, half: null, package: null },
  );
});

test('figures: no dues means no full and no half, but the package price still stands', () => {
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: null, packagePrice: 2000 }),
    { full: null, half: null, package: 2000 },
  );
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: 0, packagePrice: 2000 }),
    { full: null, half: null, package: 2000 },
  );
});

test('figures: zero, negative, blank, boolean, and non-numeric figures are not amounts', () => {
  for (const bad of [0, -3000, '', true, false, 'abc', NaN, undefined]) {
    assert.deepEqual(
      oneScreenQuickAmountFigures({ fullDues: bad, packagePrice: bad }),
      { full: null, half: null, package: null },
      `expected nulls for ${String(bad)}`,
    );
  }
});

test('figures: a numeric string is a usable figure, exactly as the entry form reads it', () => {
  assert.deepEqual(
    oneScreenQuickAmountFigures({ fullDues: '3000', packagePrice: '2000' }),
    { full: 3000, half: 1500, package: 2000 },
  );
});

test('figures: called with nothing, every figure is null', () => {
  assert.deepEqual(oneScreenQuickAmountFigures(), { full: null, half: null, package: null });
  assert.deepEqual(oneScreenQuickAmountFigures({}), { full: null, half: null, package: null });
  assert.deepEqual(oneScreenQuickAmountFigures(null), { full: null, half: null, package: null });
});

test('figures: inputs are never mutated', () => {
  const input = Object.freeze({ fullDues: 3000, packagePrice: 2000 });
  assert.deepEqual(oneScreenQuickAmountFigures(input), { full: 3000, half: 1500, package: 2000 });
});

test('html: the three buttons render in order with their figures in the labels', () => {
  // QC Modal Fix item 11: each chip carries its own kind class
  // (--full / --half / --package) so the tonal colours can land
  // per chip (emerald / amber / blue). Labels and amounts are
  // unchanged; only the class list grows.
  assert.equal(
    oneScreenQuickAmountButtonsHtml(fixtureFigures()),
    '<button type="button" class="qab-amount-chip qab-amount-chip--full" data-qab-amount="3000">Full dues (Rs 3,000)</button>'
    + '<button type="button" class="qab-amount-chip qab-amount-chip--half" data-qab-amount="1500">Half dues (Rs 1,500)</button>'
    + '<button type="button" class="qab-amount-chip qab-amount-chip--package" data-qab-amount="2000">Package price (Rs 2,000)</button>',
  );
});

test('html: a button with no known figure shows plain words and carries no amount', () => {
  assert.equal(
    oneScreenQuickAmountButtonsHtml({ full: null, half: null, package: null }),
    '<button type="button" class="qab-amount-chip qab-amount-chip--full">Full dues</button>'
    + '<button type="button" class="qab-amount-chip qab-amount-chip--half">Half dues</button>'
    + '<button type="button" class="qab-amount-chip qab-amount-chip--package">Package price</button>',
  );
});

test('html: a known figure and an unknown figure mix — only the known one carries an amount', () => {
  const html = oneScreenQuickAmountButtonsHtml({ full: 3000, half: 1500, package: null });
  assert.ok(html.includes('data-qab-amount="3000"'));
  assert.ok(html.includes('data-qab-amount="1500"'));
  assert.ok(html.includes('>Package price</button>'));
  assert.equal((html.match(/data-qab-amount=/g) || []).length, 2);
});

test('html: every button is type button, so tapping one never submits anything', () => {
  const html = oneScreenQuickAmountButtonsHtml(fixtureFigures());
  assert.equal((html.match(/<button /g) || []).length, 3);
  assert.equal((html.match(/type="button"/g) || []).length, 3);
  assert.ok(!html.includes('<form'));
  assert.ok(!html.includes('submit'));
});

test('html: labels use the app min-0 decimals — whole rupees print without decimals', () => {
  const html = oneScreenQuickAmountButtonsHtml({ full: 1500.5, half: 750, package: null });
  assert.ok(html.includes('Full dues (Rs 1,500.5)'));
  assert.ok(html.includes('Half dues (Rs 750)'));
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
    assert.ok(!readFileSync(new URL(import.meta.url), 'utf8').includes(name), `test must not name ${name} literally`);
  }
});

test('wiring: the controller imports the one-screen quick amounts module', () => {
  assert.match(wiringSrc, /one-screen-quick-amounts\.js/);
  assert.match(wiringSrc, /oneScreenQuickAmountFigures/);
  assert.match(wiringSrc, /oneScreenQuickAmountButtonsHtml/);
});

test('wiring: the row is inserted after the one-screen amount field group', () => {
  const start = wiringSrc.indexOf('function bindOneScreenControls()');
  assert.notEqual(start, -1);
  // QC Modal Fix item 12: the combobox + method-pills wiring now
  // sits between the bind start and the quick-amount row, so the
  // old fixed 4000-char window no longer reaches it. Slice to the
  // next top-level function instead — the assertion is the same
  // (the row is inserted after the amount field group), only the
  // window is robust to the wiring above it growing.
  const end = wiringSrc.indexOf('function submitOneScreenPayment()', start);
  assert.notEqual(end, -1);
  const block = wiringSrc.slice(start, end);
  assert.match(block, /qab-row/);
  assert.match(block, /closest\('\.qc-field-group'\)/);
  assert.match(block, /\.after\(quickAmountRow\)/);
  assert.match(block, /renderOneScreenQuickAmounts\(\)/);
});

test('wiring: the row refreshes whenever the picked customer changes', () => {
  const calls = (wiringSrc.match(/renderOneScreenQuickAmounts\(\)/g) || []).length;
  assert.ok(calls >= 3, `expected the row to refresh on bind and on both change branches, found ${calls} calls`);
  assert.match(wiringSrc, /function renderOneScreenQuickAmounts\(\)/);
  const start = wiringSrc.indexOf('function renderOneScreenQuickAmounts()');
  const block = wiringSrc.slice(start, start + 600);
  assert.match(block, /suggestedAmount/);
  assert.match(block, /packagePriceForCustomer/);
});

test('wiring: tapping a button fills only the one-screen amount field', () => {
  const start = wiringSrc.indexOf('data-qab-amount');
  assert.notEqual(start, -1);
  const block = wiringSrc.slice(start, start + 900);
  assert.match(block, /amountInputOne\.value = /);
  assert.match(block, /amountInputOne\.focus\(\)/);
  assert.ok(!block.includes('requestSubmit'), 'a button tap must never submit');
  assert.ok(!block.includes('submitOneScreenPayment'), 'a button tap must never save');
});

test('wiring: the row is rendered by script — no new element id in the page', () => {
  assert.ok(!pageSrc.includes('qab-'), 'the page carries no qab element id');
});

test('styles: the one-screen buttons reuse the entry form chips look', () => {
  assert.ok(stylesSrc.includes('.qab-amount-chip'));
  assert.ok(stylesSrc.includes('.qab-amount-chip:hover'));
  assert.match(stylesSrc, /\[data-theme="dark"\] #quickCollectModal \.qab-amount-chip/);
});

test('styles: no hex colour new to the file in the one-screen button rules', () => {
  const rules = stylesSrc.match(/\.qab-amount-chip[^{]*\{[^}]*\}|\[data-theme="dark"\] #quickCollectModal \.qab-amount-chip[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 3, `expected the button rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.qab-amount-chip[^{]*\{[^}]*\}|\[data-theme="dark"\] #quickCollectModal \.qab-amount-chip[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
