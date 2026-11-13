// Plan 447 — Quick Collect big name and mohalla confirmation before
// saving: one big line on the payment form naming the selected
// customer in large text, with mohalla and current dues, so the
// operator catches a wrong-customer pick by eye before tapping
// Save. The confirm step (Plan 382) already shows a summary at
// confirm time; this line is the always-visible one on the sheet
// itself, refreshed the moment the customer changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BIG_NAME_CONFIRM_UNASSIGNED_MOHALLA,
  bigNameConfirmFigure,
  formatBigNameConfirmAmount,
  bigNameConfirmMohalla,
  bigNameConfirmLine,
  bigNameConfirmLineText,
  bigNameConfirmLineHtml,
} from '../quick-collect-big-name-confirm.js';

const moduleSrc = readFileSync(new URL('../quick-collect-big-name-confirm.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function customer(extra = {}) {
  return { id: 'cust-1', name: 'Ali Raza', mohalla: 'Bani', ...extra };
}

// --- Amount formatting ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatBigNameConfirmAmount(3000), '3,000');
  assert.equal(formatBigNameConfirmAmount(1500.5), '1,500.5');
  assert.equal(formatBigNameConfirmAmount(0), '0');
});

test('figure: a missing figure is "not a number", never zero', () => {
  assert.equal(bigNameConfirmFigure(null), null);
  assert.equal(bigNameConfirmFigure(undefined), null);
  assert.equal(bigNameConfirmFigure(''), null);
  assert.equal(bigNameConfirmFigure(true), null);
  assert.equal(bigNameConfirmFigure(false), null);
  assert.equal(bigNameConfirmFigure(Number.NaN), null);
  assert.equal(bigNameConfirmFigure(1500), 1500);
  assert.equal(bigNameConfirmFigure(0), 0);
});

// --- Mohalla ---

test('mohalla: the record mohalla wins over the legacy area field', () => {
  assert.equal(bigNameConfirmMohalla(customer({ mohalla: 'Bani', area: 'Chamya' })), 'Bani');
});

test('mohalla: a blank mohalla falls back to the area field', () => {
  assert.equal(bigNameConfirmMohalla(customer({ mohalla: '  ', area: 'Chamya' })), 'Chamya');
});

test('mohalla: neither field recorded reads Unassigned, never guessed', () => {
  assert.equal(bigNameConfirmMohalla(customer({ mohalla: '', area: '' })), 'Unassigned');
  assert.equal(bigNameConfirmMohalla(customer({ mohalla: undefined, area: undefined })), 'Unassigned');
  assert.equal(bigNameConfirmMohalla(null), BIG_NAME_CONFIRM_UNASSIGNED_MOHALLA);
});

// --- Line ---

test('line: a usable customer gives name, mohalla and dues', () => {
  const line = bigNameConfirmLine(customer(), 1500);
  assert.deepEqual(line, {
    customerId: 'cust-1',
    name: 'Ali Raza',
    mohalla: 'Bani',
    dues: 1500,
    duesKnown: true,
  });
});

test('line: zero dues is a known figure, never a missing one', () => {
  const line = bigNameConfirmLine(customer(), 0);
  assert.equal(line.dues, 0);
  assert.equal(line.duesKnown, true);
});

test('line: an unusable dues figure still gives a line, with dues left out', () => {
  for (const dues of [null, undefined, '', true, Number.NaN]) {
    const line = bigNameConfirmLine(customer(), dues);
    assert.equal(line.dues, null);
    assert.equal(line.duesKnown, false);
    assert.equal(line.name, 'Ali Raza');
  }
});

test('line: no usable customer gives no line, never a guess', () => {
  assert.equal(bigNameConfirmLine(null, 1500), null);
  assert.equal(bigNameConfirmLine({}, 1500), null);
  assert.equal(bigNameConfirmLine(customer({ id: '  ' }), 1500), null);
  assert.equal(bigNameConfirmLine(customer({ name: '   ' }), 1500), null);
  assert.equal(bigNameConfirmLine(customer({ name: '' }), 1500), null);
});

test('line: the name is trimmed and capped, the mohalla is trimmed', () => {
  const longName = `  ${'A'.repeat(120)}  `;
  const line = bigNameConfirmLine(customer({ name: longName, mohalla: '  Bani  ' }), 1500);
  assert.equal(line.name.length, 100);
  assert.equal(line.mohalla, 'Bani');
});

// --- Line text ---

test('line text: name, mohalla and dues in one plain line', () => {
  assert.equal(bigNameConfirmLineText(bigNameConfirmLine(customer(), 1500)), 'Ali Raza — Bani — Dues PKR 1,500');
});

test('line text: zero dues reads as a figure, not as missing', () => {
  assert.equal(bigNameConfirmLineText(bigNameConfirmLine(customer(), 0)), 'Ali Raza — Bani — Dues PKR 0');
});

test('line text: unknown dues leaves the dues part out, never a guess', () => {
  assert.equal(bigNameConfirmLineText(bigNameConfirmLine(customer(), null)), 'Ali Raza — Bani');
});

test('line text: an unusable line reads empty, never a guessed figure', () => {
  assert.equal(bigNameConfirmLineText(null), '');
  assert.equal(bigNameConfirmLineText({}), '');
});

// --- Line HTML ---

test('line html: the name is large, the dues carry the owed class', () => {
  const html = bigNameConfirmLineHtml(bigNameConfirmLine(customer(), 1500));
  assert.ok(html.includes('<strong class="bnc-name">Ali Raza</strong>'), 'name must be large and bold');
  assert.ok(html.includes('<span class="bnc-mohalla">Bani</span>'), 'mohalla must be shown');
  assert.ok(html.includes('<strong class="qc-meta-val has-balance">Dues PKR 1,500</strong>'), 'owed dues must carry the owed class');
});

test('line html: zero dues carries the settled class', () => {
  const html = bigNameConfirmLineHtml(bigNameConfirmLine(customer(), 0));
  assert.ok(html.includes('<strong class="qc-meta-val zero-balance">Dues PKR 0</strong>'), 'settled dues must carry the settled class');
});

test('line html: unknown dues shows name and mohalla only, no dues span', () => {
  const html = bigNameConfirmLineHtml(bigNameConfirmLine(customer(), null));
  assert.ok(html.includes('<strong class="bnc-name">Ali Raza</strong>'), 'name must still show');
  assert.ok(!html.includes('Dues PKR'), 'no dues figure may be guessed');
});

test('line html: a name or mohalla with markup is escaped, never raw', () => {
  const html = bigNameConfirmLineHtml(bigNameConfirmLine(customer({ name: '<script>alert(1)</script>', mohalla: 'Bani & Sons' }), 1500));
  assert.ok(!html.includes('<script>'), 'name markup must be escaped');
  assert.ok(html.includes('&lt;script&gt;'), 'escaped name must be present');
  assert.ok(html.includes('Bani &amp; Sons'), 'escaped mohalla must be present');
});

test('line html: an unusable line renders nothing', () => {
  assert.equal(bigNameConfirmLineHtml(null), '');
  assert.equal(bigNameConfirmLineHtml({}), '');
});

// --- Wiring ---

test('wiring: the Quick Collect controller no longer imports the big-name line', () => {
  // QC Modal Overhaul 2: the big-name confirmation line is REMOVED
  // from the payment form — it was the duplicate large heading the
  // spec deletes (the customer header above already names the
  // customer). The module file stays, unreferenced, with its pure
  // tests untouched; only the wiring goes.
  assert.ok(!wiringSrc.includes("from './quick-collect-big-name-confirm.js'"), 'the module import must be gone');
  assert.ok(!wiringSrc.includes('bigNameConfirmLine, bigNameConfirmLineHtml'), 'the line imports must be gone');
  assert.ok(!wiringSrc.includes('bigNameConfirmLine'), 'no big-name line reference may remain in the controller');
});

test('wiring: the big-name host is no longer read on the payment form', () => {
  // QC Modal Overhaul 2: the host is deleted with the line — see
  // the import test above for why.
  assert.ok(!wiringSrc.includes("getElementById('bncBigNameConfirm')"), 'the host lookup must be gone');
});

test('wiring: no big-name render reads the selected customer anymore', () => {
  // QC Modal Overhaul 2: renderBigNameConfirm() is deleted with the
  // line — the customer header above the form already names the
  // customer, mohalla and dues.
  assert.ok(!wiringSrc.includes('function renderBigNameConfirm()'), 'the render function must be gone');
  assert.ok(!wiringSrc.includes('renderBigNameConfirm'), 'no big-name render reference may remain');
});

test('wiring: the line renders never — no render call remains in the form open', () => {
  const calls = wiringSrc.match(/renderBigNameConfirm\(\);/g) || [];
  assert.equal(calls.length, 0, `expected 0 render calls, found ${calls.length}`);
  // Plan 490: the form open takes an optional repeat options object,
  // so the signature carries it — the open itself is unchanged, only
  // the big-name render inside it is gone.
  assert.ok(wiringSrc.includes('function openCustomerCollectionForm(customerId, options = {})'), 'missing form open');
});

test('page: the big-name host is gone from the payment form', () => {
  // QC Modal Overhaul 2: the host is deleted — the form step fits on
  // one screen without the duplicate large heading. The customer
  // header and the handling note box stay, in the same order.
  assert.ok(!pageSrc.includes('<p id="bncBigNameConfirm"'), 'the big-name host must be gone');
  assert.ok(!pageSrc.includes('class="bnc-confirm-line"'), 'the big-name class must be gone from the page');
  const headerAt = pageSrc.indexOf('quickCollectCustomerHeader');
  const noteAt = pageSrc.indexOf('quickCollectHandlingNoteBox');
  assert.ok(headerAt !== -1 && noteAt !== -1, 'form hosts missing');
  assert.ok(headerAt < noteAt, 'the customer header must still sit before the handling note box');
});

// --- Fences ---

test('fences: the big-name module is pure — no clock, no storage, no store key', () => {
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
    'daily-entry-' + 'summary.js',
    'big-wallet-method-' + 'buttons.js',
    'double-tap-save-' + 'guard.js',
    'offline-saved-' + 'badge.js',
    'quick-collect-reversal-' + 'undo.js',
    'success-next-' + 'steps.js',
    'receipt-' + 'preview.js',
    'cash-change-' + 'calculator.js',
    'remembered-' + 'method.js',
    'dues-amount-' + 'default.js',
    'quick-collect-round-' + 'totals.js',
    'quick-collect-one-' + 'screen.js',
    'quick-collect-still-' + 'owes.js',
    'quick-collect-mohalla-' + 'filter.js',
    'name-prefix-' + 'lookup.js',
    'recent-quick-' + 'pick.js',
    'one-screen-quick-' + 'amounts.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the big-name line', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'dashboard-' + 'daily-closing.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'dues-amount-' + 'default.js',
    'success-next-' + 'steps.js',
    'quick-collect-round-' + 'totals.js',
    'quick-collect-still-' + 'owes.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('bigNameConfirm'), `${file} must not reference the big-name line`);
    assert.ok(!src.includes('bncBigNameConfirm'), `${file} must not reference the big-name host`);
  }
});

// --- Styles ---

test('styles: the big-name rules are gone with the line — no dead sizing left', () => {
  // QC Modal Overhaul 2: the host is deleted, so its sizing rules go
  // with it (the dead-rule precedent: a rule with no element is
  // deleted, not left behind). The no-new-hex invariant is vacuous
  // now — there is no .bnc- rule left to carry one.
  const rules = stylesSrc.match(/\.bnc-[^{]+\{[^}]*\}/g) || [];
  assert.equal(rules.length, 0, `expected no .bnc- rules, found ${rules.length}`);
});
